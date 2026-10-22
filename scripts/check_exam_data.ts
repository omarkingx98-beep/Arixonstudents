import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { firebaseAppConfig } from '../api/_lib/config.js';

const app = initializeApp(firebaseAppConfig);
const db = getFirestore(app);

async function checkExams() {
  console.log('--- Checking Exam Docs in Firestore ---');
  const examIds = [
    'exam_1792050086667_12ri',
    'exam_physics_tw2009_01',
    'exam_arabic_tw2009_01'
  ];

  for (const id of examIds) {
    try {
      const examRef = doc(db, 'exams', id);
      const snap = await getDoc(examRef);
      if (snap.exists()) {
        console.log(`[EXAM FOUND] ${id}: title="${snap.data().title}", subject="${snap.data().subject}", qCount=${snap.data().questionCount}`);
      } else {
        console.log(`[EXAM NOT FOUND in exams collection] ${id}`);
      }

      // Check questions subcollection
      const qCol = collection(db, 'exams', id, 'questions');
      const qSnap = await getDocs(qCol);
      console.log(`  -> Questions subcollection count: ${qSnap.docs.length}`);
      qSnap.docs.slice(0, 3).forEach(d => {
        const qData = d.data();
        console.log(`     qId: ${d.id}, order: ${qData.order}, text: "${qData.questionText?.substring(0, 30)}...", options count: ${qData.options?.length}, correctAnswer in qDoc: ${qData.correctAnswer}`);
      });

      // Check answerKeys subcollection
      try {
        const keyCol = collection(db, 'exams', id, 'answerKeys');
        const kSnap = await getDocs(keyCol);
        console.log(`  -> answerKeys subcollection count: ${kSnap.docs.length}`);
        kSnap.docs.slice(0, 3).forEach(d => {
          const kData = d.data();
          console.log(`     keyId: ${d.id}, correctAnswer: ${kData.correctAnswer}, explanation: "${kData.explanation?.substring(0, 30)}..."`);
        });
      } catch (keyErr: any) {
        console.log(`  -> answerKeys read error: ${keyErr?.code} ${keyErr?.message}`);
      }
    } catch (err: any) {
      console.log(`[ERROR checking ${id}]:`, err?.message);
    }
  }
}

checkExams().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
