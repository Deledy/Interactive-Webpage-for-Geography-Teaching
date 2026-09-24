/* ============================================================
   M2 天体卡片 · 页签胶囊滑动指示
   radio 仍是唯一状态源（文字配色与卡片切换由 CSS :has() 完成），
   本模块只做一件事：把 .body-deck__tab-glow 对齐到当前选中页签的
   实测盒模型（宽 + 位移），使选中胶囊以 .25s "滑过去"而非原地跳变。
   无布局信息的环境（如 jsdom）实测宽度为 0，此时直接返回，
   保留 CSS 默认态，静态降级路径不受影响。
   ============================================================ */
function initDeck(deck: HTMLElement): void {
  const tabs = deck.querySelector<HTMLElement>('.body-deck__tabs')
  const glow = tabs?.querySelector<HTMLElement>('.body-deck__tab-glow')
  if (!tabs || !glow) return

  let raf = 0

  const sync = (animate: boolean): void => {
    const checked = deck.querySelector<HTMLInputElement>('input[name="body-deck"]:checked')
    const label = checked ? tabs.querySelector<HTMLElement>(`[for="${checked.id}"]`) : null
    if (!label) return

    const bar = tabs.getBoundingClientRect()
    const box = label.getBoundingClientRect()
    if (!box.width) return; // 无布局信息（jsdom 等）：保留 CSS 默认态

    glow.style.transition = animate ? '' : 'none';
    glow.style.width = `${box.width}px`;
    // 指示层以 .body-deck__tabs 的 padding box 为定位基准，故扣掉左边框宽度
    glow.style.transform = `translateX(${box.left - bar.left - tabs.clientLeft}px)`;
    // 强制回流，避免首屏 / 尺寸变化时的对齐也走过渡动画
    if (!animate) void glow.offsetWidth;
  };

  sync(false);
  deck.addEventListener('change', () => sync(true));
  window.addEventListener('resize', () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = 0;
      sync(false);
    });
  });
}

export function initBodyDeckTabs(): void {
  document.querySelectorAll<HTMLElement>('[data-widget="body-deck"]').forEach(initDeck);
}
