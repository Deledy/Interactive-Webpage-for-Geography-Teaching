/* ============================================================
   universe/star-systems.ts  【站 3：其他恒星行星系】
   数据移植自 ORBIT 项目 src/universe/deep-space-catalog.js 与 observed-stars.js
   （Apache-2.0）；随后本项目**扩充**为一组"已确认存在行星"的真实恒星系统。
   原作中 4 颗明确标注为"虚构/示意"的巨行星（仙女巨行星·示意 等）已按教学口径剔除。

   收录原则：只收录**目前已确认存在行星**的恒星，且其行星均为已确认目标；
   表面颜色为程序化艺术示意，不代表真实地貌。
   事实来源：NASA Exoplanet Archive、ESO / NASA 官方发布等
   （搬入主项目时须登记到该课 docs/06_资源引用.md）。
   原始项目：https://github.com/ryh842487118-bot/orbit

   教学点：行星系在银河系中普遍存在（"许多"恒星都有自己的行星系统，而非"每颗"）。
   可见性为**距离驱动**（移植 ORBIT）：从太阳系一路缩放拉远，近邻恒星会自然浮现、
   出现名称标签，并可点击飞达——不是靠按钮"跳站"。
   ============================================================ */
import * as THREE from 'three'
import { TAU, clamp } from '../core/math'
import { createAtmosphereMaterial, createSurfaceMaterial, haloTexture, orbitRingPoints, seedFromId } from './procedural'

export interface HostStar {
  id: string
  cn: string
  position: [number, number, number]
  r: number
  color: number
  surfaceStyle: 'red-star' | 'blue-star' | 'gold-star'
  spectral: string
  distance: string
  desc: string
}

export interface ExoPlanet {
  id: string
  cn: string
  parentStarId: string
  r: number
  orbitRadius: number
  orbitalPeriod: number
  phase: number
  color: number
  surfaceStyle: 'rocky-world' | 'temperate-world' | 'ice-world' | 'gas-giant'
  radiusNote: string
  periodNote: string
  desc: string
}

/* ---------------- 数据：10 颗"已确认存在行星"的真实恒星 + 16 颗已确认系外行星 ----------------
   坐标（position）为**非等比示意**：真实距离被压缩到太阳附近数千～上万单位，
   以便"从太阳系拉远即可看到近邻恒星"；真实距离见 distance 字段。 */

export const HOST_STARS: HostStar[] = [
  {
    id: 'proxima-centauri', cn: '比邻星', position: [-3100, -120, 1800], r: 6,
    color: 0xff7752, surfaceStyle: 'red-star', spectral: 'M 型红矮星', distance: '约 4.25 光年',
    desc: '除太阳外离我们最近的恒星，是南门二三合星系统的成员。它身边已确认有一颗行星（比邻星 b）。'
  },
  {
    id: 'trappist-1', cn: 'TRAPPIST-1', position: [4800, -330, -7000], r: 5.5,
    color: 0xff845e, surfaceStyle: 'red-star', spectral: '超冷红矮星', distance: '约 40 光年',
    desc: '一颗拥有七颗地球大小行星的红矮星。本模块开放其中已确认的 e、f、g 三颗，观察行星如何绕恒星公转。'
  },
  {
    id: 'kepler-186', cn: '开普勒-186', position: [-9000, 920, 9200], r: 7,
    color: 0xffa378, surfaceStyle: 'red-star', spectral: 'M 型红矮星', distance: '约 580 光年',
    desc: '天鹅座方向的一颗红矮星。开普勒望远镜通过行星凌星造成的微弱变暗发现了它的行星家族，其中 f 是首颗近地球大小的宜居带行星。'
  },
  {
    id: 'kepler-22', cn: '开普勒-22', position: [-7200, 650, 10200], r: 9.5,
    color: 0xffdfad, surfaceStyle: 'gold-star', spectral: 'G 型类太阳恒星', distance: '约 640 光年',
    desc: '与太阳同属 G 型的一颗恒星，比太阳略小略冷。它的行星 b 是开普勒任务确认的第一颗位于宜居带内的行星。'
  },
  {
    id: 'hr8799', cn: 'HR 8799', position: [-11000, 750, -4300], r: 9,
    color: 0xffe4b9, surfaceStyle: 'gold-star', spectral: 'A 型主序星', distance: '约 130 光年',
    desc: '周围有四颗巨大系外行星，是人类首次通过直接成像拍摄到多行星系统的恒星，四颗行星依次绕其公转。'
  },
  // ---------- 以下为扩充：目前已知存在行星、且离我们较近或具标志意义的恒星 ----------
  {
    id: 'barnard-star', cn: '巴纳德星', position: [-3900, 260, -1500], r: 5.5,
    color: 0xff7654, surfaceStyle: 'red-star', spectral: 'M 型红矮星', distance: '约 6 光年',
    desc: '蛇夫座方向的一颗暗弱红矮星，是除太阳外离我们最近的**单颗**恒星。2024 年在其周围确认了亚地球质量的行星「巴纳德星 b」。'
  },
  {
    id: 'teegardens-star', cn: '蒂加登星', position: [-2200, 420, 4600], r: 4,
    color: 0xff8a63, surfaceStyle: 'red-star', spectral: 'M 型超冷红矮星', distance: '约 12.5 光年',
    desc: '一颗很小的超冷红矮星，直径不足太阳的六分之一。它已确认至少两颗接近地球质量的行星，且都落在宜居带内。'
  },
  {
    id: 'epsilon-eridani', cn: '天苑四', position: [3400, -380, -2900], r: 8,
    color: 0xffbe81, surfaceStyle: 'gold-star', spectral: 'K 型橙矮星', distance: '约 10.5 光年',
    desc: '波江座的一颗橙色恒星，大小与温度都与太阳相近，周围还环绕着尘埃盘。已确认一颗与木星类似的气态巨行星「天苑四 b」。'
  },
  {
    id: '51-pegasi', cn: '飞马座 51', position: [7600, 520, 4200], r: 10.5,
    color: 0xffe5b2, surfaceStyle: 'gold-star', spectral: 'G 型类太阳恒星', distance: '约 50 光年',
    desc: '1995 年，天文学家在这里发现了第一颗围绕类太阳恒星运行的系外行星「飞马座 51 b」，从此打开了系外行星研究的大门。'
  },
  {
    id: 'kepler-452', cn: '开普勒-452', position: [-4200, -880, -13800], r: 11,
    color: 0xffe2a8, surfaceStyle: 'gold-star', spectral: 'G 型类太阳恒星', distance: '约 1400 光年',
    desc: '天鹅座方向、与太阳同属 G 型的一颗恒星，比太阳略大也略老。它的行星「开普勒-452 b」位于宜居带内，被称为地球的"大表哥"。'
  }
]

export const EXOPLANETS: ExoPlanet[] = [
  {
    id: 'proxima-centauri-b', cn: '比邻星 b', parentStarId: 'proxima-centauri',
    r: 2.6, orbitRadius: 46, orbitalPeriod: 55, phase: 1.1, color: 0xb99479,
    surfaceStyle: 'rocky-world', radiusNote: '约 1.1 地球半径', periodNote: '约 11.2 天',
    desc: '比邻星 b 通过母星被引力牵动产生的径向速度变化被发现。它离母星很近，是否具有大气仍待研究。'
  },
  {
    id: 'trappist-1-e', cn: 'TRAPPIST-1 e', parentStarId: 'trappist-1',
    r: 2.4, orbitRadius: 52, orbitalPeriod: 58, phase: 0.65, color: 0x7ca4aa,
    surfaceStyle: 'temperate-world', radiusNote: '约 0.92 地球半径', periodNote: '约 6.1 天',
    desc: '略小于地球的一颗岩石行星，位于宜居带内，是这套系统中最受关注的世界之一。'
  },
  {
    id: 'trappist-1-f', cn: 'TRAPPIST-1 f', parentStarId: 'trappist-1',
    r: 2.65, orbitRadius: 72, orbitalPeriod: 82, phase: 2.8, color: 0xa8c4cb,
    surfaceStyle: 'ice-world', radiusNote: '约 1.05 地球半径', periodNote: '约 9.2 天',
    desc: '比 e 更靠外的一颗行星，大小与地球接近，可能含有较多水冰成分。'
  },
  {
    id: 'trappist-1-g', cn: 'TRAPPIST-1 g', parentStarId: 'trappist-1',
    r: 2.8, orbitRadius: 96, orbitalPeriod: 106, phase: 4.6, color: 0xc3c5df,
    surfaceStyle: 'ice-world', radiusNote: '约 1.13 地球半径', periodNote: '约 12.4 天',
    desc: '半径略大于地球的 g 行星，位于这套行星家族的外侧。'
  },
  {
    id: 'kepler-186-f', cn: '开普勒-186 f', parentStarId: 'kepler-186',
    r: 2.8, orbitRadius: 65, orbitalPeriod: 120, phase: 1.85, color: 0xba8675,
    surfaceStyle: 'rocky-world', radiusNote: '约 1.17 地球半径', periodNote: '约 129.9 天',
    desc: '2014 年公布的近地球大小行星，是开普勒任务在宜居带内发现的重要目标之一。'
  },
  {
    id: 'kepler-22-b', cn: '开普勒-22 b', parentStarId: 'kepler-22',
    r: 3.8, orbitRadius: 90, orbitalPeriod: 150, phase: 3.9, color: 0x70a9ba,
    surfaceStyle: 'temperate-world', radiusNote: '约 2.1 地球半径', periodNote: '约 289.9 天',
    desc: '2011 年确认的"超级地球"，环绕类太阳恒星运行，公转一周不到 300 天。'
  },
  {
    id: 'hr8799-b', cn: 'HR 8799 b', parentStarId: 'hr8799',
    r: 3.5, orbitRadius: 90, orbitalPeriod: 160, phase: 0.7, color: 0xe5af8b,
    surfaceStyle: 'gas-giant', radiusNote: '约 7 木星质量', periodNote: '约 466 年',
    desc: 'HR 8799 系统中已知最外侧的巨行星，通过直接成像被发现。'
  },
  {
    id: 'hr8799-c', cn: 'HR 8799 c', parentStarId: 'hr8799',
    r: 3.8, orbitRadius: 75, orbitalPeriod: 125, phase: 2.3, color: 0xd8906e,
    surfaceStyle: 'gas-giant', radiusNote: '约 10 木星质量', periodNote: '约 189 年',
    desc: '位于 b 内侧的巨行星，2008 年公布发现，同样由直接成像拍到。'
  },
  {
    id: 'hr8799-d', cn: 'HR 8799 d', parentStarId: 'hr8799',
    r: 3.7, orbitRadius: 60, orbitalPeriod: 95, phase: 4.1, color: 0xc4a7d9,
    surfaceStyle: 'gas-giant', radiusNote: '约 10 木星质量', periodNote: '约 101 年',
    desc: '四颗已知巨行星中的内侧成员之一，绕恒星一周约需一个世纪。'
  },
  {
    id: 'hr8799-e', cn: 'HR 8799 e', parentStarId: 'hr8799',
    r: 3.6, orbitRadius: 45, orbitalPeriod: 65, phase: 5.5, color: 0xe4c88e,
    surfaceStyle: 'gas-giant', radiusNote: '约 10 木星质量', periodNote: '约 57 年',
    desc: '最靠近恒星的已知成员，2010 年公布发现。'
  },
  // ---------- 扩充恒星的行星（均已在 NASA Exoplanet Archive 确认） ----------
  {
    id: 'barnard-star-b', cn: '巴纳德星 b', parentStarId: 'barnard-star',
    r: 1.8, orbitRadius: 34, orbitalPeriod: 24, phase: 0.8, color: 0x9a8b78,
    surfaceStyle: 'rocky-world', radiusNote: '至少约 0.3 地球质量（亚地球）', periodNote: '约 3.15 天',
    desc: '2024 年由 ESO 甚大望远镜确认的亚地球质量行星，是已知最轻的系外行星之一。它离母星极近，表面可能被强烈辐射烘烤。'
  },
  {
    id: 'teegardens-star-b', cn: '蒂加登星 b', parentStarId: 'teegardens-star',
    r: 2.2, orbitRadius: 40, orbitalPeriod: 34, phase: 1.6, color: 0x86a894,
    surfaceStyle: 'temperate-world', radiusNote: '约 1.05 地球质量', periodNote: '约 4.9 天',
    desc: '一颗接近地球质量的行星，从母星获得的能量略多于地球从太阳获得的能量，位于宜居带内侧。'
  },
  {
    id: 'teegardens-star-c', cn: '蒂加登星 c', parentStarId: 'teegardens-star',
    r: 2.3, orbitRadius: 62, orbitalPeriod: 52, phase: 3.5, color: 0x8fb3a6,
    surfaceStyle: 'temperate-world', radiusNote: '约 1.11 地球质量', periodNote: '约 11.4 天',
    desc: '与 b 同处宜居带的另一颗近地球质量行星，公转周期约 11.4 天，同样是靠恒星被行星牵动的微小摆动被发现的。'
  },
  {
    id: 'epsilon-eridani-b', cn: '天苑四 b', parentStarId: 'epsilon-eridani',
    r: 4.2, orbitRadius: 118, orbitalPeriod: 170, phase: 2.2, color: 0xd39a6d,
    surfaceStyle: 'gas-giant', radiusNote: '约 1 木星质量的量级', periodNote: '约 7.4 年',
    desc: '一颗与木星十分相似的气态巨行星，绕天苑四运行，是离我们最近的已知巨行星系统之一。'
  },
  {
    id: '51-pegasi-b', cn: '飞马座 51 b', parentStarId: '51-pegasi',
    r: 4.6, orbitRadius: 58, orbitalPeriod: 40, phase: 4.4, color: 0xc98a62,
    surfaceStyle: 'gas-giant', radiusNote: '约 0.5 木星质量（热木星）', periodNote: '约 4.2 天',
    desc: '1995 年发现的第一颗围绕类太阳恒星的系外行星，开启了系外行星研究的新领域（相关成果获 2019 年诺贝尔物理学奖）。'
  },
  {
    id: 'kepler-452-b', cn: '开普勒-452 b', parentStarId: 'kepler-452',
    r: 3.4, orbitRadius: 108, orbitalPeriod: 165, phase: 5.0, color: 0x8fb98f,
    surfaceStyle: 'temperate-world', radiusNote: '约 1.6 地球半径', periodNote: '约 385 天',
    desc: '2015 年公布的"超级地球"，位于类太阳恒星的宜居带内，公转一周约 385 天，被称为地球的"大表哥"。'
  }
]

/* ---------------- 场景构建 ---------------- */

/** 宿主恒星 id 集合 / 系外行星 → 宿主恒星 映射（供可见性判定使用） */
const HOST_STAR_IDS = new Set(HOST_STARS.map((star) => star.id))
const EXOPLANET_HOST = new Map(EXOPLANETS.map((planet) => [planet.id, planet.parentStarId]))

export interface StarBody {
  id: string
  kind: 'star' | 'planet'
  cn: string
  r: number
  position: THREE.Vector3
  group: THREE.Group
  mesh: THREE.Mesh
  atmosphere?: THREE.Mesh
  halo?: THREE.Sprite
  parentStarId?: string
}

export interface StarSystems {
  root: THREE.Group
  bodies: Map<string, StarBody>
  hosts: HostStar[]
  planets: ExoPlanet[]
  /** 宿主恒星 → 最外行星轨道半径（用于落地取景） */
  maxOrbitOf: (hostId: string) => number
  update: (dt: number, state: { paused: boolean; speed: number }) => void
  updateVisibility: (camera: THREE.PerspectiveCamera, targetId: string, stage: string) => void
  dispose: () => void
}

interface OrbitSystem {
  planet: StarBody
  host: StarBody
  line: THREE.LineLoop
  radius: number
  inclination: number
  period: number
  phase: number
}

export function createStarSystems(scene: THREE.Scene): StarSystems {
  const root = new THREE.Group()
  root.name = 'star-systems'
  scene.add(root)

  const bodies = new Map<string, StarBody>()
  const sphere = new THREE.SphereGeometry(1, 80, 48)
  const haloMap = haloTexture()
  const ringGeometry = new THREE.BufferGeometry().setFromPoints(orbitRingPoints())
  const orbitSystems: OrbitSystem[] = []
  let time = 0
  // 世界坐标暂存：点的坐标是"以太阳为原点"的相对坐标，root 会随太阳移动（见 world.ts），
  // 因此判定"相机到某天体的距离"时必须加上 root 的偏移。
  const worldPos = new THREE.Vector3()

  const maxOrbit = new Map<string, number>()
  for (const planet of EXOPLANETS) {
    maxOrbit.set(planet.parentStarId, Math.max(maxOrbit.get(planet.parentStarId) ?? 0, planet.orbitRadius))
  }

  for (const host of HOST_STARS) {
    const seed = seedFromId(host.id)
    const group = new THREE.Group()
    group.name = host.id
    group.position.fromArray(host.position)
    root.add(group)

    const spec = { id: host.id, kind: 'star' as const, r: host.r, color: host.color, surfaceStyle: host.surfaceStyle }
    const mesh = new THREE.Mesh(sphere, createSurfaceMaterial(spec, seed))
    mesh.name = `${host.id}-surface`
    mesh.scale.setScalar(host.r)
    mesh.rotation.set(0, seed * TAU, 0)
    mesh.userData.bodyId = host.id // 供鼠标点击拾取
    group.add(mesh)

    const atmosphere = new THREE.Mesh(sphere, createAtmosphereMaterial(spec, seed))
    atmosphere.scale.setScalar(host.r * (host.surfaceStyle === 'blue-star' ? 1.03 : 1.065))
    group.add(atmosphere)

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloMap,
        color: host.color,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    )
    halo.scale.setScalar(host.r * 5.1)
    group.add(halo)

    bodies.set(host.id, {
      id: host.id, kind: 'star', cn: host.cn, r: host.r, position: group.position,
      group, mesh, atmosphere, halo
    })
  }

  for (const planet of EXOPLANETS) {
    const host = bodies.get(planet.parentStarId)
    if (!host) continue
    const seed = seedFromId(planet.id)
    const group = new THREE.Group()
    group.name = planet.id
    root.add(group)

    const spec = {
      id: planet.id, kind: 'planet' as const, r: planet.r, color: planet.color, surfaceStyle: planet.surfaceStyle
    }
    const mesh = new THREE.Mesh(sphere, createSurfaceMaterial(spec, seed))
    mesh.name = `${planet.id}-surface`
    mesh.scale.setScalar(planet.r)
    mesh.rotation.set(0, seed * TAU, 0.1 + seed * 0.24)
    mesh.userData.bodyId = planet.id // 供鼠标点击拾取
    group.add(mesh)

    const atmosphere = new THREE.Mesh(sphere, createAtmosphereMaterial(spec, seed))
    atmosphere.scale.setScalar(planet.r * 1.035)
    group.add(atmosphere)

    const body: StarBody = {
      id: planet.id, kind: 'planet', cn: planet.cn, r: planet.r, position: group.position,
      group, mesh, atmosphere, parentStarId: host.id
    }
    bodies.set(planet.id, body)

    const inclination = 0.06 + seed * 0.15
    const line = new THREE.LineLoop(
      ringGeometry,
      new THREE.LineBasicMaterial({ color: planet.color, transparent: true, opacity: 0.15, depthWrite: false })
    )
    line.rotation.x = inclination
    line.scale.setScalar(planet.orbitRadius)
    line.userData.baseOpacity = 0.15
    line.position.copy(host.position)
    root.add(line)

    const lightColor = new THREE.Color(host.mesh.material instanceof THREE.ShaderMaterial
      ? (host.mesh.material.uniforms.uColor.value as THREE.Color)
      : new THREE.Color(0xffffff)).lerp(new THREE.Color(0xffffff), 0.72)
    const planetMat = body.mesh.material as THREE.ShaderMaterial
    ;(planetMat.uniforms.uLightColor.value as THREE.Color).copy(lightColor)

    orbitSystems.push({
      planet: body, host, line, radius: planet.orbitRadius, inclination,
      period: Math.max(1, planet.orbitalPeriod), phase: planet.phase
    })
  }

  function updatePositions(): void {
    for (const system of orbitSystems) {
      const { planet, host, line, radius, inclination, period, phase } = system
      const angle = phase + ((time % period) / period) * TAU
      planet.position
        .set(
          Math.cos(angle) * radius,
          -Math.sin(angle) * radius * Math.sin(inclination),
          Math.sin(angle) * radius * Math.cos(inclination)
        )
        .add(host.position)
      line.position.copy(host.position)
      const lightDirection = (planet.mesh.material as THREE.ShaderMaterial).uniforms.uLightDirection.value as THREE.Vector3
      lightDirection.subVectors(host.position, planet.position).normalize()
      const atmosphereMaterial = planet.atmosphere?.material as THREE.ShaderMaterial | undefined
      atmosphereMaterial?.uniforms.uLightDirection.value.copy(lightDirection)
    }
  }

  function update(dt: number, state: { paused: boolean; speed: number }): void {
    if (!state.paused) time += dt * state.speed
    for (const body of bodies.values()) {
      const mat = body.mesh.material as THREE.ShaderMaterial
      mat.uniforms.uTime.value = time
      const atm = body.atmosphere?.material as THREE.ShaderMaterial | undefined
      if (atm) atm.uniforms.uTime.value = time
      if (!state.paused) body.mesh.rotation.y += dt * state.speed * (body.kind === 'star' ? 0.012 : 0.036)
    }
    updatePositions()
  }

  function updateVisibility(camera: THREE.PerspectiveCamera, targetId: string, _stage: string): void {
    // 焦点若是某颗宿主恒星或其系外行星，就锁定该恒星系统（用于"点到哪、系统就停在哪"）
    const focusedHost = HOST_STAR_IDS.has(targetId)
      ? targetId
      : (EXOPLANET_HOST.get(targetId) ?? null)

    for (const body of bodies.values()) {
      const distance = camera.position.distanceTo(worldPos.copy(body.position).add(root.position))
      // **距离驱动**（移植 ORBIT）：靠近到 body.r × 900（恒星）/ × 320（行星）即显形，
      // 不再按"层级"开关。于是从太阳系一路缩放拉远，比邻星、巴纳德星等近邻恒星会自然
      // 浮现并可被点击飞达；反之拉近到行星附近时，远处恒星自动隐去。
      const threshold = body.r * (body.kind === 'star' ? 900 : 320)
      const inSystem = body.id === focusedHost || body.parentStarId === focusedHost
      const visible = body.id === targetId || distance < threshold || (inSystem && distance < threshold * 1.8)
      body.group.visible = visible
      if (!visible) continue
      if (body.atmosphere) body.atmosphere.visible = distance < body.r * 120
      if (body.halo) {
        body.halo.material.opacity = 0.24 * clamp(distance / (body.r * 3), 0, 1)
      }
    }
    for (const system of orbitSystems) {
      const distance = camera.position.distanceTo(worldPos.copy(system.host.position).add(root.position))
      const isFocusSystem = system.host.id === focusedHost
      system.line.visible = distance < system.radius * 9 && (isFocusSystem || !focusedHost)
      const lineMaterial = system.line.material as THREE.LineBasicMaterial
      lineMaterial.opacity =
        (system.planet.id === targetId ? 0.26 : 0.14) * (1 - THREE.MathUtils.smoothstep(distance, system.radius * 5, system.radius * 9))
    }
  }

  function dispose(): void {
    root.removeFromParent()
    sphere.dispose()
    ringGeometry.dispose()
    haloMap.dispose()
    root.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose())
    })
  }

  updatePositions()

  return {
    root,
    bodies,
    hosts: HOST_STARS,
    planets: EXOPLANETS,
    maxOrbitOf: (hostId: string) => maxOrbit.get(hostId) ?? 40,
    update,
    updateVisibility,
    dispose
  }
}
