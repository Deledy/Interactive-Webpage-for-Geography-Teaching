/* ============================================================
   地球的宇宙环境 · 入口（迁移自 js/main.js，按模块拆分后统一启动）
   ============================================================ */
import { initStarfield } from './modules/starfield'
import { initNav } from './modules/nav'
import { initExtendModal } from './modules/extendModal'
import { initPracticeModal } from './modules/practiceModal'
import { initMeteorCase } from './modules/meteor'
import { initHierarchy } from './modules/hierarchy'
import { initSolarSystem } from './modules/solar'
import { initPlanetCategories } from './modules/planets'
import { initLifeChain } from './modules/life'
import { initReviewTree } from './modules/review'
import { initNebulaTilt } from './modules/nebulaTilt'

export function init(): void {
  initStarfield();
  initNav();
  initExtendModal();
  initPracticeModal();
  initMeteorCase();
  initHierarchy();
  initSolarSystem();
  initPlanetCategories();
  initLifeChain();
  initReviewTree();
  initNebulaTilt();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
