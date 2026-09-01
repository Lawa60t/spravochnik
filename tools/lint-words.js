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

/* Сколько символов шаблону позволено добавить к заголовку страницы. */
const TITLE_OVERHEAD = 30;

/* Страницы, которым разрешена надстройка на JavaScript. Список растёт только
   осознанно: на третьем этапе сюда добавятся страницы разделов с уточнением.
   Всё, чего нет в списке, обязано быть полным без единого скрипта. */
const SCRIPTED = new Set(["/ukazatel/index.html"]);

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
    if (scripts.length && !SCRIPTED.has(rel))
      errors.push(`${rel}: скрипт на странице, которая обязана работать без JavaScript`);
    scripts.forEach(tag => {
      const src = (tag.match(/\ssrc="([^"]*)"/i) || [, ""])[1];
      if (!src) errors.push(`${rel}: встроенный скрипт — код должен лежать своим файлом`);
      else if (!/^\/[^/]/.test(src)) errors.push(`${rel}: скрипт с чужого адреса — ${src}`);
    });
    if (/https?:\/\/(?!схема|www\.sitemaps\.org)/.test(html.replace(/<link rel="canonical"[^>]*>|<meta property="og:url"[^>]*>/g, ""))) {
      const ext = html.match(/https?:\/\/[^"'\s>]+/g) || [];
      const foreign = ext.filter(u => !u.startsWith("http://www.sitemaps.org") && !u.startsWith(originOf(html)));
      if (foreign.length) warnings.push(`${rel}: внешний адрес ${foreign[0]}`);
    }

    /* Меряем не длину title, а накладные расходы шаблона: title минус заголовок страницы.
       Длинное название болезни — это данные, их не сократить и незачем о них напоминать.
       Раздутый хвост шаблона — это наше, и он обрезается в выдаче первым. */
    const h1 = decode(stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ""])[1])).trim();
    const overhead = title.length - h1.length;
    if (h1 && overhead > TITLE_OVERHEAD)
      warnings.push(`${rel}: хвост title длиннее ${TITLE_OVERHEAD} символов (${overhead}): «${title}»`);
    if (desc.length > 170) warnings.push(`${rel}: description длиннее 170 символов (${desc.length})`);

    if (titles.has(title)) warnings.push(`${rel}: title повторяет ${titles.get(title)}`);
    else titles.set(title, rel);
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
