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

/* Зоны страницы /vybor/ по боксам: каждая ведёт на страницу своей области
   оглавления, к группе этой зоны. Участки мельче — на телефоне из 51 участка
   в 44×44 точки укладываются три, — поэтому они остаются на странице области
   списком, где у каждого свои разделы. Сами области нажатия и подсветка
   на кадре теперь строятся по контурам (contoursOf ниже); боксы остаются
   для участков, служебной страницы и check-anatomy. */
function hotspots(kadr) {
  return boxesOf(kadr)
    .filter(b => b.kind === "zone")
    .map(b => ({
      ...b,
      href: `${D.zonePath(b.id.split(".")[0])}#${D.slug(b.id)}`
    }));
}

/* ---------- контуры зон ----------
   У зон есть polygon — опорные точки контура [u, v] в долях кадра по
   анатомическим линиям (ключицы, рёберная дуга, паховые складки…).
   Контур рисуется не ломаной, а гладкой кривой: замкнутый сплайн
   Катмулла–Рома, равномерный, натяжение 0,5, по 10 отрезков на сегмент.
   По нему строятся и подсветка-«прожектор», и обводка, и область нажатия. */
function splineClosed(P, segs = 10) {
  const n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let k = 0; k < segs; k++) {
      const t = k / segs, t2 = t * t, t3 = t2 * t;
      const at = j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
      out.push([at(0), at(1)]);
    }
  }
  return out;
}

/* Центроид многоугольника (по площади) — туда ставится подпись зоны. */
function centroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  a *= 0.5;
  return a ? [cx / (6 * a), cy / (6 * a)] : [0.5, 0.5];
}

const r4 = v => +v.toFixed(4);

/* Контуры зон кадра в долях кадра по экрану (0…1): вид спереди u' = 1 − u,
   mirrorPair даёт вторую копию отражением u → 1 − u в координатах тела.
   Каждая копия — свой путь: ссылка на область, подпись, центроид подписи. */
function contoursOf(kadr) {
  const out = [];
  zonesOnView(kadr.view).forEach(zone => {
    if (!zone.polygon) return;
    const copies = zone.mirrorPair ? [[zone.polygon, false], [zone.polygon.map(([u, v]) => [1 - u, v]), true]] : [[zone.polygon, false]];
    copies.forEach(([poly, mirrored]) => {
      const pts = splineClosed(poly).map(([u, v]) => [r4(kadr.view === "front" ? 1 - u : u), r4(v)]);
      const [cx, cy] = centroid(pts);
      out.push({
        id: zone.id, label: zone.label, mirrored,
        key: `${kadr.sex}-${kadr.view}-${D.slug(zone.id)}`,
        href: `${D.zonePath(zone.id.split(".")[0])}#${D.slug(zone.id)}`,
        points: pts, cx: r4(cx), cy: r4(cy),
        /* путь в единичном квадрате: годится и для clipPath с
           clipPathUnits="objectBoundingBox", и для обводки в viewBox 0 0 1 1 */
        path: "M" + pts.map(([x, y]) => `${x} ${y}`).join("L") + "Z"
      });
    });
  });
  return out;
}

module.exports = { KADRY, frameOf, rect, boxesOf, hotspots, zonesOnView, splineClosed, centroid, contoursOf };
