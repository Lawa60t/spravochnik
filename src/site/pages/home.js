"use strict";
/* Главная: первый экран с двумя входами в оглавление.

   Экрана пола и возраста здесь больше нет. Эти два ответа спрашивает
   уточнение в самом разделе — там, где они на что-то влияют, — и только у того,
   кто уточнением пользуется. Читателю, открывшему статью или раздел напрямую,
   не задаётся ни одного вопроса: вход не шлагбаум.

   Полный текст предупреждения тоже переехал — на страницу «О справочнике»
   и в подвал. Здесь остаётся одна спокойная строка под карточками:
   энциклопедия не просит расписаться за вход (docs/teksty-ekranov.md).
   Страница целиком обычные ссылки, без JavaScript открывается полностью.
   В карточке «На модели» — две фигуры рядом, кадры высотой 320 px:
   те же, что на /vybor/, только маленькие. */
const { page, esc, attr, listSvg } = require("../layout");
const A = require("../assets");
const meta = require("../meta");
const cfg = require("../config");
const T = require("../text");
const D = require("../data");

module.exports = function homePage(updated) {
  const m = meta.home();
  const H = T.hello;

  const body = `<div class="home">
  <section class="hello">
    <h1>${esc(cfg.siteName)} <span class="tagline">— ${esc(cfg.tagline)}</span></h1>
    <p class="lead">${esc(H.lead1)}</p>
    <p class="lead">${esc(H.lead2)}</p>

    <div class="cards">
      <a class="card" href="/vybor/">
        <span class="icon icon-figury" aria-hidden="true">${["figura-m-speredi", "figura-zh-speredi"].map(n => {
          const k = A.figury[n];
          return `<img src="${attr(k.x320.url)}" srcset="${attr(k.x320.url)} ${k.x320.width}w, ${attr(k.x1.url)} ${k.x1.width}w" sizes="2.4rem" width="${k.x320.width}" height="${k.x320.height}" alt="" decoding="async">`;
        }).join("")}</span>
        <span><span class="ct">${esc(H.modelTitle)}</span>
          <span class="cs">${esc(H.modelSub)}</span></span>
      </a>
      <a class="card" href="/oblasti/">
        <span class="icon">${listSvg(40, 58)}</span>
        <span><span class="ct">${esc(H.listTitle)}</span>
          <span class="cs">${esc(H.listSub)}</span></span>
      </a>
    </div>

    ${/* Одной строкой и мелко: это справка об объёме, а не витрина. */ ""}
    <p class="counts">${D.conditions.length} статей · ${D.syndromes.length} разделов · ${D.map.zones.length} областей тела</p>
    <p class="hello-note">${esc(H.note)}</p>
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
