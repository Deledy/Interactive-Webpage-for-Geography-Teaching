/**
 * M7 综合题规范训练
 * - 材料页（#m7）：材料卡（背景图 + 综合题徽标）+ 问题要求卡 + 底部操作
 * - 答题屏（#m7a）：常驻在材料页下方的一屏，上方作答区暂不实现作答，
 *   先把材料页高亮过的关键词做成胶囊词云作为写作支架；
 *   底部为「材料信息梳理」表（5 条有利 + 3 条不利，一屏放不下时表格内部滚动）：
 *   初始只完整展开第一条有利与第一条不利（两条相邻置顶作示范），其余行只留材料描述，
 *   点行内「点击查看」（与 M2/M3 条件表同一款按钮）才展开四列梳理结果；
 *   滚轮下滑可到，点「进入答题」则平滑下滑过去
 * - 文案全部取自 lessonData.practice，模块内不写死材料与题目
 */
import { lessonData } from '../data/lessonData'
import type { PracticeMaterialRow } from '../types'
import { on } from '../utils/dom'
import { icon } from '../utils/icons'
import { animate, dur, ease } from '../utils/motion'
import practiceBg from '../../assets/images/综合题背景.png'

const PRACTICE = lessonData.practice
const SUMMARY_HEADERS = ['材料描述', '描述角度', '精简语句', '有利/不利', '可能形成的答案']

/** 作答要求中的括号说明降一档颜色，与题干正文区分（对应设计图中的浅色括注） */
const requirementHtml = PRACTICE.requirement.replace(
  /（[^）]*）/,
  (note) => `<span class="m7__req-note">${note}</span>`
)

/**
 * 材料原文：关键词包成 `<mark class="m7__kw">`，并按出现次序写入 `--kw-i`，
 * 供「关键词」按钮逐词错峰揭示（未点按时样式与正文一致，不提前泄露答案）。
 * 不复用 utils/dom 的 highlight()：那里输出的是常显的 `<mark class="kw">`，无法做成可开关的揭示。
 */
function materialHtml(): string {
  const pattern = new RegExp(
    [...PRACTICE.keywords]
      .sort((a, b) => b.length - a.length)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|'),
    'g'
  )
  let order = 0
  return PRACTICE.material.replace(
    pattern,
    (word) => `<mark class="m7__kw" style="--kw-i:${order++}">${word}</mark>`
  )
}

let host: HTMLElement | null = null
let answerHost: HTMLElement | null = null
let criteriaOverlay: HTMLElement | null = null
let escHandler: ((ev: KeyboardEvent) => void) | null = null
let cloudObserver: IntersectionObserver | null = null
/** 答题屏表格每行是否已展开（初始只展开一条有利 + 一条不利作示范） */
let revealedRows: boolean[] = []

/* ---------------- 材料页 ---------------- */

function criteriaHtml(): string {
  return PRACTICE.criteria
    .map(
      (item, i) => `
        <li class="m7__criteria-item">
          <span class="m7__criteria-no" aria-hidden="true">${i + 1}</span>
          <div class="m7__criteria-body">
            <p class="m7__criteria-text">${item.text}</p>
            ${
              item.items?.length
                ? `<ul class="m7__criteria-sub">${item.items
                    .map((sub) => `<li>${sub}</li>`)
                    .join('')}</ul>`
                : ''
            }
          </div>
        </li>`
    )
    .join('')
}

function closeCriteria(): void {
  if (escHandler) {
    document.removeEventListener('keydown', escHandler)
    escHandler = null
  }
  criteriaOverlay?.remove()
  criteriaOverlay = null
}

function openCriteria(): void {
  closeCriteria()
  const hostNode = document.getElementById('overlayHost')
  if (!hostNode) return

  criteriaOverlay = document.createElement('div')
  criteriaOverlay.className = 'overlay m7__criteria-overlay'
  criteriaOverlay.innerHTML = `
    <div class="m7__criteria" role="dialog" aria-modal="true" aria-label="评分标准">
      <div class="m7__criteria-head">
        <span class="m7__req-mark" aria-hidden="true">?</span>
        <h3 class="m7__criteria-title">评分标准</h3>
        <button class="m7__criteria-close" type="button" data-act="close" aria-label="关闭">×</button>
      </div>
      <ol class="m7__criteria-list">${criteriaHtml()}</ol>
    </div>
  `
  hostNode.appendChild(criteriaOverlay)

  criteriaOverlay.querySelector('[data-act="close"]')?.addEventListener('click', closeCriteria)
  on(criteriaOverlay, 'click', (ev) => {
    if (ev.target === criteriaOverlay) closeCriteria()
  })

  criteriaOverlay.querySelectorAll<HTMLElement>('.m7__criteria-item').forEach((item, i) => {
    item.style.opacity = '0'
    item.style.transform = 'translateY(14px)'
    animate(item, { opacity: 1, y: 0, duration: dur('base') / 1000, delay: i * 0.06, ease: ease('out') })
  })

  escHandler = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') closeCriteria()
  }
  document.addEventListener('keydown', escHandler)
}

export function initPractice(root: HTMLElement, answer: HTMLElement): void {
  host = root
  answerHost = answer
  closeCriteria()

  root.classList.add('m7')
  root.innerHTML = `
    <div class="m7__scene">
      <div class="m7__scene-bg" aria-hidden="true">
        <img src="${practiceBg}" alt="" decoding="async" />
      </div>
      <span class="m7__scene-badge">${icon('icon-spark', 22)}<span>综合题</span></span>
      <p class="m7__scene-text">${materialHtml()}</p>
    </div>

    <div class="m7__req">
      <div class="m7__req-head">
        <span class="m7__req-mark" aria-hidden="true">?</span>
        <h3 class="m7__req-label">问题要求</h3>
      </div>
      <p class="m7__req-text">${requirementHtml}</p>
    </div>

    <div class="m7__bar">
      <button class="m7__act m7__act--ghost" type="button" data-act="standard">评分标准</button>
      <button class="m7__act m7__act--ghost" type="button" data-act="keywords" aria-pressed="false">关键词</button>
      <button class="m7__act m7__act--key" type="button" data-act="answer">进入答题</button>
    </div>
  `

  // 答题屏常驻：内容随材料页一并渲染，滚轮下滑即可到达
  answer.classList.add('m7', 'is-answer')
  revealedRows = initialRevealedRows()
  answer.innerHTML = answerPageHtml()
  answer.querySelectorAll<HTMLElement>('.m7__sum-peek').forEach((btn) => {
    on(btn, 'click', () => revealMaterialRow(Number(btn.dataset.index)))
  })
  observeCloud()

  root.querySelector('[data-act="standard"]')?.addEventListener('click', openCriteria)
  root.querySelector('[data-act="answer"]')?.addEventListener('click', openAnswerPage)

  // 关键词：再点一次收起高亮，方便课堂上「先猜后看」
  const sceneText = root.querySelector<HTMLElement>('.m7__scene-text')
  const keywordButton = root.querySelector<HTMLButtonElement>('[data-act="keywords"]')
  keywordButton?.addEventListener('click', () => {
    const active = sceneText?.classList.toggle('is-kw') ?? false
    keywordButton.classList.toggle('is-on', active)
    keywordButton.setAttribute('aria-pressed', String(active))
  })
}

export function resetPractice(): void {
  if (host && answerHost) initPractice(host, answerHost)
}

/* ---------------- 答题屏（#m7a，材料页下方的一屏） ---------------- */

/**
 * 词云字号档位：短词是可直接落笔的核心术语（最大），长句是材料原句（最小）。
 * 只按字数分档，不写死具体词，词表增删后自动重排。
 */
function cloudLevel(word: string): 1 | 2 | 3 {
  if (word.length <= 6) return 1
  if (word.length <= 12) return 2
  return 3
}

/**
 * 关键词词云：内容即材料页「关键词」按钮扫出并高亮的同一份词表（`practice.keywords`），
 * 逐词包成胶囊；`--i` 为词序，供进入视口后逐词错峰上浮。
 */
function cloudHtml(): string {
  const words = PRACTICE.keywords
    .map(
      (word, i) =>
        `<li class="m7__cloud-word m7__cloud-word--l${cloudLevel(word)}" style="--i:${i}">${word}</li>`
    )
    .join('')

  return `
    <div class="m7__cloud">
      <p class="m7__cloud-label">${icon('icon-spark', 22)}<span>材料关键词</span></p>
      <ul class="m7__cloud-list">${words}</ul>
    </div>
  `
}

/** 两条示范行的源数据下标：第一条有利 + 第一条不利 */
function demoSourceIndexes(): number[] {
  const rows = PRACTICE.materialRows
  return [
    rows.findIndex((row) => row.polarity === 'fav'),
    rows.findIndex((row) => row.polarity === 'unfav')
  ]
}

/**
 * 表格渲染顺序：两条示范行（有利 → 不利）相邻置顶，其余行按材料原顺序跟上。
 * 只调整展示顺序，不动 lessonData 里的数据。
 */
function rowOrder(): number[] {
  const demo = demoSourceIndexes()
  const rest = PRACTICE.materialRows.map((_, i) => i).filter((i) => !demo.includes(i))
  return [...demo, ...rest].filter((i) => i >= 0)
}

/**
 * 题面示范：初始只展开置顶的两条（第一条有利 → 第一条不利），把
 * 「材料 → 角度 → 精简语句 → 有利/不利 → 可能形成的答案」的梳理范式亮出来；
 * 其余行只留材料描述与一枚「点击查看」，由学生自己判断后再核对。
 * 下标为渲染次序，与 tr 上的 data-index 一致。
 */
function initialRevealedRows(): boolean[] {
  const demo = demoSourceIndexes()
  return rowOrder().map((source) => demo.includes(source))
}

/** 表格正文：按渲染顺序逐行生成 */
function materialRowsHtml(): string {
  return rowOrder()
    .map((source, position) => materialRowHtml(PRACTICE.materialRows[source], position))
    .join('')
}

/** 一行：材料描述常显；未展开时四列梳理结果隐藏，只留一枚居中的「点击查看」 */
function materialRowHtml(row: PracticeMaterialRow, position: number): string {
  const isUnfav = row.polarity === 'unfav'
  return `
    <tr class="m7__sum-row${revealedRows[position] ? ' is-open' : ''}" data-index="${position}">
      <th class="m7__sum-material" scope="row">
        <span class="m7__sum-material-in">
          <span class="m7__sum-icon">${icon(row.icon, 26)}</span>
          <span>${row.material}</span>
        </span>
      </th>
      <td><span class="m7__sum-v">${row.angle}</span></td>
      <td><span class="m7__sum-v">${row.brief}</span></td>
      <td><span class="m7__sum-v m7__sum-polar m7__sum-polar--${row.polarity}">${isUnfav ? '不利' : '有利'}</span></td>
      <td class="m7__sum-answer">
        <span class="m7__sum-v">${row.answer}</span>
        <button class="m7__sum-peek" type="button" data-index="${position}"
          aria-label="第 ${position + 1} 条：点击查看描述角度与梳理结果">
          ${icon('icon-eye', 30)}<span>点击查看</span>
        </button>
      </td>
    </tr>
  `
}

/** 答题屏内容：上方为关键词词云，底部为「材料信息梳理」表（超高时表格内部滚动） */
function answerPageHtml(): string {
  return `
    <div class="m7__paper">
      <!-- 表格上方的作答区：暂不实现作答，先放关键词词云作写作支架 -->
      <div class="m7__paper-blank">${cloudHtml()}</div>

      <div class="m7__sum-wrap">
        <table class="m7__sum">
          <caption class="sr-only">材料信息梳理：有利条件与不利因素</caption>
          <colgroup>
            <col class="m7__sum-col m7__sum-col--material" />
            <col class="m7__sum-col m7__sum-col--angle" />
            <col class="m7__sum-col m7__sum-col--brief" />
            <col class="m7__sum-col m7__sum-col--polar" />
            <col class="m7__sum-col m7__sum-col--answer" />
          </colgroup>
          <thead>
            <tr>${SUMMARY_HEADERS.map((head) => `<th scope="col">${head}</th>`).join('')}</tr>
          </thead>
          <tbody>${materialRowsHtml()}</tbody>
        </table>
      </div>
    </div>
  `
}

/** 进入答题：平滑下滑到下方的答题屏 */
function openAnswerPage(): void {
  closeCriteria()
  answerHost?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** 展开某一行：四列梳理结果依次浮现（一行一次，与 M2/M3 条件表同为单向展开） */
function revealMaterialRow(index: number): void {
  if (!Number.isInteger(index) || revealedRows[index]) return
  const row = answerHost?.querySelector<HTMLElement>(`.m7__sum-row[data-index="${index}"]`)
  if (!row) return

  revealedRows[index] = true
  row.classList.add('is-open')

  const step = dur('fast') / 1000
  row.querySelectorAll<HTMLElement>('.m7__sum-v').forEach((value, i) => {
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
}

/**
 * 词云默认不显示，滑到答题屏（进入视口）后才逐词上浮——
 * 答题屏始终挂在材料页下方，若用纯 CSS 动画会在屏幕外提前放完。
 */
function observeCloud(): void {
  cloudObserver?.disconnect()
  cloudObserver = null
  const cloud = answerHost?.querySelector<HTMLElement>('.m7__cloud')
  if (!cloud) return

  if (typeof IntersectionObserver === 'undefined') {
    cloud.classList.add('is-in')
    return
  }

  cloudObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      cloud.classList.add('is-in')
      cloudObserver?.disconnect()
      cloudObserver = null
    },
    { threshold: 0.3 }
  )
  cloudObserver.observe(cloud)
}
