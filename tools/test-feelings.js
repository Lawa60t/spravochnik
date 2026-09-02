#!/usr/bin/env node
"use strict";
/* Прогон разметки ощущений. Запуск: node tools/test-feelings.js

   Проверяет то, ради чего разметка делалась: выбор ощущения — и больше ничего —
   поднимает в первую тройку то состояние, ради которого ощущение написано.

   Ожидаемое состояние взято из tools/feelings-cases.json, где оно указано
   вручную. Выводить его из кода нельзя: тест тогда проверял бы сам себя.

   Отдельно проверяется, что каждое размеченное ощущение вообще имеет свой
   случай: разметка без проверки — это разметка, о поломке которой никто
   не узнает. */
const E = require("../src/engine.js");
const cases = require("./feelings-cases.json").cases;

const L = "─".repeat(58);

function run() {
  const problems = [];
  let ok = 0;

  cases.forEach(c => {
    const s = E.sById.get(c.syndrome);
    if (!s) return problems.push(`${c.syndrome}: нет такого раздела`);
    const f = s.feelings[c.feeling];
    if (!f) return problems.push(`${c.syndrome}[${c.feeling}]: нет такого ощущения`);
    if (!f.implies && !f.favors)
      return problems.push(`${c.syndrome}[${c.feeling}] «${f.text}»: случай есть, а разметки нет`);

    const plain = { sex: c.sex, age: c.age, answers: {} };
    const input = { sex: c.sex, age: c.age, answers: {}, feeling: c.feeling };
    const before = E.rank(c.syndrome, plain);
    const after = E.rank(c.syndrome, input);
    const scoreBefore = new Map(before.map(r => [r.id, r.score]));
    const top3 = after.slice(0, 3).map(r => r.id);
    const bad = [];

    /* Главная проверка: состояние выросло именно от выбора ощущения.
       Без неё «оказалось в тройке» ничего не доказывает. */
    (c.expectRise || []).forEach(id => {
      const was = scoreBefore.get(id);
      const now = (after.find(r => r.id === id) || {}).score;
      if (was === undefined || now === undefined) bad.push(`«${id}» вообще нет в разделе`);
      else if (now <= was) bad.push(`«${id}» не вырос: было ${was}, стало ${now}`);
    });

    (c.expect || []).forEach(id => {
      if (!top3.includes(id)) bad.push(`«${id}» не попал в тройку`);
    });

    /* Разметка, которая порядок не меняет, не должна его менять и впредь:
       если веса на этот ответ однажды появятся, тест это заметит. */
    if (c.onlySaves) {
      const moved = after.filter(r => r.score !== scoreBefore.get(r.id));
      if (moved.length) bad.push(`порядок изменился, хотя случай помечен onlySaves: ${moved.map(r => r.id).join(", ")}`);
      if (!f.implies) bad.push("onlySaves без implies — нечего снимать");
    }

    /* Подставленные ответы не должны спрашиваться заново. Это работает всегда,
       даже когда порядок не меняется, и ради этого одного разметка уже полезна. */
    Object.keys(f.implies || {}).forEach(qid => {
      const asked = [];
      const answers = {};
      for (let step = 0; step < 10; step++) {
        const q = E.nextQuestion(c.syndrome, { sex: c.sex, age: c.age, answers, feeling: c.feeling });
        if (!q) break;
        asked.push(q.id);
        answers[q.id] = q.options.find(o => o.id !== "unk").id;
      }
      if (asked.includes(qid)) bad.push(`вопрос «${qid}» задан заново, хотя ответ на него уже подставлен`);
    });

    if (bad.length) {
      problems.push(
        `${c.syndrome}[${c.feeling}] «${f.text}»\n` +
        bad.map(b => `      ${b}`).join("\n") + `\n` +
        `      было:  ${before.slice(0, 3).map(r => r.id + "/" + r.score).join(", ")}\n` +
        `      стало: ${after.slice(0, 3).map(r => r.id + "/" + r.score).join(", ")}`
      );
    } else ok++;
  });

  /* Размеченные ощущения без своего случая */
  const covered = new Set(cases.map(c => c.syndrome + "#" + c.feeling));
  const uncovered = [];
  E.SYNDROMES.forEach(s => {
    (s.feelings || []).forEach((f, i) => {
      if ((f.implies || f.favors) && !covered.has(s.id + "#" + i))
        uncovered.push(`${s.id}[${i}] «${f.text}»`);
    });
  });

  console.log(L);
  console.log("ПРОГОН РАЗМЕТКИ ОЩУЩЕНИЙ");
  console.log(L);
  console.log(`Случаев                    ${cases.length}`);
  console.log(`Случаев прошло             ${ok} из ${cases.length}`);
  console.log(`Размечено без проверки     ${uncovered.length}`);
  console.log(L);

  if (uncovered.length) {
    console.log("Размечено, но не проверено:");
    uncovered.forEach(u => console.log(`  ! ${u}`));
    console.log(L);
  }

  if (problems.length) {
    console.log(`Не сработало: ${problems.length}`);
    problems.forEach(p => console.log(`  ✗ ${p}`));
    console.log(L);
    process.exit(1);
  }

  if (uncovered.length) process.exit(1);

  console.log("Каждое размеченное ощущение поднимает то, ради чего написано.");
  console.log(L);
}

if (require.main === module) run();
module.exports = { run };
