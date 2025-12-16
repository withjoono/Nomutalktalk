/**
 * ImagenPlugin - Gemini Imagen 이미지 생성 플러그인
 * 이미지 생성, 편집, 패널 삽입 기능
 */
class ImagenPlugin {
  constructor(options = {}) {
    this.panelController = options.panelController || null;
    this.onError = options.onError || console.error;
    this.onSuccess = options.onSuccess || console.log;
    this.onProgress = options.onProgress || (() => {});
    this.onProgressHide = options.onProgressHide || (() => {});
    this.generatedImages = [];
    this.defaultOptions = {
      width: 1024,
      height: 1024,
      numberOfImages: 1,
      aspectRatio: '1:1'
    };
  }

  /**
   * PanelController 설정
   * @param {PanelController} controller - 패널 컨트롤러 인스턴스
   */
  setPanelController(controller) {
    this.panelController = controller;
  }

  /**
   * 이미지 생성
   * @param {string} prompt - 이미지 프롬프트
   * @param {Object} options - 생성 옵션
   * @returns {Promise<Object>} 생성 결과
   */
  async generateImage(prompt, options = {}) {
    if (!prompt || !prompt.trim()) {
      throw new Error('이미지 프롬프트를 입력해주세요.');
    }

    const mergedOptions = { ...this.defaultOptions, ...options };

    this.onProgress('이미지 생성 중...');

    try {
      const response = await fetch('/api/imagen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          ...mergedOptions
        })
      });

      const data = await response.json();
      this.onProgressHide();

      if (data.success) {
        const imageData = {
          id: `img-${Date.now()}`,
          prompt,
          url: data.imageUrl || data.images?.[0]?.url,
          base64: data.base64 || data.images?.[0]?.base64,
          createdAt: new Date().toISOString(),
          options: mergedOptions
        };

        this.generatedImages.push(imageData);
        this.onSuccess('이미지가 생성되었습니다.');
        return imageData;
      } else {
        throw new Error(data.error || '이미지 생성 실패');
      }
    } catch (error) {
      this.onProgressHide();
      this.onError(error.message);
      throw error;
    }
  }

  /**
   * 이미지 편집
   * @param {string} imageId - 이미지 ID 또는 URL
   * @param {string} editPrompt - 편집 프롬프트
   * @param {Object} options - 편집 옵션
   * @returns {Promise<Object>} 편집 결과
   */
  async editImage(imageId, editPrompt, options = {}) {
    if (!editPrompt || !editPrompt.trim()) {
      throw new Error('편집 프롬프트를 입력해주세요.');
    }

    // 기존 이미지 찾기
    const existingImage = this.generatedImages.find(img => img.id === imageId);
    const imageSource = existingImage?.base64 || existingImage?.url || imageId;

    this.onProgress('이미지 편집 중...');

    try {
      const response = await fetch('/api/imagen/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageSource,
          prompt: editPrompt.trim(),
          ...options
        })
      });

      const data = await response.json();
      this.onProgressHide();

      if (data.success) {
        const editedImage = {
          id: `img-${Date.now()}`,
          prompt: editPrompt,
          originalId: imageId,
          url: data.imageUrl || data.images?.[0]?.url,
          base64: data.base64 || data.images?.[0]?.base64,
          createdAt: new Date().toISOString(),
          isEdited: true
        };

        this.generatedImages.push(editedImage);
        this.onSuccess('이미지가 편집되었습니다.');
        return editedImage;
      } else {
        throw new Error(data.error || '이미지 편집 실패');
      }
    } catch (error) {
      this.onProgressHide();
      this.onError(error.message);
      throw error;
    }
  }

  /**
   * 이미지를 패널에 삽입
   * @param {string} imageId - 이미지 ID
   * @param {string} panelId - 대상 패널 ID
   * @param {Object} options - 삽입 옵션
   */
  insertToPanel(imageId, panelId, options = {}) {
    if (!this.panelController) {
      throw new Error('PanelController가 설정되지 않았습니다.');
    }

    const image = this.generatedImages.find(img => img.id === imageId);
    if (!image) {
      throw new Error('이미지를 찾을 수 없습니다.');
    }

    const imageUrl = image.url || `data:image/png;base64,${image.base64}`;
    this.panelController.insertImage(panelId, imageUrl, options);
  }

  /**
   * 파일에서 이미지 로드
   * @param {File} file - 이미지 파일
   * @returns {Promise<Object>} 로드된 이미지 데이터
   */
  async loadFromFile(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('이미지 파일만 업로드할 수 있습니다.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = {
          id: `img-${Date.now()}`,
          prompt: file.name,
          url: e.target.result,
          base64: e.target.result.split(',')[1],
          createdAt: new Date().toISOString(),
          isUploaded: true,
          fileName: file.name,
          fileSize: file.size
        };

        this.generatedImages.push(imageData);
        this.onSuccess(`이미지 "${file.name}"이(가) 로드되었습니다.`);
        resolve(imageData);
      };

      reader.onerror = () => {
        reject(new Error('이미지 파일 읽기 실패'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * 이미지 목록 반환
   * @returns {Array} 이미지 목록
   */
  getImages() {
    return this.generatedImages;
  }

  /**
   * 특정 이미지 반환
   * @param {string} imageId - 이미지 ID
   * @returns {Object|null} 이미지 데이터
   */
  getImage(imageId) {
    return this.generatedImages.find(img => img.id === imageId) || null;
  }

  /**
   * 마지막 생성 이미지 반환
   * @returns {Object|null} 마지막 이미지
   */
  getLastImage() {
    return this.generatedImages[this.generatedImages.length - 1] || null;
  }

  /**
   * 이미지 삭제
   * @param {string} imageId - 이미지 ID
   */
  deleteImage(imageId) {
    const index = this.generatedImages.findIndex(img => img.id === imageId);
    if (index !== -1) {
      this.generatedImages.splice(index, 1);
      this.onSuccess('이미지가 삭제되었습니다.');
    }
  }

  /**
   * 모든 이미지 삭제
   */
  clearImages() {
    this.generatedImages = [];
    this.onSuccess('모든 이미지가 삭제되었습니다.');
  }

  /**
   * 이미지 다운로드
   * @param {string} imageId - 이미지 ID
   * @param {string} filename - 파일명
   */
  downloadImage(imageId, filename = 'generated-image.png') {
    const image = this.getImage(imageId);
    if (!image) {
      this.onError('이미지를 찾을 수 없습니다.');
      return;
    }

    const link = document.createElement('a');
    link.href = image.url || `data:image/png;base64,${image.base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.onSuccess('이미지가 다운로드되었습니다.');
  }

  /**
   * 이미지 크기 조정
   * @param {string} imageId - 이미지 ID
   * @param {number} width - 새 너비
   * @param {number} height - 새 높이
   * @returns {Promise<Object>} 조정된 이미지
   */
  async resizeImage(imageId, width, height) {
    const image = this.getImage(imageId);
    if (!image) {
      throw new Error('이미지를 찾을 수 없습니다.');
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const resizedBase64 = canvas.toDataURL('image/png').split(',')[1];
        const resizedImage = {
          id: `img-${Date.now()}`,
          prompt: `${image.prompt} (resized to ${width}x${height})`,
          originalId: imageId,
          url: canvas.toDataURL('image/png'),
          base64: resizedBase64,
          createdAt: new Date().toISOString(),
          isResized: true
        };

        this.generatedImages.push(resizedImage);
        this.onSuccess(`이미지가 ${width}x${height}로 조정되었습니다.`);
        resolve(resizedImage);
      };

      img.onerror = () => {
        reject(new Error('이미지 로드 실패'));
      };

      img.src = image.url || `data:image/png;base64,${image.base64}`;
    });
  }

  /**
   * UI 렌더링 (이미지 갤러리)
   * @param {HTMLElement} container - 컨테이너 요소
   */
  renderGallery(container) {
    if (this.generatedImages.length === 0) {
      container.innerHTML = '<p class="no-images">생성된 이미지가 없습니다.</p>';
      return;
    }

    container.innerHTML = this.generatedImages.map(img => `
      <div class="image-item" data-id="${img.id}">
        <img src="${img.url || `data:image/png;base64,${img.base64}`}" alt="${img.prompt}">
        <div class="image-actions">
          <button class="btn-insert" data-action="insert" title="패널에 삽입">📥</button>
          <button class="btn-download" data-action="download" title="다운로드">💾</button>
          <button class="btn-delete" data-action="delete" title="삭제">🗑️</button>
        </div>
        <div class="image-prompt" title="${img.prompt}">${img.prompt.substring(0, 30)}...</div>
      </div>
    `).join('');

    // 이벤트 리스너 추가
    container.querySelectorAll('.image-item').forEach(item => {
      const imageId = item.dataset.id;

      item.querySelector('[data-action="insert"]')?.addEventListener('click', () => {
        this.insertToPanel(imageId, 'resource-panel');
      });

      item.querySelector('[data-action="download"]')?.addEventListener('click', () => {
        this.downloadImage(imageId);
      });

      item.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
        this.deleteImage(imageId);
        this.renderGallery(container);
      });
    });
  }

  /**
   * 드래그 앤 드롭 설정
   * @param {HTMLElement} dropZone - 드롭 영역 요소
   */
  setupDropZone(dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');

      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));

      for (const file of files) {
        try {
          await this.loadFromFile(file);
        } catch (error) {
          this.onError(error.message);
        }
      }
    });
  }
}

// 모듈 내보내기
if (typeof window !== 'undefined') {
  window.ImagenPlugin = ImagenPlugin;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImagenPlugin;
}
