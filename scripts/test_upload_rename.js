
const RAGAgent = require('../RAGAgent');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

async function testUploadRenamed() {
    console.log('🧪 업로드 테스트 시작 (파일 이름 변경)');
    const agent = new RAGAgent(process.env.GEMINI_API_KEY);

    // Original file
    const originalFile = path.join(__dirname, '../data/labor_laws/개인정보_보호법.txt');

    // Temp ASCII file
    const tempFile = path.join(__dirname, '../data/labor_laws/temp_law.txt');

    // Copy
    fs.copyFileSync(originalFile, tempFile);
    console.log(`파일 복사: ${originalFile} -> ${tempFile}`);

    try {
        await agent.initialize('test-store');

        console.log(`업로드 시도: ${tempFile}`);

        // Pass original title as displayName
        const displayName = "개인정보 보호법";
        // NOTE: We identified earlier that Korean displayName might NOT be the issue if the FILE PATH was the issue. 
        // But let's test with Korean displayName as well to see if it works now.
        // If it fails again, then BOTH are issues.
        // Let's start with ASCII displayName to isolate the filePath issue first.

        const result = await agent.uploadAndImportFile(tempFile, {
            displayName: "LaborLaw_Test_Renamed",
            mimeType: 'text/plain'
        });

        console.log('✅ 성공!');
        console.log(result);

    } catch (e) {
        console.error('❌ 실패:', e.message);
    } finally {
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
            console.log('임시 파일 삭제 완료');
        }
    }
}

testUploadRenamed();
