/* ============================================================
   PracticeWindow · 通用练习窗口组件
   ------------------------------------------------------------
   - 与课程无关：数据用统一 schema（content/types.ts），视觉全走 --pw-* 令牌；
   - 单题卡片结构与富文本渲染由内容层（content/）统一提供，本文件只管窗口与交互；
   - 一份渲染器，两种容器：openPracticeWindow 缺省建浮层，传入 container 则页内挂载；
   - 交互状态机：单选点选即判 / 多选提交判定 / 综合题展开参考答案；
   - 窗口骨架：标题 + 全屏/关闭 + 「第 x / n 题」与题号点阵 + 底部「重做本页练习」；
   - 计时：正计时（timer）或限时倒计时（limitSeconds，不锁定、不阻断）。
   详见 shared/quiz/runtime/docs/通用练习窗口_开发文档.md。
   ============================================================ */
import type { CqData, CqQuestion, CqSection } from '../../content/types'
import { renderQuestionCard, type CardState } from '../../content/renderCard'
import { escapeHtml, renderInlineRich } from '../../content/richText'
import { validateQuizData } from './validate'
import '../styles/default-tokens.css'
import '../../content/card.css'
import '../styles/practiceWindow.css'

export interface PracticeViewOptions {
  title?: string
  /** 顶部引导语（行内富文本：HTML 清洗，或纯文本转义） */
  subtitle?: string
  /** 分节题目（课后练习用） */
  sections?: CqSection[]
  /** 单组题目（模块随堂练习用；与 sections 二选一） */
  questions?: CqQuestion[]
  /** 列表模式（默认）/ 逐题模式 */
  mode?: 'list' | 'step'
  /** 正计时（自动累加）；缺省不显示计时 */
  timer?: boolean
  /** 限时秒数：提供时以倒计时显示（不锁定、不阻断；优先于 timer） */
  limitSeconds?: number
  /** 顶部「全屏」按钮（缺省不显示） */
  fullscreen?: boolean
  /** 顶部「关闭」按钮（浮层用；缺省不显示） */
  closable?: boolean
  /** 底部「重做本页练习」入口（缺省不显示） */
  resetBar?: boolean
  /** 点击「关闭」时的回调 */
  onClose?: () => void
  /** --pw-* 令牌覆盖（形如 { '--pw-accent': '#E8B04B' }） */
  theme?: Record<string, string>
  emptyTitle?: string
  emptyText?: string
  /** 校验问题列表（非空时作为「数据格式有误」空态展示） */
  emptyIssues?: string[]
}

export interface PracticeView {
  readonly root: HTMLElement
  readonly title: string
  /** 清空作答状态（保留计时） */
  reset(): void
  destroy(): void
}

/** 窗口级入参：在视图入参之上增加「数据」与「容器」 */
export interface PracticeWindowOptions extends PracticeViewOptions {
  /** 题库数据（统一 schema）；未显式传 sections 时按其 sections 渲染 */
  data?: CqData | null
  /** 页内挂载容器；缺省 = 组件内置浮层 */
  container?: HTMLElement
  /**
   * 展示形态（缺省由 container 推断）：
   * - 'overlay'：铺满视口（真实课程使用）；
   * - 'inline'：只把题目内容挂进容器（M10 页内区块）；
   * - 'embedded'：窗口骨架铺满指定画布（编辑器整窗预览，需同时传 container）。
   */
  display?: 'overlay' | 'inline' | 'embedded'
}

export interface PracticeWindowHandle {
  readonly root: HTMLElement
  /** 浮层容器（页内挂载时为 null） */
  readonly overlay: HTMLElement | null
  reset(): void
  close(): void
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 找到最近的纵向滚动容器（用于列表模式「当前题」定位） */
function findScrollParent(el: HTMLElement): HTMLElement | null {
  let parent = el.parentElement
  while (parent) {
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(parent) : null
    if (style && (style.overflowY === 'auto' || style.overflowY === 'scroll')) return parent
    parent = parent.parentElement
  }
  return null
}

/**
 * 创建练习视图（同步渲染，返回控制器）。
 * 消费方负责外层容器（页内区域 / 浮层内容区）与开合逻辑；
 * 需要「开箱即用」的浮层/页内挂载，请用 openPracticeWindow。
 */
export function createPracticeView(options: PracticeViewOptions): PracticeView {
  const mode: 'list' | 'step' = options.mode === 'step' ? 'step' : 'list'
  const rawSections: CqSection[] =
    options.sections && options.sections.length
      ? options.sections
      : [{ questions: options.questions ?? [] }]
  const sections = rawSections.filter((sec) => sec.questions && sec.questions.length)
  const flat: CqQuestion[] = sections.reduce<CqQuestion[]>((acc, sec) => acc.concat(sec.questions ?? []), [])

  const countdown = typeof options.limitSeconds === 'number' && options.limitSeconds > 0
  const showTimer = countdown || !!options.timer

  const states = new Map<string, CardState>()
  let step = 0
  let clock = countdown ? Math.floor(options.limitSeconds as number) : 0
  let timerId: number | null = null
  let current = 0

  const root = document.createElement('div')
  root.className = 'pw'
  root.setAttribute('data-pw', '')
  if (options.theme) {
    for (const [name, value] of Object.entries(options.theme)) {
      if (name.startsWith('--')) root.style.setProperty(name, value)
    }
  }

  const globalIndex = new Map<CqQuestion, number>()
  flat.forEach((q, i) => globalIndex.set(q, i))
  const keyOf = (q: CqQuestion): string => `q-${globalIndex.get(q) ?? 0}`

  function stateOf(key: string): CardState {
    let s = states.get(key)
    if (!s) {
      s = { selected: [], submitted: false, revealed: false }
      states.set(key, s)
    }
    return s
  }

  /* ---------------- 题目渲染（结构由内容层统一提供） ---------------- */

  function questionHtml(question: CqQuestion, key: string): string {
    return renderQuestionCard({
      question,
      key,
      index: globalIndex.get(question) ?? 0,
      state: stateOf(key)
    })
  }

  /* ---------------- 窗口骨架 ---------------- */

  function headHtml(): string {
    const title = escapeHtml(options.title || '练习')
    const timer = showTimer
      ? `<div class="pw-timer${countdown && clock <= 0 ? ' is-warn' : ''}" data-pw-timer>${formatClock(clock)}</div>`
      : ''
    const actions = options.fullscreen || options.closable
      ? `<div class="pw-head__actions">
        ${options.fullscreen ? `<button type="button" class="pw-btn" data-pw-fullscreen aria-label="全屏">全屏</button>` : ''}
        ${options.closable ? `<button type="button" class="pw-btn" data-pw-close aria-label="关闭">关闭</button>` : ''}
      </div>`
      : ''
    return `<div class="pw-head"><div class="pw-title">${title}</div>${timer}${actions}</div>`
  }

  function navHtml(): string {
    if (mode !== 'list' || flat.length <= 1) return ''
    const dots = flat
      .map((q, i) => {
        const st = stateOf(keyOf(q))
        const answered = st.submitted || st.revealed
        return `<button type="button" class="pw-nav__dot${answered ? ' is-answered' : ''}" data-pw-jump="${i}" aria-label="第 ${i + 1} 题">${i + 1}</button>`
      })
      .join('')
    return `<div class="pw-nav">
      <span class="pw-nav__progress" data-pw-progress>第 ${current + 1} / ${flat.length} 题</span>
      <div class="pw-nav__dots">${dots}</div>
    </div>`
  }

  function stepActionsHtml(): string {
    if (mode !== 'step' || flat.length <= 1) return ''
    return `<div class="pw-step-actions">
      <button type="button" class="btn btn--ghost" data-pw-prev${step === 0 ? ' disabled' : ''}>上一题</button>
      <button type="button" class="btn btn--ghost" data-pw-next${step >= flat.length - 1 ? ' disabled' : ''}>下一题</button>
    </div>`
  }

  function footHtml(): string {
    if (!options.resetBar) return ''
    return `<div class="pw-foot"><button type="button" class="pw-btn pw-reset" data-pw-reset>重做本页练习</button></div>`
  }

  function emptyHtml(): string {
    const hasIssues = !!(options.emptyIssues && options.emptyIssues.length)
    const title = hasIssues ? '数据格式有误，已忽略' : escapeHtml(options.emptyTitle || '本节课暂未配置练习')
    const text = hasIssues
      ? '检测到练习数据存在无法解析的内容，不完整的题目已跳过，页面其它模块不受影响。'
      : escapeHtml(options.emptyText || '教师可在本页面同级目录放置练习数据文件以按学情设置题目。')
    const issues = hasIssues
      ? `<ul class="cq-empty__issues">${options.emptyIssues!
          .slice(0, 5)
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join('')}</ul>`
      : ''
    return `<div class="cq-empty panel">
      <p class="cq-empty__title">${title}</p>
      <p class="cq-empty__text">${text}</p>
      ${issues}
    </div>`
  }

  /** 列表模式：同步「当前题」高亮与「第 x / n 题」进度（不重建 DOM，避免打断滚动） */
  function syncNav(): void {
    if (mode !== 'list' || flat.length <= 1) return
    const dots = Array.from(root.querySelectorAll<HTMLElement>('[data-pw-jump]'))
    dots.forEach((dot, i) => {
      const on = i === current
      dot.classList.toggle('is-current', on)
      if (on) dot.setAttribute('aria-current', 'true')
      else dot.removeAttribute('aria-current')
    })
    const label = root.querySelector<HTMLElement>('[data-pw-progress]')
    if (label) label.textContent = `第 ${current + 1} / ${flat.length} 题`
  }

  /** 依据滚动位置计算「当前题」序号 */
  function computeCurrent(): number {
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('.cq-q'))
    if (!nodes.length) return 0
    const container = findScrollParent(root)
    const baseTop = (container ? container.getBoundingClientRect().top : 0) + 8
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].getBoundingClientRect().bottom > baseTop) return i
    }
    return nodes.length - 1
  }

  function onScroll(): void {
    if (mode !== 'list' || flat.length <= 1) return
    const next = computeCurrent()
    if (next === current) return
    current = next
    syncNav()
  }

  function render(): void {
    if (!flat.length) {
      root.innerHTML = emptyHtml()
      return
    }
    if (mode === 'step') {
      root.innerHTML = `<div class="pw-inner">${headHtml()}<div class="pw-body">${questionHtml(
        flat[step],
        keyOf(flat[step])
      )}</div>${stepActionsHtml()}${footHtml()}</div>`
      return
    }
    const body = sections
      .map((sec) => {
        const qs = (sec.questions ?? []).map((q) => questionHtml(q, keyOf(q))).join('')
        return `<section class="cq-sec">${
          sec.title ? `<h3 class="cq-sec__title">${escapeHtml(sec.title)}</h3>` : ''
        }<div class="cq-sec__qs">${qs}</div></section>`
      })
      .join('')
    const intro = options.subtitle ? `<p class="cq-intro">${renderInlineRich(options.subtitle)}</p>` : ''
    root.innerHTML = `<div class="pw-inner">${headHtml()}${navHtml()}<div class="pw-body">${intro}${body}</div>${footHtml()}</div>`
    syncNav()
  }

  /* ---------------- 交互 ---------------- */

  function toggleFullscreen(): void {
    const panel = root.closest('.pw-panel') as HTMLElement | null
    ;(panel ?? root).classList.toggle('is-fullscreen')
  }

  function handleOption(button: HTMLButtonElement): void {
    const key = button.dataset.cqOpt ?? ''
    const question = flat[Number(key.replace(/^q-/, ''))]
    if (!question || question.type !== 'choice') return
    const state = stateOf(key)
    if (state.submitted) return
    const picked = button.dataset.key ?? ''
    if (question.mode === 'multiple') {
      state.selected = state.selected.includes(picked)
        ? state.selected.filter((item) => item !== picked)
        : [...state.selected, picked]
    } else {
      state.selected = [picked]
      state.submitted = true
    }
    render()
  }

  function onClick(event: Event): void {
    const target = event.target as HTMLElement
    const closest = (sel: string): HTMLElement | null =>
      target.closest ? (target.closest(sel) as HTMLElement | null) : null

    const option = closest('[data-cq-opt]')
    if (option) {
      handleOption(option as HTMLButtonElement)
      return
    }
    const submit = closest('[data-cq-submit]')
    if (submit) {
      const key = submit.dataset.cqSubmit ?? ''
      const state = stateOf(key)
      if (state.selected.length) {
        state.submitted = true
        render()
      }
      return
    }
    const reveal = closest('[data-cq-reveal]')
    if (reveal) {
      const state = stateOf(reveal.dataset.cqReveal ?? '')
      state.revealed = !state.revealed
      render()
      return
    }
    const jump = closest('[data-pw-jump]')
    if (jump) {
      const idx = Number(jump.dataset.pwJump)
      current = idx
      syncNav()
      const node = root.querySelector<HTMLElement>(`.cq-q[data-q="q-${idx}"]`)
      if (node && node.scrollIntoView) node.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (closest('[data-pw-prev]')) {
      if (step > 0) {
        step -= 1
        render()
      }
      return
    }
    if (closest('[data-pw-next]')) {
      if (step < flat.length - 1) {
        step += 1
        render()
      }
      return
    }
    if (closest('[data-pw-fullscreen]')) {
      toggleFullscreen()
      return
    }
    if (closest('[data-pw-reset]')) {
      reset()
      return
    }
    if (closest('[data-pw-close]')) {
      options.onClose?.()
      return
    }
  }

  function reset(): void {
    states.clear()
    step = 0
    current = 0
    render()
  }

  root.addEventListener('click', onClick)
  if (mode === 'list' && flat.length > 1) document.addEventListener('scroll', onScroll, true)

  if (showTimer) {
    timerId = window.setInterval(() => {
      clock = countdown ? Math.max(0, clock - 1) : clock + 1
      const node = root.querySelector<HTMLElement>('[data-pw-timer]')
      if (node) {
        node.textContent = formatClock(clock)
        node.classList.toggle('is-warn', countdown && clock <= 0)
      }
    }, 1000)
  }

  render()

  return {
    root,
    title: options.title || '',
    reset,
    destroy(): void {
      if (timerId !== null) window.clearInterval(timerId)
      timerId = null
      root.removeEventListener('click', onClick)
      document.removeEventListener('scroll', onScroll, true)
      root.remove()
    }
  }
}

/* ---------------- 窗口（浮层 / 页内挂载） ---------------- */

/** 当前已打开的窗口（同一时刻只允许一个） */
let activeWindow: PracticeWindowHandle | null = null

/**
 * 打开练习窗口：
 * - 未传 `container` → 组件自建**全屏毛玻璃浮层**（铺满视口、「关闭」按钮 / Esc 退出、页面滚动锁定）；
 * - 传入 `container` → 页内挂载（保持页面既有导航入口体验）；
 * - `display: 'embedded'` + `container` → 浮层铺满该容器（编辑器整窗预览，不锁定页面滚动）。
 * 返回句柄；重复调用会自动关闭上一个窗口。
 */
export function openPracticeWindow(options: PracticeWindowOptions): PracticeWindowHandle {
  if (activeWindow) activeWindow.close()

  // 窗口级关闭回调：任意路径（关闭按钮 / 遮罩 / Esc / 被新窗口顶替）退出时都会触发
  const notifyClose = options.onClose

  // 数据收敛：优先显式 sections → 否则校验 data → 再否则用 questions（模块随堂练习）
  let sections = options.sections
  let issues = options.emptyIssues ?? []
  if (!sections && options.data !== undefined) {
    const checked = validateQuizData(options.data)
    sections = checked.data?.sections
    if (checked.issues.length) issues = [...checked.issues, ...issues]
  }

  const base: PracticeViewOptions = {
    title: options.title ?? options.data?.title,
    subtitle: options.subtitle ?? options.data?.subtitle,
    sections,
    questions: sections ? undefined : options.questions,
    mode: options.mode,
    timer: options.timer,
    limitSeconds: options.limitSeconds,
    theme: options.theme,
    resetBar: options.resetBar ?? true,
    emptyTitle: options.emptyTitle,
    emptyText: options.emptyText,
    emptyIssues: issues
  }

  // 嵌入画布：窗口骨架铺满指定容器（不走页内挂载分支）
  const embedded = options.display === 'embedded' && !!options.container

  // 页内挂载
  if (options.container && !embedded) {
    const view = createPracticeView({ ...base, fullscreen: options.fullscreen ?? true })
    options.container.appendChild(view.root)
    let closed = false
    const handle: PracticeWindowHandle = {
      root: view.root,
      overlay: null,
      reset: () => view.reset(),
      close: () => {
        if (closed) return
        closed = true
        view.destroy()
        if (activeWindow === handle) activeWindow = null
        notifyClose?.()
      }
    }
    activeWindow = handle
    return handle
  }

  // 浮层：默认铺满视口；嵌入模式下铺满指定画布（编辑器整窗预览）
  const host = embedded ? (options.container as HTMLElement) : document.body
  const overlay = document.createElement('div')
  overlay.className = embedded ? 'pw-overlay pw-overlay--embedded' : 'pw-overlay'
  overlay.setAttribute('data-pw-overlay', '')
  const panel = document.createElement('div')
  panel.className = 'pw-panel'
  panel.setAttribute('role', 'dialog')
  // 嵌入画布属于页面内的一块预览区域，不是真正的模态框
  if (!embedded) panel.setAttribute('aria-modal', 'true')
  overlay.appendChild(panel)

  let closed = false
  let handle!: PracticeWindowHandle

  let view: PracticeView
  try {
    view = createPracticeView({
      ...base,
      // 浮层本身即全屏毛玻璃，故不再提供「全屏」按钮
      fullscreen: false,
      closable: options.closable ?? true,
      onClose: () => close()
    })
  } catch {
    // FR-10：渲染异常 → 回退空态，不白屏
    view = createPracticeView({
      title: base.title,
      emptyTitle: '数据格式有误，已忽略',
      emptyIssues: ['渲染过程出现异常，已回退空态']
    })
  }
  panel.appendChild(view.root)

  // 只有真正的全屏浮层才锁定页面滚动；嵌入预览不能影响编辑器本身
  const previousOverflow = document.body.style.overflow
  if (!embedded) document.body.style.overflow = 'hidden'

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') close()
  }

  function close(): void {
    if (closed) return
    closed = true
    view.destroy()
    document.removeEventListener('keydown', onKeydown)
    overlay.remove()
    if (!embedded) document.body.style.overflow = previousOverflow
    if (activeWindow === handle) activeWindow = null
    notifyClose?.()
  }

  document.addEventListener('keydown', onKeydown)
  host.appendChild(overlay)

  handle = {
    root: view.root,
    overlay,
    reset: () => view.reset(),
    close
  }
  activeWindow = handle
  return handle
}
