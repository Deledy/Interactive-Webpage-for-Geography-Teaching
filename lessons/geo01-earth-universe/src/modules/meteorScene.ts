/* ============================================================
   M3 流星案例 · Canvas 演示场景
   三层纵向布局：太空（流星体漂浮）→ 大气层（流星燃烧）→ 地面（陨石）。
   叙事主线：所有漂浮的流星体都走同一套完整旅程——
     在太空中自由漂浮（只是安静翻滚的石块，不带拖尾），
     当漂到大气层上边界时被大气层捕捉，直接进入大气层并加速燃烧
     （此时才变为流星、长出拖尾），落地后成为陨石，
     在地面短暂停留后重新在太空中生成，各自循环演示（错峰进行）。
     因此点击开始后不会立刻出现流星，而要等流星体漂到边界才逐个触发。
   背景与视觉基准：
     · 夜空底图＝AI 生成的星夜插画（assets/images/meteor-scene-bg.jpg），
       按 cover 等比铺满画布，取代原先程序化绘制的深空渐变 + 星云 + 山脊剪影，
       因此"地面"由底图自带的地平线山脊承担，画布只保留一条地面线作层界标记；
     · 画布上仍叠加可动的星点闪烁（限定在天空区）与「太空 / 大气层」分界虚线；
     · 太空层的流星体＝冰蓝色不规则岩块，缓慢翻滚；
     · 大气层的流星＝圆形头部 + 平滑收拢的拖尾，整体呈"蝌蚪"形并被一层
       暖金辉光包裹成同一视觉单元，方向以竖直向下为中心均匀随机；
     · 落地＝暖金光斑 + 尘埃迸溅，地平线上留下暖黄余温光点。
   所有尺寸按「画布宽度 / DESIGN_W」等比推导，窄屏为 4:5 竖版、宽屏铺满卡片，多屏观感一致。
   层界与地面线：大气层上边界固定在画布高度 30%，地面线由底图地面位置（近岸水面）反推
   （见 groundRatio），因此"太空 / 大气层 / 地面"三层标注与底图地面始终对齐。
   技术要点：
   - Canvas 2D 绘制全部元素，不依赖 DOM 粒子；
   - 发光元素统一用 lighter 混合；流星用同一套蝌蚪轮廓分层叠加出光芒渐变；
   - GSAP 负责落地冲击光效与被大气层吸引的提示光效；
   - 无 2D 上下文（如 jsdom / 旧环境）时安全降级为纯逻辑模式。
   ============================================================ */
import gsap from 'gsap'
import sceneBgUrl from '../../assets/images/meteor-scene-bg.jpg'
import { prefersReducedMotion } from '../utils/dom'
import { MeteorBody } from './meteorBody'
import type { LayerBounds } from './meteorBody'
import type { MeteorController, MeteorPlayState } from './meteorController'

/** 叠加在底图天空区的星点（坐标用 0~1 比例，随画布缩放） */
interface Star {
  fx: number
  fy: number
  r: number
  base: number
  phase: number
  twinkleSpeed: number
  bright: boolean
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
/** 设计基准宽度：视觉尺寸按「画布宽 / DESIGN_W」等比推导，保证多屏比例一致 */
const DESIGN_W = 500
/** 星点铺陈的高度上限（占画布高度的比例）：底图自带地平线山脊与水面，
    星点只铺在天空区，避免闪烁星点落在山脊 / 水面上显得脏 */
const STAR_MAX_FY = 0.72
/** 底图地面线在底图高度上的比例：底图山脊与水面交界在 0.915 附近，这里取山脊脚下
    近岸水面（0.93），即地面线略低于山脊脚、压在近岸水面上，更接近"地面"的视觉
    位置。地面线按此比例经 cover 变换反推到画布坐标（见 groundRatio） */
const BG_GROUND_F = 0.93
/** 底图未就绪（尚未解码）时的地面线比例：固定值兜底，与底图地面位置保持一致 */
const GROUND_RATIO_FALLBACK = 0.93
/** 进入大气层的方向：以竖直向下（π/2）为中心、左右均匀随机，
    即左下、正下、右下都会出现，避免轨迹过于雷同 */
const ENTRY_CENTER = Math.PI / 2
/** 方向随机半幅（弧度）：±0.5 ≈ ±29°，兼顾"方向多样"与"多数能落到地面" */
const ENTRY_SPREAD = 0.5

export class MeteorScene {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D | null = null
  private w = 0
  private h = 0
  /** 等比系数：1 表示画布宽 = DESIGN_W */
  private k = 1
  private bounds: LayerBounds = {
    minX: 6, maxX: 6, spaceMinY: 8, spaceMaxY: 8, atmTop: 8, groundY: 8
  }

  /** 夜空底图（AI 生成星夜插画）：加载完成后按 cover 铺满画布，未就绪时回退为渐变底色 */
  private bg: HTMLImageElement
  private bgReady = false

  private stars: Star[] = []
  /** 全部流星体：每一块都完整经历"漂浮 → 吸引进入 → 燃烧 → 落地 → 重新生成" */
  private bodies: MeteorBody[] = []
  private dusts: Dust[] = []
  private impacts: Flash[] = []
  private attracts: Flash[] = []
  private time = 0

  /** 陨石落地后停留时长（秒），随后重新生成流星体循环演示。
      该时长与 sink、个体数量共同决定流星出现频率，调大可为画面留出呼吸感 */
  private readonly respawnDelay = 3.2
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

    // 夜空底图：异步加载，就绪后由 drawBackground 铺满画布（此前沿用渐变兜底，避免首帧空屏）；
    // 加载完成后再 resize 一次，让地面线按底图地平线重新定位
    this.bg = new Image()
    this.bg.decoding = 'async'
    this.bg.onload = () => {
      this.bgReady = true
      this.resize()
    }
    this.bg.src = sceneBgUrl

    // 星点：随机散布在底图天空区（地平线以上），亮度/闪烁参数各不相同，少量亮星带柔光
    const N = 150
    for (let i = 0; i < N; i++) {
      const bright = Math.random() < 0.16
      this.stars.push({
        fx: Math.random(),
        fy: Math.random() * STAR_MAX_FY,
        r: bright ? 1.0 + Math.random() * 0.5 : 0.5 + Math.random() * 0.7,
        base: bright ? 0.75 + Math.random() * 0.25 : 0.3 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 1 + Math.random() * 2.2,
        bright
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

  /** 演示运行状态变化 → 暂停/恢复 GSAP 补间 */
  applyPlayState(state: MeteorPlayState): void {
    if (state === 'playing') this.tweens.forEach(t => t.play())
    else if (state === 'paused') this.tweens.forEach(t => t.pause())
  }

  /** 重新开始演示：所有流星体回到太空中重新漂浮，等待被大气层逐个捕捉 */
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
    // 等比系数：天体尺寸只依赖画布宽度（宽屏下画布宽高比随卡片高度变化，尺寸基准仍取宽度，
    // 保证不同屏宽下天体大小观感一致）
    this.k = Math.max(0.5, Math.min(2.4, cw / DESIGN_W))
    // 太空（约 30%）/ 大气层（30% → 底图地平线）/ 地面（底图地平线以下，薄层）
    const atmTop = Math.round(ch * 0.30)
    this.bounds = {
      minX: 6,
      maxX: Math.max(7, cw - 6),
      spaceMinY: Math.max(6, Math.round(ch * 0.018)),
      spaceMaxY: Math.max(12, atmTop - Math.round(ch * 0.022)),
      atmTop,
      groundY: Math.round(ch * this.groundRatio())
    }
  }

  /** 地面线比例（地面线 y / 画布高）：把底图地面位置（BG_GROUND_F）按 cover 变换
      反推到画布坐标，使地面线（也是陨石落地线）始终压在底图近岸水面上，
      不随画布宽高比漂移。
      底图未就绪时回退为固定比例，保证首帧逻辑可用。 */
  private groundRatio(): number {
    const iw = this.bg.naturalWidth
    const ih = this.bg.naturalHeight
    if (!this.bgReady || iw <= 0 || ih <= 0) return GROUND_RATIO_FALLBACK
    const s = Math.max(this.w / iw, this.h / ih)
    const dh = ih * s
    const y = (this.h - dh) / 2 + BG_GROUND_F * dh
    return Math.min(0.97, Math.max(0.6, y / this.h))
  }

  private randX(): number {
    return 12 + Math.random() * Math.max(10, this.w - 24)
  }

  private randSpaceY(): number {
    return this.bounds.spaceMinY + Math.random() * (this.bounds.spaceMaxY - this.bounds.spaceMinY)
  }

  /** 天体半径：约画布宽度的 1.0%~1.7%，与参考图中远近不同的大小层次一致 */
  private bodyR(): number {
    return this.w * (0.010 + Math.random() * 0.007)
  }

  /** 入场方向：以竖直向下为中心左右均匀随机，每次重生都重新抽取 */
  private randEntryAngle(): number {
    return ENTRY_CENTER + (Math.random() - 0.5) * 2 * ENTRY_SPREAD
  }

  /** 创建一块流星体：带向下漂移，漂到大气层边界自动被吸引进入（autoEnter） */
  private createBody(): MeteorBody {
    const k = this.k
    return new MeteorBody(this.randX(), this.randSpaceY(), this.bodyR(), {
      wanderSpeed: (18 + Math.random() * 12) * k,
      // 进入大气层后缓慢加速：整体下落速度明显放缓，便于观察燃烧过程
      accel: (38 + Math.random() * 20) * k,
      entrySpeed: (60 + Math.random() * 30) * k,
      autoEnter: true,
      // 太空中的下漂速度：决定"被大气层捕捉"前的等待时长（约 3~6 秒）
      sink: (24 + Math.random() * 8) * k,
      entryAngle: this.randEntryAngle()
    })
  }

  private tweenDur(base: number): number {
    return prefersReducedMotion ? 0.001 : base
  }

  /** 重建世界：全部流星体回到太空，各自开始循环旅程。
      个体数量与 sink / respawnDelay 共同决定流星出现频率，这里取较稀疏的密度，
      让每颗流星的"漂浮 → 被捕捉 → 燃烧 → 落地"完整过程都能被看清楚 */
  private resetWorld(): void {
    const count = 14
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

  /** 落地冲击：GSAP 暖色光效 + 尘埃粒子迸溅 */
  private spawnImpact(b: MeteorBody): void {
    const flash: Flash = { x: b.x, y: b.y, scale: 0.25, alpha: 1 }
    this.impacts.push(flash)
    this.tweens.push(gsap.fromTo(flash, { scale: 0.25, alpha: 1 }, {
      scale: 2.2, alpha: 0,
      duration: this.tweenDur(0.85),
      ease: EASE,
      overwrite: true
    }))
    const n = 10
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = (18 + Math.random() * 52) * this.k
      this.dusts.push({
        x: b.x, y: b.y,
        vx: Math.cos(a) * sp,
        vy: -Math.abs(Math.sin(a)) * sp * 0.7,
        life: 1, maxLife: 1,
        r: (0.7 + Math.random() * 1.1) * this.k
      })
    }
  }

  /** 被大气层捕捉的瞬间：柔和的青色提示辉光 */
  private spawnAttract(x: number, y: number): void {
    const flash: Flash = { x, y, scale: 0.5, alpha: 1 }
    this.attracts.push(flash)
    this.tweens.push(gsap.fromTo(flash, { scale: 0.5, alpha: 1 }, {
      scale: 1.5, alpha: 0,
      duration: this.tweenDur(0.45),
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
      // 被大气层吸引的瞬间：触发青色提示光效
      if (prevMode === 'wander' && b.mode === 'entry') {
        this.spawnAttract(b.x, b.y)
      }
      // 落地：触发冲击光效，并登记落地时间用于循环重生
      if (b.landed && !this.impacted.has(b)) {
        this.impacted.add(b)
        this.landedAt.set(b, this.time)
        this.spawnImpact(b)
      }
      // 飞出画布侧边（未燃尽离场）：回到太空重新漂浮，避免循环断流
      if (b.mode === 'entry' && (b.x < -b.r * 4 || b.x > this.w + b.r * 4)) {
        b.resetToWander(this.randX(), this.randSpaceY())
        b.entryAngle = this.randEntryAngle()
      }
    }

    // 陨石在地面停留片刻后，重新在太空中生成流星体，各自循环演示
    for (const b of this.bodies) {
      if (b.landed && this.impacted.has(b)) {
        const t = this.landedAt.get(b) ?? 0
        if (this.time - t > this.respawnDelay) {
          b.resetToWander(this.randX(), this.randSpaceY())
          b.entryAngle = this.randEntryAngle()
          this.impacted.delete(b)
          this.landedAt.delete(b)
        }
      }
    }

    // 尘埃粒子：受重力下落并消散
    for (const d of this.dusts) {
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.vy += 60 * this.k * dt
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

    this.drawBackground(ctx)
    this.drawStars(ctx)
    this.drawAtmosphere(ctx)
    this.drawGround(ctx)

    // 天体个体（流星体 / 流星 / 陨石）：画布外的个体跳过绘制
    for (const b of this.bodies) {
      if (b.x < -80 || b.x > w + 80 || b.y < -60 || b.y > h + 40) continue
      this.drawBody(ctx, b)
    }

    // 尘埃
    for (const d of this.dusts) {
      ctx.fillStyle = `rgba(255,206,140,${Math.max(0, d.life) * 0.7})`
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill()
    }

    // 落地冲击光效（暖金）
    for (const f of this.impacts) {
      const r = Math.max(2, 11 * f.scale * this.k)
      ctx.globalCompositeOperation = 'lighter'
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r)
      g.addColorStop(0, `rgba(255,236,170,${f.alpha * 0.7})`)
      g.addColorStop(0.35, `rgba(255,196,88,${f.alpha * 0.4})`)
      g.addColorStop(1, 'rgba(255,150,50,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    }

    // 进入大气层的青蓝提示辉光
    for (const f of this.attracts) {
      const r = Math.max(2, 14 * f.scale * this.k)
      ctx.globalCompositeOperation = 'lighter'
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r)
      g.addColorStop(0, `rgba(130,206,255,${f.alpha * 0.4})`)
      g.addColorStop(1, 'rgba(90,175,255,0)')
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  /** 1. 夜空底图：AI 生成的星夜插画按 cover 等比铺满画布（居中裁切，裁切量极小）。
      画布 4:5 比底图略宽，裁切后底图地平线落在画布高度约 90% 处，正好与本场景
      的 groundY 一致，流星体落地位置与底图山脊自然对齐。
      图片未就绪时回退为程序化深空渐变（色调与底图一致），保证首帧不空屏。 */
  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const { w, h } = this
    const iw = this.bg.naturalWidth
    const ih = this.bg.naturalHeight
    if (this.bgReady && iw > 0 && ih > 0) {
      const s = Math.max(w / iw, h / ih)
      const dw = iw * s
      const dh = ih * s
      ctx.drawImage(this.bg, (w - dw) / 2, (h - dh) / 2, dw, dh)
      return
    }

    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#02050f')
    bg.addColorStop(0.20, '#030818')
    bg.addColorStop(0.32, '#04102a')
    bg.addColorStop(0.60, '#061a38')
    bg.addColorStop(0.84, '#0b2c58')
    bg.addColorStop(0.90, '#123f75')
    bg.addColorStop(1, '#0a1f42')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
  }

  /** 2. 星点：轻微闪烁，亮星带柔光（叠加在静态底图的天空区上，让背景有呼吸感） */
  private drawStars(ctx: CanvasRenderingContext2D): void {
    const { w, h, k } = this
    for (const s of this.stars) {
      const a = s.base * (0.55 + 0.45 * Math.sin(this.time * s.twinkleSpeed + s.phase))
      if (a <= 0.02) continue
      const x = s.fx * w
      const y = s.fy * h
      // 半径设下限，避免小画布上星点被压到亚像素而消失
      const r = Math.max(0.45, s.r * k)
      if (s.bright) {
        ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = `rgba(170,205,255,${a * 0.14})`
        ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = `rgba(205,228,255,${a * 0.26})`
        ctx.beginPath(); ctx.arc(x, y, r * 1.8, 0, Math.PI * 2); ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
      }
      ctx.globalAlpha = Math.max(0, Math.min(1, a))
      ctx.fillStyle = s.bright ? '#e6efff' : '#ffffff'
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  /** 3. 大气层：淡蓝色带 + 太空/大气层分界虚线（层界标记，与右侧标注栏对应） */
  private drawAtmosphere(ctx: CanvasRenderingContext2D): void {
    const { w } = this
    const { atmTop, groundY } = this.bounds
    ctx.fillStyle = 'rgba(40,105,190,0.07)'
    ctx.fillRect(0, atmTop, w, groundY - atmTop)

    ctx.save()
    ctx.strokeStyle = 'rgba(150,205,255,0.34)'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 6])
    ctx.beginPath(); ctx.moveTo(0, atmTop); ctx.lineTo(w, atmTop); ctx.stroke()
    ctx.restore()
  }

  /** 4. 地面线：山脊与水面都由底图承担，这里只画一条地面线，
      标记「大气层 / 地面」层界（与右侧标注栏的"地面"位置对应），
      同时给陨石落地一个明确的水平参照。 */
  private drawGround(ctx: CanvasRenderingContext2D): void {
    const { w } = this
    const gy = this.bounds.groundY
    ctx.strokeStyle = 'rgba(165,215,255,0.5)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke()
  }

  /** 由天体的 seed 生成稳定的不规则岩石多边形（随 rot 自转） */
  private rockPoints(b: MeteorBody, radiusMul = 1): { x: number; y: number }[] {
    let s = Math.floor(b.seed * 233280) % 233280 || 1
    const rnd = (): number => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    const n = 9
    const cos = Math.cos(b.rot)
    const sin = Math.sin(b.rot)
    const base = radiusMul * b.r
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.36
      const rr = base * (0.70 + rnd() * 0.58)
      const lx = Math.cos(a) * rr
      const ly = Math.sin(a) * rr
      pts.push({ x: b.x + lx * cos - ly * sin, y: b.y + lx * sin + ly * cos })
    }
    return pts
  }

  private tracePolygon(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.closePath()
  }

  /** 蝌蚪形轮廓：前部是完整的圆形头部，后部平滑收拢成尾尖。
      头部用圆弧（而非直线）闭合，天然消除了拖尾前端"一刀切"的平整断口；
      尾部两侧用二次贝塞尔从头部两侧极点顺势收细，与圆头连成一整体。 */
  private tadpolePath(
    ctx: CanvasRenderingContext2D,
    hx: number, hy: number,
    dx: number, dy: number,
    headR: number, len: number
  ): void {
    const r = Math.max(0.8, headR)
    const px = -dy
    const py = dx
    // 头部两侧极点中，偏 +perp 一侧的极角
    const aTop = Math.atan2(py, px)
    const tipX = hx - dx * len
    const tipY = hy - dy * len
    // 尾部两侧控制点：靠近头部处保持较满的宽度，靠近尾尖处收细 → 蝌蚪式流线过渡
    const cu = len * 0.42
    const cv = r * 0.55
    const c1x = hx - dx * cu + px * cv
    const c1y = hy - dy * cu + py * cv
    const c2x = hx - dx * cu - px * cv
    const c2y = hy - dy * cu - py * cv

    ctx.beginPath()
    // 前部：从 +perp 极点经"鼻尖"绕到 -perp 极点的半圆弧 = 圆形头部
    ctx.arc(hx, hy, r, aTop, aTop - Math.PI, true)
    // 尾部下侧 → 尾尖
    ctx.quadraticCurveTo(c2x, c2y, tipX, tipY)
    // 尾部上侧 → 回到起点，闭合
    ctx.quadraticCurveTo(c1x, c1y, hx + px * r, hy + py * r)
    ctx.closePath()
  }

  private drawBody(ctx: CanvasRenderingContext2D, b: MeteorBody): void {
    if (b.kind === 'meteoroid') this.drawMeteoroid(ctx, b)
    else if (b.kind === 'meteor') this.drawMeteor(ctx, b)
    else this.drawMeteorite(ctx, b)
  }

  /** 流星体：太空中静静翻滚的冰蓝岩块（不带拖尾，拖尾只在进入大气层后才出现） */
  private drawMeteoroid(ctx: CanvasRenderingContext2D, b: MeteorBody): void {
    const r = b.r

    // 冰蓝柔光晕
    ctx.globalCompositeOperation = 'lighter'
    const halo = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 1.7)
    halo.addColorStop(0, 'rgba(168,205,255,0.22)')
    halo.addColorStop(0.5, 'rgba(140,185,255,0.08)')
    halo.addColorStop(1, 'rgba(120,170,255,0)')
    ctx.fillStyle = halo
    ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.7, 0, Math.PI * 2); ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    // 岩石本体：左上受光的冰面渐变
    const pts = this.rockPoints(b)
    this.tracePolygon(ctx, pts)
    const body = ctx.createLinearGradient(b.x - r, b.y - r, b.x + r * 0.85, b.y + r)
    body.addColorStop(0, '#eef4ff')
    body.addColorStop(0.4, '#b3c5e0')
    body.addColorStop(1, '#5e7294')
    ctx.fillStyle = body
    ctx.fill()

    // 内部光影与棱面（裁剪在岩石轮廓内绘制，避免溢出）
    ctx.save()
    this.tracePolygon(ctx, pts)
    ctx.clip()
    const shade = ctx.createLinearGradient(b.x - r * 1.1, b.y - r * 1.1, b.x + r, b.y + r)
    shade.addColorStop(0, 'rgba(255,255,255,0.42)')
    shade.addColorStop(0.5, 'rgba(255,255,255,0)')
    shade.addColorStop(1, 'rgba(8,18,42,0.5)')
    ctx.fillStyle = shade
    ctx.fillRect(b.x - r * 2, b.y - r * 2, r * 4, r * 4)
    ctx.strokeStyle = 'rgba(34,52,88,0.38)'
    ctx.lineWidth = Math.max(0.5, r * 0.1)
    for (let i = 0; i < pts.length; i += 2) {
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke()
    }
    ctx.restore()

    // 轮廓高光
    ctx.strokeStyle = 'rgba(228,240,255,0.5)'
    ctx.lineWidth = Math.max(0.6, r * 0.1)
    this.tracePolygon(ctx, pts)
    ctx.stroke()
  }

  /** 流星：圆形头部 + 平滑收拢的蝌蚪形拖尾。
      四层由外到内共用同一套蝌蚪轮廓（只是半径与长度按比例缩放），
      因此头部与拖尾天然连为一体，而不是"圆点 + 一条独立尾迹"。 */
  private drawMeteor(ctx: CanvasRenderingContext2D, b: MeteorBody): void {
    const headR = b.r
    const sp = Math.hypot(b.vx, b.vy) || 1
    const dx = b.vx / sp
    const dy = b.vy / sp
    // 拖尾长度随燃烧进度增长；头部始终保持圆形
    const len = headR * (2.6 + 9 * b.streak)
    // 高温燃烧的轻微闪烁，避免发光过于机械
    const flick = 0.88 + 0.12 * Math.sin(this.time * 16 + b.seed * 40)

    ctx.globalCompositeOperation = 'lighter'

    // 1) 外包裹辉光：比本体更宽的蝌蚪轮廓，把圆头与拖尾裹成同一个发光单元
    const auraLen = len * 1.14
    const auraR = headR * 2.5
    const g1 = ctx.createLinearGradient(b.x, b.y, b.x - dx * auraLen, b.y - dy * auraLen)
    g1.addColorStop(0, `rgba(255,196,96,${0.18 * flick})`)
    g1.addColorStop(0.38, 'rgba(255,150,46,0.08)')
    g1.addColorStop(1, 'rgba(255,120,20,0)')
    ctx.fillStyle = g1
    this.tadpolePath(ctx, b.x, b.y, dx, dy, auraR, auraLen)
    ctx.fill()

    // 2) 头部柔光：向外径向衰减，柔化包裹层的圆弧边缘并强化圆头体积感
    const haloR = headR * 3.4
    const halo = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, haloR)
    halo.addColorStop(0, `rgba(255,238,158,${0.42 * flick})`)
    halo.addColorStop(0.45, 'rgba(255,190,74,0.16)')
    halo.addColorStop(1, 'rgba(255,140,35,0)')
    ctx.fillStyle = halo
    ctx.beginPath(); ctx.arc(b.x, b.y, haloR, 0, Math.PI * 2); ctx.fill()

    // 3) 本体：白热 → 暖金 → 橙，沿拖尾方向逐渐透明
    const tipX = b.x - dx * len
    const tipY = b.y - dy * len
    const g2 = ctx.createLinearGradient(b.x, b.y, tipX, tipY)
    g2.addColorStop(0, 'rgba(255,250,224,0.72)')
    g2.addColorStop(0.16, 'rgba(255,216,96,0.62)')
    g2.addColorStop(0.52, 'rgba(255,154,44,0.26)')
    g2.addColorStop(1, 'rgba(255,128,24,0)')
    ctx.fillStyle = g2
    this.tadpolePath(ctx, b.x, b.y, dx, dy, headR * 1.15, len)
    ctx.fill()

    // 4) 白热内核：更小的蝌蚪轮廓叠在头部中心，形成圆润的发光核心
    const coreLen = len * 0.8
    const g3 = ctx.createLinearGradient(b.x, b.y, b.x - dx * coreLen, b.y - dy * coreLen)
    g3.addColorStop(0, 'rgba(255,255,250,0.8)')
    g3.addColorStop(0.3, 'rgba(255,242,182,0.4)')
    g3.addColorStop(1, 'rgba(255,220,140,0)')
    ctx.fillStyle = g3
    this.tadpolePath(ctx, b.x, b.y, dx, dy, headR * 0.58, coreLen)
    ctx.fill()

    ctx.globalCompositeOperation = 'source-over'
  }

  /** 陨石：落地暗色石块 + 暖黄余温辉光（对应参考图地平线上的发光点） */
  private drawMeteorite(ctx: CanvasRenderingContext2D, b: MeteorBody): void {
    const r = b.r

    ctx.globalCompositeOperation = 'lighter'
    const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 3.4)
    glow.addColorStop(0, 'rgba(255,214,110,0.52)')
    glow.addColorStop(0.5, 'rgba(255,168,60,0.18)')
    glow.addColorStop(1, 'rgba(255,140,40,0)')
    ctx.fillStyle = glow
    ctx.beginPath(); ctx.arc(b.x, b.y, r * 3.4, 0, Math.PI * 2); ctx.fill()
    ctx.globalCompositeOperation = 'source-over'

    // 落地阴影
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.ellipse(b.x, b.y + r * 0.55, r * 1.2, r * 0.45, 0, 0, Math.PI * 2)
    ctx.fill()

    // 石块本体（暗色岩体 + 暖色余烬边缘）
    const pts = this.rockPoints(b)
    this.tracePolygon(ctx, pts)
    const rock = ctx.createLinearGradient(b.x - r, b.y - r, b.x + r, b.y + r)
    rock.addColorStop(0, '#4a3a22')
    rock.addColorStop(1, '#1b140a')
    ctx.fillStyle = rock
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,186,86,0.8)'
    ctx.lineWidth = Math.max(0.6, r * 0.12)
    ctx.stroke()
  }
}
