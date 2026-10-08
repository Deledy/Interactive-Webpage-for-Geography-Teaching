/* ============================================================
   M9 复习文档：严格按 docs/复习模式知识点.docx 的节、行、挖空还原，
   以从左到右的阅读形式排版，支持左右并排。
   挖空答案存放在 data-answer，由 CSS ::after 呈现——伪元素内容不参与
   文本复制，因此选中复制时不会带出答案。
   数据来自 lessonData.review.sections。
   ============================================================ */
import { $$ } from '../utils/dom'
import { lessonData } from '../data/lessonData'
import type { ReviewBlock, ReviewJudgeItem, ReviewSegment } from '../types'

/** 行内片段：文本原样输出；挖空答案写入 data-answer（不进入可复制文本）；间隔符号单独成 span 以便留白 */
function renderSegments(segments: ReviewSegment[]): string {
  return segments.map(s => {
    if (s.kind === 'blank') {
      return `<button type="button" class="cloze-blank" data-answer="${s.answer}" aria-expanded="false" aria-label="点击显示答案" title="点击显示答案"></button>`;
    }
    if (s.kind === 'sep') {
      return `<span class="review-sep">${s.text}</span>`;
    }
    return `<span class="cloze-text">${s.text}</span>`;
  }).join('');
}

/** 判断练习：逐项点击揭示「天体 / 非天体」与原因 */
function renderJudgeList(items: ReviewJudgeItem[]): string {
  const list = items.map(it => `
    <button type="button" class="judge-item" data-celestial="${it.isCelestial ? '1' : '0'}" aria-expanded="false" aria-label="点击显示判断结果" title="点击显示判断结果">
      <span class="judge-item__name">${it.name}</span>
      <span class="judge-item__verdict">${it.isCelestial ? '天体' : '非天体'}</span>
      <span class="judge-item__explain">${it.explain}</span>
    </button>`).join('');
  return `<div class="judge-list">${list}</div>`;
}

/** 单个内容块：行 / 小标题 / 判断练习 / 左右并排 */
function renderBlock(block: ReviewBlock): string {
  if (block.kind === 'sub') {
    return `<h4 class="review-sub">${block.text}</h4>`;
  }
  if (block.kind === 'judge') {
    return renderJudgeList(block.items);
  }
  if (block.kind === 'columns') {
    return `<div class="review-cols">${block.cols
      .map(col => `<div class="review-col">${col.map(renderBlock).join('')}</div>`)
      .join('')}</div>`;
  }
  const prefix = block.prefix
    ? `<span class="review-line__prefix">${block.prefix}</span>`
    : '';
  return `<p class="review-line">${prefix}${renderSegments(block.segments)}</p>`;
}

export function initReviewCards(): void {
  const box = document.getElementById('review-cards');
  if (!box) return;

  const sections = lessonData.review.sections;
  if (!sections || sections.length === 0) return;

  box.innerHTML = sections.map(sec => `
    <section class="review-sec">
      <h3 class="review-sec__heading">${sec.heading}</h3>
      ${sec.blocks.map(renderBlock).join('')}
    </section>`).join('');

  // 挖空：点击揭示 / 再次点击收回
  $$('.cloze-blank', box).forEach(blank => {
    blank.addEventListener('click', () => {
      const revealed = blank.classList.toggle('is-revealed');
      blank.setAttribute('aria-expanded', String(revealed));
    });
  });

  // 判断练习：点击单项揭示 / 再次点击收回
  $$('.judge-item', box).forEach(item => {
    item.addEventListener('click', () => {
      const revealed = item.classList.toggle('is-revealed');
      item.setAttribute('aria-expanded', String(revealed));
    });
  });
}
