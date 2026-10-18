/* ============================================================
   内容层 · 题目卡片渲染（唯一真源）
   ------------------------------------------------------------
   只负责「一道题」的标记结构：题号 / 题型标签 / 材料 / 题干 /
   选项 / 判定条 / 解析 / 综合题设问与参考答案。
   窗口骨架（标题、题号导航、计时、浮层、空态）属于运行时，不在此文件。

   - 富文本渲染统一走 richText.ts（HTML 清洗 + 纯文本转义），
     本文件不直接依赖运行时，也不依赖任何单课样式；
   - 交互靠 data-cq-* 属性表达，事件由运行时绑定；
   - 类名全部为 cq-*（卡片自身）与 cq-btn*（卡片动作按钮），
     样式见同目录 card.css，不引用单课的 btn / panel 等类名。

   详见 shared/quiz/docs/2026-10-17-quiz-card-wysiwyg-design.md §7。
   ============================================================ */
import type { CqChoice, CqEssay, CqQuestion } from './types'
import { escapeHtml, renderRichText } from './richText'

const CHOICE_BADGE: Record<'single' | 'multiple', string> = {
  single: '单选题',
  multiple: '多选题'
}

/** 单题作答状态 */
export interface CardState {
  selected: string[]
  submitted: boolean
  revealed: boolean
}

export interface QuestionCardOptions {
  question: CqQuestion
  /** 交互键；运行时用它把 DOM 与状态表对应起来（如 'q-0'） */
  key: string
  /** 全卷序号（0 起），用于题号展示 */
  index: number
  state: CardState
}

/** 选择题正确答案键（单选返回单元素数组） */
export function answerKeys(question: CqChoice): string[] {
  return Array.isArray(question.answer) ? question.answer : [question.answer]
}

/** 多选集合相等判定（与顺序无关） */
export function isChoiceCorrect(question: CqChoice, selected: string[]): boolean {
  const expected = answerKeys(question).slice().sort()
  const actual = selected.slice().sort()
  return expected.length === actual.length && expected.every((key, index) => key === actual[index])
}

/** 综合题设问（统一为数组） */
export function essayStems(question: CqEssay): string[] {
  return Array.isArray(question.stems) ? question.stems : question.stems ? [question.stems] : []
}

function optionClass(question: CqChoice, state: CardState, optionKey: string): string {
  const cls = ['cq-opt']
  if (!state.submitted) {
    if (state.selected.includes(optionKey)) cls.push('is-selected')
    return cls.join(' ')
  }
  const correct = answerKeys(question)
  if (correct.includes(optionKey)) cls.push('is-correct')
  else if (state.selected.includes(optionKey)) cls.push('is-wrong')
  else cls.push('is-dim')
  return cls.join(' ')
}

function choiceHtml(question: CqChoice, key: string, index: number, state: CardState): string {
  const modeOne = question.mode === 'multiple' ? 'multiple' : 'single'
  const revealed = state.submitted
  const options = question.options
    .map(
      (opt) =>
        `<button type="button" class="${optionClass(question, state, opt.key)}" data-cq-opt="${key}" data-key="${opt.key}"${
          revealed ? ' disabled' : ''
        }${state.selected.includes(opt.key) ? ' aria-pressed="true"' : ' aria-pressed="false"'}>
          <span class="cq-opt__key">${escapeHtml(opt.key)}</span>
          <span class="cq-opt__text">${escapeHtml(opt.text)}</span>
        </button>`
    )
    .join('')

  const right = isChoiceCorrect(question, state.selected)
  const verdict = !revealed
    ? ''
    : `<div class="cq-verdict ${right ? 'is-right' : 'is-wrong'}">
        <span class="cq-verdict__title">${right ? '回答正确' : '回答错误'}</span>
        <span class="cq-verdict__key">正确答案：<b>${answerKeys(question).join('')}</b></span>
      </div>`

  const detail = !revealed
    ? ''
    : `<div class="cq-detail">
        ${
          question.analysis
            ? `<section class="cq-block cq-block--analysis">
                <h4 class="cq-block__title">解析</h4>
                <div class="cq-block__body">${renderRichText(question.analysis)}</div>
              </section>`
            : ''
        }
      </div>`

  const submit =
    modeOne === 'multiple' && !revealed
      ? `<div class="cq-q__actions">
          <button type="button" class="cq-btn cq-btn--primary cq-submit" data-cq-submit="${key}"${
            state.selected.length ? '' : ' disabled'
          }>提交答案</button>
        </div>`
      : ''

  const awaiting = revealed
    ? ''
    : `<div class="cq-q__awaiting">${
        modeOne === 'multiple' ? '勾选选项后点「提交答案」' : '选择一个选项'
      }，这里将显示判定结果、正确答案与解析。</div>`

  return `<article class="cq-q" data-q="${key}" data-type="choice">
    <div class="cq-q__head">
      <span class="cq-q__no">${index + 1}</span>
      <span class="cq-q__badge">${CHOICE_BADGE[modeOne]}</span>
    </div>
    <div class="pw-split">
      <div class="pw-col pw-col--main">
        ${question.material ? `<div class="cq-q__material">${renderRichText(question.material)}</div>` : ''}
        <p class="cq-q__stem">${escapeHtml(question.stem)}</p>
        <div class="cq-q__options">${options}</div>
        ${submit}
      </div>
      <div class="pw-col pw-col--side">${verdict}${detail}${awaiting}</div>
    </div>
  </article>`
}

function essayHtml(question: CqEssay, key: string, index: number, state: CardState): string {
  const stems = essayStems(question)

  const detail = !state.revealed
    ? ''
    : `<div class="cq-detail">
        ${
          question.referenceAnswer
            ? `<section class="cq-block cq-block--answer">
                <h4 class="cq-block__title">参考答案</h4>
                <div class="cq-block__body">${renderRichText(question.referenceAnswer)}</div>
              </section>`
            : ''
        }
        ${
          question.analysis
            ? `<section class="cq-block cq-block--analysis">
                <h4 class="cq-block__title">解析</h4>
                <div class="cq-block__body">${renderRichText(question.analysis)}</div>
              </section>`
            : ''
        }
      </div>`

  const reveal = `<div class="cq-q__actions">
      <button type="button" class="cq-btn ${state.revealed ? 'cq-btn--ghost' : 'cq-btn--primary'} cq-reveal" data-cq-reveal="${key}">
        ${state.revealed ? '收起参考答案' : '查看参考答案'}
      </button>
    </div>`

  return `<article class="cq-q" data-q="${key}" data-type="essay">
    <div class="cq-q__head">
      <span class="cq-q__no">${index + 1}</span>
      <span class="cq-q__badge cq-q__badge--essay">综合题</span>
    </div>
    <div class="pw-split">
      <div class="pw-col pw-col--main">
        ${question.material ? `<div class="cq-q__material">${renderRichText(question.material)}</div>` : ''}
        ${stems.length ? `<ol class="cq-stems">${stems.map((stem) => `<li>${escapeHtml(stem)}</li>`).join('')}</ol>` : ''}
      </div>
      <div class="pw-col pw-col--side">
        ${reveal}
        ${state.revealed ? detail : '<div class="cq-q__awaiting">点击上方按钮，查看参考答案与解析。</div>'}
      </div>
    </div>
  </article>`
}

/** 渲染一道题（选择题 / 综合题）的卡片 HTML */
export function renderQuestionCard(options: QuestionCardOptions): string {
  const { question, key, index, state } = options
  return question.type === 'essay' ? essayHtml(question, key, index, state) : choiceHtml(question, key, index, state)
}
