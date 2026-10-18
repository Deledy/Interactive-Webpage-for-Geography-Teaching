import { describe, it, expect, afterEach } from 'vitest'
import { openPracticeWindow } from '../shared/quiz/runtime/src/practiceWindow'
import { createPreviewStage } from '../shared/quiz/runtime/src/previewStage'

const questions = [
  {
    type: 'choice' as const,
    mode: 'single' as const,
    stem: '题干',
    options: [
      { key: 'A', text: '甲' },
      { key: 'B', text: '乙' }
    ],
    answer: 'A'
  }
]

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

describe('运行时 · 嵌入展示模式', () => {
  it('嵌入模式：窗口铺满指定画布，不挂到 body、不锁定滚动', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)

    const handle = openPracticeWindow({
      container: host,
      display: 'embedded',
      title: '整窗预览',
      questions,
      timer: true,
      closable: true
    })

    const overlay = host.querySelector('.pw-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay?.classList.contains('pw-overlay--embedded')).toBe(true)
    expect(overlay?.parentElement).toBe(host)
    expect(document.body.style.overflow).toBe('')
    expect(host.querySelector('.cq-q')).not.toBeNull()
    expect(host.querySelector('[data-pw-timer]')).not.toBeNull()

    handle.close()
    expect(host.querySelector('.pw-overlay')).toBeNull()
  })

  it('嵌入模式：关闭回调只触发一次', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    let count = 0

    const handle = openPracticeWindow({
      container: host,
      display: 'embedded',
      questions,
      onClose: () => {
        count += 1
      }
    })

    handle.close()
    handle.close()
    expect(count).toBe(1)
  })

  it('真实课程浮层行为不变：挂到 body 并锁定滚动', () => {
    const handle = openPracticeWindow({ questions })

    const overlay = document.body.querySelector('.pw-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay?.classList.contains('pw-overlay--embedded')).toBe(false)
    expect(document.body.style.overflow).toBe('hidden')

    handle.close()
    expect(document.body.style.overflow).toBe('')
  })
})

describe('预览画布 · 1920×1080', () => {
  it('按设计尺寸创建，挂载点位于画布内', () => {
    const stage = createPreviewStage()
    expect(stage.canvas.style.width).toBe('1920px')
    expect(stage.canvas.style.height).toBe('1080px')
    expect(stage.canvas.contains(stage.mount)).toBe(true)
    stage.destroy()
  })

  it('缩放：数值档位按倍数缩放并同步外层高度', () => {
    const stage = createPreviewStage({ zoom: 0.5 })
    expect(stage.canvas.style.transform).toBe('scale(0.5)')
    expect(stage.root.style.height).toBe('540px')

    stage.setZoom(1)
    expect(stage.canvas.style.transform).toBe('scale(1)')
    expect(stage.root.style.height).toBe('1080px')
    stage.destroy()
  })

  it('缩放：适应宽度在无布局信息时退化为 1 倍，不报错', () => {
    const stage = createPreviewStage({ zoom: 'fit' })
    expect(stage.canvas.style.transform).toBe('scale(1)')
    stage.destroy()
  })

  it('主题令牌写在画布上，供窗口与卡片继承', () => {
    const stage = createPreviewStage({ theme: { '--pw-accent': '#FFD54F' } })
    expect(stage.canvas.style.getPropertyValue('--pw-accent')).toBe('#FFD54F')
    stage.destroy()
  })

  it('整窗预览：窗口挂在画布内，可交互，关闭后画布仍在', () => {
    const stage = createPreviewStage()
    document.body.appendChild(stage.root)

    const handle = openPracticeWindow({
      container: stage.mount,
      display: 'embedded',
      title: '整窗预览',
      questions,
      timer: true,
      closable: true
    })

    const overlay = stage.mount.querySelector('.pw-overlay--embedded')
    expect(overlay).not.toBeNull()

    overlay!.querySelector<HTMLButtonElement>('[data-key="A"]')!.click()
    expect(stage.mount.querySelector('.cq-verdict.is-right')).not.toBeNull()

    overlay!.querySelector<HTMLButtonElement>('[data-pw-close]')!.click()
    expect(stage.mount.querySelector('.pw-overlay')).toBeNull()
    expect(document.body.contains(stage.root)).toBe(true)

    handle.close()
    stage.destroy()
  })
})
