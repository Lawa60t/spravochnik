"use strict";
/* Чтение замороженной базы. Единственное место, где движок касается диска.

   В браузере этого файла нет: там данные нужного раздела кладёт сборка
   в EZ_DATA до загрузки engine.js. Больше движок про источник ничего не знает,
   поэтому на сайте работает ровно тот код, который прогоняют тесты. */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "data");
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const files = fs.readdirSync(dir);

module.exports = {
  questions: read("questions.json").questions,
  /* Решение интерфейса, а не база: см. комментарий в самом файле. */
  sexQuestions: require("./questions-sex.json"),
  redflags: read("redflags.json"),
  conditions: files.filter(f => f.startsWith("conditions-")).flatMap(f => read(f).conditions),
  syndromes: files
    .filter(f => f.startsWith("syndromes-") && f !== "syndromes-map.json")
    .flatMap(f => read(f).syndromes),

  /* Тестовые случаи нужны только прогону, поэтому читаются по требованию. */
  vignettes: () => files.filter(f => f.startsWith("vignettes-")).flatMap(f => read(f).cases)
};
