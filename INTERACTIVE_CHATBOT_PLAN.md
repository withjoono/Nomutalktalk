# 인터랙티브 대화형 노무 AI 챗봇 구현 계획

## 🎯 목표

기존 단발성 질의응답에서 **단계적 대화형 상담 시스템**으로 전환

### 대화 흐름
```
1단계: 진단 (Diagnosis)
   ↓
2단계: 법적 분석 (Legal Analysis)
   ↓
3단계: 대안 제안 (Solution Proposal)
   ↓
4단계: 후속 질문 (Follow-up)
   ↓
   (순환 또는 종료)
```

---

## 📋 시스템 설계

### 1. 대화 상태 관리

#### 상태 모델
```javascript
ConversationState {
  sessionId: string,           // 세션 ID
  stage: string,               // 현재 단계 (diagnosis/analysis/solution/followup)
  category: string,            // 카테고리 (임금, 해고 등)
  context: {
    issue: string,             // 문제 요약
    details: {},               // 수집된 정보
    laws: [],                  // 관련 법령
    cases: [],                 // 관련 판례
    solutions: [],             // 제안된 해결책
    conversationHistory: []    // 대화 기록
  },
  metadata: {
    startTime: timestamp,
    lastUpdate: timestamp,
    turnCount: number
  }
}
```

#### 단계별 정보 수집
```javascript
// 1단계: 진단
DiagnosisInfo {
  problemType: string,         // 문제 유형
  userRole: string,           // 사용자 역할 (근로자/사용자)
  urgency: string,            // 긴급도
  basicFacts: string[]        // 기본 사실관계
}

// 2단계: 법적 분석
AnalysisInfo {
  applicableLaws: [],         // 적용 법령
  relevantCases: [],          // 관련 판례
  legalIssues: [],            // 법적 쟁점
  strengthWeakness: {}        // 강점/약점 분석
}

// 3단계: 대안 제안
SolutionInfo {
  recommendedActions: [],     // 권장 조치
  alternativeOptions: [],     // 대안
  risks: [],                  // 리스크
  timeline: {}                // 처리 일정
}

// 4단계: 후속 질문
FollowupInfo {
  clarificationNeeded: [],    // 추가 확인 필요 사항
  nextSteps: [],              // 다음 단계
  relatedTopics: []           // 관련 주제
}
```

---

## 🔧 구현 계획

### Phase 1: 백엔드 - 대화 관리 시스템 (2-3일)

#### 1.1 ConversationManager 클래스
**파일**: `models/ConversationManager.js`

**주요 기능**:
- 세션 생성/관리
- 대화 상태 추적
- 컨텍스트 유지
- 단계 전환 로직

**메서드**:
```javascript
- createSession(userId)
- updateStage(sessionId, newStage)
- addMessage(sessionId, role, content)
- getContext(sessionId)
- analyzeUserIntent(message)
- determineNextStage(currentStage, userResponse)
```

#### 1.2 대화 흐름 엔진
**파일**: `services/DialogueFlowEngine.js`

**단계별 프롬프트 생성**:
```javascript
class DialogueFlowEngine {
  // 1단계: 진단 프롬프트
  generateDiagnosisPrompt(context) {
    return `
안녕하세요, 노무 AI입니다. 
어떤 문제로 상담을 원하시나요?

다음 중 하나를 선택하거나 직접 설명해주세요:
1. 💰 임금/퇴직금 문제
2. 🚪 해고/징계 문제
3. ⏰ 근로시간/휴가 문제
4. 🤝 근로계약/조건 문제
5. 🏥 산재/안전 문제
6. ⚖️  차별/부당대우 문제
7. 기타

또는 상황을 자유롭게 말씀해주세요.
    `;
  }

  // 2단계: 상세 정보 수집
  generateDetailPrompt(category, initialInfo) {
    // 카테고리별 맞춤 질문
  }

  // 3단계: 법적 분석 프롬프트
  generateAnalysisPrompt(context) {
    return `
수집된 정보를 바탕으로 법적 분석을 진행하겠습니다.

【상황 요약】
${context.issue}

【법적 검토 사항】
다음 정보를 확인하여 더 정확한 분석을 하겠습니다:
- 근무 기간은 얼마나 되셨나요?
- 서면으로 받은 문서가 있나요?
- 회사 규모는 어느 정도인가요? (상시근로자 수)

추가 정보를 알려주시면 더 정확한 법적 분석이 가능합니다.
    `;
  }

  // 4단계: 해결책 제시
  generateSolutionPrompt(analysis) {
    return `
【법적 분석 결과】
관련 법령: ${analysis.laws.join(', ')}
관련 판례: ${analysis.cases.length}개 발견

【권장 조치】
1. 즉시 조치: [...]
2. 단기 대응: [...]
3. 장기 전략: [...]

【주의사항】
[...]

다음 중 어떤 부분에 대해 더 자세히 알고 싶으신가요?
1. 법적 근거 상세 설명
2. 구체적 절차 안내
3. 예상 결과 및 소요 기간
4. 필요한 증거 자료
5. 전문가 도움이 필요한 경우
    `;
  }

  // 5단계: 후속 질문 생성
  generateFollowupPrompt(context) {
    // 대화 흐름에 따른 후속 질문
  }
}
```

#### 1.3 카테고리별 템플릿
**파일**: `models/dialogueTemplates.js`

```javascript
const DialogueTemplates = {
  // 임금 체불
  wage_unpaid: {
    diagnosis: [
      "체불된 임금의 종류는? (기본급/수당/퇴직금)",
      "체불 기간은 얼마나 되나요?",
      "체불 금액은 대략 얼마인가요?",
      "급여명세서나 근로계약서가 있나요?"
    ],
    analysis: {
      laws: ["근로기준법 제43조", "근로기준법 제36조"],
      commonIssues: ["지연이자", "형사처벌", "민사소송"],
      timeline: "3개월-6개월"
    },
    solutions: [
      {
        title: "내용증명 발송",
        difficulty: "쉬움",
        cost: "저렴",
        effectiveness: "중간",
        timeline: "1-2주"
      },
      {
        title: "노동청 진정",
        difficulty: "보통",
        cost: "무료",
        effectiveness: "높음",
        timeline: "1-3개월"
      },
      {
        title: "소액사건 소송",
        difficulty: "높음",
        cost: "중간",
        effectiveness: "높음",
        timeline: "3-6개월"
      }
    ]
  },

  // 부당해고
  dismissal: {
    diagnosis: [
      "해고 사유를 들으셨나요?",
      "해고 예고를 받으셨나요? (30일 전)",
      "서면으로 해고통지를 받으셨나요?",
      "근무 기간은 얼마나 되나요?",
      "해고 전 징계절차가 있었나요?"
    ],
    analysis: {
      laws: ["근로기준법 제23조", "근로기준법 제26조"],
      commonIssues: ["정당한 이유", "해고예고", "서면통지"],
      timeline: "3개월 이내 신청 필요"
    },
    solutions: [
      {
        title: "부당해고 구제신청 (노동위원회)",
        difficulty: "보통",
        cost: "무료",
        effectiveness: "높음",
        timeline: "3개월 (해고일로부터 3개월 이내 신청)"
      },
      {
        title: "해고무효 확인 소송",
        difficulty: "높음",
        cost: "높음",
        effectiveness: "높음",
        timeline: "6-12개월"
      }
    ]
  },

  // 근로시간
  worktime: {
    diagnosis: [
      "하루 평균 근무시간은?",
      "주말 근무가 있나요?",
      "연장/야간/휴일 수당을 받고 계신가요?",
      "근로계약서에 근로시간이 명시되어 있나요?",
      "출퇴근 기록이 있나요?"
    ],
    analysis: {
      laws: ["근로기준법 제50조", "근로기준법 제56조"],
      commonIssues: ["법정근로시간 초과", "수당 미지급", "포괄임금제"],
      timeline: "3년 소멸시효"
    },
    solutions: [
      {
        title: "임금체불 진정",
        difficulty: "쉬움",
        cost: "무료",
        effectiveness: "높음",
        timeline: "1-3개월"
      }
    ]
  }

  // ... 기타 카테고리
};
```

---

### Phase 2: API 엔드포인트 확장 (1일)

#### 2.1 대화형 API
**파일**: `server.js`

```javascript
// 새로운 세션 시작
POST /api/labor/chat/start
{
  userId?: string,
  initialMessage?: string
}
→ { sessionId, welcomeMessage, suggestedCategories }

// 메시지 전송
POST /api/labor/chat/message
{
  sessionId: string,
  message: string
}
→ { 
  response: string,
  currentStage: string,
  suggestedActions: [],
  relatedInfo: {}
}

// 대화 히스토리 조회
GET /api/labor/chat/history/:sessionId
→ { messages: [], context: {} }

// 대화 종료
POST /api/labor/chat/end
{
  sessionId: string
}
→ { summary: string, savedReport: boolean }

// 컨텍스트 기반 추천
GET /api/labor/chat/suggestions/:sessionId
→ { nextQuestions: [], relatedTopics: [] }
```

---

### Phase 3: 프론트엔드 - 채팅 UI (2-3일)

#### 3.1 채팅 인터페이스
**파일**: `public/labor_chat.html`

**UI 구성**:
```
┌─────────────────────────────────────┐
│  ⚖️  노무 AI 상담                    │
├─────────────────────────────────────┤
│                                     │
│  [AI] 안녕하세요! 어떤 문제로...    │
│                                     │
│       [User] 임금을 못 받았어요     │
│                                     │
│  [AI] 체불된 임금에 대해 상담...    │
│  💡 다음 정보가 필요합니다:         │
│     1. 체불 기간                    │
│     2. 체불 금액                    │
│     3. 증거 자료 유무               │
│                                     │
│  [빠른 답변]                        │
│  [3개월] [6개월] [1년 이상]         │
│                                     │
├─────────────────────────────────────┤
│  메시지 입력...              [전송]  │
└─────────────────────────────────────┘
```

**주요 기능**:
- 실시간 채팅
- 타이핑 인디케이터
- 빠른 답변 버튼
- 단계 진행 표시
- 대화 요약
- PDF 다운로드

#### 3.2 채팅 UI JavaScript
**파일**: `public/labor_chat.js`

```javascript
class LaborChatUI {
  constructor() {
    this.sessionId = null;
    this.currentStage = 'diagnosis';
    this.messages = [];
  }

  async startChat() {
    const response = await fetch('/api/labor/chat/start', {
      method: 'POST'
    });
    const data = await response.json();
    this.sessionId = data.sessionId;
    this.addMessage('ai', data.welcomeMessage);
    this.showQuickReplies(data.suggestedCategories);
  }

  async sendMessage(message) {
    // 사용자 메시지 표시
    this.addMessage('user', message);
    this.showTypingIndicator();

    // AI 응답 요청
    const response = await fetch('/api/labor/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        message: message
      })
    });

    const data = await response.json();
    this.hideTypingIndicator();
    
    // AI 응답 표시
    this.addMessage('ai', data.response);
    this.updateStage(data.currentStage);
    
    // 제안 액션 표시
    if (data.suggestedActions) {
      this.showQuickReplies(data.suggestedActions);
    }
  }

  addMessage(role, content) {
    const messageEl = this.createMessageElement(role, content);
    document.getElementById('chatMessages').appendChild(messageEl);
    this.scrollToBottom();
  }

  showQuickReplies(options) {
    const container = document.getElementById('quickReplies');
    container.innerHTML = options.map(opt => 
      `<button onclick="sendQuickReply('${opt}')">${opt}</button>`
    ).join('');
  }

  updateStage(stage) {
    this.currentStage = stage;
    this.updateProgressBar(stage);
  }

  updateProgressBar(stage) {
    const stages = ['diagnosis', 'analysis', 'solution', 'followup'];
    const progress = (stages.indexOf(stage) + 1) / stages.length * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;
  }
}
```

---

### Phase 4: 프롬프트 엔지니어링 (1-2일)

#### 4.1 단계별 시스템 프롬프트

**진단 단계**:
```javascript
const DIAGNOSIS_PROMPT = `
당신은 노동법 전문 상담사입니다. 상담자의 문제를 정확히 파악하는 것이 목표입니다.

【역할】
- 친절하고 공감적인 태도
- 핵심 정보 파악을 위한 질문
- 법률 용어 최소화, 쉬운 설명

【진단 프로세스】
1. 문제 유형 파악 (임금/해고/근로시간 등)
2. 긴급도 판단
3. 기본 사실관계 수집
4. 다음 단계로 자연스럽게 전환

【응답 형식】
- 공감 표현으로 시작
- 구체적인 질문 2-3개
- 빠른 답변 옵션 제시
`;

**분석 단계**:
```javascript
const ANALYSIS_PROMPT = `
수집된 정보를 바탕으로 법적 분석을 수행합니다.

【분석 항목】
1. 적용 가능한 법령
2. 관련 판례
3. 법적 쟁점
4. 강점/약점 분석

【응답 구조】
💡 핵심 분석
📖 관련 법령 (조문 명시)
⚖️  유사 판례
⚠️  주의사항
❓ 추가 확인 필요 사항

【톤】
- 전문적이지만 이해하기 쉽게
- 법적 근거 명확히 제시
- 현실적인 조언
`;

**해결책 단계**:
```javascript
const SOLUTION_PROMPT = `
실현 가능한 해결책을 단계적으로 제시합니다.

【해결책 제시 기준】
- 난이도 (쉬움/보통/어려움)
- 비용 (무료/저렴/중간/높음)
- 효과성 (낮음/중간/높음)
- 소요 시간
- 성공 가능성

【옵션 구조】
각 옵션마다:
1. 제목 및 개요
2. 구체적 절차 (단계별)
3. 필요한 서류/증거
4. 예상 결과
5. 장단점

【권장 순서】
1순위: 가장 현실적이고 효과적인 방법
2순위: 대안
3순위: 최후의 수단
`;

**후속 질문 단계**:
```javascript
const FOLLOWUP_PROMPT = `
상담 내용을 정리하고 추가 도움을 제공합니다.

【후속 지원】
1. 대화 요약
2. 제공된 해결책 재확인
3. 관련 추가 질문 유도
4. 다음 상담 약속

【마무리 옵션】
- 📄 상담 내용 PDF 다운로드
- 📧 이메일로 받기
- 🔄 새로운 상담 시작
- 💬 관련 주제 더 알아보기

【톤】
- 격려와 지지
- 명확한 다음 단계 안내
- 필요시 전문가 연결 권유
`;
```

---

### Phase 5: 컨텍스트 메모리 (1일)

#### 5.1 대화 히스토리 저장
**파일**: `services/ConversationStorage.js`

```javascript
class ConversationStorage {
  // Firebase/메모리 기반 저장
  
  async saveConversation(sessionId, conversation) {
    // 대화 전체 저장
  }

  async loadConversation(sessionId) {
    // 이전 대화 불러오기
  }

  async generateSummary(sessionId) {
    // AI로 대화 요약 생성
  }

  async exportToPDF(sessionId) {
    // PDF 상담 리포트 생성
  }
}
```

---

## 📊 구현 일정

### Week 1: 백엔드 (3-4일)
- Day 1-2: ConversationManager, DialogueFlowEngine
- Day 3: 카테고리별 템플릿
- Day 4: API 엔드포인트

### Week 2: 프론트엔드 (3-4일)
- Day 1-2: 채팅 UI 구현
- Day 3: 빠른 답변, 단계 표시
- Day 4: 대화 히스토리, PDF 다운로드

### Week 3: 통합 및 테스트 (2-3일)
- Day 1: 프롬프트 최적화
- Day 2: 테스트 및 버그 수정
- Day 3: 문서화

**총 예상 기간**: 2-3주

---

## 🎯 예상 대화 플로우 예시

### 시나리오: 임금 체불 상담

```
[1단계: 진단]
AI: 안녕하세요, 노무 AI입니다. 어떤 문제로 상담을 원하시나요?

User: 임금을 3개월째 못 받고 있어요.

AI: 힘드신 상황이시네요. 정확한 상담을 위해 몇 가지 여쭤보겠습니다.
    1. 체불된 임금의 종류는 무엇인가요? (기본급/수당/퇴직금)
    2. 회사에 임금 지급을 요청하셨나요?
    3. 근로계약서나 급여명세서가 있으신가요?

[빠른 답변] [기본급] [연장수당] [퇴직금]

User: 기본급이요. 요청했는데 계속 미루고 있어요.

[2단계: 법적 분석]
AI: 알겠습니다. 법적으로 분석해보겠습니다.

    💡 핵심 분석
    3개월 임금 체불은 근로기준법 위반으로 형사처벌 대상입니다.
    
    📖 관련 법령
    - 근로기준법 제43조: 임금은 매월 1회 이상 일정한 날짜에 지급
    - 근로기준법 제109조: 위반 시 3년 이하 징역 또는 3천만원 이하 벌금
    
    ⚖️  판례
    대법원 2020다12345: 3개월 이상 체불 시 고의성 인정
    
    ⚠️  주의사항
    - 임금채권 소멸시효: 3년
    - 지연이자: 연 20% 청구 가능
    
    추가로 확인이 필요한 사항:
    - 회사의 상시근로자 수는? (5인 이상/미만)
    - 체불 금액은 대략 얼마인가요?

User: 상시근로자 20명 정도이고, 약 600만원이요.

[3단계: 해결책 제시]
AI: 정보 감사합니다. 다음 해결 방법을 권장합니다:

    【권장 순서】
    
    1️⃣ 내용증명 발송 (즉시 가능)
    - 난이도: ⭐ 쉬움
    - 비용: 5천원 내외
    - 효과: 법적 절차 시작 통보
    - 기간: 1-2일
    ▶︎ 지금 바로 시작 가능한 방법입니다.
    
    2️⃣ 노동청 진정 (추천)
    - 난이도: ⭐⭐ 보통
    - 비용: 무료
    - 효과: ⭐⭐⭐ 높음 (80% 이상 해결)
    - 기간: 1-3개월
    - 필요서류: 근로계약서, 근무기록, 급여명세서
    ▶︎ 가장 효과적인 방법입니다.
    
    3️⃣ 소액사건 소송
    - 난이도: ⭐⭐⭐ 어려움
    - 비용: 10-30만원 (인지대 등)
    - 효과: ⭐⭐⭐ 높음
    - 기간: 3-6개월
    ▶︎ 노동청 진정이 실패할 경우 고려
    
    어떤 방법에 대해 더 자세히 알고 싶으신가요?

[빠른 답변] [내용증명] [노동청 진정] [소송절차] [모두 알려주세요]

User: 노동청 진정 절차를 자세히 알려주세요.

[4단계: 상세 안내]
AI: 노동청 진정 절차를 단계별로 안내드리겠습니다.

    【노동청 진정 절차】
    
    1단계: 서류 준비 (1-2일)
    ✓ 근로계약서 사본
    ✓ 급여명세서 (있다면)
    ✓ 근무기록 (출퇴근 기록, 카카오톡 등)
    ✓ 임금 요구 증거 (내용증명, 문자 등)
    
    2단계: 진정서 작성 및 제출 (1일)
    - 관할 지방노동청 방문 또는 온라인 제출
    - 온라인: 노동OK(www.nodong.kr)
    ▶︎ 진정서 양식 다운로드 가능
    
    3단계: 조사 (2-4주)
    - 노동청에서 회사 조사
    - 증거 자료 검토
    - 필요시 출석 요구
    
    4단계: 시정 지시 (1-2주)
    - 회사에 임금 지급 명령
    - 불이행 시 고발 조치
    
    5단계: 임금 수령
    - 대부분 이 단계에서 해결 (80%)
    
    💡 Tip
    - 노동청 방문 전 상담 전화: 1350
    - 무료 법률 상담: 대한법률구조공단 132
    
    바로 시작하시겠어요?

[빠른 답변] [진정서 양식 받기] [상담 예약] [추가 질문]

[5단계: 후속 질문]
User: 진정서 양식 받을게요.

AI: 좋습니다! 다음 정보를 제공해드립니다:
    
    📄 진정서 양식 다운로드
    - 노동OK: www.nodong.kr
    - 고용노동부: www.moel.go.kr
    
    📞 상담 연락처
    - 노동상담: 1350 (평일 9시-6시)
    - 관할 노동청: [지역 선택]
    
    오늘 상담 요약을 PDF로 다운로드하시겠어요?
    
[빠른 답변] [PDF 다운로드] [이메일 발송] [새 상담 시작]
```

---

## 🎨 UI/UX 개선사항

### 시각적 요소
1. **단계 진행 바**: 현재 단계 시각화
2. **말풍선 구분**: AI/사용자 구분 명확
3. **빠른 답변 버튼**: 클릭 한 번으로 답변
4. **타이핑 애니메이션**: AI가 생각하는 느낌
5. **스크롤 자동**: 새 메시지 자동 스크롤
6. **아이콘 활용**: 단계별 이모지

### 인터랙션
1. **음성 입력**: 음성으로 질문 (선택)
2. **파일 첨부**: 서류 업로드
3. **저장 기능**: 대화 저장
4. **공유 기능**: 상담 내용 공유

---

## 🧪 테스트 시나리오

### 시나리오 1: 임금 체불
- 입력: "임금을 못 받았어요"
- 예상: 진단 → 상세 수집 → 법적 분석 → 해결책

### 시나리오 2: 부당해고
- 입력: "갑자기 해고당했어요"
- 예상: 긴급도 판단 → 즉시 조치 → 구제 방법

### 시나리오 3: 복합 문제
- 입력: "해고도 당했고 임금도 못 받았어요"
- 예상: 우선순위 판단 → 순차 해결

---

## 📊 성공 지표

### 사용자 경험
- 평균 대화 턴 수: 5-10회
- 만족도: 4점 이상 (5점 만점)
- 문제 해결률: 70% 이상

### 시스템 성능
- 응답 시간: 3초 이내
- 컨텍스트 유지율: 95% 이상
- 오류율: 5% 미만

---

이 계획으로 진행하시겠습니까? 어떤 부분부터 시작할까요?
