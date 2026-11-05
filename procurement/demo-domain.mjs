export const scenarios={
 lighting:{name:'大阪工場 LED照明更新工事',product:'LEDベースライト 40形',model:'DEMO-L40',manufacturer:'サンプル照明',unitLabel:'台',qty:80,list:30000,sale:15000,previous:12000,icon:'lighting',copperShare:0.12,offers:[{id:'a',name:'A電材',unit:11400,freight:0,lead:5},{id:'b',name:'B電機',unit:10800,freight:12000,lead:7},{id:'c',name:'C商会',unit:11100,freight:0,lead:3}]},
 panel:{name:'事務所改修 分電盤更新工事',product:'標準分電盤 12回路',model:'DEMO-DB12',manufacturer:'サンプル電機',unitLabel:'面',qty:2,list:600000,sale:450000,previous:390000,icon:'panel',copperShare:0.2,offers:[{id:'a',name:'A電材',unit:336000,freight:0,lead:8},{id:'b',name:'B電機',unit:324000,freight:12000,lead:10},{id:'c',name:'C商会',unit:330000,freight:0,lead:5}]},
 cable:{name:'倉庫増設 電源配線工事',product:'電力ケーブル CV 3.5sq × 3C',model:'DEMO-CV35',manufacturer:'サンプル電線',unitLabel:'m',qty:500,list:2000,sale:1500,previous:1200,icon:'cable',copperShare:0.6,offers:[{id:'a',name:'A電材',unit:1140,freight:0,lead:5},{id:'b',name:'B電機',unit:1080,freight:12000,lead:7},{id:'c',name:'C商会',unit:1110,freight:0,lead:3}]}
};
export const total=(offer,qty)=>offer.unit*qty+offer.freight;
export const eligible=(offer,delivery)=>delivery!=='fast'||offer.lead<=5;
export function ranked(offers,qty,delivery='all'){return offers.filter(o=>o.answered&&eligible(o,delivery)).sort((a,b)=>total(a,qty)-total(b,qty)||a.lead-b.lead)}
export function summary(scenario,qty,offer){const sales=scenario.sale*qty,before=scenario.previous*qty,after=offer?total(offer,qty):null;return{sales,before,after,saved:after===null?null:before-after,beforeMargin:sales?(sales-before)/sales*100:0,margin:after===null||!sales?null:(sales-after)/sales*100,profit:after===null?null:sales-after}}
export function priceImpact(offer,qty,rate){return Math.round(offer.unit*rate)*qty}
export function copperImpact(offer,qty,copperShare,change){return Math.round(offer.unit*copperShare*change)*qty}
export function createDemo(key='lighting'){const s=scenarios[key]||scenarios.lighting;return{key:scenarios[key]?key:'lighting',project:s.name,qty:s.qty,offers:s.offers.map(o=>({...o,answered:true,negotiated:false})),selected:null,delivery:'all',adopted:null,requested:false}}
