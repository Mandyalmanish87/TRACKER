import React, { useState, useEffect } from 'react';
import { EduHubLecture } from '../../types/eduhub';
import {
  generateNotesFromContent,
  LectureStudyNotes,
} from '../../services/lectureNotesService';
import { downloadStudyNotesPdf, printStudyNotesHtml } from '../../utils/pdfGenerator';
import {
  X,
  FileDown,
  Printer,
  Sparkles,
  BookOpen,
  Info,
  Check,
  Copy,
  FileText,
} from 'lucide-react';

interface LectureNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  lecture: EduHubLecture | null;
  courseTitle: string;
}

export const LectureNotesModal: React.FC<LectureNotesModalProps> = ({
  isOpen,
  onClose,
  lecture,
  courseTitle,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'input'>('preview');
  const [transcriptInput, setTranscriptInput] = useState<string>('');
  const [studyNotes, setStudyNotes] = useState<LectureStudyNotes | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (lecture) {
      // Generate default structured notes based on lecture details or existing content
      const initial = generateNotesFromContent(
        courseTitle,
        lecture.title,
        lecture.youtubeUrl,
        transcriptInput || lecture.notes || '',
        lecture.id
      );
      setStudyNotes(initial);
    }
  }, [lecture?.id, courseTitle]);

  if (!isOpen || !lecture) return null;

  const handleGenerate = () => {
    const updated = generateNotesFromContent(
      courseTitle,
      lecture.title,
      lecture.youtubeUrl,
      transcriptInput,
      lecture.id
    );
    setStudyNotes(updated);
    setActiveTab('preview');
  };

  const handleDownloadPdf = () => {
    if (!studyNotes) return;
    setIsDownloading(true);
    try {
      downloadStudyNotesPdf(studyNotes);
    } finally {
      setTimeout(() => setIsDownloading(false), 800);
    }
  };

  const handlePrint = () => {
    if (!studyNotes) return;
    printStudyNotesHtml(studyNotes);
  };

  const handleCopyMarkdown = async () => {
    if (!studyNotes) return;
    const md = `
# ${studyNotes.lectureTitle}
**Course:** ${studyNotes.courseTitle}  
**Source:** ${studyNotes.sourceUrl}  
**Date:** ${new Date(studyNotes.generatedAt).toLocaleDateString()}

## 1. Executive Summary
${studyNotes.summary}

## 2. Key Concepts
${studyNotes.keyConcepts.map((c) => `- **${c.title}**: ${c.description}`).join('\n')}

## 3. Definitions
${studyNotes.definitions.map((d) => `- **${d.term}**: ${d.definition}`).join('\n')}

## 4. Formulas & Rules
${studyNotes.formulasOrRules.map((f) => `- **${f.name}**: ${f.rule}`).join('\n')}
    `.trim();

    try {
      await navigator.clipboard.writeText(md);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-ivory-300 dark:border-espresso-800 flex items-center justify-between bg-ivory-50/70 dark:bg-espresso-850 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-terracotta-100 dark:bg-terracotta-900/40 text-terracotta-700 dark:text-terracotta-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                Lecture Notes &amp; PDF Export
              </h3>
              <p className="text-xs text-espresso-500 dark:text-espresso-400 truncate max-w-md">
                {lecture.title} · {courseTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 border-b border-ivory-200 dark:border-espresso-800 bg-ivory-50/30 dark:bg-espresso-850/30 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-terracotta-600 text-white shadow-xs'
                  : 'text-espresso-600 dark:text-espresso-300 hover:bg-ivory-200 dark:hover:bg-espresso-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Notes Preview</span>
            </button>
            <button
              onClick={() => setActiveTab('input')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'input'
                  ? 'bg-terracotta-600 text-white shadow-xs'
                  : 'text-espresso-600 dark:text-espresso-300 hover:bg-ivory-200 dark:hover:bg-espresso-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Transcript &amp; Text Input</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="px-2.5 py-1.5 rounded-xl text-xs font-medium border border-ivory-300 dark:border-espresso-700 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-700 dark:text-ivory-200 flex items-center gap-1.5 transition cursor-pointer"
              title="Copy markdown notes to clipboard"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-sage-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-2.5 py-1.5 rounded-xl text-xs font-medium border border-ivory-300 dark:border-espresso-700 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-700 dark:text-ivory-200 flex items-center gap-1.5 transition cursor-pointer"
              title="Print study notes"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-500 text-white flex items-center gap-1.5 transition shadow-subtle cursor-pointer disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Generating...' : 'Download PDF'}</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'preview' ? (
            studyNotes ? (
              <div className="space-y-6 text-espresso-950 dark:text-ivory-50">
                {/* Meta Banner */}
                <div className="p-4 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-ivory-50/50 dark:bg-espresso-850/50 space-y-1">
                  <div className="text-xs font-mono text-terracotta-600 dark:text-terracotta-400 uppercase font-semibold">
                    {studyNotes.courseTitle}
                  </div>
                  <h2 className="font-serif text-xl font-bold">{studyNotes.lectureTitle}</h2>
                  <div className="text-xs text-espresso-500 dark:text-espresso-400 font-mono flex items-center gap-2 pt-1">
                    <span>Source:</span>
                    <a
                      href={studyNotes.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-terracotta-600 truncate max-w-sm"
                    >
                      {studyNotes.sourceUrl}
                    </a>
                  </div>
                </div>

                {/* 1. Summary */}
                <div className="space-y-2">
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-espresso-500 dark:text-espresso-400 flex items-center gap-2">
                    <span>1. Executive Summary</span>
                  </h4>
                  <div className="p-3.5 rounded-xl bg-ivory-50 dark:bg-espresso-850 border border-ivory-200 dark:border-espresso-800 text-sm leading-relaxed">
                    {studyNotes.summary}
                  </div>
                </div>

                {/* 2. Key Concepts */}
                {studyNotes.keyConcepts.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-espresso-500 dark:text-espresso-400">
                      2. Key Concepts &amp; Principles
                    </h4>
                    <div className="space-y-2">
                      {studyNotes.keyConcepts.map((concept, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 space-y-1"
                        >
                          <div className="font-semibold text-xs text-espresso-900 dark:text-ivory-100 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-terracotta-500" />
                            {concept.title}
                          </div>
                          <p className="text-xs text-espresso-600 dark:text-espresso-300 leading-relaxed pl-3">
                            {concept.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Definitions */}
                {studyNotes.definitions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-espresso-500 dark:text-espresso-400">
                      3. Definitions &amp; Terminology
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {studyNotes.definitions.map((def, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 space-y-0.5"
                        >
                          <span className="font-mono text-[10px] uppercase font-bold text-terracotta-600 dark:text-terracotta-400">
                            {def.term}
                          </span>
                          <p className="text-xs text-espresso-600 dark:text-espresso-300">
                            {def.definition}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Formulas & Rules */}
                {studyNotes.formulasOrRules.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-espresso-500 dark:text-espresso-400">
                      4. Formulas, Equations &amp; Rules
                    </h4>
                    <div className="space-y-2">
                      {studyNotes.formulasOrRules.map((f, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 flex items-start gap-2"
                        >
                          <span className="font-mono text-xs font-bold text-espresso-700 dark:text-ivory-200 shrink-0">
                            {f.name}:
                          </span>
                          <span className="font-mono text-xs text-terracotta-600 dark:text-terracotta-400">
                            {f.rule}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null
          ) : (
            /* Input / Transcript Tab */
            <div className="space-y-4">
              {/* Notice regarding YouTube CORS and captions */}
              <div className="p-3.5 rounded-xl border border-ochre-200 dark:border-ochre-900/50 bg-ochre-50/70 dark:bg-ochre-950/30 flex items-start gap-2.5 text-xs text-ochre-900 dark:text-ochre-200">
                <Info className="w-4 h-4 text-ochre-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Transcript &amp; Caption Notes Source</p>
                  <p className="leading-relaxed opacity-90">
                    Direct browser extraction of third-party YouTube transcripts is restricted by YouTube's CORS security policy without an external proxy server. To generate comprehensive, formatted notes with exact definitions and formulas, paste the video's transcript or key lecture points below.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-espresso-800 dark:text-ivory-100 flex items-center justify-between">
                  <span>Lecture Transcript or Summary Text</span>
                  <span className="text-[11px] font-mono text-espresso-400">
                    {transcriptInput.length} chars
                  </span>
                </label>
                <textarea
                  value={transcriptInput}
                  onChange={(e) => setTranscriptInput(e.target.value)}
                  placeholder="Paste lecture transcript, closed captions, or key concepts here... (e.g. Chapter 1 overview, formulas, definitions)"
                  rows={10}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-850 text-espresso-950 dark:text-ivory-50 text-xs font-mono placeholder:text-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleGenerate}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-500 text-white flex items-center gap-1.5 transition shadow-subtle cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Synthesize Study Notes</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

