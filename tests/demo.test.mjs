import test from 'node:test';import assert from 'node:assert/strict';
import{scenarios,createDemo,ranked,summary,priceImpact,copperImpact}from'../procurement/demo-domain.mjs';
test('送料を含めて最安条件を選び、材料粗利の改善を算出',()=>{const s=createDemo(),o=ranked(s.offers,s.qty)[0],m=summary(scenarios.lighting,s.qty,o);assert.equal(o.id,'b');assert.equal(m.after,876000);assert.equal(m.saved,84000);assert.equal(m.beforeMargin,20);assert.equal(m.margin,27)});
test('納期を指定したら安くても間に合わない回答を候補から除外',()=>{const s=createDemo(),o=ranked(s.offers,s.qty,'fast')[0];assert.equal(o.id,'c');assert.equal(summary(scenarios.lighting,s.qty,o).after,888000)});
test('回答待ちは候補に含めず、回答ゼロを金額ゼロと表示しない',()=>{const s=createDemo();s.offers.forEach(o=>o.answered=false);assert.equal(ranked(s.offers,s.qty).length,0);assert.equal(summary(scenarios.lighting,s.qty,null).after,null)});
test('値上げ影響と銅比率の概算は金額条件から計算',()=>{const s=createDemo(),o=ranked(s.offers,s.qty)[0];assert.equal(priceImpact(o,s.qty,.08),69120);const cable=createDemo('cable'),co=ranked(cable.offers,cable.qty)[0];assert.equal(copperImpact(co,cable.qty,.6,.1),32500)});
