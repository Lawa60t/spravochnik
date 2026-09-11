"use strict";
/* Каркас страницы. Ничего с чужих доменов: ни шрифтов, ни иконок, ни скриптов.
   Скриптов вообще нет — первый уровень доступа обязан работать без JavaScript. */
const cfg = require("./config");
const T = require("./text");
const A = require("./assets");
const POISK = require("./poisk-index");

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
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png">`,
    `<link rel="icon" href="/favicon.ico" sizes="any">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
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
   поэтому списки существуют в разметке одновременно.

   Пунктов четыре, а не восемь: два входа в оглавление, поиск и хаб
   «О справочнике». Служебные страницы из меню не пропали — они собраны
   под хабом (HUB ниже) и там же перечислены на самой странице. */
const LINKS = [
  ["/vybor/", "navChoose"],
  ["/oblasti/", "navZones"],
  ["/ukazatel/", "navIndex"],
  ["/o-spravochnike/", "navAbout"]
];

const HUB = [
  ["/o-spravochnike/", "about"],
  ["/kak-sostavleny/", "howMade"],
  ["/chto-ne-delaem/", "doesNot"],
  ["/chto-ne-razbiraem/", "notSearched"],
  ["/soglashenie/", "terms"]
];

const current = (href, path) => (href === path ? ' aria-current="page"' : "");

/* Пять ссылок хаба одним списком: он же стоит в левом меню, в меню шапки
   и на странице «О справочнике» — чтобы ни один набор не разошёлся с другим. */
function hubLinks(path, cls) {
  return HUB.map(([href, key]) => `<a${cls ? ` class="${cls}"` : ""} href="${attr(href)}"${current(href, path)}>${esc(T.hub[key])}</a>`).join("\n        ");
}

/* Строка в шапке и выпадающее меню: те же четыре пункта, без подписей —
   на узком экране им негде разворачиваться. Ссылки хаба идут следом
   отдельной группой, чтобы соглашение и «что не разбирают» открывались
   из меню на любом экране, а не только с широкого. */
function nav(cls, path) {
  return `<nav class="${cls}">
      ${LINKS.map(([href, key]) => `<a href="${attr(href)}"${current(href, path)}>${esc(T[key])}</a>`).join("\n      ")}
      <span class="topnav-group">
        ${hubLinks(path, "topnav-sub")}
      </span>
    </nav>`;
}

/* Значки меню — встроенный SVG, чтобы ни одного запроса за картинкой
   не было. Фигура та же, что на карточке главной и на странице модели. */
function figureSvg(w, h) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 44 64" aria-hidden="true" focusable="false"><g fill="currentColor"><circle cx="22" cy="9" r="7"/><rect x="14" y="18" width="16" height="24" rx="7"/><rect x="5" y="20" width="7" height="20" rx="3.5"/><rect x="32" y="20" width="7" height="20" rx="3.5"/><rect x="15" y="40" width="6.5" height="22" rx="3.2"/><rect x="22.5" y="40" width="6.5" height="22" rx="3.2"/></g></svg>`;
}

function listSvg(w, h) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 40 58" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="8" y1="12" x2="32" y2="12"/><line x1="8" y1="22" x2="32" y2="22"/><line x1="8" y1="32" x2="32" y2="32"/><line x1="8" y1="42" x2="26" y2="42"/></g></svg>`;
}

/* Названия областей в пункте «в списке» — набросок оглавления, а не ссылки:
   берутся из самой базы, чтобы не разойтись с ней. */
function zoneChips(zones) {
  return `<span class="zone-sketch" aria-hidden="true">${zones.map(z => `<span>${esc(z.name)}</span>`).join("")}</span>`;
}

/* Левая колонка: четыре карточки, прилипает при прокрутке средствами CSS,
   без JavaScript. Ниже 1200 точек скрыта — там те же ссылки лежат в шапке. */
function sideNav(path, zones) {
  const N = T.nav;
  return `<nav class="side" aria-label="${attr(T.menu)}">
    <div class="side-inner">
      <a class="nav-item nav-primary" href="/vybor/"${current("/vybor/", path)}>
        <span class="fig">${figureSvg(44, 64)}</span>
        <span>
          <span class="t">${esc(T.navChoose)}</span>
          <span class="s">${esc(N.chooseSub)} <span class="soon">${esc(N.soon)}</span></span>
        </span>
      </a>
      <a class="nav-item" href="/oblasti/"${current("/oblasti/", path)}>
        <span class="t">${esc(T.navZones)}</span>
        <span class="s">${esc(N.zonesSub)}</span>
        ${zoneChips(zones)}
      </a>
      <a class="nav-item nav-plain" href="/ukazatel/"${current("/ukazatel/", path)}>
        <span><span class="t">${esc(T.navIndex)}</span>
          <span class="s">${esc(N.indexSub)}</span></span>
        <span class="chev" aria-hidden="true">→</span>
      </a>
      <div class="nav-item hub">
        <a class="hub-head" href="/o-spravochnike/"${current("/o-spravochnike/", path)}>
          <span class="t">${esc(T.navAbout)}</span>
          <span class="s">${esc(N.aboutSub)}</span>
        </a>
        <span class="sub">
        ${hubLinks(path)}
        </span>
      </div>
    </div>
  </nav>`;
}

/* Поиск в шапке. Поле создаёт скрипт, поэтому в разметке лежит только слот
   со строками и адресом индекса, а внутри — обычная ссылка на указатель:
   без JavaScript она и остаётся, мёртвого поля на странице не возникает.

   Формы здесь нет намеренно. Форма отправила бы запрос адресом (?q=…),
   а названия болезней не должны попадать ни в историю браузера, ни в логи
   хостинга — сайт объявляет, что ничего о читателе не собирает. */
function topSearch() {
  const S = T.search;
  return `<div class="topsearch" data-poisk-top
      data-index="${attr(POISK.url)}"
      data-label="${attr(S.topLabel)}"
      data-placeholder="${attr(S.topPlaceholder)}"
      data-found="${attr(S.topFound)}"
      data-nothing="${attr(S.topNothing)}"
      data-kind-condition="${attr(S.topKindCondition)}"
      data-kind-syndrome="${attr(S.topKindSyndrome)}">
      <a class="poisk-fallback" href="/ukazatel/" data-poisk-fallback>${esc(T.navIndex)}</a>
    </div>`;
}

function header(path) {
  return `<header class="top">
    <a class="skip" href="#main">${esc(T.skipToContent)}</a>
    <div class="brandbox">
      <a class="brand" href="/">${esc(cfg.siteName)}</a>
      <a class="homelink" href="/">${esc(T.homeLink)}</a>
    </div>
    ${topSearch()}
    ${/* Телефон неотложной помощи стоит в шапке, на каждой странице.
         Раньше стоял в подвале, куда человек в тревоге не докручивает. */ ""}
    <p class="topemergency">${T.topEmergency.map(part => `<span>${esc(part)}</span>`).join(" ")}</p>
    ${nav("topnav topnav-wide", path)}
    <details class="topmenu">
      <summary>${esc(T.menu)}</summary>
      ${nav("topnav topnav-narrow", path)}
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

/* Подвал стоит на той же сетке, что и страница: три колонки, и в каждой
   по две строки. Первая — под левым меню: фигура, имя сайта и плашка
   обратной связи. Вторая и третья лежат в .bottom-inner и попадают
   в колонку текста: чем этот сайт является и маркировка возраста;
   владелец и ссылка на поддержку.

   Юридический абзац, источники, дата обновления и телефон неотложной
   помощи из подвала убраны решением владельца 11.09.2026: предупреждение
   целиком читается на странице «О справочнике», источник и дата стоят
   на каждой статье, соглашение открывается из левого меню, а телефон
   переехал в шапку. Подвал на каждой странице должен быть коротким.

   Порядок в разметке — порядок чтения на телефоне, где колонка одна:
   чем является сайт, владелец, затем обратная связь. На широком экране
   колонку с фигурой ставит на место сетка, а не разметка. */
function footer(path) {
  const f = T.footer;
  return `<footer class="bottom">
    <div class="bottom-inner">
      <div class="footcol">
        <p><strong>${esc(cfg.siteName)} — ${esc(f.lead)}</strong></p>
        <p class="age">${esc(f.age)}</p>
      </div>
      <div class="footcol">
        <p>${esc(f.ownerPrefix)} ${esc(cfg.owner.name)}.</p>
        ${showSupport(path) ? `<p class="footsupport"><a href="/podderzhat/">${esc(T.navSupport)}</a></p>` : ""}
      </div>
    </div>
    <div class="footcol footbrand">
      <p class="footname"><span class="fig">${figureSvg(22, 32)}</span> <strong>${esc(cfg.siteName)}</strong> — ${esc(cfg.tagline)}</p>
      ${/* Обратная связь — про работу сайта, не про самочувствие.
           Просьба не описывать своё состояние стоит на странице
           «О справочнике» и в соглашении, здесь её не повторяем. */ ""}
      <div class="contactbox">
        <p class="h">${esc(f.contactTitle)}</p>
        <p class="m">${esc(f.contactBody)} <a href="mailto:${attr(cfg.errorMail)}">${esc(cfg.errorMail)}</a></p>
      </div>
    </div>
  </footer>`;
}

/* Полная страница. body — уже готовый HTML. */
/* scripts — только свои файлы по корневым путям и только там, где надстройка
   действительно нужна. Порядок важен: profil.js кладёт window.EZ_PROFIL,
   остальные его читают. Страница обязана быть полной и без них. */
/* Дату updated шаблоны страниц по-прежнему передают, но каркас её больше
   не показывает: из подвала дата убрана, а на статьях она стоит в блоке
   происхождения. Здесь она не принимается и не используется. */
function page({ title, description, path, body, rail, bodyClass, ogType, script, scripts }) {
  /* Поиск в шапке стоит на каждой странице, поэтому его скрипт добавляется
     здесь, а не перечисляется в каждом шаблоне. Он идёт первым и ни от чего
     не зависит: индекс он грузит сам и только по первому нажатию клавиши. */
  const js = [A.poisk.url].concat(scripts && scripts.length ? scripts : script ? [script] : []);
  const canonical = cfg.origin.replace(/\/$/, "") + path;
  /* Области для наброска в меню берутся из базы здесь, а не при загрузке
     модуля: data.js тяжёлый, а каркас нужен и тем, кто его не читает. */
  const zones = require("./data").map.zones;
  return `<!doctype html>
<html lang="ru">
<head>
  ${head({ title, description, canonical, ogType })}
</head>
<body${bodyClass ? ` class="${attr(bodyClass)}"` : ""}>
${header(path)}
<div class="layout">
${sideNav(path, zones)}
<main id="main">
${body}
</main>
${rail ? `<aside class="rail"><div class="rail-inner">\n${rail}\n</div></aside>` : ""}
</div>
${footer(path)}
${js.map(src => `<script src="${attr(src)}" defer></script>`).join("\n")}
</body>
</html>
`;
}

module.exports = { page, esc, attr, dateRu, hubLinks, figureSvg, listSvg, zoneChips };
