/* ============================================================
   内容层 · 数据契约
   ------------------------------------------------------------
   —— 与课程 src/types.ts 的统一题型结构保持一致（结构化兼容，可直接传入课程数据）。
   本文件是「内容契约」的唯一真源：运行时（runtime）与编辑器（editor）都引用这里，
   不再各自维护一份。
   详见 shared/quiz/docs/2026-10-17-quiz-card-wysiwyg-design.md §5。
   ============================================================ */

export interface CqOption {
  key: string
  text: string
}

export interface CqKnowledge {
  title?: string
  items?: string[]
}

/** 选择题（单选；mode 仅为遗留多选数据保留） */
export interface CqChoice {
  id?: string
  type: 'choice'
  /** 遗留字段：编辑器只产出单选，运行时仅兼容旧数据 */
  mode?: 'single' | 'multiple'
  /** 遗留字段：不再渲染 */
  source?: string
  /** 材料（HTML，关键词用 <mark class="cq-hl">） */
  material?: string
  /** 题干 */
  stem: string
  options: CqOption[]
  /** 编辑器产出单个字母 'A'；数组仅用于遗留多选数据 */
  answer: string | string[]
  /** 解析（HTML） */
  analysis?: string
  /** 遗留字段：不再渲染 */
  knowledge?: CqKnowledge
}

/** 主观题 */
export interface CqEssay {
  id?: string
  type: 'essay'
  /** 遗留字段：不再渲染 */
  source?: string
  material?: string
  /** 设问，可多条 */
  stems?: string | string[]
  /** 参考答案（HTML） */
  referenceAnswer?: string
  analysis?: string
  /** 遗留字段：不再渲染 */
  criteria?: string[]
}

export type CqQuestion = CqChoice | CqEssay

/**
 * 题组：一则材料统领多道题目。
 * 材料写在题组上，组内题目不再重复携带 material。
 */
export interface CqGroup {
  id?: string
  /** 材料（HTML，关键词用 <mark class="cq-hl">） */
  material?: string
  questions: CqQuestion[]
}

/** 题目分组（如「一、选择题」） */
export interface CqSection {
  id?: string
  title?: string
  /** 本节共用材料（HTML）；居中渲染一次 */
  material?: string
  questions?: CqQuestion[]
}

/** 单个模块的随堂练习；kind:'drag' 表示特殊题型（拖拽题），内容由课程页面自行提供 */
export interface PracticeModule {
  title?: string
  intro?: string
  kind?: 'choice' | 'drag'
  /** 题组（优先渲染；groups 与 questions 同时存在时以 groups 为准） */
  groups?: CqGroup[]
  /** 扁平题目（兼容旧数据；无 groups 时使用） */
  questions?: CqQuestion[]
}

/** 题库数据（课后练习） */
export interface CqData {
  version?: number
  updatedAt?: string
  lesson?: string
  title?: string
  subtitle?: string
  sections?: CqSection[]
}
