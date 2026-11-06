const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const point = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function vectorGeometry(ops, viewport) {
  let m = viewport.transform.slice(), color = "#000000", fillColor = "#000000", stack = [], paths = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const f = ops.fnArray[i], a = ops.argsArray[i];
    if (f === 10) {
      stack.push([m.slice(), color, fillColor]);
      continue;
    }
    if (f === 11 || f === 75) {
      if (stack.length) [m, color, fillColor] = stack.pop();
      continue;
    }
    if (f === 12) {
      m = mul(m, a);
      continue;
    }
    if (f === 74) {
      stack.push([m.slice(), color, fillColor]);
      if (a[0]) m = mul(m, a[0]);
      continue;
    }
    if (f === 58) {
      color = a[0];
      continue;
    }
    if (f === 59) {
      fillColor = a[0];
      continue;
    }
    if (f !== 91 || !a || ![20, 21, 22, 23, 24, 25, 26, 27].includes(a[0])) continue;
    const activeColor = [22, 23].includes(a[0]) ? fillColor : color;
    if (typeof activeColor === "string" && /^#[0-9a-f]{6}$/i.test(activeColor)) {
      const rgb = [1, 3, 5].map((n) => parseInt(activeColor.slice(n, n + 2), 16));
      if (Math.max(...rgb) - Math.min(...rgb) > 45 || Math.min(...rgb) > 210) continue;
    }
    const data = a[1]?.[0];
    if (!data?.length) continue;
    let ps = [], closed = false;
    const flush = () => {
      if (ps.length > 1) paths.push({ opIndex: i, filled: [22, 23, 24, 25, 26, 27].includes(a[0]) && fillColor === "#000000", points: ps, closed: closed || dist(ps[0], ps.at(-1)) < 0.7 });
      ps = [];
      closed = false;
    };
    for (let n = 0; n < data.length; ) {
      const op = data[n++];
      if (op === 0) {
        flush();
        ps.push(point(m, data[n++], data[n++]));
      } else if (op === 1) ps.push(point(m, data[n++], data[n++]));
      else if (op === 2) {
        const p0 = ps.at(-1), p1 = point(m, data[n++], data[n++]), p2 = point(m, data[n++], data[n++]), p3 = point(m, data[n++], data[n++]);
        if (p0) for (let j = 1; j <= 8; j++) {
          const t = j / 8, u = 1 - t;
          ps.push({ x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x, y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y });
        }
      } else if (op === 3) {
        const p0 = ps.at(-1), p1 = point(m, data[n++], data[n++]), p2 = point(m, data[n++], data[n++]);
        if (p0) for (let j = 1; j <= 8; j++) {
          const t = j / 8, u = 1 - t;
          ps.push({ x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y });
        }
      } else if (op === 4) closed = true;
      else break;
    }
    flush();
  }
  const rectangles = [], circles = [], lines = [], dots = [];
  for (const p of paths) {
    const xs = p.points.map((p2) => p2.x), ys = p.points.map((p2) => p2.y), x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    for (let n = 1; n < p.points.length; n++) {
      const a = p.points[n - 1], b = p.points[n];
      if (dist(a, b) > 0.7 && (Math.abs(a.x - b.x) < 0.12 || Math.abs(a.y - b.y) < 0.12)) lines.push({ a, b });
    }
    if (!p.closed) continue;
    if (p.filled && p.points.length > 8 && w > 0.3 && h > 0.3 && w < 2.5 && h < 2.5 && w / h > 0.7 && w / h < 1.4) dots.push({ x: x + w / 2, y: y + h / 2, r: (w + h) / 4 });
    if (w >= 15 && h >= 12 && p.points.every((p2) => Math.min(Math.abs(p2.x - x), Math.abs(p2.x - x - w)) < 0.15 || Math.min(Math.abs(p2.y - y), Math.abs(p2.y - y - h)) < 0.15)) {
      rectangles.push({ x, y, width: w, height: h });
      continue;
    }
    if (p.points.length >= 12 && w >= 1.5 && h >= 1.5 && w <= 20 && h <= 20 && w / h > 0.8 && w / h < 1.25) {
      const cx = x + w / 2, cy = y + h / 2, r = (w + h) / 4, variance = p.points.reduce((n, p2) => n + Math.abs(Math.hypot(p2.x - cx, p2.y - cy) - r), 0) / p.points.length / r;
      if (variance < 0.16) circles.push({ x: cx, y: cy, r, width: w, height: h, opIndex: p.opIndex });
    }
  }
  const seen = /* @__PURE__ */ new Set(), devices = [];
  for (const r of rectangles) {
    if (r.width > viewport.width * 0.75 || r.height > viewport.height * 0.65) continue;
    const ports = [];
    for (const c of circles) {
      if (c.width > 8 || c.height > 8) continue;
      if (c.x < r.x + c.r * 0.4 || c.x > r.x + r.width - c.r * 0.4 || c.y < r.y - c.r * 0.5 || c.y > r.y + r.height + c.r * 0.5) continue;
      let side = null;
      if (Math.abs(c.y - c.r - r.y) < 0.7) side = "top";
      else if (Math.abs(c.y + c.r - r.y - r.height) < 0.7) side = "bottom";
      else if (Math.abs(c.x - c.r - r.x) < 0.7) side = "left";
      else if (Math.abs(c.x + c.r - r.x - r.width) < 0.7) side = "right";
      if (side) ports.push({ ...c, side });
    }
    const key = [r.x, r.y, r.width, r.height].map((n) => n.toFixed(1)).join(":");
    if (ports.length >= 2 && ports.length <= 30 && !seen.has(key)) {
      seen.add(key);
      ports.sort((a, b) => ["top", "left", "right", "bottom"].indexOf(a.side) - ["top", "left", "right", "bottom"].indexOf(b.side) || (a.side === "left" || a.side === "right" ? a.y - b.y : a.x - b.x));
      devices.push({ ...r, ports });
    }
  }
  return { devices: devices.sort((a, b) => a.y - b.y || a.x - b.x), lines, circles, dots };
}
function nearestWord(words, port, side, rect) {
  const valid = words.filter((w) => /^(?:[A-Z]{1,5}[0-9][A-Z0-9]*|\d{2,4})$/.test(w.text) && !/^ALM\d|^TN\d|^TND$/.test(w.text));
  const ranked = valid.map((w) => {
    const cx = (w.box.x0 + w.box.x1) / 2, cy = (w.box.y0 + w.box.y1) / 2;
    const cross = side === "top" || side === "bottom" ? Math.abs(cx - port.x) : Math.abs(cy - port.y);
    return { ...w, cross, score: cross * 4 + Math.hypot(cx - port.x, cy - port.y) * 0.02 };
  }).filter((w) => w.cross < Math.max(2.5, port.r * 1.8)).sort((a, b) => a.score - b.score);
  return ranked[0] || null;
}
export {
  nearestWord,
  vectorGeometry
};
