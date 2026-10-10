/* ============================================================
   universe/galaxies.ts  【站 5：河外星系】
   生成器移植自 ORBIT 项目 src/universe/nearby-galaxies.js（Apache-2.0）；
   星系数据取自 src/universe/deep-space-catalog.js 与 observed-galaxies.js，
   仅保留"银河系之外"的真实星系（13 座），与原作中明确标注为示意/虚构的天体无关。
   原始项目：https://github.com/ryh842487118-bot/orbit

   教学点：银河系并非唯一 —— 这些星系与银河系同级别，图中位置与大小经过压缩，
   并不表示它们同属一个星系群。
   ============================================================ */
import * as THREE from 'three'
import { pointCloud } from '../core/point-cloud'
import { glow } from '../core/glow'
import { makeRandom, gaussianFrom, TAU } from '../core/math'

export interface GalaxyDef {
  id: string
  cn: string
  en: string
  index: string
  /** 类型描述（页面上标明"与银河系同级别"） */
  type: string
  position: [number, number, number]
  radius: number
  viewDistance: number
  shape: 'spiral' | 'elliptical' | 'irregular'
  profile?: 'compact' | 'diffuse' | 'giant' | 'dust-lane' | 'lenticular' | 'cigar'
  axisRatio?: number
  tilt: [number, number, number]
  arms: number
  color: number
  armTwist?: number
  armSpread?: number
  bulgeFraction?: number
  distance: string
  highlight?: string
  desc: string
}

export const GALAXIES: GalaxyDef[] = [
  {
    id: 'andromeda', cn: '仙女座星系', en: 'ANDROMEDA · M31', index: 'M31',
    type: '本星系群 / 螺旋星系', position: [240000, 35000, -180000], radius: 38000, viewDistance: 98800,
    shape: 'spiral', tilt: [0.34, 0.18, -0.26], arms: 2, color: 0xa7bbff,
    distance: '约 250 万光年', highlight: '本星系群最大成员',
    desc: '距离我们约 250 万光年的螺旋星系，是肉眼可见的最远天体之一，正以约每秒 110 公里的速度向银河系靠近。'
  },
  {
    id: 'triangulum', cn: '三角座星系', en: 'TRIANGULUM · M33', index: 'M33',
    type: '本星系群 / 螺旋星系', position: [-210000, -18000, -210000], radius: 22000, viewDistance: 57200,
    shape: 'spiral', tilt: [-0.2, 0.7, 0.17], arms: 3, color: 0x87dce7,
    distance: '约 300 万光年', highlight: '本星系群第三大成员',
    desc: '拥有疏朗螺旋结构的星系，是本星系群的主要成员之一，星盘中散布着大量恒星诞生区。'
  },
  {
    id: 'lmc', cn: '大麦哲伦星云', en: 'LARGE MAGELLANIC CLOUD', index: 'LMC',
    type: '本星系群 / 不规则矮星系', position: [100000, -65000, 80000], radius: 11000, viewDistance: 28600,
    shape: 'irregular', tilt: [0.16, -0.35, 0.31], arms: 0, color: 0x91cfed,
    distance: '约 16 万光年', highlight: '银河系最近的伴星系之一',
    desc: '名字叫"星云"，实际是一座邻近银河系的矮星系，南半球肉眼可见，内部有著名的蜘蛛星云。'
  },
  {
    id: 'smc', cn: '小麦哲伦星云', en: 'SMALL MAGELLANIC CLOUD', index: 'SMC',
    type: '本星系群 / 不规则矮星系', position: [160000, -95000, 110000], radius: 7000, viewDistance: 18200,
    shape: 'irregular', tilt: [-0.24, 0.2, -0.3], arms: 0, color: 0xb5b9ef,
    distance: '约 20 万光年',
    desc: '位于银河系附近的不规则矮星系，星光呈松散的云状分布，与大麦哲伦星云相伴。'
  },
  {
    id: 'm32', cn: 'M32 星系', en: 'MESSIER 32 · NGC 221', index: 'M32',
    type: '本星系群 / 紧凑椭圆星系', position: [284000, 16000, -151000], radius: 7000, viewDistance: 18200,
    shape: 'elliptical', profile: 'compact', axisRatio: 0.76, tilt: [0.2, -0.15, 0.42], arms: 0, color: 0xffdcb4,
    distance: '约 250 万光年', highlight: '仙女座星系的卫星星系',
    desc: '仙女座旁的紧凑椭圆星系，密集的古老恒星组成平滑明亮的核心，没有旋臂结构。'
  },
  {
    id: 'm110', cn: 'M110 星系', en: 'MESSIER 110 · NGC 205', index: 'M110',
    type: '本星系群 / 矮椭圆星系', position: [203000, 76000, -220000], radius: 10000, viewDistance: 26000,
    shape: 'elliptical', profile: 'diffuse', axisRatio: 0.55, tilt: [-0.22, 0.3, -0.48], arms: 0, color: 0xe7d5b9,
    distance: '约 270 万光年', highlight: '仙女座的另一颗卫星星系',
    desc: '也称 NGC 205，是仙女座星系的卫星星系，柔和拉长的椭圆轮廓中分布着古老恒星与球状星团。'
  },
  {
    id: 'ngc6822', cn: '巴纳德星系', en: "BARNARD'S GALAXY · NGC 6822", index: 'NGC 6822',
    type: '本星系群 / 不规则矮星系', position: [-90000, 65000, 155000], radius: 9000, viewDistance: 23400,
    shape: 'irregular', tilt: [0.28, -0.5, -0.12], arms: 0, color: 0x9ed8c6,
    distance: '约 160 万光年',
    desc: '距离银河系较近的不规则矮星系，重元素含量较低，是研究早期星系演化的邻近样本。'
  },
  {
    id: 'whirlpool', cn: '旋涡星系', en: 'WHIRLPOOL GALAXY · M51', index: 'M51',
    type: '猎犬座方向 / 螺旋星系', position: [-285000, 145000, 65000], radius: 24000, viewDistance: 62400,
    shape: 'spiral', tilt: [0.12, 0.4, -0.18], arms: 2, color: 0x92c4ff,
    armTwist: 1.25, armSpread: 0.12, bulgeFraction: 0.1,
    distance: '约 3100 万光年', highlight: '本星系群之外',
    desc: '猎犬座方向的螺旋星系，位于本星系群之外，一对清晰的旋臂正与邻近的小星系相互吸引。'
  },
  {
    id: 'bode', cn: '波德星系', en: "BODE'S GALAXY · M81", index: 'M81',
    type: '大熊座方向 / 螺旋星系', position: [-175000, -85000, 305000], radius: 30000, viewDistance: 78000,
    shape: 'spiral', tilt: [0.38, -0.25, 0.22], arms: 2, color: 0xacc6e5,
    armTwist: 2.2, armSpread: 0.14, bulgeFraction: 0.27,
    distance: '约 1160 万光年',
    desc: '大熊座方向明亮的螺旋星系，宽阔核球中聚集着较老的偏红恒星，年轻蓝星勾勒出旋臂。'
  },
  {
    id: 'cigar', cn: '雪茄星系', en: 'CIGAR GALAXY · M82', index: 'M82',
    type: '大熊座方向 / 星暴星系', position: [-230000, -45000, 355000], radius: 14000, viewDistance: 39200,
    shape: 'irregular', profile: 'cigar', axisRatio: 0.24, tilt: [0.65, 0.1, 0.28], arms: 0, color: 0xf1bca5,
    distance: '约 1200 万光年', highlight: '正经历剧烈恒星形成',
    desc: '侧向展开的螺旋星系，因狭长外观得名。它与 M81 的引力相互作用触发了剧烈的恒星形成。'
  },
  {
    id: 'sombrero', cn: '草帽星系', en: 'SOMBRERO GALAXY · M104', index: 'M104',
    type: '室女座方向 / 近侧视螺旋星系', position: [280000, 110000, 235000], radius: 25000, viewDistance: 70000,
    shape: 'spiral', profile: 'lenticular', axisRatio: 0.2, tilt: [1.3, 0.12, -0.24], arms: 2, color: 0xe8d4b0,
    distance: '约 3000 万光年',
    desc: '我们几乎从侧面观看这座螺旋星系：明亮隆起的核球与环绕星盘的深色尘带组成了草帽般的轮廓。'
  },
  {
    id: 'centaurus-a', cn: '半人马座 A', en: 'CENTAURUS A · NGC 5128', index: 'NGC 5128',
    type: '半人马座方向 / 特殊椭圆星系', position: [35000, -165000, -325000], radius: 28000, viewDistance: 78400,
    shape: 'elliptical', profile: 'dust-lane', axisRatio: 0.82, tilt: [0.32, -0.22, -0.48], arms: 0, color: 0xe6ccb0,
    distance: '约 1200 万光年', highlight: '著名射电源',
    desc: '本星系群外的一座特殊椭圆星系，宽阔斑驳的尘带横穿古老恒星的柔光，很可能是星系并合的产物。'
  },
  {
    id: 'm87', cn: 'M87 星系', en: 'MESSIER 87 · VIRGO A', index: 'M87',
    type: '室女座星系团 / 巨椭圆星系', position: [385000, -45000, 55000], radius: 36000, viewDistance: 100800,
    shape: 'elliptical', profile: 'giant', axisRatio: 0.9, tilt: [-0.2, 0.35, 0.12], arms: 0, color: 0xf0d5ad,
    distance: '约 5400 万光年', highlight: '首张黑洞照片的所在地',
    desc: '室女座星系团中的巨椭圆星系，星光外分布着大量球状星团；其中心超大质量黑洞是人类首张拍到照片的黑洞。'
  }
]

/* ---------------- 程序化生成（移植自 ORBIT nearby-galaxies.js） ---------------- */

interface Knot {
  x: number
  z: number
  size: number
}

function spiralKnots(definition: GalaxyDef): Knot[] {
  const arms = definition.arms || 2
  const twist = definition.armTwist ?? (definition.id === 'andromeda' ? 2.05 : 1.5)
  return Array.from({ length: 6 }, (_, index) => {
    const r = 0.34 + (index % 3) * 0.21
    const angle = ((index % arms) * TAU) / arms + Math.log(r / 0.12) * twist
    return { x: Math.cos(angle) * r, z: Math.sin(angle) * r, size: 0.018 + (index % 3) * 0.007 }
  })
}

function cloudKnots(definition: GalaxyDef): Knot[] {
  if (definition.profile === 'cigar') {
    return [
      { x: -0.34, z: 0.015, size: 0.07 },
      { x: 0.25, z: -0.025, size: 0.055 },
      { x: 0.02, z: 0.015, size: 0.09 }
    ]
  }
  if (definition.id === 'lmc') {
    return [
      { x: -0.5, z: -0.15, size: 0.11 },
      { x: 0.48, z: 0.22, size: 0.095 },
      { x: 0.1, z: -0.38, size: 0.15 },
      { x: -0.26, z: 0.32, size: 0.17 }
    ]
  }
  if (definition.id === 'smc') {
    return [
      { x: -0.3, z: -0.16, size: 0.22 },
      { x: 0.2, z: 0.12, size: 0.16 },
      { x: 0.6, z: 0.3, size: 0.12 }
    ]
  }
  const rand = makeRandom(`${definition.id}-associations`)
  return Array.from({ length: 5 }, (_, index) => {
    const angle = (index * TAU) / 5 + (rand() - 0.5) * 0.9
    const radius = 0.25 + rand() * 0.43
    return { x: Math.cos(angle) * radius + 0.08, z: Math.sin(angle) * radius * 0.7, size: 0.06 + rand() * 0.075 }
  })
}

interface Field {
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  knots: Knot[]
  count: number
}

function createField(definition: GalaxyDef, pixels: number, compact: boolean): Field {
  const rand = makeRandom(definition.id)
  const spiral = definition.shape === 'spiral'
  const elliptical = definition.shape === 'elliptical'
  const compactElliptical = elliptical && (definition.profile || (definition.id === 'm32' ? 'compact' : 'diffuse')) === 'compact'
  const giant = elliptical && definition.profile === 'giant'
  const dustLane = elliptical && definition.profile === 'dust-lane'
  const lenticular = spiral && definition.profile === 'lenticular'
  const cigar = definition.profile === 'cigar'
  const axisRatio = THREE.MathUtils.clamp(definition.axisRatio ?? (compactElliptical ? 0.76 : 0.55), 0.35, 1)
  const andromeda = definition.id === 'andromeda'
  const largeCloud = definition.id === 'lmc'
  const magellanic = largeCloud || definition.id === 'smc'
  const count = compact
    ? andromeda ? 6800 : spiral ? 5500 : elliptical ? (compactElliptical ? 4200 : 3500) : largeCloud ? 4600 : magellanic ? 4000 : 2400
    : andromeda ? 18000 : spiral ? 15000 : elliptical ? (compactElliptical ? 11000 : 9000) : largeCloud ? 12000 : magellanic ? 10000 : 6200
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const knots = elliptical || lenticular ? [] : spiral ? spiralKnots(definition) : cloudKnots(definition)
  const warm = new THREE.Color(elliptical ? (compactElliptical || giant ? 0xffe5be : 0xe6d7bd) : andromeda ? 0xffd9a2 : 0xeacb9e)
  const blue = new THREE.Color(andromeda ? 0x97bdeb : 0x8ac7f5)
  const pink = new THREE.Color(0xed91bd)
  const white = new THREE.Color(elliptical ? 0xfff4e5 : 0xe8efff)
  const color = new THREE.Color()
  const radius = definition.radius

  for (let index = 0; index < count; index++) {
    const population = rand()
    let x: number, y: number, z: number, r: number
    let isCore = false, isKnot = false, isOutflow = false, dust = 1
    if (cigar) {
      if (population < 0.085) {
        const height = 0.12 + Math.pow(rand(), 0.8) * 0.7
        x = gaussianFrom(rand) * (0.035 + height * 0.16)
        z = (rand() < 0.5 ? -1 : 1) * height
        y = gaussianFrom(rand) * 0.025
        r = Math.hypot(x, z)
        isOutflow = true
        dust = 0.44 * (1 - height * 0.55)
      } else if (population < 0.45) {
        const knot = knots[Math.floor(rand() * knots.length)]
        x = knot.x + gaussianFrom(rand) * knot.size
        z = knot.z + gaussianFrom(rand) * knot.size * 0.7
        y = gaussianFrom(rand) * 0.035
        r = Math.hypot(x, z)
        isKnot = true
        isCore = true
      } else {
        x = (rand() * 2 - 1) * 0.94
        z = gaussianFrom(rand) * (0.035 + 0.065 * (1 - Math.abs(x)))
        y = gaussianFrom(rand) * 0.045
        r = Math.hypot(x, z)
        dust = Math.abs(z + 0.025 * Math.sin(x * 12)) < 0.018 ? 0.17 : 0.8
      }
    } else if (lenticular) {
      isCore = population < (definition.bulgeFraction ?? 0.52)
      if (isCore) {
        r = Math.pow(rand(), 1.18) * 0.55
        const azimuth = rand() * TAU
        const height = rand() * 2 - 1
        const equatorial = Math.sqrt(1 - height * height)
        x = Math.cos(azimuth) * equatorial * r
        z = Math.sin(azimuth) * equatorial * r
        y = height * r * 0.72
        dust = Math.abs(y) < 0.028 ? 0.035 : 1
      } else {
        r = 0.18 + Math.pow(rand(), 0.72) * 0.82
        const angle = rand() * TAU
        x = Math.cos(angle) * r
        z = Math.sin(angle) * r
        y = gaussianFrom(rand) * 0.018
        dust = Math.abs(y) < 0.009 ? 0.08 : 0.8
      }
    } else if (elliptical) {
      isCore = population < (compactElliptical ? 0.4 : giant ? 0.32 : dustLane ? 0.23 : 0.035)
      r = isCore
        ? Math.pow(rand(), 1.55) * (compactElliptical ? 0.14 : giant || dustLane ? 0.23 : 0.18)
        : Math.pow(rand(), compactElliptical ? 1.1 : giant ? 0.86 : dustLane ? 0.8 : 0.57) * 0.96
      const azimuth = rand() * TAU
      const height = rand() * 2 - 1
      const equatorial = Math.sqrt(1 - height * height)
      x = Math.cos(azimuth) * equatorial * r
      z = Math.sin(azimuth) * equatorial * r * axisRatio
      y = height * r * axisRatio * (giant ? 1 : 0.78)
      dust = compactElliptical ? 0.9 : giant ? 0.94 : dustLane ? 0.82 : 0.62
      if (dustLane && Math.abs(y) < 0.043 + Math.abs(x) * 0.035) dust *= 0.035
    } else if (spiral) {
      const bulgeFraction = definition.bulgeFraction ?? (andromeda ? 0.26 : 0.075)
      if (population < bulgeFraction) {
        r = Math.pow(rand(), 1.4) * (andromeda ? 0.24 : 0.13)
        const angle = rand() * TAU
        x = Math.cos(angle) * r
        z = Math.sin(angle) * r
        y = gaussianFrom(rand) * (andromeda ? 0.047 : 0.022) * (1 - r / 0.3)
        isCore = true
      } else if (population > (andromeda ? 0.955 : 0.9)) {
        const knot = knots[Math.floor(rand() * knots.length)]
        x = knot.x + gaussianFrom(rand) * knot.size
        z = knot.z + gaussianFrom(rand) * knot.size
        y = gaussianFrom(rand) * 0.008
        r = Math.hypot(x, z)
        isKnot = true
      } else {
        r = 0.1 + Math.pow(rand(), 0.69) * 0.9
        const arm = Math.floor(rand() * (definition.arms || 2))
        const armAngle = (arm * TAU) / (definition.arms || 2) + Math.log(r / 0.12) * (definition.armTwist ?? (andromeda ? 2.05 : 1.5))
        const armOffset = gaussianFrom(rand) * (definition.armSpread ?? (andromeda ? 0.115 : 0.22))
        const inArm = population > (andromeda ? 0.48 : 0.39)
        const angle = inArm ? armAngle + armOffset : rand() * TAU
        x = Math.cos(angle) * r + gaussianFrom(rand) * 0.009
        z = Math.sin(angle) * r + gaussianFrom(rand) * 0.009
        y = gaussianFrom(rand) * (0.004 + r * 0.012)
        if (inArm && armOffset < -0.035 && armOffset > -0.115) dust = andromeda ? 0.2 : 0.48
        if (!inArm) dust *= 0.65
      }
    } else if (magellanic && population < (largeCloud ? 0.43 : 0.2)) {
      x = (rand() - 0.5) * (largeCloud ? 1.48 : 1.05)
      z = gaussianFrom(rand) * 0.075 + x * (largeCloud ? 0.1 : 0.28)
      y = gaussianFrom(rand) * 0.035
      r = Math.hypot(x, z)
      isCore = true
    } else if (population < (magellanic ? (largeCloud ? 0.77 : 0.79) : 0.56)) {
      const knot = knots[Math.floor(rand() * knots.length)]
      x = knot.x + gaussianFrom(rand) * knot.size
      z = knot.z + gaussianFrom(rand) * knot.size * 0.74
      y = gaussianFrom(rand) * knot.size * (magellanic ? 0.4 : 0.62)
      r = Math.hypot(x, z)
      isKnot = true
    } else {
      r = Math.sqrt(rand())
      const angle = rand() * TAU
      x = Math.cos(angle) * r * 0.88 + Math.sin(angle * 2) * 0.13
      z = Math.sin(angle) * r * 0.58 + x * 0.2
      y = gaussianFrom(rand) * 0.055
      dust = magellanic ? 0.63 : 0.42
    }
    positions[index * 3] = x * radius
    positions[index * 3 + 1] = y * radius
    positions[index * 3 + 2] = z * radius
    color.copy(elliptical || lenticular || isCore ? warm : blue)
    if (elliptical) color.lerp(white, isCore ? 0.42 : 0.18 + r * 0.28)
    else if (!isCore && !isKnot) color.lerp(warm, Math.max(0, 0.42 - r * 0.7))
    if (isKnot && rand() < (andromeda ? 0.22 : magellanic || spiral ? 0.4 : 0.12)) color.copy(pink)
    if (rand() < 0.16) color.lerp(white, 0.75)
    if (isOutflow) color.setHex(0xff5772)
    const intensity = (0.58 + rand() * 0.94) * dust
    colors[index * 3] = color.r * intensity
    colors[index * 3 + 1] = color.g * intensity
    colors[index * 3 + 2] = color.b * intensity
    sizes[index] = (elliptical ? (isCore ? 1.65 : 1.05) : isKnot ? 2.15 : isCore ? 1.85 : 1.25) + rand() * (elliptical ? 1.05 : 1.4)
  }
  const points = pointCloud(positions, colors, sizes, radius * 3.6, 0, pixels)
  points.name = `${definition.id}-stars`
  points.geometry.computeBoundingSphere()
  return { points, knots, count }
}

export interface GalaxyEntry {
  definition: GalaxyDef
  group: THREE.Group
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  halo: THREE.Sprite
  accents: THREE.Sprite[]
  accentOpacities: number[]
  count: number
}

export interface GalaxyAtlas {
  galaxies: Map<string, GalaxyEntry>
  starFields: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>[]
  update: (camera: THREE.PerspectiveCamera, state: { stage: string; activeGalaxyId: string | null; distance: number }) => void
  dispose: () => void
}

export function createGalaxyAtlas(
  scene: THREE.Scene,
  pixels: number,
  definitions: GalaxyDef[] = GALAXIES
): GalaxyAtlas {
  const galaxies = new Map<string, GalaxyEntry>()
  const starFields: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>[] = []
  const compact = window.innerWidth <= 600
  const records: GalaxyEntry[] = []

  for (const definition of definitions) {
    const group = new THREE.Group()
    group.name = `galaxy-${definition.id}`
    group.position.fromArray(definition.position)
    group.rotation.fromArray(definition.tilt)
    group.visible = false

    const { points, knots, count } = createField(definition, pixels, compact)
    const spiral = definition.shape === 'spiral'
    const elliptical = definition.shape === 'elliptical'
    const compactElliptical = elliptical && (definition.profile || (definition.id === 'm32' ? 'compact' : 'diffuse')) === 'compact'
    const giant = elliptical && definition.profile === 'giant'
    const dusty = definition.profile === 'dust-lane' || definition.profile === 'lenticular'
    const cigar = definition.profile === 'cigar'
    const andromeda = definition.id === 'andromeda'
    const irregular = !spiral && !elliptical && definition.id !== 'lmc' && definition.id !== 'smc'

    const halo = glow(
      elliptical ? 0xffe3be : andromeda ? 0xffd6a0 : definition.color,
      definition.radius * (elliptical ? (compactElliptical ? 0.42 : giant ? 0.68 : 0.6) : andromeda ? 0.56 : cigar ? 0.18 : 0.25),
      0
    )
    halo.name = `${definition.id}-core-glow`
    const accents: THREE.Sprite[] = [halo]
    const accentOpacities: number[] = [
      dusty ? 0.015 : elliptical ? (compactElliptical ? 0.25 : giant ? 0.22 : 0.035) : andromeda ? 0.31 : spiral ? 0.14 : cigar ? 0.065 : irregular ? 0.025 : 0.09
    ]
    group.add(points, halo)

    if (!andromeda) {
      for (const knot of knots.slice(0, 2)) {
        const accent = glow(
          cigar ? 0xff9baf : spiral ? 0xc897d9 : 0x8eb8ed,
          definition.radius * (spiral ? 0.14 : cigar ? 0.15 : irregular ? 0.2 : 0.32),
          0
        )
        accent.position.set(knot.x * definition.radius, 0, knot.z * definition.radius)
        group.add(accent)
        accents.push(accent)
        accentOpacities.push(spiral ? 0.1 : cigar ? 0.07 : irregular ? 0.045 : 0.075)
      }
    }

    scene.add(group)
    const entry: GalaxyEntry = { definition, group, points, halo, accents, accentOpacities, count }
    galaxies.set(definition.id, entry)
    starFields.push(points)
    records.push(entry)
  }

  let disposed = false

  function update(
    camera: THREE.PerspectiveCamera,
    { stage, activeGalaxyId, distance }: { stage: string; activeGalaxyId: string | null; distance: number }
  ): void {
    if (disposed) return
    // 只在站 5「河外星系」显示：站 4 的银河系视图保持干净，避免与银河系争画面
    const visible = stage === 'galaxies'
    for (const record of records) {
      const { definition, group, points, count, accents, accentOpacities } = record
      if (!visible) {
        group.visible = false
        continue
      }
      const cameraDistance = camera.position.distanceTo(group.position)
      const radius = definition.radius
      const active = activeGalaxyId === definition.id
      const focusDistance = Number.isFinite(distance) ? distance : cameraDistance
      const focusFade = active ? THREE.MathUtils.smoothstep(focusDistance, radius * 0.00012, radius * 0.025) : 1
      const insideFade = 0.18 + 0.82 * THREE.MathUtils.smoothstep(cameraDistance, radius * 0.1, radius * 1.15)
      ;(points.material.uniforms.uPerspective as { value: number }).value = Math.min(
        radius * 3.6,
        Math.max(radius * 0.025, cameraDistance * 0.95)
      )
      const lod = THREE.MathUtils.clamp((radius * 14) / Math.max(cameraDistance, 1), 0.42, 1)
      points.geometry.setDrawRange(0, Math.ceil(count * lod))
      const opacity = focusFade * insideFade * (stage === 'galaxies' || active ? 0.92 : 0.74)
      ;(points.material.uniforms.uOpacity as { value: number }).value = opacity / Math.sqrt(lod)
      const glowFade = opacity * THREE.MathUtils.smoothstep(cameraDistance, radius * 0.18, radius * 1.25)
      for (let index = 0; index < accents.length; index++) {
        accents[index].material.opacity = glowFade * accentOpacities[index]
      }
      group.visible = opacity > 0.001
    }
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    for (const { group, points, accents } of records) {
      scene.remove(group)
      points.geometry.dispose()
      points.material.dispose()
      for (const accent of accents) accent.material.dispose()
    }
  }

  return { galaxies, starFields, update, dispose }
}
