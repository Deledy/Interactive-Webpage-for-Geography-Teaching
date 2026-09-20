/**
 * M4 子模块：地球自转线速度 3D 模型（Three.js，npm 引入）
 *
 * 讲解逻辑（2026-09-19 教师定稿：完整地球 + 仅保留扫掠动画，不剖切、无辅助线；
 * 2026-09-20 教师要求删除扇形楔，只留暖金色轨迹弧）：
 * 1. 完整 3D 地球（真实地球影像贴图 + 明暗光照 + 大气光晕提供立体感），标注北极 / 南极；
 * 2. **地球真自转**（2026-09-20 教师要求）：地球绕地轴自西向东转 70°（演示"1 小时"），
 *    贴图与贴球面经纬网随之转动；三个观测点**钉在地表**（同在 120°E 经线上）随地球一起转，
 *    轨迹弧（原先的扇形楔已按教师要求删除）与弧长标签**固定在空间中**——即"点在空间里划过的轨迹"，球面从弧起点转到弧终点；
 *    三条纬线的点转过的角度相同（角速度相同），展示跨度 70° 为放大示意（真实 1 小时 = 15°，
 *    教师确认可放大数据；跨度上限约 70°，再宽弧终点会越过球盘右缘）；
 *    经线只画两条：地表那条**观测点所在的 120°E**（随球转，三个点永远压在它上面），
 *    以及空间里固定不动的**起始经线**（这条经线"1 小时前"的位置，与 A 点重合）——
 *    两者之间张开的角，就是观测点扫过的圆心角（教师 2026-09-20 反馈：原 170°W 参照经线
 *    在地球真自转后变成一条不经过任何观测点的孤线，已删除）；
 *    **点划过的轨迹另用一条暖金色加粗弧单独描出**（2026-09-20 教师要求：加粗 + 换色，
 *    与纬线区分），从扇形起点 A 随进度一路长到观测点当前位置，见 TRAIL_* 常量与 updateSweep()；
 * 3. 各纬线圆周半径 r = R·cosφ，弧长标注 837 / 1447 / 1670 km
 *    —— 同样的 1 小时，纬度越低转过的弧长越长，即线速度越大。
 *
 * 地理风格：等距圆柱（Plate Carrée）投影的 NASA Blue Marble 影像贴图（公有领域，已登记
 * 06_资源引用.md），零远程请求；经纬网为贴球面的管状线（不悬浮），与影像经纬度严格对齐；
 * 球缘一圈大气光晕由背面加法混合着色器生成。贴图为教学示意。
 */
import {
  AdditiveBlending, AmbientLight, BackSide, BufferGeometry,
  CatmullRomCurve3, Clock, Color, ConeGeometry, DirectionalLight,
  Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshPhongMaterial,
  PerspectiveCamera, Scene, ShaderMaterial, SphereGeometry, SRGBColorSpace,
  Texture, TextureLoader, TubeGeometry, Vector3, WebGLRenderer
} from 'three'
import earthMapUrl from '../../assets/textures/earth-blue-marble.jpg'
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
/** 扫掠时间线（秒）：扫出 → 保持 → 回卷 → 停顿，循环演示"同一小时"。
 *  2026-09-20 教师要求循环间隔缩短：整周期由 5.8s 压到 2.0s（扫出仍占一半时长） */
const T_SWEEP = 1.0
const T_HOLD = 0.6
const T_RETRACT = 0.2
const T_REST = 0.2
/** 观测点所在经线（地理经度）：与参照经线 120°E 同一条——点钉在这条经线上随地球自转东移，
 *  t=0 时正好落在扇形起点（世界方位角 15°），转过 70° 后落在扇形终点（85°） */
const DOT_LON = 120
/** 经纬网采样精度（每个纬线圆 / 经线半圆的点数） */
const GRID_SEG = 128
/** 管状线：沿线细分 / 截面边数 */
const TUBE_SEG = 128
const TUBE_RADIAL = 8
/** 管状线半径（教学纬线）与管心所在半径：管面完全浮在球面之上，不与影像贴图 z-fighting */
const TUBE_R_LAT = R * 0.005
const TUBE_R_EQUATOR = R * 0.006
const TUBE_POS_LAT = R * 1.007
/** 经线的半径与管心半径：比纬线细一档、更暗 */
const TUBE_R_LON = R * 0.0035
const TUBE_POS_LON = R * 1.005
/** 经线透明度：地表那条（随地球转）用 MERIDIAN_OPACITY，空间固定的起始经线用略淡的
 *  START_MERIDIAN_OPACITY 与它区分——两条经线参数完全相同，只差"是否随球转" */
const MERIDIAN_OPACITY = 0.3
const START_MERIDIAN_OPACITY = 0.22
/** 南半球两条取样纬线仍是细线（不加粗），贴面半径取在管状线之上，避免与经线管交叉处共面 */
const THIN_LAT_POS = R * 1.012
/** 轨迹弧（观测点在空间里划过的轨迹，暖金色加粗弧，2026-09-20 教师要求）：
 *  - 管心 1.007：与观测点小球同心，弧正好从两点球心穿过，A / B 两球自然封口；
 *  - 管半径 0.013 → 屏幕直径约 5.2px（球盘半径约 199px），是赤道纬线的 2.2 倍、经线的 3.7 倍，
 *    投屏上明显粗于纬线；同时把纬线管（≤ 0.006）整根包在里面，同心不 z-fighting；
 *  - 整段 70° 只建一次几何，用 setDrawRange 按进度"长出来"，零逐帧分配 */
const TRAIL_R = R * 0.013
const TRAIL_SEG = 96
/** 截面边数比细管多一档：直径 5px 的管用 8 边会看出棱 */
const TRAIL_RADIAL = 12
const TRAIL_OPACITY = 0.92
/** 正对镜头的经度：105°E（亚洲中部）。贴图为 Plate Carrée 投影，默认朝向是 90°W（美洲），
 *  需绕 Y 轴把该经线转到镜头方向——经线与方位角的关系为 a = λ + 90°，故旋转角 = -(λ + 90°) */
const EARTH_FACE_LON = 105
/** 纬度名标签相对"本纬线左端"的偏移（px）：向右让开线端（DX）、向上抬离纬线（DY = 半行高 14px + 12px 间隙） */
const LAT_LABEL_DX = 14
const LAT_LABEL_DY = 26
/** 弧长标签相对轨迹弧的屏幕留白（px）：标签随弧旋转后只占一行高，故按"半行高 + 本值"外推。
 *  取值需盖住轨迹弧本身的视觉半宽（管半径 0.013 世界单位 ≈ 3px）+ 视觉间隙（2026-09-20 教师反馈压盖问题） */
const ARC_LABEL_GAP = 14
/** 弧长标签所在的方位角（度）：必须落在"两条弧之间够宽"的地方——
 *  赤道弧与 30°N 弧之间的屏幕间距随方位角变化，50° 附近只剩约 40px（标签必压弧），
 *  15~25° 一带可达 95~105px，故标签统一锚在弧的起始段 */
const ARC_LABEL_BETA = 20
/** 求弧在屏幕上的走向时，锚点左右各取一点的方位角偏移（弧度） */
const ARC_SAMPLE_D = 0.05
const DEG = Math.PI / 180
const UP = new Vector3(0, 1, 0)

type Band = 'equator' | 'mid' | 'high'
/** 标签对齐方式：center = 以锚点居中；left = 以锚点为左端向右排 */
type LabelMode = 'left' | 'center'

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

/* ---------------- 地球本体：影像贴图 + 经纬网 + 大气光晕 ---------------- */

/** 纬线圆采样点（方位角 a 自 +Z 起算，与扇形楔同一套方位角） */
function circlePoints(lat: number, radius: number): Vector3[] {
  const phi = lat * DEG
  const r = Math.cos(phi) * radius
  const y = Math.sin(phi) * radius
  const out: Vector3[] = []
  for (let i = 0; i <= GRID_SEG; i++) {
    const a = (i / GRID_SEG) * Math.PI * 2
    out.push(new Vector3(Math.sin(a) * r, y, Math.cos(a) * r))
  }
  return out
}

/** 纬线**圆弧**采样点（只取 a0~a1 这一区间，用于轨迹弧）：与 circlePoints 同一套方位角 */
function arcPoints(lat: number, radius: number, a0: number, a1: number, steps: number): Vector3[] {
  const phi = lat * DEG
  const r = Math.cos(phi) * radius
  const y = Math.sin(phi) * radius
  const out: Vector3[] = []
  for (let i = 0; i <= steps; i++) {
    const a = (a0 + (a1 - a0) * (i / steps)) * DEG
    out.push(new Vector3(Math.sin(a) * r, y, Math.cos(a) * r))
  }
  return out
}

/** 经线半圆采样点（入参为地理经度，换算方位角 a = λ + 90°，与球体 UV 展开对齐） */
function meridianPoints(lon: number, radius: number): Vector3[] {
  const a = (lon + 90) * DEG
  const out: Vector3[] = []
  for (let i = 0; i <= GRID_SEG; i++) {
    const phi = (-90 + (i / GRID_SEG) * 180) * DEG
    const r = Math.cos(phi) * radius
    out.push(new Vector3(Math.sin(a) * r, Math.sin(phi) * radius, Math.cos(a) * r))
  }
  return out
}

/** 管状线网格：粗细恒定，不会像 Line 那样在高 DPR 下退化成发丝 */
function makeTubeMesh(
  points: Vector3[],
  radius: number,
  color: string,
  opacity: number,
  disposables: { dispose(): void }[]
): Mesh {
  const geo = new TubeGeometry(new CatmullRomCurve3(points), TUBE_SEG, radius, TUBE_RADIAL, false)
  const mat = new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity })
  disposables.push(geo, mat)
  return new Mesh(geo, mat)
}

/**
 * 经纬网：贴球面的经纬线（随球体一起旋转，不是悬浮圆环）。
 * - 教学纬线（赤道 / 30°N / 60°N 三条）：**管状线**，按三档配色加亮，与扇形楔、右侧对比条一一对应；
 * - 南半球 30°S / 60°S：仍是细线、不加粗（教师要求南半球只保留纬度名标注，不参与动画），
 *   但与右侧对比条保持三档配色对应，故不并入背景网格；
 * - 经线只留**观测点所在的 120°E 一条**：三个观测点钉在它上面，随球自转一起东移。
 *   （原先还有一条 170°W——那是"地球不动"时代的做法，用它标扇形终点；地球真自转后它
 *   跟着球转到背面、全程不经过任何观测点，成为孤线，教师 2026-09-20 反馈后删除。
 *   "1 小时前"的位置改由 scene 里空间固定的**起始经线**表示，见 createLatGlobe。）
 *
 * 教学线一律用 TubeGeometry（管状网格）而非 Line：WebGL 下 `LineBasicMaterial.linewidth`
 * 在多数平台被忽略，永远是 1 物理像素，在 500px 舞台上细且发虚；管状线的粗细与分辨率无关，
 * 任何缩放/DPR 下都保持清晰（做法参考 example 东西半球分界线：CatmullRomCurve3 + TubeGeometry）。
 */
function buildGraticule(
  primary: string,
  accent: string,
  disposables: { dispose(): void }[]
): Group {
  const group = new Group()

  /** 背景细线：南半球两条取样纬线用，不占资源的 1px 线足够 */
  const addLine = (points: Vector3[], color: string, opacity: number): void => {
    const geo = new BufferGeometry().setFromPoints(points)
    const mat = new LineBasicMaterial({ color: new Color(color), transparent: true, opacity })
    disposables.push(geo, mat)
    group.add(new Line(geo, mat))
  }

  // 南半球取样纬线：细线，透明度沿用原三档配色（与右侧对比条 data-band 保持一眼可对）
  addLine(circlePoints(-30, THIN_LAT_POS), accent, 0.34)
  addLine(circlePoints(-60, THIN_LAT_POS), accent, 0.26)

  // 观测点所在经线（120°E）：随地球自转，三个观测点永远压在这条线上
  group.add(makeTubeMesh(meridianPoints(DOT_LON, TUBE_POS_LON), TUBE_R_LON, primary, MERIDIAN_OPACITY, disposables))

  // 教学纬线：赤道最亮最粗，30°N / 60°N 依次减弱（北半球是演示侧）
  group.add(makeTubeMesh(circlePoints(0, TUBE_POS_LAT), TUBE_R_EQUATOR, primary, 0.95, disposables))
  group.add(makeTubeMesh(circlePoints(30, TUBE_POS_LAT), TUBE_R_LAT, accent, 0.6, disposables))
  group.add(makeTubeMesh(circlePoints(60, TUBE_POS_LAT), TUBE_R_LAT, accent, 0.5, disposables))
  return group
}

/** 载入地球影像贴图：three r152+ 启用色彩管理，sRGB 贴图必须标记 colorSpace，否则渲染发灰 */
function loadEarthTexture(maxAniso: number): Texture {
  const tex = new TextureLoader().load(earthMapUrl)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = Math.max(1, maxAniso)
  return tex
}

/** 大气光晕：略大于地球的球体，背面渲染 + 加法混合；越靠球缘（法线越垂直于视线）越亮 */
function makeAtmosphere(color: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) } },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec3 vNormal;
      void main() {
        float glow = pow(0.66 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
        gl_FragColor = vec4(uColor, 1.0) * glow;
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    side: BackSide,
    depthWrite: false
  })
}

/**
 * 在 host 内创建 3D 完整地球线速度模型。
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
  const C_SPEC = cssVar('--c-globe-spec', '#24466b')
  const C_TRAIL = cssVar('--c-trail', '#ffb020')
  const colorOf = (band: Band): Color => new Color(band === 'equator' ? C_PRIMARY : C_ACCENT)

  const disposables: { dispose(): void }[] = []
  const labels: {
    el: HTMLElement
    anchor: Vector3
    mode: LabelMode
    sweep?: boolean
    kind?: 'pole-n' | 'pole-s' | 'lat'
    /** 弧长标签：fit() 里按锚点处弧的屏幕走向整体外推，避免标签压住轨迹弧 */
    arc?: boolean
  }[] = []
  /** 轨迹弧几何：索引沿管身顺序排，updateSweep() 只改 drawRange 的整数即可让它"长出来" */
  const trails: BufferGeometry[] = []

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

  // 立体感三要素：环境光垫底（保证教学信息不丢）+ 主方向光（形成明暗过渡）+ 背缘光（勾出球缘）
  scene.add(new AmbientLight(0xa9caff, 0.6))
  // 主光放左上前方：高光落在球面左缘、离开球心，右侧（扇形侧）自然进入暗面，扇形与纬线更突出
  const sun = new DirectionalLight(0xfff6ea, 0.85)
  sun.position.set(-2.0, 2.1, 2.8)
  scene.add(sun)
  // 背缘光与主光分居两侧，从右后方勾出球缘冷蓝轮廓（否则主光移走后右侧会是一片死黑）
  const rim = new DirectionalLight(0x5f7bff, 0.45)
  rim.position.set(2.4, 0.9, -2.6)
  scene.add(rim)

  // ---- 完整地球本体（2026-09-19 教师定稿：不剖切、无圆环 / 地轴等辅助线） ----
  // 立体感来自影像贴图 + 明暗光照 + 球缘大气光晕，而非线条
  const earthGroup = new Group()
  // 贴图默认把 90°W（美洲）转到镜头方向，绕 Y 轴旋转，使 105°E（亚洲）正对镜头。
  // 自转在 updateSweep() 中叠加：rotation.y 增大 = 地表世界方位角增大 = 自西向东（从北极上空看逆时针）
  const BASE_ROT = -(EARTH_FACE_LON + 90) * DEG
  earthGroup.rotation.y = BASE_ROT
  scene.add(earthGroup)

  const texture = loadEarthTexture(renderer.capabilities.getMaxAnisotropy())
  disposables.push(texture)
  const earthGeo = new SphereGeometry(R, 96, 64)
  disposables.push(earthGeo)
  const earthMat = new MeshPhongMaterial({
    map: texture,
    // 高 shininess（窄高光瓣）+ 深蓝镜面色：海面只有一小点冷色反光，读出"球"而不是"圆盘"；
    // 原先 shininess 14 + 近白镜面色会在球心糊出一大片与贴图无关的白斑（教师 2026-09-20 反馈）
    shininess: 38,
    specular: new Color(C_SPEC)
  })
  disposables.push(earthMat)
  earthGroup.add(new Mesh(earthGeo, earthMat))

  // 经纬网（贴球面，随球体旋转）
  earthGroup.add(buildGraticule(C_PRIMARY, C_ACCENT, disposables))

  // 起始经线（空间固定，**不随地球自转**）：就是观测点所在经线"1 小时前"那一刻的位置，与 A 点重合。
  // 它与正在自转的 120°E 经线之间张开的角，恰好等于扇形楔的圆心角——"经线转过多少度，
  // 观测点就划过多少度的弧"因此一眼可见；也让 A 点不再是一个"没有经线的孤点"（教师 2026-09-20 反馈）。
  // 参数与地表经线完全相同，只把初始朝向 BASE_ROT 冻结下来，所以看上去就是同一条经线停在出发位置；
  // 略淡（START_MERIDIAN_OPACITY）以便与在转的那条区分
  const startMeridian = new Group()
  startMeridian.rotation.y = BASE_ROT
  startMeridian.add(
    makeTubeMesh(meridianPoints(DOT_LON, TUBE_POS_LON), TUBE_R_LON, C_PRIMARY, START_MERIDIAN_OPACITY, disposables)
  )
  scene.add(startMeridian)

  // 大气光晕（球缘一圈冷蓝辉光，把地球从深底上"托"起来）
  const atmoGeo = new SphereGeometry(R * 1.02, 64, 48)
  disposables.push(atmoGeo)
  const atmoMat = makeAtmosphere(C_PRIMARY)
  disposables.push(atmoMat)
  earthGroup.add(new Mesh(atmoGeo, atmoMat))

  // ---- 各纬线：赤道与北半球两条带轨迹弧扫掠 + A/B 观测点（教师 2026-09-20：南半球不标纬度名） ----
  points.forEach((point) => {
    const band = bandOf(point.lat)
    const color = colorOf(band)
    const phi = point.lat * DEG
    const y = Math.sin(phi) * R
    const r = Math.cos(phi) * R * WEDGE_RF

    // 教师要求（2026-09-19）：只保留北半球与赤道的线速度动画
    if (point.lat < 0) return

    // 纬度名标签：锚在自己那条纬线的左端，fit() 中右移让开线端、上抬到纬线之上（不压线、不出舞台）
    const nameEl = document.createElement('span')
    nameEl.className = 'lat__glabel'
    nameEl.textContent = point.name
    host.appendChild(nameEl)
    labels.push({ el: nameEl, anchor: new Vector3(-Math.cos(phi) * R, y, 0), mode: 'left', kind: 'lat' })

    // 扇形楔已删除（2026-09-20 教师要求）：不再给每条纬线添加扇面网格，
    // 扫掠过程只由暖金色轨迹弧 + 观测点小球表示

    // A 点（空间中"1 小时前"的位置，随球自转始终停在弧的起点）——固定在世界坐标里，不随球转
    const rDot = Math.cos(phi) * TUBE_POS_LAT
    const dotGeo = new SphereGeometry(0.02, 12, 10)
    disposables.push(dotGeo)
    const aMat = new MeshBasicMaterial({ color, transparent: true, depthTest: true })
    disposables.push(aMat)
    const aBeta = WEDGE_A * DEG
    const aDot = new Mesh(dotGeo, aMat)
    aDot.renderOrder = 1
    aDot.position.set(Math.sin(aBeta) * rDot, y, Math.cos(aBeta) * rDot)
    scene.add(aDot)

    // B 点（观测点，带东向箭头）：**钉在地表**——作为 earthGroup 的子节点放到 120°E 经线上，
    // 于是它随地球自转一起东移，起点/终点方位角（15° / 85°）与扇形楔的两端严丝合缝。
    // 必须开深度测试：否则球转到背面时它会穿透球体显示在正面
    const bDotGeo = new SphereGeometry(0.024, 12, 10)
    disposables.push(bDotGeo)
    const bMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: true })
    disposables.push(bMat)
    const bDot = new Mesh(bDotGeo, bMat)
    // renderOrder 高于扇形（0）：与扇形同属透明队列，需排在扇形之后才不被加色叠加冲淡
    bDot.renderOrder = 1
    const dotBeta = (DOT_LON + 90) * DEG
    bDot.position.set(Math.sin(dotBeta) * rDot, y, Math.cos(dotBeta) * rDot)
    earthGroup.add(bDot)

    const bHeadGeo = new ConeGeometry(0.02, 0.055, 10)
    disposables.push(bHeadGeo)
    const bHead = new Mesh(bHeadGeo, bMat)
    bHead.renderOrder = 1
    bHead.position.copy(bDot.position)
    // 组内东向切线（方位角增大方向），球体自转时箭头朝向自动保持向东
    bHead.quaternion.setFromUnitVectors(UP, new Vector3(Math.cos(dotBeta), 0, -Math.sin(dotBeta)))
    earthGroup.add(bHead)

    // 轨迹弧（空间固定，**不随地球自转**）：观测点在空间里划过的轨迹，正是本模块要讲的对象，
    // 故用暖金色加粗弧单独描出，与青 / 紫的纬线拉开色相（教师 2026-09-20）。从扇形起点 A 起算，
    // 进度 p 走到哪就长到哪；管心与观测点小球同心，弧正好从两点球心穿过，A / B 球成了天然的端帽。
    // 整段 70° 只建一次几何，生长靠 setDrawRange：TubeGeometry 的索引沿管身顺序排，
    // 每段占 TRAIL_RADIAL 个四边形（= TRAIL_RADIAL × 6 个索引），逐帧只改一个整数、零分配。
    // renderOrder 2 排在扇面（加法混合）与观测点之后，暖金不被扇面冲淡
    const trailGeo = new TubeGeometry(
      new CatmullRomCurve3(arcPoints(point.lat, TUBE_POS_LAT, WEDGE_A, WEDGE_A + WEDGE_SPAN, TRAIL_SEG)),
      TRAIL_SEG,
      TRAIL_R,
      TRAIL_RADIAL,
      false
    )
    trailGeo.setDrawRange(0, 0)
    disposables.push(trailGeo)
    const trailMat = new MeshBasicMaterial({
      color: new Color(C_TRAIL),
      transparent: true,
      opacity: TRAIL_OPACITY
    })
    disposables.push(trailMat)
    const trail = new Mesh(trailGeo, trailMat)
    trail.renderOrder = 2
    scene.add(trail)
    trails.push(trailGeo)

    // 弧长标签：锚在轨迹弧上、方位角取 ARC_LABEL_BETA 处，标签与弧的间隙与朝向全部由 fit() 算出。
    // 原先按 r×1.18 乘系数外推：系数带来的绝对偏移随 cosφ 变小，三条弧都从各自的标签框里穿过
    // （教师 2026-09-20 反馈），且锚点在中段时会被挤到相邻弧上
    const arcEl = document.createElement('span')
    arcEl.className = 'lat__glabel lat__glabel--arc'
    arcEl.textContent = `${point.arcKm} km`
    host.appendChild(arcEl)
    const betaArc = ARC_LABEL_BETA * DEG
    const rTrail = Math.cos(phi) * TUBE_POS_LAT
    labels.push({
      el: arcEl,
      anchor: new Vector3(Math.sin(betaArc) * rTrail, y, Math.cos(betaArc) * rTrail),
      mode: 'center',
      sweep: true,
      arc: true
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

  // ---- 扫掠动画：地球真自转 70°（= 演示"1 小时"），三个观测点随球同步转过相同角度（角速度相同） ----
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

  function updateSweep(p: number): void {
    // 地球自转：进度 p 直接驱动地轴转角，贴图 / 经纬网 / 钉在地表的观测点一起转过去。
    // 回卷阶段（p 由 1 回到 0）地球会快速转回起点，纯为循环复位——球面点相对地表不动，
    // 所以点不会出现"在地表上滑动"的穿帮
    earthGroup.rotation.y = BASE_ROT + WEDGE_SPAN * p * DEG
    // 轨迹弧随进度生长：整段几何已就位，只把索引可见范围收到"当前已划过"的位置。
    // 段数取整即可（96 段 / 70° → 每段约 0.73°，肉眼连续）
    const count = Math.floor(TRAIL_SEG * p) * TRAIL_RADIAL * 6
    for (const g of trails) g.setDrawRange(0, count)
    for (const item of labels) {
      if (item.sweep) item.el.style.opacity = p.toFixed(2)
    }
  }

  // ---- 视域与标签投影 ----
  const project = new Vector3()
  /** 球体在画布上的投影：圆心像素坐标与半径（供极点标注贴球盘上下边缘定位） */
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
      } else if (item.kind === 'lat') {
        // 纬度名：从本纬线左端向右让开一段、向上抬到纬线之上。
        // 不沿用"球外左侧一列"——球盘左缘到舞台左缘只有约 51px，而标签宽 60~140px，
        // 统一外推会被卡片滚动盒裁掉，且高纬标签会被拉离自己的纬线近百像素（教师 2026-09-20 反馈）
        x += LAT_LABEL_DX
        y -= LAT_LABEL_DY
      }
      // 弧长标签的旋转角（度）：文字与弧同向排，故"垂直弧"方向只占一行高
      let rotate = 0
      if (item.arc) {
        // 弧长标签：随弧旋转 + 沿弧的屏幕外法线外推一行高 + ARC_LABEL_GAP，确保不压住轨迹弧。
        // 原做法（按 r×1.18 乘系数外推）偏移随 cosφ 变小，三条弧都从标签框里穿过（教师 2026-09-20 反馈）。
        // 求解步骤：
        //  1. 锚点左右各取弧上一点投影，两点连线即弧在屏幕上的走向（透视把直线映成直线），旋转 90° 得法线；
        //  2. 用"投影后的纬线圆心 → 锚点"择向取外侧——不能用"球心 → 锚点"，高纬处两者夹角近 80°，会取到内侧；
        //  3. 标签跟着弧转，沿法线方向的厚度只剩一行高，于是两条弧之间约 40px 的窄缝也放得下
        const aRadius = Math.hypot(item.anchor.x, item.anchor.z)
        const aBeta = Math.atan2(item.anchor.x, item.anchor.z)
        const aY = item.anchor.y
        project
          .set(Math.sin(aBeta - ARC_SAMPLE_D) * aRadius, aY, Math.cos(aBeta - ARC_SAMPLE_D) * aRadius)
          .project(camera)
        const ax = (project.x * 0.5 + 0.5) * w
        const ay = (-project.y * 0.5 + 0.5) * h
        project
          .set(Math.sin(aBeta + ARC_SAMPLE_D) * aRadius, aY, Math.cos(aBeta + ARC_SAMPLE_D) * aRadius)
          .project(camera)
        const bx = (project.x * 0.5 + 0.5) * w
        const by = (-project.y * 0.5 + 0.5) * h
        project.set(0, aY, 0).project(camera)
        const pivotX = (project.x * 0.5 + 0.5) * w
        const pivotY = (-project.y * 0.5 + 0.5) * h
        const tLen = Math.hypot(bx - ax, by - ay) || 1
        let nx = -(by - ay) / tLen
        let ny = (bx - ax) / tLen
        if (nx * (x - pivotX) + ny * (y - pivotY) < 0) {
          nx = -nx
          ny = -ny
        }
        rotate = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI
        if (rotate > 90) rotate -= 180
        if (rotate < -90) rotate += 180
        const halfH = (item.el.offsetHeight || 30) / 2
        x += nx * (halfH + ARC_LABEL_GAP)
        y += ny * (halfH + ARC_LABEL_GAP)
      }
      const ox = item.mode === 'center' ? '-50%' : '0%'
      const rot = rotate ? ` rotate(${rotate.toFixed(1)}deg)` : ''
      item.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${ox}, -50%)${rot}`
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
