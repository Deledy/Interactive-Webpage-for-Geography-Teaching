/* ============================================================
   M0 全局星点背景
   无 JS 时由 CSS 静态星点兜底；JS 开启时由 canvas 绘制并缓慢漂移。
   ============================================================ */
import { prefersReducedMotion } from '../utils/dom'

interface Star {
  x: number
  y: number
  r: number
  speed: number
  phase: number
}

export function initStarfield(): void {
  const canvasEl = document.getElementById('starfield') as HTMLCanvasElement | null;
  if (!canvasEl || !canvasEl.getContext) return;
  const ctx = canvasEl.getContext('2d');
  if (!ctx) return;
  const canvas: HTMLCanvasElement = canvasEl;
  const ctx2d: CanvasRenderingContext2D = ctx;

  let stars: Star[] = [];
  let w = 0;
  let h = 0;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize(): void {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx2d.setTransform(DPR, 0, 0, DPR, 0, 0);
    const count = Math.round((w * h) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.4 + 0.3,
      speed: Math.random() * 0.08 + 0.02,
      phase: Math.random() * Math.PI * 2
    }));
  }

  function draw(t: number): void {
    ctx2d.clearRect(0, 0, w, h);
    for (const s of stars) {
      const twinkle = prefersReducedMotion ? 1 : 0.6 + 0.4 * Math.sin(t / 600 + s.phase);
      ctx2d.globalAlpha = twinkle * 0.9;
      ctx2d.fillStyle = '#ffffff';
      ctx2d.beginPath();
      ctx2d.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx2d.fill();
      if (!prefersReducedMotion) {
        s.y += s.speed;
        if (s.y > h + 2) { s.y = -2; s.x = Math.random() * w; }
      }
    }
    ctx2d.globalAlpha = 1;
  }

  function frame(t: number): void {
    draw(t);
    if (!prefersReducedMotion) requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  if (prefersReducedMotion) { draw(0); } else { requestAnimationFrame(frame); }
}
