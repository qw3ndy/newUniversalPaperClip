import { duration, fmt } from '../game/format';
import { PERKS, perkCost } from '../game/legacy';
import { SCENARIOS, scenarioName } from '../game/scenarios';
import type { GameState } from '../game/types';
import { svgIcon } from '../render/icons';
import type { App } from './hud';

interface HomeHelpers {
  btn(parent: HTMLElement, cls: string, html: string, onClick: () => void): HTMLButtonElement;
  close(): void;
  /** Redessine l'accueil (après un achat). */
  refresh(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

const PHASES = ['', 'Entreprise', 'Terre', 'Univers'];

function summary(s: GameState): string {
  return `Phase ${s.phase} · ${PHASES[s.phase]} · ${fmt(s.clips)} trombones · ${duration(s.time)}`;
}

/** Un bouton qui demande un second clic avant d'agir (actions destructrices). */
function confirmBtn(h: HomeHelpers, parent: HTMLElement, cls: string, label: string, confirm: string, act: () => void): void {
  let armed = false;
  const b = h.btn(parent, cls, label, () => {
    if (!armed) {
      armed = true;
      b.textContent = confirm;
      b.classList.add('armed');
      return;
    }
    act();
  });
}

/** Écran d'accueil : partie classique d'un côté, scénarios et héritage de l'autre. */
export function fillHome(box: HTMLElement, app: App, h: HomeHelpers): void {
  const head = el('div', 'dlg-head', `<h2>${svgIcon('clip', 'ico logo')} Trombones Universels</h2>`);
  box.appendChild(head);
  // Pas de fermeture tant qu'aucune partie n'a été choisie (première visite).
  if (app.peek(app.slot())) h.btn(head, 'icon-btn', svgIcon('close'), () => h.close());

  const body = el('div', 'dlg-body');
  box.appendChild(body);
  const grid = el('div', 'home-grid');
  body.appendChild(grid);

  // ——— Partie classique ———
  const classic = el(
    'section',
    'home-card',
    `<h3>${svgIcon('clip')}Partie classique</h3>
     <p>Le jeu tel que vous le connaissez, sans aucune règle modifiée. Votre partie classique est sauvegardée à part : les scénarios n’y touchent jamais.</p>`,
  );
  grid.appendChild(classic);
  const cs = app.peek('classic');
  const cActs = el('div', 'home-actions');
  if (cs) {
    classic.appendChild(el('div', 'home-sum', summary(cs)));
    classic.appendChild(cActs);
    h.btn(cActs, 'btn primary', 'Continuer', () => app.continueSlot('classic'));
    confirmBtn(h, cActs, 'btn danger', 'Nouvelle partie', 'Effacer la partie classique ?', () => app.startClassic());
  } else {
    classic.appendChild(cActs);
    h.btn(cActs, 'btn primary', 'Commencer', () => app.continueSlot('classic'));
  }

  // ——— Scénarios ———
  const scen = el(
    'section',
    'home-card',
    `<h3>${svgIcon('target')}Scénarios</h3>
     <p>Des défis aux règles modifiées. Terminez-les pour gagner des fragments, à dépenser en bonus pour les parties suivantes.</p>`,
  );
  grid.appendChild(scen);
  const ss = app.peek('scenario');
  const running = ss && !ss.ended ? ss : null;
  if (running) {
    const cur = el('div', 'home-current', `<b>En cours : ${scenarioName(running)}</b><span>${summary(running)}</span>`);
    scen.appendChild(cur);
    h.btn(cur, 'btn primary', 'Continuer', () => app.continueSlot('scenario'));
  }
  const list = el('div', 'scen-list');
  scen.appendChild(list);
  const L = app.legacy;
  for (const d of SCENARIOS) {
    const rec = L.records[d.id];
    const row = el(
      'div',
      'scen',
      `${svgIcon(d.icon)}<div class="scen-t"><b>${d.name}</b><span>${d.desc}</span>
       <small>${d.difficulty > 1 ? `Fragments ×${String(d.difficulty).replace('.', ',')}` : 'Fragments ×1'}${rec !== undefined ? ` · Record : ${duration(rec)}` : ''}</small></div>`,
    );
    list.appendChild(row);
    if (running) confirmBtn(h, row, 'btn', 'Lancer', 'Abandonner l’actuel ?', () => app.startScenario(d.id));
    else h.btn(row, 'btn', 'Lancer', () => app.startScenario(d.id));
  }

  // ——— Héritage ———
  const leg = el(
    'section',
    'home-card legacy',
    `<h3>${svgIcon('trust')}Héritage<span class="frag">◆ ${L.fragments} fragment${L.fragments > 1 ? 's' : ''}</span></h3>
     <p>Bonus permanents pour les nouvelles parties de scénario. Ils ne s’appliquent jamais à la partie classique, ni à un scénario déjà commencé.</p>`,
  );
  body.appendChild(leg);
  const perks = el('div', 'perk-grid');
  leg.appendChild(perks);
  for (const p of PERKS) {
    const lvl = L.perks[p.id] ?? 0;
    const maxed = lvl >= p.max;
    const dots = Array.from({ length: p.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
    const card = el(
      'div',
      'perk',
      `${svgIcon(p.icon)}<div class="perk-t"><b>${p.name}</b><span>${p.desc(maxed ? lvl : lvl + 1)}</span><div class="dots">${dots}</div></div>`,
    );
    perks.appendChild(card);
    const cost = perkCost(p, lvl);
    const b = h.btn(card, 'btn', maxed ? 'Max' : `◆ ${cost}`, () => {
      if (app.buyPerk(p.id)) h.refresh();
    });
    b.disabled = maxed || L.fragments < cost;
  }
  if (L.runs === 0) leg.appendChild(el('p', 'muted', 'Terminez un premier scénario (conversion complète de l’univers) pour gagner vos premiers fragments.'));
}
