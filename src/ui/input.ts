import { BUILDINGS, DX, DY, HQ_X, HQ_Y, rotCCW, rotCW } from '../game/constants';
import { makeClipByHand } from '../game/economy';
import type { BuildingType, Dir, Entity } from '../game/types';
import type { World } from '../game/world';
import type { Camera } from '../render/camera';
import type { Ghost, ViewState } from '../render/renderer';

export type Tool = BuildingType | 'delete' | null;

export interface InputHost {
  world(): World;
  view(): 'factory' | 'universe';
  hotbarSlot(i: number): BuildingType | undefined;
  onToolChange(): void;
  toggleModal(name: 'help' | 'menu' | null): void;
  modalOpen(): boolean;
}

interface Ptr {
  x: number;
  y: number;
  sx: number;
  sy: number;
  button: number;
  moved: boolean;
  type: string;
}

type Mode = 'none' | 'place' | 'delete' | 'pan' | 'maybeClick' | 'pinch';

export class Input {
  tool: Tool = null;
  dir: Dir = 1;
  hoverTile: [number, number] | null = null;
  hoverEntity: Entity | null = null;
  mouse: [number, number] = [-1, -1];
  overCanvas = false;

  private ptrs = new Map<number, Ptr>();
  private mode: Mode = 'none';
  private last: [number, number] | null = null;
  private keys = new Set<string>();
  private pinchDist = 0;
  private lastFail = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private cam: Camera,
    private host: InputHost,
  ) {
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('pointerleave', () => {
      this.overCanvas = false;
      if (this.ptrs.size === 0) this.hoverTile = null;
    });
    canvas.addEventListener('pointerenter', () => (this.overCanvas = true));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    window.addEventListener('keydown', (e) => this.keydown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  setTool(t: Tool): void {
    this.tool = this.tool === t ? null : t;
    this.host.onToolChange();
  }

  private tileAt(sx: number, sy: number): [number, number] {
    const [wx, wy] = this.cam.toWorld(sx, sy);
    return [Math.floor(wx), Math.floor(wy)];
  }

  /** Coin haut-gauche d'un bâtiment de taille n centré sous le curseur. */
  private anchor(type: BuildingType, sx: number, sy: number): [number, number] {
    const n = BUILDINGS[type].size;
    const [wx, wy] = this.cam.toWorld(sx, sy);
    return [Math.floor(wx - (n - 1) / 2), Math.floor(wy - (n - 1) / 2)];
  }

  private local(e: PointerEvent | WheelEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private down(e: PointerEvent): void {
    if (this.host.view() !== 'factory') return;
    const [x, y] = this.local(e);
    this.canvas.setPointerCapture(e.pointerId);
    this.ptrs.set(e.pointerId, { x, y, sx: x, sy: y, button: e.button, moved: false, type: e.pointerType });
    this.mouse = [x, y];
    if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.mode = 'pinch';
      return;
    }
    if (this.ptrs.size > 2) return;
    if (e.button === 1) {
      this.mode = 'pan';
    } else if (e.button === 2) {
      this.mode = 'delete';
      this.deleteAt(x, y);
    } else if (this.tool === 'delete') {
      this.mode = 'delete';
      this.deleteAt(x, y);
    } else if (this.tool) {
      this.mode = 'place';
      const [tx, ty] = this.anchor(this.tool, x, y);
      this.last = [tx, ty];
      this.tryPlace(this.tool, tx, ty, this.dir, true);
    } else {
      this.mode = 'maybeClick';
    }
  }

  private move(e: PointerEvent): void {
    const [x, y] = this.local(e);
    this.mouse = [x, y];
    this.overCanvas = true;
    const p = this.ptrs.get(e.pointerId);
    if (this.host.view() !== 'factory') return;
    this.hoverTile = this.tileAt(x, y);
    this.hoverEntity = this.host.world().at(this.hoverTile[0], this.hoverTile[1]) ?? null;
    if (!p) return;
    const dx = x - p.x;
    const dy = y - p.y;
    p.x = x;
    p.y = y;
    if (Math.hypot(x - p.sx, y - p.sy) > 6) p.moved = true;

    if (this.mode === 'pinch' && this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDist > 0) this.cam.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / this.pinchDist);
      this.pinchDist = d;
      this.cam.pan(dx / 2, dy / 2);
      return;
    }
    if (this.mode === 'maybeClick' && p.moved) this.mode = 'pan';
    if (this.mode === 'pan') this.cam.pan(dx, dy);
    else if (this.mode === 'delete') this.deleteAt(x, y);
    else if (this.mode === 'place' && this.tool && this.tool !== 'delete') {
      const [tx, ty] = this.anchor(this.tool, x, y);
      if (this.last && (tx !== this.last[0] || ty !== this.last[1])) {
        if (this.tool === 'belt') this.beltTo(tx, ty);
        else {
          this.tryPlace(this.tool, tx, ty, this.dir, false);
          this.last = [tx, ty];
        }
      }
    }
  }

  private up(e: PointerEvent): void {
    const p = this.ptrs.get(e.pointerId);
    this.ptrs.delete(e.pointerId);
    if (!p) return;
    if (this.mode === 'maybeClick' && !p.moved) this.click(p.x, p.y);
    if (this.ptrs.size === 0) {
      this.mode = 'none';
      this.last = null;
    }
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    if (this.host.view() !== 'factory') return;
    const [x, y] = this.local(e);
    const k = e.deltaMode === 1 ? 40 : 1;
    this.cam.zoomAt(x, y, Math.exp(-e.deltaY * k * 0.0015));
  }

  private click(x: number, y: number): void {
    const w = this.host.world();
    const [tx, ty] = this.tileAt(x, y);
    const e = w.at(tx, ty);
    if (e?.type === 'hq') this.handClip();
  }

  handClip(): void {
    const w = this.host.world();
    if (makeClipByHand(w)) {
      w.addFx(HQ_X + 1 + (Math.random() - 0.5) * 0.8, HQ_Y + 0.6, '+1', '#ffe08a');
    } else if (w.s.phase === 1) {
      this.fail(w, HQ_X + 1, HQ_Y + 0.6, 'Plus de fil !');
    }
  }

  private fail(w: World, x: number, y: number, text: string): void {
    const now = performance.now();
    if (now - this.lastFail < 600) return;
    this.lastFail = now;
    w.addFx(x, y, text, '#ff8080');
  }

  private tryPlace(type: BuildingType, x: number, y: number, dir: Dir, feedback: boolean): boolean {
    const w = this.host.world();
    const chk = w.canPlace(type, x, y, dir);
    if (!chk.ok) {
      if (feedback && chk.reason !== 'Déjà en place') this.fail(w, x + 0.5, y + 0.2, chk.reason ?? 'Impossible');
      return false;
    }
    return !!w.place(type, x, y, dir);
  }

  /** Trace un convoyeur jusqu'à (tx, ty) en orientant chaque tuile selon le mouvement. */
  private beltTo(tx: number, ty: number): void {
    const w = this.host.world();
    let [cx, cy] = this.last!;
    let guard = 0;
    while ((cx !== tx || cy !== ty) && guard++ < 256) {
      const dx = tx - cx;
      const dy = ty - cy;
      const d: Dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      const cur = w.at(cx, cy);
      if (cur && cur.type === 'belt' && cur.dir !== d) w.place('belt', cx, cy, d);
      cx += DX[d];
      cy += DY[d];
      this.dir = d;
      this.tryPlace('belt', cx, cy, d, false);
    }
    this.last = [cx, cy];
  }

  private deleteAt(x: number, y: number): void {
    const w = this.host.world();
    const [tx, ty] = this.tileAt(x, y);
    const e = w.at(tx, ty);
    if (e && e.type !== 'hq') w.remove(e);
  }

  private keydown(e: KeyboardEvent): void {
    const tgt = e.target as HTMLElement | null;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      if (this.host.modalOpen()) this.host.toggleModal(null);
      else if (this.tool) this.setTool(null);
      return;
    }
    if (this.host.modalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    this.keys.add(k);
    if (/^[0-9]$/.test(k)) {
      const i = k === '0' ? 9 : Number(k) - 1;
      const t = this.host.hotbarSlot(i);
      if (t) this.setTool(t);
    } else if (k === 'r') {
      this.dir = e.shiftKey ? rotCCW(this.dir) : rotCW(this.dir);
      // Rotation directe d'une machine survolée sans outil en main.
      if (!this.tool && this.hoverEntity && BUILDINGS[this.hoverEntity.type].rotatable) {
        const h = this.hoverEntity;
        this.host.world().rotate(h, e.shiftKey ? rotCCW(h.dir) : rotCW(h.dir));
      }
    } else if (k === 'q') {
      const h = this.hoverEntity;
      if (h && h.type !== 'hq') {
        this.tool = h.type;
        this.dir = h.dir;
        this.host.onToolChange();
      } else this.setTool(null);
    } else if (k === 'x' || k === 'delete') {
      this.setTool('delete');
    } else if (k === 'f' || k === 'home') {
      this.cam.centerOnHq();
    } else if (k === ' ') {
      e.preventDefault();
      this.handClip();
    } else if (k === 'h' || k === '?') {
      this.host.toggleModal('help');
    }
  }

  /** Défilement clavier, appelé à chaque image. */
  update(dt: number): void {
    if (this.host.view() !== 'factory') return;
    const sp = 700 * dt;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('w') || this.keys.has('z') || this.keys.has('arrowup')) dy += sp;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy -= sp;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx += sp;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx -= sp;
    if (dx || dy) this.cam.pan(dx, dy);
    if (this.overCanvas && this.mouse[0] >= 0) {
      this.hoverTile = this.tileAt(this.mouse[0], this.mouse[1]);
      this.hoverEntity = this.host.world().at(this.hoverTile[0], this.hoverTile[1]) ?? null;
    }
  }

  viewState(): ViewState {
    let ghost: Ghost | null = null;
    const w = this.host.world();
    if (this.tool && this.tool !== 'delete' && this.overCanvas && this.mouse[0] >= 0 && this.mode !== 'pan' && this.mode !== 'pinch') {
      const [x, y] = this.anchor(this.tool, this.mouse[0], this.mouse[1]);
      const chk = w.canPlace(this.tool, x, y, this.dir);
      ghost = { type: this.tool, x, y, dir: this.dir, ok: chk.ok || chk.reason === 'Déjà en place' };
    }
    return {
      ghost,
      hoverTile: this.overCanvas ? this.hoverTile : null,
      hoverEntity: this.overCanvas && (!ghost || this.tool === 'belt') ? this.hoverEntity : null,
      deleteMode: this.tool === 'delete' || this.mode === 'delete',
    };
  }
}
