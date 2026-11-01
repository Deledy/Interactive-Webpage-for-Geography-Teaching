/* ============================================================
   core/glow.ts
   移植自 ORBIT 项目 src/core/glow.js（Apache-2.0）。
   已修改：改写为 TypeScript、补类型标注。
   原始项目：https://github.com/ryh842487118-bot/orbit
   ============================================================ */
import * as THREE from 'three'

/** 程序化生成一张径向渐变贴图，供发光 Sprite 复用（替代外部光晕素材） */
function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.15, 'rgba(255,255,255,.7)')
  g.addColorStop(0.4, 'rgba(255,255,255,.15)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

const glowMap = glowTexture()

/** 生成一个加色发光的 Sprite（太阳光晕、银河中太阳位置标记等） */
export function glow(color: number, size: number, opacity = 1): THREE.Sprite {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowMap,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  )
  s.scale.setScalar(size)
  return s
}
