# 파일 업로드 워크플로우 가이드

Google Gemini File Search에서 제공하는 두 가지 파일 업로드 방식에 대한 상세 가이드입니다.

## 📋 목차
- [워크플로우 개요](#워크플로우-개요)
- [방법 1: 직접 업로드](#방법-1-직접-업로드)
- [방법 2: Files API Import](#방법-2-files-api-import)
- [비교 및 선택 가이드](#비교-및-선택-가이드)
- [실행 예제](#실행-예제)

---

## 워크플로우 개요

### 방법 1: 직접 업로드 (1단계)
```
로컬 파일 → File Search Store
```
- 빠르고 간단한 단일 단계
- 파일이 즉시 스토어에 저장됨
- Files API 관리 불가

### 방법 2: Files API Import (2단계)
```
로컬 파일 → Files API → File Search Store
```
- Files API에 먼저 업로드 후 스토어로 가져오기
- 파일 재사용 및 관리 가능
- 인용(citation)에 displayName 표시

---

## 방법 1: 직접 업로드

### 특징
- ✅ **빠른 속도**: 1단계 프로세스
- ✅ **단순성**: 코드가 간결하고 이해하기 쉬움
- ❌ **Files API 미지원**: 업로드된 파일을 Files API로 관리 불가
- ❌ **재사용 제한**: 다른 스토어에서 같은 파일 재사용 불가

### 사용 방법

```javascript
const RAGAgent = require('./RAGAgent');
require('dotenv').config();

const agent = new RAGAgent(process.env.GEMINI_API_KEY);

// 초기화
await agent.initialize('my-store');

// 단일 파일 직접 업로드
await agent.uploadFile('document.pdf', {
  displayName: 'My Document',
  mimeType: 'application/pdf'
});

// 여러 파일 일괄 업로드
await agent.uploadFiles([
  'doc1.txt',
  { path: 'doc2.pdf', displayName: 'Report' }
]);
```

### 내부 동작

1. **파일 읽기**: 로컬 파일 시스템에서 파일 읽기
2. **업로드**: `fileSearchStores.uploadToFileSearchStore()` API 호출
3. **완료 대기**: polling 방식으로 업로드 완료 체크
4. **결과 반환**: 업로드 완료 정보 반환

### 적합한 시나리오
- 빠른 프로토타이핑
- 단순한 파일 업로드 요구사항
- Files API 관리 불필요
- 일회성 파일 사용

---

## 방법 2: Files API Import

### 특징
- ✅ **Files API 관리**: 업로드된 파일을 Files API로 관리 가능
- ✅ **파일 재사용**: 여러 스토어에서 같은 파일 재사용 가능
- ✅ **인용 표시**: displayName이 답변 인용에 표시됨
- ✅ **중앙 관리**: Files API에서 파일 목록 조회 및 삭제 가능
- ❌ **2단계 프로세스**: 업로드 후 가져오기 필요 (다소 느림)

### 사용 방법

```javascript
const RAGAgent = require('./RAGAgent');
require('dotenv').config();

const agent = new RAGAgent(process.env.GEMINI_API_KEY);

// 초기화
await agent.initialize('my-store');

// 단일 파일 업로드 및 가져오기
const result = await agent.uploadAndImportFile('document.pdf', {
  displayName: 'My Important Document',
  mimeType: 'application/pdf'
});

console.log('Files API 이름:', result.filesAPIName);
console.log('Store 이름:', result.storeName);

// 여러 파일 일괄 업로드 및 가져오기
await agent.uploadAndImportFiles([
  'doc1.txt',
  { path: 'doc2.pdf', displayName: 'Report' }
]);

// Files API 파일 목록 조회
const files = await agent.listUploadedFiles();
console.log('업로드된 파일:', files);

// Files API에서 파일 삭제
await agent.deleteUploadedFile(files[0].name);
```

### 내부 동작

#### 1단계: Files API 업로드
1. **파일 읽기**: 로컬 파일 시스템에서 파일 읽기
2. **업로드**: `files.upload()` API 호출
3. **파일 정보 반환**: Files API 파일 이름 (예: `files/abc123`) 반환

#### 2단계: Store Import
1. **Import 요청**: `fileSearchStores.importFile()` API 호출
2. **완료 대기**: polling 방식으로 import 완료 체크
3. **결과 반환**: Import 완료 정보 반환

### 적합한 시나리오
- 파일을 여러 스토어에서 재사용
- Files API를 통한 중앙 파일 관리 필요
- 답변 인용에 명확한 파일 이름 표시 필요
- 파일 업로드 이력 및 관리 필요

---

## 비교 및 선택 가이드

### 상세 비교표

| 항목 | 직접 업로드 | Files API Import |
|------|------------|------------------|
| **속도** | ⚡ 빠름 (1단계) | 🐢 다소 느림 (2단계) |
| **복잡도** | ✅ 단순 | ⚠️ 중간 |
| **Files API 관리** | ❌ 불가 | ✅ 가능 |
| **파일 재사용** | ❌ 불가 | ✅ 가능 |
| **인용 표시** | 기본 이름 | displayName |
| **파일 목록 조회** | Store 한정 | Files API 전체 |
| **파일 삭제** | Store에서만 | Files API + Store |
| **API 호출 횟수** | 1회 | 2회 |
| **네트워크 오버헤드** | 낮음 | 중간 |

### 선택 기준

#### 직접 업로드를 선택하는 경우
- ✅ 빠른 응답 속도가 중요한 경우
- ✅ 파일을 한 스토어에서만 사용하는 경우
- ✅ 단순한 구조를 원하는 경우
- ✅ Files API 관리가 불필요한 경우
- ✅ 프로토타입 개발 단계

#### Files API Import를 선택하는 경우
- ✅ 같은 파일을 여러 스토어에서 사용하는 경우
- ✅ 파일 업로드 이력 관리가 필요한 경우
- ✅ 답변 인용에 명확한 파일 이름이 필요한 경우
- ✅ 중앙 집중식 파일 관리가 필요한 경우
- ✅ 파일 생명주기 관리가 필요한 경우

---

## 실행 예제

### 예제 1: 직접 업로드
```bash
npm run example:rag
```

### 예제 2: Files API Import
```bash
npm run example:import
```

### 예제 3: 두 방식 비교
```bash
npm run example:compare
```

---

## Python 참조 코드와의 매핑

### Python: 직접 업로드
```python
operation = client.file_search_stores.upload_to_file_search_store(
    file='sample.txt',
    file_search_store_name=store.name,
    config={'display_name': 'display-file-name'}
)
```

### JavaScript: 직접 업로드
```javascript
await agent.uploadFile('sample.txt', {
    displayName: 'display-file-name'
});
```

### Python: Files API Import
```python
# 1단계: Files API 업로드
sample_file = client.files.upload(
    file='sample.txt',
    config={'name': 'display_file_name'}
)

# 2단계: Store Import
operation = client.file_search_stores.import_file(
    file_search_store_name=store.name,
    file_name=sample_file.name
)
```

### JavaScript: Files API Import
```javascript
await agent.uploadAndImportFile('sample.txt', {
    displayName: 'display_file_name'
});
```

---

## 추가 리소스

- [Google Gemini API 문서](https://ai.google.dev/)
- [File Search 가이드](https://ai.google.dev/gemini-api/docs/file-search)
- [Files API 레퍼런스](https://ai.google.dev/gemini-api/docs/files)

---

**문서 버전**: 1.0.0
**최종 업데이트**: 2025
