/**
 * PanelController - 패널 제어 핵심 모듈
 * LLM 자연어 명령을 파싱하여 GridStack 패널 제어
 */
class PanelController {
  constructor(options = {}) {
    this.gridStack = options.gridStack || null;
    this.onError = options.onError || console.error;
    this.onSuccess = options.onSuccess || console.log;
    this.onCommand = options.onCommand || (() => {});

    // 패널 ID 매핑 (한글 이름 → 실제 ID)
    this.panelMapping = {
      '제시문': 'problem-statement-panel',
      '문제제시문': 'problem-statement-panel',
      '자료': 'resource-panel',
      '그림': 'resource-panel',
      '표': 'resource-panel',
      '이미지': 'resource-panel',
      '리소스': 'resource-panel',
      '보기': 'options-panel',
      '조건': 'options-panel',
      '배점': 'score-panel',
      '점수': 'score-panel',
      '선지': 'choices-panel',
      '답안': 'choices-panel',
      '지문': 'text-panel',
      '문제지문': 'text-panel',
      '텍스트': 'text-panel'
    };

    // 명령 패턴 정의
    this.commandPatterns = {
      resize: {
        patterns: [
          /(.+?)\s*(패널|창|윈도우)?\s*(크기|사이즈)\s*(를|을)?\s*(조정|변경|키워|줄여|확대|축소)/,
          /(.+?)\s*(패널|창)?\s*(2배|두배|3배|세배|반으로)/,
          /(.+?)\s*(패널|창)?\s*(\d+)\s*(배|%)/
        ],
        handler: 'handleResize'
      },
      move: {
        patterns: [
          /(.+?)\s*(패널|창)?\s*(를|을)?\s*(왼쪽|오른쪽|위|아래|상단|하단|좌측|우측)/,
          /(.+?)\s*(패널|창)?\s*(이동|옮겨|배치)/
        ],
        handler: 'handleMove'
      },
      show: {
        patterns: [
          /(.+?)\s*(패널|창)?\s*(를|을)?\s*(보여|표시|열어|펼쳐|확장)/,
          /(.+?)\s*(패널|창)?\s*열기/
        ],
        handler: 'handleShow'
      },
      hide: {
        patterns: [
          /(.+?)\s*(패널|창)?\s*(를|을)?\s*(숨겨|닫아|감춰|접어)/,
          /(.+?)\s*(패널|창)?\s*닫기/
        ],
        handler: 'handleHide'
      },
      insert: {
        patterns: [
          /(.+?)\s*(를|을)?\s*(.+?)\s*(패널|창)\s*(에|으로)?\s*(넣어|삽입|추가|표시)/,
          /(.+?)\s*(패널|창)\s*(에|으로)?\s*(.+?)\s*(넣어|삽입|추가)/
        ],
        handler: 'handleInsert'
      },
      generate: {
        patterns: [
          /(이미지|그림|표|차트)\s*(를|을)?\s*(생성|만들어|그려)/,
          /(생성|만들어|그려)\s*(.+?)?\s*(이미지|그림|표|차트)/
        ],
        handler: 'handleGenerate'
      },
      reset: {
        patterns: [
          /(레이아웃|패널|창)\s*(초기화|리셋|원래대로)/,
          /모든\s*(패널|창)\s*(초기화|리셋)/
        ],
        handler: 'handleReset'
      },
      lock: {
        patterns: [
          /(패널|창|레이아웃)\s*(잠금|고정)/,
          /(편집|드래그)\s*(잠금|비활성화)/
        ],
        handler: 'handleLock'
      },
      unlock: {
        patterns: [
          /(패널|창|레이아웃)\s*(잠금해제|해제)/,
          /(편집|드래그)\s*(활성화|허용)/
        ],
        handler: 'handleUnlock'
      }
    };
  }

  /**
   * GridStack 인스턴스 설정
   * @param {Object} gridStack - GridStack 인스턴스
   */
  setGridStack(gridStack) {
    this.gridStack = gridStack;
  }

  /**
   * 명령 파싱 및 실행
   * @param {string} command - 자연어 명령
   * @returns {Object} 실행 결과
   */
  parseAndExecute(command) {
    if (!command || !command.trim()) {
      return { success: false, message: '명령을 입력해주세요.' };
    }

    const normalizedCommand = command.trim().toLowerCase();

    // 각 명령 타입에 대해 패턴 매칭
    for (const [type, config] of Object.entries(this.commandPatterns)) {
      for (const pattern of config.patterns) {
        const match = normalizedCommand.match(pattern);
        if (match) {
          try {
            const result = this[config.handler](match, command);
            this.onCommand(type, result);
            return result;
          } catch (error) {
            this.onError(error.message);
            return { success: false, message: error.message };
          }
        }
      }
    }

    return {
      success: false,
      message: '인식할 수 없는 명령입니다. 다음과 같은 명령을 시도해보세요:\n- "자료 패널 크기를 키워줘"\n- "제시문을 왼쪽으로 이동해줘"\n- "레이아웃 초기화"'
    };
  }

  /**
   * 패널 이름에서 실제 ID 추출
   * @param {string} text - 텍스트
   * @returns {string|null} 패널 ID
   */
  extractPanelId(text) {
    const normalized = text.toLowerCase().trim();

    for (const [name, id] of Object.entries(this.panelMapping)) {
      if (normalized.includes(name)) {
        return id;
      }
    }

    return null;
  }

  /**
   * 크기 조정 핸들러
   */
  handleResize(match, originalCommand) {
    if (!this.gridStack) {
      throw new Error('GridStack이 초기화되지 않았습니다.');
    }

    const panelId = this.extractPanelId(match[1]);
    if (!panelId) {
      throw new Error(`패널을 찾을 수 없습니다: ${match[1]}`);
    }

    const element = document.getElementById(panelId)?.closest('.grid-stack-item');
    if (!element) {
      throw new Error(`패널 요소를 찾을 수 없습니다: ${panelId}`);
    }

    // 크기 배율 추출
    let scale = 1.5; // 기본값
    if (originalCommand.includes('2배') || originalCommand.includes('두배')) {
      scale = 2;
    } else if (originalCommand.includes('3배') || originalCommand.includes('세배')) {
      scale = 3;
    } else if (originalCommand.includes('반으로') || originalCommand.includes('줄여')) {
      scale = 0.5;
    } else if (originalCommand.includes('키워') || originalCommand.includes('확대')) {
      scale = 1.5;
    }

    const currentW = parseInt(element.getAttribute('gs-w')) || 2;
    const currentH = parseInt(element.getAttribute('gs-h')) || 2;

    const newW = Math.max(1, Math.min(4, Math.round(currentW * scale)));
    const newH = Math.max(1, Math.min(4, Math.round(currentH * scale)));

    this.gridStack.update(element, { w: newW, h: newH });

    this.onSuccess(`패널 크기가 ${newW}x${newH}로 조정되었습니다.`);
    return { success: true, message: `패널 크기 조정 완료`, panelId, newSize: { w: newW, h: newH } };
  }

  /**
   * 이동 핸들러
   */
  handleMove(match, originalCommand) {
    if (!this.gridStack) {
      throw new Error('GridStack이 초기화되지 않았습니다.');
    }

    const panelId = this.extractPanelId(match[1]);
    if (!panelId) {
      throw new Error(`패널을 찾을 수 없습니다: ${match[1]}`);
    }

    const element = document.getElementById(panelId)?.closest('.grid-stack-item');
    if (!element) {
      throw new Error(`패널 요소를 찾을 수 없습니다: ${panelId}`);
    }

    let newX = parseInt(element.getAttribute('gs-x')) || 0;
    let newY = parseInt(element.getAttribute('gs-y')) || 0;

    // 방향 추출
    if (originalCommand.includes('왼쪽') || originalCommand.includes('좌측')) {
      newX = 0;
    } else if (originalCommand.includes('오른쪽') || originalCommand.includes('우측')) {
      newX = 2;
    }

    if (originalCommand.includes('위') || originalCommand.includes('상단')) {
      newY = 0;
    } else if (originalCommand.includes('아래') || originalCommand.includes('하단')) {
      newY = 2;
    }

    this.gridStack.update(element, { x: newX, y: newY });

    this.onSuccess(`패널이 이동되었습니다.`);
    return { success: true, message: '패널 이동 완료', panelId, newPosition: { x: newX, y: newY } };
  }

  /**
   * 표시 핸들러
   */
  handleShow(match) {
    const panelId = this.extractPanelId(match[1]);
    if (!panelId) {
      throw new Error(`패널을 찾을 수 없습니다: ${match[1]}`);
    }

    const element = document.getElementById(panelId)?.closest('.grid-stack-item');
    if (element) {
      element.style.display = 'block';
      this.onSuccess('패널이 표시되었습니다.');
      return { success: true, message: '패널 표시 완료', panelId };
    }

    throw new Error('패널 요소를 찾을 수 없습니다.');
  }

  /**
   * 숨김 핸들러
   */
  handleHide(match) {
    const panelId = this.extractPanelId(match[1]);
    if (!panelId) {
      throw new Error(`패널을 찾을 수 없습니다: ${match[1]}`);
    }

    const element = document.getElementById(panelId)?.closest('.grid-stack-item');
    if (element) {
      element.style.display = 'none';
      this.onSuccess('패널이 숨겨졌습니다.');
      return { success: true, message: '패널 숨김 완료', panelId };
    }

    throw new Error('패널 요소를 찾을 수 없습니다.');
  }

  /**
   * 삽입 핸들러 (콘텐츠를 패널에 삽입)
   */
  handleInsert(match, originalCommand) {
    // 이 핸들러는 외부에서 콜백으로 처리해야 함
    return {
      success: true,
      action: 'insert',
      message: '삽입 명령 감지',
      raw: originalCommand
    };
  }

  /**
   * 생성 핸들러 (이미지/표/차트 생성)
   */
  handleGenerate(match, originalCommand) {
    let contentType = 'image';
    if (originalCommand.includes('표')) {
      contentType = 'table';
    } else if (originalCommand.includes('차트')) {
      contentType = 'chart';
    }

    return {
      success: true,
      action: 'generate',
      contentType,
      message: `${contentType} 생성 명령 감지`,
      raw: originalCommand
    };
  }

  /**
   * 초기화 핸들러
   */
  handleReset() {
    if (typeof window.resetGridLayout === 'function') {
      window.resetGridLayout(true); // skipConfirm=true for programmatic calls
      this.onSuccess('레이아웃이 초기화되었습니다.');
      return { success: true, message: '레이아웃 초기화 완료' };
    }

    throw new Error('레이아웃 초기화 함수를 찾을 수 없습니다.');
  }

  /**
   * 잠금 핸들러
   */
  handleLock() {
    if (!this.gridStack) {
      throw new Error('GridStack이 초기화되지 않았습니다.');
    }

    this.gridStack.enableMove(false);
    this.gridStack.enableResize(false);
    this.onSuccess('레이아웃이 잠금되었습니다.');
    return { success: true, message: '레이아웃 잠금 완료' };
  }

  /**
   * 잠금해제 핸들러
   */
  handleUnlock() {
    if (!this.gridStack) {
      throw new Error('GridStack이 초기화되지 않았습니다.');
    }

    this.gridStack.enableMove(true);
    this.gridStack.enableResize(true);
    this.onSuccess('레이아웃 잠금이 해제되었습니다.');
    return { success: true, message: '레이아웃 잠금해제 완료' };
  }

  /**
   * 특정 패널에 콘텐츠 설정
   * @param {string} panelId - 패널 ID
   * @param {string} content - HTML 콘텐츠
   */
  setContent(panelId, content) {
    const panel = document.getElementById(panelId);
    if (!panel) {
      throw new Error(`패널을 찾을 수 없습니다: ${panelId}`);
    }

    // 콘텐츠 영역 찾기
    const contentArea = panel.querySelector('.panel-body, .panel-content, textarea, [contenteditable]');
    if (contentArea) {
      if (contentArea.tagName === 'TEXTAREA') {
        contentArea.value = content;
      } else if (contentArea.hasAttribute('contenteditable')) {
        contentArea.innerHTML = content;
      } else {
        contentArea.innerHTML = content;
      }
      return true;
    }

    panel.innerHTML = content;
    return true;
  }

  /**
   * 특정 패널의 콘텐츠 가져오기
   * @param {string} panelId - 패널 ID
   * @returns {string} 콘텐츠
   */
  getContent(panelId) {
    const panel = document.getElementById(panelId);
    if (!panel) {
      return '';
    }

    const contentArea = panel.querySelector('.panel-body, .panel-content, textarea, [contenteditable]');
    if (contentArea) {
      return contentArea.tagName === 'TEXTAREA' ? contentArea.value : contentArea.innerHTML;
    }

    return panel.innerHTML;
  }

  /**
   * 이미지를 패널에 삽입
   * @param {string} panelId - 패널 ID
   * @param {string} imageUrl - 이미지 URL
   * @param {Object} options - 옵션 (width, height, alt)
   */
  insertImage(panelId, imageUrl, options = {}) {
    const { width = 'auto', height = 'auto', alt = '생성된 이미지' } = options;

    const imgHtml = `<img src="${imageUrl}" alt="${alt}" style="max-width: 100%; width: ${width}; height: ${height};">`;
    this.setContent(panelId, imgHtml);

    this.onSuccess('이미지가 패널에 삽입되었습니다.');
  }
}

// 모듈 내보내기
if (typeof window !== 'undefined') {
  window.PanelController = PanelController;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PanelController;
}
