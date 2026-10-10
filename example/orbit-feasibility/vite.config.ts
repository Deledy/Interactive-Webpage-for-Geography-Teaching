import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * 可行性验证 Demo 的独立 Vite 配置（不接入 lessons/ 主构建流程）。
 *
 * 目标：验证 ORBIT 的关键模块移植后，能否落在本项目"单文件内联 + 大资源外置"
 * 的离线分发形态里。
 *
 * 与根目录 vite.config.ts 的差异：仅 root 指向本目录，构建策略（singlefile、
 * 纹理 base64 内联、assetsDir 置空）保持一致，用于对照验证。
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [viteSingleFile({ useRecommendedBuildConfig: false })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2018',
    chunkSizeWarningLimit: 1600,
    assetsDir: '',
    assetsInlineLimit: (filePath, content) => {
      if (/\.(woff2?|ttf|otf)$/i.test(filePath)) return true
      // WebGL 贴图必须 base64 内联：file:// 下 texImage2D 上传外部图片会被安全策略拦截
      if (/[\\/]textures[\\/].*\.(jpe?g|png)$/i.test(filePath)) return true
      // 宇宙尺度视图的背景图同样内联，保证 dist 单文件离线可用
      if (/universe-deep-field.*\.(jpe?g|png)$/i.test(filePath)) return true
      return content.byteLength < 4 * 1024
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  },
  server: {
    port: 5180,
    open: false
  }
})
