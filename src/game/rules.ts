import { BELT_BASE_SPEED, BUILDINGS } from './constants';
import type { BuildingType, Cost, Entity, GameState } from './types';

export const clipperRate = (s: GameState) => 1 * s.mods.clipperBoost;
/** Une méga-plieuse vaut 20 plieuses, améliorations comprises, et jamais moins de 50/s de base. */
export const megaRate = (s: GameState) => Math.max(50, 20 * clipperRate(s)) * s.mods.megaBoost;
export const feederRate = (s: GameState) => 20 * s.mods.feederMult;
/** Débit d'une foreuse couvrant entièrement un gisement (4 tuiles). */
export const mineRate = (s: GameState) => 400 * s.mods.nano;
export const millRate = (s: GameState) => 1000 * s.mods.nano;
export const factoryRate = (s: GameState) => 2500 * s.mods.nano;
export const solarOutput = (s: GameState) => 10 * s.mods.solarMult;
export const beltSpeed = (s: GameState) => BELT_BASE_SPEED * s.mods.beltMult;
export const powerUse = (s: GameState, type: BuildingType) => BUILDINGS[type].power * s.mods.powerMult;

export const spoolSize = (s: GameState) => Math.round(1000 * s.mods.spoolMult);
export const marketingCost = (s: GameState) => 100 * Math.pow(2, s.marketingLvl - 1);
export const totalProcessors = (s: GameState) => s.processors + s.bonusProcessors;
export const totalMemory = (s: GameState) => s.memory + s.bonusMemory;
export const maxOps = (s: GameState) => totalMemory(s) * 1000;
export const opsRate = (s: GameState) => totalProcessors(s) * 20;
export const creativityRate = (s: GameState) =>
  (0.4 + 0.35 * Math.pow(totalProcessors(s), 1.1)) * (s.mods.creativityMult ?? 1);
export const trustAvailable = (s: GameState) => s.trust - s.processors - s.memory;

/** Débit nominal (unités / s) d'une machine, hors énergie. */
export function machineRate(s: GameState, e: Entity): number {
  switch (e.type) {
    case 'clipper':
      return clipperRate(s);
    case 'megaclipper':
      return megaRate(s);
    case 'clipfactory':
      return factoryRate(s);
    case 'wiremill':
      return millRate(s);
    case 'mine':
      return (mineRate(s) * e.deposit) / 4;
    case 'feeder':
      return feederRate(s);
    default:
      return 0;
  }
}

export function demandOf(s: GameState): number {
  return (0.8 / s.margin) * Math.pow(1.1, s.marketingLvl - 1) * s.marketingEffect * marketFactor(s);
}

/** Ventes attendues par seconde (formule de l'original, lissée). */
export function salesRate(s: GameState): number {
  const d = demandOf(s);
  return Math.min(1, d / 100) * 10 * 0.7 * Math.pow(d, 1.15);
}

export function buildingCost(s: GameState, type: BuildingType): Cost {
  const n = s.counts[type] ?? 0;
  const p1 = s.phase === 1;
  switch (type) {
    case 'belt':
      return {};
    case 'splitter':
      return p1 ? { funds: 3 } : {};
    case 'feeder':
      return p1 ? { funds: 8 * Math.pow(1.3, n) } : { clips: 100 * Math.pow(1.15, n) };
    case 'clipper':
      return p1 ? { funds: 5 + Math.pow(1.1, n) } : { clips: 50 * Math.pow(1.05, n) };
    case 'megaclipper':
      return p1 ? { funds: 1000 * Math.pow(1.07, n) } : { clips: 5000 * Math.pow(1.07, n) };
    case 'mine':
      return { clips: 1000 * Math.pow(1.12, n) };
    case 'wiremill':
      return { clips: 1000 * Math.pow(1.12, n) };
    case 'clipfactory':
      return { clips: 5000 * Math.pow(1.15, n) };
    case 'solar':
      return { clips: 500 * Math.pow(1.1, n) };
    case 'compute':
      return { clips: 1e5 * Math.pow(1.35, n) };
    case 'depot':
      return { clips: 2000 * Math.pow(1.2, n) };
    case 'hq':
      return {};
  }
}

export function canAfford(s: GameState, c: Cost): boolean {
  return (c.funds ?? 0) <= s.funds + 1e-9 && (c.clips ?? 0) <= s.unsold + 1e-9;
}

export function isFree(c: Cost): boolean {
  return !c.funds && !c.clips;
}

export function isUnlocked(s: GameState, type: BuildingType): boolean {
  const def = BUILDINGS[type];
  if (!def.phases.includes(s.phase)) return false;
  if (type === 'megaclipper') return !!s.flags.mega;
  if (type === 'compute') return !!s.flags.compute;
  return true;
}

// ——— Règles de scénario (valent 1 / neutres en partie classique) ———

const MARKET_PERIOD = 240;

/** Cycle du scénario « Krach » : stable, puis krach, puis euphorie. */
export function marketState(s: GameState): { factor: number; label: string; next: number } {
  if (!s.rules?.marketCycle) return { factor: 1, label: 'Stable', next: 0 };
  const t = s.time % MARKET_PERIOD;
  if (t < 150) return { factor: 1, label: 'Stable', next: 150 - t };
  if (t < 200) return { factor: s.flags.hedge ? 0.6 : 0.25, label: 'Krach !', next: 200 - t };
  return { factor: 2, label: 'Euphorie', next: MARKET_PERIOD - t };
}

export function marketFactor(s: GameState): number {
  return s.rules?.marketCycle ? marketState(s).factor : 1;
}

const DAY_PERIOD = 180;

/** Ensoleillement du scénario « Nuit polaire » (phase 2 et suivantes). */
export function daylight(s: GameState): number {
  if (!s.rules?.polarNight || s.phase < 2) return 1;
  const d = Math.min(1, Math.max(0, 0.5 + 0.7 * Math.sin((2 * Math.PI * s.time) / DAY_PERIOD)));
  return Math.max(s.flags.batteries ? 0.6 : 0.05, d);
}
