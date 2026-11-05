// Entirely fictional, internally consistent customer demonstration dataset.
export const customer = { name:'サンプル電気工事店', period:'2026年5月〜10月', asOf:'2026-11-05', materialSales:30000000, otherSpend:1200000, trial:'2026年11月〜12月', review:'2027年1月' };
export const materials = [
 {id:'cv35',key:'analysis_cv35',category:'電線',name:'CV 3.5sq × 3C',model:'DEMO-CV35',unit:'m',qty:6000,current:480,reference:450,low:440,high:460,compareQty:1200,list:1200},
 {id:'cv55',key:'analysis_cv55',category:'電線',name:'CV 5.5sq × 3C',model:'DEMO-CV55',unit:'m',qty:4000,current:680,reference:640,low:625,high:655,compareQty:800,list:1800},
 {id:'cv8',key:'analysis_cv8',category:'電線',name:'CV 8sq × 3C',model:'DEMO-CV8',unit:'m',qty:2500,current:980,reference:920,low:900,high:945,compareQty:400,list:2500},
 {id:'cv14',key:'analysis_cv14',category:'電線',name:'CV 14sq × 3C',model:'DEMO-CV14',unit:'m',qty:1500,current:1580,reference:1490,low:1460,high:1520,compareQty:300,list:4000},
 {id:'cv22',key:'analysis_cv22',category:'電線',name:'CV 22sq × 3C',model:'DEMO-CV22',unit:'m',qty:1000,current:2380,reference:2250,low:2200,high:2300,compareQty:200,list:6000},
 {id:'vvf20',key:'analysis_vvf20',category:'電線',name:'VVF 2.0mm × 3C',model:'DEMO-VVF20',unit:'m',qty:5000,current:320,reference:305,low:295,high:315,compareQty:1000,list:850},
 {id:'light',key:'analysis_light',category:'照明',name:'LEDベースライト 40形',model:'DEMO-L40',unit:'台',qty:500,current:12000,reference:11280,low:11000,high:11500,compareQty:100,list:30000},
 {id:'panel',key:'analysis_panel',category:'盤',name:'標準分電盤 12回路',model:'DEMO-DB12',unit:'面',qty:8,current:300000,reference:285000,low:279000,high:290000,compareQty:1,list:600000}
];
export const copper = {name:'国内銅建値の架空系列',unit:'円/t',basis:'国内・税抜の想定',points:[{date:'2026-05-01',value:1200000},{date:'2026-06-01',value:1230000},{date:'2026-07-01',value:1210000},{date:'2026-08-01',value:1250000},{date:'2026-09-01',value:1280000},{date:'2026-10-01',value:1260000}]};
// These are fictional invoice-reconciled examples, not real customer outcomes.
export const effectRecords = [
 {id:'effect1',material:'cv35',qty:1200,saleUnit:600,stage:'confirmed'},
 {id:'effect2',material:'cv55',qty:800,saleUnit:850,stage:'confirmed'},
 {id:'effect3',material:'cv8',qty:400,saleUnit:1225,stage:'confirmed'},
 {id:'effect4',material:'light',qty:100,saleUnit:15000,stage:'confirmed'},
 {id:'effect5',material:'panel',qty:1,saleUnit:375000,stage:'confirmed'}
];
export function analyzePurchases(rows=materials,other=customer.otherSpend){const categories=[...new Set(rows.map(r=>r.category))].map(name=>({name,spend:rows.filter(r=>r.category===name).reduce((n,r)=>n+r.qty*r.current,0),potential:rows.filter(r=>r.category===name).reduce((n,r)=>n+r.qty*(r.current-r.reference),0)}));const targetSpend=categories.reduce((n,c)=>n+c.spend,0),potential=categories.reduce((n,c)=>n+c.potential,0);return{categories,targetSpend,spend:targetSpend+other,potential,after:targetSpend+other-potential}}
export function analyzeEffects(records=effectRecords,rows=materials){let before=0,after=0,sales=0;const details=records.filter(r=>r.stage==='confirmed').map(r=>{const m=rows.find(m=>m.id===r.material);if(!m)throw Error('Unknown material');const b=r.qty*m.current,a=r.qty*m.reference,s=r.qty*r.saleUnit;before+=b;after+=a;sales+=s;return{...r,name:m.name,unit:m.unit,before:b,after:a,saving:b-a,sales:s}});return{details,before,after,sales,saving:before-after,beforeProfit:sales-before,afterProfit:sales-after,beforeMargin:sales?(sales-before)/sales*100:null,afterMargin:sales?(sales-after)/sales*100:null}}
export function comparisonScenario(m){const qty=m.compareQty,freight=m.category==='照明'?6000:m.category==='電線'?qty*5:0;const base={name:'仕入分析からの相見積｜'+m.name,product:m.name,model:m.model,manufacturer:m.category==='電線'?'サンプル電線':m.category==='照明'?'サンプル照明':'サンプル電機',unitLabel:m.unit,qty,list:m.list,sale:m.current/0.8,previous:m.current,icon:m.category==='電線'?'cable':m.category==='照明'?'lighting':'panel',copperShare:m.category==='電線'?.6:.15};if(m.category==='盤')return{...base,offers:[{id:'a',name:'A電材',unit:279000,freight:0,lead:3,stock:0,restock:14},{id:'b',name:'B電機',unit:280000,freight:5000,lead:10,stock:1,restock:14},{id:'c',name:'C商会',unit:m.reference,freight:0,lead:5,stock:2,restock:10}]};return{...base,offers:[{id:'a',name:'A電材',unit:m.low,freight:0,lead:3,stock:Math.floor(qty/2),restock:14},{id:'b',name:'B電機',unit:m.reference-freight/qty,freight,lead:7,stock:Math.ceil(qty*1.5),restock:10},{id:'c',name:'C商会',unit:m.reference+(m.category==='照明'?70:5),freight:0,lead:3,stock:qty,restock:10}]}}
