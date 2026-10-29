/* Gridline mayor simulation: quarterly city model, policies, proposals, events, forecasting.
   Effect sizes come from published research where noted; everything else is a transparent model assumption. */
(function(){
"use strict";
const SIM={};window.SIM=SIM;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const clone=o=>JSON.parse(JSON.stringify(o));
const fmt$=b=>b>=1?"$"+b.toFixed(b>=10?0:1)+"B":"$"+Math.round(b*1000)+"M";
SIM.fmt$=fmt$;

/* city-specific cost and policy parameters */
const CITYP={
 nyc:{build:.0022,renters:.67,hhSize:2.4,unitCost:.55,brt:.05,rail:1.6,railName:"subway extension",railKind:"subway",inclusion:.25,buildCost:5200,policeShare:.05,homeShare:.04,transitShare:.03,feeUnit:.02,officerCost:.00016,pricing:true,firstQ:0},
 chi:{build:.0015,renters:.55,hhSize:2.3,unitCost:.42,brt:.03,rail:.6,railName:"'L' extension",railKind:"rail",inclusion:.2,buildCost:3400,policeShare:.12,homeShare:.025,transitShare:.03,feeUnit:.012,officerCost:.00014},
 sf:{build:.0015,renters:.62,hhSize:2.3,unitCost:.75,brt:.04,rail:.45,railName:"Muni Metro extension",railKind:"rail",inclusion:.2,buildCost:5600,policeShare:.05,homeShare:.06,transitShare:.07,feeUnit:.03,officerCost:.0002},
 sea:{build:.0028,renters:.55,hhSize:2.1,unitCost:.5,brt:.03,rail:.35,railName:"Link light rail spur",railKind:"rail",inclusion:.1,buildCost:4200,policeShare:.045,homeShare:.05,transitShare:.03,feeUnit:.02,officerCost:.00018},
 sd:{build:.0025,renters:.53,hhSize:2.6,unitCost:.55,brt:.025,rail:.15,railName:"Trolley extension",railKind:"rail",inclusion:.1,buildCost:3800,policeShare:.1,homeShare:.03,transitShare:.02,feeUnit:.015,officerCost:.00016}
};
SIM.CITYP=CITYP;
const GROUPS=["Renters","Homeowners","Businesses","Young adults","Seniors","Families"];
const AGE=["Under 18","18–34","35–64","65+"],INC=["Under $50k","$50–150k","Over $150k"];
SIM.AGE=AGE;SIM.INC=INC;SIM.GROUPS=GROUPS;

/* ---------- state ---------- */
let S=null; SIM.state=()=>S; SIM.load=o=>{S=o;return S;};
SIM.start=function(key,mayorName){
  const C=GEO.cities[key],b=Object.assign({},C.baseline),cp=CITYP[key];
  b.units=b.pop/cp.hhSize/(1-b.vacancy);b.hh=b.pop/cp.hhSize;
  S={key,mayor:mayorName||"Mayor",q:0,year0:2027,seed:C.seed*7+3,base:b,cp,
    pol:{police:1,homeless:1,transit:1,parks:1,youth:1,propTax:0,bizTax:0,rentAssist:0,vio:0,crisis:0},
    m:{chronic:b.homeless*.3,trans:b.homeless*.7,pop:b.pop,jobs:b.jobs,unemp:b.unemp,income:b.hhIncome,rent:b.rent,homeValue:b.homeValue,units:b.units,hh:b.hh,vacancy:b.vacancy,homeless:b.homeless,unshel:b.unsheltered,violent:b.violent,property:b.property,police:b.police,transit:b.transit,carShare:b.carShare,congestion:b.congestion,commute:b.commute,reserve:b.budget*.08,approval:54,age:b.age.slice(),inc:b.income.slice(),parkScore:0,lightV:0,lightP:0,capMul:1,congMul:cp.pricing?.97:1,carMul:1,railDone:0,hfStock:0,shelter:0,price:1,trend:1,affordable:0,revenue:b.budget,spend:b.budget,debt:0},
    projects:[],zones:[],inbox:[],news:[],hist:[],shocks:[],eventLog:[],nextId:1,decided:0,approvedN:0,deniedN:0,ended:false};
  S.m.groups=GROUPS.map(()=>54);
  computeIndices(S);S.idx0=Object.assign({},S.idx);
  S.hist.push(snap(S));
  return S;
};
function snap(st){const m=st.m;return {q:st.q,pop:m.pop,jobs:m.jobs,unemp:m.unemp,income:m.income,rent:m.rent,homeValue:m.homeValue,homeless:m.homeless,violent:m.violent,property:m.property,transit:m.transit,congestion:m.congestion,commute:m.commute,approval:m.approval,reserve:m.reserve,units:m.units,age:m.age.slice(),inc:m.inc.slice(),idx:Object.assign({},st.idx),carShare:m.carShare,revenue:m.revenue,spend:m.spend};}
SIM.qLabel=q=>{q=q==null?S.q:q;return "Q"+(q%4+1)+" "+(S.year0+Math.floor(q/4));};

/* ---------- indices (0–100) ---------- */
function computeIndices(st){
  const m=st.m,b=st.base,p=st.pol;
  const safety=100*Math.exp(-(m.violent/500)*.7-(m.property/4000)*.3);
  const burden=m.rent*12/m.income;const afford=100*clamp(1-(burden-.15)/.45,0,1);
  const pti=m.homeValue/m.income;const buyAff=100*clamp(1-(pti-3)/9,0,1);
  const mob=clamp(100-m.congestion*1.1+(m.transit/(m.pop+m.jobs)*100)*.8,0,100);
  const parks=clamp(55+m.parkScore*3+(p.parks-1)*25,0,100);
  const street=clamp(100-(m.homeless*m.unshel/m.pop)*1e4*1.4,0,100);
  const opp=clamp(.45*(100-m.unemp*9)+.3*clamp(m.jobs/m.pop*100,0,100)+.25*mob,0,100);
  const talent=clamp((m.age[1]*100-15)*2.2+m.inc[2]*100,0,100);
  const tax=clamp(60-p.bizTax*150-p.propTax*80,0,100);
  const business=clamp(.28*talent+.18*tax+.2*safety+.14*mob+.1*opp+.1*clamp(50+(st.approvedN-st.deniedN)*4,0,100),0,100);
  const homebuyer=clamp(.35*buyAff+.25*safety+.15*parks+.1*clamp(50+(m.homeValue/b.homeValue/m.price-1)*300,0,100)+.15*(100-m.commute),0,100);
  const livability=clamp(.25*parks+.22*(100-m.congestion)+.25*safety+.18*street+.1*(100-m.commute),0,100);
  const sustain=clamp(100-m.carShare*75+m.parkScore*2+(m.transit/b.transit-1)*40,0,100);
  const fiscal=clamp(50+(m.reserve/(m.spend||b.budget))*350-(m.debt/(b.budget))*60,0,100);
  st.idx={safety,afford,homebuyer,business,opportunity:opp,livability,mobility:mob,sustain,fiscal,street,parks};
}

/* ---------- quarterly step ---------- */
function shock(st,k){let v=k.endsWith("Mul")?1:0;for(const s of st.shocks)if(s.k===k)v=k.endsWith("Mul")?v*s.v:v+s.v;return v;}
function step(st,live,hooks){
  hooks=hooks||{};const m=st.m,b=st.base,p=st.pol,cp=st.cp;const prev=Object.assign({},m);
  st.q++;m.price*=1.0065;
  let newUnits=0,newOffice=0,newRiders=0,hfPlaced=0,affordable=0,capex=0;
  // projects
  for(const pr of st.projects){
    if(pr.status!=="active")continue;
    pr.prog=Math.min(1,pr.prog+1/pr.dur);
    if(live&&hooks.progress)hooks.progress(pr);
    if(pr.prog>=1){pr.status="done";
      newUnits+=pr.units||0;affordable+=(pr.units||0)*(pr.aff||0);newOffice+=pr.office||0;newRiders+=pr.riders||0;
      if(pr.capMul)m.capMul*=pr.capMul;if(pr.congMul)m.congMul*=pr.congMul;if(pr.carMul)m.carMul*=pr.carMul;
      if(pr.park)m.parkScore+=pr.park;if(pr.lightV){m.lightV=1-(1-m.lightV)*(1-pr.lightV);m.lightP=1-(1-m.lightP)*(1-pr.lightP);}
      if(pr.hf){m.hfStock+=pr.hf;hfPlaced+=pr.hf*.9;}if(pr.shelter)m.shelter+=pr.shelter;if(pr.rail)m.railDone++;
      if(pr.annual)pr.opsOn=true;
      if(live&&hooks.done)hooks.done(pr);
    }
  }
  // market strength drives redevelopment of rezoned areas
  const market=clamp(Math.pow(m.rent/(b.rent*m.price),1.2)*Math.pow(m.homeValue/(b.homeValue*m.price),.5)*(1+shock(st,"rate")),.25,1.8);
  for(const z of st.zones){if(z.left<=0)continue;const f=clamp(.04*market,0,.12);let d;
    if(live&&hooks.zone)d=hooks.zone(z,f);else d={dUnits:z.potUnits*f,dOffice:z.potOffice*f};
    z.left-=f;newUnits+=d.dUnits;newOffice+=d.dOffice;affordable+=d.dUnits*(z.aff||0);z.built=(z.built||0)+d.dUnits;}
  m.units+=newUnits+m.units*(cp.build||.002);m.affordable+=affordable;
  // jobs
  const bus0=st.idx0.business;
  let gJ=b.jobGrowth+.0002*(st.idx.business-bus0)+shock(st,"jobs");
  m.jobs*=1+gJ;m.jobs+=newOffice/28*.4;
  // population & housing market
  const vacPrev=m.vacancy;
  let mig=.35*gJ+.0015*((st.idx.livability-st.idx0.livability)/10)+.002*((st.idx.afford-st.idx0.afford)/10)+shock(st,"pop");
  if(vacPrev<.025)mig=Math.min(mig,mig*(vacPrev/.025));
  m.pop*=1+.0006+mig;m.hh=m.pop/cp.hhSize;
  m.vacancy=clamp(1-m.hh/m.units,.004,.2);
  const gR=b.rentTrend+.3*(b.vacancy-m.vacancy)+.15*gJ+shock(st,"rent");
  m.rent*=1+gR;
  const gV=.75*gR+.15*(st.idx.safety-st.idx0.safety)/100+shock(st,"rate")*.5+m.parkScore*.0004+(p.propTax?-p.propTax*.004:0);
  m.homeValue*=1+gV;
  // unemployment & income
  m.unemp=clamp(b.unemp+30*(Math.log(m.pop/b.pop)-Math.log(m.jobs/b.jobs))+shock(st,"unemp"),2,16);
  m.income*=1+.0065+.25*gJ-.0008*(m.unemp-prev.unemp)*10+(m.inc[2]-prev.inc[2])*.6;
  // homelessness (stock-flow; ~30% quarterly turnover)
  const burdenR=(m.rent/m.income)/(b.rent/b.hhIncome);
  const prevent=1-Math.min(.25,.07*p.rentAssist);
  // two pools: short-term homelessness turns over fast; chronic homelessness rarely ends without supportive housing
  const pressure=Math.pow(burdenR,2)*(1+.04*(m.unemp-b.unemp))*prevent*shock(st,"homelessMul");
  const svc=Math.pow(p.homeless,.3);
  const inT=.28*b.homeless*pressure,inC=.012*b.homeless*pressure;
  m.trans=Math.max(0,m.trans+inT-.4*svc*m.trans-shock(st,"housed"));
  m.chronic=Math.max(0,m.chronic+inC-.04*svc*m.chronic-hfPlaced);
  m.homeless=m.trans+m.chronic;
  m.unshel=clamp(b.unsheltered*Math.pow(p.homeless,-.45)*(1-Math.min(.8,m.shelter/Math.max(1,b.homeless*b.unsheltered))),.02,.9);
  // police & crime
  const tgt=b.police*p.police;m.police+=clamp((tgt-m.police)*.25,-b.police*.03,b.police*.025);
  m.trend*=.9945;
  const polE=Math.pow(m.police/b.police,-.3)*(p.crisis?1-.03*p.crisis:1);
  const vio=[1,.96,.93,.91][p.vio]||1;const youth=1-clamp((p.youth-1)*.08,-.05,.06);
  const econ=1+.022*(m.unemp-b.unemp);
  m.violent=b.violent*m.trend*polE*econ*vio*youth*(1-m.lightV)*(1-m.parkScore*.002)*shock(st,"violentMul");
  m.property=b.property*m.trend*Math.pow(polE,.8)*(1+.03*(m.unemp-b.unemp))*(p.crisis?1-.03*p.crisis:1)*(1-m.lightP)*(1-(p.parks-1)*.03)*shock(st,"propertyMul");
  // transit, mode share, congestion
  m.transit=(b.transit*Math.pow(p.transit,.45)*Math.pow(m.jobs/b.jobs,.7)*Math.pow(m.pop/b.pop,.3)+newRiders+(prev.extraRiders||0)+(st.freqRiders||0))*Math.pow(m.violent/b.violent,-.06)*shock(st,"transitMul");
  m.extraRiders=(prev.extraRiders||0)+newRiders;
  const act=(m.pop+m.jobs)/(b.pop+b.jobs);
  m.carShare=clamp(1-(1-b.carShare)*(m.transit/b.transit)/act,.04,.96)*m.carMul;
  const demand=act*(m.carShare/b.carShare);
  m.congestion=clamp(b.congestion*Math.pow(demand/m.capMul,1.6)*m.congMul*shock(st,"congMul"),3,95);
  m.commute=b.commute*(1+b.carShare*((1+m.congestion/100)/(1+b.congestion/100)-1))*(1-.012*m.railDone)*Math.pow(p.transit,-.05);
  // budget ($B / year, nominal)
  const B0=b.budget,inf=m.price*Math.pow(1.0025,st.q); // costs outpace inflation (wages, pensions)
  const propRev=B0*b.taxBase*Math.pow(m.homeValue/b.homeValue,.6)*(m.units/b.units)*(1+p.propTax);
  const bizRev=B0*.42*(m.jobs/b.jobs)*Math.pow(m.income/b.hhIncome,.6)*(1+p.bizTax*.85);
  const other=B0*(1-b.taxBase-.42)*inf*shock(st,"fedMul")+shock(st,"revenue");
  m.revenue=propRev+bizRev+other;
  const dep=B0*(cp.policeShare*(m.police/b.police)+cp.homeShare*p.homeless+cp.transitShare*p.transit+.015*p.parks+.03*p.youth)*inf+(st.freqCost||0)*inf;
  const fixed=B0*(1-cp.policeShare-cp.homeShare-cp.transitShare-.015-.03)*inf;
  const prog=B0*(.0012*p.rentAssist+.0008*[0,1,1.8,2.5][p.vio]+.001*p.crisis)*inf;
  let ops=0,debtSvc=0;for(const pr of st.projects){if(pr.status==="done"&&pr.annual)ops+=pr.annual;if(pr.bond&&pr.status!=="cancelled")debtSvc+=pr.bond*.07;}
  m.debt=st.projects.reduce((s,pr)=>s+(pr.bond&&pr.status!=="cancelled"?pr.bond:0),0);
  m.spend=dep+fixed+prog+ops+debtSvc+shock(st,"cost");
  m.reserve+=(m.revenue-m.spend)/4;
  // demographics
  const realRent=gR-.0065;
  const dLow=-.18*realRent-.04*gV+.3*(affordable/Math.max(1,m.units));const dHigh=.25*gJ+.12*realRent;
  m.inc=[m.inc[0]+dLow,m.inc[1],m.inc[2]+dHigh];m.inc[1]=1-m.inc[0]-m.inc[2];m.inc=m.inc.map(x=>clamp(x,.05,.9));{const s=m.inc.reduce((a,c)=>a+c);m.inc=m.inc.map(x=>x/s);}
  const dY=.15*gJ-.12*realRent+.0002*(p.transit-1)*10,dK=.0004*((st.idx.safety-st.idx0.safety)/10)+.0002*m.parkScore-.08*realRent+.0002*(p.youth-1)*10,dS=.0005-.04*realRent;
  m.age=[m.age[0]+dK,m.age[1]+dY,m.age[2],m.age[3]+dS];m.age[2]=1-m.age[0]-m.age[1]-m.age[3];{const s=m.age.reduce((a,c)=>a+c);m.age=m.age.map(x=>clamp(x/s,.03,.9));}
  computeIndices(st);
  // approval by group
  const realR=m.rent/b.rent/(m.income/b.hhIncome)-1,dHome=m.homeless/b.homeless-1,dV=m.violent/b.violent-1,dJ=m.jobs/b.jobs-1,dC=(m.congestion-b.congestion)/10,dHV=m.homeValue/b.homeValue/m.price-1,dT=m.transit/b.transit-1,pk=m.parkScore/10;
  const sat=[
    -2.5*realR-.8*dHome-1.2*dV+.6*dT+.3*pk,
    1.2*dHV-4*p.propTax-1.5*dV-.25*dC-.4*dHome,
    3*dJ-2*p.bizTax-1*dV-.3*dC+.02*(st.approvedN-st.deniedN),
    -2*realR+1.5*dJ+.8*dT-.6*dV+.2*pk,
    -2*dV-2*p.propTax+.3*pk-.3*dHome,
    -1.5*dV-1.2*realR+.6*pk+.4*(p.youth-1)];
  const evt=shock(st,"approval");const deficit=m.reserve<0?-6:0;const honey=Math.max(0,6-st.q*.8)-.35*Math.max(0,st.q-4);
  const w=[cp.renters,1-cp.renters,.25,.3,.18,.25];let tot=0,ws=0;
  m.groups=sat.map((s,i)=>{const v=clamp(50+40*Math.tanh(1.6*s)+evt+deficit+honey,3,97);tot+=v*w[i];ws+=w[i];return (prev.groups?prev.groups[i]*.6:50*.6)+v*.4;});
  m.approval=clamp(.65*prev.approval+.35*(tot/ws),3,97);
  // expire shocks
  st.shocks.forEach(s=>s.q--);st.shocks=st.shocks.filter(s=>s.q>0);
  st.hist.push(snap(st));
}
SIM.step=(live,hooks)=>step(S,live,hooks);

/* ---------- forecasting: run the model forward with and without a decision ---------- */
SIM.forecast=function(apply,quarters){
  quarters=quarters||12;const keys=["rent","homeless","violent","jobs","congestion","transit","units","reserve","approval","homeValue","commute","unemp"];
  const run=(withIt)=>{const st=clone(S);st.hist=[];st.inbox=[];st.news=[];st.shocks=st.shocks.filter(s=>true);if(withIt)apply(st);for(let i=0;i<quarters;i++)step(st,false);return st;};
  const a=run(false),b=run(true);const out={};for(const k of keys)out[k]={base:a.m[k],with:b.m[k]};out.idx={base:a.idx,with:b.idx};return out;
};

/* ---------- proposals ---------- */
function pid(){return S.nextId++;}
const DEVS=["Harborline Partners","Meridian Development","Northgate Capital","Bluestone Realty","Civic Square Builders","Lantern Properties","Arbor & Main"];
const NONPROFITS=["Common Ground Housing","Bridgeway Supportive Housing","Second Home Alliance","Open Door Communities"];
SIM.genProposals=function(eng,n){
  const r=rng(S.seed+S.q*101);const out=[];const types=[];
  const pool=["tower","tower","upzone","ai","transit","park","housing","safety","tower","conversion"];
  for(let i=0;i<n;i++)types.push(pool[Math.floor(r()*pool.length)]);
  if(S.q===0){types.length=0;types.push("tower","ai","housing");}
  for(const t of types){const p=makeProposal(t,eng,r);if(p)out.push(p);}
  if(S.q>0&&S.q%4===1)out.push(makeGrant(r));
  return out;
};
function makeProposal(t,eng,r){
  const C=GEO.cities[S.key],cp=S.cp,b=S.base;
  if(t==="tower"){
    const site=eng.findSites(1,{minCore:40,rng:r})[0];if(!site)return null;
    const TALL={nyc:420,chi:330,sf:260,sea:230,sd:175}[S.key];let h=Math.round(Math.min(site.hm*(.9+r()*.8),TALL)/5)*5;h=Math.max(h,60);
    const use=r()<.45&&site.hm>120?"o":r()<.55?"r":"m";
    const spec=eng.towerSpec(site,h,use,r()<.75);
    const floors=Math.round(h/3.7),gfa=spec.w*spec.d*floors*.82+spec.w*spec.d*1.8*Math.round(spec.pod/4.5)*.82;
    const resShare=use==="r"?1:use==="m"?.5:0;const units=Math.round(gfa*resShare/95),office=Math.round(gfa*(1-resShare));
    const aff=units?cp.inclusion:0;const cost=gfa*cp.buildCost/1e9;
    const fee=(units*cp.feeUnit+office/1e6*80)/1e3*1e3/1000;
    const faa=S.key==="sd"&&h>150;
    return {id:pid(),type:"tower",title:`${floors}-story ${use==="o"?"office":use==="r"?"residential":"mixed-use"} tower`,sponsor:DEVS[Math.floor(r()*DEVS.length)],where:site.street||site.hood,hood:site.hood,x:site.x,z:site.z,spec,h,units,office,aff,
      cost:{private:cost,city:0,fee:Math.max(.002,units*cp.feeUnit/1000+office*cp.feeUnit/90000)},dur:Math.round(6+h/90),
      summary:`${fmt$(cost)} private development in ${site.hood}. ${units?units.toLocaleString()+" homes ("+Math.round(aff*100)+"% income-restricted)":""}${units&&office?" and ":""}${office?(office/1e3).toFixed(0)+"k m² of offices":""}. Replaces low-rise buildings on the block.`,
      faa,notes:faa?"The FAA caps heights near San Diego International Airport around 152 m (500 ft). This design exceeds it and will likely be blocked unless trimmed.":null,
      support:{"Construction unions":+1,"Neighborhood association":h>site.existingMax*2.5?-1:0,"Housing advocates":units?+1:0},q:S.q};
  }
  if(t==="upzone"){
    const site=eng.findSites(1,{minCore:12,rng:r})[0];if(!site)return null;
    const kind=r()<.78?"housing":"office";const rad=Math.round((250+r()*180)/10)*10;const stories=kind==="housing"?Math.round(7+r()*9):0;
    const z={x:site.x,z:site.z,r:rad,kind,stories};const pv=eng.previewZone(z);eng.clearPreview();
    const pot=pv.dGfa;const potUnits=kind==="housing"?pot/95:pot*.3/95,potOffice=kind==="office"?pot*.7:0;
    return {id:pid(),type:"upzone",title:kind==="housing"?`Upzone ${site.hood} for ${stories}-story housing`:`Commercial upzoning in ${site.hood}`,sponsor:"City Council member",where:site.street||site.hood,hood:site.hood,x:site.x,z:site.z,zone:z,potUnits:Math.round(potUnits),potOffice:Math.round(potOffice),eligible:pv.count,aff:kind==="housing"?cp.inclusion*.8:0,
      cost:{city:.002},dur:2,summary:`Raises height limits on ${pv.count} parcels within ${rad} m. Full build-out could add about ${Math.round(potUnits).toLocaleString()} homes${potOffice?` and ${(potOffice/1e3).toFixed(0)}k m² of offices`:""}; typically 25–40% of capacity gets built within a decade, faster when rents are high.`,
      support:{"Housing advocates":kind==="housing"?+1:0,"Neighborhood association":-1,"Business groups":kind==="office"?+1:0},q:S.q};
  }
  if(t==="transit"){
    if(eng.transit&&r()<.6){const np=SIM.networkProposal(eng,r);if(np)return np;}
    const paths=eng.namedPaths().filter(p=>!p.hwy&&p.len>1800);if(!paths.length)return null;
    const scored=paths.map(p=>{const s=eng.pathStats(p.pts,{spacing:800});return Object.assign(p,{st:s,score:(s.res+s.jobs*1.4)/Math.max(1,s.len/1000)*s.tti});}).sort((a,b)=>b.score-a.score);
    const pick=scored[Math.floor(r()*Math.min(3,scored.length))];const km=pick.len/1000;
    const rail=r()<.45;const kind=rail?cp.railKind:"brt";const costKm=rail?cp.rail:cp.brt;const capital=costKm*km;
    const riders=Math.round((pick.st.res*.07+pick.st.jobs*.1)*(rail?1.25:.5)*2);
    const grant=rail?.45:.4;
    return {id:pid(),type:"transit",title:rail?`${C.name} ${cp.railName} along ${pick.name}`:`Bus rapid transit on ${pick.name}`,sponsor:rail?"Regional transit agency":"Department of Transportation",where:pick.name,hood:eng.hoodAt(pick.pts[1][0],pick.pts[1][1]),x:pick.pts[1][0],z:pick.pts[1][1],pts:pick.pts,kind,km,riders,
      cost:{city:capital*(1-grant),grant:capital*grant,total:capital,annual:capital*(rail?.012:.04)},dur:rail?(kind==="subway"?28:16):5,
      summary:`${km.toFixed(1)} km ${rail?"rail line":"of dedicated bus lanes and level-boarding stations"} serving ${Math.round((pick.st.res+pick.st.jobs)/1000)}k residents and jobs within 800 m. Expected ${riders.toLocaleString()} weekday riders. Total ${fmt$(capital)}, with ${Math.round(grant*100)}% assumed from federal capital grants.`,
      notes:rail?"US rail projects have cost $150M–$2.5B per km; NYC's Second Ave Subway is among the most expensive in the world.":"Comparable BRT corridors have cut bus travel times 15–25%.",
      support:{"Transit riders":+1,"Drivers":-1,"Business groups":rail?+1:0},q:S.q};
  }
  if(t==="ai"){
    const tr=eng.traffic({hour:8,carShare:S.m.carShare});
    const paths=eng.namedPaths().filter(p=>p.len>1500);if(!paths.length)return null;
    const sc=paths.map(p=>{const s=eng.pathStats(p.pts,{tr,spacing:800});return Object.assign(p,{st:s});}).sort((a,b)=>b.st.tti-a.st.tti);
    const hot=sc[0];const km=hot.len/1000;
    const cap=new Float32Array(eng.CG*eng.CG).fill(1);for(const c of hot.st.cells)cap[c]=1.14;
    const tr2=eng.traffic({hour:8,carShare:S.m.carShare,capMul:cap});let before=0,after=0;for(const c of hot.st.cells){before+=tr.tti[c];after+=tr2.tti[c];}before/=hot.st.cells.length;after/=hot.st.cells.length;
    const opts=[
      {k:"signals",label:"Adaptive signal timing",cost:.0018*km+.002,dur:1,capMul:1+.012*km/5,desc:`Retime ${Math.round(km*8)} signals with real-time detection. Model: rush-hour delay on ${hot.name} ${before.toFixed(2)}× → ${after.toFixed(2)}×.`,evidence:"Adaptive signal control has cut corridor travel times 10–25% in US deployments (FHWA)."},
      {k:"buslanes",label:"Bus-only lanes",cost:.0025*km,dur:2,capMul:1-.004*km/5,riders:Math.round((hot.st.res*.02+hot.st.jobs*.03)),carMul:.996,desc:`Paint ${km.toFixed(1)} km of red bus lanes with camera enforcement. Faster buses, slightly less room for cars.`,evidence:"NYC's 14th St busway raised ridership ~24% with little effect on nearby traffic."},
      {k:"curb",label:"Curb & delivery management",cost:.006,dur:1,capMul:1.03,desc:"Time-limited loading zones and off-peak delivery incentives citywide; double-parking enforcement.",evidence:"Double parking and loading cause a large share of urban arterial delay."}];
    if(!S.cp.pricing&&!S.pricing)opts.push({k:"pricing",label:"Congestion pricing zone",cost:S.base.budget*.035,dur:4,congMul:.88,carMul:.95,revenue:S.base.budget*.025,desc:`Charge drivers entering the core at peak. Revenue funds transit. Model expects ~12% less congestion.`,evidence:"NYC's toll cut vehicle entries into the zone by about 27 million in its first year (MTA, Jan 2026)."});
    return {id:pid(),type:"ai",title:`AI traffic plan: ${hot.name}`,sponsor:"Mobility AI planner",where:hot.name,hood:eng.hoodAt(hot.pts[1][0],hot.pts[1][1]),x:hot.pts[1][0],z:hot.pts[1][1],pts:hot.pts,km,before,after,options:opts,choice:0,
      cost:{city:opts[0].cost},dur:1,summary:`The planner scanned rush-hour traffic across the map. ${hot.name} is the worst corridor (${before.toFixed(2)}× free-flow travel time). Pick one intervention.`,support:{"Drivers":+1,"Business groups":+1},q:S.q};
  }
  if(t==="park"){
    const site=eng.findSites(1,{minCore:5,rng:r,underbuilt:true})[0];if(!site)return null;const rad=Math.round(55+r()*60);
    const cost=.012+rad*rad*3.14*(S.base.homeValue/1e6)*.0009/1000*1000/1e3;
    return {id:pid(),type:"park",title:`New park in ${site.hood}`,sponsor:"Parks Department",where:site.street||site.hood,hood:site.hood,x:site.x,z:site.z,park:{x:site.x,z:site.z,r:rad},
      cost:{city:Math.max(.015,cost)},dur:3,summary:`Acquire and clear about ${(3.14*rad*rad/4047).toFixed(1)} acres for a neighborhood park with trees, playground and lawn.`,
      notes:"Greening vacant lots cut gun violence by 29% in poor Philadelphia neighborhoods (Branas et al., 2018). New parks also cool streets and raise nearby home values.",support:{"Families":+1,"Neighborhood association":+1},q:S.q};
  }
  if(t==="housing"){
    const site=eng.findSites(1,{minCore:20,rng:r})[0];if(!site)return null;const n=Math.round((80+r()*140)/10)*10;
    const spec=eng.towerSpec(site,Math.round(n*90/(Math.min(site.W-8,54)*Math.min(site.D-8,54)*.82)*3.7+12),"r",false);
    return {id:pid(),type:"housing",title:`${n}-unit supportive housing`,sponsor:NONPROFITS[Math.floor(r()*NONPROFITS.length)],where:site.street||site.hood,hood:site.hood,x:site.x,z:site.z,spec,hf:n,units:n,
      cost:{city:n*S.cp.unitCost/1000*.6,annual:n*.000032},dur:6,summary:`Permanent supportive housing with on-site services for ${n} formerly homeless residents. City covers 60% of ${fmt$(n*S.cp.unitCost/1000)} capital; state and private sources cover the rest.`,
      notes:"Housing First programs keep 80–90% of tenants stably housed after a year.",support:{"Housing advocates":+1,"Neighborhood association":-1},q:S.q};
  }
  if(t==="conversion"){
    const site=eng.findSites(1,{minCore:90,rng:r,underbuilt:false})[0];if(!site)return null;const n=Math.round((150+r()*350)/10)*10;
    return {id:pid(),type:"conversion",title:`Office-to-housing conversion, ${n} units`,sponsor:DEVS[Math.floor(r()*DEVS.length)],where:site.street||site.hood,hood:site.hood,x:site.x,z:site.z,units:n,aff:.2,office:-n*85,
      cost:{city:n*.00012},dur:6,summary:`Convert a half-empty office building into ${n} apartments. Developer asks for a ${fmt$(n*.00012)} tax abatement.`,support:{"Downtown business district":+1,"Housing advocates":+1},q:S.q};
  }
  if(t==="safety"){
    const opts=[
      {k:"academy",title:`Police academy class: +${Math.round(S.base.police*.03)} officers`,sponsor:"Police Department",police:.03,cost:{annual:S.base.police*.03*S.cp.officerCost},summary:"Funds an extra recruit class. Officers reach patrol after about a year of training.",notes:"Research estimates each 10% increase in police reduces violent crime ~3% (Chalfin & McCrary)."},
      {k:"vio",title:"Expand community violence intervention",sponsor:"Office of Neighborhood Safety",vio:1,cost:{annual:S.base.budget*.0008},summary:"Street outreach workers mediate conflicts in the highest-violence blocks.",notes:"Evaluations of violence interruption programs show mixed but often meaningful reductions in shootings."},
      {k:"light",title:"Street lighting upgrade",sponsor:"Department of Transportation",lightV:.03,lightP:.05,cost:{city:S.base.budget*.0015},dur:2,summary:"Bright LED lighting on high-crime blocks and public housing grounds.",notes:"A randomized trial in NYC public housing found more lighting cut nighttime outdoor index crimes ~36% (Chalfin et al., 2021)."},
      {k:"crisis",title:"Mental-health crisis response teams",sponsor:"Department of Health",crisis:1,cost:{annual:S.base.budget*.001},summary:"Send clinicians instead of police to behavioral-health 911 calls.",notes:"Denver's STAR program was associated with a 34% drop in reports of low-level crimes in served areas (Dee & Pyne, 2022)."}];
    const o=opts[Math.floor(r()*opts.length)];return Object.assign({id:pid(),type:"safety",dur:o.dur||1,where:"Citywide",hood:"Citywide",cost:o.cost,q:S.q,support:o.k==="academy"?{"Homeowners":+1,"Police reform groups":-1}:{"Community groups":+1}},o);
  }
  return null;
}
SIM._make=(t,eng,r)=>makeProposal(t,eng,r);
function makeGrant(r){
  const g=[{title:"Federal transit capital grant window",summary:"Transit projects approved this quarter receive a 60% federal match instead of 40–45%.",grant:"transit"},
   {title:"State homelessness grant",summary:`${fmt$(S.base.budget*.004)} for supportive housing and shelter if the city matches 25%.`,grant:"homeless"},
   {title:"Climate resilience grant",summary:"Funds coastal flood barriers and green infrastructure; cuts flood damage from future storms.",grant:"resilience"}][Math.floor(r()*3)];
  return Object.assign({id:pid(),type:"grant",sponsor:"State & federal agencies",where:"Citywide",hood:"Citywide",dur:1,cost:{city:g.grant==="homeless"?S.base.budget*.001:g.grant==="resilience"?S.base.budget*.002:0},q:S.q},g);
}
/* applying a decision to a (possibly cloned) state */
SIM.applyProposal=function(st,p,opt){
  const id=p.id;const proj={id,type:p.type,title:p.title,status:"active",prog:0,dur:p.dur||1,startQ:st.q,where:p.where,x:p.x,z:p.z};
  const city=(p.cost&&p.cost.city)||0;
  if(p.type==="tower"||p.type==="conversion"){Object.assign(proj,{units:p.units||0,aff:p.aff||0,office:Math.max(0,p.office||0)});if(p.cost.fee)st.m.reserve+=p.cost.fee;if(p.type==="conversion")proj.annual=city/6;st.approvedN++;}
  else if(p.type==="upzone"){st.zones.push({id,kind:p.zone.kind,potUnits:p.potUnits*.4,potOffice:p.potOffice*.4,left:1,aff:p.aff});proj.dur=1;st.approvedN++;}
  else if(p.type==="transit"){const grantShare=(st.grantTransit&&st.q<=st.grantTransit+1)?.6:p.cost.grant/p.cost.total;const cityShare=p.cost.total*(1-grantShare);Object.assign(proj,{stations:p.stations,color:p.color,riders:p.riders,bond:cityShare,annual:p.cost.annual,rail:p.kind!=="brt",carMul:p.kind==="brt"?.997:.992});}
  else if(p.type==="ai"){const o=p.options[opt!=null?opt:p.choice];Object.assign(proj,{dur:o.dur,capMul:o.capMul,congMul:o.congMul,carMul:o.carMul,riders:o.riders||0,title:o.label+" — "+p.where});st.m.reserve-=o.cost;if(o.revenue)st.shocks.push({k:"revenue",v:o.revenue,q:999});if(o.k==="pricing")st.pricing=true;}
  else if(p.type==="park"){Object.assign(proj,{park:+Math.min(1.5,(p.park.r*p.park.r)/(90*90)*.5).toFixed(2)});st.m.reserve-=city;}
  else if(p.type==="housing"){Object.assign(proj,{hf:p.hf,units:p.units,aff:1,bond:city,annual:p.cost.annual});}
  else if(p.type==="safety"){if(p.police)st.pol.police=+(st.pol.police+p.police).toFixed(3);if(p.vio)st.pol.vio=Math.min(3,st.pol.vio+1);if(p.crisis)st.pol.crisis=Math.min(2,st.pol.crisis+1);if(p.lightV){Object.assign(proj,{lightV:p.lightV,lightP:p.lightP});st.m.reserve-=city;}}
  else if(p.type==="grant"){if(p.grant==="transit")st.grantTransit=st.q+1;if(p.grant==="homeless"){st.m.reserve-=city;proj.hf=Math.round(st.base.budget*.004/st.cp.unitCost*1000*.7);proj.shelter=Math.round(st.base.homeless*.01);proj.dur=4;}if(p.grant==="resilience"){st.m.reserve-=city;st.resilience=true;}}
  st.projects.push(proj);return proj;
};
SIM.decide=function(p,approve,opt,eng){
  S.inbox=S.inbox.filter(x=>x.id!==p.id);S.decided++;
  if(!approve){if(p.type==="tower"||p.type==="conversion")S.deniedN++;
    if(p.type==="tower"&&p.faa)S.shocks.push({k:"approval",v:1,q:2});
    news(`Denied: ${p.title}`,p.where,"deny");return null;}
  if(p.type==="tower"&&p.faa){news(`FAA objects to ${p.title}; developer trims it to 150 m`,p.where,"warn");p.h=150;p.spec.h=150;}
  const proj=SIM.applyProposal(S,p,opt);
  if(eng){
    if((p.type==="tower"||p.type==="housing")&&p.spec){p.spec.label=p.type==="housing"?"Supportive housing":p.title;eng.commitTower(p.spec,proj.id);}
    else if(p.type==="upzone")eng.commitZone(p.zone,proj.id);
    else if(p.type==="park")eng.commitPark(p.park,proj.id);
    else if(p.type==="transit")eng.commitLine(p.pts,p.kind,proj.id,{stations:p.stations,color:p.color});
    else if(p.type==="ai"){const o=p.options[opt!=null?opt:p.choice];if(o.k==="buslanes")eng.commitLine(p.pts,"brt",proj.id);else if(o.k==="signals")eng.commitLine(p.pts,"signal",proj.id);}
  }
  news(`Approved: ${proj.title}`,p.where,"ok");return proj;
};

/* ---------- events ---------- */
const EV={
 noreaster:{season:[0,3],t:"Nor'easter buries the city",d:"Over a foot of snow and coastal flooding shut schools and slow the subway.",wx:"snow",ch:[{l:"All-out cleanup (overtime crews)",cost:.0012,fx:[["approval",2,2]]},{l:"Standard response",cost:0,fx:[["approval",-4,2],["jobs",-.002,1]]}]},
 surge:{season:[2,3],t:"Hurricane storm surge",d:"A tropical storm pushes 3 m of water into low-lying neighborhoods.",wx:"storm",flood:3,ch:[{l:"Emergency response + rebuild fund",cost:.012,fx:[["approval",3,3],["jobs",-.004,2]]},{l:"Rely on federal aid",cost:.003,fx:[["approval",-5,3],["jobs",-.008,3],["rate",-.01,2]]}]},
 heat:{season:[2],t:"Heat wave",d:"Five days above 35°C (95°F). The power grid strains and heat illness spikes.",wx:"clear",heat:true,ch:[{l:"Open cooling centers, free transit",cost:.0006,fx:[["approval",2,1]]},{l:"Issue advisories only",cost:0,fx:[["approval",-3,2]]}]},
 subway:{t:"Signal failures cripple the subway",d:"Century-old signals fail repeatedly; commutes balloon.",ch:[{l:"Fund signal modernization",cost:.01,fx:[["transitMul",1.03,8],["approval",1,2]]},{l:"Patch and wait for the state",cost:0,fx:[["transitMul",.95,3],["approval",-3,2]]}]},
 asylum:{t:"Surge of new arrivals needing shelter",d:"Thousands of migrants arrive, many with nowhere to stay. The right-to-shelter mandate applies.",ch:[{l:"Open emergency shelters",cost:.012,fx:[["homelessMul",1.03,3],["approval",-1,2]]},{l:"Seek state & federal help, limit stays",cost:.004,fx:[["homelessMul",1.06,3],["approval",-3,2]]}]},
 bonus:{t:"Wall Street bonus season beats forecasts",d:"Record bonuses lift income and sales tax receipts.",ch:[{l:"Bank the windfall",cost:0,fx:[["revenue",.006,1]]}],good:true},
 fedcut:{t:"Federal funding cut",d:"Washington trims grants for housing, transit and public health by 8%.",ch:[{l:"Backfill from reserves",cost:"fed",fx:[["approval",1,1]]},{l:"Pass the cuts through",cost:0,fx:[["fedMul",.92,4],["approval",-3,3],["homelessMul",1.03,4]]}]},
 tourism:{t:"Tourism boom",d:"A major event fills hotels and restaurants for weeks.",ch:[{l:"Great news",cost:0,fx:[["jobs",.002,1],["revenue",.002,1]]}],good:true},
 strike:{t:"Transit workers threaten to strike",d:"Contract talks collapse. A strike would stop buses and trains.",ch:[{l:"Settle with a 4% raise",cost:.0015,fx:[]},{l:"Hold firm",cost:0,fx:[["transitMul",.4,1],["congMul",1.12,1],["approval",-6,2]]}]},
 vortex:{season:[0],t:"Polar vortex",d:"−30°C wind chills. Pipes burst; warming centers overflow.",wx:"snow",ch:[{l:"24/7 warming centers & outreach",cost:.0005,fx:[["approval",2,1]]},{l:"Business as usual",cost:0,fx:[["approval",-4,2]]}]},
 violence:{season:[2],t:"Summer violence spike",d:"Shootings rise sharply over two weekends.",ch:[{l:"Police overtime surge",cost:.0015,fx:[["violentMul",.97,2],["approval",1,1]]},{l:"Fund violence interrupters & youth jobs",cost:.0012,fx:[["violentMul",.96,3]]},{l:"No new action",cost:0,fx:[["violentMul",1.06,2],["approval",-4,2]]}]},
 lakeflood:{t:"Lakefront flooding",d:"High lake levels and a storm erode Lake Shore Drive.",wx:"storm",ch:[{l:"Shoreline repairs",cost:.004,fx:[]},{l:"Defer",cost:0,fx:[["congMul",1.04,4],["approval",-2,2]]}]},
 ctacliff:{t:"Transit fiscal cliff",d:"Federal pandemic aid runs out; the transit agency faces a deep deficit.",ch:[{l:"City covers the gap",cost:.02,fx:[]},{l:"Cut service 20%",cost:0,fx:[["transitMul",.86,6],["congMul",1.05,6],["approval",-5,3]]}]},
 bartcliff:{t:"Regional transit fiscal cliff",d:"BART and Muni warn of service cuts without new funding.",ch:[{l:"City funding bridge",cost:.012,fx:[]},{l:"Accept cuts",cost:0,fx:[["transitMul",.88,6],["congMul",1.04,6],["approval",-4,3]]}]},
 hq:{t:"Corporate headquarters scouting the city",d:"A large company may move 4,000 jobs here and asks for incentives.",ch:[{l:"Offer tax incentives",cost:.0025,fx:[["jobs",.003,1],["approval",1,1]]},{l:"No special deals",cost:0,fx:[]}]},
 convention:{t:"Major convention lands",d:"A national convention brings 60,000 visitors.",ch:[{l:"Great news",cost:0,fx:[["revenue",.003,1],["jobs",.001,1]]}],good:true},
 quake:{t:"Magnitude 5.8 earthquake",d:"Older unreinforced buildings are damaged; some streets closed.",ch:[{l:"Emergency inspections + repair fund",cost:.008,fx:[["approval",3,2],["jobs",-.003,1]]},{l:"Minimal response",cost:.002,fx:[["approval",-6,3],["jobs",-.006,2]]}]},
 atmos:{season:[0,3],t:"Atmospheric river",d:"A week of heavy rain floods underpasses and triggers landslides.",wx:"rain",ch:[{l:"Storm crews and sandbags",cost:.0012,fx:[["approval",1,1]]},{l:"Standard response",cost:0,fx:[["approval",-3,1]]}]},
 aiboom:{t:"AI companies race for office space",d:"Fast-growing AI firms sign big leases downtown.",ch:[{l:"Fast-track their permits",cost:0,fx:[["jobs",.006,3],["rent",.006,3]]},{l:"Let it play out",cost:0,fx:[["jobs",.003,3],["rent",.004,3]]}],good:true},
 layoffs:{t:"Tech layoffs",d:"Several large employers cut staff.",ch:[{l:"Workforce retraining fund",cost:.0008,fx:[["jobs",-.004,2],["approval",1,1]]},{l:"No action",cost:0,fx:[["jobs",-.006,2],["approval",-2,2]]}]},
 dreamforce:{t:"Tech conference returns",d:"A huge conference brings tens of thousands of visitors.",ch:[{l:"Great news",cost:0,fx:[["revenue",.003,1]]}],good:true},
 smoke:{season:[2,3],t:"Wildfire smoke",d:"Air quality reaches unhealthy levels for days.",wx:"smoke",ch:[{l:"Clean-air shelters, masks",cost:.0004,fx:[["approval",1,1]]},{l:"Advisories only",cost:0,fx:[["approval",-2,1]]}]},
 snow:{season:[0,3],t:"Ice storm",d:"Freezing rain coats the hills; buses can't climb.",wx:"snow",ch:[{l:"Extra de-icing crews",cost:.0006,fx:[]},{l:"Standard response",cost:0,fx:[["approval",-3,1]]}]},
 rto:{t:"Big employers order return to office",d:"Downtown foot traffic jumps; so do traffic jams.",ch:[{l:"Add peak bus service",cost:.001,fx:[["transitMul",1.04,4],["congMul",1.03,4]]},{l:"No changes",cost:0,fx:[["congMul",1.06,4]]}],good:true},
 heatdome:{season:[2],t:"Heat dome",d:"Temperatures hit 42°C (108°F) in a city where few homes have AC.",ch:[{l:"Cooling centers and outreach",cost:.0008,fx:[["approval",2,1]]},{l:"Advisories only",cost:0,fx:[["approval",-5,2]]}]},
 sewage:{t:"Cross-border sewage closes beaches",d:"Contaminated water from the Tijuana River closes southern beaches.",ch:[{l:"Fund local diversion work",cost:.003,fx:[["approval",2,2]]},{l:"Lobby Washington",cost:0,fx:[["approval",-2,2],["revenue",-.001,2]]}]},
 comiccon:{season:[2],t:"Comic-Con week",d:"135,000 attendees fill downtown.",ch:[{l:"Great news",cost:0,fx:[["revenue",.002,1],["congMul",1.02,1]]}],good:true},
 drought:{t:"Drought restrictions",d:"State orders cuts in outdoor water use.",ch:[{l:"Rebates for drought-tolerant yards",cost:.0006,fx:[["approval",1,1]]},{l:"Enforce limits",cost:0,fx:[["approval",-2,1]]}]},
 biotech:{t:"Biotech expansion",d:"Life-science firms announce new labs and 3,000 jobs.",ch:[{l:"Welcome them",cost:0,fx:[["jobs",.003,2]]}],good:true},
 kingtide:{t:"King tides flood the waterfront",d:"Unusually high tides overtop seawalls.",flood:1.6,ch:[{l:"Temporary barriers",cost:.001,fx:[]},{l:"Wait it out",cost:0,fx:[["approval",-2,1]]}]},
 recession:{t:"National recession",d:"Rising rates and falling demand hit local employers and home prices.",ch:[{l:"Stimulus: fast-track public works",cost:.01,fx:[["jobs",-.004,3],["rate",-.008,3]]},{l:"Cut spending to protect reserves",cost:0,fx:[["jobs",-.007,3],["rate",-.012,3],["approval",-3,3]]}]}
};
SIM.EV=EV;
SIM.rollEvent=function(){
  const C=GEO.cities[S.key];const r=rng(S.seed*3+S.q*17);if(S.q===0)return null;
  const pChance=.42;if(r()>pChance)return null;
  const pool=C.events.concat(["recession"]).filter(k=>{const e=EV[k];if(!e)return false;if(e.season&&!e.season.includes(S.q%4))return false;if(S.eventLog.slice(-4).includes(k))return false;if(k==="recession"&&S.eventLog.includes(k))return false;return true;});
  if(!pool.length)return null;const k=pool[Math.floor(r()*pool.length)];S.eventLog.push(k);return {k,e:EV[k]};
};
SIM.resolveEvent=function(ev,i){
  const c=ev.e.ch[i];const cost=c.cost==="fed"?S.base.budget*.25*.08*.25:(c.cost||0)*S.base.budget;S.m.reserve-=cost;
  for(const [k,v,q] of c.fx){S.shocks.push({k,v:k==="revenue"?v*S.base.budget*4:v,q});}
  if(ev.k==="surge"||ev.k==="kingtide"){if(S.resilience){S.shocks.push({k:"approval",v:2,q:2});news("Resilience upgrades limited flood damage","Waterfront","ok");}}
  news(`${ev.e.t}: ${c.l}`,"Citywide",ev.e.good?"ok":"warn");
};
function news(t,where,kind){S.news.unshift({q:S.q,t,where,kind});if(S.news.length>60)S.news.pop();}
SIM.news=news;

/* ---------- budget levers ---------- */
SIM.LEVERS=[
 {k:"police",label:"Police staffing",min:.8,max:1.3,step:.05,fmt:v=>Math.round(v*100)+"%",note:"Each 10% more officers ≈ 3% less violent crime (elasticity −0.3). Hiring takes ~1 year."},
 {k:"homeless",label:"Homeless services & shelter",min:.8,max:2.5,step:.1,fmt:v=>Math.round(v*100)+"%",note:"More outreach, shelter and case management raise exits from homelessness and cut street homelessness."},
 {k:"rentAssist",label:"Rental assistance & eviction defense",min:0,max:3,step:1,fmt:v=>["Off","Basic","Expanded","Universal"][v],note:"Prevents households from losing housing; cuts new entries into homelessness up to ~20%."},
 {k:"transit",label:"Transit service hours",min:.8,max:1.4,step:.05,fmt:v=>Math.round(v*100)+"%",note:"Ridership rises ~0.45% per 1% more service."},
 {k:"parks",label:"Parks & sanitation",min:.8,max:1.5,step:.05,fmt:v=>Math.round(v*100)+"%",note:"Cleaner streets and parks lift livability and modestly reduce property crime."},
 {k:"youth",label:"Youth programs & summer jobs",min:.8,max:1.6,step:.05,fmt:v=>Math.round(v*100)+"%",note:"Summer jobs programs have cut violent-crime arrests among participants by a third or more (Heller, 2014)."},
 {k:"vio",label:"Community violence intervention",min:0,max:3,step:1,fmt:v=>["None","Pilot","Citywide","Intensive"][v],note:"Outreach workers mediate disputes in the highest-risk blocks."},
 {k:"crisis",label:"Crisis response teams",min:0,max:2,step:1,fmt:v=>["None","Pilot","Citywide"][v],note:"Clinicians respond to mental-health calls instead of police."},
 {k:"propTax",label:"Property tax rate change",min:-.15,max:.25,step:.05,fmt:v=>(v>=0?"+":"")+Math.round(v*100)+"%",note:"Changes property tax revenue; homeowners notice quickly."},
 {k:"bizTax",label:"Business tax rate change",min:-.2,max:.2,step:.05,fmt:v=>(v>=0?"+":"")+Math.round(v*100)+"%",note:"Higher taxes raise revenue but weaken the business climate."}];
SIM.setLever=(k,v)=>{S.pol[k]=v;};
SIM.leverCost=function(k,v){const b=S.base,cp=S.cp;const B0=b.budget;switch(k){case"police":return B0*cp.policeShare*(v-1);case"homeless":return B0*cp.homeShare*(v-1);case"transit":return B0*cp.transitShare*(v-1);case"parks":return B0*.015*(v-1);case"youth":return B0*.03*(v-1);case"rentAssist":return B0*.0012*v;case"vio":return B0*.0008*[0,1,1.8,2.5][v];case"crisis":return B0*.001*v;case"propTax":return -B0*b.taxBase*v;case"bizTax":return -B0*.42*v*.85;}return 0;};
})();
/* ---------- mayor-initiated proposals ---------- */
(function(){
const S_=()=>SIM.state(),fmt$=SIM.fmt$;
SIM.planProposal=function(eng,pl){
  const S=S_();const stations=pl.st.map(a=>{const q=eng.ll([a[0],a[1]]);return [q[0],q[1],a[2]];});
  let color=pl.color;if(pl.line){const l=(eng.transit().lines||[]).find(l=>l.ref===pl.line);if(l)color=l.color;}
  const p=SIM.transitProposal(eng,{title:pl.title,kind:pl.kind,color,pts:stations.map(s=>[s[0],s[1]]),stations,cost:pl.cost,src:pl.src,planId:pl.id,line:pl.line});
  return p;};
SIM.extensionProposal=function(eng,lineId,custom){
  const ex=eng.extensionFor(lineId);if(!ex)return null;const l=ex.line;
  const stations=ex.stations;const kind={subway:"subway",light_rail:"rail",tram:"streetcar",monorail:"rail"}[l.kind]||"rail";
  return SIM.transitProposal(eng,{title:`Extend the ${l.name} from ${ex.from||"its terminal"} to ${stations[stations.length-1][2]}`,kind,color:l.color,pts:[ex.pts[0]].concat(stations.map(s=>[s[0],s[1]])),stations,line:l.ref,lineId:l.id,sponsor:custom?"Mayor's office":"Regional transit agency",custom,
    src:"Route picked by the model: from the end of the line toward the densest homes and jobs that are more than 800 m from a station."});};
SIM.networkProposal=function(eng,r){
  const S=S_();S.plansUsed=S.plansUsed||[];
  const plans=((window.TRANSIT_PLANS||{})[S.key]||[]).filter(p=>!S.plansUsed.includes(p.id));
  if(plans.length&&r()<.65){const pl=plans[Math.floor(r()*plans.length)];S.plansUsed.push(pl.id);return SIM.planProposal(eng,pl);}
  const lines=(eng.transit().lines||[]);if(!lines.length)return null;
  for(let t=0;t<4;t++){const l=lines[Math.floor(r()*lines.length)];const p=SIM.extensionProposal(eng,l.id);if(p)return p;}return null;};

/* ---- transit network projects ---- */
const OFFST={nyc:9000,chi:3000,sf:5000,sea:4500,sd:2000},KM={subway:1,rail:1,streetcar:1,brt:1};
SIM.lineRiders=function(eng,stations,kind,ext){
  const S=S_(),b=S.base;const c=eng.newCatch(stations.map(s=>[s[0],s[1]]),800);
  const prop=Math.max(.45,Math.min(1.7,(1-b.carShare)/.45));
  const mul={subway:1.6,rail:1.25,streetcar:.55,brt:.5}[kind]||1;
  const off=stations.filter(s=>Math.abs(s[0])>4900||Math.abs(s[1])>4900).length*(OFFST[S.key]||3000)*.5*(kind==="streetcar"||kind==="brt"?.4:1);
  return Math.round(((c.res*.07+c.jobs*.1)+.3*(c.resC*.07+c.jobsC*.1))*mul*prop*(ext?1.15:1)+off);
};
SIM.transitProposal=function(eng,o){
  const S=S_(),cp=S.cp;const len=eng.pathStats(o.pts).len,km=len/1000;
  const perKm={subway:cp.railKind==="subway"?cp.rail:cp.rail*1.8,rail:cp.rail,streetcar:cp.rail*.3,brt:cp.brt}[o.kind]||cp.rail;
  const total=o.cost||perKm*km;const grant=o.kind==="brt"?.4:.45;
  const riders=SIM.lineRiders(eng,o.stations,o.kind,!!o.line);
  const kindTxt={subway:"subway",rail:"light rail",streetcar:"streetcar",brt:"bus rapid transit"}[o.kind];
  const mid=o.pts[Math.floor(o.pts.length/2)];
  return {id:S.nextId++,type:"transit",kind:o.kind,title:o.title,sponsor:o.sponsor||"Regional transit agency",where:o.where||o.stations.map(s=>s[2]).filter(Boolean).slice(0,1).concat(o.stations.slice(-1).map(s=>s[2])).join(" → "),
    hood:eng.hoodAt(mid[0],mid[1]),x:mid[0],z:mid[1],pts:o.pts,stations:o.stations,color:o.color,km,riders,planId:o.planId,lineId:o.lineId,
    cost:{city:total*(1-grant),grant:total*grant,total,annual:total*(o.kind==="brt"?.04:.012)},dur:{subway:28,rail:18,streetcar:10,brt:5}[o.kind]||16,
    summary:`${km.toFixed(1)} km of ${kindTxt} with ${o.stations.length} stations (${o.stations.map(s=>s[2]).filter(Boolean).join(", ")}). Model forecast: about ${riders.toLocaleString()} weekday riders${o.line?" counting transfers from the existing line":""}. Total ${fmt$(total)}${o.cost?" (published estimate)":" at typical "+GEO.cities[S.key].name+" costs per km"}, ${Math.round(grant*100)}% assumed from federal grants.`,
    notes:o.src||(o.kind==="subway"?"US subway projects have cost $0.5–2.5B per km; tunnels cost several times more than elevated or street-running lines.":""),
    support:{"Transit riders":+1,"Drivers":o.kind==="brt"||o.kind==="streetcar"?-1:0,"Business groups":+1,"Neighborhood association":o.kind==="rail"?-1:0},q:S.q,custom:!!o.custom};
};

SIM.custom=function(type,eng,o){
  const S=S_();const r=Math.random;
  if(type==="ai"){return SIM._make("ai",eng,r);}
  const hood=eng.hoodAt(o.x,o.z),street=eng.streetNameAt(o.x,o.z)||hood;
  if(type==="upzone"){
    const z={x:o.x,z:o.z,r:o.r||300,kind:o.kind||"housing",stories:o.stories||10};const pv=eng.previewZone(z);
    const pot=pv.dGfa;const potUnits=z.kind==="housing"?pot/95:pot*.3/95,potOffice=z.kind==="office"?pot*.7:0;
    return {id:S.nextId++,type:"upzone",title:z.kind==="housing"?`Upzone ${hood} for ${z.stories}-story housing`:`Commercial upzoning in ${hood}`,sponsor:"Mayor's office",where:street,hood,x:o.x,z:o.z,zone:z,potUnits:Math.round(potUnits),potOffice:Math.round(potOffice),eligible:pv.count,aff:z.kind==="housing"?S.cp.inclusion*.8:0,cost:{city:.002},dur:2,
      summary:`Raises height limits on ${pv.count} parcels within ${z.r} m. Full build-out could add about ${Math.round(potUnits).toLocaleString()} homes${potOffice?` and ${(potOffice/1e3).toFixed(0)}k m² of offices`:""}. Typically 25–40% of new capacity gets built within a decade.`,
      support:{"Housing advocates":z.kind==="housing"?+1:0,"Neighborhood association":-1},q:S.q,custom:true};
  }
  if(type==="park"){
    const rad=o.r||90;return {id:S.nextId++,type:"park",title:`New park in ${hood}`,sponsor:"Mayor's office",where:street,hood,x:o.x,z:o.z,park:{x:o.x,z:o.z,r:rad},cost:{city:Math.max(.015,.012+rad*rad*3.14*(S.base.homeValue/1e6)*.0009/1e3)},dur:3,
      summary:`Buy and clear about ${(3.14*rad*rad/4047).toFixed(1)} acres for a neighborhood park.`,notes:"Greening vacant lots cut gun violence by 29% in poor Philadelphia neighborhoods (Branas et al., 2018).",support:{"Families":+1,"Displaced owners":-1},q:S.q,custom:true};
  }
  if(type==="buslanes"){
    const p=o.path;const km=p.len/1000;const st=eng.pathStats(p.pts,{spacing:600});
    return {id:S.nextId++,type:"transit",kind:"brt",title:`Bus rapid transit on ${p.name}`,sponsor:"Mayor's office",where:p.name,hood:eng.hoodAt(p.pts[1][0],p.pts[1][1]),x:p.pts[1][0],z:p.pts[1][1],pts:p.pts,km,riders:Math.round((st.res*.07+st.jobs*.1)*.5*2),
      cost:{city:S.cp.brt*km*.6,grant:S.cp.brt*km*.4,total:S.cp.brt*km,annual:S.cp.brt*km*.04},dur:5,summary:`${km.toFixed(1)} km of dedicated bus lanes and stations serving ${Math.round((st.res+st.jobs)/1000)}k residents and jobs within 800 m.`,notes:"Comparable BRT corridors have cut bus travel times 15–25%.",support:{"Transit riders":+1,"Drivers":-1},q:S.q,custom:true};
  }
  return null;
};
})();
