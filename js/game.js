'use strict';
// Dustworks — start on foot with a vacuum, end with a machine (and a fleet) that cleans a whole rock.
(() => {
// ---------- constants ----------
const TS = 32;               // world px per tile
const W = 112, H = 80, N = W * H;
const GS = 1.25;             // ground cache resolution (stays under iOS canvas limits)
const RES = ['Dust', 'Scrap', 'Crystal', 'Alloy'];
const RES_C = ['#a99cb6', '#8fb0cc', '#3fd8c8', '#ff9a5c'];
const MAXPILE = [12, 6, 3];
const ZL = ['A', 'B', 'C', 'D', 'E', 'F'];
const ZC = ['#ffb547', '#ff7a6b', '#5cc8ff', '#9be15d', '#b48cff', '#ff8bd1'];
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const VENTS = 6, SLOTS = 3;
const slotKey = n => 'dustworks.slot.' + n;
const c4 = c => [c[0] || 0, c[1] || 0, c[2] || 0, c[3] || 0];
// Machines: cost [dust, scrap, crystal, alloy]; unlocked after recycling this many pieces
const MACH = {
  belt:      { name: 'Belt', cost: [2, 0, 0, 0], unlock: 60, desc: 'Carries pieces the way you lay it. Draw into the side of another belt to merge.' },
  splitter:  { name: 'Splitter', cost: [6, 2, 0, 0], unlock: 60, desc: 'Deals pieces out its front, left and right in turn.' },
  bin:       { name: 'Bin', cost: [20, 5, 0, 0], unlock: 60, w: 1, cap: 50, desc: 'Holds 50 pieces. Feeds any belt pointing away from it.' },
  vac:       { name: 'Vac Post', cost: [45, 12, 0, 0], unlock: 250, w: 1, cap: 30, radius: 3, desc: 'Cleans everything within 3 tiles on its own. Feeds belts like a bin.' },
  compactor: { name: 'Compactor', cost: [60, 20, 0, 0], unlock: 400, w: 1, input: 0, ratio: 8, out: 1, time: 1.5, desc: 'Presses 8 dust into 1 scrap. Other pieces pass straight through.' },
  smelter:   { name: 'Smelter', cost: [160, 60, 4, 0], unlock: 900, w: 2, input: 1, ratio: 4, out: 3, time: 2.5, desc: 'Smelts 4 scrap into 1 alloy. Other pieces pass straight through.' },
  garage:    { name: 'Garage', cost: [220, 80, 6, 4], unlock: 1000, w: 3, h: 2, desc: 'Houses your vehicles. Add stalls to grow the fleet.' },
  cap:       { name: 'Vent Cap', cost: [300, 110, 20, 0], unlock: 1200, w: 1, desc: 'Seals a vent for good.' },
  hive:      { name: 'Drone Hive', cost: [260, 90, 12, 0], unlock: 2500, w: 2, cap: 150, radius: 10, desc: 'Runs its own drones within 10 tiles. Feeds belts like a bin.' },
};
const PALETTE = ['bin', 'vac', 'compactor', 'smelter', 'garage', 'cap', 'hive'];
const BOT_UNLOCK = 600;
const UPG = {
  pack:  { group: 'Suit', name: 'Backpack', desc: 'Pieces you can carry', vals: [30, 60, 120, 240], costs: [[40, 6], [140, 30, 2], [380, 90, 8]] },
  power: { group: 'Suit', name: 'Vacuum motor', desc: 'Pieces per second you pick up', vals: [8, 14, 22, 34], costs: [[35, 6], [120, 28, 2], [340, 80, 8]] },
  reach: { group: 'Suit', name: 'Nozzle', desc: 'Vacuum reach, tiles', vals: [1, 1.5, 2.1, 2.8], costs: [[30, 8], [110, 26, 2], [320, 80, 8]] },
  boots: { group: 'Suit', name: 'Boots', desc: 'Walking speed, tiles/s', vals: [3.2, 4.2, 5.4, 7], costs: [[30, 5], [100, 22, 1], [300, 70, 6]] },
  cargo:   { group: 'Bots', name: 'Cargo hold', desc: 'Pieces each bot carries', vals: [5, 10, 18, 30], costs: [[120, 40, 4], [400, 130, 12], [1100, 350, 30, 10]] },
  speed:   { group: 'Bots', name: 'Thrusters', desc: 'Bot speed, tiles/s', vals: [2, 3, 4.2, 5.6], costs: [[140, 45, 4], [450, 140, 12], [1200, 380, 30, 10]] },
  suction: { group: 'Bots', name: 'Bot suction', desc: 'Pieces per second, each bot', vals: [2, 4, 6.5, 10], costs: [[120, 40, 4], [420, 130, 12], [1150, 360, 30, 10]] },
  belt:    { group: 'Machines', name: 'Belt motors', desc: 'Belt speed, tiles/s', vals: [1.5, 2.5, 4], costs: [[100, 30, 2], [400, 120, 10, 4]] },
  vacrate: { group: 'Machines', name: 'Vac Post turbines', desc: 'Pieces per second, each Vac Post', vals: [1.6, 3, 5], costs: [[150, 50, 4], [500, 160, 14, 6]] },
  proc:    { group: 'Machines', name: 'Processor gears', desc: 'Compactor and Smelter speed', vals: [1, 1.6, 2.5], costs: [[200, 60, 4], [600, 200, 12, 10]] },
};
// Vehicles
const VEH = {
  rover:   { name: 'Rover', cost: [150, 60, 4, 10], speed: 6, hopper: 80, reach: 1.6, power: 24, color: '#5cc8ff', desc: 'Quick all-rounder.' },
  hauler:  { name: 'Hauler', cost: [260, 110, 6, 22], speed: 4.6, hopper: 260, reach: 1.4, power: 20, color: '#ff9a5c', desc: 'Slow, with a huge hopper.' },
  sweeper: { name: 'Sweeper', cost: [320, 120, 10, 30], speed: 5.2, hopper: 140, reach: 2.6, power: 44, color: '#9be15d', desc: 'Wide intake, eats junk fast.' },
};
const VUPG = {
  engine: { name: 'Engine', desc: 'Top speed', mult: [1, 1.3, 1.6, 2] },
  hopper: { name: 'Hopper', desc: 'Pieces it carries', mult: [1, 1.6, 2.4, 3.5] },
  intake: { name: 'Intake', desc: 'Reach and suction', mult: [1, 1.35, 1.75, 2.2] },
};
const VUPG_COST = [[80, 30, 2, 6], [200, 80, 5, 15], [500, 200, 12, 35]];
const VFEAT = {
  plow:  { name: 'Boulder plow', cost: [150, 80, 6, 25], desc: 'Drives through boulders and breaks them into scrap.' },
  magnet:{ name: 'Magnet', cost: [120, 60, 10, 15], desc: 'Pulls in scrap and crystal from twice as far.' },
  dump:  { name: 'Dump link', cost: [100, 50, 6, 10], desc: 'Unloads into any drop-off within 6 tiles.' },
  auto:  { name: 'Autopilot', cost: [200, 80, 8, 20], desc: 'Send it out to clean by itself and come home.' },
};
const STALL_COST = [100, 40, 2, 4], STALL_MAX = 4;
const uv = k => UPG[k].vals[S.upg[k]];
const ownBots = () => S.bots.filter(b => !b.hive).length;
function botCost() { const n = ownBots(); return [30 + 10 * n, 10 + 3 * n, 1 + Math.floor(n / 5), 0]; }
const DRONE_COST = [70, 25, 2, 0], HIVE_MAX = 12;

// ---------- tiny utils ----------
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const idx = (x, y) => y * W + x;
const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const fmt = n => n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : Math.floor(n).toLocaleString();
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y, s) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vnoise(x, y, s) * .55 + vnoise(x * 2.1, y * 2.1, s + 7) * .3 + vnoise(x * 4.3, y * 4.3, s + 13) * .15;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const canPay = c => { c = c4(c); return S.res[0] >= c[0] && S.res[1] >= c[1] && S.res[2] >= c[2] && S.res[3] >= c[3]; };
const pay = c => { c = c4(c); for (let k = 0; k < 4; k++) S.res[k] -= c[k]; };
const costText = c => c4(c).map((v, k) => v ? v + ' ' + RES[k].toLowerCase() : '').filter(Boolean).join(' · ');
const costHTML = c => c4(c).map((v, k) => v ? `<span class="cost"><i style="background:${RES_C[k]}"></i>${fmt(v)}</span>` : '').join('');
const sum4 = a => a[0] + a[1] + a[2] + (a[3] || 0);

// ---------- state ----------
let S = null;
let byId = new Map();
let rng = Math.random;
let slot = 0;        // save slot in play (0 = title screen)
let paused = true;

function generate(seed) {
  const st = {
    v: 3, seed, res: [0, 0, 0, 0], time: 0, speed: 1, remaining: 0, initial: 0, savedAt: 0,
    dust: new Uint8Array(N), scrap: new Uint8Array(N), crys: new Uint8Array(N),
    rock: new Uint8Array(N), belt: new Int8Array(N).fill(-1), split: new Uint8Array(N), spPtr: new Uint8Array(N), bmap: new Int32Array(N),
    buildings: [], vents: [], zones: [null, null, null, null, null, null], bots: [], items: [], vehicles: [],
    upg: Object.fromEntries(Object.keys(UPG).map(k => [k, 0])),
    me: { x: 0, y: 0, ang: Math.PI / 2, cargo: [0, 0, 0, 0], step: 0, inVeh: 0 },
    stats: { picked: 0, recycled: 0, beltDelivered: 0, fetched: 0, byMachines: 0, splits: 0, compacted: 0, alloy: 0, driven: 0, rocks: 0 },
    tasksDone: [], nextId: 1, no: { bin: 1, vac: 1, hive: 1, bot: 1, compactor: 1, smelter: 1, garage: 1, rover: 1, hauler: 1, sweeper: 1 },
    lastBeltDir: 0, won: false, hintsSeen: {}, machTool: 'bin',
  };
  const cx = W / 2, cy = H / 2;
  const R = mulberry(seed);
  const a0 = R() * Math.PI * 2;
  for (let k = 0; k < VENTS; k++) {
    const ring = k % 2 ? .4 : .26, a = a0 + k * (Math.PI * 2 / VENTS) + (R() - .5) * .4;
    const vx = Math.round(clamp(cx + Math.cos(a) * W * ring * 1.05, 5, W - 6));
    const vy = Math.round(clamp(cy + Math.sin(a) * H * ring * 1.05, 5, H - 6));
    st.vents.push({ x: vx, y: vy, capped: false, t: R() * 3 });
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y), dc = Math.hypot(x + .5 - cx, y + .5 - cy);
    let nearVent = 99;
    for (const v of st.vents) nearVent = Math.min(nearVent, Math.hypot(x - v.x, y - v.y));
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    if ((fbm(x / 6, y / 6, seed + 50) > .7 || edge === 0) && dc > 6 && nearVent > 2.5) { st.rock[i] = 1; continue; }
    let d = fbm(x / 10, y / 10, seed + 1) * 1.6 - .36;
    d *= smooth(2.5, 9, dc) * .85 + .15 * smooth(1.5, 3, dc);
    d += .9 * Math.max(0, 1 - nearVent / 7);
    d = clamp(d, 0, 1);
    if (d > .12) st.dust[i] = Math.round(d * 8 * (.5 + .5 * hash2(x, y, seed + 3)));
    if (fbm(x / 5, y / 5, seed + 2) > .56 && d > .15) st.scrap[i] = Math.min(6, Math.round(d * 5));
    if (fbm(x / 4, y / 4, seed + 4) > .7 && d > .3) st.crys[i] = hash2(x, y, seed + 9) > .6 ? 2 : 1;
  }
  for (const v of st.vents) { const i = idx(v.x, v.y); st.dust[i] = st.scrap[i] = st.crys[i] = 0; }
  const rx = Math.floor(cx) - 1, ry = Math.floor(cy) - 1;
  st.buildings.push({ id: st.nextId++, kind: 'recycler', x: rx, y: ry, w: 2, h: 2, store: [0, 0, 0, 0], label: 'Recycler' });
  for (let i = 0; i < N; i++) st.remaining += st.dust[i] + st.scrap[i] + st.crys[i];
  st.initial = st.remaining;
  st.me.x = rx + 1; st.me.y = ry + 3.2;
  return st;
}

function rebuildIndex() {
  byId = new Map();
  S.bmap.fill(0);
  for (const b of S.buildings) {
    byId.set(b.id, b);
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) S.bmap[idx(x, y)] = b.id;
  }
}
const recycler = () => S.buildings[0];
const isStore = b => b.kind === 'bin' || b.kind === 'vac' || b.kind === 'hive';
const isProc = b => b.kind === 'compactor' || b.kind === 'smelter';
const capOf = b => MACH[b.kind] ? MACH[b.kind].cap || 0 : 0;
const outOf = b => isStore(b) ? b.store : isProc(b) ? b.out : null;   // what a machine hands to belts and fetching bots

function newBot(x, y, hive) {
  const b = { id: S.nextId++, name: hive ? 'Drone' : 'Bot ' + S.no.bot++, x, y, cargo: [0, 0, 0, 0],
    prog: hive ? [{ op: 'sweep', arg: 'hive:' + hive }, { op: 'unload', arg: 'bin:' + hive }] : [{ op: 'sweep', arg: 'near' }, { op: 'unload', arg: 'nearest' }],
    pc: 0, tgt: -1, timer: 0, acc: 0, hue: hive ? 46 : (S.no.bot * 53 + 190) % 360, status: 'Starting', worked: false, idle: 0, ang: 0, hive: hive || 0 };
  S.bots.push(b);
  return b;
}

// ---------- save slots ----------
const b64 = arr => { let s = ''; const u = new Uint8Array(arr.buffer); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };
const unb64 = (str, T) => { const s = atob(str); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new T(u.buffer); };
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };
function serialize() {
  S.savedAt = Date.now();
  return JSON.stringify(Object.assign({}, S, {
    dust: b64(S.dust), scrap: b64(S.scrap), crys: b64(S.crys), rock: b64(S.rock), belt: b64(S.belt), split: b64(S.split), spPtr: undefined, bmap: undefined,
    bots: S.bots.map(b => Object.assign({}, b, { tgt: -1 })),
    vehicles: S.vehicles.map(v => Object.assign({}, v, { tgt: -1, avoid: undefined })),
  }));
}
function save() { if (S && slot && !paused) { if (!lsSet(slotKey(slot), serialize())) toast('Could not save: browser storage is blocked or full'); } }
function parseSave(raw) {
  try {
    const o = JSON.parse(raw);
    if (o.v !== 2 && o.v !== 3) return null;
    o.dust = unb64(o.dust, Uint8Array); o.scrap = unb64(o.scrap, Uint8Array); o.crys = unb64(o.crys, Uint8Array);
    o.rock = unb64(o.rock, Uint8Array); o.belt = unb64(o.belt, Int8Array); o.bmap = new Int32Array(N);
    o.split = o.split ? unb64(o.split, Uint8Array) : new Uint8Array(N); o.spPtr = new Uint8Array(N);
    // upgrade older saves in place
    while (o.res.length < 4) o.res.push(0);
    o.me.cargo = c4(o.me.cargo); o.me.inVeh = o.me.inVeh || 0;
    for (const b of o.buildings) b.store = c4(b.store || []);
    for (const b of o.bots) b.cargo = c4(b.cargo);
    o.vehicles = o.vehicles || [];
    for (const k of Object.keys(UPG)) if (o.upg[k] === undefined) o.upg[k] = 0;
    const fresh = generate(1);
    o.stats = Object.assign({}, fresh.stats, o.stats);
    o.no = Object.assign({}, fresh.no, o.no);
    o.machTool = o.machTool || 'bin';
    o.v = 3;
    return o;
  } catch (e) { return null; }
}
function migrateOld() {
  const old = lsGet('dustworks.v2');
  if (old && !lsGet(slotKey(1))) { lsSet(slotKey(1), old); lsDel('dustworks.v2'); }
}

// ---------- debris ----------
const pileOf = i => S.dust[i] + S.scrap[i] + S.crys[i];
const dirty = new Set();
function addDebris(i, k, n) {
  const arr = k === 0 ? S.dust : k === 1 ? S.scrap : S.crys;
  const add = Math.min(n, MAXPILE[k] - arr[i]);
  if (add > 0) { arr[i] += add; S.remaining += add; dirty.add(i); }
  return add;
}
function takeFromTile(i, n, put, only) {
  let got = 0;
  for (const k of [2, 1, 0]) {
    if (only && !only[k]) continue;
    const arr = k === 0 ? S.dust : k === 1 ? S.scrap : S.crys;
    const t = Math.min(arr[i], n - got);
    if (t > 0) { arr[i] -= t; got += t; S.remaining -= t; put(k, t); }
    if (got >= n) break;
  }
  if (got) dirty.add(i);
  return got;
}
const incomeLog = [];
function stock(k, n, machine) {
  S.res[k] += n; S.stats.recycled += n;
  if (k === 3) S.stats.alloy += n;
  if (machine) S.stats.byMachines += n;
  incomeLog.push([S.time, n]);
}

// ---------- buildings ----------
const PROC_IN = 40, PROC_OUT = 30;
function accept(b, k, n, machine = true) {
  if (b.kind === 'recycler') { stock(k, n, machine); return n; }
  if (isStore(b)) { const t = Math.min(capOf(b) - sum4(b.store), n); b.store[k] += t; return t; }
  if (isProc(b)) {
    const m = MACH[b.kind];
    if (k === m.input) { const t = Math.min(PROC_IN - b.inp, n); b.inp += t; return t; }
    const t = Math.min(PROC_OUT - sum4(b.out), n); b.out[k] += t; return t;   // pass-through
  }
  return 0;
}
function isVent(i) { for (const v of S.vents) if (idx(v.x, v.y) === i) return true; return false; }
const freeTile = i => !S.rock[i] && !S.bmap[i] && !isVent(i);
const unlocked = kind => S.stats.recycled >= (kind === 'bot' ? BOT_UNLOCK : MACH[kind].unlock);
function clearUnder(i) { takeFromTile(i, 99, (k, t) => stock(k, t, false)); }
function blockedByMovers(x0, y0, w, h) {
  const hit = (px, py, r) => px + r > x0 && px - r < x0 + w && py + r > y0 && py - r < y0 + h;
  if (!S.me.inVeh && hit(S.me.x, S.me.y, meR)) return true;
  return S.vehicles.some(v => !v.parked && hit(v.x, v.y, .55));
}
function placeMachine(kind, x, y) {
  const m = MACH[kind], w = m.w || 1, h = m.h || w;
  if (!unlocked(kind)) return toast(m.name + ' unlocks after recycling ' + fmt(m.unlock) + ' pieces');
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (!inMap(xx, yy) || !freeTile(idx(xx, yy))) return toast('Pick open ground for the ' + m.name);
  if (blockedByMovers(x, y, w, h)) return toast('Move out of the way first');
  if (!canPay(m.cost)) return toast(m.name + ' needs ' + costText(m.cost));
  pay(m.cost);
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const i = idx(xx, yy); if (S.belt[i] >= 0) removeBelt(i); clearUnder(i); }
  const b = { id: S.nextId++, kind, x, y, w, h, store: [0, 0, 0, 0], label: m.name + ' ' + S.no[kind]++, acc: 0 };
  if (isProc(b)) { b.inp = 0; b.out = [0, 0, 0, 0]; b.t = 0; }
  if (kind === 'garage') b.stalls = 1;
  S.buildings.push(b); rebuildIndex();
  if (kind === 'hive') { b.drones = 0; for (let k = 0; k < 3; k++) addDrone(b, true); }
  select({ type: 'building', id: b.id });
  if (kind === 'bin') hintOnce('bin', 'Lay a belt from the bin into the Recycler, pointing away from the bin');
  if (kind === 'vac') hintOnce('vac', 'Vac Posts fill up. Belt them to the Recycler to keep them running');
  if (isProc(b)) hintOnce('proc', 'Run a belt into it and another belt out of it, pointing away');
}
function addDrone(h, free) {
  if (h.drones >= HIVE_MAX) return;
  if (!free) { if (!canPay(DRONE_COST)) return toast('A drone needs ' + costText(DRONE_COST)); pay(DRONE_COST); }
  h.drones++;
  newBot(h.x + 1, h.y + 1, h.id);
}
function placeBelt(i, dir) {
  if (S.belt[i] >= 0) { S.belt[i] = dir; return true; }
  if (!freeTile(i)) return false;
  if (!canPay(MACH.belt.cost)) { toast('Belts need ' + costText(MACH.belt.cost) + ' each'); return false; }
  pay(MACH.belt.cost); clearUnder(i); S.belt[i] = dir; S.split[i] = 0; return true;
}
function placeSplitter(i) {
  if (S.split[i]) { S.belt[i] = (S.belt[i] + 1) % 4; return; }
  if (!unlocked('splitter')) return toast('Splitters unlock after recycling ' + fmt(MACH.splitter.unlock) + ' pieces');
  if (S.belt[i] < 0 && !freeTile(i)) return toast('Put the splitter on a belt or open ground');
  if (!canPay(MACH.splitter.cost)) return toast('A splitter needs ' + costText(MACH.splitter.cost));
  pay(MACH.splitter.cost);
  if (S.belt[i] < 0) { clearUnder(i); S.belt[i] = S.lastBeltDir; }
  S.split[i] = 1;
  hintOnce('split', 'Run belts out of its sides. It deals pieces out front, left and right in turn');
}
function removeBelt(i) { S.belt[i] = -1; S.split[i] = 0; S.items = S.items.filter(it => it.i !== i); }
function removeAt(x, y) {
  const i = idx(x, y);
  if (S.belt[i] >= 0) { if (S.split[i]) S.res[0] += 3; else S.res[0] += 1; removeBelt(i); return; }
  const id = S.bmap[i]; if (!id) return;
  const b = byId.get(id);
  if (b.kind === 'recycler' || b.kind === 'cap') return toast(b.kind === 'recycler' ? 'The Recycler stays' : 'Caps stay put');
  if (b.kind === 'garage' && S.vehicles.some(v => v.garage === b.id)) return toast('Move or sell its vehicles first');
  const m = MACH[b.kind];
  const back = c4(m.cost).map(v => Math.floor(v / 2));
  const held = b.store.slice(); if (isProc(b)) { for (let k = 0; k < 4; k++) held[k] += b.out[k]; held[m.input] += b.inp; }
  for (let k = 0; k < 4; k++) S.res[k] += back[k] + held[k];
  if (b.kind === 'hive') S.bots = S.bots.filter(o => o.hive !== b.id);
  S.buildings = S.buildings.filter(o => o !== b); rebuildIndex();
  if (sel && sel.id === b.id) select(null);
  toast(b.label + ' removed, half refunded');
}
function capVent(x, y) {
  if (!unlocked('cap')) return toast('Vent caps unlock after recycling ' + fmt(MACH.cap.unlock) + ' pieces');
  const v = S.vents.find(v => Math.abs(v.x - x) <= 1 && Math.abs(v.y - y) <= 1 && !v.capped);
  if (!v) return toast('Tap an open vent to cap it');
  if (!canPay(MACH.cap.cost)) return toast('A cap needs ' + costText(MACH.cap.cost));
  pay(MACH.cap.cost); v.capped = true;
  const i = idx(v.x, v.y); if (S.belt[i] >= 0) removeBelt(i);
  S.buildings.push({ id: S.nextId++, kind: 'cap', x: v.x, y: v.y, w: 1, h: 1, store: [0, 0, 0, 0], label: 'Vent cap' });
  rebuildIndex(); toast('Vent capped');
}

// ---------- belts ----------
const GAP = .34;
function canEnter(j, per) {
  const nxt = per.get(j);
  if (!nxt) return true;
  let minT = 1; for (const o of nxt) minT = Math.min(minT, o.t);
  return minT >= GAP;
}
// try to hand item `it` from tile i in direction d; returns 'gone', 'moved' or null
function handOff(it, i, d, per, moved) {
  const x = i % W + DIRS[d][0], y = (i / W | 0) + DIRS[d][1];
  if (!inMap(x, y)) return null;
  const j = idx(x, y);
  if (S.bmap[j]) {
    const b = byId.get(S.bmap[j]);
    if (b.kind === 'vac' || b.kind === 'garage' || b.kind === 'cap') return null;
    if (accept(b, it.k, 1)) { if (b.kind === 'recycler') S.stats.beltDelivered++; return 'gone'; }
    return null;
  }
  if (S.belt[j] >= 0 && S.belt[j] !== (d + 2) % 4 && canEnter(j, per)) { moved.push([it, j]); return 'moved'; }
  return null;
}
function stepBelts(dt) {
  if (S.items.length) {
    const v = uv('belt') * dt;
    const per = new Map();
    for (const it of S.items) { let a = per.get(it.i); if (!a) per.set(it.i, a = []); a.push(it); }
    const moved = [];
    for (const [i, arr] of per) {
      arr.sort((a, b) => b.t - a.t);
      const d = S.belt[i];
      for (let k = 0; k < arr.length; k++) {
        const lim = k === 0 ? 1 : arr[k - 1].t - GAP;
        arr[k].t = Math.max(arr[k].t, Math.min(arr[k].t + v, lim));
      }
      const head = arr[0];
      if (head.t < 1 || d < 0) continue;
      if (S.split[i]) {
        const outs = [d, (d + 3) % 4, (d + 1) % 4]; // front, left, right
        for (let n = 0; n < 3; n++) {
          const p = (S.spPtr[i] + n) % 3;
          const r = handOff(head, i, outs[p], per, moved);
          if (r) { if (r === 'gone') head.gone = true; S.spPtr[i] = (p + 1) % 3; if (p) S.stats.splits++; break; }
        }
      } else {
        const r = handOff(head, i, d, per, moved);
        if (r === 'gone') head.gone = true;
      }
    }
    for (const [it, j] of moved) { it.i = j; it.t = 0; }
    S.items = S.items.filter(it => !it.gone);
  }
  machinesOut(dt);
}
let outTick = 0;
function machinesOut(dt) {
  outTick += dt; if (outTick < .2) return; outTick = 0;
  const busy = new Set(); for (const it of S.items) if (it.t < GAP) busy.add(it.i);
  for (const b of S.buildings) {
    const src = outOf(b);
    if (!src || !sum4(src)) continue;
    for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) {
      const side = x < b.x ? 2 : x >= b.x + b.w ? 0 : y < b.y ? 3 : y >= b.y + b.h ? 1 : -1;
      const corner = (x < b.x || x >= b.x + b.w) && (y < b.y || y >= b.y + b.h);
      if (side < 0 || corner || !inMap(x, y)) continue;
      const j = idx(x, y);
      if (S.belt[j] !== side || busy.has(j)) continue;
      const k = src[3] ? 3 : src[2] ? 2 : src[1] ? 1 : 0;
      if (!src[k]) break;
      src[k]--; S.items.push({ i: j, t: 0, k }); busy.add(j);
    }
  }
}

// ---------- machines that work by themselves ----------
function stepMachines(dt) {
  for (const b of S.buildings) {
    if (b.kind === 'vac') {
      if (sum4(b.store) >= MACH.vac.cap) { b.full = true; continue; }
      b.full = false;
      b.acc += uv('vacrate') * dt;
      if (b.acc < 1) continue;
      if (b.tgt === undefined || b.tgt < 0 || !pileOf(b.tgt)) {
        b.tgt = ringSearch(b.x + .5, b.y + .5, MACH.vac.radius + .5, null, -1);
        if (b.tgt < 0) { b.acc = Math.min(b.acc, 1); b.idle = true; continue; }
      }
      b.idle = false;
      while (b.acc >= 1 && b.tgt >= 0 && pileOf(b.tgt) && sum4(b.store) < MACH.vac.cap) {
        b.acc -= 1;
        const tx = b.tgt % W + .5, ty = (b.tgt / W | 0) + .5;
        takeFromTile(b.tgt, 1, (k, t) => { b.store[k] += t; puff(tx, ty, { x: b.x + .5, y: b.y + .5 }, k); });
      }
    } else if (isProc(b)) {
      const m = MACH[b.kind];
      if (b.inp >= m.ratio && sum4(b.out) < PROC_OUT) {
        b.t += dt * uv('proc');
        b.working = true;
        if (b.t >= m.time) { b.t = 0; b.inp -= m.ratio; b.out[m.out]++; if (b.kind === 'compactor') S.stats.compacted++; }
      } else b.working = false;
    }
  }
}

// ---------- search ----------
// nearest junk by expanding square rings from (cx, cy), within radius R and an optional rect
function ringSearch(cx, cy, R, rect, botId, filter) {
  const x0 = Math.floor(cx), y0 = Math.floor(cy);
  const maxR = Math.min(Math.ceil(R) + 1, Math.max(W, H));
  let best = -1, bd = 1e9;
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      const edge = dy === -r || dy === r;
      const step = edge || r === 0 ? 1 : 2 * r;
      for (let dx = -r; dx <= r; dx += step) {
        const x = x0 + dx, y = y0 + dy;
        if (!inMap(x, y)) continue;
        if (rect && (x < rect.x0 || x > rect.x1 || y < rect.y0 || y > rect.y1)) continue;
        const i = idx(x, y);
        if (!pileOf(i)) continue;
        if (filter && !filter(i)) continue;
        if (botId >= 0) { const rv = reserved.get(i); if (rv !== undefined && rv !== botId) continue; }
        const ddx = x + .5 - cx, ddy = y + .5 - cy, d2 = ddx * ddx + ddy * ddy;
        if (d2 > R * R) continue;
        if (d2 < bd) { bd = d2; best = i; }
      }
    }
    if (best >= 0 && r * r >= bd) return best;
  }
  return best;
}

// ---------- bots ----------
const reserved = new Map();
const cargoN = b => sum4(b.cargo);
function areaOf(bot, arg) {
  if (arg === 'any' || arg === 'near') return { x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
  if (arg.startsWith('hive:')) {
    const h = byId.get(+arg.slice(5)); if (!h) return null;
    const R = MACH.hive.radius;
    return { x0: Math.max(0, h.x - R), y0: Math.max(0, h.y - R), x1: Math.min(W - 1, h.x + 1 + R), y1: Math.min(H - 1, h.y + 1 + R), r: R, cx: h.x + 1, cy: h.y + 1 };
  }
  return S.zones[ZL.indexOf(arg)] || null;
}
function findJunk(bot, a) {
  if (a.cx !== undefined) {
    const t = ringSearch(bot.x, bot.y, a.r * 2.5, a, bot.id);
    if (t >= 0 && Math.hypot(t % W + .5 - a.cx, (t / W | 0) + .5 - a.cy) <= a.r) return t;
    return ringSearch(a.cx, a.cy, a.r, a, bot.id);
  }
  const sx = clamp(bot.x, a.x0 + .5, a.x1 + .5), sy = clamp(bot.y, a.y0 + .5, a.y1 + .5);
  return ringSearch(sx, sy, 999, a, bot.id);
}
function release(bot) { if (bot.tgt >= 0 && reserved.get(bot.tgt) === bot.id) reserved.delete(bot.tgt); bot.tgt = -1; }
function flyTo(bot, tx, ty, dt) {
  const dx = tx - bot.x, dy = ty - bot.y, d = Math.hypot(dx, dy);
  const step = uv('speed') * dt * (bot.hive ? .9 : 1);
  if (d > .01) bot.ang = Math.atan2(dy, dx);
  if (d <= step) { bot.x = tx; bot.y = ty; return true; }
  bot.x += dx / d * step; bot.y += dy / d * step; return false;
}
function nearestPoint(b, x, y) { return [clamp(x, b.x + .5, b.x + b.w - .5), clamp(y, b.y + .5, b.y + b.h - .5)]; }
const isDrop = b => b.kind === 'recycler' || b.kind === 'bin';
function nearestDrop(x, y) {
  let best = recycler(), bd = 1e9;
  for (const b of S.buildings) {
    if (!isDrop(b) || (b.kind === 'bin' && sum4(b.store) >= capOf(b))) continue;
    const [px, py] = nearestPoint(b, x, y), d = Math.hypot(px - x, py - y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function dropTarget(bot, arg) {
  if (arg === 'recycler') return recycler();
  if (arg.startsWith('bin:')) return byId.get(+arg.slice(4)) || null;
  return nearestDrop(bot.x, bot.y);
}
function nextStep(bot) {
  release(bot); bot.timer = 0;
  bot.pc++;
  if (bot.pc >= bot.prog.length) {
    bot.pc = 0;
    if (!bot.worked) bot.idle = bot.hive ? 2.5 : 1.5;
    bot.worked = false;
  }
}
function botUpdate(bot, dt) {
  if (!bot.prog.length) { bot.status = 'No program'; return; }
  if (bot.idle > 0) { bot.idle -= dt; bot.status = 'Idle: nothing to do'; return; }
  if (bot.pc >= bot.prog.length) bot.pc = 0;
  const st = bot.prog[bot.pc];
  const cap = uv('cargo');
  if (st.op === 'sweep') {
    const a = areaOf(bot, st.arg);
    if (!a) { bot.status = 'Zone ' + st.arg + ' is not painted'; return nextStep(bot); }
    if (cargoN(bot) >= cap) return nextStep(bot);
    if (bot.tgt < 0 || !pileOf(bot.tgt)) {
      release(bot);
      const t = findJunk(bot, a);
      if (t < 0) return nextStep(bot);
      bot.tgt = t; reserved.set(t, bot.id);
    }
    bot.status = st.arg === 'any' || st.arg === 'near' ? 'Sweeping nearest junk' : bot.hive ? 'Sweeping around the hive' : 'Sweeping Zone ' + st.arg;
    const tx = bot.tgt % W + .5, ty = (bot.tgt / W | 0) + .5;
    if (flyTo(bot, tx, ty, dt)) {
      bot.acc += uv('suction') * dt * (bot.hive ? .8 : 1);
      while (bot.acc >= 1 && cargoN(bot) < cap && pileOf(bot.tgt)) {
        bot.acc -= 1;
        takeFromTile(bot.tgt, 1, (k, t) => { bot.cargo[k] += t; puff(tx, ty, bot, k); });
        bot.worked = true;
      }
      if (cargoN(bot) >= cap) { bot.acc = 0; nextStep(bot); }
    }
  } else if (st.op === 'unload') {
    if (!cargoN(bot)) return nextStep(bot);
    const b = dropTarget(bot, st.arg);
    if (!b) { bot.status = 'That drop-off is gone'; return nextStep(bot); }
    bot.status = 'Unloading at ' + b.label;
    const [px, py] = nearestPoint(b, bot.x, bot.y);
    if (flyTo(bot, px, py, dt)) {
      bot.timer += dt; if (bot.timer < .25) return;
      bot.timer = 0;
      let moved = 0;
      for (const k of [0, 1, 2, 3]) { const t = accept(b, k, bot.cargo[k]); bot.cargo[k] -= t; moved += t; }
      if (moved) bot.worked = true;
      if (cargoN(bot)) { if (st.arg === 'nearest') return; bot.status = b.label + ' is full, waiting'; }
      else nextStep(bot);
    }
  } else if (st.op === 'fetch') {
    const b = st.arg.startsWith('bin:') ? byId.get(+st.arg.slice(4)) : null;
    const src = b && outOf(b);
    if (!src) { bot.status = 'Pick something to fetch from'; return nextStep(bot); }
    if (cargoN(bot) >= cap) return nextStep(bot);
    bot.status = 'Fetching from ' + b.label;
    const [px, py] = nearestPoint(b, bot.x, bot.y);
    if (flyTo(bot, px, py, dt)) {
      bot.timer += dt; if (bot.timer < .25) return;
      bot.timer = 0;
      if (!sum4(src)) return nextStep(bot);
      for (const k of [3, 2, 1, 0]) {
        const t = Math.min(src[k], cap - cargoN(bot)); src[k] -= t; bot.cargo[k] += t;
        if (t) { bot.worked = true; S.stats.fetched += t; }
      }
      nextStep(bot);
    }
  } else if (st.op === 'wait') {
    bot.status = 'Waiting ' + Math.ceil(+st.arg - bot.timer) + ' s';
    bot.timer += dt;
    if (bot.timer >= +st.arg) { bot.worked = true; nextStep(bot); }
  } else nextStep(bot);
}

// ---------- vents ----------
function stepVents(dt) {
  for (const v of S.vents) {
    if (v.capped) continue;
    v.t -= dt;
    if (v.t > 0) continue;
    v.t = 6 + rng() * 3;
    for (let tries = 0; tries < 6; tries++) {
      const a = rng() * Math.PI * 2, r = 1 + rng() * 4.5;
      const x = Math.round(v.x + Math.cos(a) * r), y = Math.round(v.y + Math.sin(a) * r);
      if (!inMap(x, y)) continue;
      const i = idx(x, y);
      if (S.rock[i] || S.bmap[i] || S.belt[i] >= 0 || isVent(i)) continue;
      addDebris(i, rng() < .28 ? 1 : rng() < .04 ? 2 : 0, 1);
      break;
    }
  }
}

// ---------- movement shared by the janitor and vehicles ----------
const keys = new Set();
let stick = null; // {ax, ay, x, y} screen px while steering by touch
const meR = .32, vehR = .55;
function solidAt(x, y, plow) {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (!inMap(tx, ty)) return true;
  const i = idx(tx, ty);
  if (S.rock[i]) {
    if (plow && Math.min(tx, ty, W - 1 - tx, H - 1 - ty) > 0) { breakRock(i); return false; }
    return true;
  }
  return !!(S.bmap[i] || isVent(i));
}
function blockedAt(x, y, r, plow) { return solidAt(x - r, y - r, plow) || solidAt(x + r, y - r, plow) || solidAt(x - r, y + r, plow) || solidAt(x + r, y + r, plow); }
function breakRock(i) {
  S.rock[i] = 0;
  const n = addDebris(i, 1, 3 + (rng() * 3 | 0)) + (rng() < .3 ? addDebris(i, 2, 1) : 0);
  S.initial += n; S.stats.rocks++;
  const x = i % W, y = i / W | 0;
  for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (inMap(xx, yy)) dirty.add(idx(xx, yy));
  puff(x + .5, y + .5, { x: x + .5, y: y - .2 }, 1);
}
function inputVec() {
  let vx = 0, vy = 0;
  if (stick) { const dx = stick.x - stick.ax, dy = stick.y - stick.ay, d = Math.hypot(dx, dy); if (d > 6) { const s = Math.min(1, d / 60); vx = dx / d * s; vy = dy / d * s; } }
  if (keys.has('a') || keys.has('arrowleft')) vx -= 1;
  if (keys.has('d') || keys.has('arrowright')) vx += 1;
  if (keys.has('w') || keys.has('arrowup')) vy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) vy += 1;
  const l = Math.hypot(vx, vy); if (l > 1) { vx /= l; vy /= l; }
  return [vx, vy, Math.min(1, l)];
}
// a vacuum: pulls the nearest junk within reach into `cargo`
function vacuum(o, cx, cy, reach, rate, cap, dt, magnet) {
  if (sum4(o.cargo) >= cap) return false;
  o.vacAcc = (o.vacAcc || 0) + rate * dt;
  let guard = 0;
  const shiny = i => S.scrap[i] || S.crys[i];
  while (o.vacAcc >= 1 && sum4(o.cargo) < cap && guard++ < 80) {
    let t = ringSearch(cx, cy, reach, null, -1);
    let only = null;
    if (t < 0 && magnet) { t = ringSearch(cx, cy, reach * 2, null, -1, shiny); only = [0, 1, 1]; }
    if (t < 0) { o.vacAcc = Math.min(o.vacAcc, 1); break; }
    o.vacAcc -= 1;
    const tx = t % W + .5, ty = (t / W | 0) + .5;
    takeFromTile(t, 1, (k, n) => { o.cargo[k] += n; if (o === S.me) S.stats.picked += n; puff(tx, ty, o, k); }, only);
  }
  return true;
}
// unload `cargo` into any drop-off within range (bins, hives and the Recycler)
function unloadNear(o, range, dt) {
  if (!sum4(o.cargo)) { o.unAcc = 0; return; }
  for (const b of S.buildings) {
    if (b.kind !== 'recycler' && b.kind !== 'bin' && b.kind !== 'hive') continue;
    const [px, py] = nearestPoint(b, o.x, o.y);
    if (Math.hypot(px - o.x, py - o.y) > range) continue;
    o.unAcc = (o.unAcc || 0) + 80 * dt;
    while (o.unAcc >= 1 && sum4(o.cargo)) {
      o.unAcc -= 1;
      const k = o.cargo[3] ? 3 : o.cargo[2] ? 2 : o.cargo[1] ? 1 : 0;
      if (!accept(b, k, 1, o !== S.me && !o.driver)) { o.unAcc = 0; break; }
      o.cargo[k]--;
      if (rng() < .4) puff(o.x, o.y, { x: px, y: py }, k);
    }
    if (sum4(o.cargo)) continue;
    break;
  }
}

// ---------- the janitor ----------
function playerOn(tx, ty) { const m = S.me; return Math.abs(m.x - (tx + .5)) < .5 + meR && Math.abs(m.y - (ty + .5)) < .5 + meR; }
const meN = () => sum4(S.me.cargo);
let wasFull = false;
function stepMe(dt) {
  const m = S.me;
  if (m.inVeh) return;
  const [vx, vy, l] = inputVec();
  const sp = uv('boots') * dt;
  if (l > .05) {
    m.ang = Math.atan2(vy, vx); m.step += dt * (4 + uv('boots'));
    const nx = m.x + vx * sp, ny = m.y + vy * sp;
    if (!blockedAt(nx, m.y, meR)) m.x = nx;
    if (!blockedAt(m.x, ny, meR)) m.y = ny;
    follow = true;
  }
  const bd = S.belt[idx(clamp(Math.floor(m.x), 0, W - 1), clamp(Math.floor(m.y), 0, H - 1))];
  if (bd >= 0) { const bx = m.x + DIRS[bd][0] * uv('belt') * dt * .8, by = m.y + DIRS[bd][1] * uv('belt') * dt * .8; if (!blockedAt(bx, m.y, meR)) m.x = bx; if (!blockedAt(m.x, by, meR)) m.y = by; }
  const ok = vacuum(m, m.x + Math.cos(m.ang) * .25, m.y + Math.sin(m.ang) * .25, uv('reach'), uv('power'), uv('pack'), dt, false);
  if (ok) wasFull = false; else if (!wasFull) { wasFull = true; toast('Backpack full. Walk up to the Recycler or a bin.'); }
  unloadNear(m, 1.6, dt);
}

// ---------- vehicles ----------
const vStat = (v, k) => {
  const T = VEH[v.type];
  if (k === 'speed') return T.speed * VUPG.engine.mult[v.up.engine];
  if (k === 'hopper') return Math.round(T.hopper * VUPG.hopper.mult[v.up.hopper]);
  if (k === 'reach') return +(T.reach * (1 + (VUPG.intake.mult[v.up.intake] - 1) * .6)).toFixed(1);
  if (k === 'power') return Math.round(T.power * VUPG.intake.mult[v.up.intake]);
};
const garageOf = v => byId.get(v.garage);
function garageFront(g) {
  const want = [g.x + 1.5, g.y + g.h + .8];
  for (let r = 0; r < 6; r++) for (let a = 0; a < 12; a++) {
    const x = want[0] + Math.cos(a / 12 * 6.283 + 1.57) * r * .9, y = want[1] + Math.sin(a / 12 * 6.283 + 1.57) * r * .9;
    if (!blockedAt(x, y, vehR, false)) return [x, y];
  }
  return want;
}
function buyVehicle(g, type) {
  const T = VEH[type];
  if (S.vehicles.filter(v => v.garage === g.id).length >= g.stalls) return toast('Every stall is full. Add a stall first.');
  if (!canPay(T.cost)) return toast('A ' + T.name + ' needs ' + costText(T.cost));
  pay(T.cost);
  const v = { id: S.nextId++, type, name: T.name + ' ' + S.no[type]++, garage: g.id, parked: true, x: g.x + 1.5, y: g.y + 1, ang: Math.PI / 2, vel: 0,
    cargo: [0, 0, 0, 0], up: { engine: 0, hopper: 0, intake: 0 }, feat: { plow: 0, magnet: 0, dump: 0, auto: 0 }, mode: null, arg: 'near', tgt: -1, status: 'Parked' };
  S.vehicles.push(v);
  toast(v.name + ' is in the garage');
  hintOnce('drive', 'Walk up to the garage and tap Drive');
  return v;
}
function board(v) {
  const m = S.me;
  if (m.inVeh) return;
  const g = garageOf(v);
  const near = v.parked ? g && Math.hypot(...nearestPoint(g, m.x, m.y).map((p, i) => p - [m.x, m.y][i])) < 2.6 : Math.hypot(v.x - m.x, v.y - m.y) < 2.4;
  if (!near) return toast(v.parked ? 'Walk up to the garage first' : 'Walk up to the ' + VEH[v.type].name + ' first');
  if (v.parked) { const [x, y] = garageFront(g); v.x = x; v.y = y; v.ang = Math.PI / 2; v.parked = false; }
  v.mode = null; v.driver = true; m.inVeh = v.id; v.status = 'You are driving';
  m.cargo.forEach((n, k) => { v.cargo[k] += n; m.cargo[k] = 0; });
  S.stats.driven++;
  follow = true; select(null); updateDriveBar();
}
function hopOut() {
  const m = S.me, v = S.vehicles.find(o => o.id === m.inVeh);
  m.inVeh = 0;
  if (!v) return updateDriveBar();
  v.driver = false; v.vel = 0; v.status = 'Waiting where you left it';
  const side = v.ang + Math.PI / 2;
  for (let r = 1; r < 5; r++) for (let a = 0; a < 8; a++) {
    const x = v.x + Math.cos(side + a * .785) * r * .8, y = v.y + Math.sin(side + a * .785) * r * .8;
    if (!blockedAt(x, y, meR)) { m.x = x; m.y = y; updateDriveBar(); return; }
  }
  m.x = v.x; m.y = v.y; updateDriveBar();
}
function park(v) {
  const g = garageOf(v); if (!g) return;
  if (S.me.inVeh === v.id) { hopOut(); const [x, y] = garageFront(g); S.me.x = x; S.me.y = y; }
  v.parked = true; v.mode = null; v.vel = 0; v.status = 'Parked'; v.driver = false;
  updateDriveBar();
}
const nearHome = v => { const g = garageOf(v); if (!g) return false; const [px, py] = nearestPoint(g, v.x, v.y); return Math.hypot(px - v.x, py - v.y) < 2.4; };
function driveVehicle(v, vx, vy, l, dt) {
  const top = vStat(v, 'speed');
  if (l > .05) {
    const want = Math.atan2(vy, vx);
    let da = want - v.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    v.ang += clamp(da, -7 * dt, 7 * dt);
    const align = Math.max(0, Math.cos(da));
    v.vel += (top * l * (.35 + .65 * align) - v.vel) * Math.min(1, dt * 4);
  } else v.vel += (0 - v.vel) * Math.min(1, dt * 6);
  const nx = v.x + Math.cos(v.ang) * v.vel * dt, ny = v.y + Math.sin(v.ang) * v.vel * dt;
  const plow = !!v.feat.plow;
  let moved = false;
  if (!blockedAt(nx, v.y, vehR, plow)) { v.x = nx; moved = true; }
  if (!blockedAt(v.x, ny, vehR, plow)) { v.y = ny; moved = true; }
  if (!moved) v.vel *= .5;
  v.wheel = (v.wheel || 0) + v.vel * dt * 3;
}
function stepVehicles(dt) {
  for (const v of S.vehicles) {
    if (v.parked) continue;
    if (S.me.inVeh === v.id) {
      const [vx, vy, l] = inputVec();
      driveVehicle(v, vx, vy, l, dt);
      if (l > .05) follow = true;
    } else if (v.mode) autopilot(v, dt);
    else { v.vel *= .9; }
    if (v.parked) continue;
    const fx = Math.cos(v.ang), fy = Math.sin(v.ang);
    vacuum(v, v.x + fx * .7, v.y + fy * .7, vStat(v, 'reach'), vStat(v, 'power'), vStat(v, 'hopper'), dt, !!v.feat.magnet);
    unloadNear(v, v.feat.dump ? 6 : 2.2, dt);
  }
}
function autopilot(v, dt) {
  v.avoid = v.avoid || new Map();
  for (const [i, t] of v.avoid) if (t < S.time) v.avoid.delete(i);
  let tx, ty;
  const full = sum4(v.cargo) >= vStat(v, 'hopper');
  if (v.mode === 'home') {
    const g = garageOf(v); if (!g) { v.mode = null; return; }
    [tx, ty] = garageFront(g);
    v.status = 'Heading home';
    if (Math.hypot(tx - v.x, ty - v.y) < 1.4) { if (sum4(v.cargo)) { v.mode = 'unload-home'; } else { park(v); return; } }
  }
  if (v.mode === 'unload-home') {
    if (!sum4(v.cargo)) { v.mode = 'home'; return; }
    const b = nearestDrop(v.x, v.y); [tx, ty] = nearestPoint(b, v.x, v.y); v.status = 'Unloading before parking';
  } else if (v.mode === 'sweep') {
    if (full) {
      const b = nearestDrop(v.x, v.y); [tx, ty] = nearestPoint(b, v.x, v.y);
      v.status = 'Unloading at ' + b.label;
    } else {
      const rect = v.arg === 'near' ? null : S.zones[ZL.indexOf(v.arg)];
      if (v.arg !== 'near' && !rect) { v.status = 'Zone ' + v.arg + ' is not painted'; v.mode = 'home'; return; }
      if (v.tgt < 0 || !pileOf(v.tgt) || v.avoid.has(v.tgt)) {
        const sx = rect ? clamp(v.x, rect.x0 + .5, rect.x1 + .5) : v.x, sy = rect ? clamp(v.y, rect.y0 + .5, rect.y1 + .5) : v.y;
        v.tgt = ringSearch(sx, sy, 999, rect, -1, i => !v.avoid.has(i));
        if (v.tgt < 0) { v.status = 'Nothing left to clean'; v.mode = sum4(v.cargo) ? 'unload-home' : 'home'; return; }
      }
      tx = v.tgt % W + .5; ty = (v.tgt / W | 0) + .5;
      v.status = v.arg === 'near' ? 'Cleaning on autopilot' : 'Cleaning Zone ' + v.arg;
    }
  }
  if (tx === undefined) return;
  // escape manoeuvre after getting stuck
  if (v.escape > 0) { v.escape -= dt; driveVehicle(v, Math.cos(v.escAng), Math.sin(v.escAng), 1, dt); return; }
  const dx = tx - v.x, dy = ty - v.y, d = Math.hypot(dx, dy);
  driveVehicle(v, dx / (d || 1), dy / (d || 1), clamp(d / 1.5, .35, 1), dt);
  v.chk = (v.chk || 0) + dt;
  if (v.chk > 1.2) {
    const p = v.lastP || [v.x + 9, v.y];
    if (Math.hypot(v.x - p[0], v.y - p[1]) < .35) {
      if (v.tgt >= 0 && v.mode === 'sweep' && !full) v.avoid.set(v.tgt, S.time + 30);
      v.tgt = -1; v.escape = .9; v.escAng = v.ang + Math.PI * (.6 + rng() * .8);
    }
    v.lastP = [v.x, v.y]; v.chk = 0;
  }
}
function dispatch(v, arg) {
  if (!v.feat.auto) return toast('Add Autopilot first');
  if (S.me.inVeh === v.id) hopOut();
  if (v.parked) { const g = garageOf(v); const [x, y] = garageFront(g); v.x = x; v.y = y; v.parked = false; }
  v.mode = 'sweep'; v.arg = arg; v.tgt = -1; v.driver = false;
  toast(v.name + ' is heading out');
}

// ---------- particles (visual only) ----------
const parts = [];
function puff(x, y, to, k) {
  if (parts.length > 300) return;
  parts.push({ x: x + (rng() - .5) * .6, y: y + (rng() - .5) * .6, to, k, life: 0 });
}
function stepParts(dt) {
  for (const p of parts) {
    p.life += dt;
    const dx = p.to.x - p.x, dy = p.to.y - p.y, d = Math.hypot(dx, dy) || 1;
    const sp = 6 + p.life * 30;
    p.x += dx / d * Math.min(d, sp * dt); p.y += dy / d * Math.min(d, sp * dt);
    if (d < .15 || p.life > .7) p.dead = true;
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].dead) parts.splice(i, 1);
}

// ---------- tasks ----------
const capped = () => S.vents.filter(v => v.capped).length;
const count = kind => S.buildings.filter(b => b.kind === kind).length;
const anyFeat = () => S.vehicles.some(v => Object.values(v.feat).some(Boolean) || Object.values(v.up).some(Boolean));
const TASKS = [
  { id: 'walk', text: 'Drag to walk. Your vacuum picks up 30 pieces', p: () => S.stats.picked / 30, reward: [10, 2] },
  { id: 'drop', text: 'Walk up to the Recycler to empty your backpack', p: () => S.stats.recycled > 0 ? 1 : 0, reward: [10, 2] },
  { id: 'suit', text: 'Upgrade your suit in Build', p: () => (S.upg.pack + S.upg.power + S.upg.reach + S.upg.boots) > 0 ? 1 : 0, reward: [20, 4] },
  { id: 'belt', text: 'Build a bin and belt it into the Recycler', p: () => S.stats.beltDelivered > 0 ? 1 : 0, reward: [30, 8] },
  { id: 'vac', text: 'Put a Vac Post on a belt line', p: () => S.buildings.some(b => b.kind === 'vac' && b.fed) ? 1 : 0, reward: [40, 10, 1] },
  { id: 'split', text: 'Branch a belt with a Splitter', p: () => S.stats.splits > 0 ? 1 : 0, reward: [40, 10, 1] },
  { id: 'compact', text: 'Press dust into scrap with a Compactor', p: () => S.stats.compacted > 0 ? 1 : 0, reward: [50, 15, 1] },
  { id: 'bot', text: 'Build your first bot (Build)', p: () => ownBots() ? 1 : 0, reward: [40, 10, 1] },
  { id: 'zone', text: 'Paint Zone B and send a bot to sweep it', p: () => S.zones[1] && S.bots.some(b => b.prog.some(s => s.op === 'sweep' && s.arg === 'B')) ? 1 : 0, reward: [60, 15, 2] },
  { id: 'alloy', text: 'Smelt your first alloy and belt it home', p: () => S.stats.alloy > 0 ? 1 : 0, reward: [60, 20, 2, 4] },
  { id: 'garage', text: 'Build a Garage and buy a Rover', p: () => S.vehicles.length ? 1 : 0, reward: [80, 30, 2, 4] },
  { id: 'drive', text: 'Take a vehicle for a drive', p: () => S.stats.driven > 0 ? 1 : 0, reward: [60, 20, 2] },
  { id: 'five', text: 'Run five bots at once', p: () => ownBots() / 5, reward: [100, 30, 3] },
  { id: 'cap1', text: 'Cap a junk vent', p: () => capped() ? 1 : 0, reward: [150, 40, 4] },
  { id: 'vup', text: 'Upgrade a vehicle or add a feature', p: () => anyFeat() ? 1 : 0, reward: [100, 40, 3, 6] },
  { id: 'hive', text: 'Build a Drone Hive', p: () => count('hive') ? 1 : 0, reward: [150, 50, 5] },
  { id: 'fleet', text: 'Grow your fleet to three vehicles', p: () => S.vehicles.length / 3, reward: [200, 80, 6, 10] },
  { id: 'auto', text: 'Machines recycle 5,000 pieces for you', p: () => S.stats.byMachines / 5000, reward: [300, 100, 10, 10] },
  { id: 'capall', text: 'Cap all six vents', p: () => capped() / VENTS, reward: [0] },
  { id: 'clean', text: 'Sweep the whole rock spotless', p: () => cleanFrac(), reward: [0] },
];
const cleanFrac = () => clamp(1 - S.remaining / S.initial, 0, 1);
function checkTasks() {
  for (const b of S.buildings) if (b.kind === 'vac' && !b.fed) b.fed = [0, 1, 2, 3].some(d => { const x = b.x + DIRS[d][0], y = b.y + DIRS[d][1]; return inMap(x, y) && S.belt[idx(x, y)] === d; });
  for (const t of TASKS) {
    if (S.tasksDone.includes(t.id)) continue;
    if (t.p() >= 1) {
      S.tasksDone.push(t.id);
      const r = c4(t.reward);
      for (let k = 0; k < 4; k++) S.res[k] += r[k];
      toast('Task done' + (r[0] ? '  +' + costText(r) : ''));
      if (panelMode === 'tasks') renderPanel();
    }
  }
  for (const k of ['belt', 'vac', 'compactor', 'smelter', 'garage', 'cap', 'hive']) if (unlocked(k) && !S.hintsSeen['un-' + k]) { S.hintsSeen['un-' + k] = 1; if (S.time > 1) toast(MACH[k].name + ' unlocked'); }
  if (unlocked('bot') && !S.hintsSeen['un-bot']) { S.hintsSeen['un-bot'] = 1; if (S.time > 1) toast('Bots unlocked. Open Build to make one'); }
  if (!S.won && S.remaining === 0 && S.vents.every(v => v.capped)) { S.won = true; showWin(); }
}
const curTask = () => TASKS.find(t => !S.tasksDone.includes(t.id));

// ---------- simulation ----------
function tick(dt) {
  S.time += dt;
  stepVents(dt);
  stepMe(dt);
  stepVehicles(dt);
  stepMachines(dt);
  for (const b of S.bots) botUpdate(b, dt);
  stepBelts(dt);
}

// ---------- ground (one cached canvas, tiles redrawn when their junk changes) ----------
const cv = $('world'), ctx = cv.getContext('2d');
let dpr = 1, vw = 0, vh = 0;
const cam = { x: 0, y: 0, z: 1.3 };
let follow = true;
let ground, gctx, toneMap, craters = [];
const PAL = {
  space: '#151a27', reg: [186, 177, 198], crater: '#a39aaf', craterHi: '#cdc6d6', rock: '#857b92', rockHi: '#9b92a8', rockLo: '#6c6379',
  dust: ['#7b6f86', '#8e8299', '#695e74'], scrap: '#56697d', scrapHi: '#b4c7d8', crys: '#3fd8c8', crysHi: '#c2fff6', alloy: '#d9774a', alloyHi: '#ffc09a',
};
function buildGround() {
  toneMap = document.createElement('canvas'); toneMap.width = W * 2; toneMap.height = H * 2;
  const tc = toneMap.getContext('2d'), img = tc.createImageData(toneMap.width, toneMap.height);
  for (let y = 0; y < toneMap.height; y++) for (let x = 0; x < toneMap.width; x++) {
    const s = (fbm(x / 14, y / 14, S.seed + 21) - .5) * 26 + (fbm(x / 3, y / 3, S.seed + 22) - .5) * 8, o = (y * toneMap.width + x) * 4;
    img.data[o] = PAL.reg[0] + s; img.data[o + 1] = PAL.reg[1] + s; img.data[o + 2] = PAL.reg[2] + s * .8; img.data[o + 3] = 255;
  }
  tc.putImageData(img, 0, 0);
  const R = mulberry(S.seed + 99);
  craters = [];
  for (let k = 0; k < 190; k++) craters.push({ x: R() * W * TS, y: R() * H * TS, r: 6 + Math.pow(R(), 2.2) * 70 });
  if (!ground) { ground = document.createElement('canvas'); ground.width = W * TS * GS; ground.height = H * TS * GS; gctx = ground.getContext('2d'); }
  gctx.setTransform(GS, 0, 0, GS, 0, 0);
  gctx.imageSmoothingEnabled = true;
  gctx.drawImage(toneMap, 0, 0, W * TS, H * TS);
  for (const c of craters) drawCrater(gctx, c);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (S.rock[idx(x, y)]) drawBoulder(gctx, x, y);
  for (let i = 0; i < N; i++) if (pileOf(i)) { gctx.save(); gctx.beginPath(); gctx.rect((i % W) * TS, (i / W | 0) * TS, TS, TS); gctx.clip(); drawPile(i); gctx.restore(); }
  dirty.clear();
}
function drawCrater(t, c) {
  t.fillStyle = PAL.craterHi; t.beginPath(); t.arc(c.x + c.r * .08, c.y + c.r * .08, c.r, 0, 7); t.fill();
  t.fillStyle = PAL.crater; t.beginPath(); t.arc(c.x - c.r * .04, c.y - c.r * .04, c.r * .94, 0, 7); t.fill();
  t.fillStyle = `rgba(${PAL.reg.join(',')},.55)`; t.beginPath(); t.arc(c.x + c.r * .1, c.y + c.r * .1, c.r * .8, 0, 7); t.fill();
}
function drawBoulder(t, x, y) {
  const cx = x * TS + TS / 2, cy = y * TS + TS / 2, rr = TS * .62;
  const pts = []; for (let a = 0; a < 7; a++) { const ang = a / 7 * 6.283 + hash2(x, y, a) * .5; const rad = rr * (.78 + hash2(y, x, a) * .3); pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]); }
  t.fillStyle = PAL.rockLo; poly(t, pts.map(p => [p[0] + 3, p[1] + 4])); t.fill();
  t.fillStyle = PAL.rock; poly(t, pts); t.fill();
  t.fillStyle = PAL.rockHi; poly(t, pts.map(p => [cx + (p[0] - cx) * .55 - 3, cy + (p[1] - cy) * .55 - 4])); t.fill();
}
function redrawTile(i) {
  const x = i % W, y = i / W | 0, ox = x * TS, oy = y * TS;
  gctx.save(); gctx.beginPath(); gctx.rect(ox, oy, TS, TS); gctx.clip();
  gctx.drawImage(toneMap, 0, 0, W * TS, H * TS);
  for (const c of craters) if (c.x + c.r * 1.1 > ox && c.x - c.r * 1.1 < ox + TS && c.y + c.r * 1.1 > oy && c.y - c.r * 1.1 < oy + TS) drawCrater(gctx, c);
  for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) if (inMap(xx, yy) && S.rock[idx(xx, yy)]) drawBoulder(gctx, xx, yy);
  if (pileOf(i)) drawPile(i);
  gctx.restore();
}
function poly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
function drawPile(i) {
  const x = i % W, y = i / W | 0, ox = x * TS, oy = y * TS, s = S.seed, c = gctx;
  const mx = ox + 9 + hash2(x, y, s + 5) * (TS - 18), my = oy + 9 + hash2(y, x, s + 5) * (TS - 18);
  const nd = S.dust[i];
  if (nd > 3) { c.fillStyle = 'rgba(96,84,108,.35)'; c.beginPath(); c.ellipse(mx, my + 1, 6 + nd * .9, 4 + nd * .6, 0, 0, 7); c.fill(); }
  for (let k = 0; k < nd; k++) {
    const a = hash2(x * 31 + k, y, s) * 6.283, rad = Math.sqrt(hash2(x, y * 31 + k, s)) * (4 + nd * .9);
    const px = clamp(mx + Math.cos(a) * rad, ox + 3, ox + TS - 3), py = clamp(my + Math.sin(a) * rad * .75, oy + 3, oy + TS - 3);
    const r = 2 + hash2(k, x + y, s) * 2.6;
    c.fillStyle = PAL.dust[k % 3]; c.beginPath(); c.ellipse(px, py, r * 1.25, r, hash2(x, k, s) * 3, 0, 7); c.fill();
    c.fillStyle = 'rgba(214,206,224,.5)'; c.beginPath(); c.arc(px - r * .35, py - r * .4, r * .4, 0, 7); c.fill();
  }
  for (let k = 0; k < S.scrap[i]; k++) {
    const px = ox + 7 + hash2(x * 17 + k, y, s + 1) * (TS - 14), py = oy + 7 + hash2(x, y * 17 + k, s + 1) * (TS - 14);
    c.save(); c.translate(px, py); c.rotate(hash2(k, y, s) * 6.28);
    c.fillStyle = PAL.scrap; c.fillRect(-4.5, -2.5, 9, 5);
    c.fillStyle = PAL.scrapHi; c.fillRect(-4.5, -2.5, 9, 1.6);
    c.restore();
  }
  for (let k = 0; k < S.crys[i]; k++) {
    const px = ox + 8 + hash2(x * 13 + k, y, s + 2) * (TS - 16), py = oy + 8 + hash2(x, y * 13 + k, s + 2) * (TS - 16);
    c.fillStyle = PAL.crys; poly(c, [[px, py - 6], [px + 3.5, py], [px, py + 5], [px - 3.5, py]]); c.fill();
    c.fillStyle = PAL.crysHi; poly(c, [[px, py - 6], [px + 3.5, py], [px, py]]); c.fill();
  }
}
function flushDirty() {
  if (!dirty.size) return;
  for (const i of dirty) redrawTile(i);
  dirty.clear();
}

// ---------- rendering ----------
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  vw = innerWidth; vh = innerHeight;
  cv.width = vw * dpr; cv.height = vh * dpr;
  if (S) clampCam();
}
function minZoom() { return Math.max(.35, Math.min(vw / (W * TS), vh / (H * TS)) * .95); }
function clampCam() {
  cam.z = clamp(cam.z, minZoom(), 3);
  const hw = vw / 2 / cam.z, hh = vh / 2 / cam.z, m = 160;
  cam.x = W * TS < hw * 2 - m * 2 ? W * TS / 2 : clamp(cam.x, hw - m, W * TS - hw + m);
  cam.y = H * TS < hh * 2 - m * 2 ? H * TS / 2 : clamp(cam.y, hh - m, H * TS - hh + m);
}
const toWorld = (sx, sy) => [(sx - vw / 2) / cam.z + cam.x, (sy - vh / 2) / cam.z + cam.y];
function focus() { const v = S.me.inVeh && S.vehicles.find(o => o.id === S.me.inVeh); return v ? [v.x, v.y] : [S.me.x, S.me.y]; }

function render(now, dt) {
  flushDirty();
  const t = now / 1000;
  if (paused) { cam.x += 6 * dt; if (cam.x > W * TS - vw / 2 / cam.z) cam.x = vw / 2 / cam.z; clampCam(); }
  else if (follow) { const [fx, fy] = focus(), k = Math.min(1, dt * 6); cam.x += (fx * TS - cam.x) * k; cam.y += (fy * TS - cam.y) * k; clampCam(); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PAL.space; ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = 'rgba(220,225,245,.5)';
  for (let k = 0; k < 90; k++) ctx.fillRect(hash2(k, 1, 7) * vw, hash2(k, 2, 7) * vh, 1.2, 1.2);
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (vw / 2 - cam.x * cam.z), dpr * (vh / 2 - cam.y * cam.z));
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(8, 12, W * TS, H * TS);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(ground, 0, 0, ground.width, ground.height, 0, 0, W * TS, H * TS);
  const [vx0, vy0] = toWorld(0, 0), [vx1, vy1] = toWorld(vw, vh);
  const V = { x0: clamp(Math.floor(vx0 / TS) - 1, 0, W - 1), y0: clamp(Math.floor(vy0 / TS) - 1, 0, H - 1), x1: clamp(Math.floor(vx1 / TS) + 1, 0, W - 1), y1: clamp(Math.floor(vy1 / TS) + 1, 0, H - 1) };
  if (!paused && tool !== 'walk') {
    ctx.strokeStyle = 'rgba(30,34,51,.12)'; ctx.lineWidth = 1 / cam.z; ctx.beginPath();
    for (let x = V.x0; x <= V.x1 + 1; x++) { ctx.moveTo(x * TS, V.y0 * TS); ctx.lineTo(x * TS, (V.y1 + 1) * TS); }
    for (let y = V.y0; y <= V.y1 + 1; y++) { ctx.moveTo(V.x0 * TS, y * TS); ctx.lineTo((V.x1 + 1) * TS, y * TS); }
    ctx.stroke();
  }
  drawRanges();
  drawZones();
  drawBelts(V, t);
  drawVents(t);
  drawBuildings(t, V);
  drawParts();
  for (const v of S.vehicles) if (!v.parked) drawVehicle(v, t);
  if (!S.me.inVeh) drawMe();
  drawBots(t, V);
  if (!paused) drawOverlay();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (stick) {
    const dx = stick.x - stick.ax, dy = stick.y - stick.ay, d = Math.hypot(dx, dy), k = d > 60 ? 60 / d : 1;
    ctx.fillStyle = 'rgba(28,34,51,.25)'; ctx.beginPath(); ctx.arc(stick.ax, stick.ay, 60, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(238,240,246,.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(238,240,246,.85)'; ctx.beginPath(); ctx.arc(stick.ax + dx * k, stick.ay + dy * k, 24, 0, 7); ctx.fill();
  }
}
const visible = (b, V) => b.x + b.w >= V.x0 && b.x <= V.x1 + 1 && b.y + b.h >= V.y0 && b.y <= V.y1 + 1;
function drawRanges() {
  const show = b => (sel && sel.type === 'building' && sel.id === b.id) || (tool === 'vac' && b.kind === 'vac') || (tool === 'hive' && b.kind === 'hive');
  for (const b of S.buildings) {
    if ((b.kind !== 'vac' && b.kind !== 'hive') || !show(b)) continue;
    const R = MACH[b.kind].radius;
    ctx.fillStyle = 'rgba(127,224,168,.10)'; ctx.strokeStyle = 'rgba(60,140,100,.6)'; ctx.lineWidth = 2 / cam.z;
    ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc((b.x + b.w / 2) * TS, (b.y + b.h / 2) * TS, (R + (b.kind === 'vac' ? .5 : 0)) * TS, 0, 7); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
  }
}
function drawZones() {
  const on = sel && sel.type === 'zone' ? [sel.z] : sel && sel.type === 'bot' ? zonesOfBot(sel.id) : [];
  S.zones.forEach((z, k) => {
    if (!z) return;
    const x = z.x0 * TS, y = z.y0 * TS, w = (z.x1 - z.x0 + 1) * TS, h = (z.y1 - z.y0 + 1) * TS, o = on.includes(k);
    ctx.fillStyle = ZC[k] + (o ? '2e' : '14'); ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = ZC[k]; ctx.lineWidth = (o ? 3 : 2) / Math.max(cam.z, .5);
    ctx.setLineDash([10, 6]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    ctx.fillStyle = ZC[k]; rr(ctx, x + 6, y + 6, 30, 30, 8); ctx.fill();
    ctx.fillStyle = '#1c2233'; ctx.font = '700 20px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ZL[k], x + 21, y + 22);
  });
}
function zonesOfBot(id) { const b = S.bots.find(o => o.id === id); return b ? b.prog.filter(s => s.op === 'sweep').map(s => ZL.indexOf(s.arg)).filter(k => k >= 0) : []; }
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
function feedsInto(x, y, d) { // does the belt at (x,y) pointing d feed the side of another belt? (draws a merge notch)
  const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
  if (!inMap(nx, ny)) return false;
  const nd = S.belt[idx(nx, ny)];
  return nd >= 0 && nd !== d && nd !== (d + 2) % 4;
}
function drawBelts(V, t) {
  const sp = uv('belt');
  for (let y = V.y0; y <= V.y1; y++) for (let x = V.x0; x <= V.x1; x++) {
    const i = idx(x, y), d = S.belt[i]; if (d < 0) continue;
    ctx.save(); ctx.translate(x * TS + TS / 2, y * TS + TS / 2); ctx.rotate(d * Math.PI / 2);
    ctx.fillStyle = '#3a4258'; ctx.fillRect(-TS / 2, -TS * .36, TS, TS * .72);
    ctx.fillStyle = '#2a3044'; ctx.fillRect(-TS / 2, -TS * .36, TS, 3); ctx.fillRect(-TS / 2, TS * .36 - 3, TS, 3);
    if (feedsInto(x, y, d)) { ctx.fillStyle = '#3a4258'; ctx.fillRect(TS / 2 - 4, -TS * .36, 6, TS * .72); }
    if (S.split[i]) {
      ctx.fillStyle = '#ffc93c'; rr(ctx, -TS / 2 + 2, -TS / 2 + 2, TS - 4, TS - 4, 6); ctx.fill();
      ctx.fillStyle = '#2a3044'; rr(ctx, -TS / 2 + 5, -TS / 2 + 5, TS - 10, TS - 10, 4); ctx.fill();
      ctx.strokeStyle = '#ffc93c'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(4, -4); ctx.lineTo(8, 0); ctx.lineTo(4, 4);
      ctx.moveTo(0, 0); ctx.lineTo(0, -8); ctx.moveTo(-3, -5); ctx.lineTo(0, -8); ctx.lineTo(3, -5);
      ctx.moveTo(0, 0); ctx.lineTo(0, 8); ctx.moveTo(-3, 5); ctx.lineTo(0, 8); ctx.lineTo(3, 5); ctx.stroke();
      ctx.restore(); continue;
    }
    ctx.strokeStyle = '#ffc93c'; ctx.globalAlpha = .7; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    const off = (t * sp * TS) % (TS / 2);
    ctx.beginPath(); ctx.rect(-TS / 2, -TS / 2, TS, TS); ctx.clip();
    for (let k = -1; k < 2; k++) { const cx = -TS / 2 + off + k * TS / 2 + 4; ctx.beginPath(); ctx.moveTo(cx - 3, -6); ctx.lineTo(cx + 3, 0); ctx.lineTo(cx - 3, 6); ctx.stroke(); }
    ctx.restore();
  }
  for (const it of S.items) {
    const d = S.belt[it.i]; if (d < 0) continue;
    const tx = it.i % W, ty = it.i / W | 0;
    if (tx < V.x0 || tx > V.x1 || ty < V.y0 || ty > V.y1) continue;
    piece((tx + .5 + DIRS[d][0] * (it.t - .5)) * TS, (ty + .5 + DIRS[d][1] * (it.t - .5)) * TS, it.k, 1.2);
  }
}
function piece(x, y, k, s) {
  if (k === 0) { ctx.fillStyle = PAL.dust[0]; ctx.beginPath(); ctx.arc(x, y, 3.2 * s, 0, 7); ctx.fill(); }
  else if (k === 1) { ctx.fillStyle = PAL.scrap; ctx.fillRect(x - 4 * s, y - 2.5 * s, 8 * s, 5 * s); ctx.fillStyle = PAL.scrapHi; ctx.fillRect(x - 4 * s, y - 2.5 * s, 8 * s, 1.5 * s); }
  else if (k === 2) { ctx.fillStyle = PAL.crys; poly(ctx, [[x, y - 5 * s], [x + 3 * s, y], [x, y + 4 * s], [x - 3 * s, y]]); ctx.fill(); }
  else { ctx.fillStyle = PAL.alloy; poly(ctx, [[x - 5 * s, y + 3 * s], [x - 3 * s, y - 3 * s], [x + 3 * s, y - 3 * s], [x + 5 * s, y + 3 * s]]); ctx.fill(); ctx.fillStyle = PAL.alloyHi; ctx.fillRect(x - 3 * s, y - 3 * s, 6 * s, 1.5 * s); }
}
function drawVents(t) {
  for (const v of S.vents) {
    if (v.capped) continue;
    const cx = v.x * TS + TS / 2, cy = v.y * TS + TS / 2;
    ctx.fillStyle = '#5a4f66'; ctx.beginPath(); ctx.ellipse(cx, cy + 2, 17, 13, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2b2433'; ctx.beginPath(); ctx.ellipse(cx, cy, 11, 8, 0, 0, 7); ctx.fill();
    for (let k = 0; k < 4; k++) {
      const p = ((t * .6 + k / 4) % 1);
      ctx.fillStyle = `rgba(120,104,136,${.45 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(cx + Math.sin(k * 2 + t) * 6 * p, cy - p * 34, 5 + p * 12, 0, 7); ctx.fill();
    }
  }
}
function shadowBox(x, y, w, h, r) { ctx.fillStyle = 'rgba(20,24,38,.3)'; rr(ctx, x + 3, y + 6, w, h, r); ctx.fill(); }
function fillBar(x, y, w, h, f, col) {
  ctx.fillStyle = '#2a3044'; rr(ctx, x, y, w, h, 2); ctx.fill();
  if (f > 0) { ctx.fillStyle = f >= 1 ? '#ff8a7a' : col || '#ffc93c'; rr(ctx, x, y, Math.max(2, w * Math.min(1, f)), h, 2); ctx.fill(); }
}
function drawBuildings(t, V) {
  for (const b of S.buildings) {
    if (!visible(b, V)) continue;
    const x = b.x * TS, y = b.y * TS, w = b.w * TS, h = b.h * TS, cx = x + w / 2, cy = y + h / 2;
    const on = sel && sel.type === 'building' && sel.id === b.id;
    if (b.kind === 'recycler') {
      shadowBox(x, y, w, h, 10);
      ctx.fillStyle = '#ffc93c'; rr(ctx, x, y, w, h, 10); ctx.fill();
      ctx.save(); rr(ctx, x, y, w, h, 10); ctx.clip();
      ctx.fillStyle = '#2a2105'; for (let k = -4; k < 10; k++) { ctx.beginPath(); ctx.moveTo(x + k * 12, y); ctx.lineTo(x + k * 12 + 6, y); ctx.lineTo(x + k * 12 + 6 - h, y + h); ctx.lineTo(x + k * 12 - h, y + h); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#263044'; rr(ctx, x + 6, y + 6, w - 12, h - 12, 7); ctx.fill();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 2);
      ctx.fillStyle = '#3e4a64'; ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ctx.fill();
      ctx.fillStyle = '#7fe0a8'; for (let k = 0; k < 3; k++) { ctx.rotate(2.094); ctx.beginPath(); ctx.ellipse(8, 0, 8, 3.2, 0, 0, 7); ctx.fill(); }
      ctx.restore();
    } else if (b.kind === 'bin') {
      shadowBox(x + 1, y, w - 4, h - 4, 6);
      ctx.fillStyle = '#4a5674'; rr(ctx, x + 2, y + 2, w - 4, h - 4, 6); ctx.fill();
      ctx.fillStyle = '#2a3044'; rr(ctx, x + 6, y + 6, w - 12, h - 12, 3); ctx.fill();
      const f = sum4(b.store) / capOf(b);
      if (f > 0) { ctx.fillStyle = f >= 1 ? '#ff8a7a' : '#ffc93c'; ctx.fillRect(x + 6, y + h - 6 - (h - 12) * f, w - 12, (h - 12) * f); }
    } else if (b.kind === 'vac') {
      shadowBox(x + 2, y + 2, w - 4, h - 4, 14);
      ctx.fillStyle = '#4a5674'; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(b.idle || b.full ? 0 : t * 9);
      ctx.fillStyle = '#7fe0a8'; for (let k = 0; k < 4; k++) { ctx.rotate(1.571); ctx.beginPath(); ctx.ellipse(5.5, 0, 6, 2.6, .4, 0, 7); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#2a3044'; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, 7); ctx.fill();
      fillBar(x + 5, y + h - 5, w - 10, 4, sum4(b.store) / capOf(b));
    } else if (b.kind === 'compactor') {
      shadowBox(x + 1, y, w - 4, h - 4, 6);
      ctx.fillStyle = '#5b6787'; rr(ctx, x + 2, y + 2, w - 4, h - 4, 6); ctx.fill();
      const press = b.working ? (Math.sin(t * 9) * .5 + .5) * 7 : 0;
      ctx.fillStyle = '#2a3044'; rr(ctx, x + 6, y + 6, w - 12, h - 14, 3); ctx.fill();
      ctx.fillStyle = '#8fb0cc'; rr(ctx, x + 7, y + 7 + press, w - 14, 6, 2); ctx.fill();
      fillBar(x + 5, y + h - 7, w - 10, 3, b.inp / PROC_IN, '#a99cb6');
    } else if (b.kind === 'smelter') {
      shadowBox(x + 2, y + 2, w - 4, h - 4, 12);
      ctx.fillStyle = '#4a5674'; rr(ctx, x + 2, y + 2, w - 4, h - 4, 12); ctx.fill();
      ctx.fillStyle = '#2a3044'; rr(ctx, x + 10, y + 10, w - 20, h - 26, 8); ctx.fill();
      const glow = b.working ? .65 + Math.sin(t * 6) * .2 : .25;
      ctx.fillStyle = `rgba(255,154,92,${glow})`; rr(ctx, x + 14, y + 14, w - 28, h - 34, 6); ctx.fill();
      ctx.fillStyle = '#3a4258'; rr(ctx, x + w - 18, y - 6, 10, 16, 3); ctx.fill();
      fillBar(x + 8, y + h - 12, w - 16, 4, b.inp / PROC_IN, '#8fb0cc');
    } else if (b.kind === 'garage') {
      shadowBox(x + 2, y + 2, w - 4, h - 4, 10);
      ctx.fillStyle = '#4a5674'; rr(ctx, x + 2, y + 2, w - 4, h - 4, 10); ctx.fill();
      ctx.fillStyle = '#3a4258'; rr(ctx, x + 2, y + 2, w - 4, 16, 10); ctx.fill();
      const bays = STALL_MAX, bw = (w - 16) / bays;
      const parked = S.vehicles.filter(v => v.garage === b.id);
      for (let k = 0; k < bays; k++) {
        const bx = x + 8 + k * bw;
        if (k >= b.stalls) { ctx.fillStyle = 'rgba(42,48,68,.5)'; rr(ctx, bx + 2, y + h - 30, bw - 4, 24, 3); ctx.fill(); continue; }
        ctx.fillStyle = '#2a3044'; rr(ctx, bx + 2, y + h - 30, bw - 4, 24, 3); ctx.fill();
        const v = parked[k];
        if (v) { ctx.fillStyle = v.parked ? VEH[v.type].color : 'rgba(238,240,246,.2)'; rr(ctx, bx + 4, y + h - 22, bw - 8, 12, 3); ctx.fill(); }
        ctx.strokeStyle = 'rgba(238,240,246,.25)'; ctx.lineWidth = 1;
        for (let l = 0; l < 3; l++) { ctx.beginPath(); ctx.moveTo(bx + 3, y + h - 27 + l * 3); ctx.lineTo(bx + bw - 3, y + h - 27 + l * 3); ctx.stroke(); }
      }
      ctx.fillStyle = '#ffc93c'; ctx.fillRect(x + 8, y + h - 6, w - 16, 3);
    } else if (b.kind === 'hive') {
      shadowBox(x + 2, y + 2, w - 4, h - 4, 14);
      ctx.fillStyle = '#ffc93c'; rr(ctx, x + 2, y + 2, w - 4, h - 4, 14); ctx.fill();
      ctx.fillStyle = '#263044';
      for (let k = 0; k < 7; k++) { const a = k === 6 ? 0 : k * 1.047, r = k === 6 ? 0 : 13, hx = cx + Math.cos(a) * r, hy = cy + Math.sin(a) * r;
        poly(ctx, [0, 1, 2, 3, 4, 5].map(j => [hx + Math.cos(j * 1.047 + .52) * 6.5, hy + Math.sin(j * 1.047 + .52) * 6.5])); ctx.fill(); }
      fillBar(x + 8, y + h - 9, w - 16, 5, sum4(b.store) / capOf(b));
    } else if (b.kind === 'cap') {
      ctx.fillStyle = '#5a4f66'; ctx.beginPath(); ctx.ellipse(cx, cy + 2, 17, 13, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#3a4258'; poly(ctx, [0, 1, 2, 3, 4, 5].map(k => [cx + Math.cos(k * 1.047) * 14, cy + Math.sin(k * 1.047) * 14])); ctx.fill();
      ctx.fillStyle = '#7fe0a8'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
    }
    if (on) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5 / cam.z; rr(ctx, x - 3, y - 3, w + 6, h + 6, 9); ctx.stroke(); }
    if (cam.z > .7 && b.kind !== 'cap') {
      ctx.font = '600 11px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#1c2233'; ctx.fillText(b.label, cx, y + h + 3);
    }
  }
}
function drawParts() { for (const p of parts) piece(p.x * TS, p.y * TS, p.k, .8); }
function drawMe() {
  const m = S.me, x = m.x * TS, y = m.y * TS, a = m.ang;
  const fx = Math.cos(a), fy = Math.sin(a), sx = -fy, sy = fx;
  ctx.strokeStyle = 'rgba(255,201,60,.35)'; ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.arc(x + fx * 8, y + fy * 8, uv('reach') * TS, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.save(); ctx.translate(x, y); ctx.scale(1.35, 1.35); ctx.translate(-x, -y);
  ctx.fillStyle = 'rgba(20,24,38,.3)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 5, 13, 8, 0, 0, 7); ctx.fill();
  const sw = Math.sin(m.step * 2) * 4;
  ctx.fillStyle = '#2a3044';
  for (const s of [-1, 1]) { const o = s * sw; ctx.beginPath(); ctx.ellipse(x + sx * 6 * s + fx * o, y + sy * 6 * s + fy * o, 4.5, 3.5, a, 0, 7); ctx.fill(); }
  ctx.save(); ctx.translate(x - fx * 9, y - fy * 9); ctx.rotate(a);
  ctx.fillStyle = '#4a5674'; rr(ctx, -6, -9, 10, 18, 4); ctx.fill();
  const f = meN() / uv('pack');
  if (f > 0) { ctx.fillStyle = f >= 1 ? '#ff8a7a' : '#ffc93c'; rr(ctx, -5, -8 + 16 * (1 - f), 8, 16 * f, 3); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = '#d9dcea'; ctx.beginPath(); ctx.arc(x, y, 10.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#eef0f6'; ctx.beginPath(); ctx.arc(x - 1, y - 1.5, 9.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2a3044'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + sx * 7, y + sy * 7); ctx.lineTo(x + sx * 7 + fx * 15, y + sy * 7 + fy * 15); ctx.stroke();
  ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.ellipse(x + sx * 7 + fx * 16, y + sy * 7 + fy * 16, 2.5, 5, a, 0, 7); ctx.fill();
  ctx.fillStyle = '#1c2233'; ctx.beginPath(); ctx.ellipse(x + fx * 4, y + fy * 4, 6, 4.2, a + 1.571, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(127,224,168,.8)'; ctx.beginPath(); ctx.ellipse(x + fx * 4.5 - sx * 2, y + fy * 4.5 - sy * 2, 2, 1.2, a + 1.571, 0, 7); ctx.fill();
  ctx.restore();
}
function drawVehicle(v, t) {
  const T = VEH[v.type], x = v.x * TS, y = v.y * TS, on = sel && sel.type === 'veh' && sel.id === v.id;
  const L = T.hopper > 200 ? 54 : 48, Wd = 30;
  if (S.me.inVeh === v.id || on) {
    ctx.strokeStyle = 'rgba(255,201,60,.35)'; ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(x + Math.cos(v.ang) * 22, y + Math.sin(v.ang) * 22, vStat(v, 'reach') * TS, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.fillStyle = 'rgba(20,24,38,.3)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 7, L * .55, Wd * .62, v.ang, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(x, y); ctx.rotate(v.ang);
  // wheels
  ctx.fillStyle = '#1c2233';
  for (const [wx, wy] of [[-L * .32, -Wd / 2], [L * .3, -Wd / 2], [-L * .32, Wd / 2], [L * .3, Wd / 2]]) rr(ctx, wx - 7, wy - 4, 14, 8, 3), ctx.fill();
  ctx.strokeStyle = 'rgba(238,240,246,.25)'; ctx.lineWidth = 1.2;
  for (const [wx, wy] of [[-L * .32, -Wd / 2], [L * .3, -Wd / 2], [-L * .32, Wd / 2], [L * .3, Wd / 2]]) { const o = ((v.wheel || 0) * 6) % 4; for (let k = -1; k < 2; k++) { ctx.beginPath(); ctx.moveTo(wx - 5 + o + k * 4, wy - 3); ctx.lineTo(wx - 5 + o + k * 4, wy + 3); ctx.stroke(); } }
  // plow blade
  if (v.feat.plow) { ctx.fillStyle = '#9aa3bd'; poly(ctx, [[L / 2 + 2, -Wd / 2 - 4], [L / 2 + 10, -Wd / 2 + 2], [L / 2 + 10, Wd / 2 - 2], [L / 2 + 2, Wd / 2 + 4]]); ctx.fill(); }
  // intake
  const iw = clamp(vStat(v, 'reach') * 9, 18, Wd + 8);
  ctx.fillStyle = '#ffc93c'; rr(ctx, L / 2 - 4, -iw / 2, 7, iw, 3); ctx.fill();
  // body
  ctx.fillStyle = T.color; rr(ctx, -L / 2, -Wd / 2 + 2, L - 2, Wd - 4, 8); ctx.fill();
  ctx.fillStyle = 'rgba(28,34,51,.18)'; rr(ctx, -L / 2, 2, L - 2, Wd / 2 - 4, 6); ctx.fill();
  // hopper (rear) with fill
  ctx.fillStyle = '#2a3044'; rr(ctx, -L / 2 + 4, -Wd / 2 + 6, L * .48, Wd - 12, 4); ctx.fill();
  const f = sum4(v.cargo) / vStat(v, 'hopper');
  if (f > 0) { ctx.fillStyle = f >= 1 ? '#ff8a7a' : '#ffc93c'; rr(ctx, -L / 2 + 5, -Wd / 2 + 7, (L * .48 - 2) * Math.min(1, f), Wd - 14, 3); ctx.fill(); }
  // cab
  ctx.fillStyle = '#1c2233'; rr(ctx, L * .08, -Wd / 2 + 5, L * .3, Wd - 10, 5); ctx.fill();
  ctx.fillStyle = 'rgba(127,224,168,.55)'; rr(ctx, L * .24, -Wd / 2 + 7, L * .12, Wd - 14, 3); ctx.fill();
  if (S.me.inVeh === v.id) { ctx.fillStyle = '#eef0f6'; ctx.beginPath(); ctx.arc(L * .16, 0, 4.5, 0, 7); ctx.fill(); }
  if (v.feat.magnet) { ctx.strokeStyle = '#ff7a6b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-L * .05, 0, 4, 1.57, 4.71); ctx.stroke(); }
  if (v.feat.auto) { ctx.fillStyle = v.mode && Math.sin(t * 6) > 0 ? '#7fe0a8' : '#3a4258'; ctx.beginPath(); ctx.arc(-L * .05, Wd / 2 - 7, 3, 0, 7); ctx.fill(); }
  ctx.restore();
  if (on) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 / cam.z; ctx.beginPath(); ctx.arc(x, y, L * .7, 0, 7); ctx.stroke(); }
  if (cam.z > .7) { ctx.font = '600 11px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = '#1c2233'; ctx.fillText(v.name, x, y + Wd * .75); }
}
function drawBots(t, V) {
  for (const b of S.bots) {
    if (b.x < V.x0 - 1 || b.x > V.x1 + 2 || b.y < V.y0 - 1 || b.y > V.y1 + 2) continue;
    const x = b.x * TS, y = b.y * TS, on = sel && sel.type === 'bot' && sel.id === b.id, s = b.hive ? .7 : 1;
    const bob = Math.sin(t * 4 + b.id) * 1.5;
    if (on) {
      const st = b.prog[b.pc];
      let tx = null, ty = null;
      if (b.tgt >= 0) { tx = (b.tgt % W + .5) * TS; ty = ((b.tgt / W | 0) + .5) * TS; }
      else if (st && (st.op === 'unload' || st.op === 'fetch')) { const d = st.op === 'unload' ? dropTarget(b, st.arg) : byId.get(+String(st.arg).slice(4)); if (d) { const [px, py] = nearestPoint(d, b.x, b.y); tx = px * TS; ty = py * TS; } }
      if (tx !== null) { ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]); }
    }
    ctx.fillStyle = 'rgba(20,24,38,.28)'; ctx.beginPath(); ctx.ellipse(x + 4 * s, y + 12 * s, 14 * s, 7 * s, 0, 0, 7); ctx.fill();
    const yy = y + bob - 6 * s;
    ctx.strokeStyle = '#2a3044'; ctx.lineWidth = 3 * s;
    for (let k = 0; k < 4; k++) { const a = k * 1.571 + .785; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + Math.cos(a) * 17 * s, yy + Math.sin(a) * 17 * s); ctx.stroke(); }
    for (let k = 0; k < 4; k++) { const a = k * 1.571 + .785, rx = x + Math.cos(a) * 17 * s, ry = yy + Math.sin(a) * 17 * s;
      ctx.fillStyle = 'rgba(238,240,246,.35)'; ctx.beginPath(); ctx.ellipse(rx, ry, 7 * s, 2.2 * s, t * 30 + k, 0, 7); ctx.fill(); }
    ctx.fillStyle = `hsl(${b.hue} 55% 32%)`; ctx.beginPath(); ctx.arc(x, yy + 2 * s, 13 * s, 0, 7); ctx.fill();
    ctx.fillStyle = `hsl(${b.hue} ${b.hive ? 95 : 70}% ${b.hive ? 58 : 62}%)`; ctx.beginPath(); ctx.arc(x, yy, 13 * s, 0, 7); ctx.fill();
    const f = cargoN(b) / uv('cargo');
    ctx.strokeStyle = '#1c2233'; ctx.lineWidth = 3.5 * s; ctx.beginPath(); ctx.arc(x, yy, 7.5 * s, 0, 7); ctx.stroke();
    if (f > 0) { ctx.strokeStyle = b.hive ? '#eef0f6' : '#ffc93c'; ctx.beginPath(); ctx.arc(x, yy, 7.5 * s, -1.57, -1.57 + f * 6.283); ctx.stroke(); }
    ctx.fillStyle = '#eef0f6'; ctx.beginPath(); ctx.arc(x + Math.cos(b.ang) * 10 * s, yy + Math.sin(b.ang) * 10 * s, 2.6 * s, 0, 7); ctx.fill();
    if (on) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 / cam.z; ctx.beginPath(); ctx.arc(x, yy, 22, 0, 7); ctx.stroke(); }
    if (!b.hive && (b.idle > 0 || b.status.startsWith('Zone') || b.status === 'No program')) {
      ctx.fillStyle = '#1c2233'; ctx.font = '700 12px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(b.idle > 0 ? 'zz' : '?', x + 14, yy - 14);
    }
  }
}
let hover = null, zoneDrag = null;
function drawOverlay() {
  if (hover && tool !== 'walk' && tool !== 'zone') {
    const m = MACH[tool], w = m && m.w || 1, h = m && (m.h || m.w) || 1;
    const x = Math.floor(hover[0] / TS), y = Math.floor(hover[1] / TS);
    if (inMap(x, y)) {
      ctx.strokeStyle = tool === 'erase' ? '#ff8a7a' : '#1c2233'; ctx.lineWidth = 2 / cam.z; ctx.strokeRect(x * TS + 1, y * TS + 1, TS * w - 2, TS * h - 2);
      if (tool === 'vac' || tool === 'hive') { const R = MACH[tool].radius + (tool === 'vac' ? .5 : 0); ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc((x + w / 2) * TS, (y + h / 2) * TS, R * TS, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    }
  }
  if (zoneDrag) {
    const k = zoneDrag.k, x0 = Math.min(zoneDrag.a[0], zoneDrag.b[0]), y0 = Math.min(zoneDrag.a[1], zoneDrag.b[1]);
    const x1 = Math.max(zoneDrag.a[0], zoneDrag.b[0]), y1 = Math.max(zoneDrag.a[1], zoneDrag.b[1]);
    ctx.fillStyle = ZC[k] + '30'; ctx.fillRect(x0 * TS, y0 * TS, (x1 - x0 + 1) * TS, (y1 - y0 + 1) * TS);
    ctx.strokeStyle = ZC[k]; ctx.lineWidth = 2.5 / cam.z; ctx.strokeRect(x0 * TS, y0 * TS, (x1 - x0 + 1) * TS, (y1 - y0 + 1) * TS);
  }
}

// ---------- minimap ----------
const mini = $('mini'), mctx = mini.getContext('2d');
mini.width = W; mini.height = H;
let miniImg = null;
function drawMini() {
  if (!S || paused) return;
  if (!miniImg) miniImg = mctx.createImageData(W, H);
  const d = miniImg.data;
  for (let i = 0; i < N; i++) {
    const o = i * 4, p = pileOf(i);
    let r, g, b;
    if (S.rock[i]) { r = 108; g = 99; b = 121; }
    else if (S.belt[i] >= 0) { r = 255; g = 201; b = 60; }
    else if (S.bmap[i]) { r = 238; g = 240; b = 246; }
    else if (p) { const f = Math.min(1, p / 8); r = 160 - 80 * f; g = 150 - 78 * f; b = 172 - 72 * f; }
    else { r = 196; g = 188; b = 208; }
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  mctx.putImageData(miniImg, 0, 0);
  for (const v of S.vents) if (!v.capped) { mctx.fillStyle = '#ff7a6b'; mctx.fillRect(v.x - 1, v.y - 1, 3, 3); }
  mctx.fillStyle = '#1c2233';
  for (const b of S.bots) mctx.fillRect(Math.round(b.x - .5), Math.round(b.y - .5), 1, 1);
  for (const v of S.vehicles) if (!v.parked) { mctx.fillStyle = VEH[v.type].color; mctx.fillRect(Math.round(v.x - 1), Math.round(v.y - 1), 2, 2); }
  const [fx, fy] = focus();
  mctx.fillStyle = '#ffc93c'; mctx.fillRect(Math.round(fx - 1.5), Math.round(fy - 1.5), 3, 3);
  const [x0, y0] = toWorld(0, 0), [x1, y1] = toWorld(vw, vh);
  mctx.strokeStyle = 'rgba(28,34,51,.9)'; mctx.lineWidth = 1;
  mctx.strokeRect(x0 / TS + .5, y0 / TS + .5, (x1 - x0) / TS, (y1 - y0) / TS);
}
mini.addEventListener('pointerdown', e => {
  const r = mini.getBoundingClientRect();
  cam.x = (e.clientX - r.left) / r.width * W * TS; cam.y = (e.clientY - r.top) / r.height * H * TS;
  follow = false; clampCam(); drawMini();
});

// ---------- input ----------
let tool = 'walk';
const pointers = new Map();
let pinch = null, act = null;
const TOOL_HINT = {
  walk: 'Drag anywhere to move. Tap a machine, bot or vehicle to inspect it. Two fingers pan and zoom.',
  zone: 'Drag a rectangle to paint the next zone. Bots and autopilots sweep the zones you give them.',
  belt: 'Drag to lay belts. Draw into the side of a belt to merge. Tap a belt to turn it.',
  splitter: 'Tap a belt to turn it into a splitter, or tap a splitter to turn it.',
  bin: 'Tap open ground to place a bin.',
  vac: 'Tap open ground to place a Vac Post. It cleans within 3 tiles.',
  compactor: 'Tap open ground to place a Compactor. Belt dust in, belt scrap out.',
  smelter: 'Tap open ground to place a Smelter (2×2). Belt scrap in, belt alloy out.',
  garage: 'Tap open ground to place a Garage (3×2). Its doors face down.',
  hive: 'Tap open ground to place a Drone Hive (2×2).',
  cap: 'Tap an open vent to cap it for good.',
  erase: 'Tap or drag over belts and machines to remove them.',
};
function lockedTool(t) {
  if (MACH[t] && !unlocked(t)) return MACH[t].name + ' unlocks after recycling ' + fmt(MACH[t].unlock) + ' pieces';
  if (t === 'zone' && !unlocked('bot')) return 'Zones unlock with bots, after recycling ' + fmt(BOT_UNLOCK) + ' pieces';
  return '';
}
function setTool(t) {
  const why = lockedTool(t);
  if (why) { toast(why); return; }
  tool = t;
  if (PALETTE.includes(t)) S.machTool = t;
  syncToolbar();
  $('hint').textContent = TOOL_HINT[t];
  if (t === 'zone' && !panelMode) select({ type: 'zones' });
}
const TOOL_ICON = {
  bin: '<path d="M5 8h14l-1.5 11h-11zM4 8l2-3h12l2 3M9 12h6"/>',
  vac: '<circle cx="12" cy="12" r="7"/><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="2"/>',
  compactor: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8 9h8M12 9v6M9 15h6"/>',
  smelter: '<path d="M4 20V9l5 3V9l5 3V6h6v14z"/><path d="M8 16h3M14 16h3"/>',
  garage: '<path d="M3 10l9-6 9 6v10H3z"/><path d="M7 20v-7h10v7M7 16h10"/>',
  hive: '<path d="M12 3l4 2.3v4.6L12 12 8 9.9V5.3zM8 12l4 2.3v4.6L8 21l-4-2.1v-4.6zM16 12l4 2.3v4.6L16 21l-4-2.1v-4.6z"/>',
  cap: '<path d="M12 4l7 4v8l-7 4-7-4V8z"/><circle cx="12" cy="12" r="2.5"/>',
};
function syncToolbar() {
  document.querySelectorAll('#toolbar button[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
  const mb = $('machBtn'), mt = S ? S.machTool : 'bin';
  mb.classList.toggle('on', PALETTE.includes(tool));
  mb.querySelector('svg').innerHTML = TOOL_ICON[mt];
  mb.querySelector('b').textContent = MACH[mt].name;
}
document.querySelectorAll('#toolbar button[data-tool]').forEach(b => b.addEventListener('click', () => { closePalette(); setTool(b.dataset.tool); }));
$('machBtn').addEventListener('click', () => { if ($('palette').hidden) openPalette(); else closePalette(); });
function openPalette() {
  $('hint').hidden = true;
  $('palette').innerHTML = PALETTE.map(k => `<button type="button" data-m="${k}" class="${tool === k ? 'on' : ''}"><svg viewBox="0 0 24 24">${TOOL_ICON[k]}</svg><span><b>${MACH[k].name}</b><span class="pc" data-pl="${k}"></span></span></button>`).join('');
  $('palette').hidden = false; livePalette();
}
function closePalette() { $('palette').hidden = true; $('hint').hidden = false; }
function livePalette() {
  if ($('palette').hidden) return;
  $('palette').querySelectorAll('[data-m]').forEach(b => {
    const k = b.dataset.m, why = lockedTool(k), el = b.querySelector('.pc');
    const html = why ? `Recycle ${fmt(MACH[k].unlock)} to unlock` : costHTML(MACH[k].cost);
    if (el.innerHTML !== html) el.innerHTML = html;
    b.classList.toggle('locked', !!why); b.classList.toggle('poor', !why && !canPay(MACH[k].cost));
  });
}
$('palette').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; closePalette(); setTool(b.dataset.m); });
addEventListener('keydown', e => {
  if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || paused) return;
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); e.preventDefault(); }
  if (k === 'escape') { setTool('walk'); select(null); closePalette(); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

function tileAt(sx, sy) { const [wx, wy] = toWorld(sx, sy); return [Math.floor(wx / TS), Math.floor(wy / TS)]; }
cv.addEventListener('pointerdown', e => {
  if (paused) return;
  closePalette();
  cv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { cancelAct(); const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, z: cam.z }; follow = false; return; }
  if (pointers.size > 2 || pinch) return;
  const pan = e.button === 1 || e.button === 2;
  act = { id: e.pointerId, kind: pan ? 'pan' : tool, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, last: -1, placed: new Set() };
  hover = toWorld(e.clientX, e.clientY);
  if (pan) follow = false;
  startAct(e);
});
cv.addEventListener('pointermove', e => {
  if (paused) return;
  hover = toWorld(e.clientX, e.clientY);
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX; p.y = e.clientY;
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const [wx, wy] = toWorld(pinch.mx, pinch.my);
    cam.z = clamp(pinch.z * d / Math.max(pinch.d, 1), minZoom(), 3);
    cam.x = wx - (mx - vw / 2) / cam.z; cam.y = wy - (my - vh / 2) / cam.z;
    pinch.mx = mx; pinch.my = my; pinch.d = d; pinch.z = cam.z;
    clampCam(); return;
  }
  if (!act || act.id !== e.pointerId) return;
  if (Math.hypot(e.clientX - act.sx, e.clientY - act.sy) > 8) act.moved = true;
  moveAct(e);
  act.lx = e.clientX; act.ly = e.clientY;
});
function up(e) {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; return; }
  if (act && act.id === e.pointerId) { endAct(e); act = null; }
  if (e.pointerType !== 'mouse') hover = null;
}
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); pinch = null; cancelAct(); });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !act) hover = null; });
cv.addEventListener('wheel', e => {
  e.preventDefault();
  if (paused) return;
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  cam.z = clamp(cam.z * Math.exp(-e.deltaY * .0015), minZoom(), 3);
  if (!follow) { cam.x = wx - (e.clientX - vw / 2) / cam.z; cam.y = wy - (e.clientY - vh / 2) / cam.z; }
  clampCam();
}, { passive: false });

function cancelAct() { stick = null; zoneDrag = null; act = null; }
function startAct(e) {
  const [x, y] = tileAt(e.clientX, e.clientY);
  if (act.kind === 'walk') stick = { ax: e.clientX, ay: e.clientY, x: e.clientX, y: e.clientY };
  else if (act.kind === 'zone') {
    const k = S.zones.findIndex(z => !z);
    if (k < 0) { toast('All six zones are painted. Delete one first.'); select({ type: 'zones' }); act.kind = 'pan'; return; }
    zoneDrag = { k, a: [clamp(x, 0, W - 1), clamp(y, 0, H - 1)], b: [clamp(x, 0, W - 1), clamp(y, 0, H - 1)] };
  } else if (act.kind === 'belt') { act.last = inMap(x, y) ? idx(x, y) : -1; if (act.last >= 0 && S.belt[act.last] < 0) act.placed.add(act.last); else if (act.last >= 0) act.startOn = act.last; }
  else if (act.kind === 'erase') { if (inMap(x, y)) { removeAt(x, y); act.last = idx(x, y); } }
}
function moveAct(e) {
  if (act.kind === 'pan') { cam.x -= (e.clientX - act.lx) / cam.z; cam.y -= (e.clientY - act.ly) / cam.z; clampCam(); return; }
  if (act.kind === 'walk') { stick.x = e.clientX; stick.y = e.clientY; return; }
  const [x, y] = tileAt(e.clientX, e.clientY);
  if (act.kind === 'zone' && zoneDrag) zoneDrag.b = [clamp(x, 0, W - 1), clamp(y, 0, H - 1)];
  else if (act.kind === 'erase') { if (inMap(x, y) && idx(x, y) !== act.last) { removeAt(x, y); act.last = idx(x, y); } }
  else if (act.kind === 'belt') {
    if (!inMap(x, y)) return;
    const j = idx(x, y);
    if (j === act.last) return;
    if (act.last < 0) { act.last = j; return; }
    let lx = act.last % W, ly = act.last / W | 0, guard = 0;
    while ((lx !== x || ly !== y) && guard++ < 300) {
      const dx = x - lx, dy = y - ly;
      const d = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
      const pi = idx(lx, ly);
      // aim this drag's own belts (and the one it started on); belts that were already there keep their direction, so drawing into them merges
      if (S.belt[pi] >= 0) { if ((act.placed.has(pi) || pi === act.startOn) && !S.split[pi]) S.belt[pi] = d; }
      else if (freeTile(pi) && placeBelt(pi, d)) act.placed.add(pi);
      lx += DIRS[d][0]; ly += DIRS[d][1];
      const ni = idx(lx, ly);
      if (S.belt[ni] < 0 && freeTile(ni) && placeBelt(ni, d)) act.placed.add(ni);
      S.lastBeltDir = d;
      act.startOn = -1;
    }
    act.last = j;
  }
}
function endAct(e) {
  const [x, y] = tileAt(e.clientX, e.clientY);
  if (act.kind === 'walk') { stick = null; if (!act.moved) tapSelect(e); }
  else if (act.kind === 'zone' && zoneDrag) {
    const z = zoneDrag; zoneDrag = null;
    if (!act.moved) { const k = S.zones.findIndex(r => r && x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1); if (k >= 0) select({ type: 'zone', z: k }); return; }
    S.zones[z.k] = { x0: Math.min(z.a[0], z.b[0]), y0: Math.min(z.a[1], z.b[1]), x1: Math.max(z.a[0], z.b[0]), y1: Math.max(z.a[1], z.b[1]) };
    select({ type: 'zone', z: z.k });
    toast('Zone ' + ZL[z.k] + ' painted');
  } else if (MACH[act.kind] && PALETTE.includes(act.kind) && act.kind !== 'cap') { if (!act.moved && inMap(x, y)) placeMachine(act.kind, x, y); }
  else if (act.kind === 'cap') { if (!act.moved) capVent(x, y); }
  else if (act.kind === 'splitter') { if (!act.moved && inMap(x, y)) placeSplitter(idx(x, y)); }
  else if (act.kind === 'belt') {
    if (!act.moved && inMap(x, y)) {
      const i = idx(x, y);
      if (S.belt[i] >= 0) S.belt[i] = (S.belt[i] + 1) % 4;
      else placeBelt(i, S.lastBeltDir);
    }
  }
}
function tapSelect(e) {
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  for (const v of S.vehicles) if (!v.parked && Math.hypot(v.x * TS - wx, v.y * TS - wy) < 30) return select({ type: 'veh', id: v.id });
  let best = null, bd = (22 / cam.z + 10);
  for (const b of S.bots) { if (b.hive) continue; const d = Math.hypot(b.x * TS - wx, b.y * TS - wy); if (d < bd) { bd = d; best = b; } }
  if (best) return select({ type: 'bot', id: best.id });
  const x = Math.floor(wx / TS), y = Math.floor(wy / TS);
  if (inMap(x, y)) {
    const id = S.bmap[idx(x, y)];
    if (id) return select({ type: 'building', id });
    if (S.belt[idx(x, y)] < 0) {
      const k = S.zones.findIndex(r => r && x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
      if (k >= 0) return select({ type: 'zone', z: k });
    }
  }
  if (sel && !['build', 'tasks', 'menu'].includes(sel.type)) select(null);
}

// ---------- driving controls ----------
function updateDriveBar() {
  const v = S && S.me.inVeh && S.vehicles.find(o => o.id === S.me.inVeh);
  $('driveBar').hidden = !v;
  if (v) { $('parkBtn').disabled = !nearHome(v); $('driveName').textContent = v.name; }
}
$('hopBtn').addEventListener('click', () => { hopOut(); toast('Hopped out'); });
$('parkBtn').addEventListener('click', () => { const v = S.vehicles.find(o => o.id === S.me.inVeh); if (v && nearHome(v)) { park(v); toast(v.name + ' parked'); } });

// ---------- panels ----------
let sel = null, panelMode = null;
const panel = $('panel'), pbody = $('panelBody');
function select(s) { sel = s; panelMode = s ? s.type : null; renderPanel(); }
$('panelClose').addEventListener('click', () => select(null));
$('shopBtn').addEventListener('click', () => select(panelMode === 'build' ? null : { type: 'build' }));
$('taskChip').addEventListener('click', () => select(panelMode === 'tasks' ? null : { type: 'tasks' }));
$('menuBtn').addEventListener('click', () => select(panelMode === 'menu' ? null : { type: 'menu' }));
$('speedBtn').addEventListener('click', () => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1; $('speedBtn').textContent = S.speed + '×'; });
$('findMe').addEventListener('click', () => { follow = true; });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const storeRow = `<div class="kv"><span>Stored</span><span data-live="store"></span></div>`;
const removeRow = `<div class="row"><button class="btn danger" data-act="delb">Remove (half refund)</button></div>`;
const zoneOpts = cur => [['near', 'Nearest junk'], ...S.zones.map((z, k) => z ? [ZL[k], 'Zone ' + ZL[k]] : null).filter(Boolean)].map(([v, l]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`).join('');

function vehiclePanel(v) {
  const T = VEH[v.type];
  const upRows = Object.keys(VUPG).map(k => { const lv = v.up[k], max = lv >= VUPG_COST.length, U = VUPG[k];
    const now = k === 'engine' ? vStat(v, 'speed').toFixed(1) + ' tiles/s' : k === 'hopper' ? vStat(v, 'hopper') + ' pieces' : vStat(v, 'reach') + ' tiles, ' + vStat(v, 'power') + '/s';
    return `<div class="shop-item"><b>${U.name}</b><p>${U.desc}: ${now}</p><span class="pips">${U.mult.map((_, i) => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</span>
      <button class="btn primary" data-act="vup" data-k="${k}" ${max ? 'disabled' : ''} data-cost="${max ? '' : VUPG_COST[lv].join(',')}">${max ? 'Maxed' : costHTML(VUPG_COST[lv])}</button></div>`; }).join('');
  const featRows = Object.keys(VFEAT).map(k => { const F = VFEAT[k], has = v.feat[k];
    return `<div class="shop-item"><b>${F.name}</b><p>${F.desc}</p><button class="btn ${has ? '' : 'primary'}" data-act="vfeat" data-k="${k}" ${has ? 'disabled' : ''} data-cost="${has ? '' : F.cost.join(',')}">${has ? 'Fitted' : costHTML(F.cost)}</button></div>`; }).join('');
  const driving = S.me.inVeh === v.id;
  return `<div class="status" data-live="vstatus"></div>
    <div class="kv"><span>Hopper</span><span data-live="vcargo"></span></div>
    <div class="row">${driving ? `<button class="btn" data-act="hop">Hop out</button>` : `<button class="btn primary" data-act="drive">Drive</button>`}
      ${!v.parked ? `<button class="btn" data-act="vhome" ${v.feat.auto || nearHome(v) ? '' : 'disabled'}>${nearHome(v) ? 'Park in garage' : 'Send home'}</button>` : ''}</div>
    <h3>Autopilot</h3>
    ${v.feat.auto ? `<div class="row"><select id="autoArg" aria-label="Where to clean">${zoneOpts(v.arg)}</select><button class="btn primary" data-act="dispatch">${v.mode === 'sweep' ? 'Update' : 'Send out'}</button></div>` : `<p>Fit Autopilot below to send this ${T.name} out on its own.</p>`}
    <h3>Upgrades</h3>${upRows}
    <h3>Features</h3>${featRows}`;
}
function garagePanel(g) {
  const mine = S.vehicles.filter(v => v.garage === g.id);
  const rows = [];
  for (let k = 0; k < STALL_MAX; k++) {
    const v = mine[k];
    if (k >= g.stalls) { rows.push(`<li class="stall locked"><span class="t">Empty lot</span><span></span></li>`); continue; }
    if (v) rows.push(`<li class="stall"><span class="vdot" style="background:${VEH[v.type].color}"></span><span class="t"><b>${esc(v.name)}</b><small data-live="vst-${v.id}"></small></span><button class="btn" data-act="openveh" data-k="${v.id}">Open</button></li>`);
    else rows.push(`<li class="stall"><span class="vdot"></span><span class="t">Empty stall</span><span></span></li>`);
  }
  const free = mine.length < g.stalls;
  return `<p>${MACH.garage.desc} Walk up to it to drive a parked vehicle out.</p>
    <ul class="tasks stalls">${rows.join('')}</ul>
    <div class="row"><button class="btn" data-act="stall" data-cost="${STALL_COST.join(',')}" ${g.stalls >= STALL_MAX ? 'disabled' : ''}>${g.stalls >= STALL_MAX ? 'All stalls built' : 'Add a stall ' + costHTML(STALL_COST)}</button></div>
    <h3>Buy a vehicle</h3>
    ${free ? '' : '<p>Every stall is full. Add a stall to buy another vehicle.</p>'}
    ${Object.keys(VEH).map(k => { const T = VEH[k]; return `<div class="shop-item"><b><span class="vdot" style="background:${T.color}"></span>${T.name}</b><p>${T.desc} ${T.speed} tiles/s, ${T.hopper} hopper, ${T.reach} reach.</p><button class="btn primary" data-act="buyveh" data-k="${k}" data-cost="${T.cost.join(',')}" data-needstall="${free ? '' : 1}">${costHTML(T.cost)}</button></div>`; }).join('')}
    ${removeRow}`;
}
function renderPanel() {
  if (!sel) { panel.hidden = true; return; }
  panel.hidden = false;
  let title = '', html = '';
  if (sel.type === 'bot') {
    const b = S.bots.find(o => o.id === sel.id); if (!b) return select(null);
    title = b.name;
    html = `<div class="status" data-live="status"></div>
      <div class="kv"><span>Cargo</span><span data-live="cargo"></span></div>
      <h3>Program</h3><p>Runs top to bottom, then loops. A sweep step ends when the bot is full or its area is clean.</p>
      <ol class="prog">${b.prog.map((s, k) => stepRow(b, s, k)).join('')}</ol>
      <div class="row"><button class="btn" data-act="add" ${b.prog.length >= 8 ? 'disabled' : ''}>Add step</button><button class="btn" data-act="copyall">Copy to all bots</button></div>`;
  } else if (sel.type === 'veh') {
    const v = S.vehicles.find(o => o.id === sel.id); if (!v) return select(null);
    title = v.name; html = vehiclePanel(v);
  } else if (sel.type === 'building') {
    const b = byId.get(sel.id); if (!b) return select(null);
    title = b.label;
    if (b.kind === 'recycler') html = `<p>Turns junk into stock you build with. Walk or drive up to it to unload. Bots unload here, and belts pointing into it feed it.</p>
      <div class="kv"><span>Pieces recycled</span><span data-live="recycled"></span></div><div class="kv"><span>By machines</span><span data-live="bymach"></span></div><div class="kv"><span>From belts</span><span data-live="beltd"></span></div>`;
    else if (b.kind === 'bin') html = `<p>${MACH.bin.desc} You, your vehicles and your bots can drop junk here, and bots can fetch from it.</p>${storeRow}${removeRow}`;
    else if (b.kind === 'vac') html = `<p>${MACH.vac.desc}</p><div class="status" data-live="vacstate"></div>${storeRow}${removeRow}`;
    else if (isProc(b)) html = `<p>${MACH[b.kind].desc} Feed it by belt or with a bot's Unload step; finished pieces go out on any belt pointing away.</p>
      <div class="status" data-live="procstate"></div>
      <div class="kv"><span>Waiting to process</span><span data-live="procin"></span></div>
      <div class="kv"><span>Ready to go out</span><span data-live="procout"></span></div>${removeRow}`;
    else if (b.kind === 'garage') html = garagePanel(b);
    else if (b.kind === 'hive') html = `<p>${MACH.hive.desc} Belt it to the Recycler, or have a bot fetch from it.</p>
      <div class="kv"><span>Drones</span><span data-live="drones"></span></div>${storeRow}
      <div class="row"><button class="btn primary" data-act="drone" data-cost="${DRONE_COST.join(',')}">Add drone ${costHTML(DRONE_COST)}</button></div>${removeRow}`;
    else html = `<p>This vent is sealed. No more junk will come out of it.</p>`;
  } else if (sel.type === 'zone') {
    const z = S.zones[sel.z]; if (!z) return select({ type: 'zones' });
    title = 'Zone ' + ZL[sel.z];
    const users = S.bots.filter(b => b.prog.some(s => s.op === 'sweep' && s.arg === ZL[sel.z])).map(b => b.name).concat(S.vehicles.filter(v => v.mode === 'sweep' && v.arg === ZL[sel.z]).map(v => v.name));
    html = `<div class="kv"><span>Size</span><span>${z.x1 - z.x0 + 1} × ${z.y1 - z.y0 + 1} tiles</span></div>
      <div class="kv"><span>Junk left</span><span data-live="zonejunk"></span></div>
      <p>${users.length ? 'Swept by ' + esc(users.join(', ')) : 'Nothing sweeps this zone yet.'}</p>
      <div class="row"><button class="btn primary" data-act="assign" data-cost="bot" data-lock="bot">Build a bot for this zone</button><button class="btn danger" data-act="delzone">Delete zone</button></div>`;
  } else if (sel.type === 'zones') {
    title = 'Zones';
    html = `<p>Drag on the ground to paint the next zone. Bots and autopilots only sweep where you send them.</p>
      <ul class="tasks">${S.zones.map((z, k) => `<li><span class="tick" style="background:${z ? ZC[k] : 'transparent'};border-color:${ZC[k]}"></span><span class="t">Zone ${ZL[k]} ${z ? '' : '(not painted)'}</span>${z ? `<button class="btn" data-act="pickzone" data-k="${k}">Open</button>` : '<span></span>'}</li>`).join('')}</ul>`;
  } else if (sel.type === 'build') {
    title = 'Build';
    const lockFor = (g, k) => g === 'Bots' ? 'bot' : g === 'Machines' ? (k === 'vacrate' ? 'vac' : k === 'proc' ? 'compactor' : 'belt') : '';
    const group = g => Object.keys(UPG).filter(k => UPG[k].group === g).map(k => { const u = UPG[k], lv = S.upg[k], max = lv >= u.costs.length;
      return `<div class="shop-item"><b>${u.name}</b><p>${u.desc}: ${u.vals[lv]}${max ? '' : ' → ' + u.vals[lv + 1]}</p>
      <span class="pips">${u.vals.map((_, i) => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</span>
      <button class="btn primary" data-act="upg" data-k="${k}" ${max ? 'disabled' : ''} data-cost="${max ? '' : c4(u.costs[lv]).join(',')}" data-lock="${lockFor(g, k)}">${max ? 'Maxed' : costHTML(u.costs[lv])}</button></div>`; }).join('');
    html = `<h3>Suit</h3>${group('Suit')}
      <h3>Bots</h3>
      <div class="shop-item"><b>Cleaning bot</b><p data-live="botinfo"></p><button class="btn primary" data-act="buybot" data-cost="bot" data-lock="bot"></button></div>
      ${group('Bots')}
      <h3>Vehicles</h3>
      <p data-live="vehinfo"></p>
      <h3>Machines</h3>
      ${['belt', 'splitter', ...PALETTE].map(k => `<div class="shop-item"><b>${MACH[k].name}</b><p>${MACH[k].desc}</p><p data-live="lock-${k}"></p><span class="costs">${costHTML(MACH[k].cost)}</span></div>`).join('')}
      ${group('Machines')}`;
  } else if (sel.type === 'tasks') {
    title = 'Tasks';
    const cur = curTask();
    html = `<ul class="tasks">${TASKS.map(t => `<li class="${S.tasksDone.includes(t.id) ? 'done' : ''} ${cur === t ? 'cur' : ''}"><span class="tick"></span><span class="t">${t.text}</span><span class="r">${c4(t.reward)[0] ? costHTML(t.reward) : ''}</span></li>`).join('')}</ul>`;
  } else if (sel.type === 'menu') {
    title = 'Menu';
    html = `<div class="kv"><span>Save slot</span><span>Slot ${slot}</span></div>
      <div class="kv"><span>Time played</span><span data-live="time"></span></div>
      <div class="row"><button class="btn primary" data-act="quit">Save and go to title</button></div>
      <h3>How it works</h3>
      <p>Walk around and your vacuum picks up junk. Empty your backpack at the Recycler to stock dust, scrap, crystal and alloy.</p>
      <p>Spend stock on suit upgrades and machines: bins and belts, splitters, Vac Posts, Compactors and Smelters, bots, a Garage full of vehicles, and Drone Hives. Machines unlock as you recycle more.</p>
      <p>Cap all six vents and sweep every piece to win.</p>
      <h3>Controls</h3>
      <p>Drag anywhere to walk or drive, or use WASD or the arrow keys. Tap things to inspect them. Two fingers pan and pinch to zoom; moving brings the camera back. Tap the minimap to look around.</p>`;
  }
  $('panelTitle').textContent = title;
  pbody.innerHTML = html;
  live();
}
function stepRow(b, s, k) {
  const ops = [['sweep', 'Sweep'], ['unload', 'Unload at'], ['fetch', 'Fetch from'], ['wait', 'Wait']];
  return `<li data-k="${k}"><span class="n">${k + 1}</span>
    <select data-step="${k}" data-f="op" aria-label="Step ${k + 1} action">${ops.map(([v, l]) => `<option value="${v}" ${s.op === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <select data-step="${k}" data-f="arg" aria-label="Step ${k + 1} target">${argOptions(s).map(([v, l]) => `<option value="${v}" ${String(s.arg) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    <span class="step-btns"><button data-act="up" data-k="${k}" ${k === 0 ? 'disabled' : ''} aria-label="Move up">▲</button><button data-act="down" data-k="${k}" ${k === b.prog.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button><button data-act="del" data-k="${k}" aria-label="Delete step">✕</button></span></li>`;
}
function argOptions(s) {
  const fetchable = S.buildings.filter(b => isStore(b) || isProc(b)).map(b => ['bin:' + b.id, b.label]);
  const drops = S.buildings.filter(b => b.kind === 'bin' || b.kind === 'hive' || isProc(b)).map(b => ['bin:' + b.id, b.label]);
  if (s.op === 'sweep') {
    const o = [['near', 'Nearest junk']];
    S.zones.forEach((z, k) => { if (z || s.arg === ZL[k]) o.push([ZL[k], 'Zone ' + ZL[k] + (z ? '' : ' (gone)')]); });
    return o;
  }
  if (s.op === 'unload') return [['nearest', 'Nearest drop-off'], ['recycler', 'Recycler'], ...drops];
  if (s.op === 'fetch') return fetchable.length ? fetchable : [['none', 'Nothing built yet']];
  return [[2, '2 s'], [5, '5 s'], [10, '10 s'], [30, '30 s']];
}
const defaultArg = op => op === 'sweep' ? 'near' : op === 'unload' ? 'nearest' : op === 'fetch' ? argOptions({ op })[0][0] : 5;

pbody.addEventListener('change', e => {
  const el = e.target; if (!el.dataset.step) return;
  const b = S.bots.find(o => o.id === sel.id); if (!b) return;
  const s = b.prog[+el.dataset.step];
  if (el.dataset.f === 'op') { s.op = el.value; s.arg = defaultArg(s.op); }
  else s.arg = s.op === 'wait' ? +el.value : el.value;
  b.pc = 0; release(b); b.idle = 0; b.timer = 0;
  renderPanel();
});
pbody.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
  const a = el.dataset.act, k = el.dataset.k;
  const bot = sel && sel.type === 'bot' ? S.bots.find(o => o.id === sel.id) : null;
  const veh = sel && sel.type === 'veh' ? S.vehicles.find(o => o.id === sel.id) : null;
  const reset = () => { if (bot) { bot.pc = 0; release(bot); bot.idle = 0; bot.timer = 0; } };
  const n = +k;
  if (a === 'add' && bot) { bot.prog.push({ op: 'unload', arg: 'nearest' }); reset(); }
  else if (a === 'del' && bot) { bot.prog.splice(n, 1); reset(); }
  else if (a === 'up' && bot) { [bot.prog[n - 1], bot.prog[n]] = [bot.prog[n], bot.prog[n - 1]]; reset(); }
  else if (a === 'down' && bot) { [bot.prog[n + 1], bot.prog[n]] = [bot.prog[n], bot.prog[n + 1]]; reset(); }
  else if (a === 'copyall' && bot) { for (const o of S.bots) if (o !== bot && !o.hive) { o.prog = bot.prog.map(s => ({ ...s })); o.pc = 0; release(o); o.idle = 0; } toast('Program copied to every bot'); }
  else if (a === 'delb') { const b = byId.get(sel.id); if (b) removeAt(b.x, b.y); return; }
  else if (a === 'drone') { const h = byId.get(sel.id); if (h) addDrone(h, false); }
  else if (a === 'stall') { const g = byId.get(sel.id); if (g && g.stalls < STALL_MAX) { if (!canPay(STALL_COST)) return toast('A stall needs ' + costText(STALL_COST)); pay(STALL_COST); g.stalls++; toast('Stall added'); } }
  else if (a === 'buyveh') { const g = byId.get(sel.id); if (g) buyVehicle(g, k); }
  else if (a === 'openveh') { select({ type: 'veh', id: n }); return; }
  else if (a === 'drive' && veh) { board(veh); return; }
  else if (a === 'hop' && veh) { hopOut(); }
  else if (a === 'vhome' && veh) { if (nearHome(veh)) park(veh); else if (veh.feat.auto) { if (S.me.inVeh === veh.id) hopOut(); veh.mode = 'home'; toast(veh.name + ' is heading home'); } }
  else if (a === 'dispatch' && veh) { dispatch(veh, $('autoArg').value); }
  else if (a === 'vup' && veh) { const lv = veh.up[k]; if (lv < VUPG_COST.length && canPay(VUPG_COST[lv])) { pay(VUPG_COST[lv]); veh.up[k]++; toast(veh.name + ': ' + VUPG[k].name + ' upgraded'); } }
  else if (a === 'vfeat' && veh) { if (!veh.feat[k] && canPay(VFEAT[k].cost)) { pay(VFEAT[k].cost); veh.feat[k] = 1; toast(veh.name + ': ' + VFEAT[k].name + ' fitted'); } }
  else if (a === 'delzone') { S.zones[sel.z] = null; select({ type: 'zones' }); return; }
  else if (a === 'pickzone') { select({ type: 'zone', z: n }); return; }
  else if (a === 'assign') {
    const nb = buyBot(); if (!nb) return;
    nb.prog = [{ op: 'sweep', arg: ZL[sel.z] }, { op: 'unload', arg: 'nearest' }];
    select({ type: 'bot', id: nb.id }); return;
  }
  else if (a === 'buybot') buyBot();
  else if (a === 'upg') { const u = UPG[k], lv = S.upg[k]; if (lv < u.costs.length && canPay(u.costs[lv])) { pay(u.costs[lv]); S.upg[k]++; toast(u.name + ' upgraded'); } }
  else if (a === 'quit') { goTitle(); return; }
  renderPanel();
});
function buyBot() {
  if (!unlocked('bot')) { toast('Bots unlock after recycling ' + fmt(BOT_UNLOCK) + ' pieces'); return null; }
  const c = botCost(); if (!canPay(c)) { toast('A bot needs ' + costText(c)); return null; }
  pay(c);
  const r = recycler();
  const b = newBot(r.x + 1, r.y + 1);
  toast(b.name + ' is online');
  hintOnce('bot', 'Tap a bot to change its program');
  return b;
}
const fmtTime = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + 'h ' : '') + m + 'm ' + (s % 60) + 's'; };
const fmtCargo = a => sum4(a) ? a.map((n, k) => n ? n + ' ' + RES[k].toLowerCase() : '').filter(Boolean).join(', ') : 'empty';
function live() {
  if (!sel || !S) return;
  const q = n => pbody.querySelector(`[data-live="${n}"]`);
  const set = (n, v) => { const e = q(n); if (e && e.textContent !== v) e.textContent = v; };
  if (sel.type === 'bot') {
    const b = S.bots.find(o => o.id === sel.id); if (!b) return;
    set('status', b.status); set('cargo', cargoN(b) + ' / ' + uv('cargo'));
    pbody.querySelectorAll('.prog li').forEach(li => li.classList.toggle('now', +li.dataset.k === b.pc && b.idle <= 0));
  } else if (sel.type === 'veh') {
    const v = S.vehicles.find(o => o.id === sel.id); if (!v) return;
    set('vstatus', v.parked ? 'Parked in ' + (garageOf(v) ? garageOf(v).label : 'the garage') : v.status); set('vcargo', sum4(v.cargo) + ' / ' + vStat(v, 'hopper'));
  } else if (sel.type === 'building') {
    const b = byId.get(sel.id); if (!b) return;
    set('recycled', S.stats.recycled.toLocaleString()); set('bymach', S.stats.byMachines.toLocaleString()); set('beltd', S.stats.beltDelivered.toLocaleString());
    if (isStore(b)) set('store', sum4(b.store) + ' / ' + capOf(b));
    if (b.kind === 'vac') set('vacstate', b.full ? 'Full. Belt it out or fetch from it.' : b.idle ? 'Nothing left in reach' : 'Cleaning');
    if (b.kind === 'hive') set('drones', b.drones + ' / ' + HIVE_MAX);
    if (isProc(b)) { const m = MACH[b.kind]; set('procstate', b.working ? 'Working' : sum4(b.out) >= PROC_OUT ? 'Output full. Belt it out.' : 'Waiting for ' + RES[m.input].toLowerCase()); set('procin', b.inp + ' ' + RES[m.input].toLowerCase() + ' / ' + PROC_IN); set('procout', fmtCargo(b.out)); }
    if (b.kind === 'garage') for (const v of S.vehicles.filter(o => o.garage === b.id)) set('vst-' + v.id, v.parked ? 'Parked' : v.status);
  } else if (sel.type === 'zone') {
    const z = S.zones[sel.z]; if (!z) return;
    let n = 0; for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) n += pileOf(idx(x, y));
    set('zonejunk', n.toLocaleString() + ' pieces');
  } else if (sel.type === 'build') {
    set('botinfo', unlocked('bot') ? `Flies over boulders and runs the program you give it. You have ${ownBots()}.` : `Unlocks after recycling ${fmt(BOT_UNLOCK)} pieces (${fmt(S.stats.recycled)} so far).`);
    set('vehinfo', unlocked('garage') ? (count('garage') ? `Open a Garage to buy vehicles and add stalls. Your fleet: ${S.vehicles.length}.` : 'Build a Garage from the Machines palette, then buy vehicles there.') : `Vehicles need a Garage, which unlocks after recycling ${fmt(MACH.garage.unlock)} pieces.`);
    for (const k of ['belt', 'splitter', ...PALETTE]) set('lock-' + k, unlocked(k) ? (k === 'belt' || k === 'splitter' ? 'Use the ' + MACH[k].name + ' tool.' : 'Pick it from the Machines button.') : `Unlocks after recycling ${fmt(MACH[k].unlock)} pieces.`);
  } else if (sel.type === 'menu') set('time', fmtTime(S.time));
  pbody.querySelectorAll('[data-cost]').forEach(btn => {
    if (btn.dataset.cost === '') return;
    const c = btn.dataset.cost === 'bot' ? botCost() : btn.dataset.cost.split(',').map(Number);
    if (btn.dataset.act === 'buybot') { const h = costHTML(c); if (btn.innerHTML !== h) btn.innerHTML = h; }
    const lockOk = !btn.dataset.lock || unlocked(btn.dataset.lock);
    const hive = btn.dataset.act === 'drone' ? byId.get(sel.id) : null;
    btn.disabled = !canPay(c) || !lockOk || !!(hive && hive.drones >= HIVE_MAX) || !!btn.dataset.needstall;
  });
}

// ---------- HUD ----------
function hud() {
  if (!S || paused) return;
  for (let k = 0; k < 4; k++) $('res' + k).textContent = fmt(S.res[k]);
  while (incomeLog.length && incomeLog[0][0] < S.time - 60) incomeLog.shift();
  const span = Math.min(60, Math.max(10, S.time - (incomeLog.length ? incomeLog[0][0] : S.time)));
  const sum = incomeLog.reduce((a, b) => a + b[1], 0);
  $('rate').textContent = fmt(Math.round(sum * 60 / span)) + '/min';
  const v = S.me.inVeh && S.vehicles.find(o => o.id === S.me.inVeh);
  const carried = v ? sum4(v.cargo) : meN(), capN = v ? vStat(v, 'hopper') : uv('pack');
  $('packLbl').textContent = v ? 'Hopper' : 'Backpack';
  const f = carried / capN;
  $('packBar').style.width = (f * 100) + '%';
  $('packBar').classList.toggle('full', f >= 1);
  $('packText').textContent = carried + '/' + capN;
  const c = cleanFrac();
  $('cleanPct').textContent = (c >= .999 && S.remaining > 0 ? 99.9 : Math.floor(c * 1000) / 10).toFixed(1) + '%';
  $('cleanBar').style.width = (c * 100) + '%';
  $('ventCount').textContent = capped() + '/' + VENTS;
  const t = curTask();
  $('taskText').textContent = t ? t.text : 'All tasks done';
  $('taskBar').style.width = (t ? clamp(t.p(), 0, 1) * 100 : 100) + '%';
  document.querySelectorAll('#toolbar button[data-tool]').forEach(b => {
    const k = b.dataset.tool, m = MACH[k];
    const locked = !!lockedTool(k);
    b.classList.toggle('locked', locked);
    b.classList.toggle('poor', !!(m && !locked && !canPay(m.cost)));
  });
  const mt = MACH[S.machTool];
  $('machBtn').classList.toggle('locked', !!lockedTool(S.machTool));
  $('machBtn').classList.toggle('poor', !lockedTool(S.machTool) && !canPay(mt.cost));
  $('findMe').disabled = follow;
  updateDriveBar();
  livePalette();
}

// ---------- messages ----------
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }
function hintOnce(key, msg) { if (S.hintsSeen[key]) return; S.hintsSeen[key] = 1; setTimeout(() => toast(msg), 2300); }
function showWin() {
  const m = $('modal');
  $('modalCard').innerHTML = `<h2>Spotless</h2><p>Every vent capped and every piece swept in ${fmtTime(S.time)}. ${S.bots.length} bots and drones, ${S.vehicles.length} vehicles, ${S.stats.recycled.toLocaleString()} pieces recycled, ${Math.round(100 * S.stats.byMachines / Math.max(1, S.stats.recycled))}% of them by machines.</p>
    <div class="row"><button class="btn" id="winKeep">Keep playing</button><button class="btn primary" id="winNew">Go to title</button></div>`;
  m.hidden = false;
  $('winKeep').onclick = () => { m.hidden = true; };
  $('winNew').onclick = () => { m.hidden = true; goTitle(); };
}

// ---------- title screen and save slots ----------
function slotSummary(n) {
  const raw = lsGet(slotKey(n));
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    return { clean: clamp(1 - o.remaining / o.initial, 0, 1), time: o.time, bots: (o.bots || []).length, veh: (o.vehicles || []).length,
      res: c4(o.res || []), savedAt: o.savedAt, caps: (o.vents || []).filter(v => v.capped).length, won: o.won };
  } catch (e) { return { broken: true }; }
}
let titleConfirm = null; // {kind:'delete'|'copy', from, to}
function renderTitle() {
  const cards = [];
  for (let n = 1; n <= SLOTS; n++) {
    const s = slotSummary(n);
    let body;
    if (!s) body = `<p class="empty">Empty slot</p><div class="row"><button class="btn primary" data-t="new" data-n="${n}">New rock</button></div>`;
    else if (s.broken) body = `<p class="empty">This save could not be read.</p><div class="row"><button class="btn danger" data-t="del" data-n="${n}">Delete</button></div>`;
    else {
      const when = s.savedAt ? new Date(s.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
      body = `<div class="slot-stats"><span><b>${(s.clean * 100).toFixed(1)}%</b> clean</span><span><b>${s.caps}/${VENTS}</b> vents</span><span><b>${s.bots}</b> bots</span><span><b>${s.veh}</b> vehicles</span></div>
        <div class="slot-res">${costHTML(s.res.map(Math.floor))}</div>
        <p class="when">${fmtTime(s.time)} played${when ? ' · saved ' + when : ''}${s.won ? ' · spotless' : ''}</p>
        <div class="row"><button class="btn primary" data-t="play" data-n="${n}">Play</button><button class="btn" data-t="copy" data-n="${n}">Copy to…</button><button class="btn danger" data-t="del" data-n="${n}">Delete</button></div>`;
    }
    let confirm = '';
    if (titleConfirm && titleConfirm.from === n) {
      if (titleConfirm.kind === 'delete') confirm = `<div class="confirm"><p>Delete this save? It can't be undone.</p><div class="row"><button class="btn" data-t="cancel">Keep it</button><button class="btn danger" data-t="yesdel" data-n="${n}">Delete</button></div></div>`;
      else if (titleConfirm.kind === 'copy' && !titleConfirm.to) confirm = `<div class="confirm"><p>Copy this save into which slot?</p><div class="row">${[1, 2, 3].filter(m => m !== n).map(m => `<button class="btn" data-t="copyto" data-n="${n}" data-m="${m}">Slot ${m}${slotSummary(m) ? ' (replace)' : ''}</button>`).join('')}<button class="btn" data-t="cancel">Cancel</button></div></div>`;
      else if (titleConfirm.kind === 'copy') confirm = `<div class="confirm"><p>Slot ${titleConfirm.to} already has a save. Replace it with a copy of slot ${n}?</p><div class="row"><button class="btn" data-t="cancel">Cancel</button><button class="btn primary" data-t="yescopy" data-n="${n}" data-m="${titleConfirm.to}">Replace</button></div></div>`;
    }
    cards.push(`<section class="slot"><h3>Slot ${n}</h3>${body}${confirm}</section>`);
  }
  $('slots').innerHTML = cards.join('');
}
$('slots').addEventListener('click', e => {
  const b = e.target.closest('[data-t]'); if (!b) return;
  const t = b.dataset.t, n = +b.dataset.n, m = +b.dataset.m;
  if (t === 'new') { startSlot(n, null); return; }
  if (t === 'play') { const o = parseSave(lsGet(slotKey(n))); if (!o) { toast('That save could not be read'); return; } startSlot(n, o); return; }
  if (t === 'del') titleConfirm = { kind: 'delete', from: n };
  else if (t === 'yesdel') { lsDel(slotKey(n)); titleConfirm = null; toast('Slot ' + n + ' deleted'); }
  else if (t === 'copy') titleConfirm = { kind: 'copy', from: n };
  else if (t === 'copyto') { if (slotSummary(m)) titleConfirm = { kind: 'copy', from: n, to: m }; else { copySlot(n, m); titleConfirm = null; } }
  else if (t === 'yescopy') { copySlot(n, m); titleConfirm = null; }
  else if (t === 'cancel') titleConfirm = null;
  renderTitle();
});
function copySlot(a, b) { const raw = lsGet(slotKey(a)); if (raw && lsSet(slotKey(b), raw)) toast('Copied slot ' + a + ' to slot ' + b); else toast('Could not copy: browser storage is full or blocked'); }
function startSlot(n, o) {
  slot = n;
  S = o || generate((Math.random() * 1e9) | 0);
  boot();
  paused = false;
  $('title').hidden = true; document.body.classList.remove('at-title');
  select(null); setTool('walk');
  if (!o) toast('Drag anywhere to walk. Your vacuum does the rest');
  save();
}
function goTitle() {
  save();
  paused = true; slot = 0; keys.clear(); stick = null;
  select(null); closePalette();
  titleConfirm = null; renderTitle();
  $('title').hidden = false; document.body.classList.add('at-title');
  $('driveBar').hidden = true;
}

// ---------- boot ----------
function boot() {
  rebuildIndex();
  reserved.clear(); parts.length = 0; incomeLog.length = 0;
  rng = mulberry(S.seed ^ 0x5bd1e995);
  for (const b of S.bots) b.tgt = -1;
  for (const b of S.buildings) b.tgt = -1;
  for (const v of S.vehicles) { v.tgt = -1; v.avoid = new Map(); }
  buildGround();
  follow = true; const [fx, fy] = focus(); cam.x = fx * TS; cam.y = fy * TS; cam.z = 1.3;
  $('modal').hidden = true;
  resize();
  $('speedBtn').textContent = S.speed + '×';
  syncToolbar(); updateDriveBar();
}
migrateOld();
resize();
S = generate(20261124); boot(); cam.z = .9;   // a rock to drift over behind the title screen
goTitle();
addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);
setInterval(save, 10000);
setInterval(() => { if (!paused) { hud(); live(); checkTasks(); } }, 250);
setInterval(drawMini, 400);

let last = performance.now();
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (!paused && $('modal').hidden) {
    for (let s = 0; s < S.speed; s++) { let rem = dt; while (rem > 0) { const d = Math.min(rem, 1 / 30); tick(d); rem -= d; } }
    stepParts(dt);
  }
  render(now, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__dw = { get S() { return S; }, tick, save, UPG, MACH, VEH, botCost, newBot, placeMachine, addDrone, buyBot, canPay, pay, ownBots, keys, unlocked,
  buyVehicle, board, hopOut, dispatch, placeSplitter, startSlot, goTitle, select, get slot() { return slot; } };
})();
