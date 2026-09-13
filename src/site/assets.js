"use strict";
/* Отпечаток содержимого в имени файла.

   Зачем: на хостинге включено кеширование на сутки. Пока имя файла не менялось,
   браузер сутки показывал старый style.css — без прилипшей кнопки и с белой
   развилкой в тёмной теме. Отпечаток решает это без настроек сервера:
   изменился файл — изменилось имя — браузер обязан скачать заново;
   не изменился — берётся из кеша, как и задумано.

   Восемь шестнадцатеричных знаков от sha256: столкновения здесь не бывает,
   а имя остаётся читаемым. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const assetsDir = path.join(__dirname, "assets");
const srcDir = path.join(__dirname, "..");

function fingerprint(content) {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 8);
}

/* Возвращает и адрес для разметки, и имя с содержимым — чтобы сборке
   не пришлось второй раз считать то же самое и разойтись с шаблонами. */
function asset(name, absPath) {
  const content = fs.readFileSync(absPath);
  const ext = path.extname(name);
  const base = name.slice(0, -ext.length);
  const file = `${base}.${fingerprint(content)}${ext}`;
  return { file, url: "/" + file, content };
}

/* Шрифты лежат в проекте файлами (assets/fonts, WOFF2, кириллица и латиница
   отдельными наборами) — ничего с чужих доменов. Имена тоже с отпечатком:
   кеш на сутки касается и их. В style.css шрифт записан по простому имени,
   /fonts/lora-cyrillic-600-normal.woff2; сборка подставляет имя с отпечатком
   до того, как посчитать отпечаток самого style.css, — поэтому стили
   меняют имя вместе со шрифтами. Ссылка на несуществующий файл роняет
   сборку: опечатка в @font-face иначе давала бы молчаливый 404 и системный
   шрифт вместо своего. */
const fontsDir = path.join(assetsDir, "fonts");
const fonts = fs.readdirSync(fontsDir)
  .filter(f => f.endsWith(".woff2"))
  .sort()
  .map(f => {
    const a = asset(f, path.join(fontsDir, f));
    return { name: f, file: "fonts/" + a.file, url: "/fonts/" + a.file, content: a.content };
  });

function styleAsset() {
  let css = fs.readFileSync(path.join(assetsDir, "style.css"), "utf8");
  fonts.forEach(f => { css = css.split("/fonts/" + f.name).join(f.url); });
  const left = css.match(/\/fonts\/[^)'" ]+/g) || [];
  const bad = left.filter(u => !fonts.some(f => f.url === u));
  if (bad.length) throw new Error("style.css ссылается на шрифты, которых нет в assets/fonts: " + bad.join(", "));
  const content = Buffer.from(css, "utf8");
  const file = `style.${fingerprint(content)}.css`;
  return { file, url: "/" + file, content };
}

/* Два файла, которые нужны первому экрану на каждой странице: основной
   текст и заголовок, оба кириллические. Их шапка страницы просит заранее
   (preload), остальные подгружаются по мере надобности. */
const fontPreload = fonts.filter(f =>
  f.name === "golos-text-cyrillic-400-normal.woff2" || f.name === "lora-cyrillic-600-normal.woff2"
);

module.exports = {
  fingerprint,
  fonts,
  fontPreload,
  style: styleAsset(),
  search: asset("search.js", path.join(assetsDir, "search.js")),
  poisk: asset("poisk.js", path.join(assetsDir, "poisk.js")),
  profil: asset("profil.js", path.join(assetsDir, "profil.js")),
  naverkh: asset("naverkh.js", path.join(assetsDir, "naverkh.js")),
  utochnenie: asset("utochnenie.js", path.join(assetsDir, "utochnenie.js")),
  /* Движок уезжает в браузер тем же файлом, что гоняют тесты. */
  engine: asset("engine.js", path.join(srcDir, "engine.js"))
};
