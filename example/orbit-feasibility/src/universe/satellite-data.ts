﻿﻿﻿/* ============================================================
   universe/satellite-data.ts
   有天然卫星行星的卫星数据层（真实观测参数 + 贴图来源元信息）。

   口径与约束：
   1) 只收录"有天然卫星"的行星：火星、木星、土星、天王星、海王星
      （水星、金星 0 颗，地球的月球由太阳系层单独承载，见 bodies.ts）；
   2) 卫星数量远超 10 的巨行星只保留 IAU 正式编号且被广泛认知的卫星；
   3) 半径 / 半长轴 / 周期 / 倾角 / 偏心率均取真实值，场景值是它们经
      "同系统等比 + 轨道幂压缩"后的示意值（见 visualRadius / sceneOrbit）；
   4) 贴图分级：A/B 级必须有观测底图，C 级**不使用贴图**，仅按实测反照率
      给纯色材质 —— 禁止任何程序化/虚构地表纹理。

   数据来源：NASA/JPL 行星数据表、IAU 卫星命名、USGS Astrogeology 全球拼接图。
   逐张素材的许可与处理步骤登记在 docs/06_资源引用.md。
   ============================================================ */
import * as THREE from 'three'
import { BODIES } from './data'

export type SatelliteParent = 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune'

/** 1 真实日对应的模型秒数（统一时间压缩，保证同系统内周期比不变） */
export const TIME_SCALE_SECONDS_PER_DAY = 6

/** 行星真实平均半径（km），用于还原卫星与行星的真实尺寸比 */
const PLANET_RADIUS_KM: Record<SatelliteParent, number> = {
  mars: 3389.5,
  jupiter: 69911,
  saturn: 58232,
  uranus: 25362,
  neptune: 24622
}

/** 行星在场景中的示意半径，直接复用太阳系层数据，避免两套比例 */
const PLANET_SCENE_RADIUS: Record<SatelliteParent, number> = {
  mars: BODIES.find((b) => b.id === 'mars')!.r,
  jupiter: BODIES.find((b) => b.id === 'jupiter')!.r,
  saturn: BODIES.find((b) => b.id === 'saturn')!.r,
  uranus: BODIES.find((b) => b.id === 'uranus')!.r,
  neptune: BODIES.find((b) => b.id === 'neptune')!.r
}

export interface SatelliteSystemDef {
  /** 节点 id，同时也是可飞达目标 id */
  id: string
  cn: string
  parent: SatelliteParent
  /** 同系统统一的尺寸放大系数：保证系统内卫星真实半径比不变 */
  radiusScale: number
  /** 轨道幂压缩指数 */
  orbitExponent: number
  /** 轨道内缘锚点（土星用它把卫星推到可视光环之外） */
  orbitAnchor?: number
  /** 场景最小半径，避免小卫星亚像素 */
  minVisualRadius: number
  desc: string
}

export const SATELLITE_SYSTEMS: SatelliteSystemDef[] = [
  {
    id: 'mars-moons',
    cn: '火星卫星',
    parent: 'mars',
    radiusScale: 45,
    orbitExponent: 0.55,
    minVisualRadius: 0.05,
    desc: '火星有两颗小而不规则的卫星：火卫一与火卫二。它们被认为是被火星俘获的小天体，表面布满撞击坑。'
  },
  {
    id: 'jupiter-moons',
    cn: '木星系',
    parent: 'jupiter',
    radiusScale: 9.5,
    orbitExponent: 0.55,
    minVisualRadius: 0.08,
    desc: '伽利略卫星——木卫一、二、三、四——是木星最大的四颗卫星，由伽利略于 1610 年发现，也是太阳系中除月球外最早被发现的卫星。'
  },
  {
    id: 'saturn-moons',
    cn: '土星系',
    parent: 'saturn',
    radiusScale: 9,
    orbitExponent: 0.55,
    // 真实土星主环外缘约 2.27 R，锚点取 3.2 R 保证所有入选卫星都落在可视光环之外
    orbitAnchor: 3.2,
    minVisualRadius: 0.08,
    desc: '土星拥有太阳系最庞大的卫星系统。这里保留知名度最高、且有官方全球影像的 7 颗：土卫一至土卫六与土卫八。'
  },
  {
    id: 'uranus-moons',
    cn: '天王星卫星',
    parent: 'uranus',
    radiusScale: 9,
    orbitExponent: 0.55,
    minVisualRadius: 0.08,
    desc: '天王星的五颗主要卫星由 Voyager 2 在 1986 年飞掠时详细拍摄，轨道面几乎垂直于公转面——因为天王星本身"躺着"自转。'
  },
  {
    id: 'neptune-moons',
    cn: '海王星卫星',
    parent: 'neptune',
    radiusScale: 9,
    orbitExponent: 0.55,
    minVisualRadius: 0.08,
    desc: '海卫一是太阳系唯一大型逆行卫星，很可能是被俘获的柯伊伯带天体；海卫八是 Voyager 2 发现的不规则小卫星。'
  }
]

export interface TextureSource {
  /** 发布机构 */
  org: string
  /** 官方产品名（在该机构门户检索） */
  product: string
  /** 许可类型 */
  license: string
  /** 机构门户地址 */
  url: string
  /** 观测波段 */
  band: string
}

/** 贴图级别：A 全球可见光；B 覆盖不全或非可见光；C 无全球影像 */
export type TextureTier = 'A' | 'B' | 'C'

export interface SatelliteDatum {
  id: string
  /** IAU 正式编号，例如 Jupiter I */
  iau: string
  cn: string
  en: string
  parent: SatelliteParent
  systemId: string
  systemCn: string
  /** 真实平均半径（km） */
  radiusKm: number
  /** 真实轨道半长轴（km） */
  semiMajorAxisKm: number
  /** 真实恒星周期（日） */
  periodDays: number
  /** 偏心率 */
  eccentricity: number
  /** 相对行星赤道的轨道倾角（度）；>90 表示逆行 */
  inclinationDeg: number
  /** 几何反照率 */
  albedo: number
  tier: TextureTier
  /** 观测贴图 key（assets/textures/moons/<key>.jpg）；C 级为 null */
  texture: string | null
  /** 场景半径（示意，由 visualRadius 计算） */
  r: number
  /** 场景轨道半径（示意，由 sceneOrbit 计算） */
  orbit: number
  /** 场景公转周期（秒） */
  period: number
  /** 初始相位 */
  phase: number
  /** 轨道线与 C 级底色（由实测反照率映射） */
  color: number
  retrograde: boolean
  desc: string
  highlight?: boolean
  source: TextureSource
}

interface RawSatellite {
  id: string
  iau: string
  cn: string
  en: string
  parent: SatelliteParent
  radiusKm: number
  semiMajorAxisKm: number
  periodDays: number
  eccentricity: number
  inclinationDeg: number
  albedo: number
  /** 观测差值色（用于轨道线与 C 级底色，不是贴图） */
  tint: number
  tier: TextureTier
  texture: string | null
  desc: string
  highlight?: boolean
  source: TextureSource
}

const USGS = (product: string, band = '可见光'): TextureSource => ({
  org: 'USGS Astrogeology Science Center',
  product,
  license: '公有领域（美国政府作品）',
  url: 'https://astrogeology.usgs.gov/search',
  band
})

const NASA_JPL = (product: string, band: string): TextureSource => ({
  org: 'NASA / JPL',
  product,
  license: '公有领域（NASA 影像使用政策）',
  url: 'https://photojournal.jpl.nasa.gov',
  band
})

const RAW: RawSatellite[] = [
  /* ---------------- 火星 ---------------- */
  {
    id: 'phobos', iau: 'Mars I', cn: '火卫一 · 福波斯', en: 'Phobos', parent: 'mars',
    radiusKm: 11.267, semiMajorAxisKm: 9376, periodDays: 0.31891, eccentricity: 0.0151,
    inclinationDeg: 1.093, albedo: 0.071, tint: 0x8d8378, tier: 'B', texture: 'phobos',
    desc: '火星最大的卫星，形状不规则、表面布满沟槽，轨道高度只有约 6000 公里，正缓慢向火星靠近。',
    source: USGS('Phobos Viking Global Mosaic 5m（DLR 控制网）')
  },
  {
    id: 'deimos', iau: 'Mars II', cn: '火卫二 · 得摩斯', en: 'Deimos', parent: 'mars',
    radiusKm: 6.2, semiMajorAxisKm: 23463.2, periodDays: 1.26244, eccentricity: 0.00033,
    inclinationDeg: 0.93, albedo: 0.068, tint: 0x8a8177, tier: 'C', texture: null,
    desc: '火星较小的一颗卫星，表面被细密的风化层覆盖，撞击坑不如火卫一明显。',
    source: NASA_JPL('Viking / MRO 单幅影像（无全球拼图）', '可见光')
  },

  /* ---------------- 木星（伽利略卫星） ---------------- */
  {
    id: 'io', iau: 'Jupiter I', cn: '木卫一 · 艾奥', en: 'Io', parent: 'jupiter',
    radiusKm: 1821.6, semiMajorAxisKm: 421700, periodDays: 1.769138, eccentricity: 0.0041,
    inclinationDeg: 0.036, albedo: 0.63, tint: 0xe8cf76, tier: 'A', texture: 'io',
    desc: '太阳系火山活动最剧烈的天体，硫化物把表面染成黄、橙、白相间的斑驳色块。',
    highlight: true,
    source: USGS('Io Global Mosaic（Voyager / Galileo 影像）')
  },
  {
    id: 'europa', iau: 'Jupiter II', cn: '木卫二 · 欧罗巴', en: 'Europa', parent: 'jupiter',
    radiusKm: 1560.8, semiMajorAxisKm: 671034, periodDays: 3.551181, eccentricity: 0.0094,
    inclinationDeg: 0.466, albedo: 0.67, tint: 0xd8d2c2, tier: 'A', texture: 'europa',
    desc: '冰壳包裹的卫星，纵横的褐色裂纹之下可能存在液态海洋，是人类寻找地外生命环境的重点目标。',
    highlight: true,
    source: USGS('Europa Global Mosaic（Galileo / Voyager 影像）')
  },
  {
    id: 'ganymede', iau: 'Jupiter III', cn: '木卫三 · 盖尼米得', en: 'Ganymede', parent: 'jupiter',
    radiusKm: 2634.1, semiMajorAxisKm: 1070412, periodDays: 7.154553, eccentricity: 0.0013,
    inclinationDeg: 0.177, albedo: 0.43, tint: 0xa89c8a, tier: 'A', texture: 'ganymede',
    desc: '太阳系最大的卫星，比水星还大，也是目前已知唯一拥有自身磁场的卫星。',
    source: USGS('Ganymede Global Mosaic（Voyager / Galileo 影像）')
  },
  {
    id: 'callisto', iau: 'Jupiter IV', cn: '木卫四 · 卡里斯托', en: 'Callisto', parent: 'jupiter',
    radiusKm: 2410.3, semiMajorAxisKm: 1882709, periodDays: 16.689018, eccentricity: 0.0074,
    inclinationDeg: 0.192, albedo: 0.22, tint: 0x6f6659, tier: 'A', texture: 'callisto',
    desc: '太阳系撞击坑最密集的天体之一，古老表面完整记录了早期太阳系的撞击历史。',
    source: USGS('Callisto Global Mosaic（Voyager / Galileo 影像）')
  },

  /* ---------------- 土星（知名且有全球影像的 7 颗） ---------------- */
  {
    id: 'mimas', iau: 'Saturn I', cn: '土卫一 · 弥玛斯', en: 'Mimas', parent: 'saturn',
    radiusKm: 198.2, semiMajorAxisKm: 185539, periodDays: 0.942422, eccentricity: 0.0196,
    inclinationDeg: 1.574, albedo: 0.962, tint: 0xcfcec9, tier: 'A', texture: 'mimas',
    desc: '直径不到 400 公里，却有一个占自身直径三分之一的赫歇尔撞击坑，远看像"死星"。',
    source: USGS('Cassini ISS 全球拼图（USGS 仅有 pictorial map，需重投影）')
  },
  {
    id: 'enceladus', iau: 'Saturn II', cn: '土卫二 · 恩克拉多斯', en: 'Enceladus', parent: 'saturn',
    radiusKm: 252.1, semiMajorAxisKm: 238037, periodDays: 1.370218, eccentricity: 0.0047,
    inclinationDeg: 0.009, albedo: 0.99, tint: 0xeaf3f6, tier: 'A', texture: 'enceladus',
    desc: '几乎全白的冰卫星，南极"虎纹"裂缝持续向太空喷出含盐的水汽羽流，暗示地下海洋。',
    highlight: true,
    source: USGS('Enceladus Cassini Global Mosaic 110m')
  },
  {
    id: 'tethys', iau: 'Saturn III', cn: '土卫三 · 忒堤斯', en: 'Tethys', parent: 'saturn',
    radiusKm: 531.1, semiMajorAxisKm: 294672, periodDays: 1.887802, eccentricity: 0.0001,
    inclinationDeg: 1.091, albedo: 1.229, tint: 0xd9d8d2, tier: 'A', texture: 'tethys',
    desc: '主要由水冰组成，表面有巨大的奥德修斯撞击坑和横贯全球的伊萨卡峡谷。',
    source: USGS('Tethys Cassini Global Mosaic 293m')
  },
  {
    id: 'dione', iau: 'Saturn IV', cn: '土卫四 · 狄俄涅', en: 'Dione', parent: 'saturn',
    radiusKm: 561.4, semiMajorAxisKm: 377415, periodDays: 2.736915, eccentricity: 0.0022,
    inclinationDeg: 0.028, albedo: 0.998, tint: 0xcfcdc6, tier: 'A', texture: 'dione',
    desc: '冰质卫星，表面分布着明亮的冰崖网络，被认为与地壳破裂和冰火山活动有关。',
    source: USGS('Dione Cassini / Voyager Global Mosaic 154m')
  },
  {
    id: 'rhea', iau: 'Saturn V', cn: '土卫五 · 瑞亚', en: 'Rhea', parent: 'saturn',
    radiusKm: 763.8, semiMajorAxisKm: 527068, periodDays: 4.518212, eccentricity: 0.0013,
    inclinationDeg: 0.331, albedo: 0.949, tint: 0xbab7af, tier: 'A', texture: 'rhea',
    desc: '土星第二大卫星，以水冰为主，表面布满明亮的撞击坑。',
    source: USGS('Rhea Cassini / Voyager Global Mosaic 417m')
  },
  {
    id: 'titan', iau: 'Saturn VI', cn: '土卫六 · 泰坦', en: 'Titan', parent: 'saturn',
    radiusKm: 2574.7, semiMajorAxisKm: 1221870, periodDays: 15.945421, eccentricity: 0.0288,
    inclinationDeg: 0.3485, albedo: 0.22, tint: 0xd9a24e, tier: 'B', texture: 'titan',
    desc: '太阳系唯一拥有浓厚大气层的卫星，地表有液态甲烷的湖泊与河流，可见光被雾霾遮蔽。',
    highlight: true,
    source: USGS('Titan Cassini ISS Near-Global Mosaic 450m（缺极区）', '近红外（灰度）')
  },
  {
    id: 'iapetus', iau: 'Saturn VIII', cn: '土卫八 · 伊阿珀托斯', en: 'Iapetus', parent: 'saturn',
    radiusKm: 734.5, semiMajorAxisKm: 3560820, periodDays: 79.3215, eccentricity: 0.0286,
    inclinationDeg: 15.47, albedo: 0.3, tint: 0x8b7f6d, tier: 'A', texture: 'iapetus',
    desc: '两个半球明暗反差极大，一面漆黑一面雪白，还有一道沿赤道隆起的巨大山脊。',
    source: USGS('Iapetus Cassini / Voyager Global Mosaic 803m')
  },

  /* ---------------- 天王星（五颗主要卫星） ---------------- */
  {
    id: 'miranda', iau: 'Uranus V', cn: '天卫五 · 米兰达', en: 'Miranda', parent: 'uranus',
    radiusKm: 235.8, semiMajorAxisKm: 129390, periodDays: 1.413479, eccentricity: 0.0013,
    inclinationDeg: 4.232, albedo: 0.32, tint: 0x9a9a9a, tier: 'B', texture: 'miranda',
    desc: '表面像被打碎后重新拼合：巨大的悬崖维罗纳断崖落差可达 20 公里。',
    source: USGS('Voyager 2 影像（USGS 无等距圆柱拼图，需重投影）', '可见光（部分覆盖）')
  },
  {
    id: 'ariel', iau: 'Uranus I', cn: '天卫一 · 艾瑞尔', en: 'Ariel', parent: 'uranus',
    radiusKm: 578.9, semiMajorAxisKm: 190900, periodDays: 2.520379, eccentricity: 0.0012,
    inclinationDeg: 0.26, albedo: 0.53, tint: 0xc3c3c0, tier: 'B', texture: 'ariel',
    desc: '天王星卫星中表面最年轻的一颗，纵横的峡谷与断层说明它经历过剧烈的地质改造。',
    source: USGS('Voyager 2 影像（USGS 无等距圆柱拼图，需重投影）', '可见光（部分覆盖）')
  },
  {
    id: 'umbriel', iau: 'Uranus II', cn: '天卫二 · 乌姆柏里厄尔', en: 'Umbriel', parent: 'uranus',
    radiusKm: 584.7, semiMajorAxisKm: 266000, periodDays: 4.144177, eccentricity: 0.0039,
    inclinationDeg: 0.128, albedo: 0.21, tint: 0x6e6e6e, tier: 'B', texture: 'umbriel',
    desc: '天王星卫星中最暗的一颗，表面古老而缺乏地质活动，仅有一个明亮的环形结构。',
    source: USGS('Voyager 2 影像（USGS 无等距圆柱拼图，需重投影）', '可见光（部分覆盖）')
  },
  {
    id: 'titania', iau: 'Uranus III', cn: '天卫三 · 泰坦妮亚', en: 'Titania', parent: 'uranus',
    radiusKm: 788.4, semiMajorAxisKm: 436300, periodDays: 8.705872, eccentricity: 0.0011,
    inclinationDeg: 0.34, albedo: 0.27, tint: 0x8e8b86, tier: 'B', texture: 'titania',
    desc: '天王星最大的卫星，表面有巨大的峡谷系统与撞击坑，冰质地壳可能存在微弱活动。',
    source: USGS('Voyager 2 影像（USGS 无等距圆柱拼图，需重投影）', '可见光（部分覆盖）')
  },
  {
    id: 'oberon', iau: 'Uranus IV', cn: '天卫四 · 奥伯龙', en: 'Oberon', parent: 'uranus',
    radiusKm: 761.4, semiMajorAxisKm: 583500, periodDays: 13.463239, eccentricity: 0.0014,
    inclinationDeg: 0.058, albedo: 0.23, tint: 0x807d78, tier: 'B', texture: 'oberon',
    desc: '天王星最外侧的主要卫星，表面古老、撞击坑密集，坑底有暗色物质沉积。',
    source: USGS('Voyager 2 影像（USGS 无等距圆柱拼图，需重投影）', '可见光（部分覆盖）')
  },

  /* ---------------- 海王星 ---------------- */
  {
    id: 'triton', iau: 'Neptune I', cn: '海卫一 · 特里同', en: 'Triton', parent: 'neptune',
    radiusKm: 1353.4, semiMajorAxisKm: 354759, periodDays: 5.876854, eccentricity: 0.000016,
    inclinationDeg: 156.885, albedo: 0.76, tint: 0xd6c8bb, tier: 'B', texture: 'triton',
    desc: '太阳系唯一大型逆行卫星，很可能是被引力俘获的柯伊伯带天体；表面有氮气冰火山喷发。',
    highlight: true,
    source: USGS('Triton Voyager 2 Global Color Mosaic 600m')
  },
  {
    id: 'proteus', iau: 'Neptune VIII', cn: '海卫八 · 普罗透斯', en: 'Proteus', parent: 'neptune',
    radiusKm: 210, semiMajorAxisKm: 117647, periodDays: 1.122315, eccentricity: 0.0005,
    inclinationDeg: 0.075, albedo: 0.096, tint: 0x6a6764, tier: 'C', texture: null,
    desc: '形状不规则的暗色小卫星，已接近能靠自身引力变成球体的尺寸上限。',
    source: NASA_JPL('Voyager 2 单幅影像（无全球拼图）', '可见光')
  }
]

/** 卫星场景半径：同系统统一放大，保留系统内真实半径比 */
export function visualRadius(datum: SatelliteDatum, system: SatelliteSystemDef): number {
  const ratio = datum.radiusKm / PLANET_RADIUS_KM[system.parent]
  return Math.max(PLANET_SCENE_RADIUS[system.parent] * ratio * system.radiusScale, system.minVisualRadius)
}

/** 卫星场景轨道半径：对数幂压缩；有锚点时保证内缘卫星落在光环之外 */
export function sceneOrbit(datum: SatelliteDatum, system: SatelliteSystemDef): number {
  const ratio = datum.semiMajorAxisKm / PLANET_RADIUS_KM[system.parent]
  const planetRadius = PLANET_SCENE_RADIUS[system.parent]
  const p = system.orbitExponent
  if (system.orbitAnchor !== undefined) {
    return planetRadius * (system.orbitAnchor + Math.pow(Math.max(0, ratio - system.orbitAnchor), p))
  }
  return planetRadius * Math.pow(ratio, p)
}

/** 反照率 → 显示基色（仅用于 C 级纯色材质与轨道线，不做任何纹理） */
function albedoColor(albedo: number, tint: number): number {
  const base = new THREE.Color(tint)
  const lift = Math.min(1, 0.35 + 0.75 * albedo)
  base.multiplyScalar(lift)
  return base.getHex()
}

const systemsById = new Map(SATELLITE_SYSTEMS.map((system) => [system.id, system]))
const phaseCursor = new Map<string, number>()

export const MOON_DATUM: SatelliteDatum[] = RAW.map((raw) => {
  const system = systemsById.get(`${raw.parent}-moons`)!
  const index = phaseCursor.get(system.id) ?? 0
  phaseCursor.set(system.id, index + 1)
  const datum: SatelliteDatum = {
    id: raw.id,
    iau: raw.iau,
    cn: raw.cn,
    en: raw.en,
    parent: raw.parent,
    systemId: system.id,
    systemCn: system.cn,
    radiusKm: raw.radiusKm,
    semiMajorAxisKm: raw.semiMajorAxisKm,
    periodDays: raw.periodDays,
    eccentricity: raw.eccentricity,
    inclinationDeg: raw.inclinationDeg,
    albedo: raw.albedo,
    tier: raw.tier,
    texture: raw.texture,
    r: 0,
    orbit: 0,
    period: raw.periodDays * TIME_SCALE_SECONDS_PER_DAY,
    phase: index * 2.399963,
    color: albedoColor(raw.albedo, raw.tint),
    retrograde: raw.inclinationDeg > 90,
    desc: raw.desc,
    highlight: raw.highlight,
    source: raw.source
  }
  datum.r = visualRadius(datum, system)
  datum.orbit = sceneOrbit(datum, system)
  return datum
})

export function satellitesOf(systemId: string): SatelliteDatum[] {
  return MOON_DATUM.filter((moon) => moon.systemId === systemId)
}

export function systemOf(parent: SatelliteParent): SatelliteSystemDef {
  return systemsById.get(`${parent}-moons`)!
}
