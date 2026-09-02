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

module.exports = {
  fingerprint,
  style: asset("style.css", path.join(assetsDir, "style.css")),
  search: asset("search.js", path.join(assetsDir, "search.js")),
  profil: asset("profil.js", path.join(assetsDir, "profil.js")),
  utochnenie: asset("utochnenie.js", path.join(assetsDir, "utochnenie.js")),
  /* Движок уезжает в браузер тем же файлом, что гоняют тесты. */
  engine: asset("engine.js", path.join(srcDir, "engine.js"))
};
