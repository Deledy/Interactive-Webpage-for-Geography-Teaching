/* ============================================================
   M7 行星分类与三性：分类卡高亮切换 + 三性对照
   ============================================================ */
import { $$ } from '../utils/dom'
import { lessonData } from '../data/lessonData'

export function initPlanetCategories(): void {
  const cats = document.getElementById('planet-categories');
  const feats = document.getElementById('motion-features');
  if (!cats || !feats || !lessonData.planetCategories) return;

  cats.innerHTML = lessonData.planetCategories.map(c => `
      <article class="category-card card" data-cat="${c.id}">
        <h3 class="category-card__name">${c.name}</h3>
        <p class="category-card__members">
          ${c.members.split('、').map(m => `<span class="tag">${m}</span>`).join('')}
        </p>
        <p class="category-card__feature">${c.feature}</p>
      </article>`).join('');

  feats.innerHTML = lessonData.motionFeatures.map(f => `
      <div class="motion-feature card" tabindex="0">
        <h4 class="motion-feature__name">${f.name}</h4>
        <p class="motion-feature__desc">${f.desc}</p>
      </div>`).join('');

  const cards = $$('.category-card', cats);
  cards.forEach(c => c.addEventListener('click', () => {
    cards.forEach(x => x.classList.remove('is-active'));
    c.classList.add('is-active');
  }));
}
