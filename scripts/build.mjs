/**
 * 多课构建脚本（纯工程操作，不调用任何 AI API）
 *
 * 用法：
 *   node scripts/build.mjs                # 构建 lessons/ 下全部课程
 *   node scripts/build.mjs --lesson=<课>   # 只构建指定课程
 *
 * 行为：
 * - 逐课调用 `vite build`（通过环境变量 VITE_LESSON 指定课程，由 vite.config.ts 解析）；
 * - 每课构建完成后，自动将 dist/ 打包为 zip（统一分发模式的分发物）。
 */
import { spawnSync } from 'node:child_process'
import { createWriteStream, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

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
  return packDist(dir)
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
  const only = parseLessonArg(process.argv.slice(2))
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
