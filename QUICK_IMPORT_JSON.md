# 🚀 JSON 판례 데이터 빠른 임포트 가이드

## 📋 준비 사항

1. ✅ JSON 파일 위치 확인
   - 파일: `data/labor_cases/final_elabor_case_전체사례_20260127_081741.json`

2. ✅ API 키 설정 확인
   ```bash
   # .env 파일에서 확인
   GEMINI_API_KEY=your_api_key
   ```

## ⚡ 3단계 임포트

### 1단계: 데이터 확인 (Dry Run)

```bash
node scripts/import_labor_cases_json.js --dry-run
```

**예상 출력:**
```
📂 총 150개의 판례/행정해석 발견

📊 데이터 분포:
   판례: 145개
   행정해석: 5개
   대법판례: 80개
   고법판례: 40개
   지법판례: 25개
```

### 2단계: 테스트 임포트 (10개)

```bash
node scripts/import_labor_cases_json.js --limit=10
```

**예상 소요 시간:** 약 30초

### 3단계: 전체 임포트

```bash
node scripts/import_labor_cases_json.js
```

**예상 소요 시간:** 
- 100개: 약 5분
- 500개: 약 25분
- 1000개: 약 50분

## 📊 진행 상황 확인

임포트 중에는 실시간으로 진행 상황이 표시됩니다:

```
📤 배치 1/15 처리 중... (1-10/150)
   ✅ 10/10개 성공
📤 배치 2/15 처리 중... (11-20/150)
   ✅ 10/10개 성공
```

## ✅ 성공 확인

임포트가 완료되면 다음과 같은 메시지를 확인할 수 있습니다:

```
📊 임포트 결과 요약
✅ 성공: 148개
❌ 실패: 2개
📈 성공률: 98.7%

🎉 모든 데이터가 성공적으로 임포트되었습니다!
```

## 🧪 테스트 방법

### 1. 웹 UI에서 테스트

```bash
node server.js
```

브라우저에서 `http://localhost:3000/labor_ai.html` 접속

### 2. 테스트 질의 예시

- "부당해고 판단 기준은?"
- "최저임금 위반 시 처벌은?"
- "연차휴가 사용 거부당하면?"
- "산재 인정 기준은?"

## ⚠️ 문제 해결

### API 키 오류
```bash
# .env 파일 확인
cat .env

# 또는
type .env
```

### 메모리 부족
```bash
set NODE_OPTIONS=--max-old-space-size=4096
node scripts/import_labor_cases_json.js --batch=5
```

### 진행 느림
```bash
# 배치 크기 줄이기
node scripts/import_labor_cases_json.js --batch=5
```

## 🔄 추가 임포트

새로운 판례가 생기면:

```bash
# 새 JSON 파일로 임포트
node scripts/import_labor_cases_json.js data/labor_cases/new_cases.json
```

## 📞 도움말

더 자세한 정보는:
- 전체 가이드: `JSON_CASES_IMPORT_GUIDE.md`
- 스크립트 옵션: `node scripts/import_labor_cases_json.js --help`

---

**빠른 시작 체크리스트:**

- [ ] JSON 파일 확인됨
- [ ] API 키 설정됨
- [ ] Dry run 테스트 완료
- [ ] 소량 테스트 (10개) 성공
- [ ] 전체 임포트 진행
- [ ] 웹 UI 테스트 완료

**Happy importing! 🎉**
