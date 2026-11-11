import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Search,
  Layers,
  Award,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useAdminApp } from '../useAdminApp';
import { AdminPageHeader } from '../common/AdminPageHeader';
import { AdminStatCard } from '../common/AdminStatCard';
import { AdminEmptyState } from '../common/AdminEmptyState';

export const AdminSyllabusView: React.FC = () => {
  const { state } = useAdminApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);

  const syllabus = state.syllabusSubjects || [];

  const stats = useMemo(() => {
    let totalChapters = 0;
    let totalTopics = 0;
    let totalDone = 0;
    let totalPyq = 0;

    const list = syllabus.map((sub) => {
      const chapters = sub.chapters || [];
      totalChapters += chapters.length;

      let subTopics = 0;
      let subDone = 0;
      let subPyq = 0;

      chapters.forEach((c) => {
        const topics = c.subtopics || [];
        subTopics += topics.length;
        topics.forEach((t) => {
          if (t.status === 'done') subDone++;
          if (t.pyqCovered) subPyq++;
        });
      });

      totalTopics += subTopics;
      totalDone += subDone;
      totalPyq += subPyq;

      // Safe division (no NaN)
      const masteryPct = subTopics > 0 ? Math.round((subDone / subTopics) * 100) : 0;

      return {
        ...sub,
        chapterCount: chapters.length,
        topicCount: subTopics,
        doneCount: subDone,
        pyqCount: subPyq,
        masteryPct,
      };
    });

    const overallMastery = totalTopics > 0 ? Math.round((totalDone / totalTopics) * 100) : 0;

    return {
      list: list.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.code && s.code.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
      totalSubjects: syllabus.length,
      totalChapters,
      totalTopics,
      totalDone,
      totalPyq,
      overallMastery,
    };
  }, [syllabus, searchQuery]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Syllabus Mastery &amp; Curriculum Governance"
        description="Comprehensive audit of academic curriculum coverage, chapter breakdown, subtopic completion status, and PYQ coverage verification."
        badge={{ label: `${stats.overallMastery}% Mastery`, variant: 'blue' }}
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="Overall Mastery"
          value={`${stats.overallMastery}%`}
          subtitle={`${stats.totalDone} of ${stats.totalTopics} topics completed`}
          icon={<Award className="w-4 h-4" />}
          accentColor="#3B82F6"
          trend={{ value: `${stats.overallMastery}%`, isPositive: stats.overallMastery >= 50 }}
        />

        <AdminStatCard
          title="Total Chapters"
          value={stats.totalChapters}
          subtitle={`Across ${stats.totalSubjects} curriculum modules`}
          icon={<Layers className="w-4 h-4" />}
          accentColor="#8B5CF6"
        />

        <AdminStatCard
          title="Curriculum Topics"
          value={stats.totalTopics}
          subtitle={`${stats.totalDone} mastered · ${stats.totalTopics - stats.totalDone} pending`}
          icon={<BookOpen className="w-4 h-4" />}
          accentColor="#10B981"
        />

        <AdminStatCard
          title="PYQs Covered"
          value={stats.totalPyq}
          subtitle="Past-year questions solved"
          icon={<CheckCircle2 className="w-4 h-4" />}
          accentColor="#F59E0B"
        />
      </div>

      {/* Search Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-espresso-400 dark:text-ivory-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search syllabus by subject or code..."
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 text-espresso-900 dark:text-ivory-100 placeholder-espresso-400 dark:placeholder-ivory-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
          />
        </div>
      </div>

      {/* Syllabus Subjects Accordion */}
      {stats.list.length === 0 ? (
        <AdminEmptyState
          icon={<BookOpen className="w-6 h-6" />}
          title="No Syllabus Data Available"
          description={
            searchQuery
              ? `No subjects match "${searchQuery}".`
              : 'Add subjects with chapters and subtopics to view curriculum breakdown.'
          }
        />
      ) : (
        <div className="space-y-3">
          {stats.list.map((sub) => {
            const isExpanded = expandedSubjectId === sub.id;
            return (
              <div
                key={sub.id}
                className="rounded-2xl bg-white/95 dark:bg-[#0A0F1D]/90 border border-ivory-300/80 dark:border-white/10 shadow-sm overflow-hidden transition-all"
              >
                <div
                  onClick={() => setExpandedSubjectId(isExpanded ? null : sub.id)}
                  className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-ivory-50/50 dark:hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3">
                    <button className="text-espresso-400 dark:text-ivory-400">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-espresso-950 dark:text-white">
                        {sub.name}
                      </h4>
                      <p className="font-mono text-[11px] text-espresso-500 dark:text-ivory-400">
                        {sub.code || 'NO-CODE'} · {sub.chapterCount} Chapters · {sub.topicCount} Topics
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="hidden sm:flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-espresso-900 dark:text-white">
                        {sub.masteryPct}%
                      </span>
                      <div className="w-24 h-2 rounded-full bg-ivory-200 dark:bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${sub.masteryPct}%` }}
                        />
                      </div>
                    </div>

                    <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {sub.doneCount} / {sub.topicCount} Done
                    </span>
                  </div>
                </div>

                {/* Expanded Chapter Details */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-ivory-100 dark:border-white/5 space-y-3 bg-ivory-50/30 dark:bg-white/[0.01]">
                    <div className="text-xs font-mono uppercase tracking-wider text-espresso-400 dark:text-ivory-500 font-bold pt-3">
                      Chapter Breakdown
                    </div>
                    {(sub.chapters || []).length === 0 ? (
                      <p className="text-xs text-espresso-400 italic">No chapters configured yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {sub.chapters.map((ch, idx) => {
                          const topics = ch.subtopics || [];
                          const chDone = topics.filter((t) => t.status === 'done').length;
                          return (
                            <div
                              key={ch.id || idx}
                              className="p-3 rounded-xl bg-white dark:bg-white/[0.03] border border-ivory-200 dark:border-white/5 text-xs"
                            >
                              <div className="flex items-center justify-between font-semibold text-espresso-900 dark:text-white mb-1">
                                <span className="truncate">{ch.name}</span>
                                <span className="font-mono text-[10px] text-blue-400">
                                  {chDone}/{topics.length}
                                </span>
                              </div>
                              <p className="text-[11px] text-espresso-500 dark:text-ivory-400">
                                {topics.length} subtopics ({chDone > 0 ? `${Math.round((chDone / Math.max(1, topics.length)) * 100)}% complete` : 'Not started'})
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
