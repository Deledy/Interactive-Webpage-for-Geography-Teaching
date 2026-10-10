/* ============================================================
   M9 复习与总结：单向树状思维导图（mindTree）+ 复习模式切换
   ------------------------------------------------------------
   数据来自 lessonData.review.nodes（本课写死，供课堂讲解与收束）。
   叶子节点的 link 指向本页模块的 section id，点击节点即滚动定位，
   把复习导图与前面各模块联动起来（单向树状：根在左，逐级向右展开）。
   交互：点击带子级的节点展开 / 收起；控制条支持「展开下一层 / 全部展开 / 全部收起」。
   ============================================================ */
import { createMindTree } from '../../../../shared/components/mindTree/mindTree'
import { prefersReducedMotion } from '../utils/dom'
import { App } from '../state'
import { lessonData } from '../data/lessonData'

export function initReviewTree(): void {
  const box = document.getElementById('review-tree')
  const modeBtn = document.querySelector('[data-widget="review-mode"]')
  if (!box || !modeBtn || !lessonData.review) return;

  box.classList.remove('panel--hint');
  box.innerHTML = '';

  createMindTree(box, lessonData.review.nodes, {
    initialDepth: 1,
    maxNodeWidth: 240,
    colGap: 44,
    onLink: (link) => {
      const target = document.querySelector(link);
      if (target) {
        target.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start'
        });
      }
    }
  });

  modeBtn.addEventListener('click', () => {
    document.body.classList.toggle('review-mode');
    App.reviewMode = document.body.classList.contains('review-mode');
    modeBtn.textContent = App.reviewMode ? '退出复习模式' : '进入复习模式';
  });
}
