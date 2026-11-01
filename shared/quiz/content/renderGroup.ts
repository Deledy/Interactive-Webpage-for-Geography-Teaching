/* ============================================================
   内容层 · 题组渲染器（画布 + 题目槽）
   ------------------------------------------------------------
   一个题组 = 一张画布 + 一个题目槽 + N 道题：
   - 画布只放材料（文字 / 图片 / 表格）与题目槽；
   - 槽内显示“当前题”，由调用方决定是哪一道（见 renderGroupPage）；
   - 没有题目槽的旧数据回退为「材料 + 题目卡片」（renderQuestionGroup）。
   ============================================================ */
import type { CqGroup, CqQuestion } from './types'
import { renderQuestionCard, type CardState } from './renderCard'
import { renderMaterialLayout } from './renderMaterial'
import { slotObject } from './questionObjects'
import { renderQuestionObject } from './renderQuestionObject'
import { renderRichText } from './richText'

export interface RenderGroupOptions {
  group: CqGroup
  /** 该组第一题在全卷中的序号（决定题号） */
  startQuestionIndex?: number
  mode?: 'view' | 'preview'
  /** 是否默认展示判定 / 解析（预览用） */
  showAnalysis?: boolean
  /** 是否显示「题组 N / N 题」头部（运行时列表模式用） */
  showHead?: boolean
  /** 题组序号（0 起，仅用于头部文案） */
  groupIndex?: number
  /** 自定义单题渲染；缺省使用 renderQuestionCard 的静态结构 */
  renderQuestion?: (question: CqQuestion, index: number, group: CqGroup) => string | HTMLElement
}

export interface RenderGroupPageOptions {
  /** 交互键（如 q-3） */
  key: string
  /** 全卷序号（0 起） */
  index: number
  state: CardState
}

/** 题组是否有题目槽（有槽才走「一屏一题」页面模型） */
export function groupHasSlot(group: CqGroup): boolean {
  return !!slotObject(group.materialLayout)
}

/**
 * 渲染一页：画布（材料 + 槽）+ 槽内当前题。
 * 画布不重建、材料位置不变，换题只替换槽内容。
 */
export function renderGroupPage(
  group: CqGroup,
  question: CqQuestion,
  options: RenderGroupPageOptions
): HTMLElement {
  const slot = slotObject(group.materialLayout)
  const content = renderQuestionObject({
    question,
    index: options.index,
    state: options.state,
    key: options.key,
    mode: 'view',
    optionLayout: slot?.optionLayout
  })
  content.classList.add('cq-slot__question')

  const root = document.createElement('section')
  root.className = 'cq-group cq-group--page'
  if (group.id) root.dataset.cqGroupId = group.id
  if (group.title) root.dataset.cqGroupTitle = group.title

  const material = renderMaterialLayout(group.materialLayout!, { mode: 'view', slotContent: content })
  material.classList.add('cq-group__material', 'cq-page__material')
  root.appendChild(material)
  return root
}

/** 材料块：自由布局优先（空画布视为无材料），旧 HTML 兜底；没有材料返回 null */
export function renderGroupMaterial(group: CqGroup): HTMLElement | null {
  if (group.materialLayout && group.materialLayout.objects.length) {
    const material = renderMaterialLayout(group.materialLayout, { mode: 'view' })
    material.classList.add('cq-group__material')
    return material
  }
  if (group.material) {
    const material = document.createElement('div')
    material.className = 'cq-group__material cq-group__material--html'
    material.innerHTML = renderRichText(group.material)
    return material
  }
  return null
}

function appendCard(container: HTMLElement, rendered: string | HTMLElement): void {
  if (rendered instanceof HTMLElement) {
    container.appendChild(rendered)
    return
  }
  const holder = document.createElement('div')
  holder.innerHTML = rendered
  const node = holder.firstElementChild
  if (node) container.appendChild(node)
}

/** 旧数据兜底：材料 + 题目卡片（没有题目槽的题组） */
export function renderQuestionGroup(options: RenderGroupOptions): HTMLElement {
  const { group } = options
  const root = document.createElement('section')
  root.className = `cq-group cq-group--${group.layout === 'split' ? 'split' : 'stacked'}`
  if (group.id) root.dataset.cqGroupId = group.id

  if (options.showHead !== false) {
    const head = document.createElement('div')
    head.className = 'cq-group__head'
    const index = (options.groupIndex ?? 0) + 1
    head.innerHTML =
      `<span class="cq-group__badge">题组 ${index}</span>` +
      `<span class="cq-group__count">${group.questions.length} 题</span>`
    root.appendChild(head)
  }

  if (group.title) {
    const title = document.createElement('h3')
    title.className = 'cq-group__title'
    title.textContent = group.title
    root.appendChild(title)
  }

  const material = renderGroupMaterial(group)
  if (material) root.appendChild(material)
  else root.classList.add('cq-group--no-material')

  const questions = document.createElement('div')
  questions.className = 'cq-group__questions cq-group__qs'
  const start = options.startQuestionIndex ?? 0
  const showAnalysis = options.showAnalysis ?? options.mode === 'preview'

  group.questions.forEach((question, offset) => {
    const index = start + offset
    if (options.renderQuestion) {
      appendCard(questions, options.renderQuestion(question, index, group))
      return
    }
    const state: CardState = { selected: [], submitted: showAnalysis, revealed: showAnalysis }
    appendCard(
      questions,
      renderQuestionCard({
        question,
        key: `q-${index}`,
        index,
        state,
        showMaterial: false
      })
    )
  })

  if (questions.childElementCount) root.appendChild(questions)
  return root
}
