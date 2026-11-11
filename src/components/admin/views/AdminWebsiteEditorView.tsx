import React, { useState } from 'react';
import {
  Palette,
  Type,
  Sparkles,
  Save,
  CheckCircle2,
  Megaphone,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { adminService } from '../../../services/adminService';
import { AdminWebsiteBrandingConfig } from '../../../types/admin';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { Button } from '../../common/Button';

const COLOR_PRESETS = [
  { name: 'Cirrel Blue', hex: '#2563EB', glow: 'rgba(37,99,235,0.4)' },
  { name: 'Spatial Violet', hex: '#8B5CF6', glow: 'rgba(139,92,246,0.4)' },
  { name: 'Emerald Intelligence', hex: '#10B981', glow: 'rgba(16,185,129,0.4)' },
  { name: 'Terracotta Glow', hex: '#EA580C', glow: 'rgba(234,88,12,0.4)' },
  { name: 'Amber Sun', hex: '#F59E0B', glow: 'rgba(245,158,11,0.4)' },
  { name: 'Crimson Power', hex: '#E11D48', glow: 'rgba(225,29,72,0.4)' },
];

const RADIUS_PRESETS: { id: AdminWebsiteBrandingConfig['borderRadiusPreset']; label: string; desc: string }[] = [
  { id: 'sharp', label: 'Sharp Studio', desc: 'Precise 2px architectural edges' },
  { id: 'subtle', label: 'Subtle Modern', desc: 'Soft 8px chamfered corners' },
  { id: 'rounded', label: 'Balanced iOS', desc: 'Refined 16px spatial curvature' },
  { id: 'spatial', label: 'VisionOS Spatial', desc: 'Generous 24px organic pill cards' },
  { id: 'pill', label: 'Ultra Pill', desc: 'Continuous 9999px aerodynamic radius' },
];

export const AdminWebsiteEditorView: React.FC = () => {
  const [config, setConfig] = useState<AdminWebsiteBrandingConfig>(() => {
    const savedConfig = adminService.getWebsiteBrandingConfig();
    const legacyProductName = /^(student\s+)?tracker$/i;
    return {
      ...savedConfig,
      appTitle: legacyProductName.test(savedConfig.appTitle.trim()) ? 'TRAKIFY' : savedConfig.appTitle,
      announcementBanner: {
        ...savedConfig.announcementBanner,
        text: savedConfig.announcementBanner.text.replace(/Student Tracker/gi, 'TRAKIFY'),
      },
    };
  });
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const handleSave = () => {
    adminService.saveWebsiteBrandingConfig(config);
    setSaveFeedback('Website branding & visual studio changes successfully applied live!');
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  const handleResetDefaults = () => {
    const defaults = {
      appTitle: 'TRAKIFY',
      tagline: 'Apple × Spatial Personal Intelligence OS',
      heroHeading: 'Spatial Personal Intelligence Active',
      announcementBanner: {
        enabled: true,
        text: '🚀 Welcome to TRAKIFY 2.4 — Semester Pass & AI Academic Intelligence are now live!',
        variant: 'sale' as const,
      },
      dailyMotd: 'Do the next useful thing. Then do it again.',
      primaryAccent: '#2563EB',
      borderRadiusPreset: 'rounded' as const,
      fontFamily: 'sans' as const,
      glassIntensity: 'medium' as const,
    };
    setConfig(defaults);
    adminService.saveWebsiteBrandingConfig(defaults);
    setSaveFeedback('Restored default website design tokens and branding copy.');
    setTimeout(() => setSaveFeedback(null), 3000);
  };

  // Compute preview radius style
  const getPreviewRadiusStyle = () => {
    switch (config.borderRadiusPreset) {
      case 'sharp':
        return 'rounded-[2px]';
      case 'subtle':
        return 'rounded-lg';
      case 'rounded':
        return 'rounded-2xl';
      case 'spatial':
        return 'rounded-3xl';
      case 'pill':
        return 'rounded-full';
      default:
        return 'rounded-2xl';
    }
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Canva-Style Website &amp; UI Live Studio"
        description="Visual no-code studio to customize website branding, copy text, accent color themes, corner shapes, and announcement alerts in real-time."
        badge={{ label: 'Live WYSIWYG Editor', variant: 'blue' }}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResetDefaults}
            className="gap-1.5 !bg-white/5 !text-ivory-300 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            className="gap-1.5 !bg-blue-600 hover:!bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30"
          >
            <Save className="w-3.5 h-3.5" />
            Save &amp; Publish Live Changes
          </Button>
        </div>
      </AdminPageHeader>

      {saveFeedback && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono flex items-center gap-2 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveFeedback}</span>
        </div>
      )}

      {/* ── SPLIT STUDIO: CONTROLS (LEFT) vs LIVE PREVIEW CANVAS (RIGHT) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Editing Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Branding & Copy Texts */}
          <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-4">
            <h3 className="font-serif text-base font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
              <Type className="w-4 h-4 text-blue-400" />
              Website Branding &amp; Hero Copy Text
            </h3>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-ivory-400 mb-1">Application Brand Title</label>
                <input
                  type="text"
                  value={config.appTitle}
                  onChange={(e) => setConfig({ ...config, appTitle: e.target.value })}
                  placeholder="e.g. TRAKIFY"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-ivory-400 mb-1">Tagline &amp; Philosophy</label>
                <input
                  type="text"
                  value={config.tagline}
                  onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
                  placeholder="e.g. Apple × Spatial Personal Intelligence OS"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-ivory-400 mb-1">Hero Briefing Heading</label>
                <input
                  type="text"
                  value={config.heroHeading}
                  onChange={(e) => setConfig({ ...config, heroHeading: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-ivory-400 mb-1">Daily Quote / MOTD Banner</label>
                <textarea
                  rows={2}
                  value={config.dailyMotd}
                  onChange={(e) => setConfig({ ...config, dailyMotd: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Global Announcement Alert Bar */}
          <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-serif text-base font-bold text-white flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-400" />
                Global Student Announcement Banner
              </h3>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-ivory-400">
                <input
                  type="checkbox"
                  checked={config.announcementBanner.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      announcementBanner: { ...config.announcementBanner, enabled: e.target.checked },
                    })
                  }
                  className="rounded text-blue-600 focus:ring-0"
                />
                Banner Visible
              </label>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-ivory-400 mb-1">Announcement Message</label>
                <textarea
                  rows={2}
                  value={config.announcementBanner.text}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      announcementBanner: { ...config.announcementBanner, text: e.target.value },
                    })
                  }
                  placeholder="Enter notice, sale promo, or exam period alert..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-ivory-400 mb-1">Banner Alert Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['sale', 'info', 'alert'] as const).map((variant) => (
                    <button
                      key={variant}
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          announcementBanner: { ...config.announcementBanner, variant },
                        })
                      }
                      className={`p-2 rounded-xl text-center capitalize border transition cursor-pointer ${
                        config.announcementBanner.variant === variant
                          ? 'bg-blue-600 text-white border-blue-500 font-bold'
                          : 'bg-white/5 text-ivory-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {variant}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Visual Shapes & Theme Tokens */}
          <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-5">
            <h3 className="font-serif text-base font-bold text-white flex items-center gap-2 pb-2 border-b border-white/10">
              <Palette className="w-4 h-4 text-cyan-400" />
              Brand Accent Palette &amp; Shape Curvature
            </h3>

            {/* Accent Color Picker */}
            <div className="space-y-2">
              <label className="block text-xs font-mono text-ivory-400">Primary Brand Accent Color</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setConfig({ ...config, primaryAccent: color.hex })}
                    className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      config.primaryAccent === color.hex
                        ? 'border-white bg-white/10 ring-2 ring-white/50 scale-105'
                        : 'border-white/10 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    <div
                      className="w-6 h-6 rounded-full shadow-md"
                      style={{ backgroundColor: color.hex, boxShadow: `0 0 12px ${color.glow}` }}
                    />
                    <span className="text-[10px] font-mono text-ivory-300 text-center truncate w-full">
                      {color.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Custom Hex Color */}
              <div className="flex items-center gap-3 pt-2">
                <span className="text-[11px] font-mono text-ivory-400">Custom Hex:</span>
                <input
                  type="text"
                  value={config.primaryAccent}
                  onChange={(e) => setConfig({ ...config, primaryAccent: e.target.value })}
                  className="w-28 px-3 py-1.5 text-xs font-mono rounded-xl bg-white/5 border border-white/10 text-white uppercase focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="color"
                  value={config.primaryAccent.startsWith('#') ? config.primaryAccent : '#2563EB'}
                  onChange={(e) => setConfig({ ...config, primaryAccent: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
              </div>
            </div>

            {/* Shape Border Radius Presets */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="block text-xs font-mono text-ivory-400">Card &amp; UI Surface Shape Style</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {RADIUS_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setConfig({ ...config, borderRadiusPreset: preset.id })}
                    className={`p-3 text-left border rounded-2xl transition cursor-pointer ${
                      config.borderRadiusPreset === preset.id
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-white/5 border-white/10 text-ivory-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-white">{preset.label}</div>
                    <div className="text-[10px] opacity-75">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Typography Pairing */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="block text-xs font-mono text-ivory-400">Typography Mood</label>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                {(['sans', 'serif', 'mono'] as const).map((font) => (
                  <button
                    key={font}
                    type="button"
                    onClick={() => setConfig({ ...config, fontFamily: font })}
                    className={`p-2.5 rounded-xl border capitalize text-center transition cursor-pointer ${
                      config.fontFamily === font
                        ? 'bg-blue-600 text-white border-blue-500 font-bold'
                        : 'bg-white/5 text-ivory-400 border-white/10 hover:text-white'
                    }`}
                  >
                    {font === 'sans' ? 'Modern Sans' : font === 'serif' ? 'Academic Serif' : 'Technical Mono'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live WYSIWYG Canvas Preview (5 Cols Sticky) */}
        <div className="lg:col-span-5 sticky top-24 space-y-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-mono text-ivory-400 flex items-center gap-1.5 uppercase tracking-wider font-bold">
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              Live Interactive Canvas Preview
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Real-time Output
            </span>
          </div>

          {/* Canvas Card Container */}
          <div className="p-6 rounded-3xl bg-[#070B14] border border-white/10 shadow-2xl space-y-5 overflow-hidden relative">
            {/* Ambient spatial glow of active color */}
            <div
              className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-[80px] pointer-events-none opacity-40"
              style={{ backgroundColor: config.primaryAccent }}
            />

            {/* Mock Announcement Banner */}
            {config.announcementBanner.enabled && (
              <div
                className={`p-3 text-xs font-mono flex items-center gap-2 border ${getPreviewRadiusStyle()} ${
                  config.announcementBanner.variant === 'sale'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                    : config.announcementBanner.variant === 'alert'
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-200'
                    : 'bg-blue-500/20 border-blue-500/40 text-blue-200'
                }`}
              >
                <Megaphone className="w-4 h-4 shrink-0" />
                <span className="truncate">{config.announcementBanner.text}</span>
              </div>
            )}

            {/* Mock Header Branding */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 flex items-center justify-center text-white text-xs font-bold ${getPreviewRadiusStyle()}`}
                  style={{ backgroundColor: config.primaryAccent }}
                >
                  {config.appTitle.charAt(0)}
                </div>
                <h1
                  className={`text-lg font-bold tracking-tight text-white ${
                    config.fontFamily === 'serif'
                      ? 'font-serif'
                      : config.fontFamily === 'mono'
                      ? 'font-mono'
                      : 'font-sans'
                  }`}
                >
                  {config.appTitle}
                </h1>
              </div>
              <p className="text-[11px] font-mono text-ivory-400">{config.tagline}</p>
            </div>

            {/* Mock Hero Widget */}
            <div
              className={`p-4 bg-white/5 border border-white/10 space-y-2 ${getPreviewRadiusStyle()}`}
            >
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: config.primaryAccent }}
              >
                <Sparkles className="w-3 h-3" />
                Live OS Telemetry
              </span>
              <h2 className="text-base font-bold text-white">{config.heroHeading}</h2>
              <p className="text-xs font-serif italic text-ivory-300">
                &ldquo;{config.dailyMotd}&rdquo;
              </p>
            </div>

            {/* Mock Action Buttons Preview */}
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 py-2 text-xs font-bold text-white transition ${getPreviewRadiusStyle()}`}
                style={{ backgroundColor: config.primaryAccent }}
              >
                Primary Button
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-xs font-mono bg-white/10 text-ivory-300 border border-white/10 ${getPreviewRadiusStyle()}`}
              >
                Secondary
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

