# Footpaths, cycleways and rail (with bridge/tunnel/layer) -> out/{city}_areas.json.gz  ("paths", "rail2")
import gzip,json,sys,os
sys.argv=[sys.argv[0]];import fetch_osm as F
def num(v):
    try:return float(str(v).split(";")[0])
    except:return 0
for key in (os.environ.get("CITY") or "sea nyc").split():
    lat0,lon0=F.CITIES[key];kx,(s,w,n,e)=F.frame(lat0,lon0);bb=f"{s:.5f},{w:.5f},{n:.5f},{e:.5f}"
    q16=lambda v:max(-32767,min(32767,int(round(v*F.Q))))
    d=F.cached(f"raw/{key}/paths.json.gz",f'[out:json][timeout:300];way["highway"~"^(footway|path|cycleway|steps|pedestrian|track|bridleway)$"]["footway"!~"^(sidewalk|crossing)$"]({bb});out tags geom qt;')
    KIND={"footway":0,"path":0,"pedestrian":0,"steps":1,"cycleway":2,"track":3,"bridleway":3}
    paths=[]
    for el in d["elements"]:
        t=el.get("tags",{});g=el.get("geometry")
        if not g or len(g)<2:continue
        k=KIND.get(t.get("highway"),0)
        if t.get("bicycle")=="designated" and k==0:k=2
        fl=(1 if t.get("bridge") not in (None,"no") else 0)|(2 if t.get("tunnel") not in (None,"no") or num(t.get("layer"))<0 else 0)
        pts=F.dp([F.P(lat0,lon0,kx,q["lat"],q["lon"]) for q in g],0.6)
        paths.append([k,fl,[c for x,z in pts for c in (q16(x),q16(z))]])
    r=F.cached(f"raw/{key}/rail2.json.gz",f'[out:json][timeout:300];way["railway"~"^(rail|light_rail|subway|tram|monorail|narrow_gauge|funicular)$"]({bb});out tags geom qt;')
    rail=[]
    for el in r["elements"]:
        t=el.get("tags",{});g=el.get("geometry")
        if not g or len(g)<2:continue
        if t.get("service") in ("yard","spur","siding","crossover") and t.get("railway")=="rail":sv=1
        else:sv=0
        br=1 if t.get("bridge") not in (None,"no") else 0
        tu=1 if t.get("tunnel") not in (None,"no") or num(t.get("layer"))<0 else 0
        lay=int(max(0,min(7,num(t.get("layer")))))
        pts=F.dp([F.P(lat0,lon0,kx,q["lat"],q["lon"]) for q in g],0.6)
        rail.append([t.get("railway"),tu,br,lay,sv,[c for x,z in pts for c in (q16(x),q16(z))]])
    path=f"out/{key}_areas.json.gz";A=json.load(gzip.open(path,"rt"));A["paths"]=paths;A["rail2"]=rail
    with gzip.open(path,"wt",compresslevel=9) as f:json.dump(A,f,separators=(",",":"))
    F.log(key,"paths",len(paths),"rail",len(rail),"elevated rail",sum(1 for x in rail if x[2]))
