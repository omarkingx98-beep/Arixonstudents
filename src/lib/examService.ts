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

  const isArabicExam = 
    examId === LITERARY_EXAM_ID || 
    examId.includes('arabic') || 
    examId.includes('lit') ||
    examObj?.subject === 'arabic' ||
    (examObj?.title && examObj.title.includes('عرب')) ||
    (examObj?.subjectNameAr && examObj.subjectNameAr.includes('عرب'));

  const isPhysicsExam = 
    examId === FIRST_EXAM_ID || 
    examId.includes('physics') ||
    examObj?.subject === 'physics' ||
    (examObj?.title && examObj.title.includes('فيزياء')) ||
    (examObj?.subjectNameAr && examObj.subjectNameAr.includes('فيزياء'));

  const expectedCount = examObj?.questionCount || (isArabicExam ? 15 : isPhysicsExam ? 20 : 15);

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

    // Fallback if questions in subcollection are incomplete (e.g. only 1 question was stored or seeded)
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

    // If subcollection returned valid questions
    if (questions.length >= expectedCount) {
      return questions;
    }

    // If subcollection had fewer questions than expectedCount (e.g. only 1 question), supplement or fallback
    if (questions.length > 0 && isArabicExam) {
      return LITERARY_EXAM_QUESTIONS.slice(0, expectedCount).map(q => ({
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

    if (questions.length > 0) {
      return questions;
    }

    // Default fallback if completely empty
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
  } catch (error) {
    console.error('Error fetching exam questions, activating fallback:', error);
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

  // (أ) Step A Diagnostic Log: Answer count in state before submit
  console.log(`[ExamSubmission] Step A: State answers count before submit: ${Object.keys(savedAnswers).length}`, savedAnswers);

  // (ب) Step B Diagnostic Log & Batch Write: Write each answer to attempts/{id}/answers
  console.log(`[ExamSubmission] Step B: Writing all ${Object.keys(savedAnswers).length} answers to attempts/${attemptId}/answers...`);
  for (const [qId, val] of Object.entries(savedAnswers)) {
    if (val !== null && val !== undefined) {
      try {
        const answerRef = doc(db, 'attempts', attemptId, 'answers', qId);
        const now = new Date().toISOString();
        await setDoc(answerRef, {
          questionId: qId,
          selectedAnswer: val,
          answeredAt: now,
          updatedAt: now,
        }, { merge: true });
        console.log(`[ExamSubmission] Step B: Successfully saved answer for question [${qId}] = ${val}`);
      } catch (saveErr: any) {
        console.warn(`[ExamSubmission] Step B: Answer write warning for [${qId}]: code=${saveErr?.code}, message=${saveErr?.message}`);
      }
    }
  }

  // (ج) Step C: Grading request to /api/exams/grade
  console.log(`[ExamSubmission] Step C: Initiating server grading request for attempt: ${attemptId}...`);
  
  let idToken = '';
  try {
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken();
    }
  } catch (tErr) {
    console.warn('[ExamSubmission] Could not retrieve ID token:', tErr);
  }

  let serverStatus = 0;
  let serverResult: any = null;

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
      }),
    });
    serverStatus = res.status;
    serverResult = await res.json();
    console.log(`[ExamSubmission] Step C: Server grading response status: ${serverStatus}`, serverResult);
  } catch (netErr: any) {
    console.error(`[ExamSubmission] Step C: Network error contacting /api/exams/grade:`, netErr);
  }

  // If server responded with error or not ok, throw real error - DO NOT return fake 0%!
  if (!serverResult || !serverResult.success) {
    const errMsg = serverResult?.error || 'تعذّر التسليم، حاول مرة ثانية.';
    console.error(`[ExamSubmission] Step C: Server grading failed: ${errMsg}`);
    throw new Error(errMsg);
  }

  const gradedAttempt = serverResult.attempt;
  const reviews: QuestionReview[] = serverResult.reviews || [];

  // (د) Step D Diagnostic Log: Attempt status and breakdown after submission
  console.log(`[ExamSubmission] Step D: Attempt status after submission: status=${gradedAttempt.status}, score=${gradedAttempt.score}%, correct=${gradedAttempt.correctCount}, wrong=${gradedAttempt.wrongCount}, unanswered=${gradedAttempt.unansweredCount}, pointsEarned=${gradedAttempt.pointsEarned}`);

  // If requiresClientSync (e.g. dev environment without service account), sync to Firestore
  if (serverResult.requiresClientSync) {
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

      // Update points in users collection if first completion
      if (serverResult.isFirstCompletion && gradedAttempt.pointsEarned > 0) {
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

        // Sync to publicProfiles
        const pubRef = doc(db, 'publicProfiles', userId);
        const pubSnap = await getDoc(pubRef);
        const curPoints = pubSnap.exists() ? (pubSnap.data().totalPoints || 0) : 0;
        await setDoc(pubRef, {
          totalPoints: curPoints + gradedAttempt.pointsEarned,
          points: curPoints + gradedAttempt.pointsEarned,
          examsCompleted: (pubSnap.exists() ? (pubSnap.data().examsCompleted || 0) : 0) + 1,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    } catch (syncErr: any) {
      console.warn('[ExamSubmission] Client sync notice:', syncErr?.message);
    }
  }

  // Update localStorage cache
  try {
    localStorage.setItem(`arixon_attempt_${attemptId}`, JSON.stringify({ ...gradedAttempt, reviews }));
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
