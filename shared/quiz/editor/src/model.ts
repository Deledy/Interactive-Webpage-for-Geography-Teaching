/* ============================================================
   编辑器 · 数据模型（纯函数，便于测试）
   ------------------------------------------------------------
   职责：
   - 旧 v2「每题自带材料」→ v3「题组共用材料」的内存迁移；
   - 编辑器内部结构归一化（布局、材料画布、折叠键）；
   - 导出时只写 v3 groups，不再双写扁平 questions，
     不再把组材料复制到每道题。

   说明：
   - `_k` 是编辑器内部折叠键，只存在于内存，导出时剔除；
   - 归一化会调用内容层的 validateMaterialLayout，保证脏数据不会进入编辑器。
   ============================================================ */
import type { CqGroup, CqQuestion, CqSection, MaterialLayout, PracticeModule } from '../../content/types'
import { createEmptyMaterialLayout } from '../../content/materialTypes'
import { materialLayoutFromHtml } from '../../content/materialConvert'
import { validateMaterialLayout } from '../../content/validateMaterial'
import { ensureQuestionIds, ensureSlot, pruneSlots } from '../../content/questionObjects'

export interface EditorGroup extends CqGroup {
  _k?: string
}

export interface EditorSection extends CqSection {
  _k?: string
  questions?: CqQuestion[]
}

export interface EditorModule extends PracticeModule {
  groups?: EditorGroup[]
}

export interface EditorState {
  version?: number
  lesson?: string
  updatedAt?: string
  modules: Record<string, EditorModule>
  postLesson?: {
    title?: string
    subtitle?: string
    sections: EditorSection[]
  }
}

type Loose = Record<string, unknown>

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isObject(value: unknown): value is Loose {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** 题组稳定键：只用于编辑器折叠 / 定位，导出时剔除 */
export function newGroupKey(): string {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function ensureGroupKey(group: unknown): string {
  if (isObject(group) && typeof group._k !== 'string') group._k = newGroupKey()
  return isObject(group) ? String(group._k ?? '') : ''
}

/** 丢弃无法解析的题目条目（草稿或导入数据可能混入字符串等脏值） */
export function validQuestions(list: unknown): CqQuestion[] {
  return (Array.isArray(list) ? list : []).filter((item) => {
    if (isObject(item)) return true
    if (typeof window !== 'undefined' && window.console) {
      console.warn('[内容编辑器] 已忽略无法解析的题目条目：', item)
    }
    return false
  }) as CqQuestion[]
}

export function newItem(kind: 'choice' | 'essay' | string): CqQuestion {
  if (kind === 'essay') {
    return { id: '', type: 'essay', stems: [''], referenceAnswer: '', analysis: '' } as CqQuestion
  }
  return {
    id: '',
    type: 'choice',
    stem: '',
    options: [
      { key: 'A', text: '' },
      { key: 'B', text: '' },
      { key: 'C', text: '' },
      { key: 'D', text: '' }
    ],
    answer: 'A',
    analysis: ''
  } as CqQuestion
}

/** 新题组：默认上下布局，材料为空白画布（编辑器不再使用富文本材料） */
export function newGroup(): EditorGroup {
  return {
    _k: newGroupKey(),
    id: '',
    layout: 'stacked',
    materialLayout: createEmptyMaterialLayout(),
    questions: []
  }
}

/** 把「每题自带材料」的扁平 questions 收敛为题组共用材料画布 */
export function toGroups(questions: unknown): EditorGroup[] {
  const groups: EditorGroup[] = []
  let last: EditorGroup | null = null
  let lastMaterial = ''

  validQuestions(questions).forEach((question) => {
    const copy = clone(question) as CqQuestion & { material?: string }
    const material = copy.material || ''
    delete copy.material
    if (last && lastMaterial === material) {
      last.questions.push(copy)
      return
    }
    lastMaterial = material
    last = {
      _k: newGroupKey(),
      id: '',
      layout: 'stacked',
      materialLayout: material ? materialLayoutFromHtml(material) : createEmptyMaterialLayout(),
      questions: [copy]
    }
    groups.push(last)
  })
  return groups
}

function normalizeMaterial(value: unknown): MaterialLayout | null {
  if (!value) return null
  const checked = validateMaterialLayout(value)
  return checked.layout
}

function normalizeGroup(group: EditorGroup): void {
  ensureGroupKey(group)
  if (group.layout !== 'split') group.layout = 'stacked'
  group.questions = validQuestions(group.questions)

  /* 兼容混合数据：组没有材料时，把第一道题的材料上提为组材料 */
  if (!group.material && !group.materialLayout) {
    const carrier = group.questions.find((question) => {
      const material = (question as CqQuestion & { material?: string }).material
      return typeof material === 'string' && material.trim()
    }) as (CqQuestion & { material?: string }) | undefined
    if (carrier && carrier.material) group.material = carrier.material
  }

  /* 旧 HTML 材料自动升级为自由布局；没有材料时给出空白画布，编辑器只保留画布 */
  const checked = normalizeMaterial(group.materialLayout)
  group.materialLayout = checked
    ? checked
    : group.material
      ? materialLayoutFromHtml(group.material)
      : createEmptyMaterialLayout()
  delete (group as CqGroup & { material?: string }).material

  group.questions.forEach((question) => {
    delete (question as CqQuestion & { material?: string }).material
  })

  /* v5：题目补 id；画布只保留材料与唯一题目槽 */
  group.questions = ensureQuestionIds(group.questions)
  const pruned = pruneSlots(group.materialLayout)
  group.materialLayout = ensureSlot(pruned.layout, group.questions.length > 0, group.questions[0]).layout
}

/** 归一化单个模块：v2 扁平题 → v3 题组（原地修改） */
export function normalizeModule(mod: EditorModule | undefined | null): void {
  if (!mod) return
  if (!Array.isArray(mod.groups)) {
    mod.groups = toGroups(mod.questions || [])
    delete mod.questions
  }
  mod.groups = mod.groups.filter((group) => isObject(group))
  mod.groups.forEach(normalizeGroup)
}

/** 归一化课后练习分节（原地返回新数组） */
export function normalizeSections(sections: unknown): EditorSection[] {
  const out: EditorSection[] = []
  ;(Array.isArray(sections) ? sections : []).forEach((raw) => {
    if (!isObject(raw)) return
    const section = raw as EditorSection
    const questions = validQuestions(section.questions)
    const hasOwnMaterial = typeof section.material === 'string' || !!section.materialLayout
    if (hasOwnMaterial || !questions.length) {
      section.questions = questions
      section.layout = section.layout === 'split' ? 'split' : 'stacked'
      ensureGroupKey(section)
      normalizeGroup(section as EditorGroup)
      out.push(section)
      return
    }
    toGroups(questions).forEach((group, index) => {
      out.push({
        id: section.id ? section.id + (index ? '-' + (index + 1) : '') : '',
        title: section.title || '',
        layout: group.layout,
        materialLayout: group.materialLayout,
        questions: group.questions,
        _k: group._k
      })
    })
  })
  return out
}

/** 统一迁移内存中的草稿 / 导入数据（原地修改） */
export function normalizeState(state: EditorState | null | undefined): void {
  if (!state) return
  state.modules = state.modules || {}
  Object.keys(state.modules).forEach((id) => normalizeModule(state.modules[id]))
  if (state.postLesson) {
    state.postLesson.sections = normalizeSections(state.postLesson.sections || [])
    state.postLesson.sections.forEach((section) => ensureGroupKey(section))
  }
}

function cleanQuestion(question: CqQuestion): CqQuestion {
  const copy = clone(question) as CqQuestion & { material?: string; _k?: string }
  delete copy._k
  /* 材料由题组统一持有，题目不再落盘 material */
  delete copy.material
  return copy
}

function cleanGroup(group: EditorGroup): Loose {
  const out: Loose = {}
  if (group.id) out.id = group.id
  out.layout = group.layout === 'split' ? 'split' : 'stacked'

  /* 不再导出富文本材料；空画布也不落盘，避免课程端出现空白材料块 */
  const layout =
    group.materialLayout && group.materialLayout.objects.length
      ? group.materialLayout
      : group.material
        ? materialLayoutFromHtml(group.material)
        : null
  if (layout && layout.objects.length) out.materialLayout = clone(layout)

  /* 导出兜底：即使调用方没走 normalizeState，也要保证题目有稳定 id */
  out.questions = ensureQuestionIds(group.questions.map(cleanQuestion))
  return out
}

/**
 * 生成正式 v4 题库对象：
 * - modules 只写 groups，不再写扁平 questions；
 * - 题组材料只保存一份；
 * - 题目有稳定 id，题目对象通过 questionId 引用；
 * - 剔除编辑器内部 `_k`。
 */
export function buildPracticeData(
  state: EditorState,
  meta: { lesson?: string } = {}
): Record<string, unknown> {
  const modules: Record<string, unknown> = {}
  Object.keys(state.modules || {}).forEach((id) => {
    const mod = state.modules[id]
    if (!mod) return
    const groups = (mod.groups || []).filter(
      (group) => group && Array.isArray(group.questions) && group.questions.length
    )
    if (!groups.length) return
    const out: Loose = {}
    if (mod.title) out.title = mod.title
    if (mod.intro) out.intro = mod.intro
    out.groups = groups.map(cleanGroup)
    modules[id] = out
  })

  const payload: Loose = {
    version: 5,
    lesson: state.lesson || meta.lesson || '',
    updatedAt: new Date().toISOString(),
    modules
  }

  if (state.postLesson) {
    payload.postLesson = {
      title: state.postLesson.title || '',
      subtitle: state.postLesson.subtitle || '',
      sections: (state.postLesson.sections || []).map((section) => cleanGroup(section as EditorGroup))
    }
  }

  return payload
}

/** 导出为经典脚本文本（离线 file:// 注入） */
export function serializePracticeData(payload: unknown, globalName = '__PRACTICE_DATA__'): string {
  return (
    '/* Generated by Content Editor */\n' +
    'window.' + globalName + ' = ' + JSON.stringify(payload, null, 2) + ';\n'
  )
}
