# Dustworks — notes for Claude

- Owner: Noah. Original iPad automation game in the spirit of "clean up the moon" games (not a copy of any one). v2 direction (Noah, 2026-11-24): you START AS A CHARACTER walking the surface and vacuuming by hand; recycled junk becomes resources; you spend them on suit upgrades and then ever bigger automation until a huge machine is cleaning the rock at a scale you never could by hand.
- No build step, no frameworks: `index.html`, `css/style.css`, `js/game.js` (one file, sections marked), PWA (`manifest.json`, `sw.js` network-first).
- Loop: walk (drag anywhere = floating joystick; WASD/arrows) → vacuum is always on (reach, power, backpack size) → walk up to the Recycler/bin/hive to unload → stock of dust / scrap / crystal → Build panel.
- Tiers (unlock by total pieces recycled): belts + bins 60 → Vac Post 250 (self-cleaning post, radius 3, feeds belts) → bots 600 (programmable: Sweep / Unload at / Fetch from / Wait, zones A–F) → vent caps 1,200 → Drone Hive 2,500 (2×2, 3–12 drones sweep radius 10 into the hive; belt it out or have a bot fetch). Win = all 6 vents capped + every piece swept.
- Storage machines (bin, vac, hive) push onto any adjacent belt pointing away from them. Belts carry the player too.
- World 112×80 tiles; ground cached in ONE canvas at GS 1.25 (under iOS 16.7M px limit) with per-tile redraw (`redrawTile`). Bots/drones fly; the player collides with boulders, machines and vents.
- Balance (2026-11-24): scripted player sim (walks to nearest junk, buys suit → bots → hives → caps) finishes in ~55 min game time with 25 bots + 72 drones, 93% of recycling done by machines. Crystal is the bottleneck. Re-run that sim via the `__dw` debug handle after changing numbers.
- Steady interface: controls hold size/position; disable, don't remove.
- Save: localStorage `dustworks.v2` (autosave 10 s + on hide); v1 saves are ignored.
- Icon: drone bot sitting on the rock's horizon, full-bleed square, everything joined (Noah: no loose edges, corners or floating bits). Rebuild: `zsh tools/render_icons.sh`.
- Public repo github.com/noahwitchell/dustworks, GitHub Pages from main (push = deploy). Bump CACHE in sw.js when shipping.
