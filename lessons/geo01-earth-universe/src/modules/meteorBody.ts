/* ============================================================
   M3 流星案例 · 天体个体物理模型（纯逻辑，不依赖 Canvas）
   同一块天体随运动位置流转三种形态：
     meteoroid 流星体：在太空层缓慢漂浮（随机慢速漂移 + 轻微变向），不带拖尾
     meteor   流星  ：向下坠落，穿过大气层上边界后加速、增亮并拉出燃烧拖尾
     meteorite 陨石  ：落至地面后静止停留
   形态由位置驱动（kind 随 atmTop / groundY 边界变化），
   保证"同一块流星体 → 流星 → 陨石"是一条连续旅程。
   视觉相关状态：rot / rotSpeed（岩石翻滚）、streak（燃烧进度，驱动拖尾长度），
   均为显式模型状态，便于绘制层复用与测试。
   update(dt) 为纯函数式演进，便于在 jsdom / node 环境下做确定性单元测试。
   ============================================================ */

export type BodyKind = 'meteoroid' | 'meteor' | 'meteorite'
export type BodyMode = 'wander' | 'entry' | 'landed'

/** 场景层界（由场景按画布尺寸计算，逻辑像素） */
export interface LayerBounds {
  minX: number
  maxX: number
  /** 太空层漂浮范围（垂直方向） */
  spaceMinY: number
  spaceMaxY: number
  /** 大气层上边界：y >= atmTop 视为进入大气层（流星体 → 流星） */
  atmTop: number
  /** 地面线：y >= groundY 视为落地（流星 → 陨石） */
  groundY: number
}

/** 个体参数（由场景按画布比例传入，保证多尺寸一致） */
export interface MeteorBodyOptions {
  /** 漂浮速度（px/s） */
  wanderSpeed?: number
  /** 进入大气后的加速度（px/s²） */
  accel?: number
  /** 进入大气后的初速度（px/s） */
  entrySpeed?: number
  /** 是否自动被大气层吸引（漂浮到大气层上边界即直接进入） */
  autoEnter?: boolean
  /** 向下的漂移偏置（px/s）：让天体逐渐靠近大气层边界 */
  sink?: number
  /** 被吸引进入大气层的方向（弧度，0=向右，默认竖直向下） */
  entryAngle?: number
  /** 形状随机种子：用于绘制稳定的不规则岩石轮廓 */
  seed?: number
}

export class MeteorBody {
  x: number
  y: number
  vx = 0
  vy = 0
  r: number
  kind: BodyKind = 'meteoroid'
  mode: BodyMode = 'wander'
  age = 0
  /** 是否已落地 */
  landed = false
  /** 是否启动"漂浮→被吸引进入"旅程（由场景按演示状态设置） */
  active = false
  /** 岩石自转角度（弧度）：让太空中的流星体缓慢翻滚 */
  rot = Math.random() * Math.PI * 2
  /** 大气层内燃烧进度 0~1：驱动流星拖尾由短变长 */
  streak = 0

  /** 漂浮参数：到点后随机换向 */
  private wanderT = 0
  private wanderSpeed: number
  private accel: number
  private entrySpeed: number
  private autoEnter: boolean
  private sink: number
  /** 被吸引进入大气层的方向（弧度）；场景在每次重生时重新随机 */
  entryAngle: number
  /** 形状随机种子：绘制不规则岩石轮廓时保持稳定 */
  seed: number
  /** 进入大气层的方向（单位向量） */
  private dirX = 0
  private dirY = 1
  /** 当前运动速率（px/s） */
  private speed = 0
  /** 自转角速度（rad/s），半径越小转得越快，模拟真实翻滚感 */
  private rotSpeed: number

  constructor(x: number, y: number, r: number, options: MeteorBodyOptions = {}) {
    this.x = x
    this.y = y
    this.r = r
    this.wanderSpeed = options.wanderSpeed ?? 14
    this.accel = options.accel ?? 90
    this.entrySpeed = options.entrySpeed ?? 70
    this.autoEnter = options.autoEnter ?? false
    this.sink = options.sink ?? 0
    this.entryAngle = options.entryAngle ?? Math.PI / 2
    this.seed = options.seed ?? Math.random()
    // 翻滚角速度：半径越小转得越快，方向随机
    this.rotSpeed = (Math.random() < 0.5 ? -1 : 1)
      * (3.2 / Math.max(2.5, r)) * (0.55 + Math.random() * 0.95)
  }

  /** 推进一个时间片（秒）。bounds 提供层界用于约束运动。 */
  update(dt: number, bounds: LayerBounds): void {
    if (this.mode === 'wander') this.updateWander(dt, bounds)
    else if (this.mode === 'entry') this.updateEntry(dt, bounds)
    else this.updateLanded()
    // 落地后停止翻滚，飞行与漂浮时持续自转
    if (this.mode !== 'landed') this.rot += this.rotSpeed * dt
    this.age += dt
  }

  /** 流星体：太空中缓慢漂浮，随机换向；active 的天体带向下漂移，
      当漂浮到大气层上边界时，被大气层自动吸引直接进入大气层 */
  private updateWander(dt: number, bounds: LayerBounds): void {
    this.wanderT -= dt
    if (this.wanderT <= 0) {
      const angle = Math.random() * Math.PI * 2
      this.vx = Math.cos(angle) * this.wanderSpeed
      this.vy = Math.sin(angle) * this.wanderSpeed * 0.6 + (this.active ? this.sink : 0)
      this.wanderT = 1.5 + Math.random() * 3
    }
    this.x += this.vx * dt
    this.y += this.vy * dt

    // 水平边界反弹
    if (this.x < bounds.minX + this.r) { this.x = bounds.minX + this.r; this.vx = -this.vx }
    if (this.x > bounds.maxX - this.r) { this.x = bounds.maxX - this.r; this.vx = -this.vx }

    // 垂直边界：active 的天体可下探到大气层上边界，普通天体仅在太空层内反弹
    const yMax = this.active ? bounds.atmTop - this.r : bounds.spaceMaxY - this.r
    if (this.y < bounds.spaceMinY + this.r) { this.y = bounds.spaceMinY + this.r; this.vy = -this.vy }
    if (this.y > yMax) { this.y = yMax; this.vy = -this.vy }

    // 自动被大气层吸引：漂浮到大气层上边界即被吸引，直接进入大气层
    if (this.active && this.y + this.r >= bounds.atmTop) {
      this.startEntry(this.entryAngle)
    }
  }

  /** 流星：同一块天体向下坠落，穿过大气层上边界后开始加速燃烧拉尾迹 */
  private updateEntry(dt: number, bounds: LayerBounds): void {
    if (this.y < bounds.atmTop) {
      // 尚未进入大气层：仍是流星体，匀速缓慢下坠
      this.kind = 'meteoroid'
      this.vx = this.dirX * this.entrySpeed
      this.vy = this.dirY * this.entrySpeed
    } else {
      // 进入大气层后：持续加速、增亮，拉出发光拖尾 → 变为流星
      this.speed += this.accel * dt
      this.kind = 'meteor'
      this.vx = this.dirX * this.speed
      this.vy = this.dirY * this.speed
      // 燃烧进度随飞行时间增长：拖尾由短逐渐拉长
      this.streak = Math.min(1, this.streak + dt * 1.6)
    }
    this.x += this.vx * dt
    this.y += this.vy * dt
    if (this.y >= bounds.groundY - this.r) this.land(bounds)
  }

  /** 陨石：落地后静止停留 */
  private updateLanded(): void {
    this.vx = 0
    this.vy = 0
  }

  /** 开始下坠（同一块天体）：仍为流星体，直到穿过大气层上边界才变为流星 */
  startEntry(angle: number): void {
    this.mode = 'entry'
    this.kind = 'meteoroid'
    this.dirX = Math.cos(angle)
    this.dirY = Math.sin(angle)
    this.speed = this.entrySpeed
    this.streak = 0
    this.vx = this.dirX * this.speed
    this.vy = this.dirY * this.speed
  }

  /** 落地：冻结位置与速度，等待冲击光效与尘埃效果 */
  land(bounds: LayerBounds): void {
    this.mode = 'landed'
    this.kind = 'meteorite'
    this.landed = true
    this.y = bounds.groundY - this.r
    this.vx = 0
    this.vy = 0
  }

  /** 复位为太空漂浮的流星体（用于重播 / 阶段切换） */
  resetToWander(x?: number, y?: number): void {
    this.x = x ?? this.x
    this.y = y ?? this.y
    this.mode = 'wander'
    this.kind = 'meteoroid'
    this.landed = false
    this.speed = 0
    this.streak = 0
    this.wanderT = Math.random() * 2
  }
}
