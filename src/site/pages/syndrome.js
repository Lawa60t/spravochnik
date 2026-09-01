"use strict";
/* Страница раздела справочника.
   Здесь показан ВЕСЬ список состояний раздела, а не первые девять:
   усечение (slice 0–4 / 4–9) — свойство выдачи после уточнения, а не оглавления.
   Если статья доступна только как итог опроса, справочник превращается
   в программу, выдающую заключение.

   Порядок без уточнений — по полю base, то есть по тому, насколько часто
   состояние встречается в этом разделе вообще. Это свойство раздела, а не читателя. */
const { page, esc, attr } = require("../layout");
const meta = require("../meta");
const T = require("../text");
const D = require("../data");

const OFTEN_FROM = 5; /* base 5 и выше — «часто», ниже — «реже». */

function itemOf(cand) {
  const c = D.conditionById.get(cand.condition);
  return { cand, c, base: cand.base };
}

function sortItems(a, b) {
  return b.base - a.base || D.collator.compare(a.c.name, b.c.name);
}

function renderItem({ c }) {
  return `<li>
        <a href="${attr(D.conditionPath(c.id))}">${esc(c.name)}</a>
        <span class="icd">${esc(c.icd)}</span>
        <span class="gist">${esc(meta.clamp(meta.firstSentence(c.what), 180))}</span>
      </li>`;
}

function block(title, items, cls, note) {
  if (!items.length) return "";
  return `<section class="block ${attr(cls)}">
    <h2>${esc(title)}</h2>
    ${note ? `<p class="note">${esc(note)}</p>` : ""}
    <ul class="conditions">
      ${items.map(renderItem).join("\n      ")}
    </ul>
  </section>`;
}

module.exports = function syndromePage(s, updated) {
  const items = s.candidates.map(itemOf).filter(i => i.c);
  const rare = items.filter(i => i.c.redflag).sort(sortItems);
  const rest = items.filter(i => !i.c.redflag);
  const often = rest.filter(i => i.base >= OFTEN_FROM).sort(sortItems);
  const seldom = rest.filter(i => i.base < OFTEN_FROM).sort(sortItems);

  const zone = D.zoneById.get(s.zone);
  const m = meta.syndrome(s, items.length);

  const body = `<article class="syndrome">
  <p class="crumbs">${zone ? `<span class="muted">${esc(T.syndrome.zoneLabel)}:</span> ${esc(zone.name)}` : ""}</p>

  <h1>${esc(s.name)}</h1>
  ${s.aka && s.aka.length ? `<p class="alt"><span>${esc(T.syndrome.alsoSaid)}:</span> ${esc(s.aka.join(" · "))}</p>` : ""}

  <p class="lead">${esc(T.syndrome.listTitle)}. ${esc(T.syndrome.listNote)}</p>

  ${block(T.syndrome.blockRare, rare, "rare", T.syndrome.blockRareNote)}
  ${block(T.syndrome.blockOften, often, "often")}
  ${block(T.syndrome.blockSeldom, seldom, "seldom")}

  <section class="notsearched">
    <h2>${esc(T.syndrome.notSearchedTitle)}</h2>
    <p class="note">${esc(T.syndrome.notSearchedNote)}</p>
    <ul>
      ${s.notSearchedHere.map(x => `<li>${esc(x)}</li>`).join("\n      ")}
    </ul>
  </section>

  <p class="nomatch"><a href="/moego-sluchaya-net/">${esc(T.syndrome.noMatch)}</a></p>
</article>`;

  return page({
    title: m.title,
    description: m.description,
    path: D.syndromePath(s.id),
    body,
    updated,
    bodyClass: "page-syndrome"
  });
};
