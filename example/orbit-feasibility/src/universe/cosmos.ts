/* ============================================================
   universe/cosmos.ts
   深空缩放过渡：河外星系 → 星系汇聚为星点 → 宇宙微波背景全景。

   为什么单独成模块：
   1) 现有链路（world.updateVisibility / galaxyAtlas.update）每帧会**重写**各点云的
      opacity 与可见性，任何"额外淡出"都必须在它之后叠加，不能塞进它内部；
   2) 本过渡是可逆的纯距离函数：t = smoothstep(log(开启距离), log(终止距离), log(视距))，
      没有任何计时器，因此"缩小进入 / 放大退出"天然对称，不会出现状态残留或跳变；
   3) 星点层与 CMB 天穹不属于天体系统层级，不应污染 world 的坐标与导航接口。

   关键取舍：
   - 星系"塌缩"用 group.scale 而非改写点云着色器：点大小由 uPerspective 钳制，
     仅靠拉远不会缩成点；把整团点云压到自身中心，再叠一层固定像素尺寸的星点接管，
     视觉上就是"星系 → 一个星点"，且不改动已移植的着色器；
   - CMB 天穹每帧跟随相机（半径 3.2e6 < 远裁剪面），避免相机在 4e6 处穿出球壳；
   - 天穹关闭 depthTest + renderOrder 极小，作为纯背景先画，不参与深度写入。
   ============================================================ */
import * as THREE from 'three'
import { pointCloud } from '../core/point-cloud'
import { clamp, makeRandom, smooth } from '../core/math'
import type { CameraRig } from '../core/camera'
import type { GalaxyAtlas } from './galaxies'

/** 深空缩放由本模块接管滚轮的起始视距（此距离内仍由 OrbitControls 负责） */
export const ZOOM_ENTER = 620000
/** 深空缩放能到达的最大视距 */
export const ZOOM_MAX = 3900000
/** t 的映射区间（对数空间）：从"开始汇聚"到"CMB 完全铺满"。
    起点高于河外星系图鉴的默认落脚视距（1e6），保证未进入深空时图鉴保持原样。 */
const T_LOG_START = Math.log(1250000)
const T_LOG_END = Math.log(3100000)
/** CMB 天穹半径：需小于相机远裁剪面，且每帧跟随相机 */
const SKY_RADIUS = 3200000

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
  /** 银盘组：整体缩放即"银河系塌缩" */
  galaxyDisk: THREE.Group
  milkyWay: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  milkyWayMarker: THREE.Sprite
  galaxyCenter: THREE.Vector3
  backgroundStars: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  /** 太阳系与近邻恒星根组：进入纯宇宙背景前整体隐藏，避免亚像素闪烁 */
  solarRoot: THREE.Group
  starRoot: THREE.Group
  pixels: number
}

export interface Cosmos {
  /** 每帧调用（必须在 world.updateVisibility 之后），返回过渡进度供 UI 使用 */
  update: (dt: number, distance: number, stage: string) => CosmosState
  /** 深空区间内接管滚轮；返回 true 表示事件已被消费 */
  handleWheel: (event: WheelEvent) => boolean
  /** 分辨率变化时同步星点层的像素尺寸补偿 */
  resize: (pixels: number) => void
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
    galaxyDisk,
    milkyWay,
    milkyWayMarker,
    galaxyCenter,
    backgroundStars,
    solarRoot,
    starRoot
  } = deps
  const { camera, controls } = rig

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

  /* ---------------- CMB 天穹 ---------------- */
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: createCMBPanorama(),
    side: THREE.BackSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    toneMapped: false
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 48, 24), skyMaterial)
  sky.name = 'cmb-sky'
  sky.renderOrder = -1000
  sky.frustumCulled = false
  sky.visible = false
  scene.add(sky)

  /* ---------------- 基准值（世界每帧会重写透明度，需保留原始值） ---------------- */
  const backgroundBase = (backgroundStars.material.uniforms.uOpacity as { value: number }).value
  const milkyBase = milkyWay.material.uniforms.uOpacity as { value: number }
  const backgroundUniform = backgroundStars.material.uniforms.uOpacity as { value: number }

  const state: CosmosState = { t: 0, phase: 'atlas' }
  const offset = new THREE.Vector3()

  /** 恢复到"纯河外星系"状态（放大回到该区间时调用，保证可逆且无残留） */
  function restore(): void {
    for (const record of records) {
      record.group.scale.setScalar(1)
    }
    galaxyDisk.scale.setScalar(1)
    dots.visible = false
    sky.visible = false
    skyMaterial.opacity = 0
    backgroundUniform.value = backgroundBase
    backgroundStars.visible = true
    solarRoot.visible = true
    starRoot.visible = true
    state.t = 0
    state.phase = 'atlas'
  }

  function update(dt: number, distance: number, stage: string): CosmosState {
    // 只在「河外星系」层级生效：其余层级一律复位，避免跨层时残留缩放或隐藏
    if (stage !== 'galaxies') {
      restore()
      return state
    }

    const logDistance = Math.log(Math.max(1, distance))
    const t = clamp(smooth(T_LOG_START, T_LOG_END, logDistance), 0, 1)
    state.t = t
    state.phase = t < 0.04 ? 'atlas' : t < 0.72 ? 'condense' : 'cmb'

    /* 1) 河外星系：压向自身中心 + 淡出，形成"汇聚" */
    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      const window = collapseWindow[i]
      const collapse = smooth(window.start, window.end, t)
      record.group.scale.setScalar(1 - collapse * 0.985)
      const uniform = record.points.material.uniforms.uOpacity as { value: number }
      uniform.value *= 1 - collapse * 0.96
      if (collapse > 0.995) record.group.visible = false
      for (const accent of record.accents) {
        accent.material.opacity *= 1 - collapse
      }
    }

    /* 2) 银河系：银盘整体塌缩、太阳位置标记先行淡出 */
    const milkyCollapse = smooth(0.01, 0.43, t)
    galaxyDisk.scale.setScalar(1 - milkyCollapse * 0.985)
    milkyBase.value *= 1 - milkyCollapse
    if (milkyCollapse > 0.995) milkyWay.visible = false
    milkyWayMarker.material.opacity *= 1 - smooth(0, 0.05, t)
    if (milkyWayMarker.material.opacity < 0.01) milkyWayMarker.visible = false

    /* 3) 背景星空：先于 CMB 退场，避免与全景互相叠加 */
    const starFade = 1 - smooth(0.05, 0.5, t)
    backgroundUniform.value = backgroundBase * starFade
    backgroundStars.visible = starFade > 0.01

    /* 4) 星点接管：星系塌缩到中段后浮现，CMB 铺满前退出 */
    const dotOpacity = smooth(0.34, 0.62, t) * (1 - smooth(0.9, 1, t))
    ;(dots.material.uniforms.uOpacity as { value: number }).value = dotOpacity
    dots.visible = dotOpacity > 0.002

    /* 5) CMB 天穹：跟随相机、缓慢自转，纯背景不写深度 */
    const skyOpacity = smooth(0.7, 0.97, t)
    skyMaterial.opacity = skyOpacity
    sky.visible = skyOpacity > 0.002
    if (sky.visible) {
      sky.position.copy(camera.position)
      sky.rotation.y += dt * 0.004
    }

    /* 6) 进入纯宇宙背景前收起近景层级，避免亚像素几何闪烁 */
    const hideLocal = t > 0.45
    solarRoot.visible = !hideLocal
    starRoot.visible = !hideLocal

    return state
  }

  function handleWheel(event: WheelEvent): boolean {
    // 只接管落在渲染画布上的滚轮；页面内的浮层（如可观测宇宙独立视图）自行滚动
    if (event.target !== controls.domElement) return false
    // 自动飞行途中（controls 被禁用）不接管，避免与飞行插值互相覆盖
    if (!controls.enabled) return false
    const distance = camera.position.distanceTo(controls.target)
    if (!Number.isFinite(distance) || distance <= 0) return false

    const deltaUnit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1
    const delta = clamp(event.deltaY * deltaUnit, -420, 420)
    if (delta === 0) return false
    // 缩小到深空入口之前、或放大回到常规视距后，把事件交还 OrbitControls
    if (distance < ZOOM_ENTER * 0.985 && delta > 0) return false
    if (distance < ZOOM_ENTER * 0.9 && delta < 0) return false

    const next = clamp(distance * Math.exp(delta * 0.0016), ZOOM_ENTER * 0.9, ZOOM_MAX)
    offset.copy(camera.position).sub(controls.target)
    if (offset.lengthSq() < 1e-12) return false
    camera.position.copy(controls.target).addScaledVector(offset.normalize(), next)

    // 拦截事件：既阻止页面滚动，也避免 OrbitControls 再叠加一次缩放（捕获阶段注册，见 main.ts）
    event.preventDefault()
    event.stopPropagation()
    return true
  }

  function resize(pixels: number): void {
    ;(dots.material.uniforms.uRatio as { value: number }).value = pixels
  }

  return {
    update,
    handleWheel,
    resize,
    getState: () => state
  }
}
