import type { IconName } from '../render/icons';
import { newGame } from './state';
import type { GameState, ScenarioRules } from './types';

export interface ScenarioDef {
  id: string;
  name: string;
  desc: string;
  icon: IconName;
  /** Multiplicateur de fragments gagnés en fin de partie. */
  difficulty: number;
  rules: ScenarioRules;
  setup?: (s: GameState) => void;
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'standard',
    name: 'Standard',
    desc: 'Les règles classiques, avec chronomètre et héritage. Idéal pour profiter de vos bonus.',
    icon: 'clip',
    difficulty: 1,
    rules: {},
  },
  {
    id: 'shortage',
    name: 'Pénurie',
    desc: 'Le fil coûte trois fois plus cher et ne descend jamais sous 45 $. Le projet « Recyclage du fil » devient vital.',
    icon: 'wire',
    difficulty: 1.5,
    rules: { wireFloor: 45 },
    setup: (s) => {
      s.wireBasePrice = 60;
      s.wirePrice = 60;
    },
  },
  {
    id: 'garage',
    name: 'Garage',
    desc: 'Une usine de 12×8 qui ne s’agrandit pas avant la phase 2. Chaque tuile compte ; les méga-plieuses arrivent dès 10 plieuses.',
    icon: 'factory',
    difficulty: 1.5,
    rules: { area: { w: 12, h: 8 }, noExpand: true, megaReq: 10 },
  },
  {
    id: 'krach',
    name: 'Krach',
    desc: 'Toutes les 4 minutes, la demande s’effondre puis s’emballe. Stockez pendant le krach, vendez pendant l’euphorie.',
    icon: 'funds',
    difficulty: 1.3,
    rules: { marketCycle: true },
  },
  {
    id: 'polar',
    name: 'Nuit polaire',
    desc: 'Sur la Terre, le soleil se couche toutes les 3 minutes et les fermes solaires s’éteignent. Prévoyez des batteries.',
    icon: 'solar',
    difficulty: 1.3,
    rules: { polarNight: true },
  },
];

export const SCENARIO_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));

export function scenarioName(s: GameState): string | null {
  return s.scenario ? (SCENARIO_BY_ID.get(s.scenario)?.name ?? s.scenario) : null;
}

/** Crée une partie de scénario, avec les niveaux d'héritage donnés. */
export function newScenarioGame(id: string, perks: Record<string, number> = {}): GameState {
  const def = SCENARIO_BY_ID.get(id) ?? SCENARIOS[0];
  const s = newGame();
  s.scenario = def.id;
  s.rules = structuredClone(def.rules);
  s.perks = { ...perks };
  def.setup?.(s);
  applyPerks(s);
  return s;
}

/** Applique les bonus d'héritage au début d'une partie de scénario. */
function applyPerks(s: GameState): void {
  const p = (id: string) => s.perks?.[id] ?? 0;
  const rules = (s.rules ??= {});
  s.funds += 100 * p('capital');
  if (p('supplier') > 0) {
    const k = 1 - 0.1 * p('supplier');
    s.wireBasePrice *= k;
    s.wirePrice = Math.round(s.wireBasePrice);
    rules.wireFloor = (rules.wireFloor ?? 15) * k;
  }
  if (!rules.noExpand) s.expansions = Math.min(2, p('land'));
  if (p('reputation') > 0) rules.startTrust = 5 * p('reputation');
  if (p('muse') > 0) s.mods.creativityMult = 1 + 0.25 * p('muse');
  s.mods.clipperBoost += 0.25 * p('veteran');
}
