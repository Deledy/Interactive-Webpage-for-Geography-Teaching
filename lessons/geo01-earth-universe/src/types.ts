/* ============================================================
   课程数据结构类型定义
   与 src/data/lessonData.ts 一一对应，供全站模块共享类型约束。
   ============================================================ */

export interface Meta {
  title: string
  grade: string
  lesson: string
}

/** M1 宇宙概念 · 逐级放大层级 */
export interface ScaleLevel {
  id: string
  name: string
  desc: string
}

export interface UniverseData {
  intro: string
  scaleLevels: ScaleLevel[]
}

/** M3 流星案例 */
export interface MeteorStep {
  title: string
  desc: string
}

export interface Condition {
  key: string
  desc: string
}

export interface MeteorCase {
  steps: MeteorStep[]
  conditions: Condition[]
  conclusion: string
}

/** M3 拖拽分类案例卡 */
export interface DragCard {
  id: string
  name: string
  type: 'celestial' | 'non'
  explain: string
}

/** M4 天体系统层级 */
export interface HierarchyLevel {
  id: string
  name: string
  content: string
  example: string
}

/** M5 八大行星分类键（对应类地 / 巨 / 远日三组，用于分类主题色） */
export type PlanetTypeKey = 'terrestrial' | 'giant' | 'outer'

/** M5 八大行星 */
export interface Planet {
  id: string
  name: string
  number: string        /* 顺序序号，如 "01" */
  type: string          /* 分类名称，如 "类地行星" */
  typeKey: PlanetTypeKey
  color: string
  size: number
  orbit: number
  period: number
  distance: string      /* 距离太阳 */
  surfaceTemp: string   /* 表面温度 */
  revolution: string    /* 公转周期 */
  rotation: string      /* 自转周期 */
  desc: string
}

/** M6 行星运动特征 */
export interface MotionFeature {
  name: string
  desc: string
}

/** M7 结构特征：类地行星相对地球的体积（地球 = 1），用于相对大小示意 */
export interface EarthBody {
  id: string
  name: string
  /** 体积，相对地球（地球 = 1） */
  volume: number
}

/** M7 证据卡（运动特征 / 结构特征）：一句说明 + 一行图注 */
export interface EarthEvidence {
  /** 卡片标题 */
  title: string
  /** 一句说明 */
  desc: string
  /** 图注（关键词，小字） */
  caption: string
}

/** M7 地球的普通性和特殊性（可视化：八大行星示意图 + 两条证据 + 普通/特殊结论） */
export interface EarthOrdinaryData {
  /** 八大行星横向示意图下方的图注 */
  lineupCaption: string
  /** 两条证据（运动特征 / 结构特征） */
  evidences: EarthEvidence[]
  /** 类地行星体积（相对地球，用于相对大小示意） */
  bodies: EarthBody[]
  /** 普通性结论 */
  ordinaryConclusion: string
  /** 转折语（普通 → 特殊） */
  turn: string
  /** 特殊性陈述句 */
  specialStatement: string
  /** 特殊性结论 */
  specialConclusion: string
  /** 指向下一模块（M8 生命条件）的桥接句 */
  bridge: string
}

/** M8 因果链单项 */
export interface ChainItem {
  cond: string
  result: string
}

export interface LifeConditions {
  external: ChainItem[]
  internal: ChainItem[]
  conclusion: string
}

/** M9 复习结构树节点 */
export interface ReviewNode {
  id: string
  name: string
  /** 叶子节点可配置跳转锚点（对应页面模块的 section id），点击后滚动定位 */
  link?: string
  children?: ReviewNode[]
}

/** M9 复习文档 · 行内片段（文本 / 挖空 / 空与空之间的间隔符号） */
export type ReviewSegment =
  | { kind: 'text'; text: string }
  | { kind: 'blank'; answer: string }
  | { kind: 'sep'; text: string }

/** M9 复习文档 · 判断练习单项（天体判别） */
export interface ReviewJudgeItem {
  name: string
  isCelestial: boolean
  explain: string
}

/** M9 复习文档 · 内容块 */
export type ReviewBlock =
  | { kind: 'line'; prefix?: string; segments: ReviewSegment[] }
  | { kind: 'sub'; text: string }
  | { kind: 'judge'; items: ReviewJudgeItem[] }
  | { kind: 'columns'; cols: ReviewBlock[][] }   // 左右并排

/** M9 复习文档 · 节（严格对应知识点清单的一、二、三…） */
export interface ReviewSection {
  heading: string
  blocks: ReviewBlock[]
}

export interface ReviewData {
  nodes: ReviewNode[]
  sections: ReviewSection[]
}

/** 拓展材料（各模块右上角“拓展”入口，占模块编号之外） */
export interface ExtendItem {
  title: string
  content: string[]
}

/** 随堂练习 · 单选题 */
export interface PracticeQuestion {
  q: string
  options: string[]
  answer: number
  explain: string
}

/** 随堂练习 · 拖拽分类型（M3） */
export interface PracticeDrag {
  type: 'drag'
  title: string
  intro: string
}

/** 随堂练习 · 选择题型 */
export interface PracticeQuiz {
  type?: 'quiz'
  title: string
  intro?: string
  questions: PracticeQuestion[]
}

export type PracticeItem = PracticeDrag | PracticeQuiz

/** 全课教学数据对象 */
export interface LessonData {
  meta: Meta
  universe: UniverseData
  meteorCase: MeteorCase
  dragCards: DragCard[]
  hierarchy: HierarchyLevel[]
  planets: Planet[]
  motionFeatures: MotionFeature[]
  earthOrdinary: EarthOrdinaryData
  lifeConditions: LifeConditions
  review: ReviewData
  extends: Record<string, ExtendItem>
  practices: Record<string, PracticeItem>
}
