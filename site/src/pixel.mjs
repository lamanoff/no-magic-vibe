/**
 * Пиксельный питомец «Пиксель» — талисман курса.
 * Рисуется из ASCII-сетки, чтобы правки были понятны без графического редактора.
 */

const ART = [
  '...o...o...',
  '..o#o.o#o..',
  '.o###o###o.',
  'o#########o',
  'o##E###E##o',
  'o#########o',
  'o####P####o',
  'o#########o',
  '.o##ooo##o.',
  '..o#####o..',
  '...ooooo...',
];

const COLORS = {
  o: '#181a18', // контур
  '#': '#fbf6e6', // шерсть
  E: '#181a18', // глаза
  P: '#cf5a20', // нос
};

const SIZE = ART[0].length;

/** Горизонтальные «заливки» одним прямоугольником — меньше разметки на выходе. */
function runs() {
  const out = [];
  ART.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let len = 1;
      while (x + len < row.length && row[x + len] === ch) len += 1;
      if (COLORS[ch]) out.push({ x, y, len, fill: COLORS[ch] });
      x += len;
    }
  });
  return out;
}

/**
 * @param {{ background?: string, label?: string }} [options]
 *   background — цвет подложки ('' = прозрачный фон).
 */
export function pixelSvg({ background = '', label = 'Пиксель — питомец курса' } = {}) {
  const body = runs()
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.len}" height="1" fill="${r.fill}"/>`)
    .join('');
  const bg = background
    ? `<rect width="${SIZE}" height="${SIZE}" rx="1.6" fill="${background}"/><rect x="1.4" y="1.4" width="${SIZE - 2.8}" height="${SIZE - 2.8}" fill="none" stroke="#181a18" stroke-opacity=".25" stroke-width=".5"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" shape-rendering="crispEdges" role="img" aria-label="${label}">${bg}${body}</svg>\n`;
}
