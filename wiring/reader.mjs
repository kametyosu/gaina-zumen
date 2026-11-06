import { glyphComponents, digitFromTopology, strokeDigit } from "./glyphs.mjs";
import { buildRoutes, traceTerminal } from "./topology.mjs";
import { createWorker, OEM, PSM } from "tesseract.js";
import { vectorGeometry } from "./geometry.mjs";
let worker, progressCallback;
const cache = /* @__PURE__ */ new WeakMap();
async function ocr(canvas, psm = PSM.SPARSE_TEXT, whitelist = "") {
  worker ??= await createWorker("eng", OEM.LSTM_ONLY, { workerPath: new URL("./ocr/worker.min.js", import.meta.url).href, corePath: new URL("./ocr/", import.meta.url).href, langPath: new URL("./ocr/", import.meta.url).href, workerBlobURL: false, cacheMethod: "none", gzip: true, logger: (m) => progressCallback?.(m) });
  await worker.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: whitelist, preserve_interword_spaces: "1" });
  const { data } = await worker.recognize(canvas, {}, { blocks: true });
  const words = (data.blocks || []).flatMap((b) => b.paragraphs || []).flatMap((p) => p.lines || []).flatMap((l) => l.words || []);
  return { text: data.text, words: words.map((w) => ({ text: w.text.trim().toUpperCase(), box: w.bbox, confidence: w.confidence, symbols: w.symbols || [] })) };
}
async function pageGeometry(page) {
  if (cache.has(page)) return cache.get(page);
  const g = vectorGeometry(await page.getOperatorList(), page.getViewport({ scale: 1 }));
  cache.set(page, g);
  return g;
}
async function scanPages(pdf, onProgress) {
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    onProgress?.(n, pdf.numPages);
    const p = await pdf.getPage(n), g = await pageGeometry(p);
    const symbols = g.circles.filter((c) => c.width >= 7 && c.width <= 16 && c.height >= 7);
    const repeated = g.devices.filter((d) => d.ports.length >= 2 && d.width < 200 && d.height < 200);
    pages.push({ number: n, count: repeated.length + symbols.length, ports: repeated.reduce((n2, d) => n2 + d.ports.length, 0) + symbols.length * 2, score: Math.max(0, ...repeated.map((d) => repeated.filter((b) => Math.abs(d.width - b.width) < 1 && Math.abs(d.height - b.height) < 1).length)) * 100 + repeated.length });
  }
  return pages;
}
async function renderRegion(page, r, scale = 12, skipOp) {
  const vp = page.getViewport({ scale }), c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(r.width * scale));
  c.height = Math.max(1, Math.ceil(r.height * scale));
  if (c.width * c.height > 14e6) throw Error("読み取り範囲が大きすぎます");
  await page.render({ canvasContext: c.getContext("2d"), viewport: vp, transform: [1, 0, 0, 1, -r.x * scale, -r.y * scale], operationsFilter: skipOp === void 0 ? void 0 : (i) => i !== skipOp }).promise;
  return c;
}
function cropImage(src, r, rotation = 0, removeLines = false) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(r.width));
  c.height = Math.max(1, Math.ceil(r.height));
  const x = c.getContext("2d", { willReadFrequently: true });
  x.fillStyle = "white";
  x.fillRect(0, 0, c.width, c.height);
  x.drawImage(src, r.x, r.y, r.width, r.height, 0, 0, c.width, c.height);
  if (removeLines) {
    const im = x.getImageData(0, 0, c.width, c.height), a = im.data;
    const ink = (i) => Math.max(a[i], a[i + 1], a[i + 2]) < 200 && Math.max(a[i], a[i + 1], a[i + 2]) - Math.min(a[i], a[i + 1], a[i + 2]) < 40;
    const erase = [];
    for (let xx = 0; xx < c.width; xx++) {
      let start = -1;
      for (let y = 0; y <= c.height; y++) {
        const black = y < c.height && ink((y * c.width + xx) * 4);
        if (black && start < 0) start = y;
        if (!black && start >= 0) {
          if (y - start > 45) erase.push([xx, start, xx, y]);
          start = -1;
        }
      }
    }
    for (let yy = 0; yy < c.height; yy++) {
      let start = -1;
      for (let xx = 0; xx <= c.width; xx++) {
        const black = xx < c.width && ink((yy * c.width + xx) * 4);
        if (black && start < 0) start = xx;
        if (!black && start >= 0) {
          if (xx - start > 90) erase.push([start, yy, xx, yy]);
          start = -1;
        }
      }
    }
    x.strokeStyle = "white";
    x.lineWidth = 2;
    for (const [a2, b, d, e] of erase) {
      x.beginPath();
      x.moveTo(a2, b);
      x.lineTo(d, e);
      x.stroke();
    }
  }
  if (!rotation) return c;
  const out = document.createElement("canvas");
  out.width = c.height;
  out.height = c.width;
  const z = out.getContext("2d");
  z.translate(out.width / 2, out.height / 2);
  z.rotate(rotation * Math.PI / 180);
  z.drawImage(c, -c.width / 2, -c.height / 2);
  return out;
}
function toPageWords(words, rect, scale, rotation) {
  return words.map((w) => {
    const b = w.box;
    const coords = rotation === 90 ? { x0: b.y0, y0: rect.height * scale - b.x1, x1: b.y1, y1: rect.height * scale - b.x0 } : b;
    return { ...w, text: w.text.replace(/[\[\](){}|]/g, ""), box: { x0: rect.x + coords.x0 / scale, y0: rect.y + coords.y0 / scale, x1: rect.x + coords.x1 / scale, y1: rect.y + coords.y1 / scale } };
  });
}
async function readDigits(image, region, ports, scale) {
  const out = [];
  for (const p of ports) {
    const r = { x: (p.x - region.x - p.r * 0.58) * scale, y: (p.y - region.y - p.r * 0.72) * scale, width: p.r * 1.16 * scale, height: p.r * 1.44 * scale };
    const c = cropImage(image, r);
    const padded = document.createElement("canvas");
    padded.width = c.width + 24;
    padded.height = c.height + 24;
    const ctx = padded.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, padded.width, padded.height);
    ctx.drawImage(c, 12, 12);
    const result = await ocr(padded, PSM.SINGLE_CHAR, "0123456789");
    const t = result.text.trim();
    out.push(/^\d{1,2}$/.test(t) ? t : null);
  }
  return out;
}
async function readPortLabel(image, region, p, geo, scale) {
  if (!["top", "bottom"].includes(p.side)) return null;
  const dir = p.side === "top" ? -1 : 1;
  const outer = geo.circles.filter((c2) => Math.abs(c2.x - p.x) < 0.7 && (c2.y - p.y) * dir > p.r * 2 && (c2.y - p.y) * dir < 36).sort((a, b) => Math.abs(a.y - p.y) - Math.abs(b.y - p.y))[0];
  if (!outer) return null;
  const edge = outer.y + dir * (outer.r + 0.25), end = edge + dir * 13;
  const r = { x: p.x - 3.4, y: Math.min(edge, end), width: 3.15, height: 13 };
  if (r.x < region.x || r.y < region.y || r.y + r.height > region.y + region.height) return null;
  const c = cropImage(image, { x: (r.x - region.x) * scale, y: (r.y - region.y) * scale, width: r.width * scale, height: r.height * scale }, 90);
  const result = await ocr(c, PSM.SINGLE_LINE, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
  const text = result.text.trim().replace(/\s/g, "");
  return /^(?:[A-Z]{1,5}[0-9][A-Z0-9]*|\d{2,4})$/.test(text) ? { text, box: { x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height }, confidence: result.words[0]?.confidence || 0 } : null;
}
function verifiedStraight(geo, p) {
  const vertical = ["top", "bottom"].includes(p.side), dir = ["top", "left"].includes(p.side) ? -1 : 1;
  const a = vertical ? p.y : p.x, k = vertical ? p.x : p.y;
  const terminal = geo.circles.filter((c) => c.width < 7 && Math.abs((vertical ? c.x : c.y) - k) < 0.4 && ((vertical ? c.y : c.x) - a) * dir > p.r * 2 && Math.abs((vertical ? c.y : c.x) - a) < 38).sort((u, v) => Math.abs((vertical ? u.y : u.x) - a) - Math.abs((vertical ? v.y : v.x) - a))[0];
  if (!terminal) return null;
  const start = a + dir * p.r, end = (vertical ? terminal.y : terminal.x) - dir * terminal.r, lo = Math.min(start, end), hi = Math.max(start, end);
  const segments = geo.lines.filter((l) => Math.abs((vertical ? l.a.x : l.a.y) - k) < 0.3 && Math.abs((vertical ? l.b.x : l.b.y) - k) < 0.3).map((l) => ({ lo: Math.min(vertical ? l.a.y : l.a.x, vertical ? l.b.y : l.b.x), hi: Math.max(vertical ? l.a.y : l.a.x, vertical ? l.b.y : l.b.x) })).filter((l) => l.hi >= lo - 0.3 && l.lo <= hi + 0.3).sort((a2, b) => a2.lo - b.lo);
  let cursor = lo;
  for (const s of segments) {
    if (s.lo > cursor + 2.05) break;
    cursor = Math.max(cursor, s.hi);
  }
  return cursor >= hi - 0.4 ? segments : null;
}
async function readRectPage(pdf, number, drawing, onProgress, signal) {
  const page = await pdf.getPage(number), geo = await pageGeometry(page), vp = page.getViewport({ scale: 1 }), results = [];
  const content = await page.getTextContent();
  const embedded = content.items.filter((t) => /^(?:[A-Z]{1,5}[0-9][A-Z0-9]*|\d{2,4})$/.test(t.str.trim())).map((t) => {
    const m = t.transform, v = vp.transform, x = v[0] * m[4] + v[2] * m[5] + v[4], y = v[1] * m[4] + v[3] * m[5] + v[5], vertical = Math.abs(m[1]) > Math.abs(m[0]);
    return { text: t.str.trim(), box: vertical ? { x0: x - t.height, y0: y - t.width, x1: x, y1: y } : { x0: x, y0: y - t.height, x1: x + t.width, y1: y }, source: "PDF文字" };
  });
  const devices = geo.devices.filter((d) => d.width < 200 && d.height < 200);
  for (let index = 0; index < devices.length; index++) {
    if (signal?.aborted) throw new DOMException("読み取りを中止しました", "AbortError");
    onProgress?.({ page: number, index: index + 1, total: devices.length, message: "機器と端子を読み取っています" });
    const d = devices[index], scale = 14, region = { x: Math.max(0, d.x - 5), y: Math.max(0, d.y - 38), width: Math.min(d.width + 10, vp.width - d.x + 5), height: Math.min(d.height + 83, vp.height - d.y + 38) };
    const image = await renderRegion(page, region, scale), bodyRect = { x: (d.x - region.x) * scale, y: (d.y - region.y) * scale, width: d.width * scale, height: d.height * scale }, body = await ocr(cropImage(image, bodyRect));
    let id = body.text.match(/\[\s*([A-Z]{1,8}\s*-\s*\d+[A-Z0-9-]*)\s*\]/i)?.[1]?.replace(/\s+/g, "");
    if (!id) {
      const tag = body.words.find((w) => /^(?:GA|FLS|PS|RY|PLC|SV|MV|LS|TB|DPS)[-]?\d+[A-Z0-9-]*$/.test(w.text.replace(/[\[\]()]/g, "")));
      id = tag?.text.replace(/[\[\]()]/g, "") || null;
    }
    const bodyWords = toPageWords(body.words, { x: d.x, y: d.y, width: d.width, height: d.height }, scale, 0), banks = bodyWords.filter((w) => /^(?:TN[A-Z0-9]+|TB\d+|CN\d+)$/.test(w.text.replace(/[()]/g, ""))).map((w) => ({ ...w, text: w.text.replace(/[()]/g, "") }));
    const digits = await readDigits(image, region, d.ports, scale), sideWords = {};
    for (const side of [...new Set(d.ports.map((p) => p.side))]) {
      let r;
      if (side === "top") r = { x: d.x - 2, y: Math.max(region.y, d.y - 30), width: d.width + 4, height: 29 };
      else if (side === "bottom") r = { x: d.x - 2, y: d.y + d.height + 1, width: d.width + 4, height: 34 };
      else if (side === "left") r = { x: Math.max(region.x, d.x - 30), y: d.y, width: 29, height: d.height };
      else r = { x: d.x + d.width + 1, y: d.y, width: 29, height: d.height };
      r.x = Math.max(region.x, r.x);
      r.y = Math.max(region.y, r.y);
      r.width = Math.min(r.width, region.x + region.width - r.x);
      r.height = Math.min(r.height, region.y + region.height - r.y);
      if (r.width <= 0 || r.height <= 0) {
        sideWords[side] = [];
        continue;
      }
      const rotated = side === "top" || side === "bottom" ? 90 : 0, crop = cropImage(image, { x: (r.x - region.x) * scale, y: (r.y - region.y) * scale, width: r.width * scale, height: r.height * scale }, rotated, true);
      const read = await ocr(crop);
      sideWords[side] = toPageWords(read.words, r, scale, rotated);
    }
    const assigned = /* @__PURE__ */ new Map();
    for (const side of Object.keys(sideWords)) {
      const ps = d.ports.filter((p) => p.side === side);
      const ws = sideWords[side].filter((w) => /^(?:[A-Z]{1,5}[0-9][A-Z0-9]*|\d{2,4})$/.test(w.text) && !/^ALM|^TN/.test(w.text));
      const used = /* @__PURE__ */ new Set();
      for (const p of ps) {
        const candidates = ws.filter((w) => !used.has(w)).map((w) => ({ w, gap: side === "top" || side === "bottom" ? p.x - w.box.x1 : p.y - w.box.y1 })).filter((v) => v.gap > -0.5 && v.gap < 3).sort((a, b) => Math.abs(a.gap - 0.5) - Math.abs(b.gap - 0.5));
        if (candidates[0]) {
          assigned.set(p, candidates[0].w);
          used.add(candidates[0].w);
        }
      }
    }
    const direct = /* @__PURE__ */ new Map();
    for (const p of d.ports) {
      const label = await readPortLabel(image, region, p, geo, scale);
      if (label) direct.set(p, label);
    }
    const ports = d.ports.map((p, n) => {
      const textHit = embedded.filter((w) => p.side === "top" ? w.box.y1 < d.y && w.box.y1 > d.y - 36 : p.side === "bottom" ? w.box.y0 > d.y + d.height && w.box.y0 < d.y + d.height + 38 : false).map((w) => ({ w, cross: Math.abs(w.box.x1 - p.x) })).filter((v) => v.cross < 3.5).sort((a, b) => a.cross - b.cross)[0]?.w;
      const path = verifiedStraight(geo, p);
      const hit = path ? textHit || assigned.get(p) || direct.get(p) : null, bank = banks.filter((b) => p.side === "top" ? b.box.y0 < d.y + d.height * 0.4 : p.side === "bottom" ? b.box.y0 > d.y + d.height * 0.55 : true).map((b) => ({ b, dist: Math.hypot((b.box.x0 + b.box.x1) / 2 - p.x, (b.box.y0 + b.box.y1) / 2 - p.y) })).sort((a, b) => a.dist - b.dist)[0];
      const bankText = bank && bank.dist < Math.max(d.width, d.height) * 0.65 ? bank.b.text : "";
      const terminal = digits[n] ? (bankText ? bankText + ":" : { top: "上端", bottom: "下端", left: "左端", right: "右端" }[p.side] + ":") + digits[n] : "";
      return { id: "p" + number + "-d" + index + "-c" + n, order: n + 1, wire: hit?.text || "", terminal, rawPin: digits[n] || "", bank: bankText, color: "", side: p.side, point: { x: p.x / vp.width, y: p.y / vp.height }, wireEvidence: hit ? { text: hit.text, bbox: hit.box } : null, evidence: hit ? { rect: { x: hit.box.x0 / vp.width, y: hit.box.y0 / vp.height, width: (hit.box.x1 - hit.box.x0) / vp.width, height: (hit.box.y1 - hit.box.y0) / vp.height } } : {}, path: path || [], method: "機器端子→同一直線の端子円→線番", confirmed: false };
    });
    results.push({ id: "p" + number + "-d" + index, number: results.length + 1, device: id || "機器名を確認", model: body.text.match(/\b[A-Z]{1,5}-\d{2,6}\b/g)?.filter((s) => s !== id)?.[0] || "", cable: "", mark: "", counterparty: "", page: number, drawing, rect: { x: d.x / vp.width, y: d.y / vp.height, width: d.width / vp.width, height: d.height / vp.height }, cores: ports, bodyOcr: body.text, source: "図面の機器枠・端子円・近接線番から自動生成", confirmed: false });
    await new Promise((r) => setTimeout(r, 0));
  }
  return results;
}
async function symbolText(page, symbol) {
  const r = symbol.r, outputs = [], raw = [];
  for (const [part, a, b] of [["top", -0.82, -0.12], ["bottom", 0.1, 0.78]]) {
    const rect = { x: symbol.x - r * 0.84, y: symbol.y + r * a, width: r * 1.68, height: r * (b - a) };
    const image = await renderRegion(page, rect, 30, symbol.opIndex);
    const result = await ocr(image, PSM.SINGLE_LINE, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-");
    let text = result.text.trim().replace(/\s/g, "");
    raw.push(text);
    const components = glyphComponents(image);
    if (part === "top" && components[0]?.holes.length === 2 && text) text = "B" + text.slice(1);
    if (part === "bottom" && components.length >= 2) {
      const first = components[0], shape = strokeDigit(image, first), shapeDigit = shape.score < 3.3 ? shape.digit : digitFromTopology(first);
      const c = cropImage(image, { x: first.x - 2, y: first.y - 2, width: first.width + 4, height: first.height + 4 });
      const padded = document.createElement("canvas");
      padded.width = Math.max(60, c.width * 2) + 40;
      padded.height = c.height + 40;
      const ctx = padded.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, padded.width, padded.height);
      ctx.drawImage(c, 20, 20, Math.max(60, c.width * 2), c.height);
      const numeric = await ocr(padded, PSM.SINGLE_CHAR, "0123456789");
      const rawDigit = numeric.text.trim();
      const digit = /^\d$/.test(rawDigit) ? rawDigit : shapeDigit;
      const suffix = await ocr(cropImage(image, { x: components[1].x - 1, y: 0, width: image.width - components[1].x + 1, height: image.height }), PSM.SINGLE_LINE, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
      const tail = suffix.text.trim().replace(/\s/g, "");
      if (/^\d$/.test(digit) && /^[A-Z]{1,5}$/.test(tail)) text = digit + tail;
    }
    outputs.push(text);
  }
  let tag = outputs.join("");
  if (outputs[0] && !outputs[0].endsWith("-") && outputs[1]) tag = outputs[0] + "-" + outputs[1];
  return { tag: /^[A-Z]{1,8}-\d[A-Z0-9-]*$/.test(tag) ? tag : "", raw: raw.join(" / "), normalized: outputs.join(" / ") };
}
async function terminalLabel(page, c, side) {
  const rect = side === "left" ? { x: c.x - 8.4, y: c.y - 3.5, width: 6.3, height: 3.1 } : { x: c.x - 4.3, y: c.y - 5.2, width: 8.6, height: 3.8 };
  const image = await renderRegion(page, rect, side === "left" ? 28 : 24), read = await ocr(image, PSM.SINGLE_LINE, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-");
  let text = read.text.trim().replace(/\s/g, "");
  const components = glyphComponents(image);
  let shapeInfo = [], context = "";
  if (side === "left") {
    const wide = await ocr(await renderRegion(page, { x: c.x - 17, y: c.y - 3.5, width: 14.9, height: 3.1 }, 20), PSM.SINGLE_LINE, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-");
    context = wide.text.trim().replace(/\s/g, "");
    if (/^Y[A-Z0-9]{2,}/.test(context)) text = "";
    else if (components.length >= 2 && components.length <= 8 && components[0].width / components[0].height < 0.5) {
      shapeInfo = components.map((g) => strokeDigit(image, g));
      if (shapeInfo.every((s) => s.score < 3.8 && s.margin > 0.08)) text = shapeInfo.map((s) => s.digit).join("");
    }
  }
  return { text: /^(?:[A-Z]{1,5}[0-9][A-Z0-9-]*|\d{2,6})$/.test(text) && !/^Y[A-Z0-9]{2,}/.test(text) ? text : "", raw: read.text, context, rect, shapeInfo };
}
async function readSymbols(pdf, number, drawing, onProgress, signal) {
  const page = await pdf.getPage(number), geo = await pageGeometry(page), vp = page.getViewport({ scale: 1 }), graph = buildRoutes(geo), symbols = geo.circles.filter((c) => c.width >= 7 && c.width <= 16 && c.height >= 7), out = [];
  for (let i = 0; i < symbols.length; i++) {
    if (signal?.aborted) throw new DOMException("読み取りを中止しました", "AbortError");
    const d = symbols[i], left = traceTerminal(graph, d, "left"), right = traceTerminal(graph, d, "right");
    if (!left && !right) continue;
    onProgress?.({ page: number, index: i + 1, total: symbols.length, message: "機器記号と配線経路を確認しています" });
    const name = await symbolText(page, d);
    if (!name.tag) continue;
    const cores = [];
    for (const [side, t] of [["left", left], ["right", right]]) {
      if (!t) continue;
      const label = await terminalLabel(page, t.terminal, side);
      cores.push({ id: `p${number}-s${d.x.toFixed(2)}-${d.y.toFixed(2)}-${side}`, order: cores.length + 1, color: "", wire: label.text, terminal: "", side, wireEvidence: { text: label.raw, context: label.context, shape: label.shapeInfo }, evidence: { rect: { x: label.rect.x / vp.width, y: label.rect.y / vp.height, width: label.rect.width / vp.width, height: label.rect.height / vp.height } }, path: t.path.map((r) => ({ horizontal: r.horizontal, k: r.k, lo: r.lo, hi: r.hi, dashed: r.dashed })), method: "機器記号→配線経路→端子円の線番（OCR）", confirmed: false });
    }
    out.push({ id: `p${number}-symbol-${d.x.toFixed(2)}-${d.y.toFixed(2)}`, device: name.tag, cable: "", mark: "", counterparty: "", page: number, drawing, rect: { x: (d.x - d.r) / vp.width, y: (d.y - d.r) / vp.height, width: d.r * 2 / vp.width, height: d.r * 2 / vp.height }, bodyOcr: name.raw, cores, source: "機器円と端子円を結ぶ線・破線経路、OCR・数字字形解析から候補を作成", confirmed: false });
  }
  return out;
}
async function readPage(pdf, number, drawing, onProgress, signal) {
  const a = await readRectPage(pdf, number, drawing, onProgress, signal), b = await readSymbols(pdf, number, drawing, onProgress, signal);
  return [...a, ...b];
}
async function readRegion(pdf, number, rect) {
  const page = await pdf.getPage(number), vp = page.getViewport({ scale: 1 });
  const area = { x: Math.max(0, rect.x) * vp.width, y: Math.max(0, rect.y) * vp.height, width: Math.min(rect.width, 1 - rect.x) * vp.width, height: Math.min(rect.height, 1 - rect.y) * vp.height };
  if (area.width < 2 || area.height < 2) throw Error("読み取る範囲を少し広く選択してください");
  const scale = Math.min(12, Math.sqrt(12e6 / (area.width * area.height)));
  const image = await renderRegion(page, area, scale), result = await ocr(image, PSM.SPARSE_TEXT);
  return { text: result.text, tokens: result.words.filter((w) => w.text).map((w) => ({ text: w.text, confidence: w.confidence, rect: { x: (area.x + w.box.x0 / scale) / vp.width, y: (area.y + w.box.y0 / scale) / vp.height, width: (w.box.x1 - w.box.x0) / scale / vp.width, height: (w.box.y1 - w.box.y0) / scale / vp.height } })), page: number, rect };
}
export {
  pageGeometry,
  readPage,
  readRegion,
  readSymbols,
  scanPages
};
