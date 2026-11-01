/* ============================================================
   core/quality.ts
   教室大屏优先的画质策略。

   原则：
   1) 默认 medium，不假设教室电脑有独显；高画质通过 URL 手动开启；
   2) 限制"实际渲染像素数"而不是只看 devicePixelRatio —— 4K 大屏 + 集显是
      最常见的卡顿来源，把它降到 ~1080p 再放大，观感损失很小；
   3) 帧率持续低于阈值时单向降级（high→medium→low），避免来回抖动；
   4) low 档关闭 bloom、只用 1.2 万点、点尺寸更小，保证老集显也能跑。

   用法：`?quality=low|medium|high` 可强制覆盖自动检测。
   ============================================================ */

export type QualityTier = 'low' | 'medium' | 'high'

export interface QualityProfile {
  tier: QualityTier
  label: string
  /** 实际渲染像素上限（渲染分辨率，不是 CSS 尺寸） */
  maxPixels: number
  /** 宇宙网点数上限（几何体只生成一次，用 drawRange 控制） */
  webPoints: number
  /** 银河系 / 河外星系图鉴的点数比例（低档减半，降低填充率与顶点量） */
  atlasScale: number
  /** 光点点尺寸上限（像素） */
  maxPointSize: number
  /** 是否启用 bloom（低档关闭以省填充率） */
  bloom: boolean
  /** 单次滚轮/隧道的目标帧预算，仅用于 UI 提示 */
  targetFps: number
}

const PROFILES: Record<QualityTier, QualityProfile> = {
  low: {
    tier: 'low',
    label: '流畅',
    maxPixels: 1_300_000,
    webPoints: 2_000,
    atlasScale: 0.45,
    maxPointSize: 3.5,
    bloom: false,
    targetFps: 30
  },
  medium: {
    tier: 'medium',
    label: '标准',
    maxPixels: 2_100_000,
    webPoints: 4_000,
    atlasScale: 0.7,
    maxPointSize: 4,
    bloom: true,
    targetFps: 45
  },
  high: {
    tier: 'high',
    label: '高清',
    maxPixels: 3_400_000,
    webPoints: 8_000,
    atlasScale: 1,
    maxPointSize: 5,
    bloom: true,
    targetFps: 60
  }
}

export function profileOf(tier: QualityTier): QualityProfile {
  return PROFILES[tier]
}

export function nextLowerTier(tier: QualityTier): QualityTier | null {
  if (tier === 'high') return 'medium'
  if (tier === 'medium') return 'low'
  return null
}

export function qualityFromUrl(): QualityTier | null {
  try {
    const value = new URLSearchParams(window.location.search).get('quality')
    if (value === 'low' || value === 'medium' || value === 'high') return value
  } catch {
    // ignore
  }
  return null
}

/**
 * 设备初判。注意：集成显卡/大屏默认给 low 或 medium，绝不因为
 * "WebGL2 可用"就当成高配。真正的性能仍由运行时的单向降级兜底。
 */
export function detectQualityTier(
  gl: WebGLRenderingContext | WebGL2RenderingContext
): QualityTier {
  const debug = gl.getExtension('WEBGL_debug_renderer_info')
  const name = debug
    ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) ?? '')
    : ''

  const lowGpu = /intel|uhd|hd graphics|iris|mali|adreno|powervr|swiftshader|llvmpipe|software/i
  const highGpu = /nvidia|geforce|rtx|gtx|radeon rx|radeon pro|apple m\d/i

  const cores = navigator.hardwareConcurrency ?? 4
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4
  const screenPixels =
    window.screen.width * window.screen.height * Math.min(window.devicePixelRatio || 1, 2) ** 2

  // 经典教室/办公机：集显、4 核以内、4G 内存、4K 大屏 → 直接低档
  if (lowGpu.test(name) || cores <= 4 || memory <= 4 || screenPixels > 5_500_000) {
    return 'low'
  }

  // 独显 + 8 核以上 + 屏幕不太大，才允许自动进 high；
  // 其余一律 medium，避免"看起来能跑"但实际只有 20 帧。
  if (highGpu.test(name) && cores >= 8 && screenPixels < 4_000_000) {
    return 'high'
  }

  return 'medium'
}
