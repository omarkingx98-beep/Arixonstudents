import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { parseRawExamWithGemini, ExamParseError } from '../_lib/aiExamParser.js';

const PRIMARY_ADMIN_EMAILS = [
  (process.env.ADMIN_PRIMARY_EMAIL || '').toLowerCase().trim(),
  'omar88x99@gmail.com',
  'omarkingx99@gmail.com',
  'omarkingx98@gmail.com',
].filter(Boolean);

export const config = {
  maxDuration: 60,
};

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      throw new ExamParseError('خدمة الذكاء الاصطناعي غير مفعّلة', 'AI_SERVICE_DISABLED');
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

/**
 * Serverless function handler for Vercel /api/admin/ai-parse-exam
 */
export default async function handler(req: any, res: any) {
  // Set CORS & Content-Type headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
      message: 'طريقة الطلب غير مسموح بها',
    });
  }

  try {
    let body = req.body;
    let rawExamText = '';

    if (typeof body === 'string') {
      try {
        const parsedBody = JSON.parse(body);
        rawExamText = parsedBody.rawExamText || '';
      } catch {
        rawExamText = body;
      }
    } else if (body && typeof body === 'object') {
      rawExamText = body.rawExamText || '';
    }

    if (!rawExamText || typeof rawExamText !== 'string' || !rawExamText.trim()) {
      return res.status(200).json({
        ok: false,
        code: 'EMPTY_TEXT',
        message: 'يرجى لصق نص الامتحان أولاً قبل الضغط على زر التحليل.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        ok: false,
        code: 'AI_SERVICE_DISABLED',
        message: 'خدمة الذكاء الاصطناعي غير مفعّلة',
        details: 'متغير البيئة GEMINI_API_KEY غير مضبوط على خادم Vercel.',
      });
    }

    const ai = getGeminiClient();
    const result = await parseRawExamWithGemini(ai, rawExamText.trim());

    return res.status(200).json({
      ok: true,
      code: 'SUCCESS',
      message: 'تم تحليل الامتحان بنجاح',
      data: result,
    });
  } catch (err: any) {
    console.error('[Vercel API ai-parse-exam] Error:', err);

    let code = err?.code || 'PARSER_ERROR';
    let message = err?.message || 'تعذر قراءة نص الامتحان، حاول مرة ثانية.';
    let details = err?.details || err?.message || 'خطأ غير محدد';

    if (err?.message?.includes('timeout') || err?.message?.includes('TIMED_OUT')) {
      code = 'TIMEOUT';
      message = 'انتهت مهلة التحليل، حاول مرة ثانية';
    } else if (err?.code === 'NO_QUESTIONS_FOUND') {
      code = 'NO_QUESTIONS_FOUND';
      message = 'لم أجد أسئلة في النص، الصق نص الامتحان فقط';
    } else if (err?.code === 'AI_SERVICE_DISABLED') {
      code = 'AI_SERVICE_DISABLED';
      message = 'خدمة الذكاء الاصطناعي غير مفعّلة';
      details = 'متغير البيئة GEMINI_API_KEY غير مضبوط على الخادم.';
    }

    return res.status(200).json({
      ok: false,
      code,
      message,
      details,
    });
  }
}
