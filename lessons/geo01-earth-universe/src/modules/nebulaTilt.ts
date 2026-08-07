/* ============================================================
   M2 星云卡片 · 创生之柱 3D 倾斜堆叠
   （指针跟随倾斜 + 全息扫光，效果参照 shared/3d-perspective-hover-tilt-stack.html。
    实现方式：JS 用 requestAnimationFrame 缓动并直接驱动 deck 的 transform，
    不依赖 @property / 自定义属性过渡，兼容性最佳；"减少动态"偏好下不启用）
   ============================================================ */
import { prefersReducedMotion } from '../utils/dom'

export function initNebulaTilt(): void {
  const scene = document.getElementById('nebula-tilt');
  if (!scene) return;
  const deck = scene.querySelector<HTMLElement>('.nebula-tilt__deck');
  if (!deck || prefersReducedMotion) return;

  const MAX_DEG = 12;
  let targetX = 0;
  let targetY = 0;
  let curX = 0;
  let curY = 0;
  let raf = 0;

  const loop = (): void => {
    curX += (targetX - curX) * 0.16;
    curY += (targetY - curY) * 0.16;
    if (Math.abs(targetX - curX) < 0.05) curX = targetX;
    if (Math.abs(targetY - curY) < 0.05) curY = targetY;
    deck.style.transform = `rotateX(${curX.toFixed(2)}deg) rotateY(${curY.toFixed(2)}deg)`;
    if (Math.abs(targetX - curX) > 0.01 || Math.abs(targetY - curY) > 0.01) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = 0;
    }
  };

  const start = (): void => {
    if (!raf) raf = requestAnimationFrame(loop);
  };

  const move = (mx: number, my: number): void => {
    targetY = (mx - 0.5) * 2 * MAX_DEG;
    targetX = (0.5 - my) * 2 * MAX_DEG;
    // 全息扫光 / 眩光跟随指针位置（不参与缓动，随帧更新）
    deck.style.setProperty('--neb-mx', (mx * 100).toFixed(1) + '%');
    deck.style.setProperty('--neb-my', (my * 100).toFixed(1) + '%');
    start();
  };

  deck.addEventListener('pointermove', (e) => {
    const r = deck.getBoundingClientRect();
    move((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  });

  deck.addEventListener('pointerleave', () => {
    targetX = 0;
    targetY = 0;
    start();
  });
}
