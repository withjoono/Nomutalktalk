# 노무 AI 프로젝트 빠른 시작 가이드

## 1단계: 환경 설정 (5분)

### 1.1 API 키 발급
1. Google AI Studio 접속: https://aistudio.google.com/app/apikey
2. "Create API Key" 클릭
3. API 키 복사

### 1.2 환경 변수 설정
```bash
# .env 파일 생성
cat > .env << EOF
GEMINI_API_KEY=your_copied_api_key
LABOR_STORE_NAME=labor-law-knowledge-base
PORT=3005
EOF
```

### 1.3 의존성 설치
```bash
npm install
```

## 2단계: 데이터 준비 (10분)

### 2.1 데이터 디렉토리 생성
```bash
mkdir -p data/labor_laws data/labor_cases
```

### 2.2 크롤링된 데이터 배치
```bash
# 법령 파일을 data/labor_laws/로 이동
# 판례 파일을 data/labor_cases/로 이동

# 파일 개수 확인
ls -1 data/labor_laws/ | wc -l
ls -1 data/labor_cases/ | wc -l
```

## 3단계: 데이터 임포트 (시간 가변적)

### 3.1 Dry Run (파일 확인)
```bash
node scripts/import_labor_data.js all --dry-run
```

### 3.2 실제 임포트
```bash
node scripts/import_labor_data.js all
```

**예상 시간**: 
- 법령 10개: ~5분
- 판례 100개: ~30분

## 4단계: 서버 시작 (1분)

```bash
npm start
```

접속:
- 웹 UI: http://localhost:3005/labor_ai.html
- Health Check: http://localhost:3005/api/labor/health

## 5단계: 테스트 (5분)

### 5.1 웹 UI 테스트
1. http://localhost:3005/labor_ai.html 접속
2. 질의응답 탭에서 질문 입력
   - 예: "직원을 해고하려면 어떤 절차를 거쳐야 하나요?"
3. "질문하기" 버튼 클릭
4. 답변 확인

### 5.2 자동 테스트
```bash
node tests/test_labor_ai.js
```

## 문제 해결

### API 키 오류
```bash
# API 키 확인
cat .env | grep GEMINI_API_KEY
```

### 임포트 실패
```bash
# 파일 존재 확인
ls -la data/labor_laws/
ls -la data/labor_cases/

# 다시 시도
node scripts/import_labor_data.js all
```

### 서버 시작 실패
```bash
# 포트 확인
lsof -i :3005

# 다른 포트 사용
PORT=3006 npm start
```

## 다음 단계

- [ ] 웹 UI에서 다양한 질의 테스트
- [ ] 판례 검색 기능 테스트
- [ ] 법령 조회 기능 테스트
- [ ] 템플릿 상담 기능 테스트
- [ ] 프로덕션 배포 준비 (DEPLOYMENT_GUIDE.md 참조)

## 완료!

이제 노무 AI 시스템을 사용할 준비가 되었습니다! 🎉

자세한 사용법은 `LABOR_AI_GUIDE.md`를 참조하세요.
