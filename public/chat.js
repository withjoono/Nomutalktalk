// 대화형 노무 AI 챗봇 클라이언트

let sessionId = null;
let isWaitingResponse = false;

const API_BASE_URL = window.location.origin;

// DOM 요소
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const welcomeScreen = document.getElementById('welcome-screen');
const stageStatus = document.getElementById('stage-status');
const sessionInfo = document.getElementById('session-info');
const sessionIdDisplay = document.getElementById('session-id-display');
const quickActions = document.getElementById('quick-actions');

// 초기화
document.addEventListener('DOMContentLoaded', () => {
  initializeChat();
  setupEventListeners();
});

/**
 * 채팅 초기화
 */
async function initializeChat() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/session/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const data = await response.json();
    
    if (data.success) {
      sessionId = data.data.sessionId;
      sessionIdDisplay.textContent = sessionId.substring(0, 8) + '...';
      sessionInfo.style.display = 'flex';
      
      // 입력 활성화
      userInput.disabled = false;
      sendButton.disabled = false;
      userInput.focus();

      console.log('세션 생성 완료:', sessionId);
    } else {
      showError('세션 생성에 실패했습니다: ' + data.error);
    }
  } catch (error) {
    showError('서버 연결에 실패했습니다: ' + error.message);
  }
}

/**
 * 이벤트 리스너 설정
 */
function setupEventListeners() {
  // Enter 키로 전송 (Shift+Enter는 줄바꿈)
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // 자동 높이 조절
  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
  });
}

/**
 * 메시지 전송
 */
async function sendMessage() {
  const message = userInput.value.trim();
  
  if (!message || isWaitingResponse) {
    return;
  }

  if (!sessionId) {
    showError('세션이 없습니다. 페이지를 새로고침해주세요.');
    return;
  }

  // 환영 화면 숨기기
  if (welcomeScreen) {
    welcomeScreen.style.display = 'none';
  }

  // 사용자 메시지 표시
  addMessage('user', message);

  // 입력 필드 초기화
  userInput.value = '';
  userInput.style.height = 'auto';
  userInput.disabled = true;
  sendButton.disabled = true;
  isWaitingResponse = true;

  // 타이핑 인디케이터 표시
  showTypingIndicator();

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        message
      })
    });

    const data = await response.json();

    // 타이핑 인디케이터 제거
    hideTypingIndicator();

    if (data.success) {
      const aiResponse = data.data;
      
      // AI 응답 표시
      addMessage('ai', aiResponse.message, {
        stage: aiResponse.stage,
        nextStage: aiResponse.nextStage,
        category: aiResponse.category
      });

      // 단계 표시 업데이트
      updateStageIndicator(aiResponse.nextStage || aiResponse.stage);

      // 카테고리 표시
      if (aiResponse.category && aiResponse.stage === 'diagnosis') {
        updateCategoryDisplay(aiResponse.category);
      }

    } else {
      addMessage('ai', `오류: ${data.error}`, { isError: true });
    }

  } catch (error) {
    hideTypingIndicator();
    addMessage('ai', `서버 오류: ${error.message}`, { isError: true });
  } finally {
    // 입력 필드 재활성화
    userInput.disabled = false;
    sendButton.disabled = false;
    isWaitingResponse = false;
    userInput.focus();
  }
}

/**
 * 메시지 추가
 */
function addMessage(role, content, metadata = {}) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  // 마크다운 스타일 간단 변환
  const formattedContent = formatMessageContent(content);
  contentDiv.innerHTML = formattedContent;

  const metaDiv = document.createElement('div');
  metaDiv.className = 'message-meta';
  const now = new Date();
  const timeString = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  
  if (metadata.stage) {
    const stageNames = {
      'diagnosis': '진단',
      'analysis': '법적 분석',
      'solution': '대안 제안',
      'followup': '후속 질문'
    };
    metaDiv.innerHTML = `${timeString} <span class="stage-indicator ${metadata.stage}">${stageNames[metadata.stage] || metadata.stage}</span>`;
  } else {
    metaDiv.textContent = timeString;
  }

  messageDiv.appendChild(avatar);
  const contentWrapper = document.createElement('div');
  contentWrapper.appendChild(contentDiv);
  contentWrapper.appendChild(metaDiv);
  messageDiv.appendChild(contentWrapper);

  chatMessages.appendChild(messageDiv);
  
  // 스크롤 하단으로
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * 메시지 내용 포맷팅
 */
function formatMessageContent(content) {
  return content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // **bold**
    .replace(/\*(.+?)\*/g, '<em>$1</em>') // *italic*
    .replace(/\n/g, '<br>') // 줄바꿈
    .replace(/(\d+)\.\s/g, '<br>$1. ') // 숫자 리스트
    .replace(/^- /gm, '<br>• ') // 불릿 리스트
    .replace(/```(.+?)```/gs, '<pre><code>$1</code></pre>'); // 코드 블록
}

/**
 * 타이핑 인디케이터 표시
 */
function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.id = 'typing-indicator';
  typingDiv.className = 'message ai';
  typingDiv.innerHTML = `
    <div class="message-avatar">
      <i class="fas fa-robot"></i>
    </div>
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * 타이핑 인디케이터 제거
 */
function hideTypingIndicator() {
  const typingIndicator = document.getElementById('typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

/**
 * 단계 표시 업데이트
 */
function updateStageIndicator(stage) {
  const stageNames = {
    'diagnosis': '🔍 진단 단계',
    'analysis': '⚖️ 법적 분석',
    'solution': '💡 대안 제안',
    'followup': '❓ 후속 질문'
  };

  stageStatus.textContent = stageNames[stage] || stage;
  stageStatus.className = `stage-indicator ${stage}`;
  stageStatus.style.display = 'inline-block';
}

/**
 * 카테고리 표시 업데이트
 */
function updateCategoryDisplay(category) {
  // 간단한 알림으로 카테고리 표시
  const categoryDiv = document.createElement('div');
  categoryDiv.style.cssText = `
    background: #e3f2fd;
    color: #1976d2;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin: 1rem 0;
    text-align: center;
    font-size: 0.9rem;
  `;
  categoryDiv.innerHTML = `<i class="fas fa-tag"></i> 감지된 카테고리: <strong>${category}</strong>`;
  chatMessages.appendChild(categoryDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * 예시 질문 전송
 */
async function sendExampleQuery(query) {
  if (!sessionId) {
    await initializeChat();
  }
  userInput.value = query;
  sendMessage();
}

/**
 * 새 상담 시작
 */
async function startNewChat() {
  if (confirm('현재 상담을 종료하고 새로 시작하시겠습니까?')) {
    // 기존 세션 삭제 (선택적)
    if (sessionId) {
      try {
        await fetch(`${API_BASE_URL}/api/chat/session/${sessionId}`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.error('세션 삭제 오류:', error);
      }
    }

    // 페이지 새로고침
    location.reload();
  }
}

/**
 * 오류 표시
 */
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    background: #ffebee;
    color: #c62828;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem;
    text-align: center;
  `;
  errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
  
  if (welcomeScreen && welcomeScreen.style.display !== 'none') {
    welcomeScreen.appendChild(errorDiv);
  } else {
    chatMessages.appendChild(errorDiv);
  }
}

/**
 * 빠른 액션 버튼 추가 (향후 확장용)
 */
function addQuickActions(actions) {
  quickActions.innerHTML = '';
  quickActions.style.display = 'flex';

  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = 'quick-action-btn';
    btn.textContent = action.label;
    btn.onclick = () => {
      userInput.value = action.value;
      sendMessage();
    };
    quickActions.appendChild(btn);
  });
}
