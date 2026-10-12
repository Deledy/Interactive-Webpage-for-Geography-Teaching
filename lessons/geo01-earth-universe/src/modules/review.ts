/* ============================================================
   M11 复习：复习模式切换 + 章节跳转 + 返回复习模式
   ------------------------------------------------------------
   - 复习模块默认仅展示「进入复习模式」入口按钮，不渲染复习题。
     点击后给 <body> 加上 review-mode 类：页面切换为纯复习题视图，
     其余模块、导航项与非复习题内容全部隐藏（显隐规则见 styles/style.css）。
     再次点击退出，回到常规讲解视图。
   - 每个复习章节内的「前往对应内容」按钮：退出复习模式、滚动到对应模块，
     并给 <body> 加上 review-return 类，常驻显示「返回复习模式」浮动按钮。
   - 点击浮动按钮：重新进入复习模式并滚动回复习模块。
   ============================================================ */
import { App } from '../state'

/** 平滑滚动到指定锚点；jsdom 未实现 scrollIntoView 时静默跳过 */
function scrollToAnchor(selector: string): void {
  const target = document.querySelector(selector)
  if (target && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

export function initReviewMode(): void {
  const modeBtn = document.querySelector<HTMLElement>('[data-widget="review-mode"]');
  const returnBtn = document.getElementById('review-return');
  const body = document.body;

  function enterReview(scroll: boolean): void {
    body.classList.remove('review-return');
    body.classList.add('review-mode');
    App.reviewMode = true;
    if (modeBtn) modeBtn.textContent = '退出复习模式';
    if (scroll) scrollToAnchor('#review');
  }

  function exitReview(): void {
    body.classList.remove('review-mode');
    App.reviewMode = false;
    if (modeBtn) modeBtn.textContent = '进入复习模式';
  }

  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      if (body.classList.contains('review-mode')) exitReview();
      else enterReview(true);
    });
  }

  // 章节跳转：离开复习模式，跳到对应模块内容，并常驻「返回复习模式」按钮
  document.querySelectorAll<HTMLElement>('[data-review-jump]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.reviewJump || '';
      exitReview();
      body.classList.add('review-return');
      if (target) scrollToAnchor(target);
    });
  });

  if (returnBtn) {
    returnBtn.addEventListener('click', () => enterReview(true));
  }
}