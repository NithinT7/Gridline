# Extend NYC to all of Manhattan: old 10 km frame tiles + northern tiles, merged into raw/nycbig/, filtered to coverage.
import gzip,json,os,sys,math
os.environ.setdefault("EXT","11000");os.environ.setdefault("QSCALE","2")
sys.argv=[sys.argv[0]];import fetch_osm as F
S,W,N,E=40.775,-74.035,40.886,-73.895   # northern block: upper Manhattan, south Bronx, Palisades
OLD=(40.735,-73.990)
def tiles(nx,ny):
    for i in range(ny):
        for j in range(nx):yield i*nx+j,(S+(N-S)*i/ny,W+(E-W)*j/nx,S+(N-S)*(i+1)/ny,W+(E-W)*(j+1)/nx)
os.makedirs("raw/nycbig",exist_ok=True)
for k,(a,b,c,d) in tiles(3,3):
    bb=f"{a:.5f},{b:.5f},{c:.5f},{d:.5f}";F.log("north buildings",k+1,"/9")
    F.cached(f"raw/nyc/n{k}.json.gz",f'[out:json][timeout:300];(way["building"]({bb});rel["building"]["type"="multipolygon"]({bb});way["building:part"]({bb}););out tags geom qt;')
bb=f"{S:.5f},{W:.5f},{N:.5f},{E:.5f}"
Q={"roads":'way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|service|pedestrian)$"]({bb});',
 "parks":'(way["leisure"~"^(park|garden|playground|pitch|golf_course|nature_reserve)$"]({bb});rel["leisure"~"^(park|garden|golf_course|nature_reserve)$"]({bb});way["landuse"~"^(grass|recreation_ground|forest|meadow|cemetery|village_green)$"]({bb});rel["landuse"~"^(grass|recreation_ground|forest|cemetery)$"]({bb});way["natural"~"^(wood|scrub|grassland|beach|sand)$"]({bb}););',
 "water":'(way["natural"="water"]({bb});rel["natural"="water"]({bb});way["waterway"="riverbank"]({bb});rel["waterway"="riverbank"]({bb});way["natural"="coastline"]({bb}););',
 "rail":'way["railway"~"^(rail|light_rail|subway|tram|monorail)$"]({bb});',
 "water2":'(way["natural"="water"]({bb});rel["natural"="water"]({bb});way["waterway"="riverbank"]({bb});rel["waterway"="riverbank"]({bb});way["natural"="bay"]({bb});rel["natural"="bay"]["type"="multipolygon"]({bb}););',
 "sports":'(way["leisure"~"^(pitch|track|stadium|sports_centre)$"]({bb});rel["leisure"~"^(pitch|track)$"]({bb});way["amenity"~"^(school|college|university|kindergarten)$"]({bb});rel["amenity"~"^(school|college|university)$"]({bb});way["landuse"="education"]({bb}););',
 "paths":'way["highway"~"^(footway|path|cycleway|steps|pedestrian|track|bridleway)$"]["footway"!~"^(sidewalk|crossing)$"]({bb});',
 "rail2":'way["railway"~"^(rail|light_rail|subway|tram|monorail|narrow_gauge|funicular)$"]({bb});'}
BODY={"water2","sports"}
for name,q in Q.items():
    F.log("north",name);F.cached(f"raw/nyc/{name}_n.json.gz",f'[out:json][timeout:300];{q.format(bb=bb)}out {"body" if name in BODY else "tags"} geom qt;')
# ---- merge into raw/nycbig with a coverage filter
kxo=111320*math.cos(math.radians(OLD[0]))
def inOld(la,lo):return abs((lo-OLD[1])*kxo)<5300 and abs((OLD[0]-la)*F.KZ)<5300
def inNorth(la,lo):return S<=la<=N and W<=lo<=E
def cen(el):
    g=el.get("geometry") or [p for m in el.get("members",[]) for p in (m.get("geometry") or [])]
    if not g:b=el.get("bounds");return ((b["minlat"]+b["maxlat"])/2,(b["minlon"]+b["maxlon"])/2) if b else None
    return (sum(p["lat"] for p in g)/len(g),sum(p["lon"] for p in g)/len(g))
def keep(el):
    c=cen(el)
    if not c:return True
    t=el.get("tags",{})
    if t.get("natural")=="coastline" or t.get("highway") in("motorway","trunk","motorway_link"):return True
    return inOld(*c) or inNorth(*c)
def merge(files,out):
    if os.path.exists(out) and not os.environ.get("FORCE"):return
    seen=set();els=[]
    for f in files:
        if not os.path.exists(f):continue
        for el in json.load(gzip.open(f,"rt")).get("elements",[]):
            u=(el["type"],el["id"])
            if u in seen or not keep(el):continue
            seen.add(u);els.append(el)
    json.dump({"elements":els},gzip.open(out,"wt"));F.log("merged",out,len(els))
olds=[f"raw/nyc/b{k}.json.gz" for k in range(16)];news=[f"raw/nyc/n{k}.json.gz" for k in range(9)]
allb=olds+news
for k in range(16):merge([allb[i] for i in range(len(allb)) if i%16==k],f"raw/nycbig/b{k}.json.gz")
for name in Q:merge([f"raw/nyc/{name}.json.gz",f"raw/nyc/{name}_n.json.gz"],f"raw/nycbig/{name}.json.gz")
F.log("NYC BIG RAW READY")
# real tree positions (street trees, park trees)
for key,bbx in [("nycbig",None),("sea",None)]:
    lat0,lon0=F.CITIES[key];kx,(s,w,n,e)=F.frame(lat0,lon0)
    if key=="sea":kx=111320*math.cos(math.radians(lat0));d0=5300;s,n,w,e=lat0-d0/F.KZ,lat0+d0/F.KZ,lon0-d0/kx,lon0+d0/kx
    for i in range(2):
        for j in range(2):
            bb=f"{s+(n-s)*i/2:.5f},{w+(e-w)*j/2:.5f},{s+(n-s)*(i+1)/2:.5f},{w+(e-w)*(j+1)/2:.5f}"
            F.log("trees",key,i*2+j);F.cached(f"raw/{key}/trees{i*2+j}.json.gz",f'[out:json][timeout:300];node["natural"="tree"]({bb});out skel qt;')
F.log("TREES READY")
