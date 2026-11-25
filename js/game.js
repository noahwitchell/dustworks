'use strict';
// Dustworks — clean up a junk-covered rock by building and programming an automated cleaning crew.
(() => {
// ---------- constants ----------
const TS = 32;            // world px per tile
const W = 72, H = 48, N = W * H;
const GS = 1.5;           // ground cache resolution (px per world px)
const VALUE = [1, 2, 5];  // dust, scrap, crystal
const KIND = ['dust', 'scrap', 'crystal'];
const MAXPILE = [12, 6, 3];
const ZL = ['A', 'B', 'C', 'D', 'E', 'F'];
const ZC = ['#ffb547', '#ff7a6b', '#5cc8ff', '#9be15d', '#b48cff', '#ff8bd1'];
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const COST = { bin: 60, belt: 2, cap: 1500 };
const BIN_CAP = 40;
const HAND_RATE = 14;     // pieces per second by hand
const SAVE_KEY = 'dustworks.v1';
const UPG = {
  cargo:   { name: 'Cargo hold',  desc: 'Pieces each bot can carry', vals: [4, 8, 14, 24], costs: [150, 600, 2000] },
  speed:   { name: 'Thrusters',   desc: 'Bot flight speed, tiles/s', vals: [1.5, 2.2, 3.2, 4.5], costs: [180, 700, 2200] },
  suction: { name: 'Bot suction', desc: 'Pieces per second a bot picks up', vals: [1.5, 3, 5, 8], costs: [150, 650, 2100] },
  hand:    { name: 'Hand vacuum', desc: 'Your sweep radius, tiles', vals: [0.9, 1.6, 2.4], costs: [60, 300] },
  belt:    { name: 'Belt motors', desc: 'Belt speed, tiles/s', vals: [1.5, 2.5, 4], costs: [200, 800] },
};
const uv = k => UPG[k].vals[S.upg[k]];
const botCost = () => Math.round(30 * Math.pow(1.5, S.bots.length - 1));

// ---------- tiny utils ----------
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const idx = (x, y) => y * W + x;
const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
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

// ---------- state ----------
let S = null;
let byId = new Map();      // building id -> building
let rng = Math.random;

function generate(seed) {
  const st = {
    v: 1, seed, credits: 0, time: 0, speed: 1, remaining: 0, initial: 0,
    dust: new Uint8Array(N), scrap: new Uint8Array(N), crys: new Uint8Array(N),
    rock: new Uint8Array(N), belt: new Int8Array(N).fill(-1), bmap: new Int32Array(N),
    buildings: [], vents: [], zones: [null, null, null, null, null, null], bots: [], items: [],
    upg: { cargo: 0, speed: 0, suction: 0, hand: 0, belt: 0 },
    stats: { hand: 0, recycled: 0, beltDelivered: 0, fetched: 0, earned: 0 },
    tasksDone: [], nextId: 1, binNo: 1, botNo: 1, lastBeltDir: 0, won: false, hintsSeen: {},
  };
  const cx = W / 2, cy = H / 2;
  const R = mulberry(seed);
  // vents, spread around the rock
  const a0 = R() * Math.PI * 2;
  for (let k = 0; k < 3; k++) {
    const a = a0 + k * 2.094 + (R() - .5) * .5;
    const vx = Math.round(clamp(cx + Math.cos(a) * W * .36, 5, W - 6));
    const vy = Math.round(clamp(cy + Math.sin(a) * H * .34, 5, H - 6));
    st.vents.push({ x: vx, y: vy, capped: false, t: R() * 2 });
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y), dc = Math.hypot(x + .5 - cx, y + .5 - cy);
    let nearVent = 99;
    for (const v of st.vents) nearVent = Math.min(nearVent, Math.hypot(x - v.x, y - v.y));
    if (fbm(x / 6, y / 6, seed + 50) > .7 && dc > 6 && nearVent > 2.5) { st.rock[i] = 1; continue; }
    let d = fbm(x / 9, y / 9, seed + 1) * 1.6 - .38;
    d *= smooth(3, 10, dc);
    d += .9 * Math.max(0, 1 - nearVent / 7);
    d = clamp(d, 0, 1);
    if (d > .12) st.dust[i] = Math.round(d * 8 * (.5 + .5 * hash2(x, y, seed + 3)));
    if (fbm(x / 5, y / 5, seed + 2) > .56 && d > .15) st.scrap[i] = Math.min(6, Math.round(d * 5));
    if (fbm(x / 4, y / 4, seed + 4) > .7 && d > .3) st.crys[i] = hash2(x, y, seed + 9) > .6 ? 2 : 1;
  }
  for (const v of st.vents) { const i = idx(v.x, v.y); st.dust[i] = st.scrap[i] = st.crys[i] = 0; }
  // the recycler in the middle (2x2), ground around it swept
  const rx = Math.floor(cx) - 1, ry = Math.floor(cy) - 1;
  st.buildings.push({ id: st.nextId++, kind: 'recycler', x: rx, y: ry, w: 2, h: 2, store: [0, 0, 0], label: 'Recycler' });
  for (let i = 0; i < N; i++) st.remaining += st.dust[i] + st.scrap[i] + st.crys[i];
  st.initial = st.remaining;
  st.zones[0] = { x0: rx - 8, y0: ry - 6, x1: rx + 9, y1: ry + 7 };
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

function newBot(x, y) {
  const b = { id: S.nextId++, name: 'Bot ' + S.botNo++, x, y, cargo: [0, 0, 0], prog: [{ op: 'sweep', arg: 'A' }, { op: 'unload', arg: 'nearest' }],
    pc: 0, tgt: -1, timer: 0, acc: 0, hue: (S.botNo * 47 + 20) % 360, status: 'Starting', worked: false, idle: 0, ang: 0 };
  S.bots.push(b);
  return b;
}

// ---------- save / load ----------
const b64 = arr => { let s = ''; const u = new Uint8Array(arr.buffer); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
const unb64 = (str, T) => { const s = atob(str); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new T(u.buffer); };
function save() {
  if (!S) return;
  try {
    const o = Object.assign({}, S, { dust: b64(S.dust), scrap: b64(S.scrap), crys: b64(S.crys), rock: b64(S.rock), belt: b64(S.belt), bmap: undefined,
      bots: S.bots.map(b => Object.assign({}, b, { tgt: -1 })) });
    localStorage.setItem(SAVE_KEY, JSON.stringify(o));
  } catch (e) { /* storage blocked: game still runs */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o.v !== 1) return null;
    o.dust = unb64(o.dust, Uint8Array); o.scrap = unb64(o.scrap, Uint8Array); o.crys = unb64(o.crys, Uint8Array);
    o.rock = unb64(o.rock, Uint8Array); o.belt = unb64(o.belt, Int8Array); o.bmap = new Int32Array(N);
    return o;
  } catch (e) { return null; }
}

// ---------- debris ----------
const pileOf = i => S.dust[i] + S.scrap[i] + S.crys[i];
const dirty = new Set();
function addDebris(i, k, n) {
  const arr = k === 0 ? S.dust : k === 1 ? S.scrap : S.crys;
  const add = Math.min(n, MAXPILE[k] - arr[i]);
  if (add > 0) { arr[i] += add; S.remaining += add; dirty.add(i); }
}
// take up to n pieces from tile i (shiniest first); calls put(kind, count)
function takeFromTile(i, n, put) {
  let got = 0;
  for (const k of [2, 1, 0]) {
    const arr = k === 0 ? S.dust : k === 1 ? S.scrap : S.crys;
    const t = Math.min(arr[i], n - got);
    if (t > 0) { arr[i] -= t; got += t; S.remaining -= t; put(k, t); }
    if (got >= n) break;
  }
  if (got) dirty.add(i);
  return got;
}
function earn(c) { S.credits += c; S.stats.earned += c; incomeLog.push([S.time, c]); }
const incomeLog = [];

// ---------- buildings ----------
function accept(b, k, n) {
  if (b.kind === 'recycler') { earn(VALUE[k] * n); S.stats.recycled += n; return n; }
  if (b.kind === 'bin') { const room = BIN_CAP - (b.store[0] + b.store[1] + b.store[2]); const t = Math.min(room, n); b.store[k] += t; return t; }
  return 0;
}
const binTotal = b => b.store[0] + b.store[1] + b.store[2];
const freeTile = i => !S.rock[i] && !S.bmap[i] && !isVent(i);
function isVent(i) { for (const v of S.vents) if (idx(v.x, v.y) === i) return true; return false; }
function clearUnder(i) { // building over junk sweeps it into your account
  takeFromTile(i, 99, (k, t) => earn(VALUE[k] * t));
}
function placeBin(x, y) {
  const i = idx(x, y);
  if (!inMap(x, y) || !freeTile(i)) return toast('Pick open ground for the bin');
  if (S.credits < COST.bin) return toast('A bin costs ' + COST.bin + ' credits');
  if (S.belt[i] >= 0) removeBelt(i);
  S.credits -= COST.bin; clearUnder(i);
  const b = { id: S.nextId++, kind: 'bin', x, y, w: 1, h: 1, store: [0, 0, 0], label: 'Bin ' + S.binNo++ };
  S.buildings.push(b); rebuildIndex(); select({ type: 'building', id: b.id });
  hintOnce('bin', 'Bins pass their contents onto any belt pointing away from them');
}
function placeBelt(i, dir) {
  if (S.belt[i] >= 0) { S.belt[i] = dir; return true; }
  if (!freeTile(i)) return false;
  if (S.credits < COST.belt) { toast('Out of credits for belts'); return false; }
  S.credits -= COST.belt; clearUnder(i); S.belt[i] = dir; return true;
}
function removeBelt(i) {
  S.belt[i] = -1; S.items = S.items.filter(it => it.i !== i);
}
function removeAt(x, y) {
  const i = idx(x, y);
  if (S.belt[i] >= 0) { removeBelt(i); return; }
  const id = S.bmap[i]; if (!id) return;
  const b = byId.get(id);
  if (b.kind !== 'bin') return toast(b.kind === 'recycler' ? 'The Recycler stays' : 'Caps stay put');
  for (let k = 0; k < 3; k++) earn(VALUE[k] * b.store[k]);
  earn(Math.floor(COST.bin / 2));
  S.buildings = S.buildings.filter(o => o !== b); rebuildIndex();
  if (sel && sel.id === b.id) select(null);
}
function capVent(x, y) {
  const v = S.vents.find(v => Math.abs(v.x - x) <= 1 && Math.abs(v.y - y) <= 1 && !v.capped);
  if (!v) return toast('Tap an open vent to cap it');
  if (S.credits < COST.cap) return toast('A cap costs ' + COST.cap + ' credits');
  S.credits -= COST.cap; v.capped = true;
  const i = idx(v.x, v.y); if (S.belt[i] >= 0) removeBelt(i);
  S.buildings.push({ id: S.nextId++, kind: 'cap', x: v.x, y: v.y, w: 1, h: 1, store: [0, 0, 0], label: 'Vent cap' });
  rebuildIndex(); toast('Vent capped');
}

// ---------- belts ----------
const GAP = .34;
function stepBelts(dt) {
  if (!S.items.length) { binsOut(dt); return; }
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
    if (head.t >= 1 && d >= 0) {
      const x = i % W + DIRS[d][0], y = (i / W | 0) + DIRS[d][1];
      if (!inMap(x, y)) continue;
      const j = idx(x, y);
      if (S.bmap[j]) {
        const b = byId.get(S.bmap[j]);
        if (accept(b, head.k, 1)) { head.gone = true; if (b.kind === 'recycler') S.stats.beltDelivered++; }
      } else if (S.belt[j] >= 0) {
        const nxt = per.get(j);
        let minT = 1; if (nxt) for (const o of nxt) minT = Math.min(minT, o.t);
        if (!nxt || minT >= GAP) moved.push([head, j]);
      }
    }
  }
  for (const [it, j] of moved) { it.i = j; it.t = 0; }
  S.items = S.items.filter(it => !it.gone);
  binsOut(dt);
}
let binTick = 0;
function binsOut(dt) {
  binTick += dt; if (binTick < .25) return; binTick = 0;
  for (const b of S.buildings) {
    if (b.kind !== 'bin' || !binTotal(b)) continue;
    for (let d = 0; d < 4; d++) {
      const x = b.x + DIRS[d][0], y = b.y + DIRS[d][1];
      if (!inMap(x, y)) continue;
      const j = idx(x, y);
      if (S.belt[j] !== d) continue; // belt must point away from the bin
      if (S.items.some(it => it.i === j && it.t < GAP)) continue;
      const k = b.store[2] ? 2 : b.store[1] ? 1 : 0;
      if (!b.store[k]) break;
      b.store[k]--; S.items.push({ i: j, t: 0, k });
      if (!binTotal(b)) break;
    }
  }
}

// ---------- bots ----------
const reserved = new Map(); // tile -> bot id
const cargoN = b => b.cargo[0] + b.cargo[1] + b.cargo[2];
function zoneRect(arg) {
  if (arg === 'any') return { x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
  const z = S.zones[ZL.indexOf(arg)];
  return z || null;
}
function findJunk(bot, r) {
  let best = -1, bd = 1e9;
  const bx = bot.x, by = bot.y;
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
    const i = idx(x, y);
    if (!pileOf(i)) continue;
    const rv = reserved.get(i); if (rv !== undefined && rv !== bot.id) continue;
    const dx = x + .5 - bx, dy = y + .5 - by, d = dx * dx + dy * dy - pileOf(i) * .15;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function release(bot) { if (bot.tgt >= 0 && reserved.get(bot.tgt) === bot.id) reserved.delete(bot.tgt); bot.tgt = -1; }
function flyTo(bot, tx, ty, dt) {
  const dx = tx - bot.x, dy = ty - bot.y, d = Math.hypot(dx, dy);
  const step = uv('speed') * dt;
  if (d > .01) bot.ang = Math.atan2(dy, dx);
  if (d <= step) { bot.x = tx; bot.y = ty; return true; }
  bot.x += dx / d * step; bot.y += dy / d * step; return false;
}
function nearestPoint(b, x, y) { return [clamp(x, b.x + .5, b.x + b.w - .5), clamp(y, b.y + .5, b.y + b.h - .5)]; }
function dropTarget(bot, arg) {
  if (arg === 'recycler') return recycler();
  if (arg.startsWith('bin:')) return byId.get(+arg.slice(4)) || null;
  let best = recycler(), bd = 1e9;
  for (const b of S.buildings) {
    if (b.kind === 'cap' || (b.kind === 'bin' && binTotal(b) >= BIN_CAP)) continue;
    const [px, py] = nearestPoint(b, bot.x, bot.y), d = Math.hypot(px - bot.x, py - bot.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function nextStep(bot) {
  release(bot); bot.timer = 0;
  bot.pc++;
  if (bot.pc >= bot.prog.length) {
    bot.pc = 0;
    if (!bot.worked) bot.idle = 1.5; // a full loop did nothing: rest a moment
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
    const r = zoneRect(st.arg);
    if (!r) { bot.status = 'Zone ' + st.arg + ' is not painted'; return nextStep(bot); }
    if (cargoN(bot) >= cap) return nextStep(bot);
    if (bot.tgt < 0 || !pileOf(bot.tgt)) {
      release(bot);
      const t = findJunk(bot, r);
      if (t < 0) return nextStep(bot);
      bot.tgt = t; reserved.set(t, bot.id);
    }
    bot.status = st.arg === 'any' ? 'Sweeping anywhere' : 'Sweeping Zone ' + st.arg;
    const tx = bot.tgt % W + .5, ty = (bot.tgt / W | 0) + .5;
    if (flyTo(bot, tx, ty, dt)) {
      bot.acc += uv('suction') * dt;
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
    if (!b) { bot.status = 'That bin is gone'; return nextStep(bot); }
    bot.status = 'Unloading at ' + b.label;
    const [px, py] = nearestPoint(b, bot.x, bot.y);
    if (flyTo(bot, px, py, dt)) {
      bot.timer += dt; if (bot.timer < .25) return;
      bot.timer = 0;
      let moved = 0;
      for (const k of [0, 1, 2]) { const t = accept(b, k, bot.cargo[k]); bot.cargo[k] -= t; moved += t; }
      if (moved) bot.worked = true;
      if (cargoN(bot)) {
        if (st.arg === 'nearest') return; // retarget next tick
        bot.status = b.label + ' is full, waiting';
      } else nextStep(bot);
    }
  } else if (st.op === 'fetch') {
    const b = st.arg.startsWith('bin:') ? byId.get(+st.arg.slice(4)) : null;
    if (!b) { bot.status = 'Pick a bin to fetch from'; return nextStep(bot); }
    if (cargoN(bot) >= cap) return nextStep(bot);
    bot.status = 'Fetching from ' + b.label;
    if (flyTo(bot, b.x + .5, b.y + .5, dt)) {
      bot.timer += dt; if (bot.timer < .25) return;
      bot.timer = 0;
      if (!binTotal(b)) return nextStep(bot);
      for (const k of [2, 1, 0]) {
        const t = Math.min(b.store[k], cap - cargoN(bot)); b.store[k] -= t; bot.cargo[k] += t;
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
    v.t = 2.6 + rng() * 1.4;
    for (let tries = 0; tries < 6; tries++) {
      const a = rng() * Math.PI * 2, r = 1 + rng() * 4;
      const x = Math.round(v.x + Math.cos(a) * r), y = Math.round(v.y + Math.sin(a) * r);
      if (!inMap(x, y)) continue;
      const i = idx(x, y);
      if (S.rock[i] || S.bmap[i] || S.belt[i] >= 0 || isVent(i)) continue;
      addDebris(i, rng() < .3 ? 1 : 0, 1);
      break;
    }
  }
}

// ---------- hand sweeping ----------
let hand = null; // {wx, wy} world px while sweeping
let handAcc = 0;
function stepHand(dt) {
  if (!hand) return;
  const r = uv('hand');
  const cx = hand.wx / TS, cy = hand.wy / TS;
  handAcc += HAND_RATE * dt;
  const tiles = [];
  for (let y = Math.floor(cy - r); y <= Math.floor(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.floor(cx + r); x++) {
    if (!inMap(x, y)) continue;
    const i = idx(x, y);
    if (!pileOf(i)) continue;
    const d = Math.hypot(x + .5 - cx, y + .5 - cy);
    if (d <= r + .35) tiles.push([d, i, x, y]);
  }
  if (!tiles.length) { handAcc = Math.min(handAcc, 1); return; }
  tiles.sort((a, b) => a[0] - b[0]);
  let n = 0;
  while (handAcc >= 1 && n < 200) {
    const [, i, x, y] = tiles[n % tiles.length]; n++;
    if (!pileOf(i)) { if (tiles.every(t => !pileOf(t[1]))) break; continue; }
    handAcc -= 1;
    takeFromTile(i, 1, (k, t) => { earn(VALUE[k] * t); S.stats.hand += t; puff(x + .5, y + .5, { x: cx, y: cy }, k); });
  }
}

// ---------- particles (visual only) ----------
const parts = [];
function puff(x, y, to, k) {
  if (parts.length > 260) return;
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
const TASKS = [
  { id: 'hand', text: 'Sweep 40 pieces by hand (drag with Sweep)', p: () => S.stats.hand / 40, reward: 30 },
  { id: 'bot2', text: 'Buy a second bot in the Shop', p: () => S.bots.length >= 2 ? 1 : 0, reward: 40 },
  { id: 'zoneB', text: 'Paint Zone B with the Zones tool', p: () => S.zones[1] ? 1 : 0, reward: 25 },
  { id: 'progB', text: 'Program a bot to sweep Zone B', p: () => S.bots.some(b => b.prog.some(s => s.op === 'sweep' && s.arg === 'B')) ? 1 : 0, reward: 40 },
  { id: 'bin', text: 'Build a bin near a far zone', p: () => S.buildings.some(b => b.kind === 'bin') ? 1 : 0, reward: 60 },
  { id: 'belt', text: 'Belt a bin into the Recycler', p: () => S.stats.beltDelivered > 0 ? 1 : 0, reward: 120 },
  { id: 'fetch', text: 'Program a bot to fetch from a bin', p: () => S.stats.fetched > 0 ? 1 : 0, reward: 100 },
  { id: 'cap1', text: 'Cap a junk vent', p: () => S.vents.some(v => v.capped) ? 1 : 0, reward: 300 },
  { id: 'capall', text: 'Cap all three vents', p: () => S.vents.filter(v => v.capped).length / 3, reward: 0 },
  { id: 'clean', text: 'Sweep the rock spotless', p: () => cleanFrac(), reward: 0 },
];
const cleanFrac = () => clamp(1 - S.remaining / S.initial, 0, 1);
function checkTasks() {
  for (const t of TASKS) {
    if (S.tasksDone.includes(t.id)) continue;
    if (t.p() >= 1) {
      S.tasksDone.push(t.id);
      if (t.reward) { earn(t.reward); toast('Task done  +' + t.reward); } else toast('Task done');
      if (panelMode === 'tasks') renderPanel();
    }
  }
  if (!S.won && S.remaining === 0 && S.vents.every(v => v.capped)) { S.won = true; showWin(); }
}
const curTask = () => TASKS.find(t => !S.tasksDone.includes(t.id));

// ---------- simulation ----------
function tick(dt) {
  S.time += dt;
  stepVents(dt);
  stepHand(dt);
  for (const b of S.bots) botUpdate(b, dt);
  stepBelts(dt);
}

// ---------- rendering ----------
const cv = $('world'), ctx = cv.getContext('2d');
let dpr = 1, vw = 0, vh = 0;
const cam = { x: W * TS / 2, y: H * TS / 2, z: 1 };
let terrain, ground, gctx;
const PAL = {
  space: '#151a27', reg: [186, 177, 198], crater: '#a39aaf', craterHi: '#cdc6d6', rock: '#857b92', rockHi: '#9b92a8', rockLo: '#6c6379',
  dust: ['#7b6f86', '#8e8299', '#695e74'], scrap: '#56697d', scrapHi: '#b4c7d8', crys: '#3fd8c8', crysHi: '#c2fff6',
};
function buildTerrain() {
  terrain = document.createElement('canvas');
  terrain.width = W * TS * GS; terrain.height = H * TS * GS;
  const t = terrain.getContext('2d');
  t.scale(GS, GS);
  // soft mottled base: a small tone map scaled up smoothly
  const tm = document.createElement('canvas'); tm.width = W * 2; tm.height = H * 2;
  const tc = tm.getContext('2d'), img = tc.createImageData(tm.width, tm.height);
  for (let y = 0; y < tm.height; y++) for (let x = 0; x < tm.width; x++) {
    const s = (fbm(x / 14, y / 14, S.seed + 21) - .5) * 26 + (fbm(x / 3, y / 3, S.seed + 22) - .5) * 8, o = (y * tm.width + x) * 4;
    img.data[o] = PAL.reg[0] + s; img.data[o + 1] = PAL.reg[1] + s; img.data[o + 2] = PAL.reg[2] + s * .8; img.data[o + 3] = 255;
  }
  tc.putImageData(img, 0, 0);
  t.imageSmoothingEnabled = true; t.drawImage(tm, 0, 0, W * TS, H * TS);
  // craters: flat two-tone discs (shadow rim up-left, lit rim down-right)
  const R = mulberry(S.seed + 99);
  for (let k = 0; k < 70; k++) {
    const x = R() * W * TS, y = R() * H * TS, r = 6 + Math.pow(R(), 2.2) * 70;
    t.fillStyle = PAL.craterHi; t.beginPath(); t.arc(x + r * .08, y + r * .08, r, 0, 7); t.fill();
    t.fillStyle = PAL.crater; t.beginPath(); t.arc(x - r * .04, y - r * .04, r * .94, 0, 7); t.fill();
    t.fillStyle = `rgba(${PAL.reg.join(',')},.55)`; t.beginPath(); t.arc(x + r * .1, y + r * .1, r * .8, 0, 7); t.fill();
  }
  // boulders on rock tiles
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!S.rock[idx(x, y)]) continue;
    const cx = x * TS + TS / 2, cy = y * TS + TS / 2, rr = TS * .62;
    const pts = []; for (let a = 0; a < 7; a++) { const ang = a / 7 * 6.283 + hash2(x, y, a) * .5; const rad = rr * (.78 + hash2(y, x, a) * .3); pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]); }
    t.fillStyle = PAL.rockLo; poly(t, pts.map(p => [p[0] + 3, p[1] + 4])); t.fill();
    t.fillStyle = PAL.rock; poly(t, pts); t.fill();
    t.fillStyle = PAL.rockHi; poly(t, pts.map(p => [cx + (p[0] - cx) * .55 - 3, cy + (p[1] - cy) * .55 - 4])); t.fill();
  }
  ground = document.createElement('canvas');
  ground.width = terrain.width; ground.height = terrain.height;
  gctx = ground.getContext('2d');
  gctx.drawImage(terrain, 0, 0);
  gctx.setTransform(GS, 0, 0, GS, 0, 0);
  for (let i = 0; i < N; i++) if (pileOf(i)) drawPile(i);
}
function poly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
function drawPile(i) {
  const x = i % W, y = i / W | 0, ox = x * TS, oy = y * TS, s = S.seed;
  const c = gctx;
  const mx = ox + 9 + hash2(x, y, s + 5) * (TS - 18), my = oy + 9 + hash2(y, x, s + 5) * (TS - 18);
  const nd = S.dust[i];
  if (nd > 3) { // a soft mound under bigger piles
    c.fillStyle = 'rgba(96,84,108,.35)'; c.beginPath(); c.ellipse(mx, my + 1, 6 + nd * .9, 4 + nd * .6, 0, 0, 7); c.fill();
  }
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
  for (const i of dirty) {
    const x = i % W, y = i / W | 0;
    const sx = x * TS * GS, sy = y * TS * GS, sz = TS * GS;
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.drawImage(terrain, sx, sy, sz, sz, sx, sy, sz, sz);
    gctx.setTransform(GS, 0, 0, GS, 0, 0);
    if (pileOf(i)) drawPile(i);
  }
  dirty.clear();
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  vw = innerWidth; vh = innerHeight;
  cv.width = vw * dpr; cv.height = vh * dpr;
  clampCam();
}
function minZoom() { return Math.min(vw / (W * TS), vh / (H * TS)) * .9; }
function clampCam() {
  cam.z = clamp(cam.z, minZoom(), 3);
  const hw = vw / 2 / cam.z, hh = vh / 2 / cam.z, m = 120;
  cam.x = W * TS < hw * 2 - m * 2 ? W * TS / 2 : clamp(cam.x, hw - m, W * TS - hw + m);
  cam.y = H * TS < hh * 2 - m * 2 ? H * TS / 2 : clamp(cam.y, hh - m, H * TS - hh + m);
}
const toWorld = (sx, sy) => [(sx - vw / 2) / cam.z + cam.x, (sy - vh / 2) / cam.z + cam.y];

function render(now) {
  flushDirty();
  const t = now / 1000;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = PAL.space; ctx.fillRect(0, 0, vw, vh);
  // stars
  ctx.fillStyle = 'rgba(220,225,245,.5)';
  for (let k = 0; k < 90; k++) { const x = hash2(k, 1, 7) * vw, y = hash2(k, 2, 7) * vh; ctx.fillRect(x, y, 1.2, 1.2); }
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (vw / 2 - cam.x * cam.z), dpr * (vh / 2 - cam.y * cam.z));
  // rock edge shadow + ground
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(8, 12, W * TS, H * TS);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(ground, 0, 0, ground.width, ground.height, 0, 0, W * TS, H * TS);
  const [vx0, vy0] = toWorld(0, 0), [vx1, vy1] = toWorld(vw, vh);
  const tx0 = clamp(Math.floor(vx0 / TS), 0, W - 1), ty0 = clamp(Math.floor(vy0 / TS), 0, H - 1);
  const tx1 = clamp(Math.floor(vx1 / TS), 0, W - 1), ty1 = clamp(Math.floor(vy1 / TS), 0, H - 1);
  // grid while building
  if (tool === 'belt' || tool === 'bin' || tool === 'zone' || tool === 'erase') {
    ctx.strokeStyle = 'rgba(30,34,51,.12)'; ctx.lineWidth = 1 / cam.z; ctx.beginPath();
    for (let x = tx0; x <= tx1 + 1; x++) { ctx.moveTo(x * TS, ty0 * TS); ctx.lineTo(x * TS, (ty1 + 1) * TS); }
    for (let y = ty0; y <= ty1 + 1; y++) { ctx.moveTo(tx0 * TS, y * TS); ctx.lineTo((tx1 + 1) * TS, y * TS); }
    ctx.stroke();
  }
  drawZones();
  drawBelts(tx0, ty0, tx1, ty1, t);
  drawVents(t);
  drawBuildings(t);
  drawParts();
  drawBots(t);
  drawOverlay(t);
}
function drawZones() {
  const selZone = sel && sel.type === 'zone' ? sel.z : sel && sel.type === 'bot' ? zonesOfBot(sel.id) : [];
  S.zones.forEach((z, k) => {
    if (!z) return;
    const x = z.x0 * TS, y = z.y0 * TS, w = (z.x1 - z.x0 + 1) * TS, h = (z.y1 - z.y0 + 1) * TS;
    const on = Array.isArray(selZone) ? selZone.includes(k) : selZone === k;
    ctx.fillStyle = ZC[k] + (on ? '2e' : '14'); ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = ZC[k]; ctx.lineWidth = (on ? 3 : 2) / Math.max(cam.z, .5);
    ctx.setLineDash([10, 6]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    ctx.fillStyle = ZC[k]; rr(ctx, x + 6, y + 6, 30, 30, 8); ctx.fill();
    ctx.fillStyle = '#1c2233'; ctx.font = '700 20px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ZL[k], x + 21, y + 22);
  });
}
function zonesOfBot(id) { const b = S.bots.find(o => o.id === id); return b ? b.prog.filter(s => s.op === 'sweep').map(s => ZL.indexOf(s.arg)).filter(k => k >= 0) : []; }
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); }
function drawBelts(tx0, ty0, tx1, ty1, t) {
  const sp = uv('belt');
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    const d = S.belt[idx(x, y)]; if (d < 0) continue;
    ctx.save(); ctx.translate(x * TS + TS / 2, y * TS + TS / 2); ctx.rotate(d * Math.PI / 2);
    ctx.fillStyle = '#3a4258'; ctx.fillRect(-TS / 2, -TS * .36, TS, TS * .72);
    ctx.fillStyle = '#2a3044'; ctx.fillRect(-TS / 2, -TS * .36, TS, 3); ctx.fillRect(-TS / 2, TS * .36 - 3, TS, 3);
    ctx.strokeStyle = '#ffc93c'; ctx.globalAlpha = .7; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    const off = (t * sp * TS) % (TS / 2);
    ctx.beginPath(); ctx.rect(-TS / 2, -TS / 2, TS, TS); ctx.clip();
    for (let k = -1; k < 2; k++) { const cx = -TS / 2 + off + k * TS / 2 + 4; ctx.beginPath(); ctx.moveTo(cx - 3, -6); ctx.lineTo(cx + 3, 0); ctx.lineTo(cx - 3, 6); ctx.stroke(); }
    ctx.restore();
  }
  for (const it of S.items) {
    const d = S.belt[it.i]; if (d < 0) continue;
    const x = (it.i % W + .5 + DIRS[d][0] * (it.t - .5)) * TS, y = ((it.i / W | 0) + .5 + DIRS[d][1] * (it.t - .5)) * TS;
    piece(x, y, it.k, 1.2);
  }
}
function piece(x, y, k, s) {
  if (k === 0) { ctx.fillStyle = PAL.dust[0]; ctx.beginPath(); ctx.arc(x, y, 3.2 * s, 0, 7); ctx.fill(); }
  else if (k === 1) { ctx.fillStyle = PAL.scrap; ctx.fillRect(x - 4 * s, y - 2.5 * s, 8 * s, 5 * s); ctx.fillStyle = PAL.scrapHi; ctx.fillRect(x - 4 * s, y - 2.5 * s, 8 * s, 1.5 * s); }
  else { ctx.fillStyle = PAL.crys; poly(ctx, [[x, y - 5 * s], [x + 3 * s, y], [x, y + 4 * s], [x - 3 * s, y]]); ctx.fill(); }
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
function drawBuildings(t) {
  for (const b of S.buildings) {
    const x = b.x * TS, y = b.y * TS, w = b.w * TS, h = b.h * TS;
    const on = sel && sel.type === 'building' && sel.id === b.id;
    if (b.kind === 'recycler') {
      ctx.fillStyle = 'rgba(20,24,38,.35)'; rr(ctx, x + 2, y + 6, w, h, 10); ctx.fill();
      ctx.fillStyle = '#ffc93c'; rr(ctx, x, y, w, h, 10); ctx.fill();
      ctx.save(); rr(ctx, x, y, w, h, 10); ctx.clip();
      ctx.fillStyle = '#2a2105'; for (let k = -4; k < 10; k++) { ctx.beginPath(); ctx.moveTo(x + k * 12, y); ctx.lineTo(x + k * 12 + 6, y); ctx.lineTo(x + k * 12 + 6 - h, y + h); ctx.lineTo(x + k * 12 - h, y + h); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#263044'; rr(ctx, x + 6, y + 6, w - 12, h - 12, 7); ctx.fill();
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(t * 2);
      ctx.fillStyle = '#3e4a64'; ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ctx.fill();
      ctx.fillStyle = '#7fe0a8'; for (let k = 0; k < 3; k++) { ctx.rotate(2.094); ctx.beginPath(); ctx.ellipse(8, 0, 8, 3.2, 0, 0, 7); ctx.fill(); }
      ctx.restore();
    } else if (b.kind === 'bin') {
      ctx.fillStyle = 'rgba(20,24,38,.35)'; rr(ctx, x + 3, y + 6, w - 4, h - 4, 6); ctx.fill();
      ctx.fillStyle = '#4a5674'; rr(ctx, x + 2, y + 2, w - 4, h - 4, 6); ctx.fill();
      ctx.fillStyle = '#2a3044'; rr(ctx, x + 6, y + 6, w - 12, h - 12, 3); ctx.fill();
      const f = binTotal(b) / BIN_CAP;
      ctx.fillStyle = f >= 1 ? '#ff8a7a' : '#ffc93c'; ctx.fillRect(x + 6, y + h - 6 - (h - 12) * f, w - 12, (h - 12) * f);
    } else if (b.kind === 'cap') {
      const cx = x + w / 2, cy = y + h / 2;
      ctx.fillStyle = '#5a4f66'; ctx.beginPath(); ctx.ellipse(cx, cy + 2, 17, 13, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#3a4258'; poly(ctx, [0, 1, 2, 3, 4, 5].map(k => [cx + Math.cos(k * 1.047) * 14, cy + Math.sin(k * 1.047) * 14])); ctx.fill();
      ctx.fillStyle = '#7fe0a8'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
    }
    if (on) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5 / cam.z; rr(ctx, x - 3, y - 3, w + 6, h + 6, 9); ctx.stroke(); }
    if (cam.z > .55 && b.kind !== 'cap') {
      ctx.font = '600 11px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#1c2233'; ctx.fillText(b.label, x + w / 2, y + h + 3);
    }
  }
}
function drawParts() {
  for (const p of parts) piece(p.x * TS, p.y * TS, p.k, .8);
}
function drawBots(t) {
  for (const b of S.bots) {
    const x = b.x * TS, y = b.y * TS, on = sel && sel.type === 'bot' && sel.id === b.id;
    const bob = Math.sin(t * 4 + b.id) * 1.5;
    if (on) {
      const st = b.prog[b.pc];
      let tx = null, ty = null;
      if (b.tgt >= 0) { tx = (b.tgt % W + .5) * TS; ty = ((b.tgt / W | 0) + .5) * TS; }
      else if (st && (st.op === 'unload' || st.op === 'fetch')) { const d = st.op === 'unload' ? dropTarget(b, st.arg) : byId.get(+String(st.arg).slice(4)); if (d) { const [px, py] = nearestPoint(d, b.x, b.y); tx = px * TS; ty = py * TS; } }
      if (tx !== null) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5 / cam.z; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]); }
    }
    ctx.fillStyle = 'rgba(20,24,38,.28)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 12, 14, 7, 0, 0, 7); ctx.fill();
    const yy = y + bob - 6;
    // rotor arms
    ctx.strokeStyle = '#2a3044'; ctx.lineWidth = 3;
    for (let k = 0; k < 4; k++) { const a = k * 1.571 + .785; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + Math.cos(a) * 17, yy + Math.sin(a) * 17); ctx.stroke(); }
    for (let k = 0; k < 4; k++) { const a = k * 1.571 + .785, rx = x + Math.cos(a) * 17, ry = yy + Math.sin(a) * 17;
      ctx.fillStyle = 'rgba(238,240,246,.35)'; ctx.beginPath(); ctx.ellipse(rx, ry, 7, 2.2, t * 30 + k, 0, 7); ctx.fill(); }
    ctx.fillStyle = `hsl(${b.hue} 55% 32%)`; ctx.beginPath(); ctx.arc(x, yy + 2, 13, 0, 7); ctx.fill();
    ctx.fillStyle = `hsl(${b.hue} 70% 62%)`; ctx.beginPath(); ctx.arc(x, yy, 13, 0, 7); ctx.fill();
    // cargo ring
    const f = cargoN(b) / uv('cargo');
    ctx.strokeStyle = '#1c2233'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(x, yy, 7.5, 0, 7); ctx.stroke();
    if (f > 0) { ctx.strokeStyle = '#ffc93c'; ctx.beginPath(); ctx.arc(x, yy, 7.5, -1.57, -1.57 + f * 6.283); ctx.stroke(); }
    // nose
    ctx.fillStyle = '#eef0f6'; ctx.beginPath(); ctx.arc(x + Math.cos(b.ang) * 10, yy + Math.sin(b.ang) * 10, 2.6, 0, 7); ctx.fill();
    if (on) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 / cam.z; ctx.beginPath(); ctx.arc(x, yy, 22, 0, 7); ctx.stroke(); }
    if (b.idle > 0 || b.status.startsWith('Zone') || b.status === 'No program') {
      ctx.fillStyle = '#1c2233'; ctx.font = '700 12px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(b.idle > 0 ? 'zz' : '?', x + 14, yy - 14);
    }
  }
}
let hover = null; // world px of mouse / finger
let zoneDrag = null;
function drawOverlay(t) {
  if (tool === 'hand' && hover) {
    const r = uv('hand') * TS;
    ctx.strokeStyle = hand ? '#ffc93c' : 'rgba(28,34,51,.6)'; ctx.lineWidth = 2 / cam.z;
    ctx.beginPath(); ctx.arc(hover[0], hover[1], r, 0, 7); ctx.stroke();
    if (hand) { ctx.fillStyle = 'rgba(255,201,60,.12)'; ctx.fill(); }
  }
  if ((tool === 'bin' || tool === 'belt' || tool === 'erase' || tool === 'cap') && hover) {
    const x = Math.floor(hover[0] / TS), y = Math.floor(hover[1] / TS);
    if (inMap(x, y)) { ctx.strokeStyle = tool === 'erase' ? '#ff8a7a' : '#1c2233'; ctx.lineWidth = 2 / cam.z; ctx.strokeRect(x * TS + 1, y * TS + 1, TS - 2, TS - 2); }
  }
  if (zoneDrag) {
    const k = zoneDrag.k, x0 = Math.min(zoneDrag.a[0], zoneDrag.b[0]), y0 = Math.min(zoneDrag.a[1], zoneDrag.b[1]);
    const x1 = Math.max(zoneDrag.a[0], zoneDrag.b[0]), y1 = Math.max(zoneDrag.a[1], zoneDrag.b[1]);
    ctx.fillStyle = ZC[k] + '30'; ctx.fillRect(x0 * TS, y0 * TS, (x1 - x0 + 1) * TS, (y1 - y0 + 1) * TS);
    ctx.strokeStyle = ZC[k]; ctx.lineWidth = 2.5 / cam.z; ctx.strokeRect(x0 * TS, y0 * TS, (x1 - x0 + 1) * TS, (y1 - y0 + 1) * TS);
  }
}

// ---------- input ----------
let tool = 'hand';
const pointers = new Map();
let pinch = null, act = null;
function setTool(t) {
  tool = t;
  document.querySelectorAll('#toolbar button').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  const H = {
    hand: 'Drag to vacuum junk. Two fingers pan and zoom.',
    select: 'Tap a bot, bin or zone to inspect it. Drag to pan.',
    zone: 'Drag a rectangle to paint the next zone. Bots sweep zones you assign.',
    bin: 'Tap open ground to place a bin (60).',
    belt: 'Drag to lay belts in the direction you move. Tap a belt to turn it.',
    cap: 'Tap an open vent to cap it for good (1,500).',
    erase: 'Tap or drag over belts and bins to remove them.',
  };
  $('hint').textContent = H[t];
  if (t === 'zone' && !panelMode) select({ type: 'zones' });
}
document.querySelectorAll('#toolbar button').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

function tileAt(sx, sy) { const [wx, wy] = toWorld(sx, sy); return [Math.floor(wx / TS), Math.floor(wy / TS)]; }
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { cancelAct(); const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, z: cam.z }; return; }
  if (pointers.size > 2 || pinch) return;
  const pan = e.button === 1 || e.button === 2 || tool === 'select';
  act = { id: e.pointerId, kind: pan ? 'pan' : tool, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, last: -1 };
  hover = toWorld(e.clientX, e.clientY);
  startAct(e);
});
cv.addEventListener('pointermove', e => {
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
  const [wx, wy] = toWorld(e.clientX, e.clientY);
  cam.z = clamp(cam.z * Math.exp(-e.deltaY * .0015), minZoom(), 3);
  cam.x = wx - (e.clientX - vw / 2) / cam.z; cam.y = wy - (e.clientY - vh / 2) / cam.z; clampCam();
}, { passive: false });

function cancelAct() { hand = null; zoneDrag = null; act = null; }
function startAct(e) {
  const [x, y] = tileAt(e.clientX, e.clientY);
  if (act.kind === 'hand') { hand = { wx: hover[0], wy: hover[1] }; }
  else if (act.kind === 'zone') {
    const k = S.zones.findIndex(z => !z);
    if (k < 0) { toast('All six zones are painted. Delete one first.'); select({ type: 'zones' }); act.kind = 'pan'; return; }
    zoneDrag = { k, a: [clamp(x, 0, W - 1), clamp(y, 0, H - 1)], b: [clamp(x, 0, W - 1), clamp(y, 0, H - 1)] };
  } else if (act.kind === 'belt') { act.last = inMap(x, y) ? idx(x, y) : -1; act.startOnBelt = act.last >= 0 && S.belt[act.last] >= 0; }
  else if (act.kind === 'erase') { if (inMap(x, y)) { removeAt(x, y); act.last = idx(x, y); } }
}
function moveAct(e) {
  if (act.kind === 'pan') { cam.x -= (e.clientX - act.lx) / cam.z; cam.y -= (e.clientY - act.ly) / cam.z; clampCam(); return; }
  const [x, y] = tileAt(e.clientX, e.clientY);
  if (act.kind === 'hand') { hand = { wx: hover[0], wy: hover[1] }; }
  else if (act.kind === 'zone' && zoneDrag) zoneDrag.b = [clamp(x, 0, W - 1), clamp(y, 0, H - 1)];
  else if (act.kind === 'erase') { if (inMap(x, y) && idx(x, y) !== act.last) { removeAt(x, y); act.last = idx(x, y); } }
  else if (act.kind === 'belt') {
    if (!inMap(x, y)) return;
    let j = idx(x, y);
    if (j === act.last) return;
    if (act.last < 0) { act.last = j; return; }
    // walk from the last tile to this one, one step at a time
    let lx = act.last % W, ly = act.last / W | 0, guard = 0;
    while ((lx !== x || ly !== y) && guard++ < 200) {
      const dx = x - lx, dy = y - ly;
      const d = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
      const pi = idx(lx, ly);
      if (S.belt[pi] >= 0) S.belt[pi] = d;
      else if (freeTile(pi) && !S.bmap[pi]) placeBelt(pi, d);
      lx += DIRS[d][0]; ly += DIRS[d][1];
      const ni = idx(lx, ly);
      if (freeTile(ni)) placeBelt(ni, d);
      S.lastBeltDir = d;
    }
    act.last = j;
  }
}
function endAct(e) {
  const [x, y] = tileAt(e.clientX, e.clientY);
  if (act.kind === 'hand') hand = null;
  else if (act.kind === 'pan') { if (!act.moved && e.button !== 2) tapSelect(e); }
  else if (act.kind === 'zone' && zoneDrag) {
    const z = zoneDrag; zoneDrag = null;
    if (!act.moved) { // tap: select the zone under the finger instead
      const k = S.zones.findIndex(r => r && x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
      if (k >= 0) select({ type: 'zone', z: k });
      return;
    }
    S.zones[z.k] = { x0: Math.min(z.a[0], z.b[0]), y0: Math.min(z.a[1], z.b[1]), x1: Math.max(z.a[0], z.b[0]), y1: Math.max(z.a[1], z.b[1]) };
    select({ type: 'zone', z: z.k });
    toast('Zone ' + ZL[z.k] + ' painted');
  } else if (act.kind === 'bin') { if (!act.moved && inMap(x, y)) placeBin(x, y); }
  else if (act.kind === 'cap') { if (!act.moved) capVent(x, y); }
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
  let best = null, bd = (22 / cam.z + 10);
  for (const b of S.bots) { const d = Math.hypot(b.x * TS - wx, b.y * TS - wy); if (d < bd) { bd = d; best = b; } }
  if (best) return select({ type: 'bot', id: best.id });
  const x = Math.floor(wx / TS), y = Math.floor(wy / TS);
  if (inMap(x, y)) {
    const id = S.bmap[idx(x, y)];
    if (id) return select({ type: 'building', id });
    const k = S.zones.findIndex(r => r && x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
    if (k >= 0) return select({ type: 'zone', z: k });
  }
  select(null);
}

// ---------- panels ----------
let sel = null, panelMode = null;
const panel = $('panel'), pbody = $('panelBody');
function select(s) { sel = s; panelMode = s ? s.type : null; renderPanel(); }
$('panelClose').addEventListener('click', () => select(null));
$('shopBtn').addEventListener('click', () => select(panelMode === 'shop' ? null : { type: 'shop' }));
$('taskChip').addEventListener('click', () => select(panelMode === 'tasks' ? null : { type: 'tasks' }));
$('menuBtn').addEventListener('click', () => select(panelMode === 'menu' ? null : { type: 'menu' }));
$('speedBtn').addEventListener('click', () => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1; $('speedBtn').textContent = S.speed + '×'; });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderPanel() {
  if (!sel) { panel.hidden = true; return; }
  panel.hidden = false;
  let title = '', html = '';
  if (sel.type === 'bot') {
    const b = S.bots.find(o => o.id === sel.id); if (!b) return select(null);
    title = b.name;
    html = `<div class="status" data-live="status"></div>
      <div class="kv"><span>Cargo</span><span data-live="cargo"></span></div>
      <h3>Program</h3><p>Runs top to bottom, then loops. A sweep step ends when the bot is full or its zone is clean.</p>
      <ol class="prog">${b.prog.map((s, k) => stepRow(b, s, k)).join('')}</ol>
      <div class="row"><button class="btn" data-act="add" ${b.prog.length >= 8 ? 'disabled' : ''}>Add step</button><button class="btn" data-act="copyall">Copy to all bots</button></div>`;
  } else if (sel.type === 'building') {
    const b = byId.get(sel.id); if (!b) return select(null);
    title = b.label;
    if (b.kind === 'recycler') html = `<p>Turns junk into credits: dust 1, scrap 2, crystal 5. Bots unload here, and belts pointing into it feed it.</p>
      <div class="kv"><span>Pieces recycled</span><span data-live="recycled"></span></div><div class="kv"><span>From belts</span><span data-live="beltd"></span></div>`;
    else if (b.kind === 'bin') html = `<p>Holds ${BIN_CAP} pieces. Bots can unload here or fetch from here. Any belt next to it that points away from it gets fed automatically.</p>
      <div class="kv"><span>Stored</span><span data-live="binstore"></span></div>
      <div class="row"><button class="btn danger" data-act="delbin">Remove bin (refund ${COST.bin / 2})</button></div>`;
    else html = `<p>This vent is sealed. No more junk will come out of it.</p>`;
  } else if (sel.type === 'zone') {
    const z = S.zones[sel.z]; if (!z) return select({ type: 'zones' });
    title = 'Zone ' + ZL[sel.z];
    const users = S.bots.filter(b => b.prog.some(s => s.op === 'sweep' && s.arg === ZL[sel.z])).map(b => b.name);
    html = `<div class="kv"><span>Size</span><span>${z.x1 - z.x0 + 1} × ${z.y1 - z.y0 + 1} tiles</span></div>
      <div class="kv"><span>Junk left</span><span data-live="zonejunk"></span></div>
      <p>${users.length ? 'Swept by ' + esc(users.join(', ')) : 'No bot sweeps this zone yet. Select a bot and add a step.'}</p>
      <div class="row"><button class="btn" data-act="assign">Assign a new bot here</button><button class="btn danger" data-act="delzone">Delete zone</button></div>`;
  } else if (sel.type === 'zones') {
    title = 'Zones';
    html = `<p>Drag on the ground to paint the next zone. Bots only sweep where their program tells them.</p>
      <ul class="tasks">${S.zones.map((z, k) => `<li><span class="tick" style="background:${z ? ZC[k] : 'transparent'};border-color:${ZC[k]}"></span><span class="t">Zone ${ZL[k]} ${z ? '' : '(not painted)'}</span>${z ? `<button class="btn" data-act="pickzone" data-k="${k}">Open</button>` : '<span></span>'}</li>`).join('')}</ul>`;
  } else if (sel.type === 'shop') {
    title = 'Shop';
    html = `<div class="shop-item"><b>Cleaning bot</b><p>Flies over rocks, runs the program you give it.</p><p data-live="botcount"></p><button class="btn primary" data-act="buybot" data-cost="bot"></button></div>
      <h3>Upgrades (all bots)</h3>
      ${Object.keys(UPG).map(k => { const u = UPG[k], lv = S.upg[k], max = lv >= u.costs.length;
        return `<div class="shop-item"><b>${u.name}</b><p>${u.desc}: ${u.vals[lv]}${max ? '' : ' → ' + u.vals[lv + 1]}</p>
        <span class="pips">${u.vals.map((_, i) => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</span>
        <button class="btn primary" data-act="upg" data-k="${k}" ${max ? 'disabled' : ''} data-cost="${max ? '' : u.costs[lv]}">${max ? 'Maxed' : u.costs[lv]}</button></div>`; }).join('')}`;
  } else if (sel.type === 'tasks') {
    title = 'Tasks';
    const cur = curTask();
    html = `<ul class="tasks">${TASKS.map(t => `<li class="${S.tasksDone.includes(t.id) ? 'done' : ''} ${cur === t ? 'cur' : ''}"><span class="tick"></span><span class="t">${t.text}</span><span class="r">${t.reward ? '+' + t.reward : ''}</span></li>`).join('')}</ul>`;
  } else if (sel.type === 'menu') {
    title = 'Menu';
    html = `<h3>How it works</h3>
      <p>Junk covers the rock and three vents keep spitting more. Sweep by hand to earn your first credits, then let bots do the work.</p>
      <p>Paint zones, then give each bot a program: sweep a zone, unload at a bin or the Recycler, fetch from a bin. Belts carry a bin's load home on their own.</p>
      <p>Cap all three vents and sweep every piece to win.</p>
      <h3>Controls</h3>
      <p>Two fingers pan and pinch to zoom. With a mouse, scroll to zoom and right-drag to pan.</p>
      <div class="kv"><span>Time played</span><span data-live="time"></span></div>
      <div class="row"><button class="btn danger" data-act="reset">New rock</button></div>
      <div id="confirmReset" hidden><p>Start over on a fresh rock? This game is lost.</p><div class="row"><button class="btn" data-act="noreset">Keep playing</button><button class="btn primary" data-act="yesreset">Start over</button></div></div>`;
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
  const bins = S.buildings.filter(b => b.kind === 'bin').map(b => ['bin:' + b.id, b.label]);
  if (s.op === 'sweep') {
    const o = [['any', 'Anywhere']];
    S.zones.forEach((z, k) => { if (z || s.arg === ZL[k]) o.push([ZL[k], 'Zone ' + ZL[k] + (z ? '' : ' (gone)')]); });
    return o;
  }
  if (s.op === 'unload') return [['nearest', 'Nearest drop-off'], ['recycler', 'Recycler'], ...bins];
  if (s.op === 'fetch') return bins.length ? bins : [['none', 'No bins yet']];
  return [[2, '2 s'], [5, '5 s'], [10, '10 s'], [30, '30 s']];
}
const defaultArg = op => op === 'sweep' ? (S.zones[0] ? 'A' : 'any') : op === 'unload' ? 'nearest' : op === 'fetch' ? (argOptions({ op })[0][0]) : 5;

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
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, k = +el.dataset.k;
  const bot = sel && sel.type === 'bot' ? S.bots.find(o => o.id === sel.id) : null;
  const reset = () => { if (bot) { bot.pc = 0; release(bot); bot.idle = 0; bot.timer = 0; } };
  if (a === 'add' && bot) { bot.prog.push({ op: 'unload', arg: 'nearest' }); reset(); }
  else if (a === 'del' && bot) { bot.prog.splice(k, 1); reset(); }
  else if (a === 'up' && bot) { [bot.prog[k - 1], bot.prog[k]] = [bot.prog[k], bot.prog[k - 1]]; reset(); }
  else if (a === 'down' && bot) { [bot.prog[k + 1], bot.prog[k]] = [bot.prog[k], bot.prog[k + 1]]; reset(); }
  else if (a === 'copyall' && bot) { for (const o of S.bots) if (o !== bot) { o.prog = bot.prog.map(s => ({ ...s })); o.pc = 0; release(o); o.idle = 0; } toast('Program copied to every bot'); }
  else if (a === 'delbin') { const b = byId.get(sel.id); if (b) removeAt(b.x, b.y); return; }
  else if (a === 'delzone') { S.zones[sel.z] = null; select({ type: 'zones' }); return; }
  else if (a === 'pickzone') { select({ type: 'zone', z: k }); return; }
  else if (a === 'assign') {
    if (S.credits < botCost()) return toast('A bot costs ' + botCost() + ' credits');
    const L = ZL[sel.z]; buyBot(); const nb = S.bots[S.bots.length - 1]; nb.prog = [{ op: 'sweep', arg: L }, { op: 'unload', arg: 'nearest' }];
    select({ type: 'bot', id: nb.id }); return;
  }
  else if (a === 'buybot') { if (S.credits < botCost()) return; buyBot(); }
  else if (a === 'upg') { const u = UPG[el.dataset.k], lv = S.upg[el.dataset.k]; if (lv < u.costs.length && S.credits >= u.costs[lv]) { S.credits -= u.costs[lv]; S.upg[el.dataset.k]++; toast(u.name + ' upgraded'); } }
  else if (a === 'reset') { $('confirmReset').hidden = false; return; }
  else if (a === 'noreset') { $('confirmReset').hidden = true; return; }
  else if (a === 'yesreset') { startNew(); return; }
  renderPanel();
});
function buyBot() {
  const c = botCost(); if (S.credits < c) return;
  S.credits -= c;
  const r = recycler();
  const b = newBot(r.x + 1, r.y + 1);
  b.prog = [{ op: 'sweep', arg: S.zones[0] ? 'A' : 'any' }, { op: 'unload', arg: 'nearest' }];
  toast(b.name + ' is online');
  hintOnce('bot', 'Tap a bot with Select to change its program');
}
const fmtTime = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return (h ? h + 'h ' : '') + m + 'm ' + (s % 60) + 's'; };
function live() {
  if (!sel) return;
  const q = n => pbody.querySelector(`[data-live="${n}"]`);
  const set = (n, v) => { const e = q(n); if (e && e.textContent !== v) e.textContent = v; };
  if (sel.type === 'bot') {
    const b = S.bots.find(o => o.id === sel.id); if (!b) return;
    set('status', b.status); set('cargo', cargoN(b) + ' / ' + uv('cargo'));
    pbody.querySelectorAll('.prog li').forEach(li => li.classList.toggle('now', +li.dataset.k === b.pc && b.idle <= 0));
  } else if (sel.type === 'building') {
    const b = byId.get(sel.id); if (!b) return;
    set('recycled', S.stats.recycled.toLocaleString()); set('beltd', S.stats.beltDelivered.toLocaleString());
    if (b.kind === 'bin') set('binstore', binTotal(b) + ' / ' + BIN_CAP);
  } else if (sel.type === 'zone') {
    const z = S.zones[sel.z]; if (!z) return;
    let n = 0; for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) n += pileOf(idx(x, y));
    set('zonejunk', n.toLocaleString() + ' pieces');
  } else if (sel.type === 'shop') {
    set('botcount', 'You have ' + S.bots.length);
    pbody.querySelectorAll('[data-cost]').forEach(btn => {
      const c = btn.dataset.cost === 'bot' ? botCost() : +btn.dataset.cost;
      if (btn.dataset.cost === 'bot') btn.textContent = c;
      if (btn.dataset.cost !== '') btn.disabled = S.credits < c;
    });
  } else if (sel.type === 'menu') set('time', fmtTime(S.time));
}

// ---------- HUD ----------
function hud() {
  $('credits').textContent = Math.floor(S.credits).toLocaleString();
  while (incomeLog.length && incomeLog[0][0] < S.time - 60) incomeLog.shift();
  const span = Math.min(60, Math.max(10, S.time - (incomeLog.length ? incomeLog[0][0] : S.time)));
  const sum = incomeLog.reduce((a, b) => a + b[1], 0);
  $('rate').textContent = '+' + Math.round(sum * 60 / span) + '/min';
  const c = cleanFrac();
  $('cleanPct').textContent = (c >= .999 && S.remaining > 0 ? 99.9 : Math.floor(c * 1000) / 10).toFixed(1) + '%';
  $('cleanBar').style.width = (c * 100) + '%';
  $('ventCount').textContent = S.vents.filter(v => v.capped).length + '/3';
  const t = curTask();
  $('taskText').textContent = t ? t.text : 'All tasks done';
  $('taskBar').style.width = (t ? clamp(t.p(), 0, 1) * 100 : 100) + '%';
  document.querySelectorAll('#toolbar button[data-tool]').forEach(b => { const c = COST[b.dataset.tool]; if (c) b.classList.toggle('poor', S.credits < c); });
}

// ---------- messages ----------
let toastT = 0;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }
function hintOnce(key, msg) { if (S.hintsSeen[key]) return; S.hintsSeen[key] = 1; setTimeout(() => toast(msg), 1900); }
function showWin() {
  const m = $('modal');
  $('modalCard').innerHTML = `<h2>Spotless</h2><p>Every vent capped and every piece swept in ${fmtTime(S.time)} with ${S.bots.length} bots. ${S.stats.recycled.toLocaleString()} pieces recycled.</p>
    <div class="row"><button class="btn" id="winKeep">Admire it</button><button class="btn primary" id="winNew">New rock</button></div>`;
  m.hidden = false;
  $('winKeep').onclick = () => { m.hidden = true; };
  $('winNew').onclick = () => { m.hidden = true; startNew(); };
}

// ---------- boot ----------
function startNew() {
  S = generate((Math.random() * 1e9) | 0);
  boot();
  select(null);
  toast('Drag across the junk to start sweeping');
}
function boot() {
  rebuildIndex();
  reserved.clear(); parts.length = 0; incomeLog.length = 0;
  rng = mulberry(S.seed ^ 0x5bd1e995);
  if (!S.bots.length) newBot(recycler().x + 1, recycler().y + 1);
  for (const b of S.bots) b.tgt = -1;
  buildTerrain();
  cam.x = (recycler().x + 1) * TS; cam.y = (recycler().y + 1) * TS; cam.z = 1;
  resize();
  $('speedBtn').textContent = S.speed + '×';
}
const saved = load();
if (saved) { S = saved; boot(); } else startNew();
setTool('hand');
addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);
setInterval(save, 10000);
setInterval(() => { hud(); live(); checkTasks(); }, 250);
hud();

let last = performance.now();
function frame(now) {
  let dt = Math.min(.1, (now - last) / 1000); last = now;
  if ($('modal').hidden) {
    const steps = S.speed, h = dt; // run each frame's time S.speed times, in steps of at most 1/30 s
    for (let s = 0; s < steps; s++) { let rem = h; while (rem > 0) { const d = Math.min(rem, 1 / 30); tick(d); rem -= d; } }
    stepParts(dt);
  }
  render(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.__dw = { get S() { return S; }, tick, save, UPG, botCost, newBot, COST };
})();
