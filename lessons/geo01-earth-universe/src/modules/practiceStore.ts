/* ============================================================
   随堂练习数据仓库（可编辑真源：public/practice-data.js）
   ------------------------------------------------------------
   - 加载方式与 custom-quiz.js 一致：动态注入经典 <script src>，由数据文件把内容挂到
     window.__PRACTICE_DATA__。刻意不用 fetch/JSON——file:// 双击分发时 fetch 会被 CORS 拦截。
   - 数据真源优先级：window.__PRACTICE_DATA__（外置，可编辑）→ lessonData.practices（源码内置回退）。
   - 结构校验：丢弃字段不完整的题目并记录问题（非阻断）；缺数据 / 损坏时消费方自行回退，不白屏。
   - 运行时无需读取 lesson-manifest.js：模块 id 由消费方从段元素（closest('section').id）直接取得。
   ============================================================ */
import type { CqChoice, CqData, CqEssay, CqQuestion, CqSection, PracticeData, PracticeModule } from '../types'

/** 当前运行时支持的数据版本；数据 version 高于此值只提示、不阻断 */
export const DATA_VERSION = 1

const PRACTICE_GLOBAL = '__PRACTICE_DATA__'

/** 已加载的数据快照（同步读取入口，供 practiceModal 在点击时即时使用） */
let loaded: PracticeData | null = null
/** 进行中的加载 Promise（幂等：多次调用共用一个） */
let loading: Promise<PracticeData | null> | null = null

function practiceGlobal(): Record<string, unknown> {
  return window as unknown as Record<string, unknown>
}

/** 版本提示（非阻断）：数据版本高于运行时支持上限时打印一次警告 */
function warnVersion(data: PracticeData): void {
  if (typeof data.version === 'number' && data.version > DATA_VERSION) {
    console.warn(`[practiceStore] 数据版本 v${data.version} 高于当前支持的 v${DATA_VERSION}，可能有未识别字段`)
  }
}

/** 加载 ./practice-data.js（幂等；缺失返回 null） */
export function loadPracticeData(): Promise<PracticeData | null> {
  if (loaded) return Promise.resolve(loaded)
  if (loading) return loading

  const existing = practiceGlobal()[PRACTICE_GLOBAL] as PracticeData | undefined
  if (existing) {
    loaded = existing
    warnVersion(existing)
    return Promise.resolve(loaded)
  }

  loading = new Promise<PracticeData | null>((resolve) => {
    const script = document.createElement('script')
    script.src = './practice-data.js'
    script.async = true
    script.onload = () => {
      const data = (practiceGlobal()[PRACTICE_GLOBAL] as PracticeData | undefined) ?? null
      loaded = data
      if (data) warnVersion(data)
      resolve(data)
    }
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
  return loading
}

/** 同步读取已加载的数据快照（未加载返回 null，不触发加载） */
export function getPracticeData(): PracticeData | null {
  return loaded
}

/** 课后练习（沿用 CqData 的 title / subtitle / sections 结构） */
export function getPostLesson(): CqData | null {
  return loaded?.postLesson ? ({ ...loaded.postLesson } as CqData) : null
}

/** 取出并校验单个模块的随堂练习（id 优先，未命中用兼容键兜底） */
export function getModulePractice(...keys: string[]): PracticeModule | undefined {
  const modules = loaded?.modules
  if (!modules) return undefined
  for (const key of keys) {
    if (!key) continue
    const raw = modules[key]
    if (!raw) continue
    const result = validateModulePractice(raw)
    if (result.issues.length) console.warn('[practiceStore] 模块练习数据校验提示：', result.issues)
    if (result.module) return result.module
  }
  return undefined
}

/* ---------------- 结构校验 ---------------- */

function validateChoiceQuestion(question: CqChoice, label: string, issues: string[]): CqChoice | null {
  const options = (question.options ?? []).filter((option) => option && option.key)
  const keys = new Set(options.map((option) => option.key))
  const answers = (Array.isArray(question.answer) ? question.answer : [question.answer]).filter(
    (key): key is string => typeof key === 'string' && keys.has(key)
  )
  if (!question.stem || options.length < 2 || !answers.length) {
    issues.push(`${label}（选择题）题干 / 选项 / 答案不完整，已跳过`)
    return null
  }
  return { ...question, options, answer: Array.isArray(question.answer) ? answers : answers[0] }
}

function validateEssayQuestion(question: CqEssay, label: string, issues: string[]): CqEssay | null {
  const stems = Array.isArray(question.stems)
    ? question.stems.filter((stem) => typeof stem === 'string' && stem.trim())
    : question.stems
      ? [question.stems]
      : []
  if (!stems.length && !question.referenceAnswer) {
    issues.push(`${label}（综合题）缺少设问与参考答案，已跳过`)
    return null
  }
  return { ...question, stems }
}

/** 单题校验：题型非法或字段不完整时返回 null 并记录问题 */
export function validateQuestion(question: CqQuestion, label: string, issues: string[]): CqQuestion | null {
  if (!question || (question.type !== 'choice' && question.type !== 'essay')) {
    issues.push(`${label} 题型缺失或非法，已跳过`)
    return null
  }
  return question.type === 'choice'
    ? validateChoiceQuestion(question, label, issues)
    : validateEssayQuestion(question, label, issues)
}

/** 单模块校验：过滤非法题，无有效题则视为缺失（返回 undefined） */
export function validateModulePractice(raw: unknown): { module?: PracticeModule; issues: string[] } {
  const issues: string[] = []
  if (!raw || typeof raw !== 'object') return { issues }
  const source = raw as PracticeModule
  // 拖拽题（kind:'drag'）：内容由源码提供，此处只保留占位信息
  if (source.kind === 'drag') return { module: { ...source, kind: 'drag' }, issues }
  if (!Array.isArray(source.questions)) return { module: { ...source }, issues }
  const questions: CqQuestion[] = []
  source.questions.forEach((question, index) => {
    const valid = validateQuestion(question, `第 ${index + 1} 题`, issues)
    if (valid) questions.push(valid)
  })
  if (!questions.length) {
    issues.push('无有效题目，已忽略')
    return { issues }
  }
  return { module: { ...source, questions }, issues }
}

/**
 * 题库校验（课后练习 / CqData）：把外置数据收敛为可安全渲染的 CqData。
 * - 丢弃字段不完整的题目，并记录问题（issues）；
 * - 无任何有效题目时返回 data = null（触发空态而非白屏）。
 */
export function validateQuizData(raw: unknown): { data: CqData | null; issues: string[] } {
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
  // sections 为空是"尚未配置题目"的正常状态（而非数据损坏）→ 走友好空态
  if (source.sections.length === 0) return { data: null, issues }

  const sections: CqSection[] = []
  source.sections.forEach((section, si) => {
    const secLabel = `第 ${si + 1} 节`
    if (!section || !Array.isArray(section.questions)) {
      issues.push(`${secLabel}缺少 questions 数组，已跳过`)
      return
    }
    const questions: CqQuestion[] = []
    section.questions.forEach((question, qi) => {
      const valid = validateQuestion(question, `${secLabel}第 ${qi + 1} 题`, issues)
      if (valid) questions.push(valid)
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
