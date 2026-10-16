/* ============================================================
   自定义练习（M10 课后练习）
   ------------------------------------------------------------
   定位：给「分发之后」的教师留一个可自行设题的练习模块（选择题 / 综合题）。

   数据外置：题目数据来自本课 public/practice-data.js 的 postLesson（构建时原样复制到 dist 根目录，
   与 index.html 同级）。加载方式刻意不用 fetch/JSON：file:// 双击打开时 fetch 会被 CORS 拦截；
   改为动态注入经典 <script src>，由数据文件把内容挂到 window.__PRACTICE_DATA__。

   渲染：统一交给 shared/practice-window 的 openPracticeWindow（页内挂载，与随堂练习同一套渲染器），
   本模块只保留「数据加载 + 入口 + 重置」职责（详见 practice-window 开发文档 §3 / §8）。

   数据源优先级：
   - 统一数据文件 practice-data.js 的 postLesson（可编辑真源）；
   - 旧 custom-quiz.js（window.__CUSTOM_QUIZ__）作为兼容回退保留一个版本。
   ============================================================ */
import { getPracticeData, loadPracticeData } from './practiceStore'
import { validateQuizData } from '../../../../shared/practice-window/src/validate'
import { openPracticeWindow, type PracticeWindowHandle } from '../../../../shared/practice-window/src/practiceWindow'

let windowHandle: PracticeWindowHandle | null = null

/** 兼容回退：注入旧 custom-quiz.js（内容挂到 window.__CUSTOM_QUIZ__）。 */
function loadLegacyViaScript(): Promise<unknown> {
  const globalWindow = window as unknown as { __CUSTOM_QUIZ__?: unknown }
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = './custom-quiz.js'
    script.async = true
    script.onload = () => resolve(globalWindow.__CUSTOM_QUIZ__ ?? null)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}

/**
 * 解析课后练习数据：
 * 1) 统一数据文件 practice-data.js 的 postLesson（可编辑真源）；
 * 2) 旧 custom-quiz.js 注入的 window.__CUSTOM_QUIZ__（兼容回退）。
 * 刻意先同步检查已有数据，避免在无脚本环境的测试中 await 挂起。
 */
async function resolveData(): Promise<unknown> {
  const ready = getPracticeData()
  if (ready) return ready.postLesson ?? null

  const globalWindow = window as unknown as { __CUSTOM_QUIZ__?: unknown }
  if (globalWindow.__CUSTOM_QUIZ__ !== undefined) return globalWindow.__CUSTOM_QUIZ__

  const store = await loadPracticeData()
  if (store) return store.postLesson ?? null
  return loadLegacyViaScript()
}

export function initCustomQuiz(): void {
  const host = document.getElementById('quiz-custom-body')
  if (!host) return

  // M10 区块头部既有的「重做本页练习」入口 → 组件重置
  document.querySelector('[data-cq-reset]')?.addEventListener('click', () => {
    windowHandle?.reset()
  })

  void resolveData().then((loaded) => {
    const { data, issues } = validateQuizData(loaded)
    if (issues.length) console.warn('[customQuiz] 数据校验提示：', issues)

    windowHandle?.close()
    windowHandle = null
    host.innerHTML = ''

    // 页内挂载（container）；底部不再重复「重做」入口（区块头部已有）
    windowHandle = openPracticeWindow({
      container: host,
      title: data?.title || '自定义练习',
      subtitle: data?.subtitle,
      sections: data?.sections,
      mode: 'list',
      timer: false,
      resetBar: false,
      emptyIssues: data ? [] : issues
    })
  })
}
