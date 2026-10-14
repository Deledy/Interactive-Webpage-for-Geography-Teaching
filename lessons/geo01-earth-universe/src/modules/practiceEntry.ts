/* ============================================================
   随堂练习入口（每模块「✎ 练习」按钮 → 通用练习窗口）
   ------------------------------------------------------------
   - 数据：优先读统一数据文件 practice-data.js 的对应模块（可编辑真源），
     缺失则回退 lessonData.practices 的内置题目；
   - 渲染：统一交给 shared/practice-window 的 PracticeWindow 组件（与课后练习同一套）；
   - 特殊题型（如拖拽 kind:'drag'）不属于通用编辑器/组件职责，此处仅按「无通用题目」渲染空态，
     其实现由课程页面自行硬编码（本轮不实现）。
   详见 shared/practice-window/docs/通用练习窗口_开发文档.md。
   ============================================================ */
import { $$ } from '../utils/dom'
import { App } from '../state'
import { lessonData } from '../data/lessonData'
import type { PracticeQuestion } from '../types'
import { getModulePractice } from './practiceStore'
import { createPracticeView, type PracticeView } from '../../../../shared/practice-window/src/practiceWindow'

let view: PracticeView | null = null

/** 把旧 schema（PracticeQuestion）转成统一题型，作为源码兜底 */
function legacyQuestions(item: unknown) {
  const questions = (item as { questions?: PracticeQuestion[] } | undefined)?.questions
  return (questions ?? []).map((q) => ({
    type: 'choice' as const,
    mode: 'single' as const,
    stem: q.q,
    options: (q.options ?? []).map((text, i) => ({ key: String.fromCharCode(65 + i), text: String(text) })),
    answer: String.fromCharCode(65 + (Number(q.answer) || 0)),
    analysis: q.explain
  }))
}

export function initPracticeEntry(): void {
  const modal = document.getElementById('practice-modal') as HTMLElement | null
  const titleEl = document.getElementById('practice-title') as HTMLElement | null
  const contentEl = document.getElementById('practice-content') as HTMLElement | null
  if (!modal || !titleEl || !contentEl) return

  function mount(title: string, subtitle: string | undefined, questions: unknown[]): void {
    if (view) {
      view.destroy()
      view = null
    }
    contentEl!.innerHTML = ''
    view = createPracticeView({
      title,
      subtitle,
      // 结构化兼容：课程统一题型与组件题型同构
      questions: questions as never
    })
    contentEl!.appendChild(view.root)
  }

  function open(btn: HTMLElement): void {
    const practiceKey = btn.dataset.practice || ''
    const sectionId = btn.closest('section')?.id || ''
    const mod = getModulePractice(sectionId) ?? getModulePractice(practiceKey)
    const legacy = lessonData.practices?.[sectionId] ?? lessonData.practices?.[practiceKey]

    const title = mod?.title || legacy?.title || '随堂练习'
    titleEl!.textContent = title

    // 通用题型：优先统一数据文件；否则回退源码内置旧题；再没有则空态
    const questions = mod?.questions && mod.questions.length ? mod.questions : legacyQuestions(legacy)
    mount(title, mod?.intro, questions)

    modal!.hidden = false
    document.body.style.overflow = 'hidden'
    App.practiceModal = { open: true, sectionId: sectionId || null }
  }

  function close(): void {
    modal!.hidden = true
    if (view) {
      view.destroy()
      view = null
    }
    contentEl!.innerHTML = ''
    document.body.style.overflow = ''
    App.practiceModal = { open: false, sectionId: null }
  }

  $$('.practice-btn').forEach((btn) => {
    btn.addEventListener('click', () => open(btn as HTMLElement))
  })
  $$('[data-practice-close]', modal).forEach((el) => el.addEventListener('click', close))
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close()
  })
}
