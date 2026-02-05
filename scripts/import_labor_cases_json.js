/**
 * JSON 형식의 노동 판례/행정해석 데이터 임포트 스크립트
 * Import script for Labor Cases and Administrative Interpretations (JSON format)
 */

const RAGAgent = require('../RAGAgent');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * JSON 판례 데이터를 메타데이터로 변환
 */
function convertCaseToMetadata(caseData) {
  // 사건번호 추출
  const caseNumberMatch = caseData.title.match(/사건번호\s*:\s*([^\n]+)/);
  const caseNumber = caseNumberMatch ? caseNumberMatch[1].trim() : '';

  // 회시번호 추출 (행정해석의 경우)
  const circularMatch = caseData.title.match(/회시번호\s*:\s*([^\n]+)/);
  const circularNumber = circularMatch ? circularMatch[1].trim() : '';

  // 법원/기관 유형 판단
  let courtType = 'unknown';
  let documentType = 'case'; // 기본값은 판례

  if (caseData.sub_category === '행정해석') {
    documentType = 'interpretation';
    courtType = 'administrative';
  } else if (caseData.sub_category.includes('대법')) {
    courtType = 'supreme';
  } else if (caseData.sub_category.includes('고법')) {
    courtType = 'high';
  } else if (caseData.sub_category.includes('지법')) {
    courtType = 'district';
  }

  // 키워드 추출 (제목에서)
  const keywords = extractKeywords(caseData.title + ' ' + caseData.content.substring(0, 500));

  // 카테고리 자동 감지
  const category = detectCategory(caseData.title + ' ' + caseData.content.substring(0, 500));

  return {
    cs_id: caseData.cs_id,
    courtName: documentType === 'interpretation' ? '행정해석' : caseData.sub_category,
    courtType: courtType,
    caseNumber: caseNumber || circularNumber,
    judgmentDate: caseData.date,
    subject: extractSubject(caseData.title),
    caseType: 'civil',
    documentType: documentType, // 'case' 또는 'interpretation'
    category: category,
    keywords: keywords,
    views: caseData.views,
    recommend: caseData.recommend,
    importance: calculateImportance(caseData),
    originalTitle: caseData.title,
    contentLength: caseData.content_length
  };
}

/**
 * 제목에서 주제 추출
 */
function extractSubject(title) {
  // 사건번호 다음의 내용을 주제로 추출
  const lines = title.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.includes('사건번호') && !line.includes('회시번호') && line.length > 10) {
      return line.substring(0, 100); // 첫 100자만
    }
  }
  return lines[0] || title.substring(0, 100);
}

/**
 * 중요도 계산 (조회수와 추천수 기반)
 */
function calculateImportance(caseData) {
  try {
    const views = parseInt(caseData.views.replace(/,/g, '')) || 0;
    const recommend = parseInt(caseData.recommend.replace(/[^0-9]/g, '')) || 0;

    // 조회수와 추천수를 기반으로 1-5 점수 산정
    if (views > 5000 || recommend > 100) return 5;
    if (views > 3000 || recommend > 50) return 4;
    if (views > 1000 || recommend > 20) return 3;
    if (views > 500) return 2;
    return 1;
  } catch (e) {
    return 3; // 기본값
  }
}

/**
 * 카테고리 자동 감지
 */
function detectCategory(text) {
  const categoryKeywords = {
    '근로계약': ['채용', '계약', '시용', '입사', '고용계약'],
    '임금': ['임금', '급여', '퇴직금', '수당', '최저임금', '통상임금', '평균임금', '연봉'],
    '근로시간': ['근로시간', '연장', '야간', '휴게', '탄력근로', '선택근무'],
    '휴가휴직': ['휴가', '휴직', '연차', '출산', '육아', '병가', '휴업'],
    '해고징계': ['해고', '징계', '부당해고', '정리해고', '면직', '파면', '해임'],
    '산재보험': ['산재', '재해', '요양', '휴업급여', '장해급여', '업무상 재해'],
    '고용보험': ['실업급여', '고용보험', '구직급여', '재취업'],
    '차별': ['차별', '비정규직', '성차별', '차별적 처우', '균등대우'],
    '노동조합': ['노조', '단체교섭', '쟁의', '부당노동행위', '단체협약', '파업'],
    '안전보건': ['안전', '보건', '산업안전', '중대재해', 'CSO'],
    '근로감독': ['근로감독', '시정명령', '과태료', '벌금']
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category;
    }
  }

  return '일반';
}

/**
 * 키워드 추출
 */
function extractKeywords(text) {
  const keywords = [];
  const keywordPatterns = [
    '근로시간', '임금', '퇴직금', '해고', '징계', '휴가', '휴직',
    '산재', '안전', '차별', '노조', '단체교섭', '연차', '수당',
    '정당한 이유', '부당해고', '최저임금', '통상임금', '평균임금',
    '연장근로', '야간근로', '휴일근로', '휴게시간', '탄력근로',
    '출산휴가', '육아휴직', '연차휴가', '병가',
    '정리해고', '징계해고', '면직', '징계', '시정명령',
    '산업재해', '업무상 재해', '요양급여', '휴업급여', '장해급여',
    '실업급여', '구직급여', '고용보험', '고용안정',
    '비정규직', '기간제', '단시간', '파견', '용역',
    '성차별', '임신', '출산', '육아', '괴롭힘',
    '부당노동행위', '단체협약', '단체교섭', '쟁의행위', '파업',
    '중대재해', 'CSO', '안전보건', '산업안전'
  ];

  keywordPatterns.forEach(keyword => {
    if (text.includes(keyword) && !keywords.includes(keyword)) {
      keywords.push(keyword);
    }
  });

  return keywords.slice(0, 10); // 최대 10개
}

/**
 * JSON 파일에서 판례 데이터 로드 및 임포트
 */
async function importCasesFromJSON(options = {}) {
  const {
    jsonPath = path.join(__dirname, '../data/labor_cases/final_elabor_case_전체사례_20260127_081741.json'),
    storeName = 'labor-law-knowledge-base',
    dryRun = false,
    batchSize = 10, // 한 번에 처리할 문서 수
    limit = null, // 테스트용: 처리할 최대 문서 수
    skip = 0 // 건너뛸 문서 수 (이어하기용)
  } = options;

  console.log('');
  console.log('='.repeat(60));
  console.log('⚖️  JSON 판례/행정해석 임포트 시작');
  console.log('='.repeat(60));
  console.log(`소스 파일: ${jsonPath}`);
  console.log(`스토어명: ${storeName}`);
  console.log(`배치 크기: ${batchSize}개`);
  if (skip > 0) console.log(`⏩ Skip: 처음 ${skip}개 문서는 건너뜁니다.`);
  console.log(`Dry Run: ${dryRun ? '예 (실제 업로드 안함)' : '아니오'}`);
  if (limit) console.log(`제한: ${limit}개 문서만 처리`);
  console.log('');

  // JSON 파일 로드
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON 파일을 찾을 수 없습니다: ${jsonPath}`);
  }

  let casesData;
  try {
    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
    casesData = JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(`JSON 파일 파싱 실패: ${error.message}`);
  }

  console.log(`📂 총 ${casesData.length}개의 판례/행정해석 발견`);
  console.log('');

  // 제한 적용
  if (limit && limit < casesData.length) {
    casesData = casesData.slice(0, limit);
    console.log(`⚠️  처리 제한: ${limit}개만 처리합니다.`);
    console.log('');
  }

  if (casesData.length === 0) {
    console.log('⚠️  임포트할 데이터가 없습니다.');
    return { success: true, results: [] };
  }

  // 진행 상황 저장 파일 경로
  const progressPath = path.join(__dirname, 'import_progress.json');

  console.log(`[DEBUG] Initial skip: ${skip}`);
  console.log(`[DEBUG] Progress path: ${progressPath}`);
  console.log(`[DEBUG] Exists: ${fs.existsSync(progressPath)}`);

  // Skip 적용 (우선순위: 1. 명시적 옵션, 2. 저장된 진행 상황)
  if (skip === 0 && fs.existsSync(progressPath)) {
    try {
      console.log(`🔍 진행 상황 파일 확인 중: ${progressPath}`);
      const savedProgress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
      console.log(`   파일 내용: lastIndex=${savedProgress.lastIndex}, storeName=${savedProgress.storeName}`);
      console.log(`   현재 설정: storeName=${storeName}`);

      if (savedProgress.lastIndex && savedProgress.storeName === storeName) {
        console.log(`💾 저장된 진행 상황 발견: ${savedProgress.lastIndex}번 문서까지 처리됨`);
        console.log(`   자동으로 ${savedProgress.lastIndex}번부터 이어서 시작합니다.`);
        // 저장된 인덱스는 '처리된' 마지막 인덱스이므로, 그 다음부터 시작하려면 그대로 skip 값으로 사용하면 됨
        // (slice(skip)은 skip 인덱스부터 시작하므로)
        skip = savedProgress.lastIndex;
      } else {
        console.log('⚠️  저장된 진행 상황을 건너뜁니다 (이유: 스토어 이름 불일치 또는 데이터 누락)');
      }
    } catch (err) {
      console.warn('⚠️  진행 상황 파일 읽기 실패 (무시하고 0부터 시작):', err.message);
    }
  }

  // Skip 적용
  const originalTotalCount = casesData.length;
  if (skip > 0) {
    if (skip >= casesData.length) {
      console.log(`⚠️  Skip 개수(${skip})가 전체 데이터 수(${casesData.length})보다 큽니다.`);
      return { success: true, results: [] };
    }
    console.log(`⏩ ${skip}개 문서를 건너 뛰고 ${skip + 1}번째 문서부터 시작합니다.`);
    casesData = casesData.slice(skip);
    console.log(`📂 남은 처리 대상: ${casesData.length}개`);
    console.log('');
  }

  // 통계
  const stats = {
    판례: casesData.filter(c => c.sub_category !== '행정해석').length,
    행정해석: casesData.filter(c => c.sub_category === '행정해석').length,
    대법판례: casesData.filter(c => c.sub_category === '대법판례').length,
    고법판례: casesData.filter(c => c.sub_category === '고법판례').length,
    지법판례: casesData.filter(c => c.sub_category === '지법판례').length,
  };

  console.log('📊 데이터 분포:');
  Object.entries(stats).forEach(([key, value]) => {
    if (value > 0) {
      console.log(`   ${key}: ${value}개`);
    }
  });
  console.log('');

  if (dryRun) {
    console.log('🔍 Dry Run 모드: 처음 5개 샘플만 표시합니다.');
    casesData.slice(0, 5).forEach((caseData, idx) => {
      const metadata = convertCaseToMetadata(caseData);
      console.log(`${idx + 1}. [${metadata.documentType === 'interpretation' ? '해석' : '판례'}] ${metadata.courtName}`);
      console.log(`   사건번호: ${metadata.caseNumber}`);
      console.log(`   주제: ${metadata.subject}`);
      console.log(`   카테고리: ${metadata.category}`);
      console.log(`   중요도: ${metadata.importance}/5`);
      console.log(`   키워드: ${metadata.keywords.slice(0, 5).join(', ')}`);
      console.log('');
    });
    return { success: true, results: [] };
  }

  // RAGAgent 초기화
  console.log('🔧 RAG Agent 초기화 중...');
  const agent = new RAGAgent(process.env.GEMINI_API_KEY);
  await agent.initialize(storeName);
  console.log('✅ RAG Agent 초기화 완료');
  console.log('');

  // 임시 디렉토리 생성
  const tempDir = path.join(__dirname, '../temp_cases');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 배치 처리
  const results = [];
  const totalBatches = Math.ceil(casesData.length / batchSize);

  // 연속 실패 감지
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 5;

  for (let i = 0; i < casesData.length; i += batchSize) {
    const batch = casesData.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const currentIndex = skip + i;

    console.log(`📤 배치 ${batchNum}/${totalBatches} 처리 중... (${currentIndex + 1}-${Math.min(currentIndex + batchSize, originalTotalCount)}/${originalTotalCount})`);

    const batchDocuments = [];

    for (const caseData of batch) {
      const metadata = convertCaseToMetadata(caseData);

      // 문서 제목 생성
      const title = metadata.documentType === 'interpretation'
        ? `${metadata.courtName} ${metadata.caseNumber}`
        : `${metadata.courtName} ${metadata.caseNumber} - ${metadata.subject}`;

      // 내용에서 HTML 태그 제거 및 정리
      let content = caseData.content
        .replace(/<[^>]*>/g, '') // HTML 태그 제거
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n') // 연속된 빈 줄 정리
        .trim();

      // 임시 텍스트 파일로 저장
      const tempFileName = `case_${caseData.cs_id}.txt`;
      const tempFilePath = path.join(tempDir, tempFileName);
      fs.writeFileSync(tempFilePath, content, 'utf-8');

      batchDocuments.push({
        filePath: tempFilePath,
        title: title,
        metadata: metadata
      });
    }

    let batchSuccess = false;
    try {
      // 판례 배치 업로드
      const batchResults = await agent.uploadLaborCasesBatch(batchDocuments);
      results.push(...batchResults);

      const successCount = batchResults.filter(r => r.success).length;
      console.log(`   ✅ ${successCount}/${batch.length}개 성공`);

      if (successCount > 0) {
        batchSuccess = true;
        consecutiveFailures = 0; // 성공 시 카운트 리셋
      } else {
        consecutiveFailures++;
      }

    } catch (error) {
      console.error(`   ❌ 배치 처리 실패: ${error.message}`);
      consecutiveFailures++;

      // 실패한 배치는 개별 처리 시도 (옵션)
      for (const doc of batchDocuments) {
        results.push({ success: false, title: doc.title, error: error.message });
      }
    }

    // 임시 파일 정리
    for (const doc of batchDocuments) {
      try {
        if (fs.existsSync(doc.filePath)) {
          fs.unlinkSync(doc.filePath);
        }
      } catch (err) {
        // 파일 삭제 실패는 무시
      }
    }

    // 진행 상황 저장 (성공 여부와 관계없이 시도한 만큼 저장)
    // 다음 시작 위치는 현재 배치 끝 = skip + i + batch.length
    const nextStartIndex = currentIndex + batch.length;
    try {
      fs.writeFileSync(progressPath, JSON.stringify({
        lastIndex: nextStartIndex,
        timestamp: new Date().toISOString(),
        storeName: storeName
      }, null, 2));
    } catch (err) {
      console.warn('⚠️  진행 상황 저장 실패:', err.message);
    }

    // 연속 실패 체크
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error('');
      console.error('⛔️ 연속적인 에러 발생으로 작업을 중단합니다.');
      console.error(`   최근 ${consecutiveFailures}개 배치가 모두 실패했습니다.`);
      console.error(`   현재 위치: ${nextStartIndex}/${originalTotalCount}`);
      console.error(`   다음 명령어로 이 지점부터 다시 시작할 수 있습니다:`);
      console.error(`   node scripts/import_labor_cases_json.js --skip=${nextStartIndex}`);
      break;
    }

    // API 율 제한 방지를 위한 대기
    if (batchNum < totalBatches) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
    }
  }

  // 임시 디렉토리 정리
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  } catch (err) {
    // 디렉토리 삭제 실패는 무시
  }

  // 결과 요약
  console.log('');
  console.log('='.repeat(60));
  console.log('📊 임포트 결과 요약');
  console.log('='.repeat(60));
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log(`📈 성공률: ${((successCount / results.length) * 100).toFixed(1)}%`);
  console.log('');

  if (failCount > 0) {
    console.log('❌ 실패 목록 (처음 10개):');
    results.filter(r => !r.success).slice(0, 10).forEach(r => {
      console.log(`   - ${r.title}: ${r.error}`);
    });
    console.log('');
  }

  return { success: failCount === 0 || successCount > 0, results, stats };
}

/**
 * CLI 실행
 */
async function main() {
  const args = process.argv.slice(2);

  // 옵션 파싱
  const options = {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    storeName: process.env.LABOR_STORE_NAME || 'labor-law-knowledge-base',
    batchSize: parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1]) || 10,
    limit: parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || null,
    skip: parseInt(args.find(a => a.startsWith('--skip='))?.split('=')[1]) || parseInt(args.find((a, i) => a === '-s' && args[i + 1]) ? args[args.indexOf('-s') + 1] : 0) || 0
  };

  // JSON 파일 경로 (인자로 지정 가능)
  const jsonPathArg = args.find(a => !a.startsWith('-') && a.endsWith('.json'));
  if (jsonPathArg) {
    options.jsonPath = path.resolve(jsonPathArg);
  }

  // 환경 변수 확인
  if (!process.env.GEMINI_API_KEY && !options.dryRun) {
    console.error('❌ GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
    console.error('   .env 파일에 GEMINI_API_KEY를 추가하세요.');
    process.exit(1);
  }

  // 도움말
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
사용법: node import_labor_cases_json.js [JSON파일] [options]

인자:
  [JSON파일]       JSON 파일 경로 (선택, 기본: data/labor_cases/final_elabor_case_*.json)

옵션:
  --dry-run, -d    실제 업로드 없이 데이터만 확인
  --batch=N        배치 크기 (기본: 10)
  --limit=N        처리할 최대 문서 수 (테스트용)
  --skip=N, -s N   처음 N개 문서는 건너뛰기 (중단된 작업 이어하기)
  --help, -h       도움말 표시

환경 변수:
  GEMINI_API_KEY        Google Gemini API 키 (필수)
  LABOR_STORE_NAME      RAG 스토어 이름 (기본: labor-law-knowledge-base)

예시:
  node scripts/import_labor_cases_json.js --dry-run
  node scripts/import_labor_cases_json.js --limit=100
  node scripts/import_labor_cases_json.js --batch=5
  node scripts/import_labor_cases_json.js --skip=1000
  node scripts/import_labor_cases_json.js data/labor_cases/my_cases.json
    `);
    process.exit(0);
  }

  try {
    const result = await importCasesFromJSON(options);

    if (result.success) {
      console.log('');
      console.log('🎉 모든 데이터가 성공적으로 임포트되었습니다!');
      console.log('');
      process.exit(0);
    } else {
      console.log('');
      console.log('⚠️  일부 데이터 임포트에 실패했습니다.');
      console.log('');
      process.exit(1);
    }

  } catch (error) {
    console.error('');
    console.error('❌ 실행 중 오류 발생:', error.message);
    console.error('');
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 모듈로 사용하거나 직접 실행
if (require.main === module) {
  main();
}

module.exports = {
  importCasesFromJSON,
  convertCaseToMetadata,
  detectCategory,
  extractKeywords
};
