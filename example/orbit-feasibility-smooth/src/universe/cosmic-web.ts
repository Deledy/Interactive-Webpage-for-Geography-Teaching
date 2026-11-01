/* ============================================================
   universe/cosmic-web.ts
   “星系点阵”：离开银河系 / 河外星系后，远处星系逐渐变成彩色光点，
   相机后退时这些点慢慢向中心收拢，最后交给 CMB。

   与上一版（光条隧道）的差异：
   - 不再做径向光条，也不做高速滚动；就是 OpenSpace 那种柔和的圆点；
   - 点固定在世界坐标里，不跟随相机；后退感来自相机真实的透视变化；
   - 点尺寸用固定像素（约 1–4px），所以相机拉远时不会消失，而是变成
     "慢慢后退的小光点"；
   - 点数按画质档位用 drawRange 控制（1200–5000），单次 draw call。
   ============================================================ */
import * as THREE from 'three'
import { makeRandom, gaussianFrom, TAU } from '../core/math'

const FIELD_RADIUS = 3_800_000
const MAX_POINTS = 8_000

const vertexShader = `
attribute float aSize;
attribute vec3 aColor;
varying vec3 vColor;
uniform float uRatio;
uniform float uMinSize;
uniform float uMaxSize;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // 固定像素尺寸：远处的星系也保持为一个可见的小光点
  gl_PointSize = clamp(aSize * uRatio, uMinSize, uMaxSize);
  #include <logdepthbuf_vertex>
}`

const fragmentShader = `
varying vec3 vColor;
uniform float uOpacity;
#include <common>
#include <logdepthbuf_pars_fragment>
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = pow(1.0 - d, 2.0);
  gl_FragColor = vec4(vColor, uOpacity * a);
  #include <logdepthbuf_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export interface CosmicWeb {
  setPixels: (pixels: number) => void
  setBudget: (count: number, maxPointSize: number) => void
  update: (opacity: number) => void
  reset: () => void
  dispose: () => void
}

interface FieldData {
  positions: Float32Array
  colors: Float32Array
  sizes: Float32Array
  count: number
}

function buildField(count: number): FieldData {
  const rand = makeRandom('deep-galaxy-field-v2')
  const positions: number[] = []
  const colors: number[] = []
  const sizes: number[] = []

  const cool = new THREE.Color(0x86c6ff)
  const warm = new THREE.Color(0xffc27a)
  const pale = new THREE.Color(0xfff0d8)
  const dim = new THREE.Color(0x4f7fa8)

  const push = (x: number, y: number, z: number, color: THREE.Color, size: number): void => {
    positions.push(x, y, z)
    colors.push(color.r, color.g, color.b)
    sizes.push(size)
  }

  for (let i = 0; i < count; i++) {
    // 按里程碑分壳层：每个阶段都有自己的一团光点，避免"银河系外一片空白"。
    const choice = rand()
    let shell: 'local' | 'virgo' | 'laniakea' | 'web' | 'field'
    let r: number
    if (choice < 0.22) {
      shell = 'local'
      r = 2.2e5 + rand() * 1.6e5
    } else if (choice < 0.42) {
      shell = 'virgo'
      r = 6.0e5 + rand() * 3.0e5
    } else if (choice < 0.62) {
      shell = 'laniakea'
      r = 1.6e6 + rand() * 8.0e5
    } else if (choice < 0.78) {
      shell = 'web'
      r = 2.8e6 + rand() * 1.0e6
    } else {
      shell = 'field'
      r = FIELD_RADIUS * Math.cbrt(rand())
    }

    const theta = rand() * TAU
    const phi = Math.acos(2 * rand() - 1)
    let x = r * Math.sin(phi) * Math.cos(theta)
    let z = r * Math.sin(phi) * Math.sin(theta)
    let y = r * Math.cos(phi) * 0.72

    // 壳层里再拉出一些团块，视觉上像星系团/超星系团，而不是均匀圆环
    if (shell !== 'field' && rand() < 0.45) {
      const clump = Math.floor(rand() * 12)
      const angle = (clump / 12) * TAU + 0.2
      const clumpRadius = r * (0.92 + rand() * 0.16)
      const spread = r * (0.02 + rand() * 0.035)
      x = Math.cos(angle) * clumpRadius + gaussianFrom(rand) * spread
      z = Math.sin(angle) * clumpRadius + gaussianFrom(rand) * spread
      y = gaussianFrom(rand) * spread * 0.6
    }

    let color: THREE.Color
    if (shell === 'local') color = warm.clone().lerp(pale, rand() * 0.7)
    else if (shell === 'virgo') {
      color = pale.clone().lerp(warm, rand() * 0.4).lerp(cool, 0.15 + rand() * 0.25)
    } else if (shell === 'laniakea') color = cool.clone().lerp(warm, rand() * 0.35)
    else color = cool.clone().multiplyScalar(0.55 + rand() * 0.45)
    if (rand() < 0.1) color.lerp(dim, 0.55)

    let size: number
    if (shell === 'local') size = 1.4 + rand() * 2.0
    else if (shell === 'virgo') size = 1.2 + rand() * 1.8
    else if (shell === 'laniakea') size = 1.1 + rand() * 1.6
    else size = 0.9 + rand() * 1.4
    if (rand() < 0.04) size += 1.8

    push(x, y, z, color, size)
  }

  // 低画质档 drawRange 只画前 N 个：优先保留大一点的光点
  const total = positions.length / 3
  const order = Array.from({ length: total }, (_, i) => i)
  order.sort((a, b) => sizes[b] - sizes[a])

  const outPositions = new Float32Array(total * 3)
  const outColors = new Float32Array(total * 3)
  const outSizes = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    const source = order[i]
    outPositions[i * 3] = positions[source * 3]
    outPositions[i * 3 + 1] = positions[source * 3 + 1]
    outPositions[i * 3 + 2] = positions[source * 3 + 2]
    outColors[i * 3] = colors[source * 3]
    outColors[i * 3 + 1] = colors[source * 3 + 1]
    outColors[i * 3 + 2] = colors[source * 3 + 2]
    outSizes[i] = sizes[source]
  }

  return { positions: outPositions, colors: outColors, sizes: outSizes, count: total }
}

export function createCosmicWeb(
  scene: THREE.Scene,
  center: THREE.Vector3,
  pixels: number,
  budget: number,
  maxPointSize: number
): CosmicWeb {
  const group = new THREE.Group()
  group.name = 'deep-galaxy-field'
  group.position.copy(center)
  group.visible = false
  scene.add(group)

  const data = buildField(MAX_POINTS)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geometry.setAttribute('aColor', new THREE.BufferAttribute(data.colors, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(data.sizes, 1))
  geometry.setDrawRange(0, Math.min(budget, data.count))
  geometry.computeBoundingSphere()

  const uniforms = {
    uOpacity: { value: 0 },
    uRatio: { value: pixels },
    uMinSize: { value: 1.2 },
    uMaxSize: { value: maxPointSize }
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  group.add(points)

  function setPixels(next: number): void {
    uniforms.uRatio.value = next
  }

  function setBudget(count: number, size: number): void {
    geometry.setDrawRange(0, Math.max(0, Math.min(count, data.count)))
    uniforms.uMaxSize.value = size
  }

  function update(opacity: number): void {
    group.visible = opacity > 0.001
    uniforms.uOpacity.value = opacity
  }

  function reset(): void {
    group.visible = false
    uniforms.uOpacity.value = 0
  }

  function dispose(): void {
    group.removeFromParent()
    geometry.dispose()
    material.dispose()
  }

  return { setPixels, setBudget, update, reset, dispose }
}
