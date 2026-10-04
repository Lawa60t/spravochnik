"use strict";
/* Вход «на модели» — отдельная страница по своему адресу: её можно открыть
   ссылкой, положить в меню и найти поисковику.

   Первый экран — две фигуры рядом, мужская слева и женская справа;
   нажатие раскрывает выбранную крупно: поверх кадра — ссылки на страницы
   областей оглавления, посчитанные по калибровке из data/anatomy.json
   (src/site/figura.js), рядом переключатель «спереди / сзади» и кнопка
   «Другая фигура». Все переключатели — обычные переключатели формы
   и стили по :checked: без JavaScript работают так же, страница скриптов
   не несёт. Без стилей и картинок остаётся список областей ссылками —
   тот же, что на /oblasti/.

   Пол фигуры — переключатель картинки, как «спереди / сзади», а не ответ:
   его некуда сохранять и незачем передавать. Пол и возраст спросит
   уточнение в разделе, там, где они на что-то влияют. */
const { page, esc, attr } = require("../layout");
const meta = require("../meta");
const T = require("../text");
const D = require("../data");
const A = require("../assets");
const F = require("../figura");
const { zoneItems } = require("./oblasti");

const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k]);

function kadr(k) {
  const Fk = T.fork;
  const img = A.figury[k.frame];
  const alt = fmt(Fk.alt, { sex: Fk.altSex[k.sex], view: Fk.altView[k.view] });
  const spots = F.hotspots(k)
    .map(h => {
      const cx = (h.x0 + h.x1) / 2, cy = (h.y0 + h.y1) / 2;
      const style = `--x:${cx.toFixed(4)};--y:${cy.toFixed(4)};--w:${(h.x1 - h.x0).toFixed(4)};--h:${(h.y1 - h.y0).toFixed(4)}`;
      return `<a class="uchastok" href="${attr(h.href)}" style="${style}"><span>${esc(h.label)}</span></a>`;
    })
    .join("\n        ");
  return `<div class="kadr kadr-${k.sex}-${k.view}">
        <img src="${attr(img.x1.url)}" srcset="${attr(img.x1.url)} ${img.x1.width}w, ${attr(img.x2.url)} ${img.x2.width}w" sizes="(min-width: 480px) 26rem, calc(100vw - 2rem)" width="${img.x1.width}" height="${img.x1.height}" alt="${attr(alt)}" decoding="async" loading="lazy">
        ${spots}
      </div>`;
}

module.exports = function vyborPage(updated) {
  const Fk = T.fork;
  const m = meta.vybor(Fk.title);

  /* Первый экран: две фигуры рядом, каждая — одна большая область выбора.
     Третье состояние переключателя пола, «обе», стоит по умолчанию. */
  const dve = ["m", "f"].map(sex => {
    const k = F.KADRY.find(x => x.sex === sex && x.view === "front");
    const img = A.figury[k.frame];
    const alt = fmt(Fk.alt, { sex: Fk.altSex[sex], view: Fk.altView.front });
    return `<label class="figura-vybor" for="figura-${sex}">
        <img src="${attr(img.x1.url)}" srcset="${attr(img.x1.url)} ${img.x1.width}w, ${attr(img.x2.url)} ${img.x2.width}w" sizes="(min-width: 480px) 14rem, calc(50vw - 1.5rem)" width="${img.x1.width}" height="${img.x1.height}" alt="${attr(alt)}" decoding="async" loading="lazy">
        <span>${esc(Fk.sex[sex])}</span>
      </label>`;
  }).join("\n      ");

  const body = `<div class="vybor">
  <h1>${esc(Fk.title)}</h1>
  <p class="lead">${esc(Fk.lead)}</p>

  <section class="figura">
    <input class="figura-radio" type="radio" name="figura-pol" id="figura-obe" checked>
    <input class="figura-radio" type="radio" name="figura-pol" id="figura-m">
    <input class="figura-radio" type="radio" name="figura-pol" id="figura-f">
    <input class="figura-radio" type="radio" name="figura-vid" id="figura-front" checked>
    <input class="figura-radio" type="radio" name="figura-vid" id="figura-back">
    <div class="figura-dve" role="group" aria-label="${attr(Fk.pick)}">
      ${dve}
      <p class="figura-pick">${esc(Fk.pick)}</p>
    </div>
    <div class="figura-knopki" role="group" aria-label="${attr(Fk.group)}">
      <label class="figura-drugaya" for="figura-obe">${esc(Fk.other)}</label>
      <span><label for="figura-front">${esc(Fk.view.front)}</label><label for="figura-back">${esc(Fk.view.back)}</label></span>
    </div>
    <div class="figura-kadry">
      ${F.KADRY.map(kadr).join("\n      ")}
    </div>
  </section>

  <section class="block">
    <h2>${esc(Fk.listTitle)}</h2>
    <p class="note">${esc(Fk.listNote)}</p>
    <ul class="conditions zonelist">
      ${zoneItems()}
    </ul>
  </section>

  ${/* Указатель здесь третьим путём, а не четвёртым равным: тому, кто знает
       название, развилка не нужна вовсе. */ ""}
  <p class="note"><a href="/ukazatel/">${esc(Fk.byName)}</a></p>
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
