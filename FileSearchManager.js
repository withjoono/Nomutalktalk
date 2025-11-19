const { GoogleGenAI } = require('@google/genai');

/**
 * Gemini API의 File Search 기능을 쉽게 사용할 수 있도록 추상화한 클래스
 */
class FileSearchManager {
  /**
   * @param {string} apiKey - Google Gemini API 키
   */
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('API 키가 필요합니다');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * 새로운 File Search Store 생성
   * @param {string} displayName - 스토어 이름
   * @returns {Promise<Object>} 생성된 스토어 정보
   */
  async createStore(displayName) {
    const store = await this.ai.fileSearchStores.create({
      config: { displayName }
    });
    return store;
  }

  /**
   * 모든 File Search Store 목록 조회
   * @param {number} pageSize - 페이지당 항목 수 (기본값: 20)
   * @returns {Promise<Array>} 스토어 목록
   */
  async listStores(pageSize = 20) {
    const stores = await this.ai.fileSearchStores.list({
      config: { pageSize }
    });
    const storeList = [];
    for await (const store of stores) {
      storeList.push(store);
    }
    return storeList;
  }

  /**
   * 특정 File Search Store 조회
   * @param {string} storeName - 스토어 이름 (예: 'fileSearchStores/xxx')
   * @returns {Promise<Object>} 스토어 정보
   */
  async getStore(storeName) {
    const store = await this.ai.fileSearchStores.get({
      name: storeName
    });
    return store;
  }

  /**
   * 특정 스토어 삭제
   * @param {string} storeName - 삭제할 스토어 이름 (예: 'fileSearchStores/xxx')
   * @param {boolean} force - 비어있지 않은 스토어도 강제 삭제 (기본값: true)
   */
  async deleteStore(storeName, force = true) {
    await this.ai.fileSearchStores.delete({
      name: storeName,
      config: { force }
    });
  }

  /**
   * 스토어에 파일 업로드
   * @param {string} filePath - 업로드할 파일 경로
   * @param {string} storeName - 스토어 이름 (예: 'fileSearchStores/xxx')
   * @param {Object} options - 업로드 옵션
   * @param {string} options.mimeType - 파일의 MIME 타입 (예: 'application/x-hwp')
   * @param {number} options.pollInterval - 업로드 완료 체크 간격 (밀리초, 기본값: 5000)
   * @param {Object} options.chunkingConfig - 청크 구성 설정
   * @param {Object} options.chunkingConfig.whiteSpaceConfig - 공백 기반 청킹 설정
   * @param {number} options.chunkingConfig.whiteSpaceConfig.maxTokensPerChunk - 청크당 최대 토큰 수
   * @param {number} options.chunkingConfig.whiteSpaceConfig.maxOverlapTokens - 청크 간 오버랩 토큰 수
   * @returns {Promise<Object>} 완료된 작업 정보
   */
  async uploadFile(filePath, storeName, options = {}) {
    const { mimeType, pollInterval = 5000, chunkingConfig } = options;

    const uploadParams = {
      file: filePath,
      fileSearchStoreName: storeName,
    };

    // config 설정
    const config = {};

    if (mimeType) {
      config.mimeType = mimeType;
    }

    if (chunkingConfig) {
      config.chunkingConfig = this._buildChunkingConfig(chunkingConfig);
    }

    if (Object.keys(config).length > 0) {
      uploadParams.config = config;
    }

    let operation = await this.ai.fileSearchStores.uploadToFileSearchStore(uploadParams);

    // 업로드 완료까지 대기
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      operation = await this.ai.operations.get({ operation });
    }

    return operation;
  }

  /**
   * 스토어 내 문서 목록 조회
   * @param {string} storeName - 스토어 이름 (예: 'fileSearchStores/xxx')
   * @returns {Promise<Array>} 문서 목록
   */
  async listDocuments(storeName) {
    const documents = await this.ai.fileSearchStores.documents.list({
      parent: storeName
    });
    const docList = [];
    for await (const doc of documents) {
      docList.push(doc);
    }
    return docList;
  }

  /**
   * 스토어에서 문서 삭제
   * @param {string} documentName - 삭제할 문서 이름 (예: 'fileSearchStores/xxx/documents/yyy')
   * @param {boolean} force - 강제 삭제 여부 (기본값: true)
   */
  async deleteDocument(documentName, force = true) {
    await this.ai.fileSearchStores.documents.delete({
      name: documentName,
      config: { force }
    });
  }

  /**
   * File Search를 사용하여 질문에 답변
   * @param {string} query - 질문 내용
   * @param {string|Array<string>} storeNames - 검색할 스토어 이름(들)
   * @param {string} model - 사용할 모델 (기본값: 'gemini-2.5-flash')
   * @returns {Promise<string>} 답변 텍스트
   */
  async search(query, storeNames, model = 'gemini-2.5-flash') {
    // storeNames를 배열로 정규화
    const storeNameArray = Array.isArray(storeNames) ? storeNames : [storeNames];

    const response = await this.ai.models.generateContent({
      model,
      contents: query,
      config: {
        tools: [{
          fileSearch: {
            fileSearchStoreNames: storeNameArray
          }
        }]
      }
    });

    return response.text;
  }

  /**
   * Files API를 사용하여 파일 업로드 (Store와 독립적)
   * @param {string} filePath - 업로드할 파일 경로
   * @param {Object} options - 업로드 옵션
   * @param {string} options.displayName - 파일 표시 이름 (인용에 표시됨)
   * @param {string} options.mimeType - 파일 MIME 타입
   * @returns {Promise<Object>} 업로드된 파일 정보
   */
  async uploadFileToFilesAPI(filePath, options = {}) {
    const uploadParams = {
      file: filePath
    };

    // config 설정 (displayName 또는 name)
    if (options.displayName || options.mimeType) {
      uploadParams.config = {};
      if (options.displayName) {
        uploadParams.config.name = options.displayName;
      }
      if (options.mimeType) {
        uploadParams.config.mimeType = options.mimeType;
      }
    }

    const file = await this.ai.files.upload(uploadParams);
    return file;
  }

  /**
   * Files API에 업로드된 파일을 File Search Store로 가져오기
   * @param {string} storeName - 스토어 이름 (예: 'fileSearchStores/xxx')
   * @param {string} fileName - Files API에 업로드된 파일 이름 (예: 'files/xxx')
   * @param {Object} options - 가져오기 옵션
   * @param {number} options.pollInterval - 가져오기 완료 체크 간격 (밀리초, 기본값: 5000)
   * @param {Object} options.chunkingConfig - 청크 구성 설정
   * @param {Object} options.chunkingConfig.whiteSpaceConfig - 공백 기반 청킹 설정
   * @param {number} options.chunkingConfig.whiteSpaceConfig.maxTokensPerChunk - 청크당 최대 토큰 수
   * @param {number} options.chunkingConfig.whiteSpaceConfig.maxOverlapTokens - 청크 간 오버랩 토큰 수
   * @param {Array<Object>} options.customMetadata - 커스텀 메타데이터 배열
   * @param {string} options.customMetadata[].key - 메타데이터 키
   * @param {string} options.customMetadata[].stringValue - 문자열 값 (선택사항)
   * @param {number} options.customMetadata[].numericValue - 숫자 값 (선택사항)
   * @returns {Promise<Object>} 완료된 작업 정보
   */
  async importFileToStore(storeName, fileName, options = {}) {
    const { pollInterval = 5000, chunkingConfig, customMetadata } = options;

    const importParams = {
      fileSearchStoreName: storeName,
      fileName: fileName
    };

    // config 설정 (청킹 또는 메타데이터)
    const config = {};

    if (chunkingConfig) {
      config.chunkingConfig = this._buildChunkingConfig(chunkingConfig);
    }

    if (customMetadata) {
      config.customMetadata = this._buildCustomMetadata(customMetadata);
    }

    if (Object.keys(config).length > 0) {
      importParams.config = config;
    }

    let operation = await this.ai.fileSearchStores.importFile(importParams);

    // 가져오기 완료까지 대기
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      operation = await this.ai.operations.get({ operation });
    }

    return operation;
  }

  /**
   * Files API 파일 목록 조회
   * @param {number} pageSize - 페이지당 항목 수 (기본값: 20)
   * @returns {Promise<Array>} 파일 목록
   */
  async listFilesAPIFiles(pageSize = 20) {
    const files = await this.ai.files.list({
      config: { pageSize }
    });
    const fileList = [];
    for await (const file of files) {
      fileList.push(file);
    }
    return fileList;
  }

  /**
   * Files API 파일 삭제
   * @param {string} fileName - 삭제할 파일 이름 (예: 'files/xxx')
   * @returns {Promise<void>}
   */
  async deleteFileFromFilesAPI(fileName) {
    await this.ai.files.delete({ name: fileName });
  }

  /**
   * Files API 파일 정보 조회
   * @param {string} fileName - 파일 이름 (예: 'files/xxx')
   * @returns {Promise<Object>} 파일 정보
   */
  async getFileInfo(fileName) {
    return await this.ai.files.get({ name: fileName });
  }

  /**
   * 청킹 설정 빌더 (내부 헬퍼 메서드)
   * @param {Object} chunkingConfig - 청킹 설정
   * @returns {Object} API 형식의 청킹 설정
   * @private
   */
  _buildChunkingConfig(chunkingConfig) {
    const config = {};

    // whiteSpaceConfig 처리
    if (chunkingConfig.whiteSpaceConfig) {
      config.whiteSpaceConfig = {};

      if (chunkingConfig.whiteSpaceConfig.maxTokensPerChunk !== undefined) {
        config.whiteSpaceConfig.maxTokensPerChunk = chunkingConfig.whiteSpaceConfig.maxTokensPerChunk;
      }

      if (chunkingConfig.whiteSpaceConfig.maxOverlapTokens !== undefined) {
        config.whiteSpaceConfig.maxOverlapTokens = chunkingConfig.whiteSpaceConfig.maxOverlapTokens;
      }
    }

    return config;
  }

  /**
   * 청킹 설정 검증 (내부 헬퍼 메서드)
   * @param {Object} chunkingConfig - 청킹 설정
   * @throws {Error} 유효하지 않은 설정
   * @private
   */
  _validateChunkingConfig(chunkingConfig) {
    if (!chunkingConfig) return;

    if (chunkingConfig.whiteSpaceConfig) {
      const { maxTokensPerChunk, maxOverlapTokens } = chunkingConfig.whiteSpaceConfig;

      if (maxTokensPerChunk !== undefined) {
        if (typeof maxTokensPerChunk !== 'number' || maxTokensPerChunk <= 0) {
          throw new Error('maxTokensPerChunk는 양수여야 합니다');
        }
      }

      if (maxOverlapTokens !== undefined) {
        if (typeof maxOverlapTokens !== 'number' || maxOverlapTokens < 0) {
          throw new Error('maxOverlapTokens는 0 이상이어야 합니다');
        }
      }

      if (maxTokensPerChunk !== undefined && maxOverlapTokens !== undefined) {
        if (maxOverlapTokens >= maxTokensPerChunk) {
          throw new Error('maxOverlapTokens는 maxTokensPerChunk보다 작아야 합니다');
        }
      }
    }
  }

  /**
   * 커스텀 메타데이터 빌더 (내부 헬퍼 메서드)
   * @param {Array<Object>} customMetadata - 메타데이터 배열
   * @returns {Array<Object>} API 형식의 메타데이터
   * @private
   */
  _buildCustomMetadata(customMetadata) {
    if (!Array.isArray(customMetadata)) {
      throw new Error('customMetadata는 배열이어야 합니다');
    }

    return customMetadata.map(item => {
      if (!item.key) {
        throw new Error('메타데이터 항목에는 key가 필요합니다');
      }

      const metadata = { key: item.key };

      // stringValue 또는 numericValue 중 하나만 있어야 함
      if (item.stringValue !== undefined && item.numericValue !== undefined) {
        throw new Error('stringValue와 numericValue는 동시에 사용할 수 없습니다');
      }

      if (item.stringValue !== undefined) {
        metadata.stringValue = String(item.stringValue);
      } else if (item.numericValue !== undefined) {
        if (typeof item.numericValue !== 'number') {
          throw new Error('numericValue는 숫자여야 합니다');
        }
        metadata.numericValue = item.numericValue;
      } else {
        throw new Error('stringValue 또는 numericValue 중 하나가 필요합니다');
      }

      return metadata;
    });
  }

  /**
   * 커스텀 메타데이터 검증 (내부 헬퍼 메서드)
   * @param {Array<Object>} customMetadata - 메타데이터 배열
   * @throws {Error} 유효하지 않은 메타데이터
   * @private
   */
  _validateCustomMetadata(customMetadata) {
    if (!customMetadata) return;

    if (!Array.isArray(customMetadata)) {
      throw new Error('customMetadata는 배열이어야 합니다');
    }

    customMetadata.forEach((item, index) => {
      if (!item.key || typeof item.key !== 'string') {
        throw new Error(`메타데이터 항목 ${index}: key는 필수 문자열입니다`);
      }

      const hasStringValue = item.stringValue !== undefined;
      const hasNumericValue = item.numericValue !== undefined;

      if (!hasStringValue && !hasNumericValue) {
        throw new Error(`메타데이터 항목 ${index}: stringValue 또는 numericValue가 필요합니다`);
      }

      if (hasStringValue && hasNumericValue) {
        throw new Error(`메타데이터 항목 ${index}: stringValue와 numericValue는 동시에 사용할 수 없습니다`);
      }

      if (hasNumericValue && typeof item.numericValue !== 'number') {
        throw new Error(`메타데이터 항목 ${index}: numericValue는 숫자여야 합니다`);
      }
    });
  }

  /**
   * 스토어 정보 조회 (디버깅용)
   * @param {string} storeName - 스토어 이름
   * @returns {Promise<Object>} 스토어 정보 (documentCount, documents)
   */
  async getStoreInfo(storeName) {
    const docs = await this.listDocuments(storeName);
    return {
      storeName,
      documentCount: docs.length,
      documents: docs
    };
  }
}

module.exports = FileSearchManager;
