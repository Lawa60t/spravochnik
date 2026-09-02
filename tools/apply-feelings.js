#!/usr/bin/env node
"use strict";
/* Применение разметки ощущений и перевод базы на схему 1.1.
   Запуск: node tools/apply-feelings.js

   Что делает:
   1. Во ВСЕХ разделах превращает feelings из массива строк в массив объектов
      { text }. Схема 1.1 требует объекты везде, даже там, где разметки нет.
   2. В размеченных разделах добавляет implies и favors из tools/feelings-markup.json.

   Тексты сверяются дословно: если ощущение в базе не совпало с тем, что записано
   в разметке, применение останавливается. Разметка привязана к смыслу фразы,
   а не к её номеру — переставили ощущения, и разметка молча уехала бы не туда. */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "data");
const markup = JSON.parse(fs.readFileSync(path.join(__dirname, "feelings-markup.json"), "utf8"));

const files = fs.readdirSync(dir).filter(f => f.startsWith("syndromes-") && f !== "syndromes-map.json");
const problems = [];
let converted = 0, marked = 0, withImplies = 0, withFavors = 0;

files.forEach(file => {
  const full = path.join(dir, file);
  const doc = JSON.parse(fs.readFileSync(full, "utf8"));

  doc.syndromes.forEach(s => {
    const rules = markup[s.id];

    s.feelings = s.feelings.map((f, i) => {
      const text = typeof f === "string" ? f : f.text;
      converted++;

      if (!rules) return { text };

      const rule = rules[i];
      if (!rule) {
        problems.push(`${s.id}: в разметке нет ощущения №${i} («${text}»)`);
        return { text };
      }
      if (rule.text !== text) {
        problems.push(`${s.id}[${i}]: в базе «${text}», в разметке «${rule.text}»`);
        return { text };
      }

      const out = { text };
      if (rule.implies) { out.implies = rule.implies; withImplies++; }
      if (rule.favors) { out.favors = rule.favors; withFavors++; }
      if (rule.implies || rule.favors) marked++;
      return out;
    });

    if (rules && rules.length !== s.feelings.length) {
      problems.push(`${s.id}: ощущений в базе ${s.feelings.length}, в разметке ${rules.length}`);
    }
  });

  if (!problems.length) fs.writeFileSync(full, JSON.stringify(doc, null, 2) + "\n", "utf8");
});

const L = "─".repeat(58);
console.log(L);
if (problems.length) {
  console.log("РАЗМЕТКА НЕ ПРИМЕНЕНА");
  console.log(L);
  problems.forEach(p => console.log("  ✗ " + p));
  process.exit(1);
}
console.log("РАЗМЕТКА ОЩУЩЕНИЙ ПРИМЕНЕНА");
console.log(L);
console.log(`Ощущений всего             ${converted}`);
console.log(`Размеченных разделов       ${Object.keys(markup).filter(k => k !== "_комментарий").length}`);
console.log(`Ощущений с разметкой       ${marked}`);
console.log(`  из них implies           ${withImplies}`);
console.log(`  из них favors            ${withFavors}`);
console.log(L);
