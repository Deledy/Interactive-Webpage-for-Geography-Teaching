/* ============================================================
   DOM 交互功能测试（jsdom 环境）
   直接加载真实 index.html 的 body 结构，逐个模块做交互级验证，
   同时覆盖"无 JS 静态降级 / WebGL 缺失降级 2D / 拖拽点击降级"等兼容性路径。
   ============================================================ */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { App } from '../lessons/geo01-earth-universe/src/state'
import { init } from '../lessons/geo01-earth-universe/src/main'
import { initMeteorCase } from '../lessons/geo01-earth-universe/src/modules/meteor'
import { initHierarchy } from '../lessons/geo01-earth-universe/src/modules/hierarchy'
import { initLifeChain } from '../lessons/geo01-earth-universe/src/modules/life'
import { initMotionFeatures } from '../lessons/geo01-earth-universe/src/modules/planets'
import { initReviewTree } from '../lessons/geo01-earth-universe/src/modules/review'
import { initPracticeModal } from '../lessons/geo01-earth-universe/src/modules/practiceModal'
import { initExtendModal } from '../lessons/geo01-earth-universe/src/modules/extendModal'
import { initSolarSystem } from '../lessons/geo01-earth-universe/src/modules/solar'

function loadLessonBody(): string {
  const html = readFileSync(
    resolve(process.cwd(), 'lessons/geo01-earth-universe/index.html'),
    'utf-8'
  )
  const m = html.match(/<body>([\s\S]*)<\/body>/)
  let body = m ? m[1] : ''
  // 移除 script / noscript 标签，仅保留静态结构与模板（noscript 内容在启用 JS 时不渲染）
  body = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<noscript>[\s\S]*?<\/noscript>/gi, '')
  return body
}

const BODY = loadLessonBody()

// jsdom 未实现 canvas 2D 上下文：静默降级为 null（避免 "Not implemented" 日志噪音），
// 与无 WebGL / 无 canvas 时的降级路径一致，保证各模块仍可完成 DOM 层验证。
beforeAll(() => {
  const stub = (): CanvasRenderingContext2D | null => null
  HTMLCanvasElement.prototype.getContext = stub as unknown as typeof HTMLCanvasElement.prototype.getContext
})

beforeEach(() => {
  document.body.innerHTML = BODY
})

describe('无 JS 静态降级（兼容性）', () => {
  it('核心模块保留静态讲解与占位面板，可无脚本阅读', () => {
    expect(document.querySelector('#meteor-stage.panel--hint')).toBeTruthy()
    expect(document.querySelector('#hierarchy-ring .panel__placeholder')).toBeTruthy()
    expect(document.querySelectorAll('#body-deck .body-deck__card').length).toBe(7)
    expect(document.querySelectorAll('#meteor-conditions .condition-item.is-lit').length).toBe(3)
    expect(document.querySelector('#life-chain .panel__placeholder')).toBeTruthy()
    expect(document.querySelector('#orbit-viewport .panel__placeholder')).toBeTruthy()
  })
})

describe('M3 流星案例（循环动画 + 静态判别条件）', () => {
  it('初始化渲染 Canvas 与控制条，无阶段页签，三条件静态全亮', () => {
    const ctl = initMeteorCase()
    expect(ctl).toBeTruthy()
    expect(document.querySelector('.meteor-canvas')).toBeTruthy()
    // 动画界面最下方的①流星体/②流星/③陨石文字提示已删除
    expect(document.querySelectorAll('.meteor-stage-tab')).toHaveLength(0)
    expect(document.querySelector('.meteor-demo__stages')).toBeNull()
    expect(document.querySelectorAll('[data-meteor-action]')).toHaveLength(3)
    // 判别三条件静态展示（全亮），不随动画步骤点亮
    expect(document.querySelectorAll('.condition-item')).toHaveLength(3)
    expect(document.querySelectorAll('.condition-item.is-lit')).toHaveLength(3)
  })

  it('开始演示 → playing：控制条联动，判别条件与结论保持静态不变', () => {
    const ctl = initMeteorCase()!
    expect(ctl.playState).toBe('idle')
    ;(document.querySelector('[data-meteor-action="start"]') as HTMLElement).click()
    expect(ctl.playState).toBe('playing')
    expect((document.querySelector('[data-meteor-action="pause"]') as HTMLButtonElement).disabled).toBe(false)
    // 条件动画与动画播放解耦：不再随步骤点亮/熄灭
    expect(document.querySelectorAll('.condition-item.is-lit')).toHaveLength(3)
    expect(document.getElementById('meteor-conclusion')!.textContent).toContain('不是天体')
  })

  it('暂停/继续切换控制条', () => {
    const ctl = initMeteorCase()!
    ctl.start()
    const pauseBtn = document.querySelector('[data-meteor-action="pause"]') as HTMLButtonElement
    pauseBtn.click()
    expect(ctl.playState).toBe('paused')
    expect(pauseBtn.textContent).toContain('继续')
    pauseBtn.click()
    expect(ctl.playState).toBe('playing')
  })

  it('重播触发 replay 并复位场景', () => {
    const ctl = initMeteorCase()!
    ctl.start()
    ;(document.querySelector('[data-meteor-action="replay"]') as HTMLElement).click()
    expect(ctl.playState).toBe('playing')
    expect(document.querySelectorAll('.condition-item.is-lit')).toHaveLength(3)
  })
})

describe('M5 天体系统层级（聚焦切换）', () => {
  it('渲染 4 层圆环，可上下级切换并更新信息区', () => {
    initHierarchy()
    expect(document.querySelectorAll('.hier-ring')).toHaveLength(4)
    const info = document.getElementById('hierarchy-info')!
    expect(info.textContent).toContain('地月系')
    expect(document.querySelector('.hier-ring.is-active')!.getAttribute('data-level')).toBe('0')

    ;(document.querySelector('[data-hier-next]') as HTMLElement).click()
    expect(App.level).toBe(1)
    expect(info.textContent).toContain('太阳系')

    ;(document.querySelector('[data-hier-prev]') as HTMLElement).click()
    expect(App.level).toBe(0)
    expect(info.textContent).toContain('地月系')
  })
})

describe('M8 生命条件因果链（分步点亮）', () => {
  it('渲染 5 条链并逐条点亮至总结论', () => {
    initLifeChain()
    expect(document.querySelectorAll('.chain')).toHaveLength(5)
    const btn = document.querySelector('[data-widget="life-next"]') as HTMLElement
    expect(document.querySelectorAll('.chain.is-lit')).toHaveLength(0)

    for (let i = 0; i < 6; i++) btn.click()
    expect(App.lifeStep).toBe(6)
    expect(document.getElementById('life-conclusion')!.textContent).toContain('总结论')
    expect(btn.textContent).toBe('重新开始')
  })
})

describe('M7 行星的运动特征', () => {
  it('渲染同向性、近圆性、共面性三张特征卡', () => {
    initMotionFeatures()
    expect(document.querySelectorAll('.motion-feature')).toHaveLength(3)
    const names = Array.from(document.querySelectorAll('.motion-feature__name')).map(n => n.textContent)
    expect(names).toEqual(['同向性', '近圆性', '共面性'])
  })
})

describe('M9 复习与总结', () => {
  it('渲染结构树，可折叠并切换复习模式', () => {
    initReviewTree()
    expect(document.querySelectorAll('.tree__toggle').length).toBeGreaterThan(0)

    const toggle = document.querySelector('.tree__toggle') as HTMLElement
    const li = toggle.closest('.tree__item')!
    toggle.click()
    expect(li.classList.contains('is-open')).toBe(false)

    const modeBtn = document.querySelector('[data-widget="review-mode"]') as HTMLElement
    modeBtn.click()
    expect(document.body.classList.contains('review-mode')).toBe(true)
    expect(App.reviewMode).toBe(true)
    expect(modeBtn.textContent).toBe('退出复习模式')
  })
})

describe('随堂练习浮层', () => {
  it('M1 选择题：打开浮层渲染题目，点选正确项即时反馈', () => {
    initPracticeModal()
    ;(document.querySelector('[data-practice="M1"]') as HTMLElement).click()
    const modal = document.getElementById('practice-modal')!
    expect(modal.hidden).toBe(false)
    expect(document.querySelectorAll('.practice-q')).toHaveLength(3)

    const firstOpts = document.querySelectorAll('.practice-q')[0].querySelectorAll('.practice-q__opt')
    ;(firstOpts[1] as HTMLElement).click() // 第一题正确答案下标 1
    const fb = document.querySelector('.practice-q__feedback')!
    expect(fb.textContent).toContain('✓ 正确')
    expect(fb.classList.contains('is-correct')).toBe(true)
  })

  it('M3 拖拽分类（点击降级路径）：选卡→入框→即时反馈', () => {
    initPracticeModal()
    ;(document.querySelector('[data-practice="M3"]') as HTMLElement).click()
    expect(document.querySelectorAll('.drag-card')).toHaveLength(9)

    ;(document.querySelector('.drag-card[data-card="moon"]') as HTMLElement).click()
    ;(document.querySelector('.drop-zone[data-type="celestial"]') as HTMLElement).click()
    expect(document.querySelector('[data-drop="celestial"] .drag-card[data-card="moon"]')).toBeTruthy()
    expect(document.querySelector('[data-drag-feedback]')!.textContent).toContain('正确')
  })
})

describe('M10 拓展浮层', () => {
  it('M1 拓展：打开浮层并渲染逐级放大演示（4 层圆环）', () => {
    initExtendModal()
    ;(document.querySelector('.extend-btn[data-section="M1"]') as HTMLElement).click()
    const modal = document.getElementById('extend-modal')!
    expect(modal.hidden).toBe(false)
    expect(document.querySelectorAll('#extend-universe-demo .ring')).toHaveLength(4)
  })
})

describe('M6 太阳系（WebGL 缺失自动降级 2D）', () => {
  it('jsdom 无 WebGL 时渲染 2D SVG 轨道图，点击行星更新信息', () => {
    initSolarSystem()
    expect(document.querySelector('.solar-svg')).toBeTruthy()
    expect(document.querySelectorAll('.solar-planet')).toHaveLength(8)

    ;(document.querySelector('.solar-planet[data-planet="earth"]') as Element)
      .dispatchEvent(new MouseEvent('click'))
    expect(App.selectedPlanet).toBe('earth')
    expect(document.querySelector('.solar-status')!.textContent).toContain('地球')
  })
})

describe('整页启动冒烟', () => {
  it('按 main.ts 顺序初始化所有模块不抛错，核心组件全部渲染', () => {
    expect(() => init()).not.toThrow()
    expect(document.querySelector('.meteor-canvas')).toBeTruthy()
    expect(document.querySelector('.hierarchy-svg')).toBeTruthy()
    expect(document.querySelector('.solar-svg')).toBeTruthy()
    expect(document.querySelector('.tree')).toBeTruthy()
    expect(document.querySelectorAll('.motion-feature')).toHaveLength(3)
    expect(document.querySelector('.orbit2d')).toBeTruthy()
    expect(document.querySelectorAll('.chain')).toHaveLength(5)
  })
})
