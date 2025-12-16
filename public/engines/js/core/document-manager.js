/**
 * DocumentManager - 문서 관리 핵심 모듈
 * 문서 업로드, 조회, 삭제 및 요약 정보 관리
 */
class DocumentManager {
  constructor(options = {}) {
    this.onError = options.onError || console.error;
    this.onSuccess = options.onSuccess || console.log;
    this.onProgress = options.onProgress || (() => {});
    this.onProgressHide = options.onProgressHide || (() => {});
    this.onDocumentsLoaded = options.onDocumentsLoaded || (() => {});
  }

  /**
   * 문서 목록 불러오기
   * @returns {Promise<Array>} 문서 목록
   */
  async loadDocuments() {
    try {
      const response = await fetch('/api/documents');
      const data = await response.json();

      if (data.success) {
        this.onDocumentsLoaded(data.documents);
        return data.documents;
      } else {
        throw new Error(data.error || '문서 불러오기 실패');
      }
    } catch (error) {
      this.onError(`문서 목록 불러오기 실패: ${error.message}`);
      return [];
    }
  }

  /**
   * 문서 요약 정보 계산
   * @param {Array} documents - 문서 목록
   * @returns {Object} 요약 정보
   */
  calculateSummary(documents) {
    const summary = {
      totalCount: documents.length,
      ragIndexedCount: 0,
      problemDocCount: 0,
      assetDocCount: 0,
      otherDocCount: 0
    };

    documents.forEach(doc => {
      const name = (doc.displayName || doc.name || '').toLowerCase();

      // RAG 인덱싱된 문서
      if (doc.metadata || doc.indexed) {
        summary.ragIndexedCount++;
      }

      // 문서 유형 분류
      if (name.includes('variation') || name.includes('문제') || name.includes('problem')) {
        summary.problemDocCount++;
      } else if (name.includes('asset') || name.includes('자료') || name.includes('image')) {
        summary.assetDocCount++;
      } else {
        summary.otherDocCount++;
      }
    });

    // 기본적으로 모든 문서가 인덱싱된 것으로 처리
    if (summary.ragIndexedCount === 0) {
      summary.ragIndexedCount = summary.totalCount;
    }

    return summary;
  }

  /**
   * 문서 유형 판별
   * @param {string} name - 문서 이름
   * @returns {Object} 유형 정보
   */
  getDocumentType(name) {
    const lowerName = (name || '').toLowerCase();

    if (lowerName.includes('variation') || lowerName.includes('문제') || lowerName.includes('problem')) {
      return { class: 'variation', label: '문제', icon: '📝' };
    } else if (lowerName.includes('asset') || lowerName.includes('자료') || lowerName.includes('image')) {
      return { class: 'asset', label: '자료', icon: '🖼️' };
    } else {
      return { class: 'document', label: '문서', icon: '📄' };
    }
  }

  /**
   * 최근 문서 가져오기
   * @param {Array} documents - 문서 목록
   * @param {number} count - 가져올 개수
   * @returns {Array} 최근 문서
   */
  getRecentDocuments(documents, count = 5) {
    return documents.slice(0, count).map(doc => ({
      name: doc.displayName || doc.name,
      type: this.getDocumentType(doc.displayName || doc.name),
      metadata: doc.metadata || {}
    }));
  }

  /**
   * 문서 삭제
   * @param {string} documentName - 삭제할 문서 이름
   * @returns {Promise<boolean>} 삭제 성공 여부
   */
  async deleteDocument(documentName) {
    try {
      const response = await fetch(`/api/document/${encodeURIComponent(documentName)}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        this.onSuccess('문서 삭제 완료');
        return true;
      } else {
        throw new Error(data.error || '문서 삭제 실패');
      }
    } catch (error) {
      this.onError(error.message);
      return false;
    }
  }

  /**
   * 파일 업로드
   * @param {File} file - 업로드할 파일
   * @param {Object} options - 업로드 옵션
   * @returns {Promise<Object>} 업로드 결과
   */
  async uploadFile(file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);

    if (options.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    this.onProgress(`"${file.name}" 업로드 중...`);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      this.onProgressHide();

      if (data.success) {
        this.onSuccess(`파일 업로드 완료: ${file.name}`);
        return data;
      } else {
        throw new Error(data.error || '파일 업로드 실패');
      }
    } catch (error) {
      this.onProgressHide();
      this.onError(error.message);
      throw error;
    }
  }

  /**
   * LLM으로 문서 전송
   * @param {Object} document - 문서 정보
   * @param {string} prompt - 프롬프트
   * @returns {Promise<Object>} LLM 응답
   */
  async sendToLLM(document, prompt) {
    try {
      const response = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          context: document.content || '',
          documentName: document.name
        })
      });

      const data = await response.json();

      if (data.success) {
        return data;
      } else {
        throw new Error(data.error || 'LLM 호출 실패');
      }
    } catch (error) {
      this.onError(error.message);
      throw error;
    }
  }

  /**
   * 문서 내용 미리보기
   * @param {string} documentName - 문서 이름
   * @returns {Promise<string>} 문서 내용
   */
  async getDocumentPreview(documentName) {
    try {
      const response = await fetch(`/api/document/${encodeURIComponent(documentName)}/preview`);
      const data = await response.json();

      if (data.success) {
        return data.content || data.preview || '';
      }
      return '';
    } catch (error) {
      this.onError(`문서 미리보기 실패: ${error.message}`);
      return '';
    }
  }
}

// 모듈 내보내기
if (typeof window !== 'undefined') {
  window.DocumentManager = DocumentManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DocumentManager;
}
