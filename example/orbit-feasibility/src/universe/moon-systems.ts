/* ============================================================
   universe/moon-systems.ts  【新增模块 N1】
   木星系 / 土星系卫星系统 —— ORBIT 原作没有这一层（其 satellites.js 只有人造
   卫星），属于本项目为教学目标新增的内容。

   尺度说明（对应开发文档 E2 的技术难点）：
   木卫轨道半径 / 木星半径 在真实数据里约为 5~20，与"日地距离"完全不是一个量级，
   不能塞进太阳系全局尺度（否则木卫一会被压进行星内部）。因此这里为每个行星系统
   建一个**独立局部坐标系**：卫星组作为行星组的子节点，坐标以该行星为原点，
   仅在"拓展观察"进入时可见 —— 等价于一次"以转场进入局部坐标系"。
   画面位置与大小均为可看性调整，非真实比例。
   ============================================================ */
import * as THREE from 'three'
import { TAU } from '../core/math'
import { makeOrbit } from './orbits'
import { makeRockTexture } from './bodies'

export interface MoonDatum {
  id: string
  cn: string
  /** 所属行星系统 */
  parent: 'jupiter' | 'saturn'
  /** 卫星半径（场景单位，示意） */
  r: number
  /** 绕行轨道半径（局部坐标，示意） */
  orbit: number
  /** 展示用公转周期（秒·模型时间） */
  period: number
  phase: number
  /** 基色 / 程序化贴图底色 */
  color: number
  /** 基色十六进制串（程序化贴图用） */
  base: string
  craters: number
  desc: string
  /** 教学重点（高亮标注） */
  highlight?: boolean
}

export const MOON_DATUM: MoonDatum[] = [
  // ---------- 木星系（伽利略四卫星）----------
  {
    id: 'io', cn: '木卫一 · 艾奥', parent: 'jupiter', r: 1.15, orbit: 9.5, period: 18,
    phase: 0.6, color: 0xf0d97a, base: '#e8d27a', craters: 40,
    desc: '离木星最近的伽利略卫星，太阳系中火山活动最剧烈的天体，表面被硫化物染成黄橙色。'
  },
  {
    id: 'europa', cn: '木卫二 · 欧罗巴', parent: 'jupiter', r: 1.0, orbit: 14.5, period: 30,
    phase: 2.4, color: 0xd9d3c4, base: '#dcd6c6', craters: 12, highlight: true,
    desc: '冰壳包裹的卫星，冰层之下可能存在液态海洋，是人类寻找地外生命环境的重点目标。'
  },
  {
    id: 'ganymede', cn: '木卫三 · 盖尼米得', parent: 'jupiter', r: 1.6, orbit: 20, period: 45,
    phase: 4.2, color: 0xa89c8a, base: '#a89c8a', craters: 150,
    desc: '太阳系中最大的卫星，比水星还大，也是唯一拥有自身磁场的卫星。'
  },
  {
    id: 'callisto', cn: '木卫四 · 卡里斯托', parent: 'jupiter', r: 1.5, orbit: 27, period: 62,
    phase: 5.6, color: 0x6f6659, base: '#6f6659', craters: 220,
    desc: '太阳系中撞击坑最密集的天体之一，古老而布满尘冰的表面记录了早期太阳系的历史。'
  },
  // ---------- 土星系 ----------
  {
    id: 'enceladus', cn: '土卫二 · 恩克拉多斯', parent: 'saturn', r: 0.7, orbit: 12, period: 14,
    phase: 1.2, color: 0xe8f2f5, base: '#eaf3f6', craters: 8, highlight: true,
    desc: '几乎全白的冰卫星，南极的"虎纹"裂缝向太空喷出含盐的水汽羽流，暗示地下海洋。'
  },
  {
    id: 'rhea', cn: '土卫五 · 瑞亚', parent: 'saturn', r: 1.0, orbit: 19, period: 28,
    phase: 3.1, color: 0xb9b6ae, base: '#b9b6ae', craters: 160,
    desc: '土星第二大卫星，以冰为主，表面布满明亮的撞击坑。'
  },
  {
    id: 'titan', cn: '土卫六 · 泰坦', parent: 'saturn', r: 1.7, orbit: 28, period: 46,
    phase: 4.6, color: 0xd9a24e, base: '#d9a24e', craters: 0, highlight: true,
    desc: '太阳系中唯一拥有浓厚大气层的卫星，地表有液态甲烷的湖泊与河流。'
  },
  {
    id: 'iapetus', cn: '土卫八 · 伊阿珀托斯', parent: 'saturn', r: 1.0, orbit: 40, period: 82,
    phase: 0.2, color: 0x8b7f6d, base: '#8b7f6d', craters: 180,
    desc: '两颗半球明暗反差极大，一面漆黑一面雪白，还有一道环绕赤道的巨大山脊。'
  }
]

export interface MoonBody {
  datum: MoonDatum
  group: THREE.Group
  mesh: THREE.Mesh
  /** 局部坐标（相对所属行星） */
  position: THREE.Vector3
}

export interface MoonSystem {
  /** 'jupiter-moons' | 'saturn-moons' */
  id: string
  cn: string
  /** 承载卫星的组，已挂到对应行星组下 */
  root: THREE.Group
  parentId: 'jupiter' | 'saturn'
  moons: MoonBody[]
  /** 系统外缘半径（用于落地取景） */
  extent: number
  visible: boolean
}

export interface MoonSystems {
  systems: MoonSystem[]
  byId: Map<string, MoonSystem>
  moons: Map<string, MoonBody>
  update: (dt: number, state: { paused: boolean; speed: number }) => void
  setVisibility: (visibleIds: Set<string> | null) => void
}

export function createMoonSystems(
  solar: { bodies: Map<string, { group: THREE.Object3D; r: number }> }
): MoonSystems {
  const systems: MoonSystem[] = []
  const byId = new Map<string, MoonSystem>()
  const moons = new Map<string, MoonBody>()
  const sphere = new THREE.SphereGeometry(1, 48, 32)

  for (const parentId of ['jupiter', 'saturn'] as const) {
    const host = solar.bodies.get(parentId)
    if (!host) continue
    const root = new THREE.Group()
    root.name = `${parentId}-moons`
    root.visible = false
    host.group.add(root)

    const list = MOON_DATUM.filter((m) => m.parent === parentId)
    const moonBodies: MoonBody[] = []
    let extent = 0

    for (const datum of list) {
      const group = new THREE.Group()
      root.add(group)
      const mat = new THREE.MeshPhongMaterial({
        map: makeRockTexture(datum.base, datum.craters, 46),
        shininess: 6,
        specular: 0x111111
      })
      const mesh = new THREE.Mesh(sphere, mat)
      mesh.scale.setScalar(datum.r)
      mesh.userData.bodyId = datum.id // 供鼠标点击拾取
      group.add(mesh)

      const ring = makeOrbit(datum.orbit, datum.color, 0.22, 0.05)
      ring.userData.baseOpacity = ring.material.opacity
      root.add(ring)

      moonBodies.push({ datum, group, mesh, position: group.position })
      moons.set(datum.id, moonBodies[moonBodies.length - 1])
      extent = Math.max(extent, datum.orbit)
    }

    const system: MoonSystem = {
      id: `${parentId}-moons`,
      cn: parentId === 'jupiter' ? '木星系（拓展观察）' : '土星系（拓展观察）',
      root,
      parentId,
      moons: moonBodies,
      extent,
      visible: false
    }
    systems.push(system)
    byId.set(system.id, system)
  }

  let simTime = 0

  function update(dt: number, state: { paused: boolean; speed: number }): void {
    if (!state.paused) simTime += dt * state.speed
    for (const system of systems) {
      if (!system.visible) continue
      for (const moon of system.moons) {
        const { datum } = moon
        const a = datum.phase + (simTime * TAU) / datum.period
        moon.position.set(Math.cos(a) * datum.orbit, Math.sin(a) * datum.orbit * 0.05, Math.sin(a) * datum.orbit)
        if (!state.paused) moon.mesh.rotation.y += dt * state.speed * 0.05
      }
    }
  }

  function setVisibility(visibleIds: Set<string> | null): void {
    for (const system of systems) {
      const next = visibleIds ? visibleIds.has(system.id) : false
      system.visible = next
      system.root.visible = next
    }
  }

  return { systems, byId, moons, update, setVisibility }
}
