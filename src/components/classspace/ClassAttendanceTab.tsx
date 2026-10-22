import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  MapPin,
  Calendar,
  Sparkles,
  Filter,
  Check,
} from 'lucide-react';
import { useClassSpace } from '../../context/ClassSpaceContext';
import { Card } from '../common/Card';

export const ClassAttendanceTab: React.FC = () => {
  const {
    occurrences,
    attendanceRecords,
    attendanceStats,
    markAttendance,
  } = useClassSpace();

  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unmarked' | 'present' | 'absent'>('all');

  const todayStr = new Date().toISOString().split('T')[0];

  // Map attendance record by occurrenceKey
  const attendanceMap = React.useMemo(() => {
    const map = new Map<string, 'present' | 'absent' | 'cancelled'>();
    for (const rec of attendanceRecords) {
      map.set(rec.occurrenceKey, rec.status);
    }
    return map;
  }, [attendanceRecords]);

  // Unique subjects in schedule
  const uniqueSubjects = React.useMemo(() => {
    const map = new Map<string, { code: string; name: string; color: string }>();
    for (const occ of occurrences) {
      if (!map.has(occ.subjectCode)) {
        map.set(occ.subjectCode, {
          code: occ.subjectCode,
          name: occ.subjectName,
          color: occ.subjectColor,
        });
      }
    }
    return Array.from(map.values());
  }, [occurrences]);

  // Filter occurrences
  const filteredOccurrences = occurrences.filter((occ) => {
    if (filterSubject !== 'all' && occ.subjectCode !== filterSubject) return false;
    const status = attendanceMap.get(occ.occurrenceKey);
    if (filterStatus === 'unmarked' && status !== undefined) return false;
    if (filterStatus === 'present' && status !== 'present') return false;
    if (filterStatus === 'absent' && status !== 'absent') return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Attendance Health Gauge & Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <Card className="md:col-span-2 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ivory-200 dark:border-espresso-800">
            <div>
              <h2 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                Personal Attendance for Shared Classes
              </h2>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Linked to the official CR class schedule. Your attendance marks are private to your account.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-espresso-600 dark:text-espresso-300">
                Target: {attendanceStats.targetPercentage}%
              </span>
            </div>
          </div>

          <div className="py-4 flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center rounded-full bg-ivory-100 dark:bg-espresso-800 border-4 border-ivory-200 dark:border-espresso-700 shadow-inner">
              <div className="text-center">
                <span
                  className={`font-mono text-2xl font-black ${
                    attendanceStats.percentage >= attendanceStats.targetPercentage
                      ? 'text-sage-600 dark:text-sage-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {attendanceStats.percentage}%
                </span>
                <span className="block text-[9px] font-mono text-espresso-400 uppercase">
                  Overall
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-ivory-100/70 dark:bg-espresso-900/60 border border-ivory-200 dark:border-espresso-750">
                  <span className="block text-[10px] font-mono uppercase text-espresso-400">Attended</span>
                  <span className="font-mono text-base font-bold text-sage-600 dark:text-sage-400">
                    {attendanceStats.attended}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-ivory-100/70 dark:bg-espresso-900/60 border border-ivory-200 dark:border-espresso-750">
                  <span className="block text-[10px] font-mono uppercase text-espresso-400">Conducted</span>
                  <span className="font-mono text-base font-bold text-espresso-950 dark:text-ivory-50">
                    {attendanceStats.totalConducted}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-ivory-100/70 dark:bg-espresso-900/60 border border-ivory-200 dark:border-espresso-750">
                  <span className="block text-[10px] font-mono uppercase text-espresso-400">Missed</span>
                  <span className="font-mono text-base font-bold text-rose-600 dark:text-rose-400">
                    {Math.max(0, attendanceStats.totalConducted - attendanceStats.attended)}
                  </span>
                </div>
              </div>

              {attendanceStats.percentage >= attendanceStats.targetPercentage ? (
                <p className="text-sage-700 dark:text-sage-300 font-medium flex items-center gap-1.5 pt-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>You are safely meeting the academic requirement.</span>
                </p>
              ) : (
                <p className="text-rose-700 dark:text-rose-300 font-medium flex items-center gap-1.5 pt-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Attendance is below {attendanceStats.targetPercentage}%. Attend upcoming classes to recover!</span>
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Notice Card */}
        <Card className="flex flex-col justify-between bg-ivory-50/50 dark:bg-espresso-900/40">
          <div className="space-y-3">
            <span className="text-xs font-mono uppercase font-bold text-terracotta-700 dark:text-terracotta-300 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Isolated Privacy</span>
            </span>
            <p className="text-xs text-espresso-600 dark:text-espresso-400 leading-relaxed">
              When the CR reschedules a class, the official occurrence automatically shifts for the whole class. Your individual present/absent status remains 100% personal and private to you.
            </p>
            <p className="text-[11px] font-mono text-espresso-500 dark:text-espresso-400 bg-ivory-100 dark:bg-espresso-800 p-2.5 rounded-xl">
              ✓ Cancelled classes are never counted as absent.<br />
              ✓ Future planned classes do not lower your %.
            </p>
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-mono font-semibold text-espresso-500 uppercase">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-xs text-espresso-900 dark:text-ivory-100"
          >
            <option value="all">All Courses</option>
            {uniqueSubjects.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-900 text-xs text-espresso-900 dark:text-ivory-100"
          >
            <option value="all">All Marks</option>
            <option value="unmarked">Unmarked Only</option>
            <option value="present">Attended Only</option>
            <option value="absent">Absent Only</option>
          </select>
        </div>

        <span className="text-xs font-mono text-espresso-400">
          Showing {filteredOccurrences.length} classes
        </span>
      </div>

      {/* Class Occurrence Attendance Ledger */}
      <div className="space-y-3">
        {filteredOccurrences.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-espresso-400 border border-dashed border-ivory-300 dark:border-espresso-750 rounded-2xl">
            No class occurrences match your current filters.
          </div>
        ) : (
          filteredOccurrences.map((occ) => {
            const mark = attendanceMap.get(occ.occurrenceKey);
            const isFuture = occ.date > todayStr;

            return (
              <div
                key={occ.occurrenceKey}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  occ.isCancelled
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 opacity-70'
                    : mark === 'present'
                    ? 'bg-sage-50/30 dark:bg-sage-950/20 border-sage-200 dark:border-sage-800'
                    : mark === 'absent'
                    ? 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
                    : 'bg-white dark:bg-espresso-850 border-ivory-300 dark:border-espresso-750 shadow-subtle'
                }`}
              >
                {/* Class Details */}
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: occ.subjectColor }}
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-espresso-950 dark:text-ivory-50">
                        {occ.subjectName}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-ivory-200 dark:bg-espresso-750 text-espresso-700 dark:text-ivory-300">
                        {occ.subjectCode}
                      </span>
                      {occ.source === 'extra' && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200">
                          EXTRA
                        </span>
                      )}
                      {occ.source === 'rescheduled' && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-ochre-100 text-ochre-800 dark:bg-ochre-900 dark:text-ochre-200">
                          RESCHEDULED
                        </span>
                      )}
                      {occ.isCancelled && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white">
                          CANCELLED
                        </span>
                      )}
                      {isFuture && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-ivory-100 dark:bg-espresso-800 text-espresso-500">
                          Upcoming
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-espresso-600 dark:text-espresso-400 mt-1.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-espresso-400" />
                        <span>{occ.date}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-espresso-400" />
                        <span>{occ.startTime} – {occ.endTime}</span>
                      </span>
                      {occ.room && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-espresso-400" />
                          <span>{occ.room}</span>
                        </span>
                      )}
                    </div>

                    {occ.changeNote && (
                      <p className="text-xs italic text-espresso-500 dark:text-espresso-400 mt-1">
                        CR Notice: {occ.changeNote}
                      </p>
                    )}
                  </div>
                </div>

                {/* Marking Action Controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {occ.isCancelled ? (
                    <span className="text-xs font-mono text-rose-600 dark:text-rose-400 italic">
                      Cancelled by CR
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => markAttendance(occ.occurrenceKey, occ.date, 'present')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          mark === 'present'
                            ? 'bg-sage-600 text-white shadow-xs'
                            : 'border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-200 hover:bg-sage-50 dark:hover:bg-sage-950/40'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Present</span>
                      </button>

                      <button
                        onClick={() => markAttendance(occ.occurrenceKey, occ.date, 'absent')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                          mark === 'absent'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'border border-ivory-300 dark:border-espresso-700 text-espresso-700 dark:text-ivory-200 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Absent</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

