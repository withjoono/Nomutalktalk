# 대화형 스타일 (Interactive Style)

> 웹 기반 대화형 문제 풀이 스타일

## 스타일 정보

| 항목 | 값 |
|------|-----|
| **ID** | `interactive_style` |
| **용도** | 온라인 학습, 자기주도 학습 |
| **형식** | 대화형, 단계별 힌트 |

## 레이아웃 구조

```
┌─────────────────────────────────────────┐
│  [문제 카드]                            │
│  ┌─────────────────────────────────────┐│
│  │ Q. 문제 내용                        ││
│  │    (수식, 그래프, 표 등)            ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  [답안 입력 영역]                        │
│  ○ 선택지1  ○ 선택지2  ○ 선택지3       │
│  [정답 확인] [힌트 보기]                │
├─────────────────────────────────────────┤
│  [피드백 영역]                          │
│  ✅ 정답입니다! / ❌ 다시 생각해보세요   │
│  [단계별 힌트] [전체 풀이 보기]          │
├─────────────────────────────────────────┤
│  [진행 상황]                            │
│  ████████░░ 8/10 완료                   │
└─────────────────────────────────────────┘
```

## 구성 요소

### 문제 카드
```yaml
problem_card:
  display: "card"
  animation: "fade-in"
  components:
    - question_text
    - math_display  # KaTeX 렌더링
    - figure        # 그래프/이미지
    - table         # 표
```

### 답안 입력
```yaml
answer_input:
  types:
    multiple_choice:
      style: "radio_buttons"
      layout: "vertical | horizontal | grid"
    short_answer:
      style: "text_input"
      validation: "real-time"
    numeric:
      style: "number_input"
      tolerance: 0.01
```

### 힌트 시스템
```yaml
hints:
  levels:
    - level: 1
      type: "direction"
      content: "어떤 공식을 사용해야 할까요?"
    - level: 2
      type: "partial"
      content: "첫 번째 단계는..."
    - level: 3
      type: "detailed"
      content: "자세한 풀이 과정"
  reveal: "progressive"  # 단계별 공개
  penalty: true          # 힌트 사용 시 점수 감점
```

### 피드백
```yaml
feedback:
  correct:
    message: "정답입니다! 🎉"
    show_explanation: true
    next_action: "다음 문제"
  incorrect:
    message: "다시 생각해보세요"
    show_hint: true
    retry_allowed: true
    max_attempts: 3
```

### 진행 상황
```yaml
progress:
  display: "progress_bar"
  show_score: true
  show_time: true
  achievements: true
```

## 출력 템플릿

### React 컴포넌트
```jsx
const InteractiveProblem = ({ problem, onAnswer }) => {
  const [selected, setSelected] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [feedback, setFeedback] = useState(null);

  return (
    <div className="interactive-problem">
      <div className="problem-card">
        <div className="problem-content">
          <Latex>{problem.content}</Latex>
        </div>

        {problem.figure && (
          <div className="problem-figure">
            <Graph data={problem.figure} />
          </div>
        )}
      </div>

      <div className="answer-section">
        {problem.choices.map((choice, idx) => (
          <button
            key={idx}
            className={`choice ${selected === idx ? 'selected' : ''}`}
            onClick={() => setSelected(idx)}
          >
            {choice}
          </button>
        ))}
      </div>

      <div className="action-buttons">
        <button onClick={() => checkAnswer(selected)}>
          정답 확인
        </button>
        <button onClick={() => setShowHint(true)}>
          💡 힌트
        </button>
      </div>

      {feedback && (
        <div className={`feedback ${feedback.correct ? 'correct' : 'incorrect'}`}>
          {feedback.message}
        </div>
      )}

      {showHint && (
        <div className="hint-box">
          <p>{problem.hints[hintLevel]}</p>
          {hintLevel < problem.hints.length - 1 && (
            <button onClick={() => setHintLevel(h => h + 1)}>
              다음 힌트
            </button>
          )}
        </div>
      )}

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
```

### CSS 스타일
```css
.interactive-problem {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.problem-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  padding: 24px;
  margin-bottom: 20px;
  animation: fadeIn 0.3s ease;
}

.answer-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.choice {
  padding: 16px 20px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.choice:hover {
  border-color: #1976d2;
  background: #e3f2fd;
}

.choice.selected {
  border-color: #1976d2;
  background: #1976d2;
  color: white;
}

.feedback {
  padding: 16px;
  border-radius: 8px;
  margin-top: 16px;
  animation: slideIn 0.3s ease;
}

.feedback.correct {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #4caf50;
}

.feedback.incorrect {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #f44336;
}

.hint-box {
  background: #fff3e0;
  border-left: 4px solid #ff9800;
  padding: 16px;
  margin-top: 16px;
  border-radius: 0 8px 8px 0;
}

.progress-bar {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  margin-top: 24px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4caf50, #8bc34a);
  transition: width 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}
```

## 적용 예시

```json
{
  "style": "interactive_style",
  "config": {
    "hints_enabled": true,
    "max_hints": 3,
    "hint_penalty": 0.1,
    "retry_allowed": true,
    "max_attempts": 3,
    "show_progress": true,
    "animation": true,
    "sound_effects": false,
    "achievements": true
  }
}
```
