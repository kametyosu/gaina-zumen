const STATES = ["未確認", "要確認", "確認済み"];
const uid = () => globalThis.crypto?.randomUUID?.() || "id-" + Date.now() + "-" + Math.random().toString(36).slice(2);
const defaults = { cable: ["VCT-F", "VCT", "CV", "CVV", "CVVS", "MVVS", "IV"], size: ["0.5", "0.75", "1.25", "2", "3.5", "5.5", "8", "14", "22", "38"], color: ["黒", "白", "赤", "緑", "黄", "茶", "青", "橙", "灰", "桃", "1", "2", "3", "4", "5", "6"], tube: ["線番号と同じ", "接続先端子と同じ", "予備", "E"] };
function newCore(values = {}) {
  const c = { id: uid(), color: "", wire: "", tube: "", tubeMode: "linked", terminal: "", status: "未確認", edits: {}, origins: {}, evidence: {}, ...values };
  if (c.tubeMode === "linked") {
    c.tube = String(c.wire ?? "");
    c.origins.tube = "rule";
  }
  return c;
}
function newCable(values = {}) {
  return { id: uid(), device: "", mark: "", counterparty: "", cable: "", size: "", coreCount: "", shield: "未設定", shieldConfig: { wire: "", tube: "", terminal: "" }, notes: "", page: "", drawing: "", references: [], status: "未確認", edits: {}, origins: {}, evidence: {}, cores: [newCore(), newCore()], ...values };
}
function normalizeRead(g) {
  return newCable({ ...g, sourceKey: g.sourceKey || g.id, status: "要確認", origins: Object.fromEntries(["device", "cable", "size", "counterparty", "drawing"].filter((k) => g[k]).map((k) => [k, "drawing"])), evidence: { device: { page: g.page, rect: g.rect, raw: g.bodyOcr || g.device, method: g.source || "自動読取" } }, cores: g.cores.map((c) => newCore({ ...c, status: "要確認", origins: { wire: "drawing", terminal: c.terminal ? "drawing" : "" }, evidence: { wire: { page: g.page, rect: c.evidence?.rect || g.rect, raw: c.wireEvidence?.text || c.wire, method: c.method || g.source || "自動読取", path: c.path || [], processing: c.wireEvidence?.shape || [] } } })) });
}
function editGroup(g, key, value) {
  g[key] = String(value);
  g.edits[key] = true;
  g.origins[key] = "manual";
  g.status = "要確認";
}
function editCore(g, c, key, value, origin = "manual") {
  c[key] = String(value);
  c.edits[key] = true;
  c.origins[key] = origin;
  c.status = "要確認";
  g.status = "要確認";
  if (key === "wire" && c.tubeMode === "linked") {
    c.tube = c.wire;
    c.origins.tube = "rule";
  }
  if (key === "tube") {
    c.tubeMode = "custom";
  }
}
function useWireTube(g, c) {
  c.tubeMode = "linked";
  c.tube = c.wire;
  c.edits.tube = true;
  c.origins.tube = "rule";
  c.status = "要確認";
  g.status = "要確認";
}
function duplicateCable(g) {
  const copy = structuredClone(g);
  copy.id = uid();
  delete copy.sourceKey;
  delete copy.pending;
  delete copy.confirmedAt;
  delete copy.confirmed;
  copy.deletedCoreIds = [];
  copy.status = "要確認";
  copy.notes = copy.notes ? "\n" + copy.notes : "";
  copy.duplicateWarning = "複製したため、機器名・線番号・チューブ番号を確認してください";
  copy.edits = { ...copy.edits, device: true };
  copy.origins.device = "copy";
  copy.cores = copy.cores.map((c) => ({ ...c, id: uid(), status: "要確認", edits: { ...c.edits, wire: true, tube: true }, origins: { ...c.origins, wire: "copy", tube: "copy" } }));
  return copy;
}
function confirmCable(g) {
  g.status = "確認済み";
  g.cores.forEach((c) => {
    c.status = "確認済み";
  });
  g.confirmedAt = (/* @__PURE__ */ new Date()).toISOString();
}
function needsReview(g) {
  return g.status !== "確認済み" || g.cores.some((c) => c.status !== "確認済み");
}
function mergeRead(existing, incoming) {
  const out = structuredClone(existing);
  for (const raw of incoming) {
    const g = normalizeRead(raw), old = out.find((v) => v.sourceKey && v.sourceKey === g.sourceKey);
    if (!old) {
      out.push(g);
      continue;
    }
    old.pending = [];
    for (const key of ["device", "cable", "size", "counterparty", "drawing", "page"]) {
      if (!g[key] || g[key] === old[key]) continue;
      if (old.edits[key] || old.status === "確認済み") old.pending.push({ field: key, proposed: g[key] });
      else {
        old[key] = g[key];
        old.origins[key] = "drawing";
      }
    }
    for (let i = 0; i < g.cores.length; i++) {
      const fresh = g.cores[i];
      if (old.deletedCoreIds?.includes(fresh.id)) continue;
      const c = old.cores.find((v) => v.sourceKey && v.sourceKey === fresh.sourceKey) || old.cores.find((v) => v.id === fresh.id);
      if (!c) {
        old.cores.push(fresh);
        old.status = "要確認";
        continue;
      }
      for (const key of ["wire", "terminal"]) {
        if (!fresh[key] || fresh[key] === c[key]) continue;
        if (c.edits[key] || c.status === "確認済み") old.pending.push({ core: c.id, field: key, proposed: fresh[key] });
        else {
          c[key] = fresh[key];
          c.evidence[key] = fresh.evidence[key];
          c.status = "要確認";
          if (key === "wire" && c.tubeMode === "linked") c.tube = c.wire;
        }
      }
    }
  }
  return out;
}
function catalogChange(catalog, kind, action, value, next) {
  if (!Object.hasOwn(defaults, kind)) throw Error("候補の種類が不正です");
  const list = catalog[kind] ??= [];
  if (action === "add") {
    if (!String(value).trim()) throw Error("候補を入力してください");
    if (!list.includes(String(value))) list.push(String(value));
  } else if (action === "delete") catalog[kind] = list.filter((v) => v !== value);
  else if (action === "edit") {
    if (!String(next).trim()) throw Error("候補を入力してください");
    catalog[kind] = list.map((v) => v === value ? String(next) : v);
  }
  return catalog;
}
function validateProject(p) {
  if (p?.version !== 2 || !Array.isArray(p.groups) || p.groups.length > 5e3) throw Error("対応する保存データではありません");
  for (const g of p.groups) {
    if (!Array.isArray(g.cores) || g.cores.length > 200) throw Error("芯線の件数を確認してください");
  }
  return p;
}
export {
  STATES,
  catalogChange,
  confirmCable,
  defaults,
  duplicateCable,
  editCore,
  editGroup,
  mergeRead,
  needsReview,
  newCable,
  newCore,
  normalizeRead,
  uid,
  useWireTube,
  validateProject
};
