export type PlatformType = 'mac' | 'windows';
export type PlatformOverride = 'auto' | 'mac' | 'windows';

export const PLATFORM_OVERRIDE_STORAGE_KEY = 'tracker_platform_override';

export function detectPlatform(): PlatformType {
  if (typeof window === 'undefined') return 'windows';

  // 1. Check user override if set
  try {
    const override = localStorage.getItem(PLATFORM_OVERRIDE_STORAGE_KEY) as PlatformOverride | null;
    if (override === 'mac' || override === 'windows') {
      return override;
    }
  } catch {}

  // 2. High-entropy userAgentData API
  const nav = navigator as any;
  if (nav?.userAgentData?.platform) {
    const p = String(nav.userAgentData.platform).toLowerCase();
    if (p.includes('mac') || p.includes('ios')) {
      return 'mac';
    }
    return 'windows';
  }

  // 3. Fallback to navigator.platform
  if (navigator?.platform) {
    const p = navigator.platform.toLowerCase();
    if (p.includes('mac') || p.includes('iphone') || p.includes('ipad')) {
      return 'mac';
    }
  }

  // 4. Fallback to navigator.userAgent
  if (navigator?.userAgent) {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('macintosh') || ua.includes('mac os x')) {
      return 'mac';
    }
  }

  return 'windows';
}

export interface PlatformModifiers {
  isMac: boolean;
  platform: PlatformType;
  modKey: string;      // '⌘' or 'Ctrl'
  altKey: string;      // '⌥' or 'Alt'
  shiftKey: string;    // '⇧' or 'Shift'
  enterKey: string;    // '↵' or 'Enter'
  escKey: string;      // '⎋' or 'Esc'
  formatKeyCombo: (combo: { ctrlOrCmd?: boolean; alt?: boolean; shift?: boolean; key: string }) => string;
}

export function getPlatformModifiers(platform: PlatformType): PlatformModifiers {
  const isMac = platform === 'mac';

  return {
    isMac,
    platform,
    modKey: isMac ? '⌘' : 'Ctrl',
    altKey: isMac ? '⌥' : 'Alt',
    shiftKey: isMac ? '⇧' : 'Shift',
    enterKey: isMac ? '↵' : 'Enter',
    escKey: isMac ? '⎋' : 'Esc',
    formatKeyCombo: (combo) => {
      const parts: string[] = [];
      if (combo.ctrlOrCmd) parts.push(isMac ? '⌘' : 'Ctrl');
      if (combo.alt) parts.push(isMac ? '⌥' : 'Alt');
      if (combo.shift) parts.push(isMac ? '⇧' : 'Shift');
      parts.push(combo.key.toUpperCase());
      return isMac ? parts.join('') : parts.join(' + ');
    },
  };
}
