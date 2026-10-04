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
    expect(document.querySelectorAll('#life-chain .chain').length).toBe(5)
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
    // 控制条：主控（开始/暂停/继续）+ 重播两个按钮；演示状态为纯状态指示，不是按钮
    expect(document.querySelectorAll('[data-meteor-action]')).toHaveLength(2)
    expect(document.querySelector('[data-meteor-status]')).toBeTruthy()
    expect(document.querySelector('button[data-meteor-status]')).toBeNull()
    expect(document.querySelector('[data-meteor-status]')!.getAttribute('data-state')).toBe('idle')
    // 判别三条件静态展示（全亮），不随动画步骤点亮；每条 = logo + 标题 + 内容
    expect(document.querySelectorAll('.condition-item')).toHaveLength(3)
    expect(document.querySelectorAll('.condition-item.is-lit')).toHaveLength(3)
    expect(document.querySelectorAll('.condition-item .condition-item__logo svg use')).toHaveLength(3)
    // 每个 logo 均带「环形光带 + 星芒光点」多层光环层
    expect(document.querySelectorAll('.condition-item .condition-item__halo')).toHaveLength(3)
    expect(document.querySelectorAll('.condition-item .condition-item__sparks')).toHaveLength(3)
    expect(document.querySelector('.condition-item .condition-item__key')!.textContent).toBeTruthy()
    expect(document.querySelector('.condition-item .condition-item__desc')!.textContent).toBeTruthy()
    // 两卡标题：主标题 + 副标题（判别三条件的判据前提 / 综合判断的设问）
    expect(document.querySelector('#meteor-conditions .cosmic-title')!.textContent).toBe('判别三条件')
    expect(document.querySelector('#meteor-conditions .cosmic-sub')!.textContent)
      .toBe('同时满足以下三条，才是天体')
    expect(document.getElementById('meteor-judge-title')!.textContent).toBe('综合判断')
    expect(document.querySelector('#meteor-judgment .cosmic-sub')!.textContent)
      .toBe('下列哪些是天体，哪些不是天体？')
    // 综合判断：流星体 / 流星现象 / 陨石，答案默认隐藏，逐行由按钮揭晓
    expect(document.querySelectorAll('.judge-item')).toHaveLength(3)
    expect(Array.from(document.querySelectorAll('.judge-item__verdict')).map(v => v.textContent))
      .toEqual(['是天体', '不是天体', '不是天体'])
    // 已移除：条目说明文字与底部结论卡片
    expect(document.querySelectorAll('.judge-item__desc')).toHaveLength(0)
    expect(document.getElementById('meteor-conclusion')).toBeNull()
    const judgeBtns = Array.from(document.querySelectorAll('[data-judge-toggle]')) as HTMLButtonElement[]
    expect(judgeBtns).toHaveLength(3)
    judgeBtns.forEach(btn => {
      expect(btn.tagName).toBe('BUTTON')
      expect(btn.getAttribute('aria-expanded')).toBe('false')
      expect(btn.querySelector('.judge-btn__icon')).toBeTruthy()   // 眼睛图标
      expect(btn.textContent).toContain('查看答案')
    })
  })

  it('「查看答案」：逐行默认隐藏判断结果，点击揭晓后可再次收起', () => {
    initMeteorCase()
    const rows = Array.from(document.querySelectorAll('.judge-item'))
    const btn = rows[1].querySelector('[data-judge-toggle]') as HTMLButtonElement
    expect(rows.some(r => r.classList.contains('is-open'))).toBe(false)
    btn.click()
    expect(rows[1].classList.contains('is-open')).toBe(true)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(btn.textContent).toContain('隐藏答案')
    // 逐行独立：其余行仍保持隐藏
    expect(rows.filter(r => r.classList.contains('is-open'))).toHaveLength(1)
    btn.click()
    expect(rows[1].classList.contains('is-open')).toBe(false)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(btn.textContent).toContain('查看答案')
  })

  it('开始演示 → playing：控制条联动，判别条件与综合判断保持静态不变', () => {
    const ctl = initMeteorCase()!
    expect(ctl.playState).toBe('idle')
    ;(document.querySelector('[data-meteor-action="toggle"]') as HTMLElement).click()
    expect(ctl.playState).toBe('playing')
    const status = document.querySelector('[data-meteor-status]')!
    expect(status.getAttribute('data-state')).toBe('playing')
    expect(status.textContent!.trim()).toBe('演示中')   // 已移除阶段文字（① 流星体 · 太空 等）
    expect((document.querySelector('[data-meteor-action="replay"]') as HTMLButtonElement).disabled).toBe(false)
    // 条件动画与动画播放解耦：不再随步骤点亮/熄灭；综合判断仍为默认隐藏（未点击查看答案）
    expect(document.querySelectorAll('.condition-item.is-lit')).toHaveLength(3)
    expect(document.querySelectorAll('.judge-item.is-open')).toHaveLength(0)
  })

  it('暂停/继续切换主控按钮，并同步演示状态指示', () => {
    const ctl = initMeteorCase()!
    ctl.start()
    const toggleBtn = document.querySelector('[data-meteor-action="toggle"]') as HTMLButtonElement
    expect(toggleBtn.textContent).toContain('暂停')
    toggleBtn.click()
    expect(ctl.playState).toBe('paused')
    expect(toggleBtn.textContent).toContain('继续')
    expect(document.querySelector('[data-meteor-status]')!.textContent).toContain('已暂停')
    toggleBtn.click()
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

describe('M8 生命条件因果链（静态分组）', () => {
  it('按外部/自身条件渲染两组因果链与总结论', () => {
    initLifeChain()
    expect(document.querySelectorAll('.life-panel')).toHaveLength(2)
    expect(document.querySelectorAll('.chain')).toHaveLength(5)
    const tags = Array.from(document.querySelectorAll('.life-panel__title .tag')).map(t => t.textContent)
    expect(tags).toEqual(['外部条件', '自身条件'])
    expect(document.getElementById('life-conclusion')!.textContent).toContain('共同作用')
  })
})

describe('M7 行星的运动特征', () => {
  it('渲染同向性、近圆性、共面性三张特征卡，并由按钮联动高亮', () => {
    initMotionFeatures()
    expect(document.querySelectorAll('.motion-feature')).toHaveLength(3)
    const names = Array.from(document.querySelectorAll('.motion-feature__name')).map(n => n.textContent)
    expect(names).toEqual(['同向性', '近圆性', '共面性'])

    // 默认选中「近圆性」，选中态唯一
    expect(document.querySelectorAll('.motion-feature.is-active')).toHaveLength(1)
    expect(document.querySelector('.motion-feature.is-active .motion-feature__name')!.textContent)
      .toBe('近圆性')

    // 按钮与子卡片联动：选中态唯一，其余恢复默认
    const button = (name: string) =>
      document.querySelector(`.orbit-feature-btn[data-feature="${name}"]`) as HTMLButtonElement
    button('共面性').click()
    expect(button('共面性').getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelectorAll('.orbit-feature-btn.is-active')).toHaveLength(1)
    expect(document.querySelectorAll('.motion-feature.is-active')).toHaveLength(1)
    expect(document.querySelector('.motion-feature.is-active .motion-feature__name')!.textContent)
      .toBe('共面性')

    button('同向性').click()
    expect(button('共面性').getAttribute('aria-pressed')).toBe('false')
    expect(document.querySelectorAll('.motion-feature.is-active')).toHaveLength(1)
    expect(document.querySelector('.motion-feature.is-active .motion-feature__name')!.textContent)
      .toBe('同向性')
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
    expect(document.querySelectorAll('.solar-group')).toHaveLength(3)
    expect(
      Array.from(document.querySelectorAll('.solar-group__title')).map(e => e.textContent)
    ).toEqual(['类地行星', '巨行星', '远日行星'])

    ;(document.querySelector('.solar-planet[data-planet="earth"]') as Element)
      .dispatchEvent(new MouseEvent('click'))
    expect(App.selectedPlanet).toBe('earth')
    expect(document.querySelector('.solar-card__name')!.textContent).toContain('地球')
  })

  it('选中态为克制的卡片内高亮：名称标签金色 + 下方短金线，且选中态在切换时唯一转移', () => {
    initSolarSystem()
    const at = (id: string) => document.querySelector(`.solar-planet[data-planet="${id}"]`)!

    // 八颗行星各带一条选中指示线（未选中时收起），且不再有大范围光环与扩散粒子
    expect(document.querySelectorAll('.solar-planet-tag__rule')).toHaveLength(8)
    expect(document.querySelectorAll('.solar-planet-aura')).toHaveLength(0)

    // 行星切换：选中态（金色标签 + 指示线）始终唯一，不残留上一颗
    const click = (id: string) => at(id).dispatchEvent(new MouseEvent('click'))
    click('venus')
    expect(document.querySelectorAll('.solar-planet.is-active')).toHaveLength(1)
    expect(at('venus').classList.contains('is-active')).toBe(true)

    click('mars')
    expect(document.querySelectorAll('.solar-planet.is-active')).toHaveLength(1)
    expect(at('mars').classList.contains('is-active')).toBe(true)
    expect(at('venus').classList.contains('is-active')).toBe(false)
    expect(App.selectedPlanet).toBe('mars')

    // 详情卡片影像：所有行星共用同一圆角矩形取景框 + 真实行星照片，不再叠加任何 CSS 环片
    click('earth')
    const media = document.querySelector('.planet-detail-media')!
    const img = media.querySelector('.planet-detail-media__image') as HTMLImageElement
    expect(img).toBeTruthy()
    expect(img.hasAttribute('data-lightbox')).toBe(true)
    expect(media.querySelectorAll('.planet-detail-media__ring')).toHaveLength(0)

    click('saturn')
    expect(document.querySelectorAll('.planet-detail-media__ring')).toHaveLength(0)
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
