import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { runAll } from '../src/experiment.js';
import { runGate2 } from '../src/gate2.js';

test('Gate 2 is deterministic and leaves the matched ordinary control unchanged', () => {
  const a=runGate2(23);
  const b=runGate2(23);
  assert.deepEqual(a,b);
  const gate1=runAll(23);
  assert.deepEqual(a.ordinary,gate1.ordinary);
  assert.deepEqual(a.schedule,gate1.schedule);
});

test('Gate 2 uses the same proposal stream before any structural dimension change', () => {
  const gate1=runAll(23);
  const gate2=runGate2(23);
  assert.equal(gate2.events[0].functional.streamHash,gate1.events[0].thirdway.streamHash);
  assert.equal(gate2.events[1].functional.streamHash,gate1.events[1].thirdway.streamHash);
});

test('every Gate 2 functional event exposes both parameter and functional coherence', () => {
  const r=runGate2(23);
  for(const e of r.events){
    assert.equal(typeof e.functional.parameterCoherence,'number');
    assert.equal(typeof e.functional.functionalCoherence,'number');
    assert.ok(Number.isFinite(e.functional.parameterCoherence));
    assert.ok(Number.isFinite(e.functional.functionalCoherence));
  }
});

test('Gate 2 predeclares geometry separation using the same coherence threshold as Gate 1', () => {
  const r=runGate2(23);
  assert.equal(r.config.minCoherence,CONFIG.minCoherence);
  assert.equal(r.criteria.geometrySeparation.threshold,1);
  assert.equal(typeof r.criteria.geometrySeparation.pass,'boolean');
  assert.ok(['PASS','FAIL'].includes(r.verdict));
});

test('if Gate 2 grows, growth is traceable to functional coherence and one actual residual proposal', () => {
  const r=runGate2(23);
  const growth=r.events.map(e=>e.functional).find(e=>e.grew);
  if(!growth) return;
  assert.ok(growth.growthDetails.triggerFunctionalCoherence>=CONFIG.minCoherence);
  assert.ok(Number.isInteger(growth.growthDetails.representativeEpisode));
  assert.ok(growth.growthDetails.representativeEpisode>=1);
  assert.ok(growth.growthDetails.representativeSimilarity>-1 && growth.growthDetails.representativeSimilarity<=1+1e-12);
  assert.equal('terrain' in growth.growthDetails,false);
});
