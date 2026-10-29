# Sports pitches, running tracks and school/college grounds -> added to out/{city}_areas.json.gz
import gzip,json,sys,os
sys.argv=[sys.argv[0]];import fetch_osm as F
from fix_water_lib import stitch
for key in (os.environ.get("CITY") or "sea nyc chi sf sd").split():
    lat0,lon0=F.CITIES[key];kx,(s,w,n,e)=F.frame(lat0,lon0);bb=f"{s:.5f},{w:.5f},{n:.5f},{e:.5f}"
    q16=lambda v:max(-32767,min(32767,int(round(v*F.Q))))
    d=F.cached(f"raw/{key}/sports.json.gz",f'[out:json][timeout:300];(way["leisure"~"^(pitch|track|stadium|sports_centre)$"]({bb});rel["leisure"~"^(pitch|track)$"]({bb});way["amenity"~"^(school|college|university|kindergarten)$"]({bb});rel["amenity"~"^(school|college|university)$"]({bb});way["landuse"="education"]({bb}););out body geom qt;')
    sports=[];schools=[];tracks=[]
    for el in d["elements"]:
        t=el.get("tags",{})
        if el["type"]=="way":
            g=el.get("geometry") or []
            rings=[g] if len(g)>2 else []
            closed=len(g)>2 and (g[0]["lat"],g[0]["lon"])==(g[-1]["lat"],g[-1]["lon"])
        else:
            rings=stitch([m.get("geometry") for m in el.get("members",[]) if m.get("role")=="outer"]);closed=True
        for g in rings:
            pts=[F.P(lat0,lon0,kx,q["lat"],q["lon"]) for q in g]
            if len(pts)>2 and pts[0]==pts[-1]:pts=pts[:-1]
            pts=F.dp(pts,0.6) if len(pts)>3 else pts
            flat=[c for x,z in pts for c in (q16(x),q16(z))]
            le=t.get("leisure");am=t.get("amenity") or ("school" if t.get("landuse")=="education" else None)
            if am:schools.append([t.get("name",""),am,flat])
            elif le=="track":tracks.append([1 if (closed and t.get("area")!="no") else 0,t.get("sport",""),flat])
            elif le in("pitch","stadium","sports_centre") and closed:sports.append([le,t.get("sport",""),t.get("surface",""),flat])
    path=f"out/{key}_areas.json.gz";A=json.load(gzip.open(path,"rt"));A["sports"]=sports;A["tracks"]=tracks;A["schools"]=schools
    with gzip.open(path,"wt",compresslevel=9) as f:json.dump(A,f,separators=(",",":"))
    F.log(key,"sports",len(sports),"tracks",len(tracks),"schools",len(schools))
