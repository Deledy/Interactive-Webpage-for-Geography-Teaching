import { describe, it, expect, afterEach } from 'vitest'
import { renderMaterialLayout } from '../shared/quiz/content/renderMaterial'
import { renderGroupPage, groupHasSlot } from '../shared/quiz/content/renderGroup'
import type { MaterialLayout } from '../shared/quiz/content/materialTypes'
import { createPracticeView } from '../shared/quiz/runtime/src/practiceWindow'
import { validateGroups } from '../shared/quiz/runtime/src/validate'
import { buildPracticeData } from '../shared/quiz/editor/src/model'
import type { CqGroup } from '../shared/quiz/content/types'

afterEach(() => {
  document.body.innerHTML = ''
})

function textObject(id: string, text: string, y = 24): MaterialLayout['objects'][number] {
  return { id, type: 'text', x: 24, y, width: 952, height: 100, html: '<p>' + text + '</p>' }
}

function slotObject(y = 160): MaterialLayout['objects'][number] {
  return { id: 'slot-1', type: 'slot', x: 24, y, width: 952, height: 260, optionLayout: { mode: 'flow', columns: 2 } }
}

function layout(objects: MaterialLayout['objects']): MaterialLayout {
  return { version: 1, width: 1000, height: 520, objects }
}

function group(id: string, stem: string, material: string): CqGroup {
  return {
    id,
    materialLayout: layout([textObject(id + '-text', material), slotObject()]),
    questions: [
      {
        id: id + '-q1',
        type: 'choice',
        stem,
        options: [
          { key: 'A', text: '甲' },
          { key: 'B', text: '乙' }
        ],
        answer: 'A',
        analysis: '材料关键词'
      }
    ]
  }
}

describe('题目槽 · 数据与校验', () => {
  it('一个题组只保留一个槽，重复槽被丢弃', () => {
    const issues: string[] = []
    const [checked] = validateGroups([
      {
        materialLayout: layout([textObject('t-1', '材料'), slotObject(120), slotObject(300)]),
        questions: [{ type: 'choice', stem: '题干', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], answer: 'A' }]
      }
    ], '题组', issues)
    const slots = checked.materialLayout!.objects.filter((object) => object.type === 'slot')
    expect(slots).toHaveLength(1)
  })

  it('有题目但没有槽时自动补一个槽', () => {
    const issues: string[] = []
    const [checked] = validateGroups([
      {
        materialLayout: layout([textObject('t-1', '材料')]),
        questions: [{ type: 'choice', stem: '题干', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], answer: 'A' }]
      }
    ], '题组', issues)
    expect(checked.materialLayout!.objects.some((object) => object.type === 'slot')).toBe(true)
    expect(groupHasSlot(checked)).toBe(true)
  })
})

describe('题目槽 · 渲染', () => {
  it('槽渲染传入的当前题；没有内容时显示占位提示', () => {
    const target = group('g1', '第 1 题题干', '阅读材料')
    const content = document.createElement('div')
    content.textContent = '当前题内容'
    const withContent = renderMaterialLayout(target.materialLayout!, { mode: 'view', slotContent: content })
    expect(withContent.querySelector('.cq-material__slot')!.textContent).toContain('当前题内容')
    expect(withContent.textContent).toContain('阅读材料')

    const empty = renderMaterialLayout(target.materialLayout!, { mode: 'view' })
    expect(empty.querySelector('.cq-material__slot-empty')).not.toBeNull()
  })

  it('换题只替换槽内容，材料不变', () => {
    const target = group('g1', '第 1 题题干', '阅读材料')
    const second = {
      id: 'g1-q2',
      type: 'choice' as const,
      stem: '第 2 题题干',
      options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }],
      answer: 'A'
    }
    const state = { selected: [], submitted: false, revealed: false }
    const page1 = renderGroupPage(target, target.questions[0], { key: 'q-0', index: 0, state })
    const page2 = renderGroupPage(target, second, { key: 'q-1', index: 1, state })

    expect(page1.textContent).toContain('第 1 题题干')
    expect(page1.textContent).not.toContain('第 2 题题干')
    expect(page2.textContent).toContain('第 2 题题干')
    expect(page2.textContent).toContain('阅读材料')
    expect(page1.querySelectorAll('.cq-qobj').length).toBe(1)
    expect(page1.querySelectorAll('.cq-qobj').length).toBe(page2.querySelectorAll('.cq-qobj').length)
  })
})

describe('题目槽 · 课程与预览', () => {
  it('逐题模式：一屏一页，组内切题不换画布，组末进入下一组画布', () => {
    const first = group('g1', '第一组第 1 题', '第一组材料')
    first.questions.push({
      id: 'g1-q2',
      type: 'choice',
      stem: '第一组第 2 题',
      options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }],
      answer: 'A'
    })
    const second = group('g2', '第二组第 1 题', '第二组材料')

    const view = createPracticeView({ mode: 'step', groups: [first, second] })
    document.body.appendChild(view.root)

    const page = () => view.root.querySelector('.cq-group--page')
    expect(page()).not.toBeNull()
    expect(page()!.textContent).toContain('第一组材料')
    expect(page()!.textContent).toContain('第一组第 1 题')

    view.root.querySelector<HTMLButtonElement>('[data-pw-next]')!.click()
    expect(page()!.textContent).toContain('第一组材料')
    expect(page()!.textContent).toContain('第一组第 2 题')
    expect(page()!.textContent).not.toContain('第一组第 1 题')

    view.root.querySelector<HTMLButtonElement>('[data-pw-next]')!.click()
    expect(page()!.textContent).toContain('第二组材料')
    expect(page()!.textContent).toContain('第二组第 1 题')
    expect(view.root.querySelectorAll('.cq-group--page').length).toBe(1)
    view.destroy()
  })

  it('逐题模式：槽内选项可点击判题', () => {
    const view = createPracticeView({ mode: 'step', groups: [group('g1', '题干', '材料')] })
    document.body.appendChild(view.root)
    const option = view.root.querySelector<HTMLElement>('[data-key="A"]')!
    expect(option.getAttribute('data-cq-opt')).toBe('q-0')
    option.click()
    expect(view.root.querySelector('.cq-qobj__verdict.is-right')).not.toBeNull()
    view.destroy()
  })

  it('列表模式：每道题一页纵向堆叠', () => {
    const first = group('g1', '第一组第 1 题', '第一组材料')
    first.questions.push({
      id: 'g1-q2',
      type: 'choice',
      stem: '第一组第 2 题',
      options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }],
      answer: 'A'
    })
    const view = createPracticeView({ groups: [first, group('g2', '第二组第 1 题', '第二组材料')] })
    document.body.appendChild(view.root)
    expect(view.root.querySelectorAll('.cq-group--page').length).toBe(3)
    view.destroy()
  })
})

describe('题目槽 · 编辑器导出', () => {
  it('导出 v5：保留题目槽与题目 id', () => {
    const payload = buildPracticeData({
      lesson: 'geo01',
      modules: { m: { title: '练习', groups: [group('g1', '题干', '材料')] } }
    }) as { version: number; modules: Record<string, { groups: CqGroup[] }> }
    expect(payload.version).toBe(5)
    const exported = payload.modules.m.groups[0]
    expect(exported.materialLayout!.objects.some((object) => object.type === 'slot')).toBe(true)
    expect(exported.questions[0].id).toBe('g1-q1')
  })
})
