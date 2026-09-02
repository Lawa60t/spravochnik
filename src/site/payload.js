"use strict";
/* Данные уточнения по разделам — с отпечатком в имени, как и остальные файлы.

   На страницу едет только то, что нужно этому разделу: сам раздел, его
   состояния, только его вопросы (9–29 из 138) и правила тревоги,
   отфильтрованные по зоне. Всю базу в браузер не отдаём — это мегабайты,
   а человек на медленном мобильном интернете ждать их не станет.
   Грузится по нажатию кнопки, а не при открытии страницы. */
const D = require("./data");
const meta = require("./meta");
const SEXQ = require("../questions-sex.json");
const { fingerprint } = require("./assets");

function content(s) {
  const questions = D.questions.filter(q => s.questions.includes(q.id));
  const conditions = s.candidates
    .map(c => D.conditionById.get(c.condition))
    .filter(Boolean)
    .map(c => ({
      /* поля движка */
      id: c.id, name: c.name, redflag: !!c.redflag,
      sexOnly: c.sexOnly, ageMin: c.ageMin, ageMax: c.ageMax,
      /* поля показа */
      icd: c.icd,
      path: D.conditionPath(c.id),
      gist: meta.clamp(meta.firstSentence(c.what), 110)
    }));
  const redflags = {
    global: D.redflags.global.filter(r => !r.zones || r.zones.includes(s.zone))
  };

  const data = { questions, redflags, conditions, syndromes: [s], sexQuestions: SEXQ };
  return `window.EZ_DATA=${JSON.stringify(data)};\n`;
}

const byId = new Map();
D.syndromes.forEach(s => {
  const js = content(s);
  const file = `${D.slug(s.id)}.${fingerprint(js)}.js`;
  byId.set(s.id, { file, url: "/dannye/" + file, content: js });
});

module.exports = {
  get: id => byId.get(id),
  all: () => [...byId.values()]
};
