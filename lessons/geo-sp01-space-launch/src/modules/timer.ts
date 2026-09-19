/** 课堂计时器（导航栏）：40 分钟倒计时，点击「开始本课」启动；到点保持 00:00，不做任何提醒 */
import { must } from '../utils/dom'
import { icon } from '../utils/icons'

/** 一节课时长（秒） */
const DURATION = 40 * 60
/** 刷新间隔（毫秒）：按结束时刻反算剩余，避免定时器累积漂移 */
const TICK = 250

let digits: HTMLElement | null = null
let timerId: number | null = null
let endAt = 0

/** 秒 → MM:SS */
function format(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function render(seconds: number): void {
  if (digits) digits.textContent = format(seconds)
}

function stop(): void {
  if (timerId === null) return
  window.clearInterval(timerId)
  timerId = null
}

function tick(): void {
  const remain = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
  render(remain)
  /* 到点只停在 00:00：不弹窗、不变色、不发声 */
  if (remain <= 0) stop()
}

export function initTimer(root: HTMLElement): void {
  root.setAttribute('role', 'timer')
  /* 每秒变化的数值不对读屏播报，避免干扰课堂讲解 */
  root.setAttribute('aria-live', 'off')
  root.setAttribute('aria-label', `课堂计时 ${DURATION / 60} 分钟`)
  root.innerHTML = `${icon('icon-clock', 18)}<span class="nav__timer-digits">${format(DURATION)}</span>`
  digits = must<HTMLElement>('.nav__timer-digits', root)
}

/** 启动倒计时；已在计时中则忽略（离开封面后再点「开始本课」不会重置） */
export function startTimer(): void {
  if (!digits || timerId !== null) return
  endAt = Date.now() + DURATION * 1000
  tick()
  timerId = window.setInterval(tick, TICK)
}

/** 复位为 40:00（供「重置本页」调用） */
export function resetTimer(): void {
  stop()
  render(DURATION)
}
