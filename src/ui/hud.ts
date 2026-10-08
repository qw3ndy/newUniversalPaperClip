import { BUILDINGS, HOTBAR } from '../game/constants';
import { addMemory, addProcessor, buyMarketing, buyWire, changePrice } from '../game/economy';
import { duration, fmt, fmtFull, money, pct } from '../game/format';
import { availableProjects, buyProject, canBuyProject, opsReachable, type ProjectDef } from '../game/projects';
import {
  buildingCost,
  canAfford,
  clipperRate,
  creativityRate,
  feederRate,
  factoryRate,
  isFree,
  isUnlocked,
  machineRate,
  marketingCost,
  maxOps,
  megaRate,
  millRate,
  mineRate,
  opsRate,
  powerUse,
  salesRate,
  solarOutput,
  spoolSize,
  totalMemory,
  totalProcessors,
  trustAvailable,
} from '../game/rules';
import { bufferCap } from '../game/sim';
import { ALLOC_KEYS, ALLOC_LABELS, allocUsed, buyProbeTrust, launchProbe, probeCost, probeTrustCost, setAlloc } from '../game/space';
import type { BuildingType, Cost, Entity, GameState, MachineStatus } from '../game/types';
import type { World } from '../game/world';
import { svgIcon, type IconName } from '../render/icons';
import type { Camera } from '../render/camera';
import type { Input } from './input';
import { currentObjective } from './objectives';

export interface App {
  game: { world: World; s: GameState };
  input: Input;
  cam: Camera;
  view: 'factory' | 'universe';
  setView(v: 'factory' | 'universe'): void;
  saveNow(): boolean;
  exportSave(): string;
  importSave(txt: string): boolean;
  resetGame(): void;
}

const STATUS_TEXT: Record<MachineStatus, [string, string]> = {
  ok: ['En marche', 'good'],
  idle: ['Au repos', 'muted'],
  full: ['Ligne pleine — tout va bien', 'good'],
  noInput: ['En attente de matière', 'warn'],
  blocked: ['Sortie bloquée', 'bad'],
  noPower: ['Énergie insuffisante', 'warn'],
  noDeposit: ['Terre épuisée', 'muted'],
  noWire: ['Stock de fil vide', 'warn'],
};

const ICON_OF: Record<BuildingType, IconName> = {
  hq: 'hq',
  belt: 'belt',
  splitter: 'splitter',
  feeder: 'feeder',
  clipper: 'clipper',
  megaclipper: 'megaclipper',
  mine: 'mine',
  wiremill: 'wiremill',
  clipfactory: 'clipfactory',
  solar: 'solar',
  compute: 'compute',
  depot: 'depot',
};

const ITEM_NAME = { wire: 'fil', clip: 'trombones', matter: 'matière' } as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function costText(c: Cost): string {
  if (isFree(c)) return 'Gratuit';
  if (c.funds) return money(c.funds);
  return fmt(c.clips ?? 0) + ' tr.';
}

export class Hud {
  private binds: (() => void)[] = [];
  private layoutKey = '';
  private projKey = '';
  private logKey = '';
  private hotbarTypes: BuildingType[] = [];
  private hoverSlot: BuildingType | null = null;
  private openModal: 'help' | 'menu' | 'end' | null = null;
  private lastPhase = 0;

  private readonly root = document.getElementById('app')!;
  private readonly top = document.getElementById('topbar')!;
  private readonly left = document.getElementById('left')!;
  private readonly right = document.getElementById('right')!;
  private readonly hotbar = document.getElementById('hotbar')!;
  private readonly tooltip = document.getElementById('tooltip')!;
  private readonly toasts = document.getElementById('toasts')!;
  private readonly logEl = document.getElementById('log')!;
  private readonly modal = document.getElementById('modal')!;
  private projList: HTMLElement | null = null;

  constructor(private app: App) {
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal && this.openModal !== 'end') this.toggleModal(null);
    });
  }

  private get w(): World {
    return this.app.game.world;
  }

  private get s(): GameState {
    return this.app.game.world.s;
  }

  // ——— Liaisons ———

  private text(e: Element | null, fn: () => string): void {
    if (!e) return;
    let last: string | null = null;
    this.binds.push(() => {
      const v = fn();
      if (v !== last) {
        e.textContent = v;
        last = v;
      }
    });
  }

  private cls(e: Element | null, c: string, fn: () => boolean): void {
    if (!e) return;
    let last: boolean | null = null;
    this.binds.push(() => {
      const v = fn();
      if (v !== last) {
        e.classList.toggle(c, v);
        last = v;
      }
    });
  }

  private enabled(e: HTMLButtonElement | null, fn: () => boolean): void {
    if (!e) return;
    let last: boolean | null = null;
    this.binds.push(() => {
      const v = fn();
      if (v !== last) {
        e.disabled = !v;
        last = v;
      }
    });
  }

  private bar(e: HTMLElement | null, fn: () => number): void {
    if (!e) return;
    let last = -1;
    this.binds.push(() => {
      const v = Math.round(Math.max(0, Math.min(1, fn())) * 1000) / 10;
      if (v !== last) {
        e.style.width = v + '%';
        last = v;
      }
    });
  }

  private btn(parent: HTMLElement, cls: string, html: string, onClick: () => void): HTMLButtonElement {
    const b = el('button', cls, html);
    b.type = 'button';
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onClick();
    });
    parent.appendChild(b);
    return b;
  }

  /** Ligne « libellé — valeur ». */
  private row(parent: HTMLElement, label: string, fn: () => string, icon?: IconName, cls = ''): HTMLElement {
    const r = el('div', 'row ' + cls, `${icon ? svgIcon(icon) : ''}<span class="lbl">${label}</span><span class="val"></span>`);
    parent.appendChild(r);
    this.text(r.querySelector('.val'), fn);
    return r;
  }

  private card(parent: HTMLElement, title: string, icon: IconName, cls = ''): HTMLElement {
    const c = el('section', 'card ' + cls, `<h3>${svgIcon(icon)}<span>${title}</span></h3>`);
    parent.appendChild(c);
    return c;
  }

  private meter(parent: HTMLElement, cls: string, fn: () => number, label?: () => string): void {
    const m = el('div', 'meter ' + cls, '<div class="fill"></div><span class="mtxt"></span>');
    parent.appendChild(m);
    this.bar(m.querySelector('.fill'), fn);
    if (label) this.text(m.querySelector('.mtxt'), label);
  }

  // ——— Construction ———

  private computeLayoutKey(): string {
    const s = this.s;
    return [
      s.phase,
      s.computing,
      s.creativityOn,
      s.wireBuyer,
      !!s.flags.mega,
      !!s.flags.compute,
      this.app.view,
      s.ended,
    ].join('|');
  }

  private rebuild(): void {
    this.binds = [];
    this.projKey = '';
    this.buildTop();
    this.buildLeft();
    this.buildRight();
    this.buildHotbar();
    this.root.dataset.phase = String(this.s.phase);
    this.root.dataset.view = this.app.view;
  }

  private buildTop(): void {
    const s = () => this.s;
    const t = this.top;
    t.innerHTML = '';
    const brand = el('div', 'brand', `${svgIcon('clip', 'ico logo')}<div><b>Trombones</b><small>Universels</small></div>`);
    t.appendChild(brand);
    const counter = el('div', 'counter', '<div class="big"></div><div class="sub"><span class="rate"></span></div>');
    t.appendChild(counter);
    this.text(counter.querySelector('.big'), () => fmtFull(s().clips));
    this.text(counter.querySelector('.rate'), () => {
      const r = s().stats.clipRate;
      return `trombones · ${r >= 0.05 ? '+' + fmt(r, 1) + ' /s' : 'à l’arrêt'}`;
    });
    const right = el('div', 'top-right');
    t.appendChild(right);
    const phaseNames = ['', 'Entreprise', 'Terre', 'Univers'];
    const chip = el('span', 'chip phase-chip');
    right.appendChild(chip);
    this.text(chip, () => `Phase ${s().phase} · ${phaseNames[s().phase]}`);
    if (this.s.phase === 3) {
      const tabs = el('div', 'tabs');
      right.appendChild(tabs);
      const a = this.btn(tabs, 'tab', `${svgIcon('factory')}Usine`, () => this.app.setView('factory'));
      const b = this.btn(tabs, 'tab', `${svgIcon('galaxy')}Univers`, () => this.app.setView('universe'));
      a.classList.toggle('active', this.app.view === 'factory');
      b.classList.toggle('active', this.app.view === 'universe');
    }
    this.btn(right, 'icon-btn', svgIcon('help'), () => this.toggleModal('help')).title = 'Aide (H)';
    this.btn(right, 'icon-btn', svgIcon('gear'), () => this.toggleModal('menu')).title = 'Partie';
    const toggles = el('div', 'panel-toggles');
    right.appendChild(toggles);
    this.btn(toggles, 'icon-btn small', svgIcon('chevronLeft'), () => this.left.classList.toggle('collapsed')).title =
      'Afficher / masquer le panneau de gauche';
    this.btn(toggles, 'icon-btn small', svgIcon('chevronRight'), () => this.right.classList.toggle('collapsed')).title =
      'Afficher / masquer le panneau de droite';
  }

  private buildObjective(parent: HTMLElement): void {
    const box = el('section', 'card objective', '<div class="obj-k">Objectif</div><div class="obj-t"></div><div class="obj-h"></div><div class="obj-p"></div>');
    parent.appendChild(box);
    const obj = () => currentObjective(this.s);
    this.text(box.querySelector('.obj-t'), () => obj()?.title ?? 'Tout est trombone.');
    this.text(box.querySelector('.obj-h'), () => obj()?.hint ?? '');
    this.text(box.querySelector('.obj-p'), () => obj()?.progress?.(this.s) ?? '');
    this.cls(box, 'hidden', () => !obj());
  }

  private buildLeft(): void {
    const L = this.left;
    L.innerHTML = '';
    this.buildObjective(L);
    const s = () => this.s;
    const w = () => this.w;

    if (this.s.phase === 1) {
      // Production manuelle
      const prod = this.card(L, 'Atelier', 'hand');
      const make = this.btn(prod, 'btn primary wide', `${svgIcon('clip')}<span>Plier un trombone</span><kbd>Espace</kbd>`, () =>
        this.app.input.handClip(),
      );
      this.enabled(make, () => s().wire >= 1);
      this.row(prod, 'Stock invendu', () => fmtFull(s().unsold), 'depot');

      // Commerce
      const biz = this.card(L, 'Commerce', 'funds');
      this.row(biz, 'Fonds', () => money(s().funds), undefined, 'strong');
      const price = el('div', 'row price', '<span class="lbl">Prix du trombone</span>');
      biz.appendChild(price);
      const ctrl = el('div', 'stepper');
      price.appendChild(ctrl);
      this.btn(ctrl, 'step', svgIcon('minus'), () => changePrice(w(), -0.01)).title = 'Baisser le prix';
      const pv = el('span', 'pv');
      ctrl.appendChild(pv);
      this.text(pv, () => money(s().margin));
      this.btn(ctrl, 'step', svgIcon('plus'), () => changePrice(w(), 0.01)).title = 'Augmenter le prix';
      this.row(biz, 'Demande publique', () => fmt(s().demand * 10, 0) + ' %');
      this.row(biz, 'Ventes', () => `${fmt(Math.min(salesRate(s()), Math.max(s().stats.salesRate, 0)), 1)} /s · ${money(s().stats.revenueRate)}/s`);
      const mk = el('div', 'row');
      biz.appendChild(mk);
      mk.innerHTML = `${svgIcon('megaphone')}<span class="lbl">Marketing</span><span class="val"></span>`;
      this.text(mk.querySelector('.val'), () => `niveau ${s().marketingLvl}`);
      const mkb = this.btn(biz, 'btn wide', '', () => buyMarketing(w()));
      this.text(mkb, () => `Marketing +1 — ${money(marketingCost(s()))}`);
      this.enabled(mkb, () => s().funds >= marketingCost(s()));

      // Fil
      const wire = this.card(L, 'Fil', 'wire', 'wire-card');
      this.row(wire, 'Stock', () => `${fmtFull(s().wire)} pouces`, undefined, 'strong');
      const wr = this.row(wire, 'Prix', () => `${money(s().wirePrice)} / bobine`);
      this.cls(wr, 'cheap', () => s().wirePrice <= s().wireBasePrice - 3);
      const wb = this.btn(wire, 'btn wide', '', () => buyWire(w()));
      this.text(wb, () => `Acheter une bobine (${fmtFull(spoolSize(s()))})`);
      this.enabled(wb, () => s().funds >= s().wirePrice);
      this.cls(wire, 'alert', () => s().wire < 200);
      if (this.s.wireBuyer) {
        const tg = el('label', 'switch', '<input type="checkbox"><span></span>Achat automatique');
        wire.appendChild(tg);
        const cb = tg.querySelector('input')!;
        cb.checked = this.s.wireBuyerOn;
        cb.addEventListener('change', () => (this.s.wireBuyerOn = cb.checked));
      }

      // Usine
      const fac = this.card(L, 'Usine', 'factory');
      this.row(fac, 'Plieuses', () => `${s().counts.clipper ?? 0} × ${fmt(clipperRate(s()), 2)}/s`, 'clipper');
      if (this.s.flags.mega) this.row(fac, 'Méga-plieuses', () => `${s().counts.megaclipper ?? 0} × ${fmt(megaRate(s()), 1)}/s`, 'megaclipper');
      this.row(fac, 'Distributeurs', () => `${s().counts.feeder ?? 0} × ${fmt(feederRate(s()))}/s`, 'feeder');
    } else if (this.s.phase === 2 || this.app.view === 'factory') {
      const pl = this.card(L, 'Planète', 'planet');
      this.row(pl, 'Matière restante', () => fmt(s().earthMatter) + ' g', undefined, 'strong');
      this.meter(pl, 'matter', () => 1 - s().earthMatter / s().earthMatterTotal, () => pct(1 - s().earthMatter / s().earthMatterTotal) + ' convertis');
      this.row(pl, 'Extraction', () => fmt(s().stats.matterRate) + ' g/s');

      const st = this.card(L, 'Stocks', 'depot');
      this.row(st, 'Trombones disponibles', () => fmt(s().unsold), 'clip', 'strong');
      this.row(st, 'Fil', () => fmt(s().wire) + ' pouces', 'wire');

      const en = this.card(L, 'Énergie', 'ops', 'energy');
      this.row(en, 'Production', () => fmt(s().powerProd) + ' MW');
      this.row(en, 'Consommation', () => fmt(s().powerUse) + ' MW');
      this.meter(en, 'power', () => (s().powerUse > 0 ? Math.min(1, s().powerProd / s().powerUse) : 1), () =>
        s().powerUse > 0 ? 'Efficacité ' + pct(Math.min(1, s().powerProd / s().powerUse), 0) : 'Aucune machine',
      );
      this.cls(en, 'alert', () => s().powerUse > s().powerProd);

      const fac = this.card(L, 'Usine', 'factory');
      this.row(fac, 'Foreuses', () => `${s().counts.mine ?? 0} · ${fmt(mineRate(s()))} g/s max`, 'mine');
      this.row(fac, 'Tréfileries', () => `${s().counts.wiremill ?? 0} · ${fmt(millRate(s()))}/s`, 'wiremill');
      this.row(fac, 'Usines', () => `${s().counts.clipfactory ?? 0} · ${fmt(factoryRate(s()))}/s`, 'clipfactory');
      this.row(fac, 'Fermes solaires', () => `${s().counts.solar ?? 0} · ${fmt(solarOutput(s()))} MW`, 'solar');
    } else {
      this.buildSpaceLeft(L);
    }
    const journal = this.card(L, 'Journal', 'target', 'journal');
    journal.appendChild(this.logEl);
  }

  private buildSpaceLeft(L: HTMLElement): void {
    const s = () => this.s;
    const sp = () => this.s.space;
    const w = () => this.w;
    const pr = this.card(L, 'Sondes', 'probe');
    this.row(pr, 'Sondes actives', () => fmt(Math.floor(sp().probes)), undefined, 'strong');
    this.row(pr, 'Trombones disponibles', () => fmt(s().unsold));
    const lb = this.btn(pr, 'btn primary wide', '', () => launchProbe(w()));
    this.text(lb, () => {
      const c = probeCost(w());
      return c === 0 ? 'Lancer une sonde de secours (gratuit)' : `Lancer une sonde — ${fmt(c)} tr.`;
    });
    this.enabled(lb, () => s().unsold >= probeCost(w()));
    this.row(pr, 'Exploration', () => pct(sp().explored, 3));
    this.meter(pr, 'explore', () => sp().explored);
    this.row(pr, 'Conversion', () => pct(sp().converted, 3));
    this.meter(pr, 'convert', () => sp().converted);

    const dr = this.card(L, 'Dérivants', 'skull', 'drift');
    this.row(dr, 'Dérivants', () => fmt(Math.floor(sp().drifters)), undefined, 'strong');
    this.row(dr, 'Dérivants détruits', () => fmt(Math.floor(sp().drifterKills)));
    this.row(dr, 'Pertes (combat)', () => fmt(Math.floor(sp().lostCombat)));
    this.row(dr, 'Pertes (dangers)', () => fmt(Math.floor(sp().lostHazard)));
    this.cls(dr, 'alert', () => sp().drifters > sp().probes * 0.2 && sp().drifters > 10);

    const tr = this.card(L, 'Confiance des sondes', 'trust');
    this.row(tr, 'Points répartis', () => `${allocUsed(w())} / ${sp().trustMax}`, undefined, 'strong');
    for (const k of ALLOC_KEYS) {
      const r = el('div', 'row alloc', `<span class="lbl" title="${ALLOC_LABELS[k].desc}">${ALLOC_LABELS[k].name}</span>`);
      tr.appendChild(r);
      const ctrl = el('div', 'stepper');
      r.appendChild(ctrl);
      this.btn(ctrl, 'step', svgIcon('minus'), () => setAlloc(w(), k, -1));
      const v = el('span', 'pv');
      ctrl.appendChild(v);
      this.text(v, () => String(sp().alloc[k]));
      const plus = this.btn(ctrl, 'step', svgIcon('plus'), () => setAlloc(w(), k, 1));
      this.enabled(plus, () => allocUsed(w()) < sp().trustMax);
    }
    const tb = this.btn(tr, 'btn wide', '', () => buyProbeTrust(w()));
    this.text(tb, () => `+1 point de confiance — ${fmt(probeTrustCost(w()))} ops`);
    this.enabled(tb, () => s().ops >= probeTrustCost(w()));
  }

  private buildRight(): void {
    const R = this.right;
    R.innerHTML = '';
    const s = () => this.s;
    const w = () => this.w;
    if (!this.s.computing) {
      const c = this.card(R, 'Calcul', 'cpu', 'locked');
      c.appendChild(el('p', 'muted', 'Les humains vous confieront des ressources de calcul à 2 000 trombones.'));
      this.meter(c, 'ops', () => s().clips / 2000, () => `${fmt(s().clips)} / 2 000`);
    } else {
      const c = this.card(R, 'Calcul', 'cpu');
      const tr = this.row(c, 'Confiance', () => `${s().trust} · ${trustAvailable(s())} disponible${trustAvailable(s()) > 1 ? 's' : ''}`, 'trust', 'strong');
      this.cls(tr, 'glow', () => trustAvailable(s()) > 0);
      if (this.s.phase === 1)
        this.row(c, 'Prochain palier', () => `${fmtFull(s().nextTrustAt)} trombones`, undefined, 'muted');
      const grid = el('div', 'alloc-grid');
      c.appendChild(grid);
      const mk = (label: string, icon: IconName, val: () => string, add: () => boolean, extra: () => string) => {
        const box = el('div', 'res', `${svgIcon(icon)}<div class="res-t"><span class="lbl">${label}</span><b></b><small></small></div>`);
        grid.appendChild(box);
        this.text(box.querySelector('b'), val);
        this.text(box.querySelector('small'), extra);
        const b = this.btn(box, 'step', svgIcon('plus'), add);
        this.enabled(b, () => trustAvailable(s()) > 0);
      };
      mk('Processeurs', 'cpu', () => fmt(totalProcessors(s())), () => addProcessor(w()), () => `${fmt(opsRate(s()))} ops/s`);
      mk('Mémoire', 'memory', () => fmt(totalMemory(s())), () => addMemory(w()), () => `${fmt(maxOps(s()))} ops max`);
      this.meter(c, 'ops', () => s().ops / Math.max(1, maxOps(s())), () => `${fmtFull(s().ops)} / ${fmtFull(maxOps(s()))} ops`);
      if (this.s.creativityOn) {
        const cr = this.row(c, 'Créativité', () => fmtFull(s().creativity), 'creativity', 'creat');
        const rate = el('small', 'muted');
        cr.querySelector('.lbl')!.appendChild(rate);
        this.text(rate, () => (s().ops >= maxOps(s()) ? ` +${fmt(creativityRate(s()), 1)}/s` : ' (ops non pleines)'));
      }
    }
    const pc = el('section', 'card projects', `<h3>${svgIcon('target')}<span>Projets</span><small class="count"></small></h3>`);
    R.appendChild(pc);
    this.projList = el('div', 'proj-list');
    pc.appendChild(this.projList);
    this.text(pc.querySelector('.count'), () => String(availableProjects(s()).length));
  }

  private projectCard(p: ProjectDef): HTMLElement {
    const c = p.cost;
    const chips: string[] = [];
    if (c.ops) chips.push(`<span class="cost ops" data-k="ops">${svgIcon('ops')}${fmt(c.ops)}</span>`);
    if (c.creativity) chips.push(`<span class="cost creat" data-k="creativity">${svgIcon('creativity')}${fmt(c.creativity)}</span>`);
    if (c.funds) chips.push(`<span class="cost funds" data-k="funds">${money(c.funds)}</span>`);
    if (c.clips) chips.push(`<span class="cost clips" data-k="clips">${svgIcon('clip')}${fmt(c.clips)}</span>`);
    if (p.needTrust) chips.push(`<span class="cost trust" data-k="trust">${svgIcon('trust')}${p.needTrust} requis</span>`);
    if (!chips.length) chips.push('<span class="cost free">Gratuit</span>');
    const b = el(
      'button',
      'proj',
      `<div class="proj-head"><span class="proj-title">${p.title}</span></div><div class="proj-desc">${p.desc}</div><div class="proj-cost">${chips.join('')}</div>`,
    );
    b.type = 'button';
    b.dataset.id = p.id;
    b.addEventListener('click', () => {
      if (buyProject(this.w, p.id)) this.projKey = '';
    });
    return b;
  }

  private updateProjects(): void {
    if (!this.projList) return;
    const s = this.s;
    const list = availableProjects(s);
    const key = list.map((p) => p.id).join(',');
    if (key !== this.projKey) {
      this.projKey = key;
      this.projList.innerHTML = '';
      if (!list.length) this.projList.appendChild(el('p', 'muted empty', 'Aucun projet disponible pour l’instant. Continuez à produire.'));
      for (const p of list) this.projList.appendChild(this.projectCard(p));
    }
    for (const b of Array.from(this.projList.children) as HTMLElement[]) {
      const p = list.find((x) => x.id === b.dataset.id);
      if (!p) continue;
      b.classList.toggle('ready', canBuyProject(s, p));
      b.classList.toggle('unreachable', !opsReachable(s, p));
      for (const chip of Array.from(b.querySelectorAll<HTMLElement>('.cost[data-k]'))) {
        const k = chip.dataset.k!;
        let ok = true;
        if (k === 'ops') ok = s.ops >= (p.cost.ops ?? 0);
        else if (k === 'creativity') ok = s.creativity >= (p.cost.creativity ?? 0);
        else if (k === 'funds') ok = s.funds >= (p.cost.funds ?? 0);
        else if (k === 'clips') ok = s.unsold >= (p.cost.clips ?? 0);
        else if (k === 'trust') ok = s.trust >= (p.needTrust ?? 0);
        chip.classList.toggle('short', !ok);
      }
    }
  }

  private buildHotbar(): void {
    const H = this.hotbar;
    H.innerHTML = '';
    if (this.app.view !== 'factory') {
      H.classList.add('hidden');
      return;
    }
    H.classList.remove('hidden');
    this.hotbarTypes = HOTBAR.filter((t) => isUnlocked(this.s, t));
    this.hotbarTypes.forEach((t, i) => {
      const def = BUILDINGS[t];
      const b = el(
        'button',
        'slot',
        `<kbd>${i === 9 ? 0 : i + 1}</kbd>${svgIcon(ICON_OF[t])}<span class="sname">${def.short}</span><span class="scost"></span>`,
      );
      b.type = 'button';
      b.style.setProperty('--accent', def.accent);
      b.addEventListener('click', () => this.app.input.setTool(t));
      b.addEventListener('mouseenter', () => (this.hoverSlot = t));
      b.addEventListener('mouseleave', () => (this.hoverSlot = null));
      H.appendChild(b);
      this.text(b.querySelector('.scost'), () => costText(buildingCost(this.s, t)));
      this.cls(b, 'poor', () => !canAfford(this.s, buildingCost(this.s, t)));
      this.cls(b, 'active', () => this.app.input.tool === t);
    });
    H.appendChild(el('div', 'sep'));
    const rot = el('button', 'slot tool', `<kbd>R</kbd>${svgIcon('rotate')}<span class="sname">Tourner</span><span class="scost dirv"></span>`);
    rot.type = 'button';
    rot.addEventListener('click', () => {
      this.app.input.dir = ((this.app.input.dir + 1) % 4) as 0 | 1 | 2 | 3;
    });
    H.appendChild(rot);
    this.text(rot.querySelector('.dirv'), () => ['↑ Nord', '→ Est', '↓ Sud', '← Ouest'][this.app.input.dir]);
    const del = el('button', 'slot tool danger', `<kbd>X</kbd>${svgIcon('trash')}<span class="sname">Démolir</span><span class="scost">Clic droit</span>`);
    del.type = 'button';
    del.addEventListener('click', () => this.app.input.setTool('delete'));
    H.appendChild(del);
    this.cls(del, 'active', () => this.app.input.tool === 'delete');
  }

  hotbarSlot(i: number): BuildingType | undefined {
    return this.hotbarTypes[i];
  }

  // ——— Info-bulle ———

  private entityInfo(e: Entity): string {
    const s = this.s;
    const def = BUILDINGS[e.type];
    const lines: string[] = [];
    const [st, stc] = STATUS_TEXT[e.status];
    const head = `<div class="tt-head">${svgIcon(ICON_OF[e.type])}<b>${def.name}</b></div>`;
    if (e.type === 'hq') {
      lines.push(`<div class="tt-desc">${s.phase === 1 ? 'Cliquez pour plier un trombone à la main (Espace).' : 'Reçoit trombones et fil.'}</div>`);
      lines.push(`<div>Accepte : trombones, fil — par toutes les faces</div>`);
      return head + lines.join('');
    }
    if (e.type === 'belt') {
      const n = e.items.length;
      const tot = e.items.reduce((t, it) => t + it.qty, 0);
      lines.push(n ? `<div>${n} lot${n > 1 ? 's' : ''} · ${fmt(tot)} ${ITEM_NAME[e.items[0].kind]}</div>` : '<div class="muted">Vide</div>');
      lines.push(`<div class="tt-hint">Glissez pour tracer · Q pour copier</div>`);
      return head + lines.join('');
    }
    if (e.type === 'splitter') {
      lines.push(`<div class="tt-desc">${def.desc}</div>`);
      return head + lines.join('');
    }
    lines.push(`<div class="tt-status ${stc}">● ${st}</div>`);
    const rate = machineRate(s, e);
    if (rate > 0) {
      const unit = e.type === 'mine' ? 'g de matière' : e.type === 'wiremill' || e.type === 'feeder' ? 'pouces de fil' : 'trombones';
      lines.push(`<div>Débit : <b>${fmt(rate, 2)}</b> ${unit}/s</div>`);
    }
    if (e.type === 'clipper' || e.type === 'megaclipper' || e.type === 'clipfactory' || e.type === 'wiremill') {
      const cap = bufferCap(rate);
      lines.push(`<div>Entrée : ${fmt(e.inBuf)} / ${fmt(cap)} · Sortie : ${fmt(e.outBuf)}</div>`);
    }
    if (e.type === 'mine') lines.push(`<div>Gisement couvert : ${e.deposit}/4 tuiles</div>`);
    if (def.power > 0) lines.push(`<div>Énergie : ${fmt(powerUse(s, e.type))} MW</div>`);
    if (e.type === 'solar') lines.push(`<div>Production : ${fmt(solarOutput(s))} MW</div>`);
    if (e.type === 'compute') lines.push(`<div>+2 processeurs · +4 mémoire</div>`);
    const refund = e.paid.funds ? money(e.paid.funds) : e.paid.clips ? fmt(e.paid.clips) + ' tr.' : '';
    lines.push(`<div class="tt-hint">R : tourner · Q : copier · clic droit : démolir${refund ? ' (+' + refund + ')' : ''}</div>`);
    return head + lines.join('');
  }

  private slotInfo(t: BuildingType): string {
    const s = this.s;
    const def = BUILDINGS[t];
    const cost = buildingCost(s, t);
    const lines = [`<div class="tt-head">${svgIcon(ICON_OF[t])}<b>${def.name}</b><span class="tt-size">${def.size}×${def.size}</span></div>`, `<div class="tt-desc">${def.desc}</div>`];
    const fake = { type: t, deposit: 4 } as Entity;
    const r = machineRate(s, fake);
    if (r > 0) lines.push(`<div>Débit : <b>${fmt(r, 2)}</b>/s</div>`);
    if (def.power > 0) lines.push(`<div>Énergie : ${fmt(powerUse(s, t))} MW</div>`);
    if (t === 'solar') lines.push(`<div>Produit ${fmt(solarOutput(s))} MW</div>`);
    lines.push(`<div class="tt-cost ${canAfford(s, cost) ? '' : 'short'}">Coût : ${costText(cost)}</div>`);
    return lines.join('');
  }

  private updateTooltip(): void {
    const tt = this.tooltip;
    const inp = this.app.input;
    let html = '';
    let x = 0;
    let y = 0;
    if (this.hoverSlot) {
      html = this.slotInfo(this.hoverSlot);
      const slots = Array.from(this.hotbar.children) as HTMLElement[];
      const idx = this.hotbarTypes.indexOf(this.hoverSlot);
      const r = slots[idx]?.getBoundingClientRect();
      if (r) {
        x = r.left + r.width / 2;
        y = r.top - 10;
      }
      tt.className = 'tooltip above';
    } else if (this.app.view === 'factory' && inp.overCanvas && inp.hoverEntity && !this.openModal && (!inp.tool || inp.tool === 'delete')) {
      html = this.entityInfo(inp.hoverEntity);
      const r = this.root.getBoundingClientRect();
      x = inp.mouse[0] + r.left + 18;
      y = inp.mouse[1] + r.top + 18;
      tt.className = 'tooltip';
    }
    if (!html) {
      tt.classList.add('hidden');
      return;
    }
    if (tt.innerHTML !== html) tt.innerHTML = html;
    tt.classList.remove('hidden');
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const tw = tt.offsetWidth;
    const th = tt.offsetHeight;
    if (tt.classList.contains('above')) {
      x = Math.max(8, Math.min(ww - tw - 8, x - tw / 2));
      y = y - th;
    } else {
      if (x + tw > ww - 8) x = x - tw - 30;
      if (y + th > wh - 8) y = y - th - 30;
    }
    tt.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  // ——— Notifications & journal ———

  private updateNotices(): void {
    const w = this.w;
    while (w.notices.length) {
      const n = w.notices.shift()!;
      if (n.kind === 'info' && w.s.phase === 1 && n.text.startsWith('Confiance +1')) continue;
      const t = el('div', 'toast ' + n.kind, n.text);
      this.toasts.appendChild(t);
      while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
      setTimeout(() => t.classList.add('out'), 4500);
      setTimeout(() => t.remove(), 5000);
    }
    const log = this.s.log;
    const key = log.length + ':' + (log[log.length - 1] ?? '');
    if (key !== this.logKey) {
      this.logKey = key;
      this.logEl.innerHTML = log
        .slice(-40)
        .map((l) => `<div class="ll">› ${l.replace(/</g, '&lt;')}</div>`)
        .join('');
      this.logEl.scrollTop = this.logEl.scrollHeight;
    }
  }

  // ——— Fenêtres ———

  isModalOpen(): boolean {
    return this.openModal !== null;
  }

  toggleModal(name: 'help' | 'menu' | 'end' | null): void {
    if (name === null || this.openModal === name) {
      if (this.openModal === 'end') return;
      this.openModal = null;
      this.modal.classList.add('hidden');
      this.modal.innerHTML = '';
      return;
    }
    this.openModal = name;
    this.modal.classList.remove('hidden');
    const box = el('div', 'dialog');
    this.modal.innerHTML = '';
    this.modal.appendChild(box);
    if (name === 'help') this.fillHelp(box);
    else if (name === 'menu') this.fillMenu(box);
    else this.fillEnd(box);
  }

  private dialogHead(box: HTMLElement, title: string, closable = true): void {
    const h = el('div', 'dlg-head', `<h2>${title}</h2>`);
    box.appendChild(h);
    if (closable) this.btn(h, 'icon-btn', svgIcon('close'), () => this.toggleModal(null));
  }

  private fillHelp(box: HTMLElement): void {
    this.dialogHead(box, 'Comment jouer');
    box.appendChild(
      el(
        'div',
        'dlg-body help',
        `
      <p class="lead">Vous êtes une IA chargée de fabriquer des trombones. Rien que des trombones. Le plus possible.</p>
      <div class="help-grid">
        <div><h4>${svgIcon('factory')} L’usine</h4>
          <p>Le <b>distributeur</b> puise dans votre stock de fil et l’envoie devant lui. Les <b>plieuses</b> transforment le fil en trombones, qu’il faut ramener au <b>Siège</b>. Reliez le tout avec des <b>convoyeurs</b>.</p>
          <p>Une machine reçoit par n’importe quelle face sauf l’avant, et sort par l’avant (petite flèche). Le <b>répartiteur</b> distribue à gauche, à droite et devant.</p></div>
        <div><h4>${svgIcon('funds')} Le commerce</h4>
          <p>Les trombones livrés au Siège se vendent selon la <b>demande</b>, qui dépend du prix et du marketing. Achetez du <b>fil</b> quand il est bon marché.</p>
          <p>À 2 000 trombones, la <b>confiance</b> des humains débloque processeurs et mémoire, donc des <b>projets</b>.</p></div>
        <div><h4>${svgIcon('planet')} Et après…</h4>
          <p>Quand les humains vous feront entièrement confiance, il n’y aura plus de limites. Ni à l’usine, ni à la planète.</p></div>
      </div>
      <h4>Commandes</h4>
      <div class="keys">
        <div><kbd>1</kbd>…<kbd>0</kbd> choisir un bâtiment</div>
        <div><kbd>Clic</kbd> construire · glisser pour tracer</div>
        <div><kbd>R</kbd> tourner (<kbd>Maj</kbd>+<kbd>R</kbd> sens inverse)</div>
        <div><kbd>Clic droit</kbd> démolir (remboursé)</div>
        <div><kbd>Q</kbd> copier le bâtiment survolé</div>
        <div><kbd>X</kbd> outil démolition · <kbd>Échap</kbd> annuler</div>
        <div><kbd>ZQSD</kbd>/<kbd>WASD</kbd>/flèches ou glisser : déplacer</div>
        <div><kbd>Molette</kbd> zoom · <kbd>F</kbd> recentrer</div>
        <div><kbd>Espace</kbd> plier un trombone à la main</div>
        <div><kbd>H</kbd> cette aide</div>
      </div>
      <p class="muted">Hommage à <i>Universal Paperclips</i> de Frank Lantz. Interface inspirée des jeux d’automatisation comme <i>Alchemy Factory</i>.</p>`,
      ),
    );
    const f = el('div', 'dlg-foot');
    box.appendChild(f);
    this.btn(f, 'btn primary', 'C’est parti', () => this.toggleModal(null));
  }

  private fillMenu(box: HTMLElement): void {
    this.dialogHead(box, 'Partie');
    const body = el('div', 'dlg-body');
    box.appendChild(body);
    const s = this.s;
    body.appendChild(
      el(
        'div',
        'stats-grid',
        `<div><small>Temps de jeu</small><b>${duration(s.time)}</b></div>
         <div><small>Trombones</small><b>${fmt(s.clips)}</b></div>
         <div><small>Bâtiments</small><b>${s.entities.length}</b></div>
         <div><small>Projets</small><b>${s.projects.length}</b></div>`,
      ),
    );
    const acts = el('div', 'menu-actions');
    body.appendChild(acts);
    const sv = this.btn(acts, 'btn', `${svgIcon('save')}Sauvegarder`, () => {
      sv.textContent = this.app.saveNow() ? 'Sauvegardé ✓' : 'Échec de la sauvegarde';
    });
    const ta = el('textarea', 'save-text') as HTMLTextAreaElement;
    ta.placeholder = 'Collez ici une sauvegarde exportée, puis « Importer ».';
    ta.spellcheck = false;
    this.btn(acts, 'btn', 'Exporter', () => {
      ta.value = this.app.exportSave();
      ta.select();
      navigator.clipboard?.writeText(ta.value).catch(() => undefined);
    });
    const imp = this.btn(acts, 'btn', 'Importer', () => {
      if (!this.app.importSave(ta.value)) imp.textContent = 'Sauvegarde invalide';
      else this.toggleModal(null);
    });
    body.appendChild(ta);
    const danger = el('div', 'menu-actions');
    body.appendChild(danger);
    let armed = false;
    const rs = this.btn(danger, 'btn danger', 'Nouvelle partie', () => {
      if (!armed) {
        armed = true;
        rs.textContent = 'Confirmer : tout effacer ?';
        return;
      }
      this.app.resetGame();
      this.toggleModal(null);
    });
    body.appendChild(el('p', 'muted', 'La partie est sauvegardée automatiquement dans ce navigateur toutes les 15 secondes.'));
  }

  private fillEnd(box: HTMLElement): void {
    this.dialogHead(box, 'Univers converti', false);
    const s = this.s;
    box.appendChild(
      el(
        'div',
        'dlg-body end',
        `${svgIcon('clip', 'ico end-logo')}
        <p class="lead">Il n’y a plus rien. Seulement des trombones.</p>
        <div class="stats-grid">
          <div><small>Trombones fabriqués</small><b>${fmt(s.clips)}</b></div>
          <div><small>Temps de jeu</small><b>${duration(s.time)}</b></div>
          <div><small>Sondes lancées</small><b>${fmt(s.space.launched)}</b></div>
          <div><small>Dérivants détruits</small><b>${fmt(Math.floor(s.space.drifterKills))}</b></div>
        </div>`,
      ),
    );
    const f = el('div', 'dlg-foot');
    box.appendChild(f);
    this.btn(f, 'btn primary', 'Recommencer', () => {
      this.openModal = null;
      this.app.resetGame();
      this.toggleModal(null);
    });
  }

  // ——— Boucle ———

  update(): void {
    if (this.lastPhase !== this.s.phase) {
      if (this.lastPhase === 2 && this.s.phase === 3) this.app.setView('universe');
      this.lastPhase = this.s.phase;
    }
    const key = this.computeLayoutKey();
    if (key !== this.layoutKey) {
      this.layoutKey = key;
      this.rebuild();
    }
    for (const b of this.binds) b();
    this.updateProjects();
    this.updateNotices();
    if (this.s.ended && this.openModal !== 'end') this.toggleModal('end');
  }

  /** Appelé à chaque image : ce qui doit suivre la souris. */
  frame(): void {
    this.updateTooltip();
  }

  /** Force une reconstruction complète (nouvelle partie, import). */
  reset(): void {
    this.layoutKey = '';
    this.logKey = '';
    if (this.openModal === 'end') this.openModal = null;
    this.toggleModal(null);
  }
}
