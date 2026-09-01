"use strict";
/* Две страницы слоя безопасности. Тексты целиком из data/redflags.json —
   не пересказывать и не сокращать: это независимый слой, а не оформление. */
const { page, esc } = require("../layout");
const meta = require("../meta");
const T = require("../text");
const D = require("../data");

function notSearchedHerePage(updated) {
  const n = D.redflags.notSearchedHere;
  const m = meta.notSearchedHere(n.title);

  const body = `<article class="plain alarmish">
  <h1>${esc(n.title)}</h1>
  <p class="lead">${esc(n.intro)}</p>
  <ul class="big">
    ${n.items.map(x => `<li>${esc(x)}</li>`).join("\n    ")}
  </ul>
  <p class="tel">${esc(T.pages.emergency)}</p>
</article>`;

  return page({
    title: m.title,
    description: m.description,
    path: "/chto-ne-razbiraem/",
    body,
    updated,
    bodyClass: "page-plain"
  });
}

function noMatchPage(updated) {
  const n = D.redflags.noMatch;
  const m = meta.noMatch(n.title);

  const body = `<article class="plain">
  <h1>${esc(n.title)}</h1>
  ${n.body.map(p => `<p>${esc(p)}</p>`).join("\n  ")}
  <p><a href="/ukazatel/">${esc(T.pages.openIndex)}</a></p>
</article>`;

  return page({
    title: m.title,
    description: m.description,
    path: "/moego-sluchaya-net/",
    body,
    updated,
    bodyClass: "page-plain"
  });
}

module.exports = { notSearchedHerePage, noMatchPage };
