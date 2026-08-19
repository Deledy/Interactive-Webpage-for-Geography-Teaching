import { fileURLToPath, URL } from 'node:url'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

/**
 * 教学互动网页开发工作流 · Vite 配置
 *
 * 架构说明：
 * - 课程目录通过环境变量 VITE_LESSON 指定（课程目录名）；未指定时自动选择 lessons/ 下
 *   唯一课程，保证 `npm run dev` / `npm run build` 无需额外参数即可工作。
 * - 单课独立开发：npm run dev 直接打开该课页面；npm run build 产出该课 dist/。
 * - 多课构建：`npm run build:all` / `npm run build:lesson -- --lesson=<课>` 由
 *   scripts/build.mjs 逐课调用本配置构建（纯工程操作，不调用任何 AI API）。
 * - 分发模式统一为"单文件内联 + 大资源外置"（参考 三角数据图互动网页 项目的成功方案）：
 *   viteSingleFile 将 JS/CSS 全部内联进 index.html；assetsInlineLimit 使图片/字体 base64
 *   内联，保证 file:// 双击打开即可使用（@font-face 等子资源不被 CORS 拦截）；
 *   视频/3D 等超大资源放入课程 public/ 目录，构建时原样复制到 dist/（不内联，<video>
 *   在 file:// 下可播放）。构建后由 scripts/build.mjs 自动打包为 zip 分发。
 */
function resolveLessonDir(): string {
  const fromEnv = process.env.VITE_LESSON?.trim()
  if (fromEnv) return fromEnv
  const lessonsRoot = join(projectRoot, 'lessons')
  const candidates = readdirSync(lessonsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(lessonsRoot, d.name, 'lesson.json')))
    .map((d) => d.name)
  if (candidates.length === 1) return candidates[0]
  throw new Error(
    `未指定课程目录：请通过环境变量 VITE_LESSON 指定（当前可用：${candidates.join('、') || '无'}）`
  )
}

const lessonDir = resolveLessonDir()

export default defineConfig({
  root: `lessons/${lessonDir}`,
  base: './',
  plugins: [viteSingleFile({ useRecommendedBuildConfig: false })],
  resolve: {
    alias: {
      // 单课源码快捷导入（示例：import { $ } from '@/utils/dom'）
      '@': fileURLToPath(new URL(`./lessons/${lessonDir}/src`, import.meta.url))
    }
  },
  build: {
    // 相对 root 解析 → lessons/<课>/dist
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2018',
    chunkSizeWarningLimit: 800,
    // 字体（woff2/ttf/otf）一律 base64 内联进单文件：file:// 下 @font-face 引用外部字体文件
    // 会被 Chrome/Edge 以 CORS 拦截，必须内联才能保证双击离线可用；
    // 其余资源仍按 4KB 阈值内联，大于 4KB 的图片输出为独立文件到 dist/assets/
    // （独立文件在 file:// 协议下通过 <img> 标签加载正常，不受 CORS 影响）
    assetsInlineLimit: (filePath, content) => {
      if (/\.(woff2?|ttf|otf)$/i.test(filePath)) return true
      return content.byteLength < 4 * 1024
    },
    // 以下两项替代 viteSingleFile 的 useRecommendedBuildConfig，保证 JS/CSS 单文件输出
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  },
  server: {
    port: 5173,
    open: false
  }
})
