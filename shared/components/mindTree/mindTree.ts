/* ============================================================
   mindTree · 单向树状思维导图组件
   ------------------------------------------------------------
   用途：复习模块的知识结构树 / 思维导图。根在左，子级统一向右展开（单向树状图）。
   布局：d3-hierarchy 的 tidy tree，仅用其布局算法，渲染为原生 SVG。
   交互：点击节点展开/收起其子级；控制条「展开下一层 / 全部展开 / 全部收起」逐级展开。
        叶子节点配置 link 后，点击可联动跳转（由 onLink 回调处理），用于把导图节点接到页面模块。
   样式：同目录 mindTree.css，令牌 --mt-* 可被课程覆盖，默认明暗主题自适应。
   ------------------------------------------------------------
   用法（单课源码内，注意相对层级）：
     import { createMindTree } from '../../../shared/components/mindTree/mindTree'
     const tree = createMindTree(document.getElementById('review-tree')!, lessonData.review.nodes, {
       initialDepth: 0,
       onChange: (s) => console.log(s.depth),
       onLink: (link) => document.getElementById(link)?.scrollIntoView({ behavior: 'smooth' })
     })
     // tree.expandNextLevel() / tree.expandAll() / tree.collapseAll() / tree.toggle(id) / tree.destroy()
   ============================================================ */
import { hierarchy, tree as treeLayout } from 'd3-hierarchy'
import './mindTree.css'

const SVG_NS = 'http://www.w3.org/2000/svg'
const PAD_X = 14
const PAD_Y = 10
const VB_PAD = 24
const NODE_RADIUS = 10

/** 树节点数据结构（与课内 ReviewNode 结构兼容） */
export interface MindTreeNode {
  id: string
  name: string
  /** 叶子节点可配置跳转目标（如页面模块的 id），点击时交给 onLink 处理 */
  link?: string
  children?: MindTreeNode[]
}

/** 展开状态快照 */
export interface MindTreeState {
  /** 当前可见的最深层级（根为 0） */
  depth: number
  /** 整棵树的最大层级（根为 0） */
  maxDepth: number
  /** 已展开的节点 id */
  expanded: string[]
}

export interface MindTreeOptions {
  /** 传入多个根节点时，虚拟根的标题 */
  rootLabel?: string
  /** 初始展开到的层级（0 = 只显示根） */
  initialDepth?: number
  /** 是否渲染「展开下一层 / 全部展开 / 全部收起」控制条 */
  controls?: boolean
  /** 节点最大宽度（px） */
  maxNodeWidth?: number
  /** 节点最小宽度（px） */
  minNodeWidth?: number
  /** 层级之间的水平间距（px） */
  colGap?: number
  /** 同层节点之间的垂直间距（px） */
  rowGap?: number
  /** 正文字号 / 行高（px） */
  fontSize?: number
  lineHeight?: number
  /** 展开状态变化回调 */
  onChange?: (state: MindTreeState) => void
  /** 点击带 link 的叶子节点时触发（用于跳转 / 高亮等联动） */
  onLink?: (link: string, node: MindTreeNode) => void
}

export interface MindTreeHandle {
  /** 当前可见的最深层级（根为 0） */
  readonly depth: number
  /** 展开下一层（逐级展开） */
  expandNextLevel(): void
  /** 全部展开 */
  expandAll(): void
  /** 只保留根节点 */
  collapseAll(): void
  /** 展开 / 收起指定节点的子级 */
  toggle(id: string): void
  /** 销毁组件并清理监听 */
  destroy(): void
}

const DEFAULTS = {
  initialDepth: 0,
  controls: true,
  maxNodeWidth: 220,
  minNodeWidth: 96,
  colGap: 56,
  rowGap: 20,
  fontSize: 15,
  lineHeight: 21
}

interface FlatNode {
  id: string
  name: string
  depth: number
  parentId: string | null
  /** 垂直中心 */
  x: number
  /** 水平左边缘 */
  y: number
  w: number
  h: number
  lines: string[]
  link?: string
}

/** 在容器内创建单向树状思维导图，返回控制句柄 */
export function createMindTree(
  container: HTMLElement,
  data: MindTreeNode | MindTreeNode[],
  options: MindTreeOptions = {}
): MindTreeHandle {
  const opt = { ...DEFAULTS, ...options }
  const rootData: MindTreeNode = Array.isArray(data)
    ? data.length === 1
      ? data[0]
      : { id: '__root__', name: opt.rootLabel ?? '知识结构', children: data }
    : data

  // ---------- 索引：是否有子级 / 父节点 / 层级 ----------
  const hasKids = new Map<string, boolean>()
  const depthOf = new Map<string, number>()
  const linkOf = new Map<string, string>()
  const nameOf = new Map<string, string>()
  let maxDepth = 0
  const index = (node: MindTreeNode, depth: number): void => {
    hasKids.set(node.id, !!(node.children && node.children.length))
    depthOf.set(node.id, depth)
    nameOf.set(node.id, node.name)
    if (node.link) linkOf.set(node.id, node.link)
    if (depth > maxDepth) maxDepth = depth
    node.children?.forEach((child) => index(child, depth + 1))
  }
  index(rootData, 0)

  const expanded = new Set<string>()
  const seed = (node: MindTreeNode, depth: number): void => {
    if (depth < opt.initialDepth && node.children && node.children.length) {
      expanded.add(node.id)
      node.children.forEach((child) => seed(child, depth + 1))
    }
  }
  seed(rootData, 0)

  // ---------- DOM 骨架 ----------
  container.classList.add('mt')
  container.innerHTML = ''

  let bar: HTMLDivElement | null = null
  let nextBtn: HTMLButtonElement | null = null
  let hint: HTMLSpanElement | null = null

  if (opt.controls) {
    bar = document.createElement('div')
    bar.className = 'mt__bar'
    const mkBtn = (act: string, label: string): HTMLButtonElement => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'mt__btn'
      btn.setAttribute('data-mt-act', act)
      btn.textContent = label
      return btn
    }
    nextBtn = mkBtn('next', '展开下一层')
    bar.append(nextBtn, mkBtn('all', '全部展开'), mkBtn('none', '全部收起'))
    hint = document.createElement('span')
    hint.className = 'mt__hint'
    bar.append(hint)
    container.append(bar)
  }

  const viewport = document.createElement('div')
  viewport.className = 'mt__viewport'
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'mt__svg')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', '知识结构思维导图')
  const linksG = document.createElementNS(SVG_NS, 'g')
  linksG.setAttribute('class', 'mt-links')
  const nodesG = document.createElementNS(SVG_NS, 'g')
  nodesG.setAttribute('class', 'mt-nodes')
  svg.append(linksG, nodesG)
  viewport.append(svg)
  container.append(viewport)

  const nodeEls = new Map<string, SVGGElement>()
  const linkEls = new Map<string, SVGPathElement>()

  // ---------- 文本量算（不用 getBBox，按字符估算）----------
  const sizeCache = new Map<string, { w: number; h: number; lines: string[] }>()
  const charWidth = (ch: string): number => {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x2e80) return opt.fontSize // CJK 及全角
    if (ch === ' ') return opt.fontSize * 0.3
    return opt.fontSize * 0.56
  }
  const measure = (text: string): number => {
    let width = 0
    for (const ch of text) width += charWidth(ch)
    return width
  }
  const sizeOf = (name: string): { w: number; h: number; lines: string[] } => {
    const cached = sizeCache.get(name)
    if (cached) return cached
    const w = Math.min(opt.maxNodeWidth, Math.max(opt.minNodeWidth, measure(name) + PAD_X * 2))
    const maxText = w - PAD_X * 2
    const lines: string[] = []
    let line = ''
    let width = 0
    for (const ch of name) {
      const cw = charWidth(ch)
      if (width + cw > maxText && line) {
        lines.push(line)
        line = ch
        width = cw
      } else {
        line += ch
        width += cw
      }
    }
    if (line) lines.push(line)
    const result = { w, h: lines.length * opt.lineHeight + PAD_Y * 2, lines }
    sizeCache.set(name, result)
    return result
  }

  // ---------- 布局 ----------
  const prune = (node: MindTreeNode): MindTreeNode => {
    if (!hasKids.get(node.id) || !expanded.has(node.id)) {
      return { id: node.id, name: node.name, link: node.link }
    }
    return { id: node.id, name: node.name, link: node.link, children: (node.children ?? []).map(prune) }
  }

  const layout = (): FlatNode[] => {
    const root = hierarchy(prune(rootData), (node) => node.children)
    const placed = treeLayout<MindTreeNode>()
      // x 轴 = 同层间距（用 separation 表达变高节点的实际高度），y 轴 = 层级列宽
      .nodeSize([1, opt.maxNodeWidth + opt.colGap])
      .separation((a, b) => (sizeOf(a.data.name).h + sizeOf(b.data.name).h) / 2 + opt.rowGap)(root)
    const out: FlatNode[] = []
    placed.each((node) => {
      const size = sizeOf(node.data.name)
      out.push({
        id: node.data.id,
        name: node.data.name,
        depth: node.depth,
        parentId: node.parent ? node.parent.data.id : null,
        x: node.x,
        y: node.y,
        w: size.w,
        h: size.h,
        lines: size.lines,
        link: hasKids.get(node.data.id) ? undefined : node.data.link
      })
    })
    return out
  }

  const linkPath = (parent: FlatNode, child: FlatNode): string => {
    const x1 = parent.y + parent.w
    const y1 = parent.x
    const x2 = child.y
    const y2 = child.x
    const mx = (x1 + x2) / 2
    return `M${x1},${y1}C${mx},${y1} ${mx},${y2} ${x2},${y2}`
  }

  // ---------- 绘制 ----------
  const createNodeEl = (node: FlatNode): SVGGElement => {
    const g = document.createElementNS(SVG_NS, 'g')
    g.setAttribute('class', 'mt-node is-enter')
    g.setAttribute('data-id', node.id)

    const rect = document.createElementNS(SVG_NS, 'rect')
    rect.setAttribute('rx', String(NODE_RADIUS))
    rect.setAttribute('width', String(node.w))
    rect.setAttribute('height', String(node.h))

    const text = document.createElementNS(SVG_NS, 'text')
    text.setAttribute('text-anchor', 'middle')
    node.lines.forEach((line, i) => {
      const tspan = document.createElementNS(SVG_NS, 'tspan')
      tspan.setAttribute('x', String(node.w / 2))
      tspan.setAttribute('y', String(PAD_Y + opt.lineHeight * i + opt.lineHeight * 0.75))
      tspan.textContent = line
      text.append(tspan)
    })
    g.append(rect, text)

    if (hasKids.get(node.id)) {
      const dot = document.createElementNS(SVG_NS, 'circle')
      dot.setAttribute('class', 'mt-node__dot')
      dot.setAttribute('cx', String(node.w))
      dot.setAttribute('cy', String(node.h / 2))
      dot.setAttribute('r', '9')
      const sign = document.createElementNS(SVG_NS, 'text')
      sign.setAttribute('class', 'mt-node__sign')
      sign.setAttribute('x', String(node.w))
      sign.setAttribute('y', String(node.h / 2))
      sign.setAttribute('text-anchor', 'middle')
      sign.setAttribute('dominant-baseline', 'central')
      g.append(dot, sign)
    }
    return g
  }

  const updateNodeEl = (g: SVGGElement, node: FlatNode): void => {
    const has = hasKids.get(node.id) ?? false
    const open = expanded.has(node.id)
    const linked = !has && !!node.link
    g.setAttribute('transform', `translate(${node.y}, ${node.x - node.h / 2})`)
    g.classList.toggle('is-root', node.depth === 0)
    g.classList.toggle('is-leaf', !has)
    g.classList.toggle('is-link', linked)
    g.classList.toggle('is-expanded', has && open)
    g.classList.toggle('is-collapsed', has && !open)
    if (has) {
      g.setAttribute('tabindex', '0')
      g.setAttribute('role', 'button')
      g.setAttribute('aria-expanded', String(open))
      g.setAttribute('aria-label', `${node.name}，${open ? '已展开' : '已收起'}`)
    } else if (linked) {
      g.setAttribute('tabindex', '0')
      g.setAttribute('role', 'button')
      g.removeAttribute('aria-expanded')
      g.setAttribute('aria-label', `${node.name}，点击跳转到对应内容`)
    } else {
      g.removeAttribute('tabindex')
      g.removeAttribute('role')
      g.removeAttribute('aria-expanded')
      g.removeAttribute('aria-label')
    }
    const sign = g.querySelector('.mt-node__sign')
    if (sign) sign.textContent = open ? '−' : '+'
  }

  const visibleIds = (): string[] => {
    const out: string[] = []
    const walk = (node: MindTreeNode): void => {
      out.push(node.id)
      if (expanded.has(node.id)) node.children?.forEach(walk)
    }
    walk(rootData)
    return out
  }

  const visibleDepth = (): number => {
    let depth = 0
    for (const id of visibleIds()) depth = Math.max(depth, depthOf.get(id) ?? 0)
    return depth
  }

  const emit = (): void => {
    const depth = visibleDepth()
    if (hint) hint.textContent = `已展开 ${depth + 1} / ${maxDepth + 1} 层`
    if (nextBtn) nextBtn.disabled = depth >= maxDepth
    opt.onChange?.({ depth, maxDepth, expanded: [...expanded] })
  }

  const render = (): void => {
    const nodes = layout()
    const visible = new Set(nodes.map((node) => node.id))

    // 收起：移除不再可见的节点与连线
    for (const [id, el] of nodeEls) {
      if (!visible.has(id)) {
        el.remove()
        nodeEls.delete(id)
      }
    }
    for (const [id, el] of linkEls) {
      if (!visible.has(id)) {
        el.remove()
        linkEls.delete(id)
      }
    }

    const byId = new Map(nodes.map((node) => [node.id, node]))

    // 视图范围
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const node of nodes) {
      minX = Math.min(minX, node.x - node.h / 2)
      maxX = Math.max(maxX, node.x + node.h / 2)
      minY = Math.min(minY, node.y)
      maxY = Math.max(maxY, node.y + node.w)
    }
    svg.setAttribute(
      'viewBox',
      `${minY - VB_PAD} ${minX - VB_PAD} ${maxY - minY + VB_PAD * 2} ${maxX - minX + VB_PAD * 2}`
    )

    // 连线（含节点头部圆点，向左多留 9px 容差）
    for (const node of nodes) {
      if (node.parentId === null) continue
      const parent = byId.get(node.parentId)
      if (!parent) continue
      let path = linkEls.get(node.id)
      if (!path) {
        path = document.createElementNS(SVG_NS, 'path')
        path.setAttribute('class', 'mt-link is-enter')
        linksG.append(path)
        linkEls.set(node.id, path)
      }
      path.setAttribute('d', linkPath(parent, node))
    }

    // 节点
    for (const node of nodes) {
      let g = nodeEls.get(node.id)
      if (!g) {
        g = createNodeEl(node)
        nodesG.append(g)
        nodeEls.set(node.id, g)
      }
      updateNodeEl(g, node)
    }

    emit()
  }

  // ---------- 交互 ----------
  const findNode = (target: EventTarget | null): SVGGElement | null => {
    const el = target as Element | null
    if (!el || typeof el.closest !== 'function') return null
    return el.closest('.mt-node') as SVGGElement | null
  }

  const onClick = (ev: Event): void => {
    const g = findNode(ev.target)
    const id = g?.getAttribute('data-id')
    if (!id) return
    if (hasKids.get(id)) {
      handle.toggle(id)
      return
    }
    const link = linkOf.get(id)
    if (link) opt.onLink?.(link, { id, name: nameOf.get(id) ?? '', link })
  }

  const onKeydown = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return
    const g = findNode(ev.target)
    const id = g?.getAttribute('data-id')
    if (!id) return
    if (!hasKids.get(id) && !linkOf.get(id)) return
    ev.preventDefault()
    onClick(ev)
  }

  const onBarClick = (ev: Event): void => {
    const el = ev.target as Element | null
    const btn = el && typeof el.closest === 'function' ? (el.closest('[data-mt-act]') as HTMLElement | null) : null
    if (!btn) return
    const act = btn.getAttribute('data-mt-act')
    if (act === 'next') handle.expandNextLevel()
    else if (act === 'all') handle.expandAll()
    else if (act === 'none') handle.collapseAll()
  }

  // ---------- 控制句柄 ----------
  const handle: MindTreeHandle = {
    get depth(): number {
      return visibleDepth()
    },
    toggle(id: string): void {
      if (!hasKids.get(id)) return
      if (expanded.has(id)) expanded.delete(id)
      else expanded.add(id)
      render()
    },
    expandNextLevel(): void {
      let changed = false
      // 先取当前可见节点快照，再统一展开，保证只推进一层
      for (const id of visibleIds()) {
        if (hasKids.get(id) && !expanded.has(id)) {
          expanded.add(id)
          changed = true
        }
      }
      if (changed) render()
      else emit()
    },
    expandAll(): void {
      for (const [id, has] of hasKids) if (has) expanded.add(id)
      render()
    },
    collapseAll(): void {
      expanded.clear()
      render()
    },
    destroy(): void {
      container.removeEventListener('click', onClick)
      container.removeEventListener('keydown', onKeydown)
      bar?.removeEventListener('click', onBarClick)
      nodeEls.clear()
      linkEls.clear()
      container.innerHTML = ''
      container.classList.remove('mt')
    }
  }

  container.addEventListener('click', onClick)
  container.addEventListener('keydown', onKeydown)
  bar?.addEventListener('click', onBarClick)

  render()
  return handle
}
