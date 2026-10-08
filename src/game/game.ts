import { TICK } from './constants';
import { stepEconomy } from './economy';
import { stepFactory } from './sim';
import { stepSpace } from './space';
import type { GameState } from './types';
import { World } from './world';

const MAX_STEPS_PER_FRAME = 10;
const CATCH_UP_LIMIT = 600; // secondes simulées au maximum (hors-ligne / onglet en arrière-plan)
const CATCH_UP_DT = 0.05;

export class Game {
  world: World;
  private acc = 0;
  speed = 1;
  paused = false;

  constructor(state: GameState) {
    this.world = new World(state);
  }

  get s(): GameState {
    return this.world.s;
  }

  replace(state: GameState): void {
    this.world = new World(state);
    this.acc = 0;
  }

  tick(dt: number): void {
    const w = this.world;
    if (w.s.ended) return;
    w.s.time += dt;
    stepFactory(w, dt);
    stepEconomy(w, dt);
    stepSpace(w, dt);
    for (const f of w.fx) f.t += dt;
    if (w.fx.length && w.fx[0].t > 1.5) w.fx = w.fx.filter((f) => f.t <= 1.5);
  }

  /** Avance la simulation du temps réel écoulé. Retourne le temps rattrapé en bloc, le cas échéant. */
  update(realDt: number): number {
    if (this.paused) return 0;
    const dt = realDt * this.speed;
    if (dt > 1) return this.catchUp(dt);
    this.acc += dt;
    let steps = 0;
    while (this.acc >= TICK && steps < MAX_STEPS_PER_FRAME) {
      this.tick(TICK);
      this.acc -= TICK;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.acc = 0;
    return 0;
  }

  catchUp(seconds: number): number {
    const total = Math.min(seconds, CATCH_UP_LIMIT);
    let t = 0;
    while (t < total) {
      const d = Math.min(CATCH_UP_DT, total - t);
      this.tick(d);
      t += d;
    }
    this.acc = 0;
    return total;
  }
}
