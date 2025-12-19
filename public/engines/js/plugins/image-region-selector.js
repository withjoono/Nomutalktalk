/**
 * ImageRegionSelector - 이미지 영역 선택 플러그인
 * Canvas 기반으로 이미지 위에 크기 조절 가능한 선택 영역을 제공
 */
class ImageRegionSelector {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this.container) {
      throw new Error('Container element not found');
    }

    // 옵션 설정
    this.options = {
      handleSize: 8,
      handleColor: '#4a9eff',
      selectionBorderColor: '#4a9eff',
      selectionBorderWidth: 2,
      overlayColor: 'rgba(0, 0, 0, 0.5)',
      minSelectionSize: 10,
      ...options
    };

    // 상태
    this.image = null;
    this.imageLoaded = false;
    this.selection = { x: 50, y: 50, width: 200, height: 150 };
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.dragStart = { x: 0, y: 0 };
    this.selectionStart = { x: 0, y: 0, width: 0, height: 0 };

    // 스케일 (이미지가 Canvas에 맞게 축소된 비율)
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // 콜백
    this.onSelectionChangeCallback = null;
    this.onExportCallback = null;
    this.onOCRCallback = null;

    // DOM 요소 생성
    this._createElements();
    this._bindEvents();
  }

  /**
   * DOM 요소 생성
   */
  _createElements() {
    // 래퍼
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'irs-wrapper';
    this.wrapper.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #1e1e2e;
      display: flex;
      flex-direction: column;
    `;

    // 툴바 (숨김 - 메인 에디터 탭에서 제어)
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'irs-toolbar';
    this.toolbar.style.cssText = `
      display: none;
      gap: 8px;
      padding: 8px;
      background: #2a2a3e;
      border-bottom: 1px solid #404060;
      align-items: center;
      flex-wrap: wrap;
    `;
    this.toolbar.innerHTML = `
      <label class="irs-upload-btn" style="
        padding: 6px 12px;
        background: #4a9eff;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
      ">
        <span>📁</span> 이미지 업로드
        <input type="file" accept="image/*" style="display: none;">
      </label>
      <button class="irs-reset-btn" style="
        padding: 6px 12px;
        background: #363650;
        color: #e0e0e0;
        border: 1px solid #404060;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      ">↺ 선택 초기화</button>
      <button class="irs-export-btn" style="
        padding: 6px 12px;
        background: #4caf50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      ">📤 영역 추출</button>
      <button class="irs-ocr-btn" style="
        padding: 6px 12px;
        background: #ff9800;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      ">🔍 OCR 실행</button>
      <span class="irs-info" style="
        margin-left: auto;
        font-size: 11px;
        color: #a0a0b0;
      "></span>
    `;

    // Canvas 컨테이너
    this.canvasContainer = document.createElement('div');
    this.canvasContainer.className = 'irs-canvas-container';
    this.canvasContainer.style.cssText = `
      flex: 1;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // 메인 Canvas (이미지 + 오버레이)
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'irs-canvas';
    this.canvas.style.cssText = `
      max-width: 100%;
      max-height: 100%;
      cursor: crosshair;
    `;
    this.ctx = this.canvas.getContext('2d');

    // 빈 상태 메시지
    this.emptyState = document.createElement('div');
    this.emptyState.className = 'irs-empty-state';
    this.emptyState.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #a0a0b0;
      pointer-events: none;
    `;
    this.emptyState.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">🖼️</div>
      <div style="font-size: 14px;">이미지를 업로드하세요</div>
      <div style="font-size: 12px; margin-top: 8px;">또는 이미지를 드래그 앤 드롭</div>
    `;

    // 조립
    this.canvasContainer.appendChild(this.canvas);
    this.canvasContainer.appendChild(this.emptyState);
    this.wrapper.appendChild(this.toolbar);
    this.wrapper.appendChild(this.canvasContainer);
    this.container.appendChild(this.wrapper);

    // 요소 참조
    this.fileInput = this.toolbar.querySelector('input[type="file"]');
    this.resetBtn = this.toolbar.querySelector('.irs-reset-btn');
    this.exportBtn = this.toolbar.querySelector('.irs-export-btn');
    this.ocrBtn = this.toolbar.querySelector('.irs-ocr-btn');
    this.infoSpan = this.toolbar.querySelector('.irs-info');
  }

  /**
   * 이벤트 바인딩
   */
  _bindEvents() {
    // 파일 업로드
    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        this.loadFromFile(e.target.files[0]);
      }
    });

    // 드래그 앤 드롭
    this.canvasContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.canvasContainer.style.background = '#363650';
    });

    this.canvasContainer.addEventListener('dragleave', () => {
      this.canvasContainer.style.background = '';
    });

    this.canvasContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      this.canvasContainer.style.background = '';
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        this.loadFromFile(file);
      }
    });

    // 선택 초기화
    this.resetBtn.addEventListener('click', () => {
      this._resetSelection();
    });

    // 영역 추출
    this.exportBtn.addEventListener('click', () => {
      this.exportRegion();
    });

    // OCR 실행
    this.ocrBtn.addEventListener('click', () => {
      this.runOCR();
    });

    // Canvas 마우스 이벤트
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this._onMouseUp(e));

    // 터치 이벤트
    this.canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this._onTouchEnd(e));

    // 리사이즈 감지
    this.resizeObserver = new ResizeObserver(() => {
      if (this.imageLoaded) {
        this._fitImageToCanvas();
        this._render();
      }
    });
    this.resizeObserver.observe(this.canvasContainer);
  }

  /**
   * 파일에서 이미지 로드
   */
  loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.loadFromDataURL(e.target.result).then(resolve).catch(reject);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * URL에서 이미지 로드
   */
  loadFromURL(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.image = img;
        this.imageLoaded = true;
        this.emptyState.style.display = 'none';
        this._fitImageToCanvas();
        this._resetSelection();
        this._render();
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * DataURL에서 이미지 로드
   */
  loadFromDataURL(dataURL) {
    return this.loadFromURL(dataURL);
  }

  /**
   * 이미지를 Canvas에 맞게 조정
   */
  _fitImageToCanvas() {
    if (!this.image) return;

    const containerRect = this.canvasContainer.getBoundingClientRect();
    const containerWidth = containerRect.width - 20;
    const containerHeight = containerRect.height - 20;

    const imageAspect = this.image.width / this.image.height;
    const containerAspect = containerWidth / containerHeight;

    let canvasWidth, canvasHeight;

    if (imageAspect > containerAspect) {
      canvasWidth = Math.min(containerWidth, this.image.width);
      canvasHeight = canvasWidth / imageAspect;
    } else {
      canvasHeight = Math.min(containerHeight, this.image.height);
      canvasWidth = canvasHeight * imageAspect;
    }

    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    this.scale = canvasWidth / this.image.width;
  }

  /**
   * 선택 영역 초기화 (public)
   */
  resetSelection() {
    this._resetSelection();
  }

  /**
   * 선택 영역 초기화 (private)
   */
  _resetSelection() {
    if (!this.imageLoaded) return;

    const padding = 50 * this.scale;
    this.selection = {
      x: padding,
      y: padding,
      width: this.canvas.width - padding * 2,
      height: this.canvas.height - padding * 2
    };
    this._render();
    this._notifySelectionChange();
  }

  /**
   * Canvas 렌더링
   */
  _render() {
    if (!this.ctx || !this.image) return;

    const ctx = this.ctx;
    const { width, height } = this.canvas;
    const sel = this.selection;
    const opts = this.options;

    // 클리어
    ctx.clearRect(0, 0, width, height);

    // 이미지 그리기
    ctx.drawImage(this.image, 0, 0, width, height);

    // 오버레이 (선택 영역 외부 어둡게)
    ctx.fillStyle = opts.overlayColor;
    // 상단
    ctx.fillRect(0, 0, width, sel.y);
    // 하단
    ctx.fillRect(0, sel.y + sel.height, width, height - sel.y - sel.height);
    // 좌측
    ctx.fillRect(0, sel.y, sel.x, sel.height);
    // 우측
    ctx.fillRect(sel.x + sel.width, sel.y, width - sel.x - sel.width, sel.height);

    // 선택 영역 테두리
    ctx.strokeStyle = opts.selectionBorderColor;
    ctx.lineWidth = opts.selectionBorderWidth;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(sel.x, sel.y, sel.width, sel.height);
    ctx.setLineDash([]);

    // 리사이즈 핸들 그리기
    this._drawHandles();

    // 정보 업데이트
    this._updateInfo();
  }

  /**
   * 리사이즈 핸들 그리기
   */
  _drawHandles() {
    const ctx = this.ctx;
    const sel = this.selection;
    const size = this.options.handleSize;
    const half = size / 2;
    const color = this.options.handleColor;

    const handles = this._getHandlePositions();

    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;

    handles.forEach(handle => {
      ctx.beginPath();
      ctx.rect(handle.x - half, handle.y - half, size, size);
      ctx.fill();
      ctx.stroke();
    });
  }

  /**
   * 핸들 위치 계산
   */
  _getHandlePositions() {
    const sel = this.selection;
    return [
      { name: 'nw', x: sel.x, y: sel.y },
      { name: 'n', x: sel.x + sel.width / 2, y: sel.y },
      { name: 'ne', x: sel.x + sel.width, y: sel.y },
      { name: 'w', x: sel.x, y: sel.y + sel.height / 2 },
      { name: 'e', x: sel.x + sel.width, y: sel.y + sel.height / 2 },
      { name: 'sw', x: sel.x, y: sel.y + sel.height },
      { name: 's', x: sel.x + sel.width / 2, y: sel.y + sel.height },
      { name: 'se', x: sel.x + sel.width, y: sel.y + sel.height }
    ];
  }

  /**
   * 마우스 좌표를 Canvas 좌표로 변환
   */
  _getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  /**
   * 핸들 감지
   */
  _getHandleAtPoint(x, y) {
    const handles = this._getHandlePositions();
    const threshold = this.options.handleSize + 4;

    for (const handle of handles) {
      if (Math.abs(x - handle.x) <= threshold && Math.abs(y - handle.y) <= threshold) {
        return handle.name;
      }
    }
    return null;
  }

  /**
   * 선택 영역 내부인지 확인
   */
  _isInsideSelection(x, y) {
    const sel = this.selection;
    return x >= sel.x && x <= sel.x + sel.width &&
           y >= sel.y && y <= sel.y + sel.height;
  }

  /**
   * 마우스 다운
   */
  _onMouseDown(e) {
    if (!this.imageLoaded) return;

    const coords = this._getCanvasCoords(e);
    const handle = this._getHandleAtPoint(coords.x, coords.y);

    if (handle) {
      this.isResizing = true;
      this.resizeHandle = handle;
    } else if (this._isInsideSelection(coords.x, coords.y)) {
      this.isDragging = true;
    }

    if (this.isDragging || this.isResizing) {
      this.dragStart = coords;
      this.selectionStart = { ...this.selection };
    }
  }

  /**
   * 마우스 이동
   */
  _onMouseMove(e) {
    if (!this.imageLoaded) return;

    const coords = this._getCanvasCoords(e);

    // 커서 스타일 업데이트
    const handle = this._getHandleAtPoint(coords.x, coords.y);
    if (handle) {
      this.canvas.style.cursor = this._getCursorForHandle(handle);
    } else if (this._isInsideSelection(coords.x, coords.y)) {
      this.canvas.style.cursor = 'move';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }

    // 드래그 또는 리사이즈
    if (this.isDragging) {
      this._handleDrag(coords);
    } else if (this.isResizing) {
      this._handleResize(coords);
    }
  }

  /**
   * 마우스 업
   */
  _onMouseUp(e) {
    if (this.isDragging || this.isResizing) {
      this._notifySelectionChange();
    }
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
  }

  /**
   * 터치 시작
   */
  _onTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this._onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
  }

  /**
   * 터치 이동
   */
  _onTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this._onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  }

  /**
   * 터치 종료
   */
  _onTouchEnd(e) {
    this._onMouseUp(e);
  }

  /**
   * 드래그 처리
   */
  _handleDrag(coords) {
    const dx = coords.x - this.dragStart.x;
    const dy = coords.y - this.dragStart.y;

    let newX = this.selectionStart.x + dx;
    let newY = this.selectionStart.y + dy;

    // 경계 제한
    newX = Math.max(0, Math.min(newX, this.canvas.width - this.selection.width));
    newY = Math.max(0, Math.min(newY, this.canvas.height - this.selection.height));

    this.selection.x = newX;
    this.selection.y = newY;

    this._render();
  }

  /**
   * 리사이즈 처리
   */
  _handleResize(coords) {
    const dx = coords.x - this.dragStart.x;
    const dy = coords.y - this.dragStart.y;
    const start = this.selectionStart;
    const minSize = this.options.minSelectionSize;

    let newX = start.x;
    let newY = start.y;
    let newWidth = start.width;
    let newHeight = start.height;

    switch (this.resizeHandle) {
      case 'nw':
        newX = Math.min(start.x + dx, start.x + start.width - minSize);
        newY = Math.min(start.y + dy, start.y + start.height - minSize);
        newWidth = start.width - (newX - start.x);
        newHeight = start.height - (newY - start.y);
        break;
      case 'n':
        newY = Math.min(start.y + dy, start.y + start.height - minSize);
        newHeight = start.height - (newY - start.y);
        break;
      case 'ne':
        newY = Math.min(start.y + dy, start.y + start.height - minSize);
        newWidth = Math.max(minSize, start.width + dx);
        newHeight = start.height - (newY - start.y);
        break;
      case 'w':
        newX = Math.min(start.x + dx, start.x + start.width - minSize);
        newWidth = start.width - (newX - start.x);
        break;
      case 'e':
        newWidth = Math.max(minSize, start.width + dx);
        break;
      case 'sw':
        newX = Math.min(start.x + dx, start.x + start.width - minSize);
        newWidth = start.width - (newX - start.x);
        newHeight = Math.max(minSize, start.height + dy);
        break;
      case 's':
        newHeight = Math.max(minSize, start.height + dy);
        break;
      case 'se':
        newWidth = Math.max(minSize, start.width + dx);
        newHeight = Math.max(minSize, start.height + dy);
        break;
    }

    // 경계 제한
    newX = Math.max(0, newX);
    newY = Math.max(0, newY);
    newWidth = Math.min(newWidth, this.canvas.width - newX);
    newHeight = Math.min(newHeight, this.canvas.height - newY);

    this.selection = { x: newX, y: newY, width: newWidth, height: newHeight };
    this._render();
  }

  /**
   * 핸들별 커서 스타일
   */
  _getCursorForHandle(handle) {
    const cursors = {
      'nw': 'nwse-resize',
      'n': 'ns-resize',
      'ne': 'nesw-resize',
      'w': 'ew-resize',
      'e': 'ew-resize',
      'sw': 'nesw-resize',
      's': 'ns-resize',
      'se': 'nwse-resize'
    };
    return cursors[handle] || 'default';
  }

  /**
   * 정보 업데이트
   */
  _updateInfo() {
    if (!this.infoSpan || !this.imageLoaded) return;

    const sel = this.selection;
    // 원본 이미지 기준 크기 계산
    const origX = Math.round(sel.x / this.scale);
    const origY = Math.round(sel.y / this.scale);
    const origW = Math.round(sel.width / this.scale);
    const origH = Math.round(sel.height / this.scale);

    this.infoSpan.textContent = `선택 영역: ${origW} × ${origH}px (위치: ${origX}, ${origY})`;
  }

  /**
   * 선택 변경 알림
   */
  _notifySelectionChange() {
    if (this.onSelectionChangeCallback) {
      this.onSelectionChangeCallback(this.getSelection());
    }
  }

  /**
   * 현재 선택 영역 반환 (원본 이미지 기준)
   */
  getSelection() {
    const sel = this.selection;
    return {
      x: Math.round(sel.x / this.scale),
      y: Math.round(sel.y / this.scale),
      width: Math.round(sel.width / this.scale),
      height: Math.round(sel.height / this.scale)
    };
  }

  /**
   * 선택 영역 설정 (원본 이미지 기준)
   */
  setSelection(x, y, width, height) {
    this.selection = {
      x: x * this.scale,
      y: y * this.scale,
      width: width * this.scale,
      height: height * this.scale
    };
    this._render();
  }

  /**
   * 선택 영역 추출 (base64)
   */
  exportRegion(format = 'image/png', quality = 0.92) {
    if (!this.image || !this.imageLoaded) {
      console.error('이미지가 로드되지 않았습니다.');
      return null;
    }

    const sel = this.getSelection();

    // 임시 캔버스 생성
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sel.width;
    tempCanvas.height = sel.height;
    const tempCtx = tempCanvas.getContext('2d');

    // 원본 이미지에서 선택 영역 추출
    tempCtx.drawImage(
      this.image,
      sel.x, sel.y, sel.width, sel.height,
      0, 0, sel.width, sel.height
    );

    const dataURL = tempCanvas.toDataURL(format, quality);

    // 콜백 호출
    if (this.onExportCallback) {
      this.onExportCallback({
        dataURL,
        base64: dataURL.split(',')[1],
        selection: sel,
        format
      });
    }

    return dataURL;
  }

  /**
   * 선택 영역 추출 (Blob)
   */
  exportRegionAsBlob(format = 'image/png', quality = 0.92) {
    return new Promise((resolve, reject) => {
      if (!this.image || !this.imageLoaded) {
        reject(new Error('이미지가 로드되지 않았습니다.'));
        return;
      }

      const sel = this.getSelection();

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = sel.width;
      tempCanvas.height = sel.height;
      const tempCtx = tempCanvas.getContext('2d');

      tempCtx.drawImage(
        this.image,
        sel.x, sel.y, sel.width, sel.height,
        0, 0, sel.width, sel.height
      );

      tempCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, selection: sel, format });
          } else {
            reject(new Error('Blob 생성 실패'));
          }
        },
        format,
        quality
      );
    });
  }

  /**
   * 선택 변경 콜백 설정
   */
  onSelectionChange(callback) {
    this.onSelectionChangeCallback = callback;
  }

  /**
   * 추출 콜백 설정
   */
  onExport(callback) {
    this.onExportCallback = callback;
  }

  /**
   * OCR 콜백 설정
   */
  onOCR(callback) {
    this.onOCRCallback = callback;
  }

  /**
   * 선택 영역 OCR 실행
   */
  runOCR() {
    if (!this.image || !this.imageLoaded) {
      console.error('이미지가 로드되지 않았습니다.');
      return;
    }

    const sel = this.getSelection();
    const dataURL = this.exportRegion('image/png');

    if (this.onOCRCallback) {
      this.onOCRCallback({
        dataURL,
        base64: dataURL.split(',')[1],
        selection: sel
      });
    }
  }

  /**
   * 이미지 로드 여부
   */
  hasImage() {
    return this.imageLoaded;
  }

  /**
   * 원본 이미지 크기 반환
   */
  getImageSize() {
    if (!this.image) return null;
    return {
      width: this.image.width,
      height: this.image.height
    };
  }

  /**
   * 정리
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
  }
}

// 전역 등록
if (typeof window !== 'undefined') {
  window.ImageRegionSelector = ImageRegionSelector;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageRegionSelector;
}
