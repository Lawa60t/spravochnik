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

   Индекс (около сорока килобайт) грузится по первому нажатию клавиши,
   а не при открытии страницы: подавляющее большинство читателей приходят
   по ссылке на статью и ничего не ищут.

   Русского текста здесь нет: все строки приходят из разметки атрибутами,
   чтобы оставаться под линтом формулировок. */
(function () {
  var slot = document.querySelector("[data-poisk-top]");
  if (!slot) return;

  var MAX = 10;              /* больше десяти строк в выпадающем списке не читают */
  var t = function (name) { return slot.getAttribute("data-" + name) || ""; };

  var fallback = slot.querySelector("[data-poisk-fallback]");
  var index = null;          /* массив строк, пока не загружен — null */
  var loading = false;
  var pending = null;        /* что человек успел набрать, пока файл ехал */

  function norm(s) {
    return String(s)
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^0-9a-zа-я]+/g, " ")
      .trim();
  }

  /* --- поле --- */
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

  /* --- индекс --- */
  function load() {
    if (index || loading) return;
    loading = true;
    var el = document.createElement("script");
    el.src = slot.getAttribute("data-index");
    el.onload = function () {
      index = window.EZ_POISK || [];
      var i;
      for (i = 0; i < index.length; i++) {
        index[i].q = norm(index[i][2] + " " + (index[i][3] || ""));
        index[i].qname = norm(index[i][2]);
      }
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

  /* --- поиск --- */
  /* Сначала те, у кого запрос стоит в начале названия: человек, набравший
     «пят», ждёт «Боль в пятке», а не «Перелом пяточной кости» просто потому,
     что тот раньше в алфавите. */
  function find(query) {
    var words = norm(query).split(" ").filter(Boolean);
    if (!words.length) return [];

    var head = [], tail = [], i, w, ok, row;
    for (i = 0; i < index.length; i++) {
      row = index[i];
      ok = true;
      for (w = 0; w < words.length; w++) {
        if (row.q.indexOf(words[w]) === -1) { ok = false; break; }
      }
      if (!ok) continue;
      if (row.qname.indexOf(words[0]) === 0) head.push(row);
      else tail.push(row);
      if (head.length >= MAX && tail.length >= MAX) break;
    }
    return head.concat(tail).slice(0, MAX);
  }

  function href(row) {
    return (row[0] === 1 ? "/sostoyaniya/" : "/razdely/") + row[1] + "/";
  }

  function apply(query) {
    if (!index) { pending = query; load(); return; }

    var rows = find(query);
    out.textContent = "";

    if (!norm(query)) {
      out.hidden = true;
      status.hidden = true;
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
      a.textContent = row[2];
      var kind = document.createElement("span");
      kind.className = "kind";
      kind.textContent = row[0] === 1 ? t("kind-condition") : t("kind-syndrome");
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
    out.hidden = true;
    status.hidden = true;
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
})();
