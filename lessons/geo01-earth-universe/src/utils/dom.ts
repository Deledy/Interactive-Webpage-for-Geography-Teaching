/* ============================================================
   常用 DOM 工具（迁移自 main.js 顶部工具函数）
   ============================================================ */

/** 是否偏好减少动效（无 matchMedia 环境自动视为否，保证兼容） */
export const prefersReducedMotion = !!(
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
)

/** querySelector 简写 */
export function $(sel: string, root?: ParentNode): Element | null {
  return (root || document).querySelector(sel)
}

/** querySelectorAll 简写（返回数组） */
export function $$(sel: string, root?: ParentNode): Element[] {
  return Array.from((root || document).querySelectorAll(sel))
}
