/**
 * 노동법령 및 판례 데이터 임포트 스크립트
 * Labor Law and Case Data Import Script
 */

const RAGAgent = require('../RAGAgent');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * 파일명에서 메타데이터 파싱 유틸리티
 */
class MetadataParser {
  /**
   * 법령 파일명에서 메타데이터 추출
   * 예시 파일명: "근로기준법_법률_제19488호_2023-12-26.pdf"
   */
  static parseLawFileName(fileName) {
    const baseName = path.basename(fileName, path.extname(fileName));
    const parts = baseName.split('_');

    const metadata = {
      lawName: parts[0] || '',
      lawType: this.mapLawType(parts[1] || ''),
      lawNumber: parts[2] || '',
      enactmentDate: parts[3] || '',
      ministry: '고용노동부',
      category: this.detectCategory(parts[0] || ''),
      keywords: this.extractKeywords(parts[0] || ''),
      importance: 3
    };

    return metadata;
  }

  /**
   * 판례 파일명에서 메타데이터 추출
   * 예시 파일명: "대법원_2023다12345_2023-12-26_부당해고.pdf"
   */
  static parseCaseFileName(fileName) {
    const baseName = path.basename(fileName, path.extname(fileName));
    const parts = baseName.split('_');

    const metadata = {
      courtName: parts[0] || '',
      courtType: this.mapCourtType(parts[0] || ''),
      caseNumber: parts[1] || '',
      judgmentDate: parts[2] || '',
      subject: parts[3] || '',
      caseType: 'civil',
      judgmentResult: 'unknown',
      precedentValue: 'medium',
      category: this.detectCategory(parts[3] || ''),
      keywords: this.extractKeywords(parts[3] || ''),
      importance: 3
    };

    return metadata;
  }

  /**
   * 법령 유형 매핑
   */
  static mapLawType(type) {
    const typeMap = {
      '법률': 'act',
      '시행령': 'decree',
      '시행규칙': 'rule',
      '고시': 'notice',
      '훈령': 'directive'
    };
    return typeMap[type] || 'act';
  }

  /**
   * 법원 유형 매핑
   */
  static mapCourtType(courtName) {
    if (courtName.includes('대법원')) return 'supreme';
    if (courtName.includes('고등법원')) return 'high';
    if (courtName.includes('행정법원')) return 'admin';
    return 'district';
  }

  /**
   * 카테고리 자동 감지
   */
  static detectCategory(text) {
    const categoryKeywords = {
      '근로계약': ['채용', '계약', '시용'],
      '임금': ['임금', '급여', '퇴직금', '수당', '최저임금'],
      '근로시간': ['근로시간', '연장', '야간', '휴게'],
      '휴가휴직': ['휴가', '휴직', '연차', '출산', '육아'],
      '해고징계': ['해고', '징계', '부당해고', '정리해고'],
      '산재보험': ['산재', '재해', '요양', '휴업급여'],
      '고용보험': ['실업급여', '고용보험'],
      '차별': ['차별', '비정규직', '성차별'],
      '노동조합': ['노조', '단체교섭', '쟁의', '부당노동행위'],
      '안전보건': ['안전', '보건', '산업안전']
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
  static extractKeywords(text) {
    const keywords = [];
    const keywordPatterns = [
      '근로시간', '임금', '퇴직금', '해고', '징계', '휴가', '휴직',
      '산재', '안전', '차별', '노조', '단체교섭', '연차', '수당',
      '정당한 이유', '부당해고', '최저임금', '통상임금'
    ];

    keywordPatterns.forEach(keyword => {
      if (text.includes(keyword)) {
        keywords.push(keyword);
      }
    });

    return keywords;
  }
}

/**
 * JSON 메타데이터 파일 로더
 * data/metadata/ 폴더에 JSON 메타데이터가 있는 경우 사용
 */
class MetadataLoader {
  /**
   * JSON 메타데이터 파일 로드
   * @param {string} metadataPath - 메타데이터 파일 경로
   * @returns {Object|null} 메타데이터 객체 또는 null
   */
  static loadMetadata(metadataPath) {
    try {
      if (fs.existsSync(metadataPath)) {
        const data = fs.readFileSync(metadataPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn(`⚠️  메타데이터 로드 실패: ${metadataPath}`, error.message);
    }
    return null;
  }

  /**
   * 파일에 대응하는 메타데이터 찾기
   * @param {string} filePath - 문서 파일 경로
   * @param {string} metadataDir - 메타데이터 디렉토리
   * @returns {Object|null} 메타데이터 객체
   */
  static findMetadataForFile(filePath, metadataDir) {
    const fileName = path.basename(filePath, path.extname(filePath));
    const metadataPath = path.join(metadataDir, `${fileName}.json`);
    return this.loadMetadata(metadataPath);
  }
}

/**
 * 노동법령 임포트
 */
async function importLaborLaws(options = {}) {
  const {
    lawsDir = path.join(__dirname, '../data/labor_laws'),
    metadataDir = path.join(__dirname, '../data/metadata/laws'),
    storeName = 'labor-law-knowledge-base',
    dryRun = false
  } = options;

  console.log('');
  console.log('='.repeat(60));
  console.log('📜 노동법령 임포트 시작');
  console.log('='.repeat(60));
  console.log(`소스 디렉토리: ${lawsDir}`);
  console.log(`메타데이터 디렉토리: ${metadataDir}`);
  console.log(`스토어명: ${storeName}`);
  console.log(`Dry Run: ${dryRun ? '예 (실제 업로드 안함)' : '아니오'}`);
  console.log('');

  // 디렉토리 존재 확인
  if (!fs.existsSync(lawsDir)) {
    throw new Error(`법령 디렉토리를 찾을 수 없습니다: ${lawsDir}`);
  }

  // 파일 목록 조회
  const files = fs.readdirSync(lawsDir)
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.pdf', '.txt', '.docx', '.html'].includes(ext);
    })
    .map(file => path.join(lawsDir, file));

  console.log(`📂 발견된 법령 파일: ${files.length}개`);
  console.log('');

  if (files.length === 0) {
    console.log('⚠️  임포트할 파일이 없습니다.');
    return { success: true, results: [] };
  }

  if (dryRun) {
    console.log('🔍 Dry Run 모드: 파일 목록만 확인합니다.');
    files.forEach((file, idx) => {
      const metadata = MetadataLoader.findMetadataForFile(file, metadataDir)
        || MetadataParser.parseLawFileName(path.basename(file));
      console.log(`${idx + 1}. ${metadata.lawName} (${metadata.lawType})`);
      console.log(`   파일: ${path.basename(file)}`);
      console.log(`   카테고리: ${metadata.category}`);
      console.log('');
    });
    return { success: true, results: [] };
  }

  // RAGAgent 초기화
  const agent = new RAGAgent(process.env.GEMINI_API_KEY);
  await agent.initialize(storeName);

  // 법령 문서 준비
  const lawDocuments = files.map(file => {
    // JSON 메타데이터 우선, 없으면 파일명 파싱
    const metadata = MetadataLoader.findMetadataForFile(file, metadataDir)
      || MetadataParser.parseLawFileName(path.basename(file));

    return {
      filePath: file,
      title: metadata.lawName || path.basename(file),
      metadata: metadata
    };
  });

  // 일괄 업로드
  const results = await agent.uploadLaborLawsBatch(lawDocuments);

  // 결과 요약
  console.log('');
  console.log('='.repeat(60));
  console.log('📊 임포트 결과 요약');
  console.log('='.repeat(60));
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log('');

  if (failCount > 0) {
    console.log('실패 목록:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.title}: ${r.error}`);
    });
    console.log('');
  }

  return { success: failCount === 0, results };
}

/**
 * 판례 임포트
 */
async function importLaborCases(options = {}) {
  const {
    casesDir = path.join(__dirname, '../data/labor_cases'),
    metadataDir = path.join(__dirname, '../data/metadata/cases'),
    storeName = 'labor-law-knowledge-base',
    dryRun = false
  } = options;

  console.log('');
  console.log('='.repeat(60));
  console.log('⚖️  노동 판례 임포트 시작');
  console.log('='.repeat(60));
  console.log(`소스 디렉토리: ${casesDir}`);
  console.log(`메타데이터 디렉토리: ${metadataDir}`);
  console.log(`스토어명: ${storeName}`);
  console.log(`Dry Run: ${dryRun ? '예 (실제 업로드 안함)' : '아니오'}`);
  console.log('');

  // 디렉토리 존재 확인
  if (!fs.existsSync(casesDir)) {
    throw new Error(`판례 디렉토리를 찾을 수 없습니다: ${casesDir}`);
  }

  // 파일 목록 조회
  const files = fs.readdirSync(casesDir)
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.pdf', '.txt', '.docx', '.html'].includes(ext);
    })
    .map(file => path.join(casesDir, file));

  console.log(`📂 발견된 판례 파일: ${files.length}개`);
  console.log('');

  if (files.length === 0) {
    console.log('⚠️  임포트할 파일이 없습니다.');
    return { success: true, results: [] };
  }

  if (dryRun) {
    console.log('🔍 Dry Run 모드: 파일 목록만 확인합니다.');
    files.forEach((file, idx) => {
      const metadata = MetadataLoader.findMetadataForFile(file, metadataDir)
        || MetadataParser.parseCaseFileName(path.basename(file));
      console.log(`${idx + 1}. ${metadata.courtName} ${metadata.caseNumber}`);
      console.log(`   파일: ${path.basename(file)}`);
      console.log(`   주제: ${metadata.subject}`);
      console.log(`   카테고리: ${metadata.category}`);
      console.log('');
    });
    return { success: true, results: [] };
  }

  // RAGAgent 초기화 (기존 스토어 재사용)
  const agent = new RAGAgent(process.env.GEMINI_API_KEY, {
    storeName: storeName
  });

  // 판례 문서 준비
  const caseDocuments = files.map(file => {
    // JSON 메타데이터 우선, 없으면 파일명 파싱
    const metadata = MetadataLoader.findMetadataForFile(file, metadataDir)
      || MetadataParser.parseCaseFileName(path.basename(file));

    return {
      filePath: file,
      title: `${metadata.courtName} ${metadata.caseNumber}`,
      metadata: metadata
    };
  });

  // 일괄 업로드
  const results = await agent.uploadLaborCasesBatch(caseDocuments);

  // 결과 요약
  console.log('');
  console.log('='.repeat(60));
  console.log('📊 임포트 결과 요약');
  console.log('='.repeat(60));
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log('');

  if (failCount > 0) {
    console.log('실패 목록:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.title}: ${r.error}`);
    });
    console.log('');
  }

  return { success: failCount === 0, results };
}

/**
 * 전체 임포트 (법령 + 판례)
 */
async function importAll(options = {}) {
  console.log('');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(15) + '노무 AI 데이터 임포트' + ' '.repeat(22) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('');

  try {
    // 1. 법령 임포트
    const lawResults = await importLaborLaws(options);

    // 2. 판례 임포트
    const caseResults = await importLaborCases(options);

    // 전체 결과
    console.log('');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║' + ' '.repeat(20) + '전체 임포트 완료' + ' '.repeat(22) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
    console.log('');
    console.log(`📜 법령: ${lawResults.results.filter(r => r.success).length}개 성공`);
    console.log(`⚖️  판례: ${caseResults.results.filter(r => r.success).length}개 성공`);
    console.log('');

    const allSuccess = lawResults.success && caseResults.success;
    if (allSuccess) {
      console.log('✅ 모든 데이터 임포트가 성공적으로 완료되었습니다!');
    } else {
      console.log('⚠️  일부 데이터 임포트에 실패했습니다. 위의 오류를 확인하세요.');
    }
    console.log('');

    return {
      success: allSuccess,
      laws: lawResults,
      cases: caseResults
    };

  } catch (error) {
    console.error('');
    console.error('❌ 임포트 중 오류 발생:', error.message);
    console.error('');
    throw error;
  }
}

/**
 * CLI 실행
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  // 옵션 파싱
  const options = {
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    storeName: process.env.LABOR_STORE_NAME || 'labor-law-knowledge-base'
  };

  // 환경 변수 확인
  if (!process.env.GEMINI_API_KEY && !options.dryRun) {
    console.error('❌ GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
    console.error('   .env 파일에 GEMINI_API_KEY를 추가하세요.');
    process.exit(1);
  }

  try {
    switch (command) {
      case 'laws':
        await importLaborLaws(options);
        break;

      case 'cases':
        await importLaborCases(options);
        break;

      case 'all':
        await importAll(options);
        break;

      case 'help':
        console.log(`
사용법: node import_labor_data.js [command] [options]

Commands:
  all        법령과 판례 모두 임포트 (기본값)
  laws       법령만 임포트
  cases      판례만 임포트
  help       도움말 표시

Options:
  --dry-run, -d    실제 업로드 없이 파일 목록만 확인

환경 변수:
  GEMINI_API_KEY        Google Gemini API 키 (필수)
  LABOR_STORE_NAME      RAG 스토어 이름 (기본: labor-law-knowledge-base)

예시:
  node import_labor_data.js all
  node import_labor_data.js laws --dry-run
  node import_labor_data.js cases
        `);
        break;

      default:
        console.error(`❌ 알 수 없는 명령어: ${command}`);
        console.error('   "node import_labor_data.js help" 로 도움말을 확인하세요.');
        process.exit(1);
    }

    process.exit(0);

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
  importLaborLaws,
  importLaborCases,
  importAll,
  MetadataParser,
  MetadataLoader
};
