/* ============================================================
   内容层 · 题目槽模型助手
   ------------------------------------------------------------
   一题组 = 一张画布；画布内最多一个题目槽（type:'slot'）。
   题目数据仍在 group.questions[]，槽只保存位置 / 尺寸 / 选项排列；
   编辑器与运行时通过「当前第几题」决定槽里显示哪道题。
   ============================================================ */
import type { MaterialLayout, SlotMaterialObject } from './materialTypes'
import type { CqQuestion, OptionLayout } from './types'

export const DEFAULT_QUESTION_OPTION_LAYOUT: OptionLayout = { mode: 'flow', columns: 2 }

/** 题目槽宽度：整宽或半宽（半宽用于左右并排两道题） */
export function slotWidth(layout: MaterialLayout, half = false): number {
  const full = Math.max(240, layout.width - 48)
  return half ? Math.max(200, Math.floor((full - 16) / 2)) : full
}

/** 为缺失 id 的题目补齐稳定 id（同一题组内唯一） */
export function ensureQuestionIds(questions: CqQuestion[]): CqQuestion[] {
  const used = new Set<string>()
  const out: CqQuestion[] = []
  questions.forEach((question, index) => {
    const raw = typeof question.id === 'string' ? question.id.trim() : ''
    let id = raw
    if (!id || used.has(id)) {
      let next = index + 1
      while (used.has(`q-${next}`)) next += 1
      id = `q-${next}`
    }
    used.add(id)
    out.push(question.id === id ? question : { ...question, id })
  })
  return out
}

/** 生成一个不与现有题目冲突的 id */
export function nextQuestionId(questions: CqQuestion[]): string {
  const used = new Set(questions.map((question) => question.id).filter(Boolean) as string[])
  let next = questions.length + 1
  while (used.has(`q-${next}`)) next += 1
  return `q-${next}`
}

/** 画布中的题目槽（最多一个） */
export function slotObject(layout: MaterialLayout | null | undefined): SlotMaterialObject | null {
  if (!layout) return null
  return (layout.objects.find((object) => object.type === 'slot') as SlotMaterialObject | undefined) ?? null
}

/** 只保留第一个题目槽，其余丢弃 */
export function pruneSlots(layout: MaterialLayout): { layout: MaterialLayout; issues: string[] } {
  const issues: string[] = []
  let seen = false
  const objects = layout.objects.filter((object) => {
    if (object.type !== 'slot') return true
    if (seen) {
      issues.push(`题目槽「${object.id}」重复，已忽略（一个题组只保留一个槽）`)
      return false
    }
    seen = true
    return true
  })
  if (objects.length === layout.objects.length) return { layout, issues }
  return { layout: { ...layout, objects }, issues }
}

/** 估算题目在槽内所需高度 */
export function estimateQuestionHeight(question: CqQuestion, width: number): number {
  const charsPerLine = Math.max(10, Math.floor((width - 32) / 20))
  if (question.type === 'essay') {
    const stems = Array.isArray(question.stems) ? question.stems : question.stems ? [question.stems] : []
    const lines = stems.reduce((sum, stem) => sum + Math.max(1, Math.ceil(String(stem).length / charsPerLine)), 0)
    return Math.round(56 + Math.max(1, lines) * 32 + 64 + 24)
  }
  const stemLines = Math.max(1, Math.ceil(String(question.stem || '').length / charsPerLine))
  const columns = 2
  const optionRows = Math.max(1, Math.ceil((question.options?.length || 0) / columns))
  return Math.round(56 + stemLines * 32 + optionRows * 56 + 24)
}

/** 题目槽默认矩形：排在所有材料对象下方 */
export function defaultSlotRect(
  layout: MaterialLayout,
  question?: CqQuestion
): { x: number; y: number; width: number; height: number } {
  const width = slotWidth(layout)
  const height = question ? estimateQuestionHeight(question, width) : 200
  const bottom = layout.objects
    .filter((object) => object.type !== 'slot')
    .reduce((max, object) => Math.max(max, object.y + object.height), 0)
  const y = Math.max(24, bottom + (bottom ? 24 : 0))
  return { x: 24, y, width, height }
}

/**
 * 确保题组画布里有题目槽：
 * - 有题目、没有槽 → 新建一个（默认在材料下方）；
 * - 已有槽 → 原样保留；
 * - 没有题目且没有槽 → 不创建。
 */
export function ensureSlot(
  layout: MaterialLayout,
  hasQuestions: boolean,
  question?: CqQuestion
): { layout: MaterialLayout; slot: SlotMaterialObject | null; created: boolean } {
  const existing = slotObject(layout)
  if (existing) return { layout, slot: existing, created: false }
  if (!hasQuestions) return { layout, slot: null, created: false }
  const rect = defaultSlotRect(layout, question)
  const slot: SlotMaterialObject = {
    id: 'slot-1',
    type: 'slot',
    ...rect,
    optionLayout: { ...DEFAULT_QUESTION_OPTION_LAYOUT }
  }
  const next: MaterialLayout = {
    ...layout,
    /* 画布尺寸固定：槽超出时不再自动抬高画布，由编辑器提示裁切 */
    objects: [...layout.objects, slot]
  }
  return { layout: next, slot, created: true }
}

/** 选择题 / 主观题互转：保留 id 与解析，题干与设问互相继承 */
export function convertQuestionKind(question: CqQuestion, type: 'choice' | 'essay'): CqQuestion {
  if (question.type === type) return question
  if (type === 'essay') {
    const stem = question.type === 'choice' ? question.stem || '' : ''
    return {
      id: question.id,
      type: 'essay',
      stems: [stem],
      referenceAnswer: '',
      analysis: question.analysis || ''
    }
  }
  const source = question as { stems?: string | string[] }
  const stems = Array.isArray(source.stems) ? source.stems : source.stems ? [source.stems] : []
  return {
    id: question.id,
    type: 'choice',
    mode: 'single',
    stem: stems[0] || '',
    options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: '' })),
    answer: 'A',
    analysis: question.analysis || ''
  }
}

/** 复制题目（保留内容，换新 id） */
export function duplicateQuestion(question: CqQuestion, id: string): CqQuestion {
  const copy = JSON.parse(JSON.stringify(question)) as CqQuestion
  return { ...copy, id }
}
