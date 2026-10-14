import { describe, it, expect, afterEach, vi } from 'vitest'
import { createPracticeView } from '../shared/practice-window/src/practiceWindow'
import { renderMarkdown } from '../shared/practice-window/src/markdown'
import { validateQuizData } from '../shared/practice-window/src/validate'

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

const twoChoices = [
  { type: 'choice' as const, mode: 'single' as const, stem: '题干1', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], answer: 'A' },
  { type: 'choice' as const, mode: 'single' as const, stem: '题干2', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], answer: 'B' }
]

describe('PracticeWindow 组件', () => {
  it('markdown：==关键词== 渲染为 mark.pw-hl', () => {
    const html = renderMarkdown('材料中有 ==关键词== 高亮')
    expect(html).toContain('<mark class="pw-hl">关键词</mark>')
  })

  it('列表模式：渲染题号点阵导航与正计时器', () => {
    const view = createPracticeView({ title: '随堂练习', timer: true, questions: twoChoices })
    document.body.appendChild(view.root)
    expect(view.root.querySelectorAll('.pw-nav__dot').length).toBe(2)
    expect(view.root.querySelector('[data-pw-timer]')?.textContent).toBe('00:00')
    expect(view.root.querySelectorAll('.cq-q').length).toBe(2)
    view.destroy()
  })

  it('选择题：单选点选即判定并显示解析', () => {
    const view = createPracticeView({
      questions: [
        { type: 'choice', mode: 'single', stem: '题干', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], answer: 'A', analysis: '解析内容' }
      ]
    })
    document.body.appendChild(view.root)
    view.root.querySelector<HTMLButtonElement>('[data-key="A"]')!.click()
    expect(view.root.querySelector('.cq-verdict.is-right')).not.toBeNull()
    expect(view.root.querySelector('.cq-block--analysis')).not.toBeNull()
    view.destroy()
  })

  it('逐题模式：无进度条、仅计时器，切题由按钮手动触发', () => {
    const view = createPracticeView({ mode: 'step', timer: true, questions: twoChoices })
    document.body.appendChild(view.root)
    expect(view.root.querySelector('.pw-nav')).toBeNull()
    expect(view.root.querySelectorAll('.cq-q').length).toBe(1)
    expect(view.root.querySelector('[data-pw-timer]')?.textContent).toBe('00:00')
    view.root.querySelector<HTMLButtonElement>('[data-pw-next]')!.click()
    expect(view.root.querySelector('.cq-q__no')?.textContent).toBe('2')
    view.destroy()
  })

  it('计时器：正计时自动累加', () => {
    vi.useFakeTimers()
    const view = createPracticeView({ timer: true, questions: twoChoices })
    document.body.appendChild(view.root)
    expect(view.root.querySelector('[data-pw-timer]')?.textContent).toBe('00:00')
    vi.advanceTimersByTime(3000)
    expect(view.root.querySelector('[data-pw-timer]')?.textContent).toBe('00:03')
    view.destroy()
  })

  it('校验：丢弃非法题并记录问题', () => {
    const { data, issues } = validateQuizData({
      sections: [{ title: 's', questions: [{ type: 'choice', stem: '缺选项' }] }]
    })
    expect(data).toBeNull()
    expect(issues.length).toBeGreaterThan(0)
  })
})
