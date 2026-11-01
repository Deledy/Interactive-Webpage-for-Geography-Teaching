import { describe, it, expect, afterEach } from 'vitest'
import { renderQuestionGroup } from '../shared/quiz/content/renderGroup'
import { createPracticeView } from '../shared/quiz/runtime/src/practiceWindow'
import type { CqGroup } from '../shared/quiz/content/types'
import type { MaterialLayout } from '../shared/quiz/content/materialTypes'

const materialLayout: MaterialLayout = {
  version: 1,
  width: 1000,
  height: 400,
  objects: [
    {
      id: 'text-1',
      type: 'text',
      x: 20,
      y: 20,
      width: 600,
      height: 120,
      html: '<p>公共材料文字</p>'
    },
    {
      id: 'table-1',
      type: 'table',
      x: 20,
      y: 160,
      width: 500,
      height: 180,
      html: '<table><tr><th>更新方式</th><th>案例</th></tr><tr><td>复建</td><td>夫子庙</td></tr></table>'
    }
  ]
}

function group(): CqGroup {
  return {
    id: 'old-city-group',
    layout: 'split',
    materialLayout,
    questions: [
      {
        id: 'q-1',
        type: 'choice',
        mode: 'single',
        stem: '老城南更新成为商贸文旅区的主要优势条件是（　）',
        options: [
          { key: 'A', text: '位于城市中心' },
          { key: 'B', text: '文化底蕴深厚' }
        ],
        answer: 'B',
        analysis: '文化底蕴深厚。'
      },
      {
        id: 'q-2',
        type: 'essay',
        stems: ['说明该设计的意图。'],
        referenceAnswer: '强调公共空间的审美体验。'
      }
    ]
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('题组渲染 · 材料与题目组合', () => {
  it('split 布局：材料只渲染一次，题目序号接续', () => {
    const root = renderQuestionGroup({ group: group(), startQuestionIndex: 5 })
    expect(root.classList.contains('cq-group--split')).toBe(true)
    expect(root.querySelectorAll('.cq-group__material').length).toBe(1)
    expect(root.querySelector('.cq-material')).not.toBeNull()
    expect(root.querySelectorAll('.cq-q').length).toBe(2)
    expect(root.querySelector('.cq-q__no')?.textContent).toBe('06')
  })

  it('旧 HTML 材料兜底', () => {
    const legacy: CqGroup = {
      id: 'legacy',
      material: '<p>旧材料</p>',
      questions: [
        {
          type: 'choice',
          options: [
            { key: 'A', text: '甲' },
            { key: 'B', text: '乙' }
          ],
          answer: 'A',
          stem: '题干'
        }
      ]
    }
    const root = renderQuestionGroup({ group: legacy })
    expect(root.querySelector('.cq-group__material--html')?.textContent).toContain('旧材料')
    expect(root.querySelector('.cq-material')).toBeNull()
  })

  it('自定义 renderQuestion 收到全卷序号与所属题组', () => {
    let received = -1
    const root = renderQuestionGroup({
      group: group(),
      startQuestionIndex: 2,
      renderQuestion: (question, index, owner) => {
        received = index
        expect(owner.id).toBe('old-city-group')
        return `<div class="custom-q" data-id="${question.id}"></div>`
      }
    })
    expect(received).toBe(3)
    expect(root.querySelectorAll('.custom-q').length).toBe(2)
  })

  it('空材料画布视为无材料，不渲染空白材料块', () => {
    const empty: CqGroup = {
      id: 'empty',
      layout: 'stacked',
      materialLayout: { version: 1, width: 1000, height: 360, objects: [] },
      questions: [
        {
          type: 'choice',
          stem: '题干',
          options: [
            { key: 'A', text: '甲' },
            { key: 'B', text: '乙' }
          ],
          answer: 'A'
        }
      ]
    }
    const root = renderQuestionGroup({ group: empty })
    expect(root.querySelector('.cq-material')).toBeNull()
    expect(root.classList.contains('cq-group--no-material')).toBe(true)
  })
})

describe('运行时 · 题组材料接入', () => {
  it('列表模式：按 split 布局渲染材料，选项仍可点击判题', () => {
    const view = createPracticeView({ groups: [group()] })
    document.body.appendChild(view.root)

    expect(view.root.querySelector('.cq-group--split')).not.toBeNull()
    expect(view.root.querySelectorAll('.cq-material').length).toBe(1)
    expect(view.root.querySelectorAll('.cq-q').length).toBe(2)

    view.root.querySelector<HTMLButtonElement>('[data-key="B"]')!.click()
    expect(view.root.querySelector('.cq-verdict.is-right')).not.toBeNull()
    view.destroy()
  })

  it('逐题模式：自由布局材料上提到题目上方，卡片不再重复材料', () => {
    const view = createPracticeView({ mode: 'step', groups: [group()] })
    document.body.appendChild(view.root)

    expect(view.root.classList.contains('pw--step-material')).toBe(true)
    expect(view.root.querySelector('.cq-step__material')).not.toBeNull()
    expect(view.root.querySelectorAll('.cq-material').length).toBe(1)
    expect(view.root.querySelector('.cq-q')).not.toBeNull()
    expect(view.root.querySelector('.cq-pane--material')).toBeNull()

    view.root.querySelector<HTMLButtonElement>('[data-key="B"]')!.click()
    expect(view.root.querySelector('.cq-verdict.is-right')).not.toBeNull()
    view.destroy()
  })

  it('空态不再依赖单课 .panel 类名', () => {
    const view = createPracticeView({ questions: [] })
    document.body.appendChild(view.root)
    const empty = view.root.querySelector('.cq-empty')
    expect(empty).not.toBeNull()
    expect(empty!.classList.contains('panel')).toBe(false)
    view.destroy()
  })

  it('逐题模式：空材料画布不占用空间', () => {
    const emptyGroup: CqGroup = {
      layout: 'stacked',
      materialLayout: { version: 1, width: 1000, height: 360, objects: [] },
      questions: [
        {
          type: 'choice',
          stem: '题干',
          options: [
            { key: 'A', text: '甲' },
            { key: 'B', text: '乙' }
          ],
          answer: 'A'
        }
      ]
    }
    const view = createPracticeView({ mode: 'step', groups: [emptyGroup] })
    document.body.appendChild(view.root)
    expect(view.root.classList.contains('pw--step-material')).toBe(false)
    expect(view.root.querySelector('.cq-step__material')).toBeNull()
    view.destroy()
  })
})
