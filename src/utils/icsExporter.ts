/**
 * ICS (iCalendar) Exporter
 * RFC 5545-compliant VEVENT builder — no external libraries.
 *
 * Supports:
 *  - exportRemindersICS(reminders)      → ics string
 *  - exportTasksICS(tasks)              → ics string
 *  - exportCombinedICS(reminders, tasks) → ics string
 */

import type { Reminder, PlannerTask, CalendarEvent } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Escapes special ICS characters in text values */
function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Folds long lines to max 75 octets as per RFC 5545 §3.1
 * (Simple ASCII fold — good enough for generated content)
 */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    parts.push(' ' + remaining.slice(0, 74));
    remaining = remaining.slice(74);
  }
  return parts.join('\r\n');
}

/** Converts YYYY-MM-DD to ICS DATE value: YYYYMMDD */
function toICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/** Converts ISO string to ICS DATETIME value: YYYYMMDDTHHmmssZ */
function toICSDatetime(isoStr: string): string {
  return new Date(isoStr)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Returns a stable UID for a record */
function makeUID(id: string, domain = 'tracker.local'): string {
  return `${id}@${domain}`;
}

// ── VEVENT Builders ───────────────────────────────────────────────────────────

function buildReminderVEVENT(r: Reminder): string {
  const dtstart = `DTSTART;VALUE=DATE:${toICSDate(r.dueDate.slice(0, 10))}`;
  const dtend   = `DTEND;VALUE=DATE:${toICSDate(r.dueDate.slice(0, 10))}`;
  const summary = `SUMMARY:${escapeICS(r.title)}`;
  const uid     = `UID:${makeUID(r.id)}`;
  const cat     = `CATEGORIES:${escapeICS(r.category.toUpperCase())}`;
  const priority = r.priority === 'high' ? 'PRIORITY:1' : r.priority === 'medium' ? 'PRIORITY:5' : 'PRIORITY:9';
  const dtstamp = `DTSTAMP:${toICSDatetime(new Date().toISOString())}`;

  return [
    'BEGIN:VEVENT',
    uid,
    dtstamp,
    dtstart,
    dtend,
    summary,
    cat,
    priority,
    'END:VEVENT',
  ].map(fold).join('\r\n');
}

function buildTaskVEVENT(t: PlannerTask): string | null {
  if (!t.dueDate) return null;
  const dtstart = `DTSTART;VALUE=DATE:${toICSDate(t.dueDate)}`;
  const dtend   = `DTEND;VALUE=DATE:${toICSDate(t.dueDate)}`;
  const summary = `SUMMARY:${escapeICS(t.title)}`;
  const uid     = `UID:${makeUID(t.id)}`;
  const desc    = t.description ? `DESCRIPTION:${escapeICS(t.description)}` : null;
  const priority = t.priority === 'high' ? 'PRIORITY:1' : t.priority === 'medium' ? 'PRIORITY:5' : 'PRIORITY:9';
  const dtstamp = `DTSTAMP:${toICSDatetime(t.createdAt)}`;

  return [
    'BEGIN:VEVENT',
    uid,
    dtstamp,
    dtstart,
    dtend,
    summary,
    desc,
    priority,
    'END:VEVENT',
  ].filter(Boolean).map((l) => fold(l as string)).join('\r\n');
}

function buildCalendarEventVEVENT(e: CalendarEvent): string {
  const dtstart = `DTSTART;VALUE=DATE:${toICSDate(e.date)}`;
  const dtend   = `DTEND;VALUE=DATE:${toICSDate(e.endDate || e.date)}`;
  const summary = `SUMMARY:${escapeICS(e.title)}`;
  const uid     = `UID:${makeUID(e.id)}`;
  const cat     = `CATEGORIES:${escapeICS(e.category.toUpperCase())}`;
  const desc    = e.description ? `DESCRIPTION:${escapeICS(e.description)}` : null;
  const loc     = e.location ? `LOCATION:${escapeICS(e.location)}` : null;
  const priority = e.priority === 'high' ? 'PRIORITY:1' : e.priority === 'medium' ? 'PRIORITY:5' : 'PRIORITY:9';
  const dtstamp = `DTSTAMP:${toICSDatetime(e.createdAt || new Date().toISOString())}`;

  return [
    'BEGIN:VEVENT',
    uid,
    dtstamp,
    dtstart,
    dtend,
    summary,
    desc,
    loc,
    cat,
    priority,
    'END:VEVENT',
  ].filter(Boolean).map((l) => fold(l as string)).join('\r\n');
}

// ── Calendar wrapper ──────────────────────────────────────────────────────────

function wrapCalendar(vevents: string[]): string {
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TRACKER//Personal Daily OS//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ].join('\r\n');

  const body = vevents.join('\r\n');
  const footer = 'END:VCALENDAR';
  return [header, body, footer].join('\r\n');
}

// ── Public API ────────────────────────────────────────────────────────────────

export function exportRemindersICS(reminders: Reminder[]): string {
  const vevents = reminders.map(buildReminderVEVENT);
  return wrapCalendar(vevents);
}

export function exportTasksICS(tasks: PlannerTask[]): string {
  const vevents = tasks.map(buildTaskVEVENT).filter(Boolean) as string[];
  return wrapCalendar(vevents);
}

export function exportCombinedICS(reminders: Reminder[], tasks: PlannerTask[]): string {
  const reminderEvents = reminders.map(buildReminderVEVENT);
  const taskEvents     = tasks.map(buildTaskVEVENT).filter(Boolean) as string[];
  return wrapCalendar([...reminderEvents, ...taskEvents]);
}

export function exportCalendarEventsICS(events: CalendarEvent[]): string {
  const vevents = events.map(buildCalendarEventVEVENT);
  return wrapCalendar(vevents);
}

/** Triggers a browser file download of the ICS blob */
export function downloadICS(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

