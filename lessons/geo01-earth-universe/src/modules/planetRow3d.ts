/* ============================================================
   模块 07 · 行星 3D 模型（横向排列的球体）
   ------------------------------------------------------------
   与模块 05「太阳系与八大行星」、模块 06「绕日公转演示」共用同一套标准资源与
   参数，保证模块 07 的行星模型在渲染效果、交互响应、性能表现上与其他位置一致：
   - 贴图：src/assets/textures/*.jpg（Vite 静态导入并 base64 内联，file:// 双击可用）
   - 材质：MeshStandardMaterial（roughness 0.92 / metalness 0.05）+ sRGB 色彩空间
   - 光照：同款三点光（环境光 + 主方向光 + 轮廓光）
   - 相机：正交相机（视域内平行等大、无透视变形）
   - 交互：悬停轻微提亮 + 指针变化（与模块 05 的「克制、局部」反馈一致）；
     本模块为静态展示，**不设选中态**（不常驻金色高亮 / 光环，避免看起来像被选中）
   - 动效：行星缓慢自转（金星、天王星逆向）；prefers-reduced-motion 时只渲染静态一帧
   - 性能：仅进入视口时渲染；容器尺寸变化由 ResizeObserver 兜底重算取景
   WebGL 不可用或初始化失败时由调用方保留 2D 示意兜底 —— 本函数在改动宿主 DOM
   之前完成渲染器创建，失败即抛错，宿主原有内容不受影响。
   ============================================================ */
import {
  Scene, OrthographicCamera, WebGLRenderer, Vector3, Group,
  AmbientLight, DirectionalLight, Mesh, SphereGeometry, MeshStandardMaterial,
  RingGeometry, MeshBasicMaterial, Raycaster, Vector2, Color,
  Texture, TextureLoader, Clock, DoubleSide, SRGBColorSpace
} from 'three'
import { prefersReducedMotion } from '../utils/dom'
import mercuryTex from '../assets/textures/mercury.jpg'
import venusTex from '../assets/textures/venus.jpg'
import earthTex from '../assets/textures/earth.jpg'
import marsTex from '../assets/textures/mars.jpg'
import jupiterTex from '../assets/textures/jupiter.jpg'
import saturnTex from '../assets/textures/saturn.jpg'
import uranusTex from '../assets/textures/uranus.jpg'
import neptuneTex from '../assets/textures/neptune.jpg'
import saturnRingTex from '../assets/textures/saturn_ring.png'
import uranusRingTex from '../assets/textures/uranus_ring.png'

/** 行星表面贴图（与模块 05 / 06 同一套文件，来源登记见 docs/06_资源引用.md） */
export const PLANET_TEX: Record<string, string> = {
  mercury: mercuryTex,
  venus: venusTex,
  earth: earthTex,
  mars: marsTex,
  jupiter: jupiterTex,
  saturn: saturnTex,
  uranus: uranusTex,
  neptune: neptuneTex
}

/** 光环贴图（仅土星、天王星） */
export const RING_TEX: Record<string, string> = {
  saturn: saturnRingTex,
  uranus: uranusRingTex
}

/** 缓慢自转角速度（rad/s，示意值，与模块 05 一致） */
export const SPIN: Record<string, number> = {
  mercury: 0.12, venus: 0.08, earth: 0.3, mars: 0.28,
  jupiter: 0.5, saturn: 0.45, uranus: 0.35, neptune: 0.4
}

/** 逆向自转（与模块 05 的 IAU 极轴口径一致） */
export const RETRO = new Set(['venus', 'uranus'])

/** 悬停：轻微提亮（模块 07 无选中交互，仅保留这一处克制反馈） */
const EMISSIVE_HOVER = new Color(0x223344)
const EMISSIVE_NONE = new Color(0x000000)

/** 名称标签占位高度（px）与标签锚点离球面的间距（场景单位） */
const LABEL_PX = 46
const LABEL_GAP = 0.55
/** 相邻行星的默认净间距（场景单位） */
const DEFAULT_GAP = 1.1
/** 光环外半径倍数（土星 / 天王星）：环的横向外延远大于球体，排布取景时必须计入 */
const RING_OUTER = 1.9

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

export interface RowPlanet {
  /** 行星 id（用于取贴图） */
  id: string
  name: string
  /** 球体半径（场景单位，示意值） */
  radius: number
  /** 与右侧相邻行星的净间距（场景单位），默认 1.1 */
  gap?: number
}

export interface PlanetRowOptions {
  planets: RowPlanet[]
  /** 唯一高亮的行星 id */
  highlightId: string
  ariaLabel: string
}

/**
 * 在宿主元素内渲染一排 3D 行星球体（含名称标签与悬停反馈）。
 * 创建 WebGL 失败时抛错，且此时尚未改动宿主 DOM —— 调用方可安全保留 2D 兜底。
 */
export function createPlanetRow(host: HTMLElement, opts: PlanetRowOptions): void {
  const list = opts.planets
  if (!list.length) return

  /* 1) 先建渲染器：失败即抛错，不触碰宿主 DOM（2D 兜底得以保留） */
  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 4000)
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  if (!renderer.getContext()) throw new Error('WebGL 上下文不可用')
  const canvas = renderer.domElement
  canvas.className = 'planet3d__canvas'
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', opts.ariaLabel)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  /* 2) 宿主 DOM：3D 画布 + 名称标签覆盖层 */
  host.classList.add('is-3d')
  host.innerHTML = '<div class="planet3d"><div class="planet3d__labels"></div></div>'
  const wrap = host.firstElementChild as HTMLElement
  const labelsBox = wrap.querySelector('.planet3d__labels') as HTMLElement
  wrap.insertBefore(canvas, labelsBox)

  /* 3) 光照：与模块 05 完全一致（环境光 + 主方向光 + 轮廓光） */
  scene.add(new AmbientLight(0x99aaff, 0.95))
  const mainLight = new DirectionalLight(0xfff3e0, 1.5)
  mainLight.position.set(10, 16, 14)
  scene.add(mainLight)
  const rimLight = new DirectionalLight(0x6688ff, 0.45)
  rimLight.position.set(-12, -6, -10)
  scene.add(rimLight)

  /* 4) 贴图：sRGB 色彩空间（three r152+ 色彩管理，与模块 05/06 一致） */
  const loader = new TextureLoader()
  const tex = (url: string | undefined): Texture | undefined => {
    if (!url) return undefined
    const t = loader.load(url)
    t.colorSpace = SRGBColorSpace
    return t
  }

  /* 5) 横向排布：由左至右等间距（示意，非按比例）——先算总宽再整体居中。
     有光环的行星横向外延为 RING_OUTER·radius（远大于球体半径），故按「可视半宽」
     halfExt 参与排布与取景，避免相邻行星（尤其木星—土星、土星—天王星）互相压盖。 */
  const halfExt = list.map(p => (RING_TEX[p.id] ? p.radius * RING_OUTER : p.radius))
  const gaps = list.map((p, i) => (i < list.length - 1 ? (p.gap ?? DEFAULT_GAP) : 0))
  const totalW = halfExt.reduce((a, b) => a + b * 2, 0) + gaps.reduce((a, b) => a + b, 0)
  const xs: number[] = []
  let cursor = -totalW / 2
  list.forEach((p, i) => {
    xs.push(cursor + halfExt[i])
    cursor += halfExt[i] * 2 + gaps[i]
  })
  const maxR = Math.max(...list.map(p => p.radius))
  const maxHalfExt = Math.max(...halfExt)

  /* 6) 行星球体（土星 / 天王星附带光环贴图；不设高亮光环） */
  const meshes: Mesh<SphereGeometry, MeshStandardMaterial>[] = []
  list.forEach((p, i) => {
    const holder = new Group()
    holder.position.set(xs[i], 0, 0)
    scene.add(holder)

    const map = tex(PLANET_TEX[p.id])
    const mesh = new Mesh(
      new SphereGeometry(p.radius, 48, 48),
      new MeshStandardMaterial({
        map,
        color: map ? 0xffffff : 0x8fa3bd,
        roughness: 0.92,
        metalness: 0.05
      })
    )
    holder.add(mesh)
    meshes.push(mesh)

    /* 光环：挂在 holder 上（与球体自转解耦），水平放置 */
    const ringMap = tex(RING_TEX[p.id])
    if (ringMap) {
      const ring = new Mesh(
        new RingGeometry(p.radius * 1.15, p.radius * RING_OUTER, 64),
        new MeshBasicMaterial({ map: ringMap, side: DoubleSide, transparent: true, depthWrite: false })
      )
      ring.rotation.x = -Math.PI / 2
      holder.add(ring)
    }
  })

  /* 7) 名称标签（HTML 覆盖层，随投影定位） */
  const labels: HTMLElement[] = []
  list.forEach(p => {
    const el = document.createElement('span')
    el.className = 'planet3d__label' + (p.id === opts.highlightId ? ' is-highlight' : '')
    el.textContent = p.name
    labelsBox.appendChild(el)
    labels.push(el)
  })

  /* 8) 取景：正交相机 —— 横向按排布总宽适配；竖向不足时整体等比缩小以容纳名称标签。
     设 halfH = halfW·h/w，需满足 halfH ≥ (TOP + BOTTOM_BASE + LABEL_PX/pxPerUnit)/2，
     其中 pxPerUnit = w/(2·halfW) ⇒ 解出 halfW ≥ A·w/(h − LABEL_PX)（A 为上下留白均值）。 */
  camera.position.set(0, 9, 56)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()

  const CONTENT_TOP = maxR * 1.42
  const CONTENT_BOTTOM_BASE = maxR + LABEL_GAP
  const A = (CONTENT_TOP + CONTENT_BOTTOM_BASE) / 2
  const WIDTH_NEED = totalW / 2 + maxHalfExt * 0.34

  let lastW = -1
  let lastH = -1

  function fit(): { w: number; h: number } {
    const w = wrap.clientWidth || host.clientWidth || 800
    const h = wrap.clientHeight || 260
    if (w === lastW && h === lastH) return { w, h }
    lastW = w
    lastH = h
    renderer.setSize(w, h, false)
    const heightNeed = h > LABEL_PX ? (A * w) / (h - LABEL_PX) : WIDTH_NEED
    const halfW = Math.max(WIDTH_NEED, heightNeed)
    const halfH = (halfW * h) / Math.max(w, 1)
    const pxPerUnit = w / (2 * halfW)
    const contentBottom = CONTENT_BOTTOM_BASE + LABEL_PX / pxPerUnit
    const centerY = (CONTENT_TOP - contentBottom) / 2
    camera.left = -halfW
    camera.right = halfW
    camera.top = halfH + centerY
    camera.bottom = -halfH + centerY
    camera.updateProjectionMatrix()
    return { w, h }
  }

  const projV = new Vector3()
  function updateLabels(): void {
    const { w, h } = fit()
    for (let i = 0; i < list.length; i++) {
      projV.set(xs[i], -(list[i].radius + LABEL_GAP), 0).project(camera)
      labels[i].style.transform =
        `translate(${((projV.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-projV.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, 0)`
    }
  }

  /* 9) 悬停反馈：轻微提亮 + 指针变化（与模块 05 的「克制、局部」反馈一致） */
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  let hoverIndex = -1

  function applyEmissive(): void {
    meshes.forEach((m, i) => {
      m.material.emissive.copy(i === hoverIndex ? EMISSIVE_HOVER : EMISSIVE_NONE)
    })
  }

  canvas.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(meshes, false)
    const idx = hits.length
      ? meshes.indexOf(hits[0].object as Mesh<SphereGeometry, MeshStandardMaterial>)
      : -1
    if (idx !== hoverIndex) {
      hoverIndex = idx
      applyEmissive()
      canvas.style.cursor = idx >= 0 ? 'pointer' : ''
    }
  })
  canvas.addEventListener('pointerleave', () => {
    if (hoverIndex < 0) return
    hoverIndex = -1
    applyEmissive()
    canvas.style.cursor = ''
  })

  /* 10) 渲染循环：仅自转；离开视口暂停；prefers-reduced-motion 只渲染静态一帧 */
  const clock = new Clock()
  let rafId = 0
  let inView = true

  function frame(): void {
    const dt = Math.min(clock.getDelta(), 0.05)
    meshes.forEach((m, i) => {
      const sign = RETRO.has(list[i].id) ? -1 : 1
      m.rotation.y += dt * (SPIN[list[i].id] ?? 0.2) * sign
    })
    renderer.render(scene, camera)
  }

  function tick(): void {
    rafId = 0
    if (!inView) return
    frame()
    rafId = requestAnimationFrame(tick)
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      entries => {
        entries.forEach(en => {
          inView = en.isIntersecting
          if (inView && !prefersReducedMotion && !rafId) tick()
        })
      },
      { threshold: 0 }
    ).observe(host)
  }

  function redraw(): void {
    lastW = -1
    lastH = -1
    updateLabels()
    renderer.render(scene, camera)
  }
  window.addEventListener('resize', redraw)
  if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(wrap)

  updateLabels()
  if (prefersReducedMotion) {
    renderer.render(scene, camera)
  } else {
    tick()
  }
}
