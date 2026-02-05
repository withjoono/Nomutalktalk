/**
 * RAG 스토어 상태 확인 스크립트
 * 현재 저장된 문서 개수와 최근 문서들을 확인합니다.
 */

const RAGAgent = require('../RAGAgent');
require('dotenv').config();

async function checkStatus() {
    const storeName = process.env.LABOR_STORE_NAME || 'labor-law-knowledge-base';

    if (!process.env.GEMINI_API_KEY) {
        console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
        process.exit(1);
    }

    console.log('🔍 RAG 스토어 상태 확인 중...');
    console.log(`목표 스토어: ${storeName}`);
    console.log('');

    const agent = new RAGAgent(process.env.GEMINI_API_KEY);

    try {
        // 모든 스토어 목록 조회
        console.log('📋 전체 스토어 목록 조회 중...');
        const stores = await agent.listStores();
        console.log(`총 ${stores.length}개의 스토어가 발견되었습니다.`);
        console.log('');

        const targetStores = stores.filter(store => store.displayName === storeName);

        if (targetStores.length === 0) {
            console.log(`⚠️  '${storeName}' 이름을 가진 스토어를 찾을 수 없습니다.`);
            return;
        }

        console.log(`🔍 '${storeName}' 이름을 가진 스토어 ${targetStores.length}개 분석 중...`);
        console.log('');

        for (let i = 0; i < targetStores.length; i++) {
            const store = targetStores[i];
            try {
                // listDocuments는 내부적으로 this.storeName을 사용하므로 설정 필요
                agent.storeName = store.name;
                const documents = await agent.listDocuments();

                console.log(`${i + 1}. [${store.name}] 문서수: ${documents.length}개`);
                if (documents.length > 0) {
                    const recentDocs = documents.slice(-3);
                    console.log(`   최근 문서: ${recentDocs.map(d => d.displayName).join(', ')}`);
                }
            } catch (err) {
                console.log(`${i + 1}. [${store.name}] 조회 실패: ${err.message}`);
            }
        }

    } catch (error) {
        console.error('❌ 상태 확인 실패:', error.message);
    }
}

if (require.main === module) {
    checkStatus();
}
