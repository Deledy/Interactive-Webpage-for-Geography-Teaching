/* ============================================================
   universe/world.ts
   场景总装：把太阳系 / 木星系·土星系 / 其他恒星行星系 / 银河系 / 河外星系
   组装进同一场景，并提供"坐标 + 落地参数 + 所属层级 + 分层可见性"的统一接口。

   编排方式参考 ORBIT 项目 src/core/scene.js（Apache-2.0），已按本项目教学口径重写。
   原始项目：https://github.com/ryh842487118-bot/orbit

   v1.1 关键变化（对应开发文档 K2）：
   银河系不再"让太阳系自己绕银心画圆"，而是**银河盘整体缓慢自转、太阳随盘被带走**：
   - 银河点云挂在一个"银盘组"（galaxyDisk）里，盘面倾角由该组持有；
   - 自转只需累加 galaxyDisk.rotation.y；
   - 太阳的世界坐标 = 银心 + 盘的四元数 × 盘内局部向量（方位角固定、半径 = 太阳的银心距离），
     于是太阳被盘"带着走"，且始终落在盘面内；
   - 自转只在「银河系 / 河外星系」层级推进，离开即冻结 —— 这样地月系（视距 7.8）与
     太阳系（视距 650）的视距下画面完全静止，从根上消除"整组天体每秒掠过上百个画面"的抖动。
   ============================================================ */
import * as THREE from 'three'
import { createSolarSystem, loadTextures, type SolarSystem } from './bodies'
import { createMoonSystems, type MoonSystems } from './moon-systems'
import { createStarSystems, HOST_STARS, EXOPLANETS, type StarSystems } from './star-systems'
import { createGalaxyAtlas, GALAXIES, type GalaxyAtlas } from './galaxies'
import { createBackgroundStars, createGalaxy, type Galaxy } from './galaxy'
import { infoOf, type DestinationInfo } from './catalog'
import { clamp, mobile, smooth, TAU } from '../core/math'
import type { Landing, NavTarget } from '../core/camera'

/** 银河系中心（场景单位） */
export const GALAXY_CENTER = new THREE.Vector3(-13500, 0, -6800)
/** 银盘盘面倾角（与 ORBIT 一致，仅为了让盘面在画面里略侧视） */
const DISK_TILT = 0.13
/** 太阳到银心的距离（示意）：取银盘可见半径（约 3 万）的一半，
    与真实比值接近（太阳距银心约 2.6 万光年 / 银盘半径约 5 万光年） */
export const SUN_GALACTIC_RADIUS = 15000
/** 银盘自转一周的演示时长（真实约 2.3 亿年，此处仅示意） */
const GALAXY_SPIN_PERIOD = 150

/** 站 3「其他恒星行星系」的观察中心（取各宿主星坐标的平均） */
const STAR_FIELD_CENTER = (() => {
  const c = new THREE.Vector3()
  for (const star of HOST_STARS) c.add(new THREE.Vector3().fromArray(star.position))
  return c.divideScalar(HOST_STARS.length || 1)
})()

/** 站 5「河外星系图鉴」的观察中心（银河系 + 13 座河外星系的平均） */
const ATLAS_CENTER = (() => {
  const c = new THREE.Vector3().copy(GALAXY_CENTER)
  for (const galaxy of GALAXIES) c.add(new THREE.Vector3().fromArray(galaxy.position))
  return c.divideScalar(GALAXIES.length + 1)
})()

export interface WorldState {
  paused: boolean
  speed: number
  orbitsVisible: boolean
  /** 当前层级：由相机距离反推（见 core/camera.ts），决定哪些层播放/可见 */
  stage: string
}

export interface World {
  solarRoot: THREE.Group
  solar: SolarSystem
  moonSystems: MoonSystems
  starSystems: StarSystems
  galaxyDisk: THREE.Group
  galaxy: Galaxy
  galaxyAtlas: GalaxyAtlas
  backgroundStars: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  starFields: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>[]
  galaxyCenter: THREE.Vector3
  /** 导航接口 */
  getPosition: (id: string, out?: THREE.Vector3) => THREE.Vector3
  getRadius: (id: string) => number
  getTarget: (id: string) => NavTarget | undefined
  isSolarBody: (id: string) => boolean
  getData: (id: string) => DestinationInfo | undefined
  /** 每帧推进模拟 */
  update: (dt: number, state: WorldState) => void
  /** 每帧更新分层可见性（distance 为相机到视点的距离） */
  updateVisibility: (
    camera: THREE.PerspectiveCamera,
    distance: number,
    targetId: string,
    stage: string,
    state: WorldState
  ) => void
}

export async function createWorld(scene: THREE.Scene, pixels: number): Promise<World> {
  const textures = await loadTextures()
  const solarRoot = new THREE.Group()
  solarRoot.name = 'solar-root'
  scene.add(solarRoot)

  const solar = createSolarSystem(scene, solarRoot, textures)
  const moonSystems = createMoonSystems(solar)
  const starSystems = createStarSystems(scene)
  const backgroundStars = createBackgroundStars(pixels)
  scene.add(backgroundStars)

  // ---------------- 银盘组：承载银河点云与太阳的银心轨道圆 ----------------
  const galaxyDisk = new THREE.Group()
  galaxyDisk.name = 'galaxy-disk'
  galaxyDisk.position.copy(GALAXY_CENTER)
  galaxyDisk.rotation.x = DISK_TILT
  scene.add(galaxyDisk)
  const galaxy = createGalaxy(scene, galaxyDisk, pixels)

  // 注：此处不再绘制"太阳绕银心的轨道圆"。该圆心是以银河盘整体自转（太阳随盘被带走）为
  // 模型画的，画成一条闭合圆环会让人误以为太阳/地球沿一条看得见的轨道绕银心运行 —— 与
  // 真实银河系（较差自转 + 旋臂为密度波）不符，故删除。

  const galaxyAtlas = createGalaxyAtlas(scene, pixels)

  let galaxySpin = 0
  const sunLocal = new THREE.Vector3(SUN_GALACTIC_RADIUS, 0, 0)

  const moonIdsOf = new Map<string, Set<string>>()
  for (const system of moonSystems.systems) {
    moonIdsOf.set(system.id, new Set(system.moons.map((m) => m.datum.id)))
  }

  /* ---------------- 坐标解析 ---------------- */
  function getPosition(id: string, out = new THREE.Vector3()): THREE.Vector3 {
    if (id === 'galaxy') return out.copy(GALAXY_CENTER)
    if (id === 'galaxies') return out.copy(ATLAS_CENTER)
    if (id === 'solar') return out.copy(solarRoot.position)
    if (id === 'stars') return out.copy(starSystems.root.position).add(STAR_FIELD_CENTER)
    const system = moonSystems.byId.get(id)
    if (system) {
      const host = solar.bodies.get(system.parentId)
      return out.copy(solarRoot.position).add(host ? host.position : new THREE.Vector3())
    }
    const moon = moonSystems.moons.get(id)
    if (moon) {
      const host = solar.bodies.get(moon.datum.parent)
      out.copy(solarRoot.position)
      if (host) out.add(host.position)
      return out.add(moon.position)
    }
    const body = solar.bodies.get(id)
    if (body) return out.copy(solarRoot.position).add(body.position)
    const star = starSystems.bodies.get(id)
    if (star) return out.copy(starSystems.root.position).add(star.position)
    const entry = galaxyAtlas.galaxies.get(id)
    if (entry) return out.copy(entry.group.position)
    return out.set(0, 0, 0)
  }

  function getRadius(id: string): number {
    if (id === 'galaxy') return 30000
    if (id === 'solar') return 260
    if (id === 'stars') return 12000
    if (id === 'galaxies') return 400000
    const system = moonSystems.byId.get(id)
    if (system) return system.extent
    const moon = moonSystems.moons.get(id)
    if (moon) return moon.datum.r
    const body = solar.bodies.get(id)
    if (body) return body.r
    const star = starSystems.bodies.get(id)
    if (star) return star.r
    const entry = galaxyAtlas.galaxies.get(id)
    if (entry) return entry.definition.radius
    return 1
  }

  /* ---------------- 落地参数（非等比示意） ---------------- */
  function getLanding(id: string): Landing {
    const direction = new THREE.Vector3()
    const screenFit = mobile() ? 1.19 : 1

    if (id === 'solar') return { distance: 650, direction: direction.set(0.18, 1.15, 1.45).normalize() }
    if (id === 'galaxy') return { distance: 68000, direction: direction.set(0.14, 1.2, 1.55).normalize() }
    if (id === 'galaxies') return { distance: 1000000, direction: direction.set(0.35, 0.72, 1.0).normalize() }
    if (id === 'stars') return { distance: 17000, direction: direction.set(0.22, 0.6, 1.0).normalize() }

    const system = moonSystems.byId.get(id)
    if (system) return { distance: system.extent * 2.8, direction: direction.set(0.32, 0.5, 1.0).normalize() }

    const moon = moonSystems.moons.get(id)
    if (moon) return { distance: moon.datum.r * 7, direction: direction.set(0.3, 0.5, 1.1).normalize() }

    // 地月系：落脚距离要同时容下地球与月球轨道（月球轨道 3.9 单位）
    if (id === 'earth') {
      const distance = Math.max(getRadius('earth') * 4.65, 7.8) * screenFit
      return { distance, direction: direction.set(2.1, 0.95, 3.8).normalize() }
    }
    if (id === 'sun') {
      const radius = getRadius('sun')
      const fit = (radius * 1.6) / Math.tan(THREE.MathUtils.degToRad(43 / 2))
      return { distance: Math.max(radius * 5.5, fit), direction: direction.set(0.35, 0.75, 1.4).normalize() }
    }

    const star = starSystems.bodies.get(id)
    if (star) {
      if (star.kind === 'star') {
        const orbit = starSystems.maxOrbitOf(id)
        return { distance: orbit * 2.4 + star.r * 4, direction: direction.set(0.22, 0.5, 1.0).normalize() }
      }
      return { distance: star.r * 7, direction: direction.set(0.3, 0.55, 1.0).normalize() }
    }

    const entry = galaxyAtlas.galaxies.get(id)
    if (entry) return { distance: entry.definition.viewDistance, direction: direction.set(0.25, 0.6, 1.0).normalize() }

    return { distance: getRadius(id) * 4.65 * screenFit, direction: direction.set(0.3, 0.48, 1.15).normalize() }
  }

  /* ---------------- 目标元信息：焦点 / 所属恒星系统 / 所属星系 ---------------- */
  const STAR_HOST_IDS = new Set(HOST_STARS.map((s) => s.id))
  const EXOPLANET_HOST = new Map(EXOPLANETS.map((p) => [p.id, p.parentStarId]))

  function getTarget(id: string): NavTarget | undefined {
    const landing = getLanding(id)

    if (id === 'galaxies') return { focus: 'galaxies', system: 'solar', galaxy: 'galaxies', kind: 'atlas', landing }
    if (id === 'galaxy') return { focus: 'galaxy', system: 'solar', galaxy: 'galaxy', kind: 'galaxy', landing }
    if (galaxyAtlas.galaxies.has(id)) return { focus: id, system: 'solar', galaxy: id, kind: 'galaxy', landing }
    if (id === 'solar' || id === 'stars') return { focus: id, system: 'solar', galaxy: 'galaxy', kind: 'system', landing }

    if (STAR_HOST_IDS.has(id)) return { focus: id, system: id, galaxy: 'galaxy', kind: 'star-system', landing }
    const host = EXOPLANET_HOST.get(id)
    if (host) return { focus: id, system: host, galaxy: 'galaxy', kind: 'body', landing }

    if (solar.bodies.has(id) || moonSystems.moons.has(id) || moonSystems.byId.has(id)) {
      return { focus: id, system: 'solar', galaxy: 'galaxy', kind: 'body', landing }
    }
    return undefined
  }

  function isSolarBody(id: string): boolean {
    return solar.bodies.has(id) || moonSystems.moons.has(id) || moonSystems.byId.has(id)
  }

  /* ---------------- 每帧更新 ---------------- */
  function update(dt: number, state: WorldState): void {
    const step = state.paused ? 0 : dt * state.speed
    solar.update(dt, state)
    moonSystems.update(dt, state)
    starSystems.update(dt, state)

    // 银河盘自转只在「银河系 / 河外星系」层级推进；其余层级冻结 →
    // 太阳系世界坐标保持不变，地月系 / 太阳系视距下没有额外位移与抖动。
    if (state.stage === 'galaxy' || state.stage === 'galaxies') {
      galaxySpin += step * (TAU / GALAXY_SPIN_PERIOD)
    }
    galaxyDisk.rotation.y = galaxySpin

    // 太阳随盘被带走：盘内局部坐标固定（方位角 0、半径 SUN_GALACTIC_RADIUS），
    // 世界坐标 = 银心 + 盘的四元数 × 局部向量（含倾角与自转）。
    sunLocal.set(SUN_GALACTIC_RADIUS, 0, 0).applyQuaternion(galaxyDisk.quaternion)
    solarRoot.position.copy(GALAXY_CENTER).add(sunLocal)

    // 站 3「其他恒星行星系」的坐标是"以太阳为原点"的相对坐标（K5）：
    // 让整个恒星场随太阳一起移动，这样从太阳系一路拉远时，近邻恒星才会出现在太阳周围
    // 并随银河盘自转，而不是飘在世界原点。
    starSystems.root.position.copy(solarRoot.position)
  }

  function updateVisibility(
    camera: THREE.PerspectiveCamera,
    dist: number,
    targetId: string,
    stage: string,
    state: WorldState
  ): void {
    // 银河系点云：按距离淡入淡出，接近星系图鉴时再轻微压暗（避免与图鉴争画面）
    const galFade = smooth(1400, 18000, dist)
    ;(galaxy.points.material.uniforms.uOpacity as { value: number }).value =
      galFade * 0.85 * (1 - smooth(120000, 600000, dist) * 0.55)
    galaxy.points.visible = galFade > 0.001

    // 太阳在银河中的位置标记：跟随太阳系（站 4 可见它随盘移动）
    galaxy.solarMarker.position.copy(solarRoot.position)
    galaxy.solarMarker.visible = dist > 2700
    galaxy.solarMarker.material.opacity = galFade * 0.8
    galaxy.solarMarker.scale.setScalar(clamp(dist * 0.01, 60, 1200))

    // 行星轨道线：只在合适距离显示
    solar.orbitGroup.visible = state.orbitsVisible && dist > 8 && dist < 11000
    const orbitFade = smooth(8, 35, dist) * (1 - smooth(1200, 11000, dist))
    for (const line of solar.orbitGroup.children) {
      const material = (line as THREE.LineLoop).material as THREE.LineBasicMaterial
      material.opacity = (line.userData.baseOpacity as number) * orbitFade
    }
    solar.moonOrbitGroup.visible = state.orbitsVisible && stage === 'earth' && dist < 400

    // 木星系 / 土星系：仅在"拓展观察"进入时可见
    const visibleMoonSystems = new Set<string>()
    for (const system of moonSystems.systems) {
      const ids = moonIdsOf.get(system.id)
      if (targetId === system.id || (ids ? ids.has(targetId) : false)) {
        visibleMoonSystems.add(system.id)
      }
    }
    moonSystems.setVisibility(visibleMoonSystems)

    // 站 3：其他恒星行星系
    starSystems.updateVisibility(camera, targetId, stage)

    // 站 4/5：河外星系（图鉴随距离淡入，避免跨层时突现）
    galaxyAtlas.update(camera, {
      stage,
      activeGalaxyId: galaxyAtlas.galaxies.has(targetId) ? targetId : null,
      distance: dist
    })
  }

  return {
    solarRoot,
    solar,
    moonSystems,
    starSystems,
    galaxyDisk,
    galaxy,
    galaxyAtlas,
    backgroundStars,
    starFields: [galaxy.points, backgroundStars, ...galaxyAtlas.starFields],
    galaxyCenter: GALAXY_CENTER,
    getPosition,
    getRadius,
    getTarget,
    isSolarBody,
    getData: infoOf,
    update,
    updateVisibility
  }
}
