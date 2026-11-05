import { customer, materials, copper, analyzePurchases, analyzeEffects } from './analysis-data.mjs';
import { scenarios, total, eligible, ranked, summary, priceImpact, copperImpact, createDemo, availability, fullLead, purchaseHistory, rateBenchmark, validateDemo } from './demo-domain.mjs';
const $ = id => document.getElementById(id);
const money = n => '¥' + Math.round(n).toLocaleString('ja-JP');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const storageKey = 'gaina-simple-demo-v3';
let state = createDemo(), timer, documentKind = 'boq', documentName = '', extracted = [];
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (validateDemo(saved) && Object.entries(saved.itemStates).every(([key, item]) => scenarios[key] && validateDemo({ ...createDemo(key), ...item, key, batch: [], itemStates: {} }))) state = saved;
} catch {}
const scenario = () => scenarios[state.key];
const isEligible = offer => eligible(offer, state.delivery, state.qty, state.neededDays);
const best = () => ranked(state.offers, state.qty, state.delivery, state.neededDays)[0];
const candidate = () => state.offers.find(o => o.id === state.selected && o.answered && isEligible(o)) || best();
const benchmark = () => rateBenchmark(purchaseHistory(state.key), scenario().manufacturer, scenario().model, state.qty);
function persist() { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {} }
function toast(message) { $('toast').textContent = message; $('toast').style.display = 'block'; clearTimeout(timer); timer = setTimeout(() => $('toast').style.display = 'none', 3500); }
function setView(view) {
  $('analysisView').hidden = view !== 'analysis'; $('compareView').hidden = view !== 'compare'; $('reportView').hidden = view !== 'report';
  $('pageLabel').textContent = view === 'analysis' ? 'お客様の仕入分析' : view === 'compare' ? '相見積・改善' : '利益改善レポート';
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('stepCompare').classList.toggle('current', view === 'compare'); $('stepReport').classList.toggle('current', view === 'report');
  renderReport(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function fixture() {
  if (scenario().icon === 'lighting') return '<svg viewBox="0 0 80 40" fill="none"><path d="m8 26 50-18 14 6-51 19Z" fill="#e2e9f1" stroke="#b7c8dd"/><path d="m8 26 13 7 51-19v6L21 38 8 31Z" fill="white" stroke="#c5d2e2"/></svg>';
  if (scenario().icon === 'panel') return '<svg viewBox="0 0 80 40"><rect x="19" y="2" width="42" height="36" rx="2" fill="#e2eaf4" stroke="#aabed7"/><rect x="25" y="8" width="30" height="23" rx="1" fill="white"/><path d="M29 14h22M29 21h22M38 11v16M46 11v16" stroke="#c0cee0"/></svg>';
  return '<svg viewBox="0 0 80 40"><ellipse cx="40" cy="21" rx="24" ry="15" fill="#dfe8f3" stroke="#b2c7df"/><ellipse cx="40" cy="21" rx="12" ry="7" fill="white" stroke="#b2c7df"/><path d="M62 19q15 0 10 17" stroke="#9db6d3" fill="none" stroke-width="3"/></svg>';
}
function render() {
  const s = scenario(), o = candidate(), m = summary(s, state.qty, o), answers = state.offers.filter(v => v.answered).length, hist = benchmark();
  const items = state.batch.length ? state.batch : (state.fromAnalysis ? materials.map(m=>m.key) : ['lighting','panel','cable']).map(key => ({ key }));
  $('scenario').innerHTML = items.map(i => `<option value="${i.key}">${esc(scenarios[i.key].product)}</option>`).join('');
  $('scenario').value = state.key; $('scenarioLabel').textContent = state.batch.length ? `対象商材 ${state.batch.length}件` : 'サンプル商材';
  $('comparisonTitle').textContent = `同じ条件で、${state.offers.length}社を比較`;
  $('receive').textContent = `${state.offers.length}社分のサンプル回答を見る`;
  $('delivery').options[0].textContent = `${state.neededDays}日以内に全数そろう`;
  $('delivery').value = state.delivery; $('projectTitle').textContent = state.project;
  $('responseBadge').textContent = answers ? `${answers}社 回答済み` : '回答待ち'; $('responseBadge').className = 'status' + (!answers ? ' pending' : '');
  const source = state.batch.find(i => i.key === state.key);
  $('documentSummary').hidden = !source;
  $('documentSummary').innerHTML = source ? `<span>▤ ${esc(state.documentName || 'サンプル金抜き明細')}</span><span>${state.batch.length}商材をデモ表示 / 必要日 ${state.neededDays}日以内</span><button id="editSource" class="text-button">対象商材を確認</button>` : '';
  if ($('editSource')) $('editSource').onclick = request;
  $('product').innerHTML = `<div class="fixture">${fixture()}</div><div><strong>${esc(s.product)}</strong><p>型番 ${esc(s.model)} / 数量 ${state.qty}${s.unitLabel} / 定価 ${money(s.list)}<br>${esc(s.manufacturer)} · ${source ? esc(source.ref) : 'デモ用商品'}</p></div>`;
  $('waiting').hidden = answers > 0; $('comparisonContent').hidden = answers === 0;
  $('metrics').innerHTML = `<article class="metric"><label>${state.adopted === o?.id ? '採用した' : '選択中の'}仕入総額</label><strong>${o ? money(m.after) : answers ? '候補なし' : '回答待ち'}</strong><small>送料込み / ${o ? esc(o.name) : '在庫・全数納期の条件を確認'}</small></article><article class="metric readiness"><label>現場に間に合うか</label><strong>${o ? '全数、納入可能' : answers ? '条件の見直し' : '回答を待っています'}</strong><small>${o ? `必要 ${state.qty}${s.unitLabel} / 在庫 ${o.stock}${s.unitLabel} / 全数まで ${fullLead(o, state.qty)}日` : '在庫数と不足分の入荷日まで比較'}</small></article><article class="metric benchmark"><label>自社の過去掛け率の目安</label><div><strong>${hist.count >= 3 ? hist.min.toFixed(1) + '〜' + hist.max.toFixed(1) + '%' : '履歴が不足'}</strong></div><small>${hist.count >= 3 ? `中央値 ${hist.median.toFixed(1)}% / 同型番・近い数量 ${hist.count}件` : `参考 ${hist.count}件 / 詳細から実績を確認`}</small></article>`;
  const headers = state.offers.map(v => `<th class="${v.id === o?.id ? 'candidate' : !isEligible(v) ? 'ineligible' : ''}">${esc(v.name)}<span class="candidate-tag">${!v.answered ? '回答待ち' : !isEligible(v) ? '必要日に全数そろわない' : v.id === state.adopted ? '採用済み' : v.id === o?.id ? (v.id === best()?.id ? 'おすすめ・選択中' : '選択中') : v.id === best()?.id ? 'おすすめ' : '比較候補'}</span></th>`).join('');
  const row = (label, fn, cls = '') => `<tr class="${cls}"><td>${label}</td>${state.offers.map(v => `<td class="${v.id === o?.id ? 'candidate' : !isEligible(v) ? 'ineligible' : ''}">${v.answered ? fn(v) : '—'}</td>`).join('')}</tr>`;
  $('comparison').innerHTML = '<thead><tr><th>比較項目</th>' + headers + '</tr></thead><tbody>' +
    row('掛け率 / 自社目安', v => { const rate = v.unit / s.list * 100; return `${rate.toFixed(1)}%<small class="table-note">${hist.count < 3 ? '実績不足' : rate < hist.min ? '過去の範囲より低い' : rate > hist.max ? '過去の範囲より高い' : '過去の範囲内'}</small>`; }) +
    row('仕入単価', v => money(v.unit)) +
    row('在庫 / 必要数', v => `${v.stock}${s.unitLabel} / ${state.qty}${s.unitLabel}<small class="table-note ${v.stock < state.qty ? 'warning' : ''}">${v.stock >= state.qty ? '必要数の在庫あり' : `不足 ${state.qty - v.stock}${s.unitLabel}`}</small>`) +
    row('全数が届くまで', v => `${fullLead(v, state.qty)}日<small class="table-note">${isEligible(v) ? '必要日に間に合う' : '必要日を超過'}</small>`) +
    row('送料', v => money(v.freight)) + row('送料込み総額', v => money(total(v, state.qty)), 'total') +
    `<tr><td>仕入先を選ぶ</td>${state.offers.map(v => `<td class="${v.id === o?.id ? 'candidate' : ''}"><button class="pick ${v.id === o?.id ? 'selected' : ''}" data-pick="${v.id}" ${!v.answered || !isEligible(v) ? 'disabled' : ''}>${v.id === o?.id ? '✓ 選択中' : !isEligible(v) ? '条件を満たさない' : 'この条件を選ぶ'}</button></td>`).join('')}</tr></tbody>`;
  $('decision').innerHTML = o ? `<div><strong>${esc(o.name)}なら、全数 ${fullLead(o, state.qty)}日で納入可能</strong><p>材料粗利 ${money(m.profit)}（${m.margin.toFixed(1)}%） / 以前より${m.saved >= 0 ? '原価を削減' : '原価が増加'} ${money(Math.abs(m.saved))}</p></div><button id="adopt" class="primary">${state.adopted === o.id ? '採用結果を見る →' : 'この条件を採用して利益を確認 →'}</button>` : '<p>必要日に全数そろう回答がありません。必要日を相談するか、代理店へ分納・代替品の提案を依頼する想定です。</p>';
  if ($('adopt')) $('adopt').onclick = () => { state.selected = o.id; state.adopted = o.id; persist(); setView('report'); };
  renderSuggestions(); renderReport(); persist();
}
function renderSuggestions() {
  const o = candidate(), b = best(), s = scenario(), hist = benchmark();
  if (!o || !b) { $('suggestions').innerHTML = '<article class="suggestion"><span class="label">NEXT STEP</span><h3>現場に間に合う条件を確認。</h3><p>回答待ちの場合は回答を確認。候補がない場合は、分納・代替品や必要日の調整を代理店へ相談します。</p></article>'; return; }
  const lowest = state.offers.filter(v => v.answered).sort((a, b) => total(a, state.qty) - total(b, state.qty))[0];
  const rate = o.unit / s.list * 100, gap = hist.count >= 3 ? hist.median - rate : null;
  const saving = summary(s, state.qty, b).saved;
  const price = scenario().icon === 'cable' ? copperImpact(o, state.qty, s.copperShare, .1) : priceImpact(o, state.qty, .08);
  $('suggestions').innerHTML = `<article class="suggestion"><span class="label">01 / 在庫と納期で選ぶ</span><h3>${esc(b.name)}なら、必要日に全数そろう。</h3><p>${lowest.id !== b.id && !isEligible(lowest) ? `${esc(lowest.name)}は安いものの、全数まで${fullLead(lowest, state.qty)}日。` : ''}${esc(b.name)}は在庫${b.stock}${s.unitLabel}、全数${fullLead(b, state.qty)}日。${state.neededDays}日以内にそろう回答で最安です。</p><strong class="benefit">${saving >= 0 ? '−' : '＋'}${money(Math.abs(saving))}<small>以前の仕入条件と比較</small></strong><button id="chooseBest">おすすめの条件を選ぶ →</button></article><article class="suggestion"><span class="label">02 / 自社の掛け率を交渉材料に</span><h3>${gap === null ? '比較できる履歴を蓄積する。' : gap >= 0 ? '過去中央値より、掛け率が低い。' : '過去の掛け率に、交渉余地。'}</h3><p>${hist.count >= 3 ? `自社実績 ${hist.count}件の中央値は${hist.median.toFixed(1)}%。今回の${esc(o.name)}は${rate.toFixed(1)}%。同型番・近い数量の履歴で照合しています。` : `近い条件の実績は${hist.count}件。少数の実績から相場を断定せず、個別価格を確認します。`}</p><button id="rateHistory">履歴と集計条件を見る →</button></article><article class="suggestion"><span class="label">03 / 利益の目減りを防ぐ</span><h3>${scenario().icon === 'cable' ? '銅ベースの変動に、先回り。' : '値上げ前に、有効期限を確認。'}</h3><p>${scenario().icon === 'cable' ? '銅価格10%上昇の仮定で' : '定価8%上昇・掛け率据え置きの仮定で'}、原価が${money(price)}増えるシナリオです。</p><button id="impactOpen">原価への影響を見る →</button></article>`;
  $('chooseBest').onclick = () => { state.selected = b.id; state.adopted = null; render(); toast('在庫・全数納期を満たす条件を選択しました'); };
  $('rateHistory').onclick = history; $('impactOpen').onclick = impact;
}
function renderReport() {
  const o = candidate(), s = scenario(), m = summary(s, state.qty, o), hist = benchmark();
  if (!o) { $('report').innerHTML = '<h3>条件に合う回答を確認しましょう。</h3><p>必要日に全数そろう仕入先を選ぶと、利益と調達条件を表示します。</p>'; return; }
  $('report').innerHTML = `<div class="report-project">${esc(state.project)} <span class="status">${state.adopted === o.id ? 'デモ採用済み' : '選択中の条件で試算'}</span></div><div class="procurement-checks"><span>✓ 在庫 ${o.stock}${s.unitLabel} / 必要 ${state.qty}${s.unitLabel}</span><span>✓ 全数 ${fullLead(o, state.qty)}日 / 必要 ${state.neededDays}日以内</span><span>自社の過去中央値 ${hist.count >= 3 ? hist.median.toFixed(1) + '%' : '実績不足'}</span></div><div class="profit-hero"><small>選択商材で${m.saved >= 0 ? '増える' : '減る'}材料粗利</small><strong>${m.saved >= 0 ? '＋' : '−'}${money(Math.abs(m.saved))}</strong><p>材料売上はそのまま。仕入条件の見直しで ${Math.abs(m.margin - m.beforeMargin).toFixed(1)}ポイント${m.saved >= 0 ? '改善' : '低下'}。</p></div><div class="profit-compare"><div class="profit-box"><span>以前の仕入条件</span><strong>${m.beforeMargin.toFixed(1)}%</strong><p>仕入総額 ${money(m.before)}</p><p>材料粗利 ${money(m.sales - m.before)}</p></div><div class="profit-arrow">→</div><div class="profit-box improved"><span>${esc(o.name)}の条件</span><strong>${m.margin.toFixed(1)}%</strong><p>仕入総額 ${money(m.after)}（送料込み）</p><p>材料粗利 ${money(m.profit)}</p></div></div><div class="report-summary"><p>選択商材：${esc(s.product)} × ${state.qty}${s.unitLabel}<br>材料売上：${money(m.sales)} / 案件全体の集計ではありません。<br>価格・在庫・履歴・改善額はすべてサンプルです。</p><button id="printReport">社内用レポートを印刷 / PDF保存</button></div>`;
  $('printReport').onclick = () => window.print();
}
function openDetail(title, body) { $('detailEyebrow').textContent = title; $('detailContent').innerHTML = body; $('detailDialog').showModal(); }
function history() {
  const s = scenario(), o = candidate(), h = benchmark(), rows = purchaseHistory(state.key);
  openDetail('OWN PURCHASE BENCHMARK / サンプル', `<h2>過去の掛け率を、仕入判断の目安に。</h2><p>市場全体の相場ではなく、自社の架空の仕入履歴です。当時の定価で掛け率を計算します。</p><div class="detail-metrics"><div><label>自社の掛け率帯</label><strong>${h.count >= 3 ? h.min.toFixed(1) + '〜' + h.max.toFixed(1) + '%' : '実績不足'}</strong><p>${h.count}件 / 中央値 ${h.median === null ? '—' : h.median.toFixed(1) + '%'}</p></div><div><label>選択中の掛け率</label><strong>${o ? (o.unit / s.list * 100).toFixed(1) + '%' : '回答待ち'}</strong><p>仕入単価 ÷ 定価 / 送料は含めません</p></div></div><div class="detail-table"><table><thead><tr><th>仕入日 / 仕入先</th><th>数量</th><th>当時の定価</th><th>仕入単価</th><th>掛け率</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.date}<small class="table-note">${r.vendor}</small></td><td>${r.qty}${s.unitLabel}</td><td>${r.list ? money(r.list) : '不明'}</td><td>${money(r.unit)}</td><td>${r.list ? (r.unit / r.list * 100).toFixed(1) + '%' : '集計対象外'}</td></tr>`).join('')}</tbody></table></div><div class="dialog-note">集計条件：同一メーカー・型番、数量が今回の0.5〜2倍、基準日${h.asOf}から過去1年。該当${h.count}件、当時定価不明などで除外${h.excluded}件。3件未満なら目安の価格帯は表示しません。<br>過去の金額を現在の定価で割り直すことはせず、単価・送料・在庫・時期の違いも確認します。</div>`);
}
function impact() {
  const s = scenario(), o = candidate(); if (!o) return;
  const copper = scenario().icon === 'cable', increase = copper ? copperImpact(o, state.qty, s.copperShare, .1) : priceImpact(o, state.qty, .08), m = summary(s, state.qty, o);
  openDetail('PRICE IMPACT / 仮定のシナリオ', `<h2>${copper ? '銅ベースが動いたら、利益はどうなる？' : '値上げ前に、利益への影響を知る。'}</h2><p>${copper ? '銅価格が10%上昇し、材料単価の60%が銅に連動する仮定です。実メーカーのスライド式ではありません。' : '定価8%上昇・掛け率据え置きの仮定です。実メーカーの発表ではありません。'}</p><div class="detail-metrics"><div><label>想定される原価増</label><strong>＋${money(increase)}</strong></div><div><label>材料粗利率への影響</label><strong>${m.margin.toFixed(1)}% → ${((m.sales - m.after - increase) / m.sales * 100).toFixed(1)}%</strong></div></div><h3>次に取るアクション</h3><div class="flow-list"><div><b>01</b><section><h3>在庫確保と見積の有効期限を確認</h3><p>必要数を確保できるか、提示価格がいつまで有効か代理店へ確認します。</p></section></div><div><b>02</b><section><h3>原価増分を、売価・仕様の見直しに使う</h3><p>${money(increase)}の差額を根拠に、代替品や売価を相談します。</p></section></div></div><div class="dialog-note">実際の価格取得や単価変更は行いません。</div>`);
}
function flow() {
  openDetail('HOW IT WORKS / 利用イメージ', '<h2>資料から、現場に間に合う仕入れへ。</h2><div class="flow-list"><div><b>01</b><section><h3>図面・金抜き明細から商材を確認</h3><p>仕様・数量・資料の根拠が並び、不明な項目だけ確認して同じ条件を各社へ依頼します。</p></section></div><div><b>02</b><section><h3>代理店は、価格・在庫・全数納期を回答</h3><p>他社の見積・こちらの売価は非公開。必要数がそろう日まで回答します。</p></section></div><div><b>03</b><section><h3>過去掛け率も参考に、現場の条件で選ぶ</h3><p>最安でも納入が間に合わなければ候補から外し、利益と調達の確実性で判断します。</p></section></div></div><button id="flowSupplier" class="primary full">代理店の回答画面を体験する →</button>');
  $('flowSupplier').onclick = () => { $('detailDialog').close(); openSupplier(); };
}
function renderExtracted() {
  const actualFile = Boolean(documentName);
  $('documentStatus').innerHTML = `<strong>${actualFile ? esc(documentName) : documentKind === 'drawing' ? 'サンプル図面：設備図 E-03〜E-05' : 'サンプル金抜き明細：設備工事明細'}</strong><span>${actualFile ? 'ファイルは解析していません。以下は固定のサンプル商材です。' : 'サンプルから商材が並ぶ利用イメージです。'}</span>`;
  $('extractedItems').innerHTML = extracted.map((item, index) => {
    const s = scenarios[item.key];
    return `<tr><td><input type="checkbox" data-include="${index}" ${item.include ? 'checked' : ''} aria-label="${esc(s.product)}を依頼対象にする"></td><td><strong>${esc(s.product)}</strong><small class="table-note">${esc(s.manufacturer)} / ${esc(s.model)}</small></td><td><input type="number" data-qty="${index}" min="1" max="10000" step="1" value="${item.qty}" aria-label="${esc(s.product)}の数量"><small class="table-note">${s.unitLabel}</small></td><td><button type="button" data-evidence="${index}" class="evidence-link">${esc(item.ref)} ↗</button>${item.review ? `<label class="review-check"><input type="checkbox" data-review="${index}" ${item.confirmed ? 'checked' : ''}>数量を確認した</label>` : '<small class="table-note">明細記載の数量を確認する想定</small>'}</td></tr>`;
  }).join('');
  document.querySelectorAll('[data-document]').forEach(b => b.classList.toggle('active', b.dataset.document === documentKind));
  $('extractionNote').textContent = documentKind === 'drawing' ? '図面の数量拾いは確認が必要です。電線の数量確認をチェックするか、対象から外してください。根拠を押すとサンプル資料を確認できます。' : '金抜き明細の商材・仕様・数量を再利用する想定です。チェックを外した商材は依頼に含めません。';
}
function setDocument(kind, name = '') {
  documentKind = kind; documentName = name;
  extracted = (state.fromAnalysis ? [state.key] : ['lighting','panel','cable']).map((key, index) => {
    const previous = state.batch.find(i => i.key === key);
    return { key, qty: previous?.qty || (key === state.key ? state.qty : scenarios[key].qty), include: previous ? true : state.batch.length ? false : true, review: kind === 'drawing' && scenarios[key].icon === 'cable', confirmed: false, ref: kind === 'drawing' ? `設備図 ${{lighting:'E-03 / 器具表',panel:'E-04 / 盤リスト',cable:'E-05 / 配線系統図'}[scenarios[key].icon]}` : `金抜き明細 p.1 / No.0${index + 1}` };
  });
  renderExtracted();
}
function request() {
  $('requestForm').elements.project.value = state.project;
  $('requestForm').elements.neededDays.value = state.neededDays;
  $('vendorChecks').innerHTML = scenarios.lighting.offers.map(v => `<label><input type="checkbox" name="vendors" value="${v.id}" checked>${esc(v.name)}</label>`).join('');
  $('documentFile').value = ''; $('requestError').hidden = true; setDocument(state.documentKind || 'boq'); $('requestDialog').showModal();
}
function failRequest(message) { $('requestError').textContent = message; $('requestError').hidden = false; $('requestError').scrollIntoView({ block: 'nearest' }); }
function chosenFile(file) {
  if (!file) return;
  if (!/\.(pdf|xlsx?|csv|png|jpe?g)$/i.test(file.name)) { failRequest('PDF・Excel・CSV・画像を選択してください'); return; }
  setDocument(/\.(pdf|png|jpe?g)$/i.test(file.name) ? 'drawing' : 'boq', file.name);
}
$('documentFile').onchange = event => chosenFile(event.target.files[0]);
$('documentDrop').ondragover = event => { event.preventDefault(); $('documentDrop').classList.add('dragover'); };
$('documentDrop').ondragleave = () => $('documentDrop').classList.remove('dragover');
$('documentDrop').ondrop = event => { event.preventDefault(); $('documentDrop').classList.remove('dragover'); chosenFile(event.dataTransfer.files[0]); };
document.querySelectorAll('[data-document]').forEach(button => button.onclick = () => { $('documentFile').value = ''; setDocument(button.dataset.document); });
$('extractedItems').onchange = event => {
  const el = event.target;
  if (el.dataset.include !== undefined) extracted[Number(el.dataset.include)].include = el.checked;
  if (el.dataset.qty !== undefined) { const item = extracted[Number(el.dataset.qty)]; item.qty = Number(el.value); item.confirmed = false; if (item.review) { const check = document.querySelector(`[data-review="${el.dataset.qty}"]`); if (check) check.checked = false; } }
  if (el.dataset.review !== undefined) extracted[Number(el.dataset.review)].confirmed = el.checked;
};
$('extractedItems').onclick = event => {
  const button = event.target.closest('[data-evidence]'); if (!button) return;
  const item = extracted[Number(button.dataset.evidence)], s = scenarios[item.key];
  openDetail('SOURCE EVIDENCE / サンプル資料', `<h2>${esc(item.ref)}</h2><p>実ファイルの解析結果ではありません。元資料と照合する操作を示す固定のサンプルです。</p><div class="sample-evidence"><span>${documentKind === 'drawing' ? '設備図・部材リスト' : '設備工事 金抜き明細'}</span><h3>${esc(s.product)}</h3><p>仕様・型番：${esc(s.model)}<br>数量：${item.qty}${s.unitLabel}${item.review ? '（図面からの仮数量・要確認）' : '（サンプル記載）'}</p></div><div class="dialog-note">${item.review ? '実運用では線長やルート・余長の確認が必要です。表示数量を確認・修正してから依頼へ進みます。' : '実運用では、元資料の該当ページと一覧の項目を照合できます。'}</div>`);
};
const snapshot = () => structuredClone({ qty: state.qty, offers: state.offers, selected: state.selected, adopted: state.adopted, delivery: state.delivery, neededDays: state.neededDays });
function switchItem(key) {
  if (!state.batch.length) { const fromAnalysis = state.fromAnalysis; state = createDemo(key); state.fromAnalysis = fromAnalysis; render(); return; }
  state.itemStates[state.key] = snapshot();
  const item = state.batch.find(i => i.key === key); if (!item) return;
  const next = state.itemStates[key] || createDemo(key);
  Object.assign(state, structuredClone(next), { key, qty: item.qty }); render();
}
$('requestForm').onsubmit = event => {
  event.preventDefault();
  const f = new FormData(event.target), vendors = f.getAll('vendors'), selected = extracted.filter(i => i.include);
  if (!selected.length) { failRequest('依頼する商材を1件以上選んでください'); return; }
  if (selected.some(i => !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 10000)) { failRequest('数量は1〜10000の整数で入力してください'); return; }
  if (selected.some(i => i.review && !i.confirmed)) { failRequest('図面の仮数量を確認するか、該当商材を対象から外してください'); return; }
  if (!vendors.length) { failRequest('依頼する代理店を1社以上選んでください'); return; }
  const project = String(f.get('project')).trim(); if (!project) { failRequest('案件名を入力してください'); return; }
  const neededDays = Number(f.get('neededDays')), batch = selected.map(i => ({ key: i.key, qty: i.qty, ref: i.ref }));
  state = createDemo(batch[0].key); state.project = project; state.qty = batch[0].qty; state.neededDays = neededDays;
  state.batch = batch; state.documentKind = documentKind; state.documentName = documentName || (documentKind === 'drawing' ? 'サンプル図面.pdf' : 'サンプル金抜き明細.xlsx');
  state.itemStates = Object.fromEntries(batch.map(i => {
    const item = createDemo(i.key);
    return [i.key, { qty: i.qty, offers: item.offers.filter(o => vendors.includes(o.id)).map(o => ({ ...o, answered: false })), selected: null, adopted: null, delivery: 'all', neededDays }];
  }));
  Object.assign(state, structuredClone(state.itemStates[state.key])); state.requested = true;
  $('requestDialog').close(); render(); setView('compare'); toast(`${batch.length}商材を${vendors.length}社へ依頼するデモを作成しました。送信はしていません。`);
};
$('receive').onclick = () => { state.offers.forEach(o => o.answered = true); for (const item of Object.values(state.itemStates)) item.offers.forEach(o => o.answered = true); render(); toast(`${state.batch.length || 1}商材のサンプル回答を表示しました`); };
function openSupplier() {
  const s = scenario(); $('supplierProduct').textContent = `${state.project} / ${s.product} / 必要 ${state.qty}${s.unitLabel} / ${state.neededDays}日以内`;
  $('supplierVendor').innerHTML = state.offers.map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join(''); fillSupplier(); $('supplierDialog').showModal();
}
function fillSupplier() {
  const o = state.offers.find(o => o.id === $('supplierVendor').value);
  for (const [id, key] of [['supplierUnit', 'unit'], ['supplierFreight', 'freight'], ['supplierLead', 'lead'], ['supplierStock', 'stock'], ['supplierRestock', 'restock']]) $(id).value = o[key];
}
$('supplierVendor').onchange = fillSupplier;
$('supplierForm').onsubmit = event => {
  event.preventDefault(); const o = state.offers.find(o => o.id === $('supplierVendor').value);
  for (const [id, key] of [['supplierUnit', 'unit'], ['supplierFreight', 'freight'], ['supplierLead', 'lead'], ['supplierStock', 'stock'], ['supplierRestock', 'restock']]) o[key] = Number($(id).value);
  o.answered = true; o.negotiated = false; state.selected = isEligible(o) ? o.id : null; state.adopted = null;
  $('supplierDialog').close(); render(); setView('compare'); toast('価格・在庫・全数納期のサンプル回答を反映しました');
};
$('comparison').onclick = event => { const button = event.target.closest('[data-pick]'); if (!button) return; state.selected = button.dataset.pick; state.adopted = null; render(); };
$('scenario').onchange = event => switchItem(event.target.value);
$('delivery').onchange = event => { state.delivery = event.target.value; if (!state.offers.some(o => o.id === state.selected && isEligible(o))) state.selected = null; state.adopted = null; render(); };
$('newRequest').onclick = request; $('anotherRequest').onclick = request; $('stepRequest').onclick = request;
$('stepCompare').onclick = () => setView('compare'); $('stepReport').onclick = () => setView('report'); $('backCompare').onclick = () => setView('compare'); $('backAnalysis').onclick = () => setView('analysis');
$('flowOpen').onclick = flow; $('historyOpen').onclick = history; $('supplierPreview').onclick = openSupplier;
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => setView(b.dataset.view));
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(b.dataset.close).close());
$('reset').onclick = () => { state = createDemo(); render(); setView('analysis'); toast('デモを最初の状態に戻しました'); };
render();
renderAnalysis();
setView('analysis');

function renderAnalysis() {
  const a = analyzePurchases(), effects = analyzeEffects(), cables = materials.filter(m => m.category === '電線');
  $('purchaseMetrics').innerHTML = `<article><span>過去6か月の仕入額</span><strong>${money(a.spend)}</strong><small>電線・照明・盤・その他 / 税抜</small></article><article><span>電線の仕入構成比</span><strong>60.0<em>%</em></strong><small>${money(a.categories.find(c => c.name === '電線').spend)} / 最優先の見直し対象</small></article><article><span>同数量での改善余地</span><strong>${money(a.potential)}</strong><small>参考条件で再購入した場合 / 未確定</small></article>`;
  const colors = ['#3c83d2', '#68b5a2', '#97afd1', '#ced8e8'];
  const mix = [...a.categories, { name: 'その他', spend: customer.otherSpend }];
  $('spendMix').innerHTML = `<div class="mix-bar">${mix.map((c, i) => `<span style="width:${c.spend / a.spend * 100}%;background:${colors[i]}"></span>`).join('')}</div>` + mix.map((c, i) => `<div class="mix-row"><span><i style="background:${colors[i]}"></i>${c.name}</span><strong>${money(c.spend)}</strong><small>${(c.spend / a.spend * 100).toFixed(1)}%</small></div>`).join('');
  const first = copper.points[0], last = copper.points.at(-1), values = copper.points.map(p => p.value), min = Math.min(...values) - 20000, max = Math.max(...values) + 20000;
  const points = copper.points.map((p, i) => [35 + i * 76, 110 - (p.value - min) / (max - min) * 80]);
  $('analysisCopper').innerHTML = `<div class="copper-head"><strong>${money(last.value)}<small> / t</small></strong><span>期首比 ＋${((last.value / first.value - 1) * 100).toFixed(1)}%</span></div><svg class="copper-analysis-chart" viewBox="0 0 450 145" role="img" aria-label="架空の国内銅建値の推移"><path d="M35 20V113H425" stroke="#e1e9f3" fill="none"/><polyline points="${points.map(p => p.join(',')).join(' ')}" fill="none" stroke="#4d8dce" stroke-width="3"/>${points.map(([x,y],i) => `<circle cx="${x}" cy="${y}" r="4" fill="#4d8dce"><title>${copper.points[i].date} ${money(copper.points[i].value)}/t</title></circle><text x="${x-8}" y="135">${i+5}月</text>`).join('')}</svg><p class="analysis-copper-note">銅が5%上がっても、電線全体が5%上がるとは限りません。銅比率60%の仮定なら単価への影響は約3%。加工費・メーカー固有のスライド式も確認します。</p>`;
  $('cableAnalysis').innerHTML = '<thead><tr><th>電線の種類・サイズ</th><th>購入数量</th><th>現在の比較基準</th><th>参考レンジ</th><th>採用可能条件の参考単価</th><th>同数量の改善余地</th><th></th></tr></thead><tbody>' + cables.map(m => `<tr><td><strong>${m.name}</strong><small class="table-note">${m.model} / 架空商品</small></td><td>${m.qty.toLocaleString('ja-JP')}m</td><td>${money(m.current)}/m</td><td>${money(m.low)}〜${money(m.high)}/m</td><td>${money(m.reference)}/m</td><td class="saving-cell">${money((m.current-m.reference)*m.qty)}</td><td><button data-analyze-material="${m.key}">相見積へ →</button></td></tr>`).join('') + '</tbody>';
  $('otherMaterials').innerHTML = materials.filter(m => m.category !== '電線').map(m => `<div class="other-material"><div><strong>${m.name}</strong><p>仕入 ${money(m.qty*m.current)} / ${m.qty}${m.unit}<br>現条件 ${money(m.current)} → 参考条件 ${money(m.reference)} / ${m.unit}</p><span>改善余地 ${money((m.current-m.reference)*m.qty)}</span></div><button data-analyze-material="${m.key}">比較する →</button></div>`).join('');
  $('verifiedEffects').innerHTML = `<div class="effect-kpis"><div><span>確定削減額の例</span><strong>＋${money(effects.saving)}</strong><small>仮想の納品・請求照合後 / 5件</small></div><div><span>材料粗利額の変化</span><strong>${money(effects.beforeProfit)} → ${money(effects.afterProfit)}</strong><small>対象の材料売上 ${money(effects.sales)} は同じ</small></div><div><span>材料粗利率の変化</span><strong>${effects.beforeMargin.toFixed(1)}% → ${effects.afterMargin.toFixed(1)}%</strong><small>＋${(effects.afterMargin-effects.beforeMargin).toFixed(2)}ポイント / 工賃・共通経費別</small></div></div><details class="effect-details"><summary>対象5件の金額と計算根拠を見る</summary><div class="analysis-table-scroll"><table><thead><tr><th>商材</th><th>実購入数量の例</th><th>基準仕入額</th><th>改善後仕入額</th><th>削減額の例</th></tr></thead><tbody>${effects.details.map(d=>`<tr><td>${d.name}</td><td>${d.qty}${d.unit}</td><td>${money(d.before)}</td><td>${money(d.after)}</td><td>${money(d.saving)}</td></tr>`).join('')}</tbody></table></div></details><p class="analysis-footnote">改善余地${money(a.potential)}とは対象数量・段階が異なります。両方を足しません。この集計例は固定データで、下の比較操作による変更を含みません。送料配賦込み・税抜。実際は同条件の基準と追加費用を確認します。</p>`;
  document.querySelectorAll('[data-analyze-material]').forEach(button => button.onclick = () => openAnalysisComparison(button.dataset.analyzeMaterial));
  $('analysisStart').onclick = () => openAnalysisComparison(materials[0].key);
  $('analysisEffect').onclick = () => setView('report');
}
function openAnalysisComparison(key) { state = createDemo(key); state.fromAnalysis = true; render(); setView('compare'); toast('仕入分析と同じ商材・参考条件で、相見積を体験できます'); }
