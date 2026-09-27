/* ============================================================
   M3 流星案例 · 模块入口
   在 #meteor-stage 中装配 Canvas 演示动画（meteorScene）+ 控制条：
     左：演示状态指示（只表示状态，不是按钮）
     右：暂停/继续（主控按钮）+ 重播
   动画为连续循环旅程，不采用"分阶段播放"方式：
     流星体在太空中自由漂浮 → 漂到大气层上边界时被大气层自动吸引、
     直接进入大气层燃烧成流星 → 未燃尽落至地面成陨石 → 短暂停留后重新生成。
   右侧"判别三条件"为静态展示，不与动画步骤同步（无点亮动画）；
   「综合判断」的判断结果默认隐藏，由"查看答案"按钮揭晓（initJudgeReveal）。
   ============================================================ */
import { $, $$ } from '../utils/dom'
import { lessonData } from '../data/lessonData'
import { MeteorController } from './meteorController'
import type { MeteorPlayState } from './meteorController'
import { MeteorScene } from './meteorScene'

/** 状态指示文案：只表达播放状态 */
function statusText(state: MeteorPlayState): string {
  if (state === 'playing') return '演示中'
  if (state === 'paused') return '已暂停'
  if (state === 'done') return '演示结束'
  return '未开始'
}

/** 主控按钮配置：key = 演示状态，value = [图标, 文案] */
const TOGGLE_LABELS: Record<MeteorPlayState, { icon: 'play' | 'pause'; label: string }> = {
  idle:    { icon: 'play',  label: '开始演示' },
  playing: { icon: 'pause', label: '暂停' },
  paused:  { icon: 'play',  label: '继续' },
  done:    { icon: 'play',  label: '重新开始' }
}

/**
 * 装配「综合判断」的逐条自测开关：该行判断结果默认隐藏，点这行的按钮揭晓 / 收起。
 * 该交互与演示动画解耦，不依赖 #meteor-stage 是否装配成功。
 */
function initJudgeReveal(): void {
  $$('.judge-item').forEach(item => {
    const btn = $('[data-judge-toggle]', item)
    const label = $('[data-judge-label]', item)
    if (!btn) return
    btn.addEventListener('click', () => {
      const open = item.classList.toggle('is-open')
      btn.setAttribute('aria-expanded', String(open))
      if (label) label.textContent = open ? '隐藏答案' : '查看答案'
    })
  })
}

/**
 * 初始化 M3 流星案例模块。
 * 返回控制器实例，便于单元测试直接驱动状态流转。
 */
export function initMeteorCase(): MeteorController | null {
  initJudgeReveal()

  const stageEl = document.getElementById('meteor-stage')
  const condsBoxEl = document.getElementById('meteor-conditions')
  if (!stageEl || !condsBoxEl || !lessonData.meteorCase) return null
  const stage: HTMLElement = stageEl

  // 移除"无 JS 占位"样式，装配演示区域（条件区保持静态，不随动画同步）
  stage.classList.remove('panel--hint')
  stage.innerHTML = `
    <div class="meteor-demo" data-widget="meteor-demo">
      <div class="meteor-stage__canvas">
        <canvas class="meteor-canvas" role="img" aria-label="流星现象演示：流星体在太空漂浮 → 进入大气层摩擦燃烧成流星 → 未燃尽落至地面成陨石"></canvas>
      </div>
      <!-- 层界标注：放在画布之外的两侧标注栏，纵向位置对应场景划分的层界中心
           （太空 15%、大气层 60%、地面 95%）。左栏为三类形态名胶囊，右栏为层名。
           文字逐字一个 span，按词序自上而下竖向排列。
           纯标注不可交互，语义已由画布 aria-label 覆盖，故对读屏隐藏。 -->
      <div class="meteor-rail meteor-rail--terms" aria-hidden="true">
        <span class="meteor-term meteor-term--space"><span>流</span><span>星</span><span>体</span></span>
        <span class="meteor-term meteor-term--air"><span>流</span><span>星</span><span>现</span><span>象</span></span>
        <span class="meteor-term meteor-term--ground"><span>陨</span><span>石</span></span>
      </div>
      <div class="meteor-rail meteor-rail--zones" aria-hidden="true">
        <span class="meteor-zone meteor-zone--space"><span>太</span><span>空</span></span>
        <span class="meteor-zone meteor-zone--air"><span>大</span><span>气</span><span>层</span></span>
        <span class="meteor-zone meteor-zone--ground"><span>地</span><span>面</span></span>
      </div>
      <div class="meteor-demo__toolbar">
        <p class="meteor-status" data-meteor-status role="status" aria-live="polite">
          <span class="meteor-status__dot" aria-hidden="true"></span>
          <span class="meteor-status__text">未开始</span>
        </p>
        <div class="meteor-demo__actions">
          <button type="button" class="meteor-btn meteor-btn--primary" data-meteor-action="toggle" data-icon="play">
            <svg class="meteor-btn__icon meteor-btn__icon--play" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 3.6v8.8l7.4-4.4z"/></svg>
            <svg class="meteor-btn__icon meteor-btn__icon--pause" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 4.2v7.6M10 4.2v7.6"/></svg>
            <span class="meteor-btn__label">开始演示</span>
          </button>
          <button type="button" class="meteor-btn meteor-btn--ghost" data-meteor-action="replay" disabled>
            <svg class="meteor-btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            <span class="meteor-btn__label">重播</span>
          </button>
        </div>
      </div>
    </div>`;

  const canvas = $('.meteor-canvas', stage) as HTMLCanvasElement | null
  const statusEl = $('[data-meteor-status]', stage) as HTMLElement | null
  const statusTextEl = $('.meteor-status__text', stage) as HTMLElement | null
  const toggleBtn = $('[data-meteor-action="toggle"]', stage) as HTMLButtonElement | null
  const toggleLabelEl = toggleBtn ? $('.meteor-btn__label', toggleBtn) as HTMLElement | null : null
  const replayBtn = $('[data-meteor-action="replay"]', stage) as HTMLButtonElement | null

  // 场景随控制器播放状态联动（无画布时仅保留 DOM 控制条）
  let scene: MeteorScene | null = null
  if (canvas) {
    scene = new MeteorScene(canvas)
    scene.start()
  }

  let playState: MeteorPlayState = 'idle'

  /** 控制条渲染：状态指示文案/配色 + 主控按钮文案与图标 + 重播可用性 */
  function render(): void {
    if (statusEl) statusEl.dataset.state = playState
    if (statusTextEl) statusTextEl.textContent = statusText(playState)
    const cfg = TOGGLE_LABELS[playState]
    if (toggleBtn) toggleBtn.dataset.icon = cfg.icon
    if (toggleLabelEl) toggleLabelEl.textContent = cfg.label
    if (replayBtn) replayBtn.disabled = playState === 'idle'
  }

  const ctl = new MeteorController({
    onPlayState: state => {
      playState = state
      render()
      scene?.applyPlayState(state)
    }
  })
  if (scene) scene.bind(ctl)
  render()

  toggleBtn?.addEventListener('click', () => {
    if (ctl.playState === 'done') {
      ctl.replay()
      scene?.resetDemo()
    } else {
      ctl.togglePlay()
    }
  })
  replayBtn?.addEventListener('click', () => {
    ctl.replay()
    scene?.resetDemo()
  })

  return ctl
}
