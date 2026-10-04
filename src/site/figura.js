"use strict";
/* Фигура тела: геометрия наложения участков на кадры рендеров.

   Кадры — четыре PNG из figury/render (мужская и женская фигура, спереди
   и сзади). Числа калибровки каждого кадра лежат в data/anatomy.json →
   calibration.frames; участки берутся из слоя якорей через
   subzonesForSilhouette(), руками здесь ничего не рисуется.

   Формула прежняя (CLAUDE.md, «Слой якорей»):
     X = axisX + (u' − 0.5) · 2 · halfWidth ;  Y = crownY + v · (soleY − crownY)
   u — координата ТЕЛА: вид сзади u' = u, вид спереди u' = 1 − u, поэтому
   правое подреберье на виде спереди оказывается слева на экране.
   mirrorPair у рук и ног: описана одна конечность, вторая — отражение u → 1 − u
   в координатах тела, до преобразования вида.

   Всё отдаётся долями кадра (0…1): разметка не зависит от размера картинки. */
const D = require("./data");

const KADRY = [
  { sex: "m", view: "front", frame: "figura-m-speredi" },
  { sex: "m", view: "back", frame: "figura-m-szadi" },
  { sex: "f", view: "front", frame: "figura-zh-speredi" },
  { sex: "f", view: "back", frame: "figura-zh-szadi" }
];

function frameOf(name) {
  const f = (D.anatomy.calibration.frames || {})[name];
  if (!f) throw new Error(`anatomy.json: нет калибровки кадра ${name}`);
  return f;
}

/* Прямоугольник бокса в долях кадра. */
function rect(box, fr, view) {
  const X = u => (fr.axisX + ((view === "front" ? 1 - u : u) - 0.5) * 2 * fr.halfWidth) / fr.width;
  const Y = v => (fr.crownY + v * (fr.soleY - fr.crownY)) / fr.height;
  const xs = [X(box.u0), X(box.u1)].sort((a, b) => a - b);
  return { x0: xs[0], x1: xs[1], y0: Y(box.v0), y1: Y(box.v1) };
}

const mirrorBox = b => ({ u0: 1 - b.u1, u1: 1 - b.u0, v0: b.v0, v1: b.v1 });

/* Зоны слоя якорей, у которых есть бокс на этом виде, — выводятся из тех же
   пар «зона — участок», по которым сборка считает достижимость разделов. */
function zonesOnView(view) {
  const seen = new Map();
  D.subzonesForSilhouette().forEach(({ zone }) => {
    if (zone.view === view && zone.box && !seen.has(zone.id)) seen.set(zone.id, zone);
  });
  return [...seen.values()];
}

/* Все боксы кадра: зоны и участки, с отражёнными копиями. Для служебной
   страницы наложения и для проверки против эталона figury/nalozhenie. */
function boxesOf(kadr) {
  const fr = frameOf(kadr.frame);
  const out = [];
  zonesOnView(kadr.view).forEach(zone => {
    const copies = zone.mirrorPair ? [[zone.box, false], [mirrorBox(zone.box), true]] : [[zone.box, false]];
    copies.forEach(([b, mirrored]) => {
      out.push({ id: zone.id, label: zone.label, kind: "zone", mirrored, ...rect(b, fr, kadr.view) });
      (zone.subzones || []).forEach(sz => {
        if (!sz.box) return;
        const sb = mirrored ? mirrorBox(sz.box) : sz.box;
        out.push({ id: sz.id, label: sz.name || sz.label, kind: "subzone", mirrored, side: sz.side, ...rect(sb, fr, kadr.view) });
      });
    });
  });
  return out;
}

/* Кликабельные области страницы /vybor/: зоны слоя якорей, каждая ведёт на
   страницу своей области оглавления, к группе этой зоны. Участки мельче —
   на телефоне из 51 участка в 44×44 точки укладываются три, — поэтому они
   остаются на странице области списком, где у каждого свои разделы. */
function hotspots(kadr) {
  return boxesOf(kadr)
    .filter(b => b.kind === "zone")
    .map(b => ({
      ...b,
      href: `${D.zonePath(b.id.split(".")[0])}#${D.slug(b.id)}`
    }));
}

module.exports = { KADRY, frameOf, rect, boxesOf, hotspots, zonesOnView };
