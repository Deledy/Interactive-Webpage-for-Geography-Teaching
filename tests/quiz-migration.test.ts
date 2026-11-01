import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import {
  buildPracticeData,
  normalizeModule,
  normalizeSections,
  serializePracticeData,
  toGroups
} from '../shared/quiz/editor/src/model'
import type { EditorState } from '../shared/quiz/editor/src/model'
import { validateModulePractice } from '../shared/quiz/runtime/src/validate'
import { createPracticeView } from '../shared/quiz/runtime/src/practiceWindow'
import type { MaterialLayout } from '../shared/quiz/content/materialTypes'

const choice = (material: string, stem: string) => ({
  type: 'choice' as const,
  mode: 'single' as const,
  material,
  stem,
  options: [
    { key: 'A', text: '甲' },
    { key: 'B', text: '乙' }
  ],
  answer: 'A'
})

const materialLayout: MaterialLayout = {
  version: 1,
  width: 1000,
  height: 520,
  objects: [
    { id: 'text-1', type: 'text', x: 20, y: 20, width: 600, height: 120, html: '<p>画布材料</p>' }
  ]
}

describe('编辑器数据模型 · v2 → v3 迁移', () => {
  it('连续且材料相同的扁平题收敛为一个题组', () => {
    const groups = toGroups([
      choice('<p>公共材料</p>', '第1题'),
      choice('<p>公共材料</p>', '第2题'),
      choice('<p>另一段材料</p>', '第3题')
    ])
    expect(groups).toHaveLength(2)
    expect((groups[0].materialLayout!.objects[0] as { html: string }).html).toContain('公共材料')
    expect(groups[0].questions).toHaveLength(2)
    expect((groups[1].materialLayout!.objects[0] as { html: string }).html).toContain('另一段材料')
    groups.forEach((group) => {
      expect(group.material).toBeUndefined()
      group.questions.forEach((question) => {
        expect((question as { material?: string }).material).toBeUndefined()
      })
    })
  })

  it('normalizeModule：扁平 questions 迁移为 groups 并把材料转成画布', () => {
    const mod: Record<string, unknown> = {
      title: '模块',
      questions: [choice('<p>材料</p>', '第1题')]
    }
    normalizeModule(mod as never)
    expect(mod.questions).toBeUndefined()
    const groups = mod.groups as Array<Record<string, unknown>>
    expect(groups).toHaveLength(1)
    expect(groups[0].layout).toBe('stacked')
    expect(groups[0].material).toBeUndefined()
    const layout = groups[0].materialLayout as { objects: Array<{ html: string }> }
    expect(layout.objects[0].html).toContain('材料')
    expect(typeof groups[0]._k).toBe('string')
  })

  it('normalizeSections：没有节材料的扁平题按材料分组并生成画布', () => {
    const sections = normalizeSections([
      {
        title: '一、选择题',
        questions: [choice('<p>材料</p>', '第1题'), choice('<p>材料</p>', '第2题')]
      }
    ])
    expect(sections).toHaveLength(1)
    expect(sections[0].title).toBe('一、选择题')
    expect(sections[0].questions).toHaveLength(2)
    expect(sections[0].material).toBeUndefined()
    const layout = sections[0].materialLayout as { objects: Array<{ html: string }> }
    expect(layout.objects[0].html).toContain('材料')
  })
})

describe('编辑器数据模型 · 导出 v4', () => {
  it('只写 groups，不写扁平 questions，材料不复制到题目，剔除 _k', () => {
    const state: EditorState = {
      lesson: 'geo-demo',
      modules: {
        demo: {
          title: '示例模块',
          intro: '引导语',
          groups: [
            {
              _k: 'g-1',
              id: 'group-1',
              layout: 'split',
              material: '<p>组材料</p>',
              questions: [choice('<p>重复材料</p>', '第1题')]
            }
          ]
        }
      },
      postLesson: {
        title: '课后练习',
        subtitle: '',
        sections: [
          {
            _k: 's-1',
            id: 'p1',
            title: '一、选择题',
            layout: 'stacked',
            material: '<p>节材料</p>',
            questions: [choice('<p>重复材料</p>', '第1题')]
          }
        ]
      }
    }

    const payload = buildPracticeData(state) as Record<string, unknown>
    expect(payload.version).toBe(5)
    expect(payload.lesson).toBe('geo-demo')

    const mod = (payload.modules as Record<string, Record<string, unknown>>).demo
    expect(mod.questions).toBeUndefined()
    const group = (mod.groups as Array<Record<string, unknown>>)[0]
    expect(group.layout).toBe('split')
    expect(group.material).toBeUndefined()
    const groupLayout = group.materialLayout as { objects: Array<{ html: string }> }
    expect(groupLayout.objects[0].html).toContain('组材料')
    const exportedQuestions = group.questions as Array<Record<string, unknown>>
    expect(exportedQuestions[0].material).toBeUndefined()
    /* v4：题目必须有稳定 id，供题目对象引用 */
    expect(typeof exportedQuestions[0].id).toBe('string')
    expect(exportedQuestions[0].id).toBeTruthy()

    const post = payload.postLesson as Record<string, unknown>
    const section = (post.sections as Array<Record<string, unknown>>)[0]
    expect(section._k).toBeUndefined()
    expect(section.material).toBeUndefined()
    const sectionLayout = section.materialLayout as { objects: Array<{ html: string }> }
    expect(sectionLayout.objects[0].html).toContain('节材料')

    expect(JSON.stringify(payload)).not.toContain('_k')
    expect(JSON.stringify(payload)).not.toContain('重复材料')
    expect(JSON.stringify(payload)).not.toMatch(/"material"\s*:/)
  })

  it('有 materialLayout 时只导出画布，不再导出旧 material', () => {
    const state: EditorState = {
      lesson: 'geo-demo',
      modules: {
        demo: {
          groups: [
            {
              _k: 'g-1',
              layout: 'stacked',
              material: '<p>旧材料</p>',
              materialLayout,
              questions: [choice('', '第1题')]
            }
          ]
        }
      }
    }
    const group = ((buildPracticeData(state).modules as Record<string, { groups: Array<Record<string, unknown>> }>)
      .demo.groups[0])
    expect(group.material).toBeUndefined()
    expect(group.materialLayout).toEqual(materialLayout)
  })

  it('序列化为经典脚本，使用配置的全局变量名', () => {
    const text = serializePracticeData({ version: 3, modules: {} }, '__PRACTICE_DATA__')
    expect(text).toContain('window.__PRACTICE_DATA__ =')
    expect(text).not.toContain('fetch(')
  })

  it('geo01 实际题库已迁移到 v3：模块只写 groups，可按题组读取', () => {
    const source = readFileSync('lessons/geo01-earth-universe/public/quiz-editor/practice-data.js', 'utf8')
    const sandbox: { window: Record<string, unknown> } = { window: {} }
    runInNewContext(source, sandbox)
    const data = sandbox.window.__PRACTICE_DATA__ as {
      version: number
      modules: Record<string, Record<string, unknown>>
      postLesson: { sections: Array<Record<string, unknown>> }
    }
    expect(data.version).toBe(3)
    expect(JSON.stringify(data)).not.toMatch(/"material"\s*:/)
    Object.entries(data.modules).forEach(([id, mod]) => {
      expect(mod.questions, id).toBeUndefined()
      const checked = validateModulePractice(mod)
      expect(checked.issues, id).toHaveLength(0)
      ;((mod.groups as Array<Record<string, unknown>>) || []).forEach((group) => {
        const layout = group.materialLayout as { objects: unknown[] } | null
        if (layout) expect(layout.objects.length, id).toBeGreaterThan(0)
      })
    })
    data.postLesson.sections.forEach((section) => {
      expect(section.layout).toBe('stacked')
      const layout = section.materialLayout as { objects: unknown[] } | null
      if (layout) expect(layout.objects.length).toBeGreaterThan(0)
    })

    /* 题库允许为空模板（教师后续在编辑器里录入）；有题组时校验逐题模式的材料画布 */
    const groups = ((data.modules.meteor as { groups: never[] } | undefined)?.groups) || []
    if (groups.length) {
      const view = createPracticeView({ mode: 'step', groups })
      document.body.appendChild(view.root)
      expect(view.root.querySelector('.cq-step__material')).not.toBeNull()
      expect(view.root.querySelector('.cq-pane--material')).toBeNull()
      view.destroy()
    }
  })
})
