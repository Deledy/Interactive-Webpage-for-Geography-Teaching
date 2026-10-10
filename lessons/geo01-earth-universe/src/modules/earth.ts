/* ============================================================
   M7 地球的普通性和特殊性（可视化呈现）
   结构：顶部「八大行星」卡片组（深空导航蓝容器 + 8 张行星卡片：
   贴图球体 + 名称胶囊 + 点线装饰，默认选中地球 —— 蓝色描边发光 +
   蓝色胶囊，点击可转移选中，引言随选中行星更新）→ 两条证据卡
   （运动特征：太阳系绕日公转 3D 模型；结构特征：类地行星相对大小 3D 模型）→
   普通 → 转折 → 特殊的结论。
   卡片球体使用本课标准贴图（src/assets/textures/*.jpg，Vite base64 内联，
   file:// 双击可用）：WebGL 可用时由 modules/planetDeck3d.ts 以标准 3D 模型
   渲染（贴图 / 光照 / 自转 / 悬停反馈与 M5、M6 一致，见 planetRow3d.ts）；
   不可用时保留 CSS 球面着色兜底（左上受光 / 右下夜影）。两个证据卡的 3D
   模型同样与 M5 / M6 共用同一套贴图 / 光照 / 材质
   （见 modules/planetRow3d.ts、modules/solarOrbit3d.ts）；无 JS 时由
   index.html 静态兜底（同构卡片 + CSS 渐变球）。
   ============================================================ */
import { lessonData } from '../data/lessonData'
import type { EarthBody, EarthEvidence } from '../types'
import { $$ } from '../utils/dom'
import { createPlanetRow, hasWebGL, PLANET_TEX, type PlanetRowOptions } from './planetRow3d'
import { createPlanetDeck3D } from './planetDeck3d'
import { createSolarOrbit, type SolarOrbitOptions } from './solarOrbit3d'

/* 统一配色（与全课一致，仅用于 2D 兜底）：行星/标注用灰蓝系，地球与重点用恒星金 */
const DOT = 'rgba(150, 176, 208, 0.92)'
const GOLD = '#FFD54F'

/** 带光环的行星（土星环显著、海王星环极淡，与参考稿一致） */
const RINGED = new Set(['saturn', 'neptune'])
/** 土星卡片加宽以容纳光环（与参考稿一致） */
const WIDE_CARD = new Set(['saturn'])

/** 卡片内球体直径：40px + 13px·size —— 木星最大、水星最小，差距收敛（示意，非按比例） */
function globeSize(size: number): number {
  return Math.round(40 + 13 * size)
}

/** 行星在示意图 / 3D 模型中的半径：按相对大小的平方根压缩，
    压缩诸行星之间的尺寸差（水星 0.6 ~ 木星 2.6），既保留"木星更大"的
    大小关系，又让每颗行星都清晰可辨、整排更均衡 */
function planetRadius(size: number): number {
  return Math.sqrt(size)
}

/** 八大行星卡片组：深空导航蓝容器 + 8 张行星卡片（球体贴图 + 名称胶囊 + 点线装饰），
    默认选中地球（蓝色描边发光 + 蓝色胶囊），引言置于容器底部（菱形 + 渐变线装饰） */
function planetDeckHTML(caption: string): string {
  const cards = lessonData.planets
    .map((p) => {
      const isEarth = p.id === 'earth'
      const ring = RINGED.has(p.id)
      const ringEls = ring
        ? '<span class="planet-deck__ring planet-deck__ring--back"></span><span class="planet-deck__ring planet-deck__ring--front"></span>'
        : ''
      const wide = WIDE_CARD.has(p.id) ? ' planet-deck__card--wide' : ''
      return `<button type="button" class="planet-deck__card${wide}${isEarth ? ' is-selected' : ''}" data-planet="${p.id}" aria-pressed="${isEarth}" style="--d:${globeSize(p.size)}px;--tex:url('${PLANET_TEX[p.id]}')">
        <span class="planet-deck__scene" aria-hidden="true">${ringEls}<span class="planet-deck__globe"></span></span>
        <span class="planet-deck__pill">${p.name}</span>
        <span class="planet-deck__rule" aria-hidden="true"></span>
      </button>`
    })
    .join('')

  return `<figure class="planet-deck" role="group" aria-label="太阳系八大行星卡片，点击卡片切换选中行星">
      <div class="planet-deck__row">${cards}</div>
      <figcaption class="planet-deck__quote">
        <span class="planet-deck__quote-line" aria-hidden="true"></span>
        <span class="planet-deck__quote-gem" aria-hidden="true"></span>
        <span class="planet-deck__quote-text">${caption}</span>
        <span class="planet-deck__quote-gem" aria-hidden="true"></span>
        <span class="planet-deck__quote-line" aria-hidden="true"></span>
      </figcaption>
    </figure>`
}

/** 卡片选中交互：选中态唯一转移；引言随选中行星更新
    （「某行星，只是太阳系八颗行星中的一颗」——地球默认文案与数据一致） */
function bindPlanetDeck(deck: HTMLElement): void {
  const cards = $$('.planet-deck__card', deck) as HTMLElement[]
  const quote = deck.querySelector('.planet-deck__quote-text')
  if (!cards.length || !quote) return

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      if (card.classList.contains('is-selected')) return
      const planet = lessonData.planets.find((p) => p.id === card.dataset.planet)
      if (!planet) return
      cards.forEach((c) => {
        const on = c === card
        c.classList.toggle('is-selected', on)
        c.setAttribute('aria-pressed', String(on))
      })
      quote.textContent = `${planet.name}，只是太阳系八颗行星中的一颗。`
    })
  })
}

/** 运动特征示意图：同一平面上的近圆轨道 + 同向箭头（同向 · 近圆 · 共面） */
function motionSVG(): string {
  const cx = 150
  const cy = 78
  const orbits = [
    { rx: 46, ry: 15 },
    { rx: 76, ry: 25 },
    { rx: 106, ry: 35 }
  ]
  const rings = orbits
    .map((o) => `<ellipse class="earth-orbit" cx="${cx}" cy="${cy}" rx="${o.rx}" ry="${o.ry}"/>`)
    .join('')
  const dots = orbits
    .map((o) => {
      const dx = o.rx * 0.72
      const dy = o.ry * 0.72
      return `<circle class="earth-orbit__dot" cx="${(cx + dx).toFixed(1)}" cy="${(cy - dy).toFixed(1)}" r="3"/>`
    })
    .join('')
  return `<svg class="earth-evi-svg" viewBox="0 0 300 150" role="img" aria-label="八大行星在同一平面上沿近似圆形轨道同向绕日公转">
      <defs>
        <marker id="earth-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 z" fill="${GOLD}"/>
        </marker>
      </defs>
      ${rings}
      ${dots}
      <path class="earth-dir" d="M ${cx - 22} ${cy - 34} Q ${cx} ${cy - 46} ${cx + 22} ${cy - 34}" marker-end="url(#earth-arrow)"/>
      <circle class="earth-orbit__sun" cx="${cx}" cy="${cy}" r="9" fill="${GOLD}"/>
    </svg>`
}

/** 结构特征示意图（2D 兜底）：类地行星按体积（立方根）换算的相对大小圆，
    名称以胶囊标签（圆角矩形 + 文字）呈现，地球胶囊为蓝色填充高亮（与参考稿一致） */
function structureSVG(bodies: EarthBody[]): string {
  const W = 300
  const H = 150
  const cy = 66
  const k = 32
  const TAG_W = 46
  const TAG_H = 20
  const colorOf = (id: string): string =>
    lessonData.planets.find((p) => p.id === id)?.color ?? DOT

  let cursor = 14
  const parts: string[] = []
  for (const b of bodies) {
    const r = Math.cbrt(b.volume) * k
    const x = cursor + r
    const isEarth = b.id === 'earth'
    const labelY = Math.round(cy + r + 22)
    const tagY = Math.round(cy + r + 8)
    const halo = isEarth
      ? `<circle cx="${x.toFixed(1)}" cy="${cy}" r="${(r + 7).toFixed(1)}" fill="none" stroke="rgba(79,158,255,0.5)" stroke-width="1.3"/>`
      : ''
    parts.push(
      `${halo}<circle class="earth-body__dot${isEarth ? ' is-earth' : ''}" cx="${x.toFixed(1)}" cy="${cy}" r="${r.toFixed(1)}" fill="${colorOf(b.id)}"/>` +
        `<rect class="earth-body__tag${isEarth ? ' is-earth' : ''}" x="${(x - TAG_W / 2).toFixed(1)}" y="${tagY}" width="${TAG_W}" height="${TAG_H}" rx="${TAG_H / 2}"/>` +
        `<text class="earth-body__label${isEarth ? ' is-earth' : ''}" x="${x.toFixed(1)}" y="${labelY}" text-anchor="middle">${b.name}</text>`
    )
    cursor = x + r + 22
  }
  return `<svg class="earth-evi-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="四颗类地行星的相对大小，地球与金星最接近">
      ${parts.join('')}
    </svg>`
}

/** 运动特征卡底部的三个特征标签（与 caption 内容一致，以胶囊样式呈现） */
const EVIDENCE_TAGS = ['同向性', '近圆性', '共面性']

/** 证据卡：HUD 科技风（四角切角 + 蓝色描边发光 + 圆形徽章标题 + 蓝点描述 + 图示 + 底部标签行）。
    第 1 张「运动特征」底部为三个特征胶囊；第 2 张「结构特征」底部为「渐变线—文字—渐变线」注记。
    卡片外框承担切角描边与发光，内容放在内层（见 style.css .earth-evidence / __inner）。 */
function evidenceHTML(ev: EarthEvidence, figure: string, index: number): string {
  const isMotion = index === 0
  const footer = isMotion
    ? `<ul class="earth-evidence__tags">${EVIDENCE_TAGS
        .map((t) => `<li class="earth-evidence__tag">${t}</li>`)
        .join('')}</ul>`
    : `<p class="earth-evidence__caption"><span class="earth-evidence__line" aria-hidden="true"></span>${ev.caption}<span class="earth-evidence__line" aria-hidden="true"></span></p>`

  return `<article class="earth-evidence">
      <div class="earth-evidence__inner">
        <div class="earth-evidence__head">
          <span class="earth-evidence__badge earth-evidence__badge--${isMotion ? 'motion' : 'structure'}" aria-hidden="true"></span>
          <h3 class="earth-evidence__title">${ev.title}</h3>
          <span class="earth-evidence__deco" aria-hidden="true"></span>
        </div>
        <p class="earth-evidence__desc"><span class="earth-evidence__dot" aria-hidden="true"></span>${ev.desc}</p>
        ${figure}
        ${footer}
      </div>
    </article>`
}

/** 运动特征卡：太阳系绕日公转 3D 模型的参数（轨道与球体均为示意值，非真实比例）；
    八颗行星同向公转、轨道共面，用于呈现同向性 / 近圆性 / 共面性。
    行星半径在压缩口径基础上再收窄，轨道半径按「相邻两球永不相交」反推
    （orbit[i+1] − orbit[i] ≥ r[i] + r[i+1] + 余量），保证公转任意时刻都不穿模、不压盖。 */
function motionOrbit(): SolarOrbitOptions {
  const ORBIT = [2.0, 3.27, 4.58, 5.88, 7.29, 8.83, 10.27, 11.66]
  const SPEED = [1.35, 1.05, 0.9, 0.78, 0.54, 0.44, 0.34, 0.28]
  return {
    planets: lessonData.planets.map((p, i) => ({
      id: p.id,
      /* 半径 0.35 + 0.20·√size：水星 0.50 → 木星 0.67，既保留大小差异又不挤占轨道 */
      radius: 0.35 + 0.2 * planetRadius(p.size),
      orbitRadius: ORBIT[i],
      speed: SPEED[i]
    })),
    ariaLabel: '八大行星在同一平面上沿近似圆形轨道同向绕日公转的 3D 模型'
  }
}

/** 类地行星相对大小 3D 模型的参数（半径按体积立方根换算，与 2D 兜底同构） */
function terrestrialRow(bodies: EarthBody[]): PlanetRowOptions {
  return {
    planets: bodies.map((b) => ({ id: b.id, name: b.name, radius: Math.cbrt(b.volume) * 1.15, gap: 0.62 })),
    highlightId: 'earth',
    ariaLabel: '四颗类地行星相对大小的 3D 模型，地球以金色名称标注'
  }
}

/** 入口：一次性渲染整块可视化内容，并在 WebGL 可用时升级为标准 3D 行星模型 */
export function initEarth(): void {
  const el = document.getElementById('earth-table')
  if (!el || !lessonData.earthOrdinary) return
  const box: HTMLElement = el
  const d = lessonData.earthOrdinary

  /* 先渲染 2D 示意（同时充当 WebGL 不可用时的兜底） */
  const figures = [
    `<div class="earth-evidence__figure earth-evidence__figure--orbit" aria-hidden="true">
        <div class="earth-model-stage" data-model="motion">${motionSVG()}</div>
      </div>`,
    `<div class="earth-evidence__figure earth-evidence__figure--model" aria-hidden="true">
        <div class="earth-model-stage" data-model="terrestrial">${structureSVG(d.bodies)}</div>
      </div>`
  ]
  const evidences = d.evidences
    .map((ev, i) => evidenceHTML(ev, figures[i] ?? '', i))
    .join('')

  box.innerHTML = `<div class="earth-viz">
      ${planetDeckHTML(d.lineupCaption)}
      <div class="earth-evidences">${evidences}</div>
      <div class="earth-conclusion">
        <div class="earth-verdict earth-verdict--ordinary">
          <div class="earth-verdict__inner">
            <span class="earth-verdict__medal" aria-hidden="true"></span>
            <p class="earth-verdict__text">${d.ordinaryConclusion}</p>
          </div>
        </div>
        <p class="earth-turn">${d.turn}</p>
        <section class="earth-verdict earth-verdict--special">
          <div class="earth-verdict__inner">
            <span class="earth-verdict__badge">特殊性</span>
            <p class="earth-verdict__statement">${d.specialStatement}</p>
            <p class="earth-verdict__conclusion">${d.specialConclusion}</p>
            <p class="earth-verdict__bridge">${d.bridge}</p>
          </div>
        </section>
      </div>
    </div>`

  /* 卡片选中交互（渲染后立即绑定） */
  const deck = box.querySelector<HTMLElement>('.planet-deck')
  if (deck) bindPlanetDeck(deck)

  /* 3D 升级：WebGL 可用时把卡片组球体与两处证据呈现替换为标准 3D 模型
     （与 M5 太阳系、M6 公转演示同一套贴图 / 光照 / 材质 / 性能策略）。
     初始化异常时渲染器会在改动宿主 DOM 之前即抛错，因此 CSS 兜底得以原样保留。 */
  const upgrade = (name: string, render: (stage: HTMLElement) => void, label: string): void => {
    const stage = box.querySelector<HTMLElement>(`[data-model="${name}"]`)
    if (!stage) return
    try {
      render(stage)
    } catch (e) {
      if (window.console) console.warn(`M7 ${label} 3D 模型初始化失败，已保留 2D 示意：`, e)
    }
  }

  if (hasWebGL()) {
    /* 卡片组：球体由 3D 模型渲染（卡片外观 / 交互仍由 HTML + CSS 承担） */
    const deckRow = box.querySelector<HTMLElement>('.planet-deck__row')
    if (deckRow) {
      try {
        createPlanetDeck3D(deckRow)
      } catch (e) {
        if (window.console) console.warn('M7 八大行星卡片组 3D 模型初始化失败，已保留 CSS 球兜底：', e)
      }
    }
    upgrade('motion', (stage) => createSolarOrbit(stage, motionOrbit()), '绕日公转')
    upgrade('terrestrial', (stage) => createPlanetRow(stage, terrestrialRow(d.bodies)), '类地行星')
  }
}
