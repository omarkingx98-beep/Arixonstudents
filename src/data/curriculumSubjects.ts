import type { SubjectId } from '../types';

export interface CurriculumSubject {
  id: SubjectId;
  nameAr: string;
  branch: 'scientific' | 'literary' | 'common';
  iconName?: string;
  description: string;
}

/**
 * 8 Dedicated Subjects for Scientific Branch (الفرع العلمي)
 */
export const SCIENTIFIC_SUBJECTS: CurriculumSubject[] = [
  { id: 'math', nameAr: 'الرياضيات العلمي', branch: 'scientific', description: 'التفاضل والتكامل، المتجهات، الإحصاء والاحتمالات' },
  { id: 'physics', nameAr: 'الفيزياء', branch: 'scientific', description: 'الميكانيكا، الزخم الخطي، الكهرومغناطيسية والفيزياء الحديثة' },
  { id: 'chemistry', nameAr: 'الكيمياء', branch: 'scientific', description: 'الكيمياء العضوية، الاتزان الكيميائي، وسرعة التفاعلات' },
  { id: 'biology', nameAr: 'الأحياء', branch: 'scientific', description: 'الوراثة الجزيئية، التكنولوجيا الحيوية، وأجهزة جسم الإنسان' },
  { id: 'geology', nameAr: 'علوم الأرض والبيئة', branch: 'scientific', description: 'الجيولوجيا، الموارد الطبيعية، والبيئة المناخية' },
  { id: 'arabic', nameAr: 'اللغة العربية (مشترك)', branch: 'common', description: 'مهارات الاتصال، النحو والصرف، والبلاغة والعروض' },
  { id: 'english', nameAr: 'اللغة الإنجليزية', branch: 'common', description: 'Grammar, Reading Comprehension & Writing Skills' },
  { id: 'islamic_studies', nameAr: 'التربية الإسلامية', branch: 'common', description: 'القرآن الكريم والحديث الشريف، العقيدة، والفقه الإسلامي' },
];

/**
 * 8 Dedicated Subjects for Literary Branch (الفرع الأدبي)
 */
export const LITERARY_SUBJECTS: CurriculumSubject[] = [
  { id: 'arabic', nameAr: 'اللغة العربية (تخصص ومهارات)', branch: 'literary', description: 'النحو والصرف التخصصي، البلاغة، تاريخ الأدب والنقد' },
  { id: 'english', nameAr: 'اللغة الإنجليزية', branch: 'common', description: 'Grammar, Reading Comprehension & Writing Skills' },
  { id: 'islamic_studies', nameAr: 'التربية الإسلامية', branch: 'common', description: 'القرآن والحديث الشريف، الفكر الإسلامي، والفقه والأخلاق' },
  { id: 'math', nameAr: 'الرياضيات الأدبي', branch: 'literary', description: 'المصفوفات، التفاضل والتكامل المبسط، والإحصاء التطبيقي' },
  { id: 'history', nameAr: 'تاريخ الأردن والعرب', branch: 'literary', description: 'تاريخ الأردن الحديث والمعاصر، القضايا العربية والعالمية' },
  { id: 'geography', nameAr: 'الجغرافيا ودراسات بيئية', branch: 'literary', description: 'الجغرافيا الطبيعية، الخرائط، ونظم المعلومات الجغرافية' },
  { id: 'financial_culture', nameAr: 'الثقافة المالية والمصرفية', branch: 'literary', description: 'إدارة الأموال، الاستثمار، البنوك، والتخطيط المالي' },
  { id: 'computer', nameAr: 'الحاسوب وتكنولوجيا المعلومات', branch: 'literary', description: 'البرمجة، قواعد البيانات، الذكاء الاصطناعي، وشبكات الاتصال' },
];

/**
 * Get the 8 subjects applicable to a specific branch
 */
export function getBranchSubjects(branch: 'علمي' | 'أدبي' | 'all' | string): Array<{ id: SubjectId; label: string }> {
  if (branch === 'أدبي') {
    return [
      { id: 'all', label: 'كافة مواد الأدبي' },
      ...LITERARY_SUBJECTS.map(s => ({ id: s.id, label: s.nameAr }))
    ];
  }
  
  if (branch === 'علمي') {
    return [
      { id: 'all', label: 'كافة مواد العلمي' },
      ...SCIENTIFIC_SUBJECTS.map(s => ({ id: s.id, label: s.nameAr }))
    ];
  }

  // Combined for all
  return [
    { id: 'all', label: 'كافة المواد' },
    { id: 'physics', label: 'الفيزياء (علمي)' },
    { id: 'math', label: 'الرياضيات' },
    { id: 'chemistry', label: 'الكيمياء (علمي)' },
    { id: 'biology', label: 'الأحياء (علمي)' },
    { id: 'geology', label: 'علوم الأرض (علمي)' },
    { id: 'arabic', label: 'اللغة العربية' },
    { id: 'english', label: 'اللغة الإنجليزية' },
    { id: 'islamic_studies', label: 'التربية الإسلامية' },
    { id: 'history', label: 'التاريخ (أدبي)' },
    { id: 'geography', label: 'الجغرافيا (أدبي)' },
    { id: 'financial_culture', label: 'الثقافة المالية (أدبي)' },
    { id: 'computer', label: 'الحاسوب (أدبي)' },
  ];
}
