/* ============================================================
   模块 07 · 八大行星卡片组的 3D 球体渲染
   ------------------------------------------------------------
   卡片组的容器 / 卡片 / 名称胶囊 / 点线装饰 / 引言由 HTML + CSS 布局，
   本模块在「卡片行」之上叠加一层 WebGL 画布，用本课标准 3D 资源
   （src/assets/textures/*.jpg 贴图 + 与模块 05 / 06 同款光照 / 材质 / 性能策略）
   渲染 8 颗行星球体，球心与每张卡片的球体舞台一一对齐 —— 既保留参考稿的
   卡片外观，又保留原有的真实 3D 模型（贴图 + 光照 + 自转 + 悬停反馈）。
   - 单渲染器 / 单画布：8 张卡共用一份 WebGL 上下文与一份贴图上传
   - 正交相机：世界单位 = 屏幕像素，球体直径直接取卡片 --d（超宽时按舞台宽收敛）
   - 相机正对画面，故土星 / 海王星的光环按参考稿倾斜（水平环在正视下退化为一条线）
   - 悬停：对应卡片 hover 时球体轻微提亮（与模块 05 的克制反馈一致）
   - 选中：当前选中行星球体极淡提亮（与卡片蓝色描边共同表达选中态）
   - 自转：缓慢自转（金星、天王星逆向）；prefers-reduced-motion 时只渲染静态一帧
   - 性能：仅进入视口时渲染；容器尺寸 / 布局变化由 ResizeObserver 重算对齐
   WebGL 不可用或初始化失败时由调用方保留 CSS 贴图球兜底 —— 本函数在改动宿主
   DOM 之前完成渲染器创建，失败即抛错，宿主原有内容不受影响。
   ============================================================ */
import {
  Scene, OrthographicCamera, WebGLRenderer, Group,
  AmbientLight, DirectionalLight, Mesh, SphereGeometry, MeshStandardMaterial,
  RingGeometry, MeshBasicMaterial, Color, Texture, TextureLoader, Clock, DoubleSide, SRGBColorSpace
} from 'three'
import { prefersReducedMotion } from '../utils/dom'
import { PLANET_TEX, RING_TEX, SPIN, RETRO } from './planetRow3d'

/** 光环外半径倍数（按行星）——土星显著、海王星细淡（与参考稿一致） */
const RING_OUTER: Record<string, number> = { saturn: 1.85, neptune: 1.72 }
/** 光环面倾角（rad）：正视相机下需倾斜才可见，倾角越大椭圆越"扁" */
const RING_TILT: Record<string, number> = { saturn: 0.30, neptune: 0.47 }
/** 屏幕上椭圆长轴的倾斜角（rad）——微调倾斜方向以贴合参考稿
    （需配合 rotation.order = 'ZXY'：默认 XYZ 顺序下绕 z 的滚转对圆环无效果） */
const RING_ROLL: Record<string, number> = { saturn: 0.10, neptune: -0.16 }
/** 海王星无环贴图，用素色细环（浅蓝半透明） */
const NEPTUNE_RING_COLOR = 0x9cc0ff

/** 球体默认 / 舞台最大占比：直径不超过舞台宽的 88%（与 CSS 兜底球一致） */
const GLOBE_MAX_RATIO = 0.44
/** 光环外径不超过舞台宽的 96%（与 CSS 兜底环一致） */
const RING_MAX_RATIO = 0.96

/** 悬停 / 选中提亮色（悬停略强，选中极淡——选中态主要由卡片蓝色描边表达） */
const EMISSIVE_HOVER = new Color(0x223344)
const EMISSIVE_SELECT = new Color(0x101c30)
const EMISSIVE_NONE = new Color(0x000000)

/**
 * 在卡片行（.planet-deck__row）上叠加 3D 球体渲染。
 * 创建 WebGL 失败时抛错，且此时尚未改动宿主 DOM —— 调用方可安全保留 CSS 兜底。
 */
export function createPlanetDeck3D(row: HTMLElement): void {
  const cards = Array.from(row.querySelectorAll<HTMLElement>('.planet-deck__card'))
  if (!cards.length) return

  /* 1) 先建渲染器：失败即抛错，不触碰宿主 DOM（CSS 兜底得以保留） */
  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 4000)
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  if (!renderer.getContext()) throw new Error('WebGL 上下文不可用')
  const canvas = renderer.domElement
  canvas.className = 'planet-deck__canvas'
  canvas.setAttribute('aria-hidden', 'true')
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  /* 2) 宿主 DOM：仅在卡片行内追加画布（卡片结构不动），并标记 3D 态以隐藏 CSS 兜底球 */
  const deck = row.closest('.planet-deck')
  if (deck) deck.classList.add('is-3d')
  row.appendChild(canvas)

  /* 3) 相机：正交投影，世界单位 = 屏幕像素（投影范围随画布像素尺寸设置）。
     相机必须离开原点（球体在 z=0）：否则物体正好落在相机平面上、被 near 裁剪掉。
     正交投影下相机距离不影响成像大小，只需保证物体落在 near~far 之间。 */
  camera.position.set(0, 0, 100)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()

  /* 4) 光照：与模块 05 / 06 完全一致（环境光 + 主方向光 + 轮廓光） */
  scene.add(new AmbientLight(0x99aaff, 0.95))
  const mainLight = new DirectionalLight(0xfff3e0, 1.5)
  mainLight.position.set(10, 16, 14)
  scene.add(mainLight)
  const rimLight = new DirectionalLight(0x6688ff, 0.45)
  rimLight.position.set(-12, -6, -10)
  scene.add(rimLight)

  /* 5) 贴图：sRGB 色彩空间（three r152+ 色彩管理，与模块 05 / 06 一致） */
  const loader = new TextureLoader()
  const tex = (url: string | undefined): Texture | undefined => {
    if (!url) return undefined
    const t = loader.load(url)
    t.colorSpace = SRGBColorSpace
    return t
  }

  /* 6) 逐卡建球（单位几何 + 按半径缩放：舞台尺寸变化时无需重建几何）；土星 / 海王星带环 */
  const ids = cards.map(c => c.dataset.planet ?? '')
  const holders: Group[] = []
  const meshes: Mesh<SphereGeometry, MeshStandardMaterial>[] = []
  const ringByIndex: (Mesh<RingGeometry, MeshBasicMaterial> | null)[] = []
  const radii: number[] = ids.map(() => 0)

  ids.forEach((id) => {
    const holder = new Group()
    scene.add(holder)
    holders.push(holder)

    const map = tex(PLANET_TEX[id])
    const mesh = new Mesh(
      new SphereGeometry(1, 48, 48),
      new MeshStandardMaterial({
        map,
        color: map ? 0xffffff : 0x8fa3bd,
        roughness: 0.92,
        metalness: 0.05
      })
    )
    holder.add(mesh)
    meshes.push(mesh)

    const outer = RING_OUTER[id]
    if (outer) {
      const ringMap = tex(RING_TEX[id])
      const ring = new Mesh(
        new RingGeometry(outer === RING_OUTER.neptune ? 1.50 : 1.15, outer, 64),
        ringMap
          ? new MeshBasicMaterial({ map: ringMap, side: DoubleSide, transparent: true, depthWrite: false })
          : new MeshBasicMaterial({ color: NEPTUNE_RING_COLOR, opacity: 0.42, side: DoubleSide, transparent: true, depthWrite: false })
      )
      /* ZXY：先抬倾角、再绕 z 滚转 → 屏幕上椭圆长轴倾斜角 = RING_ROLL */
      ring.rotation.order = 'ZXY'
      ring.rotation.set(-Math.PI / 2 + (RING_TILT[id] ?? 0.3), 0, RING_ROLL[id] ?? 0)
      holder.add(ring)
      ringByIndex.push(ring)
    } else {
      ringByIndex.push(null)
    }
  })

  /* 7) 对齐：世界单位 = 屏幕像素（正交相机 halfW/halfH = 画布像素的一半），
        球心取每张卡片球体舞台的中心；半径取 min(--d/2, 舞台宽·44%)，
        带环行星再按「环外径 ≤ 舞台宽·96%」收敛，避免光环溢到相邻卡片。 */
  let lastW = -1
  let lastH = -1

  function measure(): void {
    const w = row.clientWidth
    const h = row.clientHeight
    if (!w || !h) return
    if (w !== lastW || h !== lastH) {
      lastW = w
      lastH = h
      renderer.setSize(w, h, false)
      camera.left = -w / 2
      camera.right = w / 2
      camera.top = h / 2
      camera.bottom = -h / 2
      camera.updateProjectionMatrix()
    }

    const rowRect = row.getBoundingClientRect()
    cards.forEach((card, i) => {
      const stage = card.querySelector<HTMLElement>('.planet-deck__scene') ?? card
      const sr = stage.getBoundingClientRect()
      holders[i].position.set(
        sr.left + sr.width / 2 - rowRect.left - w / 2,
        h / 2 - (sr.top + sr.height / 2 - rowRect.top),
        0
      )

      const dCss = parseFloat(card.style.getPropertyValue('--d')) || 54
      let r = Math.min(dCss / 2, sr.width * GLOBE_MAX_RATIO)
      const outer = RING_OUTER[ids[i]]
      if (outer) r = Math.min(r, (sr.width * RING_MAX_RATIO) / (2 * outer))
      if (r !== radii[i]) {
        radii[i] = r
        meshes[i].scale.setScalar(r)
        ringByIndex[i]?.scale.setScalar(r)
      }
    })
  }

  /* 8) 悬停 / 选中：对应卡片交互时同步球体提亮 */
  let hoverIndex = -1
  let selectedIndex = cards.findIndex(c => c.classList.contains('is-selected'))

  function applyEmissive(): void {
    meshes.forEach((m, i) => {
      const c = i === hoverIndex
        ? EMISSIVE_HOVER
        : i === selectedIndex
          ? EMISSIVE_SELECT
          : EMISSIVE_NONE
      m.material.emissive.copy(c)
    })
  }

  cards.forEach((card, i) => {
    card.addEventListener('mouseenter', () => {
      hoverIndex = i
      applyEmissive()
    })
    card.addEventListener('mouseleave', () => {
      if (hoverIndex !== i) return
      hoverIndex = -1
      applyEmissive()
    })
    card.addEventListener('click', () => {
      selectedIndex = i
      applyEmissive()
    })
  })

  /* 9) 渲染循环：仅自转；离开视口暂停；prefers-reduced-motion 只渲染静态一帧 */
  const clock = new Clock()
  let rafId = 0
  let inView = true

  function frame(): void {
    const dt = Math.min(clock.getDelta(), 0.05)
    meshes.forEach((m, i) => {
      const sign = RETRO.has(ids[i]) ? -1 : 1
      m.rotation.y += dt * (SPIN[ids[i]] ?? 0.2) * sign
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
    ).observe(row)
  }

  function redraw(): void {
    lastW = -1
    lastH = -1
    measure()
    renderer.render(scene, camera)
  }
  window.addEventListener('resize', redraw)
  if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(row)

  measure()
  applyEmissive()
  if (prefersReducedMotion) {
    renderer.render(scene, camera)
  } else {
    tick()
  }
}
