import { describe, it, expect } from 'vitest'
import { validateMaterialLayout } from '../shared/quiz/content/validateMaterial'
import { renderMaterialLayout } from '../shared/quiz/content/renderMaterial'
import { materialLayoutFromHtml } from '../shared/quiz/content/materialConvert'
import type { MaterialLayout } from '../shared/quiz/content/materialTypes'

function layout(): MaterialLayout {
  return {
    version: 1,
    width: 1000,
    height: 520,
    background: '#ffffff',
    objects: [
      {
        id: 'text-1',
        type: 'text',
        x: 20,
        y: 20,
        width: 600,
        height: 120,
        html: '<p>材料文字</p><script>alert(1)</script>',
        style: { fontSize: 22, lineHeight: 1.7, textAlign: 'left' }
      },
      {
        id: 'table-1',
        type: 'table',
        x: 20,
        y: 160,
        width: 600,
        height: 200,
        html: '<table><tr><td onclick="x">单元格</td></tr></table>'
      },
      {
        id: 'image-1',
        type: 'image',
        x: 640,
        y: 160,
        width: 320,
        height: 240,
        src: 'data:image/png;base64,AAAA',
        alt: '示意图',
        objectFit: 'contain',
        lockAspectRatio: true
      }
    ]
  }
}

describe('材料画布 · 校验', () => {
  it('清洗文字 / 表格 HTML 并保留安全图片', () => {
    const checked = validateMaterialLayout(layout())
    expect(checked.layout).not.toBeNull()
    expect(checked.layout!.objects).toHaveLength(3)
    const text = checked.layout!.objects[0]
    expect(text.type).toBe('text')
    expect((text as { html: string }).html).toContain('材料文字')
    expect((text as { html: string }).html).not.toContain('script')
    const table = checked.layout!.objects[1]
    expect((table as { html: string }).html).toContain('<table>')
    expect((table as { html: string }).html).not.toContain('onclick')
    const image = checked.layout!.objects[2]
    expect((image as { src: string }).src).toContain('data:image/png')
  })

  it('拒绝本地绝对路径图片与非法版本', () => {
    const bad = layout()
    ;(bad.objects[2] as { src: string }).src = 'C:\\Users\\Teacher\\Desktop\\map.png'
    const checked = validateMaterialLayout(bad)
    expect(checked.layout!.objects).toHaveLength(2)
    expect(checked.issues.some((issue) => issue.includes('图片地址'))).toBe(true)

    expect(validateMaterialLayout({ version: 2, width: 1000, height: 520, objects: [] }).layout).toBeNull()
    expect(validateMaterialLayout({ version: 1, width: 0, height: 520, objects: [] }).layout).toBeNull()
  })

  it('重复 id 自动重命名，坐标收敛到画布内', () => {
    const raw = layout()
    raw.objects[1].id = 'text-1'
    raw.objects[0].x = 2000
    raw.objects[0].width = 500
    const checked = validateMaterialLayout(raw)
    const ids = checked.layout!.objects.map((object) => object.id)
    expect(new Set(ids).size).toBe(ids.length)
    const first = checked.layout!.objects[0]
    expect(first.x).toBeGreaterThanOrEqual(0)
    expect(first.x + first.width).toBeLessThanOrEqual(1000)
  })

  it('缺少有效内容的文字对象被跳过', () => {
    const raw = layout()
    ;(raw.objects[0] as { html: string }).html = '<p> </p>'
    const checked = validateMaterialLayout(raw)
    expect(checked.layout!.objects.some((object) => object.type === 'text')).toBe(false)
    expect(checked.issues.some((issue) => issue.includes('缺少文字内容'))).toBe(true)
  })
})

describe('材料画布 · 渲染', () => {
  it('view 模式渲染文字、表格、图片，且没有编辑手柄', () => {
    const root = renderMaterialLayout(layout(), { mode: 'view' })
    expect(root.classList.contains('cq-material')).toBe(true)
    expect(root.querySelectorAll('.cq-material__object').length).toBe(3)
    expect(root.querySelector('.cq-material__object--text')?.textContent).toContain('材料文字')
    expect(root.querySelector('.cq-material__object--table table')).not.toBeNull()
    expect(root.querySelector('.cq-material__object--image img')?.getAttribute('src')).toContain('data:image/png')
    expect(root.querySelectorAll('.cq-material__handle').length).toBe(0)

    const text = root.querySelector<HTMLElement>('.cq-material__object--text')!
    expect(text.style.left).toBe('20px')
    expect(text.style.width).toBe('600px')
  })

  it('edit 模式：选中对象显示四角手柄', () => {
    const root = renderMaterialLayout(layout(), { mode: 'edit', selectedId: 'text-1' })
    const selected = root.querySelector('.cq-material__object.is-selected')
    expect(selected).not.toBeNull()
    expect(selected!.querySelectorAll('.cq-material__handle').length).toBe(4)
  })

  it('无布局信息时按 1 倍渲染，不报错', () => {
    const root = renderMaterialLayout(layout())
    const canvas = root.querySelector<HTMLElement>('.cq-material__canvas')!
    expect(canvas.style.transform).toBe('scale(1)')
    const viewport = root.querySelector<HTMLElement>('.cq-material__viewport')!
    expect(viewport.style.height).toBe('520px')
  })
})

describe('材料画布 · 旧 HTML 迁移', () => {
  it('旧 HTML 材料转成单个文字对象，并按文本量估算高度', () => {
    const converted = materialLayoutFromHtml('<p>材料 <strong>加粗</strong></p>')
    expect(converted.objects).toHaveLength(1)
    expect(converted.objects[0].type).toBe('text')
    expect((converted.objects[0] as { html: string }).html).toContain('加粗')
    /* 画布统一到默认高度；文字对象按文本量估算，不撑满画布 */
    expect(converted.height).toBe(700)
    expect(converted.objects[0].height).toBe(72)
  })

  it('空材料返回空画布，不写入占位文本', () => {
    const converted = materialLayoutFromHtml('')
    expect(converted.objects).toHaveLength(0)
  })
})
