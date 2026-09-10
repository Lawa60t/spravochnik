"use strict";
/* Поиск в шапке — на каждой странице.

   Почему он вообще понадобился. Указатель есть, но до него надо додуматься
   дойти: человек, ищущий «боль в пятке», уходит с сайта, не узнав, что
   такой раздел есть. Поле в шапке — единственный вход, который видно сразу.

   Три правила, от которых нельзя отступать:

   1. Запрос не попадает в адрес. Ни ?q=, ни хеша, ни формы с action:
      названия болезней не должны оседать ни в истории браузера, ни в логах
      хостинга. Переход происходит только по ссылке на постоянный адрес.
   2. Ничего не сохраняется: ни localStorage, ни sessionStorage, ни куки.
   3. Поле создаёт скрипт. Без JavaScript в шапке остаётся обычная ссылка
      на указатель — мёртвого поля, которое ничего не делает, быть не должно.

   Индекс грузится по первому нажатию клавиши, а не при открытии страницы:
   подавляющее большинство читателей приходят по ссылке на статью и ничего
   не ищут.

   Русского текста здесь нет: все строки приходят из разметки атрибутами,
   чтобы оставаться под линтом формулировок.

   --------------------------------------------------------------------
   Что здесь изменилось и почему.

   Прежний поиск сравнивал подстроки. Это давало три беды, и все три
   были видны на живых запросах:

     «болит горло»     → не находилось ничего: слова «болит» нет ни в одном
                         названии, а «боль» подстрокой в «болит» не входит;
     «высокая температура» → выводило «Длительная НЕвысокая температура»:
                         подстрока не знает границы слова;
     «больно наступать на пятку» → не находилось ничего: требовалось, чтобы
                         подошли ВСЕ слова запроса, включая «наступать».

   Поэтому сравниваются не подстроки, а слова, приведённые к основе
   (стеммер Портера для русского языка, алгоритм Snowball; реализован здесь
   же — у проекта ноль зависимостей). «болит», «боли», «болью» и «боль»
   дают одну основу «бол»; «высокая» и «невысокая» — разные.

   Требование «подошли все слова» смягчено до «подошло столько слов,
   сколько вообще удалось подобрать». Когда сходятся все — поведение
   прежнее; когда лишнее слово вроде «наступать» в справочнике не
   встречается, оно просто не мешает.

   Чего здесь по-прежнему НЕТ и не должно появиться: подсказок «похоже,
   у вас…», подсчёта совпадений в процентах, разбора набранного текста
   как жалобы. Поиск ведёт к постоянному адресу раздела или статьи —
   это оглавление, а не разбор случая. */
(function (factory) {
  var core = factory();
  /* Тот же файл гоняют тесты в Node — как и движок ранжирования. */
  if (typeof module === "object" && module.exports) module.exports = core;
  if (typeof window !== "undefined") window.EZP = core;
  if (typeof document !== "undefined") core.attach();
})(function () {

  /* ------------------------------------------------------------------
     Основа слова: стеммер Портера для русского языка (Snowball).
     ------------------------------------------------------------------ */
  var V = "аеиоуыэюя";
  var PERF1 = ["вшись", "вши", "в"];
  var PERF2 = ["ывшись", "ившись", "ывши", "ивши", "ыв", "ив"];
  var ADJ = ["ими", "ыми", "его", "ого", "ему", "ому", "ее", "ие", "ые", "ое",
             "ей", "ий", "ый", "ой", "ем", "им", "ым", "ом", "их", "ых",
             "ую", "юю", "ая", "яя", "ою", "ею"];
  var PART1 = ["ющ", "вш", "ем", "нн", "щ"];
  var PART2 = ["ующ", "ивш", "ывш"];
  var VERB1 = ["ешь", "нно", "ете", "йте", "ли", "ем", "ло", "но", "ет", "ют",
               "ны", "ть", "ла", "на", "й", "л", "н"];
  var VERB2 = ["ейте", "уйте", "ила", "ыла", "ена", "ите", "или", "ыли",
               "ило", "ыло", "ено", "ует", "уют", "ены", "ить", "ыть", "ишь",
               "ей", "уй", "ил", "ыл", "им", "ым", "ен", "ят", "ит", "ыт",
               "ую", "ю"];
  var NOUN = ["иями", "ями", "ами", "иях", "ях", "ах", "ией", "иям", "ием",
              "ев", "ов", "ие", "ье", "еи", "ии", "ий", "ия", "ья", "ию", "ью",
              "ям", "ем", "ей", "ой", "ам", "ом",
              "а", "е", "и", "й", "о", "у", "ы", "ь", "ю", "я"];
  var DERIV = ["ость", "ост"];
  var SUPER = ["ейше", "ейш"];

  function isV(c) { return V.indexOf(c) > -1; }

  /* RV — всё, что стоит после первой гласной. */
  function rvStart(w) {
    for (var i = 0; i < w.length; i++) if (isV(w[i])) return i + 1;
    return w.length;
  }
  /* R2 — область после второго «согласные-гласные» разбега. */
  function r2Start(w) {
    var i = 0, n = w.length, r1;
    while (i < n && !isV(w[i])) i++;
    while (i < n && isV(w[i])) i++;
    r1 = i + 1 > n ? n : i + 1;
    i = r1;
    while (i < n && !isV(w[i])) i++;
    while (i < n && isV(w[i])) i++;
    return i + 1 > n ? n : i + 1;
  }
  function endsIn(w, rv, list, needAY) {
    for (var i = 0; i < list.length; i++) {
      var e = list[i], p;
      if (e.length > w.length - rv) continue;
      if (w.slice(w.length - e.length) !== e) continue;
      if (needAY) {
        p = w[w.length - e.length - 1];
        if (p !== "а" && p !== "я") continue;
      }
      return e;
    }
    return null;
  }
  function cut(w, e) { return w.slice(0, w.length - e.length); }

  function stem(word) {
    var w = String(word).toLowerCase().replace(/ё/g, "е");
    if (w.length < 3) return w;
    var rv = rvStart(w), r2 = r2Start(w), e, refl, p;

    e = endsIn(w, rv, PERF1, true) || endsIn(w, rv, PERF2, false);
    if (e) {
      w = cut(w, e);
    } else {
      refl = endsIn(w, rv, ["ся", "сь"], false);
      if (refl) w = cut(w, refl);
      e = endsIn(w, rv, ADJ, false);
      if (e) {
        w = cut(w, e);
        p = endsIn(w, rv, PART1, true) || endsIn(w, rv, PART2, false);
        if (p) w = cut(w, p);
      } else {
        e = endsIn(w, rv, VERB1, true) || endsIn(w, rv, VERB2, false);
        if (e) w = cut(w, e);
        else { e = endsIn(w, rv, NOUN, false); if (e) w = cut(w, e); }
      }
    }
    if (w.length > rv && w[w.length - 1] === "и") w = w.slice(0, -1);
    e = endsIn(w, r2, DERIV, false); if (e) w = cut(w, e);
    if (w.slice(-2) === "нн") {
      w = w.slice(0, -1);
    } else {
      e = endsIn(w, rv, SUPER, false);
      if (e) { w = cut(w, e); if (w.slice(-2) === "нн") w = w.slice(0, -1); }
      else if (w.slice(-1) === "ь") w = w.slice(0, -1);
    }
    return w;
  }

  /* ------------------------------------------------------------------
     Разбор строки.
     ------------------------------------------------------------------ */
  function norm(s) {
    return String(s).toLowerCase().replace(/ё/g, "е")
      .replace(/[^0-9a-zа-я]+/g, " ").trim();
  }

  /* Служебные слова: сами по себе не выбирают ничего, а «в» и «на» есть
     почти в каждом названии. Убираются из запроса, но не из индекса —
     в индексе они безвредны. */
  var STOP = { "и": 1, "в": 1, "на": 1, "с": 1, "по": 1, "при": 1, "из": 1,
    "у": 1, "к": 1, "от": 1, "до": 1, "за": 1, "под": 1, "над": 1, "не": 1,
    "а": 1, "но": 1, "что": 1, "как": 1, "это": 1, "мне": 1, "меня": 1,
    "мой": 1, "моя": 1, "мое": 1, "или": 1, "же": 1, "бы": 1, "ли": 1,
    "то": 1, "очень": 1, "постоянно": 1, "иногда": 1, "сильно": 1, "все": 1,
    "весь": 1, "вся": 1, "так": 1, "тут": 1, "там": 1, "уже": 1, "еще": 1,
    "когда": 1, "почему": 1, "только": 1, "сам": 1, "себя": 1, "я": 1,
    "мною": 1, "быть": 1, "есть": 1, "делать": 1, "почти": 1 };

  function stems(s) {
    var raw = norm(s).split(" "), out = [], i;
    for (i = 0; i < raw.length; i++) if (raw[i]) out.push(stem(raw[i]));
    return out;
  }
  /* Сколько в названии слов, которые что-то значат: по ним меряется,
     насколько название уже запроса. Считается по самим словам, а не по
     основам: служебные слова перечислены в исходном виде. */
  function meaningful(s) {
    var raw = norm(s).split(" "), n = 0, i;
    for (i = 0; i < raw.length; i++) if (raw[i] && !STOP[raw[i]] && raw[i].length > 1) n++;
    return n;
  }
  /* Слова запроса: основа плюс само слово. Само слово нужно последнему —
     его человек ещё дописывает, и «пят» обязано находить «Боль в пятке».
     Основа «пят» короче четырёх букв и по общему правилу не подошла бы. */
  function queryStems(s) {
    var raw = norm(s).split(" "), keep = [], out = [], i;
    for (i = 0; i < raw.length; i++) if (raw[i] && !STOP[raw[i]]) keep.push(raw[i]);
    for (i = 0; i < keep.length; i++) {
      out.push({ s: stem(keep[i]), raw: keep[i], last: i === keep.length - 1 });
    }
    return out;
  }

  /* Совпадение основ: 2 — слово то же самое, 1 — одна основа начинается
     с другой и та не короче четырёх букв («голов» и «головн»). Четыре, а
     не три: на трёх «гор» связывает «горло» с «горечью». */
  var MINP = 4;
  function match(a, b) {
    if (a === b) return 2;
    var n = a.length < b.length ? a.length : b.length, i = 0;
    if (n < MINP) return 0;
    while (i < n && a[i] === b[i]) i++;
    return i === n ? 1 : 0;
  }

  /* ------------------------------------------------------------------
     Поиск.
     ------------------------------------------------------------------ */
  var MAX = 10;

  function prepare(rows) {
    var out = [], i;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      out.push({
        kind: r[0], slug: r[1], name: r[2],
        nw: stems(r[2]),
        aw: stems(r[2] + " " + (r[3] || "")),
        nlen: meaningful(r[2])
      });
    }
    return out;
  }

  function find(index, query) {
    var q = queryStems(query);
    if (!q.length) return [];

    var scored = [], i, j, k;
    for (i = 0; i < index.length; i++) {
      var row = index[i], matched = 0, strong = 0, nameHits = 0;
      for (j = 0; j < q.length; j++) {
        var best = 0, inName = 0, m;
        /* Название и синонимы считаются по отдельности. Иначе выходит
           наоборот: у «Головной боли, разлитой» синоним «болит голова»
           совпадает точнее самого названия — и статья теряет очко за то,
           что синоним хорош. */
        for (k = 0; k < row.aw.length; k++) {
          m = match(q[j].s, row.aw[k]);
          if (!m && q[j].last && row.aw[k].indexOf(q[j].raw) === 0) m = 1;
          if (m > best) best = m;
        }
        for (k = 0; k < row.nw.length; k++) {
          m = match(q[j].s, row.nw[k]);
          if (!m && q[j].last && row.nw[k].indexOf(q[j].raw) === 0) m = 1;
          if (m) { inName = 1; break; }
        }
        if (best) { matched++; strong += best; nameHits += inName; }
      }
      if (!matched) continue;
      scored.push({ row: row, matched: matched, strong: strong, nameHits: nameHits });
    }
    if (!scored.length) return [];

    /* Оставляем тех, кто подобрал больше всего слов запроса. Когда
       подходят все — это прежнее «и то, и другое»; когда лишнее слово
       нигде не встречается, оно просто не отсекает всё подряд. */
    var top = 0;
    for (i = 0; i < scored.length; i++) if (scored[i].matched > top) top = scored[i].matched;
    var keep = [];
    for (i = 0; i < scored.length; i++) if (scored[i].matched === top) keep.push(scored[i]);

    /* Порядок внутри равных. Сначала те, у кого слова запроса стоят в самом
       названии, а не в синонимах. Потом разделы: раздел — вход в справочник,
       статья — уже конкретный ответ, и человек, набравший «кашель», ищет
       полку, а не редкую статью с этим словом в заголовке. Потом точность
       совпадения. Потом — у кого в названии меньше лишних слов: «Головная
       боль, разлитая» ближе к запросу «болит голова», чем «Односторонняя
       пульсирующая головная боль». Порядок слов в запросе не влияет ни на
       что: «болит голова» и «голова болит» дают один и тот же список. */
    keep.sort(function (a, b) {
      return (b.nameHits - a.nameHits) ||
             (a.row.kind - b.row.kind) ||          /* 0 — раздел, он раньше статьи */
             (b.strong - a.strong) ||
             (a.row.nlen - b.row.nlen) ||
             (a.row.name.length - b.row.name.length) ||
             a.row.name.localeCompare(b.row.name, "ru");
    });

    var res = [];
    for (i = 0; i < keep.length && i < MAX; i++) res.push(keep[i].row);
    return res;
  }

  /* ------------------------------------------------------------------
     Поле в шапке. Всё, что ниже, работает только в браузере.
     ------------------------------------------------------------------ */
  function attach() {
    var slot = document.querySelector("[data-poisk-top]");
    if (!slot) return;

    var t = function (name) { return slot.getAttribute("data-" + name) || ""; };
    var fallback = slot.querySelector("[data-poisk-fallback]");
    var index = null;
    var loading = false;
    var pending = null;

    var box = document.createElement("div");
    box.className = "poisk-top-box";

    var label = document.createElement("label");
    label.className = "poisk-top-label";
    label.setAttribute("for", "poisk-top-input");
    label.textContent = t("label");

    var input = document.createElement("input");
    input.type = "search";
    input.id = "poisk-top-input";
    input.className = "poisk-top-input";
    input.autocomplete = "off";
    input.setAttribute("placeholder", t("placeholder"));
    input.setAttribute("aria-expanded", "false");

    var out = document.createElement("ul");
    out.className = "poisk-out";
    out.hidden = true;

    var status = document.createElement("p");
    status.className = "poisk-top-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.hidden = true;

    box.appendChild(label);
    box.appendChild(input);
    box.appendChild(out);
    box.appendChild(status);
    slot.appendChild(box);
    if (fallback) fallback.hidden = true;

    function load() {
      if (index || loading) return;
      loading = true;
      var el = document.createElement("script");
      el.src = slot.getAttribute("data-index");
      el.onload = function () {
        index = prepare(window.EZ_POISK || []);
        if (pending !== null) { var p = pending; pending = null; apply(p); }
      };
      /* Не загрузился — возвращаем ссылку на указатель: там тот же поиск,
         только по уже отрисованным строкам, и он работает без индекса. */
      el.onerror = function () {
        loading = false;
        box.hidden = true;
        if (fallback) fallback.hidden = false;
      };
      document.head.appendChild(el);
    }

    function href(row) {
      return (row.kind === 1 ? "/sostoyaniya/" : "/razdely/") + row.slug + "/";
    }

    function apply(query) {
      if (!index) { pending = query; load(); return; }

      var rows = find(index, query);
      out.textContent = "";

      if (!norm(query)) {
        out.hidden = true; status.hidden = true;
        input.setAttribute("aria-expanded", "false");
        return;
      }
      if (!rows.length) {
        out.hidden = true;
        status.textContent = t("nothing");
        status.hidden = false;
        input.setAttribute("aria-expanded", "false");
        return;
      }

      rows.forEach(function (row) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = href(row);
        a.textContent = row.name;
        var kind = document.createElement("span");
        kind.className = "kind";
        kind.textContent = row.kind === 1 ? t("kind-condition") : t("kind-syndrome");
        a.appendChild(kind);
        li.appendChild(a);
        out.appendChild(li);
      });

      out.hidden = false;
      status.hidden = false;
      status.textContent = t("found").replace("{n}", rows.length);
      input.setAttribute("aria-expanded", "true");
    }

    function close() {
      out.hidden = true; status.hidden = true;
      input.setAttribute("aria-expanded", "false");
    }

    input.addEventListener("input", function () { apply(input.value); });

    /* Enter ведёт на первую строку, а не отправляет форму: формы здесь нет
       именно потому, что она положила бы запрос в адрес. */
    input.addEventListener("keydown", function (e) {
      var first = out.querySelector("a");
      if (e.key === "Escape") { close(); return; }
      if (e.key === "Enter" && first) { e.preventDefault(); window.location.href = first.href; return; }
      if (e.key === "ArrowDown" && first) { e.preventDefault(); first.focus(); }
    });

    out.addEventListener("keydown", function (e) {
      var links = out.querySelectorAll("a");
      var i = Array.prototype.indexOf.call(links, document.activeElement);
      if (e.key === "Escape") { close(); input.focus(); return; }
      if (e.key === "ArrowDown" && i > -1 && links[i + 1]) { e.preventDefault(); links[i + 1].focus(); }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (i > 0) links[i - 1].focus(); else input.focus();
      }
    });

    document.addEventListener("click", function (e) {
      if (!box.contains(e.target)) close();
    });

    slot.hidden = false;
  }

  return { stem: stem, norm: norm, stems: stems, queryStems: queryStems,
           match: match, prepare: prepare, find: find, attach: attach, MAX: MAX };
});
