import { CONFIG } from './config.js';
import { cloneController, applyFlatDelta } from './controller.js';
import { evaluateController } from './search.js';

function l2(a){ let s=0; for(const x of a) s+=x*x; return Math.sqrt(s); }
function rmsDiff(a,b){
  if(a.length!==b.length) throw new Error(`Response length mismatch ${a.length} != ${b.length}`);
  if(!a.length) return 0;
  let s=0; for(let i=0;i<a.length;i++){ const d=a[i]-b[i]; s+=d*d; }
  return Math.sqrt(s/a.length);
}
function hashVector(v){
  let h=2166136261>>>0;
  for(const x of v){
    const q=Math.round(x*1e6)|0;
    h^=q; h=Math.imul(h,16777619)>>>0;
  }
  return h.toString(16).padStart(8,'0');
}

export function responseVector(controller, terrain, options={}) {
  const result=evaluateController(controller,terrain,options);
  const out=[];
  for(const p of result.trace){ out.push(...p.hidden,p.u,p.v,p.slip); }
  return Float64Array.from(out);
}

export function makeAnchor(controller, terrain, probeOptions={steps:CONFIG.stepsPerEpisode}) {
  const vector=responseVector(controller,terrain,probeOptions);
  return {terrain, probeOptions:{...probeOptions}, vector, hash:hashVector(vector)};
}

export function collisionRms(anchor, candidateController){
  const v=responseVector(candidateController,anchor.terrain,anchor.probeOptions);
  return rmsDiff(anchor.vector,v);
}

export function selectSafeAlpha({
  controller,
  delta,
  targetTerrain,
  anchors=[],
  minImprovement=CONFIG.minImprovement,
  scaleBank=CONFIG.scaleBank,
  collisionBudget=CONFIG.collisionBudget,
  options={}
}){
  const base=evaluateController(controller,targetTerrain,options);
  const evaluations=[];
  let selected=null;
  for(const alpha of scaleBank){
    const candidate=cloneController(controller);
    applyFlatDelta(candidate,delta,alpha);
    const target=evaluateController(candidate,targetTerrain,options);
    const collisions=anchors.map(a=>collisionRms(a,candidate));
    const improvement=target.score-base.score;
    const legalTarget=improvement>=minImprovement;
    const legalCollision=collisions.every(c=>c<=collisionBudget+1e-12);
    const row={alpha,score:target.score,improvement,collisions,legal:legalTarget&&legalCollision};
    evaluations.push(row);
    if(selected===null && row.legal) selected={alpha,candidate,target,collisions};
  }
  if(selected===null){
    const candidate=cloneController(controller);
    selected={alpha:0,candidate,target:base,collisions:anchors.map(a=>collisionRms(a,candidate))};
  }
  return {...selected,evaluations,baseScore:base.score};
}

export function updateResidual(residual, delta, alpha, beta=CONFIG.residualBeta){
  if(residual.length!==delta.length) throw new Error('Residual/delta length mismatch');
  const out=new Float64Array(residual.length);
  for(let i=0;i<out.length;i++) out[i]=beta*residual[i]+(1-alpha)*delta[i];
  return out;
}

function cosine(a,b){
  let d=0,aa=0,bb=0;
  const n=Math.min(a.length,b.length);
  for(let i=0;i<n;i++){ d+=a[i]*b[i]; aa+=a[i]*a[i]; bb+=b[i]*b[i]; }
  if(aa<1e-18||bb<1e-18) return 0;
  return d/Math.sqrt(aa*bb);
}

export function residualCoherence(history){
  if(history.length<2) return 0;
  let sum=0, count=0;
  for(let i=1;i<history.length;i++){
    sum+=cosine(history[i-1],history[i]); count++;
  }
  return sum/count;
}

export function residualNorm(residual){ return l2(residual); }

export function shouldGrow({norm,threshold,coherence,minCoherence,clippedCount,minClipped}){
  return norm>=threshold && coherence>=minCoherence && clippedCount>=minClipped;
}
