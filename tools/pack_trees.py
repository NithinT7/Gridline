import gzip,json,os,sys,math,struct
sys.argv=[sys.argv[0]];import fetch_osm as F
key=os.environ["CITY"];lat0,lon0=F.CITIES[key];kx=111320*math.cos(math.radians(lat0))
out=bytearray();n=0;seen=set()
for i in range(4):
    p=f"raw/{key}/trees{i}.json.gz"
    if not os.path.exists(p):continue
    for el in json.load(gzip.open(p,"rt"))["elements"]:
        if el["id"] in seen:continue
        seen.add(el["id"]);x,z=F.P(lat0,lon0,kx,el["lat"],el["lon"])
        if abs(x)>F.EXT or abs(z)>F.EXT:continue
        out+=struct.pack("<hh",max(-32767,min(32767,int(round(x*F.Q)))),max(-32767,min(32767,int(round(z*F.Q)))));n+=1
with gzip.open(f"out/{key}_trees.bin.gz","wb",compresslevel=9) as f:f.write(bytes(out))
F.log(key,"trees",n)
