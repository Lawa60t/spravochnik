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

/* Короткое описание — первое предложение и не длиннее 90 символов.
   Иначе список получается рваный: у одной статьи шесть слов, у соседней сорок. */
const GIST = 90;

function renderItem({ c }) {
  return `<li${c.sexOnly ? ` data-sex-only="${attr(c.sexOnly)}"` : ""}>
        <a href="${attr(D.conditionPath(c.id))}">${esc(c.name)}</a>
        <span class="icd">${esc(c.icd)}</span>
        <span class="gist">${esc(meta.clamp(meta.firstSentence(c.what), GIST))}</span>
      </li>`;
}

function list(items) {
  return `<ul class="conditions">
      ${items.map(renderItem).join("\n      ")}
    </ul>`;
}

function block(title, items, cls) {
  if (!items.length) return "";
  return `<section class="block ${attr(cls)}" data-group>
    <h2>${esc(title)}</h2>
    ${list(items)}
  </section>`;
}

/* Блок «редко, но важно» стоит последним и свёрнутым.
   В present() он первый — но там человек уже ответил на вопросы, и блок отвечает ему.
   Здесь ответов нет, пугать не за что: шесть смертельных состояний до первого частого
   превращают оглавление в предупреждение. */
function rareBlock(title, items, note) {
  if (!items.length) return "";
  return `<details class="block rare" data-group>
    <summary><span class="sum">${esc(title)}</span> <span class="count">${items.length}</span></summary>
    <p class="note">${esc(note)}</p>
    ${list(items)}
  </details>`;
}

/* Остров уточнения. Весь текст лежит в разметке, а не в скрипте: так он
   остаётся под линтом формулировок и переводится вместе с остальным сайтом.
   Блок скрыт атрибутом hidden — без JavaScript он не появляется вовсе,
   и мёртвой кнопки, которая никуда не ведёт, на странице не возникает. */
function refineBlock(s) {
  const R = T.refine;
  const MAX = 10;

  return `<section class="refine" data-refine
    data-syndrome="${attr(s.id)}"
    data-payload="/dannye/${attr(D.slug(s.id))}.js"
    data-max="${MAX}"
    data-step-tpl="${attr(R.stepOf)}"
    data-sex-line="${attr(R.sexLine)}"
    data-age-line="${attr(R.ageLine)}" hidden>

  <div data-step="start">
    <p><button type="button" class="button" data-act="start">${esc(R.start)}</button></p>
    <p class="note">${esc(R.startNote)}</p>
  </div>

  <div data-step="sex" hidden>
    <h2>${esc(R.sexTitle)}</h2>
    <div class="choices">
      <button type="button" data-sex="m">${esc(R.male)}</button>
      <button type="button" data-sex="f">${esc(R.female)}</button>
    </div>
  </div>

  <div data-step="age" hidden>
    <h2>${esc(R.ageTitle)}</h2>
    <label class="poisk-label" for="refine-age">${esc(R.ageHint)}</label>
    <input class="poisk-input age" type="number" id="refine-age" min="0" max="120" step="1" inputmode="numeric">
    <p>
      <button type="button" class="button" data-act="age">${esc(R.next)}</button>
      <button type="button" data-act="age-skip">${esc(R.ageSkip)}</button>
    </p>
  </div>

  <div data-step="q" hidden>
    <p class="note" data-slot="count"></p>
    <h2 data-slot="qtext"></h2>
    <p class="note" data-slot="qhint" hidden></p>
    <div class="choices" data-slot="options"></div>
    <p class="nomatch"><a href="/moego-sluchaya-net/">${esc(T.syndrome.noMatch)}</a></p>
  </div>

  <div data-step="result" hidden>
    <h2>${esc(R.resultTitle)}</h2>
    <p class="note">${esc(R.resultNote)}</p>
    <div data-slot="blocks"></div>

    <section class="tell">
      <h3>${esc(R.tellTitle)}</h3>
      <p class="note">${esc(R.tellNote)}</p>
      <pre data-slot="tell"></pre>
      <p>
        <button type="button" data-act="copy" data-copied="${attr(R.copied)}" data-selected="${attr(R.selected)}">${esc(R.copy)}</button>
        <button type="button" data-act="restart">${esc(R.restart)}</button>
      </p>
    </section>
  </div>

  <div class="alarm" data-slot="alarm" hidden>
    <h2>${esc(R.alarmTitle)}</h2>
    <ul data-slot="alarmlist"></ul>
    <p class="phone">${esc(R.alarmPhone)}</p>
    <p>${esc(R.alarmNote)}</p>
    <p class="note">${esc(R.alarmStill)}</p>
  </div>
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
  <p class="crumbs">${
    zone
      ? `<span class="muted">${esc(T.syndrome.zoneLabel)}:</span> <a href="${attr(D.zonePath(zone.id))}">${esc(zone.name)}</a>`
      : ""
  }</p>

  <h1>${esc(s.name)}</h1>
  ${s.aka && s.aka.length ? `<p class="alt"><span>${esc(T.syndrome.alsoSaid)}:</span> ${esc(s.aka.join(" · "))}</p>` : ""}

  <p class="lead">${esc(T.syndrome.listTitle)}. ${esc(T.syndrome.listNote)}</p>

  ${
    /* Когда «часто» выродилось в ноль или одну строку, оба списка сливаются
       в один без заголовка: заголовок над единственной строкой читается как
       поломка вёрстки, а назвать слитый список «часто» было бы неправдой —
       в нём и редкие. Так на 24 разделах из 110. */
    often.length <= 1
      ? `<section class="block" data-group>${list(often.concat(seldom))}</section>`
      : block(T.syndrome.blockOften, often, "often") + "\n  " + block(T.syndrome.blockSeldom, seldom, "seldom")
  }
  ${rareBlock(T.syndrome.blockRare, rare, T.syndrome.blockRareNote)}

  <section class="notsearched">
    <h2>${esc(T.syndrome.notSearchedTitle)}</h2>
    <p class="note">${esc(T.syndrome.notSearchedNote)}</p>
    <ul>
      ${s.notSearchedHere.map(x => `<li>${esc(x)}</li>`).join("\n      ")}
    </ul>
  </section>

  <p class="nomatch"><a href="/moego-sluchaya-net/">${esc(T.syndrome.noMatch)}</a></p>
</article>

${refineBlock(s)}`;

  return page({
    title: m.title,
    description: m.description,
    path: D.syndromePath(s.id),
    body,
    updated,
    bodyClass: "page-syndrome",
    scripts: ["/profil.js", "/utochnenie.js"]
  });
};
