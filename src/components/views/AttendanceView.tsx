import React, { useState, useMemo } from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { ProgressBar } from '../common/ProgressBar';
import { useApp } from '../../context/AppContext';
import { useOptionalClassSpace } from '../../context/ClassSpaceContext';
import {
  calculateSubjectAttendance,
} from '../../utils/attendance';
import { resolveAttendanceScope } from '../../utils/attendanceScopeResolver';
import { AcademicCalendarSettings } from '../../utils/academicCalendarEngine';
import { AttendanceCalendarTab } from '../attendance/AttendanceCalendarTab';
import { AcademicCalendarModal } from '../attendance/AcademicCalendarModal';
import {
  Calendar,
  BarChart3,
  Users,
  ShieldCheck,
  CalendarDays,
  Settings,
  ChevronDown,
  Info,
} from 'lucide-react';

export const AttendanceView: React.FC = () => {
  const { state, getAttendanceReq, updateSettings } = useApp();
  const classSpace = useOptionalClassSpace();

  const userMode = state.settings?.userMode || 'individual';
  const targetRequirement = getAttendanceReq();

  const [activeTab, setActiveTab] = useState<'calendar' | 'analytics'>('calendar');
  const [simExtraAttend, setSimExtraAttend] = useState<number>(3);
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  // Pure resolution of attendance scope (Individual vs Class-Based)
  const scopeData = useMemo(() => {
    return resolveAttendanceScope({
      userMode,
      appState: state,
      classSpace,
      targetRequirement,
    });
  }, [userMode, state, classSpace, targetRequirement]);

  const activeSub =
    scopeData.subjectMetrics.find((s) => s.subjectId === selectedSubId) ||
    scopeData.subjectMetrics[0];

  const simulatedMetrics = activeSub
    ? calculateSubjectAttendance(
        activeSub.attended + simExtraAttend,
        activeSub.effectiveConducted + simExtraAttend,
        activeSub.targetPercentage || targetRequirement
      )
    : null;

  const handleSaveAcademicCalendar = async (newCalendar: AcademicCalendarSettings) => {
    if (scopeData.mode === 'class_based' && classSpace?.activeWorkspace) {
      await classSpace.updateWorkspaceAcademicCalendar(newCalendar);
    } else {
      updateSettings({ academicCalendar: newCalendar });
    }
  };

  const canEditAcademicSettings =
    scopeData.mode === 'individual' ||
    Boolean(classSpace?.isOwner || classSpace?.isCR || classSpace?.isCoAdmin);

  return (
    <div className="space-y-6 pb-16">
      {/* ─── Top Header & Scope Switcher ─── */}
      <div className="border-b border-ivory-300 dark:border-espresso-800 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
              Strategic Margin & Schedule
            </span>
            {scopeData.mode === 'class_based' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-terracotta-100 dark:bg-terracotta-950/60 text-terracotta-700 dark:text-terracotta-300 border border-terracotta-200 dark:border-terracotta-800">
                <Users className="w-3 h-3" />
                Class-Based Mode
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-ivory-200 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-300">
                Personal Tracker
              </span>
            )}
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl font-normal text-espresso-950 dark:text-ivory-50 tracking-tight">
            Attendance & Schedule Tracking
          </h1>

          <p className="text-xs sm:text-sm text-espresso-500 dark:text-espresso-400 mt-1">
            Global threshold: {targetRequirement}% · Monitor institutional records, safe margins, and mark classes.
          </p>
        </div>

        {/* View Switcher: Calendar vs Analytics */}
        <div className="flex items-center p-1 bg-ivory-100 dark:bg-espresso-800 rounded-xl border border-ivory-300 dark:border-espresso-700 shrink-0 self-start md:self-auto">
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

      {/* ─── ClassSpace Scope Selection Bar (when in Class-Based Mode) ─── */}
      {scopeData.mode === 'class_based' && (
        <div className="p-4 rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-terracotta-100 dark:bg-terracotta-950/60 text-terracotta-600 dark:text-terracotta-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-espresso-500 font-bold">
                  ClassSpace Attendance Scope:
                </span>
                {scopeData.role && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-ivory-200 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-200">
                    Role: {scopeData.role}
                  </span>
                )}
              </div>

              {/* ClassSpace Dropdown Selector */}
              {classSpace && classSpace.workspaces.length > 0 ? (
                <div className="relative inline-block mt-1">
                  <select
                    value={classSpace.activeWorkspace?.id || ''}
                    onChange={(e) => classSpace.selectWorkspace(e.target.value)}
                    className="appearance-none font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50 bg-transparent pr-7 cursor-pointer focus:outline-none hover:text-terracotta-600 dark:hover:text-terracotta-400 transition"
                  >
                    {classSpace.workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id} className="text-espresso-950 dark:text-ivory-50 bg-white dark:bg-espresso-850 text-sm">
                        {ws.name} ({ws.joinCode})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-espresso-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              ) : (
                <p className="font-serif text-sm font-semibold text-espresso-900 dark:text-ivory-100 mt-0.5">
                  No enrolled ClassSpaces
                </p>
              )}
            </div>
          </div>

          {/* Self-attendance security badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-ivory-100 dark:bg-espresso-800/80 border border-ivory-200 dark:border-espresso-700 text-xs text-espresso-600 dark:text-ivory-300">
            <ShieldCheck className="w-4 h-4 text-sage-600 dark:text-sage-400 shrink-0" />
            <span className="text-[11px] leading-tight">
              <strong>Self-Attendance Active:</strong> Marking records and calculations are 100% personal to your account.
            </span>
          </div>
        </div>
      )}

      {/* ─── Academic Calendar Settings KPI Strip ─── */}
      <div className="p-4 rounded-2xl bg-white dark:bg-espresso-850 border border-ivory-300 dark:border-espresso-750 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-ivory-100 dark:bg-espresso-800 text-espresso-700 dark:text-ivory-300">
              <CalendarDays className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase text-espresso-400 tracking-wider font-semibold">
                Academic Period
              </p>
              <p className="text-xs font-bold text-espresso-950 dark:text-ivory-50">
                {scopeData.academicCalendar.periodType === 'semester'
                  ? 'Semester (6 Months)'
                  : 'Academic Year (1 Year)'}
              </p>
            </div>
          </div>

          <div className="h-7 w-px bg-ivory-200 dark:border-espresso-750 hidden sm:block" />

          <div>
            <p className="text-[10px] font-mono uppercase text-espresso-400 tracking-wider font-semibold">
              Date Span
            </p>
            <p className="text-xs font-mono font-bold text-espresso-900 dark:text-ivory-100">
              {scopeData.academicCalendar.startDate} → {scopeData.academicCalendar.endDate}
            </p>
          </div>

          <div className="h-7 w-px bg-ivory-200 dark:border-espresso-750 hidden sm:block" />

          <div>
            <p className="text-[10px] font-mono uppercase text-espresso-400 tracking-wider font-semibold">
              Potential Working Days
            </p>
            <p className="text-xs font-bold text-espresso-900 dark:text-ivory-100">
              {scopeData.academicSummary.potentialWorkingDays} working days{' '}
              <span className="text-[11px] font-normal text-espresso-400 font-mono">
                ({scopeData.academicSummary.weeklyOffDaysCount} off, {scopeData.academicSummary.nationalHolidaysCount} holidays)
              </span>
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsCalendarModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-800 hover:bg-ivory-100 dark:hover:bg-espresso-750 text-xs font-medium text-espresso-700 dark:text-ivory-200 transition shrink-0 self-start md:self-auto"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Configure Calendar</span>
        </button>
      </div>

      {/* ─── Tab Content ─── */}
      {activeTab === 'calendar' ? (
        <AttendanceCalendarTab />
      ) : (
        <div className="space-y-6">
          {/* Aggregate Attendance Card Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-espresso-500 font-semibold">
                  Overall Attendance
                </span>
                <Badge
                  variant={
                    scopeData.aggregateMetrics.status === 'safe'
                      ? 'sage'
                      : scopeData.aggregateMetrics.status === 'warning'
                      ? 'ochre'
                      : 'danger'
                  }
                >
                  {scopeData.aggregateMetrics.status === 'safe'
                    ? 'Safe'
                    : scopeData.aggregateMetrics.status === 'warning'
                    ? 'Borderline'
                    : 'At Risk'}
                </Badge>
              </div>
              <p className="font-serif text-3xl font-bold text-espresso-950 dark:text-ivory-50 mt-2">
                {scopeData.aggregateMetrics.formattedPercentage}
              </p>
              <p className="text-[11px] text-espresso-400 mt-1">
                Target: {targetRequirement}% weighted aggregate
              </p>
            </Card>

            <Card>
              <span className="text-xs font-mono uppercase text-espresso-500 font-semibold">
                Attended / Conducted
              </span>
              <p className="font-serif text-3xl font-bold text-espresso-950 dark:text-ivory-50 mt-2">
                {scopeData.aggregateMetrics.totalAttended} / {scopeData.aggregateMetrics.totalConducted}
              </p>
              <p className="text-[11px] text-espresso-400 mt-1">
                {scopeData.aggregateMetrics.totalAbsent} recorded absences
              </p>
            </Card>

            <Card>
              <span className="text-xs font-mono uppercase text-espresso-500 font-semibold">
                Active Courses
              </span>
              <p className="font-serif text-3xl font-bold text-espresso-950 dark:text-ivory-50 mt-2">
                {scopeData.subjectMetrics.length}
              </p>
              <p className="text-[11px] text-espresso-400 mt-1">
                {scopeData.aggregateMetrics.subjectsAtRiskCount} course(s) below {targetRequirement}%
              </p>
            </Card>

            <Card>
              <span className="text-xs font-mono uppercase text-espresso-500 font-semibold">
                Cancelled Sessions
              </span>
              <p className="font-serif text-3xl font-bold text-espresso-950 dark:text-ivory-50 mt-2">
                {scopeData.aggregateMetrics.totalCancelled}
              </p>
              <p className="text-[11px] text-espresso-400 mt-1">
                Excluded from percentage calculation
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] gap-6 lg:gap-8 items-start">
            {/* Left Column: All Courses Breakdown */}
            <div className="min-w-0 space-y-4">
              <Card
                eyebrow={scopeData.mode === 'class_based' ? 'ClassSpace Schedule' : 'Institutional Records'}
                title="Subject-wise Breakdown"
                subtitle={`${scopeData.subjectMetrics.length} academic courses enrolled`}
              >
                {scopeData.subjectMetrics.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <div className="p-3 w-12 h-12 rounded-2xl bg-ivory-100 dark:bg-espresso-800 text-espresso-400 mx-auto flex items-center justify-center">
                      <Info className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-espresso-900 dark:text-ivory-100">
                      No courses or classes found in this scope.
                    </p>
                    <p className="text-xs text-espresso-500 dark:text-espresso-400 max-w-sm mx-auto">
                      {scopeData.mode === 'class_based'
                        ? 'This ClassSpace timetable has no recurring classes or extra sessions configured yet.'
                        : 'Add courses to your personal timetable or syllabus to monitor attendance margins.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {scopeData.subjectMetrics.map((sub) => (
                      <div
                        key={sub.subjectId}
                        className="p-4 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className="font-mono text-xs font-bold text-espresso-900 dark:text-ivory-100 px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: sub.subjectColor ? `${sub.subjectColor}20` : '#B4530920',
                                  color: sub.subjectColor || '#B45309',
                                }}
                              >
                                {sub.subjectCode}
                              </span>
                              <span className="text-xs font-semibold text-espresso-700 dark:text-ivory-200">
                                {sub.subjectName}
                              </span>
                            </div>
                            <p className="text-[11px] text-espresso-400 mt-1 font-mono">
                              {sub.attended} attended / {sub.effectiveConducted} held · {sub.absent} missed
                              {sub.cancelled > 0 && ` · ${sub.cancelled} cancelled`}
                            </p>
                          </div>

                          <div className="text-right">
                            <span className="font-serif text-xl font-bold text-espresso-950 dark:text-ivory-50">
                              {sub.formattedPercentage}
                            </span>
                            <p className="text-[10px] font-mono text-espresso-400">
                              Target: {sub.targetPercentage}%
                            </p>
                          </div>
                        </div>

                        <ProgressBar
                          value={sub.percentage}
                          threshold={sub.targetPercentage}
                          status={sub.status}
                          height="sm"
                        />

                        <div className="mt-2.5 flex items-center justify-between text-xs">
                          <Badge
                            variant={
                              sub.status === 'safe'
                                ? 'sage'
                                : sub.status === 'warning'
                                ? 'ochre'
                                : 'danger'
                            }
                          >
                            {sub.status === 'safe'
                              ? 'Comfortable'
                              : sub.status === 'warning'
                              ? 'Borderline'
                              : 'In Danger'}
                          </Badge>
                          <span className="font-medium text-espresso-700 dark:text-ivory-300 text-xs">
                            {sub.summaryText}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                        value={activeSub.subjectId}
                        onChange={(e) => setSelectedSubId(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                      >
                        {scopeData.subjectMetrics.map((s) => (
                          <option key={s.subjectId} value={s.subjectId}>
                            {s.subjectCode} — {s.subjectName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-espresso-600 dark:text-espresso-300 mb-1">
                        Simulate Attending Next X Lectures: +{simExtraAttend}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="15"
                        value={simExtraAttend}
                        onChange={(e) => setSimExtraAttend(parseInt(e.target.value, 10))}
                        className="w-full cursor-pointer h-1.5 rounded-lg bg-ivory-200 dark:bg-espresso-750 accent-terracotta-600"
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
                            {activeSub.formattedPercentage}
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
                  <p className="text-xs text-espresso-400 italic">No courses available to simulate.</p>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ─── Academic Calendar Settings Modal ─── */}
      <AcademicCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        initialSettings={scopeData.academicCalendar}
        onSave={handleSaveAcademicCalendar}
        isClassSpaceScope={scopeData.mode === 'class_based'}
        canEdit={canEditAcademicSettings}
      />
    </div>
  );
};
