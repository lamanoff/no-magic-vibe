/**
 * Сборка сайта курса.
 *
 *   node build.mjs
 *
 * Читает README.md и уроки из папок «модуль-N-…», отрисовывает страницы
 * и складывает готовый статический сайт в docs/ — именно эту папку
 * отдаёт GitHub Pages (Settings → Pages → Branch: main, папка /docs).
 */
import { readFile, writeFile, mkdir, rm, readdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LESSONS, SITE } from './src/course.mjs';
import {
  ASSET_VERSION,
  LESSON_CHECKS,
  homePage,
  lessonPage,
  notFoundPage,
  renderLesson,
} from './src/render.mjs';
import { pixelSvg } from './src/pixel.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDir = join(root, 'docs');
const assetsDir = join(outDir, 'assets');
const SKIP_DIRS = new Set(['node_modules', 'docs', 'site', '.git']);

/* ───────────────────────── чтение исходников ───────────────────────── */

/** Все markdown-файлы курса: имя файла → абсолютный путь. */
async function collectMarkdown(dir, found = new Map()) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await collectMarkdown(full, found);
    else if (entry.name.endsWith('.md')) {
      if (found.has(entry.name)) throw new Error(`Два файла с именем ${entry.name}`);
      found.set(entry.name, full);
    }
  }
  return found;
}

/* ───────────────────────── запись результата ───────────────────────── */

const written = [];
async function write(relPath, contents) {
  const target = join(outDir, relPath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents, 'utf8');
  written.push({ file: relPath, bytes: Buffer.byteLength(contents, 'utf8') });
}

/* ────────────────────────────── сборка ────────────────────────────── */

const sources = await collectMarkdown(root);
const unread = ['README.md', ...LESSONS.map((l) => l.file)].filter((f) => !sources.has(f));
if (unread.length) throw new Error(`Не найдены исходники: ${unread.join(', ')}`);

ASSET_VERSION.value = '?v=' + new Date().toISOString().slice(0, 10);

await rm(outDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });

// Первый проход — отрисовка. Второй — запись: к моменту записи известны
// размеры чеклистов всех уроков, а без них не посчитать прогресс.
const rendered = new Map();
for (const lesson of LESSONS) {
  const source = await readFile(sources.get(lesson.file), 'utf8');
  const page = renderLesson(lesson.file, source);
  if (!page.checks) throw new Error(`В уроке ${lesson.code} не найден чеклист`);
  LESSON_CHECKS.set(lesson.slug, page.checks);
  rendered.set(lesson.slug, page);
}

const readme = await readFile(sources.get('README.md'), 'utf8');
const home = renderLesson('README.md', readme);

// Главная: README превращается в страницу «О курсе».
await write('index.html', homePage(home));

const report = [];
for (const lesson of LESSONS) {
  const page = rendered.get(lesson.slug);
  await write(`${lesson.slug}.html`, lessonPage(lesson, page));
  report.push({
    code: lesson.code,
    slug: lesson.slug,
    title: page.title,
    sections: page.sections.length,
    checks: page.checks,
    minutes: page.minutes,
  });
}

await write('404.html', notFoundPage());
await write('.nojekyll', '');

// Статика: стили и скрипты копируются как есть, шрифты — из public/.
await copyFile(join(here, 'src', 'styles.css'), join(assetsDir, 'styles.css'));
await copyFile(join(here, 'src', 'app.js'), join(assetsDir, 'app.js'));
written.push({ file: 'assets/styles.css', bytes: 0 }, { file: 'assets/app.js', bytes: 0 });

await write('assets/pixel.svg', pixelSvg());
await write('assets/favicon.svg', pixelSvg({ background: '#0f6f66' }));

const fontsDir = join(here, 'public', 'fonts');
if (existsSync(fontsDir)) {
  const fontsOut = join(assetsDir, 'fonts');
  await mkdir(fontsOut, { recursive: true });
  for (const file of await readdir(fontsDir)) {
    await copyFile(join(fontsDir, file), join(fontsOut, file));
  }
}

/* ────────────────────────────── отчёт ────────────────────────────── */

const kb = (n) => `${(n / 1024).toFixed(1)} КБ`;
console.log(`${SITE.title} — страниц в сборке: ${written.filter((w) => w.file.endsWith('.html')).length}\n`);
console.log('  код   урок                                   секц.  пункты  чтение');
for (const r of report) {
  console.log(
    `  ${r.code.padEnd(6)}${r.title.slice(0, 36).padEnd(38)}${String(r.sections).padStart(3)}` +
      `${String(r.checks).padStart(8)}${String(r.minutes).padStart(8)} мин`,
  );
}

const pages = written.filter((w) => w.file.endsWith('.html'));
const pageBytes = pages.reduce((s, w) => s + w.bytes, 0);
console.log(`\n  html-страниц: ${pages.length}, суммарно ${kb(pageBytes)}`);
console.log(`  выход: ${relative(root, outDir)}/`);
