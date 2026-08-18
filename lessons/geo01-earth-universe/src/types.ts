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

/** M4 拖拽分类案例卡 */
export interface DragCard {
  id: string
  name: string
  type: 'celestial' | 'non'
  explain: string
}

/** M5 天体系统层级 */
export interface HierarchyLevel {
  id: string
  name: string
  content: string
  example: string
}

/** M6 八大行星 */
export interface Planet {
  id: string
  name: string
  type: string
  color: string
  size: number
  orbit: number
  period: number
  desc: string
}

/** M7 行星运动特征 */
export interface MotionFeature {
  name: string
  desc: string
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
  children?: ReviewNode[]
}

export interface ReviewData {
  nodes: ReviewNode[]
}

/** M10 拓展材料 */
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
  lifeConditions: LifeConditions
  review: ReviewData
  extends: Record<string, ExtendItem>
  practices: Record<string, PracticeItem>
}
