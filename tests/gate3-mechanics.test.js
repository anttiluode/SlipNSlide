import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/prng.js';
import * as controller from '../src/controller.js';

test('controllerSlices names route and gate ranges after growth', () => {
  assert.equal(typeof controller.controllerSlices,'function');
  const base=controller.createController(makeRng(23));
  const residual=new Float64Array(controller.flattenController(base).length);
  residual[0]=1;
  const grown=controller.growResidualRoute(base,residual);
  const slices=controller.controllerSlices(grown);
  const flat=controller.flattenController(grown);
  assert.deepEqual(Object.keys(slices),['route0','route1','gate']);
  assert.equal(slices.route0.start,0);
  assert.equal(slices.route0.end,slices.route1.start);
  assert.equal(slices.route1.end,slices.gate.start);
  assert.equal(slices.gate.end,flat.length);
});
