import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('frozen seed-23 receipt and CI workflow are committed artifacts', async () => {
  const receipt=JSON.parse(await readFile(new URL('../results/seed23.json',import.meta.url),'utf8'));
  const results=await readFile(new URL('../RESULTS.md',import.meta.url),'utf8');
  const workflow=await readFile(new URL('../.github/workflows/test.yml',import.meta.url),'utf8');
  assert.equal(receipt.seed,23);
  assert.equal(receipt.verdict,'FAIL');
  assert.equal(receipt.ordinary.acceptedWrites,14);
  assert.equal(receipt.thirdway.growthEvents,0);
  assert.equal(receipt.thirdway.traceableClips,10);
  assert.match(results,/Gate 1: FAIL/);
  assert.match(results,/0\.1653526518/);
  assert.match(workflow,/npm test/);
  assert.match(workflow,/node-version:\s*20/);
});
