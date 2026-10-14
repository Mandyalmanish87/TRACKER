import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  Circle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit2,
  Calendar,
  X,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SyllabusSubject, TopicStatus, Subtopic } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { GptSyllabusImportModal } from '../syllabus/GptSyllabusImportModal';

const STATUS_CONFIG: Record<
  TopicStatus,
  { label: string; icon: React.ReactNode; badgeClass: string; colorClass: string }
> = {
  not_started: {
    label: 'Not Started',
    icon: <Circle className="w-3.5 h-3.5 text-espresso-400 dark:text-espresso-500" />,
    badgeClass: 'bg-ivory-200 dark:bg-espresso-800 text-espresso-600 dark:text-espresso-300',
    colorClass: 'text-espresso-400 dark:text-espresso-500',
  },
  in_progress: {
    label: 'In Progress',
    icon: <Clock className="w-3.5 h-3.5 text-ochre-600 dark:text-ochre-400" />,
    badgeClass: 'bg-ochre-50 dark:bg-ochre-900/30 text-ochre-700 dark:text-ochre-300 border border-ochre-200 dark:border-ochre-800/40',
    colorClass: 'text-ochre-600 dark:text-ochre-400',
  },
  done: {
    label: 'Completed',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-sage-600 dark:text-sage-400" />,
    badgeClass: 'bg-sage-50 dark:bg-sage-900/30 text-sage-700 dark:text-sage-300 border border-sage-200 dark:border-sage-800/40',
    colorClass: 'text-sage-600 dark:text-sage-400',
  },
  revision_needed: {
    label: 'Needs Revision',
    icon: <RotateCcw className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
    badgeClass: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40',
    colorClass: 'text-rose-600 dark:text-rose-400',
  },
};

const NEXT_STATUS: Record<TopicStatus, TopicStatus> = {
  not_started: 'in_progress',
  in_progress: 'done',
  done: 'revision_needed',
  revision_needed: 'done',
};

const SUBJECT_COLORS = [
  '#C45532', // Terracotta
  '#B8732E', // Ochre
  '#3D6A8A', // Dusty Blue
  '#436650', // Forest Sage
  '#7A4E7A', // Plum
  '#4A5568', // Slate
];

export const SyllabusView: React.FC = () => {
  const {
    state,
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
  } = useApp();

  const subjects = state.syllabusSubjects || [];

  // Active Subject selection
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    return subjects[0]?.id || '';
  });

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TopicStatus | 'deadlines'>('all');

  // Accordion collapsed chapters state
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});

  // Modals state
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState(SUBJECT_COLORS[0]);

  const [editingSubject, setEditingSubject] = useState<{ id: string; name: string; color: string } | null>(null);

  const [showAddChapterModal, setShowAddChapterModal] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');

  const [editingChapter, setEditingChapter] = useState<{ id: string; name: string } | null>(null);

  const [addTopicChapterId, setAddTopicChapterId] = useState<string | null>(null);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDeadline, setNewTopicDeadline] = useState('');
  const [newTopicPriority, setNewTopicPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newTopicNotes, setNewTopicNotes] = useState('');

  const [editingTopic, setEditingTopic] = useState<{
    subjectId: string;
    chapterId: string;
    topic: Subtopic;
  } | null>(null);

  // GPT Syllabus Import modal
  const [isGptImportModalOpen, setIsGptImportModalOpen] = useState(false);

  // In-app confirm modal state (replacing window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: 'Delete',
    onConfirm: () => {},
  });

  // Active subject object fallback
  const activeSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || null;
  }, [subjects, selectedSubjectId]);

  // Overall syllabus stats calculation (safe from division by zero)
  const overallStats = useMemo(() => {
    let total = 0;
    let done = 0;
    let inProgress = 0;
    let revisionNeeded = 0;

    subjects.forEach((s) => {
      s.chapters.forEach((c) => {
        c.subtopics.forEach((t) => {
          total++;
          if (t.status === 'done') done++;
          else if (t.status === 'in_progress') inProgress++;
          else if (t.status === 'revision_needed') revisionNeeded++;
        });
      });
    });

    const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, inProgress, revisionNeeded, percentage };
  }, [subjects]);

  // Active subject stats calculation
  const activeSubjectStats = useMemo(() => {
    if (!activeSubject) return { total: 0, done: 0, inProgress: 0, revisionNeeded: 0, percentage: 0 };
    let total = 0;
    let done = 0;
    let inProgress = 0;
    let revisionNeeded = 0;

    activeSubject.chapters.forEach((c) => {
      c.subtopics.forEach((t) => {
        total++;
        if (t.status === 'done') done++;
        else if (t.status === 'in_progress') inProgress++;
        else if (t.status === 'revision_needed') revisionNeeded++;
      });
    });

    const percentage = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, inProgress, revisionNeeded, percentage };
  }, [activeSubject]);

  // Filtered upcoming deadlines
  const upcomingDeadlines = useMemo(() => {
    const list: { subject: SyllabusSubject; chapter: { id: string; name: string }; topic: Subtopic }[] = [];
    subjects.forEach((s) => {
      s.chapters.forEach((c) => {
        c.subtopics.forEach((t) => {
          if (t.deadline && t.status !== 'done') {
            list.push({ subject: s, chapter: { id: c.id, name: c.name }, topic: t });
          }
        });
      });
    });
    return list.sort((a, b) => (a.topic.deadline || '').localeCompare(b.topic.deadline || ''));
  }, [subjects]);

  const toggleChapterCollapse = (chapterId: string) => {
    setCollapsedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    addSyllabusSubject(newSubjectName.trim(), newSubjectColor);
    setNewSubjectName('');
    setShowAddSubjectModal(false);
  };

  const handleUpdateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject || !editingSubject.name.trim()) return;
    updateSyllabusSubject(editingSubject.id, editingSubject.name.trim(), editingSubject.color);
    setEditingSubject(null);
  };

  const handleDeleteSubject = (id: string, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Subject',
      message: `Are you sure you want to delete "${name}" and all its chapters/topics? This action cannot be undone.`,
      confirmLabel: 'Delete Subject',
      onConfirm: () => {
        deleteSyllabusSubject(id);
        if (selectedSubjectId === id) {
          const remaining = subjects.filter((s) => s.id !== id);
          setSelectedSubjectId(remaining[0]?.id || '');
        }
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleCreateChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubject || !newChapterName.trim()) return;
    addChapter(activeSubject.id, newChapterName.trim());
    setNewChapterName('');
    setShowAddChapterModal(false);
  };

  const handleUpdateChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubject || !editingChapter || !editingChapter.name.trim()) return;
    updateChapter(activeSubject.id, editingChapter.id, editingChapter.name.trim());
    setEditingChapter(null);
  };

  const handleDeleteChapter = (chapterId: string, name: string) => {
    if (!activeSubject) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Chapter',
      message: `Delete chapter "${name}" and all its subtopics? This action cannot be undone.`,
      confirmLabel: 'Delete Chapter',
      onConfirm: () => {
        deleteChapter(activeSubject.id, chapterId);
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleCreateTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubject || !addTopicChapterId || !newTopicName.trim()) return;
    addSubtopic(activeSubject.id, addTopicChapterId, {
      name: newTopicName.trim(),
      status: 'not_started',
      deadline: newTopicDeadline || undefined,
      priority: newTopicPriority,
      notes: newTopicNotes.trim() || undefined,
    });
    setNewTopicName('');
    setNewTopicDeadline('');
    setNewTopicNotes('');
    setAddTopicChapterId(null);
  };

  const handleUpdateTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopic || !editingTopic.topic.name.trim()) return;
    updateSubtopic(editingTopic.subjectId, editingTopic.chapterId, editingTopic.topic.id, {
      name: editingTopic.topic.name.trim(),
      deadline: editingTopic.topic.deadline || undefined,
      priority: editingTopic.topic.priority,
      notes: editingTopic.topic.notes?.trim() || undefined,
    });
    setEditingTopic(null);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* ── Header ── */}
      <div className="border-b border-ivory-300 dark:border-espresso-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest font-mono font-semibold mb-1" style={{ color: 'var(--accent)' }}>
              Curriculum Mastery
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50">
              Syllabus Tracker
            </h1>
            <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
              Track chapter coverage, revisions, and preparation targets with zero guesswork.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsGptImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-700 text-espresso-800 dark:text-ivory-100 hover:bg-ivory-100 dark:hover:bg-espresso-800 shadow-subtle transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-ochre-600 dark:text-ochre-400" />
              <span>Import Syllabus with GPT</span>
            </button>

            <button
              onClick={() => setShowAddSubjectModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-95 transition shadow-subtle"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Plus className="w-4 h-4" /> Add Subject
            </button>
          </div>
        </div>
      </div>

      {/* ── Overall Progress Summary Card ── */}
      <div className="p-5 sm:p-6 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <span className="font-mono text-xs uppercase tracking-wider text-espresso-600 dark:text-espresso-300 font-semibold">
                Overall Syllabus Progress
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-3xl sm:text-4xl font-bold tabular-nums text-espresso-950 dark:text-ivory-50">
                {overallStats.percentage}%
              </span>
              <span className="text-xs text-espresso-500 dark:text-espresso-400">
                ({overallStats.done} of {overallStats.total} subtopics mastered)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="px-3 py-2 rounded-xl bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700">
              <span className="block font-mono text-lg font-bold text-espresso-900 dark:text-ivory-100">{overallStats.total}</span>
              <span className="text-[11px] text-espresso-500 dark:text-espresso-400">Total Topics</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-sage-50 dark:bg-sage-900/20 border border-sage-200 dark:border-sage-800/40">
              <span className="block font-mono text-lg font-bold text-sage-700 dark:text-sage-300">{overallStats.done}</span>
              <span className="text-[11px] text-sage-600 dark:text-sage-400">Mastered</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-ochre-50 dark:bg-ochre-900/20 border border-ochre-200 dark:border-ochre-800/40">
              <span className="block font-mono text-lg font-bold text-ochre-700 dark:text-ochre-300">{overallStats.inProgress}</span>
              <span className="text-[11px] text-ochre-600 dark:text-ochre-400">In Progress</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40">
              <span className="block font-mono text-lg font-bold text-rose-700 dark:text-rose-300">{overallStats.revisionNeeded}</span>
              <span className="text-[11px] text-rose-600 dark:text-rose-400">Needs Revision</span>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-ivory-200 dark:bg-espresso-800 h-2.5 rounded-full overflow-hidden mt-5">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${overallStats.percentage}%`, backgroundColor: 'var(--accent)' }}
          />
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-espresso-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subjects, chapters, or topics…"
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 text-xs text-espresso-900 dark:text-ivory-100 placeholder:text-espresso-400 dark:placeholder:text-espresso-500 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso-400 hover:text-espresso-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-[11px] font-mono uppercase text-espresso-400 dark:text-espresso-500 hidden sm:inline mr-1">
            Filter:
          </span>
          {(['all', 'in_progress', 'done', 'revision_needed', 'deadlines'] as const).map((filter) => {
            const isSelected = statusFilter === filter;
            const label =
              filter === 'all'
                ? 'All'
                : filter === 'deadlines'
                ? `📅 Deadlines (${upcomingDeadlines.length})`
                : STATUS_CONFIG[filter].label;

            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`text-xs px-3 py-1.5 rounded-xl border font-medium whitespace-nowrap transition ${
                  isSelected
                    ? 'border-espresso-800 dark:border-ivory-300 bg-espresso-900 text-ivory-50 dark:bg-ivory-100 dark:text-espresso-950 font-semibold shadow-subtle'
                    : 'border-ivory-300 dark:border-espresso-700 bg-white/70 dark:bg-espresso-850 text-espresso-700 dark:text-espresso-300 hover:bg-ivory-100'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Deadlines Special View ── */}
      {statusFilter === 'deadlines' && (
        <div className="p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-terracotta-600 dark:text-terracotta-400" />
            <h3 className="text-sm font-semibold text-espresso-950 dark:text-ivory-50 font-serif">
              Upcoming Topic Deadlines ({upcomingDeadlines.length})
            </h3>
          </div>
          {upcomingDeadlines.length === 0 ? (
            <p className="text-xs text-espresso-400 dark:text-espresso-500 py-6 text-center italic">
              No pending topic deadlines set. Edit a topic to assign target completion dates!
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingDeadlines.map(({ subject, chapter, topic }) => (
                <div
                  key={topic.id}
                  className="p-3.5 rounded-xl border border-ivory-200 dark:border-espresso-800 bg-ivory-50/60 dark:bg-espresso-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: subject.color }} />
                      <span className="text-[11px] font-mono uppercase font-semibold text-espresso-500 dark:text-espresso-400">
                        {subject.name} · {chapter.name}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-espresso-950 dark:text-ivory-50">{topic.name}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono font-semibold text-terracotta-600 dark:text-terracotta-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {topic.deadline}
                    </span>
                    <button
                      onClick={() => setTopicStatus(subject.id, chapter.id, topic.id, 'done')}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sage-100 dark:bg-sage-900/40 text-sage-800 dark:text-sage-200 hover:bg-sage-200"
                    >
                      Mark Done
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Normal Subject Tabs View ── */}
      {statusFilter !== 'deadlines' && (
        <>
          {/* Subject Pills Selection */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {subjects.map((s) => {
              const isSelected = activeSubject?.id === s.id;
              // Topic counts
              let sTotal = 0;
              let sDone = 0;
              s.chapters.forEach((c) => {
                c.subtopics.forEach((t) => {
                  sTotal++;
                  if (t.status === 'done') sDone++;
                });
              });
              const pct = sTotal === 0 ? 0 : Math.round((sDone / sTotal) * 100);

              return (
                <div key={s.id} className="relative group shrink-0">
                  <button
                    onClick={() => setSelectedSubjectId(s.id)}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-medium transition ${
                      isSelected
                        ? 'border-espresso-900 dark:border-ivory-300 bg-white dark:bg-espresso-800 shadow-subtle'
                        : 'border-ivory-300 dark:border-espresso-750 bg-white/70 dark:bg-espresso-850 hover:bg-ivory-100'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="font-semibold text-espresso-950 dark:text-ivory-50">{s.name}</span>
                    <span className="font-mono text-[11px] text-espresso-500 dark:text-espresso-400 tabular-nums">
                      {pct}%
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Empty Subjects State */}
          {subjects.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-ivory-300 dark:border-espresso-700 rounded-2xl bg-white/40 dark:bg-espresso-850/40">
              <BookOpen className="w-10 h-10 text-espresso-400 mx-auto mb-3" />
              <h3 className="font-serif text-lg font-semibold text-espresso-900 dark:text-ivory-100">
                No syllabus subjects configured
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 max-w-sm mx-auto mt-1 mb-4">
                Add your semester or curriculum subjects (e.g. Physics, Data Structures, Fluid Mechanics) to track chapter-level mastery.
              </p>
              <button
                onClick={() => setShowAddSubjectModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-subtle"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Plus className="w-4 h-4" /> Add First Subject
              </button>
            </div>
          ) : activeSubject ? (
            <div className="space-y-4">
              {/* Active Subject Toolbar */}
              <div className="p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: activeSubject.color }} />
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-espresso-400">
                      Subject
                    </span>
                    <h2 className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
                      {activeSubject.name} Overview
                    </h2>
                    <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
                      {activeSubject.chapters.length} chapters · {activeSubjectStats.done} of {activeSubjectStats.total} topics mastered ({activeSubjectStats.percentage}%)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddChapterModal(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800 text-espresso-800 dark:text-ivory-200 hover:bg-ivory-100"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Chapter
                  </button>
                  <button
                    onClick={() => setEditingSubject({ id: activeSubject.id, name: activeSubject.name, color: activeSubject.color || '#C45532' })}
                    className="p-1.5 rounded-lg text-espresso-500 hover:text-espresso-800 dark:hover:text-ivory-200 hover:bg-ivory-200 dark:hover:bg-espresso-750"
                    title="Rename / change color"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSubject(activeSubject.id, activeSubject.name)}
                    className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    title="Delete subject"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Chapters List */}
              {activeSubject.chapters.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-ivory-300 dark:border-espresso-700 rounded-2xl bg-white/40 dark:bg-espresso-850/40">
                  <p className="text-xs text-espresso-500 dark:text-espresso-400 mb-3">
                    No chapters added to {activeSubject.name} yet.
                  </p>
                  <button
                    onClick={() => setShowAddChapterModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-medium"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Add First Chapter
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSubject.chapters.map((chapter) => {
                    const isCollapsed = collapsedChapters[chapter.id];

                    // Filter topics
                    const filteredTopics = chapter.subtopics.filter((t) => {
                      if (searchQuery.trim()) {
                        const q = searchQuery.toLowerCase();
                        const matchesTopic = t.name.toLowerCase().includes(q);
                        const matchesChapter = chapter.name.toLowerCase().includes(q);
                        const matchesSubject = activeSubject.name.toLowerCase().includes(q);
                        if (!matchesTopic && !matchesChapter && !matchesSubject) return false;
                      }
                      if ((statusFilter as string) !== 'all' && (statusFilter as string) !== 'deadlines') {
                        if (t.status !== statusFilter) return false;
                      }
                      return true;
                    });

                    // Chapter stats
                    const chapTotal = chapter.subtopics.length;
                    const chapDone = chapter.subtopics.filter((t) => t.status === 'done').length;
                    const chapPct = chapTotal === 0 ? 0 : Math.round((chapDone / chapTotal) * 100);

                    return (
                      <div
                        key={chapter.id}
                        className="rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle overflow-hidden"
                      >
                        {/* Chapter Accordion Header */}
                        <div
                          className="p-4 sm:p-4.5 flex items-center justify-between gap-3 cursor-pointer select-none bg-ivory-50/50 dark:bg-espresso-900/40 hover:bg-ivory-100/60 transition"
                          onClick={() => toggleChapterCollapse(chapter.id)}
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <span className="text-espresso-400 dark:text-espresso-500 shrink-0">
                              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-serif text-sm sm:text-base font-semibold text-espresso-950 dark:text-ivory-50 truncate">
                                {chapter.name}
                              </h3>
                              <p className="text-[11px] text-espresso-500 dark:text-espresso-400">
                                {chapDone} of {chapTotal} topics done ({chapPct}%)
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {/* Chapter Mini Progress Bar */}
                            <div className="w-20 sm:w-28 bg-ivory-200 dark:bg-espresso-800 h-2 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${chapPct}%`, backgroundColor: activeSubject.color }}
                              />
                            </div>

                            <button
                              onClick={() => setAddTopicChapterId(chapter.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-ivory-200 dark:bg-espresso-750 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-300"
                              title="Add subtopic"
                            >
                              <Plus className="w-3 h-3" /> Topic
                            </button>
                            <button
                              onClick={() => setEditingChapter({ id: chapter.id, name: chapter.name })}
                              className="p-1 text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200"
                              title="Edit chapter title"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteChapter(chapter.id, chapter.name)}
                              className="p-1 text-espresso-400 hover:text-rose-600"
                              title="Delete chapter"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Subtopics List (Collapsible) */}
                        {!isCollapsed && (
                          <div className="p-3 sm:p-4 space-y-2 border-t border-ivory-200 dark:border-espresso-800">
                            {filteredTopics.length === 0 ? (
                              <p className="text-xs text-espresso-400 italic py-4 text-center">
                                {chapter.subtopics.length === 0
                                  ? 'No topics in this chapter yet.'
                                  : 'No topics match current filter.'}
                              </p>
                            ) : (
                              filteredTopics.map((topic) => {
                                const cfg = STATUS_CONFIG[topic.status];

                                return (
                                  <div
                                    key={topic.id}
                                    className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                      topic.status === 'done'
                                        ? 'bg-ivory-50/50 dark:bg-espresso-900/30 border-ivory-200 dark:border-espresso-800/80 opacity-90'
                                        : 'bg-white dark:bg-espresso-850 border-ivory-200 dark:border-espresso-750'
                                    }`}
                                  >
                                    {/* Topic Title & Status Clicker */}
                                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                      <button
                                        onClick={() =>
                                          setTopicStatus(activeSubject.id, chapter.id, topic.id, NEXT_STATUS[topic.status])
                                        }
                                        className="mt-0.5 p-1 rounded-lg hover:bg-ivory-200 dark:hover:bg-espresso-750 transition shrink-0"
                                        title={`Status: ${cfg.label}. Click to cycle: Not Started → In Progress → Done → Revision Needed`}
                                      >
                                        {cfg.icon}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                        <p
                                          className={`text-xs sm:text-sm font-medium ${
                                            topic.status === 'done'
                                              ? 'line-through text-espresso-400 dark:text-espresso-500'
                                              : 'text-espresso-950 dark:text-ivory-100'
                                          }`}
                                        >
                                          {topic.name}
                                        </p>
                                        {topic.notes && (
                                          <p className="text-[11px] text-espresso-500 dark:text-espresso-400 mt-0.5 line-clamp-1 italic">
                                            {topic.notes}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Metadata & Actions */}
                                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                      {/* Revision counter pill */}
                                      <button
                                        onClick={() => incrementRevision(activeSubject.id, chapter.id, topic.id)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-ivory-200 dark:border-espresso-750 text-[11px] font-mono font-medium text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100 dark:hover:bg-espresso-800"
                                        title="Click to increment revision count"
                                      >
                                        <RotateCcw className="w-2.5 h-2.5 text-espresso-400" />
                                        <span>rev:{topic.revisionCount || 0}</span>
                                      </button>

                                      {/* PYQ toggle */}
                                      <button
                                        onClick={() =>
                                          updateSubtopic(activeSubject.id, chapter.id, topic.id, {
                                            pyqCovered: !topic.pyqCovered,
                                          })
                                        }
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition ${
                                          topic.pyqCovered
                                            ? 'bg-terracotta-100 dark:bg-terracotta-900/40 text-terracotta-700 dark:text-terracotta-300'
                                            : 'bg-ivory-100 dark:bg-espresso-800 text-espresso-400 hover:text-espresso-600'
                                        }`}
                                        title="Toggle past-year question (PYQ) coverage"
                                      >
                                        PYQ {topic.pyqCovered ? '✓' : '○'}
                                      </button>

                                      {/* Deadline tag */}
                                      {topic.deadline && (
                                        <span className="text-[11px] font-mono text-espresso-500 dark:text-espresso-400 flex items-center gap-1">
                                          <Calendar className="w-3 h-3 text-espresso-400" />
                                          {topic.deadline}
                                        </span>
                                      )}

                                      {/* Edit & Delete buttons */}
                                      <button
                                        onClick={() =>
                                          setEditingTopic({
                                            subjectId: activeSubject.id,
                                            chapterId: chapter.id,
                                            topic,
                                          })
                                        }
                                        className="p-1 text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200"
                                        title="Edit topic details"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          setConfirmDialog({
                                            isOpen: true,
                                            title: 'Delete Topic',
                                            message: `Delete topic "${topic.name}"? This action cannot be undone.`,
                                            confirmLabel: 'Delete Topic',
                                            onConfirm: () => {
                                              deleteSubtopic(activeSubject.id, chapter.id, topic.id);
                                              setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                                            },
                                          });
                                        }}
                                        className="p-1 text-espresso-400 hover:text-rose-600"
                                        title="Delete topic"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </>
      )}

      {/* ── Add Subject Modal ── */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                Add Syllabus Subject
              </h3>
              <button onClick={() => setShowAddSubjectModal(false)} className="text-espresso-400 hover:text-espresso-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono">
                  Subject Name
                </label>
                <input
                  type="text"
                  required
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  placeholder="e.g. Organic Chemistry, CHE 201"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono">
                  Accent Color
                </label>
                <div className="flex gap-2">
                  {SUBJECT_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNewSubjectColor(col)}
                      className={`w-7 h-7 rounded-full border-2 transition ${
                        newSubjectColor === col ? 'border-espresso-950 dark:border-ivory-50 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-ivory-300 dark:border-espresso-700 text-espresso-600 dark:text-espresso-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-subtle"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Subject Modal ── */}
      {editingSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                Edit Subject
              </h3>
              <button onClick={() => setEditingSubject(null)} className="text-espresso-400 hover:text-espresso-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono">
                  Subject Name
                </label>
                <input
                  type="text"
                  required
                  value={editingSubject.name}
                  onChange={(e) => setEditingSubject({ ...editingSubject, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono">
                  Color
                </label>
                <div className="flex gap-2">
                  {SUBJECT_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setEditingSubject({ ...editingSubject, color: col })}
                      className={`w-7 h-7 rounded-full border-2 transition ${
                        editingSubject.color === col ? 'border-espresso-950 dark:border-ivory-50 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-ivory-300 dark:border-espresso-700 text-espresso-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-subtle"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Chapter Modal ── */}
      {showAddChapterModal && activeSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                Add Chapter / Unit
              </h3>
              <button onClick={() => setShowAddChapterModal(false)} className="text-espresso-400 hover:text-espresso-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateChapter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1.5 uppercase font-mono">
                  Chapter Name
                </label>
                <input
                  type="text"
                  required
                  value={newChapterName}
                  onChange={(e) => setNewChapterName(e.target.value)}
                  placeholder="e.g. Unit 3: Graph Algorithms"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddChapterModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-ivory-300 dark:border-espresso-700 text-espresso-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-subtle"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Add Chapter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Chapter Modal ── */}
      {editingChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                Rename Chapter
              </h3>
              <button onClick={() => setEditingChapter(null)} className="text-espresso-400 hover:text-espresso-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateChapter} className="space-y-4">
              <div>
                <input
                  type="text"
                  required
                  value={editingChapter.name}
                  onChange={(e) => setEditingChapter({ ...editingChapter, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingChapter(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-ivory-300 dark:border-espresso-700 text-espresso-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-subtle"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Topic Modal ── */}
      {addTopicChapterId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                Add Topic / Subtopic
              </h3>
              <button onClick={() => setAddTopicChapterId(null)} className="text-espresso-400 hover:text-espresso-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTopic} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                  Topic Title
                </label>
                <input
                  type="text"
                  required
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                  placeholder="e.g. Dijkstra Shortest Path Algorithm"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                    Target Deadline
                  </label>
                  <input
                    type="date"
                    value={newTopicDeadline}
                    onChange={(e) => setNewTopicDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                    Priority
                  </label>
                  <select
                    value={newTopicPriority}
                    onChange={(e) => setNewTopicPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={newTopicNotes}
                  onChange={(e) => setNewTopicNotes(e.target.value)}
                  placeholder="Reference book pages, formula traps, key theorems…"
                  className="w-full px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddTopicChapterId(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-ivory-300 dark:border-espresso-700 text-espresso-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-subtle"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Add Topic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Topic Modal ── */}
      {editingTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                Edit Topic
              </h3>
              <button onClick={() => setEditingTopic(null)} className="text-espresso-400 hover:text-espresso-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateTopic} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={editingTopic.topic.name}
                  onChange={(e) =>
                    setEditingTopic({
                      ...editingTopic,
                      topic: { ...editingTopic.topic, name: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={editingTopic.topic.deadline || ''}
                    onChange={(e) =>
                      setEditingTopic({
                        ...editingTopic,
                        topic: { ...editingTopic.topic, deadline: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                    Priority
                  </label>
                  <select
                    value={editingTopic.topic.priority || 'medium'}
                    onChange={(e) =>
                      setEditingTopic({
                        ...editingTopic,
                        topic: { ...editingTopic.topic, priority: e.target.value as any },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1 uppercase font-mono">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editingTopic.topic.notes || ''}
                  onChange={(e) =>
                    setEditingTopic({
                      ...editingTopic,
                      topic: { ...editingTopic.topic, notes: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTopic(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-ivory-300 dark:border-espresso-700 text-espresso-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-subtle"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── In-App Confirm Deletion Modal ── */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* ── GPT Syllabus Import Modal ── */}
      <GptSyllabusImportModal
        isOpen={isGptImportModalOpen}
        onClose={() => setIsGptImportModalOpen(false)}
      />
    </div>
  );
};
