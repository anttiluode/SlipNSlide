import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const frozen=JSON.parse(await readFile(new URL('../results/gate3-seed23.json',import.meta.url),'utf8'));

test('Gate 3 frozen seed-23 result is a three-arm FAIL with no winner', () => {
  assert.equal(frozen.verdict,'FAIL');
  assert.equal(frozen.winner,null);
  assert.deepEqual(Object.keys(frozen.arms),['gateOnly','specialist','responsibility']);
  assert.ok(Object.values(frozen.arms).every(a=>a.pass===false));
});

test('gate-only proves state-dependent routing is learnable while frozen routes remain unchanged', () => {
  const a=frozen.arms.gateOnly;
  assert.equal(a.route0DeltaNorm,0);
  assert.equal(a.route1DeltaNorm,0);
  assert.equal(a.criteria.gateUsesState.pass,true);
  assert.ok(a.gateSeparation>=0.05);
  assert.equal(a.criteria.tailAdvantage.pass,false);
  assert.ok(a.alternatingTailMean<frozen.ordinary.alternatingTailMean);
});

test('specialist changes only route 1 plus gate but still fails routing and tail performance', () => {
  const a=frozen.arms.specialist;
  assert.equal(a.route0DeltaNorm,0);
  assert.ok(a.route1DeltaNorm>2);
  assert.equal(a.criteria.gateUsesState.pass,false);
  assert.equal(a.criteria.tailAdvantage.pass,false);
});

test('counterfactual responsibility signal flips with measured route advantage but does not alter the frozen search decisions', () => {
  const s=frozen.arms.specialist;
  const r=frozen.arms.responsibility;
  for(const key of ['gravelScore','iceScore','alternatingTailMean','gateG','gateI','gateSeparation','route0DeltaNorm','route1DeltaNorm','gateDeltaNorm']){
    assert.equal(r[key],s[key],key);
  }
  assert.deepEqual(
    frozen.events.map(e=>e.responsibility.proposalId),
    frozen.events.map(e=>e.specialist.proposalId)
  );
  for(const e of frozen.events){
    const measured=e.responsibility.routeAdvantage;
    const target=e.responsibility.responsibilityTarget;
    assert.equal(Math.sign(target),Math.sign(measured));
    assert.equal('terrainTarget' in e.responsibility,false);
    assert.equal('terrainLabel' in e.responsibility,false);
  }
  const gravel=frozen.events.filter(e=>e.terrain==='G').map(e=>e.responsibility.routeAdvantage);
  const ice=frozen.events.filter(e=>e.terrain==='I').map(e=>e.responsibility.routeAdvantage);
  assert.ok(gravel.every(x=>x<0));
  assert.ok(ice.every(x=>x>0));
});
