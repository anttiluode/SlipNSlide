import { CONFIG } from './config.js';
import { makeRng, deriveSeed } from './prng.js';
import { createController, cloneController, flattenController, applyFlatDelta, growResidualRoute } from './controller.js';
import { proposalBatch, bestProposal, evaluateController } from './search.js';
import { makeAnchor, selectSafeAlpha, updateResidual, residualNorm, residualCoherence, shouldGrow, collisionRms } from './compatibility.js';
import { functionalEffectVector, functionalCoherence, representativeResidual } from './functional.js';
import { runAll } from './experiment.js';

function zeros(n){ return new Float64Array(n); }
function mean(xs){ return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0; }
function round(x,n=10){ return Number(Number(x).toFixed(n)); }
function clippedVector(delta,alpha){
  const out=new Float64Array(delta.length);
  for(let i=0;i<out.length;i++) out[i]=(1-alpha)*delta[i];
  return out;
}
function hashBatch(batch){
  let h=2166136261>>>0;
  for(const d of batch){
    for(const x of d){ const q=Math.round(x*1e7)|0; h^=q; h=Math.imul(h,16777619)>>>0; }
  }
  return h.toString(16).padStart(8,'0');
}
function hashVector(v){
  let h=2166136261>>>0;
  for(const x of v){ const q=Math.round(x*1e6)|0; h^=q; h=Math.imul(h,16777619)>>>0; }
  return h.toString(16).padStart(8,'0');
}
function vectorNorm(v){ let s=0; for(const x of v) s+=x*x; return Math.sqrt(s); }
function compactEval(r){ return {score:round(r.score),meanSlip:round(r.meanSlip),meanEnergy:round(r.meanEnergy),meanGate:round(r.meanGate)}; }
function compactTrace(trace){ return trace.filter((_,i)=>i%4===0 || i===trace.length-1).map(p=>({x:round(p.x,6),v:round(p.v,6),u:round(p.u,6),slip:round(p.slip,6),gate:round(p.gate,6)})); }
function candidateRows(rows){ return rows.map(r=>({id:r.id,score:round(r.score),improvement:round(r.improvement),meanSlip:round(r.meanSlip)})); }

function makeArm(controller){
  const dim=flattenController(controller).length;
  return {
    controller, accepted:0, rejected:0, clipped:0, growthEvents:0,
    anchors:{}, residual:zeros(dim), parameterHistory:[], functionalHistory:[], clippedCount:0,
    traceableClips:0, history:[]
  };
}

function crossEval(controller){
  return {G:compactEval(evaluateController(controller,'G')),I:compactEval(evaluateController(controller,'I'))};
}

function stepFunctional(arm, terrain, deltas, streamHash, episode){
  const found=bestProposal(arm.controller,terrain,deltas,CONFIG.minImprovement);
  const protectedAnchors=Object.entries(arm.anchors).filter(([k])=>k!==terrain).map(([,a])=>a);
  let status='no-improvement', proposalId=null, alpha=0, improvement=0;
  let selectedCollisions=[], proposalCollisions=[], safeEvaluations=[];
  let grew=false, growthDetails=null, effectHash=null, effectNorm=0;

  if(found.proposal){
    proposalId=found.proposal.id;
    improvement=found.proposal.improvement;
    const pre=arm.controller;
    const full=cloneController(pre);
    applyFlatDelta(full,found.proposal.delta,1);
    const safe=selectSafeAlpha({
      controller:pre,delta:found.proposal.delta,targetTerrain:terrain,anchors:protectedAnchors,
      minImprovement:CONFIG.minImprovement,scaleBank:CONFIG.scaleBank,collisionBudget:CONFIG.collisionBudget
    });
    alpha=safe.alpha;
    selectedCollisions=safe.collisions;
    const fullEvaluation=safe.evaluations.find(e=>e.alpha===1);
    proposalCollisions=fullEvaluation ? fullEvaluation.collisions : [];
    safeEvaluations=safe.evaluations.map(e=>({alpha:e.alpha,score:round(e.score),improvement:round(e.improvement),collisions:e.collisions.map(x=>round(x)),legal:e.legal}));

    if(alpha>0){ arm.controller=safe.candidate; arm.accepted++; status=alpha<1?'clipped-accepted':'accepted'; }
    else { arm.rejected++; status='collision-rejected'; }

    if(alpha<1){
      arm.clipped++;
      arm.clippedCount++;
      arm.traceableClips++;
      const unresolved=clippedVector(found.proposal.delta,alpha);
      arm.residual=updateResidual(arm.residual,found.proposal.delta,alpha,CONFIG.residualBeta);
      const effect=functionalEffectVector(arm.controller,full);
      effectHash=hashVector(effect);
      effectNorm=vectorNorm(effect);
      arm.parameterHistory.push(unresolved);
      arm.functionalHistory.push({eventIndex:episode,effect,residual:unresolved});
      if(arm.parameterHistory.length>CONFIG.coherenceWindow) arm.parameterHistory.shift();
      if(arm.functionalHistory.length>CONFIG.coherenceWindow) arm.functionalHistory.shift();
    }

    const rNorm=residualNorm(arm.residual);
    const pCoherence=residualCoherence(arm.parameterHistory);
    const fCoherence=functionalCoherence(arm.functionalHistory.map(x=>x.effect));
    const grow=arm.controller.routes.length===1 && shouldGrow({
      norm:rNorm,threshold:CONFIG.growthThreshold,coherence:fCoherence,minCoherence:CONFIG.minCoherence,
      clippedCount:arm.clippedCount,minClipped:CONFIG.minClippedForGrowth
    });
    if(grow){
      const representative=representativeResidual(arm.functionalHistory);
      const preRoutes=arm.controller.routes.length;
      arm.controller=growResidualRoute(arm.controller,representative.residual);
      arm.growthEvents++;
      grew=true;
      const postCollisions=protectedAnchors.map(a=>collisionRms(a,arm.controller));
      growthDetails={
        preRoutes,postRoutes:arm.controller.routes.length,
        triggerNorm:round(rNorm),triggerParameterCoherence:round(pCoherence),triggerFunctionalCoherence:round(fCoherence),
        triggerClippedCount:arm.clippedCount,
        representativeEpisode:representative.eventIndex,
        representativeSimilarity:round(representative.similarity),
        representativeResidualNorm:round(vectorNorm(representative.residual)),
        protectedPostGrowthCollisions:postCollisions.map(x=>round(x))
      };
      arm.residual=zeros(flattenController(arm.controller).length);
      arm.parameterHistory=[];
      arm.functionalHistory=[];
      arm.clippedCount=0;
    }

    if(alpha>0) arm.anchors[terrain]=makeAnchor(arm.controller,terrain);
  } else arm.rejected++;

  const rNorm=residualNorm(arm.residual);
  const pCoherence=residualCoherence(arm.parameterHistory);
  const fCoherence=functionalCoherence(arm.functionalHistory.map(x=>x.effect));
  const target=evaluateController(arm.controller,terrain);
  const event={
    streamHash,status,proposalId,baseScore:round(found.baseScore),proposalImprovement:round(improvement),alpha,
    absorbedFraction:alpha,residualFraction:proposalId===null?0:1-alpha,
    proposalCollisions:proposalCollisions.map(x=>round(x)),selectedCollisions:selectedCollisions.map(x=>round(x)),
    safeEvaluations,candidateScores:candidateRows(found.candidateScores),postScore:round(target.score),
    residualNorm:round(rNorm),residualThreshold:CONFIG.growthThreshold,
    parameterCoherence:round(pCoherence),functionalCoherence:round(fCoherence),coherenceThreshold:CONFIG.minCoherence,
    functionalEffectHash:effectHash,functionalEffectNorm:round(effectNorm),
    clippedCount:arm.clippedCount,accepted:arm.accepted,rejected:arm.rejected,clipped:arm.clipped,
    grew,growthDetails,growthEvents:arm.growthEvents,routes:arm.controller.routes.length,
    anchorHashes:Object.fromEntries(Object.entries(arm.anchors).map(([k,a])=>[k,a.hash])),
    cross:crossEval(arm.controller),displayTrace:compactTrace(target.trace)
  };
  arm.history.push(event);
  return event;
}

function metricsFor(arm,events){
  const g=evaluateController(arm.controller,'G');
  const i=evaluateController(arm.controller,'I');
  const tail=events.slice(-6).map(e=>e.functional.postScore);
  const gBeforeIce=events[3]?.functional.cross.G.score ?? events[0]?.functional.cross.G.score ?? g.score;
  const gAfterIce=events[7]?.functional.cross.G.score ?? g.score;
  const iAfterIce=events[7]?.functional.cross.I.score ?? i.score;
  return {
    gravelScore:round(g.score),iceScore:round(i.score),alternatingTailMean:round(mean(tail)),
    gravelRetentionDelta:round(gAfterIce-gBeforeIce),iceRetentionDelta:round(i.score-iAfterIce),
    meanSlip:round((g.meanSlip+i.meanSlip)/2),meanEnergy:round((g.meanEnergy+i.meanEnergy)/2),
    acceptedWrites:arm.accepted,rejectedWrites:arm.rejected,clippedWrites:arm.clipped,
    growthEvents:arm.growthEvents,routes:arm.controller.routes.length,
    gateG:round(g.meanGate),gateI:round(i.meanGate),gateSeparation:round(Math.abs(g.meanGate-i.meanGate)),
    traceableClips:arm.traceableClips
  };
}

function criteriaFor(ordinary,functional,events){
  const ordinaryForgetting=Math.max(0,-ordinary.gravelRetentionDelta);
  const separationEvents=events.filter(e=>
    e.functional.clippedCount>=CONFIG.minClippedForGrowth &&
    e.functional.functionalCoherence>=CONFIG.minCoherence &&
    e.functional.parameterCoherence<CONFIG.minCoherence
  );
  return {
    ordinaryConflict:{value:round(ordinaryForgetting),threshold:CONFIG.ordinaryConflictMin,pass:ordinaryForgetting>=CONFIG.ordinaryConflictMin},
    geometrySeparation:{value:separationEvents.length,threshold:1,pass:separationEvents.length>=1},
    growthTriggered:{value:functional.growthEvents,threshold:1,pass:functional.growthEvents>=1},
    tailAdvantage:{value:round(functional.alternatingTailMean-ordinary.alternatingTailMean),threshold:CONFIG.successMargin,pass:functional.alternatingTailMean>=ordinary.alternatingTailMean+CONFIG.successMargin},
    gateUsesState:{value:functional.gateSeparation,threshold:CONFIG.gateSeparationMin,pass:functional.routes>1 && functional.gateG>0.02 && functional.gateG<0.98 && functional.gateI>0.02 && functional.gateI<0.98 && functional.gateSeparation>=CONFIG.gateSeparationMin},
    traceableIncompatibility:{value:functional.traceableClips,threshold:CONFIG.tracedClipMin,pass:functional.traceableClips>=CONFIG.tracedClipMin}
  };
}

export function runGate2GrowthSnapshot(seed=CONFIG.seed){
  const initSeed=deriveSeed(seed,'init-controller');
  const arm=makeArm(createController(makeRng(initSeed)));
  const events=[];
  for(let idx=0;idx<CONFIG.schedule.length;idx++){
    const terrain=CONFIG.schedule[idx];
    const proposalSeed=deriveSeed(seed,'proposal-episode',idx);
    const deltas=proposalBatch(arm.controller,makeRng(proposalSeed),CONFIG.proposalCount,CONFIG.proposalSigma);
    const functional=stepFunctional(arm,terrain,deltas,hashBatch(deltas),idx+1);
    const event={episode:idx+1,terrain,proposalSeed,functional};
    events.push(event);
    if(functional.grew){
      return {seed,growthEpisode:idx+1,controller:cloneController(arm.controller),events};
    }
  }
  throw new Error('Gate 2 did not grow for this seed');
}

export function runGate2(seed=CONFIG.seed){
  const gate1=runAll(seed);
  const initSeed=deriveSeed(seed,'init-controller');
  const arm=makeArm(createController(makeRng(initSeed)));
  const events=[];
  for(let idx=0;idx<CONFIG.schedule.length;idx++){
    const terrain=CONFIG.schedule[idx];
    const proposalSeed=deriveSeed(seed,'proposal-episode',idx);
    const deltas=proposalBatch(arm.controller,makeRng(proposalSeed),CONFIG.proposalCount,CONFIG.proposalSigma);
    events.push({episode:idx+1,terrain,proposalSeed,functional:stepFunctional(arm,terrain,deltas,hashBatch(deltas),idx+1)});
  }
  const functional=metricsFor(arm,events);
  const criteria=criteriaFor(gate1.ordinary,functional,events);
  const verdict=Object.values(criteria).every(c=>c.pass)?'PASS':'FAIL';
  return {
    gate:'Gate 2 - functional residual coherence',
    seed,
    schedule:[...CONFIG.schedule],
    config:{
      proposalCount:CONFIG.proposalCount,proposalSigma:CONFIG.proposalSigma,minImprovement:CONFIG.minImprovement,
      collisionBudget:CONFIG.collisionBudget,growthThreshold:CONFIG.growthThreshold,coherenceWindow:CONFIG.coherenceWindow,
      minCoherence:CONFIG.minCoherence,minClippedForGrowth:CONFIG.minClippedForGrowth,successMargin:CONFIG.successMargin
    },
    gate1:{verdict:gate1.verdict,thirdway:gate1.thirdway},
    ordinary:gate1.ordinary,
    functional,
    criteria,
    verdict,
    events
  };
}
