/* ============================================================
   universe/procedural.ts
   移植自 ORBIT 项目 src/universe/deep-space-bodies.js 的着色器部分（Apache-2.0）。
   已修改：抽取为可复用的 TypeScript 工厂（恒星表面 / 行星表面 / 大气辉光 / 光晕贴图），
   并剥离黑洞分支。用于站 3「其他恒星行星系」：用程序化表面表现遥远恒星与系外行星，
   避免套用太阳系行星照片造成"已拍到系外行星表面"的误解。
   原始项目：https://github.com/ryh842487118-bot/orbit
   ============================================================ */
import * as THREE from 'three'
import { TAU } from '../core/math'

const surfaceVertex = `
  varying vec3 vSurface, vWorldNormal, vWorldPosition;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vSurface = position;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
    #include <logdepthbuf_vertex>
  }
`

const noiseFunctions = `
  float hash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float noise3(vec3 p) {
    vec3 cell = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(cell), hash(cell + vec3(1, 0, 0)), f.x),
          mix(hash(cell + vec3(0, 1, 0)), hash(cell + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(cell + vec3(0, 0, 1)), hash(cell + vec3(1, 0, 1)), f.x),
          mix(hash(cell + vec3(0, 1, 1)), hash(cell + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float turbulence(vec3 p) {
    return noise3(p) * 0.58 + noise3(p * 2.07 + 13.7) * 0.28
      + noise3(p * 4.11 - 7.3) * 0.14;
  }
`

const starFragment = `
  uniform vec3 uColor, uHotColor;
  uniform float uTime, uSeed, uCells, uEmission;
  varying vec3 vSurface, vWorldNormal, vWorldPosition;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  ${noiseFunctions}
  void main() {
    vec3 p = normalize(vSurface);
    vec3 drift = vec3(uTime * 0.015, -uTime * 0.008, uSeed);
    float convection = turbulence(p * 5.0 + drift * 0.4);
    vec3 warped = p * uCells + convection * 2.5 + drift;
    float cells = noise3(warped);
    float grains = noise3(warped * 3.7 + 8.3);
    float seams = smoothstep(0.28, 0.58, cells);
    float granular = mix(0.42, 1.10, seams) + (grains - 0.5) * 0.20;
    float hotRegions = smoothstep(0.48, 0.82, convection);
    vec3 surface = mix(uColor, uHotColor, 0.15 + hotRegions * 0.48);
    float mu = clamp(dot(normalize(vWorldNormal),
      normalize(cameraPosition - vWorldPosition)), 0.0, 1.0);
    float limb = 0.42 + 0.58 * sqrt(mu);
    vec3 emitted = surface * granular * limb * uEmission;
    gl_FragColor = vec4(max(emitted, vec3(0.0)), 1.0);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const planetFragment = `
  uniform vec3 uColor, uBandColor, uLightDirection, uLightColor;
  uniform float uTime, uSeed, uIce;
  varying vec3 vSurface, vWorldNormal, vWorldPosition;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  ${noiseFunctions}
  void main() {
    vec3 p = normalize(vSurface);
    float weather = turbulence(p * 7.0 + vec3(uSeed, uTime * 0.008, 0.0));
    float fine = noise3(p * 43.0 + weather * 1.2 + uSeed);
    float latitude = p.y + (weather - 0.5) * mix(0.070, 0.020, uIce);
    float bands = sin(latitude * mix(55.0, 29.0, uIce) + uSeed);
    float narrowBands = sin(latitude * 143.0 + fine * 1.3) * 0.12;
    float cloudBelt = smoothstep(-0.50, 0.60, bands + narrowBands);
    vec3 surface = mix(uColor, uBandColor, cloudBelt * mix(0.82, 0.42, uIce));
    surface *= 0.90 + weather * 0.17 + fine * 0.12;

    float longitude = atan(p.z, abs(p.x) + abs(p.z) < 0.00001 ? 0.00001 : p.x);
    float stormLongitude = sin(longitude - uSeed * 0.73);
    float facingStorm = smoothstep(0.0, 0.35, cos(longitude - uSeed * 0.73));
    vec2 storm = vec2(stormLongitude * 6.0, (p.y + 0.23) * 15.0);
    float stormRadius = length(storm);
    float vortex = (1.0 - smoothstep(0.50, 1.0, stormRadius)) * facingStorm;
    float stormAngle = atan(storm.y,
      abs(storm.x) + abs(storm.y) < 0.00001 ? 0.00001 : storm.x);
    float spiral = 0.5 + 0.5 * sin(stormRadius * 23.0
      - stormAngle * 2.0 + weather * 4.0);
    vec3 stormColor = mix(uBandColor * 0.70, uColor * 1.20, spiral);
    surface = mix(surface, stormColor, vortex * mix(0.85, 0.48, uIce));

    vec3 n = normalize(vWorldNormal), viewDir = normalize(cameraPosition - vWorldPosition);
    float sunlight = dot(n, normalize(uLightDirection));
    float diffuse = max(sunlight, 0.0);
    vec3 illumination = vec3(0.012) + uLightColor * pow(diffuse, 0.82) * 1.28;
    float rim = pow(clamp(1.0 - dot(n, viewDir), 0.0, 1.0), 4.0);
    vec3 haze = mix(uColor, vec3(0.55, 0.76, 0.94), 0.45)
      * rim * smoothstep(-0.16, 0.45, sunlight) * 0.25;
    gl_FragColor = vec4(max(surface * illumination + haze, vec3(0.0)), 1.0);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

const atmosphereFragment = `
  uniform vec3 uColor, uLightDirection;
  uniform float uStrength, uStar, uTime;
  varying vec3 vSurface, vWorldNormal, vWorldPosition;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    vec3 n = normalize(vWorldNormal), v = normalize(cameraPosition - vWorldPosition);
    float rim = pow(clamp(1.0 - abs(dot(n, v)), 0.0, 1.0), 3.1);
    float sunward = smoothstep(-0.24, 0.62, dot(n, normalize(uLightDirection)));
    float light = mix(0.06 + sunward * 0.94, 1.0, uStar);
    float wisps = 0.9 + 0.1 * sin(vSurface.y * 31.0 + vSurface.x * 19.0 + uTime * 0.12);
    gl_FragColor = vec4(uColor * mix(1.1, 1.7, uStar),
      clamp(rim * uStrength * light * mix(1.0, wisps, uStar), 0.0, 1.0));
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

/** 类地行星表面（岩质 / 温带 / 冰封）——球形坐标生成，无经度接缝 */
const terrestrialFragment = `
  uniform vec3 uColor, uLightDirection, uLightColor;
  uniform float uTime, uSeed, uTerrain;
  varying vec3 vSurface, vWorldNormal, vWorldPosition;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  ${noiseFunctions}
  void main() {
    vec3 p = normalize(vSurface);
    vec3 offset = vec3(uSeed, uSeed * 0.37, -uSeed * 0.61);
    float continental = turbulence(p * 3.8 + offset);
    float relief = turbulence(p * 17.0 + offset + continental * 2.5);
    float grains = noise3(p * 94.0 + offset);
    float ridges = 1.0 - abs(noise3(p * 29.0 + offset) * 2.0 - 1.0);
    float land = smoothstep(0.47, 0.55, continental);
    float polar = smoothstep(0.67, 0.94, abs(p.y) + (relief - 0.5) * 0.27);
    float water = 0.0;
    vec3 surface;
    if (uTerrain < 1.5) {
      vec3 stone = mix(uColor * 0.34, uColor * 1.1 + vec3(0.1, 0.08, 0.06), relief);
      float basins = smoothstep(0.37, 0.54, continental);
      surface = stone * (0.61 + basins * 0.52) * (0.81 + grains * 0.26);
      surface *= 1.0 - pow(ridges, 14.0) * 0.16;
      surface = mix(surface, vec3(0.54, 0.57, 0.58), polar * 0.30);
    } else if (uTerrain < 2.5) {
      vec3 ocean = mix(uColor * 0.22, uColor * 0.78, smoothstep(0.30, 0.49, continental));
      vec3 rock = mix(vec3(0.12, 0.18, 0.15), vec3(0.51, 0.44, 0.31), relief);
      rock *= 0.83 + grains * 0.25;
      surface = mix(ocean, rock, land);
      surface = mix(surface, vec3(0.77, 0.84, 0.83), polar);
      water = (1.0 - land) * (1.0 - polar);
    } else {
      vec3 ice = mix(uColor * 0.46, vec3(0.81, 0.88, 0.88), relief * 0.7 + polar * 0.3);
      float fractures = pow(ridges, 19.0) * (0.45 + continental * 0.55);
      surface = ice * (0.84 + grains * 0.15) * (1.0 - fractures * 0.31);
      surface = mix(surface, uColor * 0.25, (1.0 - land) * 0.24);
    }

    vec3 cloudPoint = p * 6.5 + vec3(uTime * 0.007, 0.0, -uTime * 0.004) + offset;
    float cloudNoise = turbulence(cloudPoint + turbulence(cloudPoint * 0.7) * 1.8);
    float clouds = smoothstep(0.54, 0.73, cloudNoise) * (uTerrain < 1.5 ? 0.12 : 0.8);
    surface = mix(surface, vec3(0.85, 0.88, 0.87), clouds);
    vec3 n = normalize(vWorldNormal), light = normalize(uLightDirection);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float sunlight = dot(n, light), diffuse = max(sunlight, 0.0);
    vec3 illumination = vec3(0.012) + uLightColor * pow(diffuse, 0.82) * 1.28;
    float rim = pow(clamp(1.0 - dot(n, viewDir), 0.0, 1.0), 4.0);
    vec3 haze = mix(uColor, vec3(0.55, 0.76, 0.94), 0.58)
      * rim * smoothstep(-0.16, 0.45, sunlight) * (uTerrain < 1.5 ? 0.08 : 0.25);
    vec3 halfDirection = normalize(light + viewDir + vec3(0.00001));
    float glint = pow(max(dot(n, halfDirection), 0.0), 65.0) * water * (1.0 - clouds) * diffuse;
    gl_FragColor = vec4(max(surface * illumination + haze + uLightColor * glint * 0.30, vec3(0.0)), 1.0);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export interface SurfaceSpec {
  id: string
  kind: 'star' | 'planet'
  r: number
  color?: number
  /** 'red-star' | 'blue-star' | 'gold-star' | 'ice-giant' | 'gas-giant'
      | 'rocky-world' | 'temperate-world' | 'ice-world' */
  surfaceStyle?: string
}

/** 由 id 生成 0~1 的稳定种子 */
export function seedFromId(id: string): number {
  let value = 2166136261
  for (let i = 0; i < id.length; i++) value = Math.imul(value ^ id.charCodeAt(i), 16777619)
  return (value >>> 0) / 4294967296
}

/** 生成柔和圆形光晕贴图（恒星外晕，替代外部素材） */
export function haloTexture(): THREE.DataTexture {
  const width = 64
  const pixels = new Uint8Array(width * width * 4)
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const radius = Math.hypot(((x + 0.5) / width) * 2 - 1, ((y + 0.5) / width) * 2 - 1)
      const alpha = Math.exp(-radius * radius * 7.5) * (1 - THREE.MathUtils.smoothstep(radius, 0.72, 1))
      const index = (y * width + x) * 4
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 255
      pixels[index + 3] = Math.round(alpha * 255)
    }
  }
  const texture = new THREE.DataTexture(pixels, width, width)
  texture.magFilter = texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

/** 构建恒星 / 行星表面材质 */
export function createSurfaceMaterial(spec: SurfaceSpec, seed: number): THREE.ShaderMaterial {
  const star = spec.kind === 'star'
  const red = spec.surfaceStyle === 'red-star'
  const blue = spec.surfaceStyle === 'blue-star'
  const ice = spec.surfaceStyle === 'ice-giant'
  const terrain = ['rocky-world', 'temperate-world', 'ice-world'].indexOf(spec.surfaceStyle ?? '') + 1
  const color = new THREE.Color(spec.color ?? (star ? 0xffb36a : 0xc99f73))
  const uniforms: Record<string, THREE.IUniform> = {
    uColor: { value: color },
    uTime: { value: 0 },
    uSeed: { value: seed * 19.7 }
  }
  if (star) {
    Object.assign(uniforms, {
      uHotColor: { value: new THREE.Color(blue ? 0xe5f2ff : red ? 0xffc275 : 0xffe9b4) },
      uCells: { value: red ? 19 : blue ? 52 : 38 },
      uEmission: { value: blue ? 1.65 : red ? 2.0 : 2.15 }
    })
  } else {
    Object.assign(uniforms, {
      uBandColor: { value: color.clone().lerp(new THREE.Color(ice ? 0xd7f5f5 : 0x613b27), ice ? 0.48 : 0.54) },
      uLightDirection: { value: new THREE.Vector3(1, 0, 0) },
      uLightColor: { value: new THREE.Color(0xffffff) },
      uIce: { value: Number(ice) },
      uTerrain: { value: terrain }
    })
  }
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: surfaceVertex,
    fragmentShader: star ? starFragment : terrain ? terrestrialFragment : planetFragment
  })
}

/** 构建恒星光晕 / 行星大气罩材质 */
export function createAtmosphereMaterial(spec: SurfaceSpec, seed: number): THREE.ShaderMaterial {
  const star = spec.kind === 'star'
  const blueStar = star && spec.surfaceStyle === 'blue-star'
  void seed
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(spec.color ?? 0xffffff) },
      uStrength: { value: blueStar ? 0.32 : star ? 0.45 : 0.48 },
      uStar: { value: Number(star) },
      uTime: { value: 0 },
      uLightDirection: { value: new THREE.Vector3(1, 0, 0) }
    },
    vertexShader: surfaceVertex,
    fragmentShader: atmosphereFragment,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
}

/** 行星绕恒星公转的圆环线（可被缩放复用） */
export function orbitRingPoints(segments = 160): THREE.Vector3[] {
  return Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * TAU
    return new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
  })
}
