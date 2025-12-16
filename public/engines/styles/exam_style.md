# 시험지 스타일 (Exam Style)

> 정식 시험지 형식의 문제 출력 스타일

## 스타일 정보

| 항목 | 값 |
|------|-----|
| **ID** | `exam_style` |
| **용도** | 내신, 모의고사, 수능형 시험지 |
| **형식** | 공식적, 정형화된 형식 |

## 레이아웃 구조

```
┌─────────────────────────────────────────┐
│              [시험지 헤더]               │
│  과목명 | 시험일 | 제한시간 | 총점        │
├─────────────────────────────────────────┤
│  [안내사항]                              │
│  - 답안 작성 요령                         │
│  - 배점 안내                             │
├─────────────────────────────────────────┤
│  1. [문제] (배점: 3점)                   │
│     문제 본문...                         │
│     ① 선택지1  ② 선택지2               │
│     ③ 선택지3  ④ 선택지4               │
│     ⑤ 선택지5                           │
├─────────────────────────────────────────┤
│  2. [문제] (배점: 4점)                   │
│     ...                                 │
└─────────────────────────────────────────┘
```

## 구성 요소

### 헤더
```yaml
header:
  title: "{과목명} {시험유형}"
  info:
    - 시험일: "YYYY년 MM월 DD일"
    - 제한시간: "XX분"
    - 총점: "100점"
    - 문항수: "XX문항"
  logo: optional
```

### 문제 번호 형식
```yaml
numbering:
  format: "{번호}."
  start: 1
  style: arabic  # arabic | roman | letter
```

### 배점 표시
```yaml
scoring:
  position: "문제 번호 옆"
  format: "(배점: {점수}점)"
  total_visible: true
```

### 선택지 형식 (객관식)
```yaml
choices:
  symbols: ["①", "②", "③", "④", "⑤"]
  layout: "2열 배치"
  spacing: "균등"
```

## 출력 템플릿

### HTML 출력
```html
<div class="exam-paper">
  <header class="exam-header">
    <h1>{{subject}} {{exam_type}}</h1>
    <div class="exam-info">
      <span>시험일: {{date}}</span>
      <span>제한시간: {{time_limit}}분</span>
      <span>총점: {{total_score}}점</span>
    </div>
  </header>

  <section class="exam-instructions">
    <h3>안내사항</h3>
    <ul>
      {{#instructions}}
      <li>{{.}}</li>
      {{/instructions}}
    </ul>
  </section>

  <section class="exam-problems">
    {{#problems}}
    <div class="problem" data-number="{{number}}">
      <div class="problem-header">
        <span class="number">{{number}}.</span>
        <span class="score">(배점: {{score}}점)</span>
      </div>
      <div class="problem-content">
        {{content}}
      </div>
      {{#choices}}
      <div class="choices">
        {{#.}}
        <span class="choice">{{.}}</span>
        {{/.}}
      </div>
      {{/choices}}
    </div>
    {{/problems}}
  </section>
</div>
```

### CSS 스타일
```css
.exam-paper {
  font-family: 'Noto Sans KR', sans-serif;
  max-width: 210mm;
  margin: 0 auto;
  padding: 20mm;
  background: white;
}

.exam-header {
  text-align: center;
  border-bottom: 2px solid #333;
  padding-bottom: 10px;
  margin-bottom: 20px;
}

.problem {
  margin-bottom: 25px;
  page-break-inside: avoid;
}

.problem-header {
  font-weight: bold;
  margin-bottom: 10px;
}

.choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 15px;
  margin-left: 20px;
}

.choice {
  padding: 5px 10px;
}
```

## 인쇄 설정

```yaml
print:
  paper_size: A4
  orientation: portrait
  margins:
    top: 20mm
    bottom: 20mm
    left: 25mm
    right: 25mm
  font_size: 11pt
  line_height: 1.6
```

## 적용 예시

```json
{
  "style": "exam_style",
  "config": {
    "subject": "수학I",
    "exam_type": "1학기 중간고사",
    "date": "2024-04-15",
    "time_limit": 50,
    "total_score": 100,
    "instructions": [
      "답안은 OMR 카드에 컴퓨터용 사인펜으로 표기하세요.",
      "문제지와 답안지의 수험번호를 확인하세요.",
      "계산 과정이 필요한 문제는 여백을 활용하세요."
    ]
  }
}
```
