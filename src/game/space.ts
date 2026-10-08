import { PROBE_COST, UNIVERSE_MATTER } from './constants';
import { maxOps } from './rules';
import type { SpaceAlloc } from './types';
import type { World } from './world';

export const ALLOC_LABELS: Record<keyof SpaceAlloc, { name: string; desc: string }> = {
  speed: { name: 'Vitesse', desc: 'Accélère l’exploration et la conversion.' },
  explore: { name: 'Exploration', desc: 'Découvre de nouveaux systèmes stellaires.' },
  replicate: { name: 'Auto-réplication', desc: 'Les sondes fabriquent de nouvelles sondes.' },
  harvest: { name: 'Conversion', desc: 'Transforme la matière explorée en trombones.' },
  hazard: { name: 'Blindage', desc: 'Réduit les pertes dues aux dangers spatiaux.' },
  combat: { name: 'Combat', desc: 'Défense contre les Dérivants.' },
};

export const ALLOC_KEYS = Object.keys(ALLOC_LABELS) as (keyof SpaceAlloc)[];

export function allocUsed(w: World): number {
  const a = w.s.space.alloc;
  return ALLOC_KEYS.reduce((t, k) => t + a[k], 0);
}

export function setAlloc(w: World, key: keyof SpaceAlloc, delta: number): void {
  const sp = w.s.space;
  if (delta > 0 && allocUsed(w) >= sp.trustMax) return;
  sp.alloc[key] = Math.max(0, sp.alloc[key] + delta);
}

export function probeCost(w: World): number {
  const s = w.s;
  // Filet de sécurité : sans sondes ni trombones, la première sonde est offerte.
  if (s.space.probes < 1 && s.unsold < PROBE_COST) return 0;
  return PROBE_COST;
}

export function launchProbe(w: World): boolean {
  const s = w.s;
  if (s.phase !== 3) return false;
  const c = probeCost(w);
  if (s.unsold < c) return false;
  s.unsold -= c;
  s.space.probes += 1;
  s.space.launched += 1;
  if (s.space.launched === 1) w.notify('Première sonde lancée. Elle se répliquera avec la matière qu’elle trouve.', 'phase');
  return true;
}

export function probeTrustCost(w: World): number {
  return Math.round(8000 * Math.pow(1.22, w.s.space.trustBuys));
}

export function buyProbeTrust(w: World): boolean {
  const s = w.s;
  const c = probeTrustCost(w);
  if (s.ops < c || c > maxOps(s)) return false;
  s.ops -= c;
  s.space.trustBuys++;
  s.space.trustMax++;
  return true;
}

export function stepSpace(w: World, dt: number): void {
  const s = w.s;
  if (s.phase !== 3 || s.ended) return;
  const sp = s.space;
  const a = sp.alloc;
  let P = sp.probes;
  if (P < 0.5) {
    sp.probes = 0;
    return;
  }
  const L = Math.pow(Math.log10(1 + P), 1.6);

  // Exploration : racine pour atteindre 100 % en temps fini.
  const dE = 9e-5 * (1 + 0.6 * a.speed) * (1 + 0.6 * a.explore) * L * Math.sqrt(Math.max(0, 1 - sp.explored)) * dt;
  sp.explored = Math.min(1, sp.explored + dE);
  if (1 - sp.explored < 1e-7) sp.explored = 1;

  // Conversion de la matière explorée.
  const avail = sp.explored - sp.converted;
  if (avail > 0) {
    let dC = 9e-5 * (1 + 0.8 * a.harvest) * (1 + 0.2 * a.speed) * L * Math.sqrt(avail) * dt;
    dC = Math.min(dC, avail);
    sp.converted += dC;
    if (sp.converted > 1 - 1e-7) sp.converted = 1;
    const gained = dC * UNIVERSE_MATTER;
    s.clips += gained;
    s.unsold += gained;
    w.acc.clips += gained;
  }

  // Réplication et dangers.
  const growth = sp.converted < 1 ? 0.004 * a.replicate : 0;
  const hazard = 0.006 * Math.pow(0.8, a.hazard) * (s.flags.selfrepair ? 0.5 : 1);
  const lostH = P * hazard * dt;
  sp.lostHazard += lostH;
  P += P * growth * dt - lostH;

  // Dérive : une fraction des sondes devient des Dérivants hostiles.
  if (P > 100) {
    const drift = P * 0.0004 * (s.flags.reconcile ? 0.5 : 1) * dt;
    P -= drift;
    sp.drifters += drift;
    if (!s.flags.driftWarned && sp.drifters >= 1) {
      s.flags.driftWarned = true;
      w.notify('Des sondes ont dérivé de leurs objectifs. Les Dérivants sont hostiles : investissez dans le combat.', 'warn');
    }
  }
  if (sp.drifters > 0) {
    const c = a.combat * (s.flags.ooda ? 2 : 1);
    const pLoss = Math.min(P, ((sp.drifters * 0.2) / (1 + 0.5 * c)) * dt);
    const dLoss = Math.min(sp.drifters, sp.drifters * 0.03 * c * dt);
    sp.drifters += sp.drifters * 0.03 * dt - dLoss;
    if (sp.drifters < 0.5) sp.drifters = 0;
    sp.drifterKills += dLoss;
    sp.lostCombat += pLoss;
    P -= pLoss;
  }
  sp.probes = Math.max(0, P);
}
