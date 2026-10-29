/* Gridline Mayor UI: start screen, HUD, desk, decisions with 3D previews, dashboard, events, model check. */
(function(){
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const E=window.ENGINE, SIMx=window.SIM;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const fmtK=v=>{const a=Math.abs(v);return a>=1e6?(v/1e6).toFixed(a>=1e7?1:2)+"M":a>=1e4?Math.round(v/1e3)+"k":a>=1e3?(v/1e3).toFixed(1)+"k":Math.round(v).toString();};
const fmt$=SIMx.fmt$;
const money=v=>"$"+Math.round(v).toLocaleString();
const moneyK=v=>v>=1e6?"$"+(v/1e6).toFixed(2)+"M":"$"+Math.round(v/1e3)+"k";
const pct=(v,d)=>(v>=0?"+":"")+(v*100).toFixed(d==null?1:d)+"%";
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let S=null, leftTab="desk", rightTab="metrics", current=null, currentOpt=0, overlayKey="none", playing=false, placeMode=null, busy=false;

/* ---------- start screen ---------- */
const ISSUES={nyc:"Affordability: rents eat over half of a typical household's income.",chi:"Violence prevention and a transit funding gap.",sf:"Street homelessness and a hollowed-out downtown office market.",sea:"Region's homelessness count is rising; tech job swings.",sd:"Housing costs vs. incomes; airport height limits downtown."};
function buildStart(){
  const box=$("#ccards");let sel="nyc";
  box.innerHTML=GEO.order.map(k=>{const C=GEO.cities[k],b=C.baseline;return `<button class="cc" type="button" data-k="${k}" aria-pressed="${k===sel}"><b>${C.name}</b><span class="s">${esc(C.area)}</span>
    <dl><dt>Population</dt><dd>${fmtK(b.pop)}</dd><dt>Typical home</dt><dd>${moneyK(b.homeValue)}</dd><dt>Homeless count</dt><dd>${fmtK(b.homeless)}${b.homelessScope?"*":""}</dd><dt>Violent crime /100k</dt><dd>${b.violent.toFixed(0)}</dd><dt>Congestion</dt><dd>${b.congestion}%</dd><dt>Budget</dt><dd>$${b.budget}B</dd></dl>
    <span class="issue">${ISSUES[k]}</span></button>`;}).join("");
  box.onclick=e=>{const b=e.target.closest(".cc");if(!b)return;sel=b.dataset.k;$$(".cc").forEach(c=>c.setAttribute("aria-pressed",c.dataset.k===sel));};
  $("#startBtn").onclick=()=>startGame(sel,$("#mayorName").value.trim());
}
/* ---------- saves: game state + a log of every change made to the 3D city, replayed on load ---------- */
const SAVE_KEY="gridline.saves.v1",LOGGED=["commitTower","commitZone","commitPark","commitLine","setProgress","showProject","zoneStep","addToNetwork"];
let replaying=false;
LOGGED.forEach(n=>{const f=E[n];if(typeof f!=="function")return;E[n]=function(...a){if(S&&!replaying){S.elog=S.elog||[];S.elog.push([n,JSON.parse(JSON.stringify(a))]);}return f.apply(E,a);};});
function readSaves(){try{return JSON.parse(localStorage.getItem(SAVE_KEY)||"[]")||[];}catch(e){return [];}}
function writeSaves(list){try{localStorage.setItem(SAVE_KEY,JSON.stringify(list));return true;}catch(e){toast("Couldn't save: this browser blocked storage or it is full.");return false;}}
function saveGame(slot){if(!S)return false;const list=readSaves().filter(x=>x.slot!==slot);
  const m=S.m;list.unshift({slot,key:S.key,mayor:S.mayor,q:S.q,label:qLabel(S.q),approval:Math.round(m.approval),at:Date.now(),state:JSON.stringify(S)});
  const auto=list.filter(x=>x.slot.startsWith("auto"));const man=list.filter(x=>!x.slot.startsWith("auto"));
  return writeSaves(auto.slice(0,5).concat(man.slice(0,12)).sort((a,b)=>b.at-a.at));}
function qLabel(q){return "Q"+(q%4+1)+" "+(2027+Math.floor(q/4));}
function autosave(){if(S)saveGame("auto-"+S.key);}
async function loadSave(sv){const st=JSON.parse(sv.state);await startGame(st.key,st.mayor,st);}
async function startGame(key,name,saved){
  $("#start").classList.add("hidden");$("#loading").classList.remove("hidden");
  const C=GEO.cities[key];$("#loadMsg").textContent=`Building ${C.name}…`;
  await E.load(key,(t,m)=>{$("#loadBar").style.width=Math.round(t*100)+"%";$("#loadSub").textContent=m;});
  if(saved){S=SIMx.load(saved);replaying=true;try{for(const [n,a] of S.elog||[])E[n](...a);}catch(e){console.warn("replay",e);}replaying=false;
    E.setEnv({month:MONTH_OF_Q[S.q%4],hour:10,wx:"clear",flood:0});}
  else{S=SIMx.start(key,name);S.elog=[];
  E.setEnv({month:1,hour:10,wx:"clear",flood:0});
  S.inbox=SIMx.genProposals(E,3);}
  $("#loading").classList.add("hidden");["#top","#left","#right","#tray","#zoomBtns"].forEach(s=>$(s).classList.remove("hidden"));$("#minimap").style.display="block";
  $("#seal").textContent={nyc:"NY",chi:"CHI",sf:"SF",sea:"SEA",sd:"SD"}[key];
  $("#cityName").textContent=(name?name+", Mayor of ":"Mayor of ")+C.name;$("#cityArea").textContent=C.area;
  topH();refreshTraffic();renderAll();
  if(saved)toast(`Loaded ${C.name}, ${qLabel(S.q)}.`);else{briefing();autosave();}
}
function briefing(){
  const C=GEO.cities[S.key],b=S.base;
  const body=`<div class="eyebrow">Inauguration · January 2027</div><h2>Welcome to City Hall, ${esc(S.mayor==="Mayor"?"Mayor":S.mayor)}.</h2>
  <p>${C.name} starts where it really is today: ${fmtK(b.pop)} residents, a typical home worth ${moneyK(b.homeValue)}, ${fmtK(b.homeless)} people counted as homeless${b.homelessScope?" across "+b.homelessScope:""}, ${b.violent.toFixed(0)} violent crimes per 100,000 residents, and traffic that adds ${b.congestion}% to the average trip.</p>
  <p>You have a four-year term (16 quarters). Each quarter: review proposals on your desk, preview them on the map, approve or deny, set the budget, then press <b>Next quarter</b>. Unexpected events will test you. In Q4 2030 voters decide whether you stay.</p>
  <p class="note">Navigate: drag to pan, right-drag to rotate, scroll to zoom toward the cursor. WASD or arrow keys pan, Q/E rotate. Zoom in to see street names.</p>
  <div><button class="btn primary" type="button" data-close>Open my desk</button></div>`;
  modal(body);
}

/* ---------- modal & toast ---------- */
function modal(html,onClick){const root=$("#modalRoot");root.innerHTML=`<div class="modal"><div class="box glass">${html}</div></div>`;root.onclick=e=>{const c=e.target.closest("[data-close]");if(c){root.innerHTML="";}if(onClick)onClick(e);};}
let tT;function toast(h,ms){const t=$("#toast");t.innerHTML=h;t.classList.add("on");clearTimeout(tT);tT=setTimeout(()=>t.classList.remove("on"),ms||4200);}

/* ---------- top bar ---------- */
function renderTop(){
  const m=S.m;$("#mQ").textContent=SIMx.qLabel();
  const ap=$("#mApp");ap.textContent=Math.round(m.approval)+"%";ap.className=m.approval>=50?"up":"dn";
  $("#mRes").textContent=fmt$(Math.abs(m.reserve)).replace("$",m.reserve<0?"−$":"$");$("#mRes").className=m.reserve<0?"dn":"";
  const bal=m.revenue-m.spend;$("#mBal").textContent=(bal<0?"−":"+")+fmt$(Math.abs(bal));$("#mBal").className=bal<0?"dn":"up";
  const n=S.inbox.length;$("#deskN").textContent=n;$("#deskN").style.display=n?"":"none";
}

/* ---------- left panel ---------- */
const TYPECOL={tower:"#1D4ED8",housing:"#0E9F6E",upzone:"#D97706",transit:"#C2410C",ai:"#0891B2",park:"#15803D",safety:"#6D28D9",grant:"#B88A1B",conversion:"#475569"};
const TYPELBL={tower:"Development",housing:"Housing",upzone:"Zoning",transit:"Transit",ai:"AI plan",park:"Public space",safety:"Public safety",grant:"Grant",conversion:"Housing"};
function renderLeft(){
  $$("#left .tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.t===leftTab));
  const el=$("#leftBody");
  if(leftTab==="desk"){
    const items=S.inbox.map(p=>{const age=S.q-p.q;const c=p.cost||{};const costTxt=c.private?fmt$(c.private)+" private":c.total?fmt$(c.total)+" total":c.city?fmt$(c.city)+" city":c.annual?fmt$(c.annual)+"/yr":"No cost";
      return `<button class="card stripe" type="button" data-id="${p.id}" style="--k:${TYPECOL[p.type]}"><div class="row"><span class="tag" style="color:${TYPECOL[p.type]}">${TYPELBL[p.type]}</span><span class="meta">${age>=2?'<span class="dn">expires soon</span>':age?"waiting "+age+"q":"new"}</span></div><div class="ttl">${esc(p.title)}</div><div class="meta"><span>${esc(p.where||"")}</span><span>${costTxt}</span></div></button>`;}).join("");
    el.innerHTML=`<div class="eyebrow">Awaiting your decision</div>${items||'<p class="empty">Your desk is clear. Start something yourself below, or move to the next quarter.</p>'}
      <div class="eyebrow" style="margin-top:6px">Start an initiative</div>
      <div class="tools"><button class="btn" type="button" data-tool="upzone">Rezone an area</button><button class="btn" type="button" data-tool="park">Create a park</button><button class="btn" type="button" data-tool="buslanes">Bus lanes on a street</button><button class="btn" type="button" data-tool="ai">Ask the AI traffic planner</button></div>`;
  }else if(leftTab==="budget"){
    const rows=SIMx.LEVERS.map(L=>{const v=S.pol[L.k];const cost=SIMx.leverCost(L.k,v);return `<div class="lever"><div class="row"><span>${L.label}</span><span class="num">${L.fmt(v)}</span></div><input type="range" data-k="${L.k}" min="${L.min}" max="${L.max}" step="${L.step}" value="${v}" aria-label="${L.label}"><small>${cost?(cost>0?"Costs ":"Raises ")+fmt$(Math.abs(cost))+"/yr. ":""}${L.note}</small></div>`;}).join("");
    const m=S.m;el.innerHTML=`<div class="kv"><div><span>Revenue</span><b>${fmt$(m.revenue)}/yr</b></div><div><span>Spending</span><b>${fmt$(m.spend)}/yr</b></div><div><span>Reserve</span><b class="${m.reserve<0?"dn":""}">${fmt$(m.reserve)}</b></div><div><span>Bond debt</span><b>${fmt$(m.debt)}</b></div></div>${rows}<p class="note">Changes take effect next quarter. Running down the reserve below zero hurts your approval and credit.</p>`;
  }else if(leftTab==="projects"){
    const pr=S.projects.slice().reverse();
    el.innerHTML=pr.length?pr.map(p=>`<button class="card stripe" type="button" data-proj="${p.id}" style="--k:${TYPECOL[p.type]||"#555"}"><div class="row"><span class="tag">${TYPELBL[p.type]||p.type}</span><span class="meta">${p.status==="done"?'<span class="up">Complete</span>':Math.round(p.prog*100)+"%"}</span></div><div class="ttl">${esc(p.title)}</div><div class="meta">${esc(p.where||"")} · started ${SIMx.qLabel(p.startQ)}</div><div class="prog"><i style="width:${Math.round(p.prog*100)}%"></i></div></button>`).join(""):'<p class="empty">Nothing approved yet. Approved projects show up here and get built on the map quarter by quarter.</p>';
    const zs=S.zones.map(z=>`<div class="card"><div class="ttl">Rezoned area · ${z.kind}</div><div class="meta">${Math.round(z.built||0).toLocaleString()} homes built so far · ${Math.round((1-z.left)*100)}% of expected build-out</div></div>`).join("");
    if(zs)el.innerHTML+=`<div class="eyebrow">Rezoned areas</div>`+zs;
  }else if(leftTab==="transit"){el.innerHTML=transitTab();
  }else{
    el.innerHTML=S.news.length?S.news.map(n=>`<div class="card stripe" style="--k:${n.kind==="ok"?"var(--good)":n.kind==="deny"?"var(--muted)":"var(--warn)"}"><div class="meta">${SIMx.qLabel(n.q)} · ${esc(n.where)}</div><div class="ttl" style="font-weight:600">${esc(n.t)}</div></div>`).join(""):'<p class="empty">No news yet.</p>';
  }
}
$("#left").addEventListener("click",e=>{
  const t=e.target.closest(".tabs button");if(t){leftTab=t.dataset.t;renderLeft();return;}
  const c=e.target.closest("[data-id]");if(c){const p=S.inbox.find(x=>x.id==c.dataset.id);if(p)openDetail(p);return;}
  const pj=e.target.closest("[data-proj]");if(pj){const p=S.projects.find(x=>x.id==pj.dataset.proj);if(p&&p.x!=null)E.flyTo(p.x,p.z,900);return;}
  const tl=e.target.closest("[data-tool]");if(tl)startTool(tl.dataset.tool);
  const ln=e.target.closest("[data-line]");if(ln){E.flyToLine(ln.dataset.line);return;}
  const fq=e.target.closest("[data-freq]");if(fq){S.lineFreq=S.lineFreq||{};const id=fq.dataset.freq;S.lineFreq[id]=((S.lineFreq[id]||0)+1)%3;updateFreq();renderLeft();renderTop();return;}
  const ex=e.target.closest("[data-ext]");if(ex){const p=SIMx.extensionProposal(E,ex.dataset.ext,true);if(!p){toast("No good extension: the line ends at the map edge or next to water.");return;}S.inbox.unshift(p);openDetail(p);renderLeft();renderTop();return;}
  const pl=e.target.closest("[data-plan]");if(pl){const P=(window.TRANSIT_PLANS[S.key]||[]).find(x=>x.id===pl.dataset.plan);S.plansUsed=S.plansUsed||[];if(!S.plansUsed.includes(P.id))S.plansUsed.push(P.id);const p=SIMx.planProposal(E,P);p.sponsor="Mayor's office";p.custom=true;S.inbox.unshift(p);openDetail(p);renderLeft();renderTop();return;}
});
/* ---------- transit ---------- */
const RAILSH={nyc:.68,chi:.5,sf:.45,sea:.35,sd:.25};
function railArea(){const t=E.totals(),b=S.base;return S.m.transit*(RAILSH[S.key]||.4)*Math.min(1,1.4*(t.res+t.jobs)/(b.pop+b.jobs));}
function lineRiders(l){const W=E.totalStationWeight()||1;return railArea()*E.lineWeight(l)/W;}
function updateFreq(){let r=0,c=0;for(const [id,lv] of Object.entries(S.lineFreq||{})){if(!lv)continue;const l=E.lineById(id);if(!l)continue;const lr=lineRiders(l);r+=lr*(Math.pow(1+.25*lv,.45)-1);c+=lr*260*4.5*.25*lv/1e9;}S.freqRiders=r;S.freqCost=c;}
function transitTab(){
  const T=E.transit(),lines=T.lines.slice().sort((a,b)=>E.lineWeight(b)-E.lineWeight(a));const cov=E.transitCover(),cl=E.cells();let pr=0,pa=0;for(let k=0;k<cl.res.length;k++){pa+=cl.res[k];if(cov&&cov[k])pr+=cl.res[k];}
  const plans=(window.TRANSIT_PLANS[S.key]||[]),used=S.plansUsed||[];
  const rows=lines.map(l=>{const lv=(S.lineFreq||{})[l.id]||0;const n=l.stops.filter(s=>s.st).length;const lr=lineRiders(l);const cost=lr*260*4.5*.25/1e9;
    return `<div class="card tline"><button class="lhead" type="button" data-line="${esc(l.id)}"><span class="bullet" style="background:${l.color}">${esc(l.ref.length<=3?l.ref:"")}</span><span><b>${esc(l.name)}</b><small>${esc(l.kindLbl)} · ${n} station${n===1?"":"s"} in view · ~${fmtK(lr)} riders/day here</small></span></button>
      <div class="lbtns"><button class="btn sm${lv?" on":""}" type="button" data-freq="${esc(l.id)}">${lv?"Service +"+lv*25+"%":"Run more trains"}</button><button class="btn sm" type="button" data-ext="${esc(l.id)}">Propose extension</button></div>${lv?`<small class="note">+${fmtK(lr*(Math.pow(1+.25*lv,.45)-1))} riders/day for ${SIMx.fmt$(cost*lv)}/yr</small>`:""}</div>`;}).join("");
  const pls=plans.map(p=>`<button class="card stripe" type="button" data-plan="${p.id}" style="--k:${p.color||"#1565c0"}" ${used.includes(p.id)?"disabled":""}><div class="row"><span class="tag" style="color:${p.color||"#1565c0"}">${{subway:"Subway",rail:"Light rail",streetcar:"Streetcar",brt:"BRT"}[p.kind]}</span><span class="meta">${used.includes(p.id)?"already on the agenda":"bring to council"}</span></div><div class="ttl">${esc(p.title)}</div><div class="meta"><span>${esc(p.src.split(".")[0])}</span></div></button>`).join("");
  return `<div class="kv"><div><span>Weekday transit riders</span><b>${fmtK(S.m.transit)}</b></div><div><span>Residents near rail (800 m)</span><b>${pa?Math.round(pr/pa*100):0}%</b></div><div><span>Commutes by car</span><b>${Math.round(S.m.carShare*100)}%</b></div><div><span>Extra service cost</span><b>${SIMx.fmt$(S.freqCost||0)}/yr</b></div></div>
   <div class="tools"><button class="btn" type="button" data-tool="newline">Draw a new line</button><button class="btn" type="button" data-tool="showtransit">Show the network</button></div>
   <div class="eyebrow">Planned and studied projects</div>${pls||'<p class="empty">No published plans in this area.</p>'}
   <div class="eyebrow">Lines in this area</div>${rows||'<p class="empty">No rail lines in view.</p>'}
   <p class="note">Lines and stations come from OpenStreetMap. Rider counts split the city's weekday transit ridership by how many homes and jobs sit near each station. They are model estimates, not agency counts.</p>`;}
let drawPts=null,drawKind="rail";
function drawHint(){const n=drawPts.length;$("#placeHint").innerHTML=`${n?n+" point"+(n>1?"s":"")+". Tap to add more.":"Tap where the line starts. Starting on a station connects to it."} <span class="seg">${["subway","rail","streetcar","brt"].map(k=>`<button class="btn sm${drawKind===k?" on":""}" type="button" data-dk="${k}">${{subway:"Subway",rail:"Light rail",streetcar:"Streetcar",brt:"BRT"}[k]}</button>`).join("")}</span> <button class="btn sm primary" type="button" id="drawDone" ${n<2?"disabled":""}>Done</button> <button class="btn sm" type="button" id="cancelPlace">Cancel</button>`;
  $("#cancelPlace").onclick=()=>{placeMode=null;drawPts=null;E.clearPreview();$("#placeHint").classList.add("hidden");};
  $("#drawDone").onclick=finishLine;$$("#placeHint [data-dk]").forEach(b=>b.onclick=()=>{drawKind=b.dataset.dk;drawHint();drawPrev();});}
function drawStations(){const st=[];const sp={subway:900,rail:900,streetcar:450,brt:500}[drawKind];const all=E.transit().stations;
  const snap=(x,z)=>{let b=null,bd=350;for(const s of all){const d=Math.hypot(s.x-x,s.z-z);if(d<bd){bd=d;b=s;}}return b;};
  const s0=snap(drawPts[0][0],drawPts[0][1]);if(s0)drawPts[0]=[s0.x,s0.z];st.push([drawPts[0][0],drawPts[0][1],s0?s0.n:E.stationName(drawPts[0][0],drawPts[0][1])]);
  let acc=0;for(let i=0;i<drawPts.length-1;i++){const a=drawPts[i],b=drawPts[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);let t=sp-acc;while(t<L-sp*.4){const x=a[0]+(b[0]-a[0])*t/L,z=a[1]+(b[1]-a[1])*t/L;st.push([x,z,E.stationName(x,z)]);t+=sp;}acc=(acc+L)%sp;}
  const e=drawPts[drawPts.length-1];const se=snap(e[0],e[1]);st.push([e[0],e[1],se?se.n:E.stationName(e[0],e[1])]);
  const seen=new Set();return st.filter(s=>{if(seen.has(s[2])&&s!==st[0]&&s!==st[st.length-1])s[2]=s[2]+" "+(seen.size+1);seen.add(s[2]);return true;});}
function drawPrev(){if(drawPts&&drawPts.length>1)E.previewLine(drawPts,drawKind,{stations:drawStations(),color:"#1565c0"});}
function finishLine(){const st=drawStations();const pts=drawPts.slice();placeMode=null;drawPts=null;$("#placeHint").classList.add("hidden");
  const p=SIMx.transitProposal(E,{title:`New ${{subway:"subway",rail:"light rail",streetcar:"streetcar",brt:"bus rapid transit"}[drawKind]} line: ${st[0][2]} to ${st[st.length-1][2]}`,kind:drawKind,color:"#1565c0",pts,stations:st,sponsor:"Mayor's office",custom:true});
  S.inbox.unshift(p);openDetail(p);renderLeft();renderTop();}
$("#left").addEventListener("input",e=>{const r=e.target.closest("input[data-k]");if(!r)return;SIMx.setLever(r.dataset.k,+r.value);clearTimeout(r._t);r._t=setTimeout(()=>{renderLeft();},250);const L=SIMx.LEVERS.find(l=>l.k===r.dataset.k);r.parentElement.querySelector(".num").textContent=L.fmt(+r.value);});

/* ---------- initiatives (map placement) ---------- */
function startTool(t){
  closeDetail();
  if(t==="showtransit"){overlayKey="transit";$("#overlay").value="transit";E.setTrafficView(false);E.setTransitView(true);applyOverlay();return;}
  if(t==="newline"){placeMode="newline";drawPts=[];$("#placeHint").classList.remove("hidden");drawHint();if(overlayKey!=="transit")startTool("showtransit");return;}
  if(t==="ai"){const p=SIMx.custom("ai",E);if(p){p.sponsor="Mobility AI planner";S.inbox.unshift(p);openDetail(p);renderLeft();renderTop();}return;}
  if(t==="buslanes"){
    const paths=E.namedPaths().filter(p=>!p.hwy&&p.len>1500);const tr=E.traffic({hour:8,carShare:S.m.carShare});
    const sc=paths.map(p=>Object.assign(p,{tti:E.pathStats(p.pts,{tr}).tti})).sort((a,b)=>b.tti-a.tti).slice(0,10);
    modal(`<div class="eyebrow">Bus lanes</div><h2>Pick a corridor</h2><p>Sorted by rush-hour delay in the traffic model.</p><div class="choices">${sc.map((p,i)=>`<button class="btn" type="button" data-i="${i}"><b>${esc(p.name)}</b> <span class="num neu">· ${(p.len/1000).toFixed(1)} km · ${p.tti.toFixed(2)}× delay</span></button>`).join("")}</div><div><button class="btn" type="button" data-close>Cancel</button></div>`,e=>{const b=e.target.closest("[data-i]");if(!b)return;$("#modalRoot").innerHTML="";const p=SIMx.custom("buslanes",E,{path:sc[+b.dataset.i]});S.inbox.unshift(p);openDetail(p);renderLeft();});
    return;}
  placeMode=t;$("#placeHint").classList.remove("hidden");
  $("#placeHint").innerHTML=(t==="upzone"?"Tap the map where you want to rezone (300 m radius).":"Tap the map where the park should go.")+' <button class="btn sm" type="button" id="cancelPlace">Cancel</button>';
  $("#cancelPlace").onclick=()=>{placeMode=null;$("#placeHint").classList.add("hidden");};
}
const cv=$("#c");let down=null;
cv.addEventListener("pointerdown",e=>{down=[e.clientX,e.clientY];});
cv.addEventListener("pointerup",e=>{if(!down)return;const mv=Math.hypot(e.clientX-down[0],e.clientY-down[1]);down=null;if(mv>6||!placeMode)return;
  const g=E.groundPoint(e.clientX,e.clientY);if(!g)return;
  if(placeMode==="newline"){drawPts.push([g.x,g.z]);drawHint();drawPrev();return;}
  if(!E.clsAt(g.x,g.z)){toast("That's water. Pick a spot on land.");return;}
  const t=placeMode;placeMode=null;$("#placeHint").classList.add("hidden");
  const p=SIMx.custom(t,E,{x:g.x,z:g.z,r:t==="upzone"?300:90,kind:"housing",stories:10});S.inbox.unshift(p);openDetail(p);renderLeft();renderTop();});

/* ---------- decision drawer ---------- */
function shiftView(on){const W=window.innerWidth;if(!on||W<1100){E.setViewShift(0);return;}const L=$("#left").getBoundingClientRect().right,R=$("#right").getBoundingClientRect().left,dr=$("#detail").getBoundingClientRect().right;E.setViewShift(((Math.max(L,dr)+R)/2)-W/2);}
function topH(){const t=$("#top");if(t&&!t.classList.contains("hidden"))document.documentElement.style.setProperty("--topH",Math.round(t.getBoundingClientRect().height)+"px");}
window.addEventListener("resize",()=>{topH();shiftView(!!current);});
function openDetail(p){
  current=p;currentOpt=p.choice||0;const d=$("#detail");d.classList.remove("hidden");
  if(window.innerWidth<860){$("#left").classList.remove("open");$("#right").classList.remove("open");}
  renderDetail();shiftView(true);preview(p);
  setTimeout(()=>{if(current===p){p._fc=forecastFor(p);renderDetail();}},30);
}
function closeDetail(){current=null;$("#detail").classList.add("hidden");E.clearPreview();shiftView(false);}
function preview(p){
  E.clearPreview();
  if(p.spec)E.previewTower(p.spec);
  else if(p.zone)E.previewZone(p.zone);
  else if(p.park)E.previewPark(p.park);
  else if(p.pts){const k=p.type==="transit"?p.kind:(p.options&&p.options[currentOpt].k==="buslanes"?"brt":"signal");E.previewLine(p.pts,k,p.type==="transit"?{stations:p.stations,color:p.color}:null);}
  if(p.x!=null){const dist=p.type==="transit"||p.type==="ai"?Math.max(1800,(p.km||2)*700):p.zone?1500:p.spec?Math.max(750,p.spec.h*4):900;E.flyTo(p.x,p.z,dist,p.spec?.42:.75);}
}
function forecastFor(p){return SIMx.forecast(st=>SIMx.applyProposal(st,p,currentOpt),12);}
const FCROWS=[["rent","Typical rent",v=>money(v),-1],["homeless","Homeless count",v=>fmtK(v),-1],["violent","Violent crime /100k",v=>v.toFixed(0),-1],["jobs","Jobs",v=>fmtK(v),1],["units","Housing units",v=>fmtK(v),1],["congestion","Congestion level",v=>v.toFixed(1)+"%",-1],["transit","Transit riders/day",v=>fmtK(v),1],["reserve","City reserve",v=>fmt$(v),1],["approval","Your approval",v=>v.toFixed(0)+"%",1]];
function renderDetail(){
  const p=current;if(!p)return;const d=$("#detail");const c=p.cost||{};
  const kv=[];
  if(c.private)kv.push(["Private investment",fmt$(c.private)]);if(c.total)kv.push(["Total cost",fmt$(c.total)]);if(c.city!=null&&c.city>0)kv.push(["City cost",fmt$(c.city)]);if(c.grant)kv.push(["Grant share",fmt$(c.grant)]);if(c.annual)kv.push(["Operating cost",fmt$(c.annual)+"/yr"]);if(c.fee)kv.push(["Fees to city",fmt$(c.fee)]);
  if(p.units)kv.push(["New homes",p.units.toLocaleString()+(p.aff?` (${Math.round(p.aff*100)}% affordable)`:"")]);if(p.office>0)kv.push(["Office space",(p.office/1e3).toFixed(0)+"k m²"]);
  if(p.h)kv.push(["Height",p.h+" m · "+Math.round(p.h/3.7)+" floors"]);if(p.riders)kv.push(["Expected riders",p.riders.toLocaleString()+"/day"]);if(p.km)kv.push(["Length",p.km.toFixed(1)+" km"]);
  if(p.potUnits!=null&&p.type==="upzone")kv.push(["Capacity added",p.potUnits.toLocaleString()+" homes"]);if(p.eligible)kv.push(["Parcels affected",p.eligible]);
  if(p.dur)kv.push(["Timeline",p.dur+" quarter"+(p.dur>1?"s":"")]);
  const opts=p.options?`<div class="eyebrow">Choose an intervention</div>${p.options.map((o,i)=>`<label class="opt"><input type="radio" name="aiopt" value="${i}" ${i===currentOpt?"checked":""}><div><b>${esc(o.label)} · ${fmt$(o.cost)}</b><span>${esc(o.desc)}<br><i>${esc(o.evidence)}</i></span></div></label>`).join("")}`:"";
  const sup=p.support?Object.entries(p.support).filter(([,v])=>v).map(([k,v])=>`<span class="pill" style="font-size:11.5px"><span class="${v>0?"up":"dn"}">${v>0?"Supports":"Opposes"}</span> ${esc(k)}</span>`).join(" "):"";
  let fc='<p class="empty">Forecasting four years ahead…</p>';
  if(p._fc){fc=`<table class="fc"><thead><tr><th>In 4 years</th><th>If denied</th><th>If approved</th><th>Change</th></tr></thead><tbody>${FCROWS.map(([k,l,f,g])=>{const a=p._fc[k].base,b=p._fc[k].with;const dv=b-a;const rel=Math.abs(a)>1e-9?dv/Math.abs(a):0;const tiny=Math.abs(rel)<.0005&&Math.abs(dv)<.05;const cls=tiny?"neu":(dv*g>0?"up":"dn");const dtxt=tiny?"—":(k==="approval"||k==="congestion"?(dv>=0?"+":"")+dv.toFixed(1):(Math.abs(rel)<.001?(dv>=0?"+":"")+f(dv).replace("$-","−$"):pct(rel)));return `<tr><td>${l}</td><td>${f(a)}</td><td>${f(b)}</td><td class="${cls}">${dtxt}</td></tr>`;}).join("")}</tbody></table>`;}
  d.innerHTML=`<div class="hd"><div class="row" style="display:flex;justify-content:space-between;gap:8px"><span class="tag" style="color:${TYPECOL[p.type]}">${TYPELBL[p.type]}</span><button class="btn sm" type="button" data-act="close">Close</button></div><h2>${esc(p.title)}</h2><div class="meta" style="font-size:12px;color:var(--muted)">${esc(p.sponsor||"")} · ${esc(p.where||"")}${p.hood&&p.where!==p.hood?" · "+esc(p.hood):""}</div></div>
  <div class="scroll"><p style="margin:0;line-height:1.55">${esc(p.summary||"")}</p>${kv.length?`<div class="kv">${kv.map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join("")}</div>`:""}${opts}
  ${p.notes?`<p class="note">${esc(p.notes)}</p>`:""}${sup?`<div style="display:flex;gap:6px;flex-wrap:wrap">${sup}</div>`:""}
  <div class="eyebrow">Forecast · model run 12 quarters ahead</div>${fc}<p class="note">The forecast holds your current budget and policies fixed and leaves out random events. Blue on the map shows what would be built; buildings it replaces are hidden while you preview.</p></div>
  <div class="ft"><button class="btn good" type="button" data-act="yes">Approve</button><button class="btn bad" type="button" data-act="no">Deny</button>${p.x!=null?'<button class="btn" type="button" data-act="look">Show on map</button>':""}<button class="btn" type="button" data-act="later">Decide later</button></div>`;
}
$("#detail").addEventListener("click",e=>{
  const a=e.target.closest("[data-act]");if(!a||!current)return;const p=current;
  if(a.dataset.act==="close"||a.dataset.act==="later"){closeDetail();return;}
  if(a.dataset.act==="look"){preview(p);return;}
  const yes=a.dataset.act==="yes";
  if(yes&&p.type==="tower"&&p.faa){toast("The FAA will object above 152 m. The developer will trim the tower if you approve.");}
  const proj=SIMx.decide(p,yes,currentOpt,E);
  closeDetail();
  if(yes&&proj){toast(`<b>Approved:</b> ${esc(proj.title)}. Construction starts next quarter.`);}
  else toast(`Denied: ${esc(p.title)}`);
  renderAll();
});
$("#detail").addEventListener("change",e=>{const r=e.target.closest("input[name=aiopt]");if(!r||!current)return;currentOpt=+r.value;current.choice=currentOpt;current.cost={city:current.options[currentOpt].cost};preview(current);current._fc=null;renderDetail();setTimeout(()=>{if(current){current._fc=forecastFor(current);renderDetail();}},20);});

/* ---------- right panel ---------- */
function spark(key,good){const h=S.hist.map(x=>typeof key==="function"?key(x):x[key]);if(h.length<2)return "";const mn=Math.min(...h),mx=Math.max(...h),r=mx-mn||1;const pts=h.map((v,i)=>`${(i/(h.length-1)*100).toFixed(1)},${(16-(v-mn)/r*14).toFixed(1)}`).join(" ");const up=h[h.length-1]>=h[0];const colr=good===0?"var(--muted)":(up===(good>0)?"var(--good)":"var(--bad)");return `<svg viewBox="0 0 100 18" preserveAspectRatio="none"><polyline fill="none" stroke="${colr}" stroke-width="1.6" vector-effect="non-scaling-stroke" points="${pts}"/></svg>`;}
const METRICS=[
 ["pop","Population",fmtK,0],["jobs","Jobs",fmtK,1,true],["unemp","Unemployment",v=>v.toFixed(1)+"%",-1,true],["income","Median household income",moneyK,1],
 ["rent","Typical rent",money,-1,true],["homeValue","Typical home value",moneyK,0],["homeless","Homeless (count)",fmtK,-1],[x=>x.homeless*(x.unshel!=null?x.unshel:S.m.unshel),"Unsheltered",fmtK,-1],
 ["violent","Violent crime /100k",v=>v.toFixed(0),-1],["property","Property crime /100k",v=>v.toFixed(0),-1],["transit","Transit riders/day",fmtK,1,true],["carShare","Commute by car",v=>Math.round(v*100)+"%",-1],
 ["congestion","Congestion level",v=>v.toFixed(1)+"%",-1],["commute","Avg commute",v=>v.toFixed(1)+" min",-1],["units","Housing units",fmtK,1,true],["reserve","City reserve",fmt$,1]];
function renderRight(){
  $$("#right .tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.t===rightTab));
  const el=$("#rightBody"),m=S.m,h0=S.hist[0];
  if(rightTab==="metrics"){
    el.innerHTML=`<div class="eyebrow">Since you took office</div><div class="mgrid">${METRICS.map(([k,l,f,g,est])=>{const cur=typeof k==="function"?k(m):m[k],start=typeof k==="function"?k(Object.assign({},h0,{unshel:S.base.unsheltered})):h0[k];const dv=start?(cur-start)/Math.abs(start):0;const cls=Math.abs(dv)<.002?"neu":g===0?"neu":(dv*g>0?"up":"dn");
      return `<div class="mc" title="${est?"Starting value is an estimate":""}"><span>${l}${est?" ·est":""}</span><b>${f(cur)}</b><span class="d ${cls}">${Math.abs(dv)<.002?"no change":pct(dv)}</span>${spark(typeof k==="function"?x=>x.homeless*S.m.unshel:k,g)}</div>`;}).join("")}</div>
      <p class="note">${esc(GEO.cities[S.key].sources.homeless)}. Crime: ${esc(GEO.cities[S.key].sources.crime)}. Home values: ${esc(GEO.cities[S.key].sources.homeValue)}. Congestion: ${esc(GEO.cities[S.key].sources.congestion)}. Rent, jobs, unemployment and ridership starting values are estimates.</p>`;
  }else if(rightTab==="people"){
    const AC=["#60A5FA","#F59E0B","#10B981","#A78BFA"],IC=["#F87171","#FBBF24","#34D399"];
    const bar=(arr,cols)=>`<div class="stack">${arr.map((v,i)=>`<i style="width:${(v*100).toFixed(1)}%;background:${cols[i]}"></i>`).join("")}</div>`;
    el.innerHTML=`<div class="eyebrow">Age</div><div style="display:flex;flex-direction:column;gap:4px"><span class="meta" style="font-size:11px;color:var(--muted)">At inauguration</span>${bar(h0.age,AC)}<span class="meta" style="font-size:11px;color:var(--muted)">Now</span>${bar(m.age,AC)}</div><div class="legend">${SIMx.AGE.map((a,i)=>`<span><i style="background:${AC[i]}"></i>${a} ${Math.round(m.age[i]*100)}%</span>`).join("")}</div>
     <div class="eyebrow">Household income</div><div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:11px;color:var(--muted)">At inauguration</span>${bar(h0.inc,IC)}<span style="font-size:11px;color:var(--muted)">Now</span>${bar(m.inc,IC)}</div><div class="legend">${SIMx.INC.map((a,i)=>`<span><i style="background:${IC[i]}"></i>${a} ${Math.round(m.inc[i]*100)}%</span>`).join("")}</div>
     <div class="eyebrow">Approval by group</div><div class="groups">${SIMx.GROUPS.map((g,i)=>`<span>${g}</span><b class="num ${m.groups[i]>=50?"up":"dn"}">${Math.round(m.groups[i])}%</b>`).join("")}</div>
     <p class="note">Rising rents push lower-income households out and draw higher earners in. Safety, parks and family-size housing keep families; jobs and transit attract young adults.</p>`;
  }else{
    const I=S.idx,I0=S.idx0;const names=[["safety","Safety"],["afford","Rent affordability"],["homebuyer","Homebuyer appeal"],["business","Business climate"],["opportunity","Opportunity"],["livability","Livability"],["mobility","Mobility"],["sustain","Sustainability"],["fiscal","Fiscal health"],["street","Street conditions"]];
    el.innerHTML=`<div class="eyebrow">City scores (0–100)</div>${names.map(([k,l])=>`<div class="idx"><span>${l}</span><div class="bar"><i style="width:${I[k].toFixed(0)}%;background:${I[k]>=I0[k]-.5?"var(--accent)":"var(--bad)"}"></i><u style="left:${I0[k].toFixed(0)}%"></u></div><b class="num">${I[k].toFixed(0)}</b></div>`).join("")}<p class="note">The tick marks where each score stood when you took office. Scores combine the metrics: e.g. homebuyer appeal weighs price-to-income, safety, parks, price momentum and commute.</p>`;
  }
}
$("#right").addEventListener("click",e=>{const t=e.target.closest(".tabs button");if(t){rightTab=t.dataset.t;renderRight();}});
function renderAll(){renderTop();renderLeft();renderRight();if(overlayKey!=="none")applyOverlay();}

/* ---------- next quarter ---------- */
const MONTH_OF_Q=[1,4,7,10];
$("#next").onclick=async()=>{
  if(busy||!S)return;if(S.ended&&!S.extended){return;}
  busy=true;closeDetail();
  // expire old proposals
  const exp=S.inbox.filter(p=>S.q-p.q>=3);for(const p of exp){SIMx.news(`${p.sponsor} withdrew: ${p.title}`,p.where,"deny");if(p.type==="tower")S.deniedN++;}
  S.inbox=S.inbox.filter(p=>S.q-p.q<3);
  const done=[];
  SIMx.step(true,{progress:pr=>{if(E.projects.has(pr.id)){const ep=E.projects.get(pr.id);if(ep.ids)E.setProgress(pr.id,pr.prog);else if(ep.group&&pr.type!=="upzone")E.showProject(pr.id,pr.prog>=1||pr.type==="transit");}},
    done:pr=>{done.push(pr);if(pr.type==="transit"&&pr.stations)E.addToNetwork(pr.stations,pr.color);SIMx.news(`Completed: ${pr.title}`,pr.where||"","ok");},
    zone:(z,f)=>E.zoneStep(z.id,f)});
  E.setEnv({month:MONTH_OF_Q[S.q%4],wx:"clear",flood:0});
  refreshTraffic();
  renderAll();
  const ev=SIMx.rollEvent();
  if(ev)await showEvent(ev);
  const nNew=2+(Math.random()<.5?1:0);S.inbox.push(...SIMx.genProposals(E,nNew));setTimeout(autosave,0);
  renderAll();
  toast(`<b>${SIMx.qLabel()}</b> · ${nNew} new item${nNew>1?"s":""} on your desk${done.length?` · ${done.length} project${done.length>1?"s":""} completed`:""}`);
  if(S.q===16&&!S.ended)election();
  busy=false;
};
function showEvent(ev){return new Promise(res=>{
  const e=ev.e;if(e.wx)E.setEnv({wx:e.wx});if(e.flood){E.setEnv({flood:e.flood});}
  let extra="";if(e.flood){const fx=E.floodExposure(e.flood);extra=`<p class="note">In the modeled area, buildings housing about ${fmtK(fx.res)} residents and ${fmtK(fx.jobs)} jobs sit below the ${e.flood} m water line.${S.resilience?" Your resilience investments reduce the damage.":""}</p>`;}
  modal(`<div class="eyebrow">${SIMx.qLabel()} · Breaking</div><h2>${esc(e.t)}</h2><p>${esc(e.d)}</p>${extra}<div class="choices">${e.ch.map((c,i)=>{const cost=c.cost==="fed"?S.base.budget*.25*.08*.25:(c.cost||0)*S.base.budget;return `<button class="btn" type="button" data-ch="${i}"><b>${esc(c.l)}</b>${cost?` <span class="num neu">· ${fmt$(cost)}</span>`:""}</button>`;}).join("")}</div>`,
  evt=>{const b=evt.target.closest("[data-ch]");if(!b)return;SIMx.resolveEvent(ev,+b.dataset.ch);$("#modalRoot").innerHTML="";renderAll();res();});
});}
function election(){
  S.ended=true;const m=S.m,h0=S.hist[0];const won=m.approval>=50;
  const row=(l,a,b,f,g)=>{const dv=(b-a)/Math.abs(a);return `<tr><td>${l}</td><td>${f(a)}</td><td>${f(b)}</td><td class="${Math.abs(dv)<.002?"neu":dv*g>0?"up":"dn"}">${pct(dv)}</td></tr>`;};
  modal(`<div class="eyebrow">Election night · November 2030</div><h2>${won?"Re-elected.":"Voted out."} ${Math.round(m.approval)}% approval.</h2><p>${won?"Voters gave you a second term.":"Voters chose someone else."} Here is your record.</p>
  <table class="fc"><thead><tr><th></th><th>2027</th><th>2030</th><th>Change</th></tr></thead><tbody>${row("Typical rent",h0.rent,m.rent,money,-1)}${row("Homeless count",h0.homeless,m.homeless,fmtK,-1)}${row("Violent crime /100k",h0.violent,m.violent,v=>v.toFixed(0),-1)}${row("Jobs",h0.jobs,m.jobs,fmtK,1)}${row("Housing units",h0.units,m.units,fmtK,1)}${row("Congestion",h0.congestion,m.congestion,v=>v.toFixed(1)+"%",-1)}${row("Transit riders",h0.transit,m.transit,fmtK,1)}</tbody></table>
  <div style="display:flex;gap:8px;flex-wrap:wrap">${won?'<button class="btn primary" type="button" data-cont>Serve a second term</button>':""}<button class="btn" type="button" data-new>Pick a new city</button><button class="btn" type="button" data-close>Keep exploring</button></div>`,e=>{if(e.target.closest("[data-cont]")){S.extended=true;S.ended=false;$("#modalRoot").innerHTML="";}if(e.target.closest("[data-new]"))location.hash="",location.reload();});
}

/* ---------- traffic, time, overlays ---------- */
function refreshTraffic(){
  if(!S)return;const env=E.env();const t=E.traffic({hour:env.hour,carShare:S.m.carShare,cap:S.m.capMul,demandMul:S.m.congMul});E.ttiGrid=t.tti;
  const pf=E.PROF[Math.floor(env.hour)%24];E.carShare=clamp(pf*.95*(S.m.carShare/S.base.carShare)*(S.key==="nyc"?1.6:1),.04,1);
}
const fmtH=h=>{const H=Math.floor(h)%24,M=Math.floor((h-Math.floor(h))*60);return `${(H%12)||12}:${String(M).padStart(2,"0")} ${H<12?"AM":"PM"}`;};
$("#hour").oninput=e=>{const h=+e.target.value;E.setEnv({hour:h});$("#hourOut").textContent=fmtH(h);clearTimeout(e.target._t);e.target._t=setTimeout(()=>{refreshTraffic();if(overlayKey==="traffic")applyOverlay();},120);};
$("#play").onclick=()=>{playing=!playing;$("#play").textContent=playing?"❚❚":"▶";};
let acc=0,mmT=0;
E.onFrame=dt=>{
  if(playing){const env=E.env();let h=(env.hour+dt*.4)%24;E.setEnv({hour:h});$("#hour").value=h;$("#hourOut").textContent=fmtH(h);acc+=dt;if(acc>.8){acc=0;refreshTraffic();}}
  mmT+=dt;if(mmT>.25){mmT=0;const mm=$("#minimap");if(mm.style.display!=="none")E.drawMinimap(mm);}
};
$("#minimap").onclick=e=>{const r=e.target.getBoundingClientRect();E.minimapClick((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);};
$("#home").onclick=()=>E.home();
$("#lbls").onchange=e=>{E.labelsOn.street=E.labelsOn.hood=E.labelsOn.lm=e.target.checked;};
const VIEWS=[["real","Realistic"],["clay","Clay"],["use","Land use"],["height","Height"]];
$("#viewSeg").innerHTML=VIEWS.map(([k,l])=>`<button type="button" data-k="${k}" aria-pressed="${k==="real"}">${l}</button>`).join("");
$("#viewSeg").onclick=e=>{const b=e.target.closest("button");if(!b)return;E.setView(b.dataset.k);$$("#viewSeg button").forEach(x=>x.setAttribute("aria-pressed",x===b));E.setEnv({});};
const OVL=[["none","Data layer: off"],["traffic","Traffic delay"],["crime","Crime (modeled)"],["homeless","Street homelessness (modeled)"],["rent","Rent level (modeled)"],["jobs","Job density"],["people","Population density"],["flood","Flood risk (low ground)"],["transit","Rail lines + areas without rail"]];
$("#overlay").innerHTML=OVL.map(([k,l])=>`<option value="${k}">${l}</option>`).join("");
$("#overlay").onchange=e=>{overlayKey=e.target.value;E.setTrafficView(overlayKey==="traffic");E.setTransitView(overlayKey==="transit");applyOverlay();};
const RAMP={heat:t=>[Math.round(255-75*t),Math.round(215-195*t),Math.round(80-60*t),.45+.45*t],cool:t=>[Math.round(150-130*t),Math.round(210-130*t),Math.round(255-60*t),.45+.45*t],violet:t=>[Math.round(200-110*t),Math.round(160-140*t),Math.round(250-60*t),.45+.45*t],flood:t=>[30,110,220,t>0?.75:0],traffic:t=>t<.5?[Math.round(40+430*t),190,80,.55]:[235,Math.round(190-300*(t-.5)),60,.7]};
function applyOverlay(){
  if(!S||overlayKey==="none"){E.setOverlay(null);return;}
  const cl=E.cells(),n=E.CG*E.CG,v=new Float32Array(n);const area=(E.CPX*E.CPX)/1e6;
  let mx=0;const norm=()=>{for(let k=0;k<n;k++)mx=Math.max(mx,v[k]);for(let k=0;k<n;k++)v[k]=mx?v[k]/mx:0;};
  if(overlayKey==="traffic"){const env=E.env();const t=E.traffic({hour:env.hour,carShare:S.m.carShare,cap:S.m.capMul});for(let k=0;k<n;k++)v[k]=cl.street[k]+cl.hwy[k]>3?clamp((t.tti[k]-1)/1.5,0,1):NaN;E.setOverlay(v,RAMP.traffic);return;}
  if(overlayKey==="jobs"){for(let k=0;k<n;k++)v[k]=Math.sqrt(cl.jobs[k]/area);E.setOverlay(v,RAMP.violet,{rank:1});return;}
  if(overlayKey==="people"){for(let k=0;k<n;k++)v[k]=Math.sqrt(cl.res[k]/area);E.setOverlay(v,RAMP.cool,{rank:1});return;}
  if(overlayKey==="crime"){const f=S.m.violent/S.base.violent;for(let k=0;k<n;k++)v[k]=Math.pow(cl.jobs[k]*.55+cl.res[k]*.45+1,.55)*(1+cl.street[k]/400)*(1-cl.park[k]*.3);E.setOverlay(v,RAMP.heat,{rank:1,scale:clamp(f,.4,1.6)});return;}
  if(overlayKey==="homeless"){const f=(S.m.homeless*S.m.unshel)/(S.base.homeless*S.base.unsheltered);for(let k=0;k<n;k++)v[k]=Math.pow(cl.core[k]+5,1.1)*(cl.hwy[k]>0?1.4:1)*Math.pow(cl.jobs[k]+cl.res[k]+1,.25);E.setOverlay(v,RAMP.heat,{rank:1,scale:clamp(f*.9,.4,1.6)});return;}
  if(overlayKey==="rent"){for(let k=0;k<n;k++)v[k]=.35+cl.core[k]/250+cl.park[k]*.1;E.setOverlay(v,RAMP.violet,{rank:1});return;}
  if(overlayKey==="transit"){const cov=E.transitCover();for(let k=0;k<n;k++)v[k]=cov&&cov[k]?NaN:Math.sqrt((cl.res[k]+cl.jobs[k])/area);E.setOverlay(v,RAMP.heat,{rank:1});return;}
  if(overlayKey==="flood"){for(let k=0;k<n;k++){const e=E.elevAt(cl.x[k],cl.z[k]);v[k]=cl.land[k]>.1&&e<3.2?1:NaN;}E.setOverlay(v,RAMP.flood);return;}
}

/* ---------- model check ---------- */
$("#btnCheck").onclick=()=>{
  const V=E.validate();const st=E.stats();
  const rows=V.rows.map(r=>{const err=r.real?(r.model-r.real)/r.real:0;const ok=Math.abs(err)<.25;return `<tr><td>${esc(r.k)}<br><span style="font-size:10.5px;color:var(--muted)">${esc(r.src)}${r.note?" · "+esc(r.note):""}</span></td><td>${typeof r.model==="number"?r.model.toLocaleString():r.model}${r.unit||""}</td><td>${r.real.toLocaleString()}${r.unit||""}</td><td class="${ok?"up":"dn"}">${pct(err,0)}</td></tr>`;}).join("");
  modal(`<div class="eyebrow">Model check · ${esc(V.city)}</div><h2>How close is the simulation to the real city?</h2>
  <table class="fc"><thead><tr><th>Measure</th><th>Model</th><th>Real</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="note">Calibrated once on Seattle and then held fixed for every city: floor area per job (25 m²) and per resident (87 m², including retail, parking and common space), and road capacity per lane. Height profiles were tuned per city to its skyline. Everything else above is an out-of-sample test. ${E.osmMode&&E.heightCheck?`Buildings are real OpenStreetMap footprints; ${Math.round(E.heightCheck.known/E.heightCheck.total*100)}% have a real height or floor count, the rest are estimated (median error ${Math.round(E.heightCheck.median*100)}% on buildings where the real height is known). `:""}Model area: ${st.buildings.toLocaleString()} buildings, ${st.blocks.toLocaleString()} blocks, ${st.trees.toLocaleString()} trees.</p>
  <p class="note">Policy effects use published estimates: police elasticity of violent crime −0.3 (Chalfin & McCrary); street lighting −36% nighttime outdoor crime (NYC RCT); vacant-lot greening −29% gun violence (Philadelphia RCT); homelessness rising with rent burden (Glynn & Fox; Colburn & Aldern); transit ridership +0.45% per 1% service; rent responding to vacancy. Results are directional, not predictions.</p>
  <div><button class="btn primary" type="button" data-close>Close</button></div>`);
};

/* ---------- mobile toggles ---------- */
const narrow=()=>innerWidth<=860;
function panelSync(){$("#tgL").classList.toggle("on",$("#left").classList.contains("open"));$("#tgR").classList.toggle("on",$("#right").classList.contains("open"));const d=$("#deskN"),d2=$("#deskN2");if(d&&d2){d2.textContent=d.textContent;d2.style.display=d.textContent&&d.textContent!=="0"?"":"none";}}
function togglePanel(id){const el=$(id),other=id==="#left"?"#right":"#left";el.classList.toggle("open");if(narrow())$(other).classList.remove("open");panelSync();}
$("#tgL").onclick=()=>togglePanel("#left");$("#zIn").onclick=()=>E.zoomBy(.6);$("#zOut").onclick=()=>E.zoomBy(1/.6);$("#tgR").onclick=()=>togglePanel("#right");

setInterval(panelSync,800);

/* ---------- boot ---------- */
E.init($("#c"));E.setLabelLayer($("#labels"));buildStart();
window.addEventListener("keydown",e=>{if(e.key!=="Escape"||!S)return;
  if($("#modalRoot").innerHTML){if($("#pauseMenu")||$("#modalRoot [data-close]"))$("#modalRoot").innerHTML="";return;}
  if(placeMode){placeMode=null;drawPts=null;E.clearPreview();$("#placeHint").classList.add("hidden");return;}
  if(!$("#detail").classList.contains("hidden")){closeDetail();return;}
  if($("#left").classList.contains("open")||$("#right").classList.contains("open")){$("#left").classList.remove("open");$("#right").classList.remove("open");panelSync();return;}
  pauseMenu();});
function pauseMenu(){const C=GEO.cities[S.key];
  modal(`<div id="pauseMenu"><div class="eyebrow">Paused · ${esc(C.name)} · ${qLabel(S.q)}</div><h2>Menu</h2>
  <div class="menuBtns"><button class="btn primary" type="button" data-close>Resume</button><button class="btn" type="button" data-save>Save game</button>
  <button class="btn" type="button" data-savequit>Save and exit to main menu</button><button class="btn" type="button" data-quit>Exit without saving</button></div>
  <p class="muted" style="font-size:12px;margin-top:10px">The game also autosaves every quarter. Saves live in this browser.</p></div>`,ev=>{
    if(ev.target.closest("[data-save]")){if(saveGame("save-"+Date.now()))toast("Game saved.");$("#modalRoot").innerHTML="";}
    if(ev.target.closest("[data-savequit]")){if(saveGame("save-"+Date.now()))location.reload();}
    if(ev.target.closest("[data-quit]")){autosaveOff=true;location.reload();}});}
let autosaveOff=false;
$("#menuBtn").onclick=()=>{if(S)pauseMenu();};
function renderSaves(){const box=$("#saves");if(!box)return;const list=readSaves();
  if(!list.length){box.innerHTML="";return;}
  box.innerHTML=`<div class="eyebrow" style="color:#9CB8FF;margin:4px 0 8px">Continue</div><div class="saveList">${list.map((x,i)=>`<div class="saveRow"><button class="btn" type="button" data-load="${i}"><b>${esc(GEO.cities[x.key].name)}</b> · ${x.label} · ${x.approval}% approval<span>${x.slot.startsWith("auto")?"Autosave":"Saved"} ${new Date(x.at).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</span></button><button class="btn ico" type="button" data-del="${i}" aria-label="Delete save" title="Delete save">×</button></div>`).join("")}</div>`;
  box.onclick=e=>{const l=e.target.closest("[data-load]"),d=e.target.closest("[data-del]");
    if(l)loadSave(list[+l.dataset.load]);
    if(d){const n=list.slice();n.splice(+d.dataset.del,1);writeSaves(n);renderSaves();}};}
renderSaves();
window.GAME={startGame,state:()=>S};
})();
