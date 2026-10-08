/**
 * Icônes « au trait » (viewBox 24×24), partagées entre le DOM (SVG) et le canvas (Path2D).
 */
export const ICONS = {
  clip: 'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48',
  wire: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0',
  matter: 'M12 2l8 5v10l-8 5-8-5V7z M12 2v20 M4 7l8 5 8-5',
  belt: 'M5 6l6 6-6 6 M13 6l6 6-6 6',
  splitter: 'M3 12h7 M10 12l8-7 M10 12h11 M10 12l8 7 M15 5h3v3 M15 19h3v-3',
  feeder: 'M6 3h12 M6 21h12 M8 3v18 M16 3v18 M8 8h8 M8 12h8 M8 16h8',
  clipper:
    'M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1l2.1-2.1 M17 7l2.1-2.1',
  megaclipper: 'M3 3h18v18H3z M8 8a2.5 2.5 0 1 0 0 .01 M16 8a2.5 2.5 0 1 0 0 .01 M8 16a2.5 2.5 0 1 0 0 .01 M16 16a2.5 2.5 0 1 0 0 .01',
  mine: 'M12 2v5 M7 7h10l-2.5 9h-5z M12 16v5 M4 21h16',
  wiremill: 'M4 4h8 M4 20h8 M6 4v16 M10 4v16 M14 12h7 M18 9l3 3-3 3',
  clipfactory:
    'M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z M17 18h1 M12 18h1 M7 18h1',
  solar: 'M3 10h18l-2 9H5z M7.5 10l-1 9 M12 10v9 M16.5 10l1 9 M4 14.5h16 M12 2v3 M5 4l1.5 1.5 M19 4l-1.5 1.5',
  compute: 'M6 6h12v12H6z M9.5 9.5h5v5h-5z M9 2v4 M15 2v4 M9 18v4 M15 18v4 M2 9h4 M2 15h4 M18 9h4 M18 15h4',
  depot: 'M21 8l-9-5-9 5v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8',
  hq: 'M3 21h18 M5 21V8l7-5 7 5v13 M9.5 21v-5h5v5 M9 10h6 M9 13h6',
  rotate: 'M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5',
  trash: 'M3 6h18 M8 6V4h8v2 M6 6l1 14h10l1-14 M10 10v6 M14 10v6',
  funds: 'M12 2v20 M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  trust: 'M12 20.5s-8-5-8-10.5a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 10.5-8 10.5z',
  cpu: 'M6 6h12v12H6z M9.5 9.5h5v5h-5z M9 2v4 M15 2v4 M9 18v4 M15 18v4 M2 9h4 M2 15h4 M18 9h4 M18 15h4',
  memory: 'M3 7h18v10H3z M7 11v2 M11 11v2 M15 11v2 M5 17v3 M19 17v3 M9 17v3 M14 17v3',
  ops: 'M13 2L4 14h7l-1 8 9-12h-7z',
  creativity: 'M9 18h6 M10 22h4 M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z',
  probe:
    'M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z M12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0 M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5',
  planet: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0 M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20',
  galaxy: 'M12 12a2 2 0 1 0 0 .01 M12 4c5 0 8 4 6 8s-7 4-8 1 2-5 5-3 M12 20c-5 0-8-4-6-8s7-4 8-1-2 5-5 3',
  factory: 'M3 21V10l5 3V10l5 3V5h4l1 16z M3 21h18',
  help: 'M12 22a10 10 0 1 0 0-20a10 10 0 1 0 0 20 M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  target: 'M12 22a10 10 0 1 0 0-20a10 10 0 1 0 0 20 M12 18a6 6 0 1 0 0-12a6 6 0 1 0 0 12 M12 14a2 2 0 1 0 0-4a2 2 0 1 0 0 4',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  close: 'M18 6L6 18 M6 6l12 12',
  minus: 'M5 12h14',
  plus: 'M12 5v14 M5 12h14',
  cart: 'M6 6h15l-1.5 9h-12z M6 6L5 3H2 M9 20a1 1 0 1 0 0 .01 M18 20a1 1 0 1 0 0 .01',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z M17 8a5 5 0 0 1 0 8 M20 5a9 9 0 0 1 0 14',
  hand: 'M18 11V6a2 2 0 0 0-4 0v5 M14 10V4a2 2 0 0 0-4 0v6 M10 10.5V6a2 2 0 0 0-4 0v8 M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
  skull: 'M12 3a8 8 0 0 0-8 8c0 3 1.5 5 3.5 6v3h9v-3c2-1 3.5-3 3.5-6a8 8 0 0 0-8-8z M9 12a1 1 0 1 0 0 .01 M15 12a1 1 0 1 0 0 .01 M10 20v-2 M14 20v-2',
} as const;

export type IconName = keyof typeof ICONS;

export function svgIcon(name: IconName, cls = 'ico'): string {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
}

const pathCache = new Map<IconName, Path2D>();

export function iconPath(name: IconName): Path2D {
  let p = pathCache.get(name);
  if (!p) {
    p = new Path2D(ICONS[name]);
    pathCache.set(name, p);
  }
  return p;
}

/** Dessine une icône centrée en (cx, cy) avec une taille en pixels. */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  name: IconName,
  cx: number,
  cy: number,
  size: number,
  color: string,
  width = 2,
): void {
  const k = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(k, k);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(iconPath(name));
  ctx.restore();
}
