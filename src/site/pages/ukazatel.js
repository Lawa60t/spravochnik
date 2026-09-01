"use strict";
/* Алфавитный указатель — основа, а не «версия для слабых устройств».
   Это же поиск первого уровня: без JavaScript человек находит статью здесь.
   Синонимы (alt у статей) стоят отдельными строками с отсылкой — как в книге. */
const { page, esc, attr } = require("../layout");
const meta = require("../meta");
const T = require("../text");
const D = require("../data");

function letterOf(s) {
  const ch = String(s).trim().charAt(0).toUpperCase();
  return /[А-ЯЁA-Z]/.test(ch) ? ch : "#";
}

function groupByLetter(entries) {
  const groups = new Map();
  entries.forEach(e => {
    const l = letterOf(e.sortKey);
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l).push(e);
  });
  return [...groups.entries()]
    .sort((a, b) => D.collator.compare(a[0], b[0]))
    .map(([letter, list]) => [letter, list.sort((x, y) => D.collator.compare(x.sortKey, y.sortKey))]);
}

function renderGroups(groups) {
  return groups
    .map(
      ([letter, list]) => `<section class="letter">
      <h3>${esc(letter)}</h3>
      <ul class="index">
        ${list.map(e => e.html).join("\n        ")}
      </ul>
    </section>`
    )
    .join("\n    ");
}

module.exports = function ukazatelPage(updated) {
  /* статьи + синонимы */
  const condEntries = [];
  D.conditions.forEach(c => {
    condEntries.push({
      sortKey: c.name,
      html: `<li><a href="${attr(D.conditionPath(c.id))}">${esc(c.name)}</a></li>`
    });
    (c.alt || []).forEach(alt => {
      condEntries.push({
        sortKey: alt,
        html: `<li class="ref">${esc(alt)} — ${esc(T.index.seeAlso)} <a href="${attr(D.conditionPath(c.id))}">${esc(c.name)}</a></li>`
      });
    });
  });

  /* разделы: у всех 110 заполнено aka — как это называет человек */
  const synEntries = D.syndromes.map(s => ({
    sortKey: s.name,
    html: `<li><a href="${attr(D.syndromePath(s.id))}">${esc(s.name)}</a>${
      s.aka && s.aka.length ? `<span class="aka">${esc(s.aka.join(" · "))}</span>` : ""
    }</li>`
  }));

  const m = meta.ukazatel(D.conditions.length, D.syndromes.length);

  const body = `<div class="ukazatel">
  <h1>${esc(T.index.title)}</h1>
  <p class="lead">${esc(T.index.lead)}</p>

  <h2>${esc(T.index.conditionsTitle)}</h2>
  <div class="cols">
    ${renderGroups(groupByLetter(condEntries))}
  </div>

  <h2>${esc(T.index.syndromesTitle)}</h2>
  <div class="cols">
    ${renderGroups(groupByLetter(synEntries))}
  </div>
</div>`;

  return page({
    title: m.title,
    description: m.description,
    path: "/ukazatel/",
    body,
    updated,
    bodyClass: "page-ukazatel"
  });
};
