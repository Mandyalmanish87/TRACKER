import React, { useMemo } from 'react';
import { Card, useCardDensity } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { useOptionalClassSpace } from '../../context/ClassSpaceContext';
import { Check, X, Ban, Clock, MapPin, User, CheckCircle2 } from 'lucide-react';
import { AttendanceMark, DayOfWeek, ResolvedCalendarEvent } from '../../types';
import { resolveScheduleForDate, formatDateStr } from '../../utils/scheduleResolver';

export const TodayScheduleWidget: React.FC = () => {
  const { state, markAttendance, markAttendanceForEvent } = useApp();
  const classSpace = useOptionalClassSpace();
  const isClassBased = state.settings?.userMode === 'class_based';
  const { density } = useCardDensity();
  const isCompact = density === 'compact';

  const today = new Date();
  const todayStr = formatDateStr(today);

  // Resolve today's occurrences using schedule resolver or ClassSpace
  const todayEvents = useMemo(() => {
    // When enrolled in ClassSpace in class-based mode, use shared occurrences
    if (isClassBased && classSpace?.activeWorkspace && classSpace.occurrences.length > 0) {
      return classSpace.occurrences
        .filter((occ) => occ.date === todayStr)
        .map((occ): ResolvedCalendarEvent => ({
          occurrenceKey: occ.occurrenceKey,
          slotId: occ.ruleId,
          extraClassId: occ.source === 'extra' ? occ.overrideId : undefined,
          overrideId: occ.overrideId,
          subjectId: occ.ruleId || occ.overrideId || occ.occurrenceKey,
          dayOfWeek: (new Date(occ.date).getDay() === 0 ? 7 : new Date(occ.date).getDay()) as DayOfWeek,
          date: occ.date,
          startTime: occ.startTime,
          endTime: occ.endTime,
          room: occ.room,
          instructor: occ.instructor,
          notes: occ.notes,
          source: occ.source,
          isCancelled: occ.isCancelled,
          changeNote: occ.changeNote,
        }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    return resolveScheduleForDate(
      state.timetable || [],
      state.occurrenceOverrides || [],
      state.extraClasses || [],
      new Date()
    );
  }, [
    state.timetable,
    state.occurrenceOverrides,
    state.extraClasses,
    todayStr,
    isClassBased,
    classSpace?.activeWorkspace,
    classSpace?.occurrences,
  ]);

  const getEventMark = (evt: ResolvedCalendarEvent): AttendanceMark | null => {
    if (isClassBased && classSpace?.activeWorkspace) {
      const record = classSpace.attendanceRecords.find((r) => r.occurrenceKey === evt.occurrenceKey);
      if (record) {
        return record.status as AttendanceMark;
      }
    }

    const log = state.attendanceLogs.find((l) => {
      if (evt.extraClassId) {
        return l.extraClassId === evt.extraClassId && l.date === evt.date;
      }
      if (evt.slotId) {
        return l.slotId === evt.slotId && l.date === evt.date;
      }
      return false;
    });
    return log ? log.status : null;
  };

  const getSubject = (subjectId: string) => {
    const personal = state.subjects.find((s) => s.id === subjectId);
    if (personal) return personal;
    if (isClassBased && classSpace?.activeWorkspace) {
      const occ = classSpace.occurrences.find(
        (o) => (o.ruleId || o.overrideId || o.occurrenceKey) === subjectId
      );
      if (occ) {
        return {
          id: occ.ruleId || occ.overrideId || occ.occurrenceKey,
          name: occ.subjectName,
          code: occ.subjectCode,
          color: occ.subjectColor,
          targetPct: classSpace.attendanceStats.targetPercentage,
          totalConducted: classSpace.attendanceStats.totalConducted,
          attended: classSpace.attendanceStats.attended,
        };
      }
    }
    return undefined;
  };

  const handleMark = (evt: ResolvedCalendarEvent, status: AttendanceMark) => {
    if (evt.isCancelled) return;

    if (isClassBased && classSpace?.activeWorkspace) {
      classSpace.markAttendance(evt.occurrenceKey, evt.date, status);
    }

    if (markAttendanceForEvent) {
      markAttendanceForEvent(
        evt.occurrenceKey,
        evt.subjectId,
        evt.date,
        status,
        evt.slotId,
        evt.extraClassId,
        evt.overrideId,
        false
      );
    } else if (evt.slotId && markAttendance) {
      markAttendance(evt.slotId, status, evt.date);
    }
  };

  if (todayEvents.length === 0) {
    return (
      <Card
        eyebrow="Academic Schedule"
        title="Today's Timetable"
        subtitle="Lectures, practical labs, and seminars scheduled for today"
      >
        <EmptyState
          title="No lectures scheduled today"
          description="Enjoy your open day or plan self-directed study and project work."
        />
      </Card>
    );
  }

  return (
    <Card
      eyebrow="Academic Schedule"
      title="Today's Timetable"
      subtitle={`${todayEvents.length} sessions scheduled — mark attendance in real time`}
      action={
        <Badge variant="neutral" size="sm">
          {todayEvents.length} Classes
        </Badge>
      }
    >
      <div className={isCompact ? 'space-y-2' : 'space-y-4'}>
        {todayEvents.map((evt) => {
          const subject = getSubject(evt.subjectId);
          const currentMark = getEventMark(evt);
          const isCancelled = Boolean(evt.isCancelled);
          const isRescheduled = evt.source === 'rescheduled';
          const isExtra = evt.source === 'extra';
          const isDemo =
            (evt.slotId && state.timetable.find((t) => t.id === evt.slotId)?.isSample) || false;

          return (
            <div
              key={evt.occurrenceKey || `${evt.slotId || evt.extraClassId || 'class'}-${evt.startTime}`}
              className={`${isCompact ? 'p-2.5 sm:p-3 rounded-xl' : 'p-4 sm:p-5 rounded-2xl'} border transition-all duration-200 ${
                isCancelled
                  ? 'border-ivory-300 dark:border-espresso-750 bg-ivory-100/60 dark:bg-espresso-800/40 opacity-70'
                  : currentMark === 'present'
                  ? 'border-sage-300 dark:border-sage-700/60 bg-sage-50/50 dark:bg-sage-950/20 shadow-subtle'
                  : currentMark === 'absent'
                  ? 'border-red-300 dark:border-red-800/60 bg-red-50/50 dark:bg-red-950/20 shadow-subtle'
                  : currentMark === 'cancelled'
                  ? 'border-ivory-300 dark:border-espresso-750 bg-ivory-100/60 dark:bg-espresso-800/40 opacity-75'
                  : 'border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:border-ivory-400 dark:hover:border-espresso-700 shadow-subtle'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Time & Subject Info */}
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`font-mono tabular-nums text-xs font-semibold flex items-center gap-1 ${
                        isCancelled
                          ? 'line-through text-espresso-400 dark:text-espresso-500'
                          : 'text-terracotta-600 dark:text-terracotta-400'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {evt.startTime} — {evt.endTime}
                    </span>
                    {subject && (
                      <Badge variant="neutral" size="sm">
                        {subject.code}
                      </Badge>
                    )}
                    {isCancelled && (
                      <Badge variant="danger" size="sm">
                        Cancelled
                      </Badge>
                    )}
                    {!isCancelled && isRescheduled && (
                      <Badge variant="ochre" size="sm">
                        Rescheduled
                      </Badge>
                    )}
                    {!isCancelled && isExtra && (
                      <Badge variant="terracotta" size="sm">
                        Extra Class
                      </Badge>
                    )}
                    {!isCancelled && currentMark === 'present' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sage-700 dark:text-sage-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Marked
                      </span>
                    )}
                    {!isCancelled && currentMark === 'absent' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-400">
                        <X className="w-3.5 h-3.5" /> Absent
                      </span>
                    )}
                    {!isCancelled && currentMark === 'cancelled' && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-espresso-600 dark:text-espresso-400">
                        <Ban className="w-3.5 h-3.5" /> Off
                      </span>
                    )}
                    {isDemo && (
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded-full bg-ivory-200 dark:bg-espresso-750 text-espresso-600 dark:text-ivory-300 font-medium">
                        Demo
                      </span>
                    )}
                  </div>

                  <h4
                    className={`font-serif ${
                      isCompact ? 'text-base font-semibold' : 'text-lg sm:text-xl font-medium'
                    } text-espresso-950 dark:text-ivory-50 tracking-tight truncate ${
                      isCancelled ? 'line-through text-espresso-400 dark:text-espresso-500' : ''
                    }`}
                  >
                    {subject ? subject.name : 'Unknown Subject'}
                  </h4>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-espresso-500 dark:text-espresso-400">
                    {evt.room && (
                      <span className="flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-terracotta-500" />
                        {evt.room}
                      </span>
                    )}
                    {evt.instructor && (
                      <span className="flex items-center gap-1 font-medium">
                        <User className="w-3.5 h-3.5 text-espresso-400 dark:text-espresso-500" />
                        {evt.instructor}
                      </span>
                    )}
                    {evt.notes && (
                      <span className="text-xs text-espresso-500 dark:text-espresso-400 italic truncate max-w-xs">
                        {evt.notes}
                      </span>
                    )}
                  </div>
                </div>

                {/* Direct Interactive Attendance Actions */}
                <div className="flex items-center gap-1.5 self-start md:self-center shrink-0 pt-0.5 md:pt-0">
                  <Button
                    variant={!isCancelled && currentMark === 'present' ? 'primary' : 'secondary'}
                    size={isCompact ? 'sm' : 'md'}
                    disabled={isCancelled}
                    onClick={() => handleMark(evt, 'present')}
                    title={
                      isCancelled
                        ? 'Class is cancelled'
                        : 'Mark Present (+1 attended, +1 conducted)'
                    }
                    className={
                      !isCancelled && currentMark === 'present'
                        ? '!bg-sage-600 !text-white !border-transparent shadow-sm ring-2 ring-sage-400/30'
                        : ''
                    }
                    icon={<Check className="w-3.5 h-3.5" />}
                  >
                    Present
                  </Button>
                  <Button
                    variant={!isCancelled && currentMark === 'absent' ? 'danger' : 'secondary'}
                    size={isCompact ? 'sm' : 'md'}
                    disabled={isCancelled}
                    onClick={() => handleMark(evt, 'absent')}
                    title={
                      isCancelled
                        ? 'Class is cancelled'
                        : 'Mark Absent (+0 attended, +1 conducted)'
                    }
                    className={
                      !isCancelled && currentMark === 'absent'
                        ? '!bg-red-600 !text-white !border-transparent shadow-sm ring-2 ring-red-400/30'
                        : ''
                    }
                    icon={<X className="w-3.5 h-3.5" />}
                  >
                    Absent
                  </Button>
                  <Button
                    variant="ghost"
                    size={isCompact ? 'sm' : 'md'}
                    disabled={isCancelled}
                    onClick={() => handleMark(evt, 'cancelled')}
                    title={
                      isCancelled
                        ? 'Class is cancelled'
                        : 'Class Cancelled (No change to counts)'
                    }
                    className={
                      !isCancelled && currentMark === 'cancelled'
                        ? '!bg-espresso-700 !text-ivory-100 font-bold'
                        : ''
                    }
                    icon={<Ban className="w-3.5 h-3.5" />}
                  >
                    Off
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
