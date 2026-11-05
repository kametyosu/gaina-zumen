import { materials } from './analysis-data.mjs';
import { scenarios, total, lowestQuotes, summary, createDemo, fullLead, purchaseHistory, validateDemo, profitAction } from './demo-domain.mjs';
const $=id=>document.getElementById(id);
const money=n=>'¥'+Math.round(n).toLocaleString('ja-JP');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storageKey='gaina-simple-demo-v4';
const initial=()=>createDemo('analysis_cv35');
let state=initial(),timer,documentKind='boq',documentName='',extracted=[];
try{const saved=JSON.parse(localStorage.getItem(storageKey));if(validateDemo(saved)&&Object.entries(saved.itemStates).every(([key,item])=>scenarios[key]&&validateDemo({...createDemo(key),...item,key,batch:[],itemStates:{}})))state=saved}catch{}
const scenario=()=>scenarios[state.key],best=()=>lowestQuotes(state.offers,state.qty)[0],candidate=best,isEligible=o=>o.answered;
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(state))}catch{}}
function toast(message){$('toast').textContent=message;$('toast').style.display='block';clearTimeout(timer);timer=setTimeout(()=>$('toast').style.display='none',2500)}
function setView(view){$('compareView').hidden=view!=='compare';$('analysisView').hidden=view!=='analysis';$('reportView').hidden=view!=='report';$('pageLabel').textContent={compare:'相見積',analysis:'仕入履歴',report:'採用結果'}[view];document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('stepCompare').classList.toggle('current',view==='compare');$('stepReport').classList.toggle('current',view==='report');renderReport();renderHistory();window.scrollTo({top:0,behavior:'smooth'})}
function fixture(){return '<svg viewBox="0 0 80 40"><rect x="17" y="9" width="46" height="22" rx="5" fill="#e4ecf7" stroke="#b2c7e1"/><path d="M26 20h28" stroke="#9eb8d8" stroke-width="3"/></svg>'}
function render(){const s=scenario(),o=best(),m=summary(s,state.qty,o),answers=state.offers.filter(v=>v.answered).length;const items=state.batch.length?state.batch:materials.map(m=>({key:m.key}));$('scenario').innerHTML=items.map(i=>`<option value="${i.key}">${esc(scenarios[i.key].product)}</option>`).join('');$('scenario').value=state.key;$('scenarioLabel').textContent=state.batch.length?'対象商材':'商材';$('comparisonTitle').textContent=`${state.offers.length}社の見積`;$('receive').textContent=`${state.offers.length}社のサンプル回答を表示`;$('projectTitle').textContent=state.project.replace('仕入分析からの相見積｜','');$('responseBadge').textContent=answers?`${answers}社 回答済み`:'回答待ち';$('responseBadge').className='status'+(!answers?' pending':'');const source=state.batch.find(i=>i.key===state.key);$('documentSummary').hidden=!source;$('documentSummary').innerHTML=source?`<span>▤ ${esc(state.documentName||'サンプル明細')}</span><span>${state.batch.length}商材</span>`:'';$('product').innerHTML=`<div class="fixture">${fixture()}</div><div><strong>${esc(s.product)}</strong><p>${esc(s.model)} / ${state.qty.toLocaleString('ja-JP')}${s.unitLabel}</p></div>`;$('waiting').hidden=answers>0;$('comparisonContent').hidden=answers===0;
$('metrics').innerHTML=`<article class="metric"><label>最安の仕入総額</label><strong>${o?money(m.after):'回答待ち'}</strong><small>${o?esc(o.name)+' / 送料込み':'—'}</small></article><article class="metric"><label>比較基準からの${m.saved!==null&&m.saved<0?'増額':'削減額'}</label><strong>${m.saved===null?'—':money(Math.abs(m.saved))}</strong><small>比較基準 ${money(m.before)}</small></article><article class="metric"><label>材料粗利率</label><div><span class="before">${m.beforeMargin.toFixed(1)}%</span><span class="metric-arrow">→</span><strong>${m.margin===null?'—':m.margin.toFixed(1)+'%'}</strong></div></article>`;
const row=(label,fn,cls='')=>`<tr class="${cls}"><td>${label}</td>${state.offers.map(v=>`<td class="${v.id===o?.id?'candidate':''}">${v.answered?fn(v):'—'}</td>`).join('')}</tr>`;$('comparison').innerHTML=`<thead><tr><th>比較項目</th>${state.offers.map(v=>`<th class="${v.id===o?.id?'candidate':''}">${esc(v.name)}${v.id===o?.id?'<span class="candidate-tag">最安</span>':''}</th>`).join('')}</tr></thead><tbody>`+row('本体単価',v=>money(v.unit)+' / '+s.unitLabel)+row('送料',v=>money(v.freight))+row('送料込み総額',v=>money(total(v,state.qty)),'total')+row('納期',v=>fullLead(v,state.qty)+'日')+row('在庫',v=>v.stock.toLocaleString('ja-JP')+s.unitLabel)+'</tbody>';
$('decision').innerHTML=o?`<div><strong>${esc(o.name)}が最安 ${money(m.after)}</strong></div><button id="adopt" class="primary">${state.adopted===o.id?'採用結果を見る →':esc(o.name)+'の最安見積を採用 →'}</button>`:'';if($('adopt'))$('adopt').onclick=()=>{state.adopted=o.id;state.selected=o.id;persist();setView('report')};renderSuggestions();renderHistory();renderReport();persist()}
function actionTitle(action){
 if(!action||action.kind==='hold')return '今回の最安条件を維持する';
 if(action.kind==='freight')return `過去と同じ送料${money(action.targetFreight)}を相談`;
 if(action.kind==='both')return '過去の単価・送料を目安に相談';
 const s=scenario();return s.icon!=='cable'&&action.record.list?`過去の掛け率${(action.record.unit/action.record.list*100).toFixed(1)}%を目安に交渉`:`過去単価${money(action.targetUnit)}/${s.unitLabel}を目安に交渉`;
}
function renderSuggestions(){
 const s=scenario(),o=best(),past=purchaseHistory(state.key).sort((a,b)=>b.date.localeCompare(a.date))[0],action=profitAction(state.key,state.qty,o);
 $('suggestions').innerHTML=`<article class="suggestion"><span class="label">今回の仕入れ</span><h3>前回の金額と比べる</h3><div class="past-price"><span>前回</span><strong>${money(past.unit)}<small> / ${s.unitLabel}</small></strong>${s.icon==='cable'?`<p>当時の銅ベース ${money(past.copperBase)} / t</p>`:''}<span>今回の最安・本体</span><strong>${o?money(o.unit):'回答待ち'}<small> / ${s.unitLabel}</small></strong></div><button id="rateHistory">履歴を見る →</button></article><article class="suggestion" id="profitSuggestion"><span class="label">この商材の利益を増やす</span><h3>${action?esc(actionTitle(action)):'回答後に利益改善を確認'}</h3>${action?`<p>${action.record?`${action.record.date} / 同じ品番・${action.record.qty.toLocaleString('ja-JP')}${s.unitLabel}の実績`: '比較できる過去条件なし'}</p><div class="action-profit"><span>材料粗利の追加改善目安</span><strong>＋${money(action.gain)}</strong><p>${action.beforeMargin===null?'—':action.beforeMargin.toFixed(1)+'% → '+action.afterMargin.toFixed(1)+'%'}${action.points===null?'':`（＋${action.points.toFixed(2)}pt）`}</p></div><small class="action-note">${action.gain>0?'交渉成立時の試算':'過去実績から追加削減は見込まず'}</small><button id="compareNext">${action.gain>0?'改善の試算を見る →':'条件を確認する →'}</button>`:'<p>回答待ち</p>'}</article>`;
 $('rateHistory').onclick=()=>setView('analysis');if($('compareNext'))$('compareNext').onclick=showAction;
}
function showAction(){
 const s=scenario(),o=best(),a=profitAction(state.key,state.qty,o);if(!a)return;
 openDetail('PROFIT ACTION / 同じ商材',`<h2>${esc(s.product)}</h2><h3>${esc(actionTitle(a))}</h3>${a.record?`<div class="dialog-note">根拠：${a.record.date} / ${esc(a.record.vendor)} / ${esc(a.record.model)} / ${a.record.qty.toLocaleString('ja-JP')}${s.unitLabel}<br>本体 ${money(a.record.unit)}/${s.unitLabel} / 送料 ${Number.isFinite(a.record.freight)?money(a.record.freight):'不明'}${s.icon==='cable'?`<br>当時の銅ベース ${money(a.record.copperBase)}/t / 今回 ${money(s.copperBase)}/t`:''}</div>`:'<p>同品番・近い数量で比較できる改善条件はありません。</p>'}<div class="detail-metrics"><div><label>現在の最安見積</label><strong>${money(a.currentTotal)}</strong><p>本体 ${money(o.unit)}/${s.unitLabel} / 送料 ${money(o.freight)}</p></div><div><label>交渉目安の総額</label><strong>${money(a.targetTotal)}</strong><p>本体 ${money(a.targetUnit)}/${s.unitLabel} / 送料 ${money(a.targetFreight)}</p></div></div><div class="action-detail-result"><strong>材料粗利 ＋${money(a.gain)}</strong><p>${money(a.beforeProfit)} → ${money(a.afterProfit)}<br>材料粗利率 ${a.beforeMargin===null?'—':a.beforeMargin.toFixed(1)+'% → '+a.afterMargin.toFixed(1)+'%'}${a.points===null?'':`（＋${a.points.toFixed(2)}ポイント）`}</p></div><p class="minimal-note">同品番・過去1年・数量0.5〜2倍の架空履歴から試算。電線の単価目安は同じ銅ベースの履歴のみ使用。実際の条件は要確認です。見積金額は変更せず、交渉成立も保証しません。</p>`);
}
function historyMarkup(key){const s=scenarios[key],cable=s.icon==='cable',rows=purchaseHistory(key).sort((a,b)=>b.date.localeCompare(a.date));return `<table><thead><tr><th>仕入日</th><th>仕入先</th><th>購入量</th>${cable?'<th>当時の銅ベース</th>':'<th>当時の定価</th>'}<th>仕入単価</th><th>送料</th>${cable?'':'<th>掛け率</th>'}</tr></thead><tbody>${rows.map(r=>`<tr><td>${r.date}</td><td>${esc(r.vendor)}</td><td>${r.qty.toLocaleString('ja-JP')}${s.unitLabel}</td><td>${cable?money(r.copperBase)+' / t':r.list?money(r.list):'—'}</td><td><strong>${money(r.unit)} / ${s.unitLabel}</strong></td><td>${Number.isFinite(r.freight)?money(r.freight):'—'}</td>${cable?'':`<td>${r.list?(r.unit/r.list*100).toFixed(1)+'%':'—'}</td>`}</tr>`).join('')}</tbody></table>`}
function renderHistory(key=state.key){$('historyMaterial').innerHTML=materials.map(m=>`<option value="${m.key}">${esc(m.name)}</option>`).join('');$('historyMaterial').value=key;$('historyTitle').textContent=scenarios[key].product;$('historyTable').innerHTML=historyMarkup(key)}
function renderReport(){const o=best();if(!o){$('report').innerHTML='<h3>回答待ち</h3>';return}const s=scenario(),m=summary(s,state.qty,o),action=profitAction(state.key,state.qty,o);$('report').innerHTML=`<div class="report-project">${esc(s.product)} <span class="status">${state.adopted===o.id?'採用済み':'最安見積'}</span></div><div class="adopted-vendor"><span>${esc(o.name)}</span><strong>${money(m.after)}</strong><small>送料込み / ${state.qty.toLocaleString('ja-JP')}${s.unitLabel}</small></div><div class="profit-compare"><div class="profit-box"><span>比較基準</span><strong>${money(m.before)}</strong><p>材料粗利率 ${m.beforeMargin.toFixed(1)}%</p></div><div class="profit-arrow">→</div><div class="profit-box improved"><span>最安見積を採用</span><strong>${money(m.after)}</strong><p>材料粗利率 ${m.margin.toFixed(1)}%</p></div></div><div class="report-summary"><p>材料粗利 ${money(m.profit)} / ${m.saved>=0?'削減':'増額'} ${money(Math.abs(m.saved))}</p><button id="printReport">印刷 / PDF保存</button></div><div class="report-next-action"><span>次の一手</span><div><strong>${esc(actionTitle(action))}</strong><p>材料粗利 ＋${money(action.gain)} / ${action.points===null?'—':'＋'+action.points.toFixed(2)+'ポイント'}</p></div><button id="reportNext">試算を見る →</button></div>`;$('printReport').onclick=()=>window.print();$('reportNext').onclick=showAction}
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
  for (const [id, key] of [['supplierUnit', 'unit'], ['supplierFreight', 'freight'], ['supplierLead', 'lead'], ['supplierStock', 'stock'], ['supplierRestock', 'restock']]) $(id).value = o[key];
}
$('supplierVendor').onchange = fillSupplier;
$('supplierForm').onsubmit = event => {
  event.preventDefault(); const o = state.offers.find(o => o.id === $('supplierVendor').value);
  for (const [id, key] of [['supplierUnit', 'unit'], ['supplierFreight', 'freight'], ['supplierLead', 'lead'], ['supplierStock', 'stock'], ['supplierRestock', 'restock']]) o[key] = Number($(id).value);
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
