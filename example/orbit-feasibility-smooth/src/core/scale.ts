/* ============================================================
   core/scale.ts
   连续尺度模型：整套"层级演变"只依赖一个连续量 —— log10(视距)。

   设计原则（对应 OpenSpace 的"没有层级、只有距离"）：
   1) 渲染代码不再出现 `stage === ...` 的可见性开关；层级只作为 UI 文案。
   2) 每个图层、每种细节都有自己的一段 log 空间淡入淡出区间，相邻区间必须重叠。
   3) 阈值以 log10(场景单位) 表达，跨 6 个数量级的过渡可以用同一套函数描述。
   ============================================================ */
import { clamp, smooth } from './math'

export const ZOOM_FLOOR = 0.001

/** log10 视距：所有淡入淡出、LOD、点尺寸都以它为自变量 */
export function zoomOf(distance: number): number {
  return Math.log10(Math.max(ZOOM_FLOOR, distance))
}

/** 在 [logStart, logEnd] 区间内由 0 平滑升到 1 */
export function fadeIn(logStart: number, logEnd: number, distance: number): number {
  return clamp(smooth(logStart, logEnd, zoomOf(distance)), 0, 1)
}

/** 在 [logStart, logEnd] 区间内由 1 平滑降到 0 */
export function fadeOut(logStart: number, logEnd: number, distance: number): number {
  return 1 - fadeIn(logStart, logEnd, distance)
}

/** 中间为 1、两端淡出；相邻图层的窗口应至少重叠 50% */
export function windowFade(
  inA: number,
  inB: number,
  outA: number,
  outB: number,
  distance: number
): number {
  return fadeIn(inA, inB, distance) * fadeOut(outA, outB, distance)
}

/** 投影尺寸（像素）：用于按"屏幕占比"而不是固定距离切 LOD */
export function screenPixels(
  radius: number,
  distance: number,
  viewportHeight: number,
  fovDeg: number
): number {
  const halfFov = (fovDeg * Math.PI) / 360
  return (radius / Math.max(1e-6, distance * Math.tan(halfFov))) * (viewportHeight / 2)
}
