"use strict";
/* Индекс для поиска в шапке — один файл с отпечатком в имени.

   Зачем отдельный файл, а не разметка. Поиск на странице указателя работает
   по уже отрисованным строкам и потому не грузит ничего. В шапке так нельзя:
   строки указателя есть только на самом указателе, а поле стоит на всех 438
   страницах. Складывать четыреста названий в каждую страницу — это четыреста
   лишних строк в каждом HTML и в выдаче поисковика.

   Что внутри. Ровно то же, что в указателе: 307 статей и 110 разделов,
   каждая строка — [вид, слаг, название, дополнительные слова]. Вид 1 —
   статья, 0 — раздел; адрес скрипт собирает сам, чтобы не повторять
   «/sostoyaniya/» четыреста раз. Дополнительные слова — синонимы (alt
   у статей, aka у разделов): по ним ищется, но показывается название.

   Чего внутри нет: описаний, кодов МКБ, весов. Это указатель, а не база. */
const D = require("./data");
const { fingerprint } = require("./assets");

const CONDITION = 1;
const SYNDROME = 0;

function rows() {
  const out = [];
  D.conditions.forEach(c => {
    const extra = (c.alt || []).join(" ");
    out.push(extra ? [CONDITION, D.slug(c.id), c.name, extra] : [CONDITION, D.slug(c.id), c.name]);
  });
  D.syndromes.forEach(s => {
    const extra = (s.aka || []).join(" ");
    out.push(extra ? [SYNDROME, D.slug(s.id), s.name, extra] : [SYNDROME, D.slug(s.id), s.name]);
  });
  return out;
}

const list = rows();
const content = `window.EZ_POISK=${JSON.stringify(list)};\n`;
const file = `poisk.${fingerprint(content)}.js`;

module.exports = {
  file,
  url: "/" + file,
  content,
  count: list.length,
  bytes: Buffer.byteLength(content)
};
