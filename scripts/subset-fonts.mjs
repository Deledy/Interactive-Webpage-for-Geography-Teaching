/**
 * 字体子集化脚本（纯工程操作，不调用任何 AI API）
 *
 * 作用：从课程源码（index.html + src/**）提取页面实际用字，将思源黑体（Noto Sans SC）与
 *       思源宋体（Noto Serif SC）可变字体源文件"静态化 + 子集化"，产出小型 woff2 子集，
 *       放入该课 assets/fonts/。构建时由 Vite 将 woff2 全部 base64 内联，保证 file:// 双击离线可用。
 *
 * 用法：
 *   node scripts/subset-fonts.mjs                 # 处理 lessons/ 下唯一课程
 *   node scripts/subset-fonts.mjs --lesson=<课>    # 处理指定课程
 *   npm run fonts                                  # 同上
 *
 * 产物：
 *   assets/fonts/noto-sans-sc-400-subset.woff2   思源黑体 Regular（正文）
 *   assets/fonts/noto-sans-sc-700-subset.woff2   思源黑体 Bold（强调/标题）
 *   assets/fonts/noto-serif-sc-900-subset.woff2  思源宋体 Heavy（课程名/封面）
 *
 * 前置条件：
 * - Python 3 + fonttools（含 woff2/brotli），提供 `pyftsubset` 与 `python -m fontTools.varLib.instancer`；
 * - 可变字体源文件在 scripts/.font-cache/（NotoSansSC-VF.ttf、NotoSerifSC-VF.ttf），缺失时自动从
 *   google/fonts 官方仓库下载（jsdelivr CDN 优先，GitHub raw 兜底）。缓存目录已被 .gitignore 忽略。
 *
 * 文案变更后，重跑本脚本即可重新生成子集（脚本末尾会校验覆盖率，缺字会报错）。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const cacheDir = join(projectRoot, 'scripts', '.font-cache')

/* ---------------- 课程目录解析（与 vite.config.ts 保持同规则） ---------------- */
function resolveLessonDir() {
  const fromEnv = process.env.VITE_LESSON?.trim()
  if (fromEnv) return fromEnv
  const lessonsRoot = join(projectRoot, 'lessons')
  const candidates = readdirSync(lessonsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(lessonsRoot, d.name, 'lesson.json')))
    .map((d) => d.name)
  if (candidates.length === 1) return candidates[0]
  throw new Error(
    `未指定课程目录：请通过 --lesson=<课> 或环境变量 VITE_LESSON 指定（当前可用：${candidates.join('、') || '无'}）`
  )
}

/* ---------------- 文本提取 ---------------- */
function unescapeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, ' ')
}

/** index.html 的可见文本（去掉 script/style 与标签） */
function htmlVisibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
}

/** 会渲染为文字/提示的属性值（alt / title / data-title / placeholder / aria-label） */
function htmlAttrText(html) {
  const out = []
  const re = /<[a-zA-Z][^>]*\b(?:alt|title|data-title|placeholder|aria-label)="([^"]*)"/g
  let m
  while ((m = re.exec(html))) out.push(m[1])
  return out.join(' ')
}

/** TS 源码里的全部字符串字面量（页面 JS 动态生成的所有文本） */
function tsStringLiterals(src) {
  const out = []
  const re = /'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`/g
  let m
  while ((m = re.exec(src))) out.push(m[1] ?? m[2] ?? m[3])
  return out.join(' ')
}

/** 衬线字体专用字符：仅取使用 var(--font-serif) 的元素文本 */
function serifElementText(html) {
  const out = []
  const serifClasses =
    'topnav__brand-title|cover__chapter|cover__title|goal-card__title|goal-card__num|start-btn'
  const re = new RegExp(
    `<([a-z0-9]+)[^>]*class="[^"]*(?:${serifClasses})[^"]*"[^>]*>([\\s\\S]*?)<\\/\\1>`,
    'gi'
  )
  let m
  while ((m = re.exec(html))) out.push(stripTags(m[2]))
  return out.join(' ')
}

/** 收集字符集：去重、按码点排序、剔除空白（保留空格） */
function collectChars(...sources) {
  const set = new Set()
  const push = (s) => {
    for (const c of String(s)) {
      if (c === ' ' || (!/[\s]/.test(c))) set.add(c)
    }
  }
  // 基础安全集：全部 ASCII 可见字符（含数字/英文/常见符号），防止提取遗漏导致缺字
  for (let i = 0x20; i <= 0x7e; i++) set.add(String.fromCharCode(i))
  for (const src of sources) push(src)
  return [...set].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('')
}

/* ---------------- 字体处理 ---------------- */
function listFiles(dir, ext) {
  const out = []
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) out.push(...listFiles(p, ext))
    else if (name.name.endsWith(ext)) out.push(p)
  }
  return out
}

async function ensureSourceFonts(needSerif) {
  mkdirSync(cacheDir, { recursive: true })
  const specs = [
    {
      name: 'NotoSansSC-VF.ttf',
      url: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf',
      fallback:
        'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf'
    },
    {
      name: 'NotoSerifSC-VF.ttf',
      url: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf',
      fallback:
        'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf'
    }
  ].filter((s) => needSerif || !s.name.includes('Serif'))
  for (const spec of specs) {
    const target = join(cacheDir, spec.name)
    if (existsSync(target)) continue
    console.log(`[下载] ${spec.name}`)
    let ok = false
    for (const url of [spec.url, spec.fallback]) {
      try {
        const res = await fetch(url, { redirect: 'follow' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        writeFileSync(target, Buffer.from(await res.arrayBuffer()))
        ok = true
        break
      } catch (err) {
        console.warn(`  ${url.split('/')[2]} 不可用（${err.message}）`)
      }
    }
    if (!ok) throw new Error(`无法获取字体源文件：${spec.name}，请手动放入 ${cacheDir}`)
  }
}

function run(cmd, args, label) {
  const res = spawnSync(cmd, args, { cwd: projectRoot, stdio: 'inherit' })
  if (res.status !== 0) throw new Error(`${label} 失败（退出码 ${res.status}）`)
}

/** 静态化可变字体到指定权重（wght 轴实例化） */
function instantiate(src, weight, out) {
  run(
    process.platform === 'win32' ? 'python' : 'python3',
    ['-m', 'fontTools.varLib.instancer', src, `wght=${weight}`, '-o', out],
    `实例化 wght=${weight}`
  )
}

/** 子集化并输出 woff2 */
function subset(staticFont, charsFile, out) {
  run(
    process.platform === 'win32' ? 'pyftsubset' : 'pyftsubset',
    [
      staticFont,
      `--text-file=${charsFile}`,
      '--flavor=woff2',
      '--no-hinting',
      `--output-file=${out}`
    ],
    `子集化 ${out}`
  )
}

/** 校验子集覆盖：源字体含有的目标字符必须全部进入子集（源字体本身没有的字形由浏览器回退系统字体，不算缺失） */
function verify(checks) {
  const script = [
    'import sys',
    'from fontTools.ttLib import TTFont',
    'for line in sys.stdin.read().splitlines():',
    '    if not line.strip(): continue',
    '    path, charsFile, source = line.split("\\t")',
    '    chars = "".join(c for c in open(charsFile, encoding="utf-8").read() if c != "\\n")',
    '    subset = TTFont(path).getBestCmap()',
    '    src = TTFont(source).getBestCmap()',
    '    missing = [c for c in chars if ord(c) in src and ord(c) not in subset]',
    '    absent = [c for c in chars if ord(c) not in src]',
    '    msg = f"{path}: glyphs={TTFont(path)[\'maxp\'].numGlyphs} chars={len(set(chars))}"',
    '    if absent: msg += f" src-absent={len(absent)}"',
    '    if missing:',
    '        msg += " -> MISSING " + repr(missing[:20])',
    '        print(msg)',
    '        sys.exit(1)',
    '    print(msg)'
  ].join('\n')
  const verifyPy = join(cacheDir, 'verify-fonts.py')
  writeFileSync(verifyPy, script)
  const input = checks.map((c) => `${c.file}\t${c.charsFile}\t${c.source}`).join('\n')
  const res = spawnSync('python', [verifyPy], { cwd: projectRoot, input, encoding: 'utf-8' })
  process.stdout.write(res.stdout ?? '')
  if (res.status !== 0) throw new Error('字体子集覆盖率校验未通过（见上方 MISSING 列表，请检查提取逻辑）')
}

/* ---------------- 主流程 ---------------- */
async function main() {
  const argv = process.argv.slice(2)
  const lessonArg =
    (argv.find((a) => a.startsWith('--lesson=')) ?? '').slice('--lesson='.length) ||
    (argv.includes('--lesson') ? argv[argv.indexOf('--lesson') + 1] : undefined)
  if (lessonArg) process.env.VITE_LESSON = lessonArg
  const lessonDir = resolveLessonDir()
  const lessonRoot = join(projectRoot, 'lessons', lessonDir)

  console.log(`[课程] ${lessonDir}`)

  // 1. 提取字符集
  const indexPath = join(lessonRoot, 'index.html')
  const html = readFileSync(indexPath, 'utf-8')
  const srcDir = join(lessonRoot, 'src')
  const tsText = listFiles(srcDir, '.ts')
    .map((f) => readFileSync(f, 'utf-8'))
    .join('\n')

  const bodyChars = collectChars(
    htmlVisibleText(html),
    htmlAttrText(html),
    tsStringLiterals(tsText)
  )
  // 仅当本课样式确实声明了衬线字体（Noto Serif SC）时才生成/下载衬线子集
  const cssText = listFiles(srcDir, '.css')
    .map((f) => readFileSync(f, 'utf-8'))
    .join('\n')
  const needSerif = /Noto Serif SC/i.test(cssText + html)
  const serifChars = needSerif ? collectChars(serifElementText(html), '0123456789 ') : ''

  mkdirSync(cacheDir, { recursive: true })
  const bodyCharsFile = join(cacheDir, `${lessonDir}-body-chars.txt`)
  const serifCharsFile = join(cacheDir, `${lessonDir}-serif-chars.txt`)
  writeFileSync(bodyCharsFile, bodyChars, 'utf-8')
  if (needSerif) writeFileSync(serifCharsFile, serifChars, 'utf-8')
  console.log(
    `[字符] 正文 ${[...bodyChars].length} 个；衬线 ${needSerif ? `${[...serifChars].length} 个` : '不需要'}`
  )

  // 2. 确保可变字体源文件
  await ensureSourceFonts(needSerif)

  // 3. 静态化 + 子集化
  const fontsDir = join(lessonRoot, 'assets', 'fonts')
  mkdirSync(fontsDir, { recursive: true })
  const jobs = [
    {
      src: join(cacheDir, 'NotoSansSC-VF.ttf'),
      weight: 400,
      charsFile: bodyCharsFile,
      out: join(fontsDir, 'noto-sans-sc-400-subset.woff2')
    },
    {
      src: join(cacheDir, 'NotoSansSC-VF.ttf'),
      weight: 700,
      charsFile: bodyCharsFile,
      out: join(fontsDir, 'noto-sans-sc-700-subset.woff2')
    }
  ]
  if (needSerif) {
    jobs.push({
      src: join(cacheDir, 'NotoSerifSC-VF.ttf'),
      weight: 900,
      charsFile: serifCharsFile,
      out: join(fontsDir, 'noto-serif-sc-900-subset.woff2')
    })
  }

  const checks = []
  for (const job of jobs) {
    const staticFont = join(cacheDir, `static-${job.weight}.ttf`)
    instantiate(job.src, job.weight, staticFont)
    subset(staticFont, job.charsFile, job.out)
    checks.push({ file: job.out, charsFile: job.charsFile, source: job.src })
  }

  // 4. 覆盖率校验 + 大小报告
  verify(checks)
  for (const job of jobs) {
    const size = (readFileSync(job.out).byteLength / 1024).toFixed(1)
    console.log(`[产物] ${job.out.replace(lessonRoot, '…')}（${size} KB）`)
  }
  console.log('\n完成。构建时这些 woff2 将全部 base64 内联进单文件产物。')
}

main().catch((err) => {
  console.error(`\n[失败] ${err.message}`)
  process.exitCode = 1
})
