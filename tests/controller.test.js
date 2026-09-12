import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/prng.js';
import { CONFIG } from '../src/config.js';
import { createController, cloneController, flattenController, applyFlatDelta, runControllerStep, growResidualRoute } from '../src/controller.js';

test('one-route controller is deterministic and bounded', () => {
  const a = createController(makeRng(23));
  const b = createController(makeRng(23));
  assert.deepEqual(Array.from(flattenController(a)), Array.from(flattenController(b)));
  const obs = [0.8,0.2,0.1,0,0];
  const ra = runControllerStep(a, obs, null);
  const rb = runControllerStep(b, obs, null);
  assert.equal(ra.u, rb.u);
  assert.ok(ra.u >= -1 && ra.u <= 1);
  assert.equal(ra.gate, 0);
});

test('clone and flat delta do not mutate the source controller', () => {
  const base = createController(makeRng(5));
  const before = Array.from(flattenController(base));
  const copy = cloneController(base);
  const delta = new Float64Array(before.length); delta[0] = 0.25; delta[before.length-1] = -0.1;
  applyFlatDelta(copy, delta, 0.5);
  assert.deepEqual(Array.from(flattenController(base)), before);
  assert.equal(flattenController(copy)[0], before[0] + 0.125);
});

test('growth adds exactly one residual-derived route and a low-activation gate', () => {
  const base = createController(makeRng(8));
  const dim = flattenController(base).length;
  const residual = new Float64Array(dim);
  residual[0] = 2; residual[7] = -1; residual[dim-1] = 0.5;
  const grown = growResidualRoute(base, residual);
  assert.equal(base.routes.length, 1);
  assert.equal(grown.routes.length, 2);
  assert.equal(grown.gate.w.length, 5);
  assert.equal(grown.gate.b, -2);
  assert.ok(grown.growthMeta.residualNorm > 0);
  const step = runControllerStep(grown, [0.5,0.1,-0.2,0,0], null);
  assert.ok(step.gate > 0.1 && step.gate < 0.13);
  assert.equal(step.blendHidden.length, CONFIG.hiddenSize);
});

test('growth is deterministic and never consults terrain', () => {
  const base = createController(makeRng(11));
  const residual = Float64Array.from({length: flattenController(base).length}, (_, i) => Math.sin(i));
  const a = growResidualRoute(base, residual);
  const b = growResidualRoute(base, residual);
  assert.deepEqual(Array.from(flattenController(a)), Array.from(flattenController(b)));
  assert.equal(Object.hasOwn(a, 'terrain'), false);
});
