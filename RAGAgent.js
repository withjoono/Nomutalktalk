const FileSearchManager = require('./FileSearchManager');
const fs = require('fs');
const path = require('path');

/**
 * Google File Search RAG (Retrieval-Augmented Generation) Agent
 * 파일을 업로드하고 검색 기반 질의응답을 수행하는 에이전트
 */
class RAGAgent {
  /**
   * @param {string} apiKey - Google Gemini API 키
   * @param {Object} options - 에이전트 설정
   * @param {string} options.storeName - 사용할 스토어 이름 (선택사항)
   * @param {string} options.model - 사용할 모델 (기본값: 'gemini-2.5-flash')
   * @param {number} options.uploadPollInterval - 업로드 완료 체크 간격 (밀리초, 기본값: 5000)
   */
  constructor(apiKey, options = {}) {
    this.manager = new FileSearchManager(apiKey);
    this.storeName = options.storeName || null;
    this.model = options.model || 'gemini-2.5-flash';
    this.uploadPollInterval = options.uploadPollInterval || 5000;
  }

  /**
   * 에이전트 초기화 (스토어 생성 또는 기존 스토어 사용)
   * @param {string} displayName - 스토어 표시 이름 (기존 스토어 사용 시 불필요)
   * @returns {Promise<string>} 초기화된 스토어 이름
   */
  async initialize(displayName) {
    if (this.storeName) {
      console.log(`✓ 기존 스토어 사용: ${this.storeName}`);
      return this.storeName;
    }

    if (!displayName) {
      throw new Error('스토어 이름이 필요합니다 (displayName 파라미터 또는 생성자 options.storeName)');
    }

    console.log(`🔧 새 스토어 생성 중: ${displayName}...`);
    const store = await this.manager.createStore(displayName);
    this.storeName = store.name;
    console.log(`✓ 스토어 생성 완료: ${this.storeName}`);

    return this.storeName;
  }

  /**
   * 파일을 스토어에 직접 업로드
   * @param {string} filePath - 업로드할 파일 경로
   * @param {Object} options - 업로드 옵션
   * @param {string} options.displayName - 파일 표시 이름 (인용에 표시됨)
   * @param {string} options.mimeType - 파일 MIME 타입 (예: 'text/plain', 'application/pdf')
   * @param {Object} options.chunkingConfig - 청크 구성 설정
   * @param {Object} options.chunkingConfig.whiteSpaceConfig - 공백 기반 청킹 설정
   * @param {number} options.chunkingConfig.whiteSpaceConfig.maxTokensPerChunk - 청크당 최대 토큰 수 (기본값: API 기본값)
   * @param {number} options.chunkingConfig.whiteSpaceConfig.maxOverlapTokens - 청크 간 오버랩 토큰 수 (기본값: 0)
   * @returns {Promise<Object>} 업로드 결과 정보
   */
  async uploadFile(filePath, options = {}) {
    // 스토어 초기화 확인
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다. initialize() 메서드를 먼저 호출하세요.');
    }

    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }

    // 청킹 설정 검증
    if (options.chunkingConfig) {
      this.manager._validateChunkingConfig(options.chunkingConfig);
    }

    const fileName = options.displayName || path.basename(filePath);
    const chunkInfo = options.chunkingConfig
      ? ` (청크 설정: ${JSON.stringify(options.chunkingConfig.whiteSpaceConfig)})`
      : '';
    console.log(`📤 파일 업로드 중: ${fileName}${chunkInfo}...`);

    // 파일 업로드 및 완료 대기
    const operation = await this.manager.uploadFile(
      filePath,
      this.storeName,
      {
        mimeType: options.mimeType,
        pollInterval: this.uploadPollInterval,
        chunkingConfig: options.chunkingConfig
      }
    );

    console.log(`✓ 업로드 완료: ${fileName}`);

    return {
      fileName,
      filePath,
      storeName: this.storeName,
      chunkingConfig: options.chunkingConfig,
      operation
    };
  }

  /**
   * 여러 파일을 일괄 업로드
   * @param {Array<string|Object>} files - 파일 경로 배열 또는 {path, displayName, mimeType} 객체 배열
   * @returns {Promise<Array<Object>>} 업로드 결과 배열
   */
  async uploadFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('업로드할 파일 목록이 필요합니다');
    }

    console.log(`📤 ${files.length}개 파일 일괄 업로드 시작...`);

    const results = [];
    for (const file of files) {
      const filePath = typeof file === 'string' ? file : file.path;
      const options = typeof file === 'object' ? file : {};

      try {
        const result = await this.uploadFile(filePath, options);
        results.push({ success: true, ...result });
      } catch (error) {
        console.error(`✗ 업로드 실패 (${filePath}):`, error.message);
        results.push({
          success: false,
          filePath,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✓ 일괄 업로드 완료: ${successCount}/${files.length} 성공`);

    return results;
  }

  /**
   * Files API를 통해 파일을 업로드하고 스토어로 가져오기 (2단계 프로세스)
   * @param {string} filePath - 업로드할 파일 경로
   * @param {Object} options - 업로드 옵션
   * @param {string} options.displayName - 파일 표시 이름 (인용에 표시됨)
   * @param {string} options.mimeType - 파일 MIME 타입
   * @param {Object} options.chunkingConfig - 청크 구성 설정
   * @param {Object} options.chunkingConfig.whiteSpaceConfig - 공백 기반 청킹 설정
   * @param {number} options.chunkingConfig.whiteSpaceConfig.maxTokensPerChunk - 청크당 최대 토큰 수
   * @param {number} options.chunkingConfig.whiteSpaceConfig.maxOverlapTokens - 청크 간 오버랩 토큰 수
   * @param {Array<Object>} options.customMetadata - 커스텀 메타데이터 배열
   * @param {string} options.customMetadata[].key - 메타데이터 키
   * @param {string} options.customMetadata[].stringValue - 문자열 값 (선택사항)
   * @param {number} options.customMetadata[].numericValue - 숫자 값 (선택사항)
   * @returns {Promise<Object>} 가져오기 결과 정보
   */
  async uploadAndImportFile(filePath, options = {}) {
    // 스토어 초기화 확인
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다. initialize() 메서드를 먼저 호출하세요.');
    }

    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }

    // 청킹 설정 검증
    if (options.chunkingConfig) {
      this.manager._validateChunkingConfig(options.chunkingConfig);
    }

    // 커스텀 메타데이터 검증
    if (options.customMetadata) {
      this.manager._validateCustomMetadata(options.customMetadata);
    }

    const fileName = options.displayName || path.basename(filePath);
    const chunkInfo = options.chunkingConfig
      ? ` (청크 설정: ${JSON.stringify(options.chunkingConfig.whiteSpaceConfig)})`
      : '';
    const metadataInfo = options.customMetadata
      ? ` (메타데이터: ${options.customMetadata.length}개 항목)`
      : '';
    console.log(`📤 1단계: Files API에 파일 업로드 중: ${fileName}${chunkInfo}${metadataInfo}...`);

    // 1단계: Files API에 파일 업로드
    const uploadedFile = await this.manager.uploadFileToFilesAPI(filePath, options);
    console.log(`✓ Files API 업로드 완료: ${uploadedFile.name}`);

    // 2단계: 업로드된 파일을 File Search Store로 가져오기
    console.log(`📥 2단계: 스토어로 파일 가져오기 중...`);
    const operation = await this.manager.importFileToStore(
      this.storeName,
      uploadedFile.name,
      {
        pollInterval: this.uploadPollInterval,
        chunkingConfig: options.chunkingConfig,
        customMetadata: options.customMetadata
      }
    );

    console.log(`✓ 가져오기 완료: ${fileName}`);

    return {
      fileName,
      filePath,
      filesAPIName: uploadedFile.name,
      storeName: this.storeName,
      chunkingConfig: options.chunkingConfig,
      customMetadata: options.customMetadata,
      uploadedFile,
      operation
    };
  }

  /**
   * 여러 파일을 Files API를 통해 일괄 업로드 및 가져오기
   * @param {Array<string|Object>} files - 파일 경로 배열 또는 {path, displayName, mimeType} 객체 배열
   * @returns {Promise<Array<Object>>} 가져오기 결과 배열
   */
  async uploadAndImportFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('업로드할 파일 목록이 필요합니다');
    }

    console.log(`📤 ${files.length}개 파일 일괄 업로드 및 가져오기 시작...`);

    const results = [];
    for (const file of files) {
      const filePath = typeof file === 'string' ? file : file.path;
      const options = typeof file === 'object' ? file : {};

      try {
        const result = await this.uploadAndImportFile(filePath, options);
        results.push({ success: true, ...result });
      } catch (error) {
        console.error(`✗ 가져오기 실패 (${filePath}):`, error.message);
        results.push({
          success: false,
          filePath,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✓ 일괄 가져오기 완료: ${successCount}/${files.length} 성공`);

    return results;
  }

  /**
   * Files API에 업로드된 파일 목록 조회
   * @returns {Promise<Array>} 파일 목록
   */
  async listUploadedFiles() {
    return await this.manager.listFilesAPIFiles();
  }

  /**
   * Files API에서 파일 삭제
   * @param {string} fileName - 파일 이름 (예: 'files/xxx')
   * @returns {Promise<void>}
   */
  async deleteUploadedFile(fileName) {
    console.log(`🗑️  Files API에서 파일 삭제 중: ${fileName}...`);
    await this.manager.deleteFileFromFilesAPI(fileName);
    console.log(`✓ 파일 삭제 완료`);
  }

  /**
   * 파일 검색 기반 질의응답
   * @param {string} query - 질문 내용
   * @param {Object} options - 검색 옵션
   * @param {string} options.model - 사용할 모델 (기본값: 인스턴스 설정)
   * @returns {Promise<string>} 답변 텍스트
   */
  async ask(query, options = {}) {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다. initialize() 메서드를 먼저 호출하세요.');
    }

    if (!query || typeof query !== 'string') {
      throw new Error('유효한 질문이 필요합니다');
    }

    console.log(`🔍 질의 처리 중: "${query.substring(0, 50)}..."`);

    const model = options.model || this.model;
    const answer = await this.manager.search(query, this.storeName, model);

    console.log(`✓ 답변 생성 완료`);
    return answer;
  }

  /**
   * 스토어의 현재 상태 조회
   * @returns {Promise<Object>} 스토어 정보 (문서 개수, 문서 목록)
   */
  async getStatus() {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다');
    }

    return await this.manager.getStoreInfo(this.storeName);
  }

  /**
   * 특정 문서 삭제
   * @param {string} documentName - 삭제할 문서 이름
   * @returns {Promise<void>}
   */
  async deleteDocument(documentName) {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다');
    }

    console.log(`🗑️  문서 삭제 중: ${documentName}...`);
    await this.manager.deleteDocument(documentName);
    console.log(`✓ 문서 삭제 완료`);
  }

  /**
   * 스토어의 모든 문서 조회
   * @returns {Promise<Array>} 문서 목록
   */
  async listDocuments() {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다');
    }

    return await this.manager.listDocuments(this.storeName);
  }

  /**
   * 모든 File Search Store 목록 조회
   * @param {number} pageSize - 페이지당 항목 수 (기본값: 20)
   * @returns {Promise<Array>} 스토어 목록
   */
  async listStores(pageSize = 20) {
    return await this.manager.listStores(pageSize);
  }

  /**
   * 특정 File Search Store 정보 조회
   * @param {string} storeName - 스토어 이름 (기본값: 현재 에이전트의 스토어)
   * @returns {Promise<Object>} 스토어 상세 정보
   */
  async getStore(storeName = null) {
    const targetStore = storeName || this.storeName;

    if (!targetStore) {
      throw new Error('스토어 이름이 필요합니다 (파라미터 또는 초기화된 스토어)');
    }

    return await this.manager.getStore(targetStore);
  }

  /**
   * 특정 File Search Store 삭제
   * @param {string} storeName - 삭제할 스토어 이름
   * @param {boolean} force - 비어있지 않은 스토어도 강제 삭제 (기본값: true)
   * @returns {Promise<void>}
   */
  async deleteStore(storeName, force = true) {
    if (!storeName) {
      throw new Error('삭제할 스토어 이름이 필요합니다');
    }

    console.log(`🗑️  스토어 삭제 중: ${storeName}...`);
    await this.manager.deleteStore(storeName, force);
    console.log(`✓ 스토어 삭제 완료`);

    // 현재 에이전트의 스토어를 삭제한 경우 storeName 초기화
    if (storeName === this.storeName) {
      this.storeName = null;
    }
  }

  /**
   * 에이전트 정리 (현재 스토어 삭제)
   * @param {boolean} force - 비어있지 않은 스토어도 강제 삭제 (기본값: true)
   * @returns {Promise<void>}
   */
  async cleanup(force = true) {
    if (!this.storeName) {
      console.log('⚠️  정리할 스토어가 없습니다');
      return;
    }

    await this.deleteStore(this.storeName, force);
  }

  // ==================== 교육 콘텐츠 RAG 확장 메서드 ====================

  /**
   * 교육 문서 업로드 (메타데이터 전파 포함)
   * @param {Object} document - 문서 객체
   * @param {string} document.id - 문서 ID
   * @param {string} document.documentType - 문서 유형
   * @param {string} document.title - 문서 제목
   * @param {Object} document.metadata - 문서 메타데이터
   * @param {string} document.filePath - 업로드할 파일 경로
   * @param {Object} options - 업로드 옵션
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadEducationalDocument(document, options = {}) {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다. initialize() 메서드를 먼저 호출하세요.');
    }

    const { filePath, documentType, metadata, title } = document;

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }

    // 커스텀 메타데이터 생성
    const customMetadata = this.buildCustomMetadata(documentType, metadata);

    // 문서 유형별 청킹 설정
    const chunkingConfig = options.chunkingConfig || this.getChunkingConfig(documentType);

    console.log(`📤 교육 문서 업로드: ${title} (유형: ${documentType})`);
    console.log(`   메타데이터 필드: ${customMetadata.length}개`);

    const result = await this.uploadAndImportFile(filePath, {
      displayName: title,
      mimeType: options.mimeType || this.getMimeType(filePath),
      chunkingConfig,
      customMetadata
    });

    return {
      ...result,
      documentId: document.id,
      documentType,
      metadataFields: customMetadata.length
    };
  }

  /**
   * 문서 유형에 따른 커스텀 메타데이터 생성 (Gemini File Search 호환)
   * @param {string} documentType - 문서 유형
   * @param {Object} metadata - 원본 메타데이터
   * @returns {Array} Gemini 커스텀 메타데이터 배열
   */
  buildCustomMetadata(documentType, metadata) {
    const customMetadata = [];

    // 문서 유형 항상 포함
    customMetadata.push({
      key: 'document_type',
      stringValue: documentType
    });

    if (!metadata) return customMetadata;

    // 문서 유형별 메타데이터 추가
    switch (documentType) {
      case 'textbook':
      case 'supplementary':
        this._addStringField(customMetadata, 'domain', metadata.domain);
        this._addStringField(customMetadata, 'subject', metadata.subject);
        this._addStringField(customMetadata, 'curriculum', metadata.curriculum);
        this._addStringField(customMetadata, 'publisher', metadata.publisher);
        this._addStringField(customMetadata, 'content_type', metadata.contentType);
        if (metadata.unit) {
          this._addStringField(customMetadata, 'major_unit', metadata.unit.majorUnit);
          this._addStringField(customMetadata, 'middle_unit', metadata.unit.middleUnit);
        }
        if (metadata.keyConcepts && metadata.keyConcepts.length > 0) {
          this._addStringField(customMetadata, 'key_concepts', metadata.keyConcepts.join(', '));
        }
        break;

      case 'csat_past':
      case 'csat_mock':
      case 'school_exam':
        this._addStringField(customMetadata, 'exam_type', metadata.examType);
        this._addNumericField(customMetadata, 'year', metadata.year);
        this._addStringField(customMetadata, 'domain', metadata.domain);
        this._addStringField(customMetadata, 'subject', metadata.subject);
        this._addStringField(customMetadata, 'difficulty', metadata.difficulty);
        this._addStringField(customMetadata, 'exam_institution', metadata.examInstitution);
        if (metadata.unit) {
          this._addStringField(customMetadata, 'major_unit', metadata.unit.majorUnit);
        }
        if (metadata.zystoryUnit) {
          this._addStringField(customMetadata, 'zystory_major', metadata.zystoryUnit.majorUnit);
          this._addStringField(customMetadata, 'zystory_middle', metadata.zystoryUnit.middleUnit);
          this._addStringField(customMetadata, 'zystory_type', metadata.zystoryUnit.typeName);
        }
        if (metadata.knowledgeType && metadata.knowledgeType.length > 0) {
          this._addStringField(customMetadata, 'knowledge_type', metadata.knowledgeType.join(', '));
        }
        break;

      case 'university_essay':
        this._addStringField(customMetadata, 'university', metadata.universityName);
        this._addStringField(customMetadata, 'campus', metadata.campus);
        this._addNumericField(customMetadata, 'year', metadata.year);
        this._addStringField(customMetadata, 'admission_type', metadata.admissionType);
        this._addStringField(customMetadata, 'department', metadata.department);
        this._addStringField(customMetadata, 'problem_type', metadata.problemType);
        this._addStringField(customMetadata, 'difficulty', metadata.difficulty);
        if (metadata.units && metadata.units.length > 0) {
          const unitNames = metadata.units.map(u => u.majorUnit).join(', ');
          this._addStringField(customMetadata, 'units', unitNames);
        }
        if (metadata.thinkingProcess && metadata.thinkingProcess.length > 0) {
          this._addStringField(customMetadata, 'thinking_process', metadata.thinkingProcess.join(', '));
        }
        break;

      case 'university_interview':
        this._addStringField(customMetadata, 'university', metadata.universityName);
        this._addStringField(customMetadata, 'department', metadata.department);
        this._addNumericField(customMetadata, 'year', metadata.year);
        this._addStringField(customMetadata, 'admission_type', metadata.admissionType);
        this._addStringField(customMetadata, 'interview_type', metadata.interviewType);
        this._addNumericField(customMetadata, 'duration', metadata.interviewDuration);
        if (metadata.evaluationCompetencies && metadata.evaluationCompetencies.length > 0) {
          this._addStringField(customMetadata, 'competencies', metadata.evaluationCompetencies.join(', '));
        }
        break;

      case 'other':
      default:
        this._addStringField(customMetadata, 'category', metadata.category);
        if (metadata.tags && metadata.tags.length > 0) {
          this._addStringField(customMetadata, 'tags', metadata.tags.join(', '));
        }
        break;
    }

    return customMetadata;
  }

  /**
   * 문자열 메타데이터 필드 추가
   */
  _addStringField(arr, key, value) {
    if (value && typeof value === 'string') {
      arr.push({ key, stringValue: value });
    }
  }

  /**
   * 숫자 메타데이터 필드 추가
   */
  _addNumericField(arr, key, value) {
    if (value && typeof value === 'number') {
      arr.push({ key, numericValue: value });
    }
  }

  /**
   * 문서 유형별 최적 청킹 설정 반환
   * @param {string} documentType - 문서 유형
   * @returns {Object} 청킹 설정
   */
  getChunkingConfig(documentType) {
    const configs = {
      'textbook': {
        whiteSpaceConfig: {
          maxTokensPerChunk: 512,
          maxOverlapTokens: 64
        }
      },
      'supplementary': {
        whiteSpaceConfig: {
          maxTokensPerChunk: 512,
          maxOverlapTokens: 64
        }
      },
      'csat_past': {
        whiteSpaceConfig: {
          maxTokensPerChunk: 1024,
          maxOverlapTokens: 0  // 문제 단위이므로 오버랩 불필요
        }
      },
      'csat_mock': {
        whiteSpaceConfig: {
          maxTokensPerChunk: 1024,
          maxOverlapTokens: 0
        }
      },
      'school_exam': {
        whiteSpaceConfig: {
          maxTokensPerChunk: 1024,
          maxOverlapTokens: 0
        }
      },
      'university_essay': {
        whiteSpaceConfig: {
          maxTokensPerChunk: 2048,  // 논술 문제는 길 수 있음
          maxOverlapTokens: 128
        }
      },
      'university_interview': {
        whiteSpaceConfig: {
          maxTokensPerChunk: 1536,
          maxOverlapTokens: 64
        }
      },
      'default': {
        whiteSpaceConfig: {
          maxTokensPerChunk: 768,
          maxOverlapTokens: 64
        }
      }
    };

    return configs[documentType] || configs['default'];
  }

  /**
   * 파일 경로에서 MIME 타입 추정
   * @param {string} filePath - 파일 경로
   * @returns {string} MIME 타입
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.html': 'text/html',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.csv': 'text/csv'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Gemini 클라이언트 접근자 (ChunkingService 등에서 사용)
   */
  get gemini() {
    return this.manager.genai;
  }
}

module.exports = RAGAgent;
