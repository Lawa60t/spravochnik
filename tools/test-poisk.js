"use strict";
/* Прогон поиска в шапке.

   Зачем он нужен отдельно. Поиск — единственная часть сайта, которая
   встречает человека его собственными словами, а не словами справочника.
   Проверить его глазами нельзя: сорок запросов сегодня сходятся, а после
   правки ранжирования расходятся молча, и заметит это только читатель.

   Правило проекта, выведенное из провала линта формулировок: всякая
   проверка заказывается вместе с прогоном, доказывающим, что она ловит
   то, ради чего написана. Здесь этим прогоном служит список запросов,
   написанных так, как их набирает человек, — «болит горло», а не
   «Боль в горле при глотании».

   Гоняется ровно тот файл, который уезжает в браузер: src/site/assets/poisk.js
   экспортируется и в Node, и в window — тем же швом, что и движок. */
const path = require("path");
const CORE = require(path.join(__dirname, "..", "src", "site", "assets", "poisk.js"));
const INDEX = require(path.join(__dirname, "..", "src", "site", "poisk-index.js"));
const CASES = require(path.join(__dirname, "poisk-cases.json"));

const line = "─".repeat(58);
const rows = JSON.parse(INDEX.content.replace(/^window\.EZ_POISK=/, "").replace(/;\s*$/, ""));
const index = CORE.prepare(rows);

function addr(row) {
  return (row.kind === 1 ? "sostoyaniya/" : "razdely/") + row.slug;
}

/* Все адреса, какие вообще есть: опечатка в ожидании должна падать
   как ошибка, а не тихо превращаться в «не нашлось». */
const known = new Set(index.map(addr));

let failed = 0, checks = 0;
const misses = [];

CASES.cases.forEach(c => {
  const found = CORE.find(index, c.q).map(addr);
  const say = found.length ? found.slice(0, 3).join(", ") : "ничего";

  const expected = [].concat(c.top || [], c.in || [], c.not || []);
  expected.forEach(a => {
    if (!known.has(a)) {
      console.log(`  ✗ «${c.q}»: в ожидании указан несуществующий адрес — ${a}`);
      failed++;
    }
  });

  if (c.top) {
    checks++;
    if (found[0] !== c.top) {
      console.log(`  ✗ «${c.q}»: первым ожидался ${c.top}, вышло — ${say}`);
      failed++; misses.push(c.q);
    }
  }
  (c.in || []).forEach(a => {
    checks++;
    if (found.indexOf(a) === -1) {
      console.log(`  ✗ «${c.q}»: не нашёлся ${a}; выдача — ${say}`);
      failed++; misses.push(c.q);
    }
  });
  (c.not || []).forEach(a => {
    checks++;
    if (found.indexOf(a) > -1) {
      console.log(`  ✗ «${c.q}»: не должен был найтись ${a}; выдача — ${say}`);
      failed++; misses.push(c.q);
    }
  });
});

/* Запрос, на который выпадает половина справочника, бесполезен так же,
   как запрос, на который не выпадает ничего. */
let wide = 0;
CASES.cases.forEach(c => { if (CORE.find(index, c.q).length >= CORE.MAX) wide++; });

console.log(line);
console.log(`Запросов                   ${CASES.cases.length}`);
console.log(`Проверок                   ${checks}`);
console.log(`Строк в индексе            ${index.length}`);
console.log(`Запросов с полной выдачей  ${wide} (десять строк и больше — списком не пользуются)`);
console.log(line);

if (failed) {
  console.log(`Поиск не сходится: ${failed} ${failed === 1 ? "ошибка" : "ошибок"}.`);
  console.log("Чинить нужно поиск или синонимы в базе, но не ожидание в этом файле.");
  process.exit(1);
}
console.log("Поиск находит то, что человек ищет своими словами.");
console.log(line);
