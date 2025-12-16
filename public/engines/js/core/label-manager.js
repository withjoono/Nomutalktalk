/**
 * LabelManager - 라벨 관리 핵심 모듈
 * 문제 라벨/태그 관리 담당
 */
class LabelManager {
  constructor(options = {}) {
    this.labels = [];
    this.currentFilter = 'all';
    this.editingLabelId = null;
    this.onError = options.onError || console.error;
    this.onSuccess = options.onSuccess || console.log;
    this.onLabelsLoaded = options.onLabelsLoaded || (() => {});
  }

  /**
   * 카테고리 목록
   */
  static CATEGORIES = {
    subject: { name: '교과', icon: '📚' },
    course: { name: '과목', icon: '📖' },
    grade: { name: '학년', icon: '🎓' },
    difficulty: { name: '난이도', icon: '📊' },
    problemType: { name: '문제유형', icon: '❓' },
    concept: { name: '개념', icon: '💡' },
    chapter: { name: '단원', icon: '📑' },
    skill: { name: '역량', icon: '🔧' }
  };

  /**
   * 라벨 목록 불러오기
   * @returns {Promise<Array>} 라벨 목록
   */
  async loadLabels() {
    try {
      const response = await fetch('/api/labels');
      const data = await response.json();

      if (data.success) {
        this.labels = data.labels || [];
        this.onLabelsLoaded(this.labels);
        return this.labels;
      } else {
        throw new Error(data.error || '라벨 불러오기 실패');
      }
    } catch (error) {
      this.onError(`라벨 로드 실패: ${error.message}`);
      return [];
    }
  }

  /**
   * 카테고리별 필터링
   * @param {string} category - 카테고리 (all, subject, course, etc.)
   * @returns {Array} 필터링된 라벨
   */
  filterByCategory(category = 'all') {
    this.currentFilter = category;

    if (category === 'all') {
      return this.labels;
    }

    return this.labels.filter(l => l.category === category);
  }

  /**
   * 카테고리별 그룹화
   * @param {Array} labels - 라벨 목록
   * @returns {Object} 그룹화된 라벨
   */
  groupByCategory(labels = null) {
    const targetLabels = labels || this.labels;
    const grouped = {};

    targetLabels.forEach(label => {
      if (!grouped[label.category]) {
        grouped[label.category] = [];
      }
      grouped[label.category].push(label);
    });

    return grouped;
  }

  /**
   * 카테고리 표시명 반환
   * @param {string} category - 카테고리
   * @returns {string} 표시명
   */
  getCategoryDisplayName(category) {
    const cat = LabelManager.CATEGORIES[category];
    return cat ? `${cat.icon} ${cat.name}` : category;
  }

  /**
   * 라벨 추가
   * @param {Object} labelData - 라벨 데이터
   * @returns {Promise<Object>} 추가된 라벨
   */
  async addLabel(labelData) {
    const { category, name, parent, metadata } = labelData;

    if (!name || !name.trim()) {
      throw new Error('라벨 이름을 입력해주세요.');
    }

    try {
      const response = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          name: name.trim(),
          parent: parent || null,
          metadata: metadata || {}
        })
      });

      const data = await response.json();

      if (data.success) {
        await this.loadLabels(); // 목록 새로고침
        this.onSuccess('라벨이 추가되었습니다.');
        return data.label;
      } else {
        throw new Error(data.error || '라벨 추가 실패');
      }
    } catch (error) {
      this.onError(error.message);
      throw error;
    }
  }

  /**
   * 라벨 수정
   * @param {string} labelId - 라벨 ID
   * @param {Object} updateData - 수정 데이터
   * @returns {Promise<Object>} 수정된 라벨
   */
  async updateLabel(labelId, updateData) {
    const { name, parent, metadata } = updateData;

    if (!name || !name.trim()) {
      throw new Error('라벨 이름을 입력해주세요.');
    }

    try {
      const response = await fetch(`/api/labels/${labelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          parent: parent || null,
          metadata: metadata || {}
        })
      });

      const data = await response.json();

      if (data.success) {
        await this.loadLabels(); // 목록 새로고침
        this.onSuccess('라벨이 수정되었습니다.');
        return data.label;
      } else {
        throw new Error(data.error || '라벨 수정 실패');
      }
    } catch (error) {
      this.onError(error.message);
      throw error;
    }
  }

  /**
   * 라벨 삭제
   * @param {string} labelId - 삭제할 라벨 ID
   * @returns {Promise<boolean>} 삭제 성공 여부
   */
  async deleteLabel(labelId) {
    try {
      const response = await fetch(`/api/labels/${labelId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        this.labels = this.labels.filter(l => l.id !== labelId);
        this.onSuccess('라벨이 삭제되었습니다.');
        return true;
      } else {
        throw new Error(data.error || '라벨 삭제 실패');
      }
    } catch (error) {
      this.onError(error.message);
      return false;
    }
  }

  /**
   * 라벨 ID로 조회
   * @param {string} labelId - 라벨 ID
   * @returns {Object|null} 라벨 객체
   */
  getLabelById(labelId) {
    return this.labels.find(l => l.id === labelId) || null;
  }

  /**
   * 상위 라벨 옵션 반환 (특정 라벨 제외)
   * @param {string} excludeId - 제외할 라벨 ID
   * @returns {Array} 상위 라벨 옵션
   */
  getParentOptions(excludeId = null) {
    return this.labels
      .filter(l => l.id !== excludeId)
      .map(l => ({
        value: l.name,
        label: `${l.category}: ${l.name}`
      }));
  }

  /**
   * 자동 라벨링 요청
   * @param {string} problemText - 문제 텍스트
   * @returns {Promise<Array>} 추천 라벨
   */
  async autoLabel(problemText) {
    try {
      const response = await fetch('/api/labels/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: problemText })
      });

      const data = await response.json();

      if (data.success) {
        return data.labels || [];
      } else {
        throw new Error(data.error || '자동 라벨링 실패');
      }
    } catch (error) {
      this.onError(error.message);
      return [];
    }
  }

  /**
   * 문제에 라벨 적용
   * @param {string} problemId - 문제 ID
   * @param {Array} labelIds - 라벨 ID 목록
   * @returns {Promise<boolean>} 적용 성공 여부
   */
  async applyLabelsToProblem(problemId, labelIds) {
    try {
      const response = await fetch(`/api/problems/${problemId}/labels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: labelIds })
      });

      const data = await response.json();

      if (data.success) {
        this.onSuccess('라벨이 적용되었습니다.');
        return true;
      } else {
        throw new Error(data.error || '라벨 적용 실패');
      }
    } catch (error) {
      this.onError(error.message);
      return false;
    }
  }
}

// 모듈 내보내기
if (typeof window !== 'undefined') {
  window.LabelManager = LabelManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LabelManager;
}
