/** 课程结构清单（lesson-manifest）类型声明，供 TS（vite.config.ts / tests）引用 scripts/manifest.mjs */

export interface ManifestModule {
  /** 兼容序号键，来自 data-practice，如 'M1' */
  key: string
  /** 稳定主键 = 段 id，如 'universe' */
  id: string
  /** 模块序号，如 '01' */
  no: string
  /** 导航名，如 '宇宙' */
  nav: string
  /** 去标签后的模块标题 */
  title: string
  /** 是否有随堂练习按钮 */
  practice: boolean
  /** 练习形态：'choice'（默认）或 'drag'（拖拽分类） */
  kind: string
}

export interface ManifestSection {
  id: string
  no: string
  nav: string
  title: string
}

export interface LessonManifest {
  contract: 'lesson-manifest'
  version: number
  lesson: string
  title: string
  generatedAt: string
  modules: ManifestModule[]
  postLesson: ManifestSection | null
}

export declare const MANIFEST_VERSION: number
export declare const MANIFEST_RULES: {
  section: RegExp
  id: RegExp
  nav: RegExp
  no: RegExp
  title: RegExp
  practiceKey: RegExp
  practiceKind: RegExp
}

export declare function extractManifest(
  html: string,
  meta?: { lesson?: string; title?: string }
): LessonManifest

export declare function manifestScript(manifest: LessonManifest): string
