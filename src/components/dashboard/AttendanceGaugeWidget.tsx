import React, { useState } from 'react';
import { Card, useCardDensity } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { ProgressBar } from '../common/ProgressBar';
import { useApp } from '../../context/AppContext';
import {
  calculateSubjectAttendance,
  calculateOverallAttendance,
} from '../../utils/attendance';
import { Plus, AlertCircle, ShieldCheck } from 'lucide-react';

export const AttendanceGaugeWidget: React.FC = () => {
  const { state, addSubject, getAttendanceReq } = useApp();
  const { density } = useCardDensity();
  const isCompact = density === 'compact';
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newAttended, setNewAttended] = useState('');
  const [newConducted, setNewConducted] = useState('');

  const targetRequirement = getAttendanceReq();
  const overall = calculateOverallAttendance(state.subjects, targetRequirement);

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;

    const attendedNum = parseInt(newAttended || '0', 10);
    const conductedNum = parseInt(newConducted || '0', 10);

    addSubject({
      code: newCode.trim().toUpperCase(),
      name: newName.trim(),
      attended: Math.max(0, isNaN(attendedNum) ? 0 : attendedNum),
      totalConducted: Math.max(0, isNaN(conductedNum) ? 0 : conductedNum),
      targetPct: targetRequirement,
      color: '#C45532',
    });

    setNewCode('');
    setNewName('');
    setNewAttended('');
    setNewConducted('');
    setShowAddModal(false);
  };

  return (
    <Card
      eyebrow="Academic Health"
      title="Attendance & Safety Margins"
      subtitle={`Calculated against standard ${targetRequirement}% institutional threshold`}
      action={
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setShowAddModal(true)}
        >
          Add Subject
        </Button>
      }
    >
      {/* Overall Score Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-ivory-100 dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-750 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <span className="font-serif tabular-nums text-3xl sm:text-4xl font-bold tracking-tight text-espresso-950 dark:text-ivory-50">
              {overall.formattedPercentage}
            </span>
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-semibold text-espresso-700 dark:text-ivory-200">
                Aggregate Attendance
              </p>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 font-mono tabular-nums">
                {overall.totalAttended} of {overall.totalConducted} classes attended
              </p>
            </div>
          </div>

          <Badge
            variant={
              overall.status === 'safe'
                ? 'sage'
                : overall.status === 'warning'
                ? 'ochre'
                : 'danger'
            }
            size="md"
          >
            {overall.status === 'safe' && <ShieldCheck className="w-4 h-4 mr-1" />}
            {overall.status === 'warning' && <AlertCircle className="w-4 h-4 mr-1" />}
            {overall.status === 'danger' && <AlertCircle className="w-4 h-4 mr-1" />}
            {overall.status === 'safe' ? 'In Safe Zone' : overall.status === 'warning' ? 'Near Margin' : 'Critical Deficit'}
          </Badge>
        </div>

        <ProgressBar
          value={overall.overallPercentage}
          threshold={targetRequirement}
          status={overall.status}
          height="md"
        />
        <div className="flex justify-between items-center text-xs text-espresso-400 dark:text-espresso-500 mt-2 font-mono tabular-nums">
          <span>0%</span>
          <span className="font-semibold text-terracotta-600 dark:text-terracotta-400">Target Threshold: {targetRequirement}%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Subject by subject breakdown */}
      <div className={isCompact ? 'space-y-2' : 'space-y-3.5'}>
        {state.subjects.length === 0 ? (
          <p className="text-xs text-center text-espresso-400 py-6 italic">
            No subjects added yet. Add a subject above or load demo data.
          </p>
        ) : (
          state.subjects.map((sub) => {
            const metrics = calculateSubjectAttendance(
              sub.attended,
              sub.totalConducted,
              sub.targetPct
            );

            return (
              <div
                key={sub.id}
                className={`${isCompact ? 'p-2.5 sm:p-3 rounded-xl' : 'p-4 sm:p-4.5 rounded-2xl'} border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 hover:border-ivory-300 dark:hover:border-espresso-700 transition-colors shadow-subtle`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-ivory-100 dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 shrink-0">
                      {sub.code}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-espresso-800 dark:text-ivory-200 truncate">
                      {sub.name}
                    </span>
                    {sub.isSample && (
                      <span className="text-xs font-mono uppercase px-2 py-0.5 rounded-full bg-ivory-200 dark:bg-espresso-750 text-espresso-600 dark:text-ivory-300 shrink-0">
                        Demo
                      </span>
                    )}
                  </div>

                  <span className="font-serif tabular-nums text-base sm:text-lg font-bold text-espresso-950 dark:text-ivory-50 shrink-0">
                    {metrics.formattedPercentage}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-espresso-500 dark:text-espresso-400 font-mono tabular-nums text-xs">
                    {sub.attended} / {sub.totalConducted} classes
                  </span>

                  <span
                    className={`text-xs font-semibold ${
                      metrics.status === 'safe'
                        ? 'text-sage-700 dark:text-sage-400'
                        : metrics.status === 'warning'
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {metrics.summaryText}
                  </span>
                </div>

                <div className="mt-2.5">
                  <ProgressBar
                    value={metrics.percentage}
                    threshold={sub.targetPct}
                    status={metrics.status}
                    height="sm"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Add Subject Dialog Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-espresso-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-700 rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-editorial dark:shadow-editorial-dark">
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-espresso-950 dark:text-ivory-50 mb-1">
              Add Academic Subject
            </h3>
            <p className="text-xs sm:text-sm text-espresso-500 dark:text-espresso-400 mb-5">
              Create a real persistent subject record with initial attendance numbers.
            </p>

            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-espresso-700 dark:text-espresso-300 mb-1">
                  Subject Code (e.g. CS201)
                </label>
                <input
                  type="text"
                  required
                  placeholder="CS301"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-espresso-700 dark:text-espresso-300 mb-1">
                  Subject Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Computer Networks"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-espresso-700 dark:text-espresso-300 mb-1">
                    Classes Attended
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="18"
                    value={newAttended}
                    onChange={(e) => setNewAttended(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-espresso-700 dark:text-espresso-300 mb-1">
                    Total Conducted
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="20"
                    value={newConducted}
                    onChange={(e) => setNewConducted(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50/50 dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="terracotta" size="md">
                  Save Subject
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
};
