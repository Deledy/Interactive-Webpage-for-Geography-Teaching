/* ============================================================
   core/camera.ts
   移植自 ORBIT 项目 src/core/camera.js（Apache-2.0）。
   已修改：改写为 TypeScript；按本项目教学层级（地月系 / 太阳系 / 其他恒星行星系 /
   银河系 / 河外星系）重排层级判定，并把"落地参数"下放给 world（各层可用不同示意尺度）。
   原始项目：https://github.com/ryh842487118-bot/orbit

   为什么"滚轮就能换层"（本文件是整个交互的核心）：
   1) **层级由距离反推**：stage() 只看"相机到视点的距离"，滚轮改变距离 → 层级自然变化；
      跨层那一刻由上层去刷新 UI（架构图高亮 / 尺度轴游标 / 讲解文案）。
   2) **视点多尺度漂移**：trackingCenter() 让视点随距离连续过渡：
      本天体 → 所属恒星系统中心（太阳系 → 太阳）→ 所属星系中心（银心）→ 星系图鉴中心。
      于是"缩小"不再只是相机后退，而是"看的东西本身在升一级"。
   3) **飞行距离仍在对数空间插值**：exp(lerp(log(start), log(end), eased))，
      从 7.8 单位到 100 万单位都均匀，不会"先冲后停"。
   ============================================================ */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { clamp, smooth, reducedMotion } from './math'

/** 场景尺度上限：需要容纳河外星系图鉴（最远约 40 万单位） */
const MAX_DISTANCE = 3000000
/** 视距超过它即视为进入「银河系」层级（数值与 ORBIT 一致） */
const GALAXY_LEAVE = 2600
/** 视距超过它即打开「河外星系图鉴」；离开阈值更低，形成迟滞避免边界抖动 */
const ATLAS_ENTER = 210000
const ATLAS_LEAVE = 140000
/** 视点交回银心的过渡区间（ORBIT 取 min(30000, viewDistance*0.7)） */
const GALAXY_BLEND_END = 30000

export interface CameraRig {
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
}

export function createCamera(renderer: THREE.WebGLRenderer): CameraRig {
  const camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.001, 4000000)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.07
  controls.enablePan = false
  controls.zoomSpeed = 1.65
  controls.rotateSpeed = 0.5
  controls.minDistance = 1.13
  controls.maxDistance = MAX_DISTANCE
  controls.maxPolarAngle = Math.PI - 0.02
  controls.minPolarAngle = 0.02
  return { camera, controls }
}

/** 教学层级（教材四级 + 拓展观察） */
export type Stage = 'earth' | 'solar' | 'stars' | 'galaxy' | 'galaxies'

export interface Landing {
  /** 落脚距离（场景单位） */
  distance: number
  /** 观看方向（单位向量） */
  direction: THREE.Vector3
}

export type TargetKind = 'body' | 'system' | 'star-system' | 'galaxy' | 'atlas'

/** 一个可飞达目标的完整导航元信息 */
export interface NavTarget {
  /** 进入后聚焦的本体 id */
  focus: string
  /** 所属恒星系统：'solar' 或宿主恒星 id */
  system: string
  /** 所属星系：'galaxy'（银河系）/ 某河外星系 id / 'galaxies'（图鉴） */
  galaxy: string
  kind: TargetKind
  landing: Landing
}

export interface NavWorld {
  getPosition: (id: string, out?: THREE.Vector3) => THREE.Vector3
  getRadius: (id: string) => number
  getTarget: (id: string) => NavTarget | undefined
  isSolarBody: (id: string) => boolean
}

export interface NavState {
  /** 当前聚焦本体 */
  focus: string
  system: string
  galaxy: string
  kind: TargetKind
  stage: Stage
  distance: number
}

interface Flight {
  id: string
  start: number
  duration: number
  startTarget: THREE.Vector3
  startDir: THREE.Vector3
  startDist: number
  endDist: number
  endDir: THREE.Vector3
}

export interface Navigation {
  initialize: () => void
  /** distance 可覆盖默认落地距离（尺度轴用「同一目标的不同尺度刻度」时使用） */
  flyTo: (id: string, opts?: { immediate?: boolean; distance?: number }) => void
  cancelFlight: () => void
  update: (dt: number, now: number) => void
  getState: () => NavState
  isFlying: () => boolean
}

export function createNavigation(rig: CameraRig, world: NavWorld): Navigation {
  const { camera, controls } = rig
  const temp = new THREE.Vector3()
  const temp2 = new THREE.Vector3()

  let view: NavTarget | null = null
  let lastStage: Stage = 'earth'
  let flight: Flight | null = null

  function distanceNow(): number {
    return camera.position.distanceTo(controls.target)
  }

  /** 层级判定：只看距离 + 目标元信息（迟滞只作用于星系图鉴的进出） */
  function computeStage(): Stage {
    if (!view) return 'earth'
    const distance = distanceNow()
    const atlasThreshold = lastStage === 'galaxies' ? ATLAS_LEAVE : ATLAS_ENTER
    if (distance > atlasThreshold) return 'galaxies'
    if (view.kind === 'galaxy' || view.kind === 'atlas') return 'galaxy'
    if (view.system !== 'solar') return distance > GALAXY_LEAVE ? 'galaxy' : 'stars'
    const radius = world.getRadius(view.focus)
    return distance > GALAXY_LEAVE ? 'galaxy' : distance > Math.max(28, radius * 10) ? 'solar' : 'earth'
  }

  /**
   * 视点：随距离把"看的东西"逐级上抬。
   * 这是滚轮换层的另一半 —— 缩放的同时，视点本身在尺度间迁移。
   */
  function trackingCenter(distance: number, out: THREE.Vector3): THREE.Vector3 {
    if (!view) return out.set(0, 0, 0)
    world.getPosition(view.focus, out)

    // 1) 天体 / 恒星系统 → 拉远后交回所属恒星系统中心（太阳系交回太阳，其他恒星系交回该恒星）
    if (view.kind === 'body' || view.kind === 'star-system') {
      const r = world.getRadius(view.focus)
      const systemCenter = view.system === 'solar'
        ? world.getPosition('sun', temp2)
        : world.getPosition(view.system, temp2)
      out.lerp(systemCenter, smooth(Math.max(r * 9, 8), Math.max(r * 25, 75), distance))
    }

    // 2) 再拉远 → 交回所属星系中心（银河系交回银心，河外星系交回该星系本体）
    if (view.galaxy !== 'galaxies') {
      const galaxyCenter = world.getPosition(view.galaxy, temp2)
      out.lerp(galaxyCenter, smooth(Math.max(1800, 0), GALAXY_BLEND_END, distance))
    }

    // 3) 更远 → 交回星系图鉴中心（与银河系同级的其他星系）
    out.lerp(world.getPosition('galaxies', temp2), smooth(ATLAS_ENTER * 0.55, ATLAS_ENTER * 2.4, distance))
    return out
  }

  function applyDistanceLimits(): void {
    if (!view) return
    if (view.kind === 'atlas') controls.minDistance = 20000
    else if (view.kind === 'galaxy') controls.minDistance = 3000
    else controls.minDistance = view.focus === 'earth' ? 1.13 : Math.max(0.2, world.getRadius(view.focus) * 1.13)
    controls.maxDistance = MAX_DISTANCE
  }

  function flyTo(
    id: string,
    { immediate = false, distance }: { immediate?: boolean; distance?: number } = {}
  ): void {
    const target = world.getTarget(id)
    if (!target) return
    view = target
    // 飞行途中临时解除距离钳制：否则起点（如地球近景）会被目标尺度限制住
    controls.minDistance = 0.001
    controls.maxDistance = MAX_DISTANCE
    const startOffset = camera.position.clone().sub(controls.target)
    const duration = immediate || reducedMotion
      ? 1
      : target.kind === 'atlas'
        ? 3200
        : target.kind === 'galaxy'
          ? 2600
          : id === 'solar'
            ? 2200
            : 1800
    flight = {
      id,
      start: performance.now(),
      duration,
      startTarget: controls.target.clone(),
      startDir: startOffset.clone().normalize(),
      startDist: Math.max(0.001, startOffset.length()),
      endDist: distance ?? target.landing.distance,
      endDir: target.landing.direction.clone()
    }
    controls.enabled = false
    controls.update()
  }

  function updateFlight(now: number): void {
    const current = flight
    if (!current) return
    const t = clamp((now - current.start) / current.duration, 0, 1)
    const eased = t * t * (3 - 2 * t) // smoothstep 缓入缓出
    controls.target.lerpVectors(current.startTarget, world.getPosition(current.id), eased)
    const direction = temp.lerpVectors(current.startDir, current.endDir, eased)
    if (direction.lengthSq() < 0.000001) direction.copy(current.endDir)
    direction.normalize()
    // 关键：距离在对数空间插值，跨 6 个数量级仍然均匀
    const distance = Math.exp(THREE.MathUtils.lerp(Math.log(current.startDist), Math.log(current.endDist), eased))
    camera.position.copy(controls.target).addScaledVector(direction, distance)
    controls.update()
    if (t >= 1) cancelFlight()
  }

  function cancelFlight(): void {
    flight = null
    controls.enabled = true
    applyDistanceLimits()
  }

  /** 跟随目标的轨道运动：把目标与镜头的位移同步，避免"跟丢" */
  function updateTracking(dt: number): void {
    const distance = distanceNow()
    temp.copy(trackingCenter(distance, temp)).sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 8))
    controls.target.add(temp)
    camera.position.add(temp)
    applyDistanceLimits()
    controls.update()
  }

  function update(dt: number, now: number): void {
    if (flight) updateFlight(now)
    else updateTracking(dt)
    lastStage = computeStage()
  }

  function initialize(): void {
    view = world.getTarget('earth') ?? null
    if (!view) return
    const earth = world.getPosition('earth')
    controls.target.copy(earth)
    camera.position.copy(earth).addScaledVector(view.landing.direction, view.landing.distance)
    applyDistanceLimits()
    controls.update()
    lastStage = computeStage()
  }

  return {
    initialize,
    flyTo,
    cancelFlight,
    update,
    isFlying: () => flight !== null,
    getState: () => ({
      focus: view?.focus ?? 'earth',
      system: view?.system ?? 'solar',
      galaxy: view?.galaxy ?? 'galaxy',
      kind: view?.kind ?? 'body',
      stage: lastStage,
      distance: distanceNow()
    })
  }
}
