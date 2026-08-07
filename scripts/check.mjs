/**
 * 结构校验脚本（纯工程操作，不调用任何 AI API）
 *
 * 规则（对齐架构分析报告，决策 2026-08-07）：
 * - 错误（退出码 1，需修复）：
 *   1. lesson.json 无法解析
 *   2. status=done 的课程缺少 entry 指向的文件（默认 dist/index.html，请先构建）
 *   3. resources 数组中登记的资源文件不存在
 * - 告警（宽松，不阻塞构建，退出码仍为 0）：
 *   1. 课内 HTML/源码存在远程 URL 引用 —— 资源本地化约束（宽松拦截，仅提示）
 *   2. docs/ 下 01~05 交接文件不齐备
 *
 * 用法：node scripts/check.mjs
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const lessonsRoot = join(projectRoot, 'lessons')

const DOC_REQUIRED = [
  '01_教学设计交接包.md',
  '02_页面设计交接包.md',
  '03_技术实现交接包.md',
  '04_总控摘要.md',
  '05_开发文档.md'
]
const TEXT_EXTS = new Set(['.html', '.ts', '.css', '.js', '.json', '.md'])
const REMOTE_URL_RE = /https?:\/\/[^\s"'<>()]+/g

const errors = []
const warnings = []

function listLessons() {
  return readdirSync(lessonsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(lessonsRoot, d.name, 'lesson.json')))
    .map((d) => d.name)
    .sort()
}

/** 递归扫描课内文本文件中的远程 URL（跳过 node_modules/dist/docs） */
function scanRemoteUrls(lessonRoot) {
  const found = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', 'docs'].includes(entry.name)) continue
        walk(full)
      } else if (entry.isFile() && TEXT_EXTS.has(extname(entry.name))) {
        const content = readFileSync(full, 'utf-8')
        let match
        while ((match = REMOTE_URL_RE.exec(content)) !== null) {
          found.push(`${full.replace(lessonRoot, '')} : ${match[0]}`)
        }
      }
    }
  }
  walk(lessonRoot)
  return found
}

function checkLesson(name) {
  const lessonRoot = join(lessonsRoot, name)
  let lesson
  try {
    lesson = JSON.parse(readFileSync(join(lessonRoot, 'lesson.json'), 'utf-8'))
  } catch (err) {
    errors.push(`[${name}] lesson.json 无法解析：${err.message}`)
    return
  }

  // status=done → entry 必须存在（错误）
  if (lesson.status === 'done') {
    const entry = lesson.entry || 'dist/index.html'
    if (!existsSync(join(lessonRoot, entry))) {
      errors.push(`[${name}] status=done 但缺少入口文件 ${entry}（请先执行构建）`)
    }
  }

  // resources 登记的资源必须存在（错误）
  const resources = Array.isArray(lesson.resources) ? lesson.resources : []
  for (const item of resources) {
    const path = typeof item === 'string' ? item : item?.path
    if (!path) continue
    if (!existsSync(join(lessonRoot, path))) {
      errors.push(`[${name}] resources 中登记的资源不存在：${path}`)
    }
  }

  // 远程 URL 引用（宽松：仅告警）
  const remoteUrls = scanRemoteUrls(lessonRoot)
  if (remoteUrls.length > 0) {
    const lines = remoteUrls.slice(0, 10).join('\n        ')
    warnings.push(
      `[${name}] 发现 ${remoteUrls.length} 处远程资源引用（建议本地化，禁止远程 URL）：\n        ${lines}${remoteUrls.length > 10 ? '\n        …' : ''}`
    )
  }

  // docs 01~05 齐备（宽松：仅告警）
  const docsDir = join(lessonRoot, 'docs')
  const missing = DOC_REQUIRED.filter((f) => !existsSync(join(docsDir, f)))
  if (missing.length > 0) {
    warnings.push(`[${name}] docs/ 缺少交接文件：${missing.join('、')}`)
  }
}

function main() {
  const lessons = listLessons()
  if (lessons.length === 0) {
    console.log('lessons/ 下没有发现课程')
    return
  }
  for (const name of lessons) checkLesson(name)

  console.log(`\n===== 校验结果（${lessons.length} 课）=====`)
  if (errors.length > 0) {
    console.error(`\n[错误] ${errors.length} 项（需修复）：`)
    errors.forEach((e) => console.error('  - ' + e))
  }
  if (warnings.length > 0) {
    console.log(`\n[警告] ${warnings.length} 项（宽松，不阻塞构建）：`)
    warnings.forEach((w) => console.log('  - ' + w))
  }
  if (errors.length === 0 && warnings.length === 0) {
    console.log('全部通过。')
  }
  if (errors.length > 0) process.exitCode = 1
}

main()
