/* ============================================================
   M9 知识总结：单向树状思维导图（mindTree）
   ------------------------------------------------------------
   数据来自 lessonData.review.nodes（本课写死，供课堂讲解与收束）。
   叶子节点的 link 指向本页模块的 section id，点击节点即滚动定位，
   把总结导图与前面各模块联动起来（单向树状：根在左，逐级向右展开）。
   交互：点击带子级的节点展开 / 收起；控制条支持「展开下一层 / 全部展开 / 全部收起」。
   ============================================================ */
import { createMindTree } from '../../../../shared/components/mindTree/mindTree'
import { prefersReducedMotion } from '../utils/dom'
import { lessonData } from '../data/lessonData'

export function initSummaryTree(): void {
  const box = document.getElementById('summary-tree')
  if (!box || !lessonData.review) return;

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
}