import { demoPdf } from "./demo-pdf.mjs";
import { openDrawing } from "./image-input.mjs";
import { renderPdfPage, cropPdf } from "./pdf.bundle.js";
import { scanPages, readPage, readRegion } from "./reader.bundle.js";
import { exportProject, inspectTemplate } from "./template-export.bundle.js";
import { saveSession, loadSession } from "./store.mjs";
import { newCable, newCore, normalizeRead, editGroup, editCore, useWireTube, duplicateCable, confirmCable, needsReview, mergeRead, defaults, catalogChange, validateProject, STATES } from "./project.mjs";
const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)], esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let deletedSources = [], pdf, pages = [], scan = [], sourceFile, templateBytes, templateName = "", groups = [], catalog = structuredClone(defaults), selectedPages = [], selected = 0, step = 1, busy = false, controller, viewPage = 1, focusRect = null, focusMode = true, drawId = 0, regionMode = false, ocrResult = null, undo = null, saveTimer, query = "", onlyReview = false;
const sessionKey = "wiring-project-v2";
function message(text, error = false) {
  $("#message").innerHTML = text ? `<div class="${error ? "error" : "notice"}">${esc(text)}</div>` : "";
}
function snapshot() {
  return { version: 2, groups, catalog, deletedSources, ocrResult, sourceFile, templateBytes, templateName, selectedPages, selected, viewPage, step, savedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
async function save() {
  try {
    await saveSession(sessionKey, snapshot());
    $("#save-status").textContent = "この端末に保存済み";
    $("#restore").disabled = false;
  } catch (e) {
    $("#save-status").textContent = "保存できませんでした";
    message("端末保存に失敗しました。ブラウザーの保存容量・プライベートモードをご確認ください。", true);
  }
}
function changed() {
  clearTimeout(saveTimer);
  $("#save-status").textContent = "保存中…";
  saveTimer = setTimeout(save, 600);
}
function navigate(n) {
  step = n;
  $$(".step").forEach((el) => el.className = "step" + (+el.dataset.step === n ? " active" : +el.dataset.step < n ? " done" : ""));
  message("");
  render();
}
function render() {
  if (step === 1) renderInput();
  else if (step === 2) renderEditor();
  else renderExport();
}
async function loadFile(file) {
  if (!file || busy) return;
  if (sourceFile && groups.length && (sourceFile.name !== file.name || sourceFile.size !== file.size)) {
    message("現在の図面と結線表を保持しています。別の図面で作る場合は、保存してから「新規作成」を選んでください。", true);
    return;
  }
  busy = true;
  message("図面のページを確認しています…");
  try {
    const opened = await openDrawing(file);
    pdf = opened.pdf;
    pages = opened.pages;
    sourceFile = file;
    scan = await scanPages(pdf, (n, total) => message(`図面を確認中 ${n} / ${total}ページ`));
    const best = scan.slice().sort((a, b) => b.score - a.score)[0];
    selectedPages = [best?.count ? best.number : 1];
    viewPage = selectedPages[0];
    ocrResult = null;
    renderInput();
    message("");
    changed();
  } catch (e) {
    message(e.message, true);
  } finally {
    busy = false;
  }
}
async function templateFile(file) {
  if (!file) return;
  try {
    const bytes = await file.arrayBuffer();
    await inspectTemplate(bytes);
    templateBytes = bytes;
    templateName = file.name;
    changed();
    render();
    message("CP-2の書式を読み込みました。既存シートを残して新しい結線表を追加します。");
  } catch (e) {
    message(e.message, true);
  }
}
function templateControl() {
  return `<label class="template-control">書式Excel（任意）<input id="template-file" type="file" accept=".xlsx" aria-label="書式Excel">${templateBytes ? `<small>✓ ${esc(templateName)} / CP-2</small>` : "<small>小西さんのExcelを選ぶと、原本の既存シートを保持したまま出力します。</small>"}</label>`;
}
function renderInput() {
  $("#screen").innerHTML = `<div class="card"><h2>図面を取り込む</h2><div class="upload"><strong>電気図面から結線表の下書きを作成</strong><p class="muted">PDF・スキャン画像（PNG / JPEG / WebP）・40MBまで</p><input id="pdf-file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp,.pdf" aria-label="図面ファイルを選択"></div><div class="actions"><button id="manual">図面なしで手入力から作る</button><button id="demo" class="quiet">サンプル図面で試す</button></div><details><summary>小西さんのExcel書式を指定する</summary>${templateControl()}</details><div id="page-selection"></div></div>`;
  $("#pdf-file").onchange = (e) => loadFile(e.target.files[0]);
  $("#demo").onclick = () => loadFile(new File([demoPdf()], "サンプル結線図.pdf", { type: "application/pdf" }));
  $("#manual").onclick = () => {
    if (!groups.length) groups = [newCable()];
    selected = 0;
    navigate(2);
    changed();
  };
  $("#template-file").onchange = (e) => templateFile(e.target.files[0]);
  if (pdf) renderPages();
}
function renderPages() {
  $("#page-selection").innerHTML = `<h3>${esc(sourceFile?.name)} <span class="muted">${pages.length}ページ</span></h3><div class="pages">${scan.map((p) => `<label class="page"><input type="checkbox" value="${p.number}" ${selectedPages.includes(p.number) ? "checked" : ""}>${p.number}ページ <small>${esc(pages[p.number - 1].drawing)} / ${p.count ? `機器形状候補 ${p.count}件` : "範囲OCR・手動対応付け"}</small></label>`).join("")}</div><div class="notice">接続経路が確認できた機器を下書きにします。文字だけ読めた箇所は、対応付けず「文字候補」として残します。</div><div class="actions"><button id="skip">図面を見ながら手入力する</button><button id="read" class="primary" ${!selectedPages.length ? "disabled" : ""}>下書きを自動作成 →</button></div>`;
  $$(".pages input").forEach((el) => el.onchange = () => {
    selectedPages = $$(".pages input:checked").map((e) => +e.value);
    $("#read").disabled = !selectedPages.length;
  });
  $("#read").onclick = () => runReader();
  $("#skip").onclick = () => {
    if (!groups.length) groups = [newCable({ page: String(viewPage), drawing: pages[viewPage - 1]?.drawing || "" })];
    navigate(2);
    changed();
  };
}
async function runReader() {
  if (busy || !pdf) return;
  busy = true;
  controller = new AbortController();
  message("");
  $("#screen").innerHTML = '<div class="card"><h2>結線表の下書きを作成しています</h2><p id="progress-text">機器と配線経路を確認中…</p><progress id="progress" max="100" value="0"></progress><p class="muted">初回は文字認識の準備が必要です。修正済みの値は上書きしません。</p><button id="cancel">中止する</button></div>';
  $("#cancel").onclick = () => controller.abort();
  const rows = [], unassigned = [];
  try {
    for (let i = 0; i < selectedPages.length; i++) {
      const n = selectedPages[i], result = await readPage(pdf, n, pages[n - 1].drawing, (p) => {
        const text = $("#progress-text");
        if (text) text.textContent = `${n}ページ　${p.index} / ${p.total}　${p.message}`;
        const bar = $("#progress");
        if (bar) bar.value = (i + (p.index - 1) / Math.max(1, p.total)) / selectedPages.length * 100;
      }, controller.signal);
      rows.push(...result);
      if (!result.length) {
        if (controller.signal.aborted) throw new DOMException("中止しました", "AbortError");
        unassigned.push(await readRegion(pdf, n, { x: 0, y: 0, width: 1, height: 1 }));
      }
    }
    if (controller.signal.aborted) throw new DOMException("中止しました", "AbortError");
    groups = mergeRead(groups, rows.filter((r) => !deletedSources.includes(r.sourceKey || r.id)));
    if (!groups.length) groups = [newCable({ page: String(selectedPages[0]), drawing: pages[selectedPages[0] - 1]?.drawing || "" })];
    if (unassigned.length) ocrResult = unassigned[0];
    selected = Math.min(selected, groups.length - 1);
    navigate(2);
    message(rows.length ? `${rows.length}ケーブル候補を読み取りました。未確認の値を図面と照合してください。` : "文字を読み取りました。接続経路が未確定のため、文字候補から機器・芯線へ指定してください。");
    changed();
  } catch (e) {
    navigate(groups.length ? 2 : 1);
    message(e.message, true);
  } finally {
    busy = false;
  }
}
function options(values, current) {
  return values.map((v) => `<option value="${esc(v)}" ${v === current ? "selected" : ""}>${esc(v)}</option>`).join("");
}
function groupField(g, key, label, list = "") {
  return `<label>${label}<input data-group="${key}" value="${esc(g[key])}" ${list ? `list="list-${list}"` : ""} autocomplete="off"><small>${g.origins[key] === "drawing" ? "図面読取" : g.origins[key] === "manual" ? "手入力" : g.origins[key] === "rule" ? "登録ルール" : ""}</small></label>`;
}
function filteredGroups() {
  return groups.map((g, i) => ({ g, i })).filter(({ g }) => (!onlyReview || needsReview(g)) && (!query || [g.device, g.mark, ...g.cores.flatMap((c) => [c.wire, c.tube])].some((s) => String(s).toLowerCase().includes(query.toLowerCase()))));
}
function lists() {
  return Object.entries(catalog).map(([key, values]) => `<datalist id="list-${key}">${values.map((v) => `<option value="${esc(v)}"></option>`).join("")}</datalist>`).join("");
}
function renderEditor() {
  const g = groups[selected];
  if (!g) {
    navigate(1);
    return;
  }
  const filtered = filteredGroups();
  $("#screen").innerHTML = `${lists()}<div class="workspace-toolbar"><div><input id="search" placeholder="機器名・線番号で検索" value="${esc(query)}" aria-label="機器名・線番号で検索"><label><input id="only-review" type="checkbox" ${onlyReview ? "checked" : ""}> 未確認・要確認のみ</label></div><div><button id="add-cable">＋ ケーブル追加</button><button id="reread" ${pdf ? "" : "disabled"}>選択ページを再読取</button></div></div><div class="device-list">${filtered.map(({ g: v, i }) => `<button data-device="${i}" class="${i === selected ? "selected" : ""}">${needsReview(v) ? "○" : "✓"} ${esc(v.device) || "機器名未入力"} <small>ケーブル${i + 1}</small></button>`).join("") || '<p class="muted">該当する機器がありません。</p>'}</div><div class="editor-grid"><div class="card source-card"><div class="source-head"><h2>図面を確認</h2>${pdf ? `<select id="view-page" aria-label="表示ページ">${pages.map((p) => `<option value="${p.number}" ${p.number === viewPage ? "selected" : ""}>${p.number}ページ ${esc(p.drawing)}</option>`).join("")}</select>` : ""}</div>${pdf ? `<div class="viewer-tools"><button id="zoom">${focusMode ? "図面全体を表示" : "該当箇所を拡大"}</button><button id="select-region">範囲を選んで文字読取</button></div><div class="preview" id="source-view"><canvas id="drawing"></canvas><div class="highlight" id="highlight"></div><div id="selection-box"></div></div><p id="source-caption" class="muted">入力欄を選ぶと、読取元の位置を表示します。</p><div id="ocr-panel"></div>` : '<div class="empty">手入力で作成しています。<br>図面は「図面を入れる」から追加できます。</div>'}</div><div class="card edit-card"><div class="source-head"><h2>ケーブル ${selected + 1} / ${groups.length}</h2><span class="badge ${needsReview(g) ? "" : "good"}" id="group-status">${esc(g.status)}</span></div>${g.duplicateWarning ? `<div class="notice">${esc(g.duplicateWarning)}</div>` : ""}${g.pending?.length ? `<div class="notice">再読取で${g.pending.length}件の差分がありました。修正済みの値を保持しました。<details><summary>再読取の候補を見る</summary>${g.pending.map((p) => `<p>${esc(p.field)} → ${esc(p.proposed)}（自動反映なし）</p>`).join("")}</details></div>` : ""}<div class="fields">${groupField(g, "device", "機器名・機器記号")}${groupField(g, "mark", "場所・MARK")}${groupField(g, "counterparty", "接続先の盤・機器")}${groupField(g, "cable", "電線種類", "cable")}${groupField(g, "size", "電線サイズ（Sq）", "size")}<label>設定芯数<input data-group="coreCount" inputmode="numeric" value="${esc(g.coreCount)}"><small>登録 ${g.cores.length}芯 / シールドは別管理</small></label><label>シールド<select id="shield">${options(["未設定", "あり", "なし"], g.shield)}</select></label><label>確認状態<select id="cable-state">${options(STATES, g.status)}</select></label></div><div class="table-wrap core-table"><table><thead><tr><th>芯</th><th>色・芯番号</th><th>線番号</th><th>チューブ番号</th><th>接続先端子</th><th>確認</th><th>操作</th></tr></thead><tbody>${g.cores.map((c, i) => `<tr data-core-row="${c.id}"><td><button class="source-link" data-source="${i}" title="読取元を表示">${i + 1}</button></td>${["color", "wire", "tube", "terminal"].map((key) => `<td><input data-core="${i}" data-key="${key}" aria-label="${i + 1}芯目 ${key}" value="${esc(c[key])}" class="${!c[key] ? "missing" : ""}" ${key === "color" ? 'list="list-color"' : key === "tube" ? 'list="list-tube"' : ""}><small>${key === "tube" ? `<button class="link-tube" data-link-tube="${i}" title="線番号をチューブに使用">${c.tubeMode === "linked" ? "↳ 線番連動" : "線番に戻す"}</button>` : c.origins[key] === "drawing" ? "図面" : c.origins[key] === "manual" ? "手入力" : c.origins[key] === "rule" ? "ルール" : ""}</small></td>`).join("")}<td><select data-core-status="${i}" aria-label="${i + 1}芯目 確認状態">${options(STATES, c.status)}</select></td><td class="row-actions"><button data-move="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="${i + 1}芯目を上へ">↑</button><button data-move="${i}" data-dir="1" ${i === g.cores.length - 1 ? "disabled" : ""} aria-label="${i + 1}芯目を下へ">↓</button><button data-delete-core="${i}" aria-label="${i + 1}芯目を削除">×</button></td></tr>`).join("")}</tbody></table></div><div class="actions"><button id="add-core">＋ 芯線を追加</button><button id="match-count">設定芯数まで追加</button></div>${g.coreCount && Number(g.coreCount) !== g.cores.length ? '<p class="muted">設定芯数と登録芯線数が異なります。余分な芯線は自動削除しません。</p>' : ""}${g.shield === "あり" ? `<section class="shield-panel"><h3>シールド（通常芯線とは別）</h3><div class="fields">${["wire", "tube", "terminal"].map((key, i) => `<label>${["シールド線番号", "シールドチューブ表記", "シールド接続先"][i]}<input data-shield="${key}" value="${esc(g.shieldConfig?.[key])}"></label>`).join("")}</div></section>` : ""}<details id="more-info"><summary>図面参照・備考・登録ルール</summary><div class="fields">${groupField(g, "page", "参照ページ")}${groupField(g, "drawing", "図番")}</div><label class="wide-field">追加参照（ページ / 図番 / 表記を1行ずつ）<textarea id="references">${esc(g.references.map((r) => typeof r === "string" ? r : JSON.stringify(r)).join("\n"))}</textarea></label><label class="wide-field">備考<textarea id="notes">${esc(g.notes)}</textarea></label><label class="wide-field">色をまとめて指定（読点区切り）<input id="colors" placeholder="例：黒、白、赤、緑、黄、茶"></label><button id="apply-colors">このケーブルに適用（要確認）</button><p class="muted">選択候補・登録ルールの値は図面読取と区別し、自動確定しません。</p></details><div class="actions"><button id="confirm-cable" class="primary">このケーブルを確認済みにする</button><button id="duplicate">複製</button><button id="same-device">同じ機器にケーブル追加</button></div><div class="actions"><button id="prev-device" ${selected === 0 ? "disabled" : ""}>← 前へ</button><button id="delete-cable">ケーブル削除</button><button id="next-device" ${selected === groups.length - 1 ? "disabled" : ""}>次へ →</button></div></div></div><div class="actions"><button id="back-input">図面を入れる</button><span class="muted">${groups.length}ケーブル / ${groups.reduce((n, g2) => n + g2.cores.length, 0)}芯 / 要確認 ${groups.filter(needsReview).length}ケーブル</span><button id="to-export" class="primary">3　Excel出力へ →</button></div>${undo ? '<button id="undo" class="quiet">直前の削除を戻す</button>' : ""}`;
  bindEditor(g);
  if (pdf) {
    bindViewer(g);
    drawViewer();
    renderOcrPanel();
  }
}
function setSelected(i) {
  selected = i;
  const g = groups[i];
  if (g.page && +g.page <= pages.length) viewPage = +g.page;
  focusRect = g.rect || null;
  focusMode = true;
  ocrResult = null;
  renderEditor();
  changed();
}
function bindEditor(g) {
  $$("[data-device]").forEach((e) => e.onclick = () => setSelected(+e.dataset.device));
  $("#search").oninput = (e) => {
    query = e.target.value;
    const list = $(".device-list");
    list.innerHTML = filteredGroups().map(({ g: v, i }) => `<button data-device="${i}" class="${i === selected ? "selected" : ""}">${esc(v.device) || "機器名未入力"} / ${i + 1}</button>`).join("");
    $$("[data-device]").forEach((b) => b.onclick = () => setSelected(+b.dataset.device));
  };
  $("#only-review").onchange = (e) => {
    onlyReview = e.target.checked;
    renderEditor();
  };
  $$("[data-group]").forEach((e) => e.oninput = () => {
    editGroup(g, e.dataset.group, e.value);
    $("#group-status").textContent = g.status;
    changed();
  });
  $$("[data-group]").forEach((e) => e.onfocus = () => {
    const evidence = g.evidence?.[e.dataset.group];
    if (evidence?.page && +evidence.page <= pages.length) viewPage = +evidence.page;
    focusRect = evidence?.rect || g.rect || null;
    focusMode = true;
    drawViewer();
  });
  $$("[data-core]").forEach((e) => {
    e.oninput = () => {
      const c = g.cores[+e.dataset.core], key = e.dataset.key;
      if (key === "tube" && e.value === "線番号と同じ") {
        useWireTube(g, c);
        e.value = c.tube;
      } else if (key === "tube" && e.value === "接続先端子と同じ") {
        editCore(g, c, "tube", c.terminal, "rule");
        e.value = c.tube;
      } else editCore(g, c, key, e.value);
      if (key === "wire" && c.tubeMode === "linked") $(`[data-core="${e.dataset.core}"][data-key="tube"]`).value = c.tube;
      e.classList.toggle("missing", !e.value);
      $("#group-status").textContent = g.status;
      changed();
    };
    e.onfocus = () => showEvidence(g.cores[+e.dataset.core], e.dataset.key);
  });
  $$("[data-source]").forEach((e) => e.onclick = () => showEvidence(g.cores[+e.dataset.source], "wire"));
  $$("[data-link-tube]").forEach((e) => e.onclick = () => {
    useWireTube(g, g.cores[+e.dataset.linkTube]);
    renderEditor();
    changed();
  });
  $$("[data-core-status]").forEach((e) => e.onchange = () => {
    g.cores[+e.dataset.coreStatus].status = e.value;
    g.status = "要確認";
    $("#group-status").textContent = g.status;
    changed();
  });
  $$("[data-delete-core]").forEach((e) => e.onclick = () => {
    undo = { groups: structuredClone(groups), deletedSources: [...deletedSources] };
    g.deletedCoreIds ??= [];
    g.deletedCoreIds.push(g.cores[+e.dataset.deleteCore].id);
    g.cores.splice(+e.dataset.deleteCore, 1);
    g.status = "要確認";
    renderEditor();
    changed();
  });
  $$("[data-move]").forEach((e) => e.onclick = () => {
    const i = +e.dataset.move, j = i + +e.dataset.dir;
    [g.cores[i], g.cores[j]] = [g.cores[j], g.cores[i]];
    g.status = "要確認";
    renderEditor();
    changed();
  });
  $("#shield").onchange = (e) => {
    editGroup(g, "shield", e.target.value);
    renderEditor();
    changed();
  };
  $("#cable-state").onchange = (e) => {
    if (e.target.value === "確認済み") confirmCable(g);
    else g.status = e.target.value;
    renderEditor();
    changed();
  };
  $$("[data-shield]").forEach((e) => e.oninput = () => {
    g.shieldConfig ??= {};
    g.shieldConfig[e.dataset.shield] = e.value;
    g.edits.shieldConfig = true;
    g.origins.shieldConfig = "manual";
    g.status = "要確認";
    $("#group-status").textContent = g.status;
    changed();
  });
  $("#notes").oninput = (e) => {
    editGroup(g, "notes", e.target.value);
    changed();
  };
  $("#references").oninput = (e) => {
    g.references = e.target.value.split("\n").filter(Boolean);
    g.edits.references = true;
    changed();
  };
  $("#apply-colors").onclick = () => {
    const values = $("#colors").value.split(/[、,]/);
    g.cores.forEach((c, i) => {
      if (i < values.length) editCore(g, c, "color", values[i].trim(), "rule");
    });
    renderEditor();
    changed();
  };
  $("#add-core").onclick = () => {
    if (g.cores.length >= 200) {
      message("1ケーブル200芯までです", true);
      return;
    }
    g.cores.push(newCore());
    g.status = "要確認";
    renderEditor();
    changed();
  };
  $("#match-count").onclick = () => {
    const n = Number(g.coreCount);
    if (!Number.isInteger(n) || n < 1 || n > 200) {
      message("芯数は1〜200で指定してください", true);
      return;
    }
    while (g.cores.length < n) g.cores.push(newCore());
    g.status = "要確認";
    renderEditor();
    changed();
  };
  $("#confirm-cable").onclick = () => {
    confirmCable(g);
    delete g.duplicateWarning;
    renderEditor();
    changed();
  };
  $("#duplicate").onclick = () => {
    groups.splice(selected + 1, 0, duplicateCable(g));
    setSelected(selected + 1);
  };
  $("#same-device").onclick = () => {
    groups.push(newCable({ device: g.device, mark: g.mark, counterparty: g.counterparty, page: g.page, drawing: g.drawing, rect: g.rect, origins: { device: "manual" } }));
    setSelected(groups.length - 1);
  };
  $("#add-cable").onclick = () => {
    groups.push(newCable({ page: pdf ? String(viewPage) : "", drawing: pages[viewPage - 1]?.drawing || "" }));
    setSelected(groups.length - 1);
  };
  $("#delete-cable").onclick = () => {
    undo = { groups: structuredClone(groups), deletedSources: [...deletedSources] };
    if (g.sourceKey) deletedSources.push(g.sourceKey);
    groups.splice(selected, 1);
    if (!groups.length) groups.push(newCable());
    selected = Math.min(selected, groups.length - 1);
    renderEditor();
    changed();
  };
  $("#prev-device").onclick = () => setSelected(selected - 1);
  $("#next-device").onclick = () => setSelected(selected + 1);
  $("#reread").onclick = () => runReader();
  $("#back-input").onclick = () => navigate(1);
  $("#to-export").onclick = () => {
    navigate(3);
    changed();
  };
  if ($("#undo")) $("#undo").onclick = () => {
    groups = undo.groups;
    deletedSources = undo.deletedSources;
    undo = null;
    selected = Math.min(selected, groups.length - 1);
    renderEditor();
    changed();
  };
}
function showEvidence(c, key) {
  const e = c.evidence?.[key] || c.evidence?.wire;
  if (e?.page) viewPage = +e.page;
  focusRect = e?.rect || groups[selected].rect || null;
  focusMode = true;
  const select = $("#view-page");
  if (select) select.value = viewPage;
  drawViewer();
  if ($("#source-caption")) $("#source-caption").textContent = e ? `読取元：${e.method || "図面"} / 原文 ${e.raw || "—"}（現在値は修正されている場合があります）` : "この項目には図面の読取位置がありません。";
}
let viewRect = { x: 0, y: 0, width: 1, height: 1 };
async function drawViewer() {
  if (!pdf || !$("#drawing")) return;
  const nonce = ++drawId, target = $("#drawing"), g = groups[selected];
  let rect = { x: 0, y: 0, width: 1, height: 1 };
  const anchor = focusRect || g?.rect;
  if (focusMode && anchor) {
    const x = Math.max(0, anchor.x - 0.035), y = Math.max(0, anchor.y - 0.04);
    rect = { x, y, width: Math.min(1 - x, Math.max(0.12, anchor.width + 0.07)), height: Math.min(1 - y, Math.max(0.12, anchor.height + 0.08)) };
  }
  try {
    let temp;
    if (focusMode && anchor) temp = await cropPdf(pdf, viewPage, rect);
    else {
      temp = document.createElement("canvas");
      await renderPdfPage(pdf, viewPage, temp, 2);
    }
    if (nonce !== drawId || !target.isConnected) return;
    viewRect = rect;
    target.width = temp.width;
    target.height = temp.height;
    target.getContext("2d").drawImage(temp, 0, 0);
    const h = $("#highlight");
    if (anchor) {
      h.style.display = "block";
      Object.assign(h.style, { left: (anchor.x - rect.x) / rect.width * 100 + "%", top: (anchor.y - rect.y) / rect.height * 100 + "%", width: anchor.width / rect.width * 100 + "%", height: anchor.height / rect.height * 100 + "%" });
    } else h.style.display = "none";
  } catch (e) {
    if (nonce === drawId) message(e.message, true);
  }
}
function bindViewer() {
  const canvas = $("#drawing");
  $("#view-page").onchange = (e) => {
    viewPage = +e.target.value;
    focusRect = null;
    focusMode = false;
    drawViewer();
  };
  $("#zoom").onclick = () => {
    focusMode = !focusMode;
    $("#zoom").textContent = focusMode ? "図面全体を表示" : "該当箇所を拡大";
    drawViewer();
  };
  $("#select-region").onclick = () => {
    regionMode = true;
    focusMode = false;
    focusRect = null;
    drawViewer();
    message("図面上をドラッグして、機器記号や線番号の範囲を選んでください。");
  };
  let start;
  canvas.onpointerdown = (e) => {
    if (!regionMode || busy) return;
    const b = canvas.getBoundingClientRect();
    start = { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height };
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = (e) => {
    if (!start) return;
    const b = canvas.getBoundingClientRect(), end = { x: Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), y: Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)) };
    const box = $("#selection-box");
    box.style.display = "block";
    Object.assign(box.style, { left: Math.min(start.x, end.x) * 100 + "%", top: Math.min(start.y, end.y) * 100 + "%", width: Math.abs(end.x - start.x) * 100 + "%", height: Math.abs(end.y - start.y) * 100 + "%" });
  };
  canvas.onpointerup = async (e) => {
    if (!start) return;
    const b = canvas.getBoundingClientRect(), end = { x: Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)), y: Math.max(0, Math.min(1, (e.clientY - b.top) / b.height)) }, s = start;
    start = null;
    regionMode = false;
    $("#selection-box").style.display = "none";
    const rect = { x: viewRect.x + Math.min(s.x, end.x) * viewRect.width, y: viewRect.y + Math.min(s.y, end.y) * viewRect.height, width: Math.abs(end.x - s.x) * viewRect.width, height: Math.abs(end.y - s.y) * viewRect.height };
    busy = true;
    message("選択範囲の文字を読み取っています…");
    try {
      ocrResult = await readRegion(pdf, viewPage, rect);
      renderOcrPanel();
      message("文字候補を読み取りました。適用先を選んでから候補を押してください。");
    } catch (e2) {
      message(e2.message, true);
    } finally {
      busy = false;
    }
  };
}
function renderOcrPanel() {
  const panel = $("#ocr-panel");
  if (!panel) return;
  if (!ocrResult) {
    panel.innerHTML = "";
    return;
  }
  panel.innerHTML = `<h3>読み取った文字候補 <span class="badge">未対応付け</span></h3><select id="ocr-target" aria-label="文字候補の適用先"><option value="device">機器名</option><option value="drawing">図番</option><option value="cable">電線種類</option>${groups[selected].cores.flatMap((c, i) => ["wire", "terminal", "tube"].map((k) => `<option value="${i}:${k}">${i + 1}芯目 ${k === "wire" ? "線番号" : k === "terminal" ? "端子" : "チューブ"}</option>`)).join("")}</select><div class="ocr-tokens">${ocrResult.tokens.map((t, i) => `<button data-token="${i}">${esc(t.text)}</button>`).join("") || '<p class="muted">文字候補を読み取れませんでした。範囲を絞るか直接入力してください。</p>'}</div><details><summary>読取原文</summary><pre>${esc(ocrResult.text)}</pre></details>`;
  $$("[data-token]").forEach((b) => b.onclick = () => {
    const t = ocrResult.tokens[+b.dataset.token], target = $("#ocr-target").value, g = groups[selected], evidence = { page: ocrResult.page, rect: t.rect, raw: t.text, method: "範囲OCR・利用者対応付け" };
    if (target.includes(":")) {
      const [index, key] = target.split(":"), c = g.cores[+index];
      editCore(g, c, key, t.text);
      c.evidence[key] = evidence;
      c.origins[key] = "drawing-selected";
    } else {
      editGroup(g, target, t.text);
      g.evidence[target] = evidence;
      g.origins[target] = "drawing-selected";
    }
    focusRect = t.rect;
    viewPage = ocrResult.page;
    renderEditor();
    changed();
  });
}
function renderExport() {
  const count = groups.reduce((n, g) => n + g.cores.length, 0), unconfirmed = groups.filter(needsReview).length;
  $("#screen").innerHTML = `<div class="card"><h2>小西さんの書式に合わせてExcel出力</h2><p><span class="metric">${groups.length}</span> ケーブル　<span class="metric">${count}</span> 芯 <span class="badge ${unconfirmed ? "" : "good"}">${unconfirmed ? `未確認・要確認 ${unconfirmed}件` : "確認済み"}</span></p><div class="table-wrap"><table class="sheet"><thead><tr><th>機器名</th><th>電線種類</th><th>芯</th><th>色・芯番号</th><th>線番号</th><th>チューブ番号</th><th>端子</th></tr></thead><tbody>${groups.slice(0, 3).flatMap((g) => g.cores.slice(0, 10).map((c, i) => `<tr><td>${i === 0 ? esc(g.device) : ""}</td><td>${i === 0 ? esc([g.cable, g.size, g.coreCount].filter(Boolean).join(" / ")) : ""}</td><td>${i + 1}</td><td>${esc(c.color) || "—"}</td><td>${esc(c.wire) || "—"}</td><td>${esc(c.tube) || "—"}</td><td>${esc(c.terminal) || "—"}</td></tr>`)).join("")}</tbody></table></div><p class="muted">先頭3ケーブルの確認用一覧です。Excel本体は色・線番号・端子を横並びに出力します。</p><div class="notice">チューブ番号は専用の「チューブ・端子明細」シートに出力します。シールドは通常芯線と分けて記載します。未確定情報は空欄のまま残します。</div>${templateControl()}<div class="actions"><button id="back-review">← 確認・修正に戻る</button><button id="download" class="primary">結線表Excelをダウンロード ↓</button></div></div>`;
  $("#template-file").onchange = (e) => templateFile(e.target.files[0]);
  $("#back-review").onclick = () => navigate(2);
  $("#download").onclick = async () => {
    const b = $("#download");
    b.disabled = true;
    try {
      const data = await exportProject(groups, { templateBytes, fileName: sourceFile?.name || "手入力", pages: selectedPages, draft: !!unconfirmed });
      download(data, (sourceFile?.name || "手入力").replace(/\.[^.]+$/, "") + "_結線表" + (unconfirmed ? "_確認用" : "") + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      message(templateBytes ? "原本の既存シートを保持し、新しい結線表を追加して出力しました。" : "結線表Excelを出力しました。");
    } catch (e) {
      message(e.message, true);
    } finally {
      b.disabled = false;
    }
  };
}
function download(data, name, type) {
  const u = URL.createObjectURL(new Blob([data], { type })), a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1e4);
}
function showCatalog() {
  const d = $("#catalog-dialog");
  d.innerHTML = '<div class="source-head"><h2>よく使う候補の管理</h2><button id="close-catalog">閉じる</button></div><select id="catalog-kind">' + [["cable", "電線種類"], ["size", "サイズ"], ["color", "色・芯番号"], ["tube", "チューブ表記"]].map(([v, t]) => `<option value="${v}">${t}</option>`).join("") + '</select><div id="catalog-items"></div><form id="add-catalog"><input id="catalog-new" aria-label="新しい候補" placeholder="新しい候補"><button>候補を登録</button></form><p class="muted">候補を登録しても、別案件の結線を自動確定しません。</p>';
  const draw = () => {
    const kind = $("#catalog-kind").value;
    $("#catalog-items").innerHTML = catalog[kind].map((v, i) => `<div class="catalog-row"><input data-catalog-edit="${i}" value="${esc(v)}" aria-label="候補${i + 1}"><button data-catalog-delete="${i}">削除</button></div>`).join("");
    $$("[data-catalog-edit]").forEach((e) => e.onchange = () => {
      try {
        catalogChange(catalog, kind, "edit", catalog[kind][+e.dataset.catalogEdit], e.value);
        changed();
      } catch (err) {
        message(err.message, true);
      }
    });
    $$("[data-catalog-delete]").forEach((e) => e.onclick = () => {
      catalogChange(catalog, kind, "delete", catalog[kind][+e.dataset.catalogDelete]);
      draw();
      changed();
    });
  };
  $("#catalog-kind").onchange = draw;
  $("#add-catalog").onsubmit = (e) => {
    e.preventDefault();
    try {
      catalogChange(catalog, $("#catalog-kind").value, "add", $("#catalog-new").value);
      $("#catalog-new").value = "";
      draw();
      changed();
    } catch (err) {
      message(err.message, true);
    }
  };
  $("#close-catalog").onclick = () => {
    d.close();
    render();
  };
  draw();
  d.showModal();
}
$("#catalog").onclick = () => {
  if (!busy) showCatalog();
};
$("#save").onclick = save;
$("#reset").onclick = () => {
  if (busy) return;
  clearTimeout(saveTimer);
  pdf = null;
  sourceFile = null;
  pages = [];
  scan = [];
  groups = [];
  selectedPages = [];
  selected = 0;
  deletedSources = [];
  focusRect = null;
  templateBytes = void 0;
  templateName = "";
  ocrResult = null;
  query = "";
  onlyReview = false;
  $("#save-status").textContent = "新規作成";
  navigate(1);
};
$("#restore").onclick = async () => {
  if (busy) return;
  clearTimeout(saveTimer);
  try {
    const p = validateProject(await loadSession(sessionKey));
    groups = p.groups;
    deletedSources = p.deletedSources || [];
    ocrResult = p.ocrResult || null;
    catalog = p.catalog || structuredClone(defaults);
    sourceFile = p.sourceFile;
    templateBytes = p.templateBytes;
    templateName = p.templateName || "";
    selectedPages = p.selectedPages || [];
    selected = Math.min(p.selected || 0, groups.length - 1);
    viewPage = p.viewPage || 1;
    if (sourceFile) {
      busy = true;
      message("保存した図面を復元しています…");
      const opened = await openDrawing(sourceFile);
      pdf = opened.pdf;
      pages = opened.pages;
      scan = await scanPages(pdf);
    }
    navigate(groups.length ? 2 : 1);
    message("保存した入力内容と図面を復元しました。");
    $("#save-status").textContent = "この端末に保存済み";
  } catch (e) {
    message(e.message, true);
  } finally {
    busy = false;
  }
};
loadSession(sessionKey).then((p) => {
  $("#restore").disabled = !p || p.version !== 2;
}).catch(() => {
});
navigate(1);
