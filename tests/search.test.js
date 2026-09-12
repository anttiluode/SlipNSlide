import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/prng.js';
import { createController, flattenController } from '../src/controller.js';
import { proposalBatch, scoreProposal, bestProposal, evaluateController } from '../src/search.js';

test('same seed and dimension yield identical candidate streams', () => {
  const baseA=createController(makeRng(23));
  const baseB=createController(makeRng(23));
  const a=proposalBatch(baseA,makeRng(991),6,0.05);
  const b=proposalBatch(baseB,makeRng(991),6,0.05);
  assert.equal(a.length,6);
  assert.equal(a[0].length,flattenController(baseA).length);
  assert.deepEqual(a.map(x=>Array.from(x)),b.map(x=>Array.from(x)));
});

test('every proposal score is produced by a real deterministic rollout', () => {
  const base=createController(makeRng(3));
  const [delta]=proposalBatch(base,makeRng(4),1,0.03);
  const s1=scoreProposal(base,delta,'G');
  const s2=scoreProposal(base,delta,'G');
  assert.equal(s1.score,s2.score);
  assert.ok(s1.trace.length>50);
  assert.ok(Number.isFinite(s1.meanSlip));
});

test('bestProposal exposes every candidate score and can decline a non-improving batch', () => {
  const base=createController(makeRng(7));
  const zero = new Float64Array(flattenController(base).length);
  const res=bestProposal(base,'G',[zero,zero],1e-6);
  assert.equal(res.proposal,null);
  assert.equal(res.candidateScores.length,2);
  assert.equal(res.baseScore,evaluateController(base,'G').score);
});
