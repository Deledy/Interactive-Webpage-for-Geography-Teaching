/** M4 子模块：地球自转线速度讲解浮层（3D 剖切地球 + 纬度/线速度列表 + 赤道结论卡） */
import { lessonData } from '../data/lessonData'
import { animate, dur, ease, killTweensOf } from '../utils/motion'
import { highlight, on } from '../utils/dom'
import { icon } from '../utils/icons'
import { createLatGlobe, type LatGlobeHandle } from './latGlobe'
import type { LatitudePoint } from '../types'

const POINTS = lessonData.latitudePoints
const MAX = Math.max(...POINTS.map((point) => point.speed))
const HEAD = lessonData.latitudeTableHead
const CALLOUT = lessonData.latitudeCallout

let overlay: HTMLElement | null = null
let globe: LatGlobeHandle | null = null
let escHandler: ((ev: KeyboardEvent) => void) | null = null

/** 纬度分组：赤道 / 中纬 / 高纬（与 3D 模型配色一一对应） */
function bandOf(lat: number): 'equator' | 'mid' | 'high' {
  const abs = Math.abs(lat)
  if (abs < 1) return 'equator'
  return abs < 45 ? 'mid' : 'high'
}

/** 静态降级：剖面示意（过极点大圆 + 各纬线扇形楔 + 弧长标注；扇形跨度 70° 为放大示意，真实 15°） */
function fallbackSvg(): string {
  const cx = 168
  const cy = 164
  const R = 112
  const K = 0.3 // 纬线圆的透视压扁系数
  const bA = (15 * Math.PI) / 180
  const bM = (50 * Math.PI) / 180
  const bB = (85 * Math.PI) / 180

  // 与三维模型一致：只有北半球与赤道带扇形楔，纬度名保留全部 5 个
  const wedges = POINTS.filter((point) => point.lat >= 0).map((point) => {
    const phi = (point.lat * Math.PI) / 180
    const ay = cy - R * Math.sin(phi)
    const rx = R * Math.cos(phi)
    const ry = rx * K
    const band = bandOf(point.lat)
    const xA = cx + rx * Math.sin(bA)
    const yA = ay + ry * Math.cos(bA)
    const xB = cx + rx * Math.sin(bB)
    const yB = ay + ry * Math.cos(bB)
    const mx = cx + rx * 1.34 * Math.sin(bM)
    const my = ay + ry * 1.34 * Math.cos(bM) + 4
    return `
      <path class="lat__f-wedge" data-band="${band}"
        d="M ${cx} ${ay.toFixed(1)} L ${xA.toFixed(1)} ${yA.toFixed(1)} A ${rx.toFixed(1)} ${ry.toFixed(1)} 0 0 0 ${xB.toFixed(1)} ${yB.toFixed(1)} Z" />
      <text class="lat__f-arc" x="${mx.toFixed(1)}" y="${my.toFixed(1)}" text-anchor="middle">${point.arcKm} km</text>
    `
  }).join('')
  const names = POINTS.map((point) => {
    const ay = cy - R * Math.sin((point.lat * Math.PI) / 180)
    return `<text class="lat__f-label" x="${cx - 12}" y="${(ay + 5).toFixed(1)}" text-anchor="end">${point.name}</text>`
  }).join('')

  return `
    <svg class="lat__fallback" viewBox="0 0 336 336" role="img" aria-label="地球自转线速度剖面示意（静态）">
      <circle class="lat__f-globe" cx="${cx}" cy="${cy}" r="${R}" />
      <line class="lat__f-axis" x1="${cx}" y1="${cy - R - 16}" x2="${cx}" y2="${cy + R + 16}" />
      ${wedges}
      ${names}
      <text class="lat__f-label lat__f-label--pole" x="${cx}" y="${cy - R - 12}" text-anchor="middle">北极</text>
      <text class="lat__f-label lat__f-label--pole" x="${cx}" y="${cy + R + 20}" text-anchor="middle">南极</text>
      <text class="lat__f-label" x="${cx - 10}" y="${cy + 24}" text-anchor="end">地心</text>
    </svg>
  `
}

function rowsHtml(): string {
  return POINTS.map(
    (point: LatitudePoint) => `
    <li class="lat__row" data-band="${bandOf(point.lat)}">
      <span class="lat__name">${point.name}</span>
      <span class="lat__track"><i class="lat__fill" style="transform:scaleX(0)"></i></span>
      <span class="lat__val num" data-speed="${point.speed}">0<em class="lat__unit">${point.meter}</em></span>
    </li>
  `
  ).join('')
}

/** 播放列表动效：对比条按速度比例伸长 + 数字滚动 */
function play(): void {
  if (!overlay) return
  const rows = Array.from(overlay.querySelectorAll<HTMLElement>('.lat__row'))
  const step = 0.1

  rows.forEach((row, i) => {
    const point = POINTS[i]
    if (!point) return
    const fill = row.querySelector<HTMLElement>('.lat__fill')
    const val = row.querySelector<HTMLElement>('.lat__val')
    if (fill) {
      killTweensOf(fill)
      fill.style.transform = 'scaleX(0)'
      animate(fill, {
        scaleX: point.speed / MAX,
        duration: dur('base') / 1000,
        delay: i * step,
        ease: ease('out')
      })
    }
    if (val) {
      const proxy = { value: 0 }
      killTweensOf(proxy)
      animate(proxy, {
        value: point.speed,
        duration: dur('base') / 1000,
        delay: i * step,
        ease: ease('out'),
        onUpdate: () => {
          val.innerHTML = `${Math.round(proxy.value)}<em class="lat__unit">${point.meter}</em>`
        },
        onComplete: () => {
          val.innerHTML = `${point.speed}<em class="lat__unit">${point.meter}</em>`
        }
      })
    }
  })
}

export function openLatSpeedDemo(): void {
  closeLatSpeedDemo()
  const host = document.getElementById('overlayHost')
  if (!host) return

  overlay = document.createElement('div')
  overlay.className = 'overlay lat'
  overlay.innerHTML = `
    <div class="overlay__card lat__card">
      <div class="lat__head">
        <h3 class="lat__title">地球自转的线速度</h3>
        <div class="lat__actions">
          <button class="btn btn--ghost" type="button" data-act="replay">重播</button>
          <button class="lat__close" type="button" data-act="close" aria-label="关闭">${icon('icon-close', 22)}</button>
        </div>
      </div>
      <p class="lat__sub">${highlight(lessonData.latitudeSubtitle, lessonData.latitudeSubtitleKeys)}</p>
      <div class="lat__body">
        <div class="lat__left">
          <div class="lat__stage"></div>
        </div>
        <div class="lat__right">
          <div class="lat__thead">
            <span>${HEAD.lat}</span>
            <span>${HEAD.speed}</span>
          </div>
          <ul class="lat__rows">${rowsHtml()}</ul>
          <div class="lat__callout">
            <span class="lat__callout-icon" aria-hidden="true">${icon('icon-rocket', 36)}</span>
            <div class="lat__callout-body">
              <p class="lat__callout-text">${CALLOUT.text}</p>
              <p class="lat__callout-value">${CALLOUT.valueLabel} <b>${CALLOUT.value}</b><em>${CALLOUT.unit}</em></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
  host.appendChild(overlay)

  // 3D 地球模型（WebGL 不可用时降级为静态 SVG 示意）
  const stage = overlay.querySelector<HTMLElement>('.lat__stage')
  if (stage) {
    globe = createLatGlobe(stage, POINTS)
    if (!globe) stage.innerHTML = fallbackSvg()
  }

  overlay.querySelector('[data-act="close"]')?.addEventListener('click', () => closeLatSpeedDemo())
  overlay.querySelector('[data-act="replay"]')?.addEventListener('click', play)
  on(overlay, 'click', (ev) => {
    if (ev.target === overlay) closeLatSpeedDemo()
  })

  escHandler = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') closeLatSpeedDemo()
  }
  document.addEventListener('keydown', escHandler)

  play()
}

export function closeLatSpeedDemo(): void {
  if (escHandler) {
    document.removeEventListener('keydown', escHandler)
    escHandler = null
  }
  globe?.dispose()
  globe = null
  overlay?.remove()
  overlay = null
}
