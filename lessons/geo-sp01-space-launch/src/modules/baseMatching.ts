/**
 * M5 四大发射基地选址条件（技术重点）
 * - 底图：ECharts geo（离线内联的中国省级边界数据，主体图与南海诸岛附图各一个实例）
 * - 四角基地框 + SVG 折线引线：引线端点由 chart.convertToPixel 反算，随容器尺寸重算
 * - 自研 Pointer Events 拖拽（条件胶囊不消耗，可重复拖向多个基地）
 * - 点击降级路径：先点条件胶囊选中，再点基地框投放；框内已挂载胶囊可点击取回
 * - 判定数据完全来自 lessonData.bases[].conditionIds，模块内不硬编码归属
 */
import * as echarts from 'echarts/core'
import { MapChart, ScatterChart } from 'echarts/charts'
import { GeoComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { lessonData } from '../data/lessonData'
import { CHINA_MAIN_GEO, CHINA_NANHAI_GEO } from '../data/chinaGeo'
import { on } from '../utils/dom'
import { icon } from '../utils/icons'
import { animate, dur, ease } from '../utils/motion'
import { toast } from '../utils/toast'
import { markDone } from '../state'

const BASES = lessonData.bases
const POOL = lessonData.conditionPool
const TEXT = lessonData.baseTask

/** registerMap 注册名（模块内常量） */
const MAP_MAIN = 'china-main'
const MAP_NANHAI = 'china-nanhai'

type MapSource = Parameters<typeof echarts.registerMap>[1]
type Chart = ReturnType<typeof echarts.init>

echarts.use([MapChart, ScatterChart, GeoComponent, CanvasRenderer])
echarts.registerMap(MAP_MAIN, CHINA_MAIN_GEO as unknown as MapSource)
echarts.registerMap(MAP_NANHAI, CHINA_NANHAI_GEO as unknown as MapSource)

let host: HTMLElement | null = null
let chart: Chart | null = null
let insetChart: Chart | null = null
let observer: ResizeObserver | null = null
let cards: HTMLButtonElement[] = []
let boxes: HTMLElement[] = []
let leaderSvg: SVGSVGElement | null = null
let selectedId: string | null = null
/** baseId → 已挂载条件 id */
const mounted = new Map<string, Set<string>>()
/** 特效只播放一次 */
let effectPlayed = false

/* ---------------- 令牌与地图配色 ---------------- */

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** 转成带透明度的颜色（canvas 不支持 color-mix，需手动换算） */
function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1]
    const num = Number.parseInt(raw, 16)
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color.trim())
  if (rgb) {
    const [r, g, b] = rgb[1].split(',').map((part) => Number.parseFloat(part))
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return color
}

/** 地图配色（全部来自 tokens.css，不写魔法色值） */
function palette(): {
  area: string
  areaHover: string
  border: string
  borderHover: string
  label: string
  dot: string
  dotRing: string
} {
  const panel2 = cssVar('--c-panel-2', '#111c31')
  const line = cssVar('--c-line', 'rgba(53, 198, 244, 0.28)')
  const lineStrong = cssVar('--c-line-strong', 'rgba(53, 198, 244, 0.6)')
  const primary = cssVar('--c-primary', '#35c6f4')
  const warm = cssVar('--c-accent-warm', '#ffb020')
  return {
    area: withAlpha(panel2, 0.82),
    areaHover: withAlpha(primary, 0.22),
    border: line,
    borderHover: lineStrong,
    label: cssVar('--c-text', '#e8eff8'),
    dot: warm,
    dotRing: withAlpha(warm, 0.28)
  }
}

/* ---------------- 地图 ---------------- */

function mapOption(): Record<string, unknown> {
  const c = palette()
  return {
    animation: false,
    backgroundColor: 'transparent',
    geo: {
      map: MAP_MAIN,
      roam: false,
      left: '2%',
      right: '2%',
      top: '4%',
      bottom: '4%',
      itemStyle: { areaColor: c.area, borderColor: c.border, borderWidth: 1 },
      label: { show: false },
      emphasis: {
        itemStyle: { areaColor: c.areaHover, borderColor: c.borderHover },
        label: { show: true, color: c.label, fontSize: 15 }
      }
    },
    series: [
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        geoIndex: 0,
        symbolSize: 13,
        silent: true,
        itemStyle: {
          color: c.dot,
          borderColor: c.dotRing,
          borderWidth: 6,
          shadowBlur: 14,
          shadowColor: c.dotRing
        },
        data: BASES.map((base) => ({ name: base.name, value: [base.lon, base.lat] }))
      }
    ]
  }
}

/** 南海诸岛附图（独立实例，边框与标注由 CSS 负责） */
function insetOption(): Record<string, unknown> {
  const c = palette()
  return {
    animation: false,
    backgroundColor: 'transparent',
    geo: {
      map: MAP_NANHAI,
      roam: false,
      left: '8%',
      right: '8%',
      top: '6%',
      bottom: '6%',
      itemStyle: { areaColor: withAlpha(cssVar('--c-primary', '#35c6f4'), 0.55), borderColor: c.border, borderWidth: 0.6 },
      label: { show: false },
      silent: true,
      // 南海断续线（十段线）：以线色填充细长多边形，呈断续线效果
      regions: [{ name: '南海断续线', itemStyle: { areaColor: c.borderHover, borderColor: c.borderHover } }]
    }
  }
}

/* ---------------- 引线布局 ---------------- */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 取矩形上离目标点最近的边界点（百分比坐标） */
function nearestOnRect(
  rect: { left: number; top: number; right: number; bottom: number },
  point: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: clamp(point.x, rect.left, rect.right),
    y: clamp(point.y, rect.top, rect.bottom)
  }
}

/** 按基地框实际位置与基地在地图上的像素位置计算折线端点 */
function layoutLeaders(): void {
  if (!leaderSvg || !chart || !host) return
  const stage = host.querySelector<HTMLElement>('.m5__stage')
  const mapEl = host.querySelector<HTMLElement>('.m5__map')
  if (!stage || !mapEl) return
  const stageRect = stage.getBoundingClientRect()
  const mapRect = mapEl.getBoundingClientRect()
  if (stageRect.width === 0 || mapRect.width === 0) return

  boxes.forEach((box) => {
    const baseId = box.dataset.base
    const base = BASES.find((item) => item.id === baseId)
    const path = leaderSvg?.querySelector<SVGPathElement>(`path[data-base="${baseId}"]`)
    if (!base || !path) return
    let pixel: number[] | null = null
    try {
      pixel = chart?.convertToPixel({ geoIndex: 0 }, [base.lon, base.lat]) ?? null
    } catch {
      pixel = null
    }
    if (!pixel || Number.isNaN(pixel[0]) || Number.isNaN(pixel[1])) {
      path.removeAttribute('d')
      return
    }
    // 地图像素坐标 → 舞台百分比
    const from = {
      x: ((mapRect.left - stageRect.left + pixel[0]) / stageRect.width) * 100,
      y: ((mapRect.top - stageRect.top + pixel[1]) / stageRect.height) * 100
    }
    const rect = box.getBoundingClientRect()
    const boxRect = {
      left: ((rect.left - stageRect.left) / stageRect.width) * 100,
      right: ((rect.right - stageRect.left) / stageRect.width) * 100,
      top: ((rect.top - stageRect.top) / stageRect.height) * 100,
      bottom: ((rect.bottom - stageRect.top) / stageRect.height) * 100
    }
    const to = nearestOnRect(boxRect, from)
    const elbow = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
    path.setAttribute('d', `M ${from.x} ${from.y} L ${elbow.x} ${elbow.y} L ${to.x} ${to.y}`)
  })
}

/** 容器尺寸变化：先让图表重算，再重排引线 */
function relayout(): void {
  chart?.resize()
  insetChart?.resize()
  layoutLeaders()
}

/**
 * 预占高度：按"该基地条件全部挂载后"的尺寸给框设 min-height，
 * 使四个框在投放前就与投放后一样大（不在投放过程中变大、位置不跳动）。
 * 探针用真实胶囊同款结构与样式，量完即拆；框宽变化（全屏 / 缩放）时需重算。
 */
function reserveBoxHeights(): void {
  BASES.forEach((base) => {
    const box = boxes.find((item) => item.dataset.base === base.id)
    const slots = box?.querySelector<HTMLElement>('.m5__slots')
    if (!box || !slots) return

    const probe = document.createElement('div')
    probe.className = 'm5__slots m5__slots--probe'
    base.conditionIds.forEach((id) => {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'm5__slot'
      item.innerHTML = slotHtml(id)
      probe.appendChild(item)
    })

    // 量高时临时隐藏真实胶囊与占位提示，避免已挂载部分叠加进测量结果
    const prevDisplay = slots.style.display
    const wasFilled = box.classList.contains('is-filled')
    slots.style.display = 'none'
    box.classList.add('is-filled')
    box.appendChild(probe)
    const full = box.getBoundingClientRect().height
    probe.remove()
    slots.style.display = prevDisplay
    if (!wasFilled) box.classList.remove('is-filled')

    box.style.minHeight = `${Math.ceil(full)}px`
  })
}

/* ---------------- 判定与挂载 ---------------- */

function boxAt(x: number, y: number): HTMLElement | null {
  return (
    boxes.find((box) => {
      const rect = box.getBoundingClientRect()
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    }) ?? null
  )
}

function setTargets(on_: boolean): void {
  boxes.forEach((box) => box.classList.toggle('is-target', on_ && !box.classList.contains('is-done')))
}

function selectCard(card: HTMLButtonElement | null): void {
  selectedId = card?.dataset.id ?? null
  cards.forEach((item) => {
    const active = item === card
    item.classList.toggle('is-active', active)
    item.setAttribute('aria-pressed', String(active))
  })
}

/** 条件胶囊上显示"已挂载到几个基地"，并按需点亮已使用标记 */
function syncCard(id: string): void {
  const card = cards.find((item) => item.dataset.id === id)
  const count = card?.querySelector<HTMLElement>('.m5__card-count')
  const used = BASES.filter((entry) => (mounted.get(entry.id) ?? new Set<string>()).has(id)).length
  if (count) count.textContent = String(used)
  card?.classList.toggle('is-armed', used > 0)
}

function syncBox(baseId: string): void {
  const base = BASES.find((item) => item.id === baseId)
  const box = boxes.find((item) => item.dataset.base === baseId)
  if (!base || !box) return
  const set = mounted.get(baseId) ?? new Set<string>()
  const badge = box.querySelector<HTMLElement>('.m5__box-count')
  if (badge) badge.textContent = `${set.size} / ${base.conditionIds.length}`
  box.classList.toggle('is-filled', set.size > 0)
  const done = set.size === base.conditionIds.length
  box.classList.toggle('is-done', done)
  const state = box.querySelector<HTMLElement>('.m5__box-state')
  if (state) state.innerHTML = done ? icon('icon-check', 22) : ''
  const path = leaderSvg?.querySelector(`path[data-base="${baseId}"]`)
  path?.classList.toggle('is-done', done)
  const all = BASES.every((entry) => (mounted.get(entry.id) ?? new Set()).size === entry.conditionIds.length)
  markDone('m5', all)
  if (all) playLaunchEffect()
}

function slotHtml(id: string): string {
  const item = POOL.find((entry) => entry.id === id)
  if (!item) return ''
  return `<b class="m5__slot-index">${item.index}</b><span class="m5__slot-text">${item.text}</span>`
}

/** 取回某基地已挂载的条件（课堂纠错，不计错） */
function unmount(baseId: string, id: string): void {
  const set = mounted.get(baseId)
  const base = BASES.find((item) => item.id === baseId)
  const box = boxes.find((item) => item.dataset.base === baseId)
  const item = POOL.find((entry) => entry.id === id)
  if (!set?.has(id) || !base || !box || !item) return
  set.delete(id)
  box.querySelector<HTMLElement>(`.m5__slot[data-id="${id}"]`)?.remove()
  syncBox(baseId)
  syncCard(id)
  toast(`已取回：${item.index}${item.text}`, 'info')
  layoutLeaders()
}

function mount(baseId: string, id: string): void {
  const base = BASES.find((item) => item.id === baseId)
  const box = boxes.find((item) => item.dataset.base === baseId)
  const card = cards.find((item) => item.dataset.id === id)
  const item = POOL.find((entry) => entry.id === id)
  if (!base || !box || !card || !item) return

  const set = mounted.get(baseId) ?? new Set<string>()
  if (set.has(id)) {
    toast('这条条件已挂载到该基地', 'info')
    return
  }
  set.add(id)
  mounted.set(baseId, set)

  const slot = document.createElement('button')
  slot.type = 'button'
  slot.className = 'm5__slot'
  slot.dataset.id = id
  slot.title = '点击取回这条条件'
  slot.innerHTML = slotHtml(id)
  box.querySelector('.m5__slots')?.appendChild(slot)
  on(slot, 'click', (ev) => {
    // 阻止冒泡：避免触发基地框的"点击投放"降级路径
    ev.stopPropagation()
    unmount(baseId, id)
  })
  animate(slot, { opacity: 1, y: 0, duration: dur('base') / 1000, ease: ease('back') })

  syncBox(baseId)
  syncCard(id)
  toast(`已挂载：${item.index}${item.text}`, 'ok')
  layoutLeaders()
}

function reject(baseId: string, id: string): void {
  const base = BASES.find((item) => item.id === baseId)
  const box = boxes.find((item) => item.dataset.base === baseId)
  const card = cards.find((item) => item.dataset.id === id)
  if (!base || !box || !card) return

  box.classList.add('is-reject')
  window.setTimeout(() => box.classList.remove('is-reject'), dur('slow'))
  card.classList.remove('is-shake')
  void card.offsetWidth
  card.classList.add('is-shake')
  window.setTimeout(() => card.classList.remove('is-shake'), dur('slow'))
  toast(`这条条件与${base.name}的匹配关系不成立`, 'err')
}

function judge(baseId: string, id: string): void {
  const base = BASES.find((item) => item.id === baseId)
  if (!base) return
  if (base.conditionIds.includes(id)) mount(baseId, id)
  else reject(baseId, id)
}

/* ---------------- 拖拽（Pointer Events） ---------------- */

function makeGhost(card: HTMLButtonElement, x: number, y: number): HTMLElement {
  const rect = card.getBoundingClientRect()
  const ghost = card.cloneNode(true) as HTMLElement
  ghost.classList.remove('is-active', 'is-armed')
  ghost.classList.add('m5__ghost')
  ghost.style.width = `${rect.width}px`
  ghost.style.left = `${x - rect.width / 2}px`
  ghost.style.top = `${y - rect.height / 2}px`
  document.body.appendChild(ghost)
  return ghost
}

function bindDrag(card: HTMLButtonElement): void {
  on(card, 'pointerdown', (ev) => {
    if (ev.button !== 0) return
    const id = card.dataset.id
    if (!id) return
    let ghost: HTMLElement | null = null
    let moved = false
    const startX = ev.clientX
    const startY = ev.clientY

    const move = (e: PointerEvent): void => {
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 6) return
      if (!moved) {
        moved = true
        ghost = makeGhost(card, startX, startY)
        card.classList.add('is-dragging')
        setTargets(true)
      }
      const rect = ghost!.getBoundingClientRect()
      ghost!.style.left = `${e.clientX - rect.width / 2}px`
      ghost!.style.top = `${e.clientY - rect.height / 2}px`
    }

    const up = (e: PointerEvent): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      ghost?.remove()
      card.classList.remove('is-dragging')
      setTargets(false)
      if (!moved) {
        // 视为点击：切换选中（点击降级路径）
        selectCard(selectedId === id ? null : card)
        return
      }
      const box = boxAt(e.clientX, e.clientY)
      if (!box) return
      judge(box.dataset.base ?? '', id)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  })

  // 键盘激活（Enter / Space 触发 click 且 detail 为 0）
  on(card, 'click', (ev) => {
    if (ev.detail !== 0) return
    const id = card.dataset.id
    if (id) selectCard(selectedId === id ? null : card)
  })
}

/* ---------------- 全部完成的"发射成功"特效（仅一次） ---------------- */

function playLaunchEffect(): void {
  if (effectPlayed) return
  effectPlayed = true
  const overlayHost = document.getElementById('overlayHost')
  if (!overlayHost) return

  const overlay = document.createElement('div')
  overlay.className = 'overlay m5__effect'
  overlay.innerHTML = `
    <div class="overlay__card m5__result">
      <p class="m5__result-title">发射成功</p>
      <p class="m5__result-text">四大发射基地的选址条件已全部挂载完成</p>
      <div class="m5__result-actions">
        <button type="button" class="btn btn--primary" data-act="close">继续</button>
      </div>
    </div>
  `
  const arc = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  arc.setAttribute('class', 'm5__effect-arc')
  arc.setAttribute('viewBox', '0 0 1200 480')
  arc.setAttribute('preserveAspectRatio', 'xMidYMid slice')
  arc.innerHTML = `
    <path class="m5__orbit" id="m5Orbit" d="M 120 420 C 420 400 760 260 1080 60" />
    <g class="m5__sparks" id="m5Sparks"></g>
    <circle class="m5__capsule" id="m5Capsule" cx="120" cy="420" r="10" />
  `
  overlay.insertBefore(arc, overlay.firstChild)
  overlayHost.appendChild(overlay)

  const close = (): void => {
    overlay.remove()
  }
  overlay.querySelector('[data-act="close"]')?.addEventListener('click', close)

  const path = arc.querySelector<SVGPathElement>('#m5Orbit')
  const capsule = arc.querySelector<SVGCircleElement>('#m5Capsule')
  const sparks = arc.querySelector<SVGGElement>('#m5Sparks')
  if (!path || !capsule || !sparks) {
    overlay.querySelector('.m5__result')?.classList.add('is-ready')
    return
  }

  const total = path.getTotalLength()
  path.style.strokeDasharray = String(total)
  path.style.strokeDashoffset = String(total)

  const proxy = { p: 0 }
  animate(
    proxy,
    {
      p: 1,
      duration: dur('hero') / 1000,
      ease: ease('out'),
      onUpdate: () => {
        path.style.strokeDashoffset = String(total * (1 - proxy.p))
        const point = path.getPointAtLength(total * proxy.p)
        capsule.setAttribute('cx', String(point.x))
        capsule.setAttribute('cy', String(point.y))
      }
    },
    () => {
      path.style.strokeDashoffset = '0'
      // 尾焰粒子：一次性扩散后淡出
      const point = path.getPointAtLength(total)
      for (let i = 0; i < 12; i += 1) {
        const angle = (-70 + (140 / 11) * i) * (Math.PI / 180)
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        dot.setAttribute('class', 'm5__spark')
        dot.setAttribute('cx', String(point.x))
        dot.setAttribute('cy', String(point.y))
        dot.setAttribute('r', '4')
        sparks.appendChild(dot)
        animate(dot, {
          attr: { cx: point.x + Math.cos(angle) * 90, cy: point.y + Math.sin(angle) * 90 },
          opacity: 0,
          duration: dur('slow') / 1000,
          delay: i * 0.02,
          ease: ease('out')
        })
      }
      overlay.querySelector('.m5__result')?.classList.add('is-ready')
    }
  )
}

/* ---------------- 渲染 ---------------- */

function boxHtml(base: (typeof BASES)[number]): string {
  return `
    <div class="m5__box" data-base="${base.id}" data-slot="${base.slot}">
      <div class="m5__box-head">
        <span class="m5__box-name">${base.name}</span>
        <span class="m5__box-state" aria-hidden="true"></span>
      </div>
      <div class="m5__box-meta">
        <span class="m5__box-loc">${base.location}</span>
        <span class="m5__box-count num">0 / ${base.conditionIds.length}</span>
      </div>
      <div class="m5__slots"><span class="m5__placeholder">拖入条件胶囊</span></div>
    </div>
  `
}

function cardHtml(item: (typeof POOL)[number]): string {
  return `
    <button class="m5__card" type="button" data-id="${item.id}" aria-pressed="false">
      <b class="m5__card-index">${item.index}</b>
      <span class="m5__card-text">${item.text}</span>
      <span class="m5__card-count" aria-hidden="true"></span>
    </button>
  `
}

function disposeCharts(): void {
  observer?.disconnect()
  observer = null
  chart?.dispose()
  chart = null
  insetChart?.dispose()
  insetChart = null
}

export function initBaseMatching(root: HTMLElement): void {
  disposeCharts()
  host = root
  mounted.clear()
  effectPlayed = false
  selectedId = null
  BASES.forEach((base) => mounted.set(base.id, new Set()))
  document.querySelectorAll('.m5__effect').forEach((node) => node.remove())

  root.classList.add('m5')
  root.innerHTML = `
    <div class="sec-head">
      <h2 class="sec-title">${TEXT.title}</h2>
      <span class="sec-sub">${TEXT.subtitle}</span>
    </div>
    <div class="m5__stage">
      <div class="m5__board">
        <div class="m5__map"></div>
        <div class="m5__inset" aria-hidden="true">
          <div class="m5__inset-map"></div>
          <span class="m5__inset-label">南海诸岛</span>
        </div>
      </div>
      <svg class="m5__leaders" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        ${BASES.map((base) => `<path data-base="${base.id}" />`).join('')}
      </svg>
      ${BASES.map(boxHtml).join('')}
    </div>
    <div class="m5__pool panel panel--hud">
      <span class="m5__pool-title">有利条件（拖动到对应基地框中）</span>
      <div class="m5__cards">${POOL.map(cardHtml).join('')}</div>
    </div>
    <div class="m5__foot">
      <p class="hint">拖动条件胶囊到基地框即可挂载；同一张胶囊可拖向多个基地，框内胶囊点击可取回</p>
      <div class="m5__foot-side">
        <span class="m5__note">${lessonData.mapNote}</span>
        <button class="btn btn--ghost" type="button" data-act="reset">重置本模块</button>
      </div>
    </div>
  `

  leaderSvg = root.querySelector<SVGSVGElement>('.m5__leaders')
  boxes = Array.from(root.querySelectorAll<HTMLElement>('.m5__box'))
  cards = Array.from(root.querySelectorAll<HTMLButtonElement>('.m5__card'))

  // 先按"满挂载"尺寸占好四个框的高度，再起图表（避免投放过程中框体变大）
  reserveBoxHeights()

  const mapEl = root.querySelector<HTMLElement>('.m5__map')
  const insetEl = root.querySelector<HTMLElement>('.m5__inset-map')
  if (mapEl) {
    chart = echarts.init(mapEl, undefined, { renderer: 'canvas' })
    chart.setOption(mapOption())
  }
  if (insetEl) {
    insetChart = echarts.init(insetEl, undefined, { renderer: 'canvas' })
    insetChart.setOption(insetOption())
  }

  cards.forEach(bindDrag)
  boxes.forEach((box) => {
    on(box, 'click', () => {
      if (!selectedId) return
      judge(box.dataset.base ?? '', selectedId)
    })
  })

  root.querySelector('[data-act="reset"]')?.addEventListener('click', () => initBaseMatching(root))

  // 舞台或基地框尺寸变化（窗口缩放 / 全屏 / 框内内容增减）→ 图表与引线同步重算；
  // 舞台宽度变化时胶囊换行会不同，需重新按满挂载尺寸占高
  const stage = root.querySelector<HTMLElement>('.m5__stage')
  if (stage && typeof ResizeObserver !== 'undefined') {
    let lastWidth = stage.getBoundingClientRect().width
    observer = new ResizeObserver(() => {
      const width = stage.getBoundingClientRect().width
      if (Math.abs(width - lastWidth) > 0.5) {
        lastWidth = width
        reserveBoxHeights()
      }
      relayout()
    })
    observer.observe(stage)
    boxes.forEach((box) => observer?.observe(box))
  }
  relayout()
}

export function resetBaseMatching(): void {
  disposeCharts()
  document.querySelectorAll('.m5__effect').forEach((node) => node.remove())
  if (host) initBaseMatching(host)
}
