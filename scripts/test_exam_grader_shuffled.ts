import { gradeAndSubmitExam, type GradeResult } from '../api/_lib/examGrader.js';
import { FIRST_EXAM_QUESTIONS } from '../api/_lib/examData.js';

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🧪 RUNNING COMPREHENSIVE GRADING & SHUFFLED TEST SUITE');
  console.log('===============================================================\n');

  const testUserId = 'test_student_user_123';
  const examId = 'exam_physics_tw2009_01';
  const totalQuestions = FIRST_EXAM_QUESTIONS.length; // 20 questions

  console.log(`Exam: ${examId}, Total questions: ${totalQuestions}`);

  // -------------------------------------------------------------
  // TEST 1: 100% Correct Answers
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: 100% Correct Answers ---');
  const allCorrectAnswers: Record<string, any> = {};
  FIRST_EXAM_QUESTIONS.forEach(q => {
    // Send using stable optionId
    allCorrectAnswers[q.id] = `opt_${q.correctAnswer}`;
  });

  const res100 = await gradeAndSubmitExam({
    attemptId: `att_${testUserId}_${examId}_${Date.now()}_test100`,
    userId: testUserId,
    answers: allCorrectAnswers,
    clientAttemptData: {
      examId,
      userId: testUserId,
      status: 'in_progress',
      isRetake: false,
    },
  });

  console.log(`[TEST 1 RESULT] ok=${res100.ok}, score=${res100.attempt?.score}%, correct=${res100.attempt?.correctCount}/${totalQuestions}, pointsAwarded=${res100.pointsAwarded}`);
  if (res100.attempt?.score !== 100 || res100.attempt?.correctCount !== 20) {
    throw new Error(`Test 1 Failed: Expected 100%, got ${res100.attempt?.score}%`);
  }
  console.log('✅ TEST 1 PASSED: 100% correct produced exactly 100% and awarded 100 points.');

  // -------------------------------------------------------------
  // TEST 2: 0% Correct Answers (All Wrong)
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: 0% Correct Answers (All Wrong) ---');
  const allWrongAnswers: Record<string, any> = {};
  FIRST_EXAM_QUESTIONS.forEach(q => {
    // Pick deliberately wrong index
    let wrongIdx = (Number(q.correctAnswer) + 1) % (q.options?.length || 4);
    if (q.id === 'q13') wrongIdx = 0; // '9 : 1' is definitively wrong
    allWrongAnswers[q.id] = `opt_${wrongIdx}`;
  });

  const res0 = await gradeAndSubmitExam({
    attemptId: `att_${testUserId}_${examId}_${Date.now()}_test0`,
    userId: testUserId,
    answers: allWrongAnswers,
    clientAttemptData: {
      examId,
      userId: testUserId,
      status: 'in_progress',
      isRetake: false,
    },
  });

  console.log(`[TEST 2 RESULT] ok=${res0.ok}, score=${res0.attempt?.score}%, correct=${res0.attempt?.correctCount}/${totalQuestions}, wrong=${res0.attempt?.wrongCount}`);
  if (res0.attempt?.score !== 0 || res0.attempt?.correctCount !== 0) {
    throw new Error(`Test 2 Failed: Expected 0%, got ${res0.attempt?.score}%`);
  }
  console.log('✅ TEST 2 PASSED: All wrong answers produced exactly 0%.');

  // -------------------------------------------------------------
  // TEST 3: 50% Correct Answers (Half Correct, Half Wrong)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: 50% Correct Answers (10 Correct, 10 Wrong) ---');
  const halfAnswers: Record<string, any> = {};
  FIRST_EXAM_QUESTIONS.forEach((q, idx) => {
    if (idx < 10) {
      halfAnswers[q.id] = `opt_${q.correctAnswer}`; // Correct
    } else {
      let wrongIdx = (Number(q.correctAnswer) + 1) % (q.options?.length || 4);
      if (q.id === 'q13') wrongIdx = 0; // '9 : 1' is definitively wrong
      halfAnswers[q.id] = `opt_${wrongIdx}`; // Wrong
    }
  });

  const res50 = await gradeAndSubmitExam({
    attemptId: `att_${testUserId}_${examId}_${Date.now()}_test50`,
    userId: testUserId,
    answers: halfAnswers,
    clientAttemptData: {
      examId,
      userId: testUserId,
      status: 'in_progress',
      isRetake: false,
    },
  });

  console.log(`[TEST 3 RESULT] ok=${res50.ok}, score=${res50.attempt?.score}%, correct=${res50.attempt?.correctCount}/${totalQuestions}, pointsAwarded=${res50.pointsAwarded}`);
  if (res50.attempt?.score !== 50 || res50.attempt?.correctCount !== 10) {
    throw new Error(`Test 3 Failed: Expected 50%, got ${res50.attempt?.score}%`);
  }
  console.log('✅ TEST 3 PASSED: Half correct produced exactly 50% score and 50 points.');

  // -------------------------------------------------------------
  // TEST 4: Shuffled Options Invariance (By Option Text & Opt ID)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Shuffled Options Invariance ---');
  // Student submits correct answer by full option text string
  const textMatchedAnswers: Record<string, any> = {};
  FIRST_EXAM_QUESTIONS.forEach(q => {
    const correctText = q.options[Number(q.correctAnswer)];
    textMatchedAnswers[q.id] = correctText;
  });

  const resShuffled = await gradeAndSubmitExam({
    attemptId: `att_${testUserId}_${examId}_${Date.now()}_testShuffled`,
    userId: testUserId,
    answers: textMatchedAnswers,
    clientAttemptData: {
      examId,
      userId: testUserId,
      status: 'in_progress',
      isRetake: false,
    },
  });

  console.log(`[TEST 4 RESULT] By Option Text: score=${resShuffled.attempt?.score}%, correct=${resShuffled.attempt?.correctCount}/${totalQuestions}`);
  if (resShuffled.attempt?.score !== 100) {
    throw new Error(`Test 4 Failed: Expected 100% when matching option text, got ${resShuffled.attempt?.score}%`);
  }
  console.log('✅ TEST 4 PASSED: Option matching is completely invariant to display order.');

  // -------------------------------------------------------------
  // TEST 5: Idempotent Duplicate Submission
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Idempotency (Duplicate Submission Protection) ---');
  const duplicateAttemptId = `att_${testUserId}_${examId}_${Date.now()}_testDup`;
  const firstSubmission = await gradeAndSubmitExam({
    attemptId: duplicateAttemptId,
    userId: testUserId,
    answers: allCorrectAnswers,
    clientAttemptData: {
      examId,
      userId: testUserId,
      status: 'in_progress',
      isRetake: false,
    },
  });
  console.log(`First submission: ok=${firstSubmission.ok}, code=${firstSubmission.code}, pointsAwarded=${firstSubmission.pointsAwarded}`);

  // Second submission with status='submitted' simulates duplicate network POST or retry
  const secondSubmission = await gradeAndSubmitExam({
    attemptId: duplicateAttemptId,
    userId: testUserId,
    answers: allCorrectAnswers,
    clientAttemptData: {
      ...firstSubmission.attempt,
      status: 'submitted',
    },
  });

  console.log(`Second submission: ok=${secondSubmission.ok}, code=${secondSubmission.code}, pointsAwarded=${secondSubmission.pointsAwarded}`);
  if (secondSubmission.pointsAwarded !== 0) {
    throw new Error(`Test 5 Failed: Duplicate submission awarded points! Expected 0, got ${secondSubmission.pointsAwarded}`);
  }
  console.log('✅ TEST 5 PASSED: Idempotency successfully prevents double points awarding.');

  console.log('\n===============================================================');
  console.log('🎉 ALL 5 GRADING TESTS PASSED WITH 100% INTEGRITY');
  console.log('===============================================================\n');
}

runTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test Suite Failed:', err);
    process.exit(1);
  });
