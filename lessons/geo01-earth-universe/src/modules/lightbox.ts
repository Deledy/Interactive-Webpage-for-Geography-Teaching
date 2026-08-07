/* ============================================================
   图片查看器（Image Lightbox）
   - 点击 [data-lightbox] 图片弹出放大查看
   - 滚轮缩放 · 拖拽平移 · 双指手势 · Esc 关闭
   ============================================================ */

const CFG = {
  attr: 'data-lightbox',
  zoomStep: 0.25,
  zoomMin: 0.3,
  zoomMax: 5,
  wheelZoomSpeed: 0.1,
  dbClickThreshold: 300,
};

let overlay: HTMLElement;
let viewport: HTMLElement;
let img: HTMLImageElement;
let spinner: HTMLElement;
let btnClose: HTMLElement;
let labelZoom: HTMLElement;
let zoom = 1;
let panX = 0;
let panY = 0;

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragPanX = 0;
let dragPanY = 0;
let rafPending = false;
let lastClickTime = 0;

// ── 初始化 ────────────────────────────────────────────────
function init() {
  if (overlay) return;

  const tpl = document.getElementById('ilb-template') as HTMLTemplateElement | null;
  if (!tpl) return;

  const frag = tpl.content.cloneNode(true) as DocumentFragment;
  document.body.appendChild(frag);

  overlay = document.querySelector('.ilb-overlay')!;
  viewport = overlay.querySelector('.ilb-viewport')!;
  img = overlay.querySelector('.ilb-img')!;
  spinner = overlay.querySelector('.ilb-spinner')!;
  btnClose = overlay.querySelector('.ilb-close')!;
  const btnZoomIn = overlay.querySelector('.ilb-btn--zoom-in')!;
  const btnZoomOut = overlay.querySelector('.ilb-btn--zoom-out')!;
  const btnReset = overlay.querySelector('.ilb-btn--reset')!;
  labelZoom = btnReset as HTMLElement;

  // 关闭
  btnClose.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // 按钮缩放
  btnZoomIn.addEventListener('click', () => applyZoom(zoom + CFG.zoomStep));
  btnZoomOut.addEventListener('click', () => applyZoom(zoom - CFG.zoomStep));
  btnReset.addEventListener('click', reset);

  // 滚轮
  viewport.addEventListener('wheel', onWheel, { passive: false });

  // 拖拽
  viewport.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  // 双击
  viewport.addEventListener('click', onViewportClick);

  // 加载
  img.addEventListener('load', onImgLoad);
  img.addEventListener('error', onImgError);

  // 键盘
  document.addEventListener('keydown', onKeyDown);

  // 触屏
  viewport.addEventListener('touchstart', onTouchStart, { passive: false });
  viewport.addEventListener('touchmove', onTouchMove, { passive: false });
  viewport.addEventListener('touchend', onTouchEnd);

  // 点击代理
  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest(`[${CFG.attr}]`);
    if (!target || target.closest('.ilb-overlay')) return;
    e.preventDefault();
    const src = target.getAttribute(CFG.attr) || target.getAttribute('src') || target.getAttribute('href');
    const alt = target.getAttribute('alt') || '';
    if (src && src !== '#') open(src, alt);
  });
}

// ── 打开 / 关闭 ──────────────────────────────────────────
function open(src: string, alt: string) {
  init();
  if (!overlay) return;

  document.body.style.overflow = 'hidden';
  zoom = 1; panX = 0; panY = 0;

  spinner.classList.add('is-active');
  img.style.opacity = '0';
  img.src = src;
  img.alt = alt;
  applyTransform();
  updateLabel();
  overlay.classList.add('is-open');
  btnClose.focus();
}

function close() {
  if (!overlay) return;
  overlay.classList.remove('is-open');
  document.body.style.overflow = '';
  setTimeout(() => {
    if (!overlay.classList.contains('is-open')) img.src = '';
  }, 400);
}

function reset() {
  zoom = 1; panX = 0; panY = 0;
  applyTransform();
  updateLabel();
}

// ── 缩放 ──────────────────────────────────────────────────
function applyZoom(newZoom: number, cx?: number, cy?: number) {
  const oldZoom = zoom;
  zoom = clamp(newZoom, CFG.zoomMin, CFG.zoomMax);

  if (cx !== undefined && cy !== undefined && oldZoom !== zoom) {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const ix = (cx * vw - panX) / oldZoom;
    const iy = (cy * vh - panY) / oldZoom;
    panX = cx * vw - ix * zoom;
    panY = cy * vh - iy * zoom;
  }
  applyTransform();
  updateLabel();
}

function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }

function applyTransform() {
  if (!img) return;
  img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
}

function updateLabel() {
  if (!labelZoom) return;
  labelZoom.textContent = Math.round(zoom * 100) + '%';
}

// ── 滚轮 ──────────────────────────────────────────────────
function onWheel(e: WheelEvent) {
  e.preventDefault();
  const r = viewport.getBoundingClientRect();
  const cx = (e.clientX - r.left) / r.width;
  const cy = (e.clientY - r.top) / r.height;
  const d = e.deltaY > 0 ? -CFG.wheelZoomSpeed : CFG.wheelZoomSpeed;
  applyZoom(zoom + d, cx, cy);
}

// ── 拖拽 ──────────────────────────────────────────────────
function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'touch') return;
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragPanX = panX;
  dragPanY = panY;
  viewport.classList.add('is-dragging');
  viewport.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging) return;
  panX = dragPanX + (e.clientX - dragStartX);
  panY = dragPanY + (e.clientY - dragStartY);
  schedule();
}

function onPointerUp(e: PointerEvent) {
  if (!isDragging) return;
  isDragging = false;
  viewport.classList.remove('is-dragging');
  viewport.releasePointerCapture(e.pointerId);
}

function schedule() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { applyTransform(); rafPending = false; });
}

// ── 双击 ──────────────────────────────────────────────────
function onViewportClick(e: MouseEvent) {
  if (Math.abs(panX - dragPanX) > 2 || Math.abs(panY - dragPanY) > 2) return;
  const now = Date.now();
  if (now - lastClickTime < CFG.dbClickThreshold) {
    if (zoom < 1.5) {
      const r = viewport.getBoundingClientRect();
      applyZoom(2, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    } else {
      reset();
    }
  }
  lastClickTime = now;
}

// ── 触屏手势 ──────────────────────────────────────────────
let tDist = 0, tZoom = 1, tMidX = 0, tMidY = 0, tPX = 0, tPY = 0;
let tCount = 0;

function onTouchStart(e: TouchEvent) {
  tCount = e.touches.length;
  if (tCount === 1) {
    isDragging = true;
    dragStartX = e.touches[0].clientX;
    dragStartY = e.touches[0].clientY;
    dragPanX = panX;
    dragPanY = panY;
    viewport.classList.add('is-dragging');
  } else if (tCount === 2) {
    isDragging = false;
    viewport.classList.remove('is-dragging');
    const [a, b] = [e.touches[0], e.touches[1]];
    tDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    tZoom = zoom;
    tMidX = (a.clientX + b.clientX) / 2;
    tMidY = (a.clientY + b.clientY) / 2;
    tPX = panX; tPY = panY;
  }
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length === 1 && isDragging) {
    e.preventDefault();
    panX = dragPanX + (e.touches[0].clientX - dragStartX);
    panY = dragPanY + (e.touches[0].clientY - dragStartY);
    schedule();
  } else if (e.touches.length === 2) {
    e.preventDefault();
    const [a, b] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const midX = (a.clientX + b.clientX) / 2;
    const midY = (a.clientY + b.clientY) / 2;
    const r = viewport.getBoundingClientRect();

    zoom = clamp(tZoom * (dist / tDist), CFG.zoomMin, CFG.zoomMax);
    const cx = (tMidX - r.left) / r.width;
    const cy = (tMidY - r.top) / r.height;
    const ix = (cx * r.width - panX) / zoom;
    const iy = (cy * r.height - panY) / zoom;
    panX = tPX + (midX - tMidX);
    panY = tPY + (midY - tMidY);

    applyTransform();
    updateLabel();
  }
}

function onTouchEnd(e: TouchEvent) {
  isDragging = false;
  viewport.classList.remove('is-dragging');
  tCount = e.touches.length;
}

// ── 键盘 ──────────────────────────────────────────────────
function onKeyDown(e: KeyboardEvent) {
  if (!overlay || !overlay.classList.contains('is-open')) return;
  switch (e.key) {
    case 'Escape': e.preventDefault(); close(); break;
    case '+': case '=': e.preventDefault(); applyZoom(zoom + CFG.zoomStep); break;
    case '-': e.preventDefault(); applyZoom(zoom - CFG.zoomStep); break;
    case '0': e.preventDefault(); reset(); break;
  }
}

// ── 图片加载 ──────────────────────────────────────────────
function onImgLoad() {
  spinner.classList.remove('is-active');
  img.style.opacity = '1';
  img.style.transition = 'opacity .25s, transform .25s cubic-bezier(.25,.8,.35,1)';
}

function onImgError() {
  spinner.classList.remove('is-active');
  img.style.opacity = '1';
  img.alt = '图片加载失败';
}

// ── 导出初始化函数 ────────────────────────────────────────
export function initLightbox(): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
