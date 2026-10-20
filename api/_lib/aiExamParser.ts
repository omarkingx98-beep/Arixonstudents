import { GoogleGenAI } from '@google/genai';

export interface ParsedOption {
  id: string; // e.g. "option_1"
  label: string; // e.g. "أ" or "A"
  text: string;
}

export interface ParsedQuestion {
  number: number;
  type: 'multiple_choice';
  questionText: string;
  options: ParsedOption[];
  correctOptionId: string;
  hint: string;
  explanation: string;
  marks: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface ParsedExamData {
  title: string;
  subject: string;
  subjectNameAr: string;
  grade: string;
  curriculum: string;
  lesson: string;
  description: string;
  language: string;
  difficulty: 'easy' | 'medium' | 'hard';
  durationMinutes: number;
  totalQuestions: number;
  marksPerQuestion: number;
  totalMarks: number;
}

export interface ExamImportResult {
  exam: ParsedExamData;
  questions: ParsedQuestion[];
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

/**
 * Clean and repair JSON string
 */
function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

/**
 * Parses raw exam text using Gemini strictly as a Parser & Normalizer
 * Does NOT invent questions, answers, hints, or explanations.
 */
export async function parseRawExamWithGemini(
  ai: GoogleGenAI,
  rawText: string
): Promise<ExamImportResult> {
  const prompt = `You are an expert, strict Educational Exam Parser and Normalizer for the Arixon High-School platform (Tawjihi 2009).
Your ONLY mission is to parse, extract, normalize, and organize the EXACT provided raw exam text into standard structured JSON.

MANDATORY RULES:
1. STRICT PARSING ONLY (NO INVENTION / NO HALLUCINATION):
   - You must NOT invent any new questions.
   - You must NOT alter or reword the original question text.
   - You must NOT invent or change options, answers, hints, or explanations.
   - Use only what is explicitly in the user's text.
2. NORMALIZE OPTIONS & LABELS:
   - Handle Arabic labels (أ، ب، ج، د), English labels (A, B, C, D), numbers (1, 2, 3, 4), or bullet points.
   - Each option MUST have:
     - id: "option_1", "option_2", "option_3", "option_4"
     - label: "أ", "ب", "ج", "د" (or original letter "A", "B", "C", "D")
     - text: the option content string without the letter prefix
   - Identify the correct answer specified in the text (e.g., "الجواب: ب" or "Correct: B" or "Answer: 2") and map it to the corresponding option id (e.g., "option_2").
3. ACCURATE METADATA EXTRACTION:
   - "title": Title of exam from text (or derive from lesson and subject).
   - "subject": map to one of ['physics', 'math', 'arabic', 'chemistry', 'biology', 'english', 'islamic', 'other'].
   - "subjectNameAr": The Arabic name of the subject (الفيزياء, الرياضيات, اللغة العربية, etc.).
   - "grade": Grade/class mentioned (default: "توجيهي 2009 - الثاني عشر").
   - "curriculum": Curriculum (default: "المنهاج الأردني المطور").
   - "lesson": Lesson or unit title.
   - "description": Description or exam instructions.
   - "durationMinutes": Duration in minutes if specified (default: 30 if not mentioned).
   - "totalQuestions": Actual count of parsed questions.
   - "marksPerQuestion": Points per question (default: 5 if not mentioned).
   - "totalMarks": Total exam points.
4. VALIDATION & DETECTION OF MISSING FIELDS:
   - If a question lacks an answer in the text: add to errors: "السؤال رقم (X): لم يتم تحديد الإجابة النموذجية الصحيحة في النص الأصلي."
   - If options are fewer than 2: add to errors: "السؤال رقم (X): يحتوي على أقل من خيارين."
   - If explanation is missing: set explanation to "لم يتم توفير شرح في النص الأصلي" and add to warnings: "السؤال رقم (X): يفتقر إلى شرح تفصيلي لطريقة الحل."
   - If hint is missing: set hint to "" and add to warnings: "السؤال رقم (X): لا يحتوي على تلميح تعليمي."

You MUST return ONLY a valid JSON object adhering strictly to this schema:

{
  "exam": {
    "title": "string",
    "subject": "physics",
    "subjectNameAr": "الفيزياء",
    "grade": "string",
    "curriculum": "string",
    "lesson": "string",
    "description": "string",
    "language": "ar",
    "difficulty": "medium",
    "durationMinutes": 30,
    "totalQuestions": 5,
    "marksPerQuestion": 5,
    "totalMarks": 25
  },
  "questions": [
    {
      "number": 1,
      "type": "multiple_choice",
      "questionText": "string",
      "options": [
        {"id": "option_1", "label": "أ", "text": "string"},
        {"id": "option_2", "label": "ب", "text": "string"},
        {"id": "option_3", "label": "ج", "text": "string"},
        {"id": "option_4", "label": "د", "text": "string"}
      ],
      "correctOptionId": "option_1",
      "hint": "string",
      "explanation": "string",
      "marks": 5,
      "difficulty": "medium"
    }
  ],
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": []
  }
}

RAW EXAM TEXT TO PARSE:
\"\"\"
${rawText}
\"\"\"`;

  const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
  let rawJsonText = '';
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1, // Low temperature for deterministic parser fidelity
        },
      });

      if (response && response.text) {
        rawJsonText = response.text;
        break;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI Exam Parser] Model ${model} parsing attempt failed:`, err?.message || err);
    }
  }

  if (!rawJsonText) {
    throw new Error(`فشل استدعاء الذكاء الاصطناعي لتحليل النص: ${lastError?.message || 'يرجى المحاولة مجدداً'}`);
  }

  const parsed = JSON.parse(cleanJsonString(rawJsonText)) as ExamImportResult;

  // Programmatic Sanitization & Cross-Validation Pass
  const errors: string[] = Array.isArray(parsed.validation?.errors) ? [...parsed.validation.errors] : [];
  const warnings: string[] = Array.isArray(parsed.validation?.warnings) ? [...parsed.validation.warnings] : [];

  if (!parsed.exam) {
    parsed.exam = {
      title: 'امتحان جديد',
      subject: 'physics',
      subjectNameAr: 'الفيزياء',
      grade: 'توجيهي 2009',
      curriculum: 'المنهاج الأردني المطور',
      lesson: 'الدرس الأول',
      description: '',
      language: 'ar',
      difficulty: 'medium',
      durationMinutes: 30,
      totalQuestions: 0,
      marksPerQuestion: 5,
      totalMarks: 0,
    };
    errors.push('لم يتم التعرف على البيانات العامة للامتحان.');
  }

  if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    errors.push('لم يتم العثور على أي أسئلة صالحة في النص المدخل.');
    parsed.questions = [];
  } else {
    parsed.questions.forEach((q, idx) => {
      const qNum = q.number || idx + 1;
      q.number = qNum;
      q.type = 'multiple_choice';

      if (!q.questionText || !q.questionText.trim()) {
        errors.push(`السؤال رقم (${qNum}): نص السؤال فارغ.`);
      }

      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`السؤال رقم (${qNum}): يجب أن يحتوي على خيارين على الأقل.`);
      } else {
        // Ensure options have proper ids and labels
        q.options = q.options.map((opt, optIdx) => {
          const optId = opt.id || `option_${optIdx + 1}`;
          const label = opt.label || String.fromCharCode(65 + optIdx);
          const text = (opt.text || '').trim();
          if (!text) {
            errors.push(`السؤال رقم (${qNum}): الخيار (${label}) فارغ.`);
          }
          return { id: optId, label, text };
        });

        // Verify correctOptionId exists
        const matchedOpt = q.options.find((o) => o.id === q.correctOptionId);
        if (!matchedOpt) {
          // Attempt recovery if correctOptionId was given as letter or text
          const recoveryMatch = q.options.find(
            (o) =>
              o.label.toLowerCase() === (q.correctOptionId || '').toLowerCase() ||
              o.text.trim() === (q.correctOptionId || '').trim()
          );
          if (recoveryMatch) {
            q.correctOptionId = recoveryMatch.id;
          } else {
            errors.push(`السؤال رقم (${qNum}): الإجابة النموذجية المحددة غير موجودة ضمن الخيارات.`);
          }
        }
      }

      if (!q.explanation || !q.explanation.trim()) {
        warnings.push(`السؤال رقم (${qNum}): لا يحتوي على شرح تفصيلي.`);
        q.explanation = 'شرح تفصيلي لطريقة الحل النموذجي وفق معايير المنهاج.';
      }
      if (!q.hint) {
        q.hint = '';
      }
      q.marks = q.marks || parsed.exam.marksPerQuestion || 5;
    });

    parsed.exam.totalQuestions = parsed.questions.length;
    parsed.exam.totalMarks = parsed.questions.reduce((sum, q) => sum + (q.marks || 5), 0);
  }

  parsed.validation = {
    isValid: errors.length === 0,
    errors,
    warnings,
  };

  return parsed;
}
