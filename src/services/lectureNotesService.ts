export interface StudyConcept {
  title: string;
  description: string;
}

export interface StudyDefinition {
  term: string;
  definition: string;
}

export interface StudyFormula {
  name: string;
  rule: string;
}

export interface LectureStudyNotes {
  id: string;
  lectureId?: string;
  courseTitle: string;
  lectureTitle: string;
  sourceUrl: string;
  generatedAt: string;
  keyConcepts: StudyConcept[];
  definitions: StudyDefinition[];
  formulasOrRules: StudyFormula[];
  summary: string;
  rawNotesText?: string;
}

/**
 * Intelligent client-side note synthesizer:
 * Parses text/transcripts into well-structured academic notes:
 * - Headings & Key Concepts
 * - Term definitions
 * - Formulas & Rules
 * - Concise summary
 */
export function generateNotesFromContent(
  courseTitle: string,
  lectureTitle: string,
  sourceUrl: string,
  content: string,
  lectureId?: string
): LectureStudyNotes {
  const trimmed = content.trim();

  // If student provided minimal or empty text, generate an organized outline skeleton
  if (!trimmed) {
    return {
      id: `notes_${Date.now()}`,
      lectureId,
      courseTitle,
      lectureTitle,
      sourceUrl,
      generatedAt: new Date().toISOString(),
      keyConcepts: [
        {
          title: 'Core Lecture Overview',
          description: `Key foundational principles and theoretical discussions presented in ${lectureTitle}.`,
        },
      ],
      definitions: [
        {
          term: 'Fundamental Principle',
          definition: 'Primary rule or law upon which the lecture topic is structured.',
        },
      ],
      formulasOrRules: [
        {
          name: 'Core Relationship',
          rule: 'Ensure all inputs match standard dimensional units before computing results.',
        },
      ],
      summary: `Comprehensive academic study notes for "${lectureTitle}" (${courseTitle}). Review key formulas and conceptual definitions prior to exam assessments.`,
    };
  }

  // Segment paragraphs
  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const keyConcepts: StudyConcept[] = [];
  const definitions: StudyDefinition[] = [];
  const formulasOrRules: StudyFormula[] = [];

  // Extract candidate definitions (lines containing ": " or " is defined as " or " refers to ")
  paragraphs.forEach((p, idx) => {
    const lines = p.split('\n').map((l) => l.trim()).filter(Boolean);

    lines.forEach((line) => {
      // Check for definitions
      const defMatch = line.match(/^([A-Za-z0-9\s—–_-]{3,40})(?:\s*[:=]|\s+is defined as|\s+refers to)\s+(.+)$/i);
      if (defMatch && defMatch[1] && defMatch[2] && defMatch[2].length > 10) {
        definitions.push({
          term: defMatch[1].trim(),
          definition: defMatch[2].trim(),
        });
        return;
      }

      // Check for formulas or rules
      const formulaMatch = line.match(/(?:formula|equation|rule|law|theorem):\s*(.+)/i) ||
                           line.match(/^([A-Za-z\s]+)\s*=\s*(.+)$/);
      if (formulaMatch && formulaMatch[1]) {
        formulasOrRules.push({
          name: `Rule ${formulasOrRules.length + 1}: ${formulaMatch[1].trim()}`,
          rule: (formulaMatch[2] || line).trim(),
        });
        return;
      }
    });

    // Treat substantial paragraphs as key concepts
    if (p.length > 40 && keyConcepts.length < 6) {
      const firstSentence = p.split(/[.?!]\s/)[0] || `Key Concept ${idx + 1}`;
      const title = firstSentence.length > 50 ? `${firstSentence.substring(0, 47)}...` : firstSentence;
      keyConcepts.push({
        title,
        description: p,
      });
    }
  });

  // Fallbacks if input had no specific definition syntax
  if (keyConcepts.length === 0) {
    keyConcepts.push({
      title: 'Primary Discussion',
      description: paragraphs[0] || trimmed.substring(0, 300),
    });
  }

  if (definitions.length === 0) {
    definitions.push({
      term: 'Primary Concept',
      definition: `Fundamental concept examined throughout the lecture "${lectureTitle}".`,
    });
  }

  if (formulasOrRules.length === 0) {
    formulasOrRules.push({
      name: 'Essential Rule',
      rule: 'Verify assumptions and boundary conditions when analyzing this system.',
    });
  }

  // Create summary from first and last points
  const summary = paragraphs.length > 1
    ? `${paragraphs[0].substring(0, 200)}... In conclusion, review the definitions and concepts above to reinforce mastery.`
    : `Summary of ${lectureTitle}: Covers core curriculum requirements, practical examples, and examination preparation notes.`;

  return {
    id: `notes_${Date.now()}`,
    lectureId,
    courseTitle,
    lectureTitle,
    sourceUrl,
    generatedAt: new Date().toISOString(),
    keyConcepts,
    definitions,
    formulasOrRules,
    summary,
    rawNotesText: trimmed,
  };
}

