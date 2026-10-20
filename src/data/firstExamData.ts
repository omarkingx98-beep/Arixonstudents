import type { Exam, Question } from '../../src/types/index.js';

export const FIRST_EXAM_ID = 'exam_physics_tw2009_01';

export const FIRST_EXAM: Exam = {
  id: FIRST_EXAM_ID,
  title: 'امتحان الفيزياء الوزاري الشامل – الزخم الخطي والدفع',
  subject: 'physics',
  subjectNameAr: 'الفيزياء',
  lesson: 'الزخم الخطي والدفع والتصادمات',
  description: 'امتحان وزاري شامل مبني على بنك الأسئلة الوزارية الرسمية لوحدة الزخم الخطي والدفع. يشمل 20 سؤالاً اختيار من متعدد تغطي المفاهيم، العلاقات البيانية، والمسائل الحسابية الدقيقة وفق المعايير الوزارية المعتمدة.',
  questionCount: 20,
  durationMinutes: 35,
  totalPoints: 100,
  difficulty: 'medium',
  status: 'available',
  published: true,
  allowRetake: false,
  branch: 'علمي',
  createdAt: '2025-09-01T08:00:00.000Z',
  updatedAt: new Date().toISOString(),
  createdBy: 'وزارة التربية والتعليم - بنك الامتحانات الوزارية',
};



export const FIRST_EXAM_QUESTIONS: Question[] = [
  {
    id: 'q1',
    examId: FIRST_EXAM_ID,
    order: 1,
    questionText: 'عند مضاعفة الطاقة الحركية لجسم زخمه الخطي (16 kg·m/s) بمقدار (4 مرات) بثبوت الكتلة، فما زخمه بوحدة (kg·m/s):',
    options: [
      '32',
      '16',
      '8',
      '4'
    ],
    points: 5,
    difficulty: 'medium',
    source: 'امتحان الثانوية العامة الوزاري - فلسطين 2020',
    questionType: 'multiple_choice'
  },
  {
    id: 'q2',
    examId: FIRST_EXAM_ID,
    order: 2,
    questionText: 'في منحنى (القوة - الزمن) F-t، ماذا تمثل المساحة تحت المنحنى؟',
    options: [
      'الدفع المؤثر على الجسم',
      'القوة المتوسطة',
      'الزخم الخطي الابتدائي',
      'الشغل المبذول'
    ],
    points: 5,
    difficulty: 'easy',
    source: 'امتحان الثانوية العامة الوزاري - فلسطين 2019',
    questionType: 'multiple_choice'
  },
  {
    id: 'q3',
    examId: FIRST_EXAM_ID,
    order: 3,
    questionText: 'ما زخم نظام يتكون من كرتين متماثلتين، كتلة كل منهما (m) وتتحركان بنفس الاتجاه وبالسرعة نفسها (v)؟',
    options: [
      'صفر',
      'mv',
      'm / v',
      '2mv'
    ],
    points: 5,
    difficulty: 'easy',
    source: 'امتحان الثانوية العامة الوزاري - 2021',
    questionType: 'multiple_choice'
  },
  {
    id: 'q4',
    examId: FIRST_EXAM_ID,
    order: 4,
    questionText: 'أثرت قوة مقدارها (20 N) على جسم كتلته (5 kg) لمدة (4 s)، فما التغير في سرعته بوحدة (m/s):',
    options: [
      '3',
      '6',
      '16',
      '26'
    ],
    points: 5,
    difficulty: 'medium',
    source: 'امتحان الثانوية العامة الوزاري - 2018',
    questionType: 'multiple_choice'
  },
  {
    id: 'q5',
    examId: FIRST_EXAM_ID,
    order: 5,
    questionText: 'يدور قمر صناعي كتلته (m) حول الأرض بسرعة ثابتة المقدار (v) في مسار دائري، ما مقدار التغير في زخمه عند دورانه نصف دورة؟',
    options: [
      'صفر',
      '1/2 mv',
      'mv',
      '2mv'
    ],
    points: 5,
    difficulty: 'hard',
    source: 'امتحان الثانوية العامة الوزاري - 2021',
    questionType: 'multiple_choice'
  },
  {
    id: 'q6',
    examId: FIRST_EXAM_ID,
    order: 6,
    questionText: 'قوتان (F1, F2) تؤثران على جسم، إذا كانت (F1 = 3F2) وينتج عنهما كمية الدفع نفسها، فإن زمن تأثير (F1) يساوي:',
    options: [
      '1/3 زمن تأثير F2',
      '3 أضعاف زمن تأثير F2',
      'زمن تأثير F2 نفسه',
      '9 أضعاف زمن تأثير F2'
    ],
    points: 5,
    difficulty: 'medium',
    source: 'امتحان الثانوية العامة الوزاري - 2020',
    questionType: 'multiple_choice'
  },
  {
    id: 'q7',
    examId: FIRST_EXAM_ID,
    order: 7,
    questionText: 'إذا مُثلت العلاقة بيانيًا بين الدفع المؤثر على جسم على محور الصادات (I) والتغير في السرعة على محور السينات (Δv)، فماذا يمثل ميل الخط المستقيم؟',
    options: [
      'الزخم الخطي',
      'كتلة الجسم',
      'تسارع الجسم',
      'القوة المؤثرة'
    ],
    points: 5,
    difficulty: 'medium',
    source: 'امتحان الثانوية العامة الوزاري - 2019',
    questionType: 'multiple_choice'
  },
  {
    id: 'q8',
    examId: FIRST_EXAM_ID,
    order: 8,
    questionText: 'ماذا يمثل ميل الخط المستقيم في الرسم البياني للعلاقة بين (الزخم الخطي - السرعة) P-v؟',
    options: [
      'الدفع المؤثر على الجسم',
      'كتلة الجسم',
      'التغير في زخم الجسم',
      'محصلة القوى المؤثرة'
    ],
    points: 5,
    difficulty: 'easy',
    source: 'امتحان الثانوية العامة الوزاري - 2021',
    questionType: 'multiple_choice'
  },
  {
    id: 'q9',
    examId: FIRST_EXAM_ID,
    order: 9,
    questionText: 'ما زخم نظام يتكون من كرتين متماثلتين، كتلة كل منهما (m) وتتحركان باتجاهين متعاكسين وبالسرعة نفسها (v)؟',
    options: [
      'صفر',
      '2mv',
      'mv',
      '1/2 mv²'
    ],
    points: 5,
    difficulty: 'easy',
    source: 'امتحان الثانوية العامة الوزاري - 2018',
    questionType: 'multiple_choice'
  },
  {
    id: 'q10',
    examId: FIRST_EXAM_ID,
    order: 10,
    questionText: 'جسمان (A, B) لهما نفس الكتلة، إذا كان الزخم الخطي للجسم (A) مثلي الزخم الخطي للجسم (B) أي (PA = 2PB)، فكم تساوي الطاقة الحركية للجسم (A)؟',
    options: [
      '1/4 KB',
      '1/2 KB',
      '2 KB',
      '4 KB'
    ],
    points: 5,
    difficulty: 'medium',
    source: 'امتحان الثانوية العامة الوزاري - 2020',
    questionType: 'multiple_choice'
  },
  {
    id: 'q11',
    examId: FIRST_EXAM_ID,
    order: 11,
    questionText: 'ماذا يساوي دفع محصلة القوى المؤثرة على جسم متحرك خلال فترة زمنية؟',
    options: [
      'التغير في طاقته الحركية',
      'التغير في كتلة الجسم',
      'التغير في تسارع الجسم',
      'التغير في زخم الجسم الخطي'
    ],
    points: 5,
    difficulty: 'easy',
    source: 'امتحان الثانوية العامة الوزاري - 2017',
    questionType: 'multiple_choice'
  },
  {
    id: 'q12',
    examId: FIRST_EXAM_ID,
    order: 12,
    questionText: 'إذا دفع رجل كتلته (70 kg) يقف على أرض جليدية أفقية عديمة الاحتكاك ولداً ساكناً كتلته (50 kg)، فكم يساوي التغير في زخم الرجل والولد معاً بوحدة (kg·m/s):',
    options: [
      '240',
      '140',
      '100',
      '0'
    ],
    points: 5,
    difficulty: 'medium',
    source: 'امتحان الثانوية العامة الوزاري - 2019',
    questionType: 'multiple_choice'
  },
  {
    id: 'q13',
    examId: FIRST_EXAM_ID,
    order: 13,
    questionText: 'جسمان لهما نفس الكتلة (m1 = m2) حيث طاقة الحركة للأول تسعة أمثال الثاني (K1 = 9K2)، فما النسبة بين زخميهما (P2 : P1)؟',
    options: [
      '9 : 1',
      '1 : 9',
      '1 : 3',
      '3 : 1'
    ],
    points: 5,
    difficulty: 'hard',
    source: 'امتحان الثانوية العامة الوزاري - 2021',
    questionType: 'multiple_choice'
  },
  {
    id: 'q14',
    examId: FIRST_EXAM_ID,
    order: 14,
    questionText: 'في الرسم البياني للعلاقة بين الزخم الخطي (p) والزمن (t)، تغير زخم جسم بانتظام من (0) إلى (20 kg·m/s) خلال (4 s)، فما متوسط القوة المؤثرة في الجسم بوحدة (N)؟',
    options: [
      '4',
      '5',
      '40',
      '80'
    ],
    points: 5,
    difficulty: 'easy',
    source: 'امتحان الثانوية العامة الوزاري - 2018',
    questionType: 'multiple_choice'
  },
  {
    id: 'q15',
    examId: FIRST_EXAM_ID,
    order: 15,
    questionText: 'أثرت قوة مقدارها (20 N) في جسم ساكن كتلته (0.5 kg)، كم من الزمن يلزم لتصبح سرعة الجسم (8 m/s):',
    options: [
      '0.01 s',
      '0.02 s',
      '0.1 s',
      '0.2 s'
    ],
    points: 5,
    difficulty: 'medium',
    source: 'امتحان الثانوية العامة الوزاري - 2020',
    questionType: 'multiple_choice'
  },
  {
    id: 'q16',
    examId: FIRST_EXAM_ID,
    order: 16,
    questionText: 'قذيفة كتلتها (2 kg) انطلقت أفقياً بسرعة (200 m/s) من فوهة مدفع ساكن كتلته (500 kg)، ما مقدار سرعة ارتداد المدفع بوحدة (m/s):',
    options: [
      '0.8',
      '0.75',
      '1.25',
      '2.5'
    ],
    points: 5,
    difficulty: 'medium',
    source: 'امتحان الثانوية العامة الوزاري - 2017',
    questionType: 'multiple_choice'
  },
  {
    id: 'q17',
    examId: FIRST_EXAM_ID,
    order: 17,
    questionText: 'كتلتان متماثلتان (m) تتحركان في نفس الاتجاه، إذا كانت سرعة إحداهما مثلي سرعة الأخرى (v و 2v)، فكم يكون زخم النظام الكلي؟',
    options: [
      'صفر',
      'mv',
      '2mv',
      '3mv'
    ],
    points: 5,
    difficulty: 'easy',
    source: 'امتحان الثانوية العامة الوزاري - 2019',
    questionType: 'multiple_choice'
  },
  {
    id: 'q18',
    examId: FIRST_EXAM_ID,
    order: 18,
    questionText: 'جسمان (A, B) لهما نفس الكتلة، إذا كان زخم الجسم A ثلاثة أمثال زخم الجسم B أي (PA = 3PB)، فكم تساوي طاقة حركته (KA) مقارنة بـ (KB)؟',
    options: [
      '3 KB',
      '9 KB',
      'KB',
      '1/9 KB'
    ],
    points: 5,
    difficulty: 'medium',
    source: 'امتحان الثانوية العامة الوزاري - 2021',
    questionType: 'multiple_choice'
  },
  {
    id: 'q19',
    examId: FIRST_EXAM_ID,
    order: 19,
    questionText: 'اصطدمت كرة كتلتها (2 kg) تتحرك بسرعة (4 m/s) بحائط عمودي وارتدت عنه بنفس السرعة في الاتجاه المعاكس، فما مقدار التغير في كمية تحركها (زخمها) بوحدة (kg·m/s):',
    options: [
      'صفر',
      '8',
      '16',
      '32'
    ],
    points: 5,
    difficulty: 'hard',
    source: 'امتحان الثانوية العامة الوزاري - 2020',
    questionType: 'multiple_choice'
  },
  {
    id: 'q20',
    examId: FIRST_EXAM_ID,
    order: 20,
    questionText: 'جسم كتلته (m) يتحرك على خط مستقيم بسرعة ثابتة (v)، فإذا تضاعفت طاقة حركته بمقدار الضعف (K₂ = 2K₁)، فما مقدار زخمه الجديد (P₂) مقارنة بـ (P₁)؟',
    options: [
      'P2 = 1/2 P1',
      'P2 = (1 / √2) P1',
      'P2 = √2 P1',
      'P2 = 2 P1'
    ],
    points: 5,
    difficulty: 'medium',
    source: 'امتحان الثانوية العامة الوزاري - 2021',
    questionType: 'multiple_choice'
  }
];
