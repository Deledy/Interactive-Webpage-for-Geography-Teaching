/* ============================================================
   universe/moon-systems.ts
   有卫星行星的局部卫星系统（火星 / 木星 / 土星 / 天王星 / 海王星）。

   与旧版的差异（对应《有卫星行星系统》方案）：
   1) 从"木星 + 土星"扩展到"所有有天然卫星的行星"（地球的月球由太阳系层承载，
      不在本模块重复建模，避免同一颗月球出现两次）；
   2) 贴图只来自 assets/textures/moons/ 的真实观测底图；取不到时退化为
      实测反照率纯色材质（C 级策略），**彻底删除程序化岩石纹理**；
   3) 尺寸与轨道由 satellite-data 的真实参数推导：同系统内保持真实半径比，
      轨道按幂函数压缩，土星系额外加锚点保证卫星落在可视光环之外；
   4) 轨道面与行星赤道面对齐（系统根节点整体倾斜），倾角 >90° 的卫星自动逆行；
   5) 主清单卫星全部潮汐锁定，自转与公转同步。

   局部坐标系说明（沿用旧版结论）：卫星轨道半径 / 行星半径的真实比值约 3~60，
   与"日地距离"完全不是一个量级，因此每个行星系统各建一个以行星为原点的
   独立局部坐标系，仅在进入该系统时可见。
   ============================================================ */
import * as THREE from 'three'
import { TAU } from '../core/math'
import { makeOrbit } from './orbits'
import { BODIES } from './data'
import { observedTexture } from './moon-textures'
import {
  MOON_DATUM,
  SATELLITE_SYSTEMS,
  type SatelliteDatum,
  type SatelliteParent,
  type SatelliteSystemDef
} from './satellite-data'

export { MOON_DATUM, SATELLITE_SYSTEMS, type SatelliteDatum as MoonDatum }

export interface MoonBody {
  datum: SatelliteDatum
  group: THREE.Group
  mesh: THREE.Mesh
  /** 局部坐标（相对所属行星） */
  position: THREE.Vector3
}

export interface MoonSystem {
  /** 'mars-moons' | 'jupiter-moons' | ... */
  id: string
  cn: string
  /** 承载卫星的组，已挂到对应行星组下 */
  root: THREE.Group
  parentId: SatelliteParent
  definition: SatelliteSystemDef
  moons: MoonBody[]
  /** 系统外缘半径（用于落地取景） */
  extent: number
  visible: boolean
}

export interface MoonSystems {
  systems: MoonSystem[]
  byId: Map<string, MoonSystem>
  moons: Map<string, MoonBody>
  update: (dt: number, state: { paused: boolean; speed: number }) => void
  setVisibility: (visibleIds: Set<string> | null) => void
  /** 按权重淡入淡出（0 = 隐藏，1 = 完整），用于跨层/飞行过渡 */
  setOpacity: (weights: Map<string, number>) => void
}

/** 行星自转轴倾角（度），卫星轨道面随之倾斜到赤道面 */
function axialTiltOf(parent: SatelliteParent): number {
  return BODIES.find((body) => body.id === parent)?.axialTilt ?? 0
}

/**
 * 卫星材质：有观测贴图就用贴图；没有则用实测反照率纯色。
 * 绝不能回退到程序化纹理 —— 这是本模块的硬约束。
 */
function createMoonMaterial(datum: SatelliteDatum): THREE.MeshPhongMaterial {
  if (datum.texture) {
    const map = observedTexture(datum.texture)
    if (map) {
      return new THREE.MeshPhongMaterial({ map, shininess: 6, specular: 0x111111 })
    }
  }
  return new THREE.MeshPhongMaterial({
    color: datum.color,
    shininess: 2,
    specular: 0x050505
  })
}

export function createMoonSystems(
  solar: { bodies: Map<string, { group: THREE.Object3D; r: number }> }
): MoonSystems {
  const systems: MoonSystem[] = []
  const byId = new Map<string, MoonSystem>()
  const moons = new Map<string, MoonBody>()
  const sphere = new THREE.SphereGeometry(1, 48, 32)

  for (const definition of SATELLITE_SYSTEMS) {
    const host = solar.bodies.get(definition.parent)
    if (!host) continue

    const root = new THREE.Group()
    root.name = definition.id
    // 轨道面 = 行星赤道面（天王星 97.8° 的"躺着"姿态因此自动生效）
    root.rotation.z = THREE.MathUtils.degToRad(axialTiltOf(definition.parent))
    root.visible = false
    host.group.add(root)

    const list = MOON_DATUM.filter((moon) => moon.systemId === definition.id)
    const moonBodies: MoonBody[] = []
    let extent = 0

    for (const datum of list) {
      const group = new THREE.Group()
      root.add(group)

      const mesh = new THREE.Mesh(sphere, createMoonMaterial(datum))
      mesh.scale.setScalar(datum.r)
      mesh.rotation.y = datum.phase // 供鼠标点击拾取
      mesh.userData.bodyId = datum.id
      group.add(mesh)

      // 轨道倾角与真实值一致：>90° 时自动表现为逆行
      const ring = makeOrbit(datum.orbit, datum.color, 0.2, THREE.MathUtils.degToRad(datum.inclinationDeg))
      ring.userData.baseOpacity = ring.material.opacity
      root.add(ring)

      moonBodies.push({ datum, group, mesh, position: group.position })
      moons.set(datum.id, moonBodies[moonBodies.length - 1])
      extent = Math.max(extent, datum.orbit)
    }

    const system: MoonSystem = {
      id: definition.id,
      cn: definition.cn,
      root,
      parentId: definition.parent,
      definition,
      moons: moonBodies,
      extent,
      visible: false
    }
    systems.push(system)
    byId.set(system.id, system)
  }

  let simTime = 0

  function update(dt: number, state: { paused: boolean; speed: number }): void {
    if (!state.paused) simTime += dt * state.speed
    for (const system of systems) {
      if (!system.visible) continue
      for (const moon of system.moons) {
        const { datum } = moon
        const tilt = THREE.MathUtils.degToRad(datum.inclinationDeg)
        const angle = datum.phase + (simTime * TAU) / datum.period
        moon.position.set(
          Math.cos(angle) * datum.orbit,
          Math.sin(angle) * datum.orbit * Math.sin(tilt),
          Math.sin(angle) * datum.orbit * Math.cos(tilt)
        )
        // 潮汐锁定：自转角速度与公转角速度相同，始终以同一面朝向行星
        if (!state.paused) moon.mesh.rotation.y = datum.phase - angle
      }
    }
  }

  /* ---------------- 连续淡入淡出 ----------------
     卫星系统原来是"进系统才显示、离开立刻隐藏"的硬开关。这里把每个系统的
     材质透明度按权重缩放，权重由 world 根据焦点与飞行进度给出，于是进入/离开
     木星系时不再整批闪烁。 */
  const baseOpacity = new WeakMap<THREE.Material, number>()

  function applyOpacity(root: THREE.Object3D, opacity: number): void {
    const visible = opacity > 0.004
    root.visible = visible
    if (!visible) return
    root.traverse((object) => {
      const holder = object as unknown as { material?: THREE.Material | THREE.Material[] }
      const material = holder.material
      if (!material) return
      const list = Array.isArray(material) ? material : [material]
      for (const item of list) {
        if (!baseOpacity.has(item)) {
          const current = (item as THREE.Material & { opacity?: number }).opacity
          baseOpacity.set(item, typeof current === 'number' ? current : 1)
        }
        const target = item as THREE.Material & { opacity: number; transparent: boolean }
        target.transparent = true
        target.opacity = (baseOpacity.get(item) ?? 1) * opacity
      }
    })
  }

  function setOpacity(weights: Map<string, number>): void {
    for (const system of systems) {
      const next = Math.min(1, Math.max(0, weights.get(system.id) ?? 0))
      system.visible = next > 0.004
      applyOpacity(system.root, next)
    }
  }

  function setVisibility(visibleIds: Set<string> | null): void {
    const weights = new Map<string, number>()
    for (const system of systems) weights.set(system.id, visibleIds?.has(system.id) ? 1 : 0)
    setOpacity(weights)
  }

  return { systems, byId, moons, update, setVisibility, setOpacity }
}
