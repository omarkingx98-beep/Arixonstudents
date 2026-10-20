import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { parseRawExamWithGemini } from '../_lib/aiExamParser.js';

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
      throw new Error('GEMINI_API_KEY environment variable is missing.');
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
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
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
      return res.status(400).json({ ok: false, error: 'يرجى لصق محتوى الامتحان أولاً.' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: 'متغير البيئة GEMINI_API_KEY غير مضبوط على الخادم.',
      });
    }

    const ai = getGeminiClient();
    const result = await parseRawExamWithGemini(ai, rawExamText.trim());

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[Vercel API ai-parse-exam] Error:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'تعذر تحليل نص الامتحان بواسطة الذكاء الاصطناعي.',
    });
  }
}
