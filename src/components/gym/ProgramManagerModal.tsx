import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DEFAULT_WORKOUT_PROGRAMS } from '../../data/defaultPrograms';
import { Calendar, CheckCircle, X, Award, ChevronRight } from 'lucide-react';
import { Button } from '../common/Button';

interface ProgramManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProgramTemplate?: (templateId: string, splitName: string) => void;
}

export const ProgramManagerModal: React.FC<ProgramManagerModalProps> = ({
  isOpen,
  onClose,
  onSelectProgramTemplate,
}) => {
  const { state, setActiveProgram } = useApp();

  const programs = (state.workoutPrograms && state.workoutPrograms.length > 0)
    ? state.workoutPrograms
    : DEFAULT_WORKOUT_PROGRAMS;

  const [selectedProgramId, setSelectedProgramId] = useState<string>(
    () => programs.find((p) => p.isActive)?.id || programs[0]?.id || ''
  );

  if (!isOpen) return null;

  const activeProgram = programs.find((p) => p.id === selectedProgramId) || programs[0];

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const handleActivate = (id: string) => {
    setActiveProgram(id);
    setSelectedProgramId(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-espresso-900 border border-ivory-300 dark:border-espresso-750 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-ivory-200 dark:border-espresso-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-terracotta-100 dark:bg-terracotta-900/40 flex items-center justify-center text-terracotta-600 dark:text-terracotta-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-espresso-950 dark:text-ivory-50">
                Resistance Programs &amp; Splits
              </h2>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Multi-split progressive overload routines calibrated for weekly schedules
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Program Select Cards */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-espresso-500 dark:text-espresso-400 mb-3">
              Available Training Splits
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {programs.map((prog) => {
                const isSelected = prog.id === selectedProgramId;
                const isProgramActive = prog.isActive;

                return (
                  <div
                    key={prog.id}
                    onClick={() => setSelectedProgramId(prog.id)}
                    className={`cursor-pointer p-4 rounded-xl border transition-all text-left space-y-2 ${
                      isSelected
                        ? 'border-terracotta-500 bg-terracotta-50/40 dark:bg-terracotta-950/20 ring-1 ring-terracotta-500'
                        : 'border-ivory-200 dark:border-espresso-750 bg-ivory-50/40 dark:bg-espresso-850 hover:border-ivory-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold uppercase tracking-wider text-terracotta-600 dark:text-terracotta-400">
                        {prog.daysPerWeek} Days/Wk
                      </span>
                      {isProgramActive && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-sage-100 dark:bg-sage-900/50 text-sage-700 dark:text-sage-300 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-sm text-espresso-950 dark:text-ivory-50 line-clamp-1">
                      {prog.name}
                    </p>
                    <p className="text-xs text-espresso-500 dark:text-espresso-400 line-clamp-2">
                      {prog.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Schedule Breakdown */}
          {activeProgram && (
            <div className="p-5 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ivory-200 dark:border-espresso-750 pb-4">
                <div>
                  <h4 className="font-bold text-base text-espresso-950 dark:text-ivory-50">
                    {activeProgram.name}
                  </h4>
                  <p className="text-xs text-espresso-500 dark:text-espresso-400 mt-0.5">
                    {activeProgram.description}
                  </p>
                </div>
                {!activeProgram.isActive && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Award className="w-4 h-4" />}
                    onClick={() => handleActivate(activeProgram.id)}
                  >
                    Set as Active Split
                  </Button>
                )}
              </div>

              {/* 7-day schedule breakdown */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-espresso-500 dark:text-espresso-400">
                  Weekly Schedule
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {activeProgram.schedule.map((dayItem) => {
                    const dayLabel = dayNames[dayItem.dayOfWeek - 1];

                    return (
                      <div
                        key={dayItem.dayOfWeek}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                          dayItem.isRestDay
                            ? 'border-dashed border-ivory-300 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-800/20 text-espresso-400'
                            : 'border-ivory-200 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 shadow-subtle'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-20 font-semibold font-mono text-espresso-600 dark:text-espresso-300">
                            {dayLabel}
                          </span>
                          <span className={dayItem.isRestDay ? 'italic' : 'font-medium'}>
                            {dayItem.customName || (dayItem.isRestDay ? 'Rest & Recovery' : 'Training Day')}
                          </span>
                        </div>

                        {!dayItem.isRestDay && onSelectProgramTemplate && (
                          <button
                            onClick={() => {
                              onSelectProgramTemplate(dayItem.templateId || '', dayItem.customName || 'Workout');
                              onClose();
                            }}
                            className="text-terracotta-600 dark:text-terracotta-400 font-semibold hover:underline flex items-center gap-1"
                          >
                            <span>Launch</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
