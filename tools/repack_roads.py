# Re-pack roads from the cached Overpass download, adding layer and floating-bridge info to the flags:
# fl bit0 oneway, bit1 bridge, bit2 tunnel, bit3 floating bridge, bits4-6 = clamp(layer,0,7) for bridges / clamp(-layer,0,7) for tunnels
import gzip,json,sys,os
sys.argv=[sys.argv[0]];import fetch_osm as F
def num(v):
    try:return float(str(v).split(";")[0])
    except:return None
for key in (os.environ.get("CITY") or "sea nyc chi sf sd").split():
    lat0,lon0=F.CITIES[key];kx,_=F.frame(lat0,lon0)
    q16=lambda v:max(-32767,min(32767,int(round(v*F.Q))))
    d=json.load(gzip.open(f"raw/{key}/roads.json.gz","rt"))
    TY={"motorway":0,"trunk":1,"primary":2,"secondary":3,"tertiary":4,"unclassified":5,"residential":5,"living_street":5,"service":6,"pedestrian":7,"motorway_link":8,"trunk_link":8,"primary_link":9,"secondary_link":9,"tertiary_link":9}
    names=[];nidx={};ways=[]
    for el in d.get("elements",[]):
        t=el.get("tags",{});g=el.get("geometry")
        if not g:continue
        ty=TY.get(t.get("highway"),5)
        if ty==6 and t.get("service") in ("parking_aisle","driveway","drive-through"):continue
        nm=t.get("name") or t.get("ref") or ""
        if nm not in nidx:nidx[nm]=len(names);names.append(nm)
        pts=F.dp([F.P(lat0,lon0,kx,q["lat"],q["lon"]) for q in g],0.8)
        lanes=num(t.get("lanes"));lanes=int(lanes) if lanes else 0
        layer=num(t.get("layer")) or 0
        br=t.get("bridge") not in (None,"no");tu=t.get("tunnel") not in (None,"no") or layer<0
        fl=(1 if t.get("oneway") in ("yes","1","true") or t.get("junction")=="roundabout" else 0)|(2 if br else 0)|(4 if tu else 0)
        if br and (t.get("bridge")=="floating" or t.get("bridge:structure")=="floating"):fl|=8
        L=int(max(0,min(7,layer if br else (-layer if tu else 0))));fl|=L<<4
        ways.append([ty,lanes,fl,nidx[nm],[c for x,z in pts for c in (q16(x),q16(z))]])
    with gzip.open(f"out/{key}_roads.json.gz","wt",compresslevel=9) as f:json.dump({"names":names,"ways":ways},f,separators=(",",":"))
    fl8=sum(1 for w in ways if w[2]&8);print(key,len(ways),"floating",fl8,"layered bridges",sum(1 for w in ways if w[2]&2 and w[2]>>4))
