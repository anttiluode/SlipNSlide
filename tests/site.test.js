import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createExperiment, stepEpisode } from '../src/experiment.js';

test('episode event exposes a compact real rollout trace for the UI', () => {
  const e=stepEpisode(createExperiment(9));
  assert.ok(e.ordinary.displayTrace.length>10);
  assert.ok(e.thirdway.displayTrace.length>10);
  for(const p of e.thirdway.displayTrace) assert.ok([p.x,p.v,p.u,p.slip,p.gate].every(Number.isFinite));
});

test('static page contains required controls and audit surface without a hard-coded verdict', async () => {
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  for(const id of ['runBtn','stepBtn','resetBtn','seedInput','speedSelect','auditToggle','ordinaryRobot','thirdRobot','verdict']){
    assert.match(html,new RegExp(`id=["']${id}["']`));
  }
  assert.match(html,/viewer-only/i);
  assert.match(html,/src\/ui\.js/);
  assert.doesNotMatch(html,/id=["']verdict["'][^>]*>\s*PASS\s*</i);
});
