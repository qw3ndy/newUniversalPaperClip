import { EARTH_MATTER, HQ_X, HQ_Y, SAVE_VERSION } from './constants';
import type { BuildingType, Dir, Entity, GameState } from './types';

export function makeEntity(id: number, type: BuildingType, x: number, y: number, dir: Dir): Entity {
  return {
    id,
    type,
    x,
    y,
    dir,
    items: [],
    out: null,
    inBuf: 0,
    outBuf: 0,
    timer: 0,
    rr: 0,
    status: 'idle',
    curve: -1,
    deposit: 0,
    paid: {},
    pulse: -10,
  };
}

export function newGame(seed = (Math.random() * 2 ** 31) | 0): GameState {
  const hq = makeEntity(1, 'hq', HQ_X, HQ_Y, 1);
  // Un distributeur offert, orienté vers le Siège : il ne manque qu'une plieuse entre les deux.
  const feeder = makeEntity(2, 'feeder', HQ_X - 2, HQ_Y, 1);
  return {
    version: SAVE_VERSION,
    seed,
    time: 0,
    phase: 1,
    ended: false,

    clips: 0,
    unsold: 0,
    funds: 0,
    margin: 0.25,
    demand: 0,
    marketingLvl: 1,
    marketingEffect: 1,
    salesAccum: 0,

    wire: 1000,
    wireBasePrice: 20,
    wirePrice: 20,
    spoolsBought: 0,
    wireBuyer: false,
    wireBuyerOn: true,

    computing: false,
    trust: 0,
    nextTrustAt: 2000,
    processors: 0,
    memory: 0,
    ops: 0,
    creativityOn: false,
    creativity: 0,
    bonusProcessors: 0,
    bonusMemory: 0,

    mods: {
      clipperBoost: 1,
      megaBoost: 1,
      feederMult: 1,
      beltMult: 1,
      nano: 1,
      powerMult: 1,
      solarMult: 1,
      spoolMult: 1,
    },
    projects: [],
    flags: {},
    expansions: 0,

    earthMatter: EARTH_MATTER,
    earthMatterTotal: EARTH_MATTER,
    powerProd: 0,
    powerUse: 0,

    space: {
      probes: 0,
      launched: 0,
      lostHazard: 0,
      lostCombat: 0,
      drifters: 0,
      drifterKills: 0,
      explored: 0,
      converted: 0,
      trustMax: 20,
      trustBuys: 0,
      alloc: { speed: 3, explore: 3, replicate: 6, harvest: 4, hazard: 2, combat: 2 },
    },

    entities: [hq, feeder],
    nextId: 3,
    counts: { hq: 1, feeder: 1 },

    stats: { clipRate: 0, salesRate: 0, revenueRate: 0, matterRate: 0 },
    log: [],
  };
}
