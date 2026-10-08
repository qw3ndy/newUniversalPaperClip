import { mulberry32 } from '../game/world';
import type { GameState } from '../game/types';

interface Star {
  x: number;
  y: number;
  r: number;
  rank: number; // ordre d'exploration (0..1)
  tw: number;
}

/** Vue « Univers » de la phase 3 : une galaxie que les sondes colonisent depuis le centre. */
export class UniverseView {
  private stars: Star[] = [];
  private seed = -1;

  private build(seed: number): void {
    const rnd = mulberry32(seed ^ 0xa11a);
    const stars: Star[] = [];
    const ARMS = 3;
    for (let i = 0; i < 2600; i++) {
      const arm = i % ARMS;
      const d = Math.pow(rnd(), 0.7);
      const a = (arm * Math.PI * 2) / ARMS + d * 5.2 + (rnd() - 0.5) * 0.7;
      const spread = 0.05 + d * 0.08;
      const x = Math.cos(a) * d + (rnd() - 0.5) * spread;
      const y = Math.sin(a) * d + (rnd() - 0.5) * spread;
      stars.push({ x, y, r: 0.6 + rnd() * 1.4, rank: Math.min(1, d * 0.92 + rnd() * 0.08), tw: rnd() * 10 });
    }
    // Galaxies lointaines : explorées en dernier.
    for (let gI = 0; gI < 7; gI++) {
      const gx = (rnd() - 0.5) * 3.2;
      const gy = (rnd() - 0.5) * 2.2;
      if (Math.hypot(gx, gy) < 1.2) continue;
      for (let k = 0; k < 90; k++) {
        const a = rnd() * Math.PI * 2;
        const d = Math.pow(rnd(), 1.5) * 0.12;
        stars.push({
          x: gx + Math.cos(a) * d,
          y: gy + Math.sin(a) * d * 0.6,
          r: 0.5 + rnd(),
          rank: 0.9 + rnd() * 0.1,
          tw: rnd() * 10,
        });
      }
    }
    stars.sort((a, b) => a.rank - b.rank);
    this.stars = stars;
    this.seed = seed;
  }

  draw(ctx: CanvasRenderingContext2D, s: GameState, wPx: number, hPx: number, dpr: number, now: number): void {
    if (this.seed !== s.seed) this.build(s.seed);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createRadialGradient(wPx / 2, hPx / 2, 0, wPx / 2, hPx / 2, Math.max(wPx, hPx) * 0.7);
    bg.addColorStop(0, '#11142a');
    bg.addColorStop(1, '#05060c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, wPx, hPx);

    const sp = s.space;
    const scale = Math.min(wPx, hPx) * 0.42;
    const cx = wPx / 2;
    const cy = hPx / 2 + 10;
    const rot = now * 0.01;
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);

    for (const st of this.stars) {
      const x = cx + (st.x * cr - st.y * sr) * scale;
      const y = cy + (st.x * sr + st.y * cr) * scale * 0.62;
      const tw = 0.75 + 0.25 * Math.sin(now * 2 + st.tw);
      if (st.rank <= sp.converted) {
        ctx.fillStyle = `rgba(160,215,255,${0.85 * tw})`;
        ctx.fillRect(x - st.r * 0.9, y - st.r * 0.9, st.r * 1.8, st.r * 1.8);
      } else if (st.rank <= sp.explored) {
        ctx.fillStyle = `rgba(255,224,150,${0.9 * tw})`;
        ctx.beginPath();
        ctx.arc(x, y, st.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(150,160,200,${0.22 * tw})`;
        ctx.beginPath();
        ctx.arc(x, y, st.r * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Front d'exploration
    if (sp.explored > 0 && sp.explored < 1) {
      ctx.strokeStyle = 'rgba(255,207,92,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, sp.explored * scale * 1.05, sp.explored * scale * 0.65, rot, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sondes et Dérivants
    const nProbes = Math.min(260, Math.round(6 * Math.pow(Math.log10(1 + sp.probes), 1.6)));
    const nDrift = sp.probes + sp.drifters > 0 ? Math.min(200, Math.round((nProbes * sp.drifters) / (sp.probes + sp.drifters + 1e-9) * 1.5)) : 0;
    const reach = Math.max(0.08, sp.explored);
    const drawSwarm = (n: number, color: string, salt: number) => {
      ctx.fillStyle = color;
      for (let i = 0; i < n; i++) {
        const h = Math.sin(i * 12.9898 + salt) * 43758.5453;
        const f = h - Math.floor(h);
        const a = i * 2.39996 + now * (0.05 + f * 0.1) * (i % 2 ? 1 : -1);
        const d = reach * (0.15 + 0.85 * ((f + now * 0.02 * (1 + f)) % 1));
        const x = cx + Math.cos(a) * d * scale;
        const y = cy + Math.sin(a) * d * scale * 0.62;
        ctx.fillRect(x - 1, y - 1, 2.2, 2.2);
      }
    };
    drawSwarm(nProbes, 'rgba(120,255,190,0.9)', 1);
    drawSwarm(nDrift, 'rgba(255,90,90,0.95)', 7);

    // Terre
    ctx.fillStyle = '#5ab0ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,176,255,0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, 8 + 2 * Math.sin(now * 2), 0, Math.PI * 2);
    ctx.stroke();
  }
}
