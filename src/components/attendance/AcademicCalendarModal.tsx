import React, { useState } from 'react';
import {
  Calendar,
  X,
  Plus,
  Trash2,
  AlertCircle,
  RotateCcw,
  Check,
} from 'lucide-react';
import {
  AcademicCalendarSettings,
  AcademicPeriodType,
  calculateDefaultEndDate,
  DEFAULT_WEEKLY_OFF_SETTINGS,
  DEFAULT_NATIONAL_HOLIDAYS,
} from '../../utils/academicCalendarEngine';

interface AcademicCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings: AcademicCalendarSettings;
  onSave: (settings: AcademicCalendarSettings) => void;
  isClassSpaceScope?: boolean;
  canEdit?: boolean;
}

export const AcademicCalendarModal: React.FC<AcademicCalendarModalProps> = ({
  isOpen,
  onClose,
  initialSettings,
  onSave,
  isClassSpaceScope = false,
  canEdit = true,
}) => {
  const [periodType, setPeriodType] = useState<AcademicPeriodType>(
    initialSettings.periodType || 'semester'
  );
  const [startDate, setStartDate] = useState<string>(initialSettings.startDate || '');
  const [endDate, setEndDate] = useState<string>(initialSettings.endDate || '');
  const [isManualEndDate, setIsManualEndDate] = useState<boolean>(
    initialSettings.isManualEndDate || false
  );
  const [sundayOff, setSundayOff] = useState<boolean>(
    initialSettings.weeklyOffDays?.sundayOff ?? DEFAULT_WEEKLY_OFF_SETTINGS.sundayOff
  );
  const [saturdayOff, setSaturdayOff] = useState<boolean>(
    initialSettings.weeklyOffDays?.saturdayOff ?? DEFAULT_WEEKLY_OFF_SETTINGS.saturdayOff
  );
  const [holidays, setHolidays] = useState<Array<{ id: string; name: string; date: string }>>(
    initialSettings.nationalHolidays || [...DEFAULT_NATIONAL_HOLIDAYS]
  );

  // New holiday form
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [holidayError, setHolidayError] = useState('');

  if (!isOpen) return null;

  const handlePeriodTypeChange = (newType: AcademicPeriodType) => {
    setPeriodType(newType);
    if (!isManualEndDate && startDate) {
      setEndDate(calculateDefaultEndDate(startDate, newType));
    }
  };

  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart);
    if (!isManualEndDate && newStart) {
      setEndDate(calculateDefaultEndDate(newStart, periodType));
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    setEndDate(newEnd);
    setIsManualEndDate(true);
  };

  const handleResetEndDate = () => {
    if (startDate) {
      const calculated = calculateDefaultEndDate(startDate, periodType);
      setEndDate(calculated);
      setIsManualEndDate(false);
    }
  };

  const handleAddHoliday = () => {
    if (!newHolidayName.trim()) {
      setHolidayError('Please enter a holiday name.');
      return;
    }
    if (!newHolidayDate) {
      setHolidayError('Please choose a holiday date.');
      return;
    }
    if (holidays.some((h) => h.date === newHolidayDate)) {
      setHolidayError('A holiday on this date already exists.');
      return;
    }

    setHolidays((prev) => [
      ...prev,
      {
        id: `hol-${Date.now()}`,
        name: newHolidayName.trim(),
        date: newHolidayDate,
      },
    ]);
    setNewHolidayName('');
    setNewHolidayDate('');
    setHolidayError('');
  };

  const handleRemoveHoliday = (id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  const handleSave = () => {
    onSave({
      periodType,
      startDate,
      endDate,
      isManualEndDate,
      weeklyOffDays: {
        sundayOff,
        saturdayOff,
      },
      nationalHolidays: holidays,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Academic Calendar Settings"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white dark:bg-espresso-900 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-ivory-300 dark:border-espresso-750 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-ivory-200 dark:border-espresso-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-terracotta-100 dark:bg-terracotta-950/50 text-terracotta-600 dark:text-terracotta-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                Academic Calendar Settings
              </h2>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                {isClassSpaceScope
                  ? 'Shared timetable period, off days & holidays for this ClassSpace'
                  : 'Personal academic period, off days & holidays for your private tracker'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 hover:bg-ivory-100 dark:hover:bg-espresso-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* 1. Academic Period Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-2">
              Academic Period Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => handlePeriodTypeChange('semester')}
                className={`p-3.5 rounded-xl border text-left transition ${
                  periodType === 'semester'
                    ? 'border-terracotta-500 bg-terracotta-50/50 dark:bg-terracotta-950/30 text-espresso-950 dark:text-ivory-50 shadow-sm'
                    : 'border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 text-espresso-600 dark:text-espresso-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs">Semester</span>
                  {periodType === 'semester' && <Check className="w-4 h-4 text-terracotta-600" />}
                </div>
                <p className="text-[11px] text-espresso-400 dark:text-espresso-500">
                  Default duration: 6 calendar months
                </p>
              </button>

              <button
                type="button"
                disabled={!canEdit}
                onClick={() => handlePeriodTypeChange('year')}
                className={`p-3.5 rounded-xl border text-left transition ${
                  periodType === 'year'
                    ? 'border-terracotta-500 bg-terracotta-50/50 dark:bg-terracotta-950/30 text-espresso-950 dark:text-ivory-50 shadow-sm'
                    : 'border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 text-espresso-600 dark:text-espresso-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs">Academic Year</span>
                  {periodType === 'year' && <Check className="w-4 h-4 text-terracotta-600" />}
                </div>
                <p className="text-[11px] text-espresso-400 dark:text-espresso-500">
                  Default duration: 1 calendar year
                </p>
              </button>
            </div>
          </div>

          {/* 2. Start & End Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-1.5">
                Start Date (Inclusive)
              </label>
              <input
                type="date"
                disabled={!canEdit}
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300">
                  End Date (Inclusive)
                </label>
                {isManualEndDate && (
                  <button
                    type="button"
                    onClick={handleResetEndDate}
                    disabled={!canEdit}
                    className="flex items-center gap-1 text-[10px] text-terracotta-600 dark:text-terracotta-400 hover:underline"
                    title="Recalculate default end date based on period duration"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>
              <input
                type="date"
                disabled={!canEdit}
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              />
              <p className="text-[10px] text-espresso-400 mt-1">
                {isManualEndDate ? 'Custom end date set' : 'Automatically calculated default'}
              </p>
            </div>
          </div>

          {/* 3. Weekly Off Days */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-2">
              Weekly Off Days
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                  sundayOff
                    ? 'border-terracotta-400 bg-terracotta-50/40 dark:bg-terracotta-950/20 text-espresso-900 dark:text-ivory-100'
                    : 'border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 text-espresso-600 dark:text-espresso-400'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={sundayOff}
                  onChange={(e) => setSundayOff(e.target.checked)}
                  className="rounded border-ivory-300 text-terracotta-600 focus:ring-terracotta-500"
                />
                <span className="text-xs font-medium">Sunday Off</span>
              </label>

              <label
                className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                  saturdayOff
                    ? 'border-terracotta-400 bg-terracotta-50/40 dark:bg-terracotta-950/20 text-espresso-900 dark:text-ivory-100'
                    : 'border-ivory-300 dark:border-espresso-750 bg-white dark:bg-espresso-850 text-espresso-600 dark:text-espresso-400'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={saturdayOff}
                  onChange={(e) => setSaturdayOff(e.target.checked)}
                  className="rounded border-ivory-300 text-terracotta-600 focus:ring-terracotta-500"
                />
                <span className="text-xs font-medium">Saturday Off</span>
              </label>
            </div>
            <p className="text-[11px] text-espresso-400 dark:text-espresso-500 mt-1.5">
              Weekly off days are excluded from potential working days, but any explicitly scheduled classes on off days remain markable.
            </p>
          </div>

          {/* 4. National & Institutional Holidays */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-espresso-600 dark:text-espresso-300 mb-2">
              National & Institutional Holidays ({holidays.length})
            </label>

            {/* List */}
            <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-850">
              {holidays.length === 0 ? (
                <p className="text-xs text-espresso-400 italic p-2 text-center">
                  No national holidays configured.
                </p>
              ) : (
                holidays.map((h) => (
                  <div
                    key={h.id || h.date}
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-espresso-800 border border-ivory-200 dark:border-espresso-700 text-xs"
                  >
                    <div>
                      <span className="font-medium text-espresso-900 dark:text-ivory-100">
                        {h.name}
                      </span>
                      <span className="font-mono text-[11px] text-espresso-400 ml-2">
                        {h.date}
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemoveHoliday(h.id)}
                        className="p-1 rounded text-espresso-400 hover:text-red-600 dark:hover:text-red-400 transition"
                        title="Delete holiday"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add Holiday */}
            {canEdit && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Holiday Name (e.g. Diwali)"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                  />
                  <input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="w-36 px-2 py-1.5 text-xs rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddHoliday}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-espresso-900 hover:bg-espresso-800 dark:bg-ivory-100 dark:hover:bg-ivory-200 text-white dark:text-espresso-950 text-xs font-medium transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
                {holidayError && (
                  <p className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {holidayError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-ivory-200 dark:border-espresso-800 bg-ivory-50 dark:bg-espresso-850/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-espresso-600 dark:text-espresso-300 hover:bg-ivory-200 dark:hover:bg-espresso-800 transition"
          >
            Cancel
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-terracotta-600 hover:bg-terracotta-700 text-white text-xs font-semibold shadow-subtle transition"
            >
              Apply Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

