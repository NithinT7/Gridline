# Gridline — run a real American city

A browser-based city-management game. Pick **Seattle or New York** (Chicago, San Francisco and San Diego data is included but currently hidden),
take office in January 2027, and govern quarter by quarter through a four-year term that ends in an election.

Every proposal that lands on your desk — towers, rezonings, transit lines, parks, supportive housing,
police and violence-interruption programs, grants — is previewed in 3D on the real city before you
approve or deny it, with a forecast of what it does to rents, home values, crime, homelessness,
traffic, jobs, the budget and your approval with each voter group.

## Features

- **Real cities in 3D** — building footprints and heights, streets with lane counts, bridges and
  viaducts, parks, coastlines, lakes and rail from OpenStreetMap; hand-built models of signature
  landmarks (Empire State, One WTC, Willis Tower, Space Needle, Transamerica Pyramid, …).
- **Real transit networks** — NYC subway, Chicago 'L', BART and Muni, Seattle Link and streetcars,
  San Diego Trolley, plus real planned projects (Ballard Link, Second Ave Subway, Red Line Extension…)
  that you can bring to council, extend, run more often, or draw new lines.
- **Simulation** — quarterly stock-flow model: housing vacancy drives rent; two-pool homelessness
  with supportive-housing placements; crime responding to policing, lighting, violence interruption
  and youth programs; transit ridership and car share; congestion anchored to TomTom figures;
  budget with bonds; demographics and attractiveness indices; approval by group.
- **Live city** — traffic model with simulated cars, weather, day/night, flooding, random events.
- **Data layers** — crime, homelessness, rent, jobs, population, traffic, flood risk, rail coverage.
- **Saves** — autosave every quarter plus manual saves (stored in the browser).

Starting figures are real: FBI 2025 crime rates, 2025–26 point-in-time homeless counts,
Zillow home values, TomTom congestion, adopted city budgets. The in-game **✓ Model check**
compares the model with real data.

## Run it

It is a static site — no build step. Serve the folder over HTTP (the data files are fetched):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Or publish with **GitHub Pages** (Settings → Pages → deploy from branch `main`, folder `/`).

Controls: drag to pan, right-drag / two-finger to rotate, wheel or **+ / −** to zoom,
**WASD / QE** to move, **Esc** for the menu.

## Project layout

```
index.html        UI shell and styles
js/geo.js         city definitions: frames, traced shorelines, regions, landmarks, real baselines
js/engine.js      three.js renderer: OSM loading, terrain, buildings, roads, water, traffic, previews
js/sim.js         the city simulation, proposals, events, forecasts
js/plans.js       real planned transit projects per city
js/ui.js          panels, desk, forecasts, transit tab, overlays, saves
data/osm/         packed OpenStreetMap data (gzip, base64-encoded)
tools/            scripts that download and pack the OSM data
```

## Rebuilding the map data

```bash
cd tools
python3 fetch_osm.py sea          # buildings, roads, parks, water, rail (Overpass API)
python3 fix_water.py              # lakes/bays from multipolygon relations
python3 fetch_transit.py          # rail route relations and stations
python3 repack_roads.py           # adds bridge layers, floating bridges, tunnels
python3 fetch_sports.py           # pitches, running tracks, school grounds
python3 fetch_paths.py            # footpaths, cycleways, rail with viaducts
./pack_for_web.sh                 # writes data/osm/*.txt
```

Please be gentle with the public Overpass API (the scripts cache tiles in `tools/raw/`).

## Credits

- Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL.
- Rendering: [three.js](https://threejs.org) r128.
