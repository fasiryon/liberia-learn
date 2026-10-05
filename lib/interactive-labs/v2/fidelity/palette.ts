/** Shared renderer tokens. Keep 2D and WebGL semantic colours in one contract. */
export const INACTIVE_FLOW_COLOR = "#779ab2";
export const HIGHLIGHT_COLOR = "#f0abfc";
export const MARKER_COLOR = "#a3e635";

/**
 * State colours are semantic runtime output, not authoring decoration. Keep
 * them shared by HIGH, STANDARD, LOW and FALLBACK_2D so a learner can read a
 * unit's state without depending on motion or a particular renderer.
 */
export const UNIT_STATUS_COLORS = Object.freeze({
  generating: "#22c55e",
  idle: "#f59e0b",
  off: "#64748b",
  tripped: "#ef4444",
  "out-for-repair": "#a855f7",
} as const);

export function statusVisual(status: string | undefined): { color?: string; emissive: number } {
  if (!status) return { emissive: 0 };
  const color = UNIT_STATUS_COLORS[status as keyof typeof UNIT_STATUS_COLORS];
  return color ? { color, emissive: status === "generating" ? 1 : status === "tripped" ? 0.45 : 0.18 } : { emissive: 0 };
}

export function parseHexColor(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) throw new Error(`Expected a six-digit hex colour, got ${hex}`);
  const value = Number.parseInt(normalized, 16);
  return [(value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255];
}

export function mixHexColor(base: string, toward: string, amount: number): string {
  const a = parseHexColor(base), b = parseHexColor(toward);
  return `#${a.map((channel, index) => Math.round(Math.min(1, Math.max(0, channel + (b[index] - channel) * amount)) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function compositeHex(foreground: string, background: string, alpha: number): string {
  return mixHexColor(background, foreground, Math.min(1, Math.max(0, alpha)));
}

const highlightMixCache = new Map<string, number>();
/** Keep the intended 20% base mix when it meets the contrast gate; increase only as needed per material. */
export function highlightBaseMix(base: string): number {
  const cached = highlightMixCache.get(base);
  if (cached !== undefined) return cached;
  let low = 0.2, high = 0.9;
  if (deltaE00(base, mixHexColor(base, HIGHLIGHT_COLOR, high)) >= 15) {
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const middle = (low + high) / 2;
      if (deltaE00(base, mixHexColor(base, HIGHLIGHT_COLOR, middle)) >= 15) high = middle;
      else low = middle;
    }
  }
  highlightMixCache.set(base, high);
  return high;
}

/** CPU reference for the non-emissive shader highlight at a full rim sample. */
export function highlightColor(base: string, highlighted: boolean, pulse: boolean, rim = 1): string {
  if (!highlighted) return base;
  return mixHexColor(base, HIGHLIGHT_COLOR, Math.min(0.9, highlightBaseMix(base) + (pulse ? 0.04 : 0) + 0.55 * Math.min(1, Math.max(0, rim))));
}

function linear(c: number): number { return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function lab(hex: string): [number, number, number] {
  const [r0, g0, b0] = parseHexColor(hex);
  const r = linear(r0), g = linear(g0), b = linear(b0);
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750);
  const z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;
  const f = (value: number) => value > 216 / 24389 ? Math.cbrt(value) : (24389 / 27 * value + 16) / 116;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const radians = (degrees: number) => degrees * Math.PI / 180;
const degrees = (value: number) => (value * 180 / Math.PI + 360) % 360;

/** CIEDE2000 colour difference, Sharma et al. 2005, with the standard kL=kC=kH=1. */
export function deltaE00(first: string, second: string): number {
  const [l1, a1, b1] = lab(first), [l2, a2, b2] = lab(second);
  const c1 = Math.hypot(a1, b1), c2 = Math.hypot(a2, b2), cBar = (c1 + c2) / 2;
  const cBar7 = cBar ** 7, g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 25 ** 7)));
  const a1p = a1 * (1 + g), a2p = a2 * (1 + g);
  const c1p = Math.hypot(a1p, b1), c2p = Math.hypot(a2p, b2);
  const h1p = c1p === 0 ? 0 : degrees(Math.atan2(b1, a1p)), h2p = c2p === 0 ? 0 : degrees(Math.atan2(b2, a2p));
  const dLp = l2 - l1, dCp = c2p - c1p;
  let dh = h2p - h1p;
  if (c1p * c2p === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dHp = 2 * Math.sqrt(c1p * c2p) * Math.sin(radians(dh / 2));
  const lBar = (l1 + l2) / 2, cpBar = (c1p + c2p) / 2;
  let hpBar = h1p + h2p;
  if (c1p * c2p === 0) hpBar = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hpBar /= 2;
  else if (h1p + h2p < 360) hpBar = (h1p + h2p + 360) / 2;
  else hpBar = (h1p + h2p - 360) / 2;
  const t = 1 - 0.17 * Math.cos(radians(hpBar - 30)) + 0.24 * Math.cos(radians(2 * hpBar)) + 0.32 * Math.cos(radians(3 * hpBar + 6)) - 0.20 * Math.cos(radians(4 * hpBar - 63));
  const deltaTheta = 30 * Math.exp(-(((hpBar - 275) / 25) ** 2));
  const cpBar7 = cpBar ** 7, rc = 2 * Math.sqrt(cpBar7 / (cpBar7 + 25 ** 7));
  const sl = 1 + 0.015 * ((lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2);
  const sc = 1 + 0.045 * cpBar, sh = 1 + 0.015 * cpBar * t, rt = -Math.sin(radians(2 * deltaTheta)) * rc;
  const lt = dLp / sl, ct = dCp / sc, ht = dHp / sh;
  return Math.sqrt(lt ** 2 + ct ** 2 + ht ** 2 + rt * ct * ht);
}

function luminance(hex: string): number {
  const [r, g, b] = parseHexColor(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
