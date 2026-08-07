/* ============================================================
   全局应用状态（迁移自 main.js 的 window.App 单例）
   保持 window.App 全局挂载，兼容既有调试/验收约定（如 solar3dRenderer）。
   ============================================================ */
import type { WebGLRenderer } from 'three'

export interface AppState {
  /** M3 流星案例当前步骤 */
  meteorStep: number
  /** M5 当前聚焦层级索引 */
  level: number
  /** M6 公转是否自动 */
  solarAuto: boolean
  /** M6 选中的行星 id */
  selectedPlanet: string | null
  /** M8 因果链当前点亮步 */
  lifeStep: number
  /** M9 复习模式开关 */
  reviewMode: boolean
  /** M10 拓展浮层状态 */
  modal: { open: boolean; sectionId: string | null }
  /** 随堂练习浮层状态 */
  practiceModal: { open: boolean; sectionId: string | null }
  /** 调试/验收用：3D 渲染器（可通过 info.render 检查渲染统计） */
  solar3dRenderer?: WebGLRenderer
}

export const App: AppState = {
  meteorStep: 0,
  level: 0,
  solarAuto: true,
  selectedPlanet: null,
  lifeStep: 0,
  reviewMode: false,
  modal: { open: false, sectionId: null },
  practiceModal: { open: false, sectionId: null }
}

declare global {
  interface Window {
    App: AppState
  }
}

window.App = App
