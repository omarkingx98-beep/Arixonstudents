import { gradeAndSubmitExam } from '../api/_lib/examGrader.js';

async function runDiagnostics() {
  console.log('=== RUNNING GRADING DIAGNOSTIC TESTS ===\n');

  // Test Case 1: Physics exam with auto-inferred attemptId
  console.log('--- TEST 1: exam_physics_tw2009_01 (Ministerial Physics) ---');
  const resPhysics = await gradeAndSubmitExam({
    attemptId: 'att_nx6mwRpr_exam_physics_tw2009_01_1792489129668',
    userId: 'nx6mwRprBDYyPMqS4Qxq5V3DDHO2',
    answers: {
      'q1': 0,
      'q2': 0,
      'q3': 1,
    },
    clientAttemptData: {
      examId: 'exam_physics_tw2009_01',
      userId: 'nx6mwRprBDYyPMqS4Qxq5V3DDHO2',
      status: 'in_progress',
    },
  });

  console.log('Test 1 Result:', {
    ok: resPhysics.ok,
    code: resPhysics.code,
    message: resPhysics.message,
    step: resPhysics.step,
    score: resPhysics.attempt?.score,
    questionsGraded: resPhysics.reviews?.length,
  });

  // Test Case 2: Custom Exam exam_1792050086667_12ri when clientAttemptData was missing examId
  console.log('\n--- TEST 2: Custom Exam with missing examId in payload (The Root Cause Path) ---');
  const resMissingExamId = await gradeAndSubmitExam({
    attemptId: 'att_nx6mwRpr_exam_1792050086667_12ri_1792489129668',
    userId: 'nx6mwRprBDYyPMqS4Qxq5V3DDHO2',
    answers: {
      'q1': 0,
      'q2': 1,
    },
    clientAttemptData: {
      // Notice: examId missing or undefined from broken client payload!
      userId: 'nx6mwRprBDYyPMqS4Qxq5V3DDHO2',
      status: 'in_progress',
    },
  });

  console.log('Test 2 Result (Auto-recovery check):', {
    ok: resMissingExamId.ok,
    code: resMissingExamId.code,
    message: resMissingExamId.message,
    step: resMissingExamId.step,
    line: resMissingExamId.line,
  });

  // Test Case 3: Missing Attempt ID (Input Validation)
  console.log('\n--- TEST 3: Validation Error: Missing Attempt ID ---');
  const resValidation = await gradeAndSubmitExam({
    attemptId: '',
    userId: 'nx6mwRprBDYyPMqS4Qxq5V3DDHO2',
    answers: {},
  });

  console.log('Test 3 Result:', {
    ok: resValidation.ok,
    code: resValidation.code,
    message: resValidation.message,
    step: resValidation.step,
    line: resValidation.line,
  });

  // Test Case 4: Ownership mismatch
  console.log('\n--- TEST 4: Ownership Mismatch ---');
  const resOwnership = await gradeAndSubmitExam({
    attemptId: 'att_otherUser_exam_physics_tw2009_01_1792489129668',
    userId: 'nx6mwRprBDYyPMqS4Qxq5V3DDHO2',
    answers: {},
    clientAttemptData: {
      examId: 'exam_physics_tw2009_01',
      userId: 'different_user_123',
    },
  });

  console.log('Test 4 Result:', {
    ok: resOwnership.ok,
    code: resOwnership.code,
    message: resOwnership.message,
    step: resOwnership.step,
    line: resOwnership.line,
  });

  console.log('\n=== DIAGNOSTIC TESTS COMPLETE ===');
}

runDiagnostics().catch(console.error);
