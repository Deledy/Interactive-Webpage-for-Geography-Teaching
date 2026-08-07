/* ============================================================
   M2 天体卡片 · 3D 倾斜效果
   覆盖星云卡片（.nebula-tilt__card）与非星云双图画廊卡片
   （.body-deck__gallery-card）。
   每张卡片各自响应 pointermove，互不干扰；
   内部图层用 translateZ 分层（holo/glare/border）。
   配色由每张卡片继承的 --c 变量自动适配各天体色板。
   ============================================================ */
import { prefersReducedMotion } from '../utils/dom'

const MAX_DEG = 12;

function initCard(card: HTMLElement, isDeep = false): void {
  let targetX = 0;
  let targetY = 0;
  let curX = 0;
  let curY = 0;
  let raf = 0;

  const zPrefix = isDeep ? 'translateZ(-16px) ' : 'translateZ(0) ';

  const loop = (): void => {
    curX += (targetX - curX) * 0.16;
    curY += (targetY - curY) * 0.16;
    if (Math.abs(targetX - curX) < 0.05) curX = targetX;
    if (Math.abs(targetY - curY) < 0.05) curY = targetY;
    card.style.transform = `${zPrefix}rotateX(${curX.toFixed(2)}deg) rotateY(${curY.toFixed(2)}deg)`;
    if (Math.abs(targetX - curX) > 0.01 || Math.abs(targetY - curY) > 0.01) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = 0;
    }
  };

  const start = (): void => {
    if (!raf) raf = requestAnimationFrame(loop);
  };

  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width;
    const my = (e.clientY - r.top) / r.height;
    targetY = (mx - 0.5) * 2 * MAX_DEG;
    targetX = (0.5 - my) * 2 * MAX_DEG;
    // 全息扫光 / 眩光跟随指针位置（本卡独立）
    card.style.setProperty('--neb-mx', (mx * 100).toFixed(1) + '%');
    card.style.setProperty('--neb-my', (my * 100).toFixed(1) + '%');
    start();
  });

  card.addEventListener('pointerleave', () => {
    targetX = 0;
    targetY = 0;
    start();
  });
}

export function initNebulaTilt(): void {
  if (prefersReducedMotion) return;

  // 星云卡片（.nebula-tilt__card）
  const nebulaScene = document.getElementById('nebula-tilt');
  if (nebulaScene) {
    const nebulaCards = nebulaScene.querySelectorAll<HTMLElement>('.nebula-tilt__card');
    nebulaCards.forEach((card) => initCard(card, card.classList.contains('nebula-tilt__card--deep')));
  }

  // 非星云双图画廊卡片（.body-deck__gallery-card）
  const galleries = document.querySelectorAll<HTMLElement>('.body-deck__gallery');
  galleries.forEach((gallery) => {
    const cards = gallery.querySelectorAll<HTMLElement>('.body-deck__gallery-card');
    cards.forEach((card) => initCard(card, false));
  });
}
