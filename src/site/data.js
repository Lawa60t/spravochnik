"use strict";
/* Загрузка замороженной базы и индексы поверх неё.
   Ничего не пишет и ничего не меняет: data/ только читается. */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "..", "data");
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const files = fs.readdirSync(dir);

const questions = read("questions.json").questions;
const redflags = read("redflags.json");
const anatomy = read("anatomy.json");
const map = read("syndromes-map.json");

const conditions = files
  .filter(f => f.startsWith("conditions-"))
  .flatMap(f => read(f).conditions);

const syndromes = files
  .filter(f => f.startsWith("syndromes-") && f !== "syndromes-map.json")
  .flatMap(f => read(f).syndromes);

const conditionById = new Map(conditions.map(c => [c.id, c]));
const syndromeById = new Map(syndromes.map(s => [s.id, s]));
const zoneById = new Map(map.zones.map(z => [z.id, z]));

/* ---------- адреса ----------
   id в базе задан как «часть постоянного адреса статьи» (schema.json).
   Точка в пути читается частью хостингов как расширение файла, поэтому в слаге дефис.
   Обратимость и отсутствие коллизий проверяются при сборке. */
const slug = id => id.replace(/\./g, "-");
const conditionPath = id => `/sostoyaniya/${slug(id)}/`;
const syndromePath = id => `/razdely/${slug(id)}/`;

/* ---------- обратные связи ----------
   248 статей из 307 работают больше чем в одном разделе.
   Показать это на статье — то, что отличает энциклопедию от вывода опроса. */
const syndromesOfCondition = new Map();
syndromes.forEach(s => {
  s.candidates.forEach(cand => {
    if (!syndromesOfCondition.has(cand.condition)) syndromesOfCondition.set(cand.condition, []);
    syndromesOfCondition.get(cand.condition).push(s);
  });
});

const collator = new Intl.Collator("ru");
const byName = (a, b) => collator.compare(a.name, b.name);

module.exports = {
  questions,
  redflags,
  anatomy,
  map,
  conditions,
  syndromes,
  conditionById,
  syndromeById,
  zoneById,
  syndromesOfCondition,
  slug,
  conditionPath,
  syndromePath,
  collator,
  byName
};
