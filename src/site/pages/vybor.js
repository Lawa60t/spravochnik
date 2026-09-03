"use strict";
/* Развилка — отдельная страница.

   Раньше она лежала на главной третьим экраном и показывалась скриптом после
   ответа о поле и возрасте. Из-за этого её нельзя было ни открыть ссылкой,
   ни положить в меню, ни найти поисковику: без JavaScript её на главной
   не существовало вовсе.

   Теперь порядок такой: вход с предупреждением → пол и возраст → развилка.
   Первые два шага живут на главной, третий — здесь, по своему адресу.
   Без JavaScript кнопка входа ведёт прямо сюда, и человек ничего не теряет:
   пол и возраст спрашиваются только там, где они на что-то влияют.

   Левая половина неактивна намеренно: модели тела пока нет, и вместо мёртвой
   кнопки там сказано, чего ждать. */
const { page, esc } = require("../layout");
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
      <h2>${esc(F.bodyTitle)}</h2>
      <p class="fork-soon">${esc(F.bodySoon)}</p>
    </div>
    <a class="fork-half fork-on" href="/oblasti/">
      <h2>${esc(F.listTitle)}</h2>
      <ul class="fork-list" aria-hidden="true">
        ${D.map.zones.map(z => `<li>${esc(z.name)}</li>`).join("\n        ")}
      </ul>
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
