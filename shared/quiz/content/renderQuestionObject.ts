/* ============================================================
   内容层 · 题目对象渲染器
   ------------------------------------------------------------
   把「一道题」渲染进自由布局画布的紧凑题块（cq-qobj）：
   - view（课程 / 预览）：选项是可判题的按钮，事件走 data-cq-opt；
   - edit（编辑器）：题干 / 设问 / 选项 / 答案 / 解析全部在画布内就地编辑，
     不再有画布外的题目表单；
   - 本文件只产出 DOM 与事件回调，不直接改数据，数据仍由编辑器写回
     group.questions[]，保证单一真源。
   ============================================================ */
import type { CqChoice, CqEssay, CqQuestion, OptionLayout } from './types'
import { answerKeys, essayStems, isChoiceCorrect, type CardState } from './renderCard'
import { escapeAttr, escapeHtml, renderInlineLines, renderRichText } from './richText'

/** 编辑态下的交互状态（由编辑器持有） */
export interface QuestionObjectEditState {
  /** 当前选中的选项 key（画布高亮 + 属性栏联动） */
  activeOptionKey?: string | null
  /** 参考答案编辑区是否展开（主观题） */
  answerOpen?: boolean
  /** 解析编辑区是否展开 */
  analysisOpen?: boolean
}

export interface RenderQuestionObjectOptions {
  question: CqQuestion
  /** 全卷序号（0 起），用于题号 */
  index: number
  /** view：可作答；edit：画布内直接编辑 */
  mode?: 'view' | 'edit'
  state?: CardState
  /** 交互键（如 q-3）；view 模式写入 data-cq-opt */
  key?: string
  optionLayout?: OptionLayout
  showNumber?: boolean
  editState?: QuestionObjectEditState
}

const EMPTY_STATE: CardState = { selected: [], submitted: false, revealed: false }

function numberLabel(index: number): string {
  return String(index + 1).padStart(2, '0')
}

function optionClass(question: CqChoice, state: CardState, optionKey: string): string {
  const classes = ['cq-qobj__opt']
  if (!state.submitted) {
    if (state.selected.includes(optionKey)) classes.push('is-selected')
    return classes.join(' ')
  }
  if (answerKeys(question).includes(optionKey)) classes.push('is-correct')
  else if (state.selected.includes(optionKey)) classes.push('is-wrong')
  else classes.push('is-dim')
  return classes.join(' ')
}

function badgeText(question: CqQuestion): string {
  if (question.type === 'essay') return '综合题'
  return question.mode === 'multiple' ? '多选题' : '单选题'
}

function headHtml(question: CqQuestion, index: number, showNumber: boolean, editing: boolean): string {
  return `<div class="cq-qobj__head">
      ${showNumber ? `<span class="cq-qobj__no">${numberLabel(index)}</span>` : ''}
      <span class="cq-qobj__badge${question.type === 'essay' ? ' cq-qobj__badge--essay' : ''}">${badgeText(question)}</span>
      <span class="cq-qobj__grow"></span>
      ${editing ? '<button type="button" class="cq-qobj__tool" data-qobj-action="delete" title="删除这道题">删除</button>' : ''}
    </div>`
}

/* ---------------- view 模式 ---------------- */

function choiceView(question: CqChoice, options: RenderQuestionObjectOptions, state: CardState): string {
  const interactive = !!options.key
  const columns = options.optionLayout?.mode === 'flow' ? options.optionLayout.columns ?? 2 : 2
  const buttons = (question.options ?? [])
    .map((option) => {
      const picked = state.selected.includes(option.key)
      const checked = picked && (!state.submitted || answerKeys(question).includes(option.key))
      return `<button type="button" class="${optionClass(question, state, option.key)}"${
        interactive ? ` data-cq-opt="${escapeAttr(options.key as string)}" data-key="${escapeAttr(option.key)}"` : ''
      }${picked ? ' aria-pressed="true"' : ' aria-pressed="false"'} tabindex="${interactive ? '0' : '-1'}">
          <span class="cq-qobj__key">${escapeHtml(option.key)}</span>
          <span class="cq-qobj__text">${renderInlineLines(option.text)}</span>
          ${checked ? '<span class="cq-qobj__check" aria-hidden="true">✓</span>' : ''}
        </button>`
    })
    .join('')

  const right = isChoiceCorrect(question, state.selected)
  const verdict = !state.submitted
    ? ''
    : `<div class="cq-qobj__verdict ${right ? 'is-right' : 'is-wrong'}">
        <span>${right ? '回答正确' : '回答错误'}</span>
        <span>正确答案：<b>${escapeHtml(answerKeys(question).join(''))}</b></span>
      </div>`

  const analysis = state.submitted && question.analysis
    ? `<div class="cq-qobj__analysis"><span class="cq-qobj__label">解析</span>${renderRichText(question.analysis)}</div>`
    : ''

  return `<div class="cq-qobj__stem">${renderInlineLines(question.stem || '')}</div>
    <div class="cq-qobj__opts" style="--cq-qobj-cols:${columns}">${buttons}</div>
    ${verdict}${analysis}`
}

function essayView(question: CqEssay, options: RenderQuestionObjectOptions, state: CardState): string {
  const stems = essayStems(question)
  const interactive = !!options.key
  const list = stems.length
    ? `<ol class="cq-qobj__stems">${stems.map((stem) => `<li>${renderInlineLines(stem)}</li>`).join('')}</ol>`
    : ''
  const reveal = interactive
    ? `<button type="button" class="cq-qobj__reveal${state.revealed ? ' is-open' : ''}" data-cq-reveal="${escapeAttr(
        options.key as string
      )}">${state.revealed ? '收起参考答案' : '查看参考答案'}</button>`
    : ''
  const answer = state.revealed && question.referenceAnswer
    ? `<div class="cq-qobj__analysis cq-qobj__answer"><span class="cq-qobj__label">参考答案</span>${renderRichText(
        question.referenceAnswer
      )}</div>`
    : ''
  return `${list}${reveal}${answer}`
}

/* ---------------- edit 模式：全部在画布内直接编辑 ---------------- */

/** 富文本编辑区：内容按 HTML 渲染，输入时上抛 innerHTML；关闭时用 hidden 收起而不是移除，方便就地开合 */
function richEditor(html: string, field: string, placeholder: string, hidden: boolean): string {
  return `<div class="cq-qobj__editor" contenteditable="true" data-edit="${field}" data-placeholder="${escapeAttr(
    placeholder
  )}"${hidden ? ' hidden' : ''}>${renderRichText(html)}</div>`
}

function headTools(editState: QuestionObjectEditState, essay: boolean): string {
  const answerLabel = essay ? '参考答案' : ''
  return `<div class="cq-qobj__tools">
      ${essay
        ? `<button type="button" class="cq-qobj__fold${editState.answerOpen ? ' is-open' : ''}" data-qobj-action="toggle-answer">${
            editState.answerOpen ? '收起参考答案' : answerLabel ? '编辑参考答案' : '参考答案'
          }</button>`
        : ''}
      <button type="button" class="cq-qobj__fold${editState.analysisOpen ? ' is-open' : ''}" data-qobj-action="toggle-analysis">${
        editState.analysisOpen ? '收起解析' : '解析'
      }</button>
    </div>`
}

function choiceEdit(question: CqChoice, options: RenderQuestionObjectOptions, editState: QuestionObjectEditState): string {
  const columns = options.optionLayout?.mode === 'flow' ? options.optionLayout.columns ?? 2 : 2
  const correct = answerKeys(question)
  const items = (question.options ?? [])
    .map((option) => {
      const active = editState.activeOptionKey === option.key
      const isCorrect = correct.includes(option.key)
      return `<div class="cq-qobj__opt cq-qobj__opt--edit${active ? ' is-editing' : ''}${
        isCorrect ? ' is-answer' : ''
      }" role="button" tabindex="-1" data-qobj-option="${escapeAttr(option.key)}">
          <span class="cq-qobj__key">${escapeHtml(option.key)}</span>
          <span class="cq-qobj__text" contenteditable="true" data-edit="option" data-key="${escapeAttr(
            option.key
          )}">${renderInlineLines(option.text)}</span>
          <span class="cq-qobj__answer${isCorrect ? ' is-on' : ''}" data-answer-key="${escapeAttr(
            option.key
          )}" title="设为正确答案">✓</span>
        </div>`
    })
    .join('')

  const analysis = richEditor(question.analysis || '', 'analysis', '填写解析（仅判定后展示）', !editState.analysisOpen)
  return `<div class="cq-qobj__stem" contenteditable="true" data-edit="stem" data-placeholder="填写题干">${renderInlineLines(
    question.stem || ''
  )}</div>
    <div class="cq-qobj__opts" style="--cq-qobj-cols:${columns}">${items}</div>
    ${headTools(editState, false)}
    ${analysis}`
}

function essayEdit(question: CqEssay, options: RenderQuestionObjectOptions, editState: QuestionObjectEditState): string {
  const stems = essayStems(question)
  const items = stems
    .map(
      (stem, index) =>
        `<li><span class="cq-qobj__stem-item" contenteditable="true" data-edit="stem-item" data-index="${index}" data-placeholder="填写设问，回车新增一条">${renderInlineLines(
          stem
        )}</span></li>`
    )
    .join('')
  const answer = richEditor(question.referenceAnswer || '', 'answer', '填写参考答案', !editState.answerOpen)
  const analysis = richEditor(question.analysis || '', 'analysis', '填写解析（仅判定后展示）', !editState.analysisOpen)
  return `<ol class="cq-qobj__stems cq-qobj__stems--edit">${items || '<li class="cq-qobj__empty">还没有设问，点击设置里「添加设问」</li>'}</ol>
    ${headTools(editState, true)}
    ${answer}
    ${analysis}`
}

/**
 * 渲染题目对象内容。
 * 返回 `.cq-qobj` 根元素；外层定位与尺寸由 renderMaterial 负责。
 */
export function renderQuestionObject(options: RenderQuestionObjectOptions): HTMLElement {
  const { question } = options
  const editState = options.editState ?? {}
  const editing = options.mode === 'edit'
  const state = options.state ?? EMPTY_STATE

  const root = document.createElement('div')
  root.className = `cq-qobj cq-qobj--${question.type}${editing ? ' cq-qobj--edit' : ''}`
  root.dataset.qobjType = question.type
  if (question.id) root.dataset.qobjQuestionId = question.id

  root.innerHTML =
    headHtml(question, options.index, options.showNumber !== false, editing) +
    (editing
      ? question.type === 'essay'
        ? essayEdit(question, options, editState)
        : choiceEdit(question as CqChoice, options, editState)
      : question.type === 'essay'
        ? essayView(question, options, state)
        : choiceView(question as CqChoice, options, state))
  return root
}
