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

/* Что здесь порог, а что справка.

   ПОРОГ — упущенные тревоги, и он равен нулю. Тревога, сработавшая при полной
   подаче, но не сработавшая в диалоге, означает: ответы у человека были,
   справочник их не спросил и промолчал. Это не статистика, а дефект с именем.
   Так терялись ишемия кишечника и лейкоз, пока надбавка правилу из трёх условий
   проигрывала обычному вопросу.

   СПРАВКА — совпадение вершины. Порогом её делать неправильно: при меньшем числе
   ответов другой порядок статей законен, а прогон намеренно пессимистичнее жизни —
   когда в виньетке нет ответа на заданный вопрос, здесь отвечают «не знаю»,
   а живой человек на вопрос про желтуху ответит. Число печатается, чтобы видеть
   движение, но сборку не роняет. */
const MAX_ALARM_LOST = 0;

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
    console.log(`Вершина разошлась (справочно, сборку не роняет): ${problems.length}`);
    problems.slice(0, 6).forEach(p => {
      console.log(`  · ${p.v.id}  ${p.v.note}`);
      console.log(`      ожидалось «${p.wanted}», получилось «${p.got}»`);
      console.log(`      спрошено: ${p.path.join(" · ") || "ничего"}`);
    });
    if (problems.length > 6) console.log(`  · …и ещё ${problems.length - 6}`);
    console.log(L);
  }

  if (alarmDrift.length > MAX_ALARM_LOST) {
    console.log("СТАЛО ХУЖЕ:");
    console.log(`  ✗ тревог упущено ${alarmDrift.length}, допускается ${MAX_ALARM_LOST}`);
    console.log(L);
    process.exit(1);
  }

  console.log("Диалог не теряет ни одной тревоги, поднятой при полной подаче.");
  console.log(L);
}

if (require.main === module) run();
module.exports = { run };
