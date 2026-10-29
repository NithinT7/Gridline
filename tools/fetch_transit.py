import json,os,sys,math,gzip,time
from fetch_osm import query,CITIES,KZ,log
R=22000.0
def run(key):
    lat0,lon0=CITIES[key];kx=111320*math.cos(math.radians(lat0))
    s,n=lat0-R/KZ,lat0+R/KZ;w,e=lon0-R/kx,lon0+R/kx
    path=f"raw/{key}/transit.json.gz"
    if os.path.exists(path):d=json.load(gzip.open(path,"rt"))
    else:
        q=f'[out:json][timeout:180];rel["route"~"^(subway|light_rail|tram|monorail)$"]({s},{w},{n},{e})->.r;.r out body;node(r.r);out;'
        d=query(q);os.makedirs(f"raw/{key}",exist_ok=True);json.dump(d,gzip.open(path,"wt"))
    nodes={el["id"]:el for el in d["elements"] if el["type"]=="node"}
    P=lambda la,lo:[round((lo-lon0)*kx),round((lat0-la)*KZ)]
    best={}
    for r in (el for el in d["elements"] if el["type"]=="relation"):
        t=r.get("tags",{});ref=t.get("ref") or t.get("name","?");kind=t["route"]
        stops=[];seen=set()
        for m in r["members"]:
            if m["type"]!="node" or not m["role"].startswith("stop"):continue
            nd=nodes.get(m["ref"]);
            if not nd:continue
            nm=nd.get("tags",{}).get("name","")
            if nm in seen and nm:continue
            seen.add(nm);stops.append(P(nd["lat"],nd["lon"])+[nm])
        if len(stops)<2:
            for m in r["members"]:
                if m["type"]=="node" and m["role"].startswith("platform") and m["ref"] in nodes:
                    nd=nodes[m["ref"]];nm=nd.get("tags",{}).get("name","")
                    if nm not in seen:seen.add(nm);stops.append(P(nd["lat"],nd["lon"])+[nm])
        if len(stops)<2:continue
        k=(kind,ref)
        if k not in best or len(stops)>len(best[k]["stops"]):
            best[k]={"ref":ref,"name":t.get("name",""),"colour":t.get("colour",""),"kind":kind,"net":t.get("network",""),"op":t.get("operator",""),"stops":stops}
    out=list(best.values())
    os.makedirs("out",exist_ok=True)
    with gzip.open(f"out/{key}_transit.json.gz","wt") as f:json.dump(out,f,separators=(",",":"))
    log(key,len(out),"lines",sum(len(l["stops"]) for l in out),"stops",[(l["ref"],l["kind"],len(l["stops"])) for l in out][:40])
for k in (sys.argv[1:] or CITIES):
    try:run(k)
    except Exception as ex:log(k,"FAIL",ex)
