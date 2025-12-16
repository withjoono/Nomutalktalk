# 증명형 템플릿 (Proof Template)

> 수학적 증명/논술 문제 템플릿

## 템플릿 정보

| 항목 | 값 |
|------|-----|
| **ID** | `proof` |
| **문제 유형** | 증명형 |
| **대상** | 수리논술, 증명 문제 |

## 구조

```yaml
template:
  number: "{번호}"
  score: "{배점}"
  statement: "{증명할 명제}"
  given:  # 주어진 조건
    - "{조건1}"
    - "{조건2}"
  to_prove: "{증명할 것}"
  hints: # 선택적 힌트
    - "{힌트1}"
  proof:
    method: "{증명 방법}"
    steps:
      - "{단계1}"
      - "{단계2}"
    conclusion: "{결론}"
```

## 증명 유형별 구조

### 직접 증명
```yaml
direct_proof:
  structure:
    - premise: "전제 확인"
    - derivation: "논리적 유도"
    - conclusion: "결론 도출"
  keywords: ["정의에 의해", "따라서", "그러므로"]
```

### 귀류법
```yaml
proof_by_contradiction:
  structure:
    - assumption: "결론의 부정 가정"
    - derivation: "논리적 전개"
    - contradiction: "모순 도출"
    - conclusion: "원래 명제 성립"
  keywords: ["~라고 가정하면", "모순", "따라서 가정이 거짓"]
```

### 수학적 귀납법
```yaml
mathematical_induction:
  structure:
    - base_case: "n=1 (또는 시작값) 확인"
    - induction_hypothesis: "n=k일 때 성립 가정"
    - induction_step: "n=k+1일 때 증명"
    - conclusion: "모든 자연수에 대해 성립"
  keywords: ["n=1일 때", "n=k일 때 성립한다고 가정", "n=k+1일 때"]
```

### 대우 증명
```yaml
contrapositive:
  structure:
    - original: "P → Q"
    - contrapositive: "~Q → ~P 증명"
    - conclusion: "원 명제 성립"
  keywords: ["대우 명제", "~Q이면 ~P"]
```

## JSON 스키마

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["number", "statement", "to_prove", "proof"],
  "properties": {
    "number": { "type": "integer" },
    "score": { "type": "integer" },
    "statement": { "type": "string" },
    "given": {
      "type": "array",
      "items": { "type": "string" }
    },
    "to_prove": { "type": "string" },
    "hints": {
      "type": "array",
      "items": { "type": "string" }
    },
    "proof": {
      "type": "object",
      "properties": {
        "method": {
          "type": "string",
          "enum": ["직접증명", "귀류법", "수학적귀납법", "대우증명", "구성적증명"]
        },
        "steps": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "step_number": { "type": "integer" },
              "content": { "type": "string" },
              "justification": { "type": "string" }
            }
          }
        },
        "conclusion": { "type": "string" }
      }
    }
  }
}
```

## 출력 형식

### 텍스트 형식 (논술형)
```
[문제 1] (20점)

다음 명제를 증명하시오.

"모든 자연수 n에 대하여 $1^2 + 2^2 + 3^2 + \cdots + n^2 = \frac{n(n+1)(2n+1)}{6}$이다."

[조건]
- n은 자연수이다.

[힌트] 수학적 귀납법을 사용하시오.

───────────────────────────────────────────────
[증명]




───────────────────────────────────────────────
```

### HTML 형식
```html
<div class="problem proof" data-number="1">
  <div class="problem-header">
    <span class="type">[문제 1]</span>
    <span class="score">(20점)</span>
  </div>

  <div class="problem-content">
    <p class="instruction">다음 명제를 증명하시오.</p>

    <blockquote class="statement">
      "모든 자연수 <span class="math">n</span>에 대하여
      <span class="math display">
        1^2 + 2^2 + 3^2 + \cdots + n^2 = \frac{n(n+1)(2n+1)}{6}
      </span>
      이다."
    </blockquote>

    <div class="given">
      <h4>조건</h4>
      <ul>
        <li><span class="math">n</span>은 자연수이다.</li>
      </ul>
    </div>

    <div class="hint">
      <strong>힌트:</strong> 수학적 귀납법을 사용하시오.
    </div>
  </div>

  <div class="proof-area">
    <div class="proof-header">[증명]</div>
    <textarea class="proof-input" rows="20"></textarea>
  </div>
</div>
```

### LaTeX 형식
```latex
\begin{proof_problem}{1}{20}
\statement{
  모든 자연수 $n$에 대하여
  \[1^2 + 2^2 + 3^2 + \cdots + n^2 = \frac{n(n+1)(2n+1)}{6}\]
  이다.
}

\given{
  \item $n$은 자연수이다.
}

\hint{수학적 귀납법을 사용하시오.}

\proofspace{15cm}
\end{proof_problem}
```

## 예시

```json
{
  "number": 1,
  "score": 20,
  "statement": "모든 자연수 $n$에 대하여 $1^2 + 2^2 + 3^2 + \\cdots + n^2 = \\frac{n(n+1)(2n+1)}{6}$이다.",
  "given": [
    "$n$은 자연수"
  ],
  "to_prove": "$\\sum_{k=1}^{n} k^2 = \\frac{n(n+1)(2n+1)}{6}$",
  "hints": [
    "수학적 귀납법을 사용하시오."
  ],
  "proof": {
    "method": "수학적귀납법",
    "steps": [
      {
        "step_number": 1,
        "content": "(i) $n = 1$일 때: 좌변 $= 1^2 = 1$, 우변 $= \\frac{1 \\cdot 2 \\cdot 3}{6} = 1$. 등식 성립.",
        "justification": "기본 단계"
      },
      {
        "step_number": 2,
        "content": "(ii) $n = k$일 때 등식이 성립한다고 가정: $1^2 + 2^2 + \\cdots + k^2 = \\frac{k(k+1)(2k+1)}{6}$",
        "justification": "귀납 가정"
      },
      {
        "step_number": 3,
        "content": "$n = k + 1$일 때:\n$1^2 + 2^2 + \\cdots + k^2 + (k+1)^2$\n$= \\frac{k(k+1)(2k+1)}{6} + (k+1)^2$ (귀납 가정에 의해)",
        "justification": "귀납 가정 적용"
      },
      {
        "step_number": 4,
        "content": "$= \\frac{k(k+1)(2k+1) + 6(k+1)^2}{6}$\n$= \\frac{(k+1)[k(2k+1) + 6(k+1)]}{6}$\n$= \\frac{(k+1)(2k^2 + 7k + 6)}{6}$\n$= \\frac{(k+1)(k+2)(2k+3)}{6}$",
        "justification": "인수분해"
      },
      {
        "step_number": 5,
        "content": "이는 $n = k + 1$을 대입한 우변 $\\frac{(k+1)(k+2)(2(k+1)+1)}{6}$와 같다.",
        "justification": "등식 확인"
      }
    ],
    "conclusion": "따라서 수학적 귀납법에 의해 모든 자연수 $n$에 대하여 주어진 등식이 성립한다. (Q.E.D.)"
  },
  "scoring_criteria": [
    {"item": "기본 단계 (n=1)", "points": 4},
    {"item": "귀납 가정 명시", "points": 2},
    {"item": "귀납 단계 전개", "points": 8},
    {"item": "인수분해 정확성", "points": 4},
    {"item": "결론 명시", "points": 2}
  ],
  "difficulty": "중",
  "concepts": ["수학적 귀납법", "자연수의 거듭제곱의 합"]
}
```

## 채점 기준 가이드

```yaml
proof_scoring:
  structure:
    description: "증명 구조의 완성도"
    points: 5
    rubric:
      5: "모든 단계 완벽"
      4: "사소한 생략"
      3: "주요 단계 포함, 일부 불완전"
      2: "핵심 아이디어만 있음"
      1: "시도했으나 불완전"
      0: "관련 없음"

  logic:
    description: "논리적 정확성"
    points: 8
    rubric:
      8: "완벽한 논리 전개"
      6: "사소한 논리적 비약"
      4: "주요 논증은 올바름"
      2: "부분적으로 올바른 추론"
      0: "논리적 오류"

  calculation:
    description: "계산 정확성"
    points: 5
    rubric:
      5: "모든 계산 정확"
      4: "사소한 계산 오류"
      2: "중요 계산 오류"
      0: "심각한 오류"

  presentation:
    description: "표현의 명확성"
    points: 2
    rubric:
      2: "명확하고 체계적"
      1: "이해 가능하나 불명확"
      0: "이해 어려움"
```
