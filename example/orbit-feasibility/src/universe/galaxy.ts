/* ============================================================
   universe/galaxy.ts
   移植自 ORBIT 项目 src/universe/galaxy.js（Apache-2.0）。
   已修改：改写为 TypeScript；拆分出"背景星空"与"银河系点云"两个显式导出；
   并把点云改为挂载到外部传入的**银盘组**（`disk`）下 —— 位置与盘面倾角由该组持有，
   于是"银河盘整体缓慢自转（`disk.rotation.y`）"只需转这一个组，
   太阳随盘被带走也只需复用同一个四元数（见 world.ts）。
   原始项目：https://github.com/ryh842487118-bot/orbit

   验证要点：银河旋臂不是"撒点"，而是按对数螺线 arm * π/2 + ln(r/r0) * 1.8
   生成的四条旋臂 + 中心核球，配合点云着色器形成疏密与色彩变化。
   ============================================================ */
import * as THREE from 'three'
import { random, gaussian, TAU, clamp, mobile } from '../core/math'
import { pointCloud } from '../core/point-cloud'
import { glow } from '../core/glow'

/** 背景星空：以相机为中心的一层球壳星点（半径 11 万单位） */
export function createBackgroundStars(pixels: number): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const pos: number[] = []
  const cols: number[] = []
  const sizes: number[] = []
  for (let i = 0; i < (mobile() ? 4500 : 8000); i++) {
    const a = random() * TAU
    const z = random() * 2 - 1
    const r = Math.sqrt(1 - z * z)
    pos.push(r * Math.cos(a) * 11e4, z * 11e4, r * Math.sin(a) * 11e4)
    const c = new THREE.Color().setHSL(0.53 + random() * 0.17, 0.08 + random() * 0.3, 0.5 + random() * 0.42)
    cols.push(c.r, c.g, c.b)
    sizes.push((random() < 0.035 ? 3 : 1) * (random() * 1.25 + 0.65))
  }
  const stars = pointCloud(pos, cols, sizes, 0, 0.9, pixels)
  stars.frustumCulled = false
  return stars
}

export interface Galaxy {
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>
  /** 太阳系在银河中的位置标记（场景级，位置每帧由 world 写入太阳的世界坐标） */
  solarMarker: THREE.Sprite
}

/** 银河系：核球（19%）+ 四条对数螺线旋臂；点云挂在 `disk` 组下，坐标以银心为原点 */
export function createGalaxy(
  scene: THREE.Scene,
  disk: THREE.Group,
  pixels: number
): Galaxy {
  const gp: number[] = []
  const gc: number[] = []
  const gs: number[] = []
  const num = mobile() ? 36000 : 65000

  for (let i = 0; i < num; i++) {
    const bulge = i < num * 0.19
    let x: number, y: number, z: number, r: number
    if (bulge) {
      r = Math.pow(random(), 1.3) * 4200
      const a = random() * TAU
      x = Math.cos(a) * r
      z = Math.sin(a) * r
      y = gaussian() * 950 * (1 - r / 5000)
    } else {
      r = 1500 + Math.pow(random(), 0.68) * 27000
      const arm = Math.floor(random() * 4)
      const a = (arm * Math.PI) / 2 + Math.log(r / 1600) * 1.8 + gaussian() * 0.16
      x = Math.cos(a) * r + gaussian() * 480
      z = Math.sin(a) * r + gaussian() * 480
      y = gaussian() * (100 + r * 0.012)
    }
    gp.push(x, y, z)
    const mix = clamp(r / 25000, 0, 1)
    const c = new THREE.Color(16767144).lerp(new THREE.Color(8960236), mix)
    if (random() > 0.85) c.set(14411775)
    const power = 0.65 + random() * 1.4
    gc.push(c.r * power, c.g * power, c.b * power)
    gs.push((bulge ? 3 : 2) + random() * 3.5)
  }

  const points = pointCloud(gp, gc, gs, 24000, 0, pixels)
  disk.add(points)

  const solarMarker = glow(10944495, 650, 0.7)
  scene.add(solarMarker)

  return { points, solarMarker }
}
