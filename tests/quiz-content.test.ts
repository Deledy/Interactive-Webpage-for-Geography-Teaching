import { describe, it, expect } from 'vitest'
import { sanitizeHtml, filterClass, filterStyle } from '../shared/quiz/content/sanitize'
import { renderInlineRich, renderRichText } from '../shared/quiz/content/richText'
import { renderQuestionCard, answerKeys, isChoiceCorrect, essayStems } from '../shared/quiz/content/renderCard'
import type { CqChoice, CqEssay } from '../shared/quiz/content/types'

describe('内容层 · HTML 白名单清洗', () => {
  it('剥除脚本与事件属性', () => {
    const html = sanitizeHtml('<p onclick="alert(1)">A</p><script>alert(2)</script><span onmouseover="x">B</span>')
    expect(html).not.toContain('script')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('onmouseover')
    expect(html).toContain('A')
    expect(html).toContain('B')
  })

  it('未知标签剥壳保留文字', () => {
    expect(sanitizeHtml('<marquee>内容</marquee>')).toBe('内容')
  })

  it('只保留 cq- 前缀类名', () => {
    expect(filterClass('cq-hl pw-hl foo cq-cols')).toBe('cq-hl cq-cols')
    expect(sanitizeHtml('<p class="pw-hl cq-p">x</p>')).toBe('<p class="cq-p">x</p>')
  })

  it('style 只保留宽度与对齐', () => {
    expect(filterStyle('width: 60%; color: red; text-align: center')).toBe('width: 60%; text-align: center')
    expect(sanitizeHtml('<p style="color:red;text-align:center">x</p>')).toBe('<p style="text-align:center">x</p>')
  })

  it('剥除危险协议，保留安全地址', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>')
    expect(sanitizeHtml('<img src="javascript:alert(1)">')).toBe('<img>')
    expect(sanitizeHtml('<a href="https://example.com">x</a>')).toContain('https://example.com')
    expect(sanitizeHtml('<img src="./a.png" alt="图">')).toContain('./a.png')
  })

  it('保留白名单结构标签与表格合并格', () => {
    const html = sanitizeHtml('<table><tr><td colspan="2">x</td></tr></table>')
    expect(html).toContain('<table>')
    expect(html).toContain('colspan="2"')
  })

  it('材料分栏：cq-cols / cq-col round-trip 不被剥除', () => {
    const html = sanitizeHtml(
      '<div class="cq-cols"><div class="cq-col">左</div><div class="cq-col"><strong>右</strong></div></div>'
    )
    expect(html).toBe(
      '<div class="cq-cols"><div class="cq-col">左</div><div class="cq-col"><strong>右</strong></div></div>'
    )
  })

  it('图片：保留 width 样式（SunEditor 缩放意图）', () => {
    const html = sanitizeHtml('<figure style="width: 300px"><img src="data:image/png;base64,AAA"></figure>')
    expect(html).toContain('width: 300px')
    expect(html).toContain('data:image/png')
  })
})

describe('内容层 · 内容渲染', () => {
  it('HTML 走白名单清洗，保留允许的标签与 cq- 类名', () => {
    expect(renderRichText('<p class="cq-p">材料 <strong>加粗</strong></p>')).toBe(
      '<p class="cq-p">材料 <strong>加粗</strong></p>'
    )
    expect(renderRichText('<p><mark class="cq-hl">关键词</mark></p>')).toContain(
      '<mark class="cq-hl">关键词</mark>'
    )
    expect(renderRichText('<script>alert(1)</script><p>x</p>')).toBe('<p>x</p>')
  })

  it('纯文本：转义并按空行分段，不解释 Markdown', () => {
    expect(renderRichText('第一段\n第二行\n\n第二段')).toBe(
      '<p class="cq-p">第一段<br>第二行</p><p class="cq-p">第二段</p>'
    )
    expect(renderRichText('**不是加粗**')).toBe('<p class="cq-p">**不是加粗**</p>')
    expect(renderRichText('a < b')).toBe('<p class="cq-p">a &lt; b</p>')
  })

  it('行内富文本：HTML 清洗，纯文本仅转义（不分段）', () => {
    expect(renderInlineRich('<mark class="cq-hl">高亮</mark>')).toBe('<mark class="cq-hl">高亮</mark>')
    expect(renderInlineRich('a < b')).toBe('a &lt; b')
    expect(renderInlineRich('普通文字')).toBe('普通文字')
  })

  it('空内容返回空字符串', () => {
    expect(renderRichText('')).toBe('')
    expect(renderRichText(undefined)).toBe('')
    expect(renderInlineRich('   ')).toBe('')
  })
})

describe('内容层 · 题目卡片渲染', () => {
  const choice: CqChoice = {
    type: 'choice',
    stem: '题干文字',
    material: '<p>材料 <mark class="cq-hl">高亮</mark></p>',
    options: [
      { key: 'A', text: '选项一' },
      { key: 'B', text: '选项二' }
    ],
    answer: 'A',
    analysis: '解析文本'
  }

  it('未作答：渲染题号、题型、材料、题干与选项，不显示判定', () => {
    const html = renderQuestionCard({
      question: choice,
      key: 'q-0',
      index: 2,
      state: { selected: [], submitted: false, revealed: false }
    })
    expect(html).toContain('data-q="q-0"')
    expect(html).toContain('<span class="cq-q__no">03</span>')
    expect(html).toContain('单选题')
    expect(html).toContain('<mark class="cq-hl">高亮</mark>')
    expect(html).toContain('题干文字')
    expect(html).toContain('data-cq-opt="q-0"')
    expect(html).not.toContain('cq-verdict')
  })

  it('单选已作答：显示正确判定与解析', () => {
    const html = renderQuestionCard({
      question: choice,
      key: 'q-0',
      index: 0,
      state: { selected: ['A'], submitted: true, revealed: false }
    })
    expect(html).toContain('cq-verdict is-right')
    expect(html).toContain('回答正确')
    expect(html).toContain('cq-opt is-correct')
    expect(html).toContain('解析')
  })

  it('多选未提交：出现提交按钮；提交后判定错误', () => {
    const multiple: CqChoice = {
      ...choice,
      mode: 'multiple',
      answer: ['B'],
      options: [
        { key: 'A', text: '选项一' },
        { key: 'B', text: '选项二' },
        { key: 'C', text: '选项三' }
      ]
    }
    const pending = renderQuestionCard({
      question: multiple,
      key: 'q-1',
      index: 0,
      state: { selected: ['A'], submitted: false, revealed: false }
    })
    expect(pending).toContain('data-cq-submit="q-1"')
    expect(pending).toContain('多选题')

    const wrong = renderQuestionCard({
      question: multiple,
      key: 'q-1',
      index: 0,
      state: { selected: ['A'], submitted: true, revealed: false }
    })
    expect(wrong).toContain('is-wrong')
    expect(wrong).toContain('is-dim')
  })

  it('综合题：设问列表与参考答案展开按钮', () => {
    const essay: CqEssay = {
      type: 'essay',
      material: '材料',
      stems: ['设问一', '设问二'],
      referenceAnswer: '参考答案',
      criteria: ['要点一', '要点二']
    }
    const collapsed = renderQuestionCard({
      question: essay,
      key: 'q-2',
      index: 0,
      state: { selected: [], submitted: false, revealed: false }
    })
    expect(collapsed).toContain('cq-stems')
    expect(collapsed).toContain('设问二')
    expect(collapsed).toContain('查看参考答案')
    expect(collapsed).not.toContain('参考答案</h4>')

    const opened = renderQuestionCard({
      question: essay,
      key: 'q-2',
      index: 0,
      state: { selected: [], submitted: false, revealed: true }
    })
    expect(opened).toContain('收起参考答案')
    expect(opened).toContain('参考答案</h4>')
    expect(opened).not.toContain('评分标准')
  })

  it('判定工具函数', () => {
    expect(answerKeys({ ...choice, answer: ['A', 'C'] })).toEqual(['A', 'C'])
    expect(isChoiceCorrect({ ...choice, mode: 'multiple', answer: ['A', 'C'] }, ['C', 'A'])).toBe(true)
    expect(isChoiceCorrect({ ...choice, answer: 'A' }, ['B'])).toBe(false)
    expect(essayStems({ type: 'essay', stems: '单条' })).toEqual(['单条'])
    expect(essayStems({ type: 'essay' })).toEqual([])
  })
})
