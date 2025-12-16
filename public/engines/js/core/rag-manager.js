/**
 * RAGManager - RAG/임베딩 관리 핵심 모듈
 * RAG 문서 인덱싱, 검색, 청크 관리 담당
 */
class RAGManager {
  constructor(options = {}) {
    this.documents = [];
    this.chunks = [];
    this.currentPage = 1;
    this.chunksPerPage = 10;
    this.onError = options.onError || console.error;
    this.onSuccess = options.onSuccess || console.log;
    this.onProgress = options.onProgress || (() => {});
    this.onProgressHide = options.onProgressHide || (() => {});
    this.onDocumentsLoaded = options.onDocumentsLoaded || (() => {});
  }

  /**
   * RAG 문서 목록 불러오기
   * @returns {Promise<Array>} RAG 문서 목록
   */
  async loadDocuments() {
    try {
      const response = await fetch('/api/rag/documents');
      const data = await response.json();

      if (data.success) {
        this.documents = data.documents || [];
        this.onDocumentsLoaded(this.documents, {
          storeName: data.storeName,
          count: this.documents.length
        });
        return this.documents;
      } else {
        throw new Error(data.error || 'RAG 문서 불러오기 실패');
      }
    } catch (error) {
      this.onError(`RAG 문서 로드 실패: ${error.message}`);
      return [];
    }
  }

  /**
   * 문서 필터링
   * @param {string} searchTerm - 검색어
   * @param {string} typeFilter - 타입 필터 (all, variation, asset)
   * @returns {Array} 필터링된 문서
   */
  filterDocuments(searchTerm = '', typeFilter = 'all') {
    let filtered = this.documents;

    // 검색 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(doc =>
        (doc.displayName || doc.name || '').toLowerCase().includes(term)
      );
    }

    // 타입 필터
    if (typeFilter !== 'all') {
      filtered = filtered.filter(doc => {
        const name = (doc.displayName || doc.name || '').toLowerCase();
        if (typeFilter === 'variation') return name.includes('variation') || name.includes('var_');
        if (typeFilter === 'asset') return name.includes('asset');
        return !name.includes('variation') && !name.includes('asset');
      });
    }

    return filtered;
  }

  /**
   * 문서 타입 아이콘 반환
   * @param {string} name - 문서 이름
   * @returns {string} 아이콘
   */
  getDocTypeIcon(name) {
    if (!name) return '📄';
    const lowerName = name.toLowerCase();
    if (lowerName.includes('variation') || lowerName.includes('var_')) return '📝';
    if (lowerName.includes('asset')) return '🖼️';
    if (lowerName.includes('approved')) return '✅';
    return '📄';
  }

  /**
   * 바이트 포맷
   * @param {number} bytes - 바이트
   * @returns {string} 포맷된 문자열
   */
  formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * RAG 문서 삭제
   * @param {string} documentName - 삭제할 문서 이름
   * @returns {Promise<boolean>} 삭제 성공 여부
   */
  async deleteDocument(documentName) {
    try {
      const response = await fetch(`/api/rag/documents/${encodeURIComponent(documentName)}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        this.documents = this.documents.filter(d => d.name !== documentName);
        this.onSuccess('문서가 RAG에서 삭제되었습니다.');
        return true;
      } else {
        throw new Error(data.error || '삭제 실패');
      }
    } catch (error) {
      this.onError(`삭제 실패: ${error.message}`);
      return false;
    }
  }

  /**
   * 청크 검색
   * @param {string} query - 검색 쿼리
   * @param {number} limit - 최대 결과 수
   * @returns {Promise<Array>} 검색된 청크
   */
  async searchChunks(query, limit = 50) {
    if (!query || !query.trim()) {
      throw new Error('검색어를 입력해주세요.');
    }

    this.onProgress('청크 검색 중...');

    try {
      const response = await fetch('/api/rag/chunks/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), limit })
      });

      const data = await response.json();
      this.onProgressHide();

      if (data.success) {
        this.chunks = data.chunks || [];
        this.currentPage = 1;
        this.onSuccess(`${this.chunks.length}개 청크를 찾았습니다.`);
        return this.chunks;
      } else {
        throw new Error(data.error || '청크 검색 실패');
      }
    } catch (error) {
      this.onProgressHide();
      this.onError(error.message);
      throw error;
    }
  }

  /**
   * 페이지네이션된 청크 반환
   * @param {number} page - 페이지 번호
   * @returns {Object} 페이지네이션 데이터
   */
  getChunksPage(page = 1) {
    this.currentPage = page;
    const start = (page - 1) * this.chunksPerPage;
    const end = start + this.chunksPerPage;

    return {
      chunks: this.chunks.slice(start, end),
      currentPage: page,
      totalPages: Math.ceil(this.chunks.length / this.chunksPerPage),
      totalChunks: this.chunks.length,
      hasNext: end < this.chunks.length,
      hasPrev: page > 1
    };
  }

  /**
   * 문서 인덱싱
   * @param {string} documentName - 인덱싱할 문서 이름
   * @param {Object} options - 인덱싱 옵션
   * @returns {Promise<Object>} 인덱싱 결과
   */
  async indexDocument(documentName, options = {}) {
    this.onProgress(`"${documentName}" 인덱싱 중...`);

    try {
      const response = await fetch('/api/rag/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName,
          ...options
        })
      });

      const data = await response.json();
      this.onProgressHide();

      if (data.success) {
        this.onSuccess(`문서 인덱싱 완료: ${documentName}`);
        return data;
      } else {
        throw new Error(data.error || '인덱싱 실패');
      }
    } catch (error) {
      this.onProgressHide();
      this.onError(error.message);
      throw error;
    }
  }

  /**
   * RAG 쿼리 실행
   * @param {string} query - 쿼리
   * @param {Object} options - 쿼리 옵션
   * @returns {Promise<Object>} 쿼리 결과
   */
  async query(query, options = {}) {
    try {
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          topK: options.topK || 5,
          ...options
        })
      });

      const data = await response.json();

      if (data.success) {
        return data;
      } else {
        throw new Error(data.error || 'RAG 쿼리 실패');
      }
    } catch (error) {
      this.onError(error.message);
      throw error;
    }
  }

  /**
   * 메타데이터 포함 문서 로드
   * @returns {Promise<Array>} 메타데이터 포함 문서
   */
  async loadDocumentsWithMetadata() {
    try {
      const response = await fetch('/api/rag/documents/metadata');
      const data = await response.json();

      if (data.success) {
        return data.documents || [];
      }
      return [];
    } catch (error) {
      this.onError(`메타데이터 로드 실패: ${error.message}`);
      return [];
    }
  }
}

// 모듈 내보내기
if (typeof window !== 'undefined') {
  window.RAGManager = RAGManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RAGManager;
}
