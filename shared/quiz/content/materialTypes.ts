/* ============================================================
   内容层 · 自由布局材料模型（MaterialLayout v1）
   ------------------------------------------------------------
   材料 = 一块固定逻辑尺寸的画布 + 若干绝对定位对象：
   - text：富文本片段（HTML 经白名单清洗）；
   - image：图片（Base64 或相对路径，禁止本地绝对路径）；
   - table：表格（HTML 经白名单清洗）；
   - question：题目对象，只保存题目在画布中的位置与选项排列，
     题干 / 选项 / 答案仍由 group.questions[] 唯一持有（见 renderQuestionObject.ts）。

   设计约束（见 shared/quiz/docs 重构开发文档 §5 与 2026-10-31 调整文档）：
   - 只保存逻辑坐标，不保存浏览器实时像素；
   - 选项不属于独立的画布对象，仍是题目对象内部的结构化按钮；
   - 所有数值必须是有限数字，校验与渲染都按同一套边界处理。
   ============================================================ */

export const MATERIAL_LAYOUT_VERSION = 1

/** 默认画布尺寸：宽度对齐运行时阅读行宽，高度对齐练习窗口内容区（1920×1080 基准下可用约 727px） */
export const DEFAULT_MATERIAL_WIDTH = 1000
export const DEFAULT_MATERIAL_HEIGHT = 700

/** 校验与渲染共用的边界 */
export const MATERIAL_LIMITS = {
  maxWidth: 3000,
  maxHeight: 3000,
  maxObjects: 100,
  minObjectSize: 20
} as const

export type MaterialAlign = 'left' | 'center' | 'right'
export type MaterialVerticalAlign = 'top' | 'middle' | 'bottom'
export type MaterialObjectFit = 'contain' | 'cover' | 'fill'

export type MaterialObjectType = 'text' | 'image' | 'table' | 'slot'

/** 题目对象内选项排列方式（free 仅保存相对题目对象的坐标，答案仍按 key 匹配） */
export interface OptionLayout {
  mode: 'flow' | 'free'
  /** flow：1 / 2 / 3 列 */
  columns?: 1 | 2 | 3
  positions?: Array<{
    key: string
    x: number
    y: number
    width: number
    height: number
  }>
}

export interface MaterialTextStyle {
  fontFamily?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  lineHeight?: number
  textAlign?: MaterialAlign
  verticalAlign?: MaterialVerticalAlign
  color?: string
  backgroundColor?: string
}

export interface MaterialImageStyle {
  objectPosition?: string
  border?: string
}

export interface BaseMaterialObject {
  id: string
  type: MaterialObjectType
  x: number
  y: number
  width: number
  height: number
  zIndex?: number
  visible?: boolean
}

export interface TextMaterialObject extends BaseMaterialObject {
  type: 'text'
  html: string
  style?: MaterialTextStyle
}

export interface ImageMaterialObject extends BaseMaterialObject {
  type: 'image'
  src: string
  alt?: string
  objectFit?: MaterialObjectFit
  lockAspectRatio?: boolean
  style?: MaterialImageStyle
}

export interface TableMaterialObject extends BaseMaterialObject {
  type: 'table'
  html: string
}

/**
 * 题目槽：一题组一张画布里唯一的题目占位区域。
 * 只保存位置 / 尺寸 / 选项排列；组内所有题轮流占用这个槽（见 renderGroup.ts）。
 */
export interface SlotMaterialObject extends BaseMaterialObject {
  type: 'slot'
  optionLayout?: OptionLayout
}

export type MaterialObject =
  | TextMaterialObject
  | ImageMaterialObject
  | TableMaterialObject
  | SlotMaterialObject

export interface MaterialLayout {
  version: 1
  /** 逻辑画布宽度（不直接使用浏览器像素） */
  width: number
  /** 逻辑画布高度 */
  height: number
  background?: string
  objects: MaterialObject[]
}

/** 新建一块默认画布 */
export function createEmptyMaterialLayout(
  width = DEFAULT_MATERIAL_WIDTH,
  height = DEFAULT_MATERIAL_HEIGHT
): MaterialLayout {
  return { version: MATERIAL_LAYOUT_VERSION, width, height, background: '#ffffff', objects: [] }
}

/** 对象在画布内的层级（数组顺序兜底） */
export function sortedMaterialObjects(objects: MaterialObject[]): MaterialObject[] {
  return objects
    .map((object, index) => ({ object, index }))
    .sort((a, b) => (a.object.zIndex ?? 0) - (b.object.zIndex ?? 0) || a.index - b.index)
    .map((item) => item.object)
}
