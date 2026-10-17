import { SAVE_VERSION } from './constants';
import { newGame } from './state';
import { emptyLegacy, type Legacy } from './legacy';
import type { GameState } from './types';

const KEY = 'trombones-universels:save';

interface SaveFile {
  savedAt: number;
  state: GameState;
}

export function serialize(s: GameState): string {
  const file: SaveFile = { savedAt: Date.now(), state: s };
  return JSON.stringify(file);
}

/** Fusionne une sauvegarde avec un état neuf pour combler les champs ajoutés depuis. */
export function hydrate(raw: unknown): { state: GameState; savedAt: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const file = raw as Partial<SaveFile>;
  const src = file.state as Partial<GameState> | undefined;
  if (!src || typeof src !== 'object' || !Array.isArray(src.entities)) return null;
  if ((src.version ?? 0) > SAVE_VERSION) return null;
  const base = newGame(src.seed ?? 1);
  const state: GameState = {
    ...base,
    ...src,
    mods: { ...base.mods, ...src.mods },
    space: { ...base.space, ...src.space, alloc: { ...base.space.alloc, ...src.space?.alloc } },
    stats: { ...base.stats, ...src.stats },
    flags: { ...src.flags },
    counts: { ...src.counts },
    projects: [...(src.projects ?? [])],
    log: [...(src.log ?? [])],
    version: SAVE_VERSION,
  } as GameState;
  return { state, savedAt: typeof file.savedAt === 'number' ? file.savedAt : Date.now() };
}

/**
 * Deux emplacements indépendants : la partie classique garde la clé d'origine
 * (les sauvegardes existantes sont lues telles quelles), les scénarios ont la leur.
 */
export type Slot = 'classic' | 'scenario';

const SLOT_KEYS: Record<Slot, string> = { classic: KEY, scenario: 'trombones-universels:scenario' };
const ACTIVE_KEY = 'trombones-universels:mode';
const LEGACY_KEY = 'trombones-universels:legacy';

export const slotOf = (s: GameState): Slot => (s.scenario ? 'scenario' : 'classic');

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function saveLocal(s: GameState): boolean {
  try {
    store()?.setItem(SLOT_KEYS[slotOf(s)], serialize(s));
    return true;
  } catch {
    return false;
  }
}

export function loadLocal(slot: Slot = 'classic'): { state: GameState; savedAt: number } | null {
  try {
    const txt = store()?.getItem(SLOT_KEYS[slot]);
    if (!txt) return null;
    const r = hydrate(JSON.parse(txt));
    // Une sauvegarde rangée au mauvais endroit n'est jamais chargée dans l'autre mode.
    return r && slotOf(r.state) === slot ? r : null;
  } catch {
    return null;
  }
}

export function hasSave(slot: Slot): boolean {
  try {
    return !!store()?.getItem(SLOT_KEYS[slot]);
  } catch {
    return false;
  }
}

export function clearLocal(slot: Slot = 'classic'): void {
  try {
    store()?.removeItem(SLOT_KEYS[slot]);
  } catch {
    /* stockage indisponible */
  }
}

export function getActiveSlot(): Slot {
  try {
    return store()?.getItem(ACTIVE_KEY) === 'scenario' ? 'scenario' : 'classic';
  } catch {
    return 'classic';
  }
}

export function setActiveSlot(slot: Slot): void {
  try {
    store()?.setItem(ACTIVE_KEY, slot);
  } catch {
    /* stockage indisponible */
  }
}

export function loadLegacy(): Legacy {
  try {
    const txt = store()?.getItem(LEGACY_KEY);
    if (!txt) return emptyLegacy();
    const raw = JSON.parse(txt) as Partial<Legacy>;
    return {
      fragments: Number(raw.fragments) || 0,
      perks: { ...raw.perks },
      records: { ...raw.records },
      runs: Number(raw.runs) || 0,
    };
  } catch {
    return emptyLegacy();
  }
}

export function saveLegacy(l: Legacy): void {
  try {
    store()?.setItem(LEGACY_KEY, JSON.stringify(l));
  } catch {
    /* stockage indisponible */
  }
}

export function exportString(s: GameState): string {
  const bytes = new TextEncoder().encode(serialize(s));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function importString(txt: string): { state: GameState; savedAt: number } | null {
  try {
    const bin = atob(txt.trim());
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return hydrate(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
