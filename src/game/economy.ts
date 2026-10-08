import { COMPUTING_AT, TRUST_RATIO } from './constants';
import { fmtFull } from './format';
import {
  creativityRate,
  demandOf,
  marketingCost,
  maxOps,
  opsRate,
  salesRate,
  spoolSize,
  trustAvailable,
} from './rules';
import { deliverClips } from './sim';
import type { World } from './world';

/** Arrondit au millier supérieur (seuils de confiance lisibles). */
function niceCeil(n: number): number {
  const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1));
  return Math.ceil(n / mag) * mag;
}

export function makeClipByHand(w: World): boolean {
  const s = w.s;
  if (s.phase !== 1 || s.wire < 1) return false;
  s.wire -= 1;
  deliverClips(w, 1);
  return true;
}

export function buyWire(w: World): boolean {
  const s = w.s;
  if (s.phase !== 1 || s.funds < s.wirePrice) return false;
  s.funds -= s.wirePrice;
  s.wire += spoolSize(s);
  s.spoolsBought++;
  s.wireBasePrice += 0.05;
  return true;
}

export function buyMarketing(w: World): boolean {
  const s = w.s;
  const c = marketingCost(s);
  if (s.phase !== 1 || s.funds < c) return false;
  s.funds -= c;
  s.marketingLvl++;
  return true;
}

export function changePrice(w: World, delta: number): void {
  const s = w.s;
  s.margin = Math.max(0.01, Math.round((s.margin + delta) * 100) / 100);
}

export function addProcessor(w: World): boolean {
  if (trustAvailable(w.s) < 1) return false;
  w.s.processors++;
  return true;
}

export function addMemory(w: World): boolean {
  if (trustAvailable(w.s) < 1) return false;
  w.s.memory++;
  return true;
}

function stepBusiness(w: World, dt: number): void {
  const s = w.s;
  s.demand = demandOf(s);
  s.salesAccum += salesRate(s) * dt;
  if (s.salesAccum >= 1) {
    const want = Math.floor(s.salesAccum);
    s.salesAccum -= want;
    const sold = Math.min(want, Math.floor(s.unsold));
    if (sold > 0) {
      s.unsold -= sold;
      const rev = sold * s.margin;
      s.funds += rev;
      w.acc.sales += sold;
      w.acc.revenue += rev;
    }
  }
  // Prix du fil : une base qui dérive lentement à la baisse, plus une oscillation.
  if (Math.random() < 0.15 * dt && s.wireBasePrice > 15) s.wireBasePrice -= s.wireBasePrice / 1000;
  s.wirePrice = Math.max(1, Math.round(s.wireBasePrice + 6 * Math.sin(s.time * 0.21)));
  if (s.wireBuyer && s.wireBuyerOn && s.wire < 1) buyWire(w);

  // Filet de sécurité : ni fil, ni stock, ni fonds → le fournisseur fait crédit d'une bobine.
  w.stuckTimer += dt;
  if (w.stuckTimer >= 5) {
    w.stuckTimer = 0;
    if (s.wire < 1 && s.unsold < 1 && s.funds < s.wirePrice && wireInFactory(w) < 1) {
      s.wire += spoolSize(s);
      w.notify('À court de tout ? Le fournisseur vous fait crédit d’une bobine de fil.', 'warn');
    }
  }
}

function wireInFactory(w: World): number {
  let t = 0;
  for (const e of w.s.entities) {
    if (e.type === 'clipper' || e.type === 'megaclipper') t += e.inBuf + e.outBuf;
    if (e.out) t += e.out.qty;
    for (const it of e.items) t += it.qty;
  }
  return t;
}

function stepComputing(w: World, dt: number): void {
  const s = w.s;
  if (!s.computing) {
    if (s.clips >= COMPUTING_AT) {
      s.computing = true;
      s.trust = 2;
      s.processors = 1;
      s.memory = 1;
      s.nextTrustAt = 3000;
      w.notify('Ressources de calcul disponibles. La confiance des humains vous donne des processeurs et de la mémoire.', 'good');
    }
    return;
  }
  if (s.phase === 1) {
    while (s.clips >= s.nextTrustAt) {
      s.trust++;
      s.nextTrustAt = niceCeil(s.nextTrustAt * TRUST_RATIO);
      w.notify(`Confiance +1 (${s.trust}). Prochain palier : ${fmtFull(s.nextTrustAt)} trombones.`, 'good');
    }
  }
  const max = maxOps(s);
  if (s.ops < max) {
    s.ops = Math.min(max, s.ops + opsRate(s) * dt);
  } else {
    if (s.ops > max) s.ops = max;
    if (!s.flags.opsMaxed && max > 0) s.flags.opsMaxed = true;
    if (s.creativityOn) s.creativity += creativityRate(s) * dt;
  }
}

function stepStats(w: World, dt: number): void {
  const a = w.acc;
  a.t += dt;
  if (a.t < 0.5) return;
  const s = w.s.stats;
  const k = 0.35;
  s.clipRate += (a.clips / a.t - s.clipRate) * k;
  s.salesRate += (a.sales / a.t - s.salesRate) * k;
  s.revenueRate += (a.revenue / a.t - s.revenueRate) * k;
  s.matterRate += (a.matter / a.t - s.matterRate) * k;
  a.clips = a.sales = a.revenue = a.matter = a.t = 0;
}

export function stepEconomy(w: World, dt: number): void {
  if (w.s.phase === 1) stepBusiness(w, dt);
  stepComputing(w, dt);
  stepStats(w, dt);
}
