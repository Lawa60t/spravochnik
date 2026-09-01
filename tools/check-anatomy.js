#!/usr/bin/env node
/* Проверка слоя якорей: стороны тела и зеркальные пары.
   Запуск: node tools/check-anatomy.js
   Вызывается из сборки. Любое несовпадение — ошибка, а не предупреждение:
   участок, уехавший на другую половину тела, молча уводит человека
   с «правого подреберья» на левое, и ни один тест базы этого не поймает.

   КОНВЕНЦИЯ (она же в CLAUDE.md, раздел «Слой якорей»):
   u — координата ТЕЛА, не экрана. u < 0.5 — левая половина тела, u > 0.5 — правая,
   одинаково на виде спереди и на виде сзади.
   Зеркалится вид, а не зона:
     вид сзади  — по формуле как есть,      u' = u
     вид спереди — с заменой,               u' = 1 - u
   Отсюда: на виде спереди правая сторона тела оказывается слева на экране. */
"use strict";
const fs = require("fs");
const path = require("path");

const anatomy = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "anatomy.json"), "utf8")
);

/* Экранная координата участка по координате тела. */
const toScreen = (u, view) => (view === "front" ? 1 - u : u);

/* На какой половине ЭКРАНА обязан оказаться центр после преобразования вида. */
function expectedHalf(side, view) {
  if (view === "front") return side === "right" ? "left" : "right";
  return side === "right" ? "right" : "left";
}

function check() {
  const err = [];
  let sided = 0, pairs = 0;

  anatomy.zones.forEach(zone => {
    (zone.subzones || []).forEach(sub => {
      if (!sub.side) return;
      sided++;

      if (zone.view !== "front" && zone.view !== "back") {
        err.push(`${sub.id}: сторона «${sub.side}» указана в зоне «${zone.id}» с видом «${zone.view}» — сторону нельзя разместить`);
        return;
      }
      if (!sub.box) {
        err.push(`${sub.id}: сторона указана, а бокса нет`);
        return;
      }

      const centerBody = (sub.box.u0 + sub.box.u1) / 2;
      const bodyHalf = centerBody < 0.5 ? "left" : "right";
      if (bodyHalf !== sub.side) {
        err.push(`${sub.id} («${sub.label}»): side=${sub.side}, а центр по телу u=${centerBody.toFixed(3)} — это ${bodyHalf === "left" ? "левая" : "правая"} половина тела`);
        return;
      }

      const centerScreen = toScreen(centerBody, zone.view);
      const screenHalf = centerScreen < 0.5 ? "left" : "right";
      const want = expectedHalf(sub.side, zone.view);
      if (screenHalf !== want) {
        err.push(`${sub.id} («${sub.label}»): вид ${zone.view}, side=${sub.side} — после преобразования центр u'=${centerScreen.toFixed(3)} попал на ${screenHalf === "left" ? "левую" : "правую"} половину экрана, ожидалась ${want === "left" ? "левая" : "правая"}`);
      }
    });

    /* Зеркальные пары: описана одна конечность, вторая рисуется отражением.
       Если бокс пересекает осевую линию, отражённая копия наложится на исходную. */
    if (zone.mirrorPair) {
      pairs++;
      const boxes = [zone.box, ...(zone.subzones || []).map(s => s.box)].filter(Boolean);
      boxes.forEach((b, i) => {
        if (b.u0 < 0.5 && b.u1 > 0.5) {
          const who = i === 0 ? zone.id : (zone.subzones[i - 1] || {}).id;
          err.push(`${who}: зеркальная пара, но бокс u=${b.u0}–${b.u1} пересекает осевую линию — отражённая копия наложится на исходную`);
        }
      });
    }
  });

  return { err, sided, pairs };
}

module.exports = { check, toScreen, expectedHalf };

if (require.main === module) {
  const { err, sided, pairs } = check();
  const L = "─".repeat(58);
  console.log(L);
  console.log("СЛОЙ ЯКОРЕЙ — ПРОВЕРКА СТОРОН");
  console.log(L);
  console.log(`Участков со стороной тела   ${sided}`);
  console.log(`Зеркальных пар              ${pairs}`);
  console.log(L);
  if (err.length) {
    console.log(`Ошибок: ${err.length}`);
    err.forEach(e => console.log(`  ✗ ${e}`));
    console.log(L);
    process.exit(1);
  }
  console.log("Стороны сходятся.");
  console.log(L);
}
