import { CONFIG } from './config.js';
import { makeRng, deriveSeed } from './prng.js';
import { cloneController, flattenController, applyFlatDelta, controllerSlices } from './controller.js';
import { maskedProposalBatch, bestProposal, evaluateController, evaluateForcedRoute } from './search.js';
import { runGate2, runGate2GrowthSnapshot } from './gate2.js';

const RESPONSIBILITY_WEIGHT=0.08;

function round(x,n=10){ return Number(Number(x).toFixed(n)); }
function mean(xs){ return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0; }
function normDiff(a,b,start,end){
  let s=0;
  for(let i=start;i<end;i++){ const d=a[i]-b[i]; s+=d*d; }
  return Math.sqrt(s);
}
function compactEval(r){
  return {score:round(r.score),meanSlip:round(r.meanSlip),meanEnergy:round(r.meanEnergy),meanGate:round(r.meanGate)};
}

function makeArm(controller,startFlat,name){
  return {name,controller:cloneController(controller),startFlat:Float64Array.from(startFlat),accepted:0,rejected:0,events:[]};
}

function taskStep(arm,terrain,deltas,proposalSeed){
  const found=bestProposal(arm.controller,terrain,deltas,CONFIG.minImprovement);
  let proposalId=null, improvement=0, status='no-improvement';
  if(found.proposal){
    proposalId=found.proposal.id;
    improvement=found.proposal.improvement;
    arm.controller=found.proposal.result.controller;
    arm.accepted++;
    status='accepted';
  } else arm.rejected++;
  const post=evaluateController(arm.controller,terrain);
  const event={proposalSeed,status,proposalId,proposalImprovement:round(improvement),postScore:round(post.score),meanGate:round(post.meanGate)};
  arm.events.push(event);
  return event;
}

function responsibilityScore(controller,terrain,target){
  const task=evaluateController(controller,terrain);
  const agreement=target*(2*task.meanGate-1);
  return {task,agreement,objective:task.score+RESPONSIBILITY_WEIGHT*agreement};
}

function responsibilityStep(arm,terrain,deltas,proposalSeed){
  const forced0=evaluateForcedRoute(arm.controller,terrain,0);
  const forced1=evaluateForcedRoute(arm.controller,terrain,1);
  const advantage=forced1.score-forced0.score;
  const target=Math.tanh(4*advantage);
  const base=responsibilityScore(arm.controller,terrain,target);
  let best=null;
  const candidateScores=[];
  for(let i=0;i<deltas.length;i++){
    const candidate=cloneController(arm.controller);
    applyFlatDelta(candidate,deltas[i],1);
    const scored=responsibilityScore(candidate,terrain,target);
    const improvement=scored.objective-base.objective;
    candidateScores.push({id:i,taskScore:round(scored.task.score),agreement:round(scored.agreement),objective:round(scored.objective),improvement:round(improvement)});
    if(!best || scored.objective>best.scored.objective) best={id:i,candidate,scored,improvement};
  }
  let status='no-improvement', proposalId=null;
  if(best && best.improvement>=CONFIG.minImprovement){
    arm.controller=best.candidate;
    arm.accepted++;
    status='accepted'; proposalId=best.id;
  } else arm.rejected++;
  const post=evaluateController(arm.controller,terrain);
  const event={
    proposalSeed,status,proposalId,postScore:round(post.score),meanGate:round(post.meanGate),
    route0ForcedScore:round(forced0.score),route1ForcedScore:round(forced1.score),
    routeAdvantage:round(advantage),responsibilityTarget:round(target),
    baseTaskScore:round(base.task.score),baseAgreement:round(base.agreement),baseObjective:round(base.objective),
    chosenTaskScore:best?round(best.scored.task.score):round(base.task.score),
    chosenAgreement:best?round(best.scored.agreement):round(base.agreement),
    chosenObjective:best?round(best.scored.objective):round(base.objective),
    objectiveImprovement:best?round(best.improvement):0,
    responsibilityWeight:RESPONSIBILITY_WEIGHT,
    candidateScores
  };
  arm.events.push(event);
  return event;
}

function metricsFor(arm,ordinary){
  const g=evaluateController(arm.controller,'G');
  const i=evaluateController(arm.controller,'I');
  const flat=flattenController(arm.controller);
  const slices=controllerSlices(arm.controller);
  const route0DeltaNorm=normDiff(flat,arm.startFlat,slices.route0.start,slices.route0.end);
  const route1DeltaNorm=normDiff(flat,arm.startFlat,slices.route1.start,slices.route1.end);
  const gateDeltaNorm=normDiff(flat,arm.startFlat,slices.gate.start,slices.gate.end);
  const alternatingTailMean=mean(arm.events.slice(-6).map(e=>e.postScore));
  const metrics={
    gravelScore:round(g.score),iceScore:round(i.score),alternatingTailMean:round(alternatingTailMean),
    gateG:round(g.meanGate),gateI:round(i.meanGate),gateSeparation:round(Math.abs(g.meanGate-i.meanGate)),
    acceptedWrites:arm.accepted,rejectedWrites:arm.rejected,routes:arm.controller.routes.length,
    route0DeltaNorm:round(route0DeltaNorm),route1DeltaNorm:round(route1DeltaNorm),gateDeltaNorm:round(gateDeltaNorm)
  };
  const frozenStructurePass=arm.name==='gateOnly'
    ? route0DeltaNorm<1e-12 && route1DeltaNorm<1e-12
    : route0DeltaNorm<1e-12;
  const criteria={
    twoRoutes:{value:metrics.routes,threshold:2,pass:metrics.routes===2},
    frozenStructure:{value:round(arm.name==='gateOnly'?Math.max(route0DeltaNorm,route1DeltaNorm):route0DeltaNorm),threshold:0,pass:frozenStructurePass},
    gateUsesState:{value:metrics.gateSeparation,threshold:CONFIG.gateSeparationMin,pass:metrics.gateG>0.02 && metrics.gateG<0.98 && metrics.gateI>0.02 && metrics.gateI<0.98 && metrics.gateSeparation>=CONFIG.gateSeparationMin},
    tailAdvantage:{value:round(metrics.alternatingTailMean-ordinary.alternatingTailMean),threshold:CONFIG.successMargin,pass:metrics.alternatingTailMean>=ordinary.alternatingTailMean+CONFIG.successMargin}
  };
  return {...metrics,criteria,pass:Object.values(criteria).every(c=>c.pass)};
}

export function runGate3(seed=CONFIG.seed){
  const gate2=runGate2(seed);
  const snapshot=runGate2GrowthSnapshot(seed);
  const startFlat=flattenController(snapshot.controller);
  const arms={
    gateOnly:makeArm(snapshot.controller,startFlat,'gateOnly'),
    specialist:makeArm(snapshot.controller,startFlat,'specialist'),
    responsibility:makeArm(snapshot.controller,startFlat,'responsibility')
  };
  const events=[];
  for(let idx=snapshot.growthEpisode;idx<CONFIG.schedule.length;idx++){
    const terrain=CONFIG.schedule[idx];
    const proposalSeed=deriveSeed(seed,'proposal-episode',idx);
    const gateDeltas=maskedProposalBatch(arms.gateOnly.controller,makeRng(proposalSeed),CONFIG.proposalCount,CONFIG.proposalSigma,['gate']);
    const specialistDeltas=maskedProposalBatch(arms.specialist.controller,makeRng(proposalSeed),CONFIG.proposalCount,CONFIG.proposalSigma,['route1','gate']);
    const responsibilityDeltas=maskedProposalBatch(arms.responsibility.controller,makeRng(proposalSeed),CONFIG.proposalCount,CONFIG.proposalSigma,['route1','gate']);
    events.push({
      episode:idx+1,terrain,
      gateOnly:taskStep(arms.gateOnly,terrain,gateDeltas,proposalSeed),
      specialist:taskStep(arms.specialist,terrain,specialistDeltas,proposalSeed),
      responsibility:responsibilityStep(arms.responsibility,terrain,responsibilityDeltas,proposalSeed)
    });
  }
  const armResults={
    gateOnly:metricsFor(arms.gateOnly,gate2.ordinary),
    specialist:metricsFor(arms.specialist,gate2.ordinary),
    responsibility:metricsFor(arms.responsibility,gate2.ordinary)
  };
  const winner=['gateOnly','specialist','responsibility'].find(name=>armResults[name].pass) ?? null;
  return {
    gate:'Gate 3 - earned responsibility',seed,schedule:[...CONFIG.schedule],growthEpisode:snapshot.growthEpisode,
    config:{proposalCount:CONFIG.proposalCount,proposalSigma:CONFIG.proposalSigma,minImprovement:CONFIG.minImprovement,gateSeparationMin:CONFIG.gateSeparationMin,successMargin:CONFIG.successMargin,responsibilityWeight:RESPONSIBILITY_WEIGHT},
    gate2:{verdict:gate2.verdict,functional:gate2.functional,growth:snapshot.events.at(-1).functional.growthDetails},
    ordinary:gate2.ordinary,
    arms:armResults,
    verdict:winner?'PASS':'FAIL',winner,
    events
  };
}
