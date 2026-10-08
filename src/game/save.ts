import { SAVE_VERSION } from './constants';
import { newGame } from './state';
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

export function saveLocal(s: GameState): boolean {
  try {
    localStorage.setItem(KEY, serialize(s));
    return true;
  } catch {
    return false;
  }
}

export function loadLocal(): { state: GameState; savedAt: number } | null {
  try {
    const txt = localStorage.getItem(KEY);
    if (!txt) return null;
    return hydrate(JSON.parse(txt));
  } catch {
    return null;
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(KEY);
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
