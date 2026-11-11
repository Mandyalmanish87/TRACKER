import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  Search,
  CheckCircle2,
  AlertTriangle,
  Eye,
  X,
} from 'lucide-react';
import { useAdminApp } from '../useAdminApp';
import { Subject } from '../../../types';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { AdminEmptyState } from '../common/AdminEmptyState';

export const AdminAcademicView: React.FC = () => {
  const { state } = useAdminApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'safe' | 'warning' | 'critical'>('all');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  const subjects = state.subjects || [];
  const syllabusSubjects = state.syllabusSubjects || [];

  // Filtered and calculated subjects
  const processedSubjects = useMemo(() => {
    return subjects
      .map((s) => {
        const pct = s.totalConducted > 0 ? (s.attended / s.totalConducted) * 100 : 100;
        const target = s.targetPct || 75;
        let status: 'safe' | 'warning' | 'critical' = 'safe';
        if (pct < target - 5) {
          status = 'critical';
        } else if (pct < target) {
          status = 'warning';
        }

        // Match syllabus subject
        const syl = syllabusSubjects.find(
          (sub) => sub.id === s.id || sub.name.toLowerCase() === s.name.toLowerCase()
        );
        const chapterCount = syl?.chapters?.length || 0;
        const topicCount = (syl?.chapters || []).reduce(
          (acc, c) => acc + (c.subtopics?.length || 0),
          0
        );
        const doneTopics = (syl?.chapters || []).reduce(
          (acc, c) => acc + (c.subtopics || []).filter((t) => t.status === 'done').length,
          0
        );

        return {
          ...s,
          attendancePct: Math.round(pct),
          status,
          chapterCount,
          topicCount,
          doneTopics,
          syllabusProgress: topicCount > 0 ? Math.round((doneTopics / topicCount) * 100) : 0,
        };
      })
      .filter((s) => {
        const matchQuery =
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.code && s.code.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchStatus = statusFilter === 'all' || s.status === statusFilter;
        return matchQuery && matchStatus;
      });
  }, [subjects, syllabusSubjects, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Academic Data &amp; Subject Curricula"
        description="Comprehensive audit of all registered subjects, configured attendance targets, syllabus mastery progress, and academic thresholds."
        badge={{ label: `${subjects.length} Subjects`, variant: 'blue' }}
      >
        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          >
            <option value="all" className="bg-[#0A0F1D] text-white">All Statuses</option>
            <option value="safe" className="bg-[#0A0F1D] text-emerald-400">Safe (&gt;= Target)</option>
            <option value="warning" className="bg-[#0A0F1D] text-amber-400">Warning (&lt; Target)</option>
            <option value="critical" className="bg-[#0A0F1D] text-rose-400">Critical (&lt; Target - 5%)</option>
          </select>
        </div>
      </AdminPageHeader>

      {/* Search Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400 dark:text-ivory-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter subjects by name or code..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 text-espresso-900 dark:text-ivory-100 placeholder-espresso-400 dark:placeholder-ivory-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
          />
        </div>
        <span className="text-xs font-mono text-espresso-500 dark:text-ivory-400">
          Showing {processedSubjects.length} of {subjects.length}
        </span>
      </div>

      {/* Subjects Table */}
      {processedSubjects.length === 0 ? (
        <AdminEmptyState
          icon={<GraduationCap className="w-6 h-6" />}
          title="No Academic Subjects Found"
          description={
            searchQuery
              ? `No subjects match the search query "${searchQuery}".`
              : 'No academic subjects have been registered in TRAKIFY yet.'
          }
          action={searchQuery ? { label: 'Clear Search', onClick: () => setSearchQuery('') } : undefined}
        />
      ) : (
        <div className="rounded-3xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-ivory-100/70 dark:bg-white/[0.03] border-b border-ivory-200 dark:border-white/10 text-espresso-500 dark:text-ivory-400 font-mono uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Subject &amp; Code</th>
                  <th className="py-3.5 px-4">Conducted / Attended</th>
                  <th className="py-3.5 px-4">Attendance %</th>
                  <th className="py-3.5 px-4">Configured Target</th>
                  <th className="py-3.5 px-4">Syllabus Progress</th>
                  <th className="py-3.5 px-4">Health Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200/80 dark:divide-white/5 font-sans">
                {processedSubjects.map((sub) => (
                  <tr
                    key={sub.id}
                    className="hover:bg-ivory-50/80 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: sub.color || '#3B82F6' }}
                        />
                        <div>
                          <p className="font-semibold text-espresso-950 dark:text-ivory-100">
                            {sub.name}
                          </p>
                          <p className="font-mono text-[10px] text-espresso-400 dark:text-ivory-500">
                            {sub.code || 'NO-CODE'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      <span className="font-bold text-espresso-900 dark:text-white">
                        {sub.attended}
                      </span>{' '}
                      / {sub.totalConducted} classes
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-espresso-900 dark:text-white">
                          {sub.attendancePct}%
                        </span>
                        <div className="w-16 h-1.5 rounded-full bg-ivory-200 dark:bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              sub.status === 'safe'
                                ? 'bg-emerald-500'
                                : sub.status === 'warning'
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, sub.attendancePct)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-espresso-600 dark:text-ivory-300 font-semibold">
                      {sub.targetPct}% minimum
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-espresso-700 dark:text-ivory-300">
                          {sub.syllabusProgress}%
                        </span>
                        <span className="text-[10px] font-mono text-espresso-400 dark:text-ivory-500">
                          ({sub.doneTopics}/{sub.topicCount} topics)
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider ${
                          sub.status === 'safe'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                            : sub.status === 'warning'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40'
                        }`}
                      >
                        {sub.status === 'safe' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {sub.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedSubject(sub)}
                        className="p-1.5 rounded-lg text-espresso-400 hover:text-blue-500 dark:text-ivory-400 dark:hover:text-blue-400 hover:bg-ivory-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                        title="Inspect Subject"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drill-down Detail Modal */}
      {selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0C1220] border border-ivory-300 dark:border-white/10 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-ivory-200 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: selectedSubject.color || '#3B82F6' }}
                />
                <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-white">
                  {selectedSubject.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSubject(null)}
                className="p-1.5 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-ivory-100 dark:border-white/5">
                <span className="text-espresso-500 dark:text-ivory-400">Subject Code</span>
                <span className="font-mono font-bold text-espresso-900 dark:text-white">{selectedSubject.code || 'None'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-100 dark:border-white/5">
                <span className="text-espresso-500 dark:text-ivory-400">Target Attendance</span>
                <span className="font-mono font-bold text-blue-500">{selectedSubject.targetPct}%</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-100 dark:border-white/5">
                <span className="text-espresso-500 dark:text-ivory-400">Conducted / Attended</span>
                <span className="font-mono text-espresso-900 dark:text-white">{selectedSubject.attended} of {selectedSubject.totalConducted} classes</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-ivory-100 dark:border-white/5">
                <span className="text-espresso-500 dark:text-ivory-400">Internal UUID</span>
                <span className="font-mono text-[10px] text-espresso-400 dark:text-ivory-500 select-all">{selectedSubject.id}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedSubject(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-500 transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
