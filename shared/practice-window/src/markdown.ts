/* ============================================================
   PracticeWindow · Markdown 子集渲染（含 ==关键词高亮==）
   ------------------------------------------------------------
   支持：**加粗**、*斜体*、`行内代码`、![图](路径)、[链接](url)、
        ==关键词== → <mark class="pw-hl">、GFM 表格、有序 / 无序列表、
        段落内换行（<br>）。
   自研实现，不引入第三方库（贴合项目「优先原生」约定）。
   实现要点：先 HTML 转义，再做行内替换；高亮在行内阶段处理，且不匹配跨行。
   ============================================================ */

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 行内语法：图片 → 链接 → 加粗 → 斜体 → 行内代码 → 关键词高亮 */
export function inlineMarkdown(value: string): string {
  let text = escapeHtml(value)
  text = text.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_m, alt: string, src: string) =>
      `<img class="cq-img" src="${src}" alt="${alt}" loading="lazy" decoding="async" />`
  )
  text = text.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_m, label: string, href: string) =>
      `<a class="cq-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
  )
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  text = text.replace(/`([^`]+)`/g, '<code class="cq-code">$1</code>')
  // ==关键词高亮==：仅行内、不跨行；未闭合的 == 按普通文本原样输出
  text = text.replace(/==([^=\n]+)==/g, '<mark class="pw-hl">$1</mark>')
  return text
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line)
}

function isTableSep(line: string): boolean {
  return /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes('|')
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isBullet(line: string): boolean {
  return /^\s*[-*]\s+/.test(line)
}

function isOrdered(line: string): boolean {
  return /^\s*\d+[.、]\s+/.test(line)
}

/** 块级解析：表格 / 列表 / 段落，逐行扫描 */
export function renderMarkdown(source?: string): string {
  if (!source) return ''
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line)
      let j = i + 2
      const rows: string[][] = []
      while (j < lines.length && isTableRow(lines[j])) {
        rows.push(splitRow(lines[j]))
        j++
      }
      blocks.push(
        `<div class="cq-table-wrap"><table class="cq-table"><thead><tr>${header
          .map((cell) => `<th>${inlineMarkdown(cell)}</th>`)
          .join('')}</tr></thead><tbody>${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`
      )
      i = j
      continue
    }

    if (isBullet(line)) {
      const items: string[] = []
      while (i < lines.length && isBullet(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
        i++
      }
      blocks.push(`<ul class="cq-list">${items.map((t) => `<li>${inlineMarkdown(t)}</li>`).join('')}</ul>`)
      continue
    }

    if (isOrdered(line)) {
      const items: string[] = []
      while (i < lines.length && isOrdered(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.、]\s+/, ''))
        i++
      }
      blocks.push(
        `<ol class="cq-list cq-list--ordered">${items.map((t) => `<li>${inlineMarkdown(t)}</li>`).join('')}</ol>`
      )
      continue
    }

    const para: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isTableRow(lines[i]) &&
      !isBullet(lines[i]) &&
      !isOrdered(lines[i])
    ) {
      para.push(lines[i])
      i++
    }
    blocks.push(`<p class="cq-p">${para.map(inlineMarkdown).join('<br>')}</p>`)
  }

  return blocks.join('')
}
