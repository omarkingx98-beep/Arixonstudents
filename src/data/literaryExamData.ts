import type { Exam, Question } from '../../src/types/index.js';


export const LITERARY_EXAM_ID = 'exam_arabic_tw2009_01';

export const LITERARY_EXAM: Exam & { branch: string } = {
  id: LITERARY_EXAM_ID,
  title: 'امتحان اللغة العربية الوزاري الشامل (مهارات الاتصال) – قواعد ونصوص وعروض',
  subject: 'arabic',
  subjectNameAr: 'اللغة العربية',
  lesson: 'مهارات الاتصال – القواعد والإعراب والبلاغة والعروض',
  description: 'امتحان وزاري شامل مبني على المعايير الوزارية الرسمية لمناهج التوجيهي 2009. يشمل 20 سؤالاً تغطي قواعد النحو والصرف، البلاغة، معاني الحروف، والعروض، مخصص لطلبة الفرعين الأدبي والعلمي والمشترك.',
  questionCount: 20,
  durationMinutes: 30,
  totalPoints: 100,
  difficulty: 'medium',
  status: 'available',
  published: true,
  allowRetake: false,
  branch: 'مشترك', // المشترك يشمل الأدبي والعلمي
  createdAt: '2025-09-02T08:00:00.000Z',
  updatedAt: new Date().toISOString(),
  createdBy: 'وزارة التربية والتعليم - بنك امتحانات التوجيهي',
};

export const LITERARY_EXAM_QUESTIONS: Question[] = [
  {
    id: 'lit_q1',
    examId: LITERARY_EXAM_ID,
    order: 1,
    questionText: 'ما المعنى الذي أفاده حرف الجر (مِن) في قوله تعالى: ﴿وَمِنَ النَّاسِ مَن يَقُولُ آمَنَّا بِاللَّهِ﴾؟',
    options: [
      'التبعيض',
      'ابتداء الغاية المكانية',
      'البيان والتفصيل',
      'السببية والتعليل'
    ],
    points: 7,
    difficulty: 'easy',
    source: 'امتحان الثانوية العامة الوزاري - مهارات اتصال',
    questionType: 'multiple_choice'
  ,
    hint: 'هل يمكن استبدال حرف الجر بكلمة (بعض) في المعنى السياقي؟'
  },
  {
    id: 'lit_q2',
    examId: LITERARY_EXAM_ID,
    order: 2,
    questionText: 'إعراب كلمة (طالباً) في جملة: «نِعْمَ طالباً المُجِدُّ» هو:',
    options: [
      'تمييز منصوب وعلامة نصبه تنوين الفتح',
      'فاعل مرفوع وعلامة رفعه الضمة المقدرة',
      'مفعول به منصوب',
      'حال منصوبة'
    ],
    points: 7,
    difficulty: 'medium',
    source: 'قواعد التوجيهي الوزاري 2009',
    questionType: 'multiple_choice'
  ,
    hint: 'الاسم النكرة المنصوب بعد أفعال المدح والذم (نعم وبئس) عندما يكون الفاعل ضميراً مستتراً.'
  },
  {
    id: 'lit_q3',
    examId: LITERARY_EXAM_ID,
    order: 3,
    questionText: 'المصدر الصريح من الفعل الخماسي (تَسامَحَ) هو:',
    options: [
      'تَسامُح',
      'مُسامَحة',
      'سَماحة',
      'تَسْريح'
    ],
    points: 6,
    difficulty: 'easy',
    source: 'أسئلة الصرف الوزارية',
    questionType: 'multiple_choice'
  ,
    hint: 'الأفعال الخماسية المبدوءة بتاء زائدة على وزن تفاعَلَ يأتي مصدرها بضم ما قبل الآخر.'
  },
  {
    id: 'lit_q4',
    examId: LITERARY_EXAM_ID,
    order: 4,
    questionText: 'نوع البدل في جملة: «أعجبني الطالبُ خُلُقُهُ» هو:',
    options: [
      'بدل اشتمال',
      'بدل مطابق (كل من كل)',
      'بدل بعض من كل',
      'بدل تفصيل'
    ],
    points: 7,
    difficulty: 'medium',
    source: 'قواعد التوجيهي - التوابع',
    questionType: 'multiple_choice'
  ,
    hint: 'هل الخُلق جزء مادي حقيقي من أجزاء الطالب أم صفة معنوية يشتمل عليها؟'
  },
  {
    id: 'lit_q5',
    examId: LITERARY_EXAM_ID,
    order: 5,
    questionText: 'في علم العروض، تفعيلة (مُتَفاعِلُنْ) بوزن ( /////○ ) هي التفعيلة الرئيسة لبحر:',
    options: [
      'الوافر',
      'الكامل',
      'البسيط',
      'الطويل'
    ],
    points: 7,
    difficulty: 'medium',
    source: 'العروض والقافية - التوجيهي الوزاري',
    questionType: 'multiple_choice'
  ,
    hint: 'مفتاح البحر: كَمُلَ الجمالُ من البحورِ الكاملُ ... مُتَفاعِلُنْ مُتَفاعِلُنْ مُتَفاعِلُنْ.'
  },
  {
    id: 'lit_q6',
    examId: LITERARY_EXAM_ID,
    order: 6,
    questionText: 'الجملة التي تحتوي على أسلوب (تعجب قياسي) هي:',
    options: [
      'ما أروعَ صدقَ العزيمةِ!',
      'للهِ درُّكَ فارساً!',
      'سبحانَ اللهِ ما هذا الجمال!',
      'يا لكَ من شجاع!'
    ],
    points: 7,
    difficulty: 'easy',
    source: 'قواعد التوجيهي - أسلوب التعجب',
    questionType: 'multiple_choice'
  ,
    hint: 'التعجب القياسي له صيغتان معروفتان: (ما أفْعَلَ!) و(أفْعِلْ بِه!).'
  },
  {
    id: 'lit_q7',
    examId: LITERARY_EXAM_ID,
    order: 7,
    questionText: 'اسم المفعول الصحيح المشتق من الفعل المعتل الثلاثي (باعَ) هو:',
    options: [
      'مَبِيع',
      'مَبْيُوع',
      'مُباع',
      'مَباع'
    ],
    points: 7,
    difficulty: 'medium',
    source: 'الصرف الوزاري - اسم الفاعل والمفعول',
    questionType: 'multiple_choice'
  ,
    hint: 'الفعل الأجوف الواوي أو اليائي: نأتي بالمضارع (يبيع) ونستبدل حرف المضارعة ميماً مفتوحة.'
  },
  {
    id: 'lit_q8',
    examId: LITERARY_EXAM_ID,
    order: 8,
    questionText: 'الضبط الصحيح لآخر كلمة (القدس) في جملة: «لا تحسبوا أنَّ القدسَ تُنسى» هو:',
    options: [
      'الفتح (القدسَ)',
      'الضم (القدسُ)',
      'الكسر (القدسِ)',
      'السكون (القدسْ)'
    ],
    points: 6,
    difficulty: 'easy',
    source: 'قواعد النحو الوزارية',
    questionType: 'multiple_choice'
  ,
    hint: 'ما هو أثر الحرف الناسخ (أنّ) على المبتدأ؟'
  },
  {
    id: 'lit_q9',
    examId: LITERARY_EXAM_ID,
    order: 9,
    questionText: 'المحسن البديعي في قول الشاعر: «فإذا حاربوا أذلّوا عزيزاً ... وإذا سالَموا أعزّوا ذليلاً» هو:',
    options: [
      'مقابلة',
      'طباق إيجاب فقط',
      'جناس تام',
      'سجع'
    ],
    points: 7,
    difficulty: 'medium',
    source: 'البلاغة العربية والنقد الأدبي',
    questionType: 'multiple_choice'
  ,
    hint: 'عندما يتطابق تركيبان في تضاد أكثر من معنى على الترتيب (حاربوا × سالموا / أذلوا × أعزوا / عزيزاً × ذليلاً).'
  },
  {
    id: 'lit_q10',
    examId: LITERARY_EXAM_ID,
    order: 10,
    questionText: 'تُكتب الألف اللينة مقصورة (ى) في آخر الفعل (اهتدى) لأن الفعل:',
    options: [
      'غير ثلاثي ولم تسبق ألفه بياء',
      'ثلاثي أصل ألفه ياء',
      'غير ثلاثي سُبقت ألفه بياء',
      'اسم أعجمي زائد على ثلاثة أحرف'
    ],
    points: 6,
    difficulty: 'easy',
    source: 'الإملاء والترقيم الوزاري',
    questionType: 'multiple_choice'
  ,
    hint: 'عدّ حروف الفعل (ا - هـ - ت - د - ى) ولاحظ الحرف الذي يسبق الألف الأخيرة.'
  },
  {
    id: 'lit_q11',
    examId: LITERARY_EXAM_ID,
    order: 11,
    questionText: 'إعراب الفعل (تَكْسَلْ) في قوله تعالى: ﴿وَلَا تَكْسَلْ فِي طَلَبِ العِلْمِ﴾ هو:',
    options: [
      'فعل مضارع مجزوم بلا الناهية وعلامة جزمه السكون',
      'فعل مضارع منصوب وعلامة نصبه الفتحة',
      'فعل مضارع مرفوع وعلامة رفعه الضمة المقدرة',
      'فعل أمر مبني على السكون'
    ],
    points: 7,
    difficulty: 'easy',
    source: 'قواعد النحو الوزارية 2009',
    questionType: 'multiple_choice'
  ,
    hint: 'الأداة (لا) هنا تفيد طلب الكف عن الفعل (نهي).'
  },
  {
    id: 'lit_q12',
    examId: LITERARY_EXAM_ID,
    order: 12,
    questionText: 'نوع المنادى في جملة: «يا حاملاً رايةَ الحقِّ استمسكْ بها» هو:',
    options: [
      'شبيه بالمضاف',
      'مضاف',
      'نكرة غير مقصودة',
      'علم مفرد'
    ],
    points: 7,
    difficulty: 'medium',
    source: 'النحو والصرف - أسلوب النداء',
    questionType: 'multiple_choice'
  ,
    hint: 'المنادى منون واتصل به ما يتمم معناه (مفعول به لاسم الفاعل).'
  },
  {
    id: 'lit_q13',
    examId: LITERARY_EXAM_ID,
    order: 13,
    questionText: 'الكلمة التي وقع فيها (إبدال) من الكلمات الآتية هي:',
    options: [
      'اصْطَبَرَ',
      'اسْتَمَعَ',
      'انْتَصَرَ',
      'ابْتَسَمَ'
    ],
    points: 7,
    difficulty: 'hard',
    source: 'الصرف - الإبدال والإعلال',
    questionType: 'multiple_choice'
  ,
    hint: 'الإبدال في وزن افتعل إذا كانت فاء الفعل صاداً أو ضاداً أو طاء أو ظاء قُلبت تاؤه طاءً.'
  },
  {
    id: 'lit_q14',
    examId: LITERARY_EXAM_ID,
    order: 14,
    questionText: 'الوزن الصرفي الصحيح لكلمة (قِفْ) هو:',
    options: [
      'عِلْ',
      'فِلْ',
      'فِعْ',
      'عِفْ'
    ],
    points: 6,
    difficulty: 'medium',
    source: 'الميزان الصرفي الوزاري',
    questionType: 'multiple_choice'
  ,
    hint: 'الفعل الماضي المجرد هو (وَقَفَ) على وزن (فَعَلَ)، ما الحرف المحذوف في الأمر (قِفْ)؟'
  },
  {
    id: 'lit_q15',
    examId: LITERARY_EXAM_ID,
    order: 15,
    questionText: 'في جملة: «كمْ طالباً في الفصلِ؟» نوع (كم) هو:',
    options: [
      'استفهامية',
      'خبرية تكثيرية',
      'تعجبية',
      'شرطية'
    ],
    points: 5,
    difficulty: 'easy',
    source: 'قواعد التوجيهي - كم الاستفهامية والخبرية',
    questionType: 'multiple_choice'
  ,
    hint: 'تمييزها مفرد منصوب وجاءت في سياق السؤال والاستعلام مع علامة الاستفهام.'
  },
  {
    id: 'lit_q16',
    examId: LITERARY_EXAM_ID,
    order: 16,
    questionText: 'البحر العروضي الذي نُظم عليه بيت المتنبي: «على قدرِ أهلِ العزمِ تأتي العزائمُ ... وتأتي على قدرِ الكرامِ المكارمُ» هو:',
    options: [
      'بحر الطويل',
      'بحر البسيط',
      'بحر الوافر',
      'بحر الكامل'
    ],
    points: 5,
    difficulty: 'medium',
    source: 'العروض الوزاري التوجيهي',
    questionType: 'multiple_choice'
  ,
    hint: 'وزنه: فَعُولُنْ مَفَاعِيلُنْ فَعُولُنْ مَفَاعِلُنْ.'
  },
  {
    id: 'lit_q17',
    examId: LITERARY_EXAM_ID,
    order: 17,
    questionText: 'المصدر الصريح المشتق من الفعل الخماسي المبدوء بتاء زائدة (تَقَدَّمَ) هو:',
    options: [
      'تَقَدُّم',
      'تَقْدِيم',
      'إِقْدام',
      'مُقَدَّمَة'
    ],
    points: 5,
    difficulty: 'easy',
    source: 'الصرف - المصادر الصريحة',
    questionType: 'multiple_choice'
  ,
    hint: 'الخماسي المبدوء بتاء زائدة يأتي مصدره على وزن ماضيه مع ضم ما قبل الآخر.'
  },
  {
    id: 'lit_q18',
    examId: LITERARY_EXAM_ID,
    order: 18,
    questionText: 'نوع أسلوب الاستثناء في قوله تعالى: ﴿مَا فَعَلُوهُ إِلَّا قَلِيلٌ مِنْهُمْ﴾ هو:',
    options: [
      'تام منفي',
      'تام مثبت',
      'مفرغ (ناقص منفي)',
      'منقطع'
    ],
    points: 5,
    difficulty: 'medium',
    source: 'قواعد النحو - أسلوب الاستثناء',
    questionType: 'multiple_choice'
  ,
    hint: 'المستثنى منه مذكور (الواو في فعلوه) والجملة مسبوقة بأداة نفي (ما).'
  },
  {
    id: 'lit_q19',
    examId: LITERARY_EXAM_ID,
    order: 19,
    questionText: 'الموقع الإعرابي لكلمة (رجلاً) في جملة: «نِعْمَ رجلاً الصادقُ» هو:',
    options: [
      'تمييز منصوب وعلامة نصبه تنوين الفتح',
      'فاعل نعم مرفوع بالضمة',
      'مفعول به منصوب',
      'حال منصوبة'
    ],
    points: 5,
    difficulty: 'medium',
    source: 'قواعد التوجيهي - أسلوب المدح والذم',
    questionType: 'multiple_choice'
  ,
    hint: 'الاسم النكرة المنصوب بعد فعلي المدح والذم (نعم وبئس) يفسر الفاعل المستتر ويعرب تمييزاً.'
  },
  {
    id: 'lit_q20',
    examId: LITERARY_EXAM_ID,
    order: 20,
    questionText: 'المعنى البلاغي الذي خرج إليه الأمر في قول الشاعر: «قِفَا نَبْكِ مِنْ ذِكْرَى حَبِيبٍ وَمَنْزِلِ» هو:',
    options: [
      'الالتماس',
      'الدعاء',
      'التهديد',
      'التعجيز'
    ],
    points: 5,
    difficulty: 'medium',
    source: 'البلاغة العربية - المعاني البلاغية للأمر',
    questionType: 'multiple_choice'
  ,
    hint: 'الأمر صادر من الشاعر إلى صاحبيه ورفيقيه المتساويين معه في المنزلة والقدر.'
  }
];
