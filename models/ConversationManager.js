/**
 * 대화 상태 관리자
 * 세션 생성, 상태 추적, 컨텍스트 유지를 담당
 */

const { v4: uuidv4 } = require('uuid');

class ConversationManager {
  constructor() {
    // 메모리 기반 세션 저장소 (프로덕션에서는 Redis 등 사용)
    this.sessions = new Map();
    this.sessionTimeout = 30 * 60 * 1000; // 30분
  }

  /**
   * 새 세션 생성
   * @param {string} userId - 사용자 ID (선택)
   * @returns {Object} 세션 정보
   */
  createSession(userId = null) {
    const sessionId = uuidv4();
    const session = {
      sessionId,
      userId,
      stage: 'diagnosis', // diagnosis, analysis, solution, followup
      category: null,
      context: {
        issue: null,
        details: {},
        laws: [],
        cases: [],
        solutions: [],
        conversationHistory: []
      },
      metadata: {
        startTime: new Date(),
        lastUpdate: new Date(),
        turnCount: 0
      }
    };

    this.sessions.set(sessionId, session);
    
    // 세션 타임아웃 설정
    setTimeout(() => {
      this.deleteSession(sessionId);
    }, this.sessionTimeout);

    return session;
  }

  /**
   * 세션 조회
   * @param {string} sessionId
   * @returns {Object|null}
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // 세션 업데이트
    session.metadata.lastUpdate = new Date();
    return session;
  }

  /**
   * 세션 업데이트
   * @param {string} sessionId
   * @param {Object} updates
   * @returns {Object|null}
   */
  updateSession(sessionId, updates) {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    // 얕은 복사로 업데이트
    Object.assign(session, updates);
    session.metadata.lastUpdate = new Date();
    
    return session;
  }

  /**
   * 대화 단계 업데이트
   * @param {string} sessionId
   * @param {string} newStage
   * @returns {Object|null}
   */
  updateStage(sessionId, newStage) {
    const validStages = ['diagnosis', 'analysis', 'solution', 'followup'];
    if (!validStages.includes(newStage)) {
      throw new Error(`Invalid stage: ${newStage}`);
    }

    return this.updateSession(sessionId, { stage: newStage });
  }

  /**
   * 메시지 추가
   * @param {string} sessionId
   * @param {string} role - 'user' | 'ai'
   * @param {string} content
   * @param {Object} metadata - 추가 메타데이터
   * @returns {Object|null}
   */
  addMessage(sessionId, role, content, metadata = {}) {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const message = {
      role,
      content,
      timestamp: new Date(),
      ...metadata
    };

    session.context.conversationHistory.push(message);
    session.metadata.turnCount++;

    return session;
  }

  /**
   * 컨텍스트 조회
   * @param {string} sessionId
   * @returns {Object|null}
   */
  getContext(sessionId) {
    const session = this.getSession(sessionId);
    return session ? session.context : null;
  }

  /**
   * 컨텍스트 업데이트
   * @param {string} sessionId
   * @param {Object} contextUpdates
   * @returns {Object|null}
   */
  updateContext(sessionId, contextUpdates) {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    Object.assign(session.context, contextUpdates);
    return session;
  }

  /**
   * 카테고리 설정
   * @param {string} sessionId
   * @param {string} category
   * @returns {Object|null}
   */
  setCategory(sessionId, category) {
    return this.updateSession(sessionId, { category });
  }

  /**
   * 사용자 의도 분석
   * @param {string} message
   * @returns {Object} 분석 결과
   */
  analyzeUserIntent(message) {
    const lowerMessage = message.toLowerCase();

    // 카테고리 키워드 매칭
    const categoryKeywords = {
      '임금': ['임금', '급여', '월급', '연봉', '체불', '퇴직금', '수당', '못받'],
      '해고징계': ['해고', '징계', '정리해고', '권고사직', '퇴사', '사직', '면직'],
      '근로시간': ['근로시간', '연장근로', '야간', '주말근무', '휴게시간', '52시간'],
      '휴가휴직': ['연차', '휴가', '휴직', '출산', '육아', '병가'],
      '근로계약': ['계약', '계약서', '채용', '시용기간', '근로조건'],
      '산재보험': ['산재', '재해', '업무상', '요양', '다쳤', '부상'],
      '고용보험': ['실업급여', '고용보험', '실직'],
      '차별': ['차별', '성차별', '비정규직', '불합리'],
      '노동조합': ['노조', '단체교섭', '쟁의', '부당노동행위'],
      '안전보건': ['안전', '보건', '작업환경', '건강검진']
    };

    let detectedCategory = null;
    let maxScore = 0;

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.filter(kw => lowerMessage.includes(kw)).length;
      if (score > maxScore) {
        maxScore = score;
        detectedCategory = category;
      }
    }

    // 긴급도 판단
    const urgencyKeywords = ['급해', '긴급', '당장', '빨리', '오늘', '내일', '곧'];
    const isUrgent = urgencyKeywords.some(kw => lowerMessage.includes(kw));

    // 감정 분석
    const negativeKeywords = ['힘들', '어렵', '괴롭', '억울', '답답', '화나'];
    const hasNegativeEmotion = negativeKeywords.some(kw => lowerMessage.includes(kw));

    return {
      category: detectedCategory,
      isUrgent,
      hasNegativeEmotion,
      confidence: maxScore > 0 ? 'high' : 'low'
    };
  }

  /**
   * 다음 단계 결정
   * @param {string} currentStage
   * @param {Object} context
   * @returns {string} 다음 단계
   */
  determineNextStage(currentStage, context) {
    const stageFlow = {
      'diagnosis': 'analysis',
      'analysis': 'solution',
      'solution': 'followup',
      'followup': 'followup' // 후속 질문은 반복 가능
    };

    // 충분한 정보가 수집되었는지 확인
    if (currentStage === 'diagnosis') {
      // 카테고리와 기본 정보가 있으면 분석 단계로
      if (context.category && Object.keys(context.details).length >= 2) {
        return 'analysis';
      }
      return 'diagnosis';
    }

    if (currentStage === 'analysis') {
      // 법령과 쟁점이 파악되면 해결책 단계로
      if (context.laws.length > 0) {
        return 'solution';
      }
      return 'analysis';
    }

    if (currentStage === 'solution') {
      // 해결책이 제시되면 후속 단계로
      if (context.solutions.length > 0) {
        return 'followup';
      }
      return 'solution';
    }

    return stageFlow[currentStage] || currentStage;
  }

  /**
   * 세션 삭제
   * @param {string} sessionId
   * @returns {boolean}
   */
  deleteSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  /**
   * 세션 요약 생성
   * @param {string} sessionId
   * @returns {Object|null}
   */
  generateSessionSummary(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      return null;
    }

    const { context, metadata } = session;
    const messages = context.conversationHistory;

    return {
      sessionId,
      category: session.category,
      stage: session.stage,
      duration: new Date() - metadata.startTime,
      turnCount: metadata.turnCount,
      issue: context.issue,
      laws: context.laws,
      solutions: context.solutions,
      messageCount: messages.length
    };
  }

  /**
   * 모든 활성 세션 조회
   * @returns {Array}
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * 세션 수 조회
   * @returns {number}
   */
  getSessionCount() {
    return this.sessions.size;
  }
}

// 싱글톤 인스턴스
let instance = null;

module.exports = {
  ConversationManager,
  getInstance: () => {
    if (!instance) {
      instance = new ConversationManager();
    }
    return instance;
  }
};
