/* ============================================================
   core/dolly.ts
   单一滚轮推拉控制器：从地球表面一直推到可观测宇宙，全程同一条曲线。

   为什么需要它：
   - 原来 < 62 万单位交给 OrbitControls、> 62 万交给 cosmos 的自定义滚轮，
     两条缩放曲线的速度不同，跨过阈值时像"换挡"；
   - 飞行途中 controls.enabled=false，滚轮会被静默忽略，手感不一致。

   现在的做法：
   - 滚轮只改对数视距目标值，每帧用指数阻尼逼近 → 快滚有惯性、慢滚更细腻；
   - 与 OrbitControls 的分工是"旋转交给它，推拉交给我"（滚轮事件在捕获阶段截获，
     触摸双指缩放仍由 OrbitControls 处理）；
   - 任何外部原因（双指缩放、点击飞行结束）改变了实际距离，会在下一帧自动重新同步。
   ============================================================ */
import * as THREE from 'three'
import type { CameraRig, Navigation } from './camera'
import { clamp } from './math'

export interface Dolly {
  update: (dt: number) => void
  handleWheel: (event: WheelEvent) => boolean
  /** 外部（如取消飞行、初始化）改变相机后，让它重新对齐 */
  sync: () => void
}

export function createDolly(rig: CameraRig, nav: Navigation): Dolly {
  const { camera, controls } = rig
  const offset = new THREE.Vector3()
  let currentLog = 0
  let targetLog = 0
  let wasFlying = false
  let initialized = false

  function distance(): number {
    return camera.position.distanceTo(controls.target)
  }

  function sync(): void {
    currentLog = Math.log(Math.max(1e-6, distance()))
    targetLog = currentLog
    initialized = true
  }

  function limits(): { min: number; max: number } {
    const min = Math.log(Math.max(1e-3, controls.minDistance))
    const max = Math.log(Math.max(controls.minDistance, controls.maxDistance))
    return { min, max }
  }

  function handleWheel(event: WheelEvent): boolean {
    if (event.target !== controls.domElement) return false
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1
    const delta = clamp(event.deltaY * unit, -420, 420)
    if (delta === 0) return false

    // 飞行中滚轮 = 立刻接管镜头（与拖动一致），而不是静默忽略
    if (nav.isFlying()) nav.cancelFlight()

    const live = Math.log(Math.max(1e-6, distance()))
    // 只在实际距离与内部记录明显不符（双指缩放 / 飞行落点）时重同步；
    // 不能拿 targetLog 比较，否则连续滚轮会被每次都重置，永远累积不起来。
    if (!initialized || Math.abs(currentLog - live) > 0.35) {
      currentLog = live
      targetLog = live
    }

    const { min, max } = limits()
    targetLog = clamp(targetLog + delta * 0.0016, min, max)
    initialized = true

    // 捕获阶段截获，避免 OrbitControls 再叠加一次缩放
    event.preventDefault()
    event.stopPropagation()
    return true
  }

  function update(dt: number): void {
    const flying = nav.isFlying()
    if (flying) {
      sync()
      wasFlying = true
      return
    }
    if (wasFlying) {
      // 点击飞行刚结束：以实际落点为准，避免目标值还是起飞前的旧值
      sync()
      wasFlying = false
    }
    if (!initialized) {
      sync()
      return
    }

    // 触摸双指缩放 / 外部改动：实际距离与内部记录差得较多时重新同步
    const actual = Math.log(Math.max(1e-6, distance()))
    if (Math.abs(actual - currentLog) > 0.02) {
      currentLog = actual
      targetLog = actual
    }

    // 只允许目标比当前最多领先 0.35 个数量级：
    // 连续滚轮仍然能一直推进，但松手后最多再滑行约 2–2.5 秒，
    // 不会把很久以前的目标攒成一段"自动播放"。
    const lead = 0.35 * Math.LN10
    targetLog = clamp(targetLog, currentLog - lead, currentLog + lead)

    const { min, max } = limits()
    const goal = clamp(targetLog, min, max)

    // OpenSpace 的手感：缩放是"速度 × 当前距离"的指数推进，而不是把目标距离直接吃进去。
    // 全程统一限速（数量级/秒），不再按距离分"近景灵敏 / 深空放慢"两档 ——
    // 之前在 12 万～80 万单位之间把限速从 1.8 压到 0.14，导致银河系内近乎瞬移、
    // 银河系外却要慢慢滑，两段手感割裂。现在只用同一个常量。
    const MAX_LOG_RATE = 0.3 // 数量级/秒
    const maxStep = MAX_LOG_RATE * Math.LN10 * Math.max(0, dt)
    const diff = goal - currentLog
    const desired = diff * (1 - Math.exp(-Math.max(0, dt) * 6))
    currentLog += clamp(desired, -maxStep, maxStep)
    if (Math.abs(goal - currentLog) < 1e-4) currentLog = goal

    const next = Math.exp(currentLog)
    offset.copy(camera.position).sub(controls.target)
    if (offset.lengthSq() < 1e-12) return
    camera.position.copy(controls.target).addScaledVector(offset.normalize(), next)
    controls.update()
  }

  return { update, handleWheel, sync }
}
