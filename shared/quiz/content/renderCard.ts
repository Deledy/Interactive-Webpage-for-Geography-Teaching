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
import { escapeAttr, escapeHtml, renderInlineLines, renderRichText } from './richText'

const CHOICE_BADGE: Record<'single' | 'multiple', string> = {
  single: '单选题',
  multiple: '多选题'
}

/** 材料徽标图标（打开的书） */
const BOOK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 6.6C10.4 5.3 8.4 4.7 5 4.7V18c3.4 0 5.4.6 7 1.9 1.6-1.3 3.6-1.9 7-1.9V4.7c-3.4 0-5.4.6-7 1.9z"/><path d="M12 6.6v13.3"/></svg>'

/** 选项选中图标（对勾） */
const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'

/** 题号：两位数字（01 / 02 …） */
function numberLabel(index: number): string {
  return String(index + 1).padStart(2, '0')
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
  /** 是否渲染题目自带材料（题组模式下材料上提，传 false） */
  showMaterial?: boolean
  /** 无材料时是否仍保留左栏（浮层逐题模式用，保证窗口始终左右布局） */
  fillMaterial?: boolean
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

/* ---------- 布局骨架：左材料 / 右（上题目 + 下说明） ---------- */

/** 左栏材料；无材料时整题退化为单栏（fillMaterial 为真时保留左栏并给出提示） */
function materialPane(question: CqQuestion, showMaterial: boolean, fillMaterial: boolean): string {
  if (!showMaterial) return ''
  if (!question.material) {
    if (!fillMaterial) return ''
    return `<aside class="cq-pane cq-pane--material is-empty" aria-label="材料">
      <div class="cq-pane__label">${BOOK_ICON}<span>材料</span></div>
      <p class="cq-pane__hint">本题无阅读材料，请直接在右侧作答。</p>
    </aside>`
  }
  return `<aside class="cq-pane cq-pane--material" aria-label="材料">
    <div class="cq-pane__label">${BOOK_ICON}<span>材料</span></div>
    <div class="cq-q__material">${renderRichText(question.material)}</div>
  </aside>`
}

/** 左右两栏的组合类名：无材料单栏 / 无材料保底左栏 / 正常左材料 */
function panesClass(material: string, hasMaterial: boolean): string {
  if (!material) return ' is-single'
  return hasMaterial ? '' : ' has-empty-material'
}

/** 右下「说明」区 */
function notePane(inner: string): string {
  return `<section class="cq-pane__segment cq-pane__segment--note" aria-label="说明">
    <h4 class="cq-pane__title">说明</h4>
    ${inner}
  </section>`
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

function choiceHtml(
  question: CqChoice,
  key: string,
  index: number,
  state: CardState,
  showMaterial: boolean,
  fillMaterial: boolean
): string {
  const modeOne = question.mode === 'multiple' ? 'multiple' : 'single'
  const revealed = state.submitted
  const options = question.options
    .map((opt) => {
      const picked = state.selected.includes(opt.key)
      /* 选中且（未判定 或 命中正确答案）时显示对勾 */
      const checked = picked && (!revealed || answerKeys(question).includes(opt.key))
      return `<button type="button" class="${optionClass(question, state, opt.key)}" data-cq-opt="${key}" data-key="${escapeAttr(opt.key)}"${
        revealed ? ' disabled' : ''
      }${picked ? ' aria-pressed="true"' : ' aria-pressed="false"'}>
          <span class="cq-opt__key">${escapeHtml(opt.key)}</span>
          <span class="cq-opt__text">${renderInlineLines(opt.text)}</span>
          ${checked ? `<span class="cq-opt__check" aria-hidden="true">${CHECK_ICON}</span>` : ''}
        </button>`
    })
    .join('')

  const right = isChoiceCorrect(question, state.selected)
  const verdict = !revealed
    ? ''
    : `<div class="cq-verdict ${right ? 'is-right' : 'is-wrong'}">
        <span class="cq-verdict__title">${right ? '回答正确' : '回答错误'}</span>
        <span class="cq-verdict__key">正确答案：<b>${answerKeys(question).join('')}</b></span>
      </div>`

  const analysis = revealed && question.analysis
    ? `<section class="cq-block cq-block--analysis">
        <h4 class="cq-block__title">解析</h4>
        <div class="cq-block__body">${renderRichText(question.analysis)}</div>
      </section>`
    : ''

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

  const material = materialPane(question, showMaterial, fillMaterial)
  const hasMaterial = !!(showMaterial && question.material)

  return `<article class="cq-q" data-q="${key}" data-type="choice">
    <div class="cq-q__panes${panesClass(material, hasMaterial)}">
      ${material}
      <div class="cq-pane cq-pane--main">
        <section class="cq-pane__segment cq-pane__segment--question">
          <div class="cq-q__head">
            <span class="cq-q__no">${numberLabel(index)}</span>
            <span class="cq-q__badge">${CHOICE_BADGE[modeOne]}</span>
          </div>
          <div class="cq-q__stem">${renderInlineLines(question.stem)}</div>
          <div class="cq-q__options">${options}</div>
          ${submit}
        </section>
        ${notePane(`${verdict}${analysis}${awaiting}`)}
      </div>
    </div>
  </article>`
}

function essayHtml(
  question: CqEssay,
  key: string,
  index: number,
  state: CardState,
  showMaterial: boolean,
  fillMaterial: boolean
): string {
  const stems = essayStems(question)

  /** 参考答案：展开后与设问同处右上题目区 */
  const answer = !state.revealed || !question.referenceAnswer
    ? ''
    : `<section class="cq-block cq-block--answer">
        <h4 class="cq-block__title">参考答案</h4>
        <div class="cq-block__body">${renderRichText(question.referenceAnswer)}</div>
      </section>`

  /** 右下说明：解析；无解析时给出对照提示 */
  const noteInner = !state.revealed
    ? '<div class="cq-q__awaiting">先独立作答，再点「查看参考答案」；参考答案显示在题目下方，这里给出解析说明。</div>'
    : question.analysis
      ? `<section class="cq-block cq-block--analysis">
          <h4 class="cq-block__title">解析</h4>
          <div class="cq-block__body">${renderRichText(question.analysis)}</div>
        </section>`
      : '<div class="cq-q__awaiting">参考答案已在上方展开，可对照自己的作答检查要点。</div>'

  const reveal = `<div class="cq-q__actions">
      <button type="button" class="cq-btn ${state.revealed ? 'cq-btn--ghost' : 'cq-btn--primary'} cq-reveal" data-cq-reveal="${key}">
        ${state.revealed ? '收起参考答案' : '查看参考答案'}
      </button>
    </div>`

  const material = materialPane(question, showMaterial, fillMaterial)
  const hasMaterial = !!(showMaterial && question.material)

  return `<article class="cq-q" data-q="${key}" data-type="essay">
    <div class="cq-q__panes${panesClass(material, hasMaterial)}">
      ${material}
      <div class="cq-pane cq-pane--main">
        <section class="cq-pane__segment cq-pane__segment--question">
          <div class="cq-q__head">
            <span class="cq-q__no">${numberLabel(index)}</span>
            <span class="cq-q__badge cq-q__badge--essay">综合题</span>
          </div>
          ${stems.length ? `<ol class="cq-stems">${stems.map((stem) => `<li>${renderInlineLines(stem)}</li>`).join('')}</ol>` : ''}
          ${reveal}
          ${answer}
        </section>
        ${notePane(noteInner)}
      </div>
    </div>
  </article>`
}

/** 渲染一道题（选择题 / 综合题）的卡片 HTML */
export function renderQuestionCard(options: QuestionCardOptions): string {
  const { question, key, index, state, showMaterial = true, fillMaterial = false } = options
  return question.type === 'essay'
    ? essayHtml(question, key, index, state, showMaterial, fillMaterial)
    : choiceHtml(question, key, index, state, showMaterial, fillMaterial)
}
