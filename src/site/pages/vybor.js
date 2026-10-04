"use strict";
/* Вход «на модели» — отдельная страница по своему адресу: её можно открыть
   ссылкой, положить в меню и найти поисковику.

   Первый экран — две фигуры рядом, мужская слева и женская справа;
   нажатие раскрывает выбранную крупно: поверх кадра — зоны слоя якорей
   по контурам из data/anatomy.json (сплайн в src/site/figura.js),
   рядом переключатель «спереди / сзади» и кнопка «Другая фигура».
   Зона открывается в два нажатия: первое — «прожектор»: кадр гаснет,
   выбранная зона остаётся живой и обведена, появляется кнопка «Далее — …»;
   второе ведёт на страницу области.
   Все переключатели — обычные переключатели формы и стили по :checked:
   без JavaScript работают так же, страница скриптов не несёт. Без стилей и картинок остаётся список областей ссылками —
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

/* Зоны одного кадра: одна на id зоны слоя якорей; отражённые копии рук
   и ног — те же зоны, у них общий переключатель. */
function zonesOf(k) {
  const seen = new Map();
  F.contoursOf(k).forEach(c => { if (!seen.has(c.id)) seen.set(c.id, c); });
  return [...seen.values()].map(c => ({ ...c, radio: `z-${c.key}` }));
}

/* Скрытые переключатели зон. Стоят рядом с переключателями пола и вида,
   раньше кадров, чтобы работали селекторы :checked ~; имя одно на все
   кадры — выбрана может быть одна зона. */
function zoneRadios(k) {
  return zonesOf(k)
    .map(z => `<input class="figura-radio figura-zona" type="radio" name="figura-zona" id="${attr(z.radio)}" aria-label="${attr(z.label)}">`)
    .join("\n    ");
}

/* Одна зона на кадре — обёртка на весь кадр, внутри:
   svg — путь контура в defs, один раз, как clipPath в долях бокса;
   label — область нажатия, обрезанная этим контуром;
   .sloy-obv > .sloy — тот же кадр, обрезанный тем же контуром: «прожектор»,
   виден у выбранной зоны; обводка — тень вокруг обрезанного слоя
   (drop-shadow на обёртке), поэтому линия идёт по краю видимой зоны:
   по коже там, где зона выходит на контур тела, и по линии разреза
   там, где контур режет тело, — как на эталоне;
   .podpis — название у центроида. Что показано, решают стили
   по переключателю зоны и по наведению. */
function zona(c, n) {
  const pid = `p-${c.key}${c.mirrored ? "-2" : ""}`;
  return `<div class="zona" data-z="${attr(c.key)}" style="--cx:${c.cx};--cy:${c.cy}">
          <svg aria-hidden="true" focusable="false"><defs><clipPath id="k-${pid}" clipPathUnits="objectBoundingBox"><path d="${c.path}"/></clipPath></defs></svg>
          <label class="uchastok" for="z-${attr(c.key)}" style="clip-path:url(#k-${pid})"></label>
          <div class="sloy-obv"><div class="sloy" style="clip-path:url(#k-${pid})"></div></div>
          <span class="podpis">${esc(c.label)}</span>
        </div>`;
}

function kadr(k) {
  const Fk = T.fork;
  const img = A.figury[k.frame];
  const alt = fmt(Fk.alt, { sex: Fk.altSex[k.sex], view: Fk.altView[k.view] });
  /* --kadr — адрес кадра 800 px: им рисуется слой выбранной зоны. */
  return `<div class="kadr kadr-${k.sex}-${k.view}" style="--kadr:url(${attr(img.x1.url)})">
        <img src="${attr(img.x1.url)}" srcset="${attr(img.x1.url)} ${img.x1.width}w, ${attr(img.x2.url)} ${img.x2.width}w" sizes="(min-width: 480px) 26rem, calc(100vw - 2rem)" width="${img.x1.width}" height="${img.x1.height}" alt="${attr(alt)}" decoding="async" loading="lazy">
        ${F.contoursOf(k).map(zona).join("\n        ")}
      </div>`;
}

/* Кнопки «Далее — …»: по одной на зону каждого кадра, видна только кнопка
   выбранной зоны и только пока показан её кадр (стили). Пока зона
   не выбрана — подсказка. */
function dalee() {
  const Fk = T.fork;
  const links = F.KADRY.flatMap(k =>
    zonesOf(k).map(z => `<a class="figura-knopka" data-z="${attr(z.key)}" href="${attr(z.href)}">${esc(fmt(Fk.next, { zone: z.label }))}</a>`)
  );
  return `<div class="figura-dalee">
      <p class="figura-podskazka">${esc(Fk.touch)}</p>
      ${links.join("\n      ")}
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
    ${F.KADRY.map(zoneRadios).join("\n    ")}
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
    ${dalee()}
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
