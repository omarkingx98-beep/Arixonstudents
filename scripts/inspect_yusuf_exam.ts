import { getRestCollection } from '../api/_lib/firestoreRest.js';

const idToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjkwNGIwZjkxYmU2ZWIwODY3ZGFiYmFhYjU4N2RmYzJlMzNmMDBhMjQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vYXJpeG9uc3R1ZGVudHMtZDkwMmEiLCJhdWQiOiJhcml4b25zdHVkZW50cy1kOTAyYSIsImF1dGhfdGltZSI6MTc5MjY2Mjc2MCwidXNlcl9pZCI6ImV3ZXZnN0dtS3dQU0FLNzc1QnNDdGJiSkkybDEiLCJzdWIiOiJld2V2ZzdHbUt3UFNBSzc3NUJzQ3RiYkpJMmwxIiwiaWF0IjoxNzkyNjYyNzYwLCJleHAiOjE3OTI2NjYzNjAsImVtYWlsIjoidGVzdF9kaWFnQGV4YW1wbGUuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJmaXJlYmFzZSI6eyJpZGVudGl0aWVzIjp7ImVtYWlsIjpbInRlc3RfZGlhZ0BleGFtcGxlLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6InBhc3N3b3JkIn19.m5uO_Ir6Ep8JuixOVPCDRc9ra_YDk4es8C38FoJ6t_5SfN7rPRrpHxSVWHcnBIRTu4f0eB0YbiO8vz1jZpxwNxRgNoffF8ugTuNmhS5azTn2GUyGCzOPKe4l0OGB6iCRgzsxoyhF-pI_ZGZ5TyxWuRKzQDkuvkDfkCt-O0qUWLQqqzozze28BiK67grXsmtsMnnkVk-coeq5-V_Z62pim294ymjIcO-MkcXwUPeQ1088_4o3WTbwXgnXmhw6k_oopyP-A0rq3dJ39eGzbA3Vx073oq2VSMwTb1NsiihuMtqLp9CRkl_wDTeZtZ9WxSSx_q3ZcjFRifQadg8oKoo1qA";

async function printAllYusufQuestions() {
  const questions = await getRestCollection('exams/exam_1792050086667_12ri/questions', idToken);
  questions.sort((a, b) => (a.data.order || 0) - (b.data.order || 0));

  console.log(`TOTAL QUESTIONS IN exam_1792050086667_12ri: ${questions.length}`);
  questions.forEach((q, idx) => {
    const d = q.data;
    console.log(`Q${idx + 1} [id: ${q.id}, order: ${d.order}]:`);
    console.log(`  Text: ${d.questionText}`);
    console.log(`  Options: ${JSON.stringify(d.options)}`);
    console.log(`  correctAnswer field: ${d.correctAnswer} (${d.options?.[d.correctAnswer]})`);
    console.log(`  explanation: ${d.explanation}`);
  });
}

printAllYusufQuestions().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
