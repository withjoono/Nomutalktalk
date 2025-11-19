# 웹 인터페이스 사용 가이드

Google File Search RAG Agent의 로컬 웹 인터페이스 사용 방법입니다.

## 📋 목차
- [설치 및 실행](#설치-및-실행)
- [주요 기능](#주요-기능)
- [사용 방법](#사용-방법)
- [API 엔드포인트](#api-엔드포인트)
- [문제 해결](#문제-해결)

## 🚀 설치 및 실행

### 1. 필요한 패키지 설치

```bash
npm install
```

필요한 패키지:
- `express` - 웹 서버
- `multer` - 파일 업로드 처리
- `@google/genai` - Google Gemini API
- `dotenv` - 환경 변수 관리

### 2. 환경 변수 설정

`.env` 파일에 API 키 설정:

```bash
GEMINI_API_KEY=your_api_key_here
PORT=3000  # 선택사항 (기본값: 3000)
```

### 3. 서버 시작

```bash
npm start
# 또는
npm run dev
```

서버가 시작되면 다음 메시지가 표시됩니다:

```
🚀 Google File Search RAG Agent 서버 시작
📡 URL: http://localhost:3000
🔑 API 키 설정: ✅
```

### 4. 웹 브라우저에서 접속

브라우저에서 `http://localhost:3000` 접속

## 🎯 주요 기능

### 1. 스토어 관리
- ✅ 새 스토어 생성
- ✅ 기존 스토어 사용
- ✅ 스토어 상태 조회
- ✅ 모든 스토어 목록 보기
- ✅ 스토어 삭제

### 2. 파일 업로드
- ✅ **직접 업로드**: 빠른 1단계 업로드
- ✅ **Files API Import**: 메타데이터 지원 2단계 업로드
- ✅ 청킹 구성 (검색 최적화)
- ✅ 커스텀 메타데이터 추가 (Import 방식)

### 3. 질의응답
- ✅ 업로드된 문서 기반 질문
- ✅ AI 답변 생성
- ✅ 실시간 응답

### 4. 문서 관리
- ✅ 문서 목록 조회
- ✅ 문서 삭제
- ✅ 문서 정보 보기

## 📖 사용 방법

### 스텝 1: 스토어 초기화

#### 방법 A: 새 스토어 생성
1. "새 스토어 생성" 선택
2. 스토어 이름 입력 (예: `my-knowledge-base`)
3. "🚀 새 스토어 생성" 버튼 클릭

#### 방법 B: 기존 스토어 사용
1. "기존 스토어 사용" 선택
2. 스토어 ID 입력 (예: `fileSearchStores/abc123`)
3. "📂 기존 스토어 사용" 버튼 클릭

### 스텝 2: 파일 업로드

#### 직접 업로드 방식 (빠름)
1. "직접 업로드" 선택
2. 파일 선택
3. 표시 이름 입력 (선택사항)
4. 청킹 설정 (선택사항)
   - "청킹 활성화" 체크
   - 청크당 최대 토큰 설정 (권장: 250)
   - 청크 간 오버랩 토큰 설정 (권장: 25)
5. "📤 파일 업로드" 버튼 클릭

#### Files API Import 방식 (메타데이터 지원)
1. "Files API Import" 선택
2. 파일 선택
3. 표시 이름 입력 (선택사항)
4. 청킹 설정 (선택사항)
5. 커스텀 메타데이터 추가 (선택사항)
   - "🏷️ 커스텀 메타데이터" 클릭
   - "➕ 메타데이터 추가" 버튼 클릭
   - 키, 값 타입, 값 입력
   - 예: `author` (문자열) = `Robert Graves`
   - 예: `year` (숫자) = `1934`
6. "📤 파일 업로드" 버튼 클릭

### 스텝 3: 질문하기

1. 질문 입력 필드에 질문 작성
2. "🔍 질문하기" 버튼 클릭
3. AI 답변 확인

**팁**: Ctrl + Enter로 빠르게 질문 제출 가능

### 스텝 4: 문서 관리

1. "🔄 문서 목록 새로고침" 버튼으로 최신 목록 조회
2. 각 문서의 "삭제" 버튼으로 문서 제거 가능

## 🔧 API 엔드포인트

### 서버 상태
```
GET /api/health
```
서버 및 API 키 상태 확인

### 스토어 관리
```
POST /api/store/initialize
Body: { displayName: "my-store" } 또는 { storeName: "fileSearchStores/xxx" }
```
새 스토어 생성 또는 기존 스토어 사용

```
GET /api/store/status
```
현재 스토어 상태 조회

```
GET /api/stores
```
모든 스토어 목록 조회

```
DELETE /api/store/:storeName
```
특정 스토어 삭제

### 파일 업로드
```
POST /api/upload
Content-Type: multipart/form-data
Fields: file, displayName, chunkingConfig
```
직접 업로드 방식

```
POST /api/upload-import
Content-Type: multipart/form-data
Fields: file, displayName, chunkingConfig, customMetadata
```
Files API Import 방식

### 질의응답
```
POST /api/ask
Body: { query: "질문 내용" }
```
질문에 대한 답변 생성

### 문서 관리
```
GET /api/documents
```
현재 스토어의 문서 목록 조회

```
DELETE /api/document/:documentName
```
특정 문서 삭제

### Files API 관리
```
GET /api/files
```
Files API 파일 목록 조회

```
DELETE /api/file/:fileName
```
Files API 파일 삭제

## 🔍 청킹 설정 가이드

청킹은 검색 성능을 최적화하기 위해 파일을 적절한 크기로 나누는 기능입니다.

### 문서 타입별 권장 설정

| 문서 타입 | maxTokensPerChunk | maxOverlapTokens |
|-----------|-------------------|------------------|
| 코드 파일 | 150 | 15 |
| 기술 문서 | 250 | 25 |
| 장문 텍스트 | 400 | 40 |

### 설정 가이드라인
- **maxTokensPerChunk**: 청크당 최대 토큰 수 (100-500 권장)
- **maxOverlapTokens**: 청크 간 중복 토큰 수 (최대 토큰의 10% 권장)

더 자세한 내용은 [CHUNKING_GUIDE.md](CHUNKING_GUIDE.md)를 참조하세요.

## 🏷️ 메타데이터 사용 예제

### 도서 관리
```javascript
키: author, 타입: 문자열, 값: Robert Graves
키: year, 타입: 숫자, 값: 1934
키: genre, 타입: 문자열, 값: Historical Fiction
키: rating, 타입: 숫자, 값: 4.5
```

### 문서 분류
```javascript
키: doc_type, 타입: 문자열, 값: report
키: quarter, 타입: 숫자, 값: 1
키: year, 타입: 숫자, 값: 2024
키: confidential, 타입: 문자열, 값: yes
```

## ❓ 문제 해결

### 서버가 시작되지 않음
1. `.env` 파일에 `GEMINI_API_KEY` 확인
2. 포트 3000이 이미 사용 중인지 확인
3. `npm install`로 패키지 재설치

### 파일 업로드 실패
1. 파일 크기 확인 (최대 50MB)
2. 스토어가 초기화되었는지 확인
3. 지원되는 파일 형식 확인 (.txt, .pdf, .doc, .docx, .md)

### 질문에 답변이 없음
1. 파일이 성공적으로 업로드되었는지 확인
2. 문서 목록에서 파일 확인
3. 질문이 업로드된 문서와 관련이 있는지 확인

### API 키 오류
1. `.env` 파일 존재 확인
2. API 키 형식 확인
3. Google AI Studio에서 API 키 유효성 확인

## 🔒 보안 고려사항

### 프로덕션 배포 시 주의사항
1. **환경 변수 보호**: `.env` 파일을 Git에 포함하지 마세요
2. **CORS 설정**: 프로덕션 환경에서 CORS 정책 적용
3. **파일 크기 제한**: 필요에 따라 업로드 크기 제한 조정
4. **인증/인가**: 프로덕션에서는 사용자 인증 구현 필요
5. **HTTPS 사용**: 프로덕션에서는 HTTPS 필수

### 현재 보안 설정
- ✅ API 키는 환경 변수로 관리
- ✅ 업로드 파일 크기 제한 (50MB)
- ✅ 임시 파일 자동 삭제
- ⚠️ 인증/인가 없음 (로컬 개발 전용)

## 📞 추가 리소스

- [README.md](README.md) - 전체 프로젝트 문서
- [CHUNKING_GUIDE.md](CHUNKING_GUIDE.md) - 청킹 최적화 가이드
- [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md) - 워크플로우 비교
- [example-metadata.js](example-metadata.js) - 메타데이터 예제 코드
- [Google AI Studio](https://aistudio.google.com/) - API 키 발급

## 🎨 UI 특징

### 반응형 디자인
- 모바일, 태블릿, 데스크톱 지원
- 자동 레이아웃 조정

### 사용자 경험
- 실시간 진행 상태 표시
- 자동 알림 메시지
- 직관적인 인터페이스
- 키보드 단축키 지원 (Ctrl + Enter)

### 시각적 피드백
- 로딩 스피너
- 성공/실패 알림
- 상태 배지
- 색상 코딩 (성공: 녹색, 오류: 빨강, 정보: 파랑)
