import gzip,json,sys,os
sys.argv=[sys.argv[0]];import fetch_osm as F
def stitch(segs):
    segs=[[(q["lat"],q["lon"]) for q in s] for s in segs if s and len(s)>1];rings=[]
    while segs:
        cur=segs.pop(0)
        changed=True
        while cur[0]!=cur[-1] and changed:
            changed=False
            for i,s in enumerate(segs):
                if s[0]==cur[-1]:cur=cur+s[1:]
                elif s[-1]==cur[-1]:cur=cur+s[::-1][1:]
                elif s[-1]==cur[0]:cur=s+cur[1:]
                elif s[0]==cur[0]:cur=s[::-1]+cur[1:]
                else:continue
                segs.pop(i);changed=True;break
        if cur[0]==cur[-1]:rings.append([{"lat":a,"lon":b} for a,b in cur])
        else:print("  open ring dropped",len(cur))
    return rings
def q16(v):return max(-32767,min(32767,int(round(v*F.Q))))
F.q16=q16
for key in (os.environ.get("CITY") or "sea nyc chi sf sd").split():
    lat0,lon0=F.CITIES[key];kx,(s,w,n,e)=F.frame(lat0,lon0);bb=f"{s:.5f},{w:.5f},{n:.5f},{e:.5f}"
    d=F.cached(f"raw/{key}/water2.json.gz",f'[out:json][timeout:300];(way["natural"="water"]({bb});rel["natural"="water"]({bb});way["waterway"="riverbank"]({bb});rel["waterway"="riverbank"]({bb});way["natural"="bay"]({bb});rel["natural"="bay"]["type"="multipolygon"]({bb}););out body geom qt;')
    res=[];inner=[]
    for el in d["elements"]:
        t=el.get("tags",{})
        if el["type"]=="way":outs=[el.get("geometry")] if el.get("geometry") else [];ins=[]
        else:
            outs=stitch([m.get("geometry") for m in el.get("members",[]) if m.get("role")=="outer"])
            ins=stitch([m.get("geometry") for m in el.get("members",[]) if m.get("role")=="inner"])
        for g,dst in [(g,res) for g in outs]+[(g,inner) for g in ins]:
            if g[0]!=g[-1] and len(g)>2 and el["type"]=="way":continue
            p=F.ring_xy(lat0,lon0,kx,g,1.5)
            if len(p)<3 or abs(F.area(p))<150:continue
            dst.append([t.get("name") or t.get("natural") or "water",[c for x,z in p for c in (F.q16(x),F.q16(z))]])
    path=f"out/{key}_areas.json.gz";A=json.load(gzip.open(path,"rt"));A["water"]=res;A["islands"]=inner
    with gzip.open(path,"wt",compresslevel=9) as f:json.dump(A,f,separators=(",",":"))
    F.log(key,"water",len(res),"islands",len(inner),[r[0] for r in res if r[0] not in("water",)][:12])
