/* Gridline 3D engine: builds a city from GEO data, renders it with three.js, runs the traffic model,
   and exposes previews / construction / overlays for the game layer. */
(function(){
"use strict";
const T=THREE, D=Math.PI/180;
let EXT=5000, TEXN=2048, PX=2*EXT/TEXN, RG=500, RPX=2*EXT/RG, EG=250, NV=EG+1, EPX=2*EXT/EG, CG=64, CPX=2*EXT/CG;
// each city sets its own frame size (NYC covers all of Manhattan)
function setFrame(ext){EXT=ext;TEXN=ext>6000?3072:2048;PX=2*EXT/TEXN;RG=ext>6000?800:500;RPX=2*EXT/RG;EG=ext>6000?400:250;NV=EG+1;EPX=2*EXT/EG;CPX=2*EXT/CG;E.EXT=EXT;E.CPX=CPX;
  if(controls){controls.maxDistance=EXT*3.2;}if(water&&water.material.uniforms)water.material.uniforms.ext.value=EXT;if(E._haze)for(const m of E._haze)m.scale.set(EXT*Math.SQRT2+250,2600,EXT*Math.SQRT2+250);}
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t;
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const gauss=r=>Math.sqrt(-2*Math.log(r()+1e-9))*Math.cos(2*Math.PI*r());
const E={EXT,CG,CPX}; window.ENGINE=E;
let C=null, LAT0=0, LON0=0, KX=1; const KZ=110540;
const P=ll=>[(ll[1]-LON0)*KX,(LAT0-ll[0])*KZ];
const toLL=(x,z)=>[LAT0-z/KZ,LON0+x/KX];
E.P=P; E.toLL=toLL;

/* ---------- geometry helpers ---------- */
function mkPoly(arr){const p=arr.map(P);let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const q of p){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);z0=Math.min(z0,q[1]);z1=Math.max(z1,q[1]);}p.bb=[x0,x1,z0,z1];return p;}
function pip(x,z,p){if(!p)return false;if(p.bb&&(x<p.bb[0]||x>p.bb[1]||z<p.bb[2]||z>p.bb[3]))return false;let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(((a[1]>z)!==(b[1]>z))&&(x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;}
function segDist(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],L=dx*dx+dz*dz;let t=L?((x-a[0])*dx+(z-a[1])*dz)/L:0;t=clamp(t,0,1);const px=a[0]+t*dx-x,pz=a[1]+t*dz-z;return Math.sqrt(px*px+pz*pz);}
function lineDist(x,z,pts){let m=1e9;for(let i=0;i<pts.length-1;i++){const d=segDist(x,z,pts[i],pts[i+1]);if(d<m)m=d;}return m;}
function xOnLine(pts,z){for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];if((z-a[1])*(z-b[1])<=0&&a[1]!==b[1])return a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]);}const f=pts[0],l=pts[pts.length-1];return Math.abs(z-f[1])<Math.abs(z-l[1])?f[0]:l[0];}
function polyLen(pts){let s=0;for(let i=0;i<pts.length-1;i++)s+=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);return s;}
function samplePath(pts,step){const out=[];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/step));for(let k=0;k<n;k++){const t=k/n;out.push([lerp(a[0],b[0],t),lerp(a[1],b[1],t),Math.atan2(b[1]-a[1],b[0]-a[0])]);}}const l=pts[pts.length-1],q=pts[pts.length-2]||l;out.push([l[0],l[1],Math.atan2(l[1]-q[1],l[0]-q[0])]);return out;}
E.polyLen=polyLen; E.samplePath=samplePath;

/* ---------- renderer / scene ---------- */
let renderer,scene,camera,controls,sun,hemi,skyMesh,water,floodMesh,canvasEl,cityG=null,previewG,fxG;
const U={uNight:{value:0},uWin:{value:1}};
function facadeMat(glass){
  const m=new T.MeshStandardMaterial({color:0xffffff,roughness:glass?.3:.86,metalness:glass?.3:0});
  const ug={value:glass?1:0};
  m.onBeforeCompile=s=>{
    s.uniforms.uNight=U.uNight;s.uniforms.uWin=U.uWin;s.uniforms.uGlass=ug;
    s.vertexShader=s.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vLoc;varying vec3 vNrm;varying float vSeed;varying float vH;")
     .replace("#include <begin_vertex>",`#include <begin_vertex>
vec3 sc=vec3(1.0);float sd=0.37;float hh=1000.0;
#ifdef USE_INSTANCING
sc=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
sd=fract(sin(dot(instanceMatrix[3].xz,vec2(12.9898,78.233)))*43758.5453);hh=sc.y;
#endif
vLoc=position*sc;vNrm=normal;vSeed=sd;vH=hh;`);
    s.fragmentShader=s.fragmentShader.replace("#include <common>","#include <common>\nvarying vec3 vLoc;varying vec3 vNrm;varying float vSeed;varying float vH;uniform float uNight;uniform float uWin;uniform float uGlass;\nfloat hsh(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}")
     .replace("#include <color_fragment>",`#include <color_fragment>
float wallF=1.0-step(0.6,abs(vNrm.y));
float fl=vLoc.y; float fh=mix(3.6,4.0,uGlass); float fy=fract(fl/fh); float fid=floor(fl/fh);
vec2 tg=normalize(vec2(-vNrm.z,vNrm.x)+vec2(1e-5)); float ho=dot(vLoc.xz,tg);
float bay=mix(3.1,1.6,uGlass)*(0.85+0.35*vSeed); float bx=fract(ho/bay); float bid=floor(ho/bay);
float win=step(mix(0.3,0.08,uGlass),fy)*step(fy,mix(0.82,0.97,uGlass))*step(mix(0.22,0.05,uGlass),bx)*step(bx,mix(0.78,0.95,uGlass));
float gfl=1.0-step(4.6,fl); win=mix(win,step(0.08,bx)*step(bx,0.92)*step(0.4,fl)*step(fl,3.9),gfl*(1.0-uGlass));
win*=1.0-step(vH-1.1,fl); win*=step(2.5,vH); win*=wallF;
vec3 wc=mix(vec3(0.17,0.2,0.25),vec3(0.38,0.48,0.58),uGlass)*(0.78+0.5*hsh(vec3(bid,fid,vSeed)));
diffuseColor.rgb=mix(diffuseColor.rgb,wc,win*uWin*mix(0.88,0.6,uGlass));
diffuseColor.rgb*=mix(1.0,0.8,step(0.6,vNrm.y));
diffuseColor.rgb*=mix(0.7,1.0,smoothstep(0.0,9.0,fl));
float lit=step(0.7,hsh(vec3(bid*1.7,fid*2.3,vSeed*91.0)))*(0.55+0.45*hsh(vec3(fid,bid,3.1)));`)
     .replace("#include <emissivemap_fragment>","#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.0,0.78,0.48)*win*lit*uNight*uWin*0.85;diffuseColor.rgb*=1.0-0.55*uNight*wallF;");
  };
  m.customProgramCacheKey=()=>glass?"facG":"facM";
  return m;
}
function dashMat(color,period,duty,opacity){
  const m=new T.MeshBasicMaterial({color,transparent:opacity<1,opacity:opacity||1,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
  m.onBeforeCompile=s=>{
    s.vertexShader=s.vertexShader.replace("#include <common>","#include <common>\nvarying float vD;").replace("#include <begin_vertex>","#include <begin_vertex>\nfloat ln=1.0;\n#ifdef USE_INSTANCING\nln=length(instanceMatrix[0].xyz);\n#endif\nvD=(position.x+0.5)*ln;");
    s.fragmentShader=s.fragmentShader.replace("#include <common>","#include <common>\nvarying float vD;").replace("void main() {",`void main() {\nif(${period.toFixed(2)}>0.0 && fract(vD/${period.toFixed(2)})>${duty.toFixed(2)}) discard;`);
  };
  m.customProgramCacheKey=()=>"dash"+period+duty;
  return m;
}
const MAT={};
function initMaterials(){
  MAT.m=facadeMat(false); MAT.g=facadeMat(true);
  MAT.roof=new T.MeshStandardMaterial({color:0xffffff,roughness:.9});
  MAT.mech=new T.MeshStandardMaterial({color:0xffffff,roughness:.8});
  MAT.tank=new T.MeshStandardMaterial({color:0x8a6a4c,roughness:.95});
  MAT.pad=new T.MeshStandardMaterial({color:0xffffff,roughness:.95});
  MAT.crown=new T.MeshStandardMaterial({color:0xffffff,roughness:.95,flatShading:true});
  MAT.trunk=new T.MeshStandardMaterial({color:0x5b4636,roughness:1});
  MAT.car=new T.MeshStandardMaterial({color:0xffffff,roughness:.45,metalness:.3});
  MAT.yellow=dashMat(0xf2c230,0,1,1); MAT.white=dashMat(0xf4f4ee,9,.45,1); MAT.zebra=dashMat(0xf4f4ee,1.2,.5,.95);
  MAT.lm=facadeMat(false); MAT.lmG=facadeMat(true);
  MAT.steel=new T.MeshStandardMaterial({color:0x9aa4ad,roughness:.5,metalness:.6});
  MAT.stone=new T.MeshStandardMaterial({color:0xc8bba4,roughness:.9});
  MAT.cable=new T.LineBasicMaterial({color:0x8d969e});
  MAT.crane=new T.MeshStandardMaterial({color:0xf1b51c,roughness:.6});
  MAT.ghost=new T.MeshStandardMaterial({color:0x3b6cff,transparent:true,opacity:.55,emissive:0x1a3fd0,emissiveIntensity:.9,depthWrite:false});
  MAT.ghostEdge=new T.LineBasicMaterial({color:0xbfd0ff,transparent:true,opacity:.9});
  MAT.ghostRed=new T.MeshBasicMaterial({color:0xff5a4a,transparent:true,opacity:.35,depthWrite:false});
}
E.init=function(canvas){
  canvasEl=canvas;
  renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance",logarithmicDepthBuffer:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.outputEncoding=T.sRGBEncoding; renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.0;
  scene=new T.Scene(); scene.fog=new T.Fog(0xcfdbe6,6000,22000);
  camera=new T.PerspectiveCamera(40,1,2,80000);
  controls=new T.MapControls(camera,canvas);
  controls.enableDamping=true; controls.dampingFactor=.12; controls.screenSpacePanning=false;
  controls.maxPolarAngle=1.5; controls.minDistance=35; controls.maxDistance=16000; controls.zoomSpeed=1.2;
  hemi=new T.HemisphereLight(0xdfe9f5,0x7d7468,.5); scene.add(hemi);
  sun=new T.DirectionalLight(0xffffff,2.2); sun.castShadow=true; sun.shadow.mapSize.set(4096,4096);
  sun.shadow.bias=-0.0003; sun.shadow.normalBias=0.6; scene.add(sun); scene.add(sun.target);
  initMaterials();
  // sky dome
  const sg=new T.SphereGeometry(40000,32,16);
  skyMesh=new T.Mesh(sg,new T.ShaderMaterial({side:T.BackSide,depthWrite:false,fog:false,uniforms:{top:{value:new T.Color(0x6f9fd8)},hor:{value:new T.Color(0xdbe7f1)},sunDir:{value:new T.Vector3(0,1,0)},sunCol:{value:new T.Color(0xfff2d9)}},
    vertexShader:"varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:"uniform vec3 top;uniform vec3 hor;uniform vec3 sunDir;uniform vec3 sunCol;varying vec3 vP;void main(){float h=clamp(vP.y,0.0,1.0);vec3 c=mix(hor,top,pow(h,0.55));float s=max(dot(vP,normalize(sunDir)),0.0);c+=sunCol*(pow(s,600.0)*1.5+pow(s,8.0)*0.18);gl_FragColor=vec4(c,1.0);}"}));
  skyMesh.renderOrder=-1; scene.add(skyMesh);
  // water with procedural normal map
  const wn=document.createElement("canvas"); wn.width=wn.height=256; const wc=wn.getContext("2d"), wi=wc.createImageData(256,256), r=rng(3);
  const hgt=new Float32Array(256*256); for(let k=0;k<6;k++){const fx=1+Math.floor(r()*6),fy=1+Math.floor(r()*6),ph=r()*6.28,am=1/(k+1);for(let y=0;y<256;y++)for(let x=0;x<256;x++)hgt[y*256+x]+=am*Math.sin((x*fx+y*fy)/256*6.283+ph);}
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=y*256+x,dx=hgt[y*256+((x+1)&255)]-hgt[i],dy=hgt[((y+1)&255)*256+x]-hgt[i];wi.data[i*4]=128+dx*90;wi.data[i*4+1]=128+dy*90;wi.data[i*4+2]=255;wi.data[i*4+3]=255;}
  wc.putImageData(wi,0,0); const wt=new T.CanvasTexture(wn); wt.wrapS=wt.wrapT=T.RepeatWrapping; wt.repeat.set(900,900);
  wt.repeat.set(1,1);
  const blank=new T.DataTexture(new Uint8Array([255,0,0,255]),1,1,T.RGBAFormat);blank.needsUpdate=true;
  water=new T.Mesh(new T.PlaneGeometry(80000,80000),new T.ShaderMaterial({fog:true,
    uniforms:T.UniformsUtils.merge([T.UniformsLib.fog,{time:{value:0},nrm:{value:null},depthTex:{value:null},sunDir:{value:new T.Vector3(0,1,0)},sunCol:{value:new T.Color(1,1,1)},skyTop:{value:new T.Color(0x6f9fd8)},skyHor:{value:new T.Color(0xdbe7f1)},
      deep:{value:new T.Color(0x0d3247)},shallow:{value:new T.Color(0x3d7f86)},night:{value:0},ext:{value:EXT},haze:{value:new T.Color(0xdbe7f1)}}]),
    vertexShader:`varying vec3 vW;
#include <fog_pars_vertex>
void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader:`uniform float time,night,ext;uniform sampler2D nrm,depthTex;uniform vec3 sunDir,sunCol,skyTop,skyHor,deep,shallow,haze;varying vec3 vW;
#include <fog_pars_fragment>

      vec3 nAt(vec2 p){return texture2D(nrm,p).xyz*2.0-1.0;}
      void main(){vec2 p=vW.xz;
        vec3 n1=nAt(p/173.0+vec2(time*.011,time*.007)),n2=nAt(p/61.0+vec2(-time*.017,time*.013)),n3=nAt(p/23.0+vec2(time*.03,-time*.021));
        vec3 n=normalize(vec3((n1.x+n2.x*.7+n3.x*.45)*.55,1.0,(n1.y+n2.y*.7+n3.y*.45)*.55));
        vec3 V=normalize(cameraPosition-vW);vec3 R=reflect(-V,n);
        float fres=.02+.98*pow(1.0-max(dot(n,V),0.0),5.0);
        vec3 sky=mix(skyHor,skyTop,pow(clamp(R.y,0.0,1.0),.5));
        vec2 uv=(p+ext)/(2.0*ext);float dpt=1.0;if(uv.x>0.0&&uv.x<1.0&&uv.y>0.0&&uv.y<1.0)dpt=texture2D(depthTex,uv).r;
        float sh=smoothstep(0.0,1.0,dpt)*.85;vec3 body=mix(shallow,deep,sh)*(1.0-night*.85);
        float sp=pow(max(dot(R,normalize(sunDir)),0.0),420.0)*3.5+pow(max(dot(R,normalize(sunDir)),0.0),40.0)*.18;
        vec3 col=mix(body,sky*(1.0-night*.6),clamp(fres*1.1,0.0,.9))+sunCol*sp;
        float foam=(1.0-smoothstep(0.0,.035,dpt))*smoothstep(.15,.6,n2.x*.5+n3.y*.5+.4);col=mix(col,vec3(.86,.9,.92)*(1.0-night*.7),foam*.5);
        float ov=max(abs(p.x),abs(p.y))-ext;float hz=smoothstep(-350.0,220.0,ov);
        gl_FragColor=vec4(col,1.0);
#include <tonemapping_fragment>
#include <encodings_fragment>
#include <fog_fragment>
 gl_FragColor.rgb=mix(gl_FragColor.rgb,haze,hz);}`}));
  water.material.uniforms.nrm.value=wt;water.material.uniforms.depthTex.value=blank;
  water.rotation.x=-Math.PI/2; water.position.y=0; scene.add(water);
  // haze curtain around the edge of the modeled area: the world beyond fades into fog
  {const cg=new T.CylinderGeometry(1,1,1,4,1,true);const cm=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,fog:false,uniforms:{haze:{value:new T.Color(0xdbe7f1)}},
    vertexShader:"varying float vY;void main(){vY=uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:"uniform vec3 haze;varying float vY;void main(){gl_FragColor=vec4(haze,pow(1.0-vY,2.4)*.97);}"});
   for(const r of [1.0]){const m=new T.Mesh(cg,cm);m.scale.set(EXT*Math.SQRT2+250,2600,EXT*Math.SQRT2+250);m.rotation.y=Math.PI/4;m.position.y=1300-40;m.renderOrder=1;scene.add(m);E._haze=E._haze||[];E._haze.push(m);}
   E._hazeMat=cm;}
  floodMesh=new T.Mesh(new T.PlaneGeometry(2*EXT,2*EXT),new T.MeshStandardMaterial({color:0x3f7896,roughness:.3,transparent:true,opacity:.86,normalMap:wt}));
  floodMesh.rotation.x=-Math.PI/2; floodMesh.visible=false; scene.add(floodMesh);
  previewG=new T.Group(); scene.add(previewG); fxG=new T.Group(); scene.add(fxG);
  initWeather(); bindInput(); E.resize();
  window.addEventListener("resize",E.resize);
  requestAnimationFrame(loop);
};
let viewShift=0;
E.resize=function(){if(!renderer)return;const w=canvasEl.clientWidth||window.innerWidth,h=canvasEl.clientHeight||window.innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;if(viewShift)camera.setViewOffset(w,h,-viewShift,0,w,h);else camera.clearViewOffset();camera.updateProjectionMatrix();};
E.setViewShift=function(px){viewShift=Math.round(px||0);E.resize();};

/* ---------- city state ---------- */
let polys={}, lines={}, REG=[], rgrid, cls, elevV, B=[], blocks=[], MESH={}, cells=null, streetCnt, hwyCnt, landPx=0, parkPx=0, groundTex, groundMesh, overlayTex, overlayCanvas, overlayMesh, miniImg=null;
let anchors=[], anchorGrid=new Map(), hoodL=[], lmL=[], projL=[];
let cars=[], carMesh, cityRng;
const CAP={m:3000,g:1500,c:300,r:2000,k:4000,t:600};
E.ready=false;

function regionAt(x,z){const i=Math.floor((x+EXT)/RPX),j=Math.floor((z+EXT)/RPX);if(i<0||j<0||i>=RG||j>=RG)return null;const k=rgrid[j*RG+i];return k===255?null:REG[k];}
function clsAt(x,z){const i=Math.floor((x+EXT)/PX),j=Math.floor((z+EXT)/PX);if(i<0||j<0||i>=TEXN||j>=TEXN)return 0;return cls[j*TEXN+i];}
function elevAt(x,z){
  const fx=(x+EXT)/EPX,fz=(z+EXT)/EPX;let i=Math.floor(fx),j=Math.floor(fz);i=clamp(i,0,EG-1);j=clamp(j,0,EG-1);const tx=clamp(fx-i,0,1),tz=clamp(fz-j,0,1);
  const a=elevV[j*NV+i],b=elevV[j*NV+i+1],c=elevV[(j+1)*NV+i],d=elevV[(j+1)*NV+i+1];
  return lerp(lerp(a,b,tx),lerp(c,d,tx),tz);
}
function cellOf(x,z){return clamp(Math.floor((z+EXT)/CPX),0,CG-1)*CG+clamp(Math.floor((x+EXT)/CPX),0,CG-1);}
E.elevAt=(x,z)=>elevV?Math.max(0,elevAt(x,z)):0; E.clsAt=(x,z)=>cls?clsAt(x,z):0; E.cellOf=cellOf;

/* region frame */
function frame(R,x,z){const dx=x-R.o[0],dz=z-R.o[1];return [dx*R.du[0]+dz*R.du[1],dx*R.dv[0]+dz*R.dv[1]];}
function world(R,u,v){return [R.o[0]+u*R.du[0]+v*R.dv[0],R.o[1]+u*R.du[1]+v*R.dv[1]];}
function lineName(l,other){if(!l||!l.name)return null;if(typeof l.name==="function")return l.name(other);if(Array.isArray(l.name)){for(const [lim,n] of l.name)if(other<=lim)return n;return l.name[l.name.length-1][1];}return l.name;}
function active(l,other){return !l.r||(other>=l.r[0]&&other<=l.r[1]);}
function findLine(L,c,other){let lo=0,hi=L.length-1;if(hi<0)return null;while(lo<hi){const m=(lo+hi)>>1;if(L[m].p<c)lo=m+1;else hi=m;}for(let k=lo-1;k<=lo+1;k++){const l=L[k];if(l&&Math.abs(c-l.p)<=l.w/2&&active(l,other))return l;}return null;}

function prepLines(R,specs,axis,fill,fillW){
  const L=[];
  for(const s of specs){let p=s.p;if(p==null){const pt=s.lat!=null?P([s.lat,R.oLL[1]]):P([R.oLL[0],s.lon]);const f=frame(R,pt[0],pt[1]);p=axis==="u"?f[0]:f[1];}
    L.push({p,w:s.w||18,name:s.name||null,r:s.r||null,named:!!s.name,ax:axis});}
  L.sort((a,b)=>a.p-b.p);
  if(!(fill>0))return L;
  const out=[],lo=-9500,hi=9500;
  if(!L.length){for(let p=lo;p<hi;p+=fill)out.push({p,w:fillW,name:null,ax:axis});return out;}
  for(let p=L[0].p-fill;p>lo;p-=fill)out.push({p,w:fillW,name:null,ax:axis});
  for(let i=0;i<L.length;i++){out.push(L[i]);if(i<L.length-1){const g=L[i+1].p-L[i].p,n=Math.ceil(g/fill)-1;for(let k=1;k<=n;k++)out.push({p:L[i].p+g*k/(n+1),w:fillW,name:null,ax:axis});}}
  for(let p=L[L.length-1].p+fill;p<hi;p+=fill)out.push({p,w:fillW,name:null,ax:axis});
  out.sort((a,b)=>a.p-b.p);return out;
}

/* ---------- load city ---------- */
E.load=async function(key,progress){E.key=key;setFrame(GEO.cities[key].ext||5000);OQ=GEO.cities[key].oq||.25;
  progress=progress||(()=>{});
  const tick=(t,m)=>new Promise(res=>{progress(t,m);setTimeout(res,0);});
  E.ready=false; clearCity();
  C=GEO.cities[key]; E.city=C; LAT0=C.center[0]; LON0=C.center[1]; KX=111320*Math.cos(LAT0*D);
  cityRng=rng(C.seed);
  polys={}; for(const k in C.polys)polys[k]=mkPoly(C.polys[k]);
  lines={}; if(C.lines)for(const k in C.lines)lines[k]=C.lines[k].map(P);
  C._market=C.market?C.market.map(P):null;
  REG=C.regions.map((g,i)=>{
    const oLL=g.origin||C.center,o=P(oLL),a=g.angle*D;
    const R={id:g.id,i,oLL,o,a,du:[Math.sin(a),-Math.cos(a)],dv:[Math.cos(a),Math.sin(a)],test:g.test,marks:!!g.marks,named:!!g.uLines};
    if(g.pitch){const [bu,bv,sw]=g.pitch;const uL=[],vL=[];for(let k=-Math.ceil(9500/(bu+sw));k<=Math.ceil(9500/(bu+sw));k++)uL.push({p:k*(bu+sw),w:sw,name:null,ax:"u"});for(let k=-Math.ceil(9500/(bv+sw));k<=Math.ceil(9500/(bv+sw));k++)vL.push({p:k*(bv+sw),w:sw,name:null,ax:"v"});R.uL=uL;R.vL=vL;}
    else{R.uL=prepLines(R,g.uLines,"u",g.fillU,g.fillW||14);R.vL=prepLines(R,g.vLines,"v",g.fillV,g.fillW||14);}
    return R;});
  await tick(.04,"Loading OpenStreetMap buildings and roads");
  OSM=await loadOSM(key);E.osmMode=!!OSM;E.KCAP=OSM?1.13:0.95;if(OSM)buildOSMNet();
  await tick(.08,"Tracing shorelines");
  buildRegionGrid(); await tick(.18,"Laying out streets");
  buildMasks(); await tick(.36,"Shaping terrain");
  buildTerrain(); await tick(.5,"Raising buildings");
  cityG=new T.Group(); scene.add(cityG);
  cityG.add(groundMesh); cityG.add(overlayMesh);
  if(OSM)genOSM();else genCity(); await tick(.7,"Adding landmarks");
  buildLandmarks(); buildBridges(); await tick(.8,"Painting lanes");
  buildMeshes(); if(OSM){buildOSMMeshes();recolor();buildOSMRoads();buildOSMMarkings();buildOSMAnchors();}else{buildMarkings(); buildAnchors();} await tick(.9,"Starting traffic");
  if(OSM){initCarsOSM();initPeds();initTrains();}else initCars(); computeCells(); E.calibrateTraffic(); await tick(.95,"Mapping transit lines"); await buildTransit(key);
  floodMesh.visible=false;
  const cam=C.cam||null; E.home();
  E.ready=true; await tick(1,"Ready");
  return E.stats();
};
function clearCity(){
  if(cityG){scene.remove(cityG);cityG.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material.map&&o.material!==water.material)o.material.map.dispose();});}
  if(transitG){scene.remove(transitG);transitG=null;} cityG=null; OCH=[]; previewG.clear(); fxG.clear(); B=[]; blocks=[]; MESH={}; anchors=[]; anchorGrid=new Map(); hoodL=[]; lmL=[]; projL=[]; cars=[]; E.projects=new Map(); miniImg=null;
}
E.home=function(){
  // frame the busiest center from the south-west
  const c=C.centers.slice().sort((a,b)=>b[2]-a[2])[0]; const p=P([c[0],c[1]]);
  controls.target.set(p[0],0,p[1]); camera.position.set(p[0]-1800,1900,p[1]+2600); controls.update();
};

/* ---------- region grid + masks ---------- */
function makeH(){
  const H={x:0,z:0,lat:0,lon:0,u:0,v:0,side:0,in:n=>pip(H.x,H.z,polys[n]),west:n=>H.x<xOnLine(lines[n],H.z)};
  return H;
}
function buildRegionGrid(){
  rgrid=new Uint8Array(RG*RG).fill(255); const H=makeH();
  const mk=C._market;
  for(let j=0;j<RG;j++)for(let i=0;i<RG;i++){
    const x=-EXT+(i+.5)*RPX,z=-EXT+(j+.5)*RPX; H.x=x;H.z=z;const ll=toLL(x,z);H.lat=ll[0];H.lon=ll[1];
    if(mk){const a=mk[0],b=mk[1];H.side=(b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]);H.side=-H.side;}
    for(const R of REG){const f=frame(R,x,z);H.u=f[0];H.v=f[1];if(R.test(H)){rgrid[j*RG+i]=R.i;break;}}
  }
}
function drawPoly(ctx,p){ctx.beginPath();p.forEach((q,k)=>{const x=(q[0]+EXT)/PX,y=(q[1]+EXT)/PX;k?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.fill();}
function drawLine(ctx,pts,w){ctx.lineWidth=Math.max(1,w/PX);ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();pts.forEach((q,k)=>{const x=(q[0]+EXT)/PX,y=(q[1]+EXT)/PX;k?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
function mkCanvas(n){const c=document.createElement("canvas");c.width=c.height=n;return c;}
/* Land vs water from real data: OpenStreetMap coastlines (land lies to the left of each coastline way),
   streets and buildings seed "land", the traced shoreline seeds "water" only far from any city fabric,
   and every unlabeled pixel takes the label of its nearest seed. Lakes and rivers are then carved in. */
function osmLandMask(l){
  const base=l.getImageData(0,0,TEXN,TEXN).data;
  const fc=mkCanvas(TEXN),f=fc.getContext("2d");f.fillStyle="#000";f.fillRect(0,0,TEXN,TEXN);f.fillStyle="#f00";f.strokeStyle="#f00";
  // red: city fabric (land seed); green: within 160 m of fabric (traced shoreline not trusted there)
  const fabric=(w,near)=>{f.lineWidth=1;for(const b of OSM.bl){if(b.part)continue;const p=b.pts;f.beginPath();for(let k=0;k<p.length;k+=2){const x=(p[k]+EXT)/PX,y=(p[k+1]+EXT)/PX;k?f.lineTo(x,y):f.moveTo(x,y);}f.closePath();f.fill();if(w){f.lineWidth=w/PX;f.stroke();}}
    for(const r of OSM.roads)if(!(r.fl&6)&&r.ty!==7)drawLine(f,r.pts,roadW(r)+w);};
  f.fillStyle=f.strokeStyle="#f00";fabric(12,false);for(const p of OSM.parks)drawPoly(f,p.pts);
  const F=f.getImageData(0,0,TEXN,TEXN).data;
  // coarse "near the city fabric" grid (within ~160 m)
  const CGd=256,cs=TEXN/CGd,near=new Uint8Array(CGd*CGd),nd=new Int16Array(CGd*CGd).fill(-1),nq=new Int32Array(CGd*CGd);let nh=0,nt=0;
  for(let y=0;y<TEXN;y+=2)for(let x=0;x<TEXN;x+=2)if(F[(y*TEXN+x)*4]>127){const c=(y/cs|0)*CGd+(x/cs|0);if(nd[c]<0){nd[c]=0;nq[nt++]=c;}}
  const R=Math.ceil(160/(PX*cs));while(nh<nt){const c=nq[nh++],x=c%CGd;near[c]=1;if(nd[c]>=R)continue;for(const j of [x>0?c-1:-1,x<CGd-1?c+1:-1,c-CGd,c+CGd])if(j>=0&&j<CGd*CGd&&nd[j]<0){nd[j]=nd[c]+1;nq[nt++]=j;}}
  // coastline sides
  const cc=mkCanvas(TEXN),c=cc.getContext("2d");c.fillStyle="#000";c.fillRect(0,0,TEXN,TEXN);c.lineWidth=2.2;
  for(const pts of OSM.coast||[]){for(const [side,col] of [[1,"#f00"],[-1,"#00f"]]){c.strokeStyle=col;c.beginPath();
    for(let k=0;k<pts.length;k++){const a=pts[Math.max(0,k-1)],b=pts[Math.min(pts.length-1,k+1)];const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1;
      const ox=dz/L*side*2.6*PX,oz=-dx/L*side*2.6*PX;const x=(pts[k][0]+ox+EXT)/PX,y=(pts[k][1]+oz+EXT)/PX;k?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}}
  const CO=c.getImageData(0,0,TEXN,TEXN).data;
  const lab=new Uint8Array(TEXN*TEXN),q=new Int32Array(TEXN*TEXN);let qh=0,qt=0;
  for(let i=0;i<TEXN*TEXN;i++){const o=i*4;let v=0;
    if(F[o]>127)v=1;else if(CO[o]>127&&CO[o+2]<127)v=1;else if(CO[o+2]>127&&CO[o]<127)v=2;
    else if(!near[((i/TEXN|0)/cs|0)*CGd+((i%TEXN)/cs|0)]){const k=((i%TEXN)%23===0&&((i/TEXN|0)%23===0));if(k)v=base[o]>127?1:2;} // sparse weak seeds from the traced map, far from fabric
    if(v){lab[i]=v;q[qt++]=i;}}
  if(!qt){return;}
  while(qh<qt){const i=q[qh++],x=i%TEXN,v=lab[i];
    if(x>0&&!lab[i-1]){lab[i-1]=v;q[qt++]=i-1;}if(x<TEXN-1&&!lab[i+1]){lab[i+1]=v;q[qt++]=i+1;}
    if(i>=TEXN&&!lab[i-TEXN]){lab[i-TEXN]=v;q[qt++]=i-TEXN;}if(i<TEXN*TEXN-TEXN&&!lab[i+TEXN]){lab[i+TEXN]=v;q[qt++]=i+TEXN;}}
  const im=l.createImageData(TEXN,TEXN);for(let i=0;i<TEXN*TEXN;i++){const w=lab[i]===1?255:0;im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=w;im.data[i*4+3]=255;}
  l.putImageData(im,0,0);
  // drop water polygons that swallow city blocks (bad multipolygon assembly or bay outlines drawn over land)
  const bc=OSM.bl.filter(b=>!b.part).map(b=>{let x=0,z=0;const p=b.pts,n=p.length/2;for(let k=0;k<p.length;k+=2){x+=p[k];z+=p[k+1];}return [x/n,z/n];});
  const pip=(x,z,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
  OSM.waterOK=OSM.water.filter(w=>{let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9,A=0;const P=w.pts;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i];x0=Math.min(x0,a[0]);x1=Math.max(x1,a[0]);z0=Math.min(z0,a[1]);z1=Math.max(z1,a[1]);A+=P[j][0]*a[1]-a[0]*P[j][1];}
    A=Math.abs(A/2);let n=0;for(const [x,z] of bc)if(x>x0&&x<x1&&z>z0&&z<z1&&pip(x,z,P))n++;const ok=n<.02*bc.length&&(n<12||n/(A/1e6)<350);if(!ok)console.warn("OSM water skipped:",w.k,n,"buildings inside");return ok;});
  const pArea=P=>{let A=0;for(let i=0,j=P.length-1;i<P.length;j=i++)A+=P[j][0]*P[i][1]-P[i][0]*P[j][1];return Math.abs(A/2);};
  OSM.ponds=OSM.waterOK.filter(w=>pArea(w.pts)<250000&&!w.pts.some(q=>Math.abs(q[0])>EXT-50||Math.abs(q[1])>EXT-50)&&clsAt0(w.pts));OSM.waterOK=OSM.waterOK.filter(w=>!OSM.ponds.includes(w));
  function clsAt0(P){let c=0;for(const q of P){const x=Math.floor((q[0]+EXT)/PX),y=Math.floor((q[1]+EXT)/PX);if(x>=0&&y>=0&&x<TEXN&&y<TEXN&&lab[y*TEXN+x]===1)c++;}return c>P.length*.6;} // surrounded by land
  l.fillStyle="#000";for(const w of OSM.waterOK){l.beginPath();w.pts.forEach((q,k)=>{const x=(q[0]+EXT)/PX,y=(q[1]+EXT)/PX;k?l.lineTo(x,y):l.moveTo(x,y);});l.closePath();l.fill("evenodd");}
  l.fillStyle="#fff";l.strokeStyle="#fff";for(const w of OSM.islands||[])drawPoly(l,w.pts);
  for(const b of OSM.bl)drawPolyF(l,b.pts);for(const r of OSM.roads)if(!(r.fl&6)&&r.ty!==7)drawLine(l,r.pts,roadW(r));
  // distance from shore for water colour (shallow → deep), 256² texture
  const D=256,sc=TEXN/D,dist=new Float32Array(D*D).fill(1e9),Lm=l.getImageData(0,0,TEXN,TEXN).data,qq=new Int32Array(D*D);let h=0,t=0;
  for(let y=0;y<D;y++)for(let x=0;x<D;x++){const o=((y*sc+sc/2|0)*TEXN+(x*sc+sc/2|0))*4;if(Lm[o]>127){dist[y*D+x]=0;qq[t++]=y*D+x;}}
  while(h<t){const i=qq[h++],x=i%D;const nb=[x>0?i-1:-1,x<D-1?i+1:-1,i-D,i+D];for(const j of nb){if(j<0||j>=D*D)continue;if(dist[j]>dist[i]+1){dist[j]=dist[i]+1;qq[t++]=j;}}}
  const dd=new Uint8Array(D*D*4);for(let i=0;i<D*D;i++){const v=Math.min(255,dist[i]*(2*EXT/D)/3);dd[i*4]=v;dd[i*4+3]=255;}
  if(waterDepthTex)waterDepthTex.dispose();waterDepthTex=new T.DataTexture(dd,D,D,T.RGBAFormat);waterDepthTex.magFilter=waterDepthTex.minFilter=T.LinearFilter;waterDepthTex.needsUpdate=true;
  if(water&&water.material.uniforms)water.material.uniforms.depthTex.value=waterDepthTex;
}
let waterDepthTex=null;
function buildMasks(){
  const lc=mkCanvas(TEXN),l=lc.getContext("2d");
  if(C.landMode==="land"){l.fillStyle="#000";l.fillRect(0,0,TEXN,TEXN);l.fillStyle="#fff";for(const n of C.land)drawPoly(l,polys[n]);}
  else{l.fillStyle="#fff";l.fillRect(0,0,TEXN,TEXN);l.fillStyle="#000";for(const n of C.water)if(!(OSM&&(C.osmLakes||[]).includes(n)))drawPoly(l,polys[n]);l.fillStyle="#fff";for(const n of C.land)drawPoly(l,polys[n]);}
  l.strokeStyle="#000";for(const r of C.rivers)drawLine(l,r.pts.map(P),r.w);
  if(OSM)osmLandMask(l);
  const pc=mkCanvas(TEXN),pk=pc.getContext("2d");pk.fillStyle="#000";pk.fillRect(0,0,TEXN,TEXN);pk.fillStyle="#fff";pk.strokeStyle="#fff";
  for(const p of (OSM?[]:C.parks)){
    if(p.poly)drawPoly(pk,polys[p.poly]);
    else if(p.ll){const q=P(p.ll);pk.beginPath();pk.arc((q[0]+EXT)/PX,(q[1]+EXT)/PX,p.r/PX,0,7);pk.fill();}
    else if(p.line)drawLine(pk,p.line.map(P),p.w);
    else if(p.grid&&!OSM){const R=REG.find(r=>r.id===p.grid);const u1=Math.min(p.u[1],9000);drawPoly(pk,[world(R,p.u[0],p.v[0]),world(R,u1,p.v[0]),world(R,u1,p.v[1]),world(R,p.u[0],p.v[1])]);}
  }
  if(OSM)for(const p of OSM.parks)if(!/beach|sand|pitch/.test(p.k))drawPoly(pk,p.pts);
  const rc=mkCanvas(TEXN),rd=rc.getContext("2d");rd.fillStyle="#000";rd.fillRect(0,0,TEXN,TEXN);
  if(OSM){for(const r of OSM.roads){if(r.fl&6)continue;rd.strokeStyle=isHwy(r)?"#ff0":"#f00";drawLine(rd,r.pts,roadW(r));}}
  else{C._roads=C.roads.map(r=>({n:r.n,w:r.w,hwy:!!r.hwy,pts:r.pts.map(P)}));
  for(const r of C._roads){rd.strokeStyle=r.hwy?"#ff0":"#f00";drawLine(rd,r.pts,r.w);}}
  if(C.runway){rd.strokeStyle="#0f0";drawLine(rd,C.runway.map(P),60);}
  const L=l.getImageData(0,0,TEXN,TEXN).data,PK=pk.getImageData(0,0,TEXN,TEXN).data,RD=rd.getImageData(0,0,TEXN,TEXN).data;
  cls=new Uint8Array(TEXN*TEXN); streetCnt=new Float32Array(CG*CG); hwyCnt=new Float32Array(CG*CG); landPx=0; parkPx=0;
  const gc=mkCanvas(TEXN),g=gc.getContext("2d"),img=g.createImageData(TEXN,TEXN),d=img.data;
  const noBuild=(C.noBuild||[]).map(n=>polys[n]);
  for(let py=0;py<TEXN;py++){const z=-EXT+(py+.5)*PX;const rj=Math.floor(py*PX/RPX);
    for(let px=0;px<TEXN;px++){const i=py*TEXN+px,o=i*4;let k=0;
      if(L[o]>127){landPx++;k=1;
        if(RD[o+1]>127&&RD[o]<127&&RD[o+2]<127)k=6; // runway
        else if(RD[o]>127)k=RD[o+1]>127?4:3;
        else if(PK[o]>127){k=2;parkPx++;}
        else if(!OSM){const ri=rgrid[rj*RG+Math.floor(px*PX/RPX)];if(ri!==255){const R=REG[ri],x=-EXT+(px+.5)*PX;const f=frame(R,x,z);if(findLine(R.uL,f[0],f[1])||findLine(R.vL,f[1],f[0]))k=3;}}
        if(px<2||py<2||px>=TEXN-2||py>=TEXN-2)k=1;
        if(k===3||k===4){const c=cellOf(-EXT+(px+.5)*PX,z);if(k===3)streetCnt[c]++;else hwyCnt[c]++;}
        if(k===1&&noBuild.length){const x=-EXT+(px+.5)*PX;for(const nb of noBuild)if(pip(x,z,nb)){k=5;break;}}
      }
      cls[i]=k;
      const n=((Math.sin(px*12.9898+py*78.233)*43758.5453)%1+1)%1;
      let c;
      if(k===0)c=[40,80,100,0];
      else if(k===1)c=[196+n*10,194+n*10,188+n*10,255];
      else if(k===2){const m=((Math.sin(px*.37)+Math.cos(py*.41))*.5+1)*.5;c=[96+n*25+m*14,138+n*24+m*12,78+n*16,255];}
      else if(k===3)c=OSM?[182+n*8,180+n*8,175+n*8,255]:[86+n*8,88+n*8,92+n*8,255];
      else if(k===4)c=OSM?[176+n*8,174+n*8,170+n*8,255]:[72+n*6,74+n*6,78+n*6,255];
      else if(k===5)c=[170+n*12,172+n*12,166+n*10,255];
      else c=[60,62,66,255];
      d[o]=c[0];d[o+1]=c[1];d[o+2]=c[2];d[o+3]=c[3];
    }}
  g.putImageData(img,0,0);
  if(OSM&&!OSM.rail2){g.strokeStyle="#5a5752";for(const r of OSM.rail)if(!r.tunnel)drawLine(g,r.pts,r.k==="rail"?5:3);}
  if(C.runway){const rw=C.runway.map(P);g.strokeStyle="#eee";g.setLineDash([30/PX,30/PX]);drawLine(g,rw,2);g.setLineDash([]);}
  groundTex=new T.CanvasTexture(gc); groundTex.encoding=T.sRGBEncoding; groundTex.anisotropy=renderer.capabilities.getMaxAnisotropy?Math.min(8,renderer.capabilities.getMaxAnisotropy()):4;
  // minimap thumbnail
  const mc=mkCanvas(256);mc.getContext("2d").drawImage(gc,0,0,256,256);miniImg=mc;
}
function buildTerrain(){
  const land=new Uint8Array(NV*NV);
  for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){const x=-EXT+i*EPX,z=-EXT+j*EPX;land[j*NV+i]=clsAt(clamp(x,-EXT+1,EXT-1),clamp(z,-EXT+1,EXT-1))?1:0;}
  const dist=new Float32Array(NV*NV);for(let i=0;i<NV*NV;i++)dist[i]=land[i]?1e9:0;
  const a=EPX,b=EPX*1.4142;
  for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){let v=dist[j*NV+i];if(i>0)v=Math.min(v,dist[j*NV+i-1]+a);if(j>0){v=Math.min(v,dist[(j-1)*NV+i]+a);if(i>0)v=Math.min(v,dist[(j-1)*NV+i-1]+b);if(i<NV-1)v=Math.min(v,dist[(j-1)*NV+i+1]+b);}dist[j*NV+i]=v;}
  for(let j=NV-1;j>=0;j--)for(let i=NV-1;i>=0;i--){let v=dist[j*NV+i];if(i<NV-1)v=Math.min(v,dist[j*NV+i+1]+a);if(j<NV-1){v=Math.min(v,dist[(j+1)*NV+i]+a);if(i<NV-1)v=Math.min(v,dist[(j+1)*NV+i+1]+b);if(i>0)v=Math.min(v,dist[(j+1)*NV+i-1]+b);}dist[j*NV+i]=v;}
  const hills=(C.hills||[]).map(h=>({p:P(h.ll),h:h.h,r:h.r}));
  elevV=new Float32Array(NV*NV);
  for(let j=0;j<NV;j++)for(let i=0;i<NV;i++){const x=-EXT+i*EPX,z=-EXT+j*EPX,k=j*NV+i;
    if(!land[k]){elevV[k]=-6;continue;}
    let e=C.elev.b+Math.min(dist[k]>5e8?C.elev.cap:dist[k]*C.elev.slope,C.elev.cap);
    for(const h of hills){const dd=((x-h.p[0])**2+(z-h.p[1])**2)/(h.r*h.r);if(dd<9)e+=h.h*Math.exp(-dd);}
    const edge=Math.min(EXT-Math.abs(x),EXT-Math.abs(z));e*=clamp(edge/500,0.15,1);
    elevV[k]=Math.max(1.2,e);}
  const g=new T.PlaneGeometry(2*EXT,2*EXT,EG,EG);g.rotateX(-Math.PI/2);
  const pos=g.attributes.position;
  for(let k=0;k<pos.count;k++){const x=pos.getX(k),z=pos.getZ(k);const i=Math.round((x+EXT)/EPX),j=Math.round((z+EXT)/EPX);pos.setY(k,elevV[j*NV+i]);}
  g.computeVertexNormals();
  groundMesh=new T.Mesh(g,new T.MeshStandardMaterial({map:groundTex,alphaTest:.5,roughness:.95}));
  groundMesh.receiveShadow=true;
  overlayCanvas=mkCanvas(CG);overlayTex=new T.CanvasTexture(overlayCanvas);overlayTex.magFilter=T.LinearFilter;
  const og=g.clone();{const op=og.attributes.position;for(let k=0;k<op.count;k++)op.setY(k,op.getY(k)+1.6);}
  overlayMesh=new T.Mesh(og,new T.MeshBasicMaterial({map:overlayTex,transparent:true,opacity:.8,depthWrite:false,fog:false}));
  overlayMesh.visible=false; overlayMesh.renderOrder=2;
}

/* ---------- palettes ---------- */
const PAL={
 nyc:{brick:[[.60,.42,.36],[.74,.70,.64],[.66,.56,.48],[.80,.78,.74],[.70,.66,.60],[.86,.84,.80],[.58,.56,.54]],stone:[[.86,.82,.74],[.80,.74,.64],[.74,.70,.63],[.90,.88,.83]],glass:[[.55,.63,.70],[.36,.42,.49],[.62,.68,.72],[.46,.55,.63]],house:[[.62,.36,.30],[.47,.33,.27]],roof:[[.32,.31,.30]],ind:[[.62,.58,.52],[.55,.40,.33]]},
 chi:{brick:[[.60,.48,.40],[.76,.72,.66],[.80,.74,.62],[.68,.66,.64],[.84,.82,.78],[.56,.54,.52]],stone:[[.84,.80,.72],[.76,.72,.66],[.22,.23,.25],[.88,.86,.82]],glass:[[.5,.6,.68],[.3,.36,.42],[.62,.7,.76],[.24,.26,.3]],house:[[.62,.46,.36],[.70,.58,.46],[.56,.40,.32],[.78,.74,.66]],roof:[[.30,.30,.31],[.38,.34,.31]],ind:[[.60,.46,.37],[.66,.64,.6]]},
 sea:{brick:[[.80,.80,.78],[.72,.72,.70],[.66,.64,.60],[.86,.86,.84],[.60,.62,.62],[.74,.70,.64],[.92,.92,.90]],stone:[[.78,.77,.74],[.70,.70,.68],[.86,.85,.82]],glass:[[.5,.62,.68],[.34,.42,.48],[.6,.7,.74],[.44,.54,.6]],house:[[.55,.62,.66],[.72,.66,.55],[.42,.48,.5],[.82,.8,.74],[.6,.52,.44],[.36,.44,.4]],roof:[[.26,.27,.28],[.34,.33,.31],[.22,.24,.27]],ind:[[.62,.62,.6],[.55,.5,.44]]},
 sf:{brick:[[.93,.88,.80],[.85,.90,.92],[.95,.85,.78],[.88,.92,.84],[.98,.96,.92],[.90,.82,.72],[.82,.84,.88]],stone:[[.90,.87,.80],[.84,.82,.78],[.96,.94,.9]],glass:[[.56,.64,.70],[.42,.5,.56],[.66,.72,.76]],house:[[.93,.88,.80],[.85,.90,.92],[.95,.85,.78],[.88,.92,.84]],roof:[[.4,.4,.42]],ind:[[.7,.68,.64],[.6,.56,.5]]},
 sd:{brick:[[.95,.92,.86],[.92,.86,.76],[.88,.84,.78],[.96,.95,.92],[.84,.78,.68]],stone:[[.9,.87,.8],[.94,.92,.88]],glass:[[.5,.66,.70],[.42,.56,.62],[.6,.72,.74]],house:[[.96,.93,.86],[.93,.87,.76],[.9,.9,.86],[.94,.86,.74],[.82,.86,.84]],roof:[[.72,.40,.28],[.66,.36,.26],[.76,.46,.32]],ind:[[.72,.7,.66],[.62,.6,.56]]}
};
const pick=(arr,r)=>arr[Math.floor(r()*arr.length)%arr.length];

/* ---------- building generation ---------- */
function addB(o){o.rm=false;o.ad=false;o.kid=!!o.kid;o.par=o.par==null?-1:o.par;o.h0=o.h;o.u0=o.u;o.inst=-1;if(o.yo==null)o.yo=0;if(!o.kid)o.cell=cellOf(o.x,o.z);B.push(o);return B.length-1;}
function footprintY(x,z,w,d,a){const c=Math.cos(a),s=Math.sin(a);let mn=1e9,mx=-1e9;for(const [lx,lz] of [[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5],[0,0]]){const X=x+lx*w*c-lz*d*(-s)*-1,Z=z+lx*w*s+lz*d*c;const ex=elevAt(x+lx*w*c+lz*d*s,z+lx*w*s-lz*d*c);if(ex<mn)mn=ex;if(ex>mx)mx=ex;void X;void Z;}const ec=elevAt(x,z);return {y:mn-1.2,g:ec-mn+1.2,range:mx-mn};}
function lotFree(x,z,w,d,a){const c=Math.cos(a),s=Math.sin(a);for(const [lx,lz] of [[0,0],[-.45,-.45],[.45,-.45],[-.45,.45],[.45,.45]]){const X=x+lx*w*c+lz*d*s,Z=z+lx*w*s-lz*d*c;if(clsAt(X,Z)!==1)return false;}return true;}
function coreAt(x,z){let s=0;for(const c of C._centers){const d2=((x-c[0])**2+(z-c[1])**2)/(c[3]*c[3]);if(d2<9)s+=c[2]*Math.exp(-d2);}return s;}
E.coreAt=(x,z)=>coreAt(x,z);
function inInd(x,z){for(const q of C._ind)if((x-q[0])**2+(z-q[1])**2<q[2]*q[2])return true;return false;}
function genCity(){
  C._centers=C.centers.map(c=>{const p=P([c[0],c[1]]);return [p[0],p[1],c[2],c[3]];});
  C._ind=(C.industrial||[]).map(q=>{const p=P(q.ll);return [p[0],p[1],q.r];});
  C._lms=C.landmarks.map(l=>{const p=P(l.ll);return [p[0],p[1],Math.max(l.w,l.d||0)*0.75+18];});
  const r=cityRng, st=C.style, pal=PAL[st.palette];
  E.trees=[]; E.pads=[];
  let towerId=0;
  for(const R of REG){
    const uL=R.uL, vL=R.vL;
    for(let i=0;i<uL.length-1;i++){
      const a=uL[i],b=uL[i+1]; if(b.p-a.p>1200)continue; const um=(a.p+b.p)/2;
      const vA=vL.filter(l=>active(l,um));
      for(let j=0;j<vA.length-1;j++){
        const c=vA[j],d=vA[j+1]; if(d.p-c.p>1200)continue;
        const u0=a.p+a.w/2,u1=b.p-b.w/2,v0=c.p+c.w/2,v1=d.p-d.w/2; if(u1-u0<14||v1-v0<14)continue;
        const [cx,cz]=world(R,(u0+u1)/2,(v0+v1)/2);
        if(Math.abs(cx)>EXT-40||Math.abs(cz)>EXT-40)continue;
        if(regionAt(cx,cz)!==R)continue;
        const cc=clsAt(cx,cz); if(cc!==1&&cc!==3)continue;
        // corners
        let ok=0;for(const [du,dv] of [[-.42,-.42],[.42,-.42],[-.42,.42],[.42,.42]]){const p=world(R,(u0+u1)/2+du*(u1-u0),(v0+v1)/2+dv*(v1-v0));const k=clsAt(p[0],p[1]);if(k===1||k===3||k===4)ok++;}
        if(ok<3)continue;
        const blk={R,cx,cz,W:v1-v0,Dd:u1-u0,a:R.a,id:blocks.length,core:coreAt(cx,cz)*(C.hMul||1)};
        blk.ind=inInd(cx,cz); blocks.push(blk);
        genBlock(blk,r,st,pal,()=>towerId++);
      }
    }
  }
}
function genBlock(blk,r,st,pal,nextTower){
  const {cx,cz,W,Dd,a}=blk; const ca=Math.cos(a),sa=Math.sin(a);
  // local X along dv, local Z along -du  => world = c + lx*dv + lz*(-du)
  const dv=[ca,sa], mdu=[-Math.sin(a),Math.cos(a)];
  const L2W=(lx,lz)=>[cx+lx*dv[0]+lz*mdu[0],cz+lx*dv[1]+lz*mdu[1]];
  const side=st.side, iw=W-2*side, id=Dd-2*side; if(iw<8||id<8)return;
  const core=blk.core, hm=C.base+core;
  // pad
  const fy=footprintY(cx,cz,W,Dd,a);
  if(fy.range<3.5)E.pads.push({x:cx,z:cz,w:W-1,d:Dd-1,a,y:fy.y-2,top:elevAt(cx,cz)+.28,park:false});
  for(const q of C._lms)if((cx-q[0])**2+(cz-q[1])**2<(q[2]+Math.max(W,Dd)*.5)**2){blk.lm=true;}
  if(blk.lm){streetTrees(blk,L2W,r,st,.5);return;}
  // parking lot / vacant
  if(r()<(st.house?.035:.025)*(1-clamp(core/180,0,1))){E.pads.length&&(E.pads[E.pads.length-1].park=true);blk.vacant=true;return;}
  const offP=clamp((core-15)/150,0,.88)*(st.office||1);
  const useOf=(h)=>{const q=r();if(blk.ind)return"i";if(q<offP*(h>30?1:.4))return"o";if(q<offP+.12)return"m";return"r";};
  const add=(lx,lz,w,d,h,k,u,col,extra)=>{const [x,z]=L2W(lx,lz);if(!lotFree(x,z,w,d,a))return -1;const f=footprintY(x,z,w,d,a);return addB(Object.assign({x,z,w,d,a,h,y:f.y,g:f.g,k,u,c:col,blk:blk.id},extra||{}));};
  const kidB=(par,lx,lz,w,d,h,k,col,dy)=>{if(par<0)return;addB({kid:true,par,kx:lx,kz:lz,x:B[par].x,z:B[par].z,w,d,h,k,u:"x",c:col,a:B[par].a,dy:dy||0});};
  const mech=(i,r)=>{if(i<0)return;const b=B[i];if(b.h<12||r()>.7)return;const n=1+(r()<.4?1:0);for(let k=0;k<n;k++)kidB(i,(r()-.5)*b.w*.4,(r()-.5)*b.d*.4,b.w*(.18+r()*.2),b.d*(.18+r()*.2),2.5+r()*2.5,"k",[.72,.72,.7]);};
  const tank=(i,r)=>{if(i<0||!st.tank)return;const b=B[i];if(b.k!=="m"||b.h<14||b.h>90||r()>st.tank)return;kidB(i,(r()-.5)*b.w*.5,(r()-.5)*b.d*.5,6,6,8,"t",[.55,.42,.3],2.5);};
  // ---------- industrial ----------
  if(blk.ind&&core<90){
    const n=1+Math.floor(r()*3);const lw=iw/n;
    for(let k=0;k<n;k++){const h=7+r()*9;const i=add(-iw/2+lw*(k+.5),0,lw-3,id*(.7+r()*.25),h,"m","i",pick(pal.ind,r));mech(i,r);}
    return;
  }
  // ---------- detached houses ----------
  if(st.house&&hm<st.houseH&&core<20){
    const f0=st.lotW[0],f1=st.lotW[1];
    for(const sgn of [-1,1]){
      let x=-iw/2;while(x<iw/2-6){const f=f0+r()*(f1-f0);const w=Math.min(f-3,iw/2-x);if(w<5)break;
        const dep=9+r()*5, lz=sgn*(id/2-4-dep/2);const h=4+r()*(r()<.4?6:3);
        const col=pick(pal.house,r);const i=add(x+f/2,lz,w,dep,h,"m","r",col,{house:true});
        if(i>=0&&r()<st.gable){kidB(i,0,0,w+.6,dep+.6,2.6+r()*1.8,"r",pick(pal.roof,r),0);}
        if(r()<st.trees*.8){const [tx,tz]=L2W(x+f/2+(r()-.5)*4,sgn*(id/2-dep-8));if(clsAt(tx,tz)===1)E.trees.push([tx,tz,3.5+r()*3,st.palm&&r()<.35]);}
        x+=f;}
    }
    streetTrees(blk,L2W,r,st,1);return;
  }
  // ---------- tower block ----------
  const pT=clamp((core-50)/110,0,.86)*(C.towerP==null?1:C.towerP);
  if(r()<pT){
    const ph=10+r()*22;
    const pod=add(0,0,iw,id,ph,r()<.6?"m":"g",useOf(ph),r()<.5?pick(pal.stone,r):pick(pal.glass,r));
    mech(pod,r);
    const nt=(Math.max(iw,id)>170&&r()<.6)?2:1;
    for(let t=0;t<nt;t++){
      const tw=nextTower();
      let H=hm*(.55+.95*r())*Math.exp(.25*gauss(r)); H=clamp(H,ph+25,(C.maxH||430)-ph);
      const fw=Math.min(iw-6,24+r()*26+H*.06),fd=Math.min((nt===2?id/2:id)-6,24+r()*26+H*.06);
      const lz=nt===2?(t?1:-1)*id/4:(r()-.5)*(id-fd)*.5,lx=(r()-.5)*(iw-fw)*.5;
      const modern=r()<clamp(.3+(H-60)/220,0,.95)*(st.glass||1);
      const u=useOf(H);
      if(modern){
        const cyl=r()<.1&&H>120;const col=pick(pal.glass,r);
        const i=add(lx,lz,fw,cyl?fw:fd,H*(.86+r()*.06),cyl?"c":"g",u,col,{yo:ph,tw});
        if(i>=0){const b=B[i];const top=b.h;if(H>140&&r()<.45){addB({x:b.x,z:b.z,w:b.w*.68,d:b.d*.68,h:H-top,y:b.y,g:b.g,yo:ph+top,k:b.k,u,c:col,a,blk:blk.id,tw});}mech(i,r);}
      }else{
        const col=r()<.5?pick(pal.stone,r):pick(pal.brick,r);
        const h1=H*(.55+r()*.15),h2=H*(.25+r()*.1),h3=H-h1-h2;
        const i=add(lx,lz,fw,fd,h1,"m",u,col,{yo:ph,tw});
        if(i>=0){const b=B[i];
          if(r()<st.setback){addB({x:b.x,z:b.z,w:fw*.78,d:fd*.78,h:h2,y:b.y,g:b.g,yo:ph+h1,k:"m",u,c:col,a,blk:blk.id,tw});const i3=addB({x:b.x,z:b.z,w:fw*.56,d:fd*.56,h:Math.max(6,h3),y:b.y,g:b.g,yo:ph+h1+h2,k:"m",u,c:col,a,blk:blk.id,tw});mech(i3,r);}
          else{b.h=H;b.h0=H;mech(i,r);tank(i,r);}
        }
      }
    }
    streetTrees(blk,L2W,r,st,.6);return;
  }
  // ---------- perimeter block ----------
  const bh=hm*(.42+.6*r());
  const dep=Math.min(id/2,st.depth[0]+r()*(st.depth[1]-st.depth[0]));
  const lots=[];
  const longX=iw>=id;
  const runs=longX?[[-iw/2,iw/2,-id/2+dep/2,0],[-iw/2,iw/2,id/2-dep/2,0]]:[[-id/2,id/2,-iw/2+dep/2,1],[-id/2,id/2,iw/2-dep/2,1]];
  const shortLen=(longX?id:iw)-2*dep;
  if(shortLen>8){if(longX){runs.push([-shortLen/2,shortLen/2,-iw/2+dep/2,2],[-shortLen/2,shortLen/2,iw/2-dep/2,2]);}else{runs.push([-shortLen/2,shortLen/2,-id/2+dep/2,3],[-shortLen/2,shortLen/2,id/2-dep/2,3]);}}
  for(const [s0,s1,off,o] of runs){
    let s=s0;while(s<s1-4){let f=st.lotW[0]+r()*(st.lotW[1]-st.lotW[0]);if(r()<.18)f*=2+r();f=Math.min(f,s1-s);if(f<5)break;
      const mid=s+f/2;let lx,lz,w,d;
      if(o===0){lx=mid;lz=off;w=f-.4;d=dep;}else if(o===1){lz=mid;lx=off;d=f-.4;w=dep;}else if(o===2){lz=mid;lx=off;d=f-.4;w=dep;}else{lx=mid;lz=off;w=f-.4;d=dep;}
      lots.push([lx,lz,w,d,f]);s+=f;}
  }
  for(const [lx,lz,w,d,f] of lots){
    let h=bh*(.8+.42*r())*Math.exp(.18*gauss(r)); if(r()<.06)h*=1.6; h=clamp(h,5,Math.min(88,Math.max(30,hm*1.5)));
    const glass=h>40&&r()<clamp((h-35)/120,0,.7)*(st.glass||1);
    const col=glass?pick(pal.glass,r):(h>45&&r()<.4?pick(pal.stone,r):pick(pal.brick,r));
    const i=add(lx,lz,w,d,h,glass?"g":"m",useOf(h),col);
    if(i>=0){mech(i,r);tank(i,r);if(!glass&&h>55&&r()<st.setback*.5){const b=B[i];addB({x:b.x,z:b.z,w:w*.8,d:d*.75,h:h*.25,y:b.y,g:b.g,yo:h,k:"m",u:b.u,c:col,a,blk:blk.id});}}
  }
  if(r()<st.trees*.5){const [tx,tz]=L2W((r()-.5)*iw*.3,(r()-.5)*id*.3);if(clsAt(tx,tz)===1)E.trees.push([tx,tz,4+r()*3,st.palm&&r()<.5]);}
  streetTrees(blk,L2W,r,st,1);
}
function streetTrees(blk,L2W,r,st,mul){
  const p=(st.trees||0)*mul*.32; if(p<=0||E.trees.length>26000)return;
  const {W,Dd}=blk, hw=W/2-st.side*.45, hd=Dd/2-st.side*.45;
  const sp=st.palm?11:9;
  for(const [x0,z0,x1,z1] of [[-hw,-hd,hw,-hd],[-hw,hd,hw,hd],[-hw,-hd,-hw,hd],[hw,-hd,hw,hd]]){
    const L=Math.hypot(x1-x0,z1-z0),n=Math.floor(L/sp);
    for(let k=1;k<n;k++){if(r()>p)continue;const t=k/n;const [x,z]=L2W(lerp(x0,x1,t),lerp(z0,z1,t));const c=clsAt(x,z);if(c===1||c===3)E.trees.push([x,z,3+r()*2.5,st.palm&&r()<.6]);}
  }
}

/* ---------- instanced meshes ---------- */
function prismGeo(){
  const g=new T.BufferGeometry();
  const v=[-.5,0,-.5, .5,0,-.5, .5,1,0, -.5,0,-.5, .5,1,0, -.5,1,0,   .5,0,.5, -.5,0,.5, -.5,1,0, .5,0,.5, -.5,1,0, .5,1,0,   -.5,0,.5, -.5,0,-.5, -.5,1,0,   .5,0,-.5, .5,0,.5, .5,1,0];
  g.setAttribute("position",new T.Float32BufferAttribute(v,3));g.computeVertexNormals();return g;
}
function tankGeo(){const pts=[new T.Vector2(0,0),new T.Vector2(.5,0),new T.Vector2(.5,.72),new T.Vector2(.53,.74),new T.Vector2(.08,1),new T.Vector2(0,1)];return new T.LatheGeometry(pts,10);}
const GEOK={};
function buildMeshes(){
  GEOK.box=new T.BoxGeometry(1,1,1).translate(0,.5,0);
  GEOK.cyl=new T.CylinderGeometry(.5,.5,1,24).translate(0,.5,0);
  GEOK.prism=prismGeo(); GEOK.tank=tankGeo();
  const spec={m:[GEOK.box,MAT.m],g:[GEOK.box,MAT.g],c:[GEOK.cyl,MAT.g],r:[GEOK.prism,MAT.roof],k:[GEOK.box,MAT.mech],t:[GEOK.tank,MAT.tank]};
  const cnt={m:0,g:0,c:0,r:0,k:0,t:0};for(const b of B)if(!b.lm&&!b.osm)cnt[b.k]++;
  for(const k in spec){const n=cnt[k]+CAP[k];const m=new T.InstancedMesh(spec[k][0],spec[k][1],n);m.castShadow=k!=="k"||true;m.receiveShadow=true;m.count=n;m.frustumCulled=false;MESH[k]={mesh:m,used:0,cap:n,free:[]};cityG.add(m);}
  for(let i=0;i<B.length;i++){const b=B[i];if(b.lm||b.osm){b.inst=-1;continue;}const M=MESH[b.k];b.inst=M.used++;}
  for(const k in MESH){const M=MESH[k];for(let i=M.used;i<M.cap;i++){dummy.scale.set(1e-4,1e-4,1e-4);dummy.position.set(0,-999,0);dummy.updateMatrix();M.mesh.setMatrixAt(i,dummy.matrix);M.mesh.setColorAt(i,col.setRGB(1,1,1));}}
  for(let i=0;i<B.length;i++)writeB(i);
  recolor();
  // pads
  const pg=GEOK.box;const pm=new T.InstancedMesh(pg,MAT.pad,Math.max(1,E.pads.length));pm.receiveShadow=true;
  E.pads.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.quaternion.setFromAxisAngle(YV,-p.a);dummy.scale.set(p.w,Math.max(.3,p.top-p.y),p.d);dummy.updateMatrix();pm.setMatrixAt(i,dummy.matrix);const n=.86+((i*7919)%13)/130;pm.setColorAt(i,col.setRGB(p.park?.36*n:.74*n,p.park?.37*n:.73*n,p.park?.39*n:.70*n).convertSRGBToLinear());});
  cityG.add(pm);
  // trees
  E.treeCap=E.trees.length+7000;
  const cg=treeCrownGeo(), tg=new T.CylinderGeometry(.18,.26,1,5).translate(0,.5,0);
  MESH.crown={mesh:new T.InstancedMesh(cg,MAT.crown,E.treeCap)};MESH.trunk={mesh:new T.InstancedMesh(tg,MAT.trunk,E.treeCap)};
  MESH.crown.mesh.castShadow=true;MESH.crown.mesh.receiveShadow=true;MESH.crown.mesh.frustumCulled=false;MESH.trunk.mesh.frustumCulled=false;MESH.crown.mesh.count=0;MESH.trunk.mesh.count=0;
  cityG.add(MESH.crown.mesh,MESH.trunk.mesh);
  for(const t of E.trees)plantTree(t[0],t[1],t[2],t[3]);
  // parks also get trees
  const r=rng(C.seed+9);let parkTrees=0;
  for(let t=0;t<60000&&parkTrees<(OSM&&OSM.trees&&OSM.trees.length>500?2500:6000);t++){const x=(r()-.5)*2*EXT,z=(r()-.5)*2*EXT;if(clsAt(x,z)===2&&r()<.5){plantTree(x,z,4+r()*4,C.style.palm&&r()<.3);parkTrees++;}}
}
const dummy=new T.Object3D(), col=new T.Color(), YV=new T.Vector3(0,1,0);
function pipT(x,z,P){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function treeCrownGeo(){ // three overlapping lumpy spheres merged into one natural-looking crown
  const parts=[[0,0,0,1],[.42,.28,.18,.72],[-.36,.36,-.22,.68],[.05,.62,-.05,.6]],pos=[],r=rng(5);
  for(const [ox,oy,oz,sc] of parts){const g=new T.IcosahedronGeometry(sc,1).toNonIndexed();const a=g.attributes.position;
    const jit=new Map();for(let i=0;i<a.count;i++){const k=a.getX(i).toFixed(3)+a.getY(i).toFixed(3)+a.getZ(i).toFixed(3);if(!jit.has(k))jit.set(k,.88+r()*.24);const j=jit.get(k);pos.push(a.getX(i)*j+ox,a.getY(i)*j*.9+oy,a.getZ(i)*j+oz);}}
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();g.translate(0,-.15,0);return g;}
function plantTree(x,z,s,palm){
  const cm=MESH.crown.mesh,tm=MESH.trunk.mesh;if(cm.count>=E.treeCap)return;const y=elevAt(x,z);const i=cm.count++;tm.count++;
  if(palm){dummy.position.set(x,y+s*3,z);dummy.scale.set(s*.9,s*.45,s*.9);}else{dummy.position.set(x,y+s*1.25,z);dummy.scale.set(s,s*1.1,s);}
  dummy.updateMatrix();cm.setMatrixAt(i,dummy.matrix);dummy.quaternion.identity();
  const g=((x*13.1+z*7.7)%1+1)%1,g2=((x*3.7-z*11.3)%1+1)%1;cm.setColorAt(i,col.setRGB(palm?.26:.2+g*.12+g2*.05,palm?.42:.36+g*.12,palm?.2:.15+g*.06).convertSRGBToLinear());dummy.quaternion.setFromAxisAngle(YV,g2*6.28);
  dummy.position.set(x,y,z);dummy.scale.set(s*.5,palm?s*3:s*.8,s*.5);dummy.updateMatrix();tm.setMatrixAt(i,dummy.matrix);
  cm.instanceMatrix.needsUpdate=true;tm.instanceMatrix.needsUpdate=true;if(cm.instanceColor)cm.instanceColor.needsUpdate=true;
}
function topOf(b){return b.y+b.g+b.yo+b.h;}
function writeB(i){
  const b=B[i];if(b.osm){osmWrite(b);return;}if(b.inst<0)return;const M=MESH[b.k];
  let hidden=b.rm||b.hid;let x=b.x,z=b.z,y,h,a=b.a;
  if(b.kid){const p=B[b.par];hidden=hidden||p.rm||p.hid||p.growing;const ca=Math.cos(p.a),sa=Math.sin(p.a);x=p.x+b.kx*ca-b.kz*sa;z=p.z+b.kx*sa+b.kz*ca;y=topOf(p)+(b.dy||0);h=b.h;a=p.a;}
  else if(b.yo>0){y=b.y+b.g+b.yo;h=b.h;}
  else{y=b.y;h=b.h+b.g;}
  if(hidden||h<.05){dummy.scale.set(1e-4,1e-4,1e-4);dummy.position.set(0,-999,0);}
  else{dummy.position.set(x,y,z);dummy.scale.set(b.w,h,b.d);}
  dummy.quaternion.setFromAxisAngle(YV,-a);dummy.updateMatrix();M.mesh.setMatrixAt(b.inst,dummy.matrix);
}
function flush(){flushOSM();for(const k in MESH){const m=MESH[k].mesh;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}}
let VIEW="real";
function colorOf(b,i){
  if(b.ad&&b.ghostCol)return b.ghostCol;
  if(VIEW==="clay"){const n=.9+((i*2654435761>>>0)%1000)/10000;return [.93*n,.93*n,.94*n];}
  if(VIEW==="use"){if(b.k==="k"||b.k==="t"||b.k==="r")return [.8,.8,.8];return b.u==="o"?[.55,.5,.85]:b.u==="r"?[.93,.72,.45]:b.u==="m"?[.86,.6,.75]:b.u==="i"?[.6,.6,.62]:[.8,.8,.8];}
  if(VIEW==="height"){const p=b.kid?B[b.par]:b;const t=clamp(Math.log(Math.max(4,topOf(p)-p.y)/6)/Math.log(450/6),0,1);return [lerp(.95,.12,t),lerp(.93,.3,t),lerp(.88,.78,t)];}
  return b.c||[.8,.8,.8];
}
function recolor(){
  for(let i=0;i<B.length;i++){const b=B[i];if(b.inst<0&&!b.osm)continue;const c=colorOf(b,i);let r=c[0],g=c[1],bb=c[2];
    if(b.flood){r=lerp(r,.2,.6);g=lerp(g,.45,.6);bb=lerp(bb,.8,.6);}
    if(OVV&&OVR&&!b.kid){const v=OVV[b.cell!=null?b.cell:cellOf(b.x,b.z)];if(v!=null&&!isNaN(v)){const c2=OVR(clamp(v,0,1));const a=.7*Math.min(1,(c2[3]==null?.9:c2[3])+.2);r=lerp(r*.85+.15,c2[0]/255,a);g=lerp(g*.85+.15,c2[1]/255,a);bb=lerp(bb*.85+.15,c2[2]/255,a);}else if(OVV){r=lerp(r,.8,.5);g=lerp(g,.8,.5);bb=lerp(bb,.8,.5);}}
    if(b.ad&&VIEW==="real"&&b.k!=="k"){r=lerp(r,.55,.15);g=lerp(g,.65,.15);bb=lerp(bb,.95,.25);}
    if(b.osm){osmColor(b,[r,g,bb]);continue;}MESH[b.k].mesh.setColorAt(b.inst,col.setRGB(r,g,bb).convertSRGBToLinear());}
  flush();
}
E.setView=function(v){VIEW=v;U.uWin.value=v==="real"?1:v==="clay"?.35:0;if(MESH.m)recolor();};

/* ---------- landmarks & bridges ---------- */
function lmMesh(geo,mat,x,y,z,rot){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);if(rot)m.rotation.y=rot;m.castShadow=true;m.receiveShadow=true;return m;}
/* ================= Signature landmarks =================
   In OpenStreetMap mode the real footprints are used for ordinary buildings; famous buildings get
   hand-built models (aligned to their real footprint) so they read instantly, like a 3D map app. */
const HISTORIC=/Woolworth|Smith Tower|Tribune|40 Wall|70 Pine|California Tower|Chrysler|Empire/;
const ICON_SHAPES=["obelisk","esb","chrysler","willis","hancock","pyramid","round","needle","column","twin","stadium","arena","dome","ferry","antenna","ship","hotel"];
const GLOW=[];
function fmat(glass,hex){const m=facadeMat(glass);m.color.set(hex).convertSRGBToLinear();return m;}
function solid(hex,rough,metal){return new T.MeshStandardMaterial({color:new T.Color(hex).convertSRGBToLinear(),roughness:rough==null?.8:rough,metalness:metal||0});}
function glowMat(hex,base,k){const m=new T.MeshStandardMaterial({color:new T.Color(base||0xdddddd).convertSRGBToLinear(),emissive:new T.Color(hex).convertSRGBToLinear(),emissiveIntensity:0,roughness:.5,metalness:.3});GLOW.push([m,k||1.6]);return m;}
E.updateGlow=n=>{for(const [m,k] of GLOW)m.emissiveIntensity=n*k;};
function antiprism(s0,s1,h,twist){const p=[];const b=[],t=[];for(let k=0;k<4;k++){const a0=Math.PI/4+k*Math.PI/2,a1=a0+(twist==null?Math.PI/4:twist);b.push([Math.cos(a0)*s0/Math.SQRT2,0,Math.sin(a0)*s0/Math.SQRT2]);t.push([Math.cos(a1)*s1/Math.SQRT2,h,Math.sin(a1)*s1/Math.SQRT2]);}
  for(let k=0;k<4;k++){const k1=(k+1)%4;p.push(...b[k],...t[k],...b[k1]);p.push(...b[k1],...t[k],...t[k1]);}
  p.push(...t[0],...t[1],...t[2],...t[0],...t[2],...t[3]);const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(p,3));g.computeVertexNormals();return g;}
function squircle(geo,pw){const P2=geo.attributes.position;for(let i=0;i<P2.count;i++){const x=P2.getX(i),z=P2.getZ(i),r=Math.hypot(x,z);if(r<1e-4)continue;const a=Math.atan2(z,x);const k=Math.pow(Math.pow(Math.abs(Math.cos(a)),pw)+Math.pow(Math.abs(Math.sin(a)),pw),-1/pw);P2.setX(i,x*k);P2.setZ(i,z*k);}geo.computeVertexNormals();return geo;}
function beam(g,a,b,r,mat){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],L=Math.hypot(dx,dy,dz);const m=lmMesh(new T.CylinderGeometry(r,r,L,8),mat,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(dx/L,dy/L,dz/L));g.add(m);}
function buildIcon(L,x0,z0){
  const iconic=ICON_SHAPES.includes(L.shape)||(L.shape==="spire"&&HISTORIC.test(L.n))||(L.shape==="stepped"&&/Columbia|Trump/.test(L.n));
  // the real footprint(s) at this spot
  const R=Math.max(L.w,L.d||L.w)*(/stadium|arena/.test(L.shape)?.62:.7);let main=null;const near=[];
  for(const b of B){if(!b.osm||b.kid)continue;const dd=Math.hypot(b.x-x0,b.z-z0);if(dd<R){near.push(b);if(!main||b.A>main.A)main=b;}}
  if(!iconic){ // keep the real footprint; add the crowning element if it has one
    if(main&&(L.shape==="spire"||L.shape==="taper")){const top=topOf(main);const g=new T.Group();const sh=Math.max(6,L.h-(top-main.y-main.g));if(L.h>top-main.y+8){g.add(lmMesh(new T.CylinderGeometry(.35,Math.min(2.4,main.w*.06+.6),sh,8).translate(0,sh/2,0),MAT.steel,0,0,0));g.position.set(main.x,top,main.z);cityG.add(g);}}
    return "skip";}
  for(const b of near){if(/stadium|arena|ship/.test(L.shape)||b===main||Math.hypot(b.x-x0,b.z-z0)<R*.8)b.iconHide=true;}
  if(L.shape==="stadium"||L.shape==="arena"){if(venueModel(L,x0,z0,main))return "done";}
  let x=x0,z=x0===undefined?0:z0,rot=-(L.rot||0)*D,w=L.w,d=L.d||L.w;
  if(main&&L.shape!=="ship"){x=main.x;z=main.z;rot=-main.a;const mw=Math.max(main.w,main.d),md=Math.min(main.w,main.d);
    if(/stadium|arena|ferry|dome|hotel/.test(L.shape)&&mw>L.w*.4&&mw<L.w*2.2){w=main.w;d=main.d;}else if(main.w<main.d)rot+=Math.PI/2;}
  const y0=Math.max(0,elevAt(x,z))-.5,h=L.h;const g=new T.Group();
  const box=(bw,bh,bd,yy,mat,ox,oz,ry)=>{const m=lmMesh(new T.BoxGeometry(bw,bh,bd).translate(0,bh/2,0),mat,ox||0,yy,oz||0);if(ry)m.rotation.y=ry;g.add(m);return m;};
  const cyl=(rt,rb,hh,yy,seg,mat,ox,oz,ry)=>{const m=lmMesh(new T.CylinderGeometry(rt,rb,hh,seg||24).translate(0,hh/2,0),mat,ox||0,yy,oz||0,ry);g.add(m);return m;};
  const mast=(hh,yy,r0,mat)=>cyl(.3,r0||1.4,hh,yy,8,mat||MAT.steel);
  const white=fmat(false,0xf1efe9),cream=fmat(false,0xe6dccb),terra=fmat(false,0xeee6d6),dark=fmat(true,0x30353c),blueG=fmat(true,0xd3e2ee),silver=fmat(true,0xc9d2d9),steel=MAT.steel;
  let roof=h;
  switch(L.shape){
    case"obelisk":{ // One World Trade Center: square base twisting to an octagon, 124 m spire
      box(62,56,62,0,silver);const sh=lmMesh(antiprism(62,46,417-56),blueG,0,56,0);g.add(sh);box(32,6,32,417,steel,0,0,Math.PI/4);
      cyl(9,9,8,423,16,steel);mast(110,431,2.4,fmat(false,0xffffff));roof=417;break;}
    case"esb":{ // Empire State: 5-storey base, setbacks, art-deco crown and mast
      box(w*1.9,26,w*1.5,0,cream);box(w*1.25,60,w*1.0,26,cream);box(w,190,w*.8,86,cream);
      for(const sx of [-1,1])box(3,190,w*.8+2,86,terra,sx*w*.32);box(w*.78,40,w*.62,276,cream);box(w*.58,24,w*.46,316,cream);box(w*.42,26,w*.34,340,cream);
      cyl(w*.2,w*.24,20,366,8,glowMat(0xfff1c8,0xe8e0cf,2.2));cyl(w*.12,w*.16,14,386,8,glowMat(0xfff1c8,0xd9d2c4,2.2));mast(57,400,2.2);roof=381;break;}
    case"chrysler":{ // Chrysler: brick shaft, terraced stainless crown with lit sunburst windows
      box(w*1.5,60,w*1.4,0,cream);box(w,150,w,60,cream);box(w*.84,30,w*.84,210,cream);
      const crown=glowMat(0xfff4dc,0xd6dde3,2.4);let r0=w*.42;for(let k=0;k<7;k++){const hh=9-k*.6;cyl(r0*.86,r0,hh,240+k*8.4,8,k%2?steel:crown,0,0,Math.PI/8);r0*=.82;}
      mast(36,298,1.3);roof=282;break;}
    case"willis":{ // Willis: nine bundled black tubes stepping back, twin white antennas
      const s=w/3;const hs=[[442-87,1,1],[390-87,0,1],[390-87,1,0],[350-87,0,0],[270-87,2,0],[270-87,2,2],[200-87,1,2],[200-87,0,2],[270-87,2,1]];
      const dk=fmat(true,0x26282c);for(const [hh,ix,iz] of hs)box(s-.4,hh,s-.4,0,dk,(ix-1)*s,(iz-1)*s);
      for(const ox of [-s*.3,s*.3])cyl(.6,1.6,85,355,8,fmat(false,0xffffff),ox,s*.35-s*.2);roof=355;break;}
    case"hancock":{ // 875 N Michigan: tapering black tower, X-bracing, twin antennas
      const H=344,dk=fmat(true,0x25272b);const tw=lmMesh(new T.CylinderGeometry(w*.42,w*.68,H,4,1).translate(0,H/2,0),dk,0,0,0,Math.PI/4);g.add(tw);
      const xb=solid(0x1a1b1e,.6,.4);for(let k=0;k<5;k++){const ya=k*H/5,yb=(k+1)*H/5,wa=lerp(w*.68,w*.42,k/5)*Math.SQRT1_2*1.0,wb=lerp(w*.68,w*.42,(k+1)/5)*Math.SQRT1_2;
        for(const [fx,fz] of [[1,0],[-1,0],[0,1],[0,-1]]){const ca=fx?[fx*wa,ya,-wa]:[-wa,ya,fz*wa],cb=fx?[fx*wb,yb,wb]:[wb,yb,fz*wb],cc=fx?[fx*wa,ya,wa]:[wa,ya,fz*wa],cd=fx?[fx*wb,yb,-wb]:[-wb,yb,fz*wb];
          const o=fx?[fx*.8,0,0]:[0,0,fz*.8];beam(g,[ca[0]+o[0],ca[1],ca[2]+o[2]],[cb[0]+o[0],cb[1],cb[2]+o[2]],.9,xb);beam(g,[cc[0]+o[0],cc[1],cc[2]+o[2]],[cd[0]+o[0],cd[1],cd[2]+o[2]],.9,xb);}}
      for(const ox of [-8,8])cyl(.6,1.8,100,H,8,steel,ox);roof=H;break;}
    case"pyramid":{ // Transamerica: white pyramid, elevator wings, aluminium spire
      const H=212;g.add(lmMesh(new T.CylinderGeometry(w*.06,w*.74,H,4,1).translate(0,H/2,0),fmat(false,0xf4f2ec),0,0,0,Math.PI/4));
      for(const sx of [-1,1])box(6,72,10,150,fmat(false,0xf4f2ec),sx*w*.13);
      cyl(.6,3.4,48,H,4,solid(0xd8dde2,.35,.7),0,0,Math.PI/4);roof=H;break;}
    case"round":{ // Salesforce Tower: rounded-square taper with a lit open crown
      const H=h*.92;g.add(lmMesh(squircle(new T.CylinderGeometry(w*.43,w*.5,H,48,6),4).translate(0,H/2,0),fmat(true,0xb7c6d2),0,0,0));
      g.add(lmMesh(squircle(new T.CylinderGeometry(w*.41,w*.43,h-H,48,1,true),4).translate(0,(h-H)/2,0),glowMat(0xdde9ff,0xe9eef2,1.6),0,H,0));roof=h;break;}
    case"needle":{ // Space Needle: three pairs of curved legs, halo, saucer, spire
      const W2=solid(0xf3f1ec,.55),G2=fmat(true,0xaebfcc);
      for(let k=0;k<3;k++)for(const off of [-.2,.2]){const a=k*2*Math.PI/3+off,a2=k*2*Math.PI/3+off*.4;
        const p0=[Math.cos(a)*20,0,Math.sin(a)*20],p1=[Math.cos(a2)*5.5,62,Math.sin(a2)*5.5],p2=[Math.cos(a)*12,146,Math.sin(a)*12];beam(g,p0,p1,1.1,W2);beam(g,p1,p2,1.0,W2);}
      cyl(3.2,3.6,150,0,16,W2);const halo=lmMesh(new T.TorusGeometry(22,1.2,8,48).rotateX(Math.PI/2),W2,0,150,0);g.add(halo);
      cyl(19,13,8,146,40,W2);cyl(20.5,20.5,7,154,40,G2);cyl(18,21,3,161,40,W2);cyl(6,18,9,164,40,W2);cyl(3,6,6,173,24,glowMat(0xffd98a,0xf3f1ec,1.2));mast(12,179,1);break;}
    case"column":{ // Coit Tower: fluted concrete column with arched crown
      const st=solid(0xece6d8,.85);cyl(6.8,6.8,h*.88,0,20,st);cyl(7.6,7.2,h*.12,h*.88,20,st);box(22,6,22,0,st);cyl(5.5,5.5,2,h,20,st);break;}
    case"twin":{ // Marina City: two corncob towers with scalloped balconies
      const cs=fmat(false,0xe9e6df),bal=solid(0xf2efe8,.8);const R0=w/2;
      for(const o of [-26,26]){cyl(R0*.62,R0*.62,h,0,24,cs,o,0);const n=Math.floor((h-58)/3.2);const ig=new T.CylinderGeometry(R0,R0,.5,16);const im=new T.InstancedMesh(ig,bal,n+18);let k=0;
        for(let q=0;q<n;q++){dummy.position.set(o,58+q*3.2,0);dummy.quaternion.identity();dummy.scale.set(1,1,1);dummy.updateMatrix();im.setMatrixAt(k++,dummy.matrix);}
        for(let q=0;q<18;q++){dummy.position.set(o,2+q*3.2,0);dummy.scale.set(.9,1,.9);dummy.updateMatrix();im.setMatrixAt(k++,dummy.matrix);}im.castShadow=true;g.add(im);}break;}
    case"stepped":{
      if(/Columbia/.test(L.n)){ // three concave-star tiers in dark glass
        const dk=fmat(true,0x2c3036);[[1,0,.58],[.82,.58,.22],[.64,.8,.2]].forEach(([sc,y,f])=>{box(w*sc,h*f,w*sc*.62,h*y,dk);box(w*sc*.62,h*f,w*sc,h*y,dk);box(w*sc*.78,h*f,w*sc*.78,h*y,dk,0,0,Math.PI/4);});}
      else{ // Trump Tower Chicago: three setbacks and a spire
        const gl=fmat(true,0xb9c7d1);box(w*1.3,95,w*.75,0,gl);box(w*1.05,105,w*.66,95,gl);box(w*.85,90,w*.56,200,gl);box(w*.6,64,w*.46,290,gl);mast(69,354,2.2);}
      break;}
    case"spire":{ // historic terra-cotta tower with a pyramidal / gothic crown
      const T1=/Smith/.test(L.n)?fmat(false,0xf2efe6):fmat(false,0xece4d4),cap=/Woolworth|Tribune/.test(L.n)?solid(0x7e9a8c,.7,.2):solid(0x6a8c7e,.7,.2);
      const ww=Math.min(w,main?Math.max(16,Math.min(main.w,main.d)):w);const sh=h*.68;box(ww*1.35,h*.2,ww*1.2,0,T1);box(ww,sh-h*.2,ww,h*.2,T1);
      box(ww*.8,h*.1,ww*.8,sh,T1);g.add(lmMesh(new T.CylinderGeometry(ww*.04,ww*.6,h*.18,4,1).translate(0,h*.09,0),cap,0,sh+h*.1,0,Math.PI/4));mast(h*.06,h*.96,.8);break;}
    default:{ // stadiums, arenas and the rest use the classic builders below
      const LL=Object.assign({},L,{w,d,rot:0});const gg=classicLandmark(LL);gg.position.set(x,L.shape==="ship"?0:y0,z);gg.rotation.y=L.shape==="ship"?-(L.rot||0)*D:rot;cityG.add(gg);
      lmL.push({n:L.n,h:L.h,x,z,y:y0+L.h+10});return "done";}
  }
  g.position.set(x,y0,z);g.rotation.y=rot;cityG.add(g);
  const fp=Math.min(w*d,(main?main.A:w*d));const i=addB({x,z,w:Math.sqrt(fp),d:Math.sqrt(fp),h:Math.min(roof,h)*.85,y:y0,g:1,k:"m",u:"o",c:[.8,.8,.8],a:0,lm:true});B[i].inst=-1;B[i].lmH=h;
  lmL.push({n:L.n,h:L.h,x,z,y:y0+L.h+10});return "done";
}
// Stadiums, ballparks and arenas built from their real outline: sloped seating bowl, outer wall, roof ring
function venueModel(L,x0,z0,main){
  const pip=(x,z,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
  const cen=P=>{let x=0,z=0;for(const p of P){x+=p[0];z+=p[1];}return [x/P.length,z/P.length];};
  const area=P=>{let A=0;for(let i=0,j=P.length-1;i<P.length;j=i++)A+=P[j][0]*P[i][1]-P[i][0]*P[j][1];return Math.abs(A/2);};
  // 1) the field: the biggest pitch near the landmark  2) the venue: the largest building or stadium outline around that field
  let pitch=null,pd=1e9;for(const s of OSM.sports||[]){if(s.k!=="pitch"||s.pts.length<3)continue;const A=area(s.pts);if(A<3500)continue;const c=cen(s.pts);const dd=Math.hypot(c[0]-x0,c[1]-z0)-Math.sqrt(A)*.3;if(dd<pd&&dd<300){pd=dd;pitch=s;}}
  const fc=pitch?cen(pitch.pts):[x0,z0];let poly=null,pa=0;
  for(const s of OSM.sports||[]){if(s.k!=="stadium"||s.pts.length<4)continue;if(pip(fc[0],fc[1],s.pts)){const A=area(s.pts);if(A>pa){pa=A;poly=s.pts;}}}
  for(const b of B){if(!b.osm||b.kid||!b.pts||b.A<4000)continue;if(Math.hypot(b.x-fc[0],b.z-fc[1])>400)continue;const P=[];for(let k=0;k<b.pts.length;k+=2)P.push([b.pts[k],b.pts[k+1]]);if(pip(fc[0],fc[1],P)&&b.A>pa*1.05&&b.A<(pitch?area(pitch.pts)*8:1e9)){pa=b.A;poly=P;}}
  if(!poly&&pitch){const pc=fc;poly=pitch.pts.map(p=>[pc[0]+(p[0]-pc[0])*1.65,pc[1]+(p[1]-pc[1])*1.65]);pa=area(poly);}
  if(!poly&&main&&main.pts){poly=[];for(let k=0;k<main.pts.length;k+=2)poly.push([main.pts[k],main.pts[k+1]]);pa=area(poly);}
  if(!poly||poly.length<4)return false;
  const dp=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/12));for(let j=0;j<n;j++)dp.push([lerp(a[0],b[0],j/n),lerp(a[1],b[1],j/n)]);}
  let [cx,cz]=cen(dp);if(pitch&&pip(fc[0],fc[1],dp)){cx=fc[0];cz=fc[1];}const n=dp.length;
  const indoor=L.shape==="arena"&&!/Park|Field/.test(L.n);const ball=/Park/.test(L.n)&&!indoor;
  const H=Math.max(22,Math.min(L.h*(indoor?.85:.82),48)),y0=Math.max(0,elevAt(cx,cz));
  for(const b of B){if(b.osm&&!b.kid&&pip(b.x,b.z,dp))b.iconHide=true;}
  const at=(i,t)=>[cx+(dp[i][0]-cx)*t,cz+(dp[i][1]-cz)*t];
  // long axis of the venue (for roofs, scoreboards)
  let sxx=0,szz=0,sxz=0;for(const q of dp){const dx=q[0]-cx,dz=q[1]-cz;sxx+=dx*dx;szz+=dz*dz;sxz+=dx*dz;}const axA=.5*Math.atan2(2*sxz,sxx-szz),ax=[Math.cos(axA),Math.sin(axA)];
  const add=(arr,a,b,c,d)=>arr.push(...a,...b,...c,...b,...d,...c);
  const wall=[],glass=[],seatL=[],seatU=[],face=[],roof=[],uvL=[],uvU=[];
  const kIn=pitch?clamp(Math.sqrt(area(pitch.pts)/Math.max(1,pa))*1.12,.45,.82):(ball?.66:.6),kMid=kIn+(1-kIn)*.48;
  const lumen=/Lumen|Soldier/.test(L.n),tmo=/T-Mobile|Oracle|Petco/.test(L.n)&&!indoor;
  const P3=(q,y)=>[q[0],y0+y,q[1]];
  const mk2=(arr,col,o)=>{if(!arr.length)return;const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(arr,3));g.computeVertexNormals();const m=new T.Mesh(g,Object.assign(new T.MeshStandardMaterial({color:new T.Color(col).convertSRGBToLinear(),roughness:.8,side:T.DoubleSide}),o||{}));m.castShadow=true;m.receiveShadow=true;cityG.add(m);};
  // along-axis extent, used to drop one end of the bowl (open end zone / outfield) like the real venues
  let umin=1e9,umax=-1e9;const U=dp.map(q=>{const u=(q[0]-cx)*ax[0]+(q[1]-cz)*ax[1];umin=Math.min(umin,u);umax=Math.max(umax,u);return u;});
  let iMax=0,iMin=0;for(let i=0;i<n;i++){if(U[i]>U[iMax])iMax=i;if(U[i]<U[iMin])iMin=i;}const nSign=dp[iMax][1]<dp[iMin][1]?1:-1; // north = smaller z
  const fN=i=>{const f=(U[i]-umin)/((umax-umin)||1);return nSign>0?f:1-f;};
  const sm=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  // Lumen Field is a U: tall sidelines, a mid-height south end, low "Hawks' Nest" bleachers at the open north end
  const hAt=i=>{if(indoor)return H;const f=fN(i);if(lumen)return H*(1-.72*sm(.8,.93,f)-.34*(1-sm(.06,.16,f)));const lowEnd=ball?(nSign>0?f:1-f)<.2:false;return lowEnd?H*.58:H;};
  const archH=f=>H+6+24*Math.sin(Math.PI*clamp((f+.14)/1.28,0,1));
  const brick=[],glassE=[];
  let per=0;const perim=[0];for(let i=1;i<=n;i++){per+=Math.hypot(dp[i%n][0]-dp[i-1][0],dp[i%n][1]-dp[i-1][1]);perim.push(per);}
  for(let i=0;i<n;i++){const j=(i+1)%n;const h0=hAt(i),h1=hAt(j);
    const o0=at(i,1),o1=at(j,1),s0=at(i,.975),s1=at(j,.975);
    // stepped facade: base, glass concourse band set back, upper wall
    const lat=(dp[i][0]-cx)*(-ax[1])+(dp[i][1]-cz)*ax[0],isSide=Math.abs(U[i])<(umax-umin)*.36,west=dp[i][0]<cx;
    if(lumen&&isSide){const x0=at(i,1.07),x1=at(j,1.07);add(wall,P3(o0,0),P3(o1,0),P3(o0,h0*.45),P3(o1,h1*.45));add(face,P3(o0,h0*.45),P3(o1,h1*.45),P3(x0,h0*.55),P3(x1,h1*.55));add(west?brick:glassE,P3(x0,h0*.55),P3(x1,h1*.55),P3(x0,h0),P3(x1,h1));}
    else if(lumen&&isSide&&!west){add(wall,P3(o0,0),P3(o1,0),P3(o0,h0*.18),P3(o1,h1*.18));add(glassE,P3(o0,h0*.18),P3(o1,h1*.18),P3(s0,h0*.92),P3(s1,h1*.92));add(wall,P3(s0,h0*.92),P3(s1,h1*.92),P3(s0,h0),P3(s1,h1));}
    else{add(lumen&&isSide&&west?brick:wall,P3(o0,0),P3(o1,0),P3(o0,h0*.34),P3(o1,h1*.34));add(wall,P3(o0,h0*.34),P3(o1,h1*.34),P3(s0,h0*.36),P3(s1,h1*.36));
      add(glass,P3(s0,h0*.36),P3(s1,h1*.36),P3(s0,h0*.62),P3(s1,h1*.62));add(wall,P3(s0,h0*.62),P3(s1,h1*.62),P3(s0,h0),P3(s1,h1));}
    if(indoor){const r0=at(i,.86),r1=at(j,.86);add(roof,P3(s0,H),P3(s1,H),P3(r0,H+6),P3(r1,H+6));add(roof,P3(r0,H+6),P3(r1,H+6),[cx,y0+H+9,cz],[cx,y0+H+9,cz]);continue;}
    const i0=at(i,kIn),i1=at(j,kIn),m0=at(i,kMid),m1=at(j,kMid),u0=at(i,kMid+.035),u1=at(j,kMid+.035);
    const pu0=perim[i]/9,pu1=perim[i+1]/9;
    add(seatL,P3(m0,h0*.38),P3(m1,h1*.38),P3(i0,3),P3(i1,3));uvL.push(pu0,14,pu1,14,pu0,0,pu1,14,pu1,0,pu0,0);
    add(face,P3(m0,h0*.38),P3(m1,h1*.38),P3(u0,h0*.47),P3(u1,h1*.47));
    add(seatU,P3(s0,h0-1.2),P3(s1,h1-1.2),P3(u0,h0*.47),P3(u1,h1*.47));uvU.push(pu0,18,pu1,18,pu0,0,pu1,18,pu1,0,pu0,0);
    add(wall,P3(i0,0),P3(i1,0),P3(i0,3),P3(i1,3));
    const dir=[(dp[i][0]-cx),(dp[i][1]-cz)],dl=Math.hypot(...dir)||1,side=Math.abs((dir[0]*ax[0]+dir[1]*ax[1])/dl)<.62;
    if(!lumen){const c0=at(i,.86),c1=at(j,.86);add(roof,P3(s0,h0),P3(s1,h1),P3(c0,h0+2.5),P3(c1,h1+2.5));}}
  // Lumen Field: a long roof over each sideline (covering ~70% of seats, field left open), each hung from a low steel truss arch
  //   whose ends sit on concrete pylons beyond the north and south ends of the bowl
  if(lumen){const L2=(u,v)=>[cx+ax[0]*u-ax[1]*v,cz+ax[1]*u+ax[0]*v];let wo=0;for(const q of dp)wo=Math.max(wo,Math.abs(-(q[0]-cx)*ax[1]+(q[1]-cz)*ax[0]));
    let wf=wo*kIn;if(pitch){wf=0;for(const q of pitch.pts)wf=Math.max(wf,Math.abs(-(q[0]-cx)*ax[1]+(q[1]-cz)*ax[0]));}
    const uS=nSign>0?umin:umax,uN=nSign>0?umax:umin;const ua=lerp(uS,uN,.02),ub=lerp(uS,uN,.86);
    const roofTop=[],roofEdge=[],under=[];const R=(u,v,y)=>{const q=L2(u,v);return [q[0],y0+y,q[1]];};
    for(const sd of [-1,1]){const vIn=sd*(wf+4),vOut=sd*(wo*1.12);const N=16;
      for(let k=0;k<N;k++){const u0=lerp(ua,ub,k/N),u1=lerp(ua,ub,(k+1)/N);const yo=H+2,yi=H+9;
        add(roofTop,R(u0,vOut,yo),R(u1,vOut,yo),R(u0,vIn,yi),R(u1,vIn,yi));add(under,R(u0,vOut,yo-1.2),R(u1,vOut,yo-1.2),R(u0,vIn,yi-1.6),R(u1,vIn,yi-1.6));
        add(roofEdge,R(u0,vIn,yi-1.6),R(u1,vIn,yi-1.6),R(u0,vIn,yi),R(u1,vIn,yi));}
      for(const u of [ua,ub])add(roofEdge,R(u,vOut,H+.8),R(u,vIn,H+7.4),R(u,vOut,H+2),R(u,vIn,H+9));
      // truss arch over the middle of the roof: top and bottom chords with struts; pylons at both ends
      const vA=sd*(wf+4+(wo-wf-4)*.45),uA=lerp(uS,uN,-.16),uB=lerp(uS,uN,1.12),top=[],bot=[];
      for(let k=0;k<=28;k++){const t=k/28,u=lerp(uA,uB,t),hh=Math.sin(Math.PI*t);top.push(R(u,vA,H+10+22*hh));bot.push(R(u,vA,H+10+22*hh-4.5*hh));}
      const tube=(a,b2,r)=>{const dx=b2[0]-a[0],dy=b2[1]-a[1],dz=b2[2]-a[2],Lb=Math.hypot(dx,dy,dz);if(Lb<.1)return;const m=new T.Mesh(new T.CylinderGeometry(r,r,Lb,6),MAT.steel);m.position.set((a[0]+b2[0])/2,(a[1]+b2[1])/2,(a[2]+b2[2])/2);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(dx/Lb,dy/Lb,dz/Lb));m.castShadow=true;cityG.add(m);};
      for(let k=0;k<28;k++){tube(top[k],top[k+1],1.1);tube(bot[k],bot[k+1],.8);if(k%2===0)tube(top[k],bot[k],.35);}
      for(const e of [0,28]){const q=top[e];const py=new T.Mesh(new T.BoxGeometry(8,q[1]-y0,8).translate(0,(q[1]-y0)/2,0),solid(0xc4c0b8,.9));py.position.set(q[0],y0,q[2]);py.castShadow=true;cityG.add(py);}}
    mk2(roofTop,0xe9e7e2,{metalness:.2,roughness:.5});mk2(under,0x8d949b);mk2(roofEdge,0xd5d2cb);}
  // retractable roof parked beside the ballpark, on rails
  if(tmo){let best=null;for(const q of dp){if(!best||q[0]>best[0])best=q;}const half=Math.sqrt(pa)*.42;const g=new T.Group();
    for(let k=0;k<3;k++){const pnl=new T.Mesh(new T.CylinderGeometry(half,half,58,24,1,true,-Math.PI/2.8,Math.PI/1.4).rotateZ(Math.PI/2),new T.MeshStandardMaterial({color:new T.Color(0xd9dde0).convertSRGBToLinear(),roughness:.5,metalness:.4,side:T.DoubleSide}));
      pnl.scale.set(1,.42,1);pnl.position.set(best[0]+28+k*6,y0+H-half*.42+6+k*3,cz+(k-1)*8);pnl.castShadow=true;g.add(pnl);}
    for(const sd of [-1,1]){const rl=new T.Mesh(new T.BoxGeometry(70,H+4,3),MAT.steel);rl.position.set(best[0]+34,y0+(H+4)/2,cz+sd*half*.9);rl.castShadow=true;g.add(rl);}cityG.add(g);}
  // lights: on the roof edge for Lumen, on towers elsewhere; scoreboard over the low end
  if(!indoor){const nT=ball?6:4;for(let k=0;k<nT;k++){const i=Math.floor((k+.5)*n/nT)%n;const q=at(i,lumen?.93:1);const ph=lumen?hAt(i)+10:hAt(i)+24;
      if(!lumen){const pole=new T.Mesh(new T.CylinderGeometry(.5,.8,ph,6).translate(0,ph/2,0),MAT.steel);pole.position.set(q[0],y0,q[1]);pole.castShadow=true;cityG.add(pole);}
      const hd=new T.Mesh(new T.BoxGeometry(lumen?14:9,lumen?2:5,1.2),glowMat(0xfff6d8,0xeeeeee,2));hd.position.set(q[0],y0+ph,q[1]);hd.lookAt(cx,y0+ph,cz);cityG.add(hd);}
    if(lumen){const ni=nSign>0?iMax:iMin;const q=at(ni,.9);const tq=[lerp(q[0],cx,.05)-ax[1]*14,lerp(q[1],cz,.05)+ax[0]*14];const twr=new T.Mesh(new T.BoxGeometry(24,50,18).translate(0,25,0),fmat(false,0xc99a84));twr.position.set(tq[0],y0,tq[1]);twr.rotation.y=-Math.atan2(ax[1],ax[0]);twr.castShadow=true;cityG.add(twr);
      const vb=new T.Mesh(new T.BoxGeometry(20,30,1.4),new T.MeshStandardMaterial({color:0x14171b,emissive:new T.Color(0x3a5f9a),emissiveIntensity:.7}));vb.position.set(tq[0]+(cx-tq[0])*.08,y0+30,tq[1]+(cz-tq[1])*.08);vb.lookAt(cx,y0+30,cz);vb.translateZ(9.6);cityG.add(vb);}
    let far=null,fd=lumen?-1e9:1e9;for(let i=0;i<n;i++){if(lumen?U[i]>fd:U[i]<fd){fd=U[i];far=dp[i];}}
    if(!lumen){const sb=new T.Mesh(new T.BoxGeometry(34,12,2),new T.MeshStandardMaterial({color:0x1a1d22,emissive:new T.Color(0x2a4a7a),emissiveIntensity:.6}));sb.position.set(lerp(cx,far[0],.93),y0+H*.58+8,lerp(cz,far[1],.93));sb.lookAt(cx,y0+H*.58+8,cz);sb.castShadow=true;cityG.add(sb);}}
  // seating rows: a striped texture so tiers read as seats, not slabs
  if(!E._seatTex){const c=document.createElement("canvas");c.width=4;c.height=64;const x=c.getContext("2d");for(let r=0;r<8;r++){x.fillStyle=r%2?"#d9dde1":"#aeb6bf";x.fillRect(0,r*8,4,6);x.fillStyle="#6c757e";x.fillRect(0,r*8+6,4,2);}
    E._seatTex=new T.CanvasTexture(c);E._seatTex.wrapS=E._seatTex.wrapT=T.RepeatWrapping;E._seatTex.encoding=T.sRGBEncoding;}
  const mk=(arr,col,o,uv)=>{if(!arr.length)return;const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(arr,3));if(uv)g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();
    const m=new T.Mesh(g,Object.assign(new T.MeshStandardMaterial({color:new T.Color(col).convertSRGBToLinear(),roughness:.8,side:T.DoubleSide}),o||{}));m.castShadow=true;m.receiveShadow=true;cityG.add(m);};
  const seatC=ball?0x5f9a86:lumen?0x7d93ad:0x9fb0c0;
  mk(wall,indoor?0xc9ced3:lumen?0xc9b2a4:0xe4e1da);mk(brick,0x8e4a3e);mk(glassE,0x6d8597,{roughness:.15,metalness:.55});mk(glass,0x7c8d99,{roughness:.2,metalness:.5});mk(seatL,seatC,{map:E._seatTex},uvL);mk(seatU,seatC,{map:E._seatTex},uvU);mk(face,0x3b4148);mk(roof,indoor?0xe3e5e8:0xf1efea,{metalness:.15,roughness:.55});
  // the playing surface if OSM didn't map one
  if(!indoor&&!(OSM.sports||[]).some(s=>s.k==="pitch"&&pip(s.pts[0][0],s.pts[0][1],dp))){const sh=new T.Shape(dp.map((p,i)=>{const q=at(i,kIn*.95);return new T.Vector2(q[0],q[1]);}));const fg=new T.ShapeGeometry(sh).rotateX(Math.PI/2);const f=new T.Mesh(fg,new T.MeshStandardMaterial({color:new T.Color(0x5d9b4b).convertSRGBToLinear(),side:T.DoubleSide}));f.position.y=y0+.3;cityG.add(f);}
  let A=0;for(let i=0,j=dp.length-1;i<dp.length;j=i++)A+=dp[j][0]*dp[i][1]-dp[i][0]*dp[j][1];
  const ii=addB({x:cx,z:cz,w:Math.sqrt(Math.abs(A/2)),d:Math.sqrt(Math.abs(A/2)),h:H,y:y0,g:1,k:"m",u:"c",c:[.8,.8,.8],a:0,lm:true});B[ii].inst=-1;B[ii].lmH=H;
  lmL.push({n:L.n,h:L.h,x:cx,z:cz,y:y0+H+12});return true;
}
function classicLandmark(L){const save=C.landmarks;C.landmarks=[L];const before=cityG.children.length;OSM_FORCE=true;buildLandmarks();OSM_FORCE=false;C.landmarks=save;const g=cityG.children.splice(before,1)[0];lmL.pop();return g;}
let OSM_FORCE=false;
function buildLandmarks(){
  if(!OSM_FORCE)GLOW.length=0;
  for(const L of C.landmarks){
    const [x,z]=P(L.ll);
    if(OSM&&!OSM_FORCE){const r=buildIcon(L,x,z);if(r!=="skip")continue;lmL.push({n:L.n,h:L.h,x,z,y:elevAt(x,z)+L.h+10});continue;}const g=new T.Group();const w=L.w,d=L.d||L.w,h=L.h,y0=elevAt(x,z)-1;
    const box=(bw,bh,bd,yy,mat)=>{g.add(lmMesh(new T.BoxGeometry(bw,bh,bd).translate(0,bh/2,0),mat||MAT.lm,0,yy,0));};
    const fr=(rb,rt,hh,yy,seg,mat)=>{g.add(lmMesh(new T.CylinderGeometry(rt,rb,hh,seg||4,1).translate(0,hh/2,0),mat||MAT.lmG,0,yy,0,seg===4||!seg?Math.PI/4:0));};
    const spire=(hh,yy,r0)=>{g.add(lmMesh(new T.CylinderGeometry(.25,r0||1.2,hh,6).translate(0,hh/2,0),MAT.steel,0,yy,0));};
    let roof=L.roof||h;
    switch(L.shape){
      case"obelisk":fr(w*.72,w*.5,417,0);box(w*1.05,20,w*1.05,0,MAT.lm);spire(124,417,2.2);break;
      case"esb":box(w*1.6,26,w*1.3,0);box(w,250,w*.8,26);box(w*.75,60,w*.6,276);box(w*.5,30,w*.4,336);box(w*.3,15,w*.3,366);spire(62,381,2.5);roof=381;break;
      case"chrysler":box(w,200,w,0);box(w*.82,40,w*.82,200);fr(w*.55,w*.1,60,240,8,MAT.steel);spire(19,300,.8);break;
      case"willis":{const s=w/3;const hs=[[442,1,1],[390,0,1],[390,1,0],[350,0,0],[270,2,0],[270,2,2],[200,1,2],[200,0,2],[270,2,1]];for(const [hh,ix,iz] of hs){const m=lmMesh(new T.BoxGeometry(s,hh,s).translate(0,hh/2,0),MAT.lmG,(ix-1)*s,0,(iz-1)*s);g.add(m);}spire(85,442,1.6);break;}
      case"hancock":fr(w*.95,w*.55,h,0,4,MAT.lm);spire(100,h,1.5);break;
      case"stepped":box(w,h*.55,d,0);box(w*.78,h*.27,d*.78,h*.55);box(w*.5,h*.18,d*.5,h*.82);break;
      case"spire":box(w,h*.82,d,0,MAT.lm);fr(w*.62,1,h*.18,h*.82,4,MAT.lm);break;
      case"taper":fr(w*.72,w*.42,h,0);break;
      case"pyramid":fr(w*.75,w*.06,h*.9,0,4,MAT.lm);spire(h*.1,h*.9,1.2);break;
      case"round":g.add(lmMesh(new T.CylinderGeometry(w*.45,w*.52,h*.92,40).translate(0,h*.46,0),MAT.lmG,0,0,0));g.add(lmMesh(new T.SphereGeometry(w*.45,24,8,0,Math.PI*2,0,Math.PI/2),MAT.lmG,0,h*.92,0));break;
      case"glass":box(w,h,d,0,MAT.lmG);break;
      case"slab":box(w,h,w,0,MAT.lm);break;
      case"twin":for(const o of [-22,22]){const m=lmMesh(new T.CylinderGeometry(w/2,w/2,h,24).translate(0,h/2,0),MAT.lm,o,0,0);g.add(m);}break;
      case"needle":g.add(lmMesh(new T.CylinderGeometry(3,7,150,12).translate(0,75,0),MAT.stone,0,0,0));g.add(lmMesh(new T.CylinderGeometry(21,14,12,32).translate(0,6,0),MAT.lm,0,152,0));spire(20,164,1);break;
      case"stadium":{const sh=new T.Shape();sh.absellipse(0,0,w/2,d/2,0,Math.PI*2);const hole=new T.Path();hole.absellipse(0,0,w*.32,d*.3,0,Math.PI*2);sh.holes.push(hole);const eg=new T.ExtrudeGeometry(sh,{depth:h,bevelEnabled:false});eg.rotateX(-Math.PI/2);g.add(lmMesh(eg,MAT.stone,0,0,0));const f=new T.Mesh(new T.CircleGeometry(1,40),new T.MeshStandardMaterial({color:0x3f8a3a}));f.scale.set(w*.32,d*.3,1);f.rotation.x=-Math.PI/2;f.position.y=2;g.add(f);break;}
      case"arena":{g.add(lmMesh(new T.CylinderGeometry(w*.5,w*.52,h,36).translate(0,h/2,0),MAT.stone,0,0,0));g.scale.set(1,1,(d||w)/w);break;}
      case"dome":box(w,h*.45,d,0,MAT.stone);g.add(lmMesh(new T.CylinderGeometry(16,18,18,24).translate(0,9,0),MAT.stone,0,h*.45,0));g.add(lmMesh(new T.SphereGeometry(16,24,12,0,Math.PI*2,0,Math.PI/2),MAT.steel,0,h*.45+18,0));spire(14,h*.45+34,1);break;
      case"ferry":box(w,20,d,0,MAT.stone);box(14,75,14,0,MAT.stone);break;
      case"column":g.add(lmMesh(new T.CylinderGeometry(6,6.5,h,16).translate(0,h/2,0),MAT.stone,0,0,0));break;
      case"antenna":{for(const [ox,oz] of [[-14,-8],[14,-8],[0,16]]){const m=lmMesh(new T.CylinderGeometry(1,2.2,h,6).translate(0,h/2,0),MAT.steel,ox,0,oz);g.add(m);}box(34,4,34,h*.62,MAT.steel);box(30,3,30,h*.9,MAT.steel);break;}
      case"ship":{const m=lmMesh(new T.BoxGeometry(w,14,d).translate(0,7,0),new T.MeshStandardMaterial({color:0x6c7177,roughness:.7}),0,0,0);g.add(m);box(w*1.2,3,d*1.02,14,new T.MeshStandardMaterial({color:0x585c60}));box(14,30,40,17,new T.MeshStandardMaterial({color:0x6c7177}));break;}
      case"hotel":box(w,h*.7,d,0,MAT.lm);g.add(lmMesh(new T.ConeGeometry(w*.35,h*.5,4).rotateY(Math.PI/4).translate(0,h*.25,0),new T.MeshStandardMaterial({color:0xb24a32,roughness:.8}),0,h*.7,0));break;
      default:box(w,h,d,0,MAT.lm);
    }
    g.position.set(x,L.shape==="ship"?0:y0,z); g.rotation.y=-(L.rot||0)*D; cityG.add(g);
    if(L.shape!=="ship"&&L.shape!=="stadium"&&L.shape!=="arena"&&L.shape!=="antenna"&&L.shape!=="column"){
      const fp=w*(L.d||w)*(L.shape==="round"||L.shape==="twin"?.8:1)*(L.shape==="needle"?0:1);
      const i=addB({x,z,w:Math.sqrt(fp),d:Math.sqrt(fp),h:Math.min(roof,h)*.85,y:y0,g:1,k:"m",u:L.shape==="hotel"||L.shape==="dome"?"c":"o",c:[.8,.8,.8],a:0,lm:true});B[i].inst=-1;B[i].lmH=h;
    }
    lmL.push({n:L.n,h:L.h,x,z,y:y0+L.h+10});
  }
}
function buildBridges(){
  for(const br of C.bridges||[]){
    const a=P(br.a),b=P(br.b);const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),ang=Math.atan2(-dz,dx);
    const g=new T.Group();g.position.set((a[0]+b[0])/2,0,(a[1]+b[1])/2);g.rotation.y=ang;
    const deck=new T.Mesh(new T.BoxGeometry(L,4,br.kind==="girder"?20:28),MAT.steel);deck.position.y=br.deck;deck.castShadow=true;g.add(deck);
    if(br.kind==="susp"){
      const tx=[-L*.28,L*.28];const tm=br.stone?MAT.stone:MAT.steel;
      for(const t of tx){for(const s of [-12,12]){const m=new T.Mesh(new T.BoxGeometry(br.stone?14:6,br.tower,br.stone?12:6),tm);m.position.set(t,br.tower/2,s);m.castShadow=true;g.add(m);}}
      for(const s of [-12,12]){const pts=[];for(let k=0;k<=60;k++){const xx=-L/2+L*k/60;let yy;if(xx<tx[0])yy=lerp(br.deck+3,br.tower,(xx+L/2)/(tx[0]+L/2));else if(xx>tx[1])yy=lerp(br.tower,br.deck+3,(xx-tx[1])/(L/2-tx[1]));else{const u=(xx-tx[0])/(tx[1]-tx[0]);yy=br.deck+6+(br.tower-br.deck-6)*Math.pow(2*u-1,2);}pts.push(new T.Vector3(xx,yy,s));}g.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),MAT.cable));}
    }else if(br.kind==="cant"){for(let k=0;k<6;k++){const xx=-L/2+L*(k+.5)/6;const m=new T.Mesh(new T.BoxGeometry(L/6*.9,br.tower-br.deck,26),new T.MeshStandardMaterial({color:0x8d9399,wireframe:true}));m.position.set(xx,br.deck+(br.tower-br.deck)/2,0);g.add(m);}}
    for(let k=1;k<8;k++){const xx=-L/2+L*k/8;const pz=a[0]+dx*k/8,pzz=a[1]+dz*k/8;if(clsAt(pz,pzz)===0||true){const m=new T.Mesh(new T.BoxGeometry(6,br.deck,10),MAT.stone);m.position.set(xx,br.deck/2-2,0);g.add(m);}}
    cityG.add(g);
  }
}

/* ---------- lane markings & crosswalks ---------- */
function buildMarkings(){
  const solid=[],dash=[],zebra=[];
  const quad=(arr,x,z,len,wid,ang)=>arr.push([x,z,len,wid,ang]);
  const piece=(arr,x0,z0,x1,z1,wid,off)=>{const L=Math.hypot(x1-x0,z1-z0);const n=Math.max(1,Math.ceil(L/40));const ang=Math.atan2(z1-z0,x1-x0);const ox=-Math.sin(ang)*off,oz=Math.cos(ang)*off;for(let k=0;k<n;k++){const t0=k/n,t1=(k+1)/n;const xa=lerp(x0,x1,t0)+ox,za=lerp(z0,z1,t0)+oz,xb=lerp(x0,x1,t1)+ox,zb=lerp(z0,z1,t1)+oz;const cx=(xa+xb)/2,cz=(za+zb)/2;const k2=clsAt(cx,cz);if(k2!==3&&k2!==4)continue;quad(arr,cx,cz,L/n,wid,ang);}};
  for(const R of REG){if(!R.marks)continue;
    for(const [L1,L2,ax] of [[R.vL,R.uL,"v"],[R.uL,R.vL,"u"]]){
      for(const l of L1){if(!l.named||l.w<20)continue;
        const crossing=L2.filter(m=>active(m,l.p));
        for(let k=0;k<crossing.length-1;k++){const m1=crossing[k],m2=crossing[k+1];if(!active(l,(m1.p+m2.p)/2))continue;if(m2.p-m1.p>600)continue;
          const s0=m1.p+m1.w/2,s1=m2.p-m2.w/2;if(s1-s0<10)continue;
          const A=ax==="v"?world(R,s0,l.p):world(R,l.p,s0),Bp=ax==="v"?world(R,s1,l.p):world(R,l.p,s1);
          const mc=ax==="v"?world(R,(s0+s1)/2,l.p):world(R,l.p,(s0+s1)/2);if(clsAt(mc[0],mc[1])!==3)continue;
          piece(solid,A[0],A[1],Bp[0],Bp[1],.14,.18);piece(solid,A[0],A[1],Bp[0],Bp[1],.14,-.18);
          if(l.w>=26){piece(dash,A[0],A[1],Bp[0],Bp[1],.14,l.w/4);piece(dash,A[0],A[1],Bp[0],Bp[1],.14,-l.w/4);}
          if(m1.named||m1.w>=20){const ang=Math.atan2(Bp[1]-A[1],Bp[0]-A[0]);const cxw=A[0]+Math.cos(ang)*2,czw=A[1]+Math.sin(ang)*2;quad(zebra,cxw,czw,l.w-3,3,ang+Math.PI/2);}
          if(m2.named||m2.w>=20){const ang=Math.atan2(Bp[1]-A[1],Bp[0]-A[0]);quad(zebra,Bp[0]-Math.cos(ang)*2,Bp[1]-Math.sin(ang)*2,l.w-3,3,ang+Math.PI/2);}
        }
      }
    }
  }
  for(const r of C._roads){for(let k=0;k<r.pts.length-1;k++){const a=r.pts[k],b=r.pts[k+1];if(r.hwy){piece(dash,a[0],a[1],b[0],b[1],.16,r.w/6);piece(dash,a[0],a[1],b[0],b[1],.16,-r.w/6);piece(solid,a[0],a[1],b[0],b[1],.2,0);}else{piece(solid,a[0],a[1],b[0],b[1],.14,.18);piece(solid,a[0],a[1],b[0],b[1],.14,-.18);}}}
  const pg=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  for(const [arr,mat] of [[solid,MAT.yellow],[dash,MAT.white],[zebra,MAT.zebra]]){if(!arr.length)continue;const m=new T.InstancedMesh(pg,mat,arr.length);arr.forEach((q,i)=>{dummy.position.set(q[0],elevAt(q[0],q[1])+.16,q[1]);dummy.quaternion.setFromAxisAngle(YV,-q[4]);dummy.scale.set(q[2],1,q[3]);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.renderOrder=1;cityG.add(m);}
  E.markCount=solid.length+dash.length+zebra.length;
}

/* ---------- label anchors ---------- */
function addAnchor(a){anchors.push(a);const key=Math.floor((a.x+EXT)/500)+","+Math.floor((a.z+EXT)/500);if(!anchorGrid.has(key))anchorGrid.set(key,[]);anchorGrid.get(key).push(a);}
function buildAnchors(){
  for(const R of REG){
    for(const [L,ax] of [[R.uL,"u"],[R.vL,"v"]]){
      for(const l of L){if(!l.named)continue;
        const dir=ax==="u"?R.dv:R.du; const step=ax==="u"?240:300;
        for(let s=-9000;s<9000;s+=step){const [x,z]=ax==="u"?world(R,l.p,s):world(R,s,l.p);if(Math.abs(x)>EXT||Math.abs(z)>EXT)continue;if(regionAt(x,z)!==R)continue;if(clsAt(x,z)!==3)continue;if(!active(l,s))continue;
          const name=lineName(l,s);if(!name)continue;addAnchor({x,z,dir,name,major:l.w>=25,y:0});}
      }
    }
  }
  for(const r of C._roads){for(const [x,z,ang] of samplePath(r.pts,320)){const k=clsAt(x,z);if(k!==3&&k!==4)continue;addAnchor({x,z,dir:[Math.cos(ang),Math.sin(ang)],name:r.n,major:true});}}
  for(const a of anchors)a.y=elevAt(a.x,a.z)+1;
  hoodL=C.hoods.map(h=>{const [x,z]=P([h[1],h[2]]);return {n:h[0],x,z,y:elevAt(x,z)+40};});
}
E.streetNameAt=function(x,z){
  if(OSM)return osmStreetName(x,z);
  const R=regionAt(x,z);let best=null,bd=1e9;
  const key=Math.floor((x+EXT)/500)+","+Math.floor((z+EXT)/500);
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const [i,j]=key.split(",").map(Number);const arr=anchorGrid.get((i+dx)+","+(j+dz));if(!arr)continue;for(const a of arr){const d=Math.hypot(a.x-x,a.z-z);if(d<bd){bd=d;best=a;}}}
  if(R&&R.named){const [u,v]=frame(R,x,z);let nu=null,nv=null,du=1e9,dvv=1e9;for(const l of R.uL)if(l.named&&Math.abs(l.p-u)<du&&active(l,v)){du=Math.abs(l.p-u);nu=l;}for(const l of R.vL)if(l.named&&Math.abs(l.p-v)<dvv&&active(l,u)){dvv=Math.abs(l.p-v);nv=l;}
    if(nu&&nv&&du<220&&dvv<260)return lineName(nv,u)+" & "+lineName(nu,v);}
  return best&&bd<450?"near "+best.name:null;
};
E.hoodAt=function(x,z){let best=null,bd=1e9;for(const h of hoodL){const d=Math.hypot(h.x-x,h.z-z);if(d<bd){bd=d;best=h;}}return best?best.n:C.name;};

/* ---------- cars ---------- */
let NCARS=2400;
function carGeo(){
  const parts=[new T.BoxGeometry(4.5,.9,1.9).translate(0,.75,0),new T.BoxGeometry(2.4,.7,1.7).translate(-.3,1.55,0)];
  const pos=[],nor=[];for(const p of parts){const q=p.toNonIndexed();pos.push(...q.attributes.position.array);nor.push(...q.attributes.normal.array);}
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(pos,3));g.setAttribute("normal",new T.Float32BufferAttribute(nor,3));return g;
}
function initCars(){
  if(/Mobi|Android/i.test(navigator.userAgent||""))NCARS=1200;
  const r=rng(77);cars=[];
  carMesh=new T.InstancedMesh(carGeo(),MAT.car,NCARS);carMesh.frustumCulled=false;carMesh.castShadow=false;cityG.add(carMesh);
  const paints=[[.92,.92,.92],[.1,.1,.11],[.55,.57,.6],[.72,.74,.76],[.6,.08,.08],[.12,.22,.45],[.25,.3,.28],[.85,.85,.82]];
  for(let i=0;i<NCARS;i++){const c={r:rng(1000+i)};spawnCar(c);c.paint=paints[Math.floor(r()*paints.length)];cars.push(c);carMesh.setColorAt(i,col.setRGB(...c.paint).convertSRGBToLinear());}
}
function spawnCar(c){
  for(let t=0;t<40;t++){
    const ix=Math.floor(c.r()*TEXN),iz=Math.floor(c.r()*TEXN);if(cls[iz*TEXN+ix]!==3)continue;
    const x=-EXT+(ix+.5)*PX,z=-EXT+(iz+.5)*PX,R=regionAt(x,z);if(!R)continue;
    const [u,v]=frame(R,x,z);const lv=findLine(R.vL,v,u),lu=findLine(R.uL,u,v);
    c.R=R;c.dir=c.r()<.5?1:-1;
    if(lv&&!lu){c.ax=0;c.L=lv;c.s=u;}else if(lu&&!lv){c.ax=1;c.L=lu;c.s=v;}else continue;
    c.inX=false;return true;
  }
  c.R=null;return false;
}
function carPos(c){const R=c.R,l=c.L,off=l.w*.22;if(c.ax===0)return world(R,c.s,l.p+c.dir*off);return world(R,l.p-c.dir*off,c.s);}
let trafficView=false; E.setTrafficView=v=>{trafficView=v;if(!v)cars.forEach((c,i)=>carMesh.setColorAt(i,col.setRGB(...c.paint).convertSRGBToLinear()));if(carMesh)carMesh.instanceColor.needsUpdate=true;};
let simT=0;
function updateCars(dt,ttiGrid,share){
  simT+=dt*3.2;if(!carMesh)return;const camD=camera.position.distanceTo(controls.target);const sc=clamp(camD/900,1,3.2);
  const nVis=Math.floor(NCARS*clamp(share,.04,1));
  for(let i=0;i<NCARS;i++){const c=cars[i];
    if(c.osm&&i<nVis&&c.R){let [x,z]=carPosOSM(c);const t=ttiGrid?ttiGrid[cellOf(x,z)]:1;const v=(isHwy(c.way)?24:c.way.ty<=3?13:9)/t*3.2;if(c.hold){const sg=c.hold.sg;const green=((simT+sg.ph)%60<30)===(c.hold.bucket===0);if(green){c.hold=null;c.passed=true;c.go=(c.go||0)+1;}}if(!c.hold)stepCarOSM(c,v*dt);if(!c.R)continue;const q=carPosOSM(c);x=q[0];z=q[1];
      dummy.position.set(x,c.way.hs?deckAt(c.way,c.seg,x,z)+.6:elevAt(x,z)+.45,z);dummy.quaternion.setFromAxisAngle(YV,Math.atan2(-q[3],q[2]));dummy.scale.set(sc,sc,sc);dummy.updateMatrix();carMesh.setMatrixAt(i,dummy.matrix);
      if(trafficView&&(i%4===(frameNo%4))){const qq=clamp((t-1)/1.5,0,1);col.setRGB(qq<.5?lerp(.15,.95,qq/.5):lerp(.95,.88,(qq-.5)/.5),qq<.5?lerp(.7,.66,qq/.5):lerp(.66,.2,(qq-.5)/.5),qq<.5?lerp(.35,.2,qq/.5):lerp(.2,.15,(qq-.5)/.5));carMesh.setColorAt(i,col.convertSRGBToLinear());}continue;}
    if(i>=nVis||!c.R){dummy.position.set(0,-999,0);dummy.scale.set(1e-4,1e-4,1e-4);dummy.updateMatrix();carMesh.setMatrixAt(i,dummy.matrix);if(!c.R&&c.r()<.05){if(c.osm)spawnCarOSM(c);else spawnCar(c);}continue;}
    let [x,z]=carPos(c);const t=ttiGrid?ttiGrid[cellOf(x,z)]:1;const v=(c.L.w>=26?15:11)/t*3.2;
    c.s+=c.dir*v*dt;
    const other=c.ax===0?c.R.uL:c.R.vL;const cross=findLine(other,c.s,c.L.p);
    if(cross&&!c.inX){c.inX=true;if(c.r()<.28){const old=c.L;c.L=cross;c.ax=1-c.ax;c.s=old.p;c.dir=c.r()<.5?1:-1;}}
    else if(!cross)c.inX=false;
    [x,z]=carPos(c);
    if(clsAt(x,z)!==3||regionAt(x,z)!==c.R){spawnCar(c);if(!c.R)continue;[x,z]=carPos(c);}
    const d=c.ax===0?c.R.du:c.R.dv;
    dummy.position.set(x,elevAt(x,z)+.05,z);dummy.quaternion.setFromAxisAngle(YV,Math.atan2(-d[1]*c.dir,d[0]*c.dir));dummy.scale.set(sc,sc,sc);dummy.updateMatrix();carMesh.setMatrixAt(i,dummy.matrix);
    if(trafficView&&(i%4===(frameNo%4))){const q=clamp((t-1)/1.5,0,1);if(q<.5){const f=q/.5;col.setRGB(lerp(.15,.95,f),lerp(.7,.66,f),lerp(.35,.2,f));}else{const f=(q-.5)/.5;col.setRGB(lerp(.95,.88,f),lerp(.66,.2,f),lerp(.2,.15,f));}carMesh.setColorAt(i,col.convertSRGBToLinear());}
  }
  carMesh.instanceMatrix.needsUpdate=true;if(trafficView)carMesh.instanceColor.needsUpdate=true;
}

/* ---------- aggregates / traffic model ---------- */
const JOB_M2=25.2,RES_M2=87,UNIT_M2=157,IND_M2=90; // calibrated on Seattle (DSA 2025 residents & jobs), held fixed elsewhere
function gfaOf(b){if(b.kid||b.u==="x")return 0;if(b.osm){const fl=b.lv&&!b.yo?b.lv:Math.max(1,Math.floor(b.h/3.6));return b.A*fl*.85;}const fl=Math.max(1,Math.floor(b.h/3.7));return b.w*b.d*(b.k==="c"?.785:1)*fl*.82;}
function useStats(b,out){const g=gfaOf(b);if(!g)return;out.gfa+=g;if(b.u==="o"){out.jobs+=g/JOB_M2;out.office+=g;}else if(b.u==="r"){out.res+=g/RES_M2;out.units+=g/UNIT_M2;}else if(b.u==="m"){out.jobs+=g*.5/JOB_M2;out.res+=g*.5/RES_M2;out.units+=g*.5/UNIT_M2;out.office+=g*.5;}else if(b.u==="i")out.jobs+=g/IND_M2;else if(b.u==="c")out.jobs+=g/120;}
E.gfaOf=gfaOf;
E.totals=function(filter){const o={res:0,jobs:0,units:0,office:0,gfa:0};for(const b of B){if(b.rm||b.kid||b.growing)continue;if(filter&&!filter(b))continue;useStats(b,o);}return o;};
E.sumIn=function(poly,within){const p=polys[poly],w=within?polys[within]:null;return E.totals(b=>pip(b.x,b.z,p)&&(!w||pip(b.x,b.z,w)));};
E.towerCounts=function(){
  if(OSM){const o=osmTowerCounts();for(const L of C.landmarks){if(!["needle","antenna","ship"].includes(L.shape))continue;}return o;}
  const groups=new Map();let c150=0,c100=0;
  for(const b of B){if(b.rm||b.kid||b.lm)continue;const top=b.yo+b.h;const key=b.tw!=null?"t"+b.tw:(top>=95?"b"+b.x.toFixed(0)+b.z.toFixed(0):null);if(!key)continue;groups.set(key,Math.max(groups.get(key)||0,top));}
  for(const h of groups.values()){if(h>=150)c150++;if(h>=100)c100++;}
  for(const L of C.landmarks){if(["stadium","arena","ship","hotel","dome","ferry","column","antenna","needle"].includes(L.shape))continue;if(L.h>=150)c150++;if(L.h>=100)c100++;}
  return {c150,c100};
};
function computeCells(){
  const n=CG*CG;cells={res:new Float32Array(n),jobs:new Float32Array(n),units:new Float32Array(n),office:new Float32Array(n),park:new Float32Array(n),land:new Float32Array(n),street:streetCnt,hwy:hwyCnt,x:new Float32Array(n),z:new Float32Array(n),core:new Float32Array(n)};
  for(let j=0;j<CG;j++)for(let i=0;i<CG;i++){const k=j*CG+i,x=-EXT+(i+.5)*CPX,z=-EXT+(j+.5)*CPX;cells.x[k]=x;cells.z[k]=z;cells.core[k]=coreAt(x,z);}
  const step=CPX/PX;for(let j=0;j<CG;j++)for(let i=0;i<CG;i++){let lc=0,pc=0;for(let b=0;b<8;b++)for(let a=0;a<8;a++){const px=Math.floor((i+(a+.5)/8)*step),py=Math.floor((j+(b+.5)/8)*step);const k=cls[py*TEXN+px];if(k)lc++;if(k===2)pc++;}cells.land[j*CG+i]=lc/64;cells.park[j*CG+i]=pc/64;}
  refreshCells();
}
function refreshCells(){cells.res.fill(0);cells.jobs.fill(0);cells.units.fill(0);cells.office.fill(0);const o={res:0,jobs:0,units:0,office:0,gfa:0};
  for(const b of B){if(b.rm||b.kid||b.growing)continue;o.res=0;o.jobs=0;o.units=0;o.office=0;o.gfa=0;useStats(b,o);const c=b.cell!=null?b.cell:cellOf(b.x,b.z);cells.res[c]+=o.res;cells.jobs[c]+=o.jobs;cells.units[c]+=o.units;cells.office[c]+=o.office;}}
E.refreshCells=()=>refreshCells(); E.cells=()=>cells;
const PROF=[.12,.08,.06,.06,.1,.25,.55,.9,1,.82,.68,.7,.74,.72,.74,.82,.95,1,.88,.65,.5,.4,.3,.2];
E.PROF=PROF;
E.KCAP=0.95; // vehicles per hour per street pixel-equivalent (global constant, calibrated once)
E.traffic=function(o){
  o=o||{};const h=o.hour==null?8:o.hour;const pf=lerp(PROF[Math.floor(h)%24],PROF[(Math.floor(h)+1)%24],h-Math.floor(h));
  const n=CG*CG,dem=new Float32Array(n);const cs=o.carShare!=null?o.carShare:C.baseline.carShare;
  for(let k=0;k<n;k++){let m=(o.carMul?o.carMul[k]:1);const dens=clamp(1.3-cells.core[k]/220,.3,1.3);dem[k]=(cells.jobs[k]*.9+cells.res[k]*.42)*pf*cs*dens*m*(o.demandMul||1)/1.2;}
  let A=dem;for(let pass=0;pass<3;pass++){const out=new Float32Array(n);for(let y=0;y<CG;y++)for(let x=0;x<CG;x++){let s=0,w=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=CG||Y>=CG)continue;const ww=dx||dy?1:2;s+=A[Y*CG+X]*ww;w+=ww;}out[y*CG+x]=s/w;}A=out;}
  const tti=new Float32Array(n);let sd=0,st=0;
  for(let k=0;k<n;k++){const cap=(streetCnt[k]+2.5*hwyCnt[k]+3)*E.KCAP*(o.capMul?o.capMul[k]:1)*(o.cap||1);const vc=A[k]/cap;const t=Math.min(5,1+.15*Math.pow(vc,4));tti[k]=t;sd+=A[k];st+=A[k]*t;}
  return {tti,dem:A,avg:sd?st/sd:1,total:sd};
};
E.dailyCongestion=function(o){let num=0,den=0;for(let h=0;h<24;h++){const t=E.traffic(Object.assign({},o,{hour:h+.5}));num+=t.total*(t.avg-1);den+=t.total;}return den?num/den*100:0;};
E.calibrateTraffic=function(){E.trafficBase=E.traffic({hour:8});};

/* ---------- validation ---------- */
E.validate=function(){
  const V=C.validation,out={city:C.name,rows:[]};
  const tc=E.towerCounts();
  out.rows.push({k:"Buildings ≥150 m",model:tc.c150,real:V.t150,src:"CTBUH / Wikipedia, Oct 2025",note:V.note||"city total"});
  out.rows.push({k:"Buildings ≥100 m",model:tc.c100,real:V.t100,src:"CTBUH / Wikipedia, Oct 2025",note:V.note||"city total"});
  const d=V.district;if(d){const s=E.sumIn(d.poly,d.within);if(d.res)out.rows.push({k:d.name+" residents",model:Math.round(s.res),real:d.res,src:d.src});if(d.jobs)out.rows.push({k:d.name+" jobs",model:Math.round(s.jobs),real:d.jobs,src:d.src,note:d.jobsNote});}
  if(OSM&&E.heightCheck){const hc=E.heightCheck;out.osm={known:hc.known,total:hc.total,median:hc.median,n:hc.n};}
  out.rows.push({k:"Congestion level (extra travel time)",model:+E.dailyCongestion({}).toFixed(1),real:C.baseline.congestion,src:"TomTom Traffic Index 2025",unit:"%"});
  return out;
};
E.stats=function(){return {buildings:B.filter(b=>!b.kid).length,details:B.filter(b=>b.kid).length,blocks:blocks.length,trees:MESH.crown?MESH.crown.mesh.count:0,marks:E.markCount,anchors:anchors.length};};

/* ---------- game API: sites, previews, construction ---------- */
E.findSites=function(n,opts){
  opts=opts||{};if(OSM)return osmFindSites(n,opts);const r=opts.rng||Math.random;const out=[];
  const cand=blocks.filter(b=>!b.lm&&!b.vacant&&!b.used&&b.core>(opts.minCore||25)&&b.W>32&&b.Dd>32);
  for(let t=0;t<400&&out.length<n;t++){const blk=cand[Math.floor(r()*cand.length)];if(!blk)break;
    let mx=0;for(const b of B)if(b.blk===blk.id&&!b.kid&&!b.rm)mx=Math.max(mx,b.yo+b.h);
    const hm=C.base+blk.core;if(opts.underbuilt!==false&&mx>hm*.75)continue;
    out.push({x:blk.cx,z:blk.cz,a:blk.a,W:blk.W,D:blk.Dd,blk:blk.id,existingMax:mx,hm,street:E.streetNameAt(blk.cx,blk.cz),hood:E.hoodAt(blk.cx,blk.cz)});}
  return out;
};
E.blockById=id=>blocks[id];
function ghostBox(x,z,a,w,d,h,y0,mat){const m=new T.Mesh(GEOK.box,mat||MAT.ghost);m.position.set(x,y0,z);m.scale.set(w,h,d);m.rotation.y=-a;const e=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1,1,1).translate(0,.5,0)),MAT.ghostEdge);e.position.copy(m.position);e.scale.copy(m.scale);e.rotation.copy(m.rotation);previewG.add(m,e);return m;}
E.clearPreview=()=>{previewG.traverse(o=>{if(o.geometry&&o.geometry!==GEOK.box)o.geometry.dispose();});previewG.clear();for(const b of B)if(b.prevHide){b.prevHide=false;b.hid=false;}redrawAll();};
function redrawAll(){for(let i=0;i<B.length;i++)writeB(i);flush();}
E.towerSpec=function(site,h,use,glass){const W=Math.min(site.W-8,54),Dd=Math.min(site.D-8,54);return {x:site.x,z:site.z,a:site.a,w:W,d:Dd,h:Math.min(h,C.maxH||600),pod:Math.min(28,h*.12),use,glass:glass!==false,blk:site.blk};};
E.previewTower=function(s){E.clearPreview();const y=elevAt(s.x,s.z)-1;
  for(let i=0;i<B.length;i++){const b=B[i];if(b.kid||b.lm)continue;if(b.blk===s.blk){b.prevHide=true;b.hid=true;}}
  redrawAll();
  ghostBox(s.x,s.z,s.a,s.w*1.3>s.w?Math.min(s.w*1.35,(blocks[s.blk]||{W:s.w*1.35}).W-8):s.w,Math.min(s.d*1.35,(blocks[s.blk]||{Dd:s.d*1.35}).Dd-8),s.pod,y);
  ghostBox(s.x,s.z,s.a,s.w,s.d,s.h-s.pod,y+s.pod);
  return {displaced:E.totals(b=>b.blk===s.blk&&!b.lm)};
};
E.commitTower=function(s,id){
  E.clearPreview();const blk=blocks[s.blk];const removed=[];
  for(let i=0;i<B.length;i++){const b=B[i];if(b.blk===s.blk&&!b.lm&&!b.kid&&!b.rm){b.rm=true;removed.push(i);}}
  if(blk)blk.used=true;
  const pal=PAL[C.style.palette],r=rng(Math.floor(s.x*13+s.z*7));
  const colr=s.glass?pick(pal.glass,r):pick(pal.stone,r);
  const f=footprintY(s.x,s.z,s.w,s.d,s.a);
  const mk=(o)=>{const M=MESH[o.k];let inst=M.free.pop();if(inst==null){if(M.used>=M.cap)return -1;inst=M.used++;}const i=addB(Object.assign({y:f.y,g:f.g,a:s.a,blk:s.blk,c:colr},o));B[i].ad=true;B[i].inst=inst;B[i].proj=id;return i;};
  const pw=blk?Math.min(s.w*1.35,blk.W-8):s.w,pd=blk?Math.min(s.d*1.35,blk.Dd-8):s.d;
  const ids=[mk({x:s.x,z:s.z,w:pw,d:pd,h:s.pod,k:s.glass?"g":"m",u:s.use==="o"?"m":s.use}),mk({x:s.x,z:s.z,w:s.w,d:s.d,h:s.h-s.pod,yo:s.pod,k:s.glass?"g":"m",u:s.use,tw:9000+(id|0)})].filter(i=>i>=0);
  if(s.h>180&&ids.length===2){const t=B[ids[1]];const i=mk({x:s.x,z:s.z,w:s.w*.7,d:s.d*.7,h:s.h*.06,yo:s.pod+t.h,k:t.k,u:s.use,tw:t.tw});if(i>=0){ids.push(i);t.h*=.94;t.h0=t.h;}}
  for(const i of ids){B[i].full=B[i].h;}
  const crane=new T.Group();const H=s.h+30;const mast=new T.Mesh(new T.BoxGeometry(2.4,H,2.4).translate(0,H/2,0),MAT.crane);const jib=new T.Mesh(new T.BoxGeometry(60,2.2,2.2),MAT.crane);jib.position.set(18,H-2,0);const ct=new T.Mesh(new T.BoxGeometry(8,4,4),new T.MeshStandardMaterial({color:0x666666}));ct.position.set(-10,H-3,0);crane.add(mast,jib,ct);
  const ca=Math.cos(s.a),sa=Math.sin(s.a);crane.position.set(s.x+ca*(s.w/2+5),f.y,s.z+sa*(s.w/2+5));crane.rotation.y=-s.a;crane.traverse(o=>{if(o.isMesh)o.castShadow=true;});fxG.add(crane);
  const proj={id,ids,removed,crane,spec:s,before:E.totals(b=>false)};E.projects.set(id,proj);
  E.setProgress(id,0);refreshCells();recolor();
  const lbl={n:s.label||"Approved tower",h:Math.round(s.h),x:s.x,z:s.z,y:f.y+s.h+12,prop:true,id};projL.push(lbl);
  return proj;
};
E.setProgress=function(id,p){
  const pr=E.projects.get(id);if(!pr||!pr.ids)return;
  p=clamp(p,0,1);const tot=pr.ids.reduce((s,i)=>s+B[i].full,0);let rem=tot*p;
  for(const i of pr.ids){const b=B[i];const take=Math.min(b.full,rem);rem-=take;b.h=Math.max(.01,take);b.growing=p<1;}
  // re-stack tiers
  let acc=0;for(const i of pr.ids){const b=B[i];if(b.yo>0)b.yo=acc;acc=(b.yo||0)+b.h;}
  if(pr.crane){pr.crane.visible=p<1;const top=pr.ids.length?acc:0;pr.crane.children[0].scale.y=clamp((top+28)/(pr.spec.h+30),.15,1);pr.crane.children[1].position.y=top+26;pr.crane.children[2].position.y=top+25;}
  for(const i of pr.ids)writeB(i);for(const i of pr.removed)writeB(i);flush();
  if(p>=1){for(const i of pr.ids)B[i].growing=false;refreshCells();}
};
E.cancelProject=function(id){const pr=E.projects.get(id);if(!pr)return;if(pr.ids)for(const i of pr.ids){B[i].rm=true;writeB(i);}if(pr.removed)for(const i of pr.removed){B[i].rm=false;writeB(i);}if(pr.crane)fxG.remove(pr.crane);if(pr.group)fxG.remove(pr.group);projL=projL.filter(l=>l.id!==id);E.projects.delete(id);flush();refreshCells();};

/* zones: gradual redevelopment */
E.zoneCandidates=function(z){const out=[];for(let i=0;i<B.length;i++){const b=B[i];if(b.kid||b.lm||b.rm||b.ad||b.u==="x")continue;if((b.x-z.x)**2+(b.z-z.z)**2>z.r*z.r)continue;if(b.yo>0)continue;const tgt=zoneTarget(b,z);if(tgt>b.h*1.15)out.push(i);}return out;};
function zoneTarget(b,z){const hm=C.base+coreAt(b.x,z.z===undefined?b.z:b.z);if(z.kind==="office")return Math.min(b.h*1.6+20,Math.max(60,hm*1.4),C.maxH||400);if(z.kind==="housing")return Math.min(Math.max(b.h,z.stories*3.4),C.maxH||300);return b.h;}
E.previewZone=function(z){E.clearPreview();const ids=E.zoneCandidates(z);let dG=0;const pal=PAL[C.style.palette];
  const ring=new T.Mesh(new T.RingGeometry(z.r-4,z.r,96).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:z.kind==="office"?0x8b7bff:0xffb04d,transparent:true,opacity:.95,depthWrite:false}));ring.position.set(z.x,elevAt(z.x,z.z)+2,z.z);previewG.add(ring);
  for(const i of ids.slice(0,700)){const b=B[i];const t=zoneTarget(b,z);dG+=b.w*b.d*.82*Math.floor((t-b.h)/3.7);if(t>b.h)ghostBox(b.x,b.z,b.a,b.w,b.d,t-b.h,b.y+b.g+b.h);}
  void pal;return {count:ids.length,dGfa:dG};
};
E.commitZone=function(z,id){E.clearPreview();const ids=E.zoneCandidates(z);const g=new T.Group();
  const ring=new T.Mesh(new T.RingGeometry(z.r-3,z.r,96).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:z.kind==="office"?0x8b7bff:0xffb04d,transparent:true,opacity:.75,depthWrite:false}));ring.position.set(z.x,elevAt(z.x,z.z)+2,z.z);g.add(ring);fxG.add(g);
  const pr={id,zone:z,pending:ids.slice(),done:[],group:g};E.projects.set(id,pr);return pr;};
E.zoneStep=function(id,frac){
  const pr=E.projects.get(id);if(!pr||!pr.pending)return {dRes:0,dJobs:0,dUnits:0,dOffice:0,n:0};
  const n=Math.ceil(pr.pending.length*frac);const o0={res:0,jobs:0,units:0,office:0,gfa:0},o1={res:0,jobs:0,units:0,office:0,gfa:0};
  const r=rng(id*31+pr.done.length);
  for(let k=0;k<n&&pr.pending.length;k++){const j=Math.floor(r()*pr.pending.length);const i=pr.pending.splice(j,1)[0];const b=B[i];if(b.rm)continue;useStats(b,o0);
    const t=zoneTarget(b,pr.zone);b.h=t;b.u=pr.zone.kind==="office"?(b.u==="r"?"m":"o"):(b.u==="o"?"m":"r");if(t>45&&r()<.5){b.k=b.k;}useStats(b,o1);pr.done.push(i);writeB(i);
  }
  const dn=new Set(pr.done);for(let q=0;q<B.length;q++)if(B[q].kid&&dn.has(B[q].par))writeB(q);
  flush();recolor();refreshCells();
  return {dRes:o1.res-o0.res,dJobs:o1.jobs-o0.jobs,dUnits:o1.units-o0.units,dOffice:o1.office-o0.office,n};
};
/* parks */
E.previewPark=function(p){E.clearPreview();const y=elevAt(p.x,p.z);const m=new T.Mesh(new T.CircleGeometry(p.r,64).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:0x58b04e,transparent:true,opacity:.55,depthWrite:false}));m.position.set(p.x,y+1.5,p.z);previewG.add(m);
  let n=0;for(const b of B){if(b.kid||b.lm||b.rm)continue;if((b.x-p.x)**2+(b.z-p.z)**2<p.r*p.r){b.prevHide=true;b.hid=true;n++;}}redrawAll();return {displaced:E.totals(b=>!b.lm&&(b.x-p.x)**2+(b.z-p.z)**2<p.r*p.r),count:n};};
E.commitPark=function(p,id){E.clearPreview();const removed=[];for(let i=0;i<B.length;i++){const b=B[i];if(b.kid||b.lm||b.rm)continue;if((b.x-p.x)**2+(b.z-p.z)**2<p.r*p.r){b.rm=true;removed.push(i);}}
  const g=new T.Group();const pts=[];for(let k=0;k<=64;k++){const t=k/64*Math.PI*2;pts.push(new T.Vector2(Math.cos(t)*p.r,Math.sin(t)*p.r));}
  const m=new T.Mesh(new T.CircleGeometry(p.r,64).rotateX(-Math.PI/2),new T.MeshStandardMaterial({color:0x6aa356,roughness:1}));m.position.set(p.x,elevAt(p.x,p.z)+.35,p.z);m.receiveShadow=true;g.add(m);fxG.add(g);
  const r=rng(id*7);const n=Math.min(260,Math.round(Math.PI*p.r*p.r/550));for(let k=0;k<n;k++){const a=r()*6.28,rr=Math.sqrt(r())*p.r*.92;plantTree(p.x+Math.cos(a)*rr,p.z+Math.sin(a)*rr,3+r()*4.5,C.style.palm&&r()<.3);}
  redrawAll();refreshCells();const pr={id,removed,group:g};E.projects.set(id,pr);return pr;};
/* transit lines & corridors */
E.namedPaths=function(){
  if(OSM)return osmNamedPaths();
  const out=[];
  for(const r of C._roads){const L=polyLen(r.pts);if(L>1200)out.push({name:r.n,pts:r.pts,len:L,hwy:r.hwy});}
  for(const R of REG){for(const [Ls,ax] of [[R.vL,"v"],[R.uL,"u"]]){for(const l of Ls){if(!l.named||l.w<22)continue;
    let run=[],best=[];for(let s=-9000;s<=9000;s+=60){const [x,z]=ax==="v"?world(R,s,l.p):world(R,l.p,s);const ok=Math.abs(x)<EXT-50&&Math.abs(z)<EXT-50&&regionAt(x,z)===R&&clsAt(x,z)===3&&active(l,s);if(ok)run.push([x,z]);else{if(run.length>best.length)best=run;run=[];}}
    if(run.length>best.length)best=run;if(best.length*60>1500){const nm=lineName(l,0)||lineName(l,best.length?frame(R,best[0][0],best[0][1])[ax==="v"?0:1]:0);const L=best.length*60;const pts=[best[0],best[Math.floor(best.length/2)],best[best.length-1]];out.push({name:nm,pts,len:L});}}}}
  const seen=new Set();return out.filter(p=>{if(!p.name||seen.has(p.name))return false;seen.add(p.name);return true;});
};
E.pathStats=function(pts,o){const tr=o&&o.tr||E.traffic({hour:8});let s=0,n=0,res=0,jobs=0;const seen=new Set();for(const [x,z] of samplePath(pts,60)){const c=cellOf(x,z);if(seen.has(c))continue;seen.add(c);s+=tr.tti[c];n++;}
  const st=E.stations(pts,o&&o.spacing||800);const cat=E.catchment(st,o&&o.radius||800);return {tti:n?s/n:1,cells:[...seen],stations:st,res:cat.res,jobs:cat.jobs,len:polyLen(pts)};};
E.stations=function(pts,spacing){const out=[];let acc=spacing/2;for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);let t=acc;while(t<=L){out.push([lerp(a[0],b[0],t/L),lerp(a[1],b[1],t/L)]);t+=spacing;}acc=t-L;}return out;};
E.catchment=function(st,r){const o={res:0,jobs:0};const seen=new Set();for(const [x,z] of st){for(let j=0;j<CG;j++)for(let i=0;i<CG;i++){const k=j*CG+i;if(seen.has(k))continue;if((cells.x[k]-x)**2+(cells.z[k]-z)**2<r*r){seen.add(k);o.res+=cells.res[k];o.jobs+=cells.jobs[k];}}}return o;};
const LINECOL={rail:0x2e7d32,subway:0x1565c0,brt:0xd23b2e,bike:0x2e9e5b,signal:0x00b8d4,streetcar:0x8e24aa};
function lineVisual(pts,kind,g,opacity,o){
  o=o||{};const colr=o.color?new T.Color(o.color).getHex():(LINECOL[kind]||0x2266ff);const samp=samplePath(pts,25);
  if(kind==="rail"){
    for(let k=0;k<samp.length-1;k++){const [x,z,ang]=samp[k];const [x2,z2]=samp[k+1];const L=Math.hypot(x2-x,z2-z);const y=elevAt(x,z)+9;const m=new T.Mesh(GEOK.box,new T.MeshStandardMaterial({color:0xd8d8d2,transparent:opacity<1,opacity}));m.position.set((x+x2)/2,y,(z+z2)/2);m.scale.set(L,1.4,9);m.rotation.y=-ang;m.castShadow=true;g.add(m);if(k%2===0){const c=new T.Mesh(new T.CylinderGeometry(1,1.2,9,8).translate(0,4.5,0),MAT.stone);c.position.set(x,y-9,z);g.add(c);}
      const s=new T.Mesh(GEOK.box,new T.MeshBasicMaterial({color:colr,transparent:opacity<1,opacity}));s.position.set((x+x2)/2,y+1.4,(z+z2)/2);s.scale.set(L,.5,2.2);s.rotation.y=-ang;g.add(s);}
  }else{
    const wdt=kind==="brt"?7:kind==="bike"?3:kind==="subway"?4:kind==="signal"?5:3.5;
    for(let k=0;k<samp.length-1;k++){const [x,z,ang]=samp[k];const [x2,z2]=samp[k+1];const L=Math.hypot(x2-x,z2-z);const m=new T.Mesh(GEOK.box,new T.MeshBasicMaterial({color:colr,transparent:true,opacity:kind==="subway"?.55*opacity:.85*opacity,depthWrite:false}));const y=elevAt((x+x2)/2,(z+z2)/2)+.18;m.position.set((x+x2)/2,y,(z+z2)/2);m.scale.set(kind==="subway"&&k%2?L*.4:L,.12,wdt);m.rotation.y=-ang;m.renderOrder=3;g.add(m);}
  }
  if(kind!=="signal"&&kind!=="bike"){const st=o.stations?o.stations.map(q=>[q[0],q[1]]):E.stations(pts,kind==="brt"||kind==="streetcar"?600:kind==="rail"?1100:1000);for(const [x,z] of st){const y=elevAt(x,z);const h=kind==="rail"?12:kind==="subway"?4:3.5;const m=new T.Mesh(new T.BoxGeometry(kind==="rail"?70:kind==="subway"?10:24,h,kind==="rail"?14:6).translate(0,h/2,0),new T.MeshStandardMaterial({color:kind==="subway"?0x1565c0:0xe8e8e2,transparent:opacity<1,opacity}));m.position.set(x,y,z);const ang=Math.atan2(pts[pts.length-1][1]-pts[0][1],pts[pts.length-1][0]-pts[0][0]);m.rotation.y=-ang;m.castShadow=true;g.add(m);}}
}
E.previewLine=function(pts,kind,o){E.clearPreview();lineVisual(pts,kind,previewG,.75,o);};
E.commitLine=function(pts,kind,id,o){E.clearPreview();const g=new T.Group();lineVisual(pts,kind,g,1,o);g.visible=false;fxG.add(g);const pr={id,group:g,pts,kind};E.projects.set(id,pr);return pr;};
E.showProject=function(id,v){const pr=E.projects.get(id);if(pr&&pr.group)pr.group.visible=v;};
/* ================= Transit network =================
   Real rail lines and stations (OpenStreetMap route relations: subway, light rail, streetcar, monorail),
   plus planned projects and lines the mayor adds. */
const NYCCOL={"1":"#EE352E","2":"#EE352E","3":"#EE352E","4":"#00933C","5":"#00933C","6":"#00933C","7":"#B933AD","A":"#0039A6","C":"#0039A6","E":"#0039A6","B":"#FF6319","D":"#FF6319","F":"#FF6319","M":"#FF6319","G":"#6CBE45","J":"#996633","Z":"#996633","L":"#A7A9AC","N":"#FCCC0A","Q":"#FCCC0A","R":"#FCCC0A","W":"#FCCC0A","S":"#808183"};
const TRPAL=["#2e7d32","#1565c0","#c62828","#6a1b9a","#ef6c00","#00838f","#ad1457","#5d4037"];
let TR={lines:[],stations:[],cover:null},transitG=null,transitLines=null,transitOn=false;
E.transit=()=>TR;
function inMap(x,z,m){m=m||0;return Math.abs(x)<EXT-m&&Math.abs(z)<EXT-m;}
async function buildTransit(key){
  TR={lines:[],stations:[],cover:null};let raw=null;
  try{raw=await fetchGz(E.osmBase+key+"_transit.json.gz",true);}catch(e){console.warn("no transit data",e.message);}
  const best=new Map();
  for(const l of raw||[]){
    if(/safari|^ATS$|airtrain|^JFK$|^OAK$/i.test(l.ref+" "+l.name))continue;
    const base=(l.name||l.ref).split(/\s*[:→=]|\s+=>/)[0].trim();
    const ref=(l.ref||"").replace(/[<>]/g,"").replace(/ Line$/,"");const shortOK=ref&&ref.length<=8;
    const id=l.kind+"|"+(shortOK?ref:base);
    const stops=l.stops.map(s=>({x:s[0],z:s[1],n:s[2]||""}));
    if(!stops.some(s=>inMap(s.x,s.z,150)))continue;
    if(best.has(id)&&best.get(id).stops.length>=stops.length)continue;
    const kindLbl={subway:key==="chi"?"'L'":key==="sf"&&/^(Yellow|Orange|Red|Blue|Green)$/.test(ref)?"BART":"Subway",light_rail:key==="sd"?"Trolley":key==="sf"?"Muni Metro":"Light rail",tram:"Streetcar",monorail:"Monorail"}[l.kind]||l.kind;
    let name=shortOK?(/^\d+$/.test(ref)&&key==="sd"?{510:"Blue Line",520:"Orange Line",530:"Green Line"}[ref]||ref:(ref.length<=3&&key!=="sea"?ref+" "+(key==="nyc"?"train":"line"):ref)):base;
    if(key==="chi")name=ref+" Line";if(key==="sea"&&/^\d Line$/.test(l.ref))name=l.ref;
    best.set(id,{id,ref:shortOK?ref:base.slice(0,3),name,kind:l.kind,kindLbl,color:l.colour||NYCCOL[ref]||"",stops,net:l.net||l.op||""});
  }
  let i=0;for(const l of best.values()){if(!l.color)l.color=TRPAL[i%TRPAL.length];l.slot=i;i++;TR.lines.push(l);}
  // merge stops into stations
  for(const l of TR.lines)for(const s of l.stops){if(!inMap(s.x,s.z,60))continue;
    let st=TR.stations.find(t=>Math.hypot(t.x-s.x,t.z-s.z)<(t.n&&t.n===s.n?450:120));
    if(!st){st={x:s.x,z:s.z,n:s.n,lines:[]};TR.stations.push(st);}if(!st.lines.includes(l))st.lines.push(l);s.st=st;}
  for(const st of TR.stations){const w=E.catchment([[st.x,st.z]],600);st.w=w.res+w.jobs*1.3;}
  recomputeCover();drawTransit();
}
function recomputeCover(){
  const cov=new Uint8Array(CG*CG),pts=TR.stations.concat(TR.added||[]);
  for(const s of pts)for(let k=0;k<CG*CG;k++)if(!cov[k]&&(cells.x[k]-s.x)**2+(cells.z[k]-s.z)**2<800*800)cov[k]=1;
  TR.cover=cov;
}
E.transitCover=()=>TR.cover;
function hexCol(h){return new T.Color(h);}
function drawTransit(){
  if(transitG){scene.remove(transitG);transitG.traverse(o=>{if(o.geometry&&o.geometry!==GEOK.box&&o.geometry!==GEOK.cyl)o.geometry.dispose();});}
  transitG=new T.Group();scene.add(transitG);transitLines=new T.Group();transitLines.visible=transitOn;transitG.add(transitLines);
  if(!GEOK.cyl)GEOK.cyl=new T.CylinderGeometry(1,1,1,16);
  // line ribbons: straight runs between consecutive stops (schematic, like a transit map laid on the city)
  const mo=new T.Matrix4(),q=new T.Quaternion(),sc=new T.Vector3(),ps=new T.Vector3(),up=new T.Vector3(0,1,0);
  for(const l of TR.lines){
    const segs=[];for(let k=0;k<l.stops.length-1;k++){const a=l.stops[k],b=l.stops[k+1];if(!inMap(a.x,a.z,-1500)&&!inMap(b.x,b.z,-1500))continue;if(Math.hypot(b.x-a.x,b.z-a.z)>6000)continue;segs.push([a,b]);}
    if(!segs.length)continue;
    const im=new T.InstancedMesh(GEOK.box,new T.MeshBasicMaterial({color:hexCol(l.color),transparent:true,opacity:.92,depthWrite:false}),segs.length);
    const off=((l.slot%5)-2)*(transitOn?14:7);
    segs.forEach(([a,b],k)=>{const dx=b.x-a.x,dz=b.z-a.z,L=Math.hypot(dx,dz)||1,ang=Math.atan2(dz,dx);const nx=-dz/L*off,nz=dx/L*off;
      const mx=(a.x+b.x)/2+nx,mz=(a.z+b.z)/2+nz;const y=Math.max(elevAt(a.x,a.z),elevAt(b.x,b.z),0)+14+(l.slot%5)*.3;
      q.setFromAxisAngle(up,-ang);ps.set(mx,y,mz);sc.set(L,1.2,(l.kind==="tram"?5:8)*(transitOn?2:1));mo.compose(ps,q,sc);im.setMatrixAt(k,mo);});
    im.renderOrder=3;transitLines.add(im);
  }
  // stations: white drum with a ring in the colour of the first line
  for(const st of TR.stations){const y=Math.max(0,elevAt(st.x,st.z));const big=st.lines.length>2;
    const m=new T.Mesh(GEOK.cyl,new T.MeshStandardMaterial({color:0xffffff,roughness:.5}));m.position.set(st.x,y+(transitOn?16:4),st.z);m.scale.set(big?16:11,transitOn?4:8,big?16:11);m.userData.st=st;transitG.add(m);
    const r=new T.Mesh(GEOK.cyl,new T.MeshBasicMaterial({color:hexCol(st.lines[0].color)}));r.position.set(st.x,y+(transitOn?18.2:8.2),st.z);r.scale.set(big?11:7,.6,big?11:7);transitG.add(r);}
  for(const s of TR.added||[]){const y=Math.max(0,elevAt(s.x,s.z));const m=new T.Mesh(GEOK.cyl,new T.MeshStandardMaterial({color:0xffffff}));m.position.set(s.x,y+(transitOn?16:4),s.z);m.scale.set(12,transitOn?4:8,12);transitG.add(m);const r=new T.Mesh(GEOK.cyl,new T.MeshBasicMaterial({color:hexCol(s.color||"#1565c0")}));r.position.set(s.x,y+(transitOn?18.2:8.2),s.z);r.scale.set(8,.6,8);transitG.add(r);}
}
// smooth zoom toward the view centre (buttons and +/- keys)
let zoomAnim=null;
E.zoomBy=function(f){const t=controls.target,cp=camera.position;const d0=cp.distanceTo(t);const d1=clamp((zoomAnim?zoomAnim.d1:d0)*f,controls.minDistance,controls.maxDistance);
  const st=performance.now(),from=d0;if(zoomAnim)cancelAnimationFrame(zoomAnim.raf);zoomAnim={d1};
  const step=now=>{const u=Math.min(1,(now-st)/260),e=1-Math.pow(1-u,3);const d=from+(d1-from)*e;const cur=cp.distanceTo(t);cp.sub(t).multiplyScalar(d/cur).add(t);controls.update();if(u<1)zoomAnim.raf=requestAnimationFrame(step);else zoomAnim=null;};
  zoomAnim.raf=requestAnimationFrame(step);};
E.setTransitView=function(on){transitOn=!!on;drawTransit();};
E.transitLabels=()=>transitOn?TR.stations.concat(TR.added||[]):[];
// catchment split between places already near rail and places that are not
E.newCatch=function(st,r){r=r||800;const o={res:0,jobs:0,resC:0,jobsC:0};const seen=new Set();const cov=TR.cover;
  for(const [x,z] of st){if(!inMap(x,z))continue;for(let k=0;k<CG*CG;k++){if(seen.has(k))continue;if((cells.x[k]-x)**2+(cells.z[k]-z)**2<r*r){seen.add(k);if(cov&&cov[k]){o.resC+=cells.res[k];o.jobsC+=cells.jobs[k];}else{o.res+=cells.res[k];o.jobs+=cells.jobs[k];}}}}return o;};
E.stationName=function(x,z){const s=E.streetNameAt(x,z);return s?s.replace(/ (Street|Avenue|Boulevard|Way|Drive|Place|Road)( (North|South|East|West))?$/,(m,a,b)=>" "+({Street:"St",Avenue:"Ave",Boulevard:"Blvd",Way:"Way",Drive:"Dr",Place:"Pl",Road:"Rd"}[a])+(b?" "+b[0]:"")):E.hoodAt(x,z);};
// best extension of a line from one of its ends toward dense places without rail
E.extensionFor=function(lineId){
  const l=TR.lines.find(x=>x.id===lineId);if(!l)return null;let best=null;
  for(const end of [0,1]){const s=end?l.stops[l.stops.length-1]:l.stops[0];const n=end?l.stops[l.stops.length-2]:l.stops[1];
    if(!inMap(s.x,s.z,-800))continue;const ha=Math.atan2(s.z-n.z,s.x-n.x);
    for(let a=-1.2;a<=1.21;a+=.3)for(const L of [1800,2700,3600]){const ang=ha+a;const ex=s.x+Math.cos(ang)*L,ez=s.z+Math.sin(ang)*L;if(!inMap(ex,ez,200))continue;
      const sts=[];let wet=0;for(let d=900;d<=L+1;d+=900){const x=s.x+Math.cos(ang)*d,z=s.z+Math.sin(ang)*d;if(!E.clsAt(x,z))wet++;sts.push([x,z]);}
      if(wet>0)continue;const c=E.newCatch(sts,800);const sc=(c.res+c.jobs*1.3+.3*(c.resC+c.jobsC))/Math.pow(L/1000,.8);
      if(!best||sc>best.sc)best={sc,pts:[[s.x,s.z],[ex,ez]],stations:sts.map(([x,z])=>[x,z,E.stationName(x,z)]),from:s.n,km:L/1000,line:l};}}
  return best;};
E.lineById=id=>TR.lines.find(l=>l.id===id);
E.lineWeight=function(l){let w=0;for(const s of l.stops)if(s.st)w+=s.st.w/s.st.lines.length;return w;};
E.totalStationWeight=()=>TR.stations.reduce((a,s)=>a+s.w,0);
E.addToNetwork=function(stations,color){TR.added=TR.added||[];for(const [x,z,n] of stations)if(inMap(x,z,60)&&!TR.stations.concat(TR.added).some(t=>Math.hypot(t.x-x,t.z-z)<200))TR.added.push({x,z,n,color,lines:[{color:color||"#1565c0"}]});recomputeCover();drawTransit();};
E.flyToLine=function(id){const l=E.lineById(id);if(!l)return;const s=l.stops.filter(s=>inMap(s.x,s.z));if(!s.length)return;let x=0,z=0;for(const p of s){x+=p.x;z+=p.z;}E.flyTo(x/s.length,z/s.length,2600);};
E.ll=ll=>P(ll);


/* overlays */
let OVV=null,OVR=null;
E.setOverlay=function(values,ramp,opts){
  if(values&&opts&&opts.rank){const idx=[];for(let k=0;k<values.length;k++)if(!isNaN(values[k])&&cells.land[k]>=.05)idx.push(k);idx.sort((p,q)=>values[p]-values[q]);const out=new Float32Array(values.length).fill(NaN);idx.forEach((k,i)=>out[k]=Math.pow(i/Math.max(1,idx.length-1),1.3)*(opts.scale||1));values=out;}
  OVV=values?Float32Array.from(values):null;OVR=ramp||null;
  if(!values){overlayMesh.visible=false;if(B.length)recolor();return;}
  const ctx=overlayCanvas.getContext("2d"),img=ctx.createImageData(CG,CG);
  for(let k=0;k<CG*CG;k++){const v=values[k];if(v==null||isNaN(v)||cells.land[k]<.05){img.data[k*4+3]=0;continue;}const c=ramp(clamp(v,0,1));img.data[k*4]=c[0];img.data[k*4+1]=c[1];img.data[k*4+2]=c[2];img.data[k*4+3]=Math.round(255*(c[3]==null?.9:c[3])*Math.min(1,cells.land[k]*1.6));}
  ctx.putImageData(img,0,0);overlayTex.needsUpdate=true;overlayMesh.visible=true;recolor();
};

/* ---------- environment ---------- */
let ENV={hour:10,month:9,wx:"clear",flood:0};
const WXC={clear:{dim:1,fog:[7000,24000]},rain:{dim:.55,fog:[3000,11000]},storm:{dim:.35,fog:[1500,6500]},snow:{dim:.5,fog:[1500,6000]},fog:{dim:.5,fog:[350,3000]},smoke:{dim:.55,fog:[900,5500],tint:0xd6a46c}};
E.setEnv=function(o){Object.assign(ENV,o);applyEnv();};
E.env=()=>ENV;
function sunDir(){const doy=[15,46,74,105,135,166,196,227,258,288,319,349][ENV.month];const dec=23.44*D*Math.sin(2*Math.PI*(284+doy)/365),lat=LAT0*D,H=(ENV.hour-12.3)*15*D;
  const el=Math.asin(Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(H));const az=Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(lat)-Math.tan(dec)*Math.cos(lat));
  return {el,v:new T.Vector3(-Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el))};}
E.sun=()=>sunDir();
function applyEnv(){
  if(!renderer)return;const s=sunDir(),W=WXC[ENV.wx]||WXC.clear,el=s.el/D;
  const day=clamp((el+4)/14,0,1),dusk=clamp(1-Math.abs(el-3)/9,0,1)*(el>-7?1:0),night=1-day;
  const hor=new T.Color(0x0e1624).lerp(new T.Color(W.dim<.6?0xb8c1ca:0xdbe7f1),day).lerp(new T.Color(0xf0b88d),dusk*.55*W.dim);
  const top=new T.Color(0x060b14).lerp(new T.Color(W.dim<.6?0x8f9aa6:0x5b8fd3),day);
  if(W.tint){hor.lerp(new T.Color(W.tint),.5);top.lerp(new T.Color(W.tint),.35);}
  skyMesh.material.uniforms.hor.value.copy(hor);skyMesh.material.uniforms.top.value.copy(top);skyMesh.material.uniforms.sunDir.value.copy(s.v);skyMesh.material.uniforms.sunCol.value.setRGB(W.dim,W.dim*.95,W.dim*.85).multiplyScalar(day);
  scene.fog.color.copy(hor);scene.fog.near=W.fog[0]*Math.max(1,EXT/5000);scene.fog.far=W.fog[1]*Math.max(1,EXT/5000);
  const d=s.v.clone();if(d.y<.1)d.y=.1;d.normalize();E._sunV=d;
  sun.intensity=(2.5*day*W.dim)+.08;sun.color.set(el<8?0xffc9a0:0xfff4e6);if(day<.05)sun.color.set(0x8fa6d6);
  hemi.intensity=.22+.55*day*(.6+.4*W.dim);renderer.toneMappingExposure=.82+.28*day;
  U.uNight.value=clamp(night*1.15,0,1)*(VIEW==="real"?1:VIEW==="clay"?.5:0);E.updateGlow(clamp(night*1.2,0,1));
  {const u=water.material.uniforms;u.sunDir.value.copy(s.v);u.sunCol.value.setRGB(W.dim,W.dim*.93,W.dim*.82).multiplyScalar(day);u.skyTop.value.copy(top).convertSRGBToLinear();u.skyHor.value.copy(hor).convertSRGBToLinear();u.haze.value.copy(hor);u.night.value=night;
   u.deep.value.set(W.dim<.6?0x2a4652:0x1e4a63).convertSRGBToLinear();u.shallow.value.set(W.dim<.6?0x58767a:0x4d8088).convertSRGBToLinear();if(E._hazeMat)E._hazeMat.uniforms.haze.value.copy(hor);}
  MAT.crown.color.setRGB(1-night*.6,1-night*.6,1-night*.6);
  rain.visible=ENV.wx==="rain"||ENV.wx==="storm";rain.material.opacity=ENV.wx==="storm"?.6:.4;snow.visible=ENV.wx==="snow";
  floodMesh.visible=ENV.flood>0;floodMesh.position.y=ENV.flood;
  if(B.length){let ch=false;for(const b of B){if(b.kid)continue;const f=ENV.flood>0&&b.y+b.g<ENV.flood+.8;if(f!==!!b.flood){b.flood=f;ch=true;}}if(ch)recolor();}
}
E.floodExposure=function(level){const o={res:0,jobs:0,units:0,office:0,gfa:0};for(const b of B){if(b.rm||b.kid)continue;if(b.y+b.g<level+.8)useStats(b,o);}return o;};
let rain,snow;const RN=6000,SN=5000;
function initWeather(){
  const rg=new T.BufferGeometry(),rp=new Float32Array(RN*6);const r=rng(5);for(let i=0;i<RN;i++){const x=(r()-.5)*2400,y=r()*1100,z=(r()-.5)*2400;rp.set([x,y,z,x-3,y-24,z],i*6);}rg.setAttribute("position",new T.BufferAttribute(rp,3));
  rain=new T.LineSegments(rg,new T.LineBasicMaterial({color:0xaabbd0,transparent:true,opacity:.45}));rain.frustumCulled=false;rain.visible=false;scene.add(rain);
  const sg=new T.BufferGeometry(),sp=new Float32Array(SN*3);for(let i=0;i<SN;i++)sp.set([(r()-.5)*2400,r()*1100,(r()-.5)*2400],i*3);sg.setAttribute("position",new T.BufferAttribute(sp,3));
  snow=new T.Points(sg,new T.PointsMaterial({color:0xffffff,size:4,transparent:true,opacity:.9}));snow.frustumCulled=false;snow.visible=false;scene.add(snow);
}

/* ---------- input / navigation ---------- */
const ray=new T.Raycaster(),ndc=new T.Vector2();
E.groundPoint=function(cx,cy){const r=canvasEl.getBoundingClientRect();ndc.set((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);
  const o=ray.ray.origin,d=ray.ray.direction;if(d.y>-1e-4)return null;let y=0,p=null;for(let k=0;k<5;k++){const t=(y-o.y)/d.y;if(t<0)return null;const x=o.x+d.x*t,z=o.z+d.z*t;p=[x,z];y=elevV?Math.max(0,elevAt(clamp(x,-EXT,EXT),clamp(z,-EXT,EXT))):0;}
  return {x:p[0],z:p[1],y};};
const keys=new Set();let flyAnim=null;
function bindInput(){
  window.addEventListener("wheel",e=>{if(e.target!==canvasEl)return;e.preventDefault();e.stopPropagation();
    const p=E.groundPoint(e.clientX,e.clientY);const t=controls.target,cp=camera.position;const dist=cp.distanceTo(t);
    const f=Math.exp(clamp(e.deltaY,-120,120)*.0016);const nd=clamp(dist*f,controls.minDistance,controls.maxDistance);const k=nd/dist;
    if(p){const pv=new T.Vector3(p.x,p.y,p.z);cp.sub(pv).multiplyScalar(k).add(pv);t.sub(pv).multiplyScalar(k).add(pv);t.y=0;}else{cp.sub(t).multiplyScalar(k).add(t);}
    controls.update();},{capture:true,passive:false});
  window.addEventListener("keydown",e=>{if(/INPUT|SELECT|TEXTAREA/.test(document.activeElement&&document.activeElement.tagName))return;
    if(e.key==="+"||e.key==="="){E.zoomBy(.6);e.preventDefault();return;}if(e.key==="-"||e.key==="_"){E.zoomBy(1/.6);e.preventDefault();return;}
    keys.add(e.key.toLowerCase());});
  window.addEventListener("keyup",e=>keys.delete(e.key.toLowerCase()));
}
E.flyTo=function(x,z,dist,tilt){const t0=controls.target.clone(),c0=camera.position.clone();const off=c0.clone().sub(t0);const cur=off.length();const nd=dist||Math.min(cur,1800);off.normalize();
  if(tilt){const az=Math.atan2(off.x,off.z);off.set(Math.sin(az)*Math.cos(tilt),Math.sin(tilt),Math.cos(az)*Math.cos(tilt));}
  const t1=new T.Vector3(x,0,z),c1=t1.clone().add(off.multiplyScalar(nd));flyAnim={t0,c0,t1,c1,s:performance.now(),d:1100};};
E.camInfo=()=>({x:controls.target.x,z:controls.target.z,dist:camera.position.distanceTo(controls.target),cam:camera});
function navKeys(dt){
  if(!keys.size)return;const d=camera.position.distanceTo(controls.target);const sp=d*.9*dt;
  const f=new T.Vector3();camera.getWorldDirection(f);f.y=0;f.normalize();const rt=new T.Vector3(-f.z,0,f.x);const mv=new T.Vector3();
  if(keys.has("w")||keys.has("arrowup"))mv.add(f);if(keys.has("s")||keys.has("arrowdown"))mv.sub(f);if(keys.has("d")||keys.has("arrowright"))mv.add(rt);if(keys.has("a")||keys.has("arrowleft"))mv.sub(rt);
  if(mv.lengthSq()){mv.normalize().multiplyScalar(sp);controls.target.add(mv);camera.position.add(mv);}
  if(keys.has("q")||keys.has("e")){const ang=(keys.has("q")?1:-1)*dt*1.1;const o=camera.position.clone().sub(controls.target);o.applyAxisAngle(YV,ang);camera.position.copy(controls.target).add(o);}
}
E.drawMinimap=function(cv){if(!miniImg)return;const g=cv.getContext("2d"),W=cv.width,H=cv.height;g.clearRect(0,0,W,H);g.fillStyle="#2f5f7d";g.fillRect(0,0,W,H);g.drawImage(miniImg,0,0,W,H);
  const pts=[];for(const [sx,sy] of [[0,0],[1,0],[1,1],[0,1]]){const r=canvasEl.getBoundingClientRect();const p=E.groundPoint(r.left+sx*r.width,r.top+(sy?r.height:r.height*.08));if(p)pts.push(p);}
  g.strokeStyle="#fff";g.lineWidth=1.5;g.fillStyle="rgba(255,255,255,.18)";if(pts.length>2){g.beginPath();pts.forEach((p,k)=>{const x=(clamp(p.x,-EXT*1.5,EXT*1.5)+EXT)/(2*EXT)*W,y=(clamp(p.z,-EXT*1.5,EXT*1.5)+EXT)/(2*EXT)*H;k?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();g.fill();g.stroke();}
  const t=controls.target;g.fillStyle="#ffcf3f";g.beginPath();g.arc((t.x+EXT)/(2*EXT)*W,(t.z+EXT)/(2*EXT)*H,3,0,7);g.fill();};
E.minimapClick=function(fx,fy){E.flyTo(-EXT+fx*2*EXT,-EXT+fy*2*EXT,null);};

/* ---------- labels ---------- */
let labelBox=null,lblPool=[],lastLbl=0,shownPrev=new Set(),shownNow=new Set();const pv=new T.Vector3(),pv2=new T.Vector3();
E.setLabelLayer=el=>{labelBox=el;};
E.labelsOn={street:true,hood:true,lm:true};
// every frame: move the chosen labels with the map (no re-selection, so nothing jumps)
function trackLabels(){
  if(!labelBox||!E.ready)return;const W=canvasEl.clientWidth,H=canvasEl.clientHeight;
  for(const el of lblPool){if(!el._P)continue;pv.set(el._P[0],el._P[1],el._P[2]).project(camera);
    if(pv.z>1||pv.x<-1.1||pv.x>1.1||pv.y<-1.1||pv.y>1.1){el.style.display="none";continue;}
    const x=(pv.x+1)/2*W,y=(1-pv.y)/2*H;let rot=el._rot;
    if(el._D){pv2.set(el._P[0]+el._D[0]*30,el._P[1],el._P[2]+el._D[1]*30).project(camera);rot=Math.atan2((1-pv2.y)/2*H-y,(pv2.x+1)/2*W-x)*180/Math.PI;if(rot>90)rot-=180;if(rot<-90)rot+=180;}
    el.style.display="block";el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) rotate(${rot.toFixed(1)}deg)`;}
}
let lblCam="",lblMoveT=0;
const esc0=t=>String(t).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[c]);
function placeLabels(){
  if(!labelBox||!E.ready)return;const W=canvasEl.clientWidth,H=canvasEl.clientHeight;const dist=camera.position.distanceTo(controls.target);
  const used=[];let n=0;const want=[];
  const collide=(x,y,w,h)=>{for(const r of used)if(x<r[0]+r[2]&&x+w>r[0]&&y<r[1]+r[3]&&y+h>r[1])return true;used.push([x,y,w,h]);return false;};
  const proj=(x,y,z)=>{pv.set(x,y,z).project(camera);if(pv.z>1||pv.x<-1.05||pv.x>1.05||pv.y<-1.05||pv.y>1.05)return null;return [(pv.x+1)/2*W,(1-pv.y)/2*H];};
  for(const L of projL){const p=proj(L.x,L.y,L.z);if(p)want.push({cls:"lbl prop",html:`${L.n}<small>${L.h} m</small>`,x:p[0],y:p[1],rot:0,pri:0,P:[L.x,L.y,L.z]});}
  if(E.labelsOn.lm&&dist<6500)for(const L of lmL){const p=proj(L.x,L.y,L.z);if(p)want.push({cls:"lbl lm",html:`${L.n}<small>${L.h} m</small>`,x:p[0],y:p[1],rot:0,pri:1,P:[L.x,L.y,L.z]});}
  if(dist<9000)for(const L of E.transitLabels()){const p=proj(L.x,Math.max(0,elevAt(L.x,L.z))+22,L.z);if(p)want.push({cls:"lbl stn",html:esc0(L.n||"Station"),x:p[0],y:p[1],rot:0,pri:1.5+(L.lines&&L.lines.length>2?-.2:0),P:[L.x,Math.max(0,elevAt(L.x,L.z))+22,L.z]});}
  if(E.labelsOn.hood&&dist>500&&dist<11000)for(const L of hoodL){const p=proj(L.x,L.y+Math.min(dist*.04,200),L.z);if(p)want.push({cls:"lbl hood",html:L.n,x:p[0],y:p[1],rot:0,pri:2,P:[L.x,L.y+Math.min(dist*.04,200),L.z]});}
  if(E.labelsOn.street&&dist<1800)for(const L of schoolL){const y=elevAt(L.x,L.z)+4;const p=proj(L.x,y,L.z);if(p)want.push({cls:"lbl school",html:esc0(L.n),x:p[0],y:p[1],rot:0,pri:2.6-Math.min(.4,L.A/2e5),P:[L.x,y,L.z]});}
  if(E.labelsOn.street&&dist<2600){
    const t=controls.target,R=dist*1.4;const bx0=Math.floor((t.x-R+EXT)/500),bx1=Math.floor((t.x+R+EXT)/500),bz0=Math.floor((t.z-R+EXT)/500),bz1=Math.floor((t.z+R+EXT)/500);
    const cand=[];for(let i=bx0;i<=bx1;i++)for(let j=bz0;j<=bz1;j++){const arr=anchorGrid.get(i+","+j);if(arr)for(const a of arr)cand.push(a);}
    const seenName=new Map();cand.sort((u,v)=>(shownPrev.has(v)?1:0)-(shownPrev.has(u)?1:0));
    for(const a of cand){const p=proj(a.x,a.y,a.z);if(!p)continue;pv2.set(a.x+a.dir[0]*30,a.y,a.z+a.dir[1]*30).project(camera);const q=[(pv2.x+1)/2*W,(1-pv2.y)/2*H];let ang=Math.atan2(q[1]-p[1],q[0]-p[0])*180/Math.PI;if(ang>90)ang-=180;if(ang<-90)ang+=180;
      const prevP=seenName.get(a.name);if(prevP&&(prevP.length>=2||prevP.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<W*.35)))continue;seenName.set(a.name,(prevP||[]).concat([p]));
      if(!a.h)a.h=((a.x*73.1+a.z*19.7)%1+1)%1;want.push({cls:"lbl st"+(a.major?" major":""),html:a.name,x:p[0],y:p[1],rot:ang,pri:3+(shownPrev.has(a)?-1:0)+(a.major?-.3:0)+a.h*.2,len:a.name.length,ref:a,P:[a.x,a.y,a.z],D:a.dir});}
  }
  want.sort((a,b)=>a.pri-b.pri);
  for(const w of want){if(n>=90)break;const wd=w.len?w.len*6.2+10:(w.html.length*5+20),ht=w.len?14:18;const rad=Math.abs(w.rot||0)*Math.PI/180;const bw=Math.abs(wd*Math.cos(rad))+ht*Math.sin(rad),bh=Math.abs(wd*Math.sin(rad))+ht;
    if(collide(w.x-bw/2,w.y-bh/2,bw,bh))continue;if(w.ref)shownNow.add(w.ref);let el=lblPool[n];if(!el){el=document.createElement("div");labelBox.appendChild(el);lblPool.push(el);}
    if(el._h!==w.html){el.innerHTML=w.html;el._h=w.html;}if(el.className!==w.cls)el.className=w.cls;el.style.display="block";
    el._P=w.P;el._D=w.D||null;el._rot=w.rot||0;
    el.style.transform=`translate(${w.x.toFixed(1)}px,${w.y.toFixed(1)}px) translate(-50%,-50%) rotate(${(w.rot||0).toFixed(1)}deg)`;n++;}
  for(let k=n;k<lblPool.length;k++){lblPool[k].style.display="none";lblPool[k]._P=null;}
  shownPrev=shownNow;shownNow=new Set();
}

/* ================= OpenStreetMap mode =================
   When osm/<city>_*.gz files are published beside the page, real building footprints, heights,
   roads (with lanes), parks, water and rail replace the generated city. */
let OSM=null; E.osmMode=false; E.osmBase="data/osm/";
async function fetchGz(url,json){
  // data files are gzip, shipped base64-encoded as .txt (artifact hosting serves text, not binary)
  const r=await fetch(url.replace(/\.gz$/,".txt"));if(!r.ok)throw new Error(url+" → "+r.status);
  if(typeof DecompressionStream==="undefined")throw new Error("browser lacks DecompressionStream");
  const bin=atob((await r.text()).trim());const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  const buf=await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  return json?JSON.parse(new TextDecoder().decode(buf)):buf;
}
async function loadOSM(key){
  if(E.osmDisabled||typeof fetch==="undefined")return null;
  try{const b=E.osmBase+key;const [bb,rd,ar,tr]=await Promise.all([fetchGz(b+"_buildings.bin.gz",false),fetchGz(b+"_roads.json.gz",true),fetchGz(b+"_areas.json.gz",true),fetchGz(b+"_trees.bin.gz",false).catch(()=>null)]);const o=parseOSM(bb,rd,ar);
    if(tr){const dv=new Int16Array(tr);o.trees=[];for(let i=0;i<dv.length;i+=2)o.trees.push([dv[i]*OQ,dv[i+1]*OQ]);}return o;}
  catch(e){console.warn("OSM data unavailable, using the generated city:",e.message);return null;}
}
E.parseOSM=(bb,rd,ar)=>parseOSM(bb,rd,ar);
let OQ=0.25;
function ptsFrom(a){const p=[];for(let i=0;i<a.length;i+=2)p.push([a[i]*OQ,a[i+1]*OQ]);return p;}
function parseOSM(bb,rd,ar){
  const dv=new DataView(bb);if(dv.getUint32(0,true)!==0x31424c47)throw new Error("bad buildings file");
  const n=dv.getUint32(4,true);let o=8;const bl=new Array(n);
  for(let i=0;i<n;i++){const nv=dv.getUint16(o,true),hd=dv.getUint16(o+2,true),mh=dv.getUint16(o+4,true),lv=dv.getUint8(o+6),ty=dv.getUint8(o+7),part=dv.getUint8(o+8);o+=10;
    const pts=new Float32Array(nv*2);for(let k=0;k<nv*2;k++){pts[k]=dv.getInt16(o,true)*OQ;o+=2;}
    bl[i]={pts,h:hd/10,mh:mh/10,lv,ty,part};}
  const roads=rd.ways.map(w=>({ty:w[0],lanes:w[1],fl:w[2],layer:(w[2]>>4)&7,floating:!!(w[2]&8),n:rd.names[w[3]]||"",pts:ptsFrom(w[4])})).filter(r=>r.pts.length>1);
  return {bl,roads,paths:(ar.paths||[]).map(p=>({k:p[0],fl:p[1],pts:ptsFrom(p[2])})).filter(p=>p.pts.length>1),rail2:ar.rail2?ar.rail2.map(p=>({k:p[0],tunnel:p[1],bridge:p[2],layer:p[3],svc:p[4],pts:ptsFrom(p[5])})).filter(p=>p.pts.length>1):null,sports:(ar.sports||[]).map(p=>({k:p[0],sport:p[1],surf:p[2],pts:ptsFrom(p[3])})),tracks:(ar.tracks||[]).map(p=>({area:p[0],pts:ptsFrom(p[2])})),schools:(ar.schools||[]).map(p=>({n:p[0],k:p[1],pts:ptsFrom(p[2])})),parks:(ar.parks||[]).map(p=>({k:p[0],pts:ptsFrom(p[1])})),water:(ar.water||[]).map(p=>({k:p[0],pts:ptsFrom(p[1])})),coast:(ar.coast||[]).map(ptsFrom),islands:(ar.islands||[]).map(p=>({k:p[0],pts:ptsFrom(p[1])})),rail:(ar.rail||[]).map(r=>({k:r[0],tunnel:r[1],pts:ptsFrom(r[2])}))};
}
const RT_LANES=[3,2,2,2,2,2,1,1,1,1];
function roadW(r){const L=r.lanes||RT_LANES[r.ty]||2;let w=L*3.3;if(r.ty>=2&&r.ty<=5)w+=3.5;if(r.ty===6)w=Math.max(4.5,w*.8);if(r.ty===7)w=6;return w;}
const isHwy=r=>r.ty===0||r.ty===1||r.ty===8;
const drivable=r=>r.ty<=6&&r.ty!==7&&!(r.fl&4);
function drawPolyF(ctx,p){ctx.beginPath();for(let k=0;k<p.length;k+=2){const x=(p[k]+EXT)/PX,y=(p[k+1]+EXT)/PX;k?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();}

/* facade material for merged real footprints (normals from screen derivatives, per-vertex window data) */
function osmMat(){
  const m=new T.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:.06,flatShading:true});
  m.onBeforeCompile=s=>{
    s.uniforms.uNight=U.uNight;s.uniforms.uWin=U.uWin;
    s.vertexShader=s.vertexShader.replace("#include <common>","#include <common>\nattribute vec4 aFac;varying vec4 vFac;").replace("#include <begin_vertex>","#include <begin_vertex>\nvFac=aFac;");
    s.fragmentShader=s.fragmentShader.replace("#include <common>","#include <common>\nvarying vec4 vFac;uniform float uNight;uniform float uWin;\nfloat hsh(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}")
     .replace("#include <color_fragment>",`#include <color_fragment>
vec3 gFdx=dFdx(vViewPosition),gFdy=dFdy(vViewPosition);vec3 nv=normalize(cross(gFdx,gFdy));vec3 upv=normalize((viewMatrix*vec4(0.,1.,0.,0.)).xyz);
float wallF=1.0-step(0.6,abs(dot(nv,upv)));float uGlass=vFac.w;float vH=vFac.z;float vSeed=fract(vFac.z*0.6180339);
float fl=vFac.y; float fh=mix(3.6,4.0,uGlass); float fy=fract(fl/fh); float fid=floor(fl/fh);
float ho=vFac.x; float bay=mix(3.1,1.6,uGlass)*(0.85+0.35*vSeed); float bx=fract(ho/bay); float bid=floor(ho/bay);
float win=step(mix(0.3,0.08,uGlass),fy)*step(fy,mix(0.82,0.97,uGlass))*step(mix(0.22,0.05,uGlass),bx)*step(bx,mix(0.78,0.95,uGlass));
float gfl=1.0-step(4.6,fl); win=mix(win,step(0.08,bx)*step(bx,0.92)*step(0.4,fl)*step(fl,3.9),gfl*(1.0-uGlass));
win*=1.0-step(vH-1.1,fl); win*=step(2.5,vH); win*=wallF;
vec3 wc=mix(vec3(0.17,0.2,0.25),vec3(0.38,0.48,0.58),uGlass)*(0.78+0.5*hsh(vec3(bid,fid,vSeed)));
diffuseColor.rgb=mix(diffuseColor.rgb,wc,win*uWin*mix(0.88,0.6,uGlass));
diffuseColor.rgb*=mix(1.0,0.82,1.0-wallF);
diffuseColor.rgb*=mix(0.7,1.0,smoothstep(0.0,9.0,fl));
float lit=step(0.7,hsh(vec3(bid*1.7,fid*2.3,vSeed*91.0)))*(0.55+0.45*hsh(vec3(fid,bid,3.1)));`)
     .replace("#include <emissivemap_fragment>","#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.0,0.78,0.48)*win*lit*uNight*uWin*0.85;diffuseColor.rgb*=1.0-0.55*uNight*wallF;");
  };
  m.customProgramCacheKey=()=>"osmfac";
  return m;
}

/* height estimate for buildings OSM has no height for */
function estimateH(ty,A,core,r){
  if(ty===7)return 3+r()*1.5;
  if(ty===4)return 6+r()*8;
  if(ty===5)return 9+r()*14;
  if(ty===1&&A<230)return 6+r()*4;
  const hm=C.base+core*.5;let h=hm*(.45+.9*r());
  if(ty===1)h=Math.min(h,Math.max(14,hm*1.1));
  return clamp(h,4,Math.max(18,hm*1.5));
}
const TY_USE=["?","r","o","m","i","c","o","x","x"];
let OCH=[];E.heightCheck=null;
const S_KEY_GABLE=()=>({sea:.9,nyc:.35,sf:.5,chi:.6,sd:.4})[E.key]||.5;
function genOSM(){
  C._centers=C.centers.map(c=>{const p=P([c[0],c[1]]);return [p[0],p[1],c[2],c[3]];});
  C._ind=(C.industrial||[]).map(q=>{const p=P(q.ll);return [p[0],p[1],q.r];});
  C._lms=C.landmarks.map(l=>{const p=P(l.ll);return [p[0],p[1],Math.max(l.w,l.d||0)*0.75+18];});
  const r=cityRng,st=C.style,pal=PAL[st.palette];E.trees=[];E.pads=[];
  const errs=[];let known=0,total=0;
  for(const ob of OSM.bl){
    const p=ob.pts,n=p.length/2;let A=0,cx=0,cz=0;
    for(let k=0;k<n;k++){const j=(k+1)%n;const cr=p[k*2]*p[j*2+1]-p[j*2]*p[k*2+1];A+=cr;cx+=(p[k*2]+p[j*2])*cr;cz+=(p[k*2+1]+p[j*2+1])*cr;}
    A/=2;if(Math.abs(A)<1)continue;cx/=(6*A);cz/=(6*A);
    if(Math.abs(cx)>EXT-15||Math.abs(cz)>EXT-15)continue;
    total++;
    // dominant orientation from the longest edge
    let best=0,a=0;for(let k=0;k<n;k++){const j=(k+1)%n;const dx=p[j*2]-p[k*2],dz=p[j*2+1]-p[k*2+1],L=dx*dx+dz*dz;if(L>best){best=L;a=Math.atan2(dz,dx);}}
    const ca=Math.cos(a),sa=Math.sin(a);let u0=1e9,u1=-1e9,v0=1e9,v1=-1e9;
    for(let k=0;k<n;k++){const dx=p[k*2]-cx,dz=p[k*2+1]-cz;const u=dx*ca+dz*sa,v=-dx*sa+dz*ca;if(u<u0)u0=u;if(u>u1)u1=u;if(v<v0)v0=v;if(v>v1)v1=v;}
    const core=coreAt(cx,cz)*(C.hMul||1);
    let h=ob.h||(ob.lv?ob.lv*3.4:0);const est=estimateH(ob.ty,Math.abs(A),core,r);
    if(h){known++;if(!ob.part&&h>3)errs.push([h,est]);}else h=est;
    let mn=1e9;const step=Math.max(1,Math.floor(n/6));for(let k=0;k<n;k+=step){const e=elevAt(p[k*2],p[k*2+1]);if(e<mn)mn=e;}
    const ec=elevAt(cx,cz);if(mn>ec)mn=ec;
    let u=TY_USE[ob.ty];if(u==="?"){const offP=clamp((core-15)/150,0,.88)*(st.office||1);const q=r();u=q<offP*(h>30?1:.4)?"o":q<offP+.12?"m":"r";}
    if(ob.ty===1&&inInd(cx,cz))u="r";
    const mh=Math.min(ob.mh||0,h-1);const hh=Math.max(2.2,h-mh);
    const glass=hh>50&&r()<clamp(.3+(h-60)/220,0,.9)*(st.glass||1);
    const col=ob.ty===7?[.62,.62,.6]:ob.ty===4?pick(pal.ind,r):glass?pick(pal.glass,r):(ob.ty===1&&Math.abs(A)<260)?pick(pal.house,r):(h>45&&r()<.45?pick(pal.stone,r):pick(pal.brick,r));
    const i=addB({osm:true,x:cx,z:cz,A:Math.abs(A),pts:p,n,a,w:u1-u0,d:v1-v0,h:hh,yo:mh,y:mn-1.2,g:ec-mn+1.2,k:"o",u,c:col,glass:glass?1:0,lv:ob.lv,part:ob.part,blk:-1});
    B[i].inst=-1;
    // rooftop details
    if(mh<1&&hh>14&&ob.ty!==7&&r()<.3){const nk=1+(r()<.35?1:0);for(let q=0;q<nk;q++){const kw=Math.min(B[i].w*(.15+r()*.15),14),kd=Math.min(B[i].d*(.15+r()*.15),14);if(kw>1.5&&kd>1.5)addB({kid:true,par:i,kx:(r()-.5)*B[i].w*.3,kz:(r()-.5)*B[i].d*.3,x:cx,z:cz,w:kw,d:kd,h:2.5+r()*2.2,k:"k",u:"x",c:[.72,.72,.7],a,dy:0});}}
    if(st.tank&&!glass&&hh>14&&hh<90&&r()<st.tank*.3)addB({kid:true,par:i,kx:(r()-.5)*B[i].w*.3,kz:(r()-.5)*B[i].d*.3,x:cx,z:cz,w:6,d:6,h:8,k:"t",u:"x",c:[.55,.42,.3],a,dy:2.5});
    if((ob.ty===1||(Math.abs(A)<190&&ob.ty!==4&&ob.ty!==7))&&Math.abs(A)<260&&hh<11&&!glass&&r()<Math.max(st.gable||0,S_KEY_GABLE())&&n<=10)addB({kid:true,par:i,kx:0,kz:0,x:cx,z:cz,w:B[i].w+.4,d:B[i].d+.4,h:2.4+r()*1.6,k:"r",u:"x",c:pick(pal.roof,r),a,dy:0});
  }
  // honest check of the height estimator on buildings whose real height OSM knows
  if(errs.length){const e=errs.map(([h,s])=>Math.abs(s-h)/h).sort((a,b)=>a-b);E.heightCheck={known,total,median:e[Math.floor(e.length/2)],n:errs.length};}else E.heightCheck={known,total,median:null,n:0};
  // real mapped trees when available; otherwise generated street trees
  if(OSM.trees&&OSM.trees.length>500){const tr=OSM.trees;const step=Math.max(1,Math.ceil(tr.length/45000));for(let k=0;k<tr.length;k+=step){const [x,z]=tr[k];const c=clsAt(x,z);if(OSM.ponds&&OSM.ponds.some(w=>pipT(x,z,w.pts)))continue;if(c===1||c===2||c===3)E.trees.push([x,z,3.2+r()*3,st.palm&&r()<.5]);}return;}
  const tp=(st.trees||0)*.28;
  for(const rd of OSM.roads){if(rd.fl&6||!(rd.ty>=3&&rd.ty<=5))continue;const w=roadW(rd)/2+2.2;const sp=st.palm?13:10;
    for(let k=0;k<rd.pts.length-1&&E.trees.length<26000;k++){const [x0,z0]=rd.pts[k],[x1,z1]=rd.pts[k+1];const L=Math.hypot(x1-x0,z1-z0);if(L<sp)continue;const nx=-(z1-z0)/L,nz=(x1-x0)/L;
      for(let s=sp/2;s<L;s+=sp){if(r()>tp)continue;const sd=r()<.5?1:-1;const x=x0+(x1-x0)*s/L+nx*w*sd,z=z0+(z1-z0)*s/L+nz*w*sd;if(clsAt(x,z)===1)E.trees.push([x,z,3+r()*2.5,st.palm&&r()<.6]);}}}
}
/* merged meshes: one per 1 km tile; bottom ring + top ring per footprint, walls + triangulated roof */
function buildOSMMeshes(){
  OCH=[];const mat=osmMat();const byChunk=new Map();
  for(let i=0;i<B.length;i++){const b=B[i];if(!b.osm||b.iconHide)continue;const key=Math.floor((b.x+EXT)/1000)+Math.floor((b.z+EXT)/1000)*100;if(!byChunk.has(key))byChunk.set(key,[]);byChunk.get(key).push(i);}
  for(const [key,ids] of byChunk){
    let nv=0,ni=0;for(const i of ids){const b=B[i];nv+=2*(b.n+1);ni+=6*b.n+3*(b.n-2);}
    const pos=new Float32Array(nv*3),fac=new Float32Array(nv*4),colr=new Uint8Array(nv*3),idx=new Uint32Array(ni);
    let vo=0,io=0;const ch={ids,pos,fac,colr,mesh:null};
    for(const i of ids){const b=B[i],p=b.pts,n=b.n;b.ch=OCH.length;b.vs=vo;
      let per=0;
      for(let k=0;k<=n;k++){const kk=k%n;const x=p[kk*2],z=p[kk*2+1];
        if(k>0){const pk=(k-1)%n;per+=Math.hypot(x-p[pk*2],z-p[pk*2+1]);}
        const vb=vo+k,vt=vo+n+1+k;pos[vb*3]=x;pos[vb*3+2]=z;pos[vt*3]=x;pos[vt*3+2]=z;fac[vb*4]=per;fac[vt*4]=per;fac[vb*4+3]=b.glass;fac[vt*4+3]=b.glass;}
      // walls (ring is counter-clockwise in x/z, so emit outward-facing triangles)
      for(let k=0;k<n;k++){const b0=vo+k,b1=vo+k+1,t0=vo+n+1+k,t1=vo+n+2+k;idx[io++]=b0;idx[io++]=t1;idx[io++]=b1;idx[io++]=b0;idx[io++]=t0;idx[io++]=t1;}
      // roof
      let tris;
      if(n===3)tris=[0,1,2];else if(n===4)tris=[0,1,2,0,2,3];else{const flat=[];for(let k=0;k<n;k++)flat.push(p[k*2],p[k*2+1]);const cv=[];for(let k=0;k<n;k++)cv.push(new T.Vector2(p[k*2],p[k*2+1]));tris=[].concat(...T.ShapeUtils.triangulateShape(cv,[]));}
      for(let t=0;t+2<tris.length;t+=3){const a0=tris[t],a1=tris[t+1],a2=tris[t+2];const ux=p[a1*2]-p[a0*2],uz=p[a1*2+1]-p[a0*2+1],wx=p[a2*2]-p[a0*2],wz=p[a2*2+1]-p[a0*2+1];const up=uz*wx-ux*wz;const T0=vo+n+1;
        if(io+3>idx.length)break;if(up>=0){idx[io++]=T0+a0;idx[io++]=T0+a1;idx[io++]=T0+a2;}else{idx[io++]=T0+a0;idx[io++]=T0+a2;idx[io++]=T0+a1;}}
      vo+=2*(n+1);
    }
    const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(pos,3));g.setAttribute("aFac",new T.BufferAttribute(fac,4));g.setAttribute("color",new T.BufferAttribute(colr,3,true));g.setIndex(new T.BufferAttribute(io<idx.length?idx.slice(0,io):idx,1));
    const m=new T.Mesh(g,mat);m.castShadow=true;m.receiveShadow=true;ch.mesh=m;cityG.add(m);OCH.push(ch);
    for(const i of ids)osmWrite(B[i],true);
    g.computeBoundingSphere();g.computeBoundingBox();
  }
}
const osmDirty=new Set();
function osmWrite(b,init){
  const ch=OCH[b.ch];if(!ch)return;const n=b.n+1,pos=ch.pos,fac=ch.fac;
  const hidden=b.rm||b.hid;let yb,yt,hb;
  if(b.yo>0){yb=b.y+b.g+b.yo;yt=yb+b.h;hb=b.h;}else{yb=b.y;yt=b.y+b.g+b.h;hb=b.h+b.g;}
  if(hidden){yb=-80;yt=-80;}
  for(let k=0;k<n;k++){const vb=b.vs+k,vt=b.vs+n+k;pos[vb*3+1]=yb;pos[vt*3+1]=yt;fac[vb*4+1]=0;fac[vt*4+1]=hb;fac[vb*4+2]=hb;fac[vt*4+2]=hb;}
  if(!init)osmDirty.add(b.ch);
}
function osmColor(b,c){const ch=OCH[b.ch];if(!ch)return;const n=2*(b.n+1);const lin=v=>Math.round(Math.pow(clamp(v,0,1),2.2)*255);const r=lin(c[0]),g=lin(c[1]),bb=lin(c[2]);for(let k=0;k<n;k++){const v=(b.vs+k)*3;ch.colr[v]=r;ch.colr[v+1]=g;ch.colr[v+2]=bb;}osmDirty.add(b.ch);}
function flushOSM(){for(const c of osmDirty){const g=OCH[c].mesh.geometry;g.attributes.position.needsUpdate=true;g.attributes.aFac.needsUpdate=true;g.attributes.color.needsUpdate=true;}osmDirty.clear();}

/* roads: cars, labels, markings, named corridors */
let RGRAPH=null;
const VOL=[12,7,5,3.5,2.2,.35,.08,0,3,1.5,0]; // relative daily volume per lane-km by class (motorway…residential)
function buildOSMNet(){
  const ways=OSM.roads.map((r,i)=>Object.assign(r,{i,w:roadW(r),len:polyLen(r.pts)}));
  const node=new Map();const key=p=>Math.round(p[0])+","+Math.round(p[1]);
  for(const r of ways){if(!drivable(r))continue;for(const end of [0,1]){const k=key(end?r.pts[r.pts.length-1]:r.pts[0]);if(!node.has(k))node.set(k,[]);node.get(k).push({r,end});}}
  const drive=ways.filter(r=>drivable(r)&&r.ty!==6&&r.len>8);let acc=0;const cum=drive.map(r=>(acc+=r.len*VOL[r.ty]));
  RGRAPH={ways,node,key,drive,cum,total:acc};
  const sig=new Map();const sr=rng(91);for(const [k,list] of node){const big=list.filter(o=>o.r.ty<=4||o.r.ty===9);if(list.length>=3&&big.length>=2&&!list.some(o=>isHwy(o.r))){const o=list[0],p=o.end?o.r.pts[o.r.pts.length-2]:o.r.pts[1],q=o.end?o.r.pts[o.r.pts.length-1]:o.r.pts[0];sig.set(k,{ph:sr()*60,axis:Math.atan2(p[1]-q[1],p[0]-q[0]),n:{}});}}RGRAPH.sig=sig;
  C._roads=ways.filter(r=>r.n&&!(r.fl&4)).map(r=>({n:r.n,w:r.w,hwy:isHwy(r),pts:r.pts,ty:r.ty}));
}
function initCarsOSM(){
  if(/Mobi|Android/i.test(navigator.userAgent||""))NCARS=1200;
  cars=[];carMesh=new T.InstancedMesh(carGeo(),MAT.car,NCARS);carMesh.frustumCulled=false;cityG.add(carMesh);
  const paints=[[.92,.92,.92],[.1,.1,.11],[.55,.57,.6],[.72,.74,.76],[.6,.08,.08],[.12,.22,.45],[.25,.3,.28],[.85,.85,.82]];const r=rng(77);
  for(let i=0;i<NCARS;i++){const c={r:rng(1000+i),osm:true};spawnCarOSM(c);c.paint=paints[Math.floor(r()*paints.length)];cars.push(c);carMesh.setColorAt(i,col.setRGB(...c.paint).convertSRGBToLinear());}
}
function spawnCarOSM(c){
  const G=RGRAPH;if(!G||!G.drive.length){c.R=null;return;}
  const t=c.r()*G.total;let lo=0,hi=G.cum.length-1;while(lo<hi){const m=(lo+hi)>>1;if(G.cum[m]<t)lo=m+1;else hi=m;}
  const w=G.drive[lo];c.way=w;c.seg=Math.floor(c.r()*(w.pts.length-1));c.t=c.r();c.dir=(w.fl&1)?1:(c.r()<.5?1:-1);
  const lanes=Math.max(1,w.lanes||RT_LANES[w.ty]);const per=(w.fl&1)?lanes:Math.max(1,Math.floor(lanes/2));c.lane=Math.floor(c.r()*per);c.R=true;
}
function carPosOSM(c){const w=c.way,a=w.pts[c.seg],b=w.pts[c.seg+1];const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1;const ux=dx/L*c.dir,uz=dz/L*c.dir;
  const lanes=Math.max(1,w.lanes||RT_LANES[w.ty]);let off;if(w.fl&1)off=(c.lane-(lanes-1)/2)*3.2;else off=(c.lane+.5)*3.2;
  return [a[0]+dx*c.t-uz*off,a[1]+dz*c.t+ux*off,ux,uz];}
function stepCarOSM(c,dist){
  const G=RGRAPH;let guard=0;
  while(dist>0&&guard++<8){const w=c.way,a=w.pts[c.seg],b=w.pts[c.seg+1];const L=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
    const remain=c.dir>0?(1-c.t)*L:c.t*L;
    if(dist<remain){c.t+=c.dir*dist/L;return;}
    dist-=remain;
    if(c.dir>0&&c.seg<w.pts.length-2){c.seg++;c.t=0;continue;}if(c.dir<0&&c.seg>0){c.seg--;c.t=1;continue;}
    const end=c.dir>0?w.pts[w.pts.length-1]:w.pts[0];
    {const sg=G.sig&&G.sig.get(G.key(end));if(sg){const pa=c.dir>0?w.pts[w.pts.length-2]:w.pts[1];const ang=Math.atan2(end[1]-pa[1],end[0]-pa[0]);const bucket=Math.abs(Math.cos(ang-sg.axis))>.707?0:1;const cyc=Math.floor((simT+sg.ph)/60),green=((simT+sg.ph)%60<30)===(bucket===0);
      if(!green&&!c.passed){const qk=cyc+"|"+bucket+"|"+(c.dir>0?1:0);sg.n[qk]=(sg.n[qk]||0)+1;const qi=sg.n[qk]-1;const off=Math.min(L*.95,3+qi*6.5+(w.w||8)*.4);c.t=c.dir>0?1-off/L:off/L;c.hold={sg,bucket};return;}c.passed=false;}}
    const opts=(G.node.get(G.key(end))||[]).filter(o=>o.r!==w&&o.r.ty!==6&&!((o.r.fl&1)&&o.end===1));
    if(!opts.length){if(w.fl&1){spawnCarOSM(c);return;}c.dir=-c.dir;continue;}
    let o;{const pa=c.dir>0?w.pts[w.pts.length-2]:w.pts[1];const hx=end[0]-pa[0],hz=end[1]-pa[1],hl=Math.hypot(hx,hz)||1;let tot=0;const ws=opts.map(op=>{const nx=op.end===0?op.r.pts[1]:op.r.pts[op.r.pts.length-2];const dx=nx[0]-end[0],dz=nx[1]-end[1],dl=Math.hypot(dx,dz)||1;const st=(hx*dx+hz*dz)/(hl*dl);const wv=VOL[op.r.ty]*(op.r.n&&op.r.n===w.n?3:1)*Math.pow(1.2+st,2);tot+=wv;return wv;});let x=c.r()*tot;o=opts[opts.length-1];for(let i=0;i<opts.length;i++){x-=ws[i];if(x<=0){o=opts[i];break;}}}
    c.way=o.r;if(o.end===0){c.dir=1;c.seg=0;c.t=0;}else{c.dir=-1;c.seg=o.r.pts.length-2;c.t=1;}
    const lanes=Math.max(1,o.r.lanes||RT_LANES[o.r.ty]);const per=(o.r.fl&1)?lanes:Math.max(1,Math.floor(lanes/2));c.lane=Math.min(c.lane,per-1);
  }
}
function buildOSMAnchors(){
  const done=new Map();
  for(const r of RGRAPH.ways){if(!r.n||(r.fl&4)||r.ty===6)continue;const stepL=r.ty<=3?260:220;
    let acc=stepL*.45;for(let k=0;k<r.pts.length-1;k++){const a=r.pts[k],b=r.pts[k+1];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);while(acc<L){const t=acc/L;const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
      const key=r.n+"|"+Math.floor(x/120)+","+Math.floor(z/120);if(!done.has(key)&&Math.abs(x)<EXT&&Math.abs(z)<EXT){done.set(key,1);addAnchor({x,z,dir:[(b[0]-a[0])/L,(b[1]-a[1])/L],name:r.n,major:r.ty<=3||isHwy(r),y:0});}acc+=stepL;}acc-=L;}}
  for(const a of anchors)a.y=elevAt(a.x,a.z)+1;
  hoodL=C.hoods.map(h=>{const [x,z]=P([h[1],h[2]]);return {n:h[0],x,z,y:elevAt(x,z)+40};});
}
/* ---- 3D roads: crisp asphalt ribbons, sidewalks, and elevated decks with parapets and piers ---- */
function densify(pts,step){const o=[pts[0]];for(let k=1;k<pts.length;k++){const a=pts[k-1],b=pts[k];const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step);for(let j=1;j<=n;j++)o.push([lerp(a[0],b[0],j/n),lerp(a[1],b[1],j/n)]);}return o;}
function deckAt(w,seg,x,z){const a=w.pts[seg],b=w.pts[seg+1]||a;const L=Math.hypot(b[0]-a[0],b[1]-a[1])||1;const t=clamp(Math.hypot(x-a[0],z-a[1])/L,0,1);return lerp(w.base[seg]+w.hs[seg],w.base[seg+1]+w.hs[seg+1],t);}
// Tunnels: a faint dashed trace of the route underground plus a concrete portal where it dives in
function buildTunnels(){
  const ends=new Map();const k=p=>Math.round(p[0])+","+Math.round(p[1]);
  for(const r of OSM.roads){if(r.ty===7||r.ty>9)continue;for(const p of [r.pts[0],r.pts[r.pts.length-1]]){const kk=k(p);if(!ends.has(kk))ends.set(kk,[]);ends.get(kk).push(r);}}
  const trace=[],portals=[];
  for(const r of OSM.roads){if(!(r.fl&4)||r.ty===7||r.ty>9||r.ty===6)continue;if(!r.pts.some(p=>Math.abs(p[0])<EXT&&Math.abs(p[1])<EXT))continue;
    const w=r.w||roadW(r);const dp=densify(r.pts,10);let acc=0;
    for(let i=0;i<dp.length-1;i++){const a=dp[i],b=dp[i+1];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(Math.floor(acc/18)%2===0)trace.push([a,b,w*.55]);acc+=L;}
    for(const end of [0,1]){const p=end?r.pts[r.pts.length-1]:r.pts[0],q=end?r.pts[r.pts.length-2]:r.pts[1];const nb=ends.get(k(p))||[];
      if(nb.some(o=>o!==r&&!(o.fl&4)))portals.push([p,Math.atan2(q[1]-p[1],q[0]-p[0]),w]);}}
  if(trace.length){const arr=[];for(const [a,b,w] of trace){const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,ox=-dz/L*w/2,oz=dx/L*w/2;const ya=elevAt(a[0],a[1])+.38,yb=elevAt(b[0],b[1])+.38;
      arr.push(a[0]+ox,ya,a[1]+oz,a[0]-ox,ya,a[1]-oz,b[0]+ox,yb,b[1]+oz,a[0]-ox,ya,a[1]-oz,b[0]-ox,yb,b[1]-oz,b[0]+ox,yb,b[1]+oz);}
    const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(arr,3));
    const m=new T.Mesh(g,new T.MeshBasicMaterial({color:0x3d4148,transparent:true,opacity:.28,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));m.renderOrder=4;scene.add(m);}
  const conc=new T.MeshStandardMaterial({color:new T.Color(0xc9c5bc).convertSRGBToLinear(),roughness:.9}),hole=new T.MeshBasicMaterial({color:0x0b0d10});
  for(const [p,ang,w] of portals){const g=new T.Group();const y=Math.max(0,elevAt(p[0],p[1]));
    const head=new T.Mesh(new T.BoxGeometry(2.4,9,w+8),conc);head.position.set(0,4.5,0);head.castShadow=true;g.add(head);
    const op=new T.Mesh(new T.BoxGeometry(2.6,5.8,w),hole);op.position.set(.1,2.9,0);g.add(op);
    for(const sd of [-1,1]){const wing=new T.Mesh(new T.BoxGeometry(26,4,1.2),conc);wing.position.set(-13,2,sd*(w/2+3.5));wing.castShadow=true;g.add(wing);}
    g.position.set(p[0]+Math.cos(ang)*4,y,p[1]+Math.sin(ang)*4);g.rotation.y=-ang+Math.PI;scene.add(g);}
  E.tunnelStats={trace:trace.length,portals:portals.length};
}
// Sports fields, running tracks and school grounds as crisp flat surfaces
function buildSports(){
  const groups={};
  const tri=(arr,a,b,c,dy,flatY,d)=>{const l=Math.max(Math.hypot(a.x-b.x,a.y-b.y),Math.hypot(b.x-c.x,b.y-c.y),Math.hypot(c.x-a.x,c.y-a.y));
    if(l>14&&d<7){const m=(p,q)=>new T.Vector2((p.x+q.x)/2,(p.y+q.y)/2);const ab=m(a,b),bc=m(b,c),ca=m(c,a);tri(arr,a,ab,ca,dy,flatY,d+1);tri(arr,ab,b,bc,dy,flatY,d+1);tri(arr,ca,bc,c,dy,flatY,d+1);tri(arr,ab,bc,ca,dy,flatY,d+1);return;}
    for(const q of [a,b,c])arr.push(q.x,flatY!=null?flatY:elevAt(q.x,q.y)+dy,q.y);};
  const add=(key,pts,dy,flat)=>{if(pts.length<3)return;const v=pts.map(p=>new T.Vector2(p[0],p[1]));if(T.ShapeUtils.area(v)>0)v.reverse();let tris;try{tris=T.ShapeUtils.triangulateShape(v,[]);}catch(e){return;}
    const fy=flat?Math.max(...v.map(q=>elevAt(q.x,q.y)))+.3:null;const arr=groups[key]=groups[key]||[];for(const t of tris)tri(arr,v[t[0]],v[t[1]],v[t[2]],dy,fy,0);};
  for(const w of OSM.ponds||[])add("pond",w.pts,0,true);
  const inMapP=pts=>pts.some(p=>Math.abs(p[0])<EXT&&Math.abs(p[1])<EXT);
  for(const s of OSM.schools||[])if(inMapP(s.pts))add("school",s.pts,.2);
  for(const t of OSM.tracks||[])if(t.area&&inMapP(t.pts))add("track",t.pts,.24);
  const lines=[];
  for(const f of OSM.sports||[]){if(!inMapP(f.pts)||f.k!=="pitch")continue;const sp=f.sport||"";
    const key=/tennis|pickleball/.test(sp)?"tennis":/basketball/.test(sp)?"court":/baseball|softball/.test(sp)?"diamond":/beachvolleyball|sand/.test(sp+f.surf)?"sand":"turf";add(key,f.pts,.27);
    if(key==="turf"||key==="tennis"||key==="court")lines.push(f.pts);}
  const COL={school:0xe6d9bf,track:0xb4553f,turf:0x5d9b4b,tennis:0x4f8a73,court:0x6f8fb0,diamond:0x68a253,sand:0xe3cf9c,pond:0x4f8296};const ORD={school:.4,track:.6,turf:.7,tennis:.7,court:.7,diamond:.7,sand:.7,pond:.5};
  for(const key in groups){const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(groups[key],3));g.computeVertexNormals();
    const m=new T.Mesh(g,new T.MeshStandardMaterial({color:new T.Color(COL[key]).convertSRGBToLinear(),roughness:key==="pond"?.15:.95,metalness:key==="pond"?.2:0,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,depthWrite:key==="pond"}));
    m.receiveShadow=true;m.renderOrder=ORD[key];scene.add(m);}
  // white boundary lines on fields and courts
  const arr=[];for(const pts of lines){const n=pts.length;let cx=0,cz=0;for(const p of pts){cx+=p[0];cz+=p[1];}cx/=n;cz/=n;
    const ins=pts.map(p=>{const dx=cx-p[0],dz=cz-p[1],L=Math.hypot(dx,dz)||1,d=Math.min(1.5,L*.08);return [p[0]+dx/L*d,p[1]+dz/L*d];});
    for(let i=0;i<n;i++){const a=ins[i],b=ins[(i+1)%n];const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,ox=-dz/L*.25,oz=dx/L*.25;const ya=elevAt(a[0],a[1])+.32,yb=elevAt(b[0],b[1])+.32;
      arr.push(a[0]+ox,ya,a[1]+oz,a[0]-ox,ya,a[1]-oz,b[0]+ox,yb,b[1]+oz,a[0]-ox,ya,a[1]-oz,b[0]-ox,yb,b[1]-oz,b[0]+ox,yb,b[1]+oz);}}
  if(arr.length){const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(arr,3));const lm=new T.Mesh(g,new T.MeshBasicMaterial({color:0xf2f2ee,side:T.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));lm.renderOrder=.8;scene.add(lm);}
  // running tracks mapped as lines: a 9 m rust ribbon
  const tr=[];for(const t of OSM.tracks||[]){if(t.area||!inMapP(t.pts))continue;const dp=densify(t.pts,6);for(let i=0;i<dp.length-1;i++){const a=dp[i],b=dp[i+1];const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,ox=-dz/L*4.5,oz=dx/L*4.5;const ya=elevAt(a[0],a[1])+.18,yb=elevAt(b[0],b[1])+.18;
    tr.push(a[0]+ox,ya,a[1]+oz,a[0]-ox,ya,a[1]-oz,b[0]+ox,yb,b[1]+oz,a[0]-ox,ya,a[1]-oz,b[0]-ox,yb,b[1]-oz,b[0]+ox,yb,b[1]+oz);}}
  if(tr.length){const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(tr,3));g.computeVertexNormals();scene.add(new T.Mesh(g,new T.MeshStandardMaterial({color:new T.Color(0xb4553f).convertSRGBToLinear(),roughness:.95,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1.5,polygonOffsetUnits:-1.5})));}
  // school names as map labels
  schoolL=[];for(const s of OSM.schools||[]){if(!s.n||!inMapP(s.pts))continue;let A=0,cx=0,cz=0;const P2=s.pts;for(let i=0,j=P2.length-1;i<P2.length;j=i++){const f=P2[j][0]*P2[i][1]-P2[i][0]*P2[j][1];A+=f;cx+=(P2[j][0]+P2[i][0])*f;cz+=(P2[j][1]+P2[i][1])*f;}if(Math.abs(A)<2500)continue;cx/=3*A;cz/=3*A;schoolL.push({n:s.n,x:cx,z:cz,k:s.k,A:Math.abs(A/2)});}
}
let schoolL=[];
// ---------- footpaths & cycleways ----------
function ribbon(arr,pts,ys,w){const n=pts.length;for(let k=0;k<n-1;k++){const a=pts[k],b=pts[k+1];const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,ox=-dz/L*w/2,oz=dx/L*w/2;
  arr.push(a[0]+ox,ys[k],a[1]+oz,a[0]-ox,ys[k],a[1]-oz,b[0]+ox,ys[k+1],b[1]+oz,a[0]-ox,ys[k],a[1]-oz,b[0]-ox,ys[k+1],b[1]-oz,b[0]+ox,ys[k+1],b[1]+oz);}}
function flatMesh(arr,hex,ro,opts){if(!arr.length)return null;const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(arr,3));g.computeVertexNormals();
  const m=new T.Mesh(g,new T.MeshStandardMaterial(Object.assign({color:new T.Color(hex).convertSRGBToLinear(),roughness:.95,side:T.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1},opts||{})));m.receiveShadow=true;m.renderOrder=ro;scene.add(m);return m;}
function buildPaths(){
  const A=[[],[],[],[]],W=[2.2,2.4,2.6,3],COL=[0xe7e2d6,0xcfc8ba,0x9fbf8f,0xc9b99a],deck=[],side=[];
  for(const p of OSM.paths||[]){if(p.fl&2)continue;if(!p.pts.some(q=>Math.abs(q[0])<EXT&&Math.abs(q[1])<EXT))continue;const dp=densify(p.pts,8);
    if(p.fl&1){const ys=dp.map((q,i)=>Math.max(0,elevAt(q[0],q[1]))+Math.min(6,Math.min(i,dp.length-1-i)*1.2)+.4);ribbon(deck,dp,ys,W[p.k]+.8);continue;}
    ribbon(A[p.k],dp,dp.map(q=>elevAt(q[0],q[1])+.26),W[p.k]);}
  A.forEach((a,k)=>flatMesh(a,COL[k],1.5));flatMesh(deck,0xd6d1c6,6,{depthWrite:true,polygonOffset:false});
}
// ---------- railways: ballast, rails, elevated viaducts ----------
let railNet=null;
function buildRail3D(){
  if(!OSM.rail2)return;const ways=OSM.rail2.filter(r=>!r.tunnel&&r.pts.some(q=>Math.abs(q[0])<EXT+200&&Math.abs(q[1])<EXT+200));
  const key=p=>Math.round(p[0])+","+Math.round(p[1]);
  // elevated chains share one height; ends slope down unless they meet another viaduct
  const par=new Map(),find=r=>{while(par.get(r)!==r){par.set(r,par.get(par.get(r)));r=par.get(r);}return r;};const at=new Map();
  for(const r of ways)if(r.bridge){par.set(r,r);for(const p of [r.pts[0],r.pts[r.pts.length-1]]){const k=key(p);if(at.has(k)){const a=find(at.get(k)),b=find(r);if(a!==b)par.set(a,b);}else at.set(k,r);}}
  const hOf=r=>{let wet=false;for(let k=0;k<r.pts.length;k+=Math.max(1,Math.floor(r.pts.length/5)))if(clsAt(r.pts[k][0],r.pts[k][1])===0)wet=true;return wet?38:Math.max(9,r.layer*7);};
  const cH=new Map();for(const r of par.keys()){const k=find(r);cH.set(k,Math.max(cH.get(k)||0,hOf(r)));}
  const ends=new Map();for(const r of ways)if(r.bridge)for(const p of [r.pts[0],r.pts[r.pts.length-1]]){const k=key(p);ends.set(k,(ends.get(k)||0)+1);}
  const bal=[],rails=[],deckA=[],sideA=[],piers=[],tram=[];
  for(const r of ways){const dp=densify(r.pts,10);r.dp=dp;const light=r.k!=="rail";const gauge=1.435;
    const cum=[0];for(let i=1;i<dp.length;i++)cum.push(cum[i-1]+Math.hypot(dp[i][0]-dp[i-1][0],dp[i][1]-dp[i-1][1]));const tot=cum[cum.length-1]||1;
    let hs=dp.map(()=>0);
    if(r.bridge){const H=cH.get(find(r))||9;const c0=(ends.get(key(r.pts[0]))||0)>1,c1=(ends.get(key(r.pts[r.pts.length-1]))||0)>1;const tl=Math.min(tot/2,Math.max(60,H*14));const sm=u=>u*u*(3-2*u);
      hs=cum.map(d=>H*Math.min(c0?1:sm(clamp(d/tl,0,1)),c1?1:sm(clamp((tot-d)/tl,0,1))));}
    r.hs=hs;r.cum=cum;r.len=tot;
    const base=dp.map(q=>Math.max(0,elevAt(q[0],q[1])));
    if(r.k==="tram"&&!r.bridge){const ys=base.map(b=>b+.4);for(const o of [-gauge/2,gauge/2]){const sh=dp.map((q,i)=>{const a=dp[Math.max(0,i-1)],b=dp[Math.min(dp.length-1,i+1)];const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1;return [q[0]-dz/L*o,q[1]+dx/L*o];});ribbon(tram,sh,ys,.14);}continue;}
    const elev=hs.some(h=>h>3);const ys=base.map((b,i)=>b+hs[i]+(elev&&hs[i]>3?.9:.3));
    if(elev){ribbon(deckA,dp,base.map((b,i)=>b+hs[i]+.6),light?7:9);
      for(let i=0;i<dp.length-1;i+=1){const h=hs[i];if(h>4&&Math.round(cum[i]/30)!==Math.round(cum[i+1]/30))piers.push([dp[i][0],base[i],dp[i][1],h,Math.atan2(dp[i+1][1]-dp[i][1],dp[i+1][0]-dp[i][0])]);}}
    ribbon(bal,dp,ys,light?3.4:4.4);
    for(const o of [-gauge/2,gauge/2]){const sh=dp.map((q,i)=>{const a=dp[Math.max(0,i-1)],b=dp[Math.min(dp.length-1,i+1)];const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1;return [q[0]-dz/L*o,q[1]+dx/L*o];});ribbon(rails,sh,ys.map(y=>y+.12),.12);}
  }
  flatMesh(bal,0x8f877d,2.5);flatMesh(rails,0x55585d,3.6,{metalness:.6,roughness:.4});flatMesh(tram,0x6d7076,5.5,{metalness:.6,roughness:.4});
  const dk=flatMesh(deckA,0xbab5ab,6,{depthWrite:true,polygonOffset:false});if(dk)dk.castShadow=true;
  if(piers.length){const im=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:new T.Color(0xb8b3aa).convertSRGBToLinear(),roughness:.9}),piers.length);
    piers.forEach(([x,y,z,h,a],i)=>{dummy.position.set(x,y+h/2,z);dummy.quaternion.setFromAxisAngle(YV,-a);dummy.scale.set(1.8,h,2.4);dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix);});im.castShadow=true;scene.add(im);}
  // network for trains
  const em=new Map();for(const r of ways){if(r.svc||r.k==="tram")continue;for(const e of [0,1]){const k=key(e?r.pts[r.pts.length-1]:r.pts[0]);if(!em.has(k))em.set(k,[]);em.get(k).push({r,end:e});}}
  railNet={ways:ways.filter(r=>!r.svc&&r.len>40&&r.k!=="tram"),ends:em,key};
}
function railPos(r,d){const c=r.cum;let lo=0,hi=c.length-1;while(lo<hi-1){const m=(lo+hi)>>1;if(c[m]<=d)lo=m;else hi=m;}const u=clamp((d-c[lo])/((c[hi]-c[lo])||1),0,1);const a=r.dp[lo],b=r.dp[hi];
  const x=lerp(a[0],b[0],u),z=lerp(a[1],b[1],u);return [x,Math.max(0,elevAt(x,z))+lerp(r.hs[lo],r.hs[hi],u)+(r.hs[lo]>3?.9:.3),z,Math.atan2(b[1]-a[1],b[0]-a[0])];}
// ---------- trains ----------
let trains=[],trainMesh=null;const NTR=36,TCARS=4;
function initTrains(){if(!railNet||!railNet.ways.length)return;const r=rng(404);
  const g=new T.BoxGeometry(18.5,3.6,3.0).translate(0,1.8,0);trainMesh=new T.InstancedMesh(g,new T.MeshStandardMaterial({color:0xffffff,roughness:.45,metalness:.3}),NTR*TCARS);trainMesh.frustumCulled=false;scene.add(trainMesh);
  const tot=railNet.ways.reduce((a,w)=>a+w.len,0);
  for(let i=0;i<NTR;i++){let x=r()*tot,w=railNet.ways[0];for(const ww of railNet.ways){x-=ww.len;if(x<=0){w=ww;break;}}
    const t={w,d:r()*w.len,dir:r()<.5?1:-1,v:(w.k==="rail"?14:11)*(.8+r()*.4),stop:0,hist:[]};trains.push(t);
    const colr=w.k==="subway"?[.78,.8,.83]:w.k==="light_rail"?[.93,.94,.95]:[.85,.82,.62];for(let k=0;k<TCARS;k++)trainMesh.setColorAt(i*TCARS+k,col.setRGB(...colr).convertSRGBToLinear());}
}
function updateTrains(dt){if(!trainMesh)return;const vis=camera.position.distanceTo(controls.target)<9000;
  for(let i=0;i<trains.length;i++){const t=trains[i];
    if(t.stop>0)t.stop-=dt*3.2;else{t.d+=t.dir*t.v*dt*3.2;if(Math.random()<dt*.01)t.stop=20+Math.random()*25;}
    let guard=0;while((t.d<0||t.d>t.w.len)&&guard++<4){const endP=t.d<0?t.w.pts[0]:t.w.pts[t.w.pts.length-1];const over=t.d<0?-t.d:t.d-t.w.len;
      const opts=(railNet.ends.get(railNet.key(endP))||[]).filter(o=>o.r!==t.w&&o.r.k===t.w.k);if(!opts.length){t.dir*=-1;t.d=t.d<0?over:t.w.len-over;continue;}
      const o=opts[Math.floor(Math.random()*opts.length)];t.w=o.r;if(o.end===0){t.dir=1;t.d=over;}else{t.dir=-1;t.d=t.w.len-over;}}
    for(let k=0;k<TCARS;k++){const dd=t.d-t.dir*k*19.5;const idx=i*TCARS+k;
      if(!vis||dd<0||dd>t.w.len){dummy.position.set(0,-999,0);dummy.scale.set(1e-4,1e-4,1e-4);}else{const [x,y,z,a]=railPos(t.w,dd);dummy.position.set(x,y,z);dummy.quaternion.setFromAxisAngle(YV,-a);dummy.scale.set(1,1,1);}
      dummy.updateMatrix();trainMesh.setMatrixAt(idx,dummy.matrix);}}
  trainMesh.instanceMatrix.needsUpdate=true;}
// ---------- pedestrians: spawned around where you're looking, busier downtown and by day ----------
let peds=[],pedBody=null,pedHead=null,pedWays=null,pedGrid=null,pedEnds=null;let NPED=2200;
function initPeds(){
  if(/Mobi|Android/i.test(navigator.userAgent||""))NPED=900;
  pedWays=[];const off=(pts,o)=>pts.map((q,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1;return [q[0]-dz/L*o,q[1]+dx/L*o];});
  for(const r of OSM.roads){if(r.fl&6||r.ty<2||r.ty>7||r.ty===6)continue;const w=(r.w||roadW(r))/2+1.6;if(r.ty===7){pedWays.push(r.pts);continue;}pedWays.push(off(r.pts,w),off(r.pts,-w));}
  for(const p of OSM.paths||[])if(!(p.fl&3)&&p.k!==3)pedWays.push(p.pts);
  pedWays=pedWays.map(pts=>{const c=[0];for(let i=1;i<pts.length;i++)c.push(c[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));return {pts,cum:c,len:c[c.length-1]};}).filter(w=>w.len>6);
  pedGrid=new Map();pedEnds=new Map();const gk=(x,z,s)=>Math.floor(x/s)+","+Math.floor(z/s);
  pedWays.forEach((w,i)=>{const m=w.pts[Math.floor(w.pts.length/2)];const k=gk(m[0],m[1],200);if(!pedGrid.has(k))pedGrid.set(k,[]);pedGrid.get(k).push(i);
    for(const e of [0,1]){const p=e?w.pts[w.pts.length-1]:w.pts[0];const kk=gk(p[0],p[1],15);if(!pedEnds.has(kk))pedEnds.set(kk,[]);pedEnds.get(kk).push({i,e});}});
  const body=new T.CylinderGeometry(.2,.26,1.3,6).translate(0,.65,0),head=new T.SphereGeometry(.16,6,4).translate(0,1.5,0);
  pedBody=new T.InstancedMesh(body,new T.MeshStandardMaterial({color:0xffffff,roughness:.9}),NPED);pedHead=new T.InstancedMesh(head,new T.MeshStandardMaterial({color:0xffffff,roughness:.8}),NPED);
  pedBody.frustumCulled=pedHead.frustumCulled=false;scene.add(pedBody,pedHead);
  const shirts=[[.15,.2,.35],[.6,.1,.1],[.85,.85,.82],[.1,.1,.1],[.3,.45,.3],[.75,.6,.2],[.4,.25,.5],[.2,.5,.7]],skin=[[.96,.8,.66],[.78,.57,.42],[.55,.38,.27],[.36,.24,.17]];const r=rng(808);
  for(let i=0;i<NPED;i++){peds.push({w:null,d:0,dir:1,v:1.1+r()*.6,r:rng(5000+i)});pedBody.setColorAt(i,col.setRGB(...shirts[Math.floor(r()*shirts.length)]).convertSRGBToLinear());pedHead.setColorAt(i,col.setRGB(...skin[Math.floor(r()*skin.length)]).convertSRGBToLinear());}
}
function spawnPed(p,cx,cz,R){for(let tries=0;tries<6;tries++){const a=p.r()*Math.PI*2,d=Math.sqrt(p.r())*R;const x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;const list=pedGrid.get(Math.floor(x/200)+","+Math.floor(z/200));if(!list)continue;
    const act=cells?(cells.res[cellOf(x,z)]+cells.jobs[cellOf(x,z)]*1.6):1;if(p.r()>Math.min(1,.15+act/9000))continue;
    p.w=pedWays[list[Math.floor(p.r()*list.length)]];p.d=p.r()*p.w.len;p.dir=p.r()<.5?1:-1;return true;}p.w=null;return false;}
function updatePeds(dt){if(!pedBody)return;const camD=camera.position.distanceTo(controls.target);const t=controls.target;
  const hour=(ENV.hour==null?10:ENV.hour);const day=hour>=7&&hour<=21?1:hour>=5&&hour<=23?.45:.12;const show=camD<1600;const R=clamp(camD*1.1,250,1300);const n=show?Math.floor(NPED*day*(ENV.wx==="rain"||ENV.wx==="storm"?.55:1)*Math.min(1,Math.pow(R/1100,1.6)+.05)):0;const sc=clamp(camD/350,1,2.6);
  for(let i=0;i<NPED;i++){const p=peds[i];
    if(i>=n){if(p.vis){dummy.position.set(0,-999,0);dummy.scale.set(1e-4,1e-4,1e-4);dummy.updateMatrix();pedBody.setMatrixAt(i,dummy.matrix);pedHead.setMatrixAt(i,dummy.matrix);p.vis=false;}continue;}
    if(!p.w||(p.x!=null&&Math.hypot(p.x-t.x,p.z-t.z)>R*1.2)){if(!spawnPed(p,t.x,t.z,R)){continue;}}
    p.d+=p.dir*p.v*dt*1.6;
    if(p.d<0||p.d>p.w.len){const endP=p.d<0?p.w.pts[0]:p.w.pts[p.w.pts.length-1];const near=(pedEnds.get(Math.floor(endP[0]/15)+","+Math.floor(endP[1]/15))||[]).filter(o=>pedWays[o.i]!==p.w);
      if(near.length&&p.r()<.85){const o=near[Math.floor(p.r()*near.length)];p.w=pedWays[o.i];p.dir=o.e===0?1:-1;p.d=o.e===0?0:p.w.len;}else{p.dir*=-1;p.d=clamp(p.d,0,p.w.len);}}
    const w=p.w,c=w.cum;let lo=0,hi=c.length-1;while(lo<hi-1){const m=(lo+hi)>>1;if(c[m]<=p.d)lo=m;else hi=m;}const u=clamp((p.d-c[lo])/((c[hi]-c[lo])||1),0,1);const a=w.pts[lo],b=w.pts[hi];
    const x=lerp(a[0],b[0],u),z=lerp(a[1],b[1],u);p.x=x;p.z=z;const bob=Math.abs(Math.sin(p.d*3.2))*.05;
    dummy.position.set(x,elevAt(x,z)+.35+bob,z);dummy.quaternion.setFromAxisAngle(YV,-Math.atan2((b[1]-a[1])*p.dir,(b[0]-a[0])*p.dir));dummy.scale.set(sc,sc,sc);dummy.updateMatrix();pedBody.setMatrixAt(i,dummy.matrix);pedHead.setMatrixAt(i,dummy.matrix);p.vis=true;}
  pedBody.instanceMatrix.needsUpdate=true;pedHead.instanceMatrix.needsUpdate=true;}
function buildOSMRoads(){
  const G=RGRAPH;const pos={asph:[],hwy:[],walk:[],deck:[],side:[],svc:[]};const caps=[];
  const strip=(arr,pts,ys,wid)=>{ // flat ribbon following a polyline, mitred joints
    const n=pts.length;const L=[],R=[];
    for(let k=0;k<n;k++){const p=pts[k],a=pts[Math.max(0,k-1)],b=pts[Math.min(n-1,k+1)];let dx=b[0]-a[0],dz=b[1]-a[1];const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
      let m=1;if(k>0&&k<n-1){const d1=[p[0]-a[0],p[1]-a[1]],l1=Math.hypot(...d1)||1;const c=(d1[0]*dx+d1[1]*dz)/l1;m=1/Math.max(.5,c);}
      const ox=-dz*wid/2*m,oz=dx*wid/2*m;L.push([p[0]+ox,ys[k],p[1]+oz]);R.push([p[0]-ox,ys[k],p[1]-oz]);}
    for(let k=0;k<n-1;k++){const a=L[k],b=R[k],c=L[k+1],d=R[k+1];arr.push(...a,...b,...c,...b,...d,...c);}
    return [L,R];};
  const wall=(arr,E1,dy0,dy1)=>{for(let k=0;k<E1.length-1;k++){const a=E1[k],b=E1[k+1];arr.push(a[0],a[1]+dy0,a[2],b[0],b[1]+dy0,b[2],a[0],a[1]+dy1,a[2],b[0],b[1]+dy0,b[2],b[0],b[1]+dy1,b[2],a[0],a[1]+dy1,a[2]);}};
  // a bridge is often split into several OSM ways (approach spans, main span): give each connected chain one deck height
  {const par=new Map(),find=r=>{while(par.get(r)!==r){par.set(r,par.get(par.get(r)));r=par.get(r);}return r;};const at=new Map();
   for(const r of G.ways)if(r.fl&2){par.set(r,r);for(const p of [r.pts[0],r.pts[r.pts.length-1]]){const k=G.key(p);if(at.has(k)){const a=find(at.get(k)),b=find(r);if(a!==b)par.set(a,b);}else at.set(k,r);}}
   const hOf=r=>{let wet=false;for(let k=0;k<r.pts.length;k+=Math.max(1,Math.floor(r.pts.length/6)))if(clsAt(r.pts[k][0],r.pts[k][1])===0)wet=true;const m=r.pts[Math.floor(r.pts.length/2)];if(clsAt(m[0],m[1])===0)wet=true;
     return r.floating?1.6:wet?Math.max(r.layer*7,r.ty<=1?38:r.ty<=4?16:8):Math.max(r.layer>1?r.layer*6.5:0,isHwy(r)?9:r.ty===6?5:6.5);};
   const chainH=new Map();for(const r of par.keys()){const k=find(r);chainH.set(k,Math.max(chainH.get(k)||0,hOf(r)));}
   for(const r of par.keys())r.chainH=r.floating?1.6:chainH.get(find(r));}
  const bridgeEnds=new Map();for(const r of G.ways)if(r.fl&2)for(const end of [0,1]){const k=G.key(end?r.pts[r.pts.length-1]:r.pts[0]);bridgeEnds.set(k,(bridgeEnds.get(k)||0)+1);}
  const piers=[];
  for(const r of G.ways){
    if(r.fl&4||r.ty===7||r.pts.length<2)continue;if(!r.pts.some(p=>Math.abs(p[0])<EXT-20&&Math.abs(p[1])<EXT-20))continue;const w=r.w||roadW(r);
    if(r.fl&2){ // elevated deck
      const mid=r.pts[Math.floor(r.pts.length/2)];const wet=clsAt(mid[0],mid[1])===0;
      const H=r.chainH||(r.floating?1.6:wet?Math.max(r.layer*7,r.ty<=1?38:r.ty<=4?16:8):Math.max(r.layer>1?r.layer*6.5:0,isHwy(r)?9:r.ty===6?5:6.5));
      const cum=[0];for(let k=1;k<r.pts.length;k++)cum.push(cum[k-1]+Math.hypot(r.pts[k][0]-r.pts[k-1][0],r.pts[k][1]-r.pts[k-1][1]));const tot=cum[cum.length-1]||1;
      const c0=(bridgeEnds.get(G.key(r.pts[0]))||0)>1,c1=(bridgeEnds.get(G.key(r.pts[r.pts.length-1]))||0)>1;const tl=Math.min(tot/2,Math.max(40,H*11));
      const sm=u=>u*u*(3-2*u);
      r.base=r.pts.map(p=>Math.max(0,elevAt(p[0],p[1])));
      r.hs=cum.map(d=>H*Math.min(c0?1:sm(clamp(d/tl,0,1)),c1?1:sm(clamp((tot-d)/tl,0,1))));
      const ys=r.base.map((b,k)=>b+r.hs[k]+.3);
      const [L,R]=strip(pos.deck,r.pts,ys,w+1.2);wall(pos.side,L,-1.4,1.0);wall(pos.side,R,-1.4,1.0);
      for(let k=0;k<r.pts.length-1;k++){const a=r.pts[k],b=r.pts[k+1];const sl=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let d=(k?0:18);d<sl;d+=36){const t=d/sl,x=lerp(a[0],b[0],t),z=lerp(a[1],b[1],t),h=lerp(r.hs[k],r.hs[k+1],t);if(h>3.2&&!r.floating)piers.push([x,lerp(r.base[k],r.base[k+1],t),z,h-1.4,Math.max(2.2,w*.35),Math.atan2(b[1]-a[1],b[0]-a[0])]);}}
      continue;}
    if(r.ty===7||r.ty>9)continue;
    const dp=densify(r.pts,14);const ys=dp.map(p=>elevAt(p[0],p[1]));
    if(r.ty===6){strip(pos.svc,dp,ys.map(y=>y+.32),Math.max(3,w*.75));caps.push([r.pts[0],w*.375,2],[r.pts[r.pts.length-1],w*.375,2]);continue;}
    if(r.ty>=2&&r.ty<=5)strip(pos.walk,dp,ys.map(y=>y+.3),w+5);
    const hw=isHwy(r)||r.ty===8;strip(hw?pos.hwy:pos.asph,dp,ys.map(y=>y+.34),w);
    caps.push([r.pts[0],w/2,hw?1:0],[r.pts[r.pts.length-1],w/2,hw?1:0]);
    if(r.ty>=2&&r.ty<=5)caps.push([r.pts[0],w/2+2.5,3],[r.pts[r.pts.length-1],w/2+2.5,3]);
  }
  const mk=(arr,color,o)=>{if(!arr.length)return null;const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(arr,3));g.computeVertexNormals();
    const m=new T.Mesh(g,new T.MeshStandardMaterial(Object.assign({color:new T.Color(color).convertSRGBToLinear(),roughness:.92,metalness:0,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1},o||{})));m.receiveShadow=true;if(m.material.depthWrite===false)m.renderOrder=(o&&o.ro)||1;delete m.material.ro;scene.add(m);return m;};
  // flat road layers never fight each other: they skip the depth buffer and paint in a fixed order (sidewalk < service < street), still hidden by buildings
  const mw=mk(pos.walk,0xc4c1bb,{depthWrite:false,ro:1}),ma=mk(pos.asph,0x5d6168,{depthWrite:false,ro:3,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),mh=mk(pos.hwy,0x4c5056,{depthWrite:false,ro:3,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),ms=mk(pos.svc,0x8a8c90,{depthWrite:false,ro:2,polygonOffsetFactor:-1.5,polygonOffsetUnits:-1.5});
  // round caps at every way end close the notches where streets meet
  const cg=new T.CircleGeometry(1,18).rotateX(-Math.PI/2);
  [[0,ma,.34],[1,mh,.34],[2,ms,.32],[3,mw,.3]].forEach(([kind,src,dy])=>{const L=caps.filter(c=>c[2]===kind);if(!L.length||!src)return;const im=new T.InstancedMesh(cg,src.material,L.length);
    L.forEach(([p,rad],i)=>{dummy.position.set(p[0],elevAt(p[0],p[1])+dy,p[1]);dummy.quaternion.identity();dummy.scale.set(rad,1,rad);dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix);});im.receiveShadow=true;im.renderOrder=src.renderOrder;scene.add(im);});
  const dk=mk(pos.deck,0x52565c,{polygonOffset:false});if(dk)dk.castShadow=true;const sd=mk(pos.side,0xbdbab3,{polygonOffset:false});if(sd)sd.castShadow=true;
  if(piers.length){if(!GEOK.box)GEOK.box=new T.BoxGeometry(1,1,1);const im=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:new T.Color(0xb5b2ab).convertSRGBToLinear(),roughness:.9}),piers.length);
    piers.forEach(([x,y,z,h,wd,a],i)=>{dummy.position.set(x,y+h/2,z);dummy.quaternion.setFromAxisAngle(YV,-a);dummy.scale.set(2.2,h,wd);dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix);});
    im.castShadow=true;im.receiveShadow=true;scene.add(im);}
  buildTunnels();buildSports();buildPaths();buildRail3D();
  E.roadStats={walk:pos.walk.length/9,deckTris:pos.deck.length/9,piers:piers.length};
}
function trimLine(pts,d){const L=polyLen(pts);if(L<2*d+6)return null;const at=t=>{let acc=0;for(let k=0;k<pts.length-1;k++){const a=pts[k],b=pts[k+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(acc+l>=t){const u=(t-acc)/(l||1);return [k,[lerp(a[0],b[0],u),lerp(a[1],b[1],u)]];}acc+=l;}return [pts.length-2,pts[pts.length-1]];};
  const [i0,p0]=at(d),[i1,p1]=at(L-d);return [p0,...pts.slice(i0+1,i1+1),p1];}
function buildOSMMarkings(){
  const solid=[],dash=[],zebra=[];
  const quad=(arr,x,z,len,wid,ang)=>{arr.push([x,z,len,wid,ang]);};
  const piece=(arr,x0,z0,x1,z1,wid,off)=>{const L=Math.hypot(x1-x0,z1-z0);const n=Math.max(1,Math.ceil(L/8));const ang=Math.atan2(z1-z0,x1-x0);const ox=-Math.sin(ang)*off,oz=Math.cos(ang)*off;for(let k=0;k<n;k++){const ax=x0+(x1-x0)*k/n+ox,az=z0+(z1-z0)*k/n+oz,bx=x0+(x1-x0)*(k+1)/n+ox,bz=z0+(z1-z0)*(k+1)/n+oz;quad(arr,(ax+bx)/2,(az+bz)/2,L/n,wid,ang);}};
  for(const r of RGRAPH.ways){if(r.fl&6||r.ty>=5)continue;const lanes=r.lanes||RT_LANES[r.ty];const one=r.fl&1;const tp=trimLine(r.pts,r.w*.5+5);if(!tp)continue;
    for(let k=0;k<tp.length-1;k++){const [x0,z0]=tp[k],[x1,z1]=tp[k+1];
      if(isHwy(r)){for(let q=1;q<lanes;q++)piece(dash,x0,z0,x1,z1,.15,(q-lanes/2)*3.3);piece(solid,x0,z0,x1,z1,.15,lanes*1.65-.3);piece(solid,x0,z0,x1,z1,.15,-lanes*1.65+.3);continue;}
      if(!one){piece(solid,x0,z0,x1,z1,.13,.17);piece(solid,x0,z0,x1,z1,.13,-.17);const per=Math.floor(lanes/2);for(let q=1;q<per;q++){piece(dash,x0,z0,x1,z1,.13,q*3.3);piece(dash,x0,z0,x1,z1,.13,-q*3.3);}}
      else for(let q=1;q<lanes;q++)piece(dash,x0,z0,x1,z1,.13,(q-lanes/2)*3.3);
    }}
  // crosswalks where three or more city streets meet
  for(const [,list] of RGRAPH.node){const st=list.filter(o=>o.r.ty>=2&&o.r.ty<=5&&!(o.r.fl&6));if(st.length<3||zebra.length>14000)continue;if(!st.some(o=>o.r.ty<=4))continue;
    for(const o of st){const pts=o.r.pts,i0=o.end?pts.length-1:0,i1=o.end?pts.length-2:1;const a=pts[i0],b=pts[i1];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<14)continue;const ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;const off=Math.max(5,o.r.w*.5+2.5);
      quad(zebra,a[0]+ux*off,a[1]+uz*off,o.r.w-2,3,Math.atan2(uz,ux)+Math.PI/2);}}
  const pg=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  for(const [arr,mat] of [[solid,MAT.yellow],[dash,MAT.white],[zebra,MAT.zebra]]){if(!arr.length)continue;const m=new T.InstancedMesh(pg,mat,arr.length);arr.forEach((q,i)=>{dummy.position.set(q[0],elevAt(q[0],q[1])+.42,q[1]);dummy.quaternion.setFromAxisAngle(YV,-q[4]);dummy.scale.set(q[2],1,q[3]);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);});m.renderOrder=5;m.material.depthWrite=false;cityG.add(m);}
  E.markCount=solid.length+dash.length+zebra.length;
}
function osmNamedPaths(){
  const by=new Map();for(const r of RGRAPH.ways){if(!r.n||r.ty>4||(r.fl&4))continue;if(!by.has(r.n))by.set(r.n,{ways:[],hwy:false});const g=by.get(r.n);g.ways.push(r);if(isHwy(r))g.hwy=true;}
  const out=[];
  for(const [name,g] of by){const pts=[];for(const r of g.ways)for(const p of r.pts)pts.push(p);if(pts.length<2)continue;
    let mx=0,mz=0;for(const p of pts){mx+=p[0];mz+=p[1];}mx/=pts.length;mz/=pts.length;let sxx=0,sxz=0,szz=0;for(const p of pts){const dx=p[0]-mx,dz=p[1]-mz;sxx+=dx*dx;sxz+=dx*dz;szz+=dz*dz;}
    const ang=.5*Math.atan2(2*sxz,sxx-szz),ux=Math.cos(ang),uz=Math.sin(ang);const pr=pts.map(p=>[(p[0]-mx)*ux+(p[1]-mz)*uz,-(p[0]-mx)*uz+(p[1]-mz)*ux,p]).sort((a,b)=>a[0]-b[0]);
    const ext=pr[pr.length-1][0]-pr[0][0];if(ext<1500)continue;let spread=0;for(const q of pr)spread+=q[1]*q[1];spread=Math.sqrt(spread/pr.length);if(spread>ext*.12)continue;
    const path=[];const stp=Math.max(1,Math.floor(pr.length/24));for(let k=0;k<pr.length;k+=stp)path.push(pr[k][2]);if(path[path.length-1]!==pr[pr.length-1][2])path.push(pr[pr.length-1][2]);
    out.push({name,pts:path,len:polyLen(path),hwy:g.hwy});}
  return out;
}
function osmFindSites(n,opts){
  const r=opts.rng||Math.random,out=[];const cand=[];
  for(let i=0;i<B.length;i++){const b=B[i];if(!b.osm||b.rm||b.ad||b.part||b.blk>=0||b.A<260||b.u==="c"||b.u==="x")continue;const core=coreAt(b.x,b.z)*(C.hMul||1);if(core<(opts.minCore||25))continue;cand.push(i);}
  for(let t=0;t<300&&out.length<n&&cand.length;t++){
    const b=B[cand[Math.floor(r()*cand.length)]];const core=coreAt(b.x,b.z)*(C.hMul||1);const hm=C.base+core;
    if(opts.underbuilt!==false&&b.yo+b.h>hm*.6)continue;
    if(C._lms.some(q=>(b.x-q[0])**2+(b.z-q[1])**2<(q[2]+40)**2))continue;
    const W=clamp(Math.max(b.w,46),46,72),Dd=clamp(Math.max(b.d,46),46,72);const ca=Math.cos(b.a),sa=Math.sin(b.a);
    const mem=[];let mx=0,bad=false;
    for(let j=0;j<B.length;j++){const q=B[j];if(!q.osm||q.rm||q.kid)continue;const dx=q.x-b.x,dz=q.z-b.z;if(Math.abs(dx)>80||Math.abs(dz)>80)continue;const u=dx*ca+dz*sa,v=-dx*sa+dz*ca;if(Math.abs(u)<W/2&&Math.abs(v)<Dd/2){mem.push(j);mx=Math.max(mx,q.yo+q.h);if(q.yo+q.h>hm*.9||q.blk>=0)bad=true;}}
    if(bad||!mem.length)continue;
    const id=blocks.length;blocks.push({id,cx:b.x,cz:b.z,W:W+8,Dd:Dd+8,a:b.a,core,osm:true,lm:false,used:false});for(const j of mem)B[j].blk=id;
    out.push({x:b.x,z:b.z,a:b.a,W:W+8,D:Dd+8,blk:id,existingMax:mx,hm,street:E.streetNameAt(b.x,b.z),hood:E.hoodAt(b.x,b.z)});
  }
  return out;
}
function osmStreetName(x,z){
  let best=null,bd=1e9,second=null,sd=1e9;const i0=Math.floor((x+EXT)/500),j0=Math.floor((z+EXT)/500);
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const arr=anchorGrid.get((i0+dx)+","+(j0+dz));if(!arr)continue;for(const a of arr){const d=Math.hypot(a.x-x,a.z-z);if(d<bd){if(best&&best.name!==a.name){second=best;sd=bd;}bd=d;best=a;}else if(d<sd&&best&&a.name!==best.name){sd=d;second=a;}}}
  if(best&&second&&bd<160&&sd<220)return best.name+" & "+second.name;
  return best&&bd<450?"near "+best.name:null;
}
function osmTowerCounts(){
  const tall=B.filter(b=>b.osm&&!b.rm&&b.yo+b.h>=100).map(b=>({x:b.x,z:b.z,t:b.yo+b.h})).sort((a,b)=>b.t-a.t);const reps=[];
  for(const q of tall){if(reps.some(p=>(p.x-q.x)**2+(p.z-q.z)**2<45*45))continue;reps.push(q);}
  for(const b of B)if(b.ad&&!b.rm&&b.tw!=null){}
  return {c150:reps.filter(p=>p.t>=150).length,c100:reps.length};
}

/* ---------- loop ---------- */
let last=performance.now(),frameNo=0;E.onFrame=null;E.carShare=.8;E.ttiGrid=null;
function loop(now){if(water&&water.material.uniforms)water.material.uniforms.time.value=(now||0)/1000;
  const dt=Math.min(.05,(now-last)/1000);last=now;frameNo++;
  if(renderer&&E.ready){
    if(flyAnim){const t=clamp((now-flyAnim.s)/flyAnim.d,0,1),e=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;controls.target.lerpVectors(flyAnim.t0,flyAnim.t1,e);camera.position.lerpVectors(flyAnim.c0,flyAnim.c1,e);if(t>=1)flyAnim=null;}
    navKeys(dt);
    const t=controls.target;t.x=clamp(t.x,-EXT+50,EXT-50);t.z=clamp(t.z,-EXT+50,EXT-50);
    controls.update();
    {const ge=elevV?Math.max(0,elevAt(clamp(camera.position.x,-EXT,EXT),clamp(camera.position.z,-EXT,EXT))):0;if(camera.position.y<ge+12)camera.position.y=ge+12;}
    const dist=camera.position.distanceTo(t);const half=clamp(dist*1.1,500,5200);const sc=sun.shadow.camera;if(Math.abs(sc.right-half)>1){sc.left=-half;sc.right=half;sc.top=half;sc.bottom=-half;sc.near=10;sc.far=14000;sc.updateProjectionMatrix();}
    const sv=E._sunV||new T.Vector3(.3,.8,.4);sun.position.set(t.x+sv.x*6000,sv.y*6000,t.z+sv.z*6000);sun.target.position.set(t.x,0,t.z);
    skyMesh.position.copy(camera.position);
    updateCars(dt,E.ttiGrid,E.carShare);if(OSM){updatePeds(dt);updateTrains(dt);}
    if(rain.visible){const p=rain.geometry.attributes.position.array;for(let i=0;i<RN;i++){const o=i*6;let y=p[o+1]-dt*900;if(y<0)y+=1100;p[o+1]=y;p[o+4]=y-24;}rain.geometry.attributes.position.needsUpdate=true;rain.position.set(t.x,0,t.z);}
    if(snow.visible){const p=snow.geometry.attributes.position.array;for(let i=0;i<SN;i++){const o=i*3;let y=p[o+1]-dt*60;if(y<0)y+=1100;p[o+1]=y;p[o]+=Math.sin(now/900+i)*dt*8;}snow.geometry.attributes.position.needsUpdate=true;snow.position.set(t.x,0,t.z);}
    if(E.onFrame)E.onFrame(dt);
    renderer.render(scene,camera);
    {const c=camera.position,key=c.x.toFixed(1)+","+c.y.toFixed(1)+","+c.z.toFixed(1)+","+controls.target.x.toFixed(1)+","+controls.target.z.toFixed(1);
     if(key!==lblCam){lblCam=key;lblMoveT=now;}
     const moving=now-lblMoveT<180;
     if((!moving&&now-lastLbl>120&&lastLbl<lblMoveT+180)||now-lastLbl>(moving?700:1500)){lastLbl=now;placeLabels();}else trackLabels();}
  }
  requestAnimationFrame(loop);
}
})();
