import * as fs from 'fs';
import * as path from 'path';
import { FileSearchManager } from './FileSearchManager';
import {
  ChunkingConfig,
  CustomMetadataItem,
  DocumentType,
  DocumentMetadata,
  StoreInfo,
  UploadResult,
} from '../models/types';

interface RAGAgentOptions {
  storeName?: string;
  model?: string;
  uploadPollInterval?: number;
}

interface FileUploadOptions {
  displayName?: string;
  mimeType?: string;
  chunkingConfig?: ChunkingConfig;
  customMetadata?: CustomMetadataItem[];
}

interface FileInput {
  path: string;
  displayName?: string;
  mimeType?: string;
  chunkingConfig?: ChunkingConfig;
}

interface EducationalDocument {
  id: string;
  documentType: DocumentType;
  title: string;
  metadata?: DocumentMetadata;
  filePath: string;
}

interface UploadAndImportResult extends UploadResult {
  filesAPIName?: string;
  customMetadata?: CustomMetadataItem[];
  uploadedFile?: unknown;
}

interface EducationalUploadResult extends UploadAndImportResult {
  documentId: string;
  documentType: DocumentType;
  metadataFields: number;
}

/**
 * Google File Search RAG (Retrieval-Augmented Generation) Agent
 * 파일을 업로드하고 검색 기반 질의응답을 수행하는 에이전트
 */
export class RAGAgent {
  private manager: FileSearchManager;
  private storeName: string | null;
  private model: string;
  private uploadPollInterval: number;

  constructor(apiKey: string, options: RAGAgentOptions = {}) {
    this.manager = new FileSearchManager(apiKey);
    this.storeName = options.storeName || null;
    this.model = options.model || 'gemini-2.5-flash';
    this.uploadPollInterval = options.uploadPollInterval || 5000;
  }

  /**
   * 에이전트 초기화 (스토어 생성 또는 기존 스토어 사용)
   */
  async initialize(displayName?: string): Promise<string> {
    if (this.storeName) {
      console.log(`✓ 기존 스토어 사용: ${this.storeName}`);
      return this.storeName;
    }

    if (!displayName) {
      throw new Error(
        '스토어 이름이 필요합니다 (displayName 파라미터 또는 생성자 options.storeName)'
      );
    }

    console.log(`🔧 새 스토어 생성 중: ${displayName}...`);
    const store = (await this.manager.createStore(displayName)) as { name: string };
    this.storeName = store.name;
    console.log(`✓ 스토어 생성 완료: ${this.storeName}`);

    return this.storeName;
  }

  /**
   * 파일을 스토어에 직접 업로드
   */
  async uploadFile(filePath: string, options: FileUploadOptions = {}): Promise<UploadResult> {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다. initialize() 메서드를 먼저 호출하세요.');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }

    if (options.chunkingConfig) {
      this.manager._validateChunkingConfig(options.chunkingConfig);
    }

    const fileName = options.displayName || path.basename(filePath);
    const chunkInfo = options.chunkingConfig
      ? ` (청크 설정: ${JSON.stringify(options.chunkingConfig.whiteSpaceConfig)})`
      : '';
    console.log(`📤 파일 업로드 중: ${fileName}${chunkInfo}...`);

    const operation = await this.manager.uploadFile(filePath, this.storeName, {
      mimeType: options.mimeType,
      pollInterval: this.uploadPollInterval,
      chunkingConfig: options.chunkingConfig,
    });

    console.log(`✓ 업로드 완료: ${fileName}`);

    return {
      success: true,
      fileName,
      filePath,
      storeName: this.storeName,
      chunkingConfig: options.chunkingConfig,
      operation,
    };
  }

  /**
   * 여러 파일을 일괄 업로드
   */
  async uploadFiles(files: (string | FileInput)[]): Promise<UploadResult[]> {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('업로드할 파일 목록이 필요합니다');
    }

    console.log(`📤 ${files.length}개 파일 일괄 업로드 시작...`);

    const results: UploadResult[] = [];
    for (const file of files) {
      const filePath = typeof file === 'string' ? file : file.path;
      const options = typeof file === 'object' ? file : {};

      try {
        const result = await this.uploadFile(filePath, options);
        results.push(result);
      } catch (error) {
        console.error(`✗ 업로드 실패 (${filePath}):`, (error as Error).message);
        results.push({
          success: false,
          filePath,
          error: (error as Error).message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✓ 일괄 업로드 완료: ${successCount}/${files.length} 성공`);

    return results;
  }

  /**
   * Files API를 통해 파일을 업로드하고 스토어로 가져오기 (2단계 프로세스)
   */
  async uploadAndImportFile(
    filePath: string,
    options: FileUploadOptions = {}
  ): Promise<UploadAndImportResult> {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다. initialize() 메서드를 먼저 호출하세요.');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }

    if (options.chunkingConfig) {
      this.manager._validateChunkingConfig(options.chunkingConfig);
    }

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

    const uploadedFile = (await this.manager.uploadFileToFilesAPI(filePath, options)) as {
      name: string;
    };
    console.log(`✓ Files API 업로드 완료: ${uploadedFile.name}`);

    console.log(`📥 2단계: 스토어로 파일 가져오기 중...`);
    const operation = await this.manager.importFileToStore(this.storeName, uploadedFile.name, {
      pollInterval: this.uploadPollInterval,
      chunkingConfig: options.chunkingConfig,
      customMetadata: options.customMetadata,
    });

    console.log(`✓ 가져오기 완료: ${fileName}`);

    return {
      success: true,
      fileName,
      filePath,
      filesAPIName: uploadedFile.name,
      storeName: this.storeName,
      chunkingConfig: options.chunkingConfig,
      customMetadata: options.customMetadata,
      uploadedFile,
      operation,
    };
  }

  /**
   * 여러 파일을 Files API를 통해 일괄 업로드 및 가져오기
   */
  async uploadAndImportFiles(files: (string | FileInput)[]): Promise<UploadAndImportResult[]> {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('업로드할 파일 목록이 필요합니다');
    }

    console.log(`📤 ${files.length}개 파일 일괄 업로드 및 가져오기 시작...`);

    const results: UploadAndImportResult[] = [];
    for (const file of files) {
      const filePath = typeof file === 'string' ? file : file.path;
      const options = typeof file === 'object' ? file : {};

      try {
        const result = await this.uploadAndImportFile(filePath, options);
        results.push(result);
      } catch (error) {
        console.error(`✗ 가져오기 실패 (${filePath}):`, (error as Error).message);
        results.push({
          success: false,
          filePath,
          error: (error as Error).message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✓ 일괄 가져오기 완료: ${successCount}/${files.length} 성공`);

    return results;
  }

  /**
   * Files API에 업로드된 파일 목록 조회
   */
  async listUploadedFiles(): Promise<unknown[]> {
    return await this.manager.listFilesAPIFiles();
  }

  /**
   * Files API에서 파일 삭제
   */
  async deleteUploadedFile(fileName: string): Promise<void> {
    console.log(`🗑️  Files API에서 파일 삭제 중: ${fileName}...`);
    await this.manager.deleteFileFromFilesAPI(fileName);
    console.log(`✓ 파일 삭제 완료`);
  }

  /**
   * 파일 검색 기반 질의응답
   */
  async ask(query: string, options: { model?: string } = {}): Promise<string> {
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
   */
  async getStatus(): Promise<StoreInfo> {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다');
    }

    return await this.manager.getStoreInfo(this.storeName);
  }

  /**
   * 특정 문서 삭제
   */
  async deleteDocument(documentName: string): Promise<void> {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다');
    }

    console.log(`🗑️  문서 삭제 중: ${documentName}...`);
    await this.manager.deleteDocument(documentName);
    console.log(`✓ 문서 삭제 완료`);
  }

  /**
   * 스토어의 모든 문서 조회
   */
  async listDocuments(): Promise<unknown[]> {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다');
    }

    return await this.manager.listDocuments(this.storeName);
  }

  /**
   * 모든 File Search Store 목록 조회
   */
  async listStores(pageSize = 20): Promise<unknown[]> {
    return await this.manager.listStores(pageSize);
  }

  /**
   * 특정 File Search Store 정보 조회
   */
  async getStore(storeName: string | null = null): Promise<unknown> {
    const targetStore = storeName || this.storeName;

    if (!targetStore) {
      throw new Error('스토어 이름이 필요합니다 (파라미터 또는 초기화된 스토어)');
    }

    return await this.manager.getStore(targetStore);
  }

  /**
   * 특정 File Search Store 삭제
   */
  async deleteStore(storeName: string, force = true): Promise<void> {
    if (!storeName) {
      throw new Error('삭제할 스토어 이름이 필요합니다');
    }

    console.log(`🗑️  스토어 삭제 중: ${storeName}...`);
    await this.manager.deleteStore(storeName, force);
    console.log(`✓ 스토어 삭제 완료`);

    if (storeName === this.storeName) {
      this.storeName = null;
    }
  }

  /**
   * 에이전트 정리 (현재 스토어 삭제)
   */
  async cleanup(force = true): Promise<void> {
    if (!this.storeName) {
      console.log('⚠️  정리할 스토어가 없습니다');
      return;
    }

    await this.deleteStore(this.storeName, force);
  }

  // ==================== 교육 콘텐츠 RAG 확장 메서드 ====================

  /**
   * 교육 문서 업로드 (메타데이터 전파 포함)
   */
  async uploadEducationalDocument(
    document: EducationalDocument,
    options: FileUploadOptions = {}
  ): Promise<EducationalUploadResult> {
    if (!this.storeName) {
      throw new Error('에이전트가 초기화되지 않았습니다. initialize() 메서드를 먼저 호출하세요.');
    }

    const { filePath, documentType, metadata, title } = document;

    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }

    const customMetadata = this.buildCustomMetadata(documentType, metadata);
    const chunkingConfig = options.chunkingConfig || this.getChunkingConfig(documentType);

    console.log(`📤 교육 문서 업로드: ${title} (유형: ${documentType})`);
    console.log(`   메타데이터 필드: ${customMetadata.length}개`);

    const result = await this.uploadAndImportFile(filePath, {
      displayName: title,
      mimeType: options.mimeType || this.getMimeType(filePath),
      chunkingConfig,
      customMetadata,
    });

    return {
      ...result,
      documentId: document.id,
      documentType,
      metadataFields: customMetadata.length,
    };
  }

  /**
   * 문서 유형에 따른 커스텀 메타데이터 생성 (Gemini File Search 호환)
   */
  buildCustomMetadata(
    documentType: DocumentType,
    metadata?: DocumentMetadata
  ): CustomMetadataItem[] {
    const customMetadata: CustomMetadataItem[] = [];

    customMetadata.push({
      key: 'document_type',
      stringValue: documentType,
    });

    if (!metadata) return customMetadata;

    const meta = metadata as Record<string, unknown>;

    switch (documentType) {
      case 'textbook':
      case 'supplementary':
        this._addStringField(customMetadata, 'domain', meta.domain as string);
        this._addStringField(customMetadata, 'subject', meta.subject as string);
        this._addStringField(customMetadata, 'curriculum', meta.curriculum as string);
        this._addStringField(customMetadata, 'publisher', meta.publisher as string);
        this._addStringField(customMetadata, 'content_type', meta.contentType as string);
        if (meta.unit) {
          const unit = meta.unit as { majorUnit?: string; middleUnit?: string };
          this._addStringField(customMetadata, 'major_unit', unit.majorUnit);
          this._addStringField(customMetadata, 'middle_unit', unit.middleUnit);
        }
        if (Array.isArray(meta.keyConcepts) && meta.keyConcepts.length > 0) {
          this._addStringField(customMetadata, 'key_concepts', meta.keyConcepts.join(', '));
        }
        break;

      case 'csat_past':
      case 'csat_mock':
      case 'school_exam':
        this._addStringField(customMetadata, 'exam_type', meta.examType as string);
        this._addNumericField(customMetadata, 'year', meta.year as number);
        this._addStringField(customMetadata, 'domain', meta.domain as string);
        this._addStringField(customMetadata, 'subject', meta.subject as string);
        this._addStringField(customMetadata, 'difficulty', meta.difficulty as string);
        this._addStringField(customMetadata, 'exam_institution', meta.examInstitution as string);
        if (meta.unit) {
          const unit = meta.unit as { majorUnit?: string };
          this._addStringField(customMetadata, 'major_unit', unit.majorUnit);
        }
        if (meta.zystoryUnit) {
          const zystory = meta.zystoryUnit as {
            majorUnit?: string;
            middleUnit?: string;
            typeName?: string;
          };
          this._addStringField(customMetadata, 'zystory_major', zystory.majorUnit);
          this._addStringField(customMetadata, 'zystory_middle', zystory.middleUnit);
          this._addStringField(customMetadata, 'zystory_type', zystory.typeName);
        }
        if (Array.isArray(meta.knowledgeType) && meta.knowledgeType.length > 0) {
          this._addStringField(customMetadata, 'knowledge_type', meta.knowledgeType.join(', '));
        }
        break;

      case 'university_essay':
        this._addStringField(customMetadata, 'university', meta.universityName as string);
        this._addStringField(customMetadata, 'campus', meta.campus as string);
        this._addNumericField(customMetadata, 'year', meta.year as number);
        this._addStringField(customMetadata, 'admission_type', meta.admissionType as string);
        this._addStringField(customMetadata, 'department', meta.department as string);
        this._addStringField(customMetadata, 'problem_type', meta.problemType as string);
        this._addStringField(customMetadata, 'difficulty', meta.difficulty as string);
        if (Array.isArray(meta.units) && meta.units.length > 0) {
          const unitNames = meta.units.map((u: { majorUnit?: string }) => u.majorUnit).join(', ');
          this._addStringField(customMetadata, 'units', unitNames);
        }
        if (Array.isArray(meta.thinkingProcess) && meta.thinkingProcess.length > 0) {
          this._addStringField(customMetadata, 'thinking_process', meta.thinkingProcess.join(', '));
        }
        break;

      case 'university_interview':
        this._addStringField(customMetadata, 'university', meta.universityName as string);
        this._addStringField(customMetadata, 'department', meta.department as string);
        this._addNumericField(customMetadata, 'year', meta.year as number);
        this._addStringField(customMetadata, 'admission_type', meta.admissionType as string);
        this._addStringField(customMetadata, 'interview_type', meta.interviewType as string);
        this._addNumericField(customMetadata, 'duration', meta.interviewDuration as number);
        if (Array.isArray(meta.evaluationCompetencies) && meta.evaluationCompetencies.length > 0) {
          this._addStringField(
            customMetadata,
            'competencies',
            meta.evaluationCompetencies.join(', ')
          );
        }
        break;

      case 'other':
      default:
        this._addStringField(customMetadata, 'category', meta.category as string);
        if (Array.isArray(meta.tags) && meta.tags.length > 0) {
          this._addStringField(customMetadata, 'tags', meta.tags.join(', '));
        }
        break;
    }

    return customMetadata;
  }

  /**
   * 문자열 메타데이터 필드 추가
   */
  private _addStringField(arr: CustomMetadataItem[], key: string, value?: string): void {
    if (value && typeof value === 'string') {
      arr.push({ key, stringValue: value });
    }
  }

  /**
   * 숫자 메타데이터 필드 추가
   */
  private _addNumericField(arr: CustomMetadataItem[], key: string, value?: number): void {
    if (value && typeof value === 'number') {
      arr.push({ key, numericValue: value });
    }
  }

  /**
   * 문서 유형별 최적 청킹 설정 반환
   */
  getChunkingConfig(documentType: DocumentType): ChunkingConfig {
    const configs: Record<string, ChunkingConfig> = {
      textbook: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 512,
          maxOverlapTokens: 64,
        },
      },
      supplementary: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 512,
          maxOverlapTokens: 64,
        },
      },
      csat_past: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 1024,
          maxOverlapTokens: 0,
        },
      },
      csat_mock: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 1024,
          maxOverlapTokens: 0,
        },
      },
      school_exam: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 1024,
          maxOverlapTokens: 0,
        },
      },
      university_essay: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 2048,
          maxOverlapTokens: 128,
        },
      },
      university_interview: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 1536,
          maxOverlapTokens: 64,
        },
      },
      default: {
        whiteSpaceConfig: {
          maxTokensPerChunk: 768,
          maxOverlapTokens: 64,
        },
      },
    };

    return configs[documentType] || configs['default'];
  }

  /**
   * 파일 경로에서 MIME 타입 추정
   */
  getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.html': 'text/html',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.csv': 'text/csv',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Gemini 클라이언트 접근자 (ChunkingService 등에서 사용)
   */
  get gemini(): unknown {
    return (this.manager as unknown as { genai: unknown }).genai;
  }
}

export default RAGAgent;
