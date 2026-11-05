import { materials } from './analysis-data.mjs';
import { scenarios, total, lowestQuotes, summary, createDemo, fullLead, purchaseHistory, validateDemo, profitRecommendations, quoteTerms } from './demo-domain.mjs';
const $=id=>document.getElementById(id);
const money=n=>'¥'+Math.round(n).toLocaleString('ja-JP');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storageKey='gaina-simple-demo-v5';
const initial=()=>createDemo('analysis_cv35');
let state=initial(),timer,documentKind='boq',documentName='',extracted=[];
try{const saved=JSON.parse(localStorage.getItem(storageKey));if(validateDemo(saved)&&Object.entries(saved.itemStates).every(([key,item])=>scenarios[key]&&validateDemo({...createDemo(key),...item,key,batch:[],itemStates:{}})))state=saved}catch{}
const scenario=()=>scenarios[state.key],best=()=>lowestQuotes(state.offers,state.qty)[0],candidate=best,isEligible=o=>o.answered;
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(state))}catch{}}
function toast(message){$('toast').textContent=message;$('toast').style.display='block';clearTimeout(timer);timer=setTimeout(()=>$('toast').style.display='none',2500)}
function setView(view){$('compareView').hidden=view!=='compare';$('analysisView').hidden=view!=='analysis';$('reportView').hidden=view!=='report';$('pageLabel').textContent={compare:'相見積',analysis:'仕入履歴',report:'採用結果'}[view];document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('stepCompare').classList.toggle('current',view==='compare');$('stepReport').classList.toggle('current',view==='report');renderReport();renderHistory();window.scrollTo({top:0,behavior:'smooth'})}
function fixture(){return '<svg viewBox="0 0 80 40"><rect x="17" y="9" width="46" height="22" rx="5" fill="#e4ecf7" stroke="#b2c7e1"/><path d="M26 20h28" stroke="#9eb8d8" stroke-width="3"/></svg>'}
function render(){const s=scenario(),o=best(),m=summary(s,state.qty,o),answers=state.offers.filter(v=>v.answered).length;const items=state.batch.length?state.batch:materials.map(m=>({key:m.key}));$('scenario').innerHTML=items.map(i=>`<option value="${i.key}">${esc(scenarios[i.key].product)}</option>`).join('');$('scenario').value=state.key;$('scenarioLabel').textContent=state.batch.length?'対象商材':'商材';$('comparisonTitle').textContent=`${state.offers.length}社の見積`;$('receive').textContent=`${state.offers.length}社のサンプル回答を表示`;$('projectTitle').textContent=state.project.replace('仕入分析からの相見積｜','');$('responseBadge').textContent=answers?`${answers}社 回答済み`:'回答待ち';$('responseBadge').className='status'+(!answers?' pending':'');const source=state.batch.find(i=>i.key===state.key);$('documentSummary').hidden=!source;$('documentSummary').innerHTML=source?`<span>▤ ${esc(state.documentName||'サンプル明細')}</span><span>${state.batch.length}商材</span>`:'';$('product').innerHTML=`<div class="fixture">${fixture()}</div><div><strong>${esc(s.product)}</strong><p>${esc(s.manufacturer)} / ${esc(s.model)} / ${esc(s.specification||s.product)}<br>${state.qty.toLocaleString('ja-JP')}${s.unitLabel}・${esc(s.packing||'標準')} / 見積 ${esc(o?.quoteDate||s.quoteDate||'2026-11-05')}${s.icon==='cable'?` / 銅ベース ${money(quoteTerms(s,o||{}).copperBase)}/t`:` / 定価 ${money(quoteTerms(s,o||{}).list)}`}</p></div>`;$('waiting').hidden=answers>0;$('comparisonContent').hidden=answers===0;
$('metrics').innerHTML=`<article class="metric"><label>最安の仕入総額</label><strong>${o?money(m.after):'回答待ち'}</strong><small>${o?esc(o.name)+' / 送料込み':'—'}</small></article><article class="metric"><label>比較基準からの${m.saved!==null&&m.saved<0?'増額':'削減額'}</label><strong>${m.saved===null?'—':money(Math.abs(m.saved))}</strong><small>比較基準 ${money(m.before)}</small></article><article class="metric"><label>材料粗利率</label><div><span class="before">${m.beforeMargin.toFixed(1)}%</span><span class="metric-arrow">→</span><strong>${m.margin===null?'—':m.margin.toFixed(1)+'%'}</strong></div></article>`;
const row=(label,fn,cls='')=>`<tr class="${cls}"><td>${label}</td>${state.offers.map(v=>`<td class="${v.id===o?.id?'candidate':''}">${v.answered?fn(v):'—'}</td>`).join('')}</tr>`;$('comparison').innerHTML=`<thead><tr><th>比較項目</th>${state.offers.map(v=>`<th class="${v.id===o?.id?'candidate':''}">${esc(v.name)}${v.id===o?.id?'<span class="candidate-tag">最安</span>':''}</th>`).join('')}</tr></thead><tbody>`+row('本体単価',v=>money(v.unit)+' / '+s.unitLabel)+row('送料',v=>money(v.freight))+row('切断・梱包費',v=>money(v.processing??0))+row('送料込み総額',v=>money(total(v,state.qty)),'total')+row('納期',v=>fullLead(v,state.qty)+'日')+row('在庫',v=>v.stock.toLocaleString('ja-JP')+s.unitLabel)+'</tbody>';
$('decision').innerHTML=o?`<div><strong>${esc(o.name)}が最安 ${money(m.after)}</strong></div><button id="adopt" class="primary">${state.adopted===o.id?'採用結果を見る →':esc(o.name)+'の最安見積を採用 →'}</button>`:'';if($('adopt'))$('adopt').onclick=()=>{state.adopted=o.id;state.selected=o.id;persist();setView('report')};renderSuggestions();renderHistory();renderReport();persist()}
const actionLabels={price:'近い数量の単価・掛け率',quantity:'数量帯ごとの条件',fees:'付帯費用の照合'};
function actionTitle(a){
 if(!a?.record)return '比較できる過去実績なし';
 const s=scenario();
 if(a.type==='fees')return a.gain>0?'過去の付帯費用を目安に相談':'付帯費用は過去と同水準';
 if(s.icon==='cable')return `${a.record.qty.toLocaleString('ja-JP')}${s.unitLabel}で${money(a.record.unit)}/${s.unitLabel}の実績`;
 return `${a.record.qty.toLocaleString('ja-JP')}${s.unitLabel}・掛け率${(a.record.unit/a.record.list*100).toFixed(1)}%の実績`;
}
function renderSuggestions(){
 const s=scenario(),o=best(),actions=profitRecommendations(state.key,state.qty,o);
 $('suggestions').innerHTML=actions.length?actions.map((a,index)=>`<article class="suggestion numeric-action" data-action="${a.type}"><span class="label">0${index+1} / ${actionLabels[a.type]}</span><h3>${esc(actionTitle(a))}</h3>${a.record?`<p class="action-evidence">${a.record.date} / ${esc(a.record.vendor)}${s.icon==='cable'?` / 銅 ${money(a.record.copperBase)}/t`:''}</p>${a.type==='fees'?`<div class="action-comparison"><span>今回</span><strong>送料 ${money(a.currentFreight)} / 梱包 ${money(a.currentProcessing)}</strong><span>過去</span><strong>送料 ${money(a.record.freight)} / 梱包 ${money(a.record.processing)}</strong></div>`:`<div class="action-comparison"><span>今回単価 → 目安</span><strong>${money(a.currentUnit)} → ${money(a.targetUnit)} / ${s.unitLabel}</strong><small>${a.qty.toLocaleString('ja-JP')}${s.unitLabel} × ${money(a.targetUnit)} ＋ 送料${money(a.targetFreight)} ＋ 梱包${money(a.targetProcessing)}</small><strong class="target-amount">目安総額 ${money(a.targetTotal)}</strong></div>`}<div class="action-profit ${a.gain===0?'no-extra':''}"><span>${a.type==='quantity'?a.qty.toLocaleString('ja-JP')+s.unitLabel+'での別試算':a.type==='fees'?'付帯費用の追加改善':'今回数量での追加粗利'}</span><strong>${a.gain>0?'＋':''}${money(a.gain)}</strong><p>${a.beforeMargin===null?'—':a.beforeMargin.toFixed(1)+'% → '+a.afterMargin.toFixed(1)+'%'}${a.points===null?'':`（＋${a.points.toFixed(2)}pt）`}</p></div><small class="action-note">${a.type==='quantity'?`追加${a.additionalQty.toLocaleString('ja-JP')}${s.unitLabel}の用途がある場合。送料等は今回と同額の仮定。`:a.type==='fees'&&a.gain===0?'追加削減なし。単価の相談を優先。':'過去と同じ条件で交渉できた場合の目安。'}</small>`:'<p>品番・仕様・数量・時点の条件を確認します。</p>'}<button data-action-detail="${a.type}">根拠と計算を見る →</button></article>`).join(''):['price','quantity','fees'].map((type,index)=>`<article class="suggestion numeric-action" data-action="${type}"><span class="label">0${index+1} / ${actionLabels[type]}</span><h3>回答待ち</h3></article>`).join('');
 document.querySelectorAll('[data-action-detail]').forEach(b=>b.onclick=()=>showAction(b.dataset.actionDetail));
}
function showAction(type='price'){
 const s=scenario(),o=best(),a=profitRecommendations(state.key,state.qty,o).find(a=>a.type===type);if(!a)return;
 openDetail('数字で確認 / '+actionLabels[type],`<h2>${esc(s.product)}</h2><h3>${esc(actionTitle(a))}</h3><div class="dialog-note">今回：${esc(a.terms.manufacturer)} / ${esc(a.terms.model)} / ${esc(a.terms.specification)} / ${esc(a.terms.packing)}<br>見積 ${esc(a.terms.date)} / 購入量 ${state.qty.toLocaleString('ja-JP')}${s.unitLabel}${s.icon==='cable'?` / 適用銅ベース ${money(a.terms.copperBase)}/t`:` / 定価 ${money(a.terms.list)}`}</div>${a.record?`<div class="dialog-note">過去：${a.record.date} / ${esc(a.record.vendor)} / ${a.record.qty.toLocaleString('ja-JP')}${s.unitLabel}<br>本体 ${money(a.record.unit)}/${s.unitLabel} / 送料 ${money(a.record.freight)} / 切断・梱包費 ${money(a.record.processing)}${s.icon==='cable'?`<br>当時銅ベース ${money(a.record.copperBase)}/t`:`<br>当時定価 ${money(a.record.list)} / 掛け率 ${(a.record.unit/a.record.list*100).toFixed(1)}%`}</div>`:'<p>一致する条件の過去実績がないため、改善額は推測しません。</p>'}<div class="detail-metrics"><div><label>${a.type==='quantity'?a.qty.toLocaleString('ja-JP')+s.unitLabel+'を今回単価で試算':'今回の最安見積'}</label><strong>${money(a.currentTotal)}</strong><p>${money(a.currentUnit)} × ${a.qty.toLocaleString('ja-JP')} ＋ 送料${money(a.currentFreight)} ＋ 梱包${money(a.currentProcessing)}</p></div><div><label>履歴に基づく目安総額</label><strong>${money(a.targetTotal)}</strong><p>${money(a.targetUnit)} × ${a.qty.toLocaleString('ja-JP')} ＋ 送料${money(a.targetFreight)} ＋ 梱包${money(a.targetProcessing)}</p></div></div><div class="action-detail-result"><strong>材料粗利 ＋${money(a.gain)}</strong><p>${money(a.beforeProfit)} → ${money(a.afterProfit)}<br>材料粗利率 ${a.beforeMargin===null?'—':a.beforeMargin.toFixed(1)+'% → '+a.afterMargin.toFixed(1)+'%'}${a.points===null?'':`（＋${a.points.toFixed(2)}ポイント）`}</p></div><p class="minimal-note">${a.type==='quantity'?`今回の${state.qty.toLocaleString('ja-JP')}${s.unitLabel}・${money(a.actualCurrentTotal)}とは別の${a.qty.toLocaleString('ja-JP')}${s.unitLabel}試算です。追加数量が必要な場合のみ検討し、送料等は再見積してください。`:'同品番・同仕様・近い数量（±20%）の履歴と照合。'} 3案は独立した試算で合算しません。電線単価は適用銅ベースが一致する実績のみ使用。架空の交渉目安であり、元の見積金額は変更しません。</p>`);
}
function historyMarkup(key){const s=scenarios[key],cable=s.icon==='cable',rows=purchaseHistory(key).sort((a,b)=>b.date.localeCompare(a.date));return `<table><thead><tr><th>仕入日</th><th>仕入先</th><th>購入量</th>${cable?'<th>当時の銅ベース</th>':'<th>当時の定価</th>'}<th>仕入単価</th><th>送料 / 梱包費</th>${cable?'':'<th>掛け率</th>'}</tr></thead><tbody>${rows.map(r=>`<tr><td>${r.date}</td><td>${esc(r.vendor)}</td><td>${r.qty.toLocaleString('ja-JP')}${s.unitLabel}</td><td>${cable?money(r.copperBase)+' / t':r.list?money(r.list):'—'}</td><td><strong>${money(r.unit)} / ${s.unitLabel}</strong></td><td>${Number.isFinite(r.freight)?money(r.freight):'—'} / ${Number.isFinite(r.processing)?money(r.processing):'—'}</td>${cable?'':`<td>${r.list?(r.unit/r.list*100).toFixed(1)+'%':'—'}</td>`}</tr>`).join('')}</tbody></table>`}
function renderHistory(key=state.key){$('historyMaterial').innerHTML=materials.map(m=>`<option value="${m.key}">${esc(m.name)}</option>`).join('');$('historyMaterial').value=key;$('historyTitle').textContent=scenarios[key].product;$('historyTable').innerHTML=historyMarkup(key)}
function renderReport(){const o=best();if(!o){$('report').innerHTML='<h3>回答待ち</h3>';return}const s=scenario(),m=summary(s,state.qty,o),actions=profitRecommendations(state.key,state.qty,o);$('report').innerHTML=`<div class="report-project">${esc(s.product)} <span class="status">${state.adopted===o.id?'採用済み':'最安見積'}</span></div><div class="adopted-vendor"><span>${esc(o.name)}</span><strong>${money(m.after)}</strong><small>${money(o.unit)} × ${state.qty.toLocaleString('ja-JP')}${s.unitLabel} ＋ 送料${money(o.freight)} ＋ 梱包${money(o.processing??0)}</small></div><div class="profit-compare"><div class="profit-box"><span>比較基準</span><strong>${money(m.before)}</strong><p>材料粗利率 ${m.beforeMargin.toFixed(1)}%</p></div><div class="profit-arrow">→</div><div class="profit-box improved"><span>最安見積を採用</span><strong>${money(m.after)}</strong><p>材料粗利率 ${m.margin.toFixed(1)}%</p></div></div><div class="report-summary"><p>材料粗利 ${money(m.profit)} / ${m.saved>=0?'削減':'増額'} ${money(Math.abs(m.saved))}</p><button id="printReport">印刷 / PDF保存</button></div><div class="report-action-list">${actions.map(a=>`<div class="report-action-row"><span>${actionLabels[a.type]}</span><div><strong>${esc(actionTitle(a))}</strong><p>${a.qty.toLocaleString('ja-JP')}${s.unitLabel}で＋${money(a.gain)} / ${a.points===null?'—':'＋'+a.points.toFixed(2)+'pt'}${a.type==='quantity'?'（数量変更の別試算）':''}</p></div><button data-report-detail="${a.type}">数字を見る →</button></div>`).join('')}<small>3案は独立した試算です。合算しません。</small></div>`;$('printReport').onclick=()=>window.print();document.querySelectorAll('[data-report-detail]').forEach(b=>b.onclick=()=>showAction(b.dataset.reportDetail))}
function openDetail(title,body){$('detailEyebrow').textContent=title;$('detailContent').innerHTML=body;$('detailDialog').showModal()}
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
  extracted = (state.fromAnalysis ? [state.key] : ['analysis_light','analysis_panel','analysis_cv35']).map((key, index) => {
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
  for (const [id, key] of [['supplierUnit', 'unit'], ['supplierFreight', 'freight'], ['supplierProcessing', 'processing'], ['supplierLead', 'lead'], ['supplierStock', 'stock'], ['supplierRestock', 'restock']]) $(id).value = (o[key]??0);
}
$('supplierVendor').onchange = fillSupplier;
$('supplierForm').onsubmit = event => {
  event.preventDefault(); const o = state.offers.find(o => o.id === $('supplierVendor').value);
  for (const [id, key] of [['supplierUnit', 'unit'], ['supplierFreight', 'freight'], ['supplierProcessing', 'processing'], ['supplierLead', 'lead'], ['supplierStock', 'stock'], ['supplierRestock', 'restock']]) o[key] = Number($(id).value);
  o.answered = true; o.negotiated = false; state.selected = isEligible(o) ? o.id : null; state.adopted = null;
  $('supplierDialog').close(); render(); setView('compare'); toast('価格・在庫・全数納期のサンプル回答を反映しました');
};

$('scenario').onchange=event=>switchItem(event.target.value);
$('historyMaterial').onchange=event=>renderHistory(event.target.value);
$('newRequest').onclick=request;$('anotherRequest').onclick=request;$('stepRequest').onclick=request;
$('stepCompare').onclick=()=>setView('compare');$('stepReport').onclick=()=>setView('report');$('backCompare').onclick=()=>setView('compare');$('reportBack').onclick=()=>setView('compare');
$('historyOpen').onclick=()=>setView('analysis');$('supplierPreview').onclick=openSupplier;
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('reset').onclick=()=>{state=initial();render();setView('compare');toast('リセットしました')};
render();setView('compare');
