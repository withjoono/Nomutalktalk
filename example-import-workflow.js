const RAGAgent = require('./RAGAgent');
require('dotenv').config();

/**
 * Files API Import Workflow 사용 예제
 * 1. Files API에 파일 업로드
 * 2. 업로드된 파일을 File Search Store로 가져오기
 * 3. 질의응답 수행
 */
async function importWorkflowExample() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';

  const agent = new RAGAgent(API_KEY, {
    model: 'gemini-2.5-flash',
    uploadPollInterval: 5000
  });

  try {
    // 1. 에이전트 초기화
    console.log('\n=== 1. 에이전트 초기화 ===');
    await agent.initialize('import-workflow-store');

    // 2. Files API를 통한 파일 업로드 및 가져오기 (2단계 프로세스)
    console.log('\n=== 2. Files API를 통한 파일 업로드 및 가져오기 ===');
    const result = await agent.uploadAndImportFile('sample.txt', {
      displayName: 'Sample Document',
      mimeType: 'text/plain'
    });
    console.log('가져오기 결과:', {
      fileName: result.fileName,
      filesAPIName: result.filesAPIName,
      storeName: result.storeName
    });

    // 3. 여러 파일 일괄 업로드 및 가져오기
    console.log('\n=== 3. 여러 파일 일괄 업로드 및 가져오기 ===');
    const importResults = await agent.uploadAndImportFiles([
      { path: 'document1.txt', displayName: 'Document 1' },
      { path: 'document2.pdf', displayName: 'Document 2', mimeType: 'application/pdf' }
    ]);
    console.log('일괄 가져오기 결과:', importResults.map(r => ({
      success: r.success,
      fileName: r.fileName,
      error: r.error
    })));

    // 4. Files API에 업로드된 파일 목록 확인
    console.log('\n=== 4. Files API 파일 목록 ===');
    const uploadedFiles = await agent.listUploadedFiles();
    console.log(`📄 Files API에 업로드된 파일: ${uploadedFiles.length}개`);
    uploadedFiles.forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.name} (${file.displayName || 'No display name'})`);
    });

    // 5. 스토어 상태 확인
    console.log('\n=== 5. 스토어 상태 확인 ===');
    const status = await agent.getStatus();
    console.log(`📊 스토어 문서 개수: ${status.documentCount}`);

    // 6. 질의응답
    console.log('\n=== 6. 질의응답 ===');
    const answer = await agent.ask('Can you tell me about Robert Graves?');
    console.log('\n📖 답변:');
    console.log(answer);

    // 7. Files API에서 파일 삭제 (선택사항)
    // console.log('\n=== 7. Files API 파일 삭제 ===');
    // if (uploadedFiles.length > 0) {
    //   await agent.deleteUploadedFile(uploadedFiles[0].name);
    // }

    // 8. 정리 (스토어 삭제)
    console.log('\n=== 8. 정리 ===');
    // await agent.cleanup(); // 주석 해제하면 스토어 삭제

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    console.error('상세 정보:', error);
  }
}

/**
 * 두 가지 워크플로우 비교 예제
 */
async function compareWorkflows() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    await agent.initialize('comparison-store');

    console.log('\n=== 워크플로우 1: 직접 업로드 (1단계) ===');
    console.log('장점: 빠르고 간단');
    console.log('단점: Files API 관리 불가');
    const result1 = await agent.uploadFile('sample1.txt', {
      displayName: 'Sample 1'
    });
    console.log('✓ 완료:', result1.fileName);

    console.log('\n=== 워크플로우 2: Files API Import (2단계) ===');
    console.log('장점: Files API로 파일 재사용 가능, 인용에 표시됨');
    console.log('단점: 2단계 프로세스로 다소 느림');
    const result2 = await agent.uploadAndImportFile('sample2.txt', {
      displayName: 'Sample 2'
    });
    console.log('✓ 완료:', result2.fileName);
    console.log('   Files API 이름:', result2.filesAPIName);

    // 질의응답
    const answer = await agent.ask('두 문서의 내용을 비교해주세요');
    console.log('\n📖 답변:');
    console.log(answer);

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
  }
}

// 실행
if (require.main === module) {
  const mode = process.argv[2] || 'import';

  if (mode === 'import') {
    importWorkflowExample();
  } else if (mode === 'compare') {
    compareWorkflows();
  } else {
    console.log('사용법:');
    console.log('  node example-import-workflow.js import   # Import 워크플로우 예제');
    console.log('  node example-import-workflow.js compare  # 두 워크플로우 비교');
  }
}

module.exports = { importWorkflowExample, compareWorkflows };
