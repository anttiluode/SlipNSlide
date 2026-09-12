import { CONFIG } from './config.js';
import { makeRng, deriveSeed } from './prng.js';
import { createController, cloneController, flattenController, applyFlatDelta, growResidualRoute } from './controller.js';
import { proposalBatch, bestProposal, evaluateController } from './search.js';
import { makeAnchor, selectSafeAlpha, updateResidual, residualNorm, residualCoherence, shouldGrow, collisionRms } from './compatibility.js';

function zeros(n){ return new Float64Array(n); }
function mean(xs){ return xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0; }
function round(x,n=10){ return Number(Number(x).toFixed(n)); }
function hashBatch(batch){
  let h=2166136261>>>0;
  for(const d of batch){
    for(const x of d){ const q=Math.round(x*1e7)|0; h^=q; h=Math.imul(h,16777619)>>>0; }
  }
  return h.toString(16).padStart(8,'0');
}
function clippedVector(delta,alpha){
  const out=new Float64Array(delta.length);
  for(let i=0;i<out.length;i++) out[i]=(1-alpha)*delta[i];
  return out;
}
function compactEval(r){ return {score:round(r.score),meanSlip:round(r.meanSlip),meanEnergy:round(r.meanEnergy),meanGate:round(r.meanGate)}; }
function compactTrace(trace){ return trace.filter((_,i)=>i%4===0 || i===trace.length-1).map(p=>({x:round(p.x,6),v:round(p.v,6),u:round(p.u,6),slip:round(p.slip,6),gate:round(p.gate,6)})); }
function candidateRows(rows){ return rows.map(r=>({id:r.id,score:round(r.score),improvement:round(r.improvement),meanSlip:round(r.meanSlip)})); }

function makeArm(controller, kind){
  const dim=flattenController(controller).length;
  return {
    kind, controller, accepted:0, rejected:0, clipped:0, growthEvents:0,
    anchors:{}, residual:zeros(dim), residualHistory:[], clippedCount:0,
    traceableClips:0, history:[]
  };
}

export function createExperiment(seed=CONFIG.seed){
  const initSeed=deriveSeed(seed,'init-controller');
  const base=createController(makeRng(initSeed));
  return {
    seed,
    episodeIndex:0,
    schedule:[...CONFIG.schedule],
    events:[],
    arms:{ordinary:makeArm(cloneController(base),'ordinary'),thirdway:makeArm(cloneController(base),'thirdway')}
  };
}

function crossEval(controller){
  const g=evaluateController(controller,'G');
  const i=evaluateController(controller,'I');
  return {G:compactEval(g),I:compactEval(i)};
}

function stepOrdinary(arm, terrain, deltas, streamHash){
  const found=bestProposal(arm.controller,terrain,deltas,CONFIG.minImprovement);
  let status='no-improvement', proposalId=null, improvement=0;
  if(found.proposal){
    proposalId=found.proposal.id; improvement=found.proposal.improvement;
    applyFlatDelta(arm.controller,found.proposal.delta,1);
    arm.accepted++; status='accepted';
  } else arm.rejected++;
  const target=evaluateController(arm.controller,terrain);
  const event={
    streamHash,status,proposalId,baseScore:round(found.baseScore),proposalImprovement:round(improvement),
    postScore:round(target.score),candidateScores:candidateRows(found.candidateScores),
    accepted:arm.accepted,rejected:arm.rejected,routes:arm.controller.routes.length,cross:crossEval(arm.controller),displayTrace:compactTrace(target.trace)
  };
  arm.history.push(event);
  return event;
}

function stepThirdWay(arm, terrain, deltas, streamHash){
  const found=bestProposal(arm.controller,terrain,deltas,CONFIG.minImprovement);
  const protectedAnchors=Object.entries(arm.anchors).filter(([k])=>k!==terrain).map(([,a])=>a);
  let status='no-improvement', proposalId=null, alpha=0, improvement=0, selectedCollisions=[], proposalCollisions=[], safeEvaluations=[];
  let grew=false, growthDetails=null;
  if(found.proposal){
    proposalId=found.proposal.id; improvement=found.proposal.improvement;
    const safe=selectSafeAlpha({
      controller:arm.controller,delta:found.proposal.delta,targetTerrain:terrain,anchors:protectedAnchors,
      minImprovement:CONFIG.minImprovement,scaleBank:CONFIG.scaleBank,collisionBudget:CONFIG.collisionBudget
    });
    alpha=safe.alpha; selectedCollisions=safe.collisions;
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
      arm.residualHistory.push(unresolved);
      if(arm.residualHistory.length>CONFIG.coherenceWindow) arm.residualHistory.shift();
    }

    const rNorm=residualNorm(arm.residual);
    const coherence=residualCoherence(arm.residualHistory);
    const grow=arm.controller.routes.length===1 && shouldGrow({
      norm:rNorm,threshold:CONFIG.growthThreshold,coherence,minCoherence:CONFIG.minCoherence,
      clippedCount:arm.clippedCount,minClipped:CONFIG.minClippedForGrowth
    });
    if(grow){
      const preRoutes=arm.controller.routes.length;
      arm.controller=growResidualRoute(arm.controller,arm.residual);
      arm.growthEvents++;
      grew=true;
      const postCollisions=protectedAnchors.map(a=>collisionRms(a,arm.controller));
      growthDetails={
        preRoutes,postRoutes:arm.controller.routes.length,
        triggerNorm:round(rNorm),triggerCoherence:round(coherence),triggerClippedCount:arm.clippedCount,
        protectedPostGrowthCollisions:postCollisions.map(x=>round(x))
      };
      arm.residual=zeros(flattenController(arm.controller).length);
      arm.residualHistory=[]; arm.clippedCount=0;
    }

    if(alpha>0){ arm.anchors[terrain]=makeAnchor(arm.controller,terrain); }
  } else arm.rejected++;

  const rNorm=residualNorm(arm.residual);
  const coherence=residualCoherence(arm.residualHistory);
  const target=evaluateController(arm.controller,terrain);
  const event={
    streamHash,status,proposalId,baseScore:round(found.baseScore),proposalImprovement:round(improvement),alpha,
    absorbedFraction:alpha,residualFraction:proposalId===null?0:1-alpha,proposalCollisions:proposalCollisions.map(x=>round(x)),selectedCollisions:selectedCollisions.map(x=>round(x)),collisions:proposalCollisions.map(x=>round(x)),
    safeEvaluations,candidateScores:candidateRows(found.candidateScores),postScore:round(target.score),
    residualNorm:round(rNorm),residualThreshold:CONFIG.growthThreshold,residualCoherence:round(coherence),
    clippedCount:arm.clippedCount,accepted:arm.accepted,rejected:arm.rejected,clipped:arm.clipped,
    grew,growthDetails,growthEvents:arm.growthEvents,routes:arm.controller.routes.length,
    anchorHashes:Object.fromEntries(Object.entries(arm.anchors).map(([k,a])=>[k,a.hash])),
    cross:crossEval(arm.controller),displayTrace:compactTrace(target.trace)
  };
  arm.history.push(event);
  return event;
}

export function stepEpisode(exp){
  if(exp.episodeIndex>=exp.schedule.length) return null;
  const idx=exp.episodeIndex;
  const terrain=exp.schedule[idx];
  const proposalSeed=deriveSeed(exp.seed,'proposal-episode',idx);
  const ordinaryDeltas=proposalBatch(exp.arms.ordinary.controller,makeRng(proposalSeed),CONFIG.proposalCount,CONFIG.proposalSigma);
  const thirdDeltas=proposalBatch(exp.arms.thirdway.controller,makeRng(proposalSeed),CONFIG.proposalCount,CONFIG.proposalSigma);
  const event={
    episode:idx+1,terrain,proposalSeed,
    ordinary:stepOrdinary(exp.arms.ordinary,terrain,ordinaryDeltas,hashBatch(ordinaryDeltas)),
    thirdway:stepThirdWay(exp.arms.thirdway,terrain,thirdDeltas,hashBatch(thirdDeltas))
  };
  exp.events.push(event); exp.episodeIndex++;
  return event;
}

function metricsFor(arm,events,key){
  const g=evaluateController(arm.controller,'G');
  const i=evaluateController(arm.controller,'I');
  const tail=events.slice(-6).map(e=>e[key].postScore);
  const gBeforeIce=events[3]?.[key].cross.G.score ?? events[0]?.[key].cross.G.score ?? g.score;
  const gAfterIce=events[7]?.[key].cross.G.score ?? g.score;
  const iAfterIce=events[7]?.[key].cross.I.score ?? i.score;
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

export function evaluateFinal(controller){
  const g=evaluateController(controller,'G'); const i=evaluateController(controller,'I');
  return {G:compactEval(g),I:compactEval(i)};
}

function criteriaFor(ordinary,third){
  const ordinaryForgetting=Math.max(0,-ordinary.gravelRetentionDelta);
  const criteria={
    ordinaryConflict:{value:round(ordinaryForgetting),threshold:CONFIG.ordinaryConflictMin,pass:ordinaryForgetting>=CONFIG.ordinaryConflictMin},
    growthTriggered:{value:third.growthEvents,threshold:1,pass:third.growthEvents>=1},
    tailAdvantage:{value:round(third.alternatingTailMean-ordinary.alternatingTailMean),threshold:CONFIG.successMargin,pass:third.alternatingTailMean>=ordinary.alternatingTailMean+CONFIG.successMargin},
    gateUsesState:{value:third.gateSeparation,threshold:CONFIG.gateSeparationMin,pass:third.routes>1 && third.gateG>0.02 && third.gateG<0.98 && third.gateI>0.02 && third.gateI<0.98 && third.gateSeparation>=CONFIG.gateSeparationMin},
    traceableIncompatibility:{value:third.traceableClips,threshold:CONFIG.tracedClipMin,pass:third.traceableClips>=CONFIG.tracedClipMin}
  };
  return criteria;
}

export function runAll(seed=CONFIG.seed){
  const exp=createExperiment(seed);
  while(stepEpisode(exp));
  const ordinary=metricsFor(exp.arms.ordinary,exp.events,'ordinary');
  const thirdway=metricsFor(exp.arms.thirdway,exp.events,'thirdway');
  const criteria=criteriaFor(ordinary,thirdway);
  const verdict=Object.values(criteria).every(c=>c.pass)?'PASS':'FAIL';
  return {
    seed,schedule:[...CONFIG.schedule],config:{
      proposalCount:CONFIG.proposalCount,proposalSigma:CONFIG.proposalSigma,minImprovement:CONFIG.minImprovement,
      collisionBudget:CONFIG.collisionBudget,growthThreshold:CONFIG.growthThreshold,minCoherence:CONFIG.minCoherence,
      minClippedForGrowth:CONFIG.minClippedForGrowth,successMargin:CONFIG.successMargin
    },
    ordinary,thirdway,criteria,verdict,events:exp.events
  };
}
