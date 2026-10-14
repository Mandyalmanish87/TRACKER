import React from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { useApp } from '../../context/AppContext';
import { Check, X, Ban, Clock, MapPin, User, CheckCircle2 } from 'lucide-react';
import { AttendanceMark } from '../../types';

export const TodayScheduleWidget: React.FC = () => {
  const { state, markAttendance } = useApp();

  // Day 3 represents Wednesday in sample data and standard midweek
  const currentDayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const hasClassesToday = state.timetable.some((t) => t.dayOfWeek === currentDayOfWeek);
  const targetDay = hasClassesToday ? currentDayOfWeek : 3;

  const todaySlots = state.timetable
    .filter((t) => t.dayOfWeek === targetDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const todayStr = new Date().toISOString().split('T')[0];

  const getSlotMark = (slotId: string): AttendanceMark | null => {
    const log = state.attendanceLogs.find(
      (l) => l.slotId === slotId && (l.date === todayStr || l.isSample)
    );
    return log ? log.status : null;
  };

  const getSubject = (subjectId: string) => {
    return state.subjects.find((s) => s.id === subjectId);
  };

  if (todaySlots.length === 0) {
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
      subtitle={`${todaySlots.length} sessions scheduled — mark attendance in real time`}
      action={
        <Badge variant="neutral" size="sm">
          {todaySlots.length} Classes
        </Badge>
      }
    >
      <div className="space-y-4">
        {todaySlots.map((slot) => {
          const subject = getSubject(slot.subjectId);
          const currentMark = getSlotMark(slot.id);

          return (
            <div
              key={slot.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                currentMark === 'present'
                  ? 'border-sage-300 dark:border-sage-700/60 bg-sage-50/50 dark:bg-sage-950/20 shadow-subtle'
                  : currentMark === 'absent'
                  ? 'border-red-300 dark:border-red-800/60 bg-red-50/50 dark:bg-red-950/20 shadow-subtle'
                  : currentMark === 'cancelled'
                  ? 'border-ivory-300 dark:border-espresso-750 bg-ivory-100/60 dark:bg-espresso-800/40 opacity-75'
                  : 'border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:border-ivory-400 dark:hover:border-espresso-700 shadow-subtle'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Time & Subject Info */}
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono tabular-nums text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {slot.startTime} — {slot.endTime}
                    </span>
                    {subject && (
                      <Badge variant="neutral" size="sm">
                        {subject.code}
                      </Badge>
                    )}
                    {currentMark === 'present' && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-sage-700 dark:text-sage-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Marked Present
                      </span>
                    )}
                    {slot.isSample && (
                      <span className="text-xs font-mono uppercase px-2 py-0.5 rounded-full bg-ivory-200 dark:bg-espresso-750 text-espresso-600 dark:text-ivory-300 font-medium">
                        Demo
                      </span>
                    )}
                  </div>

                  <h4 className="font-serif text-lg sm:text-xl font-medium text-espresso-950 dark:text-ivory-50 tracking-tight">
                    {subject ? subject.name : 'Unknown Subject'}
                  </h4>

                  <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-espresso-500 dark:text-espresso-400 pt-0.5">
                    {slot.room && (
                      <span className="flex items-center gap-1.5 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-terracotta-500" />
                        {slot.room}
                      </span>
                    )}
                    {slot.instructor && (
                      <span className="flex items-center gap-1.5 font-medium">
                        <User className="w-3.5 h-3.5 text-espresso-400 dark:text-espresso-500" />
                        {slot.instructor}
                      </span>
                    )}
                  </div>
                </div>

                {/* Direct Interactive Attendance Actions with easy-to-click targets */}
                <div className="flex items-center gap-2 self-start md:self-center shrink-0 pt-1 md:pt-0">
                  <Button
                    variant={currentMark === 'present' ? 'primary' : 'secondary'}
                    size="md"
                    onClick={() => markAttendance(slot.id, 'present')}
                    title="Mark Present (+1 attended, +1 conducted)"
                    className={
                      currentMark === 'present'
                        ? '!bg-sage-600 !text-white !border-transparent shadow-sm ring-2 ring-sage-400/30'
                        : ''
                    }
                    icon={<Check className="w-4 h-4" />}
                  >
                    Present
                  </Button>
                  <Button
                    variant={currentMark === 'absent' ? 'danger' : 'secondary'}
                    size="md"
                    onClick={() => markAttendance(slot.id, 'absent')}
                    title="Mark Absent (+0 attended, +1 conducted)"
                    className={
                      currentMark === 'absent'
                        ? '!bg-red-600 !text-white !border-transparent shadow-sm ring-2 ring-red-400/30'
                        : ''
                    }
                    icon={<X className="w-4 h-4" />}
                  >
                    Absent
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => markAttendance(slot.id, 'cancelled')}
                    title="Class Cancelled (No change to counts)"
                    className={
                      currentMark === 'cancelled'
                        ? '!bg-espresso-700 !text-ivory-100 font-bold'
                        : ''
                    }
                    icon={<Ban className="w-4 h-4" />}
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
