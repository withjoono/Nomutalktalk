/**
 * RAG 스토어 정리 스크립트
 * 중복된 'labor-law-knowledge-base' 스토어를 모두 삭제합니다.
 */

const RAGAgent = require('../RAGAgent');
require('dotenv').config();

async function cleanupStores() {
    const targetStoreName = 'labor-law-knowledge-base';

    if (!process.env.GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
        process.exit(1);
    }

    console.log('🧹 RAG 스토어 정리 작업 시작...');

    const agent = new RAGAgent(process.env.GEMINI_API_KEY);

    try {
        console.log('📋 전체 스토어 목록 조회 중...');
        const stores = await agent.listStores();

        // 대상 스토어 필터링
        const targetStores = stores.filter(store => store.displayName === targetStoreName);

        console.log(`🔍 '${targetStoreName}' 이름을 가진 스토어 ${targetStores.length}개 발견`);

        if (targetStores.length === 0) {
            console.log('✅ 삭제할 스토어가 없습니다.');
            return;
        }

        console.log('⚠️  다음 스토어들을 삭제합니다:');
        targetStores.forEach((store, index) => {
            console.log(`   ${index + 1}. ${store.displayName} (${store.name})`);
        });
        console.log('');

        // 순차적으로 삭제
        for (let i = 0; i < targetStores.length; i++) {
            const store = targetStores[i];
            console.log(`[${i + 1}/${targetStores.length}] 삭제 중: ${store.name}...`);
            await agent.deleteStore(store.name, true); // force=true
        }

        console.log('');
        console.log('✨ 모든 중복 스토어가 삭제되었습니다.');

    } catch (error) {
        console.error('❌ 정리 작업 실패:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    cleanupStores();
}
