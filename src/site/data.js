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
const zonePath = id => `/oblasti/${slug(id)}/`;

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

/* ---------- области ----------
   В оглавлении 10 областей (syndromes-map), в слое якорей 13 зон:
   голова и шея разделены на вид спереди и вид сзади, плюс отдельный вход
   для жалоб без привязки к месту. Область собирает свои зоны по префиксу id. */
const anatomyZonesOf = zoneId => anatomy.zones.filter(z => z.id.split(".")[0] === zoneId);

/* Разделы области, разложенные по участкам.
   Остаток — разделы, которые в участках своей области не встречаются:
   пятнадцать таких, почти все живут во входе «жалобы без привязки к месту»
   (тошнота, кровь в стуле, головокружение). На странице области они обязаны
   быть видны, иначе часть оглавления доступна только с фигуры. */
function zoneGroups(zoneId) {
  /* Один раздел бывает якорем сразу у нескольких участков: «боль в правом боку»
     висит и на подреберье, и на боку. В оглавлении он должен встретиться один раз,
     под первым по порядку участком — иначе список выглядит ошибкой вёрстки. */
  const shown = new Set();

  const groups = anatomyZonesOf(zoneId)
    .map(az => ({
      id: az.id,
      label: az.label,
      landmark: az.landmark,
      view: az.view,
      subzones: (az.subzones || [])
        .map(sz => ({
          id: sz.id,
          label: sz.label,
          landmark: sz.landmark,
          syndromes: (sz.syndromes || [])
            .map(id => syndromeById.get(id))
            .filter(Boolean)
            .filter(s => {
              if (shown.has(s.id)) return false;
              shown.add(s.id);
              return true;
            })
        }))
        .filter(sz => sz.syndromes.length)
    }))
    .filter(g => g.subzones.length);

  const covered = shown;
  const rest = syndromes.filter(s => s.zone === zoneId && !covered.has(s.id)).sort(byName);

  return { groups, rest };
}

const syndromesOfZone = zoneId => syndromes.filter(s => s.zone === zoneId);

/* ---------- силуэт ----------
   Участки для отрисовки на мужском или женском силуэте.

   Возвращаются ВСЕ участки, включая помеченные `sexOnly`. Это правило, а не
   недоделка: силуэт — это вид, а не утверждение о человеке, и скрывать разделы
   он не имеет права. `sexOnly` у участка влияет только на то, как он нарисован
   (грудная железа на мужском силуэте выглядит иначе), но не на достижимость.

   Цена нарушения посчитана: если убирать участки с чужим `sexOnly`, с мужского
   силуэта пропадают ровно два раздела из 110 — «уплотнение в молочной железе»
   и «боль в молочной железе». Других якорей у них нет. При этом в обоих лежит
   гинекомастия с `sexOnly: "m"`, то есть раздел, написанный в том числе для
   мужчины, и рак молочной железы без ограничения по полу вообще.

   Фигура на четвёртом этапе обязана брать участки отсюда, а не фильтровать сама:
   проверка на сборке считает достижимость именно по этой функции. */
function subzonesForSilhouette() {
  return anatomy.zones.flatMap(z =>
    (z.subzones || []).map(sz => ({ zone: z, subzone: sz }))
  );
}

/* Разделы, достижимые с силуэта. Должно быть все 110 для каждого из двух. */
function syndromesOnSilhouette(sex) {
  const seen = new Set();
  subzonesForSilhouette(sex).forEach(({ subzone }) =>
    (subzone.syndromes || []).forEach(id => seen.add(id))
  );
  return seen;
}

/* Вход symptom.list: жалобы, которые нельзя показать пальцем. */
function symptomList() {
  const zone = anatomy.zones.find(z => z.id === "symptom");
  const sub = (zone.subzones || [])[0] || {};
  return {
    label: zone.label,
    landmark: zone.landmark,
    syndromes: (sub.syndromes || []).map(id => syndromeById.get(id)).filter(Boolean)
  };
}

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
  anatomyZonesOf,
  zoneGroups,
  syndromesOfZone,
  symptomList,
  subzonesForSilhouette,
  syndromesOnSilhouette,
  slug,
  conditionPath,
  syndromePath,
  zonePath,
  collator,
  byName
};
