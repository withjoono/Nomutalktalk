# 노무 AI 데이터 임포트 가이드

## 데이터 준비

### 1. 디렉토리 구조 생성

```bash
mkdir -p data/labor_laws
mkdir -p data/labor_cases
mkdir -p data/labor_interpretations
mkdir -p data/metadata/laws
mkdir -p data/metadata/cases
mkdir -p data/metadata/interpretations
```

### 2. 법령 파일 배치

`data/labor_laws/` 폴더에 법령 파일을 배치하세요.

#### 파일명 규칙 (권장)
```
법령명_법령유형_법령번호_제정일.pdf
```

예시:
```
근로기준법_법률_제19488호_2023-12-26.pdf
산업안전보건법_법률_제19490호_2023-12-27.pdf
근로기준법시행령_시행령_제34987호_2024-01-01.pdf
```

#### 지원 파일 형식
- PDF (.pdf)
- 텍스트 (.txt)
- Word (.docx)
- HTML (.html)

### 3. 판례 파일 배치

`data/labor_cases/` 폴더에 판례 파일을 배치하세요.

#### 파일명 규칙 (권장)
```
법원명_사건번호_선고일_주제.pdf
```

예시:
```
대법원_2023다12345_2023-12-26_부당해고.pdf
서울고등법원_2023나45678_2023-11-15_임금체불.pdf
서울중앙지방법원_2023가합98765_2023-10-20_산재인정.pdf
```

### 4. 메타데이터 JSON (선택사항)

더 정확한 메타데이터를 위해 JSON 파일을 생성할 수 있습니다.

#### 법령 메타데이터 예시
`data/metadata/laws/근로기준법_법률_제19488호_2023-12-26.json`:
```json
{
  "lawName": "근로기준법",
  "lawType": "act",
  "lawNumber": "법률 제19488호",
  "enactmentDate": "2023-12-26",
  "enforcementDate": "2024-12-27",
  "ministry": "고용노동부",
  "category": "근로계약",
  "keywords": ["근로시간", "임금", "해고", "퇴직금"],
  "importance": 5,
  "frequentlyUsed": true
}
```

#### 판례 메타데이터 예시
`data/metadata/cases/대법원_2023다12345_2023-12-26_부당해고.json`:
```json
{
  "courtName": "대법원",
  "courtType": "supreme",
  "caseNumber": "2023다12345",
  "judgmentDate": "2023-12-26",
  "caseType": "civil",
  "subject": "부당해고",
  "plaintiffType": "employee",
  "defendantType": "employer",
  "judgmentResult": "plaintiff_win",
  "precedentValue": "high",
  "keywords": ["정당한 이유", "해고예고", "근로기준법 제23조"],
  "relatedLaws": ["근로기준법 제23조", "근로기준법 제26조"],
  "category": "해고징계",
  "importance": 5,
  "isLandmark": true,
  "judgmentSummary": "정당한 이유 없는 해고는 무효이며, 해고예고 절차를 거치지 않은 경우 30일분의 통상임금을 지급해야 함"
}
```

## 데이터 임포트 실행

### 1. 환경 변수 설정

`.env` 파일 확인:
```bash
GEMINI_API_KEY=your_api_key
LABOR_STORE_NAME=labor-law-knowledge-base
```

### 2. Dry Run (테스트)

실제 업로드 없이 파일 목록만 확인:
```bash
node scripts/import_labor_data.js all --dry-run
```

### 3. 법령 임포트

```bash
node scripts/import_labor_data.js laws
```

### 4. 판례 임포트

```bash
node scripts/import_labor_data.js cases
```

### 5. 전체 임포트

```bash
node scripts/import_labor_data.js all
```

## 임포트 스크립트 옵션

### 명령어
- `all`: 법령과 판례 모두 임포트 (기본)
- `laws`: 법령만 임포트
- `cases`: 판례만 임포트
- `help`: 도움말 표시

### 옵션
- `--dry-run` 또는 `-d`: 실제 업로드 없이 파일 목록만 확인

### 환경 변수
- `GEMINI_API_KEY`: Google Gemini API 키 (필수)
- `LABOR_STORE_NAME`: RAG 스토어 이름 (기본: labor-law-knowledge-base)

## 메타데이터 자동 파싱

JSON 메타데이터가 없는 경우, 파일명에서 자동으로 메타데이터를 추출합니다.

### 법령 파일명 파싱
```
근로기준법_법률_제19488호_2023-12-26.pdf
↓
{
  lawName: "근로기준법",
  lawType: "act",
  lawNumber: "제19488호",
  enactmentDate: "2023-12-26",
  ministry: "고용노동부",
  category: "근로계약" (키워드 기반 자동 감지)
}
```

### 판례 파일명 파싱
```
대법원_2023다12345_2023-12-26_부당해고.pdf
↓
{
  courtName: "대법원",
  courtType: "supreme",
  caseNumber: "2023다12345",
  judgmentDate: "2023-12-26",
  subject: "부당해고",
  category: "해고징계" (키워드 기반 자동 감지)
}
```

## 임포트 결과 확인

### 성공 메시지
```
═══════════════════════════════════════════════════════════
                    전체 임포트 완료
═══════════════════════════════════════════════════════════

📜 법령: 15개 성공
⚖️  판례: 120개 성공

✅ 모든 데이터 임포트가 성공적으로 완료되었습니다!
```

### 실패 시
```
실패 목록:
  - 근로기준법.pdf: 파일을 찾을 수 없습니다
  - 판례123.pdf: 메타데이터 오류
```

## 데이터 품질 체크리스트

### 법령 파일
- [ ] PDF/TXT 형식으로 저장됨
- [ ] 파일명이 규칙에 맞음
- [ ] 법령 전문이 포함됨
- [ ] 조문이 명확히 구분됨
- [ ] 최신 개정판임

### 판례 파일
- [ ] PDF/TXT 형식으로 저장됨
- [ ] 파일명이 규칙에 맞음
- [ ] 사건번호가 정확함
- [ ] 판시사항이 포함됨
- [ ] 판결 요지가 명확함

### 메타데이터 (JSON)
- [ ] 필수 필드 모두 포함
- [ ] 날짜 형식: YYYY-MM-DD
- [ ] 카테고리가 정확함
- [ ] 키워드가 적절함
- [ ] 중요도 설정 (1-5)

## 주기적 업데이트

### 신규 법령 추가
1. 새 법령 파일을 `data/labor_laws/`에 추가
2. `node scripts/import_labor_data.js laws` 실행

### 신규 판례 추가
1. 새 판례 파일을 `data/labor_cases/`에 추가
2. `node scripts/import_labor_data.js cases` 실행

### 기존 데이터 업데이트
1. 기존 파일 수정
2. 해당 파일만 재임포트 (스토어 전체 재구축 필요 시 기존 스토어 삭제 후 재임포트)

## 문제 해결

### 임포트 실패
```bash
# 파일 존재 확인
ls -la data/labor_laws/

# 권한 확인
chmod 644 data/labor_laws/*.pdf

# API 키 확인
echo $GEMINI_API_KEY
```

### 메타데이터 오류
- JSON 파일 문법 확인 (JSON 유효성 검사)
- 필수 필드 누락 여부 확인
- 데이터 타입 확인 (문자열 vs 숫자)

### 업로드 속도 향상
- 파일 크기 최적화 (PDF 압축)
- 네트워크 안정성 확인
- 일괄 업로드 대신 개별 업로드

## 권장 데이터 구성

### 필수 법령 (최소 세트)
1. 근로기준법
2. 최저임금법
3. 근로자퇴직급여보장법
4. 산업안전보건법
5. 산업재해보상보험법
6. 고용보험법
7. 남녀고용평등법
8. 기간제 및 단시간근로자 보호 등에 관한 법률
9. 파견근로자 보호 등에 관한 법률
10. 노동조합 및 노동관계조정법

### 권장 판례 (최소 100개 이상)
- 대법원 판례: 60% (중요 판례 위주)
- 고등법원 판례: 30%
- 지방법원 판례: 10% (주요 사건만)

### 카테고리별 분포 (권장)
- 해고징계: 25%
- 임금: 20%
- 근로시간: 15%
- 근로계약: 10%
- 휴가휴직: 10%
- 산재보험: 10%
- 기타: 10%
