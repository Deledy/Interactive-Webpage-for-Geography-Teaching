/* ============================================================
   M9 复习卡：知识点挖空（点击空格揭示）+ 跳转返回
   数据来自 lessonData.review.cards，当前仅支持 cloze 题型。
   ============================================================ */
import { $$ } from '../utils/dom'
import { App } from '../state'
import { lessonData } from '../data/lessonData'

export function initReviewCards(): void {
  const box = document.getElementById('review-cards');
  const backBtn = document.getElementById('review-return');
  if (!box) return;

  const cards = lessonData.review.cards;
  if (!cards || cards.length === 0) return;

  let activeCard: HTMLElement | null = null;

  box.innerHTML = cards.map(card => {
    const body = card.parts.map(p => {
      if (p.kind === 'blank') {
        return `<button type="button" class="cloze-blank" aria-expanded="false" aria-label="点击显示答案" title="点击显示答案">${p.answer || ''}</button>`;
      }
      return `<span class="cloze-text">${p.text || ''}</span>`;
    }).join('');

    return `
      <article class="review-card" data-card-id="${card.id}">
        <header class="review-card__head">
          <h3 class="review-card__title">${card.title}</h3>
          <button type="button" class="review-card__jump" data-target="${card.target}">
            <span>查看讲解</span>
            <svg class="review-card__jump-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h7v7"/><path d="M13 3L4 12"/></svg>
          </button>
        </header>
        <p class="review-card__body">${body}</p>
      </article>`;
  }).join('');

  // 点击空格揭示 / 再次点击收回（便于反复自测）
  $$('.cloze-blank', box).forEach(blank => {
    blank.addEventListener('click', () => {
      const revealed = blank.classList.toggle('is-revealed');
      blank.setAttribute('aria-expanded', String(revealed));
    });
  });

  // 跳转：先退出复习模式（让目标模块讲解可见），再滚动到目标模块
  $$('.review-card__jump', box).forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.getAttribute('data-target') || '');
      if (!target) return;

      if (document.body.classList.contains('review-mode')) {
        document.body.classList.remove('review-mode');
        App.reviewMode = false;
        const modeBtn = document.querySelector('[data-widget="review-mode"]');
        if (modeBtn) modeBtn.textContent = '进入复习模式';
      }

      activeCard = btn.closest('.review-card') as HTMLElement | null;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (backBtn) backBtn.classList.add('is-visible');
    });
  });

  // 返回：回到当前复习卡（无记录则回复习区顶部）
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const el = activeCard || box;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      backBtn.classList.remove('is-visible');
    });
  }
}
