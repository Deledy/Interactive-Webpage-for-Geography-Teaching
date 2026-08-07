/* ============================================================
   M9 复习与总结：结构树折叠 + 复习模式切换
   ============================================================ */
import { $$ } from '../utils/dom'
import { App } from '../state'
import { lessonData } from '../data/lessonData'
import type { ReviewNode } from '../types'

export function initReviewTree(): void {
  const box = document.getElementById('review-tree');
  const modeBtn = document.querySelector('[data-widget="review-mode"]');
  if (!box || !modeBtn || !lessonData.review) return;

  box.classList.remove('panel--hint');
  box.innerHTML = renderTree(lessonData.review.nodes);

  function renderTree(nodes: ReviewNode[]): string {
    return '<ul class="tree">' + nodes.map(n => {
      const hasKids = !!(n.children && n.children.length);
      const kids = hasKids ? renderTree(n.children || []) : '';
      return `
          <li class="tree__item${hasKids ? ' has-children is-open' : ''}" data-node="${n.id}">
            ${hasKids ? '<button type="button" class="tree__toggle" aria-expanded="true" aria-label="折叠"></button>' : ''}
            <span class="tree__label">${n.name}</span>
            ${kids ? '<ul class="tree__children">' + kids + '</ul>' : ''}
          </li>`;
    }).join('') + '</ul>';
  }

  $$('.tree__toggle', box).forEach(t => {
    t.addEventListener('click', () => {
      const li = t.closest('.tree__item');
      if (!li) return;
      li.classList.toggle('is-open');
      t.setAttribute('aria-expanded', String(li.classList.contains('is-open')));
    });
  });

  modeBtn.addEventListener('click', () => {
    document.body.classList.toggle('review-mode');
    App.reviewMode = document.body.classList.contains('review-mode');
    modeBtn.textContent = App.reviewMode ? '退出复习模式' : '进入复习模式';
  });
}
