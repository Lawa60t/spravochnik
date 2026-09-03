#!/usr/bin/env node
"use strict";
/* Замок на веса. Запуск: node tools/check-weights.js

   ПРАВИЛО. Веса, базовые частоты и стоп-факторы в data/ не трогаются никогда.
   Они проверены 252 существующими случаями, и это единственное, что стоит между
   справочником и тихой порчей: изменённый вес не роняет ни один тест — он просто
   меняет то, что человек прочитает, и обнаружится читателем, а не прогоном.

   Соблазн выглядит безобидно. Разметка ощущения не сработала, потому что
   на нужном ответе весов нет, — и рука тянется добавить +3. Так делать нельзя:
   виновата разметка или ожидание в тесте, но не веса.

   Как работает замок. Отпечаток снимается только с того, что запрещено менять:
   condition, base, weights, stop — по каждому разделу отдельно, чтобы сообщение
   называло виновника. feelings, questions, notSearchedHere и всё прочее
   в отпечаток не входят: их менять можно.

   Если правка весов однажды всё же понадобится, замок не запрещает её физически —
   он делает её заметной: цифры в tools/weights-lock.json придётся переписать
   отдельной строкой в диффе, и это будет видно при просмотре. Молча не пройдёт. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dir = path.join(__dirname, "..", "data");
const lockPath = path.join(__dirname, "weights-lock.json");

/* Каноническая запись: порядок ключей в JSON не должен влиять на отпечаток. */
function canonical(s) {
  return JSON.stringify(
    s.candidates
      .map(c => ({
        condition: c.condition,
        base: c.base,
        weights: Object.keys(c.weights || {}).sort().map(k => [k, c.weights[k]]),
        stop: (c.stop || []).slice().sort()
      }))
      .sort((a, b) => (a.condition < b.condition ? -1 : a.condition > b.condition ? 1 : 0))
  );
}

function fingerprints() {
  const out = {};
  fs.readdirSync(dir)
    .filter(f => f.startsWith("syndromes-") && f !== "syndromes-map.json")
    .forEach(f => {
      JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).syndromes.forEach(s => {
        out[s.id] = crypto.createHash("sha256").update(canonical(s)).digest("hex").slice(0, 12);
      });
    });
  return out;
}

function run(write) {
  const now = fingerprints();
  const ids = Object.keys(now).sort();
  const L = "─".repeat(58);

  if (write || !fs.existsSync(lockPath)) {
    const lock = {
      _комментарий: [
        "Отпечатки весов, базовых частот и стоп-факторов по разделам.",
        "Меняются только вместе с осознанной правкой весов — см. tools/check-weights.js.",
        "Пересчитать: node tools/check-weights.js --write"
      ],
      разделов: ids.length,
      отпечатки: now
    };
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n", "utf8");
    console.log(`Замок записан: ${ids.length} разделов.`);
    return;
  }

  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  const was = lock.отпечатки || {};
  const changed = ids.filter(id => was[id] && was[id] !== now[id]);
  const added = ids.filter(id => !was[id]);
  const gone = Object.keys(was).filter(id => !now[id]);

  console.log(L);
  console.log("ЗАМОК НА ВЕСА");
  console.log(L);
  console.log(`Разделов под замком        ${ids.length}`);

  if (!changed.length && !added.length && !gone.length) {
    console.log(L);
    console.log("Веса, базовые частоты и стоп-факторы не менялись.");
    console.log(L);
    return;
  }

  console.log(L);
  console.log("ВЕСА ИЗМЕНИЛИСЬ — это запрещено правилом проекта:");
  changed.forEach(id => console.log(`  ✗ ${id}`));
  added.forEach(id => console.log(`  ✗ ${id} — раздел появился, в замке его нет`));
  gone.forEach(id => console.log(`  ✗ ${id} — раздел исчез`));
  console.log(L);
  console.log("Если разметка ощущения не сработала — виновата разметка или ожидание");
  console.log("в тесте, но не веса. Веса проверены 252 случаями.");
  console.log("Осознанная правка весов: node tools/check-weights.js --write,");
  console.log("и тогда изменение отпечатков будет видно в диффе отдельной строкой.");
  console.log(L);
  process.exit(1);
}

if (require.main === module) run(process.argv.includes("--write"));
module.exports = { fingerprints, run };
