
const RAGAgent = require('../RAGAgent');
const path = require('path');
require('dotenv').config();

async function testUpload() {
    console.log('🧪 업로드 테스트 시작 (ASCII 이름 사용)');
    const agent = new RAGAgent(process.env.GEMINI_API_KEY);

    // Test with the first file that failed
    const file = '../data/labor_laws/개인정보_보호법.txt';
    const filePath = path.join(__dirname, file);

    // ASCII Display Name
    const safeName = "LaborLaw_Test_001";

    try {
        await agent.initialize('test-store');

        console.log(`파일: ${file}`);
        console.log(`Safe Name: ${safeName}`);

        const result = await agent.uploadAndImportFile(filePath, {
            displayName: safeName,
            mimeType: 'text/plain'
        });

        console.log('✅ 성공!');
        console.log(result);

    } catch (e) {
        console.error('❌ 실패:', e.message);
    }
}

testUpload();
