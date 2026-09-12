import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createExperiment, stepEpisode, runAll } from '../src/experiment.js';

test('matched arms receive identical candidate stream on the first episode', () => {
  const exp=createExperiment(19);
  const event=stepEpisode(exp);
  assert.equal(event.ordinary.streamHash,event.thirdway.streamHash);
  assert.equal(event.terrain,CONFIG.schedule[0]);
});

test('growth decision has no terrain-trigger field', () => {
  const exp=createExperiment(17);
  const event=stepEpisode(exp);
  assert.equal(Object.hasOwn(event.thirdway,'growthTerrainTrigger'),false);
  assert.equal(Object.hasOwn(exp.arms.thirdway,'terrainGate'),false);
});

test('same seed reproduces the entire experiment receipt', () => {
  const a=runAll(23);
  const b=runAll(23);
  assert.deepEqual(a,b);
  assert.equal(a.seed,23);
  assert.equal(a.events.length,CONFIG.schedule.length);
});

test('result always exposes explicit frozen criteria and PASS/FAIL verdict', () => {
  const r=runAll(23);
  assert.ok(['PASS','FAIL'].includes(r.verdict));
  assert.equal(typeof r.criteria.ordinaryConflict.pass,'boolean');
  assert.equal(typeof r.criteria.growthTriggered.pass,'boolean');
  assert.equal(typeof r.criteria.tailAdvantage.pass,'boolean');
  assert.equal(typeof r.criteria.gateUsesState.pass,'boolean');
  assert.equal(typeof r.criteria.traceableIncompatibility.pass,'boolean');
});

test('clipped seed-23 events expose the attempted full-write collision, not only the safe selected collision', () => {
  const r=runAll(23);
  const clipped=r.events.filter(e=>e.thirdway.alpha<1 && e.thirdway.proposalId!==null);
  assert.ok(clipped.length>0);
  assert.ok(clipped.some(e=>Math.max(...e.thirdway.proposalCollisions)>CONFIG.collisionBudget));
  for(const e of clipped){
    assert.ok(e.thirdway.selectedCollisions.every(c=>c<=CONFIG.collisionBudget+1e-12));
  }
});

test('audit collision values retain decimal precision', () => {
  const r=runAll(23);
  const e5=r.events[4].thirdway;
  assert.ok(e5.proposalCollisions[0] > CONFIG.collisionBudget);
  assert.ok(e5.proposalCollisions[0] < 0.5, `collision=${e5.proposalCollisions[0]}`);
});
