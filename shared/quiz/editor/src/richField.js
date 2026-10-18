/* ============================================================
   富文本块编辑器（SunEditor 3.3.3 · MIT）
   ------------------------------------------------------------
   一个字段 = 块序列：
   - 文本块：1 个 SunEditor 实例；
   - 分栏块：2 / 3 个独立 SunEditor 实例并排。

   导出为规范 HTML（cq-cols / cq-col），逐段走 content/sanitize.ts
   白名单清洗；SunEditor 的私有类、Word 粘贴垃圾不会进入题库。

   实现要点（与 spikes/material-editor-spike 一致）：
   - v3 插件必须显式传入，不能依赖自动注册；
   - 图片默认宽度在创建后通过 pluginManager.register 设置；
   - 取值 / 设值走 editor.$.html.get() / set()。
   ============================================================ */
import SUNEDITOR from 'suneditor'
import SUNEDITOR_PLUGINS from 'suneditor/plugins'
import zhCn from 'suneditor/langs/zh_cn'
import 'suneditor/css/editor'
import 'suneditor/css/contents'
import { sanitizeHtml } from '../../content/sanitize'

const PLUGIN_NAMES = ['fontColor', 'backgroundColor', 'list_bulleted', 'list_numbered', 'table', 'image']

const BUTTON_LIST = [
  ['undo', 'redo'],
  ['bold', 'underline', 'italic', 'strike'],
  ['fontColor', 'backgroundColor'],
  ['list_bulleted', 'list_numbered'],
  ['table', 'image'],
  ['removeFormat'],
  ['codeView']
]

const TEXT = {
  flow: '文本块',
  cols: '分栏',
  del: '删除此块',
  addFlow: '+ 文本块',
  addCols2: '+ 两栏',
  addCols3: '+ 三栏',
  flowHint: '在此输入内容…',
  confirmDelete: '删除这个块？块内内容不可恢复。',
  colHints2: ['左栏内容…', '右栏内容…'],
  colHints3: ['第一栏内容…', '第二栏内容…', '第三栏内容…']
}

const PLUGINS = PLUGIN_NAMES.map((name) => SUNEDITOR_PLUGINS[name]).filter(Boolean)

function createEditor(host, placeholder, onChange) {
  const editor = SUNEDITOR.create(host, {
    lang: zhCn,
    plugins: PLUGINS,
    buttonList: BUTTON_LIST,
    height: 'auto',
    minHeight: 120,
    placeholder,
    events: { onChange }
  })
  // v3：图片默认宽度只在 pluginManager 上生效（顶层 image 选项无效）
  try {
    editor.$.pluginManager.register('image', null, { defaultWidth: 300 })
  } catch (e) {
    /* 注册失败不阻断编辑，渲染端仍有 max-width:100% 兜底 */
  }
  return editor
}

function getHtml(editor) {
  try {
    return editor.$.html.get() || ''
  } catch (e) {
    return ''
  }
}

function setHtml(editor, html) {
  if (!html) return
  try {
    editor.$.html.set(html)
  } catch (e) {
    /* ignore */
  }
}

function isBlank(html) {
  if (!html) return true
  if (/<(img|table)\b/i.test(html)) return false
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').trim() === ''
}

/** 解析已有 HTML：只认顶层 cq-cols 拆分栏块，其余归入文本块 */
function parseBlocks(html) {
  const root = document.createElement('div')
  root.innerHTML = String(html || '')
  const list = []
  let flowNodes = []

  function flushFlow() {
    if (!flowNodes.length) return
    list.push({
      type: 'flow',
      html: flowNodes.map(function (n) { return n.outerHTML }).join('')
    })
    flowNodes = []
  }

  Array.prototype.forEach.call(root.childNodes, function (node) {
    if (node.nodeType === 1 && node.classList && node.classList.contains('cq-cols')) {
      flushFlow()
      const cols = Array.prototype.map.call(
        node.querySelectorAll(':scope > .cq-col'),
        function (col) { return col.innerHTML }
      )
      list.push({ type: 'cols', cols: cols.length ? cols : ['', ''] })
    } else if (node.nodeType === 3 && !node.textContent.trim()) {
      /* 忽略块间空白 */
    } else {
      flowNodes.push(node)
    }
  })
  flushFlow()
  return list
}

export function createRichField(options) {
  const mount = options.mount
  const onChange = options.onInput || function () {}
  const initial = String(options.value || '')

  mount.innerHTML = ''
  mount.classList.add('ce-rich-mount')

  let ready = false
  const blocks = []

  function sync() {
    if (!ready) return
    onChange(serialize())
  }

  function serialize() {
    const parts = []
    blocks.forEach(function (b) {
      if (b.type === 'cols') {
        const cols = b.editors.map(getHtml)
        const hasContent = cols.some(function (h) { return !isBlank(h) })
        if (!hasContent) return
        parts.push('<div class="cq-cols">' + cols.map(function (h) {
          return '<div class="cq-col">' + sanitizeHtml(h) + '</div>'
        }).join('') + '</div>')
      } else {
        const html = getHtml(b.editor)
        if (!isBlank(html)) parts.push(sanitizeHtml(html))
      }
    })
    return parts.join('\n')
  }

  function makeBlockShell(label) {
    const shell = document.createElement('div')
    shell.className = 'ce-block'
    shell.innerHTML =
      '<div class="ce-block__bar"><span class="ce-block__tag">' + label + '</span>' +
      '<button class="ce-block__del" type="button">' + TEXT.del + '</button></div>'
    shell.querySelector('.ce-block__del').addEventListener('click', function () {
      if (!window.confirm(TEXT.confirmDelete)) return
      destroyBlock(shell)
      shell.remove()
    })
    return shell
  }

  function destroyBlock(shell) {
    const idx = blocks.findIndex(function (b) { return b.el === shell })
    if (idx < 0) return
    const b = blocks[idx]
    if (b.type === 'cols') b.editors.forEach(destroyEditor)
    else destroyEditor(b.editor)
    blocks.splice(idx, 1)
    sync()
  }

  function destroyEditor(editor) {
    try {
      if (editor && typeof editor.destroy === 'function') editor.destroy()
    } catch (e) {
      /* ignore */
    }
  }

  function addFlowBlock(html) {
    const shell = makeBlockShell(TEXT.flow)
    const host = document.createElement('div')
    host.className = 'ce-block__host'
    shell.appendChild(host)
    addHost.appendChild(shell)
    const editor = createEditor(host, TEXT.flowHint, sync)
    setHtml(editor, html)
    blocks.push({ type: 'flow', el: shell, editor })
  }

  function addColsBlock(count, cols) {
    const shell = makeBlockShell(TEXT.cols + ' · ' + count)
    const row = document.createElement('div')
    row.className = 'ce-block__cols'
    shell.appendChild(row)
    addHost.appendChild(shell)

    const editors = []
    const hints = count === 3 ? TEXT.colHints3 : TEXT.colHints2
    for (let i = 0; i < count; i++) {
      const col = document.createElement('div')
      col.className = 'ce-block__col'
      const host = document.createElement('div')
      host.className = 'ce-block__host'
      col.appendChild(host)
      row.appendChild(col)
      editors.push(createEditor(host, hints[i], sync))
      setHtml(editors[i], cols && cols[i] ? cols[i] : '')
    }
    blocks.push({ type: 'cols', el: shell, editors })
  }

  const addHost = document.createElement('div')
  addHost.className = 'ce-block__list'
  mount.appendChild(addHost)

  const footer = document.createElement('div')
  footer.className = 'ce-block__add'
  footer.innerHTML =
    '<button class="ce-btn ce-btn--sm" type="button" data-add="flow">' + TEXT.addFlow + '</button>' +
    '<button class="ce-btn ce-btn--sm" type="button" data-add="cols2">' + TEXT.addCols2 + '</button>' +
    '<button class="ce-btn ce-btn--sm" type="button" data-add="cols3">' + TEXT.addCols3 + '</button>'
  footer.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-add]')
    if (!btn) return
    const kind = btn.getAttribute('data-add')
    if (kind === 'flow') addFlowBlock('')
    else addColsBlock(kind === 'cols3' ? 3 : 2)
    sync()
  })
  mount.appendChild(footer)

  const parsed = parseBlocks(initial)
  if (!parsed.length) parsed.push({ type: 'flow', html: '' })
  parsed.forEach(function (b) {
    if (b.type === 'cols') addColsBlock(b.cols.length, b.cols)
    else addFlowBlock(b.html)
  })

  ready = true

  return {
    getValue: serialize,
    destroy: function () {
      blocks.forEach(function (b) {
        if (b.type === 'cols') b.editors.forEach(destroyEditor)
        else destroyEditor(b.editor)
      })
      blocks.length = 0
      mount.innerHTML = ''
    }
  }
}
