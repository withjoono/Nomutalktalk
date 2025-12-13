/**
 * RAG 문서 관리 시스템 마이그레이션 스크립트
 *
 * 기존 컬렉션 → 새 RAG 스키마로 데이터 마이그레이션
 *
 * 대상 컬렉션:
 * - records → rag_documents (type: other)
 * - problems → rag_documents (type: 유추)
 * - reference_problems → rag_documents (examType 기반)
 * - local_chunks → rag_chunks
 *
 * 사용법:
 *   node migrations/migrate_to_rag_system.js [--dry-run] [--collection=<name>]
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Firebase 초기화
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Firebase 서비스 계정 파일을 찾을 수 없습니다:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(path.resolve(serviceAccountPath));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 마이그레이션 설정
const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes('--dry-run');
const SPECIFIC_COLLECTION = process.argv.find(arg => arg.startsWith('--collection='))?.split('=')[1];

// 통계
const stats = {
  records: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  problems: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  reference_problems: { total: 0, migrated: 0, skipped: 0, errors: 0 },
  local_chunks: { total: 0, migrated: 0, skipped: 0, errors: 0 }
};

/**
 * 메인 마이그레이션 함수
 */
async function migrate() {
  console.log('=========================================');
  console.log('RAG 문서 관리 시스템 마이그레이션');
  console.log('=========================================');
  console.log(`모드: ${DRY_RUN ? '🔍 DRY RUN (변경 없음)' : '⚡ 실제 마이그레이션'}`);
  console.log(`대상: ${SPECIFIC_COLLECTION || '모든 컬렉션'}`);
  console.log('');

  const startTime = Date.now();

  try {
    // 1단계: 백업 확인
    if (!DRY_RUN) {
      console.log('⚠️  주의: 실제 마이그레이션을 진행합니다.');
      console.log('   데이터 백업을 완료했는지 확인하세요.');
      console.log('');
    }

    // 2단계: 컬렉션별 마이그레이션
    if (!SPECIFIC_COLLECTION || SPECIFIC_COLLECTION === 'records') {
      await migrateRecords();
    }

    if (!SPECIFIC_COLLECTION || SPECIFIC_COLLECTION === 'problems') {
      await migrateProblems();
    }

    if (!SPECIFIC_COLLECTION || SPECIFIC_COLLECTION === 'reference_problems') {
      await migrateReferenceProblems();
    }

    if (!SPECIFIC_COLLECTION || SPECIFIC_COLLECTION === 'local_chunks') {
      await migrateLocalChunks();
    }

    // 3단계: 결과 출력
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('');
    console.log('=========================================');
    console.log('마이그레이션 완료');
    console.log('=========================================');
    console.log(`소요 시간: ${elapsed}초`);
    console.log('');
    console.log('통계:');
    for (const [collection, stat] of Object.entries(stats)) {
      if (stat.total > 0) {
        console.log(`  ${collection}:`);
        console.log(`    - 전체: ${stat.total}`);
        console.log(`    - 마이그레이션: ${stat.migrated}`);
        console.log(`    - 건너뜀: ${stat.skipped}`);
        console.log(`    - 오류: ${stat.errors}`);
      }
    }

  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error);
    process.exit(1);
  }
}

/**
 * records 컬렉션 마이그레이션
 */
async function migrateRecords() {
  console.log('📦 records 컬렉션 마이그레이션 시작...');

  const snapshot = await db.collection('records').get();
  stats.records.total = snapshot.size;

  if (snapshot.empty) {
    console.log('   ✓ 마이그레이션할 데이터 없음');
    return;
  }

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    try {
      const oldData = doc.data();

      // 새 문서 스키마로 변환
      const newDocument = {
        documentType: 'other',
        title: `학습 기록 - ${oldData.subject || ''} ${oldData.course || ''}`.trim() || '학습 기록',
        description: oldData.request || '',
        originalFileName: 'legacy_record',
        mimeType: 'text/plain',
        fileSize: 0,
        status: 'indexed',
        chunkCount: 1,
        metadata: {
          category: 'learning_record',
          tags: [oldData.subject, oldData.course, oldData.type].filter(Boolean),
          description: oldData.request || '',
          customFields: {
            publisher: oldData.publisher || '',
            chapter: oldData.chapter || '',
            legacyId: doc.id
          }
        },
        createdAt: oldData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: oldData.updatedAt || admin.firestore.FieldValue.serverTimestamp(),
        _migrated: true,
        _migratedFrom: 'records',
        _migratedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // 대응 청크 생성
      const chunkContent = formatRecordAsChunk(oldData);
      const newChunk = {
        documentId: doc.id,
        documentType: 'other',
        content: chunkContent,
        contentType: 'problem',
        index: 0,
        problemData: {
          problemText: oldData.problem || '',
          solution: oldData.solution || ''
        },
        inheritedMetadata: {
          category: 'learning_record',
          subject: oldData.subject,
          course: oldData.course
        },
        tokenCount: estimateTokens(chunkContent),
        createdAt: oldData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        _migrated: true
      };

      if (!DRY_RUN) {
        const docRef = db.collection('rag_documents').doc(doc.id);
        const chunkRef = db.collection('rag_chunks').doc();

        batch.set(docRef, newDocument);
        batch.set(chunkRef, newChunk);

        batchCount += 2;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
          console.log(`   진행 중: ${stats.records.migrated + 1}/${stats.records.total}`);
        }
      }

      stats.records.migrated++;

    } catch (error) {
      console.error(`   오류 (${doc.id}):`, error.message);
      stats.records.errors++;
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  console.log(`   ✓ records 마이그레이션 완료: ${stats.records.migrated}/${stats.records.total}`);
}

/**
 * problems 컬렉션 마이그레이션
 */
async function migrateProblems() {
  console.log('📦 problems 컬렉션 마이그레이션 시작...');

  const snapshot = await db.collection('problems').get();
  stats.problems.total = snapshot.size;

  if (snapshot.empty) {
    console.log('   ✓ 마이그레이션할 데이터 없음');
    return;
  }

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    try {
      const oldData = doc.data();
      const oldMeta = oldData.metadata || {};

      // 문서 유형 결정
      const documentType = determineDocumentType(oldMeta);

      // 새 문서 스키마로 변환
      const newDocument = {
        documentType,
        title: `문제 - ${oldMeta.course || oldMeta.subject || ''}`.trim() || '문제',
        description: oldData.problemText?.substring(0, 200) || '',
        originalFileName: 'legacy_problem',
        mimeType: 'text/plain',
        fileSize: 0,
        status: oldData.ragIndexed ? 'indexed' : 'pending',
        chunkCount: 1,
        metadata: transformProblemMetadata(oldMeta, documentType),
        createdAt: oldData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: oldData.updatedAt || admin.firestore.FieldValue.serverTimestamp(),
        _migrated: true,
        _migratedFrom: 'problems',
        _migratedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // 대응 청크 생성
      const chunkContent = formatProblemAsChunk(oldData);
      const newChunk = {
        documentId: doc.id,
        documentType,
        content: chunkContent,
        contentType: 'problem',
        index: 0,
        problemData: {
          problemText: oldData.problemText || '',
          solution: oldData.solution || '',
          answer: oldData.answer || ''
        },
        inheritedMetadata: newDocument.metadata,
        tokenCount: estimateTokens(chunkContent),
        createdAt: oldData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        _migrated: true
      };

      if (!DRY_RUN) {
        const docRef = db.collection('rag_documents').doc(doc.id);
        const chunkRef = db.collection('rag_chunks').doc();

        batch.set(docRef, newDocument);
        batch.set(chunkRef, newChunk);

        batchCount += 2;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
          console.log(`   진행 중: ${stats.problems.migrated + 1}/${stats.problems.total}`);
        }
      }

      stats.problems.migrated++;

    } catch (error) {
      console.error(`   오류 (${doc.id}):`, error.message);
      stats.problems.errors++;
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  console.log(`   ✓ problems 마이그레이션 완료: ${stats.problems.migrated}/${stats.problems.total}`);
}

/**
 * reference_problems 컬렉션 마이그레이션
 */
async function migrateReferenceProblems() {
  console.log('📦 reference_problems 컬렉션 마이그레이션 시작...');

  const snapshot = await db.collection('reference_problems').get();
  stats.reference_problems.total = snapshot.size;

  if (snapshot.empty) {
    console.log('   ✓ 마이그레이션할 데이터 없음');
    return;
  }

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    try {
      const oldData = doc.data();
      const oldMeta = oldData.metadata || {};

      // 문서 유형 결정
      const documentType = determineDocumentType(oldMeta);

      // 새 문서 스키마로 변환
      const newDocument = {
        documentType,
        title: `참조 문제 - ${oldMeta.course || oldMeta.subject || ''}`.trim() || '참조 문제',
        description: oldData.problemText?.substring(0, 200) || '',
        originalFileName: 'reference_problem',
        mimeType: 'text/plain',
        fileSize: 0,
        status: oldData.ragIndexed ? 'indexed' : 'pending',
        ragDocumentName: oldData.ragDocumentName,
        chunkCount: 1,
        metadata: transformProblemMetadata(oldMeta, documentType),
        createdAt: oldData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: oldData.updatedAt || admin.firestore.FieldValue.serverTimestamp(),
        _migrated: true,
        _migratedFrom: 'reference_problems',
        _migratedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // 대응 청크 생성
      const chunkContent = formatProblemAsChunk(oldData);
      const newChunk = {
        documentId: doc.id,
        documentType,
        content: chunkContent,
        contentType: 'problem',
        index: 0,
        problemData: {
          problemText: oldData.problemText || '',
          solution: oldData.solution || '',
          answer: oldData.answer || ''
        },
        inheritedMetadata: newDocument.metadata,
        tokenCount: estimateTokens(chunkContent),
        createdAt: oldData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        _migrated: true
      };

      if (!DRY_RUN) {
        const docRef = db.collection('rag_documents').doc(doc.id);
        const chunkRef = db.collection('rag_chunks').doc();

        batch.set(docRef, newDocument);
        batch.set(chunkRef, newChunk);

        batchCount += 2;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
          console.log(`   진행 중: ${stats.reference_problems.migrated + 1}/${stats.reference_problems.total}`);
        }
      }

      stats.reference_problems.migrated++;

    } catch (error) {
      console.error(`   오류 (${doc.id}):`, error.message);
      stats.reference_problems.errors++;
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  console.log(`   ✓ reference_problems 마이그레이션 완료: ${stats.reference_problems.migrated}/${stats.reference_problems.total}`);
}

/**
 * local_chunks 컬렉션 마이그레이션
 */
async function migrateLocalChunks() {
  console.log('📦 local_chunks 컬렉션 마이그레이션 시작...');

  const snapshot = await db.collection('local_chunks').get();
  stats.local_chunks.total = snapshot.size;

  if (snapshot.empty) {
    console.log('   ✓ 마이그레이션할 데이터 없음');
    return;
  }

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    try {
      const oldData = doc.data();

      // 새 청크 스키마로 변환
      const newChunk = {
        documentId: oldData.documentId || 'unknown',
        documentType: 'other',
        content: oldData.content || '',
        contentType: 'concept',
        index: oldData.chunkIndex || oldData.index || 0,
        inheritedMetadata: oldData.metadata || {},
        tokenCount: estimateTokens(oldData.content || ''),
        createdAt: oldData.createdAt ? new Date(oldData.createdAt) : admin.firestore.FieldValue.serverTimestamp(),
        _migrated: true,
        _migratedFrom: 'local_chunks',
        _migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        _legacyDocumentName: oldData.documentName
      };

      if (!DRY_RUN) {
        const chunkRef = db.collection('rag_chunks').doc(doc.id);
        batch.set(chunkRef, newChunk);

        batchCount++;

        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
          console.log(`   진행 중: ${stats.local_chunks.migrated + 1}/${stats.local_chunks.total}`);
        }
      }

      stats.local_chunks.migrated++;

    } catch (error) {
      console.error(`   오류 (${doc.id}):`, error.message);
      stats.local_chunks.errors++;
    }
  }

  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }

  console.log(`   ✓ local_chunks 마이그레이션 완료: ${stats.local_chunks.migrated}/${stats.local_chunks.total}`);
}

// ==================== 유틸리티 함수 ====================

/**
 * 문서 유형 결정
 */
function determineDocumentType(metadata) {
  const examType = metadata.examType || '';

  if (examType.includes('수능')) return 'csat_past';
  if (examType.includes('6월') || examType.includes('9월') || examType.includes('평가원')) return 'csat_mock';
  if (examType.includes('모의')) return 'csat_mock';
  if (examType.includes('내신') || examType.includes('중간') || examType.includes('기말')) return 'school_exam';
  if (examType.includes('논술')) return 'university_essay';
  if (examType.includes('면접')) return 'university_interview';

  return 'other';
}

/**
 * 문제 메타데이터 변환
 */
function transformProblemMetadata(oldMeta, documentType) {
  const baseMeta = {
    domain: oldMeta.subject || '',
    subject: oldMeta.course || '',
    curriculum: '2015'
  };

  switch (documentType) {
    case 'csat_past':
    case 'csat_mock':
    case 'school_exam':
      return {
        ...baseMeta,
        examType: mapExamType(oldMeta.examType),
        year: parseInt(oldMeta.examYear) || new Date().getFullYear(),
        examInstitution: oldMeta.examInstitution || '',
        unit: {
          majorUnit: oldMeta.chapter || '',
          middleUnit: '',
          minorUnit: ''
        },
        problemNumber: 1,
        problemFormat: oldMeta.problemCategory?.includes('객관') ? 'multiple_choice' : 'descriptive',
        difficulty: oldMeta.difficulty || 'medium',
        knowledgeType: ['concept']
      };

    case 'university_essay':
      return {
        universityName: oldMeta.schoolName || oldMeta.university || '',
        year: parseInt(oldMeta.examYear) || new Date().getFullYear(),
        admissionType: '정시',
        problemNumber: '1',
        problemType: 'descriptive',
        units: [{
          majorUnit: oldMeta.chapter || '',
          middleUnit: '',
          minorUnit: ''
        }],
        difficulty: 'high',
        knowledgeType: ['reasoning'],
        thinkingProcess: ['problem_solving'],
        evaluationCompetency: ['수리적 사고력']
      };

    case 'university_interview':
      return {
        universityName: oldMeta.schoolName || oldMeta.university || '',
        department: oldMeta.department || '',
        year: parseInt(oldMeta.examYear) || new Date().getFullYear(),
        admissionType: '학종',
        interviewType: 'oral',
        originalQuestion: '',
        evaluationCompetencies: ['mathematical_thinking', 'logical_reasoning']
      };

    default:
      return {
        ...baseMeta,
        category: 'legacy_problem',
        tags: [oldMeta.subject, oldMeta.course, oldMeta.chapter].filter(Boolean)
      };
  }
}

/**
 * 시험 유형 매핑
 */
function mapExamType(oldType) {
  if (!oldType) return 'csat';
  if (oldType.includes('6월')) return 'eval_6';
  if (oldType.includes('9월')) return 'eval_9';
  if (oldType.includes('교육청')) return 'mock_edu';
  if (oldType.includes('사설')) return 'mock_private';
  if (oldType.includes('중간')) return 'school_mid';
  if (oldType.includes('기말')) return 'school_final';
  return 'csat';
}

/**
 * record를 청크 형태로 포맷
 */
function formatRecordAsChunk(data) {
  const parts = [];

  if (data.problem) {
    parts.push(`[문제]\n${data.problem}`);
  }

  if (data.solution) {
    parts.push(`\n[풀이]\n${data.solution}`);
  }

  return parts.join('\n');
}

/**
 * problem을 청크 형태로 포맷
 */
function formatProblemAsChunk(data) {
  const parts = [];

  if (data.problemText) {
    parts.push(`[문제]\n${data.problemText}`);
  }

  if (data.answer) {
    parts.push(`\n[정답]\n${data.answer}`);
  }

  if (data.solution) {
    parts.push(`\n[해설]\n${data.solution}`);
  }

  return parts.join('\n');
}

/**
 * 토큰 수 추정
 */
function estimateTokens(text) {
  if (!text) return 0;
  const koreanChars = (text.match(/[\uac00-\ud7af]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - koreanChars - englishWords * 5;
  return Math.ceil(koreanChars / 2 + englishWords * 1.3 + otherChars / 4);
}

// 마이그레이션 실행
migrate()
  .then(() => {
    console.log('');
    console.log('마이그레이션이 완료되었습니다.');
    process.exit(0);
  })
  .catch(error => {
    console.error('마이그레이션 실패:', error);
    process.exit(1);
  });
