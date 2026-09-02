"use strict";
/* Главная. Предупреждение показано обычным блоком, а не модальным окном:
   модалка с запоминанием флажка — это уже JavaScript, второй уровень доступа.
   Кнопка «Понятно» здесь честная ссылка, а не имитация согласия:
   формула «беру риски на себя» не используется нигде (docs/teksty-ekranov.md). */
const { page, esc } = require("../layout");
const meta = require("../meta");
const T = require("../text");
const D = require("../data");

/* Экран пола и возраста. В разметке он есть всегда, но скрыт атрибутом hidden:
   без JavaScript кнопка входного экрана остаётся обычной ссылкой на список
   областей, и ни одного вопроса человеку не задаётся. */
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
    <p class="cta"><button type="button" class="button" data-act="profil-save" data-next="/oblasti/">${esc(P.next)}</button></p>
    <p class="note">${esc(P.why)}</p>
    <p class="note">${esc(P.note)}</p>
  </section>`;
}

/* Развилка. Показывается после ответа о поле и возрасте, поэтому в разметке
   скрыта. Левая половина неактивна намеренно: модели пока нет, и вместо
   мёртвой кнопки там сказано, чего ждать. */
function forkScreen() {
  const F = T.fork;
  return `<section class="fork" data-fork hidden>
    <div class="fork-half fork-off">
      <h2>${esc(F.bodyTitle)}</h2>
      <p class="fork-soon">${esc(F.bodySoon)}</p>
    </div>
    <a class="fork-half fork-on" href="/oblasti/">
      <h2>${esc(F.listTitle)}</h2>
      <ul class="fork-list" aria-hidden="true">
        ${D.map.zones.map(z => `<li>${esc(z.name)}</li>`).join("\n        ")}
      </ul>
    </a>
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
    <ul class="counts">
      <li><b>${D.conditions.length}</b> статей о состояниях</li>
      <li><b>${D.syndromes.length}</b> разделов справочника</li>
      <li><b>${D.map.zones.length}</b> областей тела</li>
    </ul>
    <p class="note"><a href="/chto-ne-razbiraem/">${esc(T.navNotSearched)}</a></p>

    ${/* Кнопка закреплена у нижнего края экрана: текст длинный, и человек,
         не догадавшийся прокрутить, решил бы, что на сайте ничего нет.
         Текст прокручивается под полосой, поэтому у неё свой фон. */ ""}
    <div class="entry-cta">
      <a class="button" href="/oblasti/" data-act="profil-open">${esc(T.entry.button)}</a>
      <p class="note">${esc(T.entry.note)}</p>
    </div>
  </section>

  ${profilScreen()}

  ${forkScreen()}

</div>`;

  return page({
    title: m.title,
    description: m.description,
    path: "/",
    body,
    updated,
    bodyClass: "page-home",
    script: "/profil.js"
  });
};
