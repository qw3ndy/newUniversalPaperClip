import { describe, expect, it } from 'vitest';
import { HQ_X, HQ_Y } from '../src/game/constants';
import { buyWire, changePrice, makeClipByHand } from '../src/game/economy';
import { Game } from '../src/game/game';
import { buyProject, PROJECTS } from '../src/game/projects';
import { hydrate, serialize } from '../src/game/save';
import { newGame } from '../src/game/state';

function run(g: Game, seconds: number) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) g.tick(dt);
}

describe('usine', () => {
  it('la chaîne distributeur → plieuse → Siège produit des trombones', () => {
    const g = new Game(newGame(42));
    g.s.funds = 100;
    const c = g.world.place('clipper', HQ_X - 1, HQ_Y, 1);
    expect(c).not.toBeNull();
    run(g, 20);
    expect(g.s.clips).toBeGreaterThan(15);
    expect(g.s.clips).toBeLessThan(25);
  });

  it('les convoyeurs transportent les objets, y compris dans les virages', () => {
    const g = new Game(newGame(1));
    const w = g.world;
    g.s.funds = 1000;
    // Distributeur offert en (HQ_X-2, HQ_Y) orienté est : on le remplace par un circuit en L.
    const feeder = w.at(HQ_X - 2, HQ_Y)!;
    w.remove(feeder);
    // Distributeur au nord, descend vers le sud puis tourne à l'est vers une plieuse collée au Siège.
    expect(w.place('feeder', HQ_X - 4, HQ_Y - 3, 2)).not.toBeNull();
    for (let y = HQ_Y - 2; y < HQ_Y; y++) expect(w.place('belt', HQ_X - 4, y, 2)).not.toBeNull();
    expect(w.place('belt', HQ_X - 4, HQ_Y, 1)).not.toBeNull();
    expect(w.place('belt', HQ_X - 3, HQ_Y, 1)).not.toBeNull();
    expect(w.place('belt', HQ_X - 2, HQ_Y, 1)).not.toBeNull();
    expect(w.place('clipper', HQ_X - 1, HQ_Y, 1)).not.toBeNull();
    const corner = w.at(HQ_X - 4, HQ_Y)!;
    expect(corner.curve).toBe(0); // entre par le nord
    run(g, 30);
    expect(g.s.clips).toBeGreaterThan(20);
  });

  it('le répartiteur alimente plusieurs plieuses', () => {
    const g = new Game(newGame(3));
    const w = g.world;
    g.s.funds = 1000;
    w.remove(w.at(HQ_X - 2, HQ_Y)!);
    // distributeur → répartiteur, qui alimente deux plieuses (nord et sud) qui renvoient vers l'est.
    expect(w.place('feeder', HQ_X - 4, HQ_Y + 1, 1)).not.toBeNull();
    expect(w.place('splitter', HQ_X - 3, HQ_Y + 1, 1)).not.toBeNull();
    expect(w.place('clipper', HQ_X - 3, HQ_Y, 1)).not.toBeNull();
    expect(w.place('clipper', HQ_X - 3, HQ_Y + 2, 1)).not.toBeNull();
    expect(w.place('belt', HQ_X - 2, HQ_Y, 1)).not.toBeNull();
    expect(w.place('belt', HQ_X - 1, HQ_Y, 1)).not.toBeNull();
    expect(w.place('belt', HQ_X - 2, HQ_Y + 2, 0)).not.toBeNull();
    expect(w.place('belt', HQ_X - 2, HQ_Y + 1, 1)).not.toBeNull();
    expect(w.place('belt', HQ_X - 1, HQ_Y + 1, 1)).not.toBeNull();
    run(g, 30);
    // Deux plieuses à 1/s pendant ~30 s.
    expect(g.s.clips).toBeGreaterThan(45);
  });

  it('une rangée de répartiteurs alimente une rangée de plieuses', () => {
    const g = new Game(newGame(4));
    const w = g.world;
    g.s.funds = 1e4;
    g.s.expansions = 1;
    w.remove(w.at(HQ_X - 2, HQ_Y)!);
    // Distributeur → 6 répartiteurs vers l'est (rangée y-1) ; plieuses dessous orientées vers un collecteur (rangée y).
    const y = HQ_Y;
    expect(w.place('feeder', HQ_X - 8, y - 1, 1)).not.toBeNull();
    for (let x = HQ_X - 7; x <= HQ_X - 2; x++) expect(w.place('splitter', x, y - 1, 1)).not.toBeNull();
    for (let x = HQ_X - 7; x <= HQ_X - 2; x++) expect(w.place('clipper', x, y, 2)).not.toBeNull();
    for (let x = HQ_X - 7; x <= HQ_X - 1; x++) expect(w.place('belt', x, y + 1, 1)).not.toBeNull();
    run(g, 40);
    // 6 plieuses à 1/s pendant ~35 s utiles.
    expect(g.s.clips).toBeGreaterThan(150);
  });

  it('suppression = remboursement exact', () => {
    const g = new Game(newGame(5));
    g.s.funds = 50;
    const e = g.world.place('clipper', HQ_X - 1, HQ_Y, 1)!;
    const after = g.s.funds;
    expect(after).toBeLessThan(50);
    g.world.remove(e);
    expect(g.s.funds).toBeCloseTo(50);
    expect(g.world.remove(g.world.at(HQ_X, HQ_Y)!)).toBe(false); // le Siège est indestructible
  });

  it('refuse les placements invalides', () => {
    const g = new Game(newGame(5));
    g.s.funds = 1e6;
    expect(g.world.canPlace('clipper', HQ_X, HQ_Y, 1).ok).toBe(false); // sur le Siège
    expect(g.world.canPlace('clipper', 2, 2, 1).ok).toBe(false); // hors zone
    expect(g.world.canPlace('megaclipper', HQ_X - 6, HQ_Y, 1).ok).toBe(false); // pas débloqué
    g.s.funds = 0;
    expect(g.world.canPlace('clipper', HQ_X - 1, HQ_Y, 1).ok).toBe(false); // trop cher
    expect(g.world.canPlace('belt', HQ_X - 1, HQ_Y, 1).ok).toBe(true); // gratuit
  });
});

describe('économie', () => {
  it('fabrication manuelle, vente et achat de fil', () => {
    const g = new Game(newGame(7));
    const w = g.world;
    for (let i = 0; i < 200; i++) makeClipByHand(w);
    expect(g.s.clips).toBe(200);
    changePrice(w, -0.2); // 0,05 $ : forte demande
    run(g, 20);
    expect(g.s.unsold).toBeLessThan(200);
    expect(g.s.funds).toBeGreaterThan(0);
    g.s.funds = 100;
    const wire = g.s.wire;
    expect(buyWire(w)).toBe(true);
    expect(g.s.wire).toBe(wire + 1000);
  });

  it('les ressources de calcul se débloquent à 2 000 trombones', () => {
    const g = new Game(newGame(8));
    g.s.clips = 2500;
    run(g, 1);
    expect(g.s.computing).toBe(true);
    expect(g.s.trust).toBe(2);
    run(g, 120);
    expect(g.s.ops).toBe(1000);
    expect(g.s.flags.opsMaxed).toBe(true);
  });

  it('les projets se paient et appliquent leur effet', () => {
    const g = new Game(newGame(9));
    g.s.computing = true;
    g.s.flags.opsMaxed = true;
    g.s.memory = 2;
    g.s.ops = 2000;
    expect(buyProject(g.world, 'creativity')).toBe(true);
    expect(g.s.creativityOn).toBe(true);
    expect(g.s.ops).toBe(1000);
    expect(buyProject(g.world, 'creativity')).toBe(false);
  });

  it('chaque projet a un identifiant unique', () => {
    const ids = PROJECTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('phases', () => {
  it('libérer les HypnoDrones ouvre la phase planétaire', () => {
    const g = new Game(newGame(10));
    const s = g.s;
    s.projects.push('hypnodrones');
    s.flags.hypnodrones = true;
    s.trust = 100;
    s.funds = 1000;
    expect(buyProject(g.world, 'release')).toBe(true);
    expect(s.phase).toBe(2);
    expect(s.wire).toBeGreaterThan(100000);
    // Une foreuse sur un gisement + énergie → matière extraite.
    s.unsold = 1e6;
    let mined = false;
    for (let y = 0; y < 96 && !mined; y++)
      for (let x = 0; x < 96 && !mined; x++)
        if (g.world.depositUnder('mine', x, y) === 4 && g.world.canPlace('mine', x, y, 1).ok) {
          g.world.place('mine', x, y, 1);
          mined = true;
        }
    expect(mined).toBe(true);
    let placedSolar = false;
    for (let y = 30; y < 60 && !placedSolar; y++)
      for (let x = 30; x < 60 && !placedSolar; x++) if (g.world.place('solar', x, y, 1)) placedSolar = true;
    expect(placedSolar).toBe(true);
    const before = s.earthMatter;
    run(g, 5);
    expect(s.earthMatter).toBeLessThan(before);
  });

  it('la sauvegarde fait un aller-retour', () => {
    const g = new Game(newGame(11));
    g.s.funds = 20;
    g.world.place('clipper', HQ_X - 1, HQ_Y, 1);
    run(g, 5);
    const back = hydrate(JSON.parse(serialize(g.s)));
    expect(back).not.toBeNull();
    const g2 = new Game(back!.state);
    expect(g2.s.entities.length).toBe(g.s.entities.length);
    expect(g2.world.at(HQ_X - 1, HQ_Y)?.type).toBe('clipper');
    run(g2, 5);
    expect(g2.s.clips).toBeGreaterThan(g.s.clips);
  });
});
