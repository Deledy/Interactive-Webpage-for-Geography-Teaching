/* ============================================================
   M0 顶部导航 · 全屏切换按钮
   - 点击进入全屏，再次点击退出全屏（含 Webkit 前缀兼容）
   - 监听 fullscreenchange 同步按钮状态（图标 / 颜色 / aria）
   ============================================================ */

type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };
type FsDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };

function isFullscreen(): boolean {
  const doc = document as FsDocument;
  return !!(document.fullscreenElement || doc.webkitFullscreenElement);
}

export function initFullscreen(): void {
  const btn = document.getElementById('fs-toggle');
  if (!btn) return;
  const toggle: HTMLElement = btn;   // 显式收敛类型，避免闭包内重新放宽为 null

  function sync(): void {
    const active = isFullscreen();
    toggle.classList.toggle('is-fullscreen', active);
    toggle.setAttribute('aria-label', active ? '退出全屏' : '进入全屏');
    toggle.setAttribute('title', active ? '退出全屏' : '进入全屏');
  }

  toggle.addEventListener('click', () => {
    if (isFullscreen()) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else {
        (document as FsDocument).webkitExitFullscreen?.();
      }
    } else {
      const root = document.documentElement as FsElement;
      if (root.requestFullscreen) {
        root.requestFullscreen().catch(() => {});
      } else {
        root.webkitRequestFullscreen?.();
      }
    }
  });

  // 用户按 Esc 退出全屏等场景也要同步按钮状态
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  sync();
}
