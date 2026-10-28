import React, { useState, useEffect, useMemo } from 'react';
import { EduHubCourse, EduHubLecture } from '../../types/eduhub';
import {
  loadEduHubCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  addLectureToCourse,
  removeLectureFromCourse,
  reorderLectures,
  updateLectureProgress,
  toggleLectureCompleted,
  calculateCourseStats,
} from '../../services/eduhubStorage';
import { EduHubPlayer } from './EduHubPlayer';
import { LectureList } from './LectureList';
import { AddLectureModal } from './AddLectureModal';
import { CreateCourseModal } from './CreateCourseModal';
import { LectureNotesModal } from './LectureNotesModal';
import { ImportPlaylistModal } from './ImportPlaylistModal';
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Sparkles,
  CheckCircle2,
  Tv,
  Video,
  RefreshCw,
} from 'lucide-react';
import { TiltCard } from '../common/TiltCard';

export const EduHubView: React.FC = () => {
  const [courses, setCourses] = useState<EduHubCourse[]>(() => loadEduHubCourses());
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    const list = loadEduHubCourses();
    return list[0]?.id || '';
  });
  const [selectedLectureId, setSelectedLectureId] = useState<string | null>(null);

  // Modals state
  const [isCreateCourseOpen, setIsCreateCourseOpen] = useState(false);
  const [isImportPlaylistOpen, setIsImportPlaylistOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<EduHubCourse | null>(null);
  const [isAddLectureOpen, setIsAddLectureOpen] = useState(false);
  const [notesLecture, setNotesLecture] = useState<EduHubLecture | null>(null);

  // Synchronize courses
  const currentCourse = useMemo(() => {
    return courses.find((c) => c.id === selectedCourseId) || courses[0] || null;
  }, [courses, selectedCourseId]);

  // Default lecture selection
  useEffect(() => {
    if (currentCourse && currentCourse.lectures.length > 0) {
      if (!selectedLectureId || !currentCourse.lectures.some((l) => l.id === selectedLectureId)) {
        // Select first uncompleted lecture, or first lecture
        const uncompleted = currentCourse.lectures.find((l) => !l.completed);
        setSelectedLectureId(uncompleted ? uncompleted.id : currentCourse.lectures[0].id);
      }
    } else {
      setSelectedLectureId(null);
    }
  }, [currentCourse?.id]);

  const selectedLecture = useMemo(() => {
    if (!currentCourse) return null;
    return currentCourse.lectures.find((l) => l.id === selectedLectureId) || null;
  }, [currentCourse, selectedLectureId]);

  // Compute stats
  const stats = useMemo(() => {
    if (!currentCourse) {
      return {
        totalLectures: 0,
        completedLectures: 0,
        remainingLectures: 0,
        completionPercentage: 0,
        formattedRemainingWorkload: '0s',
        formattedTotalDuration: '00:00',
      };
    }
    return calculateCourseStats(currentCourse);
  }, [currentCourse]);

  // Handlers
  const handleSaveCourse = (title: string, description?: string, color?: string) => {
    if (editingCourse) {
      const updated = updateCourse(editingCourse.id, { title, description, color });
      setCourses(updated);
      setEditingCourse(null);
    } else {
      const newCourse = createCourse(title, description, color);
      const updated = loadEduHubCourses();
      setCourses(updated);
      setSelectedCourseId(newCourse.id);
    }
  };

  const handleDeleteCourse = (courseId: string) => {
    if (window.confirm('Are you sure you want to delete this course and its lecture playlist?')) {
      const updated = deleteCourse(courseId);
      setCourses(updated);
      if (selectedCourseId === courseId) {
        setSelectedCourseId(updated[0]?.id || '');
      }
    }
  };

  const handleAddLecture = (urlOrId: string, title?: string, durationSeconds?: number) => {
    if (!currentCourse) return;
    try {
      const updated = addLectureToCourse(currentCourse.id, urlOrId, title, durationSeconds);
      setCourses(updated);
      // If no lecture was selected, select the newly added one
      const refreshedCourse = updated.find((c) => c.id === currentCourse.id);
      if (refreshedCourse && refreshedCourse.lectures.length > 0) {
        setSelectedLectureId(refreshedCourse.lectures[refreshedCourse.lectures.length - 1].id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add lecture');
    }
  };

  const handleRemoveLecture = (lectureId: string) => {
    if (!currentCourse) return;
    if (window.confirm('Remove this lecture from the playlist?')) {
      const updated = removeLectureFromCourse(currentCourse.id, lectureId);
      setCourses(updated);
      if (selectedLectureId === lectureId) {
        const refreshedCourse = updated.find((c) => c.id === currentCourse.id);
        setSelectedLectureId(refreshedCourse?.lectures[0]?.id || null);
      }
    }
  };

  const handleReorderLectures = (fromIndex: number, toIndex: number) => {
    if (!currentCourse) return;
    const updated = reorderLectures(currentCourse.id, fromIndex, toIndex);
    setCourses(updated);
  };

  const handleUpdateProgress = (positionSeconds: number, durationSeconds?: number) => {
    if (!currentCourse || !selectedLectureId) return;
    const updated = updateLectureProgress(currentCourse.id, selectedLectureId, positionSeconds, durationSeconds);
    setCourses(updated);
  };

  const handleToggleComplete = (lectureId: string) => {
    if (!currentCourse) return;
    const updated = toggleLectureCompleted(currentCourse.id, lectureId);
    setCourses(updated);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* ── 1. HEADER & COURSE SELECTOR ───────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ivory-300 dark:border-espresso-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
              Academic Lecture Hub
            </span>
            {currentCourse?.isSample && (
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-ochre-100 dark:bg-ochre-900/40 text-ochre-700 dark:text-ochre-300 border border-ochre-200 dark:border-ochre-800">
                Sample Course
              </span>
            )}
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight mt-1">
            EduHub Courses &amp; Lectures
          </h1>
          <p className="text-sm font-serif italic text-espresso-500 dark:text-espresso-400 mt-0.5">
            Organize YouTube lecture playlists, monitor study completion, and synthesize PDF notes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsImportPlaylistOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 shadow-xs flex items-center gap-2 transition cursor-pointer"
          >
            <Video className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span>Import Playlist</span>
          </button>

          <button
            onClick={() => {
              setEditingCourse(null);
              setIsCreateCourseOpen(true);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-500 text-white shadow-subtle flex items-center gap-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Course</span>
          </button>
        </div>
      </div>

      {/* ── 2. COURSE SWITCHER TABS ─────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {courses.map((course) => {
          const isSelected = course.id === selectedCourseId;
          const courseStats = calculateCourseStats(course);

          return (
            <button
              key={course.id}
              onClick={() => setSelectedCourseId(course.id)}
              className={`px-4 py-2.5 rounded-2xl border text-xs font-semibold flex items-center gap-2.5 shrink-0 transition-all cursor-pointer ${
                isSelected
                  ? 'border-terracotta-500 bg-white dark:bg-espresso-850 text-terracotta-600 dark:text-terracotta-400 shadow-sm ring-1 ring-terracotta-400/30'
                  : 'border-ivory-200 dark:border-espresso-750 bg-ivory-50/70 dark:bg-espresso-900/40 text-espresso-600 dark:text-espresso-300 hover:bg-white dark:hover:bg-espresso-850'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>{course.title}</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-ivory-200 dark:bg-espresso-800 text-espresso-600 dark:text-ivory-200">
                {courseStats.completionPercentage}%
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 3. WORKLOAD & PROGRESS KPI STRIP ────────────────────────── */}
      {currentCourse && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
          {/* Stat 1: Total Lectures */}
          <TiltCard maxTilt={6} scale={1.02}>
            <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle h-full flex flex-col justify-between">
              <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Lectures</span>
                <div className="p-1.5 rounded-lg bg-ivory-100 dark:bg-espresso-800">
                  <Tv className="w-3.5 h-3.5 text-terracotta-600" />
                </div>
              </div>
              <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
                {stats.completedLectures} <span className="text-sm font-normal text-espresso-400">/ {stats.totalLectures}</span>
              </p>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
                {stats.remainingLectures} remaining
              </p>
            </div>
          </TiltCard>

          {/* Stat 2: Completion Percentage */}
          <TiltCard maxTilt={6} scale={1.02}>
            <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle h-full flex flex-col justify-between">
              <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Progress</span>
                <div className="p-1.5 rounded-lg bg-sage-50 dark:bg-sage-900/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-sage-600" />
                </div>
              </div>
              <p className="font-serif tabular-nums text-2xl sm:text-3xl font-bold text-espresso-950 dark:text-ivory-50">
                {stats.completionPercentage}%
              </p>
              <div className="w-full h-1.5 rounded-full bg-ivory-200 dark:bg-espresso-800 overflow-hidden mt-1.5">
                <div
                  className="h-full bg-sage-500 transition-all duration-300"
                  style={{ width: `${stats.completionPercentage}%` }}
                />
              </div>
            </div>
          </TiltCard>

          {/* Stat 3: Remaining Study Workload */}
          <TiltCard maxTilt={6} scale={1.02}>
            <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle h-full flex flex-col justify-between">
              <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Remaining Time</span>
                <div className="p-1.5 rounded-lg bg-ochre-50 dark:bg-ochre-900/30">
                  <Clock className="w-3.5 h-3.5 text-ochre-600" />
                </div>
              </div>
              <p className="font-serif tabular-nums text-xl sm:text-2xl font-bold text-espresso-950 dark:text-ivory-50">
                {stats.formattedRemainingWorkload}
              </p>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
                Calculated from unfinished lectures
              </p>
            </div>
          </TiltCard>

          {/* Stat 4: Total Course Content */}
          <TiltCard maxTilt={6} scale={1.02}>
            <div className="p-4 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle h-full flex flex-col justify-between">
              <div className="flex items-center justify-between text-espresso-500 dark:text-espresso-400 mb-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">Course Duration</span>
                <div className="p-1.5 rounded-lg bg-ivory-100 dark:bg-espresso-800">
                  <GraduationCap className="w-3.5 h-3.5 text-terracotta-600" />
                </div>
              </div>
              <p className="font-serif tabular-nums text-xl sm:text-2xl font-bold text-espresso-950 dark:text-ivory-50">
                {stats.formattedTotalDuration}
              </p>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
                Total playlist duration
              </p>
            </div>
          </TiltCard>
        </section>
      )}

      {/* ── 4. MAIN LECTURE THEATRE & PLAYLIST SPLIT ───────────────── */}
      {currentCourse ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Player & Active Lecture Actions (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4">
              <EduHubPlayer
                lecture={selectedLecture}
                onUpdateProgress={handleUpdateProgress}
                onMarkComplete={() => {
                  if (selectedLectureId) handleToggleComplete(selectedLectureId);
                }}
              />

              {/* Lecture Title & Controls */}
              {selectedLecture && (
                <div className="pt-2 border-t border-ivory-200 dark:border-espresso-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                      {selectedLecture.title}
                    </h2>
                    <p className="text-xs text-espresso-500 dark:text-espresso-400 font-mono mt-0.5">
                      Course: {currentCourse.title}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleComplete(selectedLecture.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                        selectedLecture.completed
                          ? 'bg-sage-100 dark:bg-sage-900/40 text-sage-800 dark:text-sage-200 border border-sage-200 dark:border-sage-800'
                          : 'border border-ivory-300 dark:border-espresso-700 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-700 dark:text-ivory-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-sage-600" />
                      <span>{selectedLecture.completed ? 'Completed' : 'Mark Complete'}</span>
                    </button>

                    <button
                      onClick={() => setNotesLecture(selectedLecture)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-500 text-white flex items-center gap-1.5 transition shadow-subtle cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Notes &amp; PDF</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Course Description Card with Edit / Delete */}
            <div className="p-4 rounded-2xl border border-ivory-200 dark:border-espresso-800 bg-ivory-50/60 dark:bg-espresso-900/40 flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-espresso-700 dark:text-ivory-200">
                    About {currentCourse.title}
                  </h4>
                  {currentCourse.playlistId && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/40 text-[10px] font-mono text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                      <Video className="w-3 h-3 text-red-600 shrink-0" />
                      <span>YouTube Playlist</span>
                    </span>
                  )}
                  {currentCourse.lastSyncedAt && (
                    <span className="text-[10px] font-mono text-espresso-400 dark:text-espresso-500">
                      Synced {new Date(currentCourse.lastSyncedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-xs text-espresso-600 dark:text-espresso-300 leading-relaxed">
                  {currentCourse.description || 'No description provided. Click edit to add notes or syllabus links.'}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {currentCourse.playlistId && (
                  <button
                    onClick={() => setIsImportPlaylistOpen(true)}
                    className="p-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 text-espresso-600 dark:text-ivory-300 transition cursor-pointer"
                    title="Sync course with YouTube playlist"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingCourse(currentCourse);
                    setIsCreateCourseOpen(true);
                  }}
                  className="p-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-600 dark:text-ivory-300 transition cursor-pointer"
                  title="Edit course details"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteCourse(currentCourse.id)}
                  className="p-1.5 rounded-lg border border-ivory-300 dark:border-espresso-700 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 text-espresso-600 dark:text-ivory-300 transition cursor-pointer"
                  title="Delete course"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Lecture Playlist (5 cols) */}
          <div className="lg:col-span-5">
            <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle min-h-[500px]">
              <LectureList
                lectures={currentCourse.lectures || []}
                selectedLectureId={selectedLectureId}
                onSelectLecture={(lecture) => setSelectedLectureId(lecture.id)}
                onToggleComplete={handleToggleComplete}
                onRemoveLecture={handleRemoveLecture}
                onReorder={handleReorderLectures}
                onOpenNotes={(lecture) => setNotesLecture(lecture)}
                onOpenAddLecture={() => setIsAddLectureOpen(true)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl border border-dashed border-ivory-300 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-850/50 space-y-3">
          <GraduationCap className="w-12 h-12 mx-auto text-terracotta-500 opacity-60" />
          <h3 className="font-serif text-xl font-bold">No Courses Available</h3>
          <p className="text-xs text-espresso-400 max-w-sm mx-auto">
            Create your first EduHub course to organize YouTube lectures and calculate your study workload.
          </p>
          <button
            onClick={() => setIsCreateCourseOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-terracotta-600 text-white shadow-subtle hover:bg-terracotta-500 transition cursor-pointer"
          >
            Create First Course
          </button>
        </div>
      )}

      {/* ── MODALS ─────────────────────────────────────────────────── */}
      <CreateCourseModal
        isOpen={isCreateCourseOpen}
        onClose={() => {
          setIsCreateCourseOpen(false);
          setEditingCourse(null);
        }}
        onSubmit={handleSaveCourse}
        editingCourse={editingCourse}
      />

      <AddLectureModal
        isOpen={isAddLectureOpen}
        onClose={() => setIsAddLectureOpen(false)}
        onAddLecture={handleAddLecture}
      />

      <LectureNotesModal
        isOpen={Boolean(notesLecture)}
        onClose={() => setNotesLecture(null)}
        lecture={notesLecture}
        courseTitle={currentCourse?.title || 'EduHub Course'}
      />

      <ImportPlaylistModal
        isOpen={isImportPlaylistOpen}
        onClose={() => setIsImportPlaylistOpen(false)}
        onCourseImported={(importedCourse) => {
          const freshCourses = loadEduHubCourses();
          setCourses(freshCourses);
          setSelectedCourseId(importedCourse.id);
          if (importedCourse.lectures.length > 0) {
            setSelectedLectureId(importedCourse.lectures[0].id);
          }
        }}
      />
    </div>
  );
};
