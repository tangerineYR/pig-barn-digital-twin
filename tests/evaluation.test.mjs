import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWindow } from '../src/evaluationData.js';
import { makeReplayExample, validateReplay } from '../src/replayData.js';
import { visibleReplay } from '../src/replayClock.js';
const fixture=()=>validateReplay(makeReplayExample());
test('common evaluation computes baseline delta and interval coverage',()=>{
 const r=fixture().records,m=evaluateWindow(r,['before','after'],0,Date.now(),'before');
 assert.equal(m[0].count,10);assert.ok(Math.abs(m[1].deltaMae+.04)<1e-9);
 assert.equal(m[0].coverage,0);assert.equal(m[1].coverage,1);
});
test('window retains an absent selected condition and exposes excluded samples',()=>{
 const r=fixture().records.filter(r=>r.condition_id==='before');
 const m=evaluateWindow(r,['before','after'],0,Date.now(),'before');
 assert.equal(m[0].count,0);assert.equal(m[0].excluded,10);assert.equal(m[1].candidates,0);
});
test('Replay evaluation never reveals future actuals; interval N excludes missing bounds',()=>{
 const r=fixture().records,t=Date.parse(r[0].target_at);
 assert.equal(evaluateWindow(visibleReplay(r,t-1,false),['before','after'],0,t,'before')[0].count,0);
 r[1].lower=null;r[1].upper=null;
 const m=evaluateWindow(visibleReplay(r,t,false),['before','after'],t,t,'before');
 assert.equal(m[0].count,1);assert.equal(m[0].intervalCount,0);
});
test('reject mixed farms, reversed dates and mixed model versions',()=>{
 const f=fixture();f.records[2].model_version='other';assert.throws(()=>validateReplay(f),/버전/);
 assert.throws(()=>evaluateWindow(f.records,[],3,2,''),/시각/);
 f.records[0].farm_id='another';assert.throws(()=>evaluateWindow(f.records,[],0,3,''),/농장/);
});

// Deliberately invented values: exact SSE/SST can be checked independently.
const pairedRows = (actuals, predictions) => actuals.flatMap((actual, i) =>
 Object.entries(predictions).map(([condition_id, values]) => ({
  farm_id:'test-farm', condition_id, actual, prediction:values[i], lower:null, upper:null,
  observed_at:new Date(Date.UTC(2024,0,1,0,i)).toISOString(),
  target_at:new Date(Date.UTC(2024,0,1,0,i+30)).toISOString(),
 })));
const evaluate = rows => evaluateWindow(rows,['a','b'],0,Date.UTC(2025,0,1),'a');

test('R² uses 1 - SSE/SST and preserves perfect and negative scores',()=>{
 // Actual mean=3, SST=8; SSE=2 for a and 32 for b.
 const metrics=evaluate(pairedRows([1,3,5],{a:[2,3,4],b:[5,3,1]}));
 assert.equal(metrics[0].r2,.75); assert.equal(metrics[1].r2,-3);
 assert.equal(evaluate(pairedRows([1,3,5],{a:[1,3,5],b:[1,3,5]}))[0].r2,1);
});
test('R² is null for no pairs, one pair or constant actuals',()=>{
 for (const actuals of [[],[2],[2,2,2],[.1,.1,.1]]) {
  const metrics=evaluate(pairedRows(actuals,{a:actuals,b:actuals.map(v=>v+1)}));
  assert.ok(metrics.every(m=>m.r2===null));
 }
});
test('R² uses the shared point cohort, including points without intervals',()=>{
 const rows=pairedRows([1,3,5,100],{a:[2,3,4,0],b:[1,4,5,null]});
 rows.push(...pairedRows([200],{a:[0]}).map(r=>({...r,observed_at:'2024-01-01T01:00:00Z',target_at:'2024-01-01T01:30:00Z'})));
 const metrics=evaluate(rows);
 assert.deepEqual(metrics.map(m=>m.count),[3,3]);
 assert.deepEqual(metrics.map(m=>m.intervalCount),[0,0]);
 assert.equal(metrics[0].r2,.75); assert.equal(metrics[1].r2,.875);
 assert.equal(metrics[0].mae,2/3); assert.equal(metrics[0].rmse,Math.sqrt(2/3));
});
test('R² respects the evaluation window and Replay truth visibility',()=>{
 const rows=pairedRows([1,3,5],{a:[2,3,4],b:[1,3,5]});
 const first=Date.parse(rows[0].target_at), second=first+60000;
 assert.ok(evaluate(visibleReplay(rows,first,false)).every(m=>m.r2===null));
 const metrics=evaluateWindow(visibleReplay(rows,second,false),['a','b'],first,second,'a');
 assert.equal(metrics[0].count,2); assert.equal(metrics[0].r2,.5);
 assert.equal(metrics[1].r2,1);
 assert.ok(evaluateWindow(rows,['a','b'],first,first,'a').every(m=>m.r2===null));
});
