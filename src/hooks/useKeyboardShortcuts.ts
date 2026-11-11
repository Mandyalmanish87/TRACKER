import { useEffect, useRef } from 'react';
import { detectPlatform } from '../utils/platform';

export interface ShortcutDefinition {
  id: string;
  key: string;              // e.g. 'k', '/', 'Escape', 'b'
  ctrlOrCmd?: boolean;      // True if Ctrl on Windows/Linux or ⌘ on macOS
  alt?: boolean;            // Alt / Option
  shift?: boolean;          // Shift
  allowInInputs?: boolean;  // Default false: ignore when typing
  preventDefault?: boolean; // Default true
  description: string;
  category:
    | 'Global Navigation'
    | 'Dashboard & Today'
    | 'Academics & Timetable'
    | 'Tasks & Events'
    | 'Deep Focus'
    | 'Workouts & Nutrition'
    | 'System & Settings';
  handler: (e: KeyboardEvent) => void;
}

export function isUserTyping(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return false;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutDefinition[],
  options: { enabled?: boolean } = { enabled: true }
) {
  const { enabled = true } = options;
  const shortcutsRef = useRef<ShortcutDefinition[]>(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const isMac = detectPlatform() === 'mac';

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const typing = isUserTyping(activeElement);

      for (const def of shortcutsRef.current) {
        // If typing and shortcut does not explicitly permit inputs, skip
        if (typing && !def.allowInInputs) {
          continue;
        }

        // Match primary modifier (Command on Mac, Ctrl on Windows)
        if (def.ctrlOrCmd) {
          const modPressed = isMac ? e.metaKey : e.ctrlKey;
          if (!modPressed) continue;
        } else {
          // If shortcut does not want ctrl/cmd, ensure neither is pressed
          if (e.metaKey || e.ctrlKey) continue;
        }

        // Match Alt
        if (Boolean(def.alt) !== Boolean(e.altKey)) {
          continue;
        }

        // Match Shift
        if (Boolean(def.shift) !== Boolean(e.shiftKey)) {
          continue;
        }

        // Match Key
        const targetKey = def.key.toLowerCase();
        const eventKey = e.key.toLowerCase();

        if (targetKey === eventKey) {
          if (def.preventDefault !== false) {
            e.preventDefault();
          }
          def.handler(e);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
