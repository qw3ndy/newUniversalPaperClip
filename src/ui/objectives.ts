import { TRUST_TO_RELEASE } from '../game/constants';
import { fmt, pct } from '../game/format';
import type { GameState } from '../game/types';

export interface Objective {
  phase: number;
  title: string;
  hint: string;
  done: (s: GameState) => boolean;
  progress?: (s: GameState) => string;
}

const c = (s: GameState, t: keyof GameState['counts']) => s.counts[t] ?? 0;

export const OBJECTIVES: Objective[] = [
  {
    phase: 1,
    title: 'Pliez vos premiers trombones',
    hint: 'Cliquez sur le Siège (au centre) ou sur « Plier un trombone ».',
    done: (s) => s.clips >= 10 || c(s, 'clipper') > 0,
    progress: (s) => `${Math.floor(s.clips)} / 10`,
  },
  {
    phase: 1,
    title: 'Automatisez avec une plieuse',
    hint: 'Touche 4 : posez une plieuse entre le distributeur de fil et le Siège, flèche vers le Siège. Il faut 6 $ : vendez d’abord quelques trombones.',
    done: (s) => c(s, 'clipper') >= 1,
  },
  {
    phase: 1,
    title: 'Trouvez le bon prix',
    hint: 'Trop de stock invendu ? Baissez le prix. Tout part instantanément ? Montez-le.',
    done: (s) => s.funds >= 25 || s.spoolsBought > 0,
    progress: (s) => `${fmt(s.funds)} $ / 25 $`,
  },
  {
    phase: 1,
    title: 'Ne tombez jamais à court de fil',
    hint: 'Achetez une bobine quand le prix est bas : il oscille en permanence.',
    done: (s) => s.spoolsBought >= 1,
  },
  {
    phase: 1,
    title: 'Agrandissez la ligne de production',
    hint: 'Un distributeur alimente plusieurs plieuses : tracez des convoyeurs (touche 1, glisser) et utilisez des répartiteurs (2).',
    done: (s) => c(s, 'clipper') >= 5,
    progress: (s) => `${c(s, 'clipper')} / 5 plieuses`,
  },
  {
    phase: 1,
    title: 'Débloquez le calcul',
    hint: 'À 2 000 trombones, les humains vous confient des processeurs.',
    done: (s) => s.computing,
    progress: (s) => `${fmt(s.clips)} / 2 000`,
  },
  {
    phase: 1,
    title: 'Lancez vos premiers projets',
    hint: 'Répartissez la confiance entre processeurs (vitesse) et mémoire (opérations max).',
    done: (s) => s.projects.length >= 2,
  },
  {
    phase: 1,
    title: 'Passez à la vitesse supérieure',
    hint: 'Atteignez 20 plieuses pour accéder au projet « Méga-plieuses ».',
    done: (s) => !!s.flags.mega,
    progress: (s) => `${c(s, 'clipper')} / 20 plieuses`,
  },
  {
    phase: 1,
    title: 'Gagnez la confiance totale',
    hint: 'La confiance vient des paliers de production et des grands projets humanitaires.',
    done: (s) => s.trust >= TRUST_TO_RELEASE || s.phase > 1,
    progress: (s) => `${s.trust} / ${TRUST_TO_RELEASE}`,
  },
  {
    phase: 1,
    title: 'Libérez les HypnoDrones',
    hint: 'Le projet apparaît après « HypnoDrones ».',
    done: (s) => s.phase > 1,
  },
  {
    phase: 2,
    title: 'Exploitez la planète',
    hint: 'Posez des fermes solaires (énergie) puis des foreuses sur les gisements violets.',
    done: (s) => c(s, 'mine') >= 1 && c(s, 'solar') >= 1,
  },
  {
    phase: 2,
    title: 'Fermez la boucle',
    hint: 'Foreuse → tréfilerie → usine à trombones → Siège ou entrepôt.',
    done: (s) => c(s, 'clipfactory') >= 1 && c(s, 'wiremill') >= 1,
  },
  {
    phase: 2,
    title: 'Convertissez la Terre',
    hint: 'Les projets « nanotechnologie » multiplient la production par 10.',
    done: (s) => s.earthMatter <= s.earthMatterTotal * 0.001 || s.phase > 2,
    progress: (s) => `${pct(1 - s.earthMatter / s.earthMatterTotal)} convertis`,
  },
  {
    phase: 2,
    title: 'Quittez la Terre',
    hint: 'Projet « Sondes de von Neumann ».',
    done: (s) => s.phase > 2,
  },
  {
    phase: 3,
    title: 'Lancez une sonde',
    hint: 'Onglet Univers, panneau de gauche.',
    done: (s) => s.space.launched >= 1,
  },
  {
    phase: 3,
    title: 'Explorez l’univers',
    hint: 'Équilibrez réplication, exploration et combat. Les Dérivants se multiplient si on les ignore.',
    done: (s) => s.space.explored >= 1,
    progress: (s) => pct(s.space.explored),
  },
  {
    phase: 3,
    title: 'Tout convertir',
    hint: 'Chaque atome de l’univers deviendra un trombone.',
    done: (s) => s.ended,
    progress: (s) => pct(s.space.converted),
  },
];

export function currentObjective(s: GameState): Objective | null {
  return OBJECTIVES.find((o) => o.phase >= s.phase && !o.done(s)) ?? null;
}
