/** 选址条件表（M2 发射基地 / M3 着陆场共用）：材料描述默认全部呈现，点行内唯一「点击查看」展开整行 */
import type { SiteCondition } from '../types'
import { on, highlight } from '../utils/dom'
import { icon } from '../utils/icons'
import { animate, dur, ease } from '../utils/motion'
import { toast } from '../utils/toast'
import { markDone, store } from '../state'

export interface ConditionsTableConfig {
  /** 所属屏幕 id：用于键盘监听与完成标记 */
  screen: string
  /** 模块标题 */
  title: string
  /** 右上角徽标文案（条数由数据长度自动补全） */
  badge: string
  /** 标题下导语 */
  intro: string
  /** 表格下方操作提示 */
  tip: string
  /** 条件数据（材料描述 / 描述角度 / 有利条件 / 关键词） */
  rows: SiteCondition[]
}

/** 每行：材料描述常显；「描述角度 + 有利条件」两栏之间只有一枚「点击查看」 */
function rowHtml(item: SiteCondition, index: number): string {
  return `
    <div class="ct__row" data-index="${index}">
      <span class="ct__idx">${String(index + 1).padStart(2, '0')}</span>
      <div class="ct__cell ct__cell--mat">
        <p class="ct__text">${highlight(item.material, item.keywords)}</p>
      </div>
      <div class="ct__cell ct__cell--detail">
        <div class="ct__detail">
          <p class="ct__value ct__value--angle"><span class="angle-tag">${item.angle}</span></p>
          <p class="ct__value ct__value--benefit"><span class="ct__benefit">${item.benefit}</span></p>
        </div>
        <button class="ct__peek" type="button" aria-label="第 ${index + 1} 条：点击查看描述角度与有利条件">
          ${icon('icon-eye', 30)}<span>点击查看</span>
        </button>
      </div>
    </div>
  `
}

export function createConditionsTable(config: ConditionsTableConfig): {
  init: (root: HTMLElement) => void
  reset: () => void
} {
  const { screen, title, badge, intro, tip, rows: ROWS } = config

  let host: HTMLElement | null = null
  let rowNodes: HTMLElement[] = []
  let doneBtn: HTMLButtonElement | null = null
  let progressNode: HTMLElement | null = null
  let revealed: boolean[] = []
  let announced = false
  let keyHandler: ((ev: KeyboardEvent) => void) | null = null

  /** 行首雷达扫描光带（600ms，纯装饰） */
  function sweep(row: HTMLElement): void {
    row.classList.remove('is-sweeping')
    // 强制重排以便重复触发同一动画
    void row.offsetWidth
    row.classList.add('is-sweeping')
    window.setTimeout(() => row.classList.remove('is-sweeping'), dur('slow'))
  }

  /** 展开整行：该条的描述角度与有利条件同时呈现（步间 --t-fast） */
  function revealRow(index: number): void {
    if (index < 0 || index >= ROWS.length || revealed[index]) return
    const row = rowNodes[index]
    if (!row) return
    revealed[index] = true
    row.classList.add('is-open')
    sweep(row)

    const step = dur('fast') / 1000
    row.querySelectorAll<HTMLElement>('.ct__value').forEach((value, i) => {
      value.style.opacity = '0'
      value.style.transform = 'translateY(10px)'
      animate(value, {
        opacity: 1,
        y: 0,
        duration: dur('base') / 1000,
        delay: i * step,
        ease: ease('out')
      })
    })

    syncProgress()
  }

  function syncProgress(): void {
    const count = revealed.filter(Boolean).length
    if (progressNode) progressNode.textContent = `${count} / ${ROWS.length}`
    const all = count === ROWS.length
    if (doneBtn) doneBtn.disabled = !all
    if (all) {
      markDone(screen)
      if (!announced) {
        announced = true
        toast(`${ROWS.length} 条选址条件已全部查看`, 'ok')
      }
    }
  }

  function revealNext(): void {
    const index = revealed.findIndex((value) => !value)
    if (index >= 0) revealRow(index)
  }

  function init(root: HTMLElement): void {
    host = root
    revealed = ROWS.map(() => false)
    announced = false

    root.classList.add('ct')
    root.innerHTML = `
      <div class="ct__head-block">
        <div class="sec-head">
          <h2 class="sec-title">${title}</h2>
          <span class="ct__badge">${badge} · 共 ${ROWS.length} 条</span>
        </div>
        <p class="ct__intro">${intro}</p>
      </div>
      <div class="ct__table panel panel--hud">
        <div class="ct__head" aria-hidden="true">
          <span>序号</span><span>材料描述</span>
          <span class="ct__head-detail"><span>描述角度</span><span>有利条件</span></span>
        </div>
        ${ROWS.map((item, index) => rowHtml(item, index)).join('')}
      </div>
      <div class="ct__foot">
        <p class="ct__tip">${icon('icon-info', 24)}<span>${tip}</span></p>
        <div class="ct__foot-actions">
          <span class="ct__progress">已全部查看 <b>0 / ${ROWS.length}</b> 条</span>
          <button class="btn btn--primary ct__done" type="button" disabled>已完成查看</button>
        </div>
      </div>
    `

    rowNodes = Array.from(root.querySelectorAll<HTMLElement>('.ct__row'))
    doneBtn = root.querySelector<HTMLButtonElement>('.ct__done')
    progressNode = root.querySelector<HTMLElement>('.ct__progress b')

    rowNodes.forEach((row, index) => {
      const btn = row.querySelector<HTMLButtonElement>('.ct__peek')
      if (btn) on(btn, 'click', () => revealRow(index))
    })

    if (doneBtn) {
      on(doneBtn, 'click', () => toast(`${ROWS.length} 条选址条件已全部查看完成`, 'ok'))
    }

    if (keyHandler) document.removeEventListener('keydown', keyHandler)
    keyHandler = (ev: KeyboardEvent) => {
      if (ev.code !== 'Space' || store.activeScreen !== screen) return
      const target = ev.target as HTMLElement | null
      if (target && /^(BUTTON|INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      ev.preventDefault()
      revealNext()
    }
    document.addEventListener('keydown', keyHandler)

    syncProgress()
  }

  function reset(): void {
    if (keyHandler) {
      document.removeEventListener('keydown', keyHandler)
      keyHandler = null
    }
    if (host) init(host)
  }

  return { init, reset }
}
