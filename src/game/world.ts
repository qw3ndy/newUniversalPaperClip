import {
  BUILDINGS,
  DX,
  DY,
  EXPANSIONS,
  HQ_X,
  HQ_Y,
  MAP_H,
  MAP_W,
  rotCCW,
  rotCW,
} from './constants';
import { buildingCost, canAfford, isUnlocked } from './rules';
import { makeEntity } from './state';
import type { BuildingType, Dir, Entity, GameState, Rect } from './types';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Fx {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
}

export type NoticeKind = 'info' | 'good' | 'project' | 'phase' | 'warn';

export interface Notice {
  text: string;
  kind: NoticeKind;
}

export interface PlaceCheck {
  ok: boolean;
  reason?: string;
  replace?: Entity;
}

const LOG_MAX = 80;

/** Le monde : l'état sérialisable + des index reconstruits (grille, gisements). */
export class World {
  s: GameState;
  tiles = new Int32Array(MAP_W * MAP_H);
  terrain = new Uint8Array(MAP_W * MAP_H);
  byId = new Map<number, Entity>();
  powerEff = 1;
  stuckTimer = 0;
  fx: Fx[] = [];
  notices: Notice[] = [];
  /** Accumulateurs pour les statistiques par seconde. */
  acc = { clips: 0, sales: 0, revenue: 0, matter: 0, hqGain: 0, t: 0 };
  /** Incrémenté à chaque changement de la grille (pour les caches du rendu). */
  layoutVersion = 0;

  constructor(s: GameState) {
    this.s = s;
    this.rebuild();
  }

  rebuild(): void {
    this.tiles.fill(0);
    this.byId.clear();
    this.generateTerrain();
    for (const e of this.s.entities) {
      this.byId.set(e.id, e);
      this.stamp(e, e.id);
    }
    for (const e of this.s.entities) {
      if (e.type === 'belt') this.updateBeltShape(e);
      if (e.type === 'mine') e.deposit = this.depositUnder('mine', e.x, e.y);
    }
    this.layoutVersion++;
  }

  private generateTerrain(): void {
    const rnd = mulberry32(this.s.seed ^ 0x5eed);
    const safe = EXPANSIONS[EXPANSIONS.length - 1];
    const cx = HQ_X + 1;
    const cy = HQ_Y + 1;
    let placed = 0;
    let guard = 0;
    while (placed < 34 && guard++ < 2000) {
      const bx = 3 + rnd() * (MAP_W - 6);
      const by = 3 + rnd() * (MAP_H - 6);
      if (Math.abs(bx - cx) < safe.w / 2 + 3 && Math.abs(by - cy) < safe.h / 2 + 3) continue;
      const r = 1.6 + rnd() * 2.4;
      const wob = rnd() * Math.PI * 2;
      for (let y = Math.floor(by - r - 1); y <= by + r + 1; y++) {
        for (let x = Math.floor(bx - r - 1); x <= bx + r + 1; x++) {
          if (!this.inBounds(x, y)) continue;
          const dx = x + 0.5 - bx;
          const dy = y + 0.5 - by;
          const a = Math.atan2(dy, dx);
          const rr = r * (0.82 + 0.18 * Math.sin(a * 3 + wob));
          if (dx * dx + dy * dy < rr * rr) this.terrain[y * MAP_W + x] = 1;
        }
      }
      placed++;
    }
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  }

  at(x: number, y: number): Entity | undefined {
    if (!this.inBounds(x, y)) return undefined;
    const id = this.tiles[y * MAP_W + x];
    return id ? this.byId.get(id) : undefined;
  }

  isDeposit(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.terrain[y * MAP_W + x] === 1;
  }

  buildArea(): Rect {
    if (this.s.phase > 1) return { x0: 0, y0: 0, x1: MAP_W, y1: MAP_H };
    const ex = EXPANSIONS[Math.min(this.s.expansions, EXPANSIONS.length - 1)];
    const x0 = HQ_X + 1 - Math.floor(ex.w / 2);
    const y0 = HQ_Y + 1 - Math.floor(ex.h / 2);
    return { x0, y0, x1: x0 + ex.w, y1: y0 + ex.h };
  }

  inArea(x: number, y: number): boolean {
    const r = this.buildArea();
    return x >= r.x0 && y >= r.y0 && x < r.x1 && y < r.y1;
  }

  private stamp(e: Entity, v: number): void {
    const n = BUILDINGS[e.type].size;
    for (let dy = 0; dy < n; dy++)
      for (let dx = 0; dx < n; dx++) this.tiles[(e.y + dy) * MAP_W + e.x + dx] = v;
  }

  depositUnder(type: BuildingType, x: number, y: number): number {
    const n = BUILDINGS[type].size;
    let c = 0;
    for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) if (this.isDeposit(x + dx, y + dy)) c++;
    return c;
  }

  /** Tuiles devant la face de sortie d'une machine. */
  outputTiles(e: Entity): [number, number][] {
    const n = BUILDINGS[e.type].size;
    const res: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      switch (e.dir) {
        case 0:
          res.push([e.x + i, e.y - 1]);
          break;
        case 1:
          res.push([e.x + n, e.y + i]);
          break;
        case 2:
          res.push([e.x + i, e.y + n]);
          break;
        case 3:
          res.push([e.x - 1, e.y + i]);
          break;
      }
    }
    return res;
  }

  /** L'entité `e` pousse-t-elle des objets vers la tuile (tx, ty) ? */
  feedsInto(e: Entity, tx: number, ty: number): boolean {
    switch (e.type) {
      case 'belt':
        return e.x + DX[e.dir] === tx && e.y + DY[e.dir] === ty;
      case 'splitter':
        return Math.abs(e.x - tx) + Math.abs(e.y - ty) === 1;
      case 'feeder':
      case 'clipper':
      case 'megaclipper':
      case 'clipfactory':
      case 'wiremill':
      case 'mine':
        return this.outputTiles(e).some(([x, y]) => x === tx && y === ty);
      default:
        return false;
    }
  }

  updateBeltShape(e: Entity): void {
    const bx = e.x - DX[e.dir];
    const by = e.y - DY[e.dir];
    const back = this.at(bx, by);
    if (back && back !== e && this.feedsInto(back, e.x, e.y)) {
      e.curve = -1;
      return;
    }
    const sides: number[] = [];
    for (const s of [rotCW(e.dir), rotCCW(e.dir)]) {
      const n = this.at(e.x + DX[s], e.y + DY[s]);
      if (n && n !== e && this.feedsInto(n, e.x, e.y)) sides.push(s);
    }
    e.curve = sides.length === 1 ? sides[0] : -1;
  }

  private refreshAround(x: number, y: number, size: number): void {
    for (let yy = y - 1; yy <= y + size; yy++) {
      for (let xx = x - 1; xx <= x + size; xx++) {
        const n = this.at(xx, yy);
        if (n && n.type === 'belt') this.updateBeltShape(n);
      }
    }
    this.layoutVersion++;
  }

  rotate(e: Entity, dir: Dir): void {
    if (!BUILDINGS[e.type].rotatable) return;
    e.dir = dir;
    this.refreshAround(e.x, e.y, BUILDINGS[e.type].size);
  }

  canPlace(type: BuildingType, x: number, y: number, dir: Dir): PlaceCheck {
    const s = this.s;
    if (!isUnlocked(s, type)) return { ok: false, reason: 'Pas encore débloqué' };
    const n = BUILDINGS[type].size;
    let replace: Entity | undefined;
    for (let dy = 0; dy < n; dy++) {
      for (let dx = 0; dx < n; dx++) {
        const tx = x + dx;
        const ty = y + dy;
        if (!this.inBounds(tx, ty) || !this.inArea(tx, ty)) return { ok: false, reason: 'Hors de la zone constructible' };
        const o = this.at(tx, ty);
        if (o) {
          // Un convoyeur peut être réorienté, ou remplacé par un répartiteur.
          if (n === 1 && o.type === 'belt' && (type === 'belt' || type === 'splitter')) {
            if (type === 'belt' && o.dir === dir) return { ok: false, reason: 'Déjà en place' };
            replace = o;
          } else return { ok: false, reason: 'Emplacement occupé' };
        }
      }
    }
    if (type === 'mine' && this.depositUnder(type, x, y) === 0) return { ok: false, reason: 'Doit être posée sur un gisement' };
    if (!(replace && type === 'belt') && !canAfford(s, buildingCost(s, type))) return { ok: false, reason: 'Pas assez de ressources' };
    return { ok: true, replace };
  }

  place(type: BuildingType, x: number, y: number, dir: Dir): Entity | null {
    const chk = this.canPlace(type, x, y, dir);
    if (!chk.ok) return null;
    const s = this.s;
    if (chk.replace) {
      if (type === 'belt') {
        chk.replace.dir = dir;
        this.refreshAround(x, y, 1);
        return chk.replace;
      }
      this.remove(chk.replace);
    }
    const cost = buildingCost(s, type);
    s.funds -= cost.funds ?? 0;
    s.unsold -= cost.clips ?? 0;
    const e = makeEntity(s.nextId++, type, x, y, BUILDINGS[type].rotatable ? dir : 1);
    e.paid = { ...cost };
    if (type === 'mine') e.deposit = this.depositUnder(type, x, y);
    s.entities.push(e);
    this.byId.set(e.id, e);
    this.stamp(e, e.id);
    s.counts[type] = (s.counts[type] ?? 0) + 1;
    this.refreshAround(x, y, BUILDINGS[type].size);
    return e;
  }

  remove(e: Entity): boolean {
    if (e.type === 'hq') return false;
    const s = this.s;
    const i = s.entities.indexOf(e);
    if (i < 0) return false;
    s.entities.splice(i, 1);
    this.byId.delete(e.id);
    this.stamp(e, 0);
    s.counts[e.type] = Math.max(0, (s.counts[e.type] ?? 0) - 1);
    s.funds += e.paid.funds ?? 0;
    s.unsold += e.paid.clips ?? 0;
    this.refreshAround(e.x, e.y, BUILDINGS[e.type].size);
    return true;
  }

  /** Ajoute un message au journal (et en notification). */
  notify(text: string, kind: NoticeKind = 'info'): void {
    this.s.log.push(text);
    if (this.s.log.length > LOG_MAX) this.s.log.splice(0, this.s.log.length - LOG_MAX);
    this.notices.push({ text, kind });
  }

  addFx(x: number, y: number, text: string, color = '#ffe08a'): void {
    if (this.fx.length > 60) this.fx.shift();
    this.fx.push({ x, y, text, t: 0, color });
  }
}
