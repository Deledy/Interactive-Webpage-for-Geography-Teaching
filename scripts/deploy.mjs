/**
 * 一键部署脚本（纯工程操作，不调用任何 AI API）
 *
 * 用法：node scripts/deploy.mjs
 *
 * 流程：
 *   1. 构建 lessons/ 下全部课程（复用 build.mjs，multi 模式自动打包 zip）；
 *   2. 将各课 dist/ 复制到根目录 dist-book/lessons/<课>/（部署物）；
 *   3. 调用 assemble.mjs --mode=deploy 生成 dist-book/ 顶层总览与整书首页。
 *
 * 产出：dist-book/ 目录，上传任意静态服务器即可整体访问（首页 index.html）。
 */
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const lessonsRoot = join(projectRoot, 'lessons')
const distBookRoot = join(projectRoot, 'dist-book')

function runScript(script, args = []) {
  const result = spawnSync(process.execPath, [join(projectRoot, 'scripts', script), ...args], {
    cwd: projectRoot,
    stdio: 'inherit'
  })
  if (result.status !== 0) {
    throw new Error(`${script} 执行失败（退出码 ${result.status}）`)
  }
}

function copyLessons() {
  const dirs = readdirSync(lessonsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(lessonsRoot, d.name, 'dist')))
    .map((d) => d.name)
  if (dirs.length === 0) {
    console.log('没有找到已构建的课程（缺少 lessons/*/dist）')
    return
  }
  mkdirSync(join(distBookRoot, 'lessons'), { recursive: true })
  for (const dir of dirs) {
    const target = join(distBookRoot, 'lessons', dir)
    rmSync(target, { recursive: true, force: true })
    cpSync(join(lessonsRoot, dir, 'dist'), target, { recursive: true })
    console.log(`[复制] lessons/${dir}/dist -> dist-book/lessons/${dir}`)
  }
}

function main() {
  // 1. 构建全部课程
  runScript('build.mjs')
  // 2. 复制各课产物到 dist-book/（assemble deploy 模式会先清空 dist-book，必须先复制或后生成）
  //    顺序：先由 assemble --mode=deploy 清空并生成总览/书首页，再复制课程产物
  runScript('assemble.mjs', ['--mode=deploy'])
  copyLessons()
  console.log('\n部署物已生成：dist-book/（上传该目录到任意静态服务器即可访问）')
}

main()
