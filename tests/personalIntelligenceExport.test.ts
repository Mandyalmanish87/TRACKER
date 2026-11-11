import { describe, expect, it, vi } from 'vitest';
import { EMPTY_STATE } from '../src/services/storage';
import {
  buildTrakifyPersonalExport,
  createTrakifyGptPrompt,
  DEFAULT_TRAKIFY_EXPORT_SELECTION,
  serializeJsonToBlob,
} from '../src/services/personalIntelligenceExport';
import type { AppStateData } from '../src/types';
import type { TrakifyClassSpaceExportSource } from '../src/services/personalIntelligenceExport';
import {
  buildBloomPersonalExport,
  createBloomGptPrompt,
  DEFAULT_BLOOM_EXPORT_SELECTION,
} from '../src/services/bloomIntelligenceExport';
import type { BloomVaultData } from '../src/services/bloomVault';

const makeState = (overrides: Partial<AppStateData> = {}) => ({ ...EMPTY_STATE, ...overrides }) as AppStateData;

describe('TRAKIFY personal intelligence export', () => {
  it('uses app attendance helpers and identifies aggregate/date-filter scope', () => {
    const state = makeState({
      subjects: [{ id: 'bio', name: 'Biology', attended: 8, totalConducted: 10, targetPct: 75 }],
      settings: { ...EMPTY_STATE.settings, attendanceRequirement: 75 },
      attendanceLogs: [
        { id: 'old', date: '2025-01-01', slotId: 'slot', subjectId: 'bio', status: 'present', timestamp: '2025-01-01T12:00:00Z' },
        { id: 'recent', date: '2026-11-02', slotId: 'slot', subjectId: 'bio', status: 'present', timestamp: '2026-11-02T12:00:00Z' },
      ],
    });
    const json = buildTrakifyPersonalExport(state, DEFAULT_TRAKIFY_EXPORT_SELECTION, { dateRange: { from: '2026-11-01', to: '2026-11-30' } });
    expect(json.attendance).toMatchObject({ overall_percent: 80, classes_attended: 8, total_conducted: 10, aggregate_scope: 'all_time_current_subject_counters' });
    expect(json.attendance.history).toHaveLength(1);
    expect(json.attendance.aggregate_scope_label).toContain('not filtered by the selected date range');
    expect(json.export_metadata.data_period.note).toContain('only attendance history is');
  });

  it('omits syllabus details in both content and metadata unless summary is selected', () => {
    const selection = { ...DEFAULT_TRAKIFY_EXPORT_SELECTION, syllabus: false, syllabusDetails: true };
    const json = buildTrakifyPersonalExport(makeState(), selection);
    expect(json.syllabus_summary).toBeNull();
    expect(json.export_metadata.included_sections).not.toContain('syllabusDetails');
    expect(json.export_metadata.excluded_sections.syllabusDetails).toBe('requires_syllabus_summary_selected');
    expect(json.export_metadata.coverage).not.toHaveProperty('syllabus_subjects');
  });

  it('keeps EduHub URLs and current overall completion distinct from date-filtered lecture rows', () => {
    const state = makeState({
      eduhubCourses: [{
        id: 'course', title: 'Physics course', playlistUrl: 'https://youtube.com/playlist?list=original',
        description: 'Course description', createdAt: '2026-01-01', updatedAt: '2026-01-01',
        lectures: [
          { id: 'l1', title: 'First', youtubeUrl: 'https://youtu.be/first', videoId: 'first', durationSeconds: 60, lastPositionSeconds: 60, completed: true, addedAt: '2026-01-01', completedAt: '2026-01-03' },
          { id: 'l2', title: 'Second', youtubeUrl: 'https://youtu.be/second', videoId: 'second', durationSeconds: 120, lastPositionSeconds: 0, completed: false, addedAt: '2026-11-02' },
        ],
      }],
    });
    const json = buildTrakifyPersonalExport(state, DEFAULT_TRAKIFY_EXPORT_SELECTION, { dateRange: { from: '2026-11-01', to: '2026-11-30' } });
    const course = json.eduhub.courses[0];
    expect(course.playlist_url).toBe('https://youtube.com/playlist?list=original');
    expect(course.lectures.map((lecture: { url: string }) => lecture.url)).toEqual(['https://youtu.be/second']);
    expect(course).toMatchObject({ total_lectures: 2, completed_lectures: 1, remaining_lectures: 1, progress_scope: 'current_overall_progress_not_limited_by_date_range' });
    const noLinks = buildTrakifyPersonalExport(state, DEFAULT_TRAKIFY_EXPORT_SELECTION, { includeFreeText: false });
    expect(noLinks.eduhub.courses[0].playlist_url).toBeNull();
    expect(noLinks.eduhub.courses[0].lectures[0].url).toBeNull();
  });

  it('calculates deep-focus durations and omits optional text when requested', () => {
    const state = makeState({
      studySessions: [
        { id: 'seconds', subjectName: 'Math', durationMinutes: 1, durationSeconds: 90, timestamp: '2026-11-01T10:00:00Z', notes: 'PASTE_SECRET' },
        { id: 'minutes', durationMinutes: 2.5, timestamp: '2026-11-02T10:00:00Z' },
      ],
      profile: { ...EMPTY_STATE.profile, displayName: 'Mandy', email: 'private@example.test', studentId: 'student-secret', avatarUrl: 'data:image/png;base64,picture', bio: 'BIO_SECRET', targetExam: 'EXAM_SECRET' },
      tasks: [{ id: 'task', title: 'Task', description: 'DESCRIPTION_SECRET', status: 'todo', priority: 'medium', createdAt: '2026-11-01', subtasks: [{ id: 'sub', title: 'SUBTASK_SECRET', isCompleted: false }] }],
    });
    const json = buildTrakifyPersonalExport(state, DEFAULT_TRAKIFY_EXPORT_SELECTION, { includeFreeText: false });
    expect(json.deep_focus.total_duration_seconds).toBe(240);
    expect(json.deep_focus.sessions[0]).toMatchObject({ duration_seconds: 90, duration_minutes: 1.5 });
    expect(json.user_profile.bio).toBeNull();
    expect(json.user_profile.academic_target).toBeNull();
    const text = JSON.stringify(json);
    expect(text).not.toContain('PASTE_SECRET');
    expect(text).not.toContain('BIO_SECRET');
    expect(text).not.toContain('DESCRIPTION_SECRET');
    expect(text).not.toContain('SUBTASK_SECRET');
    expect(text).not.toContain('private@example.test');
    expect(text).not.toContain('student-secret');
    expect(text).not.toContain('data:image/png');
  });

  it('preserves free-text values when opted in and warns in metadata', () => {
    const state = makeState({ profile: { ...EMPTY_STATE.profile, displayName: 'Mandy', bio: 'Keep my exact note' } });
    const json = buildTrakifyPersonalExport(state, DEFAULT_TRAKIFY_EXPORT_SELECTION, { includeFreeText: true });
    expect(json.user_profile.bio).toBe('Keep my exact note');
    expect(json.export_metadata.privacy).toMatchObject({ free_text_included: true });
    expect(json.export_metadata.privacy.free_text_warning).toContain('Review the file before sharing');
  });

  it('fails closed for My Space identity and filters attendance to the signed-in member', () => {
    const workspace = { id: 'w1', name: 'Class A', institution: 'Campus', joinCode: 'DO-NOT-EXPORT' };
    const source = {
      workspaces: [workspace], activeWorkspace: workspace,
      currentMember: { id: 'm1', workspaceId: 'w1', userId: 'user-1', role: 'student' },
      members: [{ id: 'm1', workspaceId: 'w1', userId: 'user-1', role: 'student' }],
      attendanceRecords: [
        { id: 'own', workspaceId: 'w1', userId: 'user-1', date: '2026-11-01', status: 'present' },
        { id: 'other', workspaceId: 'w1', userId: 'user-2', date: '2026-11-01', status: 'absent' },
      ],
      attendanceStats: { attended: 3, totalConducted: 4, percentage: 75, targetPercentage: 75 },
    } as unknown as TrakifyClassSpaceExportSource;
    const selection = { ...DEFAULT_TRAKIFY_EXPORT_SELECTION, profile: false, timetable: false, attendance: false, syllabus: false, syllabusDetails: false, planner: false, performance: false, focus: false, events: false, eduhub: false, fitness: false, preferences: false };
    const selected = { ...selection, classSpace: true };
    const missingIdentity = buildTrakifyPersonalExport(makeState(), selected, { classSpace: source });
    expect(missingIdentity.my_space).toMatchObject({ availability: 'identity_unavailable', workspaces: [], your_attendance_summary: null, your_attendance_history: [] });
    const signedIn = buildTrakifyPersonalExport(makeState(), selected, { classSpace: { ...source, userId: 'user-1' } });
    expect(signedIn.my_space).toMatchObject({ availability: 'available', your_attendance_history: [{ date: '2026-11-01', status: 'present' }] });
    expect(JSON.stringify(signedIn.my_space)).not.toContain('DO-NOT-EXPORT');
    const mismatched = buildTrakifyPersonalExport(makeState(), selected, { classSpace: { ...source, userId: 'user-1', currentMember: { ...source.currentMember, userId: 'user-2' } } });
    expect(mismatched.my_space).toMatchObject({ availability: 'identity_mismatch', your_attendance_summary: null, your_attendance_history: [] });
  });

  it('omits counts from categories not selected in metadata', () => {
    const selection = { ...DEFAULT_TRAKIFY_EXPORT_SELECTION, focus: false, fitness: false, eduhub: false };
    const json = buildTrakifyPersonalExport(makeState(), selection);
    expect(json.export_metadata.coverage).not.toHaveProperty('focus_sessions');
    expect(json.export_metadata.coverage).not.toHaveProperty('eduhub_courses');
    expect(json.export_metadata.coverage).not.toHaveProperty('gym_workouts');
  });

  it('asks the report model to respect date/aggregate scope and never invent facts', () => {
    const prompt = createTrakifyGptPrompt();
    expect(prompt).toContain('not date-filtered');
    expect(prompt).toContain('Explain formulas and assumptions');
    expect(prompt).toContain('Never fabricate missing values');
    expect(prompt).toContain('interactive web-app-style');
  });
});

describe('Bloom personal intelligence export', () => {
  const makeVault = (overrides: Partial<BloomVaultData> = {}) => ({
    format: 'tracker-bloom-data-v1' as const,
    periods: [{ id: 'p1', startDate: '2026-10-01', note: 'private note' }, { id: 'p2', startDate: '2026-11-01' }],
    checkIns: [{ id: 'c1', date: '2026-10-01', mood: 'Calm', symptoms: ['Cramps'], note: 'private check-in' }],
    lifestyle: [], journal: [{ id: 'j1', date: '2026-11-02', kind: 'private', text: 'JOURNAL_SECRET' }], plans: [],
    preferences: { palette: 'rose', unknownSecret: 'must not leak', customMoods: ['Calm'] },
    reminders: { enabled: true, time: '09:00', discreet: true },
    unrelatedAppField: 'unrelated secret',
    ...overrides,
  }) as BloomVaultData;

  it('only emits Bloom vault profile data and exposes no records or counts from deselected categories', () => {
    const vault = makeVault({ profile: { displayName: 'Bloom-only name' } });
    const selection = { ...DEFAULT_BLOOM_EXPORT_SELECTION, profile: true, checkIns: false, lifestyle: false, journal: false, plans: false, preferences: false };
    const json = buildBloomPersonalExport(vault, selection, { dateRange: { from: '2026-11-01', to: '2026-11-30' } });
    expect(json.user_profile).toEqual({ display_name: 'Bloom-only name' });
    expect(json.export_metadata.coverage).toEqual({ periods: 1 });
    expect(json.export_metadata.included_sections).toEqual(['profile', 'periods']);
    expect(json.export_metadata.excluded_sections).toMatchObject({ checkIns: 'not_selected_by_user' });
    const noVaultProfile = buildBloomPersonalExport(makeVault(), { ...selection, profile: true });
    expect(noVaultProfile.user_profile).toBeNull();
    expect(noVaultProfile.export_metadata.excluded_sections.profile).toBe('not_present_in_unlocked_vault');
    expect(JSON.stringify(noVaultProfile)).not.toContain('Mandy');
    expect(Object.keys(noVaultProfile)).not.toContain('attendance');
    expect(Object.keys(noVaultProfile)).not.toContain('fitness');
  });

  it('filters selected records by date and omits free text only when opted out', () => {
    const vault = makeVault();
    const withoutText = buildBloomPersonalExport(vault, DEFAULT_BLOOM_EXPORT_SELECTION, { includeFreeText: false, dateRange: { from: '2026-11-01', to: '2026-11-30' } });
    expect(withoutText.period_records).toMatchObject({ record_count: 1, records: [{ start_date: '2026-11-01', personal_note: null }] });
    expect(withoutText.private_journal.entries).toEqual([{ date: '2026-11-02', note_type: 'private', text: null }]);
    expect(withoutText.preferences_and_reminders.preferences.custom_moods).toEqual([]);
    expect(JSON.stringify(withoutText)).not.toContain('JOURNAL_SECRET');
    const withText = buildBloomPersonalExport(vault, DEFAULT_BLOOM_EXPORT_SELECTION, { includeFreeText: true });
    expect(withText.private_journal.entries[0].text).toBe('JOURNAL_SECRET');
    expect(withText.preferences_and_reminders.preferences.custom_moods).toEqual(['Calm']);
    expect(withText.export_metadata.privacy.free_text_warning).toContain('Review before sharing');
    expect(JSON.stringify(withText)).not.toContain('unknownSecret');
    expect(JSON.stringify(withText)).not.toContain('unrelated secret');
  });

  it('requests an interactive private report with cautious calculations and no fabricated data', () => {
    const prompt = createBloomGptPrompt();
    expect(prompt).toContain('interactive web-app-style');
    expect(prompt).toContain('charts');
    expect(prompt).toContain('tables');
    expect(prompt).toContain('timelines');
    expect(prompt).toContain('Explain calculations and assumptions');
    expect(prompt).toContain('Never fabricate');
    expect(prompt).toContain('highly personal');
  });
});

describe('bounded asynchronous JSON serialization', () => {
  it('matches readable JSON output and yields while traversing larger arrays', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({ index, note: `row ${index}` }));
    const value = { rows, omitted: undefined };
    const yieldSpy = vi.spyOn(globalThis, 'setTimeout');
    const { blob, bytes } = await serializeJsonToBlob(value, { yieldEveryNodes: 2 });
    expect(yieldSpy).toHaveBeenCalled();
    yieldSpy.mockRestore();
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    expect(text).toBe(JSON.stringify(value, null, 2));
    expect(bytes).toBe(blob.size);
  });

  it('rejects oversized JSON before a download is created', async () => {
    const value = { rows: Array.from({ length: 100 }, (_, index) => ({ index, text: 'x'.repeat(100) })) };
    await expect(serializeJsonToBlob(value, { maxBytes: 800, yieldEveryNodes: 10 })).rejects.toThrow(/larger than/i);
  });
});
