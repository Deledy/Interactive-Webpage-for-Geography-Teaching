/* ============================================================
   内容层 · 材料画布渲染器（课程与编辑器共用）
   ------------------------------------------------------------
   - view：课程页面 / 预览只读渲染；
   - edit：编辑器内渲染，支持选中、拖动、四角缩放、双击就地编辑；
   - 同一份 MaterialLayout 在两个场景使用同一个函数，不存在第二套渲染。

   交互约定（见 2026-10-31 调整文档 §4）：
   - 单击选中；按住对象拖动超过 3px 才真正移动（拖动阈值）；
   - 双击文字 / 表格进入编辑态，Esc 退出；编辑态下仍可拖顶部移动条；
   - 拖动开始时才写撤销快照，避免产生无意义的撤销记录；
   - 指针捕获保证快速拖出画布时不丢事件；
   - 拖动 / 缩放过程中直接改 DOM，松手时通过 onObjectCommit 写回结构化数据。
   ============================================================ */
import type { MaterialLayout, MaterialObject, SlotMaterialObject, TextMaterialObject } from './materialTypes'
import { sortedMaterialObjects } from './materialTypes'
import { isSafeImageSrc, sanitizeHtml } from './sanitize'
import './material.css'

export interface MaterialRenderOptions {
  mode?: 'view' | 'edit'
  /** 初始选中对象（编辑模式） */
  selectedId?: string | null
  /** 编辑模式缩放：'fit' 适应宽度，或固定倍数 */
  zoom?: 'fit' | number
  /** 题目槽内容（当前题的题块）；缺省渲染占位提示 */
  slotContent?: HTMLElement | null
  /** 无题目时的槽内提示 */
  slotPlaceholder?: string
  /** 新建文字对象的占位文案：首次进入编辑时自动清空 */
  textPlaceholder?: string
  onObjectSelect?: (id: string | null) => void
  /** 实时同步（拖动 / 输入过程中） */
  onObjectChange?: (id: string, patch: Partial<MaterialObject>) => void
  /** 一次操作开始（用于撤销快照） */
  onObjectBegin?: (id: string) => void
  /** 一次操作结束（写回并提交历史） */
  onObjectCommit?: (id: string, patch: Partial<MaterialObject>) => void
}

type RectPatch = Partial<Pick<MaterialObject, 'x' | 'y' | 'width' | 'height'>>

interface ObjectRect {
  x: number
  y: number
  width: number
  height: number
}

const HANDLES = ['nw', 'ne', 'sw', 'se'] as const
type Handle = (typeof HANDLES)[number]

const MIN_SIZE = 40

function escapeText(text: string): string {
  const holder = document.createElement('div')
  holder.textContent = String(text ?? '')
  return holder.innerHTML
}

/**
 * 粘贴清洗：去掉外部文档的字体 / 字号 / 颜色，只保留段落与行内结构。
 * 先取出 body 内容再走白名单，避免整份 Word HTML 的 html/body 外壳被跳过清洗。
 */
function sanitizePastedHtml(html: string): string {
  const holder = document.createElement('div')
  holder.innerHTML = html
  const body = holder.querySelector('body')
  const cleaned = sanitizeHtml((body ?? holder).innerHTML)
  const wrapper = document.createElement('div')
  wrapper.innerHTML = cleaned
  wrapper.querySelectorAll('div').forEach((node) => {
    const paragraph = document.createElement('p')
    paragraph.innerHTML = node.innerHTML
    node.replaceWith(paragraph)
  })
  /* 粘贴不继承外部文字颜色，统一走材料默认色 */
  wrapper.querySelectorAll<HTMLElement>('[style]').forEach((node) => {
    node.style.removeProperty('color')
    if (!node.getAttribute('style')) node.removeAttribute('style')
  })
  return wrapper.innerHTML
}

function plainTextToParagraphs(text: string): string {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => '<p>' + escapeText(line) + '</p>')
    .join('')
}
/** 拖动阈值：小于该位移视为点击，不移动也不写历史 */
const DRAG_THRESHOLD = 3

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function renderTextObject(object: TextMaterialObject): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'cq-material__object cq-material__object--text'

  const body = document.createElement('div')
  body.className = 'cq-material__text'
  const style = object.style ?? {}
  body.style.fontFamily = '"Times New Roman", ' + (style.fontFamily || '"KaiTi", "STKaiti", "Kaiti SC", serif')
  body.style.fontSize = `${style.fontSize ?? 20}px`
  body.style.fontWeight = style.fontWeight ?? 'normal'
  body.style.lineHeight = String(style.lineHeight ?? 1.7)
  body.style.textAlign = style.textAlign ?? 'left'
  body.style.color = style.color ?? '#1b1d19'
  if (style.backgroundColor) body.style.backgroundColor = style.backgroundColor
  body.style.justifyContent =
    style.verticalAlign === 'middle' ? 'center' : style.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start'
  body.innerHTML = sanitizeHtml(object.html)
  wrap.appendChild(body)
  return wrap
}

function renderTableObject(object: MaterialObject & { type: 'table' }): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'cq-material__object cq-material__object--table'
  const body = document.createElement('div')
  body.className = 'cq-material__table'
  body.innerHTML = sanitizeHtml(object.html)
  wrap.appendChild(body)
  return wrap
}

function renderImageObject(object: MaterialObject & { type: 'image' }): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'cq-material__object cq-material__object--image'

  const img = document.createElement('img')
  if (isSafeImageSrc(object.src)) img.src = object.src
  else wrap.classList.add('is-missing')
  img.alt = object.alt ?? ''
  img.draggable = false
  img.style.objectFit = object.objectFit ?? 'contain'
  img.addEventListener('error', () => wrap.classList.add('is-missing'))
  wrap.appendChild(img)

  const fallback = document.createElement('span')
  fallback.className = 'cq-material__missing'
  fallback.textContent = '图片加载失败'
  wrap.appendChild(fallback)
  return wrap
}

/** 按缩放比例换算：浏览器像素 → 逻辑坐标 */
function scaleOf(canvas: HTMLElement, layout: MaterialLayout): number {
  const rect = canvas.getBoundingClientRect()
  return rect.width > 0 ? rect.width / layout.width : 1
}

function applyRect(element: HTMLElement, object: MaterialObject): void {
  element.style.left = `${object.x}px`
  element.style.top = `${object.y}px`
  element.style.width = `${object.width}px`
  element.style.height = `${object.height}px`
  element.style.zIndex = String(object.zIndex ?? 0)
}

function readRect(object: MaterialObject): ObjectRect {
  return { x: object.x, y: object.y, width: object.width, height: object.height }
}

function clampRect(rect: ObjectRect, layout: MaterialLayout): ObjectRect {
  const width = clamp(rect.width, MIN_SIZE, layout.width)
  const height = clamp(rect.height, MIN_SIZE, layout.height)
  const x = clamp(rect.x, 0, layout.width - width)
  const y = clamp(rect.y, 0, layout.height - height)
  return { x, y, width, height }
}

function resizeRect(
  start: ObjectRect,
  handle: Handle,
  dx: number,
  dy: number,
  lockRatio: boolean
): ObjectRect {
  let x = start.x
  let y = start.y
  let width = start.width
  let height = start.height
  const ratio = start.width / Math.max(1, start.height)

  if (handle === 'ne' || handle === 'se') width = start.width + dx
  if (handle === 'nw' || handle === 'sw') {
    width = start.width - dx
    x = start.x + dx
  }
  if (handle === 'sw' || handle === 'se') height = start.height + dy
  if (handle === 'nw' || handle === 'ne') {
    height = start.height - dy
    y = start.y + dy
  }

  if (lockRatio && ratio > 0) {
    if (Math.abs(dx) >= Math.abs(dy)) height = width / ratio
    else width = height * ratio
    if (handle === 'nw' || handle === 'ne') y = start.y + (start.height - height)
    if (handle === 'nw' || handle === 'sw') x = start.x + (start.width - width)
  }

  return { x, y, width, height }
}

/**
 * 渲染材料画布。
 * 返回根元素 `.cq-material`，可直接放进课程窗口或编辑器。
 */
export function renderMaterialLayout(
  layout: MaterialLayout,
  renderOptions: MaterialRenderOptions = {}
): HTMLElement {
  const mode = renderOptions.mode ?? 'view'
  const editing = mode === 'edit'

  const root = document.createElement('div')
  root.className = `cq-material${editing ? ' cq-material--edit' : ''}`
  root.dataset.materialWidth = String(layout.width)
  root.dataset.materialHeight = String(layout.height)
  /* 画布最大按逻辑尺寸呈现，避免在宽屏课程窗口中被放大到字号失真 */
  root.style.maxWidth = `${layout.width}px`
  root.style.marginInline = 'auto'

  const viewport = document.createElement('div')
  viewport.className = 'cq-material__viewport'
  const canvas = document.createElement('div')
  canvas.className = 'cq-material__canvas'
  canvas.style.width = `${layout.width}px`
  canvas.style.height = `${layout.height}px`
  canvas.style.background = layout.background ?? '#ffffff'
  viewport.appendChild(canvas)
  root.appendChild(viewport)

  const objectElements = new Map<string, HTMLElement>()
  let selectedId: string | null = editing ? renderOptions.selectedId ?? null : null
  /** 编辑态：当前进入就地编辑的对象 */
  let editingId: string | null = null

  function renderSlotElement(object: SlotMaterialObject): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cq-material__object cq-material__object--slot'
    const body = document.createElement('div')
    body.className = 'cq-material__slot'
    if (renderOptions.slotContent) {
      body.appendChild(renderOptions.slotContent)
    } else {
      const empty = document.createElement('p')
      empty.className = 'cq-material__slot-empty'
      empty.textContent = renderOptions.slotPlaceholder ?? '还没有题目，点击「+ 插入题目」'
      body.appendChild(empty)
    }
    wrap.appendChild(body)
    /* 选项排列写在槽上，题块渲染时读取 */
    if (object.optionLayout) wrap.dataset.optionColumns = String(object.optionLayout.columns ?? 2)
    return wrap
  }

  function applyEditingState(): void {
    objectElements.forEach((element, id) => {
      const selected = editing && id === selectedId
      const editingNow = editing && id === editingId
      element.classList.toggle('is-selected', selected)
      element.classList.toggle('is-editing', editingNow)
      const textBody = element.querySelector<HTMLElement>('.cq-material__text')
      if (textBody) {
        /* 用属性而不是属性对象：jsdom 等环境不一定反射 contentEditable */
        textBody.setAttribute('contenteditable', editingNow ? 'true' : 'false')
        /* 未进入编辑态的正文不接收指针事件，拖动时可以直接命中对象本体 */
        textBody.classList.toggle('is-editable', editingNow)
      }
      element.querySelectorAll<HTMLElement>('.cq-material__table td, .cq-material__table th').forEach((cell) => {
        cell.setAttribute('contenteditable', editingNow ? 'true' : 'false')
      })
    })
  }

  function select(id: string | null, notify = true): void {
    if (!editing) return
    if (editingId && id !== editingId) editingId = null
    selectedId = id
    applyEditingState()
    if (notify) renderOptions.onObjectSelect?.(id)
  }

  function begin(id: string): void {
    renderOptions.onObjectBegin?.(id)
  }

  function commit(id: string, object: MaterialObject, patch: RectPatch): void {
    Object.assign(object, patch)
    if (renderOptions.onObjectCommit) renderOptions.onObjectCommit(id, patch)
    else renderOptions.onObjectChange?.(id, patch)
  }

  function capturePointer(element: HTMLElement, pointerId: number): void {
    if (typeof element.setPointerCapture !== 'function') return
    try {
      element.setPointerCapture(pointerId)
    } catch {
      /* 部分环境（jsdom / 旧浏览器）不支持指针捕获，窗口监听已兜底 */
    }
  }

  function releasePointer(element: HTMLElement, pointerId: number): void {
    if (typeof element.releasePointerCapture !== 'function') return
    try {
      element.releasePointerCapture(pointerId)
    } catch {
      /* ignore */
    }
  }

  /** 拖动：超过阈值才进入移动态并写撤销快照 */
  function startMove(event: PointerEvent, element: HTMLElement, object: MaterialObject): void {
    if (event.button !== 0) return
    const startX = event.clientX
    const startY = event.clientY
    const start = readRect(object)
    const scale = scaleOf(canvas, layout)
    const pointerId = typeof event.pointerId === 'number' ? event.pointerId : 1
    let started = false
    let patch: ObjectRect = { ...start }

    const onMove = (moveEvent: PointerEvent): void => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      if (!started) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
        started = true
        /* 拖动开始才阻止文字选择、写撤销快照、捕获指针 */
        moveEvent.preventDefault()
        element.classList.add('is-dragging')
        begin(object.id)
        capturePointer(element, pointerId)
      }
      patch = clampRect({ ...start, x: start.x + dx / (scale || 1), y: start.y + dy / (scale || 1) }, layout)
      element.style.left = `${patch.x}px`
      element.style.top = `${patch.y}px`
      renderOptions.onObjectChange?.(object.id, patch)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      element.classList.remove('is-dragging')
      releasePointer(element, pointerId)
      if (started) commit(object.id, object, patch)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function startResize(
    event: PointerEvent,
    element: HTMLElement,
    object: MaterialObject,
    handle: Handle
  ): void {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    begin(object.id)
    const startX = event.clientX
    const startY = event.clientY
    const start = readRect(object)
    const scale = scaleOf(canvas, layout)
    const pointerId = typeof event.pointerId === 'number' ? event.pointerId : 1
    const lock = object.type === 'image' && object.lockAspectRatio !== false && !event.shiftKey
    let patch: ObjectRect = { ...start }
    capturePointer(element, pointerId)

    const onMove = (moveEvent: PointerEvent): void => {
      const dx = (moveEvent.clientX - startX) / (scale || 1)
      const dy = (moveEvent.clientY - startY) / (scale || 1)
      patch = clampRect(resizeRect(start, handle, dx, dy, lock), layout)
      element.style.left = `${patch.x}px`
      element.style.top = `${patch.y}px`
      element.style.width = `${patch.width}px`
      element.style.height = `${patch.height}px`
      renderOptions.onObjectChange?.(object.id, patch)
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      releasePointer(element, pointerId)
      commit(object.id, object, patch)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function enterEditing(element: HTMLElement, object: MaterialObject, target: HTMLElement | null): void {
    if (!editing || (object.type !== 'text' && object.type !== 'table')) return
    editingId = object.id
    applyEditingState()
    const cell = target?.closest?.('.cq-material__table td, .cq-material__table th') as HTMLElement | null
    const body = element.querySelector<HTMLElement>('.cq-material__text')
    /* 新建文字对象的占位文案：进入编辑时清空，粘贴/输入直接替换，不用手动删 */
    const placeholder = renderOptions.textPlaceholder
    if (body && placeholder && body.textContent?.trim() === placeholder) {
      body.innerHTML = ''
      renderOptions.onObjectChange?.(object.id, { html: '' } as Partial<MaterialObject>)
    }
    const focusTarget = cell ?? body
    if (focusTarget?.focus) focusTarget.focus()
  }

  function decorate(element: HTMLElement, object: MaterialObject): void {
    element.dataset.materialObjectId = object.id
    element.classList.add(`cq-material__object--${object.type}`)
    applyRect(element, object)
    if (!editing) return

    element.dataset.objectType = object.type

    /* 顶部移动条：文字 / 表格 / 题目对象都能从这里稳定拖动 */
    const bar = document.createElement('span')
    bar.className = 'cq-material__bar'
    bar.dataset.bar = ''
    bar.title = '拖动'
    bar.innerHTML = '<span class="cq-material__bar-grip" aria-hidden="true"></span>'
    element.appendChild(bar)

    HANDLES.forEach((handle) => {
      const node = document.createElement('span')
      node.className = `cq-material__handle cq-material__handle--${handle}`
      node.dataset.handle = handle
      element.appendChild(node)
    })

    element.addEventListener('pointerdown', (event) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-handle]')) {
        const handle = target.closest<HTMLElement>('[data-handle]')!
        startResize(event as PointerEvent, element, object, handle.dataset.handle as Handle)
        return
      }
      /* 移动条始终可拖动，即使对象正处于就地编辑态 */
      if (target.closest('[data-bar]')) {
        event.stopPropagation()
        select(object.id)
        startMove(event as PointerEvent, element, object)
        return
      }

      /* 预览作答：题目槽内交给选项按钮，不触发整槽拖动 */
      if (target.closest('.cq-qobj') && renderOptions.mode !== 'edit') return

      const already = selectedId === object.id
      select(object.id)

      /* 编辑态下点正文是放光标 / 选文字，不拖动 */
      if (already && editingId === object.id) return
      if (target.closest('[contenteditable="true"]')) return
      /* 题目块内的按钮（删除 / 折叠 / 正确答案）只响应点击，不启动拖动 */
      if (target.closest('button, [data-answer-key]')) return
      startMove(event as PointerEvent, element, object)
    })

    /* 双击进入就地编辑：单击只负责选中，避免“一选就锁死拖动” */
    element.addEventListener('dblclick', (event) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-handle]') || target.closest('[data-bar]')) return
      enterEditing(element, object, target)
    })

    /* 文字 / 表格就地编辑：输入实时同步，失焦提交 */
    element.addEventListener('focusin', () => begin(object.id))
    element.addEventListener('input', () => {
      const textBody = element.querySelector<HTMLElement>('.cq-material__text')
      if (textBody) {
        renderOptions.onObjectChange?.(object.id, { html: textBody.innerHTML } as Partial<MaterialObject>)
        return
      }
      const table = element.querySelector<HTMLTableElement>('.cq-material__table table')
      if (table) renderOptions.onObjectChange?.(object.id, { html: table.outerHTML } as Partial<MaterialObject>)
    })
    element.addEventListener('focusout', () => {
      const textBody = element.querySelector<HTMLElement>('.cq-material__text')
      if (textBody) {
        const html = sanitizeHtml(textBody.innerHTML)
        textBody.innerHTML = html
        renderOptions.onObjectCommit?.(object.id, { html } as Partial<MaterialObject>)
        return
      }
      const table = element.querySelector<HTMLTableElement>('.cq-material__table table')
      if (table) {
        const html = sanitizeHtml(table.outerHTML)
        renderOptions.onObjectCommit?.(object.id, { html } as Partial<MaterialObject>)
      }
    })

    /* 粘贴：剥离外部文档的字体 / 字号 / 颜色，保证编辑态与失焦后一致 */
    element.addEventListener('paste', (event) => {
      const body = element.querySelector<HTMLElement>('.cq-material__text')
      if (!body) return
      const target = event.target as Node
      if (target !== body && !body.contains(target)) return
      const data = event.clipboardData
      if (!data) return
      /* 图片交给画布层的粘贴处理（转成图片对象），这里只处理文字 */
      const hasImage = Array.from(data.items || []).some((item) => item.type.startsWith('image/'))
      if (hasImage) return
      event.preventDefault()
      const html = data.getData('text/html')
      const text = data.getData('text/plain')
      const clean = html ? sanitizePastedHtml(html) : plainTextToParagraphs(text)
      if (clean) document.execCommand('insertHTML', false, clean)
    })
  }

  sortedMaterialObjects(layout.objects).forEach((object) => {
    if (object.visible === false) return
    let element: HTMLElement
    if (object.type === 'text') element = renderTextObject(object)
    else if (object.type === 'table') element = renderTableObject(object)
    else if (object.type === 'slot') element = renderSlotElement(object)
    else element = renderImageObject(object)
    decorate(element, object)
    objectElements.set(object.id, element)
    canvas.appendChild(element)
  })

  canvas.addEventListener('pointerdown', (event) => {
    if (!editing) return
    if (event.target === canvas) select(null)
  })

  /* Esc 退出就地编辑，回到选中态 */
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !editingId) return
    event.stopPropagation()
    const active = document.activeElement as HTMLElement | null
    editingId = null
    applyEditingState()
    if (active && active.blur) active.blur()
  })

  applyEditingState()

  function applyScale(): void {
    const width = viewport.clientWidth
    const zoom = renderOptions.zoom ?? 'fit'
    const scale = zoom === 'fit' ? (width > 0 ? width / layout.width : 1) : zoom
    canvas.style.transform = `scale(${scale})`
    viewport.style.height = `${Math.round(layout.height * scale)}px`
    root.style.setProperty('--cq-material-scale', String(scale))
  }

  applyScale()
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => applyScale())
    observer.observe(viewport)
    root.addEventListener('cq-material:destroy', () => observer.disconnect())
  }

  return root
}
