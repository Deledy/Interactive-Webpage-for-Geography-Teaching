import { describe, it, expect, afterEach } from 'vitest'
import { createMaterialEditor } from '../shared/quiz/editor/src/materialEditor'
import { normalizeModule } from '../shared/quiz/editor/src/model'
import type { MaterialLayout } from '../shared/quiz/content/materialTypes'
import type { CqGroup } from '../shared/quiz/content/types'

function emptyLayout(): MaterialLayout {
  return { version: 1, width: 1000, height: 400, background: '#ffffff', objects: [] }
}

function group(): CqGroup {
  return { id: 'g-1', layout: 'stacked', materialLayout: emptyLayout(), questions: [] }
}

function mountEditor(editorGroup: CqGroup, onChange: () => void = () => {}) {
  const mount = document.createElement('div')
  document.body.appendChild(mount)
  const editor = createMaterialEditor({
    mount,
    group: editorGroup,
    createQuestion: () => ({
      id: '',
      type: 'choice',
      stem: '',
      options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: '' })),
      answer: 'A',
      analysis: ''
    }),
    confirm: (_message: string, onYes: () => void) => onYes(),
    onChange
  })
  return { mount, editor }
}

function click(mount: HTMLElement, selector: string): void {
  const node = mount.querySelector<HTMLElement>(selector)
  if (!node) throw new Error('缺少元素：' + selector)
  node.click()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('画布 + 题目槽 · 插入题目', () => {
  it('插入题目只创建一个槽，题目进入槽内', () => {
    const instance = group()
    const { mount } = mountEditor(instance)
    expect(mount.querySelector('[data-path]')).toBeNull()

    click(mount, '[data-mat="insert-question"]')

    expect(instance.questions).toHaveLength(1)
    const slots = instance.materialLayout!.objects.filter((object) => object.type === 'slot')
    expect(slots).toHaveLength(1)
    expect(instance.materialLayout!.objects.length).toBe(1)

    expect(mount.querySelectorAll('.cq-qobj').length).toBe(1)
    expect(mount.querySelectorAll('.cq-qobj--edit').length).toBe(1)
    expect(mount.querySelector('.cq-qobj [contenteditable="true"]')).not.toBeNull()
    expect(mount.querySelector('.cq-qobj [data-cq-opt]')).toBeNull()
    expect(mount.querySelector('[data-qsub]')).not.toBeNull()
  })

  it('再插入一道题：题目数 +1，画布仍只有一个题块', () => {
    const instance = group()
    const { mount } = mountEditor(instance)
    click(mount, '[data-mat="insert-question"]')
    click(mount, '[data-mat="insert-question"]')

    expect(instance.questions).toHaveLength(2)
    expect(mount.querySelectorAll('.cq-qobj').length).toBe(1)
    expect(mount.querySelectorAll('[data-qsub]').length).toBe(2)
    /* 插入后自动切到新题 */
    expect(mount.querySelector('.ce-slot-count')!.textContent).toContain('第 2 / 2 题')
  })

  it('上一题 / 下一题切换槽内容，画布对象数不变', () => {
    const instance = group()
    const { mount } = mountEditor(instance)
    click(mount, '[data-mat="insert-question"]')
    const firstStem = mount.querySelector<HTMLElement>('[data-edit="stem"]')!
    firstStem.textContent = '第一题的题干'
    firstStem.dispatchEvent(new Event('input', { bubbles: true }))

    click(mount, '[data-mat="insert-question"]')
    const secondStem = mount.querySelector<HTMLElement>('[data-edit="stem"]')!
    secondStem.textContent = '第二题的题干'
    secondStem.dispatchEvent(new Event('input', { bubbles: true }))
    expect(mount.querySelector('[data-edit="stem"]')!.textContent).toContain('第二题')

    const objectsBefore = instance.materialLayout!.objects.length
    click(mount, '[data-qnav="prev"]')
    expect(mount.querySelector('[data-edit="stem"]')!.textContent).toContain('第一题')
    expect(instance.materialLayout!.objects.length).toBe(objectsBefore)
    expect((instance.questions[0] as { stem: string }).stem).toBe('第一题的题干')
    expect((instance.questions[1] as { stem: string }).stem).toBe('第二题的题干')
  })
})

describe('画布 + 题目槽 · 就地编辑', () => {
  it('画布内直接改选项与正确答案', () => {
    const instance = group()
    const { mount } = mountEditor(instance)
    click(mount, '[data-mat="insert-question"]')

    const option = mount.querySelector<HTMLElement>('[data-edit="option"][data-key="A"]')!
    option.textContent = '位于城市中心'
    option.dispatchEvent(new Event('input', { bubbles: true }))
    expect((instance.questions[0] as { options: Array<{ text: string }> }).options[0].text).toBe('位于城市中心')

    click(mount, '[data-answer-key="B"]')
    expect((instance.questions[0] as { answer: string }).answer).toBe('B')
    expect(mount.querySelector('[data-answer-key="B"]')!.classList.contains('is-on')).toBe(true)
  })

  it('画布内改题干与解析写回题目数据', () => {
    const instance = group()
    const { mount } = mountEditor(instance)
    click(mount, '[data-mat="insert-question"]')

    const stem = mount.querySelector<HTMLElement>('[data-edit="stem"]')!
    stem.textContent = '老城南更新的优势是'
    stem.dispatchEvent(new Event('input', { bubbles: true }))
    expect((instance.questions[0] as { stem: string }).stem).toBe('老城南更新的优势是')

    click(mount, '[data-qobj-action="toggle-analysis"]')
    const analysis = mount.querySelector<HTMLElement>('[data-edit="analysis"]')!
    analysis.textContent = '文化底蕴深厚'
    analysis.dispatchEvent(new Event('input', { bubbles: true }))
    expect((instance.questions[0] as { analysis: string }).analysis).toContain('文化底蕴深厚')
  })

  it('解析按钮可以再次点击收起（就地开合，不重绘画布）', () => {
    const instance = group()
    const { mount } = mountEditor(instance)
    click(mount, '[data-mat="insert-question"]')

    /* 模拟真实指针：先 pointerdown 触发开合，再 click 不应重复触发 */
    const press = () => {
      const button = mount.querySelector<HTMLElement>('[data-qobj-action="toggle-analysis"]')!
      button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      button.click()
    }
    const panel = () => mount.querySelector<HTMLElement>('[data-edit="analysis"]')

    press()
    expect(panel()!.hidden).toBe(false)
    expect(mount.querySelector('[data-qobj-action="toggle-analysis"]')!.textContent).toBe('收起解析')

    press()
    expect(panel()!.hidden).toBe(true)
    expect(mount.querySelector('[data-qobj-action="toggle-analysis"]')!.textContent).toBe('解析')
  })
})

describe('画布 + 题目槽 · 子题目', () => {
  it('删除当前题可撤销，槽保留', () => {
    const instance = group()
    const { mount } = mountEditor(instance)
    click(mount, '[data-mat="insert-question"]')
    click(mount, '[data-mat="add-subquestion"]')
    expect(instance.questions).toHaveLength(2)

    click(mount, '[data-mat="del-subquestion"]')
    expect(instance.questions).toHaveLength(1)
    expect(mount.querySelectorAll('.cq-qobj').length).toBe(1)
    expect(instance.materialLayout!.objects.some((object) => object.type === 'slot')).toBe(true)

    click(mount, '[data-mat="undo"]')
    expect(instance.questions).toHaveLength(2)
  })

  it('属性栏 chips 切换当前题', () => {
    const instance = group()
    const { mount } = mountEditor(instance)
    click(mount, '[data-mat="insert-question"]')
    const stem = mount.querySelector<HTMLElement>('[data-edit="stem"]')!
    stem.textContent = '第一题'
    stem.dispatchEvent(new Event('input', { bubbles: true }))

    click(mount, '[data-mat="add-subquestion"]')
    const second = mount.querySelector<HTMLElement>('[data-edit="stem"]')!
    second.textContent = '第二题'
    second.dispatchEvent(new Event('input', { bubbles: true }))

    click(mount, '[data-qsub="0"]')
    expect(mount.querySelector('[data-edit="stem"]')!.textContent).toBe('第一题')
    click(mount, '[data-qsub="1"]')
    expect(mount.querySelector('[data-edit="stem"]')!.textContent).toBe('第二题')
  })

  it('题型切换为综合题：题干变为设问，清空选项', () => {
    const instance = group()
    const { mount } = mountEditor(instance)
    click(mount, '[data-mat="insert-question"]')

    const stem = mount.querySelector<HTMLElement>('[data-edit="stem"]')!
    stem.textContent = '判断小明说法并说明理由'
    stem.dispatchEvent(new Event('input', { bubbles: true }))

    const select = mount.querySelector<HTMLSelectElement>('[data-qprop="type"]')!
    select.value = 'essay'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    const question = instance.questions[0] as { type: string; stems?: string[] }
    expect(question.type).toBe('essay')
    expect(question.stems?.[0]).toBe('判断小明说法并说明理由')
    expect(mount.querySelector('[data-qobj-action="toggle-answer"]')).not.toBeNull()
  })

  it('主观题「编辑参考答案」在槽内展开并写回', () => {
    const instance = group()
    const { mount } = mountEditor(instance)
    click(mount, '[data-mat="insert-question"]')
    const select = mount.querySelector<HTMLSelectElement>('[data-qprop="type"]')!
    select.value = 'essay'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    click(mount, '[data-qobj-action="toggle-answer"]')
    const editor = mount.querySelector<HTMLElement>('[data-edit="answer"]')
    expect(editor).not.toBeNull()
    editor!.textContent = '参考答案内容'
    editor!.dispatchEvent(new Event('input', { bubbles: true }))
    expect((instance.questions[0] as { referenceAnswer: string }).referenceAnswer).toContain('参考答案内容')
  })
})

describe('数据模型 · 载入归一化', () => {
  it('normalizeModule 为有题目的题组补一个题目槽', () => {
    const mod: Record<string, unknown> = {
      groups: [
        {
          layout: 'stacked',
          materialLayout: {
            version: 1,
            width: 1000,
            height: 400,
            objects: [{ id: 'text-1', type: 'text', x: 20, y: 20, width: 900, height: 120, html: '<p>材料</p>' }]
          },
          questions: [
            {
              type: 'choice',
              stem: '题干',
              options: [
                { key: 'A', text: '甲' },
                { key: 'B', text: '乙' }
              ],
              answer: 'A'
            }
          ]
        }
      ]
    }
    normalizeModule(mod as never)
    const normalized = (mod.groups as Array<Record<string, unknown>>)[0]
    const questions = normalized.questions as Array<Record<string, unknown>>
    expect(questions[0].id).toBe('q-1')
    const layout = normalized.materialLayout as { objects: Array<Record<string, unknown>> }
    const slot = layout.objects.find((object) => object.type === 'slot') as { y: number }
    expect(slot).toBeTruthy()
    /* 槽排在材料下方，不与文字对象重叠 */
    expect(slot.y).toBeGreaterThan(140)
  })
})
