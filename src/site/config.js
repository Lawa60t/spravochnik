"use strict";
/* Единственное место, где живут внешние данные о сайте.
   Всё, что помечено ЗАПОЛНИТЬ, сборка проверяет и ругается на каждом прогоне. */

const PLACEHOLDER_ORIGIN = "https://example.org";
const PLACEHOLDER_MAIL = "oshibka@example.org";

module.exports = {
  /* ЗАПОЛНИТЬ при выборе домена и хостинга.
     От origin зависят канонические адреса и sitemap.xml — с заглушкой их нельзя публиковать. */
  origin: process.env.SITE_ORIGIN || PLACEHOLDER_ORIGIN,

  /* ЗАПОЛНИТЬ. Кнопка «здесь ошибка» — это mailto, а не форма:
     формы нет не из лени, а потому что поля «опишите вашу ситуацию» быть не должно. */
  errorMail: process.env.SITE_ERROR_MAIL || PLACEHOLDER_MAIL,

  siteName: "Справочник о теле",

  /* ЗАПОЛНИТЬ перед публикацией: аноним, публикующий медицинские тексты,
     выглядит хуже для читателя, для проверяющего и для поисковика. */
  owner: {
    name: "ИП Фамилия Имя Отчество",
    ogrnip: "000000000000000",
    mail: "mail@example.ru"
  },

  PLACEHOLDER_ORIGIN,
  PLACEHOLDER_MAIL
};
