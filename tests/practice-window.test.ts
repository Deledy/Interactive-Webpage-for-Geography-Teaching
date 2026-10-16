import { describe, it, expect, afterEach, vi } from 'vitest'
import { createPracticeView, openPracticeWindow } from '../shared/practice-window/src/practiceWindow'
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

  it('主题令牌覆盖：theme 写入根节点 --pw-* 变量', () => {
    const view = createPracticeView({ theme: { '--pw-accent': '#123456' }, questions: twoChoices })
    document.body.appendChild(view.root)
    expect(view.root.style.getPropertyValue('--pw-accent')).toBe('#123456')
    view.destroy()
  })

  it('窗口骨架：显示「第 x / n 题」且「当前题」点唯一', () => {
    const view = createPracticeView({ questions: twoChoices })
    document.body.appendChild(view.root)
    expect(view.root.querySelector('[data-pw-progress]')?.textContent).toBe('第 1 / 2 题')
    expect(view.root.querySelectorAll('.pw-nav__dot.is-current').length).toBe(1)
    view.destroy()
  })

  it('全屏：点击「全屏」按钮切换 is-fullscreen', () => {
    const view = createPracticeView({ fullscreen: true, questions: twoChoices })
    document.body.appendChild(view.root)
    view.root.querySelector<HTMLButtonElement>('[data-pw-fullscreen]')!.click()
    expect(view.root.classList.contains('is-fullscreen')).toBe(true)
    view.destroy()
  })

  it('限时：limitSeconds 以倒计时显示', () => {
    vi.useFakeTimers()
    const view = createPracticeView({ limitSeconds: 60, questions: twoChoices })
    document.body.appendChild(view.root)
    expect(view.root.querySelector('[data-pw-timer]')?.textContent).toBe('01:00')
    vi.advanceTimersByTime(3000)
    expect(view.root.querySelector('[data-pw-timer]')?.textContent).toBe('00:57')
    view.destroy()
  })

  it('浮层窗口：单实例 + 滚动锁定 + Esc 关闭', () => {
    const first = openPracticeWindow({ title: 'A', questions: twoChoices })
    expect(document.querySelector('.pw-overlay')).not.toBeNull()
    expect(document.body.style.overflow).toBe('hidden')
    const second = openPracticeWindow({ title: 'B', questions: twoChoices })
    expect(document.querySelectorAll('.pw-overlay').length).toBe(1)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.querySelector('.pw-overlay')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    first.close()
    second.close()
  })

  it('页内挂载：传入 container 不建浮层，底部「重做」清空作答', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const handle = openPracticeWindow({ container: host, questions: twoChoices })
    expect(document.querySelector('.pw-overlay')).toBeNull()
    expect(host.querySelector('.pw-foot')).not.toBeNull()
    host.querySelector<HTMLButtonElement>('[data-key="A"]')!.click()
    expect(host.querySelector('.cq-verdict')).not.toBeNull()
    host.querySelector<HTMLButtonElement>('[data-pw-reset]')!.click()
    expect(host.querySelector('.cq-verdict')).toBeNull()
    handle.close()
  })

  it('窗口容错：数据损坏时走空态、不白屏', () => {
    const handle = openPracticeWindow({
      data: { sections: [{ title: 's', questions: [{ type: 'choice', stem: '缺选项' }] }] } as never
    })
    expect(handle.root.querySelector('.cq-empty')).not.toBeNull()
    handle.close()
  })

  it('左右布局：左栏题目、右栏答案解析（作答前给出提示）', () => {
    const view = createPracticeView({
      questions: [
        { type: 'choice', mode: 'single', stem: '题干', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], answer: 'A', analysis: '解析内容' }
      ]
    })
    document.body.appendChild(view.root)
    const main = view.root.querySelector('.pw-col--main')!
    const side = view.root.querySelector('.pw-col--side')!
    expect(main.querySelector('.cq-q__stem')).not.toBeNull()
    expect(main.querySelectorAll('.cq-opt').length).toBe(2)
    expect(side.querySelector('.cq-q__awaiting')).not.toBeNull()

    view.root.querySelector<HTMLButtonElement>('[data-key="A"]')!.click()
    const sideAfter = view.root.querySelector('.pw-col--side')!
    expect(sideAfter.querySelector('.cq-verdict.is-right')).not.toBeNull()
    expect(sideAfter.querySelector('.cq-block--analysis')).not.toBeNull()
    expect(view.root.querySelector('.pw-col--main .cq-verdict')).toBeNull()
    view.destroy()
  })

  it('左右布局（综合题）：左栏设问、右栏展开参考答案与评分标准', () => {
    const view = createPracticeView({
      questions: [
        { type: 'essay', material: '材料', stems: ['（1）问一'], referenceAnswer: '参考答案', criteria: ['标准1'] }
      ]
    })
    document.body.appendChild(view.root)
    expect(view.root.querySelector('.pw-col--main .cq-stems')).not.toBeNull()
    expect(view.root.querySelector('.pw-col--side .cq-q__awaiting')).not.toBeNull()

    view.root.querySelector<HTMLButtonElement>('.cq-reveal')!.click()
    expect(view.root.querySelector('.pw-col--side .cq-block--answer')).not.toBeNull()
    expect(view.root.querySelector('.pw-col--side .cq-block--criteria')).not.toBeNull()
    view.destroy()
  })
})
