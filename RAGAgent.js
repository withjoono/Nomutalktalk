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
   * @param {string} options.model - 사용할 모델 (기본값: 'gemini-2.5-pro')
   * @param {number} options.uploadPollInterval - 업로드 완료 체크 간격 (밀리초, 기본값: 5000)
   */
  constructor(apiKey, options = {}) {
    this.manager = new FileSearchManager(apiKey);
    this.storeName = options.storeName || null;
    this.model = options.model || 'gemini-2.5-pro';
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

    // 기존 스토어 검색
    console.log(`🔍 기존 스토어 검색 중: ${displayName}...`);
    try {
      const stores = await this.listStores();
      const existingStore = stores.find(s => s.displayName === displayName);

      if (existingStore) {
        this.storeName = existingStore.name;
        console.log(`✓ 기존 스토어 발견 및 연결: ${this.storeName}`);
        return this.storeName;
      }
    } catch (error) {
      console.warn(`⚠️  스토어 검색 중 오류 (무시하고 생성 진행): ${error.message}`);
    }

    // 없으면 새로 생성
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

  // ==================== 노무 AI 전용 확장 메서드 ====================

  /**
   * 노동법령 문서 업로드
   * @param {Object} lawDocument - 법령 문서 정보
   * @param {string} lawDocument.filePath - 파일 경로
   * @param {string} lawDocument.title - 문서 제목
   * @param {Object} lawDocument.metadata - 법령 메타데이터 (LaborLawSchema 참조)
   * @param {Object} options - 업로드 옵션
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadLaborLaw(lawDocument, options = {}) {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다. initialize() 메서드를 먼저 호출하세요.');
    }

    const { filePath, title, metadata } = lawDocument;

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }

    // 법령 전용 메타데이터 생성
    const { LaborMetadataBuilder } = require('./models/laborSchemas');
    const customMetadata = LaborMetadataBuilder.buildLaborLawMetadata(metadata);

    // 법령 전용 청킹 설정
    const { LaborChunkingPresets } = require('./models/laborSchemas');
    const chunkingConfig = options.chunkingConfig || LaborChunkingPresets.law;

    console.log(`📜 노동법령 업로드: ${title}`);
    console.log(`   법령명: ${metadata.lawName} (${metadata.lawType})`);
    console.log(`   메타데이터 필드: ${customMetadata.length}개`);

    const result = await this.uploadAndImportFile(filePath, {
      displayName: title,
      mimeType: options.mimeType || this.getMimeType(filePath),
      chunkingConfig,
      customMetadata
    });

    return {
      ...result,
      documentType: 'labor_law',
      lawName: metadata.lawName,
      metadataFields: customMetadata.length
    };
  }

  /**
   * 판례 문서 업로드
   * @param {Object} caseDocument - 판례 문서 정보
   * @param {string} caseDocument.filePath - 파일 경로
   * @param {string} caseDocument.title - 문서 제목
   * @param {Object} caseDocument.metadata - 판례 메타데이터 (LaborCaseSchema 참조)
   * @param {Object} options - 업로드 옵션
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadLaborCase(caseDocument, options = {}) {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다. initialize() 메서드를 먼저 호출하세요.');
    }

    const { filePath, title, metadata } = caseDocument;

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }

    console.log(`⚖️  판례 업로드: ${title}`);
    console.log(`   법원: ${metadata.courtName} | 사건번호: ${metadata.caseNumber}`);

    // 간단한 업로드 메서드 사용 (한 번에 처리)
    const result = await this.uploadFile(filePath, {
      displayName: title.substring(0, 50), // 제목 짧게
      mimeType: options.mimeType || this.getMimeType(filePath)
    });

    return {
      ...result,
      documentType: 'labor_case',
      caseNumber: metadata.caseNumber,
      title: title
    };
  }

  /**
   * 행정해석 문서 업로드
   * @param {Object} interpDocument - 행정해석 문서 정보
   * @param {string} interpDocument.filePath - 파일 경로
   * @param {string} interpDocument.title - 문서 제목
   * @param {Object} interpDocument.metadata - 행정해석 메타데이터
   * @param {Object} options - 업로드 옵션
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadLaborInterpretation(interpDocument, options = {}) {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다. initialize() 메서드를 먼저 호출하세요.');
    }

    const { filePath, title, metadata } = interpDocument;

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }

    // 행정해석 전용 메타데이터 생성
    const { LaborMetadataBuilder } = require('./models/laborSchemas');
    const customMetadata = LaborMetadataBuilder.buildInterpretationMetadata(metadata);

    // 행정해석 전용 청킹 설정
    const { LaborChunkingPresets } = require('./models/laborSchemas');
    const chunkingConfig = options.chunkingConfig || LaborChunkingPresets.interpretation;

    console.log(`📋 행정해석 업로드: ${title}`);
    console.log(`   발행기관: ${metadata.issuingAuthority}`);
    console.log(`   메타데이터 필드: ${customMetadata.length}개`);

    const result = await this.uploadAndImportFile(filePath, {
      displayName: title,
      mimeType: options.mimeType || this.getMimeType(filePath),
      chunkingConfig,
      customMetadata
    });

    return {
      ...result,
      documentType: 'labor_interpretation',
      interpretationNumber: metadata.interpretationNumber,
      metadataFields: customMetadata.length
    };
  }

  /**
   * 노무 질의응답 (프롬프트 엔지니어링 적용)
   * @param {string} query - 노무 관련 질문
   * @param {Object} options - 질의 옵션
   * @param {string} options.category - 카테고리 (자동 감지 시 생략 가능)
   * @param {boolean} options.includeCases - 판례 포함 여부 (기본: true)
   * @param {boolean} options.includeInterpretations - 행정해석 포함 여부 (기본: true)
   * @param {string} options.model - 사용할 모델
   * @returns {Promise<string>} 구조화된 답변
   */
  async askLabor(query, options = {}) {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다. initialize() 메서드를 먼저 호출하세요.');
    }

    if (!query || typeof query !== 'string') {
      throw new Error('유효한 질문이 필요합니다');
    }

    // 카테고리 자동 감지
    const category = options.category || this.detectLaborCategory(query);
    const includeCases = options.includeCases !== false;
    const includeInterpretations = options.includeInterpretations !== false;

    console.log(`🔍 노무 질의 처리: "${query.substring(0, 50)}..."`);
    console.log(`   카테고리: ${category}`);

    // 노무 전문가 프롬프트 적용
    const enhancedQuery = this.buildLaborPrompt(query, {
      category,
      includeCases,
      includeInterpretations
    });

    const model = options.model || this.model;
    const answer = await this.manager.search(enhancedQuery, this.storeName, model);

    console.log(`✓ 노무 답변 생성 완료`);
    return answer;
  }

  /**
   * 유사 판례 검색
   * @param {string} caseDescription - 사건 설명
   * @param {Object} options - 검색 옵션
   * @returns {Promise<string>} 유사 판례 목록 및 분석
   */
  async findSimilarCases(caseDescription, options = {}) {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다');
    }

    console.log(`⚖️  유사 판례 검색 중...`);

    const query = `
다음 사안과 유사한 노동 관련 판례를 찾아서 분석해주세요:

【사안 설명】
${caseDescription}

【요청 사항】
1. 유사한 판례 3-5개를 찾아주세요
2. 각 판례마다 다음 정보를 포함해주세요:
   - 사건번호 및 선고일
   - 법원명
   - 사건의 쟁점
   - 판결 결과 및 요지
   - 현재 사안과의 유사점 및 차이점

3. 종합 분석:
   - 판례의 일관된 법리
   - 현재 사안에 적용 가능한 법리
   - 예상 판단 방향

형식은 구조화하여 답변해주세요.
`;

    return await this.ask(query, options);
  }

  /**
   * 법령 조항 상세 검색
   * @param {string} lawName - 법령명 (예: '근로기준법')
   * @param {string} article - 조 (예: '제23조')
   * @param {Object} options - 검색 옵션
   * @returns {Promise<string>} 법령 조항 상세 설명
   */
  async searchLawArticle(lawName, article, options = {}) {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다');
    }

    console.log(`📜 법령 조항 검색: ${lawName} ${article}`);

    const query = `
${lawName} ${article}에 대해 다음 사항을 상세히 설명해주세요:

1. 조문 내용 (원문)
2. 조문의 취지 및 목적
3. 주요 구성요건 및 해석
4. 관련 판례 (주요 판례 2-3개)
5. 실무상 적용 사례 및 주의사항
6. 관련 법령 및 조문

구조화하여 답변해주세요.
`;

    return await this.ask(query, options);
  }

  /**
   * 노무 상담 템플릿 기반 질의
   * @param {string} templateType - 템플릿 유형 ('dismissal', 'wages', 'worktime', 'leave')
   * @param {Object} params - 템플릿 파라미터
   * @returns {Promise<string>} 템플릿 기반 답변
   */
  async consultWithTemplate(templateType, params) {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다');
    }

    const templates = {
      dismissal: `
【부당해고 상담】
근로자: ${params.employeeType || '정규직'}
근무기간: ${params.workPeriod || '미상'}
해고사유: ${params.dismissalReason || '미상'}
해고절차: ${params.procedure || '미상'}

다음 사항을 검토해주세요:
1. 해고의 정당한 이유 존재 여부 (근로기준법 제23조)
2. 해고예고 이행 여부
3. 해고절차의 적법성
4. 관련 판례 분석
5. 권리구제 방법 (노동위원회 구제신청, 소송 등)
6. 예상 결과 및 조언
`,
      wages: `
【임금 관련 상담】
임금 유형: ${params.wageType || '미상'}
쟁점 사항: ${params.issue || '미상'}
근로형태: ${params.workType || '미상'}

다음 사항을 검토해주세요:
1. 관련 법령 (근로기준법, 최저임금법 등)
2. 임금 산정 방법 및 기준
3. 관련 판례 및 행정해석
4. 적법성 판단
5. 권리구제 방법
6. 실무상 주의사항
`,
      worktime: `
【근로시간 관련 상담】
근로형태: ${params.workType || '미상'}
근로시간: ${params.workHours || '미상'}
쟁점 사항: ${params.issue || '미상'}

다음 사항을 검토해주세요:
1. 법정 근로시간 기준 (근로기준법 제50조 등)
2. 연장/야간/휴일근로 해당 여부
3. 수당 지급 의무 및 산정 방법
4. 관련 판례 및 행정해석
5. 적법성 판단
6. 개선 방안 및 조언
`,
      leave: `
【휴가/휴직 관련 상담】
휴가 유형: ${params.leaveType || '미상'}
근무기간: ${params.workPeriod || '미상'}
쟁점 사항: ${params.issue || '미상'}

다음 사항을 검토해주세요:
1. 관련 법령 (근로기준법, 남녀고용평등법 등)
2. 휴가/휴직 발생 요건 및 기간
3. 사용 절차 및 방법
4. 관련 판례 및 행정해석
5. 권리 행사 방법
6. 실무상 주의사항
`
    };

    const template = templates[templateType];
    if (!template) {
      throw new Error(`지원하지 않는 템플릿 유형: ${templateType}`);
    }

    console.log(`📋 템플릿 상담: ${templateType}`);
    return await this.ask(template);
  }

  /**
   * 질의 카테고리 자동 감지
   * @param {string} query - 질의 내용
   * @returns {string} 감지된 카테고리
   */
  detectLaborCategory(query) {
    const { LaborCategories } = require('./models/laborSchemas');

    for (const [category, config] of Object.entries(LaborCategories)) {
      const keywords = config.keywords || [];
      if (keywords.some(keyword => query.includes(keyword))) {
        return category;
      }
    }

    return '일반';
  }

  /**
   * 노무 전문가 프롬프트 생성
   * @param {string} query - 원본 질의
   * @param {Object} options - 프롬프트 옵션
   * @returns {string} 향상된 프롬프트
   */
  buildLaborPrompt(query, options = {}) {
    const { category, includeCases, includeInterpretations } = options;

    const systemPrompt = `당신은 대한민국 노동법 전문가입니다. 다음 원칙을 준수하여 답변하세요:

【답변 원칙】
1. 정확성: 법령 조항과 판례를 정확히 인용
2. 출처 명시: 모든 답변에 법적 근거 제시
3. 실무 관점: 이론과 실무 모두 고려
4. 구조화: 명확한 구조로 답변
5. 한계 인정: 확실하지 않은 경우 명시
6. 최신성: 법령 개정 가능성 안내

【답변 구조】
💡 결론
[핵심 답변을 먼저 제시]

📖 법적 근거
[관련 법령 조항 인용 및 설명]
${includeCases ? '\n⚖️  관련 판례\n[주요 판례 인용 및 판시사항 설명]' : ''}
${includeInterpretations ? '\n📋 행정해석\n[관련 행정해석 또는 지침]' : ''}

⚠️  실무 주의사항
[실무적 조언 및 유의점]

❓ 예외 및 추가 고려사항
[예외 상황 및 특수 케이스]

---`;

    return `${systemPrompt}

【질문 카테고리】 ${category}

【질문 내용】
${query}

위 질문에 대해 구조화된 형식으로 상세히 답변해주세요.`;
  }

  /**
   * 일괄 법령 업로드
   * @param {Array} lawDocuments - 법령 문서 배열
   * @returns {Promise<Array>} 업로드 결과 배열
   */
  async uploadLaborLawsBatch(lawDocuments) {
    if (!Array.isArray(lawDocuments) || lawDocuments.length === 0) {
      throw new Error('업로드할 법령 문서 목록이 필요합니다');
    }

    console.log(`📜 ${lawDocuments.length}개 법령 일괄 업로드 시작...`);

    const results = [];
    for (const lawDoc of lawDocuments) {
      try {
        const result = await this.uploadLaborLaw(lawDoc);
        results.push({ success: true, ...result });
      } catch (error) {
        console.error(`✗ 업로드 실패 (${lawDoc.title}):`, error.message);
        results.push({
          success: false,
          title: lawDoc.title,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✓ 법령 일괄 업로드 완료: ${successCount}/${lawDocuments.length} 성공`);

    return results;
  }

  /**
   * 일괄 판례 업로드
   * @param {Array} caseDocuments - 판례 문서 배열
   * @returns {Promise<Array>} 업로드 결과 배열
   */
  async uploadLaborCasesBatch(caseDocuments) {
    if (!Array.isArray(caseDocuments) || caseDocuments.length === 0) {
      throw new Error('업로드할 판례 문서 목록이 필요합니다');
    }

    console.log(`⚖️  ${caseDocuments.length}개 판례 일괄 업로드 시작...`);

    const results = [];
    for (const caseDoc of caseDocuments) {
      try {
        const result = await this.uploadLaborCase(caseDoc);
        results.push({ success: true, ...result });
      } catch (error) {
        console.error(`✗ 업로드 실패 (${caseDoc.title}):`, error.message);
        results.push({
          success: false,
          title: caseDoc.title,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✓ 판례 일괄 업로드 완료: ${successCount}/${caseDocuments.length} 성공`);

    return results;
  }
}

module.exports = RAGAgent;
