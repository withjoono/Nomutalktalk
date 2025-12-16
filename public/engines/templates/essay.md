# 서술형 템플릿 (Essay Template)

> 풀이 과정을 서술하는 서술형/논술형 문제 템플릿

## 템플릿 정보

| 항목 | 값 |
|------|-----|
| **ID** | `essay` |
| **문제 유형** | 서술형 |
| **답안 형태** | 풀이 과정 + 결론 |

## 구조

```yaml
template:
  number: "{번호}"
  score: "{배점}"
  content: "{문제 본문}"
  sub_questions:  # 소문항 (선택적)
    - "(1) {소문항1}"
    - "(2) {소문항2}"
  scoring_criteria:  # 채점 기준
    - item: "{채점 항목}"
      points: "{배점}"
  answer: "{모범 답안}"
  solution: "{해설}"
```

## 채점 기준 설계

### 단계별 배점
```yaml
scoring_rubric:
  approach:
    description: "문제 이해 및 접근 방법"
    points: 2
    criteria:
      - "문제의 조건을 정확히 파악"
      - "적절한 풀이 전략 선택"

  process:
    description: "풀이 과정"
    points: 4
    criteria:
      - "논리적 전개"
      - "수식 변형의 정확성"
      - "중간 과정 기술"

  calculation:
    description: "계산의 정확성"
    points: 2
    criteria:
      - "연산 오류 없음"
      - "단위 처리 정확"

  conclusion:
    description: "결론 도출"
    points: 2
    criteria:
      - "최종 답 명시"
      - "단위/조건 확인"
```

### 부분 점수 기준
```yaml
partial_credit:
  full: "완벽한 풀이"
  major: "핵심 과정 포함, 사소한 오류"
  partial: "접근은 올바르나 중간 오류"
  minimal: "일부 개념만 적용"
  none: "관련 없는 풀이"
```

## JSON 스키마

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["number", "content", "answer", "scoring_criteria"],
  "properties": {
    "number": {
      "type": "integer"
    },
    "score": {
      "type": "integer",
      "minimum": 5,
      "maximum": 20
    },
    "content": {
      "type": "string"
    },
    "sub_questions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "label": { "type": "string" },
          "content": { "type": "string" },
          "points": { "type": "integer" }
        }
      }
    },
    "scoring_criteria": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "item": { "type": "string" },
          "points": { "type": "integer" },
          "criteria": { "type": "array" }
        }
      }
    },
    "answer": {
      "type": "string"
    },
    "solution": {
      "type": "string"
    }
  }
}
```

## 출력 형식

### 텍스트 형식
```
[서술형 1] (10점)

함수 $f(x) = x^3 - 3x^2 + 2$에 대하여 다음을 구하시오.

(1) $f(x)$의 극값을 구하시오. (5점)

(2) 곡선 $y = f(x)$와 $x$축으로 둘러싸인 부분의 넓이를 구하시오. (5점)

[풀이 과정을 쓰시오]

───────────────────────────────────────────────
```

### HTML 형식
```html
<div class="problem essay" data-number="1">
  <div class="problem-header">
    <span class="type">[서술형 1]</span>
    <span class="score">(10점)</span>
  </div>

  <div class="problem-content">
    <p>함수 <span class="math">f(x) = x^3 - 3x^2 + 2</span>에 대하여 다음을 구하시오.</p>

    <div class="sub-questions">
      <div class="sub-question">
        <span class="label">(1)</span>
        <span class="content"><span class="math">f(x)</span>의 극값을 구하시오.</span>
        <span class="points">(5점)</span>
      </div>
      <div class="sub-question">
        <span class="label">(2)</span>
        <span class="content">곡선 <span class="math">y = f(x)</span>와 <span class="math">x</span>축으로 둘러싸인 부분의 넓이를 구하시오.</span>
        <span class="points">(5점)</span>
      </div>
    </div>
  </div>

  <div class="answer-area">
    <div class="answer-header">풀이 과정을 쓰시오</div>
    <textarea class="answer-input" rows="15"></textarea>
  </div>
</div>
```

### LaTeX 형식
```latex
\begin{essay}{1}{10}
함수 $f(x) = x^3 - 3x^2 + 2$에 대하여 다음을 구하시오.

\begin{subquestions}
\subquestion{5} $f(x)$의 극값을 구하시오.
\subquestion{5} 곡선 $y = f(x)$와 $x$축으로 둘러싸인 부분의 넓이를 구하시오.
\end{subquestions}

\answerspace{10cm}
\end{essay}
```

## 예시

```json
{
  "number": 1,
  "score": 10,
  "content": "함수 $f(x) = x^3 - 3x^2 + 2$에 대하여 다음을 구하시오.",
  "sub_questions": [
    {
      "label": "(1)",
      "content": "$f(x)$의 극값을 구하시오.",
      "points": 5
    },
    {
      "label": "(2)",
      "content": "곡선 $y = f(x)$와 $x$축으로 둘러싸인 부분의 넓이를 구하시오.",
      "points": 5
    }
  ],
  "scoring_criteria": [
    {
      "item": "(1) 도함수 계산",
      "points": 1,
      "criteria": ["$f'(x) = 3x^2 - 6x$ 정확히 계산"]
    },
    {
      "item": "(1) 극값 판정",
      "points": 2,
      "criteria": ["$x = 0, 2$에서 극값", "증감표 또는 이계도함수 활용"]
    },
    {
      "item": "(1) 극값 계산",
      "points": 2,
      "criteria": ["극대값 $f(0) = 2$", "극소값 $f(2) = -2$"]
    },
    {
      "item": "(2) 적분 구간 설정",
      "points": 2,
      "criteria": ["$x$축과의 교점 계산", "$x = 1, -1 + \\sqrt{3}$ (또는 동치)"]
    },
    {
      "item": "(2) 정적분 계산",
      "points": 3,
      "criteria": ["적분 설정 정확", "계산 정확", "넓이 값 정확"]
    }
  ],
  "answer": "(1) 극대값: 2 (x=0), 극소값: -2 (x=2)\n(2) 넓이: $\\frac{27}{4}$",
  "solution": "(1) $f'(x) = 3x^2 - 6x = 3x(x-2)$\n$f'(x) = 0$에서 $x = 0$ 또는 $x = 2$\n증감표를 그리면 $x = 0$에서 극대, $x = 2$에서 극소\n극대값: $f(0) = 2$\n극소값: $f(2) = 8 - 12 + 2 = -2$\n\n(2) $f(x) = 0$에서 $x^3 - 3x^2 + 2 = 0$\n$(x-1)(x^2-2x-2) = 0$\n$x = 1$ 또는 $x = 1 \\pm \\sqrt{3}$\n넓이 = $\\int_1^{1+\\sqrt{3}} |f(x)| dx = \\frac{27}{4}$",
  "difficulty": "상",
  "concepts": ["삼차함수의 극값", "정적분과 넓이"]
}
```

## 자동 채점 가이드라인

```yaml
auto_grading:
  keyword_matching:
    enabled: true
    keywords: ["도함수", "극값", "적분"]

  formula_checking:
    enabled: true
    key_formulas: ["f'(x) = 3x^2 - 6x", "극대값 = 2", "극소값 = -2"]

  answer_extraction:
    pattern: "정답|답|따라서"
    verify_final: true

  human_review:
    threshold: 0.7  # 자동 채점 신뢰도 70% 미만 시 검토 필요
    flag_cases: ["비정형 풀이", "부분 정답"]
```
