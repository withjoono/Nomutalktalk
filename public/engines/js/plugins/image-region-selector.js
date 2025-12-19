/**
 * ImageRegionSelector - 다중 영역 선택 플러그인
 * Canvas 기반으로 이미지 위에 여러 개의 선택 영역을 지원
 * 문제 영역과 자료(그림/표) 영역을 구분하여 관리
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
      problemColor: '#4a9eff',      // 문제 영역 색상 (파란색)
      resourceColor: '#ff9800',     // 자료 영역 색상 (주황색)
      activeColor: '#00ff00',       // 활성 영역 색상 (녹색)
      selectionBorderWidth: 2,
      overlayColor: 'rgba(0, 0, 0, 0.3)',
      minSelectionSize: 20,
      ...options
    };

    // 상태
    this.image = null;
    this.imageLoaded = false;
    this.regions = [];  // 다중 영역 배열
    this.activeRegionIndex = -1;  // 현재 선택된 영역 인덱스
    this.currentRegionType = 'problem';  // 'problem' | 'resource'
    this.nextRegionNumber = { problem: 1, resource: 1 };

    // 드래그/리사이즈 상태
    this.isDragging = false;
    this.isResizing = false;
    this.isDrawing = false;  // 새 영역 그리기
    this.resizeHandle = null;
    this.dragStart = { x: 0, y: 0 };
    this.drawStart = { x: 0, y: 0 };

    // 스케일
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // 콜백
    this.onSelectionChangeCallback = null;
    this.onExportCallback = null;
    this.onOCRCallback = null;
    this.onRegionAddCallback = null;
    this.onRegionDeleteCallback = null;

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

    // 툴바
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'irs-toolbar';
    this.toolbar.style.cssText = `
      display: flex;
      gap: 8px;
      padding: 8px;
      background: #2a2a3e;
      border-bottom: 1px solid #404060;
      align-items: center;
      flex-wrap: wrap;
    `;
    this.toolbar.innerHTML = `
      <div class="irs-region-type-selector" style="display: flex; gap: 4px; margin-right: 8px;">
        <button class="irs-type-btn active" data-type="problem" style="
          padding: 6px 12px;
          background: #4a9eff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">📝 문제 영역</button>
        <button class="irs-type-btn" data-type="resource" style="
          padding: 6px 12px;
          background: #363650;
          color: #e0e0e0;
          border: 1px solid #404060;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">🖼️ 자료 영역</button>
      </div>
      <button class="irs-delete-btn" style="
        padding: 6px 12px;
        background: #f44336;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      " disabled>🗑️ 선택 삭제</button>
      <button class="irs-clear-btn" style="
        padding: 6px 12px;
        background: #363650;
        color: #e0e0e0;
        border: 1px solid #404060;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      ">↺ 전체 초기화</button>
      <span class="irs-info" style="
        margin-left: auto;
        font-size: 11px;
        color: #a0a0b0;
      ">드래그하여 영역을 그리세요</span>
    `;

    // 메인 컨테이너 (캔버스 + 영역 목록)
    this.mainContainer = document.createElement('div');
    this.mainContainer.style.cssText = `
      flex: 1;
      display: flex;
      overflow: hidden;
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

    // 메인 Canvas
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

    // 영역 목록 패널
    this.regionListPanel = document.createElement('div');
    this.regionListPanel.className = 'irs-region-list';
    this.regionListPanel.style.cssText = `
      width: 200px;
      background: #2a2a3e;
      border-left: 1px solid #404060;
      overflow-y: auto;
      padding: 8px;
    `;
    this.regionListPanel.innerHTML = `
      <div style="font-size: 12px; color: #a0a0b0; margin-bottom: 8px; font-weight: bold;">
        📋 영역 목록
      </div>
      <div class="irs-region-items" style="display: flex; flex-direction: column; gap: 4px;"></div>
    `;

    // 조립
    this.canvasContainer.appendChild(this.canvas);
    this.canvasContainer.appendChild(this.emptyState);
    this.mainContainer.appendChild(this.canvasContainer);
    this.mainContainer.appendChild(this.regionListPanel);
    this.wrapper.appendChild(this.toolbar);
    this.wrapper.appendChild(this.mainContainer);
    this.container.appendChild(this.wrapper);

    // 요소 참조
    this.deleteBtn = this.toolbar.querySelector('.irs-delete-btn');
    this.clearBtn = this.toolbar.querySelector('.irs-clear-btn');
    this.infoSpan = this.toolbar.querySelector('.irs-info');
    this.typeBtns = this.toolbar.querySelectorAll('.irs-type-btn');
    this.regionItems = this.regionListPanel.querySelector('.irs-region-items');
  }

  /**
   * 이벤트 바인딩
   */
  _bindEvents() {
    // 영역 타입 선택
    this.typeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.typeBtns.forEach(b => {
          b.classList.remove('active');
          b.style.background = '#363650';
          b.style.border = '1px solid #404060';
          b.style.color = '#e0e0e0';
        });
        btn.classList.add('active');
        btn.style.border = 'none';

        const type = btn.dataset.type;
        this.currentRegionType = type;
        btn.style.background = type === 'problem' ? '#4a9eff' : '#ff9800';
        btn.style.color = 'white';
      });
    });

    // 선택 삭제
    this.deleteBtn.addEventListener('click', () => {
      this.deleteActiveRegion();
    });

    // 전체 초기화
    this.clearBtn.addEventListener('click', () => {
      this.clearAllRegions();
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
   * 새 영역 추가
   */
  addRegion(type, x, y, width, height, label = null) {
    const regionNumber = this.nextRegionNumber[type]++;
    const defaultLabel = type === 'problem'
      ? `문제 ${regionNumber}`
      : `자료 ${regionNumber}`;

    const region = {
      id: `region-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: type,
      label: label || defaultLabel,
      x: x,
      y: y,
      width: width,
      height: height,
      color: type === 'problem' ? this.options.problemColor : this.options.resourceColor
    };

    this.regions.push(region);
    this.activeRegionIndex = this.regions.length - 1;
    this._updateRegionList();
    this._render();
    this._updateDeleteButton();

    if (this.onRegionAddCallback) {
      this.onRegionAddCallback(region);
    }

    return region;
  }

  /**
   * 활성 영역 삭제
   */
  deleteActiveRegion() {
    if (this.activeRegionIndex < 0 || this.activeRegionIndex >= this.regions.length) return;

    const deleted = this.regions.splice(this.activeRegionIndex, 1)[0];
    this.activeRegionIndex = -1;
    this._updateRegionList();
    this._render();
    this._updateDeleteButton();

    if (this.onRegionDeleteCallback) {
      this.onRegionDeleteCallback(deleted);
    }
  }

  /**
   * 모든 영역 초기화
   */
  clearAllRegions() {
    this.regions = [];
    this.activeRegionIndex = -1;
    this.nextRegionNumber = { problem: 1, resource: 1 };
    this._updateRegionList();
    this._render();
    this._updateDeleteButton();
  }

  /**
   * 영역 목록 UI 업데이트
   */
  _updateRegionList() {
    this.regionItems.innerHTML = '';

    if (this.regions.length === 0) {
      this.regionItems.innerHTML = `
        <div style="font-size: 11px; color: #666; text-align: center; padding: 16px;">
          영역이 없습니다.<br>이미지 위에서 드래그하여<br>영역을 추가하세요.
        </div>
      `;
      return;
    }

    this.regions.forEach((region, index) => {
      const item = document.createElement('div');
      item.className = 'irs-region-item';
      item.dataset.index = index;
      const isActive = index === this.activeRegionIndex;

      item.style.cssText = `
        padding: 8px;
        background: ${isActive ? '#404060' : '#363650'};
        border: 1px solid ${isActive ? region.color : '#404060'};
        border-left: 4px solid ${region.color};
        border-radius: 4px;
        cursor: pointer;
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
      `;

      const icon = region.type === 'problem' ? '📝' : '🖼️';
      item.innerHTML = `
        <span style="flex: 1;">${icon} ${region.label}</span>
        <button class="irs-edit-label" style="
          background: none;
          border: none;
          color: #a0a0b0;
          cursor: pointer;
          padding: 2px;
          font-size: 10px;
        " title="라벨 수정">✏️</button>
      `;

      // 클릭으로 영역 선택
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('irs-edit-label')) {
          this.activeRegionIndex = index;
          this._updateRegionList();
          this._render();
          this._updateDeleteButton();
        }
      });

      // 라벨 수정
      item.querySelector('.irs-edit-label').addEventListener('click', (e) => {
        e.stopPropagation();
        const newLabel = prompt('새 라벨 입력:', region.label);
        if (newLabel && newLabel.trim()) {
          region.label = newLabel.trim();
          this._updateRegionList();
          this._render();
        }
      });

      this.regionItems.appendChild(item);
    });
  }

  /**
   * 삭제 버튼 상태 업데이트
   */
  _updateDeleteButton() {
    this.deleteBtn.disabled = this.activeRegionIndex < 0;
    this.deleteBtn.style.opacity = this.activeRegionIndex < 0 ? '0.5' : '1';
  }

  /**
   * Canvas 렌더링
   */
  _render() {
    if (!this.ctx || !this.image) return;

    const ctx = this.ctx;
    const { width, height } = this.canvas;

    // 클리어
    ctx.clearRect(0, 0, width, height);

    // 이미지 그리기
    ctx.drawImage(this.image, 0, 0, width, height);

    // 약간의 오버레이 (전체)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, width, height);

    // 모든 영역 그리기
    this.regions.forEach((region, index) => {
      const isActive = index === this.activeRegionIndex;
      this._drawRegion(region, isActive);
    });

    // 그리기 중인 영역 표시
    if (this.isDrawing && this.drawingRegion) {
      this._drawRegion(this.drawingRegion, true);
    }

    // 정보 업데이트
    this._updateInfo();
  }

  /**
   * 단일 영역 그리기
   */
  _drawRegion(region, isActive) {
    const ctx = this.ctx;
    const x = region.x * this.scale;
    const y = region.y * this.scale;
    const w = region.width * this.scale;
    const h = region.height * this.scale;

    // 영역 내부 약간 밝게
    ctx.fillStyle = isActive ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(x, y, w, h);

    // 테두리
    ctx.strokeStyle = isActive ? this.options.activeColor : region.color;
    ctx.lineWidth = isActive ? 3 : 2;
    ctx.setLineDash(isActive ? [] : [5, 5]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // 라벨 배경
    const labelText = region.label;
    ctx.font = '12px sans-serif';
    const textMetrics = ctx.measureText(labelText);
    const labelPadding = 4;
    const labelHeight = 18;
    const labelWidth = textMetrics.width + labelPadding * 2;

    ctx.fillStyle = region.color;
    ctx.fillRect(x, y - labelHeight - 2, labelWidth, labelHeight);

    // 라벨 텍스트
    ctx.fillStyle = 'white';
    ctx.fillText(labelText, x + labelPadding, y - 6);

    // 활성 영역이면 리사이즈 핸들 그리기
    if (isActive) {
      this._drawHandles(region);
    }
  }

  /**
   * 리사이즈 핸들 그리기
   */
  _drawHandles(region) {
    const ctx = this.ctx;
    const handles = this._getHandlePositions(region);
    const size = this.options.handleSize;
    const half = size / 2;

    ctx.fillStyle = this.options.activeColor;
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
  _getHandlePositions(region) {
    const x = region.x * this.scale;
    const y = region.y * this.scale;
    const w = region.width * this.scale;
    const h = region.height * this.scale;

    return [
      { name: 'nw', x: x, y: y },
      { name: 'n', x: x + w / 2, y: y },
      { name: 'ne', x: x + w, y: y },
      { name: 'w', x: x, y: y + h / 2 },
      { name: 'e', x: x + w, y: y + h / 2 },
      { name: 'sw', x: x, y: y + h },
      { name: 's', x: x + w / 2, y: y + h },
      { name: 'se', x: x + w, y: y + h }
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
   * 이미지 좌표로 변환
   */
  _toImageCoords(canvasX, canvasY) {
    return {
      x: canvasX / this.scale,
      y: canvasY / this.scale
    };
  }

  /**
   * 핸들 감지
   */
  _getHandleAtPoint(x, y) {
    if (this.activeRegionIndex < 0) return null;

    const region = this.regions[this.activeRegionIndex];
    const handles = this._getHandlePositions(region);
    const threshold = this.options.handleSize + 4;

    for (const handle of handles) {
      if (Math.abs(x - handle.x) <= threshold && Math.abs(y - handle.y) <= threshold) {
        return handle.name;
      }
    }
    return null;
  }

  /**
   * 클릭 위치의 영역 찾기
   */
  _getRegionAtPoint(canvasX, canvasY) {
    const imgCoords = this._toImageCoords(canvasX, canvasY);

    // 뒤에서부터 검색 (나중에 추가된 영역이 위에 있음)
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const region = this.regions[i];
      if (imgCoords.x >= region.x && imgCoords.x <= region.x + region.width &&
          imgCoords.y >= region.y && imgCoords.y <= region.y + region.height) {
        return i;
      }
    }
    return -1;
  }

  /**
   * 마우스 다운
   */
  _onMouseDown(e) {
    if (!this.imageLoaded) return;

    const coords = this._getCanvasCoords(e);
    const handle = this._getHandleAtPoint(coords.x, coords.y);

    if (handle) {
      // 리사이즈 시작
      this.isResizing = true;
      this.resizeHandle = handle;
      this.dragStart = coords;
      this.originalRegion = { ...this.regions[this.activeRegionIndex] };
    } else {
      const regionIndex = this._getRegionAtPoint(coords.x, coords.y);

      if (regionIndex >= 0 && regionIndex === this.activeRegionIndex) {
        // 드래그 시작
        this.isDragging = true;
        this.dragStart = coords;
        this.originalRegion = { ...this.regions[this.activeRegionIndex] };
      } else if (regionIndex >= 0) {
        // 다른 영역 선택
        this.activeRegionIndex = regionIndex;
        this._updateRegionList();
        this._render();
        this._updateDeleteButton();
      } else {
        // 새 영역 그리기 시작
        this.isDrawing = true;
        this.drawStart = this._toImageCoords(coords.x, coords.y);
        this.drawingRegion = {
          type: this.currentRegionType,
          label: '새 영역',
          x: this.drawStart.x,
          y: this.drawStart.y,
          width: 0,
          height: 0,
          color: this.currentRegionType === 'problem'
            ? this.options.problemColor
            : this.options.resourceColor
        };
        // 선택 해제
        this.activeRegionIndex = -1;
        this._updateRegionList();
        this._updateDeleteButton();
      }
    }
  }

  /**
   * 마우스 이동
   */
  _onMouseMove(e) {
    if (!this.imageLoaded) return;

    const coords = this._getCanvasCoords(e);

    // 커서 스타일 업데이트
    if (!this.isDragging && !this.isResizing && !this.isDrawing) {
      const handle = this._getHandleAtPoint(coords.x, coords.y);
      if (handle) {
        this.canvas.style.cursor = this._getCursorForHandle(handle);
      } else {
        const regionIndex = this._getRegionAtPoint(coords.x, coords.y);
        if (regionIndex >= 0 && regionIndex === this.activeRegionIndex) {
          this.canvas.style.cursor = 'move';
        } else if (regionIndex >= 0) {
          this.canvas.style.cursor = 'pointer';
        } else {
          this.canvas.style.cursor = 'crosshair';
        }
      }
    }

    // 드래그
    if (this.isDragging && this.activeRegionIndex >= 0) {
      const dx = (coords.x - this.dragStart.x) / this.scale;
      const dy = (coords.y - this.dragStart.y) / this.scale;

      const region = this.regions[this.activeRegionIndex];
      region.x = Math.max(0, Math.min(this.originalRegion.x + dx, this.image.width - region.width));
      region.y = Math.max(0, Math.min(this.originalRegion.y + dy, this.image.height - region.height));

      this._render();
    }

    // 리사이즈
    if (this.isResizing && this.activeRegionIndex >= 0) {
      this._handleResize(coords);
    }

    // 새 영역 그리기
    if (this.isDrawing && this.drawingRegion) {
      const currentPos = this._toImageCoords(coords.x, coords.y);

      const x = Math.min(this.drawStart.x, currentPos.x);
      const y = Math.min(this.drawStart.y, currentPos.y);
      const width = Math.abs(currentPos.x - this.drawStart.x);
      const height = Math.abs(currentPos.y - this.drawStart.y);

      this.drawingRegion.x = x;
      this.drawingRegion.y = y;
      this.drawingRegion.width = width;
      this.drawingRegion.height = height;

      this._render();
    }
  }

  /**
   * 마우스 업
   */
  _onMouseUp(e) {
    // 새 영역 그리기 완료
    if (this.isDrawing && this.drawingRegion) {
      const minSize = this.options.minSelectionSize;
      if (this.drawingRegion.width >= minSize && this.drawingRegion.height >= minSize) {
        this.addRegion(
          this.drawingRegion.type,
          this.drawingRegion.x,
          this.drawingRegion.y,
          this.drawingRegion.width,
          this.drawingRegion.height
        );
      }
      this.drawingRegion = null;
    }

    // 상태 변경 알림
    if (this.isDragging || this.isResizing) {
      this._notifySelectionChange();
    }

    this.isDragging = false;
    this.isResizing = false;
    this.isDrawing = false;
    this.resizeHandle = null;
    this._render();
  }

  /**
   * 리사이즈 처리
   */
  _handleResize(coords) {
    const region = this.regions[this.activeRegionIndex];
    const orig = this.originalRegion;
    const dx = (coords.x - this.dragStart.x) / this.scale;
    const dy = (coords.y - this.dragStart.y) / this.scale;
    const minSize = this.options.minSelectionSize;

    let newX = orig.x;
    let newY = orig.y;
    let newWidth = orig.width;
    let newHeight = orig.height;

    switch (this.resizeHandle) {
      case 'nw':
        newX = Math.min(orig.x + dx, orig.x + orig.width - minSize);
        newY = Math.min(orig.y + dy, orig.y + orig.height - minSize);
        newWidth = orig.width - (newX - orig.x);
        newHeight = orig.height - (newY - orig.y);
        break;
      case 'n':
        newY = Math.min(orig.y + dy, orig.y + orig.height - minSize);
        newHeight = orig.height - (newY - orig.y);
        break;
      case 'ne':
        newY = Math.min(orig.y + dy, orig.y + orig.height - minSize);
        newWidth = Math.max(minSize, orig.width + dx);
        newHeight = orig.height - (newY - orig.y);
        break;
      case 'w':
        newX = Math.min(orig.x + dx, orig.x + orig.width - minSize);
        newWidth = orig.width - (newX - orig.x);
        break;
      case 'e':
        newWidth = Math.max(minSize, orig.width + dx);
        break;
      case 'sw':
        newX = Math.min(orig.x + dx, orig.x + orig.width - minSize);
        newWidth = orig.width - (newX - orig.x);
        newHeight = Math.max(minSize, orig.height + dy);
        break;
      case 's':
        newHeight = Math.max(minSize, orig.height + dy);
        break;
      case 'se':
        newWidth = Math.max(minSize, orig.width + dx);
        newHeight = Math.max(minSize, orig.height + dy);
        break;
    }

    // 경계 제한
    newX = Math.max(0, newX);
    newY = Math.max(0, newY);
    newWidth = Math.min(newWidth, this.image.width - newX);
    newHeight = Math.min(newHeight, this.image.height - newY);

    region.x = newX;
    region.y = newY;
    region.width = newWidth;
    region.height = newHeight;

    this._render();
  }

  /**
   * 터치 이벤트
   */
  _onTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this._onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
  }

  _onTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this._onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  }

  _onTouchEnd(e) {
    this._onMouseUp(e);
  }

  /**
   * 핸들별 커서 스타일
   */
  _getCursorForHandle(handle) {
    const cursors = {
      'nw': 'nwse-resize', 'n': 'ns-resize', 'ne': 'nesw-resize',
      'w': 'ew-resize', 'e': 'ew-resize',
      'sw': 'nesw-resize', 's': 'ns-resize', 'se': 'nwse-resize'
    };
    return cursors[handle] || 'default';
  }

  /**
   * 정보 업데이트
   */
  _updateInfo() {
    if (!this.infoSpan) return;

    const problemCount = this.regions.filter(r => r.type === 'problem').length;
    const resourceCount = this.regions.filter(r => r.type === 'resource').length;

    if (this.regions.length === 0) {
      this.infoSpan.textContent = '드래그하여 영역을 그리세요';
    } else {
      this.infoSpan.textContent = `문제: ${problemCount}개, 자료: ${resourceCount}개`;
    }
  }

  /**
   * 선택 변경 알림
   */
  _notifySelectionChange() {
    if (this.onSelectionChangeCallback) {
      this.onSelectionChangeCallback(this.getAllRegions());
    }
  }

  // ==================== Public API ====================

  /**
   * 모든 영역 반환
   */
  getAllRegions() {
    return this.regions.map(r => ({
      id: r.id,
      type: r.type,
      label: r.label,
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height)
    }));
  }

  /**
   * 문제 영역만 반환
   */
  getProblemRegions() {
    return this.getAllRegions().filter(r => r.type === 'problem');
  }

  /**
   * 자료 영역만 반환
   */
  getResourceRegions() {
    return this.getAllRegions().filter(r => r.type === 'resource');
  }

  /**
   * 활성 영역 반환
   */
  getActiveRegion() {
    if (this.activeRegionIndex < 0) return null;
    const r = this.regions[this.activeRegionIndex];
    return {
      id: r.id,
      type: r.type,
      label: r.label,
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height)
    };
  }

  /**
   * 현재 선택 영역 반환 (하위 호환성)
   */
  getSelection() {
    return this.getActiveRegion();
  }

  /**
   * 특정 영역 이미지 추출
   */
  exportRegion(regionOrIndex = null, format = 'image/png', quality = 0.92) {
    if (!this.image || !this.imageLoaded) {
      console.error('이미지가 로드되지 않았습니다.');
      return null;
    }

    let region;
    if (regionOrIndex === null) {
      if (this.activeRegionIndex < 0) return null;
      region = this.regions[this.activeRegionIndex];
    } else if (typeof regionOrIndex === 'number') {
      region = this.regions[regionOrIndex];
    } else {
      region = regionOrIndex;
    }

    if (!region) return null;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = region.width;
    tempCanvas.height = region.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(
      this.image,
      region.x, region.y, region.width, region.height,
      0, 0, region.width, region.height
    );

    const dataURL = tempCanvas.toDataURL(format, quality);

    if (this.onExportCallback) {
      this.onExportCallback({
        dataURL,
        base64: dataURL.split(',')[1],
        region: region,
        format
      });
    }

    return dataURL;
  }

  /**
   * 모든 영역 이미지 추출
   */
  exportAllRegions(format = 'image/png', quality = 0.92) {
    return this.regions.map((region, index) => ({
      ...region,
      dataURL: this.exportRegion(index, format, quality)
    }));
  }

  /**
   * 선택 영역 OCR 실행
   */
  runOCR(regionIndex = null) {
    if (!this.image || !this.imageLoaded) {
      console.error('이미지가 로드되지 않았습니다.');
      return;
    }

    const index = regionIndex !== null ? regionIndex : this.activeRegionIndex;
    if (index < 0) return;

    const region = this.regions[index];
    const dataURL = this.exportRegion(index);

    if (this.onOCRCallback) {
      this.onOCRCallback({
        dataURL,
        base64: dataURL.split(',')[1],
        region: region
      });
    }
  }

  /**
   * 콜백 설정
   */
  onSelectionChange(callback) { this.onSelectionChangeCallback = callback; }
  onExport(callback) { this.onExportCallback = callback; }
  onOCR(callback) { this.onOCRCallback = callback; }
  onRegionAdd(callback) { this.onRegionAddCallback = callback; }
  onRegionDelete(callback) { this.onRegionDeleteCallback = callback; }

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
    return { width: this.image.width, height: this.image.height };
  }

  /**
   * 선택 영역 초기화 (하위 호환성)
   */
  resetSelection() {
    this.clearAllRegions();
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
