import { describe, expect, it } from 'vitest';
import { buyMarketing, buyWire, changePrice, stepEconomy } from '../src/game/economy';
import { Game } from '../src/game/game';
import { availableProjects, buyProject, canBuyProject } from '../src/game/projects';
import {
  buildingCost,
  clipperRate,
  factoryRate,
  marketingCost,
  maxOps,
  megaRate,
  millRate,
  mineRate,
  powerUse,
  solarOutput,
} from '../src/game/rules';
import { deliverClips } from '../src/game/sim';
import { buyProbeTrust, launchProbe, probeTrustCost, stepSpace } from '../src/game/space';
import { newGame } from '../src/game/state';
import type { GameState } from '../src/game/types';

/**
 * Un joueur-robot simplifié : il ignore la disposition de l'usine (la production est
 * la somme des machines) mais utilise les vraies formules d'économie, de confiance,
 * de projets et de coûts. Sert de garde-fou contre les dérives d'équilibrage.
 */
function buyAll(s: GameState, w: Game['world']) {
  for (const p of availableProjects(s)) if (canBuyProject(s, p)) buyProject(w, p.id);
}

function step(w: Game['world'], s: GameState, space = false) {
  for (let k = 0; k < 10; k++) {
    s.time += 0.1;
    stepEconomy(w, 0.1);
    if (space) stepSpace(w, 0.1);
  }
}

function playPhase1(g: Game): number {
  const w = g.world;
  const s = g.s;
  const cnt = (k: keyof GameState['counts']) => s.counts[k] ?? 0;
  for (let sec = 0; sec < 6 * 3600 && s.phase === 1; sec++) {
    if (s.projects.includes('hypnodrones') && s.trust >= 100) buyProject(w, 'release');
    const P = cnt('clipper') * clipperRate(s) + cnt('megaclipper') * megaRate(s) + (sec < 300 ? 2 : 0);
    const made = Math.min(P, s.wire);
    s.wire -= made;
    deliverClips(w, made);
    step(w, s);
    if (s.unsold > P * 10 + 50) changePrice(w, -0.01);
    else if (s.unsold < P * 2) changePrice(w, 0.01);
    for (let k = 0; k < 20 && s.wire < P * 15 + 100 && s.funds >= s.wirePrice; k++) buyWire(w);
    buyAll(s, w);
    while (s.trust - s.processors - s.memory > 0) {
      const need = Math.max(0, ...availableProjects(s).map((p) => p.cost.ops ?? 0));
      if (maxOps(s) < need) s.memory++;
      else s.processors++;
    }
    for (let k = 0; k < 5; k++) {
      const glut = s.stats.salesRate < P * 0.7;
      if (glut && marketingCost(s) <= s.funds) {
        buyMarketing(w);
        continue;
      }
      if (glut) break;
      const cc = buildingCost(s, 'clipper').funds!;
      const mc = s.flags.mega ? buildingCost(s, 'megaclipper').funds! : Infinity;
      if (mc <= s.funds * 0.8 && cnt('megaclipper') < 120) {
        s.funds -= mc;
        s.counts.megaclipper = cnt('megaclipper') + 1;
      } else if (cc <= s.funds * 0.8 && cnt('clipper') < 120) {
        s.funds -= cc;
        s.counts.clipper = cnt('clipper') + 1;
      } else if (marketingCost(s) <= s.funds * 0.35) buyMarketing(w);
      else break;
    }
  }
  return s.time / 60;
}

function playPhase2(g: Game): number {
  const w = g.world;
  const s = g.s;
  const t0 = s.time;
  const cnt = (k: keyof GameState['counts']) => s.counts[k] ?? 0;
  const add = (k: keyof GameState['counts']) => {
    const c = buildingCost(s, k).clips ?? 0;
    if (c > s.unsold) return false;
    s.unsold -= c;
    s.counts[k] = cnt(k) + 1;
    return true;
  };
  for (let sec = 0; sec < 4 * 3600 && s.phase === 2; sec++) {
    const use = (['mine', 'wiremill', 'clipfactory', 'compute'] as const).reduce((t, k) => t + cnt(k) * powerUse(s, k), 0);
    const prod = cnt('solar') * solarOutput(s);
    const eff = use > 0 ? Math.min(1, prod / use) : 1;
    s.bonusProcessors = Math.floor(cnt('compute') * eff) * 2;
    s.bonusMemory = Math.floor(cnt('compute') * eff) * 4;
    const m = Math.min(cnt('mine') * mineRate(s) * eff, s.earthMatter);
    s.earthMatter -= m;
    const fromWire = Math.min(s.wire, cnt('megaclipper') * megaRate(s));
    s.wire -= fromWire;
    deliverClips(w, Math.min(m, cnt('wiremill') * millRate(s) * eff, cnt('clipfactory') * factoryRate(s) * eff) + fromWire);
    step(w, s);
    buyAll(s, w);
    for (let k = 0; k < 10; k++) {
      if (use * 1.1 > prod && add('solar')) continue;
      const mr = cnt('mine') * mineRate(s);
      if (s.flags.compute && cnt('compute') < 8 && add('compute')) continue;
      if (cnt('wiremill') * millRate(s) < mr && add('wiremill')) continue;
      if (cnt('clipfactory') * factoryRate(s) < mr && add('clipfactory')) continue;
      if (cnt('mine') < 40 && add('mine')) continue;
      break;
    }
  }
  return (s.time - t0) / 60;
}

function playPhase3(g: Game): number {
  const w = g.world;
  const s = g.s;
  const t0 = s.time;
  for (let i = 0; i < 5; i++) launchProbe(w);
  for (let sec = 0; sec < 3 * 3600 && !s.ended; sec++) {
    step(w, s, true);
    buyAll(s, w);
    if (s.ops >= probeTrustCost(w) && buyProbeTrust(w)) s.space.alloc.combat++;
    if (s.space.probes < 1) launchProbe(w);
  }
  return (s.time - t0) / 60;
}

describe('équilibrage (joueur-robot)', () => {
  it('chaque phase se termine dans un temps raisonnable', () => {
    const g = new Game(newGame(1));
    const p1 = playPhase1(g);
    expect(g.s.phase).toBe(2);
    expect(p1).toBeGreaterThan(40);
    expect(p1).toBeLessThan(110);

    const p2 = playPhase2(g);
    expect(g.s.phase).toBe(3);
    expect(p2).toBeGreaterThan(15);
    expect(p2).toBeLessThan(60);

    const p3 = playPhase3(g);
    expect(g.s.ended).toBe(true);
    expect(p3).toBeGreaterThan(4);
    expect(p3).toBeLessThan(40);
  }, 60_000);
});
