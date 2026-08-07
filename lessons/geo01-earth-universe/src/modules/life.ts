/* ============================================================
   M8 地球生命条件因果链：双分支 5 条链分步点亮
   ============================================================ */
import { $, $$ } from '../utils/dom'
import { App } from '../state'
import { lessonData } from '../data/lessonData'
import type { ChainItem } from '../types'

interface ChainRow extends ChainItem {
  branch: 'external' | 'internal'
}

export function initLifeChain(): void {
  const boxEl = document.getElementById('life-chain');
  const conclusionEl = document.getElementById('life-conclusion');
  const btnEl = document.querySelector('[data-widget="life-next"]');
  if (!boxEl || !conclusionEl || !btnEl || !lessonData.lifeConditions) return;
  const box: HTMLElement = boxEl;
  const conclusion: HTMLElement = conclusionEl;
  const btn: Element = btnEl;
  const lc = lessonData.lifeConditions;

  const external: ChainRow[] = lc.external.map(c => ({ branch: 'external', cond: c.cond, result: c.result }));
  const internal: ChainRow[] = lc.internal.map(c => ({ branch: 'internal', cond: c.cond, result: c.result }));
  const all = external.concat(internal);

  function chainHtml(chain: ChainItem, idx: number): string {
    return `
        <div class="chain" data-chain="${idx}">
          <div class="chain-node chain-node--cond">${chain.cond}</div>
          <div class="chain-arrow" aria-hidden="true"></div>
          <div class="chain-node chain-node--result">${chain.result}</div>
        </div>`;
  }

  box.classList.remove('panel--hint');
  box.innerHTML = `
      <div class="life-chain">
        <div class="life-chain__row">
          <h3 class="life-chain__row-title"><span class="tag">外部条件</span></h3>
          <div class="life-chain__chains">
            ${external.map((c, i) => chainHtml(c, i)).join('')}
          </div>
        </div>
        <div class="life-chain__row">
          <h3 class="life-chain__row-title"><span class="tag">自身条件</span></h3>
          <div class="life-chain__chains">
            ${internal.map((c, i) => chainHtml(c, external.length + i)).join('')}
          </div>
        </div>
      </div>`;

  const chains = $$('.chain', box);
  let step = 0; // 0=未开始, 1~5=逐步点亮, 6=完成

  function render(): void {
    chains.forEach((c, i) => c.classList.toggle('is-lit', i < step));
    if (step === 0) {
      conclusion.textContent = '点击"下一步"，逐条点亮 5 条因果链。';
    } else if (step <= all.length) {
      const cur = all[step - 1];
      conclusion.textContent = '已点亮 ' + step + '/' + all.length + ' · ' + cur.cond + ' → ' + cur.result;
    } else {
      conclusion.textContent = '总结论：' + lc.conclusion;
      conclusion.classList.add('hint--done');
    }
    if (step <= all.length) conclusion.classList.remove('hint--done');
    btn.textContent = step > all.length ? '重新开始' : '下一步';
    App.lifeStep = step;
  }

  btn.addEventListener('click', () => {
    step = step > all.length ? 0 : step + 1;
    render();
  });
  render();
}
