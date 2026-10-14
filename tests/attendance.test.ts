import { describe, it, expect } from 'vitest';
import { calculateSubjectAttendance, calculateOverallAttendance } from '../src/utils/attendance';
import { Subject } from '../src/types';

describe('Attendance Calculation Logic', () => {
  it('handles edge case when zero classes have been conducted', () => {
    const res = calculateSubjectAttendance(0, 0, 75);
    expect(res.percentage).toBe(100);
    expect(res.safeSkips).toBe(0);
    expect(res.neededClasses).toBe(0);
    expect(res.status).toBe('safe');
  });

  it('clamps attended classes if passed higher than total conducted', () => {
    const res = calculateSubjectAttendance(15, 10, 75);
    expect(res.percentage).toBe(100);
    expect(res.status).toBe('safe');
  });

  it('accurately calculates safe skips when attendance is above target', () => {
    // 20 conducted, 18 attended -> 90%. Target is 75%.
    // Formula: floor((18 - 0.75 * 20) / 0.75) = floor((18 - 15) / 0.75) = floor(3 / 0.75) = 4 skips!
    // Verification: if misses 4, attended=18, total=24 -> 18/24 = 75.0% exactly.
    const res = calculateSubjectAttendance(18, 20, 75);
    expect(res.percentage).toBe(90);
    expect(res.safeSkips).toBe(4);
    expect(res.neededClasses).toBe(0);
    expect(res.status).toBe('safe');
  });

  it('accurately calculates warning state when close to threshold', () => {
    // 20 conducted, 15 attended -> 75% exactly.
    // Safe skips: floor((15 - 15) / 0.75) = 0.
    const res = calculateSubjectAttendance(15, 20, 75);
    expect(res.percentage).toBe(75);
    expect(res.safeSkips).toBe(0);
    expect(res.neededClasses).toBe(0);
    expect(res.status).toBe('warning');
    expect(res.summaryText).toContain('attend next lecture');
  });

  it('accurately calculates needed consecutive classes when in deficit (< 75%)', () => {
    // 20 conducted, 12 attended -> 60%. Target 75%.
    // Deficit: 0.75 * 20 - 12 = 15 - 12 = 3.
    // Needed: ceil(3 / (1 - 0.75)) = ceil(3 / 0.25) = 12 consecutive classes.
    // Verification: attended = 12 + 12 = 24, total = 20 + 12 = 32. 24 / 32 = 75% exactly!
    const res = calculateSubjectAttendance(12, 20, 75);
    expect(res.percentage).toBe(60);
    expect(res.safeSkips).toBe(0);
    expect(res.neededClasses).toBe(12);
    expect(res.status).toBe('danger');
    expect(res.summaryText).toContain('Must attend next 12 classes');
  });

  it('handles negative or invalid inputs safely', () => {
    const res = calculateSubjectAttendance(-5, -10, 75);
    expect(res.percentage).toBe(100);
    expect(res.safeSkips).toBe(0);
  });

  it('calculates aggregate attendance correctly across multiple subjects', () => {
    const subjects: Subject[] = [
      { id: '1', code: 'CS101', name: 'Algorithms', attended: 18, totalConducted: 20, targetPct: 75, color: '#C45532' },
      { id: '2', code: 'MA102', name: 'Linear Algebra', attended: 12, totalConducted: 20, targetPct: 75, color: '#436650' },
    ];

    const overall = calculateOverallAttendance(subjects, 75);
    expect(overall.totalAttended).toBe(30);
    expect(overall.totalConducted).toBe(40);
    expect(overall.overallPercentage).toBe(75);
    expect(overall.subjectsAtRiskCount).toBe(1);
    expect(overall.safeCount).toBe(1);
    expect(overall.status).toBe('warning');
  });
});
