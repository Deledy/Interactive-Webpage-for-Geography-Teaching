/* ============================================================
   universe/cosmos.ts
   深空缩放过渡：河外星系 → 星系汇聚为星点 → 宇宙微波背景全景。

   为什么单独成模块：
   1) 现有链路（world.updateVisibility / galaxyAtlas.update）每帧会**重写**各点云的
      opacity 与可见性，任何"额外淡出"都必须在它之后叠加，不能塞进它内部；
   2) 本过渡是可逆的纯距离函数：t = smoothstep(log(开启距离), log(终止距离), log(视距))，
      没有任何计时器，因此"缩小进入 / 放大退出"天然对称，不会出现状态残留或跳变；
   3) 星点层与 CMB 天穹不属于天体系统层级，不应污染 world 的坐标与导航接口。

   关键取舍（v1.2）：
   - 不再用 group.scale 把星系压向中心（那会看起来像"向内坍缩"，而且反向缩回时会弹回）；
     改为把点云的 uPerspective 连续压小、同时让固定像素的星点层淡入 —— 位置不动，
     总角尺寸守恒，视觉上才是"退远成一个点"；
   - 时间轴刻意让背景星、星点、CMB 三层互相重叠（任意 t 至少有一层可见），
     消除旧版 0.5–0.7 之间的"黑场空档"；
   - CMB 天穹每帧跟随相机（半径 3.2e6 < 远裁剪面），避免相机在 4e6 处穿出球壳；
   - 天穹关闭 depthTest + renderOrder 极小，作为纯背景先画，不参与深度写入。
   ============================================================ */
import * as THREE from 'three'
import { pointCloud } from '../core/point-cloud'
import { clamp, makeRandom, smooth } from '../core/math'
import type { CameraRig } from '../core/camera'
import type { GalaxyAtlas } from './galaxies'
import { createCosmicWeb } from './cosmic-web'

/** 深空缩放能到达的最大视距（略大于 CMB，留出圆形外的标注空间） */
export const ZOOM_MAX = 5_500_000
/** CMB 圆球所在的视距（尺度轴终点、直达按钮目标） */
export const CMB_DISTANCE = 5_000_000
/** t 的映射区间（对数空间）：从"开始汇聚"到"CMB 完全铺满"。
    起点高于河外星系图鉴的默认落脚视距（1e6），保证未进入深空时图鉴保持原样。 */
const T_LOG_START = Math.log(1250000)
const T_LOG_END = Math.log(5_000_000)
/** CMB 球半径：世界坐标里的实体球，不再跟随相机，因此从外部看是一个圆 */
export const CMB_RADIUS = 900_000

export type CosmosPhase = 'atlas' | 'condense' | 'cmb'

export interface CosmosState {
  /** 0 = 河外星系，1 = 宇宙微波背景 */
  t: number
  phase: CosmosPhase
}

export interface CosmosDeps {
  scene: THREE.Scene
  rig: CameraRig
  atlas: GalaxyAtlas
  milkyWay: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  milkyWayMarker: THREE.Sprite
  galaxyCenter: THREE.Vector3
  backgroundStars: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  /** 太阳系与近邻恒星根组：进入纯宇宙背景前整体隐藏，避免亚像素闪烁 */
  solarRoot: THREE.Group
  starRoot: THREE.Group
  pixels: number
  /** 光隧道点数 / 点尺寸上限（由画质档位决定） */
  webPoints: number
  webMaxPointSize: number
}

export interface Cosmos {
  /** 每帧调用（必须在 world.updateVisibility 之后），返回过渡进度供 UI 使用 */
  update: (dt: number, distance: number, stage: string) => CosmosState
  /** 分辨率变化时同步星点层的像素尺寸补偿 */
  resize: (pixels: number) => void
  /** 画质降级时调整光隧道预算，不重建几何体 */
  setQuality: (quality: { webPoints: number; maxPointSize: number }) => void
  getState: () => CosmosState
}

/* ============================================================
   程序化 CMB 全景贴图
   用多尺度值噪声模拟温度涨落，再按 Planck 风格色带映射。
   优点：完全离线、无外部版权资源；后续若拿到真实 Planck 等距圆柱图，
   只需替换 createCMBPanorama() 的返回值即可。
   ============================================================ */
interface Octave {
  cols: number
  rows: number
  weight: number
  grid: Float32Array
}

function valueGrid(cols: number, rows: number, seed: string): Float32Array {
  const rand = makeRandom(seed)
  const grid = new Float32Array(cols * rows)
  for (let i = 0; i < grid.length; i++) grid[i] = rand()
  return grid
}

/** 双线性采样；x 方向环绕，保证等距圆柱贴图左右接缝连续 */
function sampleGrid(grid: Float32Array, cols: number, rows: number, u: number, v: number): number {
  const x = u * cols
  const y = v * rows
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const x0 = ((xi % cols) + cols) % cols
  const x1 = (x0 + 1) % cols
  const y0 = clamp(yi, 0, rows - 1)
  const y1 = clamp(yi + 1, 0, rows - 1)
  const fx = x - xi
  const fy = y - yi
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = grid[y0 * cols + x0]
  const b = grid[y0 * cols + x1]
  const c = grid[y1 * cols + x0]
  const d = grid[y1 * cols + x1]
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy
}

/** Planck 风格色带：深蓝（低温）→ 青白（平均）→ 橙红（高温） */
const CMB_STOPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [-1.0, 7, 15, 66],
  [-0.55, 26, 62, 142],
  [-0.22, 88, 150, 208],
  [0.0, 234, 242, 238],
  [0.2, 247, 199, 126],
  [0.52, 209, 113, 66],
  [1.0, 118, 34, 34]
]

function createCMBPanorama(width = 1024): THREE.CanvasTexture {
  const height = width / 2
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建 CMB 贴图画布')

  const octaves: Octave[] = [
    { cols: 14, rows: 7, weight: 0.38, grid: valueGrid(14, 7, 'cmb-a') },
    { cols: 30, rows: 15, weight: 0.28, grid: valueGrid(30, 15, 'cmb-b') },
    { cols: 72, rows: 36, weight: 0.22, grid: valueGrid(72, 36, 'cmb-c') },
    // 最细一层提供 CMB 特有的颗粒感，避免只看到大块模糊色斑
    { cols: 160, rows: 80, weight: 0.12, grid: valueGrid(160, 80, 'cmb-d') }
  ]

  const image = ctx.createImageData(width, height)
  const data = image.data
  for (let y = 0; y < height; y++) {
    const v = y / height
    // 银河系前景带：赤道附近一圈更暖更亮（Planck 图同样有一条强前景带）
    const band = Math.exp(-((((v - 0.5) / 0.045) ** 2))) * 0.5
    for (let x = 0; x < width; x++) {
      const u = x / width
      let sum = 0
      for (const octave of octaves) {
        sum += sampleGrid(octave.grid, octave.cols, octave.rows, u, v) * octave.weight
      }
      // 温差涨落放大 2.6 倍后再着色（真实涨落仅约十万分之一，无法直接肉眼观察）
      const d = clamp((sum - 0.5) * 2.6 + band, -1, 1)

      let index = 0
      while (index < CMB_STOPS.length - 2 && d > CMB_STOPS[index + 1][0]) index++
      const a = CMB_STOPS[index]
      const b = CMB_STOPS[index + 1]
      const k = clamp((d - a[0]) / (b[0] - a[0]), 0, 1)
      const offset = (y * width + x) * 4
      data[offset] = a[1] + (b[1] - a[1]) * k
      data[offset + 1] = a[2] + (b[2] - a[2]) * k
      data[offset + 2] = a[3] + (b[3] - a[3]) * k
      data[offset + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 4
  return texture
}

/* ============================================================
   主函数
   ============================================================ */
export function createCosmos(deps: CosmosDeps): Cosmos {
  const {
    scene,
    rig,
    atlas,
    milkyWay,
    milkyWayMarker,
    galaxyCenter,
    backgroundStars,
    solarRoot,
    starRoot,
    pixels,
    webPoints,
    webMaxPointSize
  } = deps
  const { camera } = rig

  /* ---------------- 星系塌缩的时间错峰 ----------------
     按"离图鉴中心由近到远"排序，形成一道由内向外推进的汇聚波，
     避免十几座星系像同一个开关一样同时缩成点。 */
  const records = Array.from(atlas.galaxies.values()).map((entry) => ({
    group: entry.group,
    points: entry.points,
    accents: entry.accents
  }))
  records.sort(
    (a, b) => a.group.position.distanceToSquared(galaxyCenter) - b.group.position.distanceToSquared(galaxyCenter)
  )
  const collapseWindow = records.map((_, index) => ({
    start: 0.02 + index * 0.012,
    end: 0.5 + index * 0.012
  }))

  /* ---------------- 星点层：每座星系一个固定像素尺寸的星点 ---------------- */
  const dotPositions: number[] = []
  const dotColors: number[] = []
  const dotSizes: number[] = []
  const pushDot = (position: THREE.Vector3, color: THREE.Color, size: number): void => {
    dotPositions.push(position.x, position.y, position.z)
    dotColors.push(color.r, color.g, color.b)
    dotSizes.push(size)
  }
  pushDot(galaxyCenter, new THREE.Color(0xffe9c4), 4.4)
  for (const entry of atlas.galaxies.values()) {
    const color = new THREE.Color(entry.definition.color).multiplyScalar(1.15)
    pushDot(entry.group.position, color, 3.2)
  }
  const dots = pointCloud(dotPositions, dotColors, dotSizes, 0, 0, deps.pixels)
  dots.name = 'cosmos-star-points'
  dots.frustumCulled = false
  dots.visible = false
  scene.add(dots)

  /* ---------------- CMB 球 ----------------
     固定在银河系中心（我们所在的可观测宇宙中心），相机从外部看是一个圆。
     圆外保持黑色，便于标注"人类尚未观测到的区域"。 */
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: createCMBPanorama(),
    side: THREE.FrontSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    toneMapped: false
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(CMB_RADIUS, 48, 24), skyMaterial)
  sky.name = 'cmb-ball'
  sky.position.copy(galaxyCenter)
  // 把等距圆柱贴图的极点转到侧面，避免圆形顶部出现明显的"捏合"放射纹
  sky.rotation.z = Math.PI / 2
  sky.renderOrder = -1000
  sky.frustumCulled = false
  sky.visible = false
  scene.add(sky)

  /* ---------------- 光隧道：宇宙网点云 ----------------
     只在 t=0.02–0.64 之间显示；点数由画质档位用 drawRange 控制。 */
  const web = createCosmicWeb(scene, galaxyCenter, pixels, webPoints, webMaxPointSize)

  /* ---------------- 基准值（世界每帧会重写透明度，需保留原始值） ---------------- */
  const backgroundBase = (backgroundStars.material.uniforms.uOpacity as { value: number }).value
  const milkyBase = milkyWay.material.uniforms.uOpacity as { value: number }
  const backgroundUniform = backgroundStars.material.uniforms.uOpacity as { value: number }

  const state: CosmosState = { t: 0, phase: 'atlas' }

  // 银河点云的尺寸基准（galaxy.ts 固定为 24000），用于恢复
  const milkyPerspective = milkyWay.material.uniforms.uPerspective as { value: number }
  const milkyPerspectiveBase = milkyPerspective.value

  /**
   * 恢复到"纯河外星系"状态。
   * 注意：不再复位任何 group.scale —— 过渡本身已经不靠缩放，反向缩回时也就不会"弹回"。
   */
  function restore(): void {
    dots.visible = false
    sky.visible = false
    skyMaterial.opacity = 0
    backgroundUniform.value = backgroundBase
    backgroundStars.visible = true
    solarRoot.visible = true
    starRoot.visible = true
    milkyPerspective.value = milkyPerspectiveBase
    state.t = 0
    state.phase = 'atlas'
  }

  function update(dt: number, distance: number, _stage: string): CosmosState {
    // 纯距离函数：进入 / 退出完全对称，不依赖 stage，也不依赖计时器。
    const logDistance = Math.log(Math.max(1, distance))
    const t = clamp(smooth(T_LOG_START, T_LOG_END, logDistance), 0, 1)
    state.t = t
    state.phase = t < 0.04 ? 'atlas' : t < 0.8 ? 'condense' : 'cmb'

    // 星系点阵独立于 t：离开银河系（约 15 万）就出现，到 CMB 前消失。
    // 不能放在 t<=0 的早返回之后，否则在 1e6 的河外星系总览里看不到它。
    const fieldOpacity =
      smooth(150000, 400000, distance) * (1 - smooth(4_200_000, 5_000_000, distance))
    web.update(fieldOpacity)

    if (t <= 0.0001) {
      restore()
      return state
    }

    /* 1) 河外星系：不再缩放 group（那看起来像"向内坍缩"），
          而是把点云点尺寸连续压小 + 透明度淡出，位置保持不动。
          星点层在同样的位置淡入，视觉上才是"退远成一个点"。 */
    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      const window = collapseWindow[i]
      const collapse = smooth(window.start, window.end, t)
      const perspective = record.points.material.uniforms.uPerspective as { value: number }
      perspective.value *= 1 - collapse * 0.92
      const uniform = record.points.material.uniforms.uOpacity as { value: number }
      uniform.value *= 1 - collapse * 0.92
      for (const accent of record.accents) {
        accent.material.opacity *= 1 - collapse
      }
    }

    /* 2) 银河系：同样用点尺寸而非 scale；太阳位置标记先行淡出 */
    const milkyCollapse = smooth(0.01, 0.43, t)
    milkyPerspective.value = milkyPerspectiveBase * (1 - milkyCollapse * 0.92)
    milkyBase.value *= 1 - milkyCollapse
    milkyWayMarker.material.opacity *= 1 - smooth(0, 0.08, t)

    /* 3) 背景星空：从 t=0 就开始缓慢退场，一直保留到 0.6，填住中间的空场 */
    const starFade = 1 - smooth(0, 0.6, t)
    backgroundUniform.value = backgroundBase * starFade
    backgroundStars.visible = starFade > 0.01

    /* 4) 星点接管：与星系收缩重叠；在光隧道接管前退场 */
    const dotOpacity = smooth(0.34, 0.62, t) * (1 - smooth(0.74, 0.9, t))
    ;(dots.material.uniforms.uOpacity as { value: number }).value = dotOpacity
    dots.visible = dotOpacity > 0.002

    /* 5) CMB 天穹：提前以低透明度垫底（0.42 起），
          银河带画在全景图里，作为贯穿"星系层 → 宇宙层"的连续锚点 */
    // CMB 放在光隧道之后：0.62 才开始淡入，0.92 铺满，避免抢掉隧道段
    const skyOpacity = smooth(0.62, 0.92, t)
    skyMaterial.opacity = skyOpacity
    sky.visible = skyOpacity > 0.002
    // 球体固定在世界坐标里，不跟随相机，也不自转：最后"定格"在 CMB

    /* 5.5) 星系点阵已在函数开头按距离更新；这里只处理近景 */

    /* 6) 近景层级：等它们已经缩到亚像素后再收起，避免中途硬切 */
    const hideLocal = t > 0.6
    solarRoot.visible = !hideLocal
    starRoot.visible = !hideLocal

    return state
  }

  function resize(pixels: number): void {
    ;(dots.material.uniforms.uRatio as { value: number }).value = pixels
    web.setPixels(pixels)
  }

  function setQuality(quality: { webPoints: number; maxPointSize: number }): void {
    web.setBudget(quality.webPoints, quality.maxPointSize)
  }

  return {
    update,
    resize,
    setQuality,
    getState: () => state
  }
}
