import { BUILDINGS, MAP_H, MAP_W, rotCW } from '../game/constants';
import type { BuildingType, Dir, Entity, ItemKind, MachineStatus } from '../game/types';
import type { World } from '../game/world';
import type { Camera } from './camera';
import { drawIcon } from './icons';

export interface Ghost {
  type: BuildingType;
  x: number;
  y: number;
  dir: Dir;
  ok: boolean;
}

export interface ViewState {
  ghost: Ghost | null;
  hoverTile: [number, number] | null;
  hoverEntity: Entity | null;
  deleteMode: boolean;
}

const COLORS = {
  void: '#0b0e14',
  ground: '#161b26',
  groundAlt: '#181e2a',
  grid: 'rgba(255,255,255,0.035)',
  locked: 'rgba(5,7,11,0.62)',
  border: '#ffcf5c',
  deposit: '#251c3d',
  depositEdge: '#3b2a63',
  track: '#222838',
  rail: '#3a4560',
  chevron: 'rgba(150,175,220,0.28)',
};

const STATUS_COLOR: Partial<Record<MachineStatus, string>> = {
  noInput: '#f5a524',
  blocked: '#ff5d5d',
  noPower: '#ffd60a',
  noWire: '#ff8c42',
  noDeposit: '#8892a6',
};

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt > 0 ? (255 - c) * amt : c * amt))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

const LIGHT = new Map<string, string>();
const lighter = (hex: string) => {
  let v = LIGHT.get(hex);
  if (!v) {
    v = shade(hex, 0.18);
    LIGHT.set(hex, v);
  }
  return v;
};

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Passe d'un repère local (sortie vers +x, origine au centre) au monde. */
function rotLocal(dir: Dir, lx: number, ly: number): [number, number] {
  switch (dir) {
    case 1:
      return [lx, ly];
    case 2:
      return [-ly, lx];
    case 3:
      return [-lx, -ly];
    default:
      return [ly, -lx];
  }
}

/** Position monde d'un objet sur un convoyeur. */
export function beltItemPos(e: Entity, pos: number): [number, number] {
  let lx: number;
  let ly: number;
  if (e.curve < 0) {
    lx = pos - 0.5;
    ly = 0;
  } else {
    const a = Math.PI - (pos * Math.PI) / 2;
    lx = 0.5 + 0.5 * Math.cos(a);
    ly = -0.5 + 0.5 * Math.sin(a);
    if (e.curve === rotCW(e.dir)) ly = -ly;
  }
  const [wx, wy] = rotLocal(e.dir, lx, ly);
  return [e.x + 0.5 + wx, e.y + 0.5 + wy];
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  dpr = 1;
  private hatch: CanvasPattern | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
  }

  resize(cam: Camera): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    cam.w = r.width;
    cam.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
  }

  private hatchPattern(): CanvasPattern | null {
    if (this.hatch) return this.hatch;
    const c = document.createElement('canvas');
    c.width = c.height = 12;
    const g = c.getContext('2d');
    if (!g) return null;
    g.strokeStyle = 'rgba(255,255,255,0.035)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 12);
    g.lineTo(12, 0);
    g.stroke();
    this.hatch = this.ctx.createPattern(c, 'repeat');
    return this.hatch;
  }

  private worldTransform(cam: Camera): void {
    const z = cam.zoom * this.dpr;
    this.ctx.setTransform(z, 0, 0, z, this.dpr * (cam.w / 2 - cam.x * cam.zoom), this.dpr * (cam.h / 2 - cam.y * cam.zoom));
  }

  private screenTransform(): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  draw(w: World, cam: Camera, view: ViewState, now: number): void {
    const ctx = this.ctx;
    const s = w.s;
    const t = s.time;
    this.screenTransform();
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(0, 0, cam.w, cam.h);

    const [wx0, wy0] = cam.toWorld(0, 0);
    const [wx1, wy1] = cam.toWorld(cam.w, cam.h);
    const x0 = Math.max(0, Math.floor(wx0) - 1);
    const y0 = Math.max(0, Math.floor(wy0) - 1);
    const x1 = Math.min(MAP_W, Math.ceil(wx1) + 1);
    const y1 = Math.min(MAP_H, Math.ceil(wy1) + 1);

    this.worldTransform(cam);
    const px = 1 / cam.zoom; // un pixel CSS en unités monde

    // Sol
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    ctx.fillStyle = COLORS.groundAlt;
    for (let y = y0; y < y1; y++)
      for (let x = x0 + ((x0 + y) & 1); x < x1; x += 2) ctx.fillRect(x, y, 1, 1);

    // Gisements
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (!w.isDeposit(x, y)) continue;
        ctx.fillStyle = COLORS.deposit;
        ctx.fillRect(x, y, 1, 1);
        const h = hash(x, y);
        ctx.fillStyle = h > 0.5 ? '#8f6bdc' : '#5fc8e8';
        ctx.globalAlpha = 0.55 + 0.25 * Math.sin(now * 1.5 + h * 10);
        const cx = x + 0.25 + h * 0.5;
        const cy = y + 0.3 + hash(y, x) * 0.4;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 0.16);
        ctx.lineTo(cx + 0.08, cy);
        ctx.lineTo(cx, cy + 0.12);
        ctx.lineTo(cx - 0.08, cy);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Grille
    if (cam.zoom > 18) {
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = px;
      ctx.beginPath();
      for (let x = x0; x <= x1; x++) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      for (let y = y0; y <= y1; y++) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
    }

    // Zone verrouillée (phase 1)
    const area = w.buildArea();
    if (s.phase === 1) {
      ctx.fillStyle = COLORS.locked;
      ctx.beginPath();
      ctx.rect(0, 0, MAP_W, MAP_H);
      ctx.rect(area.x0, area.y0, area.x1 - area.x0, area.y1 - area.y0);
      ctx.fill('evenodd');
      const pat = this.hatchPattern();
      if (pat) {
        ctx.save();
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.fillStyle = pat;
        ctx.beginPath();
        const [ax, ay] = cam.toScreen(area.x0, area.y0);
        const [bx, by] = cam.toScreen(area.x1, area.y1);
        ctx.rect(0, 0, cam.w, cam.h);
        ctx.rect(ax, ay, bx - ax, by - ay);
        ctx.fill('evenodd');
        ctx.restore();
      }
      ctx.strokeStyle = COLORS.border;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 2 * px;
      ctx.setLineDash([6 * px, 6 * px]);
      ctx.lineDashOffset = -now * 8 * px;
      ctx.strokeRect(area.x0, area.y0, area.x1 - area.x0, area.y1 - area.y0);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    const visible = (e: Entity) => {
      const n = BUILDINGS[e.type].size;
      return e.x + n >= x0 && e.x <= x1 && e.y + n >= y0 && e.y <= y1;
    };

    const speed = 2 * s.mods.beltMult;
    // Convoyeurs : pistes puis objets
    for (const e of s.entities) if (e.type === 'belt' && visible(e)) this.drawBelt(e, t * speed);
    for (const e of s.entities) {
      if (e.type !== 'belt' || !visible(e)) continue;
      for (const it of e.items) {
        const [ix, iy] = beltItemPos(e, it.pos);
        this.drawItem(it.kind, it.qty, ix, iy);
      }
    }

    // Machines
    for (const e of s.entities) {
      if (e.type === 'belt' || !visible(e)) continue;
      this.drawMachine(e, t, now);
    }

    // Survol
    if (view.hoverEntity) {
      const e = view.hoverEntity;
      const n = BUILDINGS[e.type].size;
      ctx.strokeStyle = view.deleteMode ? '#ff5d5d' : 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2 * px;
      roundRect(ctx, e.x + 0.02, e.y + 0.02, n - 0.04, n - 0.04, 0.16);
      ctx.stroke();
      if (view.deleteMode) {
        ctx.fillStyle = 'rgba(255,60,60,0.18)';
        ctx.fill();
      }
    } else if (view.hoverTile && !view.ghost) {
      const [hx, hy] = view.hoverTile;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = px * 1.5;
      ctx.strokeRect(hx + 0.04, hy + 0.04, 0.92, 0.92);
    }

    // Fantôme de construction
    if (view.ghost) this.drawGhost(w, view.ghost, t, now, px);

    // Effets flottants (repère écran)
    this.screenTransform();
    ctx.textAlign = 'center';
    ctx.font = '600 13px Inter, system-ui, sans-serif';
    for (const f of w.fx) {
      const [sx, sy] = cam.toScreen(f.x, f.y);
      ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, sx, sy - f.t * 28);
    }
    ctx.globalAlpha = 1;
  }

  private drawBelt(e: Entity, phase: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(e.x + 0.5, e.y + 0.5);
    ctx.rotate(((e.dir - 1) * Math.PI) / 2);
    if (e.curve >= 0 && e.curve === rotCW(e.dir)) ctx.scale(1, -1);
    const W = 0.31;
    if (e.curve < 0) {
      ctx.fillStyle = COLORS.track;
      ctx.fillRect(-0.5, -W, 1, W * 2);
      ctx.strokeStyle = COLORS.rail;
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(-0.5, -W);
      ctx.lineTo(0.5, -W);
      ctx.moveTo(-0.5, W);
      ctx.lineTo(0.5, W);
      ctx.stroke();
      ctx.strokeStyle = COLORS.chevron;
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const cx = -0.5 + (((k / 3 + phase) % 1) + 1) % 1;
        ctx.moveTo(cx - 0.08, -0.13);
        ctx.lineTo(cx + 0.04, 0);
        ctx.lineTo(cx - 0.08, 0.13);
      }
      ctx.stroke();
    } else {
      // Courbe : quart d'anneau centré sur le coin (0.5, -0.5).
      ctx.fillStyle = COLORS.track;
      ctx.beginPath();
      ctx.arc(0.5, -0.5, 0.5 + W, Math.PI / 2, Math.PI);
      ctx.arc(0.5, -0.5, 0.5 - W, Math.PI, Math.PI / 2, true);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COLORS.rail;
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(0.5, -0.5, 0.5 + W, Math.PI / 2, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0.5, -0.5, 0.5 - W, Math.PI / 2, Math.PI);
      ctx.stroke();
      ctx.strokeStyle = COLORS.chevron;
      ctx.lineWidth = 0.06;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const p = (((k / 3 + phase) % 1) + 1) % 1;
        const a = Math.PI - (p * Math.PI) / 2;
        const cx = 0.5 + 0.5 * Math.cos(a);
        const cy = -0.5 + 0.5 * Math.sin(a);
        const tx = Math.sin(a); // tangente (sens de déplacement)
        const ty = -Math.cos(a);
        const nx = -ty;
        const ny = tx;
        ctx.moveTo(cx - tx * 0.08 + nx * 0.13, cy - ty * 0.08 + ny * 0.13);
        ctx.lineTo(cx + tx * 0.04, cy + ty * 0.04);
        ctx.lineTo(cx - tx * 0.08 - nx * 0.13, cy - ty * 0.08 - ny * 0.13);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawItem(kind: ItemKind, qty: number, x: number, y: number): void {
    const ctx = this.ctx;
    const r = 0.12 + Math.min(0.07, 0.016 * Math.log10(Math.max(1, qty)));
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(x, y + 0.04, r, 0, Math.PI * 2);
    ctx.fill();
    if (kind === 'wire') {
      ctx.fillStyle = '#c8743f';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffc08a';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.68, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#6e3618';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'clip') {
      ctx.fillStyle = '#23344d';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(159,212,255,0.5)';
      ctx.lineWidth = 0.02;
      ctx.stroke();
      drawIcon(ctx, 'clip', x, y, r * 1.7, '#eaf3ff', 2.6);
    } else {
      ctx.fillStyle = '#8b5cf6';
      ctx.strokeStyle = '#e0d0ff';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.1);
      ctx.lineTo(x + r * 0.9, y);
      ctx.lineTo(x, y + r * 1.1);
      ctx.lineTo(x - r * 0.9, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawMachine(e: Entity, t: number, now: number, ghost = false): void {
    const ctx = this.ctx;
    const def = BUILDINGS[e.type];
    const n = def.size;
    const { x, y } = e;
    const active = t - e.pulse < 0.25;
    const cx = x + n / 2;
    const cy = y + n / 2;

    if (e.type === 'splitter') {
      ctx.fillStyle = COLORS.track;
      ctx.fillRect(x, y + 0.19, 1, 0.62);
      ctx.fillRect(x + 0.19, y, 0.62, 1);
      ctx.fillStyle = def.body;
      ctx.beginPath();
      ctx.arc(cx, cy, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = def.accent;
      ctx.lineWidth = 0.05;
      ctx.stroke();
      ctx.fillStyle = def.accent;
      const spin = e.status === 'ok' ? now * 2 : 0;
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 0.46, cy + Math.sin(a) * 0.46);
        ctx.lineTo(cx + Math.cos(a + 0.35) * 0.34, cy + Math.sin(a + 0.35) * 0.34);
        ctx.lineTo(cx + Math.cos(a - 0.35) * 0.34, cy + Math.sin(a - 0.35) * 0.34);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = def.accent;
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = spin + (k * Math.PI * 2) / 3;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 0.18, cy + Math.sin(a) * 0.18);
      }
      ctx.stroke();
      if (!ghost) for (const it of e.items) this.drawItem(it.kind, it.qty, cx, cy);
      return;
    }

    const pad = 0.06;
    // Ombre portée
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    roundRect(ctx, x + pad, y + pad + 0.07, n - pad * 2, n - pad * 2, 0.16);
    ctx.fill();
    // Corps
    ctx.fillStyle = def.body;
    roundRect(ctx, x + pad, y + pad, n - pad * 2, n - pad * 2, 0.16);
    ctx.fill();
    // Face supérieure
    const g = ctx.createLinearGradient(x, y, x, y + n);
    g.addColorStop(0, lighter(def.body));
    g.addColorStop(1, def.body);
    ctx.fillStyle = g;
    roundRect(ctx, x + pad + 0.05, y + pad + 0.04, n - pad * 2 - 0.1, n - pad * 2 - 0.14, 0.12);
    ctx.fill();
    ctx.strokeStyle = def.accent;
    ctx.globalAlpha = active ? 0.65 : 0.28;
    ctx.lineWidth = 0.035;
    roundRect(ctx, x + pad, y + pad, n - pad * 2, n - pad * 2, 0.16);
    ctx.stroke();
    ctx.globalAlpha = 1;

    switch (e.type) {
      case 'hq':
        this.drawHq(e, t, now);
        break;
      case 'feeder': {
        // Bobine de fil cuivré qui se déroule
        ctx.fillStyle = '#7a3f1f';
        ctx.beginPath();
        ctx.arc(cx, cy, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffb27a';
        ctx.lineWidth = 0.035;
        for (const r of [0.26, 0.19, 0.12]) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#2a1a10';
        ctx.beginPath();
        ctx.arc(cx, cy, 0.06, 0, Math.PI * 2);
        ctx.fill();
        const a0 = active ? now * 5 : 0.6;
        ctx.strokeStyle = '#fff1e0';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.arc(cx, cy, 0.26, a0, a0 + 0.7);
        ctx.stroke();
        break;
      }
      case 'clipper':
        drawCog(ctx, cx, cy, 0.25, 8, active ? now * 3 : 0, def.accent);
        drawIcon(ctx, 'clip', cx, cy, 0.26, '#0f1a26', 3);
        break;
      case 'megaclipper':
        drawCog(ctx, cx - 0.36, cy - 0.3, 0.32, 10, active ? now * 3 : 0, def.accent);
        drawCog(ctx, cx + 0.36, cy + 0.3, 0.32, 10, active ? -now * 3 + 0.3 : 0.3, def.accent);
        drawIcon(ctx, 'clip', cx + 0.42, cy - 0.38, 0.42, def.accent, 2.4);
        drawIcon(ctx, 'clip', cx - 0.42, cy + 0.38, 0.42, def.accent, 2.4);
        break;
      case 'mine': {
        ctx.fillStyle = 'rgba(160,110,255,0.18)';
        ctx.beginPath();
        ctx.arc(cx, cy, 0.7, 0, Math.PI * 2);
        ctx.fill();
        const a0 = active ? now * 6 : 0;
        ctx.fillStyle = def.accent;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = a0 + (k * Math.PI * 2) / 3;
          ctx.moveTo(cx + Math.cos(a) * 0.55, cy + Math.sin(a) * 0.55);
          ctx.lineTo(cx + Math.cos(a + 0.5) * 0.18, cy + Math.sin(a + 0.5) * 0.18);
          ctx.lineTo(cx + Math.cos(a - 0.5) * 0.18, cy + Math.sin(a - 0.5) * 0.18);
        }
        ctx.fill();
        ctx.fillStyle = '#1b1430';
        ctx.beginPath();
        ctx.arc(cx, cy, 0.14, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'wiremill':
        ctx.fillStyle = '#9a542b';
        ctx.beginPath();
        ctx.arc(cx - 0.3, cy, 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffb27a';
        ctx.lineWidth = 0.05;
        for (let r = 0.12; r < 0.38; r += 0.09) {
          ctx.beginPath();
          ctx.arc(cx - 0.3, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        drawCog(ctx, cx + 0.42, cy - 0.35, 0.24, 8, active ? now * 4 : 0, def.accent);
        drawCog(ctx, cx + 0.42, cy + 0.35, 0.24, 8, active ? -now * 4 : 0, def.accent);
        break;
      case 'clipfactory': {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        roundRect(ctx, x + 0.4, y + 0.45, n - 0.8, n - 0.9, 0.12);
        ctx.fill();
        for (let k = 0; k < 3; k++) {
          const sx = x + 0.75 + k * 0.75;
          ctx.fillStyle = '#16293a';
          ctx.fillRect(sx - 0.12, y + 0.25, 0.24, 0.5);
          if (active) {
            const p = (now * 0.8 + k * 0.33) % 1;
            ctx.fillStyle = `rgba(200,220,240,${0.35 * (1 - p)})`;
            ctx.beginPath();
            ctx.arc(sx + p * 0.15, y + 0.2 - p * 0.5, 0.1 + p * 0.15, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        drawCog(ctx, cx, cy + 0.25, 0.55, 12, active ? now * 2 : 0, def.accent);
        drawIcon(ctx, 'clip', cx, cy + 0.25, 0.6, '#0e1b28', 3);
        break;
      }
      case 'solar': {
        const s2 = 0.36;
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < 2; j++) {
            const px0 = x + 0.2 + i * (s2 * 2 + 0.08);
            const py0 = y + 0.2 + j * (s2 * 2 + 0.08);
            ctx.fillStyle = '#1d4f86';
            ctx.fillRect(px0, py0, s2 * 2, s2 * 2);
            ctx.strokeStyle = 'rgba(160,210,255,0.35)';
            ctx.lineWidth = 0.02;
            ctx.beginPath();
            for (let k = 1; k < 3; k++) {
              ctx.moveTo(px0 + (k * s2 * 2) / 3, py0);
              ctx.lineTo(px0 + (k * s2 * 2) / 3, py0 + s2 * 2);
              ctx.moveTo(px0, py0 + (k * s2 * 2) / 3);
              ctx.lineTo(px0 + s2 * 2, py0 + (k * s2 * 2) / 3);
            }
            ctx.stroke();
          }
        }
        // Reflet qui balaie les panneaux
        const sheen = ((now * 0.25 + hash(x, y)) % 1) * 2.2 - 0.3;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 0.2, y + 0.2, 1.6, 1.6);
        ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.moveTo(x + sheen, y + 0.2);
        ctx.lineTo(x + sheen + 0.25, y + 0.2);
        ctx.lineTo(x + sheen - 0.1, y + 1.8);
        ctx.lineTo(x + sheen - 0.35, y + 1.8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'compute': {
        ctx.fillStyle = '#0f1b2b';
        roundRect(ctx, cx - 0.5, cy - 0.5, 1, 1, 0.08);
        ctx.fill();
        ctx.strokeStyle = def.accent;
        ctx.lineWidth = 0.04;
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            const on = hash(i + Math.floor(now * 4), j + e.id) > 0.5 && e.status === 'ok';
            ctx.fillStyle = on ? def.accent : 'rgba(125,255,178,0.15)';
            ctx.fillRect(cx - 0.36 + i * 0.2, cy - 0.36 + j * 0.2, 0.1, 0.1);
          }
        }
        break;
      }
      case 'depot':
        ctx.strokeStyle = '#8a6a3a';
        ctx.lineWidth = 0.08;
        ctx.fillStyle = '#5a4428';
        roundRect(ctx, cx - 0.6, cy - 0.6, 1.2, 1.2, 0.06);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 0.6, cy - 0.6);
        ctx.lineTo(cx + 0.6, cy + 0.6);
        ctx.moveTo(cx + 0.6, cy - 0.6);
        ctx.lineTo(cx - 0.6, cy + 0.6);
        ctx.stroke();
        drawIcon(ctx, 'clip', cx, cy, 0.6, def.accent, 2.6);
        break;
      default:
        break;
    }

    // Flèche de sortie
    if (e.type !== 'hq' && e.type !== 'solar' && e.type !== 'compute' && e.type !== 'depot') {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(((e.dir - 1) * Math.PI) / 2);
      ctx.fillStyle = def.accent;
      ctx.beginPath();
      const ex = n / 2 - 0.04;
      ctx.moveTo(ex, 0);
      ctx.lineTo(ex - 0.14, -0.12);
      ctx.lineTo(ex - 0.14, 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (!ghost) {
      const col = STATUS_COLOR[e.status];
      if (col && e.type !== 'hq') {
        const bx = x + n - 0.2;
        const by = y + 0.2;
        const pulse = 0.85 + 0.15 * Math.sin(now * 6);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(bx, by, 0.13 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10131a';
        if (e.status === 'blocked') ctx.fillRect(bx - 0.07, by - 0.02, 0.14, 0.04);
        else if (e.status === 'noPower') {
          ctx.beginPath();
          ctx.moveTo(bx + 0.02, by - 0.09);
          ctx.lineTo(bx - 0.05, by + 0.01);
          ctx.lineTo(bx + 0.01, by + 0.01);
          ctx.lineTo(bx - 0.02, by + 0.09);
          ctx.lineTo(bx + 0.05, by - 0.01);
          ctx.lineTo(bx - 0.01, by - 0.01);
          ctx.closePath();
          ctx.fill();
        } else
          for (let k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.arc(bx + k * 0.05, by, 0.018, 0, Math.PI * 2);
            ctx.fill();
          }
      }
      if (e.out) {
        // Lot prêt à sortir, posé contre la face de sortie.
        const [ox, oy] = rotLocal(e.dir, n / 2 - 0.22, 0);
        this.drawItem(e.out.kind, e.out.qty, cx + ox, cy + oy);
      }
    }
  }

  private drawHq(e: Entity, t: number, now: number): void {
    const ctx = this.ctx;
    const cx = e.x + 1;
    const cy = e.y + 1;
    const glow = Math.max(0, 1 - (t - e.pulse) * 3);
    const breath = 0.5 + 0.5 * Math.sin(now * 2);
    const rg = ctx.createRadialGradient(cx, cy, 0.1, cx, cy, 1.3);
    rg.addColorStop(0, `rgba(255,207,92,${0.25 + glow * 0.35 + breath * 0.05})`);
    rg.addColorStop(1, 'rgba(255,207,92,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a2133';
    ctx.beginPath();
    ctx.arc(cx, cy, 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffcf5c';
    ctx.lineWidth = 0.05;
    ctx.stroke();
    drawIcon(ctx, 'clip', cx, cy, 0.85 + glow * 0.08, '#ffcf5c', 2.2);
    // Ports sur les quatre faces
    ctx.fillStyle = 'rgba(255,207,92,0.5)';
    for (let k = 0; k < 2; k++) {
      ctx.fillRect(e.x + 0.38 + k, e.y + 0.02, 0.24, 0.06);
      ctx.fillRect(e.x + 0.38 + k, e.y + 1.92, 0.24, 0.06);
      ctx.fillRect(e.x + 0.02, e.y + 0.38 + k, 0.06, 0.24);
      ctx.fillRect(e.x + 1.92, e.y + 0.38 + k, 0.06, 0.24);
    }
  }

  private drawGhost(w: World, g: Ghost, t: number, now: number, px: number): void {
    const ctx = this.ctx;
    const def = BUILDINGS[g.type];
    const n = def.size;
    const fake: Entity = {
      id: -1,
      type: g.type,
      x: g.x,
      y: g.y,
      dir: g.dir,
      items: [],
      out: null,
      inBuf: 0,
      outBuf: 0,
      timer: 0,
      rr: 0,
      status: 'ok',
      curve: -1,
      deposit: 0,
      paid: {},
      pulse: -10,
    };
    // Tuiles de sortie
    if (def.rotatable && g.type !== 'belt') {
      const tiles = w.outputTiles(fake);
      ctx.fillStyle = 'rgba(90,220,140,0.16)';
      for (const [ox, oy] of tiles) ctx.fillRect(ox + 0.06, oy + 0.06, 0.88, 0.88);
    }
    ctx.globalAlpha = 0.6;
    if (g.type === 'belt') this.drawBelt(fake, t * 2);
    else this.drawMachine(fake, t, now, true);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = g.ok ? 'rgba(120,230,160,0.9)' : 'rgba(255,90,90,0.95)';
    ctx.lineWidth = 2 * px;
    roundRect(ctx, g.x + 0.03, g.y + 0.03, n - 0.06, n - 0.06, 0.14);
    ctx.stroke();
    if (!g.ok) {
      ctx.fillStyle = 'rgba(255,60,60,0.16)';
      ctx.fill();
    }
    if (g.type === 'mine') {
      for (let dy = 0; dy < n; dy++)
        for (let dx = 0; dx < n; dx++)
          if (w.isDeposit(g.x + dx, g.y + dy)) {
            ctx.fillStyle = 'rgba(190,140,255,0.25)';
            ctx.fillRect(g.x + dx + 0.1, g.y + dy + 0.1, 0.8, 0.8);
          }
    }
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCog(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, teeth: number, angle: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  const inner = r * 0.78;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = angle + (i * Math.PI) / teeth;
    const a1 = angle + ((i + 1) * Math.PI) / teeth;
    const rr = i % 2 === 0 ? r : inner;
    ctx.lineTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr);
    ctx.lineTo(cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
}
