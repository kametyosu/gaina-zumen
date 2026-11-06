'use strict';
const $=id=>document.getElementById(id), colors={青:'#4589bf',赤:'#cc645b',黒:'#435046',白:'#fff',緑:'#5e9863',黄:'#d7b644',未設定:'#b6bfb6'};
const sampleConnections=[
 ['赤','TB1:1','PS1：+24V','DC24V電源／制御用・0.75sq'],
 ['黒','TB1:2','PS1：0V','DC0V共通線／極性を確認・0.75sq'],
 ['赤','TB1:3','FU1：1','制御電源ヒューズ入力・0.75sq'],
 ['赤','TB1:4','FU1：2 → PLC：L+','ヒューズ二次側／PLC電源・0.75sq'],
 ['黒','TB1:5','PLC：M','PLC電源コモン／0V・0.75sq'],
 ['緑','TB1:6','接地端子：PE','盤内接地／接地端子の締付確認・2.0sq'],
 ['青','TB2:1','PLC：X0 ← PB1：13','運転押ボタン入力／a接点・0.5sq'],
 ['青','TB2:2','PLC：X1 ← PB2：21','停止押ボタン入力／b接点・0.5sq'],
 ['青','TB2:3','PLC：X2 ← LS1：13','原点リミットスイッチ／端子番号照合・0.5sq'],
 ['青','TB2:4','PLC：X3 ← LS2：13','前進端リミットスイッチ入力・0.5sq'],
 ['白','TB2:5','PLC：S/S','入力コモン／入力方式を原図で照合・0.5sq'],
 ['黄','TB2:6','PLC：X4 ← TH1：95','サーマル補助接点／b接点・0.5sq'],
 ['黄','TB3:1','PLC：Y0 → RY1：A1','運転リレー出力／コイル極性確認・0.5sq'],
 ['黄','TB3:2','PLC：Y1 → RY2：A1','停止リレー出力／コイル極性確認・0.5sq'],
 ['黒','TB3:3','RY1：A2・RY2：A2','出力リレー0V共通／渡り線を照合・0.5sq'],
 ['赤','TB3:4','RY1：14 → H1：+','運転表示灯（緑）／DC24V・0.5sq'],
 ['白','TB3:5','H1：−・H2：−','表示灯0V共通／分岐先を照合・0.5sq'],
 ['赤','TB3:6','RY2：14 → H2：+','停止表示灯（赤）／DC24V・0.5sq']
];
const initial=()=>sampleConnections.map(([color,from,to,note],i)=>({id:crypto.randomUUID(),wire:`W${101+i}`,color,from,to,note,done:i%3!==2,sample:i}));
const storageKey='gaina-wiring-v2';
let diagramZoom=1;

let data,project='サンプル案件｜制御盤 A-01',selected,customURL=null,toastTimer;
try{const saved=JSON.parse(localStorage.getItem(storageKey));data=saved?.rows;project=saved?.project||project;if(!Array.isArray(data)||!data.every(r=>typeof r.id==='string'&&typeof r.wire==='string'&&typeof r.from==='string'&&typeof r.to==='string'&&typeof r.note==='string'&&Object.hasOwn(colors,r.color)))data=initial()}catch{data=initial()}
selected=data[0]?.id;$('project').value=project;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){$('toast').textContent=message;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',3000)}
function save(){try{localStorage.setItem(storageKey,JSON.stringify({rows:data,project:$('project').value}))}catch{toast('ブラウザへの保存ができません。CSVで保存してください。')}}
function drawing(){
 if(customURL)return;
 const active=data.find(r=>r.id===selected)?.sample;
 const groups=[['01','電源・保護・接地','TB1 / DC24V・0V・PE'],['02','操作・センサー入力','TB2 / PLCデジタル入力'],['03','リレー・表示灯出力','TB3 / PLCデジタル出力']];
 let svg='<svg viewBox="0 0 820 1040" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="18明細の電源・入力・出力の結線図サンプル"><rect x="12" y="12" width="796" height="1016" fill="white" stroke="#9eafa3"/><g font-family="sans-serif" fill="#415b4a"><text x="34" y="43" font-size="19" font-weight="bold">制御盤 A-01 / 端子接続・展開結線図</text><text x="34" y="65" font-size="11">18配線 / 線番 W101〜W118 / 操作説明用サンプル</text><text x="34" y="84" font-size="10" fill="#a06f40">実際の施工には使用しないでください。電線色・太さ・回路構成は架空です。</text>';
 for(let group=0;group<3;group++){
  const top=105+group*292;
  svg+=`<rect x="30" y="${top}" width="760" height="272" rx="5" fill="#fbfcfa" stroke="#d7e1d6"/><rect x="30" y="${top}" width="760" height="29" fill="#ecf2eb"/><text x="43" y="${top+20}" font-size="12" font-weight="bold">${groups[group][0]}　${groups[group][1]}</text><text x="490" y="${top+20}" font-size="11">${groups[group][2]}</text>`;
  for(let j=0;j<6;j++){
   const index=group*6+j,r=data.find(r=>r.sample===index);if(!r)continue;
   const y=top+53+j*35,on=index===active,color=r.color==='白'?'#91a095':colors[r.color]||'#b5c0b5';
   svg+=`<g data-sample="${index}" class="drawing-wire" role="button" tabindex="0" aria-label="${escapeHTML(r.wire+' '+r.from+'から'+r.to)}" aria-pressed="${on}"><title>${escapeHTML(r.wire+' / '+r.note)}</title><rect x="37" y="${y-14}" width="746" height="32" rx="4" fill="${on?'#deeedb':'transparent'}" stroke="${on?'#7fa975':'transparent'}"/><rect x="50" y="${y-10}" width="128" height="23" rx="2" fill="white" stroke="#afbeb0"/><text x="60" y="${y+5}" font-size="12">${escapeHTML(r.from)}</text><path d="M178 ${y} H310 L325 ${y+5} H577" fill="none" stroke="${color}" stroke-width="${on?4:2}"/><circle cx="178" cy="${y}" r="3" fill="white" stroke="#6f8773"/><circle cx="577" cy="${y+5}" r="3" fill="white" stroke="#6f8773"/><rect x="350" y="${y-10}" width="115" height="22" fill="#fbfcfa"/><text x="359" y="${y+5}" font-size="12" font-weight="bold">${escapeHTML(r.wire)}　${escapeHTML(r.color)}</text><rect x="578" y="${y-10}" width="196" height="24" rx="2" fill="white" stroke="#afbeb0"/><text x="586" y="${y+5}" font-size="10.5">${escapeHTML(r.to)}</text></g>`;
  }
 }
 svg+='<path d="M30 997H790" stroke="#b5c5b7"/><text x="35" y="1015" font-size="10">GAINA / DEMONSTRATION ONLY　　端子・極性・分岐は原図との照合が必要です。</text><text x="680" y="1015" font-size="10">A-01 / 1 of 1</text></g></svg>';
 $('drawing').innerHTML=svg;applyDiagramZoom();
}
function applyDiagramZoom(){const svg=$('drawing').querySelector('svg');if(svg){svg.style.width=(diagramZoom*100)+'%';svg.style.maxWidth='none';}}
$('drawing').onclick=e=>{const line=e.target.closest('[data-sample]');if(!line)return;const row=data.find(r=>r.sample===Number(line.dataset.sample));if(row){const top=$('drawing').scrollTop,left=$('drawing').scrollLeft;select(row.id);$('drawing').scrollTop=top;$('drawing').scrollLeft=left;$('rows').querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});}};
$('drawing').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-sample]')){e.preventDefault();e.target.closest('[data-sample]').dispatchEvent(new MouseEvent('click',{bubbles:true}));}};
$('drawingZoom').onchange=e=>{diagramZoom=Number(e.target.value);applyDiagramZoom()};

function render(){const done=data.filter(r=>r.done).length,percent=data.length?Math.round(done/data.length*100):0;$('stats').innerHTML=`<div><span>配線の総数</span><strong>${data.length}<em>本</em></strong></div><div><span>🟠 要確認</span><strong>${data.length-done}<em>本</em></strong></div><div><span>🟢 確認済み</span><strong>${done}<em>本</em></strong></div><div><span>確認の進み具合</span><strong>${percent}<em>%</em></strong><div class="track"><i style="width:${percent}%"></i></div></div>`;
const q=$('search').value.toLowerCase(),filter=$('filter').value,rows=data.filter(r=>(filter==='all'||r.done===(filter==='done'))&&[r.wire,r.from,r.to,r.color,r.note].join(' ').toLowerCase().includes(q));$('rows').innerHTML=rows.map(r=>`<tr data-id="${escapeHTML(r.id)}" class="${r.id===selected?'selected ':''}${r.done?'confirmed':''}" tabindex="0" aria-selected="${r.id===selected}"><td><strong>${escapeHTML(r.wire)}</strong><small><i class="swatch" style="background:${colors[r.color]}"></i>${escapeHTML(r.color)}</small></td><td>${escapeHTML(r.from)} <span style="color:#a1b09e">→</span> ${escapeHTML(r.to)}<small>${escapeHTML(r.note||'接続情報を照合してください')}</small></td><td><span class="status ${r.done?'done':''}">${r.done?'✓ 確認済み':'要確認'}</span></td></tr>`).join('');$('empty').hidden=rows.length>0;$('count').textContent=`${rows.length} / ${data.length} 本を表示`;drawing()}
function select(id){selected=id;const r=data.find(r=>r.id===id);$('form').hidden=!r;$('title').textContent=r?`${r.wire} の詳細`:'配線を追加してください';if(r)for(const k of ['wire','color','from','to','note'])$('form').elements[k].value=r[k];render();const hit=$('drawing').querySelector('[aria-pressed="true"]');if(hit&&!customURL){const box=$('drawing').getBoundingClientRect(),pos=hit.getBoundingClientRect();if(pos.top<box.top||pos.bottom>box.bottom)$('drawing').scrollTop+=pos.top-box.top-$('drawing').clientHeight/2;}}
$('rows').onclick=e=>{const row=e.target.closest('tr');if(row)select(row.dataset.id)};$('rows').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();const row=e.target.closest('tr');if(row)select(row.dataset.id)}};
$('search').oninput=render;$('filter').onchange=render;$('project').oninput=save;
$('form').onsubmit=e=>{e.preventDefault();const r=data.find(r=>r.id===selected),f=new FormData(e.target);if(!r)return;const next=Object.fromEntries(['wire','color','from','to','note'].map(k=>[k,String(f.get(k)).trim()]));if(!next.wire||!next.from||!next.to){toast('線番・接続元・接続先を入力してください');return}if(data.some(x=>x.id!==r.id&&x.wire===next.wire)){toast('同じ線番が存在します');return}Object.assign(r,next,{done:e.submitter?.value==='confirm'});save();select(r.id);toast(r.done?'配線を確認済みにしました':'保存しました。再確認が必要です。')};
$('add').onclick=()=>{let n=101;while(data.some(r=>r.wire===`W${n}`))n++;const r={id:crypto.randomUUID(),wire:`W${n}`,color:'未設定',from:'',to:'',note:'',done:false};data.push(r);save();select(r.id);$('form').elements.from.focus()};
$('delete').onclick=()=>{if(!confirm('この配線を削除しますか？'))return;data=data.filter(r=>r.id!==selected);save();select(data[0]?.id)};
$('reset').onclick=()=>{if(!confirm('編集内容を消去して、サンプルに戻しますか？'))return;data=initial();$('project').value='サンプル案件｜制御盤 A-01';if(customURL)URL.revokeObjectURL(customURL);customURL=null;$('filename').textContent='制御盤_A-01_サンプル.svg';$('mode').textContent='18明細 / 電源・入力・出力 / 行と図面を相互に選択';$('drawingZoom').disabled=false;diagramZoom=1;$('drawingZoom').value='1';$('upload').value='';$('filter').value='all';$('search').value='';save();select(data[0].id)};
$('upload').onchange=e=>{const f=e.target.files[0];if(!f)return;if(f.type!=='application/pdf'&&!f.type.startsWith('image/')){toast('PDFまたは画像を選択してください');return}if(customURL)URL.revokeObjectURL(customURL);customURL=URL.createObjectURL(f);$('drawing').replaceChildren();const el=document.createElement(f.type==='application/pdf'?'iframe':'img');el.src=customURL;el.title='アップロードした結線図';el.alt='アップロードした結線図';$('drawing').append(el);$('filename').textContent=f.name;$('mode').textContent='アップロード図面 · 自動読取・位置連携は未対応';$('drawingZoom').disabled=true;toast('図面を開きました。一覧は手動編集してください。')};
function csvCell(v){v=String(v);if(/^[\s]*[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'}
$('export').onclick=()=>{const rows=data.filter(r=>r.done).sort((a,b)=>a.color.localeCompare(b.color,'ja')||a.wire.localeCompare(b.wire,'ja',{numeric:true}));if(!rows.length){toast('先に配線を確認済みにしてください');return}const lines=[['案件名','線番','線色','接続元','接続先','作業メモ'],...rows.map(r=>[$('project').value,r.wire,r.color,r.from,r.to,r.note])];const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='配線指示書.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`${rows.length}本の確認済み配線を出力しました`)};
const sheetStyle=`body{font-family: sans-serif;color:#203b2b;margin:32px;font-size:13px}h1{font-size:25px;margin:10px 0}h2{font-size:17px;margin:26px 0 10px}.sheet-meta{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;border-bottom:2px solid #28563c;padding:12px 0}.sheet-summary{padding:12px;background:#f0f5ef}.sheet-sign{display:flex;gap:30px;flex-wrap:wrap;margin:20px 0}.sheet-table{width:100%;border-collapse:collapse;table-layout:fixed}.sheet-table th,.sheet-table td{border:1px solid #b8c8b8;padding:10px 8px;text-align:left;overflow-wrap:anywhere;font-size:12px;position:static}.sheet-table th{background:#edf3eb}.sheet-table td{color:#203b2b}.sheet-table .check{text-align:center;width:48px}.sheet-table .wire{width:70px}.sheet-table .memo-col{width:23%}.sheet-table tr{break-inside:avoid}.sheet-color{display:inline-block;width:12px;height:12px;border:1px solid #7d8e7b;margin-right:8px}.sheet-note{color:#647862;font-size:11px;line-height:1.8;margin-top:15px}@page{size:A4 portrait;margin:14mm}@media print{body{margin:0}.sheet-table thead{display:table-header-group}h2{break-after:avoid}}`;
let sheetHTML='';
function buildSheet(){
 const rows=data.filter(r=>r.done).sort((a,b)=>a.color.localeCompare(b.color,'ja')||a.wire.localeCompare(b.wire,'ja',{numeric:true}));
 if(!rows.length){toast('先に配線を確認済みにしてください');return false}
 const date=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const groups=[...new Set(rows.map(r=>r.color))];
 sheetHTML=`<div class="eyebrow">GAINA / WIRING INSTRUCTIONS</div><h1>配線作業指示書</h1><div class="sheet-meta"><strong>${escapeHTML($('project').value||'案件名未設定')}</strong><span>発行日：${date}（日本時間）</span></div><p class="sheet-summary">指示対象：確認済み ${rows.length}本 ／ ${groups.length}色　｜　未確認 ${data.length-rows.length}本は含みません</p><div class="sheet-sign"><span>作業日：＿＿年＿＿月＿＿日</span><span>作業者：＿＿＿＿＿＿</span><span>確認者：＿＿＿＿＿＿</span></div>`;
 for(const color of groups){const wires=rows.filter(r=>r.color===color);sheetHTML+=`<section><h2><i class="sheet-color" style="background:${colors[color]}"></i>${escapeHTML(color)}の配線 <small style="display:inline">${wires.length}本</small></h2><table class="sheet-table"><thead><tr><th class="check">施工</th><th class="check">照合</th><th class="wire">線番</th><th>接続元</th><th>接続先</th><th class="memo-col">作業メモ</th></tr></thead><tbody>${wires.map(r=>`<tr><td class="check">□</td><td class="check">□</td><td><strong>${escapeHTML(r.wire)}</strong></td><td>${escapeHTML(r.from)}</td><td>${escapeHTML(r.to)}</td><td>${escapeHTML(r.note||'—')}</td></tr>`).join('')}</tbody></table></section>`}
 sheetHTML+='<p class="sheet-note">施工後に「施工」、接続先の照合後に「照合」へチェックしてください。変更点や不明点は図面・担当者と確認してください。サンプル案件の情報は実際の施工には使用しないでください。</p>';
 $('instructionSheet').innerHTML=sheetHTML;return true;
}
$('print').onclick=()=>{if(buildSheet())$('instructionDialog').showModal()};
$('closeSheet').onclick=()=>$('instructionDialog').close();
$('printSheet').onclick=()=>window.print();
$('downloadSheet').onclick=()=>{const doc='<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>配線作業指示書</title><style>'+sheetStyle+'</style></head><body>'+sheetHTML+'</body></html>';const url=URL.createObjectURL(new Blob([doc],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='配線作業指示書.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
const sheetCSS=document.createElement('style');sheetCSS.textContent=sheetStyle.replaceAll('body{','#instructionSheet{').replaceAll('h1{','#instructionSheet h1{').replaceAll('h2{','#instructionSheet h2{');document.head.append(sheetCSS);

select(selected);
