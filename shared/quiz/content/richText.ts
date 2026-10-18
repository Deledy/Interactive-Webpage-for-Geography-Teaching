/* ============================================================
   内容层 · 内容 → HTML
   ------------------------------------------------------------
   题库字段直接存「规范 HTML」，运行时不再解析 Markdown：
   - 含标签的内容：经 sanitize.ts 白名单清洗后输出；
   - 不含标签的内容（教师直接输入纯文字）：转义后按换行分段，
     不做任何 Markdown 解释，避免出现第二套语义。

   两种上下文：
   - renderRichText：块级内容（材料 / 解析 / 参考答案），纯文本按段落输出；
   - renderInlineRich：行内内容（设问 / 评分标准 / 知识要点 / 引导语），纯文本转义输出。

   详见 shared/quiz/docs/2026-10-17-quiz-card-wysiwyg-design.md §5.3–§5.5。
   ============================================================ */
import { sanitizeHtml } from './sanitize'

const HAS_TAG = /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/i

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 块级富文本：HTML 走白名单清洗；纯文本按空行/换行分段 */
export function renderRichText(value?: string): string {
  if (!value) return ''
  const text = String(value).trim()
  if (!text) return ''
  if (HAS_TAG.test(text)) return sanitizeHtml(text)
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((para) => `<p class="cq-p">${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** 行内富文本：HTML 走白名单清洗；纯文本仅转义 */
export function renderInlineRich(value?: string): string {
  if (!value) return ''
  const text = String(value).trim()
  if (!text) return ''
  return HAS_TAG.test(text) ? sanitizeHtml(text) : escapeHtml(text)
}
