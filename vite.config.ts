import { fileURLToPath, URL } from 'node:url'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
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
 * - 分发模式统一为"单文件内联 + 资源外置"（参考 三角数据图互动网页 项目的成功方案）：
 *   viteSingleFile 将 JS/CSS 全部内联进 index.html；assetsInlineLimit 使小图/字体 base64
 *   内联，保证 file:// 双击打开即可使用（@font-face 等子资源不被 CORS 拦截）；
 *   视频/3D 等超大资源放入课程 public/assets/ 目录，构建时原样复制到 dist/assets/（不内联，
 *   <video> 在 file:// 下可播放）。dist 根目录只保留主课程 index.html。
 * - 产物结构（分发物）：
 *     dist/index.html         主课程（JS/CSS 全部内联）
 *     dist/assets/            全部外置资源（图片/视频/纹理等）
 *     dist/quiz-editor/       题目编辑器、题库数据、结构清单与配色表
 *   构建后由 scripts/build.mjs 自动打包为 zip 分发。
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

/**
 * 开发期把构建好的离线编辑器（shared/quiz/editor/build/index.html）挂到
 * /quiz-editor/custom-quiz-editor.html，并把它需要的本课配色表挂到
 * /quiz-editor/quiz-theme.css（编辑器内部按同级相对路径加载这些文件）。
 * 编辑器由 `npm run build:editor` 生成（predev / build 已自动执行）。
 */
function sharedEditorDevPlugin(): Plugin {
  const editorFile = join(projectRoot, 'shared', 'quiz', 'editor', 'build', 'index.html')
  const themeFile = join(projectRoot, 'lessons', lessonDir, 'src', 'styles', 'quiz-theme.css')
  return {
    name: 'shared-quiz-editor-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0]
        if (pathname === '/quiz-editor/quiz-theme.css') {
          if (!existsSync(themeFile)) return next()
          res.setHeader('Content-Type', 'text/css; charset=utf-8')
          res.end(readFileSync(themeFile))
          return
        }
        if (pathname !== '/quiz-editor/custom-quiz-editor.html' || !existsSync(editorFile)) return next()
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(readFileSync(editorFile))
      })
    }
  }
}

export default defineConfig({
  root: `lessons/${lessonDir}`,
  base: './',
  plugins: [sharedEditorDevPlugin(), viteSingleFile({ useRecommendedBuildConfig: false })],
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
    // 大资源先输出到 dist 根目录。原因：vite-plugin-singlefile 会把 JS 内联进 index.html，
    // 此时 JS 里由 Vite 生成的 `new URL("文件名.png", import.meta.url)` 是**裸文件名**
    // （不包含 assets 目录前缀），相对路径只能基于 index.html 解析。
    // 构建完成后由 scripts/build.mjs 统一把根目录资源移入 dist/assets/ 并改写 index.html
    // 内的引用，兼顾"目录整洁"与 file:// 双击可用。
    assetsDir: '',
    // 字体（woff2/ttf/otf）一律 base64 内联进单文件：file:// 下 @font-face 引用外部字体文件
    // 会被 Chrome/Edge 以 CORS 拦截，必须内联才能保证双击离线可用；
    // 其余资源仍按 4KB 阈值内联，大于 4KB 的图片输出为独立文件（构建后统一移入 dist/assets/）
    // （独立文件在 file:// 协议下通过 <img> 标签加载正常，不受 CORS 影响）
    assetsInlineLimit: (filePath, content) => {
      if (/\.(woff2?|ttf|otf)$/i.test(filePath)) return true
      // 行星纹理（WebGL 贴图）必须 base64 内联：file:// 下 texImage2D 上传外部图片会被安全策略拦截
      if (/[\\/]textures[\\/].*\.(jpe?g|png)$/i.test(filePath)) return true
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
