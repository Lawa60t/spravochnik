"use strict";
/* Служебные страницы: о справочнике, как составлены материалы, соглашение,
   поддержка. Текст целиком лежит в src/site/text.js — там его проверяет линт
   формулировок. Здесь только сборка блоков в разметку.

   Никаких встроенных форм, виджетов и чужих скриптов: единственная внешняя
   ссылка на весь сайт — адрес перехода на странице поддержки, и она обычная. */
const { page, esc, attr } = require("../layout");
const meta = require("../meta");
const cfg = require("../config");
const T = require("../text");
const D = require("../data");

/* Сколько статей работает больше чем в одном разделе — считаем по базе,
   а не пишем числом в тексте: иначе однажды разойдётся с ней. */
const multiUse = () => {
  let n = 0;
  D.syndromesOfCondition.forEach(list => { if (list.length > 1) n++; });
  return n;
};

function mailLink() {
  return `<a href="mailto:${attr(cfg.errorMail)}">${esc(cfg.errorMail)}</a>`;
}

/* Внешняя ссылка: новая вкладка, rel="noopener noreferrer" и значок,
   как требует правило проекта о внешних ссылках. */
function outLink(href, text) {
  return `<a href="${attr(href)}" target="_blank" rel="noopener noreferrer">${esc(text)}<span class="ext" aria-hidden="true"> ↗</span><span class="vh"> (откроется в новой вкладке)</span></a>`;
}

/* Абзац собирается так: сначала экранируем весь текст, и только потом
   подставляем ссылки. Иначе разметка ссылки уехала бы в экранирование. */
function paragraph(block) {
  let html = esc(block.p)
    .replace(/\{mail\}/g, mailLink())
    .replace(/\{owner\}/g, esc(cfg.owner.name))
    .replace(/\{conditions\}/g, String(D.conditions.length))
    .replace(/\{multi\}/g, String(multiUse()));

  (block.links || []).forEach((link, i) => {
    const markup = link.external
      ? outLink(link.href, link.text)
      : `<a href="${attr(link.href)}">${esc(link.text)}</a>`;
    html = html.replace(new RegExp("\\{" + (i + 1) + "\\}", "g"), markup);
  });

  return `<p>${html}</p>`;
}

function renderBlocks(blocks) {
  return blocks
    .map(b => {
      if (b.h) return `<h2>${esc(b.h)}</h2>`;
      if (b.list) {
        return `<ul class="dashed">\n    ${b.list.map(x => `<li>${esc(x)}</li>`).join("\n    ")}\n  </ul>`;
      }
      return paragraph(b);
    })
    .join("\n  ");
}

function servicePage(key, path, updated, metaFn) {
  const src = T[key];
  const m = metaFn(src.title);

  const body = `<article class="plain service">
  <h1>${esc(src.title)}</h1>
  ${renderBlocks(src.blocks)}
</article>`;

  return page({
    title: m.title,
    description: m.description,
    path,
    body,
    updated,
    bodyClass: "page-plain"
  });
}

module.exports = {
  aboutPage: updated => servicePage("about", "/o-spravochnike/", updated, meta.about),
  howMadePage: updated => servicePage("howMade", "/kak-sostavleny/", updated, meta.howMade),
  termsPage: updated => servicePage("terms", "/soglashenie/", updated, meta.terms),
  supportPage: updated => servicePage("support", "/podderzhat/", updated, meta.support)
};
