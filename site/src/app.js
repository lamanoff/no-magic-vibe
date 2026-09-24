/* ==========================================================================
   Прогресс курса.
   Состояние живёт в localStorage: какие пункты чеклистов отмечены, какие
   уроки пройдены (урок считается пройденным, когда отмечены все его пункты).
   ========================================================================== */
(() => {
  'use strict';

  const STORAGE_KEY = 'vibe-coding-progress-v1';
  const DEFAULT_STATUS = 'Готово';

  /* ── данные курса, вшитые в страницу ─────────────────────────────────── */
  const dataEl = document.getElementById('course-data');
  const DATA = dataEl ? JSON.parse(dataEl.textContent) : { lessons: [], total: 0, start: '1-1' };
  const BY_SLUG = new Map(DATA.lessons.map((l) => [l.slug, l]));
  const currentSlug = document.body.dataset.currentLesson || '';

  /* ── состояние ───────────────────────────────────────────────────────── */
  const empty = () => ({ v: 1, items: {}, done: {}, last: '' });
  let state = empty();
  let storageOk = true;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = Object.assign(empty(), parsed, { items: parsed.items || {}, done: parsed.done || {} });
    }
  } catch (err) {
    storageOk = false;
  }

  function save() {
    if (!storageOk) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      storageOk = false;
      status('Прогресс не сохраняется: браузер запретил хранилище');
    }
  }

  /* ── подсчёты ────────────────────────────────────────────────────────── */
  const totalOf = (slug) => (BY_SLUG.get(slug) || {}).checks || 0;

  function markedOf(slug) {
    const prefix = slug + '.';
    let n = 0;
    for (const key of Object.keys(state.items)) {
      if (state.items[key] && key.startsWith(prefix)) n += 1;
    }
    return n;
  }

  const isDone = (slug) => totalOf(slug) > 0 && markedOf(slug) >= totalOf(slug);
  const doneLessons = () => DATA.lessons.filter((l) => isDone(l.slug)).length;

  const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

  /* ── строка состояния ────────────────────────────────────────────────── */
  const statusEl = document.querySelector('[data-status]');
  let statusTimer = 0;

  function status(text, sticky = false) {
    if (!statusEl) return;
    statusEl.textContent = text;
    window.clearTimeout(statusTimer);
    if (!sticky) statusTimer = window.setTimeout(() => (statusEl.textContent = DEFAULT_STATUS), 4000);
  }

  const setWidth = (el, pct) => {
    if (el) el.style.width = pct + '%';
  };

  /* ── отрисовка прогресса ─────────────────────────────────────────────── */
  const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });

  function refresh() {
    // Метки у уроков в боковой панели.
    document.querySelectorAll('[data-lesson-mark]').forEach((mark) => {
      const slug = mark.dataset.lessonMark;
      mark.classList.toggle('is-done', isDone(slug));
      mark.classList.toggle('is-partial', !isDone(slug) && markedOf(slug) > 0);
    });

    // Счётчики модулей.
    document.querySelectorAll('[data-module-mark]').forEach((el) => {
      const num = Number(el.dataset.moduleMark);
      const lessons = DATA.lessons.filter((l) => l.module === num);
      const done = lessons.filter((l) => isDone(l.slug)).length;
      el.textContent = `${done}/${lessons.length}`;
    });

    // Общий прогресс.
    const done = doneLessons();
    const pct = percent(done, DATA.total);
    document.querySelectorAll('[data-progress-fill]').forEach((el) => setWidth(el, pct));
    document.querySelectorAll('[data-progress-total]').forEach((el) => {
      el.textContent = `${done} из ${DATA.total}`;
    });
    document.querySelectorAll('[data-progress-count]').forEach((el) => {
      el.textContent = `${done} / ${DATA.total}`;
    });
    document.querySelectorAll('[data-hero-progress]').forEach((el) => {
      el.textContent = `Пройдено ${done} из ${DATA.total} уроков`;
    });
    document.querySelectorAll('[data-progress-hint]').forEach((el) => {
      el.textContent = storageOk
        ? done
          ? `Пройдено ${done} из ${DATA.total}. Отметки сохраняются в этом браузере.`
          : 'Отметьте пункты чеклиста — прогресс сохранится в этом браузере.'
        : 'Браузер запретил локальное хранилище: прогресс не сохранится.';
    });

    // Строка «Продолжить» на главной.
    const startLink = document.querySelector('[data-start-link]');
    if (startLink) {
      const started = Object.keys(state.items).length > 0;
      const last = state.last && BY_SLUG.has(state.last) ? BY_SLUG.get(state.last) : null;
      const target =
        (last && !isDone(last.slug) ? last : null) ||
        DATA.lessons.find((l) => !isDone(l.slug)) ||
        DATA.lessons[0];
      if (target) {
        startLink.href = `${target.slug}.html`;
        startLink.textContent = started ? `Продолжить: урок ${target.code}` : 'Начать курс';
      }
    }

    // Чипы в карте модулей.
    document.querySelectorAll('[data-lesson-chip]').forEach((chip) => {
      chip.classList.toggle('is-done', isDone(chip.dataset.lessonChip));
    });

    // Прогресс модуля в таблице.
    document.querySelectorAll('[data-module-progress]').forEach((cell) => {
      const num = Number(cell.dataset.moduleProgress);
      const total = Number(cell.dataset.total);
      const lessons = DATA.lessons.filter((l) => l.module === num);
      const doneCount = lessons.filter((l) => isDone(l.slug)).length;
      setWidth(cell.querySelector('.progress__fill'), percent(doneCount, total));
      const count = cell.querySelector('.map__count');
      if (count) count.textContent = `${doneCount} / ${total}`;
    });

    renderStamp();
  }

  /* ── отметка «урок пройден» ──────────────────────────────────────────── */
  function renderStamp() {
    const stamp = document.querySelector('[data-lesson-stamp]');
    if (!stamp || !currentSlug) return;
    const complete = isDone(currentSlug);
    if (!complete) {
      stamp.hidden = true;
      return;
    }
    if (!state.done[currentSlug]) {
      state.done[currentSlug] = Date.now();
      save();
    }
    stamp.hidden = false;
    stamp.textContent = `Урок пройден · ${dateFmt.format(new Date(state.done[currentSlug]))}`;
  }

  /* ── чеклисты ────────────────────────────────────────────────────────── */
  function initChecks() {
    const boxes = document.querySelectorAll('.check__input[data-check-id]');
    boxes.forEach((box) => {
      box.checked = Boolean(state.items[box.dataset.checkId]);
      box.addEventListener('change', () => {
        if (box.checked) state.items[box.dataset.checkId] = 1;
        else delete state.items[box.dataset.checkId];
        save();
        refresh();

        if (!currentSlug) return;
        const marked = markedOf(currentSlug);
        const total = totalOf(currentSlug);
        if (total && marked >= total) {
          status('Урок пройден: все пункты чеклиста отмечены');
        } else {
          status(`Отмечено ${marked} из ${total}`);
        }
      });
    });
  }

  /* ── кнопки «скопировать» ────────────────────────────────────────────── */
  function initCopy() {
    document.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const scope = btn.closest('.term, .panel');
        const code = scope && scope.querySelector('pre code');
        if (!code) return;
        const text = code.textContent;
        try {
          await navigator.clipboard.writeText(text);
          status('Промпт скопирован в буфер обмена');
        } catch (err) {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand('copy');
          ta.remove();
          status(ok ? 'Промпт скопирован в буфер обмена' : 'Скопируйте текст вручную');
        }
      });
    });
  }

  /* ── боковая панель на узких экранах ─────────────────────────────────── */
  function initRail() {
    const rail = document.getElementById('rail');
    const toggle = document.querySelector('[data-rail-toggle]');
    if (!rail || !toggle) return;

    const setOpen = (open) => {
      rail.classList.toggle('is-open', open);
      document.body.classList.toggle('page--rail-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };

    toggle.addEventListener('click', () => setOpen(!rail.classList.contains('is-open')));
    rail.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });
    document.addEventListener('click', (event) => {
      if (!rail.classList.contains('is-open')) return;
      if (rail.contains(event.target) || toggle.contains(event.target)) return;
      setOpen(false);
    });
  }

  /* ── сброс прогресса ─────────────────────────────────────────────────── */
  function initReset() {
    const btn = document.querySelector('[data-reset]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const marked = Object.keys(state.items).length;
      if (marked === 0) {
        status('Прогресс и так пуст');
        return;
      }
      if (!window.confirm('Сбросить прогресс курса? Отметки будут удалены из этого браузера.')) return;
      state = empty();
      save();
      document.querySelectorAll('.check__input[data-check-id]').forEach((box) => {
        box.checked = false;
      });
      refresh();
      status('Прогресс сброшен');
    });
  }

  /* ── содержание урока: подсветка текущего раздела ────────────────────── */
  function initToc() {
    const links = Array.from(document.querySelectorAll('.toc__link'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const visible = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });
        const order = Array.from(document.querySelectorAll('.panel[id]')).map((s) => s.id);
        const current = order.find((id) => visible.has(id));
        links.forEach((a) => a.classList.remove('is-current'));
        if (current && byId.has(current)) {
          byId.get(current).classList.add('is-current');
          const holder = byId.get(current).parentElement;
          if (holder && holder.scrollWidth > holder.clientWidth) {
            byId.get(current).scrollIntoView({ block: 'nearest', inline: 'nearest' });
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );

    document.querySelectorAll('.panel[id]').forEach((section) => observer.observe(section));
  }

  /* ── часы в строке состояния ─────────────────────────────────────────── */
  function initClock() {
    const el = document.querySelector('[data-clock]');
    if (!el) return;
    const tick = () => {
      const now = new Date();
      el.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    };
    tick();
    window.setInterval(tick, 20000);
  }

  /* ── запуск ──────────────────────────────────────────────────────────── */
  function init() {
    if (currentSlug) {
      state.last = currentSlug;
      save();
    }
    initChecks();
    initCopy();
    initRail();
    initReset();
    initToc();
    initClock();
    refresh();

    if (!storageOk) status('Браузер запретил локальное хранилище: прогресс не сохранится', true);
    else status(DEFAULT_STATUS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
