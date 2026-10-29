/* City geography + real baselines. Coordinates are [lat, lon]; distances in meters.
   Shorelines, street grids and landmark positions are hand-traced approximations of the real city. */
(function(){
"use strict";
const ord=n=>{const s=["th","st","nd","rd"],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
const G={ord,cities:{}};

/* ======================= NEW YORK ======================= */
(function(){
const M=80.2; // Manhattan street spacing along avenues (m)
const nU=n=>(n-14)*M;
const uLines=[];
for(let n=1;n<=100;n++){
  const wide=[14,23,34,42,57,59,72,79,86,96].includes(n);
  uLines.push({p:nU(n),w:wide?30:18,name:(v)=>n===59&&v<0&&v>-860?"Central Park S":(v<0?"W ":"E ")+ord(n)+" St"});
}
const R=(a,b)=>[nU(a)-40,nU(b)+40];
const vLines=[
 {p:-1940,w:32,r:R(17,59),name:"12th Ave"},
 {p:-1670,w:30,r:R(14,99),name:[[58.5,"11th Ave"],[1e9,"West End Ave"]]},
 {p:-1400,w:30,r:R(14,99),name:[[58.5,"10th Ave"],[1e9,"Amsterdam Ave"]]},
 {p:-1130,w:30,r:R(14,99),name:[[58.5,"9th Ave"],[1e9,"Columbus Ave"]]},
 {p:-860,w:30,r:R(14,99),name:[[58.5,"8th Ave"],[1e9,"Central Park W"]]},
 {p:-585,w:30,r:R(14,59),name:"7th Ave"},
 {p:-310,w:30,r:R(14,59),name:"6th Ave"},
 {p:0,w:30,r:R(8,99),name:"5th Ave"},
 {p:150,w:25,r:R(23,99),name:"Madison Ave"},
 {p:300,w:40,r:R(8,99),name:[[nU(13.5),"4th Ave"],[nU(31.5),"Park Ave S"],[1e9,"Park Ave"]]},
 {p:450,w:25,r:R(21,99),name:"Lexington Ave"},
 {p:660,w:30,r:R(8,99),name:"3rd Ave"},
 {p:870,w:30,r:R(1,99),name:"2nd Ave"},
 {p:1080,w:30,r:R(1,99),name:"1st Ave"},
 {p:1300,w:28,r:R(60,99),name:"York Ave"},
 {p:1290,w:25,r:R(1,14),name:"Avenue A"},
 {p:1480,w:25,r:R(1,13),name:"Avenue B"},
 {p:1670,w:25,r:R(1,13),name:"Avenue C"},
 {p:1860,w:25,r:R(1,12),name:"Avenue D"}];
const polys={
 MAN:[[40.7003,-74.0150],[40.7055,-74.0190],[40.7140,-74.0178],[40.7230,-74.0135],[40.7330,-74.0112],[40.7420,-74.0108],[40.7520,-74.0095],[40.7600,-74.0045],[40.7700,-73.9960],[40.7800,-73.9890],[40.7860,-73.9850],[40.7860,-73.9420],[40.7750,-73.9450],[40.7650,-73.9530],[40.7580,-73.9585],[40.7500,-73.9665],[40.7440,-73.9712],[40.7370,-73.9735],[40.7280,-73.9712],[40.7200,-73.9735],[40.7135,-73.9770],[40.7110,-73.9800],[40.7100,-73.9900],[40.7085,-73.9985],[40.7060,-74.0030],[40.7035,-74.0080],[40.7010,-74.0115]],
 BKQ:[[40.6840,-74.0060],[40.6930,-74.0020],[40.7000,-73.9975],[40.7035,-73.9930],[40.7035,-73.9850],[40.7015,-73.9780],[40.7050,-73.9720],[40.7085,-73.9690],[40.7160,-73.9650],[40.7230,-73.9615],[40.7300,-73.9600],[40.7370,-73.9612],[40.7430,-73.9605],[40.7500,-73.9550],[40.7570,-73.9480],[40.7650,-73.9420],[40.7750,-73.9370],[40.7860,-73.9300],[40.7860,-73.8900],[40.6840,-73.8900]],
 NJ:[[40.6840,-74.0600],[40.6950,-74.0480],[40.7050,-74.0365],[40.7165,-74.0325],[40.7270,-74.0300],[40.7360,-74.0272],[40.7450,-74.0248],[40.7530,-74.0238],[40.7620,-74.0185],[40.7720,-74.0115],[40.7860,-74.0015],[40.7860,-74.0900],[40.6840,-74.0900]],
 GOV:[[40.6935,-74.0175],[40.6905,-74.0115],[40.6860,-74.0160],[40.6865,-74.0255],[40.6900,-74.0250]],
 ROOS:[[40.7525,-73.9585],[40.7720,-73.9440],[40.7740,-73.9455],[40.7545,-73.9600]],
 LOWERMAN:[[40.7240,-74.0200],[40.7225,-74.0110],[40.7192,-74.0020],[40.7135,-74.0040],[40.7110,-74.0000],[40.7080,-73.9960],[40.6950,-73.9960],[40.6950,-74.0200]]
};
G.cities.nyc={
 key:"nyc",name:"New York",state:"NY",area:"All of Manhattan · Brooklyn & Queens waterfront",center:[40.785,-73.968],ext:11000,oq:.5,seed:11,
 landMode:"land",land:["MAN","BKQ","NJ","GOV","ROOS"],water:[],polys,
 rivers:[{pts:[[40.7375,-73.9612],[40.7372,-73.9500],[40.7330,-73.9400],[40.7300,-73.9300]],w:60}],
 parks:[
  {grid:"man",u:[nU(59.45),1e9],v:[-845,-15]},
  {ll:[40.7030,-74.0168],r:210},{ll:[40.7127,-74.0059],r:95},{ll:[40.7308,-73.9973],r:105},{ll:[40.7359,-73.9906],r:75},
  {ll:[40.7420,-73.9877],r:80},{ll:[40.7536,-73.9832],r:85},{ll:[40.7265,-73.9815],r:105},{ll:[40.7337,-73.9840],r:65},
  {ll:[40.7155,-73.9997],r:65},{ll:[40.7207,-73.9516],r:200},{ll:[40.6914,-73.9750],r:170},{ll:[40.7455,-73.9580],r:80},
  {poly:"GOV"},{line:[[40.7140,-73.9772],[40.7280,-73.9722]],w:140},{line:[[40.6935,-74.0010],[40.7040,-73.9905]],w:110},
  {line:[[40.7060,-74.0186],[40.7330,-74.0112],[40.7600,-74.0042]],w:45},{ll:[40.6940,-74.0560],r:520}],
 regions:[
  {id:"man",origin:[40.7360,-73.9937],angle:29,uLines,vLines,fillU:0,fillV:0,marks:true,
   test:H=>H.in("MAN")&&H.u>nU(0.6)&&(H.u>=nU(13.6)||H.v>=630)},
  {id:"village",angle:12,pitch:[85,125,15],test:H=>H.in("MAN")&&H.lat>40.7255},
  {id:"soho",angle:29,pitch:[70,115,14],test:H=>H.in("MAN")&&H.lat>40.7115},
  {id:"fidi",angle:42,pitch:[62,95,12],test:H=>H.in("MAN")},
  {id:"wburg",angle:25,pitch:[75,180,16],test:H=>H.in("BKQ")&&H.lat>40.7035&&H.lat<40.7375},
  {id:"lic",angle:45,pitch:[90,160,18],test:H=>H.in("BKQ")&&H.lat>=40.7375},
  {id:"bk",angle:20,pitch:[85,150,16],test:H=>H.in("BKQ")},
  {id:"hob",angle:2,pitch:[70,130,15],test:H=>H.in("NJ")&&H.lat>=40.7290},
  {id:"jc",angle:-8,pitch:[90,160,16],test:H=>H.in("NJ")},
  {id:"roos",angle:29,pitch:[110,60,12],test:H=>H.in("ROOS")}],
 roads:[
  {n:"Broadway",w:28,pts:[[40.7049,-74.0137],[40.7090,-74.0106],[40.7127,-74.0072],[40.7160,-74.0050],[40.7190,-74.0021],[40.7253,-73.9968],[40.7300,-73.9926],[40.7330,-73.9912],[40.7360,-73.9905],[40.7418,-73.9894],[40.7497,-73.9877],[40.7564,-73.9862],[40.7620,-73.9840],[40.7681,-73.9819],[40.7745,-73.9820],[40.7860,-73.9800]]},
  {n:"Bowery",w:28,pts:[[40.7149,-73.9970],[40.7180,-73.9945],[40.7225,-73.9930],[40.7260,-73.9915],[40.7293,-73.9897]]},
  {n:"Canal St",w:26,pts:[[40.7225,-74.0115],[40.7210,-74.0060],[40.7190,-74.0020],[40.7180,-73.9990],[40.7165,-73.9960]]},
  {n:"Houston St",w:30,pts:[[40.7287,-74.0105],[40.7273,-74.0050],[40.7260,-74.0010],[40.7253,-73.9968],[40.7240,-73.9925],[40.7222,-73.9860],[40.7205,-73.9800],[40.7190,-73.9760]]},
  {n:"Delancey St",w:30,pts:[[40.7203,-73.9930],[40.7183,-73.9870],[40.7165,-73.9810]]},
  {n:"Chambers St",w:20,pts:[[40.7175,-74.0135],[40.7150,-74.0075],[40.7135,-74.0035]]},
  {n:"Wall St",w:14,pts:[[40.7072,-74.0110],[40.7060,-74.0085],[40.7045,-74.0055]]},
  {n:"Fulton St",w:16,pts:[[40.7105,-74.0125],[40.7095,-74.0080],[40.7075,-74.0030]]},
  {n:"6th Ave",w:28,pts:[[40.7373,-73.9969],[40.7310,-74.0010],[40.7260,-74.0035],[40.7195,-74.0050]]},
  {n:"Church St",w:22,pts:[[40.7195,-74.0050],[40.7110,-74.0105]]},
  {n:"7th Ave S",w:26,pts:[[40.7385,-73.9998],[40.7335,-74.0030],[40.7285,-74.0050],[40.7230,-74.0060],[40.7195,-74.0070]]},
  {n:"West St",w:40,hwy:true,pts:[[40.7030,-74.0158],[40.7100,-74.0150],[40.7180,-74.0127],[40.7250,-74.0112],[40.7330,-74.0098],[40.7420,-74.0093],[40.7520,-74.0080],[40.7600,-74.0030],[40.7700,-73.9947],[40.7860,-73.9840]]},
  {n:"FDR Dr",w:34,hwy:true,pts:[[40.7012,-74.0105],[40.7060,-74.0025],[40.7095,-73.9900],[40.7120,-73.9790],[40.7200,-73.9746],[40.7280,-73.9722],[40.7370,-73.9746],[40.7440,-73.9724],[40.7500,-73.9677],[40.7580,-73.9597],[40.7650,-73.9542],[40.7750,-73.9462],[40.7860,-73.9432]]},
  {n:"BQE",w:36,hwy:true,pts:[[40.6860,-73.9985],[40.6950,-73.9960],[40.6985,-73.9890],[40.7000,-73.9750],[40.7090,-73.9560],[40.7240,-73.9450],[40.7380,-73.9330],[40.7500,-73.9200]]},
  {n:"Atlantic Ave",w:26,pts:[[40.6905,-73.9985],[40.6880,-73.9890],[40.6845,-73.9776]]},
  {n:"Flatbush Ave",w:30,pts:[[40.6990,-73.9850],[40.6905,-73.9810],[40.6845,-73.9776]]},
  {n:"Bedford Ave",w:22,pts:[[40.7240,-73.9515],[40.7140,-73.9595],[40.7010,-73.9605]]},
  {n:"Metropolitan Ave",w:24,pts:[[40.7155,-73.9620],[40.7140,-73.9400],[40.7135,-73.9200]]},
  {n:"Jackson Ave",w:26,pts:[[40.7420,-73.9540],[40.7480,-73.9420],[40.7500,-73.9370]]},
  {n:"Queens Blvd",w:40,pts:[[40.7490,-73.9380],[40.7420,-73.9200],[40.7400,-73.9000]]},
  {n:"Vernon Blvd",w:22,pts:[[40.7420,-73.9535],[40.7550,-73.9460],[40.7650,-73.9390]]},
  {n:"Grand St",w:22,pts:[[40.7220,-74.0040],[40.7190,-73.9940],[40.7165,-73.9840]]},
  {n:"Christopher Columbus Dr",w:24,pts:[[40.7170,-74.0340],[40.7170,-74.0480],[40.7180,-74.0620]]},
  {n:"Washington St",w:20,pts:[[40.7360,-74.0300],[40.7520,-74.0255]]}],
 landmarks:[
  {n:"One World Trade Center",ll:[40.7127,-74.0134],h:541,w:62,shape:"obelisk",roof:417},
  {n:"3 World Trade Center",ll:[40.7111,-74.0117],h:329,w:48,shape:"glass"},
  {n:"4 World Trade Center",ll:[40.7101,-74.0119],h:298,w:46,shape:"glass"},
  {n:"7 World Trade Center",ll:[40.7135,-74.0122],h:228,w:50,shape:"glass"},
  {n:"70 Pine",ll:[40.7063,-74.0076],h:290,w:36,shape:"spire"},
  {n:"40 Wall Street",ll:[40.7069,-74.0094],h:283,w:38,shape:"spire"},
  {n:"8 Spruce",ll:[40.7110,-74.0057],h:265,w:42,shape:"taper"},
  {n:"Woolworth Building",ll:[40.7124,-74.0082],h:241,w:44,shape:"spire"},
  {n:"Empire State Building",ll:[40.7484,-73.9857],h:443,w:60,shape:"esb",roof:381},
  {n:"One Vanderbilt",ll:[40.7531,-73.9786],h:427,w:52,shape:"taper"},
  {n:"Chrysler Building",ll:[40.7516,-73.9755],h:319,w:40,shape:"chrysler"},
  {n:"270 Park Ave",ll:[40.7558,-73.9755],h:423,w:52,shape:"glass"},
  {n:"Bank of America Tower",ll:[40.7556,-73.9845],h:366,w:50,shape:"spire"},
  {n:"432 Park Ave",ll:[40.7616,-73.9719],h:426,w:28,shape:"slab"},
  {n:"Central Park Tower",ll:[40.7663,-73.9810],h:472,w:40,shape:"glass"},
  {n:"111 West 57th",ll:[40.7647,-73.9776],h:435,w:18,shape:"taper"},
  {n:"One57",ll:[40.7654,-73.9790],h:306,w:36,shape:"glass"},
  {n:"53W53",ll:[40.7614,-73.9776],h:320,w:30,shape:"taper"},
  {n:"New York Times Building",ll:[40.7564,-73.9900],h:319,w:48,shape:"spire"},
  {n:"30 Hudson Yards",ll:[40.7539,-74.0011],h:387,w:58,shape:"glass"},
  {n:"35 Hudson Yards",ll:[40.7562,-74.0026],h:308,w:40,shape:"glass"},
  {n:"One Manhattan West",ll:[40.7524,-73.9991],h:303,w:50,shape:"glass"},
  {n:"30 Rockefeller Plaza",ll:[40.7593,-73.9794],h:259,w:34,d:95,shape:"stepped"},
  {n:"MetLife Building",ll:[40.7536,-73.9767],h:246,w:85,d:45,shape:"box"},
  {n:"Citigroup Center",ll:[40.7585,-73.9701],h:279,w:48,shape:"taper"},
  {n:"Madison Square Garden",ll:[40.7505,-73.9934],h:45,w:130,shape:"arena"},
  {n:"Brooklyn Tower",ll:[40.6898,-73.9837],h:325,w:40,shape:"taper"},
  {n:"Skyline Tower",ll:[40.7470,-73.9437],h:237,w:38,shape:"glass"},
  {n:"99 Hudson Street",ll:[40.7167,-74.0360],h:270,w:40,shape:"glass"}],
 bridges:[
  {n:"Brooklyn Bridge",a:[40.7110,-74.0010],b:[40.7020,-73.9905],deck:41,tower:84,kind:"susp",stone:true},
  {n:"Manhattan Bridge",a:[40.7155,-73.9945],b:[40.6995,-73.9855],deck:41,tower:102,kind:"susp"},
  {n:"Williamsburg Bridge",a:[40.7165,-73.9830],b:[40.7120,-73.9590],deck:41,tower:101,kind:"susp"},
  {n:"Queensboro Bridge",a:[40.7590,-73.9622],b:[40.7520,-73.9400],deck:40,tower:105,kind:"cant"}],
 hoods:[["Financial District",40.7075,-74.0090],["Battery Park City",40.7115,-74.0165],["Tribeca",40.7180,-74.0090],["Chinatown",40.7158,-73.9970],["SoHo",40.7233,-74.0010],["Lower East Side",40.7150,-73.9860],["Greenwich Village",40.7336,-74.0027],["East Village",40.7265,-73.9815],["Chelsea",40.7465,-74.0014],["Flatiron",40.7410,-73.9897],["Gramercy",40.7368,-73.9845],["Murray Hill",40.7479,-73.9757],["Hell's Kitchen",40.7638,-73.9918],["Midtown",40.7549,-73.9840],["Upper East Side",40.7736,-73.9566],["Upper West Side",40.7810,-73.9790],["Central Park",40.7750,-73.9690],["DUMBO",40.7033,-73.9881],["Brooklyn Heights",40.6960,-73.9950],["Williamsburg",40.7081,-73.9571],["Greenpoint",40.7300,-73.9510],["Long Island City",40.7447,-73.9485],["Jersey City",40.7178,-74.0431],["Hoboken",40.7440,-74.0324],["Hudson Yards",40.7540,-74.0010],["Roosevelt Island",40.7620,-73.9500],["Two Bridges",40.7110,-73.9900]],
 industrial:[{ll:[40.7010,-73.9710],r:450},{ll:[40.7360,-73.9450],r:500},{ll:[40.7000,-74.0560],r:500}],
 hills:[{ll:[40.7480,-73.9800],h:12,r:1600},{ll:[40.7700,-73.9600],h:12,r:1500},{ll:[40.6960,-73.9950],h:14,r:450},{ll:[40.7480,-74.0400],h:20,r:700}],
 elev:{b:1.8,slope:.012,cap:8},
 centers:[[40.7075,-74.0090,210,550],[40.7120,-74.0130,180,380],[40.7560,-73.9820,230,950],[40.7540,-74.0010,170,420],[40.7650,-73.9780,190,420],[40.7440,-73.9900,90,700],[40.7720,-73.9580,70,1000],[40.7820,-73.9800,60,900],[40.7350,-74.0000,30,900],[40.7200,-73.9850,25,900],[40.6930,-73.9850,140,480],[40.7470,-73.9480,120,480],[40.7130,-73.9620,40,800],[40.7180,-74.0360,150,480],[40.7420,-74.0300,25,700]],
 base:13,hMul:1.25,towerP:1.15,
 style:{lotW:[7,13],depth:[16,26],side:4.5,house:false,tank:.38,glass:1,setback:.55,trees:.42,palette:"nyc",office:1},
 baseline:{pop:8478000,hhIncome:79713,unemp:5.3,homeValue:703649,rent:3500,homeless:125683,unsheltered:.04,violent:656.5,property:2272.9,budget:115.9,police:33500,transit:5200000,carShare:.27,commute:41.2,congestion:48.8,jobs:4800000,vacancy:.014,age:[.20,.25,.39,.16],income:[.35,.40,.25],jobGrowth:.0035,rentTrend:.008,taxBase:.30},
 sources:{homeless:"NYC CoC 2025 point-in-time count (via USAFacts)",crime:"FBI 2025 (via Security.org)",homeValue:"Zillow ZHVI, metro, Dec 2025",congestion:"TomTom Traffic Index 2025: 48.8%, #4 in US"},
 validation:{district:{poly:"LOWERMAN",within:"MAN",name:"Lower Manhattan",res:70761,jobs:257187,jobsNote:"private-sector jobs",src:"NY State Comptroller, Sept 2026 (2024 data)"},t150:324,t100:897,note:"citywide; the model covers the core where most towers stand"},
 events:["noreaster","surge","heat","subway","asylum","bonus","fedcut","tourism","strike"]
};})();

/* ======================= CHICAGO ======================= */
(function(){
const A=2.0117; // meters per address unit (800 per mile)
const ns=(a,name,w)=>({p:a*A,w:w||18,name});
const uLines=[ns(2400,"Fullerton Ave",30),ns(2000,"Armitage Ave",25),ns(1600,"North Ave",30),ns(1200,"Division St",28),ns(1000,"Oak St",18),ns(800,"Chicago Ave",28),ns(730,"Superior St"),ns(700,"Huron St"),ns(660,"Erie St"),ns(628,"Ontario St",22),ns(600,"Ohio St",22),ns(530,"Grand Ave",25),ns(500,"Illinois St",20),ns(430,"Hubbard St"),ns(400,"Kinzie St",20),ns(200,"Lake St",22),ns(150,"Randolph St",28),ns(100,"Washington St",22),ns(0,"Madison St",28),ns(-100,"Monroe St",25),ns(-200,"Adams St",22),ns(-300,"Jackson Blvd",28),ns(-400,"Van Buren St",22),ns(-500,"Ida B. Wells Dr",40),ns(-600,"Harrison St",22),ns(-800,"Polk St",22),ns(-1000,"Taylor St",22),ns(-1200,"Roosevelt Rd",32),ns(-1600,"16th St",22),ns(-1800,"18th St",22),ns(-2200,"Cermak Rd",30)];
const vLines=[ns(300,"Columbus Dr",28),ns(100,"Michigan Ave",36),ns(48,"Wabash Ave",22),ns(0,"State St",30),ns(-36,"Dearborn St",22),ns(-100,"Clark St",25),ns(-140,"LaSalle St",28),ns(-200,"Wells St",24),ns(-300,"Franklin St",22),ns(-500,"Canal St",25),ns(-540,"Clinton St",22),ns(-600,"Jefferson St",22),ns(-650,"Desplaines St",22),ns(-800,"Halsted St",30),ns(-900,"Peoria St"),ns(-1000,"Morgan St",22),ns(-1200,"Racine Ave",28),ns(-1600,"Ashland Ave",30),ns(-2000,"Damen Ave",28),ns(-2400,"Western Ave",30)];
vLines[0].r=[-1200*A,530*A];
const polys={
 LAKE:[[41.8300,-87.6040],[41.8560,-87.6090],[41.8560,-87.6030],[41.8660,-87.6030],[41.8668,-87.6122],[41.8750,-87.6148],[41.8840,-87.6140],[41.8885,-87.6118],[41.8890,-87.6105],[41.8905,-87.6108],[41.8905,-87.5980],[41.8922,-87.5980],[41.8922,-87.6110],[41.8935,-87.6135],[41.8975,-87.6162],[41.9010,-87.6232],[41.9030,-87.6247],[41.9100,-87.6257],[41.9200,-87.6282],[41.9300,-87.6312],[41.9400,-87.6340],[41.9400,-87.5400],[41.8300,-87.5400]],
 HARBOR:[[41.8560,-87.6125],[41.8560,-87.6096],[41.8650,-87.6096],[41.8650,-87.6125]],
 LOOP:[[41.8867,-87.6378],[41.8885,-87.6300],[41.8889,-87.6105],[41.8676,-87.6140],[41.8676,-87.6372]],
 GRANT:[[41.8848,-87.6243],[41.8848,-87.6168],[41.8676,-87.6182],[41.8676,-87.6240]],
 LPARK:[[41.9110,-87.6345],[41.9110,-87.6282],[41.9300,-87.6335],[41.9300,-87.6420]],
 NISLAND:[[41.8560,-87.6090],[41.8560,-87.6033],[41.8658,-87.6033],[41.8658,-87.6090]]
};
G.cities.chi={
 key:"chi",name:"Chicago",state:"IL",area:"Loop · Near North · Near West · South Loop",center:[41.885,-87.635],seed:23,
 landMode:"water",water:["LAKE","HARBOR"],land:[],polys,
 rivers:[
  {pts:[[41.8889,-87.6105],[41.8882,-87.6200],[41.8877,-87.6290],[41.8875,-87.6340],[41.8867,-87.6377]],w:70},
  {pts:[[41.8867,-87.6377],[41.8800,-87.6382],[41.8730,-87.6377],[41.8680,-87.6367],[41.8620,-87.6342],[41.8560,-87.6357],[41.8500,-87.6450],[41.8460,-87.6600],[41.8440,-87.6750],[41.8430,-87.6950]],w:60},
  {pts:[[41.8867,-87.6377],[41.8920,-87.6400],[41.8970,-87.6420],[41.9030,-87.6480],[41.9100,-87.6540],[41.9150,-87.6560],[41.9220,-87.6620],[41.9320,-87.6690]],w:50}],
 parks:[{poly:"GRANT"},{poly:"LPARK"},{poly:"NISLAND"},{line:[[41.8662,-87.6155],[41.8560,-87.6118],[41.8350,-87.6080]],w:180},{ll:[41.8844,-87.6667],r:150},{ll:[41.8996,-87.6300],r:60},{ll:[41.8740,-87.6580],r:90},{ll:[41.9000,-87.6390],r:80},{ll:[41.8960,-87.6620],r:120},{ll:[41.9080,-87.6770],r:80},{ll:[41.8570,-87.6330],r:90},{ll:[41.8570,-87.6720],r:150},{ll:[41.8560,-87.6620],r:80},{line:[[41.8936,-87.6140],[41.9100,-87.6262],[41.9300,-87.6318]],w:90}],
 regions:[{id:"grid",origin:[41.88202,-87.62785],angle:0,uLines,vLines,fillU:105*A,fillV:52*A,fillW:16,marks:true,test:()=>true}],
 roads:[
  {n:"Lake Shore Dr",w:44,hwy:true,pts:[[41.8380,-87.6122],[41.8560,-87.6142],[41.8668,-87.6165],[41.8750,-87.6188],[41.8850,-87.6175],[41.8898,-87.6160],[41.8960,-87.6185],[41.9010,-87.6252],[41.9100,-87.6275],[41.9200,-87.6305],[41.9320,-87.6338]]},
  {n:"Kennedy Expy",w:60,hwy:true,pts:[[41.8755,-87.6455],[41.8840,-87.6447],[41.8925,-87.6445],[41.9010,-87.6540],[41.9100,-87.6620],[41.9200,-87.6740],[41.9320,-87.6850]]},
  {n:"Dan Ryan Expy",w:70,hwy:true,pts:[[41.8755,-87.6455],[41.8650,-87.6452],[41.8550,-87.6402],[41.8450,-87.6342],[41.8300,-87.6305]]},
  {n:"Eisenhower Expy",w:60,hwy:true,pts:[[41.8755,-87.6455],[41.8752,-87.6600],[41.8752,-87.7000]]},
  {n:"Milwaukee Ave",w:22,pts:[[41.8855,-87.6440],[41.8920,-87.6520],[41.9000,-87.6620],[41.9100,-87.6750],[41.9180,-87.6870]]},
  {n:"Wacker Dr",w:30,pts:[[41.8790,-87.6368],[41.8865,-87.6365],[41.8872,-87.6290],[41.8875,-87.6200],[41.8880,-87.6150]]},
  {n:"Archer Ave",w:22,pts:[[41.8545,-87.6340],[41.8470,-87.6460],[41.8400,-87.6580]]},
  {n:"Ogden Ave",w:26,pts:[[41.8890,-87.6550],[41.8820,-87.6650],[41.8700,-87.6800],[41.8600,-87.6950]]},
  {n:"Clybourn Ave",w:22,pts:[[41.9000,-87.6390],[41.9100,-87.6520],[41.9200,-87.6650]]}],
 landmarks:[
  {n:"Willis Tower",ll:[41.8789,-87.6359],h:442,w:68,shape:"willis",roof:442},
  {n:"Trump Tower Chicago",ll:[41.8889,-87.6264],h:423,w:44,shape:"stepped"},
  {n:"St. Regis Chicago",ll:[41.8874,-87.6178],h:363,w:40,shape:"taper"},
  {n:"Aon Center",ll:[41.8853,-87.6216],h:346,w:58,shape:"box"},
  {n:"875 N Michigan Ave",ll:[41.8988,-87.6229],h:344,w:50,shape:"hancock"},
  {n:"Franklin Center",ll:[41.8806,-87.6346],h:307,w:44,shape:"spire"},
  {n:"Two Prudential Plaza",ll:[41.8847,-87.6222],h:303,w:36,shape:"spire"},
  {n:"311 South Wacker",ll:[41.8774,-87.6359],h:293,w:46,shape:"spire"},
  {n:"Chase Tower",ll:[41.8818,-87.6299],h:259,w:56,shape:"box"},
  {n:"Park Tower",ll:[41.8973,-87.6216],h:257,w:38,shape:"spire"},
  {n:"Merchandise Mart",ll:[41.8885,-87.6354],h:105,w:180,d:120,shape:"box"},
  {n:"Marina City",ll:[41.8880,-87.6290],h:179,w:36,shape:"twin"},
  {n:"Tribune Tower",ll:[41.8904,-87.6235],h:141,w:40,shape:"spire"},
  {n:"Soldier Field",ll:[41.8623,-87.6167],h:40,w:280,d:200,shape:"stadium"},
  {n:"United Center",ll:[41.8807,-87.6742],h:40,w:200,d:170,shape:"arena"}],
 bridges:[],
 hoods:[["The Loop",41.8800,-87.6300],["River North",41.8925,-87.6340],["Streeterville",41.8930,-87.6200],["Gold Coast",41.9050,-87.6280],["Old Town",41.9100,-87.6380],["Lincoln Park",41.9220,-87.6480],["West Loop",41.8830,-87.6500],["Fulton Market",41.8865,-87.6520],["South Loop",41.8650,-87.6250],["Chinatown",41.8525,-87.6325],["Pilsen",41.8550,-87.6650],["River West",41.8930,-87.6500],["Wicker Park",41.9080,-87.6770],["Ukrainian Village",41.8990,-87.6800],["Little Italy",41.8690,-87.6560],["Museum Campus",41.8660,-87.6150],["Navy Pier",41.8917,-87.6050],["Printer's Row",41.8735,-87.6290],["Goose Island",41.9030,-87.6530]],
 industrial:[{ll:[41.9030,-87.6530],r:450},{ll:[41.8500,-87.6450],r:650},{ll:[41.8720,-87.6375],r:160}],
 hills:[],elev:{b:2.2,slope:.002,cap:5},
 centers:[[41.8810,-87.6300,175,900],[41.8935,-87.6200,155,500],[41.8925,-87.6330,90,620],[41.8830,-87.6440,115,450],[41.8680,-87.6250,105,600],[41.9050,-87.6270,90,420]],
 base:10,hMul:1.1,towerP:1.6,
 style:{lotW:[8,14],depth:[16,24],side:4,house:true,houseH:13,gable:.25,tank:0,glass:.95,setback:.35,trees:.55,palette:"chi",office:1},
 baseline:{pop:2721000,hhIncome:75134,unemp:6.2,homeValue:336642,rent:2050,homeless:7452,unsheltered:.18,violent:420.4,property:2942.4,budget:16.6,police:11700,transit:850000,carShare:.52,commute:34.4,congestion:46.1,jobs:1450000,vacancy:.06,age:[.20,.29,.37,.14],income:[.38,.40,.22],jobGrowth:.002,rentTrend:.010,taxBase:.25},
 sources:{homeless:"City of Chicago 2025 point-in-time count (WTTW)",crime:"FBI 2025 (via Security.org)",homeValue:"Zillow ZHVI, metro, Dec 2025",congestion:"TomTom Traffic Index 2025: 46.1%, #6 in US"},
 validation:{district:{poly:"LOOP",name:"The Loop",res:42298,src:"US Census 2020 (Loop community area)"},t150:137,t100:356},
 events:["vortex","violence","lakeflood","ctacliff","hq","convention","heat","fedcut","strike"]
};})();

/* ======================= SEATTLE ======================= */
(function(){
const S=92; const st=(i,name,w)=>({p:i*S,w:w||20,name});
const uLines=[st(0,"Yesler Way",22),st(1,"James St"),st(2,"Cherry St"),st(3,"Columbia St"),st(4,"Marion St"),st(5,"Madison St",22),st(6,"Spring St"),st(7,"Seneca St"),st(8,"University St"),st(9,"Union St"),st(10,"Pike St",22),st(11,"Pine St",22),st(12,"Stewart St"),st(13,"Virginia St"),st(14,"Lenora St"),st(15,"Blanchard St"),st(16,"Bell St"),st(17,"Battery St"),st(18,"Wall St"),st(19,"Vine St"),st(20,"Cedar St"),st(21,"Clay St"),st(22,"Broad St",24),st(23,null,16),st(24,"Denny Way",26)];
const av=(p,name,w)=>({p,w:w||22,name});
const vLines=[av(-95,"Western Ave"),av(0,"1st Ave"),av(105,"2nd Ave"),av(210,"3rd Ave"),av(315,"4th Ave"),av(420,"5th Ave"),av(525,"6th Ave"),av(630,"7th Ave"),av(735,"8th Ave"),av(840,"9th Ave"),av(945,"Terry Ave"),av(1050,"Boren Ave")];
const lon=(l,name,w,r)=>({lon:l,w:w||20,name,rl:r});const lat=(l,name,w)=>({lat:l,w:w||18,name});
const nsU=[lat(47.6340,"Garfield St"),lat(47.6320,"Galer St"),lat(47.6286,"Ward St"),lat(47.6275,"Aloha St"),lat(47.6264,"Valley St"),lat(47.6253,"Roy St"),lat(47.6242,"Mercer St",24),lat(47.6230,"Republican St"),lat(47.6219,"Harrison St"),lat(47.6208,"Thomas St"),lat(47.6197,"John St"),lat(47.6186,"Denny Way",26),lat(47.6152,"E Pine St",22),lat(47.6141,"E Pike St",22),lat(47.6129,"E Union St"),lat(47.6106,"E Spring St"),lat(47.6077,"E Cherry St"),lat(47.6060,"E Jefferson St"),lat(47.6017,"Yesler Way",22),lat(47.5992,"S Jackson St",24),lat(47.5980,"S King St"),lat(47.5958,"S Dearborn St",22),lat(47.5913,"S Royal Brougham Way",22),lat(47.5832,"S Holgate St",22),lat(47.5795,"S Lander St"),lat(47.5711,"S Spokane St",26)];
const nsV=[lon(-122.3570,"Queen Anne Ave N",22),lon(-122.3475,"5th Ave N"),lon(-122.3425,"Dexter Ave N"),lon(-122.3395,"9th Ave N"),lon(-122.3330,"Fairview Ave N"),lon(-122.3300,"Yale Ave N"),lon(-122.3270,"Melrose Ave E"),lon(-122.3208,"Broadway",24),lon(-122.3170,"12th Ave",22),lon(-122.3128,"15th Ave E",22),lon(-122.3070,"19th Ave E"),lon(-122.3025,"23rd Ave",24),lon(-122.2965,"Martin Luther King Jr Way",24),lon(-122.3343,"1st Ave S",24),lon(-122.3290,"4th Ave S",26)];
const polys={
 BAY:[[47.5920,-122.4000],[47.5960,-122.3850],[47.5920,-122.3700],[47.5880,-122.3625],[47.5640,-122.3605],[47.5640,-122.3565],[47.5880,-122.3570],[47.5920,-122.3560],[47.5920,-122.3425],[47.5640,-122.3445],[47.5640,-122.3400],[47.5900,-122.3392],[47.5980,-122.3388],[47.6030,-122.3392],[47.6070,-122.3427],[47.6120,-122.3482],[47.6170,-122.3562],[47.6210,-122.3612],[47.6250,-122.3682],[47.6280,-122.3782],[47.6300,-122.3832],[47.6280,-122.3900],[47.6320,-122.4000]],
 LU:[[47.6255,-122.3385],[47.6270,-122.3300],[47.6350,-122.3270],[47.6420,-122.3290],[47.6440,-122.3340],[47.6460,-122.3400],[47.6480,-122.3450],[47.6370,-122.3460],[47.6290,-122.3430]],
 PORTAGE:[[47.6470,-122.3270],[47.6500,-122.3150],[47.6530,-122.3050],[47.6470,-122.3030],[47.6440,-122.3200]],
 LW:[[47.5640,-122.2780],[47.5870,-122.2840],[47.6000,-122.2862],[47.6130,-122.2832],[47.6210,-122.2802],[47.6360,-122.2782],[47.6450,-122.2852],[47.6560,-122.2950],[47.6560,-122.2500],[47.5640,-122.2500]],
 DSA:[[47.5940,-122.3420],[47.5940,-122.3150],[47.6060,-122.3150],[47.6190,-122.3260],[47.6280,-122.3260],[47.6280,-122.3640],[47.6200,-122.3660],[47.6050,-122.3460]],
 CENTER:[[47.6185,-122.3555],[47.6185,-122.3480],[47.6255,-122.3480],[47.6255,-122.3555]]
};
const I5=[[47.5640,-122.3200],[47.5900,-122.3215],[47.5990,-122.3250],[47.6060,-122.3295],[47.6130,-122.3300],[47.6190,-122.3310],[47.6250,-122.3270],[47.6350,-122.3230],[47.6560,-122.3220]];
G.cities.sea={
 key:"sea",name:"Seattle",state:"WA",area:"Downtown · SLU · Capitol Hill · SoDo",center:[47.610,-122.330],seed:31,
 landMode:"water",water:["BAY","LU","PORTAGE","LW"],land:[],polys,
 rivers:[{pts:[[47.6480,-122.3450],[47.6500,-122.3550],[47.6520,-122.3700],[47.6560,-122.3850],[47.6620,-122.4000]],w:90}],
 parks:[{poly:"CENTER"},{ll:[47.6170,-122.3195],r:120},{ll:[47.6300,-122.3150],r:300},{ll:[47.6195,-122.3410],r:55},{ll:[47.6100,-122.3300],r:60},{ll:[47.6165,-122.3555],r:100},{line:[[47.6175,-122.3592],[47.6270,-122.3742]],w:60},{ll:[47.6456,-122.3344],r:150},{ll:[47.6015,-122.3340],r:35},{ll:[47.5975,-122.3240],r:40},{ll:[47.6300,-122.3570],r:60},{ll:[47.6220,-122.3020],r:120},{ll:[47.6080,-122.2920],r:150},{ll:[47.5820,-122.3110],r:250},{ll:[47.6400,-122.3950],r:260}],
 regions:[
  {id:"dt",origin:[47.6017,-122.3343],angle:-32.2,uLines,vLines,fillU:0,fillV:0,marks:true,test:H=>H.u>-30&&H.u<2240&&H.v<1100&&H.west("I5")},
  {id:"wsea",angle:0,pitch:[95,130,16],test:H=>H.lat<47.5960&&H.lon<-122.356},
  {id:"mag",angle:0,pitch:[100,140,16],test:H=>H.lon<-122.372&&H.lat>47.6250},
  {id:"ns",origin:[47.6017,-122.3343],angle:0,uLines:nsU,vLines:nsV,fillU:95,fillV:115,fillW:15,marks:true,test:()=>true}],
 lines:{I5},
 roads:[
  {n:"I-5",w:60,hwy:true,pts:I5},
  {n:"Alaskan Way",w:30,pts:[[47.5900,-122.3370],[47.5990,-122.3367],[47.6030,-122.3377],[47.6070,-122.3412],[47.6120,-122.3467],[47.6170,-122.3543],[47.6205,-122.3592]]},
  {n:"Elliott Ave W",w:28,pts:[[47.6205,-122.3592],[47.6270,-122.3702],[47.6330,-122.3800],[47.6420,-122.3850]]},
  {n:"Aurora Ave N",w:40,hwy:true,pts:[[47.6200,-122.3445],[47.6300,-122.3445],[47.6420,-122.3460],[47.6560,-122.3470]]},
  {n:"Westlake Ave N",w:24,pts:[[47.6113,-122.3376],[47.6190,-122.3388],[47.6280,-122.3395],[47.6400,-122.3432]]},
  {n:"Eastlake Ave E",w:22,pts:[[47.6200,-122.3292],[47.6330,-122.3247],[47.6450,-122.3242]]},
  {n:"E Madison St",w:24,pts:[[47.6060,-122.3292],[47.6130,-122.3150],[47.6200,-122.3020],[47.6300,-122.2870]]},
  {n:"I-90",w:60,hwy:true,pts:[[47.5940,-122.3200],[47.5900,-122.3050],[47.5890,-122.2900],[47.5880,-122.2700]]},
  {n:"Rainier Ave S",w:24,pts:[[47.5990,-122.3170],[47.5880,-122.3080],[47.5770,-122.2990],[47.5640,-122.2880]]},
  {n:"SR 99",w:40,hwy:true,pts:[[47.5640,-122.3380],[47.5800,-122.3380],[47.5900,-122.3375]]},
  {n:"West Seattle Bridge",w:40,hwy:true,pts:[[47.5710,-122.3420],[47.5715,-122.3600],[47.5700,-122.3800]]},
  {n:"Airport Way S",w:22,pts:[[47.5990,-122.3230],[47.5850,-122.3210],[47.5700,-122.3170]]}],
 landmarks:[
  {n:"Columbia Center",ll:[47.6045,-122.3305],h:284,w:52,shape:"stepped"},
  {n:"Rainier Square Tower",ll:[47.6094,-122.3341],h:259,w:40,shape:"taper"},
  {n:"1201 Third Avenue",ll:[47.6074,-122.3369],h:235,w:42,shape:"spire"},
  {n:"Two Union Square",ll:[47.6106,-122.3322],h:226,w:48,shape:"glass"},
  {n:"Seattle Municipal Tower",ll:[47.6054,-122.3299],h:220,w:46,shape:"glass"},
  {n:"Space Needle",ll:[47.6205,-122.3493],h:184,w:40,shape:"needle"},
  {n:"Lumen Field",ll:[47.5952,-122.3316],h:50,w:260,d:220,shape:"stadium"},
  {n:"T-Mobile Park",ll:[47.5914,-122.3325],h:55,w:230,d:230,shape:"arena"},
  {n:"Climate Pledge Arena",ll:[47.6221,-122.3540],h:25,w:140,shape:"arena"},
  {n:"Smith Tower",ll:[47.6019,-122.3318],h:148,w:26,shape:"spire"}],
 bridges:[],
 hoods:[["Downtown",47.6080,-122.3360],["Pioneer Square",47.6015,-122.3340],["Chinatown-ID",47.5980,-122.3240],["Belltown",47.6150,-122.3480],["South Lake Union",47.6260,-122.3380],["Denny Triangle",47.6170,-122.3370],["Capitol Hill",47.6230,-122.3180],["First Hill",47.6080,-122.3240],["Central District",47.6080,-122.3010],["Queen Anne",47.6370,-122.3570],["Eastlake",47.6400,-122.3260],["SoDo",47.5800,-122.3350],["Beacon Hill",47.5750,-122.3110],["Magnolia",47.6400,-122.3950],["West Seattle",47.5770,-122.3850],["Madison Park",47.6340,-122.2800],["Fremont",47.6510,-122.3500],["Uptown",47.6230,-122.3570],["Leschi",47.6000,-122.2920],["Interbay",47.6400,-122.3760]],
 industrial:[{ll:[47.5800,-122.3350],r:900},{ll:[47.5800,-122.3500],r:600},{ll:[47.6400,-122.3750],r:500}],
 hills:[{ll:[47.6080,-122.3240],h:100,r:600},{ll:[47.6250,-122.3150],h:130,r:900},{ll:[47.6370,-122.3580],h:135,r:800},{ll:[47.5750,-122.3110],h:100,r:900},{ll:[47.6420,-122.4000],h:100,r:900},{ll:[47.5750,-122.3900],h:80,r:1100},{ll:[47.6060,-122.3000],h:70,r:1300}],
 elev:{b:2,slope:.035,cap:40},
 centers:[[47.6070,-122.3350,175,560],[47.6170,-122.3380,125,450],[47.6250,-122.3380,65,620],[47.6140,-122.3470,95,450],[47.6080,-122.3240,70,500]],
 base:8,hMul:0.8,towerP:1.3,
 style:{lotW:[12,18],depth:[14,22],side:3.5,house:true,houseH:14,gable:.7,tank:0,glass:1,setback:.15,trees:.6,palette:"sea",office:1},
 baseline:{pop:780000,hhIncome:121984,unemp:4.5,homeValue:730730,rent:2150,homeless:18365,homelessScope:"King County",unsheltered:.55,violent:698.7,property:4419.6,budget:8.9,police:920,transit:420000,carShare:.40,commute:28.1,congestion:44.9,jobs:620000,vacancy:.05,age:[.15,.33,.38,.14],income:[.22,.38,.40],jobGrowth:.002,rentTrend:.007,taxBase:.22},
 sources:{homeless:"King County 2026 point-in-time count (county-wide)",crime:"FBI 2025 (via Security.org)",homeValue:"Zillow ZHVI, metro, Dec 2025",congestion:"TomTom Traffic Index 2025: 44.9%, #7 in US"},
 validation:{district:{poly:"DSA",name:"Downtown (DSA)",res:109845,jobs:317579,src:"Downtown Seattle Association, 2025 estimates"},t150:22,t100:75},
 events:["quake","snow","atmos","layoffs","rto","heatdome","fedcut","strike","tourism"]
};})();

/* ======================= SAN FRANCISCO ======================= */
(function(){
const lat=(l,name,w)=>({lat:l,w:w||18,name}),lon=(l,name,w)=>({lon:l,w:w||18,name});
const ewNames=["Geary St","Post St","Sutter St","Bush St","Pine St","California St","Sacramento St","Clay St","Washington St","Jackson St","Pacific Ave","Broadway","Vallejo St","Green St","Union St","Filbert St","Greenwich St","Lombard St","Chestnut St","Francisco St","Bay St","North Point St","Beach St","Jefferson St"];
const nU=ewNames.map((n,i)=>lat(37.7870+i*0.00092,n,["Geary St","California St","Broadway","Lombard St","Bay St"].includes(n)?28:18));
nU.push(lat(37.7861,"O'Farrell St"),lat(37.7852,"Ellis St"),lat(37.7843,"Eddy St"),lat(37.7834,"Turk St"),lat(37.7820,"Golden Gate Ave",22),lat(37.7807,"McAllister St"),lat(37.7797,"Fulton St"),lat(37.7787,"Grove St"),lat(37.7770,"Hayes St"),lat(37.7758,"Fell St",22),lat(37.7748,"Oak St",22),lat(37.7732,"Page St"),lat(37.7718,"Haight St"),lat(37.7705,"Waller St"));
const nsN=["Drumm St","Davis St","Front St","Battery St","Sansome St","Montgomery St","Kearny St","Grant Ave","Stockton St","Powell St","Mason St","Taylor St","Jones St","Leavenworth St","Hyde St","Larkin St","Polk St"];
const nsLon=[-122.3965,-122.3980,-122.3995,-122.4005,-122.4013,-122.4025,-122.4040,-122.4055,-122.4070,-122.4085,-122.4100,-122.4116,-122.4132,-122.4148,-122.4165,-122.4181,-122.4198];
const nV=nsN.map((n,i)=>lon(nsLon[i],n));
nV.push(lon(-122.4220,"Van Ness Ave",38),lon(-122.4236,"Franklin St",24),lon(-122.4253,"Gough St",24),lon(-122.4269,"Octavia St"),lon(-122.4286,"Laguna St"),lon(-122.4303,"Buchanan St"),lon(-122.4319,"Webster St"),lon(-122.4336,"Fillmore St",22),lon(-122.4353,"Steiner St"),lon(-122.4369,"Pierce St"),lon(-122.4386,"Scott St"),lon(-122.4403,"Divisadero St",24),lon(-122.4419,"Broderick St"),lon(-122.4436,"Baker St"),lon(-122.4452,"Lyon St"),lon(-122.4470,"Presidio Ave",22),lon(-122.4590,"Arguello Blvd",24));
const somaU=[["The Embarcadero",1210,30],["Steuart St",1100],["Spear St",980],["Main St",860],["Beale St",740],["Fremont St",620],["1st St",503,26],["2nd St",250,24],["New Montgomery St",125],["3rd St",0,26],["4th St",-265,26],["5th St",-530,26],["6th St",-795,26],["7th St",-1060,24],["8th St",-1325,24],["9th St",-1590,24],["10th St",-1855,24],["11th St",-2120,24],["12th St",-2385,22]].map(([n,p,w])=>({p,w:w||18,name:n}));
const somaV=[["Market St",0,38],["Mission St",230,26],["Howard St",405,26],["Folsom St",580,26],["Harrison St",755,26],["Bryant St",930,26],["Brannan St",1105,26],["Townsend St",1280,26],["King St",1455,30]].map(([n,p,w])=>({p,w,name:n}));
const mU=[["Duboce Ave",37.7690],["14th St",37.7680],["15th St",37.7665],["16th St",37.7650],["17th St",37.7635],["18th St",37.7615],["19th St",37.7600],["20th St",37.7585],["21st St",37.7570],["22nd St",37.7555],["23rd St",37.7540],["24th St",37.7525],["25th St",37.7510],["26th St",37.7495],["Cesar Chavez St",37.7480],["27th St",37.7465],["28th St",37.7450],["29th St",37.7435],["30th St",37.7420]].map(([n,l])=>lat(l,n,["16th St","24th St","Cesar Chavez St"].includes(n)?24:18));
const mV=[["Douglass St",-122.4394],["Diamond St",-122.4372],["Castro St",-122.4350],["Noe St",-122.4329],["Sanchez St",-122.4306],["Church St",-122.4285],["Dolores St",-122.4258],["Guerrero St",-122.4237],["Valencia St",-122.4215],["Mission St",-122.4190],["South Van Ness Ave",-122.4170],["Folsom St",-122.4142],["Harrison St",-122.4125],["Bryant St",-122.4105],["Potrero Ave",-122.4065],["Vermont St",-122.4045],["Rhode Island St",-122.4025],["Carolina St",-122.4005],["Arkansas St",-122.3985],["Missouri St",-122.3965],["Mississippi St",-122.3945],["Pennsylvania Ave",-122.3925],["Indiana St",-122.3905]].map(([n,l])=>lon(l,n,["Mission St","Valencia St","Potrero Ave","South Van Ness Ave"].includes(n)?24:18));
const polys={
 BAY:[[37.8100,-122.4800],[37.8060,-122.4650],[37.8050,-122.4530],[37.8070,-122.4450],[37.8075,-122.4380],[37.8085,-122.4310],[37.8075,-122.4230],[37.8090,-122.4170],[37.8095,-122.4110],[37.8070,-122.4060],[37.8040,-122.4020],[37.8010,-122.3990],[37.7980,-122.3963],[37.7955,-122.3930],[37.7920,-122.3907],[37.7880,-122.3882],[37.7840,-122.3872],[37.7800,-122.3868],[37.7780,-122.3873],[37.7762,-122.3895],[37.7745,-122.3905],[37.7740,-122.3875],[37.7700,-122.3858],[37.7640,-122.3848],[37.7570,-122.3843],[37.7500,-122.3833],[37.7380,-122.3800],[37.7380,-122.3400],[37.8350,-122.3400],[37.8350,-122.4800]],
 YBI:[[37.8150,-122.3700],[37.8150,-122.3600],[37.8070,-122.3590],[37.8060,-122.3700]],
 TI:[[37.8300,-122.3760],[37.8300,-122.3600],[37.8160,-122.3650],[37.8170,-122.3740]],
 ALC:[[37.8282,-122.4250],[37.8282,-122.4210],[37.8255,-122.4210],[37.8255,-122.4250]],
 PRES:[[37.7880,-122.4475],[37.8100,-122.4475],[37.8100,-122.4800],[37.7880,-122.4800]],
 GGP:[[37.7740,-122.4545],[37.7740,-122.4800],[37.7660,-122.4800],[37.7660,-122.4545]],
 FIDI:[[37.7953,-122.4040],[37.7953,-122.3980],[37.7955,-122.3935],[37.7905,-122.3890],[37.7838,-122.3988],[37.7875,-122.4035]]
};
const piers=[];for(const [la,lo] of [[37.8087,-122.4098],[37.8060,-122.4045],[37.8030,-122.4005],[37.8000,-122.3975],[37.7975,-122.3950],[37.7930,-122.3900],[37.7885,-122.3870],[37.7845,-122.3860],[37.7810,-122.3855]]){const L=0.0016;piers.push([[la+0.0003,lo],[la+0.0003+L*0.7,lo+L*0.7],[la-0.0003+L*0.7,lo+L*0.75],[la-0.0003,lo+0.0001]]);}
piers.forEach((p,i)=>polys["PIER"+i]=p);
const mkt=(H)=>H.side;
G.cities.sf={
 key:"sf",name:"San Francisco",state:"CA",area:"Downtown · SoMa · Mission · Pacific Heights",center:[37.785,-122.415],seed:47,
 landMode:"water",water:["BAY"],land:["YBI","TI","ALC",...piers.map((_,i)=>"PIER"+i)],polys,
 rivers:[],
 market:[[37.7623,-122.4351],[37.7955,-122.3935]],
 parks:[{poly:"PRES"},{poly:"GGP"},{line:[[37.7728,-122.4547],[37.7718,-122.4433]],w:70},{ll:[37.7764,-122.4346],r:110},{ll:[37.7915,-122.4276],r:120},{ll:[37.7910,-122.4375],r:110},{ll:[37.7880,-122.4075],r:55},{ll:[37.7852,-122.4022],r:75},{ll:[37.7596,-122.4269],r:150},{ll:[37.8008,-122.4100],r:75},{ll:[37.8024,-122.4058],r:130},{ll:[37.8060,-122.4300],r:200},{line:[[37.8060,-122.4420],[37.8068,-122.4360]],w:80},{ll:[37.7793,-122.4180],r:60},{ll:[37.7683,-122.4410],r:230},{ll:[37.7650,-122.4390],r:120},{ll:[37.7690,-122.4330],r:70},{ll:[37.7810,-122.4255],r:85},{ll:[37.7580,-122.4000],r:90},{ll:[37.7544,-122.4477],r:450},{ll:[37.7790,-122.4520],r:150},{ll:[37.7430,-122.4150],r:300}],
 regions:[
  {id:"north",origin:[37.7875,-122.4035],angle:0,uLines:nU,vLines:nV,fillU:110,fillV:150,fillW:14,marks:true,test:H=>H.side>0},
  {id:"soma",origin:[37.7875,-122.4035],angle:44.9,uLines:somaU,vLines:somaV,fillU:140,fillV:100,fillW:12,marks:true,test:H=>H.u>-2420&&H.u<1300&&H.v<1490},
  {id:"mission",origin:[37.7875,-122.4035],angle:0,uLines:mU,vLines:mV,fillU:95,fillV:110,fillW:14,marks:true,test:()=>true}],
 roads:[
  {n:"Market St",w:38,pts:[[37.7623,-122.4351],[37.7955,-122.3935]]},
  {n:"Columbus Ave",w:24,pts:[[37.7962,-122.4048],[37.8005,-122.4100],[37.8045,-122.4150],[37.8065,-122.4185]]},
  {n:"The Embarcadero",w:34,pts:[[37.8085,-122.4140],[37.8060,-122.4060],[37.8010,-122.4002],[37.7955,-122.3945],[37.7890,-122.3897],[37.7820,-122.3887],[37.7790,-122.3892]]},
  {n:"US-101",w:50,hwy:true,pts:[[37.7700,-122.4210],[37.7680,-122.4130],[37.7640,-122.4080],[37.7550,-122.4045],[37.7380,-122.4040]]},
  {n:"I-80",w:50,hwy:true,pts:[[37.7690,-122.4080],[37.7760,-122.4010],[37.7830,-122.3930],[37.7880,-122.3900]]},
  {n:"I-280",w:50,hwy:true,pts:[[37.7760,-122.3962],[37.7700,-122.3980],[37.7600,-122.3962],[37.7500,-122.3942],[37.7380,-122.3950]]},
  {n:"3rd St",w:28,pts:[[37.7780,-122.3910],[37.7700,-122.3895],[37.7600,-122.3885],[37.7500,-122.3878],[37.7380,-122.3880]]},
  {n:"Geary Blvd",w:36,pts:[[37.7856,-122.4217],[37.7830,-122.4400],[37.7810,-122.4600],[37.7800,-122.4800]]}],
 landmarks:[
  {n:"Salesforce Tower",ll:[37.7897,-122.3972],h:326,w:52,shape:"round"},
  {n:"Transamerica Pyramid",ll:[37.7952,-122.4028],h:260,w:44,shape:"pyramid"},
  {n:"181 Fremont",ll:[37.7895,-122.3955],h:245,w:34,shape:"spire"},
  {n:"555 California",ll:[37.7920,-122.4034],h:237,w:54,shape:"box"},
  {n:"Millennium Tower",ll:[37.7905,-122.3963],h:197,w:38,shape:"glass"},
  {n:"One Rincon Hill",ll:[37.7865,-122.3925],h:188,w:36,shape:"glass"},
  {n:"Coit Tower",ll:[37.8024,-122.4058],h:64,w:12,shape:"column"},
  {n:"San Francisco City Hall",ll:[37.7793,-122.4192],h:94,w:110,d:90,shape:"dome"},
  {n:"Ferry Building",ll:[37.7955,-122.3937],h:75,w:200,d:40,shape:"ferry",rot:-45},
  {n:"Sutro Tower",ll:[37.7552,-122.4528],h:298,w:40,shape:"antenna"},
  {n:"Oracle Park",ll:[37.7786,-122.3893],h:45,w:240,d:230,shape:"arena"},
  {n:"Chase Center",ll:[37.7680,-122.3877],h:30,w:160,shape:"arena"}],
 bridges:[{n:"Bay Bridge",a:[37.7880,-122.3895],b:[37.8090,-122.3640],deck:60,tower:160,kind:"susp"}],
 hoods:[["Financial District",37.7940,-122.4000],["SoMa",37.7790,-122.4050],["Mission",37.7600,-122.4180],["Castro",37.7609,-122.4350],["Haight-Ashbury",37.7700,-122.4470],["Hayes Valley",37.7760,-122.4250],["Tenderloin",37.7840,-122.4140],["Nob Hill",37.7930,-122.4160],["Chinatown",37.7941,-122.4078],["North Beach",37.8003,-122.4100],["Russian Hill",37.8011,-122.4194],["Marina",37.8020,-122.4370],["Pacific Heights",37.7925,-122.4350],["Western Addition",37.7800,-122.4370],["Mission Bay",37.7700,-122.3920],["Potrero Hill",37.7590,-122.4000],["Dogpatch",37.7600,-122.3880],["Presidio",37.7990,-122.4600],["Twin Peaks",37.7544,-122.4477],["Treasure Island",37.8240,-122.3700],["Fisherman's Wharf",37.8080,-122.4170],["Union Square",37.7880,-122.4075],["NoPa",37.7760,-122.4420],["Rincon Hill",37.7860,-122.3925],["Civic Center",37.7795,-122.4170]],
 industrial:[{ll:[37.7650,-122.3900],r:500},{ll:[37.7500,-122.3870],r:450}],
 hills:[{ll:[37.7930,-122.4160],h:95,r:350},{ll:[37.8011,-122.4194],h:85,r:300},{ll:[37.8024,-122.4058],h:80,r:200},{ll:[37.7920,-122.4330],h:100,r:600},{ll:[37.7544,-122.4477],h:270,r:900},{ll:[37.7683,-122.4410],h:160,r:350},{ll:[37.7590,-122.3990],h:85,r:450},{ll:[37.7860,-122.3925],h:28,r:150},{ll:[37.7400,-122.4150],h:120,r:500},{ll:[37.7790,-122.4520],h:90,r:300},{ll:[37.7764,-122.4346],h:60,r:300}],
 elev:{b:2.5,slope:.02,cap:18},
 centers:[[37.7920,-122.4000,165,600],[37.7885,-122.3940,175,450],[37.7810,-122.4040,45,700],[37.7800,-122.4170,35,500],[37.7880,-122.4150,30,600],[37.7700,-122.3920,40,500]],
 base:10,hMul:0.7,towerP:1,
 style:{lotW:[7.5,11],depth:[18,26],side:3.5,house:false,tank:0,glass:.9,setback:.3,trees:.3,palette:"sf",office:1},
 baseline:{pop:827000,hhIncome:141446,unemp:4.2,homeValue:1101500,rent:3350,homeless:8323,unsheltered:.45,violent:486.2,property:2932.4,budget:15.9,police:1850,transit:520000,carShare:.33,commute:31.4,congestion:49.7,jobs:760000,vacancy:.05,age:[.13,.31,.39,.17],income:[.22,.33,.45],jobGrowth:.003,rentTrend:.009,taxBase:.24},
 sources:{homeless:"SF 2024 point-in-time count (2026 count reported 4.2% lower)",crime:"FBI 2025 (via Security.org)",homeValue:"Zillow ZHVI, metro, Dec 2025",congestion:"TomTom Traffic Index 2025: 49.7%, #3 in US"},
 validation:{district:{poly:"FIDI",name:"Financial District (+ South FiDi)",jobs:372829,src:"US Census tracts, 2012–2016 (pre-pandemic)"},t150:27,t100:100},
 events:["quake","atmos","aiboom","layoffs","dreamforce","smoke","bartcliff","fedcut","strike"]
};})();

/* ======================= SAN DIEGO ======================= */
(function(){
const lat=(l,name,w)=>({lat:l,w:w||18,name}),lon=(l,name,w)=>({lon:l,w:w||18,name});
const avN=["Kettner Blvd","India St","Columbia St","State St","Union St","Front St","1st Ave","2nd Ave","3rd Ave","4th Ave","5th Ave","6th Ave","7th Ave","8th Ave","9th Ave","10th Ave","11th Ave","Park Blvd","13th St","14th St","15th St","16th St","17th St"];
const vL=avN.map((n,i)=>lon(-117.1695+i*0.00098,n,["Park Blvd","India St","5th Ave","6th Ave","1st Ave"].includes(n)?22:18));
vL.push(lon(-117.1712,"Pacific Hwy",34),lon(-117.1400,"25th St",22),lon(-117.1300,"30th St",24),lon(-117.1450,"19th St"));
const ewS=["Broadway","C St","B St","A St","Ash St","Beech St","Cedar St","Date St","Elm St","Fir St","Grape St","Hawthorn St","Ivy St","Juniper St","Kalmia St","Laurel St"];
const uL=ewS.map((n,i)=>lat(32.7155+i*0.00087,n,["Broadway","Ash St","Grape St","Hawthorn St","Laurel St"].includes(n)?24:18));
uL.push(lat(32.7146,"E St"),lat(32.7137,"F St"),lat(32.7128,"G St"),lat(32.7117,"Market St",24),lat(32.7107,"Island Ave"),lat(32.7097,"J St"),lat(32.7087,"K St"),lat(32.7077,"L St"),lat(32.7066,"Imperial Ave",26),lat(32.7405,"Upas St",20),lat(32.7460,"Robinson Ave"),lat(32.7486,"University Ave",24),lat(32.7040,"National Ave"),lat(32.7000,"Logan Ave"));
const polys={
 BAY:[[32.6650,-117.2250],[32.7280,-117.2250],[32.7285,-117.1950],[32.7290,-117.1830],[32.7300,-117.1772],[32.7250,-117.1747],[32.7200,-117.1744],[32.7155,-117.1754],[32.7100,-117.1732],[32.7075,-117.1692],[32.7050,-117.1642],[32.7020,-117.1592],[32.6990,-117.1542],[32.6930,-117.1472],[32.6850,-117.1402],[32.6750,-117.1332],[32.6650,-117.1282]],
 CORO:[[32.7120,-117.2250],[32.7120,-117.1950],[32.7080,-117.1850],[32.7000,-117.1732],[32.6950,-117.1682],[32.6880,-117.1642],[32.6780,-117.1622],[32.6650,-117.1600],[32.6650,-117.2250]],
 HISL:[[32.7230,-117.2130],[32.7265,-117.2050],[32.7265,-117.1880],[32.7238,-117.1880],[32.7225,-117.2050]],
 AIRPORT:[[32.7292,-117.2150],[32.7375,-117.2150],[32.7405,-117.1900],[32.7365,-117.1800],[32.7302,-117.1822]],
 BALBOA:[[32.7215,-117.1560],[32.7405,-117.1560],[32.7405,-117.1300],[32.7215,-117.1300]],
 DT:[[32.7300,-117.1760],[32.7300,-117.1600],[32.7270,-117.1490],[32.7200,-117.1455],[32.7100,-117.1440],[32.7030,-117.1480],[32.7000,-117.1560],[32.7050,-117.1700]]
};
G.cities.sd={
 key:"sd",name:"San Diego",state:"CA",area:"Downtown · Little Italy · Balboa Park · Coronado",center:[32.715,-117.160],seed:61,
 landMode:"water",water:["BAY"],land:["CORO","HISL"],polys,rivers:[],
 noBuild:["AIRPORT"],
 runway:[[32.7340,-117.2120],[32.7368,-117.1840]],
 parks:[{poly:"BALBOA"},{ll:[32.7215,-117.1725],r:90},{ll:[32.7060,-117.1700],r:90},{ll:[32.7040,-117.1650],r:80},{ll:[32.7085,-117.1640],r:50},{ll:[32.7100,-117.1675],r:40},{ll:[32.6995,-117.1440],r:60},{ll:[32.7580,-117.1950],r:220},{ll:[32.6870,-117.1650],r:120},{ll:[32.6880,-117.1780],r:60}],
 regions:[
  {id:"coro",angle:45,pitch:[90,140,16],test:H=>H.in("CORO")},
  {id:"loma",angle:28,pitch:[100,140,16],test:H=>H.lon<-117.196&&H.lat>32.726},
  {id:"grid",origin:[32.7155,-117.1695],angle:0,uLines:uL,vLines:vL,fillU:110,fillV:105,fillW:15,marks:true,test:()=>true}],
 roads:[
  {n:"Harbor Dr",w:34,pts:[[32.7330,-117.1990],[32.7300,-117.1785],[32.7200,-117.1735],[32.7130,-117.1735],[32.7090,-117.1700],[32.7070,-117.1640],[32.7055,-117.1580],[32.7020,-117.1520],[32.6950,-117.1450]]},
  {n:"I-5",w:60,hwy:true,pts:[[32.6900,-117.1360],[32.7100,-117.1440],[32.7200,-117.1455],[32.7270,-117.1490],[32.7320,-117.1600],[32.7380,-117.1700],[32.7500,-117.1850],[32.7620,-117.1990]]},
  {n:"SR 163",w:50,hwy:true,pts:[[32.7270,-117.1490],[32.7330,-117.1530],[32.7400,-117.1555],[32.7620,-117.1580]]},
  {n:"Park Blvd",w:26,pts:[[32.7230,-117.1525],[32.7330,-117.1500],[32.7480,-117.1470]]},
  {n:"Rosecrans St",w:26,pts:[[32.7400,-117.2150],[32.7480,-117.2050],[32.7560,-117.1970]]}],
 landmarks:[
  {n:"One America Plaza",ll:[32.7163,-117.1689],h:152,w:44,shape:"taper"},
  {n:"Manchester Grand Hyatt",ll:[32.7105,-117.1677],h:151,w:40,shape:"glass"},
  {n:"Symphony Towers",ll:[32.7173,-117.1580],h:152,w:40,shape:"spire"},
  {n:"Electra",ll:[32.7176,-117.1658],h:145,w:30,shape:"spire"},
  {n:"Emerald Plaza",ll:[32.7148,-117.1640],h:137,w:36,shape:"glass"},
  {n:"Pinnacle Marina Tower",ll:[32.7105,-117.1585],h:140,w:32,shape:"glass"},
  {n:"Petco Park",ll:[32.7073,-117.1566],h:45,w:260,d:230,shape:"arena"},
  {n:"San Diego Convention Center",ll:[32.7060,-117.1615],h:30,w:1000,d:150,shape:"box",rot:-25},
  {n:"USS Midway",ll:[32.7137,-117.1751],h:60,w:75,d:300,shape:"ship"},
  {n:"California Tower",ll:[32.7317,-117.1527],h:61,w:12,shape:"spire"},
  {n:"Hotel del Coronado",ll:[32.6809,-117.1782],h:35,w:150,d:100,shape:"hotel"}],
 bridges:[{n:"Coronado Bridge",a:[32.6990,-117.1470],b:[32.6855,-117.1640],deck:61,tower:0,kind:"girder"}],
 hoods:[["Gaslamp Quarter",32.7115,-117.1598],["East Village",32.7100,-117.1520],["Marina",32.7080,-117.1650],["Little Italy",32.7250,-117.1690],["Cortez Hill",32.7220,-117.1580],["Columbia",32.7200,-117.1680],["Bankers Hill",32.7300,-117.1620],["Hillcrest",32.7480,-117.1620],["Balboa Park",32.7320,-117.1450],["Golden Hill",32.7180,-117.1360],["South Park",32.7250,-117.1280],["North Park",32.7480,-117.1300],["Barrio Logan",32.6980,-117.1470],["Sherman Heights",32.7090,-117.1430],["Logan Heights",32.7000,-117.1380],["Mission Hills",32.7520,-117.1720],["Middletown",32.7350,-117.1700],["Coronado",32.6850,-117.1800],["Point Loma",32.7350,-117.2100],["Old Town",32.7540,-117.1980],["Harbor Island",32.7250,-117.2000],["San Diego Int'l Airport",32.7338,-117.1970]],
 industrial:[{ll:[32.6930,-117.1500],r:500},{ll:[32.7000,-117.2100],r:1500}],
 hills:[{ll:[32.7350,-117.1450],h:90,r:1500},{ll:[32.7480,-117.1620],h:80,r:1200},{ll:[32.7180,-117.1360],h:60,r:900},{ll:[32.7420,-117.2150],h:60,r:900},{ll:[32.7550,-117.1850],h:70,r:900}],
 elev:{b:2.4,slope:.02,cap:20},
 centers:[[32.7155,-117.1620,105,520],[32.7095,-117.1580,90,450],[32.7240,-117.1690,50,400],[32.7220,-117.1580,60,300],[32.7480,-117.1620,22,650]],
 base:7,hMul:1.2,towerP:1,maxH:152,
 style:{lotW:[13,19],depth:[14,20],side:4,house:true,houseH:12,gable:.75,tank:0,glass:1,setback:.1,trees:.45,palm:true,palette:"sd",office:.8},
 baseline:{pop:1404000,hhIncome:104321,unemp:4.6,homeValue:916964,rent:2900,homeless:5866,unsheltered:.57,violent:372.3,property:1539.0,budget:6.1,police:1800,transit:250000,carShare:.78,commute:24.4,congestion:31.9,jobs:800000,vacancy:.04,age:[.20,.28,.38,.14],income:[.25,.43,.32],jobGrowth:.0025,rentTrend:.009,taxBase:.25},
 sources:{homeless:"Regional Task Force on Homelessness, City of San Diego 2025 PIT",crime:"FBI 2025 (via Security.org)",homeValue:"Zillow ZHVI, metro, Dec 2025",congestion:"TomTom Traffic Index 2025: 31.9%, #42 in US"},
 validation:{district:{poly:"DT",name:"Downtown employment center",jobs:104867,src:"SANDAG InfoBits, Feb 2024"},t150:3,t100:41},
 events:["smoke","sewage","comiccon","drought","biotech","kingtide","quake","fedcut","heat"]
};})();

G.order=["nyc","chi","sf","sea","sd"];
window.GEO=G;
})();
