/* ============================================================
   PracticeWindow · 通用练习窗口组件
   ------------------------------------------------------------
   - 与课程无关：数据用统一 schema（types.ts），视觉全走 --pw-* 令牌；
   - 一份渲染器，两种容器：页内挂载（M10）或浮层内容区（M1–M9）；
   - 交互状态机：单选点选即判 / 多选提交判定 / 综合题展开参考答案；
   - 逐题导航（列表模式）+ 计时器（正计时，自动累加）。
   详见 shared/practice-window/docs/通用练习窗口_开发文档.md。
   ============================================================ */
import type { CqChoice, CqEssay, CqQuestion, CqSection } from './types'
import { escapeHtml, inlineMarkdown, renderMarkdown } from './markdown'
import '../styles/default-tokens.css'
import '../styles/practiceWindow.css'

const CHOICE_BADGE: Record<'single' | 'multiple', string> = {
  single: '单选题',
  multiple: '多选题'
}

interface ItemState {
  selected: string[]
  submitted: boolean
  revealed: boolean
}

export interface PracticeViewOptions {
  title?: string
  /** 顶部引导语（支持行内 Markdown） */
  subtitle?: string
  /** 分节题目（课后练习用） */
  sections?: CqSection[]
  /** 单组题目（模块随堂练习用；与 sections 二选一） */
  questions?: CqQuestion[]
  /** 列表模式（默认）/ 逐题模式 */
  mode?: 'list' | 'step'
  /** 是否显示正计时器（自动累加） */
  timer?: boolean
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

function answerKeys(question: CqChoice): string[] {
  return Array.isArray(question.answer) ? question.answer : [question.answer]
}

function isChoiceCorrect(question: CqChoice, selected: string[]): boolean {
  const expected = answerKeys(question).slice().sort()
  const actual = selected.slice().sort()
  return expected.length === actual.length && expected.every((key, index) => key === actual[index])
}

function essayStems(question: CqEssay): string[] {
  return Array.isArray(question.stems) ? question.stems : question.stems ? [question.stems] : []
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * 创建练习视图（同步渲染，返回控制器）。
 * 消费方负责外层容器（页内区域 / 浮层内容区）与开合逻辑。
 */
export function createPracticeView(options: PracticeViewOptions): PracticeView {
  const mode: 'list' | 'step' = options.mode === 'step' ? 'step' : 'list'
  const rawSections: CqSection[] =
    options.sections && options.sections.length
      ? options.sections
      : [{ questions: options.questions ?? [] }]
  const sections = rawSections.filter((sec) => sec.questions && sec.questions.length)
  const flat: CqQuestion[] = sections.reduce<CqQuestion[]>((acc, sec) => acc.concat(sec.questions ?? []), [])

  const states = new Map<string, ItemState>()
  let step = 0
  let elapsed = 0
  let timerId: number | null = null

  const root = document.createElement('div')
  root.className = 'pw'
  root.setAttribute('data-pw', '')

  const globalIndex = new Map<CqQuestion, number>()
  flat.forEach((q, i) => globalIndex.set(q, i))
  const keyOf = (q: CqQuestion): string => `q-${globalIndex.get(q) ?? 0}`

  function stateOf(key: string): ItemState {
    let s = states.get(key)
    if (!s) {
      s = { selected: [], submitted: false, revealed: false }
      states.set(key, s)
    }
    return s
  }

  /* ---------------- 题目渲染 ---------------- */

  function optionClass(question: CqChoice, key: string, optionKey: string): string {
    const state = stateOf(key)
    const cls = ['cq-opt']
    if (!state.submitted) {
      if (state.selected.includes(optionKey)) cls.push('is-selected')
      return cls.join(' ')
    }
    const correct = answerKeys(question)
    if (correct.includes(optionKey)) cls.push('is-correct')
    else if (state.selected.includes(optionKey)) cls.push('is-wrong')
    else cls.push('is-dim')
    return cls.join(' ')
  }

  function choiceHtml(question: CqChoice, key: string): string {
    const modeOne = question.mode === 'multiple' ? 'multiple' : 'single'
    const state = stateOf(key)
    const revealed = state.submitted
    const options = question.options
      .map(
        (opt) =>
          `<button type="button" class="${optionClass(question, key, opt.key)}" data-cq-opt="${key}" data-key="${opt.key}"${
            revealed ? ' disabled' : ''
          }${state.selected.includes(opt.key) ? ' aria-pressed="true"' : ' aria-pressed="false"'}>
          <span class="cq-opt__key">${escapeHtml(opt.key)}</span>
          <span class="cq-opt__text">${inlineMarkdown(opt.text)}</span>
        </button>`
      )
      .join('')

    const right = isChoiceCorrect(question, state.selected)
    const verdict = !revealed
      ? ''
      : `<div class="cq-verdict ${right ? 'is-right' : 'is-wrong'}">
        <span class="cq-verdict__title">${right ? '回答正确' : '回答错误'}</span>
        <span class="cq-verdict__key">正确答案：<b>${answerKeys(question).join('')}</b></span>
      </div>`

    const detail = !revealed
      ? ''
      : `<div class="cq-detail">
        ${
          question.analysis
            ? `<section class="cq-block cq-block--analysis">
                <h4 class="cq-block__title">解析</h4>
                <div class="cq-block__body">${renderMarkdown(question.analysis)}</div>
              </section>`
            : ''
        }
        ${
          question.knowledge && (question.knowledge.title || question.knowledge.items?.length)
            ? `<section class="cq-block cq-block--knowledge">
                <h4 class="cq-block__title">知识归纳</h4>
                ${question.knowledge.title ? `<p class="cq-knowledge__title">${inlineMarkdown(question.knowledge.title)}</p>` : ''}
                <ul class="cq-knowledge__list">${(question.knowledge.items ?? [])
                  .map((item) => `<li>${inlineMarkdown(item)}</li>`)
                  .join('')}</ul>
              </section>`
            : ''
        }
      </div>`

    const submit =
      modeOne === 'multiple' && !revealed
        ? `<div class="cq-q__actions">
          <button type="button" class="btn btn--primary cq-submit" data-cq-submit="${key}"${
            state.selected.length ? '' : ' disabled'
          }>提交答案</button>
        </div>`
        : ''

    return `<article class="cq-q" data-q="${key}" data-type="choice">
    <div class="cq-q__head">
      <span class="cq-q__no">${(globalIndex.get(question) ?? 0) + 1}</span>
      <span class="cq-q__badge">${CHOICE_BADGE[modeOne]}</span>
      ${question.source ? `<span class="cq-q__source">${escapeHtml(question.source)}</span>` : ''}
    </div>
    ${question.material ? `<div class="cq-q__material">${renderMarkdown(question.material)}</div>` : ''}
    <p class="cq-q__stem">${inlineMarkdown(question.stem)}</p>
    <div class="cq-q__options">${options}</div>
    ${submit}
    ${verdict}
    ${detail}
  </article>`
  }

  function essayHtml(question: CqEssay, key: string): string {
    const state = stateOf(key)
    const stems = essayStems(question)

    const detail = !state.revealed
      ? ''
      : `<div class="cq-detail">
        ${
          question.referenceAnswer
            ? `<section class="cq-block cq-block--answer">
                <h4 class="cq-block__title">参考答案</h4>
                <div class="cq-block__body">${renderMarkdown(question.referenceAnswer)}</div>
              </section>`
            : ''
        }
        ${
          question.analysis
            ? `<section class="cq-block cq-block--analysis">
                <h4 class="cq-block__title">解析</h4>
                <div class="cq-block__body">${renderMarkdown(question.analysis)}</div>
              </section>`
            : ''
        }
        ${
          question.criteria?.length
            ? `<section class="cq-block cq-block--criteria">
                <h4 class="cq-block__title">评分标准</h4>
                <ol class="cq-list cq-list--ordered">${question.criteria
                  .map((item) => `<li>${inlineMarkdown(item)}</li>`)
                  .join('')}</ol>
              </section>`
            : ''
        }
      </div>`

    return `<article class="cq-q" data-q="${key}" data-type="essay">
    <div class="cq-q__head">
      <span class="cq-q__no">${(globalIndex.get(question) ?? 0) + 1}</span>
      <span class="cq-q__badge cq-q__badge--essay">综合题</span>
      ${question.source ? `<span class="cq-q__source">${escapeHtml(question.source)}</span>` : ''}
    </div>
    ${question.material ? `<div class="cq-q__material">${renderMarkdown(question.material)}</div>` : ''}
    ${stems.length ? `<ol class="cq-stems">${stems.map((stem) => `<li>${inlineMarkdown(stem)}</li>`).join('')}</ol>` : ''}
    <div class="cq-q__actions">
      <button type="button" class="btn ${state.revealed ? 'btn--ghost' : 'btn--primary'} cq-reveal" data-cq-reveal="${key}">
        ${state.revealed ? '收起参考答案' : '查看参考答案'}
      </button>
    </div>
    ${detail}
  </article>`
  }

  function questionHtml(question: CqQuestion, key: string): string {
    return question.type === 'essay' ? essayHtml(question, key) : choiceHtml(question, key)
  }

  /* ---------------- 窗口骨架 ---------------- */

  function headHtml(): string {
    const title = escapeHtml(options.title || '练习')
    const timer = options.timer ? `<div class="pw-timer" data-pw-timer>${formatClock(elapsed)}</div>` : ''
    return `<div class="pw-head"><div class="pw-title">${title}</div>${timer}</div>`
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
    return `<div class="pw-nav" role="tablist">${dots}</div>`
  }

  function stepActionsHtml(): string {
    if (mode !== 'step' || flat.length <= 1) return ''
    return `<div class="pw-step-actions">
      <button type="button" class="btn btn--ghost" data-pw-prev${step === 0 ? ' disabled' : ''}>上一题</button>
      <button type="button" class="btn btn--ghost" data-pw-next${step >= flat.length - 1 ? ' disabled' : ''}>下一题</button>
    </div>`
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

  function render(): void {
    if (!flat.length) {
      root.innerHTML = emptyHtml()
      return
    }
    if (mode === 'step') {
      root.innerHTML = headHtml() + `<div class="pw-body">${questionHtml(flat[step], keyOf(flat[step]))}</div>` + stepActionsHtml()
      return
    }
    let cursor = 0
    const body = sections
      .map((sec) => {
        const qs = (sec.questions ?? [])
          .map((q) => questionHtml(q, keyOf(q)))
          .join('')
        return `<section class="cq-sec">${
          sec.title ? `<h3 class="cq-sec__title">${inlineMarkdown(sec.title)}</h3>` : ''
        }<div class="cq-sec__qs">${qs}</div></section>`
      })
      .join('')
    const intro = options.subtitle ? `<p class="cq-intro">${inlineMarkdown(options.subtitle)}</p>` : ''
    root.innerHTML = headHtml() + navHtml() + `<div class="pw-body">${intro}${body}</div>`
  }

  /* ---------------- 交互 ---------------- */

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
  }

  root.addEventListener('click', onClick)

  if (options.timer) {
    timerId = window.setInterval(() => {
      elapsed += 1
      const node = root.querySelector('[data-pw-timer]')
      if (node) node.textContent = formatClock(elapsed)
    }, 1000)
  }

  render()

  return {
    root,
    title: options.title || '',
    reset(): void {
      states.clear()
      step = 0
      render()
    },
    destroy(): void {
      if (timerId !== null) window.clearInterval(timerId)
      timerId = null
      root.removeEventListener('click', onClick)
      root.remove()
    }
  }
}
