#!/usr/bin/env node
/* Проверка целостности базы знаний.
   Запуск: node validate.js
   Ловит: битые ссылки, несуществующие вопросы и ответы, пустые обязательные поля,
   отсутствие источников, разделы без красных флагов, упоминания лечения. */
"use strict";
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "data");

const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const files = fs.readdirSync(dir);

const questions = read("questions.json").questions;
const redflags  = read("redflags.json");
const conditions = files.filter(f => f.startsWith("conditions-"))
  .flatMap(f => read(f).conditions);
const syndromes = files.filter(f => f.startsWith("syndromes-") && f !== "syndromes-map.json")
  .flatMap(f => read(f).syndromes);
const map = read("syndromes-map.json");
const anatomy = read("anatomy.json");

const err = [], warn = [];
const E = m => err.push(m);
const W = m => warn.push(m);

/* Нормализация синонима для сравнения: регистр, ё/е, лишние пробелы и
   знаки не должны считаться различием. «ГЭРБ» и «гэрб» — одно слово. */
const normSyn = s => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/[^0-9a-zа-я]+/g, " ").trim();

/* --- индексы --- */
const qById = new Map(questions.map(q => [q.id, q]));
const cById = new Map();
conditions.forEach(c => {
  if (cById.has(c.id)) E(`Дубль статьи: ${c.id}`);
  cById.set(c.id, c);
});

/* --- статьи --- */
const REQUIRED = ["id","name","icd","what","who","urgent","doctor","tests","sources","status","updated"];
const TREATMENT = /(\d+\s?мг\b|дозиров|принимать по|таблетк[аи] .*раз в день|курс антибиотик|назначают препарат)/i;

conditions.forEach(c => {
  REQUIRED.forEach(f => { if (!c[f]) E(`${c.id}: нет обязательного поля «${f}»`); });
  if (!c.sources || !c.sources.length) E(`${c.id}: нет источника`);
  if (c.what && c.what.length < 40) W(`${c.id}: описание короче 40 символов`);
  if (c.urgent && c.urgent.length < 20) W(`${c.id}: поле «когда неотложно» слишком короткое`);
  const all = [c.what, c.who, c.urgent, c.doctor, c.tests].join(" ");
  if (TREATMENT.test(all)) E(`${c.id}: похоже на упоминание лечения — проверить вручную`);
  if (!["draft","compiled","reviewed","published"].includes(c.status))
    E(`${c.id}: неизвестный статус «${c.status}»`);

  /* --- обиходные синонимы (alt) ---
     alt влияет только на находимость: поиск по сайту и выдача поисковика.
     На веса, ранжирование и структуру не влияет. Проверяем гигиену списка:
     не пустые строки, без дублей внутри статьи и без дословного повтора
     самого названия — синоним, равный названию, поиску ничего не даёт. */
  if (c.alt !== undefined) {
    if (!Array.isArray(c.alt)) E(`${c.id}: alt должен быть массивом`);
    else {
      const seen = new Set();
      c.alt.forEach(a => {
        if (typeof a !== "string" || !a.trim()) E(`${c.id}: пустой синоним в alt`);
        else {
          const n = normSyn(a);
          if (n === normSyn(c.name)) E(`${c.id}: синоним дословно повторяет название — «${a}»`);
          if (seen.has(n)) E(`${c.id}: синоним повторяется внутри статьи — «${a}»`);
          seen.add(n);
        }
      });
    }
  }
});

/* Один синоним у нескольких статей — не всегда ошибка («грыжа» законно
   ведёт и к паховой, и к межпозвонковой), но бессмысленный повтор редкого
   клинического слова у разных болезней означает копипасту. Предупреждаем,
   когда один и тот же синоним встречается больше чем у трёх статей: живое
   обиходное слово так широко не расходится. */
{
  const synHome = new Map();
  conditions.forEach(c => (c.alt || []).forEach(a => {
    const n = normSyn(a);
    if (!synHome.has(n)) synHome.set(n, []);
    synHome.get(n).push(c.id);
  }));
  synHome.forEach((ids, n) => {
    if (ids.length > 3) W(`синоним «${n}» повторяется у ${ids.length} статей: ${ids.join(", ")}`);
  });
}

/* --- разделы --- */
syndromes.forEach(s => {
  /* focused: true — раздел-витрина (названные состояния, находятся поиском).
     Освобождён от «≥5 состояний» и «≥2 тревог», но не от notSearchedHere.
     Разрешён только в витринных зонах skin, pelv, head и gen: на
     диагностических разделах дифференциальный ряд и тревоги обязательны. */
  const focusedZones = ["skin", "pelv", "head", "gen"];
  if (s.focused && !focusedZones.includes(s.zone))
    E(`${s.id}: focused разрешён только в зонах ${focusedZones.join(", ")}, а зона «${s.zone}»`);
  if (s.candidates.length < 5 && !s.focused) E(`${s.id}: меньше пяти состояний в разделе`);
  if (s.feelings.length < 2)   E(`${s.id}: меньше двух вариантов ощущения`);
  if (!s.notSearchedHere || !s.notSearchedHere.length)
    E(`${s.id}: не написано «что здесь не разбирают»`);

  s.questions.forEach(qid => { if (!qById.has(qid)) E(`${s.id}: неизвестный вопрос «${qid}»`); });

  /* --- разметка ощущений, схема 1.1 ---
     Ощущение — первый шаг уточнения, поэтому его разметка проверяется так же
     строго, как веса: ответ не из своего раздела молча не сработает,
     а надбавка сверх пяти сделает ощущение сильнее прямого признака. */
  const ownQuestions = new Set(s.questions);
  const ownConditions = new Set(s.candidates.map(c => c.condition));

  s.feelings.forEach((f, i) => {
    if (typeof f !== "object" || !f.text) {
      E(`${s.id}: ощущение №${i} должно быть объектом с полем text (схема 1.1)`);
      return;
    }
    const where = `${s.id}[${i}] «${f.text}»`;

    Object.entries(f.implies || {}).forEach(([qid, opt]) => {
      const q = qById.get(qid);
      if (!q) return E(`${where}: implies ссылается на неизвестный вопрос «${qid}»`);
      if (!ownQuestions.has(qid)) E(`${where}: вопрос «${qid}» не входит в вопросы этого раздела`);
      if (!q.options.some(o => o.id === opt)) E(`${where}: у вопроса «${qid}» нет варианта «${opt}»`);
      if (opt === "unk") E(`${where}: «не знаю» не может быть подставленным ответом`);
    });

    Object.entries(f.favors || {}).forEach(([cid, value]) => {
      if (!cById.has(cid)) return E(`${where}: favors ссылается на несуществующее состояние «${cid}»`);
      if (!ownConditions.has(cid)) E(`${where}: состояние «${cid}» не входит в кандидатов этого раздела`);
      if (!Number.isInteger(value) || value < 3 || value > 5)
        E(`${where}: надбавка «${cid}» равна ${value}, допустимо от 3 до 5`);
    });
  });

  let rf = 0;
  s.candidates.forEach(cand => {
    const c = cById.get(cand.condition);
    if (!c) { E(`${s.id}: ссылка на несуществующую статью «${cand.condition}»`); return; }
    if (c.redflag) rf++;
    Object.keys(cand.weights || {}).forEach(k => {
      const i = k.indexOf("_");
      const qid = k.slice(0, i), oid = k.slice(i + 1);
      const q = qById.get(qid);
      if (!q) { E(`${s.id}/${cand.condition}: вес по неизвестному вопросу «${qid}»`); return; }
      if (!q.options.some(o => o.id === oid))
        E(`${s.id}/${cand.condition}: у вопроса «${qid}» нет варианта «${oid}»`);
      if (oid === "unk") E(`${s.id}/${cand.condition}: вес на ответе «не знаю» — так нельзя`);
      if (!s.questions.includes(qid))
        W(`${s.id}/${cand.condition}: вес по вопросу «${qid}», которого нет в списке вопросов раздела`);
    });
  });
  if (rf < 2 && !s.focused) E(`${s.id}: меньше двух состояний «редко, но важно» (сейчас ${rf})`);
});

/* --- красные флаги --- */
redflags.global.forEach(r => {
  const conds = (r.when.all || r.when.any || []).concat(r.unless || []);
  conds.forEach(c => {
    Object.entries(c).forEach(([qid, vals]) => {
      const q = qById.get(qid);
      if (!q) { E(`redflag ${r.id}: неизвестный вопрос «${qid}»`); return; }
      vals.forEach(v => { if (!q.options.some(o => o.id === v))
        E(`redflag ${r.id}: у вопроса «${qid}» нет варианта «${v}»`); });
    });
  });
});

/* --- карта --- */
const mapIds = new Set(map.syndromes.map(s => s.id));
syndromes.forEach(s => { if (!mapIds.has(s.id)) W(`${s.id}: раздела нет в карте справочника`); });

/* --- якоря --- */
const mapAll = new Set(map.syndromes.map(s => s.id));
let subCount = 0, anchorLinks = 0;
const anchored = new Set();
/* Имя участка и ориентир — разные вещи, и путать их нельзя.
   name — то, как участок называется в списке: «Стопа», «Поясница слева».
   landmark — где он находится: «Ниже лодыжки», «Рёберно-позвоночный угол».
   Ориентир писался для калибровки под модель тела, заголовком он читается
   как сбой генератора, поэтому проверяем, что имя есть и что оно не повторяет
   ориентир дословно. */
const norm = s => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

anatomy.zones.forEach(z => z.subzones.forEach(sz => {
  subCount++;
  if (!sz.name || !String(sz.name).trim()) E(`участок ${sz.id}: нет имени (поле name)`);
  else if (norm(sz.name) === norm(sz.landmark)) E(`участок ${sz.id}: имя дословно повторяет ориентир — «${sz.name}»`);
  if (!sz.noAnchor && !z.noAnchor && !sz.box) E(`якорь ${sz.id}: нет координат box`);
  if (sz.box) {
    const b = sz.box;
    if (b.u0 >= b.u1 || b.v0 >= b.v1) E(`якорь ${sz.id}: перевёрнутый box`);
    [b.u0, b.u1, b.v0, b.v1].forEach(n => { if (n < 0 || n > 1) E(`якорь ${sz.id}: координата вне 0..1`); });
  }
  sz.syndromes.forEach(id => {
    anchorLinks++; anchored.add(id);
    if (!mapAll.has(id)) E(`якорь ${sz.id}: ссылка на несуществующий раздел «${id}»`);
  });
}));
map.syndromes.forEach(s => { if (!anchored.has(s.id)) E(`раздел ${s.id}: до него нельзя добраться — нет якоря`); });

/* --- переиспользование --- */
const usage = new Map();
syndromes.forEach(s => s.candidates.forEach(c =>
  usage.set(c.condition, (usage.get(c.condition) || 0) + 1)));
const unused = conditions.filter(c => !usage.has(c.id));

/* --- отчёт --- */
const line = "─".repeat(58);
console.log(line);
console.log("БАЗА ЗНАНИЙ — ПРОВЕРКА");
console.log(line);
console.log(`Вопросов в общем пуле      ${questions.length}`);
console.log(`Статей о состояниях        ${conditions.length}`);
console.log(`  из них «редко, но важно» ${conditions.filter(c => c.redflag).length}`);
console.log(`Разделов готово            ${syndromes.length} из ${map.syndromes.length}`);
console.log(`Связей раздел → состояние  ${[...usage.values()].reduce((a, b) => a + b, 0)}`);
console.log(`Правил красных флагов      ${redflags.global.length}`);
console.log(`Якорей на модели тела      ${subCount} участков, ${anchorLinks} связей`);
const reuse = [...usage.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
console.log(`Переиспользуется статей    ${reuse.length}`);
if (reuse.length) console.log(`  чаще всего: ${reuse.slice(0, 5).map(([id, n]) => `${id} (${n})`).join(", ")}`);
if (unused.length) console.log(`Написано, но не связано    ${unused.length}: ${unused.map(c => c.id).join(", ")}`);
console.log(line);
if (err.length)  { console.log(`ОШИБКИ (${err.length}):`);  err.forEach(e => console.log("  ✗ " + e)); }
if (warn.length) { console.log(`ЗАМЕЧАНИЯ (${warn.length}):`); warn.forEach(w => console.log("  · " + w)); }
if (!err.length) console.log("Ошибок нет.");
console.log(line);
process.exit(err.length ? 1 : 0);
