/* ============================================================
   模块 07 · 太阳系 3D 模型（绕日公转）
   ------------------------------------------------------------
   用于「运动特征」证据卡：太阳居中，行星沿近圆轨道在同一平面内同向绕日
   公转 —— 直观呈现同向性 / 近圆性 / 共面性。
   与模块 05「太阳系与八大行星」、模块 06「绕日公转演示」共用同一套标准资源：
   - 贴图：src/assets/textures/*.jpg（Vite 静态导入并 base64 内联，file:// 双击可用）；
     太阳用太阳贴图，行星用各自表面贴图
   - 材质：MeshStandardMaterial（roughness 0.92 / metalness 0.05）+ sRGB 色彩空间
   - 光照：同款三点光（环境光 + 主方向光 + 轮廓光）
   - 相机：正交相机（视域内平行等大、无透视变形）
   - 交互：无（卡片内静态展示，不设选中 / 悬停态）
   - 动效：行星同向匀速公转 + 缓慢自转；prefers-reduced-motion 时只渲染静态一帧
   - 性能：仅进入视口时渲染；容器尺寸变化由 ResizeObserver 兜底重算取景
   WebGL 不可用或初始化失败时抛错，且此时尚未改动宿主 DOM ——
   调用方可安全保留 2D 示意兜底。
   ============================================================ */
import {
  Scene, OrthographicCamera, WebGLRenderer, Vector3,
  AmbientLight, DirectionalLight, Mesh, SphereGeometry, MeshStandardMaterial,
  MeshBasicMaterial, LineLoop, LineBasicMaterial, BufferGeometry,
  Texture, TextureLoader, Clock, SRGBColorSpace
} from 'three'
import { prefersReducedMotion } from '../utils/dom'
import sunTex from '../assets/textures/sun.jpg'
import mercuryTex from '../assets/textures/mercury.jpg'
import venusTex from '../assets/textures/venus.jpg'
import earthTex from '../assets/textures/earth.jpg'
import marsTex from '../assets/textures/mars.jpg'
import jupiterTex from '../assets/textures/jupiter.jpg'
import saturnTex from '../assets/textures/saturn.jpg'
import uranusTex from '../assets/textures/uranus.jpg'
import neptuneTex from '../assets/textures/neptune.jpg'

/** 行星表面贴图（与模块 05 / 06 同一套文件，来源登记见 docs/06_资源引用.md） */
const PLANET_TEX: Record<string, string> = {
  mercury: mercuryTex,
  venus: venusTex,
  earth: earthTex,
  mars: marsTex,
  jupiter: jupiterTex,
  saturn: saturnTex,
  uranus: uranusTex,
  neptune: neptuneTex
}

/** 太阳半径（场景单位，示意值；比最大行星略大，避免在压缩轨道下显得过分夸张） */
const SUN_RADIUS = 1.0
/** 默认公转角速度（rad/s，示意值） */
const DEFAULT_SPEED = 0.4
/** 相机仰角（相对黄道面）：侧面俯视 —— 与轨道面成约 38° 夹角，既看得出「共面」，
    又能看到行星在轨道上的前后位置关系（正交投影下纵深方向按 sin38° 压缩） */
const ELEV = (38 * Math.PI) / 180
/** 相机距离（正交相机下只决定朝向，不影响成像大小） */
const CAM_DIST = 100
/** 轨道线颜色与透明度 */
const ORBIT_COLOR = 0x9fb4ff
const ORBIT_OPACITY = 0.6

export interface OrbitPlanet {
  /** 行星 id（用于取贴图） */
  id: string
  /** 球体半径（场景单位，示意值） */
  radius: number
  /** 轨道半径（场景单位，示意值，非真实 AU） */
  orbitRadius: number
  /** 公转角速度（rad/s，示意值；内圈快、外圈慢） */
  speed?: number
}

export interface SolarOrbitOptions {
  planets: OrbitPlanet[]
  ariaLabel: string
}

/**
 * 在宿主元素内渲染「太阳 + 行星绕日公转」的 3D 模型。
 * 创建 WebGL 失败时抛错，且此时尚未改动宿主 DOM —— 调用方可安全保留 2D 兜底。
 */
export function createSolarOrbit(host: HTMLElement, opts: SolarOrbitOptions): void {
  const list = opts.planets
  if (!list.length) return

  /* 1) 先建渲染器：失败即抛错，不触碰宿主 DOM（2D 兜底得以保留） */
  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 4000)
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  if (!renderer.getContext()) throw new Error('WebGL 上下文不可用')
  const canvas = renderer.domElement
  canvas.className = 'solarorbit__canvas'
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', opts.ariaLabel)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  /* 2) 宿主 DOM：3D 画布铺满容器 */
  host.classList.add('is-3d')
  host.innerHTML = '<div class="solarorbit"></div>'
  const wrap = host.firstElementChild as HTMLElement
  wrap.appendChild(canvas)

  /* 3) 光照：与模块 05 / 06 完全一致（环境光 + 主方向光 + 轮廓光） */
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

  /* 5) 太阳：自发光球体（贴图直接呈现，不受光照影响） */
  const sun = new Mesh(
    new SphereGeometry(SUN_RADIUS, 40, 40),
    new MeshBasicMaterial({ map: tex(sunTex) })
  )
  scene.add(sun)

  /* 6) 轨道线（圆周，共面）+ 行星球体：同向匀速公转 */
  const maxOrbit = Math.max(...list.map(p => p.orbitRadius))
  const maxPlanetR = Math.max(...list.map(p => p.radius))
  const orbits: { mesh: Mesh<SphereGeometry, MeshStandardMaterial>; orbitRadius: number; speed: number; phase: number }[] = []
  list.forEach((p, i) => {
    const pts: Vector3[] = []
    const SEG = 128
    for (let k = 0; k < SEG; k++) {
      const a = (k / SEG) * Math.PI * 2
      pts.push(new Vector3(Math.cos(a) * p.orbitRadius, 0, Math.sin(a) * p.orbitRadius))
    }
    scene.add(new LineLoop(
      new BufferGeometry().setFromPoints(pts),
      new LineBasicMaterial({ color: ORBIT_COLOR, transparent: true, opacity: ORBIT_OPACITY })
    ))

    const map = tex(PLANET_TEX[p.id])
    const mesh = new Mesh(
      new SphereGeometry(p.radius, 32, 32),
      new MeshStandardMaterial({ map, color: map ? 0xffffff : 0x8fa3bd, roughness: 0.92, metalness: 0.05 })
    )
    scene.add(mesh)
    orbits.push({ mesh, orbitRadius: p.orbitRadius, speed: p.speed ?? DEFAULT_SPEED, phase: i * 0.7 })
  })

  /* 7) 相机：正交 + 俯视（自上而下俯瞰黄道面，太阳位于画面正中）。
        近乎垂直向下时默认 up=(0,1,0) 会与视线方向接近平行，导致画面滚转不稳定，
        故改用 (0,0,-1) 作为 up 向量。 */
  camera.up.set(0, 0, -1)
  camera.position.set(0, Math.sin(ELEV) * CAM_DIST, Math.cos(ELEV) * CAM_DIST)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()

  let lastW = -1
  let lastH = -1
  function fit(): void {
    const w = wrap.clientWidth || host.clientWidth || 260
    const h = wrap.clientHeight || 200
    if (w === lastW && h === lastH) return
    lastW = w
    lastH = h
    renderer.setSize(w, h, false)
    /* 横向按最外轨道 + 行星半径取景；纵向按容器宽高比换算 */
    const halfW = (maxOrbit + maxPlanetR) * 1.06
    const halfH = (halfW * h) / Math.max(w, 1)
    camera.left = -halfW
    camera.right = halfW
    camera.top = halfH
    camera.bottom = -halfH
    camera.updateProjectionMatrix()
  }

  /* 8) 位置计算 + 渲染循环 */
  const clock = new Clock()
  let phaseTime = 0
  function place(): void {
    orbits.forEach(o => {
      const a = o.phase + phaseTime * o.speed
      o.mesh.position.set(Math.cos(a) * o.orbitRadius, 0, Math.sin(a) * o.orbitRadius)
    })
  }

  function frame(): void {
    const dt = Math.min(clock.getDelta(), 0.05)
    phaseTime += dt
    place()
    orbits.forEach(o => { o.mesh.rotation.y += dt * 0.3 })
    sun.rotation.y += dt * 0.02
    renderer.render(scene, camera)
  }

  let rafId = 0
  let inView = true

  function tick(): void {
    rafId = 0
    if (!inView) return
    frame()
    rafId = requestAnimationFrame(tick)
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      entries.forEach(en => {
        inView = en.isIntersecting
        if (inView && !prefersReducedMotion && !rafId) tick()
      })
    }, { threshold: 0 }).observe(host)
  }

  function redraw(): void {
    lastW = -1
    lastH = -1
    fit()
    place()
    renderer.render(scene, camera)
  }
  window.addEventListener('resize', redraw)
  if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(wrap)

  fit()
  place()
  if (prefersReducedMotion) {
    renderer.render(scene, camera)
  } else {
    tick()
  }
}
