/* ============================================================
   随堂练习浮层（每模块"✎ 练习"入口，模态弹窗 + 变暗背景）
   ============================================================ */
import { $, $$ } from '../utils/dom'
import { App } from '../state'
import { lessonData } from '../data/lessonData'
import type { PracticeItem } from '../types'
import { createDragDrop } from './dragDrop'

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

export function initPracticeModal(): void {
  const modalEl = document.getElementById('practice-modal');
  const titleElEl = document.getElementById('practice-title');
  const contentElEl = document.getElementById('practice-content');
  if (!modalEl || !titleElEl || !contentElEl || !lessonData.practices) return;
  const modal: HTMLElement = modalEl;
  const titleEl: HTMLElement = titleElEl;
  const contentEl: HTMLElement = contentElEl;

  function open(sectionId: string): void {
    const item = lessonData.practices[sectionId];
    titleEl.textContent = (item && item.title) ? item.title : '随堂练习';
    renderPractice(contentEl, item);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    App.practiceModal = { open: true, sectionId: sectionId };
  }

  function close(): void {
    modal.hidden = true;
    contentEl.innerHTML = ''; // 清空内容，避免下次打开残留旧的作答状态
    document.body.style.overflow = '';
    App.practiceModal = { open: false, sectionId: null };
  }

  $$('.practice-btn').forEach(btn => {
    btn.addEventListener('click', () => open((btn as HTMLElement).dataset.practice || ''));
  });
  $$('[data-practice-close]', modal).forEach(el => el.addEventListener('click', close));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
}
