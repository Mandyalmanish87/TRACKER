import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { EventCategory } from '../../types';
import {
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Calendar,
  ListTodo,
  AlertTriangle,
  X,
} from 'lucide-react';

interface GptCalendarImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ImportCategory = 'exam' | 'deadline' | 'college_event' | 'holiday' | 'task' | 'general';

interface ParsedImportData {
  format?: string;
  version?: number;
  events?: Array<{
    title: string;
    type?: string;
    date: string;
    startTime?: string;
    endTime?: string;
    allDay?: boolean;
    location?: string;
    description?: string;
    subject?: string;
    reminderMinutes?: number;
  }>;
  tasks?: Array<{
    title: string;
    dueDate?: string;
    priority?: string;
    description?: string;
    completed?: boolean;
  }>;
}

interface StagedEvent {
  id: string;
  title: string;
  category: EventCategory;
  date: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  location?: string;
  description?: string;
  isDuplicate: boolean;
  selected: boolean;
}

interface StagedTask {
  id: string;
  title: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  description?: string;
  isDuplicate: boolean;
  selected: boolean;
}

export const GptCalendarImportModal: React.FC<GptCalendarImportModalProps> = ({ isOpen, onClose }) => {
  const { state, addEvent, addTask } = useApp();

  const [step, setStep] = useState<'prompt' | 'paste' | 'preview' | 'success'>('prompt');
  const [category, setCategory] = useState<ImportCategory>('exam');
  const [copied, setCopied] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [stagedEvents, setStagedEvents] = useState<StagedEvent[]>([]);
  const [stagedTasks, setStagedTasks] = useState<StagedTask[]>([]);
  const [importSummary, setImportSummary] = useState<{ eventsCount: number; tasksCount: number } | null>(null);

  if (!isOpen) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';

  // Construct prompt based on selected category
  const generatePromptText = () => {
    let focusDirective = '';
    if (category === 'exam') {
      focusDirective = 'Extract all examination schedules, test dates, and subject papers from this document.';
    } else if (category === 'deadline') {
      focusDirective = 'Extract all coursework deadlines, project submission milestones, and assignment due dates.';
    } else if (category === 'college_event') {
      focusDirective = 'Extract college seminars, campus workshops, orientations, and cultural/academic events.';
    } else if (category === 'holiday') {
      focusDirective = 'Extract semester breaks, statutory holidays, and vacation dates.';
    } else if (category === 'task') {
      focusDirective = 'Extract actionable revision tasks, study action items, and student preparation todos.';
    } else {
      focusDirective = 'Extract all scheduled events, deadlines, exams, and student tasks.';
    }

    return `You are a high-precision academic calendar parser for my Student Tracker.
${focusDirective}

CRITICAL RULES:
1. Extract ONLY information physically present in the source image/document.
2. NEVER invent missing exam times, dates, room numbers, or course codes.
3. If an exam only specifies a date without time, set "allDay": true.
4. If text is blurry or uncertain, note it clearly in the "description" field.
5. Use strict ISO format for dates ("YYYY-MM-DD") and 24-hour time ("HH:MM").
6. The reference baseline date is ${todayStr} (Timezone: ${userTimezone}).
7. Output MUST be ONLY valid JSON matching this exact structure, with NO Markdown commentary and NO enclosing conversational text:

{
  "format": "student-tracker-events",
  "version": 1,
  "events": [
    {
      "title": "Exact Title of Exam or Event",
      "type": "${category === 'general' ? 'exam' : category}",
      "date": "2026-11-10",
      "startTime": "09:00",
      "endTime": "12:00",
      "allDay": false,
      "location": "Exam Hall 3",
      "description": "",
      "subject": "Course Name or Code",
      "reminderMinutes": 30
    }
  ],
  "tasks": [
    {
      "title": "Revise Syllabus Unit 1",
      "dueDate": "2026-11-08",
      "priority": "high",
      "description": "",
      "completed": false
    }
  ]
}`;
  };

  const handleCopyPrompt = async () => {
    const text = generatePromptText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenChatGPT = () => {
    window.open('https://chatgpt.com', '_blank', 'noopener,noreferrer');
  };

  const sanitizeAndParseJson = (raw: string): ParsedImportData => {
    let clean = raw.trim();
    // Strip markdown fences ```json ... ``` or ``` ... ```
    clean = clean.replace(/^```(?:json)?\s*/i, '');
    clean = clean.replace(/\s*```$/i, '');

    // If there is surrounding text, extract between first { and last }
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    return JSON.parse(clean);
  };

  const handleValidateAndStage = () => {
    setValidationError(null);
    if (!jsonInput.trim()) {
      setValidationError('Please paste the JSON returned by ChatGPT.');
      return;
    }

    try {
      const parsed = sanitizeAndParseJson(jsonInput);
      const rawEvents = Array.isArray(parsed.events) ? parsed.events : [];
      const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];

      if (rawEvents.length === 0 && rawTasks.length === 0) {
        throw new Error('No events or tasks found in the pasted JSON.');
      }

      // Existing records for duplicate detection
      const existingEvents = state.events || [];
      const existingReminders = state.reminders || [];
      const existingTasks = state.tasks || [];

      // Validate & stage events
      const stagedEvList: StagedEvent[] = [];
      for (const ev of rawEvents) {
        if (!ev.title || !ev.date) continue;

        // Date format check
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) {
          throw new Error(`Invalid date format for "${ev.title}": ${ev.date}. Must be YYYY-MM-DD.`);
        }

        // Duplicate check
        const isDup =
          existingEvents.some(
            (e) =>
              e.date === ev.date &&
              e.title.trim().toLowerCase() === ev.title.trim().toLowerCase()
          ) ||
          existingReminders.some(
            (r) =>
              r.dueDate === ev.date &&
              r.title.trim().toLowerCase() === ev.title.trim().toLowerCase()
          );

        let cat: EventCategory = 'exam';
        const typeStr = (ev.type || '').toLowerCase();
        if (typeStr === 'deadline') cat = 'deadline';
        else if (typeStr === 'holiday') cat = 'holiday';
        else if (typeStr === 'college_event') cat = 'college_event';
        else if (typeStr === 'task') cat = 'task';
        else if (typeStr === 'personal_event') cat = 'personal_event';
        else if (typeStr === 'reminder') cat = 'reminder';

        stagedEvList.push({
          id: `staged-ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: ev.title.trim(),
          category: cat,
          date: ev.date,
          startTime: ev.startTime,
          endTime: ev.endTime,
          isAllDay: Boolean(ev.allDay || (!ev.startTime && !ev.endTime)),
          location: ev.location,
          description: ev.description,
          isDuplicate: isDup,
          selected: !isDup, // auto-select non-duplicates
        });
      }

      // Validate & stage tasks
      const stagedTaskList: StagedTask[] = [];
      for (const t of rawTasks) {
        if (!t.title) continue;
        const due = t.dueDate || todayStr;

        const isDup = existingTasks.some(
          (ex) =>
            ex.title.trim().toLowerCase() === t.title.trim().toLowerCase() &&
            (ex.dueDate === due || !ex.dueDate)
        );

        let prio: 'high' | 'medium' | 'low' = 'medium';
        const p = (t.priority || '').toLowerCase();
        if (p === 'high' || p === 'urgent') prio = 'high';
        else if (p === 'low') prio = 'low';

        stagedTaskList.push({
          id: `staged-task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: t.title.trim(),
          dueDate: due,
          priority: prio,
          description: t.description,
          isDuplicate: isDup,
          selected: !isDup,
        });
      }

      setStagedEvents(stagedEvList);
      setStagedTasks(stagedTaskList);
      setStep('preview');
    } catch (err: any) {
      setValidationError(err.message || 'Malformed JSON. Ensure valid JSON without conversational comments.');
    }
  };

  const handleCommitImport = () => {
    let importedEventsCount = 0;
    let importedTasksCount = 0;

    // Commit selected events
    for (const ev of stagedEvents) {
      if (!ev.selected) continue;
      addEvent({
        title: ev.title,
        category: ev.category,
        date: ev.date,
        startTime: ev.startTime,
        endTime: ev.endTime,
        isAllDay: ev.isAllDay,
        location: ev.location,
        description: ev.description,
        isCompleted: false,
      });
      importedEventsCount += 1;
    }

    // Commit selected tasks
    for (const t of stagedTasks) {
      if (!t.selected) continue;
      addTask({
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
        description: t.description,
        status: 'todo',
      });
      importedTasksCount += 1;
    }

    setImportSummary({ eventsCount: importedEventsCount, tasksCount: importedTasksCount });
    setStep('success');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/75 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-ivory-200 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-terracotta-500/10 dark:bg-terracotta-500/20 text-terracotta-600 dark:text-terracotta-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-semibold text-espresso-950 dark:text-ivory-50">
                Import Calendar with ChatGPT
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Upload timetable or date sheets to ChatGPT, parse with AI, and import structured records.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-espresso-500 hover:text-espresso-900 dark:text-espresso-400 dark:hover:text-ivory-100 hover:bg-ivory-200 dark:hover:bg-espresso-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Pill */}
        <div className="flex items-center border-b border-ivory-200 dark:border-espresso-750 px-5 py-2.5 bg-ivory-100/50 dark:bg-espresso-900/40 text-xs shrink-0">
          <button
            onClick={() => setStep('prompt')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
              step === 'prompt'
                ? 'bg-white dark:bg-espresso-750 text-terracotta-600 dark:text-terracotta-400 shadow-xs'
                : 'text-espresso-500 dark:text-espresso-400'
            }`}
          >
            <span>1. Generate Prompt</span>
          </button>
          <span className="text-espresso-300 dark:text-espresso-600 mx-2">/</span>
          <button
            onClick={() => setStep('paste')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
              step === 'paste'
                ? 'bg-white dark:bg-espresso-750 text-terracotta-600 dark:text-terracotta-400 shadow-xs'
                : 'text-espresso-500 dark:text-espresso-400'
            }`}
          >
            <span>2. Paste JSON</span>
          </button>
          <span className="text-espresso-300 dark:text-espresso-600 mx-2">/</span>
          <span
            className={`px-3 py-1 rounded-lg font-medium ${
              step === 'preview' || step === 'success'
                ? 'bg-white dark:bg-espresso-750 text-terracotta-600 dark:text-terracotta-400 shadow-xs'
                : 'text-espresso-400 dark:text-espresso-600'
            }`}
          >
            3. Review &amp; Import
          </span>
        </div>

        {/* Body Container */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* STEP 1: PROMPT BUILDER */}
          {step === 'prompt' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-espresso-600 dark:text-espresso-400 mb-2 font-semibold">
                  What type of document are you importing?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'exam', label: 'Exam Timetable', icon: '📝' },
                    { id: 'deadline', label: 'Assignment Deadlines', icon: '⏰' },
                    { id: 'college_event', label: 'College Events', icon: '🏛️' },
                    { id: 'holiday', label: 'Holidays & Breaks', icon: '🏖️' },
                    { id: 'task', label: 'Revision Tasks', icon: '📋' },
                    { id: 'general', label: 'General / Mixed', icon: '📅' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCategory(item.id as ImportCategory)}
                      className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${
                        category === item.id
                          ? 'border-terracotta-500 bg-terracotta-50/50 dark:bg-terracotta-950/30 text-terracotta-900 dark:text-terracotta-100 font-semibold'
                          : 'border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:bg-ivory-50 text-espresso-700 dark:text-ivory-200'
                      }`}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span className="text-xs truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generated Prompt Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono uppercase text-espresso-500 dark:text-espresso-400">
                    Targeted ChatGPT Prompt
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="text-xs px-3 py-1 rounded-lg bg-terracotta-500 hover:bg-terracotta-600 text-white font-semibold flex items-center gap-1.5 transition shadow-xs"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied!' : 'Copy Prompt'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenChatGPT}
                      className="text-xs px-3 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-700 dark:text-ivory-200 font-semibold flex items-center gap-1.5 hover:bg-ivory-50 transition"
                    >
                      <span>Open ChatGPT</span>
                      <ExternalLink className="w-3.5 h-3.5 text-espresso-400" />
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <pre className="p-3.5 rounded-xl bg-ivory-100 dark:bg-espresso-950 border border-ivory-200 dark:border-espresso-750 text-[11px] font-mono text-espresso-800 dark:text-ivory-200 overflow-x-auto max-h-48 leading-relaxed scrollbar-thin">
                    {generatePromptText()}
                  </pre>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-4 rounded-xl bg-ivory-50 dark:bg-espresso-800/40 border border-ivory-200 dark:border-espresso-750 text-xs text-espresso-600 dark:text-espresso-300 space-y-1.5">
                <p className="font-semibold text-espresso-900 dark:text-ivory-100">
                  How it works:
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-espresso-500 dark:text-espresso-400">
                  <li>Click <strong>Copy Prompt</strong> above.</li>
                  <li>Go to <strong>ChatGPT</strong>, attach the photo or PDF of your exam schedule, and paste the prompt.</li>
                  <li>Copy the JSON that ChatGPT returns and click <strong>Next: Paste JSON</strong> below.</li>
                </ol>
              </div>
            </div>
          )}

          {/* STEP 2: PASTE JSON */}
          {step === 'paste' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-espresso-600 dark:text-espresso-400 mb-2 font-semibold">
                  Paste the JSON returned by ChatGPT
                </label>
                <textarea
                  rows={10}
                  value={jsonInput}
                  onChange={(e) => {
                    setJsonInput(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder='Paste JSON here (e.g. { "format": "student-tracker-events", "events": [...] })'
                  className="w-full p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-950 border border-ivory-300 dark:border-espresso-750 text-xs font-mono text-espresso-900 dark:text-ivory-100 focus:outline-hidden focus:border-terracotta-500 focus:ring-1 focus:ring-terracotta-500"
                />
              </div>

              {validationError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: PREVIEW & DEDUPLICATION */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-espresso-600 dark:text-espresso-400 pb-2 border-b border-ivory-200 dark:border-espresso-750">
                <span className="font-semibold text-espresso-900 dark:text-ivory-100">
                  Parsed Records ({stagedEvents.length} Events, {stagedTasks.length} Tasks)
                </span>
                <span>Select items to commit to your calendar</span>
              </div>

              {/* Events Table */}
              {stagedEvents.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-mono uppercase text-espresso-500 dark:text-espresso-400 flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-terracotta-500" />
                    <span>Calendar Events &amp; Exams ({stagedEvents.length})</span>
                  </span>
                  <div className="border border-ivory-200 dark:border-espresso-750 rounded-xl overflow-hidden max-h-56 overflow-y-auto scrollbar-thin">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-ivory-100/70 dark:bg-espresso-800/60 border-b border-ivory-200 dark:border-espresso-750 text-espresso-600 dark:text-espresso-300 font-mono">
                        <tr>
                          <th className="p-2.5 w-8 text-center">
                            <input
                              type="checkbox"
                              checked={stagedEvents.every((e) => e.selected)}
                              onChange={(e) => {
                                const chk = e.target.checked;
                                setStagedEvents((prev) => prev.map((item) => ({ ...item, selected: chk })));
                              }}
                              className="rounded border-ivory-300 dark:border-espresso-600 text-terracotta-500"
                            />
                          </th>
                          <th className="p-2.5">Title</th>
                          <th className="p-2.5">Date &amp; Time</th>
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ivory-200 dark:divide-espresso-750">
                        {stagedEvents.map((ev, i) => (
                          <tr
                            key={ev.id}
                            className={`hover:bg-ivory-50 dark:hover:bg-espresso-800/40 transition ${
                              ev.isDuplicate ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                            }`}
                          >
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={ev.selected}
                                onChange={(e) => {
                                  const chk = e.target.checked;
                                  setStagedEvents((prev) =>
                                    prev.map((item, idx) => (idx === i ? { ...item, selected: chk } : item))
                                  );
                                }}
                                className="rounded border-ivory-300 dark:border-espresso-600 text-terracotta-500"
                              />
                            </td>
                            <td className="p-2.5 font-medium text-espresso-900 dark:text-ivory-100">
                              {ev.title}
                            </td>
                            <td className="p-2.5 font-mono text-espresso-600 dark:text-espresso-300 whitespace-nowrap">
                              {ev.date}
                              {ev.startTime && ` · ${ev.startTime}`}
                            </td>
                            <td className="p-2.5 uppercase font-mono text-[10px] text-espresso-500 dark:text-espresso-400">
                              {ev.category}
                            </td>
                            <td className="p-2.5">
                              {ev.isDuplicate ? (
                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-medium">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>Duplicate</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  New
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tasks Table */}
              {stagedTasks.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-mono uppercase text-espresso-500 dark:text-espresso-400 flex items-center gap-1.5 font-medium">
                    <ListTodo className="w-3.5 h-3.5 text-terracotta-500" />
                    <span>Tasks ({stagedTasks.length})</span>
                  </span>
                  <div className="border border-ivory-200 dark:border-espresso-750 rounded-xl overflow-hidden max-h-48 overflow-y-auto scrollbar-thin">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-ivory-100/70 dark:bg-espresso-800/60 border-b border-ivory-200 dark:border-espresso-750 text-espresso-600 dark:text-espresso-300 font-mono">
                        <tr>
                          <th className="p-2.5 w-8 text-center">
                            <input
                              type="checkbox"
                              checked={stagedTasks.every((t) => t.selected)}
                              onChange={(e) => {
                                const chk = e.target.checked;
                                setStagedTasks((prev) => prev.map((item) => ({ ...item, selected: chk })));
                              }}
                              className="rounded border-ivory-300 dark:border-espresso-600 text-terracotta-500"
                            />
                          </th>
                          <th className="p-2.5">Task Title</th>
                          <th className="p-2.5">Due Date</th>
                          <th className="p-2.5">Priority</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ivory-200 dark:divide-espresso-750">
                        {stagedTasks.map((t, i) => (
                          <tr key={t.id} className="hover:bg-ivory-50 dark:hover:bg-espresso-800/40 transition">
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={t.selected}
                                onChange={(e) => {
                                  const chk = e.target.checked;
                                  setStagedTasks((prev) =>
                                    prev.map((item, idx) => (idx === i ? { ...item, selected: chk } : item))
                                  );
                                }}
                                className="rounded border-ivory-300 dark:border-espresso-600 text-terracotta-500"
                              />
                            </td>
                            <td className="p-2.5 font-medium text-espresso-900 dark:text-ivory-100">
                              {t.title}
                            </td>
                            <td className="p-2.5 font-mono text-espresso-600 dark:text-espresso-300">
                              {t.dueDate}
                            </td>
                            <td className="p-2.5 uppercase font-mono text-[10px] text-espresso-500 dark:text-espresso-400">
                              {t.priority}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'success' && importSummary && (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-serif text-lg font-semibold text-espresso-950 dark:text-ivory-50">
                Import Completed Successfully!
              </h4>
              <p className="text-xs text-espresso-600 dark:text-espresso-300 max-w-sm mx-auto">
                Committed {importSummary.eventsCount} events and {importSummary.tasksCount} tasks to your calendar planner.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-ivory-200 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-800/20 flex items-center justify-between shrink-0">
          {step === 'prompt' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep('paste')}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white shadow-xs transition"
              >
                Next: Paste JSON
              </button>
            </>
          )}

          {step === 'paste' && (
            <>
              <button
                type="button"
                onClick={() => setStep('prompt')}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 transition"
              >
                Back to Prompt
              </button>
              <button
                type="button"
                onClick={handleValidateAndStage}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white shadow-xs transition"
              >
                Validate &amp; Preview
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => setStep('paste')}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 transition"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleCommitImport}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white shadow-xs transition"
              >
                Import Selected ({stagedEvents.filter((e) => e.selected).length + stagedTasks.filter((t) => t.selected).length})
              </button>
            </>
          )}

          {step === 'success' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white shadow-xs transition"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
