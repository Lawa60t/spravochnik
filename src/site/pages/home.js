"use strict";
/* Главная. Предупреждение показано обычным блоком, а не модальным окном:
   модалка с запоминанием флажка — это уже JavaScript, второй уровень доступа.
   Кнопка «Понятно» здесь честная ссылка, а не имитация согласия:
   формула «беру риски на себя» не используется нигде (docs/teksty-ekranov.md). */
const { page, esc } = require("../layout");
const meta = require("../meta");
const T = require("../text");
const D = require("../data");

module.exports = function homePage(updated) {
  const m = meta.home();

  const body = `<div class="home">
  <section class="entry">
    <h1>${esc(T.entry.title)}</h1>
    ${T.entry.body.map(p => `<p>${esc(p)}</p>`).join("\n    ")}
    <p class="cta"><a class="button" href="/oblasti/">${esc(T.entry.button)}</a></p>
    <p class="note">${esc(T.entry.note)} <a href="/ukazatel/">${esc(T.index.title)}</a> — если знаете название.</p>
    <p class="note"><a href="/chto-ne-razbiraem/">${esc(T.navNotSearched)}</a></p>
  </section>

  <section class="about">
    <p class="lead">${esc(T.pages.homeLead)}</p>
    <ul class="counts">
      <li><b>${D.conditions.length}</b> статей о состояниях</li>
      <li><b>${D.syndromes.length}</b> разделов справочника</li>
      <li><b>${D.map.zones.length}</b> областей тела</li>
    </ul>
  </section>

  <section class="doesnot">
    <h2>${esc(T.doesNot.title)}</h2>
    <ul>
      ${T.doesNot.items.map(x => `<li>${esc(x)}</li>`).join("\n      ")}
    </ul>
  </section>
</div>`;

  return page({
    title: m.title,
    description: m.description,
    path: "/",
    body,
    updated,
    bodyClass: "page-home"
  });
};
