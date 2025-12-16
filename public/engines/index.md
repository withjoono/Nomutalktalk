# Hizen AI 문제 출제 엔진 시스템

> RAG 기반 지능형 문제 출제 엔진 프레임워크

## 개요

이 엔진 시스템은 RAG(Retrieval-Augmented Generation)화된 교과서, 기출문제 등의 자료를 참조하여 고품질 문제를 출제합니다.

## 엔진 구조

```
engines/
├── core/                    # 핵심 출제 엔진
│   ├── math_problem.md      # 수학 문제 출제
│   ├── graph_reasoning.md   # 그래프/함수 추론
│   ├── proof_logic.md       # 증명/논리 문제
│   ├── table_analysis.md    # 표/데이터 분석
│   └── science_experiment.md # 과학 실험 문제
├── styles/                  # 출력 스타일
│   ├── exam_style.md        # 시험지 형식
│   ├── workbook_style.md    # 문제집 형식
│   └── interactive_style.md # 대화형 형식
├── templates/               # 문제 템플릿
│   ├── multiple_choice.md   # 객관식
│   ├── short_answer.md      # 단답형
│   ├── essay.md             # 서술형
│   └── proof.md             # 증명형
└── index.md                 # 이 파일
```

## Core 엔진 목록

| 엔진 | 파일 | 용도 | RAG 연동 |
|------|------|------|----------|
| 수학 문제 | `math_problem.md` | 계산, 방정식, 함수 문제 | 교과서 개념, 기출 패턴 |
| 그래프 추론 | `graph_reasoning.md` | 그래프 해석, 함수 분석 | 그래프 유형, 해석 방법 |
| 증명 논리 | `proof_logic.md` | 수학적 증명, 논리 전개 | 증명 기법, 정리 |
| 표 분석 | `table_analysis.md` | 데이터 해석, 통계 | 표 유형, 분석 방법 |
| 과학 실험 | `science_experiment.md` | 실험 설계, 결과 해석 | 실험 방법, 변인 통제 |

## 엔진 사용 방법

### 1. 엔진 선택
```javascript
const engine = await loadEngine('math_problem');
```

### 2. RAG 컨텍스트 검색
```javascript
const context = await searchRAG({
  query: '이차함수의 최댓값과 최솟값',
  filters: { subject: '수학', chapter: '이차함수' }
});
```

### 3. 문제 생성
```javascript
const problem = await engine.generate({
  context: context,
  difficulty: 'medium',
  type: 'multiple_choice',
  count: 3
});
```

## RAG 연동 원칙

1. **컨텍스트 우선**: 항상 RAG에서 관련 자료를 먼저 검색
2. **패턴 학습**: 기출문제의 출제 패턴 분석 및 적용
3. **난이도 조절**: 교과서 예제 → 기본 → 발전 → 심화
4. **검증 필수**: 생성된 문제의 정답 검증

## 버전 정보

- **버전**: 1.0.0
- **최종 수정**: 2024-12-15
- **호환성**: Hizen AI 문제 은행 v1.0+
