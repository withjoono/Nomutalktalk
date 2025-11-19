# Google File Search RAG Agent

Google Gemini API의 File Search 기능을 활용한 RAG (Retrieval-Augmented Generation) 에이전트 라이브러리입니다.

## 📋 목차
- [주요 기능](#주요-기능)
- [설치](#설치)
- [빠른 시작](#빠른-시작)
- [웹 인터페이스](#웹-인터페이스)
- [API 레퍼런스](#api-레퍼런스)
- [예제](#예제)
- [보안](#보안)

## 🎯 주요 기능

### RAGAgent (고수준 API)
- ✅ **파일 직접 업로드**: 로컬 파일을 File Search Store에 직접 업로드 (1단계)
- ✅ **Files API Import**: Files API를 통한 업로드 후 스토어로 가져오기 (2단계)
- ✅ **일괄 업로드**: 여러 파일을 한 번에 업로드 (두 방식 모두 지원)
- ✅ **청킹(Chunking) 구성**: 맞춤형 청크 크기 및 오버랩 설정으로 검색 최적화
- ✅ **커스텀 메타데이터**: 파일에 사용자 정의 메타데이터 추가 (문자열, 숫자)
- ✅ **질의응답**: 업로드된 파일 기반 검색 및 답변 생성
- ✅ **스토어 관리**: 생성, 조회, 삭제 등 전체 라이프사이클 관리
- ✅ **Files API 관리**: 업로드된 파일 목록 조회 및 삭제
- ✅ **에러 처리**: 포괄적인 검증 및 에러 처리

### FileSearchManager (저수준 API)
- File Search Store CRUD 작업
- 문서 업로드 및 관리
- Files API 파일 업로드 및 Import
- 파일 검색 기반 콘텐츠 생성

## 📦 설치

```bash
npm install @google/genai
```

## 🚀 빠른 시작

### 1. API 키 설정

`.env` 파일을 생성하고 API 키를 추가하세요:

```bash
cp .env.example .env
# .env 파일을 편집하여 API 키 입력
```

### 2. RAG Agent 사용

```javascript
const RAGAgent = require('./RAGAgent');
require('dotenv').config();

const agent = new RAGAgent(process.env.GEMINI_API_KEY);

// 에이전트 초기화
await agent.initialize('my-knowledge-base');

// 파일 업로드
await agent.uploadFile('document.pdf', {
  displayName: 'Important Document',
  mimeType: 'application/pdf'
});

// 질문하기
const answer = await agent.ask('문서의 주요 내용은?');
console.log(answer);
```

## 🌐 웹 인터페이스

로컬 웹 브라우저에서 쉽게 사용할 수 있는 웹 인터페이스를 제공합니다.

### 웹 서버 시작

```bash
npm start
# 또는
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

### 주요 기능

- ✅ **스토어 관리**: 브라우저에서 스토어 생성, 조회, 삭제
- ✅ **파일 업로드**: 드래그 앤 드롭 파일 업로드
- ✅ **청킹 설정**: UI에서 청킹 파라미터 조정
- ✅ **메타데이터 추가**: 동적 메타데이터 필드 추가
- ✅ **질의응답**: 실시간 AI 답변
- ✅ **문서 관리**: 업로드된 문서 목록 및 삭제

### 웹 인터페이스 특징

- 📱 **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원
- 🎨 **현대적인 UI**: 그라디언트 디자인과 직관적인 인터페이스
- ⚡ **실시간 피드백**: 로딩 상태 및 진행 상황 표시
- 🔒 **보안**: 환경 변수 기반 API 키 관리

자세한 사용 방법은 [WEB_GUIDE.md](WEB_GUIDE.md)를 참조하세요.

## 📚 API 레퍼런스

### RAGAgent

#### Constructor
```javascript
new RAGAgent(apiKey, options)
```
- `apiKey` (string): Google Gemini API 키
- `options` (object, optional):
  - `storeName` (string): 기존 스토어 이름
  - `model` (string): 사용할 모델 (기본값: 'gemini-2.5-flash')
  - `uploadPollInterval` (number): 업로드 체크 간격 (ms, 기본값: 5000)

#### Methods

##### `initialize(displayName)`
에이전트 초기화 및 스토어 생성
- **Returns**: `Promise<string>` - 스토어 이름

##### `uploadFile(filePath, options)`
파일을 스토어에 업로드
- `filePath` (string): 파일 경로
- `options` (object):
  - `displayName` (string): 표시 이름
  - `mimeType` (string): MIME 타입
  - `chunkingConfig` (object): 청킹 구성 (선택사항)
    - `whiteSpaceConfig` (object):
      - `maxTokensPerChunk` (number): 청크당 최대 토큰 수
      - `maxOverlapTokens` (number): 청크 간 오버랩 토큰 수
- **Returns**: `Promise<Object>` - 업로드 결과

##### `uploadFiles(files)`
여러 파일 일괄 업로드 (직접 업로드 방식)
- `files` (Array): 파일 경로 배열 또는 설정 객체 배열
- **Returns**: `Promise<Array>` - 업로드 결과 배열

##### `uploadAndImportFile(filePath, options)`
Files API를 통한 파일 업로드 및 스토어 가져오기 (2단계 프로세스)
- `filePath` (string): 파일 경로
- `options` (object):
  - `displayName` (string): 표시 이름
  - `mimeType` (string): MIME 타입
  - `chunkingConfig` (object): 청킹 구성 (선택사항)
  - `customMetadata` (array): 커스텀 메타데이터 배열 (선택사항)
    - `key` (string): 메타데이터 키
    - `stringValue` (string): 문자열 값 (stringValue 또는 numericValue 중 하나 필수)
    - `numericValue` (number): 숫자 값 (stringValue 또는 numericValue 중 하나 필수)
- **Returns**: `Promise<Object>` - 가져오기 결과 (filesAPIName 포함)

##### `uploadAndImportFiles(files)`
여러 파일 일괄 업로드 및 가져오기 (Files API 방식)
- `files` (Array): 파일 경로 배열 또는 설정 객체 배열
- **Returns**: `Promise<Array>` - 가져오기 결과 배열

##### `listUploadedFiles()`
Files API에 업로드된 파일 목록 조회
- **Returns**: `Promise<Array>` - 파일 목록

##### `deleteUploadedFile(fileName)`
Files API에서 파일 삭제
- `fileName` (string): 파일 이름 (예: 'files/xxx')

##### `ask(query, options)`
질의응답 수행
- `query` (string): 질문
- `options` (object):
  - `model` (string): 사용할 모델
- **Returns**: `Promise<string>` - 답변

##### `getStatus()`
현재 스토어 상태 조회
- **Returns**: `Promise<Object>` - 문서 개수 및 목록

##### `listDocuments()`
현재 스토어의 모든 문서 조회
- **Returns**: `Promise<Array>` - 문서 목록

##### `deleteDocument(documentName)`
특정 문서 삭제
- `documentName` (string): 문서 이름

##### `listStores(pageSize)`
모든 File Search Store 목록 조회
- `pageSize` (number): 페이지당 항목 수 (기본값: 20)
- **Returns**: `Promise<Array>` - 스토어 목록

##### `getStore(storeName)`
특정 File Search Store 정보 조회
- `storeName` (string): 스토어 이름 (기본값: 현재 에이전트의 스토어)
- **Returns**: `Promise<Object>` - 스토어 상세 정보

##### `deleteStore(storeName, force)`
특정 File Search Store 삭제
- `storeName` (string): 삭제할 스토어 이름
- `force` (boolean): 강제 삭제 여부 (기본값: true)

##### `cleanup(force)`
현재 스토어 삭제 및 정리
- `force` (boolean): 강제 삭제 여부 (기본값: true)

## 💡 예제

### 기본 워크플로우

```javascript
const RAGAgent = require('./RAGAgent');
require('dotenv').config();

async function example() {
  const agent = new RAGAgent(process.env.GEMINI_API_KEY);

  // 초기화
  await agent.initialize('knowledge-base');

  // 단일 파일 업로드
  await agent.uploadFile('data.txt', {
    displayName: 'Data File'
  });

  // 질문
  const answer = await agent.ask('데이터에서 주요 트렌드는?');
  console.log(answer);

  // 정리
  await agent.cleanup();
}

example();
```

### 여러 파일 업로드

```javascript
// 방법 1: 직접 업로드 (빠름)
await agent.uploadFiles([
  'doc1.txt',
  { path: 'doc2.pdf', displayName: 'Report', mimeType: 'application/pdf' }
]);

// 방법 2: Files API Import (파일 재사용 가능)
await agent.uploadAndImportFiles([
  'doc1.txt',
  { path: 'doc2.pdf', displayName: 'Report', mimeType: 'application/pdf' }
]);
```

### Files API를 통한 업로드 및 가져오기

```javascript
// 2단계 프로세스: Files API 업로드 → Store Import
const result = await agent.uploadAndImportFile('document.pdf', {
  displayName: 'Important Doc',
  mimeType: 'application/pdf'
});

console.log('Files API 이름:', result.filesAPIName);
console.log('Store 이름:', result.storeName);

// Files API 파일 목록 조회
const files = await agent.listUploadedFiles();
console.log('업로드된 파일:', files.map(f => f.name));

// Files API에서 파일 삭제
await agent.deleteUploadedFile(files[0].name);
```

### 청킹(Chunking) 구성

파일을 최적화된 조각으로 나누어 검색 성능 향상:

```javascript
await agent.uploadFile('document.pdf', {
  displayName: 'My Document',
  mimeType: 'application/pdf',
  chunkingConfig: {
    whiteSpaceConfig: {
      maxTokensPerChunk: 200,    // 청크당 최대 200 토큰
      maxOverlapTokens: 20       // 청크 간 20 토큰 오버랩
    }
  }
});
```

**문서 타입별 권장 설정**:
- **코드 파일**: 150 토큰, 15 오버랩
- **기술 문서**: 250 토큰, 25 오버랩
- **장문 텍스트**: 400 토큰, 40 오버랩

자세한 내용은 [CHUNKING_GUIDE.md](CHUNKING_GUIDE.md)를 참조하세요.

### 커스텀 메타데이터

파일에 사용자 정의 메타데이터를 추가하여 파일 분류, 검색, 관리를 향상:

```javascript
await agent.uploadAndImportFile('document.pdf', {
  displayName: 'I, Claudius',
  mimeType: 'application/pdf',
  customMetadata: [
    { key: 'author', stringValue: 'Robert Graves' },
    { key: 'year', numericValue: 1934 },
    { key: 'genre', stringValue: 'Historical Fiction' },
    { key: 'rating', numericValue: 4.5 }
  ]
});
```

**메타데이터 특징**:
- **두 가지 값 타입**: `stringValue` (문자열) 또는 `numericValue` (숫자)
- **필수 항목**: `key`와 값 타입 중 하나 (`stringValue` 또는 `numericValue`)
- **사용 사례**: 문서 분류, 저자 정보, 버전 관리, 평점, 날짜 등
- **자동 검증**: 메타데이터 형식 및 타입 자동 검증

**실전 예제**:
```javascript
// 도서 관리 시스템
await agent.uploadAndImportFile('book.txt', {
  displayName: 'The Great Gatsby',
  customMetadata: [
    { key: 'author', stringValue: 'F. Scott Fitzgerald' },
    { key: 'year', numericValue: 1925 },
    { key: 'pages', numericValue: 180 },
    { key: 'isbn', stringValue: '978-0743273565' }
  ]
});

// 문서 분류 시스템
await agent.uploadAndImportFile('report.pdf', {
  displayName: 'Q1 Report',
  customMetadata: [
    { key: 'doc_type', stringValue: 'report' },
    { key: 'quarter', numericValue: 1 },
    { key: 'year', numericValue: 2024 },
    { key: 'confidential', stringValue: 'yes' }
  ]
});
```

**주의사항**:
- 메타데이터는 **Files API Import 방식**에서만 사용 가능 (`uploadAndImportFile`)
- 각 항목은 `stringValue`와 `numericValue` 중 **하나만** 가져야 함
- 청킹 구성과 메타데이터를 **동시에 사용** 가능

더 많은 예제는 [example-metadata.js](example-metadata.js)를 참조하세요.

### 두 가지 업로드 방식 비교

| 특징 | 직접 업로드 (`uploadFile`) | Files API Import (`uploadAndImportFile`) |
|------|---------------------------|----------------------------------------|
| 단계 | 1단계 | 2단계 (Upload → Import) |
| 속도 | 빠름 | 다소 느림 |
| Files API 관리 | 불가 | 가능 |
| 인용 표시 | 기본 | displayName 사용 |
| 파일 재사용 | 불가 | 가능 (여러 스토어) |
| 청킹 설정 | ✅ 지원 | ✅ 지원 |
| 커스텀 메타데이터 | ❌ 미지원 | ✅ 지원 |
| 사용 시나리오 | 단순 업로드 | 파일 관리 필요 시 |

### 스토어 관리

```javascript
// 모든 스토어 목록 조회
const stores = await agent.listStores();
console.log(`총 ${stores.length}개 스토어`);
stores.forEach(store => {
  console.log(`- ${store.displayName}: ${store.name}`);
});

// 특정 스토어 정보 조회
const storeInfo = await agent.getStore('fileSearchStores/abc123');
console.log('스토어 정보:', storeInfo);

// 현재 에이전트의 스토어 정보 조회
const currentStore = await agent.getStore();
console.log('현재 스토어:', currentStore);

// 특정 스토어 삭제
await agent.deleteStore('fileSearchStores/abc123', true);

// 현재 스토어 정리
await agent.cleanup();
```

### 기존 스토어 재사용

```javascript
const agent = new RAGAgent(process.env.GEMINI_API_KEY, {
  storeName: 'fileSearchStores/existing-store-id'
});

// initialize() 없이 바로 사용 가능
await agent.uploadFile('new-file.txt');
const answer = await agent.ask('새 파일 내용은?');
```

## 🔒 보안

### API 키 보호
- ✅ **환경 변수 사용**: `.env` 파일에 API 키 저장
- ✅ **Git 제외**: `.gitignore`에 `.env` 추가
- ❌ **코드에 하드코딩 금지**: 소스 코드에 직접 입력하지 마세요

### .gitignore 설정
```
.env
node_modules/
```

## 📁 프로젝트 구조

```
GoogleFileSearch/
├── RAGAgent.js                  # RAG Agent 클래스 (고수준 API)
├── FileSearchManager.js         # File Search Manager (저수준 API)
├── server.js                    # Express.js 웹 서버
├── public/                      # 웹 인터페이스 파일
│   ├── index.html               # 메인 HTML
│   ├── styles.css               # 스타일시트
│   └── app.js                   # 프론트엔드 JavaScript
├── uploads/                     # 임시 파일 업로드 디렉토리 (자동 생성)
├── example-rag-agent.js         # RAG Agent 기본 사용 예제
├── example-import-workflow.js   # Files API Import 워크플로우 예제
├── example-chunking.js          # 청킹 구성 예제
├── example-store-management.js  # 스토어 관리 예제
├── example-metadata.js          # 커스텀 메타데이터 예제
├── example.js                   # FileSearchManager 사용 예제
├── package.json
├── .env.example                 # 환경 변수 템플릿
├── .gitignore
├── README.md
├── WEB_GUIDE.md                 # 웹 인터페이스 사용 가이드
├── WORKFLOW_GUIDE.md            # 워크플로우 가이드
└── CHUNKING_GUIDE.md            # 청킹 구성 가이드
```

## 🔧 의존성

- `@google/genai` (^1.29.1): Google Gemini API SDK

## 📝 라이선스

ISC

## 🤝 기여

이슈 및 풀 리퀘스트를 환영합니다!

## 📞 문의

- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API 문서](https://ai.google.dev/)
