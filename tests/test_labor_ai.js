/**
 * 노무 AI 시스템 테스트
 * Labor AI System Tests
 */

const RAGAgent = require('../RAGAgent');
const { LaborMetadataBuilder } = require('../models/laborSchemas');
require('dotenv').config();

// 테스트 설정
const TEST_CONFIG = {
  storeName: 'labor-test-store',
  verbose: true
};

/**
 * 테스트 유틸리티
 */
class TestUtils {
  static log(message) {
    if (TEST_CONFIG.verbose) {
      console.log(`[TEST] ${message}`);
    }
  }

  static error(message) {
    console.error(`[ERROR] ${message}`);
  }

  static success(message) {
    console.log(`✅ ${message}`);
  }

  static fail(message) {
    console.error(`❌ ${message}`);
  }

  static async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 테스트 시나리오
 */
const TEST_QUERIES = [
  {
    name: '부당해고 관련 질의',
    query: '직원을 해고하려면 어떤 절차를 거쳐야 하나요?',
    expectedKeywords: ['정당한 이유', '근로기준법', '제23조', '해고예고'],
    category: '해고징계'
  },
  {
    name: '연차휴가 관련 질의',
    query: '연차휴가를 사용하지 못한 경우 수당을 받을 수 있나요?',
    expectedKeywords: ['연차휴가', '수당', '근로기준법'],
    category: '휴가휴직'
  },
  {
    name: '최저임금 관련 질의',
    query: '최저임금 미만으로 급여를 지급하면 어떤 처벌을 받나요?',
    expectedKeywords: ['최저임금', '처벌', '벌금'],
    category: '임금'
  },
  {
    name: '근로시간 관련 질의',
    query: '주 52시간을 초과하여 근무하면 어떻게 되나요?',
    expectedKeywords: ['근로시간', '52시간', '연장근로'],
    category: '근로시간'
  },
  {
    name: '산업재해 관련 질의',
    query: '출퇴근 중 사고가 발생하면 산재로 인정받을 수 있나요?',
    expectedKeywords: ['산재', '출퇴근', '업무상'],
    category: '산재보험'
  }
];

/**
 * 카테고리 감지 테스트
 */
async function testCategoryDetection() {
  TestUtils.log('='.repeat(60));
  TestUtils.log('카테고리 자동 감지 테스트 시작');
  TestUtils.log('='.repeat(60));

  const agent = new RAGAgent(process.env.GEMINI_API_KEY);

  let passed = 0;
  let failed = 0;

  for (const test of TEST_QUERIES) {
    const detected = agent.detectLaborCategory(test.query);
    
    if (detected === test.category) {
      TestUtils.success(`${test.name}: ${detected}`);
      passed++;
    } else {
      TestUtils.fail(`${test.name}: 예상=${test.category}, 실제=${detected}`);
      failed++;
    }
  }

  TestUtils.log('');
  TestUtils.log(`결과: ${passed}개 성공, ${failed}개 실패`);
  TestUtils.log('');

  return { passed, failed };
}

/**
 * 메타데이터 빌더 테스트
 */
function testMetadataBuilder() {
  TestUtils.log('='.repeat(60));
  TestUtils.log('메타데이터 빌더 테스트 시작');
  TestUtils.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  // 법령 메타데이터 테스트
  const lawData = {
    lawName: '근로기준법',
    lawType: 'act',
    lawNumber: '법률 제19488호',
    ministry: '고용노동부',
    category: '근로계약',
    keywords: ['근로시간', '임금', '해고'],
    importance: 5
  };

  try {
    const lawMetadata = LaborMetadataBuilder.buildLaborLawMetadata(lawData);
    
    if (lawMetadata.length > 0) {
      TestUtils.success(`법령 메타데이터 생성: ${lawMetadata.length}개 필드`);
      passed++;
    } else {
      TestUtils.fail('법령 메타데이터가 비어있음');
      failed++;
    }
  } catch (error) {
    TestUtils.fail(`법령 메타데이터 생성 오류: ${error.message}`);
    failed++;
  }

  // 판례 메타데이터 테스트
  const caseData = {
    courtName: '대법원',
    courtType: 'supreme',
    caseNumber: '2023다12345',
    judgmentDate: '2023-12-26',
    subject: '부당해고',
    judgmentResult: 'plaintiff_win',
    category: '해고징계',
    keywords: ['정당한 이유', '해고예고'],
    importance: 4
  };

  try {
    const caseMetadata = LaborMetadataBuilder.buildLaborCaseMetadata(caseData);
    
    if (caseMetadata.length > 0) {
      TestUtils.success(`판례 메타데이터 생성: ${caseMetadata.length}개 필드`);
      passed++;
    } else {
      TestUtils.fail('판례 메타데이터가 비어있음');
      failed++;
    }
  } catch (error) {
    TestUtils.fail(`판례 메타데이터 생성 오류: ${error.message}`);
    failed++;
  }

  TestUtils.log('');
  TestUtils.log(`결과: ${passed}개 성공, ${failed}개 실패`);
  TestUtils.log('');

  return { passed, failed };
}

/**
 * 프롬프트 생성 테스트
 */
function testPromptGeneration() {
  TestUtils.log('='.repeat(60));
  TestUtils.log('프롬프트 생성 테스트 시작');
  TestUtils.log('='.repeat(60));

  const agent = new RAGAgent(process.env.GEMINI_API_KEY);

  let passed = 0;
  let failed = 0;

  for (const test of TEST_QUERIES) {
    try {
      const prompt = agent.buildLaborPrompt(test.query, {
        category: test.category,
        includeCases: true,
        includeInterpretations: true
      });

      if (prompt && prompt.includes(test.query) && prompt.includes(test.category)) {
        TestUtils.success(`${test.name}: 프롬프트 생성 성공`);
        passed++;
      } else {
        TestUtils.fail(`${test.name}: 프롬프트 내용 불완전`);
        failed++;
      }
    } catch (error) {
      TestUtils.fail(`${test.name}: ${error.message}`);
      failed++;
    }
  }

  TestUtils.log('');
  TestUtils.log(`결과: ${passed}개 성공, ${failed}개 실패`);
  TestUtils.log('');

  return { passed, failed };
}

/**
 * 청킹 설정 테스트
 */
function testChunkingPresets() {
  TestUtils.log('='.repeat(60));
  TestUtils.log('청킹 프리셋 테스트 시작');
  TestUtils.log('='.repeat(60));

  const { LaborChunkingPresets } = require('../models/laborSchemas');
  const agent = new RAGAgent(process.env.GEMINI_API_KEY);

  let passed = 0;
  let failed = 0;

  // 법령 청킹 설정
  const lawConfig = agent.getChunkingConfig('labor_law');
  if (lawConfig && lawConfig.whiteSpaceConfig) {
    TestUtils.success('법령 청킹 설정: ' + JSON.stringify(lawConfig.whiteSpaceConfig));
    passed++;
  } else {
    TestUtils.fail('법령 청킹 설정 없음');
    failed++;
  }

  // 판례 청킹 설정
  const caseConfig = agent.getChunkingConfig('labor_case');
  if (caseConfig && caseConfig.whiteSpaceConfig) {
    TestUtils.success('판례 청킹 설정: ' + JSON.stringify(caseConfig.whiteSpaceConfig));
    passed++;
  } else {
    TestUtils.fail('판례 청킹 설정 없음');
    failed++;
  }

  TestUtils.log('');
  TestUtils.log(`결과: ${passed}개 성공, ${failed}개 실패`);
  TestUtils.log('');

  return { passed, failed };
}

/**
 * 실제 질의응답 테스트 (선택적 - API 키 필요)
 */
async function testRealQueries() {
  if (!process.env.GEMINI_API_KEY) {
    TestUtils.log('⚠️  GEMINI_API_KEY가 없어 실제 질의응답 테스트를 건너뜁니다.');
    return { passed: 0, failed: 0, skipped: TEST_QUERIES.length };
  }

  TestUtils.log('='.repeat(60));
  TestUtils.log('실제 질의응답 테스트 시작 (스토어 필요)');
  TestUtils.log('='.repeat(60));
  TestUtils.log('⚠️  주의: 이 테스트는 초기화된 노무 AI 스토어가 필요합니다.');
  TestUtils.log('');

  const storeName = process.env.LABOR_STORE_NAME || 'labor-law-knowledge-base';
  const agent = new RAGAgent(process.env.GEMINI_API_KEY, {
    storeName: storeName
  });

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // 간단한 테스트 하나만 실행
  const testQuery = TEST_QUERIES[0];
  
  try {
    TestUtils.log(`질의: ${testQuery.query}`);
    
    const answer = await agent.askLabor(testQuery.query, {
      category: testQuery.category
    });

    if (answer && answer.length > 0) {
      TestUtils.success('답변 생성 성공');
      TestUtils.log(`답변 길이: ${answer.length}자`);
      
      // 키워드 체크
      const foundKeywords = testQuery.expectedKeywords.filter(
        keyword => answer.includes(keyword)
      );
      
      TestUtils.log(`키워드 발견: ${foundKeywords.length}/${testQuery.expectedKeywords.length}`);
      
      if (foundKeywords.length > 0) {
        passed++;
      } else {
        TestUtils.fail('예상 키워드가 답변에 없음');
        failed++;
      }
    } else {
      TestUtils.fail('답변이 비어있음');
      failed++;
    }
  } catch (error) {
    if (error.message.includes('초기화되지 않았습니다')) {
      TestUtils.log('⚠️  스토어가 초기화되지 않아 테스트를 건너뜁니다.');
      skipped = TEST_QUERIES.length;
    } else {
      TestUtils.fail(`질의응답 오류: ${error.message}`);
      failed++;
    }
  }

  TestUtils.log('');
  TestUtils.log(`결과: ${passed}개 성공, ${failed}개 실패, ${skipped}개 건너뜀`);
  TestUtils.log('');

  return { passed, failed, skipped };
}

/**
 * 모든 테스트 실행
 */
async function runAllTests() {
  console.log('');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(18) + '노무 AI 테스트 스위트' + ' '.repeat(18) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('');

  const results = [];

  // 1. 카테고리 감지 테스트
  results.push(await testCategoryDetection());
  await TestUtils.delay(500);

  // 2. 메타데이터 빌더 테스트
  results.push(testMetadataBuilder());
  await TestUtils.delay(500);

  // 3. 프롬프트 생성 테스트
  results.push(testPromptGeneration());
  await TestUtils.delay(500);

  // 4. 청킹 프리셋 테스트
  results.push(testChunkingPresets());
  await TestUtils.delay(500);

  // 5. 실제 질의응답 테스트 (선택적)
  if (process.argv.includes('--real-query')) {
    results.push(await testRealQueries());
  }

  // 전체 결과
  console.log('');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(22) + '전체 테스트 결과' + ' '.repeat(21) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('');

  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalSkipped = results.reduce((sum, r) => sum + (r.skipped || 0), 0);
  const totalTests = totalPassed + totalFailed + totalSkipped;

  console.log(`총 테스트: ${totalTests}개`);
  console.log(`✅ 성공: ${totalPassed}개`);
  console.log(`❌ 실패: ${totalFailed}개`);
  if (totalSkipped > 0) {
    console.log(`⚠️  건너뜀: ${totalSkipped}개`);
  }
  console.log('');

  if (totalFailed === 0) {
    console.log('🎉 모든 테스트를 통과했습니다!');
  } else {
    console.log('⚠️  일부 테스트가 실패했습니다.');
  }
  console.log('');

  return totalFailed === 0;
}

/**
 * CLI 실행
 */
async function main() {
  try {
    const success = await runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('');
    console.error('❌ 테스트 실행 중 오류:', error.message);
    console.error('');
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 모듈로 사용하거나 직접 실행
if (require.main === module) {
  console.log(`
사용법: node test_labor_ai.js [options]

Options:
  --real-query    실제 질의응답 테스트 포함 (스토어 필요)

예시:
  node test_labor_ai.js
  node test_labor_ai.js --real-query
  `);
  
  main();
}

module.exports = {
  testCategoryDetection,
  testMetadataBuilder,
  testPromptGeneration,
  testChunkingPresets,
  testRealQueries,
  runAllTests
};
