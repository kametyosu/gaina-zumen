import ExcelJS from "exceljs";
const spec = (g) => [g.cable, g.size ? g.size + "Sq" : "", g.coreCount ? g.coreCount + "C" : "", g.shield === "あり" ? "シールドあり" : g.shield === "なし" ? "シールドなし" : ""].filter(Boolean).join(" ");
async function createWorkbook(groups, { fileName = "", pages = [], draft = true } = {}) {
  const book = new ExcelJS.Workbook();
  book.creator = "ガイナ";
  const s = book.addWorksheet("結線表", { pageSetup: { paperSize: 8, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }, headerFooter: { oddHeader: "&C結線表" + (draft ? "（確認用）" : ""), oddFooter: "&L" + fileName + "&R&P / &N" } });
  s.columns = Array.from({ length: 53 }, () => ({ width: 2.8 }));
  s.views = [{ state: "frozen", ySplit: 2, xSplit: 6 }];
  const merge = (r, c, h, w, text, fill) => {
    s.mergeCells(r, c, r + h - 1, c + w - 1);
    const cell = s.getCell(r, c);
    cell.value = text || "";
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.font = { name: "ＭＳ Ｐゴシック", size: 10 };
    if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) s.getCell(y, x).border = { top: { style: "thin", color: { argb: "FF94A3B8" } }, bottom: { style: "thin", color: { argb: "FF94A3B8" } }, left: { style: "thin", color: { argb: "FF94A3B8" } }, right: { style: "thin", color: { argb: "FF94A3B8" } } };
  };
  for (const [c, w, t] of [[1, 2, "No."], [3, 4, "MARK"], [7, 5, "機器名"], [12, 7, "電線種類 / 図面"], [19, 30, "線色・芯番号 / 線番 / 機器端子"], [49, 5, "相手先"]]) merge(1, c, 2, w, t, "FFE8EEF7");
  let row = 3;
  for (const [i, g] of groups.entries()) {
    const cores = g.shield === "あり" ? [...g.cores, { ...g.shieldConfig, color: "シールド" }] : g.cores;
    const banks = Math.max(1, Math.ceil(cores.length / 10));
    for (let b = 0; b < banks; b++) {
      merge(row, 1, 6, 2, String(i + 1));
      merge(row, 3, 6, 4, g.mark);
      merge(row, 7, 6, 5, g.device);
      merge(row, 12, 2, 7, spec(g), g.cable ? "FFFFFFFF" : "FFFFF1C2");
      merge(row + 2, 12, 2, 7, g.drawing || "");
      merge(row + 4, 12, 2, 7, `${g.page ? "p." + g.page : "手入力"} / ${g.confirmed || g.status === "確認済み" ? "確認済" : "要確認"}`, g.confirmed || g.status === "確認済み" ? "FFE2F5EA" : "FFFFF1C2");
      merge(row, 49, 6, 5, g.counterparty, g.counterparty ? "FFFFFFFF" : "FFFFF1C2");
      for (let k = 0; k < 10; k++) {
        const core = cores[b * 10 + k];
        for (const [offset, value] of [[0, core?.color], [2, core?.wire], [4, core?.terminal]]) merge(row + offset, 19 + k * 3, 2, 3, value || "", core && !value ? "FFFFF1C2" : void 0);
      }
      for (let j = row; j < row + 6; j++) s.getRow(j).height = 17;
      row += 6;
    }
  }
  s.pageSetup.printArea = `A1:BA${row - 1}`;
  s.printOptions = { gridLines: false };
  const details = book.addWorksheet("チューブ・端子明細");
  details.addRow(["機器", "MARK・場所", "相手先", "電線種類", "サイズ", "設定芯数", "シールド", "備考", "ページ", "図番", "区分", "芯順", "色・芯番号", "線番号", "チューブ番号", "端子", "状態", "入力元", "根拠"]);
  for (const g of groups) {
    const items = g.shield === "あり" ? [...g.cores, { ...g.shieldConfig, color: "シールド", kind: "shield" }] : g.cores;
    items.forEach((c, i) => details.addRow([g.device, g.mark, g.counterparty, g.cable, g.size, g.coreCount, g.shield, g.notes, g.page, g.drawing, c.kind === "shield" ? "シールド" : "通常芯線", String(i + 1), c.color, c.wire, c.tube, c.terminal, c.status || g.status, JSON.stringify(c.origins || {}), JSON.stringify(c.evidence || {})]));
  }
  details.columns.forEach((c) => c.width = 20);
  details.views = [{ state: "frozen", ySplit: 1 }];
  const evidence = book.addWorksheet("読取根拠");
  evidence.columns = [{ header: "機器", key: "device", width: 20 }, { header: "PDFページ", key: "page", width: 14 }, { header: "図番", key: "drawing", width: 16 }, { header: "芯", key: "core", width: 8 }, { header: "線色・芯番号", key: "color", width: 18 }, { header: "線番", key: "wire", width: 16 }, { header: "機器端子", key: "terminal", width: 18 }, { header: "状態", key: "state", width: 18 }, { header: "線番（原読取）", key: "raw", width: 25 }, { header: "図面範囲（相対座標）", key: "rect", width: 50 }];
  for (const g of groups) for (const c of g.cores) evidence.addRow({ device: g.device, page: g.page, drawing: g.drawing, core: c.order, color: c.color, wire: c.wire, terminal: c.terminal, state: g.confirmed || g.status === "確認済み" ? "利用者確認済" : "自動読取・未確認", raw: c.wireEvidence?.text || "", rect: JSON.stringify(g.rect) });
  const scope = book.addWorksheet("出力について");
  scope.addRows([["元図面", fileName], ["読取対象ページ", pages.join(", ")], ["状態", draft ? "確認用。空欄・黄色セルは図面記載なし、または読取未完了。" : "利用者確認済"], ["書式", "小西様の結線表を参考にした横並び書式。原本Excel自体の複製ではありません。"], ["読取範囲", "機器枠と端子円を検出できた範囲の候補です。線の交差・別ページ接続・未検出機器は自動確定していません。"], ["後から指定した情報", "線色・電線種類・相手先は利用者が入力した値です。図面に記載がない値は推測していません。"]]);
  scope.getColumn(1).width = 25;
  scope.getColumn(2).width = 110;
  scope.getColumn(2).alignment = { wrapText: true };
  return book.xlsx.writeBuffer();
}
export {
  createWorkbook
};
