import { CONFIG } from './config.js';
import { initialState, observe, stepPhysics, stepReward } from './physics.js';
import { cloneController, flattenController, applyFlatDelta, runControllerStep, controllerSlices } from './controller.js';

export function evaluateController(controller, terrain, options={}) {
  const steps = options.steps ?? CONFIG.stepsPerEpisode;
  let state = initialState();
  let memory = null;
  let score = 0, slipSum = 0, energySum = 0, gateSum = 0;
  const trace = [];
  for (let t=0; t<steps; t++) {
    const obs = observe(state, CONFIG.targetV);
    const ctrl = runControllerStep(controller, obs, memory);
    memory = ctrl.memory;
    const phys = stepPhysics(state, ctrl.u, terrain, CONFIG.dt);
    state = phys.state;
    const r = stepReward(state, ctrl.u, phys);
    score += r;
    slipSum += Math.abs(phys.slip);
    energySum += phys.energy;
    gateSum += ctrl.gate;
    trace.push({
      t, obs:Array.from(obs), x:state.x, v:state.v, omega:state.omega, phi:state.phi,
      u:ctrl.u, gate:ctrl.gate, slip:phys.slip, traction:phys.traction, reward:r,
      hidden:Array.from(ctrl.blendHidden)
    });
  }
  const n=Math.max(1,steps);
  return {
    score:score/n,
    meanSlip:slipSum/n,
    meanEnergy:energySum/n,
    meanGate:gateSum/n,
    finalState:state,
    trace
  };
}

export function proposalBatch(baseController, rng, count=CONFIG.proposalCount, sigma=CONFIG.proposalSigma) {
  const dim = flattenController(baseController).length;
  const batch=[];
  for(let i=0;i<count;i++){
    const d=new Float64Array(dim);
    for(let j=0;j<dim;j++) d[j]=rng.normal()*sigma;
    batch.push(d);
  }
  return batch;
}

export function maskedProposalBatch(baseController, rng, count=CONFIG.proposalCount, sigma=CONFIG.proposalSigma, mask=['gate']) {
  const slices=controllerSlices(baseController);
  for(const name of mask) if(!slices[name]) throw new Error(`Unknown controller slice: ${name}`);
  const selected=mask.map(name=>slices[name]);
  const batch=proposalBatch(baseController,rng,count,sigma);
  for(const delta of batch){
    for(let i=0;i<delta.length;i++){
      if(!selected.some(s=>i>=s.start && i<s.end)) delta[i]=0;
    }
  }
  return batch;
}

export function scoreProposal(baseController, delta, terrain, scale=1, options={}) {
  const candidate=cloneController(baseController);
  applyFlatDelta(candidate,delta,scale);
  const result=evaluateController(candidate,terrain,options);
  return {...result, controller:candidate};
}

export function bestProposal(baseController, terrain, deltas, minImprovement=CONFIG.minImprovement, options={}) {
  const base=evaluateController(baseController,terrain,options);
  const candidateScores=[];
  let best=null;
  for(let i=0;i<deltas.length;i++){
    const scored=scoreProposal(baseController,deltas[i],terrain,1,options);
    candidateScores.push({id:i,score:scored.score,improvement:scored.score-base.score,meanSlip:scored.meanSlip});
    if(!best || scored.score>best.candidateScore){
      best={id:i,delta:deltas[i],baseScore:base.score,candidateScore:scored.score,improvement:scored.score-base.score,result:scored};
    }
  }
  return {
    baseScore:base.score,
    proposal:best && best.improvement>=minImprovement ? best : null,
    candidateScores
  };
}
