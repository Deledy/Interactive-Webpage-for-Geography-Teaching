/* ============================================================
   PracticeWindow · 结构校验与版本协商
   ------------------------------------------------------------
   把外置数据收敛为可安全渲染的结构（题级 / 模块级 / 题库级）：
   - 逐题校验：选择题需「题干 + ≥2 选项 + 有效答案（答案键须落在选项内）」；
     综合题需「设问或参考答案」；非法题丢弃并记录问题（issues）。
   - 模块级校验：kind:'drag' 只保留占位；无有效题则视为缺失。
   - 版本：数据 version 高于支持上限 → 仅提示、不阻断。
   - 无任何有效题目时 data = null（消费方渲染空态，不白屏）。
   本文件是「统一 schema 校验」的单一真源，课程侧（practiceStore 等）应复用而非重写。
   ============================================================ */
import type { CqChoice, CqData, CqEssay, CqQuestion, CqSection, PracticeModule } from './types'

/** 当前组件支持的数据版本 */
export const DATA_VERSION = 1

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

/**
 * 题库校验：把外置数据收敛为可安全渲染的 CqData。
 * - 丢弃字段不完整的题目并记录问题；
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

/** 便捷：把「单节题目数组」包装成 CqData 结构（模块随堂练习用） */
export function sectionsFromQuestions(title: string | undefined, subtitle: string | undefined, questions: CqQuestion[]): CqData {
  return { title, subtitle, sections: [{ questions }] }
}

/**
 * 单模块校验（随堂练习用）：过滤非法题，无有效题则视为缺失（返回 undefined）。
 * kind:'drag' 为特殊题型占位，内容由课程页面自行提供，此处只保留占位信息。
 */
export function validateModulePractice(raw: unknown): { module?: PracticeModule; issues: string[] } {
  const issues: string[] = []
  if (!raw || typeof raw !== 'object') return { issues }
  const source = raw as PracticeModule
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
