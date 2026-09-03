"use strict";
/* Текстовый указатель областей. Это основа, а не «версия без модели»:
   фигура на четвёртом этапе ляжет поверх этих же страниц и приведёт
   в те же самые разделы. Отдельной версии без фигуры быть не должно —
   второй сайт всегда отстаёт от первого. */
const { page, esc, attr } = require("../layout");
const meta = require("../meta");
const T = require("../text");
const D = require("../data");

function syndromeLinks(list) {
  return `<ul class="links">
        ${list
          .map(
            s =>
              `<li><a href="${attr(D.syndromePath(s.id))}">${esc(s.name)}</a>${
                s.aka && s.aka.length ? `<span class="aka">${esc(s.aka.join(" · "))}</span>` : ""
              }</li>`
          )
          .join("\n        ")}
      </ul>`;
}

/* Пояснение, дословно повторяющее название, читается как сбой генератора:
   «Руки — Руки», «Ноги — Ноги», «Кожа, волосы, ногти — Кожа, волосы, ногти».
   Так выходит там, где область целиком укладывается в один участок слоя якорей
   и его подпись совпадает с названием области.

   Сравниваем не строки, а смысл: регистр, ё/е, знаки препинания и лишние
   пробелы не считаются различием. Слово «область» на конце пояснения тоже
   не считается: «Таз, пах, мочеполовая область» ничего не добавляет
   к названию «Таз, пах, мочеполовая». */
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^0-9a-zа-я]+/g, " ")
    .trim();
}

function addsNothing(explanation, name) {
  const e = norm(explanation).replace(/\s+область$/, "");
  return !e || e === norm(name);
}

/* ---------- /oblasti/ ---------- */
function zonesPage(updated) {
  const m = meta.zones(D.map.zones.length);

  const items = D.map.zones
    .map(z => {
      const n = D.syndromesOfZone(z.id).length;
      const az = D.anatomyZonesOf(z.id);
      const parts = az.map(a => a.label).join(" · ");
      const gist = addsNothing(parts, z.name) ? "" : parts;
      return `<li>
        <a href="${attr(D.zonePath(z.id))}">${esc(z.name)}</a>
        <span class="count">${n} ${esc(T.zones.sectionsWord)}</span>
        ${gist ? `<span class="gist">${esc(gist)}</span>` : ""}
      </li>`;
    })
    .join("\n      ");

  const sym = D.symptomList();

  const body = `<div class="zones">
  <h1>${esc(T.zones.title)}</h1>
  <p class="lead">${esc(T.zones.lead)} <a href="/ukazatel/">${esc(T.index.title)}</a> — если знаете название.</p>

  <ul class="conditions zonelist">
      ${items}
  </ul>

  <section class="block">
    <h2>${esc(T.zones.noAnchorTitle)}</h2>
    <p class="note">${esc(T.zones.noAnchorLead)}</p>
    <p><a href="/zhaloby/">${esc(sym.label)}</a> — ${sym.syndromes.length} ${esc(T.zones.sectionsWord)}</p>
  </section>
</div>`;

  return page({
    title: m.title,
    description: m.description,
    path: "/oblasti/",
    body,
    updated,
    bodyClass: "page-zones"
  });
}

/* ---------- /oblasti/<зона>/ ---------- */
function zonePage(zone, updated) {
  const { groups, rest } = D.zoneGroups(zone.id);
  const count = D.syndromesOfZone(zone.id).length;
  const m = meta.zone(zone, count);

  /* Когда группа одна, её заголовок дословно повторяет h1 страницы. */
  const showGroupTitle = groups.length > 1;

  const groupsHtml = groups
    .map(
      g => `<section class="block">
    ${showGroupTitle ? `<h2>${esc(g.label)}</h2>` : ""}
    ${g.landmark ? `<p class="note">${esc(g.landmark)}</p>` : ""}
    ${g.subzones
      .map(
        sz => `<div class="subzone">
      ${/* Заголовок — имя участка, а не ориентир: «Стопа», а не «Ниже лодыжки».
           Ориентир идёт второй строкой мельче — он отвечает на другой вопрос,
           «где это на теле», и нужен тому, кто не уверен, туда ли попал. */ ""}
      ${/* Тот же случай, что и в списке областей: у зоны с единственным
           участком его имя может дословно повторять заголовок страницы. */ ""}
      ${addsNothing(sz.name, zone.name) ? "" : `<h3>${esc(sz.name)}</h3>`}
      ${sz.landmark ? `<p class="note">${esc(sz.landmark)}</p>` : ""}
      ${syndromeLinks(sz.syndromes)}
    </div>`
      )
      .join("\n    ")}
  </section>`
    )
    .join("\n  ");

  const restHtml = rest.length
    ? `<section class="block">
    <h2>${esc(T.zones.restTitle)}</h2>
    <p class="note">${esc(T.zones.restNote)}</p>
    ${syndromeLinks(rest)}
  </section>`
    : "";

  const body = `<div class="zone">
  <p class="crumbs"><a href="/oblasti/">${esc(T.zones.allZones)}</a></p>

  <h1>${esc(zone.name)}</h1>
  <p class="lead">${count} ${esc(T.zones.sectionsWord)} справочника.</p>

  ${groupsHtml}
  ${restHtml}
</div>`;

  return page({
    title: m.title,
    description: m.description,
    path: D.zonePath(zone.id),
    body,
    updated,
    bodyClass: "page-zone"
  });
}

/* ---------- /zhaloby/ ---------- */
function zhalobyPage(updated) {
  const sym = D.symptomList();
  const m = meta.zhaloby(sym.label);

  const body = `<div class="zone">
  <p class="crumbs"><a href="/oblasti/">${esc(T.zones.allZones)}</a></p>

  <h1>${esc(sym.label)}</h1>
  <p class="lead">${esc(T.zones.noAnchorLead)}</p>

  <section class="block">
    ${syndromeLinks(sym.syndromes)}
  </section>
</div>`;

  return page({
    title: m.title,
    description: m.description,
    path: "/zhaloby/",
    body,
    updated,
    bodyClass: "page-zone"
  });
}

module.exports = { zonesPage, zonePage, zhalobyPage };
