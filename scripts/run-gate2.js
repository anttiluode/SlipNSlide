import { mkdir, writeFile } from 'node:fs/promises';
import { runGate2 } from '../src/gate2.js';

const seed=Number(process.argv[2] ?? 23);
const result=runGate2(seed);
const clippedEvents=result.events
  .filter(e=>e.functional.residualFraction>0)
  .map(e=>({
    episode:e.episode,
    terrain:e.terrain,
    proposalId:e.functional.proposalId,
    status:e.functional.status,
    alpha:e.functional.alpha,
    proposalImprovement:e.functional.proposalImprovement,
    collision:e.functional.proposalCollisions[0] ?? 0,
    residualNorm:e.functional.residualNorm,
    parameterCoherence:e.functional.parameterCoherence,
    functionalCoherence:e.functional.functionalCoherence,
    coherenceThreshold:e.functional.coherenceThreshold,
    functionalEffectHash:e.functional.functionalEffectHash,
    functionalEffectNorm:e.functional.functionalEffectNorm,
    grew:e.functional.grew,
    growthDetails:e.functional.growthDetails
  }));
const receipt={
  gate:result.gate,
  seed:result.seed,
  schedule:result.schedule,
  config:result.config,
  gate1:result.gate1,
  ordinary:result.ordinary,
  functional:result.functional,
  criteria:result.criteria,
  verdict:result.verdict,
  clippedEvents
};
await mkdir(new URL('../results/',import.meta.url),{recursive:true});
const out=new URL(`../results/gate2-seed${seed}.json`,import.meta.url);
await writeFile(out,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
console.log(`wrote ${out.pathname}`);
