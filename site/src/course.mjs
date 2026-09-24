/**
 * Конфигурация курса: модули, уроки и данные для схем.
 *
 * Схемы (mermaid в исходных .md) описаны здесь как данные и рисуются
 * своим HTML-компонентом: так они попадают в общую ретро-стилистику
 * сайта, а не выглядят чужеродной вставкой.
 */

export const SITE = {
  title: 'Vibe Coding без магии',
  tagline: 'Как с помощью AI собрать настоящее приложение.',
  description:
    'Текстовый мини-курс: 5 модулей, 14 уроков. Учимся работать с агентом так, чтобы получалось приложение, а не простыня кода.',
  startLesson: '1-1',
};

/** Уроки по модулям. slug — имя html-файла, file — исходный markdown. */
export const MODULES = [
  {
    num: 1,
    title: 'От идеи к плану',
    lessons: [
      { code: '1.1', slug: '1-1', file: '1.1-идея-в-тз.md', short: 'Идея → ТЗ' },
      { code: '1.2', slug: '1-2', file: '1.2-декомпозиция.md', short: 'ТЗ → план задач' },
      { code: '1.3', slug: '1-3', file: '1.3-настройка-проекта.md', short: 'Настройка проекта' },
    ],
  },
  {
    num: 2,
    title: 'От плана к скелету',
    lessons: [
      { code: '2.1', slug: '2-1', file: '2.1-первый-экран.md', short: 'Первый экран' },
      { code: '2.2', slug: '2-2', file: '2.2-данные.md', short: 'Данные и сохранение' },
      { code: '2.3', slug: '2-3', file: '2.3-время-и-эмоции.md', short: 'Время и эмоции' },
    ],
  },
  {
    num: 3,
    title: 'Отладка без рулетки',
    lessons: [
      { code: '3.1', slug: '3-1', file: '3.1-ошибки.md', short: 'Читаем ошибки' },
      { code: '3.2', slug: '3-2', file: '3.2-изоляция-проблемы.md', short: 'Изоляция проблемы' },
      { code: '3.3', slug: '3-3', file: '3.3-объяснение-кода.md', short: 'Объяснение кода' },
    ],
  },
  {
    num: 4,
    title: 'Страховка',
    lessons: [
      { code: '4.1', slug: '4-1', file: '4.1-тесты.md', short: 'Тесты' },
      { code: '4.2', slug: '4-2', file: '4.2-правки-без-страха.md', short: 'Правки без страха' },
    ],
  },
  {
    num: 5,
    title: 'Доводка и выпуск',
    lessons: [
      { code: '5.1', slug: '5-1', file: '5.1-полировка.md', short: 'Полировка' },
      { code: '5.2', slug: '5-2', file: '5.2-деплой.md', short: 'Деплой' },
      { code: '5.3', slug: '5-3', file: '5.3-шпаргалка.md', short: 'Шпаргалка' },
    ],
  },
];

/** Плоский список уроков с добавленным номером модуля. */
export const LESSONS = MODULES.flatMap((m) =>
  m.lessons.map((l) => ({ ...l, moduleNum: m.num, moduleTitle: m.title })),
);

export const LESSON_BY_SLUG = new Map(LESSONS.map((l) => [l.slug, l]));

/** Соответствие «исходный .md → html-страница» для переписывания ссылок. */
export const LINK_MAP = new Map([
  ['README.md', 'index.html'],
  ...LESSONS.map((l) => [l.file, `${l.slug}.html`]),
]);

/** Маршрут курса: подпись на схеме → урок, который ей соответствует. */
export const ROUTE = [
  { label: 'Идея', slug: '1-1' },
  { label: 'ТЗ', slug: '1-1' },
  { label: 'План задач', slug: '1-2' },
  { label: 'Скелет приложения', slug: '2-1' },
  { label: 'Данные и сохранение', slug: '2-2' },
  { label: 'Отладка', slug: '3-1' },
  { label: 'Тесты и откат', slug: '4-1' },
  { label: 'Полировка', slug: '5-1' },
  { label: 'Деплой', slug: '5-2' },
  { label: 'Готовое приложение', slug: '5-3' },
];

/**
 * Схемы. Ключ — «имя исходного файла#номер схемы в файле».
 * `expect` — отрывок исходного mermaid: если он не найдётся, сборка
 * упадёт, чтобы схема не разошлась с текстом курса незамеченной.
 */
export const DIAGRAMS = {
  'README.md#1': {
    expect: 'Какой агент доступен?',
    kind: 'tree',
    question: 'Какой агент доступен?',
    branches: [
      { edge: 'Работаю в VS Code', node: 'Copilot Chat → режим Agent' },
      { edge: 'Люблю терминал', node: 'Claude Code: запустить claude в папке проекта' },
      { edge: 'Хочу редактор «всё-в-одном»', node: 'Cursor → режим Agent' },
      { edge: 'Ничего из этого', node: 'Поставить Copilot Chat или Claude Code' },
    ],
    converge: 'Дальше уроки одинаковы: задача → diff → запуск → git',
  },

  'README.md#2': {
    expect: 'A[Идея] --> B[ТЗ]',
    kind: 'route',
    caption: 'Маршрут курса: от идеи до опубликованного приложения',
  },

  '2.1-первый-экран.md#1': {
    expect: 'Смотрю diff',
    kind: 'flow',
    steps: [
      { type: 'node', text: 'Запрос агенту: одна задача' },
      { type: 'node', text: 'Агент вносит правки' },
      { type: 'node', text: 'Смотрю diff' },
      {
        type: 'decision',
        text: 'Запускается?',
        branches: [
          {
            edge: 'Нет',
            steps: [
              { type: 'node', text: 'Отправляю текст ошибки + контекст' },
              { type: 'back', text: 'назад к «Агент вносит правки»' },
            ],
          },
          {
            edge: 'Да',
            steps: [
              {
                type: 'decision',
                text: 'Поведение совпадает с ТЗ?',
                branches: [
                  {
                    edge: 'Нет',
                    steps: [
                      { type: 'node', text: 'Описываю расхождение агенту' },
                      { type: 'back', text: 'назад к «Агент вносит правки»' },
                    ],
                  },
                  { edge: 'Да', steps: [{ type: 'node', text: 'Git-коммит рабочей версии' }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  '2.3-время-и-эмоции.md#1': {
    expect: 'Прошло время?',
    kind: 'flow',
    steps: [
      { type: 'node', text: 'Состояние: сытость, настроение, время последнего обновления' },
      {
        type: 'decision',
        text: 'Прошло время?',
        branches: [
          { edge: 'Вкладка открыта: раз в минуту', steps: [{ type: 'node', text: 'Обе шкалы: −1' }] },
          {
            edge: 'Вкладку открыли после паузы',
            steps: [{ type: 'node', text: 'Обе шкалы: −1 за каждую минуту паузы' }],
          },
        ],
      },
      { type: 'node', text: 'Ограничение 0–100' },
      {
        type: 'decision',
        text: 'Пороги эмоции',
        branches: [
          { edge: 'любая шкала ниже 20', steps: [{ type: 'node', text: '😿 грустный' }] },
          { edge: 'обе шкалы выше 80', steps: [{ type: 'node', text: '😸 счастливый' }] },
          { edge: 'иначе', steps: [{ type: 'node', text: '🙂 обычный' }] },
        ],
      },
    ],
  },

  '3.2-изоляция-проблемы.md#1': {
    expect: 'Прячу изменение',
    kind: 'flow',
    steps: [
      { type: 'node', text: 'Что-то сломалось' },
      { type: 'node', text: 'Прячу изменение: git stash' },
      {
        type: 'decision',
        text: 'Без изменения работает?',
        branches: [
          {
            edge: 'Нет',
            steps: [{ type: 'node', text: 'Проблема не в последнем изменении — ищу раньше' }],
          },
          { edge: 'Да', steps: [{ type: 'node', text: 'Последнее изменение — виновник' }] },
        ],
      },
      { type: 'node', text: 'Прошу у агента цепочку причина → следствие' },
      { type: 'node', text: 'Одно точечное исправление' },
      { type: 'node', text: 'Проверяю поведением, коммит' },
    ],
  },

  '4.2-правки-без-страха.md#1': {
    expect: 'Запускаю тесты',
    kind: 'flow',
    steps: [
      { type: 'node', text: 'Рабочая версия в git' },
      { type: 'node', text: 'Правка через агента' },
      { type: 'node', text: 'Запускаю тесты' },
      {
        type: 'decision',
        text: 'Все зелёные?',
        branches: [
          {
            edge: 'Да',
            steps: [{ type: 'node', text: 'Проверяю поведение кликами' }, { type: 'node', text: 'Коммит' }],
          },
          {
            edge: 'Нет',
            steps: [
              { type: 'node', text: 'Читаю упавший тест' },
              { type: 'node', text: 'Прошу одно точечное исправление' },
              { type: 'back', text: 'назад к «Запускаю тесты»' },
            ],
          },
        ],
      },
    ],
  },

  '5.3-шпаргалка.md#1': {
    expect: 'повторить на своей идее',
    kind: 'route',
    caption: 'Весь путь целиком — и возврат к началу на следующей идее',
    loop: true,
  },
};
