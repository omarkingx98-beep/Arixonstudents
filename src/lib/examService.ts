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
import { db } from './firebase';
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
  type QuestionWithKey
} from '../data/firstExamData';
import {
  LITERARY_EXAM,
  LITERARY_EXAM_ID,
  LITERARY_EXAM_QUESTIONS,
} from '../data/literaryExamData';

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

        const keyRef = doc(db, 'exams', FIRST_EXAM_ID, 'answerKeys', q.id);
        await setDoc(keyRef, {
          id: q.id,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          hint: q.hint,
          solutionSteps: q.solutionSteps,
          formulaUsed: q.formulaUsed,
          distractorAnalysis: q.distractorAnalysis,
        }, { merge: true });
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
          hint: q.hint,
        };
        await setDoc(qRef, publicQuestionData, { merge: true });

        const keyRef = doc(db, 'exams', LITERARY_EXAM_ID, 'answerKeys', q.id);
        await setDoc(keyRef, {
          id: q.id,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          hint: q.hint,
          solutionSteps: q.solutionSteps,
          distractorAnalysis: q.distractorAnalysis,
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
        if (att.status === 'submitted') {
          const prev = userSubmittedAttempts[att.examId];
          if (!prev || new Date(att.submittedAt || 0) > new Date(prev.submittedAt || 0)) {
            userSubmittedAttempts[att.examId] = att;
          }
        } else if (att.status === 'in_progress') {
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
          if (['physics', 'chemistry', 'biology', 'geology'].includes(examSub) || examBranch === 'علمي') {
            return; // Never show Physics/Chemistry/Biology/Geology in Literary
          }
        }

        // Scientific track (علمي): strictly exclude literary-only subjects
        if (userBranch === 'علمي') {
          if (['history', 'geography', 'financial_culture'].includes(examSub) || examBranch === 'أدبي') {
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
        if (userSubmittedAttempts[examObj.id]) {
          const att = userSubmittedAttempts[examObj.id];
          examObj.userAttemptStatus = 'completed';
          examObj.status = 'completed';
          examObj.userLastAttemptId = att.id;
          examObj.userScore = att.score ?? 0;
        } else if (userInProgressAttempts[examObj.id]) {
          const att = userInProgressAttempts[examObj.id];
          const isExpired = new Date(att.expectedEndAt).getTime() < Date.now();
          if (!isExpired) {
            examObj.userAttemptStatus = 'in_progress';
            examObj.userLastAttemptId = att.id;
          } else {
            // Expired attempt -> locked as completed
            examObj.userAttemptStatus = 'completed';
            examObj.status = 'completed';
            examObj.userLastAttemptId = att.id;
            examObj.userScore = att.score ?? 0;
          }
        }
      }

      exams.push(examObj);
    });

    // Sort by createdAt descending
    exams.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return exams;
  } catch (error) {
    console.error('Error in getExamsList:', error);
    return [];
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
    return null;
  } catch (error) {
    console.error('Error fetching exam by ID:', error);
    return null;
  }
}

/**
 * Fetch questions for an exam without exposing correct answers or explanations
 */
export async function getExamQuestions(examId: string): Promise<Question[]> {
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

    // Fallback to full initial question set if questions in subcollection are incomplete or empty
    const isArabicExam = examId === LITERARY_EXAM_ID || examId.includes('arabic') || examId.includes('lit');
    const isPhysicsExam = examId === FIRST_EXAM_ID || examId.includes('physics');

    if (isArabicExam && questions.length < 15) {
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
    if (isPhysicsExam && questions.length < 20) {
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

    return questions;
  } catch (error) {
    console.error('Error fetching exam questions:', error);
    const isArabicExam = examId === LITERARY_EXAM_ID || examId.includes('arabic') || examId.includes('lit');
    const isPhysicsExam = examId === FIRST_EXAM_ID || examId.includes('physics');

    if (isArabicExam) {
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
    if (isPhysicsExam) {
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
    return [];
  }
}

/**
 * Start or resume an exam attempt for a user
 */
export async function startOrResumeAttempt(
  examId: string, 
  userId: string, 
  userDisplayName?: string
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
      completedAttempt = { ...data, id: d.id };
    }
  });

  // Strict one-time rule: Once completed, retake is strictly prohibited
  if (completedAttempt) {
    const questions = await getExamQuestions(examId);
    return { attempt: completedAttempt, questions, isResumed: true };
  }

  // If there is an active in_progress attempt, check whether time has expired
  if (inProgressAttempt) {
    const inProg = inProgressAttempt as ExamAttempt;
    const now = Date.now();
    const end = new Date(inProg.expectedEndAt).getTime();
    if (now < end) {
      const questions = await getExamQuestions(examId);
      return { attempt: inProg, questions, isResumed: true };
    }
  }

  // Otherwise, create a new attempt
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
  };

  const attemptDocRef = doc(db, 'attempts', attemptId);
  try {
    await setDoc(attemptDocRef, newAttempt);
  } catch (err) {
    console.warn('Could not save attempt to Firestore, saving to local cache:', err);
  }
  try {
    localStorage.setItem(`arixon_attempt_${attemptId}`, JSON.stringify(newAttempt));
  } catch {}

  const questions = await getExamQuestions(examId);
  return { attempt: newAttempt, questions, isResumed: false };
}

/**
 * Save user's selected answer for a question
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
  } catch (error) {
    console.warn('Firestore answer save failed (saved locally):', error);
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
      where('status', '==', 'submitted')
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
 * Submit and Grade Exam with server-time validation, scoring, and atomic profile points update
 */
export async function submitExamAttempt(
  attemptId: string, 
  userId: string,
  answersOverride?: Record<string, number | null>
): Promise<ExamAttempt> {
  // 1. Fetch attempt
  let attempt: ExamAttempt | null = null;
  const attemptDocRef = doc(db, 'attempts', attemptId);
  try {
    const attemptSnap = await getDoc(attemptDocRef);
    if (attemptSnap.exists()) {
      attempt = { ...(attemptSnap.data() as ExamAttempt), id: attemptSnap.id };
    }
  } catch {}

  if (!attempt) {
    try {
      const raw = localStorage.getItem(`arixon_attempt_${attemptId}`);
      if (raw) {
        attempt = JSON.parse(raw) as ExamAttempt;
      }
    } catch {}
  }

  if (!attempt) {
    throw new Error('محاولة الامتحان غير موجودة.');
  }

  if (attempt.userId !== userId) {
    throw new Error('لا تملك صلاحية تسليم هذا الامتحان.');
  }

  // Idempotency: if already submitted, return it
  if (attempt.status === 'submitted') {
    return { ...attempt, id: attemptId };
  }

  // 2. Fetch questions with answer keys
  let questionsWithKeys: QuestionWithKey[] = [];
  const isSubmissionArabic = attempt.examId === LITERARY_EXAM_ID || 
    attempt.examId.includes('arabic') || 
    attempt.examId.includes('lit') || 
    (attempt.examSubject && attempt.examSubject.includes('عرب'));
  const isSubmissionPhysics = attempt.examId === FIRST_EXAM_ID || 
    attempt.examId.includes('physics') || 
    (attempt.examSubject && attempt.examSubject.includes('فيزياء'));

  if (isSubmissionPhysics) {
    questionsWithKeys = FIRST_EXAM_QUESTIONS;
  } else if (isSubmissionArabic) {
    questionsWithKeys = LITERARY_EXAM_QUESTIONS;
  } else {
    // For other exams, fetch questions from Firestore
    try {
      const qCol = collection(db, 'exams', attempt.examId, 'questions');
      const qSnap = await getDocs(query(qCol, orderBy('order', 'asc')));
      for (const d of qSnap.docs) {
        const qData = d.data() as any;
        let correctAnswer = qData.correctAnswer ?? 0;
        let explanation = qData.explanation ?? '';
        let hint = qData.hint ?? '';
        let solutionSteps = qData.solutionSteps ?? null;
        let distractorAnalysis = qData.distractorAnalysis ?? null;

        try {
          const keyDoc = await getDoc(doc(db, 'exams', attempt.examId, 'answerKeys', d.id));
          if (keyDoc.exists()) {
            const keyData = keyDoc.data();
            if (keyData.correctAnswer !== undefined) correctAnswer = keyData.correctAnswer;
            if (keyData.explanation) explanation = keyData.explanation;
            if (keyData.hint) hint = keyData.hint;
            if (keyData.solutionSteps) solutionSteps = keyData.solutionSteps;
            if (keyData.distractorAnalysis) distractorAnalysis = keyData.distractorAnalysis;
          }
        } catch {
          // If answerKeys reading fails, qData has fallback
        }

        questionsWithKeys.push({
          id: d.id,
          examId: attempt.examId,
          order: qData.order || (questionsWithKeys.length + 1),
          questionText: qData.questionText || '',
          options: qData.options || [],
          difficulty: qData.difficulty || 'medium',
          source: qData.source || 'أريكسون',
          points: qData.points || 5,
          questionType: qData.questionType || 'multiple_choice',
          correctAnswer,
          explanation,
          hint,
          solutionSteps,
          distractorAnalysis,
        });
      }
    } catch (err) {
      console.error('Error fetching questions for exam submission:', err);
    }
  }

  // 3. Load student answers
  const savedAnswers = answersOverride || await getSavedAnswersForAttempt(attemptId);

  // 4. Calculate score & breakdown
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let pointsEarned = 0;
  const reviews: QuestionReview[] = [];

  for (const q of questionsWithKeys) {
    const studentAns = savedAnswers[q.id] !== undefined ? savedAnswers[q.id] : null;
    const isUnanswered = studentAns === null;
    const isCorrect = !isUnanswered && Number(studentAns) === Number(q.correctAnswer);

    if (isCorrect) {
      correctCount++;
      pointsEarned += (q.points || 5);
    } else if (isUnanswered) {
      unansweredCount++;
    } else {
      wrongCount++;
    }

    reviews.push({
      questionId: q.id,
      questionNumber: q.order,
      questionText: q.questionText,
      options: q.options,
      studentAnswer: studentAns,
      correctAnswer: q.correctAnswer,
      isCorrect,
      isUnanswered,
      explanation: q.explanation,
      hint: q.hint,
      solutionSteps: q.solutionSteps,
      formulaUsed: q.formulaUsed,
      distractorAnalysis: q.distractorAnalysis || undefined,
      points: q.points || 5,
      pointsEarned: isCorrect ? (q.points || 5) : 0,
      source: q.source,
    });
  }

  const now = new Date();
  const startTime = new Date(attempt.startedAt).getTime();
  const durationSeconds = Math.max(0, Math.floor((now.getTime() - startTime) / 1000));
  const totalExamPoints = attempt.totalPoints || (questionsWithKeys.length * 5) || 100;
  const finalScore = Math.min(100, Math.round((pointsEarned / totalExamPoints) * 100));

  const submittedAttempt: ExamAttempt = {
    ...attempt,
    id: attemptId,
    status: 'submitted',
    submittedAt: now.toISOString(),
    score: finalScore,
    pointsEarned,
    correctAnswers: correctCount,
    wrongAnswers: wrongCount,
    unanswered: unansweredCount,
    durationSeconds,
    lastSavedAt: now.toISOString(),
  };

  // 5. Save submitted attempt with reviews to Firestore and local cache
  try {
    await updateDoc(attemptDocRef, {
      status: 'submitted',
      submittedAt: now.toISOString(),
      score: finalScore,
      pointsEarned,
      correctAnswers: correctCount,
      wrongAnswers: wrongCount,
      unanswered: unansweredCount,
      durationSeconds,
      lastSavedAt: now.toISOString(),
      reviews,
    });
  } catch (err) {
    console.warn('Could not update Firestore attempt status (saved locally):', err);
  }

  try {
    localStorage.setItem(`arixon_attempt_${attemptId}`, JSON.stringify({ ...submittedAttempt, reviews }));
  } catch {}

  // 6. Update user's profile statistics in Firestore & local cache (totalPoints, weeklyPoints, monthlyPoints)
  try {
    const userDocRef = doc(db, 'users', userId);
    await runTransaction(db, async (transaction) => {
      const uSnap = await transaction.get(userDocRef);
      if (uSnap.exists()) {
        const uData = uSnap.data() as UserProfile;
        transaction.update(userDocRef, {
          totalPoints: (uData.totalPoints || 0) + pointsEarned,
          weeklyPoints: (uData.weeklyPoints || 0) + pointsEarned,
          monthlyPoints: (uData.monthlyPoints || 0) + pointsEarned,
          examsCompleted: (uData.examsCompleted || 0) + 1,
          correctAnswers: (uData.correctAnswers || 0) + correctCount,
          wrongAnswers: (uData.wrongAnswers || 0) + wrongCount,
          lastActiveAt: now.toISOString(),
          updatedAt: now.toISOString(),
        });
      }
    });

    // Also sync points and exams completed to public profile
    const pubRef = doc(db, 'publicProfiles', userId);
    const pubSnap = await getDoc(pubRef);
    const currentPubPoints = pubSnap.exists() ? (pubSnap.data().totalPoints || 0) : 0;
    const currentPubWeekly = pubSnap.exists() ? (pubSnap.data().weeklyPoints || 0) : 0;
    const currentPubMonthly = pubSnap.exists() ? (pubSnap.data().monthlyPoints || 0) : 0;
    const currentPubExams = pubSnap.exists() ? (pubSnap.data().examsCompleted || 0) : 0;
    await setDoc(pubRef, {
      totalPoints: currentPubPoints + pointsEarned,
      weeklyPoints: currentPubWeekly + pointsEarned,
      monthlyPoints: currentPubMonthly + pointsEarned,
      examsCompleted: currentPubExams + 1,
      correctAnswers: (pubSnap.exists() ? (pubSnap.data().correctAnswers || 0) : 0) + correctCount,
      wrongAnswers: (pubSnap.exists() ? (pubSnap.data().wrongAnswers || 0) : 0) + wrongCount,
      updatedAt: now.toISOString(),
    }, { merge: true });
  } catch (transErr) {
    console.warn('Error updating user stats in Firestore:', transErr);
  }

  // Also update locally cached profile
  try {
    const cacheKey = `arixon_cached_profile_${userId}`;
    const rawProfile = localStorage.getItem(cacheKey);
    if (rawProfile) {
      const uData = JSON.parse(rawProfile);
      uData.totalPoints = (uData.totalPoints || 0) + pointsEarned;
      uData.weeklyPoints = (uData.weeklyPoints || 0) + pointsEarned;
      uData.monthlyPoints = (uData.monthlyPoints || 0) + pointsEarned;
      uData.examsCompleted = (uData.examsCompleted || 0) + 1;
      uData.correctAnswers = (uData.correctAnswers || 0) + correctCount;
      uData.wrongAnswers = (uData.wrongAnswers || 0) + wrongCount;
      uData.lastActiveAt = now.toISOString();
      uData.updatedAt = now.toISOString();
      localStorage.setItem(cacheKey, JSON.stringify(uData));
    }
  } catch {}

  return { ...submittedAttempt, reviews } as ExamAttempt & { reviews: QuestionReview[] };
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
    // e.g., examId is NOT physics FIRST_EXAM_ID, but savedReviews contains physics questions
    const hasPhysicsMismatch = attemptData.examId !== FIRST_EXAM_ID && 
      savedReviews.some(r => r.questionText?.includes('الزخم الخطي') || r.questionId === 'q1');

    if (savedReviews.length > 0 && !hasPhysicsMismatch) {
      return savedReviews;
    }

    // Auto-repair: reconstruct reviews from actual exam questions and saved student answers!
    const savedAnswers = await getSavedAnswersForAttempt(attemptId);
    let questionsWithKeys: QuestionWithKey[] = [];

    if (attemptData.examId === FIRST_EXAM_ID) {
      questionsWithKeys = FIRST_EXAM_QUESTIONS;
    } else if (attemptData.examId === LITERARY_EXAM_ID) {
      questionsWithKeys = LITERARY_EXAM_QUESTIONS;
    } else {
      const qCol = collection(db, 'exams', attemptData.examId, 'questions');
      const qSnap = await getDocs(query(qCol, orderBy('order', 'asc')));
      for (const d of qSnap.docs) {
        const qData = d.data() as any;
        let correctAnswer = qData.correctAnswer ?? 0;
        let explanation = qData.explanation ?? '';
        let hint = qData.hint ?? '';
        let solutionSteps = qData.solutionSteps ?? null;
        let distractorAnalysis = qData.distractorAnalysis ?? null;
        try {
          const keyDoc = await getDoc(doc(db, 'exams', attemptData.examId, 'answerKeys', d.id));
          if (keyDoc.exists()) {
            const k = keyDoc.data();
            if (k.correctAnswer !== undefined) correctAnswer = k.correctAnswer;
            if (k.explanation) explanation = k.explanation;
            if (k.hint) hint = k.hint;
            if (k.solutionSteps) solutionSteps = k.solutionSteps;
            if (k.distractorAnalysis) distractorAnalysis = k.distractorAnalysis;
          }
        } catch {}
        questionsWithKeys.push({
          id: d.id,
          examId: attemptData.examId,
          order: qData.order || (questionsWithKeys.length + 1),
          questionText: qData.questionText || '',
          options: qData.options || [],
          difficulty: qData.difficulty || 'medium',
          source: qData.source || 'أريكسون',
          points: qData.points || 5,
          questionType: qData.questionType || 'multiple_choice',
          correctAnswer,
          explanation,
          hint,
          solutionSteps,
          distractorAnalysis,
        });
      }
    }

    if (questionsWithKeys.length === 0) {
      return savedReviews;
    }

    // Reconstruct reviews
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    let pointsEarned = 0;
    const reconstructedReviews: QuestionReview[] = [];

    for (const q of questionsWithKeys) {
      const studentAns = savedAnswers[q.id] !== undefined ? savedAnswers[q.id] : null;
      const isUnanswered = studentAns === null;
      const isCorrect = !isUnanswered && Number(studentAns) === Number(q.correctAnswer);

      if (isCorrect) {
        correctCount++;
        pointsEarned += (q.points || 5);
      } else if (isUnanswered) {
        unansweredCount++;
      } else {
        wrongCount++;
      }

      reconstructedReviews.push({
        questionId: q.id,
        questionNumber: q.order,
        questionText: q.questionText,
        options: q.options,
        studentAnswer: studentAns,
        correctAnswer: q.correctAnswer,
        isCorrect,
        isUnanswered,
        explanation: q.explanation,
        hint: q.hint,
        solutionSteps: q.solutionSteps,
        formulaUsed: q.formulaUsed,
        distractorAnalysis: q.distractorAnalysis,
        points: q.points || 5,
        pointsEarned: isCorrect ? (q.points || 5) : 0,
        source: q.source,
      });
    }

    // Persist repaired reviews and score back to Firestore attempt doc
    try {
      const totalExamPoints = attemptData.totalPoints || (questionsWithKeys.length * 5) || 100;
      const finalScore = Math.min(100, Math.round((pointsEarned / totalExamPoints) * 100));
      await updateDoc(doc(db, 'attempts', attemptId), {
        reviews: reconstructedReviews,
        score: finalScore,
        pointsEarned,
        correctAnswers: correctCount,
        wrongAnswers: wrongCount,
        unanswered: unansweredCount,
      });

      // Credit missing points to user profile and public profile if score was previously 0
      const pointDifference = pointsEarned - (attemptData.pointsEarned || 0);
      if (pointDifference > 0) {
        try {
          const userDocRef = doc(db, 'users', userId);
          const uSnap = await getDoc(userDocRef);
          if (uSnap.exists()) {
            const uData = uSnap.data() as UserProfile;
            const newTotal = (uData.totalPoints || 0) + pointDifference;
            const newWeekly = (uData.weeklyPoints || 0) + pointDifference;
            const newMonthly = (uData.monthlyPoints || 0) + pointDifference;
            await updateDoc(userDocRef, {
              totalPoints: newTotal,
              weeklyPoints: newWeekly,
              monthlyPoints: newMonthly,
              correctAnswers: (uData.correctAnswers || 0) + correctCount,
              updatedAt: new Date().toISOString(),
            });

            // Sync to publicProfile
            const pubRef = doc(db, 'publicProfiles', userId);
            await setDoc(pubRef, {
              totalPoints: newTotal,
              weeklyPoints: newWeekly,
              monthlyPoints: newMonthly,
              correctAnswers: (uData.correctAnswers || 0) + correctCount,
              updatedAt: new Date().toISOString(),
            }, { merge: true });

            // Update localStorage cached profile
            const cacheKey = `arixon_cached_profile_${userId}`;
            const rawProfile = localStorage.getItem(cacheKey);
            if (rawProfile) {
              const parsed = JSON.parse(rawProfile);
              parsed.totalPoints = newTotal;
              parsed.weeklyPoints = newWeekly;
              parsed.monthlyPoints = newMonthly;
              localStorage.setItem(cacheKey, JSON.stringify(parsed));
            }
          }
        } catch (credErr) {
          console.warn('Notice crediting repaired exam points:', credErr);
        }
      }

      // Update attempt in localStorage cache
      try {
        localStorage.setItem(`arixon_attempt_${attemptId}`, JSON.stringify({
          ...attemptData,
          reviews: reconstructedReviews,
          score: finalScore,
          pointsEarned,
          correctAnswers: correctCount,
          wrongAnswers: wrongCount,
          unanswered: unansweredCount,
        }));
      } catch {}
    } catch (saveErr) {
      console.warn('Notice saving repaired reviews to attempt:', saveErr);
    }

    return reconstructedReviews;
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }
}
