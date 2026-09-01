#!/usr/bin/env node
"use strict";
/* Прогон жадного выбора вопроса. Запуск: node tools/test-selector.js

   Зачем отдельный прогон. 252 виньетки проверяют ранжирование, подавая ответы
   пачкой — селектора они не касаются вообще. А главная ошибка такого алгоритма
   в том, что он задаёт восемь вопросов подряд, ничего не различающих,
   и ни одного нужного: ранжирование при этом остаётся идеальным,
   потому что в тестах ответы приходят готовыми.

   Поэтому здесь те же 252 случая проигрываются иначе: спрашивает селектор,
   а прогон отвечает — ответом виньетки, если он в ней есть, и «не знаю», если нет.
   Живой человек ведёт себя так же: на вопрос не про него он жмёт «не знаю».

   Проверяется: за 10 шагов достигается та же вершина, что при полной подаче.
   Красные флаги проверяются после каждого ответа, а не в конце. */
const E = require("../src/engine.js");
const DATA = require("../src/engine-data.js");

const MAX_STEPS = 10;
const L = "─".repeat(58);

/* Порог, а не «все 252». Прогон намеренно пессимистичнее жизни: когда в виньетке
   нет ответа на заданный вопрос, здесь отвечают «не знаю», а живой человек
   на вопрос про желтуху или про озноб ответит. Виньетка перечисляет только те
   признаки, которые её автор счёл нужным записать, поэтому часть расхождений
   заложена в самой постановке и вычистить её до нуля нельзя.

   Числа ниже — не идеал, а храповик: они зафиксированы по факту и сборка падает,
   если стало хуже. Ослаблять их можно только вместе с объяснением почему. */
const MIN_SAME_TOP = 240;    /* из 252 */
const MAX_ALARM_LOST = 2;    /* тревог, упущенных диалогом */

function run() {
  const vign = DATA.vignettes();
  const problems = [];
  let same = 0;
  let steps = 0, unknowns = 0, missed = 0, asked = 0, withExpectTop = 0;
  const alarmDrift = [];

  vign.forEach(v => {
    const syn = E.sById.get(v.syndrome);
    const full = E.present(v.syndrome, { sex: v.sex, age: v.age, answers: v.answers });
    const wanted = full.all[0].id;
    if (v.expectTop) withExpectTop++;

    /* --- диалог --- */
    const answers = {};
    const path = [];
    let alarms = [];

    for (let i = 0; i < MAX_STEPS; i++) {
      const q = E.nextQuestion(v.syndrome, { sex: v.sex, age: v.age, answers });
      if (!q) break;

      const has = Object.prototype.hasOwnProperty.call(v.answers, q.id);
      const a = has ? v.answers[q.id] : "unk";
      answers[q.id] = a;
      path.push(q.id + "=" + a);
      asked++;
      if (!has) unknowns++;

      /* после каждого ответа, а не в конце */
      alarms = E.checkRedflags(
        Object.assign({}, syn.implies || {}, answers),
        v.age,
        syn.zone
      );
    }

    steps += path.length;

    /* ответы виньетки, которые селектор мог спросить, но не спросил */
    const askable = new Set(syn.questions);
    Object.keys(v.answers).forEach(qid => {
      if (askable.has(qid) && answers[qid] === undefined) missed++;
    });

    const got = E.present(v.syndrome, { sex: v.sex, age: v.age, answers });
    if (got.all[0].id === wanted) same++;
    else problems.push({ v, wanted, got: got.all[0].id, path });

    /* тревога, поднятая при полной подаче, но упущенная в диалоге — отдельный риск:
       справочник промолчал там, где при тех же ответах он бы предупредил */
    const fullAlarms = full.alarms.map(a => a.id);
    const gotAlarms = alarms.map(a => a.id);
    const lost = fullAlarms.filter(a => !gotAlarms.includes(a));
    if (lost.length) alarmDrift.push({ v, lost, path });
  });

  console.log(L);
  console.log("ПРОГОН ВЫБОРА ВОПРОСОВ");
  console.log(L);
  console.log(`Случаев                    ${vign.length}`);
  console.log(`Вершина совпала            ${same} из ${vign.length}`);
  console.log(`Из них с заданным expectTop ${withExpectTop}`);
  console.log(`Вопросов задано в среднем  ${(steps / vign.length).toFixed(1)} из ${MAX_STEPS}`);
  console.log(`Из них «не знаю»           ${asked ? Math.round((unknowns / asked) * 100) : 0} %`);
  console.log(`Ответов не спрошено        ${missed}`);
  console.log(L);

  if (alarmDrift.length) {
    console.log(`Тревога упущена в диалоге: ${alarmDrift.length}`);
    alarmDrift.slice(0, 8).forEach(d =>
      console.log(`  ! ${d.v.id} ${d.v.note} — не сработало: ${d.lost.join(", ")}`)
    );
    if (alarmDrift.length > 8) console.log(`  ! …и ещё ${alarmDrift.length - 8}`);
    console.log(L);
  }

  if (problems.length) {
    console.log(`Вершина разошлась: ${problems.length}`);
    problems.slice(0, 15).forEach(p => {
      console.log(`  ✗ ${p.v.id}  ${p.v.note}`);
      console.log(`      ожидалось «${p.wanted}», получилось «${p.got}»`);
      console.log(`      спрошено: ${p.path.join(" · ") || "ничего"}`);
    });
    if (problems.length > 15) console.log(`  ✗ …и ещё ${problems.length - 15}`);
    console.log(L);
  }

  const bad = [];
  if (same < MIN_SAME_TOP) bad.push(`вершина совпала ${same} раз, порог ${MIN_SAME_TOP}`);
  if (alarmDrift.length > MAX_ALARM_LOST)
    bad.push(`тревог упущено ${alarmDrift.length}, порог ${MAX_ALARM_LOST}`);

  if (bad.length) {
    console.log("СТАЛО ХУЖЕ:");
    bad.forEach(b => console.log(`  ✗ ${b}`));
    console.log(L);
    process.exit(1);
  }

  console.log(`Диалог приводит туда же, куда полная подача (порог ${MIN_SAME_TOP}, тревог не больше ${MAX_ALARM_LOST}).`);
  console.log(L);
}

if (require.main === module) run();
module.exports = { run };
