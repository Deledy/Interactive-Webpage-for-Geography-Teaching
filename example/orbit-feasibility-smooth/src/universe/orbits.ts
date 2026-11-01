/* ============================================================
   universe/orbits.ts
   移植自 ORBIT 项目 src/universe/orbits.js（Apache-2.0）。
   已修改：改写为 TypeScript、补类型标注与注释。
   原始项目：https://github.com/ryh842487118-bot/orbit
   ============================================================ */
import * as THREE from 'three'
import { TAU } from '../core/math'

/** 生成一条闭合轨道线（LineLoop）。tilt 为轨道面倾角（弧度） */
export function makeOrbit(
  radius: number,
  color = 6650253,
  opacity = 0.26,
  tilt = 0
): THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= 256; i++) {
    const a = (i / 256) * TAU
    points.push(
      new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius * Math.sin(tilt), Math.sin(a) * radius * Math.cos(tilt))
    )
  }
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
  )
}
