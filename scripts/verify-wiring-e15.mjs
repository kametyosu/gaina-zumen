import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { normalizeRead } from "../wiring/project.mjs";
import { exportProject } from "../wiring/template-export.mjs";
const [pdfPath, xlsxPath, outputPath] = process.argv.slice(2);
if (!pdfPath) throw Error("使い方: node scripts/verify-wiring-e15.mjs 図面.pdf [書式.xlsx] [出力フォルダー]");
const root = resolve("dist"), server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://local").pathname, path = resolve(root, "." + pathname + (pathname.endsWith("/") ? "index.html" : ""));
    if (!path.startsWith(root + "/")) throw Error();
    const data = await readFile(path);
    res.writeHead(200, { "content-type": { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".css": "text/css", ".wasm": "application/wasm", ".gz": "application/gzip" }[extname(path)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = "http://127.0.0.1:" + server.address().port, browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
try {
  const p = await browser.newPage(), errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/wiring/");
  const bytes = (await readFile(pdfPath)).toString("base64");
  const rows = await p.evaluate(async (data) => {
    const { openPdf } = await import("/wiring/pdf.bundle.js"), { readPage } = await import("/wiring/reader.bundle.js");
    const { pdf, pages } = await openPdf(new File([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], "drawing.pdf", { type: "application/pdf" }));
    return readPage(pdf, 7, pages[6].drawing);
  }, bytes);
  assert.deepEqual(errors, []);
  const expected = { "SV-9W": ["1124", "V83"], "BV-1HU": ["1125", "V83"], "BV-2HU": ["1126", "V83"], "BV-3HU": ["1127", "V83"] };
  const checks = Object.entries(expected).map(([device, wires]) => {
    const actual = rows.find((r) => r.device === device)?.cores.map((c) => c.wire) || [];
    return { device, expected: wires, actual, match: JSON.stringify(actual) === JSON.stringify(wires) };
  });
  console.log(JSON.stringify(checks, null, 2));
  assert(checks.every((c) => c.match), "指定された4組の読取結果が一致しません");
  for (const g of rows) {
    assert.equal(g.cable, "");
    for (const c of g.cores) assert.equal(c.color, "");
  }
  const groups = rows.map(normalizeRead);
  let output, original;
  if (xlsxPath) {
    original = await readFile(xlsxPath);
    output = await exportProject(groups, { templateBytes: original, pages: [7], fileName: "変更部抜粋_261026.pdf" });
    const before = await JSZip.loadAsync(original), after = await JSZip.loadAsync(output);
    for (const name of Object.keys(before.files).filter((n) => !before.files[n].dir && !["xl/workbook.xml", "xl/_rels/workbook.xml.rels", "[Content_Types].xml"].includes(n))) assert.deepEqual(await before.file(name).async("uint8array"), await after.file(name).async("uint8array"), name + " must be unchanged");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(output);
    assert(wb.getWorksheet("CP-2"));
    assert(wb.getWorksheet("結線表_CP-2"));
    assert(wb.getWorksheet("チューブ・端子明細"));
  } else output = await exportProject(groups, { pages: [7] });
  if (outputPath) {
    await mkdir(outputPath, { recursive: true });
    await writeFile(resolve(outputPath, "E-15_結線表_確認用.xlsx"), Buffer.from(output));
    await writeFile(resolve(outputPath, "E-15_検証結果.json"), JSON.stringify({ checks, candidateCables: groups.length, candidateCores: groups.reduce((n, g) => n + g.cores.length, 0), scope: "指定4機器・8線番のみ期待値と照合。その他は未確認。電線仕様・色は未設定。", originalSheetsUnchanged: !!original, groups }, null, 2));
  }
  console.log("E-15 passed: 4 devices / 8 wire labels, real OCR + geometry, no Excel answer data supplied to reader; template original parts preserved.");
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
