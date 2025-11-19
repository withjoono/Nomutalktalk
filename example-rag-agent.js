const RAGAgent = require('./RAGAgent');
require('dotenv').config(); // .env 파일에서 환경 변수 로드

/**
 * RAG Agent 사용 예제
 * 파일을 업로드하고 질문에 답변하는 전체 워크플로우
 */
async function main() {
  // API 키는 환경 변수에서 가져오기 (보안 권장사항)
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';

  // RAG Agent 생성
  const agent = new RAGAgent(API_KEY, {
    model: 'gemini-2.5-flash',
    uploadPollInterval: 5000 // 5초마다 업로드 상태 확인
  });

  try {
    // 1. 에이전트 초기화 (새 스토어 생성)
    console.log('\n=== 1. 에이전트 초기화 ===');
    await agent.initialize('my-rag-store');

    // 2. 단일 파일 업로드
    console.log('\n=== 2. 파일 업로드 ===');
    await agent.uploadFile('sample.txt', {
      displayName: 'Sample Document',
      mimeType: 'text/plain'
    });

    // 3. 여러 파일 일괄 업로드 (선택사항)
    console.log('\n=== 3. 여러 파일 일괄 업로드 ===');
    const uploadResults = await agent.uploadFiles([
      { path: 'document1.txt', displayName: 'Document 1' },
      { path: 'document2.pdf', displayName: 'Document 2', mimeType: 'application/pdf' }
    ]);
    console.log('업로드 결과:', uploadResults);

    // 4. 스토어 상태 확인
    console.log('\n=== 4. 스토어 상태 확인 ===');
    const status = await agent.getStatus();
    console.log(`📊 문서 개수: ${status.documentCount}`);
    console.log('문서 목록:', status.documents.map(d => d.name));

    // 5. 질의응답
    console.log('\n=== 5. 질의응답 ===');
    const answer = await agent.ask('Can you tell me about Robert Graves?');
    console.log('\n📖 답변:');
    console.log(answer);

    // 6. 추가 질문
    console.log('\n=== 6. 추가 질문 ===');
    const answer2 = await agent.ask('문서의 주요 내용을 요약해주세요');
    console.log('\n📖 답변:');
    console.log(answer2);

    // 7. 문서 목록 조회
    console.log('\n=== 7. 문서 목록 조회 ===');
    const documents = await agent.listDocuments();
    console.log(`📄 총 ${documents.length}개 문서:`);
    documents.forEach((doc, idx) => {
      console.log(`  ${idx + 1}. ${doc.name}`);
    });

    // 8. 특정 문서 삭제 (선택사항)
    // console.log('\n=== 8. 문서 삭제 ===');
    // if (documents.length > 0) {
    //   await agent.deleteDocument(documents[0].name);
    // }

    // 9. 정리 (스토어 삭제)
    console.log('\n=== 9. 정리 ===');
    // await agent.cleanup(); // 주석 해제하면 스토어 삭제

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    console.error('상세 정보:', error);
  }
}

// 실행
if (require.main === module) {
  main();
}

module.exports = main;
