/* ============================================================
   内容层 · MaterialLayout 校验
   ------------------------------------------------------------
   把编辑器 / 外部数据里的材料画布收敛为可安全渲染的结构：
   - 画布与对象的数值必须是有限数字，并限制在允许范围内；
   - 文字 / 表格 HTML 必须经过 sanitizeHtml；
   - 图片地址只允许 http(s) / data:image / 相对路径；
   - 单个对象非法只跳过该对象，不拖垮整份材料；
   - 画布整体非法时返回 null，由调用方渲染空材料状态。

   详见 shared/quiz/docs 重构开发文档 §18。
   ============================================================ */
import type {
  ImageMaterialObject,
  MaterialLayout,
  MaterialObject,
  MaterialObjectFit,
  MaterialTextStyle,
  OptionLayout,
  SlotMaterialObject,
  TableMaterialObject,
  TextMaterialObject
} from './materialTypes'
import { MATERIAL_LIMITS, MATERIAL_LAYOUT_VERSION } from './materialTypes'
import { isSafeImageSrc, sanitizeHtml } from './sanitize'

const TEXT_ALIGNS = new Set(['left', 'center', 'right'])
const VERTICAL_ALIGNS = new Set(['top', 'middle', 'bottom'])
const OBJECT_FITS = new Set(['contain', 'cover', 'fill'])
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\)|transparent|var\(--[\w-]+\))$/i
/** 题目对象允许的选项坐标上限（远大于实际题量，防止脏数据撑爆数据文件） */
const MAX_OPTION_POSITIONS = 26

function finiteNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function safeColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const color = value.trim()
  return COLOR_RE.test(color) ? color : undefined
}

function validateTextStyle(raw: unknown): MaterialTextStyle | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const source = raw as Record<string, unknown>
  const style: MaterialTextStyle = {}

  if (typeof source.fontFamily === 'string' && /^[\w\s,'"\-]+$/.test(source.fontFamily)) {
    style.fontFamily = source.fontFamily.slice(0, 120)
  }
  const fontSize = finiteNumber(source.fontSize)
  if (fontSize !== null) style.fontSize = clamp(fontSize, 8, 200)
  if (source.fontWeight === 'bold' || source.fontWeight === 'normal') style.fontWeight = source.fontWeight
  const lineHeight = finiteNumber(source.lineHeight)
  if (lineHeight !== null) style.lineHeight = clamp(lineHeight, 1, 3)
  if (typeof source.textAlign === 'string' && TEXT_ALIGNS.has(source.textAlign)) {
    style.textAlign = source.textAlign as MaterialTextStyle['textAlign']
  }
  if (typeof source.verticalAlign === 'string' && VERTICAL_ALIGNS.has(source.verticalAlign)) {
    style.verticalAlign = source.verticalAlign as MaterialTextStyle['verticalAlign']
  }
  const color = safeColor(source.color)
  if (color) style.color = color
  const backgroundColor = safeColor(source.backgroundColor)
  if (backgroundColor) style.backgroundColor = backgroundColor

  return Object.keys(style).length ? style : undefined
}

function validateOptionLayout(raw: unknown): OptionLayout | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const source = raw as Record<string, unknown>
  const layout: OptionLayout = { mode: source.mode === 'free' ? 'free' : 'flow' }
  const columns = finiteNumber(source.columns)
  if (columns === 1 || columns === 2 || columns === 3) layout.columns = columns
  if (layout.mode === 'free' && Array.isArray(source.positions)) {
    const rect = (item: unknown) => {
      if (!item || typeof item !== 'object') return null
      const pos = item as Record<string, unknown>
      const key = typeof pos.key === 'string' ? pos.key.trim().slice(0, 8) : ''
      const x = finiteNumber(pos.x)
      const y = finiteNumber(pos.y)
      const width = finiteNumber(pos.width)
      const height = finiteNumber(pos.height)
      if (!key || x === null || y === null || width === null || height === null) return null
      if (width <= 0 || height <= 0) return null
      return { key, x: Math.max(0, x), y: Math.max(0, y), width, height }
    }
    layout.positions = (source.positions as unknown[])
      .slice(0, MAX_OPTION_POSITIONS)
      .map(rect)
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }
  return layout
}

function objectId(raw: unknown, index: number, used: Set<string>, issues: string[]): string {
  const source = typeof raw === 'string' ? raw.trim() : ''
  let id = source || `material-${index + 1}`
  if (!source) issues.push(`第 ${index + 1} 个材料对象缺少 id，已补为 ${id}`)
  if (used.has(id)) {
    let next = 2
    while (used.has(`${id}-${next}`)) next += 1
    issues.push(`材料对象 id「${id}」重复，已重命名为 ${id}-${next}`)
    id = `${id}-${next}`
  }
  used.add(id)
  return id
}

function baseRect(raw: Record<string, unknown>, layout: MaterialLayout, label: string, issues: string[]):
  | { x: number; y: number; width: number; height: number }
  | null {
  const x = finiteNumber(raw.x)
  const y = finiteNumber(raw.y)
  const width = finiteNumber(raw.width)
  const height = finiteNumber(raw.height)
  if (x === null || y === null || width === null || height === null) {
    issues.push(`${label}的坐标或尺寸不是有效数字，已跳过`)
    return null
  }
  if (width <= 0 || height <= 0) {
    issues.push(`${label}的宽高必须大于 0，已跳过`)
    return null
  }
  const left = clamp(x, 0, Math.max(0, layout.width - MATERIAL_LIMITS.minObjectSize))
  const top = clamp(y, 0, Math.max(0, layout.height - MATERIAL_LIMITS.minObjectSize))
  const w = clamp(width, MATERIAL_LIMITS.minObjectSize, layout.width - left)
  const h = clamp(height, MATERIAL_LIMITS.minObjectSize, layout.height - top)
  return { x: left, y: top, width: w, height: h }
}

function validateObject(
  raw: unknown,
  index: number,
  layout: MaterialLayout,
  used: Set<string>,
  issues: string[]
): MaterialObject | null {
  if (!raw || typeof raw !== 'object') {
    issues.push(`第 ${index + 1} 个材料对象不是对象，已跳过`)
    return null
  }
  const source = raw as Record<string, unknown>
  const type = source.type
  if (type !== 'text' && type !== 'image' && type !== 'table' && type !== 'slot') {
    issues.push(`第 ${index + 1} 个材料对象 type 非法，已跳过`)
    return null
  }

  const id = objectId(source.id, index, used, issues)
  const label = `材料对象「${id}」`
  const rect = baseRect(source, layout, label, issues)
  if (!rect) return null

  const zIndex = finiteNumber(source.zIndex)
  const base = {
    id,
    ...rect,
    zIndex: zIndex === null ? index : Math.round(zIndex),
    visible: source.visible !== false
  }

  if (type === 'text') {
    const html = sanitizeHtml(String(source.html ?? ''))
    if (!html.replace(/<[^>]+>/g, '').trim() && !/<(img|table)\b/i.test(html)) {
      issues.push(`${label}缺少文字内容，已跳过`)
      return null
    }
    const object: TextMaterialObject = { ...base, type: 'text', html }
    const style = validateTextStyle(source.style)
    if (style) object.style = style
    return object
  }

  if (type === 'image') {
    const src = String(source.src ?? '').trim()
    if (!isSafeImageSrc(src)) {
      issues.push(`${label}的图片地址不安全或缺失，已跳过`)
      return null
    }
    const object: ImageMaterialObject = { ...base, type: 'image', src }
    if (typeof source.alt === 'string') object.alt = source.alt.slice(0, 200)
    if (typeof source.objectFit === 'string' && OBJECT_FITS.has(source.objectFit)) {
      object.objectFit = source.objectFit as MaterialObjectFit
    }
    object.lockAspectRatio = source.lockAspectRatio !== false
    return object
  }

  if (type === 'slot') {
    const object: SlotMaterialObject = { ...base, type: 'slot' }
    const optionLayout = validateOptionLayout(source.optionLayout)
    object.optionLayout = optionLayout ?? { mode: 'flow', columns: 2 }
    return object
  }

  const html = sanitizeHtml(String(source.html ?? ''))
  if (!/<table[\s>]/i.test(html)) {
    issues.push(`${label}缺少有效表格，已跳过`)
    return null
  }
  const object: TableMaterialObject = { ...base, type: 'table', html }
  return object
}

/**
 * 校验并收敛材料画布。
 * @returns layout 为空表示整块材料非法；issues 记录被修正 / 跳过的内容。
 */
export function validateMaterialLayout(raw: unknown): { layout: MaterialLayout | null; issues: string[] } {
  const issues: string[] = []
  if (!raw || typeof raw !== 'object') {
    issues.push('材料布局不是对象')
    return { layout: null, issues }
  }
  const source = raw as Record<string, unknown>

  const version = finiteNumber(source.version)
  if (version !== MATERIAL_LAYOUT_VERSION) {
    issues.push(`材料布局版本必须为 ${MATERIAL_LAYOUT_VERSION}`)
    return { layout: null, issues }
  }

  const width = finiteNumber(source.width)
  const height = finiteNumber(source.height)
  if (width === null || height === null || width <= 0 || height <= 0) {
    issues.push('材料画布宽高必须为正数')
    return { layout: null, issues }
  }
  const canvasWidth = clamp(width, 1, MATERIAL_LIMITS.maxWidth)
  const canvasHeight = clamp(height, 1, MATERIAL_LIMITS.maxHeight)
  if (canvasWidth !== width || canvasHeight !== height) {
    issues.push(`材料画布尺寸超出上限，已收敛为 ${canvasWidth} × ${canvasHeight}`)
  }

  const rawObjects = Array.isArray(source.objects) ? source.objects : []
  if (!Array.isArray(source.objects)) issues.push('材料画布缺少 objects 数组，按空画布处理')
  if (rawObjects.length > MATERIAL_LIMITS.maxObjects) {
    issues.push(`材料对象超过 ${MATERIAL_LIMITS.maxObjects} 个，超出部分已忽略`)
  }

  const layout: MaterialLayout = {
    version: MATERIAL_LAYOUT_VERSION,
    width: canvasWidth,
    height: canvasHeight,
    objects: []
  }
  const background = safeColor(source.background)
  if (background) layout.background = background

  const used = new Set<string>()
  rawObjects.slice(0, MATERIAL_LIMITS.maxObjects).forEach((item, index) => {
    const object = validateObject(item, index, layout, used, issues)
    if (object) layout.objects.push(object)
  })

  return { layout, issues }
}
