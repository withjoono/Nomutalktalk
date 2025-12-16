# 객관식 템플릿 (Multiple Choice Template)

> 5지선다형 객관식 문제 템플릿

## 템플릿 정보

| 항목 | 값 |
|------|-----|
| **ID** | `multiple_choice` |
| **문제 유형** | 객관식 |
| **선택지 수** | 5개 (기본) |

## 구조

```yaml
template:
  number: "{번호}"
  score: "{배점}"
  content: "{문제 본문}"
  choices:
    - "① {선택지1}"
    - "② {선택지2}"
    - "③ {선택지3}"
    - "④ {선택지4}"
    - "⑤ {선택지5}"
  answer: "{정답 번호}"
  solution: "{풀이}"
```

## 선택지 설계 규칙

### 오답 유인 설계
```yaml
distractor_types:
  calculation_error:
    description: "흔한 계산 실수 결과"
    example: "부호 오류, 상수 누락"

  concept_confusion:
    description: "유사 개념 혼동"
    example: "미분/적분 혼동, 공식 혼동"

  partial_answer:
    description: "중간 과정 결과"
    example: "최종 답이 아닌 중간값"

  sign_error:
    description: "부호 오류"
    example: "+/- 반대"

  order_error:
    description: "순서/크기 오류"
    example: "대소 관계 반대"
```

### 선택지 배열 규칙
```yaml
arrangement:
  numeric:
    order: "ascending"  # 숫자는 오름차순
  expression:
    order: "complexity"  # 간단한 것부터
  mixed:
    order: "random"  # 무작위 (정답 위치 분산)
```

## JSON 스키마

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["number", "content", "choices", "answer"],
  "properties": {
    "number": {
      "type": "integer",
      "minimum": 1
    },
    "score": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10,
      "default": 3
    },
    "content": {
      "type": "string",
      "minLength": 10
    },
    "choices": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 5,
      "maxItems": 5
    },
    "answer": {
      "type": "string",
      "enum": ["①", "②", "③", "④", "⑤"]
    },
    "solution": {
      "type": "string"
    },
    "difficulty": {
      "type": "string",
      "enum": ["하", "중", "상"]
    },
    "concepts": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

## 출력 형식

### 텍스트 형식
```
1. 다항식 $(x+1)(x^2-x+1)$을 전개한 식은? (3점)

   ① $x^3-1$
   ② $x^3+1$
   ③ $x^3-2x^2+2x-1$
   ④ $x^3+2x^2+2x+1$
   ⑤ $x^3+x^2+x+1$
```

### HTML 형식
```html
<div class="problem multiple-choice" data-number="1">
  <div class="problem-header">
    <span class="number">1.</span>
    <span class="score">(3점)</span>
  </div>
  <div class="problem-content">
    다항식 <span class="math">(x+1)(x^2-x+1)</span>을 전개한 식은?
  </div>
  <div class="choices">
    <label class="choice">
      <input type="radio" name="q1" value="1">
      <span>① <span class="math">x^3-1</span></span>
    </label>
    <label class="choice">
      <input type="radio" name="q1" value="2">
      <span>② <span class="math">x^3+1</span></span>
    </label>
    <!-- ... -->
  </div>
</div>
```

### LaTeX 형식
```latex
\begin{problem}{1}{3}
다항식 $(x+1)(x^2-x+1)$을 전개한 식은?
\begin{choices}
\choice $x^3-1$
\choice $x^3+1$  % 정답
\choice $x^3-2x^2+2x-1$
\choice $x^3+2x^2+2x+1$
\choice $x^3+x^2+x+1$
\end{choices}
\end{problem}
```

## 예시

```json
{
  "number": 1,
  "score": 3,
  "content": "함수 $f(x) = x^3 - 3x + 2$에 대하여 $f'(1)$의 값은?",
  "choices": [
    "① $-3$",
    "② $-1$",
    "③ $0$",
    "④ $1$",
    "⑤ $3$"
  ],
  "answer": "③",
  "solution": "$f'(x) = 3x^2 - 3$이므로\n$f'(1) = 3(1)^2 - 3 = 3 - 3 = 0$",
  "difficulty": "하",
  "concepts": ["다항함수의 미분", "미분계수"]
}
```
