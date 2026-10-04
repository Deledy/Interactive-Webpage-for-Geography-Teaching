/* ============================================================
   M7 行星的运动特征：同向性、近圆性、共面性
   顶部三个按钮与右侧「运动特征详解」卡内的三张子卡片双向联动：
   点击任一元素（按钮或卡片），两者同时进入选中态（概念色短线 + 边框提亮 + 「当前观察」状态文字），
   其余元素取消选中；选中态唯一。
   选中结果通过自定义事件（M7_FEATURE_EVENT）广播给公转演示模块（orbit.ts），
   由其播放对应的机位切换与轨道动画。
   ============================================================ */
import { $$ } from '../utils/dom'
import { lessonData } from '../data/lessonData'

/** 特征选中事件名：planets.ts 派发，orbit.ts 监听（detail.name 为特征名） */
export const M7_FEATURE_EVENT = 'm7:feature'

/* 特征图标：直接使用课内 assets/icons/ 下的图标文件（同向性 / 近圆性 / 共面性），
   由 CSS 按子卡片 data-feature 以遮罩方式上色（见 style.css），卡片内不再内联图标。 */

/* 示意图统一用色：轨道线 / 行星点用同一灰蓝，概念色只留少量重点（箭头、差异、文字标注） */
const FIG_LINE = '#6E86A6'          // 统一轨道线（灰蓝）
const FIG_ORBIT = '#9FB4FF'         // 轨道线（略亮，用于共面性平面内轨道）
const FIG_DOT = 'rgba(150, 176, 208, 0.92)' // 统一行星点
const FIG_CORE = '#D7E1F0'          // 天体本体（中性浅色，不抢概念色）
const FIG_TEXT = '#7F91AB'          // 灰蓝图注文字

/* 同向性示意图：统一颜色的小圆点表示行星 + 一条统一方向箭头，突出"方向一致"而非单颗行星 */
function sameDirectionFigure(): string {
  const planets = lessonData.planets
  const n = planets.length
  const W = 420, y = 30, padX = 30
  const step = (W - padX * 2) / (n - 1)
  const parts = planets.map((p, i) => {
    const x = padX + i * step
    return `<circle cx="${x.toFixed(1)}" cy="${y}" r="5.5" fill="${FIG_DOT}"/>` +
      `<text x="${x.toFixed(1)}" y="${y + 26}" text-anchor="middle" font-size="14" fill="${FIG_TEXT}">${p.name}</text>`
  }).join('')
  return `<svg viewBox="0 0 ${W} 92" role="img" aria-label="八大行星同向绕日公转">
      ${parts}
      <line x1="${padX}" y1="78" x2="${W - padX - 8}" y2="78" stroke="#42C9FF" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>
      <path d="M${W - padX - 8} 73 l8 5 -8 5" fill="none" stroke="#42C9FF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
    </svg>`
}

/* 近圆性示意图：左「近圆轨道」/ 右「椭圆轨道」并排，文字标注置于图形左右两侧；
   两轨道线同色，黄色虚线圆仅用于强调椭圆与正圆的差异。图形整体放大，便于课堂指认 */
const NEAR_CIRCLE_FIGURE = `<svg viewBox="0 0 420 84" role="img" aria-label="近圆轨道与椭圆轨道对比">
      <text x="68" y="48" text-anchor="end" font-size="15" fill="${FIG_TEXT}">近圆轨道</text>
      <circle cx="146" cy="42" r="40" fill="none" stroke="${FIG_LINE}" stroke-width="1.8"/>
      <circle cx="146" cy="42" r="6.5" fill="${FIG_CORE}"/>
      <ellipse cx="258" cy="42" rx="38" ry="29" fill="none" stroke="${FIG_LINE}" stroke-width="1.8"/>
      <circle cx="258" cy="42" r="38" fill="none" stroke="#F5C84C" stroke-width="1.3" stroke-dasharray="4 5" opacity="0.7"/>
      <circle cx="258" cy="42" r="6.5" fill="${FIG_CORE}"/>
      <text x="302" y="48" text-anchor="start" font-size="15" fill="${FIG_TEXT}">椭圆轨道</text>
    </svg>`

/* 共面性示意图：放大后的低透明度黄道面 + 少量同色轨道 + "同一平面"文字标注（位于平面外侧，不与轨道重叠） */
const COPLANAR_FIGURE = `<svg viewBox="0 0 420 84" role="img" aria-label="行星轨道面几乎位于同一平面">
      <path d="M12 76 L322 76 L408 30 L98 30 Z" fill="rgba(177,140,255,0.07)" stroke="rgba(177,140,255,0.32)" stroke-width="1.2"/>
      <ellipse cx="210" cy="53" rx="42" ry="9" fill="none" stroke="${FIG_ORBIT}" stroke-width="1.2" opacity="0.75"/>
      <ellipse cx="210" cy="53" rx="73" ry="15" fill="none" stroke="${FIG_ORBIT}" stroke-width="1.2" opacity="0.6"/>
      <ellipse cx="210" cy="53" rx="105" ry="23" fill="none" stroke="${FIG_ORBIT}" stroke-width="1.2" opacity="0.45"/>
      <circle cx="210" cy="53" r="8" fill="${FIG_CORE}"/>
      <text x="300" y="20" text-anchor="middle" font-size="15" fill="${FIG_TEXT}">同一平面</text>
    </svg>`

const FEATURE_FIGURE: Record<string, string> = {
  '同向性': sameDirectionFigure(),
  '近圆性': NEAR_CIRCLE_FIGURE,
  '共面性': COPLANAR_FIGURE
}

/* 简短图注：示意图下方的灰蓝小字 */
const FEATURE_CAPTION: Record<string, string> = {
  '同向性': '八颗行星公转方向一致 · 自西向东',
  '近圆性': '轨道偏心率小，接近正圆',
  '共面性': '轨道面几乎重合于同一平面'
}

/* 默认选中项（与设计稿一致） */
const DEFAULT_FEATURE = '近圆性'

export function initMotionFeatures(): void {
  const feats = document.getElementById('motion-features');
  if (!feats || !lessonData.motionFeatures) return;

  feats.innerHTML = lessonData.motionFeatures.map(f => `
      <div class="motion-feature card" data-feature="${f.name}" tabindex="0" role="button" aria-pressed="false">
        <div class="motion-feature__head">
          <span class="motion-feature__icon" aria-hidden="true"></span>
          <h4 class="motion-feature__name">${f.name}</h4>
          <span class="motion-feature__state">当前观察</span>
        </div>
        <span class="motion-feature__rule" aria-hidden="true"></span>
        <p class="motion-feature__desc">${f.desc}</p>
        <div class="motion-feature__figure" aria-hidden="true">${FEATURE_FIGURE[f.name] || ''}</div>
        <p class="motion-feature__caption">${FEATURE_CAPTION[f.name] || ''}</p>
      </div>`).join('');

  bindFeatureSelect(feats);
}

/* 按钮 ⇄ 子卡片双向联动：选中态唯一转移，并广播给公转演示。
   initial 为 true 时只设置初始高亮、不触发演示（避免进入页面即自动播放）。 */
function bindFeatureSelect(box: HTMLElement): void {
  const buttons = $$('.orbit-feature-btn') as HTMLButtonElement[];
  const cards = $$('.motion-feature', box) as HTMLElement[];
  if (!buttons.length || !cards.length) return;

  const select = (name: string | undefined, initial = false): void => {
    if (!name) return;
    buttons.forEach(btn => {
      const on = btn.dataset.feature === name;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    cards.forEach(card => {
      const on = card.dataset.feature === name;
      card.classList.toggle('is-active', on);
      card.setAttribute('aria-pressed', String(on));
    });
    if (!initial) {
      document.dispatchEvent(new CustomEvent(M7_FEATURE_EVENT, { detail: { name } }));
    }
  };

  /* 点击按钮或卡片任一元素，两者同步进入选中态（其余取消） */
  buttons.forEach(btn => btn.addEventListener('click', () => select(btn.dataset.feature)));
  cards.forEach(card => {
    card.addEventListener('click', () => select(card.dataset.feature));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select(card.dataset.feature);
      }
    });
  });

  select(DEFAULT_FEATURE, true);
}
