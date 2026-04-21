require('dotenv').config();
const LawVerificationService = require('./services/LawVerificationService');

async function testVerification() {
  console.log('========================================');
  console.log('법령/판례 검증 테스트');
  console.log('========================================\n');

  // 1. 실제 존재하는 판례 검증
  console.log('--- 1. 실제 존재하는 판례 ---');
  const realCase = await LawVerificationService.verifyPrecedent('2019다2230');
  console.log(`  2019다2230: ${realCase ? '✅ 존재' : '❌ 미존재'}\n`);

  // 2. 존재하지 않는 가짜 판례 검증
  console.log('--- 2. AI가 만들어낸 가짜 판례 ---');
  const fakeCase = await LawVerificationService.verifyPrecedent('2009다62558');
  console.log(`  2009다62558: ${fakeCase ? '✅ 존재' : '❌ 미존재'}\n`);

  // 3. 실제 법령 검증
  console.log('--- 3. 실제 존재하는 법령 ---');
  const realLaw = await LawVerificationService.verifyLawArticle('근로기준법 제23조 제1항');
  console.log(`  근로기준법 제23조 제1항: ${realLaw ? '✅ 존재' : '❌ 미존재'}\n`);

  // 4. 가짜 법령 검증
  console.log('--- 4. 존재하지 않는 법령 ---');
  const fakeLaw = await LawVerificationService.verifyLawArticle('근로자복리증진법 제55조');
  console.log(`  근로자복리증진법 제55조: ${fakeLaw ? '✅ 존재' : '❌ 미존재'}\n`);

  // 5. 일괄 검증 (verifyAndFilterCitations)
  console.log('--- 5. 일괄 검증 테스트 ---');
  const citations = [
    { title: '근로기준법 제23조 제1항 (해고 등의 제한)', type: 'law' },
    { title: '대법원 2009다62558 판결', type: 'precedent' },   // 가짜
    { title: '최저임금법 제6조', type: 'law' },
    { title: '대법원 2019다2230 판결', type: 'precedent' },    // 진짜
    { title: '대법원 2050다99999 판결', type: 'precedent' },   // 명백한 가짜
    { title: '고용노동부 행정해석 질의회시', type: 'interpretation' },
  ];

  const { verified, removed } = await LawVerificationService.verifyAndFilterCitations(citations);

  console.log(`\n========================================`);
  console.log(`최종 결과: ${verified.length}건 통과, ${removed.length}건 제거`);
  console.log(`========================================`);
  console.log('\n통과한 인용:');
  verified.forEach(v => console.log(`  ✅ ${v.title}`));
  console.log('\n제거된 인용:');
  removed.forEach(r => console.log(`  ❌ ${r.title}`));
}

testVerification().catch(console.error);
