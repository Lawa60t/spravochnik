/* Движок ранжирования релевантности статей + слой красных флагов.
   Тот же код пойдёт на сайт. Здесь он используется для прогона тестовых случаев.
   Запуск: node engine.js */
"use strict";
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "data");
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const files = fs.readdirSync(dir);

const QUESTIONS  = read("questions.json").questions;
const REDFLAGS   = read("redflags.json");
const CONDITIONS = files.filter(f => f.startsWith("conditions-")).flatMap(f => read(f).conditions);
const SYNDROMES  = files.filter(f => f.startsWith("syndromes-") && f !== "syndromes-map.json")
                        .flatMap(f => read(f).syndromes);

const cById = new Map(CONDITIONS.map(c => [c.id, c]));
const sById = new Map(SYNDROMES.map(s => [s.id, s]));

/* ---------- слой красных флагов ---------- */
function matchCond(cond, answers) {
  return Object.entries(cond).every(([qid, vals]) => vals.includes(answers[qid]));
}
function checkRedflags(answers, age, zone) {
  return REDFLAGS.global.filter(r => {
    if (r.zones && zone && !r.zones.includes(zone)) return false;
    if (r.minAge !== undefined && age !== undefined && age < r.minAge) return false;
    if (r.maxAge !== undefined && age !== undefined && age > r.maxAge) return false;
    if (r.unless && r.unless.some(c => matchCond(c, answers))) return false;
    if (r.when.all) return r.when.all.every(c => matchCond(c, answers));
    if (r.when.any) return r.when.any.some(c => matchCond(c, answers));
    return false;
  });
}

/* ---------- ранжирование ---------- */
function rank(syndromeId, input) {
  const { sex, age } = input;
  const s = sById.get(syndromeId);
  if (!s) throw new Error("нет раздела " + syndromeId);

  const answers = Object.assign({}, s.implies || {}, input.answers);
  const keys = Object.entries(answers)
    .filter(([, v]) => v && v !== "unk")
    .map(([q, v]) => `${q}_${v}`);

  return s.candidates.map(cand => {
    const c = cById.get(cand.condition);
    let v = cand.base;
    const hits = [], against = [];

    keys.forEach(k => {
      const w = (cand.weights || {})[k];
      if (w === undefined) return;
      v += w;
      if (w > 0) hits.push(k); else if (w <= -2) against.push(k);
    });

    if ((cand.stop || []).some(k => keys.includes(k))) v = -99;

    /* поправки на пол и возраст из самой статьи */
    if (c.sexOnly && c.sexOnly !== sex) v = -99;
    if (c.ageMin !== undefined && age < c.ageMin) v -= 3;
    if (c.ageMax !== undefined && age > c.ageMax) v -= 3;

    return { id: c.id, name: c.name, redflag: !!c.redflag, score: v, hits, against };
  })
  .filter(r => r.score > -50)
  .sort((a, b) => b.score - a.score);
}

/* ---------- выдача, как её увидит человек ---------- */
function present(syndromeId, input) {
  const list = rank(syndromeId, input);
  const syn = sById.get(syndromeId);
  const alarms = checkRedflags(Object.assign({}, syn.implies || {}, input.answers), input.age, syn.zone);
  const crit = list.filter(r => r.redflag).slice(0, 4);
  const rest = list.filter(r => !r.redflag);
  return {
    alarms,
    blocks: {
      "Редко, но важно не пропустить": crit,
      "Встречается часто": rest.slice(0, 4),
      "Встречается реже": rest.slice(4, 9)
    },
    all: list
  };
}

module.exports = { rank, present, checkRedflags, QUESTIONS, CONDITIONS, SYNDROMES, cById, sById };

/* ---------- прогон тестовых случаев ---------- */
if (require.main === module) {
  const vign = files.filter(f => f.startsWith("vignettes-")).flatMap(f => read(f).cases);
  let pass = 0, fail = 0;
  const problems = [];
  const L = "─".repeat(58);
  console.log(L); console.log("ПРОГОН ТЕСТОВЫХ СЛУЧАЕВ"); console.log(L);

  vign.forEach(v => {
    const res = present(v.syndrome, { sex: v.sex, age: v.age, answers: v.answers });
    const top5 = res.all.slice(0, 5).map(r => r.id);
    const top3 = res.all.slice(0, 3).map(r => r.id);
    const alarmed = res.alarms.length > 0;
    const bad = [];

    (v.expect || []).forEach(e => { if (!top5.includes(e)) bad.push(`«${e}» не попал в топ-5`); });
    if (v.expectTop && res.all[0].id !== v.expectTop)
      bad.push(`первым ожидался «${v.expectTop}», а стоит «${res.all[0].id}»`);
    (v.notExpect || []).forEach(n => { if (top3.includes(n)) bad.push(`«${n}» ошибочно в топ-3`); });
    if (v.expectAlarm !== undefined && v.expectAlarm !== alarmed)
      bad.push(v.expectAlarm ? "красный флаг НЕ сработал, а должен" : "красный флаг сработал зря");

    if (bad.length) {
      fail++;
      problems.push({ v, bad, top5, alarms: res.alarms.map(a => a.id) });
      console.log(`✗ ${v.id}  ${v.note}`);
      bad.forEach(b => console.log(`     ${b}`));
      console.log(`     топ-5: ${top5.join(", ")}`);
    } else {
      pass++;
      const flag = alarmed ? ` [флаг: ${res.alarms.map(a => a.id).join(",")}]` : "";
      console.log(`✓ ${v.id}  ${v.note}${flag}`);
    }
  });

  console.log(L);
  console.log(`Пройдено ${pass} из ${pass + fail}`);
  console.log(L);
  process.exit(fail ? 1 : 0);
}
