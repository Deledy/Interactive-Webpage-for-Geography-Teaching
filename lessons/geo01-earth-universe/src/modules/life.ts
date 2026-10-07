/* ============================================================
   M8 地球存在生命的原因：外部条件 / 自身条件 双面板静态渲染
   （两组因果链完整呈现，不做分步点亮）
   图标取自页面图标精灵（assets/icons/*.svg，<use> 复用），
   无 JS 时由 index.html 中的同结构静态标记兜底。
   ============================================================ */
import { lessonData } from '../data/lessonData'
import type { ChainItem } from '../types'

/** 每个面板的标题图标与各链条图标（按顺序对应数据项，取自图标精灵）；
 *  各子卡片的背景照片在 style.css 中按同一顺序以 `:nth-child()` 匹配，新增/调整链条时需同步 */
const PANEL_ICONS: Record<'external' | 'internal', { head: string; chains: string[] }> = {
  external: { head: 'ico-life-ext', chains: ['ico-sun', 'ico-star-orbit'] },
  internal: { head: 'ico-life-int', chains: ['ico-drop', 'ico-cloud', 'ico-humidity'] }
}

export function initLifeChain(): void {
  const boxEl = document.getElementById('life-chain');
  if (!boxEl || !lessonData.lifeConditions) return;
  const box: HTMLElement = boxEl;
  const lc = lessonData.lifeConditions;

  function icon(id: string): string {
    return `<svg class="life-ico" aria-hidden="true"><use href="#${id}"/></svg>`;
  }

  function chainHtml(chain: ChainItem, iconId: string): string {
    // 结果按中文逗号拆行，逐行呈现（与静态标记一致）
    const lines = chain.result.split('，').map((s) => s.trim()).filter(Boolean);
    return `
          <article class="chain">
            <span class="chain__icon">${icon(iconId)}</span>
            <p class="chain__cond">${chain.cond}</p>
            <span class="chain__arrow" aria-hidden="true"></span>
            <p class="chain__result">${lines.map((l) => `<span>${l}</span>`).join('')}</p>
          </article>`;
  }

  function panelHtml(key: 'external' | 'internal', title: string, chains: ChainItem[]): string {
    const cfg = PANEL_ICONS[key];
    return `
        <section class="life-panel life-panel--${key}">
          <header class="life-panel__head">
            <span class="life-panel__icon">${icon(cfg.head)}</span>
            <h3 class="life-panel__title">${title}</h3>
          </header>
          <div class="life-panel__chains">
            ${chains.map((c, i) => chainHtml(c, cfg.chains[i] ?? cfg.head)).join('')}
          </div>
        </section>`;
  }

  box.innerHTML =
    panelHtml('external', '外部条件', lc.external) +
    panelHtml('internal', '自身条件', lc.internal);
}
