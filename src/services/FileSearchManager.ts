const { GoogleGenAI } = require('@google/genai');
import { ChunkingConfig, CustomMetadataItem, StoreInfo } from '../models/types';

interface UploadOptions {
  mimeType?: string;
  pollInterval?: number;
  chunkingConfig?: ChunkingConfig;
}

interface ImportOptions {
  pollInterval?: number;
  chunkingConfig?: ChunkingConfig;
  customMetadata?: CustomMetadataItem[];
}

interface FileUploadOptions {
  displayName?: string;
  mimeType?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// GoogleGenAI 라이브러리 타입이 완전하지 않아 any 사용
type GenAIClient = any;

/**
 * Gemini API의 File Search 기능을 쉽게 사용할 수 있도록 추상화한 클래스
 */
export class FileSearchManager {
  private ai: GenAIClient;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('API 키가 필요합니다');
    }
    this.ai = new GoogleGenAI({ apiKey }) as GenAIClient;
  }

  /**
   * 새로운 File Search Store 생성
   */
  async createStore(displayName: string): Promise<unknown> {
    const store = await this.ai.fileSearchStores.create({
      config: { displayName },
    });
    return store;
  }

  /**
   * 모든 File Search Store 목록 조회
   */
  async listStores(pageSize = 20): Promise<unknown[]> {
    const stores = await this.ai.fileSearchStores.list({
      config: { pageSize },
    });
    const storeList: unknown[] = [];
    for await (const store of stores) {
      storeList.push(store);
    }
    return storeList;
  }

  /**
   * 특정 File Search Store 조회
   */
  async getStore(storeName: string): Promise<unknown> {
    const store = await this.ai.fileSearchStores.get({
      name: storeName,
    });
    return store;
  }

  /**
   * 특정 스토어 삭제
   */
  async deleteStore(storeName: string, force = true): Promise<void> {
    await this.ai.fileSearchStores.delete({
      name: storeName,
      config: { force },
    });
  }

  /**
   * 스토어 이름(displayName) 수정
   */
  async renameStore(storeName: string, newDisplayName: string): Promise<unknown> {
    const updatedStore = await this.ai.fileSearchStores.update({
      name: storeName,
      config: { displayName: newDisplayName },
    });
    return updatedStore;
  }

  /**
   * 스토어에 파일 업로드
   */
  async uploadFile(
    filePath: string,
    storeName: string,
    options: UploadOptions = {}
  ): Promise<unknown> {
    const { mimeType, pollInterval = 5000, chunkingConfig } = options;

    const uploadParams: Record<string, unknown> = {
      file: filePath,
      fileSearchStoreName: storeName,
    };

    const config: Record<string, unknown> = {};

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

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      operation = await this.ai.operations.get({ operation });
    }

    return operation;
  }

  /**
   * 스토어 내 문서 목록 조회
   */
  async listDocuments(storeName: string): Promise<unknown[]> {
    const documents = await this.ai.fileSearchStores.documents.list({
      parent: storeName,
    });
    const docList: unknown[] = [];
    for await (const doc of documents) {
      docList.push(doc);
    }
    return docList;
  }

  /**
   * 스토어에서 문서 삭제
   */
  async deleteDocument(documentName: string, force = true): Promise<void> {
    await this.ai.fileSearchStores.documents.delete({
      name: documentName,
      config: { force },
    });
  }

  /**
   * File Search를 사용하여 질문에 답변
   */
  async search(
    query: string,
    storeNames: string | string[],
    model = 'gemini-2.5-flash'
  ): Promise<string> {
    const storeNameArray = Array.isArray(storeNames) ? storeNames : [storeNames];

    const systemPrompt = this._getSystemPrompt();
    const enhancedQuery = `${systemPrompt}\n\n---\n\n이제 다음 질문에 답변하세요. 위의 가이드라인을 반드시 따라 그래프를 포함하세요:\n\n${query}`;

    const response = await this.ai.models.generateContent({
      model,
      contents: enhancedQuery,
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: storeNameArray,
            },
          },
        ],
      },
    });

    console.log('\n🔍 API 응답 구조 디버깅:');
    console.log('response.candidates:', JSON.stringify(response.candidates, null, 2));

    const parts = response.candidates?.[0]?.content?.parts;
    let answerText = '응답을 생성할 수 없습니다.';

    if (parts && Array.isArray(parts)) {
      answerText = parts.map((part: { text?: string }) => part.text || '').join('');
      console.log(`✅ ${parts.length}개의 parts를 합쳤습니다.`);
    } else if (response.text) {
      answerText = response.text;
    }

    console.log('추출된 answerText 길이:', answerText.length);
    console.log('추출된 answerText (처음 200자):', answerText.substring(0, 200));
    console.log('='.repeat(80) + '\n');

    return answerText;
  }

  /**
   * Files API를 사용하여 파일 업로드 (Store와 독립적)
   */
  async uploadFileToFilesAPI(filePath: string, options: FileUploadOptions = {}): Promise<unknown> {
    const uploadParams: Record<string, unknown> = {
      file: filePath,
    };

    if (options.displayName || options.mimeType) {
      uploadParams.config = {};
      if (options.displayName) {
        (uploadParams.config as Record<string, unknown>).name = options.displayName;
      }
      if (options.mimeType) {
        (uploadParams.config as Record<string, unknown>).mimeType = options.mimeType;
      }
    }

    const file = await this.ai.files.upload(uploadParams);
    return file;
  }

  /**
   * Files API에 업로드된 파일을 File Search Store로 가져오기
   */
  async importFileToStore(
    storeName: string,
    fileName: string,
    options: ImportOptions = {}
  ): Promise<unknown> {
    const { pollInterval = 5000, chunkingConfig, customMetadata } = options;

    const importParams: Record<string, unknown> = {
      fileSearchStoreName: storeName,
      fileName: fileName,
    };

    const config: Record<string, unknown> = {};

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

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      operation = await this.ai.operations.get({ operation });
    }

    return operation;
  }

  /**
   * Files API 파일 목록 조회
   */
  async listFilesAPIFiles(pageSize = 20): Promise<unknown[]> {
    const files = await this.ai.files.list({
      config: { pageSize },
    });
    const fileList: unknown[] = [];
    for await (const file of files) {
      fileList.push(file);
    }
    return fileList;
  }

  /**
   * Files API 파일 삭제
   */
  async deleteFileFromFilesAPI(fileName: string): Promise<void> {
    await this.ai.files.delete({ name: fileName });
  }

  /**
   * Files API 파일 정보 조회
   */
  async getFileInfo(fileName: string): Promise<unknown> {
    return await this.ai.files.get({ name: fileName });
  }

  /**
   * 청킹 설정 빌더 (내부 헬퍼 메서드)
   */
  _buildChunkingConfig(chunkingConfig: ChunkingConfig): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    if (chunkingConfig.whiteSpaceConfig) {
      config.whiteSpaceConfig = {};

      if (chunkingConfig.whiteSpaceConfig.maxTokensPerChunk !== undefined) {
        (config.whiteSpaceConfig as Record<string, unknown>).maxTokensPerChunk =
          chunkingConfig.whiteSpaceConfig.maxTokensPerChunk;
      }

      if (chunkingConfig.whiteSpaceConfig.maxOverlapTokens !== undefined) {
        (config.whiteSpaceConfig as Record<string, unknown>).maxOverlapTokens =
          chunkingConfig.whiteSpaceConfig.maxOverlapTokens;
      }
    }

    return config;
  }

  /**
   * 청킹 설정 검증 (내부 헬퍼 메서드)
   */
  _validateChunkingConfig(chunkingConfig?: ChunkingConfig): void {
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
   */
  _buildCustomMetadata(customMetadata: CustomMetadataItem[]): Record<string, unknown>[] {
    if (!Array.isArray(customMetadata)) {
      throw new Error('customMetadata는 배열이어야 합니다');
    }

    return customMetadata.map(item => {
      if (!item.key) {
        throw new Error('메타데이터 항목에는 key가 필요합니다');
      }

      const metadata: Record<string, unknown> = { key: item.key };

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
   */
  _validateCustomMetadata(customMetadata?: CustomMetadataItem[]): void {
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
        throw new Error(
          `메타데이터 항목 ${index}: stringValue와 numericValue는 동시에 사용할 수 없습니다`
        );
      }

      if (hasNumericValue && typeof item.numericValue !== 'number') {
        throw new Error(`메타데이터 항목 ${index}: numericValue는 숫자여야 합니다`);
      }
    });
  }

  /**
   * 스토어 정보 조회 (디버깅용)
   */
  async getStoreInfo(storeName: string): Promise<StoreInfo> {
    const docs = await this.listDocuments(storeName);
    return {
      storeName,
      documentCount: docs.length,
      documents: docs,
    };
  }

  /**
   * 시스템 프롬프트 생성 (내부 헬퍼 메서드)
   */
  private _getSystemPrompt(): string {
    return `당신은 전문 교육 AI 어시스턴트입니다. 답변 시 다음 규칙을 **반드시** 따르세요:

## ⚠️ 중요: 시각화 필수 규칙

다음 상황에서는 **반드시** 그래프/다이어그램을 포함해야 합니다:
- 기하학적 도형, 좌표평면, 함수 그래프가 언급되는 경우
- 수학 문제에서 시각적 이해가 필요한 경우
- 프로세스, 순서도, 관계도가 필요한 경우
- 통계 데이터, 비교 분석이 필요한 경우

**텍스트 설명만으로는 부족합니다. 반드시 시각화를 포함하세요!**`;
  }
}

export default FileSearchManager;
