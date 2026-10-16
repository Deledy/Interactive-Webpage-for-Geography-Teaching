/* ============================================================
   随堂练习数据仓库（可编辑真源：public/practice-data.js）
   ------------------------------------------------------------
   - 加载方式与 custom-quiz.js 一致：动态注入经典 <script src>，由数据文件把内容挂到
     window.__PRACTICE_DATA__。刻意不用 fetch/JSON——file:// 双击分发时 fetch 会被 CORS 拦截。
   - 数据真源优先级：window.__PRACTICE_DATA__（外置，可编辑）→ lessonData.practices（源码内置回退）。
   - 结构校验：统一复用 shared/practice-window/src/validate.ts（单一真源，不在本文件重写）。
   - 运行时无需读取 lesson-manifest.js：模块 id 由消费方从段元素（closest('section.section').id）直接取得。
   ============================================================ */
import type { CqData, PracticeData, PracticeModule } from '../types'
import { DATA_VERSION, validateModulePractice } from '../../../../shared/practice-window/src/validate'

const PRACTICE_GLOBAL = '__PRACTICE_DATA__'

/** 已加载的数据快照（同步读取入口，供 practiceModal 在点击时即时使用） */
let loaded: PracticeData | null = null
/** 进行中的加载 Promise（幂等：多次调用共用一个） */
let loading: Promise<PracticeData | null> | null = null

function practiceGlobal(): Record<string, unknown> {
  return window as unknown as Record<string, unknown>
}

/** 版本提示（非阻断）：数据版本高于运行时支持上限时打印一次警告 */
function warnVersion(data: PracticeData): void {
  if (typeof data.version === 'number' && data.version > DATA_VERSION) {
    console.warn(`[practiceStore] 数据版本 v${data.version} 高于当前支持的 v${DATA_VERSION}，可能有未识别字段`)
  }
}

/** 加载 ./practice-data.js（幂等；缺失返回 null） */
export function loadPracticeData(): Promise<PracticeData | null> {
  if (loaded) return Promise.resolve(loaded)
  if (loading) return loading

  const existing = practiceGlobal()[PRACTICE_GLOBAL] as PracticeData | undefined
  if (existing) {
    loaded = existing
    warnVersion(existing)
    return Promise.resolve(loaded)
  }

  loading = new Promise<PracticeData | null>((resolve) => {
    const script = document.createElement('script')
    script.src = './practice-data.js'
    script.async = true
    script.onload = () => {
      const data = (practiceGlobal()[PRACTICE_GLOBAL] as PracticeData | undefined) ?? null
      loaded = data
      if (data) warnVersion(data)
      resolve(data)
    }
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
  return loading
}

/** 同步读取已加载的数据快照（未加载返回 null，不触发加载） */
export function getPracticeData(): PracticeData | null {
  return loaded
}

/** 课后练习（沿用 CqData 的 title / subtitle / sections 结构） */
export function getPostLesson(): CqData | null {
  return loaded?.postLesson ? ({ ...loaded.postLesson } as CqData) : null
}

/** 取出并校验单个模块的随堂练习（id 优先，未命中用兼容键兜底） */
export function getModulePractice(id: string, compatKey?: string): PracticeModule | undefined {
  const modules = loaded?.modules
  if (!modules) return undefined
  for (const key of [id, compatKey]) {
    if (!key) continue
    const raw = modules[key]
    if (!raw) continue
    const result = validateModulePractice(raw)
    if (result.issues.length) console.warn('[practiceStore] 模块练习数据校验提示：', result.issues)
    if (result.module) return result.module
  }
  return undefined
}
