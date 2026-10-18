/**
 * 多课构建脚本（纯工程操作，不调用任何 AI API）
 *
 * 用法：
 *   node scripts/build.mjs                # 构建 lessons/ 下全部课程
 *   node scripts/build.mjs --lesson=<课>   # 只构建指定课程
 *
 * 行为：
 * - 逐课调用 `vite build`（通过环境变量 VITE_LESSON 指定课程，由 vite.config.ts 解析）；
 * - 每课构建后将 shared/ 共享静态页（如自定义练习编辑器）复制进 dist/quiz-editor/；
 * - 每课构建后生成 dist/quiz-editor/lesson-manifest.js（课程结构清单，供题目编辑器识别模块并映射题目）；
 * - 自动将 dist/ 打包为 zip（统一分发模式的分发物）。
 *
 * 产物结构：
 *   dist/index.html            主课程（JS/CSS 全部内联）
 *   dist/assets/               全部外置资源（图片/视频/纹理等）
 *   dist/quiz-editor/          题目编辑器 + 题库数据 + 结构清单 + 配色表
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { extractManifest, manifestScript } from './manifest.mjs'

// archiver v7 为 ESM 重构版：导出 ZipArchive 子类（经 createRequire 引入）
const require = createRequire(import.meta.url)
const { ZipArchive } = require('archiver')

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const lessonsRoot = join(projectRoot, 'lessons')
const viteBin = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')

/** 解析 --lesson=<课> 与 --lesson <课> 两种写法 */
function parseLessonArg(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--lesson=')) return arg.slice('--lesson='.length)
    if (arg === '--lesson' && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[++i]
  }
  return undefined
}

function listLessons() {
  return readdirSync(lessonsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(lessonsRoot, d.name, 'lesson.json')))
    .map((d) => d.name)
    .sort()
}

function buildLesson(dir) {
  console.log(`\n[构建] ${dir}`)
  const result = spawnSync(process.execPath, [viteBin, 'build'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_LESSON: dir },
    stdio: 'inherit'
  })
  if (result.status !== 0) {
    throw new Error(`课程 ${dir} 构建失败（退出码 ${result.status}）`)
  }
  reorganizeDistAssets(dir)
  copySharedIntoDist(dir)
  writeManifest(dir)
  return packDist(dir)
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 把 Vite 产出到 dist 根目录的资源统一移入 dist/assets/，并改写 index.html 内的引用。
 *
 * 为什么需要后处理：vite-plugin-singlefile 把 JS 内联进 index.html 后，Vite 生成的
 * `new URL("文件名.png", import.meta.url)` 是裸文件名（不含 assets 目录前缀），
 * 直接设置 build.assetsDir 会让引用与文件位置不一致（file:// 双击时 404）。
 * 因此构建后统一搬家并改写为 `assets/文件名`，保证目录整洁且离线可用。
 * public/ 下已在 assets/ 内的资源不受影响。
 */
function reorganizeDistAssets(dir) {
  const distDir = join(lessonsRoot, dir, 'dist')
  const htmlPath = join(distDir, 'index.html')
  if (!existsSync(htmlPath)) return
  const names = readdirSync(distDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== 'index.html' && !/\.zip$/i.test(entry.name))
    .map((entry) => entry.name)
  if (names.length === 0) return

  const assetsDir = join(distDir, 'assets')
  mkdirSync(assetsDir, { recursive: true })
  for (const name of names) {
    renameSync(join(distDir, name), join(assetsDir, name))
  }

  // 长文件名优先，避免一个文件名是另一个的子串时被提前匹配
  const pattern = new RegExp(
    `(?<!assets/)(?:${names
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join('|')})`,
    'g'
  )
  const html = readFileSync(htmlPath, 'utf8')
  const next = html.replace(pattern, (match) => `assets/${match}`)
  writeFileSync(htmlPath, next, 'utf8')
  console.log(`[资源] ${names.length} 个文件 → dist/assets/，并已改写 index.html 引用`)
}

/**
 * shared/ 下需随分发包落位的共享静态页：源文件 → dist/quiz-editor/ 内目标名
 * （ASCII 命名，规避 file:// 中文名编码问题）。
 * 单一真源在 shared/，此处只做构建期复制，不提交各课副本。
 */
const SHARED_DIST_FILES = [
  ['shared/quiz/editor/build/index.html', 'custom-quiz-editor.html']
]

/** 题目编辑器相关文件在 dist 内的统一目录 */
const QUIZ_DIST_DIR = 'quiz-editor'

/** 课程配色表：源文件 → dist/quiz-editor/quiz-theme.css（供离线编辑器预览读取） */
const LESSON_THEME_SRC = join('src', 'styles', 'quiz-theme.css')

/**
 * 将 shared/ 共享静态页与课程配色表复制进该课 dist/quiz-editor/。
 * 仅当课程提供 quiz-theme.css（即使用共享练习运行时）时才产出该目录，
 * 避免无关课程的分发包里出现空编辑器。
 */
function copySharedIntoDist(dir) {
  const lessonDir = join(lessonsRoot, dir)
  const distQuizDir = join(lessonDir, 'dist', QUIZ_DIST_DIR)
  const themeFrom = join(lessonDir, LESSON_THEME_SRC)
  if (!existsSync(themeFrom)) return
  mkdirSync(distQuizDir, { recursive: true })
  for (const [src, dest] of SHARED_DIST_FILES) {
    const from = join(projectRoot, src)
    if (!existsSync(from)) {
      console.warn(`[共享] 未找到 ${src}，请先执行 npm run build:editor`)
      continue
    }
    copyFileSync(from, join(distQuizDir, dest))
    console.log(`[共享] ${src} → dist/${QUIZ_DIST_DIR}/${dest}`)
  }
  copyFileSync(themeFrom, join(distQuizDir, 'quiz-theme.css'))
  console.log(`[配色] ${LESSON_THEME_SRC} → dist/${QUIZ_DIST_DIR}/quiz-theme.css`)
}

/**
 * 生成课程结构清单 dist/quiz-editor/lesson-manifest.js（只读契约）。
 * 读取该课**源** index.html，抽取模块信息；供题目编辑器识别模块并映射题目
 * （详见 shared/quiz/editor/docs 开发文档第二部分）。缺失源文件时跳过。
 */
function writeManifest(dir) {
  const lessonDir = join(lessonsRoot, dir)
  const distQuizDir = join(lessonDir, 'dist', QUIZ_DIST_DIR)
  const htmlPath = join(lessonDir, 'index.html')
  if (!existsSync(distQuizDir) || !existsSync(htmlPath)) return
  let title = dir
  try {
    const meta = JSON.parse(readFileSync(join(lessonDir, 'lesson.json'), 'utf8'))
    title = meta.lessonTitle || meta.title || title
  } catch {
    // lesson.json 缺失或损坏时退化为目录名
  }
  const manifest = extractManifest(readFileSync(htmlPath, 'utf8'), { lesson: dir, title })
  writeFileSync(join(distQuizDir, 'lesson-manifest.js'), manifestScript(manifest), 'utf8')
  const post = manifest.postLesson ? 1 : 0
  console.log(`[清单] ${dir} → dist/${QUIZ_DIST_DIR}/lesson-manifest.js（模块 ${manifest.modules.length} + 课后练习 ${post}）`)
}

/** 将 dist/ 打包为 zip（放在该课 dist/ 下，作为构建产物） */
function packDist(dir) {
  const distDir = join(lessonsRoot, dir, 'dist')
  if (!existsSync(distDir)) return Promise.resolve()
  const zipPath = join(distDir, `${dir}.zip`)
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = new ZipArchive({ zlib: { level: 9 } })
    output.on('close', () => {
      console.log(`[打包] ${zipPath}（${archive.pointer()} 字节）`)
      resolve()
    })
    archive.on('error', reject)
    archive.pipe(output)
    // 排除 dist 内的 zip 自身（*.zip）
    archive.glob('**/*', { cwd: distDir, ignore: ['*.zip'] })
    archive.finalize()
  })
}

async function main() {
  // 优先级：命令行 --lesson > 环境变量 VITE_LESSON > 全部课程
  const only = parseLessonArg(process.argv.slice(2)) || process.env.VITE_LESSON?.trim()
  const lessons = only ? [only] : listLessons()
  if (lessons.length === 0) {
    console.log('lessons/ 下没有发现课程（缺少 lesson.json）')
    return
  }
  const failed = []
  for (const dir of lessons) {
    try {
      await buildLesson(dir)
    } catch (err) {
      failed.push(dir)
      console.error(`[失败] ${err.message}`)
    }
  }
  if (failed.length > 0) {
    console.error(`\n构建结束：失败 ${failed.length} 课（${failed.join('、')}），其余成功。`)
    process.exitCode = 1
  } else {
    console.log(`\n全部构建成功（${lessons.length} 课）。`)
  }
}

main()
