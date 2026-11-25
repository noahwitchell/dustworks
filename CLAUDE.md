# Dustworks — notes for Claude

- Owner: Noah. Original iPad automation game in the spirit of "clean up the moon" games (not a copy of any one): a junk-covered rock, three vents spitting more junk, and a crew of bots you program. Landscape iPad first, works on phone/desktop.
- No build step, no frameworks: `index.html`, `css/style.css`, `js/game.js` (one file, sections marked), PWA (`manifest.json`, `sw.js` network-first).
- Core loop: hand-sweep (Sweep tool) → credits → buy bots (Shop) → paint zones A–F → give each bot a looping program of steps: Sweep [zone/anywhere], Unload at [nearest/Recycler/bin], Fetch from [bin], Wait. Bins hold 40; any belt next to a bin pointing away from it is fed automatically; belts pointing into the Recycler or a bin deliver. Cap all 3 vents (1,500 each) + sweep every piece = win.
- Bots hover (no pathfinding, they fly over boulders); belts/bins can't go on boulders or vents. Placing on junk sweeps it into credits.
- Balance (2026-11-24): VALUE dust 1 / scrap 2 / crystal 5; bot cost 30·1.5^(n−1); greedy "buy bots, sweep anywhere" sim cleans a rock in ~30 min game time. Re-run that sim (see git history / __dw debug handle) after changing numbers.
- Controls: one finger = current tool, two fingers pan/pinch. Mouse: wheel zoom, right-drag pan. Select tool drag = pan.
- Steady interface: controls hold size/position; disable, don't remove.
- Save: localStorage `dustworks.v1` (autosave 10 s + on hide).
- Icon: drone bot sitting on the rock's horizon, full-bleed square, everything joined (Noah: no loose edges, corners or floating bits). Rebuild: `zsh tools/render_icons.sh`.
- Public repo github.com/noahwitchell/dustworks, GitHub Pages from main (push = deploy). Bump CACHE in sw.js when shipping.
