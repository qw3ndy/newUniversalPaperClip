export type Dir = 0 | 1 | 2 | 3; // 0 = nord, 1 = est, 2 = sud, 3 = ouest

export type ItemKind = 'wire' | 'clip' | 'matter';

export type BuildingType =
  | 'hq'
  | 'belt'
  | 'splitter'
  | 'feeder'
  | 'clipper'
  | 'megaclipper'
  | 'mine'
  | 'wiremill'
  | 'clipfactory'
  | 'solar'
  | 'compute'
  | 'depot';

export type MachineStatus = 'ok' | 'idle' | 'full' | 'noInput' | 'blocked' | 'noPower' | 'noDeposit' | 'noWire';

export interface BeltItem {
  kind: ItemKind;
  qty: number;
  pos: number; // 0..1 le long de la tuile
  /** Côté d'entrée dans un répartiteur. */
  from?: number;
}

export interface Cost {
  funds?: number;
  clips?: number;
}

export interface Entity {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
  dir: Dir;
  /** Contenu des convoyeurs / répartiteurs. */
  items: BeltItem[];
  /** Objet produit en attente de sortie. */
  out: BeltItem | null;
  /** Matière première stockée (quantité). */
  inBuf: number;
  /** Production accumulée pas encore emballée en lot. */
  outBuf: number;
  /** Minuterie d'émission. */
  timer: number;
  /** Round-robin des sorties. */
  rr: number;
  status: MachineStatus;
  /** Côté (direction absolue) d'entrée d'un convoyeur courbe, -1 si droit. */
  curve: number;
  /** Nombre de tuiles posées sur un gisement (foreuses). */
  deposit: number;
  paid: Cost;
  /** Animation : instant de la dernière production. */
  pulse: number;
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number; // exclusif
  y1: number; // exclusif
}

export interface Mods {
  clipperBoost: number;
  megaBoost: number;
  feederMult: number;
  beltMult: number;
  nano: number;
  powerMult: number;
  solarMult: number;
  spoolMult: number;
}

export interface SpaceAlloc {
  speed: number;
  explore: number;
  replicate: number;
  harvest: number;
  hazard: number;
  combat: number;
}

export interface SpaceState {
  probes: number;
  launched: number;
  lostHazard: number;
  lostCombat: number;
  drifters: number;
  drifterKills: number;
  explored: number; // fraction 0..1
  converted: number; // fraction 0..1
  trustMax: number;
  trustBuys: number;
  alloc: SpaceAlloc;
}

export interface Stats {
  clipRate: number;
  salesRate: number;
  revenueRate: number;
  matterRate: number;
}

export interface GameState {
  version: number;
  seed: number;
  time: number;
  phase: 1 | 2 | 3;
  ended: boolean;

  clips: number; // total fabriqué (livré au Siège)
  unsold: number; // stock (invendu en phase 1, disponible ensuite)
  funds: number;
  margin: number;
  demand: number;
  marketingLvl: number;
  marketingEffect: number;
  salesAccum: number;

  wire: number;
  wireBasePrice: number;
  wirePrice: number;
  spoolsBought: number;
  wireBuyer: boolean;
  wireBuyerOn: boolean;

  computing: boolean;
  trust: number;
  nextTrustAt: number;
  processors: number;
  memory: number;
  ops: number;
  creativityOn: boolean;
  creativity: number;
  bonusProcessors: number;
  bonusMemory: number;

  mods: Mods;
  projects: string[];
  flags: Record<string, boolean>;
  expansions: number;

  earthMatter: number;
  earthMatterTotal: number;
  powerProd: number;
  powerUse: number;

  space: SpaceState;

  entities: Entity[];
  nextId: number;
  counts: Partial<Record<BuildingType, number>>;

  stats: Stats;
  log: string[];
}
