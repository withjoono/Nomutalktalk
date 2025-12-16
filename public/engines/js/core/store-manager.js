/**
 * StoreManager - 저장소 관리 핵심 모듈
 * 문제 은행 스토어의 생성, 선택, 삭제 등을 담당
 */
class StoreManager {
  constructor(options = {}) {
    this.currentStore = null;
    this.onStoreChange = options.onStoreChange || (() => {});
    this.onError = options.onError || console.error;
    this.onSuccess = options.onSuccess || console.log;
    this.onProgress = options.onProgress || (() => {});
    this.onProgressHide = options.onProgressHide || (() => {});
  }

  /**
   * 새 스토어 생성
   * @param {string} displayName - 스토어 표시 이름
   * @returns {Promise<Object>} 생성된 스토어 정보
   */
  async createStore(displayName) {
    if (!displayName || !displayName.trim()) {
      throw new Error('스토어 이름을 입력하세요.');
    }

    this.onProgress('스토어 생성 중...');

    try {
      const response = await fetch('/api/store/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() })
      });

      const data = await response.json();
      this.onProgressHide();

      if (data.success) {
        this.currentStore = data.storeName;
        this.onStoreChange(data.storeName, data);
        this.onSuccess(`스토어 생성 완료: ${data.storeName}`);
        return data;
      } else {
        throw new Error(data.error || '스토어 생성 실패');
      }
    } catch (error) {
      this.onProgressHide();
      this.onError(error.message);
      throw error;
    }
  }

  /**
   * 스토어 목록 불러오기
   * @returns {Promise<Array>} 스토어 목록
   */
  async loadStores() {
    try {
      const response = await fetch('/api/stores');
      const data = await response.json();

      if (data.success && data.stores) {
        return data.stores.map(store => ({
          name: store.name,
          displayName: store.displayName || store.name.split('/').pop(),
          documentCount: store.documentCount || 0
        }));
      }
      return [];
    } catch (error) {
      this.onError(`스토어 목록 불러오기 실패: ${error.message}`);
      return [];
    }
  }

  /**
   * 기존 스토어 선택/연결
   * @param {string} storeName - 스토어 이름
   * @returns {Promise<Object>} 연결된 스토어 정보
   */
  async selectStore(storeName) {
    if (!storeName) {
      throw new Error('스토어를 선택하세요.');
    }

    this.onProgress('스토어 연결 중...');

    try {
      const response = await fetch('/api/store/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName })
      });

      const data = await response.json();
      this.onProgressHide();

      if (data.success) {
        this.currentStore = data.storeName;
        this.onStoreChange(data.storeName, data);
        this.onSuccess(`스토어 연결 완료: ${data.storeName}`);
        return data;
      } else {
        throw new Error(data.error || '스토어 연결 실패');
      }
    } catch (error) {
      this.onProgressHide();
      this.onError(error.message);
      throw error;
    }
  }

  /**
   * 스토어 상태 조회
   * @returns {Promise<Object>} 스토어 상태 정보
   */
  async getStoreStatus() {
    try {
      const response = await fetch('/api/store/status');
      const data = await response.json();

      if (data.success && data.status) {
        return {
          documentCount: data.status.documentCount || 0,
          ...data.status
        };
      }
      return null;
    } catch (error) {
      this.onError(`스토어 상태 조회 실패: ${error.message}`);
      return null;
    }
  }

  /**
   * 스토어 삭제
   * @param {string} storeName - 삭제할 스토어 이름
   * @returns {Promise<boolean>} 삭제 성공 여부
   */
  async deleteStore(storeName) {
    try {
      const response = await fetch(`/api/store/${encodeURIComponent(storeName)}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        if (this.currentStore === storeName) {
          this.currentStore = null;
          this.onStoreChange(null, null);
        }
        this.onSuccess('스토어 삭제 완료');
        return true;
      } else {
        throw new Error(data.error || '스토어 삭제 실패');
      }
    } catch (error) {
      this.onError(error.message);
      return false;
    }
  }

  /**
   * 현재 스토어 이름 반환
   * @returns {string|null}
   */
  getCurrentStore() {
    return this.currentStore;
  }

  /**
   * 드롭다운 엘리먼트에 스토어 목록 채우기
   * @param {HTMLSelectElement} selectElement - 드롭다운 엘리먼트
   */
  async populateDropdown(selectElement) {
    selectElement.innerHTML = '<option value="">불러오는 중...</option>';
    selectElement.disabled = true;

    const stores = await this.loadStores();

    if (stores.length > 0) {
      selectElement.innerHTML = '<option value="">-- 스토어를 선택하세요 --</option>';

      stores.forEach(store => {
        const option = document.createElement('option');
        option.value = store.name;
        option.textContent = `${store.displayName} (${store.documentCount}개 문서)`;
        selectElement.appendChild(option);
      });

      selectElement.disabled = false;
    } else {
      selectElement.innerHTML = '<option value="">사용 가능한 스토어가 없습니다</option>';
    }
  }
}

// 모듈 내보내기 (브라우저 환경)
if (typeof window !== 'undefined') {
  window.StoreManager = StoreManager;
}

// CommonJS 환경
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StoreManager;
}
