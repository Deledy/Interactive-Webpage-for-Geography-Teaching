/* ============================================================
   M8 地球生命条件因果链：外部条件 / 自身条件 分组静态渲染
   （不再分步点亮，两组因果链直接完整呈现）
   ============================================================ */
import { lessonData } from '../data/lessonData'
import type { ChainItem } from '../types'

export function initLifeChain(): void {
  const boxEl = document.getElementById('life-chain');
  if (!boxEl || !lessonData.lifeConditions) return;
  const box: HTMLElement = boxEl;
  const lc = lessonData.lifeConditions;

  function chainHtml(chain: ChainItem): string {
    return `
        <div class="chain">
          <div class="chain-node chain-node--cond">${chain.cond}</div>
          <div class="chain-arrow" aria-hidden="true"></div>
          <div class="chain-node chain-node--result">${chain.result}</div>
        </div>`;
  }

  box.innerHTML = `
      <section class="life-panel">
        <h3 class="life-panel__title"><span class="tag">外部条件</span></h3>
        <div class="life-panel__chains">
          ${lc.external.map(chainHtml).join('')}
        </div>
      </section>
      <section class="life-panel">
        <h3 class="life-panel__title"><span class="tag">自身条件</span></h3>
        <div class="life-panel__chains">
          ${lc.internal.map(chainHtml).join('')}
        </div>
      </section>`;
}
