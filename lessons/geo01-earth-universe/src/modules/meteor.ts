/* ============================================================
   M3 流星案例：SVG 分步示意图 + 三条件逐条点亮
   ============================================================ */
import { $, $$ } from '../utils/dom'
import { App } from '../state'
import { lessonData } from '../data/lessonData'

export function initMeteorCase(): void {
  const stageEl = document.getElementById('meteor-stage');
  const condsBoxEl = document.getElementById('meteor-conditions');
  const conclusionEl = document.getElementById('meteor-conclusion');
  const btnEl = document.querySelector('[data-widget="meteor-next"]');
  if (!stageEl || !condsBoxEl || !conclusionEl || !btnEl || !lessonData.meteorCase) return;
  const stage: HTMLElement = stageEl;
  const condsBox: HTMLElement = condsBoxEl;
  const conclusion: HTMLElement = conclusionEl;
  const btn: Element = btnEl;
  const mc = lessonData.meteorCase;

  stage.classList.remove('panel--hint');
  stage.innerHTML = `
      <svg class="meteor-svg" viewBox="0 0 460 300" role="img" aria-label="流星案例分步示意图">
        <!-- 太空 -->
        <rect x="0" y="0" width="460" height="128" fill="#060a1c"/>
        <circle class="meteor-star" cx="26" cy="34" r="1.4"/>
        <circle class="meteor-star" cx="62" cy="18" r="1"/>
        <circle class="meteor-star" cx="120" cy="46" r="1.2"/>
        <circle class="meteor-star" cx="330" cy="90" r="1.1"/>
        <circle class="meteor-star" cx="430" cy="52" r="1.3"/>
        <!-- 大气层 -->
        <rect x="0" y="128" width="460" height="86" fill="rgba(79,195,247,0.10)"/>
        <line class="meteor-boundary" x1="0" y1="128" x2="460" y2="128"/>
        <line class="meteor-boundary" x1="0" y1="214" x2="460" y2="214"/>
        <text x="444" y="24" text-anchor="end" class="meteor-layer-label">太空</text>
        <text x="444" y="172" text-anchor="end" class="meteor-layer-label">大气层</text>
        <!-- 地面 -->
        <rect x="0" y="214" width="460" height="86" fill="#0d1230"/>
        <line class="meteor-ground" x1="0" y1="214" x2="460" y2="214"/>
        <text x="26" y="252" class="meteor-layer-label">地面</text>
        <!-- 流星路径 -->
        <line class="meteor-path" x1="382" y1="22" x2="118" y2="232"/>
        <!-- 节点：太空中 / 大气层燃烧 / 落到地面 -->
        <g class="meteor-node" data-node="0">
          <circle cx="382" cy="22" r="8"/>
          <text x="382" y="8" text-anchor="middle" class="meteor-node-label">流星体（太空中）</text>
        </g>
        <g class="meteor-node" data-node="1">
          <circle cx="250" cy="152" r="10"/>
          <text x="250" y="180" text-anchor="middle" class="meteor-node-label">摩擦燃烧 → 流星现象</text>
        </g>
        <g class="meteor-node" data-node="2">
          <circle cx="118" cy="232" r="7"/>
          <text x="118" y="260" text-anchor="middle" class="meteor-node-label">陨石（落至地面）</text>
        </g>
      </svg>`;

  condsBox.innerHTML = `
      <h3 class="conditions-title">判别三条件</h3>
      <ul class="condition-list">
        ${mc.conditions.map((c, i) => `
          <li class="condition-item" data-cond="${i}">
            <span class="condition-item__key">${c.key}</span>
            <span class="condition-item__desc">${c.desc}</span>
          </li>`).join('')}
      </ul>`;

  const nodes = $$('.meteor-node', stage);
  const conds = $$('.condition-item', condsBox);
  let step = 0; // 0=初始未开始, 1~3=三步, 4=完成

  function render(): void {
    nodes.forEach((n, i) => {
      n.classList.toggle('is-current', step > 0 && i === step - 1);
      n.classList.toggle('is-lit', step > 1 && i < step - 1);
    });
    conds.forEach((c, i) => c.classList.toggle('is-lit', i < step));

    if (step === 0) {
      conclusion.textContent = '';
    } else if (step <= 3) {
      conclusion.textContent = '第 ' + step + ' 步 · ' + mc.steps[step - 1].title + '：' + mc.steps[step - 1].desc;
    } else {
      conclusion.textContent = '结论：' + mc.conclusion;
      conclusion.classList.add('hint--done');
    }
    if (step <= 3) conclusion.classList.remove('hint--done');
    btn.textContent = step >= 4 ? '重新开始' : '下一步';
    App.meteorStep = step;
  }

  btn.addEventListener('click', () => {
    step = step >= 4 ? 0 : step + 1;
    render();
  });
  render();
}
