import React from 'react';
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Users,
  ArrowRight,
  Pin,
  Sparkles,
} from 'lucide-react';
import { useClassSpace } from '../../context/ClassSpaceContext';
import { Card } from '../common/Card';
import { getAvatarInitials, getAvatarColor } from '../../utils/classSpaceUtils';

interface ClassSpaceOverviewProps {
  onNavigateTab: (tab: 'timetable' | 'attendance' | 'community' | 'members' | 'settings') => void;
}

export const ClassSpaceOverview: React.FC<ClassSpaceOverviewProps> = ({ onNavigateTab }) => {
  const {
    occurrences,
    members,
    pinnedMessages,
    attendanceStats,
  } = useClassSpace();

  const todayStr = new Date().toISOString().split('T')[0];
  const todayOccurrences = occurrences.filter((occ) => occ.date === todayStr);
  const upcomingOccurrences = occurrences.filter((occ) => occ.date >= todayStr && !occ.isCancelled);
  const nextClass = upcomingOccurrences[0];

  return (
    <div className="space-y-6">
      {/* Pinned Announcement Banner */}
      {pinnedMessages.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-850 flex items-start gap-3.5 shadow-subtle">
          <div className="p-2 rounded-xl bg-terracotta-100 dark:bg-terracotta-900/60 text-terracotta-700 dark:text-terracotta-300 shrink-0 mt-0.5">
            <Pin className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-terracotta-800 dark:text-terracotta-300">
                CR Official Announcement
              </p>
              <button
                onClick={() => onNavigateTab('community')}
                className="text-xs font-semibold text-terracotta-700 dark:text-terracotta-300 hover:underline shrink-0 flex items-center gap-1"
              >
                <span>View Chat</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <p className="text-sm font-medium text-espresso-900 dark:text-ivory-100 mt-1 leading-relaxed">
              {pinnedMessages[0].content}
            </p>
            <p className="text-[11px] font-mono text-espresso-500 dark:text-espresso-400 mt-1.5">
              Posted by {pinnedMessages[0].senderName} · {new Date(pinnedMessages[0].createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Upcoming Class, Attendance Health, Community Teaser */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        {/* Card 1: Next Class */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-ivory-200 dark:border-espresso-800">
              <span className="text-xs font-mono uppercase font-semibold text-espresso-500 dark:text-espresso-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-terracotta-500" />
                <span>Next Scheduled Class</span>
              </span>
              {nextClass?.source === 'extra' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-bold">
                  Extra Class
                </span>
              )}
              {nextClass?.source === 'rescheduled' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-ochre-100 text-ochre-800 dark:bg-ochre-950/60 dark:text-ochre-300 font-bold">
                  Rescheduled
                </span>
              )}
            </div>

            {nextClass ? (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: nextClass.subjectColor }}
                  />
                  <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50 truncate">
                    {nextClass.subjectName}
                  </h3>
                </div>
                <p className="text-xs font-mono text-espresso-500 dark:text-espresso-400">
                  {nextClass.subjectCode} · {nextClass.date === todayStr ? 'Today' : nextClass.date}
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-espresso-700 dark:text-espresso-300">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-espresso-400" />
                    <span>{nextClass.startTime} – {nextClass.endTime}</span>
                  </span>
                  {nextClass.room && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-espresso-400" />
                      <span>{nextClass.room}</span>
                    </span>
                  )}
                </div>

                {nextClass.changeNote && (
                  <p className="text-xs italic bg-ivory-100 dark:bg-espresso-800 p-2 rounded-xl text-espresso-700 dark:text-espresso-300 mt-2">
                    "{nextClass.changeNote}"
                  </p>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-espresso-400 dark:text-espresso-500 text-xs font-mono">
                No upcoming classes found for this week.
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigateTab('timetable')}
            className="mt-5 w-full py-2 px-3 rounded-xl border border-ivory-300 dark:border-espresso-750 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-xs font-semibold text-espresso-800 dark:text-ivory-100 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Open Official Schedule</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </Card>

        {/* Card 2: Personal Attendance Health */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-espresso-800">
              <span className="text-xs font-mono uppercase font-semibold text-espresso-500 dark:text-espresso-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-sage-600" />
                <span>My Class Attendance</span>
              </span>
              <span className="text-xs font-mono text-espresso-400">
                Target: {attendanceStats.targetPercentage}%
              </span>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="relative w-20 h-20 shrink-0 flex items-center justify-center rounded-full bg-ivory-100 dark:bg-espresso-800 border-4 border-ivory-200 dark:border-espresso-700">
                <span
                  className={`font-mono text-xl font-bold ${
                    attendanceStats.percentage >= attendanceStats.targetPercentage
                      ? 'text-sage-600 dark:text-sage-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {attendanceStats.percentage}%
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <p className="font-semibold text-espresso-950 dark:text-ivory-50">
                  {attendanceStats.attended} of {attendanceStats.totalConducted} classes attended
                </p>
                <p className="text-espresso-500 dark:text-espresso-400">
                  {attendanceStats.percentage >= attendanceStats.targetPercentage ? (
                    <span className="text-sage-700 dark:text-sage-300 font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Safe zone above {attendanceStats.targetPercentage}%
                    </span>
                  ) : (
                    <span className="text-rose-700 dark:text-rose-300 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Below threshold
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-espresso-400">
                  Attendance records remain strictly personal to your account.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('attendance')}
            className="mt-5 w-full py-2 px-3 rounded-xl border border-ivory-300 dark:border-espresso-750 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-xs font-semibold text-espresso-800 dark:text-ivory-100 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Mark / Review Attendance</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </Card>

        {/* Card 3: Class Community & Directory */}
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-espresso-800">
              <span className="text-xs font-mono uppercase font-semibold text-espresso-500 dark:text-espresso-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-dusty-blue-600" />
                <span>Class Community</span>
              </span>
              <span className="text-xs font-mono text-espresso-500 font-semibold">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {/* Member Avatar Stack */}
              <div className="flex items-center -space-x-2 overflow-hidden py-1">
                {members.slice(0, 6).map((m) => (
                  <div
                    key={m.id}
                    className="inline-block h-9 w-9 rounded-full ring-2 ring-white dark:ring-espresso-850 overflow-hidden shadow-subtle bg-ivory-200 flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: getAvatarColor(m.displayName) }}
                    title={m.displayName}
                  >
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.displayName} className="h-full w-full object-cover" />
                    ) : (
                      getAvatarInitials(m.displayName)
                    )}
                  </div>
                ))}
                {members.length > 6 && (
                  <div className="inline-block h-9 w-9 rounded-full ring-2 ring-white dark:ring-espresso-850 bg-espresso-200 dark:bg-espresso-750 flex items-center justify-center text-xs font-mono font-bold text-espresso-700 dark:text-ivory-200">
                    +{members.length - 6}
                  </div>
                )}
              </div>

              <p className="text-xs text-espresso-600 dark:text-espresso-400 leading-relaxed">
                Stay updated with class notifications, notes, and CR announcements in real-time.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-5">
            <button
              onClick={() => onNavigateTab('community')}
              className="py-2 px-3 rounded-xl bg-espresso-950 dark:bg-ivory-100 text-ivory-50 dark:text-espresso-950 text-xs font-semibold shadow-subtle transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => onNavigateTab('members')}
              className="py-2 px-3 rounded-xl border border-ivory-300 dark:border-espresso-750 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-xs font-semibold text-espresso-800 dark:text-ivory-100 transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-espresso-400" />
              <span>Members</span>
            </button>
          </div>
        </Card>
      </div>

      {/* Today's Official Schedule List */}
      <Card>
        <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-espresso-800">
          <div>
            <h3 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
              Today's Authoritative Schedule
            </h3>
            <p className="text-xs text-espresso-500 dark:text-espresso-400">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('timetable')}
            className="text-xs font-semibold text-terracotta-600 dark:text-terracotta-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Full Calendar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          {todayOccurrences.length === 0 ? (
            <div className="py-8 text-center text-espresso-400 dark:text-espresso-500 font-mono text-xs">
              No official classes scheduled for today. Enjoy your self-directed study!
            </div>
          ) : (
            todayOccurrences.map((occ) => (
              <div
                key={occ.occurrenceKey}
                className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  occ.isCancelled
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 opacity-70 line-through'
                    : occ.source === 'extra'
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                    : occ.source === 'rescheduled'
                    ? 'bg-ochre-50/40 dark:bg-ochre-950/20 border-ochre-200 dark:border-ochre-900/50'
                    : 'bg-white dark:bg-espresso-850 border-ivory-300 dark:border-espresso-750 shadow-subtle'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
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
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                          EXTRA CLASS
                        </span>
                      )}
                      {occ.source === 'rescheduled' && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-ochre-100 text-ochre-800 dark:bg-ochre-900/50 dark:text-ochre-300">
                          RESCHEDULED
                        </span>
                      )}
                      {occ.isCancelled && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white">
                          CANCELLED
                        </span>
                      )}
                    </div>
                    {occ.changeNote && (
                      <p className="text-xs text-espresso-600 dark:text-espresso-400 mt-1 italic">
                        Note: {occ.changeNote}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-espresso-700 dark:text-espresso-300 shrink-0">
                  <span className="flex items-center gap-1 font-semibold">
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
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

