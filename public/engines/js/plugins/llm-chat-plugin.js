/**
 * LLMChatPlugin - 멀티탭 LLM 채팅 플러그인
 * 병렬 LLM 대화 세션 관리 및 패널 제어 통합
 */
class LLMChatPlugin {
  constructor(options = {}) {
    this.tabs = [];
    this.activeTabIndex = 0;
    this.maxTabs = options.maxTabs || 5;
    this.panelController = options.panelController || null;
    this.onError = options.onError || console.error;
    this.onSuccess = options.onSuccess || console.log;
    this.onTabChange = options.onTabChange || (() => {});
    this.onMessageReceived = options.onMessageReceived || (() => {});

    // 기본 첫 번째 탭 생성
    this.createTab();
  }

  /**
   * PanelController 설정
   * @param {PanelController} controller - 패널 컨트롤러 인스턴스
   */
  setPanelController(controller) {
    this.panelController = controller;
  }

  /**
   * 새 탭 생성
   * @param {Object} options - 탭 옵션
   * @returns {Object} 생성된 탭 정보
   */
  createTab(options = {}) {
    if (this.tabs.length >= this.maxTabs) {
      this.onError(`최대 ${this.maxTabs}개의 탭만 생성할 수 있습니다.`);
      return null;
    }

    const tabId = `chat-tab-${Date.now()}`;
    const tabIndex = this.tabs.length;

    const newTab = {
      id: tabId,
      index: tabIndex,
      name: options.name || `채팅 ${tabIndex + 1}`,
      engine: options.engine || 'gemini-2.0-flash',
      messages: [],
      context: options.context || '',
      createdAt: new Date().toISOString()
    };

    this.tabs.push(newTab);
    this.activeTabIndex = tabIndex;
    this.onTabChange(tabIndex, newTab);

    return newTab;
  }

  /**
   * 탭 전환
   * @param {number} index - 탭 인덱스
   * @returns {Object|null} 활성화된 탭
   */
  switchTab(index) {
    if (index < 0 || index >= this.tabs.length) {
      this.onError('유효하지 않은 탭 인덱스입니다.');
      return null;
    }

    this.activeTabIndex = index;
    this.onTabChange(index, this.tabs[index]);
    return this.tabs[index];
  }

  /**
   * 탭 닫기
   * @param {number} index - 닫을 탭 인덱스
   * @returns {boolean} 성공 여부
   */
  closeTab(index) {
    if (this.tabs.length <= 1) {
      this.onError('최소 1개의 탭은 유지해야 합니다.');
      return false;
    }

    if (index < 0 || index >= this.tabs.length) {
      this.onError('유효하지 않은 탭 인덱스입니다.');
      return false;
    }

    this.tabs.splice(index, 1);

    // 탭 인덱스 재조정
    this.tabs.forEach((tab, i) => {
      tab.index = i;
    });

    // 활성 탭 조정
    if (this.activeTabIndex >= this.tabs.length) {
      this.activeTabIndex = this.tabs.length - 1;
    }

    this.onTabChange(this.activeTabIndex, this.tabs[this.activeTabIndex]);
    return true;
  }

  /**
   * 현재 활성 탭 반환
   * @returns {Object} 활성 탭
   */
  getActiveTab() {
    return this.tabs[this.activeTabIndex] || null;
  }

  /**
   * 모든 탭 반환
   * @returns {Array} 탭 목록
   */
  getAllTabs() {
    return this.tabs;
  }

  /**
   * 현재 탭에 메시지 전송
   * @param {string} message - 사용자 메시지
   * @returns {Promise<Object>} LLM 응답
   */
  async sendMessage(message) {
    const tab = this.getActiveTab();
    if (!tab) {
      throw new Error('활성 탭이 없습니다.');
    }

    // 사용자 메시지 추가
    tab.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    try {
      // 패널 제어 명령 감지
      if (this.panelController) {
        const panelCommand = this.detectPanelCommand(message);
        if (panelCommand.isCommand) {
          const result = this.panelController.parseAndExecute(message);
          if (result.success) {
            const assistantMessage = {
              role: 'assistant',
              content: `명령을 실행했습니다: ${result.message}`,
              timestamp: new Date().toISOString(),
              panelAction: result
            };
            tab.messages.push(assistantMessage);
            this.onMessageReceived(tab.id, assistantMessage);
            return { success: true, response: assistantMessage.content, panelAction: result };
          }
        }
      }

      // LLM API 호출
      const response = await this.callLLMAPI(tab, message);

      // 어시스턴트 메시지 추가
      const assistantMessage = {
        role: 'assistant',
        content: response.content || response.response,
        timestamp: new Date().toISOString()
      };
      tab.messages.push(assistantMessage);
      this.onMessageReceived(tab.id, assistantMessage);

      // 응답에서 패널 제어 명령 추출 및 실행
      if (this.panelController && response.panelCommands) {
        for (const cmd of response.panelCommands) {
          this.panelController.parseAndExecute(cmd);
        }
      }

      return { success: true, response: assistantMessage.content };
    } catch (error) {
      this.onError(error.message);
      throw error;
    }
  }

  /**
   * 패널 제어 명령 감지
   * @param {string} message - 메시지
   * @returns {Object} 감지 결과
   */
  detectPanelCommand(message) {
    const panelKeywords = [
      '패널', '창', '크기', '이동', '옮겨', '키워', '줄여',
      '열어', '닫아', '숨겨', '보여', '초기화', '레이아웃'
    ];

    const isCommand = panelKeywords.some(keyword => message.includes(keyword));
    return { isCommand, message };
  }

  /**
   * LLM API 호출
   * @param {Object} tab - 탭 객체
   * @param {string} message - 메시지
   * @returns {Promise<Object>} API 응답
   */
  async callLLMAPI(tab, message) {
    const response = await fetch('/api/llm/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        engine: tab.engine,
        context: tab.context,
        history: tab.messages.slice(-10) // 최근 10개 메시지만 컨텍스트로
      })
    });

    const data = await response.json();

    if (data.success) {
      return data;
    } else {
      throw new Error(data.error || 'LLM 호출 실패');
    }
  }

  /**
   * 모든 탭에 동일 메시지 전송 (병렬)
   * @param {string} message - 메시지
   * @returns {Promise<Array>} 각 탭의 응답
   */
  async sendToAllTabs(message) {
    const promises = this.tabs.map(async (tab, index) => {
      const originalIndex = this.activeTabIndex;
      this.activeTabIndex = index;

      try {
        const result = await this.sendMessage(message);
        return { tabId: tab.id, tabName: tab.name, ...result };
      } catch (error) {
        return { tabId: tab.id, tabName: tab.name, success: false, error: error.message };
      } finally {
        this.activeTabIndex = originalIndex;
      }
    });

    return Promise.all(promises);
  }

  /**
   * 탭 이름 변경
   * @param {number} index - 탭 인덱스
   * @param {string} name - 새 이름
   */
  renameTab(index, name) {
    if (index >= 0 && index < this.tabs.length) {
      this.tabs[index].name = name;
    }
  }

  /**
   * 탭 엔진 변경
   * @param {number} index - 탭 인덱스
   * @param {string} engine - 엔진 이름
   */
  setTabEngine(index, engine) {
    if (index >= 0 && index < this.tabs.length) {
      this.tabs[index].engine = engine;
    }
  }

  /**
   * 탭 컨텍스트 설정
   * @param {number} index - 탭 인덱스
   * @param {string} context - 컨텍스트
   */
  setTabContext(index, context) {
    if (index >= 0 && index < this.tabs.length) {
      this.tabs[index].context = context;
    }
  }

  /**
   * 탭 대화 내역 초기화
   * @param {number} index - 탭 인덱스
   */
  clearTabHistory(index) {
    if (index >= 0 && index < this.tabs.length) {
      this.tabs[index].messages = [];
    }
  }

  /**
   * 탭 간 메시지 복사
   * @param {number} fromIndex - 소스 탭
   * @param {number} toIndex - 대상 탭
   * @param {number} messageIndex - 메시지 인덱스 (-1이면 마지막)
   */
  copyMessageBetweenTabs(fromIndex, toIndex, messageIndex = -1) {
    const fromTab = this.tabs[fromIndex];
    const toTab = this.tabs[toIndex];

    if (!fromTab || !toTab) {
      this.onError('유효하지 않은 탭입니다.');
      return;
    }

    const msgIdx = messageIndex === -1 ? fromTab.messages.length - 1 : messageIndex;
    const message = fromTab.messages[msgIdx];

    if (message) {
      toTab.messages.push({ ...message, copiedFrom: fromTab.name });
      this.onSuccess(`메시지가 "${toTab.name}" 탭으로 복사되었습니다.`);
    }
  }

  /**
   * 탭 내보내기 (JSON)
   * @param {number} index - 탭 인덱스
   * @returns {string} JSON 문자열
   */
  exportTab(index) {
    const tab = this.tabs[index];
    if (!tab) return null;

    return JSON.stringify({
      name: tab.name,
      engine: tab.engine,
      messages: tab.messages,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }

  /**
   * 탭 가져오기 (JSON)
   * @param {string} jsonData - JSON 문자열
   * @returns {Object} 생성된 탭
   */
  importTab(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      const newTab = this.createTab({ name: data.name || '가져온 채팅', engine: data.engine });

      if (newTab && data.messages) {
        newTab.messages = data.messages;
      }

      return newTab;
    } catch (error) {
      this.onError(`탭 가져오기 실패: ${error.message}`);
      return null;
    }
  }

  /**
   * UI 렌더링 (탭 버튼)
   * @param {HTMLElement} container - 컨테이너 요소
   */
  renderTabs(container) {
    container.innerHTML = '';

    this.tabs.forEach((tab, index) => {
      const tabBtn = document.createElement('button');
      tabBtn.className = `chat-tab ${index === this.activeTabIndex ? 'active' : ''}`;
      tabBtn.dataset.index = index;
      tabBtn.innerHTML = `
        <span class="tab-name">${tab.name}</span>
        ${this.tabs.length > 1 ? '<span class="tab-close" data-action="close">&times;</span>' : ''}
      `;

      tabBtn.addEventListener('click', (e) => {
        if (e.target.dataset.action === 'close') {
          this.closeTab(index);
          this.renderTabs(container);
        } else {
          this.switchTab(index);
          this.renderTabs(container);
        }
      });

      container.appendChild(tabBtn);
    });

    // 새 탭 버튼
    if (this.tabs.length < this.maxTabs) {
      const addBtn = document.createElement('button');
      addBtn.className = 'chat-tab add-tab';
      addBtn.innerHTML = '+';
      addBtn.title = '새 채팅 탭 추가';
      addBtn.addEventListener('click', () => {
        this.createTab();
        this.renderTabs(container);
      });
      container.appendChild(addBtn);
    }
  }

  /**
   * 메시지 목록 렌더링
   * @param {HTMLElement} container - 컨테이너 요소
   */
  renderMessages(container) {
    const tab = this.getActiveTab();
    if (!tab) {
      container.innerHTML = '<p class="no-messages">채팅을 시작하세요.</p>';
      return;
    }

    container.innerHTML = tab.messages.map(msg => `
      <div class="chat-message ${msg.role}">
        <div class="message-content">${this.formatMessage(msg.content)}</div>
        <div class="message-time">${new Date(msg.timestamp).toLocaleTimeString('ko-KR')}</div>
      </div>
    `).join('');

    container.scrollTop = container.scrollHeight;
  }

  /**
   * 메시지 포맷팅
   * @param {string} content - 원본 내용
   * @returns {string} 포맷된 HTML
   */
  formatMessage(content) {
    // 간단한 마크다운 변환
    return content
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
}

// 모듈 내보내기
if (typeof window !== 'undefined') {
  window.LLMChatPlugin = LLMChatPlugin;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LLMChatPlugin;
}
