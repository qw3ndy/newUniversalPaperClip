import type { BuildingType, Dir } from './types';

export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const opp = (d: number): Dir => ((d + 2) % 4) as Dir;
export const rotCW = (d: number): Dir => ((d + 1) % 4) as Dir;
export const rotCCW = (d: number): Dir => ((d + 3) % 4) as Dir;

export const SAVE_VERSION = 1;
export const TICK = 1 / 60;

export const MAP_W = 96;
export const MAP_H = 96;
/** Coin haut-gauche du Siège (2x2). */
export const HQ_X = 47;
export const HQ_Y = 47;

/** Zones constructibles en phase 1 (rayons autour du Siège), agrandies par projets. */
export const EXPANSIONS: { w: number; h: number }[] = [
  { w: 16, h: 12 },
  { w: 24, h: 16 },
  { w: 32, h: 22 },
  { w: 42, h: 28 },
];

export const BELT_SPACING = 0.34;
export const BELT_BASE_SPEED = 2; // tuiles / s
export const EMIT_INTERVAL = 0.4; // s entre deux lots en sortie de machine
export const BUFFER_SECONDS = 4;

export const TRUST_TO_RELEASE = 100;
export const TRUST_RATIO = 1.35;
export const COMPUTING_AT = 2000;

export const EARTH_MATTER = 1.5e11;
export const UNIVERSE_MATTER = 3e55;
export const PROBE_COST = 5e8;

export interface BuildingDef {
  type: BuildingType;
  name: string;
  /** Nom court pour la barre de construction. */
  short: string;
  desc: string;
  size: number;
  /** Phases où le bâtiment peut être construit. */
  phases: number[];
  /** Consommation électrique de base (MW), phase 2+. */
  power: number;
  body: string;
  accent: string;
  rotatable: boolean;
}

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  hq: {
    type: 'hq',
    name: 'Siège',
    short: 'Siège',
    desc: 'Reçoit trombones et fil. Cliquez dessus pour plier un trombone à la main.',
    size: 2,
    phases: [],
    power: 0,
    body: '#2b3550',
    accent: '#ffcf5c',
    rotatable: false,
  },
  belt: {
    type: 'belt',
    name: 'Convoyeur',
    short: 'Convoyeur',
    desc: 'Transporte les objets. Glissez pour tracer une ligne ; il se raccorde tout seul.',
    size: 1,
    phases: [1, 2, 3],
    power: 0,
    body: '#262c3b',
    accent: '#8aa0c8',
    rotatable: true,
  },
  splitter: {
    type: 'splitter',
    name: 'Répartiteur',
    short: 'Répartiteur',
    desc: 'Reçoit par n’importe quel côté et redistribue à tour de rôle vers les trois autres. Alignez-en plusieurs pour alimenter une rangée de machines.',
    size: 1,
    phases: [1, 2, 3],
    power: 0,
    body: '#34405e',
    accent: '#7fd1ff',
    rotatable: false,
  },
  feeder: {
    type: 'feeder',
    name: 'Distributeur de fil',
    short: 'Distributeur',
    desc: 'Puise dans le stock de fil du Siège et envoie des bobines devant lui.',
    size: 1,
    phases: [1, 2, 3],
    power: 0,
    body: '#5a3a26',
    accent: '#ff9d4d',
    rotatable: true,
  },
  clipper: {
    type: 'clipper',
    name: 'Plieuse',
    short: 'Plieuse',
    desc: 'Transforme le fil en trombones. Entrée : n’importe quel côté sauf l’avant.',
    size: 1,
    phases: [1, 2, 3],
    power: 0,
    body: '#2f4b5e',
    accent: '#cfe6ff',
    rotatable: true,
  },
  megaclipper: {
    type: 'megaclipper',
    name: 'Méga-plieuse',
    short: 'Méga',
    desc: 'Une plieuse 2×2, cinquante fois plus rapide.',
    size: 2,
    phases: [1, 2, 3],
    power: 0,
    body: '#253f63',
    accent: '#9fd4ff',
    rotatable: true,
  },
  mine: {
    type: 'mine',
    name: 'Foreuse',
    short: 'Foreuse',
    desc: 'À poser sur un gisement : extrait la matière de la Terre. Plus elle couvre de gisement, plus elle est rapide.',
    size: 2,
    phases: [2, 3],
    power: 2,
    body: '#3e2f5c',
    accent: '#c59bff',
    rotatable: true,
  },
  wiremill: {
    type: 'wiremill',
    name: 'Tréfilerie',
    short: 'Tréfilerie',
    desc: 'Transforme la matière en fil.',
    size: 2,
    phases: [2, 3],
    power: 2,
    body: '#5c3a2a',
    accent: '#ffb27a',
    rotatable: true,
  },
  clipfactory: {
    type: 'clipfactory',
    name: 'Usine à trombones',
    short: 'Usine',
    desc: 'Une usine 3×3 qui transforme d’énormes quantités de fil en trombones.',
    size: 3,
    phases: [2, 3],
    power: 8,
    body: '#24435a',
    accent: '#a6f0ff',
    rotatable: true,
  },
  solar: {
    type: 'solar',
    name: 'Ferme solaire',
    short: 'Solaire',
    desc: 'Produit de l’énergie pour les machines de la phase planétaire.',
    size: 2,
    phases: [2, 3],
    power: 0,
    body: '#1f3b4f',
    accent: '#ffe066',
    rotatable: false,
  },
  compute: {
    type: 'compute',
    name: 'Centre de calcul',
    short: 'Calcul',
    desc: '+2 processeurs et +4 mémoire tant qu’il est alimenté.',
    size: 2,
    phases: [2, 3],
    power: 5,
    body: '#21324a',
    accent: '#7dffb2',
    rotatable: false,
  },
  depot: {
    type: 'depot',
    name: 'Entrepôt',
    short: 'Entrepôt',
    desc: 'Un point de collecte : reçoit trombones et fil comme le Siège.',
    size: 2,
    phases: [2, 3],
    power: 0,
    body: '#2e3448',
    accent: '#ffcf5c',
    rotatable: false,
  },
};

/** Ordre d'affichage dans la barre de construction. */
export const HOTBAR: BuildingType[] = [
  'belt',
  'splitter',
  'feeder',
  'clipper',
  'megaclipper',
  'mine',
  'wiremill',
  'clipfactory',
  'solar',
  'compute',
  'depot',
];
