import React, { useState } from 'react';
import { ClipboardCopy, FileJson2, ShieldCheck, Sparkles } from 'lucide-react';
import type { AppStateData } from '../../types';
import {
  buildTrakifyPersonalExport,
  createTrakifyGptPrompt,
  DEFAULT_TRAKIFY_EXPORT_SELECTION,
  downloadJsonFile,
  formatExportSize,
  TRAKIFY_EXPORT_CATEGORIES,
  type ExportDateRange,
  type TrakifyClassSpaceExportSource,
  type TrakifyExportCategory,
  type TrakifyExportSelection,
} from '../../services/personalIntelligenceExport';

interface Props {
  state: AppStateData;
  classSpace?: TrakifyClassSpaceExportSource;
}

const today = () => new Date().toISOString().slice(0, 10);
const inRange = (value: string | undefined, from: string, to: string) => {
  if (!value) return true;
  const date = value.slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand('copy');
  field.remove();
  if (!copied) throw new Error('Copy is unavailable. Select and copy the prompt text below.');
}

export const PersonalIntelligenceExport: React.FC<Props> = ({ state, classSpace }) => {
  const [selection, setSelection] = useState<TrakifyExportSelection>(DEFAULT_TRAKIFY_EXPORT_SELECTION);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [exportedAt, setExportedAt] = useState<string | null>(null);
  const [includeFreeText, setIncludeFreeText] = useState(true);
  const dateRange: ExportDateRange | undefined = from || to ? { from, to } : undefined;
  const coverage = {
    syllabus_subjects: selection.syllabus ? state.syllabusSubjects?.length ?? 0 : 0,
    focus_sessions: selection.focus ? state.studySessions?.filter((session) => inRange(session.startTime || session.timestamp, from, to)).length ?? 0 : 0,
    eduhub_courses: selection.eduhub ? state.eduhubCourses?.length ?? 0 : 0,
  };
  const selectedCount = Object.values(selection).filter(Boolean).length;
  const toggle = (key: TrakifyExportCategory) => setSelection((current) => ({ ...current, [key]: !current[key] }));

  const download = async (includePrompt: boolean) => {
    if (from && to && from > to) { setError('The start date must be before the end date.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const data = buildTrakifyPersonalExport(state, selection, { dateRange, classSpace, includeFreeText });
      const now = new Date();
      const result = await downloadJsonFile(data, `trakify-personal-report-${today()}.json`);
      setFileSize(result.bytes); setExportedAt(now.toLocaleString());
      if (includePrompt) {
        const nextPrompt = createTrakifyGptPrompt();
        setPrompt(nextPrompt);
        try {
          await copyText(nextPrompt);
          setNotice('JSON downloaded and the GPT prompt copied. Upload the JSON yourself, then paste the prompt.');
        } catch {
          setNotice('JSON downloaded. Copy the ready-to-use GPT prompt below when you are ready.');
        }
      } else {
        setNotice('Your readable JSON export was downloaded to this device.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The export could not be generated.');
    } finally { setBusy(false); }
  };

  const copyPrompt = async () => {
    try { await copyText(prompt || createTrakifyGptPrompt()); setNotice('GPT prompt copied. Upload the JSON yourself, then paste it into ChatGPT.'); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not copy the prompt.'); }
  };

  return (
    <div className="space-y-5" aria-busy={busy}>
      <div>
        <p className="text-sm leading-relaxed text-espresso-600 dark:text-ivory-300">Create a clear personal snapshot from the information TRAKIFY currently has. It is generated on this device. No report is sent to an AI service.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-espresso-500">
          <span className="rounded-full bg-ivory-100 px-3 py-1.5 dark:bg-espresso-800">{selectedCount} sections selected</span>
          <span className="rounded-full bg-ivory-100 px-3 py-1.5 dark:bg-espresso-800">{coverage.syllabus_subjects} syllabus subjects · summary only</span>
          <span className="rounded-full bg-ivory-100 px-3 py-1.5 dark:bg-espresso-800">{coverage.focus_sessions} focus sessions</span>
          <span className="rounded-full bg-ivory-100 px-3 py-1.5 dark:bg-espresso-800">{coverage.eduhub_courses} EduHub courses · current</span>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold text-espresso-800 dark:text-ivory-200">Review what to include</legend>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {(Object.entries(TRAKIFY_EXPORT_CATEGORIES) as Array<[TrakifyExportCategory, string]>).map(([key, label]) => (
            <label key={key} className="flex min-h-11 items-center gap-2.5 rounded-xl border border-ivory-200 bg-white/60 px-3 py-2 text-xs dark:border-espresso-750 dark:bg-black/10">
              <input type="checkbox" checked={selection[key]} onChange={() => toggle(key)} className="accent-terracotta-600" />
              <span>{label}</span>
              {key === 'syllabusDetails' && <span className="ml-auto text-[10px] text-espresso-400">larger file</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium">From date <span className="font-normal text-espresso-400">(optional)</span><input type="date" max={to || undefined} value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block w-full rounded-xl border border-ivory-300 bg-white px-3 py-2.5 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label>
        <label className="text-xs font-medium">Through date <span className="font-normal text-espresso-400">(optional)</span><input type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block w-full rounded-xl border border-ivory-300 bg-white px-3 py-2.5 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label>
      </div>
      <p className="text-[11px] leading-relaxed text-espresso-500">Date bounds apply to dated records where supported. Overall and subject attendance totals use current counters; only attendance history is date-filtered. Timetable, syllabus/settings and EduHub completion totals are current snapshots. Profile email, student ID, avatar, credentials, payment data, workspace join codes and other members’ private details are never included.</p>

      <label className="flex min-h-11 items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/15 dark:text-amber-100">
        <input type="checkbox" checked={includeFreeText} onChange={(event) => setIncludeFreeText(event.target.checked)} className="mt-0.5 accent-terracotta-600" />
        <span><strong>Include optional notes, descriptions, bio and URLs</strong><small className="mt-0.5 block leading-relaxed">These can contain sensitive details or pasted credentials. Turn this off to omit them from the file. Selected text is exported exactly as written; review it before sharing.</small></span>
      </label>
      <p className="text-[10px] text-espresso-400">Exports are capped at 20 MB. Narrow the date range or turn off optional details and free text if a file is too large.</p>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || selectedCount === 0} onClick={() => void download(false)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ivory-300 bg-white px-4 text-xs font-semibold hover:bg-ivory-50 disabled:cursor-wait disabled:opacity-60 dark:border-espresso-700 dark:bg-espresso-900"><FileJson2 className="h-4 w-4" />{busy ? 'Preparing…' : 'Download JSON'}</button>
        <button type="button" disabled={busy || selectedCount === 0} onClick={() => void download(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-terracotta-600 px-4 text-xs font-semibold text-white hover:bg-terracotta-700 disabled:cursor-wait disabled:opacity-60"><Sparkles className="h-4 w-4" />Download AI Report Kit</button>
      </div>

      {(notice || error) && <p role={error ? 'alert' : 'status'} className={`rounded-xl px-3 py-2.5 text-xs ${error ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>{error || notice}</p>}
      {exportedAt && <p className="text-[10px] text-espresso-400">Last export: {exportedAt}{fileSize !== null ? ` · ${formatExportSize(fileSize)}` : ''}</p>}

      {prompt && <div className="rounded-2xl border border-terracotta-200 bg-terracotta-50/40 p-4 dark:border-terracotta-900/40 dark:bg-terracotta-950/10">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Your TRAKIFY report prompt</h3><button type="button" onClick={() => void copyPrompt()} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-terracotta-300 bg-white px-3 text-xs font-semibold dark:border-terracotta-800 dark:bg-espresso-900"><ClipboardCopy className="h-3.5 w-3.5" />Copy GPT Prompt</button></div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[11px] leading-relaxed text-espresso-600 dark:text-ivory-300"><li>Open ChatGPT and upload the JSON you just downloaded.</li><li>Paste the copied prompt to request your interactive report.</li><li>Review the file before sharing; it contains personal information.</li></ol>
        <textarea readOnly value={prompt} aria-label="Generated TRAKIFY GPT report prompt" rows={6} className="mt-3 w-full resize-y rounded-xl border border-ivory-300 bg-white p-3 text-[11px] leading-relaxed dark:border-espresso-700 dark:bg-espresso-950" />
      </div>}

      <p className="flex items-start gap-2 border-t border-ivory-200 pt-3 text-[10px] leading-relaxed text-espresso-400 dark:border-espresso-750"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Your selected data is saved to a file on your device only. You decide whether to upload that file to ChatGPT; TRAKIFY never sends it for you.</p>
    </div>
  );
};
