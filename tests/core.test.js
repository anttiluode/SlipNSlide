import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/prng.js';
import { initialState, observe, terrainParams, tractionForce, stepPhysics, rolloutOpenLoop } from '../src/physics.js';
import { CONFIG } from '../src/config.js';

test('seeded PRNG is reproducible and exposes state', () => {
  const a = makeRng(23); const b = makeRng(23);
  const xs = Array.from({length: 8}, () => a.next());
  const ys = Array.from({length: 8}, () => b.next());
  assert.deepEqual(xs, ys);
  assert.equal(a.state(), b.state());
});

test('controller observation contains five physical values and no terrain label', () => {
  const s = initialState();
  const obs = observe({...s, v: 0.4, omega: 3.0, uPrev: 0.2, phi: 0.1}, CONFIG.targetV);
  assert.equal(obs.length, 5);
  assert.ok(obs.every(Number.isFinite));
  assert.deepEqual(obs, observe({...s, v: 0.4, omega: 3.0, uPrev: 0.2, phi: 0.1}, CONFIG.targetV));
});

test('ice traction falls after its slip peak while gravel peaks later', () => {
  const ice = terrainParams('I');
  const gravel = terrainParams('G');
  const iceNear = Math.abs(tractionForce(ice.peakSlip, ice));
  const iceHigh = Math.abs(tractionForce(ice.peakSlip * 5, ice));
  const gravelAtIcePeak = Math.abs(tractionForce(ice.peakSlip, gravel));
  const gravelNear = Math.abs(tractionForce(gravel.peakSlip, gravel));
  assert.ok(iceHigh < iceNear * 0.5, `iceHigh=${iceHigh} iceNear=${iceNear}`);
  assert.ok(gravelNear > gravelAtIcePeak, `gravelNear=${gravelNear} gravelAtIcePeak=${gravelAtIcePeak}`);
});

test('fixed open-loop rollout is deterministic', () => {
  const commands = Array.from({length: 60}, (_, i) => i < 30 ? 0.7 : 0.25);
  const a = rolloutOpenLoop(commands, 'G');
  const b = rolloutOpenLoop(commands, 'G');
  assert.deepEqual(a, b);
  assert.ok(Number.isFinite(a.reward));
});

test('large motor command creates more slip on ice than gravel', () => {
  let si = initialState(); let sg = initialState();
  let maxI = 0, maxG = 0;
  for (let i=0;i<80;i++) {
    const ri = stepPhysics(si, 1, 'I', CONFIG.dt); si = ri.state; maxI = Math.max(maxI, Math.abs(ri.slip));
    const rg = stepPhysics(sg, 1, 'G', CONFIG.dt); sg = rg.state; maxG = Math.max(maxG, Math.abs(rg.slip));
  }
  assert.ok(maxI > maxG * 1.2, `ice=${maxI} gravel=${maxG}`);
});
