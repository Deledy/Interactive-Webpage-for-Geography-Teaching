/* ============================================================
   M3 流星案例 · 控制器状态机 与 天体物理模型 单元测试
   （纯逻辑测试，不依赖 Canvas / DOM 渲染）
   另含演示区域高度样式约束校验（读取 style.css 断言 4:5 竖版加高）。
   ============================================================ */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MeteorController } from '../lessons/geo01-earth-universe/src/modules/meteorController'
import { MeteorBody } from '../lessons/geo01-earth-universe/src/modules/meteorBody'

describe('MeteorController 状态机', () => {
  it('idle → start → playing，复位到阶段一', () => {
    const ctl = new MeteorController()
    expect(ctl.playState).toBe('idle')
    expect(ctl.step).toBe(0)
    ctl.start()
    expect(ctl.playState).toBe('playing')
    expect(ctl.stage).toBe(1)
    expect(ctl.step).toBe(1)
    expect(ctl.isActive()).toBe(true)
  })

  it('播放中可暂停/继续；未开始时暂停不生效', () => {
    const ctl = new MeteorController()
    ctl.pause()
    expect(ctl.playState).toBe('idle')
    ctl.start()
    ctl.pause()
    expect(ctl.playState).toBe('paused')
    expect(ctl.isActive()).toBe(false)
    ctl.resume()
    expect(ctl.playState).toBe('playing')
  })

  it('切换教学阶段 ①→②→③ 并触发 onStep 回调', () => {
    const steps: number[] = []
    const ctl = new MeteorController({ onStep: s => steps.push(s) })
    ctl.setStage(2)
    expect(ctl.stage).toBe(2)
    expect(ctl.step).toBe(2)
    ctl.setStage(3)
    expect(ctl.step).toBe(3)
    expect(steps).toEqual([2, 3])
  })

  it('finish 进入结论态（步骤4），replay 复位重播', () => {
    const ctl = new MeteorController()
    ctl.start()
    ctl.setStage(3)
    ctl.finish()
    expect(ctl.playState).toBe('done')
    expect(ctl.step).toBe(4)
    ctl.replay()
    expect(ctl.playState).toBe('playing')
    expect(ctl.step).toBe(1)
  })

  it('结论态下手动切阶段转为暂停（手动浏览）', () => {
    const ctl = new MeteorController()
    ctl.start()
    ctl.finish()
    expect(ctl.playState).toBe('done')
    ctl.setStage(2)
    expect(ctl.playState).toBe('paused')
    expect(ctl.step).toBe(2)
  })
})

describe('MeteorBody 物理模型', () => {
  const bounds = { minX: 0, maxX: 200, spaceMinY: 0, spaceMaxY: 80, atmTop: 100, groundY: 140 }

  it('流星体在太空层内缓慢漂浮：随机换向但始终约束在层内', () => {
    const b = new MeteorBody(100, 40, 4, { wanderSpeed: 10 })
    for (let i = 0; i < 2000; i++) {
      b.update(0.016, bounds)
      expect(b.x).toBeGreaterThanOrEqual(bounds.minX)
      expect(b.x).toBeLessThanOrEqual(bounds.maxX)
      expect(b.y).toBeGreaterThanOrEqual(bounds.spaceMinY)
      expect(b.y).toBeLessThanOrEqual(bounds.spaceMaxY)
    }
    expect(b.kind).toBe('meteoroid')
    expect(b.landed).toBe(false)
    expect(b.mode).toBe('wander')
  })

  it('同一块天体连续转变：流星体 → 流星 → 陨石（形态由位置驱动）', () => {
    const b = new MeteorBody(100, 90, 4, { entrySpeed: 20, accel: 200 })
    b.startEntry(Math.PI / 2) // 竖直向下
    // 穿过大气层上边界前，仍是流星体（同一块天体，尚未变身）
    b.update(0.016, bounds)
    expect(b.kind).toBe('meteoroid')
    expect(b.landed).toBe(false)

    let sawMeteor = false
    let maxSpeed = 0
    for (let i = 0; i < 1000; i++) {
      b.update(0.016, bounds)
      if (b.kind === 'meteor') {
        sawMeteor = true
        maxSpeed = Math.max(maxSpeed, Math.sqrt(b.vx * b.vx + b.vy * b.vy))
      }
      if (b.landed) break
    }
    expect(sawMeteor).toBe(true)          // 进入大气层后变为流星
    expect(maxSpeed).toBeGreaterThan(20)  // 进入大气层后加速
    expect(b.landed).toBe(true)
    expect(b.kind).toBe('meteorite')      // 落地后变为陨石
  })

  it('进入大气层后持续加速，最终落地成为陨石', () => {
    const b = new MeteorBody(100, 30, 4, { entrySpeed: 60, accel: 120 })
    b.startEntry(Math.PI / 2) // 竖直向下进入大气
    const speed0 = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
    let peakSpeed = speed0
    for (let i = 0; i < 600; i++) {
      b.update(0.016, bounds)
      if (b.kind === 'meteor') {
        peakSpeed = Math.max(peakSpeed, Math.sqrt(b.vx * b.vx + b.vy * b.vy))
      }
      if (b.landed) break
    }
    expect(peakSpeed).toBeGreaterThan(speed0) // 速度提升 → 加速
    expect(b.landed).toBe(true)
    expect(b.kind).toBe('meteorite')
    expect(b.vx).toBe(0)
    expect(b.vy).toBe(0)
    expect(b.y).toBe(bounds.groundY - b.r) // 停留在地面线上
    expect(b.trail).toHaveLength(0)
  })

  it('落地后静止停留，位置不再变化', () => {
    const b = new MeteorBody(100, 30, 4, { entrySpeed: 60, accel: 120 })
    b.startEntry(Math.PI / 2)
    for (let i = 0; i < 600; i++) {
      b.update(0.016, bounds)
      if (b.landed) break
    }
    const x0 = b.x
    const y0 = b.y
    for (let i = 0; i < 60; i++) b.update(0.016, bounds)
    expect(b.x).toBe(x0)
    expect(b.y).toBe(y0)
  })

  it('resetToWander 复位为太空漂浮的流星体', () => {
    const b = new MeteorBody(100, 30, 4, { entrySpeed: 60, accel: 120 })
    b.startEntry(Math.PI / 2)
    for (let i = 0; i < 600; i++) {
      b.update(0.016, bounds)
      if (b.landed) break
    }
    expect(b.landed).toBe(true)
    b.resetToWander(50, 20)
    expect(b.mode).toBe('wander')
    expect(b.kind).toBe('meteoroid')
    expect(b.landed).toBe(false)
    expect(b.x).toBe(50)
    expect(b.y).toBe(20)
    expect(b.trail).toHaveLength(0)
  })

  it('autoEnter：active 流星体带向下漂移，漂到大气层上边界即被自动吸引直接进入', () => {
    // 关闭随机水平速度（wanderSpeed=0），仅靠 sink 匀速下漂逼近大气层边界
    const b = new MeteorBody(100, 20, 4, {
      autoEnter: true, sink: 30, wanderSpeed: 0, entrySpeed: 40, accel: 0
    })
    b.active = true
    let entered = false
    for (let i = 0; i < 3000; i++) {
      b.update(0.016, bounds)
      if (b.mode === 'entry') {
        entered = true
        break
      }
    }
    expect(entered).toBe(true)                     // 漂到边界自动进入，无需外部触发
    expect(b.kind).toBe('meteoroid')               // 进入瞬间仍为流星体（同一块天体）
    // 继续演进：穿过大气层边界后变为流星并最终落地为陨石
    let sawMeteor = false
    for (let i = 0; i < 600; i++) {
      b.update(0.016, bounds)
      if (b.kind === 'meteor') sawMeteor = true
      if (b.landed) break
    }
    expect(sawMeteor).toBe(true)
    expect(b.landed).toBe(true)
    expect(b.kind).toBe('meteorite')
  })
})

describe('M3 演示区域高度（加高样式约束）', () => {
  it('style.css 中演示画布采用 4:5 竖版加高且受视口高度约束', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'lessons/geo01-earth-universe/src/styles/style.css'),
      'utf-8'
    )
    // 演示容器：4:5 竖版 + 高度可达 70vh（显著高于原 460×300 的横向示意图）
    expect(css).toMatch(/\.meteor-stage__canvas\s*\{[\s\S]*aspect-ratio:\s*4\s*\/\s*5/)
    expect(css).toMatch(/\.meteor-stage__canvas\s*\{[\s\S]*calc\(70vh\s*\*\s*0\.8\)/)
    expect(css).toMatch(/\.meteor-canvas\s*\{/)
  })
})
