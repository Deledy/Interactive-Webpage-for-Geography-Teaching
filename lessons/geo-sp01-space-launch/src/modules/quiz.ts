/** M6 随堂练习：整屏背景 + 左题干卡 / 右结果卡（解析 + 知识点关联）+ 题号切换 */
import { lessonData } from '../data/lessonData'
import type { QuizQuestion } from '../types'
import { highlight } from '../utils/dom'
import { icon } from '../utils/icons'
import quizBg from '../../assets/images/练习题背景.png'

/** 作答状态：idle 待作答 / right 答对 / wrong 答错 */
type QuizState = 'idle' | 'right' | 'wrong'

const STATE_META: Record<QuizState, string> = {
  idle: '请选择你的答案',
  right: '回答正确',
  wrong: '回答错误'
}

/** 结论行的状态徽标图标 */
const STATE_ICON: Record<QuizState, string> = {
  idle: 'icon-info',
  right: 'icon-check',
  wrong: 'icon-close'
}

/**
 * 知识归纳条目的图标：按条目前缀词（如「气象：……」的「气象」）取一枚线性图标，
 * 条目增删或换课题后自动重排，找不到对应词则回退到默认图标。
 */
const KNOWLEDGE_ICON_RULES: [string, string][] = [
  ['气象', 'icon-climate'],
  ['气候', 'icon-climate'],
  ['纬度', 'icon-rocket'],
  ['地形', 'icon-terrain'],
  ['地表', 'icon-terrain'],
  ['海陆', 'icon-sea'],
  ['水源', 'icon-water'],
  ['交通', 'icon-truck'],
  ['运输', 'icon-truck'],
  ['安全', 'icon-shield'],
  ['人口', 'icon-users'],
  ['科技', 'icon-bulb']
]

function knowledgeIcon(text: string): string {
  const label = text.split('：')[0]
  return KNOWLEDGE_ICON_RULES.find(([word]) => label.includes(word))?.[1] ?? 'icon-spark'
}

let host: HTMLElement | null = null
let body: HTMLElement | null = null
let index = 0
let selectedKey: string | null = null
let state: QuizState = 'idle'

function currentQuestion(): QuizQuestion {
  return lessonData.quiz.questions[index]
}

/** 选项状态类：揭示后标出正确项 / 所选项，其余置灰 */
function optionClass(key: string, answerKey: string): string {
  if (state === 'idle') return 'm6__option'
  if (key === answerKey) return 'm6__option is-correct'
  if (key === selectedKey) return 'm6__option is-wrong'
  return 'm6__option is-disabled'
}

function render(): void {
  if (!body) return
  const quiz = lessonData.quiz
  const total = quiz.questions.length
  const question = currentQuestion()
  const meta = STATE_META[state]
  const revealed = state !== 'idle'
  const isLast = index === total - 1

  body.innerHTML = `
    <div class="m6__head">
      <div class="m6__head-left">
        <div class="m6__title-row">
          <h2 class="sec-title m6__title">随堂练习</h2>
          <span class="m6__watermark" aria-hidden="true">${quiz.watermark}</span>
        </div>
        <p class="m6__subtitle">${quiz.subtitle}</p>
      </div>
      <span class="m6__counter">第 <b class="num">${index + 1}</b> / ${total} 题</span>
    </div>

    <div class="m6__stage">
      <div class="m6__q">
        ${question.source ? `<span class="m6__source">${question.source}</span>` : ''}
        ${question.material ? `<p class="m6__material">${highlight(question.material, question.highlight)}</p>` : ''}
        <p class="m6__stem">${highlight(question.stem, question.highlight)}</p>
        <div class="m6__options" role="group" aria-label="选项（点击即作答）">
          ${question.options
            .map(
              (opt) => `<button class="${optionClass(opt.key, question.answerKey)}" type="button" data-key="${opt.key}">
                <span class="m6__key">${opt.key}</span><span class="m6__option-text">${opt.text}</span>
              </button>`
            )
            .join('')}
        </div>
      </div>

      <div class="m6__side" data-state="${state}">
        <div class="m6__verdict">
          <span class="m6__verdict-badge" aria-hidden="true">${icon(STATE_ICON[state], 26)}</span>
          <span class="m6__verdict-title">${meta}</span>
          ${
            revealed
              ? `<span class="m6__verdict-key">正确答案：<b class="num">${question.answerKey}</b></span>`
              : `<span class="m6__verdict-hint">点击选项即可作答</span>`
          }
        </div>

        ${
          revealed
            ? `<section class="m6__block m6__block--analysis">
                <h3 class="m6__block-title">${icon('icon-book', 26)}<span>解析</span></h3>
                <div class="m6__analysis-box"><p class="m6__analysis">${question.analysis}</p></div>
              </section>
              <section class="m6__block m6__block--knowledge">
                <h3 class="m6__block-title">${icon('icon-bulb', 26)}<span>知识归纳</span></h3>
                <p class="m6__knowledge-title">${question.knowledge.title}</p>
                <ul class="m6__knowledge-list">
                  ${question.knowledge.items
                    .map(
                      (item) => `<li class="m6__knowledge-item">
                        <span class="m6__knowledge-icon" aria-hidden="true">${icon(knowledgeIcon(item), 20)}</span>
                        <span class="m6__knowledge-text">${item}</span>
                      </li>`
                    )
                    .join('')}
                </ul>
              </section>`
            : `<p class="m6__locked"><span>点击选项后显示解析与知识归纳</span></p>`
        }

        <div class="m6__actions">
          <button class="btn btn--ghost m6__again${revealed ? '' : ' is-hidden'}" type="button" data-act="again">
            ${icon('icon-refresh', 20)}<span>再练一次</span>
          </button>
          <button class="btn btn--primary m6__next" type="button" data-act="next">
            <span>${isLast ? '回到第 1 题' : '下一题'}</span>${icon(isLast ? 'icon-refresh' : 'icon-arrow-right', 20)}
          </button>
        </div>
      </div>
    </div>
  `
}

/** 点击选项即判定并揭示答案（不再需要二次确认） */
function answer(key: string): void {
  selectedKey = key
  state = key === currentQuestion().answerKey ? 'right' : 'wrong'
  render()
}

function resetQuestion(): void {
  selectedKey = null
  state = 'idle'
  render()
}

function goNext(): void {
  index = (index + 1) % lessonData.quiz.questions.length
  resetQuestion()
}

/** 题卡内容每次重渲染，事件统一委托在 .m6__body 上 */
function onClick(ev: MouseEvent): void {
  const target = ev.target as HTMLElement
  const option = target.closest<HTMLButtonElement>('.m6__option')
  if (option) {
    if (state !== 'idle') return
    answer(option.dataset.key ?? '')
    return
  }
  const act = target.closest<HTMLButtonElement>('[data-act]')?.dataset.act
  if (act === 'again') resetQuestion()
  else if (act === 'next') goNext()
}

export function initQuiz(root: HTMLElement): void {
  host = root
  index = 0
  selectedKey = null
  state = 'idle'

  root.classList.add('m6')
  // 背景层置于重渲染容器之外，切题时图片不重新解码
  root.innerHTML = `
    <div class="m6__bg" aria-hidden="true"><img src="${quizBg}" alt="" decoding="async" /></div>
    <div class="m6__veil" aria-hidden="true"></div>
    <div class="m6__body"></div>
  `
  body = root.querySelector<HTMLElement>('.m6__body')
  body?.addEventListener('click', onClick)
  render()
}

export function resetQuiz(): void {
  if (!host) return
  index = 0
  selectedKey = null
  state = 'idle'
  render()
}
