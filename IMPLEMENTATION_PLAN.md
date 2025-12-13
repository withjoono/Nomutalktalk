# 문제 출제 Agent 수정 상세 구현 계획서

## 개요
편집자 출제용 문제 은행 시스템의 13개 수정 요청사항에 대한 상세 구현 계획

---

## 1. 과목 선택: 중등 수학 추가

### 현재 상태
- `subjects.json` (2015 교육과정): 고등학교 과목만 포함
- `subjects-2022.json` (2022 교육과정): 고등학교 과목만 포함 (수학, 과학, 정보)

### 구현 계획

#### 1.1 subjects.json 수정
```json
{
  "subject": "수학",
  "subjectCode": "M15",
  "courses": [
    // 중학교 1학년
    {
      "id": "M1501",
      "name": "중1 수학",
      "grade": "중1",
      "publishers": [
        {
          "name": "비상교육",
          "chapters": [
            { "id": 1, "name": "자연수와 정수" },
            { "id": 2, "name": "유리수" },
            { "id": 3, "name": "문자와 식" },
            { "id": 4, "name": "일차방정식" },
            { "id": 5, "name": "좌표평면과 그래프" },
            { "id": 6, "name": "정비례와 반비례" },
            { "id": 7, "name": "기본 도형" },
            { "id": 8, "name": "평면도형" },
            { "id": 9, "name": "입체도형" },
            { "id": 10, "name": "통계" }
          ]
        }
      ]
    },
    // 중학교 2학년
    {
      "id": "M1502",
      "name": "중2 수학",
      "grade": "중2",
      "publishers": [...]
    },
    // 중학교 3학년
    {
      "id": "M1503",
      "name": "중3 수학",
      "grade": "중3",
      "publishers": [...]
    }
  ]
}
```

#### 1.2 subjects-2022.json 수정
2022 개정 교육과정 기준 중등 수학 과목 추가

#### 1.3 파일 위치
- `public/subjects.json`
- `public/subjects-2022.json`

#### 예상 작업량: **중간** (2-3시간)

---

## 2. 스토어 관리: 이름 수정/삭제 기능

### 현재 상태
- 삭제: `DELETE /api/store/:storeName` 구현됨
- 수정: 미구현

### 구현 계획

#### 2.1 Backend API 추가 (server.js)
```javascript
// PUT /api/store/:storeName/rename
app.put('/api/store/:storeName/rename', async (req, res) => {
  const { storeName } = req.params;
  const { newDisplayName } = req.body;
  // Google File Search API의 store rename 호출
});
```

#### 2.2 Frontend UI 추가 (index.html)
```html
<div id="existingStoreForm" class="form-section">
  <select id="existingStoreSelect">...</select>
  <div class="store-actions">
    <button onclick="useExistingStore()">📂 사용</button>
    <button onclick="renameStore()">✏️ 이름 변경</button>
    <button onclick="deleteStore()">🗑️ 삭제</button>
  </div>
</div>
```

#### 2.3 Frontend 함수 추가 (app.js)
```javascript
async function renameStore() {
  const storeSelect = document.getElementById('existingStoreSelect');
  const storeName = storeSelect.value;
  const newName = prompt('새 스토어 이름을 입력하세요:', storeName);
  // API 호출
}
```

#### 예상 작업량: **작음** (1-2시간)

---

## 3. 문서 관리 vs RAG 문서 관리 통합

### 현재 상태
- **문서 관리 섹션** (lines 223-231): 업로드된 문서 목록, 삭제 기능
- **RAG 문서 관리 섹션** (lines 934-967): 필터, 검색, 상세 정보

### 분석
| 항목 | 문서 관리 | RAG 문서 관리 |
|-----|----------|--------------|
| 목적 | 기본 문서 목록 | 상세 RAG 정보 관리 |
| 기능 | 목록, 삭제 | 필터, 검색, 타입별 |
| 중복 | 있음 | 있음 |

### 구현 계획

#### 3.1 통합 방안 제안
**Option A: 문서 관리 섹션 제거, RAG 문서 관리로 통합**
- 장점: UI 단순화, 중복 제거
- 단점: 위치 변경에 따른 사용자 혼란

**Option B: 문서 관리를 간략 요약, RAG 관리를 상세 보기로 분리**
- 문서 관리: 문서 수, 용량 등 요약 정보만
- RAG 관리: 상세 문서 목록, 필터, 검색

**권장: Option B**

#### 3.2 UI 수정
```html
<!-- 문서 관리 섹션 (간략 요약) -->
<section class="card">
  <h2>📚 문서 현황</h2>
  <div class="doc-summary">
    <span>총 문서: <strong id="totalDocCount">0</strong>개</span>
    <span>RAG 인덱싱: <strong id="ragIndexedCount">0</strong>개</span>
  </div>
  <button onclick="scrollToRAGManagement()">📋 상세 관리</button>
</section>
```

#### 예상 작업량: **작음** (1시간)

---

## 4. 파일 업로드: RAG UI 통합 및 embedding 결과 확인

### 현재 상태
- 파일 업로드 후 embedding 결과 확인 불가
- 이미지 RAG 결과 확인 불가
- 특수 문자 인식 결과 확인 불가

### 구현 계획

#### 4.1 Backend API 추가 (server.js)
```javascript
// POST /api/upload/preview-embedding
// 업로드 전 embedding 미리보기
app.post('/api/upload/preview-embedding', async (req, res) => {
  const { fileData, fileType } = req.body;
  // 텍스트 추출 미리보기
  // 청크 분리 미리보기
  // 특수 문자/수식 인식 미리보기
});

// GET /api/documents/:documentName/chunks
// 문서의 청크 목록 조회
app.get('/api/documents/:documentName/chunks', async (req, res) => {
  // RAG 스토어에서 청크 정보 조회
});
```

#### 4.2 Frontend UI 추가 (index.html)
```html
<!-- 파일 업로드 섹션에 추가 -->
<div id="embeddingPreviewSection" style="display: none;">
  <h4>📊 Embedding 미리보기</h4>
  <div class="embedding-preview">
    <div class="preview-item">
      <span class="label">추출 텍스트:</span>
      <pre id="extractedTextPreview"></pre>
    </div>
    <div class="preview-item">
      <span class="label">청크 분할:</span>
      <div id="chunkPreview"></div>
    </div>
    <div class="preview-item">
      <span class="label">특수 문자/수식:</span>
      <div id="specialCharPreview"></div>
    </div>
    <div class="preview-item">
      <span class="label">이미지 인식 (있는 경우):</span>
      <div id="imageOCRPreview"></div>
    </div>
  </div>
  <button onclick="confirmUpload()">✅ 업로드 확정</button>
  <button onclick="cancelPreview()">❌ 취소</button>
</div>
```

#### 4.3 이미지 RAG 결과 확인
```javascript
async function previewImageRAG(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch('/api/upload/preview-image-rag', {
    method: 'POST',
    body: formData
  });

  // OCR 텍스트 표시
  // 인식된 수식 표시
  // 특수 문자 인식 결과 표시
}
```

#### 예상 작업량: **큼** (4-6시간)

---

## 5. 참조 문제 업로드: AI 모델 선택 최신화

### 현재 상태
```html
<!-- Gemini -->
<option value="gemini-2.0-flash-exp" selected>Gemini 2.0 Flash</option>
<option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
<option value="gemini-1.5-flash">Gemini 1.5 Flash</option>

<!-- OpenAI -->
<option value="gpt-4o">GPT-4o</option>
<option value="gpt-4o-mini">GPT-4o Mini</option>
<option value="gpt-4.1">GPT-4.1 (Preview)</option>
<option value="o3">o3 (Reasoning)</option>
<option value="o3-mini">o3 Mini</option>
```

### 구현 계획

#### 5.1 최신 모델 추가 (index.html)
```html
<!-- Gemini 최신 -->
<select id="geminiModelSelect" class="model-select">
  <optgroup label="최신 모델">
    <option value="gemini-2.0-flash-exp" selected>Gemini 2.0 Flash (최신)</option>
    <option value="gemini-2.0-pro">Gemini 2.0 Pro</option>
  </optgroup>
  <optgroup label="안정 버전">
    <option value="gemini-1.5-pro-latest">Gemini 1.5 Pro (Latest)</option>
    <option value="gemini-1.5-flash-latest">Gemini 1.5 Flash (Latest)</option>
  </optgroup>
</select>

<!-- OpenAI 최신 -->
<select id="openaiModelSelect" class="model-select">
  <option value="">사용 안함</option>
  <optgroup label="추론 모델">
    <option value="o1">o1 (고급 추론)</option>
    <option value="o1-mini">o1 Mini</option>
    <option value="o3">o3 (최신 추론)</option>
    <option value="o3-mini">o3 Mini</option>
  </optgroup>
  <optgroup label="GPT 모델">
    <option value="gpt-4o">GPT-4o</option>
    <option value="gpt-4o-mini">GPT-4o Mini</option>
    <option value="gpt-4-turbo">GPT-4 Turbo</option>
  </optgroup>
</select>
```

#### 5.2 Backend 모델 검증 추가 (server.js)
```javascript
const VALID_GEMINI_MODELS = [
  'gemini-2.0-flash-exp', 'gemini-2.0-pro',
  'gemini-1.5-pro-latest', 'gemini-1.5-flash-latest'
];

const VALID_OPENAI_MODELS = [
  'o1', 'o1-mini', 'o3', 'o3-mini',
  'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'
];
```

#### 예상 작업량: **작음** (30분-1시간)

---

## 6. 참조 문제 업로드: Ctrl+V 입력 기능

### 현재 상태
- 드래그 앤 드롭, 파일 선택만 지원
- 클립보드 붙여넣기 미지원

### 구현 계획

#### 6.1 이벤트 리스너 추가 (app.js)
```javascript
function setupPasteListener() {
  const dropZone = document.getElementById('referenceDropZone');

  // 드롭존에 포커스 가능하도록 설정
  dropZone.tabIndex = 0;

  // 전체 문서에서 Ctrl+V 감지
  document.addEventListener('paste', async (e) => {
    // 현재 활성 요소가 입력 필드가 아닌 경우에만
    if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA') {
      return;
    }

    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      handleReferenceFiles(imageFiles);
      showAlert(`📋 ${imageFiles.length}개 이미지가 붙여넣기되었습니다.`, 'success');
    }
  });
}
```

#### 6.2 UI 힌트 추가 (index.html)
```html
<div class="drop-zone-content">
  <span class="drop-icon">📄</span>
  <p>이미지 또는 PDF를 드래그하거나 클릭하여 업로드</p>
  <small>지원 형식: JPG, PNG, PDF (최대 10MB)</small>
  <small class="paste-hint">💡 Ctrl+V로 클립보드 이미지 붙여넣기 가능</small>
</div>
```

#### 예상 작업량: **작음** (1시간)

---

## 7. 참조 문제 업로드: 문제/그림 영역 자동/수동 설정

### 현재 상태
- 영역 선택 모달 존재 (lines 1039-1083)
- AI 자동 감지 버튼 존재
- 구현 완성도 확인 필요

### 구현 계획

#### 7.1 모달 기능 검증 및 보완

**필요한 기능:**
1. 이미지 로드 및 캔버스 표시
2. 마우스 드래그로 영역 선택
3. AI 자동 영역 감지
4. 영역 타입 지정 (문제/그림/표)
5. 영역 목록 관리 (추가/수정/삭제)
6. 영역 적용 후 OCR 수행

#### 7.2 Backend API 추가 (server.js)
```javascript
// POST /api/detect-regions
// AI 기반 영역 자동 감지
app.post('/api/detect-regions', async (req, res) => {
  const { imageData } = req.body;

  // Gemini Vision API로 영역 감지
  const prompt = `
    이 시험지 이미지에서 다음 영역들을 감지하세요:
    1. 문제 텍스트 영역 (각 문제별로)
    2. 그림/도형 영역
    3. 표 영역
    4. 보기 영역

    각 영역의 좌표를 {x, y, width, height, type} 형식으로 반환하세요.
  `;

  // 결과 반환
  res.json({
    success: true,
    regions: detectedRegions
  });
});
```

#### 7.3 Canvas 기반 영역 선택 (app.js)
```javascript
class RegionSelector {
  constructor(canvasId, imageId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.regions = [];
    this.currentMode = null; // 'problem', 'asset', null
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
  }

  loadImage(imageSrc) {
    // 이미지 로드 및 캔버스 크기 조정
  }

  setMode(mode) {
    this.currentMode = mode;
    this.updateModeIndicator();
  }

  startDraw(e) {
    if (!this.currentMode) return;
    this.isDrawing = true;
    this.startX = e.offsetX;
    this.startY = e.offsetY;
  }

  draw(e) {
    if (!this.isDrawing) return;
    // 실시간 사각형 그리기
  }

  endDraw(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    const region = {
      type: this.currentMode,
      x: Math.min(this.startX, e.offsetX),
      y: Math.min(this.startY, e.offsetY),
      width: Math.abs(e.offsetX - this.startX),
      height: Math.abs(e.offsetY - this.startY)
    };

    this.regions.push(region);
    this.redraw();
  }

  async autoDetect() {
    // AI 자동 감지 API 호출
    const response = await fetch('/api/detect-regions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData: this.getImageData() })
    });

    const data = await response.json();
    if (data.success) {
      this.regions = data.regions;
      this.redraw();
    }
  }
}
```

#### 예상 작업량: **큼** (4-6시간)

---

## 8-9. OCR 결과 분리 표시 및 UI 통합

### 요구사항 정리
1. ③ '문제 입력' 버튼 필요
2. ④ OCR된 텍스트, 이미지, 표가 창에 표시
3. ⑤ OCR 결과를 텍스트/이미지/표로 분리 표시
4. ⑥ 입력 문제와 생성 문제 UI 통일
5. 여러 문제 동시 입력 시 페이지별 한 문제씩 표시
6. ⑥ DB에서 문제 불러오기 기능
7. ⑦ OCR 진행중 표시
8. ⑧ 해설 및 정답 생성 버튼
9. ⑨ '참조 문제 저장' 버튼

### 구현 계획

#### 8.1 통합 문제 뷰어 컴포넌트 (app.js)
```javascript
class ProblemViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.problems = [];
    this.currentIndex = 0;
  }

  // 문제 목록 설정
  setProblems(problems) {
    this.problems = problems;
    this.currentIndex = 0;
    this.render();
  }

  // 현재 문제 렌더링
  render() {
    const problem = this.problems[this.currentIndex];
    if (!problem) return;

    this.container.innerHTML = `
      <!-- 페이지네이션 -->
      <div class="problem-pagination">
        <button onclick="problemViewer.prev()" ${this.currentIndex === 0 ? 'disabled' : ''}>◀ 이전</button>
        <span>${this.currentIndex + 1} / ${this.problems.length}</span>
        <button onclick="problemViewer.next()" ${this.currentIndex === this.problems.length - 1 ? 'disabled' : ''}>다음 ▶</button>
      </div>

      <!-- 문제 내용 -->
      <div class="problem-content-area">
        <!-- 텍스트 영역 -->
        <div class="problem-text-section">
          <h4>📝 문제 텍스트</h4>
          <div class="editable-content" contenteditable="true">
            ${this.formatText(problem.text)}
          </div>
        </div>

        <!-- 이미지 영역 -->
        ${problem.images?.length ? `
          <div class="problem-images-section">
            <h4>🖼️ 이미지</h4>
            <div class="images-grid">
              ${problem.images.map((img, i) => `
                <div class="image-item">
                  <img src="${img.src}" alt="이미지 ${i+1}">
                  <span class="image-label">${img.label || '이미지 ' + (i+1)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 표 영역 -->
        ${problem.tables?.length ? `
          <div class="problem-tables-section">
            <h4>📊 표</h4>
            ${problem.tables.map(table => this.renderTable(table)).join('')}
          </div>
        ` : ''}
      </div>

      <!-- 액션 버튼 -->
      <div class="problem-actions">
        <button onclick="generateSolutionForProblem(${this.currentIndex})">
          💡 해설/정답 생성
        </button>
        <button onclick="saveProblem(${this.currentIndex})">
          💾 저장
        </button>
      </div>
    `;

    // 수식 렌더링
    this.renderMath();
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.render();
    }
  }

  next() {
    if (this.currentIndex < this.problems.length - 1) {
      this.currentIndex++;
      this.render();
    }
  }
}
```

#### 8.2 새로운 UI 섹션 추가 (index.html)
```html
<!-- 참조 문제 입력/표시 통합 영역 -->
<div id="problemInputDisplayArea" class="problem-display-area" style="display: none;">
  <div class="area-header">
    <h3>📋 문제 입력/표시</h3>
    <div class="area-tabs">
      <button class="tab-btn active" data-tab="input">입력 문제</button>
      <button class="tab-btn" data-tab="generated">생성 문제</button>
      <button class="tab-btn" data-tab="database">DB 문제</button>
    </div>
  </div>

  <!-- 입력 문제 탭 -->
  <div id="inputProblemTab" class="tab-content active">
    <div id="inputProblemViewer"></div>
  </div>

  <!-- 생성 문제 탭 -->
  <div id="generatedProblemTab" class="tab-content">
    <div id="generatedProblemViewer"></div>
  </div>

  <!-- DB 문제 탭 -->
  <div id="databaseProblemTab" class="tab-content">
    <!-- 필터 -->
    <div class="db-filter">
      <select id="dbSubjectFilter">과목 선택</select>
      <select id="dbChapterFilter">단원 선택</select>
      <select id="dbTypeFilter">유형 선택</select>
      <button onclick="loadProblemsFromDB()">🔍 검색</button>
    </div>
    <div id="dbProblemViewer"></div>
  </div>
</div>

<!-- '문제 입력' 버튼 -->
<button id="confirmProblemInputBtn" onclick="confirmProblemInput()" class="btn btn-primary" style="display: none;">
  ✅ 문제 입력
</button>

<!-- '참조 문제 저장' 버튼 -->
<button id="saveReferenceProblemBtn" onclick="saveReferenceProblem()" class="btn btn-success" style="display: none;">
  💾 참조 문제 저장
</button>
```

#### 8.3 OCR 진행 상태 표시
```javascript
class OCRProgressIndicator {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }

  show(message = 'OCR 처리 중...') {
    this.container.innerHTML = `
      <div class="ocr-progress">
        <div class="progress-spinner"></div>
        <span class="progress-message">${message}</span>
        <div class="progress-steps">
          <div class="step" id="step-upload">📤 이미지 업로드</div>
          <div class="step" id="step-detect">🔍 영역 감지</div>
          <div class="step" id="step-ocr">📝 텍스트 추출</div>
          <div class="step" id="step-parse">📊 구조 분석</div>
          <div class="step" id="step-complete">✅ 완료</div>
        </div>
      </div>
    `;
    this.container.style.display = 'block';
  }

  updateStep(stepId) {
    document.querySelectorAll('.progress-steps .step').forEach(s => {
      s.classList.remove('active', 'completed');
    });

    const currentStep = document.getElementById(`step-${stepId}`);
    if (currentStep) {
      currentStep.classList.add('active');
      // 이전 단계들은 완료 표시
      let prev = currentStep.previousElementSibling;
      while (prev) {
        prev.classList.add('completed');
        prev = prev.previousElementSibling;
      }
    }
  }

  hide() {
    this.container.style.display = 'none';
  }
}
```

#### 8.4 DB에서 문제 불러오기
```javascript
async function loadProblemsFromDB() {
  const subject = document.getElementById('dbSubjectFilter').value;
  const chapter = document.getElementById('dbChapterFilter').value;
  const type = document.getElementById('dbTypeFilter').value;

  const response = await fetch('/api/problems/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject, chapter, type })
  });

  const data = await response.json();
  if (data.success) {
    dbProblemViewer.setProblems(data.problems);
  }
}
```

#### 예상 작업량: **큼** (8-10시간)

---

## 10. 문제 정보 입력 필드 재구성

### 요구사항
1. 제목: "문제 정보 입력 (필수)" → "참조 문제 정보 입력"
2. 편집자 출제용에서는 필수 아님
3. 내신/수능/모의고사/논술/심층면접별 다른 필드 구조

### 구현 계획

#### 10.1 시험 종류별 필드 구조

**내신:**
- 문제 출처: 기출문제, 학교 부교재, 참고서(참고서명 입력), 기타(수기 입력)
- 출제 또는 출간 년도
- 과목
- 단원명: 대단원, 중단원, 유형, 유형 번호

**수능/모의고사:**
- 문제 출처: 수능 기출 문제, 평가원 모의고사, 교육청 모의고사, 사설 모의고사(입력), 참고서(입력), 기타(입력)
- 단원명: 대단원, 중단원, 유형, 유형 번호

**논술:**
- 문제 출처: 기출문제(대학명 선택), 대학별 모의고사(대학명 선택), 참고서(입력), 기타(입력)
- 단원명: 수기 입력

**심층면접:**
- 문제 출처: 기출문제(대학명 선택), 대학별 모의고사(대학명 선택), 참고서(입력), 기타(입력)
- 단원명: 수기 입력

#### 10.2 HTML 구조 수정 (index.html)
```html
<div class="collapsible">
  <button onclick="toggleSection('problemMetadataSection')" class="collapsible-btn">
    🏷️ 참조 문제 정보 입력 <span class="optional-badge">(선택)</span>
  </button>
  <div id="problemMetadataSection" class="collapsible-content">

    <!-- 시험 종류 선택 -->
    <div class="form-group">
      <label for="examTypeSelect">시험 종류:</label>
      <select id="examTypeSelect" class="input-field" onchange="updateMetadataFields()">
        <option value="">선택하세요</option>
        <option value="내신">내신</option>
        <option value="수능">수능/모의고사</option>
        <option value="논술">논술</option>
        <option value="심층면접">심층면접</option>
      </select>
    </div>

    <!-- 동적 필드 영역 -->
    <div id="dynamicMetadataFields"></div>
  </div>
</div>
```

#### 10.3 동적 필드 생성 (app.js)
```javascript
function updateMetadataFields() {
  const examType = document.getElementById('examTypeSelect').value;
  const container = document.getElementById('dynamicMetadataFields');

  const templates = {
    '내신': getNaesinTemplate(),
    '수능': getSuneungTemplate(),
    '논술': getNonsulTemplate(),
    '심층면접': getSimcheungTemplate()
  };

  container.innerHTML = templates[examType] || '';

  // 이벤트 리스너 재설정
  setupDynamicFieldListeners();
}

function getNaesinTemplate() {
  return `
    <div class="metadata-grid">
      <!-- 문제 출처 -->
      <div class="form-group">
        <label>문제 출처:</label>
        <select id="problemSourceSelect" onchange="toggleSourceInput()">
          <option value="">선택하세요</option>
          <option value="기출문제">기출문제</option>
          <option value="학교부교재">학교 부교재</option>
          <option value="참고서">참고서</option>
          <option value="기타">기타</option>
        </select>
        <input type="text" id="sourceNameInput" class="input-field" placeholder="참고서명 또는 출처명 입력" style="display: none;">
      </div>

      <!-- 출제/출간 년도 -->
      <div class="form-group">
        <label>출제 또는 출간 년도:</label>
        <input type="number" id="publishYearInput" class="input-field" placeholder="예: 2024">
      </div>

      <!-- 단원명 (자이스토리 기준) -->
      <div class="form-group chapter-group">
        <label>단원명 (자이스토리 기준):</label>
        <div class="chapter-inputs">
          <input type="text" id="majorChapterInput" class="input-field" placeholder="대단원 (예: 1. 다항식)">
          <input type="text" id="middleChapterInput" class="input-field" placeholder="중단원 (예: A. 다항식의 연산)">
          <input type="text" id="typeNameInput" class="input-field" placeholder="유형 (예: 유형 03. 다항식의 전개식...)">
          <input type="text" id="typeNumberInput" class="input-field" placeholder="유형 번호 (예: A07)">
        </div>
      </div>
    </div>
  `;
}

// 비슷하게 수능, 논술, 심층면접 템플릿 정의
```

#### 10.4 대학명 선택 모달
```html
<div id="universitySelectModal" class="modal" style="display: none;">
  <div class="modal-content">
    <h3>🏫 대학 선택</h3>
    <input type="text" id="universitySearch" placeholder="대학명 검색..." onkeyup="filterUniversities()">
    <div id="universityList" class="university-list">
      <!-- 대학 목록 동적 생성 -->
    </div>
  </div>
</div>
```

#### 예상 작업량: **큼** (4-6시간)

---

## 11. 엔진 생성 대화창

### 요구사항
- 일반 LLM 대화창과 동일하게 제작
- 서버에 저장된 엔진 코드 기반으로 문제 출제
- 엔진 코드 저장/수정/삭제

### 구현 계획

#### 11.1 엔진 대화창 UI (index.html)
```html
<section class="card">
  <h2>💬 엔진 기반 문제 생성 대화</h2>

  <!-- 엔진 선택 -->
  <div class="form-group">
    <label>사용할 엔진:</label>
    <select id="chatEngineSelect" onchange="loadEngineContext()">
      <option value="">엔진 선택...</option>
    </select>
    <div id="selectedEnginePreview" class="engine-preview" style="display: none;">
      <h4 id="enginePreviewName"></h4>
      <pre id="enginePreviewCode"></pre>
    </div>
  </div>

  <!-- 대화 영역 -->
  <div id="engineChatArea" class="chat-area">
    <div id="engineChatMessages" class="chat-messages"></div>
    <div class="chat-input-area">
      <textarea id="engineChatInput" placeholder="문제 생성 요청을 입력하세요..." rows="2"></textarea>
      <button onclick="sendEngineChatMessage()" class="btn btn-primary">
        📤 전송
      </button>
    </div>
  </div>

  <!-- 엔진 관리 버튼 -->
  <div class="engine-management-buttons">
    <button onclick="openEngineEditorModal()" class="btn btn-secondary">
      ✏️ 엔진 편집
    </button>
    <button onclick="openNewEngineModal()" class="btn btn-success">
      ➕ 새 엔진
    </button>
  </div>
</section>
```

#### 11.2 대화 기능 (app.js)
```javascript
class EngineChatManager {
  constructor() {
    this.messages = [];
    this.currentEngine = null;
  }

  async loadEngine(engineId) {
    const response = await fetch(`/api/engines/${engineId}`);
    const data = await response.json();
    this.currentEngine = data.engine;
    this.showEnginePreview();
  }

  async sendMessage(userMessage) {
    // 사용자 메시지 추가
    this.addMessage('user', userMessage);

    // AI 응답 생성
    const response = await fetch('/api/engine-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: this.currentEngine.id,
        messages: this.messages,
        newMessage: userMessage
      })
    });

    const data = await response.json();

    // AI 응답 추가
    this.addMessage('assistant', data.response);

    // 생성된 문제가 있으면 별도 표시
    if (data.generatedProblem) {
      this.showGeneratedProblem(data.generatedProblem);
    }
  }

  addMessage(role, content) {
    this.messages.push({ role, content });
    this.renderMessages();
  }

  renderMessages() {
    const container = document.getElementById('engineChatMessages');
    container.innerHTML = this.messages.map(msg => `
      <div class="chat-message ${msg.role}">
        <div class="message-avatar">${msg.role === 'user' ? '👤' : '🤖'}</div>
        <div class="message-content">${this.formatContent(msg.content)}</div>
      </div>
    `).join('');

    // 스크롤 하단으로
    container.scrollTop = container.scrollHeight;
  }
}
```

#### 11.3 Backend API (server.js)
```javascript
// POST /api/engine-chat
app.post('/api/engine-chat', async (req, res) => {
  const { engineId, messages, newMessage } = req.body;

  // 엔진 로드
  const engineDoc = await db.collection('engines').doc(engineId).get();
  const engine = engineDoc.data();

  // 시스템 프롬프트 구성
  const systemPrompt = `
    당신은 수학 문제 출제 전문가입니다.
    다음 엔진 규칙에 따라 문제를 생성해야 합니다:

    === 엔진 규칙 ===
    ${engine.promptRules}

    === Python 검증 코드 (참고용) ===
    ${engine.pythonCode || '없음'}

    사용자의 요청에 따라 문제를 생성하고, 설명하세요.
  `;

  // Gemini API 호출
  const response = await model.generateContent({
    contents: [
      { role: 'user', parts: [{ text: systemPrompt }] },
      ...messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
      { role: 'user', parts: [{ text: newMessage }] }
    ]
  });

  res.json({
    success: true,
    response: response.response.text()
  });
});
```

#### 예상 작업량: **큼** (6-8시간)

---

## 12. 라벨 관리: 키워드 자동 생성

### 요구사항
- 문제 정보 입력 사항을 RAG 항목 또는 라벨로 관리
- 키워드 자동 생성 (RAG화된 교과/용어 범위 내에서)
- 자동 생성된 키워드 수정 기능

### 구현 계획

#### 12.1 키워드 자동 생성 API (server.js)
```javascript
// POST /api/auto-generate-keywords
app.post('/api/auto-generate-keywords', async (req, res) => {
  const { problemText, metadata } = req.body;

  // RAG에서 관련 개념 검색
  const ragResults = await agent.query(`
    다음 문제와 관련된 교과 개념과 용어를 찾아주세요:
    ${problemText}
  `);

  // Gemini로 키워드 추출
  const prompt = `
    다음 수학 문제를 분석하여 관련 키워드를 추출하세요.

    문제: ${problemText}
    과목: ${metadata.subject}
    단원: ${metadata.chapter}

    RAG 참고 자료: ${ragResults.answer}

    다음 형식으로 키워드를 반환하세요:
    {
      "concepts": ["개념1", "개념2", ...],  // 핵심 수학 개념
      "skills": ["기능1", "기능2", ...],    // 필요한 문제 해결 기능
      "formulas": ["공식1", "공식2", ...],   // 관련 공식
      "difficulty": "상/중/하",              // 난이도
      "type": "계산형/증명형/서술형/..."      // 문제 유형
    }
  `;

  const result = await model.generateContent(prompt);
  const keywords = JSON.parse(result.response.text());

  res.json({ success: true, keywords });
});
```

#### 12.2 키워드 편집 UI (index.html)
```html
<div id="keywordEditSection" class="keyword-section">
  <h4>🏷️ 자동 생성 키워드</h4>
  <button onclick="autoGenerateKeywords()" class="btn btn-secondary">
    🤖 키워드 자동 생성
  </button>

  <div id="keywordDisplay" class="keyword-display" style="display: none;">
    <!-- 개념 키워드 -->
    <div class="keyword-group">
      <label>핵심 개념:</label>
      <div id="conceptKeywords" class="keyword-tags"></div>
      <input type="text" id="newConceptInput" placeholder="개념 추가...">
    </div>

    <!-- 기능 키워드 -->
    <div class="keyword-group">
      <label>해결 기능:</label>
      <div id="skillKeywords" class="keyword-tags"></div>
      <input type="text" id="newSkillInput" placeholder="기능 추가...">
    </div>

    <!-- 공식 키워드 -->
    <div class="keyword-group">
      <label>관련 공식:</label>
      <div id="formulaKeywords" class="keyword-tags"></div>
      <input type="text" id="newFormulaInput" placeholder="공식 추가...">
    </div>
  </div>
</div>
```

#### 예상 작업량: **중간** (3-4시간)

---

## 13. RAG 문서 관리: 청크별/적용 결과 확인

### 요구사항
- 각 청크별 내용 확인
- RAG 적용 결과 확인 기능

### 구현 계획

#### 13.1 청크 상세 보기 API (server.js)
```javascript
// GET /api/rag/documents/:documentName/chunks
app.get('/api/rag/documents/:documentName/chunks', async (req, res) => {
  const { documentName } = req.params;

  // Google File Search API에서 청크 정보 조회
  // (실제 API 제공 여부에 따라 구현 방법 달라짐)

  res.json({
    success: true,
    chunks: [
      { id: 1, content: '청크 내용 1...', tokenCount: 150 },
      { id: 2, content: '청크 내용 2...', tokenCount: 200 },
      // ...
    ]
  });
});

// POST /api/rag/test-query
app.post('/api/rag/test-query', async (req, res) => {
  const { query, documentName } = req.body;

  // 특정 문서에 대한 RAG 쿼리 테스트
  const result = await agent.query(query);

  res.json({
    success: true,
    result: {
      answer: result.answer,
      sources: result.sources,
      relevanceScores: result.relevanceScores
    }
  });
});
```

#### 13.2 RAG 상세 보기 UI (index.html)
```html
<div id="ragDetailModal" class="modal" style="display: none;">
  <div class="modal-content modal-large">
    <div class="modal-header">
      <h3>📄 문서 상세 정보</h3>
      <button class="modal-close" onclick="closeRAGDetailModal()">&times;</button>
    </div>
    <div class="modal-body">
      <div class="document-info">
        <h4 id="ragDocName"></h4>
        <p id="ragDocMeta"></p>
      </div>

      <!-- 청크 목록 -->
      <div class="chunks-section">
        <h4>📦 청크 목록</h4>
        <div id="chunksList" class="chunks-list"></div>
      </div>

      <!-- RAG 테스트 -->
      <div class="rag-test-section">
        <h4>🔍 RAG 쿼리 테스트</h4>
        <input type="text" id="ragTestQuery" placeholder="테스트 질문 입력...">
        <button onclick="testRAGQuery()">테스트</button>
        <div id="ragTestResult" class="rag-test-result"></div>
      </div>
    </div>
  </div>
</div>
```

#### 예상 작업량: **중간** (3-4시간)

---

## 14. 문제 검수/승인 대시보드 검토

### 현재 상태
- 기본 대시보드 구현됨 (lines 969-1030)
- 통계, 필터, 일괄 승인/거절 기능 있음

### 확인 필요 사항
1. 현재 기능이 정상 작동하는지 테스트
2. 추가 필요한 기능 파악

### 확인 항목
```
- [ ] 대기 문제 목록 로드
- [ ] 개별 승인/거절
- [ ] 일괄 승인/거절
- [ ] 상태별 필터링
- [ ] 문제 상세 보기
- [ ] RAG 인덱싱 상태 표시
```

#### 예상 작업량: **작음** (1-2시간, 테스트 및 버그 수정)

---

## 15. 편집자용 불필요 섹션 검토

### 요구사항
- 저장된 학습 기록: 편집자용에 필요한지 검토
- 질의와 응답: 편집자용에 필요한지 검토

### 분석

**저장된 학습 기록 (lines 859-870):**
- 목적: 사용자가 학습한 문제 기록
- 편집자용: 문제 출제에는 불필요, 숨김 처리 권장

**질의와 응답 (lines 872-894):**
- 목적: 범용 RAG 질의응답
- 편집자용: 엔진 대화창으로 대체 가능, 숨김 또는 재배치 권장

### 구현 계획
```javascript
// 편집자 모드 여부에 따라 섹션 표시/숨김
function setEditorMode(isEditor) {
  const editorOnlyElements = document.querySelectorAll('.editor-only');
  const userOnlyElements = document.querySelectorAll('.user-only');

  editorOnlyElements.forEach(el => el.style.display = isEditor ? 'block' : 'none');
  userOnlyElements.forEach(el => el.style.display = isEditor ? 'none' : 'block');
}
```

---

## 구현 우선순위 및 일정 제안

### Phase 1: 빠른 작업 (1-2일)
1. ✅ 중등 수학 추가
2. ✅ 스토어 이름 수정
3. ✅ AI 모델 최신화
4. ✅ Ctrl+V 붙여넣기
5. ✅ 편집자용 불필요 섹션 숨김

### Phase 2: 핵심 기능 (3-5일)
6. 문제 정보 입력 필드 재구성
7. OCR 결과 분리 표시 UI
8. 문제/그림 영역 설정

### Phase 3: 고급 기능 (5-7일)
9. 엔진 생성 대화창
10. 파일 업로드 RAG 통합
11. 키워드 자동 생성

### Phase 4: 마무리 (2-3일)
12. RAG 청크별 확인
13. 문서 관리 통합
14. 검수 대시보드 검토

---

## 총 예상 작업량

| 항목 | 예상 시간 |
|-----|----------|
| Phase 1 | 6-10시간 |
| Phase 2 | 16-22시간 |
| Phase 3 | 13-18시간 |
| Phase 4 | 5-9시간 |
| **총계** | **40-59시간** |

---

## 기술 스택

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** Node.js, Express.js
- **Database:** Firebase Firestore
- **AI/ML:** Google Gemini API, OpenAI API
- **RAG:** Google File Search API
- **Libraries:** KaTeX, Plotly, Chart.js, Mermaid, JSXGraph
