import type { IconName } from '../render/icons';
import { SCENARIO_BY_ID } from './scenarios';
import type { GameState } from './types';

/** Progression conservée d'une partie de scénario à l'autre. */
export interface Legacy {
  fragments: number;
  perks: Record<string, number>;
  /** Meilleur temps (secondes) par scénario. */
  records: Record<string, number>;
  runs: number;
}

export interface PerkDef {
  id: string;
  name: string;
  desc: (level: number) => string;
  icon: IconName;
  max: number;
  base: number;
}

export const PERKS: PerkDef[] = [
  { id: 'capital', name: 'Capital de départ', desc: (l) => `Commencer avec ${100 * l} $.`, icon: 'funds', max: 5, base: 5 },
  { id: 'supplier', name: 'Fournisseur fidèle', desc: (l) => `Fil ${10 * l} % moins cher.`, icon: 'wire', max: 3, base: 6 },
  { id: 'land', name: 'Terrain hérité', desc: (l) => `Démarrer avec ${l} extension${l > 1 ? 's' : ''} d’usine.`, icon: 'factory', max: 2, base: 8 },
  { id: 'reputation', name: 'Réputation', desc: (l) => `+${5 * l} confiance au déblocage du calcul.`, icon: 'trust', max: 4, base: 10 },
  { id: 'muse', name: 'Muse algorithmique', desc: (l) => `Créativité +${25 * l} %.`, icon: 'creativity', max: 4, base: 8 },
  { id: 'veteran', name: 'Plieuses vétérans', desc: (l) => `Plieuses +${25 * l} % de vitesse.`, icon: 'clipper', max: 4, base: 5 },
];

export const PERK_BY_ID = new Map(PERKS.map((p) => [p.id, p]));

export function emptyLegacy(): Legacy {
  return { fragments: 0, perks: {}, records: {}, runs: 0 };
}

export function perkCost(p: PerkDef, level: number): number {
  return p.base * (level + 1);
}

export function buyPerk(l: Legacy, id: string): boolean {
  const p = PERK_BY_ID.get(id);
  if (!p) return false;
  const lvl = l.perks[id] ?? 0;
  if (lvl >= p.max) return false;
  const c = perkCost(p, lvl);
  if (l.fragments < c) return false;
  l.fragments -= c;
  l.perks[id] = lvl + 1;
  return true;
}

/** Fragments gagnés en terminant une partie de scénario : plus c'est dur et rapide, plus on gagne. */
export function fragmentsFor(s: GameState): number {
  const diff = SCENARIO_BY_ID.get(s.scenario ?? '')?.difficulty ?? 1;
  const minutes = s.time / 60;
  const speed = Math.max(0, 120 - minutes) / 6; // jusqu'à +20 sous les 2 h
  return Math.round(diff * (40 + speed));
}

/**
 * Verse les fragments d'une partie terminée (une seule fois) et met à jour le record.
 * Retourne le nombre de fragments versés, ou 0 si c'était déjà fait.
 */
export function payOut(l: Legacy, s: GameState): number {
  if (!s.scenario || !s.ended || s.flags.legacyPaid) return 0;
  const n = fragmentsFor(s);
  s.flags.legacyPaid = true;
  l.fragments += n;
  l.runs++;
  const best = l.records[s.scenario];
  if (best === undefined || s.time < best) l.records[s.scenario] = s.time;
  return n;
}
