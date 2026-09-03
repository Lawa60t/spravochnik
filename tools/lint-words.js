#!/usr/bin/env node
"use strict";
/* Линт формулировок. Запуск: node tools/lint-words.js (входит в npm run build).

   Зачем: 252 теста проверяют порядок статей, validate.js — целостность базы.
   Слова, на которых держится вся правовая линия, не проверяет никто,
   а нарушить их проще всего в служебном тексте — в заголовке вкладки или в описании,
   то есть ровно там, где нет ни плашки, ни подвала, ни контекста.
   Один плохой шаблон title — это 307 нарушений сразу.

   Два уровня, и это важно:

   ЖЁСТКИЙ — по всему собранному тексту, включая статьи. Проценты, «у вас»,
   дозы, «пройдите тест» не должны появиться нигде и ни при каких условиях.

   МЯГКИЙ — только по строкам, которые пишет САЙТ: title, description и src/site/text.js.
   Тексты статей приходят из замороженной базы и под мягкий запрет не попадают:
   там «причина» и «лечение» говорят о болезни, а не о читателе, и это законно.
   В data/ 52 вхождения «причин», 23 «препарат», 22 «лечен» — все правомерные.
   Если бы мягкий уровень бил и по ним, линт отключили бы на второй неделе.

   Исключения — в tools/lint-allow.json, каждое с причиной. Новое совпадение роняет сборку. */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");

/* ---------- запреты ---------- */
const HARD = [
  [/\d+\s*%/, "процент — справочник не считает вероятностей"],
  [/совпадени\w*\s+\d/i, "числовое совпадение"],
  [/точность\s+\d/i, "заявление о точности"],
  [/\bу вас\b/i, "«у вас» — вывод говорит о болезнях, а не о читателе"],
  [/ваш\w*\s+диагноз/i, "«ваш диагноз»"],
  [/вероятн\w*\s+диагноз/i, "«вероятный диагноз»"],
  [/онлайн[-\s]?диагностик/i, "«онлайн-диагностика»"],
  [/определ\w+\s+болезнь/i, "«определить болезнь»"],
  [/пройдите\s+тест/i, "«пройдите тест»"],
  [/начать\s+обследование/i, "«начать обследование»"],
  [/риск\w*\s+на\s+себя/i, "перенос рисков на читателя"],
  [/принимаете\s+риск/i, "перенос рисков на читателя"],
  [/не\s+нес[её]м\s+ответственност/i, "«не несём ответственности»"],
  /* ноль лечения — те же выражения, что ловит validate.js в базе */
  [/\d+\s?мг\b/i, "доза"],
  [/дозиров/i, "дозировка"],
  [/принимать\s+по\b/i, "схема приёма"],
  [/курс\s+антибиотик/i, "схема лечения"],
  [/назначают\s+препарат/i, "назначение препарата"]
];

const SOFT = [
  [/возможн\w*\s+причин/i, "«возможные причины» → «состояния, при которых так бывает»"],
  [/ваши\s+симптом/i, "«ваши симптомы» → «выберите описание, которое ближе»"],
  [/\bсимптом/i, "«симптом» в тексте сайта → «ощущение», «описание»"],
  [/\bанкет/i, "«анкета» → «уточнение»"],
  [/\bопрос\b/i, "«опрос» → «уточнение»"],
  [/пройти\s+тест/i, "«тест» → «уточнение»"],
  [/получить\s+результат/i, "«получить результат» → «показать разделы справочника»"],
  [/ваш\w*\s+результат/i, "«ваш результат» → «раздел справочника»"],
  [/поставим\s+диагноз/i, "обещание диагноза"],
  [/\bдиагностик/i, "«диагностика» в тексте сайта"]
];

/* Сколько символов шаблону позволено добавить к заголовку страницы.
   Хвост раздела — « — раздел справочника · Викитело», 32 символа: имя сайта
   назначения не несёт, поэтому жанр приходится называть словами прямо в title. */
const TITLE_OVERHEAD = 32;

/* Чужие домены, на которые разрешено ссылаться. Только адреса перехода:
   загружать с них что-либо нельзя всё равно. Список ведётся вручную. */
const EXTERNAL_LINKS = ["pay.cloudtips.ru"];

/* Примерно столько показывает поисковик, дальше обрезает. */
const TITLE_DISPLAY = 60;

/* Для страниц, где title не выводится из заголовка, мерить нечего — только длину. */
const TITLE_FIXED_MAX = 65;

/* Страницы, которым разрешена надстройка на JavaScript. Список растёт только
   осознанно: на третьем этапе сюда добавятся страницы разделов с уточнением.
   Всё, чего нет в списке, обязано быть полным без единого скрипта. */
const SCRIPTED = [/^\/index\.html$/, /^\/ukazatel\/index\.html$/, /^\/razdely\/[a-z0-9-]+\/index\.html$/];
const isScripted = rel => SCRIPTED.some(re => re.test(rel));

/* Единственное исключение из списка выше — поиск в шапке. Он стоит на всех
   страницах, потому что иначе его не находят: указатель существует, но до него
   надо додуматься дойти. Правило при этом не ослаблено — оно осталось тем же,
   каким было задумано: страница обязана быть полной без единого скрипта.
   Поле поиска создаётся скриптом и без него не появляется вовсе; на его месте
   остаётся обычная ссылка на указатель, а весь текст страницы уже отрисован.

   Любой другой скрипт на нестраничном списке по-прежнему роняет сборку:
   если уточнение случайно уедет на страницу статьи, это будет видно сразу. */
const HEADER_SEARCH = /^\/poisk\.[0-9a-f]{8}\.js$/;

/* ---------- исключения ---------- */
const allowPath = path.join(__dirname, "lint-allow.json");
const allow = fs.existsSync(allowPath) ? JSON.parse(fs.readFileSync(allowPath, "utf8")).allow || [] : [];
const allowed = (text, where) =>
  allow.some(a => text.includes(a.text) && (!a.where || where.includes(a.where)));

/* ---------- обход dist ---------- */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

/* Все файлы сайта, а не только страницы: заглушка может уцелеть в sitemap или robots. */
function walkAll(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkAll(p, out);
    else out.push(p);
  }
  return out;
}

const decode = s =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const stripTags = html => decode(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));

function run() {
  if (!fs.existsSync(dist)) {
    console.error("Нет папки dist — сначала сборка.");
    process.exit(1);
  }

  const files = walk(dist);
  const errors = [];
  const warnings = [];
  const titles = new Map();

  files.forEach(file => {
    const html = fs.readFileSync(file, "utf8");
    const rel = "/" + path.relative(dist, file).replace(/\\/g, "/");

    const title = decode((html.match(/<title>([\s\S]*?)<\/title>/) || [, ""])[1]);
    const desc = decode(
      (html.match(/<meta name="description" content="([^"]*)"/) || [, ""])[1]
    );
    const text = stripTags(html);

    /* жёсткий уровень — по всему тексту страницы, включая статью */
    HARD.forEach(([re, why]) => {
      const hit = text.match(re) || title.match(re) || desc.match(re);
      if (hit && !allowed(hit[0], rel)) errors.push(`${rel}: «${hit[0]}» — ${why} [жёсткий]`);
    });

    /* мягкий уровень — только title и description */
    SOFT.forEach(([re, why]) => {
      const inTitle = title.match(re);
      const inDesc = desc.match(re);
      if (inTitle && !allowed(inTitle[0], rel)) errors.push(`${rel}: title «${inTitle[0]}» — ${why} [мягкий]`);
      if (inDesc && !allowed(inDesc[0], rel)) errors.push(`${rel}: description «${inDesc[0]}» — ${why} [мягкий]`);
    });

    if (!title) errors.push(`${rel}: нет title`);
    if (!desc) errors.push(`${rel}: нет description`);
    if (!/<link rel="canonical"/.test(html)) errors.push(`${rel}: нет канонического адреса`);
    /* Скрипт допустим только как надстройка и только там, где это решено осознанно.
       Проверяем не «есть ли скрипт», а три вещи: страница в списке разрешённых,
       код лежит в своём файле по корневому пути, встроенного кода нет.
       Чужой домен в src означал бы передачу IP читателя третьей стороне. */
    const scripts = html.match(/<script\b[^>]*>/gi) || [];
    scripts.forEach(tag => {
      const src = (tag.match(/\ssrc="([^"]*)"/i) || [, ""])[1];
      if (!src) { errors.push(`${rel}: встроенный скрипт — код должен лежать своим файлом`); return; }
      if (!/^\/[^/]/.test(src)) { errors.push(`${rel}: скрипт с чужого адреса — ${src}`); return; }
      if (!HEADER_SEARCH.test(src) && !isScripted(rel))
        errors.push(`${rel}: скрипт ${src} на странице, которая обязана работать без JavaScript`);
    });
    /* Внешние адреса. Различаем две вещи, и это принципиально:

       ЗАГРУЗКА чего-либо с чужого домена запрещена всегда — встроенный чужой
       ресурс передаёт IP посетителя третьей стороне, и заявление «не используем
       cookie» перестаёт быть правдой. Скрипты, стили, картинки, шрифты, рамки.

       ПЕРЕХОД по обычной ссылке кук не ставит и приватности не нарушает.
       Разрешённые адреса перехода перечислены поимённо: список короткий
       и должен таким остаться. Каждая такая ссылка обязана открываться
       в новой вкладке с rel="noopener noreferrer".

       Когда в базе появятся URL источников, они всплывут здесь ошибкой —
       и это правильно: решение пускать чужой домен принимается осознанно. */
    const loadTags = []
      .concat(html.match(/<(?:script|img|iframe|video|audio|source|embed|object|track)\b[^>]*>/gi) || [])
      .concat(html.match(/<link\b[^>]*rel="(?:stylesheet|preload|prefetch|icon|manifest|apple-touch-icon)"[^>]*>/gi) || []);
    loadTags.forEach(tag => {
      const url = (tag.match(/\s(?:src|href)="([^"]*)"/i) || [, ""])[1];
      if (url && !/^\/[^/]/.test(url)) errors.push(`${rel}: загрузка не со своего адреса — ${url}`);
    });

    (html.match(/<a\b[^>]*>/gi) || []).forEach(tag => {
      const url = (tag.match(/\shref="([^"]*)"/i) || [, ""])[1];
      if (!/^https?:\/\//i.test(url)) return;
      const host = (url.match(/^https?:\/\/([^/]+)/i) || [, ""])[1];
      if (!EXTERNAL_LINKS.includes(host)) {
        errors.push(`${rel}: ссылка на чужой домен ${host} — разрешённых адресов перехода немного, и этот в список не внесён`);
        return;
      }
      if (!/target="_blank"/i.test(tag) || !/rel="[^"]*noopener[^"]*"/i.test(tag) || !/rel="[^"]*noreferrer[^"]*"/i.test(tag)) {
        errors.push(`${rel}: внешняя ссылка на ${host} без target="_blank" и rel="noopener noreferrer"`);
      }
    });

    /* Меряем не длину title, а накладные расходы шаблона: title минус заголовок страницы.
       Длинное название болезни — это данные, их не сократить и незачем о них напоминать.
       Раздутый хвост шаблона — это наше, и он обрезается в выдаче первым. */
    const h1 = decode(stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ""])[1])).trim();
    if (h1 && title.startsWith(h1)) {
      /* title собран из заголовка страницы: меряем то, что добавил шаблон */
      const overhead = title.length - h1.length;
      /* Ругаемся, только если хвост раздут И заголовок из-за него не помещается
         в выдачу. Короткий заголовок с длинным хвостом вредит там, где обрезается;
         если весь title влезает целиком, обрезать нечего и придираться не к чему. */
      if (overhead > TITLE_OVERHEAD && title.length > TITLE_DISPLAY)
        warnings.push(`${rel}: хвост title ${overhead} символов при длине ${title.length}: «${title}»`);
    } else if (title.length > TITLE_FIXED_MAX) {
      /* title задан целиком, вычитать из него нечего — смотрим просто длину */
      warnings.push(`${rel}: title длиннее ${TITLE_FIXED_MAX} символов (${title.length}): «${title}»`);
    }
    if (desc.length > 170) warnings.push(`${rel}: description длиннее 170 символов (${desc.length})`);

    if (titles.has(title)) warnings.push(`${rel}: title повторяет ${titles.get(title)}`);
    else titles.set(title, rel);
  });

  /* Скрипты не должны ходить на чужие домены: встроенный чужой ресурс передаёт
     IP посетителя третьей стороне, и заявление «не используем cookie» перестаёт
     быть правдой. Проверяем сами файлы, а не только разметку. */
  fs.readdirSync(dist)
    .filter(f => f.endsWith(".js"))
    .forEach(f => {
      const src = fs.readFileSync(path.join(dist, f), "utf8");
      const ext = src.match(/https?:\/\/[^\s"'`]+/g) || [];
      ext.forEach(u => errors.push(`/${f}: обращение на чужой адрес — ${u}`));
    });

  /* Заглушки прошлого этапа не должны уцелеть нигде в собранном сайте:
     ни в канонических адресах, ни в sitemap, ни в robots, ни в почте, ни в текстах. */
  const cfg = require(path.join(root, "src", "site", "config.js"));
  const leftovers = [
    [/example\.(org|ru|com)/i, "адрес-заглушка"],
    [new RegExp(cfg.PLACEHOLDER_MAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "почта-заглушка"],
    /* Регистр важен: «Справочник о теле» — старое имя сайта, а «справочник о теле»
       со строчной — законное пояснение к нынешнему имени. */
    [new RegExp(cfg.WORKING_TITLE), "рабочее название вместо имени сайта"]
  ];
  walkAll(dist).forEach(file => {
    const src = fs.readFileSync(file, "utf8");
    const rel = "/" + path.relative(dist, file).replace(/\\/g, "/");
    leftovers.forEach(([re, why]) => {
      const hit = src.match(re);
      if (hit) errors.push(`${rel}: «${hit[0]}» — ${why}`);
    });
  });

  /* строки, которые пишет сайт */
  const textSrc = fs.readFileSync(path.join(root, "src", "site", "text.js"), "utf8");
  SOFT.concat(HARD).forEach(([re, why]) => {
    const hit = textSrc.match(re);
    if (hit && !allowed(hit[0], "src/site/text.js"))
      errors.push(`src/site/text.js: «${hit[0]}» — ${why}`);
  });

  const L = "─".repeat(58);
  console.log(L);
  console.log("ЛИНТ ФОРМУЛИРОВОК");
  console.log(L);
  console.log(`Страниц проверено          ${files.length}`);
  console.log(`Уникальных title           ${titles.size}`);
  console.log(`Исключений в списке        ${allow.length}`);
  console.log(L);

  if (warnings.length) {
    console.log(`Предупреждений: ${warnings.length}`);
    warnings.slice(0, 12).forEach(w => console.log(`  · ${w}`));
    if (warnings.length > 12) console.log(`  · …и ещё ${warnings.length - 12}`);
    console.log(L);
  }

  if (errors.length) {
    console.log(`Нарушений: ${errors.length}`);
    errors.slice(0, 40).forEach(e => console.log(`  ✗ ${e}`));
    if (errors.length > 40) console.log(`  ✗ …и ещё ${errors.length - 40}`);
    console.log(L);
    process.exit(1);
  }

  console.log("Формулировки чистые.");
  console.log(L);
}

function originOf(html) {
  const m = html.match(/<link rel="canonical" href="(https?:\/\/[^/"]+)/);
  return m ? m[1] : " ";
}

if (require.main === module) run();
module.exports = { run, HARD, SOFT };
