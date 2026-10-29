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

/* ---------- policies & programs the mayor can enact ----------
   fx keys: buildMul, rentAdd (quarterly), homeValueAdd, jobsAdd, popAdd, violentMul, propertyMul, homelessInMul, exitsMul,
   transitMul, congMul, carMul, revenue (share of budget / yr), annual (share of budget / yr), once (share of budget, one-time), parkAdd, livAdd.
   groups: persistent satisfaction push per group while active. sd: how uncertain the real effect is (lognormal). */
const POLICY={
 vacancyTax:{cat:"Revenue",label:"Vacant-home tax",desc:"Tax homes and storefronts left empty more than six months.",fx:{revenue:.0025,rentAdd:-.0004},groups:{Renters:.07,Homeowners:-.07,Businesses:-.04},sd:.45,ev:"Vancouver's Empty Homes Tax cut vacancies ~36% and raised C$140M+."},
 headTax:{cat:"Revenue",label:"Big-employer payroll tax",desc:"0.7% payroll tax on companies with more than $7M in payroll.",fx:{revenue:.012,jobsAdd:-.0007},groups:{Businesses:-.32,Renters:.06,"Young adults":.03},sd:.35,ev:"Seattle's JumpStart tax raised ~$300M/yr; critics tie it to slower downtown hiring."},
 landSale:{cat:"Revenue",label:"Sell surplus city land",desc:"Auction underused city parcels to developers. One-time cash; more housing gets built.",fx:{once:-.006,buildMul:1.03},groups:{Renters:-.03,Businesses:.05},sd:.3,oneShot:true,ev:"Proceeds depend heavily on the market when the auction closes."},
 parking:{cat:"Revenue",label:"Demand-based parking meters",desc:"Raise meter rates where blocks are full and extend hours.",fx:{revenue:.002,congMul:.99,carMul:.996},groups:{Businesses:-.06,Homeowners:-.04,"Young adults":.02},sd:.3,ev:"SFpark's demand pricing cut cruising for parking ~50% in pilot zones."},
 rentStab:{cat:"Housing",label:"Rent stabilization (3% cap)",desc:"Cap yearly rent increases on existing apartments at 3%.",fx:{rentAdd:-.0045,buildMul:.86},groups:{Renters:.38,Homeowners:-.14,Businesses:-.12,"Young adults":.14},sd:.35,ev:"St. Paul's 2021 cap cut new permits sharply until it was loosened; tenants gained stability."},
 permitFast:{cat:"Housing",label:"Permit streamlining",desc:"60-day permit clock, by-right approvals for code-compliant projects.",fx:{annual:.0008,buildMul:1.24},groups:{Businesses:.1,Homeowners:-.05,"Young adults":.05},sd:.4,ev:"Austin and Auckland saw construction jump after removing discretionary review."},
 adu:{cat:"Housing",label:"Legalize ADUs & fourplexes",desc:"Allow backyard cottages and up to four homes on every residential lot.",fx:{buildMul:1.1,rentAdd:-.0006},groups:{Homeowners:-.1,"Young adults":.1,Renters:.05},sd:.5,ev:"Minneapolis's 2040 plan coincided with rents rising far slower than peers."},
 socialHousing:{cat:"Housing",label:"Municipal social housing fund",desc:"Revolving fund that builds mixed-income, permanently affordable apartments.",fx:{annual:.004,buildMul:1.06,rentAdd:-.0012},groups:{Renters:.16,Homeowners:-.06,Families:.05},sd:.4,ev:"Modeled on Vienna; Montgomery County MD's version broke ground within two years."},
 downpay:{cat:"Housing",label:"First-time homebuyer assistance",desc:"Up to $40k down-payment help for first-time buyers under 120% of median income.",fx:{annual:.0015,homeValueAdd:.0004,popAdd:.0002},groups:{"Young adults":.13,Families:.1},sd:.3,ev:"Down-payment aid raises ownership but can nudge prices up where supply is tight."},
 bodycams:{cat:"Public safety",label:"Body cameras & use-of-force reform",desc:"Cameras for every patrol officer, new de-escalation rules, public release policy.",fx:{once:.0008,annual:.0003,violentMul:1.0},groups:{Renters:.06,"Young adults":.1,Homeowners:-.02},sd:.3,calm:true,ev:"Evidence on crime effects is mixed; complaints against officers usually fall."},
 gunTask:{cat:"Public safety",label:"Gun violence task force",desc:"Focused deterrence: police, prosecutors and outreach target the few groups driving shootings.",fx:{annual:.0006,violentMul:.965},groups:{Families:.06,Homeowners:.05},sd:.45,ev:"Boston's Operation Ceasefire was linked to a 63% drop in youth homicides."},
 retail:{cat:"Public safety",label:"Retail theft task force",desc:"Dedicated detectives and prosecutors for organized retail theft.",fx:{annual:.0005,propertyMul:.955},groups:{Businesses:.14,Homeowners:.04,"Young adults":-.02},sd:.4,ev:"Results depend on prosecution follow-through."},
 visionZero:{cat:"Public safety",label:"Vision Zero street redesign",desc:"Daylighted crosswalks, protected bike lanes and speed cameras on high-injury streets.",fx:{once:.002,congMul:1.01,livAdd:2},groups:{Families:.1,"Young adults":.06,Homeowners:-.03},sd:.3,ev:"Hoboken went seven years without a traffic death after redesigning intersections."},
 encamp:{cat:"Homelessness",label:"Encampment resolution with shelter offers",desc:"Outreach teams offer shelter or housing before clearing large encampments.",fx:{once:.001,exitsMul:1.12},groups:{Homeowners:.12,Businesses:.12,Renters:-.04},sd:.5,street:true,ev:"Outcomes hinge on having enough shelter beds; sweeps alone mostly move people around."},
 treatment:{cat:"Homelessness",label:"Addiction treatment on demand",desc:"Same-day treatment slots and medication for opioid use disorder.",fx:{annual:.0012,exitsMul:1.08,propertyMul:.985},groups:{Families:.05,Seniors:.04,Renters:.03},sd:.45,ev:"Medication for opioid use disorder roughly halves overdose death risk."},
 smallBiz:{cat:"Economy",label:"Small-business grants",desc:"Grants and low-interest loans for storefront businesses.",fx:{annual:.001,jobsAdd:.0003},groups:{Businesses:.15,Renters:.02},sd:.45,ev:"Returns vary widely by program design."},
 workforce:{cat:"Economy",label:"Workforce training pipeline",desc:"Paid apprenticeships with local employers in healthcare, trades and tech.",fx:{annual:.0008,jobsAdd:.00025},groups:{"Young adults":.08,Renters:.05,Businesses:.04},sd:.4,ev:"Sectoral programs like Year Up raised earnings ~30% in randomized trials."},
 tourism:{cat:"Economy",label:"Tourism & convention marketing",desc:"Marketing push and bids for major conventions and events.",fx:{annual:.0005,revenue:.0009,jobsAdd:.0001},groups:{Businesses:.08},sd:.5,ev:"Payoff depends on the national travel market."},
 minWage:{cat:"Economy",label:"$20 minimum wage",desc:"Phase in a $20 minimum wage over two years.",fx:{jobsAdd:-.00025,incomeAdd:.0025},groups:{Renters:.14,"Young adults":.14,Businesses:-.2},sd:.4,ev:"Seattle's $15 studies disagree: hours fell for some workers, pay rose for most."},
 downtown:{cat:"Economy",label:"Downtown revitalization",desc:"Events, cleaning ambassadors, lighting and storefront activation downtown.",fx:{annual:.0008,propertyMul:.985,jobsAdd:.00012,livAdd:1.5},groups:{Businesses:.1,Homeowners:.03},sd:.4,ev:""},
 trees:{cat:"Quality of life",label:"Plant 20,000 street trees",desc:"Shade, cooler streets, cleaner air; trees take years to mature.",fx:{once:.0015,parkAdd:1.2},groups:{Families:.05,Homeowners:.04,Seniors:.03},sd:.2,oneShot:true,ev:"Tree canopy lowers summer street temperatures by several degrees."},
 afterschool:{cat:"Quality of life",label:"After-school & summer programs",desc:"Free after-school, summer camp and teen jobs in every neighborhood.",fx:{annual:.001,violentMul:.985},groups:{Families:.16,"Young adults":.03},sd:.35,ev:"Chicago's One Summer Plus cut violent-crime arrests among participants by ~43%."},
 libraries:{cat:"Quality of life",label:"Extended library & rec-center hours",desc:"Seven-day library hours and late-night rec centers.",fx:{annual:.0004,livAdd:1},groups:{Families:.06,Seniors:.08,"Young adults":.03},sd:.2,ev:""},
 cleanStreets:{cat:"Quality of life",label:"Street-cleaning blitz",desc:"Daily litter pickup, graffiti removal and more public restrooms.",fx:{annual:.0006,livAdd:2,propertyMul:.995},groups:{Homeowners:.06,Businesses:.07,Seniors:.04},sd:.2,ev:""},
 freeTransit:{cat:"Quality of life",label:"Free transit for seniors & students",desc:"Fare-free passes for riders under 18 and over 65.",fx:{annual:.0008,transitMul:1.025},groups:{Seniors:.15,Families:.08,"Young adults":.04},sd:.25,ev:""}
};
SIM.POLICY=POLICY;
const ADVISORS={"Chief of Staff":"Maya Okafor","Housing":"Daniel Reyes","Public safety":"Lena Park","Economy":"Victor Hale","Budget":"Priya Shah","Homelessness":"Jordan Ellis"};
SIM.ADVISORS=ADVISORS;
const CAT_ADV={Revenue:"Budget",Housing:"Housing","Public safety":"Public safety",Homelessness:"Homelessness",Economy:"Economy","Quality of life":"Chief of Staff"};
function lognorm(r,sd){let u=0;for(let i=0;i<6;i++)u+=r();const z=(u-3)/Math.sqrt(.5);return Math.exp(z*sd-sd*sd/2);}
function effOf(st,k,sd){st.eff=st.eff||{};if(st.eff[k]==null){const r=rng((st.seed*13+k.length*7919+k.charCodeAt(0)*131)>>>0);st.eff[k]=+lognorm(r,sd==null?.3:sd).toFixed(3);}return st.eff[k];}
SIM.effOf=k=>effOf(S,k);
const GKEY={"Renters":0,"Homeowners":1,"Businesses":2,"Young adults":3,"Seniors":4,"Families":5};

/* ---------- state ---------- */
let S=null; SIM.state=()=>S; SIM.load=o=>{S=o;return S;};
SIM.start=function(key,mayorName){
  const C=GEO.cities[key],b=Object.assign({},C.baseline),cp=CITYP[key];
  b.units=b.pop/cp.hhSize/(1-b.vacancy);b.hh=b.pop/cp.hhSize;
  S={key,mayor:mayorName||"Mayor",q:0,year0:2027,seed:C.seed*7+3,base:b,cp,
    pol:{police:1,homeless:1,transit:1,parks:1,youth:1,propTax:0,bizTax:0,rentAssist:0,vio:0,crisis:0,salesTax:0,hotelTax:0,fees:0},policies:[],reports:[],pressing:[],advisors:[],
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
  hooks=hooks||{};const m=st.m,b=st.base,p=st.pol,cp=st.cp;const prev=Object.assign({},m);prev.groups=(m.groups||[]).slice();
  p.salesTax=p.salesTax||0;p.hotelTax=p.hotelTax||0;p.fees=p.fees||0;
  // luck: live play (and range forecasts) get random shocks; plain forecasts use expected values
  const noisy=live||st._noisy;const rr=noisy?rng((st.seed*31+(st.q+1)*977+(st._noisySeed||0)*7717)>>>0):null;
  const gs=sd=>{if(!rr)return 0;let u=0;for(let i=0;i<6;i++)u+=rr();return (u-3)/Math.sqrt(.5)*sd;};
  const pols=(st.policies||[]).filter(x=>x.on);
  const PM=k=>{let v=1;for(const a of pols){const d=POLICY[a.k];if(d&&d.fx[k]!=null)v*=1+(d.fx[k]-1)*a.eff;}return v;};
  const PA=k=>{let v=0;for(const a of pols){const d=POLICY[a.k];if(d&&d.fx[k]!=null)v+=d.fx[k]*(k==="annual"||k==="once"?1:a.eff);}return v;};
  const E=k=>effOf(st,k,.3);
  const luck={violent:gs(.035),property:gs(.03),rent:gs(.0028),jobs:gs(.0014),homeless:gs(.05),value:gs(.004),approval:gs(.7),transit:gs(.015)};
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
  const buildM=PM("buildMul");m.units+=newUnits+m.units*(cp.build||.002)*buildM;m.affordable+=affordable;
  // jobs
  const bus0=st.idx0.business;
  const jPol=PA("jobsAdd")-.0002*p.salesTax-.00004*p.hotelTax,jBiz=.0002*(st.idx.business-bus0);
  let gJ=b.jobGrowth+jBiz+shock(st,"jobs")+jPol+luck.jobs;
  m.jobs*=1+gJ;m.jobs+=newOffice/28*.4;
  // population & housing market
  const vacPrev=m.vacancy;
  let mig=.35*gJ+.0015*((st.idx.livability-st.idx0.livability)/10)+.002*((st.idx.afford-st.idx0.afford)/10)+shock(st,"pop")+PA("popAdd");
  if(vacPrev<.025)mig=Math.min(mig,mig*(vacPrev/.025));
  m.pop*=1+.0006+mig;m.hh=m.pop/cp.hhSize;
  m.vacancy=clamp(1-m.hh/m.units,.004,.2);
  const rVac=.3*(b.vacancy-m.vacancy),rPol=PA("rentAdd");
  const gR=b.rentTrend+rVac+.15*gJ+shock(st,"rent")+rPol+luck.rent;
  m.rent*=1+gR;
  const gV=.75*gR+.15*(st.idx.safety-st.idx0.safety)/100+shock(st,"rate")*.5+m.parkScore*.0004+(p.propTax?-p.propTax*.004:0)+PA("homeValueAdd")+luck.value;
  m.homeValue*=1+gV;
  // unemployment & income
  m.unemp=clamp(b.unemp+30*(Math.log(m.pop/b.pop)-Math.log(m.jobs/b.jobs))+shock(st,"unemp"),2,16);
  m.income*=1+.0065+PA("incomeAdd")/4+.25*gJ-.0008*(m.unemp-prev.unemp)*10+(m.inc[2]-prev.inc[2])*.6;
  // homelessness (stock-flow; ~30% quarterly turnover)
  const burdenR=(m.rent/m.income)/(b.rent/b.hhIncome);
  const prevent=1-Math.min(.25,.07*p.rentAssist);
  // two pools: short-term homelessness turns over fast; chronic homelessness rarely ends without supportive housing
  const pressure=Math.pow(burdenR,2)*(1+.04*(m.unemp-b.unemp))*prevent*shock(st,"homelessMul")*PM("homelessInMul")*Math.exp(luck.homeless);
  const svc=Math.pow(p.homeless,.3*E("homeless"))*PM("exitsMul");hfPlaced*=Math.min(1.1,E("hf"));
  const inT=.28*b.homeless*pressure,inC=.012*b.homeless*pressure;const exT=.4*svc*m.trans,exC=.04*svc*m.chronic;
  m.trans=Math.max(0,m.trans+inT-exT-shock(st,"housed"));
  m.chronic=Math.max(0,m.chronic+inC-exC-hfPlaced);
  m.homeless=m.trans+m.chronic;
  m.unshel=clamp(b.unsheltered*Math.pow(p.homeless,-.45)*(1-Math.min(.8,m.shelter/Math.max(1,b.homeless*b.unsheltered))),.02,.9);
  // police & crime
  const tgt=b.police*p.police;m.police+=clamp((tgt-m.police)*.25,-b.police*.03,b.police*.025);
  m.trend*=.9945;
  const polE=Math.pow(m.police/b.police,-.3*E("police"))*(p.crisis?1-.03*p.crisis*E("crisis"):1);
  const vio=1-(1-([1,.96,.93,.91][p.vio]||1))*E("vio");const youth=1-clamp((p.youth-1)*.08,-.05,.06)*E("youth");
  const econ=1+.022*(m.unemp-b.unemp);const vPol=PM("violentMul"),vEv=shock(st,"violentMul"),vLuck=Math.exp(luck.violent),light=(1-m.lightV),pkF=(1-m.parkScore*.002);
  m.violent=b.violent*m.trend*polE*econ*vio*youth*light*pkF*vEv*vPol*vLuck;
  m.property=b.property*m.trend*Math.pow(polE,.8)*(1+.03*(m.unemp-b.unemp))*(p.crisis?1-.03*p.crisis:1)*(1-m.lightP)*(1-(p.parks-1)*.03)*shock(st,"propertyMul")*PM("propertyMul")*Math.exp(luck.property);
  st.fac={police:polE,econ,vio,youth,light,parks:pkF,events:vEv,policies:vPol,luck:vLuck,trend:m.trend};
  // transit, mode share, congestion
  m.transit=(b.transit*Math.pow(p.transit,.45)*Math.pow(m.jobs/b.jobs,.7)*Math.pow(m.pop/b.pop,.3)+newRiders+(prev.extraRiders||0)+(st.freqRiders||0))*Math.pow(m.violent/b.violent,-.06)*shock(st,"transitMul")*PM("transitMul")*Math.exp(luck.transit);
  m.extraRiders=(prev.extraRiders||0)+newRiders;
  const act=(m.pop+m.jobs)/(b.pop+b.jobs);
  m.carShare=clamp(1-(1-b.carShare)*(m.transit/b.transit)/act,.04,.96)*m.carMul*PM("carMul");
  const demand=act*(m.carShare/b.carShare);
  m.congestion=clamp(b.congestion*Math.pow(demand/m.capMul,1.6)*m.congMul*shock(st,"congMul")*PM("congMul"),3,95);
  m.commute=b.commute*(1+b.carShare*((1+m.congestion/100)/(1+b.congestion/100)-1))*(1-.012*m.railDone)*Math.pow(p.transit,-.05);
  // budget ($B / year, nominal)
  const B0=b.budget,inf=m.price*Math.pow(1.0025,st.q); // costs outpace inflation (wages, pensions)
  const propRev=B0*b.taxBase*Math.pow(m.homeValue/b.homeValue,.6)*(m.units/b.units)*(1+p.propTax);
  const bizRev=B0*.42*(m.jobs/b.jobs)*Math.pow(m.income/b.hhIncome,.6)*(1+p.bizTax*.85);
  const other=B0*(1-b.taxBase-.42)*inf*shock(st,"fedMul")+shock(st,"revenue");
  const newTax=B0*inf*(.02*p.salesTax*Math.pow(m.jobs/b.jobs,.8)+.0028*p.hotelTax+.025*p.fees+PA("revenue"));
  m.revenue=propRev+bizRev+other+newTax;
  const dep=B0*(cp.policeShare*(m.police/b.police)+cp.homeShare*p.homeless+cp.transitShare*p.transit+.015*p.parks+.03*p.youth)*inf+(st.freqCost||0)*inf;
  const fixed=B0*(1-cp.policeShare-cp.homeShare-cp.transitShare-.015-.03)*inf;
  const prog=B0*(.0012*p.rentAssist+.0008*[0,1,1.8,2.5][p.vio]+.001*p.crisis)*inf;
  let ops=0,debtSvc=0;for(const pr of st.projects){if(pr.status==="done"&&pr.annual)ops+=pr.annual;if(pr.bond&&pr.status!=="cancelled")debtSvc+=pr.bond*.07;}
  m.debt=st.projects.reduce((s,pr)=>s+(pr.bond&&pr.status!=="cancelled"?pr.bond:0),0);
  const polCost=B0*inf*PA("annual");st.genBond=st.genBond||0;
  m.spend=dep+fixed+prog+ops+debtSvc+polCost+st.genBond*.075+shock(st,"cost");m.debt+=st.genBond;
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
  const pg=[0,0,0,0,0,0];for(const a of pols){const d=POLICY[a.k];for(const g in d.groups){const i=GKEY[g];if(i!=null)pg[i]+=d.groups[g]*.55;}}
  const liv=(PA("livAdd")||0)/100,tx=p.salesTax*.06,ht=p.hotelTax*.01,fe=p.fees*.25;
  const T=[ // each group's satisfaction terms, labeled so the quarterly report can explain moves
    [["Rent burden",-2.5*realR],["Homelessness",-.8*dHome],["Violent crime",-1.2*dV],["Transit",.6*dT],["Parks",.3*pk],["Sales tax & fees",-tx-fe*.5],["Your policies",pg[0]],["Street life",liv]],
    [["Home values",1.2*dHV],["Property tax",-4*p.propTax],["Violent crime",-1.5*dV],["Traffic",-.25*dC],["Homelessness",-.4*dHome],["Fees",-fe],["Your policies",pg[1]],["Street life",liv]],
    [["Job growth",3*dJ],["Business tax",-2*p.bizTax],["Violent crime",-1*dV],["Traffic",-.3*dC],["Your approvals",.02*(st.approvedN-st.deniedN)],["Sales & hotel tax",-tx*1.2-ht*1.5-fe*.6],["Your policies",pg[2]],["Street life",liv]],
    [["Rent burden",-2*realR],["Job growth",1.5*dJ],["Transit",.8*dT],["Violent crime",-.6*dV],["Parks",.2*pk],["Sales tax",-tx*.8],["Your policies",pg[3]]],
    [["Violent crime",-2*dV],["Property tax",-2*p.propTax],["Parks",.3*pk],["Homelessness",-.3*dHome],["Sales tax",-tx*.6],["Your policies",pg[4]],["Street life",liv]],
    [["Violent crime",-1.5*dV],["Rent burden",-1.2*realR],["Parks",.6*pk],["Youth programs",.4*(p.youth-1)],["Sales tax",-tx*.8],["Your policies",pg[5]],["Street life",liv]]];
  const sat=T.map(t=>t.reduce((a,c)=>a+c[1],0));st.satTerms=T;
  const evt=shock(st,"approval");const deficit=m.reserve<0?-6:0;const honey=Math.max(0,6-st.q*.8)-.35*Math.max(0,st.q-4);
  const w=[cp.renters,1-cp.renters,.25,.3,.18,.25];let tot=0,ws=0;
  m.groups=sat.map((s,i)=>{const v=clamp(50+40*Math.tanh(1.6*s)+evt+deficit+honey+shock(st,"g"+i)+luck.approval,3,97);tot+=v*w[i];ws+=w[i];return (prev.groups?prev.groups[i]*.6:50*.6)+v*.4;});
  m.approval=clamp(.65*prev.approval+.35*(tot/ws),3,97);
  if(live)buildReport(st,prev,{gJ,jBiz,jPol,gR,rVac,rPol,inT,inC,exT,exC,hfPlaced,newUnits,buildM,luck,newTax,polCost});
  // expire shocks
  st.shocks.forEach(s=>s.q--);st.shocks=st.shocks.filter(s=>s.q>0);
  st.hist.push(snap(st));
}
SIM.step=(live,hooks)=>step(S,live,hooks);

/* ---------- quarterly report: what moved and why ---------- */
function buildReport(st,prev,x){
  const m=st.m,b=st.base;const r={q:st.q,lines:[],groups:[],surprises:(st.surprises||[]).splice(0),metrics:{}};
  const ch=(k)=>prev[k]?(m[k]-prev[k])/Math.abs(prev[k]):0;
  for(const k of ["approval","rent","homeless","violent","property","jobs","unemp","homeValue","congestion","transit","units","reserve"])r.metrics[k]={from:prev[k],to:m[k]};
  // crime drivers (change in each factor this quarter)
  const f=st.fac,pf=st.prevFac||f;const fl=[["Police staffing","police"],["Economy & unemployment","econ"],["Violence intervention","vio"],["Youth programs","youth"],["Street lighting","light"],["Parks","parks"],["Events & emergencies","events"],["Your policies","policies"],["Long-run trend","trend"],["Luck (unforeseen)","luck"]];
  r.crime=fl.map(([l,k])=>({l,v:(f[k]/(pf[k]||1)-1)})).filter(o=>Math.abs(o.v)>.002).sort((a,c)=>Math.abs(c.v)-Math.abs(a.v)).slice(0,4);
  r.crimeTotal=ch("violent");st.prevFac=Object.assign({},f);
  r.home={inflow:x.inT+x.inC,exits:x.exT+x.exC,hf:x.hfPlaced,net:m.homeless-prev.homeless};
  r.rent={total:x.gR,vacancy:x.rVac,jobs:.15*x.gJ,policy:x.rPol,luck:x.luck.rent,trend:b.rentTrend,newUnits:x.newUnits+prev.units*(st.cp.build||.002)*x.buildM};
  r.jobs={total:x.gJ,climate:x.jBiz,policy:x.jPol,luck:x.luck.jobs,base:b.jobGrowth};
  r.budget={rev:m.revenue,revPrev:prev.revenue,spend:m.spend,spendPrev:prev.spend,newTax:x.newTax,pol:x.polCost};
  // group approval: delta and the biggest reasons
  const T=st.satTerms,PT=st.prevSat||T;
  r.groups=GROUPS.map((g,i)=>{const d=m.groups[i]-(prev.groups&&prev.groups[i]!=null?prev.groups[i]:m.groups[i]);
    const rs=T[i].map((t,j)=>({l:t[0],v:t[1]-((PT[i]&&PT[i][j])?PT[i][j][1]:t[1]),lvl:t[1]})).filter(o=>Math.abs(o.v)>.004).sort((a,c)=>Math.abs(c.v)-Math.abs(a.v)).slice(0,2);
    const ev=shock(st,"g"+i);return {g,from:prev.groups?prev.groups[i]:m.groups[i],to:m.groups[i],d,reasons:rs,ev};});
  st.prevSat=T.map(t=>t.map(c=>c.slice()));
  // policy effectiveness reveals after two quarters
  r.reveals=[];for(const a of st.policies||[]){if(!a.on||a.revealed||st.q-a.q<2)continue;a.revealed=true;r.reveals.push({k:a.k,eff:a.eff});}
  for(const k of ["vio","police","youth","homeless","crisis","hf"]){st.revealed=st.revealed||{};if(st.revealed[k]||!st.eff||st.eff[k]==null)continue;const on={vio:st.pol.vio>0,crisis:st.pol.crisis>0,police:Math.abs(st.pol.police-1)>.04,youth:st.pol.youth>1.04,homeless:st.pol.homeless>1.05,hf:st.m.hfStock>0}[k];if(!on)continue;st.revOn=st.revOn||{};st.revOn[k]=(st.revOn[k]||0)+1;if(st.revOn[k]>=3){st.revealed[k]=true;r.reveals.push({k,eff:st.eff[k],lever:true});}}
  st.reports=st.reports||[];st.reports.push(r);if(st.reports.length>24)st.reports.shift();
}

/* ---------- enact / repeal policies ---------- */
SIM.enactPolicy=function(k,st){st=st||S;const d=POLICY[k];if(!d)return null;st.policies=st.policies||[];
  const ex=st.policies.find(a=>a.k===k);if(ex&&ex.on)return ex;
  const eff=st===S?+lognorm(rng((st.seed*7+st.q*131+k.length*977)>>>0),d.sd).toFixed(3):1;
  const a=ex||{k,q:st.q,eff};a.on=true;a.q=st.q;if(!ex)st.policies.push(a);
  if(d.fx.once)st.m.reserve-=d.fx.once*st.base.budget*(d.fx.once>0?1:a.eff);
  if(d.fx.parkAdd)st.m.parkScore+=d.fx.parkAdd*a.eff;if(d.street)st.m.unshel=Math.max(.02,st.m.unshel*(1-.08*a.eff));
  if(d.oneShot){a.on=d.fx.buildMul?true:false;}
  if(st===S)news(`Enacted: ${d.label}`,"Citywide","ok");return a;};
SIM.repealPolicy=function(k){const a=(S.policies||[]).find(x=>x.k===k);if(!a)return;a.on=false;const d=POLICY[k];
  for(const g in d.groups){const i=GKEY[g];if(i!=null&&d.groups[g]>0)S.shocks.push({k:"g"+i,v:-2,q:2});}news(`Repealed: ${d.label}`,"Citywide","deny");};
SIM.policyCost=k=>{const d=POLICY[k],B0=S.base.budget;return {once:(d.fx.once||0)*B0,annual:(d.fx.annual||0)*B0,revenue:(d.fx.revenue||0)*B0};};
SIM.issueBond=function(amtFrac){const B0=S.base.budget;const amt=B0*amtFrac;S.m.reserve+=amt;S.genBond=(S.genBond||0)+amt;S.shocks.push({k:"g1",v:-1.5,q:3},{k:"g2",v:-1,q:2});news(`Issued ${fmt$(amt)} in general obligation bonds`,"Citywide","warn");return amt;};

/* ---------- advisors: targeted pitches for groups that are slipping ---------- */
SIM.advisorPitches=function(){
  const m=S.m;const r=rng(S.seed*5+S.q*53);const out=[];const act=new Set((S.policies||[]).filter(a=>a.on||POLICY[a.k].oneShot).map(a=>a.k));
  const order=GROUPS.map((g,i)=>({g,i,v:m.groups[i],d:m.groups[i]-((S.hist[S.hist.length-2]||{}).groupsSnap||[])[i]||0})).sort((a,c)=>a.v-c.v);
  const used=new Set((S.advisors||[]).map(a=>a.k));
  const pick=(g)=>{const cand=Object.entries(POLICY).filter(([k,d])=>!act.has(k)&&!used.has(k)&&(d.groups[g]||0)>.05).map(([k,d])=>{const c=SIM.policyCost(k);const net=c.annual-c.revenue+c.once/4;
      return {k,d,score:d.groups[g]-Math.max(0,net)/S.base.budget*20+r()*.05-(m.reserve<0&&net>0?.2:0)};}).sort((a,c)=>c.score-a.score);return cand[0];};
  for(const o of order.slice(0,2)){const c=pick(o.g);if(!c)continue;used.add(c.k);const role=CAT_ADV[c.d.cat];
    const gain=Math.round(c.d.groups[o.g]*.55*40*1.6*.4),lo=Math.max(1,Math.round(gain*.5)),hi=Math.round(gain*1.6)+1;
    const costs=SIM.policyCost(c.k);
    out.push({id:"adv"+S.q+"_"+c.k,k:c.k,q:S.q,group:o.g,role,name:ADVISORS[role],
      pitch:`${o.g} are at ${Math.round(o.v)}%${o.v<45?" and slipping":""}. ${c.d.label} speaks directly to them. I'd expect roughly +${lo} to +${hi} points with ${o.g.toLowerCase()} within a year, though results vary.`,
      costTxt:[costs.once>0?fmt$(costs.once)+" up front":"",costs.once<0?"raises "+fmt$(-costs.once)+" once":"",costs.annual?fmt$(costs.annual)+"/yr":"",costs.revenue?"raises "+fmt$(costs.revenue)+"/yr":""].filter(Boolean).join(" · ")||"No direct cost"});}
  // budget director weighs in when money is tight
  if(m.reserve<S.base.budget*.03||m.revenue<m.spend*.985){const k=["vacancyTax","parking","landSale","tourism","headTax"].find(k=>!act.has(k)&&!used.has(k));
    if(k){const d=POLICY[k],costs=SIM.policyCost(k);out.push({id:"adv"+S.q+"_"+k,k,q:S.q,group:null,role:"Budget",name:ADVISORS.Budget,pitch:`We're running ${m.revenue<m.spend?"a "+fmt$(m.spend-m.revenue)+"/yr deficit":"thin on reserves"}. ${d.label} would bring in about ${fmt$(costs.revenue||-costs.once)}${costs.revenue?"/yr":""}. Expect pushback from ${Object.entries(d.groups).filter(([g,v])=>v<0).map(([g])=>g.toLowerCase()).join(" and ")||"a few corners"}.`,costTxt:costs.revenue?"Raises "+fmt$(costs.revenue)+"/yr":"Raises "+fmt$(-costs.once)+" once"});}}
  return out.slice(0,3);
};

/* ---------- forecasting: run the model forward with and without a decision ---------- */
SIM.forecast=function(apply,quarters){
  quarters=quarters||12;const keys=["rent","homeless","violent","jobs","congestion","transit","units","reserve","approval","homeValue","commute","unemp"];
  const run=(withIt,seed)=>{const st=clone(S);st.hist=[];st.inbox=[];st.news=[];st.reports=[];st.pressing=[];st.advisors=[];if(seed){st._noisy=true;st._noisySeed=seed;}if(withIt)apply(st);for(let i=0;i<quarters;i++)step(st,false);return st;};
  const a=run(false),b=run(true);const out={};for(const k of keys)out[k]={base:a.m[k],with:b.m[k]};out.idx={base:a.idx,with:b.idx};
  // range of outcomes: the same decision replayed under different luck
  const runs=[1,2,3,4,5].map(sd=>run(true,sd));for(const k of keys){const v=runs.map(r=>r.m[k]);out[k].lo=Math.min(...v);out[k].hi=Math.max(...v);}
  out.groups={base:a.m.groups,with:b.m.groups};return out;
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
  const SG={"Housing advocates":0,"Neighborhood association":1,"Business groups":2,"Downtown business district":2,"Construction unions":2,"Transit riders":3,"Drivers":1,"Families":5,"Community groups":0,"Police reform groups":3,"Homeowners":1};
  for(const [g,v] of Object.entries(p.support||{})){const gi=SG[g];if(gi!=null&&v)S.shocks.push({k:"g"+gi,v:v*2.5,q:3});}
  // execution risk: overruns, delays, under- or over-performance
  const rr=rng(S.seed*19+p.id*7919);const L={};
  if(proj.dur>2&&rr()<(p.type==="transit"?.4:.22)){const d=1+Math.floor(rr()*(p.type==="transit"?4:3));proj.dur+=d;L.delay=d;}
  if((proj.bond||p.type==="park")&&rr()<(p.type==="transit"?.45:.25)){const o=.1+rr()*(p.type==="transit"?.6:.35);L.overrun=o;const extra=(proj.bond||((p.cost&&p.cost.city)||0))*o;if(proj.bond)proj.bond+=extra;else S.m.reserve-=extra;}
  if(proj.riders){const f=lognorm(rr,.3);proj.riders=Math.round(proj.riders*f);L.riders=f;}
  if(proj.units&&p.type!=="housing"){const f=clamp(lognorm(rr,.15),.75,1.2);proj.units=Math.round(proj.units*f);}
  if(Object.keys(L).length){proj.luck=L;const bits=[];if(L.delay)bits.push(`${L.delay} quarter${L.delay>1?"s":""} behind schedule`);if(L.overrun)bits.push(`${Math.round(L.overrun*100)}% over budget`);
    if(bits.length)(S.surprises=S.surprises||[]).push({t:p.title,bad:true,text:`Now ${bits.join(" and ")}.`});}
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
// civic & social events that can hit any city. "risk" = chance a choice backfires: [probability, effects, what happened]
Object.assign(EV,{
 shooting:{t:"Mass shooting in a nightlife district",d:"Five people are killed and a dozen wounded outside a bar on a Saturday night. The city wants to hear from you.",ch:[
   {l:"Visit victims, fund trauma care and violence interrupters",cost:.0008,fx:[["violentMul",.985,3],["approval",2,2]],g:{Families:2,Renters:1}},
   {l:"Surge police into nightlife areas",cost:.0012,fx:[["violentMul",.975,2]],g:{Homeowners:3,Businesses:2,"Young adults":-2},risk:[.3,[["approval",-3,2],["g3",-4,3]],"A heavy-handed stop during the surge went viral and sparked protests."]},
   {l:"Push the state for tougher gun laws",cost:0,fx:[["approval",1,1]],g:{"Young adults":2,Renters:1},risk:[.55,[["approval",-2,2]],"The bill died in committee; critics said you offered words, not action."]}]},
 officer:{t:"Police shooting sparks protests",d:"An officer shoots an unarmed man during a traffic stop. Protesters fill downtown for three nights.",ch:[
   {l:"Release bodycam video now, order an independent probe",cost:.0003,fx:[],g:{"Young adults":4,Renters:3,Homeowners:-2},risk:[.25,[["violentMul",1.02,3]],"Officers called in sick for a week in protest; response times slipped."]},
   {l:"Stand behind the officers pending review",cost:0,fx:[],g:{Homeowners:3,"Young adults":-5,Renters:-3},risk:[.4,[["approval",-4,2],["revenue",-.0008,1]],"Protests escalated; downtown businesses boarded up for a week."]},
   {l:"Call for calm, wait for the investigation",cost:0,fx:[["approval",-1,2]],g:{},risk:[.35,[["approval",-3,2]],"The silence read as indifference to many residents."]}]},
 overdose:{t:"Overdose deaths spike",d:"A potent fentanyl batch kills 40 people in a month.",ch:[
   {l:"Open a supervised consumption site",cost:.0006,fx:[["homelessMul",.99,4]],g:{Renters:2,"Young adults":2,Homeowners:-3},risk:[.35,[["approval",-2,2]],"Federal prosecutors threatened charges; the site's opening stalled."]},
   {l:"Expand treatment beds and naloxone everywhere",cost:.0015,fx:[["approval",2,2]],g:{Families:2,Seniors:2}},
   {l:"Enforcement crackdown on open-air drug markets",cost:.001,fx:[["propertyMul",.98,3]],g:{Businesses:3,Homeowners:2,"Young adults":-2},risk:[.3,[["homelessMul",1.02,3]],"Dealers simply moved a few blocks; jails filled up."]}]},
 encampFire:{t:"Fire tears through a large encampment",d:"No one dies, but dozens lose everything and smoke shuts a freeway ramp.",ch:[
   {l:"Clear it with shelter offers for everyone",cost:.0008,fx:[],g:{Homeowners:3,Businesses:3,Renters:-1},risk:[.4,[["homelessMul",1.01,2]],"There weren't enough shelter beds; most people resettled nearby."]},
   {l:"Bring in sanitation, services and fire safety",cost:.0004,fx:[],g:{Renters:1,Homeowners:-2,Businesses:-2}}]},
 corruption:{t:"Department head indicted for bribery",d:"Prosecutors say your buildings commissioner took kickbacks for permits.",ch:[
   {l:"Fire him and order a full audit",cost:.0003,fx:[["approval",1,2]],g:{}},
   {l:"Defend him until the trial",cost:0,fx:[],g:{},risk:[.6,[["approval",-7,3]],"New wiretap evidence surfaced. Your defense became the story."]}]},
 teachers:{t:"Teachers threaten to strike",d:"The district and union are far apart on pay and class sizes. The city's share of school funding is on the table.",ch:[
   {l:"Put city money on the table to settle",cost:.0025,fx:[],g:{Families:4,Seniors:-1}},
   {l:"Stay out of it",cost:0,fx:[],g:{},risk:[.55,[["g5",-8,3],["approval",-3,2]],"Teachers walked out for nine days. Parents blamed City Hall."]}]},
 transitChaos:{t:"Viral video of chaos on transit",d:"Footage of fights and drug use on a train racks up millions of views.",ch:[
   {l:"Transit ambassadors and police on trains",cost:.0006,fx:[["transitMul",1.01,3]],g:{Seniors:2,Families:1}},
   {l:"Ride the train with reporters, defend the system",cost:0,fx:[],g:{"Young adults":1},risk:[.5,[["transitMul",.97,3],["approval",-2,2]],"Another incident happened the next week. Ridership dipped."]}]},
 stadium:{t:"Pro team threatens to leave",d:"The owner wants public money for a new stadium or will move the team.",ch:[
   {l:"Offer a public subsidy deal",cost:.012,fx:[["jobs",.0006,2]],g:{Businesses:4,Renters:-2,"Young adults":-1}},
   {l:"Refuse public money",cost:0,fx:[],g:{Renters:2},risk:[.3,[["g2",-6,4],["revenue",-.001,4],["approval",-3,3]],"The team announced it is moving. Fans are furious."]}]},
 ransomware:{t:"Ransomware cripples city systems",d:"Hackers lock 311, permitting and payroll and demand $5M.",ch:[
   {l:"Pay the ransom",cost:.0004,fx:[],g:{},risk:[.4,[["approval",-4,2]],"Systems came back, then the stolen data leaked anyway."]},
   {l:"Refuse and rebuild systems",cost:.002,fx:[["approval",1,1]],g:{Businesses:-1}}]},
 bridge:{t:"Inspectors close a major bridge",d:"Cracks in a 1960s span force an emergency closure. Traffic is backed up for miles.",ch:[
   {l:"Emergency repair contract, around the clock",cost:.004,fx:[["congMul",1.02,1]],g:{Homeowners:2,Businesses:2}},
   {l:"Standard repair timeline",cost:.0015,fx:[["congMul",1.06,4]],g:{Homeowners:-2,Businesses:-3},risk:[.3,[["congMul",1.04,4]],"Contractors found more damage; the closure doubled in length."]}]},
 rentProtest:{t:"Tenant march on City Hall",d:"Thousands rally over rent hikes and evictions, demanding you act.",ch:[
   {l:"Meet tenant leaders, promise action",cost:0,fx:[],g:{Renters:3,"Young adults":2,Homeowners:-1},risk:[.4,[["g0",-5,3]],"Tenants say nothing changed. Trust fell further."]},
   {l:"Fast-track eviction defense funding",cost:.001,fx:[["homelessMul",.99,4]],g:{Renters:4,"Young adults":2}},
   {l:"Ignore it",cost:0,fx:[],g:{Renters:-4,"Young adults":-3}}]},
 homeInvasion:{t:"High-profile home invasions",d:"A string of violent break-ins in a quiet neighborhood dominates local news.",ch:[
   {l:"Detective task force and neighborhood patrols",cost:.0008,fx:[["propertyMul",.985,3]],g:{Homeowners:4,Seniors:3}},
   {l:"Point to falling citywide crime numbers",cost:0,fx:[],g:{},risk:[.5,[["g1",-6,3],["g4",-5,3]],"Residents felt dismissed; a recall petition started circulating."]}]},
 waterMain:{t:"Water main break floods downtown",d:"A 100-year-old main bursts, flooding streets and subway entrances.",ch:[
   {l:"Repair it and fund a pipe replacement program",cost:.003,fx:[],g:{Businesses:2,Homeowners:1}},
   {l:"Patch it",cost:.0005,fx:[],g:{},risk:[.35,[["approval",-3,2],["jobs",-.001,1]],"Another main burst a month later two blocks away."]}]},
 startup:{t:"Local startup raises $2 billion",d:"A homegrown company plans to triple its local headcount.",ch:[{l:"Great news",cost:0,fx:[["jobs",.0025,2],["rent",.002,2]],g:{Businesses:2,"Young adults":2}}],good:true},
 festival:{t:"Music festival draws record crowds",d:"Hotels sell out and restaurants have their best weekend in years.",ch:[{l:"Great news",cost:0,fx:[["revenue",.0015,1]],g:{Businesses:2}}],good:true},
 potholes:{season:[1],t:"Pothole crisis after a rough winter",d:"Complaints to 311 are up 300%; drivers are furious.",ch:[
   {l:"Pothole blitz with overtime crews",cost:.0008,fx:[],g:{Homeowners:2,Businesses:1}},
   {l:"Normal schedule",cost:0,fx:[],g:{Homeowners:-3,Businesses:-1}}]},
 scandalText:{t:"Leaked texts embarrass your office",d:"Your deputy mocked a council member in texts that just went public.",ch:[
   {l:"Accept the resignation, apologize",cost:0,fx:[["approval",-1,1]],g:{}},
   {l:"Keep the deputy, call it a private conversation",cost:0,fx:[],g:{},risk:[.5,[["approval",-5,2]],"More texts leaked. The council stalled your agenda for weeks."]}]}
});
const DISASTERS=new Set(["noreaster","surge","vortex","lakeflood","quake","atmos","smoke","snow","heatdome","heat","kingtide","drought"]);
const SOCIAL=["shooting","officer","overdose","encampFire","corruption","teachers","transitChaos","stadium","ransomware","bridge","rentProtest","homeInvasion","waterMain","startup","festival","potholes","scandalText"];
SIM.EV=EV;
SIM.rollEvents=function(){
  const C=GEO.cities[S.key];const r=rng(S.seed*3+S.q*17);if(S.q===0)return [];
  const ok=k=>{const e=EV[k];if(!e)return false;if(e.season&&!e.season.includes(S.q%4))return false;if(S.eventLog.slice(-6).includes(k))return false;if(k==="recession"&&S.eventLog.includes(k))return false;return true;};
  const out=[];const take=list=>{const pool=list.filter(ok);if(!pool.length)return;const k=pool[Math.floor(r()*pool.length)];S.eventLog.push(k);out.push({k,e:EV[k],id:"ev"+S.q+"_"+k});};
  const local=C.events.concat(["recession"]);
  if(r()<.06)take(local.filter(k=>DISASTERS.has(k)));              // disasters: rare
  if(r()<.62)take(SOCIAL.concat(local.filter(k=>!DISASTERS.has(k)))); // civic, economic and social events: common
  if(out.length<2&&r()<.18)take(SOCIAL);
  return out;
};
SIM.rollEvent=()=>SIM.rollEvents()[0]||null;
SIM.resolveEvent=function(ev,i){
  const c=ev.e.ch[i];const cost=c.cost==="fed"?S.base.budget*.25*.08*.25:(c.cost||0)*S.base.budget;S.m.reserve-=cost;
  const push=fx=>{for(const [k,v,q] of fx){S.shocks.push({k,v:k==="revenue"?v*S.base.budget*4:v,q});}};
  push(c.fx);for(const g in c.g||{}){const gi=GKEY[g];if(gi!=null)S.shocks.push({k:"g"+gi,v:c.g[g],q:3});}
  let outcome=null;if(c.risk){const r=rng(S.seed*11+S.q*373+i*29+ev.k.length);if(r()<c.risk[0]){push(c.risk[1]);outcome={bad:true,t:c.risk[2]};}else outcome={bad:false,t:"It worked out: the risk you took didn't materialize."};}
  S.pressing=(S.pressing||[]).filter(x=>x.id!==ev.id);
  if(outcome){(S.surprises=S.surprises||[]).push({t:ev.e.t,choice:c.l,bad:outcome.bad,text:outcome.t});}
  if(ev.k==="surge"||ev.k==="kingtide"){if(S.resilience){S.shocks.push({k:"approval",v:2,q:2});news("Resilience upgrades limited flood damage","Waterfront","ok");}}
  news(`${ev.e.t}: ${c.l}`,"Citywide",ev.e.good?"ok":"warn");
  if(outcome&&outcome.bad)news(outcome.t,"Citywide","warn");return outcome;
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
 {k:"bizTax",label:"Business tax rate change",min:-.2,max:.2,step:.05,fmt:v=>(v>=0?"+":"")+Math.round(v*100)+"%",note:"Higher taxes raise revenue but weaken the business climate."},
 {k:"salesTax",label:"Local sales tax",min:-.5,max:1.5,step:.25,fmt:v=>(v>=0?"+":"")+v.toFixed(2)+" pts",note:"Each point raises ~2% of the budget. Regressive: renters and young adults feel it; retail hiring slows slightly."},
 {k:"hotelTax",label:"Hotel & visitor tax",min:0,max:5,step:1,fmt:v=>"+"+v+" pts",note:"Visitors pay most of it. Each point raises ~0.3% of the budget; hotels and tourism businesses push back."},
 {k:"fees",label:"Permit, parking & service fees",min:0,max:.5,step:.1,fmt:v=>"+"+Math.round(v*100)+"%",note:"Quick revenue; homeowners and businesses notice."}];
SIM.setLever=(k,v)=>{S.pol[k]=v;};
SIM.leverCost=function(k,v){const b=S.base,cp=S.cp;const B0=b.budget;switch(k){case"police":return B0*cp.policeShare*(v-1);case"homeless":return B0*cp.homeShare*(v-1);case"transit":return B0*cp.transitShare*(v-1);case"parks":return B0*.015*(v-1);case"youth":return B0*.03*(v-1);case"rentAssist":return B0*.0012*v;case"vio":return B0*.0008*[0,1,1.8,2.5][v];case"crisis":return B0*.001*v;case"propTax":return -B0*b.taxBase*v;case"bizTax":return -B0*.42*v*.85;case"salesTax":return -B0*.02*v;case"hotelTax":return -B0*.0028*v;case"fees":return -B0*.025*v;}return 0;};
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
