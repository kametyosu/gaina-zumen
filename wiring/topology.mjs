const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function buildRoutes(geometry) {
  const segments = geometry.lines.filter((l) => distance(l.a, l.b) > 1.5).map((l) => {
    const horizontal = Math.abs(l.a.y - l.b.y) < 0.15;
    return { horizontal, k: horizontal ? (l.a.y + l.b.y) / 2 : (l.a.x + l.b.x) / 2, lo: horizontal ? Math.min(l.a.x, l.b.x) : Math.min(l.a.y, l.b.y), hi: horizontal ? Math.max(l.a.x, l.b.x) : Math.max(l.a.y, l.b.y), dashed: false };
  });
  const terminals = geometry.circles.filter((c) => c.width >= 2.5 && c.width <= 6);
  for (const c of terminals) for (const horizontal of [true, false]) {
    const k = horizontal ? c.y : c.x, v = horizontal ? c.x : c.y;
    const a = segments.some((l) => l.horizontal === horizontal && Math.abs(l.k - k) < 0.3 && Math.abs(l.hi - (v - c.r)) < 0.6), b = segments.some((l) => l.horizontal === horizontal && Math.abs(l.k - k) < 0.3 && Math.abs(l.lo - (v + c.r)) < 0.6);
    if (a || b) segments.push({ horizontal, k, lo: v - c.r, hi: v + c.r, terminal: c });
  }
  const buckets = [];
  for (const s of segments) {
    let bucket = buckets.find((b) => b.horizontal === s.horizontal && Math.abs(b.k - s.k) < 0.18);
    if (!bucket) {
      bucket = { horizontal: s.horizontal, k: s.k, items: [] };
      buckets.push(bucket);
    }
    bucket.items.push(s);
  }
  const routes = [];
  for (const bucket of buckets) {
    bucket.items.sort((a, b) => a.lo - b.lo);
    let prev;
    for (const s of bucket.items) {
      if (prev && s.lo <= prev.hi + 2.05) {
        if (s.lo > prev.hi + 0.3) prev.dashed = true;
        prev.lo = Math.min(prev.lo, s.lo);
        prev.hi = Math.max(prev.hi, s.hi);
      } else {
        prev = { ...s, k: bucket.k };
        routes.push(prev);
      }
    }
  }
  const edges = routes.map(() => []);
  for (let i = 0; i < routes.length; i++) for (let j = i + 1; j < routes.length; j++) {
    const a = routes[i], b = routes[j];
    if (a.horizontal === b.horizontal) continue;
    const h = a.horizontal ? a : b, v = a.horizontal ? b : a, x = v.k, y = h.k;
    if (x < h.lo - 0.25 || x > h.hi + 0.25 || y < v.lo - 0.25 || y > v.hi + 0.25) continue;
    const endpointH = Math.min(Math.abs(x - h.lo), Math.abs(x - h.hi)) < 0.35, endpointV = Math.min(Math.abs(y - v.lo), Math.abs(y - v.hi)) < 0.35;
    const dot = (geometry.dots || []).some((d) => distance(d, { x, y }) < 0.7);
    if (endpointH && endpointV || dot) {
      edges[i].push(j);
      edges[j].push(i);
    }
  }
  return { routes, edges, terminals };
}
function traceTerminal(graph, symbol, side, maxDistance = 90) {
  const p = { x: symbol.x + (side === "left" ? -symbol.r : symbol.r), y: symbol.y };
  const seeds = graph.routes.map((r, i) => ({ r, i })).filter(({ r }) => r.horizontal && Math.abs(r.k - p.y) < 0.4 && p.x >= r.lo - 0.5 && p.x <= r.hi + 0.5);
  const queue = seeds.map(({ i }) => ({ i, cost: 0, path: [] })), seen = /* @__PURE__ */ new Set();
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const n = queue.shift();
    if (seen.has(n.i) || n.cost > maxDistance) continue;
    seen.add(n.i);
    const r = graph.routes[n.i], path = [...n.path, r];
    const circles = graph.terminals.filter((c) => r.horizontal ? Math.abs(c.y - r.k) < 0.4 && c.x >= r.lo - 0.2 && c.x <= r.hi + 0.2 : Math.abs(c.x - r.k) < 0.4 && c.y >= r.lo - 0.2 && c.y <= r.hi + 0.2).filter((c) => side === "left" ? c.x < symbol.x - symbol.r : c.x > symbol.x + symbol.r).sort((a, b) => distance(a, p) - distance(b, p));
    if (circles[0]) return { terminal: circles[0], path, dashed: path.some((p2) => p2.dashed) };
    for (const i of graph.edges[n.i]) if (!seen.has(i)) queue.push({ i, cost: n.cost + (r.hi - r.lo), path });
  }
  return null;
}
export {
  buildRoutes,
  traceTerminal
};
