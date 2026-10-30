/**
 * 多课构建脚本（纯工程操作，不调用任何 AI API）
 *
 * 用法：
 *   node scripts/build.mjs                # 构建 lessons/ 下全部课程
 *   node scripts/build.mjs --lesson=<课>   # 只构建指定课程
 *
 * 行为：
 * - 逐课调用 `vite build`（通过环境变量 VITE_LESSON 指定课程，由 vite.config.ts 解析）；
 * - 每课构建后把产物重排为面向教师的两个顶层目录（见 arrangePackage）；
 * - 自动将 dist 内两个目录打包为 zip（放在 dist 之外，作为交付物）。
 *
 * 产物结构：
 *   dist/课程/index.html            主课程（JS/CSS 全部内联）
 *   dist/课程/assets/               全部外置资源（图片/视频/纹理等）
 *   dist/题目编辑器/                题目编辑器 + 可编辑题库
 *     ├─ 题目编辑器.html
 *     ├─ practice-data.js           教师唯一需要替换的文件
 *     └─ assets/                    结构清单与配色表（构建只读）
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
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
  arrangePackage(dir)
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

  // 长文件名优先，避免一个文件名是另一个的子串时被提前匹配；
  // 同时兼容 HTML 中被百分号编码（encodeURI）的中文文件名
  const candidates = []
  for (const name of names) {
    candidates.push(name)
    const encoded = encodeURI(name)
    if (encoded !== name) candidates.push(encoded)
  }
  const pattern = new RegExp(
    `(?<!assets/)(?:${candidates
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join('|')})`,
    'g'
  )
  const html = readFileSync(htmlPath, 'utf8')

  // data-lightbox 等自定义属性里的本地资源不会被 Vite 处理，
  // 这里按源文件补拷到 assets/，避免放大查看时 404（如月球视频的 GIF 放大图）。
  const lessonRoot = join(lessonsRoot, dir)
  for (const match of html.matchAll(/data-lightbox="([^"]+)"/g)) {
    const ref = match[1]
    if (/^(?:https?:|data:|blob:|#)/.test(ref)) continue
    let clean = ref.replace(/^\.\//, '')
    try {
      clean = decodeURIComponent(clean)
    } catch {
      // 非法编码时按原样处理
    }
    if (!clean.startsWith('assets/')) continue
    const from = join(lessonRoot, clean)
    if (!existsSync(from)) continue
    const to = join(assetsDir, clean.slice('assets/'.length))
    mkdirSync(dirname(to), { recursive: true })
    copyFileSync(from, to)
  }

  const next = html.replace(pattern, (match) => `assets/${match}`)
  writeFileSync(htmlPath, next, 'utf8')
  console.log(`[资源] ${names.length} 个文件 → dist/assets/，并已改写 index.html 引用`)
}

/** 分发包的两个顶层目录（面向教师，用中文名便于识别） */
const COURSE_DIR = '课程'
const EDITOR_DIR = '题目编辑器'

/** 离线编辑器单文件产物（npm run build:editor 生成） */
const EDITOR_BUILD = 'shared/quiz/editor/build/index.html'

/** 课程配色表：源文件 → dist/题目编辑器/assets/quiz-theme.css */
const LESSON_THEME_SRC = join('src', 'styles', 'quiz-theme.css')

/** 题库源文件所在目录（public/quiz-editor/，分发时落到题目编辑器目录） */
const PRACTICE_PUBLIC_DIR = join('public', 'quiz-editor')

/**
 * 把 Vite 产物重排为面向教师的分发包：
 *   dist/课程/index.html + assets/
 *   dist/题目编辑器/题目编辑器.html + practice-data.js + assets/(清单、配色)
 * 仅当课程提供 quiz-theme.css（即使用共享练习运行时）时才产出题目编辑器目录，
 * 避免无关课程的分发包里出现空编辑器。
 */
function arrangePackage(dir) {
  const distDir = join(lessonsRoot, dir, 'dist')
  const htmlPath = join(distDir, 'index.html')
  if (existsSync(htmlPath)) {
    const courseDir = join(distDir, COURSE_DIR)
    mkdirSync(courseDir, { recursive: true })
    renameSync(htmlPath, join(courseDir, 'index.html'))
    const assetsPath = join(distDir, 'assets')
    if (existsSync(assetsPath)) renameSync(assetsPath, join(courseDir, 'assets'))
    console.log(`[结构] 课程 → dist/${COURSE_DIR}/index.html + assets/`)
  }

  const lessonDir = join(lessonsRoot, dir)
  // Vite 会原样复制 public/quiz-editor/，这里清掉，避免分发包残留旧目录
  const legacyDir = join(distDir, 'quiz-editor')
  if (existsSync(legacyDir)) rmSync(legacyDir, { recursive: true, force: true })

  const themeFrom = join(lessonDir, LESSON_THEME_SRC)
  if (!existsSync(themeFrom)) return

  const editorDir = join(distDir, EDITOR_DIR)
  const editorAssets = join(editorDir, 'assets')
  mkdirSync(editorAssets, { recursive: true })

  const editorFrom = join(projectRoot, EDITOR_BUILD)
  if (existsSync(editorFrom)) {
    copyFileSync(editorFrom, join(editorDir, '题目编辑器.html'))
  } else {
    console.warn(`[共享] 未找到 ${EDITOR_BUILD}，请先执行 npm run build:editor`)
  }

  // 题库留在编辑器同级：教师导出后直接覆盖同名文件即可，无需进入子目录
  const dataFrom = join(lessonDir, PRACTICE_PUBLIC_DIR, 'practice-data.js')
  if (existsSync(dataFrom)) {
    copyFileSync(dataFrom, join(editorDir, 'practice-data.js'))
  } else {
    console.warn(`[结构] 未找到 ${PRACTICE_PUBLIC_DIR}/practice-data.js，题目编辑器将无初始题库`)
  }

  copyFileSync(themeFrom, join(editorAssets, 'quiz-theme.css'))
  writeManifest(dir, editorAssets)
  console.log(`[结构] 题目编辑器 → dist/${EDITOR_DIR}/`)
}

/**
 * 生成课程结构清单（只读契约），供题目编辑器识别模块并映射题目。
 * 读取该课**源** index.html，抽取模块信息；缺失源文件时跳过。
 */
function writeManifest(dir, targetDir) {
  const lessonDir = join(lessonsRoot, dir)
  const htmlPath = join(lessonDir, 'index.html')
  if (!existsSync(htmlPath)) return
  let title = dir
  try {
    const meta = JSON.parse(readFileSync(join(lessonDir, 'lesson.json'), 'utf8'))
    title = meta.lessonTitle || meta.title || title
  } catch {
    // lesson.json 缺失或损坏时退化为目录名
  }
  const manifest = extractManifest(readFileSync(htmlPath, 'utf8'), { lesson: dir, title })
  writeFileSync(join(targetDir, 'lesson-manifest.js'), manifestScript(manifest), 'utf8')
  const post = manifest.postLesson ? 1 : 0
  console.log(`[清单] ${dir} → dist/${EDITOR_DIR}/assets/lesson-manifest.js（模块 ${manifest.modules.length} + 课后练习 ${post}）`)
}

/** 将 dist/ 内两个目录打包为 zip（放在该课目录下，不污染分发包本身） */
function packDist(dir) {
  const distDir = join(lessonsRoot, dir, 'dist')
  if (!existsSync(distDir)) return Promise.resolve()
  const zipPath = join(lessonsRoot, dir, `${dir}.zip`)
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = new ZipArchive({ zlib: { level: 9 } })
    output.on('close', () => {
      console.log(`[打包] ${zipPath}（${archive.pointer()} 字节）`)
      resolve()
    })
    archive.on('error', reject)
    archive.pipe(output)
    archive.glob('**/*', { cwd: distDir })
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
