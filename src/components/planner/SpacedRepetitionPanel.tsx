import React, { useState } from 'react';
import {
  RotateCcw,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Clock,
  History,
  Sliders,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SpacedReview } from '../../types';
import {
  isReviewOverdue,
  isReviewDueToday,
  DEFAULT_REVIEW_INTERVALS,
  hasActiveReviewForTopic,
} from '../../utils/spacedRepetitionUtils';
import { ConfirmModal } from '../common/ConfirmModal';

interface SpacedRepetitionPanelProps {
  onNavigateToSyllabus?: (subjectId?: string) => void;
}

export const SpacedRepetitionPanel: React.FC<SpacedRepetitionPanelProps> = ({
  onNavigateToSyllabus,
}) => {
  const {
    state,
    addSpacedReview,
    completeSpacedReview,
    rescheduleSpacedReview,
    deleteSpacedReview,
    updateReviewIntervals,
  } = useApp();

  const reviews = state.spacedReviews || [];
  const syllabusSubjects = state.syllabusSubjects || [];
  const reviewIntervals = state.reviewIntervals || DEFAULT_REVIEW_INTERVALS;

  const [filterTab, setFilterTab] = useState<'due' | 'upcoming' | 'all'>('due');

  // New review modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [initialInterval, setInitialInterval] = useState<number>(reviewIntervals[0] || 1);
  const [addError, setAddError] = useState<string | null>(null);

  // Reschedule state
  const [rescheduleReviewId, setRescheduleReviewId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');

  // Delete review state
  const [reviewToDelete, setReviewToDelete] = useState<SpacedReview | null>(null);

  // Config intervals modal
  const [showIntervalsModal, setShowIntervalsModal] = useState(false);
  const [intervalsStr, setIntervalsStr] = useState(reviewIntervals.join(', '));

  // Filtered reviews
  const filteredReviews = reviews.filter((r) => {
    if (filterTab === 'due') {
      return isReviewOverdue(r) || isReviewDueToday(r);
    }
    if (filterTab === 'upcoming') {
      return !isReviewOverdue(r) && !isReviewDueToday(r);
    }
    return true;
  });

  // Safe lookup for topic name and subject color
  const getReviewTopicDetails = (review: SpacedReview) => {
    const subject = syllabusSubjects.find(
      (s) => s.id === review.syllabusSubjectId
    );

    let topicName = review.topicName;
    let isTopicDeleted = false;

    if (subject) {
      let found = false;
      for (const ch of subject.chapters) {
        const t = ch.subtopics.find((top) => top.id === review.syllabusTopicId);
        if (t) {
          topicName = t.name;
          found = true;
          break;
        }
      }
      if (!found && !review.topicName) {
        isTopicDeleted = true;
      }
    } else if (!review.topicName) {
      isTopicDeleted = true;
    }

    return {
      subjectName: subject?.name || 'Subject',
      subjectColor: subject?.color || 'var(--accent)',
      topicName: topicName || (isTopicDeleted ? '[Deleted Topic]' : 'Syllabus Topic'),
      subjectId: subject?.id,
    };
  };

  const handleCreateReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicId) {
      setAddError('Please select a topic to review.');
      return;
    }

    if (hasActiveReviewForTopic(reviews, selectedTopicId)) {
      setAddError('An active review for this topic is already scheduled.');
      return;
    }

    // Find topic name
    const subject = syllabusSubjects.find((s) => s.id === selectedSubjectId);
    let topicName = '';
    if (subject) {
      for (const ch of subject.chapters) {
        const t = ch.subtopics.find((top) => top.id === selectedTopicId);
        if (t) {
          topicName = t.name;
          break;
        }
      }
    }

    const today = new Date();
    today.setDate(today.getDate() + initialInterval);
    const dueDateStr = today.toISOString().split('T')[0];

    addSpacedReview({
      syllabusTopicId: selectedTopicId,
      syllabusSubjectId: selectedSubjectId || undefined,
      syllabusChapterId: selectedChapterId || undefined,
      topicName: topicName || undefined,
      dueDate: dueDateStr,
      intervalDays: initialInterval,
      repetitionLevel: 1,
      isCompleted: false,
      history: [],
    });

    setShowAddModal(false);
    setSelectedSubjectId('');
    setSelectedChapterId('');
    setSelectedTopicId('');
    setAddError(null);
  };

  const handleSaveIntervals = () => {
    const parsed = intervalsStr
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);

    if (parsed.length > 0) {
      updateReviewIntervals(parsed);
    }
    setShowIntervalsModal(false);
  };

  const activeSubject = syllabusSubjects.find((s) => s.id === selectedSubjectId);
  const availableChapters = activeSubject ? activeSubject.chapters : [];
  const activeChapter = availableChapters.find((c) => c.id === selectedChapterId);
  const availableTopics = activeChapter ? activeChapter.subtopics : [];

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
              Spaced Repetition Schedule
            </h3>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-ochre-100 dark:bg-ochre-900/40 text-ochre-700 dark:text-ochre-300">
              {reviews.filter((r) => isReviewOverdue(r) || isReviewDueToday(r)).length} Due
            </span>
          </div>
          <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1">
            Systematic syllabus reviews across progressive intervals ({reviewIntervals.join('d, ')}d)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIntervalsStr(reviewIntervals.join(', '));
              setShowIntervalsModal(true);
            }}
            className="p-2 rounded-xl text-xs font-medium border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-200 hover:bg-ivory-100 transition flex items-center gap-1.5"
            title="Configure review interval steps (e.g. 1, 3, 7, 14, 30 days)"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Intervals</span>
          </button>

          <button
            onClick={() => {
              setAddError(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-subtle transition"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus className="w-3.5 h-3.5" /> Schedule Review
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-ivory-300 dark:border-espresso-800 pb-2">
        <button
          onClick={() => setFilterTab('due')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
            filterTab === 'due'
              ? 'bg-espresso-900 dark:bg-ivory-100 text-white dark:text-espresso-950 shadow-subtle'
              : 'text-espresso-600 dark:text-espresso-400 hover:bg-ivory-200 dark:hover:bg-espresso-800'
          }`}
        >
          <span>Due & Overdue</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-ochre-200 dark:bg-espresso-700 text-espresso-900 dark:text-ivory-200">
            {reviews.filter((r) => isReviewOverdue(r) || isReviewDueToday(r)).length}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('upcoming')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
            filterTab === 'upcoming'
              ? 'bg-espresso-900 dark:bg-ivory-100 text-white dark:text-espresso-950 shadow-subtle'
              : 'text-espresso-600 dark:text-espresso-400 hover:bg-ivory-200 dark:hover:bg-espresso-800'
          }`}
        >
          Upcoming ({reviews.filter((r) => !isReviewOverdue(r) && !isReviewDueToday(r)).length})
        </button>

        <button
          onClick={() => setFilterTab('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
            filterTab === 'all'
              ? 'bg-espresso-900 dark:bg-ivory-100 text-white dark:text-espresso-950 shadow-subtle'
              : 'text-espresso-600 dark:text-espresso-400 hover:bg-ivory-200 dark:hover:bg-espresso-800'
          }`}
        >
          All ({reviews.length})
        </button>
      </div>

      {/* Review Cards Grid */}
      {filteredReviews.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-ivory-300 dark:border-espresso-750 rounded-2xl bg-white/40 dark:bg-espresso-850/40">
          <RotateCcw className="w-8 h-8 text-espresso-400 mx-auto mb-2" />
          <h4 className="font-serif text-sm font-semibold text-espresso-900 dark:text-ivory-100">
            {filterTab === 'due'
              ? 'No reviews due today or overdue!'
              : 'No spaced reviews found in this view.'}
          </h4>
          <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-1 mb-3">
            Spaced reviews reinforce memory at spaced intervals without altering syllabus progress.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 hover:underline inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Schedule a new topic review
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReviews.map((review) => {
            const overdue = isReviewOverdue(review);
            const dueToday = isReviewDueToday(review);
            const details = getReviewTopicDetails(review);
            const historyCount = review.history?.length || 0;

            return (
              <div
                key={review.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  overdue
                    ? 'bg-white dark:bg-espresso-850 border-rose-300 dark:border-rose-900/60 shadow-subtle'
                    : dueToday
                    ? 'bg-white dark:bg-espresso-850 border-amber-300 dark:border-amber-900/60 shadow-subtle'
                    : 'bg-white dark:bg-espresso-850 border-ivory-200 dark:border-espresso-750 shadow-subtle'
                }`}
              >
                {/* Top Tags & Delete */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Level Badge */}
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-ivory-200 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-200">
                      Level {review.repetitionLevel} · {review.intervalDays}d step
                    </span>

                    {/* Status Badge */}
                    {overdue && (
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-1">
                        <AlertCircle className="w-2.5 h-2.5" /> Overdue
                      </span>
                    )}
                    {dueToday && (
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
                        Due Today
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setReviewToDelete(review)}
                    className="p-1 rounded-lg text-espresso-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                    title="Delete review"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Topic & Subject Info */}
                <div>
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: details.subjectColor }} />
                      <span className="text-[11px] font-semibold text-espresso-600 dark:text-espresso-400 truncate">
                        {details.subjectName}
                      </span>
                    </div>
                    {onNavigateToSyllabus && details.subjectId && (
                      <button
                        onClick={() => onNavigateToSyllabus(details.subjectId)}
                        className="text-[10px] text-terracotta-600 dark:text-terracotta-400 hover:underline shrink-0"
                      >
                        Syllabus ›
                      </button>
                    )}
                  </div>
                  <h4 className="font-serif text-sm font-semibold text-espresso-950 dark:text-ivory-50 line-clamp-2">
                    {details.topicName}
                  </h4>
                </div>

                {/* Dates & History */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-espresso-500 dark:text-espresso-400 pt-1 border-t border-ivory-100 dark:border-espresso-800">
                  <span className={`flex items-center gap-1 font-mono ${overdue ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}`}>
                    <Calendar className="w-3 h-3" />
                    <span>Due: {review.dueDate}</span>
                  </span>

                  {historyCount > 0 && (
                    <span className="flex items-center gap-1 font-mono text-[10px]" title="Completions logged">
                      <History className="w-3 h-3" />
                      <span>{historyCount} completed</span>
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => completeSpacedReview(review.id)}
                    className="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold bg-sage-50 hover:bg-sage-100 dark:bg-sage-950/40 dark:hover:bg-sage-900/60 text-sage-700 dark:text-sage-300 border border-sage-200 dark:border-sage-800/40 transition flex items-center justify-center gap-1.5"
                    title="Mark reviewed today and advance to next interval"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Reviewed</span>
                  </button>

                  <button
                    onClick={() => {
                      setRescheduleReviewId(review.id);
                      setRescheduleDate(review.dueDate);
                    }}
                    className="py-1.5 px-2.5 rounded-xl text-xs font-medium border border-ivory-300 dark:border-espresso-750 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition flex items-center gap-1"
                    title="Reschedule review date"
                  >
                    <Clock className="w-3 h-3" />
                    <span>Reschedule</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleReviewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/60 backdrop-blur-sm">
          <div className="w-full max-w-xs bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-5 shadow-xl space-y-4">
            <h4 className="font-serif text-sm font-bold text-espresso-950 dark:text-ivory-50">
              Reschedule Review
            </h4>
            <div>
              <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
                New Due Date
              </label>
              <input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRescheduleReviewId(null)}
                className="px-3 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (rescheduleDate) {
                    rescheduleSpacedReview(rescheduleReviewId, rescheduleDate);
                  }
                  setRescheduleReviewId(null);
                }}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl text-white shadow-subtle"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Save Date
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Review Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-espresso-800">
              <h3 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                Schedule Topic Review
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-espresso-400 hover:text-espresso-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReview} className="space-y-3.5">
              {addError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
                  Subject <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setSelectedChapterId('');
                    setSelectedTopicId('');
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50"
                >
                  <option value="">-- Choose Subject --</option>
                  {syllabusSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chapter */}
              {availableChapters.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
                    Chapter <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedChapterId}
                    onChange={(e) => {
                      setSelectedChapterId(e.target.value);
                      setSelectedTopicId('');
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50"
                  >
                    <option value="">-- Choose Chapter --</option>
                    {availableChapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Topic */}
              {availableTopics.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
                    Topic / Subtopic <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50"
                  >
                    <option value="">-- Choose Topic --</option>
                    {availableTopics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Initial Interval */}
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
                  Starting Interval
                </label>
                <select
                  value={initialInterval}
                  onChange={(e) => setInitialInterval(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50"
                >
                  {reviewIntervals.map((days, idx) => (
                    <option key={days} value={days}>
                      Step {idx + 1}: in {days} day{days !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-ivory-200 dark:border-espresso-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold rounded-xl text-white shadow-subtle"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Schedule Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Intervals Configuration Modal */}
      {showIntervalsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 p-5 shadow-2xl space-y-4">
            <h4 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
              Configure Spaced Intervals
            </h4>
            <p className="text-xs text-espresso-500 dark:text-espresso-400">
              Enter progressive intervals in days separated by commas. Each time a review is marked completed, the next review advances to the next step.
            </p>
            <div>
              <label className="block text-xs font-semibold text-espresso-700 dark:text-ivory-200 mb-1">
                Interval Steps (Days)
              </label>
              <input
                type="text"
                value={intervalsStr}
                onChange={(e) => setIntervalsStr(e.target.value)}
                placeholder="1, 3, 7, 14, 30"
                className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 bg-ivory-50 dark:bg-espresso-800 text-espresso-950 dark:text-ivory-50 font-mono"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowIntervalsModal(false)}
                className="px-3.5 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-750 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveIntervals}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl text-white shadow-subtle"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Save Intervals
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Review Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(reviewToDelete)}
        title="Delete Review Schedule"
        message={`Remove the review schedule for "${reviewToDelete?.topicName || 'this topic'}"?`}
        confirmLabel="Delete Review"
        variant="danger"
        onConfirm={() => {
          if (reviewToDelete) {
            deleteSpacedReview(reviewToDelete.id);
            setReviewToDelete(null);
          }
        }}
        onCancel={() => setReviewToDelete(null)}
      />
    </div>
  );
};
