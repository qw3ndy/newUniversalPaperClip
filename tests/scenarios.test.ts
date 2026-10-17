import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HQ_X, HQ_Y } from '../src/game/constants';
import { stepEconomy } from '../src/game/economy';
import { Game } from '../src/game/game';
import { buyPerk, emptyLegacy, fragmentsFor, payOut, PERKS } from '../src/game/legacy';
import { availableProjects, buyProject } from '../src/game/projects';
import { daylight, demandOf, marketState } from '../src/game/rules';
import {
  getActiveSlot,
  hasSave,
  hydrate,
  loadLegacy,
  loadLocal,
  saveLegacy,
  saveLocal,
  setActiveSlot,
} from '../src/game/save';
import { newScenarioGame, SCENARIOS } from '../src/game/scenarios';
import { updatePower } from '../src/game/sim';
import { newGame } from '../src/game/state';
import { mulberry32 } from '../src/game/world';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const run = (g: Game, sec: number) => {
  for (let i = 0; i < sec * 60; i++) g.tick(1 / 60);
};

const SCENARIO_ONLY = ['recycle', 'hedge', 'batteries'];

describe('parties classiques déjà commencées', () => {
  const realRandom = Math.random;
  afterEach(() => {
    Math.random = realRandom;
  });

  // Les fixtures ont été produites par le code de la v1.0 : une sauvegarde, puis
  // les valeurs obtenues en la faisant tourner 10 minutes avec ce même code.
  for (const [save, expected, seed] of [
    ['v1-phase1.json', 'v1-phase1-expected.json', 99],
    ['v1-phase2.json', 'v1-phase2-expected.json', 100],
  ] as const) {
    it(`évoluent exactement comme en v1.0 (${save})`, () => {
      const loaded = hydrate(JSON.parse(fixture(save)));
      expect(loaded).not.toBeNull();
      const g = new Game(loaded!.state);
      expect(g.s.scenario).toBeUndefined();
      Math.random = mulberry32(seed);
      run(g, 600);
      const s = g.s;
      const got = {
        time: s.time,
        clips: s.clips,
        unsold: s.unsold,
        funds: s.funds,
        wire: s.wire,
        trust: s.trust,
        ops: s.ops,
        creativity: s.creativity,
        earthMatter: s.earthMatter,
        items: s.entities.reduce((n, e) => n + e.items.length, 0),
        probes: s.space.probes,
        explored: s.space.explored,
      };
      expect(got).toEqual(JSON.parse(fixture(expected)));
    });
  }

  it('ne voient jamais les nouveautés des scénarios', () => {
    const s = newGame(1);
    expect('scenario' in s || 'rules' in s || 'perks' in s).toBe(false);
    expect(s.mods.creativityMult).toBeUndefined();
    // Même avec tout débloqué, aucun projet de scénario n'apparaît.
    s.computing = true;
    s.flags.opsMaxed = true;
    for (const phase of [1, 2, 3] as const) {
      s.phase = phase;
      const ids = availableProjects(s).map((p) => p.id);
      for (const id of SCENARIO_ONLY) expect(ids).not.toContain(id);
    }
    expect(marketState(s).factor).toBe(1);
    expect(daylight(s)).toBe(1);
  });
});

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe('emplacements de sauvegarde', () => {
  let mem: MemoryStorage;
  beforeEach(() => {
    mem = new MemoryStorage();
    (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = mem;
  });
  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: MemoryStorage }).localStorage;
  });

  it('la partie classique garde sa clé d’origine et n’est jamais écrasée par un scénario', () => {
    // Une sauvegarde existante, écrite par la v1.0.
    mem.setItem('trombones-universels:save', fixture('v1-phase1.json'));
    expect(getActiveSlot()).toBe('classic');
    const before = mem.getItem('trombones-universels:save');

    const sc = newScenarioGame('garage');
    saveLocal(sc);
    setActiveSlot('scenario');
    expect(mem.getItem('trombones-universels:save')).toBe(before);
    expect(hasSave('scenario')).toBe(true);

    expect(loadLocal('classic')!.state.scenario).toBeUndefined();
    expect(loadLocal('scenario')!.state.scenario).toBe('garage');
    expect(getActiveSlot()).toBe('scenario');
  });

  it('un scénario rangé par erreur dans l’emplacement classique n’y est pas chargé', () => {
    mem.setItem('trombones-universels:save', JSON.stringify({ savedAt: 0, state: newScenarioGame('krach') }));
    expect(loadLocal('classic')).toBeNull();
  });

  it('l’héritage est stocké à part', () => {
    const l = emptyLegacy();
    l.fragments = 12;
    saveLegacy(l);
    expect(loadLegacy().fragments).toBe(12);
    expect(mem.getItem('trombones-universels:save')).toBeNull();
  });
});

describe('scénarios', () => {
  it('chaque scénario démarre et produit', () => {
    for (const d of SCENARIOS) {
      const g = new Game(newScenarioGame(d.id));
      g.s.funds = 50;
      expect(g.world.place('clipper', HQ_X - 1, HQ_Y, 1)).not.toBeNull();
      run(g, 10);
      expect(g.s.clips, d.id).toBeGreaterThan(5);
      expect(g.s.scenario).toBe(d.id);
    }
  });

  it('Garage : zone 12×8 sans extension, méga-plieuses à 10 plieuses', () => {
    const g = new Game(newScenarioGame('garage'));
    const a = g.world.buildArea();
    expect([a.x1 - a.x0, a.y1 - a.y0]).toEqual([12, 8]);
    const s = g.s;
    s.counts.clipper = 10;
    s.computing = true;
    const ids = availableProjects(s).map((p) => p.id);
    expect(ids).toContain('mega');
    expect(ids).not.toContain('expand1');
  });

  it('Pénurie : fil cher avec plancher, que le recyclage abaisse', () => {
    const g = new Game(newScenarioGame('shortage'));
    const s = g.s;
    expect(s.wirePrice).toBeGreaterThanOrEqual(50);
    for (let i = 0; i < 20000; i++) stepEconomy(g.world, 1);
    expect(s.wireBasePrice).toBeGreaterThan(44);
    s.computing = true;
    s.memory = 5;
    s.ops = 5000;
    expect(buyProject(g.world, 'recycle')).toBe(true);
    expect(s.rules!.wireFloor).toBeCloseTo(27);
  });

  it('Krach : la demande s’effondre puis s’emballe', () => {
    const s = newScenarioGame('krach');
    const base = (t: number) => {
      s.time = t;
      return demandOf(s);
    };
    const normal = base(10);
    expect(base(160) / normal).toBeCloseTo(0.25);
    expect(base(210) / normal).toBeCloseTo(2);
    s.flags.hedge = true;
    expect(base(160) / normal).toBeCloseTo(0.6);
  });

  it('Nuit polaire : les fermes solaires s’éteignent la nuit en phase 2', () => {
    const g = new Game(newScenarioGame('polar'));
    const s = g.s;
    expect(daylight(s)).toBe(1); // pas en phase 1
    s.phase = 2;
    s.unsold = 1e6;
    g.world.place('solar', HQ_X - 4, HQ_Y, 1);
    s.time = 45; // midi
    updatePower(g.world);
    const day = s.powerProd;
    s.time = 135; // minuit
    updatePower(g.world);
    expect(s.powerProd).toBeLessThan(day * 0.1);
    s.flags.batteries = true;
    updatePower(g.world);
    expect(s.powerProd).toBeCloseTo(day * 0.6);
  });
});

describe('héritage', () => {
  it('les fragments sont versés une seule fois, avec le record', () => {
    const l = emptyLegacy();
    const s = newScenarioGame('shortage');
    expect(payOut(l, s)).toBe(0); // partie pas finie
    s.ended = true;
    s.time = 90 * 60;
    const n = payOut(l, s);
    expect(n).toBe(fragmentsFor(s));
    expect(n).toBe(Math.round(1.5 * (40 + 5)));
    expect(payOut(l, s)).toBe(0);
    expect(l.records.shortage).toBe(90 * 60);
    expect(l.runs).toBe(1);
    // Jamais de fragments pour une partie classique.
    const c = newGame(1);
    c.ended = true;
    expect(payOut(l, c)).toBe(0);
  });

  it('les bonus s’achètent et s’appliquent aux nouveaux scénarios seulement', () => {
    const l = emptyLegacy();
    l.fragments = 1000;
    for (const p of PERKS) while (buyPerk(l, p.id));
    for (const p of PERKS) expect(l.perks[p.id]).toBe(p.max);
    expect(buyPerk(l, 'capital')).toBe(false);

    const s = newScenarioGame('standard', l.perks);
    expect(s.funds).toBe(500);
    expect(s.wirePrice).toBe(14);
    expect(s.expansions).toBe(2);
    expect(s.mods.clipperBoost).toBe(2);
    expect(s.mods.creativityMult).toBe(2);
    expect(s.rules!.startTrust).toBe(20);
    // Garage ignore le terrain hérité.
    expect(newScenarioGame('garage', l.perks).expansions).toBe(0);
    // La réputation s'ajoute au déblocage du calcul.
    const g = new Game(s);
    g.s.clips = 2500;
    run(g, 0.1);
    expect(g.s.trust).toBe(22);
  });
});
