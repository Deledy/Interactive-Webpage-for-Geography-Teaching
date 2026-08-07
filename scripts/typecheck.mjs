/**
 * 按课 TypeScript 类型检查脚本（纯工程操作，不调用任何 AI API）
 *
 * 用法：
 *   node scripts/typecheck.mjs                # 全量检查（默认，等价 npm run typecheck）
 *   node scripts/typecheck.mjs --lesson=<课>   # 只检查指定课程（不阻塞其他课程）
 *
 * 说明：单课检查通过临时 tsconfig（extends 根 tsconfig.json，include 仅该课）实现，
 * 避免某课类型错误阻塞整个项目的发布门禁。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const lessonsRoot = join(projectRoot, 'lessons')
const tscBin = join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc')
const TSCONFIG_TMP = join(projectRoot, 'tsconfig.lesson.json')

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

function runTsc(args) {
  return spawnSync(process.execPath, [tscBin, ...args], { cwd: projectRoot, stdio: 'inherit' })
}

/** 全量检查 */
function checkAll() {
  const result = runTsc(['--noEmit'])
  if (result.status === 0) {
    console.log('全量类型检查通过。')
  }
  return result.status === 0
}

/** 单课检查：生成临时 tsconfig（include 仅该课 + 根级配置） */
function checkLesson(dir) {
  const config = {
    extends: './tsconfig.json',
    include: [
      `lessons/${dir}/src`,
      `lessons/${dir}/index.html`,
      'vite.config.ts',
      'vitest.config.ts'
    ]
  }
  writeFileSync(TSCONFIG_TMP, JSON.stringify(config, null, 2))
  try {
    const result = runTsc(['--noEmit', '-p', TSCONFIG_TMP])
    if (result.status === 0) {
      console.log(`课程 ${dir} 类型检查通过。`)
    }
    return result.status === 0
  } finally {
    unlinkSync(TSCONFIG_TMP)
  }
}

function main() {
  const only = parseLessonArg(process.argv.slice(2))
  if (only) {
    if (!existsSync(join(lessonsRoot, only, 'lesson.json'))) {
      console.error(`[错误] 课程 ${only} 不存在（lessons/${only}/lesson.json 缺失）`)
      process.exitCode = 1
      return
    }
    process.exitCode = checkLesson(only) ? 0 : 1
    return
  }
  process.exitCode = checkAll() ? 0 : 1
}

main()
