/* ============================================================
   拖拽分类互动（供 M3 随堂练习浮层使用）：
   拖拽 + 点击降级 + 即时反馈
   ============================================================ */
import { $, $$ } from '../utils/dom'
import { lessonData } from '../data/lessonData'

interface DragResults {
  [id: string]: { first: boolean }
}

export function createDragDrop(root: Element): void {
  const areaEl = $('[data-drag-area]', root);
  const zones = $$('.drop-zone', root);
  const feedbackEl = $('[data-drag-feedback]', root);
  if (!areaEl || !zones.length || !feedbackEl || !lessonData.dragCards) return;
  const area: Element = areaEl;
  const feedback: Element = feedbackEl;

  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const clickMode = isTouch || !('DragEvent' in window);
  const results: DragResults = {}; // 每次打开练习独立计分：{ id: { first: boolean } }，仅记录首次作答
  let selectedId: string | null = null;

  /* 渲染 9 张案例卡 */
  area.innerHTML = '';
  lessonData.dragCards.forEach(c => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'drag-card';
    el.dataset.card = c.id;
    el.textContent = c.name;
    el.setAttribute('draggable', clickMode ? 'false' : 'true');
    area.appendChild(el);
  });
  const cards = $$('.drag-card', area);

  function feedbackShow(text: string, type?: 'correct' | 'error' | 'success'): void {
    feedback.textContent = text;
    feedback.className = 'feedback' + (type ? ' feedback--' + type : '');
  }

  function judge(el: Element, target: string): void {
    const item = lessonData.dragCards.find(c => c.id === (el as HTMLElement).dataset.card);
    if (!item) return;
    if (el.closest('.drop-zone')) return; // 已正确放入框内，不再判定

    if (item.type === target) {
      if (!(item.id in results)) results[item.id] = { first: true };
      el.classList.add('is-correct');
      el.setAttribute('draggable', 'false');
      const zoneBody = $('[data-drop="' + target + '"]', root);
      if (zoneBody) zoneBody.appendChild(el);
      feedbackShow('正确：' + item.explain, 'correct');

      const done = Object.keys(results).length === lessonData.dragCards.length;
      if (done) {
        const good = Object.values(results).filter(r => r.first).length;
        feedbackShow('全部完成，正确 ' + good + '/9', 'success');
      }
    } else {
      if (!(item.id in results)) results[item.id] = { first: false };
      el.classList.remove('is-selected');
      el.classList.add('is-shake');
      setTimeout(() => el.classList.remove('is-shake'), 550);
      feedbackShow('再想想：' + item.explain, 'error');
    }
  }

  /* 拖拽模式 */
  if (!clickMode) {
    let draggingId: string | null = null;
    area.addEventListener('dragstart', e => {
      const de = e as DragEvent;
      const target = e.target as Element | null;
      const el = target?.closest('.drag-card');
      if (!el) return;
      draggingId = (el as HTMLElement).dataset.card || null;
      el.classList.add('is-dragging');
      de.dataTransfer!.effectAllowed = 'move';
      try { de.dataTransfer!.setData('text/plain', (el as HTMLElement).dataset.card || ''); } catch (_) { /* 忽略 */ }
    });
    area.addEventListener('dragend', e => {
      const target = e.target as Element | null;
      const el = target?.closest('.drag-card');
      if (el) el.classList.remove('is-dragging');
      draggingId = null;
    });
    zones.forEach(zone => {
      zone.addEventListener('dragover', e => {
        e.preventDefault();
        zone.classList.add('is-dragover');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'));
      zone.addEventListener('drop', e => {
        const de = e as DragEvent;
        e.preventDefault();
        zone.classList.remove('is-dragover');
        const id = de.dataTransfer!.getData('text/plain') || draggingId;
        if (!id) return;
        const el = area.querySelector('.drag-card[data-card="' + id + '"]');
        if (el) judge(el, (zone as HTMLElement).dataset.type || '');
      });
    });
  } else {
    /* 点击降级：先点卡片（选中），再点目标框 */
    cards.forEach(card => {
      card.addEventListener('click', () => {
        if (card.closest('.drop-zone')) return;
        cards.forEach(x => x.classList.remove('is-selected'));
        card.classList.add('is-selected');
        selectedId = (card as HTMLElement).dataset.card || null;
      });
    });
    zones.forEach(zone => {
      zone.addEventListener('click', () => {
        if (!selectedId) return;
        const el = area.querySelector('.drag-card[data-card="' + selectedId + '"]');
        if (el) {
          judge(el, (zone as HTMLElement).dataset.type || '');
          el.classList.remove('is-selected');
        }
        selectedId = null;
      });
    });
  }
}
