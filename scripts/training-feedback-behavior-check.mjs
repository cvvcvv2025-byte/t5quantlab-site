import assert from 'node:assert/strict';
import { summarizeFeedback, summaryMarkup } from '../assets/breakout-pilot/feedback-summary.js';
const pass = {action:true,reason:true,condition:true};
const wrong = {action:false,reason:true,condition:false};
let result = summarizeFeedback([]);
assert.equal(result.assessed,0);
assert.match(summaryMarkup(result),/尚未作答不代表存在盲点/);

// Pending or malformed feedback must not enter either denominator or advice.
result = summarizeFeedback([{id:'sealed',firstGrade:null,latestGrade:null},
  {id:'partial',firstGrade:{action:false},latestGrade:wrong}]);
assert.equal(result.assessed,0);
assert.equal(result.pending,2);
assert.ok(result.dimensions.every(d=>d.repairIds.length===0));
assert.doesNotMatch(summaryMarkup(result),/首次匹配|失效边界|实盘能力/);

const rows = [{id:'A',firstGrade:wrong,latestGrade:pass},
  {id:'B',firstGrade:pass,latestGrade:wrong},
  {id:'C',firstGrade:null,latestGrade:null}];
const before = JSON.stringify(rows);
result = summarizeFeedback(rows);
assert.equal(result.assessed,2);
assert.equal(result.pending,1);
assert.equal(result.dimensions[0].firstMatched,1);
assert.equal(result.dimensions[0].latestMatched,1);
assert.deepEqual(result.dimensions[0].repairIds,['B']);
assert.deepEqual(result.dimensions[1].repairIds,[]);
assert.deepEqual(result.dimensions[2].repairIds,['B']);
assert.equal(JSON.stringify(rows),before,'Summaries must never mutate first attempts');
assert.match(summaryMarkup(result),/仅根据2个/);
assert.match(summaryMarkup(result),/另有1个/);
assert.match(summaryMarkup(result),/补做不覆盖首次记录/);
assert.doesNotMatch(summaryMarkup(result),/能力提升|超过.*用户|排名/);
console.log('Training feedback behavior OK: sealed grades excluded, precise dimensions, immutable first attempts, bounded claims.');
