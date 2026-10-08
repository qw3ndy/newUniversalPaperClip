import { HQ_X, HQ_Y, MAP_H, MAP_W } from '../game/constants';

export const MIN_ZOOM = 12;
export const MAX_ZOOM = 110;

/** Caméra 2D : (x, y) est la tuile au centre de l'écran, `zoom` en pixels CSS par tuile. */
export class Camera {
  x = HQ_X + 1;
  y = HQ_Y + 1;
  zoom = 46;
  w = 1;
  h = 1;

  toScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.x) * this.zoom + this.w / 2, (wy - this.y) * this.zoom + this.h / 2];
  }

  toWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.w / 2) / this.zoom + this.x, (sy - this.h / 2) / this.zoom + this.y];
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const [wx, wy] = this.toWorld(sx, sy);
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
    const [nx, ny] = this.toWorld(sx, sy);
    this.x += wx - nx;
    this.y += wy - ny;
    this.clamp();
  }

  pan(dxPx: number, dyPx: number): void {
    this.x -= dxPx / this.zoom;
    this.y -= dyPx / this.zoom;
    this.clamp();
  }

  clamp(): void {
    this.x = Math.min(MAP_W, Math.max(0, this.x));
    this.y = Math.min(MAP_H, Math.max(0, this.y));
  }

  centerOnHq(): void {
    this.x = HQ_X + 1;
    this.y = HQ_Y + 1;
  }
}
