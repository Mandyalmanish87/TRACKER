import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from './ThemeContext';
import type { AccentColor, BackgroundStyle } from '../types';

export const DEFAULT_CUSTOM_WALLPAPER =
  'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1600&q=80';

/**
 * AppearanceManager — a renderless component that reads the persisted
 * accent colour and background style from AppContext and applies them
 * to the DOM so the CSS custom properties take effect application-wide.
 *
 * Must be rendered inside <AppProvider> and <ThemeProvider>.
 *
 * DOM mutations:
 *   <html data-accent="terracotta|sage|ochre|dusty-blue|plum|slate">
 *   <body class="bg-style-minimal|abstract|space|ocean|custom"
 *         style="background-image: ...">   ← for custom bg
 */
export const AppearanceManager: React.FC = () => {
  const { state } = useApp();
  const { resolvedTheme } = useTheme();

  const accent: AccentColor       = state.settings?.accentColor ?? 'terracotta';
  const bgStyle: BackgroundStyle  = state.settings?.backgroundStyle ?? 'minimal';
  const customUrl: string         = state.settings?.customBackgroundUrl ?? '';
  const [imageFailed, setImageFailed] = useState(false);

  // ── Apply accent colour data-attribute to <html> ──────────
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
  }, [accent]);

  // ── Pre-test image load for custom URLs ───────────────────
  useEffect(() => {
    if (bgStyle !== 'custom') {
      setImageFailed(false);
      return;
    }
    const trimmed = customUrl.trim();
    if (!trimmed) {
      setImageFailed(false);
      return;
    }

    const testImg = new Image();
    testImg.onload = () => setImageFailed(false);
    testImg.onerror = () => setImageFailed(true);
    testImg.src = trimmed;

    return () => {
      testImg.onload = null;
      testImg.onerror = null;
    };
  }, [bgStyle, customUrl]);

  // ── Apply background style class and custom image to <body> ────────────────
  useEffect(() => {
    const body = document.body;
    // Remove all existing bg-style-* classes
    const toRemove: string[] = [];
    body.classList.forEach((cls) => {
      if (cls.startsWith('bg-style-')) toRemove.push(cls);
    });
    toRemove.forEach((cls) => body.classList.remove(cls));
    body.classList.add(`bg-style-${bgStyle}`);

    // Handle custom background image
    if (bgStyle === 'custom') {
      const trimmed = customUrl.trim();
      const targetUrl = (!imageFailed && trimmed.length > 0) ? trimmed : DEFAULT_CUSTOM_WALLPAPER;
      const safeUrl = targetUrl.replace(/"/g, '%22');

      // Scrim wash ensures all text and cards remain 100% WCAG AA compliant and readable
      const overlay = resolvedTheme === 'dark'
        ? 'linear-gradient(rgba(14, 12, 11, 0.86), rgba(14, 12, 11, 0.92))'
        : 'linear-gradient(rgba(250, 247, 242, 0.82), rgba(250, 247, 242, 0.89))';

      body.style.backgroundImage = `${overlay}, url("${safeUrl}")`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundAttachment = 'fixed';
    } else {
      body.style.backgroundImage = '';
      body.style.backgroundSize = '';
      body.style.backgroundPosition = '';
      body.style.backgroundAttachment = '';
    }

    return () => {
      const cleanup: string[] = [];
      body.classList.forEach((cls) => {
        if (cls.startsWith('bg-style-')) cleanup.push(cls);
      });
      cleanup.forEach((cls) => body.classList.remove(cls));
      body.style.backgroundImage = '';
    };
  }, [bgStyle, customUrl, imageFailed, resolvedTheme]);

  // Renderless — no DOM output
  return null;
};
