import { describe, it, expect, beforeEach } from 'vitest'
import { initCustomQuiz } from '../lessons/geo01-earth-universe/src/modules/customQuiz'

const data = {
  version: 1,
  lesson: 'geo01-earth-universe',
  title: '自定义练习',
  subtitle: '副标题 **加粗**',
  sections: [
    {
      id: 'a',
      title: '一、选择题',
      questions: [
        {
          type: 'choice',
          mode: 'single',
          material: '材料段落\n\n| 列1 | 列2 |\n| --- | --- |\n| a | b |',
          stem: '单选题干',
          options: [
            { key: 'A', text: '甲' },
            { key: 'B', text: '乙' }
          ],
          answer: 'A',
          analysis: '解析 **要点**',
          knowledge: { title: '归纳', items: ['点1', '点2'] }
        },
        {
          type: 'choice',
          mode: 'multiple',
          stem: '多选题干',
          options: [
            { key: 'A', text: '甲' },
            { key: 'B', text: '乙' },
            { key: 'C', text: '丙' }
          ],
          answer: ['A', 'C'],
          analysis: '解析2'
        }
      ]
    },
    {
      id: 'b',
      title: '二、综合题',
      questions: [
        {
          type: 'essay',
          material: '![图](./x.svg)',
          stems: ['（1）问一', '（2）问二'],
          referenceAnswer: '参考答案内容',
          analysis: '解析内容',
          criteria: ['标准1', '标准2']
        }
      ]
    }
  ]
}

function host(): HTMLElement {
  return document.getElementById('quiz-custom-body') as HTMLElement
}

function q(index: number): HTMLElement {
  return host().querySelectorAll<HTMLElement>('.cq-q')[index]
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  document.body.innerHTML = '<button data-cq-reset></button><div id="quiz-custom-body"></div>'
  ;(window as unknown as { __CUSTOM_QUIZ__: unknown }).__CUSTOM_QUIZ__ = data
})

describe('customQuiz', () => {
  it('渲染题目、表格、图片与副标题', async () => {
    initCustomQuiz()
    await tick()
    expect(host().querySelectorAll('.cq-q').length).toBe(3)
    expect(host().querySelector('.cq-table')).not.toBeNull()
    expect(host().querySelector('.cq-img')).not.toBeNull()
    expect(host().querySelector('.cq-intro strong')?.textContent).toBe('加粗')
  })

  it('单选：点选即判定并显示解析', async () => {
    initCustomQuiz()
    await tick()
    q(0).querySelector<HTMLButtonElement>('[data-key="A"]')!.click()
    expect(host().querySelector('.cq-verdict.is-right')).not.toBeNull()
    expect(host().querySelector('.cq-block--analysis')).not.toBeNull()
  })

  it('多选：选择后提交才判定', async () => {
    initCustomQuiz()
    await tick()
    expect(host().querySelector('.cq-submit')).not.toBeNull()
    q(1).querySelector<HTMLButtonElement>('[data-key="A"]')!.click()
    q(1).querySelector<HTMLButtonElement>('[data-key="C"]')!.click()
    q(1).querySelector<HTMLButtonElement>('.cq-submit')!.click()
    const verdict = q(1).querySelector('.cq-verdict')
    expect(verdict?.classList.contains('is-right')).toBe(true)
  })

  it('综合题：点击展开参考答案与评分标准', async () => {
    initCustomQuiz()
    await tick()
    expect(host().querySelector('.cq-block--answer')).toBeNull()
    q(2).querySelector<HTMLButtonElement>('.cq-reveal')!.click()
    expect(host().querySelector('.cq-block--answer')).not.toBeNull()
    expect(host().querySelector('.cq-block--criteria')).not.toBeNull()
  })

  it('重置：清空作答状态', async () => {
    initCustomQuiz()
    await tick()
    q(0).querySelector<HTMLButtonElement>('[data-key="A"]')!.click()
    document.querySelector<HTMLButtonElement>('[data-cq-reset]')!.click()
    expect(host().querySelector('.cq-verdict')).toBeNull()
  })

  it('无数据：显示空态', async () => {
    ;(window as unknown as { __CUSTOM_QUIZ__: unknown }).__CUSTOM_QUIZ__ = { sections: [] }
    initCustomQuiz()
    await tick()
    expect(host().querySelector('.cq-empty')).not.toBeNull()
  })

  it('损坏数据：无有效题目时回退空态并提示', async () => {
    ;(window as unknown as { __CUSTOM_QUIZ__: unknown }).__CUSTOM_QUIZ__ = {
      sections: [{ title: '断节', questions: [{ type: 'choice', stem: '缺少选项与答案' }] }]
    }
    initCustomQuiz()
    await tick()
    expect(host().querySelectorAll('.cq-q').length).toBe(0)
    expect(host().querySelector('.cq-empty')).not.toBeNull()
    expect(host().querySelector('.cq-empty__issues')).not.toBeNull()
  })

  it('部分损坏：丢弃非法题，渲染有效题', async () => {
    ;(window as unknown as { __CUSTOM_QUIZ__: unknown }).__CUSTOM_QUIZ__ = {
      sections: [{
        id: 'a',
        title: '一、选择题',
        questions: [
          { type: 'choice', stem: '缺选项' },
          { type: 'choice', stem: '有效题', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], answer: 'A' }
        ]
      }]
    }
    initCustomQuiz()
    await tick()
    expect(host().querySelectorAll('.cq-q').length).toBe(1)
    expect(host().querySelector('.cq-empty')).toBeNull()
  })
})
