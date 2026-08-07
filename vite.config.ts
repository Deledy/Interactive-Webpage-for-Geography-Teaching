import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * 教学互动网页开发工作流 · Vite 配置
 *
 * 架构说明（对齐迁移指南）：
 * - 每节课是一个独立 Vite 工程根（root 指向 lessons/<课题>/），
 *   单课源码放 src/，构建产物输出到该课 dist/，由构建生成、禁止手改。
 * - 单课独立开发：npm run dev 直接打开该课页面；npm run build 产出该课 dist/。
 * - 未来新增课程：为新课单独执行一次构建即可；如需一键多课构建，
 *   可扩展 workflows/ 脚本按各课 lesson.json 循环调用 vite build --root <课>。
 */
export default defineConfig({
  root: 'lessons/地球的宇宙环境',
  base: './',
  resolve: {
    alias: {
      // 单课源码快捷导入（示例：import { $ } from '@/utils/dom'）
      '@': fileURLToPath(new URL('./lessons/地球的宇宙环境/src', import.meta.url))
    }
  },
  build: {
    // 相对 root 解析 → lessons/地球的宇宙环境/dist
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2018',
    // 教学场景投屏与离线分发的需要：单文件大包可接受；
    // 若后续课程体积显著增长，可在此拆分 three 等 vendor chunk。
    chunkSizeWarningLimit: 800
  },
  server: {
    port: 5173,
    open: false
  }
})
