import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runGate2 } from '../src/gate2.js';

function compact(result){
  return {
    gate:result.gate,
    seed:result.seed,
    schedule:result.schedule,
    config:result.config,
    gate1:result.gate1,
    ordinary:result.ordinary,
    functional:result.functional,
    criteria:result.criteria,
    verdict:result.verdict,
    clippedEvents:result.events.filter(e=>e.functional.residualFraction>0).map(e=>({
      episode:e.episode,terrain:e.terrain,proposalId:e.functional.proposalId,status:e.functional.status,
      alpha:e.functional.alpha,proposalImprovement:e.functional.proposalImprovement,
      collision:e.functional.proposalCollisions[0] ?? 0,residualNorm:e.functional.residualNorm,
      parameterCoherence:e.functional.parameterCoherence,functionalCoherence:e.functional.functionalCoherence,
      coherenceThreshold:e.functional.coherenceThreshold,functionalEffectHash:e.functional.functionalEffectHash,
      functionalEffectNorm:e.functional.functionalEffectNorm,grew:e.functional.grew,growthDetails:e.functional.growthDetails
    }))
  };
}

test('frozen Gate 2 seed-23 receipt exactly matches deterministic regeneration', async () => {
  const url=new URL('../results/gate2-seed23.json',import.meta.url);
  const frozen=JSON.parse(await readFile(url,'utf8'));
  assert.deepEqual(frozen,compact(runGate2(23)));
});

test('Gate 2 frozen result records coherent effects, growth, and an overall FAIL without retuning', async () => {
  const frozen=JSON.parse(await readFile(new URL('../results/gate2-seed23.json',import.meta.url),'utf8'));
  const growth=frozen.clippedEvents.find(e=>e.grew);
  assert.equal(frozen.verdict,'FAIL');
  assert.ok(growth);
  assert.ok(growth.growthDetails.triggerParameterCoherence<0.42);
  assert.ok(growth.growthDetails.triggerFunctionalCoherence>=0.42);
  assert.equal(frozen.functional.growthEvents,1);
  assert.equal(frozen.criteria.tailAdvantage.pass,false);
  assert.equal(frozen.criteria.gateUsesState.pass,false);
});
