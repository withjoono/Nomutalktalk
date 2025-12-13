/**
 * 청킹 서비스 - 메인 오케스트레이터
 *
 * 문서 유형에 따라 적절한 청킹 전략을 선택하고 실행
 * - 개념 기반 청킹 (교과서, 부교재)
 * - 문제 기반 청킹 (기출문제, 논술, 면접)
 * - 이미지/표 처리 통합
 */

const ConceptChunkingStrategy = require('./strategies/ConceptChunkingStrategy');
const ProblemChunkingStrategy = require('./strategies/ProblemChunkingStrategy');
const ImageProcessor = require('./processors/ImageProcessor');

class ChunkingService {
  constructor(geminiClient) {
    this.gemini = geminiClient;
    this.model = 'gemini-2.5-flash-preview-05-20';

    // 전략 초기화
    this.strategies = {
      concept: new ConceptChunkingStrategy(geminiClient),
      problem: new ProblemChunkingStrategy(geminiClient)
    };

    // 이미지 프로세서
    this.imageProcessor = new ImageProcessor(geminiClient);

    // 문서 유형별 기본 전략 매핑
    this.typeStrategyMap = {
      'textbook': 'concept',
      'supplementary': 'concept',
      'csat_past': 'problem',
      'csat_mock': 'problem',
      'school_exam': 'problem',
      'university_essay': 'problem',
      'university_interview': 'problem',
      'other': 'auto'
    };
  }

  /**
   * 문서 청킹 실행
   * @param {Object} document - 문서 객체
   * @param {Object} options - 청킹 옵션
   * @returns {Array} - 청크 배열
   */
  async chunkDocument(document, options = {}) {
    const {
      strategy = 'auto',
      maxTokensPerChunk = 512,
      overlapTokens = 64,
      preserveStructure = true,
      processImages = true
    } = options;

    const startTime = Date.now();
    console.log(`Chunking document: ${document.id || 'unknown'}, type: ${document.documentType}`);

    try {
      // 1. 원본 콘텐츠 추출
      const rawContent = await this.extractContent(document);

      // 2. 콘텐츠 유형 감지 (auto 모드인 경우)
      const contentType = strategy === 'auto'
        ? await this.detectContentType(rawContent, document.documentType)
        : strategy;

      // 3. 적절한 전략 선택
      const selectedStrategy = this.selectStrategy(contentType, document.documentType);

      // 4. 청킹 실행
      let chunks = await selectedStrategy.chunk(rawContent, {
        documentType: document.documentType,
        metadata: document.metadata,
        maxTokensPerChunk,
        preserveStructure
      });

      // 5. 이미지/표 처리
      if (processImages && document.assets && document.assets.length > 0) {
        chunks = await this.processEmbeddedAssets(chunks, document.assets);
      }

      // 6. 청크 후처리
      chunks = this.postProcessChunks(chunks, {
        documentId: document.id,
        overlapTokens
      });

      // 7. 검증
      const validatedChunks = this.validateChunks(chunks);

      const processingTime = Date.now() - startTime;
      console.log(`Chunking completed: ${validatedChunks.length} chunks in ${processingTime}ms`);

      return {
        chunks: validatedChunks,
        metadata: {
          totalChunks: validatedChunks.length,
          strategy: contentType,
          processingTime,
          documentType: document.documentType
        }
      };

    } catch (error) {
      console.error('Document chunking error:', error);
      throw new Error(`문서 청킹 실패: ${error.message}`);
    }
  }

  /**
   * 문서에서 텍스트 콘텐츠 추출
   */
  async extractContent(document) {
    // 이미 텍스트인 경우
    if (document.content) {
      return document.content;
    }

    // 문제 텍스트인 경우
    if (document.problemText) {
      let content = document.problemText;
      if (document.solution) {
        content += `\n\n[해설]\n${document.solution}`;
      }
      if (document.answer) {
        content += `\n\n[정답]\n${document.answer}`;
      }
      return content;
    }

    // 파일 경로가 있는 경우 (추후 PDF 등 처리)
    if (document.filePath) {
      // TODO: 파일 파싱 로직 추가
      throw new Error('파일 파싱은 아직 지원되지 않습니다.');
    }

    throw new Error('추출할 콘텐츠가 없습니다.');
  }

  /**
   * 콘텐츠 유형 자동 감지
   */
  async detectContentType(content, documentType) {
    // 문서 유형에 따른 기본 전략이 있는 경우
    const defaultStrategy = this.typeStrategyMap[documentType];
    if (defaultStrategy && defaultStrategy !== 'auto') {
      return defaultStrategy;
    }

    // 패턴 기반 감지
    const problemPatterns = [
      /\d+\.\s*\(/,           // 1. (
      /\[\d+\]/,              // [1]
      /문제\s*\d+/,            // 문제 1
      /①②③④⑤/,              // 선택지
      /정답[:：]/,            // 정답:
      /해설[:：]/             // 해설:
    ];

    const conceptPatterns = [
      /정의[:：]/,            // 정의:
      /정리[:：]/,            // 정리:
      /~를?\s+~라\s+한다/,     // ~를 ~라 한다
      /~은\/는\s+~이다/        // ~은/는 ~이다
    ];

    let problemScore = 0;
    let conceptScore = 0;

    for (const pattern of problemPatterns) {
      if (pattern.test(content)) problemScore++;
    }

    for (const pattern of conceptPatterns) {
      if (pattern.test(content)) conceptScore++;
    }

    // AI 기반 감지 (패턴으로 판단이 어려운 경우)
    if (Math.abs(problemScore - conceptScore) <= 1) {
      return await this.aiDetectContentType(content);
    }

    return problemScore > conceptScore ? 'problem' : 'concept';
  }

  /**
   * AI 기반 콘텐츠 유형 감지
   */
  async aiDetectContentType(content) {
    const sampleContent = content.substring(0, 2000);

    const prompt = `다음 내용의 유형을 판단해주세요.

내용:
${sampleContent}

유형:
- concept: 개념 설명, 정의, 정리, 교과서 본문
- problem: 문제, 기출문제, 연습문제, 평가 문항

"concept" 또는 "problem" 중 하나만 응답해주세요.`;

    try {
      const response = await this.gemini.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 20
        }
      });

      const result = response.text?.toLowerCase().trim() || '';
      if (result.includes('problem')) return 'problem';
      if (result.includes('concept')) return 'concept';

    } catch (error) {
      console.error('AI content type detection error:', error);
    }

    return 'concept'; // 기본값
  }

  /**
   * 전략 선택
   */
  selectStrategy(contentType, documentType) {
    // 문서 유형 우선 (특수 처리가 필요한 경우)
    if (documentType === 'university_interview') {
      return this.strategies.problem;
    }

    // 콘텐츠 유형 기반
    return this.strategies[contentType] || this.strategies.concept;
  }

  /**
   * 임베디드 에셋 처리 (이미지, 표)
   */
  async processEmbeddedAssets(chunks, assets) {
    if (!assets || assets.length === 0) return chunks;

    const processedChunks = [...chunks];

    for (const asset of assets) {
      if (!asset.fileData || !asset.mimeType) continue;

      try {
        // 이미지 처리
        const processedAsset = await this.imageProcessor.convertToChunkText(
          asset.fileData,
          asset.mimeType,
          {
            includeOcr: true,
            includeDescription: true,
            includeFormulas: true,
            context: asset.description || ''
          }
        );

        // 에셋 청크 추가 또는 기존 청크에 병합
        if (asset.problemId) {
          // 특정 문제에 연결된 에셋인 경우 해당 청크에 추가
          const targetChunk = processedChunks.find(c =>
            c.problemData?.problemNumber === asset.problemNumber ||
            c.index === asset.position?.index
          );

          if (targetChunk) {
            targetChunk.content += `\n\n${processedAsset.text}`;
            if (!targetChunk.assetMetadata) targetChunk.assetMetadata = [];
            targetChunk.assetMetadata.push(processedAsset.metadata);
          } else {
            // 별도 청크로 추가
            processedChunks.push({
              content: processedAsset.text,
              contentType: asset.type === 'table' ? 'table' : 'figure',
              index: processedChunks.length,
              conceptData: {
                figureCaption: asset.description,
                ...processedAsset.metadata
              }
            });
          }
        } else {
          // 독립 에셋인 경우 별도 청크로 추가
          processedChunks.push({
            content: processedAsset.text,
            contentType: asset.type === 'table' ? 'table' : 'figure',
            index: processedChunks.length,
            conceptData: {
              figureCaption: asset.description,
              ...processedAsset.metadata
            }
          });
        }

      } catch (error) {
        console.error('Asset processing error:', error);
      }
    }

    return processedChunks;
  }

  /**
   * 청크 후처리
   */
  postProcessChunks(chunks, options) {
    const { documentId, overlapTokens = 0 } = options;

    return chunks.map((chunk, index) => {
      // 문서 ID 추가
      chunk.documentId = documentId;

      // 인덱스 정규화
      chunk.index = index;

      // 이전/다음 청크 참조 추가
      if (index > 0) {
        chunk.previousChunkIndex = index - 1;
      }
      if (index < chunks.length - 1) {
        chunk.nextChunkIndex = index + 1;
      }

      // 토큰 수 추정
      chunk.tokenCount = this.estimateTokens(chunk.content);

      // 타임스탬프
      chunk.createdAt = new Date();

      return chunk;
    });
  }

  /**
   * 청크 검증
   */
  validateChunks(chunks) {
    return chunks.filter(chunk => {
      // 빈 콘텐츠 제거
      if (!chunk.content || chunk.content.trim().length === 0) {
        return false;
      }

      // 최소 토큰 수 확인 (너무 짧은 청크 제거)
      if (chunk.tokenCount < 10) {
        return false;
      }

      return true;
    });
  }

  /**
   * 토큰 수 추정
   */
  estimateTokens(text) {
    if (!text) return 0;
    const koreanChars = (text.match(/[\uac00-\ud7af]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const otherChars = text.length - koreanChars - englishWords * 5;
    return Math.ceil(koreanChars / 2 + englishWords * 1.3 + otherChars / 4);
  }

  /**
   * 재청킹
   */
  async rechunkDocument(document, newOptions = {}) {
    console.log(`Re-chunking document: ${document.id}`);

    // 기존 청크 정보 로깅
    const oldChunkCount = document.chunkCount || 0;

    // 새로운 옵션으로 청킹
    const result = await this.chunkDocument(document, newOptions);

    console.log(`Re-chunking complete: ${oldChunkCount} -> ${result.chunks.length} chunks`);

    return result;
  }

  /**
   * 단일 텍스트 청킹 (간편 API)
   */
  async chunkText(text, options = {}) {
    const pseudoDocument = {
      content: text,
      documentType: options.documentType || 'other',
      metadata: options.metadata || {},
      assets: options.assets || []
    };

    return this.chunkDocument(pseudoDocument, options);
  }

  /**
   * 문서 유형별 권장 청킹 설정 반환
   */
  getRecommendedConfig(documentType) {
    const configs = {
      'textbook': {
        strategy: 'concept',
        maxTokensPerChunk: 512,
        preserveStructure: true,
        description: '개념 단위 청킹, 정의/정리/예제 분리'
      },
      'supplementary': {
        strategy: 'concept',
        maxTokensPerChunk: 512,
        preserveStructure: true,
        description: '개념 단위 청킹'
      },
      'csat_past': {
        strategy: 'problem',
        maxTokensPerChunk: 1024,
        preserveStructure: true,
        description: '문제+해설+정답 단위 청킹'
      },
      'csat_mock': {
        strategy: 'problem',
        maxTokensPerChunk: 1024,
        preserveStructure: true,
        description: '문제+해설+정답 단위 청킹'
      },
      'school_exam': {
        strategy: 'problem',
        maxTokensPerChunk: 1024,
        preserveStructure: true,
        description: '문제 단위 청킹, 배점 정보 포함'
      },
      'university_essay': {
        strategy: 'problem',
        maxTokensPerChunk: 2048,
        preserveStructure: true,
        description: '문제+모범답안+채점기준 단위 청킹'
      },
      'university_interview': {
        strategy: 'problem',
        maxTokensPerChunk: 1536,
        preserveStructure: true,
        description: '질문세트+꼬리질문+모범답변 단위 청킹'
      },
      'other': {
        strategy: 'auto',
        maxTokensPerChunk: 768,
        preserveStructure: false,
        description: '자동 감지 후 적절한 전략 적용'
      }
    };

    return configs[documentType] || configs['other'];
  }
}

module.exports = ChunkingService;
