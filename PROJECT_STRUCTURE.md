# 노무 AI - 프로젝트 구조

## 📂 최종 프로젝트 구조

```
Labor_Rag/
├── 📁 models/
│   └── laborSchemas.js              # 노동법령/판례 스키마 정의
│
├── 📁 scripts/
│   ├── import_labor_data.js         # 데이터 임포트 스크립트
│   └── split_labor_json.js          # 대용량 JSON 분할
│
├── 📁 tests/
│   └── test_labor_ai.js             # 자동 테스트
│
├── 📁 public/
│   ├── index.html                   # 메인 페이지 (리다이렉트)
│   ├── labor_ai.html                # 노무 AI 웹 UI
│   ├── labor_ai.js                  # 웹 UI JavaScript
│   └── styles.css                   # 스타일시트
│
├── 📁 data/
│   ├── labor_laws/                  # 법령 파일 (9개)
│   ├── labor_cases/                 # 판례 파일 (준비 중)
│   ├── metadata/                    # 메타데이터 (선택)
│   └── README.md                    # 데이터 가이드
│
├── 📄 RAGAgent.js                   # 노무 AI 핵심 로직
├── 📄 FileSearchManager.js          # Gemini API 래퍼
├── 📄 server.js                     # Express 서버
├── 📄 package.json                  # 의존성 관리
│
└── 📚 문서/
    ├── README.md                    # 프로젝트 README
    ├── LABOR_AI_GUIDE.md            # 전체 가이드
    ├── LABOR_DATA_IMPORT_GUIDE.md   # 데이터 임포트
    ├── QUICK_START_LABOR_AI.md      # 빠른 시작
    ├── PROJECT_SUMMARY.md           # 프로젝트 요약
    ├── API_KEY_RENEWAL_GUIDE.md     # API 키 갱신
    └── TEST_READY.md                # 테스트 준비
```

## ✅ 정리 완료

### 삭제된 파일/폴더
- ❌ `public/engines/` - 문제은행 시각화 엔진
- ❌ `public/plugins/` - 문제은행 플러그인
- ❌ `public/docs/` - 문제은행 문서
- ❌ `src/` - TypeScript 소스
- ❌ `dist/` - TypeScript 빌드
- ❌ `services/` - 기존 서비스
- ❌ `migrations/` - 마이그레이션
- ❌ `test_assets/` - 테스트 자산
- ❌ 문제은행 관련 HTML/JS 파일들
- ❌ 예제 파일들 (example-*.js)
- ❌ TypeScript 설정 파일들
- ❌ 기존 문서들

### 유지된 파일
- ✅ `RAGAgent.js` - 노무 메서드 추가됨
- ✅ `FileSearchManager.js` - Gemini API 기본 래퍼
- ✅ `server.js` - 노무 API 추가됨
- ✅ `public/styles.css` - 공통 스타일
- ✅ `firebase-service-account.json` - Firebase 설정

## 🎯 노무 AI 전용 시스템

### 핵심 파일 (5개)
1. `RAGAgent.js` - 노무 AI 메서드
2. `models/laborSchemas.js` - 데이터 스키마
3. `server.js` - API 서버
4. `public/labor_ai.html` - 웹 UI
5. `scripts/import_labor_data.js` - 데이터 임포트

### 지원 파일
- `FileSearchManager.js` - API 래퍼
- `public/labor_ai.js` - UI 로직
- `tests/test_labor_ai.js` - 테스트
- `scripts/split_labor_json.js` - JSON 분할

### 문서 (7개)
1. `README.md` - 프로젝트 소개
2. `LABOR_AI_GUIDE.md` - 전체 가이드
3. `QUICK_START_LABOR_AI.md` - 빠른 시작
4. `LABOR_DATA_IMPORT_GUIDE.md` - 데이터 준비
5. `PROJECT_SUMMARY.md` - 시스템 요약
6. `API_KEY_RENEWAL_GUIDE.md` - API 키
7. `TEST_READY.md` - 테스트 가이드

## 📊 파일 통계

### 코드
- JavaScript: 6개 파일
- HTML: 2개 파일
- CSS: 1개 파일

### 데이터
- 법령: 9개 파일 (준비됨)
- 판례: 0개 (수집 중)

### 문서
- 마크다운: 7개 파일

### 총계
- 핵심 코드: 9개 파일
- 문서: 7개 파일
- 데이터: 9개 법령

## 🚀 실행 방법

```bash
# 1. 환경 설정
# .env 파일에 API 키 설정

# 2. 데이터 임포트
node scripts/import_labor_data.js laws

# 3. 서버 시작
npm start

# 4. 접속
# http://localhost:3005
```

## 📝 다음 단계

1. ✅ API 키 갱신
2. ⏳ 법령 데이터 임포트
3. ⏳ 판례 데이터 수집 및 임포트
4. ⏳ 테스트 및 최적화

---

**상태**: ✅ 노무 AI 전용 시스템으로 정리 완료
**마지막 업데이트**: 2026-01-26
