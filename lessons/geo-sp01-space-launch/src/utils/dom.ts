/** DOM 辅助函数 */
export function $<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T | null {
  return root.querySelector(sel) as T | null
}

export function $$<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll(sel)) as T[]
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  html?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (html !== undefined) node.innerHTML = html
  return node
}

export function on<K extends keyof HTMLElementEventMap>(
  node: EventTarget,
  type: K,
  fn: (ev: HTMLElementEventMap[K]) => void,
  opts?: AddEventListenerOptions
): void {
  node.addEventListener(type, fn as EventListener, opts)
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 转义文本并把关键词包成 <mark class="kw">（长词优先，避免嵌套替换） */
export function highlight(text: string, keywords: string[] = []): string {
  let out = escapeHtml(text)
  const sorted = [...keywords].filter(Boolean).sort((a, b) => b.length - a.length)
  for (const kw of sorted) {
    out = out.replace(new RegExp(escapeRegExp(escapeHtml(kw)), 'g'), (m) => `<mark class="kw">${m}</mark>`)
  }
  return out
}

/** 数字滚动/普通文本查询别用：按 id 取元素（找不到直接抛错，便于早发现） */
export function must<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T {
  const node = root.querySelector(sel) as T | null
  if (!node) throw new Error(`元素未找到：${sel}`)
  return node
}
