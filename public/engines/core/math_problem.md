# 수학 문제 출제 엔진 (Math Problem Engine)

> 계산, 방정식, 함수 등 수학 문제 출제를 위한 핵심 엔진

## 엔진 정보

| 항목 | 값 |
|------|-----|
| **ID** | `math_problem` |
| **버전** | 1.0.0 |
| **분류** | Core Engine |
| **대상 과목** | 수학, 수학I, 수학II, 미적분, 확률과통계, 기하 |

## RAG 검색 쿼리 패턴

### 개념 검색
```json
{
  "query_type": "concept",
  "patterns": [
    "{단원명} 정의",
    "{단원명} 개념 설명",
    "{단원명} 공식",
    "{단원명} 성질"
  ],
  "filters": {
    "doc_type": ["교과서", "개념서"],
    "subject": "수학"
  }
}
```

### 기출 패턴 검색
```json
{
  "query_type": "problem_pattern",
  "patterns": [
    "{단원명} 기출문제",
    "{단원명} 유형",
    "{단원명} 출제 경향"
  ],
  "filters": {
    "doc_type": ["수능 기출", "모의고사", "내신 기출"],
    "difficulty": ["하", "중", "상"]
  }
}
```

## 문제 생성 규칙

### 1. 기본 구조
```yaml
problem_structure:
  - 문제_번호: 자동 생성
  - 배점: 난이도에 따라 2~5점
  - 문제_본문:
      - 조건 제시
      - 질문 명시
  - 보기: (객관식인 경우)
      - 5개 선택지
      - 오답 유인 설계
  - 정답: 명확한 답
  - 풀이: 단계별 해설
```

### 2. 난이도별 규칙

#### 하 (기본)
- 교과서 예제 수준
- 단일 개념 적용
- 계산 복잡도 낮음
- RAG 검색: 교과서 예제, 기본 문제

#### 중 (표준)
- 2개 이상 개념 통합
- 표준 출제 패턴
- 적절한 계산량
- RAG 검색: 기출문제 기본형

#### 상 (심화)
- 복합 개념 융합
- 창의적 접근 필요
- 킬러 문항 패턴
- RAG 검색: 고난도 기출, 심화 문제

### 3. 유형별 규칙

#### 계산형
```yaml
rules:
  - 수치가 "깔끔"해야 함 (정수 또는 간단한 분수)
  - 중간 계산 과정이 너무 복잡하지 않아야 함
  - 계산 실수 유도 장치 포함 가능
```

#### 함수형
```yaml
rules:
  - 함수식이 명확해야 함
  - 그래프 해석 문제는 주요 특징점 포함
  - 정의역, 치역 명시 필요시 포함
```

#### 방정식/부등식형
```yaml
rules:
  - 해가 존재해야 함 (특별한 경우 제외)
  - 해의 개수가 명확해야 함
  - 판별식, 근과 계수 관계 활용 가능
```

## 검증 로직

### 필수 검증 항목
```python
def validate_math_problem(problem):
    checks = {
        "answer_exists": check_answer_validity(problem),
        "calculation_correct": verify_calculation(problem),
        "difficulty_appropriate": check_difficulty(problem),
        "no_ambiguity": check_clarity(problem),
        "rag_aligned": check_rag_context(problem)
    }
    return all(checks.values()), checks
```

### 정답 검증
1. **수치 정답**: 직접 계산으로 검증
2. **식 정답**: 동치 관계 확인
3. **객관식**: 오답 선택지가 정답이 아님을 확인

### RAG 정합성 검증
- 사용된 개념이 RAG 컨텍스트에 존재하는지 확인
- 난이도가 참조 문제와 일관성 있는지 확인
- 출제 범위가 교육과정 내인지 확인

## 프롬프트 템플릿

### 기본 출제 프롬프트
```
당신은 수학 문제 출제 전문가입니다.

## RAG 참조 자료
{rag_context}

## 출제 조건
- 과목: {subject}
- 단원: {chapter}
- 난이도: {difficulty}
- 문제 유형: {problem_type}
- 문항 수: {count}

## 출제 규칙
1. RAG 자료의 개념과 패턴을 기반으로 출제
2. 정답이 명확하고 검증 가능해야 함
3. 난이도에 맞는 복잡도 유지
4. 오답 선택지는 흔한 실수를 유도하도록 설계

## 출력 형식
각 문제는 다음 JSON 형식으로 출력:
{
  "number": 문제번호,
  "content": "문제 본문",
  "choices": ["①", "②", "③", "④", "⑤"],  // 객관식인 경우
  "answer": "정답",
  "solution": "풀이 과정",
  "concepts": ["관련 개념1", "관련 개념2"],
  "difficulty": "상/중/하"
}
```

## 사용 예시

### 입력
```json
{
  "engine": "math_problem",
  "subject": "수학I",
  "chapter": "지수함수와 로그함수",
  "difficulty": "중",
  "type": "multiple_choice",
  "count": 2,
  "rag_query": "지수함수 로그함수 기출문제"
}
```

### 출력
```json
{
  "problems": [
    {
      "number": 1,
      "content": "함수 $f(x) = 2^{x+1} - 3$의 그래프가 $x$축과 만나는 점의 $x$좌표를 구하시오.",
      "choices": ["① $\\log_2 3 - 1$", "② $\\log_2 3$", "③ $\\log_2 3 + 1$", "④ $\\log_2 6$", "⑤ $\\log_2 6 - 1$"],
      "answer": "①",
      "solution": "$f(x) = 0$에서 $2^{x+1} = 3$\n$x + 1 = \\log_2 3$\n$x = \\log_2 3 - 1$",
      "concepts": ["지수함수", "로그의 정의"],
      "difficulty": "중"
    }
  ],
  "metadata": {
    "engine": "math_problem",
    "rag_sources": ["2024 수능 15번", "교과서 p.45 예제"],
    "generated_at": "2024-12-15T10:00:00Z"
  }
}
```

## 연관 엔진

- `graph_reasoning`: 함수 그래프 문제
- `proof_logic`: 증명 문제
- `table_analysis`: 통계 데이터 문제
