import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractManifest, manifestScript } from '../scripts/manifest.mjs'

const lessonHtml = readFileSync(
  resolve(process.cwd(), 'lessons/geo01-earth-universe/index.html'),
  'utf8'
)

describe('课程结构清单抽取（lesson-manifest）', () => {
  const manifest = extractManifest(lessonHtml, {
    lesson: 'geo01-earth-universe',
    title: '地球的宇宙环境'
  })

  it('抽取 9 个随堂练习模块 + 1 个课后练习', () => {
    expect(manifest.modules).toHaveLength(9)
    expect(manifest.postLesson?.id).toBe('quiz-custom')
  })

  it('模块键与段 id 一一对应（M1..M9 → universe..review）', () => {
    expect(manifest.modules.map((m) => m.key)).toEqual([
      'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9'
    ])
    expect(manifest.modules.map((m) => m.id)).toEqual([
      'universe', 'celestial', 'meteor', 'hierarchy', 'solar', 'planets', 'earth', 'life', 'review'
    ])
  })

  it('标题去除 HTML 标签（M2 标题含 <strong>）', () => {
    expect(manifest.modules[1].title).toBe('天体是宇宙中物质的存在形式。')
    expect(manifest.modules[0].title).toBe('宇宙概念')
  })

  it('记录模块序号与导航名', () => {
    expect(manifest.modules[0]).toMatchObject({ no: '01', nav: '宇宙' })
    expect(manifest.modules[8]).toMatchObject({ no: '09', nav: '复习' })
  })

  it('M3 识别为拖拽题型，其余默认为选择题型', () => {
    expect(manifest.modules[2].kind).toBe('drag')
    expect(manifest.modules[0].kind).toBe('choice')
  })

  it('排除模块内嵌套的 <section>（不误判为模块）', () => {
    const ids = manifest.modules.map((m) => m.id)
    expect(ids).not.toContain('meteor-judgment')
    expect(ids).not.toContain('cover')
  })

  it('生成可注入的经典脚本（window.__LESSON_MANIFEST__）', () => {
    const script = manifestScript(manifest)
    expect(script).toContain('window.__LESSON_MANIFEST__')
    expect(script).toContain('"contract": "lesson-manifest"')
  })
})
