import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/prng.js';
import { CONFIG } from '../src/config.js';
import { createController, flattenController } from '../src/controller.js';
import { makeAnchor, responseVector, collisionRms, selectSafeAlpha, updateResidual, residualCoherence, shouldGrow } from '../src/compatibility.js';

test('finite-rollout collision is zero for the anchored controller and positive after a real edit', () => {
  const c=createController(makeRng(23));
  const anchor=makeAnchor(c,'G',{steps:50});
  assert.equal(collisionRms(anchor,c),0);
  const delta=new Float64Array(flattenController(c).length); delta[delta.length-1]=0.4;
  const picked=selectSafeAlpha({controller:c,delta,targetTerrain:'I',anchors:[anchor],minImprovement:-Infinity,scaleBank:[1],collisionBudget:Infinity,options:{steps:50}});
  assert.ok(picked.collisions[0]>0);
});

test('response vector has fixed coordinates independent of route count contract', () => {
  const c=createController(makeRng(2));
  const v=responseVector(c,'I',{steps:12});
  assert.equal(v.length,12*(CONFIG.hiddenSize+3));
  assert.ok(v.every(Number.isFinite));
});

test('selectSafeAlpha returns the largest scale satisfying target and collision constraints', () => {
  const c=createController(makeRng(5));
  const anchor=makeAnchor(c,'G',{steps:60});
  const dim=flattenController(c).length;
  const delta=new Float64Array(dim); delta[dim-1]=1.2;
  const loose=selectSafeAlpha({controller:c,delta,targetTerrain:'I',anchors:[anchor],minImprovement:-Infinity,scaleBank:[1,.5,.25,0],collisionBudget:Infinity,options:{steps:60}});
  assert.equal(loose.alpha,1);
  const budget=Math.max(1e-12, loose.evaluations.find(e=>e.alpha===0.25).collisions[0]*1.01);
  const tight=selectSafeAlpha({controller:c,delta,targetTerrain:'I',anchors:[anchor],minImprovement:-Infinity,scaleBank:[1,.5,.25,0],collisionBudget:budget,options:{steps:60}});
  assert.ok(tight.alpha<=0.25, JSON.stringify(tight.evaluations));
});

test('signed residual arithmetic preserves direction', () => {
  const R=Float64Array.from([1,-2,0]);
  const d=Float64Array.from([2,4,-6]);
  const out=updateResidual(R,d,0.25,1);
  assert.deepEqual(Array.from(out),[2.5,1,-4.5]);
});

test('growth predicate requires norm, coherence, and repeated clipping', () => {
  assert.equal(shouldGrow({norm:.7,threshold:.58,coherence:.8,minCoherence:.42,clippedCount:2,minClipped:2}),true);
  assert.equal(shouldGrow({norm:.4,threshold:.58,coherence:.8,minCoherence:.42,clippedCount:2,minClipped:2}),false);
  assert.equal(shouldGrow({norm:.7,threshold:.58,coherence:.1,minCoherence:.42,clippedCount:2,minClipped:2}),false);
  assert.equal(shouldGrow({norm:.7,threshold:.58,coherence:.8,minCoherence:.42,clippedCount:1,minClipped:2}),false);
});

test('coherence distinguishes aligned residuals from conflicting directions', () => {
  const aligned=[Float64Array.from([1,0]),Float64Array.from([2,.1]),Float64Array.from([.8,-.05])];
  const incoherent=[Float64Array.from([1,0]),Float64Array.from([-1,0]),Float64Array.from([0,1])];
  assert.ok(residualCoherence(aligned)>0.9);
  assert.ok(residualCoherence(incoherent)<0.2);
});
