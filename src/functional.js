import { CONFIG } from './config.js';
import { responseVector } from './compatibility.js';

function cosine(a,b){
  const n=Math.min(a.length,b.length);
  let d=0,aa=0,bb=0;
  for(let i=0;i<n;i++){ d+=a[i]*b[i]; aa+=a[i]*a[i]; bb+=b[i]*b[i]; }
  if(aa<1e-18 || bb<1e-18) return 0;
  return d/Math.sqrt(aa*bb);
}

function unit(v){
  let s=0; for(const x of v) s+=x*x;
  const n=Math.sqrt(s);
  const out=new Float64Array(v.length);
  if(n<1e-18) return out;
  for(let i=0;i<v.length;i++) out[i]=v[i]/n;
  return out;
}

function diff(a,b){
  if(a.length!==b.length) throw new Error(`Functional response length mismatch ${a.length} != ${b.length}`);
  const out=new Float64Array(a.length);
  for(let i=0;i<a.length;i++) out[i]=a[i]-b[i];
  return out;
}

export function functionalEffectVector(acceptedController, fullController, options={steps:CONFIG.stepsPerEpisode}){
  const acceptedG=responseVector(acceptedController,'G',options);
  const fullG=responseVector(fullController,'G',options);
  const acceptedI=responseVector(acceptedController,'I',options);
  const fullI=responseVector(fullController,'I',options);
  const dG=diff(fullG,acceptedG);
  const dI=diff(fullI,acceptedI);
  const out=new Float64Array(dG.length+dI.length);
  out.set(dG,0); out.set(dI,dG.length);
  return out;
}

export function functionalCoherence(history){
  if(history.length<2) return 0;
  let sum=0;
  for(let i=1;i<history.length;i++) sum+=cosine(history[i-1],history[i]);
  return sum/(history.length-1);
}

export function representativeResidual(entries){
  if(!entries.length) throw new Error('Cannot choose representative residual from empty history');
  const dim=entries[0].effect.length;
  const centroid=new Float64Array(dim);
  for(const entry of entries){
    if(entry.effect.length!==dim) throw new Error('Functional effect length mismatch');
    const u=unit(entry.effect);
    for(let i=0;i<dim;i++) centroid[i]+=u[i];
  }
  let bestIndex=0, bestSimilarity=-Infinity;
  for(let i=0;i<entries.length;i++){
    const sim=cosine(entries[i].effect,centroid);
    if(sim>bestSimilarity){ bestSimilarity=sim; bestIndex=i; }
  }
  const best=entries[bestIndex];
  return {
    index:bestIndex,
    eventIndex:best.eventIndex,
    residual:Float64Array.from(best.residual),
    effect:Float64Array.from(best.effect),
    similarity:bestSimilarity
  };
}
