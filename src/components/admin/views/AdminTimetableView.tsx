import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  AlertTriangle,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { useAdminApp } from '../useAdminApp';
import { TimetableSlot } from '../../../types';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { AdminEmptyState } from '../common/AdminEmptyState';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const AdminTimetableView: React.FC = () => {
  const { state } = useAdminApp();
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const timetable = state.timetable || [];
  const subjects = state.subjects || [];
  const overrides = state.occurrenceOverrides || [];

  // Detect conflicting slots (slots with overlapping time ranges on the same day)
  const conflicts = useMemo(() => {
    const list: { slotA: TimetableSlot; slotB: TimetableSlot; day: string }[] = [];
    const byDay: Record<number, TimetableSlot[]> = {};

    timetable.forEach((s) => {
      if (!byDay[s.dayOfWeek]) byDay[s.dayOfWeek] = [];
      byDay[s.dayOfWeek].push(s);
    });

    Object.entries(byDay).forEach(([dayNum, slots]) => {
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const a = slots[i];
          const b = slots[j];
          // Simple time overlap check
          if (a.startTime < b.endTime && b.startTime < a.endTime) {
            list.push({
              slotA: a,
              slotB: b,
              day: DAYS_OF_WEEK[Number(dayNum)],
            });
          }
        }
      }
    });
    return list;
  }, [timetable]);

  // Filtered slots
  const filteredSlots = useMemo(() => {
    return timetable
      .filter((s) => {
        const matchDay = selectedDay === 'all' || s.dayOfWeek === selectedDay;
        const sub = subjects.find((sub) => sub.id === s.subjectId);
        const matchQuery =
          !searchQuery ||
          (sub && sub.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (s.room && s.room.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (s.instructor && s.instructor.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchDay && matchQuery;
      })
      .sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [timetable, subjects, selectedDay, searchQuery]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Timetable Inspector &amp; Schedule Conflict Engine"
        description="Master timetable schedule audit, recurring class rules, room assignments, instructor metadata, and occurrence-level reschedule override verification."
        badge={{
          label: `${timetable.length} Recurring Slots`,
          variant: conflicts.length > 0 ? 'rose' : 'blue',
        }}
      >
        <div className="flex items-center gap-2">
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          >
            <option value="all" className="bg-[#0A0F1D] text-white">All Days</option>
            {DAYS_OF_WEEK.map((name, idx) => (
              <option key={name} value={idx} className="bg-[#0A0F1D] text-white">
                {name}
              </option>
            ))}
          </select>
        </div>
      </AdminPageHeader>

      {/* Conflict Alert Banner if any conflicts exist */}
      {conflicts.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-xs">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-rose-300 font-serif text-sm">
              Schedule Conflicts Detected ({conflicts.length})
            </h4>
            <p className="text-rose-200/80 mt-0.5 leading-relaxed">
              Multiple classes overlap on the same day. Occurrence-level exceptions should be reviewed to prevent student scheduling overlaps.
            </p>
          </div>
        </div>
      )}

      {/* Search Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400 dark:text-ivory-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by subject, room, or instructor..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 text-espresso-900 dark:text-ivory-100 placeholder-espresso-400 dark:placeholder-ivory-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
          />
        </div>
        <span className="text-xs font-mono text-espresso-500 dark:text-ivory-400">
          Showing {filteredSlots.length} of {timetable.length} slots
        </span>
      </div>

      {/* Timetable Slots Table */}
      {filteredSlots.length === 0 ? (
        <AdminEmptyState
          icon={<Calendar className="w-6 h-6" />}
          title="No Timetable Slots Found"
          description={
            searchQuery
              ? `No schedule slots match query "${searchQuery}".`
              : 'No recurring timetable slots registered for this day filter.'
          }
          action={searchQuery ? { label: 'Clear Filter', onClick: () => { setSearchQuery(''); setSelectedDay('all'); } } : undefined}
        />
      ) : (
        <div className="rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ivory-100/70 dark:bg-white/[0.03] border-b border-ivory-200 dark:border-white/10 text-espresso-500 dark:text-ivory-400 font-mono uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Day</th>
                  <th className="py-3.5 px-4">Time Window</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Location / Room</th>
                  <th className="py-3.5 px-4">Instructor</th>
                  <th className="py-3.5 px-4">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200/80 dark:divide-white/5 font-sans">
                {filteredSlots.map((slot) => {
                  const sub = subjects.find((s) => s.id === slot.subjectId);
                  return (
                    <tr
                      key={slot.id}
                      className="hover:bg-ivory-50/80 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-espresso-950 dark:text-white">
                        {DAYS_OF_WEEK[slot.dayOfWeek]}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-espresso-700 dark:text-ivory-200">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          <span>
                            {slot.startTime} – {slot.endTime}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: sub?.color || '#3B82F6' }}
                          />
                          <span className="font-semibold text-espresso-900 dark:text-ivory-100">
                            {sub?.name || 'Unassigned Subject'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-espresso-600 dark:text-ivory-300">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-espresso-400" />
                          <span>{slot.room || 'TBD'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-espresso-600 dark:text-ivory-300">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-espresso-400" />
                          <span>{slot.instructor || 'Staff'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Recurring Rule
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Occurrence Overrides Audit Section */}
      <div className="p-6 rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-ivory-200 dark:border-white/10">
          <h3 className="font-serif text-base font-bold text-espresso-950 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Occurrence-Level Reschedule Exceptions ({overrides.length})
          </h3>
          <span className="text-[10px] font-mono text-espresso-400 dark:text-ivory-400">
            Base rules isolated
          </span>
        </div>
        <p className="text-xs text-espresso-500 dark:text-ivory-400 leading-relaxed">
          The application preserves the invariant that editing or moving a single class occurrence never mutates the underlying recurring schedule rule. Currently {overrides.length} date-specific exceptions are active.
        </p>
      </div>
    </div>
  );
};
