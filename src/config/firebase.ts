import * as admin from 'firebase-admin';
import * as fs from 'fs';

let db: admin.firestore.Firestore | null = null;

export function initializeFirebase(): admin.firestore.Firestore | null {
  try {
    // 서비스 계정 키 파일 경로 (환경변수 또는 기본 경로)
    const serviceAccountPath =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      db = admin.firestore();
      console.log('✅ Firebase Firestore 연결 성공');
    } else {
      console.warn('⚠️  Firebase 서비스 계정 파일이 없습니다:', serviceAccountPath);
      console.warn(
        '   저장 기능을 사용하려면 firebase-service-account.json 파일을 프로젝트 루트에 추가하세요.'
      );
    }
  } catch (error) {
    console.error('❌ Firebase 초기화 오류:', (error as Error).message);
  }

  return db;
}

export function getFirestore(): admin.firestore.Firestore | null {
  return db;
}

export { admin };
