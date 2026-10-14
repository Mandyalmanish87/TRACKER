import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  AppStateData,
  AttendanceMark,
  StudySession,
  Reminder,
  Subject,
  UserProfile,
  AppSettings,
  SyllabusSubject,
  SyllabusChapter,
  Subtopic,
  TopicStatus,
  TimetableSlot,
  TimetableImportClass,
  DayOfWeek,
  OccurrenceOverride,
  ExtraClass,
  SyllabusImportPayload,
} from '../types';
import { storageService, DEFAULT_SYLLABUS_SUBJECTS } from '../services/storage';
import { getAttendanceRequirement } from '../utils/scheduleResolver';

interface AppContextType {
  state: AppStateData;
  // Attendance actions
  markAttendance: (slotId: string, status: AttendanceMark, date?: string) => void;
  markAttendanceForEvent: (occurrenceKey: string, subjectId: string, date: string, status: AttendanceMark, slotId?: string, extraClassId?: string, overrideId?: string, isPlanned?: boolean) => void;
  // Study timer actions
  logStudySession: (durationMinutes: number, subjectId?: string, notes?: string) => void;
  // Gym workout actions
  toggleGymSet: (exerciseIndex: number, setIndex: number) => void;
  toggleGymWorkoutComplete: () => void;
  // Reminder actions
  toggleReminder: (id: string) => void;
  addReminder: (reminder: Omit<Reminder, 'id' | 'isCompleted'>) => void;
  deleteReminder: (id: string) => void;
  // Subject quick add
  addSubject: (subject: Omit<Subject, 'id'>) => void;
  // Sample data management
  clearSampleData: () => void;
  restoreSampleData: () => void;
  // Storage operations
  exportData: () => string;
  importData: (json: string) => boolean;
  // Profile & Settings
  updateProfile: (profile: UserProfile) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  // Syllabus Tracker actions
  addSyllabusSubject: (name: string, color?: string) => void;
  updateSyllabusSubject: (id: string, name: string, color?: string) => void;
  deleteSyllabusSubject: (id: string) => void;
  addChapter: (subjectId: string, name: string) => void;
  updateChapter: (subjectId: string, chapterId: string, name: string) => void;
  deleteChapter: (subjectId: string, chapterId: string) => void;
  addSubtopic: (subjectId: string, chapterId: string, subtopic: Omit<Subtopic, 'id' | 'revisionCount'>) => void;
  updateSubtopic: (subjectId: string, chapterId: string, subtopicId: string, updates: Partial<Subtopic>) => void;
  deleteSubtopic: (subjectId: string, chapterId: string, subtopicId: string) => void;
  setTopicStatus: (subjectId: string, chapterId: string, subtopicId: string, status: TopicStatus) => void;
  incrementRevision: (subjectId: string, chapterId: string, subtopicId: string) => void;
  // Timetable & Calendar actions
  addTimetableSlot: (slot: Omit<TimetableSlot, 'id'>, customSubjectName?: string) => void;
  updateTimetableSlot: (id: string, updates: Partial<TimetableSlot>) => void;
  deleteTimetableSlot: (id: string) => void;
  importTimetableClasses: (classes: TimetableImportClass[], replaceExisting?: boolean) => { importedCount: number; skippedCount: number };
  // Occurrence overrides (fix recurring rescheduling)
  rescheduleOccurrence: (slotId: string, originalDate: string, newDate: string, newStartTime?: string, newEndTime?: string, newRoom?: string, newNotes?: string) => void;
  cancelOccurrence: (slotId: string, originalDate: string) => void;
  restoreOccurrence: (slotId: string, originalDate: string) => void;
  // Extra classes
  addExtraClass: (extra: Omit<ExtraClass, 'id'>) => void;
  deleteExtraClass: (id: string) => void;
  // Syllabus import
  importSyllabus: (payload: SyllabusImportPayload, targetSubjectId?: string) => { chaptersAdded: number; topicsAdded: number; subjectName: string };
  // Shared attendance requirement helper
  getAttendanceReq: () => number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Import SyllabusChapter type for internal use
type SyllabusChapterType = SyllabusChapter;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppStateData>(() => storageService.loadData());

  // Automatically persist to storage layer whenever state changes
  useEffect(() => {
    storageService.saveData(state);
  }, [state]);

  /** Get the shared attendance requirement */
  const getAttendanceReq = (): number => {
    return getAttendanceRequirement(state.settings?.attendanceRequirement);
  };

  /**
   * Mark attendance for today's lecture slot.
   * Accurately updates both the attendanceLog and the linked subject's attended / totalConducted counts.
   */
  const markAttendance = (slotId: string, status: AttendanceMark, date?: string) => {
    setState((prev) => {
      const todayStr = date || new Date().toISOString().split('T')[0];
      const slot = prev.timetable.find((t) => t.id === slotId);
      if (!slot) return prev;

      // Check if an existing log for today & this slot exists
      const existingLogIdx = prev.attendanceLogs.findIndex(
        (log) => log.slotId === slotId && log.date === todayStr
      );

      const oldStatus = existingLogIdx >= 0 ? prev.attendanceLogs[existingLogIdx].status : null;
      if (oldStatus === status) return prev; // No change

      // Update subject counts
      const updatedSubjects = prev.subjects.map((sub) => {
        if (sub.id !== slot.subjectId) return sub;

        let attended = sub.attended;
        let totalConducted = sub.totalConducted;

        // Revert previous mark if there was one
        if (oldStatus === 'present') {
          attended = Math.max(0, attended - 1);
          totalConducted = Math.max(0, totalConducted - 1);
        } else if (oldStatus === 'absent') {
          totalConducted = Math.max(0, totalConducted - 1);
        }

        // Apply new mark
        if (status === 'present') {
          attended += 1;
          totalConducted += 1;
        } else if (status === 'absent') {
          totalConducted += 1;
        }
        // If cancelled, neither increments

        return {
          ...sub,
          attended,
          totalConducted,
          isSample: false, // User mutation turns record into real user record!
        };
      });

      // Update or create log
      let updatedLogs = [...prev.attendanceLogs];
      if (existingLogIdx >= 0) {
        updatedLogs[existingLogIdx] = {
          ...updatedLogs[existingLogIdx],
          status,
          timestamp: new Date().toISOString(),
          isSample: false,
        };
      } else {
        updatedLogs.push({
          id: `att-log-${Date.now()}`,
          date: todayStr,
          slotId,
          subjectId: slot.subjectId,
          status,
          timestamp: new Date().toISOString(),
          isSample: false,
        });
      }

      return {
        ...prev,
        subjects: updatedSubjects,
        attendanceLogs: updatedLogs,
      };
    });
  };

  /**
   * Mark attendance for a resolved calendar event (used by attendance calendar).
   * Supports recurring, rescheduled, and extra class events.
   */
  const markAttendanceForEvent = (
    _occurrenceKey: string,
    subjectId: string,
    date: string,
    status: AttendanceMark,
    slotId?: string,
    extraClassId?: string,
    overrideId?: string,
    isPlanned?: boolean,
  ) => {
    setState((prev) => {
      // Find existing log for this occurrence
      const existingLogIdx = prev.attendanceLogs.findIndex(
        (log) => {
          if (extraClassId) return log.extraClassId === extraClassId && log.date === date;
          if (slotId) return log.slotId === slotId && log.date === date;
          return false;
        }
      );

      const oldStatus = existingLogIdx >= 0 ? prev.attendanceLogs[existingLogIdx].status : null;
      const wasPlanned = existingLogIdx >= 0 ? prev.attendanceLogs[existingLogIdx].isPlanned : false;
      if (oldStatus === status && wasPlanned === (isPlanned || false)) return prev;

      // Update subject counts (only for non-planned marks)
      const updatedSubjects = prev.subjects.map((sub) => {
        if (sub.id !== subjectId) return sub;

        let attended = sub.attended;
        let totalConducted = sub.totalConducted;

        // Revert previous mark if it was NOT planned
        if (!wasPlanned) {
          if (oldStatus === 'present') {
            attended = Math.max(0, attended - 1);
            totalConducted = Math.max(0, totalConducted - 1);
          } else if (oldStatus === 'absent') {
            totalConducted = Math.max(0, totalConducted - 1);
          }
        }

        // Apply new mark only if not planned
        if (!isPlanned) {
          if (status === 'present') {
            attended += 1;
            totalConducted += 1;
          } else if (status === 'absent') {
            totalConducted += 1;
          }
        }

        return { ...sub, attended, totalConducted, isSample: false };
      });

      let updatedLogs = [...prev.attendanceLogs];
      if (existingLogIdx >= 0) {
        updatedLogs[existingLogIdx] = {
          ...updatedLogs[existingLogIdx],
          status,
          timestamp: new Date().toISOString(),
          isSample: false,
          isPlanned: isPlanned || false,
        };
      } else {
        updatedLogs.push({
          id: `att-log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          date,
          slotId: slotId || '',
          subjectId,
          status,
          timestamp: new Date().toISOString(),
          isSample: false,
          overrideId,
          extraClassId,
          isPlanned: isPlanned || false,
        });
      }

      return { ...prev, subjects: updatedSubjects, attendanceLogs: updatedLogs };
    });
  };

  /**
   * Log a completed study or focus session.
   */
  const logStudySession = (durationMinutes: number, subjectId?: string, notes?: string) => {
    if (durationMinutes <= 0) return;
    setState((prev) => {
      const subject = prev.subjects.find((s) => s.id === subjectId);
      const newSession: StudySession = {
        id: `study-${Date.now()}`,
        subjectId,
        subjectName: subject ? `${subject.code} — ${subject.name}` : undefined,
        durationMinutes,
        timestamp: new Date().toISOString(),
        notes,
        isSample: false,
      };

      return {
        ...prev,
        studySessions: [newSession, ...prev.studySessions],
      };
    });
  };

  /**
   * Toggle a gym exercise set for today's workout.
   */
  const toggleGymSet = (exerciseIndex: number, setIndex: number) => {
    setState((prev) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const workoutIdx = prev.gymWorkouts.findIndex((w) => w.date === todayStr);

      if (workoutIdx < 0) return prev;

      const currentWorkout = prev.gymWorkouts[workoutIdx];
      const updatedExercises = currentWorkout.exercises.map((ex, exIdx) => {
        if (exIdx !== exerciseIndex) return ex;
        const updatedSets = ex.sets.map((set, sIdx) => {
          if (sIdx !== setIndex) return set;
          return { ...set, completed: !set.completed };
        });
        return { ...ex, sets: updatedSets };
      });

      // Check if all sets in all exercises are completed
      const allSetsDone = updatedExercises.every((ex) =>
        ex.sets.every((s) => s.completed)
      );

      const updatedWorkout = {
        ...currentWorkout,
        exercises: updatedExercises,
        completed: allSetsDone,
        isSample: false,
      };

      const newWorkouts = [...prev.gymWorkouts];
      newWorkouts[workoutIdx] = updatedWorkout;

      return {
        ...prev,
        gymWorkouts: newWorkouts,
      };
    });
  };

  /**
   * Mark the whole workout for today as completed or uncompleted.
   */
  const toggleGymWorkoutComplete = () => {
    setState((prev) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const workoutIdx = prev.gymWorkouts.findIndex((w) => w.date === todayStr);
      if (workoutIdx < 0) return prev;

      const current = prev.gymWorkouts[workoutIdx];
      const nextCompleted = !current.completed;
      const updatedExercises = current.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => ({ ...s, completed: nextCompleted })),
      }));

      const newWorkouts = [...prev.gymWorkouts];
      newWorkouts[workoutIdx] = {
        ...current,
        completed: nextCompleted,
        exercises: updatedExercises,
        isSample: false,
      };

      return {
        ...prev,
        gymWorkouts: newWorkouts,
      };
    });
  };

  /**
   * Toggle completion of a reminder task.
   */
  const toggleReminder = (id: string) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) =>
        r.id === id ? { ...r, isCompleted: !r.isCompleted, isSample: false } : r
      ),
    }));
  };

  /**
   * Add a new reminder task.
   */
  const addReminder = (item: Omit<Reminder, 'id' | 'isCompleted'>) => {
    setState((prev) => {
      const newReminder: Reminder = {
        ...item,
        id: `rem-${Date.now()}`,
        isCompleted: false,
        isSample: false,
      };
      return {
        ...prev,
        reminders: [newReminder, ...prev.reminders],
      };
    });
  };

  /**
   * Delete a reminder task.
   */
  const deleteReminder = (id: string) => {
    setState((prev) => ({
      ...prev,
      reminders: prev.reminders.filter((r) => r.id !== id),
    }));
  };

  /**
   * Quick add a subject.
   */
  const addSubject = (subject: Omit<Subject, 'id'>) => {
    setState((prev) => {
      const newSub: Subject = {
        ...subject,
        id: `sub-${Date.now()}`,
        isSample: false,
      };
      return {
        ...prev,
        subjects: [...prev.subjects, newSub],
      };
    });
  };

  /**
   * Cleanly purge all sample demonstration data while leaving real user data intact.
   */
  const clearSampleData = () => {
    setState((prev) => storageService.clearSampleData(prev));
  };

  /**
   * Populate realistic editorial sample data.
   */
  const restoreSampleData = () => {
    const loaded = storageService.populateSampleData();
    setState(loaded);
  };

  // Export current state for backup
  const exportData = () => {
    return storageService.exportBackup(state);
  };

  // Import backup JSON and replace state
  const importData = (json: string): boolean => {
    try {
      const imported = storageService.importBackup(json);
      setState(imported);
      return true;
    } catch {
      return false;
    }
  };

  // Update user profile (replace entire profile object)
  const updateProfile = (profile: UserProfile) => {
    setState((prev) => ({
      ...prev,
      profile,
    }));
  };

  // Update settings partially (merge with existing settings)
  const updateSettings = (settings: Partial<AppSettings>) => {
    setState((prev) => {
      const existing: AppSettings = prev.settings ?? {
        themeMode: 'system',
        accentColor: 'terracotta',
        backgroundStyle: 'minimal',
        studyDayRolloverHour: 0,
        showExamCountdown: true,
        showFocusRadio: false,
      };
      return {
        ...prev,
        settings: { ...existing, ...settings } as AppSettings,
      };
    });
  };

  // ── Syllabus Tracker Actions ──
  const addSyllabusSubject = (name: string, color?: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? DEFAULT_SYLLABUS_SUBJECTS;
      const newSubject: SyllabusSubject = {
        id: 'syl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        name: name.trim(),
        color: color || '#C45532',
        chapters: [],
      };
      return {
        ...prev,
        syllabusSubjects: [...currentList, newSubject],
      };
    });
  };

  const updateSyllabusSubject = (id: string, name: string, color?: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? DEFAULT_SYLLABUS_SUBJECTS;
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) =>
          s.id === id ? { ...s, name: name.trim(), color: color || s.color } : s
        ),
      };
    });
  };

  const deleteSyllabusSubject = (id: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? DEFAULT_SYLLABUS_SUBJECTS;
      return {
        ...prev,
        syllabusSubjects: currentList.filter((s) => s.id !== id),
      };
    });
  };

  const addChapter = (subjectId: string, name: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? DEFAULT_SYLLABUS_SUBJECTS;
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) => {
          if (s.id !== subjectId) return s;
          const newChapter: SyllabusChapterType = {
            id: 'chap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
            name: name.trim(),
            subtopics: [],
          };
          return {
            ...s,
            chapters: [...s.chapters, newChapter],
          };
        }),
      };
    });
  };

  const updateChapter = (subjectId: string, chapterId: string, name: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? DEFAULT_SYLLABUS_SUBJECTS;
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            chapters: s.chapters.map((c) =>
              c.id === chapterId ? { ...c, name: name.trim() } : c
            ),
          };
        }),
      };
    });
  };

  const deleteChapter = (subjectId: string, chapterId: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? DEFAULT_SYLLABUS_SUBJECTS;
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            chapters: s.chapters.filter((c) => c.id !== chapterId),
          };
        }),
      };
    });
  };

  const addSubtopic = (
    subjectId: string,
    chapterId: string,
    subtopic: Omit<Subtopic, 'id' | 'revisionCount'>
  ) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? DEFAULT_SYLLABUS_SUBJECTS;
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            chapters: s.chapters.map((c) => {
              if (c.id !== chapterId) return c;
              const newSubtopic: Subtopic = {
                ...subtopic,
                id: 'top-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
                revisionCount: 0,
              };
              return {
                ...c,
                subtopics: [...c.subtopics, newSubtopic],
              };
            }),
          };
        }),
      };
    });
  };

  const updateSubtopic = (
    subjectId: string,
    chapterId: string,
    subtopicId: string,
    updates: Partial<Subtopic>
  ) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? DEFAULT_SYLLABUS_SUBJECTS;
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            chapters: s.chapters.map((c) => {
              if (c.id !== chapterId) return c;
              return {
                ...c,
                subtopics: c.subtopics.map((t) =>
                  t.id === subtopicId ? { ...t, ...updates } : t
                ),
              };
            }),
          };
        }),
      };
    });
  };

  const deleteSubtopic = (subjectId: string, chapterId: string, subtopicId: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? DEFAULT_SYLLABUS_SUBJECTS;
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            chapters: s.chapters.map((c) => {
              if (c.id !== chapterId) return c;
              return {
                ...c,
                subtopics: c.subtopics.filter((t) => t.id !== subtopicId),
              };
            }),
          };
        }),
      };
    });
  };

  const setTopicStatus = (
    subjectId: string,
    chapterId: string,
    subtopicId: string,
    status: TopicStatus
  ) => {
    updateSubtopic(subjectId, chapterId, subtopicId, { status });
  };

  const incrementRevision = (subjectId: string, chapterId: string, subtopicId: string) => {
    setState((prev) => {
      const currentList = prev.syllabusSubjects ?? DEFAULT_SYLLABUS_SUBJECTS;
      const todayStr = new Date().toISOString().split('T')[0];
      return {
        ...prev,
        syllabusSubjects: currentList.map((s) => {
          if (s.id !== subjectId) return s;
          return {
            ...s,
            chapters: s.chapters.map((c) => {
              if (c.id !== chapterId) return c;
              return {
                ...c,
                subtopics: c.subtopics.map((t) =>
                  t.id === subtopicId
                    ? {
                        ...t,
                        revisionCount: (t.revisionCount || 0) + 1,
                        lastRevised: todayStr,
                        status: t.status === 'revision_needed' ? 'done' : t.status,
                      }
                    : t
                ),
              };
            }),
          };
        }),
      };
    });
  };

  // ── Timetable & Calendar Actions ──
  const addTimetableSlot = (slot: Omit<TimetableSlot, 'id'>, customSubjectName?: string) => {
    setState((prev) => {
      let subjectId = slot.subjectId;
      let updatedSubjects = [...prev.subjects];

      // If customSubjectName is provided and subjectId is empty or 'new'
      if (customSubjectName && (!subjectId || subjectId === 'new')) {
        const existing = updatedSubjects.find(
          (s) => s.name.toLowerCase() === customSubjectName.toLowerCase()
        );
        if (existing) {
          subjectId = existing.id;
        } else {
          const req = getAttendanceReq();
          const newSub: Subject = {
            id: 'sub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
            code: customSubjectName.slice(0, 5).toUpperCase(),
            name: customSubjectName.trim(),
            attended: 0,
            totalConducted: 0,
            targetPct: req,
            color: '#3D6A8A',
          };
          updatedSubjects.push(newSub);
          subjectId = newSub.id;
        }
      }

      const newSlot: TimetableSlot = {
        ...slot,
        id: 'tt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        subjectId,
      };

      return {
        ...prev,
        subjects: updatedSubjects,
        timetable: [...prev.timetable, newSlot],
      };
    });
  };

  const updateTimetableSlot = (id: string, updates: Partial<TimetableSlot>) => {
    setState((prev) => ({
      ...prev,
      timetable: prev.timetable.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }));
  };

  const deleteTimetableSlot = (id: string) => {
    setState((prev) => ({
      ...prev,
      timetable: prev.timetable.filter((s) => s.id !== id),
      // Also clean up related overrides
      occurrenceOverrides: (prev.occurrenceOverrides || []).filter((o) => o.slotId !== id),
    }));
  };

  const importTimetableClasses = (
    classes: TimetableImportClass[],
    replaceExisting = false
  ): { importedCount: number; skippedCount: number } => {
    const dayMap: Record<string, DayOfWeek> = {
      monday: 1, mon: 1, '1': 1,
      tuesday: 2, tue: 2, '2': 2,
      wednesday: 3, wed: 3, '3': 3,
      thursday: 4, thu: 4, '4': 4,
      friday: 5, fri: 5, '5': 5,
      saturday: 6, sat: 6, '6': 6,
      sunday: 7, sun: 7, '7': 7,
    };

    let importedCount = 0;
    let skippedCount = 0;

    setState((prev) => {
      const baseTimetable = replaceExisting ? [] : [...prev.timetable];
      const updatedSubjects = [...prev.subjects];
      const req = getAttendanceReq();

      classes.forEach((item) => {
        const normalizedDay = dayMap[item.day.toLowerCase().trim()];
        if (!normalizedDay) {
          skippedCount++;
          return;
        }

        // Match or create subject
        const subName = item.subject.trim();
        let subject = updatedSubjects.find(
          (s) =>
            s.name.toLowerCase() === subName.toLowerCase() ||
            s.code.toLowerCase() === subName.toLowerCase()
        );

        if (!subject) {
          subject = {
            id: 'sub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            code: subName.length <= 6 ? subName.toUpperCase() : subName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 5),
            name: subName,
            attended: 0,
            totalConducted: 0,
            targetPct: req,
            color: '#B8732E',
          };
          updatedSubjects.push(subject);
        }

        // Check for duplicate in baseTimetable
        const isDuplicate = baseTimetable.some(
          (slot) =>
            slot.dayOfWeek === normalizedDay &&
            slot.startTime === item.startTime &&
            slot.subjectId === subject!.id
        );

        if (isDuplicate) {
          skippedCount++;
          return;
        }

        const newSlot: TimetableSlot = {
          id: 'tt-imp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
          dayOfWeek: normalizedDay,
          startTime: item.startTime,
          endTime: item.endTime,
          subjectId: subject.id,
          room: item.room || item.location || undefined,
          instructor: item.instructor || undefined,
          notes: item.notes || undefined,
        };

        baseTimetable.push(newSlot);
        importedCount++;
      });

      return {
        ...prev,
        subjects: updatedSubjects,
        timetable: baseTimetable,
      };
    });

    return { importedCount, skippedCount };
  };

  // ── Occurrence Override Actions (Fix Recurring Rescheduling Bug) ──
  const rescheduleOccurrence = (
    slotId: string,
    originalDate: string,
    newDate: string,
    newStartTime?: string,
    newEndTime?: string,
    newRoom?: string,
    newNotes?: string,
  ) => {
    setState((prev) => {
      const existing = (prev.occurrenceOverrides || []);
      // Remove any existing override for this slot+date
      const filtered = existing.filter(
        (o) => !(o.slotId === slotId && o.originalDate === originalDate)
      );
      const newOverride: OccurrenceOverride = {
        id: 'ovr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        slotId,
        originalDate,
        type: 'reschedule',
        newDate,
        newStartTime,
        newEndTime,
        newRoom,
        newNotes,
      };
      return {
        ...prev,
        occurrenceOverrides: [...filtered, newOverride],
      };
    });
  };

  const cancelOccurrence = (slotId: string, originalDate: string) => {
    setState((prev) => {
      const existing = (prev.occurrenceOverrides || []);
      const filtered = existing.filter(
        (o) => !(o.slotId === slotId && o.originalDate === originalDate)
      );
      const newOverride: OccurrenceOverride = {
        id: 'ovr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        slotId,
        originalDate,
        type: 'cancel',
      };
      return {
        ...prev,
        occurrenceOverrides: [...filtered, newOverride],
      };
    });
  };

  const restoreOccurrence = (slotId: string, originalDate: string) => {
    setState((prev) => ({
      ...prev,
      occurrenceOverrides: (prev.occurrenceOverrides || []).filter(
        (o) => !(o.slotId === slotId && o.originalDate === originalDate)
      ),
    }));
  };

  // ── Extra Class Actions ──
  const addExtraClass = (extra: Omit<ExtraClass, 'id'>) => {
    setState((prev) => {
      const newExtra: ExtraClass = {
        ...extra,
        id: 'extra-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      };
      return {
        ...prev,
        extraClasses: [...(prev.extraClasses || []), newExtra],
      };
    });
  };

  const deleteExtraClass = (id: string) => {
    setState((prev) => ({
      ...prev,
      extraClasses: (prev.extraClasses || []).filter((e) => e.id !== id),
    }));
  };

  // ── Syllabus Import ──
  const importSyllabus = (
    payload: SyllabusImportPayload,
    targetSubjectId?: string,
  ): { chaptersAdded: number; topicsAdded: number; subjectName: string } => {
    let chaptersAdded = 0;
    let topicsAdded = 0;
    const subjectName = payload.subject.name;

    setState((prev) => {
      const currentList = [...(prev.syllabusSubjects ?? DEFAULT_SYLLABUS_SUBJECTS)];
      const now = Date.now();

      // Find or create target subject
      let targetIdx = targetSubjectId
        ? currentList.findIndex((s) => s.id === targetSubjectId)
        : currentList.findIndex((s) => s.name.toLowerCase() === subjectName.toLowerCase());

      if (targetIdx < 0) {
        // Create new subject
        const newSubject: SyllabusSubject = {
          id: 'syl-' + now + '-' + Math.random().toString(36).slice(2, 5),
          name: subjectName.trim(),
          color: '#3D6A8A',
          chapters: [],
        };
        currentList.push(newSubject);
        targetIdx = currentList.length - 1;
      }

      const target = { ...currentList[targetIdx], chapters: [...currentList[targetIdx].chapters] };

      // Import chapters
      for (const importChapter of payload.subject.chapters) {
        // Check for existing chapter with same name
        const existingChapIdx = target.chapters.findIndex(
          (c) => c.name.toLowerCase() === importChapter.name.toLowerCase()
        );

        if (existingChapIdx >= 0) {
          // Merge: add new topics that don't already exist
          const existingChap = { ...target.chapters[existingChapIdx], subtopics: [...target.chapters[existingChapIdx].subtopics] };
          for (const importTopic of importChapter.topics) {
            const topicExists = existingChap.subtopics.some(
              (t) => t.name.toLowerCase() === importTopic.name.toLowerCase()
            );
            if (!topicExists) {
              existingChap.subtopics.push({
                id: 'top-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
                name: importTopic.name,
                status: 'not_started',
                revisionCount: 0,
                estimatedLectures: importTopic.estimatedLectures,
                importance: importTopic.importance,
                notes: importTopic.subtopics?.length ? `Subtopics: ${importTopic.subtopics.join(', ')}` : undefined,
              });
              topicsAdded++;
            }
          }
          // Update chapter metadata
          existingChap.estimatedLectures = importChapter.estimatedLectures ?? existingChap.estimatedLectures;
          existingChap.importance = importChapter.importance ?? existingChap.importance;
          target.chapters[existingChapIdx] = existingChap;
        } else {
          // Create new chapter
          const newChapter: SyllabusChapterType = {
            id: 'chap-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
            name: importChapter.name,
            estimatedLectures: importChapter.estimatedLectures,
            importance: importChapter.importance,
            subtopics: importChapter.topics.map((t) => ({
              id: 'top-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
              name: t.name,
              status: 'not_started' as const,
              revisionCount: 0,
              estimatedLectures: t.estimatedLectures,
              importance: t.importance,
              notes: t.subtopics?.length ? `Subtopics: ${t.subtopics.join(', ')}` : undefined,
            })),
          };
          target.chapters.push(newChapter);
          chaptersAdded++;
          topicsAdded += importChapter.topics.length;
        }
      }

      currentList[targetIdx] = target;
      return { ...prev, syllabusSubjects: currentList };
    });

    return { chaptersAdded, topicsAdded, subjectName };
  };

  return (
    <AppContext.Provider
      value={{
        state,
        markAttendance,
        markAttendanceForEvent,
        logStudySession,
        toggleGymSet,
        toggleGymWorkoutComplete,
        toggleReminder,
        addReminder,
        deleteReminder,
        addSubject,
        clearSampleData,
        restoreSampleData,
        exportData,
        importData,
        updateProfile,
        updateSettings,
        // Syllabus actions
        addSyllabusSubject,
        updateSyllabusSubject,
        deleteSyllabusSubject,
        addChapter,
        updateChapter,
        deleteChapter,
        addSubtopic,
        updateSubtopic,
        deleteSubtopic,
        setTopicStatus,
        incrementRevision,
        // Timetable & Calendar actions
        addTimetableSlot,
        updateTimetableSlot,
        deleteTimetableSlot,
        importTimetableClasses,
        // Occurrence overrides
        rescheduleOccurrence,
        cancelOccurrence,
        restoreOccurrence,
        // Extra classes
        addExtraClass,
        deleteExtraClass,
        // Syllabus import
        importSyllabus,
        // Attendance requirement
        getAttendanceReq,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
