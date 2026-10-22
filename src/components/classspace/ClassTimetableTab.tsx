import React, { useState } from 'react';
import {
  Clock,
  MapPin,
  Plus,
  RotateCcw,
  Ban,
  Check,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Download,
} from 'lucide-react';
import { useClassSpace } from '../../context/ClassSpaceContext';
import { Card } from '../common/Card';
import { ConfirmModal } from '../common/ConfirmModal';
import { ResolvedClassOccurrence, ClassTimetableRule } from '../../types/classSpace';
import { DayOfWeek } from '../../types';
import { useApp } from '../../context/AppContext';

export const ClassTimetableTab: React.FC = () => {
  const {
    rules,
    occurrences,
    canEditSchedule,
    addTimetableRule,
    deleteTimetableRule,
    rescheduleOccurrence,
    cancelOccurrence,
    restoreOccurrence,
    addExtraClass,
  } = useClassSpace();

  const { addSubject, state: appState } = useApp();

  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Modals state
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [isAddExtraOpen, setIsAddExtraOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<ResolvedClassOccurrence | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ResolvedClassOccurrence | null>(null);
  const [deleteRuleTarget, setDeleteRuleTarget] = useState<ClassTimetableRule | null>(null);

  // Copy to personal state
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Form states
  const [ruleSubject, setRuleSubject] = useState('');
  const [ruleCode, setRuleCode] = useState('');
  const [ruleColor, setRuleColor] = useState('#DE6C47');
  const [ruleDay, setRuleDay] = useState<DayOfWeek>(1);
  const [ruleStart, setRuleStart] = useState('09:00');
  const [ruleEnd, setRuleEnd] = useState('10:15');
  const [ruleRoom, setRuleRoom] = useState('');
  const [ruleInstructor, setRuleInstructor] = useState('');
  const [ruleNotes, setRuleNotes] = useState('');

  // Reschedule form
  const [reschedDate, setReschedDate] = useState('');
  const [reschedStart, setReschedStart] = useState('');
  const [reschedEnd, setReschedEnd] = useState('');
  const [reschedRoom, setReschedRoom] = useState('');
  const [reschedNote, setReschedNote] = useState('');

  // Cancel form
  const [cancelNote, setCancelNote] = useState('Cancelled by faculty request');

  // Extra class form
  const [extraSubject, setExtraSubject] = useState('');
  const [extraCode, setExtraCode] = useState('');
  const [extraColor, setExtraColor] = useState('#DE6C47');
  const [extraDate, setExtraDate] = useState(new Date().toISOString().split('T')[0]);
  const [extraStart, setExtraStart] = useState('14:00');
  const [extraEnd, setExtraEnd] = useState('15:15');
  const [extraRoom, setExtraRoom] = useState('');
  const [extraNote, setExtraNote] = useState('');

  // Calculate days of the current viewed week
  const weekDates = React.useMemo(() => {
    const today = new Date();
    // Monday of current week
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) + currentWeekOffset * 7;
    const monday = new Date(today.setDate(diff));

    const days: { date: Date; dateStr: string; dayName: string; dayNumber: number }[] = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dateNum = String(d.getDate()).padStart(2, '0');
      days.push({
        date: d,
        dateStr: `${y}-${m}-${dateNum}`,
        dayName: dayNames[i],
        dayNumber: i + 1,
      });
    }
    return days;
  }, [currentWeekOffset]);

  const handleCopyScheduleToPersonal = () => {
    // Add missing subjects to personal tracker
    for (const rule of rules) {
      const existing = appState.subjects.find(
        (s) => s.code.toUpperCase() === rule.subjectCode.toUpperCase()
      );
      if (!existing) {
        addSubject({
          code: rule.subjectCode,
          name: rule.subjectName,
          targetPct: 75,
          color: rule.subjectColor,
          attended: 0,
          totalConducted: 0,
        });
      }
    }
    setCopiedSuccess(true);
    setTimeout(() => {
      setCopiedSuccess(false);
      setShowCopyModal(false);
    }, 1800);
  };

  const submitAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleSubject.trim() || !ruleCode.trim()) return;
    await addTimetableRule({
      subjectName: ruleSubject.trim(),
      subjectCode: ruleCode.trim(),
      subjectColor: ruleColor,
      dayOfWeek: ruleDay,
      startTime: ruleStart,
      endTime: ruleEnd,
      room: ruleRoom.trim() || undefined,
      instructor: ruleInstructor.trim() || undefined,
      notes: ruleNotes.trim() || undefined,
    });
    setIsAddRuleOpen(false);
    setRuleSubject('');
    setRuleCode('');
  };

  const submitAddExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraSubject.trim() || !extraCode.trim()) return;
    await addExtraClass({
      subjectName: extraSubject.trim(),
      subjectCode: extraCode.trim(),
      subjectColor: extraColor,
      date: extraDate,
      startTime: extraStart,
      endTime: extraEnd,
      room: extraRoom.trim() || undefined,
      changeNote: extraNote.trim() || undefined,
    });
    setIsAddExtraOpen(false);
    setExtraSubject('');
    setExtraCode('');
  };

  const submitReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget || !rescheduleTarget.ruleId) return;
    await rescheduleOccurrence({
      ruleId: rescheduleTarget.ruleId,
      originalDate: rescheduleTarget.date,
      newDate: reschedDate,
      newStartTime: reschedStart || rescheduleTarget.startTime,
      newEndTime: reschedEnd || rescheduleTarget.endTime,
      newRoom: reschedRoom || rescheduleTarget.room,
      changeNote: reschedNote.trim() || 'Rescheduled by CR',
    });
    setRescheduleTarget(null);
  };

  const submitCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget || !cancelTarget.ruleId) return;
    await cancelOccurrence({
      ruleId: cancelTarget.ruleId,
      originalDate: cancelTarget.date,
      changeNote: cancelNote.trim() || 'Class cancelled',
    });
    setCancelTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
            Authoritative Class Timetable
          </h2>
          <p className="text-xs text-espresso-500 dark:text-espresso-400">
            Single shared source of truth maintained by your Class Representative.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Week Navigation */}
          <div className="flex items-center rounded-xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 p-1 shadow-subtle">
            <button
              onClick={() => setCurrentWeekOffset((prev) => prev - 1)}
              className="p-1.5 rounded-lg hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-700 dark:text-ivory-200 transition"
              title="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentWeekOffset(0)}
              className="px-2.5 py-1 text-xs font-mono font-semibold text-espresso-800 dark:text-ivory-100 hover:text-terracotta-600 transition"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentWeekOffset((prev) => prev + 1)}
              className="p-1.5 rounded-lg hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-700 dark:text-ivory-200 transition"
              title="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Copy to Personal Timetable Button */}
          <button
            onClick={() => setShowCopyModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:bg-ivory-50 dark:hover:bg-espresso-800 text-xs font-semibold text-espresso-800 dark:text-ivory-100 shadow-subtle transition cursor-pointer"
            title="Import these subjects and schedule into your personal Tracker"
          >
            <Download className="w-3.5 h-3.5 text-espresso-500" />
            <span>Copy to My Tracker</span>
          </button>

          {/* CR Controls */}
          {canEditSchedule && (
            <>
              <button
                onClick={() => setIsAddExtraOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-terracotta-300 dark:border-terracotta-800 bg-terracotta-50 dark:bg-terracotta-950/40 text-terracotta-700 dark:text-terracotta-300 hover:bg-terracotta-100 text-xs font-semibold shadow-subtle transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Extra Class</span>
              </button>

              <button
                onClick={() => setIsAddRuleOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-semibold shadow-subtle transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Recurring Class</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDates.map((day) => {
          const dayOccurrences = occurrences.filter((occ) => occ.date === day.dateStr);
          const isToday = day.dateStr === new Date().toISOString().split('T')[0];

          return (
            <div
              key={day.dateStr}
              className={`rounded-2xl border transition-all p-3 flex flex-col justify-between min-h-[300px] ${
                isToday
                  ? 'bg-terracotta-50/40 dark:bg-terracotta-950/20 border-terracotta-300 dark:border-terracotta-800 shadow-sm ring-1 ring-terracotta-300/50'
                  : 'bg-white/80 dark:bg-espresso-850/80 border-ivory-300 dark:border-espresso-750 shadow-subtle'
              }`}
            >
              {/* Day Header */}
              <div className="pb-2.5 border-b border-ivory-200 dark:border-espresso-800 flex items-center justify-between">
                <div>
                  <span className="block text-[11px] font-mono uppercase font-semibold text-espresso-500 dark:text-espresso-400">
                    {day.dayName.slice(0, 3)}
                  </span>
                  <span className={`font-mono text-base font-bold ${isToday ? 'text-terracotta-600 dark:text-terracotta-400' : 'text-espresso-950 dark:text-ivory-50'}`}>
                    {day.date.getDate()}
                  </span>
                </div>
                {isToday && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-terracotta-600 text-white font-bold">
                    TODAY
                  </span>
                )}
              </div>

              {/* Day's Occurrences */}
              <div className="space-y-2 py-2 flex-1 overflow-y-auto">
                {dayOccurrences.length === 0 ? (
                  <p className="text-[11px] font-mono text-espresso-400 dark:text-espresso-500 italic py-4 text-center">
                    No classes
                  </p>
                ) : (
                  dayOccurrences.map((occ) => (
                    <div
                      key={occ.occurrenceKey}
                      className={`p-2.5 rounded-xl border transition-all text-xs space-y-1.5 ${
                        occ.isCancelled
                          ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 line-through opacity-70'
                          : occ.source === 'extra'
                          ? 'bg-rose-50/30 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 shadow-xs'
                          : occ.source === 'rescheduled'
                          ? 'bg-ochre-50/40 dark:bg-ochre-950/30 border-ochre-200 dark:border-ochre-800 shadow-xs'
                          : 'bg-ivory-50/80 dark:bg-espresso-900/60 border-ivory-200 dark:border-espresso-750'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: occ.subjectColor }}
                          />
                          <span className="font-semibold text-espresso-950 dark:text-ivory-50 truncate" title={occ.subjectName}>
                            {occ.subjectCode}
                          </span>
                        </div>

                        {/* Status Badges */}
                        {occ.isCancelled ? (
                          <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-rose-600 text-white shrink-0">
                            CANC
                          </span>
                        ) : occ.source === 'extra' ? (
                          <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200 shrink-0">
                            EXTRA
                          </span>
                        ) : occ.source === 'rescheduled' ? (
                          <span className="text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-ochre-100 text-ochre-800 dark:bg-ochre-900 dark:text-ochre-200 shrink-0">
                            RESCHED
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] font-mono text-espresso-600 dark:text-espresso-400">
                        <Clock className="w-3 h-3 text-espresso-400" />
                        <span>{occ.startTime}–{occ.endTime}</span>
                      </div>

                      {occ.room && (
                        <div className="flex items-center gap-1 text-[10px] text-espresso-500 dark:text-espresso-400 truncate">
                          <MapPin className="w-3 h-3 text-espresso-400" />
                          <span>{occ.room}</span>
                        </div>
                      )}

                      {occ.changeNote && (
                        <p className="text-[10px] italic text-espresso-500 dark:text-espresso-400 bg-white/60 dark:bg-espresso-800/60 p-1 rounded">
                          "{occ.changeNote}"
                        </p>
                      )}

                      {/* CR Administrative Actions on this occurrence */}
                      {canEditSchedule && (
                        <div className="pt-1.5 border-t border-ivory-200 dark:border-espresso-750 flex items-center justify-end gap-1">
                          {occ.source === 'extra' || occ.source === 'rescheduled' || occ.isCancelled ? (
                            occ.overrideId && (
                              <button
                                onClick={() => restoreOccurrence(occ.overrideId!)}
                                className="p-1 rounded hover:bg-ivory-200 dark:hover:bg-espresso-800 text-espresso-500 dark:text-espresso-300 transition"
                                title="Revert / restore original occurrence"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                            )
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setRescheduleTarget(occ);
                                  setReschedDate(occ.date);
                                  setReschedStart(occ.startTime);
                                  setReschedEnd(occ.endTime);
                                  setReschedRoom(occ.room || '');
                                  setReschedNote('');
                                }}
                                className="p-1 rounded hover:bg-ochre-100 dark:hover:bg-ochre-950/60 text-ochre-700 dark:text-ochre-300 transition"
                                title="Reschedule this single occurrence"
                              >
                                <Clock className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => {
                                  setCancelTarget(occ);
                                  setCancelNote('Cancelled by CR announcement');
                                }}
                                className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 transition"
                                title="Cancel this single occurrence"
                              >
                                <Ban className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recurring Series Rules Ledger (For CR to manage overall timetable) */}
      {canEditSchedule && (
        <Card className="mt-8">
          <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-espresso-800">
            <div>
              <h3 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                Weekly Recurring Rules Master
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Edits here update the recurring schedule for all future weeks.
              </p>
            </div>
            <button
              onClick={() => setIsAddRuleOpen(true)}
              className="text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Recurring Rule</span>
            </button>
          </div>

          <div className="mt-4 divide-y divide-ivory-200 dark:divide-espresso-800">
            {rules.length === 0 ? (
              <p className="py-6 text-center text-xs font-mono text-espresso-400">
                No recurring rules published yet. Click above to add your class schedule.
              </p>
            ) : (
              rules.map((rule) => {
                const days = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                return (
                  <div key={rule.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rule.subjectColor }} />
                      <div>
                        <span className="font-semibold text-espresso-900 dark:text-ivory-100">
                          {rule.subjectName} ({rule.subjectCode})
                        </span>
                        <div className="text-[11px] font-mono text-espresso-500 dark:text-espresso-400 flex items-center gap-2 mt-0.5">
                          <span>Every {days[rule.dayOfWeek]}</span>
                          <span>·</span>
                          <span>{rule.startTime} – {rule.endTime}</span>
                          {rule.room && (
                            <>
                              <span>·</span>
                              <span>{rule.room}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setDeleteRuleTarget(rule)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      title="Delete recurring class rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}

      {/* Modal 1: Add Recurring Class Rule */}
      {isAddRuleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 p-6 shadow-2xl space-y-4">
            <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
              Publish New Recurring Class
            </h3>
            <form onSubmit={submitAddRule} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Data Structures & Algorithms"
                  value={ruleSubject}
                  onChange={(e) => setRuleSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS301"
                    value={ruleCode}
                    onChange={(e) => setRuleCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                    Day of Week *
                  </label>
                  <select
                    value={ruleDay}
                    onChange={(e) => setRuleDay(Number(e.target.value) as DayOfWeek)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                  >
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                    <option value={7}>Sunday</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={ruleStart}
                    onChange={(e) => setRuleStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={ruleEnd}
                    onChange={(e) => setRuleEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                    Room / Lab
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LH-101"
                    value={ruleRoom}
                    onChange={(e) => setRuleRoom(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                    Instructor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Prof. Raman"
                    value={ruleInstructor}
                    onChange={(e) => setRuleInstructor(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                  Card Accent Color
                </label>
                <div className="flex items-center gap-2">
                  {['#DE6C47', '#436650', '#B8732E', '#3D6A8A', '#6B3F6B', '#4A5568'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setRuleColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition ${
                        ruleColor === c ? 'border-espresso-950 dark:border-white scale-110 shadow-sm' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bring scientific calculator"
                  value={ruleNotes}
                  onChange={(e) => setRuleNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddRuleOpen(false)}
                  className="px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 text-xs font-medium text-espresso-700 dark:text-ivory-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-semibold shadow-subtle"
                >
                  Publish Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Reschedule Occurrence */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 p-6 shadow-2xl space-y-4">
            <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
              Reschedule Single Class Occurrence
            </h3>
            <p className="text-xs text-espresso-500 dark:text-espresso-400">
              Rescheduling {rescheduleTarget.subjectName} on {rescheduleTarget.date}. This affects only this single occurrence and preserves the weekly recurring rule.
            </p>
            <form onSubmit={submitReschedule} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                  New Date *
                </label>
                <input
                  type="date"
                  required
                  value={reschedDate}
                  onChange={(e) => setReschedDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                    New Start Time
                  </label>
                  <input
                    type="time"
                    value={reschedStart}
                    onChange={(e) => setReschedStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                    New End Time
                  </label>
                  <input
                    type="time"
                    value={reschedEnd}
                    onChange={(e) => setReschedEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                  New Room / Lab (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lab 4"
                  value={reschedRoom}
                  onChange={(e) => setReschedRoom(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                  Reason / Announcement Note for Classmates *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shifted due to faculty meeting; confirmed with Dr. Raman"
                  value={reschedNote}
                  onChange={(e) => setReschedNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setRescheduleTarget(null)}
                  className="px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 text-xs font-medium text-espresso-700 dark:text-ivory-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-ochre-600 hover:bg-ochre-700 text-white text-xs font-semibold shadow-subtle"
                >
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Cancel Occurrence */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 p-6 shadow-2xl space-y-4">
            <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
              Cancel Class Occurrence
            </h3>
            <p className="text-xs text-espresso-500 dark:text-espresso-400">
              Cancel {cancelTarget.subjectName} on {cancelTarget.date}. This alerts classmates and ensures the cancelled class is not counted as missed in attendance.
            </p>
            <form onSubmit={submitCancel} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                  Cancellation Reason / Announcement *
                </label>
                <input
                  type="text"
                  required
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  placeholder="e.g. Faculty on leave; class cancelled"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 text-xs font-medium text-espresso-700 dark:text-ivory-200"
                >
                  Keep Class
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-subtle"
                >
                  Cancel Occurrence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Add Extra Class */}
      {isAddExtraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 p-6 shadow-2xl space-y-4">
            <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
              Add Extra / One-Off Lecture
            </h3>
            <form onSubmit={submitAddExtra} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                  Subject / Topic *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Remedial Lab / Seminar"
                  value={extraSubject}
                  onChange={(e) => setExtraSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS301-EXTRA"
                    value={extraCode}
                    onChange={(e) => setExtraCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={extraDate}
                    onChange={(e) => setExtraDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                  Card Accent Color
                </label>
                <div className="flex items-center gap-2">
                  {['#DE6C47', '#436650', '#B8732E', '#3D6A8A', '#6B3F6B', '#4A5568'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setExtraColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition ${
                        extraColor === c ? 'border-espresso-950 dark:border-white scale-110 shadow-sm' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={extraStart}
                    onChange={(e) => setExtraStart(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={extraEnd}
                    onChange={(e) => setExtraEnd(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                  Room / Venue
                </label>
                <input
                  type="text"
                  placeholder="e.g. Seminar Hall 3"
                  value={extraRoom}
                  onChange={(e) => setExtraRoom(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso-700 dark:text-espresso-300 mb-1">
                  CR Note / Instruction
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mandatory attendance for final project review"
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-espresso-950 dark:text-ivory-50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddExtraOpen(false)}
                  className="px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 text-xs font-medium text-espresso-700 dark:text-ivory-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-semibold shadow-subtle"
                >
                  Schedule Extra Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Copy to Personal Timetable Confirmation Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 p-6 shadow-2xl space-y-4">
            <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
              Copy to Personal Tracker
            </h3>
            <p className="text-xs text-espresso-600 dark:text-espresso-300 leading-relaxed">
              This will safely add this ClassSpace's official courses to your personal Tracker so you can track syllabus topics and test errors individually.
            </p>
            <p className="text-[11px] font-mono text-espresso-400 dark:text-espresso-500 bg-ivory-100 dark:bg-espresso-900 p-2.5 rounded-xl">
              ✓ Preserves all your existing personal timetable slots & attendance history.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 text-xs font-medium text-espresso-700 dark:text-ivory-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCopyScheduleToPersonal}
                className="px-4 py-2 rounded-xl bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-semibold shadow-subtle flex items-center gap-1.5"
              >
                {copiedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Imported Successfully!</span>
                  </>
                ) : (
                  <span>Import Courses</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Rule Confirmation */}
      <ConfirmModal
        isOpen={Boolean(deleteRuleTarget)}
        title="Delete Recurring Class Rule"
        message={`Are you sure you want to delete ${deleteRuleTarget?.subjectName}? Future occurrences will no longer appear.`}
        confirmLabel="Delete Rule"
        variant="danger"
        onConfirm={() => {
          if (deleteRuleTarget) {
            deleteTimetableRule(deleteRuleTarget.id);
            setDeleteRuleTarget(null);
          }
        }}
        onCancel={() => setDeleteRuleTarget(null)}
      />
    </div>
  );
};
