function glyphComponents(canvas) {
  const { width: w, height: h } = canvas, ctx = canvas.getContext("2d", { willReadFrequently: true }), data = ctx.getImageData(0, 0, w, h).data, ink = new Uint8Array(w * h), seen = new Uint8Array(w * h), out = [];
  for (let i = 0; i < ink.length; i++) ink[i] = Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) < 160 ? 1 : 0;
  for (let n = 0; n < ink.length; n++) {
    if (!ink[n] || seen[n]) continue;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    const queue = [n], pixels = [];
    seen[n] = 1;
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head], x = i % w, y = Math.floor(i / w);
      pixels.push(i);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
        const xx = x + dx, yy = y + dy, j = yy * w + xx;
        if (xx >= 0 && xx < w && yy >= 0 && yy < h && ink[j] && !seen[j]) {
          seen[j] = 1;
          queue.push(j);
        }
      }
    }
    if (y1 - y0 < h * 0.45 || pixels.length < 8) continue;
    const ww = x1 - x0 + 3, hh = y1 - y0 + 3, mask = new Uint8Array(ww * hh), whiteSeen = new Uint8Array(ww * hh);
    for (const i of pixels) mask[(Math.floor(i / w) - y0 + 1) * ww + i % w - x0 + 1] = 1;
    const holes = [];
    for (let a = 0; a < mask.length; a++) {
      if (mask[a] || whiteSeen[a]) continue;
      const q = [a];
      whiteSeen[a] = 1;
      let border = false, sumY = 0;
      for (let b = 0; b < q.length; b++) {
        const i = q[b], x = i % ww, y = Math.floor(i / ww);
        sumY += y;
        if (x === 0 || y === 0 || x === ww - 1 || y === hh - 1) border = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy, j = yy * ww + xx;
          if (xx >= 0 && xx < ww && yy >= 0 && yy < hh && !mask[j] && !whiteSeen[j]) {
            whiteSeen[j] = 1;
            q.push(j);
          }
        }
      }
      if (!border && q.length > 4) holes.push({ area: q.length, centerY: sumY / q.length / hh });
    }
    out.push({ x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1, holes, pixels: pixels.length });
  }
  return out.sort((a, b) => a.x - b.x);
}
function digitFromTopology(g) {
  if (g.holes.length === 2) return "8";
  if (g.holes.length === 1) {
    const y = g.holes[0].centerY;
    if (y < 0.43) return "9";
    if (y > 0.57) return "6";
    return "0";
  }
  return "";
}
const strokes = {
  "0": [[[0.3, 0], [0.7, 0], [1, 0.2], [1, 0.8], [0.7, 1], [0.3, 1], [0, 0.8], [0, 0.2], [0.3, 0]]],
  "1": [[[0, 0.15], [0.45, 0], [0.45, 1]], [[0, 1], [1, 1]]],
  "2": [[[0, 0.15], [0.2, 0], [0.7, 0], [1, 0.2], [1, 0.38], [0, 1], [1, 1]]],
  "3": [[[0, 0], [0.7, 0], [1, 0.2], [1, 0.35], [0.55, 0.5], [1, 0.65], [1, 0.8], [0.7, 1], [0, 1]]],
  "4": [[[0.7, 1], [0.7, 0], [0, 0.75], [1, 0.75]], [[0.45, 1], [1, 1]]],
  "5": [[[1, 0], [0, 0], [0, 0.5], [0.3, 0.4], [0.7, 0.4], [1, 0.55], [1, 0.85], [0.7, 1], [0.3, 1], [0, 0.85], [0, 0.75]]],
  "6": [[[0.9, 0], [0.5, 0], [0.15, 0.3], [0, 0.65], [0, 0.85], [0.3, 1], [0.7, 1], [1, 0.85], [1, 0.65], [0.7, 0.5], [0.3, 0.5], [0, 0.65]]],
  "7": [[[0, 0.2], [0, 0], [1, 0], [1, 0.2], [0.65, 0.38], [0.25, 1]]],
  "8": [[[0.3, 0], [0.7, 0], [1, 0.15], [1, 0.35], [0.7, 0.5], [0.3, 0.5], [0, 0.35], [0, 0.15], [0.3, 0]], [[0.3, 0.5], [0, 0.65], [0, 0.85], [0.3, 1], [0.7, 1], [1, 0.85], [1, 0.65], [0.7, 0.5]]],
  "9": [[[1, 0.55], [0.7, 0.65], [0.3, 0.65], [0, 0.5], [0, 0.15], [0.3, 0], [0.7, 0], [1, 0.15], [1, 0.85], [0.7, 1], [0.3, 1], [0, 0.8]]]
};
const W = 32, H = 48;
function field(mask) {
  const d = Float32Array.from(mask, (v) => v ? 0 : 1e3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (x) d[i] = Math.min(d[i], d[i - 1] + 1);
    if (y) d[i] = Math.min(d[i], d[i - W] + 1);
    if (x && y) d[i] = Math.min(d[i], d[i - W - 1] + 1.4);
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    if (x < W - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
    if (y < H - 1) d[i] = Math.min(d[i], d[i + W] + 1);
    if (x < W - 1 && y < H - 1) d[i] = Math.min(d[i], d[i + W + 1] + 1.4);
  }
  return d;
}
const templates = Object.entries(strokes).map(([digit, paths]) => {
  const mask = new Uint8Array(W * H);
  for (const ps of paths) for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1], b = ps[i], steps = Math.ceil(Math.hypot((a[0] - b[0]) * W, (a[1] - b[1]) * H) * 2);
    for (let n = 0; n <= steps; n++) {
      const t = n / steps, x = Math.round((a[0] + (b[0] - a[0]) * t) * (W - 1)), y = Math.round((a[1] + (b[1] - a[1]) * t) * (H - 1));
      mask[y * W + x] = 1;
    }
  }
  return { digit, mask, field: field(mask) };
});
function strokeDigit(canvas, g) {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.fillStyle = "white";
  x.fillRect(0, 0, W, H);
  x.drawImage(canvas, g.x, g.y, g.width, g.height, 0, 0, W, H);
  const pixels = x.getImageData(0, 0, W, H).data, mask = Uint8Array.from({ length: W * H }, (_, i) => pixels[i * 4] < 160 ? 1 : 0), f = field(mask);
  const allowed = g.holes.length >= 2 ? "8" : g.holes.length === 1 ? "0469" : "123457";
  const scores = templates.filter((t) => allowed.includes(t.digit)).map((t) => {
    let a = 0, b = 0, n = 0, m = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) {
        a += Math.min(8, t.field[i]);
        n++;
      }
      if (t.mask[i]) {
        b += Math.min(8, f[i]);
        m++;
      }
    }
    return { digit: t.digit, score: a / Math.max(1, n) + b / m };
  }).sort((a, b) => a.score - b.score);
  return { ...scores[0], holes: g.holes.length, margin: (scores[1]?.score ?? 100) - scores[0].score, scores };
}
export {
  digitFromTopology,
  glyphComponents,
  strokeDigit
};
