/* ============================================================
   随堂练习浮层（每模块"✎ 练习"入口，模态弹窗 + 变暗背景）
   ------------------------------------------------------------
   数据源（详见 shared/custom-quiz-editor/docs 开发文档 §19）：
   - 优先读取统一数据文件 practice-data.js 的对应模块（可编辑真源）；
   - 该模块缺失时回退 lessonData.practices 的内置题目（兼容回退）。
   渲染：新 schema 复用课后练习的 cq-* 样式与共享 markdown.ts；
   旧 schema 保留原有渲染与交互，拖拽题（M3）仍由源码 dragCards 提供。
   ============================================================ */
import { $, $$ } from '../utils/dom'
import { App } from '../state'
import { lessonData } from '../data/lessonData'
import type { CqChoice, CqEssay, CqQuestion, PracticeItem, PracticeModule } from '../types'
import { escapeHtml, inlineMarkdown, renderMarkdown } from '../utils/markdown'
import { getModulePractice } from './practiceStore'
import { createDragDrop } from './dragDrop'

/* ---------------- 旧 schema 渲染（兼容回退） ---------------- */

function renderPractice(content: HTMLElement, item: PracticeItem | undefined): void {
  content.innerHTML = '';
  if (!item) {
    const p = document.createElement('p');
    p.className = 'panel__placeholder';
    p.textContent = '敬请期待';
    content.appendChild(p);
    return;
  }

  if (item.intro) {
    const intro = document.createElement('p');
    intro.className = 'practice-intro';
    intro.textContent = item.intro;
    content.appendChild(intro);
  }

  /* 拖拽分类型（原模块 M4 内容，现置于 M3 练习中） */
  if (item.type === 'drag') {
    content.insertAdjacentHTML('beforeend', `
        <div class="drag-area" data-drag-area></div>
        <div class="drag-zones">
          <div class="drop-zone" data-type="celestial">
            <h3 class="drop-zone__title">天体</h3>
            <div class="drop-zone__body" data-drop="celestial"></div>
          </div>
          <div class="drop-zone" data-type="non">
            <h3 class="drop-zone__title">非天体</h3>
            <div class="drop-zone__body" data-drop="non"></div>
          </div>
        </div>
        <p class="feedback" data-drag-feedback></p>`);
    createDragDrop(content);
    return;
  }

  /* 选择题型：点选即判，高亮正确项并给出解释 */
  if (!item.questions || !item.questions.length) {
    const p = document.createElement('p');
    p.className = 'panel__placeholder';
    p.textContent = '敬请期待';
    content.appendChild(p);
    return;
  }

  item.questions.forEach((q, qi) => {
    const box = document.createElement('div');
    box.className = 'practice-q';

    const text = document.createElement('p');
    text.className = 'practice-q__text';
    text.textContent = (qi + 1) + '. ' + q.q;
    box.appendChild(text);

    const opts = document.createElement('div');
    opts.className = 'practice-q__options';
    (q.options || []).forEach((opt, oi) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'practice-q__opt';
      b.textContent = opt;
      b.addEventListener('click', () => {
        if (b.disabled) return;
        const btns = $$('.practice-q__opt', opts);
        btns.forEach(x => { (x as HTMLButtonElement).disabled = true; });
        btns[q.answer].classList.add('is-correct');
        const fb = $('.practice-q__feedback', box);
        if (oi === q.answer) {
          fb!.textContent = '✓ 正确：' + q.explain;
          fb!.className = 'practice-q__feedback is-correct';
        } else {
          b.classList.add('is-wrong');
          fb!.textContent = '再想想：' + q.explain;
          fb!.className = 'practice-q__feedback is-wrong';
        }
      });
      opts.appendChild(b);
    });
    box.appendChild(opts);

    const fb = document.createElement('p');
    fb.className = 'practice-q__feedback';
    box.appendChild(fb);
    content.appendChild(box);
  });
}

/* ---------------- 新 schema 渲染（cq-* 样式，与课后练习一致） ---------------- */

interface PmState {
  selected: string[]
  submitted: boolean
  revealed: boolean
}

const CHOICE_BADGE: Record<'single' | 'multiple', string> = {
  single: '单选题',
  multiple: '多选题'
}

let pmModule: PracticeModule | null = null
let pmContent: HTMLElement | null = null
let pmStates = new Map<string, PmState>()
let pmSeq = 0

function pmState(key: string): PmState {
  let state = pmStates.get(key)
  if (!state) {
    state = { selected: [], submitted: false, revealed: false }
    pmStates.set(key, state)
  }
  return state
}

function answerKeys(question: CqChoice): string[] {
  return Array.isArray(question.answer) ? question.answer : [question.answer]
}

function isChoiceCorrect(question: CqChoice, selected: string[]): boolean {
  const expected = answerKeys(question).slice().sort()
  const actual = selected.slice().sort()
  return expected.length === actual.length && expected.every((key, index) => key === actual[index])
}

function optionClass(question: CqChoice, state: PmState, key: string): string {
  const cls = ['cq-opt']
  if (!state.submitted) {
    if (state.selected.includes(key)) cls.push('is-selected')
    return cls.join(' ')
  }
  const correct = answerKeys(question)
  if (correct.includes(key)) cls.push('is-correct')
  else if (state.selected.includes(key)) cls.push('is-wrong')
  else cls.push('is-dim')
  return cls.join(' ')
}

function choiceHtml(question: CqChoice, key: string): string {
  const mode = question.mode === 'multiple' ? 'multiple' : 'single'
  const state = pmState(key)
  const revealed = state.submitted
  const options = question.options
    .map(
      (opt) =>
        `<button type="button" class="${optionClass(question, state, opt.key)}" data-pm-opt="${key}" data-key="${opt.key}"${
          revealed ? ' disabled' : ''
        }${state.selected.includes(opt.key) ? ' aria-pressed="true"' : ' aria-pressed="false"'}>
          <span class="cq-opt__key">${escapeHtml(opt.key)}</span>
          <span class="cq-opt__text">${inlineMarkdown(opt.text)}</span>
        </button>`
    )
    .join('')

  const verdict = !revealed
    ? ''
    : `<div class="cq-verdict ${isChoiceCorrect(question, state.selected) ? 'is-right' : 'is-wrong'}">
        <span class="cq-verdict__title">${
          isChoiceCorrect(question, state.selected) ? '回答正确' : '回答错误'
        }</span>
        <span class="cq-verdict__key">正确答案：<b>${answerKeys(question).join('')}</b></span>
      </div>`

  const detail = !revealed
    ? ''
    : `<div class="cq-detail">
        ${
          question.analysis
            ? `<section class="cq-block cq-block--analysis">
                <h4 class="cq-block__title">解析</h4>
                <div class="cq-block__body">${renderMarkdown(question.analysis)}</div>
              </section>`
            : ''
        }
        ${
          question.knowledge && (question.knowledge.title || question.knowledge.items?.length)
            ? `<section class="cq-block cq-block--knowledge">
                <h4 class="cq-block__title">知识归纳</h4>
                ${question.knowledge.title ? `<p class="cq-knowledge__title">${inlineMarkdown(question.knowledge.title)}</p>` : ''}
                <ul class="cq-knowledge__list">${(question.knowledge.items ?? [])
                  .map((item) => `<li>${inlineMarkdown(item)}</li>`)
                  .join('')}</ul>
              </section>`
            : ''
        }
      </div>`

  const submit =
    mode === 'multiple' && !revealed
      ? `<div class="cq-q__actions">
          <button type="button" class="btn btn--primary cq-submit" data-pm-submit="${key}"${
            state.selected.length ? '' : ' disabled'
          }>提交答案</button>
        </div>`
      : ''

  return `<article class="cq-q" data-q="${key}" data-type="choice">
    <div class="cq-q__head">
      <span class="cq-q__no">${pmSeq++}</span>
      <span class="cq-q__badge">${CHOICE_BADGE[mode]}</span>
      ${question.source ? `<span class="cq-q__source">${escapeHtml(question.source)}</span>` : ''}
    </div>
    ${question.material ? `<div class="cq-q__material">${renderMarkdown(question.material)}</div>` : ''}
    <p class="cq-q__stem">${inlineMarkdown(question.stem)}</p>
    <div class="cq-q__options">${options}</div>
    ${submit}
    ${verdict}
    ${detail}
  </article>`
}

function essayHtml(question: CqEssay, key: string): string {
  const state = pmState(key)
  const stems = Array.isArray(question.stems) ? question.stems : question.stems ? [question.stems] : []

  const detail = !state.revealed
    ? ''
    : `<div class="cq-detail">
        ${
          question.referenceAnswer
            ? `<section class="cq-block cq-block--answer">
                <h4 class="cq-block__title">参考答案</h4>
                <div class="cq-block__body">${renderMarkdown(question.referenceAnswer)}</div>
              </section>`
            : ''
        }
        ${
          question.analysis
            ? `<section class="cq-block cq-block--analysis">
                <h4 class="cq-block__title">解析</h4>
                <div class="cq-block__body">${renderMarkdown(question.analysis)}</div>
              </section>`
            : ''
        }
        ${
          question.criteria?.length
            ? `<section class="cq-block cq-block--criteria">
                <h4 class="cq-block__title">评分标准</h4>
                <ol class="cq-list cq-list--ordered">${question.criteria
                  .map((item) => `<li>${inlineMarkdown(item)}</li>`)
                  .join('')}</ol>
              </section>`
            : ''
        }
      </div>`

  return `<article class="cq-q" data-q="${key}" data-type="essay">
    <div class="cq-q__head">
      <span class="cq-q__no">${pmSeq++}</span>
      <span class="cq-q__badge cq-q__badge--essay">综合题</span>
      ${question.source ? `<span class="cq-q__source">${escapeHtml(question.source)}</span>` : ''}
    </div>
    ${question.material ? `<div class="cq-q__material">${renderMarkdown(question.material)}</div>` : ''}
    ${
      stems.length
        ? `<ol class="cq-stems">${stems.map((stem) => `<li>${inlineMarkdown(stem)}</li>`).join('')}</ol>`
        : ''
    }
    <div class="cq-q__actions">
      <button type="button" class="btn ${state.revealed ? 'btn--ghost' : 'btn--primary'} cq-reveal" data-pm-reveal="${key}">
        ${state.revealed ? '收起参考答案' : '查看参考答案'}
      </button>
    </div>
    ${detail}
  </article>`
}

function questionHtml(question: CqQuestion, key: string): string {
  if (question.type === 'essay') return essayHtml(question, key)
  return choiceHtml(question, key)
}

/** 渲染统一 schema 的单个模块（同步） */
function renderModule(content: HTMLElement, mod: PracticeModule): void {
  pmSeq = 1
  const questions = mod.questions ?? []
  const intro = mod.intro ? `<p class="cq-intro">${inlineMarkdown(mod.intro)}</p>` : ''
  content.innerHTML =
    intro +
    `<div class="cq-sec__qs">${questions
      .map((question, index) => questionHtml(question, `pm-${index}`))
      .join('')}</div>`
}

function findQuestion(key: string): CqQuestion | null {
  const index = Number(key.replace(/^pm-/, ''))
  if (!Number.isInteger(index)) return null
  return pmModule?.questions?.[index] ?? null
}

function rerenderModule(): void {
  if (pmContent && pmModule) renderModule(pmContent, pmModule)
}

/* ---------------- 交互 ---------------- */

function onContentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement

  const opt = target.closest<HTMLButtonElement>('[data-pm-opt]')
  if (opt) {
    const key = opt.dataset.pmOpt ?? ''
    const question = findQuestion(key)
    if (!question || question.type !== 'choice') return
    const state = pmState(key)
    if (state.submitted) return
    const choiceKey = opt.dataset.key ?? ''
    if (question.mode === 'multiple') {
      const index = state.selected.indexOf(choiceKey)
      if (index >= 0) state.selected.splice(index, 1)
      else state.selected.push(choiceKey)
    } else {
      state.selected = [choiceKey]
      state.submitted = true
    }
    rerenderModule()
    return
  }

  const submit = target.closest<HTMLButtonElement>('[data-pm-submit]')
  if (submit) {
    const state = pmState(submit.dataset.pmSubmit ?? '')
    if (state.selected.length) state.submitted = true
    rerenderModule()
    return
  }

  const reveal = target.closest<HTMLButtonElement>('[data-pm-reveal]')
  if (reveal) {
    const state = pmState(reveal.dataset.pmReveal ?? '')
    state.revealed = !state.revealed
    rerenderModule()
  }
}

export function initPracticeModal(): void {
  const modalEl = document.getElementById('practice-modal');
  const titleElEl = document.getElementById('practice-title');
  const contentElEl = document.getElementById('practice-content');
  if (!modalEl || !titleElEl || !contentElEl) return;
  const modal: HTMLElement = modalEl;
  const titleEl: HTMLElement = titleElEl;
  const contentEl: HTMLElement = contentElEl;

  pmContent = contentEl
  contentEl.addEventListener('click', onContentClick)

  /* 打开：同步渲染（新 schema 优先，缺失则回退内置题目；拖拽题走旧渲染） */
  function open(btn: HTMLElement): void {
    const practiceKey = btn.dataset.practice || ''
    const sectionId = btn.closest('section')?.id || ''
    const mod = getModulePractice(sectionId) ?? getModulePractice(practiceKey)
    const legacy = lessonData.practices?.[sectionId] ?? lessonData.practices?.[practiceKey]

    pmModule = null
    pmStates = new Map()

    if (mod && mod.kind !== 'drag' && mod.questions?.length) {
      pmModule = mod
      titleEl.textContent = mod.title || '随堂练习'
      renderModule(contentEl, mod)
    } else {
      // 拖拽模块（内容由源码 dragCards 提供）或数据缺失 → 沿用旧渲染
      titleEl.textContent = (mod?.title || legacy?.title) || '随堂练习'
      renderPractice(contentEl, legacy)
    }

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    App.practiceModal = { open: true, sectionId: sectionId };
  }

  function close(): void {
    modal.hidden = true;
    contentEl.innerHTML = ''; // 清空内容，避免下次打开残留旧的作答状态
    pmModule = null
    pmStates = new Map()
    document.body.style.overflow = '';
    App.practiceModal = { open: false, sectionId: null };
  }

  $$('.practice-btn').forEach(btn => {
    btn.addEventListener('click', () => open(btn as HTMLElement));
  });
  $$('[data-practice-close]', modal).forEach(el => el.addEventListener('click', close));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
}
