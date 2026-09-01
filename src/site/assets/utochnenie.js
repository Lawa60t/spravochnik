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
    if (act === "age-skip") return pickAge(true);
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

  /* Возраст остаётся undefined, если его не назвали. Так и надо: движок
     обходит поправки ageMin/ageMax и возрастные правила тревоги, а не считает,
     будто человеку столько-то лет. Подставить сюда число молча — значит
     ответить за него: возраст двигает 11 статей. */
  function pickAge(skip) {
    var input = document.getElementById("refine-age");
    var n = parseInt(input && input.value, 10);
    state.age = skip || isNaN(n) ? undefined : Math.max(0, Math.min(120, n));
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

    /* Заголовки блоков заданы движком и должны совпадать с тем, что видит человек.
       Исключение одно: когда «часто» выродилось в ноль или одну строку, оба
       блока сливаются в один список без заголовка. Заголовок над единственной
       строкой читается как поломка вёрстки, а называть слитый список «часто»
       было бы неправдой — в нём и редкие. Порядок и так объяснён выше. */
    var titles = Object.keys(res.blocks);
    var often = res.blocks["Встречается часто"] || [];
    var seldom = res.blocks["Встречается реже"] || [];
    var groups;

    if (often.length <= 1 && often.length + seldom.length > 0) {
      groups = [];
      titles.forEach(function (t) {
        if (t !== "Встречается часто" && t !== "Встречается реже") {
          groups.push({ title: t, items: res.blocks[t] });
        }
      });
      groups.push({ title: null, items: often.concat(seldom) });
    } else {
      groups = titles.map(function (t) { return { title: t, items: res.blocks[t] }; });
    }

    groups.forEach(function (g) {
      var items = g.items;
      if (!items || !items.length) return;

      var sec = document.createElement("section");
      sec.className = "block";
      if (g.title) {
        var h = document.createElement("h3");
        h.textContent = g.title;
        sec.appendChild(h);
      }

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
    var head = (root.getAttribute("data-sex-line") || "") + ": " +
      (sexBtn ? sexBtn.textContent.toLowerCase() : "");
    /* Возраст в сводку попадает, только если человек его назвал. */
    if (state.age !== undefined) {
      head += ", " + (root.getAttribute("data-age-line") || "").toLowerCase() + " " + state.age;
    }
    lines.push(head);

    window.EZ.QUESTIONS.forEach(function (q) {
      var a = state.answers[q.id];
      if (a === undefined || a === "unk") return;
      var o = null;
      q.options.forEach(function (x) { if (x.id === a) o = x; });
      if (o) lines.push(q.short + ": " + (o.short || o.text).toLowerCase());
    });

    return lines.join("\n");
  }

  /* navigator.clipboard существует только в защищённом контексте: по http
     его просто нет, и кнопка молча ничего не делает. Поэтому запасной путь —
     выделить текст в самой странице. Даже если и execCommand не сработает,
     сводка остаётся выделенной и человек копирует её сам. */
  function copyTell(btn) {
    var el = slot("tell");
    var was = btn.textContent;
    var flash = function (label) {
      btn.textContent = label;
      setTimeout(function () { btn.textContent = was; }, 2200);
    };

    var selectAndCopy = function () {
      var range = document.createRange();
      range.selectNodeContents(el);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      var ok = false;
      try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
      flash(ok ? btn.getAttribute("data-copied") : btn.getAttribute("data-selected"));
    };

    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      navigator.clipboard.writeText(el.textContent).then(
        function () { flash(btn.getAttribute("data-copied")); },
        selectAndCopy
      );
      return;
    }
    selectAndCopy();
  }

  root.hidden = false;
})();
