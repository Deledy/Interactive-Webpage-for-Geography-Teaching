/* ============================================================
   core/math.ts
   移植自 ORBIT 项目 src/core/math.js（Apache-2.0）。
   已修改：改写为 TypeScript、补类型标注、补充"按种子生成随机序列"的工厂
   （站 5 的每座星系需要互不干扰的固定随机序列）。
   原始项目：https://github.com/ryh842487118-bot/orbit
   ============================================================ */
import * as THREE from 'three'

export const TAU = Math.PI * 2
export const clamp = THREE.MathUtils.clamp
/** 平滑阶跃：x 在 [a, b] 区间内由 0 平滑过渡到 1（用于跨尺度混合） */
export const smooth = (a: number, b: number, x: number): number => THREE.MathUtils.smoothstep(x, a, b)

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
export const mobile = (): boolean => window.innerWidth <= 600

/* 线性同余伪随机（固定种子）——保证每次加载的星点与银河旋臂形态一致 */
let randomSeed = 20260906
export function random(): number {
  randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) | 0
  return (randomSeed >>> 0) / 4294967296
}

/** 近似正态分布（Box-Muller）：用于银河盘面厚度与旋臂散布 */
export function gaussian(): number {
  return Math.sqrt(-2 * Math.log(Math.max(1e-6, random()))) * Math.cos(TAU * random())
}

/** 由字符串/数字种子生成一条独立的伪随机序列（同一 id 每次结果一致） */
export function makeRandom(seed: string | number): () => number {
  let state = 2166136261
  const text = String(seed)
  for (let i = 0; i < text.length; i++) state = Math.imul(state ^ text.charCodeAt(i), 16777619)
  if (typeof seed === 'number') state = (state ^ Math.imul(seed, 2246822519)) | 0
  return (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0
    return (state >>> 0) / 4294967296
  }
}

/** 由外部随机源生成近似正态分布 */
export function gaussianFrom(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(Math.max(1e-7, rand()))) * Math.cos(TAU * rand())
}
