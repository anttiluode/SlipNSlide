import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/prng.js';
import * as controller from '../src/controller.js';
import * as search from '../src/search.js';

function grownController(){
  const base=controller.createController(makeRng(23));
  const residual=new Float64Array(controller.flattenController(base).length);
  residual[0]=1;
  return controller.growResidualRoute(base,residual);
}

test('controllerSlices names route and gate ranges after growth', () => {
  assert.equal(typeof controller.controllerSlices,'function');
  const grown=grownController();
  const slices=controller.controllerSlices(grown);
  const flat=controller.flattenController(grown);
  assert.deepEqual(Object.keys(slices),['route0','route1','gate']);
  assert.equal(slices.route0.start,0);
  assert.equal(slices.route0.end,slices.route1.start);
  assert.equal(slices.route1.end,slices.gate.start);
  assert.equal(slices.gate.end,flat.length);
});

test('maskedProposalBatch is deterministic and zeros every unselected controller slice', () => {
  assert.equal(typeof search.maskedProposalBatch,'function');
  const grown=grownController();
  const slices=controller.controllerSlices(grown);
  const a=search.maskedProposalBatch(grown,makeRng(991),4,0.05,['gate']);
  const b=search.maskedProposalBatch(grown,makeRng(991),4,0.05,['gate']);
  assert.deepEqual(a.map(x=>Array.from(x)),b.map(x=>Array.from(x)));
  for(const delta of a){
    assert.ok(Array.from(delta.slice(0,slices.gate.start)).every(x=>x===0));
    assert.ok(Array.from(delta.slice(slices.gate.start,slices.gate.end)).some(x=>x!==0));
  }

  const specialist=search.maskedProposalBatch(grown,makeRng(992),2,0.05,['route1','gate']);
  for(const delta of specialist){
    assert.ok(Array.from(delta.slice(slices.route0.start,slices.route0.end)).every(x=>x===0));
    assert.ok(Array.from(delta.slice(slices.route1.start)).some(x=>x!==0));
  }
});

test('evaluateForcedRoute measures each grown route through a real rollout without terrain in observations', () => {
  assert.equal(typeof search.evaluateForcedRoute,'function');
  const grown=grownController();
  const r0=search.evaluateForcedRoute(grown,'I',0);
  const r1=search.evaluateForcedRoute(grown,'I',1);
  const r0Again=search.evaluateForcedRoute(grown,'I',0);
  assert.equal(r0.score,r0Again.score);
  assert.ok(Number.isFinite(r0.score) && Number.isFinite(r1.score));
  assert.ok(r0.trace.length>50 && r1.trace.length>50);
  assert.ok(r0.meanGate<1e-12);
  assert.ok(r1.meanGate>1-1e-12);
  for(const p of [...r0.trace,...r1.trace]){
    assert.equal(p.obs.length,5);
    assert.equal('terrain' in p,false);
  }
});
