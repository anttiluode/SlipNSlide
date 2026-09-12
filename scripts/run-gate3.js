import { mkdir, writeFile } from 'node:fs/promises';
import { runGate3 } from '../src/gate3.js';

const seed=Number(process.argv[2] ?? 23);
const result=runGate3(seed);
const events=result.events.map(e=>({
  episode:e.episode,
  terrain:e.terrain,
  gateOnly:{
    proposalSeed:e.gateOnly.proposalSeed,status:e.gateOnly.status,proposalId:e.gateOnly.proposalId,
    proposalImprovement:e.gateOnly.proposalImprovement,postScore:e.gateOnly.postScore,meanGate:e.gateOnly.meanGate
  },
  specialist:{
    proposalSeed:e.specialist.proposalSeed,status:e.specialist.status,proposalId:e.specialist.proposalId,
    proposalImprovement:e.specialist.proposalImprovement,postScore:e.specialist.postScore,meanGate:e.specialist.meanGate
  },
  responsibility:{
    proposalSeed:e.responsibility.proposalSeed,status:e.responsibility.status,proposalId:e.responsibility.proposalId,
    postScore:e.responsibility.postScore,meanGate:e.responsibility.meanGate,
    route0ForcedScore:e.responsibility.route0ForcedScore,route1ForcedScore:e.responsibility.route1ForcedScore,
    routeAdvantage:e.responsibility.routeAdvantage,responsibilityTarget:e.responsibility.responsibilityTarget,
    baseTaskScore:e.responsibility.baseTaskScore,baseAgreement:e.responsibility.baseAgreement,baseObjective:e.responsibility.baseObjective,
    chosenTaskScore:e.responsibility.chosenTaskScore,chosenAgreement:e.responsibility.chosenAgreement,
    chosenObjective:e.responsibility.chosenObjective,objectiveImprovement:e.responsibility.objectiveImprovement,
    responsibilityWeight:e.responsibility.responsibilityWeight
  }
}));
const receipt={
  gate:result.gate,seed:result.seed,schedule:result.schedule,growthEpisode:result.growthEpisode,
  config:result.config,gate2:result.gate2,ordinary:result.ordinary,arms:result.arms,
  verdict:result.verdict,winner:result.winner,events
};
await mkdir(new URL('../results/',import.meta.url),{recursive:true});
const out=new URL(`../results/gate3-seed${seed}.json`,import.meta.url);
await writeFile(out,JSON.stringify(receipt)+'\n');
console.log(JSON.stringify(receipt,null,2));
console.log(`wrote ${out.pathname}`);
