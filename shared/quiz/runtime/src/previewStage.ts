/* ============================================================
   预览画布（1920 × 1080）
   ------------------------------------------------------------
   编辑器整窗预览的载体：内部按设计尺寸排版，整体等比缩放。

   - 只负责「画布 + 缩放」，窗口本身由 openPracticeWindow 以
     display:'embedded' 挂到 stage.mount；
   - 不依赖任何单课样式，颜色走 --pw-* 令牌；
   - 无 ResizeObserver 的环境（如测试）退化为一次性计算，
     不报错。

   详见 shared/quiz/docs/2026-10-17-quiz-card-wysiwyg-design.md §7.3。
   ============================================================ */
import '../styles/previewStage.css'

export interface PreviewStageOptions {
  /** 设计宽度（默认 1920） */
  width?: number
  /** 设计高度（默认 1080） */
  height?: number
  /** 初始缩放：'fit' 适应宽度，或具体倍数（1 = 100%） */
  zoom?: 'fit' | number
  /** 画布背景（CSS background 值）；缺省使用课程深色底 */
  background?: string
  /** --pw-* 令牌覆盖（本课配色表） */
  theme?: Record<string, string>
}

export interface PreviewStage {
  readonly root: HTMLElement
  readonly canvas: HTMLElement
  /** 嵌入窗口挂载点（position: relative） */
  readonly mount: HTMLElement
  setZoom(zoom: 'fit' | number): void
  destroy(): void
}

export function createPreviewStage(options: PreviewStageOptions = {}): PreviewStage {
  const width = options.width ?? 1920
  const height = options.height ?? 1080

  const root = document.createElement('div')
  root.className = 'pq-stage'

  const canvas = document.createElement('div')
  canvas.className = 'pq-canvas'
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const mount = document.createElement('div')
  mount.className = 'pq-mount'

  canvas.appendChild(mount)
  root.appendChild(canvas)

  if (options.background) root.style.background = options.background
  if (options.theme) {
    for (const [name, value] of Object.entries(options.theme)) {
      if (name.startsWith('--')) canvas.style.setProperty(name, value)
    }
  }

  let scale = 1
  let resizeObserver: ResizeObserver | null = null

  function apply(): void {
    canvas.style.transform = `scale(${scale})`
    root.style.height = `${height * scale}px`
  }

  function setZoom(zoom: 'fit' | number): void {
    const fit = zoom === 'fit'
    root.style.overflow = fit ? 'hidden' : 'auto'
    const available = root.clientWidth
    scale = fit ? (available > 0 ? available / width : 1) : zoom
    apply()
  }

  const initial = options.zoom ?? 'fit'
  setZoom(initial)

  if (initial === 'fit' && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => setZoom('fit'))
    resizeObserver.observe(root)
  }

  return {
    root,
    canvas,
    mount,
    setZoom,
    destroy: () => {
      resizeObserver?.disconnect()
      resizeObserver = null
      root.remove()
    }
  }
}
