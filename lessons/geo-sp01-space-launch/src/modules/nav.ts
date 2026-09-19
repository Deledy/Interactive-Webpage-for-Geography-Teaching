/** M0 任务路线导航（顶部固定）：火箭 logo + 任务点跳转 + 全屏切换 + 进度高亮 */
import { lessonData } from '../data/lessonData'
import { on, must } from '../utils/dom'
import { icon } from '../utils/icons'
import { setActiveScreen, store, subscribe } from '../state'
import { initTimer } from './timer'
import { initRollcall } from './rollcall'
import rocketLogo from '../../assets/icons/icon-rocket.svg?raw'

interface TaskItem {
  /** 任务点点击后跳转的 section id */
  target: string
  label: string
}

const TASKS: TaskItem[] = [
  { target: 'm4', label: '选址条件' },
  { target: 'm5', label: '四大基地' },
  { target: 'm6', label: '随堂练习' },
  { target: 'm7', label: '综合题训练' }
]

/** 屏 → 任务点：M2/M3/M4 同属"选址条件"任务，M1/M8 不点亮任务点；M7 答题屏归「综合题训练」 */
const SCREEN_TASK: Record<string, string> = {
  m2: 'm4',
  m3: 'm4',
  m4: 'm4',
  m5: 'm5',
  m6: 'm6',
  m7: 'm7',
  m7a: 'm7'
}

export function initNav(root: HTMLElement, onReset: () => void): void {
  root.innerHTML = `
    <div class="nav__inner">
      <div class="nav__brand">
        <span class="nav__logo" aria-hidden="true">${rocketLogo}</span>
        <span class="nav__title">${lessonData.title}</span>
      </div>
      <nav class="nav__tasks" aria-label="任务导航">
        ${TASKS.map(
          (task) =>
            `<button type="button" class="nav__task" data-target="${task.target}">${task.label}</button>`
        ).join('')}
      </nav>
      <div class="nav__actions">
        <div class="nav__timer"></div>
        <button type="button" class="nav__btn nav__fullscreen btn btn--ghost" aria-pressed="false">${icon('icon-expand', 20)}<span>全屏</span></button>
        <button type="button" class="nav__btn nav__reset btn btn--ghost">重置本页</button>
        <div class="nav__rollcall"></div>
      </div>
    </div>
    <div class="nav__progress" aria-hidden="true"></div>
  `

  const taskButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.nav__task'))
  const progress = must<HTMLElement>('.nav__progress', root)
  const resetButton = must<HTMLButtonElement>('.nav__reset', root)
  const fullscreenButton = must<HTMLButtonElement>('.nav__fullscreen', root)

  initTimer(must<HTMLElement>('.nav__timer', root))
  initRollcall(must<HTMLElement>('.nav__rollcall', root))

  /** 高亮当前屏对应的任务点，并推进进度线 */
  function highlight(screenId: string): void {
    const taskTarget = SCREEN_TASK[screenId]
    taskButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.target === taskTarget))
    const index = TASKS.findIndex((task) => task.target === taskTarget)
    progress.style.width = index < 0 ? '0%' : `${((index + 1) / TASKS.length) * 100}%`
  }

  /** 已完成任务点加 is-done（变绿） */
  function syncDone(done: Record<string, boolean>): void {
    taskButtons.forEach((btn) => {
      btn.classList.toggle('is-done', Boolean(done[btn.dataset.target ?? '']))
    })
  }

  taskButtons.forEach((btn) => {
    on(btn, 'click', () => {
      const target = btn.dataset.target
      if (target) document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' })
    })
  })

  on(resetButton, 'click', onReset)

  /** 全屏态：按钮图标/文案与 is-on 高亮同步（F11 或 Esc 退出时也能跟上） */
  function syncFullscreen(): void {
    const active = document.fullscreenElement !== null
    fullscreenButton.classList.toggle('is-on', active)
    fullscreenButton.setAttribute('aria-pressed', String(active))
    fullscreenButton.innerHTML = `${icon(active ? 'icon-compress' : 'icon-expand', 20)}<span>${active ? '退出全屏' : '全屏'}</span>`
  }

  on(fullscreenButton, 'click', () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  })
  document.addEventListener('fullscreenchange', syncFullscreen)
  if (!document.fullscreenEnabled) {
    fullscreenButton.disabled = true
  } else {
    syncFullscreen()
  }

  highlight(store.activeScreen)
  syncDone(store.moduleDone)
  subscribe((s) => {
    syncDone(s.moduleDone)
    highlight(s.activeScreen)
  })

  const ratios = new Map<string, number>()
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const node = entry.target as HTMLElement
        if (entry.isIntersecting) ratios.set(node.id, entry.intersectionRatio)
        else ratios.delete(node.id)
      })
      let currentId = ''
      let currentRatio = -1
      ratios.forEach((ratio, id) => {
        if (ratio > currentRatio) {
          currentRatio = ratio
          currentId = id
        }
      })
      if (currentId) setActiveScreen(currentId)
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] }
  )
  document.querySelectorAll('.screen').forEach((screen) => observer.observe(screen))
}
