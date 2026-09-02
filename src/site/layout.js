"use strict";
/* Каркас страницы. Ничего с чужих доменов: ни шрифтов, ни иконок, ни скриптов.
   Скриптов вообще нет — первый уровень доступа обязан работать без JavaScript. */
const cfg = require("./config");
const T = require("./text");
const A = require("./assets");

const esc = s =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const attr = esc;

/* Дата в человеческом виде: 2026-08-27 → 27.08.2026 */
function dateRu(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso);
}

function head({ title, description, canonical, ogType }) {
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${attr(description)}">`,
    `<link rel="canonical" href="${attr(canonical)}">`,
    `<meta property="og:type" content="${attr(ogType || "website")}">`,
    `<meta property="og:site_name" content="${attr(cfg.siteName)}">`,
    `<meta property="og:locale" content="ru_RU">`,
    `<meta property="og:title" content="${attr(title)}">`,
    `<meta property="og:description" content="${attr(description)}">`,
    `<meta property="og:url" content="${attr(canonical)}">`,
    `<link rel="stylesheet" href="${attr(A.style.url)}">`
  ].join("\n  ");
}

/* Шапка. Имя сайта крупно, под ним отдельная ссылка «На главную»:
   логотип как ссылка очевиден не всем, а читатель здесь бывает пожилой.

   Разделы показаны двумя способами. На широком экране — строкой,
   на узком — выпадающим списком на <details>, то есть без единой строки
   JavaScript: меню обязано открываться и на первом уровне доступа.
   Списка два, и они дублируют друг друга намеренно — переключение
   отдаёт медиазапросу, а не скрипту. */
/* Один список ссылок на три места: строка в шапке, меню на узком экране
   и левая колонка на широком. Переключение отдано медиазапросу, а не скрипту,
   поэтому списки существуют в разметке одновременно. */
const LINKS = [
  ["/oblasti/", "navZones"],
  ["/ukazatel/", "navIndex"],
  ["/chto-ne-razbiraem/", "navNotSearched"],
  ["/chto-ne-delaem/", "navDoesNot"],
  ["/o-spravochnike/", "navAbout"],
  ["/kak-sostavleny/", "navHowMade"],
  ["/soglashenie/", "navTerms"]
];

function navLinks() {
  return LINKS.map(([href, key]) => `<a href="${attr(href)}">${esc(T[key])}</a>`).join("\n      ");
}

function nav(cls) {
  return `<nav class="${cls}">
      ${navLinks()}
    </nav>`;
}

/* Левая колонка: прилипает при прокрутке средствами CSS, без JavaScript.
   Ниже 1200 точек скрыта — там те же ссылки лежат в меню шапки. */
function sideNav() {
  return `<nav class="side">
    <div class="side-inner">
      ${navLinks()}
    </div>
  </nav>`;
}

function header() {
  return `<header class="top">
    <a class="skip" href="#main">${esc(T.skipToContent)}</a>
    <div class="brandbox">
      <a class="brand" href="/">${esc(cfg.siteName)}</a>
      <a class="homelink" href="/">${esc(T.homeLink)}</a>
    </div>
    ${nav("topnav topnav-wide")}
    <details class="topmenu">
      <summary>${esc(T.menu)}</summary>
      ${nav("topnav topnav-narrow")}
    </details>
  </header>`;
}

/* Где просьбы о поддержке быть не должно.
   «Только в подвале» и «ни на страницах статей» — требования совместимые:
   подвал общий, поэтому строку убираем там, где она читалась бы неуместно.
   Страницы статей: рядом стоит поле «когда бывает неотложным».
   Страницы про неотложные состояния: там человеку сказано звонить 103. */
const NO_SUPPORT = ["/sostoyaniya/", "/chto-ne-razbiraem/", "/moego-sluchaya-net/"];
const showSupport = path => !NO_SUPPORT.some(p => path.startsWith(p));

function footer(updated, path) {
  const f = T.footer;
  return `<footer class="bottom">
    <p><strong>${esc(cfg.siteName)} — ${esc(f.lead)}</strong></p>
    <p>${esc(f.body)}</p>
    <p>${esc(f.sources)} ${esc(f.updatedPrefix)} ${esc(dateRu(updated))}</p>
    <p class="tel">${esc(f.emergency)}</p>
    <p>${esc(f.ownerPrefix)} ${esc(cfg.owner.name)}. ${esc(f.mailPrefix)} <a href="mailto:${attr(cfg.owner.mail)}">${esc(cfg.owner.mail)}</a></p>
    <p class="footlinks">
      <a href="/oblasti/">${esc(T.navZones)}</a>
      <a href="/ukazatel/">${esc(T.navIndex)}</a>
      <a href="/chto-ne-razbiraem/">${esc(T.navNotSearched)}</a>
      <a href="/chto-ne-delaem/">${esc(T.navDoesNot)}</a>
      <a href="/o-spravochnike/">${esc(T.navAbout)}</a>
      <a href="/kak-sostavleny/">${esc(T.navHowMade)}</a>
      <a href="/soglashenie/">${esc(T.navTerms)}</a>
    </p>
    ${/* Отдельной неприметной строкой и внизу: ни в шапке, ни в меню её нет. */ ""}
    ${showSupport(path) ? `<p class="footsupport"><a href="/podderzhat/">${esc(T.navSupport)}</a></p>` : ""}
    <p class="age">${esc(f.age)}</p>
  </footer>`;
}

/* Полная страница. body — уже готовый HTML. */
/* scripts — только свои файлы по корневым путям и только там, где надстройка
   действительно нужна. Порядок важен: profil.js кладёт window.EZ_PROFIL,
   остальные его читают. Страница обязана быть полной и без них. */
function page({ title, description, path, body, rail, updated, bodyClass, ogType, script, scripts }) {
  const js = scripts && scripts.length ? scripts : script ? [script] : [];
  const canonical = cfg.origin.replace(/\/$/, "") + path;
  return `<!doctype html>
<html lang="ru">
<head>
  ${head({ title, description, canonical, ogType })}
</head>
<body${bodyClass ? ` class="${attr(bodyClass)}"` : ""}>
${header()}
<div class="layout">
${sideNav()}
<main id="main">
${body}
</main>
${rail ? `<aside class="rail"><div class="rail-inner">\n${rail}\n</div></aside>` : ""}
</div>
${footer(updated, path)}
${js.map(src => `<script src="${attr(src)}" defer></script>`).join("\n")}
</body>
</html>
`;
}

module.exports = { page, esc, attr, dateRu };
