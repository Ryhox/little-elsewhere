const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];

/** Compact number: 1,234 → "1.23K"; falls back to scientific notation beyond the named range. */
export function fmt(value: number, smallDecimals = 0): string {
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '-' : '';
  const v = Math.abs(value);
  if (v < 1000) {
    if (v === 0) return '0';
    if (v < 10 && smallDecimals > 0) return sign + trimZeros(v.toFixed(smallDecimals));
    if (v < 100 && smallDecimals > 0) return sign + trimZeros(v.toFixed(Math.min(1, smallDecimals)));
    return sign + Math.floor(v).toString();
  }
  const tier = Math.floor(Math.log10(v) / 3);
  if (tier >= SUFFIXES.length) {
    const exp = Math.floor(Math.log10(v));
    return `${sign}${(v / 10 ** exp).toFixed(2)}e${exp}`;
  }
  const scaled = v / 10 ** (tier * 3);
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  // Floor rather than round so a price never looks affordable before it is.
  const factor = 10 ** digits;
  return `${sign}${(Math.floor(scaled * factor) / factor).toFixed(digits)}${SUFFIXES[tier]}`;
}

/** Rates read better with a couple of decimals when small. */
export const fmtRate = (value: number) => fmt(value, 2);

function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/** 75 → "1m 15s", 3700 → "1h 01m". */
export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

/** 1.5 → "×1.5", 2 → "×2". */
export const fmtMult = (value: number) => `×${value >= 100 ? fmt(value) : trimZeros(value.toFixed(2))}`;
export const fmtPct = (value: number) => `${trimZeros((value * 100).toFixed(1))}%`;
