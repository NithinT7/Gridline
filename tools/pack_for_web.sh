#!/usr/bin/env bash
# Convert the gzip files written by fetch_osm.py / fix_water.py / fetch_transit.py (tools/out/*.gz)
# into the base64 text files the game loads from data/osm/.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p ../data/osm
for f in out/*.gz; do
  base64 < "$f" | tr -d '\n' > "../data/osm/$(basename "${f%.gz}").txt"
  echo "packed $(basename "$f")"
done
