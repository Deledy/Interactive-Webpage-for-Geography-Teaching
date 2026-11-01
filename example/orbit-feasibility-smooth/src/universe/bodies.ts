/* ============================================================
   universe/bodies.ts
   移植自 ORBIT 项目 src/universe/planets.js 与 src/universe/solar-system.js
   （Apache-2.0）。
   已修改：合并为 TypeScript；剥离地球昼夜着色器 / 大气层 / 人造卫星等本轮不需要
   的分支，仅保留"太阳 + 八大行星 + 月球 + 轨道线 + 土星环 + 公转更新"；
   并改为挂载到外部传入的 root 组（便于站 4 演示"太阳系整体绕银心"时平移整组）。
   原始项目：https://github.com/ryh842487118-bot/orbit

   贴图复用本项目 lessons/geo01-earth-universe/src/assets/textures/（登记见该课
   docs/06_资源引用.md），未新增任何外部来源素材；月球贴图为程序化生成。
   ============================================================ */
import * as THREE from 'three'
import { BODIES, MOON_ORBIT, type BodyDatum } from './data'
import { TAU, random } from '../core/math'
import { makeOrbit } from './orbits'
import { glow } from '../core/glow'
import { observedTexture } from './moon-textures'

import sunTex from '../../assets/textures/sun.jpg'
import mercuryTex from '../../assets/textures/mercury.jpg'
import venusTex from '../../assets/textures/venus.jpg'
import earthTex from '../../assets/textures/earth.jpg'
import marsTex from '../../assets/textures/mars.jpg'
import jupiterTex from '../../assets/textures/jupiter.jpg'
import saturnTex from '../../assets/textures/saturn.jpg'
import uranusTex from '../../assets/textures/uranus.jpg'
import neptuneTex from '../../assets/textures/neptune.jpg'
import saturnRingTex from '../../assets/textures/saturn_ring.png'

export interface Body {
  id: string
  datum: BodyDatum
  r: number
  group: THREE.Group
  mesh: THREE.Mesh
  position: THREE.Vector3
}

export type TextureMap = Record<string, THREE.Texture>

const TEXTURE_URLS: Record<string, string> = {
  sun: sunTex,
  mercury: mercuryTex,
  venus: venusTex,
  earth: earthTex,
  mars: marsTex,
  jupiter: jupiterTex,
  saturn: saturnTex,
  uranus: uranusTex,
  neptune: neptuneTex,
  'saturn-rings': saturnRingTex
}

/**
 * 月球材质：优先使用 assets/textures/moons/moon.* 的真实观测底图；
 * 未就位时按实测几何反照率（0.12）给纯色，**不生成任何程序化地表纹理**。
 */
function createMoonMaterial(): THREE.MeshPhongMaterial {
  const map = observedTexture('moon')
  if (map) return new THREE.MeshPhongMaterial({ map, shininess: 6, specular: 0x111111 })
  return new THREE.MeshPhongMaterial({ color: 0x9c9a95, shininess: 2, specular: 0x050505 })
}

export async function loadTextures(): Promise<TextureMap> {
  const loader = new THREE.TextureLoader()
  const entries = await Promise.all(
    Object.entries(TEXTURE_URLS).map(async ([key, url]) => {
      const t = await loader.loadAsync(url)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      return [key, t] as const
    })
  )
  return Object.fromEntries(entries)
}

export interface SolarSystem {
  bodies: Map<string, Body>
  earth: Body
  sun: Body
  moon: Body
  jupiter: Body
  saturn: Body
  orbitGroup: THREE.Group
  moonOrbitGroup: THREE.Group
  /** 每帧更新公转与自转 */
  update: (dt: number, state: { paused: boolean; speed: number }) => void
}

export function createSolarSystem(scene: THREE.Scene, root: THREE.Group, textures: TextureMap): SolarSystem {
  const bodies = new Map<string, Body>()
  const unitSphere = new THREE.SphereGeometry(1, 96, 64)
  const orbitGroup = new THREE.Group()
  const moonOrbitGroup = new THREE.Group()
  root.add(orbitGroup, moonOrbitGroup)

  // 光照：环境光 + 太阳位置的点光源（decay=0 → 不随距离衰减，保证远日行星也被照亮）
  scene.add(new THREE.AmbientLight(0x334466, 1.35))
  const sunLight = new THREE.PointLight(0xfff2dd, 3.2, 0, 0)

  let earth!: Body
  let sun!: Body
  let moon!: Body
  let jupiter!: Body
  let saturn!: Body

  for (const d of BODIES) {
    const group = new THREE.Group()
    root.add(group)

    // 自转轴倾角：把球体与光环放进倾斜组，位置仍由外层 group 控制，
    // 这样"行星躺着自转"不会把公转轨道位置一起带歪。
    const tiltGroup = new THREE.Group()
    tiltGroup.rotation.z = THREE.MathUtils.degToRad(d.axialTilt ?? 0)
    group.add(tiltGroup)

    const mat =
      d.id === 'sun'
        ? new THREE.MeshBasicMaterial({ map: textures.sun, color: 0xffffff })
        : d.id === 'moon'
          ? createMoonMaterial()
          : new THREE.MeshPhongMaterial({
              map: textures[d.texture],
              shininess: d.id === 'earth' ? 12 : 6,
              specular: 0x111111
            })

    const mesh = new THREE.Mesh(unitSphere, mat)
    mesh.scale.setScalar(d.r)
    mesh.rotation.y = d.id === 'earth' ? 2.9 : random() * TAU
    // 供鼠标点击拾取（参见 main.ts 的拾取逻辑）
    mesh.userData.bodyId = d.id
    tiltGroup.add(mesh)

    const body: Body = { id: d.id, datum: d, r: d.r, group, mesh, position: group.position }
    bodies.set(d.id, body)

    // 行星轨道线（太阳与月球不画在系统轨道组里）
    if (d.orbit > 0 && d.id !== 'moon') {
      const ring = makeOrbit(d.orbit, d.color, d.id === 'earth' ? 0.33 : 0.2, d.id === 'mercury' ? 0.075 : 0.015)
      ring.userData.baseOpacity = ring.material.opacity
      orbitGroup.add(ring)
    }

    if (d.id === 'sun') {
      sun = body
      group.add(sunLight) // 光源随太阳（也就是随太阳系整组）移动
      group.add(glow(16756290, 43, 0.45))
      group.add(glow(16765840, 24, 0.55))
    }

    // 土星环：按半径重算 UV，使环纹理沿半径方向铺展
    if (d.id === 'saturn') {
      const ringGeo = new THREE.RingGeometry(d.r * 1.22, d.r * 2.3, 180, 1)
      const uv = ringGeo.attributes.uv
      const p = ringGeo.attributes.position
      for (let i = 0; i < p.count; i++) {
        const rad = Math.hypot(p.getX(i), p.getY(i))
        uv.setXY(i, (rad - d.r * 1.22) / (d.r * 1.08), 0.5)
      }
      uv.needsUpdate = true
      const ringMat = new THREE.MeshPhongMaterial({
        map: textures['saturn-rings'],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.97,
        depthWrite: false,
        shininess: 0
      })
      const rings = new THREE.Mesh(ringGeo, ringMat)
      rings.rotation.x = -Math.PI / 2
      // 光环与赤道面共面：直接放进倾斜组，不再单独设倾角
      tiltGroup.add(rings)
      saturn = body
    }

    if (d.id === 'earth') earth = body
    if (d.id === 'moon') moon = body
    if (d.id === 'jupiter') jupiter = body
  }

  // 月球轨道线（挂在绕地组上，随地球平移）
  const moonOrbit = makeOrbit(MOON_ORBIT, 0x9fb0c4, 0.21, 0.07)
  // world 会按距离/飞行进度改写透明度，先记下基准值，避免逐帧相乘后衰减
  moonOrbit.userData.baseOpacity = moonOrbit.material.opacity
  moonOrbitGroup.add(moonOrbit)

  let simTime = 0
  const temp = new THREE.Vector3()

  function update(dt: number, state: { paused: boolean; speed: number }): void {
    if (!state.paused) simTime += dt * state.speed

    for (const b of bodies.values()) {
      if (b.id === 'moon' || b.id === 'sun') continue
      const d = b.datum
      if (d.orbit > 0) {
        const a = d.phase + ((simTime * TAU) / d.period) * 0.55
        const inclination = d.id === 'mercury' ? 0.075 : 0.015
        b.position.set(
          Math.cos(a) * d.orbit,
          Math.sin(a) * d.orbit * Math.sin(inclination),
          Math.sin(a) * d.orbit * Math.cos(inclination)
        )
      }
      if (!state.paused) b.mesh.rotation.y += dt * state.speed * 0.03
    }

    // 月球绕地球
    const ma = moon.datum.phase + simTime * 0.12
    moon.position.copy(earth.position).add(
      temp.set(Math.cos(ma) * MOON_ORBIT, Math.sin(ma) * MOON_ORBIT * Math.sin(0.07), Math.sin(ma) * MOON_ORBIT * Math.cos(0.07))
    )
    moonOrbitGroup.position.copy(earth.position)
    if (!state.paused) moon.mesh.rotation.y += dt * state.speed * 0.02
    if (!state.paused) sun.mesh.rotation.y += dt * state.speed * 0.015
  }

  return { bodies, earth, sun, moon, jupiter, saturn, orbitGroup, moonOrbitGroup, update }
}
