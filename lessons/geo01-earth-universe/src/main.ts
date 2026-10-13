/* ============================================================
   地球的宇宙环境 · 入口（迁移自 js/main.js，按模块拆分后统一启动）
   ============================================================ */
import { initStarfield } from './modules/starfield'
import { initNav } from './modules/nav'
import { initFullscreen } from './modules/fullscreen'
import { initExtendModal } from './modules/extendModal'
import { initPracticeModal } from './modules/practiceModal'
import { initMeteorCase } from './modules/meteor'
import { initHierarchy } from './modules/hierarchy'
import { initSolarSystem } from './modules/solar'
import { initMotionFeatures } from './modules/planets'
import { initOrbitDemo } from './modules/orbit'
import { initEarth } from './modules/earth'
import { initLifeChain } from './modules/life'
import { initSummaryTree } from './modules/summary'
import { initReviewMode } from './modules/review'
import { initReviewCards } from './modules/reviewCards'
import { initNebulaTilt } from './modules/nebulaTilt'
import { initBodyDeckTabs } from './modules/bodyDeckTabs'
import { initLightbox } from './modules/lightbox'
import { initCustomQuiz } from './modules/customQuiz'
import { loadPracticeData } from './modules/practiceStore'

export function init(): void {
  // 预加载统一练习题数据文件（practice-data.js），供随堂练习与课后练习读取；
  // 刻意不 await：加载失败/缺失时各模块自行回退内置题目，不阻塞首屏渲染。
  void loadPracticeData();
  initStarfield();
  initNav();
  initFullscreen();
  initExtendModal();
  initPracticeModal();
  initMeteorCase();
  initHierarchy();
  initSolarSystem();
  initMotionFeatures();
  initOrbitDemo();
  initEarth();
  initLifeChain();
  initSummaryTree();
  initReviewCards();   // 先渲染复习题（含每章跳转按钮），再挂复习模式交互
  initReviewMode();
  initNebulaTilt();
  initBodyDeckTabs();
  initLightbox();
  initCustomQuiz();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
