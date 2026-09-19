/** M4 实景选址对照：整屏平铺实景底图 + 发射场 / 着陆场定位针 + 矩形条件卡片弹窗 */
import { lessonData } from '../data/lessonData'
import type { SiteCompareItem } from '../types'
import { on } from '../utils/dom'
import { icon } from '../utils/icons'
import { animate, dur, ease } from '../utils/motion'
import { openLatSpeedDemo, closeLatSpeedDemo } from './latSpeedDemo'
import siteBg from '../../assets/images/发射场和着陆场.png'

type SiteKind = 'launch' | 'landing'

/** 底图原始像素尺寸（与 assets/images/发射场和着陆场.png 一致） */
const IMG_W = 1683
const IMG_H = 934

const SITE_META: Record<SiteKind, { label: string; title: string }> = {
  launch: { label: '发射场', title: '航天发射基地的选址条件' },
  landing: { label: '着陆场', title: '航天器着陆场的选址条件' }
}

/** 定位针在底图上的锚点（原图百分比，对应发射台与返回舱着陆点） */
const HOTSPOT_POS: Record<SiteKind, { x: number; y: number }> = {
  launch: { x: 16.2, y: 28 },
  landing: { x: 79.5, y: 75 }
}

/** 带「看线速度」入口的角度（纬度与自转线速度） */
const SPEED_ANGLE = '纬度因素'

let host: HTMLElement | null = null
let overlay: HTMLElement | null = null
let hotspots: HTMLButtonElement[] = []
let escHandler: ((ev: KeyboardEvent) => void) | null = null
let resizeHandler: (() => void) | null = null

function itemsOf(site: SiteKind): SiteCompareItem[] {
  return site === 'launch' ? lessonData.siteCompare.launch : lessonData.siteCompare.landing
}

/**
 * 底图以 object-fit: cover 铺满整屏，会被裁切。
 * 这里把「原图百分比锚点」换算成容器像素坐标，保证定位针始终落在实景位置上。
 */
function syncHotspots(): void {
  if (!host) return
  const cw = host.clientWidth
  const ch = host.clientHeight
  if (!cw || !ch) return
  const scale = Math.max(cw / IMG_W, ch / IMG_H)
  const offsetX = (cw - IMG_W * scale) / 2
  const offsetY = (ch - IMG_H * scale) / 2
  hotspots.forEach((spot) => {
    const pos = HOTSPOT_POS[spot.dataset.site as SiteKind]
    if (!pos) return
    spot.style.left = `${(offsetX + (pos.x / 100) * IMG_W * scale).toFixed(1)}px`
    spot.style.top = `${(offsetY + (pos.y / 100) * IMG_H * scale).toFixed(1)}px`
  })
}

/** 单张矩形条件卡：logo + 角度 + 条件描述 */
function cardHtml(item: SiteCompareItem): string {
  return `
    <li class="m4__card">
      <span class="m4__card-logo" aria-hidden="true">${icon(item.icon)}</span>
      <div class="m4__card-body">
        <div class="m4__card-head">
          <span class="m4__card-angle">${item.angle}</span>
          ${
            item.angle === SPEED_ANGLE
              ? '<button class="m4__card-more" type="button" data-act="speed">看线速度</button>'
              : ''
          }
        </div>
        <p class="m4__card-text">${item.text}</p>
      </div>
    </li>
  `
}

function closeSiteModal(): void {
  if (escHandler) {
    document.removeEventListener('keydown', escHandler)
    escHandler = null
  }
  overlay?.remove()
  overlay = null
}

function openSiteModal(site: SiteKind): void {
  closeSiteModal()
  closeLatSpeedDemo()
  const hostNode = document.getElementById('overlayHost')
  if (!hostNode) return

  const items = itemsOf(site)
  const meta = SITE_META[site]

  overlay = document.createElement('div')
  overlay.className = 'overlay m4__overlay'
  overlay.innerHTML = `
    <div class="m4__modal" role="dialog" aria-modal="true" aria-label="${meta.title}">
      <div class="m4__modal-head">
        <h3 class="m4__modal-title">${meta.title}</h3>
        <span class="m4__modal-sub">共 ${items.length} 条</span>
        <button class="m4__modal-close" type="button" data-act="close" aria-label="关闭">×</button>
      </div>
      <ul class="m4__cards">${items.map(cardHtml).join('')}</ul>
    </div>
  `
  hostNode.appendChild(overlay)

  overlay.querySelector('[data-act="close"]')?.addEventListener('click', closeSiteModal)
  on(overlay, 'click', (ev) => {
    if (ev.target === overlay) closeSiteModal()
  })
  overlay.querySelector('[data-act="speed"]')?.addEventListener('click', () => openLatSpeedDemo())

  overlay.querySelectorAll<HTMLElement>('.m4__card').forEach((card, i) => {
    card.style.opacity = '0'
    card.style.transform = 'translateY(14px)'
    animate(card, {
      opacity: 1,
      y: 0,
      duration: dur('base') / 1000,
      delay: i * 0.06,
      ease: ease('out')
    })
  })

  escHandler = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') return
    // 线速度演示叠在卡片弹窗之上时，Esc 优先关闭上层浮层
    if (document.querySelector('.overlay.lat')) return
    closeSiteModal()
  }
  document.addEventListener('keydown', escHandler)
}

export function initSiteCompare(root: HTMLElement): void {
  host = root
  closeSiteModal()
  closeLatSpeedDemo()

  const launchCount = lessonData.siteCompare.launch.length
  const landingCount = lessonData.siteCompare.landing.length

  root.classList.add('m4')
  root.innerHTML = `
    <img class="m4__bg" src="${siteBg}" alt="发射场与着陆场实景图" decoding="async" />
    <span class="m4__veil" aria-hidden="true"></span>
    <button class="m4__hotspot" type="button" data-site="launch">
      <span class="m4__hotspot-pin" aria-hidden="true">${icon('icon-pin', 40)}</span>
      <span class="m4__hotspot-label">${SITE_META.launch.label}</span>
    </button>
    <button class="m4__hotspot" type="button" data-site="landing">
      <span class="m4__hotspot-pin" aria-hidden="true">${icon('icon-pin', 40)}</span>
      <span class="m4__hotspot-label">${SITE_META.landing.label}</span>
    </button>
    <div class="sec-head m4__head">
      <h2 class="sec-title">任务一 · 一张图看两种选址</h2>
      <span class="sec-sub">点击选址查看条件 · 发射场 ${launchCount} 条 / 着陆场 ${landingCount} 条</span>
    </div>
    <p class="m4__hint">
      <span class="m4__hint-icon" aria-hidden="true">${icon('icon-info', 22)}</span>
      点图上「发射场」「着陆场」按钮，弹出对应选址条件卡片；「${SPEED_ANGLE}」卡片可打开线速度演示
    </p>
  `

  hotspots = Array.from(root.querySelectorAll<HTMLButtonElement>('.m4__hotspot'))
  hotspots.forEach((spot) => {
    on(spot, 'click', () => {
      const site = spot.dataset.site as SiteKind | undefined
      if (site) openSiteModal(site)
    })
  })

  syncHotspots()
  window.requestAnimationFrame(syncHotspots)

  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  resizeHandler = () => syncHotspots()
  window.addEventListener('resize', resizeHandler)
}

export function resetSiteCompare(): void {
  closeSiteModal()
  closeLatSpeedDemo()
  if (host) initSiteCompare(host)
}
