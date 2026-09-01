"use strict";
/* Поиск по указателю — надстройка над готовой страницей.

   Ничего не грузит: все 460 с лишним строк уже отрисованы в HTML,
   скрипт только прячет лишние. Поэтому нет ни индекса, ни второго запроса.

   Ничего не сохраняет и ничего не пишет в адрес: ни ?q=, ни localStorage.
   Запрос вроде «кровь в стуле» не должен попадать ни в историю браузера,
   ни в логи хостинга — на главной напечатано, что мы ничего не собираем.

   Русского текста здесь нет намеренно: все строки приходят из разметки
   атрибутами, чтобы они оставались под линтом формулировок. */
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

  /* Пункты указателя с заранее посчитанным текстом. */
  var items = [];
  var i, j, li, nodes;
  for (i = 0; i < lists.length; i++) {
    nodes = lists[i].getElementsByTagName("li");
    for (j = 0; j < nodes.length; j++) {
      li = nodes[j];
      items.push({ el: li, text: norm(li.textContent || "") });
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

  function apply(query) {
    var words = norm(query).split(" ").filter(Boolean);
    var shown = 0;
    var k, w, ok;

    for (k = 0; k < items.length; k++) {
      ok = true;
      for (w = 0; w < words.length; w++) {
        if (items[k].text.indexOf(words[w]) === -1) { ok = false; break; }
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
