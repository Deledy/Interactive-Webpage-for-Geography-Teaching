/* ============================================================
   core/renderer.ts
   移植自 ORBIT 项目 src/core/renderer.js（Apache-2.0）。
   已修改：改写为 TypeScript；剥离 EarthSense 观测取景等本项目无关逻辑，
   仅保留"渲染器 + 泛光后处理管线 + 自适应像素比"。
   原始项目：https://github.com/ryh842487118-bot/orbit

   移植要点：logarithmicDepthBuffer 是"从 1 个单位的地球表面到 6.8 万个单位的
   银河系"同处一个场景而不出现深度闪烁（z-fighting）的前提。
   ============================================================ */
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { mobile } from './math'

/** 自适应像素比：按屏幕面积限制总像素量，兼顾画质与移动端负担 */
export function renderPixelRatio({
  width,
  height,
  pixelRatio,
  compact
}: {
  width: number
  height: number
  pixelRatio: number
  compact: boolean
}): number {
  const requested = Math.min(Math.max(pixelRatio, 1.5), compact ? 2 : 2.5)
  return Math.min(requested, Math.max(1, Math.sqrt(6000000 / (width * height))))
}

/** 环境 WebGL 能力探测结果（用于把"为什么跑不起来"讲清楚，而不是笼统报不支持） */
export interface WebGLSupport {
  webgl2: boolean
  webgl1: boolean
  /** 浏览器是否声明 WebGLRenderingContext（缺失常见于被禁用或沙箱环境） */
  hasConstructor: boolean
}

function probeContext(name: 'webgl2' | 'webgl' | 'experimental-webgl'): boolean {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext(name, { failIfMajorPerformanceCaveat: false })
    if (!gl) return false
    // 主动释放：探测会占用一个上下文名额，浏览器同一页面可创建的上下文数量有限
    ;(gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

/** 探测 WebGL2 / WebGL1 的可用性。注意：软件渲染被禁用（如未开启硬件加速）时两者都会失败 */
export function detectWebGLSupport(): WebGLSupport {
  return {
    webgl2: probeContext('webgl2'),
    webgl1: probeContext('webgl') || probeContext('experimental-webgl'),
    hasConstructor: typeof window.WebGLRenderingContext !== 'undefined'
  }
}

/** 探测结果的可读描述（写入页面与 console，便于定位环境问题） */
export function describeSupport(s: WebGLSupport): string {
  return `WebGL2：${s.webgl2 ? '可用' : '不可用'} · WebGL1：${s.webgl1 ? '可用' : '不可用'} · WebGLRenderingContext：${
    s.hasConstructor ? '存在' : '缺失'
  }`
}

/**
 * 创建渲染器。按"约束从紧到松"依次尝试 —— 部分集显 / 远程桌面 / 虚拟机环境
 * 会在 high-performance 或对数深度缓冲下拒绝创建上下文，降一档即可恢复。
 * 全部失败时抛出最后一次的错误，供上层展示具体原因。
 */
export function createRenderer(
  container: HTMLElement,
  onContextLost: () => void
): THREE.WebGLRenderer {
  const attempts: THREE.WebGLRendererParameters[] = [
    { antialias: true, alpha: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance' },
    { antialias: true, alpha: false, logarithmicDepthBuffer: true },
    { antialias: false, alpha: false, logarithmicDepthBuffer: true },
    // 最后兜底：牺牲跨尺度深度精度换取"至少能跑起来"，会在 console 明确警告
    { antialias: false, alpha: false, logarithmicDepthBuffer: false }
  ]

  let renderer: THREE.WebGLRenderer | null = null
  let lastError: unknown = null
  for (let i = 0; i < attempts.length; i++) {
    try {
      renderer = new THREE.WebGLRenderer(attempts[i])
      if (i === attempts.length - 1) {
        console.warn('[orbit-feasibility] 已降级为关闭对数深度缓冲：跨尺度缩放可能出现深度闪烁')
      }
      break
    } catch (e) {
      lastError = e
    }
  }
  if (!renderer) {
    throw lastError instanceof Error ? lastError : new Error('WebGL 上下文创建失败')
  }

  renderer.setClearColor(0x03070d)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.outputColorSpace = THREE.SRGBColorSpace
  container.append(renderer.domElement)
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    onContextLost()
  })
  return renderer
}

/** 泛光后处理管线（渲染 → UnrealBloom → 输出） */
export function createPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
): {
  composer: EffectComposer
  resize: (starFields: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>[]) => number
} {
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.42, 0.65, 1.18)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  for (const target of [composer.renderTarget1, composer.renderTarget2]) {
    target.samples = Math.min(2, renderer.capabilities.maxSamples)
  }

  function resize(starFields: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>[]): number {
    const w = window.innerWidth
    const h = window.innerHeight
    const pixels = renderPixelRatio({ width: w, height: h, pixelRatio: window.devicePixelRatio, compact: mobile() })
    renderer.setPixelRatio(pixels)
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    composer.setPixelRatio(pixels)
    composer.setSize(w, h)
    // 点云着色器里的点尺寸随像素比补偿，避免高分屏星点变小
    for (const stars of starFields) {
      (stars.material.uniforms.uRatio as { value: number }).value = pixels
    }
    return pixels
  }

  return { composer, resize }
}
