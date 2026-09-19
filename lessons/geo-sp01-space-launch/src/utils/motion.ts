/** 动效工具：统一读取 CSS 令牌，二选一自动降级 */
import gsap from 'gsap'

export function reduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** 读取 tokens.css 中的 --t-* 令牌（毫秒） */
export function dur(name: 'fast' | 'base' | 'slow' | 'hero'): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--t-${name}`).trim()
  const value = Number.parseFloat(raw)
  if (Number.isNaN(value)) return 300
  return raw.endsWith('ms') ? value : value * 1000
}

/** 读取缓动令牌（供 GSAP 使用） */
export function ease(name: 'out' | 'back' = 'out'): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--e-${name}`).trim()
  return raw || 'cubic-bezier(0.2, 0.8, 0.2, 1)'
}

/**
 * 有动效时执行 tween，减少动效时直接跳到终态。
 * @param target 补间目标
 * @param vars 补间参数（duration 由 motion 统一给出，可覆盖）
 * @param onDone 终态回调（减少动效时也会执行）
 */
export function animate(
  target: gsap.TweenTarget,
  vars: gsap.TweenVars,
  onDone?: () => void
): gsap.core.Tween | null {
  const duration = (vars.duration as number | undefined) ?? dur('base') / 1000
  if (reduced()) {
    gsap.set(target, { ...vars, duration: 0, delay: 0, onComplete: undefined })
    onDone?.()
    return null
  }
  return gsap.to(target, { ...vars, duration, onComplete: onDone })
}

export function killTweensOf(target: gsap.TweenTarget): void {
  gsap.killTweensOf(target)
}
