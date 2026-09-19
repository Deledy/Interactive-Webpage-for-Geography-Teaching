/**
 * M4 子模块：地球自转线速度 3D 模型（Three.js，npm 引入）
 *
 * 讲解逻辑（2026-09-19 教师定稿：完整地球 + 仅保留楔形动画，不剖切、无辅助线）：
 * 1. 完整 3D 地球（程序化贴图 + 明暗光照提供立体感），标注北极 / 南极；
 * 2. 北半球两条纬线与赤道带扫掠动画（30°S / 60°S 只保留纬度名标注，教师要求）：
 *    各观测点同一小时转过相同角度（扇形从 A 等速扫到 B，三条同步——即"角速度相同"；
 *    展示跨度 70° 为放大示意，真实 1 小时 = 15°，教师确认可放大数据）；
 * 3. 扇形半径即纬线圆周半径 r = R·cosφ，外缘弧长标注 837 / 1447 / 1670 km
 *    —— 同样的 1 小时，纬度越低转过的弧长越长，即线速度越大。
 *
 * 地理风格：程序化等距圆柱投影贴图（海洋 + 示意陆地 + 经纬网），零外部素材、零远程请求；
 * 贴图为教学示意，非精确海岸线。
 */
import {
  AdditiveBlending, AmbientLight, BufferAttribute, BufferGeometry, CanvasTexture,
  Clock, Color, ConeGeometry, DirectionalLight, DoubleSide,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Scene,
  SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer
} from 'three'
import { LAND_BLOBS, LAND_POLYGONS } from '../data/worldLand'
import type { LatitudePoint } from '../types'
import { reduced } from '../utils/motion'

export interface LatGlobeHandle {
  /** 销毁模型：停止动画、释放 WebGL 资源与 DOM */
  dispose(): void
}

/** 场景单位下的地球半径 */
const R = 1
/** 相机到注视点的距离（用于视域换算） */
const CAM_DIST = 3.9
/** 需要完整显示的场景半高（球体直径约占舞台高度 77%，弧长标签外移后仍在视域内） */
const VIEW_HALF = 1.3
/** 扇形起始方位（度）与展示跨度（度）：真实 1 小时转过 15°，此处放大到 70° 便于看清（教学示意，教师确认可放大数据） */
const WEDGE_A = 15
const WEDGE_SPAN = 70
/** 扇形外缘半径系数（略缩进球面，避免与纬线环 z-fighting） */
const WEDGE_RF = 0.995
/** 扫掠时间线（秒）：扫出 → 保持 → 收回 → 停顿，循环演示"同一小时" */
const T_SWEEP = 2.4
const T_HOLD = 3.0
const T_RETRACT = 0.5
const T_REST = 0.5
/** 扇形采样精度 */
const FAN_STEPS = 16
const DEG = Math.PI / 180
const UP = new Vector3(0, 1, 0)

type Band = 'equator' | 'mid' | 'high'
type LabelMode = 'left' | 'center' | 'right'

function detectWebGL(): boolean {
  try {
    const cv = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (cv.getContext('webgl') || cv.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

/** 读取设计令牌（配色一律取自 tokens.css，不在模块内写死色值） */
function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** 纬度分组：决定纬线、扇形与配色的三档层次 */
function bandOf(lat: number): Band {
  const abs = Math.abs(lat)
  if (abs < 1) return 'equator'
  return abs < 45 ? 'mid' : 'high'
}

/** 纬度标签文本（由数据纬度推导） */
function formatLat(lat: number): string {
  if (lat === 0) return '0°'
  return `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`
}

/** 等距圆柱投影下描绘闭合多边形（相邻顶点中点间用二次贝塞尔平滑） */
function tracePolygon(
  ctx: CanvasRenderingContext2D,
  poly: [number, number][],
  w: number,
  h: number
): void {
  const n = poly.length
  const px = (i: number): number => ((poly[i][0] + 180) / 360) * w
  const py = (i: number): number => ((90 - poly[i][1]) / 180) * h
  ctx.beginPath()
  ctx.moveTo((px(0) + px(n - 1)) / 2, (py(0) + py(n - 1)) / 2)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    ctx.quadraticCurveTo(px(i), py(i), (px(i) + px(j)) / 2, (py(i) + py(j)) / 2)
  }
  ctx.closePath()
}

/** 程序化生成地球贴图（海洋 + 示意陆地 + 经纬网） */
function makeEarthTexture(maxAniso: number): CanvasTexture {
  const W = 1024
  const H = 512
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')

  if (ctx) {
    // 海洋：赤道略亮、两极偏深
    const ocean = ctx.createLinearGradient(0, 0, 0, H)
    ocean.addColorStop(0, '#07172c')
    ocean.addColorStop(0.28, '#0a2a48')
    ocean.addColorStop(0.5, '#0f4267')
    ocean.addColorStop(0.72, '#0a2a48')
    ocean.addColorStop(1, '#07172c')
    ctx.fillStyle = ocean
    ctx.fillRect(0, 0, W, H)

    // 海面微光：避免大片纯色，投屏时呈"海面质感"
    for (let i = 0; i < 900; i++) {
      const alpha = 0.02 + Math.random() * 0.05
      ctx.fillStyle = `rgba(122, 206, 255, ${alpha.toFixed(3)})`
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.8, 1.8)
    }

    // 陆地
    const land = ctx.createLinearGradient(0, 0, 0, H)
    land.addColorStop(0, '#1c4742')
    land.addColorStop(0.35, '#255a49')
    land.addColorStop(0.5, '#2d6c4c')
    land.addColorStop(0.7, '#255a49')
    land.addColorStop(1, '#1c4742')
    ctx.save()
    ctx.shadowColor = 'rgba(92, 220, 255, 0.5)'
    ctx.shadowBlur = 12
    ctx.fillStyle = land
    for (const poly of LAND_POLYGONS) {
      tracePolygon(ctx, poly, W, H)
      ctx.fill()
    }
    for (const blob of LAND_BLOBS) {
      const cx = ((blob.c[0] + 180) / 360) * W
      const cy = ((90 - blob.c[1]) / 180) * H
      const rx = (blob.r[0] / 360) * W
      const ry = (blob.r[1] / 180) * H
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, ((blob.rot ?? 0) * Math.PI) / 180, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // 海岸描边
    ctx.strokeStyle = 'rgba(146, 234, 255, 0.34)'
    ctx.lineWidth = 1.1
    for (const poly of LAND_POLYGONS) {
      tracePolygon(ctx, poly, W, H)
      ctx.stroke()
    }

    // 经纬网（经线 / 纬线每 30°，赤道略亮）
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(122, 210, 255, 0.1)'
    for (let lon = -150; lon <= 150; lon += 30) {
      const x = ((lon + 180) / 360) * W
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = ((90 - lat) / 180) * H
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(122, 226, 255, 0.2)'
    ctx.beginPath()
    ctx.moveTo(0, H / 2)
    ctx.lineTo(W, H / 2)
    ctx.stroke()

    // 极地压暗：让球面有"球感"
    const polar = ctx.createLinearGradient(0, 0, 0, H)
    polar.addColorStop(0, 'rgba(4, 10, 20, 0.55)')
    polar.addColorStop(0.18, 'rgba(4, 10, 20, 0)')
    polar.addColorStop(0.82, 'rgba(4, 10, 20, 0)')
    polar.addColorStop(1, 'rgba(4, 10, 20, 0.55)')
    ctx.fillStyle = polar
    ctx.fillRect(0, 0, W, H)
  }

  const tex = new CanvasTexture(cv)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = Math.max(1, maxAniso)
  return tex
}

/** 扇形几何：顶点 0 为纬线圆心，顶点 1..steps+1 为外缘弧采样点；必须补三角扇索引，
 * 否则非索引渲染会把顶点每 3 个一组错切成 6 个零散三角形（表现为细长尖刺） */
function makeFanGeometry(steps: number): BufferGeometry {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array((steps + 2) * 3), 3))
  const index: number[] = []
  for (let i = 0; i < steps; i++) index.push(0, i + 1, i + 2)
  geo.setIndex(index)
  return geo
}

interface Wedge {
  y: number
  r: number
  fan: BufferGeometry
  fanAttr: BufferAttribute
  bDot: Mesh
  bHead: Mesh
}

/**
 * 在 host 内创建 3D 剖切地球线速度模型。
 * @returns 句柄（含 dispose）；WebGL 不可用时返回 null，由调用方降级为静态示意
 */
export function createLatGlobe(host: HTMLElement, points: LatitudePoint[]): LatGlobeHandle | null {
  if (!detectWebGL()) return null

  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true })
    if (!renderer.getContext()) throw new Error('WebGL 上下文不可用')
  } catch {
    return null
  }

  const C_PRIMARY = cssVar('--c-primary', '#35c6f4')
  const C_ACCENT = cssVar('--c-accent-2', '#7b61ff')
  const colorOf = (band: Band): Color => new Color(band === 'equator' ? C_PRIMARY : C_ACCENT)
  const opacityOf = (band: Band): number => (band === 'equator' ? 1 : band === 'mid' ? 0.82 : 0.5)

  const disposables: { dispose(): void }[] = []
  const labels: {
    el: HTMLElement
    anchor: Vector3
    mode: LabelMode
    sweep?: boolean
    kind?: 'pole-n' | 'pole-s' | 'rim'
  }[] = []
  const wedges: Wedge[] = []

  const canvas = renderer.domElement
  canvas.className = 'lat__canvas'
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', '地球自转线速度三维示意模型')
  host.appendChild(canvas)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  const scene = new Scene()
  const camera = new PerspectiveCamera(34, 1, 0.1, 50)
  // 高位俯视（俯角约 41°）：扇形在水平面上，平视会被透视压成细条；
  // 俯视让纬线平面正对视线，扇形充分展开，五层半径差异也一目了然
  camera.position.set(0, 2.55, 2.95)
  camera.lookAt(0, 0.05, 0)

  // 立体感三要素：低环境光 + 强方向光（形成明暗过渡）+ 背缘光（勾出轮廓）
  scene.add(new AmbientLight(0xa9caff, 0.8))
  const sun = new DirectionalLight(0xfff3e0, 1.8)
  sun.position.set(2.4, 2.2, 3)
  scene.add(sun)
  const rim = new DirectionalLight(0x5f7bff, 0.85)
  rim.position.set(-2.5, 0.8, -2.6)
  scene.add(rim)

  // ---- 完整地球本体（2026-09-19 教师定稿：不剖切、无圆环/地轴等辅助线，只留楔形动画） ----
  const texture = makeEarthTexture(renderer.capabilities.getMaxAnisotropy())
  disposables.push(texture)
  const earthGeo = new SphereGeometry(R, 64, 48)
  disposables.push(earthGeo)
  const earthMat = new MeshStandardMaterial({
    map: texture,
    // 低粗糙度让海面出现太阳高光，配合强方向光读出"球"而不是"圆盘"
    roughness: 0.6,
    metalness: 0,
    // 自发光只垫底防止暗面死黑，压低强度保住明暗过渡（立体感来源）
    emissive: new Color('#0c2240'),
    emissiveIntensity: 0.55
  })
  disposables.push(earthMat)
  scene.add(new Mesh(earthGeo, earthMat))

  // ---- 各纬线：北半球与赤道带扇形楔扫掠 + A/B 观测点；南半球只标注纬度名 ----
  points.forEach((point) => {
    const band = bandOf(point.lat)
    const color = colorOf(band)
    const opacity = opacityOf(band)
    const phi = point.lat * DEG
    const y = Math.sin(phi) * R
    const r = Math.cos(phi) * R * WEDGE_RF

    // 纬度名标签：对齐各纬线左端高度，fit() 中右对齐钳制到球盘左缘外一列（教科书排布）
    const nameEl = document.createElement('span')
    nameEl.className = 'lat__glabel'
    nameEl.textContent = point.name
    host.appendChild(nameEl)
    labels.push({ el: nameEl, anchor: new Vector3(-Math.cos(phi) * R, y, 0), mode: 'left', kind: 'rim' })

    // 教师要求（2026-09-19）：只保留北半球与赤道的线速度动画
    if (point.lat < 0) return

    // 扇形楔：顶点在纬线圆心（地轴上），外缘沿纬线扫过展示跨度；
    // 关闭深度测试 = 贴在完整球面上方渲染（扇形半径 0.995r 在球面内侧，否则会被球体遮住）
    const fanGeo = makeFanGeometry(FAN_STEPS)
    const fanAttr = fanGeo.getAttribute('position') as BufferAttribute
    disposables.push(fanGeo)
    const fanMat = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3 + 0.15 * opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      side: DoubleSide
    })
    disposables.push(fanMat)
    scene.add(new Mesh(fanGeo, fanMat))

    // A 点（起始位置）与 B 点（1 小时后位置，随扫掠东移并带方向箭头），同样贴面渲染
    const dotGeo = new SphereGeometry(0.02, 12, 10)
    disposables.push(dotGeo)
    const aMat = new MeshBasicMaterial({ color, depthTest: false })
    disposables.push(aMat)
    const aBeta = WEDGE_A * DEG
    const aDot = new Mesh(dotGeo, aMat)
    aDot.position.set(Math.sin(aBeta) * r, y, Math.cos(aBeta) * r)
    scene.add(aDot)

    const bDotGeo = new SphereGeometry(0.024, 12, 10)
    disposables.push(bDotGeo)
    const bMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false })
    disposables.push(bMat)
    const bDot = new Mesh(bDotGeo, bMat)
    scene.add(bDot)

    const bHeadGeo = new ConeGeometry(0.02, 0.055, 10)
    disposables.push(bHeadGeo)
    const bHead = new Mesh(bHeadGeo, bMat)
    scene.add(bHead)

    wedges.push({ y, r, fan: fanGeo, fanAttr, bDot, bHead })

    // 弧长标签：锚在扇形外缘中点外侧（r×1.18，与扇面留出间隙且不溢出舞台右缘）
    const arcEl = document.createElement('span')
    arcEl.className = 'lat__glabel lat__glabel--arc'
    arcEl.textContent = `${point.arcKm} km`
    host.appendChild(arcEl)
    const betaMid = (WEDGE_A + WEDGE_SPAN / 2) * DEG
    labels.push({
      el: arcEl,
      anchor: new Vector3(Math.sin(betaMid) * r * 1.18, y, Math.cos(betaMid) * r * 1.18),
      mode: 'center',
      sweep: true
    })
  })

  // ---- 两极标注：锚点仅占位，fit() 中贴球盘视觉上下边缘（锚在 (0,±R) 会投影进球盘内部） ----
  const poleLabels: [string, 'pole-n' | 'pole-s'][] = [
    ['北极', 'pole-n'],
    ['南极', 'pole-s']
  ]
  for (const [text, kind] of poleLabels) {
    const el = document.createElement('span')
    el.className = 'lat__glabel lat__glabel--pole'
    el.textContent = text
    host.appendChild(el)
    labels.push({ el, anchor: new Vector3(0, kind === 'pole-n' ? R : -R, 0), mode: 'center', kind })
  }

  // ---- 扫掠动画：北半球与赤道三个扇形同步扫过相同角度（角速度相同），弧长却不同 ----
  function easeInOut(x: number): number {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
  }
  function progressAt(t: number): number {
    const total = T_SWEEP + T_HOLD + T_RETRACT + T_REST
    const t2 = t % total
    if (t2 < T_SWEEP) return easeInOut(t2 / T_SWEEP)
    if (t2 < T_SWEEP + T_HOLD) return 1
    if (t2 < T_SWEEP + T_HOLD + T_RETRACT) return 1 - (t2 - T_SWEEP - T_HOLD) / T_RETRACT
    return 0
  }

  const tangent = new Vector3()
  function updateSweep(p: number): void {
    for (const w of wedges) {
      const fanArr = w.fanAttr.array as Float32Array
      fanArr[0] = 0
      fanArr[1] = w.y
      fanArr[2] = 0
      for (let i = 0; i <= FAN_STEPS; i++) {
        const b = (WEDGE_A + WEDGE_SPAN * p * (i / FAN_STEPS)) * DEG
        const o = (i + 1) * 3
        fanArr[o] = Math.sin(b) * w.r
        fanArr[o + 1] = w.y
        fanArr[o + 2] = Math.cos(b) * w.r
      }
      w.fanAttr.needsUpdate = true
      w.fan.computeBoundingSphere()

      const bb = (WEDGE_A + WEDGE_SPAN * p) * DEG
      w.bDot.position.set(Math.sin(bb) * w.r, w.y, Math.cos(bb) * w.r)
      w.bHead.position.copy(w.bDot.position)
      tangent.set(Math.cos(bb), 0, -Math.sin(bb))
      w.bHead.quaternion.setFromUnitVectors(UP, tangent)
      const visible = p > 0.02
      w.bDot.visible = visible
      w.bHead.visible = visible
    }
    for (const item of labels) {
      if (item.sweep) item.el.style.opacity = p.toFixed(2)
    }
  }

  // ---- 视域与标签投影 ----
  const project = new Vector3()
  /** 球体在画布上的投影：圆心像素坐标与半径（供极点 / 纬度名标签贴边定位） */
  const globe = { x: 0, y: 0, r: 0 }
  function fit(): void {
    const w = host.clientWidth || 400
    const h = host.clientHeight || 400
    renderer.setSize(w, h, false)
    const aspect = w / Math.max(h, 1)
    camera.aspect = aspect
    const half = VIEW_HALF / Math.min(1, aspect)
    camera.fov = (2 * Math.atan(half / CAM_DIST) * 180) / Math.PI
    camera.updateProjectionMatrix()

    project.set(0, 0, 0).project(camera)
    globe.x = (project.x * 0.5 + 0.5) * w
    globe.y = (-project.y * 0.5 + 0.5) * h
    const focal = h / 2 / Math.tan((camera.fov * Math.PI) / 360)
    globe.r = Math.tan(Math.asin(Math.min(0.999, R / camera.position.length()))) * focal

    for (const item of labels) {
      project.copy(item.anchor).project(camera)
      let x = (project.x * 0.5 + 0.5) * w
      let y = (-project.y * 0.5 + 0.5) * h
      if (item.kind === 'pole-n' || item.kind === 'pole-s') {
        // 极点：水平对齐球心，垂直贴视觉边缘外 20px
        x = globe.x
        y = globe.y + (item.kind === 'pole-n' ? -1 : 1) * (globe.r + 20)
      } else if (item.kind === 'rim') {
        // 纬度名：右对齐钳制到球盘左缘外 10px 的一列
        x = Math.min(x, globe.x - globe.r - 10)
      }
      const ox = item.mode === 'center' ? '-50%' : item.mode === 'right' ? '0%' : '-100%'
      item.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${ox}, -50%)`
    }
  }

  const still = reduced()
  updateSweep(still ? 1 : 0)
  fit()
  renderer.render(scene, camera)

  // ---- 动画循环（reduced-motion 时只渲染终态一帧） ----
  const clock = new Clock()
  let clockTime = 0
  let rafId = 0
  let running = true
  function tick(): void {
    if (!running) return
    clockTime += Math.min(clock.getDelta(), 0.05)
    updateSweep(progressAt(clockTime))
    renderer.render(scene, camera)
    rafId = requestAnimationFrame(tick)
  }
  if (!still) rafId = requestAnimationFrame(tick)

  let observer: ResizeObserver | null = null
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      fit()
      if (still) renderer.render(scene, camera)
    })
    observer.observe(host)
  } else {
    window.addEventListener('resize', fit)
  }
  window.requestAnimationFrame(() => {
    fit()
    if (still) renderer.render(scene, camera)
  })

  return {
    dispose(): void {
      running = false
      if (rafId) cancelAnimationFrame(rafId)
      observer?.disconnect()
      window.removeEventListener('resize', fit)
      labels.forEach((item) => item.el.remove())
      disposables.forEach((item) => item.dispose())
      renderer.dispose()
      try {
        renderer.forceContextLoss()
      } catch {
        /* 部分环境不支持，忽略 */
      }
      canvas.remove()
    }
  }
}
