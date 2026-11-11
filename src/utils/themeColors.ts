/** Read the currently resolved app accent (after accent and light/dark settings). */
export function getActiveAccentColor(fallback = '#C45532'): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || fallback;
}

export function getActiveAccentRgba(alpha: number, fallback = '#C45532'): string {
  const color = getActiveAccentColor(fallback);
  const match = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return color;
  const hex = match[1].length === 3
    ? match[1].split('').map((digit) => digit + digit).join('')
    : match[1];
  const value = Number.parseInt(hex, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${Math.max(0, Math.min(1, alpha))})`;
}
