/* ============================================================
   编辑器 · 画布 + 题目槽
   ------------------------------------------------------------
   一题组一张画布（第四轮模型，见 docs/2026-10-31 第四轮文档）：
   - 画布只放材料（文字 / 图片 / 表格）与唯一题目槽；
   - 槽内只显示“当前题”，槽顶部「上一题 / 下一题」切换，画布不动；
   - 插入题目 = 向题库追加一道并切到该题，不会新增画布对象；
   - 属性栏随选中对象切换：选中槽 = 编辑当前题（子题 / 题型 / 选项 / 答案 / 解析）。
   ============================================================ */
import {
  createEmptyMaterialLayout,
  MATERIAL_LIMITS
} from '../../content/materialTypes'
import { renderMaterialLayout } from '../../content/renderMaterial'
import { renderQuestionObject } from '../../content/renderQuestionObject'
import { sanitizeHtml } from '../../content/sanitize'
import {
  convertQuestionKind,
  duplicateQuestion,
  ensureSlot,
  nextQuestionId,
  pruneSlots,
  slotObject,
  slotWidth
} from '../../content/questionObjects'

const TEXT = {
  undo: '撤销',
  redo: '重做',
  addText: '+ 文字',
  addImage: '+ 图片',
  addTable: '+ 表格',
  insertQuestion: '+ 插入题目',
  previewAnswers: '预览作答',
  bold: '加粗',
  italic: '斜体',
  underline: '下划线',
  strike: '删除线',
  up: '上移一层',
  down: '下移一层',
  top: '置顶',
  bottom: '置底',
  left: '左对齐',
  center: '水平居中',
  right: '右对齐',
  duplicate: '复制',
  remove: '删除',
  zoom: '缩放',
  hint: '画布就是卷面：材料随意摆，题目槽放题目；槽内「上一题 / 下一题」切换本题组的题，画布不变。'
}

const TEXT_COLORS = ['#1b1d19', '#c9402f', '#1f6a9c', '#157f4a', '#5c6058']
const TEXT_PLACEHOLDER = '在此输入材料…'

const EMPTY_STATE = { selected: [], submitted: false, revealed: false }

let seq = 0
function nextId(prefix) {
  seq += 1
  return prefix + '-' + Date.now().toString(36) + '-' + seq.toString(36)
}

function num(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function attr(value) {
  return esc(value).replace(/"/g, '&quot;')
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function tableHtml(rows, cols) {
  const head = '<tr>' + Array.from({ length: cols }, (_, i) => '<th>列' + (i + 1) + '</th>').join('') + '</tr>'
  const body = Array.from({ length: rows }, () =>
    '<tr>' + Array.from({ length: cols }, () => '<td>内容</td>').join('') + '</tr>'
  ).join('')
  return '<table><thead>' + head + '</thead><tbody>' + body + '</tbody></table>'
}

function caretToEnd(element) {
  if (!element) return
  element.focus()
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  const selection = window.getSelection && window.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  selection.addRange(range)
}

/** 剪贴板 HTML 清洗：先取出 body 内容，避免整份 Word 文档外壳跳过白名单清洗 */
function sanitizeClipboardHtml(html) {
  const holder = document.createElement('div')
  holder.innerHTML = String(html || '')
  const body = holder.querySelector('body')
  return sanitizeHtml((body || holder).innerHTML)
}

/** HTML → 纯文本（属性栏展示用） */
function htmlToText(value) {
  const text = String(value || '')
  if (!text) return ''
  if (!/[<>]/.test(text)) return text
  const holder = document.createElement('div')
  holder.innerHTML = text
  return plainText(holder)
}

/** 纯文本 → 规范 HTML（换行转 <br>，特殊字符转义） */
function plainToHtml(value) {
  return esc(String(value || '')).replace(/\r?\n/g, '<br>')
}

function plainText(element) {
  if (!element) return ''
  /* 保留换行：br / 块级元素转成 \n，避免题干多行被压成一行 */
  const clone = element.cloneNode(true)
  clone.querySelectorAll('br').forEach(function (br) { br.replaceWith('\n') })
  clone.querySelectorAll('div,p,li').forEach(function (node) {
    node.appendChild(document.createTextNode('\n'))
  })
  return String(clone.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '')
}

/**
 * 创建画布编辑器。
 * @param {{ mount: HTMLElement, group: any, createQuestion?: Function,
 *           confirm?: (message: string, onConfirm: Function) => void,
 *           onChange?: Function, onSelect?: Function }} options
 */
export function createMaterialEditor(options) {
  const mount = options.mount
  const group = options.group
  const notifyOuter = options.onChange || function () {}
  const notifySelect = options.onSelect || function () {}

  if (!group.materialLayout) group.materialLayout = createEmptyMaterialLayout()
  if (!Array.isArray(group.questions)) group.questions = []
  group.materialLayout = pruneSlots(group.materialLayout).layout
  group.materialLayout = ensureSlot(group.materialLayout, group.questions.length > 0, group.questions[0]).layout
  let layout = group.materialLayout

  const state = {
    selectedId: null,
    zoom: 'fit',
    clipboard: null,
    replaceId: null,
    /** 组内当前题（槽内显示哪一题） */
    activeIndex: 0,
    previewAnswers: false,
    /** 预览作答状态：questionId → { selected, submitted, revealed } */
    answers: {},
    activeOptionKey: null,
    answerOpen: false,
    analysisOpen: false,
    /** 槽内内容是否超出画布（固定画布下只提示，不再自动长高） */
    overflow: false
  }
  const history = { past: [], future: [] }
  let destroyed = false
  let notifyTimer = null
  /** 是否处于前台：多个题组实例共用同一个外部属性栏时，只有前台实例可以写属性栏 */
  let isActive = true

  mount.innerHTML = ''
  const root = document.createElement('div')
  root.className = 'ce-mat-root'
  root.innerHTML =
    '<div class="ce-mat-toolbar">' +
      '<div class="ce-mat-toolbar__group">' +
        '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="undo" title="' + TEXT.undo + '">↶</button>' +
        '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="redo" title="' + TEXT.redo + '">↷</button>' +
      '</div>' +
      '<div class="ce-mat-toolbar__group">' +
        '<button class="ce-btn ce-btn--sm" type="button" data-mat="add-text">' + TEXT.addText + '</button>' +
        '<button class="ce-btn ce-btn--sm" type="button" data-mat="add-image">' + TEXT.addImage + '</button>' +
        '<button class="ce-btn ce-btn--sm" type="button" data-mat="add-table">' + TEXT.addTable + '</button>' +
      '</div>' +
      '<div class="ce-mat-toolbar__group">' +
        '<button class="ce-btn ce-btn--sm ce-btn--primary" type="button" data-mat="insert-question">' + TEXT.insertQuestion + '</button>' +
      '</div>' +
      '<div class="ce-mat-toolbar__group ce-mat-toolbar__text">' +
        '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="bold" title="' + TEXT.bold + '"><b>B</b></button>' +
        '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="italic" title="' + TEXT.italic + '"><i>I</i></button>' +
        '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="underline" title="' + TEXT.underline + '"><u>U</u></button>' +
        '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="strike" title="' + TEXT.strike + '"><s>S</s></button>' +
      '</div>' +
      '<div class="ce-mat-toolbar__group">' +
        '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="left" title="' + TEXT.left + '">⇤</button>' +
        '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="center" title="' + TEXT.center + '">↔</button>' +
        '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="right" title="' + TEXT.right + '">⇥</button>' +
      '</div>' +
      '<div class="ce-mat-toolbar__group">' +
        '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="up" title="' + TEXT.up + '">上移</button>' +
        '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="down" title="' + TEXT.down + '">下移</button>' +
        '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="top" title="' + TEXT.top + '">置顶</button>' +
        '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="bottom" title="' + TEXT.bottom + '">置底</button>' +
      '</div>' +
      '<span class="ce-mat-toolbar__grow"></span>' +
      '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="preview" aria-pressed="false" title="' + TEXT.previewAnswers + '">' + TEXT.previewAnswers + '</button>' +
      '<label class="ce-mat-toolbar__zoom">' + TEXT.zoom +
        '<select class="ce-input ce-input--sm" data-mat-zoom>' +
          '<option value="fit">适宽</option>' +
          '<option value="0.5">50%</option>' +
          '<option value="0.75">75%</option>' +
          '<option value="1">100%</option>' +
        '</select>' +
      '</label>' +
      '<div class="ce-mat-toolbar__group ce-mat-toolbar__colors">' +
        '<span class="ce-mat-toolbar__zoom">字色</span>' +
        TEXT_COLORS.map(function (color) {
          return '<button class="ce-mat-color" type="button" data-mat="text-color" data-color="' + color +
            '" title="' + color + '" aria-label="字色 ' + color + '" style="--swatch:' + color + '"></button>'
        }).join('') +
      '</div>' +
    '</div>' +
    '<div class="ce-mat-main">' +
      '<div class="ce-mat-canvas" tabindex="0"></div>' +
      (options.propsHost ? '' : '<div class="ce-mat-props"></div>') +
    '</div>' +
    '<p class="ce-mat-hint">' + TEXT.hint + '</p>' +
    '<input class="ce-mat-file" type="file" accept="image/*" hidden>'
  mount.appendChild(root)

  const canvasHost = root.querySelector('.ce-mat-canvas')
  const propsHost = options.propsHost || root.querySelector('.ce-mat-props')
  const fileInput = root.querySelector('.ce-mat-file')

  function findObject(id) {
    return layout.objects.find((object) => object.id === id) || null
  }

  function selected() {
    return state.selectedId ? findObject(state.selectedId) : null
  }

  function slot() {
    return slotObject(layout)
  }

  function questions() {
    return group.questions || []
  }

  /** 当前编辑题与它在组内的序号 */
  function active() {
    const list = questions()
    if (!list.length) return null
    const index = clamp(state.activeIndex, 0, list.length - 1)
    state.activeIndex = index
    return { question: list[index], index: index }
  }

  function questionById(questionId) {
    return questions().find((question) => question.id === questionId) || null
  }

  function answerState(questionId) {
    if (!state.answers[questionId]) {
      state.answers[questionId] = { selected: [], submitted: false, revealed: false }
    }
    return state.answers[questionId]
  }

  /* ---------------- 撤销（画布 + 题目 + 当前题） ---------------- */

  function snapshot() {
    return JSON.stringify({ layout: layout, questions: questions(), activeIndex: state.activeIndex })
  }

  function updateHistoryButtons() {
    const undo = root.querySelector('[data-mat="undo"]')
    const redo = root.querySelector('[data-mat="redo"]')
    if (undo) undo.disabled = history.past.length === 0
    if (redo) redo.disabled = history.future.length === 0
  }

  function pushHistory() {
    history.past.push(snapshot())
    if (history.past.length > 50) history.past.shift()
    history.future = []
    updateHistoryButtons()
  }

  function restore(raw) {
    const parsed = JSON.parse(raw)
    setLayout(parsed.layout)
    group.questions = Array.isArray(parsed.questions) ? parsed.questions : []
    state.activeIndex = Number.isFinite(parsed.activeIndex) ? parsed.activeIndex : 0
    state.selectedId = null
    state.activeOptionKey = null
    state.answerOpen = false
    state.analysisOpen = false
  }

  function setLayout(next) {
    group.materialLayout = next
    layout = next
  }

  function notify() {
    if (destroyed) return
    clearTimeout(notifyTimer)
    notifyTimer = null
    notifyOuter()
  }

  function scheduleNotify() {
    if (destroyed) return
    clearTimeout(notifyTimer)
    notifyTimer = setTimeout(function () {
      notifyTimer = null
      notifyOuter()
    }, 400)
  }

  /* ---------------- 槽内容 ---------------- */

  /** 槽顶部切题条 + 当前题题块 */
  function buildSlotContent() {
    const list = questions()
    const current = active()
    if (!current) return null

    const wrap = document.createElement('div')
    wrap.className = 'ce-slot-content'

    const bar = document.createElement('div')
    bar.className = 'ce-slot-bar'
    bar.innerHTML =
      '<button class="ce-slot-nav" type="button" data-qnav="prev"' + (current.index > 0 ? '' : ' disabled') + '>上一题</button>' +
      '<span class="ce-slot-count">第 ' + (current.index + 1) + ' / ' + list.length + ' 题</span>' +
      '<button class="ce-slot-nav" type="button" data-qnav="next"' +
        (current.index < list.length - 1 ? '' : ' disabled') + '>下一题</button>'
    wrap.appendChild(bar)

    wrap.appendChild(
      renderQuestionObject({
        question: current.question,
        index: current.index,
        mode: state.previewAnswers ? 'view' : 'edit',
        state: state.previewAnswers ? answerState(current.question.id) : EMPTY_STATE,
        key: state.previewAnswers ? current.question.id : undefined,
        optionLayout: slot() ? slot().optionLayout : undefined,
        editState: {
          activeOptionKey: state.activeOptionKey,
          answerOpen: state.answerOpen,
          analysisOpen: state.analysisOpen
        }
      })
    )
    return wrap
  }

  /* ---------------- 画布渲染 ---------------- */

  function renderCanvas() {
    if (destroyed) return
    canvasHost.innerHTML = ''
    if (!layout) return
    canvasHost.appendChild(
      renderMaterialLayout(layout, {
        mode: 'edit',
        selectedId: state.selectedId,
        zoom: state.zoom,
        slotContent: buildSlotContent(),
        slotPlaceholder: '还没有题目，点击「+ 插入题目」',
        textPlaceholder: TEXT_PLACEHOLDER,
        onObjectSelect: function (id) {
          /* 只在真正换了选中对象时清空编辑态；同一对象内的点击（如折叠解析）
             不能重置展开状态，否则按钮会被“点了又开” */
          const changed = state.selectedId !== id
          state.selectedId = id
          if (changed) {
            state.activeOptionKey = null
            state.answerOpen = false
            state.analysisOpen = false
          }
          notifySelect(id)
          renderProps()
        },
        onObjectBegin: function () {
          pushHistory()
        },
        onObjectChange: function (id, patch) {
          const object = findObject(id)
          if (object) Object.assign(object, patch)
        },
        onObjectCommit: function (id, patch) {
          const object = findObject(id)
          if (object) Object.assign(object, patch)
          notify()
          renderProps()
        }
      })
    )
    if (!layout.objects.some((object) => object.type === 'slot')) {
      const hint = document.createElement('p')
      hint.className = 'ce-mat-empty'
      hint.textContent = '点击上方「+ 插入题目」开始；材料用「+ 文字 / + 图片 / + 表格」加入画布。'
      canvasHost.appendChild(hint)
    }
    checkOverflow()
  }

  /** 画布与题目槽尺寸全部锁死：内容变化只做溢出检测，不再自动长高 */
  function growBlock() {
    checkOverflow()
  }

  /** 固定画布：槽高按内容自动贴合（上限为画布底边），只有真的放不下才提示 */
  function checkOverflow() {
    let overflow = false
    let grew = false
    layout.objects.forEach(function (object) {
      if (object.type !== 'slot') return
      const slotEl = canvasHost.querySelector('[data-material-object-id="' + object.id + '"]')
      if (!slotEl) return
      const box = slotEl.querySelector('.ce-slot-content') || slotEl
      const available = Math.max(MATERIAL_LIMITS.minObjectSize, layout.height - object.y)
      const need = Math.ceil(box.scrollHeight)
      if (need > object.height + 2 && object.height < available) {
        const next = Math.min(need, available)
        object.height = next
        slotEl.style.height = next + 'px'
        grew = true
      }
      const over = need > object.height + 2 || object.y + object.height > layout.height + 2
      slotEl.classList.toggle('is-overflow', over)
      if (over) overflow = true
    })
    if (state.overflow !== overflow) state.overflow = overflow
    canvasHost.classList.toggle('has-overflow', overflow)
    if (grew) scheduleNotify()
  }

  /** 画布内就地编辑：写回当前题 + 自适应高度 + 同步属性栏输入值 */
  function writeCanvasField(target) {
    const field = target.getAttribute('data-edit')
    const questionRoot = target.closest('.cq-qobj')
    const current = active()
    if (!field || !current) return
    const question = current.question

    if (field === 'stem') {
      question.stem = sanitizeHtml(target.innerHTML)
      syncPropInput('stem', plainText(target))
    } else if (field === 'stem-item') {
      const index = Number(target.getAttribute('data-index'))
      const stems = Array.isArray(question.stems) ? question.stems.slice() : (question.stems ? [question.stems] : [])
      stems[index] = sanitizeHtml(target.innerHTML)
      question.stems = stems
    } else if (field === 'option') {
      const key = target.getAttribute('data-key')
      const option = (question.options || []).find((item) => item.key === key)
      if (option) {
        option.text = sanitizeHtml(target.innerHTML)
        syncPropInput('option:' + question.options.indexOf(option), plainText(target))
      }
    } else if (field === 'answer') {
      question.referenceAnswer = sanitizeHtml(target.innerHTML)
      syncPropInput('referenceAnswer', plainText(target))
    } else if (field === 'analysis') {
      question.analysis = sanitizeHtml(target.innerHTML)
      syncPropInput('analysis', plainText(target))
    }
    if (questionRoot) growBlock(questionRoot)
    scheduleNotify()
  }

  function syncPropInput(name, value) {
    const selector = name.indexOf('option:') === 0
      ? '[data-qopt="' + name.slice('option:'.length) + '"]'
      : '[data-qprop="' + name + '"]'
    const field = propsHost.querySelector(selector)
    if (!field || document.activeElement === field) return
    if ('value' in field) field.value = value
  }

  /* ---------------- 属性栏 ---------------- */

  function slotLayoutRows(object) {
    const half = object.width < layout.width - 80
    return '<div class="ce-mat-props__row">' +
        '<label>X<input class="ce-input ce-input--sm" type="number" data-prop="x" value="' + object.x + '"></label>' +
        '<label>Y<input class="ce-input ce-input--sm" type="number" data-prop="y" value="' + object.y + '"></label>' +
        '<label>宽<input class="ce-input ce-input--sm" type="number" data-prop="width" min="' + MATERIAL_LIMITS.minObjectSize + '" value="' + object.width + '"></label>' +
        '<label>高<input class="ce-input ce-input--sm" type="number" data-prop="height" min="' + MATERIAL_LIMITS.minObjectSize + '" value="' + object.height + '"></label>' +
      '</div>' +
      '<div class="ce-mat-props__row"><span class="ce-mat-props__label">槽宽</span>' +
        '<button class="ce-btn ce-btn--sm' + (half ? '' : ' is-active') + '" type="button" data-mat="width-full">整宽</button>' +
        '<button class="ce-btn ce-btn--sm' + (half ? ' is-active' : '') + '" type="button" data-mat="width-half">1/2 宽</button>' +
      '</div>'
  }

  function subQuestionRows() {
    const list = questions()
    const current = active()
    return '<div class="ce-mat-props__group">' +
        '<span class="ce-mat-props__group-title">子题目</span>' +
        '<div class="ce-mat-props__chips">' +
          list.map(function (question, index) {
            return '<button class="ce-chip' + (current && current.index === index ? ' is-active' : '') +
              '" type="button" data-qsub="' + index + '">第 ' + (index + 1) + ' 题</button>'
          }).join('') +
          '<button class="ce-chip ce-chip--add" type="button" data-mat="add-subquestion">＋ 新增题</button>' +
          (list.length ? '<button class="ce-chip" type="button" data-mat="dup-subquestion">复制当前</button>' : '') +
          (list.length > 1 ? '<button class="ce-chip ce-chip--danger" type="button" data-mat="del-subquestion">删除当前</button>' : '') +
        '</div>' +
      '</div>'
  }

  function questionTypeRows(question) {
    return '<div class="ce-mat-props__group">' +
        '<span class="ce-mat-props__group-title">题型</span>' +
        '<div class="ce-mat-props__row">' +
          '<select class="ce-input ce-input--sm" data-qprop="type">' +
            '<option value="choice"' + (question.type === 'choice' ? ' selected' : '') + '>选择题</option>' +
            '<option value="essay"' + (question.type === 'essay' ? ' selected' : '') + '>主观题</option>' +
          '</select>' +
        '</div>' +
      '</div>'
  }

  function choiceRows(question) {
    const answer = Array.isArray(question.answer) ? question.answer : [question.answer]
    const rows = (question.options || []).map(function (option, index) {
      return '<div class="ce-mat-props__qopt' + (state.activeOptionKey === option.key ? ' is-active' : '') +
          '" data-qopt-row="' + attr(option.key) + '">' +
          '<span class="ce-mat-props__qkey">' + esc(option.key) + '</span>' +
          '<input class="ce-input" type="text" data-qopt="' + index + '" value="' + attr(htmlToText(option.text)) + '" placeholder="选项内容">' +
          '<label class="ce-mat-props__check" title="设为正确答案"><input type="radio" name="qans-slot"' +
            ' data-qanswer value="' + attr(option.key) + '"' +
            (answer.indexOf(option.key) >= 0 ? ' checked' : '') + '>正确</label>' +
          '<button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="del-option" data-oi="' + index +
            '" title="删除选项">×</button>' +
        '</div>'
    }).join('')
    return '<div class="ce-mat-props__group">' +
        '<span class="ce-mat-props__group-title">题干与选项</span>' +
        '<textarea class="ce-textarea" rows="2" data-qprop="stem" placeholder="题干">' + esc(htmlToText(question.stem)) + '</textarea>' +
        '<div class="ce-mat-props__qopts">' + rows + '</div>' +
        '<div class="ce-mat-props__row">' +
          '<button class="ce-btn ce-btn--sm" type="button" data-mat="add-option">＋ 新增选项</button>' +
          '<label>排列<select class="ce-input ce-input--sm" data-qprop="columns">' +
            [['1', '1 列'], ['2', '2 列'], ['3', '3 列']].map(function (item) {
              const columns = String((slot() && slot().optionLayout ? slot().optionLayout.columns : 2) || 2)
              return '<option value="' + item[0] + '"' + (columns === item[0] ? ' selected' : '') + '>' + item[1] + '</option>'
            }).join('') +
          '</select></label>' +
        '</div>' +
      '</div>'
  }

  function essayRows(question) {
    const stems = Array.isArray(question.stems) ? question.stems : (question.stems ? [question.stems] : [])
    return '<div class="ce-mat-props__group">' +
        '<span class="ce-mat-props__group-title">设问与参考答案</span>' +
        '<textarea class="ce-textarea" rows="3" data-qprop="stems" placeholder="每行一条设问">' + esc(stems.map(htmlToText).join('\n')) + '</textarea>' +
        '<textarea class="ce-textarea" rows="4" data-qprop="referenceAnswer" placeholder="参考答案（可直接写 HTML）">' +
          esc(question.referenceAnswer || '') +
        '</textarea>' +
      '</div>'
  }

  function analysisRows(question) {
    return '<div class="ce-mat-props__group">' +
        '<span class="ce-mat-props__group-title">解析</span>' +
        '<textarea class="ce-textarea" rows="3" data-qprop="analysis" placeholder="解析内容（判定后展示）">' +
          esc(question.analysis || '') +
        '</textarea>' +
      '</div>' +
      (questions().length > 1
        ? '<div class="ce-mat-props__row"><button class="ce-btn ce-btn--ghost ce-btn--sm" type="button" data-mat="del-subquestion">删除这道题</button></div>'
        : '')
  }

  function questionRows() {
    const current = active()
    if (!current) {
      return '<div class="ce-mat-props__group"><p class="ce-mat-hint">题组还没有题目，点击工具条「+ 插入题目」。</p></div>'
    }
    const question = current.question
    return subQuestionRows() +
      questionTypeRows(question) +
      (question.type === 'choice' ? choiceRows(question) : essayRows(question)) +
      analysisRows(question)
  }

  /** 未选中任何对象时：编辑画布自身（宽 / 高 / 背景） */
  function canvasRows() {
    const background = layout.background || '#ffffff'
    return '<div class="ce-mat-props__group">' +
        '<span class="ce-mat-props__group-title">画布</span>' +
        '<div class="ce-mat-props__row">' +
          '<label>宽<input class="ce-input ce-input--sm" type="number" data-canvas="width" min="320" max="' + MATERIAL_LIMITS.maxWidth + '" value="' + layout.width + '"></label>' +
          '<label>高<input class="ce-input ce-input--sm" type="number" data-canvas="height" min="200" max="' + MATERIAL_LIMITS.maxHeight + '" value="' + layout.height + '"></label>' +
          '<label>背景<input class="ce-input ce-input--color" type="color" data-canvas="background" value="' + attr(background) + '"></label>' +
        '</div>' +
        '<p class="ce-mat-hint">选中画布里的文字、图片、表格或题目槽，可在这里编辑它的属性。</p>' +
      '</div>'
  }

  function renderProps() {
    if (destroyed || !isActive) return
    propsHost.innerHTML = ''
    const warning = state.overflow
      ? '<p class="ce-mat-warn">内容已超出画布，超出的部分在课程中会被裁切，请精简内容或调整题目槽。</p>'
      : ''
    const object = selected()
    if (!object) {
      propsHost.innerHTML = warning + canvasRows()
      return
    }
    const rows = []

    if (object.type === 'slot') {
      rows.push(slotLayoutRows(object), questionRows())
    } else {
      rows.push(
        '<div class="ce-mat-props__row">' +
          '<label>X<input class="ce-input ce-input--sm" type="number" data-prop="x" value="' + object.x + '"></label>' +
          '<label>Y<input class="ce-input ce-input--sm" type="number" data-prop="y" value="' + object.y + '"></label>' +
          '<label>宽<input class="ce-input ce-input--sm" type="number" data-prop="width" min="' + MATERIAL_LIMITS.minObjectSize + '" value="' + object.width + '"></label>' +
          '<label>高<input class="ce-input ce-input--sm" type="number" data-prop="height" min="' + MATERIAL_LIMITS.minObjectSize + '" value="' + object.height + '"></label>' +
        '</div>'
      )
    }

    if (object.type === 'text') {
      const style = object.style || {}
      rows.push(
        '<div class="ce-mat-props__row">' +
          '<label>字号<input class="ce-input ce-input--sm" type="number" data-style="fontSize" min="8" max="200" value="' + (style.fontSize || 22) + '"></label>' +
          '<label>行高<input class="ce-input ce-input--sm" type="number" data-style="lineHeight" step="0.1" min="1" max="3" value="' + (style.lineHeight || 1.7) + '"></label>' +
          '<label>字色<input class="ce-input ce-input--color" type="color" data-style="color" value="' + (style.color || '#1b1d19') + '"></label>' +
          '<label>对齐<select class="ce-input ce-input--sm" data-style="textAlign">' +
            ['left', 'center', 'right'].map(function (value) {
              const label = value === 'left' ? '左' : value === 'center' ? '中' : '右'
              return '<option value="' + value + '"' + ((style.textAlign || 'left') === value ? ' selected' : '') + '>' + label + '</option>'
            }).join('') +
          '</select></label>' +
        '</div>' +
        '<div class="ce-mat-props__row">' +
          '<label>字体<select class="ce-input ce-input--sm" data-style="fontFamily">' +
            [['', '楷体（默认）'], ["'Microsoft YaHei', sans-serif", '黑体'], ["'Songti SC', 'SimSun', serif", '宋体']].map(function (item) {
              return '<option value="' + attr(item[0]) + '"' + ((style.fontFamily || '') === item[0] ? ' selected' : '') + '>' + item[1] + '</option>'
            }).join('') +
          '</select></label>' +
          '<label>背景<input class="ce-input ce-input--color" type="color" data-style="backgroundColor" value="' + (style.backgroundColor || '#ffffff') + '"></label>' +
        '</div>'
      )
    }

    if (object.type === 'image') {
      rows.push(
        '<div class="ce-mat-props__row">' +
          '<label>填充<select class="ce-input ce-input--sm" data-prop="objectFit">' +
            ['contain', 'cover', 'fill'].map(function (value) {
              return '<option value="' + value + '"' + ((object.objectFit || 'contain') === value ? ' selected' : '') + '>' + value + '</option>'
            }).join('') +
          '</select></label>' +
          '<label class="ce-mat-props__check"><input type="checkbox" data-prop="lockAspectRatio"' + (object.lockAspectRatio !== false ? ' checked' : '') + '>锁定比例</label>' +
          '<button class="ce-btn ce-btn--sm" type="button" data-mat="replace-image">替换图片</button>' +
        '</div>' +
        '<div class="ce-mat-props__row">' +
          '<label>图片地址<input class="ce-input ce-input--wide" type="text" data-prop="src" value="' + attr(object.src || '') + '" placeholder="./assets/map.png 或 data:image/..."></label>' +
        '</div>'
      )
    }

    if (object.type === 'table') {
      rows.push(
        '<div class="ce-mat-props__row">' +
          '<button class="ce-btn ce-btn--sm" type="button" data-mat="table-row">增加行</button>' +
          '<button class="ce-btn ce-btn--sm" type="button" data-mat="table-col">增加列</button>' +
          '<span class="ce-field__hint">双击单元格修改文字</span>' +
        '</div>'
      )
    }

    propsHost.innerHTML = warning + rows.join('')
  }

  function refresh() {
    renderCanvas()
    renderProps()
    updateHistoryButtons()
    notify()
  }

  function undo() {
    if (!history.past.length) return
    history.future.push(snapshot())
    restore(history.past.pop())
    refresh()
  }

  function redo() {
    if (!history.future.length) return
    history.past.push(snapshot())
    restore(history.future.pop())
    refresh()
  }

  /* ---------------- 对象操作 ---------------- */

  function addObject(object) {
    if (layout.objects.length >= MATERIAL_LIMITS.maxObjects) {
      window.alert('单个题组最多 ' + MATERIAL_LIMITS.maxObjects + ' 个对象，请先删除不用的对象。')
      return
    }
    pushHistory()
    layout.objects.push(object)
    state.selectedId = object.id
    refresh()
  }

  /** 新增一道题：题目追加到库，槽内容切到新题（画布不新增对象） */
  function insertQuestion(kind) {
    if (!options.createQuestion) return
    const current = active()
    const question = options.createQuestion(kind || (current && current.question.type === 'essay' ? 'essay' : 'choice'))
    if (!question) return
    question.id = nextQuestionId(questions())
    pushHistory()
    group.questions = questions().concat([question])
    const ensured = ensureSlot(layout, true, question)
    setLayout(ensured.layout)
    state.activeIndex = group.questions.length - 1
    state.activeOptionKey = null
    state.answerOpen = false
    state.analysisOpen = false
    state.selectedId = ensured.slot ? ensured.slot.id : state.selectedId
    refresh()
    focusStemField()
    scrollSelectedIntoView()
  }

  function focusStemField() {
    const field = propsHost.querySelector('[data-qprop="stem"]')
    if (field) field.focus()
  }

  function scrollSelectedIntoView() {
    const node = canvasHost.querySelector('.cq-material__object.is-selected')
    if (node && node.scrollIntoView) node.scrollIntoView({ block: 'center' })
  }

  function selectQuestion(index) {
    if (!questions()[index]) return
    state.activeIndex = index
    state.activeOptionKey = null
    state.answerOpen = false
    state.analysisOpen = false
    const ensured = ensureSlot(layout, true, questions()[index])
    if (ensured.created) setLayout(ensured.layout)
    const ensuredSlot = slot()
    if (ensuredSlot) state.selectedId = ensuredSlot.id
    renderCanvas()
    renderProps()
  }

  function duplicateSubQuestion() {
    const current = active()
    if (!current) return
    const copy = duplicateQuestion(current.question, nextQuestionId(questions()))
    pushHistory()
    group.questions = questions().concat([copy])
    state.activeIndex = group.questions.length - 1
    state.activeOptionKey = null
    if (slot()) state.selectedId = slot().id
    renderCanvas()
    renderProps()
  }

  function deleteSubQuestion() {
    const current = active()
    if (!current) return
    if (questions().length <= 1) {
      window.alert('至少保留一道题；如需清空内容，可直接修改题干与选项。')
      return
    }
    const apply = function () {
      pushHistory()
      group.questions = questions().filter(function (question) { return question.id !== current.question.id })
      state.activeIndex = clamp(state.activeIndex, 0, group.questions.length - 1)
      state.activeOptionKey = null
      state.answerOpen = false
      state.analysisOpen = false
      renderCanvas()
      renderProps()
      updateHistoryButtons()
      notify()
    }
    const message = '删除这道题？题目内容会一起删除（可用撤销恢复）。'
    if (options.confirm) options.confirm(message, apply)
    else if (window.confirm(message)) apply()
  }

  function setSlotWidth(half) {
    const object = slot()
    if (!object) return
    pushHistory()
    object.width = slotWidth(layout, half)
    if (object.x + object.width > layout.width - 24) {
      object.x = Math.max(24, layout.width - object.width - 24)
    }
    renderCanvas()
    renderProps()
    notify()
  }

  function addOption() {
    const current = active()
    if (!current || current.question.type !== 'choice') return
    const question = current.question
    if ((question.options || []).length >= 8) {
      window.alert('最多 8 个选项。')
      return
    }
    pushHistory()
    question.options.push({ key: String.fromCharCode(65 + question.options.length), text: '' })
    refresh()
  }

  function deleteOption(index) {
    const current = active()
    if (!current || current.question.type !== 'choice') return
    const question = current.question
    if ((question.options || []).length <= 2) {
      window.alert('至少保留两个选项。')
      return
    }
    pushHistory()
    question.options.splice(index, 1)
    question.options.forEach(function (option, i) { option.key = String.fromCharCode(65 + i) })
    const keys = question.options.map(function (option) { return option.key })
    if (!Array.isArray(question.answer) && keys.indexOf(question.answer) < 0) question.answer = keys[0]
    if (Array.isArray(question.answer)) {
      question.answer = question.answer.filter(function (key) { return keys.indexOf(key) >= 0 })
      if (!question.answer.length) question.answer = keys[0]
    }
    state.activeOptionKey = null
    refresh()
  }

  function setAnswer(key) {
    const current = active()
    if (!current || current.question.type !== 'choice') return
    pushHistory()
    current.question.answer = key
    const radio = propsHost.querySelector('[data-qanswer][value="' + key + '"]')
    if (radio) radio.checked = true
    renderCanvas()
    scheduleNotify()
  }

  function switchQuestionType(nextType) {
    const current = active()
    if (!current || current.question.type === nextType) return
    const apply = function () {
      pushHistory()
      const list = questions().slice()
      list[current.index] = convertQuestionKind(current.question, nextType)
      group.questions = list
      state.activeOptionKey = null
      state.answerOpen = false
      state.analysisOpen = false
      refresh()
    }
    const message = nextType === 'essay'
      ? '切换为综合题会清空当前选项与正确答案，确定继续吗？'
      : '切换为选择题会清空当前设问与参考答案并生成 A/B/C/D 空选项，确定继续吗？'
    if (options.confirm) options.confirm(message, apply)
    else if (window.confirm(message)) apply()
    else renderProps()
  }

  function addStemAfter(index) {
    const current = active()
    if (!current || current.question.type !== 'essay') return
    const question = current.question
    const stems = Array.isArray(question.stems) ? question.stems.slice() : (question.stems ? [question.stems] : [])
    pushHistory()
    stems.splice(index + 1, 0, '')
    question.stems = stems
    refresh()
    const node = canvasHost.querySelector('[data-edit="stem-item"][data-index="' + (index + 1) + '"]')
    if (node) caretToEnd(node)
  }

  function addText() {
    addObject({
      id: nextId('text'),
      type: 'text',
      x: 24,
      y: 24 + (layout.objects.length % 6) * 32,
      width: layout.width - 48,
      height: 140,
      html: '<p>' + TEXT_PLACEHOLDER + '</p>',
      style: { fontSize: 22, lineHeight: 1.7, textAlign: 'left', color: '#1b1d19' }
    })
  }

  function addTable() {
    addObject({
      id: nextId('table'),
      type: 'table',
      x: 24,
      y: 24 + (layout.objects.length % 6) * 32,
      width: Math.min(layout.width - 48, 560),
      height: 200,
      html: tableHtml(2, 3)
    })
  }

  function pickImage(replaceId) {
    state.replaceId = replaceId || null
    fileInput.click()
  }

  /** 按原始像素放入画布：只有超过画布才缩小，绝不主动缩到固定小尺寸 */
  function imageFit(width, height) {
    const maxW = Math.max(120, layout.width - 48)
    const maxH = Math.max(120, layout.height - 24)
    const ratio = width > 0 && height > 0 ? width / height : 4 / 3
    let w = width > 0 ? width : 320
    let h = height > 0 ? height : Math.round(w / ratio)
    if (w > maxW) { w = maxW; h = Math.round(w / ratio) }
    if (h > maxH) { h = maxH; w = Math.round(h * ratio) }
    return { width: Math.max(24, w), height: Math.max(24, h) }
  }

  /** 按原始像素放入画布：只有超过画布才缩小，之后可自由缩放 */
  function applyPickedImage(dataUrl) {
    if (state.replaceId) {
      const object = findObject(state.replaceId)
      if (object && object.type === 'image') {
        pushHistory()
        object.src = dataUrl
        state.replaceId = null
        refresh()
        return
      }
    }
    const image = new Image()
    const insert = function (naturalWidth, naturalHeight) {
      const size = imageFit(naturalWidth, naturalHeight)
      addObject({
        id: nextId('image'),
        type: 'image',
        x: 40 + (layout.objects.length % 5) * 24,
        y: 40 + (layout.objects.length % 5) * 24,
        width: size.width,
        height: size.height,
        src: dataUrl,
        alt: '',
        objectFit: 'contain',
        lockAspectRatio: true
      })
    }
    image.onload = function () {
      insert(image.naturalWidth, image.naturalHeight)
    }
    image.onerror = function () {
      insert(320, 240)
    }
    image.src = dataUrl
  }

  function deleteSelected() {
    const object = selected()
    if (!object) return
    if (object.type === 'slot') {
      window.alert('题目槽随题目自动保留；如需减少题目，请在属性栏删除当前题。')
      return
    }
    pushHistory()
    layout.objects = layout.objects.filter((item) => item.id !== object.id)
    state.selectedId = null
    refresh()
  }

  function duplicateSelected() {
    const object = selected()
    if (!object) return
    if (object.type === 'slot') return
    pushHistory()
    const copy = JSON.parse(JSON.stringify(object))
    copy.id = nextId(object.type)
    copy.x = clamp(object.x + 24, 0, layout.width - object.width)
    copy.y = clamp(object.y + 24, 0, layout.height - object.height)
    copy.zIndex = maxZ() + 1
    layout.objects.push(copy)
    state.selectedId = copy.id
    refresh()
  }

  function maxZ() {
    return layout.objects.reduce((max, item) => Math.max(max, item.zIndex || 0), 0)
  }
  function minZ() {
    return layout.objects.reduce((min, item) => Math.min(min, item.zIndex || 0), 0)
  }

  function layer(action) {
    const object = selected()
    if (!object) return
    pushHistory()
    if (action === 'up') object.zIndex = maxZ() + 1
    if (action === 'down') object.zIndex = minZ() - 1
    if (action === 'top') object.zIndex = maxZ() + 10
    if (action === 'bottom') object.zIndex = minZ() - 10
    refresh()
  }

  function align(mode) {
    const object = selected()
    if (!object) return
    pushHistory()
    if (mode === 'left') object.x = 0
    if (mode === 'center') object.x = Math.max(0, Math.round((layout.width - object.width) / 2))
    if (mode === 'right') object.x = Math.max(0, layout.width - object.width)
    refresh()
  }

  function command(name) {
    const activeEl = document.activeElement
    if (!activeEl || !root.contains(activeEl)) return
    if (!activeEl.closest || !activeEl.closest('[contenteditable="true"]')) return
    activeEl.focus()
    /* 强制用语义标签（b/i/u/strike），避免浏览器写成 text-decoration-line 等属性 */
    document.execCommand('styleWithCSS', false, 'false')
    document.execCommand(name, false)
    if (activeEl.closest('.cq-qobj')) {
      writeCanvasField(activeEl)
      return
    }
    const objectEl = activeEl.closest('[data-material-object-id]')
    const object = objectEl ? findObject(objectEl.getAttribute('data-material-object-id')) : null
    const text = objectEl ? objectEl.querySelector('.cq-material__text') : null
    if (object && text) {
      object.html = text.innerHTML
      notify()
    }
  }

  function updateProp(name, value) {
    const object = selected()
    if (!object) return
    if (name === 'x' || name === 'y') {
      object[name] = clamp(num(value, object[name]), 0, name === 'x' ? layout.width - object.width : layout.height - object.height)
    } else if (name === 'width' || name === 'height') {
      const min = MATERIAL_LIMITS.minObjectSize
      const max = name === 'width' ? layout.width - object.x : layout.height - object.y
      object[name] = clamp(num(value, object[name]), min, Math.max(min, max))
    } else if (name === 'objectFit') {
      object.objectFit = value
    } else if (name === 'lockAspectRatio') {
      object.lockAspectRatio = !!value
    } else if (name === 'src') {
      object.src = String(value)
    }
    renderCanvas()
    notify()
  }

  function updateStyle(name, value) {
    const object = selected()
    if (!object || object.type !== 'text') return
    object.style = object.style || {}
    if (name === 'fontSize') object.style.fontSize = clamp(num(value, 22), 8, 200)
    else if (name === 'lineHeight') object.style.lineHeight = clamp(num(value, 1.7), 1, 3)
    else if (name === 'color') object.style.color = String(value)
    else if (name === 'backgroundColor') object.style.backgroundColor = String(value)
    else if (name === 'textAlign') object.style.textAlign = String(value)
    else if (name === 'fontFamily') {
      if (value) object.style.fontFamily = String(value)
      else delete object.style.fontFamily
    }
    renderCanvas()
    notify()
  }

  /** 画布自身属性：宽 / 高 / 背景（缩放按容器自适应，不保存像素） */
  function updateCanvasProp(name, value) {
    if (name === 'width' || name === 'height') {
      const min = name === 'width' ? 320 : 200
      const max = name === 'width' ? MATERIAL_LIMITS.maxWidth : MATERIAL_LIMITS.maxHeight
      layout[name] = clamp(num(value, layout[name]), min, max)
    } else if (name === 'background') {
      layout.background = String(value)
    }
    renderCanvas()
    notify()
  }

  /** 属性栏题目字段写回（输入过程中不重建属性栏，避免抢焦点） */
  function updateQuestionField(name, value) {
    const current = active()
    if (!current) return
    const question = current.question
    if (name === 'stem') question.stem = plainToHtml(value)
    else if (name === 'stems') question.stems = String(value).split('\n').map(function (stem) { return plainToHtml(stem.trim()) })
    else if (name === 'referenceAnswer') question.referenceAnswer = String(value)
    else if (name === 'analysis') question.analysis = String(value)
    else if (name === 'columns') {
      const targetSlot = slot()
      if (targetSlot) {
        const columns = Number(value)
        targetSlot.optionLayout = { mode: 'flow', columns: columns === 1 || columns === 3 ? columns : 2 }
      }
    }
    renderCanvas()
    growAllBlocks()
    scheduleNotify()
  }

  function growAllBlocks() {
    checkOverflow()
  }

  function updateOptionText(index, value) {
    const current = active()
    if (!current || current.question.type !== 'choice') return
    const option = current.question.options[index]
    if (!option) return
    option.text = plainToHtml(value)
    renderCanvas()
    scheduleNotify()
  }

  function mutateTable(kind) {
    const object = selected()
    if (!object || object.type !== 'table') return
    const holder = document.createElement('div')
    holder.innerHTML = sanitizeHtml(object.html)
    const table = holder.querySelector('table')
    if (!table) return
    if (kind === 'row') {
      const body = table.querySelector('tbody') || table
      const rows = body.querySelectorAll('tr')
      if (rows.length) body.appendChild(rows[rows.length - 1].cloneNode(true))
    } else {
      Array.from(table.querySelectorAll('tr')).forEach(function (row) {
        const cells = row.querySelectorAll('th,td')
        if (cells.length) row.appendChild(cells[cells.length - 1].cloneNode(true))
      })
    }
    pushHistory()
    object.html = sanitizeHtml(holder.innerHTML)
    refresh()
  }

  /* ---------------- 画布内交互 ---------------- */

  /** 最近一次由 pointerdown 处理的题块按钮时间：避免随后的 click 再触发一次 */
  let lastSlotActionAt = 0

  /** 槽内按钮（切题 / 删除 / 折叠）在 pointerdown 阶段立即处理
   *  —— 点击会重绘画布，等到 click 时元素已被替换，容易点空或点到下层元素 */
  function onCanvasPointerDown(event) {
    const target = event.target
    if (!target || !target.closest) return

    const nav = target.closest('[data-qnav]')
    if (nav) {
      event.preventDefault()
      event.stopPropagation()
      lastSlotActionAt = Date.now()
      const dir = nav.getAttribute('data-qnav')
      const nextIndex = state.activeIndex + (dir === 'prev' ? -1 : 1)
      if (nextIndex >= 0 && nextIndex < questions().length) selectQuestion(nextIndex)
      return
    }

    const action = target.closest('[data-qobj-action]')
    if (!action) return
    event.preventDefault()
    event.stopPropagation()
    lastSlotActionAt = Date.now()
    handleSlotAction(action.getAttribute('data-qobj-action') || '')
  }

  function handleSlotAction(name) {
    if (name === 'delete') { deleteSubQuestion(); return }
    if (name === 'toggle-answer') { toggleFold('answer'); return }
    if (name === 'toggle-analysis') toggleFold('analysis')
  }

  /**
   * 解析 / 参考答案就地开合：只切 hidden 与按钮文案，不重绘画布。
   * 重绘会让鼠标下的元素被替换，造成“点了没收起、还点到下层选项”的错觉。
   */
  function toggleFold(field) {
    const rootEl = canvasHost.querySelector('.cq-qobj')
    if (!rootEl) return
    const panel = rootEl.querySelector('[data-edit="' + field + '"]')
    if (!panel) return
    const open = panel.hidden
    if (field === 'answer') {
      state.answerOpen = open
      state.analysisOpen = false
    } else {
      state.analysisOpen = open
      state.answerOpen = false
    }
    panel.hidden = !open
    const other = rootEl.querySelector('[data-edit="' + (field === 'answer' ? 'analysis' : 'answer') + '"]')
    if (other) other.hidden = true

    const buttons = rootEl.querySelectorAll('[data-qobj-action]')
    Array.prototype.forEach.call(buttons, function (button) {
      const key = button.getAttribute('data-qobj-action')
      if (key === 'toggle-analysis') {
        button.classList.toggle('is-open', state.analysisOpen)
        button.textContent = state.analysisOpen ? '收起解析' : '解析'
      }
      if (key === 'toggle-answer') {
        button.classList.toggle('is-open', state.answerOpen)
        button.textContent = state.answerOpen ? '收起参考答案' : '编辑参考答案'
      }
    })

    if (open) caretToEnd(panel)
    growBlock(rootEl)
    scheduleNotify()
  }

  function markActiveOption(key) {
    state.activeOptionKey = key
    const nodes = canvasHost.querySelectorAll('.cq-qobj__opt--edit')
    Array.prototype.forEach.call(nodes, function (node) {
      node.classList.toggle('is-editing', node.getAttribute('data-qobj-option') === key)
    })
    const rows = propsHost.querySelectorAll('[data-qopt-row]')
    Array.prototype.forEach.call(rows, function (row) {
      row.classList.toggle('is-active', row.getAttribute('data-qopt-row') === key)
    })
  }

  function focusOptionField(key) {
    const current = active()
    if (!current || current.question.type !== 'choice') return
    const index = (current.question.options || []).findIndex(function (option) { return option.key === key })
    if (index < 0) return
    const field = propsHost.querySelector('[data-qopt="' + index + '"]')
    if (field) field.focus()
  }

  function handleCanvasClick(event) {
    const target = event.target

    /* 槽内按钮已在 pointerdown 处理，忽略随后的 click，避免“开了又开” */
    if (Date.now() - lastSlotActionAt < 400) return

    /* 键盘激活（Enter）等没有 pointerdown 的情况仍走 click */
    const nav = target.closest('[data-qnav]')
    if (nav) {
      const dir = nav.getAttribute('data-qnav')
      const nextIndex = state.activeIndex + (dir === 'prev' ? -1 : 1)
      if (nextIndex >= 0 && nextIndex < questions().length) selectQuestion(nextIndex)
      return
    }

    if (state.previewAnswers) {
      const opt = target.closest('[data-cq-opt]')
      if (opt) {
        const question = questionById(opt.getAttribute('data-cq-opt'))
        if (!question || question.type !== 'choice') return
        const answer = answerState(question.id)
        if (answer.submitted) return
        const key = opt.getAttribute('data-key') || ''
        if (question.mode === 'multiple') {
          answer.selected = answer.selected.indexOf(key) >= 0
            ? answer.selected.filter(function (item) { return item !== key })
            : answer.selected.concat(key)
        } else {
          answer.selected = [key]
          answer.submitted = true
        }
        renderCanvas()
        return
      }
      const reveal = target.closest('[data-cq-reveal]')
      if (reveal) {
        const answer = answerState(reveal.getAttribute('data-cq-reveal'))
        answer.revealed = !answer.revealed
        renderCanvas()
      }
      return
    }

    const answerBadge = target.closest('[data-answer-key]')
    if (answerBadge) {
      setAnswer(answerBadge.getAttribute('data-answer-key'))
      return
    }

    const action = target.closest('[data-qobj-action]')
    if (action) {
      handleSlotAction(action.getAttribute('data-qobj-action') || '')
      return
    }

    const option = target.closest('[data-qobj-option]')
    if (option && !target.closest('[data-edit]') && !target.closest('[data-answer-key]')) {
      const key = option.getAttribute('data-qobj-option')
      if (state.activeOptionKey !== key) {
        markActiveOption(key)
        focusOptionField(key)
      }
    }
  }

  function onCanvasInput(event) {
    const target = event.target
    if (!(target.closest && target.closest('[data-edit]'))) return
    writeCanvasField(target)
  }

  function onCanvasFocusIn(event) {
    const target = event.target
    if (!(target.closest && target.closest('[data-edit]'))) return
    if (target.getAttribute('data-edit') === 'option') markActiveOption(target.getAttribute('data-key'))
  }

  function onCanvasFocusOut(event) {
    const target = event.target
    if (!(target.closest && target.closest('[data-edit]'))) return
    notify()
  }

  function onCanvasKeydown(event) {
    const target = event.target
    if (!(target.closest && target.closest('[data-edit]'))) {
      handleObjectKeys(event)
      return
    }
    if (event.key === 'Enter' && !event.shiftKey && target.getAttribute('data-edit') === 'stem-item') {
      event.preventDefault()
      addStemAfter(Number(target.getAttribute('data-index')))
      return
    }
    if (event.key === 'Escape') target.blur()
  }

  function handleObjectKeys(event) {
    const target = event.target
    if (target && target.closest && target.closest('input,textarea,select')) return
    /* 材料文字 / 表格单元格正在就地编辑时，Backspace 只删字，不删对象 */
    if (target && target.closest && target.closest('[contenteditable="true"]')) return
    const object = selected()
    if (!object) return
    const step = event.shiftKey ? 10 : 1
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (moves[event.key]) {
      event.preventDefault()
      pushHistory()
      object.x = clamp(object.x + moves[event.key][0], 0, layout.width - object.width)
      object.y = clamp(object.y + moves[event.key][1], 0, layout.height - object.height)
      renderCanvas()
      renderProps()
      notify()
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      deleteSelected()
      return
    }
    const mod = event.ctrlKey || event.metaKey
    if (mod && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      event.shiftKey ? redo() : undo()
      return
    }
    if (mod && event.key.toLowerCase() === 'y') {
      event.preventDefault()
      redo()
      return
    }
    if (mod && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      duplicateSelected()
    }
  }

  /* ---------------- 工具条 / 属性栏事件 ---------------- */

  function onHostMousedown(event) {
    if (!isActive) return
    if (event.target.closest && event.target.closest('button[data-mat]')) event.preventDefault()
  }

  function onHostClick(event) {
    if (!isActive) return
    const sub = event.target.closest('[data-qsub]')
    if (sub) {
      selectQuestion(Number(sub.getAttribute('data-qsub')))
      return
    }
    const button = event.target.closest('[data-mat]')
    if (!button) return
    const action = button.getAttribute('data-mat')
    if (action === 'undo') return undo()
    if (action === 'redo') return redo()
    if (action === 'add-text') return addText()
    if (action === 'add-image') return pickImage(null)
    if (action === 'add-table') return addTable()
    if (action === 'insert-question') return insertQuestion()
    if (action === 'preview') {
      state.previewAnswers = !state.previewAnswers
      state.activeOptionKey = null
      button.setAttribute('aria-pressed', String(state.previewAnswers))
      button.classList.toggle('is-active', state.previewAnswers)
      renderCanvas()
      return
    }
    if (action === 'bold') return command('bold')
    if (action === 'italic') return command('italic')
    if (action === 'underline') return command('underline')
    if (action === 'strike') return command('strikeThrough')
    if (action === 'left' || action === 'center' || action === 'right') return align(action)
    if (action === 'up' || action === 'down' || action === 'top' || action === 'bottom') return layer(action)
    if (action === 'text-color') {
      const color = button.getAttribute('data-color')
      const selection = window.getSelection ? window.getSelection() : null
      const activeEl = document.activeElement
      const editable = activeEl && activeEl.closest ? activeEl.closest('[contenteditable="true"]') : null
      /* 正在就地编辑且有选区：只改选中的文字（材料、题干、选项、表格单元格都适用） */
      if (editable && selection && !selection.isCollapsed && selection.rangeCount &&
          selection.anchorNode && selection.focusNode &&
          editable.contains(selection.anchorNode) && editable.contains(selection.focusNode)) {
        pushHistory()
        /* 手动包一层 span，避免 execCommand 在部分浏览器里对选区不生效 */
        const range = selection.getRangeAt(0)
        const span = document.createElement('span')
        span.style.color = color
        span.appendChild(range.extractContents())
        range.insertNode(span)
        selection.removeAllRanges()
        const next = document.createRange()
        next.selectNodeContents(span)
        selection.addRange(next)
        /* 下划线 / 删除线由外层元素绘制，需要同步它们的装饰颜色 */
        let decorated = span.parentElement
        while (decorated && decorated !== editable) {
          const tag = decorated.tagName
          if (tag === 'U' || tag === 'S' || tag === 'STRIKE' || tag === 'DEL' ||
              decorated.style.textDecoration || decorated.style.textDecorationLine) {
            decorated.style.textDecorationColor = color
          }
          decorated = decorated.parentElement
        }
        if (editable.classList.contains('cq-material__text')) {
          const object = selected()
          if (object && object.type === 'text') object.html = editable.innerHTML
          scheduleNotify()
        } else if (editable.getAttribute('data-edit')) {
          writeCanvasField(editable)
        } else {
          const table = editable.closest('.cq-material__table')
          const objectEl = table && table.closest('[data-material-object-id]')
          const object = objectEl && findObject(objectEl.getAttribute('data-material-object-id'))
          if (object && object.type === 'table') object.html = sanitizeHtml(table.outerHTML)
          scheduleNotify()
        }
        return
      }
      /* 否则改整块文字颜色 */
      const object = selected()
      if (!object || object.type !== 'text') return
      pushHistory()
      object.style = object.style || {}
      object.style.color = color
      renderCanvas()
      renderProps()
      notify()
      return
    }
    if (action === 'replace-image') return pickImage(state.selectedId)
    if (action === 'table-row') return mutateTable('row')
    if (action === 'table-col') return mutateTable('col')
    if (action === 'add-subquestion') return insertQuestion()
    if (action === 'dup-subquestion') return duplicateSubQuestion()
    if (action === 'del-subquestion') return deleteSubQuestion()
    if (action === 'add-option') return addOption()
    if (action === 'del-option') return deleteOption(Number(button.getAttribute('data-oi')))
    if (action === 'width-full') return setSlotWidth(false)
    if (action === 'width-half') return setSlotWidth(true)
  }

  function onHostInput(event) {
    if (!isActive) return
    const target = event.target
    if (target.matches('[data-canvas]')) {
      updateCanvasProp(target.getAttribute('data-canvas'), target.value)
      return
    }
    if (target.matches('[data-prop]')) {
      updateProp(target.getAttribute('data-prop'), target.type === 'checkbox' ? target.checked : target.value)
      return
    }
    if (target.matches('[data-style]')) {
      updateStyle(target.getAttribute('data-style'), target.value)
      return
    }
    if (target.matches('[data-qopt]')) {
      updateOptionText(Number(target.getAttribute('data-qopt')), target.value)
      return
    }
    if (target.matches('[data-qprop]') && target.tagName !== 'SELECT') {
      updateQuestionField(target.getAttribute('data-qprop'), target.value)
    }
  }

  function onHostChange(event) {
    if (!isActive) return
    const target = event.target
    if (target.matches('[data-canvas]')) {
      updateCanvasProp(target.getAttribute('data-canvas'), target.value)
      return
    }
    if (target.matches('[data-mat-zoom]')) {
      const value = target.value
      state.zoom = value === 'fit' ? 'fit' : Number(value)
      renderCanvas()
      return
    }
    if (target.matches('[data-prop]')) {
      updateProp(target.getAttribute('data-prop'), target.type === 'checkbox' ? target.checked : target.value)
      return
    }
    if (target.matches('[data-qanswer]')) {
      setAnswer(target.value)
      return
    }
    if (target.matches('[data-qprop]')) {
      const name = target.getAttribute('data-qprop')
      if (name === 'type') {
        switchQuestionType(target.value === 'essay' ? 'essay' : 'choice')
        return
      }
      updateQuestionField(name, target.value)
    }
  }

  function onHostFocusIn(event) {
    if (!isActive) return
    const target = event.target
    if (target && target.matches && target.matches('[data-canvas],[data-prop],[data-style],[data-qprop],[data-qopt],[data-qanswer]')) {
      pushHistory()
    }
  }

  function bindHost(host) {
    if (!host) return
    host.addEventListener('mousedown', onHostMousedown)
    host.addEventListener('click', onHostClick)
    host.addEventListener('input', onHostInput)
    host.addEventListener('change', onHostChange)
    host.addEventListener('focusin', onHostFocusIn)
  }

  function unbindHost(host) {
    if (!host) return
    host.removeEventListener('mousedown', onHostMousedown)
    host.removeEventListener('click', onHostClick)
    host.removeEventListener('input', onHostInput)
    host.removeEventListener('change', onHostChange)
    host.removeEventListener('focusin', onHostFocusIn)
  }

  bindHost(root)
  /* 外部属性栏不在 root 内时才单独绑定，避免内部属性栏被重复处理 */
  const propsBound = !root.contains(propsHost)
  if (propsBound) bindHost(propsHost)

  fileInput.addEventListener('change', function () {
    const file = fileInput.files && fileInput.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      window.alert('图片超过 5MB，建议压缩后再插入，避免题库文件过大。')
      fileInput.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = function () {
      applyPickedImage(String(reader.result || ''))
      fileInput.value = ''
    }
    reader.readAsDataURL(file)
  })

  canvasHost.addEventListener('pointerdown', onCanvasPointerDown, true)
  canvasHost.addEventListener('keydown', onCanvasKeydown)
  canvasHost.addEventListener('click', handleCanvasClick)
  canvasHost.addEventListener('input', onCanvasInput)
  canvasHost.addEventListener('focusin', onCanvasFocusIn)
  canvasHost.addEventListener('focusout', onCanvasFocusOut)

  canvasHost.addEventListener('paste', function (event) {
    const data = event.clipboardData
    const items = data && data.items
    if (!items) return
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].type && items[i].type.indexOf('image/') === 0) {
        const file = items[i].getAsFile()
        if (!file) continue
        event.preventDefault()
        if (file.size > 5 * 1024 * 1024) {
          window.alert('图片超过 5MB，建议压缩后再插入，避免题库文件过大。')
          return
        }
        const reader = new FileReader()
        reader.onload = function () {
          applyPickedImage(String(reader.result || ''))
        }
        reader.readAsDataURL(file)
        return
      }
    }

    /* 文字粘贴到题干 / 选项 / 解析：题干选项只保留纯文本，解析与答案保留清洗后的结构 */
    const target = event.target
    const editable = target && target.closest ? target.closest('[data-edit]') : null
    if (!editable) return
    const field = editable.getAttribute('data-edit')
    const text = data.getData('text/plain') || ''
    const html = data.getData('text/html') || ''
    event.preventDefault()
    if (field === 'answer' || field === 'analysis') {
      const clean = html ? sanitizeClipboardHtml(html) : esc(text).replace(/\r?\n/g, '<br>')
      if (clean) document.execCommand('insertHTML', false, clean)
      return
    }
    const plain = esc(text).replace(/\r?\n/g, '<br>')
    if (plain) document.execCommand('insertHTML', false, plain)
  })

  renderCanvas()
  renderProps()
  updateHistoryButtons()

  return {
    destroy: function () {
      destroyed = true
      clearTimeout(notifyTimer)
      unbindHost(root)
      if (propsBound) {
        unbindHost(propsHost)
        if (isActive) propsHost.innerHTML = ''
      }
      mount.innerHTML = ''
    },
    /** 前台切换：多个题组共用外部属性栏时，仅前台实例渲染属性 */
    setActive: function (next) {
      isActive = !!next
      if (isActive) {
        /* 挂载后再测一次，避免脱离文档时测量导致误判溢出 */
        checkOverflow()
        renderProps()
      }
    },
    refresh: renderCanvas
  }
}
