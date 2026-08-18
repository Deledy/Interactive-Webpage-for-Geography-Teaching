/* ============================================================
   M3 流星案例 · 模块入口
   在 #meteor-stage 中装配 Canvas 演示动画（meteorScene）+ 控制条：
     ▶ 开始演示 / ⏸ 暂停 / ▶ 继续 / ↻ 重播
   动画为连续循环旅程，不采用"分阶段播放"方式：
     流星体在太空中自由漂浮 → 漂到大气层上边界时被大气层自动吸引、
     直接进入大气层燃烧成流星 → 未燃尽落至地面成陨石 → 短暂停留后重新生成。
   右侧"判别三条件"为静态展示，不与动画步骤同步（无点亮动画）。
   ============================================================ */
import { $ } from '../utils/dom'
import { lessonData } from '../data/lessonData'
import { MeteorController } from './meteorController'
import type { MeteorPlayState } from './meteorController'
import { MeteorScene } from './meteorScene'

/** 按钮文案配置：key = 演示状态，value = [是否可用, 文案] */
const BTN_LABELS: Record<MeteorPlayState, {
  start: [boolean, string]
  pause: [boolean, string]
  replay: [boolean, string]
}> = {
  idle:    { start: [true, '▶ 开始演示'], pause: [false, '⏸ 暂停'], replay: [false, '↻ 重播'] },
  playing: { start: [false, '演示进行中…'], pause: [true, '⏸ 暂停'], replay: [true, '↻ 重播'] },
  paused:  { start: [false, '演示已暂停'], pause: [true, '▶ 继续'], replay: [true, '↻ 重播'] },
  done:    { start: [true, '↻ 重新开始'], pause: [false, '⏸ 暂停'], replay: [true, '↻ 重播'] }
}

/**
 * 初始化 M3 流星案例模块。
 * 返回控制器实例，便于单元测试直接驱动状态流转。
 */
export function initMeteorCase(): MeteorController | null {
  const stageEl = document.getElementById('meteor-stage')
  const condsBoxEl = document.getElementById('meteor-conditions')
  const conclusionEl = document.getElementById('meteor-conclusion')
  if (!stageEl || !condsBoxEl || !conclusionEl || !lessonData.meteorCase) return null
  const stage: HTMLElement = stageEl

  // 移除"无 JS 占位"样式，装配演示区域（判别三条件保持静态，不随动画同步）
  stage.classList.remove('panel--hint')
  stage.innerHTML = `
    <div class="meteor-demo" data-widget="meteor-demo">
      <div class="meteor-stage__canvas">
        <canvas class="meteor-canvas" role="img" aria-label="流星现象演示：流星体在太空漂浮 → 进入大气层摩擦燃烧成流星 → 未燃尽落至地面成陨石"></canvas>
      </div>
      <div class="meteor-demo__toolbar">
        <button type="button" class="btn btn--primary meteor-ctl" data-meteor-action="start">▶ 开始演示</button>
        <button type="button" class="btn meteor-ctl" data-meteor-action="pause" disabled>⏸ 暂停</button>
        <button type="button" class="btn meteor-ctl" data-meteor-action="replay" disabled>↻ 重播</button>
      </div>
    </div>`;

  const canvas = $('.meteor-canvas', stage) as HTMLCanvasElement | null
  const startBtn = $('[data-meteor-action="start"]', stage) as HTMLButtonElement | null
  const pauseBtn = $('[data-meteor-action="pause"]', stage) as HTMLButtonElement | null
  const replayBtn = $('[data-meteor-action="replay"]', stage) as HTMLButtonElement | null

  // 场景随控制器播放状态联动（无画布时仅保留 DOM 控制条）
  let scene: MeteorScene | null = null
  if (canvas) {
    scene = new MeteorScene(canvas)
    scene.start()
  }

  /** 控制条状态：随演示运行状态更新按钮可用性与文案 */
  function updateButtons(state: MeteorPlayState): void {
    const cfg = BTN_LABELS[state]
    if (startBtn) { startBtn.disabled = !cfg.start[0]; startBtn.textContent = cfg.start[1] }
    if (pauseBtn) { pauseBtn.disabled = !cfg.pause[0]; pauseBtn.textContent = cfg.pause[1] }
    if (replayBtn) { replayBtn.disabled = !cfg.replay[0]; replayBtn.textContent = cfg.replay[1] }
  }

  const ctl = new MeteorController({
    onPlayState: state => {
      updateButtons(state)
      scene?.applyPlayState(state)
    }
  })
  if (scene) scene.bind(ctl)

  startBtn?.addEventListener('click', () => {
    if (ctl.playState === 'done') ctl.replay()
    else ctl.start()
  })
  pauseBtn?.addEventListener('click', () => ctl.togglePlay())
  replayBtn?.addEventListener('click', () => {
    ctl.replay()
    scene?.resetDemo()
  })

  return ctl
}
