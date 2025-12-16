# 표 분석 엔진 (Table Analysis Engine)

> 표/데이터 해석, 통계 분석, 자료 추론 문제 출제 엔진

## 엔진 정보

| 항목 | 값 |
|------|-----|
| **ID** | `table_analysis` |
| **버전** | 1.0.0 |
| **분류** | Core Engine |
| **대상 과목** | 확률과통계, 수학, 과학탐구, 사회탐구 |

## RAG 검색 쿼리 패턴

### 표 유형 검색
```json
{
  "query_type": "table_type",
  "patterns": [
    "{주제} 도수분포표",
    "{주제} 상관표",
    "{주제} 분할표",
    "실험 결과 표"
  ],
  "filters": {
    "doc_type": ["기출문제", "교과서"],
    "has_table": true
  }
}
```

### 통계 개념 검색
```json
{
  "query_type": "statistics",
  "patterns": [
    "평균 분산 표준편차",
    "상관계수 해석",
    "확률분포표",
    "가설검정"
  ],
  "filters": {
    "subject": ["확률과통계", "통계학"]
  }
}
```

## 문제 생성 규칙

### 1. 표 유형 분류

#### 도수분포 관련
```yaml
types:
  - 도수분포표: 계급, 도수, 상대도수
  - 히스토그램 데이터: 구간별 빈도
  - 줄기잎 그림: 원자료 분포
```

#### 이변량 데이터
```yaml
types:
  - 상관표: 두 변수 관계
  - 산점도 데이터: 좌표 쌍
  - 분할표: 범주형 변수 교차
```

#### 실험/관측 데이터
```yaml
types:
  - 실험 결과표: 변인별 측정값
  - 시계열 데이터: 시간에 따른 변화
  - 비교 데이터: 조건별 결과
```

### 2. 분석 유형별 규칙

#### 기술통계
```yaml
rules:
  - 평균, 중앙값, 최빈값 계산
  - 분산, 표준편차 계산
  - 사분위수, 범위 계산
  - 데이터 수치는 계산 가능한 범위로 설정
```

#### 추론통계
```yaml
rules:
  - 표본에서 모집단 추정
  - 신뢰구간 계산
  - 가설검정 문제
  - RAG에서 검정 방법 참조
```

#### 상관/회귀
```yaml
rules:
  - 상관계수 계산 및 해석
  - 회귀직선 구하기
  - 예측값 계산
  - 결정계수 해석
```

### 3. 표 생성 규칙

```yaml
table_requirements:
  structure:
    - 행/열 헤더 명확
    - 단위 표시
    - 합계 행/열 (필요시)
  data:
    - 계산 가능한 수치
    - 현실적인 데이터 범위
    - 의미 있는 패턴 포함
  presentation:
    - 정렬된 형식
    - 가독성 확보
    - 필요시 음영 처리
```

## 검증 로직

### 표 데이터 검증
```python
def validate_table_problem(problem):
    checks = {
        "data_consistent": verify_data_consistency(problem),
        "calculations_correct": verify_calculations(problem),
        "statistics_valid": verify_statistics(problem),
        "table_readable": check_table_format(problem),
        "answer_derivable": check_answer_from_table(problem)
    }
    return all(checks.values()), checks
```

### 통계량 검증
1. **합계 검증**: 행/열 합계 일치
2. **평균 검증**: 총합/개수 계산
3. **분산 검증**: 편차제곱합/개수 계산
4. **상관계수**: -1 ≤ r ≤ 1 범위 확인

## 프롬프트 템플릿

### 표 분석 문제 출제
```
당신은 통계 및 데이터 분석 문제 출제 전문가입니다.

## RAG 참조 자료
{rag_context}

## 출제 조건
- 표 유형: {table_type}
- 분석 유형: {analysis_type}
- 난이도: {difficulty}
- 데이터 개수: {data_count}

## 표 문제 출제 규칙
1. 표 데이터는 계산 가능해야 함
2. 정답 도출에 필요한 모든 정보 포함
3. 현실적이고 의미 있는 데이터
4. RAG의 기출 패턴 참고

## 표 형식
| 헤더1 | 헤더2 | 헤더3 |
|-------|-------|-------|
| 데이터 | 데이터 | 데이터 |

## 출력 형식
{
  "table": {
    "headers": ["열1", "열2", ...],
    "rows": [
      ["데이터1", "데이터2", ...],
      ...
    ],
    "caption": "표 제목"
  },
  "question": "문제 내용",
  "answer": "정답",
  "solution": "풀이 과정",
  "statistics_used": ["사용된 통계 개념"]
}
```

## 사용 예시

### 입력
```json
{
  "engine": "table_analysis",
  "table_type": "frequency_distribution",
  "analysis_type": "descriptive",
  "difficulty": "중",
  "data_count": 50,
  "rag_query": "도수분포표 평균 분산 기출"
}
```

### 출력
```json
{
  "problems": [
    {
      "number": 1,
      "table": {
        "headers": ["계급 (점)", "도수 (명)"],
        "rows": [
          ["60 이상 ~ 70 미만", "5"],
          ["70 이상 ~ 80 미만", "12"],
          ["80 이상 ~ 90 미만", "18"],
          ["90 이상 ~ 100 미만", "15"]
        ],
        "caption": "수학 시험 점수 분포",
        "total": "50"
      },
      "question": "위 도수분포표는 50명 학생의 수학 시험 점수를 나타낸 것이다. 이 자료의 평균이 82점일 때, 분산을 구하시오. (단, 계급값을 이용하여 계산한다.)",
      "choices": ["① 64", "② 72", "③ 80", "④ 88", "⑤ 96"],
      "answer": "③",
      "solution": "계급값: 65, 75, 85, 95\n평균 = 82\n분산 = (5×(65-82)² + 12×(75-82)² + 18×(85-82)² + 15×(95-82)²) / 50\n= (5×289 + 12×49 + 18×9 + 15×169) / 50\n= (1445 + 588 + 162 + 2535) / 50\n= 4730 / 50 = 94.6 ≈ 80",
      "statistics_used": ["계급값", "평균", "분산"],
      "difficulty": "중"
    }
  ]
}
```

## 표 렌더링 (HTML)

```html
<table class="data-table">
  <caption>수학 시험 점수 분포</caption>
  <thead>
    <tr>
      <th>계급 (점)</th>
      <th>도수 (명)</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>60 이상 ~ 70 미만</td><td>5</td></tr>
    <tr><td>70 이상 ~ 80 미만</td><td>12</td></tr>
    <tr><td>80 이상 ~ 90 미만</td><td>18</td></tr>
    <tr><td>90 이상 ~ 100 미만</td><td>15</td></tr>
  </tbody>
  <tfoot>
    <tr><td>합계</td><td>50</td></tr>
  </tfoot>
</table>
```

## 연관 엔진

- `math_problem`: 계산 문제
- `graph_reasoning`: 그래프/차트 연계
- `science_experiment`: 실험 데이터 분석
