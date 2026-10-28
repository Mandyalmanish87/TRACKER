import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadEduHubCourses,
  createCourse,
  addLectureToCourse,
  removeLectureFromCourse,
  reorderLectures,
  updateLectureProgress,
  calculateCourseStats,
  formatRemainingWorkload,
  formatDigitalTime,
} from '../src/services/eduhubStorage';
import { parseYouTubeVideoId, formatRadioTime } from '../src/components/focus-radio/youtubeUtils';
import { generateNotesFromContent } from '../src/services/lectureNotesService';
import { generateStudyNotesPdfBytes } from '../src/utils/pdfGenerator';

describe('EduHub Storage & Course Operations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('correctly extracts YouTube video ID from various URL formats', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeVideoId('invalid-url-string')).toBe(null);
  });

  it('creates and retrieves a new course', () => {
    const course = createCourse('Organic Chemistry', 'Complete Chem 101 lectures', 'terracotta');
    expect(course.id).toBeDefined();
    expect(course.title).toBe('Organic Chemistry');
    expect(course.lectures).toEqual([]);

    const courses = loadEduHubCourses();
    const found = courses.find((c) => c.id === course.id);
    expect(found).toBeDefined();
    expect(found?.title).toBe('Organic Chemistry');
  });

  it('adds, reorders, and deletes lectures in a course', () => {
    const course = createCourse('Physics Mechanics');
    addLectureToCourse(course.id, 'https://www.youtube.com/watch?v=vid11111111', 'Lecture 1: Kinematics', 1800);
    addLectureToCourse(course.id, 'https://www.youtube.com/watch?v=vid22222222', 'Lecture 2: Newton Laws', 2400);

    let updated = loadEduHubCourses().find((c) => c.id === course.id);
    expect(updated?.lectures.length).toBe(2);
    const lec1Id = updated?.lectures[0].id!;
    const lec2Id = updated?.lectures[1].id!;

    // Reorder lectures (move index 0 to 1)
    reorderLectures(course.id, 0, 1);
    updated = loadEduHubCourses().find((c) => c.id === course.id);
    expect(updated?.lectures[0].id).toBe(lec2Id);
    expect(updated?.lectures[1].id).toBe(lec1Id);

    // Remove lecture 2
    removeLectureFromCourse(course.id, lec2Id);
    updated = loadEduHubCourses().find((c) => c.id === course.id);
    expect(updated?.lectures.length).toBe(1);
    expect(updated?.lectures[0].id).toBe(lec1Id);
  });

  it('updates playback position and auto-completes when progress exceeds 90%', () => {
    const course = createCourse('Calculus');
    addLectureToCourse(course.id, 'https://www.youtube.com/watch?v=vid33333333', 'Limits & Continuity', 1000);

    const lecId = loadEduHubCourses().find((c) => c.id === course.id)!.lectures[0].id;

    // 50% watched - not completed
    updateLectureProgress(course.id, lecId, 500, 1000);
    let updatedLec = loadEduHubCourses().find((c) => c.id === course.id)?.lectures[0];
    expect(updatedLec?.lastPositionSeconds).toBe(500);
    expect(updatedLec?.completed).toBe(false);

    // 92% watched - auto-completes
    updateLectureProgress(course.id, lecId, 920, 1000);
    updatedLec = loadEduHubCourses().find((c) => c.id === course.id)?.lectures[0];
    expect(updatedLec?.completed).toBe(true);
  });

  it('accurately calculates course stats and remaining workload', () => {
    const course = createCourse('Biology');
    addLectureToCourse(course.id, 'https://youtu.be/bio11111111', 'Cell Structure', 3600);
    addLectureToCourse(course.id, 'https://youtu.be/bio22222222', 'Genetics', 5400);

    const updatedCourse = loadEduHubCourses().find((c) => c.id === course.id)!;
    const lec1Id = updatedCourse.lectures[0].id;
    const lec2Id = updatedCourse.lectures[1].id;

    // Mark lec1 complete
    updateLectureProgress(course.id, lec1Id, 3600, 3600);
    // Watch 1800s of lec2 (remaining 3600s)
    updateLectureProgress(course.id, lec2Id, 1800, 5400);

    const freshCourse = loadEduHubCourses().find((c) => c.id === course.id)!;
    const stats = calculateCourseStats(freshCourse);

    expect(stats.totalLectures).toBe(2);
    expect(stats.completedLectures).toBe(1);
    expect(stats.completionPercentage).toBe(50);
    expect(stats.totalDurationSeconds).toBe(9000);
    expect(stats.remainingSeconds).toBe(3600); // 5400 - 1800 = 3600s remaining

    const workloadFormatted = formatRemainingWorkload(stats.remainingSeconds);
    expect(workloadFormatted).toBe('1h 0m 0s');

    expect(formatDigitalTime(3665)).toBe('1:01:05');
    expect(formatDigitalTime(65)).toBe('01:05');
  });
});

describe('Lecture Notes & PDF Generation', () => {
  it('synthesizes structured study notes from content with concepts, definitions, formulas, and summary', () => {
    const content = `
      Newton's First Law of Motion states that an object remains at rest unless acted upon by a net force.
      Formula: F = m * a where F is force in Newtons, m is mass in kg, a is acceleration in m/s^2.
      Definition: Momentum is defined as the product of mass and velocity.
      Important rule: Energy cannot be created or destroyed, only transformed.
    `;

    const notes = generateNotesFromContent('Classical Mechanics', 'Newton Laws', 'https://youtu.be/newton101', content);
    expect(notes.courseTitle).toBe('Classical Mechanics');
    expect(notes.lectureTitle).toBe('Newton Laws');
    expect(notes.summary).toBeDefined();
    expect(notes.keyConcepts.length).toBeGreaterThan(0);
    expect(notes.definitions.length).toBeGreaterThan(0);
    expect(notes.formulasOrRules.length).toBeGreaterThan(0);
  });

  it('generates valid binary PDF bytes conforming to PDF 1.4 specification', () => {
    const notes = generateNotesFromContent(
      'Linear Algebra',
      'Matrices & Determinants',
      'https://youtu.be/matrix101',
      'Matrices represent linear maps. The determinant of an invertible matrix is nonzero.'
    );

    const pdfBytes = generateStudyNotesPdfBytes(notes);
    const pdfString = new TextDecoder('latin1').decode(pdfBytes);

    // Verify valid PDF 1.4 structure
    expect(pdfString.startsWith('%PDF-1.4')).toBe(true);
    expect(pdfString).toContain('/Type /Catalog');
    expect(pdfString).toContain('/Type /Pages');
    expect(pdfString).toContain('/Type /Page');
    expect(pdfString).toContain('%%EOF');
    expect(pdfBytes.length).toBeGreaterThan(500);
  });
});

describe('Focus Radio Spotify-Style Controls', () => {
  it('formats radio time into mm:ss and hh:mm:ss', () => {
    expect(formatRadioTime(0)).toBe('0:00');
    expect(formatRadioTime(45)).toBe('0:45');
    expect(formatRadioTime(75)).toBe('1:15');
    expect(formatRadioTime(3661)).toBe('1:01:01');
  });
});
