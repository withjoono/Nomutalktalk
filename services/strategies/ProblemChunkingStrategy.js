/**
 * 문제 청킹 전략
 *
 * 기출문제, 논술, 면접 등 문제 중심 문서의 청킹
 * - 문제 1개 + 해설 + 정답 = 1 청크
 * - 관련 그림/표는 문제 청크에 포함
 * - 하위 문항이 있는 경우 함께 묶음
 */

class ProblemChunkingStrategy {
  constructor(geminiClient) {
    this.gemini = geminiClient;
    this.model = 'gemini-2.5-flash-preview-05-20';
  }

  /**
   * 문제 기반 청킹 실행
   * @param {string} content - 원본 텍스트 내용
   * @param {Object} options - 청킹 옵션
   * @returns {Array} - 청크 배열
   */
  async chunk(content, options = {}) {
    const {
      documentType = 'csat_past',
      metadata = {},
      includeSubProblems = true
    } = options;

    const chunks = [];

    try {
      // 1. 문제 경계 감지
      const problems = await this.detectProblems(content, documentType);

      // 2. 각 문제를 청크로 변환
      for (let i = 0; i < problems.length; i++) {
        const problem = problems[i];
        const chunk = this.createProblemChunk(problem, i, documentType, metadata);
        chunks.push(chunk);
      }

    } catch (error) {
      console.error('Problem chunking error:', error);
      // 오류 시 기본 청킹 적용
      const fallbackChunks = this.fallbackChunking(content, options);
      return fallbackChunks;
    }

    return chunks;
  }

  /**
   * 문제 경계 감지
   */
  async detectProblems(content, documentType) {
    const prompt = this.getDetectionPrompt(documentType, content);

    try {
      const response = await this.gemini.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16384
        }
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.problems || [];
      }

    } catch (error) {
      console.error('Problem detection error:', error);
    }

    // 오류 시 기본 문제 감지
    return this.basicProblemDetection(content);
  }

  /**
   * 문서 유형별 감지 프롬프트 생성
   */
  getDetectionPrompt(documentType, content) {
    const basePrompt = `다음 내용에서 각각의 문제를 분리하고 구성 요소를 추출해주세요.

문제 번호, 문제 내용, 선택지, 정답, 해설을 각각 추출합니다.
하위 문항(소문항)이 있는 경우 함께 묶어주세요.

내용:
${content}

`;

    const typeSpecificInstructions = {
      'csat_past': `수능 기출문제 형식입니다.
- 문제 번호 패턴: 1., 2., ... 또는 [1], [2], ...
- 선택지: ①②③④⑤ 또는 ㄱ,ㄴ,ㄷ
- 정답과 해설이 별도로 있을 수 있습니다.`,

      'csat_mock': `모의고사 기출문제 형식입니다.
- 문제 번호 패턴: 1., 2., ... 또는 [1], [2], ...
- 선택지: ①②③④⑤
- 정답과 해설이 별도로 있을 수 있습니다.`,

      'school_exam': `내신 기출문제 형식입니다.
- 문제 번호 패턴: 1., 2., ... 또는 문제 1, 문제 2
- 객관식 또는 서술형
- 배점 정보가 있을 수 있습니다.`,

      'university_essay': `대학별 수리논술 문제 형식입니다.
- 문제 번호 패턴: [문제 1], 1., 1-1, 1-2 등
- 소문항이 있는 경우 (1), (2), (가), (나) 등
- 풀이 과정이 중요합니다.
- 채점 기준이 있을 수 있습니다.`,

      'university_interview': `대학별 심층면접 질문 형식입니다.
- 질문 번호: Q1, 질문1, [질문] 등
- 꼬리 질문이 연속될 수 있습니다.
- 모범 답변이 있을 수 있습니다.`
    };

    const instructions = typeSpecificInstructions[documentType] || '';

    return basePrompt + instructions + `

다음 JSON 형식으로만 응답해주세요:
{
  "problems": [
    {
      "number": "문제 번호 (예: 1, 1-1, Q1)",
      "text": "문제 텍스트 전체",
      "choices": ["①선택지1", "②선택지2", ...],
      "subProblems": [
        { "number": "(1)", "text": "소문항 텍스트" }
      ],
      "answer": "정답 (예: ③, 42, 풀이 과정)",
      "solution": "해설 또는 풀이",
      "score": "배점 (있는 경우)",
      "gradingCriteria": "채점 기준 (있는 경우)",
      "images": ["이미지 설명1"],
      "tables": ["표 설명1"],
      "difficulty": "상/중/하 (추정)",
      "concepts": ["관련 개념1", "관련 개념2"]
    }
  ]
}`;
  }

  /**
   * 기본 문제 감지 (폴백)
   */
  basicProblemDetection(content) {
    const problems = [];

    // 일반적인 문제 번호 패턴
    const patterns = [
      /(?:^|\n)\s*(\d+)\.\s*/gm,  // 1. 2. 3.
      /(?:^|\n)\s*\[(\d+)\]\s*/gm, // [1] [2] [3]
      /(?:^|\n)\s*문제\s*(\d+)/gm, // 문제 1, 문제 2
      /(?:^|\n)\s*Q(\d+)/gim      // Q1, Q2
    ];

    let matches = [];
    for (const pattern of patterns) {
      const found = [...content.matchAll(pattern)];
      if (found.length > matches.length) {
        matches = found;
      }
    }

    if (matches.length === 0) {
      // 문제 패턴이 없으면 전체를 하나의 문제로
      return [{
        number: '1',
        text: content,
        choices: [],
        subProblems: [],
        answer: '',
        solution: '',
        images: [],
        tables: []
      }];
    }

    // 매칭된 위치 기준으로 분할
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i < matches.length - 1 ? matches[i + 1].index : content.length;
      const problemText = content.substring(start, end).trim();

      problems.push({
        number: matches[i][1] || `${i + 1}`,
        text: problemText,
        choices: this.extractChoices(problemText),
        subProblems: [],
        answer: '',
        solution: '',
        images: [],
        tables: []
      });
    }

    return problems;
  }

  /**
   * 선택지 추출
   */
  extractChoices(text) {
    const choices = [];

    // ①②③④⑤ 패턴
    const circlePattern = /([①②③④⑤])\s*([^①②③④⑤\n]+)/g;
    let match;
    while ((match = circlePattern.exec(text)) !== null) {
      choices.push(`${match[1]} ${match[2].trim()}`);
    }

    if (choices.length > 0) return choices;

    // ㄱ. ㄴ. ㄷ. 패턴
    const jamo = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ'];
    for (const j of jamo) {
      const pattern = new RegExp(`${j}\\.\\s*([^ㄱㄴㄷㄹㅁ\\n]+)`, 'g');
      while ((match = pattern.exec(text)) !== null) {
        choices.push(`${j}. ${match[1].trim()}`);
      }
    }

    return choices;
  }

  /**
   * 문제 청크 생성
   */
  createProblemChunk(problem, index, documentType, metadata) {
    // 청크 콘텐츠 포맷팅
    const content = this.formatProblemContent(problem, documentType);

    return {
      content: content,
      contentType: 'problem',
      documentType: documentType,
      index: index,
      problemData: {
        problemNumber: problem.number,
        problemText: problem.text,
        choices: problem.choices || [],
        subProblems: problem.subProblems || [],
        answer: problem.answer || '',
        solution: problem.solution || '',
        score: problem.score,
        gradingCriteria: problem.gradingCriteria,
        imageRefs: problem.images || [],
        tableRefs: problem.tables || [],
        difficulty: problem.difficulty,
        concepts: problem.concepts || []
      },
      inheritedMetadata: this.extractInheritedMetadata(metadata, documentType)
    };
  }

  /**
   * 문제 콘텐츠 포맷팅
   */
  formatProblemContent(problem, documentType) {
    const parts = [];

    // 문제 번호와 본문
    parts.push(`[문제 ${problem.number}]`);
    parts.push(problem.text);

    // 선택지 (있는 경우)
    if (problem.choices && problem.choices.length > 0) {
      parts.push('\n[선택지]');
      parts.push(problem.choices.join('\n'));
    }

    // 소문항 (있는 경우)
    if (problem.subProblems && problem.subProblems.length > 0) {
      parts.push('\n[소문항]');
      problem.subProblems.forEach(sub => {
        parts.push(`${sub.number} ${sub.text}`);
      });
    }

    // 정답
    if (problem.answer) {
      parts.push('\n[정답]');
      parts.push(problem.answer);
    }

    // 해설/풀이
    if (problem.solution) {
      parts.push('\n[해설]');
      parts.push(problem.solution);
    }

    // 채점 기준 (논술/면접)
    if (problem.gradingCriteria && (documentType === 'university_essay' || documentType === 'university_interview')) {
      parts.push('\n[채점 기준]');
      parts.push(problem.gradingCriteria);
    }

    // 배점 (있는 경우)
    if (problem.score) {
      parts.push(`\n[배점: ${problem.score}]`);
    }

    return parts.join('\n');
  }

  /**
   * 상속할 메타데이터 추출
   */
  extractInheritedMetadata(metadata, documentType) {
    const inherited = {};

    // 공통 메타데이터
    const commonKeys = ['domain', 'subject', 'curriculum', 'year'];
    for (const key of commonKeys) {
      if (metadata[key] !== undefined) {
        inherited[key] = metadata[key];
      }
    }

    // 문서 유형별 추가 메타데이터
    switch (documentType) {
      case 'csat_past':
      case 'csat_mock':
      case 'school_exam':
        const examKeys = ['examType', 'examInstitution', 'unit', 'difficulty', 'knowledgeType', 'zystoryUnit'];
        for (const key of examKeys) {
          if (metadata[key] !== undefined) {
            inherited[key] = metadata[key];
          }
        }
        break;

      case 'university_essay':
        const essayKeys = ['universityName', 'admissionType', 'department', 'problemType', 'units'];
        for (const key of essayKeys) {
          if (metadata[key] !== undefined) {
            inherited[key] = metadata[key];
          }
        }
        break;

      case 'university_interview':
        const interviewKeys = ['universityName', 'department', 'interviewType', 'evaluationCompetencies'];
        for (const key of interviewKeys) {
          if (metadata[key] !== undefined) {
            inherited[key] = metadata[key];
          }
        }
        break;
    }

    return inherited;
  }

  /**
   * 폴백 청킹 (오류 시)
   */
  fallbackChunking(content, options) {
    const { documentType = 'other', metadata = {} } = options;

    const problems = this.basicProblemDetection(content);
    const chunks = [];

    problems.forEach((problem, index) => {
      chunks.push(this.createProblemChunk(problem, index, documentType, metadata));
    });

    return chunks;
  }

  /**
   * 면접 질문 전용 청킹
   */
  async chunkInterviewQuestions(content, options = {}) {
    const { metadata = {} } = options;

    const prompt = `다음 면접 기출 내용에서 질문과 꼬리질문을 추출해주세요.

내용:
${content}

다음 JSON 형식으로 응답:
{
  "questionSets": [
    {
      "mainQuestion": "메인 질문",
      "followUpQuestions": ["꼬리질문1", "꼬리질문2"],
      "questionIntent": "질문 의도",
      "modelAnswer": "모범 답변 요약",
      "evaluationPoints": ["평가 포인트1", "평가 포인트2"],
      "deductionFactors": ["감점 요소1"]
    }
  ]
}`;

    try {
      const response = await this.gemini.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192
        }
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const questionSets = parsed.questionSets || [];

        return questionSets.map((qs, index) => ({
          content: this.formatInterviewContent(qs),
          contentType: 'problem',
          documentType: 'university_interview',
          index: index,
          problemData: {
            problemNumber: `Q${index + 1}`,
            problemText: qs.mainQuestion,
            followUpSequence: qs.followUpQuestions,
            questionIntent: qs.questionIntent,
            modelAnswer: qs.modelAnswer,
            evaluationPoints: qs.evaluationPoints,
            deductionFactors: qs.deductionFactors
          },
          inheritedMetadata: this.extractInheritedMetadata(metadata, 'university_interview')
        }));
      }

    } catch (error) {
      console.error('Interview question chunking error:', error);
    }

    // 폴백
    return this.fallbackChunking(content, { ...options, documentType: 'university_interview' });
  }

  /**
   * 면접 콘텐츠 포맷팅
   */
  formatInterviewContent(questionSet) {
    const parts = [];

    parts.push('[질문]');
    parts.push(questionSet.mainQuestion);

    if (questionSet.followUpQuestions && questionSet.followUpQuestions.length > 0) {
      parts.push('\n[꼬리질문]');
      questionSet.followUpQuestions.forEach((q, i) => {
        parts.push(`${i + 1}. ${q}`);
      });
    }

    if (questionSet.questionIntent) {
      parts.push('\n[출제 의도]');
      parts.push(questionSet.questionIntent);
    }

    if (questionSet.modelAnswer) {
      parts.push('\n[모범 답변]');
      parts.push(questionSet.modelAnswer);
    }

    if (questionSet.evaluationPoints && questionSet.evaluationPoints.length > 0) {
      parts.push('\n[평가 포인트]');
      questionSet.evaluationPoints.forEach(p => parts.push(`• ${p}`));
    }

    if (questionSet.deductionFactors && questionSet.deductionFactors.length > 0) {
      parts.push('\n[감점 요소]');
      questionSet.deductionFactors.forEach(f => parts.push(`• ${f}`));
    }

    return parts.join('\n');
  }
}

module.exports = ProblemChunkingStrategy;
