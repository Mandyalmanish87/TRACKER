import React, { useState } from 'react';
import { ClipboardCopy, FileJson2, ShieldCheck, Sparkles } from 'lucide-react';
import type { BloomVaultData } from '../../services/bloomVault';
import {
  BLOOM_EXPORT_CATEGORIES,
  buildBloomPersonalExport,
  createBloomGptPrompt,
  DEFAULT_BLOOM_EXPORT_SELECTION,
  type BloomExportCategory,
  type BloomExportSelection,
} from '../../services/bloomIntelligenceExport';
import { downloadJsonFile, formatExportSize, type ExportDateRange } from '../../services/personalIntelligenceExport';

interface Props { vault: BloomVaultData }
const today = () => new Date().toISOString().slice(0, 10);

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return; }
  const field = document.createElement('textarea');
  field.value = value; field.setAttribute('readonly', '');
  field.style.position = 'fixed'; field.style.opacity = '0';
  document.body.appendChild(field); field.select();
  const copied = document.execCommand('copy'); field.remove();
  if (!copied) throw new Error('Copy is unavailable. Select and copy the prompt text below.');
}

export const BloomIntelligenceExport: React.FC<Props> = ({ vault }) => {
  const [selection, setSelection] = useState<BloomExportSelection>(DEFAULT_BLOOM_EXPORT_SELECTION);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [exportedAt, setExportedAt] = useState<string | null>(null);
  const [includeFreeText, setIncludeFreeText] = useState(true);
  const range: ExportDateRange | undefined = from || to ? { from, to } : undefined;
  const selectedCount = Object.values(selection).filter(Boolean).length;
  const profileName = vault.profile && typeof vault.profile === 'object' && typeof (vault.profile as { displayName?: unknown }).displayName === 'string'
    ? (vault.profile as { displayName: string }).displayName.trim()
    : '';
  const count = (items: unknown[] | undefined) => (items || []).length;
  const toggle = (key: BloomExportCategory) => setSelection((current) => ({ ...current, [key]: !current[key] }));

  const download = async (includePrompt: boolean) => {
    if (from && to && from > to) { setError('The start date must be before the end date.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const json = buildBloomPersonalExport(vault, selection, { dateRange: range, includeFreeText });
      const now = new Date();
      const result = await downloadJsonFile(json, `bloom-personal-wellness-${today()}.json`);
      setFileSize(result.bytes); setExportedAt(now.toLocaleString());
      if (includePrompt) {
        const nextPrompt = createBloomGptPrompt(); setPrompt(nextPrompt);
        try { await copyText(nextPrompt); setNotice('Bloom JSON downloaded and the prompt copied. Upload the file yourself; Bloom never sends your records.'); }
        catch { setNotice('Bloom JSON downloaded. Copy the ready-to-use Bloom prompt below when you are ready.'); }
      } else setNotice('Bloom JSON downloaded to this device. Keep this personal wellness file somewhere secure.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The Bloom export could not be generated.');
    } finally { setBusy(false); }
  };

  const copyPrompt = async () => {
    try { await copyText(prompt || createBloomGptPrompt()); setNotice('Bloom prompt copied. Upload your JSON yourself, then paste the prompt into ChatGPT.'); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not copy the prompt.'); }
  };

  return (
    <div className="bloom-export-panel" aria-busy={busy}>
      <p>Build a human-readable report file from the Bloom records in your unlocked encrypted vault. Bloom does not upload data or run AI analysis.</p>
      <div className="bloom-export-summary" aria-label="Bloom records available">
        <span>{count(vault.periods)} period records</span><span>{count(vault.checkIns)} check-ins</span><span>{count(vault.journal)} journal notes</span><span>{count(vault.lifestyle)} lifestyle logs</span>
      </div>
      <fieldset className="bloom-export-categories">
        <legend>Review included Bloom data</legend>
        {(Object.entries(BLOOM_EXPORT_CATEGORIES) as Array<[BloomExportCategory, string]>).map(([key, label]) => (
          <label key={key}><input type="checkbox" checked={selection[key]} onChange={() => toggle(key)} disabled={key === 'profile' && !profileName} /><span>{label}</span>{key === 'profile' && !profileName && <small>No profile is stored in the Bloom vault</small>}</label>
        ))}
      </fieldset>
      <div className="bloom-export-dates">
        <label>From date (optional)<input type="date" max={to || undefined} value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Through date (optional)<input type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <p className="bloom-export-privacy">Period, symptom, mood and journal records are sensitive. Check the selected categories before exporting and only upload the file to an AI service if you choose.</p>
      <label className="bloom-export-free-text"><input type="checkbox" checked={includeFreeText} onChange={(event) => setIncludeFreeText(event.target.checked)} /><span><strong>Include optional notes and personal text</strong><small>Notes, journal entries, personal plans and wellness text may contain very sensitive details or pasted credentials. Turn this off to omit them. Included text is exported exactly as written; review before sharing.</small></span></label>
      <p className="bloom-export-meta">Exports are capped at 20 MB. Narrow the date range or turn off optional text if a file is too large.</p>
      <div className="bloom-export-actions">
        <button type="button" disabled={busy || !selectedCount} onClick={() => void download(false)}><FileJson2 aria-hidden="true" />{busy ? 'Preparing…' : 'Download JSON'}</button>
        <button type="button" disabled={busy || !selectedCount} onClick={() => void download(true)}><Sparkles aria-hidden="true" />Download Bloom AI Kit</button>
      </div>
      {(notice || error) && <p className={error ? 'bloom-export-error' : 'bloom-export-success'} role={error ? 'alert' : 'status'}>{error || notice}</p>}
      {exportedAt && <p className="bloom-export-meta">Last export: {exportedAt}{fileSize !== null ? ` · ${formatExportSize(fileSize)}` : ''}</p>}
      {prompt && <div className="bloom-export-prompt"><div><h4>Bloom report prompt</h4><button type="button" onClick={() => void copyPrompt()}><ClipboardCopy aria-hidden="true" />Copy GPT Prompt</button></div><ol><li>Upload the Bloom JSON file to ChatGPT.</li><li>Paste the copied Bloom-specific prompt.</li><li>Review the report; Bloom data can be highly personal.</li></ol><textarea readOnly rows={6} value={prompt} aria-label="Generated Bloom GPT report prompt" /></div>}
      <p className="bloom-export-footnote"><ShieldCheck aria-hidden="true" />The report is generated from decrypted vault data in this session only. The encrypted vault and ordinary TRAKIFY export remain separate.</p>
    </div>
  );
};
