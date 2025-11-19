const RAGAgent = require('./RAGAgent');
require('dotenv').config();

/**
 * 청킹(Chunking) 구성 예제
 * 파일을 작은 조각(chunk)으로 나누어 검색 효율성을 높이는 방법
 */

/**
 * 예제 1: 기본 청킹 설정
 */
async function basicChunkingExample() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 1: 기본 청킹 설정 ===\n');

    await agent.initialize('chunking-basic-store');

    // 기본 청킹 설정: 청크당 200 토큰, 오버랩 20 토큰
    const result = await agent.uploadFile('sample.txt', {
      displayName: 'Sample Document',
      chunkingConfig: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 200,
          maxOverlapTokens: 20
        }
      }
    });

    console.log('\n업로드 결과:', {
      fileName: result.fileName,
      chunkingConfig: result.chunkingConfig
    });

    // 질의응답
    const answer = await agent.ask('문서의 주요 내용은?');
    console.log('\n답변:', answer);

  } catch (error) {
    console.error('오류:', error.message);
  }
}

/**
 * 예제 2: 다양한 청킹 전략 비교
 */
async function compareChunkingStrategies() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 2: 다양한 청킹 전략 비교 ===\n');

    await agent.initialize('chunking-comparison-store');

    // 전략 1: 작은 청크 (정밀 검색)
    console.log('📦 전략 1: 작은 청크 (100 토큰, 오버랩 10)');
    await agent.uploadFile('document1.txt', {
      displayName: 'Small Chunks',
      chunkingConfig: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 100,
          maxOverlapTokens: 10
        }
      }
    });

    // 전략 2: 중간 청크 (균형)
    console.log('\n📦 전략 2: 중간 청크 (200 토큰, 오버랩 20)');
    await agent.uploadFile('document2.txt', {
      displayName: 'Medium Chunks',
      chunkingConfig: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 200,
          maxOverlapTokens: 20
        }
      }
    });

    // 전략 3: 큰 청크 (문맥 유지)
    console.log('\n📦 전략 3: 큰 청크 (500 토큰, 오버랩 50)');
    await agent.uploadFile('document3.txt', {
      displayName: 'Large Chunks',
      chunkingConfig: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 500,
          maxOverlapTokens: 50
        }
      }
    });

    console.log('\n✓ 모든 청킹 전략 적용 완료');

    // 각 전략에 대해 질문
    const answer = await agent.ask('세 문서의 내용을 비교해주세요');
    console.log('\n답변:', answer);

  } catch (error) {
    console.error('오류:', error.message);
  }
}

/**
 * 예제 3: Files API Import와 청킹 설정
 */
async function importWithChunking() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 3: Files API Import + 청킹 설정 ===\n');

    await agent.initialize('chunking-import-store');

    // Files API를 통한 업로드 및 가져오기 + 청킹 설정
    const result = await agent.uploadAndImportFile('document.pdf', {
      displayName: 'PDF Document',
      mimeType: 'application/pdf',
      chunkingConfig: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 300,
          maxOverlapTokens: 30
        }
      }
    });

    console.log('\n가져오기 결과:', {
      fileName: result.fileName,
      filesAPIName: result.filesAPIName,
      chunkingConfig: result.chunkingConfig
    });

    const answer = await agent.ask('PDF 문서의 핵심 내용은?');
    console.log('\n답변:', answer);

  } catch (error) {
    console.error('오류:', error.message);
  }
}

/**
 * 예제 4: 문서 타입별 최적 청킹 설정
 */
async function documentTypeOptimalChunking() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 4: 문서 타입별 최적 청킹 설정 ===\n');

    await agent.initialize('chunking-optimal-store');

    // 코드 파일: 작은 청크 (함수/클래스 단위)
    console.log('💻 코드 파일: 작은 청크');
    await agent.uploadFile('script.js', {
      displayName: 'Code File',
      chunkingConfig: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 150,
          maxOverlapTokens: 15
        }
      }
    });

    // 기술 문서: 중간 청크 (문단 단위)
    console.log('\n📄 기술 문서: 중간 청크');
    await agent.uploadFile('technical-doc.md', {
      displayName: 'Technical Documentation',
      chunkingConfig: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 250,
          maxOverlapTokens: 25
        }
      }
    });

    // 장문 텍스트: 큰 청크 (섹션 단위)
    console.log('\n📚 장문 텍스트: 큰 청크');
    await agent.uploadFile('long-article.txt', {
      displayName: 'Long Article',
      chunkingConfig: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 400,
          maxOverlapTokens: 40
        }
      }
    });

    console.log('\n✓ 모든 문서 타입별 청킹 완료');

  } catch (error) {
    console.error('오류:', error.message);
  }
}

/**
 * 예제 5: 청킹 설정 검증
 */
async function chunkingValidationExample() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 5: 청킹 설정 검증 ===\n');

    await agent.initialize('chunking-validation-store');

    // 유효한 설정
    console.log('✅ 유효한 청킹 설정 테스트');
    await agent.uploadFile('sample.txt', {
      displayName: 'Valid Config',
      chunkingConfig: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 200,
          maxOverlapTokens: 20
        }
      }
    });
    console.log('✓ 유효한 설정 통과');

    // 잘못된 설정 1: maxOverlapTokens >= maxTokensPerChunk
    console.log('\n❌ 잘못된 설정 1: 오버랩이 청크 크기보다 큼');
    try {
      await agent.uploadFile('sample.txt', {
        displayName: 'Invalid Config 1',
        chunkingConfig: {
          whiteSpaceConfig: {
            maxTokensPerChunk: 100,
            maxOverlapTokens: 100 // 오류: 청크 크기와 같음
          }
        }
      });
    } catch (error) {
      console.log('예상된 오류:', error.message);
    }

    // 잘못된 설정 2: 음수 값
    console.log('\n❌ 잘못된 설정 2: 음수 값');
    try {
      await agent.uploadFile('sample.txt', {
        displayName: 'Invalid Config 2',
        chunkingConfig: {
          whiteSpaceConfig: {
            maxTokensPerChunk: -100, // 오류: 음수
            maxOverlapTokens: 10
          }
        }
      });
    } catch (error) {
      console.log('예상된 오류:', error.message);
    }

  } catch (error) {
    console.error('오류:', error.message);
  }
}

// 메인 실행
if (require.main === module) {
  const example = process.argv[2] || '1';

  const examples = {
    '1': basicChunkingExample,
    '2': compareChunkingStrategies,
    '3': importWithChunking,
    '4': documentTypeOptimalChunking,
    '5': chunkingValidationExample
  };

  if (examples[example]) {
    examples[example]();
  } else {
    console.log('사용법:');
    console.log('  node example-chunking.js 1  # 기본 청킹 설정');
    console.log('  node example-chunking.js 2  # 청킹 전략 비교');
    console.log('  node example-chunking.js 3  # Files API Import + 청킹');
    console.log('  node example-chunking.js 4  # 문서 타입별 최적 청킹');
    console.log('  node example-chunking.js 5  # 청킹 설정 검증');
  }
}

module.exports = {
  basicChunkingExample,
  compareChunkingStrategies,
  importWithChunking,
  documentTypeOptimalChunking,
  chunkingValidationExample
};
