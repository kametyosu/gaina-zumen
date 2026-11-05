// Local demo ledger: accepted quotes only, never hypothetical negotiation targets.
import {scenarios,total,lowestQuotes,demoAsOf} from './demo-domain.mjs';
export function acceptQuote(ledger,state,requestId){
 const offer=lowestQuotes(state.offers,state.qty)[0];if(!offer)throw Error('回答がありません');
 const s=scenarios[state.key],id=requestId+':'+state.key;
 const existing=ledger.find(r=>r.id===id);
 const row={id,project:state.project,date:demoAsOf,model:s.model,product:s.product,manufacturer:s.manufacturer,specification:s.specification||s.product,qty:state.qty,unitLabel:s.unitLabel,unit:offer.unit,freight:offer.freight,processing:offer.processing??0,total:total(offer,state.qty),vendor:offer.name,copperBase:offer.copperBase??null,quoteDate:offer.quoteDate??demoAsOf,source:state.documentName||'サンプル相見積',reference:s.previous*state.qty};
 if(existing)return ledger.map(r=>r.id===id?row:r);
 return [...ledger,row];
}
export const projectRows=(ledger,project)=>ledger.filter(r=>r.project===project);
export function ledgerTotals(rows){return{count:rows.length,total:rows.reduce((n,r)=>n+r.total,0),saved:rows.reduce((n,r)=>n+r.reference-r.total,0)}}
export const exportColumns=['現場名','採用日','仕入先','メーカー','品番','商材名','仕様','数量','単位','税抜単価','税抜本体金額','税抜送料','税抜切断梱包費','税抜合計','見積日','適用銅ベース_円t','元資料','明細ID'];
export const exportValues=r=>[r.project,r.date,r.vendor,r.manufacturer,r.model,r.product,r.specification,r.qty,r.unitLabel,r.unit,r.unit*r.qty,r.freight,r.processing,r.total,r.quoteDate,r.copperBase??'',r.source,r.id];
export function exportCsv(rows){const cell=v=>'"'+String(typeof v==='string'&&/^[=+\-@\t\r]/.test(v)?"'"+v:v).replaceAll('"','""')+'"';return '\uFEFF'+[exportColumns,...rows.map(exportValues)].map(r=>r.map(cell).join(',')).join('\r\n');}
export function marketSignal(s,offer){
 if(s.icon==='cable'){const series=[{date:'2026-08-03',value:1260000},{date:'2026-09-01',value:1240000},{date:'2026-10-01',value:1280000},{date:'2026-11-05',value:1260000}];return{kind:'copper',title:'銅ベースは前月比 −2万円/t',series,current:1260000,previous:1280000,rate:(1260000/1280000-1)*100,applied:offer?.copperBase??null,date:demoAsOf,advice:'見積の適用銅ベースと有効期限を確認し、同じ基準で再見積を依頼。',source:'国内銅建値を想定した架空の月次サンプル',note:'銅建値の変動率は電線単価の変動率とは異なります。削減額には加算しません。'};}
 const list=offer?.list??s.list;return{kind:'revision',title:'定価 ＋8%の改定予定',current:list,next:Math.round(list*1.08),rate:8,date:'2026-10-20',effective:'2027-01-01',advice:'見積有効期限と改定前の価格確約が可能か、代理店へ確認。',source:s.manufacturer+'の価格改定を想定した架空のお知らせ',note:'発表日と適用日を分けて表示。現在の見積単価・採用額には自動反映しません。'};
}
