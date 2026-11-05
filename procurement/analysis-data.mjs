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
// In this sample only, each contemporaneous usual-supplier quote equals the
// historical unit price. Real comparisons must record baseline independently.
for (const material of materials) material.baseline = material.current;
export const copper = {name:'国内銅建値の架空系列',unit:'円/t',basis:'国内・税抜の想定',points:[{date:'2026-05-01',value:1200000},{date:'2026-06-01',value:1230000},{date:'2026-07-01',value:1210000},{date:'2026-08-01',value:1250000},{date:'2026-09-01',value:1280000},{date:'2026-10-01',value:1260000}]};
// These are fictional invoice-reconciled examples, not real customer outcomes.
export const effectRecords = [
 {id:'effect1',material:'cv35',qty:1200,saleUnit:600,stage:'confirmed'},
 {id:'effect2',material:'cv55',qty:800,saleUnit:850,stage:'confirmed'},
 {id:'effect3',material:'cv8',qty:400,saleUnit:1225,stage:'confirmed'},
 {id:'effect4',material:'light',qty:100,saleUnit:15000,stage:'confirmed'},
 {id:'effect5',material:'panel',qty:1,saleUnit:375000,stage:'confirmed'}
];
export function analyzePurchases(rows=materials,other=customer.otherSpend){const categories=[...new Set(rows.map(r=>r.category))].map(name=>({name,spend:rows.filter(r=>r.category===name).reduce((n,r)=>n+r.qty*r.current,0),potential:rows.filter(r=>r.category===name).reduce((n,r)=>n+(Number.isFinite(r.baseline)&&Number.isFinite(r.reference)?r.qty*(r.baseline-r.reference):0),0)}));const targetSpend=categories.reduce((n,c)=>n+c.spend,0),potential=categories.reduce((n,c)=>n+c.potential,0),unassessed=rows.filter(r=>!Number.isFinite(r.baseline)||!Number.isFinite(r.reference)).length,comparisonBase=unassessed?null:rows.reduce((n,r)=>n+r.qty*r.baseline,0)+other;return{categories,targetSpend,spend:targetSpend+other,potential,unassessed,comparisonBase,after:comparisonBase===null?null:comparisonBase-potential}}
export function analyzeEffects(records=effectRecords,rows=materials){let before=0,after=0,sales=0;const details=records.filter(r=>r.stage==='confirmed').map(r=>{const m=rows.find(m=>m.id===r.material);if(!m)throw Error('Unknown material');if(!Number.isFinite(m.baseline))throw Error('同時点の比較基準が未確認です');const b=r.qty*m.baseline,a=r.qty*m.reference,s=r.qty*r.saleUnit;before+=b;after+=a;sales+=s;return{...r,name:m.name,unit:m.unit,before:b,after:a,saving:b-a,sales:s}});return{details,before,after,sales,saving:before-after,beforeProfit:sales-before,afterProfit:sales-after,beforeMargin:sales?(sales-before)/sales*100:null,afterMargin:sales?(sales-after)/sales*100:null}}
export function comparisonScenario(m){const qty=m.compareQty,freight=m.category==='照明'?6000:m.category==='電線'?qty*5:0;const base={name:'仕入分析からの相見積｜'+m.name,product:m.name,model:m.model,manufacturer:m.category==='電線'?'サンプル電線':m.category==='照明'?'サンプル照明':'サンプル電機',unitLabel:m.unit,qty,list:m.list,sale:m.current/0.8,previous:m.baseline??m.current,icon:m.category==='電線'?'cable':m.category==='照明'?'lighting':'panel',copperBase:m.category==='電線'?1260000:null,copperShare:m.category==='電線'?.6:.15};if(m.category==='盤')return{...base,offers:[{id:'a',name:'A電材',unit:295000,freight:0,lead:3,stock:0,restock:14},{id:'b',name:'B電機',unit:290000,freight:5000,lead:10,stock:1,restock:14},{id:'c',name:'C商会',unit:m.reference,freight:0,lead:5,stock:2,restock:10}]};return{...base,offers:[{id:'a',name:'A電材',unit:m.reference+(m.category==='照明'?100:10),freight:0,lead:3,stock:Math.floor(qty/2),restock:14},{id:'b',name:'B電機',unit:m.reference-freight/qty,freight,lead:7,stock:Math.ceil(qty*1.5),restock:10},{id:'c',name:'C商会',unit:m.reference+(m.category==='照明'?70:5),freight:0,lead:3,stock:qty,restock:10}]}}

export const buyingDataRules = [
 {name:'電線',keys:'種類・サイズ（sq/mm）・芯数・メーカー・仕様',quantity:'購入長さ、巻/切売り、1巻の長さ、数量帯',price:'税抜円/m、本体・切断/梱包費・送料を分ける',timing:'見積日・有効期限・適用銅ベース・全数納期'},
 {name:'照明器具',keys:'メーカー・品番・光色/仕様・電源/付属品',quantity:'台数・一括/分納・同品番の購入数量帯',price:'本体単価・当時定価・掛け率・送料込み総額',timing:'見積日・価格改定適用日・有効期限・納期'},
 {name:'盤',keys:'標準品番、または容量・回路数・寸法・仕様',quantity:'面数・同一仕様の数量・付属機器の範囲',price:'仕様をそろえた総額・付属品・運搬/荷卸し費',timing:'見積日・図面/仕様の版・有効期限・納期'}
];
export const proposalQuestions = [
 {q:'電線は時期で価格が変わるから比較できないのでは？',a:'過去価格は傾向把握に使い、改善額は同時点・同仕様・同数量の通常見積と相見積で算定します。銅相場が下がった分をサービスの削減成果に含めません。'},
 {q:'年間2,000万円なら、必ず10%下がるの？',a:'10%は仮定の試算です。実際には比較できる仕入の割合と、商材ごとの確認済み差額から算定します。3%・5%も併記し、改善を保証しません。'},
 {q:'数量・巻売り・送料が違えば、単価は変わるのでは？',a:'同一の依頼条件で見積し、円/mや円/台へ統一。本体と付帯費用を分け、数量帯・一括/分納条件をそろえます。比較できない条件は対象外にします。'},
 {q:'安い代わりに品質や納期が悪くならない？',a:'品番・仕様・付属品と全数がそろう日を確認します。代替品は別枠にし、同等品として確認なく混ぜません。必要日に間に合わない回答は採用候補から外します。'},
 {q:'値引きやリベート、支払条件まで含めて得なの？',a:'事前に合意した基準に、送料・切替費用・失う割戻し等を反映します。仕入先変更による支払負担や保証条件も確認し、価格だけで決めません。'},
 {q:'利益率が増えたと言える根拠は？',a:'同じ対象の材料売上・数量・仕様を固定して、購入後の正味仕入差額を確認します。売上が不明なら削減額のみを報告し、工賃等を含む営業利益とは分けます。'}
];
export const annualExample = {spend:20000000,coverage:1,rate:.1,sales:25000000,extraCost:0};
export function annualImpact({spend,coverage,rate,sales=null,extraCost=0}){
 for(const v of [spend,coverage,rate,extraCost])if(!Number.isFinite(v)||v<0)throw Error('試算条件を確認してください');
 if(coverage>1||rate>1)throw Error('割合は0〜100%にしてください');
 if(sales!==null&&(!Number.isFinite(sales)||sales<=0))throw Error('対応する材料売上を確認してください');
 const target=spend*coverage,grossSaving=target*rate,saving=grossSaving-extraCost,after=spend-saving;
 return{spend,target,grossSaving,saving,after,sales,beforeProfit:sales===null?null:sales-spend,afterProfit:sales===null?null:sales-after,beforeMargin:sales===null?null:(sales-spend)/sales*100,afterMargin:sales===null?null:(sales-after)/sales*100};
}
