/* ============================================================
   mindTree 组件测试（jsdom 环境）
   覆盖：初始只显示根、点击节点展开子级、逐级展开、全部展开 / 收起、层级回调。
   ============================================================ */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMindTree, type MindTreeNode } from '../shared/components/mindTree/mindTree'

const DATA: MindTreeNode = {
  id: 'root',
  name: '宇宙',
  children: [
    {
      id: 'celestial',
      name: '天体',
      children: [{ id: 'types', name: '类型' }]
    },
    {
      id: 'system',
      name: '天体系统',
      children: [{ id: 'levels', name: '层级' }]
    }
  ]
}

let host: HTMLElement

beforeEach(() => {
  document.body.innerHTML = '<div id="host"></div>'
  host = document.getElementById('host')!
})

const nodeCount = (): number => host.querySelectorAll('.mt-node').length

describe('mindTree 单向树状思维导图', () => {
  it('初始只显示根节点，控制条显示层级进度', () => {
    const tree = createMindTree(host, DATA)
    expect(nodeCount()).toBe(1)
    expect(tree.depth).toBe(0)
    expect(host.querySelector('.mt-node.is-root')).toBeTruthy()
    expect(host.querySelector('.mt__hint')?.textContent).toBe('已展开 1 / 3 层')
  })

  it('点击节点展开 / 收起其子级', () => {
    const tree = createMindTree(host, DATA)
    tree.toggle('root')
    expect(nodeCount()).toBe(3)
    expect(host.querySelectorAll('.mt-link').length).toBe(2)

    tree.toggle('root')
    expect(nodeCount()).toBe(1)
    expect(host.querySelectorAll('.mt-link').length).toBe(0)
  })

  it('「展开下一层」逐级推进，每次只多展开一层', () => {
    const tree = createMindTree(host, DATA)
    tree.expandNextLevel()
    expect(nodeCount()).toBe(3) // 根 + 天体 + 天体系统
    expect(tree.depth).toBe(1)

    tree.expandNextLevel()
    expect(nodeCount()).toBe(5) // 再展开两个分支的子级
    expect(tree.depth).toBe(2)

    // 已到底层：再点不产生变化
    tree.expandNextLevel()
    expect(nodeCount()).toBe(5)
  })

  it('点击控制条的「全部展开 / 全部收起」', () => {
    createMindTree(host, DATA)
    ;(host.querySelector('[data-mt-act="all"]') as HTMLButtonElement).click()
    expect(nodeCount()).toBe(5)
    ;(host.querySelector('[data-mt-act="none"]') as HTMLButtonElement).click()
    expect(nodeCount()).toBe(1)
    ;(host.querySelector('[data-mt-act="next"]') as HTMLButtonElement).click()
    expect(nodeCount()).toBe(3)
  })

  it('点击 SVG 节点同样触发展开', () => {
    createMindTree(host, DATA)
    const root = host.querySelector('.mt-node[data-id="root"]') as SVGElement
    root.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(nodeCount()).toBe(3)
  })

  it('onChange 回调返回展开层级与 maxDepth', () => {
    const onChange = vi.fn()
    const tree = createMindTree(host, DATA, { onChange })
    tree.expandAll()
    const calls = onChange.mock.calls
    const last = calls[calls.length - 1][0]
    expect(last).toMatchObject({ depth: 2, maxDepth: 2 })
    expect(last.expanded).toContain('root')
  })

  it('initialDepth 可预设展开层级', () => {
    createMindTree(host, DATA, { initialDepth: 1 })
    expect(nodeCount()).toBe(3)
  })

  it('同列节点按实际高度避让：多行折行节点不与相邻节点重叠', () => {
    const varied: MindTreeNode = {
      id: 'r',
      name: '复习',
      children: [
        { id: 'a', name: '短节点' },
        { id: 'b', name: '这是一条很长的节点名称，需要自动折行以验证变高节点的避让逻辑是否正确' },
        { id: 'c', name: '中等长度节点' }
      ]
    }
    createMindTree(host, varied).expandAll()

    const boxes = Array.from(host.querySelectorAll('.mt-node')).map((g) => {
      const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(g.getAttribute('transform') ?? '')!
      const rect = g.querySelector('rect')!
      return { left: Math.round(Number(m[1])), top: Number(m[2]), h: Number(rect.getAttribute('height')) }
    })
    // 变高节点确实产生了多行（高度大于单行）
    expect(new Set(boxes.map((b) => b.h)).size).toBeGreaterThan(1)

    const cols = new Map<number, { top: number; h: number }[]>()
    for (const b of boxes) {
      const arr = cols.get(b.left) ?? []
      arr.push(b)
      cols.set(b.left, arr)
    }
    for (const col of cols.values()) {
      const sorted = [...col].sort((p, q) => p.top - q.top)
      for (let i = 1; i < sorted.length; i += 1) {
        const gap = sorted[i].top - (sorted[i - 1].top + sorted[i - 1].h)
        expect(gap).toBeGreaterThanOrEqual(20 - 0.5) // rowGap = 20
      }
    }
  })

  it('叶子节点配置 link 后点击触发 onLink，父节点点击仍为展开', () => {
    const linked: MindTreeNode = {
      id: 'r',
      name: '根',
      children: [
        { id: 'a', name: 'A', link: '#mod-a' },
        { id: 'b', name: 'B', children: [{ id: 'b1', name: 'B1' }] }
      ]
    }
    const onLink = vi.fn()
    createMindTree(host, linked, { onLink, initialDepth: 1 })

    const leaf = host.querySelector('.mt-node[data-id="a"]') as SVGElement
    expect(leaf.classList.contains('is-link')).toBe(true)
    leaf.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onLink).toHaveBeenCalledWith('#mod-a', expect.objectContaining({ id: 'a' }))

    // 有子级的节点：点击是展开而非跳转
    const parent = host.querySelector('.mt-node[data-id="b"]') as SVGElement
    parent.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onLink).toHaveBeenCalledTimes(1)
    expect(host.querySelector('.mt-node[data-id="b1"]')).toBeTruthy()
  })

  it('destroy 清理容器与监听', () => {
    const tree = createMindTree(host, DATA)
    tree.destroy()
    expect(host.classList.contains('mt')).toBe(false)
    expect(host.innerHTML).toBe('')
    expect(host.querySelector('.mt-node')).toBeNull()
  })
})
