/**
 * RAG 관리자 서비스
 *
 * 버전 관리, 에셋 페어링, 청크 관리 기능 제공
 * - 문서/청크 버전 관리 (생성, 승인, 히스토리)
 * - 이미지-캡션 페어링 관리
 * - 문제-자료 매칭 관리
 * - 별도 임베딩 벡터 생성
 */

import type {
  VersionInfo,
  VersionStatus,
  ChangeType,
  VersionedDocument,
  VersionHistory,
  ContentDiff,
  Asset,
  AssetType,
  AssetPairing,
  PairingStatus,
  RAGChunk,
  RAGChunkType,
  ChunkGroup,
  RAGManagerStats,
  PairingCandidate,
  VersionCompare,
  DocumentType,
} from '../models/types';

// Firebase Admin SDK 타입
interface FirebaseFirestore {
  collection: (path: string) => FirebaseCollection;
  batch: () => FirebaseBatch;
  runTransaction: <T>(fn: (transaction: FirebaseTransaction) => Promise<T>) => Promise<T>;
}

interface FirebaseCollection {
  doc: (id?: string) => FirebaseDocRef;
  where: (field: string, op: string, value: unknown) => FirebaseQuery;
  orderBy: (field: string, direction?: string) => FirebaseQuery;
  limit: (n: number) => FirebaseQuery;
  get: () => Promise<FirebaseQuerySnapshot>;
}

interface FirebaseQuery {
  where: (field: string, op: string, value: unknown) => FirebaseQuery;
  orderBy: (field: string, direction?: string) => FirebaseQuery;
  limit: (n: number) => FirebaseQuery;
  get: () => Promise<FirebaseQuerySnapshot>;
}

interface FirebaseDocRef {
  id: string;
  get: () => Promise<FirebaseDocSnapshot>;
  set: (data: unknown, options?: { merge?: boolean }) => Promise<void>;
  update: (data: unknown) => Promise<void>;
  delete: () => Promise<void>;
  collection: (path: string) => FirebaseCollection;
}

interface FirebaseDocSnapshot {
  exists: boolean;
  id: string;
  data: () => Record<string, unknown> | undefined;
}

interface FirebaseQuerySnapshot {
  empty: boolean;
  size: number;
  docs: FirebaseDocSnapshot[];
  forEach: (callback: (doc: FirebaseDocSnapshot) => void) => void;
}

interface FirebaseBatch {
  set: (ref: FirebaseDocRef, data: unknown, options?: { merge?: boolean }) => FirebaseBatch;
  update: (ref: FirebaseDocRef, data: unknown) => FirebaseBatch;
  delete: (ref: FirebaseDocRef) => FirebaseBatch;
  commit: () => Promise<void>;
}

interface FirebaseTransaction {
  get: (ref: FirebaseDocRef) => Promise<FirebaseDocSnapshot>;
  set: (ref: FirebaseDocRef, data: unknown, options?: { merge?: boolean }) => FirebaseTransaction;
  update: (ref: FirebaseDocRef, data: unknown) => FirebaseTransaction;
}

// Gemini Client 타입
interface GeminiClient {
  models: {
    generateContent: (params: {
      model: string;
      contents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>;
      generationConfig?: { temperature?: number; maxOutputTokens?: number };
    }) => Promise<{ text?: string }>;
    embedContent: (params: {
      model: string;
      content: { parts: Array<{ text: string }> };
    }) => Promise<{ embedding?: { values: number[] } }>;
  };
}

// 타입 안전한 데이터 캐스팅 헬퍼
function safeData<T>(doc: FirebaseDocSnapshot): T | null {
  if (!doc.exists) return null;
  return doc.data() as unknown as T;
}

export class RAGManagerService {
  private db: FirebaseFirestore;
  private gemini: GeminiClient | null;
  private embeddingModel = 'text-embedding-004';

  // 컬렉션 이름
  private readonly COLLECTIONS = {
    DOCUMENTS: 'rag_documents',
    CHUNKS: 'rag_chunks',
    ASSETS: 'rag_assets',
    PAIRINGS: 'rag_pairings',
    CHUNK_GROUPS: 'rag_chunk_groups',
    VERSION_HISTORY: 'rag_version_history',
  };

  constructor(db: FirebaseFirestore, geminiClient?: GeminiClient) {
    this.db = db;
    this.gemini = geminiClient || null;
  }

  // ============================================================
  // 버전 관리 메서드
  // ============================================================

  /**
   * 새 버전 생성
   */
  async createVersion(
    collectionName: string,
    documentId: string,
    data: Record<string, unknown>,
    options: {
      changeType: ChangeType;
      changeDescription?: string;
      createdBy?: string;
      autoApprove?: boolean;
    }
  ): Promise<{ versionId: string; version: number }> {
    const { changeType, changeDescription, createdBy, autoApprove = false } = options;

    return await this.db.runTransaction(async (transaction) => {
      // 기존 문서 가져오기
      const docRef = this.db.collection(collectionName).doc(documentId);
      const existingDoc = await transaction.get(docRef);

      let previousVersion = 0;
      let previousVersionId: string | undefined;

      if (existingDoc.exists) {
        const existingData = existingDoc.data();
        previousVersion = (existingData?.versionInfo as VersionInfo)?.version || 0;
        previousVersionId = existingDoc.id;
      }

      const newVersion = previousVersion + 1;
      const now = new Date();

      // 버전 정보 생성
      const versionInfo: VersionInfo = {
        version: newVersion,
        status: autoApprove ? 'approved' : 'draft',
        createdAt: now,
        createdBy,
        changeType,
        changeDescription,
        previousVersionId,
        ...(autoApprove && { approvedAt: now, approvedBy: createdBy }),
      };

      // 새 버전 ID 생성 (문서ID_v버전번호)
      const versionId = `${documentId}_v${newVersion}`;
      const versionDocRef = this.db.collection(collectionName).doc(versionId);

      // 새 버전 저장
      const versionedData = {
        ...data,
        id: versionId,
        originalDocumentId: documentId,
        versionInfo,
        isLatestApproved: autoApprove,
        ...(autoApprove && { latestApprovedVersionId: versionId }),
      };

      transaction.set(versionDocRef, versionedData);

      // 버전 히스토리 업데이트
      const historyRef = this.db.collection(this.COLLECTIONS.VERSION_HISTORY).doc(documentId);
      const historyDoc = await transaction.get(historyRef);

      const historyEntry = {
        versionId,
        version: newVersion,
        status: versionInfo.status,
        createdAt: now,
        createdBy,
        changeType,
        changeDescription,
      };

      if (historyDoc.exists) {
        const historyData = safeData<VersionHistory>(historyDoc);
        transaction.update(historyRef, {
          versions: [...(historyData?.versions || []), historyEntry],
        });
      } else {
        transaction.set(historyRef, {
          documentId,
          versions: [historyEntry],
        });
      }

      // 자동 승인인 경우 이전 버전들의 isLatestApproved 업데이트
      if (autoApprove && previousVersionId) {
        const prevDocRef = this.db.collection(collectionName).doc(previousVersionId);
        transaction.update(prevDocRef, { isLatestApproved: false });
      }

      return { versionId, version: newVersion };
    });
  }

  /**
   * 버전 승인
   */
  async approveVersion(
    collectionName: string,
    versionId: string,
    approvedBy?: string
  ): Promise<void> {
    await this.db.runTransaction(async (transaction) => {
      const docRef = this.db.collection(collectionName).doc(versionId);
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        throw new Error(`버전을 찾을 수 없습니다: ${versionId}`);
      }

      const data = safeData<VersionedDocument & { originalDocumentId: string }>(doc);
      const originalDocumentId = data?.originalDocumentId || '';

      // 현재 버전 승인
      const now = new Date();
      transaction.update(docRef, {
        'versionInfo.status': 'approved',
        'versionInfo.approvedAt': now,
        'versionInfo.approvedBy': approvedBy,
        isLatestApproved: true,
        latestApprovedVersionId: versionId,
      });

      // 이전 승인 버전들의 isLatestApproved 해제
      const previousApprovedQuery = await this.db
        .collection(collectionName)
        .where('originalDocumentId', '==', originalDocumentId)
        .where('isLatestApproved', '==', true)
        .get();

      previousApprovedQuery.forEach((prevDoc) => {
        if (prevDoc.id !== versionId) {
          transaction.update(
            this.db.collection(collectionName).doc(prevDoc.id),
            { isLatestApproved: false }
          );
        }
      });

      // 버전 히스토리 업데이트
      const historyRef = this.db.collection(this.COLLECTIONS.VERSION_HISTORY).doc(originalDocumentId);
      const historyDoc = await transaction.get(historyRef);

      if (historyDoc.exists) {
        const historyData = safeData<VersionHistory>(historyDoc);
        const updatedVersions = (historyData?.versions || []).map((v) =>
          v.versionId === versionId ? { ...v, status: 'approved' as VersionStatus } : v
        );
        transaction.update(historyRef, { versions: updatedVersions });
      }
    });
  }

  /**
   * 버전 히스토리 조회
   */
  async getVersionHistory(documentId: string): Promise<VersionHistory | null> {
    const historyRef = this.db.collection(this.COLLECTIONS.VERSION_HISTORY).doc(documentId);
    const historyDoc = await historyRef.get();

    if (!historyDoc.exists) {
      return null;
    }

    return safeData<VersionHistory>(historyDoc);
  }

  /**
   * 최신 승인 버전 조회 (RAG 검색용)
   */
  async getLatestApprovedVersion(
    collectionName: string,
    originalDocumentId: string
  ): Promise<VersionedDocument | null> {
    const query = await this.db
      .collection(collectionName)
      .where('originalDocumentId', '==', originalDocumentId)
      .where('isLatestApproved', '==', true)
      .limit(1)
      .get();

    if (query.empty) {
      return null;
    }

    return safeData<VersionedDocument>(query.docs[0]);
  }

  /**
   * 버전 비교
   */
  async compareVersions(
    collectionName: string,
    versionIdA: string,
    versionIdB: string
  ): Promise<VersionCompare> {
    const [docA, docB] = await Promise.all([
      this.db.collection(collectionName).doc(versionIdA).get(),
      this.db.collection(collectionName).doc(versionIdB).get(),
    ]);

    if (!docA.exists || !docB.exists) {
      throw new Error('하나 이상의 버전을 찾을 수 없습니다.');
    }

    const dataA = (docA.data() || {}) as unknown as Record<string, unknown>;
    const dataB = (docB.data() || {}) as unknown as Record<string, unknown>;

    const diffs: ContentDiff[] = [];
    const fieldsToCompare = ['content', 'title', 'description', 'metadata', 'problemData', 'conceptData'];

    for (const field of fieldsToCompare) {
      if (JSON.stringify(dataA[field]) !== JSON.stringify(dataB[field])) {
        diffs.push({
          field,
          before: dataA[field],
          after: dataB[field],
        });
      }
    }

    const summary = diffs.length === 0
      ? '변경 사항이 없습니다.'
      : `${diffs.length}개의 필드가 변경되었습니다: ${diffs.map((d) => d.field).join(', ')}`;

    return {
      versionA: versionIdA,
      versionB: versionIdB,
      diffs,
      summary,
    };
  }

  // ============================================================
  // 에셋 관리 메서드
  // ============================================================

  /**
   * 에셋 생성
   */
  async createAsset(
    assetData: Omit<Asset, 'id' | 'createdAt'>
  ): Promise<string> {
    const assetRef = this.db.collection(this.COLLECTIONS.ASSETS).doc();
    const now = new Date();

    const asset: Asset = {
      id: assetRef.id,
      ...assetData,
      createdAt: now,
    };

    await assetRef.set(asset);
    return assetRef.id;
  }

  /**
   * 에셋 페어링 생성
   */
  async createPairing(
    pairingData: Omit<AssetPairing, 'id' | 'createdAt'>
  ): Promise<string> {
    const pairingRef = this.db.collection(this.COLLECTIONS.PAIRINGS).doc();
    const now = new Date();

    const pairing: AssetPairing = {
      id: pairingRef.id,
      ...pairingData,
      createdAt: now,
    };

    await pairingRef.set(pairing);
    return pairingRef.id;
  }

  /**
   * 페어링 상태 업데이트
   */
  async updatePairingStatus(
    pairingId: string,
    status: PairingStatus,
    verifiedBy?: string,
    notes?: string
  ): Promise<void> {
    const pairingRef = this.db.collection(this.COLLECTIONS.PAIRINGS).doc(pairingId);
    const now = new Date();

    await pairingRef.update({
      pairingStatus: status,
      ...(status === 'verified' && { verifiedAt: now, verifiedBy }),
      ...(notes && { notes }),
      updatedAt: now,
    });
  }

  /**
   * 미페어링 에셋 조회
   */
  async getUnpairedAssets(): Promise<Asset[]> {
    const assetsSnapshot = await this.db.collection(this.COLLECTIONS.ASSETS).get();
    const pairingsSnapshot = await this.db.collection(this.COLLECTIONS.PAIRINGS).get();

    const pairedAssetIds = new Set<string>();
    pairingsSnapshot.forEach((doc) => {
      const pairing = doc.data() as unknown as AssetPairing;
      pairedAssetIds.add(pairing.assetId);
    });

    const unpairedAssets: Asset[] = [];
    assetsSnapshot.forEach((doc) => {
      if (!pairedAssetIds.has(doc.id)) {
        unpairedAssets.push(doc.data() as unknown as Asset);
      }
    });

    return unpairedAssets;
  }

  /**
   * 페어링 후보 추천 (AI 기반)
   */
  async suggestPairings(assetId: string): Promise<PairingCandidate[]> {
    if (!this.gemini) {
      throw new Error('Gemini 클라이언트가 초기화되지 않았습니다.');
    }

    // 에셋 정보 가져오기
    const assetDoc = await this.db.collection(this.COLLECTIONS.ASSETS).doc(assetId).get();
    if (!assetDoc.exists) {
      throw new Error(`에셋을 찾을 수 없습니다: ${assetId}`);
    }

    const asset = assetDoc.data() as unknown as Asset;

    // 최근 청크들 가져오기
    const chunksSnapshot = await this.db
      .collection(this.COLLECTIONS.CHUNKS)
      .where('isLatestApproved', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const chunks: RAGChunk[] = [];
    chunksSnapshot.forEach((doc) => {
      chunks.push(doc.data() as unknown as RAGChunk);
    });

    // AI에게 매칭 추천 요청
    const prompt = `다음 에셋과 가장 관련 있는 청크를 찾아주세요.

에셋 정보:
- 유형: ${asset.type}
- OCR 텍스트: ${asset.ocrText || '없음'}
- 설명: ${asset.description || '없음'}
- 캡션: ${asset.caption || '없음'}

청크 목록:
${chunks.map((c, i) => `[${i}] ID: ${c.id}, 유형: ${c.chunkType}, 내용 미리보기: ${c.content?.substring(0, 200)}`).join('\n')}

JSON 형식으로 상위 3개 매칭을 반환해주세요:
{
  "matches": [
    {
      "chunkIndex": 0,
      "confidence": 0.95,
      "relationship": "illustrates|supplements|contains_data|shows_solution|reference",
      "reason": "매칭 이유"
    }
  ]
}`;

    try {
      const response = await this.gemini.models.generateContent({
        model: 'gemini-2.5-flash-preview-05-20',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return (parsed.matches || []).map((m: { chunkIndex: number; confidence: number; relationship: string; reason: string }) => ({
          assetId,
          targetId: chunks[m.chunkIndex]?.id,
          confidence: m.confidence,
          suggestedRelationship: m.relationship as AssetPairing['relationship'],
          reason: m.reason,
        }));
      }
    } catch (error) {
      console.error('페어링 추천 오류:', error);
    }

    return [];
  }

  /**
   * 에셋과 연결된 페어링 조회
   */
  async getPairingsForAsset(assetId: string): Promise<AssetPairing[]> {
    const snapshot = await this.db
      .collection(this.COLLECTIONS.PAIRINGS)
      .where('assetId', '==', assetId)
      .get();

    const pairings: AssetPairing[] = [];
    snapshot.forEach((doc) => {
      pairings.push(doc.data() as unknown as AssetPairing);
    });

    return pairings;
  }

  /**
   * 대상과 연결된 페어링 조회
   */
  async getPairingsForTarget(targetId: string): Promise<AssetPairing[]> {
    const snapshot = await this.db
      .collection(this.COLLECTIONS.PAIRINGS)
      .where('targetId', '==', targetId)
      .get();

    const pairings: AssetPairing[] = [];
    snapshot.forEach((doc) => {
      pairings.push(doc.data() as unknown as AssetPairing);
    });

    return pairings;
  }

  // ============================================================
  // 청크 관리 메서드
  // ============================================================

  /**
   * 청크 유형별 생성
   */
  async createTypedChunk(
    chunkData: Omit<RAGChunk, 'id' | 'isLatestApproved'>,
    options: {
      autoEmbed?: boolean;
      autoApprove?: boolean;
      createdBy?: string;
    } = {}
  ): Promise<string> {
    const { autoEmbed = false, autoApprove = false, createdBy } = options;

    const chunkRef = this.db.collection(this.COLLECTIONS.CHUNKS).doc();
    const now = new Date();

    const versionInfo: VersionInfo = {
      version: 1,
      status: autoApprove ? 'approved' : 'draft',
      createdAt: now,
      createdBy,
      changeType: 'create',
      ...(autoApprove && { approvedAt: now, approvedBy: createdBy }),
    };

    let embeddingVector: number[] | undefined;
    if (autoEmbed && chunkData.content && this.gemini) {
      embeddingVector = await this.generateEmbedding(chunkData.content);
    }

    const chunk: RAGChunk = {
      id: chunkRef.id,
      ...chunkData,
      versionInfo,
      isLatestApproved: autoApprove,
      ...(embeddingVector && {
        embeddingVector,
        embeddingModel: this.embeddingModel,
        embeddedAt: now,
      }),
    };

    await chunkRef.set(chunk);
    return chunkRef.id;
  }

  /**
   * 청크 그룹 생성 (문제 + 이미지 + 해설 등을 하나의 그룹으로)
   */
  async createChunkGroup(
    groupType: ChunkGroup['groupType'],
    chunkIds: string[],
    primaryChunkId: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const groupRef = this.db.collection(this.COLLECTIONS.CHUNK_GROUPS).doc();
    const now = new Date();

    const group: ChunkGroup = {
      id: groupRef.id,
      groupType,
      chunkIds,
      primaryChunkId,
      metadata,
      createdAt: now,
    };

    await groupRef.set(group);

    // 각 청크에 그룹 정보 추가
    const batch = this.db.batch();
    for (const chunkId of chunkIds) {
      const chunkRef = this.db.collection(this.COLLECTIONS.CHUNKS).doc(chunkId);
      batch.update(chunkRef, {
        pairedChunkIds: chunkIds.filter((id) => id !== chunkId),
        groupId: groupRef.id,
      });
    }
    await batch.commit();

    return groupRef.id;
  }

  /**
   * 임베딩 벡터 생성
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.gemini) {
      throw new Error('Gemini 클라이언트가 초기화되지 않았습니다.');
    }

    const response = await this.gemini.models.embedContent({
      model: this.embeddingModel,
      content: { parts: [{ text }] },
    });

    if (!response.embedding?.values) {
      throw new Error('임베딩 생성에 실패했습니다.');
    }

    return response.embedding.values;
  }

  /**
   * 청크 임베딩 업데이트
   */
  async embedChunk(chunkId: string): Promise<void> {
    const chunkRef = this.db.collection(this.COLLECTIONS.CHUNKS).doc(chunkId);
    const chunkDoc = await chunkRef.get();

    if (!chunkDoc.exists) {
      throw new Error(`청크를 찾을 수 없습니다: ${chunkId}`);
    }

    const chunk = chunkDoc.data() as unknown as RAGChunk;

    if (!chunk.content) {
      throw new Error('청크에 콘텐츠가 없습니다.');
    }

    const embeddingVector = await this.generateEmbedding(chunk.content);
    const now = new Date();

    await chunkRef.update({
      embeddingVector,
      embeddingModel: this.embeddingModel,
      embeddedAt: now,
    });
  }

  /**
   * 여러 청크 일괄 임베딩
   */
  async embedChunksBatch(chunkIds: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const chunkId of chunkIds) {
      try {
        await this.embedChunk(chunkId);
        success++;
      } catch (error) {
        console.error(`청크 임베딩 실패 (${chunkId}):`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 청크 유형별 조회
   */
  async getChunksByType(
    chunkType: RAGChunkType,
    options: { onlyApproved?: boolean; limit?: number } = {}
  ): Promise<RAGChunk[]> {
    const { onlyApproved = true, limit = 100 } = options;

    let query = this.db
      .collection(this.COLLECTIONS.CHUNKS)
      .where('chunkType', '==', chunkType);

    if (onlyApproved) {
      query = query.where('isLatestApproved', '==', true);
    }

    const snapshot = await query.limit(limit).get();

    const chunks: RAGChunk[] = [];
    snapshot.forEach((doc) => {
      chunks.push(doc.data() as unknown as RAGChunk);
    });

    return chunks;
  }

  // ============================================================
  // 통계 및 대시보드 메서드
  // ============================================================

  /**
   * 전체 통계 조회
   */
  async getStats(): Promise<RAGManagerStats> {
    const [documentsSnapshot, chunksSnapshot, assetsSnapshot, pairingsSnapshot] = await Promise.all([
      this.db.collection(this.COLLECTIONS.DOCUMENTS).get(),
      this.db.collection(this.COLLECTIONS.CHUNKS).get(),
      this.db.collection(this.COLLECTIONS.ASSETS).get(),
      this.db.collection(this.COLLECTIONS.PAIRINGS).get(),
    ]);

    // 청크 유형별 집계
    const chunksByType: Record<RAGChunkType, number> = {
      textbook_text: 0,
      textbook_image: 0,
      problem_text: 0,
      problem_image: 0,
      problem_table: 0,
      solution_text: 0,
      solution_image: 0,
    };

    let approvedVersions = 0;
    let draftVersions = 0;

    chunksSnapshot.forEach((doc) => {
      const chunk = doc.data() as unknown as RAGChunk;
      if (chunk.chunkType && chunksByType[chunk.chunkType] !== undefined) {
        chunksByType[chunk.chunkType]++;
      }
      if (chunk.versionInfo?.status === 'approved') {
        approvedVersions++;
      } else if (chunk.versionInfo?.status === 'draft') {
        draftVersions++;
      }
    });

    // 페어링된 에셋 ID 수집
    const pairedAssetIds = new Set<string>();
    pairingsSnapshot.forEach((doc) => {
      const pairing = doc.data() as unknown as AssetPairing;
      pairedAssetIds.add(pairing.assetId);
    });

    // 미페어링 에셋 수
    let unpairedAssets = 0;
    assetsSnapshot.forEach((doc) => {
      if (!pairedAssetIds.has(doc.id)) {
        unpairedAssets++;
      }
    });

    // 검토 대기 페어링 수
    let pendingReview = 0;
    pairingsSnapshot.forEach((doc) => {
      const pairing = doc.data() as unknown as AssetPairing;
      if (pairing.pairingStatus === 'unverified' || pairing.pairingStatus === 'needs_review') {
        pendingReview++;
      }
    });

    return {
      totalDocuments: documentsSnapshot.size,
      totalChunks: chunksSnapshot.size,
      chunksByType,
      unpairedAssets,
      pendingReview,
      approvedVersions,
      draftVersions,
    };
  }

  /**
   * 문서별 페어링 상태 조회
   */
  async getDocumentPairingStatus(documentId: string): Promise<{
    totalAssets: number;
    verifiedPairings: number;
    unverifiedPairings: number;
    rejectedPairings: number;
  }> {
    // 문서와 연결된 청크 찾기
    const chunksSnapshot = await this.db
      .collection(this.COLLECTIONS.CHUNKS)
      .where('documentId', '==', documentId)
      .get();

    const chunkIds: string[] = [];
    chunksSnapshot.forEach((doc) => {
      chunkIds.push(doc.id);
    });

    if (chunkIds.length === 0) {
      return {
        totalAssets: 0,
        verifiedPairings: 0,
        unverifiedPairings: 0,
        rejectedPairings: 0,
      };
    }

    // 해당 청크들과 연결된 페어링 조회
    const pairingsSnapshot = await this.db.collection(this.COLLECTIONS.PAIRINGS).get();

    let verifiedPairings = 0;
    let unverifiedPairings = 0;
    let rejectedPairings = 0;
    const assetIds = new Set<string>();

    pairingsSnapshot.forEach((doc) => {
      const pairing = doc.data() as unknown as AssetPairing;
      if (chunkIds.includes(pairing.targetId)) {
        assetIds.add(pairing.assetId);
        switch (pairing.pairingStatus) {
          case 'verified':
            verifiedPairings++;
            break;
          case 'unverified':
          case 'needs_review':
            unverifiedPairings++;
            break;
          case 'rejected':
            rejectedPairings++;
            break;
        }
      }
    });

    return {
      totalAssets: assetIds.size,
      verifiedPairings,
      unverifiedPairings,
      rejectedPairings,
    };
  }

  // ============================================================
  // 문제-자료 매칭 전용 메서드
  // ============================================================

  /**
   * 문제와 관련 자료를 함께 청크로 생성
   */
  async createProblemWithAssets(
    problemData: {
      problemText: string;
      solution?: string;
      answer?: string;
      documentType: DocumentType;
      metadata?: Record<string, unknown>;
    },
    assets: Array<{
      type: AssetType;
      fileData: string;
      mimeType: string;
      caption?: string;
      ocrText?: string;
      relationship: AssetPairing['relationship'];
    }>,
    options: {
      autoApprove?: boolean;
      createdBy?: string;
    } = {}
  ): Promise<{
    problemChunkId: string;
    solutionChunkId?: string;
    assetChunkIds: string[];
    groupId: string;
  }> {
    const { autoApprove = false, createdBy } = options;

    // 1. 문제 본문 청크 생성
    const problemChunkId = await this.createTypedChunk(
      {
        documentId: '',
        content: problemData.problemText,
        chunkType: 'problem_text',
        documentType: problemData.documentType,
        inheritedMetadata: problemData.metadata,
      },
      { autoApprove, createdBy }
    );

    const chunkIds = [problemChunkId];

    // 2. 해설 청크 생성 (있는 경우)
    let solutionChunkId: string | undefined;
    if (problemData.solution || problemData.answer) {
      const solutionContent = [
        problemData.answer && `[정답] ${problemData.answer}`,
        problemData.solution && `[해설] ${problemData.solution}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      solutionChunkId = await this.createTypedChunk(
        {
          documentId: '',
          content: solutionContent,
          chunkType: 'solution_text',
          documentType: problemData.documentType,
          inheritedMetadata: problemData.metadata,
        },
        { autoApprove, createdBy }
      );
      chunkIds.push(solutionChunkId);
    }

    // 3. 에셋 청크들 생성
    const assetChunkIds: string[] = [];
    for (const asset of assets) {
      // 에셋 저장
      const assetId = await this.createAsset({
        type: asset.type,
        fileData: asset.fileData,
        mimeType: asset.mimeType,
        caption: asset.caption,
        ocrText: asset.ocrText,
      });

      // 에셋 청크 생성
      const chunkType: RAGChunkType = asset.type === 'table' ? 'problem_table' : 'problem_image';
      const assetChunkId = await this.createTypedChunk(
        {
          documentId: '',
          content: asset.ocrText || asset.caption || `[${asset.type}]`,
          chunkType,
          documentType: problemData.documentType,
          inheritedMetadata: problemData.metadata,
        },
        { autoApprove, createdBy }
      );

      assetChunkIds.push(assetChunkId);
      chunkIds.push(assetChunkId);

      // 페어링 생성
      await this.createPairing({
        assetId,
        targetType: 'problem',
        targetId: problemChunkId,
        relationship: asset.relationship,
        pairingStatus: autoApprove ? 'verified' : 'unverified',
      });
    }

    // 4. 청크 그룹 생성
    const groupId = await this.createChunkGroup('problem_set', chunkIds, problemChunkId, {
      documentType: problemData.documentType,
    });

    return {
      problemChunkId,
      solutionChunkId,
      assetChunkIds,
      groupId,
    };
  }

  /**
   * 교과서 본문과 이미지 함께 청크로 생성
   */
  async createTextbookContentWithAssets(
    contentData: {
      text: string;
      documentType: DocumentType;
      metadata?: Record<string, unknown>;
    },
    assets: Array<{
      type: AssetType;
      fileData: string;
      mimeType: string;
      caption: string;
      ocrText?: string;
    }>,
    options: {
      autoApprove?: boolean;
      createdBy?: string;
    } = {}
  ): Promise<{
    textChunkId: string;
    assetChunkIds: string[];
    groupId: string;
  }> {
    const { autoApprove = false, createdBy } = options;

    // 1. 본문 청크 생성
    const textChunkId = await this.createTypedChunk(
      {
        documentId: '',
        content: contentData.text,
        chunkType: 'textbook_text',
        documentType: contentData.documentType,
        inheritedMetadata: contentData.metadata,
      },
      { autoApprove, createdBy }
    );

    const chunkIds = [textChunkId];
    const assetChunkIds: string[] = [];

    // 2. 에셋 청크들 생성
    for (const asset of assets) {
      // 에셋 저장
      const assetId = await this.createAsset({
        type: asset.type,
        fileData: asset.fileData,
        mimeType: asset.mimeType,
        caption: asset.caption,
        ocrText: asset.ocrText,
      });

      // 에셋 청크 생성 (캡션 + OCR 텍스트)
      const assetContent = [asset.caption, asset.ocrText].filter(Boolean).join('\n\n');

      const assetChunkId = await this.createTypedChunk(
        {
          documentId: '',
          content: assetContent,
          chunkType: 'textbook_image',
          documentType: contentData.documentType,
          inheritedMetadata: contentData.metadata,
          conceptData: {
            figureCaption: asset.caption,
            assetType: asset.type,
          },
        },
        { autoApprove, createdBy }
      );

      assetChunkIds.push(assetChunkId);
      chunkIds.push(assetChunkId);

      // 페어링 생성
      await this.createPairing({
        assetId,
        targetType: 'textbook_content',
        targetId: textChunkId,
        relationship: 'illustrates',
        pairingStatus: autoApprove ? 'verified' : 'unverified',
      });
    }

    // 3. 청크 그룹 생성
    const groupId = await this.createChunkGroup('textbook_section', chunkIds, textChunkId, {
      documentType: contentData.documentType,
    });

    return {
      textChunkId,
      assetChunkIds,
      groupId,
    };
  }

  // ============================================================
  // 자동 청킹 메서드
  // ============================================================

  /**
   * 청킹 전략 타입
   */
  static readonly CHUNKING_STRATEGIES = {
    PARAGRAPH: 'paragraph',      // 문단 단위 (빈 줄 기준)
    SENTENCE: 'sentence',        // 문장 단위 (마침표, 물음표, 느낌표)
    SEMANTIC: 'semantic',        // 의미 단위 (AI 기반)
    FIXED_SIZE: 'fixed_size',    // 고정 글자 수
    SLIDING_WINDOW: 'sliding_window', // 슬라이딩 윈도우
  } as const;

  /**
   * 텍스트를 문단 단위로 분할
   */
  private splitByParagraph(text: string, minLength: number = 50): string[] {
    // 빈 줄(2개 이상의 줄바꿈)을 기준으로 분할
    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length >= minLength);

    // 너무 짧은 문단은 다음 문단과 합치기
    const merged: string[] = [];
    let buffer = '';

    for (const para of paragraphs) {
      if (buffer.length > 0 && buffer.length < minLength) {
        buffer += '\n\n' + para;
      } else {
        if (buffer.length > 0) {
          merged.push(buffer);
        }
        buffer = para;
      }
    }
    if (buffer.length > 0) {
      merged.push(buffer);
    }

    return merged;
  }

  /**
   * 텍스트를 문장 단위로 분할
   */
  private splitBySentence(text: string, sentencesPerChunk: number = 3): string[] {
    // 한국어와 영어 문장 종결 부호 처리
    const sentencePattern = /[.!?。？！]\s*(?=[가-힣A-Z\d\(「『"']|$)/g;

    // 문장 분리
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = sentencePattern.exec(text)) !== null) {
      const sentence = text.slice(lastIndex, match.index + 1).trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      lastIndex = match.index + match[0].length;
    }

    // 마지막 부분 처리
    const remaining = text.slice(lastIndex).trim();
    if (remaining.length > 0) {
      sentences.push(remaining);
    }

    // 문장을 그룹으로 묶기
    const chunks: string[] = [];
    for (let i = 0; i < sentences.length; i += sentencesPerChunk) {
      const chunk = sentences.slice(i, i + sentencesPerChunk).join(' ');
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * 텍스트를 고정 크기로 분할 (단어 경계 존중)
   */
  private splitByFixedSize(text: string, maxSize: number = 500, overlap: number = 50): string[] {
    const chunks: string[] = [];
    const words = text.split(/\s+/);
    let currentChunk = '';

    for (const word of words) {
      const testChunk = currentChunk + (currentChunk ? ' ' : '') + word;

      if (testChunk.length > maxSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());

        // 오버랩 처리: 마지막 몇 단어를 다음 청크에 포함
        if (overlap > 0) {
          const overlapWords = currentChunk.split(/\s+/).slice(-Math.ceil(overlap / 10));
          currentChunk = overlapWords.join(' ') + ' ' + word;
        } else {
          currentChunk = word;
        }
      } else {
        currentChunk = testChunk;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * 슬라이딩 윈도우 방식으로 분할
   */
  private splitBySlidingWindow(text: string, windowSize: number = 500, stepSize: number = 250): string[] {
    const chunks: string[] = [];
    const textLength = text.length;

    for (let i = 0; i < textLength; i += stepSize) {
      const end = Math.min(i + windowSize, textLength);
      const chunk = text.slice(i, end).trim();

      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // 마지막 청크에 도달하면 종료
      if (end >= textLength) break;
    }

    return chunks;
  }

  /**
   * AI 기반 의미 단위 청킹 (Gemini 활용)
   */
  private async splitBySemantic(text: string, maxChunks: number = 10): Promise<string[]> {
    if (!this.gemini) {
      // Gemini 없으면 문단 단위로 폴백
      return this.splitByParagraph(text);
    }

    const prompt = `다음 텍스트를 의미 있는 단위로 분할해주세요. 각 청크는 하나의 완결된 개념이나 주제를 담아야 합니다.

규칙:
1. 각 청크는 최소 100자, 최대 800자
2. 문맥이 끊기지 않도록 의미 단위로 분할
3. 수식이나 예제는 관련 설명과 함께 유지
4. 최대 ${maxChunks}개의 청크로 분할

텍스트:
${text.substring(0, 4000)}

JSON 배열로 청크들을 반환해주세요:
["청크1 내용", "청크2 내용", ...]`;

    try {
      const response = await this.gemini.models.generateContent({
        model: 'gemini-2.5-flash-preview-05-20',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      });

      const responseText = response.text || '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const chunks = JSON.parse(jsonMatch[0]) as string[];
        return chunks.filter(c => c && c.trim().length > 0);
      }
    } catch (error) {
      console.error('의미 단위 청킹 오류:', error);
    }

    // 실패 시 문단 단위로 폴백
    return this.splitByParagraph(text);
  }

  /**
   * 자동 청킹 수행
   */
  async autoChunk(
    text: string,
    options: {
      strategy: 'paragraph' | 'sentence' | 'semantic' | 'fixed_size' | 'sliding_window';
      chunkType: RAGChunkType;
      documentType: DocumentType;
      // 전략별 옵션
      minParagraphLength?: number;      // 문단: 최소 길이
      sentencesPerChunk?: number;       // 문장: 청크당 문장 수
      fixedSize?: number;               // 고정 크기: 최대 글자 수
      overlap?: number;                 // 고정 크기/슬라이딩: 오버랩
      windowSize?: number;              // 슬라이딩: 윈도우 크기
      stepSize?: number;                // 슬라이딩: 스텝 크기
      maxSemanticChunks?: number;       // 의미 단위: 최대 청크 수
      // 공통 옵션
      autoApprove?: boolean;
      autoEmbed?: boolean;
      createdBy?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{
    chunks: Array<{ id: string; content: string; index: number }>;
    strategy: string;
    totalChunks: number;
  }> {
    const {
      strategy,
      chunkType,
      documentType,
      minParagraphLength = 50,
      sentencesPerChunk = 3,
      fixedSize = 500,
      overlap = 50,
      windowSize = 500,
      stepSize = 250,
      maxSemanticChunks = 10,
      autoApprove = false,
      autoEmbed = false,
      createdBy,
      metadata,
    } = options;

    // 전략에 따라 텍스트 분할
    let textChunks: string[];

    switch (strategy) {
      case 'paragraph':
        textChunks = this.splitByParagraph(text, minParagraphLength);
        break;
      case 'sentence':
        textChunks = this.splitBySentence(text, sentencesPerChunk);
        break;
      case 'semantic':
        textChunks = await this.splitBySemantic(text, maxSemanticChunks);
        break;
      case 'fixed_size':
        textChunks = this.splitByFixedSize(text, fixedSize, overlap);
        break;
      case 'sliding_window':
        textChunks = this.splitBySlidingWindow(text, windowSize, stepSize);
        break;
      default:
        textChunks = this.splitByParagraph(text);
    }

    // 청크 생성
    const createdChunks: Array<{ id: string; content: string; index: number }> = [];

    for (let i = 0; i < textChunks.length; i++) {
      const chunkContent = textChunks[i];

      const chunkId = await this.createTypedChunk(
        {
          documentId: '',
          content: chunkContent,
          chunkType,
          documentType,
          index: i,
          inheritedMetadata: {
            ...metadata,
            totalChunks: textChunks.length,
            chunkingStrategy: strategy,
          },
        },
        { autoApprove, autoEmbed, createdBy }
      );

      createdChunks.push({
        id: chunkId,
        content: chunkContent,
        index: i,
      });
    }

    return {
      chunks: createdChunks,
      strategy,
      totalChunks: textChunks.length,
    };
  }

  /**
   * 청킹 미리보기 (실제 저장 없이 분할 결과만 반환)
   */
  async previewChunking(
    text: string,
    strategy: 'paragraph' | 'sentence' | 'semantic' | 'fixed_size' | 'sliding_window',
    options: {
      minParagraphLength?: number;
      sentencesPerChunk?: number;
      fixedSize?: number;
      overlap?: number;
      windowSize?: number;
      stepSize?: number;
      maxSemanticChunks?: number;
    } = {}
  ): Promise<{
    chunks: Array<{ content: string; length: number; index: number }>;
    strategy: string;
    totalChunks: number;
    totalLength: number;
    averageLength: number;
  }> {
    const {
      minParagraphLength = 50,
      sentencesPerChunk = 3,
      fixedSize = 500,
      overlap = 50,
      windowSize = 500,
      stepSize = 250,
      maxSemanticChunks = 10,
    } = options;

    let textChunks: string[];

    switch (strategy) {
      case 'paragraph':
        textChunks = this.splitByParagraph(text, minParagraphLength);
        break;
      case 'sentence':
        textChunks = this.splitBySentence(text, sentencesPerChunk);
        break;
      case 'semantic':
        textChunks = await this.splitBySemantic(text, maxSemanticChunks);
        break;
      case 'fixed_size':
        textChunks = this.splitByFixedSize(text, fixedSize, overlap);
        break;
      case 'sliding_window':
        textChunks = this.splitBySlidingWindow(text, windowSize, stepSize);
        break;
      default:
        textChunks = this.splitByParagraph(text);
    }

    const chunks = textChunks.map((content, index) => ({
      content,
      length: content.length,
      index,
    }));

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);

    return {
      chunks,
      strategy,
      totalChunks: chunks.length,
      totalLength,
      averageLength: chunks.length > 0 ? Math.round(totalLength / chunks.length) : 0,
    };
  }
}

export default RAGManagerService;
