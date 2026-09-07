"use strict";
/* Вход «на модели» — отдельная страница по своему адресу: её можно открыть
   ссылкой, положить в меню и найти поисковику.

   Модели тела пока нет. Мёртвой кнопки на странице нет тоже: вместо неё
   фигура-заглушка и прямое слово о том, чего ждать, а рядом — тот же вход
   в оглавление словами. Пол и возраст здесь не спрашиваются: их спросит
   уточнение в разделе, там, где они на что-то влияют. */
const { page, esc, figureSvg, zoneChips } = require("../layout");
const meta = require("../meta");
const T = require("../text");
const D = require("../data");

module.exports = function vyborPage(updated) {
  const F = T.fork;
  const m = meta.vybor(F.title);

  const body = `<div class="vybor">
  <h1>${esc(F.title)}</h1>
  <p class="lead">${esc(F.lead)}</p>

  <section class="fork">
    <div class="fork-half fork-off">
      <span class="fork-fig">${figureSvg(88, 128)}</span>
      <p class="fork-soon">${esc(F.bodySoon)}</p>
    </div>
    <a class="fork-half fork-on" href="/oblasti/">
      <h2>${esc(F.listTitle)}</h2>
      <p class="fork-note">${esc(F.listNote)}</p>
      ${zoneChips(D.map.zones)}
    </a>
  </section>

  ${/* Указатель здесь третьим путём, а не четвёртым равным: тому, кто знает
       название, развилка не нужна вовсе. */ ""}
  <p class="note"><a href="/ukazatel/">${esc(F.byName)}</a></p>
</div>`;

  return page({
    title: m.title,
    description: m.description,
    path: "/vybor/",
    body,
    updated,
    bodyClass: "page-vybor"
  });
};
