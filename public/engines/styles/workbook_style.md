# 문제집 스타일 (Workbook Style)

> 학습용 문제집/참고서 형식의 문제 출력 스타일

## 스타일 정보

| 항목 | 값 |
|------|-----|
| **ID** | `workbook_style` |
| **용도** | 문제집, 참고서, 자습서 |
| **형식** | 학습 친화적, 해설 포함 |

## 레이아웃 구조

```
┌─────────────────────────────────────────┐
│  📚 단원명: {대단원} > {중단원}          │
│  🎯 학습목표: ...                        │
├─────────────────────────────────────────┤
│  ▶ 유형 01. {유형명}                    │
│  ┌─────────────────────────────────────┐│
│  │ [개념 정리]                         ││
│  │ • 핵심 개념 설명                    ││
│  │ • 공식 및 정리                      ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  [예제] ⭐⭐ (난이도)                    │
│  문제...                                │
│  ┌─────────────────────────────────────┐│
│  │ 💡 풀이                             ││
│  │ Step 1: ...                         ││
│  │ Step 2: ...                         ││
│  │ 정답: ...                           ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  [연습문제]                             │
│  001. 문제...                           │
│  002. 문제...                           │
└─────────────────────────────────────────┘
```

## 구성 요소

### 단원 헤더
```yaml
chapter_header:
  breadcrumb: "{대단원} > {중단원} > {소단원}"
  learning_objectives:
    - 목표1
    - 목표2
  related_concepts: ["연관개념1", "연관개념2"]
```

### 개념 정리 박스
```yaml
concept_box:
  title: "핵심 개념"
  style: "highlight_box"
  content:
    - 정의
    - 공식
    - 성질
    - 주의사항
```

### 난이도 표시
```yaml
difficulty:
  symbols: "⭐"
  levels:
    1: "기초"
    2: "기본"
    3: "표준"
    4: "발전"
    5: "심화"
```

### 문제 유형
```yaml
problem_types:
  example: "예제"
  practice: "유제"
  exercise: "연습문제"
  challenge: "도전문제"
```

### 풀이 구조
```yaml
solution:
  show_steps: true
  step_format: "Step {n}: {내용}"
  highlight_key: true
  tip_box: true
```

## 출력 템플릿

### HTML 출력
```html
<div class="workbook">
  <header class="chapter-header">
    <nav class="breadcrumb">{{breadcrumb}}</nav>
    <h1>{{chapter_title}}</h1>
    <div class="objectives">
      <h4>🎯 학습목표</h4>
      <ul>
        {{#objectives}}<li>{{.}}</li>{{/objectives}}
      </ul>
    </div>
  </header>

  <section class="concept-box">
    <h3>📌 핵심 개념</h3>
    <div class="concept-content">
      {{concept_content}}
    </div>
  </section>

  <section class="example">
    <div class="example-header">
      <span class="label">예제</span>
      <span class="difficulty">{{difficulty_stars}}</span>
    </div>
    <div class="problem-content">{{content}}</div>

    <details class="solution">
      <summary>💡 풀이 보기</summary>
      <div class="solution-content">
        {{#steps}}
        <div class="step">
          <span class="step-num">Step {{num}}:</span>
          <span class="step-content">{{content}}</span>
        </div>
        {{/steps}}
        <div class="answer">
          <strong>정답:</strong> {{answer}}
        </div>
      </div>
    </details>
  </section>

  <section class="exercises">
    <h3>연습문제</h3>
    {{#exercises}}
    <div class="exercise">
      <span class="number">{{number}}.</span>
      <span class="difficulty">{{difficulty_stars}}</span>
      <div class="content">{{content}}</div>
    </div>
    {{/exercises}}
  </section>
</div>
```

### CSS 스타일
```css
.workbook {
  font-family: 'Noto Sans KR', sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.concept-box {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-left: 4px solid #1976d2;
  padding: 20px;
  margin: 20px 0;
  border-radius: 0 8px 8px 0;
}

.example {
  background: #fff;
  border: 2px solid #4caf50;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.example-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.label {
  background: #4caf50;
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-weight: bold;
}

.solution {
  background: #f5f5f5;
  padding: 15px;
  margin-top: 15px;
  border-radius: 8px;
}

.solution summary {
  cursor: pointer;
  font-weight: bold;
  color: #1976d2;
}

.step {
  margin: 10px 0;
  padding-left: 20px;
}

.step-num {
  color: #f57c00;
  font-weight: bold;
}

.difficulty {
  color: #ffc107;
}
```

## 적용 예시

```json
{
  "style": "workbook_style",
  "config": {
    "chapter": {
      "major": "다항식",
      "minor": "항등식과 나머지정리",
      "sub": "항등식"
    },
    "objectives": [
      "항등식의 정의를 이해한다",
      "항등식의 성질을 활용하여 미정계수를 구할 수 있다"
    ],
    "show_solution": true,
    "solution_collapsed": true,
    "difficulty_visible": true
  }
}
```
