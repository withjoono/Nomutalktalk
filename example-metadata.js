const RAGAgent = require('./RAGAgent');
require('dotenv').config();

/**
 * 커스텀 메타데이터 기능 예제
 * Files API Import 시 파일에 메타데이터 추가
 */

/**
 * 예제 1: 기본 메타데이터 사용
 */
async function basicMetadata() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 1: 기본 메타데이터 사용 ===\n');

    // 1. 에이전트 초기화
    await agent.initialize('metadata-test-store');

    // 2. 메타데이터와 함께 파일 업로드
    const result = await agent.uploadAndImportFile('sample.txt', {
      displayName: 'Sample Document',
      mimeType: 'text/plain',
      customMetadata: [
        { key: 'author', stringValue: 'John Doe' },
        { key: 'year', numericValue: 2024 },
        { key: 'department', stringValue: 'Engineering' }
      ]
    });

    console.log('\n✓ 업로드 완료');
    console.log('파일 이름:', result.fileName);
    console.log('메타데이터:', result.customMetadata);

    // 3. 정리
    await agent.cleanup();

  } catch (error) {
    console.error('오류:', error.message);
  }
}

/**
 * 예제 2: 문자열과 숫자 메타데이터 혼합
 */
async function mixedMetadata() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 2: 문자열과 숫자 메타데이터 혼합 ===\n');

    await agent.initialize('mixed-metadata-store');

    // 문자열 및 숫자 메타데이터 조합
    const result = await agent.uploadAndImportFile('sample.txt', {
      displayName: 'Product Manual',
      customMetadata: [
        // 문자열 메타데이터
        { key: 'product_name', stringValue: 'Widget Pro 3000' },
        { key: 'category', stringValue: 'Electronics' },
        { key: 'version', stringValue: '3.0.1' },
        { key: 'language', stringValue: 'ko' },

        // 숫자 메타데이터
        { key: 'price', numericValue: 299.99 },
        { key: 'stock', numericValue: 150 },
        { key: 'rating', numericValue: 4.5 },
        { key: 'page_count', numericValue: 42 }
      ]
    });

    console.log('\n✓ 메타데이터 설정 완료');
    console.log(`총 ${result.customMetadata.length}개 메타데이터 항목 추가됨`);

    await agent.cleanup();

  } catch (error) {
    console.error('오류:', error.message);
  }
}

/**
 * 예제 3: 문서 분류용 메타데이터
 */
async function documentClassification() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 3: 문서 분류용 메타데이터 ===\n');

    await agent.initialize('classified-docs-store');

    // 여러 문서를 분류 메타데이터와 함께 업로드
    const documents = [
      {
        path: 'doc1.txt',
        displayName: 'Q1 Report',
        customMetadata: [
          { key: 'doc_type', stringValue: 'report' },
          { key: 'quarter', numericValue: 1 },
          { key: 'year', numericValue: 2024 },
          { key: 'confidential', stringValue: 'yes' }
        ]
      },
      {
        path: 'doc2.txt',
        displayName: 'Product Spec',
        customMetadata: [
          { key: 'doc_type', stringValue: 'specification' },
          { key: 'version', stringValue: '2.0' },
          { key: 'status', stringValue: 'draft' },
          { key: 'priority', numericValue: 5 }
        ]
      },
      {
        path: 'doc3.txt',
        displayName: 'Meeting Notes',
        customMetadata: [
          { key: 'doc_type', stringValue: 'notes' },
          { key: 'meeting_type', stringValue: 'weekly' },
          { key: 'attendees', numericValue: 8 },
          { key: 'duration_minutes', numericValue: 60 }
        ]
      }
    ];

    console.log(`📤 ${documents.length}개 문서 업로드 중...`);

    for (const doc of documents) {
      try {
        await agent.uploadAndImportFile(doc.path, {
          displayName: doc.displayName,
          customMetadata: doc.customMetadata
        });
        console.log(`✓ ${doc.displayName} 업로드 완료`);
      } catch (error) {
        console.error(`✗ ${doc.displayName} 실패:`, error.message);
      }
    }

    // 상태 확인
    const status = await agent.getStatus();
    console.log(`\n📊 총 ${status.documentCount}개 문서 업로드됨`);

    await agent.cleanup();

  } catch (error) {
    console.error('오류:', error.message);
  }
}

/**
 * 예제 4: 메타데이터와 청킹 함께 사용
 */
async function metadataWithChunking() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 4: 메타데이터와 청킹 함께 사용 ===\n');

    await agent.initialize('optimized-store');

    // 메타데이터 + 청킹 구성 조합
    const result = await agent.uploadAndImportFile('sample.txt', {
      displayName: 'Technical Documentation',
      mimeType: 'text/plain',

      // 청킹 설정
      chunkingConfig: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 250,
          maxOverlapTokens: 25
        }
      },

      // 메타데이터
      customMetadata: [
        { key: 'author', stringValue: 'Technical Writing Team' },
        { key: 'doc_type', stringValue: 'technical' },
        { key: 'complexity_level', numericValue: 3 },
        { key: 'target_audience', stringValue: 'developers' },
        { key: 'estimated_read_time', numericValue: 15 }
      ]
    });

    console.log('\n✓ 최적화된 설정으로 업로드 완료');
    console.log('청킹:', result.chunkingConfig);
    console.log('메타데이터:', result.customMetadata);

    await agent.cleanup();

  } catch (error) {
    console.error('오류:', error.message);
  }
}

/**
 * 예제 5: 메타데이터 검증 예제
 */
async function metadataValidation() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 5: 메타데이터 검증 예제 ===\n');

    await agent.initialize('validation-test-store');

    // 올바른 메타데이터
    console.log('✓ 테스트 1: 올바른 메타데이터');
    await agent.uploadAndImportFile('sample.txt', {
      displayName: 'Valid Metadata',
      customMetadata: [
        { key: 'valid_string', stringValue: 'test' },
        { key: 'valid_number', numericValue: 123 }
      ]
    });
    console.log('  성공: 올바른 메타데이터 검증 통과\n');

    // 잘못된 메타데이터 예시들
    const invalidCases = [
      {
        name: 'key 누락',
        metadata: [{ stringValue: 'no key' }],
        expected: 'key는 필수'
      },
      {
        name: 'value 누락',
        metadata: [{ key: 'no_value' }],
        expected: 'stringValue 또는 numericValue 필요'
      },
      {
        name: '중복 value',
        metadata: [{ key: 'both', stringValue: 'str', numericValue: 123 }],
        expected: '동시에 사용할 수 없습니다'
      },
      {
        name: '잘못된 numericValue 타입',
        metadata: [{ key: 'wrong_type', numericValue: 'not a number' }],
        expected: 'numericValue는 숫자'
      }
    ];

    for (const testCase of invalidCases) {
      console.log(`✗ 테스트: ${testCase.name}`);
      try {
        await agent.uploadAndImportFile('sample.txt', {
          displayName: 'Invalid Test',
          customMetadata: testCase.metadata
        });
        console.log(`  ⚠️  예상치 못한 성공 (검증 실패)`);
      } catch (error) {
        if (error.message.includes(testCase.expected)) {
          console.log(`  성공: 예상된 오류 발생 - ${error.message}\n`);
        } else {
          console.log(`  실패: 예상과 다른 오류 - ${error.message}\n`);
        }
      }
    }

    await agent.cleanup();

  } catch (error) {
    console.error('오류:', error.message);
  }
}

/**
 * 예제 6: 실전 사용 시나리오 - 도서 관리
 */
async function bookManagementScenario() {
  const API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
  const agent = new RAGAgent(API_KEY);

  try {
    console.log('\n=== 예제 6: 실전 시나리오 - 도서 관리 시스템 ===\n');

    await agent.initialize('library-store');

    // 도서 정보와 함께 업로드
    const books = [
      {
        path: 'book1.txt',
        displayName: 'I, Claudius',
        customMetadata: [
          { key: 'author', stringValue: 'Robert Graves' },
          { key: 'year', numericValue: 1934 },
          { key: 'genre', stringValue: 'Historical Fiction' },
          { key: 'pages', numericValue: 468 },
          { key: 'isbn', stringValue: '978-0679724773' },
          { key: 'rating', numericValue: 4.5 },
          { key: 'language', stringValue: 'en' },
          { key: 'publisher', stringValue: 'Vintage' }
        ]
      },
      {
        path: 'book2.txt',
        displayName: 'The Great Gatsby',
        customMetadata: [
          { key: 'author', stringValue: 'F. Scott Fitzgerald' },
          { key: 'year', numericValue: 1925 },
          { key: 'genre', stringValue: 'Classic Literature' },
          { key: 'pages', numericValue: 180 },
          { key: 'isbn', stringValue: '978-0743273565' },
          { key: 'rating', numericValue: 4.2 },
          { key: 'language', stringValue: 'en' },
          { key: 'publisher', stringValue: 'Scribner' }
        ]
      },
      {
        path: 'book3.txt',
        displayName: '1984',
        customMetadata: [
          { key: 'author', stringValue: 'George Orwell' },
          { key: 'year', numericValue: 1949 },
          { key: 'genre', stringValue: 'Dystopian Fiction' },
          { key: 'pages', numericValue: 328 },
          { key: 'isbn', stringValue: '978-0451524935' },
          { key: 'rating', numericValue: 4.7 },
          { key: 'language', stringValue: 'en' },
          { key: 'publisher', stringValue: 'Signet Classic' }
        ]
      }
    ];

    console.log('📚 도서관 구축 중...\n');

    for (const book of books) {
      try {
        await agent.uploadAndImportFile(book.path, {
          displayName: book.displayName,
          customMetadata: book.customMetadata
        });

        const metadata = book.customMetadata.find(m => m.key === 'author');
        const year = book.customMetadata.find(m => m.key === 'year');
        console.log(`✓ "${book.displayName}" by ${metadata.stringValue} (${year.numericValue})`);
      } catch (error) {
        console.error(`✗ "${book.displayName}" 실패:`, error.message);
      }
    }

    // 도서관 상태 확인
    const status = await agent.getStatus();
    console.log(`\n📊 도서관 통계:`);
    console.log(`  총 도서 수: ${status.documentCount}`);

    // 질의응답 테스트
    console.log('\n🔍 질의응답 테스트:');
    const question = '1930년대에 출간된 도서는?';
    console.log(`  질문: ${question}`);

    const answer = await agent.ask(question);
    console.log(`  답변: ${answer}\n`);

    await agent.cleanup();

  } catch (error) {
    console.error('오류:', error.message);
  }
}

// 메인 실행
if (require.main === module) {
  const example = process.argv[2] || '1';

  const examples = {
    '1': basicMetadata,
    '2': mixedMetadata,
    '3': documentClassification,
    '4': metadataWithChunking,
    '5': metadataValidation,
    '6': bookManagementScenario
  };

  if (examples[example]) {
    examples[example]();
  } else {
    console.log('사용법:');
    console.log('  node example-metadata.js 1  # 기본 메타데이터 사용');
    console.log('  node example-metadata.js 2  # 문자열과 숫자 메타데이터 혼합');
    console.log('  node example-metadata.js 3  # 문서 분류용 메타데이터');
    console.log('  node example-metadata.js 4  # 메타데이터와 청킹 함께 사용');
    console.log('  node example-metadata.js 5  # 메타데이터 검증 예제');
    console.log('  node example-metadata.js 6  # 실전 시나리오 - 도서 관리');
  }
}

module.exports = {
  basicMetadata,
  mixedMetadata,
  documentClassification,
  metadataWithChunking,
  metadataValidation,
  bookManagementScenario
};
