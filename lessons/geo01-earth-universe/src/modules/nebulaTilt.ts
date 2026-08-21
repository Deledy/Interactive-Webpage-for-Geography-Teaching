/* ============================================================
   M2 天体卡片 · 3D 倾斜效果
   覆盖星云卡片（.nebula-tilt__card）与非星云双图画廊卡片
   （.body-deck__gallery-card）。
   每张卡片各自响应 pointermove，互不干扰（指向哪张，哪张单独倾斜）；
   内部图层用 translateZ 分层（holo/glare/border）。
   动画参数与 shared/3d-perspective-hover-tilt-stack.html 对齐：
   倾角 MAX_DEG = 14，CSS 变量过渡 0.4s 弹性缓出（见 style.css）。
   配色由每张卡片继承的 --c 变量自动适配各天体色板。
   ============================================================ */
import { prefersReducedMotion } from '../utils/dom'

const MAX_DEG = 14;

function initCard(card: HTMLElement): void {
  let raf = 0;

  const setVars = (rx: number, ry: number, mx: number, my: number): void => {
    card.style.setProperty('--neb-tilt-x', rx.toFixed(2) + 'deg');
    card.style.setProperty('--neb-tilt-y', ry.toFixed(2) + 'deg');
    // 全息扫光 / 眩光跟随指针位置（本卡独立）
    card.style.setProperty('--neb-mx', mx.toFixed(1) + '%');
    card.style.setProperty('--neb-my', my.toFixed(1) + '%');
  };

  card.addEventListener('pointermove', (e) => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width;
      const my = (e.clientY - r.top) / r.height;
      setVars((0.5 - my) * 2 * MAX_DEG, (mx - 0.5) * 2 * MAX_DEG, mx * 100, my * 100);
    });
  });

  card.addEventListener('pointerleave', () => {
    if (raf) cancelAnimationFrame(raf);
    setVars(0, 0, 50, 50);
  });
}

export function initNebulaTilt(): void {
  if (prefersReducedMotion) return;

  // 3D 倾斜场景：M1 宇宙摄影图（#universe-tilt）、M2 星云（#nebula-tilt）的卡片，
  // 以及 M2 非星云双图画廊卡片（.body-deck__gallery-card）；每卡独立倾斜。
  document
    .querySelectorAll<HTMLElement>('.nebula-tilt__card, .body-deck__gallery-card')
    .forEach(initCard);
}
