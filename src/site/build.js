#!/usr/bin/env node
"use strict";
/* Сборка статического сайта из замороженной базы.
   Ни одной зависимости: читает data/, пишет dist/.
   data/ только читается — сборка не имеет права ничего там менять.

   Первый этап: статьи, разделы, указатель, главная и две страницы слоя безопасности.
   Фигуры и уточняющих шагов здесь нет — это второй и третий уровни доступа. */
const fs = require("fs");
const path = require("path");

const cfg = require("./config");
const D = require("./data");
const meta = require("./meta");
const SEXQ = require("../questions-sex.json");
const conditionPage = require("./pages/condition");
const syndromePage = require("./pages/syndrome");
const ukazatelPage = require("./pages/ukazatel");
const homePage = require("./pages/home");
const { notSearchedHerePage, noMatchPage } = require("./pages/plain");
const { zonesPage, zonePage, zhalobyPage } = require("./pages/oblasti");

const root = path.join(__dirname, "..", "..");
const dist = path.join(root, "dist");

const L = "─".repeat(58);
const written = [];

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
   стоило бы двух разделов из 110 на мужском силуэте — «уплотнение в молочной
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
  targets.add("/style.css");
  targets.add("/search.js");
  const broken = new Map();
  const planned = new Map();
  let total = 0;

  written.forEach(w => {
    const html = fs.readFileSync(w.file, "utf8");
    (html.match(/href="([^"]+)"/g) || []).forEach(m => {
      const url = m.slice(6, -1);
      if (!url.startsWith("/") || url.startsWith("//")) return;
      total++;
      if (targets.has(url)) return;
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

/* ---------- данные для уточнения ----------
   На страницу раздела едет только то, что нужно этому разделу: сам раздел,
   его состояния, только его вопросы (9–29 из 138) и правила тревоги,
   отфильтрованные по зоне. Всю базу в браузер не отдаём — это мегабайты,
   а человек на медленном мобильном интернете ждать их не станет.
   Грузится по нажатию кнопки, а не при первой отрисовке страницы. */
function payload(s) {
  const questions = D.questions.filter(q => s.questions.includes(q.id));
  const conditions = s.candidates
    .map(c => D.conditionById.get(c.condition))
    .filter(Boolean)
    .map(c => ({
      /* поля движка */
      id: c.id, name: c.name, redflag: !!c.redflag,
      sexOnly: c.sexOnly, ageMin: c.ageMin, ageMax: c.ageMax,
      /* поля показа */
      icd: c.icd,
      path: D.conditionPath(c.id),
      gist: meta.clamp(meta.firstSentence(c.what), 110)
    }));
  const redflags = {
    global: D.redflags.global.filter(r => !r.zones || r.zones.includes(s.zone))
  };

  const data = { questions, redflags, conditions, syndromes: [s], sexQuestions: SEXQ };
  return `window.EZ_DATA=${JSON.stringify(data)};\n`;
}

/* ---------- sitemap и robots ---------- */
function sitemap(origin, updated) {
  const urls = [
    { loc: "/", lastmod: updated },
    { loc: "/ukazatel/", lastmod: updated },
    { loc: "/oblasti/", lastmod: D.anatomy.updated || updated },
    { loc: "/zhaloby/", lastmod: D.anatomy.updated || updated },
    ...D.map.zones.map(z => ({ loc: D.zonePath(z.id), lastmod: D.anatomy.updated || updated })),
    { loc: "/chto-ne-razbiraem/", lastmod: D.redflags.updated || updated },
    { loc: "/moego-sluchaya-net/", lastmod: D.redflags.updated || updated },
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
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin.replace(/\/$/, "")}/sitemap.xml\n`;
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
  write("/ukazatel/", ukazatelPage(updated));
  write("/oblasti/", zonesPage(updated));
  write("/zhaloby/", zhalobyPage(updated));
  write("/chto-ne-razbiraem/", notSearchedHerePage(updated));
  write("/moego-sluchaya-net/", noMatchPage(updated));
  D.map.zones.forEach(z => write(D.zonePath(z.id), zonePage(z, updated)));
  D.conditions.forEach(c => write(D.conditionPath(c.id), conditionPage(c, updated)));
  D.syndromes.forEach(s => write(D.syndromePath(s.id), syndromePage(s, updated)));

  /* Движок уезжает в браузер тем же файлом, что гоняют тесты. */
  fs.copyFileSync(path.join(root, "src", "engine.js"), path.join(dist, "engine.js"));
  fs.copyFileSync(path.join(__dirname, "assets", "utochnenie.js"), path.join(dist, "utochnenie.js"));

  const dataDir = path.join(dist, "dannye");
  fs.mkdirSync(dataDir, { recursive: true });
  let payloadMax = 0;
  D.syndromes.forEach(s => {
    const js = payload(s);
    payloadMax = Math.max(payloadMax, Buffer.byteLength(js));
    fs.writeFileSync(path.join(dataDir, D.slug(s.id) + ".js"), js, "utf8");
  });
  build.payloadMax = payloadMax;

  fs.copyFileSync(path.join(__dirname, "assets", "style.css"), path.join(dist, "style.css"));
  fs.copyFileSync(path.join(__dirname, "assets", "search.js"), path.join(dist, "search.js"));
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
