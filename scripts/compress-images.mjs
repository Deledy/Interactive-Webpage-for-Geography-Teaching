/* ============================================================
  图片压缩脚本 —— 压缩单课 assets/images 下的大图
  使用 sharp 进行高质量压缩，保证画质
  ============================================================ */

import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMG_DIR = join(__dirname, '..', 'lessons', 'geo01-earth-universe', 'assets', 'images');

// 待压缩图片配置: [文件名, 最大尺寸(px), JPEG质量, 是否保留原格式]
const TASKS = [
  // 尺寸 + 压缩
  { file: 'celestial-planet-earth.jpg', maxWidth: 2560, quality: 85, outputFormat: 'jpeg' },
  // PNG → JPEG
  { file: 'celestial-satellite-europa.png', maxWidth: 0, quality: 90, outputFormat: 'jpeg' },
  { file: 'celestial-planet-jupiter.png', maxWidth: 0, quality: 90, outputFormat: 'jpeg' },
  // 纯压缩
  { file: 'celestial-comet-halley.jpg', maxWidth: 0, quality: 85, outputFormat: 'jpeg' },
];

// 备份目录
const BACKUP_DIR = join(IMG_DIR, '_backup');

function fmtBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

async function getExt(format) {
  return format === 'jpeg' ? '.jpg' : '.' + format;
}

async function main() {
  console.log('📦 图片压缩脚本\n');
  console.log(`源目录: ${IMG_DIR}\n`);

  let totalBefore = 0;
  let totalAfter = 0;

  for (const task of TASKS) {
    const srcPath = join(IMG_DIR, task.file);
    let srcStats;
    try {
      srcStats = await stat(srcPath);
    } catch {
      console.log(`⚠️  跳过（文件不存在）: ${task.file}`);
      continue;
    }
    totalBefore += srcStats.size;

    // 输出文件名
    const ext = await getExt(task.outputFormat);
    const baseName = task.file.replace(/\.[^.]+$/, '');
    const outName = baseName + ext;
    const outPath = join(IMG_DIR, outName);

    // 备份原文件
    const backupPath = join(BACKUP_DIR, task.file);
    await copyWithDir(srcPath, backupPath);

    // 避免输入输出同名：先写到临时文件
    const tmpPath = outPath + '.tmp';
    let pipeline = sharp(srcPath);

    // 调整尺寸
    if (task.maxWidth > 0) {
      pipeline = pipeline.resize(task.maxWidth, task.maxWidth, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // 输出
    if (task.outputFormat === 'jpeg') {
      pipeline = pipeline.jpeg({ quality: task.quality, mozjpeg: true });
    } else if (task.outputFormat === 'png') {
      pipeline = pipeline.png({ quality: task.quality, compressionLevel: 9 });
    }

    await pipeline.toFile(tmpPath);

    // 覆盖原文件（仅当同名时）；不同名时已在上方删除原文件
    const { rename } = await import('node:fs/promises');
    if (outName === task.file) {
      await rename(tmpPath, outPath);
    } else {
      await rename(tmpPath, outPath);
    }

    // 如果格式变了，删除原文件
    if (outName !== task.file) {
      const { unlink } = await import('node:fs/promises');
      await unlink(srcPath);
    }

    const outStats = await stat(outPath);
    totalAfter += outStats.size;
    const ratio = ((1 - outStats.size / srcStats.size) * 100).toFixed(1);

    console.log(`✅ ${task.file} → ${outName}`);
    console.log(`   ${fmtBytes(srcStats.size)} → ${fmtBytes(outStats.size)}  (减小 ${ratio}%)\n`);
  }

  console.log('━'.repeat(50));
  console.log(`📊 总计: ${fmtBytes(totalBefore)} → ${fmtBytes(totalAfter)}`);
  console.log(`   减小 ${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%，节省 ${fmtBytes(totalBefore - totalAfter)}`);
  console.log(`\n💡 原文件已备份到: ${BACKUP_DIR}`);
  console.log('   确认无误后可手动删除备份目录。');
}

async function copyWithDir(src, dest) {
  const { mkdir, copyFile } = await import('node:fs/promises');
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(src, dest);
}

main().catch(err => {
  console.error('❌ 压缩失败:', err.message);
  process.exit(1);
});
