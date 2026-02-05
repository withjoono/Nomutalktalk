# 이 파일은 data 폴더를 Git에 포함시키기 위한 플레이스홀더입니다.
# 실제 데이터 파일은 .gitignore에 추가하세요.

## 디렉토리 구조

```
data/
├── labor_laws/          # 노동 법령 파일 (PDF, TXT, DOCX)
├── labor_cases/         # 노동 판례 파일 (PDF, TXT, DOCX)
└── metadata/
    ├── laws/           # 법령 메타데이터 JSON 파일 (선택)
    └── cases/          # 판례 메타데이터 JSON 파일 (선택)
```

## 사용 방법

### 1. 법령 파일 배치
크롤링한 법령 파일들을 `data/labor_laws/` 폴더에 넣어주세요.

**파일명 예시:**
- `근로기준법_법률_제19488호_2023-12-26.pdf`
- `산업안전보건법_법률_제19490호_2023-12-27.pdf`

### 2. 판례 파일 배치
크롤링한 판례 파일들을 `data/labor_cases/` 폴더에 넣어주세요.

**파일명 예시:**
- `대법원_2023다12345_2023-12-26_부당해고.pdf`
- `서울고등법원_2023나45678_2023-11-15_임금체불.pdf`

### 3. 메타데이터 (선택사항)
더 정확한 메타데이터를 위해 JSON 파일을 생성할 수 있습니다.
- 법령 메타데이터: `data/metadata/laws/`
- 판례 메타데이터: `data/metadata/cases/`

### 4. 임포트 실행
```bash
# 파일 확인
node scripts/import_labor_data.js all --dry-run

# 실제 임포트
node scripts/import_labor_data.js all
```

## 지원 파일 형식
- PDF (.pdf)
- 텍스트 (.txt)
- Word (.docx)
- HTML (.html)

## 주의사항
- 파일명은 가능한 규칙에 맞게 작성하세요
- 대용량 파일은 50MB 이하로 분할하세요
- 파일 인코딩은 UTF-8을 권장합니다
