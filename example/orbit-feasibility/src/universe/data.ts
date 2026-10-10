/* ============================================================
   universe/data.ts
   天体尺度与轨道数据。
   数值移植自 ORBIT 项目 src/universe/catalog.js 的太阳系部分（Apache-2.0），
   已按本项目教学口径补中文名与文字说明。
   原始项目：https://github.com/ryh842487118-bot/orbit

   注意：r 与 orbit 为"视觉调整后的示意值"，非真实天文比例，仅供演示。
   ============================================================ */

export interface BodyDatum {
  id: string
  cn: string
  /** 球体半径（场景单位，示意） */
  r: number
  /** 公转轨道半径（场景单位，示意）；0 表示位于原点（太阳） */
  orbit: number
  /** 公转周期（地球日） */
  period: number
  /** 初始相位（弧度） */
  phase: number
  /** 贴图键名（对应 assets/textures） */
  texture: string
  color: number
  kind: 'star' | 'planet' | 'satellite'
}

export const BODIES: BodyDatum[] = [
  { id: 'sun', cn: '太阳', r: 8, orbit: 0, period: 0, phase: 0, texture: 'sun', color: 16760404, kind: 'star' },
  { id: 'mercury', cn: '水星', r: 0.48, orbit: 22, period: 88, phase: 2.8, texture: 'mercury', color: 12235945, kind: 'planet' },
  { id: 'venus', cn: '金星', r: 0.95, orbit: 32, period: 225, phase: 4.5, texture: 'venus', color: 15254933, kind: 'planet' },
  { id: 'earth', cn: '地球', r: 1, orbit: 45, period: 365.25, phase: 0, texture: 'earth', color: 7583972, kind: 'planet' },
  { id: 'moon', cn: '月球', r: 0.273, orbit: 3.9, period: 27.3, phase: 3.35, texture: 'moon', color: 13027786, kind: 'satellite' },
  { id: 'mars', cn: '火星', r: 0.66, orbit: 65, period: 687, phase: 1.5, texture: 'mars', color: 15114879, kind: 'planet' },
  { id: 'jupiter', cn: '木星', r: 4.1, orbit: 108, period: 4333, phase: 3.8, texture: 'jupiter', color: 14665902, kind: 'planet' },
  { id: 'saturn', cn: '土星', r: 3.45, orbit: 155, period: 10759, phase: 0.7, texture: 'saturn', color: 15127459, kind: 'planet' },
  { id: 'uranus', cn: '天王星', r: 2.15, orbit: 205, period: 30687, phase: 5.35, texture: 'uranus', color: 11001567, kind: 'planet' },
  { id: 'neptune', cn: '海王星', r: 2.08, orbit: 252, period: 60190, phase: 2.5, texture: 'neptune', color: 7180516, kind: 'planet' }
]

/** 月球绕地轨道半径（场景单位） */
export const MOON_ORBIT = 3.9
