/** 课堂点名系统（导航栏）：读取名单 → 滚动抽取（点击「开始」滚动、「停止」定格并切换回「开始」） */
import { on, must } from '../utils/dom'
import { icon } from '../utils/icons'
import defaultNames from '../data/rollcall.txt?raw'

/** 滚动刷新间隔（毫秒）：足够快形成「滚动」感，又不至于闪烁过快 */
const TICK = 60

let names: string[] = []
let running = false
let timerId: number | null = null

let navBtn: HTMLButtonElement | null = null
let bubble: HTMLElement | null = null
let nameEl: HTMLElement | null = null
let countEl: HTMLElement | null = null
let toggleBtn: HTMLButtonElement | null = null
let fileInput: HTMLInputElement | null = null

/** 解析名单文本：去空行、去 # 注释、去首尾空白 */
function parseNames(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
}

function renderCount(): void {
  if (countEl) countEl.textContent = `共 ${names.length} 人`
}

function renderName(text: string): void {
  if (nameEl) nameEl.textContent = text
}

function setNames(raw: string): void {
  stop()
  names = parseNames(raw)
  renderCount()
  nameEl?.classList.remove('is-picked')
  renderName(names.length > 0 ? '准备就绪' : '名单为空')
}

/** 滚动一次：随机取一个姓名显示 */
function tick(): void {
  if (names.length === 0) return
  renderName(names[Math.floor(Math.random() * names.length)])
}

function start(): void {
  if (names.length === 0 || timerId !== null) return
  running = true
  if (toggleBtn) {
    toggleBtn.innerHTML = `${icon('icon-stop', 18)}<span>停止</span>`
    toggleBtn.classList.add('is-running')
  }
  nameEl?.classList.remove('is-picked')
  tick()
  timerId = window.setInterval(tick, TICK)
}

function stop(): void {
  const wasRunning = running
  running = false
  if (timerId !== null) {
    window.clearInterval(timerId)
    timerId = null
  }
  if (toggleBtn) {
    toggleBtn.innerHTML = `${icon('icon-play', 18)}<span>开始</span>`
    toggleBtn.classList.remove('is-running')
  }
  if (wasRunning) nameEl?.classList.add('is-picked')
}

function toggle(): void {
  if (running) stop()
  else start()
}

function openBubble(): void {
  bubble?.classList.remove('is-hidden')
  navBtn?.classList.add('is-open')
  navBtn?.setAttribute('aria-expanded', 'true')
}

function closeBubble(): void {
  stop()
  bubble?.classList.add('is-hidden')
  navBtn?.classList.remove('is-open')
  navBtn?.setAttribute('aria-expanded', 'false')
}

export function initRollcall(root: HTMLElement): void {
  root.innerHTML = `
    <button type="button" class="nav__btn nav__rollcall-btn btn" aria-expanded="false" aria-haspopup="true" aria-label="课堂点名">
      ${icon('icon-users', 20)}<span>按钮</span>
    </button>
    <div class="rollcall__bubble is-hidden" role="dialog" aria-label="课堂点名">
      <div class="rollcall__head">
        <span class="rollcall__title">课堂点名</span>
        <span class="rollcall__count"></span>
      </div>
      <div class="rollcall__stage">
        <div class="rollcall__name">准备就绪</div>
      </div>
      <div class="rollcall__actions">
        <button type="button" class="rollcall__toggle btn btn--primary">${icon('icon-play', 18)}<span>开始</span></button>
        <button type="button" class="rollcall__import btn btn--ghost">${icon('icon-list', 18)}<span>导入名单</span></button>
      </div>
      <input type="file" class="rollcall__file" accept=".txt,text/plain" hidden />
    </div>
  `

  const btn = must<HTMLButtonElement>('.nav__rollcall-btn', root)
  const box = must<HTMLElement>('.rollcall__bubble', root)
  const name = must<HTMLElement>('.rollcall__name', root)
  const count = must<HTMLElement>('.rollcall__count', root)
  const toggleButton = must<HTMLButtonElement>('.rollcall__toggle', root)
  const importer = must<HTMLButtonElement>('.rollcall__import', root)
  const file = must<HTMLInputElement>('.rollcall__file', root)

  navBtn = btn
  bubble = box
  nameEl = name
  countEl = count
  toggleBtn = toggleButton
  fileInput = file

  setNames(defaultNames)

  on(btn, 'click', () => {
    if (box.classList.contains('is-hidden')) openBubble()
    else closeBubble()
  })
  on(toggleButton, 'click', toggle)
  on(importer, 'click', () => file.click())
  on(file, 'change', () => {
    const selected = file.files?.[0]
    file.value = ''
    if (!selected) return
    const reader = new FileReader()
    reader.onload = () => setNames(String(reader.result ?? ''))
    reader.readAsText(selected, 'utf-8')
  })

  // 点击气泡外部关闭（再次点击「点名」按钮由上方 btn 处理，不会在此误关）。
  // 必须用 pointerdown 而非 click：start/stop 会在 click 阶段替换按钮 innerHTML，
  // 若用 click，被点中的子节点（文字/图标）此刻已脱离文档，root.contains 会误判为
  // “点击外部”而把气泡关掉；pointerdown 发生在替换之前，target 仍完好。
  on(document, 'pointerdown', (ev) => {
    if (box.classList.contains('is-hidden')) return
    if (!root.contains(ev.target as Node)) closeBubble()
  })
}

/** 复位：停止滚动并收起气泡（不清理已加载名单），供「重置本页」调用 */
export function resetRollcall(): void {
  closeBubble()
}
