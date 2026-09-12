import { CONFIG } from './config.js';

const OBS = 5;
const H = CONFIG.hiddenSize;

function zeros(n) { return new Float64Array(n); }
function copyArray(a) { return Float64Array.from(a); }
function norm(a) { let s=0; for (const x of a) s += x*x; return Math.sqrt(s); }
function dot(a,b){ let s=0; for(let i=0;i<a.length;i++) s += a[i]*b[i]; return s; }
function sigmoid(x){ return 1/(1+Math.exp(-Math.max(-40,Math.min(40,x)))); }

function createRoute(rng) {
  const Win = zeros(H*OBS), Wrec = zeros(H*H), b = zeros(H), Wout = zeros(H);
  for (let i=0;i<Win.length;i++) Win[i] = rng.normal()*0.18;
  for (let i=0;i<Wrec.length;i++) Wrec[i] = rng.normal()*0.07;
  for (let i=0;i<b.length;i++) b[i] = rng.normal()*0.025;
  for (let i=0;i<Wout.length;i++) Wout[i] = rng.normal()*0.15;
  return {Win,Wrec,b,Wout,bout:0.08};
}

function cloneRoute(r) {
  return {Win:copyArray(r.Win),Wrec:copyArray(r.Wrec),b:copyArray(r.b),Wout:copyArray(r.Wout),bout:r.bout};
}

export function routeFlatLength(){ return H*OBS + H*H + H + H + 1; }

export function controllerSlices(c) {
  const routeLen=routeFlatLength();
  if(c.routes.length!==2 || !c.gate) throw new Error('controllerSlices requires a grown two-route controller');
  const gateLen=OBS+1;
  return {
    route0:{start:0,end:routeLen},
    route1:{start:routeLen,end:routeLen*2},
    gate:{start:routeLen*2,end:routeLen*2+gateLen}
  };
}

function flattenRoute(r, out) {
  out.push(...r.Win, ...r.Wrec, ...r.b, ...r.Wout, r.bout);
}

function applyRouteDelta(r, delta, offset, scale) {
  let k=offset;
  for(let i=0;i<r.Win.length;i++) r.Win[i]+=delta[k++]*scale;
  for(let i=0;i<r.Wrec.length;i++) r.Wrec[i]+=delta[k++]*scale;
  for(let i=0;i<r.b.length;i++) r.b[i]+=delta[k++]*scale;
  for(let i=0;i<r.Wout.length;i++) r.Wout[i]+=delta[k++]*scale;
  r.bout += delta[k++]*scale;
  return k;
}

export function createController(rng) {
  return {routes:[createRoute(rng)], gate:null, growthMeta:null};
}

export function cloneController(c) {
  return {
    routes:c.routes.map(cloneRoute),
    gate:c.gate ? {w:copyArray(c.gate.w), b:c.gate.b} : null,
    growthMeta:c.growthMeta ? {...c.growthMeta} : null
  };
}

export function flattenController(c) {
  const out=[];
  for (const r of c.routes) flattenRoute(r,out);
  if(c.gate){ out.push(...c.gate.w,c.gate.b); }
  return Float64Array.from(out);
}

export function applyFlatDelta(c, delta, scale=1) {
  const expected = flattenController(c).length;
  if(delta.length!==expected) throw new Error(`Delta length ${delta.length} != ${expected}`);
  let k=0;
  for(const r of c.routes) k=applyRouteDelta(r,delta,k,scale);
  if(c.gate){
    for(let i=0;i<c.gate.w.length;i++) c.gate.w[i]+=delta[k++]*scale;
    c.gate.b += delta[k++]*scale;
  }
  return c;
}

function stepRoute(route, obs, prev) {
  const h=zeros(H);
  for(let i=0;i<H;i++){
    let s=route.b[i];
    const wi=i*OBS;
    for(let j=0;j<OBS;j++) s += route.Win[wi+j]*obs[j];
    const wr=i*H;
    for(let j=0;j<H;j++) s += route.Wrec[wr+j]*(prev?.[j] ?? 0);
    h[i]=Math.tanh(s);
  }
  return {h,u:Math.tanh(dot(route.Wout,h)+route.bout)};
}

export function runControllerStep(c, obs, memory=null) {
  if(obs.length!==OBS) throw new Error(`Expected ${OBS} observations`);
  const prevHs = memory?.h ?? c.routes.map(()=>zeros(H));
  const steps = c.routes.map((r,i)=>stepRoute(r,obs,prevHs[i]));
  let gate=0, u=steps[0].u;
  const blendHidden=zeros(H);
  if(c.routes.length===1){ blendHidden.set(steps[0].h); }
  else {
    gate=sigmoid(dot(c.gate.w,obs)+c.gate.b);
    u=(1-gate)*steps[0].u + gate*steps[1].u;
    for(let i=0;i<H;i++) blendHidden[i]=(1-gate)*steps[0].h[i]+gate*steps[1].h[i];
  }
  return {u:Math.max(-1,Math.min(1,u)), gate, blendHidden, memory:{h:steps.map(s=>s.h)}};
}

export function growResidualRoute(c, residual) {
  if(c.routes.length!==1) return cloneController(c);
  const base=cloneController(c);
  const flatLen=routeFlatLength();
  if(residual.length < flatLen) throw new Error('Residual too short for route projection');
  const routeResidual=residual.slice(0,flatLen);
  const n=norm(routeResidual);
  const scaled=zeros(flatLen);
  if(n>1e-12){ for(let i=0;i<flatLen;i++) scaled[i]=routeResidual[i]/n; }
  const route1=cloneRoute(base.routes[0]);
  applyRouteDelta(route1,scaled,0,CONFIG.growthResidualScale);
  base.routes.push(route1);
  base.gate={w:zeros(OBS), b:-2};
  base.growthMeta={residualNorm:n, residualScale:CONFIG.growthResidualScale};
  return base;
}
