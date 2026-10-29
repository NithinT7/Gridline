set -e
export EXT=11000 QSCALE=2 CITY=nycbig
[ -f raw/nycbig/transit.json.gz ] || cp raw/nyc/transit.json.gz raw/nycbig/
python3 -c "import fetch_osm as F;lat0,lon0=F.CITIES['nycbig'];kx,_=F.frame(lat0,lon0);F.pack('nycbig',lat0,lon0,kx)"
python3 fix_water.py; python3 fetch_sports.py; python3 fetch_paths.py; python3 repack_roads.py; python3 pack_trees.py
python3 fetch_transit.py nycbig
echo PACKED
