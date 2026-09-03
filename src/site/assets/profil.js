"use strict";
/* Пол и возраст: спрашиваются один раз на входе и применяются на всём сайте.

   ГДЕ ЖИВУТ. sessionStorage текущей вкладки. Это не куки: на сервер ничего
   не уходит, в адресе ничего не появляется, при закрытии вкладки всё стирается.
   Заявление на главной — «обрабатываются в вашем браузере и исчезают, когда вы
   закрываете страницу» — остаётся правдой буквально.

   ЧЕГО ЗДЕСЬ НЕТ. Ни одного вопроса пришедшему из поиска. Человек, открывший
   статью или раздел по прямой ссылке, не отвечал ни на что — значит, фильтра нет
   и он видит всё. Спрятать содержание можно только по его собственному ответу.

   БЕЗ JAVASCRIPT тоже видно всё: фильтрация — надстройка, она убирает лишнее,
   а не добавляет нужное, поэтому её отсутствие ничего не ломает.

   Русского текста здесь нет: строки приходят из разметки. */
(function () {
  var KEY_SEX = "wikitelo.sex";
  var KEY_AGE = "wikitelo.age";

  function read(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try {
      if (value === null || value === undefined) window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, String(value));
    } catch (e) { /* приватный режим — просто работаем без запоминания */ }
  }

  var sex = read(KEY_SEX);
  if (sex !== "m" && sex !== "f") sex = null;

  var ageRaw = read(KEY_AGE);
  var age = ageRaw === null || ageRaw === "" ? undefined : parseInt(ageRaw, 10);
  if (isNaN(age)) age = undefined;

  /* Читают отсюда и остров уточнения, и всё, что появится позже. */
  window.EZ_PROFIL = {
    sex: sex,
    age: age,
    known: sex !== null,
    save: function (nextSex, nextAge) {
      sex = nextSex === "m" || nextSex === "f" ? nextSex : null;
      age = typeof nextAge === "number" && !isNaN(nextAge) ? nextAge : undefined;
      write(KEY_SEX, sex);
      write(KEY_AGE, age === undefined ? null : age);
      window.EZ_PROFIL.sex = sex;
      window.EZ_PROFIL.age = age;
      window.EZ_PROFIL.known = sex !== null;
    }
  };

  /* ---------- фильтр списков ----------
     Статьи с sexOnly другого пола убираются из списков совсем, а не прячутся:
     иначе поиск по указателю, который сам показывает и прячет строки,
     вернул бы их обратно. */
  function applyFilter() {
    if (!sex) return;

    var marked = document.querySelectorAll("[data-sex-only]");
    var i;
    for (i = 0; i < marked.length; i++) {
      var only = marked[i].getAttribute("data-sex-only");
      if (only && only !== sex && marked[i].parentNode) {
        marked[i].parentNode.removeChild(marked[i]);
      }
    }

    /* Заголовок над опустевшим списком читается как поломка. */
    var groups = document.querySelectorAll("[data-group]");
    for (i = 0; i < groups.length; i++) {
      if (!groups[i].querySelector("li")) groups[i].hidden = true;
    }
  }

  applyFilter();

  /* ---------- экран пола и возраста ---------- */
  var screen = document.querySelector("[data-profil]");
  if (!screen) return;

  var entry = document.querySelector("[data-entry]");
  var chosen = sex;
  var sexButtons = screen.querySelectorAll("[data-sex]");
  var ageInput = screen.querySelector("[data-age]");
  var ageUnknown = screen.querySelector("[data-age-unknown]");
  var hint = screen.querySelector("[data-slot='hint']");

  function paint() {
    for (var i = 0; i < sexButtons.length; i++) {
      var on = sexButtons[i].getAttribute("data-sex") === chosen;
      sexButtons[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  if (chosen) paint();
  if (age !== undefined && ageInput) ageInput.value = age;
  if (age === undefined && ageRaw === "" && ageUnknown) ageUnknown.checked = true;

  document.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("[data-sex],[data-act]") : null;
    if (!el) return;

    if (el.hasAttribute("data-sex")) {
      chosen = el.getAttribute("data-sex");
      paint();
      if (hint) hint.hidden = true;
      return;
    }

    var act = el.getAttribute("data-act");

    /* Кнопка входного экрана: без JavaScript это обычная ссылка на список
       областей, со скриптом — переход к вопросу о поле и возрасте. */
    if (act === "profil-open") {
      e.preventDefault();
      if (entry) entry.hidden = true;
      screen.hidden = false;
      screen.scrollIntoView({ block: "start" });
      return;
    }

    if (act === "profil-save") {
      e.preventDefault();
      if (!chosen) {
        if (hint) hint.hidden = false;
        return;
      }
      var value;
      if (ageUnknown && ageUnknown.checked) value = undefined;
      else {
        var n = parseInt(ageInput && ageInput.value, 10);
        value = isNaN(n) ? undefined : Math.max(0, Math.min(120, n));
      }
      window.EZ_PROFIL.save(chosen, value);
      sex = chosen;
      next(el);
    }
  });

  /* Куда идти после ответа — на развилку. Она живёт отдельной страницей,
     а не третьим экраном здесь: экран, который существует только внутри
     скрипта, нельзя ни открыть ссылкой, ни положить в меню. */
  function next(button) {
    window.location.href = button.getAttribute("data-next") || "/vybor/";
  }
})();
