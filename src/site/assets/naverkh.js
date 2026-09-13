"use strict";
/* Кнопка «Наверх». Без JavaScript её нет вовсе — в разметке она стоит
   с атрибутом hidden: без скрипта она торчала бы и на первом экране,
   где наверх идти некуда. Скрипт показывает её, когда человек ушёл вниз
   больше чем на полтора экрана, и убирает, когда вернулся.

   Нужна прежде всего на указателе: список длинный, а шапка с поиском
   остаётся наверху. Прилипающую шапку владелец обсуждал и отклонил:
   на телефоне она заняла бы четверть экрана на каждой странице. */
(function () {
  var btn = document.querySelector("[data-totop]");
  if (!btn) return;

  var shown = false;
  function check() {
    var need = window.scrollY > window.innerHeight * 1.5;
    if (need === shown) return;
    shown = need;
    btn.hidden = !need;
  }
  window.addEventListener("scroll", check, { passive: true });
  window.addEventListener("resize", check);
  check();

  btn.addEventListener("click", function (e) {
    e.preventDefault();
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    /* Фокус — в начало страницы, чтобы клавиатура и программа чтения
       с экрана не остались внизу, откуда человек только что ушёл. */
    var top = document.getElementById("top");
    if (top) {
      top.setAttribute("tabindex", "-1");
      top.focus({ preventScroll: true });
    }
  });
})();
