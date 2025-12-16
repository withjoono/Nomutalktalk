# 증명 논리 엔진 (Proof Logic Engine)

> 수학적 증명, 논리 전개, 명제 문제 출제 엔진

## 엔진 정보

| 항목 | 값 |
|------|-----|
| **ID** | `proof_logic` |
| **버전** | 1.0.0 |
| **분류** | Core Engine |
| **대상 과목** | 수학, 수학I, 수학II, 미적분, 기하, 수리논술 |

## RAG 검색 쿼리 패턴

### 정리/공식 검색
```json
{
  "query_type": "theorem",
  "patterns": [
    "{정리명} 증명",
    "{정리명} 정의",
    "{공식명} 유도",
    "{개념} 필요충분조건"
  ],
  "filters": {
    "doc_type": ["교과서", "개념서", "수리논술"],
    "content_type": "proof"
  }
}
```

### 증명 패턴 검색
```json
{
  "query_type": "proof_pattern",
  "patterns": [
    "{증명기법} 예시",
    "귀류법 문제",
    "수학적 귀납법 문제",
    "대우 증명 문제"
  ],
  "filters": {
    "problem_type": ["증명", "서술형", "논술"]
  }
}
```

## 문제 생성 규칙

### 1. 증명 유형 분류

#### 직접 증명
```yaml
types:
  - 정의 활용: 정의에서 직접 유도
  - 공식 적용: 알려진 공식/정리 활용
  - 계산 증명: 좌변 = 우변 형태로 계산
```

#### 간접 증명
```yaml
types:
  - 귀류법: 결론 부정 후 모순 도출
  - 대우 증명: 대우 명제 증명
  - 반례: 반례 제시로 거짓 증명
```

#### 귀납적 증명
```yaml
types:
  - 수학적 귀납법: n=1 확인, n=k → n=k+1
  - 강한 귀납법: 모든 이전 케이스 가정
```

### 2. 난이도별 규칙

#### 하 (기본)
```yaml
rules:
  - 단일 정리/공식 적용
  - 2~3단계 논리 전개
  - 힌트 제공 가능
  - RAG 참조: 교과서 증명 예제
```

#### 중 (표준)
```yaml
rules:
  - 복합 정리 활용
  - 4~6단계 논리 전개
  - 중간 과정 일부 생략
  - RAG 참조: 기출 증명 문제
```

#### 상 (심화/논술)
```yaml
rules:
  - 창의적 접근 필요
  - 다단계 복합 논증
  - 새로운 보조정리 도출 필요
  - RAG 참조: 논술 기출, 경시 문제
```

### 3. 논리 구조 규칙

```yaml
logic_structure:
  premises:
    - 가정: 명확히 제시
    - 조건: 필요조건 명시
  inference:
    - 각 단계 근거 명시
    - 논리적 비약 없음
    - 사용 정리/공식 인용
  conclusion:
    - 증명 목표 달성 확인
    - Q.E.D. 또는 "따라서 증명됨"
```

## 검증 로직

### 논리 정합성 검증
```python
def validate_proof_problem(problem):
    checks = {
        "premises_clear": check_premises(problem),
        "logic_valid": verify_logical_steps(problem),
        "no_circular": check_circular_reasoning(problem),
        "conclusion_reached": verify_conclusion(problem),
        "difficulty_appropriate": check_proof_complexity(problem)
    }
    return all(checks.values()), checks
```

### 증명 단계 검증
1. **전제 확인**: 모든 가정이 명시되었는지
2. **추론 검증**: 각 단계가 이전 단계에서 유도 가능한지
3. **순환 논증**: 결론을 가정에 사용하지 않았는지
4. **완결성**: 결론이 충분히 도출되었는지

## 프롬프트 템플릿

### 증명 문제 출제
```
당신은 수학 증명 문제 출제 전문가입니다.

## RAG 참조 자료
{rag_context}

## 출제 조건
- 증명 유형: {proof_type}  // direct | indirect | induction
- 관련 정리: {theorem}
- 난이도: {difficulty}
- 대상: {target}  // 내신 | 수능 | 논술

## 증명 문제 출제 규칙
1. 전제와 결론이 명확해야 함
2. 증명 가능한 명제여야 함
3. 난이도에 맞는 논리 단계 수
4. RAG의 증명 패턴 참고

## 출력 형식
{
  "statement": "증명할 명제",
  "premises": ["전제1", "전제2"],
  "goal": "증명 목표",
  "hint": "힌트 (선택)",
  "proof": {
    "method": "증명 방법",
    "steps": [
      {"step": 1, "content": "...", "justification": "근거"},
      {"step": 2, "content": "...", "justification": "근거"}
    ],
    "conclusion": "결론"
  },
  "related_theorems": ["관련 정리"]
}
```

## 사용 예시

### 입력
```json
{
  "engine": "proof_logic",
  "proof_type": "induction",
  "topic": "수열의 합 공식",
  "difficulty": "중",
  "rag_query": "수학적 귀납법 증명 기출"
}
```

### 출력
```json
{
  "problems": [
    {
      "number": 1,
      "statement": "모든 자연수 $n$에 대하여 $1 + 2 + 3 + \\cdots + n = \\frac{n(n+1)}{2}$임을 수학적 귀납법으로 증명하시오.",
      "premises": ["n은 자연수"],
      "goal": "등식이 모든 자연수 n에 대해 성립함을 보임",
      "proof": {
        "method": "수학적 귀납법",
        "steps": [
          {
            "step": 1,
            "content": "(i) n=1일 때: 좌변 = 1, 우변 = 1×2/2 = 1. 등식 성립.",
            "justification": "기본 단계 확인"
          },
          {
            "step": 2,
            "content": "(ii) n=k일 때 성립한다고 가정: $1+2+\\cdots+k = \\frac{k(k+1)}{2}$",
            "justification": "귀납 가정"
          },
          {
            "step": 3,
            "content": "n=k+1일 때: $1+2+\\cdots+k+(k+1) = \\frac{k(k+1)}{2} + (k+1)$",
            "justification": "귀납 가정 적용"
          },
          {
            "step": 4,
            "content": "$= \\frac{k(k+1) + 2(k+1)}{2} = \\frac{(k+1)(k+2)}{2}$",
            "justification": "인수분해"
          },
          {
            "step": 5,
            "content": "이는 n=k+1을 대입한 우변과 같다.",
            "justification": "등식 확인"
          }
        ],
        "conclusion": "따라서 수학적 귀납법에 의해 모든 자연수 n에 대해 등식이 성립한다."
      },
      "related_theorems": ["수학적 귀납법의 원리", "등차수열의 합"],
      "difficulty": "중"
    }
  ]
}
```

## 연관 엔진

- `math_problem`: 계산형 문제
- `graph_reasoning`: 그래프 성질 증명
- `table_analysis`: 데이터 기반 추론
