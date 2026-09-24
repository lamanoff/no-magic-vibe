/**
 * Скачивает woff2-файлы шрифтов в site/public/fonts.
 * Все три семейства имеют полноценные кириллические подмножества,
 * поэтому русский и латинский текст рисуются одним и тем же шрифтом,
 * без подстановки системных «заменителей».
 *
 *   node tools/fetch-fonts.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'fonts');

const CDN = 'https://cdn.jsdelivr.net/fontsource/fonts';

/** shorthand-ключи: cyr = cyrillic, lat = latin */
const FONTS = [
  { family: 'pt-sans', weights: [400, 700], subsets: ['cyrillic', 'latin'] },
  { family: 'ibm-plex-mono', weights: [400, 700], subsets: ['cyrillic', 'latin'] },
  { family: 'handjet', weights: [400, 700], subsets: ['cyrillic', 'latin'] },
];

const SHORT = { cyrillic: 'cyr', latin: 'lat' };

async function grab(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error(`подозрительно маленький файл (${buf.length} б): ${url}`);
  await writeFile(file, buf);
  return buf.length;
}

await mkdir(outDir, { recursive: true });

let total = 0;
for (const font of FONTS) {
  for (const weight of font.weights) {
    for (const subset of font.subsets) {
      const name = `${font.family}-${SHORT[subset]}-${weight}.woff2`;
      const url = `${CDN}/${font.family}@latest/${subset}-${weight}-normal.woff2`;
      const size = await grab(url, join(outDir, name));
      total += size;
      console.log(`${name.padEnd(30)} ${(size / 1024).toFixed(1)} КБ`);
    }
  }
}
console.log(`\nВсего: ${(total / 1024).toFixed(0)} КБ`);
