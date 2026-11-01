/* ============================================================
   main.ts
   装配入口：把 core 渲染链路 + universe 各层级模块 + 教学界面串起来。
   编排方式参考 ORBIT 项目 src/app.js（Apache-2.0），已按本项目需要重写。
   原始项目：https://github.com/ryh842487118-bot/orbit

   v1.1（对应开发文档 K1–K4）关键变化：
   - 层级由**相机距离**反推（core/camera.ts），滚轮缩放本身即可跨层，不再靠按钮"跳站"；
   - 左侧「天体系统架构图」：教材式树状图（根在上、直角折线向下分叉），随滚轮自动高亮当前层级 + 其上级链路，点击可平滑飞达；
   - 底部「对数尺度轴」：取代原五站按钮，游标随视距移动，刻度可点击跳转；
   - 其余（讲解卡 / 站点目标条 / 可观测宇宙独立视图）沿用 v1.0。

   v1.2（层次演变实验副本）关键变化：
   - 渲染层不再用 stage 控制可见性：所有淡入淡出改为 log10(视距) 的连续函数（core/scale.ts）；
   - 点击飞行时焦点延迟到中途交接，前半段仍保持起点层级（core/camera.ts）；
   - 单一滚轮推拉（core/dolly.ts），去掉 62 万单位处的"换挡"；
   - 深空过渡不再缩放 group，改用点尺寸与透明度交叉淡化，并重排时间轴消除空场；
   - 飞行期间统一降低细节（轨道 / 卫星系统 / 标签），到达后自动恢复。
   ============================================================ */
import * as THREE from 'three'
import { createCamera, createNavigation, type Stage } from './core/camera'
import { createDolly } from './core/dolly'
import { windowFade } from './core/scale'
import {
  detectQualityTier,
  nextLowerTier,
  profileOf,
  qualityFromUrl,
  type QualityTier
} from './core/quality'
import { createPipeline, createRenderer, describeSupport, detectWebGLSupport } from './core/renderer'
import { createWorld, type World, type WorldState } from './universe/world'
import { STATIONS, UNIVERSE_VIEW, infoOf, OBSERVABLE_UNIVERSE } from './universe/catalog'
import {
  createCosmos,
  CMB_DISTANCE,
  CMB_RADIUS,
  type CosmosPhase
} from './universe/cosmos'
import { HOST_STARS, EXOPLANETS } from './universe/star-systems'
import { GALAXIES } from './universe/galaxies'
import { MOON_DATUM, SATELLITE_SYSTEMS } from './universe/moon-systems'
import { hasObservedTexture } from './universe/moon-textures'
import deepField from '../assets/universe-deep-field.jpg'

/** 层级 → 读数标题（教材四级口径） */
const STAGE_LABEL: Record<Stage, string> = {
  earth: '地月系',
  solar: '太阳系',
  stars: '其他恒星行星系',
  galaxy: '银河系',
  galaxies: '河外星系'
}

const KIND_LABEL: Record<string, string> = {
  station: '天体系统层级',
  star: '恒星',
  planet: '行星',
  satellite: '卫星',
  galaxy: '星系',
  group: '行星系统'
}

interface CardInfo {
  kind: string
  cn: string
  sub: string
  desc: string
  meta: string[]
  extended?: boolean
}

/** 焦点 → 讲解卡内容（站点优先：点「地月系」时展示层级说明而不是地球本体） */
function resolveInfo(id: string): CardInfo | null {
  const station = STATIONS.find((s) => s.id === id)
  if (station) {
    return { kind: '天体系统', cn: station.cn, sub: station.level, desc: station.desc, meta: [station.hint] }
  }
  const info = infoOf(id)
  if (!info) return null
  return {
    kind: KIND_LABEL[info.kind] ?? info.kind,
    cn: info.cn,
    sub: info.sub,
    desc: info.desc,
    meta: info.meta ?? [],
    extended: info.extended
  }
}

function formatDistance(value: number): string {
  if (value >= 10000) return `${Math.round(value).toLocaleString('zh-CN')} 单位`
  if (value >= 100) return `${value.toFixed(0)} 单位`
  return `${value.toFixed(1)} 单位`
}

/**
 * 场景视距 → 真实光年。深空不是等比模型，这里用分段对数映射：
 * 既让里程碑落在合适的画面上，也让读数保持"每个数量级都在变"。
 */
const REAL_SCALE_ANCHORS = [
  { scene: 68_000, ly: 50_000 },            // 银河系
  { scene: 300_000, ly: 3_000_000 },        // 本星系群
  { scene: 770_000, ly: 54_000_000 },       // 室女座星系团
  { scene: 2_000_000, ly: 500_000_000 },    // 拉尼亚凯亚
  { scene: 5_000_000, ly: 46_500_000_000 }  // 可观测宇宙
]

function realLightYears(sceneDistance: number): number {
  const first = REAL_SCALE_ANCHORS[0]
  const last = REAL_SCALE_ANCHORS[REAL_SCALE_ANCHORS.length - 1]
  if (sceneDistance <= first.scene) return first.ly
  if (sceneDistance >= last.scene) return last.ly
  for (let i = 1; i < REAL_SCALE_ANCHORS.length; i++) {
    const a = REAL_SCALE_ANCHORS[i - 1]
    const b = REAL_SCALE_ANCHORS[i]
    if (sceneDistance <= b.scene) {
      const t =
        (Math.log(sceneDistance) - Math.log(a.scene)) /
        (Math.log(b.scene) - Math.log(a.scene))
      return Math.exp(Math.log(a.ly) + t * (Math.log(b.ly) - Math.log(a.ly)))
    }
  }
  return last.ly
}

function formatLightYears(ly: number): string {
  if (ly >= 1e8) return `${(ly / 1e8).toFixed(ly >= 1e9 ? 0 : 1)} 亿光年`
  if (ly >= 1e4) return `${Math.round(ly / 1e4).toLocaleString('zh-CN')} 万光年`
  return `${Math.round(ly).toLocaleString('zh-CN')} 光年`
}

/** 手动缩放沿途的三个里程碑（只做提示，不自动停顿） */
const DEEP_MILESTONES = [
  { at: 300_000, name: '本星系群' },
  { at: 770_000, name: '室女座星系团' },
  { at: 2_000_000, name: '拉尼亚凯亚超星系团' }
]

/* ============================================================
   左侧「天体系统架构图」——教材式树状图（根在上，向下分叉）
   层级口径：教材四级 + 拓展节点。
   木星系 / 土星系与地月系**同级**（都是「行星系统」），故并列为太阳系的孩子。
   ============================================================ */
interface TreeNode {
  id: string
  cn: string
  /** 飞达目标（缺省时表示"打开独立视图"或纯分组） */
  target?: string
  /** 打开可观测宇宙独立视图 */
  universe?: boolean
  /** 拓展观察节点 */
  extended?: boolean
  children?: TreeNode[]
}

const TREE: TreeNode[] = [
  {
    id: 'universe',
    cn: '可观测宇宙',
    universe: true,
    children: [
      {
        id: 'galaxy',
        cn: '银河系',
        target: 'galaxy',
        children: [
          // 其他恒星行星系归属银河系之下（银河系内的恒星星系），与太阳系同级
          { id: 'stars', cn: '其他恒星行星系', target: 'trappist-1', extended: true },
          {
            id: 'solar',
            cn: '太阳系',
            target: 'solar',
            children: [
              { id: 'earth', cn: '地月系', target: 'earth' },
              { id: 'mars-moons', cn: '火星卫星', target: 'mars-moons', extended: true },
              { id: 'jupiter-moons', cn: '木星系', target: 'jupiter-moons', extended: true },
              { id: 'saturn-moons', cn: '土星系', target: 'saturn-moons', extended: true },
              { id: 'uranus-moons', cn: '天王星卫星', target: 'uranus-moons', extended: true },
              { id: 'neptune-moons', cn: '海王星卫星', target: 'neptune-moons', extended: true }
            ]
          }
        ]
      },
      // 河外星系与银河系同级（同属「星系」级）
      { id: 'galaxies', cn: '河外星系', target: 'galaxies' }
    ]
  }
]

/* ============================================================
   底部「对数尺度轴」——按 log10(视距) 排布，游标随当前视距移动
   ============================================================ */
interface ScaleTick {
  id: string
  cn: string
  /** 飞达目标；'universe' 表示打开独立视图 */
  target: string
  /** 该刻度对应的代表性视距（场景单位） */
  distance?: number
  log: number
}

const TICKS: ScaleTick[] = [
  { id: 'earth-close', cn: '地球', target: 'earth', distance: 2.4 },
  { id: 'earth', cn: '地月系', target: 'earth', distance: 7.8 },
  { id: 'solar', cn: '太阳系', target: 'solar' },
  { id: 'galaxy', cn: '银河系', target: 'galaxy' },
  { id: 'galaxies', cn: '河外星系', target: 'galaxies' },
  // 显式给出深空末端的视距：否则会落到 infoDistance 的默认值，刻度会被摆到轴的最左端
  { id: 'universe', cn: '可观测宇宙', target: 'universe', distance: CMB_DISTANCE }
].map((t) => ({ ...t, log: Math.log10(t.distance ?? infoDistance(t.id)) }))

/** 未显式给出时，用 catalog/落地距离的常见量级（仅用于刻度摆放与游标映射） */
function infoDistance(id: string): number {
  switch (id) {
    case 'solar': return 650
    case 'galaxy': return 68000
    case 'galaxies': return 1000000
    default: return 8
  }
}

const LOG_MIN = TICKS[0].log
const LOG_MAX = TICKS[TICKS.length - 1].log

function logPercent(log: number): number {
  return ((log - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100
}

/* ============================================================
   「可观测宇宙」独立视图（纯 DOM，无 WebGL 也可用）
   ============================================================ */
function bindUniverseView(): { open: () => void; close: () => void; isOpen: () => boolean } {
  const overlay = document.getElementById('universe') as HTMLElement
  const bg = document.getElementById('universe-bg') as HTMLElement
  const sub = document.getElementById('universe-sub') as HTMLElement
  const title = document.getElementById('universe-title') as HTMLElement
  const ladder = document.getElementById('universe-ladder') as HTMLElement
  const points = document.getElementById('universe-points') as HTMLElement
  const caption = document.getElementById('universe-caption') as HTMLElement
  const back = document.getElementById('universe-back') as HTMLButtonElement

  bg.style.backgroundImage = `url(${deepField})`
  sub.textContent = UNIVERSE_VIEW.subtitle
  title.textContent = UNIVERSE_VIEW.title
  caption.textContent = UNIVERSE_VIEW.caption
  ladder.innerHTML = ''
  for (const step of UNIVERSE_VIEW.ladder) {
    const li = document.createElement('li')
    const b = document.createElement('b')
    b.textContent = step.cn
    const span = document.createElement('span')
    span.textContent = step.scale
    li.append(b, span)
    ladder.append(li)
  }
  points.innerHTML = ''
  for (const text of UNIVERSE_VIEW.points) {
    const li = document.createElement('li')
    li.textContent = text
    points.append(li)
  }

  let open = false
  function setOpen(next: boolean): void {
    open = next
    overlay.hidden = !next
    overlay.setAttribute('aria-hidden', String(!next))
  }
  back.addEventListener('click', () => setOpen(false))
  return { open: () => setOpen(true), close: () => setOpen(false), isOpen: () => open }
}

/* ============================================================
   主流程
   ============================================================ */
async function start(): Promise<void> {
  const stageEl = document.getElementById('stage')!
  const fallbackEl = document.getElementById('fallback')!
  const fallbackTitleEl = document.getElementById('fallback-title')!
  const fallbackDetailEl = document.getElementById('fallback-detail')!
  const readoutValueEl = document.getElementById('readout-value')!
  const readoutMetaEl = document.getElementById('readout-meta')!
  const cardKindEl = document.getElementById('card-kind')!
  const cardTitleEl = document.getElementById('card-title')!
  const cardDescEl = document.getElementById('card-desc')!
  const cardMetaEl = document.getElementById('card-meta')!
  const treeEl = document.getElementById('tree') as HTMLElement
  const scalebarEl = document.getElementById('scalebar') as HTMLElement
  const subdockEl = document.getElementById('subdock') as HTMLElement
  const toastEl = document.getElementById('toast') as HTMLElement
  const cmbRingEl = document.getElementById('cmb-ring') as HTMLElement
  const unobservedEl = document.getElementById('unobserved') as HTMLElement
  const milestoneEl = document.getElementById('milestone') as HTMLElement
  const milestoneNameEl = milestoneEl.querySelector('.milestone__name') as HTMLElement
  const milestoneDistEl = milestoneEl.querySelector('.milestone__dist') as HTMLElement
  const jumpCmbEl = document.getElementById('jump-cmb') as HTMLButtonElement

  const universeView = bindUniverseView()
  document.getElementById('fallback-universe')?.addEventListener('click', () => universeView.open())

  function showFallback(title: string, detail: string): void {
    fallbackTitleEl.textContent = title
    fallbackDetailEl.textContent = detail
    fallbackEl.hidden = false
    console.error(`[orbit-feasibility] ${title}\n${detail}`)
  }

  const support = detectWebGLSupport()
  console.info('[orbit-feasibility] 环境 WebGL 能力：', support)

  if (!support.webgl2 && !support.webgl1) {
    showFallback(
      '当前环境未提供可用的 WebGL 上下文',
      `${describeSupport(support)}。常见原因：浏览器关闭了硬件加速、使用了软件渲染被禁用的远程桌面 / 虚拟机，或在 IDE 内置预览沙箱中打开。`
    )
    return
  }

  let renderer: THREE.WebGLRenderer
  try {
    renderer = createRenderer(stageEl, () =>
      showFallback('图形上下文已丢失', '请关闭占用显卡的页面后重新加载。')
    )
  } catch (e) {
    showFallback('WebGL 上下文创建失败', `${describeSupport(support)}。错误详情：${(e as Error).message}`)
    return
  }

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x03070d)

  // 画质初判：默认 medium；集显/4K 大屏/4 核以内直接 low；?quality=high 可手动覆盖。
  const forcedTier = qualityFromUrl()
  let qualityTier: QualityTier = forcedTier ?? detectQualityTier(renderer.getContext())
  let quality = profileOf(qualityTier)
  document.body.dataset.quality = quality.tier
  console.info(
    `[quality] 初始档位：${quality.tier}（${quality.label}）` +
      `${forcedTier ? '，来自 URL 覆盖' : '，自动检测'}`
  )

  const rig = createCamera(renderer)
  const { camera } = rig
  const { composer, bloom, resize } = createPipeline(renderer, scene, camera, {
    maxPixels: quality.maxPixels,
    bloom: quality.bloom
  })

  const pixels = resize([], quality.maxPixels)
  let world: World
  try {
    world = await createWorld(scene, pixels)
  } catch (e) {
    showFallback('资源加载失败', `场景资源（贴图等）未能完成加载：${(e as Error).message}`)
    return
  }
  resize(world.starFields, quality.maxPixels)

  /* 卫星贴图自检：A/B 级天体必须落到 assets/textures/moons/<key>.* 才会用观测底图，
     缺图时按既定策略退化为实测反照率纯色（不生成任何程序化纹理）。 */
  const missingMoonTextures = MOON_DATUM.filter((moon) => moon.texture && !hasObservedTexture(moon.texture))
  if (missingMoonTextures.length > 0) {
    console.info(
      `[卫星贴图] 以下 ${missingMoonTextures.length} 张观测底图尚未就位，暂按实测反照率纯色显示：`,
      missingMoonTextures.map((moon) => `${moon.id}(${moon.tier}级)`)
    )
  }

  /* ---------------- 深空缩放过渡：河外星系 → 星点 → 宇宙微波背景 ----------------
     必须在 world 之后创建：它要读取各点云已经写入的基准透明度，
     并在 world.updateVisibility 之后叠加自己的淡出（见 universe/cosmos.ts）。
     滚轮在深空区间由它接管，其余区间仍交给 OrbitControls。 */
  const cosmos = createCosmos({
    scene,
    rig,
    atlas: world.galaxyAtlas,
    milkyWay: world.galaxy.points,
    milkyWayMarker: world.galaxy.solarMarker,
    galaxyCenter: world.galaxyCenter,
    backgroundStars: world.backgroundStars,
    solarRoot: world.solarRoot,
    starRoot: world.starSystems.root,
    pixels,
    webPoints: quality.webPoints,
    webMaxPointSize: quality.maxPointSize
  })

  /**
   * 单向降级：只降不升，避免在阈值附近来回切换。
   * 连续约 1.5s 平均帧时 > 28ms（约 36fps）就降一档；
   * 同时压低渲染像素、减少隧道点数、低档关闭 bloom。
   */
  let warmup = 2.5
  let sampleTime = 0
  let sampleFrames = 0

  function applyQuality(next: QualityTier): void {
    qualityTier = next
    quality = profileOf(next)
    document.body.dataset.quality = quality.tier
    bloom.enabled = quality.bloom
    const nextPixels = resize(world.starFields, quality.maxPixels)
    cosmos.resize(nextPixels)
    cosmos.setQuality({ webPoints: quality.webPoints, maxPointSize: quality.maxPointSize })
    sampleTime = 0
    sampleFrames = 0
    warmup = 1.5
    updateQualityChip()
    console.info(`[quality] 降级为 ${quality.tier}（${quality.label}）`)
  }

  // 教室安全阀：手动切到 low（关闭 bloom、减点、降分辨率），再点一次回到自动档
  const qualityChip = document.getElementById('quality-chip') as HTMLButtonElement | null
  const autoTier: QualityTier = qualityTier
  let manualLow = false

  function updateQualityChip(): void {
    if (!qualityChip) return
    qualityChip.textContent = manualLow ? '画质：流畅' : `画质：${quality.label}`
    qualityChip.setAttribute('aria-pressed', String(manualLow))
  }

  qualityChip?.addEventListener('click', () => {
    manualLow = !manualLow
    applyQuality(manualLow ? 'low' : autoTier)
    updateQualityChip()
  })
  updateQualityChip()

  function monitorQuality(dt: number): void {
    if (document.hidden) return
    if (warmup > 0) {
      warmup -= dt
      return
    }
    sampleTime += dt
    sampleFrames++
    if (sampleFrames < 75) return
    const average = sampleTime / sampleFrames
    sampleTime = 0
    sampleFrames = 0
    if (average > 0.028) {
      const lower = nextLowerTier(qualityTier)
      if (lower) applyQuality(lower)
    }
  }

  const state: WorldState = {
    paused: false,
    speed: 1,
    orbitsVisible: true,
    stage: 'earth',
    distance: 7.8,
    detail: 1,
    atlasScale: quality.atlasScale
  }
  // 先把各天体摆到 t=0 的位置，再初始化镜头 —— 避免开场时镜头与地球"错位"再被拉回
  world.update(0, { ...state, paused: true })
  const nav = createNavigation(rig, {
    getPosition: world.getPosition,
    getRadius: world.getRadius,
    getTarget: world.getTarget,
    isSolarBody: world.isSolarBody
  })
  nav.initialize()

  // 单一滚轮推拉：从地表到可观测宇宙同一条曲线，不再在 62 万处"换挡"
  const dolly = createDolly(rig, nav)
  dolly.sync()

  // 手动跳转（不是自动播放）：课堂赶时间时直接到 CMB
  jumpCmbEl.addEventListener('click', () => {
    nav.flyTo('galaxies', { distance: CMB_DISTANCE })
  })

  // 验证用调试句柄（不影响正常交互；便于自动化和课堂排查）
  ;(window as unknown as { __orbit?: unknown }).__orbit = { nav, world, state, rig, dolly, cosmos }

  /* ---------------- 点击跳转的统一入口 ---------------- */
  function jumpTo(target: string, distance?: number): void {
    if (target === 'universe') {
      universeView.open()
      return
    }
    universeView.close()
    nav.flyTo(target, distance !== undefined ? { distance } : undefined)
  }

  /* ---------------- 点击 3D 天体直接飞达（区分"点击"与"拖动"） ----------------
     移植 ORBIT 的 picking：对当前**可见**的恒星 / 行星 / 卫星做 raycast，
     命中后读出 mesh.userData.bodyId 并平滑飞达。这样"从太阳系拉远看到比邻星 →
     点它就飞过去"能自然生效，与左侧架构图、底部尺度轴共用同一个 jumpTo 入口。 */
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const pickTargets: THREE.Object3D[] = []
  for (const body of world.starSystems.bodies.values()) pickTargets.push(body.mesh)
  for (const body of world.solar.bodies.values()) pickTargets.push(body.mesh)
  for (const moon of world.moonSystems.moons.values()) pickTargets.push(moon.mesh)

  function chainVisible(object: THREE.Object3D): boolean {
    let node: THREE.Object3D | null = object
    while (node) {
      if (!node.visible) return false
      node = node.parent
    }
    return true
  }

  function pickBody(clientX: number, clientY: number): string | null {
    pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(pickTargets.filter(chainVisible), false)
    const id = hits[0]?.object.userData.bodyId
    return typeof id === 'string' ? id : null
  }

  let pressAt: { x: number; y: number; time: number } | null = null
  renderer.domElement.addEventListener('pointerdown', (event) => {
    pressAt = { x: event.clientX, y: event.clientY, time: performance.now() }
  })
  renderer.domElement.addEventListener('pointerup', (event) => {
    const press = pressAt
    pressAt = null
    if (!press) return
    // 位移过大或按压过久，视为"旋转视角 / 长按"，不触发拾取
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) return
    if (performance.now() - press.time > 500) return
    const id = pickBody(event.clientX, event.clientY)
    if (id) jumpTo(id)
  })

  /* ---------------- 深空恒星名称标签 ----------------
     对齐 ORBIT labels.js 的行为：**进入银河系层级（stage === 'galaxy'）后，不再要求
     恒星本体已按距离显形** —— 直接显示"圆点 + 名称"，所以缩到银河系就能看到太阳附近
     一圈恒星的名字（这正是"进入银河系可以看到其他恒星及其名称"的来源）。
     聚焦某颗恒星（stage === 'stars'）时只显示较近的，避免干扰。点击标签即可飞达。
     屏幕边界与互相压字都做了避让，并避开左侧架构图、右侧讲解卡与上下状态栏。 */
  const starLabelLayer = document.getElementById('starlabels') as HTMLElement
  const starLabels = new Map<string, HTMLButtonElement>()
  for (const host of world.starSystems.hosts) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'starlabel'
    btn.dataset.name = host.cn
    btn.title = `前往${host.cn}`
    const dot = document.createElement('i')
    const name = document.createElement('span')
    name.textContent = host.cn
    btn.append(dot, name)
    btn.addEventListener('click', () => jumpTo(host.id))
    starLabelLayer.append(btn)
    starLabels.set(host.id, btn)
  }

  interface LabelBox { left: number; top: number; right: number; bottom: number }
  const labelBoxes: LabelBox[] = []
  const labelVec = new THREE.Vector3()
  const labelWorld = new THREE.Vector3()

  /** 估算标签宽度（避免每帧读 offsetWidth 触发布局） */
  function estimateLabelWidth(name: string): number {
    let width = 28 // 左侧圆点 + 内边距
    for (const char of name) width += (char.charCodeAt(0) > 255 ? 11 : 7) + 1
    return width
  }

  /**
   * 标签不再按 stage 整批显示/隐藏，而是给出一个连续权重：
   * - 银河系 / 其他恒星层级：随 log 视距淡入，到 CMB 前淡出；
   * - 聚焦某颗恒星时保留它自己与近邻；
   * - 飞行途中乘 detail，细节先退场、到达后再回来。
   */
  /**
   * CMB 是一个世界坐标球体，从外部看是圆。
   * 这里把球体的屏幕半径算出来，画一圈虚线边界，并在圆外标注未观测区域。
   */
  const cmbScreenCenter = new THREE.Vector3()

  function updateCMBOverlay(distance: number, phase: CosmosPhase, t: number): void {
    const visible = phase === 'cmb' && t > 0.78
    if (!visible) {
      cmbRingEl.classList.remove('is-visible')
      unobservedEl.classList.remove('is-visible')
      return
    }

    const safeDistance = Math.max(CMB_RADIUS * 1.001, distance)
    const angular = Math.asin(Math.min(0.999, CMB_RADIUS / safeDistance))
    const screenR =
      (Math.tan(angular) / Math.tan((camera.fov * Math.PI) / 360)) *
      (window.innerHeight / 2)

    camera.updateMatrixWorld()
    cmbScreenCenter.copy(world.galaxyCenter).project(camera)
    const cx = (cmbScreenCenter.x * 0.5 + 0.5) * window.innerWidth
    const cy = (-cmbScreenCenter.y * 0.5 + 0.5) * window.innerHeight

    const size = screenR * 2
    cmbRingEl.style.width = `${size}px`
    cmbRingEl.style.height = `${size}px`
    cmbRingEl.style.transform = `translate(${cx - screenR}px, ${cy - screenR}px)`
    cmbRingEl.classList.add('is-visible')

    const labelW = 230
    const labelH = 68
    let left = cx + screenR + 30
    let top = cy + screenR * 0.25
    let onLeft = false
    if (left + labelW > window.innerWidth - 18) {
      left = cx - screenR - labelW - 30
      onLeft = true
    }
    if (top + labelH > window.innerHeight - 90) top = cy - screenR * 0.4
    if (top < 90) top = cy + screenR * 0.5

    unobservedEl.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
    unobservedEl.classList.toggle('is-left', onLeft)
    unobservedEl.classList.add('is-visible')
  }

  /* ---------------- 深空里程碑提示 ----------------
     完全手动：只在用户自己缩放到对应距离时短暂显示，不自动停顿。 */
  let milestoneTimer = 0
  let lastMilestoneIndex = -1

  function showMilestone(index: number): void {
    const item = DEEP_MILESTONES[index]
    if (!item) return
    milestoneNameEl.textContent = item.name
    milestoneDistEl.textContent = `约 ${formatLightYears(realLightYears(item.at))}`
    milestoneEl.classList.add('is-visible')
    window.clearTimeout(milestoneTimer)
    milestoneTimer = window.setTimeout(() => {
      milestoneEl.classList.remove('is-visible')
    }, 2600)
  }

  function hideMilestone(): void {
    window.clearTimeout(milestoneTimer)
    milestoneEl.classList.remove('is-visible')
  }

  function updateMilestone(distance: number, phase: CosmosPhase, flying: boolean): void {
    let index = -1
    for (let i = 0; i < DEEP_MILESTONES.length; i++) {
      // 0.999 容差：避免浮点误差导致停在 769999.999 时识别不到 770000 里程碑
      if (distance >= DEEP_MILESTONES[i].at * 0.999) index = i
    }
    if (phase === 'cmb' || flying) {
      hideMilestone()
      lastMilestoneIndex = index
      return
    }
    if (index > lastMilestoneIndex && index >= 0) showMilestone(index)
    else if (index < lastMilestoneIndex) hideMilestone()
    lastMilestoneIndex = index
  }

  function updateStarLabels(detail: number): void {
    const navState = nav.getState()
    const globalWeight = windowFade(
      Math.log10(2400),
      Math.log10(5200),
      Math.log10(140000),
      Math.log10(260000),
      navState.distance
    )
    const focusId = navState.focus
    const viewW = window.innerWidth
    const viewH = window.innerHeight
    const halfW = viewW / 2
    const halfH = viewH / 2
    labelBoxes.length = 0
    // 相机矩阵在 render 时才更新，这里先刷新一次，避免标签位置比画面慢一帧（旋转时抖动）
    camera.updateMatrixWorld()

    for (const [id, btn] of starLabels) {
      const body = world.starSystems.bodies.get(id)
      let weight = 0
      let show = false

      if (body) {
        // 恒星坐标是"以太阳为原点"的相对坐标，须经 world.getPosition 换算到世界坐标
        world.getPosition(id, labelWorld)
        const camDist = camera.position.distanceTo(labelWorld)
        const nearWeight = 1 - THREE.MathUtils.smoothstep(camDist, 900, 2400)
        const focusWeight = id === focusId && navState.distance < 30000 ? 1 : 0
        weight = Math.max(globalWeight, nearWeight, focusWeight) * detail

        if (weight > 0.01) {
          labelVec.copy(labelWorld).project(camera)
          if (labelVec.z > -1 && labelVec.z < 1) {
            const px = labelVec.x * halfW + halfW
            const py = -labelVec.y * halfH + halfH
            const clear =
              py > 108 && py < viewH - 150 &&
              !(px < 340 && py > 120 && py < viewH - 140) && // 左侧架构图
              !(px > viewW - 300 && py < 440) // 右侧讲解卡
            if (clear) {
              const width = estimateLabelWidth(btn.dataset.name ?? '')
              const box: LabelBox = { left: px - 3, top: py - 11, right: px + width, bottom: py + 11 }
              const overlaps = labelBoxes.some(
                (other) => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top
              )
              if (!overlaps) {
                btn.style.transform = `translate(${Math.round(px)}px, ${Math.round(py)}px) translate(-3px, -50%)`
                labelBoxes.push(box)
                show = true
              }
            }
          }
        }
      }

      if (!show) weight = 0
      btn.style.opacity = weight.toFixed(3)
      btn.style.pointerEvents = show && weight > 0.08 ? 'auto' : 'none'
      btn.classList.toggle('is-visible', show)
    }
  }

  /* ---------------- 左侧：天体系统架构图 ---------------- */
  // 父节点表：用于"高亮当前层级 + 其上级链路"
  const parentOf = new Map<string, string>()
  const nodeButtons = new Map<string, HTMLButtonElement>()
  const nodeLabel = new Map<string, string>()

  function markParents(node: TreeNode, parent: string | null): void {
    if (parent) parentOf.set(node.id, parent)
    for (const child of node.children ?? []) markParents(child, node.id)
  }
  for (const root of TREE) markParents(root, null)

  /**
   * 教材式树状图：根节点在上、向下用直角折线分叉。
   * 结构：ul.org（根层）> li.org__branch > [button.org__node] + ul.org__children > …
   * 连接线全部由 CSS 伪元素绘制（见 styles.css 的 .org 一段）。
   */
  function buildTree(nodes: TreeNode[], root: boolean, container: HTMLElement): void {
    const list = document.createElement('ul')
    list.className = root ? 'org' : 'org__children'
    for (const node of nodes) {
      const li = document.createElement('li')
      li.className = 'org__branch'
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className =
        'org__node' +
        (node.universe ? ' org__node--root' : '') +
        (node.extended ? ' org__node--extended' : '')
      btn.textContent = node.cn
      btn.title = node.cn
      btn.addEventListener('click', () => {
        if (node.universe) jumpTo('universe')
        else if (node.target) jumpTo(node.target)
      })
      nodeButtons.set(node.id, btn)
      nodeLabel.set(node.id, node.cn)
      li.append(btn)
      if (node.children?.length) buildTree(node.children, false, li)
      list.append(li)
    }
    container.append(list)
  }
  treeEl.innerHTML = ''
  buildTree(TREE, true, treeEl)

  function highlightTree(activeId: string): void {
    const chain = new Set<string>()
    let cursor: string | undefined = activeId
    while (cursor) {
      chain.add(cursor)
      cursor = parentOf.get(cursor)
    }
    for (const [id, btn] of nodeButtons) {
      btn.classList.toggle('is-active', id === activeId)
      btn.classList.toggle('is-ancestor', id !== activeId && chain.has(id))
    }
  }

  /* ---------------- 底部：对数尺度轴 ---------------- */
  const tickButtons = new Map<string, HTMLButtonElement>()
  const cursorEl = document.createElement('div')
  cursorEl.className = 'scalebar__cursor'
  scalebarEl.innerHTML = ''
  for (const tick of TICKS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'scalebar__tick'
    btn.dataset.tick = tick.id
    btn.style.left = `${logPercent(tick.log)}%`
    btn.textContent = tick.cn
    btn.addEventListener('click', () => jumpTo(tick.target, tick.distance))
    scalebarEl.append(btn)
    tickButtons.set(tick.id, btn)
  }
  scalebarEl.append(cursorEl)
  const trackEl = document.createElement('div')
  trackEl.className = 'scalebar__track'
  scalebarEl.prepend(trackEl)

  /** 游标随视距移动；并按"对数区间"高亮当前所处刻度（区间用相邻刻度的中点划分，避免边界抖动） */
  function updateScalebar(distance: number): void {
    const log = THREE.MathUtils.clamp(Math.log10(Math.max(0.001, distance)), LOG_MIN, LOG_MAX)
    cursorEl.style.left = `${logPercent(log)}%`

    let activeIndex = 0
    for (let i = 0; i < TICKS.length - 1; i++) {
      const mid = (TICKS[i].log + TICKS[i + 1].log) / 2
      if (log >= mid) activeIndex = i + 1
    }
    TICKS.forEach((tick, i) => {
      tickButtons.get(tick.id)?.classList.toggle('is-active', i === activeIndex)
    })
  }

  /* ---------------- 层级切换提示 ---------------- */
  let toastTimer = 0
  function showToast(text: string): void {
    toastEl.textContent = text
    toastEl.hidden = false
    toastEl.classList.add('is-visible')
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      toastEl.classList.remove('is-visible')
      toastTimer = window.setTimeout(() => {
        toastEl.hidden = true
      }, 260)
    }, 1600)
  }

  /* ---------------- 站点内目标列表 ---------------- */
  let subdockKey = ''
  function buildSubdock(stage: Stage, focus: string): void {
    subdockEl.innerHTML = ''
    const addLabel = (text: string): void => {
      const span = document.createElement('span')
      span.className = 'subdock__label'
      span.textContent = text
      subdockEl.append(span)
    }
    const addSep = (): void => {
      const sep = document.createElement('span')
      sep.className = 'subdock__sep'
      subdockEl.append(sep)
    }
    const addItem = (id: string, cn: string, extended = false): void => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'subdock__btn' + (extended ? ' subdock__btn--extended' : '')
      btn.textContent = cn
      btn.classList.toggle('is-active', id === focus)
      btn.addEventListener('click', () => jumpTo(id))
      subdockEl.append(btn)
    }

    if (stage === 'earth') {
      addItem('moon', '月球')
      addSep()
      addLabel('其他行星的卫星系统')
      for (const system of SATELLITE_SYSTEMS) {
        addItem(system.id, system.cn, true)
      }
      const activeSystem = MOON_DATUM.filter((m) => focus === m.systemId || focus === m.id)
      if (activeSystem.length > 0) {
        addSep()
        addLabel(`${activeSystem[0].systemCn} 的入选卫星`)
        for (const moon of activeSystem) addItem(moon.id, moon.cn, true)
      }
    } else if (stage === 'solar') {
      addItem('sun', '太阳')
      const planets = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']
      for (const id of planets) addItem(id, infoOf(id)?.cn ?? id)
      addItem('moon', '月球')
    } else if (stage === 'stars') {
      addLabel('真实恒星')
      for (const host of HOST_STARS) addItem(host.id, host.cn)
      const host = HOST_STARS.find(
        (h) => h.id === focus || EXOPLANETS.some((p) => p.id === focus && p.parentStarId === h.id)
      )
      if (host) {
        addSep()
        addLabel(`${host.cn} 的行星`)
        for (const planet of EXOPLANETS.filter((p) => p.parentStarId === host.id)) {
          addItem(planet.id, planet.cn)
        }
      }
    } else if (stage === 'galaxy') {
      addItem('solar', '回到太阳系')
      addSep()
      addLabel('近邻恒星（已确认有行星）')
      for (const host of HOST_STARS) addItem(host.id, host.cn)
    } else if (stage === 'galaxies') {
      addItem('galaxy', '银河系')
      for (const galaxy of GALAXIES) addItem(galaxy.id, galaxy.cn)
    }
  }

  /* ---------------- 层级 → 架构图节点 ---------------- */
  function activeTreeNode(stage: Stage, focus: string): string {
    if (stage === 'earth') {
      // 任一卫星系统或其卫星 → 高亮对应系统节点
      if (SATELLITE_SYSTEMS.some((system) => system.id === focus)) return focus
      const moon = MOON_DATUM.find((m) => m.id === focus)
      return moon ? moon.systemId : 'earth'
    }
    if (stage === 'solar') return 'solar'
    if (stage === 'stars') return 'stars'
    if (stage === 'galaxy') {
      // 聚焦某座河外星系时，架构图高亮「河外星系」，读数显示该星系名
      return GALAXIES.some((galaxy) => galaxy.id === focus) ? 'galaxies' : 'galaxy'
    }
    return 'galaxies'
  }

  let lastStage: Stage | null = null
  let lastCosmosPhase: CosmosPhase | null = null

  function applyCard(card: CardInfo): void {
    cardKindEl.textContent = card.extended ? `${card.kind} · 拓展观察` : card.kind
    cardTitleEl.textContent = card.cn
    cardDescEl.textContent = card.desc
    cardMetaEl.innerHTML = ''
    for (const item of card.meta) {
      const li = document.createElement('li')
      li.textContent = item
      cardMetaEl.append(li)
    }
  }

  function syncUI(force = false): void {
    const navState = nav.getState()
    const { stage, focus, distance } = navState
    const cosmic = cosmos.getState()

    /* 深空缩放末段：层级仍是「河外星系」，但读数、架构图与讲解应指向宇宙背景 */
    if (cosmic.phase === 'cmb') {
      readoutValueEl.textContent = OBSERVABLE_UNIVERSE.cn
      readoutMetaEl.textContent = `宇宙微波背景 · 约 ${formatLightYears(realLightYears(distance))}`
      jumpCmbEl.hidden = true
      highlightTree('universe')
      // 不再伪造 1e8：游标按真实视距连续走到「可观测宇宙」刻度
      updateScalebar(distance)
      applyCard({
        kind: '天体系统',
        cn: OBSERVABLE_UNIVERSE.cn,
        sub: OBSERVABLE_UNIVERSE.sub,
        desc: OBSERVABLE_UNIVERSE.desc,
        meta: OBSERVABLE_UNIVERSE.meta ?? []
      })
      if (lastCosmosPhase !== 'cmb') {
        showToast('进入：可观测宇宙 · 宇宙微波背景')
        lastCosmosPhase = 'cmb'
      }
      return
    }

    if (cosmic.phase !== lastCosmosPhase) {
      if (cosmic.phase === 'condense' && lastCosmosPhase === 'atlas') {
        showToast('继续缩小：星系正在汇聚为星点')
      } else if (lastCosmosPhase === 'cmb') {
        showToast('返回：河外星系')
      }
      lastCosmosPhase = cosmic.phase
    }

    const activeId = activeTreeNode(stage, focus)
    const focusGalaxy = GALAXIES.find((galaxy) => galaxy.id === focus)
    readoutValueEl.textContent =
      focusGalaxy?.cn ?? nodeLabel.get(activeId) ?? STAGE_LABEL[stage]
    readoutMetaEl.textContent =
      distance > 68000
        ? `视距 ${formatDistance(distance)} · 约 ${formatLightYears(realLightYears(distance))}`
        : `视距 ${formatDistance(distance)}`
    jumpCmbEl.hidden =
      nav.isFlying() || !(stage === 'galaxy' || stage === 'galaxies') || distance >= CMB_DISTANCE - 100000

    highlightTree(activeId)
    updateScalebar(distance)

    if (stage !== lastStage) {
      // 飞行途中的逐级变化不弹 toast，避免一次长飞行堆叠一串提示
      if (lastStage !== null && !nav.isFlying()) {
        showToast(`进入：${nodeLabel.get(activeId) ?? STAGE_LABEL[stage]}`)
      }
      lastStage = stage
    }

    const card = resolveInfo(focus)
    if (card) applyCard(card)

    const key = `${stage}|${focus}`
    if (force || key !== subdockKey) {
      subdockKey = key
      buildSubdock(stage, focus)
    }
  }

  /* ---------------- 开关 ---------------- */
  function bindToggle(selector: string, initial: boolean, onChange: (next: boolean) => void): void {
    const btn = document.querySelector<HTMLButtonElement>(selector)
    if (!btn) return
    let value = initial
    btn.setAttribute('aria-pressed', String(value))
    btn.addEventListener('click', () => {
      value = !value
      btn.setAttribute('aria-pressed', String(value))
      btn.textContent = selector.includes('pause') ? (value ? '继续' : '暂停') : btn.textContent
      onChange(value)
    })
  }

  bindToggle('[data-toggle="orbits"]', true, (next) => {
    state.orbitsVisible = next
  })
  bindToggle('[data-toggle="pause"]', false, (next) => {
    state.paused = next
  })

  // 用户拖动即接管镜头，结束自动飞行
  renderer.domElement.addEventListener('pointerdown', () => {
    nav.cancelFlight()
    dolly.sync()
  })

  // 滚轮推拉统一走 core/dolly.ts：挂在 window 捕获阶段，确保先于 OrbitControls
  // 的 target 监听执行（stopPropagation 后它就收不到滚轮了）；触摸双指缩放仍归它。
  window.addEventListener(
    'wheel',
    (event) => {
      dolly.handleWheel(event)
    },
    { capture: true, passive: false }
  )

  window.addEventListener('resize', () => {
    cosmos.resize(resize(world.starFields, quality.maxPixels))
    composer.render()
  })

  /* ---------------- 渲染循环 ---------------- */
  let last = performance.now()
  let hudTick = 0

  function animate(now: number): void {
    requestAnimationFrame(animate)
    const rawDt = (now - last) / 1000
    const dt = Math.min(rawDt, 0.05)
    last = now
    // 单帧超过 100ms 视为 GC/切后台等异常，不让它把平均值拉爆
    monitorQuality(Math.min(rawDt, 0.1))

    const before = nav.getState()
    state.stage = before.stage
    state.distance = before.distance

    // 飞行期间统一降细节：轨道 / 卫星系统 / 恒星标签先退场，到达后再淡入。
    // 大跨度移动时，这是最省事、也最接近 OpenSpace 演示手法的做法。
    const flight = nav.getFlightProgress()
    state.detail = 1 - 0.88 * Math.sin(Math.PI * flight)
    state.atlasScale = quality.atlasScale

    world.update(dt, state)
    // 推拉用未裁剪的真实帧间隔（上限 0.25s）：低帧率下滚轮手感不会被拖慢
    dolly.update(Math.min(Math.max(rawDt, 0), 0.25))
    nav.update(dt, now)
    const navState = nav.getState()
    state.stage = navState.stage
    state.distance = navState.distance
    world.backgroundStars.position.copy(camera.position)
    world.updateVisibility(camera, navState.distance, navState.focus, navState.stage, state)

    // 深空过渡必须在 updateVisibility 之后：它要在世界写入的透明度上叠加淡出
    const cosmic = cosmos.update(dt, navState.distance, navState.stage)
    // 泛光随过渡先增强（把收缩的星系"糊"成光点）再回落（让 CMB 全景保持干净）
    bloom.strength = 0.42 + 0.18 * Math.sin(Math.PI * cosmic.t) - 0.08 * Math.max(0, (cosmic.t - 0.75) / 0.25)

    updateStarLabels(state.detail)
    updateCMBOverlay(navState.distance, cosmic.phase, cosmic.t)
    updateMilestone(navState.distance, cosmic.phase, nav.isFlying())

    if (++hudTick % 8 === 0) syncUI()

    composer.render()
  }

  syncUI(true)
  requestAnimationFrame(animate)
}

void start()
