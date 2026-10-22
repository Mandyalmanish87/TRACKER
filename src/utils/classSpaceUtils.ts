import {
  ClassSpaceRole,
  ClassTimetableRule,
  ClassTimetableOverride,
  ResolvedClassOccurrence,
} from '../types/classSpace';
import { DayOfWeek } from '../types';
import { getDatesInRange, formatDateStr, dateToDayOfWeek } from './scheduleResolver';

// Alphabet excluding ambiguous characters: 0, O, 1, I, L
export const JOIN_CODE_CHARACTERS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const JOIN_CODE_LENGTH = 5;

/**
 * Generate a cryptographically strong 5-character join code.
 * Example outputs: 'CH7K2', '9XW4M', 'KR38B'
 */
export function generateJoinCode(): string {
  const chars = JOIN_CODE_CHARACTERS;
  const length = JOIN_CODE_LENGTH;
  const array = new Uint8Array(length);

  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }

  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[array[i] % chars.length];
  }
  return code;
}

/**
 * Normalizes user input for join codes:
 * - Trims whitespace
 * - Converts to uppercase
 * - Strips internal spaces or hyphens
 */
export function normalizeJoinCode(input: string): string {
  if (!input) return '';
  return input.trim().toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Validates whether a normalized code is exactly 5 valid alphanumeric characters.
 */
export function isValidJoinCode(code: string): boolean {
  const normalized = normalizeJoinCode(code);
  if (normalized.length !== JOIN_CODE_LENGTH) return false;
  // Check that all characters are in allowed set
  const regex = new RegExp(`^[${JOIN_CODE_CHARACTERS}]+$`);
  return regex.test(normalized);
}

/**
 * Validate profile avatar file upload:
 * - Allowed types: image/jpeg, image/png, image/webp, image/gif
 * - Max size: 2MB (2 * 1024 * 1024 bytes)
 */
export function validateProfileAvatar(file: File): { valid: boolean; error?: string } {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSizeBytes = 2 * 1024 * 1024; // 2MB

  if (!allowedMimeTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file format. Please upload a JPG, PNG, WEBP, or GIF image.',
    };
  }

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: 'File size exceeds 2MB limit. Please choose a smaller photo.',
    };
  }

  return { valid: true };
}

/**
 * Role permissions
 */
export function canManageSchedule(role?: ClassSpaceRole): boolean {
  return role === 'cr' || role === 'co_admin';
}

export function canModerate(role?: ClassSpaceRole): boolean {
  return role === 'cr' || role === 'co_admin';
}

export function canManageWorkspace(role?: ClassSpaceRole): boolean {
  return role === 'cr';
}

/**
 * Combines recurring rules and occurrence-level overrides into resolved class occurrences.
 * Preserves strict separation between recurring rule and one-off overrides/extras.
 */
export function resolveClassSchedule(
  rules: ClassTimetableRule[],
  overrides: ClassTimetableOverride[],
  startDate: Date,
  endDate: Date
): ResolvedClassOccurrence[] {
  const occurrences: ResolvedClassOccurrence[] = [];
  const dates = getDatesInRange(startDate, endDate);

  // Group overrides by ruleId::originalDate for recurring slots
  const overrideMap = new Map<string, ClassTimetableOverride>();
  const extraClasses: ClassTimetableOverride[] = [];

  for (const ov of overrides) {
    if (ov.type === 'extra') {
      extraClasses.push(ov);
    } else if (ov.ruleId && ov.originalDate) {
      overrideMap.set(`${ov.ruleId}::${ov.originalDate}`, ov);
    }
  }

  // 1. Expand recurring rules for each day in range
  for (const d of dates) {
    const dateStr = formatDateStr(d);
    const dayOfWeek = dateToDayOfWeek(d) as DayOfWeek;

    const dayRules = rules.filter((r) => r.dayOfWeek === dayOfWeek);

    for (const rule of dayRules) {
      const overrideKey = `${rule.id}::${dateStr}`;
      const override = overrideMap.get(overrideKey);

      if (override) {
        if (override.type === 'cancel') {
          // Cancelled occurrence
          occurrences.push({
            occurrenceKey: override.id,
            workspaceId: rule.workspaceId,
            subjectName: rule.subjectName,
            subjectCode: rule.subjectCode,
            subjectColor: rule.subjectColor,
            date: dateStr,
            startTime: rule.startTime,
            endTime: rule.endTime,
            room: rule.room,
            instructor: rule.instructor,
            notes: rule.notes,
            source: 'rescheduled',
            ruleId: rule.id,
            overrideId: override.id,
            isCancelled: true,
            changeNote: override.changeNote,
          });
        } else if (override.type === 'reschedule') {
          // Rescheduled to a new date/time
          // If the new date falls in this range, it will be added on the new date
          if (override.newDate === dateStr) {
            occurrences.push({
              occurrenceKey: override.id,
              workspaceId: rule.workspaceId,
              subjectName: rule.subjectName,
              subjectCode: rule.subjectCode,
              subjectColor: rule.subjectColor,
              date: override.newDate,
              startTime: override.newStartTime || rule.startTime,
              endTime: override.newEndTime || rule.endTime,
              room: override.newRoom || rule.room,
              instructor: rule.instructor,
              notes: override.newNotes || rule.notes,
              source: 'rescheduled',
              ruleId: rule.id,
              overrideId: override.id,
              isCancelled: false,
              changeNote: override.changeNote,
            });
          }
        }
      } else {
        // Normal recurring occurrence
        occurrences.push({
          occurrenceKey: `${rule.id}::${dateStr}`,
          workspaceId: rule.workspaceId,
          subjectName: rule.subjectName,
          subjectCode: rule.subjectCode,
          subjectColor: rule.subjectColor,
          date: dateStr,
          startTime: rule.startTime,
          endTime: rule.endTime,
          room: rule.room,
          instructor: rule.instructor,
          notes: rule.notes,
          source: 'recurring',
          ruleId: rule.id,
          isCancelled: false,
        });
      }
    }
  }

  // 2. Add any rescheduled occurrences whose original date was outside this range but landed in this range
  for (const ov of overrides) {
    if (ov.type === 'reschedule' && ov.ruleId && ov.originalDate) {
      const originalDateObj = new Date(ov.originalDate);
      const newDateObj = new Date(ov.newDate);
      // If newDate is in range, but originalDate was outside the range
      if (newDateObj >= startDate && newDateObj <= endDate && (originalDateObj < startDate || originalDateObj > endDate)) {
        const rule = rules.find((r) => r.id === ov.ruleId);
        if (rule) {
          occurrences.push({
            occurrenceKey: ov.id,
            workspaceId: rule.workspaceId,
            subjectName: rule.subjectName,
            subjectCode: rule.subjectCode,
            subjectColor: rule.subjectColor,
            date: ov.newDate,
            startTime: ov.newStartTime || rule.startTime,
            endTime: ov.newEndTime || rule.endTime,
            room: ov.newRoom || rule.room,
            instructor: rule.instructor,
            notes: ov.newNotes || rule.notes,
            source: 'rescheduled',
            ruleId: rule.id,
            overrideId: ov.id,
            isCancelled: false,
            changeNote: ov.changeNote,
          });
        }
      }
    }
  }

  // 3. Add extra classes that fall in range
  for (const extra of extraClasses) {
    const extraDate = new Date(extra.newDate);
    if (extraDate >= startDate && extraDate <= endDate) {
      occurrences.push({
        occurrenceKey: extra.id,
        workspaceId: extra.workspaceId,
        subjectName: extra.subjectName || 'Extra Lecture',
        subjectCode: extra.subjectCode || 'EXTRA',
        subjectColor: extra.subjectColor || '#DE6C47',
        date: extra.newDate,
        startTime: extra.newStartTime || '10:00',
        endTime: extra.newEndTime || '11:00',
        room: extra.newRoom || 'TBA',
        notes: extra.newNotes,
        source: 'extra',
        overrideId: extra.id,
        isCancelled: false,
        changeNote: extra.changeNote,
      });
    }
  }

  // Sort chronologically by date and start time
  return occurrences.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });
}

/**
 * Compute user avatar initials and fallback color from display name
 */
export function getAvatarInitials(name?: string): string {
  if (!name || !name.trim()) return 'CS';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarColor(seed?: string): string {
  const colors = [
    '#C45532', // Terracotta
    '#436650', // Forest Sage
    '#B8732E', // Warm Ochre
    '#3D6A8A', // Dusty Blue
    '#6B3F6B', // Royal Plum
    '#4A5568', // Slate
  ];
  if (!seed) return colors[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export function getAvatarBgColor(seed?: string): string {
  return getAvatarColor(seed);
}

