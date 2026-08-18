/* ============================================================
   M3 流星案例 · Canvas 演示场景
   三层纵向布局：太空（流星体漂浮）→ 大气层 → 地面（薄层）。
   叙事主线：所有漂浮的流星体都走同一套完整旅程——
     在太空中自由漂浮，当漂到大气层上边界时，被大气层自动吸引、
     直接进入大气层并加速燃烧（变为流星），落地后成为陨石，
     在地面短暂停留后重新在太空中生成，各自循环演示（错峰进行）。
   注意：不再采用"分阶段播放"方式，进入大气层完全由物理边界触发。
   技术要点：
   - Canvas 2D 绘制全部元素，不依赖 DOM 粒子；
   - GSAP 负责落地冲击光效与被大气层吸引的提示光效；
   - 无 2D 上下文（如 jsdom / 旧环境）时安全降级为纯逻辑模式。
   ============================================================ */
import gsap from 'gsap'
import { prefersReducedMotion } from '../utils/dom'
import { MeteorBody } from './meteorBody'
import type { LayerBounds } from './meteorBody'
import type { MeteorController, MeteorPlayState } from './meteorController'

/** 背景星点（坐标用 0~1 比例，随画布缩放） */
interface Star {
  fx: number
  fy: number
  r: number
  base: number
  phase: number
  twinkleSpeed: number
}

/** 落地尘埃粒子 */
interface Dust {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  r: number
}

/** 冲击 / 吸引光效状态（由 GSAP 补间，一个实例对应一次效果） */
interface Flash {
  x: number
  y: number
  scale: number
  alpha: number
}

const EASE = 'power2.out'

export class MeteorScene {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null = null
  private w = 0
  private h = 0
  private scale = 1
  private bounds: LayerBounds = {
    minX: 6, maxX: 6, spaceMinY: 8, spaceMaxY: 8, atmTop: 8, groundY: 8
  }

  private stars: Star[] = []
  /** 全部流星体：每一块都完整经历"漂浮 → 吸引进入 → 燃烧 → 落地 → 重新生成" */
  private bodies: MeteorBody[] = []
  private dusts: Dust[] = []
  private impacts: Flash[] = []
  private attracts: Flash[] = []
  private time = 0

  /** 陨石落地后停留时长（秒），随后重新生成流星体循环演示 */
  private readonly respawnDelay = 3
  private impacted = new WeakSet<MeteorBody>()
  private landedAt = new Map<MeteorBody, number>()

  private ctl: MeteorController | null = null
  private raf = 0
  private running = false
  private last = 0
  private tweens: gsap.core.Tween[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    try {
      this.ctx = canvas.getContext('2d')
    } catch {
      this.ctx = null
    }

    // 背景星点：随机散布整个画布，闪烁参数各不相同
    const N = 90
    for (let i = 0; i < N; i++) {
      this.stars.push({
        fx: Math.random(),
        fy: Math.random(),
        r: 0.6 + Math.random() * 1.1,
        base: 0.35 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 1 + Math.random() * 2
      })
    }

    window.addEventListener('resize', this.resize)
    this.resize()
    this.resetWorld()
  }

  /** 绑定控制器（只读读取 playState），由入口模块调用 */
  bind(controller: MeteorController): void {
    this.ctl = controller
  }

  /** 演示运行状态变化 → 暂停/恢复 GSAP 补间（推进由 render loop 控制） */
  applyPlayState(state: MeteorPlayState): void {
    if (state === 'paused') this.tweens.forEach(t => t.pause())
    else if (state === 'playing') this.tweens.forEach(t => t.play())
  }

  /** 重新开始演示：所有流星体回到太空中重新漂浮 */
  resetDemo(): void {
    this.resetWorld()
  }

  /** 启动渲染循环（无 2D 上下文时跳过，保持纯逻辑可用） */
  start(): void {
    if (this.running || !this.ctx) return
    this.running = true
    this.last = 0
    this.raf = requestAnimationFrame(this.loop)
  }

  destroy(): void {
    this.running = false
    if (this.raf) cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.resize)
  }

  /** 响应式缩放：按显示尺寸 × dpr 设置画布分辨率并重算层界 */
  private resize = (): void => {
    const cw = this.canvas.clientWidth || 640
    const ch = this.canvas.clientHeight || Math.round(cw * 1.25)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(cw * dpr)
    this.canvas.height = Math.round(ch * dpr)
    this.w = cw
    this.h = ch
    if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.scale = Math.min(Math.max(this.h / 600, 0.6), 1.6)
    // 太空（约 30%）/ 大气层（约 60%）/ 地面（约 10%，薄层）
    this.bounds = {
      minX: 6,
      maxX: Math.max(7, this.w - 6),
      spaceMinY: 8,
      spaceMaxY: Math.max(9, Math.round(this.h * 0.30) - 6),
      atmTop: Math.round(this.h * 0.30),
      groundY: Math.round(this.h * 0.90)
    }
  }

  private randX(): number {
    return 12 + Math.random() * Math.max(10, this.w - 24)
  }

  private randSpaceY(): number {
    return this.bounds.spaceMinY + Math.random() * (this.bounds.spaceMaxY - this.bounds.spaceMinY)
  }

  private bodyR(): number {
    // 增大个体尺寸：不规则石块半径 2.2~4.6（随画布比例缩放）
    return (2.2 + Math.random() * 2.4) * this.scale
  }

  /** 创建一块流星体：带向下漂移，漂到大气层边界自动被吸引进入（autoEnter） */
  private createBody(): MeteorBody {
    const s = this.scale
    // 进入方向以竖直向下为主，略作随机偏转，让轨迹更自然
    const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.5
    return new MeteorBody(this.randX(), this.randSpaceY(), this.bodyR(), {
      // 加快漂浮速度：上下左右漂移更快
      wanderSpeed: (18 + Math.random() * 12) * s,
      // 加快下坠：被吸引进入大气后加速更猛，燃烧段更紧凑
      accel: 32 * s,
      entrySpeed: (75 + Math.random() * 35) * s,
      maxTrail: 24,
      autoEnter: true,
      sink: (11 + Math.random() * 7) * s,
      entryAngle: angle
    })
  }

  private tweenDur(base: number): number {
    return prefersReducedMotion ? 0.001 : base
  }

  /** 重建世界：全部流星体回到太空，各自开始循环旅程 */
  private resetWorld(): void {
    const count = 18
    this.bodies = []
    for (let i = 0; i < count; i++) {
      this.bodies.push(this.createBody())
    }
    this.dusts = []
    this.impacts = []
    this.attracts = []
    this.impacted = new WeakSet()
    this.landedAt = new Map()
  }

  /** 落地冲击：GSAP 光效圆环 + 尘埃粒子迸溅 */
  private spawnImpact(b: MeteorBody): void {
    const flash: Flash = { x: b.x, y: b.y, scale: 0.2, alpha: 1 }
    this.impacts.push(flash)
    this.tweens.push(gsap.fromTo(flash, { scale: 0.2, alpha: 1 }, {
      scale: 2.4, alpha: 0,
      duration: this.tweenDur(0.8),
      ease: EASE,
      overwrite: true
    }))
    const n = 10
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = (20 + Math.random() * 55) * this.scale
      this.dusts.push({
        x: b.x, y: b.y,
        vx: Math.cos(a) * sp,
        vy: -Math.abs(Math.sin(a)) * sp * 0.75,
        life: 1, maxLife: 1,
        r: (1 + Math.random() * 1.6) * this.scale
      })
    }
  }

  /** 被大气层吸引的瞬间：蓝色提示光效 */
  private spawnAttract(x: number, y: number): void {
    const flash: Flash = { x, y, scale: 0.4, alpha: 1 }
    this.attracts.push(flash)
    this.tweens.push(gsap.fromTo(flash, { scale: 0.4, alpha: 1 }, {
      scale: 1.8, alpha: 0,
      duration: this.tweenDur(0.7),
      ease: EASE,
      overwrite: true
    }))
  }

  private loop = (now: number): void => {
    if (!this.running) return
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.05) : 0
    this.last = now
    const frozen = !!this.ctl && this.ctl.playState === 'paused'
    if (!frozen) this.update(dt)
    this.draw()
    this.raf = requestAnimationFrame(this.loop)
  }

  private update(dt: number): void {
    this.time += dt
    const ctl = this.ctl
    const active = !!ctl && ctl.playState === 'playing'

    // 全部流星体：仅"播放中"激活完整旅程（带向下漂移漂浮 → 漂到边界被吸引进入）
    for (const b of this.bodies) {
      b.active = active
      const prevMode = b.mode
      b.update(dt, this.bounds)
      // 被大气层吸引的瞬间：触发蓝色提示光效
      if (prevMode === 'wander' && b.mode === 'entry') {
        this.spawnAttract(b.x, b.y)
      }
      // 落地：触发冲击光效，并登记落地时间用于循环重生
      if (b.landed && !this.impacted.has(b)) {
        this.impacted.add(b)
        this.landedAt.set(b, this.time)
        this.spawnImpact(b)
      }
    }

    // 陨石在地面停留片刻后，重新在太空中生成流星体，各自循环演示
    for (const b of this.bodies) {
      if (b.landed && this.impacted.has(b)) {
        const t = this.landedAt.get(b) ?? 0
        if (this.time - t > this.respawnDelay) {
          b.resetToWander(this.randX(), this.randSpaceY())
          this.impacted.delete(b)
          this.landedAt.delete(b)
        }
      }
    }

    // 尘埃粒子：受重力下落并消散
    for (const d of this.dusts) {
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.vy += 60 * this.scale * dt
      d.life -= dt * 1.2
    }
    this.dusts = this.dusts.filter(d => d.life > 0)

    // 清理已结束的冲击 / 吸引光效
    this.impacts = this.impacts.filter(f => f.alpha > 0.02)
    this.attracts = this.attracts.filter(f => f.alpha > 0.02)
  }

  private draw(): void {
    const ctx = this.ctx
    if (!ctx || this.w <= 0 || this.h <= 0) return
    const { w, h } = this

    // 1. 深空背景：由上至下 太空 → 大气 → 地面
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#05081a')
    bg.addColorStop(0.30, '#070c24')
    bg.addColorStop(0.9, '#0a1a33')
    bg.addColorStop(1, '#0d1230')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // 2. 星点（轻微闪烁）
    for (const s of this.stars) {
      const a = s.base * (0.55 + 0.45 * Math.sin(this.time * s.twinkleSpeed + s.phase))
      ctx.globalAlpha = Math.max(0, Math.min(1, a))
      ctx.fillStyle = s.r > 1.1 ? '#cfd8ff' : '#ffffff'
      ctx.fillRect(s.fx * w, s.fy * h, s.r, s.r)
    }
    ctx.globalAlpha = 1

    // 3. 大气层：半透明色带 + 虚线边界
    const atmTop = h * 0.30
    const atmBot = h * 0.90
    ctx.fillStyle = 'rgba(79,195,247,0.08)'
    ctx.fillRect(0, atmTop, w, atmBot - atmTop)
    ctx.strokeStyle = 'rgba(79,195,247,0.45)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(0, atmTop); ctx.lineTo(w, atmTop); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, atmBot); ctx.lineTo(w, atmBot); ctx.stroke()
    ctx.setLineDash([])

    // 4. 地面：薄层深色地表 + 地表线 + 少量陨石坑纹理
    ctx.fillStyle = 'rgba(13,18,48,0.95)'
    ctx.fillRect(0, atmBot, w, h - atmBot)
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(0, atmBot); ctx.lineTo(w, atmBot); ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    for (let i = 0; i < 10; i++) {
      const gx = ((i * 97) % 100) / 100 * w
      const gy = atmBot + 6 + ((i * 53) % 34)
      ctx.beginPath(); ctx.arc(gx, gy, 1.5, 0, Math.PI * 2); ctx.fill()
    }

    // 5. 层标签
    ctx.fillStyle = 'rgba(232,234,246,0.65)'
    ctx.font = `600 ${Math.max(13, h * 0.024)}px system-ui, sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText('太空', w - 12, 26)
    ctx.fillText('大气层', w - 12, (atmTop + atmBot) / 2 + 5)
    ctx.fillText('地面', w - 12, h - 18)

    // 6. 天体个体（流星体 / 流星 / 陨石）
    for (const b of this.bodies) this.drawBody(ctx, b)

    // 7. 尘埃
    for (const d of this.dusts) {
      ctx.fillStyle = `rgba(170,140,100,${Math.max(0, d.life) * 0.7})`
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill()
    }

    // 8. 冲击光效圆环（落地）
    for (const f of this.impacts) {
      const r = Math.max(2, 12 * f.scale * this.scale)
      ctx.strokeStyle = `rgba(255,213,79,${f.alpha})`
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = `rgba(255,213,79,${f.alpha * 0.35})`
      ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.55, 0, Math.PI * 2); ctx.fill()
    }

    // 9. 大气层吸引光效（进入大气层瞬间）
    for (const f of this.attracts) {
      const r = Math.max(2, 10 * f.scale * this.scale)
      ctx.strokeStyle = `rgba(79,195,247,${f.alpha})`
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.stroke()
      ctx.fillStyle = `rgba(79,195,247,${f.alpha * 0.3})`
      ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.7, 0, Math.PI * 2); ctx.fill()
    }
  }

  /** 由天体的 seed 生成稳定的不规则岩石多边形（半径 b.r，顶点围绕中心） */
  private rockPoints(b: MeteorBody, radius = 1): { x: number; y: number }[] {
    let s = Math.floor(b.seed * 233280) % 233280 || 1
    const rnd = (): number => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    const n = 8
    const pts: { x: number; y: number }[] = []
    const base = radius * b.r
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.35
      const rr = base * (0.72 + rnd() * 0.56)
      pts.push({ x: b.x + Math.cos(a) * rr, y: b.y + Math.sin(a) * rr })
    }
    return pts
  }

  private drawBody(ctx: CanvasRenderingContext2D, b: MeteorBody): void {
    const rock = this.rockPoints(b)

    if (b.kind === 'meteoroid') {
      // 流星体：不规则灰蓝石块，带顶光
      ctx.fillStyle = '#8d93ab'
      ctx.beginPath(); ctx.moveTo(rock[0].x, rock[0].y)
      for (let i = 1; i < rock.length; i++) ctx.lineTo(rock[i].x, rock[i].y)
      ctx.closePath(); ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.lineWidth = 1
      ctx.stroke()
      // 顶部高光（左上）
      const hl = this.rockPoints(b, 0.45)
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      ctx.beginPath(); ctx.moveTo(hl[0].x - b.r * 0.35, hl[0].y - b.r * 0.35)
      for (let i = 1; i < hl.length; i++) ctx.lineTo(hl[i].x - b.r * 0.35, hl[i].y - b.r * 0.35)
      ctx.closePath(); ctx.fill()
    } else if (b.kind === 'meteor') {
      // 流星：发光拖尾（逐段渐变）+ 不规则岩石亮核
      for (let i = 1; i < b.trail.length; i++) {
        const p0 = b.trail[i - 1]
        const p1 = b.trail[i]
        const k = i / b.trail.length
        ctx.strokeStyle = `rgba(255,${Math.round(150 + 90 * k)},77,${k * 0.85})`
        ctx.lineWidth = Math.max(0.6, b.r * 0.7 * k)
        ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke()
      }
      const rad = b.r * 2.4
      const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rad)
      glow.addColorStop(0, 'rgba(255,255,255,0.95)')
      glow.addColorStop(0.35, 'rgba(255,213,79,0.8)')
      glow.addColorStop(1, 'rgba(255,150,60,0)')
      ctx.fillStyle = glow
      ctx.beginPath(); ctx.arc(b.x, b.y, rad, 0, Math.PI * 2); ctx.fill()
      // 燃烧中的岩石本体（橙红暗色）
      ctx.fillStyle = '#5a4330'
      ctx.beginPath(); ctx.moveTo(rock[0].x, rock[0].y)
      for (let i = 1; i < rock.length; i++) ctx.lineTo(rock[i].x, rock[i].y)
      ctx.closePath(); ctx.fill()
    } else {
      // 陨石：落地不规则石块 + 地面阴影
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath(); ctx.ellipse(b.x, b.y + b.r * 0.6, b.r * 1.2, b.r * 0.5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#7a6a52'
      ctx.beginPath(); ctx.moveTo(rock[0].x, rock[0].y)
      for (let i = 1; i < rock.length; i++) ctx.lineTo(rock[i].x, rock[i].y)
      ctx.closePath(); ctx.fill()
      const hl = this.rockPoints(b, 0.4)
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.beginPath(); ctx.moveTo(hl[0].x - b.r * 0.35, hl[0].y - b.r * 0.4)
      for (let i = 1; i < hl.length; i++) ctx.lineTo(hl[i].x - b.r * 0.35, hl[i].y - b.r * 0.4)
      ctx.closePath(); ctx.fill()
    }
  }
}
