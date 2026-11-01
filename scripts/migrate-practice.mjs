/**
 * 随堂练习数据迁移脚本（纯工程操作，不调用任何 AI API）
 *
 * 用法：
 *   node scripts/migrate-practice.mjs                # 迁移 lessons/ 下全部课程
 *   node scripts/migrate-practice.mjs --lesson=<课>   # 只迁移指定课程
 *   node scripts/migrate-practice.mjs --force         # 已存在目标文件时也覆盖重写
 *
 * 作用（一次性、幂等、可重跑）：
 *   把源码内置的旧模型 `lessonData.practices` 转成统一 schema 的
 *   `lessons/<课>/public/quiz-editor/practice-data.js`（`window.__PRACTICE_DATA__`），并提交。
 *
 * 数据真源约定（见 shared/quiz/editor/docs 开发文档 §18 / §24）：
 *   - `practice-data.js` 是**提交在 public/quiz-editor/ 的可编辑数据文件**，
 *     构建时被复制到分发包的「题目编辑器」目录（与课程目录同级）；
 *   - 构建脚本**不生成、不覆盖**该文件，避免冲掉教师改动；
 *   - 故本脚本仅用于「首次把旧数据搬过来」，默认目标已存在时跳过（幂等、不覆盖）。
 *
 * 迁移映射（旧 → 新）：
 *   PracticeItem.title        → modules[id].title
 *   PracticeItem.intro        → modules[id].intro
 *   PracticeQuestion.q        → question.stem
 *   options: string[]         → options: { key:'A'…, text }
 *   answer: number            → answer: 'A'（下标 → 字母；多选 → string[]）
 *   explain                   → analysis
 *   PracticeDrag(type:'drag') → modules[id] = { kind:'drag', title?, intro? }（只读占位）
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { extractManifest } from './manifest.mjs'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const lessonsRoot = join(projectRoot, 'lessons')

/** 迁移后运行时支持的 schema 版本（v3：题组 groups / 材料 materialLayout） */
const PRACTICE_DATA_VERSION = 3

/** 解析 --lesson=<课> 与 --lesson <课> 两种写法 */
function parseLessonArg(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--lesson=')) return arg.slice('--lesson='.length)
    if (arg === '--lesson' && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[++i]
  }
  return undefined
}

/** 下标 → 选项字母（0 → 'A'，25 → 'Z'） */
function indexToKey(index) {
  return String.fromCharCode(65 + index)
}

/** 迁移后画布统一高度（与 content/materialTypes.ts 的 DEFAULT_MATERIAL_HEIGHT 保持一致） */
const DEFAULT_MATERIAL_HEIGHT = 700

/** 旧 HTML 材料 → 自由布局（与 content/materialConvert.ts 规则一致） */
function materialLayoutFromHtml(html) {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  const lines = Math.max(1, Math.ceil(text.length / 42))
  let height = 56 + lines * 37 + 24
  if (/<(table|img)\b/i.test(html)) height = Math.max(height, 320)
  height = Math.min(480, Math.max(120, height))
  const objectHeight = Math.max(72, height - 48)
  return {
    version: 1,
    width: 1000,
    height: Math.max(DEFAULT_MATERIAL_HEIGHT, objectHeight + 48),
    background: '#ffffff',
    objects: [
      {
        id: 'text-1',
        type: 'text',
        x: 24,
        y: 24,
        width: 952,
        height: objectHeight,
        html: String(html),
        style: { fontSize: 22, lineHeight: 1.7, textAlign: 'left', color: '#1b1d19' }
      }
    ]
  }
}

/** 旧单选题 → 新 CqChoice */
function convertChoiceQuestion(q) {
  const options = (q.options || []).map((text, i) => ({ key: indexToKey(i), text: String(text) }))
  return {
    type: 'choice',
    stem: q.q || '',
    options,
    // 旧模型为单选，answer 为下标；下标 → 字母
    answer: indexToKey(Number(q.answer) || 0),
    analysis: q.explain || undefined
  }
}

/** 单个旧 PracticeItem → 新 PracticeModule（题组结构；拖拽题为只读占位） */
function convertPracticeItem(item) {
  if (item && item.type === 'drag') {
    return { kind: 'drag', title: item.title, intro: item.intro }
  }
  return {
    title: item.title,
    intro: item.intro,
    groups: [
      {
        layout: 'stacked',
        material: '',
        materialLayout: null,
        questions: (item.questions || []).map(convertChoiceQuestion)
      }
    ]
  }
}

/**
 * 读取 TS 数据源：用 typescript 转译为 ESM，再经 data URL 动态 import。
 * type-only import 会被擦除，因此转译产物不携带运行时依赖。
 */
async function loadLessonData(lessonDir) {
  const tsPath = join(lessonDir, 'src', 'data', 'lessonData.ts')
  if (!existsSync(tsPath)) {
    throw new Error(`缺少数据源 ${tsPath}`)
  }
  const source = readFileSync(tsPath, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
      verbatimModuleSyntax: false
    }
  })
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(outputText, 'utf8').toString('base64')
  const mod = await import(dataUrl)
  return mod.lessonData
}

/** 读取挂在 window 上的经典脚本数据文件，取其全局变量（复用 custom-quiz.js 的写法） */
function readWindowGlobal(filePath, globalName) {
  if (!existsSync(filePath)) return undefined
  const code = readFileSync(filePath, 'utf8')
  const sandbox = {}
  new Function('window', code)(sandbox)
  return sandbox[globalName]
}

/** 生成 practice-data.js 文本 */
function buildFileContent(data) {
  const header = [
    '/* ============================================================',
    ' * 随堂练习 · 数据文件（教师可按学情自行编辑）',
    ' * ------------------------------------------------------------',
    ' * 1. 本文件构建后位于分发包的「题目编辑器」文件夹（与编辑器 html 同级），',
    ' *    分发后直接替换本文件即可更新练习，无需重新构建、无需联网。',
    ' * 2. 正式格式为 v3：modules 下只写 groups（题组），材料在题组上保存一次，',
    ' *    题目不再重复携带 material。',
    ' *    - group.layout：stacked 上下 / split 左右；',
    ' *    - group.materialLayout：自由布局材料画布（文字 / 图片 / 表格对象）；',
    ' *    - group.material：旧版 HTML 材料，仅用于兼容。',
    ' * 3. 题型统一为 choice / essay；kind 为 "drag" 的模块为拖拽题占位，编辑器只读。',
    ' * 4. postLesson 为课后练习（title / subtitle / sections），sections 同样支持',
    ' *    layout / materialLayout / material。',
    ' * 5. 本文件由 scripts/migrate-practice.mjs 首次生成，之后请直接编辑本文件；',
    ' *    构建不会覆盖它。',
    ' * ============================================================ */'
  ].join('\n')
  return header + '\nwindow.__PRACTICE_DATA__ = ' + JSON.stringify(data, null, 2) + ';\n'
}

/** 迁移单课 */
async function migrateLesson(dir) {
  const lessonDir = join(lessonsRoot, dir)
  const quizEditorDir = join(lessonDir, 'public', 'quiz-editor')
  const practicesPath = join(quizEditorDir, 'practice-data.js')
  const force = process.argv.slice(2).includes('--force')
  if (existsSync(practicesPath) && !force) {
    console.log(`[跳过] ${dir}：public/quiz-editor/practice-data.js 已存在（如需覆盖请加 --force）`)
    return
  }

  const lessonData = await loadLessonData(lessonDir)
  const practices = (lessonData && lessonData.practices) || {}

  const htmlPath = join(lessonDir, 'index.html')
  const html = existsSync(htmlPath) ? readFileSync(htmlPath, 'utf8') : ''
  const manifest = extractManifest(html, { lesson: dir })

  // 按 manifest 的 key（M1..M9）→ id 映射，写出统一 schema
  const modules = {}
  const matchedKeys = new Set()
  for (const m of manifest.modules) {
    const item = practices[m.key]
    if (!item) continue
    matchedKeys.add(m.key)
    modules[m.id] = convertPracticeItem(item)
  }
  const unmatched = Object.keys(practices).filter((k) => !matchedKeys.has(k))
  if (unmatched.length > 0) {
    console.warn(`[告警] ${dir}：以下练习键在 index.html 中无对应模块，已跳过：${unmatched.join('、')}`)
  }

  // 课后练习：直接沿用已提交的 custom-quiz.js（材料转为自由布局）
  const quiz = readWindowGlobal(join(quizEditorDir, 'custom-quiz.js'), '__CUSTOM_QUIZ__')
  const postLesson = quiz
    ? {
        title: quiz.title,
        subtitle: quiz.subtitle,
        sections: (quiz.sections || []).map((section) => {
          const { material, ...rest } = section
          return {
            ...rest,
            layout: 'stacked',
            materialLayout: materialLayoutFromHtml(material)
          }
        })
      }
    : undefined

  const data = {
    version: PRACTICE_DATA_VERSION,
    lesson: dir,
    updatedAt: new Date().toISOString(),
    modules,
    postLesson
  }

  const moduleCount = Object.keys(modules).length
  // 无可迁移内容（既无随堂题目、又无课后练习）→ 不生成空文件，避免为尚未接入契约的课程制造噪声
  if (moduleCount === 0 && !postLesson) {
    console.log(`[跳过] ${dir}：无随堂练习与课后练习数据可迁移`)
    return
  }

  mkdirSync(quizEditorDir, { recursive: true })
  writeFileSync(practicesPath, buildFileContent(data), 'utf8')
  const questionCount = Object.values(modules).reduce(
    (n, mod) => n + (mod.groups || []).reduce((sum, group) => sum + ((group.questions && group.questions.length) || 0), 0),
    0
  )
  console.log(
    `[迁移] ${dir} → public/quiz-editor/practice-data.js（模块 ${moduleCount}、题目 ${questionCount}、课后练习 ${postLesson ? 1 : 0}）`
  )
}

async function main() {
  const only = parseLessonArg(process.argv.slice(2))
  const dirs = only ? [only] : readdirSync(lessonsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(lessonsRoot, d.name, 'lesson.json')))
    .map((d) => d.name)
    .sort()

  if (only && !existsSync(join(lessonsRoot, only, 'lesson.json'))) {
    console.error(`[错误] 课程 ${only} 不存在（lessons/${only}/lesson.json 缺失）`)
    process.exitCode = 1
    return
  }
  if (dirs.length === 0) {
    console.log('lessons/ 下没有发现课程（缺少 lesson.json）')
    return
  }

  for (const dir of dirs) {
    try {
      await migrateLesson(dir)
    } catch (err) {
      console.error(`[失败] ${dir}：${err.message}`)
      process.exitCode = 1
    }
  }
}

main()
