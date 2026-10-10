/* ============================================================
   universe/catalog.ts
   教学口径文案表：为每个"可飞达目标"提供中文名、类型与讲解。
   口径依据本课开发文档《3D 天体系统增强》B2「必须更正的 5 处表述」：
   1) 银河系恒星上千亿颗（教材口径"约有一两千亿颗"）；
   2) 太阳绕银河系中心（银心）公转，约 2.3 亿年一周；银心方向有人马座 A*，
      但不可说成"太阳绕黑洞转"；
   3) 河外星系即银河系以外的星系，应表述为"银河系之外还有许多星系"；
   4) 许多恒星都有自己的行星系统（不是"每颗恒星"）；
   5) 卫星绕行星 = 行星系统；行星绕恒星 = 恒星星系（太阳系）。
   ============================================================ */
import { BODIES } from './data'
import { MOON_DATUM } from './moon-systems'
import { HOST_STARS, EXOPLANETS } from './star-systems'
import { GALAXIES } from './galaxies'

export type DestinationKind = 'station' | 'star' | 'planet' | 'satellite' | 'galaxy' | 'group'

export interface DestinationInfo {
  id: string
  cn: string
  kind: DestinationKind
  /** 类型行（页面副标题） */
  sub: string
  desc: string
  meta?: string[]
  /** 标注为拓展观察 */
  extended?: boolean
}

export interface StationInfo {
  id: string
  cn: string
  /** 层级说明（对应教材四级） */
  level: string
  desc: string
  /** 该站特有的操作提示 */
  hint: string
}

export const STATIONS: StationInfo[] = [
  {
    id: 'earth', cn: '地月系', level: '第 4 级 · 行星系统',
    desc: '月球绕地球公转，构成"地月系"——这就是最基础的「卫星绕行星」的行星系统。',
    hint: '点击「木星系 / 土星系」可展开观察，看卫星如何绕木星、土星运行。'
  },
  {
    id: 'solar', cn: '太阳系', level: '第 3 级 · 恒星星系',
    desc: '八颗行星沿各自轨道绕太阳公转。太阳占太阳系总质量的约 99.86%，是以引力维系的中心恒星。',
    hint: '点击任意行星可飞近观察。'
  },
  {
    id: 'stars', cn: '其他恒星行星系', level: '拓展观察 · 行星普遍存在',
    desc: '行星系在银河系中普遍存在：许多恒星都有自己的行星。这里收录 10 颗"已确认存在行星"的真实恒星与 16 颗已确认的系外行星。',
    hint: '把太阳系一路拉远，这些近邻恒星会自然浮现并显示名称，点击恒星本体或标签即可飞近观察；也可点左侧恒星名切换系统。'
  },
  {
    id: 'galaxy', cn: '银河系', level: '第 2 级 · 星系',
    desc: '银河系约有上千亿颗恒星。太阳只是其中一颗，它带着整个太阳系绕银河系中心（银心）运动，约 2.3 亿年一周。',
    hint: '银心方向上有人马座 A*；但要注意：太阳是绕银心公转，不能说成"太阳绕黑洞转"。画面为示意：银盘按整体缓慢自转演示，真实银河系是较差自转（内侧快、外侧慢），旋臂是密度波，太阳还会上下穿过银盘振荡。'
  },
  {
    id: 'galaxies', cn: '河外星系', level: '河外星系 · 与银河系同级别',
    desc: '银河系之外还有许多星系。河外星系就是银河系以外的星系，它们与银河系是同级别的天体系统。',
    hint: '点击任一星系可飞近观察；图中位置与大小经过压缩，并不表示它们同属一个星系群。'
  },
  {
    id: 'universe', cn: '可观测宇宙', level: '第 1 级 · 可观测宇宙',
    desc: '无数星系聚成星系群、星系团，再组成更大尺度的宇宙大尺度结构。',
    hint: '这是独立尺度视图：可观测宇宙是人类观测能力的边界，不是宇宙的边界。'
  }
]

const SOLAR_TEXT: Record<string, string> = {
  sun: '太阳系的中心天体，占太阳系总质量的约 99.86%，是距离地球最近的恒星。',
  mercury: '离太阳最近的行星，几乎没有大气，昼夜温差可达数百摄氏度，表面布满撞击坑。',
  venus: '地球的"姐妹星"，浓厚的二氧化碳大气造成强烈温室效应，是太阳系表面最热的行星。',
  earth: '目前已知唯一存在生命的行星，拥有液态水、适宜的大气成分与温度范围。',
  moon: '地球唯一的天然卫星，绕地球公转周期约 27.3 天，与地球共同构成"地月系"。',
  mars: '红色的沙漠世界，有稀薄大气、极地冰盖和太阳系最高的火山。',
  jupiter: '太阳系最大的行星，一颗气态巨行星；它的四颗伽利略卫星构成"木星系"。',
  saturn: '以壮观光环著称的气态巨行星；土卫六等卫星围绕它运行，构成"土星系"。',
  uranus: '几乎"躺着"自转的冰巨行星，自转轴倾角接近 98°。',
  neptune: '离太阳最远的行星，大气中风速可超过每小时 2000 公里。'
}

const MILKY_WAY: DestinationInfo = {
  id: 'galaxy',
  cn: '银河系',
  kind: 'galaxy',
  sub: '本星系群 / 棒旋星系',
  desc: '银河系约有上千亿颗恒星，直径约 10 万光年。太阳位于银河盘面偏外侧的猎户臂上，绕银心运动约需 2.3 亿年。',
  meta: [
    '恒星数量：上千亿颗',
    '我们的坐标：猎户臂',
    '公转周期：约 2.3 亿年',
    '真实为较差自转（内侧快、外侧慢），非整体刚体旋转',
    '旋臂是密度波，不是固定的物质结构',
    '太阳还上下穿过银盘振荡，周期约 6000 万年'
  ]
}

function build(): Map<string, DestinationInfo> {
  const map = new Map<string, DestinationInfo>()

  for (const station of STATIONS) {
    map.set(`station:${station.id}`, {
      id: station.id, cn: station.cn, kind: 'station', sub: station.level, desc: station.desc, meta: [station.hint]
    })
  }

  for (const body of BODIES) {
    map.set(body.id, {
      id: body.id,
      cn: body.cn,
      kind: body.kind === 'star' ? 'star' : body.kind === 'satellite' ? 'satellite' : 'planet',
      sub: body.id === 'sun' ? '太阳系 / 恒星' : body.id === 'moon' ? '地月系 / 天然卫星' : '太阳系 / 行星',
      desc: SOLAR_TEXT[body.id] ?? ''
    })
  }

  for (const moon of MOON_DATUM) {
    map.set(moon.id, {
      id: moon.id,
      cn: moon.cn,
      kind: 'satellite',
      sub: moon.parent === 'jupiter' ? '木星系 / 卫星' : '土星系 / 卫星',
      desc: moon.desc,
      extended: true
    })
  }

  for (const star of HOST_STARS) {
    map.set(star.id, {
      id: star.id, cn: star.cn, kind: 'star', sub: `银河系 / ${star.spectral}`,
      desc: star.desc, meta: [`距地球：${star.distance}`]
    })
  }
  for (const planet of EXOPLANETS) {
    map.set(planet.id, {
      id: planet.id, cn: planet.cn, kind: 'planet', sub: '已确认系外行星',
      desc: planet.desc, meta: [`半径：${planet.radiusNote}`, `公转周期：${planet.periodNote}`]
    })
  }

  map.set('galaxy', MILKY_WAY)
  for (const galaxy of GALAXIES) {
    map.set(galaxy.id, {
      id: galaxy.id, cn: galaxy.cn, kind: 'galaxy', sub: galaxy.type,
      desc: galaxy.desc,
      meta: [`距地球：${galaxy.distance}`, ...(galaxy.highlight ? [galaxy.highlight] : [])]
    })
  }

  // 木星系 / 土星系整体
  map.set('jupiter-moons', {
    id: 'jupiter-moons', cn: '木星系', kind: 'group', sub: '太阳系内部 / 次级行星系统（拓展观察）',
    desc: '四颗伽利略卫星绕木星公转，构成木星系。它们属于太阳系内部的次级系统，不能与太阳系并列为一级。',
    meta: ['拓展观察 · 轨道与大小非等比示意'], extended: true
  })
  map.set('saturn-moons', {
    id: 'saturn-moons', cn: '土星系', kind: 'group', sub: '太阳系内部 / 次级行星系统（拓展观察）',
    desc: '土卫六（泰坦）等卫星绕土星公转，构成土星系。它们同样属于太阳系内部的次级系统。',
    meta: ['拓展观察 · 轨道与大小非等比示意'], extended: true
  })

  return map
}

export const CATALOG = build()

export function infoOf(id: string): DestinationInfo | undefined {
  return CATALOG.get(id)
}

/** 宇宙尺度独立视图的说明文案（非 3D，可脱离 WebGL 使用） */
export const UNIVERSE_VIEW = {
  title: '可观测宇宙',
  subtitle: '第 1 级天体系统 · 尺度阶梯',
  /** 尺度阶梯：从地球到可观测宇宙 */
  ladder: [
    { cn: '地球', scale: '约 1.3 万公里' },
    { cn: '地月系', scale: '约 38 万公里' },
    { cn: '太阳系', scale: '约 0.001 光年（日地距离 1 天文单位）' },
    { cn: '银河系', scale: '约 10 万光年' },
    { cn: '本星系群', scale: '约 1000 万光年' },
    { cn: '可观测宇宙', scale: '半径约 465 亿光年' }
  ],
  points: [
    '星系聚成星系群、星系团，再组成更大尺度的纤维状结构。',
    '人类目前能观测到的范围直径约 930 亿光年，称为「可观测宇宙」。',
    '可观测宇宙是人类观测能力的边界，不是宇宙的边界 —— 宇宙本身没有已知边界。'
  ],
  caption: '背景：韦布空间望远镜首批深空场图像（SMACS 0723 星系团）'
}
