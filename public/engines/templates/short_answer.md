# 단답형 템플릿 (Short Answer Template)

> 수치/식 답안을 직접 작성하는 단답형 문제 템플릿

## 템플릿 정보

| 항목 | 값 |
|------|-----|
| **ID** | `short_answer` |
| **문제 유형** | 단답형 (주관식) |
| **답안 형태** | 수치, 간단한 식 |

## 구조

```yaml
template:
  number: "{번호}"
  score: "{배점}"
  content: "{문제 본문}"
  answer_format:
    type: "numeric | expression | text"
    range: "{허용 범위}"
    precision: "{소수점 자릿수}"
  answer: "{정답}"
  solution: "{풀이}"
```

## 답안 유형

### 정수 답안
```yaml
integer_answer:
  type: "integer"
  range: [-999, 999]  # 수능 기준 세 자리
  example: "42"
```

### 분수 답안
```yaml
fraction_answer:
  type: "fraction"
  format: "a/b"
  simplify: true  # 기약분수로
  example: "3/4"
```

### 소수 답안
```yaml
decimal_answer:
  type: "decimal"
  precision: 2  # 소수점 둘째 자리
  tolerance: 0.01
  example: "3.14"
```

### 식 답안
```yaml
expression_answer:
  type: "expression"
  format: "LaTeX"
  equivalence_check: true  # 동치 판정
  example: "x^2 + 1"
```

## JSON 스키마

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["number", "content", "answer"],
  "properties": {
    "number": {
      "type": "integer",
      "minimum": 1
    },
    "score": {
      "type": "integer",
      "minimum": 2,
      "maximum": 10,
      "default": 4
    },
    "content": {
      "type": "string",
      "minLength": 10
    },
    "answer": {
      "oneOf": [
        { "type": "integer" },
        { "type": "number" },
        { "type": "string" }
      ]
    },
    "answer_type": {
      "type": "string",
      "enum": ["integer", "fraction", "decimal", "expression"]
    },
    "tolerance": {
      "type": "number",
      "default": 0
    },
    "solution": {
      "type": "string"
    },
    "difficulty": {
      "type": "string",
      "enum": ["하", "중", "상"]
    }
  }
}
```

## 출력 형식

### 텍스트 형식 (수능형)
```
29. 함수 $f(x) = x^3 - 6x^2 + 9x$의 극댓값과 극솟값의 합을 구하시오. [4점]

    [    ]
```

### HTML 형식
```html
<div class="problem short-answer" data-number="29">
  <div class="problem-header">
    <span class="number">29.</span>
    <span class="score">[4점]</span>
  </div>
  <div class="problem-content">
    함수 <span class="math">f(x) = x^3 - 6x^2 + 9x</span>의
    극댓값과 극솟값의 합을 구하시오.
  </div>
  <div class="answer-box">
    <input type="text"
           class="answer-input"
           name="q29"
           pattern="[0-9\-]+"
           maxlength="3"
           placeholder="   ">
  </div>
</div>
```

### LaTeX 형식
```latex
\begin{shortanswer}{29}{4}
함수 $f(x) = x^3 - 6x^2 + 9x$의 극댓값과 극솟값의 합을 구하시오.
\answerbox{3}  % 3자리 답안 박스
\end{shortanswer}
```

## 수능 단답형 규칙

### 답안 범위
- **정수형**: 0 이상 999 이하 (세 자리)
- **음수 가능**: -99 이상 999 이하
- **분수형**: 기약분수로 표현

### 표기 규칙
```yaml
suneung_rules:
  negative:
    symbol: "-"
    position: "앞"
    marking: "음수 부호란에 표기"

  fraction:
    separator: "/"
    format: "{분자}/{분모}"
    simplify: true

  omr_format:
    digits: 3
    leading_zeros: false
```

## 예시

### 정수 답안
```json
{
  "number": 29,
  "score": 4,
  "content": "함수 $f(x) = x^3 - 6x^2 + 9x$의 극댓값과 극솟값의 합을 구하시오.",
  "answer_type": "integer",
  "answer": 4,
  "solution": "$f'(x) = 3x^2 - 12x + 9 = 3(x-1)(x-3)$\n$f'(x) = 0$에서 $x = 1$ 또는 $x = 3$\n$f(1) = 1 - 6 + 9 = 4$ (극대)\n$f(3) = 27 - 54 + 27 = 0$ (극소)\n따라서 극댓값과 극솟값의 합은 $4 + 0 = 4$",
  "difficulty": "중",
  "concepts": ["삼차함수의 극값", "미분"]
}
```

### 분수 답안
```json
{
  "number": 30,
  "score": 4,
  "content": "등비급수 $\\sum_{n=1}^{\\infty} \\left(\\frac{1}{2}\\right)^n$의 값을 구하시오.",
  "answer_type": "integer",
  "answer": 1,
  "solution": "첫째항 $a = \\frac{1}{2}$, 공비 $r = \\frac{1}{2}$\n$|r| < 1$이므로 수렴\n$S = \\frac{a}{1-r} = \\frac{\\frac{1}{2}}{1-\\frac{1}{2}} = \\frac{\\frac{1}{2}}{\\frac{1}{2}} = 1$",
  "difficulty": "중",
  "concepts": ["등비급수", "급수의 수렴"]
}
```

## 검증 로직

```python
def validate_short_answer(user_answer, correct_answer, answer_type, tolerance=0):
    if answer_type == "integer":
        return int(user_answer) == int(correct_answer)

    elif answer_type == "decimal":
        return abs(float(user_answer) - float(correct_answer)) <= tolerance

    elif answer_type == "fraction":
        from fractions import Fraction
        user_frac = Fraction(user_answer)
        correct_frac = Fraction(correct_answer)
        return user_frac == correct_frac

    elif answer_type == "expression":
        # SymPy를 사용한 동치 판정
        from sympy import simplify, sympify
        return simplify(sympify(user_answer) - sympify(correct_answer)) == 0

    return False
```
