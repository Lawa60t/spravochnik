"use strict";
/* Шаблоны title и description для всех страниц.
   Один плохой шаблон — это 307 нарушений сразу, и именно он виден в поисковой выдаче,
   где нет ни плашки, ни подвала, ни контекста. Поэтому линт формулировок
   проверяет собранные title и description в первую очередь.

   Назначение объявляется прямо в title: «справочник» стоит в каждом заголовке. */
const cfg = require("./config");

const SITE = cfg.siteName;

/* Первое предложение — для description. Сокращения «т. д.» точкой не считаем. */
function firstSentence(s) {
  const m = String(s).match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : String(s)).trim();
}

/* Обрезка по границе слова. Поисковики режут примерно на этой длине. */
function clamp(s, max = 160) {
  const t = String(s).replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:—-]+$/, "") + "…";
}

const withSite = t => `${t} · ${SITE}`;

module.exports = {
  firstSentence,
  clamp,

  home: () => ({
    title: `${SITE} — энциклопедия состояний`,
    description: clamp(
      "Справочник состояний тела: что это, у кого встречается чаще, когда бывает неотложным, к какому врачу идти. Составлено по клиническим рекомендациям Минздрава России."
    )
  }),

  /* Хвост шаблона держим коротким: он съедает место у названия,
     а в выдаче поисковика обрезается именно хвост. Жанр при этом объявлен
     в каждом заголовке — «справочник» и «раздел справочника». */
  condition: c => ({
    title: `${c.name}: как проявляется · Справочник`,
    description: clamp(`${firstSentence(c.what)} Справочная статья: у кого встречается, когда бывает неотложным, к какому врачу.`)
  }),

  syndrome: (s, count) => ({
    title: `${s.name} — раздел справочника`,
    description: clamp(
      `${s.name}: ${count} ${plural(count, "состояние", "состояния", "состояний")}, при которых так бывает. Раздел справочника — что это, у кого встречается чаще, к какому врачу.`
    )
  }),

  ukazatel: (nConditions, nSyndromes) => ({
    title: withSite("Алфавитный указатель"),
    description: clamp(
      `Все ${nConditions} статей и ${nSyndromes} разделов справочника по алфавиту, вместе с обиходными названиями. Открывается без выбора области и без уточнений.`
    )
  }),

  notSearchedHere: title => ({
    title: withSite(title),
    description: clamp(
      "Ситуации, при которых справочник закрывают и звонят в скорую помощь. Здесь их не разбирают."
    )
  }),

  noMatch: title => ({
    title: withSite(title),
    description: clamp(
      "Справочник собран по самым частым причинам и охватывает далеко не всё. Что делать, если ничего из перечисленного не похоже."
    )
  })
};

function plural(n, one, few, many) {
  const d = n % 10, h = n % 100;
  if (h > 10 && h < 20) return many;
  if (d === 1) return one;
  if (d >= 2 && d <= 4) return few;
  return many;
}
