import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from '../src/context/AppContext';
import { GptTimetableImportModal } from '../src/components/timetable/GptTimetableImportModal';
import {
  preprocessAndParseTimetableJson,
  decodeHtmlEntities,
  stripLineContinuationBackslashes,
  stripBackslashesOutsideStrings,
  findBalancedJsonBlocks,
  extractCandidateJsonString,
} from '../src/utils/timetableJsonSanitizer';
import { loadData } from '../src/services/storage';

const ModalTestHarness: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { state } = useApp();
  return (
    <div>
      <div data-testid="timetable-count">{state.timetable?.length || 0}</div>
      <GptTimetableImportModal isOpen={isOpen} onClose={onClose} />
    </div>
  );
};

describe('GPT Timetable Importer — Sanitizer & Preprocessing Unit Tests', () => {
  it('0. verifies utility functions directly (decodeHtmlEntities, stripLineContinuationBackslashes, stripBackslashesOutsideStrings, findBalancedJsonBlocks, extractCandidateJsonString)', () => {
    // decodeHtmlEntities
    expect(decodeHtmlEntities('&#x20;&quot;hello&quot;&#x20;&nbsp;&lt;world&gt;')).toBe(' "hello"  <world>');
    expect(decodeHtmlEntities('')).toBe('');

    // stripLineContinuationBackslashes
    expect(stripLineContinuationBackslashes('line 1 \\\nline 2 \\\r\nline 3 \\')).toBe('line 1 \nline 2 \nline 3 \n');

    // stripBackslashesOutsideStrings
    expect(stripBackslashesOutsideStrings('\\{ "key": "value \\\\ with \\"escaped\\" quotes" \\}')).toBe(
      '{ "key": "value \\\\ with \\"escaped\\" quotes" }'
    );

    // findBalancedJsonBlocks
    const textWithBraces = 'Text before {"a": 1} middle text {"b": {"c": 2}} text after';
    const blocks = findBalancedJsonBlocks(textWithBraces);
    expect(blocks).toEqual(['{"a": 1}', '{"b": {"c": 2}}']);

    // extractCandidateJsonString
    const candidate = extractCandidateJsonString('```json\n{"format":"student-tracker-timetable"}\n```');
    expect(candidate).toBe('{"format":"student-tracker-timetable"}');
  });

  it('1. parses valid raw JSON directly without modification', () => {
    const raw = JSON.stringify({
      format: 'student-tracker-timetable',
      version: 1,
      classes: [
        {
          subject: 'Operating Systems',
          day: 'Monday',
          startTime: '09:00',
          endTime: '10:15',
          location: 'Lab 201',
        },
      ],
    });

    const parsed = preprocessAndParseTimetableJson(raw);
    expect(parsed.format).toBe('student-tracker-timetable');
    expect(parsed.classes).toHaveLength(1);
    expect(parsed.classes[0].subject).toBe('Operating Systems');
  });

  it('2. extracts and parses JSON inside Markdown code fences with surrounding commentary', () => {
    const markdown = `
Sure thing! Here is your extracted timetable based on the uploaded image:

\`\`\`json
{
  "format": "student-tracker-timetable",
  "version": 1,
  "classes": [
    {
      "subject": "Fluid Mechanics",
      "day": "Wednesday",
      "startTime": "10:30",
      "endTime": "11:45",
      "location": "Room 304",
      "instructor": "Dr. Smith"
    }
  ]
}
\`\`\`

Let me know if you would like me to adjust any room numbers or class timings!
`;

    const parsed = preprocessAndParseTimetableJson(markdown);
    expect(parsed.format).toBe('student-tracker-timetable');
    expect(parsed.classes).toHaveLength(1);
    expect(parsed.classes[0].subject).toBe('Fluid Mechanics');
    expect(parsed.classes[0].day).toBe('Wednesday');
  });

  it('3. normalizes HTML entity artifacts including &#x20;, &nbsp;, and &quot;', () => {
    // Malformed input with &#x20; artifacts on indentation and spacing
    const entityArtifacts = `{
&#x20;&#x20;"format":&#x20;"student-tracker-timetable",
&#x20;&#x20;"version":&#x20;1,
&#x20;&#x20;"classes":&#x20;[
&#x20;&#x20;&#x20;&#x20;{
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"subject":&#x20;"Thermodynamics",
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"day":&#x20;"Friday",
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"startTime":&#x20;"14:00",
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"endTime":&#x20;"15:30",
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"location":&#x20;"Hall&#x20;A"
&#x20;&#x20;&#x20;&#x20;}
&#x20;&#x20;]
}`;

    const parsed = preprocessAndParseTimetableJson(entityArtifacts);
    expect(parsed.format).toBe('student-tracker-timetable');
    expect(parsed.classes).toHaveLength(1);
    expect(parsed.classes[0].subject).toBe('Thermodynamics');
    expect(parsed.classes[0].location).toBe('Hall A');
  });

  it('4. decodes complex mixed HTML entities (&quot;, &nbsp;, &#x20;, &#10;)', () => {
    const mixedEntities = `{
&nbsp;&nbsp;&quot;format&quot;:&nbsp;&quot;student-tracker-timetable&quot;,
&#x20;&#x20;&quot;version&quot;:&#x20;1,
&#x20;&#x20;&quot;classes&quot;:&#x20;[
&#x20;&#x20;&#x20;&#x20;{
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;&quot;subject&quot;:&#x20;&quot;Biochemistry&quot;,
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;&quot;day&quot;:&#x20;&quot;Tuesday&quot;,
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;&quot;startTime&quot;:&#x20;&quot;08:00&quot;,
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;&quot;endTime&quot;:&#x20;&quot;09:15&quot;
&#x20;&#x20;&#x20;&#x20;}
&#x20;&#x20;]
}`;

    const parsed = preprocessAndParseTimetableJson(mixedEntities);
    expect(parsed.format).toBe('student-tracker-timetable');
    expect(parsed.classes[0].subject).toBe('Biochemistry');
  });

  it('5. handles string-quoted JSON with escaped quotes and literal \\n', () => {
    const stringQuoted = `"{\\n  \\"format\\": \\"student-tracker-timetable\\",\\n  \\"version\\": 1,\\n  \\"classes\\": [\\n    {\\n      \\"subject\\": \\"Linear Algebra\\",\\n      \\"day\\": \\"Thursday\\",\\n      \\"startTime\\": \\"11:00\\",\\n      \\"endTime\\": \\"12:15\\"\\n    }\\n  ]\\n}"`;

    const parsed = preprocessAndParseTimetableJson(stringQuoted);
    expect(parsed.format).toBe('student-tracker-timetable');
    expect(parsed.classes[0].subject).toBe('Linear Algebra');
  });

  it('6. handles unquoted text containing escaped quotes \\" and literal \\n without outer string quotes', () => {
    const escapedTextWithoutOuterQuotes = `{\\n  \\"format\\": \\"student-tracker-timetable\\",\\n  \\"version\\": 1,\\n  \\"classes\\": [\\n    {\\n      \\"subject\\": \\"Data Structures\\",\\n      \\"day\\": \\"Monday\\",\\n      \\"startTime\\": \\"13:00\\",\\n      \\"endTime\\": \\"14:30\\"\\n    }\\n  ]\\n}`;

    const parsed = preprocessAndParseTimetableJson(escapedTextWithoutOuterQuotes);
    expect(parsed.format).toBe('student-tracker-timetable');
    expect(parsed.classes[0].subject).toBe('Data Structures');
  });

  it('7. safely handles trailing commas in objects and arrays', () => {
    const trailingCommas = `{
  "format": "student-tracker-timetable",
  "version": 1,
  "classes": [
    {
      "subject": "Microbiology",
      "day": "Friday",
      "startTime": "10:00",
      "endTime": "11:15",
    },
  ],
}`;

    const parsed = preprocessAndParseTimetableJson(trailingCommas);
    expect(parsed.format).toBe('student-tracker-timetable');
    expect(parsed.classes[0].subject).toBe('Microbiology');
  });

  it('8. preserves legitimate escaped characters inside string values', () => {
    const legitimateEscapes = `{
  "format": "student-tracker-timetable",
  "version": 1,
  "classes": [
    {
      "subject": "Advanced Programming",
      "day": "Wednesday",
      "startTime": "14:00",
      "endTime": "16:00",
      "location": "Room 101 \\\\ Lab C",
      "notes": "Bring \\"C++ Primer\\" textbook\\nRead Chapter 4"
    }
  ]
}`;

    const parsed = preprocessAndParseTimetableJson(legitimateEscapes);
    expect(parsed.classes[0].location).toBe('Room 101 \\ Lab C');
    expect(parsed.classes[0].notes).toBe('Bring "C++ Primer" textbook\nRead Chapter 4');
  });

  it('9. extracts a single JSON object from surrounding text without markdown fences', () => {
    const rawText = `
Here is your timetable extracted from the schedule document:
{
  "format": "student-tracker-timetable",
  "version": 1,
  "classes": [
    {
      "subject": "Machine Learning",
      "day": "Tuesday",
      "startTime": "15:00",
      "endTime": "16:30"
    }
  ]
}
Hope this makes studying easier!
`;

    const parsed = preprocessAndParseTimetableJson(rawText);
    expect(parsed.format).toBe('student-tracker-timetable');
    expect(parsed.classes[0].subject).toBe('Machine Learning');
  });

  it('10. throws friendly error on ambiguous input with multiple timetable blocks', () => {
    const ambiguous = `
First version:
{"format":"student-tracker-timetable","version":1,"classes":[{"subject":"Math","day":"Monday","startTime":"09:00","endTime":"10:00"}]}

Second version:
{"format":"student-tracker-timetable","version":1,"classes":[{"subject":"Physics","day":"Tuesday","startTime":"11:00","endTime":"12:00"}]}
`;

    expect(() => preprocessAndParseTimetableJson(ambiguous)).toThrow(
      /Multiple timetable schedules found in pasted text/i
    );
  });

  it('11. throws friendly error on genuinely malformed non-JSON input', () => {
    const broken = 'Hello ChatGPT, please extract my timetable. (No JSON here)';
    expect(() => preprocessAndParseTimetableJson(broken)).toThrow(/Invalid JSON format/i);
  });

  it('12. throws friendly error on empty or whitespace input', () => {
    expect(() => preprocessAndParseTimetableJson('')).toThrow(/Please paste the JSON/i);
    expect(() => preprocessAndParseTimetableJson('   \n  \t  ')).toThrow(/Please paste the JSON/i);
  });

  it('13. REGRESSION: parses exact user input containing &#x20; indentation and trailing backslashes', () => {
    const malformedInput = `{ \\
&#x20;&#x20;"format": "student-tracker-timetable", \\
&#x20;&#x20;"version": 1, \\
&#x20;&#x20;"classes": [ \\
&#x20;&#x20;&#x20;&#x20;{ \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"subject": "Fluid Mechanics", \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"day": "Wednesday", \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"startTime": "10:30", \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"endTime": "11:45", \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"location": "Room 304", \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"instructor": "Dr. Smith" \\
&#x20;&#x20;&#x20;&#x20;} \\
&#x20;&#x20;] \\
}`;

    const parsed = preprocessAndParseTimetableJson(malformedInput);
    expect(parsed.format).toBe('student-tracker-timetable');
    expect(parsed.classes).toHaveLength(1);
    expect(parsed.classes[0].subject).toBe('Fluid Mechanics');
    expect(parsed.classes[0].day).toBe('Wednesday');
    expect(parsed.classes[0].startTime).toBe('10:30');
    expect(parsed.classes[0].endTime).toBe('11:45');
    expect(parsed.classes[0].location).toBe('Room 304');
    expect(parsed.classes[0].instructor).toBe('Dr. Smith');
  });

  it('14. REGRESSION: handles trailing backslashes attached directly to characters without spaces', () => {
    const inputWithDirectTrailingSlashes = `{
&#x20;&#x20;"format": "student-tracker-timetable",\\
&#x20;&#x20;"version": 1,\\
&#x20;&#x20;"classes": [\\
&#x20;&#x20;&#x20;&#x20;{\\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"subject": "Engineering Thermodynamics",\\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"day": "Thursday",\\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"startTime": "14:00",\\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"endTime": "15:30"\\
&#x20;&#x20;&#x20;&#x20;}\\
&#x20;&#x20;]\\
}`;

    const parsed = preprocessAndParseTimetableJson(inputWithDirectTrailingSlashes);
    expect(parsed.format).toBe('student-tracker-timetable');
    expect(parsed.classes).toHaveLength(1);
    expect(parsed.classes[0].subject).toBe('Engineering Thermodynamics');
    expect(parsed.classes[0].day).toBe('Thursday');
  });

  it('15. REGRESSION: handles markdown code fences with trailing backslashes and commentary', () => {
    const inputInFences = `
Here is your timetable schedule:

\`\`\`json \\
{ \\
&#x20;&#x20;"format": "student-tracker-timetable", \\
&#x20;&#x20;"version": 1, \\
&#x20;&#x20;"classes": [ \\
&#x20;&#x20;&#x20;&#x20;{ \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"subject": "Structural Analysis", \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"day": "Friday", \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"startTime": "08:30", \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"endTime": "10:00" \\
&#x20;&#x20;&#x20;&#x20;} \\
&#x20;&#x20;] \\
} \\
\`\`\`

Let me know if you need any adjustments!
`;

    const parsed = preprocessAndParseTimetableJson(inputInFences);
    expect(parsed.format).toBe('student-tracker-timetable');
    expect(parsed.classes).toHaveLength(1);
    expect(parsed.classes[0].subject).toBe('Structural Analysis');
    expect(parsed.classes[0].startTime).toBe('08:30');
  });

  it('16. REGRESSION: strips markdown-escaped structural braces and brackets while preserving internal escapes', () => {
    const inputWithEscapedBraces = `\\{
  "format": "student-tracker-timetable",
  "version": 1,
  "classes": \\[
    \\{
      "subject": "Applied Chemistry",
      "day": "Monday",
      "startTime": "09:00",
      "endTime": "10:15",
      "location": "Lab 101 \\\\ Room B",
      "notes": "Bring \\"Organic Chemistry\\" textbook"
    \\}
  \\]
\\}`;

    const parsed = preprocessAndParseTimetableJson(inputWithEscapedBraces);
    expect(parsed.format).toBe('student-tracker-timetable');
    expect(parsed.classes).toHaveLength(1);
    expect(parsed.classes[0].subject).toBe('Applied Chemistry');
    expect(parsed.classes[0].location).toBe('Lab 101 \\ Room B');
    expect(parsed.classes[0].notes).toBe('Bring "Organic Chemistry" textbook');
  });
});

describe('GPT Timetable Importer — UI Modal Integration Workflow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders modal with prompt copy button and clean initial state', () => {
    render(
      <AppProvider>
        <ModalTestHarness isOpen={true} onClose={() => {}} />
      </AppProvider>
    );

    expect(screen.getByRole('heading', { name: /GPT Timetable Importer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy chatgpt prompt/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/student-tracker-timetable/i)).toBeInTheDocument();
  });

  it('reproduces and resolves the &#x20; artifact issue via modal UI', async () => {
    render(
      <AppProvider>
        <ModalTestHarness isOpen={true} onClose={() => {}} />
      </AppProvider>
    );

    const textarea = screen.getByPlaceholderText(/student-tracker-timetable/i);
    const validateBtn = screen.getByRole('button', { name: /validate & preview/i });

    // Pasted input containing &#x20; artifacts
    const inputWithArtifacts = `{
&#x20;&#x20;"format":&#x20;"student-tracker-timetable",
&#x20;&#x20;"version":&#x20;1,
&#x20;&#x20;"classes":&#x20;[
&#x20;&#x20;&#x20;&#x20;{
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"subject":&#x20;"Fluid Mechanics",
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"day":&#x20;"Wednesday",
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"startTime":&#x20;"09:00",
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"endTime":&#x20;"10:15",
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"location":&#x20;"Room&#x20;304"
&#x20;&#x20;&#x20;&#x20;}
&#x20;&#x20;]
}`;

    fireEvent.change(textarea, { target: { value: inputWithArtifacts } });
    fireEvent.click(validateBtn);

    // Should successfully validate and display the preview table
    await waitFor(() => {
      expect(screen.getByText(/Preview: 1 Classes Ready to Import/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Fluid Mechanics')).toBeInTheDocument();
    expect(screen.getByText('Room 304')).toBeInTheDocument();

    // Confirm import
    const importSubmitBtn = screen.getByRole('button', { name: /import 1 classes/i });
    fireEvent.click(importSubmitBtn);

    // Verify confirmation and storage persistence
    await waitFor(() => {
      expect(screen.getByText(/successfully imported 1 class/i)).toBeInTheDocument();
    });

    const stored = loadData();
    const importedSlot = stored.timetable.find(
      (s) => s.startTime === '09:00' && s.endTime === '10:15'
    );
    expect(importedSlot).toBeDefined();
    expect(importedSlot?.dayOfWeek).toBe(3); // Wednesday
    expect(importedSlot?.room).toBe('Room 304');
  });

  it('handles markdown-fenced input with commentary in modal UI', async () => {
    render(
      <AppProvider>
        <ModalTestHarness isOpen={true} onClose={() => {}} />
      </AppProvider>
    );

    const textarea = screen.getByPlaceholderText(/student-tracker-timetable/i);
    const validateBtn = screen.getByRole('button', { name: /validate & preview/i });

    const markdownInput = `
Here is your timetable extracted from the schedule document:

\`\`\`json
{
  "format": "student-tracker-timetable",
  "version": 1,
  "classes": [
    {
      "subject": "Data Structures",
      "day": "Monday",
      "startTime": "11:00",
      "endTime": "12:30",
      "location": "LH-3",
      "instructor": "Prof. Alan"
    }
  ]
}
\`\`\`

Hope this is helpful!
`;

    fireEvent.change(textarea, { target: { value: markdownInput } });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(screen.getByText(/Preview: 1 Classes Ready to Import/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Data Structures')).toBeInTheDocument();
    expect(screen.getByText('LH-3')).toBeInTheDocument();
  });

  it('shows user-friendly error message when pasted text is malformed or invalid schema', async () => {
    render(
      <AppProvider>
        <ModalTestHarness isOpen={true} onClose={() => {}} />
      </AppProvider>
    );

    const textarea = screen.getByPlaceholderText(/student-tracker-timetable/i);
    const validateBtn = screen.getByRole('button', { name: /validate & preview/i });

    // 1. Broken JSON syntax
    fireEvent.change(textarea, { target: { value: '{ "format": "broken" ' } });
    fireEvent.click(validateBtn);
    expect(
      screen.getByText(/Invalid JSON format\. Please verify that you copied the complete JSON block/i)
    ).toBeInTheDocument();

    // 2. Missing format identifier
    fireEvent.change(textarea, { target: { value: JSON.stringify({ classes: [] }) } });
    fireEvent.click(validateBtn);
    expect(screen.getByText(/Expected format: "student-tracker-timetable"/i)).toBeInTheDocument();

    // 3. Empty classes array
    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify({ format: 'student-tracker-timetable', version: 1, classes: [] }),
      },
    });
    fireEvent.click(validateBtn);
    expect(screen.getByText(/The "classes" array is empty/i)).toBeInTheDocument();
  });

  it('successfully imports timetable from pasted input containing &#x20; entities and trailing backslashes in modal UI', async () => {
    render(
      <AppProvider>
        <ModalTestHarness isOpen={true} onClose={() => {}} />
      </AppProvider>
    );

    const textarea = screen.getByPlaceholderText(/student-tracker-timetable/i);
    const validateBtn = screen.getByRole('button', { name: /validate & preview/i });

    const inputWithSlashesAndEntities = `{ \\
&#x20;&#x20;"format": "student-tracker-timetable", \\
&#x20;&#x20;"version": 1, \\
&#x20;&#x20;"classes": [ \\
&#x20;&#x20;&#x20;&#x20;{ \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"subject": "Fluid Mechanics", \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"day": "Wednesday", \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"startTime": "10:30", \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"endTime": "11:45", \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"location": "Room 304", \\
&#x20;&#x20;&#x20;&#x20;&#x20;&#x20;"instructor": "Dr. Smith" \\
&#x20;&#x20;&#x20;&#x20;} \\
&#x20;&#x20;] \\
}`;

    fireEvent.change(textarea, { target: { value: inputWithSlashesAndEntities } });
    fireEvent.click(validateBtn);

    // Should succeed and show preview table with correct details
    await waitFor(() => {
      expect(screen.getByText(/Preview: 1 Classes Ready to Import/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Fluid Mechanics')).toBeInTheDocument();
    expect(screen.getByText('Room 304')).toBeInTheDocument();

    // Confirm import
    const importSubmitBtn = screen.getByRole('button', { name: /import 1 classes/i });
    fireEvent.click(importSubmitBtn);

    await waitFor(() => {
      expect(screen.getByText(/successfully imported 1 class/i)).toBeInTheDocument();
    });

    const stored = loadData();
    const importedSlot = stored.timetable.find(
      (s) => s.startTime === '10:30' && s.endTime === '11:45'
    );
    expect(importedSlot).toBeDefined();
    expect(importedSlot?.dayOfWeek).toBe(3); // Wednesday
    expect(importedSlot?.room).toBe('Room 304');
    expect(importedSlot?.instructor).toBe('Dr. Smith');
  });
});
