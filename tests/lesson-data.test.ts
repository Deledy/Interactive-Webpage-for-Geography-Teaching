/* ============================================================
   课程数据完整性测试（lessonData.ts）
   校验迁移后数据结构与内容完整性，作为"数据驱动"的基线保障。
   ============================================================ */
import { describe, it, expect } from 'vitest'
import { lessonData } from '../lessons/geo01-earth-universe/src/data/lessonData'

describe('lessonData 数据完整性', () => {
  it('元信息完整', () => {
    expect(lessonData.meta.title).toBe('地球的宇宙环境')
    expect(lessonData.meta.grade).toContain('高中必修一')
    expect(lessonData.meta.lesson).toContain('40分钟')
  })

  it('M1 宇宙概念：4 级放大层级，顺序正确', () => {
    expect(lessonData.universe.scaleLevels.map(l => l.name)).toEqual([
      '地球', '太阳系', '银河系', '可观测宇宙'
    ])
  })

  it('M3 流星案例：3 步 + 3 条件 + 结论', () => {
    expect(lessonData.meteorCase.steps).toHaveLength(3)
    expect(lessonData.meteorCase.conditions).toHaveLength(3)
    expect(lessonData.meteorCase.conditions.map(c => c.key)).toEqual([
      '是物质', '大气层之外', '独立个体'
    ])
    expect(lessonData.meteorCase.conclusion).toContain('不是天体')
  })

  it('M4 拖拽分类：9 张案例卡，天体/非天体比例正确', () => {
    expect(lessonData.dragCards).toHaveLength(9)
    const celestial = lessonData.dragCards.filter(c => c.type === 'celestial')
    const non = lessonData.dragCards.filter(c => c.type === 'non')
    expect(celestial).toHaveLength(6)
    expect(non).toHaveLength(3)
    lessonData.dragCards.forEach(c => {
      expect(c.id && c.name && c.explain).toBeTruthy()
    })
  })

  it('M5 天体系统层级：4 级由内到外', () => {
    expect(lessonData.hierarchy.map(h => h.name)).toEqual([
      '地月系', '太阳系', '银河系', '可观测宇宙'
    ])
    lessonData.hierarchy.forEach(h => {
      expect(h.content && h.example).toBeTruthy()
    })
  })

  it('M6 八大行星：8 颗，顺序与字段完整', () => {
    expect(lessonData.planets).toHaveLength(8)
    expect(lessonData.planets.map(p => p.name)).toEqual([
      '水星', '金星', '地球', '火星', '木星', '土星', '天王星', '海王星'
    ])
    lessonData.planets.forEach(p => {
      expect(p.color).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(p.size).toBeGreaterThan(0)
      expect(p.orbit).toBeGreaterThan(0)
      expect(p.period).toBeGreaterThan(0)
      expect(p.type && p.desc).toBeTruthy()
    })
  })

  it('M7 行星分类：3 类 + 3 三性', () => {
    expect(lessonData.planetCategories).toHaveLength(3)
    expect(lessonData.motionFeatures.map(f => f.name)).toEqual(['同向性', '近圆性', '共面性'])
  })

  it('M8 生命条件：外部 2 条 + 内部 3 条因果链', () => {
    expect(lessonData.lifeConditions.external).toHaveLength(2)
    expect(lessonData.lifeConditions.internal).toHaveLength(3)
    expect(lessonData.lifeConditions.conclusion).toContain('唯一适宜生命存在')
  })

  it('M9 复习结构树：根节点为宇宙且含嵌套子节点', () => {
    const root = lessonData.review.nodes[0]
    expect(root.name).toBe('宇宙')
    expect(root.children).toBeTruthy()
    expect(root.children!.length).toBeGreaterThan(0)
  })

  it('M10 拓展材料：M1/M2/M5/M6/M8 有内容', () => {
    for (const key of ['M1', 'M2', 'M5', 'M6', 'M8']) {
      expect(lessonData.extends[key]).toBeTruthy()
      expect(lessonData.extends[key].content.length).toBeGreaterThan(0)
    }
  })

  it('随堂练习：8 个模块入口，M3 为拖拽型，其余选择题答案下标合法', () => {
    const keys = Object.keys(lessonData.practices)
    expect(keys).toEqual(['M1', 'M2', 'M3', 'M5', 'M6', 'M7', 'M8', 'M9'])
    for (const key of keys) {
      const item = lessonData.practices[key]
      expect(item.title).toBeTruthy()
      if (item.type === 'drag') {
        expect(key).toBe('M3')
      } else {
        item.questions.forEach(q => {
          expect(q.answer).toBeGreaterThanOrEqual(0)
          expect(q.answer).toBeLessThan(q.options.length)
          expect(q.q && q.explain).toBeTruthy()
        })
      }
    }
  })
})
