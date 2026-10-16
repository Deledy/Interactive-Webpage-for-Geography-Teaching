/* ============================================================
   PracticeWindow · 数据模型
   —— 与课程 src/types.ts 的统一题型结构保持一致（结构化兼容，可直接传入课程数据）。
   详见 shared/practice-window/docs/通用练习窗口_开发文档.md §6。
   ============================================================ */

export interface CqOption {
  key: string
  text: string
}

export interface CqKnowledge {
  title?: string
  items?: string[]
}

/** 选择题（单选 / 多选） */
export interface CqChoice {
  id?: string
  type: 'choice'
  /** 单选（默认）/ 多选 */
  mode?: 'single' | 'multiple'
  /** 题源标注，可空 */
  source?: string
  /** 材料（富文本，支持 ==关键词高亮==） */
  material?: string
  /** 题干 */
  stem: string
  options: CqOption[]
  /** 单选为 'A'，多选为 ['A','C'] */
  answer: string | string[]
  /** 解析（富文本） */
  analysis?: string
  knowledge?: CqKnowledge
}

/** 综合题 */
export interface CqEssay {
  id?: string
  type: 'essay'
  source?: string
  material?: string
  /** 设问，可多条 */
  stems?: string | string[]
  /** 参考答案 */
  referenceAnswer?: string
  analysis?: string
  /** 评分标准 */
  criteria?: string[]
}

export type CqQuestion = CqChoice | CqEssay

/** 题目分组（如「一、选择题」） */
export interface CqSection {
  id?: string
  title?: string
  questions?: CqQuestion[]
}

/** 单个模块的随堂练习；kind:'drag' 表示特殊题型（拖拽题），内容由课程页面自行提供 */
export interface PracticeModule {
  title?: string
  intro?: string
  kind?: 'choice' | 'drag'
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
