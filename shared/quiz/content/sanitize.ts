/* ============================================================
   内容层 · HTML 白名单清洗
   ------------------------------------------------------------
   把教师编辑产出的 HTML（以及任何外来的富文本片段）收敛为可安全渲染的结构：
   - 标签白名单：结构与行内标签；未知标签「剥壳留内容」，危险标签整段删除；
   - 属性白名单：图片地址 / 替代文字、链接地址、表格合并格、段落对齐、图片宽度；
   - 类名白名单：只保留 cq- 前缀（关键词高亮 cq-hl、材料分栏 cq-cols / cq-col 等）；
   - 事件属性（on*）、脚本、样式表、内嵌框架一律剥除；
   - 地址协议白名单：图片仅 http(s) / data:image / 相对路径；链接仅 http(s) / mailto / # / 相对路径。

   详见 shared/quiz/docs/2026-10-17-quiz-card-wysiwyg-design.md §5.3。
   本文件是「结构安全」的唯一真源；运行时与编辑器都从这里调用，不各自实现。
   ============================================================ */

/** 允许保留的标签 */
export const ALLOWED_TAGS = new Set([
  'P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'SUB', 'SUP', 'SPAN', 'DIV', 'FONT',
  'MARK', 'CODE',
  'IMG', 'A', 'UL', 'OL', 'LI',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'COLGROUP', 'COL',
  'FIGURE', 'FIGCAPTION', 'H3', 'H4'
])

/** 整段删除的标签（含内容） */
export const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'LINK', 'META', 'OBJECT', 'EMBED'])

/** 每个标签允许保留的属性 */
export const KEEP_ATTR: Record<string, string[]> = {
  IMG: ['src', 'alt', 'width', 'height', 'style'],
  A: ['href', 'title', 'target'],
  TD: ['colspan', 'rowspan', 'style'],
  TH: ['colspan', 'rowspan', 'style'],
  COL: ['span', 'style'],
  COLGROUP: ['span', 'style'],
  FIGURE: ['style'],
  P: ['style'],
  DIV: ['style'],
  SPAN: ['style'],
  FONT: ['color']
}

/** style 属性中允许保留的 CSS 属性（"内容意图"：图片宽度、段落对齐、单元格对齐、行内强调） */
export const KEEP_STYLE_PROPS = [
  'width',
  'text-align',
  'vertical-align',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-decoration-line',
  'text-decoration-style',
  'text-decoration-color',
  'color'
]

/** class 白名单前缀 */
export const CLASS_PREFIX = 'cq-'

const SAFE_SRC = /^(https?:|data:image\/|\.\/|\.\.\/|\/)/i
const SAFE_HREF = /^(https?:|mailto:|#|\.\/|\.\.\/|\/)/i

/** 图片地址协议校验：http(s) / data:image / 相对路径；其余（javascript:、本地盘符等）一律拒绝 */
export function isSafeImageSrc(src: string): boolean {
  const value = String(src ?? '').trim()
  if (!value) return false
  if (/^[a-z]:[\\/]/i.test(value)) return false
  return SAFE_SRC.test(value)
}

/** 只保留白名单内的 CSS 声明 */
export function filterStyle(css: string | null): string {
  return String(css ?? '')
    .split(';')
    .map((decl) => decl.trim())
    .filter((decl) => {
      const prop = decl.split(':')[0].trim().toLowerCase()
      return !!prop && KEEP_STYLE_PROPS.includes(prop)
    })
    .join('; ')
}

/** 只保留 cq- 前缀的类名 */
export function filterClass(value: string | null): string {
  return String(value ?? '')
    .split(/\s+/)
    .filter((cls) => cls.startsWith(CLASS_PREFIX))
    .join(' ')
}

function unwrap(node: Element): void {
  const parent = node.parentNode
  if (!parent) return
  while (node.firstChild) parent.insertBefore(node.firstChild, node)
  parent.removeChild(node)
}

function cleanNode(node: Element): void {
  const tag = node.tagName
  if (DROP_TAGS.has(tag)) {
    node.parentNode?.removeChild(node)
    return
  }
  if (!ALLOWED_TAGS.has(tag)) {
    unwrap(node)
    return
  }

  const keep = KEEP_ATTR[tag] ?? []
  for (const attr of Array.from(node.attributes)) {
    const name = attr.name.toLowerCase()
    if (name.startsWith('on')) {
      node.removeAttribute(attr.name)
      continue
    }
    if (name === 'class') {
      const cls = filterClass(attr.value)
      if (cls) node.setAttribute('class', cls)
      else node.removeAttribute('class')
      continue
    }
    if (!keep.includes(name)) {
      node.removeAttribute(attr.name)
      continue
    }
    if (name === 'style') {
      const style = filterStyle(attr.value)
      if (style) node.setAttribute('style', style)
      else node.removeAttribute('style')
    } else if (name === 'src') {
      if (!isSafeImageSrc(attr.value)) node.removeAttribute('src')
    } else if (name === 'href') {
      if (!SAFE_HREF.test(attr.value.trim())) node.removeAttribute('href')
    }
  }

  for (const child of Array.from(node.children)) cleanNode(child)
}

/** 清洗一段 HTML，返回可安全插入页面的字符串 */
export function sanitizeHtml(html: string): string {
  const root = document.createElement('div')
  root.innerHTML = String(html ?? '')
  for (const child of Array.from(root.children)) cleanNode(child)
  return root.innerHTML
}

/** 清洗后写入目标元素（替代直接 innerHTML） */
export function renderHtmlInto(html: string, element: HTMLElement): void {
  element.innerHTML = sanitizeHtml(html)
}
