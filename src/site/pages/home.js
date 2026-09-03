"use strict";
/* Главная: вход с предупреждением и экран пола и возраста. Развилка живёт
   отдельной страницей /vybor/ — порядок такой, каким он и задуман:
   вход → пол и возраст → развилка. Без JavaScript кнопка входа ведёт на неё
   прямо, минуя вопрос, который без скрипта всё равно негде задать.

   Предупреждение показано обычным блоком, а не модальным окном:
   модалка с запоминанием флажка — это уже JavaScript, второй уровень доступа.
   Кнопка «Понятно» здесь честная ссылка, а не имитация согласия:
   формула «беру риски на себя» не используется нигде (docs/teksty-ekranov.md). */
const { page, esc } = require("../layout");
const meta = require("../meta");
const T = require("../text");
const D = require("../data");
const A = require("../assets");

/* Экран пола и возраста. В разметке он есть всегда, но скрыт атрибутом hidden:
   без JavaScript кнопка входного экрана остаётся обычной ссылкой на развилку,
   и ни одного вопроса человеку не задаётся. */
function profilScreen() {
  const P = T.profil;
  return `<section class="profil" data-profil hidden>
    <h2>${esc(P.sexTitle)}</h2>
    <div class="choices row">
      <button type="button" data-sex="m" aria-pressed="false">${esc(P.male)}</button>
      <button type="button" data-sex="f" aria-pressed="false">${esc(P.female)}</button>
    </div>

    <h2>${esc(P.ageTitle)}</h2>
    <label class="poisk-label" for="profil-age">${esc(P.ageHint)}</label>
    <input class="poisk-input age" type="number" id="profil-age" min="0" max="120" step="1" inputmode="numeric" data-age>
    <p class="checkline">
      <label><input type="checkbox" data-age-unknown> ${esc(P.ageUnknown)}</label>
    </p>

    <p class="note" data-slot="hint" hidden>${esc(P.needSex)}</p>
    <p class="cta"><button type="button" class="button" data-act="profil-save" data-next="/vybor/">${esc(P.next)}</button></p>
    <p class="note">${esc(P.why)}</p>
    <p class="note">${esc(P.note)}</p>
  </section>`;
}

module.exports = function homePage(updated) {
  const m = meta.home();

  const body = `<div class="home">
  <section class="entry" data-entry>
    <h1>${esc(T.entry.title)}</h1>
    ${T.entry.blocks
      .map(b =>
        b.list
          ? `<ul class="dashed">\n      ${b.list.map(x => `<li>${esc(x)}</li>`).join("\n      ")}\n    </ul>`
          : `<p>${esc(b.p)}</p>`
      )
      .join("\n    ")}
    ${/* Одной строкой и мелко: это справка об объёме, а не витрина. */ ""}
    <p class="counts">${D.conditions.length} статей · ${D.syndromes.length} разделов · ${D.map.zones.length} областей тела</p>
    <p class="note"><a href="/chto-ne-razbiraem/">${esc(T.navNotSearched)}</a></p>

    ${/* Кнопка закреплена у нижнего края экрана: текст длинный, и человек,
         не догадавшийся прокрутить, решил бы, что на сайте ничего нет.
         Текст прокручивается под полосой, поэтому у неё свой фон. */ ""}
    <div class="entry-cta">
      <a class="button" href="/vybor/" data-act="profil-open">${esc(T.entry.button)}</a>
      <p class="note">${esc(T.entry.note)}</p>
    </div>
  </section>

  ${profilScreen()}

</div>`;

  return page({
    title: m.title,
    description: m.description,
    path: "/",
    body,
    updated,
    bodyClass: "page-home",
    scripts: [A.profil.url]
  });
};
