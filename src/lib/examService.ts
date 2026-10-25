import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  runTransaction
} from 'firebase/firestore';
import { db, auth } from './firebase';
import type { 
  Exam, 
  Question, 
  ExamAttempt, 
  QuestionReview, 
  SubjectId, 
  UserProfile 
} from '../types';
import { 
  FIRST_EXAM, 
  FIRST_EXAM_ID, 
  FIRST_EXAM_QUESTIONS,
} from '../data/firstExamData';
import {
  LITERARY_EXAM,
  LITERARY_EXAM_ID,
  LITERARY_EXAM_QUESTIONS,
} from '../data/literaryExamData';
import {
  ISLAMIC_EXAM,
  ISLAMIC_EXAM_ID,
  ISLAMIC_EXAM_QUESTIONS,
} from '../data/islamicExamData';

/**
 * Ensures initial ministerial exams and questions exist in Firestore for all branches.
 * Automatically runs on app launch so real data is present in Firestore without manual setup.
 */
export async function seedFirstExamIfMissing(): Promise<void> {
  try {
    // 1. Seed Physics exam (Scientific branch)
    const examDocRef = doc(db, 'exams', FIRST_EXAM_ID);
    const examSnap = await getDoc(examDocRef);

    const needsPhysicsSeeding = !examSnap.exists() || 
      examSnap.data()?.durationMinutes !== 35 || 
      examSnap.data()?.questionCount !== 20;

    if (needsPhysicsSeeding) {
      console.log('Seeding full 20-question Physics Exam into Firestore...');
      await setDoc(examDocRef, FIRST_EXAM, { merge: true });

      for (const q of FIRST_EXAM_QUESTIONS) {
        const qRef = doc(db, 'exams', FIRST_EXAM_ID, 'questions', q.id);
        const publicQuestionData: Question = {
          id: q.id,
          examId: FIRST_EXAM_ID,
          order: q.order,
          questionText: q.questionText,
          options: q.options,
          difficulty: q.difficulty,
          source: q.source,
          points: q.points,
          questionType: q.questionType,
          hint: q.hint,
        };
        await setDoc(qRef, publicQuestionData, { merge: true });
      }
    }

    // 2. Seed Arabic exam (Literary & Common branch)
    const litDocRef = doc(db, 'exams', LITERARY_EXAM_ID);
    const litSnap = await getDoc(litDocRef);

    const needsLitSeeding = !litSnap.exists() || 
      litSnap.data()?.questionCount !== 15;

    if (needsLitSeeding) {
      console.log('Seeding full 15-question Arabic Exam into Firestore...');
      await setDoc(litDocRef, LITERARY_EXAM, { merge: true });

      for (const q of LITERARY_EXAM_QUESTIONS) {
        const qRef = doc(db, 'exams', LITERARY_EXAM_ID, 'questions', q.id);
        const publicQuestionData: Question = {
          id: q.id,
          examId: LITERARY_EXAM_ID,
          order: q.order,
          questionText: q.questionText,
          options: q.options,
          difficulty: q.difficulty,
          source: q.source,
          points: q.points,
          questionType: q.questionType,
        };
        await setDoc(qRef, publicQuestionData, { merge: true });
      }
    }

    // 3. Seed Islamic Studies exam (Unit 1, Lesson 1: منهج التعامل مع القرآن والسنة)
    const islDocRef = doc(db, 'exams', ISLAMIC_EXAM_ID);
    const islSnap = await getDoc(islDocRef);

    const needsIslSeeding = !islSnap.exists() || 
      islSnap.data()?.questionCount !== 20 ||
      islSnap.data()?.durationMinutes !== 35;

    if (needsIslSeeding) {
      console.log('Seeding full 20-question Islamic Studies Exam into Firestore...');
      await setDoc(islDocRef, ISLAMIC_EXAM, { merge: true });

      for (const q of ISLAMIC_EXAM_QUESTIONS) {
        const qRef = doc(db, 'exams', ISLAMIC_EXAM_ID, 'questions', q.id);
        const publicQuestionData: Question = {
          id: q.id,
          examId: ISLAMIC_EXAM_ID,
          order: q.order,
          questionText: q.questionText,
          options: q.options,
          difficulty: q.difficulty,
          source: q.source,
          points: q.points,
          questionType: q.questionType,
          hint: q.hint,
        };
        await setDoc(qRef, publicQuestionData, { merge: true });

        // Also seed answerKeys subcollection
        const keyRef = doc(db, 'exams', ISLAMIC_EXAM_ID, 'answerKeys', q.id);
        await setDoc(keyRef, {
          id: q.id,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          hint: q.hint || null,
        }, { merge: true });
      }
    }
  } catch (error) {
    console.warn('Seeding check/create note:', error);
  }
}

/**
 * Fetch all published exams from Firestore, dynamically enriched with the user's attempt status
 */
export async function getExamsList(
  subjectFilter?: SubjectId, 
  currentUserId?: string,
  userBranch?: string
): Promise<Exam[]> {
  try {
    // Make sure first exam is seeded
    await seedFirstExamIfMissing();

    const examsRef = collection(db, 'exams');
    let q = query(examsRef, where('published', '==', true));

    if (subjectFilter && subjectFilter !== 'all') {
      q = query(examsRef, where('published', '==', true), where('subject', '==', subjectFilter));
    }

    const snapshot = await getDocs(q);
    const exams: Exam[] = [];

    // Also get all user attempts if user is signed in to mark completed/in_progress
    const userSubmittedAttempts: Record<string, ExamAttempt> = {};
    const userInProgressAttempts: Record<string, ExamAttempt> = {};

    if (currentUserId) {
      const attemptsRef = collection(db, 'attempts');
      const attemptsQuery = query(attemptsRef, where('userId', '==', currentUserId));
      const attemptsSnap = await getDocs(attemptsQuery);
      attemptsSnap.forEach((d) => {
        const att = { ...(d.data() as ExamAttempt), id: d.id };
        if (att.status === 'submitted' || att.status === 'submitted_pending') {
          const prev = userSubmittedAttempts[att.examId];
          if (!prev || new Date(att.submittedAt || 0) > new Date(prev.submittedAt || 0)) {
            userSubmittedAttempts[att.examId] = att;
          }
        } else if (att.status === 'in_progress') {
          // If locally recorded as submitted, prefer completed status
          try {
            const localCached = localStorage.getItem(`arixon_attempt_${att.id}`);
            if (localCached) {
              const parsed = JSON.parse(localCached);
              if (parsed.status === 'submitted' || parsed.score !== undefined) {
                userSubmittedAttempts[att.examId] = { ...att, ...parsed, status: 'submitted' };
                return;
              }
            }
          } catch {}
          userInProgressAttempts[att.examId] = att;
        }
      });
    }

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data() as Exam;
      const examObj: Exam = {
        ...data,
        id: docSnapshot.id,
      };

      // Status check: do not show unpublished, draft, or archived exams to students
      const st = (examObj.status as string) || (examObj.published ? 'published' : 'draft');
      if (st === 'unpublished' || st === 'archived' || st === 'draft' || examObj.published === false) {
        return;
      }

      // Branch filtration: strict separation between Literary and Scientific tracks
      if (userBranch && userBranch !== 'all') {
        const examBranch = (examObj as any).branch;
        const examSub = examObj.subject;

        // Literary track (أدبي): strictly exclude scientific-only subjects
        if (userBranch === 'أدبي') {
          const isScientificContent = 
            ['physics', 'chemistry', 'biology', 'geology'].includes(examSub) || 
            examBranch === 'علمي' ||
            (examObj.title && (examObj.title.includes('فيزياء') || examObj.title.includes('كيمياء') || examObj.title.includes('أحياء') || examObj.title.includes('جيولوجيا') || examObj.title.includes('الزخم'))) ||
            (examObj.lesson && (examObj.lesson.includes('فيزياء') || examObj.lesson.includes('كيمياء') || examObj.lesson.includes('أحياء') || examObj.lesson.includes('الزخم')));
          if (isScientificContent) {
            return; // Never show Physics/Chemistry/Biology/Geology in Literary
          }
        }

        // Scientific track (علمي): strictly exclude literary-only subjects
        if (userBranch === 'علمي') {
          const isLiteraryContent = 
            ['history', 'geography', 'financial_culture'].includes(examSub) || 
            examBranch === 'أدبي' ||
            (examObj.title && (examObj.title.includes('تاريخ') || examObj.title.includes('جغرافيا') || examObj.title.includes('مالية') || examObj.title.includes('قضايا'))) ||
            (examObj.lesson && (examObj.lesson.includes('تاريخ') || examObj.lesson.includes('جغرافيا') || examObj.lesson.includes('مالية')));
          if (isLiteraryContent) {
            return; // Never show History/Geography/Financial Culture in Scientific
          }
        }

        // Target branch check: if exam has a specific branch requirement
        if (examBranch && examBranch !== 'all' && examBranch !== 'مشترك') {
          if (examBranch !== userBranch) {
            return;
          }
        }
      }

      // Student attempt status: if submitted, it is permanently completed (one-time completion)
      if (currentUserId) {
        let att = userSubmittedAttempts[examObj.id];

        // Fallback: check locally stored completed exam marker
        if (!att && typeof window !== 'undefined') {
          try {
            const rawCompleted = localStorage.getItem(`arixon_completed_exam_${examObj.id}`);
            if (rawCompleted) {
              const parsed = JSON.parse(rawCompleted);
              att = {
                id: parsed.attemptId || `att_${currentUserId}_${examObj.id}`,
                examId: examObj.id,
                userId: currentUserId,
                status: 'submitted',
                score: parsed.score ?? 0,
                submittedAt: parsed.submittedAt || new Date().toISOString(),
              } as ExamAttempt;
            }
          } catch {}
        }

        if (att) {
          examObj.userAttemptStatus = 'completed';
          examObj.status = 'completed';
          examObj.userLastAttemptId = att.id;
          examObj.userScore = att.score ?? 0;
        } else if (userInProgressAttempts[examObj.id]) {
          const inProgressAtt = userInProgressAttempts[examObj.id];
          const isExpired = new Date(inProgressAtt.expectedEndAt).getTime() < Date.now();
          if (!isExpired) {
            examObj.userAttemptStatus = 'in_progress';
            examObj.userLastAttemptId = inProgressAtt.id;
          } else {
            // Expired attempt -> locked as completed
            examObj.userAttemptStatus = 'completed';
            examObj.status = 'completed';
            examObj.userLastAttemptId = inProgressAtt.id;
            examObj.userScore = inProgressAtt.score ?? 0;
          }
        }
      }

      exams.push(examObj);
    });

    // Ensure official ministerial exams are present if missing from Firestore query
    const ensureOfficialExam = (officialExam: Exam) => {
      if (exams.some(e => e.id === officialExam.id)) return;

      // Subject filtration
      if (subjectFilter && subjectFilter !== 'all' && officialExam.subject !== subjectFilter) {
        return;
      }

      // Branch filtration
      if (userBranch && userBranch !== 'all') {
        if (userBranch === 'أدبي' && officialExam.branch === 'علمي') return;
        if (userBranch === 'علمي' && officialExam.branch === 'أدبي') return;
      }

      const examObj: Exam = { ...officialExam };
      if (currentUserId) {
        let att = userSubmittedAttempts[examObj.id];
        if (!att && typeof window !== 'undefined') {
          try {
            const rawCompleted = localStorage.getItem(`arixon_completed_exam_${examObj.id}`);
            if (rawCompleted) {
              const parsed = JSON.parse(rawCompleted);
              att = {
                id: parsed.attemptId || `att_${currentUserId}_${examObj.id}`,
                examId: examObj.id,
                userId: currentUserId,
                status: 'submitted',
                score: parsed.score ?? 0,
                submittedAt: parsed.submittedAt || new Date().toISOString(),
              } as ExamAttempt;
            }
          } catch {}
        }

        if (att) {
          examObj.userAttemptStatus = 'completed';
          examObj.status = 'completed';
          examObj.userLastAttemptId = att.id;
          examObj.userScore = att.score ?? 0;
        } else if (userInProgressAttempts[examObj.id]) {
          const inProgressAtt = userInProgressAttempts[examObj.id];
          const isExpired = new Date(inProgressAtt.expectedEndAt).getTime() < Date.now();
          if (!isExpired) {
            examObj.userAttemptStatus = 'in_progress';
            examObj.userLastAttemptId = inProgressAtt.id;
          } else {
            examObj.userAttemptStatus = 'completed';
            examObj.status = 'completed';
            examObj.userLastAttemptId = inProgressAtt.id;
            examObj.userScore = inProgressAtt.score ?? 0;
          }
        }
      }

      exams.push(examObj);
    };

    ensureOfficialExam(ISLAMIC_EXAM);
    ensureOfficialExam(FIRST_EXAM);
    ensureOfficialExam(LITERARY_EXAM);

    // Sort by createdAt descending
    exams.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return exams;
  } catch (error) {
    console.error('Error in getExamsList:', error);
    return [ISLAMIC_EXAM, FIRST_EXAM, LITERARY_EXAM];
  }
}

/**
 * Fetch a single exam details
 */
export async function getExamById(examId: string): Promise<Exam | null> {
  try {
    const examDoc = await getDoc(doc(db, 'exams', examId));
    if (examDoc.exists()) {
      return { id: examDoc.id, ...(examDoc.data() as Omit<Exam, 'id'>) };
    }
    if (examId === ISLAMIC_EXAM_ID || examId === 'exam_islamic_tw2009_01') {
      return ISLAMIC_EXAM;
    }
    if (examId === FIRST_EXAM_ID || examId === 'exam_physics_tw2009_01') {
      return FIRST_EXAM;
    }
    if (examId === LITERARY_EXAM_ID || examId === 'exam_arabic_tw2009_01') {
      return LITERARY_EXAM;
    }
    return null;
  } catch (error) {
    console.error('Error fetching exam by ID:', error);
    if (examId === ISLAMIC_EXAM_ID || examId === 'exam_islamic_tw2009_01') {
      return ISLAMIC_EXAM;
    }
    if (examId === FIRST_EXAM_ID || examId === 'exam_physics_tw2009_01') {
      return FIRST_EXAM;
    }
    if (examId === LITERARY_EXAM_ID || examId === 'exam_arabic_tw2009_01') {
      return LITERARY_EXAM;
    }
    return null;
  }
}

/**
 * Fetch questions for an exam without exposing correct answers or explanations
 */
export async function getExamQuestions(examId: string): Promise<Question[]> {
  // First, retrieve the exam document to know its intended question count, subject, and title
  let examObj: Exam | null = null;
  try {
    const examDoc = await getDoc(doc(db, 'exams', examId));
    if (examDoc.exists()) {
      examObj = { id: examDoc.id, ...(examDoc.data() as Omit<Exam, 'id'>) };
    }
  } catch (err) {
    console.warn('Note reading exam metadata in getExamQuestions:', err);
  }

  const isMinisterialArabic = 
    examId === LITERARY_EXAM_ID || 
    examId === 'exam_arabic_tw2009_01';

  const isMinisterialPhysics = 
    examId === FIRST_EXAM_ID || 
    examId === 'exam_physics_tw2009_01';

  const isMinisterialIslamic = 
    examId === ISLAMIC_EXAM_ID || 
    examId === 'exam_islamic_tw2009_01';

  try {
    const qCol = collection(db, 'exams', examId, 'questions');
    const snap = await getDocs(query(qCol, orderBy('order', 'asc')));
    const questions: Question[] = [];

    snap.forEach((d) => {
      const data = d.data() as Question;
      questions.push({
        id: d.id,
        examId,
        questionText: data.questionText,
        options: data.options,
        difficulty: data.difficulty,
        source: data.source,
        points: data.points,
        order: data.order,
        questionType: data.questionType,
        media: data.media,
        hint: data.hint,
      });
    });

    // If subcollection returned questions, ALWAYS return them intact
    if (questions.length > 0) {
      return questions;
    }

    // Fallback ONLY for the official ministerial exams if Firestore subcollection is empty
    if (isMinisterialArabic) {
      return LITERARY_EXAM_QUESTIONS.map(q => ({
        id: q.id,
        examId,
        questionText: q.questionText,
        options: q.options,
        difficulty: q.difficulty,
        source: q.source,
        points: q.points,
        order: q.order,
        questionType: q.questionType,
        hint: q.hint,
      }));
    }

    if (isMinisterialPhysics) {
      return FIRST_EXAM_QUESTIONS.map(q => ({
        id: q.id,
        examId,
        questionText: q.questionText,
        options: q.options,
        difficulty: q.difficulty,
        source: q.source,
        points: q.points,
        order: q.order,
        questionType: q.questionType,
        hint: q.hint,
      }));
    }

    if (isMinisterialIslamic) {
      return ISLAMIC_EXAM_QUESTIONS.map(q => ({
        id: q.id,
        examId,
        questionText: q.questionText,
        options: q.options,
        difficulty: q.difficulty,
        source: q.source,
        points: q.points,
        order: q.order,
        questionType: q.questionType,
        hint: q.hint,
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching exam questions:', error);
    if (isMinisterialArabic) {
      return LITERARY_EXAM_QUESTIONS.map(q => ({
        id: q.id,
        examId,
        questionText: q.questionText,
        options: q.options,
        difficulty: q.difficulty,
        source: q.source,
        points: q.points,
        order: q.order,
        questionType: q.questionType,
        hint: q.hint,
      }));
    }
    if (isMinisterialPhysics) {
      return FIRST_EXAM_QUESTIONS.map(q => ({
        id: q.id,
        examId,
        questionText: q.questionText,
        options: q.options,
        difficulty: q.difficulty,
        source: q.source,
        points: q.points,
        order: q.order,
        questionType: q.questionType,
        hint: q.hint,
      }));
    }
    if (isMinisterialIslamic) {
      return ISLAMIC_EXAM_QUESTIONS.map(q => ({
        id: q.id,
        examId,
        questionText: q.questionText,
        options: q.options,
        difficulty: q.difficulty,
        source: q.source,
        points: q.points,
        order: q.order,
        questionType: q.questionType,
        hint: q.hint,
      }));
    }
    return [];
  }
}

/**
 * Start or resume an exam attempt for a user
 * Supports practice retakes with isRetake=true, auto-closes expired attempts
 */
export async function startOrResumeAttempt(
  examId: string, 
  userId: string, 
  userDisplayName?: string,
  isRetake = false
): Promise<{ attempt: ExamAttempt; questions: Question[]; isResumed: boolean }> {
  const exam = await getExamById(examId);
  if (!exam) {
    throw new Error('الامتحان غير موجود.');
  }

  // 1. Check for existing attempts for this user and exam
  const attemptsRef = collection(db, 'attempts');
  const q = query(
    attemptsRef, 
    where('userId', '==', userId), 
    where('examId', '==', examId)
  );
  const snap = await getDocs(q);

  let inProgressAttempt: ExamAttempt | null = null;
  let completedAttempt: ExamAttempt | null = null;

  snap.forEach((d) => {
    const data = d.data() as ExamAttempt;
    if (data.status === 'in_progress') {
      inProgressAttempt = { ...data, id: d.id };
    } else if (data.status === 'submitted') {
      if (!completedAttempt || new Date(data.submittedAt || 0) > new Date(completedAttempt.submittedAt || 0)) {
        completedAttempt = { ...data, id: d.id };
      }
    }
  });

  // If there is an active in_progress attempt, check whether time has expired
  if (inProgressAttempt) {
    const inProg = inProgressAttempt as ExamAttempt;
    const now = Date.now();
    const end = new Date(inProg.expectedEndAt).getTime();
    if (now < end && !isRetake) {
      const questions = await getExamQuestions(examId);
      return { attempt: inProg, questions, isResumed: true };
    } else if (now >= end) {
      // Auto-submit expired attempt so it transitions to submitted and never hangs
      console.log(`[ExamService] In-progress attempt ${inProg.id} has expired. Auto-submitting...`);
      try {
        const autoSub = await submitExamAttempt(inProg.id, userId);
        completedAttempt = autoSub;
        inProgressAttempt = null;
      } catch (autoErr) {
        console.warn('[ExamService] Auto-submit expired attempt error:', autoErr);
      }
    }
  }

  // If completed and not requesting a retake, return completed attempt
  if (completedAttempt && !isRetake) {
    const questions = await getExamQuestions(examId);
    return { attempt: completedAttempt, questions, isResumed: true };
  }

  // Create new attempt (initial attempt or practice retake)
  const startedAt = new Date();
  const durationMs = (exam.durationMinutes || 20) * 60 * 1000;
  const expectedEndAt = new Date(startedAt.getTime() + durationMs);

  const attemptId = `att_${userId.slice(0, 8)}_${examId}_${Date.now()}`;
  const newAttempt: ExamAttempt = {
    id: attemptId,
    userId,
    examId,
    examVersion: exam.version || 1,
    examTitle: exam.title,
    examSubject: exam.subjectNameAr || exam.subject,
    lesson: exam.lesson,
    totalPoints: exam.totalPoints,
    startedAt: startedAt.toISOString(),
    expectedEndAt: expectedEndAt.toISOString(),
    submittedAt: null,
    status: 'in_progress',
    score: null,
    pointsEarned: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    unanswered: 0,
    durationSeconds: 0,
    lastSavedAt: startedAt.toISOString(),
    isRetake: !!completedAttempt || isRetake,
  };

  const attemptDocRef = doc(db, 'attempts', attemptId);
  try {
    await setDoc(attemptDocRef, newAttempt);
  } catch (err: any) {
    console.warn('Could not save attempt to Firestore, saving to local cache:', err?.message);
  }
  try {
    localStorage.setItem(`arixon_attempt_${attemptId}`, JSON.stringify(newAttempt));
  } catch {}

  const questions = await getExamQuestions(examId);
  return { attempt: newAttempt, questions, isResumed: false };
}

/**
 * Save user's selected answer for a question with diagnostic Step B logging
 */
export async function saveQuestionAnswer(
  attemptId: string, 
  questionId: string, 
  selectedAnswer: number | null
): Promise<void> {
  // Always save in localStorage as instant reliable backup
  try {
    const localAnswersKey = `arixon_attempt_answers_${attemptId}`;
    const existing = JSON.parse(localStorage.getItem(localAnswersKey) || '{}');
    existing[questionId] = selectedAnswer;
    localStorage.setItem(localAnswersKey, JSON.stringify(existing));
  } catch {}

  console.log(`[ExamSubmission] Step B: Saving answer in attempts/${attemptId}/answers/${questionId} (value: ${selectedAnswer})`);

  try {
    const answerRef = doc(db, 'attempts', attemptId, 'answers', questionId);
    const now = new Date().toISOString();
    await setDoc(answerRef, {
      questionId,
      selectedAnswer,
      answeredAt: now,
      updatedAt: now,
    });

    // Touch attempt lastSavedAt
    const attemptRef = doc(db, 'attempts', attemptId);
    await updateDoc(attemptRef, {
      lastSavedAt: now,
    });
    console.log(`[ExamSubmission] Step B: Successfully wrote answer to attempts/${attemptId}/answers/${questionId}`);
  } catch (error: any) {
    console.warn(`[ExamSubmission] Step B: Firestore answer write failed for ${questionId} (saved locally): code=${error?.code}, message=${error?.message}`);
  }
}

/**
 * Fetch all saved answers for an active attempt
 */
export async function getSavedAnswersForAttempt(attemptId: string): Promise<Record<string, number | null>> {
  try {
    const answersCol = collection(db, 'attempts', attemptId, 'answers');
    const snap = await getDocs(answersCol);
    const answers: Record<string, number | null> = {};
    snap.forEach((d) => {
      const data = d.data();
      answers[data.questionId] = data.selectedAnswer;
    });
    if (Object.keys(answers).length > 0) {
      return answers;
    }
  } catch (error) {
    console.warn('Could not fetch saved answers from Firestore, falling back to local storage:', error);
  }

  try {
    const localAnswersKey = `arixon_attempt_answers_${attemptId}`;
    const raw = localStorage.getItem(localAnswersKey);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

/**
 * Get an attempt by ID
 */
export async function getAttemptById(attemptId: string, userId: string): Promise<ExamAttempt | null> {
  try {
    const attemptDoc = await getDoc(doc(db, 'attempts', attemptId));
    if (attemptDoc.exists()) {
      const data = attemptDoc.data() as ExamAttempt;
      if (data.userId === userId) {
        return { ...data, id: attemptDoc.id };
      }
    }
  } catch {}

  try {
    const raw = localStorage.getItem(`arixon_attempt_${attemptId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as ExamAttempt;
      if (parsed.userId === userId) return parsed;
    }
  } catch {}
  return null;
}

/**
 * Fetch student's completed exam attempts history
 */
export async function getUserExamHistory(userId: string): Promise<ExamAttempt[]> {
  try {
    const attemptsRef = collection(db, 'attempts');
    const q = query(
      attemptsRef,
      where('userId', '==', userId),
      where('status', 'in', ['submitted', 'submitted_pending'])
    );
    const snap = await getDocs(q);
    const history: ExamAttempt[] = [];
    snap.forEach((d) => {
      history.push({ ...(d.data() as ExamAttempt), id: d.id });
    });
    history.sort((a, b) => new Date(b.submittedAt || b.startedAt).getTime() - new Date(a.submittedAt || a.startedAt).getTime());
    return history;
  } catch (error) {
    console.error('Error fetching exam history:', error);
    return [];
  }
}

/**
 * Submit and Grade Exam with server-time validation, scoring, and atomic profile points update.
 * Authoritative Server-Side Grading via /api/exams/grade with comprehensive diagnostic logging.
 */
export async function submitExamAttempt(
  attemptId: string, 
  userId: string,
  answersOverride?: Record<string, number | null>
): Promise<ExamAttempt> {
  // 1. Gather all answers from state override or storage
  const savedAnswers: Record<string, number | null> = { ...(answersOverride || await getSavedAnswersForAttempt(attemptId)) };

  // Fetch current attempt document from Firestore or local cache
  let attemptData: any = {};
  try {
    const attemptDoc = await getDoc(doc(db, 'attempts', attemptId));
    if (attemptDoc.exists()) {
      attemptData = attemptDoc.data() || {};
    }
  } catch (attErr) {
    console.warn(`[ExamSubmission] Notice reading attempt document ${attemptId}:`, attErr);
  }

  // (أ) Step A Diagnostic Log: Answer count in state before submit
  console.log(`[ExamSubmission] Step A: State answers count before submit: ${Object.keys(savedAnswers).length}`, savedAnswers);

  // (ب) Step B Diagnostic Log & Batch Write: Write answers to attempts/{id}/answers in parallel (max 2.5s)
  console.log(`[ExamSubmission] Step B: Writing all ${Object.keys(savedAnswers).length} answers in parallel...`);
  const answerEntries = Object.entries(savedAnswers).filter(([_, val]) => val !== null && val !== undefined);
  if (answerEntries.length > 0) {
    const writePromises = answerEntries.map(async ([qId, val]) => {
      try {
        const answerRef = doc(db, 'attempts', attemptId, 'answers', qId);
        const now = new Date().toISOString();
        await setDoc(answerRef, {
          questionId: qId,
          selectedAnswer: val,
          answeredAt: now,
          updatedAt: now,
        }, { merge: true });
      } catch (saveErr: any) {
        console.warn(`[ExamSubmission] Step B: Answer write warning for [${qId}]: code=${saveErr?.code}, message=${saveErr?.message}`);
      }
    });

    await Promise.race([
      Promise.allSettled(writePromises),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
    console.log(`[ExamSubmission] Step B: Answers parallel sync complete.`);
  }

  // (ج) Step C: Grading request to /api/exams/grade with 20s timeout and up to 2 auto-retries
  console.log(`[ExamSubmission] Step C: Initiating server grading request for attempt: ${attemptId}...`);
  
  let idToken = '';
  try {
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken();
    }
  } catch (tErr) {
    console.warn('[ExamSubmission] Could not retrieve ID token:', tErr);
  }

  const computedDurationUsed = attemptData.startedAt 
    ? Math.max(1, Math.round((Date.now() - new Date(attemptData.startedAt).getTime()) / 1000))
    : (attemptData.durationSeconds || 60);

  let serverStatus = 0;
  let serverResult: any = null;
  let lastError: any = null;
  const MAX_RETRIES = 2; // Total 3 attempts (1 initial + 2 retries)

  for (let retryIndex = 0; retryIndex <= MAX_RETRIES; retryIndex++) {
    const isRetry = retryIndex > 0;
    if (isRetry) {
      console.log(`[ExamSubmission] Step C: Retry attempt ${retryIndex} of ${MAX_RETRIES} for attempt: ${attemptId}...`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * retryIndex));
    }

    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(), 20000); // 20s timeout

    try {
      const res = await fetch('/api/exams/grade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          attemptId,
          answers: savedAnswers,
          clientAttemptData: {
            ...attemptData,
            id: attemptId,
            examId: attemptData.examId,
            userId,
            startedAt: attemptData.startedAt,
            expectedEndAt: attemptData.expectedEndAt,
            examTitle: attemptData.examTitle,
            totalPoints: attemptData.totalPoints,
            isRetake: attemptData.isRetake,
            durationUsed: computedDurationUsed,
            durationSeconds: computedDurationUsed,
          },
          idToken,
        }),
        signal: abortController.signal,
      });

      clearTimeout(timeoutHandle);
      serverStatus = res.status;
      serverResult = await res.json();
      console.log(`[ExamSubmission] Step C: Server grading response status: ${serverStatus}`, serverResult);

      if (serverResult && (serverResult.ok || serverResult.success)) {
        break; // Successfully graded!
      } else {
        lastError = {
          code: serverResult?.code || 'WRITE_FAILED',
          step: serverResult?.step || 'SERVER_GRADING',
          line: serverResult?.line,
          message: serverResult?.message || serverResult?.error || 'تعذّر التسليم، حاول مرة ثانية.',
        };
      }
    } catch (netErr: any) {
      clearTimeout(timeoutHandle);
      const isAbort = netErr?.name === 'AbortError' || netErr?.message?.includes('aborted');
      console.warn(`[ExamSubmission] Step C: Network ${isAbort ? 'timeout (20s)' : 'error'} on attempt ${retryIndex + 1}:`, netErr?.message);
      lastError = {
        code: isAbort ? 'TIMEOUT' : 'WRITE_FAILED',
        step: 'NETWORK_REQUEST',
        message: isAbort ? 'انتهت مهلة الاتصال بالخادم (20 ثانية).' : 'حدث خطأ في شبكة الاتصال.',
      };
    }
  }

  // If server responded with error after all retries, engage SAFETY NET:
  if (!serverResult || (!serverResult.ok && !serverResult.success)) {
    console.warn(`[ExamSubmission] Step C: Server grading failed after retries. Engaging SAFETY NET (submitted_pending)...`);
    
    try {
      const now = new Date().toISOString();
      const attemptDocRef = doc(db, 'attempts', attemptId);
      
      // Safety Net: Save attempt status as submitted_pending with student answers directly to Firestore
      await updateDoc(attemptDocRef, {
        status: 'submitted_pending',
        submittedAt: now,
        lastSavedAt: now,
        pendingReason: lastError?.message || 'Server grading deferred',
        answers: savedAnswers,
      });

      const pendingAttempt: ExamAttempt = {
        id: attemptId,
        userId,
        examId: '',
        status: 'submitted_pending',
        pendingReason: lastError?.message || 'Server grading deferred',
        submittedAt: now,
        expectedEndAt: now,
        startedAt: now,
        score: null,
        pointsEarned: 0,
        correctAnswers: 0,
        wrongAnswers: 0,
        unanswered: 0,
        durationSeconds: 0,
        lastSavedAt: now,
      };

      try {
        localStorage.setItem(`arixon_attempt_${attemptId}`, JSON.stringify(pendingAttempt));
      } catch {}

      console.log(`[ExamSubmission] Step C: Safety net succeeded. Attempt marked as submitted_pending.`);
      return pendingAttempt;
    } catch (safetyErr: any) {
      console.error(`[ExamSubmission] Step C: Safety net failed:`, safetyErr);
      const err: any = new Error(lastError?.message || 'تعذّر التسليم، حاول مرة ثانية.');
      err.code = lastError?.code || 'WRITE_FAILED';
      err.step = lastError?.step || 'SAFETY_NET_WRITE';
      err.line = lastError?.line;
      throw err;
    }
  }

  const gradedAttempt = serverResult.attempt;
  const reviews: QuestionReview[] = serverResult.reviews || [];

  // (د) Step D Diagnostic Log: Attempt status and breakdown after submission
  console.log(`[ExamSubmission] Step D: Attempt status after submission: status=${gradedAttempt.status}, score=${gradedAttempt.score}%, correct=${gradedAttempt.correctCount}, wrong=${gradedAttempt.wrongCount}, unanswered=${gradedAttempt.unansweredCount}, pointsEarned=${gradedAttempt.pointsEarned}`);

  // Non-blocking best-effort client sync if requiresClientSync (so student is never kept waiting)
  if (serverResult.requiresClientSync) {
    (async () => {
      try {
        const attemptDocRef = doc(db, 'attempts', attemptId);
        await updateDoc(attemptDocRef, {
          status: 'submitted',
          submittedAt: gradedAttempt.submittedAt,
          score: gradedAttempt.score,
          correctCount: gradedAttempt.correctCount,
          correctAnswers: gradedAttempt.correctAnswers,
          wrongCount: gradedAttempt.wrongCount,
          wrongAnswers: gradedAttempt.wrongAnswers,
          unansweredCount: gradedAttempt.unansweredCount,
          unanswered: gradedAttempt.unanswered,
          pointsEarned: gradedAttempt.pointsEarned,
          durationSeconds: gradedAttempt.durationSeconds,
          durationUsed: gradedAttempt.durationUsed,
          reviews,
        });
      } catch (syncErr: any) {
        console.warn('[ExamSubmission] Client attempt sync notice:', syncErr?.message);
      }

      if (serverResult.isFirstCompletion && gradedAttempt.pointsEarned > 0) {
        try {
          const userDocRef = doc(db, 'users', userId);
          await runTransaction(db, async (transaction) => {
            const uSnap = await transaction.get(userDocRef);
            if (uSnap.exists()) {
              const uData = uSnap.data() as UserProfile;
              transaction.update(userDocRef, {
                totalPoints: (uData.totalPoints || 0) + gradedAttempt.pointsEarned,
                weeklyPoints: (uData.weeklyPoints || 0) + gradedAttempt.pointsEarned,
                monthlyPoints: (uData.monthlyPoints || 0) + gradedAttempt.pointsEarned,
                examsCompleted: (uData.examsCompleted || 0) + 1,
                correctAnswers: (uData.correctAnswers || 0) + gradedAttempt.correctCount,
                wrongAnswers: (uData.wrongAnswers || 0) + gradedAttempt.wrongCount,
                updatedAt: new Date().toISOString(),
              });
            }
          });

          const pubRef = doc(db, 'publicProfiles', userId);
          const pubSnap = await getDoc(pubRef);
          const curPoints = pubSnap.exists() ? (pubSnap.data().totalPoints || 0) : 0;
          await setDoc(pubRef, {
            totalPoints: curPoints + gradedAttempt.pointsEarned,
            points: curPoints + gradedAttempt.pointsEarned,
            examsCompleted: (pubSnap.exists() ? (pubSnap.data().examsCompleted || 0) : 0) + 1,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (ptsErr: any) {
          console.warn('[ExamSubmission] Client points sync notice:', ptsErr?.message);
        }
      }
    })().catch(() => {});
  }

  // Update localStorage cache
  try {
    localStorage.setItem(`arixon_attempt_${attemptId}`, JSON.stringify({ ...gradedAttempt, reviews }));
    const finalExamId = gradedAttempt.examId || attemptData.examId;
    if (finalExamId) {
      localStorage.setItem(`arixon_completed_exam_${finalExamId}`, JSON.stringify({
        attemptId,
        examId: finalExamId,
        score: gradedAttempt.score,
        status: 'completed',
        submittedAt: gradedAttempt.submittedAt,
      }));
    }
  } catch {}

  // Also update locally cached profile points
  try {
    const cacheKey = `arixon_cached_profile_${userId}`;
    const rawProfile = localStorage.getItem(cacheKey);
    if (rawProfile && serverResult.pointsAwarded > 0) {
      const uData = JSON.parse(rawProfile);
      uData.totalPoints = (uData.totalPoints || 0) + serverResult.pointsAwarded;
      uData.weeklyPoints = (uData.weeklyPoints || 0) + serverResult.pointsAwarded;
      uData.monthlyPoints = (uData.monthlyPoints || 0) + serverResult.pointsAwarded;
      uData.examsCompleted = (uData.examsCompleted || 0) + 1;
      uData.correctAnswers = (uData.correctAnswers || 0) + gradedAttempt.correctCount;
      uData.wrongAnswers = (uData.wrongAnswers || 0) + gradedAttempt.wrongCount;
      localStorage.setItem(cacheKey, JSON.stringify(uData));
    }
  } catch {}

  return { ...gradedAttempt, reviews } as ExamAttempt & { reviews: QuestionReview[] };
}

/**
 * Fetch reviews for an attempt with auto-repair if attempt suffered from fallback bug
 */
export async function getAttemptReviews(attemptId: string, userId: string): Promise<QuestionReview[]> {
  try {
    const attemptDoc = await getDoc(doc(db, 'attempts', attemptId));
    if (!attemptDoc.exists()) return [];
    const attemptData = attemptDoc.data() as ExamAttempt;
    if (attemptData.userId !== userId) {
      throw new Error('غير مصرح بالوصول لمراجعة هذا الامتحان.');
    }

    const savedReviews = (attemptData.reviews as QuestionReview[]) || [];

    // Check if reviews suffered from the fallback bug:
    const hasPhysicsMismatch = attemptData.examId !== FIRST_EXAM_ID && 
      savedReviews.some(r => r.questionText?.includes('الزخم الخطي') || r.questionId === 'q1');
    const hasLiteraryMismatch = attemptData.examId !== LITERARY_EXAM_ID &&
      savedReviews.some(r => r.questionId?.startsWith('lit_') || r.questionText?.includes('كم الاستفهامية') || r.questionText?.includes('البحر الخفيف'));
    const hasIslamicMismatch = attemptData.examId !== ISLAMIC_EXAM_ID &&
      savedReviews.some(r => r.questionId?.startsWith('isl_') || r.questionText?.includes('القرآن الكريم والسنة'));

    if (savedReviews.length > 0 && !hasPhysicsMismatch && !hasLiteraryMismatch && !hasIslamicMismatch) {
      return savedReviews;
    }

    // Reconstruct reviews using the actual exam questions
    const questions = await getExamQuestions(attemptData.examId);
    const answers = (attemptData as any).answers || (await getSavedAnswersForAttempt(attemptId));
    if (questions.length > 0) {
      const repairedReviews: QuestionReview[] = questions.map((q, idx) => {
        const studentAns = answers[q.id] !== undefined ? answers[q.id] : null;
        const isUnanswered = studentAns === null || studentAns === undefined;
        
        const islamicQ = attemptData.examId === ISLAMIC_EXAM_ID
          ? ISLAMIC_EXAM_QUESTIONS.find(iq => iq.id === q.id || iq.order === q.order)
          : undefined;

        const correctAns = islamicQ?.correctAnswer !== undefined
          ? islamicQ.correctAnswer
          : ((q as any).correctAnswer !== undefined ? Number((q as any).correctAnswer) : 0);

        const isCorrect = !isUnanswered && Number(studentAns) === Number(correctAns);
        const pts = q.points || (attemptData.examId === ISLAMIC_EXAM_ID ? 1 : 5);
        return {
          questionId: q.id,
          questionNumber: q.order || (idx + 1),
          questionText: q.questionText,
          options: q.options,
          studentAnswer: studentAns,
          correctAnswer: correctAns,
          isCorrect,
          isUnanswered,
          explanation: islamicQ?.explanation || (q as any).explanation || '',
          hint: q.hint || islamicQ?.hint || '',
          points: pts,
          pointsEarned: isCorrect ? pts : 0,
          source: q.source || 'أريكسون',
        };
      });
      return repairedReviews;
    }

    return savedReviews;
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }
}
