/**
 * 개념 청킹 전략
 *
 * 교과서, 부교재 등 개념 중심 문서의 청킹
 * - 한 문장 또는 그림/표 + 캡션이 하나의 청크
 * - 정의, 정리, 법칙은 개별 청크
 * - 관련 예제는 개념에 포함 가능
 */

class ConceptChunkingStrategy {
  constructor(geminiClient) {
    this.gemini = geminiClient;
    this.model = 'gemini-2.5-flash-preview-05-20';
  }

  /**
   * 개념 기반 청킹 실행
   * @param {string} content - 원본 텍스트 내용
   * @param {Object} options - 청킹 옵션
   * @returns {Array} - 청크 배열
   */
  async chunk(content, options = {}) {
    const {
      documentType = 'textbook',
      metadata = {},
      maxTokensPerChunk = 512,
      minTokensPerChunk = 50,
      preserveStructure = true
    } = options;

    const chunks = [];

    try {
      // 1. 의미 단위로 분할
      const segments = await this.detectSemanticBoundaries(content);

      let chunkIndex = 0;

      for (const segment of segments) {
        // 2. 세그먼트 유형에 따라 청크 생성
        const segmentChunks = await this.processSegment(segment, {
          maxTokensPerChunk,
          minTokensPerChunk,
          preserveStructure,
          startIndex: chunkIndex
        });

        // 3. 메타데이터 상속
        segmentChunks.forEach(chunk => {
          chunk.documentType = documentType;
          chunk.inheritedMetadata = this.extractInheritedMetadata(metadata);
        });

        chunks.push(...segmentChunks);
        chunkIndex += segmentChunks.length;
      }

    } catch (error) {
      console.error('Concept chunking error:', error);
      // 오류 시 기본 청킹 적용
      const fallbackChunks = this.fallbackChunking(content, options);
      return fallbackChunks;
    }

    return chunks;
  }

  /**
   * 의미 단위 경계 감지
   */
  async detectSemanticBoundaries(content) {
    const prompt = `다음 교과서 내용을 의미 단위로 분리해주세요.
각 단위는 하나의 완결된 개념, 정의, 정리, 또는 설명이어야 합니다.

분리 기준:
1. 정의 (definition): "~는 ~이다", "~를 ~라 한다" 형태
2. 정리/법칙 (theorem): "정리:", "법칙:", 공식 설명
3. 설명 (explanation): 개념에 대한 부연 설명
4. 예제 (example): "예제", "예시", 풀이가 포함된 문제
5. 그림/표 (figure/table): [그림], [표], 캡션이 있는 시각 자료
6. 확인문제 (exercise): 연습 문제, 확인 문제

내용:
${content}

다음 JSON 형식으로만 응답해주세요:
{
  "segments": [
    {
      "content": "세그먼트 내용",
      "type": "definition|theorem|explanation|example|figure|table|exercise|general",
      "title": "세그먼트 제목 (있는 경우)",
      "relatedConcepts": ["관련 개념1", "관련 개념2"]
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
        return parsed.segments || [];
      }

    } catch (error) {
      console.error('Semantic boundary detection error:', error);
    }

    // 오류 시 기본 분할
    return this.basicSplit(content);
  }

  /**
   * 기본 텍스트 분할 (폴백)
   */
  basicSplit(content) {
    const segments = [];
    const paragraphs = content.split(/\n\n+/);

    for (const para of paragraphs) {
      if (para.trim()) {
        segments.push({
          content: para.trim(),
          type: 'general',
          title: '',
          relatedConcepts: []
        });
      }
    }

    return segments;
  }

  /**
   * 세그먼트 처리 및 청크 생성
   */
  async processSegment(segment, options) {
    const { maxTokensPerChunk, minTokensPerChunk, preserveStructure, startIndex } = options;
    const chunks = [];

    const tokenCount = this.estimateTokens(segment.content);

    // 토큰 수가 적절한 경우 그대로 청크로 생성
    if (tokenCount <= maxTokensPerChunk && tokenCount >= minTokensPerChunk) {
      chunks.push(this.createConceptChunk(segment, startIndex));
    }
    // 토큰 수가 너무 많은 경우 분할
    else if (tokenCount > maxTokensPerChunk) {
      const splitChunks = await this.splitLargeSegment(segment, maxTokensPerChunk, startIndex);
      chunks.push(...splitChunks);
    }
    // 토큰 수가 너무 적은 경우 - 일단 그대로 유지 (나중에 병합 가능)
    else {
      chunks.push(this.createConceptChunk(segment, startIndex));
    }

    return chunks;
  }

  /**
   * 큰 세그먼트 분할
   */
  async splitLargeSegment(segment, maxTokens, startIndex) {
    const chunks = [];
    const content = segment.content;
    const sentences = this.splitIntoSentences(content);

    let currentChunk = '';
    let chunkIndex = startIndex;

    for (const sentence of sentences) {
      const combined = currentChunk + (currentChunk ? ' ' : '') + sentence;
      const combinedTokens = this.estimateTokens(combined);

      if (combinedTokens > maxTokens && currentChunk) {
        // 현재 청크 저장
        chunks.push({
          content: currentChunk.trim(),
          contentType: 'concept',
          index: chunkIndex++,
          conceptData: {
            conceptTitle: segment.title || '',
            relatedConcepts: segment.relatedConcepts || [],
            segmentType: segment.type
          }
        });
        currentChunk = sentence;
      } else {
        currentChunk = combined;
      }
    }

    // 마지막 청크
    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        contentType: 'concept',
        index: chunkIndex,
        conceptData: {
          conceptTitle: segment.title || '',
          relatedConcepts: segment.relatedConcepts || [],
          segmentType: segment.type
        }
      });
    }

    return chunks;
  }

  /**
   * 문장 단위 분할
   */
  splitIntoSentences(content) {
    // 한국어/영어 문장 종결 패턴
    const sentencePattern = /(?<=[.!?。])\s+|(?<=\n)/g;
    const sentences = content.split(sentencePattern).filter(s => s.trim());
    return sentences;
  }

  /**
   * 개념 청크 생성
   */
  createConceptChunk(segment, index) {
    return {
      content: segment.content,
      contentType: this.mapSegmentTypeToContentType(segment.type),
      index: index,
      conceptData: {
        conceptTitle: segment.title || '',
        relatedConcepts: segment.relatedConcepts || [],
        segmentType: segment.type
      }
    };
  }

  /**
   * 세그먼트 유형을 콘텐츠 유형으로 매핑
   */
  mapSegmentTypeToContentType(segmentType) {
    const mapping = {
      'definition': 'concept',
      'theorem': 'concept',
      'explanation': 'concept',
      'example': 'problem',
      'exercise': 'problem',
      'figure': 'figure',
      'table': 'table',
      'general': 'concept'
    };
    return mapping[segmentType] || 'concept';
  }

  /**
   * 토큰 수 추정 (간단한 근사)
   */
  estimateTokens(text) {
    if (!text) return 0;
    // 한국어: 대략 글자 수 / 2
    // 영어: 대략 단어 수 * 1.3
    const koreanChars = (text.match(/[\uac00-\ud7af]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const otherChars = text.length - koreanChars - englishWords * 5;

    return Math.ceil(koreanChars / 2 + englishWords * 1.3 + otherChars / 4);
  }

  /**
   * 상속할 메타데이터 추출
   */
  extractInheritedMetadata(metadata) {
    // 청크에 상속할 핵심 메타데이터만 추출
    const inherited = {};

    const keysToInherit = [
      'domain', 'subject', 'curriculum', 'publisher',
      'unit', 'contentType', 'keyConcepts'
    ];

    for (const key of keysToInherit) {
      if (metadata[key] !== undefined) {
        inherited[key] = metadata[key];
      }
    }

    return inherited;
  }

  /**
   * 폴백 청킹 (오류 시)
   */
  fallbackChunking(content, options) {
    const { maxTokensPerChunk = 512, documentType = 'textbook', metadata = {} } = options;
    const chunks = [];

    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';
    let index = 0;

    for (const para of paragraphs) {
      const combined = currentChunk + (currentChunk ? '\n\n' : '') + para;

      if (this.estimateTokens(combined) > maxTokensPerChunk && currentChunk) {
        chunks.push({
          content: currentChunk.trim(),
          contentType: 'concept',
          documentType,
          index: index++,
          conceptData: { segmentType: 'general' },
          inheritedMetadata: this.extractInheritedMetadata(metadata)
        });
        currentChunk = para;
      } else {
        currentChunk = combined;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        contentType: 'concept',
        documentType,
        index: index,
        conceptData: { segmentType: 'general' },
        inheritedMetadata: this.extractInheritedMetadata(metadata)
      });
    }

    return chunks;
  }

  /**
   * 그림/표 캡션과 함께 청킹
   */
  createFigureChunk(content, caption, index, imageData = null) {
    return {
      content: caption ? `${caption}\n\n${content}` : content,
      contentType: 'figure',
      index: index,
      conceptData: {
        figureCaption: caption,
        hasImage: !!imageData
      }
    };
  }

  /**
   * 표 청킹
   */
  createTableChunk(content, caption, index, tableData = null) {
    return {
      content: caption ? `${caption}\n\n${content}` : content,
      contentType: 'table',
      index: index,
      conceptData: {
        tableCaption: caption,
        tableData: tableData
      }
    };
  }
}

module.exports = ConceptChunkingStrategy;
