"use strict";
/* Поиск по указателю — надстройка над готовой страницей.

   Ничего не грузит: все 460 с лишним строк уже отрисованы в HTML,
   скрипт только прячет лишние. Поэтому нет ни индекса, ни второго запроса.

   Ничего не сохраняет и ничего не пишет в адрес: ни ?q=, ни localStorage.
   Запрос вроде «кровь в стуле» не должен попадать ни в историю браузера,
   ни в логи хостинга — на главной напечатано, что мы ничего не собираем.

   Русского текста здесь нет намеренно: все строки приходят из разметки
   атрибутами, чтобы они оставались под линтом формулировок.

   Слова сравниваются по основам — тем же разбором, что и поиск в шапке
   (window.EZP из poisk.js, он на странице уже есть и стоит раньше). Иначе
   получалось бы, что одна и та же строка «болит горло» в шапке находит
   раздел, а в указателе — ничего. Если по какой-то причине разбора нет,
   остаётся прежнее сравнение подстрок: указатель обязан работать всегда. */
(function () {
  var slot = document.querySelector("[data-poisk]");
  if (!slot) return;

  var lists = document.querySelectorAll("ul.index");
  if (!lists.length) return;

  /* ё и е — одна буква для поиска, регистр не важен, знаки препинания не мешают */
  function norm(s) {
    return s
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^0-9a-zа-я]+/g, " ")
      .trim();
  }

  var EZP = (typeof window !== "undefined" && window.EZP) || null;

  /* Пункты указателя с заранее посчитанным текстом. */
  var items = [];
  var i, j, li, nodes;
  for (i = 0; i < lists.length; i++) {
    nodes = lists[i].getElementsByTagName("li");
    for (j = 0; j < nodes.length; j++) {
      li = nodes[j];
      var txt = norm(li.textContent || "");
      items.push({ el: li, text: txt, stems: EZP ? EZP.stems(txt) : null });
    }
  }
  var letters = document.querySelectorAll(".letter");

  /* --- разметка поля --- */
  var label = document.createElement("label");
  label.className = "poisk-label";
  label.setAttribute("for", "poisk-input");
  label.textContent = slot.getAttribute("data-label") || "";

  var input = document.createElement("input");
  input.type = "search";
  input.id = "poisk-input";
  input.className = "poisk-input";
  input.autocomplete = "off";
  input.setAttribute("placeholder", slot.getAttribute("data-placeholder") || "");

  var status = document.createElement("p");
  status.className = "poisk-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  /* Блок «ничего не нашлось» лежит в разметке скрытым: в нём ссылка,
     а ссылку из атрибута не собрать. Без JavaScript он просто не показывается. */
  var empty = slot.querySelector("[data-poisk-empty]");

  slot.insertBefore(status, empty || null);
  slot.insertBefore(input, status);
  slot.insertBefore(label, input);

  var foundTpl = slot.getAttribute("data-found") || "{n}";
  var nothing = slot.getAttribute("data-nothing") || "";

  /* Подходит ли пункт под одно слово запроса. */
  function fits(item, word) {
    if (!EZP || !item.stems) return item.text.indexOf(word.raw) > -1;
    for (var i = 0; i < item.stems.length; i++) {
      if (EZP.match(word.s, item.stems[i])) return true;
      /* последнее слово человек ещё дописывает */
      if (word.last && item.stems[i].indexOf(word.raw) === 0) return true;
    }
    return false;
  }

  function apply(query) {
    var words;
    if (EZP) {
      words = EZP.queryStems(query);
    } else {
      words = norm(query).split(" ").filter(Boolean).map(function (x, i, a) {
        return { s: x, raw: x, last: i === a.length - 1 };
      });
    }
    var shown = 0;
    var k, w, ok;

    for (k = 0; k < items.length; k++) {
      ok = true;
      for (w = 0; w < words.length; w++) {
        if (!fits(items[k], words[w])) { ok = false; break; }
      }
      items[k].el.hidden = !ok;
      if (ok) shown++;
    }

    /* буква без единого пункта только мешает читать */
    for (k = 0; k < letters.length; k++) {
      var vis = letters[k].querySelectorAll("li:not([hidden])").length;
      letters[k].hidden = vis === 0;
    }

    if (!words.length) {
      status.textContent = "";
      if (empty) empty.hidden = true;
      return;
    }
    status.textContent = shown ? foundTpl.replace("{n}", shown) : nothing;
    if (empty) empty.hidden = shown !== 0;
  }

  input.addEventListener("input", function () { apply(input.value); });
  slot.hidden = false;
})();
