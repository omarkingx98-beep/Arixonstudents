import { getRestDoc, getRestCollection } from '../api/_lib/firestoreRest.js';

// The idToken we just obtained from Firebase Auth
const idToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjkwNGIwZjkxYmU2ZWIwODY3ZGFiYmFhYjU4N2RmYzJlMzNmMDBhMjQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vYXJpeG9uc3R1ZGVudHMtZDkwMmEiLCJhdWQiOiJhcml4b25zdHVkZW50cy1kOTAyYSIsImF1dGhfdGltZSI6MTc5MjY2Mjc2MCwidXNlcl9pZCI6ImV3ZXZnN0dtS3dQU0FLNzc1QnNDdGJiSkkybDEiLCJzdWIiOiJld2V2ZzdHbUt3UFNBSzc3NUJzQ3RiYkpJMmwxIiwiaWF0IjoxNzkyNjYyNzYwLCJleHAiOjE3OTI2NjYzNjAsImVtYWlsIjoidGVzdF9kaWFnQGV4YW1wbGUuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbInRlc3RfZGlhZ0BleGFtcGxlLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6InBhc3N3b3JkIn19.m5uO_Ir6Ep8JuixOVPCDRc9ra_YDk4es8C38FoJ6t_5SfN7rPRrpHxSVWHcnBIRTu4f0eB0YbiO8vz1jZpxwNxRgNoffF8ugTuNmhS5azTn2GUyGCzOPKe4l0OGB6iCRgzsxoyhF-pI_ZGZ5TyxWuRKzQDkuvkDfkCt-O0qUWLQqqzozze28BiK67grXsmtsMnnkVk-coeq5-V_Z62pim294ymjIcO-MkcXwUPeQ1088_4o3WTbwXgnXmhw6k_oopyP-A0rq3dJ39eGzbA3Vx073oq2VSMwTb1NsiihuMtqLp9CRkl_wDTeZtZ9WxSSx_q3ZcjFRifQadg8oKoo1qA";

async function auditExams() {
  console.log('=== AUDITING EXAMS DATA ===');
  const examIds = [
    'exam_1792050086667_12ri',
    'exam_physics_tw2009_01',
    'exam_arabic_tw2009_01'
  ];

  for (const examId of examIds) {
    console.log(`\n========================================`);
    console.log(`Checking Exam: ${examId}`);
    const examDoc = await getRestDoc(`exams/${examId}`, idToken);
    if (!examDoc) {
      console.log(`  [EXAM NOT FOUND VIA REST]: ${examId}`);
    } else {
      console.log(`  [EXAM METADATA]: Title="${examDoc.title}", Subject="${examDoc.subject}", Published=${examDoc.published}, QuestionCount=${examDoc.questionCount}`);
    }

    const questions = await getRestCollection(`exams/${examId}/questions`, idToken);
    console.log(`  [QUESTIONS COUNT]: ${questions.length}`);

    // Also check answerKeys
    const keys = await getRestCollection(`exams/${examId}/answerKeys`, idToken);
    console.log(`  [ANSWER KEYS COUNT (as student)]: ${keys.length}`);

    questions.sort((a, b) => (a.data.order || 0) - (b.data.order || 0));

    questions.forEach((q, idx) => {
      const qd = q.data;
      const opts = qd.options || [];
      const correctAns = qd.correctAnswer;
      const correctText = (correctAns !== undefined && opts[correctAns] !== undefined) 
        ? opts[correctAns] 
        : `[INVALID/UNKNOWN INDEX: ${correctAns}]`;
      const isUniqueAndExists = correctAns !== undefined && correctAns >= 0 && correctAns < opts.length;

      console.log(`  #${idx + 1} (${q.id}) [Order: ${qd.order}]: "${(qd.questionText || '').substring(0, 45)}..."`);
      console.log(`      Options (${opts.length}): ${JSON.stringify(opts)}`);
      console.log(`      Correct Answer Index in Q: ${correctAns}`);
      console.log(`      Correct Option Text: "${correctText}" | Exists & Valid: ${isUniqueAndExists}`);
    });
  }
}

auditExams().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
