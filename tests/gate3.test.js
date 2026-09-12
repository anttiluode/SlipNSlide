import test from 'node:test';
import assert from 'node:assert/strict';
import * as gate2 from '../src/gate2.js';
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
