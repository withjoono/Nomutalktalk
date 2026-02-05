# ⚠️ API 키 갱신 필요

## 문제
현재 `.env` 파일의 `GEMINI_API_KEY`가 만료되었습니다.

## 해결 방법

### 1. 새 API 키 발급
1. Google AI Studio 접속: https://aistudio.google.com/app/apikey
2. "Create API Key" 버튼 클릭
3. 기존 키 삭제 및 새 키 생성
4. API 키 복사

### 2. .env 파일 수정
`.env` 파일을 열고 API 키를 새것으로 교체하세요:

```bash
GEMINI_API_KEY=새로_발급받은_api_key
LABOR_STORE_NAME=labor-law-knowledge-base
PORT=3005
```

### 3. 임포트 재실행
```bash
# 테스트 (dry run)
node scripts/import_labor_data.js laws --dry-run

# 실제 임포트
node scripts/import_labor_data.js laws
```

## 준비 상태

✅ **완료된 작업:**
- 데이터 폴더 생성
- 법령 파일 분할 (9개)
- 임포트 스크립트 준비
- 웹 UI 준비
- API 엔드포인트 준비

⏳ **대기 중:**
- API 키 갱신 (사용자 작업 필요)
- 법령 데이터 임포트
- 서버 실행 및 테스트

## 임포트 완료 후

API 키를 갱신하고 임포트가 완료되면:

```bash
# 서버 시작
npm start

# 웹 UI 접속
# http://localhost:3005/labor_ai.html

# 테스트
node tests/test_labor_ai.js
```

## 발견된 법령 (9개)

1. 개인정보 보호법
2. 건설근로자의 고용개선 등에 관한 법률
3. 경력단절여성등의 경제활동 촉진법
4. 경제사회노동위원회법
5. 고용노동부와 그 소속기관 직제
6. 고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률
7. 고용보험법
8. 고용상 연령차별금지 및 고령자고용촉진에 관한 법률
9. 고용정책 기본법

## 다음 단계

1. ✅ Google AI Studio에서 새 API 키 발급
2. ✅ .env 파일의 GEMINI_API_KEY 업데이트
3. ⏳ `node scripts/import_labor_data.js laws` 실행
4. ⏳ `npm start`로 서버 시작
5. ⏳ http://localhost:3005/labor_ai.html 접속하여 테스트
