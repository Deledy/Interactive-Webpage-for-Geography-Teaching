/* ============================================================
   M0 顶部导航：平滑滚动 + 滚动高亮（IntersectionObserver）
   ============================================================ */
import { $, $$, prefersReducedMotion } from '../utils/dom'

export function initNav(): void {
  const navLinks = $$('.topnav__links a');
  const sections = navLinks
    .map(a => document.getElementById((a as HTMLElement).dataset.target || ''))
    .filter((el): el is HTMLElement => el !== null);

  function setActive(targetId: string): void {
    navLinks.forEach(a => a.classList.toggle('is-active', (a as HTMLElement).dataset.target === targetId));
  }

  if ('IntersectionObserver' in window && sections.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActive((entry.target as HTMLElement).id);
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    sections.forEach(s => io.observe(s));
  }

  $$('[data-scroll-to]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById((btn as HTMLElement).dataset.scrollTo || '');
      if (target) target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
  });
}
