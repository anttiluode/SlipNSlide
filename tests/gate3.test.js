import test from 'node:test';
import assert from 'node:assert/strict';
import * as gate2 from '../src/gate2.js';
import * as gate3 from '../src/gate3.js';
import { flattenController } from '../src/controller.js';

test('Gate 3 starts from the exact frozen Gate 2 controller at first growth', () => {
  assert.equal(typeof gate2.runGate2GrowthSnapshot,'function');
  const full=gate2.runGate2(23);
  const growthIndex=full.events.findIndex(e=>e.functional.grew);
  assert.ok(growthIndex>=0);
  const a=gate2.runGate2GrowthSnapshot(23);
  const b=gate2.runGate2GrowthSnapshot(23);
  assert.equal(a.growthEpisode,growthIndex+1);
  assert.deepEqual(a.events,full.events.slice(0,growthIndex+1));
  assert.deepEqual(a.events,b.events);
  assert.deepEqual(Array.from(flattenController(a.controller)),Array.from(flattenController(b.controller)));
  assert.equal(a.controller.routes.length,2);
});

test('Gate 3 exposes deterministic gate-only, specialist, and causal-responsibility arms', () => {
  assert.equal(typeof gate3.runGate3,'function');
  const a=gate3.runGate3(23);
  const b=gate3.runGate3(23);
  assert.deepEqual(a,b);
  assert.deepEqual(Object.keys(a.arms),['gateOnly','specialist','responsibility']);
  assert.equal(a.growthEpisode,6);
  assert.ok(['PASS','FAIL'].includes(a.verdict));
  for(const [name,arm] of Object.entries(a.arms)){
    assert.equal(arm.routes,2,name);
    assert.equal(typeof arm.gateSeparation,'number',name);
    assert.equal(typeof arm.alternatingTailMean,'number',name);
    assert.equal(typeof arm.route0DeltaNorm,'number',name);
    assert.equal(typeof arm.route1DeltaNorm,'number',name);
    assert.equal(typeof arm.criteria.gateUsesState.pass,'boolean',name);
    assert.equal(typeof arm.criteria.tailAdvantage.pass,'boolean',name);
  }
  assert.equal(a.arms.gateOnly.route0DeltaNorm,0);
  assert.equal(a.arms.gateOnly.route1DeltaNorm,0);
  assert.equal(a.arms.specialist.route0DeltaNorm,0);
  assert.equal(a.arms.responsibility.route0DeltaNorm,0);
});

test('Gate 3 post-growth arms use matched proposal seeds and responsibility is earned from forced-route performance', () => {
  const r=gate3.runGate3(23);
  const names=['gateOnly','specialist','responsibility'];
  for(let i=0;i<r.events.length;i++){
    const seeds=names.map(name=>r.events[i][name].proposalSeed);
    assert.ok(seeds.every(x=>x===seeds[0]));
    const resp=r.events[i].responsibility;
    assert.ok(Number.isFinite(resp.route0ForcedScore));
    assert.ok(Number.isFinite(resp.route1ForcedScore));
    assert.ok(Number.isFinite(resp.routeAdvantage));
    assert.ok(Number.isFinite(resp.responsibilityTarget));
    assert.equal('terrainTarget' in resp,false);
    assert.equal('terrainLabel' in resp,false);
  }
});
