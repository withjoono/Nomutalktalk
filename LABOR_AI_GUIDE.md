# 노무 AI - 법령·판례 기반 노무 상담 시스템

노동법령과 판례를 기반으로 RAG(Retrieval-Augmented Generation) 기술을 활용한 AI 노무 상담 시스템입니다.

## 📋 목차

- [개요](#개요)
- [주요 기능](#주요-기능)
- [시스템 구조](#시스템-구조)
- [설치 및 설정](#설치-및-설정)
- [데이터 임포트](#데이터-임포트)
- [사용 방법](#사용-방법)
- [API 문서](#api-문서)
- [테스트](#테스트)

---

## 🎯 개요

이 시스템은 Google Gemini의 File Search 기능을 활용하여 노동 법령과 판례를 검색하고, 법적 근거를 바탕으로 노무 상담을 제공합니다.

### 핵심 기술
- **Google Gemini File Search**: 문서 검색 및 RAG
- **커스텀 메타데이터**: 법령/판례 분류 및 필터링
- **프롬프트 엔지니어링**: 법률 전문가 역할 프롬프트
- **Firebase Firestore**: 문서 메타데이터 영구 저장
- **Express.js**: REST API 서버

---

## 🌟 주요 기능

### 1. 노무 질의응답
- 자연어로 노무 관련 질문
- 관련 법령 조항 자동 인용
- 판례 기반 답변 생성
- 실무 주의사항 제공

### 2. 유사 판례 검색
- 사건 설명 기반 유사 판례 검색
- 판시사항 및 법리 분석
- 현재 사안 적용 가능성 판단

### 3. 법령 조항 검색
- 특정 법령 조항 상세 조회
- 관련 판례 및 행정해석 제공
- 실무 적용 방법 안내

### 4. 템플릿 상담
- 상황별 구조화된 상담 (부당해고, 임금, 근로시간, 휴가)
- 필수 검토사항 자동 체크
- 권리구제 방법 안내

### 5. 카테고리별 분류
- 10개 주요 카테고리 자동 분류
- 키워드 기반 카테고리 감지
- 카테고리별 문서 필터링

---

## 🏗 시스템 구조

```
Labor_Rag/
├── models/
│   └── laborSchemas.js          # 데이터 스키마 정의
├── scripts/
│   └── import_labor_data.js     # 데이터 임포트 스크립트
├── tests/
│   └── test_labor_ai.js         # 테스트 코드
├── public/
│   ├── labor_ai.html            # 웹 UI
│   └── labor_ai.js              # 웹 UI 스크립트
├── data/                         # 데이터 디렉토리 (생성 필요)
│   ├── labor_laws/              # 법령 파일
│   ├── labor_cases/             # 판례 파일
│   └── metadata/                # 메타데이터 JSON (선택)
├── RAGAgent.js                  # 노무 AI 메서드 포함
├── server.js                    # API 서버 (노무 API 포함)
└── .env                         # 환경 변수
```

---

## ⚙️ 설치 및 설정

### 1. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# 노무 AI 스토어 설정
LABOR_STORE_NAME=labor-law-knowledge-base

# 서버 설정
PORT=3005

# Firebase (선택)
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# OpenAI (선택 - 하이브리드 모델)
OPENAI_API_KEY=your_openai_key
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 데이터 디렉토리 생성

```bash
mkdir -p data/labor_laws
mkdir -p data/labor_cases
mkdir -p data/metadata/laws
mkdir -p data/metadata/cases
```

---

## 📦 데이터 임포트

### 데이터 준비

#### 법령 파일
- `data/labor_laws/` 폴더에 법령 PDF/TXT 파일 배치
- 파일명 형식 (권장): `법령명_법령유형_법령번호_제정일.pdf`
  - 예: `근로기준법_법률_제19488호_2023-12-26.pdf`

#### 판례 파일
- `data/labor_cases/` 폴더에 판례 PDF/TXT 파일 배치
- 파일명 형식 (권장): `법원명_사건번호_선고일_주제.pdf`
  - 예: `대법원_2023다12345_2023-12-26_부당해고.pdf`

#### 메타데이터 (선택)
- `data/metadata/laws/` 및 `data/metadata/cases/`에 JSON 파일 배치
- JSON 형식은 `models/laborSchemas.js` 참조

### 임포트 실행

#### 1. Dry Run (파일 목록만 확인)
```bash
node scripts/import_labor_data.js all --dry-run
```

#### 2. 법령만 임포트
```bash
node scripts/import_labor_data.js laws
```

#### 3. 판례만 임포트
```bash
node scripts/import_labor_data.js cases
```

#### 4. 전체 임포트 (법령 + 판례)
```bash
node scripts/import_labor_data.js all
```

---

## 🚀 사용 방법

### 서버 시작

```bash
npm start
# 또는
node server.js
```

서버가 시작되면:
- API: `http://localhost:3005/api/labor/*`
- 웹 UI: `http://localhost:3005/labor_ai.html`

### 웹 인터페이스 사용

1. 브라우저에서 `http://localhost:3005/labor_ai.html` 접속
2. 탭 선택:
   - **질의응답**: 일반 노무 질문
   - **판례 검색**: 유사 판례 찾기
   - **법령 조회**: 특정 조항 검색
   - **템플릿 상담**: 구조화된 상담
   - **카테고리**: 카테고리 목록 및 선택

### 프로그래밍 방식 사용

```javascript
const RAGAgent = require('./RAGAgent');

const agent = new RAGAgent(process.env.GEMINI_API_KEY, {
  storeName: 'labor-law-knowledge-base'
});

// 노무 질의
const answer = await agent.askLabor('해고 시 주의사항은?');
console.log(answer);

// 유사 판례 검색
const cases = await agent.findSimilarCases('출근 중 교통사고로 부상');
console.log(cases);

// 법령 조회
const law = await agent.searchLawArticle('근로기준법', '제23조');
console.log(law);

// 템플릿 상담
const consult = await agent.consultWithTemplate('dismissal', {
  employeeType: '정규직',
  workPeriod: '3년',
  dismissalReason: '업무태만'
});
console.log(consult);
```

---

## 📚 API 문서

### 노무 AI API 엔드포인트

#### 1. 질의응답
```http
POST /api/labor/ask
Content-Type: application/json

{
  "query": "직원을 해고하려면?",
  "category": "해고징계",          // 선택 (자동 감지)
  "includeCases": true,             // 선택 (기본: true)
  "includeInterpretations": true,   // 선택 (기본: true)
  "model": "gemini-2.5-flash"       // 선택
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "query": "직원을 해고하려면?",
    "answer": "💡 결론\n해고하려면 정당한 이유와 적법한 절차가 필요합니다...",
    "category": "해고징계",
    "timestamp": "2026-01-26T..."
  }
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
    "workPeriod": "3년",
    "dismissalReason": "업무태만",
    "procedure": "구두 통보"
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

---

## 🧪 테스트

### 테스트 실행

```bash
# 기본 테스트 (카테고리 감지, 메타데이터, 프롬프트 생성)
node tests/test_labor_ai.js

# 실제 질의응답 테스트 포함 (스토어 필요)
node tests/test_labor_ai.js --real-query
```

### 테스트 항목

1. **카테고리 자동 감지**: 질의 내용에서 카테고리 추출
2. **메타데이터 빌더**: 법령/판례 메타데이터 생성
3. **프롬프트 생성**: 노무 전문가 프롬프트 생성
4. **청킹 프리셋**: 문서 유형별 청킹 설정
5. **실제 질의응답** (선택): 스토어 기반 답변 생성

---

## 📖 주요 개념

### 데이터 스키마

#### 법령 메타데이터
- `lawName`: 법령명 (예: 근로기준법)
- `lawType`: 법령 유형 (act, decree, rule, notice, directive)
- `lawNumber`: 법령 번호 (예: 법률 제19488호)
- `category`: 카테고리 (근로계약, 임금, 해고징계 등)
- `keywords`: 검색 키워드 배열

#### 판례 메타데이터
- `caseNumber`: 사건번호 (예: 2023다12345)
- `courtType`: 법원 유형 (supreme, high, district)
- `subject`: 사건 주제 (예: 부당해고)
- `judgmentResult`: 판결 결과 (plaintiff_win, defendant_win, partial)
- `precedentValue`: 선례가치 (high, medium, low)

### 카테고리

10개 주요 카테고리:
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

### 청킹 설정

- **법령**: 512 토큰/청크, 64 토큰 오버랩
- **판례**: 1024 토큰/청크, 128 토큰 오버랩
- **행정해석**: 768 토큰/청크, 64 토큰 오버랩

---

## 🔒 보안 및 주의사항

### API 키 보호
- `.env` 파일을 `.gitignore`에 추가
- 공개 저장소에 API 키 노출 금지
- 프로덕션 환경에서는 Secret Manager 사용

### 법률 자문 한계
⚠️ **중요**: 이 시스템은 참고용 정보를 제공하며, 공식적인 법률 자문을 대체할 수 없습니다.
- 복잡한 사안은 전문 변호사 상담 권장
- 최신 법령 개정 사항 별도 확인 필요
- 개별 사안의 특수성 고려 필요

### 데이터 품질
- 정확한 메타데이터 입력 중요
- 최신 법령 및 판례로 주기적 업데이트
- 오래된 판례는 중요도 낮게 설정

---

## 🛠 문제 해결

### 서버 시작 오류
```bash
# GEMINI_API_KEY 확인
echo $GEMINI_API_KEY

# .env 파일 존재 확인
cat .env

# 포트 충돌 확인
lsof -i :3005
```

### 임포트 실패
```bash
# 파일 존재 확인
ls -la data/labor_laws/
ls -la data/labor_cases/

# Dry run으로 파일 확인
node scripts/import_labor_data.js all --dry-run
```

### 답변 품질 문제
- 더 많은 법령/판례 데이터 추가
- 메타데이터 정확도 향상
- 프롬프트 튜닝 (RAGAgent.js의 `buildLaborPrompt` 수정)

---

## 📞 문의 및 지원

- GitHub Issues: 버그 리포트 및 기능 제안
- 문서: README.md, WORKFLOW_GUIDE.md, CHUNKING_GUIDE.md

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

## 📈 향후 계획

- [ ] 행정해석 자동 수집 및 업데이트
- [ ] 판례 유사도 매칭 고도화
- [ ] 다중 언어 지원 (영어)
- [ ] 모바일 앱 개발
- [ ] 대화형 상담 (챗봇)
- [ ] 판례 시각화 및 트렌드 분석
