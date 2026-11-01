/* ============================================================
   内容层 · 旧 HTML 材料 → 自由布局
   ------------------------------------------------------------
   把历史 group.material / section.material（富文本 HTML）转换为
   MaterialLayout：整段内容放进一个文字对象，按文本量估算画布高度。

   用途：
   - 编辑器载入旧数据时自动升级，不再保留富文本材料；
   - 数据迁移脚本复用同一套规则（脚本内为等价的纯 JS 实现）。

   注意：转换只做「整段 HTML → 一个文字对象」，不会把旧材料里的表格 /
   图片拆成独立对象；如需精确排版，请在编辑器中重新摆放。
   ============================================================ */
import type { MaterialLayout } from './materialTypes'
import { DEFAULT_MATERIAL_HEIGHT, createEmptyMaterialLayout } from './materialTypes'
import { renderRichText } from './richText'

const CHARS_PER_LINE = 42
const LINE_HEIGHT = 37

function estimateHeight(html: string): number {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return 0

  const lines = Math.max(1, Math.ceil(text.length / CHARS_PER_LINE))
  let height = 56 + lines * LINE_HEIGHT + 24
  if (/<(table|img)\b/i.test(html)) height = Math.max(height, 320)
  return Math.min(480, Math.max(120, height))
}

/** 旧 HTML 材料 → 自由布局（单个文字对象）；空材料返回空画布 */
export function materialLayoutFromHtml(html: string, width = 1000): MaterialLayout {
  const layout = createEmptyMaterialLayout(width, DEFAULT_MATERIAL_HEIGHT)
  const content = renderRichText(html).trim()
  if (!content) return layout

  /* 文字对象按文本量估算，画布统一不低于默认高度，避免不同题组高低不一 */
  const objectHeight = Math.max(72, estimateHeight(html) - 48)
  layout.height = Math.max(DEFAULT_MATERIAL_HEIGHT, objectHeight + 48)
  layout.objects.push({
    id: 'text-1',
    type: 'text',
    x: 24,
    y: 24,
    width: width - 48,
    height: objectHeight,
    html: content,
    style: { fontSize: 22, lineHeight: 1.7, textAlign: 'left', color: '#1b1d19' }
  })
  return layout
}
