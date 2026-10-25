import { FIRST_EXAM_ID, FIRST_EXAM_QUESTIONS, type QuestionWithKey } from './firstExamData.js';
import { LITERARY_EXAM_ID, LITERARY_EXAM_QUESTIONS } from './literaryExamData.js';
import { ISLAMIC_EXAM_ID, ISLAMIC_EXAM, ISLAMIC_EXAM_QUESTIONS } from './islamicExamData.js';

export const SURAH_YUSUF_EXAM_ID = 'exam_1792050086667_12ri';

export const SURAH_YUSUF_CORRECT_KEYS: Record<string, { correctAnswer: number; explanation?: string }> = {
  'q_exam_1792050086667_12ri_1': { correctAnswer: 2, explanation: 'العبرة المستفادة هي أن الشدة يتبعها الفرج وأن الصبر عاقبته خير.' },
  'q_exam_1792050086667_12ri_2': { correctAnswer: 1, explanation: 'رأى يوسف عليه السلام أحد عشر كوكباً والشمس والقمر له ساجدين.' },
  'q_exam_1792050086667_12ri_3': { correctAnswer: 2, explanation: 'المقصود بالسجود في الرؤيا إخوته الأحد عشر ووالداه يعقوب وأمه.' },
  'q_exam_1792050086667_12ri_4': { correctAnswer: 1, explanation: 'خاف يعقوب عليه السلام أن يحسدوه ويكيدوا له كيداً.' },
  'q_exam_1792050086667_12ri_5': { correctAnswer: 0, explanation: 'يرتع أي يأكل ويتنزه ويلهو في المرعى.' },
  'q_exam_1792050086667_12ri_6': { correctAnswer: 1, explanation: 'عصبة تعني جماعة من الرجال يجمعهم العدد والقوة والتعاضد.' },
  'q_exam_1792050086667_12ri_7': { correctAnswer: 2, explanation: 'اقتراح أحدهم إلقاؤه في غيابة الجب ليلتقطه بعض السيارة.' },
  'q_exam_1792050086667_12ri_8': { correctAnswer: 2, explanation: 'السيارة هم قافلة من المسافرين المارين بالبئر.' },
  'q_exam_1792050086667_12ri_9': { correctAnswer: 2, explanation: 'دم كذب أي دم ملطخ مصطنع لتأييد رواية باطلة وغير صادقة.' },
  'q_exam_1792050086667_12ri_10': { correctAnswer: 0, explanation: 'الزيادة في غلّقت على وزن فعّل تفيد المبالغة في الإحكام والتكثير.' },
  'q_exam_1792050086667_12ri_11': { correctAnswer: 1, explanation: 'هيت لك اسم فعل بمعنى تعال وأقبل إليّ وتهيأت لك.' },
  'q_exam_1792050086667_12ri_12': { correctAnswer: 2, explanation: 'معاذ الله تفيد الالتجاء والاعتصام بالله والاستعاذة به من المعصية.' },
  'q_exam_1792050086667_12ri_13': { correctAnswer: 1, explanation: 'يشير إلى سيده العزيز الذي أكرم مثواه في بيته.' },
  'q_exam_1792050086667_12ri_14': { correctAnswer: 2, explanation: 'استبقا الباب أي تسابقا إليه، يوسف محاولاً الخروج وهي ممسكة به.' },
  'q_exam_1792050086667_12ri_15': { correctAnswer: 1, explanation: 'قدت قميصه من دبر أي شقته ومزقته من الخلف أثناء محاولته الهرب.' },
  'q_exam_1792050086667_12ri_16': { correctAnswer: 0, explanation: 'دليل صدق يوسف أن القميص كان مقدوداً من دبر (من الخلف).' },
  'q_exam_1792050086667_12ri_17': { correctAnswer: 0, explanation: 'أعرض عن هذا أي اترك الحديث عنه واكتم الأمر ولا تخض فيه.' },
  'q_exam_1792050086667_12ri_18': { correctAnswer: 2, explanation: 'لولا حرف امتناع لوجود، وهو أسلوب شرط غير جازم.' },
  'q_exam_1792050086667_12ri_19': { correctAnswer: 2, explanation: 'كوكباً تمييز مفرد منصوب بعد العدد المركب أحد عشر.' },
  'q_exam_1792050086667_12ri_20': { correctAnswer: 1, explanation: 'القيم البارزة هي العفة ومراقبة الله والالتجاء إليه وحسن الوفاء.' },
};

export type { QuestionWithKey };
export {
  FIRST_EXAM_ID,
  FIRST_EXAM_QUESTIONS,
  LITERARY_EXAM_ID,
  LITERARY_EXAM_QUESTIONS,
  ISLAMIC_EXAM_ID,
  ISLAMIC_EXAM,
  ISLAMIC_EXAM_QUESTIONS,
};
