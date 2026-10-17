import './styles.css';
import { duration } from './game/format';
import { Game } from './game/game';
import { buyPerk, payOut } from './game/legacy';
import {
  clearLocal,
  exportString,
  getActiveSlot,
  hasSave,
  importString,
  loadLegacy,
  loadLocal,
  saveLegacy,
  saveLocal,
  setActiveSlot,
  slotOf,
  type Slot,
} from './game/save';
import { newScenarioGame } from './game/scenarios';
import { newGame } from './game/state';
import type { GameState } from './game/types';
import { Camera } from './render/camera';
import { Renderer } from './render/renderer';
import { UniverseView } from './render/universe';
import { Hud, type App } from './ui/hud';
import { Input } from './ui/input';

const AUTOSAVE_MS = 15_000;

const canvas = document.getElementById('world') as HTMLCanvasElement;
// Sans choix enregistré, on reprend la partie classique : les joueurs existants ne voient aucun changement.
const activeSlot = getActiveSlot();
const loaded = loadLocal(activeSlot) ?? (activeSlot === 'scenario' ? loadLocal('classic') : null);
/** Toute première visite : on propose l'écran d'accueil, et rien n'est sauvegardé avant un choix. */
let pristine = !hasSave('classic') && !hasSave('scenario');
let helpAfterChoice = pristine;
const game = new Game(loaded?.state ?? newGame());
const legacy = loadLegacy();
const cam = new Camera();
const renderer = new Renderer(canvas);
const universe = new UniverseView();

let hud: Hud;

function save(): boolean {
  if (pristine) return false;
  return saveLocal(game.s);
}

/** Remplace la partie en cours après avoir sauvegardé celle qu'on quitte. */
function switchTo(state: GameState, savedAt?: number): void {
  save();
  pristine = false;
  game.replace(state);
  setActiveSlot(slotOf(state));
  afterLoad();
  if (savedAt !== undefined) welcomeBack(savedAt);
  saveLocal(game.s);
  hud.toggleModal(null);
  firstHelp();
}

function firstHelp(): void {
  if (!helpAfterChoice) return;
  helpAfterChoice = false;
  hud.toggleModal('help');
}

function welcomeBack(savedAt: number): void {
  const away = (Date.now() - savedAt) / 1000;
  if (away > 10) {
    const simulated = game.catchUp(away);
    game.world.notify(`Bon retour. ${duration(simulated)} de production simulés pendant votre absence.`, 'good');
  }
}

const app: App = {
  game,
  input: undefined as unknown as Input,
  cam,
  view: 'factory',
  legacy,
  setView(v) {
    app.view = v;
    if (v !== 'factory') app.input.setTool(null);
  },
  setPaused(p) {
    game.paused = p;
  },
  saveNow: () => saveLocal(game.s),
  exportSave: () => exportString(game.s),
  importSave(txt) {
    const r = importString(txt);
    if (!r) return false;
    switchTo(r.state);
    return true;
  },
  resetGame() {
    // « Nouvelle partie » classique, inchangé ; en scénario, l'accueil propose le choix.
    if (game.s.scenario) {
      hud.toggleModal('home');
      return;
    }
    app.startClassic();
  },
  slot: () => slotOf(game.s),
  peek(slot) {
    if (slotOf(game.s) === slot && !pristine) return game.s;
    return loadLocal(slot)?.state ?? null;
  },
  continueSlot(slot: Slot) {
    if (slotOf(game.s) === slot) {
      pristine = false;
      hud.toggleModal(null);
      firstHelp();
      return;
    }
    const r = loadLocal(slot);
    if (r) switchTo(r.state, r.savedAt);
    else if (slot === 'classic') switchTo(newGame());
  },
  startClassic() {
    if (slotOf(game.s) === 'classic') pristine = true; // on écrase la partie classique : rien à sauver
    clearLocal('classic');
    switchTo(newGame());
  },
  startScenario(id) {
    if (slotOf(game.s) === 'scenario') pristine = true; // le scénario abandonné n'est pas conservé
    clearLocal('scenario');
    switchTo(newScenarioGame(id, legacy.perks));
  },
  buyPerk(id) {
    if (!buyPerk(legacy, id)) return false;
    saveLegacy(legacy);
    return true;
  },
  payLegacy() {
    const n = payOut(legacy, game.s);
    if (n > 0) {
      saveLegacy(legacy);
      saveLocal(game.s);
    }
    return n;
  },
};

app.input = new Input(canvas, cam, {
  world: () => game.world,
  view: () => app.view,
  hotbarSlot: (i) => hud.hotbarSlot(i),
  onToolChange: () => undefined,
  toggleModal: (n) => hud.toggleModal(n),
  modalOpen: () => hud.isModalOpen(),
});
hud = new Hud(app);

function afterLoad(): void {
  cam.centerOnHq();
  app.view = game.s.phase === 3 ? 'universe' : 'factory';
  app.input.tool = null;
  hud.reset();
}

if (window.innerWidth < 760) {
  document.getElementById('left')?.classList.add('collapsed');
  document.getElementById('right')?.classList.add('collapsed');
}

renderer.resize(cam);
window.addEventListener('resize', () => renderer.resize(cam));

if (loaded) {
  app.view = game.s.phase === 3 ? 'universe' : 'factory';
  welcomeBack(loaded.savedAt);
} else {
  game.world.notify('Bienvenue. Votre objectif : fabriquer des trombones.', 'phase');
  hud.toggleModal(pristine ? 'home' : 'help');
}

let last = performance.now();
let hudTimer = 0;
let saveTimer = 0;

function frame(now: number): void {
  const dt = Math.min(3600, (now - last) / 1000);
  last = now;
  const caught = game.update(dt);
  if (caught > 30) game.world.notify(`${duration(caught)} rattrapées en arrière-plan.`, 'info');
  app.input.update(Math.min(dt, 0.1));

  if (app.view === 'universe') {
    universe.draw(renderer.ctx, game.s, cam.w, cam.h, renderer.dpr, now / 1000);
  } else {
    renderer.draw(game.world, cam, app.input.viewState(), now / 1000);
  }

  hud.frame();
  hudTimer += dt;
  if (hudTimer > 0.1) {
    hudTimer = 0;
    hud.update();
  }
  saveTimer += dt * 1000;
  if (saveTimer > AUTOSAVE_MS) {
    saveTimer = 0;
    if (!game.paused) save();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save();
});
window.addEventListener('beforeunload', () => save());

// Accès console pour les curieux (et le débogage).
(window as unknown as { trombones: unknown }).trombones = { game, app };
