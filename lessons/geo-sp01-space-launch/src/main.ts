/** 入口：按顺序初始化各功能模块（与 docs/05_开发文档.md §2 对应） */
import './styles/tokens.css'
import './styles/base.css'
import './styles/shell.css'
import './styles/rollcall.css'
import './styles/conditions.css'
import './styles/m4.css'
import './styles/m5.css'
import './styles/practice.css'
import './styles/print.css'

import { injectIcons } from './utils/icons'
import { clearToasts } from './utils/toast'
import { initNav } from './modules/nav'
import { resetTimer } from './modules/timer'
import { resetRollcall } from './modules/rollcall'
import { initIntro, resetIntro } from './modules/intro'
import { initLaunchConditions, resetLaunchConditions } from './modules/launchConditions'
import { initLandingConditions, resetLandingConditions } from './modules/landingConditions'
import { initSiteCompare, resetSiteCompare } from './modules/siteCompare'
import { initBaseMatching, resetBaseMatching } from './modules/baseMatching'
import { initQuiz, resetQuiz } from './modules/quiz'
import { initPractice, resetPractice } from './modules/practice'

function section(id: string): HTMLElement {
  const node = document.getElementById(id)
  if (!node) throw new Error(`缺少 section#${id}`)
  return node
}

/** 重置本页：清空全部作答状态并回到首屏 */
function resetAll(): void {
  resetTimer()
  resetRollcall()
  resetIntro()
  resetLaunchConditions()
  resetLandingConditions()
  resetSiteCompare()
  resetBaseMatching()
  resetQuiz()
  resetPractice()
  clearToasts()
  document.querySelectorAll('.overlay').forEach((node) => node.remove())
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function boot(): void {
  injectIcons()
  initNav(section('nav'), resetAll)
  initIntro(section('m1'))
  initSiteCompare(section('m4'))
  initLaunchConditions(section('m2'))
  initLandingConditions(section('m3'))
  initBaseMatching(section('m5'))
  initQuiz(section('m6'))
  initPractice(section('m7'), section('m7a'))
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot)
} else {
  boot()
}
