/**
 * 课程结构清单（lesson-manifest）抽取器。
 *
 * 纯函数、无副作用：输入一节课的 index.html 源码，输出结构化清单。
 * - 构建期：scripts/build.mjs 调用，生成 dist/lesson-manifest.js；
 * - 编辑器：两端共用同一套规则（MANIFEST_RULES），保证构建期与浏览器端结果一致。
 *
 * 该清单是"只读契约"：每次构建重新生成，不要手工修改（改结构请改 index.html）。
 */

export const MANIFEST_VERSION = 1

/** 抽取规则（单一来源，避免构建期与编辑器两端漂移） */
export const MANIFEST_RULES = {
  // 仅匹配顶层模块 <section>：class 中必须含 section 类名（如 "section"、"section cover"），
  // 从而排除模块内部嵌套的 <section class="cosmic-panel"> / <section class="life-panel"> 等
  section: /<section\b([^>]*\bclass="[^"]*\bsection\b[^"]*"[^>]*)>/g,
  id: /id="([^"]+)"/,
  nav: /data-nav="([^"]+)"/,
  no: /section__tag-num[^>]*>([\s\S]*?)<\//,
  title: /section__title[^>]*>([\s\S]*?)<\/h2>/,
  practiceKey: /data-practice="([^"]+)"/,
  practiceKind: /data-practice-kind="([^"]+)"/
}

const stripTags = (value) => (value || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

/**
 * 从课程 index.html 抽取结构清单。
 * @param {string} html 课程源 index.html 内容
 * @param {{ lesson?: string, title?: string }} [meta]
 * @returns {import('./manifest.d.mts').LessonManifest}
 */
export function extractManifest(html, meta = {}) {
  const modules = []
  let postLesson = null
  const heads = [...html.matchAll(MANIFEST_RULES.section)]

  heads.forEach((head, index) => {
    const attrs = head[1] || ''
    const end = heads[index + 1] ? heads[index + 1].index : html.length
    const body = html.slice(head.index, end)

    const id = (attrs.match(MANIFEST_RULES.id) || [])[1] || ''
    const nav = (attrs.match(MANIFEST_RULES.nav) || [])[1] || ''
    if (!id) return

    const no = stripTags((body.match(MANIFEST_RULES.no) || [])[1])
    const title = stripTags((body.match(MANIFEST_RULES.title) || [])[1])
    const key = (body.match(MANIFEST_RULES.practiceKey) || [])[1] || ''

    if (!key) {
      // 无随堂练习按钮的 section → 课后练习（以最后一个为准）
      postLesson = { id, no, nav, title }
      return
    }

    const kind = (body.match(MANIFEST_RULES.practiceKind) || [])[1] || 'choice'
    modules.push({ key, id, no, nav, title, practice: true, kind })
  })

  return {
    contract: 'lesson-manifest',
    version: MANIFEST_VERSION,
    lesson: meta.lesson || '',
    title: meta.title || '',
    generatedAt: new Date().toISOString(),
    modules,
    postLesson
  }
}

/** 生成供 dist 使用的经典脚本（挂到 window.__LESSON_MANIFEST__） */
export function manifestScript(manifest) {
  return '/* 课程结构清单 · 构建期生成 · 请勿手改（改结构请改 index.html 后重新构建） */\n' +
    'window.__LESSON_MANIFEST__ = ' + JSON.stringify(manifest, null, 2) + ';\n'
}
