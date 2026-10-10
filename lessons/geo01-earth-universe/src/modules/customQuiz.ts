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
     模块内自研渲染，不引入第三方库（贴合项目「优先原生」约定）。
   - 教师可用仓库 shared/custom-quiz-editor/index.html 可视化生成该数据文件。
   ============================================================ */

interface CqKnowledge {
  title?: string
  items?: string[]
}

interface CqOption {
  key: string
  text: string
}

interface CqChoice {
  id?: string
  type: 'choice'
  /** 单选（默认）/ 多选 */
  mode?: 'single' | 'multiple'
  source?: string
  material?: string
  stem: string
  options: CqOption[]
  /** 单选为 'A'，多选为 ['A','C'] */
  answer: string | string[]
  analysis?: string
  knowledge?: CqKnowledge
}

interface CqEssay {
  id?: string
  type: 'essay'
  source?: string
  material?: string
  /** 设问，可多条 */
  stems?: string | string[]
  referenceAnswer?: string
  analysis?: string
  criteria?: string[]
}

type CqQuestion = CqChoice | CqEssay

interface CqSection {
  id?: string
  title?: string
  questions?: CqQuestion[]
}

interface CqData {
  version?: number
  /** 数据最后更新时间（ISO 字符串，编辑器导出时写入） */
  updatedAt?: string
  lesson?: string
  title?: string
  subtitle?: string
  sections?: CqSection[]
}

/** 当前运行时支持的数据版本；数据 version 高于此值只提示、不阻断 */
const DATA_VERSION = 1

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

/* ---------------- Markdown 子集渲染 ---------------- */

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 行内语法：图片 → 链接 → 加粗 → 斜体 → 行内代码 */
function inlineMarkdown(value: string): string {
  let text = escapeHtml(value)
  text = text.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_m, alt: string, src: string) =>
      `<img class="cq-img" src="${src}" alt="${alt}" loading="lazy" decoding="async" />`
  )
  text = text.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label: string, href: string) =>
      `<a class="cq-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
  )
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  text = text.replace(/`([^`]+)`/g, '<code class="cq-code">$1</code>')
  return text
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line)
}

function isTableSep(line: string): boolean {
  return /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes('|')
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isBullet(line: string): boolean {
  return /^\s*[-*]\s+/.test(line)
}

function isOrdered(line: string): boolean {
  return /^\s*\d+[.、]\s+/.test(line)
}

/** 块级解析：表格 / 列表 / 段落，逐行扫描 */
function renderMarkdown(source?: string): string {
  if (!source) return ''
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }

    // 表格：当前行 + 下一行是分隔行
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line)
      let j = i + 2
      const rows: string[][] = []
      while (j < lines.length && isTableRow(lines[j])) {
        rows.push(splitRow(lines[j]))
        j++
      }
      blocks.push(
        `<div class="cq-table-wrap"><table class="cq-table"><thead><tr>${header
          .map((cell) => `<th>${inlineMarkdown(cell)}</th>`)
          .join('')}</tr></thead><tbody>${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`
      )
      i = j
      continue
    }

    if (isBullet(line)) {
      const items: string[] = []
      while (i < lines.length && isBullet(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push(`<ul class="cq-list">${items.map((t) => `<li>${inlineMarkdown(t)}</li>`).join('')}</ul>`)
      continue
    }

    if (isOrdered(line)) {
      const items: string[] = []
      while (i < lines.length && isOrdered(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.、]\s+/, ''))
        i++
      }
      blocks.push(
        `<ol class="cq-list cq-list--ordered">${items.map((t) => `<li>${inlineMarkdown(t)}</li>`).join('')}</ol>`
      )
      continue
    }

    // 段落：连续的非空、非表格、非列表行，行内换行用 <br>
    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isTableRow(lines[i]) &&
      !isBullet(lines[i]) &&
      !isOrdered(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push(`<p class="cq-p">${para.map(inlineMarkdown).join('<br>')}</p>`)
  }

  return blocks.join('')
}

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

/* ---------------- 数据校验 ---------------- */

/**
 * 结构校验：把外置数据收敛为可安全渲染的 CqData。
 * - 丢弃字段不完整的题目，并记录问题（issues）；
 * - 无任何有效题目时返回 data = null（触发空态而非白屏）。
 */
function validateQuizData(raw: unknown): { data: CqData | null; issues: string[] } {
  const issues: string[] = []
  if (!raw || typeof raw !== 'object') return { data: null, issues }

  const source = raw as CqData
  if (typeof source.version === 'number' && source.version > DATA_VERSION) {
    issues.push(`数据版本 v${source.version} 高于当前支持的 v${DATA_VERSION}，可能有未识别字段`)
  }
  if (!Array.isArray(source.sections)) {
    issues.push('缺少 sections 数组')
    return { data: null, issues }
  }

  const sections: CqSection[] = []
  source.sections.forEach((section, si) => {
    const secLabel = `第 ${si + 1} 节`
    if (!section || !Array.isArray(section.questions)) {
      issues.push(`${secLabel}缺少 questions 数组，已跳过`)
      return
    }
    const questions: CqQuestion[] = []
    section.questions.forEach((question, qi) => {
      const label = `${secLabel}第 ${qi + 1} 题`
      if (!question || (question.type !== 'choice' && question.type !== 'essay')) {
        issues.push(`${label} 题型缺失或非法，已跳过`)
        return
      }
      if (question.type === 'choice') {
        const options = (question.options ?? []).filter((option) => option && option.key)
        const keys = new Set(options.map((option) => option.key))
        const answers = (Array.isArray(question.answer) ? question.answer : [question.answer]).filter(
          (key) => typeof key === 'string' && keys.has(key)
        )
        if (!question.stem || options.length < 2 || !answers.length) {
          issues.push(`${label}（选择题）题干 / 选项 / 答案不完整，已跳过`)
          return
        }
        questions.push({
          ...question,
          options,
          answer: Array.isArray(question.answer) ? answers : answers[0]
        })
        return
      }
      const stems = Array.isArray(question.stems)
        ? question.stems.filter((stem) => typeof stem === 'string' && stem.trim())
        : question.stems
          ? [question.stems]
          : []
      if (!stems.length && !question.referenceAnswer) {
        issues.push(`${label}（综合题）缺少设问与参考答案，已跳过`)
        return
      }
      questions.push({ ...question, stems })
    })
    if (questions.length) sections.push({ ...section, questions })
    else issues.push(`${secLabel}无有效题目，已忽略`)
  })

  if (!sections.length) {
    if (!issues.length) issues.push('没有可用的题目')
    return { data: null, issues }
  }
  return { data: { ...source, sections }, issues }
}

/* ---------------- 启动 ---------------- */

function loadData(): Promise<CqData | null> {
  const globalWindow = window as unknown as { __CUSTOM_QUIZ__?: CqData }
  if (globalWindow.__CUSTOM_QUIZ__) return Promise.resolve(globalWindow.__CUSTOM_QUIZ__)
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = './custom-quiz.js'
    script.async = true
    script.onload = () => resolve(globalWindow.__CUSTOM_QUIZ__ ?? null)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}

export function initCustomQuiz(): void {
  host = document.getElementById('quiz-custom-body')
  if (!host) return

  document.querySelector('[data-cq-reset]')?.addEventListener('click', () => {
    states = new Map()
    renderAll()
  })

  host.addEventListener('click', onHostClick)

  void loadData().then((loaded) => {
    const result = validateQuizData(loaded)
    data = result.data
    dataIssues = result.issues
    if (result.issues.length) console.warn('[customQuiz] 数据校验提示：', result.issues)
    states = new Map()
    renderAll()
  })
}
