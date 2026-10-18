import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * 离线内容编辑器构建配置（独立于课程 Vite 配置）
 *
 * - 入口：shared/quiz/editor/src/index.html
 * - 产物：shared/quiz/editor/build/index.html（单文件，双击可用）
 * - 预览直接引用公共运行时（shared/quiz/runtime），因此结构与真实课程一致
 *
 * 由 `npm run build:editor` 调用；`npm run dev` / 多课构建会先生成产物，
 * 再将 build/index.html 复制进各课 dist/。
 */
export default defineConfig({
  root: fileURLToPath(new URL('./shared/quiz/editor/src', import.meta.url)),
  base: './',
  plugins: [viteSingleFile({ useRecommendedBuildConfig: false })],
  build: {
    outDir: fileURLToPath(new URL('./shared/quiz/editor/build', import.meta.url)),
    emptyOutDir: true,
    target: 'es2018',
    cssCodeSplit: false,
    // 编辑器只依赖代码，不引入字体/图片；放大阈值确保全部内联
    assetsInlineLimit: 1024 * 1024 * 16,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
})
