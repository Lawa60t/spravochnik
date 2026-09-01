/* Движок ранжирования релевантности статей + слой красных флагов.

   Один и тот же файл работает в Node и в браузере. Различается только одно —
   откуда пришли данные; всё, что ниже шва, про источник не знает ничего.
   Поэтому на сайте исполняется ровно тот код, который прогоняют 252 теста,
   и отдельной «браузерной версии ранжирования» не существует.

   Тела rank, present и checkRedflags не менялись с момента заморозки базы —
   в том числе отступами, чтобы это было видно в истории.

   Запуск прогона тестовых случаев: node engine.js */
"use strict";
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    /* Node: данные читает соседний модуль. */
    module.exports = factory(require("./engine-data.js"));
  } else {
    /* Браузер: данные раздела кладёт сборка в EZ_DATA до загрузки этого файла. */
    root.EZ = factory(root.EZ_DATA);
  }
})(typeof self !== "undefined" ? self : this, function (DATA) {

const QUESTIONS  = DATA.questions;
const REDFLAGS   = DATA.redflags;
const CONDITIONS = DATA.conditions;
const SYNDROMES  = DATA.syndromes;

const cById = new Map(CONDITIONS.map(c => [c.id, c]));
const sById = new Map(SYNDROMES.map(s => [s.id, s]));
const qById = new Map(QUESTIONS.map(q => [q.id, q]));

/* ---------- слой красных флагов ---------- */
function matchCond(cond, answers) {
  return Object.entries(cond).every(([qid, vals]) => vals.includes(answers[qid]));
}
function checkRedflags(answers, age, zone) {
  return REDFLAGS.global.filter(r => {
    if (r.zones && zone && !r.zones.includes(zone)) return false;
    if (r.minAge !== undefined && age !== undefined && age < r.minAge) return false;
    if (r.maxAge !== undefined && age !== undefined && age > r.maxAge) return false;
    if (r.unless && r.unless.some(c => matchCond(c, answers))) return false;
    if (r.when.all) return r.when.all.every(c => matchCond(c, answers));
    if (r.when.any) return r.when.any.some(c => matchCond(c, answers));
    return false;
  });
}

/* ---------- ранжирование ---------- */
function rank(syndromeId, input) {
  const { sex, age } = input;
  const s = sById.get(syndromeId);
  if (!s) throw new Error("нет раздела " + syndromeId);

  const answers = Object.assign({}, s.implies || {}, input.answers);
  const keys = Object.entries(answers)
    .filter(([, v]) => v && v !== "unk")
    .map(([q, v]) => `${q}_${v}`);

  return s.candidates.map(cand => {
    const c = cById.get(cand.condition);
    let v = cand.base;
    const hits = [], against = [];

    keys.forEach(k => {
      const w = (cand.weights || {})[k];
      if (w === undefined) return;
      v += w;
      if (w > 0) hits.push(k); else if (w <= -2) against.push(k);
    });

    if ((cand.stop || []).some(k => keys.includes(k))) v = -99;

    /* поправки на пол и возраст из самой статьи */
    if (c.sexOnly && c.sexOnly !== sex) v = -99;
    if (c.ageMin !== undefined && age < c.ageMin) v -= 3;
    if (c.ageMax !== undefined && age > c.ageMax) v -= 3;

    return { id: c.id, name: c.name, redflag: !!c.redflag, score: v, hits, against };
  })
  .filter(r => r.score > -50)
  .sort((a, b) => b.score - a.score);
}

/* ---------- выдача, как её увидит человек ---------- */
function present(syndromeId, input) {
  const list = rank(syndromeId, input);
  const syn = sById.get(syndromeId);
  const alarms = checkRedflags(Object.assign({}, syn.implies || {}, input.answers), input.age, syn.zone);
  const crit = list.filter(r => r.redflag).slice(0, 4);
  const rest = list.filter(r => !r.redflag);
  return {
    alarms,
    blocks: {
      "Редко, но важно не пропустить": crit,
      "Встречается часто": rest.slice(0, 4),
      "Встречается реже": rest.slice(4, 9)
    },
    all: list
  };
}

/* ---------- следующий вопрос ----------
   Жадный выбор: спрашиваем то, что сильнее всего разводит нынешних лидеров.
   Этого куска не было в движке — в базе он ничем не задан, поэтому он покрыт
   отдельным прогоном (tools/test-selector.js): те же 252 случая, но ответы
   выдаются по одному, в ответ на вопросы самого селектора.

   Пул вопросов — только `questions` раздела. Вопрос из чужого раздела может
   оказаться бессмысленным здесь, а «не знаю» на бессмысленный вопрос —
   это шаг, потраченный впустую. */
const NEXT_TOP = 6;        /* сколько лидеров разводим заведомо */
const NEXT_MARGIN = 6;     /* отставание, при котором кандидат ещё в игре */
const NEXT_MIN = 3;        /* ниже этого вопрос почти ничего не различает */
const STOP_AS = -8;        /* стоп-фактор различает сильнее любого веса */
/* Вопрос, способный дозажечь правило тревоги, ценится наравне с вопросом,
   способным сменить первое место. Иначе селектор, оптимизируя порядок статей,
   перестаёт спрашивать про ригидность затылка и про холодный пот — список
   выходит красивый, а слой безопасности молчит. Это ровно тот случай,
   когда справочник успокоил там, где надо было звонить. */
const REDFLAG_BONUS = 150;

/* Кого разводим. Одних лидеров мало, и это не мелочь, а главная ошибка,
   которую такой алгоритм делает: редкое состояние стоит внизу по базовой частоте,
   в лидеры не попадает — и его патогномоничный признак никогда не спрашивают.
   Опухоль поджелудочной начинает четырнадцатой из пятнадцати, а «желтуха» весит
   у неё +6: спроси — и она сразу первая, не спроси — она не всплывёт никогда.
   Поэтому в набор всегда входят все живые состояния «редко, но важно не пропустить». */
function contenders(ranked) {
  if (!ranked.length) return [];
  const lead = ranked[0].score;
  return ranked.filter((r, i) => i < NEXT_TOP || r.redflag || r.score >= lead - NEXT_MARGIN);
}

/* Вопрос не тому полу. Из базы это не выводится: у «последней менструации»
   веса стоят и у цистита, и у анемии, так что формально вопрос различает
   живых кандидатов и у мужчины. Список решён явно — src/questions-sex.json. */
const SEXQ = DATA.sexQuestions || { f: [], m: [] };
function wrongSex(qid, sex) {
  if (!sex) return false;
  if (sex !== "f" && (SEXQ.f || []).indexOf(qid) !== -1) return true;
  if (sex !== "m" && (SEXQ.m || []).indexOf(qid) !== -1) return true;
  return false;
}

/* Правила, которые вообще могут сработать здесь: по зоне и по возрасту. */
function liveRules(zone, age) {
  return REDFLAGS.global.filter(r => {
    if (r.zones && zone && !r.zones.includes(zone)) return false;
    if (r.minAge !== undefined && age !== undefined && age < r.minAge) return false;
    if (r.maxAge !== undefined && age !== undefined && age > r.maxAge) return false;
    return true;
  });
}

/* Условие правила: совпало, ещё может совпасть (не спрошено) или уже мертво. */
function clauseState(cond, answers) {
  if (matchCond(cond, answers)) return "yes";
  return Object.keys(cond).every(qid => answers[qid] === undefined) ? "open" : "dead";
}

/* Насколько вопрос приближает срабатывание правила тревоги.
   Считать «не хватает только этого ответа» нельзя: правилу «длительность
   плюс потеря веса» в начале не хватает обоих, ни один из двух вопросов
   не получил бы надбавки, и правило не сработало бы никогда.
   Поэтому надбавку получает живое правило, и тем большую, чем меньше ему
   осталось спросить. */
function ruleBonus(qid, answers, rules) {
  let best = 0;
  rules.forEach(r => {
    if (r.unless && r.unless.some(c => matchCond(c, answers))) return;

    const clauses = r.when.all || r.when.any || [];
    const mentions = clauses.some(c => Object.keys(c).includes(qid));
    if (!mentions) return;

    const states = clauses.map(c => clauseState(c, answers));
    /* «any» умирает только когда мертвы все условия, «all» — когда мертво любое */
    if (r.when.all && states.includes("dead")) return;
    if (r.when.any && states.every(x => x === "dead")) return;

    const missing = r.when.all ? states.filter(x => x !== "yes").length : 1;
    best = Math.max(best, REDFLAG_BONUS / Math.max(missing, 1));
  });
  return best;
}

function nextQuestion(syndromeId, input) {
  const s = sById.get(syndromeId);
  if (!s) throw new Error("нет раздела " + syndromeId);

  const answers = Object.assign({}, s.implies || {}, input.answers);
  const leaders = contenders(rank(syndromeId, input));
  if (leaders.length < 2) return null;

  /* Состояния с их нынешними очками — по ним считаем, что будет, если ответить так или иначе. */
  const now = leaders.map(r => ({
    id: r.id,
    score: r.score,
    cand: s.candidates.find(c => c.condition === r.id)
  })).filter(x => x.cand);

  const gapOf = list => {
    const sorted = list.slice().sort((a, b) => b.score - a.score);
    return {
      top: sorted[0] ? sorted[0].id : null,
      gap: sorted.length > 1 ? sorted[0].score - sorted[1].score : 0
    };
  };
  const before = gapOf(now);

  const rules = liveRules(s.zone, input.age);
  let best = null, bestScore = 0;

  s.questions.forEach(qid => {
    if (answers[qid] !== undefined) return;
    if (wrongSex(qid, input.sex)) return;
    const q = qById.get(qid);
    if (!q) return;

    /* Что стало бы, ответь человек каждым из вариантов. */
    const tops = new Set();
    let swing = 0;

    q.options.forEach(o => {
      if (o.id === "unk") return; /* «не знаю» веса не имеет нигде */
      const key = `${qid}_${o.id}`;
      const after = gapOf(
        now.map(x => ({
          id: x.id,
          score: (x.cand.stop || []).includes(key)
            ? STOP_AS * 10
            : x.score + ((x.cand.weights || {})[key] || 0)
        }))
      );
      tops.add(after.top);
      swing = Math.max(swing, Math.abs(after.gap - before.gap));
    });

    /* Главное — может ли ответ вообще сменить первое место: вопрос, который
       ни при каком ответе ничего не меняет, это потраченный шаг.
       Второе — насколько сильно ответ разводит первых двух.
       Прибавка за вопрос, способный дозажечь правило тревоги, идёт сверху. */
    const score =
      (tops.size - 1) * 100 + swing + ruleBonus(qid, answers, rules);

    if (score > bestScore) { bestScore = score; best = q; }
  });

  return bestScore >= NEXT_MIN ? best : null;
}

return { rank, present, checkRedflags, nextQuestion, QUESTIONS, CONDITIONS, SYNDROMES, cById, sById, qById };
});

/* ---------- прогон тестовых случаев ---------- */
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  const { present } = module.exports;
  const vign = require("./engine-data.js").vignettes();
  let pass = 0, fail = 0;
  const problems = [];
  const L = "─".repeat(58);
  console.log(L); console.log("ПРОГОН ТЕСТОВЫХ СЛУЧАЕВ"); console.log(L);

  vign.forEach(v => {
    const res = present(v.syndrome, { sex: v.sex, age: v.age, answers: v.answers });
    const top5 = res.all.slice(0, 5).map(r => r.id);
    const top3 = res.all.slice(0, 3).map(r => r.id);
    const alarmed = res.alarms.length > 0;
    const bad = [];

    (v.expect || []).forEach(e => { if (!top5.includes(e)) bad.push(`«${e}» не попал в топ-5`); });
    if (v.expectTop && res.all[0].id !== v.expectTop)
      bad.push(`первым ожидался «${v.expectTop}», а стоит «${res.all[0].id}»`);
    (v.notExpect || []).forEach(n => { if (top3.includes(n)) bad.push(`«${n}» ошибочно в топ-3`); });
    if (v.expectAlarm !== undefined && v.expectAlarm !== alarmed)
      bad.push(v.expectAlarm ? "красный флаг НЕ сработал, а должен" : "красный флаг сработал зря");

    if (bad.length) {
      fail++;
      problems.push({ v, bad, top5, alarms: res.alarms.map(a => a.id) });
      console.log(`✗ ${v.id}  ${v.note}`);
      bad.forEach(b => console.log(`     ${b}`));
      console.log(`     топ-5: ${top5.join(", ")}`);
    } else {
      pass++;
      const flag = alarmed ? ` [флаг: ${res.alarms.map(a => a.id).join(",")}]` : "";
      console.log(`✓ ${v.id}  ${v.note}${flag}`);
    }
  });

  console.log(L);
  console.log(`Пройдено ${pass} из ${pass + fail}`);
  console.log(L);
  process.exit(fail ? 1 : 0);
}
