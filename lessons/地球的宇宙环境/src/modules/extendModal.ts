/* ============================================================
   M10 拓展浮层 + M1 宇宙概念逐级放大演示动画
   （演示动画渲染于 M1 "⊕ 拓展"浮层内，功能与视觉效果与原版一致）
   ============================================================ */
import { $, $$ } from '../utils/dom'
import { App } from '../state'
import { lessonData } from '../data/lessonData'

type DemoBox = HTMLElement & { _universeTimer?: number }

/* ---------- M1 宇宙概念：逐级放大演示动画 ---------- */
function buildUniverseDemo(container: DemoBox): void {
  const levels = lessonData.universe?.scaleLevels;
  if (!container || !levels) return;

  container.innerHTML = `
      <div class="universe-demo">
        <div class="universe-demo__view">
          ${levels.map((l, i) => `
            <div class="ring" style="--size:${18 + i * 22}%">
              <span class="ring__name">${l.name}</span>
              <span class="ring__desc">${l.desc}</span>
            </div>`).join('')}
          <p class="universe-demo__status">点击"播放"，从地球出发，逐级飞向可观测宇宙</p>
        </div>
        <div class="universe-demo__steps">
          ${levels.map((l, i) => `<span class="universe-demo__step" data-step="${i}">${l.name}</span>`).join('')}
        </div>
        <div class="universe-demo__controls">
          <button type="button" class="btn btn--primary btn--sm" data-universe-play>播放</button>
          <button type="button" class="btn btn--ghost btn--sm" data-universe-replay>重播</button>
        </div>
      </div>`;

  const status = $('.universe-demo__status', container);
  const rings = $$('.ring', container);
  const steps = $$('.universe-demo__step', container);
  const prefersReducedMotion = !!(
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const interval = prefersReducedMotion ? 0 : 1200;
  let level = -1;
  let done = false;

  function render(): void {
    rings.forEach((r, i) => {
      r.classList.toggle('is-visible', i <= level);
      r.classList.toggle('is-active', i === level);
    });
    steps.forEach((s, i) => s.classList.toggle('is-active', i === level));
    status?.classList.toggle('is-done', done);
    if (!status) return;
    if (level < 0) {
      status.textContent = '点击"播放"，从地球出发，逐级飞向可观测宇宙';
    } else if (!done) {
      status.textContent = '正在飞向：' + levels[level].name + ' …';
    } else {
      status.textContent = '已到达可观测宇宙边界 —— 空间无边无际、时间无始无终';
    }
  }

  function step(): void {
    level++;
    render();
    if (level < levels.length - 1) {
      container._universeTimer = window.setTimeout(step, interval);
    } else {
      container._universeTimer = window.setTimeout(() => { done = true; render(); }, interval + 400);
    }
  }

  function play(): void {
    clearTimeout(container._universeTimer);
    level = -1;
    done = false;
    render();
    container._universeTimer = window.setTimeout(step, 600);
  }

  $('[data-universe-play]', container)?.addEventListener('click', play);
  $('[data-universe-replay]', container)?.addEventListener('click', play);
}

/* ---------- M10 拓展浮层 ---------- */
export function initExtendModal(): void {
  const modalEl = document.getElementById('extend-modal');
  const titleElEl = document.getElementById('extend-title');
  const contentElEl = document.getElementById('extend-content');
  if (!modalEl || !titleElEl || !contentElEl || !lessonData.extends) return;
  const modal: HTMLElement = modalEl;
  const titleEl: HTMLElement = titleElEl;
  const contentEl: HTMLElement = contentElEl;

  function render(sectionId: string): void {
    const item = lessonData.extends[sectionId];
    contentEl.innerHTML = '';
    if (item && item.content) {
      const items = Array.isArray(item.content) ? item.content : [item.content];
      const list = document.createElement('ul');
      items.forEach(text => {
        const li = document.createElement('li');
        li.textContent = text;
        list.appendChild(li);
      });
      contentEl.appendChild(list);
    } else {
      const p = document.createElement('p');
      p.className = 'panel__placeholder';
      p.textContent = '敬请期待';
      contentEl.appendChild(p);
    }
    /* M1 拓展：追加"从地球出发，逐级飞向可观测宇宙"演示动画 */
    if (sectionId === 'M1') {
      const demoBox = document.createElement('div') as DemoBox;
      demoBox.id = 'extend-universe-demo';
      demoBox.className = 'panel extend-demo';
      contentEl.appendChild(demoBox);
      buildUniverseDemo(demoBox);
    }
    titleEl.textContent = item && item.title ? item.title : '拓展材料';
  }

  function open(sectionId: string): void {
    render(sectionId);
    modal.hidden = false;
    App.modal = { open: true, sectionId: sectionId };
    document.body.style.overflow = 'hidden';
  }

  function close(): void {
    /* 关闭时停止仍在进行的逐级放大动画计时器 */
    const demo = document.getElementById('extend-universe-demo') as DemoBox | null;
    if (demo) clearTimeout(demo._universeTimer);
    modal.hidden = true;
    App.modal = { open: false, sectionId: null };
    document.body.style.overflow = '';
  }

  $$('.extend-btn').forEach(btn => {
    btn.addEventListener('click', () => open((btn as HTMLElement).dataset.section || ''));
  });
  $$('[data-modal-close]', modal).forEach(el => el.addEventListener('click', close));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
}
