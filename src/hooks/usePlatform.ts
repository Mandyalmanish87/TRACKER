import { useState, useEffect, useCallback } from 'react';
import {
  PlatformType,
  PlatformOverride,
  detectPlatform,
  getPlatformModifiers,
  PlatformModifiers,
  PLATFORM_OVERRIDE_STORAGE_KEY,
} from '../utils/platform';

export function usePlatform(): PlatformModifiers & {
  override: PlatformOverride;
  setPlatformOverride: (override: PlatformOverride) => void;
} {
  const [platform, setPlatform] = useState<PlatformType>(() => detectPlatform());
  const [override, setOverrideState] = useState<PlatformOverride>(() => {
    if (typeof window === 'undefined') return 'auto';
    return (localStorage.getItem(PLATFORM_OVERRIDE_STORAGE_KEY) as PlatformOverride) || 'auto';
  });

  const setPlatformOverride = useCallback((newOverride: PlatformOverride) => {
    setOverrideState(newOverride);
    if (typeof window !== 'undefined') {
      if (newOverride === 'auto') {
        localStorage.removeItem(PLATFORM_OVERRIDE_STORAGE_KEY);
      } else {
        localStorage.setItem(PLATFORM_OVERRIDE_STORAGE_KEY, newOverride);
      }
      setPlatform(detectPlatform());
    }
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === PLATFORM_OVERRIDE_STORAGE_KEY) {
        setPlatform(detectPlatform());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const modifiers = getPlatformModifiers(platform);

  return {
    ...modifiers,
    override,
    setPlatformOverride,
  };
}
