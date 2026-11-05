import {materials, comparisonScenario, historyTargets} from './analysis-data.mjs';
export const scenarios={
 lighting:{name:'大阪工場 LED照明更新工事',product:'LEDベースライト 40形',model:'DEMO-L40',manufacturer:'サンプル照明',unitLabel:'台',qty:80,list:30000,sale:15000,previous:12000,icon:'lighting',copperShare:0.12,offers:[{id:'a',name:'A電材',unit:10500,freight:0,lead:3,stock:40,restock:12},{id:'b',name:'B電機',unit:10800,freight:12000,lead:7,stock:120,restock:10},{id:'c',name:'C商会',unit:11100,freight:0,lead:3,stock:80,restock:7}]},
 panel:{name:'事務所改修 分電盤更新工事',product:'標準分電盤 12回路',model:'DEMO-DB12',manufacturer:'サンプル電機',unitLabel:'面',qty:2,list:600000,sale:450000,previous:390000,icon:'panel',copperShare:0.2,offers:[{id:'a',name:'A電材',unit:336000,freight:0,lead:8,stock:1,restock:14},{id:'b',name:'B電機',unit:324000,freight:12000,lead:10,stock:0,restock:10},{id:'c',name:'C商会',unit:330000,freight:0,lead:5,stock:2,restock:12}]},
 cable:{name:'倉庫増設 電源配線工事',product:'電力ケーブル CV 3.5sq × 3C',model:'DEMO-CV35',manufacturer:'サンプル電線',unitLabel:'m',qty:500,list:2000,sale:1500,previous:1200,icon:'cable',copperBase:1260000,copperShare:0.6,offers:[{id:'a',name:'A電材',unit:1040,freight:0,lead:3,stock:200,restock:14},{id:'b',name:'B電機',unit:1080,freight:12000,lead:7,stock:600,restock:10},{id:'c',name:'C商会',unit:1110,freight:0,lead:3,stock:500,restock:7}]}
};
for (const material of materials) scenarios[material.key] = comparisonScenario(material);
export const total=(offer,qty)=>offer.unit*qty+offer.freight+(offer.processing??0);
export const fullLead=(offer,qty)=>offer.stock>=qty?offer.lead:Number.isFinite(offer.restock)?Math.max(offer.lead,offer.restock):Infinity;
export function availability(offer,qty,neededDays=7){const days=fullLead(offer,qty);return{stock:offer.stock,shortage:Math.max(0,qty-offer.stock),days,ready:days<=neededDays,inStock:offer.stock>=qty}}
export const eligible=(offer,delivery,qty=1,neededDays=7)=>fullLead(offer,qty)<=Math.min(neededDays,delivery==='fast'?5:Infinity);
export function lowestQuotes(offers,qty){return offers.filter(o=>o.answered).sort((a,b)=>total(a,qty)-total(b,qty)||a.lead-b.lead)}
export function ranked(offers,qty,delivery='all',neededDays=7){return offers.filter(o=>o.answered&&eligible(o,delivery,qty,neededDays)).sort((a,b)=>total(a,qty)-total(b,qty)||a.lead-b.lead)}
export function summary(scenario,qty,offer){const sales=scenario.sale*qty,before=scenario.previous*qty,after=offer?total(offer,qty):null;return{sales,before,after,saved:after===null?null:before-after,beforeMargin:sales?(sales-before)/sales*100:0,margin:after===null||!sales?null:(sales-after)/sales*100,profit:after===null?null:sales-after}}
export function priceImpact(offer,qty,rate){return Math.round(offer.unit*rate)*qty}
export function copperImpact(offer,qty,copperShare,change){return Math.round(offer.unit*copperShare*change)*qty}
export function createDemo(key='lighting'){const s=scenarios[key]||scenarios.lighting;return{key:scenarios[key]?key:'lighting',project:s.name,qty:s.qty,offers:s.offers.map(o=>({...o,processing:0,quoteDate:s.quoteDate||demoAsOf,copperBase:s.copperBase??null,list:s.list,packing:s.packing||'標準',specification:s.specification||s.product,answered:true,negotiated:false})),selected:null,delivery:'all',adopted:null,requested:false,neededDays:7,batch:[],itemStates:{}}}

export const demoAsOf='2026-11-05';
export function purchaseHistory(key){const s=scenarios[key],m=materials.find(m=>m.key===key);
 if(m){const target=historyTargets[m.id],qty=m.compareQty;return [
  {date:'2026-10-02',vendor:'B電機',qty,unit:target.near,list:s.list,copperBase:s.copperBase??null},
  {date:'2026-09-18',vendor:'A電材',qty:Math.max(1,Math.round(qty*.83)),unit:Math.round(target.near*1.02),list:s.list,copperBase:s.copperBase??null},
  {date:'2026-08-03',vendor:'B電機',qty:target.bulkQty,unit:target.bulk,list:s.list,copperBase:s.copperBase??null},
  {date:'2026-07-10',vendor:'C商会',qty,unit:Math.round(target.near*.97),list:Math.round(s.list/1.08),copperBase:s.icon==='cable'?1210000:null},
  {date:'2026-04-22',vendor:'A電材',qty:Math.max(1,Math.round(qty*.5)),unit:Math.round(target.near*1.05),list:s.list,copperBase:s.icon==='cable'?1180000:null},
  {date:'2025-12-15',vendor:'B電機',qty,unit:Math.round(target.near*.95),list:null,copperBase:s.icon==='cable'?1160000:null}
 ].map(h=>({...h,manufacturer:s.manufacturer,model:s.model,wireType:s.wireType,size:s.size,cores:s.cores,packing:s.packing,specification:s.specification,freight:s.offers.find(o=>o.id==='b')?.freight??0,processing:0}));}
 return [
 {date:'2026-10-02',vendor:'B電機',qty:Math.round(s.qty*1.25),list:s.list,rate:39},
 {date:'2026-09-18',vendor:'A電材',qty:s.qty,list:s.list,rate:40},
 {date:'2026-07-10',vendor:'C商会',qty:s.qty,list:s.list,rate:41},
 {date:'2026-04-22',vendor:'A電材',qty:Math.round(s.qty*.75),list:s.list,rate:42},
 {date:'2025-12-15',vendor:'B電機',qty:s.qty,list:Math.round(s.list/1.08),rate:42},
 {date:'2026-08-03',vendor:'A電材',qty:s.qty,list:null,rate:null}
 ].map((h,index)=>({...h,manufacturer:s.manufacturer,model:s.model,packing:s.packing||'標準',specification:s.specification||s.product,processing:0,freight:index===0?0:1000,copperBase:s.icon==='cable'?[1260000,1280000,1210000,1180000,1160000,1250000][index]:null,unit:s.icon==='cable'?Math.round(s.previous*[1,1.02,.97,.95,.94,1.01][index]):h.list?Math.round(h.list*h.rate/100):s.previous}))}
export function rateBenchmark(history,manufacturer,model,qty,asOf=demoAsOf){const end=new Date(asOf+'T00:00:00Z'),start=new Date(end);start.setUTCFullYear(start.getUTCFullYear()-1);const since=start.toISOString().slice(0,10);const matching=history.filter(h=>h.manufacturer===manufacturer&&h.model===model&&h.qty>=qty*.5&&h.qty<=qty*2&&h.date>=since&&h.date<=asOf);const records=matching.filter(h=>Number.isFinite(h.list)&&h.list>0&&Number.isFinite(h.unit)&&h.unit>=0);const rates=records.map(h=>h.unit/h.list*100).sort((a,b)=>a-b);const n=rates.length,median=n?(n%2?rates[(n-1)/2]:(rates[n/2-1]+rates[n/2])/2):null;return{records,count:n,excluded:matching.length-n,min:n?rates[0]:null,max:n?rates.at(-1):null,median,since,asOf}}
export function validateDemo(s){return s&&scenarios[s.key]&&typeof s.project==='string'&&s.project.length<=100&&Number.isInteger(s.qty)&&s.qty>0&&s.qty<=10000&&Number.isInteger(s.neededDays)&&s.neededDays>=1&&s.neededDays<=365&&['all','fast'].includes(s.delivery)&&Array.isArray(s.offers)&&s.offers.length>=1&&s.offers.length<=3&&new Set(s.offers.map(o=>o.id)).size===s.offers.length&&s.offers.every(o=>['a','b','c'].includes(o.id)&&typeof o.name==='string'&&[o.unit,o.freight,o.lead,o.stock,o.restock].every(Number.isFinite)&&o.unit>=0&&o.freight>=0&&(o.processing===undefined||Number.isFinite(o.processing)&&o.processing>=0)&&o.stock>=0&&o.lead>=1&&o.restock>=1)&&Array.isArray(s.batch)&&s.batch.every(i=>scenarios[i.key]&&Number.isInteger(i.qty)&&i.qty>0&&i.qty<=10000)&&new Set(s.batch.map(i=>i.key)).size===s.batch.length&&s.itemStates&&typeof s.itemStates==='object'}

// Three independent same-material scenarios. They never mutate a quote.
export function quoteTerms(s,offer){return{manufacturer:s.manufacturer,model:s.model,specification:offer.specification??s.specification??s.product,packing:offer.packing??s.packing??'標準',wireType:offer.wireType??s.wireType,size:offer.size??s.size,cores:offer.cores??s.cores,date:offer.quoteDate??s.quoteDate??demoAsOf,copperBase:Object.hasOwn(offer,'copperBase')?offer.copperBase:s.copperBase??null,list:Object.hasOwn(offer,'list')?offer.list:s.list};}
export function profitRecommendations(key,qty,offer,history=purchaseHistory(key)){
 const s=scenarios[key];if(!s||!offer||!Number.isFinite(qty)||qty<=0||!Number.isFinite(offer.unit)||offer.unit<0||!Number.isFinite(offer.freight)||offer.freight<0||offer.processing!==undefined&&(!Number.isFinite(offer.processing)||offer.processing<0))return [];
 const terms=quoteTerms(s,offer),since=new Date(terms.date+'T00:00:00Z');
 if(Number.isNaN(since.getTime()))return [];
 since.setUTCFullYear(since.getUTCFullYear()-1);
 const records=history.filter(h=>h.manufacturer===terms.manufacturer&&h.model===terms.model&&h.specification===terms.specification&&h.packing===terms.packing&&(s.icon!=='cable'||h.wireType===terms.wireType&&h.size===terms.size&&h.cores===terms.cores)&&h.qty>0&&h.date>=since.toISOString().slice(0,10)&&h.date<=terms.date);
 const comparable=h=>s.icon==='cable'?Number.isFinite(terms.copperBase)&&h.copperBase===terms.copperBase:Number.isFinite(h.list)&&h.list>0&&Number.isFinite(terms.list)&&terms.list>0;
 const normalizedUnit=h=>s.icon==='cable'?h.unit:Math.round(h.unit/h.list*terms.list);
 const near=rows=>rows.filter(h=>h.qty>=qty*.8&&h.qty<=qty*1.2).sort((a,b)=>Math.abs(a.qty-qty)-Math.abs(b.qty-qty)||b.date.localeCompare(a.date));
 const unitRecords=records.filter(h=>comparable(h)&&Number.isFinite(h.unit)&&h.unit>=0);
 const unitRecord=near(unitRecords)[0]||null;
 const bulkRecord=unitRecords.filter(h=>h.qty>qty&&h.qty<=qty*1.5).sort((a,b)=>a.qty-b.qty||b.date.localeCompare(a.date))[0]||null;
 const feeRecord=near(records.filter(h=>Number.isFinite(h.freight)&&h.freight>=0&&Number.isFinite(h.processing)&&h.processing>=0))[0]||null;
 function result(type,record,scopeQty,targetUnit,targetFreight,targetProcessing){
  const currentTotal=total(offer,scopeQty),targetTotal=targetUnit*scopeQty+targetFreight+targetProcessing,sales=s.sale*scopeQty,gain=currentTotal-targetTotal;
  return{type,materialKey:key,model:s.model,terms,record,currentQty:qty,qty:scopeQty,additionalQty:scopeQty-qty,currentUnit:offer.unit,currentFreight:offer.freight,currentProcessing:offer.processing??0,currentTotal,actualCurrentTotal:total(offer,qty),suggestedUnit:record&&type!=='fees'?normalizedUnit(record):null,targetUnit,targetFreight,targetProcessing,targetTotal,gain,beforeProfit:sales-currentTotal,afterProfit:sales-targetTotal,beforeMargin:sales?(sales-currentTotal)/sales*100:null,afterMargin:sales?(sales-targetTotal)/sales*100:null,points:sales?gain/sales*100:null,status:record?(gain>0?'ready':'no-gain'):'no-data'};
 }
 const price=result('price',unitRecord,qty,unitRecord?Math.min(offer.unit,normalizedUnit(unitRecord)):offer.unit,offer.freight,offer.processing??0);
 const bulkQty=bulkRecord?.qty??qty;
 const quantity=result('quantity',bulkRecord,bulkQty,bulkRecord?Math.min(offer.unit,normalizedUnit(bulkRecord)):offer.unit,offer.freight,offer.processing??0);
 const currentFees=offer.freight+(offer.processing??0),pastFees=feeRecord?feeRecord.freight+feeRecord.processing:Infinity;
 const fees=result('fees',feeRecord,qty,offer.unit,pastFees<currentFees?feeRecord.freight:offer.freight,pastFees<currentFees?feeRecord.processing:offer.processing??0);
 return[price,quantity,fees];
}
export function profitAction(key,qty,offer,history=purchaseHistory(key)){const a=profitRecommendations(key,qty,offer,history)[0];return a?{...a,kind:a.gain>0?'unit':'hold'}:null}
