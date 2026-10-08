const SUFFIXES = ['', 'k', 'M', 'Md', 'Bn', 'Bd', 'Tn', 'Td', 'Qn', 'Qd', 'Qin', 'Qid'];

const intFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const dec2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Nombre compact : 1,23 M ; 4,5 Md ; au-delà, notation scientifique. */
export function fmt(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return '∞';
  const neg = n < 0;
  let v = Math.abs(n);
  if (v < 1000) {
    const s = v < 10 && v % 1 !== 0 ? v.toFixed(Math.min(digits, 1)).replace('.', ',') : intFmt.format(Math.floor(v));
    return (neg ? '-' : '') + s;
  }
  let i = 0;
  while (v >= 1000 && i < SUFFIXES.length - 1) {
    v /= 1000;
    i++;
  }
  let d = v >= 100 ? 0 : v >= 10 ? 1 : digits;
  // 999,99 M s'arrondirait en « 1000 M » : on passe à l'unité suivante.
  if (Number(v.toFixed(d)) >= 1000 && i < SUFFIXES.length - 1) {
    v /= 1000;
    i++;
    d = digits;
  }
  if (v >= 1000) {
    return (neg ? '-' : '') + Math.abs(n).toExponential(2).replace('.', ',').replace('e+', 'e');
  }
  return (neg ? '-' : '') + v.toFixed(d).replace('.', ',') + ' ' + SUFFIXES[i];
}

/** Nombre entier complet (avec espaces) tant qu'il reste lisible. */
export function fmtFull(n: number): string {
  if (Math.abs(n) < 1e15) return intFmt.format(Math.floor(n));
  return fmt(n);
}

export function money(n: number): string {
  if (Math.abs(n) < 1e6) return dec2.format(n) + ' $';
  return fmt(n) + ' $';
}

export function pct(f: number, digits = 1): string {
  return (f * 100).toFixed(digits).replace('.', ',') + ' %';
}

export function duration(sec: number): string {
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m > 0) return `${m} min ${String(s).padStart(2, '0')} s`;
  return `${s} s`;
}
