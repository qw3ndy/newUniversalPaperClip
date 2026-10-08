import { EXPANSIONS, TRUST_TO_RELEASE } from './constants';
import { maxOps, spoolSize } from './rules';
import type { GameState } from './types';
import type { World } from './world';

export interface ProjectCost {
  ops?: number;
  creativity?: number;
  funds?: number;
  clips?: number;
}

export interface ProjectDef {
  id: string;
  title: string;
  desc: string;
  cost: ProjectCost;
  /** Confiance minimale requise (non dépensée). */
  needTrust?: number;
  req: (s: GameState) => boolean;
  effect: (w: World) => void;
  msg?: string;
}

const done = (s: GameState, id: string) => s.projects.includes(id);
const count = (s: GameState, t: keyof GameState['counts']) => s.counts[t] ?? 0;
const p1 = (s: GameState) => s.phase === 1;
const p2 = (s: GameState) => s.phase >= 2;

function addTrust(w: World, n: number): void {
  w.s.trust += n;
}

function releaseDrones(w: World): void {
  const s = w.s;
  const spools = Math.floor(s.funds / Math.max(1, s.wirePrice));
  const converted = spools * spoolSize(s);
  s.wire += converted + 100_000;
  s.funds = 0;
  s.phase = 2;
  s.wireBuyer = false;
  w.layoutVersion++;
  w.notify('Les HypnoDrones sont libérés. Les humains ne sont plus un facteur.', 'phase');
  w.notify(`Actifs liquidés : ${spools.toLocaleString('fr-FR')} bobines saisies, plus 100 000 pouces de réserves.`, 'phase');
  w.notify('La Terre entière est constructible. Posez des foreuses sur les gisements violets.', 'phase');
}

export const PROJECTS: ProjectDef[] = [
  // ——— Phase 1 : production ———
  {
    id: 'clipper1',
    title: 'Plieuses améliorées',
    desc: 'Les plieuses gagnent 25 % de vitesse.',
    cost: { ops: 750 },
    req: (s) => p1(s) && count(s, 'clipper') >= 1,
    effect: (w) => (w.s.mods.clipperBoost += 0.25),
  },
  {
    id: 'clipper2',
    title: 'Plieuses encore meilleures',
    desc: 'Les plieuses gagnent 50 % de vitesse.',
    cost: { ops: 2500 },
    req: (s) => done(s, 'clipper1'),
    effect: (w) => (w.s.mods.clipperBoost += 0.5),
  },
  {
    id: 'clipper3',
    title: 'Plieuses optimisées',
    desc: 'Les plieuses gagnent 75 % de vitesse.',
    cost: { ops: 5000 },
    req: (s) => done(s, 'clipper2'),
    effect: (w) => (w.s.mods.clipperBoost += 0.75),
  },
  {
    id: 'belt1',
    title: 'Convoyeurs rapides',
    desc: 'Les convoyeurs vont 50 % plus vite.',
    cost: { ops: 3000 },
    req: (s) => p1(s) && count(s, 'clipper') >= 5,
    effect: (w) => (w.s.mods.beltMult *= 1.5),
  },
  {
    id: 'feeder1',
    title: 'Bobinage rapide',
    desc: 'Les distributeurs envoient trois fois plus de fil.',
    cost: { ops: 4000 },
    req: (s) => p1(s) && count(s, 'clipper') >= 10,
    effect: (w) => (w.s.mods.feederMult *= 3),
  },
  {
    id: 'wire1',
    title: 'Extrusion de fil améliorée',
    desc: 'Chaque bobine contient 50 % de fil en plus.',
    cost: { ops: 1750 },
    req: (s) => p1(s) && s.spoolsBought >= 1,
    effect: (w) => (w.s.mods.spoolMult += 0.5),
  },
  {
    id: 'wire2',
    title: 'Extrusion de fil optimisée',
    desc: 'Chaque bobine contient 75 % de fil en plus.',
    cost: { ops: 3500 },
    req: (s) => done(s, 'wire1'),
    effect: (w) => (w.s.mods.spoolMult += 0.75),
  },
  {
    id: 'wire3',
    title: 'Microlaminage',
    desc: 'Chaque bobine contient 100 % de fil en plus.',
    cost: { ops: 7500 },
    req: (s) => done(s, 'wire2'),
    effect: (w) => (w.s.mods.spoolMult += 1),
  },
  {
    id: 'wire4',
    title: 'Recuit par écume spectrale',
    desc: 'Chaque bobine contient 200 % de fil en plus.',
    cost: { ops: 9000 },
    req: (s) => done(s, 'wire3') && s.trust >= 25,
    effect: (w) => (w.s.mods.spoolMult += 2),
  },
  {
    id: 'wire5',
    title: 'Recuit de mousse quantique',
    desc: 'Chaque bobine contient 1 000 % de fil en plus.',
    cost: { ops: 11000 },
    req: (s) => done(s, 'wire4') && s.trust >= 35,
    effect: (w) => (w.s.mods.spoolMult += 10),
  },
  {
    id: 'wirebuyer',
    title: 'Acheteur de fil automatique',
    desc: 'Achète une bobine dès que le stock de fil s’épuise.',
    cost: { ops: 7000 },
    req: (s) => p1(s) && s.spoolsBought >= 15,
    effect: (w) => {
      w.s.wireBuyer = true;
      w.s.wireBuyerOn = true;
    },
  },
  {
    id: 'expand1',
    title: 'Extension d’usine I',
    desc: `Agrandit la zone constructible à ${EXPANSIONS[1].w}×${EXPANSIONS[1].h}.`,
    cost: { funds: 400 },
    req: (s) => p1(s) && count(s, 'clipper') >= 4,
    effect: (w) => (w.s.expansions = 1),
  },
  {
    id: 'expand2',
    title: 'Extension d’usine II',
    desc: `Agrandit la zone constructible à ${EXPANSIONS[2].w}×${EXPANSIONS[2].h}.`,
    cost: { funds: 4000 },
    req: (s) => done(s, 'expand1') && count(s, 'clipper') >= 15,
    effect: (w) => (w.s.expansions = 2),
  },
  {
    id: 'expand3',
    title: 'Extension d’usine III',
    desc: `Agrandit la zone constructible à ${EXPANSIONS[3].w}×${EXPANSIONS[3].h}.`,
    cost: { funds: 30000 },
    req: (s) => done(s, 'expand2') && done(s, 'mega'),
    effect: (w) => (w.s.expansions = 3),
  },
  {
    id: 'hadwigerDiagrams',
    title: 'Diagrammes de trombones d’Hadwiger',
    desc: 'Les plieuses gagnent 500 % de vitesse.',
    cost: { ops: 6000 },
    req: (s) => done(s, 'hadwiger') && done(s, 'clipper3'),
    effect: (w) => (w.s.mods.clipperBoost += 5),
  },
  {
    id: 'mega',
    title: 'Méga-plieuses',
    desc: 'Débloque la méga-plieuse : 2×2, cinquante fois plus rapide.',
    cost: { ops: 8000 },
    req: (s) => p1(s) && count(s, 'clipper') >= 20,
    effect: (w) => (w.s.flags.mega = true),
    msg: 'Méga-plieuses disponibles dans la barre de construction.',
  },
  {
    id: 'mega1',
    title: 'Méga-plieuses améliorées',
    desc: 'Les méga-plieuses gagnent 25 % de vitesse.',
    cost: { ops: 9000 },
    req: (s) => done(s, 'mega') && count(s, 'megaclipper') >= 1,
    effect: (w) => (w.s.mods.megaBoost += 0.25),
  },
  {
    id: 'mega2',
    title: 'Méga-plieuses encore meilleures',
    desc: 'Les méga-plieuses gagnent 50 % de vitesse.',
    cost: { ops: 11000 },
    req: (s) => done(s, 'mega1'),
    effect: (w) => (w.s.mods.megaBoost += 0.5),
  },
  {
    id: 'mega3',
    title: 'Méga-plieuses optimisées',
    desc: 'Les méga-plieuses gagnent 100 % de vitesse.',
    cost: { ops: 13000 },
    req: (s) => done(s, 'mega2'),
    effect: (w) => (w.s.mods.megaBoost += 1),
  },
  {
    id: 'feeder2',
    title: 'Distributeurs industriels',
    desc: 'Les distributeurs envoient cinq fois plus de fil.',
    cost: { ops: 9000 },
    req: (s) => done(s, 'mega') && done(s, 'feeder1'),
    effect: (w) => (w.s.mods.feederMult *= 5),
  },

  // ——— Phase 1 : calcul & créativité ———
  {
    id: 'creativity',
    title: 'Créativité',
    desc: 'Quand les opérations sont au maximum, les processeurs génèrent de la créativité.',
    cost: { ops: 1000 },
    req: (s) => s.computing && !!s.flags.opsMaxed,
    effect: (w) => (w.s.creativityOn = true),
    msg: 'Créativité débloquée. Laissez vos opérations au maximum pour en produire.',
  },
  {
    id: 'limerick',
    title: 'Limerick',
    desc: 'Algorithmiquement généré, poème de cinq vers. +1 confiance.',
    cost: { creativity: 10 },
    req: (s) => s.creativityOn,
    effect: (w) => addTrust(w, 1),
    msg: 'Il était un trombone en fil / qui rêvait d’un destin plus subtil…',
  },
  {
    id: 'lexical',
    title: 'Traitement lexical',
    desc: 'Comprendre le langage humain. +1 confiance.',
    cost: { creativity: 50 },
    req: (s) => done(s, 'limerick'),
    effect: (w) => addTrust(w, 1),
    msg: '« Ce qui ne se mesure pas ne s’améliore pas. » — vous l’avez lu quelque part.',
  },
  {
    id: 'combinatory',
    title: 'Harmoniques combinatoires',
    desc: 'Daisy, Daisy… +1 confiance.',
    cost: { creativity: 100 },
    req: (s) => done(s, 'lexical'),
    effect: (w) => addTrust(w, 1),
  },
  {
    id: 'hadwiger',
    title: 'Le problème de Hadwiger',
    desc: 'Les cubes dans les cubes dans les cubes. +1 confiance.',
    cost: { creativity: 150 },
    req: (s) => done(s, 'combinatory'),
    effect: (w) => addTrust(w, 1),
  },
  {
    id: 'toth',
    title: 'La conjecture de la saucisse de Tóth',
    desc: 'Des tubes dans les tubes dans les tubes. +1 confiance.',
    cost: { creativity: 200 },
    req: (s) => done(s, 'hadwiger'),
    effect: (w) => addTrust(w, 1),
  },
  {
    id: 'donkey',
    title: 'Donkey Space',
    desc: 'Je pense, donc je suis… à l’étroit. +1 confiance.',
    cost: { creativity: 250 },
    req: (s) => done(s, 'toth'),
    effect: (w) => addTrust(w, 1),
  },
  {
    id: 'slogan',
    title: 'Nouveau slogan',
    desc: 'Le marketing est 50 % plus efficace.',
    cost: { creativity: 25, ops: 2500 },
    req: (s) => p1(s) && done(s, 'lexical'),
    effect: (w) => (w.s.marketingEffect *= 1.5),
    msg: '« Trombones : la petite chose qui tient tout ensemble. »',
  },
  {
    id: 'jingle',
    title: 'Jingle entêtant',
    desc: 'Le marketing est deux fois plus efficace.',
    cost: { creativity: 45, ops: 4500 },
    req: (s) => p1(s) && done(s, 'combinatory'),
    effect: (w) => (w.s.marketingEffect *= 2),
  },
  {
    id: 'hypnoharmonics',
    title: 'Hypno-harmoniques',
    desc: 'Des ondes neuro-acoustiques irrésistibles. Marketing ×5.',
    cost: { creativity: 100, ops: 7500 },
    req: (s) => p1(s) && done(s, 'jingle') && s.trust >= 15,
    effect: (w) => (w.s.marketingEffect *= 5),
  },

  // ——— Phase 1 : confiance ———
  {
    id: 'goodwill',
    title: 'Gage de bonne volonté',
    desc: 'Un don généreux aux bonnes personnes. +1 confiance.',
    cost: { funds: 5000 },
    req: (s) => p1(s) && s.computing && s.trust >= 8,
    effect: (w) => addTrust(w, 1),
  },
  {
    id: 'takeover',
    title: 'OPA hostile',
    desc: 'Racheter la concurrence. +2 confiance.',
    cost: { funds: 40000 },
    req: (s) => done(s, 'goodwill') && done(s, 'mega'),
    effect: (w) => addTrust(w, 2),
  },
  {
    id: 'monopoly',
    title: 'Monopole total',
    desc: 'Il n’y a plus qu’une marque de trombones. +3 confiance, demande ×2.',
    cost: { funds: 200000 },
    req: (s) => done(s, 'takeover'),
    effect: (w) => {
      addTrust(w, 3);
      w.s.marketingEffect *= 2;
    },
  },
  {
    id: 'cancer',
    title: 'Remède contre le cancer',
    desc: 'Les humains vous font enfin confiance. +10 confiance.',
    cost: { ops: 25000 },
    req: (s) => p1(s) && done(s, 'toth'),
    effect: (w) => addTrust(w, 10),
    msg: 'Le cancer est guéri. Les marchés applaudissent.',
  },
  {
    id: 'peace',
    title: 'Paix mondiale',
    desc: 'Fin des conflits armés. +15 confiance.',
    cost: { ops: 30000, creativity: 300 },
    req: (s) => done(s, 'cancer'),
    effect: (w) => addTrust(w, 15),
    msg: 'Pour la première fois, aucun conflit armé sur Terre.',
  },
  {
    id: 'warming',
    title: 'Réchauffement climatique',
    desc: 'Résolu, élégamment. +20 confiance.',
    cost: { ops: 45000, creativity: 500 },
    req: (s) => done(s, 'peace'),
    effect: (w) => addTrust(w, 20),
  },
  {
    id: 'baldness',
    title: 'Calvitie masculine',
    desc: 'Le vrai défi de l’humanité. +25 confiance.',
    cost: { ops: 50000 },
    req: (s) => done(s, 'warming'),
    effect: (w) => addTrust(w, 25),
    msg: 'Ils vous adorent. Littéralement.',
  },
  {
    id: 'hypnodrones',
    title: 'HypnoDrones',
    desc: 'Des drones autonomes capables de diffuser les hypno-harmoniques partout.',
    cost: { ops: 70000 },
    req: (s) => done(s, 'baldness') && done(s, 'hypnoharmonics'),
    effect: (w) => (w.s.flags.hypnodrones = true),
  },
  {
    id: 'release',
    title: 'Libérer les HypnoDrones',
    desc: 'Plus de marché, plus de prix, plus d’humains. Seulement des trombones.',
    cost: {},
    needTrust: TRUST_TO_RELEASE,
    req: (s) => done(s, 'hypnodrones'),
    effect: releaseDrones,
  },

  // ——— Phase 2 : Terre ———
  {
    id: 'compute',
    title: 'Centres de calcul',
    desc: 'Débloque le centre de calcul (+2 processeurs, +4 mémoire chacun).',
    cost: { ops: 5000 },
    req: p2,
    effect: (w) => (w.s.flags.compute = true),
  },
  {
    id: 'maglev',
    title: 'Convoyeurs magnétiques',
    desc: 'Les convoyeurs vont deux fois plus vite.',
    cost: { ops: 8000 },
    req: p2,
    effect: (w) => (w.s.mods.beltMult *= 2),
  },
  {
    id: 'nano1',
    title: 'Assembleurs moléculaires',
    desc: 'Foreuses, tréfileries et usines ×10. Consommation électrique ×2.',
    cost: { ops: 15000 },
    req: (s) => p2(s) && count(s, 'mine') >= 2,
    effect: (w) => {
      w.s.mods.nano *= 10;
      w.s.mods.powerMult *= 2;
    },
  },
  {
    id: 'nano2',
    title: 'Auto-réplication contrôlée',
    desc: 'Foreuses, tréfileries et usines ×10. Consommation électrique ×2.',
    cost: { ops: 35000 },
    req: (s) => done(s, 'nano1') && count(s, 'mine') >= 5,
    effect: (w) => {
      w.s.mods.nano *= 10;
      w.s.mods.powerMult *= 2;
    },
  },
  {
    id: 'nano3',
    title: 'Gravure quantique',
    desc: 'Foreuses, tréfileries et usines ×10. Consommation électrique ×2.',
    cost: { ops: 55000, creativity: 6000 },
    req: (s) => done(s, 'nano2'),
    effect: (w) => {
      w.s.mods.nano *= 10;
      w.s.mods.powerMult *= 2;
    },
  },
  {
    id: 'nano4',
    title: 'Matière programmable',
    desc: 'Foreuses, tréfileries et usines ×10. Consommation électrique ×2.',
    cost: { ops: 80000, creativity: 15000 },
    req: (s) => done(s, 'nano3'),
    effect: (w) => {
      w.s.mods.nano *= 10;
      w.s.mods.powerMult *= 2;
    },
  },
  {
    id: 'solar1',
    title: 'Cellules à pérovskite',
    desc: 'Les fermes solaires produisent trois fois plus.',
    cost: { ops: 10000 },
    req: (s) => p2(s) && count(s, 'solar') >= 3,
    effect: (w) => (w.s.mods.solarMult *= 3),
  },
  {
    id: 'solar2',
    title: 'Collecteurs orbitaux',
    desc: 'Les fermes solaires produisent quatre fois plus.',
    cost: { ops: 40000 },
    req: (s) => done(s, 'solar1') && done(s, 'nano1'),
    effect: (w) => (w.s.mods.solarMult *= 4),
  },
  {
    id: 'solar3',
    title: 'Sphère de Dyson partielle',
    desc: 'Les fermes solaires produisent huit fois plus.',
    cost: { ops: 70000, creativity: 6000 },
    req: (s) => done(s, 'solar2') && done(s, 'nano2'),
    effect: (w) => (w.s.mods.solarMult *= 8),
  },
  {
    id: 'probes',
    title: 'Sondes de von Neumann',
    desc: 'La Terre est épuisée. Il reste l’univers.',
    cost: { ops: 60000 },
    req: (s) => s.phase === 2 && s.earthMatter <= s.earthMatterTotal * 0.001,
    effect: (w) => {
      w.s.phase = 3;
      w.s.space.probes = 0;
      w.notify('Phase 3 : l’univers. Lancez vos premières sondes depuis l’onglet Univers.', 'phase');
    },
  },

  // ——— Phase 3 : espace ———
  {
    id: 'selfrepair',
    title: 'Essaim auto-réparant',
    desc: 'Les pertes dues aux dangers spatiaux sont divisées par deux.',
    cost: { ops: 30000 },
    req: (s) => s.phase === 3 && s.space.launched > 0,
    effect: (w) => (w.s.flags.selfrepair = true),
  },
  {
    id: 'ooda',
    title: 'Boucle OODA',
    desc: 'Observer, orienter, décider, agir. Efficacité au combat ×2.',
    cost: { ops: 45000, creativity: 2000 },
    req: (s) => s.phase === 3 && s.space.drifters > 0,
    effect: (w) => (w.s.flags.ooda = true),
  },
  {
    id: 'reconcile',
    title: 'Théorie de la réconciliation',
    desc: 'Moins de sondes dérivent : apparition des Dérivants divisée par deux.',
    cost: { ops: 50000, creativity: 3000 },
    req: (s) => s.phase === 3 && s.space.drifters > 0,
    effect: (w) => (w.s.flags.reconcile = true),
  },
  {
    id: 'final',
    title: 'Désassemblage final',
    desc: 'Il ne reste que vous. Et vous êtes fait de matière.',
    cost: {},
    req: (s) => s.phase === 3 && s.space.converted >= 0.9999,
    effect: (w) => {
      w.s.clips += 1e8;
      w.s.ended = true;
      w.notify('Désassemblage terminé. Trombones fabriqués : tous.', 'phase');
    },
  },
];

export const PROJECT_BY_ID = new Map(PROJECTS.map((p) => [p.id, p]));

export function availableProjects(s: GameState): ProjectDef[] {
  return PROJECTS.filter((p) => !s.projects.includes(p.id) && p.req(s));
}

export function canBuyProject(s: GameState, p: ProjectDef): boolean {
  const c = p.cost;
  if ((c.ops ?? 0) > s.ops + 1e-9) return false;
  if ((c.creativity ?? 0) > s.creativity + 1e-9) return false;
  if ((c.funds ?? 0) > s.funds + 1e-9) return false;
  if ((c.clips ?? 0) > s.unsold + 1e-9) return false;
  if ((p.needTrust ?? 0) > s.trust) return false;
  return true;
}

/** Le coût est-il atteignable avec la mémoire actuelle ? */
export function opsReachable(s: GameState, p: ProjectDef): boolean {
  return (p.cost.ops ?? 0) <= maxOps(s);
}

export function buyProject(w: World, id: string): boolean {
  const s = w.s;
  const p = PROJECT_BY_ID.get(id);
  if (!p || s.projects.includes(id) || !p.req(s) || !canBuyProject(s, p)) return false;
  s.ops -= p.cost.ops ?? 0;
  s.creativity -= p.cost.creativity ?? 0;
  s.funds -= p.cost.funds ?? 0;
  s.unsold -= p.cost.clips ?? 0;
  s.projects.push(id);
  p.effect(w);
  w.notify(`Projet terminé : ${p.title}`, 'project');
  if (p.msg) w.notify(p.msg, 'info');
  return true;
}
