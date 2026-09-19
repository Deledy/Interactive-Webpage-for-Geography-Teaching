/** M6 随堂练习：整屏背景 + 左题干卡 / 右结果卡（解析 + 知识点关联）+ 题号切换 */
import { lessonData } from '../data/lessonData'
import type { QuizQuestion } from '../types'
import { highlight } from '../utils/dom'
import { icon } from '../utils/icons'
import { markDone } from '../state'
import quizBg from '../../assets/images/练习题背景.png'

/** 作答状态：idle 待作答 / right 答对 / wrong 答错 */
type QuizState = 'idle' | 'right' | 'wrong'

const STATE_META: Record<QuizState, { icon: string; title: string }> = {
  idle: { icon: 'icon-info', title: '请选择你的答案' },
  right: { icon: 'icon-check', title: '回答正确！' },
  wrong: { icon: 'icon-close', title: '回答错误' }
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
        <p class="m6__hint">${icon('icon-bulb', 22)}<span>小提示：${question.hint}</span></p>
      </div>

      <div class="m6__side" data-state="${state}">
        <div class="m6__result">
          <span class="m6__result-icon">${icon(meta.icon, 34)}</span>
          <div class="m6__result-text">
            <p class="m6__result-title">${meta.title}</p>
            <p class="m6__result-sub">${
              revealed ? `正确答案：<b class="num">${question.answerKey}</b>` : '点击选项即可作答'
            }</p>
          </div>
        </div>

        ${
          revealed
            ? `<div class="m6__block m6__block--analysis">
                <h3 class="m6__block-title">${icon('icon-list', 24)}<span>解析</span></h3>
                <p class="m6__analysis">${question.analysis}</p>
              </div>
              <div class="m6__block m6__block--knowledge">
                <h3 class="m6__block-title">${icon('icon-book', 24)}<span>知识点关联</span></h3>
                <p class="m6__knowledge-title">${question.knowledge.title}</p>
                <ul class="m6__knowledge-list">
                  ${question.knowledge.items
                    .map((item) => `<li class="m6__knowledge-item">${item}</li>`)
                    .join('')}
                </ul>
              </div>`
            : `<p class="m6__locked">${icon('icon-list', 22)}<span>点击选项后显示解析与知识点关联</span></p>`
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
  markDone('m6')
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
