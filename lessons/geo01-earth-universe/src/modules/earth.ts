/* ============================================================
   M7 地球的普通性和特殊性：结构特征 + 运动特征 → 普通；唯一高级智慧生命 → 特殊
   - 普通性：① 结构特征（类地行星体积 / 质量·地球 = 1 的条形对比）
             ② 运动特征（同向性 / 共面性 / 近圆性）
   - 特殊性：八大行星中唯一存在高级智慧生命
   两块内容自上而下顺序排布；数据来自 lessonData.earthOrdinary
   （三性复用 lessonData.motionFeatures）；无 JS 时由 index.html 中的静态卡片兜底。
   ============================================================ */
import { lessonData } from '../data/lessonData'
import type { TerrestrialBody } from '../types'

/** 比值显示：地球（1）保留一位，其余保留两位小数 */
function fmtRatio(v: number): string {
  return v >= 1 ? v.toFixed(1) : v.toFixed(2)
}

export function initEarth(): void {
  const el = document.getElementById('earth-table')
  if (!el || !lessonData.earthOrdinary) return
  const box: HTMLElement = el
  const data = lessonData.earthOrdinary
  const bodies = data.structure.bodies

  const maxVol = Math.max(...bodies.map((b) => b.volume))
  const maxMass = Math.max(...bodies.map((b) => b.mass))

  /** 结构特征对比条：按组内最大值归一化 */
  const structBar = (b: TerrestrialBody, value: number, max: number): string => {
    const pct = value <= 0 ? 0 : Math.max((value / max) * 100, 3)
    return `<li class="earth-bar" data-planet="${b.id}">
      <span class="earth-bar__name">${b.name}</span>
      <span class="earth-bar__track"><span class="earth-bar__fill${b.id === 'earth' ? ' is-earth' : ''}" style="width:${pct.toFixed(1)}%"></span></span>
      <span class="earth-bar__value">${fmtRatio(value)}</span>
    </li>`
  }

  box.innerHTML = `
    <div class="earth__dual">
      <article class="earth-card earth-card--ordinary">
        <header class="earth-card__head">
          <span class="earth-card__badge">普通性</span>
          <p class="earth-card__lead">地球与类地行星、其余七颗行星在特征上高度相似。</p>
        </header>

        <section class="earth-feature">
          <h3 class="earth-feature__title"><span class="earth-feature__no">一</span>结构特征</h3>
          <p class="earth-feature__desc">${data.structure.note}</p>
          <div class="earth-struct">
            <section class="earth-bars">
              <h4 class="earth-bars__title">体积（地球 = 1）</h4>
              <ul class="earth-bars__list">${bodies.map((b) => structBar(b, b.volume, maxVol)).join('')}</ul>
            </section>
            <section class="earth-bars">
              <h4 class="earth-bars__title">质量（地球 = 1）</h4>
              <ul class="earth-bars__list">${bodies.map((b) => structBar(b, b.mass, maxMass)).join('')}</ul>
            </section>
          </div>
        </section>

        <section class="earth-feature">
          <h3 class="earth-feature__title"><span class="earth-feature__no">二</span>运动特征</h3>
          <p class="earth-feature__desc">${data.motionNote}</p>
          <ul class="earth-motion">
            ${lessonData.motionFeatures
              .map(
                (f) => `<li class="earth-motion__item"><span class="earth-motion__name">${f.name}</span><span class="earth-motion__desc">${f.desc}</span></li>`
              )
              .join('')}
          </ul>
        </section>

        <p class="earth-card__conclusion">${data.ordinaryConclusion}</p>
      </article>

      <article class="earth-card earth-card--special">
        <header class="earth-card__head">
          <span class="earth-card__badge">特殊性</span>
          <p class="earth-card__lead">在八颗行星中，地球独一无二。</p>
        </header>
        <p class="earth-card__statement">${data.specialStatement}</p>
        <p class="earth-card__conclusion">${data.specialConclusion}</p>
      </article>
    </div>`
}
