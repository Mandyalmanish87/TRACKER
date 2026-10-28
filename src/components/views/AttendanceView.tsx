import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { ProgressBar } from '../common/ProgressBar';
import { useApp } from '../../context/AppContext';
import {
  calculateSubjectAttendance,
} from '../../utils/attendance';
import { AttendanceCalendarTab } from '../attendance/AttendanceCalendarTab';
import { Calendar, BarChart3 } from 'lucide-react';

export const AttendanceView: React.FC = () => {
  const { state, getAttendanceReq } = useApp();
  const [activeTab, setActiveTab] = useState<'calendar' | 'analytics'>('calendar');
  const [simExtraAttend, setSimExtraAttend] = useState<number>(3);
  const [selectedSubId, setSelectedSubId] = useState<string>('');

  const targetRequirement = getAttendanceReq();
  const activeSub = state.subjects.find((s) => s.id === selectedSubId) || state.subjects[0];

  const simulatedMetrics = activeSub
    ? calculateSubjectAttendance(
        activeSub.attended + simExtraAttend,
        activeSub.totalConducted + simExtraAttend,
        targetRequirement
      )
    : null;

  return (
    <div className="space-y-6 pb-16">
      <div className="border-b border-ivory-300 dark:border-espresso-800 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
            Strategic Margin & Schedule
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight mt-1">
            Attendance & Schedule Tracking
          </h1>
          <p className="text-xs sm:text-sm text-espresso-500 dark:text-espresso-400 mt-1">
            Global threshold: {targetRequirement}% · Monitor institutional records, margins, and mark classes on your calendar.
          </p>
        </div>

        {/* View Switcher: Calendar vs Analytics */}
        <div className="flex items-center p-1 bg-ivory-100 dark:bg-espresso-800 rounded-xl border border-ivory-300 dark:border-espresso-700 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'calendar'
                ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle'
                : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 dark:hover:text-ivory-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Attendance Calendar</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'analytics'
                ? 'bg-white dark:bg-espresso-700 text-espresso-950 dark:text-ivory-50 shadow-subtle'
                : 'text-espresso-600 dark:text-espresso-300 hover:text-espresso-900 dark:hover:text-ivory-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Analytics & Simulator</span>
          </button>
        </div>
      </div>

      {activeTab === 'calendar' ? (
        <AttendanceCalendarTab />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] gap-6 lg:gap-8 items-start">
          {/* Left Column: All Subjects Detail */}
          <div className="min-w-0 space-y-4">
          <Card
            eyebrow="Institutional Records"
            title="Subject-wise Breakdown"
            subtitle={`${state.subjects.length} academic courses enrolled`}
          >
            <div className="space-y-4">
              {state.subjects.map((sub) => {
                const metrics = calculateSubjectAttendance(
                  sub.attended,
                  sub.totalConducted,
                  sub.targetPct
                );

                return (
                  <div
                    key={sub.id}
                    className="p-4 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-espresso-900 dark:text-ivory-100">
                            {sub.code}
                          </span>
                          <span className="text-xs font-semibold text-espresso-700 dark:text-ivory-200">
                            {sub.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-espresso-400 mt-0.5">
                          {sub.attended} attended / {sub.totalConducted} conducted
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
                          {metrics.formattedPercentage}
                        </span>
                        <p className="text-[10px] font-mono text-espresso-400">
                          Target: {sub.targetPct}%
                        </p>
                      </div>
                    </div>

                    <ProgressBar
                      value={metrics.percentage}
                      threshold={sub.targetPct}
                      status={metrics.status}
                      height="sm"
                    />

                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      <Badge
                        variant={
                          metrics.status === 'safe'
                            ? 'sage'
                            : metrics.status === 'warning'
                            ? 'ochre'
                            : 'danger'
                        }
                      >
                        {metrics.status === 'safe'
                          ? 'Comfortable'
                          : metrics.status === 'warning'
                          ? 'Borderline'
                          : 'In Danger'}
                      </Badge>
                      <span className="font-medium text-espresso-700 dark:text-ivory-300 text-xs">
                        {metrics.summaryText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Attendance Simulator */}
        <div className="min-w-0 space-y-4">
          <Card
            eyebrow="What-If Modeling"
            title="Attendance Simulator"
            subtitle="Simulate attending or missing upcoming sessions"
          >
            {activeSub ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-espresso-600 dark:text-espresso-300 mb-1">
                    Select Course
                  </label>
                  <select
                    value={activeSub.id}
                    onChange={(e) => setSelectedSubId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                  >
                    {state.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-espresso-600 dark:text-espresso-300 mb-1">
                    Simulate Attending Next X Lectures: {simExtraAttend}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={simExtraAttend}
                    onChange={(e) => setSimExtraAttend(parseInt(e.target.value, 10))}
                    className="w-full cursor-pointer h-1.5 rounded-lg bg-ivory-200 dark:bg-espresso-750"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <div className="flex justify-between text-[10px] text-espresso-400 font-mono">
                    <span>+1 class</span>
                    <span>+15 classes</span>
                  </div>
                </div>

                {simulatedMetrics && (
                  <div className="p-4 rounded-xl bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700 space-y-2">
                    <p className="text-[11px] font-mono uppercase text-terracotta-600 dark:text-terracotta-400 font-semibold">
                      Projected Outcome
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-espresso-600 dark:text-ivory-300">
                        Current Percentage:
                      </span>
                      <span className="font-mono text-xs font-bold text-espresso-900 dark:text-ivory-100">
                        {calculateSubjectAttendance(activeSub.attended, activeSub.totalConducted).formattedPercentage}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-espresso-600 dark:text-ivory-300">
                        Projected Percentage (+{simExtraAttend}):
                      </span>
                      <span className="font-mono text-base font-bold text-sage-600 dark:text-sage-400">
                        {simulatedMetrics.formattedPercentage}
                      </span>
                    </div>
                    <p className="text-xs text-espresso-600 dark:text-espresso-400 pt-1 border-t border-ivory-200 dark:border-espresso-700">
                      {simulatedMetrics.summaryText}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-espresso-400 italic">No courses to simulate.</p>
            )}
          </Card>
        </div>
      </div>
      )}
    </div>
  );
};
