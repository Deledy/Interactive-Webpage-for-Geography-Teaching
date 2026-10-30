import { describe, it, expect, afterEach, vi } from 'vitest'
import { createPracticeView, openPracticeWindow } from '../shared/quiz/runtime/src/practiceWindow'
import { renderRichText } from '../shared/quiz/content/richText'
import { validateQuizData } from '../shared/quiz/runtime/src/validate'

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

const twoChoices = [
  { type: 'choice' as const, mode: 'single' as const, stem: '题干1', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], answer: 'A' },
  { type: 'choice' as const, mode: 'single' as const, stem: '题干2', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], answer: 'B' }
]

describe('PracticeWindow 组件', () => {
  it('富文本：HTML 关键词高亮经清洗后保留 mark.cq-hl', () => {
    const html = renderRichText('<p>材料中有 <mark class="cq-hl">关键词</mark> 高亮</p>')
    expect(html).toContain('<mark class="cq-hl">关键词</mark>')
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

  it('逐题模式：题目区单题渲染、顶部显示进度与计时器', () => {
    const view = createPracticeView({ mode: 'step', timer: true, questions: twoChoices })
    document.body.appendChild(view.root)
    expect(view.root.querySelector('.pw-nav')).toBeNull()
    expect(view.root.querySelectorAll('.cq-q').length).toBe(1)
    expect(view.root.querySelector('[data-pw-timer]')?.textContent).toBe('00:00')
    expect(view.root.querySelector('[data-pw-progress]')?.textContent).toBe('第 1 / 2 题')
    view.root.querySelector<HTMLButtonElement>('[data-pw-next]')!.click()
    expect(view.root.querySelector('.cq-q__no')?.textContent).toBe('02')
    expect(view.root.querySelector('[data-pw-progress]')?.textContent).toBe('第 2 / 2 题')
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

  it('上下布局：题目（题干 + 选项）在上，说明（判定 + 解析）在下', () => {
    const view = createPracticeView({
      questions: [
        { type: 'choice', mode: 'single', stem: '题干', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], answer: 'A', analysis: '解析内容' }
      ]
    })
    document.body.appendChild(view.root)
    expect(view.root.querySelector('.cq-q__panes')?.classList.contains('is-single')).toBe(true)

    const question = view.root.querySelector('.cq-pane__segment--question')!
    const note = view.root.querySelector('.cq-pane__segment--note')!
    expect(question.querySelector('.cq-q__stem')).not.toBeNull()
    expect(question.querySelectorAll('.cq-opt').length).toBe(2)
    expect(note.querySelector('.cq-q__awaiting')).not.toBeNull()

    view.root.querySelector<HTMLButtonElement>('[data-key="A"]')!.click()
    const noteAfter = view.root.querySelector('.cq-pane__segment--note')!
    expect(noteAfter.querySelector('.cq-verdict.is-right')).not.toBeNull()
    expect(noteAfter.querySelector('.cq-block--analysis')).not.toBeNull()
    expect(view.root.querySelector('.cq-pane__segment--question .cq-verdict')).toBeNull()
    view.destroy()
  })

  it('左右布局（主观题）：材料在左，设问与参考答案在右上，解析在右下', () => {
    const view = createPracticeView({
      questions: [
        { type: 'essay', material: '材料', stems: ['（1）问一'], referenceAnswer: '参考答案', analysis: '解析内容' }
      ]
    })
    document.body.appendChild(view.root)
    expect(view.root.querySelector('.cq-pane--material .cq-q__material')?.textContent).toContain('材料')
    expect(view.root.querySelector('.cq-pane__segment--question .cq-stems')).not.toBeNull()
    expect(view.root.querySelector('.cq-pane__segment--note .cq-q__awaiting')).not.toBeNull()

    view.root.querySelector<HTMLButtonElement>('.cq-reveal')!.click()
    const question = view.root.querySelector('.cq-pane__segment--question')!
    const note = view.root.querySelector('.cq-pane__segment--note')!
    expect(question.querySelector('.cq-block--answer')).not.toBeNull()
    expect(note.querySelector('.cq-block--analysis')).not.toBeNull()
    expect(note.querySelector('.cq-block--answer')).toBeNull()
    view.destroy()
  })

  it('浮层默认：逐题模式 + 自动计时 + 关闭按钮', () => {
    const handle = openPracticeWindow({ title: '练习', questions: twoChoices })
    const root = handle.root
    expect(root.classList.contains('pw--step')).toBe(true)
    expect(root.querySelector('[data-pw-timer]')).not.toBeNull()
    expect(root.querySelector('[data-pw-close]')).not.toBeNull()
    expect(root.querySelector('[data-pw-progress]')?.textContent).toBe('第 1 / 2 题')
    // 无材料题在浮层逐题模式下仍保留左栏（提示占位），保证窗口始终左右布局
    expect(root.querySelector('.cq-q__panes')?.classList.contains('has-empty-material')).toBe(true)
    expect(root.querySelector('.cq-pane--material.is-empty')).not.toBeNull()
    handle.close()
  })
})
