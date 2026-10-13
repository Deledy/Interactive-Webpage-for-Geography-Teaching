/* ============================================================
   自定义练习（M10）
   ------------------------------------------------------------
   定位：给「分发之后」的教师留一个可自行设题的练习模块（高中题型：选择题 / 综合题）。

   数据外置：
   - 题目数据来自本课 public/custom-quiz.js（构建时原样复制到 dist 根目录，与 index.html 同级）。
   - 加载方式刻意不用 fetch/JSON：file:// 双击打开时 fetch 会被 CORS 拦截；
     改为动态注入经典 <script src>，由数据文件把内容挂到 window.__CUSTOM_QUIZ__。
   - 文件缺失或题目为空 → 渲染「暂未配置」空态，不影响其它模块。

   内容格式：
   - 支持 Markdown 子集（**加粗**、![图](路径)、GFM 表格、有序/无序列表），
     由 src/utils/markdown.ts 统一渲染（与随堂练习共用，不引入第三方库）。
   - 教师可用仓库 shared/custom-quiz-editor/index.html 可视化生成该数据文件。

   数据源优先级（详见 shared/custom-quiz-editor/docs 开发文档 §19）：
   - 优先读取统一数据文件 practice-data.js 的 postLesson（可编辑真源）；
   - 旧 custom-quiz.js（window.__CUSTOM_QUIZ__）作为兼容回退保留一个版本。
   ============================================================ */

/* 题型与数据结构统一在 src/types.ts 定义（模块随堂练习与课后练习共用一套 schema） */
import type { CqChoice, CqData, CqEssay, CqQuestion } from '../types'
import { escapeHtml, inlineMarkdown, renderMarkdown } from '../utils/markdown'
import { getPracticeData, loadPracticeData, validateQuizData } from './practiceStore'

/** 每题的作答状态：选择题记录已选项与是否已提交；综合题记录是否已展开答案 */
interface CqItemState {
  selected: string[]
  submitted: boolean
  revealed: boolean
}

const CHOICE_BADGE: Record<'single' | 'multiple', string> = {
  single: '单选题',
  multiple: '多选题'
}

let host: HTMLElement | null = null
let data: CqData | null = null
let states = new Map<string, CqItemState>()
/** 最近一次数据校验产生的问题（非空时表示数据被裁剪或忽略） */
let dataIssues: string[] = []

/* ---------------- 状态 ---------------- */

function itemState(key: string): CqItemState {
  let state = states.get(key)
  if (!state) {
    state = { selected: [], submitted: false, revealed: false }
    states.set(key, state)
  }
  return state
}

function answerKeys(question: CqChoice): string[] {
  return Array.isArray(question.answer) ? question.answer : [question.answer]
}

function isChoiceCorrect(question: CqChoice, selected: string[]): boolean {
  const expected = answerKeys(question).slice().sort()
  const actual = selected.slice().sort()
  return expected.length === actual.length && expected.every((key, index) => key === actual[index])
}

/* ---------------- 渲染 ---------------- */

let seqNo = 0

function optionClass(question: CqChoice, state: CqItemState, key: string): string {
  const cls = ['cq-opt']
  if (!state.submitted) {
    if (state.selected.includes(key)) cls.push('is-selected')
    return cls.join(' ')
  }
  const correct = answerKeys(question)
  if (correct.includes(key)) cls.push('is-correct')
  else if (state.selected.includes(key)) cls.push('is-wrong')
  else cls.push('is-dim')
  return cls.join(' ')
}

function choiceHtml(question: CqChoice, key: string): string {
  const mode = question.mode === 'multiple' ? 'multiple' : 'single'
  const state = itemState(key)
  const revealed = state.submitted
  const options = question.options
    .map(
      (opt) =>
        `<button type="button" class="${optionClass(question, state, opt.key)}" data-cq-opt="${key}" data-key="${opt.key}"${
          revealed ? ' disabled' : ''
        }${state.selected.includes(opt.key) ? ' aria-pressed="true"' : ' aria-pressed="false"'}>
          <span class="cq-opt__key">${escapeHtml(opt.key)}</span>
          <span class="cq-opt__text">${inlineMarkdown(opt.text)}</span>
        </button>`
    )
    .join('')

  const verdict = !revealed
    ? ''
    : `<div class="cq-verdict ${isChoiceCorrect(question, state.selected) ? 'is-right' : 'is-wrong'}">
        <span class="cq-verdict__title">${
          isChoiceCorrect(question, state.selected) ? '回答正确' : '回答错误'
        }</span>
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
    mode === 'multiple' && !revealed
      ? `<div class="cq-q__actions">
          <button type="button" class="btn btn--primary cq-submit" data-cq-submit="${key}"${
            state.selected.length ? '' : ' disabled'
          }>提交答案</button>
        </div>`
      : ''

  return `<article class="cq-q" data-q="${key}" data-type="choice">
    <div class="cq-q__head">
      <span class="cq-q__no">${seqNo++}</span>
      <span class="cq-q__badge">${CHOICE_BADGE[mode]}</span>
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
  const state = itemState(key)
  const stems = Array.isArray(question.stems) ? question.stems : question.stems ? [question.stems] : []

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
      <span class="cq-q__no">${seqNo++}</span>
      <span class="cq-q__badge cq-q__badge--essay">综合题</span>
      ${question.source ? `<span class="cq-q__source">${escapeHtml(question.source)}</span>` : ''}
    </div>
    ${question.material ? `<div class="cq-q__material">${renderMarkdown(question.material)}</div>` : ''}
    ${
      stems.length
        ? `<ol class="cq-stems">${stems.map((stem) => `<li>${inlineMarkdown(stem)}</li>`).join('')}</ol>`
        : ''
    }
    <div class="cq-q__actions">
      <button type="button" class="btn ${state.revealed ? 'btn--ghost' : 'btn--primary'} cq-reveal" data-cq-reveal="${key}">
        ${state.revealed ? '收起参考答案' : '查看参考答案'}
      </button>
    </div>
    ${detail}
  </article>`
}

function questionHtml(question: CqQuestion, key: string): string {
  if (question.type === 'essay') return essayHtml(question, key)
  return choiceHtml(question, key)
}

function emptyHtml(reason: 'missing' | 'invalid', issues: string[]): string {
  if (reason === 'invalid') {
    const list = issues.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    return `<div class="cq-empty panel">
      <p class="cq-empty__title">自定义练习数据格式有误，已忽略</p>
      <p class="cq-empty__text">检测到 <code class="cq-code">custom-quiz.js</code> 存在无法解析的内容，不完整的题目已跳过，页面其它模块不受影响。请用「自定义练习编辑器」修正后重新导出。</p>
      ${list ? `<ul class="cq-empty__issues">${list}</ul>` : ''}
    </div>`
  }
  return `<div class="cq-empty panel">
    <p class="cq-empty__title">本节课暂未配置自定义练习</p>
    <p class="cq-empty__text">教师可在本页面（index.html）同级目录放置 <code class="cq-code">custom-quiz.js</code> 以按学情设置题目；可用仓库中的「自定义练习编辑器」（shared/custom-quiz-editor/index.html）可视化生成该文件。</p>
  </div>`
}

function renderEmpty(reason: 'missing' | 'invalid', issues: string[] = []): void {
  if (!host) return
  host.innerHTML = emptyHtml(reason, issues)
}

/** 渲染入口：任何异常都回退空态，避免白屏 */
function renderAll(): void {
  if (!host) return
  try {
    renderQuiz()
  } catch (error) {
    console.error('[customQuiz] 渲染失败，已回退空态', error)
    data = null
    renderEmpty('invalid', ['渲染过程中发生错误，数据可能已损坏'])
  }
}

function renderQuiz(): void {
  const sections = (data?.sections ?? []).filter((section) => section.questions?.length)
  if (!sections.length) {
    renderEmpty(dataIssues.length ? 'invalid' : 'missing', dataIssues)
    return
  }
  if (!host) return
  seqNo = 1
  const intro = data?.subtitle
    ? `<p class="cq-intro">${inlineMarkdown(data.subtitle)}</p>`
    : ''
  host.innerHTML =
    intro +
    sections
      .map(
        (section) =>
          `<section class="cq-sec">
            ${section.title ? `<h3 class="cq-sec__title">${inlineMarkdown(section.title)}</h3>` : ''}
            <div class="cq-sec__qs">${(section.questions ?? [])
              .map((question, index) => questionHtml(question, `${section.id ?? 's'}-${index}`))
              .join('')}</div>
          </section>`
      )
      .join('')
}

/* ---------------- 交互 ---------------- */

function findQuestion(key: string): CqQuestion | null {
  for (const section of data?.sections ?? []) {
    for (let index = 0; index < (section.questions?.length ?? 0); index++) {
      if (`${section.id ?? 's'}-${index}` === key) return section.questions![index]
    }
  }
  return null
}

function onHostClick(event: Event): void {
  const target = event.target as HTMLElement

  const option = target.closest<HTMLButtonElement>('[data-cq-opt]')
  if (option) {
    const key = option.dataset.cqOpt ?? ''
    const question = findQuestion(key)
    if (!question || question.type !== 'choice') return
    const state = itemState(key)
    if (state.submitted) return
    const picked = option.dataset.key ?? ''
    if (question.mode === 'multiple') {
      state.selected = state.selected.includes(picked)
        ? state.selected.filter((item) => item !== picked)
        : [...state.selected, picked]
    } else {
      state.selected = [picked]
      state.submitted = true
    }
    renderAll()
    return
  }

  const submit = target.closest<HTMLButtonElement>('[data-cq-submit]')
  if (submit) {
    const key = submit.dataset.cqSubmit ?? ''
    const state = itemState(key)
    if (state.selected.length) {
      state.submitted = true
      renderAll()
    }
    return
  }

  const reveal = target.closest<HTMLButtonElement>('[data-cq-reveal]')
  if (reveal) {
    const key = reveal.dataset.cqReveal ?? ''
    const state = itemState(key)
    state.revealed = !state.revealed
    renderAll()
  }
}

/* ---------------- 启动 ---------------- */

/** 兼容回退：注入旧 custom-quiz.js（内容挂到 window.__CUSTOM_QUIZ__）。 */
function loadLegacyViaScript(): Promise<CqData | null> {
  const globalWindow = window as unknown as { __CUSTOM_QUIZ__?: CqData }
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = './custom-quiz.js'
    script.async = true
    script.onload = () => resolve(globalWindow.__CUSTOM_QUIZ__ ?? null)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}

/**
 * 解析课后练习数据（优先级见文件头注释）：
 * 1) 统一数据文件 practice-data.js 的 postLesson（可编辑真源）；
 * 2) 旧 custom-quiz.js 注入的 window.__CUSTOM_QUIZ__（兼容回退）。
 * 刻意先同步检查已有数据，避免在无脚本环境的测试中 await 挂起。
 */
async function resolveData(): Promise<CqData | null> {
  const ready = getPracticeData()
  if (ready) return ready.postLesson ?? null

  const globalWindow = window as unknown as { __CUSTOM_QUIZ__?: CqData }
  if (globalWindow.__CUSTOM_QUIZ__ !== undefined) return globalWindow.__CUSTOM_QUIZ__

  const store = await loadPracticeData()
  if (store) return store.postLesson ?? null
  return loadLegacyViaScript()
}

export function initCustomQuiz(): void {
  host = document.getElementById('quiz-custom-body')
  if (!host) return

  document.querySelector('[data-cq-reset]')?.addEventListener('click', () => {
    states = new Map()
    renderAll()
  })

  host.addEventListener('click', onHostClick)

  void resolveData().then((loaded) => {
    const result = validateQuizData(loaded)
    data = result.data
    dataIssues = result.issues
    if (result.issues.length) console.warn('[customQuiz] 数据校验提示：', result.issues)
    states = new Map()
    renderAll()
  })
}
