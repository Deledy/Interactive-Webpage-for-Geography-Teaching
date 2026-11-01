import { describe, it, expect, afterEach } from 'vitest'
import { renderMaterialLayout } from '../shared/quiz/content/renderMaterial'
import type { MaterialLayout } from '../shared/quiz/content/materialTypes'

function pointerEvent(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 })
}

function layout(): MaterialLayout {
  return {
    version: 1,
    width: 1000,
    height: 520,
    objects: [
      {
        id: 'text-1',
        type: 'text',
        x: 20,
        y: 20,
        width: 600,
        height: 120,
        html: '<p>材料文字</p>',
        style: { fontSize: 22, lineHeight: 1.7, textAlign: 'left' }
      },
      {
        id: 'table-1',
        type: 'table',
        x: 20,
        y: 180,
        width: 500,
        height: 200,
        html: '<table><tr><th>标题</th></tr><tr><td>单元格</td></tr></table>'
      }
    ]
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('画布交互 · 选中 / 拖动 / 双击编辑', () => {
  it('拖动超过阈值才移动，并只写一次撤销快照', () => {
    const begun: string[] = []
    const commits: string[] = []
    const root = renderMaterialLayout(layout(), {
      mode: 'edit',
      onObjectBegin: (id) => begun.push(id),
      onObjectCommit: (id) => commits.push(id)
    })
    const element = root.querySelector<HTMLElement>('[data-material-object-id="text-1"]')!

    element.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    /* 阈值内位移：只算点击，不移动、不写历史 */
    window.dispatchEvent(pointerEvent('pointermove', 102, 101))
    expect(begun).toHaveLength(0)
    expect(element.style.left).toBe('20px')

    window.dispatchEvent(pointerEvent('pointermove', 140, 130))
    window.dispatchEvent(pointerEvent('pointerup', 140, 130))

    expect(begun).toEqual(['text-1'])
    expect(element.style.left).toBe('60px')
    expect(element.style.top).toBe('50px')
    expect(commits).toEqual(['text-1'])
  })

  it('单击不移动也不写历史', () => {
    const begun: string[] = []
    const root = renderMaterialLayout(layout(), {
      mode: 'edit',
      onObjectBegin: (id) => begun.push(id)
    })
    const element = root.querySelector<HTMLElement>('[data-material-object-id="table-1"]')!
    element.dispatchEvent(pointerEvent('pointerdown', 100, 200))
    window.dispatchEvent(pointerEvent('pointerup', 100, 200))
    expect(begun).toHaveLength(0)
    expect(element.classList.contains('is-selected')).toBe(true)
  })

  it('已选中的表格正文仍可直接拖动（不再被 contenteditable 拦截）', () => {
    const root = renderMaterialLayout(layout(), { mode: 'edit' })
    const element = root.querySelector<HTMLElement>('[data-material-object-id="table-1"]')!
    const cell = element.querySelector<HTMLElement>('td')!

    /* 第一次点击：选中 */
    cell.dispatchEvent(pointerEvent('pointerdown', 100, 200))
    window.dispatchEvent(pointerEvent('pointerup', 100, 200))
    expect(element.classList.contains('is-selected')).toBe(true)

    /* 第二次按住正文拖动：应当移动 */
    cell.dispatchEvent(pointerEvent('pointerdown', 100, 200))
    window.dispatchEvent(pointerEvent('pointermove', 150, 240))
    window.dispatchEvent(pointerEvent('pointerup', 150, 240))
    expect(element.style.left).toBe('70px')
    expect(element.style.top).toBe('220px')
  })

  it('双击文字进入编辑态，编辑态下点正文不拖动，移动条仍可拖动', () => {
    const root = renderMaterialLayout(layout(), { mode: 'edit' })
    const element = root.querySelector<HTMLElement>('[data-material-object-id="text-1"]')!
    const body = element.querySelector<HTMLElement>('.cq-material__text')!

    element.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    window.dispatchEvent(pointerEvent('pointerup', 100, 100))
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))

    expect(element.classList.contains('is-editing')).toBe(true)
    expect(body.getAttribute('contenteditable')).toBe('true')

    /* 编辑态：正文里的按下只放光标 */
    body.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    window.dispatchEvent(pointerEvent('pointermove', 220, 200))
    window.dispatchEvent(pointerEvent('pointerup', 220, 200))
    expect(element.style.left).toBe('20px')

    /* 编辑态：顶部移动条拖动仍然生效 */
    const bar = element.querySelector<HTMLElement>('.cq-material__bar')!
    bar.dispatchEvent(pointerEvent('pointerdown', 50, 50))
    window.dispatchEvent(pointerEvent('pointermove', 90, 80))
    window.dispatchEvent(pointerEvent('pointerup', 90, 80))
    expect(element.style.left).toBe('60px')
    expect(element.style.top).toBe('50px')
  })

  it('Esc 退出编辑态', () => {
    const root = renderMaterialLayout(layout(), { mode: 'edit' })
    document.body.appendChild(root)
    const element = root.querySelector<HTMLElement>('[data-material-object-id="text-1"]')!
    const body = element.querySelector<HTMLElement>('.cq-material__text')!

    element.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    window.dispatchEvent(pointerEvent('pointerup', 100, 100))
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(body.getAttribute('contenteditable')).toBe('true')

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(element.classList.contains('is-editing')).toBe(false)
    expect(body.getAttribute('contenteditable')).toBe('false')
  })

  it('拖动四角缩放写入宽高', () => {
    const root = renderMaterialLayout(layout(), { mode: 'edit', selectedId: 'text-1' })
    const element = root.querySelector<HTMLElement>('[data-material-object-id="text-1"]')!
    const handle = element.querySelector<HTMLElement>('[data-handle="se"]')!
    handle.dispatchEvent(pointerEvent('pointerdown', 620, 140))
    window.dispatchEvent(pointerEvent('pointermove', 720, 200))
    window.dispatchEvent(pointerEvent('pointerup', 720, 200))
    expect(element.style.width).toBe('700px')
    expect(element.style.height).toBe('180px')
  })
})
