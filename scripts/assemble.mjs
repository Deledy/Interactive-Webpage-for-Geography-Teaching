/**
 * 成书自动汇总脚本（纯工程操作，不调用任何 AI API）
 *
 * 用法：
 *   node scripts/assemble.mjs                # 源模式：更新 books/<书>/book.json 与书首页
 *   node scripts/assemble.mjs --mode=deploy   # 部署模式：额外生成 dist-book/ 下的书首页与顶层总览
 *
 * 说明：以 lessons 下各课的 lesson.json 为唯一真源，自动重建 book.json 的 chapters/lessons 汇总，
 * 替代手写维护，避免与各课元数据漂移。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const lessonsRoot = join(projectRoot, 'lessons')
const booksRoot = join(projectRoot, 'books')
const distBookRoot = join(projectRoot, 'dist-book')
const isDeploy = process.argv.includes('--mode=deploy')

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function listLessons() {
  return readdirSync(lessonsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(lessonsRoot, d.name, 'lesson.json')))
    .map((d) => d.name)
    .sort()
}

function readLesson(dir) {
  return JSON.parse(readFileSync(join(lessonsRoot, dir, 'lesson.json'), 'utf-8'))
}

/** 按 book 分组并排序（order 升序） */
function groupByBook(lessonDirs) {
  const books = new Map()
  for (const dir of lessonDirs) {
    const lesson = readLesson(dir)
    const book = lesson.book || '未分类'
    if (!books.has(book)) books.set(book, [])
    books.get(book).push({ dir, lesson })
  }
  for (const list of books.values()) {
    list.sort((a, b) => (a.lesson.order ?? 0) - (b.lesson.order ?? 0))
  }
  return books
}

/** 章节聚合（保持出现顺序） */
function buildChapters(entries) {
  const chapters = []
  const index = new Map()
  for (const { dir, lesson } of entries) {
    const title = lesson.chapter || '未分章'
    if (!index.has(title)) {
      index.set(title, chapters.length)
      chapters.push({ title, lessons: [] })
    }
    chapters[index.get(title)].lessons.push(dir)
  }
  return chapters
}

function buildLessonsMeta(entries) {
  return entries.map(({ dir, lesson }) => ({
    id: dir,
    path: `lessons/${dir}`,
    lessonTitle: lesson.lessonTitle || dir,
    order: lesson.order ?? 0,
    chapterTitle: lesson.chapter || '未分章'
  }))
}

/** 书首页 HTML */
function renderBookPage(book, chapters, lessonsMeta) {
  const total = lessonsMeta.length
  const sections = chapters
    .map((ch) => {
      const cards = ch.lessons
        .map((id) => {
          const meta = lessonsMeta.find((m) => m.id === id)
          const link = isDeploy ? `../lessons/${id}/index.html` : `../../lessons/${id}/dist/index.html`
          return `
            <a class="card" href="${link}" target="_blank">
              <div class="card-title">${escapeHtml(meta?.lessonTitle ?? id)}</div>
              <div class="card-meta">${escapeHtml(meta?.chapterTitle ?? '')} · ${escapeHtml(id)}</div>
            </a>`
        })
        .join('\n')
      return `
      <section>
        <h2>${escapeHtml(ch.title)}（${ch.lessons.length} 课）</h2>
        <div class="cards">${cards}</div>
      </section>`
    })
    .join('\n')
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(book)} · 教学互动网页</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; background: #f5f7fa; color: #2c3e50; padding: 32px 16px 48px; }
  header { max-width: 960px; margin: 0 auto 28px; }
  header h1 { font-size: 28px; color: #1a3a5c; }
  header p { margin-top: 8px; color: #7f8c9b; font-size: 14px; }
  main { max-width: 960px; margin: 0 auto; }
  section { margin-bottom: 32px; }
  section h2 { font-size: 18px; color: #1a3a5c; border-left: 4px solid #2f80ed; padding-left: 10px; margin-bottom: 14px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .card { display: block; background: #fff; border: 1px solid #e3e8ef; border-radius: 10px; padding: 16px; text-decoration: none; color: inherit; transition: transform .15s ease, box-shadow .15s ease; }
  .card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(31, 45, 61, .12); }
  .card-title { font-size: 15px; font-weight: 600; color: #1a3a5c; }
  .card-meta { margin-top: 6px; font-size: 12px; color: #9aa5b1; }
  footer { max-width: 960px; margin: 40px auto 0; font-size: 12px; color: #b6bfc9; text-align: center; }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(book)} · 教学互动网页</h1>
  <p>共 ${total} 课，点击卡片进入单课页面</p>
</header>
<main>
${sections}
</main>
<footer>由 scripts/assemble.mjs 自动生成（${new Date().toISOString().slice(0, 10)}）</footer>
</body>
</html>`
}

/** 顶层总览 HTML（仅部署模式，dist-book/index.html） */
function renderOverview(books) {
  const cards = books
    .map(
      (b) => `
      <a class="card" href="./${encodeURIComponent(b)}/index.html">
        <div class="card-title">${escapeHtml(b)}</div>
        <div class="card-meta">进入整书目录</div>
      </a>`
    )
    .join('\n')
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>地理教学互动网页 · 课程总览</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; background: #f5f7fa; color: #2c3e50; padding: 48px 16px; }
  header { max-width: 960px; margin: 0 auto 28px; text-align: center; }
  header h1 { font-size: 28px; color: #1a3a5c; }
  header p { margin-top: 8px; color: #7f8c9b; font-size: 14px; }
  main { max-width: 960px; margin: 0 auto; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .card { display: block; background: #fff; border: 1px solid #e3e8ef; border-radius: 10px; padding: 20px; text-decoration: none; color: inherit; transition: transform .15s ease, box-shadow .15s ease; }
  .card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(31, 45, 61, .12); }
  .card-title { font-size: 17px; font-weight: 600; color: #1a3a5c; }
  .card-meta { margin-top: 6px; font-size: 12px; color: #9aa5b1; }
  footer { max-width: 960px; margin: 40px auto 0; font-size: 12px; color: #b6bfc9; text-align: center; }
</style>
</head>
<body>
<header>
  <h1>地理教学互动网页</h1>
  <p>选择整书进入目录</p>
</header>
<main>
  <div class="cards">${cards}</div>
</main>
<footer>由 scripts/assemble.mjs 自动生成（${new Date().toISOString().slice(0, 10)}）</footer>
</body>
</html>`
}

function main() {
  const lessonDirs = listLessons()
  if (lessonDirs.length === 0) {
    console.log('lessons/ 下没有发现课程')
    return
  }
  const books = groupByBook(lessonDirs)
  if (isDeploy) {
    // 清空并重建 dist-book/（顶层总览与书首页由本脚本写入，课程 dist 由 deploy.mjs 复制）
    rmSync(distBookRoot, { recursive: true, force: true })
    mkdirSync(distBookRoot, { recursive: true })
    writeFileSync(join(distBookRoot, 'index.html'), renderOverview([...books.keys()]))
  }
  for (const [book, entries] of books) {
    const chapters = buildChapters(entries)
    const lessonsMeta = buildLessonsMeta(entries)
    const bookDir = isDeploy ? join(distBookRoot, book) : join(booksRoot, book)
    mkdirSync(bookDir, { recursive: true })

    // 更新 book.json（保留书级元数据，覆盖汇总数据）
    const bookJsonPath = join(booksRoot, book, 'book.json')
    let meta = {}
    if (!isDeploy && existsSync(bookJsonPath)) {
      try {
        meta = JSON.parse(readFileSync(bookJsonPath, 'utf-8'))
      } catch {
        /* 解析失败则按默认重建 */
      }
    }
    const nextBook = {
      book: meta.book || book,
      grade: meta.grade || entries[0].lesson.grade || '高中',
      version: meta.version || '1.0.0',
      status: meta.status || 'draft',
      updatedAt: new Date().toISOString(),
      chapters,
      lessons: lessonsMeta,
      _note: '由 lessons/ 各课 lesson.json 经 scripts/assemble.mjs 自动汇总生成，请勿手改。'
    }
    // 新书首次汇总时 books/<书>/ 可能尚不存在，先补齐目录再写入
    mkdirSync(join(booksRoot, book), { recursive: true })
    writeFileSync(join(booksRoot, book, 'book.json'), JSON.stringify(nextBook, null, 2) + '\n')
    writeFileSync(join(bookDir, 'index.html'), renderBookPage(book, chapters, lessonsMeta))
    console.log(`[汇总] ${book}：${chapters.length} 章 / ${lessonsMeta.length} 课${isDeploy ? '（部署模式）' : ''}`)
  }
  if (isDeploy) {
    console.log(`[部署] 顶层总览已生成：dist-book/index.html`)
  }
}

main()
