/** M1 封面：实景背景 + 标题区（标题/标语/开始按钮）+ 本节课教学目标面板 */
import { lessonData } from '../data/lessonData'
import { on } from '../utils/dom'
import { animate, dur, ease, killTweensOf } from '../utils/motion'
import { startTimer } from './timer'
import iconLocation from '../../assets/icons/icon-location.svg?raw'
import iconMap from '../../assets/icons/icon-map.svg?raw'
import iconAnswer from '../../assets/icons/icon-answer.svg?raw'

/** 面板标题（界面文案） */
const GOALS_TITLE = '本节课教学目标'

/** 教学目标图标：与 lessonData.goals 顺序一一对应 */
const GOAL_ICONS = [iconLocation, iconMap, iconAnswer]

/** 封面标语分句：按空白切分，每句独立成行，保证在分句处断行、不在句中割裂 */
const SLOGAN_LINES = lessonData.subtitle.split(/\s+/).filter(Boolean)

interface IntroCtx {
  /** 标题、标语、开始按钮、教学目标面板（按此顺序依次入场） */
  reveals: HTMLElement[]
}

let ctx: IntroCtx | null = null

function hide(node: HTMLElement): void {
  node.style.opacity = '0'
  node.style.transform = 'translateY(12px)'
}

function setInitial(c: IntroCtx): void {
  c.reveals.forEach(hide)
}

function stopTweens(c: IntroCtx): void {
  c.reveals.forEach((node) => killTweensOf(node))
}

function revealContent(c: IntroCtx): void {
  const base = dur('base') / 1000
  c.reveals.forEach((node, i) => {
    animate(node, { opacity: 1, y: 0, duration: base, delay: i * 0.12, ease: ease('out') })
  })
}

/** 跳转到第一个任务屏（M4 任务一 · 一张图看两种选址） */
function scrollToFirstTask(): void {
  document.getElementById('m4')?.scrollIntoView({ behavior: 'smooth' })
}

/** 教学目标面板：序号 + 文案逐条渲染 */
function goalsMarkup(): string {
  return lessonData.goals
    .map(
      (text, i) => `
        <li class="intro__goal">
          <span class="intro__goal-icon" aria-hidden="true">${GOAL_ICONS[i] ?? ''}</span>
          <div class="intro__goal-body">
            <span class="intro__goal-no">${String(i + 1).padStart(2, '0')}</span>
            <p class="intro__goal-text">${text}</p>
          </div>
        </li>`
    )
    .join('')
}

/** 标语：一句一行（两行对仗），行内由 CSS 禁止换行 */
function sloganMarkup(): string {
  return SLOGAN_LINES.map((line) => `<span class="intro__slogan-line">${line}</span>`).join('\n        ')
}

export function initIntro(root: HTMLElement): void {
  root.classList.add('intro')
  /* 背景层（.intro__bg）由入口 HTML 提供：追加而非覆盖，避免丢失 Vite 重写后的图片路径 */
  root.insertAdjacentHTML(
    'beforeend',
    `
    <svg class="intro__orbit" viewBox="0 0 1040 520" aria-hidden="true">
      <ellipse class="intro__orbit-track" cx="520" cy="260" rx="500" ry="196" />
      <ellipse class="intro__orbit-path" cx="520" cy="260" rx="406" ry="148" />
      <g class="intro__sat" transform="translate(660 80) rotate(-12)">
        <rect class="intro__sat-panel" x="-42" y="-13" width="27" height="26" rx="2" />
        <rect class="intro__sat-panel" x="15" y="-13" width="27" height="26" rx="2" />
        <path class="intro__sat-line" d="M-42 -5h27M-42 3h27M15 -5h27M15 3h27" />
        <rect class="intro__sat-body" x="-10" y="-9" width="20" height="18" rx="3" />
        <path class="intro__sat-line" d="M0 -9v-8M-8 -17h16" />
        <circle class="intro__sat-body" cx="0" cy="-20" r="3.6" />
      </g>
    </svg>
    <div class="intro__body">
      <div class="intro__lead">
        <h1 class="intro__title">${lessonData.title}</h1>
        <p class="intro__slogan">${sloganMarkup()}</p>
        <button type="button" class="intro__start btn btn--primary">开始本课</button>
      </div>
      <aside class="intro__goals panel" aria-label="${GOALS_TITLE}">
        <h2 class="intro__goals-title">
          <span class="intro__goals-mark" aria-hidden="true"></span>${GOALS_TITLE}
          <span class="intro__goals-mark intro__goals-mark--end" aria-hidden="true"></span>
        </h2>
        <ul class="intro__goal-list">${goalsMarkup()}</ul>
      </aside>
    </div>
  `
  )

  const title = root.querySelector<HTMLElement>('.intro__title')
  const slogan = root.querySelector<HTMLElement>('.intro__slogan')
  const start = root.querySelector<HTMLButtonElement>('.intro__start')
  const goals = root.querySelector<HTMLElement>('.intro__goals')
  if (!title || !slogan || !start || !goals) return

  ctx = { reveals: [title, slogan, start, goals] }

  on(start, 'click', () => {
    startTimer()
    scrollToFirstTask()
  })

  setInitial(ctx)
  revealContent(ctx)
}

/** 恢复初始 DOM 状态并重新播放（供「重置本页」调用） */
export function resetIntro(): void {
  const c = ctx
  if (!c) return
  stopTweens(c)
  setInitial(c)
  revealContent(c)
}
