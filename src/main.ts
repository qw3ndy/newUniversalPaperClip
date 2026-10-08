import './styles.css';
import { duration } from './game/format';
import { Game } from './game/game';
import { clearLocal, exportString, importString, loadLocal, saveLocal } from './game/save';
import { newGame } from './game/state';
import { Camera } from './render/camera';
import { Renderer } from './render/renderer';
import { UniverseView } from './render/universe';
import { Hud, type App } from './ui/hud';
import { Input } from './ui/input';

const AUTOSAVE_MS = 15_000;

const canvas = document.getElementById('world') as HTMLCanvasElement;
const loaded = loadLocal();
const game = new Game(loaded?.state ?? newGame());
const cam = new Camera();
const renderer = new Renderer(canvas);
const universe = new UniverseView();

let hud: Hud;

const app: App = {
  game,
  input: undefined as unknown as Input,
  cam,
  view: 'factory',
  setView(v) {
    app.view = v;
    if (v !== 'factory') app.input.setTool(null);
  },
  saveNow: () => saveLocal(game.s),
  exportSave: () => exportString(game.s),
  importSave(txt) {
    const r = importString(txt);
    if (!r) return false;
    game.replace(r.state);
    afterLoad();
    saveLocal(game.s);
    return true;
  },
  resetGame() {
    clearLocal();
    game.replace(newGame());
    afterLoad();
    saveLocal(game.s);
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
  const away = (Date.now() - loaded.savedAt) / 1000;
  if (away > 10) {
    const simulated = game.catchUp(away);
    game.world.notify(`Bon retour. ${duration(simulated)} de production simulés pendant votre absence.`, 'good');
  }
} else {
  game.world.notify('Bienvenue. Votre objectif : fabriquer des trombones.', 'phase');
  hud.toggleModal('help');
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
    saveLocal(game.s);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveLocal(game.s);
});
window.addEventListener('beforeunload', () => saveLocal(game.s));

// Accès console pour les curieux (et le débogage).
(window as unknown as { trombones: unknown }).trombones = { game, app };
