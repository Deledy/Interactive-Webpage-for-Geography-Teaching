/* ============================================================
   M5 天体系统层级：SVG 嵌套圆环 + 聚焦
   ============================================================ */
import { $, $$ } from '../utils/dom'
import { App } from '../state'
import { lessonData } from '../data/lessonData'

export function initHierarchy(): void {
  const boxEl = document.getElementById('hierarchy-ring');
  const infoEl = document.getElementById('hierarchy-info');
  if (!boxEl || !infoEl || !lessonData.hierarchy) return;
  const box: HTMLElement = boxEl;
  const info: HTMLElement = infoEl;
  const levels = lessonData.hierarchy; // 由内到外：地月系 → 太阳系 → 银河系 → 可观测宇宙
  const N = levels.length;
  const cx = 300, cy = 300;
  const radii = [76, 152, 228, 296];

  box.classList.remove('panel--hint');
  let svg = '<svg class="hierarchy-svg" viewBox="0 0 600 600" role="img" aria-label="天体系统嵌套层级图">';
  for (let i = N - 1; i >= 0; i--) {
    svg += `
        <g class="hier-ring" data-level="${i}" tabindex="0" role="button" aria-label="${levels[i].name}">
          <circle class="hier-circle" cx="${cx}" cy="${cy}" r="${radii[i]}"/>
          <text class="hier-name" x="${cx}" y="${cy - radii[i] + 18}">${levels[i].name}</text>
        </g>`;
  }
  svg += '</svg>';

  box.innerHTML = `
      <div class="hierarchy-wrap">
        ${svg}
        <div class="hierarchy-controls">
          <button type="button" class="btn btn--ghost btn--sm" data-hier-prev>上一级</button>
          <button type="button" class="btn btn--primary btn--sm" data-hier-next>下一级</button>
        </div>
      </div>`;

  const svgEl = $('.hierarchy-svg', box);
  const rings = $$('.hier-ring', box);
  let level = 0; // 默认从地月系开始

  function render(): void {
    svgEl?.classList.toggle('has-focus', true);
    rings.forEach(g => g.classList.toggle('is-active', +((g as HTMLElement).dataset.level || 0) === level));
    const cur = levels[level];
    info.innerHTML = '<strong>' + cur.name + '</strong>：' + cur.content +
      '<span class="hint__example">' + cur.example + '</span>';
    App.level = level;
  }

  rings.forEach(g => g.addEventListener('click', () => {
    level = +((g as HTMLElement).dataset.level || 0);
    render();
  }));
  rings.forEach(g => (g as HTMLElement).addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      level = +((g as HTMLElement).dataset.level || 0);
      render();
    }
  }));

  $('[data-hier-prev]', box)?.addEventListener('click', () => {
    level = level <= 0 ? N - 1 : level - 1;
    render();
  });
  $('[data-hier-next]', box)?.addEventListener('click', () => {
    level = level >= N - 1 ? 0 : level + 1;
    render();
  });

  render();
}
