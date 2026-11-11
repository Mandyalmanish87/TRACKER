import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  X,
  Upload,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SyllabusImportPayload } from '../../types';
import { preprocessAndParseSyllabusJson } from '../../utils/syllabusJsonSanitizer';
import { useEntitlements } from '../../hooks/useEntitlements';
import { ProFeatureGate } from '../common/ProFeatureGate';

interface GptSyllabusImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHATGPT_SYLLABUS_PROMPT_TEMPLATE = `I am providing my college course syllabus document or text.
Act as a careful syllabus structure checker before creating JSON. First identify whether this document contains one course or several courses inside a degree, year, semester, or program syllabus. A program title is NOT a course subject. Each actual course (for example, Linear Algebra or Introduction to C) must be a separate item in "subjects". Within each course, put only its real units/chapters/modules in "chapters". Put the smaller syllabus items listed under each chapter in "topics".

Return ONLY a raw, valid JSON object following this exact schema:

{
  "schemaVersion": 2,
  "programTitle": "Optional degree, year, or semester title",
  "subjects": [
    {
      "name": "Actual Course or Subject Name",
      "code": "Optional course code",
      "chapters": [
        {
          "name": "A real chapter, unit, or module within this course",
          "estimatedLectures": 8,
          "importance": "High",
          "topics": [
            {
              "name": "A topic listed inside this chapter",
              "estimatedLectures": 2,
              "importance": "High"
            }
          ]
        }
      ]
    }
  ]
}

HIERARCHY CHECK — do this before returning JSON:
1. Every entry in "subjects" is a teachable course, not the degree/program/year heading. If the document has one course, still return it as the only item in the "subjects" array.
2. Every "chapters" entry is a unit/chapter/module belonging to that course. Do not put course names such as "Linear Algebra" or "Introduction to C" in a course's chapters list when they are separate courses in the source document.
3. Every "topics" entry is a smaller item under its chapter. Never promote a topic to a chapter or demote a chapter to a topic.
4. Keep the source's order and wording. Do not invent hierarchy or missing content. If headings are ambiguous, use the nearest explicit course/unit headings and do not guess.
5. This tracker supports exactly three levels: subject → chapter → topic. Do not create a "subtopics" level or move topics into it.
6. Before output, verify each course has its own chapters and each topic is nested under the chapter where it appears.

FIELD RULES:
1. "schemaVersion" must be 2.
2. "importance" must be exactly one of: "High", "Medium", or "Low". Label it as an academic estimate, never as guaranteed exam weightage.
3. "estimatedLectures" must be a non-negative integer or omitted if unknown. Treat lecture counts as estimates.
4. Preserve original course, chapter, and topic terminology. Omit uncertain fields instead of guessing.
5. Output ONLY valid JSON without markdown fences or additional commentary.`;

export const GptSyllabusImportModal: React.FC<GptSyllabusImportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { state, importSyllabus } = useApp();
  const { canAccess } = useEntitlements();
  const hasAccess = canAccess('ai_study_planner');

  const [jsonInput, setJsonInput] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [selectedTargetSubjectId, setSelectedTargetSubjectId] = useState<string>('new');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsedPayload, setParsedPayload] = useState<SyllabusImportPayload | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  const [importResult, setImportResult] = useState<{ chapters: number; topics: number; subjects: string[] } | null>(null);

  if (!isOpen) return null;

  const existingSubjects = state.syllabusSubjects || [];
  const importSubjects = parsedPayload?.subjects ?? (parsedPayload?.subject ? [parsedPayload.subject] : []);
  const isMultiSubjectImport = importSubjects.length > 1;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CHATGPT_SYLLABUS_PROMPT_TEMPLATE);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    }
  };

  const handleValidate = () => {
    setValidationError(null);
    setWarnings([]);
    setParsedPayload(null);
    setIsValidated(false);
    setImportResult(null);

    const trimmed = jsonInput.trim();
    if (!trimmed) {
      setValidationError('Please paste the JSON syllabus generated by ChatGPT into the text area.');
      return;
    }

    let payload: any;
    try {
      payload = preprocessAndParseSyllabusJson(trimmed);
    } catch (err: any) {
      setValidationError(`Invalid JSON syntax: ${err.message}. Please check your pasted text.`);
      return;
    }

    if (!payload || typeof payload !== 'object') {
      setValidationError('Expected a root JSON object.');
      return;
    }

    const schemaVersion = payload.schemaVersion ?? payload.version;
    if (schemaVersion !== 1 && schemaVersion !== 2) {
      setValidationError('Unsupported schema version. Copy the current TRAKIFY syllabus prompt and use schemaVersion 2.');
      return;
    }

    const rawSubjects = Array.isArray(payload.subjects)
      ? payload.subjects
      : payload.subject && typeof payload.subject === 'object'
        ? [payload.subject]
        : [];

    if (rawSubjects.length === 0) {
      setValidationError('No course subjects found. Use a "subjects" array, with each course containing its own chapters and topics.');
      return;
    }

    const currentWarnings: string[] = [];
    const validSubjects: NonNullable<SyllabusImportPayload['subjects']> = [];
    rawSubjects.forEach((rawSubject: any, sIdx: number) => {
      const subjectName = String(rawSubject?.name || rawSubject?.courseName || '').trim();
      if (!subjectName) {
        currentWarnings.push(`Course #${sIdx + 1} has no course name and was skipped.`);
        return;
      }
      if (/\b(syllabus|curriculum|first|second|third|fourth)\s+(year|semester)\b|\b(b\.?\s?tech|degree)\s+syllabus\b/i.test(subjectName)) {
        currentWarnings.push(`"${subjectName}" looks like a program/year heading rather than a course. Check the Structure Preview before importing; each actual course should be a separate subject.`);
      }
      const rawChapters = Array.isArray(rawSubject?.chapters)
        ? rawSubject.chapters
        : Array.isArray(rawSubject?.units)
          ? rawSubject.units
          : Array.isArray(rawSubject?.modules)
            ? rawSubject.modules
            : [];
      if (rawChapters.length === 0) {
        currentWarnings.push(`"${subjectName}" has no chapters/units and was skipped.`);
        return;
      }

      const validChapters: NonNullable<SyllabusImportPayload['subject']>['chapters'] = [];
      rawChapters.forEach((chap: any, cIdx: number) => {
        const cName = String(chap?.name || chap?.title || '').trim();
        if (!cName) {
          currentWarnings.push(`Course "${subjectName}", chapter #${cIdx + 1} has no name and was skipped.`);
          return;
        }
        const validTopics: NonNullable<SyllabusImportPayload['subject']>['chapters'][number]['topics'] = [];
        const topicsArr = Array.isArray(chap?.topics) ? chap.topics : [];
        topicsArr.forEach((top: any, tIdx: number) => {
          const tName = String(typeof top === 'string' ? top : top?.name || top?.title || '').trim();
          if (!tName) {
            currentWarnings.push(`"${cName}" topic #${tIdx + 1} has no name and was skipped.`);
            return;
          }
          const importanceVal = ['High', 'Medium', 'Low'].includes(top?.importance) ? top.importance : undefined;
          const estLectures = typeof top?.estimatedLectures === 'number' && top.estimatedLectures >= 0 ? top.estimatedLectures : undefined;
          validTopics.push({ name: tName, estimatedLectures: estLectures, importance: importanceVal });
          if (Array.isArray(top?.subtopics) && top.subtopics.length > 0) {
            currentWarnings.push(`"${tName}" contains nested subtopics. TRAKIFY has three tracked levels; nested items are retained in the topic notes. Copy the updated prompt to keep every topic at the correct level.`);
          }
        });
        const chapImportance = ['High', 'Medium', 'Low'].includes(chap?.importance) ? chap.importance : undefined;
        const chapLectures = typeof chap?.estimatedLectures === 'number' && chap.estimatedLectures >= 0 ? chap.estimatedLectures : undefined;
        validChapters.push({ name: cName, estimatedLectures: chapLectures, importance: chapImportance, topics: validTopics });
      });
      if (validChapters.length > 0) {
        validSubjects.push({ name: subjectName, code: rawSubject.code ? String(rawSubject.code) : undefined, chapters: validChapters });
      }
    });

    if (validSubjects.length === 0) {
      setValidationError('No valid courses and chapters were found. Each course needs a name and at least one chapter or unit.');
      setWarnings(currentWarnings);
      return;
    }

    validSubjects.forEach((validSubject) => {
      const matchingSubject = existingSubjects.find((s) => s.name.toLowerCase() === validSubject.name.toLowerCase());
      if (matchingSubject && (validSubjects.length > 1 || selectedTargetSubjectId === 'new')) {
        currentWarnings.push(`"${matchingSubject.name}" already exists. Its matching chapters and topics will be safely merged.`);
      }
    });
    if (validSubjects.length > 1) {
      currentWarnings.unshift(`Structure check: found ${validSubjects.length} separate courses. Each will be imported as its own subject; the target selector applies only to a single-course import.`);
    }

    const validated: SyllabusImportPayload = {
      schemaVersion: 2,
      programTitle: typeof payload.programTitle === 'string' ? payload.programTitle : undefined,
      subjects: validSubjects,
    };

    setParsedPayload(validated);
    setWarnings(currentWarnings);
    setIsValidated(true);
  };

  const handleConfirmImport = () => {
    if (!parsedPayload) return;

    const subjectsToImport = parsedPayload.subjects ?? (parsedPayload.subject ? [parsedPayload.subject] : []);
    if (subjectsToImport.length === 0) return;
    const targetId = subjectsToImport.length === 1 && selectedTargetSubjectId !== 'new'
      ? selectedTargetSubjectId
      : undefined;
    const results = subjectsToImport.map((subject) => importSyllabus({ schemaVersion: 1, subject }, targetId));
    setImportResult({
      chapters: results.reduce((sum, result) => sum + result.chaptersAdded, 0),
      topics: results.reduce((sum, result) => sum + result.topicsAdded, 0),
      subjects: subjectsToImport.map((subject) => subject.name),
    });
    setIsValidated(false);
  };

  const handleReset = () => {
    setJsonInput('');
    setValidationError(null);
    setWarnings([]);
    setParsedPayload(null);
    setIsValidated(false);
    setImportResult(null);
    setSelectedTargetSubjectId('new');
  };

  return createPortal((
    <div className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-espresso-950/50 backdrop-blur-sm overflow-y-auto overscroll-contain">
      <div className="w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] flex flex-col bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-ivory-300 dark:border-espresso-800 flex items-center justify-between bg-ivory-50/70 dark:bg-espresso-850 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-terracotta-100 dark:bg-terracotta-900/40 text-terracotta-700 dark:text-terracotta-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-espresso-950 dark:text-ivory-50">
                Import Syllabus with GPT
              </h2>
              <p className="text-xs text-espresso-500 dark:text-espresso-400">
                Copy prompt → Upload syllabus to ChatGPT → Paste structured curriculum JSON here
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        {!hasAccess ? (
          <div className="p-6">
            <ProFeatureGate featureKey="ai_study_planner" onUpgradeClick={onClose} />
          </div>
        ) : (
          <>
            <div className="p-4 sm:p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
              {/* Success Banner */}
          {importResult && (
            <div className="p-4 rounded-xl bg-sage-50 dark:bg-sage-900/30 border border-sage-200 dark:border-sage-800/50 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-sage-600 dark:text-sage-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-sage-900 dark:text-sage-100">
                  Syllabus Imported Successfully!
                </h4>
                <p className="text-xs text-sage-700 dark:text-sage-300 mt-0.5">
                  Imported <span className="font-bold">{importResult.subjects.length} course{importResult.subjects.length === 1 ? '' : 's'}</span>,{' '}
                  <span className="font-bold">{importResult.chapters} chapters</span>, and{' '}
                  <span className="font-bold">{importResult.topics} topics</span>: {importResult.subjects.join(', ')}.
                  Existing notes and progress were completely preserved.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={onClose}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sage-600 text-white hover:bg-sage-700 transition"
                  >
                    View in Syllabus Tracker
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-sage-800 dark:text-sage-200 hover:underline"
                  >
                    Import Another Course
                  </button>
                </div>
              </div>
            </div>
          )}

          {!importResult && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Step 1: Destination Subject */}
              <div className="p-3.5 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-ivory-50/60 dark:bg-espresso-850/60 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-espresso-200 dark:bg-espresso-700 text-espresso-700 dark:text-ivory-200">
                    Step 1
                  </span>
                  <h3 className="text-xs font-semibold uppercase font-mono tracking-wider text-espresso-700 dark:text-espresso-300">
                    Target Subject Selection
                  </h3>
                </div>
                <div>
                  {isMultiSubjectImport ? (
                    <p className="rounded-lg border border-sage-200 dark:border-sage-800 bg-white/70 dark:bg-espresso-900/60 px-3 py-2 text-xs text-espresso-600 dark:text-espresso-300">
                      {importSubjects.length} courses detected. Each course will merge by its own name or be created separately.
                    </p>
                  ) : <>
                    <label className="block text-xs font-medium text-espresso-600 dark:text-espresso-300 mb-1">
                      Merge this course into an existing subject or create it from JSON:
                    </label>
                    <select
                      value={selectedTargetSubjectId}
                      onChange={(e) => setSelectedTargetSubjectId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-xs text-espresso-950 dark:text-ivory-50"
                    >
                      <option value="new">+ Create or match JSON course name</option>
                      {existingSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          Merge into: {s.name} ({s.chapters.length} chapters)
                        </option>
                      ))}
                    </select>
                  </>}
                </div>
                {!isMultiSubjectImport && <p className="text-[11px] text-espresso-500 dark:text-espresso-400">For a combined degree/year syllabus, the updated prompt separates each course automatically.</p>}
              </div>

              {/* Step 2: Copy ChatGPT Prompt */}
              <div className="p-3.5 rounded-xl border border-ivory-200 dark:border-espresso-750 bg-ivory-50/60 dark:bg-espresso-850/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-espresso-200 dark:bg-espresso-700 text-espresso-700 dark:text-ivory-200">
                      Step 2
                    </span>
                    <h3 className="text-sm font-semibold text-espresso-950 dark:text-ivory-50 mt-1">
                      Copy Prompt for ChatGPT
                    </h3>
                  </div>
                  <button
                    onClick={handleCopyPrompt}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-espresso-800 border border-ivory-300 dark:border-espresso-700 text-espresso-800 dark:text-ivory-100 hover:bg-ivory-100 shadow-subtle shrink-0"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-sage-600" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy ChatGPT Syllabus Prompt
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-espresso-500 dark:text-espresso-400 leading-relaxed">
                  Paste this prompt into ChatGPT with your syllabus. It checks course → chapter → topic levels before creating JSON.
                </p>
              </div>
              </div>

              {/* Step 3: Paste Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-espresso-200 dark:bg-espresso-700 text-espresso-700 dark:text-ivory-200">
                      Step 3
                    </span>
                    <label className="text-xs font-semibold uppercase font-mono tracking-wider text-espresso-700 dark:text-espresso-300">
                      Paste ChatGPT Syllabus JSON
                    </label>
                  </div>
                  {jsonInput && (
                    <button
                      onClick={() => setJsonInput('')}
                      className="text-[11px] text-espresso-400 hover:text-espresso-600"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <textarea
                  rows={4}
                  value={jsonInput}
                  onChange={(e) => {
                    setJsonInput(e.target.value);
                    setIsValidated(false);
                    setValidationError(null);
                  }}
                  placeholder='{\n  "schemaVersion": 2,\n  "programTitle": "First Year BTech",\n  "subjects": [\n    {\n      "name": "Linear Algebra",\n      "chapters": [\n        { "name": "Matrices", "topics": [{ "name": "Rank" }] }\n      ]\n    },\n    {\n      "name": "Introduction to C",\n      "chapters": [\n        { "name": "Control Flow", "topics": [{ "name": "Loops" }] }\n      ]\n    }\n  ]\n}'
                  className="w-full px-3.5 py-2.5 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50 dark:bg-espresso-850 font-mono text-xs text-espresso-950 dark:text-ivory-50 placeholder:text-espresso-400 dark:placeholder:text-espresso-600 focus:outline-none focus:ring-2 focus:ring-terracotta-400 resize-y"
                />
              </div>

              {/* Validation Feedback */}
              {validationError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{validationError}</span>
                </div>
              )}

              {warnings.length > 0 && (
                <div className="p-3.5 rounded-xl bg-ochre-50 dark:bg-ochre-950/30 border border-ochre-200 dark:border-ochre-900/40 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-ochre-800 dark:text-ochre-200">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Syllabus Notice / Warnings ({warnings.length}):</span>
                  </div>
                  <ul className="text-[11px] text-ochre-700 dark:text-ochre-300 list-disc list-inside space-y-0.5">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Step 4: Preview */}
              {isValidated && parsedPayload && (
                <div className="space-y-3 border-t border-ivory-200 dark:border-espresso-800 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-sage-200 dark:bg-sage-800 text-sage-800 dark:text-sage-200">
                        Step 4
                      </span>
                      <h4 className="text-xs font-semibold text-espresso-900 dark:text-ivory-100 uppercase tracking-wider font-mono">
                        Structure check: {importSubjects.length} course{importSubjects.length === 1 ? '' : 's'}, {importSubjects.reduce((sum, subject) => sum + subject.chapters.length, 0)} chapters
                      </h4>
                    </div>
                  </div>
                  {parsedPayload.programTitle && <p className="text-[11px] text-espresso-500 dark:text-espresso-400">Program: {parsedPayload.programTitle}</p>}
                  <div className="max-h-56 overflow-y-auto border border-ivory-200 dark:border-espresso-750 rounded-xl divide-y divide-ivory-100 dark:divide-espresso-800 bg-white dark:bg-espresso-850 p-2 space-y-2">
                    {importSubjects.map((subject, sIdx) => (
                      <section key={`${subject.name}-${sIdx}`} className="p-2 space-y-1.5">
                        <h5 className="text-xs font-bold text-terracotta-700 dark:text-terracotta-300">Course: {subject.name}</h5>
                        {subject.chapters.map((chap, cIdx) => (
                          <div key={`${chap.name}-${cIdx}`} className="pl-2 border-l-2 border-ivory-300 dark:border-espresso-700 py-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-serif font-bold text-xs text-espresso-950 dark:text-ivory-50">Chapter: {chap.name}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                {chap.estimatedLectures !== undefined && <span className="text-[10px] font-mono text-espresso-500">~{chap.estimatedLectures} lecs</span>}
                                {chap.importance && <span className="text-[10px] font-mono text-espresso-500">{chap.importance}</span>}
                              </div>
                            </div>
                            <ul className="pl-3 mt-1 space-y-0.5">
                              {chap.topics.map((top, tIdx) => <li key={`${top.name}-${tIdx}`} className="text-[11px] text-espresso-700 dark:text-ivory-200">Topic: {top.name}</li>)}
                            </ul>
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!importResult && (
          <div className="p-4 border-t border-ivory-300 dark:border-espresso-800 bg-ivory-50/70 dark:bg-espresso-850 flex items-center justify-between gap-3 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-ivory-300 dark:border-espresso-700 text-espresso-600 dark:text-espresso-300 hover:bg-ivory-100"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {!isValidated ? (
                <button
                  onClick={handleValidate}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-subtle hover:opacity-95 transition flex items-center gap-1.5"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <Check className="w-3.5 h-3.5" /> Validate & Preview
                </button>
              ) : (
                <button
                  onClick={handleConfirmImport}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-subtle hover:opacity-95 transition flex items-center gap-1.5"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <Upload className="w-3.5 h-3.5" /> Confirm & Import Syllabus
                </button>
              )}
            </div>
          </div>
        )}
      </>
    )}
  </div>
</div>
  ), document.body);
};
