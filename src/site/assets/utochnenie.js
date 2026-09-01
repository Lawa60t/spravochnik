"use strict";
/* Уточняющие шаги — надстройка над готовой страницей раздела.

   Что здесь важнее кода:

   1. Ранжирование считает engine.js — тот же файл, который гоняют 252 теста
      и прогон выбора вопросов. Своей версии расчёта здесь нет и быть не должно.
   2. Ответы живут в памяти вкладки. Ни адрес, ни localStorage, ни sessionStorage,
      ни один запрос наружу их не видят. Закрыл страницу — ничего не осталось.
   3. Красные флаги проверяются после КАЖДОГО ответа, а не в конце.
   4. Русского текста здесь нет: весь он лежит в разметке, потому что разметку
      проверяет линт формулировок, а скрипт — нет.

   Данные раздела и движок грузятся по нажатию кнопки, а не при открытии
   страницы: до этого момента раздел читается как обычный список. */
(function () {
  var root = document.querySelector("[data-refine]");
  if (!root) return;

  var synId = root.getAttribute("data-syndrome");
  var maxSteps = parseInt(root.getAttribute("data-max"), 10) || 10;

  var steps = {};
  ["start", "sex", "age", "q", "result"].forEach(function (name) {
    steps[name] = root.querySelector('[data-step="' + name + '"]');
  });
  var slot = function (name) { return root.querySelector('[data-slot="' + name + '"]'); };

  /* Состояние диалога. Ровно эти три поля — и только в памяти. */
  var state = { sex: null, age: null, answers: {}, asked: 0 };

  function show(name) {
    Object.keys(steps).forEach(function (k) {
      if (steps[k]) steps[k].hidden = k !== name;
    });
  }

  function loadScript(src, done) {
    var el = document.createElement("script");
    el.src = src;
    el.onload = done;
    el.onerror = function () { show("start"); };
    document.head.appendChild(el);
  }

  /* ---------- шаги ---------- */
  root.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("[data-act],[data-sex],[data-opt]") : null;
    if (!el || !root.contains(el)) return;

    var act = el.getAttribute("data-act");
    if (act === "start") return start();
    if (act === "age") return pickAge();
    if (act === "copy") return copyTell(el);
    if (act === "restart") return restart();

    if (el.hasAttribute("data-sex")) return pickSex(el.getAttribute("data-sex"));
    if (el.hasAttribute("data-opt")) return answer(el.getAttribute("data-q"), el.getAttribute("data-opt"));
  });

  function start() {
    if (window.EZ) return show("sex");
    loadScript(root.getAttribute("data-payload"), function () {
      loadScript("/engine.js", function () { show("sex"); });
    });
  }

  function pickSex(sex) {
    state.sex = sex;
    show("age");
    var input = document.getElementById("refine-age");
    if (input) input.focus();
  }

  function pickAge() {
    var input = document.getElementById("refine-age");
    var n = parseInt(input && input.value, 10);
    state.age = isNaN(n) ? 35 : Math.max(0, Math.min(120, n));
    ask();
  }

  function answer(qid, optId) {
    state.answers[qid] = optId;
    state.asked++;
    checkAlarms();          /* после каждого ответа, а не в конце */
    ask();
  }

  function restart() {
    state = { sex: null, age: null, answers: {}, asked: 0 };
    var alarm = slot("alarm");
    if (alarm) alarm.hidden = true;
    show("sex");
  }

  /* ---------- вопрос ---------- */
  function ask() {
    if (state.asked >= maxSteps) return finish();

    var q = window.EZ.nextQuestion(synId, {
      sex: state.sex, age: state.age, answers: state.answers
    });
    if (!q) return finish();

    slot("count").textContent = (root.getAttribute("data-step-tpl") || "")
      .replace("{n}", state.asked + 1)
      .replace("{max}", maxSteps);

    slot("qtext").textContent = q.text;
    var hint = slot("qhint");
    hint.textContent = q.hint || "";
    hint.hidden = !q.hint;

    var box = slot("options");
    box.textContent = "";
    q.options.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-opt", o.id);
      b.setAttribute("data-q", q.id);
      if (o.id === "unk") b.className = "muted";
      b.textContent = o.text;
      box.appendChild(b);
    });

    show("q");
  }

  /* ---------- тревога ---------- */
  function checkAlarms() {
    var syn = window.EZ.sById.get(synId);
    var merged = Object.assign({}, syn.implies || {}, state.answers);
    var alarms = window.EZ.checkRedflags(merged, state.age, syn.zone);

    var box = slot("alarm");
    var list = slot("alarmlist");
    if (!alarms.length) { box.hidden = true; return; }

    list.textContent = "";
    alarms.forEach(function (a) {
      var li = document.createElement("li");
      li.textContent = a.say;
      list.appendChild(li);
    });
    box.hidden = false;
  }

  /* ---------- выдача ---------- */
  function finish() {
    var res = window.EZ.present(synId, {
      sex: state.sex, age: state.age, answers: state.answers
    });

    var box = slot("blocks");
    box.textContent = "";

    /* Заголовки блоков заданы движком и должны совпадать с тем, что видит человек. */
    Object.keys(res.blocks).forEach(function (title) {
      var items = res.blocks[title];
      if (!items.length) return;

      var sec = document.createElement("section");
      sec.className = "block";
      var h = document.createElement("h3");
      h.textContent = title;
      sec.appendChild(h);

      var ul = document.createElement("ul");
      ul.className = "conditions";
      items.forEach(function (r) {
        var c = window.EZ.cById.get(r.id);
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = c.path;
        a.textContent = c.name;
        li.appendChild(a);
        var icd = document.createElement("span");
        icd.className = "icd";
        icd.textContent = c.icd;
        li.appendChild(icd);
        var gist = document.createElement("span");
        gist.className = "gist";
        gist.textContent = c.gist;
        li.appendChild(gist);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      box.appendChild(sec);
    });

    slot("tell").textContent = tell();
    checkAlarms();
    show("result");
  }

  /* ---------- что сказать врачу ---------- */
  function tell() {
    var lines = [];
    var sexBtn = root.querySelector('[data-sex="' + state.sex + '"]');
    lines.push(
      (root.getAttribute("data-sex-line") || "") + ": " +
      (sexBtn ? sexBtn.textContent.toLowerCase() : "") + ", " +
      (root.getAttribute("data-age-line") || "").toLowerCase() + " " + state.age
    );

    window.EZ.QUESTIONS.forEach(function (q) {
      var a = state.answers[q.id];
      if (a === undefined || a === "unk") return;
      var o = null;
      q.options.forEach(function (x) { if (x.id === a) o = x; });
      if (o) lines.push(q.short + ": " + (o.short || o.text).toLowerCase());
    });

    return lines.join("\n");
  }

  function copyTell(btn) {
    var text = slot("tell").textContent;
    var done = function () {
      var was = btn.textContent;
      btn.textContent = btn.getAttribute("data-copied");
      setTimeout(function () { btn.textContent = was; }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (err) {}
      document.body.removeChild(ta);
      done();
    }
  }

  root.hidden = false;
})();
