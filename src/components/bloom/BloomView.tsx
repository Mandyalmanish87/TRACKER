import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, CalendarDays, ChartPie, ClipboardCheck, CloudRain, Download, Flame, Flower2, Heart, Leaf, NotebookPen,
  Sun, Wind, BookOpen, Droplets, Moon, HandHeart,
  LockKeyhole, Plus, ShieldCheck, Trash2, Upload,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { BloomNavigation, type BloomPage } from './BloomNavigation';
import { BloomIntelligenceExport } from './BloomIntelligenceExport';
import './BloomView.css';
import { CycleWheel } from './widgets/CycleWheel';
import { BodyMap } from './widgets/BodyMap';
import { MoonSync } from './widgets/MoonSync';
import { WaterTracker } from './widgets/WaterTracker';
import { Breathing as BreathingWidget } from './widgets/Breathing';
import {
  BloomCheckIn, BloomFlow, BloomPeriod, BloomVaultData, BloomVaultEnvelope, BloomLifestyleEntry, BloomJournalEntry, BloomPlanEntry,
  createBloomEnvelope, EMPTY_BLOOM_DATA, parseBloomBackup, persistBloomEnvelope,
  readBloomEnvelope, removeBloomEnvelope, unlockBloomEnvelope,
} from '../../services/bloomVault';

const SYMPTOMS = ['Cramps', 'Headache', 'Back pain', 'Bloating', 'Fatigue', 'Nausea', 'Acne', 'Tenderness'];
const MOODS = ['Happy', 'Calm', 'Sad', 'Irritated', 'Anxious', 'Stressed', 'Overwhelmed', 'Emotional', 'Energetic', 'Low motivation'];
const MOOD_ICONS: Record<string, React.ElementType> = { Steady: Leaf, Good: Sun, Happy: Sun, Calm: Leaf, Tender: Heart, Sad: CloudRain, Low: CloudRain, Irritated: Flame, Irritable: Flame, Anxious: Wind, Stressed: Wind, Overwhelmed: CloudRain, Emotional: Heart, Energetic: Sun, 'Low motivation': CloudRain };
const COMFORT_OPTIONS: Array<{ id: string; title: string; detail: string; icon: React.ElementType }> = [
  { id: 'warmth', title: 'Warmth', detail: 'Try a warm bath or a comfortably warm, wrapped heat source. Take breaks and protect your skin.', icon: Flame },
  { id: 'gentle-movement', title: 'Gentle movement', detail: 'A short walk, stretch, or easy yoga is an option if movement feels good today.', icon: Activity },
  { id: 'massage', title: 'Soft massage', detail: 'A gentle massage over your lower belly or back may feel soothing.', icon: Heart },
  { id: 'rest', title: 'Rest & sleep', detail: 'Make room for rest, a quiet pause, or an earlier night if that helps you.', icon: Moon },
  { id: 'slow-breathing', title: 'Slow breathing', detail: 'Try a few relaxed breaths. Skip the holds or stop whenever you want.', icon: Wind },
  { id: 'support', title: 'Ask for support', detail: 'Tell someone you trust what would make today easier.', icon: HandHeart },
];
const todayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const asLocalDate = (value: string) => new Date(`${value}T12:00:00`);
const daysBetween = (a: string, b: string) => Math.round((asLocalDate(b).getTime() - asLocalDate(a).getTime()) / 86_400_000);
const dateLabel = (value: string) => asLocalDate(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function estimateCycle(periods: BloomPeriod[], cycleOverride?: number) {
  const starts = [...periods].map((period) => period.startDate).sort();
  if (starts.length < 2 && !(cycleOverride && starts.length === 1)) return null;
  const recent = starts.slice(-7);
  const lengths = recent.slice(1).map((date, index) => daysBetween(recent[index], date)).filter((n) => n > 0 && n < 100);
  if (!lengths.length && !cycleOverride) return null;
  const averageLength = cycleOverride && cycleOverride >= 15 && cycleOverride <= 60 ? cycleOverride : Math.round(lengths.reduce((sum, length) => sum + length, 0) / lengths.length);
  const lastStart = starts[starts.length - 1];
  const nextDate = new Date(`${lastStart}T12:00:00`);
  nextDate.setDate(nextDate.getDate() + averageLength);
  return { averageLength, nextDate: isoDate(nextDate), lastStart };
}

function normalizeData(input: BloomVaultData): BloomVaultData {
  return {
    ...EMPTY_BLOOM_DATA,
    ...input,
    format: 'tracker-bloom-data-v1',
    periods: [...(input.periods || [])].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    checkIns: [...(input.checkIns || [])].sort((a, b) => b.date.localeCompare(a.date)),
    lifestyle: [...(input.lifestyle || [])].sort((a, b) => b.date.localeCompare(a.date)),
    journal: [...(input.journal || [])].sort((a, b) => b.date.localeCompare(a.date)),
    plans: [...(input.plans || [])].sort((a, b) => a.date.localeCompare(b.date)),
    preferences: input.preferences || {},
    reminders: input.reminders || { enabled: false, discreet: true },
  };
}

export const BloomView: React.FC = () => {
  const { state, updateSettings } = useApp();
  const enabled = Boolean(state.settings?.bloomEnabled);
  const [activePage, setActivePage] = useState<BloomPage>('overview');
  const [initialVaultState] = useState(() => {
    try { return { envelope: readBloomEnvelope(), error: null as string | null }; }
    catch (caught) { return { envelope: null, error: caught instanceof Error ? caught.message : 'Bloom vault could not be read.' }; }
  });
  const [envelope, setEnvelope] = useState<BloomVaultEnvelope | null>(() => {
    return initialVaultState.envelope;
  });
  const [vault, setVault] = useState<BloomVaultData | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [sessionPassphrase, setSessionPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState(todayString());
  const [periodEnd, setPeriodEnd] = useState('');
  const [flow, setFlow] = useState<BloomFlow>('medium');
  const [flowColor, setFlowColor] = useState('');
  const [clots, setClots] = useState('');
  const [mood, setMood] = useState('');
  const [energy, setEnergy] = useState(3);
  const [moodIntensity, setMoodIntensity] = useState(3);
  const [stress, setStress] = useState(3);
  const [motivation, setMotivation] = useState(3);
  const [gratitude, setGratitude] = useState('');
  const [symptomSeverity, setSymptomSeverity] = useState<Record<string, number>>({});
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [checkInNote, setCheckInNote] = useState('');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(todayString());
  const [sleepHours, setSleepHours] = useState('');
  const [waterMl, setWaterMl] = useState('');
  const [activity, setActivity] = useState('');
  const [appetite, setAppetite] = useState('');
  const [caffeine, setCaffeine] = useState('');
  const [stressNote, setStressNote] = useState('');
  const [medication, setMedication] = useState('');
  const [customSymptom, setCustomSymptom] = useState('');
  const [customMood, setCustomMood] = useState('');
  const [journalText, setJournalText] = useState('');
  const [journalKind, setJournalKind] = useState('Note for myself');
  const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
  const [journalSearch, setJournalSearch] = useState('');
  const [planText, setPlanText] = useState('');
  const [planDate, setPlanDate] = useState(todayString());
  const [reminderTime, setReminderTime] = useState('09:00');
  const [cycleOverride, setCycleOverride] = useState('');
  const [reminderShownFor, setReminderShownFor] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const cycleEstimate = useMemo(() => vault ? estimateCycle(vault.periods, Number(vault.preferences?.cycleLengthOverride) || undefined) : null, [vault]);
  const lastPeriod = vault?.periods[0];
  const cycleDay = lastPeriod ? Math.max(1, daysBetween(lastPeriod.startDate, todayString()) + 1) : null;
  const todayCheckIn = vault?.checkIns.find((checkIn) => checkIn.date === todayString());

  useEffect(() => {
    setMood(todayCheckIn?.mood || '');
    setEnergy(todayCheckIn?.energy || 3);
    setMoodIntensity(todayCheckIn?.moodIntensity || 3); setStress(todayCheckIn?.stress || 3); setMotivation(todayCheckIn?.motivation || 3); setGratitude(todayCheckIn?.gratitude || ''); setSymptomSeverity(todayCheckIn?.symptomSeverity || {});
    setSymptoms(todayCheckIn?.symptoms || []);
    setCheckInNote(todayCheckIn?.note || '');
    const lifestyle = vault?.lifestyle?.find((entry) => entry.date === todayString());
    setSleepHours(lifestyle?.sleepHours?.toString() || ''); setWaterMl(lifestyle?.waterMl?.toString() || ''); setActivity(lifestyle?.activity || '');
    setAppetite(lifestyle?.appetite || ''); setCaffeine(lifestyle?.caffeine || ''); setStressNote(lifestyle?.stress || ''); setMedication(lifestyle?.medication || '');
  }, [todayCheckIn?.id, vault?.lifestyle?.length]);

  useEffect(() => { setCycleOverride(vault?.preferences?.cycleLengthOverride ? String(vault.preferences.cycleLengthOverride) : ''); }, [vault?.preferences?.cycleLengthOverride]);

  useEffect(() => {
    if (!vault?.reminders?.enabled || !vault.reminders.time || !vault) return;
    const checkReminder = () => {
      const now = new Date();
      const key = `${todayString()}-${vault.reminders?.time}`;
      if (now.toTimeString().slice(0, 5) === vault.reminders?.time && reminderShownFor !== key) {
        setReminderShownFor(key); setNotice('A gentle reminder: take a moment for yourself, if that feels right.');
      }
    };
    const timer = window.setInterval(checkReminder, 20_000);
    checkReminder();
    return () => window.clearInterval(timer);
  }, [vault?.reminders?.enabled, vault?.reminders?.time, reminderShownFor]);


  const unlock = async () => {
    setError(null); setNotice(null); setBusy(true);
    try {
      if (!envelope) {
        if (initialVaultState.error) throw new Error(`The existing vault could not be read: ${initialVaultState.error} Delete it only if you are certain you do not need its contents.`);
        if (passphrase.length < 10) throw new Error('Use a passphrase with at least 10 characters.');
        if (passphrase !== confirmPassphrase) throw new Error('The passphrases do not match.');
        const created = await createBloomEnvelope(EMPTY_BLOOM_DATA, passphrase);
        persistBloomEnvelope(created);
        setEnvelope(created);
        setVault(EMPTY_BLOOM_DATA);
        setSessionPassphrase(passphrase);
        setNotice('Your encrypted Bloom vault is ready on this device.');
      } else {
        setVault(normalizeData(await unlockBloomEnvelope(envelope, passphrase)));
        setSessionPassphrase(passphrase);
      }
      setPassphrase(''); setConfirmPassphrase('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bloom could not open the private vault.');
    } finally { setBusy(false); }
  };

  const saveVault = async (next: BloomVaultData, message?: string) => {
    if (!sessionPassphrase) return;
    setError(null); setBusy(true);
    try {
      const normalized = normalizeData(next);
      const updated = await createBloomEnvelope(normalized, sessionPassphrase);
      persistBloomEnvelope(updated);
      setEnvelope(updated); setVault(normalized);
      if (message) setNotice(message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bloom could not save this entry.');
    } finally { setBusy(false); }
  };

  const startNewPeriod = () => {
    setEditingPeriodId(null); setPeriodStart(todayString()); setPeriodEnd(''); setFlow('medium'); setFlowColor(''); setClots(''); setPeriodOpen(true);
  };
  const editPeriod = (period: BloomPeriod) => {
    setEditingPeriodId(period.id); setPeriodStart(period.startDate); setPeriodEnd(period.endDate || ''); setFlow(period.flow || 'medium'); setFlowColor(period.color || ''); setClots(period.clots || ''); setPeriodOpen(true);
  };
  const selectCalendarDate = (date: string) => {
    if (!date) return;
    setCalendarSelectedDate(date);
    const existing = vault?.periods.find((period) => date >= period.startDate && date <= (period.endDate || todayString()));
    if (existing) { editPeriod(existing); return; }
    setEditingPeriodId(null); setPeriodStart(date); setPeriodEnd(''); setFlow('medium'); setFlowColor(''); setClots(''); setPeriodOpen(true);
  };
  const savePeriod = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!vault) return;
    if (periodEnd && periodEnd < periodStart) { setError('End date must be on or after the start date.'); return; }
    const existingPeriod = editingPeriodId ? vault.periods.find((period) => period.id === editingPeriodId) : undefined;
    const updated: BloomPeriod = { ...existingPeriod, id: editingPeriodId || newId(), startDate: periodStart, endDate: periodEnd || undefined, flow, color: flowColor || undefined, clots: clots || undefined };
    const periods = editingPeriodId
      ? vault.periods.map((period) => period.id === editingPeriodId ? updated : period)
      : [...vault.periods, updated];
    setPeriodOpen(false);
    await saveVault({ ...vault, periods }, editingPeriodId ? 'Period entry updated.' : 'Period start saved.');
  };
  const deletePeriod = async (id: string) => {
    if (!vault || !window.confirm('Delete this period entry from your encrypted Bloom vault?')) return;
    await saveVault({ ...vault, periods: vault.periods.filter((period) => period.id !== id) }, 'Period entry deleted.');
  };

  const saveCheckIn = async () => {
    if (!vault) return;
    const entry: BloomCheckIn = {
      ...todayCheckIn, id: todayCheckIn?.id || newId(), date: todayString(), mood: mood || undefined,
      energy, symptoms, note: checkInNote.trim() || undefined, moodIntensity: mood ? moodIntensity : undefined,
      stress, motivation, gratitude: gratitude.trim() || undefined, symptomSeverity: Object.keys(symptomSeverity).length ? symptomSeverity : undefined,
    };
    const checkIns = [...vault.checkIns.filter((item) => item.date !== entry.date), entry];
    await saveVault({ ...vault, checkIns }, 'Today’s check-in saved privately.');
  };

  const saveLifestyle = async () => {
    if (!vault) return;
    const old = vault.lifestyle?.find((entry) => entry.date === todayString());
    const entry: BloomLifestyleEntry = { ...old, id: old?.id || newId(), date: todayString(), sleepHours: sleepHours ? Number(sleepHours) : undefined, waterMl: waterMl ? Number(waterMl) : undefined, activity: activity || undefined, appetite: appetite || undefined, caffeine: caffeine || undefined, stress: stressNote || undefined, medication: medication || undefined };
    await saveVault({ ...vault, lifestyle: [entry, ...(vault.lifestyle || []).filter((item) => item.date !== entry.date)] }, 'Lifestyle log saved privately.');
  };
  const addJournal = async () => {
    if (!vault || !journalText.trim()) return;
    const existing = vault.journal?.find((item) => item.id === editingJournalId);
    const item: BloomJournalEntry = { ...existing, id: editingJournalId || newId(), date: existing?.date || todayString(), kind: journalKind, text: journalText.trim() };
    const journal = editingJournalId ? (vault.journal || []).map((entry) => entry.id === editingJournalId ? item : entry) : [item, ...(vault.journal || [])];
    await saveVault({ ...vault, journal }, editingJournalId ? 'Private journal note updated.' : 'Private journal note saved.'); setJournalText(''); setEditingJournalId(null);
  };
  const deleteJournal = async (id: string) => {
    if (!vault || !window.confirm('Delete this private journal note?')) return;
    await saveVault({ ...vault, journal: (vault.journal || []).filter((item) => item.id !== id) }, 'Private journal note deleted.');
    if (editingJournalId === id) { setEditingJournalId(null); setJournalText(''); }
  };
  const addPlan = async () => {
    if (!vault || !planText.trim()) return;
    const item: BloomPlanEntry = { id: newId(), date: planDate, text: planText.trim(), done: false };
    await saveVault({ ...vault, plans: [...(vault.plans || []), item].sort((a, b) => a.date.localeCompare(b.date)) }, 'Personal plan saved inside Bloom.'); setPlanText('');
  };
  const addCustomSymptom = async () => {
    if (!vault || !customSymptom.trim()) return;
    const list = Array.isArray(vault.preferences?.customSymptoms) ? vault.preferences.customSymptoms as string[] : [];
    const value = customSymptom.trim().slice(0, 40);
    if (!list.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) await saveVault({ ...vault, preferences: { ...vault.preferences, customSymptoms: [...list, value] } }, 'Your symptom label was added.');
    setCustomSymptom('');
  };
  const addCustomMood = async () => {
    if (!vault || !customMood.trim()) return;
    const list = Array.isArray(vault.preferences?.customMoods) ? vault.preferences.customMoods as string[] : [];
    const value = customMood.trim().slice(0, 30);
    if (!list.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) await saveVault({ ...vault, preferences: { ...vault.preferences, customMoods: [...list, value] } }, 'Your mood label was added.');
    setCustomMood('');
  };
  const saveCyclePreference = async () => {
    if (!vault) return;
    const parsed = Number(cycleOverride);
    if (cycleOverride && (!Number.isFinite(parsed) || parsed < 15 || parsed > 60)) { setError('Choose a personal cycle estimate between 15 and 60 days, or leave it blank to use recorded history.'); return; }
    await saveVault({ ...vault, preferences: { ...vault.preferences, cycleLengthOverride: cycleOverride ? parsed : null } }, 'Cycle estimate preference saved.');
  };
  const saveBloomPreference = async (key: string, value: unknown, message: string) => {
    if (!vault) return;
    await saveVault({ ...vault, preferences: { ...vault.preferences, [key]: value } }, message);
  };
  const togglePlan = async (id: string) => { if (vault) await saveVault({ ...vault, plans: (vault.plans || []).map((item) => item.id === id ? { ...item, done: !item.done } : item) }); };
  const setReminder = async (enabledReminder: boolean) => { if (vault) await saveVault({ ...vault, reminders: { enabled: enabledReminder, time: reminderTime, discreet: true } }, enabledReminder ? 'Gentle in-app reminder enabled. No sensitive lock-screen notification will be sent.' : 'Reminder turned off.'); };
  const exportEncryptedBackup = () => {
    if (!envelope) return;
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `bloom-encrypted-backup-${todayString()}.json`; link.click();
    URL.revokeObjectURL(url);
    setNotice('Encrypted backup downloaded. It still needs your passphrase to open.');
  };

  const importEncryptedBackup = async (file?: File) => {
    if (!file || !sessionPassphrase) return;
    setError(null); setBusy(true);
    try {
      const imported = parseBloomBackup(await file.text());
      const importedData = await unlockBloomEnvelope(imported, sessionPassphrase);
      persistBloomEnvelope(imported);
      setEnvelope(imported); setVault(normalizeData(importedData));
      setNotice('Encrypted Bloom backup restored on this device.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That backup could not be restored.');
    } finally { setBusy(false); if (importRef.current) importRef.current.value = ''; }
  };

  const deleteVault = () => {
    if (!window.confirm('Permanently delete every Bloom entry and its encrypted local vault? This cannot be undone.')) return;
    removeBloomEnvelope(); setEnvelope(null); setVault(null); setPassphrase(''); setSessionPassphrase(''); setNotice('Bloom vault permanently deleted from this device.'); setError(null);
  };

  const calendarCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: Math.ceil((mondayOffset + count) / 7) * 7 }, (_, index) => {
      const day = index - mondayOffset + 1;
      return day > 0 && day <= count ? isoDate(new Date(month.getFullYear(), month.getMonth(), day)) : '';
    });
  }, [month]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - index));
    const key = isoDate(date);
    return { key, label: date.toLocaleDateString(undefined, { weekday: 'short' }), day: date.getDate(), checkIn: vault?.checkIns.find((entry) => entry.date === key), period: Boolean(vault?.periods.some((entry) => key >= entry.startDate && key <= (entry.endDate || todayString()))) };
  }), [vault?.checkIns, vault?.periods]);
  const isPeriodDay = (date: string) => Boolean(date && vault?.periods.some((period) => date >= period.startDate && date <= (period.endDate || todayString())));
  const isPredictedDay = (date: string) => Boolean(date && cycleEstimate && date >= cycleEstimate.nextDate && date < isoDate(new Date(asLocalDate(cycleEstimate.nextDate).getTime() + 5 * 86_400_000)));

  if (!enabled) {
    return (
      <div className="mx-auto max-w-xl py-8 sm:py-14 animate-in fade-in duration-200">
        <Card className="overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-300 via-terracotta-400 to-violet-300" />
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-500">
              <Flower2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[.22em] text-rose-500">Private wellness space</p>
              <h1 className="mt-1 font-serif text-3xl text-espresso-950 dark:text-ivory-50">Bloom</h1>
              <p className="mt-2 text-sm leading-relaxed text-espresso-600 dark:text-ivory-300">
                A gentle, confidential place to track period dates, symptoms, moods, and daily wellness check-ins at your own pace. Your records are client-side encrypted on this device and never uploaded to cloud sync.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  onClick={() => updateSettings({ bloomEnabled: true })}
                  icon={<Flower2 className="h-4 w-4" />}
                >
                  Enable &amp; Open Bloom
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="mx-auto max-w-xl py-8 sm:py-14">
        <Card className="overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-300 via-terracotta-400 to-violet-300" />
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-100 dark:bg-rose-950/40 text-rose-500"><LockKeyhole aria-hidden="true" /></div>
          <div><p className="text-[10px] font-mono uppercase tracking-[.22em] text-rose-500">Private wellness space</p><h1 className="mt-1 font-serif text-3xl text-espresso-950 dark:text-ivory-50">Bloom</h1><p className="mt-2 text-sm leading-relaxed text-espresso-600 dark:text-ivory-300">A gentle place to keep period dates and daily check-ins, at your pace. Your records are encrypted on this device and never added to TRAKIFY cloud sync.</p></div>
          </div>
          <form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); void unlock(); }}>
            <label className="block text-xs font-semibold text-espresso-800 dark:text-ivory-200" htmlFor="bloom-passphrase">{envelope ? 'Passphrase' : 'Create a private passphrase'}</label>
            <input id="bloom-passphrase" type="password" autoComplete={envelope ? 'current-password' : 'new-password'} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} className="w-full rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 px-3.5 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400" required minLength={envelope ? undefined : 10} />
            {!envelope && <><label className="block text-xs font-semibold text-espresso-800 dark:text-ivory-200" htmlFor="bloom-passphrase-confirm">Confirm passphrase</label><input id="bloom-passphrase-confirm" type="password" autoComplete="new-password" value={confirmPassphrase} onChange={(event) => setConfirmPassphrase(event.target.value)} className="w-full rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-900 px-3.5 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400" required minLength={10} /><p className="text-[11px] text-espresso-400">Use 10 or more characters. TRAKIFY cannot recover a forgotten passphrase.</p></>}
            {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
            {initialVaultState.error && <p role="alert" className="text-xs text-rose-600">The existing Bloom vault could not be read, so a new vault cannot be created over it. {initialVaultState.error}</p>}
            <Button type="submit" variant="primary" disabled={busy || Boolean(initialVaultState.error)} icon={<LockKeyhole className="h-4 w-4" />}>{busy ? 'Opening vault…' : envelope ? 'Unlock Bloom' : 'Create encrypted vault'}</Button>
          </form>
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-ivory-50 dark:bg-espresso-900/70 p-3 text-[11px] leading-relaxed text-espresso-500 dark:text-ivory-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>Your encrypted backup can be downloaded after unlocking. It is device-local by default; exporting it is always your choice.</span></div>
        </Card>
      </div>
    );
  }

  const checkInMood = mood;
  const checkInEnergy = energy;
  const selectedComfort = Array.isArray(vault.preferences?.comfortMethods) ? vault.preferences.comfortMethods as string[] : [];
  const wellnessScales: Array<{ label: string; value: number; onChange: (value: number) => void }> = [
    { label: 'Mood intensity', value: moodIntensity, onChange: setMoodIntensity },
    { label: 'Stress level', value: stress, onChange: setStress },
    { label: 'Motivation', value: motivation, onChange: setMotivation },
  ];

  return (
    <div className="bloom-app w-full max-w-none" data-palette={String(vault.preferences?.palette || 'rose')} data-minimal={String(Boolean(vault.preferences?.minimal))}>
      <header className="bloom-hero relative overflow-hidden rounded-[30px] border border-rose-200/80 dark:border-rose-900/50 p-6 sm:p-9 xl:p-11 shadow-[0_18px_55px_-35px_rgba(155,86,99,.42)]">
        <div className="bloom-hero-glow pointer-events-none absolute -right-10 -top-20 h-72 w-72 rounded-full bg-rose-300/25 blur-3xl" /><Flower2 className="bloom-hero-flower pointer-events-none absolute right-10 top-8 h-40 w-40 rotate-12 text-rose-300/20" aria-hidden="true" /><i className="bloom-petal bloom-petal-one" aria-hidden="true" /><i className="bloom-petal bloom-petal-two" aria-hidden="true" /><i className="bloom-petal bloom-petal-three" aria-hidden="true" />
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="inline-flex items-center gap-2 rounded-full border border-rose-200/80 bg-white/65 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[.2em] text-rose-600 shadow-sm dark:border-rose-900/50 dark:bg-black/15 dark:text-rose-300"><Flower2 className="h-3.5 w-3.5" /> My Orbit · your private space</p><h1 className="mt-4 font-serif text-4xl leading-none tracking-tight text-espresso-950 dark:text-ivory-50 sm:text-5xl xl:text-6xl">Bloom<span className="text-rose-400">.</span></h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-espresso-600 dark:text-ivory-300 sm:text-base">A soft place to check in, notice patterns, and make room for yourself. Your body, your notes, your pace.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => { setActivePage('cycle'); startNewPeriod(); }}>Log period</Button>
            <button type="button" onClick={() => setActivePage('checkin')} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-rose-200 bg-white/80 px-4 text-xs font-semibold text-rose-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-2 focus-visible:outline-rose-400 dark:border-rose-900/60 dark:bg-black/20 dark:text-rose-200"><Heart className="h-4 w-4" />Check in</button>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportEncryptedBackup}>Encrypted backup</Button>
            <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => importRef.current?.click()}>Restore backup</Button>
            <input ref={importRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Choose encrypted Bloom backup" onChange={(event) => void importEncryptedBackup(event.target.files?.[0])} />
            <Button variant="secondary" icon={<LockKeyhole className="h-4 w-4" />} onClick={() => { setVault(null); setPassphrase(''); setSessionPassphrase(''); setError(null); setNotice('Bloom is locked. Your encrypted records remain on this device.'); }}>Lock</Button>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap items-center gap-2 text-[11px] text-espresso-500 dark:text-ivory-400"><span className="inline-flex items-center gap-2 rounded-full bg-white/65 px-3 py-2 shadow-sm dark:bg-black/15"><ShieldCheck className="h-4 w-4 text-emerald-600" />Encrypted on this device · never cloud-synced or shared</span></div>
      </header>

      {(error || notice) && <p role={error ? 'alert' : 'status'} className={`bloom-message mx-5 mt-4 rounded-xl px-4 py-3 text-xs sm:mx-8 ${error ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>{error || notice}</p>}

      <div className="bloom-shell-layout">
        <BloomNavigation activePage={activePage} onChange={setActivePage} />
        <section id={`bloom-page-${activePage}`} aria-label={`${activePage} section in Bloom`} tabIndex={-1} className="bloom-page-content">
      {activePage !== 'overview' && activePage !== 'cycle' && <header className="bloom-section-intro"><div><span className="bloom-eyebrow">Your private wellness space</span><h2>{({ checkin: 'A moment for you', symptoms: 'Your body, in your words', journal: 'A page of your own', care: 'Comfort, without pressure', insights: 'Your patterns over time', learn: 'A gentle cycle guide', plan: 'Make a little room', settings: 'Your Bloom settings' } as Record<string, string>)[activePage]}</h2><p>{({ checkin: 'A small check-in is enough. Skip anything you do not want to answer.', symptoms: 'Look back at what you have chosen to record. No pattern is assumed.', journal: 'Write what you want, when you want. This space is private.', care: 'Choose any small thing that might feel supportive today.', insights: 'These are descriptions of your saved entries, never a diagnosis.', learn: 'Simple explanations, with room for every body to be different.', plan: 'Keep a personal plan here; it will not change your shared timetable.', settings: 'Decide how Bloom looks, reminds you, and keeps your records.' } as Record<string, string>)[activePage]}</p></div><span className="bloom-intro-flower" aria-hidden="true"><Flower2 /></span></header>}

      {(activePage === 'overview' || activePage === 'cycle') && <><section id="bloom-overview" className="grid grid-cols-1 gap-4 lg:grid-cols-12" aria-label="Cycle overview">
        <Card className="bloom-cycle-card lg:col-span-8 border-rose-200/70 shadow-[0_24px_60px_-40px_rgba(147,79,101,.5)] dark:border-rose-900/50">
          <div className="grid items-center gap-6 md:grid-cols-[minmax(220px,.85fr)_1.15fr] xl:gap-10">
            <div className="relative mx-auto flex w-full max-w-[290px] flex-col items-center gap-3"><CycleWheel cycleDay={cycleDay} totalDays={cycleEstimate?.averageLength ?? null} privacyMode={Boolean(vault.preferences?.privacyMode)} /><MoonSync /><span className="text-center text-[10px] text-espresso-400">{lastPeriod ? 'Based on your latest recorded start' : 'Your data, your pace'}</span></div>
            <div className="space-y-4">
              <div><p className="text-[10px] font-mono uppercase tracking-[.2em] text-violet-500">Cycle overview</p><h2 className="mt-1 font-serif text-2xl text-espresso-950 dark:text-ivory-50 sm:text-3xl">A rhythm that’s yours</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-espresso-600 dark:text-ivory-300">Your timeline grows from the dates you choose to record. Bodies vary, so these numbers are personal estimates—not promises.</p></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm dark:border-white/5 dark:bg-black/10"><p className="text-[10px] font-mono uppercase tracking-widest text-rose-500">Average cycle</p><p className="mt-1 font-serif text-2xl text-espresso-950 dark:text-ivory-50">{cycleEstimate ? `${cycleEstimate.averageLength} days` : 'Building'}</p><p className="mt-1 text-[11px] text-espresso-500">From your history</p></div><div className="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm dark:border-white/5 dark:bg-black/10"><p className="text-[10px] font-mono uppercase tracking-widest text-violet-500">Next period estimate</p><p className="mt-1 font-serif text-xl text-espresso-950 dark:text-ivory-50">{cycleEstimate ? dateLabel(cycleEstimate.nextDate) : 'Not enough history'}</p><p className="mt-1 text-[11px] text-espresso-500">May vary from month to month</p></div></div>
              <div className="flex flex-wrap items-center gap-3"><Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => { setActivePage('cycle'); startNewPeriod(); }}>Log period</Button><span className="text-[11px] text-espresso-400">{vault.periods.length} period {vault.periods.length === 1 ? 'entry' : 'entries'} saved privately</span></div>
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
          <Card className="!p-5 border-rose-200/60 bg-gradient-to-br from-white to-rose-50/70 dark:from-[#201b20] dark:to-[#281d24]"><p className="text-[10px] font-mono uppercase tracking-widest text-rose-500">Average period</p><p className="mt-2 font-serif text-3xl text-espresso-950 dark:text-ivory-50">{(() => { const days = vault.periods.filter((period) => period.endDate).map((period) => daysBetween(period.startDate, period.endDate!) + 1).filter((n) => n > 0 && n < 20); return days.length ? `${Math.round(days.reduce((sum, day) => sum + day, 0) / days.length)} days` : 'Building'; })()}</p><p className="mt-1 text-xs text-espresso-500">From completed logs</p></Card>
          <Card className="!p-5 border-violet-200/60 bg-gradient-to-br from-white to-violet-50/70 dark:from-[#201b20] dark:to-[#211d28]"><p className="text-[10px] font-mono uppercase tracking-widest text-violet-500">Cycle history</p><p className="mt-2 font-serif text-3xl text-espresso-950 dark:text-ivory-50">{vault.periods.length}</p><p className="mt-1 text-xs text-espresso-500">Period starts saved in your vault</p></Card>
        </div>
      </section>

      <Card className="bloom-week-widget border-rose-200/70 bg-gradient-to-r from-[#fff9f5] via-white to-[#f9f5ff] dark:border-rose-900/40 dark:from-[#241d21] dark:via-[#201d21] dark:to-[#211d28]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-sm"><p className="text-[10px] font-mono uppercase tracking-[.2em] text-rose-500">A little look back</p><h2 className="mt-1 font-serif text-xl text-espresso-950 dark:text-ivory-50">Your week in moments</h2><p className="mt-1 text-xs leading-relaxed text-espresso-500">Only the things you chose to note. Some days can stay blank.</p></div>
          <div className="grid flex-1 grid-cols-7 gap-1 sm:gap-2 lg:max-w-4xl">{weekDays.map(({ key, label, day, checkIn, period }) => { const MoodIcon = checkIn?.mood ? (MOOD_ICONS[checkIn.mood] || Flower2) : null; return <div key={key} className={`bloom-week-day flex min-w-0 flex-col items-center gap-2 rounded-2xl px-1.5 py-3 ${key === todayString() ? 'bg-white/90 shadow-sm ring-1 ring-rose-200 dark:bg-black/15 dark:ring-rose-900/60' : ''}`} aria-label={`${label} ${day}${checkIn ? ', check-in saved' : ''}${period ? ', period recorded' : ''}`}><span className="text-[10px] font-medium uppercase tracking-wide text-espresso-400">{label}</span><span className={`text-sm font-semibold ${key === todayString() ? 'text-rose-600 dark:text-rose-300' : 'text-espresso-700 dark:text-ivory-200'}`}>{day}</span><span className={`grid h-7 w-7 place-items-center rounded-full ${checkIn ? 'bg-gradient-to-br from-rose-100 to-violet-100 text-rose-700 dark:from-rose-950/60 dark:to-violet-950/50 dark:text-rose-200' : period ? 'bg-rose-100/70 text-rose-500 dark:bg-rose-950/30 dark:text-rose-300' : 'text-ivory-400 dark:text-espresso-600'}`}>{MoodIcon ? <MoodIcon className="h-3.5 w-3.5" aria-hidden="true" /> : period ? <Flower2 className="h-3 w-3" aria-hidden="true" /> : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />}</span></div>; })}</div>
          <button type="button" onClick={() => setActivePage('checkin')} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-rose-100/80 px-4 py-2.5 text-xs font-semibold text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-200/80 focus-visible:outline-2 focus-visible:outline-rose-400 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/70">Add today’s moment <Heart className="h-3.5 w-3.5" /></button>
        </div>
      </Card></>}

      <div className={`bloom-content-grid bloom-content-${activePage}`}>
        {activePage === 'overview' && <Card className="bloom-shortcuts border-rose-200/70 bg-gradient-to-br from-white to-rose-50/60 dark:from-[#211d20] dark:to-[#271e24]">
          <div><p className="bloom-eyebrow">A few gentle next steps</p><h2 className="mt-1 font-serif text-2xl text-espresso-950 dark:text-ivory-50">What would feel helpful?</h2><p className="mt-2 text-sm text-espresso-500">Choose a space. You can always come back to this overview.</p></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([['cycle','Cycle calendar',CalendarDays],['checkin','Daily check-in',ClipboardCheck],['care','Comfort corner',Heart],['insights','Personal insights',ChartPie]] as const).map(([page,label,Icon]) => <button key={page} type="button" onClick={() => setActivePage(page)} className="bloom-shortcut"><span className="bloom-shortcut-icon"><Icon className="h-5 w-5" /></span><span><strong>{label}</strong><small>{page === 'cycle' ? 'View your saved dates' : page === 'checkin' ? 'A quick note about today' : page === 'care' ? 'Find a little comfort' : 'Notice your own patterns'}</small></span><ArrowRight className="ml-auto h-4 w-4 opacity-50" /></button>)}</div>
        </Card>}
        {activePage === 'overview' && <Card className="xl:col-span-6 border-rose-200/70 bg-[#fffaf7] dark:border-rose-900/40 dark:bg-[#241e22]">
          <p className="bloom-eyebrow">A note from Bloom</p><h2 className="mt-1 font-serif text-2xl text-espresso-950 dark:text-ivory-50">{todayCheckIn ? 'You made a little space for yourself.' : 'You can begin whenever you feel ready.'}</h2><p className="mt-2 text-sm leading-relaxed text-espresso-500">{todayCheckIn ? `Today you chose to record${todayCheckIn.mood ? `: ${todayCheckIn.mood.toLowerCase()}` : ' a check-in'}. Thank you for showing up for yourself.` : 'No check-in is required. If it would feel helpful, you can leave a small note about today.'}</p><Button className="mt-4" variant="secondary" onClick={() => setActivePage('checkin')}>{todayCheckIn ? 'Update today’s check-in' : 'Start a gentle check-in'}</Button>
        </Card>}
        {activePage === 'overview' && <Card className="xl:col-span-6 border-violet-200/70 bg-[#fbf9ff] dark:border-violet-900/40 dark:bg-[#211e27]">
          <p className="bloom-eyebrow">Your recent rhythm</p><h2 className="mt-1 font-serif text-2xl text-espresso-950 dark:text-ivory-50">Small notes, over time</h2>{vault.periods.length < 2 && vault.checkIns.length < 2 ? <p className="mt-2 text-sm leading-relaxed text-espresso-500">As you choose to log more dates and check-ins, your personal history will begin to appear here. There is no target to meet.</p> : <p className="mt-2 text-sm leading-relaxed text-espresso-500">You have saved {vault.periods.length} period {vault.periods.length === 1 ? 'entry' : 'entries'} and {vault.checkIns.length} daily {vault.checkIns.length === 1 ? 'check-in' : 'check-ins'}. Explore your own descriptions when you are ready.</p>}<button type="button" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300" onClick={() => setActivePage('insights')}>Explore personal insights <ArrowRight className="h-4 w-4" /></button>
        </Card>}
        {(activePage === 'cycle') && <Card className="xl:col-span-7 border-rose-200/70 bg-[#fffdfb] shadow-[0_20px_55px_-38px_rgba(130,73,80,.55)] dark:bg-[#1d1a1e]">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-mono uppercase tracking-widest text-rose-500">Your calendar</p><h2 className="mt-1 font-serif text-xl text-espresso-950 dark:text-ivory-50">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2></div><div className="flex gap-1"><button className="rounded-lg p-2 hover:bg-ivory-100 dark:hover:bg-espresso-800 focus-visible:outline-2" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ArrowLeft className="h-4 w-4" /></button><button className="rounded-lg p-2 hover:bg-ivory-100 dark:hover:bg-espresso-800 focus-visible:outline-2" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ArrowRight className="h-4 w-4" /></button></div></div>
          <div className="mt-5 grid grid-cols-7 gap-1.5 text-center">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={`${day}-${index}`} className="py-2 text-[10px] font-mono uppercase tracking-widest text-espresso-400">{day}</span>)}{calendarCells.map((date, index) => { const period = isPeriodDay(date); const predicted = isPredictedDay(date); const selected = date === calendarSelectedDate; return <button type="button" key={`${date || 'blank'}-${index}`} disabled={!date} aria-pressed={selected} aria-label={date ? `${dateLabel(date)}${period ? ', recorded period day' : predicted ? ', estimated period window' : ''}. Select to log or edit a period.` : 'No date'} className={`relative grid aspect-square place-items-center rounded-2xl text-xs transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 disabled:pointer-events-none ${!date ? '' : period ? 'bg-gradient-to-br from-rose-400 to-rose-500 font-bold text-white shadow-[0_5px_14px_-7px_rgba(190,80,110,.8)] hover:scale-105' : date === todayString() ? 'bg-amber-100/80 font-bold text-espresso-950 ring-1 ring-amber-300 hover:bg-amber-100 dark:bg-amber-950/35 dark:text-ivory-50 dark:ring-amber-800' : 'text-espresso-700 hover:bg-rose-50 dark:text-ivory-200 dark:hover:bg-rose-950/25'} ${selected && !period ? 'ring-2 ring-rose-300 dark:ring-rose-800' : ''}`} title={period ? 'Recorded period day · select to edit' : predicted ? 'Estimated period window · select to log' : 'Select to log a period'} onClick={() => selectCalendarDate(date)}>{date ? Number(date.slice(-2)) : ''}{predicted && !period && <span aria-hidden="true" className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-violet-300" />}</button>; })}</div>
          <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-espresso-500"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-rose-400" />Recorded</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full border border-rose-300" />Estimated window</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full ring-1 ring-terracotta-500" />Today</span></div>
          <p className="mt-4 border-t border-ivory-200 pt-3 text-[11px] leading-relaxed text-espresso-500 dark:border-espresso-750">Estimates use your recent start dates. Cycles vary; this calendar cannot predict ovulation, pregnancy, or contraception safety.</p>
        </Card>}

        {activePage === 'cycle' && <Card className="xl:col-span-5 border-rose-200/70 bg-[#fffaf7] dark:bg-[#211b1d]">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-mono uppercase tracking-widest text-rose-500">Cycle log</p><h2 className="mt-1 font-serif text-xl text-espresso-950 dark:text-ivory-50">Your history</h2></div><Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={startNewPeriod}>Log period</Button></div>
          {periodOpen && <form onSubmit={(event) => void savePeriod(event)} className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/50 dark:bg-rose-950/20 sm:grid-cols-2">
            <label className="text-xs font-semibold">Start date<input required type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label>
            <label className="text-xs font-semibold">End date <span className="font-normal text-espresso-400">(optional)</span><input type="date" min={periodStart} value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label>
            <label className="text-xs font-semibold">Flow <select value={flow} onChange={(event) => setFlow(event.target.value as BloomFlow)} className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900"><option value="spotting">Spotting</option><option value="light">Light</option><option value="medium">Medium</option><option value="heavy">Heavy</option></select></label>
            <label className="text-xs font-semibold">Color (optional)<select value={flowColor} onChange={(event) => setFlowColor(event.target.value)} className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900"><option value="">Not recorded</option><option>Bright red</option><option>Dark red</option><option>Brown</option><option>Pink</option><option>Other</option></select></label>
            <label className="text-xs font-semibold sm:col-span-2">Clots (optional)<select value={clots} onChange={(event) => setClots(event.target.value)} className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900"><option value="">Not recorded</option><option value="none">None noticed</option><option value="some">Some noticed</option><option value="many">Many noticed</option></select></label>
            <div className="flex gap-2 sm:col-span-2"><Button type="submit" variant="primary" disabled={busy}>Save entry</Button><Button type="button" variant="secondary" onClick={() => setPeriodOpen(false)}>Cancel</Button></div>
          </form>}
          <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">{vault.periods.length === 0 ? <div className="rounded-xl border border-dashed border-ivory-300 p-6 text-center text-xs text-espresso-400 dark:border-espresso-700">Your cycle history will appear here when you choose to log a start date.</div> : vault.periods.map((period) => <div key={period.id} className="flex items-center justify-between gap-3 rounded-xl border border-ivory-200 bg-white/60 px-3 py-2.5 dark:border-espresso-750 dark:bg-espresso-900/50"><div><p className="text-xs font-semibold text-espresso-900 dark:text-ivory-100">{dateLabel(period.startDate)}{period.endDate ? ` – ${dateLabel(period.endDate)}` : ' · ongoing'}</p><p className="mt-0.5 text-[10px] capitalize text-espresso-400">{period.flow || 'flow not recorded'}</p></div><div className="flex gap-1"><button className="rounded-lg px-2 py-1 text-[10px] text-rose-600 hover:bg-rose-50 focus-visible:outline-2" onClick={() => editPeriod(period)}>Edit</button><button className="rounded-lg p-2 text-espresso-400 hover:text-rose-600 focus-visible:outline-2" aria-label={`Delete period starting ${dateLabel(period.startDate)}`} onClick={() => void deletePeriod(period.id)}><Trash2 className="h-3.5 w-3.5" /></button></div></div>)}</div>
        </Card>}

        {activePage === 'checkin' && <Card id="bloom-checkin" className="xl:col-span-7 border-violet-200/70 bg-[#fffdfb] dark:bg-[#1d1a20]">
          <div><p className="text-[10px] font-mono uppercase tracking-widest text-violet-500">Daily check-in</p><h2 className="mt-1 font-serif text-xl text-espresso-950 dark:text-ivory-50">How are you feeling today?</h2></div>
          <div className="bloom-relief-map mt-5"><div><p className="bloom-eyebrow">Body relief map</p><p className="mt-1 text-xs text-espresso-500">Tap any area you’d like to include in today’s check-in.</p></div><BodyMap selected={symptoms} onSelectZone={(zone)=>setSymptoms(current=>current.includes(zone)?current.filter(item=>item!==zone):[...current,zone])} /></div>
          <fieldset className="mt-4"><legend className="mb-2 text-xs font-semibold">Mood <span className="font-normal text-espresso-400">(optional)</span></legend><div className="flex flex-wrap gap-2">{[...MOODS, ...(Array.isArray(vault.preferences?.customMoods) ? vault.preferences.customMoods as string[] : [])].map((item) => <button type="button" key={item} aria-pressed={checkInMood === item} onClick={() => setMood(checkInMood === item ? '' : item)} className={`rounded-full border px-3.5 py-2 text-xs transition duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 ${checkInMood === item ? 'border-violet-300 bg-gradient-to-r from-violet-100 to-rose-100 text-violet-900 shadow-sm dark:from-violet-950/50 dark:to-rose-950/30 dark:text-violet-100' : 'border-ivory-300/90 bg-white/70 text-espresso-600 hover:bg-ivory-50 dark:border-espresso-700 dark:bg-black/10 dark:text-ivory-300'}`}><span className="mr-1.5" aria-hidden="true">{(() => { const MoodIcon = MOOD_ICONS[item] || Flower2; return <MoodIcon className="h-3.5 w-3.5" />; })()}</span>{item}</button>)}</div><div className="mt-2 flex gap-2"><input aria-label="Add your own mood" value={customMood} onChange={(e) => setCustomMood(e.target.value)} maxLength={30} placeholder="Add a mood that fits you" className="min-w-0 flex-1 rounded-lg border border-ivory-300 bg-white px-3 py-2 text-xs dark:border-espresso-700 dark:bg-espresso-900" /><button onClick={() => void addCustomMood()} disabled={busy || !customMood.trim()} className="rounded-lg border px-3 text-xs focus-visible:outline-2">Add</button></div></fieldset>
          <label className="mt-4 block text-xs font-semibold">Energy: {checkInEnergy} of 5<input type="range" min="1" max="5" value={checkInEnergy} onChange={(event) => setEnergy(Number(event.target.value))} className="mt-2 block w-full accent-violet-500" aria-label={`Energy level ${checkInEnergy} of 5`} /></label>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">{wellnessScales.map(({ label, value, onChange }) => <label key={label} className="text-xs font-semibold">{label}: {value}/5<input type="range" min="1" max="5" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 block w-full accent-violet-500" aria-label={`${label}, ${value} of 5`} /></label>)}</div>
          <fieldset className="mt-4"><legend className="mb-2 text-xs font-semibold">Symptoms <span className="font-normal text-espresso-400">(optional)</span></legend><div className="grid grid-cols-2 gap-2">{[...SYMPTOMS, ...(Array.isArray(vault.preferences?.customSymptoms) ? vault.preferences.customSymptoms as string[] : [])].map((item) => <label key={item} className="flex min-h-10 items-center gap-2 rounded-xl border border-ivory-200 px-3 text-xs text-espresso-700 dark:border-espresso-750 dark:text-ivory-300"><input type="checkbox" checked={symptoms.includes(item)} onChange={(event) => setSymptoms((current) => event.target.checked ? [...current, item] : current.filter((value) => value !== item))} className="accent-violet-500" />{item}</label>)}</div><div className="mt-2 flex gap-2"><input aria-label="Add a custom symptom" value={customSymptom} onChange={(e) => setCustomSymptom(e.target.value)} maxLength={40} placeholder="Add your own symptom" className="min-w-0 flex-1 rounded-lg border border-ivory-300 bg-white px-3 py-2 text-xs dark:border-espresso-700 dark:bg-espresso-900" /><button onClick={() => void addCustomSymptom()} disabled={busy || !customSymptom.trim()} className="rounded-lg border px-3 text-xs focus-visible:outline-2">Add</button></div></fieldset>
          {symptoms.length > 0 && <div className="mt-3 rounded-xl bg-rose-50/60 p-3 dark:bg-rose-950/20"><p className="text-[10px] font-semibold text-espresso-600 dark:text-ivory-300">How strong did each feel? <span className="font-normal text-espresso-400">(optional)</span></p><div className="mt-2 grid gap-2 sm:grid-cols-2">{symptoms.map((item) => <label key={item} className="flex items-center justify-between gap-2 text-xs"><span>{item}</span><select aria-label={`${item} severity`} value={symptomSeverity[item] || 0} onChange={(event) => setSymptomSeverity((current) => ({ ...current, [item]: Number(event.target.value) }))} className="rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-[11px] dark:border-rose-900/50 dark:bg-espresso-900"><option value={0}>Not set</option><option value={1}>Mild</option><option value={2}>Moderate</option><option value={3}>Severe</option></select></label>)}</div></div>}
          <label className="mt-4 block text-xs font-semibold">A little gratitude <span className="font-normal text-espresso-400">(optional)</span><input value={gratitude} onChange={(event) => setGratitude(event.target.value)} placeholder="Something small that felt good today…" className="mt-1 block w-full rounded-xl border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label>
          <label className="mt-4 block text-xs font-semibold">Private note <span className="font-normal text-espresso-400">(optional)</span><textarea rows={3} value={checkInNote} onChange={(event) => setCheckInNote(event.target.value)} placeholder="Anything you would like to remember…" className="mt-1 block w-full resize-y rounded-xl border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label>
          <div className="mt-4 flex items-center justify-between gap-3"><span className="text-[10px] text-espresso-400">Saved only inside your encrypted vault</span><Button variant="primary" disabled={busy} onClick={() => void saveCheckIn()}>{todayCheckIn ? 'Update check-in' : 'Save check-in'}</Button></div>
        </Card>}

        {activePage === 'settings' && <Card className="xl:col-span-5 border-rose-200/80 bg-[#fff7f3] dark:border-rose-900/50 dark:bg-[#241b20]">
          <div className="flex items-start gap-3"><Heart className="mt-0.5 h-5 w-5 text-rose-400" /><div><p className="text-[10px] font-mono uppercase tracking-widest text-rose-500">A gentle reminder</p><h2 className="mt-1 font-serif text-lg text-espresso-950 dark:text-ivory-50">Your wellbeing, at your pace.</h2><p className="mt-2 text-xs leading-relaxed text-espresso-600 dark:text-ivory-300">This space can help you notice what you choose to record. It does not diagnose or explain symptoms. If symptoms worry you, consider talking with a qualified health professional.</p></div></div>
          <div className="mt-5 border-t border-ivory-200 pt-4 dark:border-espresso-750"><h3 className="text-xs font-semibold">Private vault controls</h3><div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" icon={<LockKeyhole className="h-4 w-4" />} onClick={() => { setVault(null); setPassphrase(''); setSessionPassphrase(''); }}>Lock now</Button><Button variant="secondary" icon={<Trash2 className="h-4 w-4" />} onClick={deleteVault}>Delete vault</Button></div><p className="mt-3 text-[10px] leading-relaxed text-espresso-400">Bloom records are encrypted in this browser only. Use an encrypted export to move devices. A forgotten passphrase cannot be reset by TRAKIFY.</p></div>
        </Card>}

        {activePage === 'settings' && <Card className="xl:col-span-6 border-rose-200/70 bg-[#fffaf6] dark:border-rose-900/40 dark:bg-[#211d22]">
          <p className="bloom-eyebrow">Make it yours</p><h2 className="mt-1 font-serif text-2xl text-espresso-950 dark:text-ivory-50">Bloom appearance</h2><p className="mt-2 text-sm text-espresso-500">Choose a soft accent for this space. The light and dark surfaces still follow your TRAKIFY theme.</p>
          <fieldset className="mt-5"><legend className="mb-3 text-xs font-semibold">Accent palette</legend><div className="flex flex-wrap gap-2">{[['rose','Rose garden'],['lavender','Lavender haze'],['sage','Sage morning'],['peach','Peach tea'],['honey','Honey glow']].map(([value,label]) => <button key={value} type="button" aria-pressed={vault.preferences?.palette === value || (!vault.preferences?.palette && value === 'rose')} onClick={() => void saveBloomPreference('palette', value, 'Bloom accent updated.')} className="bloom-palette-choice" data-choice={value}><span className="bloom-palette-swatch" /><span>{label}</span></button>)}</div></fieldset>
          <label className="mt-5 flex items-start gap-3 rounded-2xl border border-ivory-200 bg-white/60 p-4 text-sm dark:border-espresso-750 dark:bg-black/10"><input type="checkbox" checked={Boolean(vault.preferences?.minimal)} onChange={(event) => void saveBloomPreference('minimal', event.target.checked, event.target.checked ? 'Bloom calm mode enabled.' : 'Bloom calm mode turned off.')} className="mt-0.5 accent-rose-500" /><span><strong className="block text-xs">Calm appearance</strong><small className="mt-1 block text-[11px] leading-relaxed text-espresso-500">Reduce decorative motion and soften visual effects.</small></span></label>
        </Card>}

        {activePage === 'care' && <Card id="bloom-care" className="xl:col-span-12 border-rose-200/70 bg-[#fff8f5] shadow-[0_18px_50px_-38px_rgba(150,70,93,.65)] dark:border-rose-900/40 dark:bg-[#241b20]">
          <div className="bloom-care-heading"><span className="bloom-care-mark"><Heart aria-hidden="true" /></span><div><p className="bloom-eyebrow">Comfort studio</p><h2 className="mt-1 font-serif text-2xl text-espresso-950 dark:text-ivory-50">Small things that may help</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-espresso-500">Choose what sounds kind to you today. These are optional comfort ideas, not treatment, and you can change them whenever you like.</p></div></div>
          <div className="bloom-care-progress" aria-live="polite"><span>{selectedComfort.length ? `${selectedComfort.length} chosen for today` : 'Your comfort list is empty'}</span><span>Saved privately in Bloom</span></div>
          <div className="bloom-care-options" role="group" aria-label="Choose comfort ideas">
            {COMFORT_OPTIONS.map(({ id, title, detail, icon: Icon }) => {
              const isSelected = selectedComfort.includes(id);
              return <button key={id} type="button" className={`bloom-care-choice${isSelected ? ' is-selected' : ''}`} aria-pressed={isSelected} disabled={busy} onClick={() => { const next = isSelected ? selectedComfort.filter((item) => item !== id) : [...selectedComfort, id]; void saveBloomPreference('comfortMethods', next, isSelected ? 'Comfort idea removed from today’s list.' : 'Comfort idea saved privately.'); }}><span className="bloom-care-choice-icon"><Icon aria-hidden="true" /></span><span className="bloom-care-choice-copy"><strong>{title}</strong><small>{detail}</small></span><span className="bloom-care-check" aria-hidden="true">{isSelected ? '✓' : '+'}</span></button>;
            })}
          </div>
          <div className="bloom-care-breathing"><div><p className="bloom-eyebrow">A quiet minute</p><h3>Take one easy breath at a time</h3><p>There is no perfect pace. Skip any hold or stop when you want.</p></div><BreathingWidget /></div>
          <p className="bloom-care-safety"><ShieldCheck aria-hidden="true" /> Keep heat comfortably warm, wrap heat sources, and take breaks to protect your skin. <a href="https://www.nhs.uk/symptoms/period-pain/" target="_blank" rel="noreferrer">More from the NHS</a></p>
        </Card>}

        {activePage === 'checkin' && <Card className="xl:col-span-6 border-amber-200/70 bg-[#fffaf1] dark:border-amber-900/30 dark:bg-[#211e1a]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-violet-500">Everyday wellbeing</p><h2 className="mt-1 font-serif text-xl text-espresso-950 dark:text-ivory-50">Sleep, hydration & movement</h2>
          <WaterTracker millilitres={Number(waterMl)||0} disabled={busy} onChange={(ml)=>{setWaterMl(String(ml)); if(vault){const old=vault.lifestyle?.find(e=>e.date===todayString()); void saveVault({...vault,lifestyle:[{...old,id:old?.id||newId(),date:todayString(),waterMl:ml},...(vault.lifestyle||[]).filter(e=>e.date!==todayString())]},'Water check-in saved in your encrypted vault.');}}} />
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold">Sleep hours<input type="number" min="0" max="24" step="0.5" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label><label className="text-xs font-semibold">Water (ml)<input type="number" min="0" step="100" value={waterMl} onChange={(e) => setWaterMl(e.target.value)} className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label><label className="text-xs font-semibold">Movement / activity<input value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Walk, stretch, rest…" className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label><label className="text-xs font-semibold">Appetite / nutrition note<input value={appetite} onChange={(e) => setAppetite(e.target.value)} placeholder="Optional personal note" className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label><label className="text-xs font-semibold">Caffeine note<input value={caffeine} onChange={(e) => setCaffeine(e.target.value)} placeholder="Optional" className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label><label className="text-xs font-semibold">Stress / events<input value={stressNote} onChange={(e) => setStressNote(e.target.value)} placeholder="Optional, in your words" className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label><label className="text-xs font-semibold sm:col-span-3">Medication or supplement note<input value={medication} onChange={(e) => setMedication(e.target.value)} placeholder="Optional record only; no medication advice" className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label></div>
          <Button className="mt-4" variant="secondary" disabled={busy} onClick={() => void saveLifestyle()}>Save today’s wellness log</Button>
          <p className="mt-2 text-[10px] text-espresso-400">Optional private notes. No scores or ideal targets.</p>
        </Card>}

        {activePage === 'symptoms' && <Card className="xl:col-span-12 border-rose-200/70 bg-[#fffdfb] dark:border-rose-900/40 dark:bg-[#211d20]">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="bloom-eyebrow">Logged symptoms</p><h3 className="mt-1 font-serif text-2xl text-espresso-950 dark:text-ivory-50">What you have noticed</h3><p className="mt-1 text-sm text-espresso-500">Counts are from your own saved check-ins.</p></div><Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setActivePage('checkin')}>Add a check-in</Button></div>
          {(() => { const totals = new Map<string, number>(); vault.checkIns.forEach((entry) => entry.symptoms.forEach((symptom) => totals.set(symptom, (totals.get(symptom) || 0) + 1))); const items = [...totals.entries()].sort((a, b) => b[1] - a[1]); const max = Math.max(1, ...items.map(([, count]) => count)); return items.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(([name, count]) => <div key={name} className="bloom-symptom-tile"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{name}</span><span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-rose-700 dark:bg-black/15 dark:text-rose-200">{count} {count === 1 ? 'day' : 'days'}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-rose-100/70 dark:bg-rose-950/40"><div className="h-full rounded-full bg-gradient-to-r from-rose-300 to-violet-300 transition-all duration-500" style={{ width: `${Math.max(8, count / max * 100)}%` }} /></div></div>)}</div> : <div className="bloom-empty-state mt-6"><span className="bloom-empty-icon"><Activity /></span><h3>Nothing to chart yet</h3><p>Your symptom history will take shape from the check-ins you choose to save.</p><Button variant="secondary" onClick={() => setActivePage('checkin')}>Start a check-in</Button></div>; })()}
          <p className="mt-5 text-[11px] text-espresso-400">A logged symptom is not a diagnosis, and frequency does not explain its cause.</p>
        </Card>}

        {activePage === 'insights' && <Card id="bloom-insights" className="xl:col-span-6 border-violet-200/70 bg-[#faf7ff] dark:border-violet-900/40 dark:bg-[#201c25]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-violet-500">Personal patterns</p><h2 className="mt-1 font-serif text-xl text-espresso-950 dark:text-ivory-50">What you’ve recorded</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-ivory-50 p-3 dark:bg-espresso-900"><p className="text-[10px] text-espresso-400">Check-ins</p><p className="mt-1 text-2xl font-semibold">{vault.checkIns.length}</p></div><div className="rounded-xl bg-ivory-50 p-3 dark:bg-espresso-900"><p className="text-[10px] text-espresso-400">Lifestyle logs</p><p className="mt-1 text-2xl font-semibold">{vault.lifestyle?.length || 0}</p></div><div className="rounded-xl bg-ivory-50 p-3 dark:bg-espresso-900"><p className="text-[10px] text-espresso-400">Journal notes</p><p className="mt-1 text-2xl font-semibold">{vault.journal?.length || 0}</p></div></div>
          <p className="mt-3 text-xs leading-relaxed text-espresso-500">Most logged symptoms (based only on your entries): {(() => { const totals = new Map<string, number>(); vault.checkIns.forEach((entry) => entry.symptoms.forEach((symptom) => totals.set(symptom, (totals.get(symptom) || 0) + 1))); return [...totals.entries()].sort((a,b) => b[1]-a[1]).slice(0,3).map(([name,count]) => `${name} · ${count}`).join('  /  ') || 'Not enough entries yet.'; })()}</p>
          <div className="mt-4 rounded-2xl border border-violet-100/80 bg-white/60 p-4 dark:border-violet-950/50 dark:bg-black/10"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-espresso-800 dark:text-ivory-200">Cycle history</p><span className="text-[10px] text-espresso-400">from your starts</span></div><div className="mt-3 space-y-2">{(() => { const starts = [...vault.periods].map((period) => period.startDate).sort().slice(-7); const rows = starts.slice(0, -1).map((start, index) => ({ start, days: daysBetween(start, starts[index + 1]) })); return rows.length ? rows.reverse().map(({ start, days }) => <div key={start} className="grid grid-cols-[74px_1fr_58px] items-center gap-3"><span className="text-[10px] text-espresso-400">{asLocalDate(start).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</span><div className="h-3 overflow-hidden rounded-full bg-ivory-100 dark:bg-espresso-900"><div className="h-full rounded-full bg-gradient-to-r from-rose-300 via-pink-300 to-violet-300 transition-all duration-700" style={{ width: `${Math.max(8, Math.min(100, days / 45 * 100))}%` }} /></div><span className="text-right text-[10px] font-medium text-espresso-500">{days} days</span></div>) : <p className="py-3 text-center text-[11px] text-espresso-400">Log another period start to see your personal rhythm appear here.</p>; })()}</div><p className="mt-3 text-[10px] leading-relaxed text-espresso-400">Cycle lengths can change. This view describes your saved dates; it does not explain why.</p></div>
          <p className="mt-2 text-[10px] text-espresso-400">These counts describe what you logged; they cannot show cause, predict health, or diagnose.</p>
        </Card>}

        {activePage === 'journal' && <Card id="bloom-journal" className="xl:col-span-6 border-rose-200/70 bg-[#fffaf7] dark:border-rose-900/40 dark:bg-[#211b20]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-rose-500">Health journal</p><h2 className="mt-1 font-serif text-xl text-espresso-950 dark:text-ivory-50">Notes for you or a care visit</h2>
          <label className="mt-4 block text-xs font-semibold">Note type<select value={journalKind} onChange={(e) => setJournalKind(e.target.value)} className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900"><option>Note for myself</option><option>Question for a clinician</option><option>Medication or supplement note</option><option>Personal context</option></select></label>
          <label className="mt-3 block text-xs font-semibold">Private note<textarea value={journalText} onChange={(e) => setJournalText(e.target.value)} rows={4} placeholder="What felt good? What would make tomorrow easier? Write only what you want to keep…" className="mt-1 block w-full resize-y rounded-xl border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label><div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" disabled={busy || !journalText.trim()} onClick={() => void addJournal()}>{editingJournalId ? 'Update private note' : 'Save private note'}</Button>{editingJournalId && <Button variant="secondary" onClick={() => { setEditingJournalId(null); setJournalText(''); }}>Cancel edit</Button>}</div>
          <label className="mt-5 block text-xs font-semibold">Find a past note<input type="search" value={journalSearch} onChange={(e) => setJournalSearch(e.target.value)} placeholder="Search your private journal" className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label>
          <div className="mt-3 max-h-80 space-y-2 overflow-auto">{(() => { const items = (vault.journal || []).filter((item) => `${item.kind} ${item.text}`.toLowerCase().includes(journalSearch.toLowerCase())); return items.length ? items.map((item) => <div key={item.id} className="rounded-xl border border-ivory-200 bg-white/70 p-3 dark:border-espresso-750 dark:bg-espresso-900/70"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] text-rose-500">{item.kind} · {dateLabel(item.date)}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{item.text}</p></div><div className="flex shrink-0 gap-1"><button type="button" className="rounded-lg px-2 py-1 text-[10px] text-violet-700 hover:bg-violet-50 focus-visible:outline-2 dark:text-violet-300 dark:hover:bg-violet-950/30" onClick={() => { setEditingJournalId(item.id); setJournalKind(item.kind); setJournalText(item.text); }}>Edit</button><button type="button" className="rounded-lg p-2 text-espresso-400 hover:text-rose-600 focus-visible:outline-2" aria-label={`Delete journal note from ${dateLabel(item.date)}`} onClick={() => void deleteJournal(item.id)}><Trash2 className="h-3.5 w-3.5" /></button></div></div></div>) : <div className="bloom-empty-state"><span className="bloom-empty-icon"><NotebookPen /></span><h3>{journalSearch ? 'No notes found' : 'A page of your own'}</h3><p>{journalSearch ? 'Try a different search. Your notes stay in this private vault.' : 'There is no pressure to write. Add a note only when it feels useful.'}</p></div>; })()}</div>
        </Card>}

        {activePage === 'plan' && <Card id="bloom-planning" className="xl:col-span-6 border-violet-200/70 bg-[#faf8ff] dark:border-violet-900/40 dark:bg-[#201d25]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-violet-500">Student-life planner</p><h2 className="mt-1 font-serif text-xl text-espresso-950 dark:text-ivory-50">Make a little room for yourself</h2><p className="mt-2 text-xs text-espresso-500">Personal notes stay inside Bloom. Nothing changes your shared timetable or planner.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[150px_1fr]"><label className="text-xs font-semibold">Date<input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label><label className="text-xs font-semibold">Personal task or break<input value={planText} onChange={(e) => setPlanText(e.target.value)} placeholder="A lighter study block, a rest break…" className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label></div><Button className="mt-3" variant="secondary" disabled={busy || !planText.trim()} onClick={() => void addPlan()}>Add to my private plan</Button>
          <div className="mt-3 space-y-2">{(vault.plans || []).map((item) => <label key={item.id} className="flex items-start gap-2 rounded-lg bg-ivory-50 p-3 text-xs dark:bg-espresso-900"><input type="checkbox" checked={item.done} onChange={() => void togglePlan(item.id)} className="mt-0.5 accent-violet-500" /><span className={item.done ? 'line-through opacity-60' : ''}><b>{dateLabel(item.date)}</b> · {item.text}</span></label>)}</div>
        </Card>}

        {activePage === 'learn' && <Card id="bloom-learning" className="xl:col-span-12 border-rose-200/70 bg-[#fffaf6] dark:border-rose-900/40 dark:bg-[#211d20]">
          <div className="bloom-learning-hero"><span className="bloom-learning-icon"><BookOpen aria-hidden="true" /></span><div><p className="bloom-eyebrow">Learn, gently</p><h2 className="mt-1 font-serif text-2xl text-espresso-950 dark:text-ivory-50">Your period, understood</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-espresso-600 dark:text-ivory-300">A clear, non-judgmental guide to cycle basics, cramps, and ways people find comfort. Bodies vary; use this for general learning, not diagnosis.</p></div></div>

          <section className="bloom-learning-section" aria-labelledby="bloom-cycle-basics-title">
            <div className="bloom-learning-section-heading"><span>01</span><div><h3 id="bloom-cycle-basics-title">The basics</h3><p>A few useful reference points. Your own pattern may be different.</p></div></div>
            <div className="bloom-learning-facts">
              <article className="bloom-learning-fact"><span className="bloom-learning-fact-icon"><CalendarDays aria-hidden="true" /></span><h4>Count from day one</h4><p>Cycle day 1 is the first day of bleeding. A cycle runs to the day before the next period begins.</p></article>
              <article className="bloom-learning-fact"><span className="bloom-learning-fact-icon"><Activity aria-hidden="true" /></span><h4>Timing can vary</h4><p>NHS guidance describes 21–35 days between periods and 2–7 bleeding days as common ranges. One cycle can differ from another.</p></article>
              <article className="bloom-learning-fact"><span className="bloom-learning-fact-icon"><Droplets aria-hidden="true" /></span><h4>Flow and colour shift</h4><p>Bleeding may be heavier at the beginning. Period blood can look red, pink, or brown on different days.</p></article>
              <article className="bloom-learning-fact"><span className="bloom-learning-fact-icon"><Flower2 aria-hidden="true" /></span><h4>Symptoms are personal</h4><p>Cramps, back or thigh aches, headache, tiredness, bloating, or mood changes can happen; you do not have to experience any particular pattern.</p></article>
            </div>
          </section>

          <section className="bloom-learning-section" aria-labelledby="bloom-phases-title">
            <div className="bloom-learning-section-heading"><span>02</span><div><h3 id="bloom-phases-title">A simple cycle map</h3><p>These phase names describe broad biology; they do not predict how you will feel.</p></div></div>
            <div className="bloom-phase-list">{[['Menstrual','The uterine lining sheds; this is the bleeding part of the cycle.'],['Follicular','The body prepares an egg and the uterine lining begins to build again. This phase starts on day one and timing varies.'],['Ovulatory','An egg may be released. Bloom does not estimate an ovulation date or fertile window.'],['Luteal','The body moves toward the next period; length and symptoms differ between people and cycles.']].map(([name,desc],index) => <article className="bloom-phase-item" key={name}><span className="bloom-phase-number">0{index + 1}</span><div><h4>{name}</h4><p>{desc}</p></div></article>)}</div>
          </section>

          <section className="bloom-learning-section" aria-labelledby="bloom-pain-title">
            <div className="bloom-learning-section-heading"><span>03</span><div><h3 id="bloom-pain-title">Why cramps happen</h3><p>One common reason, explained simply.</p></div></div>
            <div className="bloom-learning-note"><span className="bloom-learning-fact-icon"><Heart aria-hidden="true" /></span><p>The womb tightens to help shed its lining. Natural chemicals called prostaglandins are involved and can contribute to cramping. Pain can be felt in the lower abdomen and may spread to the back or thighs. This explanation cannot tell what is causing pain for one person.</p></div>
          </section>

          <section className="bloom-learning-section" aria-labelledby="bloom-relief-title">
            <div className="bloom-learning-section-heading"><span>04</span><div><h3 id="bloom-relief-title">Things that may ease discomfort</h3><p>Small self-care options can feel different for everyone; stop anything that makes you feel worse.</p></div></div>
            <div className="bloom-relief-methods">
              <article><Flame aria-hidden="true" /><div><h4>Try comfortable warmth</h4><p>A warm bath or wrapped heat source on your abdomen or back may feel soothing. Protect your skin, take breaks, and do not fall asleep with a heating pad.</p></div></article>
              <article><Activity aria-hidden="true" /><div><h4>Move gently, if you want</h4><p>Walking, stretching, swimming, or yoga are options. Rest is also a valid choice.</p></div></article>
              <article><Heart aria-hidden="true" /><div><h4>Make space for rest</h4><p>Sleep, a quiet pause, gentle massage, or a relaxation practice may help you cope with discomfort.</p></div></article>
              <article><ShieldCheck aria-hidden="true" /><div><h4>Ask about medicines</h4><p>Some non-prescription pain relievers help some people, but they are not suitable for everyone. Ask a pharmacist or clinician what is safe for you and follow the product label.</p></div></article>
            </div>
          </section>

          <aside className="bloom-learning-support" aria-labelledby="bloom-support-title"><span className="bloom-learning-fact-icon"><HandHeart aria-hidden="true" /></span><div><h3 id="bloom-support-title">You deserve support</h3><p>Consider talking with a qualified health professional if pain disrupts daily life, becomes more painful or heavier than your usual pattern, or self-care is not helping. Severe or much-worse-than-usual pain is a reason to seek prompt advice. This guide cannot assess your symptoms.</p></div></aside>

          <div className="bloom-learning-sources"><p>Trusted reading</p><a href="https://www.nhs.uk/conditions/periods/" target="_blank" rel="noreferrer">NHS · Periods</a><a href="https://www.nhs.uk/symptoms/period-pain/" target="_blank" rel="noreferrer">NHS · Period pain</a><a href="https://www.acog.org/womens-health/faqs/dysmenorrhea-painful-periods" target="_blank" rel="noreferrer">ACOG · Painful periods</a><a href="https://medlineplus.gov/periodpain.html" target="_blank" rel="noreferrer">MedlinePlus · Period pain</a></div>
          <p className="bloom-learning-disclaimer">Bloom is an educational wellness tool, not a clinician. Cycle dates and phase descriptions are estimates from your own entries; Bloom does not diagnose, predict ovulation, or provide contraception guidance.</p>
        </Card>}

        {activePage === 'settings' && <Card className="xl:col-span-6 border-violet-200/70 bg-[#faf8ff] dark:border-violet-900/40 dark:bg-[#201d25]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-violet-500">Gentle reminders</p><h2 className="mt-1 font-serif text-xl text-espresso-950 dark:text-ivory-50">A private nudge, your way</h2><p className="mt-2 text-xs text-espresso-500">Only shown inside Bloom while Tracker is open. No lock-screen notifications or sensitive messages.</p><label className="mt-4 block text-xs font-semibold">Preferred time<input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="mt-1 block rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label><div className="mt-3 flex gap-2"><Button variant="secondary" disabled={busy} onClick={() => void setReminder(true)}>Enable in-app reminder</Button>{vault.reminders?.enabled && <Button variant="secondary" disabled={busy} onClick={() => void setReminder(false)}>Turn off</Button>}</div><p className="mt-2 text-[10px] text-espresso-400">{vault.reminders?.enabled ? `Enabled for ${vault.reminders.time || reminderTime}.` : 'Currently off.'}</p>
        </Card>}

        {activePage === 'settings' && <Card className="xl:col-span-6 border-rose-200/70 bg-[#fffaf7] dark:border-rose-900/40 dark:bg-[#211d20]">
          <p className="text-[10px] font-mono uppercase tracking-widest text-rose-500">Cycle preferences</p><h2 className="mt-1 font-serif text-xl text-espresso-950 dark:text-ivory-50">Use your own baseline</h2><p className="mt-2 text-xs leading-relaxed text-espresso-500">If you know a personal typical cycle length, you can enter it. Otherwise Bloom uses your recorded starts. Estimates may be off, especially when cycles vary.</p><label className="mt-4 block text-xs font-semibold">Typical cycle length in days<input type="number" min="15" max="60" value={cycleOverride} onChange={(e) => setCycleOverride(e.target.value)} placeholder="Use recorded history" className="mt-1 block w-full rounded-lg border border-ivory-300 bg-white px-3 py-2 text-sm dark:border-espresso-700 dark:bg-espresso-900" /></label><div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" disabled={busy} onClick={() => void saveCyclePreference()}>Save my baseline</Button><Button variant="secondary" disabled={busy} onClick={() => { setCycleOverride(''); if (vault) void saveVault({ ...vault, preferences: { ...vault.preferences, cycleLengthOverride: null } }, 'Using your recorded history again.'); }}>Use history instead</Button></div>
        </Card>}
        {activePage === 'settings' && <Card className="xl:col-span-12 border-rose-200/70 bg-[#fffaf7] dark:border-rose-900/40 dark:bg-[#211d20]">
          <p className="bloom-eyebrow">Your records, your choice</p><h2 className="mt-1 font-serif text-2xl text-espresso-950 dark:text-ivory-50">Export a Bloom report kit</h2>
          <BloomIntelligenceExport vault={vault} />
        </Card>}
      </div>
        </section>
      </div>
    </div>
  );
};
