/* ============================================================
   M3 流星案例 · 演示控制器（纯状态机，不依赖 DOM / Canvas）
   负责演示运行状态与教学阶段（判别步骤）的流转：
     idle(未开始) → playing(自动演示) ⇄ paused(暂停)
     三个阶段 ① 流星体 → ② 流星 → ③ 陨石 对应判别步骤 1~3，
     自动演示走完三阶段后进入 done(结论, 步骤 4)。
   通过回调把状态变化通知外部（场景动画 / 条件点亮 / 结论条）。
   独立成文件便于单元测试。
   ============================================================ */

/** 教学阶段：1=流星体(太空层) 2=流星(大气层) 3=陨石(地面层) */
export type MeteorStage = 1 | 2 | 3

/** 演示运行状态 */
export type MeteorPlayState = 'idle' | 'playing' | 'paused' | 'done'

/** 回调集合：场景与 DOM 层据此响应状态变化 */
export interface MeteorControllerCallbacks {
  /** 演示运行状态变化（暂停/继续/结束等） */
  onPlayState?: (state: MeteorPlayState) => void
  /** 教学阶段切换 */
  onStage?: (stage: MeteorStage) => void
  /** 判别步骤变化：0=待开始 1~3=三个阶段 4=结论 */
  onStep?: (step: number) => void
}

export class MeteorController {
  playState: MeteorPlayState = 'idle'
  stage: MeteorStage = 1
  /** 判别步骤：0=待开始 1~3=三个阶段 4=结论（与 App.meteorStep 同步） */
  step = 0

  private cb: MeteorControllerCallbacks

  constructor(callbacks: MeteorControllerCallbacks = {}) {
    this.cb = callbacks
  }

  /** 开始演示：回到第一阶段并进入自动播放 */
  start(): void {
    this.setStage(1)
    this.setPlayState('playing')
  }

  /** 暂停（仅播放中有效） */
  pause(): void {
    if (this.playState !== 'playing') return
    this.setPlayState('paused')
  }

  /** 继续（仅暂停态有效） */
  resume(): void {
    if (this.playState !== 'paused') return
    this.setPlayState('playing')
  }

  /** 暂停/继续切换；未开始或已结束时等效于开始/重播 */
  togglePlay(): void {
    if (this.playState === 'playing') this.pause()
    else if (this.playState === 'paused') this.resume()
    else this.start()
  }

  /** 重播：重置到第一阶段并重新自动演示 */
  replay(): void {
    this.setStage(1)
    this.setPlayState('playing')
  }

  /** 自动演示走完全部三个阶段，进入结论态（步骤 4） */
  finish(): void {
    this.step = 4
    this.cb.onStep?.(this.step)
    this.setPlayState('done')
  }

  /** 切换教学阶段：① 流星体 ② 流星 ③ 陨石 */
  setStage(stage: MeteorStage): void {
    this.stage = stage
    this.step = stage
    this.cb.onStage?.(this.stage)
    this.cb.onStep?.(this.step)
    // 结论态下手动切回某阶段 → 转入手动浏览（暂停态，自动演示不再推进）
    if (this.playState === 'done') this.setPlayState('paused')
  }

  /** 是否处于"动画推进中"（自动演示计时器据此推进阶段） */
  isActive(): boolean {
    return this.playState === 'playing'
  }

  private setPlayState(state: MeteorPlayState): void {
    if (this.playState === state) return
    this.playState = state
    this.cb.onPlayState?.(state)
  }
}
