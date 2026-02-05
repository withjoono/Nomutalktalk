# 노무 AI - 법령·판례 기반 노무 상담 시스템

<div align="center">

⚖️ **노동법령과 판례를 기반으로 한 AI 노무 상담 시스템**

[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![Google Gemini](https://img.shields.io/badge/Google-Gemini%20API-blue.svg)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

[빠른 시작](#-빠른-시작) • [주요 기능](#-주요-기능) • [문서](#-문서) • [API](#-api)

</div>

---

## 📋 목차

- [개요](#-개요)
- [주요 기능](#-주요-기능)
- [빠른 시작](#-빠른-시작)
- [시스템 구조](#-시스템-구조)
- [문서](#-문서)
- [API 문서](#-api-문서)
- [개발 가이드](#-개발-가이드)

---

## 🎯 개요

노무 AI는 Google Gemini의 File Search 기능을 활용하여 노동 법령과 판례를 검색하고, 법적 근거를 바탕으로 노무 상담을 제공하는 RAG(Retrieval-Augmented Generation) 시스템입니다.

### 핵심 기술
- **Google Gemini File Search**: 문서 검색 및 RAG
- **커스텀 메타데이터**: 법령/판례 분류 및 필터링
- **프롬프트 엔지니어링**: 법률 전문가 역할 프롬프트
- **Express.js**: REST API 서버
- **반응형 웹 UI**: 5개 탭 인터페이스

---

## 🌟 주요 기능

### 1. 노무 질의응답
- 자연어 질문 입력
- 카테고리 자동 감지 (10개 카테고리)
- 법령 조항 자동 인용
- 판례 기반 답변 생성
- 구조화된 답변 형식

### 2. 유사 판례 검색
- 사건 설명 기반 검색
- 판시사항 및 법리 분석
- 적용 가능성 판단

### 3. 법령 조항 검색
- 특정 법령 조항 상세 조회
- 관련 판례 제공
- 실무 적용 방법 안내

### 4. 템플릿 상담
- 4가지 상황별 구조화 상담
  - 부당해고
  - 임금 관련
  - 근로시간
  - 휴가/휴직

### 5. 카테고리 시스템
- 10개 주요 카테고리 자동 분류
- 키워드 기반 카테고리 감지

---

## 🚀 빠른 시작

### 1. 환경 설정
```bash
# .env 파일 생성
GEMINI_API_KEY=your_api_key
LABOR_STORE_NAME=labor-law-knowledge-base
PORT=3005
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 데이터 준비
```bash
# 데이터 폴더 생성 (이미 생성됨)
# 법령 파일을 data/labor_laws/ 에 배치
# 판례 파일을 data/labor_cases/ 에 배치
```

### 4. 데이터 임포트
```bash
# 테스트 (dry run)
node scripts/import_labor_data.js laws --dry-run

# 실제 임포트
node scripts/import_labor_data.js laws
```

### 5. 서버 시작
```bash
npm start
```

### 6. 접속
- **웹 UI**: http://localhost:3005
- **API**: http://localhost:3005/api/labor/*

---

## 🏗 시스템 구조

```
Labor_Rag/
├── models/
│   └── laborSchemas.js          # 데이터 스키마 정의
├── scripts/
│   ├── import_labor_data.js     # 데이터 임포트
│   └── split_labor_json.js      # JSON 분할
├── tests/
│   └── test_labor_ai.js         # 테스트
├── public/
│   ├── labor_ai.html            # 웹 UI
│   ├── labor_ai.js              # 웹 UI 스크립트
│   ├── styles.css               # 스타일
│   └── index.html               # 리다이렉트
├── data/
│   ├── labor_laws/              # 법령 파일
│   ├── labor_cases/             # 판례 파일
│   └── metadata/                # 메타데이터 (선택)
├── RAGAgent.js                  # 노무 AI 핵심 로직
├── FileSearchManager.js         # Gemini API 래퍼
├── server.js                    # Express 서버
└── package.json
```

---

## 📚 문서

### 시작하기
- [빠른 시작 가이드](QUICK_START_LABOR_AI.md) - 5단계로 시작하기
- [데이터 임포트 가이드](LABOR_DATA_IMPORT_GUIDE.md) - 법령/판례 데이터 준비

### 사용 가이드
- [노무 AI 전체 가이드](LABOR_AI_GUIDE.md) - 전체 기능 상세 설명
- [API 문서](#-api-문서) - REST API 엔드포인트

### 개발 문서
- [프로젝트 요약](PROJECT_SUMMARY.md) - 시스템 구조 및 파일 설명
- [API 키 갱신 가이드](API_KEY_RENEWAL_GUIDE.md) - API 키 관리
- [청킹 가이드](CHUNKING_GUIDE.md) - 문서 청킹 최적화
- [배포 가이드](DEPLOYMENT_GUIDE.md) - Google Cloud Run 배포

---

## 🔌 API 문서

### 기본 URL
```
http://localhost:3005/api/labor
```

### 엔드포인트

#### 1. 질의응답
```http
POST /api/labor/ask
Content-Type: application/json

{
  "query": "직원을 해고하려면?",
  "category": "해고징계",
  "includeCases": true,
  "includeInterpretations": true
}
```

#### 2. 유사 판례 검색
```http
POST /api/labor/similar-cases
Content-Type: application/json

{
  "description": "근무 중 안전수칙 위반으로 해고"
}
```

#### 3. 법령 조항 검색
```http
POST /api/labor/law-article
Content-Type: application/json

{
  "lawName": "근로기준법",
  "article": "제23조"
}
```

#### 4. 템플릿 상담
```http
POST /api/labor/consult
Content-Type: application/json

{
  "templateType": "dismissal",
  "params": {
    "employeeType": "정규직",
    "workPeriod": "3년"
  }
}
```

#### 5. 카테고리 목록
```http
GET /api/labor/categories
```

#### 6. 스토어 상태
```http
GET /api/labor/store-status
```

#### 7. Health Check
```http
GET /api/labor/health
```

전체 API 문서: [LABOR_AI_GUIDE.md#api-문서](LABOR_AI_GUIDE.md#-api-문서)

---

## 💻 개발 가이드

### 테스트
```bash
# 자동 테스트
node tests/test_labor_ai.js

# 실제 질의응답 테스트 (스토어 필요)
node tests/test_labor_ai.js --real-query
```

### 프로그래밍 방식 사용
```javascript
const RAGAgent = require('./RAGAgent');

const agent = new RAGAgent(process.env.GEMINI_API_KEY, {
  storeName: 'labor-law-knowledge-base'
});

// 노무 질의
const answer = await agent.askLabor('해고 절차는?');

// 유사 판례
const cases = await agent.findSimilarCases('출근 중 사고');

// 법령 조회
const law = await agent.searchLawArticle('근로기준법', '제23조');
```

### 프롬프트 수정
프롬프트를 수정하려면 `RAGAgent.js`의 `buildLaborPrompt()` 메서드를 편집하세요.

### 카테고리 추가
카테고리를 추가하려면 `models/laborSchemas.js`의 `LaborCategories`를 편집하세요.

---

## 📊 데이터 스키마

### 법령 메타데이터
- `lawName`: 법령명
- `lawType`: 법령 유형 (act, decree, rule, notice, directive)
- `category`: 카테고리 (10개 중 1개)
- `keywords`: 검색 키워드

### 판례 메타데이터
- `caseNumber`: 사건번호
- `courtType`: 법원 유형 (supreme, high, district)
- `subject`: 사건 주제
- `judgmentResult`: 판결 결과
- `precedentValue`: 선례가치 (high, medium, low)

### 카테고리 (10개)
1. 근로계약
2. 임금
3. 근로시간
4. 휴가휴직
5. 해고징계
6. 산재보험
7. 고용보험
8. 차별
9. 노동조합
10. 안전보건

---

## 🔒 보안

### API 키 보호
- `.env` 파일 사용
- `.gitignore`에 `.env` 추가
- 코드에 하드코딩 금지

### 법률 자문 한계
⚠️ **중요**: 이 시스템은 참고용 정보 제공이며, 공식적인 법률 자문을 대체할 수 없습니다.

---

## 📈 시스템 요구사항

- Node.js 18.x 이상
- Google Gemini API 키
- 최소 2GB RAM
- 약 1GB 디스크 공간 (데이터 포함)

---

## 🤝 기여

이슈 및 풀 리퀘스트를 환영합니다!

---

## 📝 라이선스

ISC

---

## 🙏 감사의 말

- Google Gemini API
- Firebase
- Express.js
- 노동법령 및 판례 데이터 제공처

---

## 📞 문의

문제가 발생하면:
1. [이슈 등록](../../issues)
2. [문서 참조](LABOR_AI_GUIDE.md)
3. [테스트 실행](tests/test_labor_ai.js)

---

<div align="center">

Made with ❤️ for Labor Law Professionals

[시작하기](QUICK_START_LABOR_AI.md) • [문서](LABOR_AI_GUIDE.md) • [API](LABOR_AI_GUIDE.md#-api-문서)

</div>
