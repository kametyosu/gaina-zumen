import JSZip from "jszip";
import { createWorkbook } from "./generator-export.mjs";
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const unesc = (v) => String(v).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], unesc(m[2])]));
const letter = (n) => {
  let s = "";
  for (; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
};
const append = (xml, name, content) => xml.replace(new RegExp(`</((?:\\w+:)?${name})>`), (match) => content + match);
const cell = (address, value, style = 0) => `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
function cableSpec(g) {
  return [g.cable, g.size ? g.size + "Sq" : "", g.coreCount ? g.coreCount + "C" : "", g.shield === "あり" ? "シールドあり" : g.shield === "なし" ? "シールドなし" : "", g.drawing, g.page ? "p." + g.page : ""].filter(Boolean).join("\n");
}
function exportCores(g) {
  return g.shield === "あり" ? [...g.cores, { id: "shield", color: "シールド", wire: g.shieldConfig?.wire || "", tube: g.shieldConfig?.tube || "", terminal: g.shieldConfig?.terminal || "", status: g.status, kind: "shield" }] : g.cores;
}
async function templateParts(bytes) {
  if (bytes.byteLength > 2e7) throw Error("書式Excelは20MB以下にしてください");
  const zip = await JSZip.loadAsync(bytes);
  const files = Object.values(zip.files);
  if (files.length > 1e4 || files.reduce((n, f) => n + (f._data?.uncompressedSize || 0), 0) > 2e8) throw Error("書式Excelが大きすぎます");
  const text = async (p) => {
    const f = zip.file(p);
    if (!f) throw Error("Excel内部ファイルがありません");
    return f.async("string");
  };
  const wb = await text("xl/workbook.xml"), rels = await text("xl/_rels/workbook.xml.rels");
  const sheets = [...wb.matchAll(/<(?:\w+:)?sheet\b([^>]+)\/?\s*>/g)].map((m) => attrs(m[1]));
  const sheet = sheets.find((s) => s.name === "CP-2");
  if (!sheet) throw Error("CP-2シートがあるExcelを選択してください");
  const links = [...rels.matchAll(/<(?:\w+:)?Relationship\b([^>]+)\/?\s*>/g)].map((m) => attrs(m[1]));
  const target = links.find((r) => r.Id === sheet["r:id"])?.Target;
  if (!target) throw Error("CP-2の参照先がありません");
  const path = new URL(target, "https://local.invalid/xl/workbook.xml").pathname.slice(1);
  return { zip, text, wb, rels, sheets, path, xml: await text(path) };
}
async function inspectTemplate(bytes) {
  const p = await templateParts(bytes);
  return { sheets: p.sheets.map((s) => s.name), name: "CP-2" };
}
function detailedRows(groups) {
  const rows = [["機器名", "MARK・場所", "相手先", "電線種類", "サイズ(Sq)", "設定芯数", "シールド", "備考", "ページ", "図番", "区分", "芯順", "色・芯番号", "線番号", "チューブ番号", "接続先端子", "確認状態", "入力元", "読取原文", "元位置", "追加参照", "再読取保留"]];
  for (const g of groups) exportCores(g).forEach((c, i) => rows.push([g.device, g.mark, g.counterparty, g.cable, g.size, g.coreCount, g.shield, g.notes, g.page, g.drawing, c.kind === "shield" ? "シールド" : "通常芯線", String(i + 1), c.color, c.wire, c.tube, c.terminal, c.status || g.status, JSON.stringify({ group: g.origins, core: c.origins }), JSON.stringify(c.evidence || {}), JSON.stringify(g.rect || {}), JSON.stringify(g.references || []), JSON.stringify(g.pending || [])]));
  return rows;
}
const plainSheet = (rows) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="30" width="22" customWidth="1"/></cols><sheetData>${rows.map((r, i) => `<row r="${i + 1}" ht="28" customHeight="1">${r.map((v, c) => cell(letter(c + 1) + (i + 1), v)).join("")}</row>`).join("")}</sheetData><autoFilter ref="A1:${letter(rows[0].length)}${rows.length}"/></worksheet>`;
function formattedSheet(groups, source) {
  const draft = groups.some((g) => g.status !== "確認済み" || g.cores.some((c) => c.status !== "確認済み"));
  const style = new Map([...source.matchAll(/<(?:\w+:)?c\b([^>]+)>/g)].map((m) => {
    const a = attrs(m[1]);
    return [a.r, a.s || 0];
  }));
  const merges = [], rows = [];
  const addMerge = (r2, c, h, w) => merges.push(`${letter(c)}${r2}:${letter(c + w - 1)}${r2 + h - 1}`);
  const rowXml = (r2, values, sourceRow, height = 12) => {
    rows.push(`<row r="${r2}" ht="${height}" customHeight="1">${Array.from({ length: 53 }, (_, n) => cell(letter(n + 1) + r2, values.get(n + 1) || "", style.get(letter(n + 1) + sourceRow) || 0)).join("")}</row>`);
  };
  for (let r2 = 1; r2 <= 2; r2++) {
    const vals = new Map(r2 === 1 ? [[1, "NO"], [3, "MARK"], [7, "機器名"], [12, "電線種類"], [19, "線番号"], [49, "相手先"]] : []);
    rowXml(r2, vals, r2, 14);
  }
  for (const [c, w] of [[1, 2], [3, 4], [7, 5], [12, 7], [19, 30], [49, 5]]) addMerge(1, c, 2, w);
  let r = 3;
  const breaks = [];
  for (let index = 0; index < groups.length; index++) {
    const g = groups[index], cores = exportCores(g);
    for (let offset = 0; offset < Math.max(1, cores.length); offset += 10) {
      const values = Array.from({ length: 6 }, () => /* @__PURE__ */ new Map());
      values[0].set(1, String(index + 1));
      values[0].set(3, g.mark);
      values[0].set(7, g.device);
      values[0].set(12, cableSpec(g));
      values[0].set(49, g.counterparty);
      for (const [c, w] of [[1, 2], [3, 4], [7, 5], [12, 7], [49, 5]]) addMerge(r, c, 6, w);
      for (let k = 0; k < 10; k++) {
        const c = 19 + k * 3, core = cores[offset + k];
        for (const [dy, v] of [[0, core?.color], [2, core?.wire], [4, core?.terminal]]) {
          values[dy].set(c, v || "");
          addMerge(r + dy, c, 2, 3);
        }
      }
      for (let j = 0; j < 6; j++) rowXml(r + j, values[j], 7 + j, 10);
      r += 6;
      if ((r - 3) % 48 === 0) breaks.push(r - 1);
    }
  }
  const cols = source.match(/<(?:\w+:)?cols\b[\s\S]*?<\/(?:\w+:)?cols>/)?.[0] || '<cols><col min="1" max="53" width="3" customWidth="1"/></cols>';
  return { end: r - 1, xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:BA${r - 1}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="10"/>${cols}<sheetData>${rows.join("")}</sheetData><mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.2" right="0.2" top="0.3" bottom="0.3" header="0.1" footer="0.1"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddHeader>&amp;C結線表${draft ? "（確認用）" : ""}</oddHeader><oddFooter>&amp;R&amp;P / &amp;N</oddFooter></headerFooter>${breaks.length ? `<rowBreaks count="${breaks.length}" manualBreakCount="${breaks.length}">${breaks.map((b) => `<brk id="${b}" min="0" max="16383" man="1"/>`).join("")}</rowBreaks>` : ""}</worksheet>` };
}
async function exportProject(groups, { templateBytes, ...options } = {}) {
  if (!groups.length) throw Error("出力するケーブルがありません");
  if (!templateBytes) return createWorkbook(groups, options);
  const p = await templateParts(templateBytes);
  let wb = p.wb, rels = p.rels, types = await p.text("[Content_Types].xml");
  const used = new Set(p.sheets.map((s) => s.name)), unique = (base) => {
    let name = base, n = 2;
    while (used.has(name)) name = base + "_" + n++;
    used.add(name);
    return name;
  };
  const formatted = formattedSheet(groups, p.xml), mainName = unique("結線表_CP-2");
  const sheets = [{ name: mainName, xml: formatted.xml }, { name: unique("チューブ・端子明細"), xml: plainSheet(detailedRows(groups)) }, { name: unique("出力条件"), xml: plainSheet([["項目", "内容"], ["元図面", options.fileName || "手入力"], ["元Excel", "既存シート・既存データは変更せず新規シートを追加"], ["対応", `結線表_CP-2：色→線番号→端子。チューブ番号は「チューブ・端子明細」へ。電線種類欄：種類・サイズ・芯数・シールド・図番・ページ。`], ["状態", "未確認・要確認の行を含む場合があります。図面で照合してください。"], ["対象ページ", (options.pages || []).join(", ")], ["シールド", "通常芯線と区別してシールド行・専用明細を出力。"], ["未確定情報", "空欄は推測で補完していません。"]]) }];
  const maxId = Math.max(...p.sheets.map((s) => Number(s.sheetId))), stamp = Date.now().toString(36);
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i], id = `rIdGaina${stamp}${i}`, part = `worksheets/sheet${Math.max(0, ...Object.keys(p.zip.files).map((n) => Number(n.match(/^xl\/worksheets\/sheet(\d+)\.xml$/)?.[1] || 0))) + 1}.xml`;
    const prefix = wb.match(/<((?:\w+:)?)sheets\b/)?.[1] || "";
    wb = append(wb, "sheets", `<${prefix}sheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" name="${esc(s.name)}" sheetId="${maxId + i + 1}" r:id="${id}"/>`);
    rels = append(rels, "Relationships", `<Relationship xmlns="http://schemas.openxmlformats.org/package/2006/relationships" Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${part}"/>`);
    types = append(types, "Types", `<Override xmlns="http://schemas.openxmlformats.org/package/2006/content-types" PartName="/xl/${part}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    p.zip.file("xl/" + part, s.xml);
  }
  const defs = `<definedName name="_xlnm.Print_Area" localSheetId="${p.sheets.length}">'${esc(mainName)}'!$A$1:$BA$${formatted.end}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="${p.sheets.length}">'${esc(mainName)}'!$1:$2</definedName>`;
  if (/<\/?(?:\w+:)?definedNames\b/.test(wb)) wb = append(wb, "definedNames", defs);
  else if (/<(?:\w+:)?calcPr\b/.test(wb)) wb = wb.replace(/<(?:\w+:)?calcPr\b/, (m) => `<definedNames>${defs}</definedNames>` + m);
  else wb = append(wb, "workbook", `<definedNames>${defs}</definedNames>`);
  p.zip.file("xl/workbook.xml", wb);
  p.zip.file("xl/_rels/workbook.xml.rels", rels);
  p.zip.file("[Content_Types].xml", types);
  return p.zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
export {
  cableSpec,
  exportCores,
  exportProject,
  inspectTemplate
};
