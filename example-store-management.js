const RAGAgent = require('./RAGAgent');
require('dotenv').config();

/**
 * File Search Store 관리 예제
 * 스토어 생성, 조회, 목록, 삭제 등 전체 라이프사이클 관리
 */

/**
 * 예제 1: 스토어 생성 및 조회
 */
async function createAndGetStore() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 1: 스토어 생성 및 조회 ===\n');

    // 1. 스토어 생성
    console.log('📦 1단계: 스토어 생성');
    await agent.initialize('my-test-store-123');

    // 2. 생성된 스토어 정보 조회
    console.log('\n📋 2단계: 스토어 정보 조회');
    const storeInfo = await agent.getStore();
    console.log('스토어 정보:', {
      name: storeInfo.name,
      displayName: storeInfo.displayName,
      createTime: storeInfo.createTime,
      updateTime: storeInfo.updateTime
    });

    // 3. 스토어 상태 확인
    console.log('\n📊 3단계: 스토어 상태 확인');
    const status = await agent.getStatus();
    console.log(`문서 개수: ${status.documentCount}`);

  } catch (error) {
    console.error('오류:', error.message);
  }
}

/**
 * 예제 2: 모든 스토어 목록 조회
 */
async function listAllStores() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 2: 모든 스토어 목록 조회 ===\n');

    // 1. 여러 스토어 생성
    console.log('📦 테스트용 스토어 생성 중...');
    await agent.initialize('store-1');

    const agent2 = new RAGAgent(API_KEY);
    await agent2.initialize('store-2');

    const agent3 = new RAGAgent(API_KEY);
    await agent3.initialize('store-3');

    // 2. 모든 스토어 목록 조회
    console.log('\n📋 모든 스토어 목록:');
    const stores = await agent.listStores();

    console.log(`\n총 ${stores.length}개 스토어:`);
    stores.forEach((store, idx) => {
      console.log(`\n${idx + 1}. ${store.displayName || 'Unnamed'}`);
      console.log(`   이름: ${store.name}`);
      console.log(`   생성일: ${store.createTime}`);
      console.log(`   수정일: ${store.updateTime}`);
    });

    // 3. 정리
    console.log('\n🗑️  테스트 스토어 정리 중...');
    await agent.cleanup();
    await agent2.cleanup();
    await agent3.cleanup();

  } catch (error) {
    console.error('오류:', error.message);
  }
}

/**
 * 예제 3: 특정 스토어 조회 및 삭제
 */
async function getAndDeleteStore() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 3: 특정 스토어 조회 및 삭제 ===\n');

    // 1. 스토어 생성
    console.log('📦 스토어 생성');
    await agent.initialize('store-to-delete');
    const storeName = agent.storeName;

    // 2. 스토어 이름으로 직접 조회
    console.log('\n📋 스토어 이름으로 직접 조회');
    const store = await agent.getStore(storeName);
    console.log('조회된 스토어:', {
      name: store.name,
      displayName: store.displayName
    });

    // 3. 스토어 삭제
    console.log('\n🗑️  스토어 삭제');
    await agent.deleteStore(storeName);

    // 4. 삭제 확인
    console.log('\n✓ 스토어가 성공적으로 삭제되었습니다');
    console.log('현재 에이전트 스토어:', agent.storeName); // null이어야 함

  } catch (error) {
    console.error('오류:', error.message);
  }
}

/**
 * 예제 4: 스토어 라이프사이클 관리
 */
async function storeLifecycleManagement() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 4: 스토어 라이프사이클 관리 ===\n');

    // 1. 생성
    console.log('📦 1단계: 스토어 생성');
    await agent.initialize('lifecycle-store');
    console.log(`✓ 생성 완료: ${agent.storeName}`);

    // 2. 파일 업로드
    console.log('\n📤 2단계: 파일 업로드');
    await agent.uploadFile('sample.txt', {
      displayName: 'Sample File'
    });

    // 3. 상태 조회
    console.log('\n📊 3단계: 상태 조회');
    const status = await agent.getStatus();
    console.log(`문서 개수: ${status.documentCount}`);

    // 4. 스토어 정보 조회
    console.log('\n📋 4단계: 스토어 정보 조회');
    const store = await agent.getStore();
    console.log('스토어 정보:', {
      name: store.name,
      displayName: store.displayName,
      문서수: status.documentCount
    });

    // 5. 정리 (강제 삭제)
    console.log('\n🗑️  5단계: 정리');
    await agent.cleanup(true); // force=true로 비어있지 않아도 삭제

  } catch (error) {
    console.error('오류:', error.message);
  }
}

/**
 * 예제 5: 여러 스토어 관리
 */
async function multipleStoreManagement() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';

  try {
    console.log('\n=== 예제 5: 여러 스토어 관리 ===\n');

    // 1. 여러 에이전트 생성 (각각 다른 스토어)
    console.log('📦 1단계: 여러 스토어 생성');

    const agentA = new RAGAgent(API_KEY);
    await agentA.initialize('project-a');
    console.log(`✓ Project A: ${agentA.storeName}`);

    const agentB = new RAGAgent(API_KEY);
    await agentB.initialize('project-b');
    console.log(`✓ Project B: ${agentB.storeName}`);

    const agentC = new RAGAgent(API_KEY);
    await agentC.initialize('project-c');
    console.log(`✓ Project C: ${agentC.storeName}`);

    // 2. 각 스토어에 파일 업로드
    console.log('\n📤 2단계: 각 스토어에 파일 업로드');
    await agentA.uploadFile('doc1.txt', { displayName: 'Doc A' });
    await agentB.uploadFile('doc2.txt', { displayName: 'Doc B' });
    await agentC.uploadFile('doc3.txt', { displayName: 'Doc C' });

    // 3. 모든 스토어 목록 및 상태 확인
    console.log('\n📋 3단계: 모든 스토어 확인');
    const stores = await agentA.listStores();

    for (const store of stores) {
      if (store.name === agentA.storeName ||
          store.name === agentB.storeName ||
          store.name === agentC.storeName) {
        console.log(`\n📦 ${store.displayName}`);
        console.log(`   이름: ${store.name}`);

        // 특정 스토어 정보 조회
        const info = await agentA.getStore(store.name);
        console.log(`   생성일: ${info.createTime}`);
      }
    }

    // 4. 특정 스토어만 삭제
    console.log('\n🗑️  4단계: Project B 스토어만 삭제');
    await agentB.cleanup();

    // 5. 남은 스토어 확인
    console.log('\n📋 5단계: 남은 스토어 확인');
    const remainingStores = await agentA.listStores();
    const projectStores = remainingStores.filter(s =>
      s.name === agentA.storeName || s.name === agentC.storeName
    );
    console.log(`남은 프로젝트 스토어: ${projectStores.length}개`);
    projectStores.forEach(s => console.log(`  - ${s.displayName}`));

    // 6. 전체 정리
    console.log('\n🗑️  6단계: 전체 정리');
    await agentA.cleanup();
    await agentC.cleanup();

  } catch (error) {
    console.error('오류:', error.message);
  }
}

/**
 * 예제 6: 기존 스토어 재사용
 */
async function reuseExistingStore() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';

  try {
    console.log('\n=== 예제 6: 기존 스토어 재사용 ===\n');

    // 1. 첫 번째 세션: 스토어 생성 및 파일 업로드
    console.log('📦 세션 1: 스토어 생성');
    const agent1 = new RAGAgent(API_KEY);
    await agent1.initialize('persistent-store');
    const storeName = agent1.storeName;

    await agent1.uploadFile('data.txt', { displayName: 'Data' });
    console.log(`✓ 스토어 생성 및 파일 업로드 완료: ${storeName}`);

    // 2. 두 번째 세션: 기존 스토어 재사용
    console.log('\n📦 세션 2: 기존 스토어 재사용');
    const agent2 = new RAGAgent(API_KEY, {
      storeName: storeName  // 기존 스토어 이름 지정
    });

    // initialize 없이 바로 사용 가능
    const status = await agent2.getStatus();
    console.log(`✓ 기존 스토어 재사용 완료`);
    console.log(`  문서 개수: ${status.documentCount}`);

    // 3. 기존 스토어에 추가 파일 업로드
    console.log('\n📤 추가 파일 업로드');
    await agent2.uploadFile('more-data.txt', { displayName: 'More Data' });

    // 4. 최종 상태 확인
    const finalStatus = await agent2.getStatus();
    console.log(`\n📊 최종 상태`);
    console.log(`  문서 개수: ${finalStatus.documentCount}`);

    // 5. 정리
    console.log('\n🗑️  정리');
    await agent2.cleanup();

  } catch (error) {
    console.error('오류:', error.message);
  }
}

// 메인 실행
if (require.main === module) {
  const example = process.argv[2] || '1';

  const examples = {
    '1': createAndGetStore,
    '2': listAllStores,
    '3': getAndDeleteStore,
    '4': storeLifecycleManagement,
    '5': multipleStoreManagement,
    '6': reuseExistingStore
  };

  if (examples[example]) {
    examples[example]();
  } else {
    console.log('사용법:');
    console.log('  node example-store-management.js 1  # 스토어 생성 및 조회');
    console.log('  node example-store-management.js 2  # 모든 스토어 목록 조회');
    console.log('  node example-store-management.js 3  # 특정 스토어 조회 및 삭제');
    console.log('  node example-store-management.js 4  # 스토어 라이프사이클 관리');
    console.log('  node example-store-management.js 5  # 여러 스토어 관리');
    console.log('  node example-store-management.js 6  # 기존 스토어 재사용');
  }
}

module.exports = {
  createAndGetStore,
  listAllStores,
  getAndDeleteStore,
  storeLifecycleManagement,
  multipleStoreManagement,
  reuseExistingStore
};
