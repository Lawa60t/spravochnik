#!/usr/bin/env node
"use strict";
/* Кадры фигуры для сайта: из полных рендеров (figury/render/*.png, 6000 px
   в высоту) делаются два размера на каждый кадр — высота 1600 (экраны 2×)
   и 800 (1×), PNG с альфа-каналом, ширина пропорционально; передним кадрам
   ещё 320 — для карточки на главной.

   Без единой зависимости: PNG читается и пишется руками через zlib.
   Уменьшение — усреднением по площади (box filter) с предумножением на альфу:
   иначе по контуру фигуры тянется тёмная кайма из прозрачных пикселей.

   Запуск:  node tools/figury-kadry.js            — из figury/render/
            node tools/figury-kadry.js --from DIR — из другой папки (те же имена файлов)
   Выход:   src/site/assets/figury/<кадр>-1600.png, -800.png (и -320.png спереди) */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.join(__dirname, "..");
const FRAMES = ["figura-m-speredi", "figura-m-szadi", "figura-zh-speredi", "figura-zh-szadi"];
/* Передним кадрам нужен ещё третий размер — высота 320: две фигуры рядом
   в карточке «На модели» на главной, чтобы главная не тяжелела. */
const HEIGHTS = [1600, 800];
const HEIGHTS_FRONT = [1600, 800, 320];
const outDir = path.join(root, "src", "site", "assets", "figury");

/* ---------- чтение PNG ---------- */
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function decodePng(buf) {
  if (!buf.slice(0, 8).equals(SIG)) throw new Error("не PNG");
  let p = 8, w, h, depth, ctype, interlace, pal, trns;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("latin1", p + 4, p + 8);
    const data = buf.slice(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9]; interlace = data[12];
    } else if (type === "PLTE") pal = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (interlace) throw new Error("PNG с чересстрочной развёрткой не поддерживается");
  if (![8, 16].includes(depth) && ctype !== 3) throw new Error(`глубина ${depth} бит не поддерживается`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  if (!channels) throw new Error(`тип цвета ${ctype} не поддерживается`);
  const bpp = Math.max(1, (channels * depth) >> 3);
  const stride = Math.ceil((w * channels * depth) / 8);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  const line = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    raw.copy(line, 0, y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = v & 255;
    }
    /* в RGBA8 */
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      let r, g, b, a = 255;
      if (ctype === 3) {
        const idx = depth === 8 ? line[x] : (line[(x * depth) >> 3] >> (8 - depth - ((x * depth) % 8))) & ((1 << depth) - 1);
        r = pal[idx * 3]; g = pal[idx * 3 + 1]; b = pal[idx * 3 + 2];
        if (trns && idx < trns.length) a = trns[idx];
      } else {
        const step = depth >> 3, base = x * channels * step;
        const ch = i => line[base + i * step];
        if (ctype === 0) { r = g = b = ch(0); }
        else if (ctype === 4) { r = g = b = ch(0); a = ch(1); }
        else if (ctype === 2) { r = ch(0); g = ch(1); b = ch(2); }
        else { r = ch(0); g = ch(1); b = ch(2); a = ch(3); }
      }
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = a;
    }
    [prev, ] = [Buffer.from(line), prev];
  }
  return { width: w, height: h, data: px };
}

/* ---------- запись PNG (RGBA8, фильтр подбирается построчно) ---------- */
const crcTable = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng({ width: w, height: h, data }) {
  const stride = w * 4, bpp = 4;
  const out = Buffer.alloc((stride + 1) * h);
  const cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
  for (let y = 0; y < h; y++) {
    const row = data.subarray(y * stride, (y + 1) * stride);
    const up = y ? data.subarray((y - 1) * stride, y * stride) : null;
    const sums = [0, 0, 0, 0, 0];
    for (let i = 0; i < stride; i++) {
      const x = row[i], a = i >= bpp ? row[i - bpp] : 0, b = up ? up[i] : 0, c = up && i >= bpp ? up[i - bpp] : 0;
      const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
      const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const v = [x, (x - a) & 255, (x - b) & 255, (x - ((a + b) >> 1)) & 255, (x - pr) & 255];
      for (let f = 0; f < 5; f++) { cand[f][i] = v[f]; sums[f] += v[f] < 128 ? v[f] : 256 - v[f]; }
    }
    let best = 0; for (let f = 1; f < 5; f++) if (sums[f] < sums[best]) best = f;
    out[y * (stride + 1)] = best;
    cand[best].copy(out, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(out, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------- уменьшение усреднением по площади ----------
   Разделимо: сначала по горизонтали, потом по вертикали. Каждый целевой
   пиксель — среднее исходных с весами по доле перекрытия. Цвет усредняется
   предумноженным на альфу и делится обратно на итоговую альфу. */
function weights(srcN, dstN) {
  const scale = srcN / dstN, res = [];
  for (let i = 0; i < dstN; i++) {
    const a = i * scale, b = (i + 1) * scale, ws = [];
    for (let s = Math.floor(a); s < Math.min(Math.ceil(b), srcN); s++) {
      const wgt = Math.min(b, s + 1) - Math.max(a, s);
      if (wgt > 1e-9) ws.push([s, wgt / scale]);
    }
    res.push(ws);
  }
  return res;
}

function resize(img, dstW, dstH) {
  const { width: sw, height: sh, data } = img;
  /* предумножение, float */
  const pre = new Float32Array(sw * sh * 4);
  for (let i = 0, n = sw * sh; i < n; i++) {
    const a = data[i * 4 + 3] / 255;
    pre[i * 4] = data[i * 4] * a; pre[i * 4 + 1] = data[i * 4 + 1] * a; pre[i * 4 + 2] = data[i * 4 + 2] * a; pre[i * 4 + 3] = a;
  }
  const wx = weights(sw, dstW), wy = weights(sh, dstH);
  const tmp = new Float32Array(dstW * sh * 4);
  for (let y = 0; y < sh; y++) for (let x = 0; x < dstW; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (const [s, wgt] of wx[x]) { const o = (y * sw + s) * 4; r += pre[o] * wgt; g += pre[o + 1] * wgt; b += pre[o + 2] * wgt; a += pre[o + 3] * wgt; }
    const o = (y * dstW + x) * 4; tmp[o] = r; tmp[o + 1] = g; tmp[o + 2] = b; tmp[o + 3] = a;
  }
  const out = Buffer.alloc(dstW * dstH * 4);
  for (let y = 0; y < dstH; y++) for (let x = 0; x < dstW; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (const [s, wgt] of wy[y]) { const o = (s * dstW + x) * 4; r += tmp[o] * wgt; g += tmp[o + 1] * wgt; b += tmp[o + 2] * wgt; a += tmp[o + 3] * wgt; }
    const o = (y * dstW + x) * 4;
    if (a > 1e-6) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
    out[o + 3] = Math.round(Math.min(1, a) * 255);
  }
  return { width: dstW, height: dstH, data: out };
}

function main() {
  const i = process.argv.indexOf("--from");
  const from = i > 0 ? path.resolve(process.argv[i + 1]) : path.join(root, "figury", "render");
  const anatomy = JSON.parse(fs.readFileSync(path.join(root, "data", "anatomy.json"), "utf8"));
  fs.mkdirSync(outDir, { recursive: true });
  const L = "─".repeat(58);
  console.log(L); console.log("КАДРЫ ФИГУРЫ"); console.log(L);
  const missing = FRAMES.filter(f => !fs.existsSync(path.join(from, f + ".png")));
  if (missing.length) { console.error(`Нет кадров в ${from}: ${missing.join(", ")}`); process.exit(1); }
  FRAMES.forEach(name => {
    const src = decodePng(fs.readFileSync(path.join(from, name + ".png")));
    const fr = anatomy.calibration.frames[name];
    const note = fr && (fr.width !== src.width || fr.height !== src.height)
      ? `  ! исходник ${src.width}×${src.height}, а калибровка ждёт ${fr.width}×${fr.height} — пропорции ${(src.width / src.height).toFixed(4)} против ${(fr.width / fr.height).toFixed(4)}`
      : "";
    (name.endsWith("-speredi") ? HEIGHTS_FRONT : HEIGHTS).forEach(hh => {
      const ww = Math.round(src.width * hh / src.height);
      const png = encodePng(resize(src, ww, hh));
      const file = path.join(outDir, `${name}-${hh}.png`);
      fs.writeFileSync(file, png);
      console.log(`${name}-${hh}.png`.padEnd(30) + `${ww}×${hh}`.padEnd(12) + `${(png.length / 1024).toFixed(0)} КБ`);
    });
    if (note) console.log(note);
  });
  console.log(L);
}

module.exports = { decodePng, encodePng, resize };
if (require.main === module) main();
