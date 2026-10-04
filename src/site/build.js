#!/usr/bin/env node
"use strict";
/* Сборка статического сайта из замороженной базы.
   Ни одной зависимости: читает data/, пишет dist/.
   data/ только читается — сборка не имеет права ничего там менять.

   Первый этап: статьи, разделы, указатель, главная и две страницы слоя безопасности.
   Уточняющие шаги — второй уровень доступа, остров на странице раздела;
   фигура тела — третий, на /vybor/, и она тоже собирается здесь. */
const fs = require("fs");
const path = require("path");

const cfg = require("./config");
const D = require("./data");
const meta = require("./meta");
const A = require("./assets");
const T = require("./text");
const FIGURA = require("./figura");
const PAYLOAD = require("./payload");
const POISK = require("./poisk-index");
const SEXQ = require("../questions-sex.json");
const conditionPage = require("./pages/condition");
const syndromePage = require("./pages/syndrome");
const ukazatelPage = require("./pages/ukazatel");
const homePage = require("./pages/home");
const vyborPage = require("./pages/vybor");
const { notSearchedHerePage, noMatchPage, doesNotPage } = require("./pages/plain");
const { zonesPage, zonePage, zhalobyPage } = require("./pages/oblasti");
const { aboutPage, howMadePage, termsPage, supportPage } = require("./pages/service");

const root = path.join(__dirname, "..", "..");
const dist = path.join(root, "dist");

const L = "─".repeat(58);
const written = [];
const assetUrls = new Set();

function write(urlPath, html) {
  const rel = urlPath === "/" ? "index.html" : path.join(urlPath.replace(/^\/|\/$/g, ""), "index.html");
  const file = path.join(dist, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, "utf8");
  written.push({ urlPath, file });
}

/* ---------- проверки до сборки ---------- */
function assertSlugs() {
  const seen = new Map();
  const problems = [];

  const claim = (id, slug, kind) => {
    const key = `${kind}:${slug}`;
    if (seen.has(key)) problems.push(`слаг «${slug}» занят дважды: ${seen.get(key)} и ${id}`);
    seen.set(key, id);
    if (!/^[a-z0-9-]+$/.test(slug)) problems.push(`слаг «${slug}» (${id}) содержит недопустимые символы`);
    if (slug.replace(/-/g, ".") !== id && D.slug(id) !== slug) problems.push(`слаг «${slug}» не выводится из id ${id}`);
  };

  D.conditions.forEach(c => claim(c.id, D.slug(c.id), "cond"));
  D.syndromes.forEach(s => claim(s.id, D.slug(s.id), "syn"));

  if (problems.length) {
    console.error(`${L}\nСБОРКА ОСТАНОВЛЕНА: адреса\n${L}`);
    problems.forEach(p => console.error(`  ✗ ${p}`));
    process.exit(1);
  }
}

/* Битая ссылка на статью из раздела превратилась бы в 404 внутри оглавления. */
function assertLinks() {
  const problems = [];
  D.syndromes.forEach(s =>
    s.candidates.forEach(c => {
      if (!D.conditionById.has(c.condition)) problems.push(`${s.id} → нет статьи «${c.condition}»`);
    })
  );
  if (problems.length) {
    console.error(`${L}\nСБОРКА ОСТАНОВЛЕНА: битые ссылки\n${L}`);
    problems.forEach(p => console.error(`  ✗ ${p}`));
    process.exit(1);
  }
}

/* Список половых вопросов решён вручную, значит может разойтись с базой. */
function assertSexQuestions() {
  const known = new Set(D.questions.map(q => q.id));
  const bad = ["f", "m"].flatMap(k => (SEXQ[k] || []).filter(id => !known.has(id)));
  if (bad.length) {
    console.error(`${L}\nСБОРКА ОСТАНОВЛЕНА: questions-sex.json\n${L}`);
    bad.forEach(id => console.error(`  ✗ вопроса «${id}» нет в базе`));
    process.exit(1);
  }
}

/* Силуэт не убирает разделы никогда.
   Он вид, а не утверждение о человеке: скрыть раздел значит закрыть человеку
   текст, написанный в том числе для него. Скрытие участков с чужим sexOnly
   стоило бы двух разделов из 124 на мужском силуэте — «уплотнение в молочной
   железе» и «боль в молочной железе», где лежат гинекомастия и рак молочной
   железы без ограничения по полу. */
function assertSilhouettes() {
  const problems = [];
  ["m", "f"].forEach(sex => {
    const seen = D.syndromesOnSilhouette(sex);
    const lost = D.syndromes.filter(s => !seen.has(s.id));
    if (lost.length)
      problems.push(`силуэт «${sex}»: недостижимо ${lost.length} — ${lost.slice(0, 6).map(s => s.id).join(", ")}`);
  });
  if (problems.length) {
    console.error(`${L}\nСБОРКА ОСТАНОВЛЕНА: силуэт скрывает разделы\n${L}`);
    problems.forEach(p => console.error(`  ✗ ${p}`));
    process.exit(1);
  }
}

/* Адреса, на которые уже ссылаются страницы, но которые собирает следующий этап.
   Список конечный и должен опустеть: пока он не пуст, публиковать нельзя —
   это ровно те 404 внутри оглавления, ради которых существует проверка ниже. */
const PLANNED = new Set(); /* пусто: страницы областей собраны на втором этапе */
let plannedLinks = new Map();

/* Каждая внутренняя ссылка обязана вести на собранную страницу.
   Без JavaScript ссылки — единственная навигация, и опечатка в шаблоне
   превращается в 404 внутри оглавления. */
function verifyLinks() {
  const targets = new Set(written.map(w => w.urlPath));
  assetUrls.forEach(u => targets.add(u));
  const broken = new Map();
  const planned = new Map();
  let total = 0;

  written.forEach(w => {
    const html = fs.readFileSync(w.file, "utf8");
    /* Проверяем и href, и src, и адреса в data-атрибутах острова: с отпечатком
       в имени опечатка в шаблоне даёт молчаливый 404, которого раньше быть
       не могло — имена были постоянными. */
    (html.match(/(?:href|src|data-payload|data-engine)="([^"]+)"/g) || []).forEach(m => {
      const full = m.slice(m.indexOf('"') + 1, -1);
      if (!full.startsWith("/") || full.startsWith("//")) return;
      total++;
      /* Ссылка с якорем: страница обязана существовать, а якорь — быть на ней
         атрибутом id. Фигура ведёт на группу участка внутри страницы области. */
      const [url, hash] = full.split("#");
      if (targets.has(url)) {
        if (hash === undefined) return;
        const target = written.find(x => x.urlPath === url);
        if (target && fs.readFileSync(target.file, "utf8").includes(`id="${hash}"`)) return;
        broken.set(full, (broken.get(full) || []).concat(w.urlPath));
        return;
      }
      if (PLANNED.has(url)) planned.set(url, (planned.get(url) || 0) + 1);
      else broken.set(url, (broken.get(url) || []).concat(w.urlPath));
    });
  });

  plannedLinks = planned;

  if (broken.size) {
    console.error(`${L}\nСБОРКА ОСТАНОВЛЕНА: ссылки в никуда\n${L}`);
    [...broken.entries()].slice(0, 20).forEach(([url, from]) =>
      console.error(`  ✗ ${url} — со страниц: ${from.slice(0, 3).join(", ")}${from.length > 3 ? ` и ещё ${from.length - 3}` : ""}`)
    );
    process.exit(1);
  }
  return total;
}

/* ---------- sitemap и robots ---------- */
function sitemap(origin, updated) {
  const urls = [
    { loc: "/", lastmod: updated },
    { loc: "/vybor/", lastmod: updated },
    { loc: "/ukazatel/", lastmod: updated },
    { loc: "/oblasti/", lastmod: D.anatomy.updated || updated },
    { loc: "/zhaloby/", lastmod: D.anatomy.updated || updated },
    ...D.map.zones.map(z => ({ loc: D.zonePath(z.id), lastmod: D.anatomy.updated || updated })),
    { loc: "/chto-ne-razbiraem/", lastmod: D.redflags.updated || updated },
    { loc: "/moego-sluchaya-net/", lastmod: D.redflags.updated || updated },
    { loc: "/chto-ne-delaem/", lastmod: updated },
    { loc: "/o-spravochnike/", lastmod: updated },
    { loc: "/kak-sostavleny/", lastmod: updated },
    { loc: "/soglashenie/", lastmod: updated },
    { loc: "/podderzhat/", lastmod: updated },
    ...D.conditions.map(c => ({ loc: D.conditionPath(c.id), lastmod: c.updated })),
    ...D.syndromes.map(s => ({ loc: D.syndromePath(s.id), lastmod: s.updated }))
  ];
  const base = origin.replace(/\/$/, "");
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(u => `  <url><loc>${base}${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`)
      .join("\n") +
    "\n</urlset>\n"
  );
}

function robots(origin) {
  return `User-agent: *\nAllow: /\nDisallow: /_debug/\n\nSitemap: ${origin.replace(/\/$/, "")}/sitemap.xml\n`;
}

/* ---------- служебная страница наложения ----------
   Четыре кадра, поверх каждого — боксы участков и гладкие контуры зон,
   по той же геометрии (src/site/figura.js), что и зоны на /vybor/.
   Сравнивается с эталоном figury/nalozhenie/*.png: совпали — формула,
   зеркалирование и данные прочитаны верно. */
function debugFiguraPage() {
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const Td = T.debug;
  const kadry = FIGURA.KADRY.map(k => {
    const img = A.figury[k.frame];
    /* участки — боксами, зоны — гладкими контурами (тем же сплайном, что и на /vybor/) */
    const boxes = FIGURA.boxesOf(k).filter(b => b.kind === "subzone")
      .map(b => `<div class="b" style="left:${(b.x0 * 100).toFixed(2)}%;top:${(b.y0 * 100).toFixed(2)}%;width:${((b.x1 - b.x0) * 100).toFixed(2)}%;height:${((b.y1 - b.y0) * 100).toFixed(2)}%"><i>${esc(b.id)}</i></div>`)
      .join("\n      ");
    const contours = FIGURA.contoursOf(k);
    const paths = contours.map(c => `<path d="${c.path}" vector-effect="non-scaling-stroke"/>`).join("");
    const labels = contours.map(c => `<b style="left:${(c.cx * 100).toFixed(2)}%;top:${(c.cy * 100).toFixed(2)}%">${esc(c.id)}</b>`).join("\n      ");
    return `<figure>
    <figcaption>${esc(k.frame)}</figcaption>
    <div class="k" style="aspect-ratio:${img.x1.width}/${img.x1.height}">
      <img src="${esc(img.x2.url)}" width="${img.x1.width}" height="${img.x1.height}" alt="${esc(k.frame)}" decoding="async">
      ${boxes}
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>
      ${labels}
    </div>
  </figure>`;
  }).join("\n  ");
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(Td.title)}</title>
<meta name="description" content="${esc(Td.description)}">
<link rel="canonical" href="${esc(cfg.origin.replace(/\/$/, "") + "/_debug/figura.html")}">
<style>
  body { margin: 1rem; font: 14px/1.4 system-ui, sans-serif; background: #fff; color: #222; }
  .row { display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: flex-start; }
  figure { margin: 0; }
  figcaption { font-weight: 600; margin-bottom: .3rem; }
  .k { position: relative; width: min(671px, 100vw - 2rem); }
  .k img { display: block; width: inherit; height: auto; }
  .b { position: absolute; box-sizing: border-box; border: 1px solid #c00; }
  .b i { position: absolute; left: 0; top: 0; font: 10px/1.2 system-ui, sans-serif; font-style: normal; background: rgba(255,255,255,.75); color: #900; padding: 0 2px; white-space: nowrap; }
  .k svg { position: absolute; left: 0; top: 0; width: inherit; height: auto; aspect-ratio: inherit; overflow: visible; pointer-events: none; }
  .k svg path { fill: rgba(0,102,204,.08); stroke: #06c; stroke-width: 2; }
  .k b { position: absolute; margin: -8px 0 0 -20px; font: 600 11px/1.2 system-ui, sans-serif; background: rgba(255,255,255,.8); color: #036; padding: 0 3px; border-radius: 3px; }
</style>
</head>
<body>
<h1>${esc(Td.title)}</h1>
<p>${esc(Td.lead)}</p>
<div class="row">
  ${kadry}
</div>
</body>
</html>
`;
}

/* ---------- сборка ---------- */
function build() {
  assertSlugs();
  assertLinks();
  assertSexQuestions();
  assertSilhouettes();

  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  /* «Дата последнего обновления материалов» в подвале — самая свежая дата в базе. */
  const updated = D.conditions
    .map(c => c.updated)
    .concat(D.syndromes.map(s => s.updated))
    .sort()
    .pop();

  write("/", homePage(updated));
  write("/vybor/", vyborPage(updated));
  write("/ukazatel/", ukazatelPage(updated));
  write("/oblasti/", zonesPage(updated));
  write("/zhaloby/", zhalobyPage(updated));
  write("/chto-ne-razbiraem/", notSearchedHerePage(updated));
  write("/moego-sluchaya-net/", noMatchPage(updated));
  write("/chto-ne-delaem/", doesNotPage(updated));
  write("/o-spravochnike/", aboutPage(updated));
  write("/kak-sostavleny/", howMadePage(updated));
  write("/soglashenie/", termsPage(updated));
  write("/podderzhat/", supportPage(updated));
  D.map.zones.forEach(z => write(D.zonePath(z.id), zonePage(z, updated)));
  D.conditions.forEach(c => write(D.conditionPath(c.id), conditionPage(c, updated)));
  D.syndromes.forEach(s => write(D.syndromePath(s.id), syndromePage(s, updated)));

  /* Стили и скрипты пишутся под именами с отпечатком содержимого: иначе
     кеш на сутки отдаёт старый файл, и правка до человека не доезжает.
     Движок уезжает в браузер тем же файлом, что гоняют тесты. */
  [A.style, A.search, A.poisk, A.profil, A.naverkh, A.utochnenie, A.engine].forEach(a => {
    fs.writeFileSync(path.join(dist, a.file), a.content);
    assetUrls.add(a.url);
  });

  ["favicon.svg", "favicon.ico", "favicon-32x32.png", "apple-touch-icon.png"].forEach(fn => {
    fs.copyFileSync(path.join(__dirname, "assets", fn), path.join(dist, fn));
    assetUrls.add("/" + fn);
  });

  /* Шрифты — своими файлами, с отпечатком в имени, как стили и скрипты. */
  fs.mkdirSync(path.join(dist, "fonts"), { recursive: true });
  A.fonts.forEach(f => {
    fs.writeFileSync(path.join(dist, f.file), f.content);
    assetUrls.add(f.url);
  });

  /* Кадры фигуры — так же. Полные рендеры из figury/ в dist не попадают:
     сюда идут только два уменьшенных размера на кадр. */
  fs.mkdirSync(path.join(dist, "figury"), { recursive: true });
  Object.values(A.figury).forEach(k => [k.x1, k.x2, k.x320].filter(Boolean).forEach(f => {
    fs.writeFileSync(path.join(dist, f.file), f.content);
    assetUrls.add(f.url);
  }));

  /* Служебная страница наложения: участки слоя якорей поверх кадров.
     В sitemap её нет, в robots закрыта, из страниц сайта на неё ссылок нет. */
  fs.mkdirSync(path.join(dist, "_debug"), { recursive: true });
  fs.writeFileSync(path.join(dist, "_debug", "figura.html"), debugFiguraPage(), "utf8");

  /* Индекс поиска в шапке. Отдельным файлом и с отпечатком: он нужен всем
     страницам, но грузится только тому, кто начал набирать. */
  fs.writeFileSync(path.join(dist, POISK.file), POISK.content, "utf8");
  assetUrls.add(POISK.url);

  const dataDir = path.join(dist, "dannye");
  fs.mkdirSync(dataDir, { recursive: true });
  let payloadMax = 0;
  PAYLOAD.all().forEach(pl => {
    payloadMax = Math.max(payloadMax, Buffer.byteLength(pl.content));
    fs.writeFileSync(path.join(dataDir, pl.file), pl.content, "utf8");
    assetUrls.add(pl.url);
  });
  build.payloadMax = payloadMax;
  fs.writeFileSync(path.join(dist, "sitemap.xml"), sitemap(cfg.origin, updated), "utf8");
  fs.writeFileSync(path.join(dist, "robots.txt"), robots(cfg.origin), "utf8");

  const links = verifyLinks();

  const bytes = written.reduce((a, w) => a + fs.statSync(w.file).size, 0);

  console.log(L);
  console.log("СБОРКА САЙТА");
  console.log(L);
  console.log(`Статей о состояниях        ${D.conditions.length}`);
  console.log(`Разделов справочника       ${D.syndromes.length}`);
  console.log(`Областей тела              ${D.map.zones.length}`);
  console.log(`Разделов с каждого силуэта ${D.syndromesOnSilhouette("m").size} и ${D.syndromesOnSilhouette("f").size} из ${D.syndromes.length}`);
  console.log(`Служебных страниц          ${written.length - D.conditions.length - D.syndromes.length - D.map.zones.length}`);
  console.log(`Всего страниц              ${written.length}`);
  console.log(`Внутренних ссылок          ${links}, битых нет`);
  console.log(`Объём HTML                 ${(bytes / 1024 / 1024).toFixed(2)} МБ`);
  console.log(`Данные уточнения           ${D.syndromes.length} файлов, самый большой ${Math.round(build.payloadMax / 1024)} КБ`);
  {
    /* Раздел с размеченными ощущениями начинается с вопроса «что больше похоже?»,
       неразмеченный — сразу с первого уточняющего вопроса. Выбор, который ничего
       не меняет, показывать нельзя. */
    const withFeel = D.syndromes.filter(syndromePage.marked).length;
    console.log(`Уточнение начинается       с выбора ощущения в ${withFeel} разделах, с вопроса в ${D.syndromes.length - withFeel}`);
  }
  console.log(`Файлы с отпечатком         ${[A.style, A.search, A.poisk, A.profil, A.naverkh, A.utochnenie, A.engine].map(a => a.file).join(", ")}`);
  {
    const kadry = Object.values(A.figury).flatMap(k => [k.x1, k.x2, k.x320].filter(Boolean));
    const kb = kadry.reduce((a, f) => a + f.content.length, 0) / 1024;
    console.log(`Кадры фигуры               ${kadry.length} файлов, ${Math.round(kb)} КБ; наложение — /_debug/figura.html (не в sitemap, закрыто в robots)`);
  }
  console.log(`Индекс поиска в шапке      ${POISK.file}, ${POISK.count} строк, ${(POISK.bytes / 1024).toFixed(1)} КБ; грузится по первому нажатию клавиши`);
  const scripted = written.filter(w => /<script\b/i.test(fs.readFileSync(w.file, "utf8")));
  const kinds = [...new Set(scripted.map(s => s.urlPath.split("/")[1] || "/"))];
  console.log(`Страниц со скриптом        ${scripted.length} из ${written.length}${kinds.length ? ` (${kinds.join(", ")})` : ""}`);
  console.log(L);

  const warn = [];
  if (plannedLinks.size) {
    const n = [...plannedLinks.values()].reduce((a, b) => a + b, 0);
    warn.push(`${plannedLinks.size} адресов ещё не собраны, на них ведут ${n} ссылок (второй этап). До публикации список обязан опустеть.`);
  }
  if (cfg.origin === cfg.PLACEHOLDER_ORIGIN)
    warn.push(`origin — заглушка (${cfg.origin}). Канонические адреса и sitemap.xml публиковать нельзя, пока не выбран домен.`);
  if (cfg.errorMail === cfg.PLACEHOLDER_MAIL)
    warn.push(`адрес для «здесь ошибка» — заглушка (${cfg.errorMail}).`);
  if (warn.length) {
    console.log("До публикации заполнить:");
    warn.forEach(w => console.log(`  ! ${w}`));
    console.log(L);
  }
}

if (require.main === module) build();
module.exports = { build };
