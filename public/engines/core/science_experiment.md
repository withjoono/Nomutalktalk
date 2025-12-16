# 과학 실험 엔진 (Science Experiment Engine)

> 과학 실험 설계, 결과 해석, 탐구 문제 출제 엔진

## 엔진 정보

| 항목 | 값 |
|------|-----|
| **ID** | `science_experiment` |
| **버전** | 1.0.0 |
| **분류** | Core Engine |
| **대상 과목** | 물리학, 화학, 생명과학, 지구과학 |

## RAG 검색 쿼리 패턴

### 실험 방법 검색
```json
{
  "query_type": "experiment_method",
  "patterns": [
    "{실험명} 실험 방법",
    "{주제} 탐구 설계",
    "{현상} 실험 장치",
    "{개념} 측정 방법"
  ],
  "filters": {
    "doc_type": ["교과서", "실험서", "기출문제"],
    "subject": ["물리학", "화학", "생명과학", "지구과학"]
  }
}
```

### 변인 통제 검색
```json
{
  "query_type": "variable_control",
  "patterns": [
    "독립변인 종속변인",
    "통제변인 설정",
    "대조군 실험군"
  ],
  "filters": {
    "content_type": "experiment_design"
  }
}
```

## 문제 생성 규칙

### 1. 과목별 실험 유형

#### 물리학
```yaml
experiments:
  역학:
    - 등속/등가속도 운동 측정
    - 충돌과 운동량 보존
    - 단진자 주기 측정
  전자기:
    - 옴의 법칙 확인
    - 전자기 유도 실험
    - 전기장/자기장 측정
  파동:
    - 정상파 관찰
    - 굴절/반사 실험
    - 간섭/회절 실험
```

#### 화학
```yaml
experiments:
  반응:
    - 반응 속도 측정
    - 평형 이동 실험
    - 산염기 적정
  물질:
    - 분자량 측정
    - 용해도 실험
    - 크로마토그래피
  전기화학:
    - 전기분해
    - 전지 실험
```

#### 생명과학
```yaml
experiments:
  세포:
    - 현미경 관찰
    - 삼투압 실험
    - 효소 활성 측정
  유전:
    - DNA 추출
    - 전기영동
    - PCR
  생태:
    - 군집 조사
    - 환경 요인 측정
```

#### 지구과학
```yaml
experiments:
  지질:
    - 암석/광물 분류
    - 지층 분석
  대기:
    - 기상 관측
    - 기압 측정
  천문:
    - 별의 밝기 측정
    - 적경/적위 관측
```

### 2. 탐구 과정 규칙

```yaml
inquiry_process:
  문제_인식:
    - 탐구 문제 명확화
    - 가설 설정
  탐구_설계:
    - 변인 설정 (독립, 종속, 통제)
    - 실험군/대조군 설정
    - 측정 방법 결정
  수행:
    - 실험 절차 기술
    - 안전 수칙 준수
  결과_분석:
    - 데이터 정리 (표, 그래프)
    - 경향성 파악
  결론_도출:
    - 가설 검증
    - 오차 분석
    - 추가 탐구 제안
```

### 3. 변인 통제 규칙

```yaml
variable_rules:
  독립변인:
    - 실험자가 의도적으로 변화시키는 변인
    - 하나의 실험에서 하나만 변화
  종속변인:
    - 독립변인에 따라 변하는 결과
    - 측정 가능해야 함
  통제변인:
    - 일정하게 유지해야 할 조건
    - 모든 통제변인 명시
```

## 검증 로직

### 실험 설계 검증
```python
def validate_experiment_problem(problem):
    checks = {
        "variables_clear": check_variable_identification(problem),
        "control_adequate": verify_control_variables(problem),
        "method_feasible": check_experimental_feasibility(problem),
        "data_interpretable": verify_data_analysis(problem),
        "conclusion_valid": check_conclusion_logic(problem),
        "safety_considered": check_safety_aspects(problem)
    }
    return all(checks.values()), checks
```

### 과학적 타당성 검증
1. **변인 통제**: 독립/종속/통제 변인 명확성
2. **반복 실험**: 신뢰성 확보 방안
3. **대조군**: 비교 기준 적절성
4. **오차 분석**: 오차 원인 및 최소화 방안

## 프롬프트 템플릿

### 실험 문제 출제
```
당신은 과학 탐구 문제 출제 전문가입니다.

## RAG 참조 자료
{rag_context}

## 출제 조건
- 과목: {subject}
- 실험 주제: {topic}
- 문제 유형: {question_type}  // design | interpretation | analysis
- 난이도: {difficulty}

## 과학 실험 문제 출제 규칙
1. 변인 통제가 명확해야 함
2. 실제 수행 가능한 실험이어야 함
3. 결과 해석이 논리적이어야 함
4. RAG의 실험 패턴 참고

## 실험 설명 형식
{
  "title": "실험 제목",
  "purpose": "실험 목적",
  "hypothesis": "가설",
  "variables": {
    "independent": "독립변인",
    "dependent": "종속변인",
    "controlled": ["통제변인1", "통제변인2"]
  },
  "materials": ["재료/장치"],
  "procedure": ["절차1", "절차2"],
  "data": { "표 또는 그래프 데이터" },
  "expected_result": "예상 결과"
}
```

## 사용 예시

### 입력
```json
{
  "engine": "science_experiment",
  "subject": "생명과학",
  "topic": "효소 활성",
  "question_type": "interpretation",
  "difficulty": "중",
  "rag_query": "카탈레이스 효소 실험 기출"
}
```

### 출력
```json
{
  "problems": [
    {
      "number": 1,
      "experiment": {
        "title": "카탈레이스의 활성에 영향을 미치는 요인",
        "purpose": "온도가 카탈레이스의 활성에 미치는 영향을 알아본다",
        "variables": {
          "independent": "온도",
          "dependent": "산소 기체 발생량",
          "controlled": ["과산화수소 농도", "간 조각의 양", "반응 시간"]
        }
      },
      "figure": {
        "type": "line_graph",
        "x_axis": "온도 (°C)",
        "y_axis": "산소 발생량 (mL)",
        "data_points": [
          {"x": 0, "y": 2},
          {"x": 20, "y": 8},
          {"x": 37, "y": 15},
          {"x": 50, "y": 10},
          {"x": 70, "y": 1}
        ]
      },
      "question": "그림은 온도에 따른 카탈레이스의 활성을 나타낸 것이다. 이에 대한 설명으로 옳은 것만을 <보기>에서 있는 대로 고른 것은?",
      "choices_box": [
        "ㄱ. 이 효소의 최적 온도는 약 37°C이다.",
        "ㄴ. 70°C에서 효소 활성이 낮은 것은 효소가 변성되었기 때문이다.",
        "ㄷ. 0°C에서 20°C로 온도가 올라갈 때 효소-기질 복합체 형성 빈도가 증가한다."
      ],
      "choices": ["① ㄱ", "② ㄴ", "③ ㄱ, ㄴ", "④ ㄱ, ㄷ", "⑤ ㄱ, ㄴ, ㄷ"],
      "answer": "⑤",
      "solution": "ㄱ. (○) 그래프에서 37°C에서 산소 발생량이 최대이므로 최적 온도는 약 37°C이다.\nㄴ. (○) 높은 온도에서 단백질인 효소가 변성되어 활성이 감소한다.\nㄷ. (○) 온도 상승 시 분자 운동이 활발해져 효소와 기질의 충돌 빈도가 증가한다.",
      "concepts": ["효소 활성", "최적 온도", "단백질 변성"],
      "difficulty": "중"
    }
  ]
}
```

## 시각화 코드 (Plotly)

```javascript
// 효소 활성 그래프
const trace = {
  x: [0, 20, 37, 50, 70],
  y: [2, 8, 15, 10, 1],
  mode: 'lines+markers',
  name: '산소 발생량',
  line: { color: 'blue', width: 2 },
  marker: { size: 8 }
};

const layout = {
  title: '온도에 따른 카탈레이스 활성',
  xaxis: { title: '온도 (°C)' },
  yaxis: { title: '산소 발생량 (mL)' }
};

Plotly.newPlot('graph', [trace], layout);
```

## 연관 엔진

- `table_analysis`: 실험 데이터 분석
- `graph_reasoning`: 그래프 해석
- `proof_logic`: 과학적 추론
