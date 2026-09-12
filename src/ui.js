import { CONFIG } from './config.js';
import { createExperiment, stepEpisode, runAll } from './experiment.js';

const $=id=>document.getElementById(id);
let exp=null, timer=null, currentEvent=null, finalResult=null, traceFrame=0, animationTimer=null;

function fmt(x,n=3){ return Number.isFinite(x)?Number(x).toFixed(n):'—'; }
function terrainName(t){ return t==='G'?'GRAVEL':'ICE'; }
function terrainClass(t){ return t==='G'?'gravel':'ice'; }

function renderSchedule(){
  $('schedule').innerHTML=CONFIG.schedule.map((t,i)=>`<div class="slot ${t} ${exp&&i<exp.episodeIndex?'done':''} ${exp&&i===exp.episodeIndex?'active':''}">${t}</div>`).join('');
  $('episodeLabel').textContent=`episode ${exp?.episodeIndex ?? 0} / ${CONFIG.schedule.length}`;
}

function sparkline(svg,trace,key,scale=1){
  if(!trace?.length){svg.innerHTML='';return;}
  const vals=trace.map(p=>p[key]*scale);
  let lo=Math.min(...vals), hi=Math.max(...vals); if(Math.abs(hi-lo)<1e-9){lo-=1;hi+=1;}
  const pts=vals.map((v,i)=>`${(i/(vals.length-1))*500},${105-((v-lo)/(hi-lo))*90}`).join(' ');
  svg.innerHTML=`<line x1="0" y1="60" x2="500" y2="60" stroke="#17313e"/><polyline fill="none" stroke="#66f2ca" stroke-width="3" vector-effect="non-scaling-stroke" points="${pts}"/><text x="10" y="18" fill="#7894a0" font-size="12">${key}</text>`;
}

function placeRobot(prefix,trace,terrain){
  const world=$(prefix==='ordinary'?'ordinaryWorld':'thirdWorld');
  const robot=$(prefix==='ordinary'?'ordinaryRobot':'thirdRobot');
  const label=$(prefix==='ordinary'?'ordinaryTerrain':'thirdTerrain');
  world.classList.remove('ice','gravel'); world.classList.add(terrainClass(terrain));
  label.textContent=`${terrainName(terrain)} · viewer-only`;
  if(!trace?.length)return;
  const p=trace[Math.min(traceFrame,trace.length-1)];
  const maxX=Math.max(1,...trace.map(q=>q.x));
  robot.style.left=`${Math.max(4,Math.min(76,5+70*(p.x/maxX)))}%`;
  robot.style.transform=`rotate(${Math.max(-8,Math.min(8,p.slip*1.2))}deg)`;
  robot.classList.toggle('spinning',Math.abs(p.slip)>0.55);
  $(prefix==='ordinary'?'ordinaryV':'thirdV').textContent=fmt(p.v);
  $(prefix==='ordinary'?'ordinarySlip':'thirdSlip').textContent=fmt(p.slip);
  $(prefix==='ordinary'?'ordinaryU':'thirdU').textContent=fmt(p.u);
  if(prefix==='third') $('thirdGate').textContent=fmt(p.gate);
}

function animateEvent(event){
  clearInterval(animationTimer); traceFrame=0;
  const max=Math.max(event.ordinary.displayTrace.length,event.thirdway.displayTrace.length);
  animationTimer=setInterval(()=>{
    placeRobot('ordinary',event.ordinary.displayTrace,event.terrain);
    placeRobot('third',event.thirdway.displayTrace,event.terrain);
    traceFrame++;
    if(traceFrame>=max){clearInterval(animationTimer);}
  },24);
}

function renderMachinery(event){
  const t=event.thirdway;
  $('proposalStatus').textContent=t.status;
  $('proposalId').textContent=t.proposalId===null?'none':`#${t.proposalId}`;
  $('proposalImprove').textContent=`Δ reward ${fmt(t.proposalImprovement,4)}`;
  $('collision').textContent=t.proposalCollisions?.length?fmt(Math.max(...t.proposalCollisions),4):'none';
  $('alpha').textContent=fmt(t.alpha,3);
  $('absorbed').textContent=`absorbed ${fmt(t.absorbedFraction*100,0)}%`;
  $('residual').textContent=`${fmt(t.residualNorm,3)} / ${fmt(t.residualThreshold,2)}`;
  $('residualBar').style.width=`${Math.min(100,100*t.residualNorm/t.residualThreshold)}%`;
  $('coherence').textContent=fmt(t.residualCoherence,3);
  $('clippedCount').textContent=`current clipped streak ${t.clippedCount}`;
  $('routeCount').textContent=`${t.routes} route${t.routes===1?'':'s'}`;
  $('growthCount').textContent=`${t.growthEvents} growth event${t.growthEvents===1?'':'s'}`;
  $('thirdBodyLabel').textContent=t.routes>1?'ROUTES 0+1':'ROUTE 0';
  $('routeDiagram').innerHTML=t.routes===1
    ?'<div class="node input">physical<br>observations</div><div class="arrow">→</div><div class="node route">route 0</div><div class="arrow">→</div><div class="node output">motor</div>'
    :'<div class="node input">physical<br>observations</div><div class="arrow">→</div><div class="node route">route 0</div><div class="node route grown">residual route 1</div><div class="arrow">gate</div><div class="node output">motor</div>';
}

function addLog(event){
  const t=event.thirdway;
  const line=document.createElement('div'); line.className='log-line';
  const collision=t.proposalCollisions?.length?Math.max(...t.proposalCollisions):0;
  line.textContent=`E${event.episode.toString().padStart(2,'0')} ${terrainName(event.terrain)} | proposal ${t.proposalId??'—'} | Δ=${fmt(t.proposalImprovement,4)} | collision=${fmt(collision,4)} | α=${fmt(t.alpha,3)} | R=${fmt(t.residualNorm,3)} | coh=${fmt(t.residualCoherence,3)} | routes=${t.routes}${t.grew?'  ← GROWTH':''}`;
  if($('eventLog').querySelector('.muted')) $('eventLog').innerHTML='';
  $('eventLog').prepend(line);
}

function renderEvent(event){
  currentEvent=event;
  $('ordinaryScore').textContent=fmt(event.ordinary.postScore);
  $('thirdScore').textContent=fmt(event.thirdway.postScore);
  $('ordinaryRoutes').textContent=String(event.ordinary.routes);
  sparkline($('ordinaryTrace'),event.ordinary.displayTrace,'v');
  sparkline($('thirdTrace'),event.thirdway.displayTrace,'v');
  placeRobot('ordinary',event.ordinary.displayTrace,event.terrain);
  placeRobot('third',event.thirdway.displayTrace,event.terrain);
  animateEvent(event); renderMachinery(event); addLog(event); renderSchedule();
  $('auditJson').textContent=JSON.stringify({seed:exp.seed,config:CONFIG,event},null,2);
}

function metricsTable(r){
  const rows=[
    ['gravel score','gravelScore'],['ice score','iceScore'],['alternating tail','alternatingTailMean'],['gravel retention Δ','gravelRetentionDelta'],['ice retention Δ','iceRetentionDelta'],['mean slip','meanSlip'],['mean energy','meanEnergy'],['accepted writes','acceptedWrites'],['clipped writes','clippedWrites'],['growth events','growthEvents'],['routes','routes']
  ];
  return `<table><thead><tr><th>metric</th><th>ordinary</th><th>residual growth</th></tr></thead><tbody>${rows.map(([name,key])=>`<tr><td>${name}</td><td>${typeof r.ordinary[key]==='number'?fmt(r.ordinary[key],key.includes('Writes')||key==='routes'||key==='growthEvents'?0:3):r.ordinary[key]}</td><td>${typeof r.thirdway[key]==='number'?fmt(r.thirdway[key],key.includes('Writes')||key==='routes'||key==='growthEvents'?0:3):r.thirdway[key]}</td></tr>`).join('')}</tbody></table>`;
}

function renderFinal(r){
  finalResult=r;
  const v=$('verdict'); v.textContent=`GATE 1 · ${r.verdict}`; v.className=`verdict ${r.verdict==='PASS'?'pass':'fail'}`;
  $('metricsTable').classList.remove('empty'); $('metricsTable').innerHTML=metricsTable(r);
  $('criteriaList').innerHTML=Object.entries(r.criteria).map(([name,c])=>`<div class="criterion ${c.pass?'pass':'fail'}"><span>${name.replace(/([A-Z])/g,' $1')}</span><strong>${c.pass?'PASS':'FAIL'} · ${fmt(c.value,3)} / ${fmt(c.threshold,3)}</strong></div>`).join('');
  $('auditJson').textContent=JSON.stringify(r,null,2);
}

function reset(){
  clearInterval(timer); timer=null; clearInterval(animationTimer);
  const seed=Number($('seedInput').value||CONFIG.seed);
  exp=createExperiment(seed); currentEvent=null; finalResult=null;
  $('runBtn').textContent='Run'; $('verdict').textContent='NOT RUN'; $('verdict').className='verdict neutral';
  $('metricsTable').className='metrics-table empty'; $('metricsTable').textContent='Run all 14 episodes to generate the frozen receipt.';
  $('criteriaList').innerHTML='<div class="criterion neutral">No result yet</div>';
  $('eventLog').innerHTML='<div class="log-line muted">Waiting for the first real episode.</div>';
  $('auditJson').textContent=JSON.stringify({seed,config:CONFIG,status:'ready'},null,2);
  renderSchedule();
}

function step(){
  const event=stepEpisode(exp);
  if(event){renderEvent(event); return true;}
  if(!finalResult) renderFinal(runAll(exp.seed));
  clearInterval(timer); timer=null; $('runBtn').textContent='Run';
  return false;
}

$('runBtn').addEventListener('click',()=>{
  if(timer){clearInterval(timer);timer=null;$('runBtn').textContent='Run';return;}
  if(exp.episodeIndex>=CONFIG.schedule.length) reset();
  $('runBtn').textContent='Pause';
  step();
  timer=setInterval(()=>{if(!step())return;},Number($('speedSelect').value));
});
$('stepBtn').addEventListener('click',()=>{clearInterval(timer);timer=null;$('runBtn').textContent='Run';step();});
$('resetBtn').addEventListener('click',reset);
$('seedInput').addEventListener('change',reset);
$('auditToggle').addEventListener('click',()=>{$('machinery').classList.toggle('hidden');$('auditDrawer').open=!$('machinery').classList.contains('hidden');});
$('clearLogBtn').addEventListener('click',()=>{$('eventLog').innerHTML='<div class="log-line muted">View cleared; experiment state unchanged.</div>';});

reset();
