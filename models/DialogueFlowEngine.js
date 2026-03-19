/**
 * 대화 흐름 엔진
 * 진단 → 법적 분석 → 대안 제안 → 후속 질문 흐름을 자동으로 관리
 */

const { dialogueTemplates, systemPrompts } = require('./dialogueTemplates');
const { LaborMetadataBuilder } = require('./laborSchemas');

class DialogueFlowEngine {
  constructor(conversationManager, ragAgent) {
    this.conversationManager = conversationManager;
    this.ragAgent = ragAgent;
  }

  /**
   * 사용자 메시지 처리 (메인 엔트리 포인트)
   * @param {string} sessionId
   * @param {string} userMessage
   * @returns {Promise<Object>} 응답 객체
   */
  async processMessage(sessionId, userMessage) {
    const session = this.conversationManager.getSession(sessionId);
    if (!session) {
      throw new Error('세션을 찾을 수 없습니다.');
    }

    // 사용자 메시지 저장
    this.conversationManager.addMessage(sessionId, 'user', userMessage);

    // 현재 단계에 따라 처리
    const currentStage = session.stage;
    let response;

    switch (currentStage) {
      case 'diagnosis':
        response = await this.handleDiagnosisStage(sessionId, userMessage);
        break;
      case 'analysis':
        response = await this.handleAnalysisStage(sessionId, userMessage);
        break;
      case 'solution':
        response = await this.handleSolutionStage(sessionId, userMessage);
        break;
      case 'followup':
        response = await this.handleFollowupStage(sessionId, userMessage);
        break;
      default:
        response = { content: '알 수 없는 단계입니다.', stage: currentStage };
    }

    // AI 응답 저장
    this.conversationManager.addMessage(sessionId, 'ai', response.content, {
      stage: response.stage,
      nextStage: response.nextStage
    });

    return response;
  }

  /**
   * 진단 단계 처리
   * @param {string} sessionId
   * @param {string} userMessage
   * @returns {Promise<Object>}
   */
  async handleDiagnosisStage(sessionId, userMessage) {
    const session = this.conversationManager.getSession(sessionId);
    const context = session.context;

    // 첫 메시지인 경우
    if (context.conversationHistory.length <= 1) {
      // 사용자 의도 분석
      const intent = this.conversationManager.analyzeUserIntent(userMessage);
      
      // 카테고리 설정
      const category = intent.category || '기타';
      this.conversationManager.setCategory(sessionId, category);
      this.conversationManager.updateContext(sessionId, { issue: userMessage });

      // 템플릿 가져오기
      const template = dialogueTemplates[category];
      
      // 초기 질문 생성
      let responseContent = this.generateEmpathyResponse(intent) + '\n\n';
      responseContent += template.diagnosis.initialQuestion;

      return {
        content: responseContent,
        stage: 'diagnosis',
        nextStage: 'diagnosis',
        category: category,
        intent: intent
      };
    }

    // 정보 수집 진행
    const category = session.category || '기타';
    const template = dialogueTemplates[category];
    
    // 정보 추출 및 저장
    await this.extractAndSaveDetails(sessionId, userMessage, category);

    // 필요한 정보가 모두 수집되었는지 확인
    const missingFields = this.checkMissingFields(context.details, template.diagnosis.requiredFields);

    if (missingFields.length > 0) {
      // 추가 질문
      const nextQuestion = this.getNextDiagnosisQuestion(category, context.details, template);
      return {
        content: '네, 알겠습니다. ' + nextQuestion,
        stage: 'diagnosis',
        nextStage: 'diagnosis',
        missingFields: missingFields
      };
    } else {
      // 진단 완료 → 법적 분석 단계로
      this.conversationManager.updateStage(sessionId, 'analysis');
      
      const transitionMessage = '\n\n정보 감사합니다. 지금부터 법적으로 분석해드리겠습니다...';
      
      // 법적 분석 수행
      const analysisResponse = await this.performLegalAnalysis(sessionId);
      
      return {
        content: transitionMessage + '\n\n' + analysisResponse,
        stage: 'diagnosis',
        nextStage: 'analysis'
      };
    }
  }

  /**
   * 법적 분석 단계 처리
   * @param {string} sessionId
   * @param {string} userMessage
   * @returns {Promise<Object>}
   */
  async handleAnalysisStage(sessionId, userMessage) {
    const session = this.conversationManager.getSession(sessionId);
    
    // 사용자가 추가 질문을 했거나, 분석 결과에 대한 확인을 요청하는 경우
    if (this.isRequestingMoreInfo(userMessage)) {
      // 추가 분석 수행
      const additionalAnalysis = await this.performAdditionalAnalysis(sessionId, userMessage);
      return {
        content: additionalAnalysis,
        stage: 'analysis',
        nextStage: 'analysis'
      };
    }

    // 분석 완료 → 해결 방안 단계로
    this.conversationManager.updateStage(sessionId, 'solution');
    
    const transitionMessage = '\n\n법적 분석을 바탕으로 구체적인 해결 방법을 안내해드리겠습니다...';
    const solutionResponse = await this.provideSolutions(sessionId);

    return {
      content: transitionMessage + '\n\n' + solutionResponse,
      stage: 'analysis',
      nextStage: 'solution'
    };
  }

  /**
   * 해결 방안 단계 처리
   * @param {string} sessionId
   * @param {string} userMessage
   * @returns {Promise<Object>}
   */
  async handleSolutionStage(sessionId, userMessage) {
    const session = this.conversationManager.getSession(sessionId);
    
    // 특정 해결 방법에 대한 상세 질문인 경우
    if (this.isAskingForDetailedSolution(userMessage)) {
      const detailedSolution = await this.provideDetailedSolution(sessionId, userMessage);
      return {
        content: detailedSolution,
        stage: 'solution',
        nextStage: 'solution'
      };
    }

    // 해결 방안 제시 완료 → 후속 질문 단계로
    this.conversationManager.updateStage(sessionId, 'followup');
    
    const followupResponse = this.generateFollowupQuestions(sessionId);

    return {
      content: '\n\n' + followupResponse,
      stage: 'solution',
      nextStage: 'followup'
    };
  }

  /**
   * 후속 질문 단계 처리
   * @param {string} sessionId
   * @param {string} userMessage
   * @returns {Promise<Object>}
   */
  async handleFollowupStage(sessionId, userMessage) {
    const session = this.conversationManager.getSession(sessionId);
    const lowerMessage = userMessage.toLowerCase();

    // 새로운 주제를 시작하려는 경우
    if (this.isStartingNewTopic(userMessage)) {
      // 새 세션으로 리다이렉트 제안
      return {
        content: '새로운 상담을 시작하시겠어요? 새로운 문제에 대해 처음부터 다시 상담해드리겠습니다.',
        stage: 'followup',
        nextStage: 'diagnosis',
        suggestion: 'new_session'
      };
    }

    // 감사 인사 또는 종료 의사
    if (this.isEndingConversation(userMessage)) {
      const summary = this.conversationManager.generateSessionSummary(sessionId);
      return {
        content: '도움이 되셨길 바랍니다. 언제든 다시 문의해주세요!\n\n혹시 다른 법률 문제가 있으시면 언제든 말씀해주세요.',
        stage: 'followup',
        nextStage: 'complete',
        summary: summary
      };
    }

    // 관련 후속 질문에 답변
    const followupAnswer = await this.answerFollowupQuestion(sessionId, userMessage);

    return {
      content: followupAnswer + '\n\n다른 궁금한 점이 있으신가요?',
      stage: 'followup',
      nextStage: 'followup'
    };
  }

  /**
   * 공감 응답 생성
   * @param {Object} intent
   * @returns {string}
   */
  generateEmpathyResponse(intent) {
    const empathyPhrases = {
      urgent: '급하게 도움이 필요하시군요. 최대한 빠르게 도와드리겠습니다.',
      negative: '힘든 상황이시네요. 함께 해결 방법을 찾아보겠습니다.',
      default: '상담 요청 감사합니다. 정확한 도움을 드리기 위해 몇 가지 여쭤보겠습니다.'
    };

    if (intent.isUrgent) return empathyPhrases.urgent;
    if (intent.hasNegativeEmotion) return empathyPhrases.negative;
    return empathyPhrases.default;
  }

  /**
   * 정보 추출 및 저장 (간단한 키워드 매칭 + RAG)
   * @param {string} sessionId
   * @param {string} message
   * @param {string} category
   */
  async extractAndSaveDetails(sessionId, message, category) {
    const context = this.conversationManager.getContext(sessionId);
    const details = context.details;

    // 카테고리별 정보 추출 패턴
    const patterns = {
      임금: {
        체불기간: /(\d+)\s*(개월|달|month)/i,
        체불금액: /(\d+)\s*(만원|원|만)/i,
        재직상태: /(재직|퇴사|그만)/i,
        회사규모: /(\d+)인/i
      },
      해고징계: {
        해고일자: /(\d{4}[-./]\d{1,2}[-./]\d{1,2})/,
        해고사유: /.+/,
        근무기간: /(\d+)\s*(년|개월)/i,
        고용형태: /(정규직|계약직|비정규직|파견|용역)/i
      },
      근로시간: {
        일일근로시간: /(\d+)\s*시간/i,
        주당근로시간: /(\d+)\s*시간/i,
        연장근로여부: /(연장|야근|초과)/i
      },
      휴가휴직: {
        입사일: /(\d{4}[-./]\d{1,2}[-./]\d{1,2})/,
        근무기간: /(\d+)\s*(년|개월)/i,
        연차발생일수: /(\d+)\s*(일|개)/i,
        연차사용일수: /(\d+)\s*(일|개)/i
      }
    };

    const categoryPatterns = patterns[category] || {};

    // 패턴 매칭으로 정보 추출
    for (const [field, pattern] of Object.entries(categoryPatterns)) {
      if (!details[field]) {
        const match = message.match(pattern);
        if (match) {
          details[field] = match[0];
        }
      }
    }

    // 추가: 전체 메시지를 기타정보로 저장
    if (!details['기타정보']) {
      details['기타정보'] = message;
    } else {
      details['기타정보'] += ' | ' + message;
    }

    this.conversationManager.updateContext(sessionId, { details });
  }

  /**
   * 필수 필드 확인
   * @param {Object} details
   * @param {Array} requiredFields
   * @returns {Array} 누락된 필드
   */
  checkMissingFields(details, requiredFields) {
    if (!requiredFields) return [];
    return requiredFields.filter(field => !details[field]);
  }

  /**
   * 다음 진단 질문 가져오기
   * @param {string} category
   * @param {Object} details
   * @param {Object} template
   * @returns {string}
   */
  getNextDiagnosisQuestion(category, details, template) {
    const followupQuestions = template.diagnosis.followupQuestions;
    
    // 아직 답변되지 않은 질문 찾기
    for (const question of followupQuestions) {
      // 간단한 키워드 매칭으로 질문과 답변 연결
      const answered = Object.values(details).some(value => 
        value && value.toString().length > 0
      );
      
      // 순서대로 질문 (실제로는 더 정교한 로직 필요)
      if (Object.keys(details).length < followupQuestions.length) {
        return followupQuestions[Object.keys(details).length - 1];
      }
    }

    return '추가로 알려주실 사항이 있으신가요?';
  }

  /**
   * 법적 분석 수행
   * @param {string} sessionId
   * @returns {Promise<string>}
   */
  async performLegalAnalysis(sessionId) {
    const session = this.conversationManager.getSession(sessionId);
    const category = session.category || '기타';
    const template = dialogueTemplates[category];
    const context = session.context;

    // 프롬프트 템플릿에 컨텍스트 정보 삽입
    let prompt = template.analysis.promptTemplate;
    for (const [key, value] of Object.entries(context.details)) {
      const placeholder = `{${key}}`;
      prompt = prompt.replace(placeholder, value || '정보 없음');
    }

    // RAG Agent를 통한 법적 분석
    try {
      const systemPrompt = systemPrompts.analysis;
      const fullPrompt = `${systemPrompt}\n\n${prompt}`;
      
      const analysisResult = await this.ragAgent.askLabor(fullPrompt, { category });

      // 분석 결과를 컨텍스트에 저장
      this.conversationManager.updateContext(sessionId, {
        laws: this.extractLaws(analysisResult),
        analysisText: analysisResult
      });

      return analysisResult;
    } catch (error) {
      console.error('법적 분석 오류:', error);
      return `죄송합니다. 법적 분석 중 오류가 발생했습니다.\n\n${template.analysis.keyPoints.join('\n')}`;
    }
  }

  /**
   * 추가 분석 수행
   * @param {string} sessionId
   * @param {string} question
   * @returns {Promise<string>}
   */
  async performAdditionalAnalysis(sessionId, question) {
    const session = this.conversationManager.getSession(sessionId);
    const category = session.category || '기타';

    try {
      const systemPrompt = systemPrompts.analysis;
      const fullPrompt = `${systemPrompt}\n\n추가 질문: ${question}\n\n이전 분석 내용:\n${session.context.analysisText || '없음'}`;
      
      const additionalResult = await this.ragAgent.askLabor(fullPrompt, { category });
      return additionalResult;
    } catch (error) {
      console.error('추가 분석 오류:', error);
      return '죄송합니다. 추가 분석 중 오류가 발생했습니다. 다시 질문해주시겠어요?';
    }
  }

  /**
   * 해결 방안 제공
   * @param {string} sessionId
   * @returns {Promise<string>}
   */
  async provideSolutions(sessionId) {
    const session = this.conversationManager.getSession(sessionId);
    const category = session.category || '기타';
    const template = dialogueTemplates[category];

    let response = '**📋 해결 방법**\n\n';

    // 단계별 해결 방법
    template.solution.steps.forEach((step, index) => {
      response += `**${step.title}**\n`;
      response += `${step.description}\n`;
      response += `⏱ 소요 기간: ${step.timeframe}\n`;
      response += `✅ 장점: ${step.pros.join(', ')}\n`;
      if (step.cons.length > 0) {
        response += `⚠️ 단점: ${step.cons.join(', ')}\n`;
      }
      response += '\n';
    });

    // 권장 사항
    response += `**💡 권장 방법**\n${template.solution.recommendation}\n\n`;

    // 긴급 조치 사항
    response += `**🚨 즉시 해야 할 일**\n`;
    template.solution.urgentActions.forEach((action, index) => {
      response += `${index + 1}. ${action}\n`;
    });

    // 컨텍스트에 저장
    this.conversationManager.updateContext(sessionId, {
      solutions: template.solution.steps.map(s => s.title)
    });

    return response;
  }

  /**
   * 상세 해결 방안 제공
   * @param {string} sessionId
   * @param {string} question
   * @returns {Promise<string>}
   */
  async provideDetailedSolution(sessionId, question) {
    const session = this.conversationManager.getSession(sessionId);
    const category = session.category || '기타';

    try {
      const systemPrompt = systemPrompts.solution;
      const fullPrompt = `${systemPrompt}\n\n구체적인 질문: ${question}`;
      
      const detailedResult = await this.ragAgent.askLabor(fullPrompt, { category });
      return detailedResult;
    } catch (error) {
      console.error('상세 해결 방안 오류:', error);
      return '죄송합니다. 상세 정보 제공 중 오류가 발생했습니다. 다시 질문해주시겠어요?';
    }
  }

  /**
   * 후속 질문 생성
   * @param {string} sessionId
   * @returns {string}
   */
  generateFollowupQuestions(sessionId) {
    const session = this.conversationManager.getSession(sessionId);
    const category = session.category || '기타';
    const template = dialogueTemplates[category];

    let response = '**❓ 추가로 도움이 필요하신가요?**\n\n';
    
    template.followup.questions.forEach((question, index) => {
      response += `${index + 1}. ${question}\n`;
    });

    if (template.followup.relatedTopics.length > 0) {
      response += '\n**📚 관련 주제**\n';
      template.followup.relatedTopics.forEach((topic, index) => {
        response += `- ${topic}\n`;
      });
    }

    return response;
  }

  /**
   * 후속 질문에 답변
   * @param {string} sessionId
   * @param {string} question
   * @returns {Promise<string>}
   */
  async answerFollowupQuestion(sessionId, question) {
    const session = this.conversationManager.getSession(sessionId);
    const category = session.category || '기타';

    try {
      const systemPrompt = systemPrompts.followup;
      const fullPrompt = `${systemPrompt}\n\n후속 질문: ${question}`;
      
      const answer = await this.ragAgent.askLabor(fullPrompt, { category });
      return answer;
    } catch (error) {
      console.error('후속 질문 답변 오류:', error);
      return '죄송합니다. 답변 중 오류가 발생했습니다. 다시 질문해주시겠어요?';
    }
  }

  /**
   * 추가 정보 요청 여부 확인
   * @param {string} message
   * @returns {boolean}
   */
  isRequestingMoreInfo(message) {
    const keywords = ['자세히', '더', '추가', '구체적', '예를 들어', '설명', '알려'];
    return keywords.some(kw => message.includes(kw));
  }

  /**
   * 상세 해결책 요청 여부 확인
   * @param {string} message
   * @returns {boolean}
   */
  isAskingForDetailedSolution(message) {
    const keywords = ['어떻게', '방법', '절차', '서식', '양식', '작성', '신청'];
    return keywords.some(kw => message.includes(kw));
  }

  /**
   * 새 주제 시작 여부 확인
   * @param {string} message
   * @returns {boolean}
   */
  isStartingNewTopic(message) {
    const keywords = ['새로운', '다른 문제', '다른 상담', '추가 상담', '별개'];
    return keywords.some(kw => message.includes(kw));
  }

  /**
   * 대화 종료 의사 확인
   * @param {string} message
   * @returns {boolean}
   */
  isEndingConversation(message) {
    const keywords = ['감사', '고마워', '도움', '됐어', '충분', '끝', '종료', '알겠'];
    const lowerMessage = message.toLowerCase();
    return keywords.some(kw => lowerMessage.includes(kw)) && message.length < 20;
  }

  /**
   * 법령 추출 (간단한 패턴 매칭)
   * @param {string} text
   * @returns {Array}
   */
  extractLaws(text) {
    const lawPattern = /([가-힣]+법)\s*(제\d+조)/g;
    const matches = [...text.matchAll(lawPattern)];
    return matches.map(m => `${m[1]} ${m[2]}`);
  }
}

module.exports = DialogueFlowEngine;
