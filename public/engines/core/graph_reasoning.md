# 그래프 추론 엔진 (Graph Reasoning Engine)

> 함수 그래프 해석, 도형 추론, 좌표기하 문제 출제 엔진

## 엔진 정보

| 항목 | 값 |
|------|-----|
| **ID** | `graph_reasoning` |
| **버전** | 1.0.0 |
| **분류** | Core Engine |
| **대상 과목** | 수학, 수학I, 수학II, 미적분, 기하 |

## RAG 검색 쿼리 패턴

### 그래프 유형 검색
```json
{
  "query_type": "graph_type",
  "patterns": [
    "{함수명} 그래프 특징",
    "{함수명} 그래프 개형",
    "{함수명} 점근선",
    "{함수명} 대칭성"
  ],
  "filters": {
    "doc_type": ["교과서", "기출문제"],
    "has_figure": true
  }
}
```

### 그래프 해석 패턴 검색
```json
{
  "query_type": "interpretation",
  "patterns": [
    "그래프에서 {특성} 찾기",
    "그래프 해석 문제 유형",
    "두 그래프의 관계"
  ],
  "filters": {
    "problem_type": ["그래프 해석", "함수 추론"]
  }
}
```

## 문제 생성 규칙

### 1. 그래프 유형 분류

#### 함수 그래프
```yaml
types:
  - 다항함수: 이차함수, 삼차함수, 사차함수
  - 유리함수: 분수함수, 점근선 있는 함수
  - 무리함수: 루트 함수
  - 지수/로그함수: 지수함수, 로그함수
  - 삼각함수: sin, cos, tan 및 변환
```

#### 도형/좌표
```yaml
types:
  - 직선: 기울기, 절편, 평행/수직
  - 원: 중심, 반지름, 접선
  - 이차곡선: 포물선, 타원, 쌍곡선
  - 벡터: 위치벡터, 내적, 외적
```

### 2. 추론 유형별 규칙

#### 그래프 → 식 추론
```yaml
rules:
  - 주어진 그래프에서 함수식 유도
  - 특징점(극값, 영점, 점근선) 활용
  - 대칭성, 주기성 파악
  - RAG 참조: 유사 그래프 패턴
```

#### 식 → 그래프 추론
```yaml
rules:
  - 함수식에서 그래프 개형 파악
  - 평행이동, 대칭이동 적용
  - 주요 점 좌표 계산
  - RAG 참조: 변환 규칙
```

#### 두 그래프 관계
```yaml
rules:
  - 교점 개수 및 좌표
  - 위치 관계 (위/아래)
  - 넓이 계산
  - RAG 참조: 교점 문제 유형
```

### 3. 시각 자료 생성 규칙

```yaml
figure_requirements:
  - 축: x축, y축 명확히 표시
  - 눈금: 주요 값에 눈금 표시
  - 특징점: 극값, 영점, 점근선 표시
  - 범례: 여러 그래프 시 구분 표시
  - 음영: 넓이 문제 시 영역 표시
```

## 검증 로직

### 그래프 정합성 검증
```python
def validate_graph_problem(problem):
    checks = {
        "graph_matches_equation": verify_graph_equation(problem),
        "special_points_correct": verify_special_points(problem),
        "asymptotes_correct": verify_asymptotes(problem),
        "domain_range_valid": verify_domain_range(problem),
        "visual_clarity": check_visual_clarity(problem)
    }
    return all(checks.values()), checks
```

### 추론 검증
1. **그래프 특징**: 극값, 변곡점 위치 정확성
2. **교점 계산**: 연립방정식 해와 일치
3. **넓이 계산**: 적분 결과와 일치

## 프롬프트 템플릿

### 그래프 해석 문제 출제
```
당신은 수학 그래프 문제 출제 전문가입니다.

## RAG 참조 자료
{rag_context}

## 출제 조건
- 그래프 유형: {graph_type}
- 추론 방향: {reasoning_direction}  // graph_to_equation | equation_to_graph | relationship
- 난이도: {difficulty}

## 그래프 문제 출제 규칙
1. 그래프는 명확하고 해석 가능해야 함
2. 특징점(극값, 영점, 점근선)이 문제 해결에 활용되어야 함
3. 시각적 정보만으로 풀 수 없고 분석이 필요해야 함
4. RAG의 기출 패턴을 참고하여 출제

## 그래프 설명 형식
그래프는 다음 JSON으로 설명:
{
  "type": "함수 유형",
  "equation": "함수식 (LaTeX)",
  "domain": "정의역",
  "key_points": [
    {"type": "극대", "coord": [x, y]},
    {"type": "영점", "coord": [x, 0]}
  ],
  "asymptotes": ["점근선 정보"],
  "description": "그래프 설명"
}
```

## 사용 예시

### 입력
```json
{
  "engine": "graph_reasoning",
  "graph_type": "cubic_function",
  "reasoning_direction": "graph_to_equation",
  "difficulty": "상",
  "rag_query": "삼차함수 그래프 해석 기출"
}
```

### 출력
```json
{
  "problems": [
    {
      "number": 1,
      "content": "그림은 최고차항의 계수가 1인 삼차함수 $y = f(x)$의 그래프이다. $f(3)$의 값을 구하시오.",
      "figure": {
        "type": "cubic_function",
        "equation": "x^3 - 6x^2 + 9x",
        "key_points": [
          {"type": "극대", "coord": [1, 4]},
          {"type": "극소", "coord": [3, 0]},
          {"type": "영점", "coord": [0, 0]}
        ],
        "description": "원점을 지나고 x=1에서 극대, x=3에서 극소를 가지는 삼차함수"
      },
      "answer": "0",
      "solution": "그래프에서 영점이 x=0, x=3(중근)임을 확인\n$f(x) = x(x-3)^2 = x^3 - 6x^2 + 9x$\n$f(3) = 0$",
      "concepts": ["삼차함수", "극값", "인수분해"],
      "difficulty": "상"
    }
  ]
}
```

## JSXGraph 렌더링 코드 예시

```javascript
// 삼차함수 그래프 렌더링
const board = JXG.JSXGraph.initBoard('graph', {
  boundingbox: [-2, 6, 5, -2],
  axis: true,
  grid: true
});

const f = board.create('functiongraph', [
  function(x) { return x*x*x - 6*x*x + 9*x; },
  -1, 4
], {strokeColor: 'blue', strokeWidth: 2});

// 특징점 표시
board.create('point', [0, 0], {name: 'O', fixed: true});
board.create('point', [1, 4], {name: '극대', fixed: true});
board.create('point', [3, 0], {name: '극소', fixed: true});
```

## 연관 엔진

- `math_problem`: 일반 수학 문제
- `table_analysis`: 그래프에서 표 추출
- `proof_logic`: 그래프 성질 증명
