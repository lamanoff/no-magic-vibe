/**
 * Рендеринг: markdown → секции → страницы.
 *
 * Никаких шаблонизаторов и внешних CSS-фреймворков: разметка собирается
 * строками, потому что структура страницы полностью известна заранее.
 */
import MarkdownIt from 'markdown-it';
import { DIAGRAMS, LESSON_BY_SLUG, LESSONS, MODULES, LINK_MAP, ROUTE, SITE } from './course.mjs';

/* ────────────────────────────── утилиты ────────────────────────────── */

export const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

/** Кириллица → латиница: якоря и имена файлов остаются ASCII. */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
}

/** Короткий стабильный хеш — идентификатор пункта чеклиста. */
export function shortHash(text) {
  let h = 5381;
  const s = String(text).toLowerCase().replace(/\s+/g, ' ').trim();
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const stripTags = (html) => html.replace(/<[^>]*>/g, '');

/** Версия статики: подставляет сборка, чтобы браузер не держал старый CSS. */
export const ASSET_VERSION = { value: '' };

/** Сколько пунктов чеклиста в каждом уроке — заполняет сборка. */
export const LESSON_CHECKS = new Map();

/* ────────────────────────────── схемы ────────────────────────────── */

function renderRoute(caption, loop) {
  const steps = ROUTE.map((step, i) => {
    const lesson = LESSON_BY_SLUG.get(step.slug);
    const arrow = i === 0 ? '' : '<span class="route__arrow" aria-hidden="true">→</span>';
    return `${arrow}<a class="route__step" href="${step.slug}.html" title="Урок ${lesson.code}: ${esc(lesson.short)}"><span class="route__num">${String(i + 1).padStart(2, '0')}</span>${esc(step.label)}</a>`;
  }).join('');

  const loopNote = loop
    ? '<p class="route__loop"><span aria-hidden="true">↺</span> на своей идее — весь путь заново, с урока 1.1</p>'
    : '';

  return `<figure class="fig fig--route">
  <div class="route">${steps}</div>
  ${loopNote}
  ${caption ? `<figcaption class="fig__cap">${esc(caption)}</figcaption>` : ''}
</figure>`;
}

function renderTree(cfg) {
  const branches = cfg.branches
    .map(
      (b) => `<li class="qtree__branch">
        <span class="qtree__edge">${esc(b.edge)}</span>
        <span class="qtree__node">${esc(b.node)}</span>
      </li>`,
    )
    .join('\n      ');

  return `<figure class="fig fig--tree">
  <div class="qtree">
    <p class="qtree__q">${esc(cfg.question)}</p>
    <ul class="qtree__branches">
      ${branches}
    </ul>
    <p class="qtree__merge">${esc(cfg.converge)}</p>
  </div>
</figure>`;
}

function renderFlowSteps(steps, depth = 0) {
  const items = steps
    .map((step) => {
      if (step.type === 'back') {
        return `<li class="flow__item flow__item--back"><span class="flow__back" aria-hidden="true">↰</span> ${esc(step.text)}</li>`;
      }
      if (step.type === 'decision') {
        const branches = step.branches
          .map(
            (b) => `<li class="flow__branch">
          <span class="flow__edge">${esc(b.edge)}</span>
          ${renderFlowSteps(b.steps, depth + 1)}
        </li>`,
          )
          .join('\n        ');
        return `<li class="flow__item flow__item--decision">
        <span class="flow__box flow__box--ask">${esc(step.text)}</span>
        <ul class="flow__branches">
        ${branches}
        </ul>
      </li>`;
      }
      return `<li class="flow__item flow__item--node"><span class="flow__box">${esc(step.text)}</span></li>`;
    })
    .join('\n      ');

  return `<ol class="flow${depth > 0 ? ' flow--sub' : ''}">
      ${items}
    </ol>`;
}

function renderFlow(cfg) {
  return `<figure class="fig fig--flow">${renderFlowSteps(cfg.steps)}</figure>`;
}

/* ────────────────────────────── markdown ────────────────────────────── */

/**
 * Создаёт экземпляр markdown-it, привязанный к исходному файлу:
 * схемы и ссылки разрешаются по имени файла.
 */
function createMd(fileName) {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: false });
  let diagramIndex = 0;

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const info = (token.info || '').trim().toLowerCase();

    if (info === 'mermaid') {
      diagramIndex += 1;
      const key = `${fileName}#${diagramIndex}`;
      const cfg = DIAGRAMS[key];
      if (!cfg) throw new Error(`Нет описания схемы ${key} — добавьте её в src/course.mjs`);
      if (!token.content.includes(cfg.expect)) {
        throw new Error(
          `Схема ${key} в исходнике изменилась (не найден фрагмент «${cfg.expect}»). ` +
            'Проверьте схему и обновите её описание в src/course.mjs.',
        );
      }
      if (cfg.kind === 'route') return renderRoute(cfg.caption, cfg.loop);
      if (cfg.kind === 'tree') return renderTree(cfg);
      if (cfg.kind === 'flow') return renderFlow(cfg);
      throw new Error(`Неизвестный вид схемы: ${cfg.kind}`);
    }

    // Обычный блок кода: разметку добавим на этапе постобработки.
    return `<pre class="code"><code>${esc(token.content.replace(/\n$/, ''))}</code></pre>`;
  };

  // Внутренние .md-ссылки ведут на страницы сайта, внешние открываются в новой вкладке.
  md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
    const token = tokens[idx];
    const hrefIndex = token.attrIndex('href');
    if (hrefIndex >= 0) {
      const raw = token.attrs[hrefIndex][1];
      const decoded = (() => {
        try {
          return decodeURIComponent(raw);
        } catch {
          return raw;
        }
      })();
      const base = decoded.split('/').pop();
      if (LINK_MAP.has(base)) {
        token.attrs[hrefIndex][1] = LINK_MAP.get(base);
      } else if (/^https?:/i.test(decoded)) {
        token.attrSet('target', '_blank');
        token.attrSet('rel', 'noopener noreferrer');
      }
    }
    return self.renderToken(tokens, idx, options);
  };

  return md;
}

/* ──────────────────── постобработка отрендеренных блоков ──────────────────── */

const CODE_LABEL = {
  prompt: 'текст промпта',
  step: 'команды терминала',
  terminal: 'команды терминала',
  plain: 'код',
};

/** Чеклист: `<li>[ ] текст</li>` → настоящие чекбоксы. */
function markTaskItems(html, lessonSlug) {
  let count = 0;
  const out = html.replace(/<li>\[[ x]\] ([\s\S]*?)<\/li>/g, (_m, inner) => {
    const id = `${lessonSlug}.${shortHash(stripTags(inner))}`;
    count += 1;
    return `<li class="check"><label class="check__row"><input class="check__input" type="checkbox" data-check-id="${id}"><span class="check__box" aria-hidden="true"></span><span class="check__text">${inner}</span></label></li>`;
  });
  return { html: out, count };
}

/** Блоки кода превращаем в «окошки» с кнопкой «скопировать». */
function wrapCode(html, kind) {
  return html.replace(
    /<pre class="code"><code>([\s\S]*?)<\/code><\/pre>/g,
    (m, code) =>
      `<div class="term" data-kind="${kind}">
  <div class="term__bar"><span class="term__label">${CODE_LABEL[kind] || 'код'}</span><button class="btn btn--mini" type="button" data-copy>Скопировать</button></div>
  <pre class="term__pre code"><code>${code}</code></pre>
</div>`,
  );
}

/** Таблицы убираем в прокручиваемую обёртку — на узком экране они не влезают. */
function wrapTables(html) {
  return html.replace(
    /<table>[\s\S]*?<\/table>/g,
    (m) => `<div class="table-wrap" role="region" aria-label="Таблица" tabindex="0">${m}</div>`,
  );
}

/* ────────────────────────── секции урока ────────────────────────── */

const KIND_RULES = [
  [/^Шаг\s+\d/i, 'step'],
  [/^Зачем это нужно/i, 'why'],
  [/^Что мы делаем/i, 'what'],
  // без \b: граница слова в JS считается по ASCII и после кириллицы не срабатывает
  [/^(Prompt|Промпт)/i, 'prompt'],
  [/^Что может пойти не так/i, 'risks'],
  [/^Как проверить результат/i, 'check'],
  [/^Практика/i, 'practice'],
  [/^Главное/i, 'summary'],
  [/^Маршрут курса/i, 'route'],
  [/^Карта модулей/i, 'map'],
  [/^Правила работы с агентом/i, 'rules'],
  [/^Кому подходит/i, 'plain'],
  [/^Почему курс работает/i, 'plain'],
  [/^Какой агент выбрать/i, 'plain'],
  [/^Как устроен урок/i, 'plain'],
];

const kindOf = (heading) => {
  for (const [re, kind] of KIND_RULES) if (re.test(heading)) return kind;
  return 'plain';
};

const BADGE = {
  why: '?',
  what: '»',
  prompt: '&gt;',
  risks: '!',
  check: '✓',
  practice: '&#9998;',
  summary: '★',
  plain: '',
  rules: '§',
  map: '',
  route: '',
};

/** Разбивает markdown на заголовок и секции по `## ` (с учётом блоков кода). */
export function parseDocument(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let title = '';
  let index = 0;

  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      index += 1;
      break;
    }
  }

  const preamble = [];
  const sections = [];
  let current = null;
  let inFence = false;

  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*```/.test(line)) inFence = !inFence;

    if (!inFence && /^## /.test(line)) {
      current = { heading: line.slice(3).trim(), lines: [] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
    else preamble.push(line);
  }

  return {
    title,
    preamble: preamble.join('\n').trim(),
    sections: sections.map((s) => ({ heading: s.heading, body: s.lines.join('\n').trim() })),
  };
}

/** Заголовок вида «Урок 2.3. Время и эмоции: …» → «Время и эмоции: …». */
const lessonTitle = (raw) => raw.replace(/^Урок\s+\d+\.\d+\.\s*/, '').trim();

/** Грубая оценка времени чтения: 180 слов в минуту. */
const readingMinutes = (text) => Math.max(2, Math.round(text.split(/\s+/).length / 180));

/**
 * Отрисовывает урок: возвращает секции с готовой разметкой
 * и метаданные (число пунктов чеклиста, время чтения).
 */
export function renderLesson(fileName, source) {
  const md = createMd(fileName);
  const doc = parseDocument(source);
  const slug = LINK_MAP.get(fileName).replace('.html', '');
  let checks = 0;

  const sections = doc.sections.map((section) => {
    const kind = kindOf(section.heading);
    let html = md.render(section.body);

    if (kind === 'check') {
      const marked = markTaskItems(html, slug);
      html = marked.html;
      checks = marked.count;
    }
    if (kind !== 'prompt') html = wrapCode(html, kind === 'step' ? 'step' : 'plain');
    html = wrapTables(html);

    const stepMatch = section.heading.match(/^Шаг\s+(\d+)/i);
    const badge = kind === 'step' ? stepMatch[1] : BADGE[kind] ?? '';
    const id = kind === 'step' ? `shag-${stepMatch[1]}` : slugify(section.heading);

    const caption =
      kind === 'prompt'
        ? '<h2 class="panel__title panel__title--sr">Промпт для агента</h2>'
        : `<h2 class="panel__title">${esc(section.heading)}</h2>`;

    const head = kind === 'prompt'
      ? `<div class="winbar winbar--panel">
        <span class="winbar__pet" aria-hidden="true"></span>
        <span class="winbar__title">Промпт для агента</span>
        <button class="btn btn--mini" type="button" data-copy>Скопировать</button>
      </div>`
      : `<div class="panel__head">
        <span class="panel__badge${badge ? '' : ' panel__badge--mesh'}" aria-hidden="true">${badge}</span>
        ${caption}
        <a class="panel__anchor" href="#${id}" aria-label="Ссылка на раздел">#</a>
      </div>`;

    return {
      kind,
      id,
      badge,
      heading: section.heading,
      body: section.body,
      html: `<section class="panel panel--${kind}" id="${id}" data-section="${kind}">
  ${head}
  <div class="panel__body">${html}</div>
</section>`,
    };
  });

  return {
    title: lessonTitle(doc.title),
    rawTitle: doc.title,
    preamble: doc.preamble,
    checks,
    minutes: readingMinutes(source),
    sections,
  };
}

/* ────────────────────────── карта модулей ────────────────────────── */

export function renderModuleMap() {
  const rows = MODULES.map((m) => {
    const lessons = m.lessons
      .map(
        (l) =>
          `<a class="chip" href="${l.slug}.html" data-lesson-chip="${l.slug}"><b>${l.code}</b> ${esc(l.short)}</a>`,
      )
      .join(' ');
    const total = m.lessons.length;
    return `<tr data-module-row="${m.num}">
      <th scope="row"><span class="map__num">${m.num}</span> ${esc(m.title)}</th>
      <td class="map__lessons">${lessons}</td>
      <td class="map__progress" data-module-progress="${m.num}" data-total="${total}">
        <div class="progress progress--slim"><div class="progress__fill"></div></div>
        <span class="map__count">0 / ${total}</span>
      </td>
    </tr>`;
  }).join('\n');

  return `<div class="table-wrap" role="region" aria-label="Карта модулей" tabindex="0">
  <table class="map">
    <caption class="map__caption">Карта модулей: ${LESSONS.length} уроков, клик по уроку — переход</caption>
    <thead><tr><th scope="col">Модуль</th><th scope="col">Уроки</th><th scope="col">Пройдено</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
}

/* ────────────────────────── каркас страницы ────────────────────────── */

function railHtml(activeSlug) {
  const modules = MODULES.map((m) => {
    const lessons = m.lessons
      .map((l) => {
        const active = l.slug === activeSlug;
        return `<li><a class="tree__link${active ? ' is-active' : ''}" href="${l.slug}.html" data-lesson="${l.slug}"${active ? ' aria-current="page"' : ''}>
          <span class="tree__code">${l.code}</span>
          <span class="tree__name">${esc(l.short)}</span>
          <span class="tree__mark" data-lesson-mark="${l.slug}" aria-hidden="true"></span>
        </a></li>`;
      })
      .join('\n');
    return `<div class="tree__group" data-module="${m.num}">
      <p class="tree__head"><span class="tree__headnum">Модуль ${m.num}</span><span class="tree__headtitle">${esc(m.title)}</span><span class="tree__headcount" data-module-mark="${m.num}">0/${m.lessons.length}</span></p>
      <ul class="tree__list">
${lessons}
      </ul>
    </div>`;
  }).join('\n');

  return `<aside class="rail" id="rail" aria-label="Программа курса">
  <div class="rail__inner">
    <div class="rail__win">
      <div class="winbar">
        <span class="winbar__pet" aria-hidden="true"></span>
        <span class="winbar__title">Программа</span>
        <span class="winbar__meta" data-progress-count>0 / ${LESSONS.length}</span>
      </div>
      <div class="rail__body">
        <div class="progress progress--big"><div class="progress__fill" data-progress-fill></div></div>
        <p class="rail__hint" data-progress-hint>Прогресс хранится в этом браузере.</p>
        <nav class="tree">
${modules}
        </nav>
        <button class="btn btn--mini btn--wide" type="button" data-reset>Сбросить прогресс</button>
      </div>
    </div>
  </div>
</aside>`;
}

const courseDataScript = () =>
  `<script type="application/json" id="course-data">${JSON.stringify({
    version: 1,
    total: LESSONS.length,
    start: SITE.startLesson,
    lessons: LESSONS.map((l) => ({
      slug: l.slug,
      code: l.code,
      short: l.short,
      module: l.moduleNum,
      checks: LESSON_CHECKS.get(l.slug) || 0,
    })),
  }).replace(/</g, '\\u003c')}</script>`;

function topbarHtml() {
  return `<header class="topbar">
  <div class="topbar__inner">
    <button class="btn btn--mini rail-toggle" type="button" data-rail-toggle aria-controls="rail" aria-expanded="false">Программа</button>
    <a class="brand" href="index.html">
      <img class="brand__pet" src="assets/pixel.svg${ASSET_VERSION.value}" alt="" width="26" height="26">
      <span class="brand__name">Vibe Coding <b>без магии</b></span>
    </a>
    <nav class="topnav" aria-label="Разделы сайта">
      <a href="index.html">О курсе</a>
      <a href="index.html#karta-modulej">Модули</a>
      <a href="index.html#marshrut-kursa">Маршрут</a>
    </nav>
  </div>
</header>`;
}

const statusbarHtml = () =>
  `<footer class="statusbar">
  <p class="statusbar__cell statusbar__cell--hide-sm">${LESSONS.length} уроков · ${MODULES.length} модулей</p>
  <p class="statusbar__cell statusbar__cell--grow" data-status role="status">Готово</p>
  <p class="statusbar__cell">Пройдено: <b data-progress-total>0 из ${LESSONS.length}</b></p>
  <p class="statusbar__cell statusbar__cell--hide-sm" data-clock>--:--</p>
</footer>`;

export function layout({ title, description, bodyClass = '', content, activeSlug = '' }) {
  const fullTitle = title ? `${title} — ${SITE.title}` : `${SITE.title}: ${SITE.tagline}`;
  const v = ASSET_VERSION.value;
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || SITE.description)}">
<meta name="color-scheme" content="light">
<link rel="icon" href="assets/favicon.svg${v}" type="image/svg+xml">
<link rel="stylesheet" href="assets/styles.css${v}">
</head>
<body class="page ${bodyClass}"${activeSlug ? ` data-current-lesson="${activeSlug}"` : ''}>
${topbarHtml()}
<div class="shell">
${railHtml(activeSlug)}
<main class="content" id="content">
${content}
</main>
</div>
${statusbarHtml()}
${courseDataScript()}
<script src="assets/app.js${ASSET_VERSION.value}" defer></script>
</body>
</html>
`;
}

/* ────────────────────────── страницы ────────────────────────── */

/** Навигация «предыдущий / следующий» внизу урока. */
function lessonPager(lesson) {
  const i = LESSONS.findIndex((l) => l.slug === lesson.slug);
  const prev = LESSONS[i - 1];
  const next = LESSONS[i + 1];

  const cell = (item, dir) => {
    if (!item) return '<span class="pager__cell pager__cell--empty" aria-hidden="true"></span>';
    const isNext = dir === 'next';
    return `<a class="pager__cell${isNext ? ' pager__cell--next' : ''}" href="${item.slug}.html">
      <span class="pager__dir">${isNext ? 'Следующий урок →' : '← Предыдущий урок'}</span>
      <span class="pager__title"><b>${item.code}</b> ${esc(item.short)}</span>
    </a>`;
  };

  return `<nav class="pager" aria-label="Навигация по урокам">
    ${cell(prev, 'prev')}
    ${cell(next, 'next')}
  </nav>`;
}

function lessonToc(rendered) {
  const links = rendered.sections
    .map((s) => {
      const short = s.kind === 'step' ? `Шаг ${s.badge}` : s.heading;
      return `<a class="toc__link" href="#${s.id}" title="${esc(s.heading)}"><span class="toc__badge" aria-hidden="true">${s.badge}</span><span class="toc__label">${esc(short)}</span></a>`;
    })
    .join('\n      ');
  return `<nav class="toc" aria-label="Содержание урока">
      ${links}
    </nav>`;
}

export function lessonPage(lesson, rendered) {
  return layout({
    title: `Урок ${lesson.code}. ${rendered.title}`,
    description: `${rendered.rawTitle}. Модуль ${lesson.moduleNum}: ${lesson.moduleTitle}.`,
    bodyClass: 'page--lesson',
    activeSlug: lesson.slug,
    content: `<article class="lesson" data-lesson="${lesson.slug}" data-checks="${rendered.checks}">
  <div class="lesson__win">
    <div class="winbar winbar--lesson">
      <span class="winbar__pet" aria-hidden="true"></span>
      <span class="winbar__title">Урок ${lesson.code}. ${esc(rendered.title)}</span>
      <span class="winbar__meta">${rendered.minutes} мин чтения</span>
    </div>
    <div class="lesson__head">
      <p class="lesson__crumb"><a href="index.html#karta-modulej">Программа</a> <span aria-hidden="true">›</span> Модуль ${lesson.moduleNum}. ${esc(lesson.moduleTitle)}</p>
      <h1 class="lesson__title">${esc(rendered.title)}</h1>
      <p class="lesson__stamp" data-lesson-stamp hidden></p>
    </div>
  </div>

  ${lessonToc(rendered)}

  <div class="lesson__sections">
    ${rendered.sections.map((s) => s.html).join('\n')}
  </div>

  ${lessonPager(lesson)}
</article>`,
  });
}

export function homePage(readmeRendered) {
  const { hero, sections } = homeSections(readmeRendered);

  return layout({
    title: '',
    bodyClass: 'page--home',
    content: `<div class="hero">
  <div class="hero__win">
    <div class="winbar winbar--hero">
      <span class="winbar__pet" aria-hidden="true"></span>
      <span class="winbar__title">Vibe Coding без магии</span>
    </div>
    <div class="hero__body">
      <p class="hero__kicker">мини-курс · ${MODULES.length} модулей · ${LESSONS.length} уроков</p>
      <h1 class="hero__title">Vibe Coding<br><b>без магии</b></h1>
      <p class="hero__lead">${esc(SITE.tagline)}</p>
      <dl class="hero__meta">
        ${hero.meta.map((m) => `<div class="hero__row"><dt>${esc(m.term)}</dt><dd>${m.valueHtml}</dd></div>`).join('\n        ')}
      </dl>
      <div class="hero__actions">
        <a class="btn btn--primary btn--big" href="${SITE.startLesson}.html" data-start-link>Начать курс</a>
        <a class="btn btn--big" href="#karta-modulej">Карта модулей</a>
      </div>
      <div class="hero__progress">
        <div class="progress progress--hero"><div class="progress__fill" data-progress-fill></div></div>
        <p class="hero__progress-text" data-hero-progress>Пройдено 0 из ${LESSONS.length} уроков</p>
      </div>
    </div>
  </div>
</div>

<div class="lesson__sections">
  ${sections.join('\n')}
</div>`,
  });
}

/** Разбирает преамбулу README в блок героя, а секции — в панели. */
function homeSections(rendered) {
  const meta = [];

  for (const line of rendered.preamble.split('\n')) {
    const m = line.match(/^\*\*(.+?):\*\*\s*(.+)$/);
    if (m) meta.push({ term: m[1], valueHtml: valueToHtml(m[2]) });
  }

  const md = createMd('README.md');
  const sections = rendered.sections.map((section, i) => {
    const kind = kindOf(section.heading);
    const id = slugify(section.heading);
    let html;
    if (kind === 'map') {
      html = renderModuleMap();
    } else {
      html = md.render(section.body);
      html = wrapCode(html, 'terminal');
      html = wrapTables(html);
    }
    const badge = BADGE[kind] ?? '';
    return `<section class="panel panel--${kind}" id="${id}">
  <div class="panel__head">
    <span class="panel__badge${badge ? '' : ' panel__badge--mesh'}" aria-hidden="true">${badge}</span>
    <h2 class="panel__title">${esc(section.heading)}</h2>
    <a class="panel__anchor" href="#${id}" aria-label="Ссылка на раздел">#</a>
  </div>
  <div class="panel__body">${html}</div>
</section>`;
  });

  return { hero: { meta }, sections };
}

/** Инлайновая разметка внутри строк «**Формат:** …» — только `код` и ссылки. */
function valueToHtml(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

export function notFoundPage() {
  return layout({
    title: 'Страница не найдена',
    bodyClass: 'page--error',
    content: `<div class="errorpage">
  <div class="errorpage__win">
    <div class="winbar winbar--error">
      <span class="winbar__pet" aria-hidden="true"></span>
      <span class="winbar__title">Ошибка 404</span>
    </div>
    <div class="errorpage__body">
      <p class="errorpage__code" aria-hidden="true">404</p>
      <h1 class="errorpage__title">Такой страницы нет</h1>
      <p class="errorpage__text">Ссылка устарела или в адресе опечатка. Похоже, этот урок ещё не написан — или уже переехал.</p>
      <p class="errorpage__actions">
        <a class="btn btn--primary btn--big" href="index.html">К началу курса</a>
        <a class="btn btn--big" href="${SITE.startLesson}.html">Урок 1.1</a>
      </p>
    </div>
  </div>
</div>`,
  });
}
