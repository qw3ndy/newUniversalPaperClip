import { BELT_SPACING, BUFFER_SECONDS, BUILDINGS, DX, DY, EMIT_INTERVAL, opp } from './constants';
import { beltSpeed, feederRate, machineRate, powerUse, solarOutput } from './rules';
import type { BeltItem, Dir, Entity, ItemKind } from './types';
import type { World } from './world';

const INPUT_OF: Partial<Record<Entity['type'], ItemKind>> = {
  clipper: 'wire',
  megaclipper: 'wire',
  clipfactory: 'wire',
  wiremill: 'matter',
};

export function bufferCap(rate: number): number {
  return Math.max(10, rate * BUFFER_SECONDS);
}

/** Le Siège (ou un entrepôt) reçoit des trombones. */
export function deliverClips(w: World, qty: number): void {
  w.s.clips += qty;
  w.s.unsold += qty;
  w.acc.clips += qty;
  w.acc.hqGain += qty;
}

/**
 * Tente de faire entrer `item` dans `target` par son côté `side`
 * (direction absolue allant de la cible vers la source).
 */
export function tryAccept(w: World, target: Entity, item: BeltItem, side: Dir): boolean {
  switch (target.type) {
    case 'belt': {
      if (side === target.dir) return false;
      const entry = side === opp(target.dir) || side === target.curve ? 0 : 0.5;
      const items = target.items;
      for (const it of items) {
        if (Math.abs(it.pos - entry) >= BELT_SPACING) continue;
        // Insertion latérale sur un tapis chargé : le lot voisin du même type grossit
        // (plafonné) plutôt que d'affamer les machines en aval.
        if (entry > 0 && it.kind === item.kind && it.qty + item.qty <= Math.max(64, 8 * item.qty)) {
          it.qty += item.qty;
          return true;
        }
        return false;
      }
      item.pos = entry;
      // Les objets restent triés du plus avancé au moins avancé.
      let i = 0;
      while (i < items.length && items[i].pos > entry) i++;
      items.splice(i, 0, item);
      return true;
    }
    case 'splitter':
      if (target.items.length > 0) return false;
      item.from = side;
      target.items.push(item);
      return true;
    case 'hq':
    case 'depot':
      if (item.kind === 'clip') deliverClips(w, item.qty);
      else if (item.kind === 'wire') w.s.wire += item.qty;
      else return false;
      target.pulse = w.s.time;
      return true;
    default: {
      const need = INPUT_OF[target.type];
      if (!need || need !== item.kind || side === target.dir) return false;
      if (target.inBuf >= bufferCap(machineRate(w.s, target))) return false;
      target.inBuf += item.qty;
      return true;
    }
  }
}

function pushOut(w: World, e: Entity): boolean {
  if (!e.out) return true;
  const tiles = w.outputTiles(e);
  const side = opp(e.dir);
  for (let k = 0; k < tiles.length; k++) {
    const idx = (e.rr + k) % tiles.length;
    const [tx, ty] = tiles[idx];
    const t = w.at(tx, ty);
    if (t && t !== e && tryAccept(w, t, e.out, side)) {
      e.out = null;
      e.rr = idx + 1;
      return true;
    }
  }
  return false;
}

function emit(w: World, e: Entity, kind: ItemKind, dt: number): void {
  e.timer -= dt;
  if (!e.out && e.timer <= 0 && e.outBuf >= 1) {
    const q = Math.floor(e.outBuf);
    e.outBuf -= q;
    e.out = { kind, qty: q, pos: 0 };
    e.timer = EMIT_INTERVAL;
  }
  pushOut(w, e);
}

function stepBelt(w: World, e: Entity, dt: number, speed: number): void {
  const items = e.items;
  if (items.length === 0) return;
  const step = speed * dt;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    let np = it.pos + step;
    if (i === 0) {
      if (np >= 1) {
        const t = w.at(e.x + DX[e.dir], e.y + DY[e.dir]);
        if (t && t !== e && tryAccept(w, t, it, opp(e.dir))) {
          items.shift();
          i--;
          continue;
        }
        np = 1;
      }
    } else {
      const lim = items[i - 1].pos - BELT_SPACING;
      if (np > lim) np = Math.max(it.pos, lim);
    }
    it.pos = np;
  }
}

/** Le répartiteur renvoie chaque objet vers un des trois autres côtés, à tour de rôle. */
function stepSplitter(w: World, e: Entity): void {
  if (e.items.length === 0) {
    e.status = 'idle';
    return;
  }
  const item = e.items[0];
  for (let k = 0; k < 4; k++) {
    const d = ((e.rr + k) % 4) as Dir;
    if (d === item.from) continue;
    const t = w.at(e.x + DX[d], e.y + DY[d]);
    if (t && t !== e && tryAccept(w, t, item, opp(d))) {
      e.items.shift();
      e.rr = (d + 1) % 4;
      e.status = 'ok';
      return;
    }
  }
  e.status = 'blocked';
}

function stepFeeder(w: World, e: Entity, dt: number): void {
  const s = w.s;
  e.timer -= dt;
  if (!e.out && e.timer <= 0) {
    if (s.wire >= 1) {
      const q = Math.min(Math.floor(feederRate(s) * EMIT_INTERVAL), Math.floor(s.wire));
      s.wire -= q;
      e.out = { kind: 'wire', qty: q, pos: 0 };
      e.timer = EMIT_INTERVAL;
      e.pulse = s.time;
    } else {
      e.status = 'noWire';
      return;
    }
  }
  // Une ligne pleine est l'état normal d'un distributeur bien dimensionné.
  e.status = pushOut(w, e) ? 'ok' : 'full';
}

function stepConverter(w: World, e: Entity, dt: number, outKind: ItemKind): void {
  const s = w.s;
  const nominal = machineRate(s, e);
  const powered = BUILDINGS[e.type].power > 0;
  const rate = powered ? nominal * w.powerEff : nominal;
  const cap = bufferCap(nominal);
  if (powered && w.powerEff < 0.01) {
    e.status = 'noPower';
  } else if (e.outBuf < cap) {
    const p = Math.min(e.inBuf, rate * dt, cap - e.outBuf);
    if (p > 0) {
      e.inBuf -= p;
      if (e.inBuf < 1e-9) e.inBuf = 0;
      e.outBuf += p;
      e.status = 'ok';
      e.pulse = s.time;
    } else e.status = e.inBuf <= 0 ? 'noInput' : 'blocked';
  } else e.status = 'blocked';
  emit(w, e, outKind, dt);
}

function stepMine(w: World, e: Entity, dt: number): void {
  const s = w.s;
  const nominal = machineRate(s, e);
  const cap = bufferCap(nominal);
  if (s.earthMatter <= 0) e.status = 'noDeposit';
  else if (w.powerEff < 0.01) e.status = 'noPower';
  else if (e.outBuf < cap) {
    const p = Math.min(nominal * w.powerEff * dt, s.earthMatter, cap - e.outBuf);
    s.earthMatter -= p;
    if (s.earthMatter < 1) s.earthMatter = 0;
    e.outBuf += p;
    w.acc.matter += p;
    e.status = 'ok';
    e.pulse = s.time;
  } else e.status = 'blocked';
  emit(w, e, 'matter', dt);
}

/** Bilan énergétique et bonus des centres de calcul. */
export function updatePower(w: World): void {
  const s = w.s;
  let prod = 0;
  let use = 0;
  let computes = 0;
  for (const e of s.entities) {
    if (e.type === 'solar') prod += solarOutput(s);
    else if (BUILDINGS[e.type].power > 0) {
      use += powerUse(s, e.type);
      if (e.type === 'compute') computes++;
    }
  }
  s.powerProd = prod;
  s.powerUse = use;
  w.powerEff = use <= 0 ? 1 : Math.min(1, prod / use);
  const live = Math.floor(computes * w.powerEff + 1e-9);
  s.bonusProcessors = live * 2;
  s.bonusMemory = live * 4;
  for (const e of s.entities) {
    if (e.type === 'compute') e.status = w.powerEff >= 0.999 ? 'ok' : 'noPower';
    else if (e.type === 'solar') e.status = 'ok';
  }
}

export function stepFactory(w: World, dt: number): void {
  const s = w.s;
  if (s.phase > 1) updatePower(w);
  const speed = beltSpeed(s);
  const list = s.entities;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    switch (e.type) {
      case 'belt':
        stepBelt(w, e, dt, speed);
        break;
      case 'splitter':
        stepSplitter(w, e);
        break;
      case 'feeder':
        stepFeeder(w, e, dt);
        break;
      case 'clipper':
      case 'megaclipper':
      case 'clipfactory':
        stepConverter(w, e, dt, 'clip');
        break;
      case 'wiremill':
        stepConverter(w, e, dt, 'wire');
        break;
      case 'mine':
        stepMine(w, e, dt);
        break;
      default:
        break;
    }
  }
}
