import test from 'node:test';import assert from 'node:assert/strict';
import{scenarios,createDemo,ranked,summary,priceImpact,copperImpact,availability,purchaseHistory,rateBenchmark,lowestQuotes}from'../procurement/demo-domain.mjs';
test('送料を含めて最安条件を選び、材料粗利の改善を算出',()=>{const s=createDemo(),o=ranked(s.offers,s.qty)[0],m=summary(scenarios.lighting,s.qty,o);assert.equal(o.id,'b');assert.equal(m.after,876000);assert.equal(m.saved,84000);assert.equal(m.beforeMargin,20);assert.equal(m.margin,27)});
test('納期を指定したら安くても間に合わない回答を候補から除外',()=>{const s=createDemo(),o=ranked(s.offers,s.qty,'fast')[0];assert.equal(o.id,'c');assert.equal(summary(scenarios.lighting,s.qty,o).after,888000)});
test('回答待ちは候補に含めず、回答ゼロを金額ゼロと表示しない',()=>{const s=createDemo();s.offers.forEach(o=>o.answered=false);assert.equal(ranked(s.offers,s.qty).length,0);assert.equal(summary(scenarios.lighting,s.qty,null).after,null)});
test('値上げ影響と銅比率の概算は金額条件から計算',()=>{const s=createDemo(),o=ranked(s.offers,s.qty)[0];assert.equal(priceImpact(o,s.qty,.08),69120);const cable=createDemo('cable'),co=ranked(cable.offers,cable.qty)[0];assert.equal(copperImpact(co,cable.qty,.6,.1),32500)});

test('最安でも在庫不足で全数が必要日に届かない代理店を除外',()=>{const s=createDemo(),a=s.offers.find(o=>o.id==='a');assert.equal(a.unit*s.qty+a.freight,840000);assert.equal(ranked(s.offers,s.qty).some(o=>o.id==='a'),false);assert.equal(ranked(s.offers,s.qty,'all',14)[0].id,'a')});

test('不足分の入荷まで含めて納入可能日を判定',()=>{const s=createDemo(),a=s.offers[0],status=availability(a,80,7);assert.equal(status.shortage,40);assert.equal(status.days,12);assert.equal(status.ready,false);assert.equal(availability(a,40,7).days,3)});
test('掛け率は当時の定価で計算し、定価不明を除外',()=>{const s=scenarios.lighting,h=rateBenchmark(purchaseHistory('lighting'),s.manufacturer,s.model,80);assert.equal(h.count,5);assert.equal(h.excluded,1);assert.equal(h.median,41);assert.equal(h.min,39);assert.ok(Math.abs(h.max-42)<0.01)});
test('異なる型番・遠い数量・期間外の実績は目安に混ぜない',()=>{const h=[{manufacturer:'M',model:'X',date:'2026-10-01',qty:80,list:100,unit:40},{manufacturer:'M',model:'Y',date:'2026-10-01',qty:80,list:100,unit:20},{manufacturer:'M',model:'X',date:'2026-10-01',qty:1000,list:100,unit:10},{manufacturer:'M',model:'X',date:'2020-01-01',qty:80,list:100,unit:5}];const b=rateBenchmark(h,'M','X',80);assert.equal(b.count,1);assert.equal(b.median,40)});

test('現在のデモは在庫や納期で除外せず、回答済みの送料込み最安を選ぶ',()=>{const s=createDemo('analysis_cv35');s.offers[0]={...s.offers[0],unit:400,freight:0,stock:0,lead:20,restock:30};assert.equal(lowestQuotes(s.offers,s.qty)[0].id,'a')});
test('単価より送料込み総額を優先し、未回答は最安にしない',()=>{const offers=[{id:'a',unit:100,freight:100,lead:1,answered:true},{id:'b',unit:105,freight:0,lead:7,answered:true},{id:'c',unit:1,freight:0,lead:1,answered:false}];assert.equal(lowestQuotes(offers,10)[0].id,'b')});
test('電線履歴に仕入日・購入量・当時の銅ベース・単価がそろう',()=>{const history=purchaseHistory('analysis_cv35');assert.equal(history[0].copperBase,1260000);assert.equal(history[0].unit,480);assert.ok(history.every(h=>h.date&&h.qty>0&&Number.isFinite(h.copperBase)&&Number.isFinite(h.unit)))});
