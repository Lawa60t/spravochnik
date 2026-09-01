"use strict";
/* Страница статьи о состоянии. Постоянный адрес, открывается напрямую,
   без прохождения выбора области и без уточнений. */
const { page, esc, attr, dateRu } = require("../layout");
const meta = require("../meta");
const cfg = require("../config");
const T = require("../text");
const D = require("../data");

const row = (dt, dd, cls) =>
  `<div${cls ? ` class="${attr(cls)}"` : ""}><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`;

function limits(c) {
  const out = [];
  if (c.sexOnly === "m") out.push(T.condition.onlyMale);
  if (c.sexOnly === "f") out.push(T.condition.onlyFemale);
  if (c.ageMin !== undefined) out.push(T.condition.ageFrom(c.ageMin));
  if (c.ageMax !== undefined) out.push(T.condition.ageTo(c.ageMax));
  return out;
}

function sources(c) {
  return c.sources
    .map(s => {
      const label = [s.title, s.year].filter(Boolean).join(", ");
      /* Ссылка внешняя и только на источник — единственный допустимый вид внешних ссылок.
         Сейчас в базе url нет, поэтому чаще всего это просто текст, и это нормально:
         ссылки протухают, название рекомендаций остаётся проверяемым. */
      return s.url
        ? `<li><a href="${attr(s.url)}" target="_blank" rel="noopener noreferrer">${esc(label)}<span class="ext" aria-hidden="true"> ↗</span><span class="vh"> (откроется в новой вкладке)</span></a></li>`
        : `<li>${esc(label)}</li>`;
    })
    .join("\n      ");
}

function inSections(c) {
  const list = (D.syndromesOfCondition.get(c.id) || []).slice().sort(D.byName);
  if (!list.length) return "";
  return `<section class="insections">
    <h2>${esc(T.condition.inSections)}</h2>
    <p class="note">${esc(T.condition.inSectionsNote)}</p>
    <ul class="links">
      ${list
        .map(s => `<li><a href="${attr(D.syndromePath(s.id))}">${esc(s.name)}</a></li>`)
        .join("\n      ")}
    </ul>
  </section>`;
}

module.exports = function conditionPage(c, updated) {
  const m = meta.condition(c);
  const lim = limits(c);
  const mailSubject = `Ошибка в справочнике: ${D.conditionPath(c.id)}`;

  const body = `<article class="condition">
  <p class="plaque">${esc(T.plaque)}</p>

  <h1>${esc(c.name)}</h1>
  <p class="icd">${esc(c.icd)}</p>
  ${c.alt && c.alt.length ? `<p class="alt"><span>${esc(T.condition.alsoCalled)}:</span> ${esc(c.alt.join(", "))}</p>` : ""}
  ${lim.length ? `<p class="limits">${lim.map(esc).join(" ")}</p>` : ""}

  <dl class="fields">
    ${row(T.condition.what, c.what)}
    ${row(T.condition.who, c.who)}
    ${row(T.condition.urgent, c.urgent, "urgent")}
    ${row(T.condition.doctor, c.doctor)}
    ${row(T.condition.tests, c.tests)}
  </dl>

  ${inSections(c)}

  <section class="origin">
    <h2>${esc(T.condition.sources)}</h2>
    <ul class="sources">
      ${sources(c)}
    </ul>
    <dl class="fields small">
      <div><dt>${esc(T.condition.updated)}</dt><dd>${esc(dateRu(c.updated))}</dd></div>
      <div><dt>${esc(T.condition.statusTitle)}</dt><dd>${esc(T.condition.statusCompiled)}</dd></div>
    </dl>
    <p class="report">
      <a href="mailto:${attr(cfg.errorMail)}?subject=${encodeURIComponent(mailSubject)}">${esc(T.condition.reportError)}</a>
      <span class="note">${esc(T.condition.reportErrorNote)}</span>
    </p>
  </section>
</article>`;

  return page({
    title: m.title,
    description: m.description,
    path: D.conditionPath(c.id),
    body,
    updated,
    bodyClass: "page-condition"
  });
};
