#!/usr/bin/env python3
"""Download OpenStreetMap buildings, roads, parks and water for Gridline's five city frames
and pack them into compact files (coordinates in local meters, 0.25 m units)."""
import json, math, os, struct, sys, time, gzip, urllib.request, urllib.parse
UA="GridlineMayor/1.0 (personal city-sim prototype; low volume)"
EP="https://overpass-api.de/api/interpreter"
CITIES={"nyc":(40.735,-73.990),"chi":(41.885,-87.635),"sf":(37.785,-122.415),"sea":(47.610,-122.330),"sd":(32.715,-117.160),"nycbig":(40.785,-73.968)}
T0=time.time();BUDGET=float(os.environ.get("BUDGET","1e9"))
class Out(Exception):pass
def left():return BUDGET-(time.time()-T0)
EXT=float(os.environ.get("EXT","5000")); KZ=110540.0; Q=float(os.environ.get("QSCALE","4"))  # quantization: 0.25 m
def log(*a):print(time.strftime("%H:%M:%S"),*a,flush=True)
def query(q,tries=12):
    wait=15
    for t in range(tries):
        if left()<25:raise Out()
        try:
            req=urllib.request.Request(EP,data=urllib.parse.urlencode({"data":q}).encode(),headers={"User-Agent":UA,"Accept-Encoding":"gzip"})
            with urllib.request.urlopen(req,timeout=max(10,left()-8)) as r:
                raw=r.read()
                if r.headers.get("Content-Encoding")=="gzip":raw=gzip.decompress(raw)
                return json.loads(raw)
        except Exception as e:
            code=getattr(e,"code",None);log("  retry",t+1,code or e.__class__.__name__,"wait",wait)
            if left()<wait+25:raise Out()
            time.sleep(wait);wait=min(120,wait*2)
    raise RuntimeError("query failed")
def frame(lat0,lon0):
    kx=111320*math.cos(math.radians(lat0));dlat=(EXT+300)/KZ;dlon=(EXT+300)/kx
    return kx,(lat0-dlat,lon0-dlon,lat0+dlat,lon0+dlon)
def cached(path,q):
    if os.path.exists(path):
        with gzip.open(path,"rt") as f:return json.load(f)
    d=query(q)
    with gzip.open(path,"wt") as f:json.dump(d,f)
    time.sleep(2);return d
def run(key):
    lat0,lon0=CITIES[key];kx,(s,w,n,e)=frame(lat0,lon0)
    os.makedirs("raw/"+key,exist_ok=True)
    N=4;tiles=[]
    for i in range(N):
        for j in range(N):
            tiles.append((s+(n-s)*i/N,w+(e-w)*j/N,s+(n-s)*(i+1)/N,w+(e-w)*(j+1)/N))
    for k,(a,b,c,d) in enumerate(tiles):
        bb=f"{a:.5f},{b:.5f},{c:.5f},{d:.5f}"
        log(key,"buildings tile",k+1,"/",len(tiles))
        cached(f"raw/{key}/b{k}.json.gz",f'[out:json][timeout:300];(way["building"]({bb});rel["building"]["type"="multipolygon"]({bb});way["building:part"]({bb}););out tags geom qt;')
    bb=f"{s:.5f},{w:.5f},{n:.5f},{e:.5f}"
    log(key,"roads");cached(f"raw/{key}/roads.json.gz",f'[out:json][timeout:300];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|service|pedestrian)$"]({bb});out tags geom qt;')
    log(key,"parks");cached(f"raw/{key}/parks.json.gz",f'[out:json][timeout:300];(way["leisure"~"^(park|garden|playground|pitch|golf_course|nature_reserve)$"]({bb});rel["leisure"~"^(park|garden|golf_course|nature_reserve)$"]({bb});way["landuse"~"^(grass|recreation_ground|forest|meadow|cemetery|village_green)$"]({bb});rel["landuse"~"^(grass|recreation_ground|forest|cemetery)$"]({bb});way["natural"~"^(wood|scrub|grassland|beach|sand)$"]({bb}););out tags geom qt;')
    log(key,"water");cached(f"raw/{key}/water.json.gz",f'[out:json][timeout:300];(way["natural"="water"]({bb});rel["natural"="water"]({bb});way["waterway"="riverbank"]({bb});rel["waterway"="riverbank"]({bb});way["natural"="coastline"]({bb}););out tags geom qt;')
    log(key,"rail");cached(f"raw/{key}/rail.json.gz",f'[out:json][timeout:300];way["railway"~"^(rail|light_rail|subway|tram|monorail)$"]({bb});out tags geom qt;')
    pack(key,lat0,lon0,kx)
def P(lat0,lon0,kx,la,lo):return ((lo-lon0)*kx,(lat0-la)*KZ)
def dp(pts,eps):
    if len(pts)<4:return pts
    a,b=pts[0],pts[-1];dx,dz=b[0]-a[0],b[1]-a[1];L=math.hypot(dx,dz) or 1e-9
    mi,md=0,0
    for i in range(1,len(pts)-1):
        p=pts[i];d=abs(dx*(a[1]-p[1])-dz*(a[0]-p[0]))/L
        if d>md:mi,md=i,d
    if md>eps:return dp(pts[:mi+1],eps)[:-1]+dp(pts[mi:],eps)
    return [a,b]
def num(v):
    if v is None:return None
    try:
        v=v.replace(",",".").strip().lower()
        f=v.split(";")[0].split()[0].replace("m","")
        x=float(f)
        if "'" in v or "ft" in v:x*=0.3048
        return x
    except Exception:return None
RES={"house","apartments","residential","detached","terrace","semidetached_house","dormitory","bungalow","townhouse","static_caravan","houseboat"}
OFF={"commercial","office"};RET={"retail","supermarket","kiosk","mall"};IND={"industrial","warehouse","manufacture","factory","hangar","depot","storage_tank","service"}
CIV={"school","university","college","hospital","church","cathedral","chapel","mosque","synagogue","temple","public","government","civic","train_station","transportation","stadium","sports_hall","museum","library","fire_station","police","kindergarten","sports_centre","grandstand","courthouse","townhall"}
SMALL={"garage","garages","parking","shed","roof","carport","hut","greenhouse","bunker","toilets","kiosk","container"}
def btype(t):
    b=(t.get("building") or t.get("building:part") or "yes").lower()
    if b in RES:return 1
    if b in OFF:return 2
    if b in RET:return 3
    if b in IND:return 4
    if b in CIV or t.get("amenity") in ("school","university","hospital","place_of_worship","library","townhall"):return 5
    if b=="hotel" or t.get("tourism")=="hotel":return 6
    if b in SMALL:return 7
    if b=="construction":return 8
    if t.get("office") or t.get("shop"):return 2 if t.get("office") else 3
    return 0
def rings_of(el):
    if el["type"]=="way":
        g=el.get("geometry");return [g] if g else []
    out=[]
    for m in el.get("members",[]):
        if m.get("role")=="outer" and m.get("geometry"):out.append(m["geometry"])
    return out
def ring_xy(lat0,lon0,kx,g,eps):
    pts=[P(lat0,lon0,kx,q["lat"],q["lon"]) for q in g]
    if len(pts)>2 and pts[0]==pts[-1]:pts=pts[:-1]
    if len(pts)>4:
        a=pts[0];m=max(range(len(pts)),key=lambda i:(pts[i][0]-a[0])**2+(pts[i][1]-a[1])**2)
        pts=dp(pts[:m+1],eps)[:-1]+dp(pts[m:]+[a],eps)[:-1]
    return pts
def area(p):return 0.5*sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p)))
def inside(x,z,p):
    c=False;j=len(p)-1
    for i in range(len(p)):
        a,b=p[i],p[j]
        if (a[1]>z)!=(b[1]>z) and x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]:c=not c
        j=i
    return c
def pack(key,lat0,lon0,kx):
    log(key,"packing")
    seen=set();bl=[];parts=[]
    for k in range(16):
        with gzip.open(f"raw/{key}/b{k}.json.gz","rt") as f:d=json.load(f)
        for el in d.get("elements",[]):
            uid=(el["type"],el["id"])
            if uid in seen:continue
            seen.add(uid);t=el.get("tags",{})
            for g in rings_of(el):
                p=ring_xy(lat0,lon0,kx,g,0.35)
                if len(p)<3:continue
                A=area(p)
                if abs(A)<12:continue
                if A<0:p=p[::-1]
                cx=sum(q[0] for q in p)/len(p);cz=sum(q[1] for q in p)/len(p)
                if abs(cx)>EXT or abs(cz)>EXT:continue
                h=num(t.get("height"));mh=num(t.get("min_height"));lv=num(t.get("building:levels"));mlv=num(t.get("building:min_level"))
                if h is None and t.get("roof:height") is None and lv is not None:h=lv*3.4+(num(t.get("roof:levels")) or 0)*2
                if mh is None and mlv is not None:mh=mlv*3.4
                rec={"p":p,"h":h,"mh":mh or 0,"lv":lv,"t":btype(t),"part":"building:part" in t and "building" not in t,"c":(cx,cz),"A":abs(A)}
                (parts if rec["part"] else bl).append(rec)
    # outlines that contain parts are drawn as their parts instead
    grid={}
    for i,b in enumerate(bl):
        xs=[q[0] for q in b["p"]];zs=[q[1] for q in b["p"]]
        b["bb"]=(min(xs),min(zs),max(xs),max(zs))
        for gx in range(int(b["bb"][0]//100),int(b["bb"][2]//100)+1):
            for gz in range(int(b["bb"][1]//100),int(b["bb"][3]//100)+1):grid.setdefault((gx,gz),[]).append(i)
    for pt in parts:
        x,z=pt["c"]
        for i in grid.get((int(x//100),int(z//100)),[]):
            b=bl[i];bb=b["bb"]
            if bb[0]<=x<=bb[2] and bb[1]<=z<=bb[3] and inside(x,z,b["p"]):
                b["hasParts"]=True
                if pt["t"]==0:pt["t"]=b["t"]
                break
    out=bytearray(b"GLB1")+struct.pack("<I",0);n=0;known=0
    def q16(v):return max(-32767,min(32767,int(round(v*Q))))
    for b in bl+parts:
        if b.get("hasParts"):continue
        p=b["p"]
        if len(p)>2000:p=p[:2000]
        h=b["h"];hd=int(max(0,min(65000,round(h*10)))) if h else 0
        if hd:known+=1
        lv=int(max(0,min(255,b["lv"]))) if b["lv"] else 0
        out+=struct.pack("<HHHBBBB",len(p),hd,int(max(0,min(65000,round((b["mh"] or 0)*10)))),lv,b["t"],1 if b["part"] else 0,0)
        for x,z in p:out+=struct.pack("<hh",q16(x),q16(z))
        n+=1
    out[4:8]=struct.pack("<I",n)
    os.makedirs("out",exist_ok=True)
    with gzip.open(f"out/{key}_buildings.bin.gz","wb",compresslevel=9) as f:f.write(bytes(out))
    log(key,"buildings",n,"with height",known,"parts",len(parts))
    # roads
    with gzip.open(f"raw/{key}/roads.json.gz","rt") as f:d=json.load(f)
    TY={"motorway":0,"trunk":1,"primary":2,"secondary":3,"tertiary":4,"unclassified":5,"residential":5,"living_street":5,"service":6,"pedestrian":7,"motorway_link":8,"trunk_link":8,"primary_link":9,"secondary_link":9,"tertiary_link":9}
    names=[];nidx={};ways=[]
    for el in d.get("elements",[]):
        t=el.get("tags",{});g=el.get("geometry")
        if not g:continue
        ty=TY.get(t.get("highway"),5)
        if ty==6 and t.get("service") in ("parking_aisle","driveway","drive-through"):continue
        nm=t.get("name") or t.get("ref") or ""
        if nm not in nidx:nidx[nm]=len(names);names.append(nm)
        pts=dp([P(lat0,lon0,kx,q["lat"],q["lon"]) for q in g],0.8)
        lanes=num(t.get("lanes"));lanes=int(lanes) if lanes else 0
        fl=(1 if t.get("oneway") in ("yes","1","true") or t.get("junction")=="roundabout" else 0)|(2 if t.get("bridge") not in (None,"no") else 0)|(4 if t.get("tunnel") not in (None,"no") or (num(t.get("layer")) or 0)<0 else 0)
        ways.append([ty,lanes,fl,nidx[nm],[c for x,z in pts for c in (q16(x),q16(z))]])
    with gzip.open(f"out/{key}_roads.json.gz","wt",compresslevel=9) as f:json.dump({"names":names,"ways":ways},f,separators=(",",":"))
    log(key,"roads",len(ways))
    def polys(fname,kind):
        with gzip.open(f"raw/{key}/{fname}","rt") as f:d=json.load(f)
        res=[];lines=[]
        for el in d.get("elements",[]):
            t=el.get("tags",{})
            if t.get("natural")=="coastline":
                g=el.get("geometry")
                if g:lines.append([c for q in g for c in map(q16,P(lat0,lon0,kx,q["lat"],q["lon"]))])
                continue
            for g in rings_of(el):
                p=ring_xy(lat0,lon0,kx,g,1.0)
                if len(p)<3 or abs(area(p))<80:continue
                sub=t.get("leisure") or t.get("landuse") or t.get("natural") or t.get("waterway") or ""
                res.append([sub,[c for x,z in p for c in (q16(x),q16(z))]])
        return res,lines
    pk,_=polys("parks.json.gz","park");wt,coast=polys("water.json.gz","water")
    with gzip.open(f"raw/{key}/rail.json.gz","rt") as f:d=json.load(f)
    rail=[[el["tags"].get("railway"),1 if el["tags"].get("tunnel") not in (None,"no") else 0,[c for q in el["geometry"] for c in map(q16,P(lat0,lon0,kx,q["lat"],q["lon"]))]] for el in d.get("elements",[]) if el.get("geometry")]
    with gzip.open(f"out/{key}_areas.json.gz","wt",compresslevel=9) as f:json.dump({"parks":pk,"water":wt,"coast":coast,"rail":rail},f,separators=(",",":"))
    log(key,"parks",len(pk),"water",len(wt),"coast",len(coast),"rail",len(rail))
if __name__=="__main__":
    for k in (sys.argv[1:] or ["sea","sd","sf","chi","nyc"]):
        if os.path.exists(f"out/{k}_areas.json.gz") and not os.environ.get("FORCE"):continue
        try:run(k)
        except Out:log("time budget reached; rerun to continue");sys.exit(3)
        except Exception as e:log(k,"FAILED",e)
    log("ALL DONE")
