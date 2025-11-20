// ==================== 전역 변수 ====================
let currentStore = null;
let metadataCounter = 0;
let subjectsData = null;
let selectedSubject = null;
let selectedCourse = null;
let selectedPublisher = null;
let selectedChapter = null;

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', () => {
  checkServerHealth();
  setupEventListeners();
  loadSubjectsData();
});

// ==================== 이벤트 리스너 설정 ====================
function setupEventListeners() {
  // 스토어 타입 라디오 버튼
  document.querySelectorAll('input[name="storeType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const newStoreForm = document.getElementById('newStoreForm');
      const existingStoreForm = document.getElementById('existingStoreForm');

      if (e.target.value === 'new') {
        newStoreForm.style.display = 'block';
        existingStoreForm.style.display = 'none';
      } else {
        newStoreForm.style.display = 'none';
        existingStoreForm.style.display = 'block';
        // 기존 스토어 선택 시 자동으로 스토어 목록 불러오기
        loadStoresForDropdown();
      }
    });
  });

  // 업로드 타입 라디오 버튼
  document.querySelectorAll('input[name="uploadType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const metadataSection = document.getElementById('metadataSection');

      if (e.target.value === 'import') {
        metadataSection.style.display = 'block';
      } else {
        metadataSection.style.display = 'none';
      }
    });
  });

  // 청킹 활성화 체크박스
  document.getElementById('enableChunking').addEventListener('change', (e) => {
    const chunkingOptions = document.getElementById('chunkingOptions');
    chunkingOptions.style.display = e.target.checked ? 'block' : 'none';
  });

  // Enter 키로 질문하기
  document.getElementById('questionInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      askQuestion();
    }
  });
}

// ==================== 서버 상태 확인 ====================
async function checkServerHealth() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();

    const statusBadge = document.getElementById('serverStatus');

    if (data.status === 'ok') {
      statusBadge.textContent = data.apiKeyConfigured
        ? '✅ 서버 연결됨'
        : '⚠️ API 키 미설정';
      statusBadge.className = 'status-badge ' + (data.apiKeyConfigured ? 'online' : 'offline');

      if (data.currentStore) {
        currentStore = data.currentStore;
        showCurrentStore(data.currentStore);
        // 서버에 이미 활성 스토어가 있으면 문서 목록 자동 로드
        loadDocuments();
      }
    } else {
      statusBadge.textContent = '❌ 서버 오류';
      statusBadge.className = 'status-badge offline';
    }
  } catch (error) {
    const statusBadge = document.getElementById('serverStatus');
    statusBadge.textContent = '❌ 서버 연결 실패';
    statusBadge.className = 'status-badge offline';
    console.error('서버 연결 오류:', error);
  }
}

// ==================== 과목 선택 시스템 ====================

/**
 * 과목 데이터 로드
 */
async function loadSubjectsData() {
  try {
    const response = await fetch('/subjects.json');
    const data = await response.json();
    subjectsData = data.subjects;

    // 교과 드롭다운 초기화
    const subjectSelect = document.getElementById('subjectSelect');
    subjectSelect.innerHTML = '<option value="">교과를 선택하세요</option>';

    subjectsData.forEach((subject, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = subject.subject;
      subjectSelect.appendChild(option);
    });

    console.log('✅ 과목 데이터 로드 완료:', subjectsData.length, '개 교과');
  } catch (error) {
    console.error('❌ 과목 데이터 로드 실패:', error);
    showAlert('과목 데이터를 불러오는데 실패했습니다.', 'error');
  }
}

/**
 * 교과 선택 변경 이벤트
 */
function onSubjectChange() {
  const subjectSelect = document.getElementById('subjectSelect');
  const courseSelect = document.getElementById('courseSelect');
  const selectedCourseInfo = document.getElementById('selectedCourseInfo');

  const selectedIndex = subjectSelect.value;

  if (!selectedIndex) {
    // 교과 선택 해제
    courseSelect.disabled = true;
    courseSelect.innerHTML = '<option value="">먼저 교과를 선택하세요</option>';
    selectedCourseInfo.style.display = 'none';
    selectedSubject = null;
    selectedCourse = null;
    return;
  }

  // 선택된 교과 저장
  selectedSubject = subjectsData[selectedIndex];

  // 과목 드롭다운 직접 업데이트
  courseSelect.innerHTML = '<option value="">과목을 선택하세요</option>';
  selectedSubject.courses.forEach((course, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = course.name;
    courseSelect.appendChild(option);
  });

  courseSelect.disabled = false;
  selectedCourseInfo.style.display = 'none';
  selectedCourse = null;

  console.log('✅ 교과 선택:', selectedSubject.subject, '(과목 수:', selectedSubject.courses.length + ')');
}

/**
 * 과목 선택 변경 이벤트
 */
function onCourseChange() {
  const courseSelect = document.getElementById('courseSelect');
  const publisherSelect = document.getElementById('publisherSelect');
  const chapterSelect = document.getElementById('chapterSelect');
  const selectedIndex = courseSelect.value;

  if (!selectedIndex || !selectedSubject) {
    document.getElementById('selectedCourseInfo').style.display = 'none';
    selectedCourse = null;
    selectedPublisher = null;
    selectedChapter = null;
    publisherSelect.disabled = true;
    chapterSelect.disabled = true;
    publisherSelect.innerHTML = '<option value="">먼저 과목을 선택하세요</option>';
    chapterSelect.innerHTML = '<option value="">먼저 출판사를 선택하세요</option>';
    return;
  }

  // 선택된 과목 저장
  selectedCourse = selectedSubject.courses[selectedIndex];

  // 선택한 과목 정보 표시
  document.getElementById('selectedSubject').textContent = selectedSubject.subject;
  document.getElementById('selectedCourse').textContent = selectedCourse.name;
  document.getElementById('selectedCourseInfo').style.display = 'block';

  // 출판사 드롭다운 업데이트
  publisherSelect.innerHTML = '<option value="">출판사를 선택하세요</option>';

  if (selectedCourse.publishers && selectedCourse.publishers.length > 0) {
    selectedCourse.publishers.forEach((publisher, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = publisher.name;
      publisherSelect.appendChild(option);
    });
    publisherSelect.disabled = false;
  } else {
    publisherSelect.innerHTML = '<option value="">이 과목은 출판사 정보가 없습니다</option>';
    publisherSelect.disabled = true;
  }

  // 단원 드롭다운 초기화
  chapterSelect.disabled = true;
  chapterSelect.innerHTML = '<option value="">먼저 출판사를 선택하세요</option>';
  selectedPublisher = null;
  selectedChapter = null;

  console.log('✅ 과목 선택:', selectedCourse, '(출판사 수:', selectedCourse.publishers?.length || 0 + ')');
}

/**
 * 출판사 선택 변경 이벤트
 */
function onPublisherChange() {
  const publisherSelect = document.getElementById('publisherSelect');
  const chapterSelect = document.getElementById('chapterSelect');
  const selectedIndex = publisherSelect.value;

  if (!selectedIndex || !selectedCourse) {
    chapterSelect.disabled = true;
    chapterSelect.innerHTML = '<option value="">먼저 출판사를 선택하세요</option>';
    selectedPublisher = null;
    selectedChapter = null;
    return;
  }

  // 선택된 출판사 저장
  selectedPublisher = selectedCourse.publishers[selectedIndex];

  // 단원 드롭다운 업데이트
  chapterSelect.innerHTML = '<option value="">단원을 선택하세요</option>';

  if (selectedPublisher.chapters && selectedPublisher.chapters.length > 0) {
    selectedPublisher.chapters.forEach((chapter, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${chapter.id}. ${chapter.name}`;
      chapterSelect.appendChild(option);
    });
    chapterSelect.disabled = false;
  } else {
    chapterSelect.innerHTML = '<option value="">이 출판사는 단원 정보가 없습니다</option>';
    chapterSelect.disabled = true;
  }

  selectedChapter = null;

  console.log('✅ 출판사 선택:', selectedPublisher.name, '(단원 수:', selectedPublisher.chapters?.length || 0 + ')');
}

/**
 * 단원 선택 변경 이벤트
 */
function onChapterChange() {
  const chapterSelect = document.getElementById('chapterSelect');
  const selectedIndex = chapterSelect.value;

  if (!selectedIndex || !selectedPublisher) {
    selectedChapter = null;
    return;
  }

  // 선택된 단원 저장
  selectedChapter = selectedPublisher.chapters[selectedIndex];

  console.log('✅ 단원 선택:', selectedChapter.name);
}

// ==================== 스토어 관리 ====================
async function initializeStore() {
  const displayName = document.getElementById('storeDisplayName').value.trim();

  if (!displayName) {
    showAlert('스토어 이름을 입력하세요.', 'error');
    return;
  }

  try {
    showProgress('스토어 생성 중...');

    const response = await fetch('/api/store/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName })
    });

    const data = await response.json();

    hideProgress();

    if (data.success) {
      currentStore = data.storeName;
      await showCurrentStoreWithDetails(data.storeName);
      showAlert(`✅ ${data.message}`, 'success');
      document.getElementById('storeDisplayName').value = '';

      // 스토어 생성 후 문서 목록 자동 로드
      loadDocuments();
    } else {
      showAlert(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    hideProgress();
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

/**
 * 드롭다운에 표시할 스토어 목록 불러오기
 */
async function loadStoresForDropdown() {
  const selectElement = document.getElementById('existingStoreSelect');

  try {
    selectElement.innerHTML = '<option value="">불러오는 중...</option>';
    selectElement.disabled = true;

    const response = await fetch('/api/stores');
    const data = await response.json();

    if (data.success && data.stores && data.stores.length > 0) {
      selectElement.innerHTML = '<option value="">-- 스토어를 선택하세요 --</option>';

      data.stores.forEach(store => {
        const option = document.createElement('option');
        option.value = store.name;

        // 표시 이름: 스토어 이름 + 문서 개수
        const displayName = store.displayName || store.name.split('/').pop();
        const docCount = store.documentCount !== undefined ? ` (${store.documentCount}개 문서)` : '';
        option.textContent = `${displayName}${docCount}`;

        selectElement.appendChild(option);
      });

      selectElement.disabled = false;
    } else {
      selectElement.innerHTML = '<option value="">사용 가능한 스토어가 없습니다</option>';
      showAlert('생성된 스토어가 없습니다. 먼저 새 스토어를 생성하세요.', 'info');
    }
  } catch (error) {
    selectElement.innerHTML = '<option value="">불러오기 실패</option>';
    showAlert(`❌ 스토어 목록 불러오기 실패: ${error.message}`, 'error');
    console.error('스토어 목록 불러오기 오류:', error);
  }
}

async function useExistingStore() {
  const storeName = document.getElementById('existingStoreSelect').value;

  if (!storeName) {
    showAlert('스토어를 선택하세요.', 'error');
    return;
  }

  try {
    showProgress('스토어 연결 중...');

    const response = await fetch('/api/store/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeName })
    });

    const data = await response.json();

    hideProgress();

    if (data.success) {
      currentStore = data.storeName;
      await showCurrentStoreWithDetails(data.storeName);
      showAlert(`✅ ${data.message}`, 'success');

      // 기존 스토어 선택 후 문서 목록 자동 로드
      loadDocuments();
    } else {
      showAlert(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    hideProgress();
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

function showCurrentStore(storeName) {
  const infoBox = document.getElementById('currentStoreInfo');
  const storeNameElem = document.getElementById('currentStoreName');
  const storeDetails = document.getElementById('currentStoreDetails');

  storeNameElem.textContent = storeName;
  storeDetails.textContent = '문서 개수 확인 중...';
  infoBox.style.display = 'block';
}

/**
 * 현재 스토어 정보를 상세하게 표시
 */
async function showCurrentStoreWithDetails(storeName) {
  const infoBox = document.getElementById('currentStoreInfo');
  const storeNameElem = document.getElementById('currentStoreName');
  const storeDetails = document.getElementById('currentStoreDetails');

  storeNameElem.textContent = storeName;
  storeDetails.textContent = '문서 개수 확인 중...';
  infoBox.style.display = 'block';

  try {
    const response = await fetch('/api/store/status');
    const data = await response.json();

    if (data.success && data.status) {
      const docCount = data.status.documentCount || 0;
      storeDetails.textContent = `📄 ${docCount}개의 문서 보유`;
    } else {
      storeDetails.textContent = '상태 정보를 가져올 수 없습니다';
    }
  } catch (error) {
    storeDetails.textContent = '상태 정보 불러오기 실패';
    console.error('스토어 상태 조회 오류:', error);
  }
}

// loadStoreStatus, loadAllStores, displayStoresList 함수들은
// 새로운 드롭다운 UI로 대체되어 제거됨

async function useStoreById(storeName) {
  try {
    const response = await fetch('/api/store/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeName })
    });

    const data = await response.json();

    if (data.success) {
      currentStore = data.storeName;
      showCurrentStore(data.storeName);
      showAlert(`✅ 스토어 전환 완료`, 'success');
    } else {
      showAlert(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

async function deleteStore(storeName) {
  if (!confirm(`정말로 이 스토어를 삭제하시겠습니까?\n${storeName}`)) {
    return;
  }

  try {
    const response = await fetch(`/api/store/${encodeURIComponent(storeName)}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      showAlert(`✅ 스토어 삭제 완료`, 'success');

      // "기존 스토어 사용" 탭이 활성화되어 있다면 목록 새로고침
      const existingStoreRadio = document.querySelector('input[name="storeType"][value="existing"]');
      if (existingStoreRadio && existingStoreRadio.checked) {
        loadStoresForDropdown();
      }

      // 현재 스토어가 삭제된 경우
      if (storeName === currentStore) {
        currentStore = null;
        document.getElementById('currentStoreInfo').style.display = 'none';
      }
    } else {
      showAlert(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

// ==================== 파일 업로드 ====================
async function uploadFile() {
  if (!currentStore) {
    showAlert('먼저 스토어를 초기화하세요.', 'error');
    return;
  }

  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  if (!file) {
    showAlert('파일을 선택하세요.', 'error');
    return;
  }

  const uploadType = document.querySelector('input[name="uploadType"]:checked').value;
  const formData = new FormData();
  formData.append('file', file);

  // 표시 이름
  const displayName = document.getElementById('fileDisplayName').value.trim();
  if (displayName) {
    formData.append('displayName', displayName);
  }

  // 청킹 설정
  if (document.getElementById('enableChunking').checked) {
    const chunkingConfig = {
      whiteSpaceConfig: {
        maxTokensPerChunk: parseInt(document.getElementById('maxTokensPerChunk').value),
        maxOverlapTokens: parseInt(document.getElementById('maxOverlapTokens').value)
      }
    };
    formData.append('chunkingConfig', JSON.stringify(chunkingConfig));
  }

  // 메타데이터 (Files API Import만)
  if (uploadType === 'import') {
    const metadata = collectMetadata();
    if (metadata.length > 0) {
      formData.append('customMetadata', JSON.stringify(metadata));
    }
  }

  const endpoint = uploadType === 'direct' ? '/api/upload' : '/api/upload-import';

  try {
    showProgress(`파일 업로드 중... (${uploadType === 'direct' ? '직접' : 'Import'} 방식)`);

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    hideProgress();

    if (data.success) {
      showAlert(`✅ 파일 업로드 완료: ${data.result.fileName}`, 'success');

      // 폼 초기화
      fileInput.value = '';
      document.getElementById('fileDisplayName').value = '';

      // 문서 목록 새로고침
      loadDocuments();
    } else {
      showAlert(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    hideProgress();
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

// ==================== 메타데이터 관리 ====================
function addMetadataField() {
  const container = document.getElementById('metadataList');
  const id = metadataCounter++;

  const fieldHtml = `
    <div class="metadata-field" id="metadata-${id}">
      <input type="text" placeholder="키 (예: author)" data-field="key">
      <select data-field="valueType">
        <option value="string">문자열</option>
        <option value="number">숫자</option>
      </select>
      <input type="text" placeholder="값" data-field="value">
      <button onclick="removeMetadataField(${id})">삭제</button>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', fieldHtml);
}

function removeMetadataField(id) {
  const field = document.getElementById(`metadata-${id}`);
  if (field) {
    field.remove();
  }
}

function collectMetadata() {
  const fields = document.querySelectorAll('.metadata-field');
  const metadata = [];

  fields.forEach(field => {
    const key = field.querySelector('[data-field="key"]').value.trim();
    const valueType = field.querySelector('[data-field="valueType"]').value;
    const value = field.querySelector('[data-field="value"]').value.trim();

    if (key && value) {
      const item = { key };

      if (valueType === 'number') {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          item.numericValue = numValue;
        }
      } else {
        item.stringValue = value;
      }

      metadata.push(item);
    }
  });

  return metadata;
}

// ==================== 질의응답 ====================
async function askQuestion() {
  if (!currentStore) {
    showAlert('먼저 스토어를 초기화하세요.', 'error');
    return;
  }

  const query = document.getElementById('questionInput').value.trim();

  if (!query) {
    showAlert('질문을 입력하세요.', 'error');
    return;
  }

  try {
    showProgress('답변 생성 중...');

    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const data = await response.json();

    hideProgress();

    if (data.success) {
      const answerBox = document.getElementById('answerBox');
      const answerContent = document.getElementById('answerContent');

      answerContent.innerHTML = formatAnswer(data.answer);
      answerBox.style.display = 'block';

      // 모든 그래프 렌더링 (비동기)
      renderAllGraphs(answerContent).then(() => {
        console.log('모든 그래프 렌더링 완료');
      }).catch(err => {
        console.error('그래프 렌더링 오류:', err);
      });

      // KaTeX로 수학 수식 렌더링
      if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(answerContent, {
          delimiters: [
            {left: '$$', right: '$$', display: true},   // 블록 수식
            {left: '$', right: '$', display: false},    // 인라인 수식
            {left: '\\[', right: '\\]', display: true}, // 대체 블록 구문
            {left: '\\(', right: '\\)', display: false} // 대체 인라인 구문
          ],
          throwOnError: false,  // 에러 발생 시 원본 텍스트 유지
          trust: true,  // \color, \colorbox 등 색상 명령 허용
          strict: false  // 엄격 모드 해제 (더 많은 LaTeX 명령 허용)
        });

        // 수식에 확대/축소 기능 추가
        addFormulaZoomFeature(answerContent);
      }
    } else {
      showAlert(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    hideProgress();
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

// ==================== 문제/풀이 시스템 ====================

// 현재 문제 저장
let currentProblem = null;

/**
 * 문제 요청 함수
 */
async function requestProblem() {
  if (!currentStore) {
    showAlert('먼저 스토어를 초기화하세요.', 'error');
    return;
  }

  // 필수 선택사항 확인
  if (!selectedCourse) {
    showAlert('과목을 선택하세요.', 'error');
    return;
  }

  if (!selectedPublisher) {
    showAlert('출판사를 선택하세요.', 'error');
    return;
  }

  if (!selectedChapter) {
    showAlert('단원을 선택하세요.', 'error');
    return;
  }

  const problemRequest = document.getElementById('problemRequestInput').value.trim();
  const problemTypeElement = document.querySelector('input[name="problemType"]:checked');
  const problemType = problemTypeElement ? problemTypeElement.value : 'multiple';
  const questionCount = document.getElementById('questionCountSelect').value;

  try {
    showProgress('문제 생성 중...');

    // 과목, 출판사, 단원, 문항 수 정보를 포함한 프롬프트 생성
    const subjectInfo = `교과: ${selectedSubject.subject}, 과목: ${selectedCourse.name}, 출판사: ${selectedPublisher.name}, 단원: ${selectedChapter.name}`;

    // 문제 유형에 따라 프롬프트 조정
    const typeInstruction = problemType === 'multiple'
      ? `객관식 문제로 ${questionCount}문항을 출제하고, 각 문제마다 4개의 보기를 제시하세요. 정답은 절대 표시하지 마세요.`
      : `주관식 문제로 ${questionCount}문항을 출제하세요. 정답이나 풀이는 절대 포함하지 마세요.`;

    const additionalRequest = problemRequest ? `\n\n추가 요청사항: ${problemRequest}` : '';

    const query = `${subjectInfo}\n\n조건: ${typeInstruction}${additionalRequest}\n\n문제만 출제하고, 풀이나 정답은 절대 포함하지 마세요. "문제:" 라는 제목으로 시작하세요.`;

    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const data = await response.json();

    hideProgress();

    if (data.success) {
      // 문제 저장
      currentProblem = {
        subject: selectedSubject.subject,
        course: selectedCourse.name,
        publisher: selectedPublisher.name,
        chapter: selectedChapter.name,
        questionCount: questionCount,
        request: problemRequest,
        type: problemType,
        content: data.answer
      };

      // 문제 표시
      displayProblem(data.answer, problemType);

      // 풀이 요청 버튼 활성화
      document.getElementById('requestSolutionBtn').style.display = 'block';
      document.getElementById('noSolution').style.display = 'block';
      document.getElementById('solutionBox').style.display = 'none';

      showAlert('✅ 문제가 출제되었습니다!', 'success');
    } else {
      showAlert(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    hideProgress();
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

/**
 * 문제 표시 함수
 */
function displayProblem(problemContent, problemType) {
  const problemBox = document.getElementById('problemBox');
  const problemTypeElement = document.getElementById('problemType');
  const problemContentElement = document.getElementById('problemContent');
  const noProblem = document.getElementById('noProblem');

  // 문제 유형 배지 업데이트
  problemTypeElement.textContent = problemType === 'multiple' ? '객관식' : '주관식';
  problemTypeElement.className = 'problem-type-badge ' + (problemType === 'multiple' ? 'type-multiple' : 'type-subjective');

  // 문제 내용 표시
  problemContentElement.innerHTML = formatAnswer(problemContent);

  // 문제 박스 표시
  problemBox.style.display = 'block';
  noProblem.style.display = 'none';

  // 모든 그래프 렌더링
  renderAllGraphs(problemContentElement).then(() => {
    console.log('문제 내 그래프 렌더링 완료');
  }).catch(err => {
    console.error('문제 그래프 렌더링 오류:', err);
  });

  // KaTeX로 수학 수식 렌더링
  if (typeof renderMathInElement !== 'undefined') {
    renderMathInElement(problemContentElement, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\[', right: '\\]', display: true},
        {left: '\\(', right: '\\)', display: false}
      ],
      throwOnError: false,
      trust: true,
      strict: false
    });

    // 수식에 확대/축소 기능 추가
    addFormulaZoomFeature(problemContentElement);
  }
}

/**
 * 풀이 요청 함수
 */
async function requestSolution() {
  if (!currentProblem) {
    showAlert('먼저 문제를 요청하세요.', 'error');
    return;
  }

  if (!currentStore) {
    showAlert('먼저 스토어를 초기화하세요.', 'error');
    return;
  }

  try {
    showProgress('풀이 생성 중...');

    const query = `다음 문제의 풀이와 정답을 자세히 설명해주세요:\n\n${currentProblem.content}\n\n풀이 과정을 단계별로 설명하고, 최종 정답을 명확히 제시하세요.`;

    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const data = await response.json();

    hideProgress();

    if (data.success) {
      const solutionBox = document.getElementById('solutionBox');
      const solutionContent = document.getElementById('solutionContent');
      const noSolution = document.getElementById('noSolution');

      solutionContent.innerHTML = formatAnswer(data.answer);
      solutionBox.style.display = 'block';
      noSolution.style.display = 'none';

      // 모든 그래프 렌더링
      renderAllGraphs(solutionContent).then(() => {
        console.log('풀이 내 그래프 렌더링 완료');
      }).catch(err => {
        console.error('풀이 그래프 렌더링 오류:', err);
      });

      // KaTeX로 수학 수식 렌더링
      if (typeof renderMathInElement !== 'undefined') {
        renderMathInElement(solutionContent, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\[', right: '\\]', display: true},
            {left: '\\(', right: '\\)', display: false}
          ],
          throwOnError: false,
          trust: true,
          strict: false
        });

        // 수식에 확대/축소 기능 추가
        addFormulaZoomFeature(solutionContent);
      }

      showAlert('✅ 풀이가 생성되었습니다!', 'success');
    } else {
      showAlert(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    hideProgress();
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

function formatAnswer(answer) {
  // 1. 그래프 코드 블록을 임시 플레이스홀더로 교체 (이스케이프 보호)
  let processed = answer;
  const graphPlaceholders = [];

  // Mermaid 다이어그램 (```mermaid ... ```)
  processed = processed.replace(/```mermaid\n([\s\S]*?)```/g, (match, code) => {
    const placeholder = `___MERMAID_${graphPlaceholders.length}___`;
    graphPlaceholders.push({
      type: 'mermaid',
      content: `<div class="mermaid-diagram">${code.trim()}</div>`
    });
    return placeholder;
  });

  // Plotly 그래프 (```plotly ... ```)
  processed = processed.replace(/```plotly\n([\s\S]*?)```/g, (match, code) => {
    const placeholder = `___PLOTLY_${graphPlaceholders.length}___`;
    graphPlaceholders.push({
      type: 'plotly',
      content: `<div class="plotly-graph-data" style="display:none;">${code.trim()}</div>`
    });
    return placeholder;
  });

  // Chart.js 그래프 (```chartjs ... ```)
  processed = processed.replace(/```chartjs\n([\s\S]*?)```/g, (match, code) => {
    const placeholder = `___CHARTJS_${graphPlaceholders.length}___`;
    graphPlaceholders.push({
      type: 'chartjs',
      content: `<div class="chartjs-graph-data" style="display:none;">${code.trim()}</div>`
    });
    return placeholder;
  });

  // JSXGraph 인터랙티브 기하학 (```jsxgraph ... ```)
  processed = processed.replace(/```jsxgraph\n([\s\S]*?)```/g, (match, code) => {
    const placeholder = `___JSXGRAPH_${graphPlaceholders.length}___`;
    graphPlaceholders.push({
      type: 'jsxgraph',
      content: `<div class="jsxgraph-data" style="display:none;">${code.trim()}</div>`
    });
    return placeholder;
  });

  // 🧪 Chemistry: 3Dmol.js 분자 구조 (```mol3d ... ```)
  processed = processed.replace(/```mol3d\n([\s\S]*?)```/g, (match, code) => {
    const placeholder = `___MOL3D_${graphPlaceholders.length}___`;
    graphPlaceholders.push({
      type: 'mol3d',
      content: `<div class="mol3d-data" style="display:none;">${code.trim()}</div>`
    });
    return placeholder;
  });

  // ⚛️ Physics: Matter.js 물리 시뮬레이션 (```matter ... ```)
  processed = processed.replace(/```matter\n([\s\S]*?)```/g, (match, code) => {
    const placeholder = `___MATTER_${graphPlaceholders.length}___`;
    graphPlaceholders.push({
      type: 'matter',
      content: `<div class="matter-data" style="display:none;">${code.trim()}</div>`
    });
    return placeholder;
  });

  // ⚛️ Physics: p5.js 스케치 (```p5 ... ```)
  processed = processed.replace(/```p5\n([\s\S]*?)```/g, (match, code) => {
    const placeholder = `___P5_${graphPlaceholders.length}___`;
    graphPlaceholders.push({
      type: 'p5',
      content: `<div class="p5-data" style="display:none;">${code.trim()}</div>`
    });
    return placeholder;
  });

  // 🧬 Biology: Cytoscape.js 네트워크 (```cytoscape ... ```)
  processed = processed.replace(/```cytoscape\n([\s\S]*?)```/g, (match, code) => {
    const placeholder = `___CYTOSCAPE_${graphPlaceholders.length}___`;
    graphPlaceholders.push({
      type: 'cytoscape',
      content: `<div class="cytoscape-data" style="display:none;">${code.trim()}</div>`
    });
    return placeholder;
  });

  // 🌍 Earth Science: Leaflet 지도 (```leaflet ... ```)
  processed = processed.replace(/```leaflet\n([\s\S]*?)```/g, (match, code) => {
    const placeholder = `___LEAFLET_${graphPlaceholders.length}___`;
    graphPlaceholders.push({
      type: 'leaflet',
      content: `<div class="leaflet-data" style="display:none;">${code.trim()}</div>`
    });
    return placeholder;
  });

  // 🌍 Earth Science: Cesium 3D 지구본 (```cesium ... ```)
  processed = processed.replace(/```cesium\n([\s\S]*?)```/g, (match, code) => {
    const placeholder = `___CESIUM_${graphPlaceholders.length}___`;
    graphPlaceholders.push({
      type: 'cesium',
      content: `<div class="cesium-data" style="display:none;">${code.trim()}</div>`
    });
    return placeholder;
  });

  // 🔬 General Science: Three.js 3D 시각화 (```threejs ... ```)
  processed = processed.replace(/```threejs\n([\s\S]*?)```/g, (match, code) => {
    const placeholder = `___THREEJS_${graphPlaceholders.length}___`;
    graphPlaceholders.push({
      type: 'threejs',
      content: `<div class="threejs-data" style="display:none;">${code.trim()}</div>`
    });
    return placeholder;
  });

  // 2. HTML 이스케이프 처리 (XSS 방지)
  const escaped = processed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // 3. 줄바꿈을 <br>로 변환
  let withBreaks = escaped.replace(/\n/g, '<br>');

  // 4. 플레이스홀더를 실제 그래프 HTML로 복원
  graphPlaceholders.forEach((item, index) => {
    const placeholderMap = {
      'mermaid': `___MERMAID_${index}___`,
      'plotly': `___PLOTLY_${index}___`,
      'chartjs': `___CHARTJS_${index}___`,
      'jsxgraph': `___JSXGRAPH_${index}___`,
      'mol3d': `___MOL3D_${index}___`,
      'matter': `___MATTER_${index}___`,
      'p5': `___P5_${index}___`,
      'cytoscape': `___CYTOSCAPE_${index}___`,
      'leaflet': `___LEAFLET_${index}___`,
      'cesium': `___CESIUM_${index}___`,
      'threejs': `___THREEJS_${index}___`
    };
    const placeholder = placeholderMap[item.type] || `___UNKNOWN_${index}___`;
    withBreaks = withBreaks.replace(placeholder, item.content);
  });

  return withBreaks;
}

// ==================== 문서 관리 ====================
async function loadDocuments() {
  if (!currentStore) {
    showAlert('먼저 스토어를 초기화하세요.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/documents');
    const data = await response.json();

    if (data.success) {
      displayDocumentsList(data.documents);
    } else {
      showAlert(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

function displayDocumentsList(documents) {
  const container = document.getElementById('documentsList');

  if (documents.length === 0) {
    container.innerHTML = '<p>업로드된 문서가 없습니다.</p>';
    return;
  }

  const html = documents.map(doc => `
    <div class="document-item">
      <div class="document-info">
        <div class="document-name">${doc.displayName || doc.name}</div>
        <div class="document-meta">
          ID: ${doc.name}<br>
          생성일: ${new Date(doc.createTime).toLocaleString('ko-KR')}
        </div>
      </div>
      <div class="document-actions">
        <button onclick="deleteDocument('${doc.name}')" class="btn btn-danger">
          삭제
        </button>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

async function deleteDocument(documentName) {
  if (!confirm('정말로 이 문서를 삭제하시겠습니까?')) {
    return;
  }

  try {
    const response = await fetch(`/api/document/${encodeURIComponent(documentName)}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      showAlert('✅ 문서 삭제 완료', 'success');
      loadDocuments(); // 목록 새로고침
    } else {
      showAlert(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

// ==================== UI 헬퍼 함수 ====================
function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  section.classList.toggle('active');
}

function showProgress(message) {
  const progressBox = document.getElementById('uploadProgress');
  progressBox.innerHTML = `<div class="spinner"></div> ${message}`;
  progressBox.style.display = 'block';
}

function hideProgress() {
  const progressBox = document.getElementById('uploadProgress');
  progressBox.style.display = 'none';
}

function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;

  const container = document.querySelector('.container');
  container.insertBefore(alertDiv, container.firstChild);

  // 5초 후 자동 제거
  setTimeout(() => {
    alertDiv.remove();
  }, 5000);
}

// ==================== 수식 확대/축소 기능 ====================
function addFormulaZoomFeature(container) {
  // 모든 블록 수식에 확대 기능 추가
  const displayMaths = container.querySelectorAll('.katex-display');

  displayMaths.forEach((mathElement, index) => {
    // 이미 처리된 요소는 건너뛰기
    if (mathElement.dataset.zoomEnabled) return;

    mathElement.dataset.zoomEnabled = 'true';
    mathElement.style.cursor = 'zoom-in';
    mathElement.title = '클릭하여 확대';

    // 복사 버튼 추가
    const copyBtn = document.createElement('button');
    copyBtn.className = 'formula-copy-btn';
    copyBtn.innerHTML = '📋 복사';
    copyBtn.title = 'LaTeX 코드 복사';
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      copyFormulaToClipboard(mathElement);
    };

    // 확대 버튼 추가
    const zoomBtn = document.createElement('button');
    zoomBtn.className = 'formula-zoom-btn';
    zoomBtn.innerHTML = '🔍 확대';
    zoomBtn.title = '수식 확대';
    zoomBtn.onclick = (e) => {
      e.stopPropagation();
      zoomFormula(mathElement);
    };

    // 버튼 컨테이너 생성
    const btnContainer = document.createElement('div');
    btnContainer.className = 'formula-controls';
    btnContainer.appendChild(copyBtn);
    btnContainer.appendChild(zoomBtn);

    // 수식을 감싸는 래퍼 생성
    const wrapper = document.createElement('div');
    wrapper.className = 'formula-wrapper';
    mathElement.parentNode.insertBefore(wrapper, mathElement);
    wrapper.appendChild(mathElement);
    wrapper.appendChild(btnContainer);

    // 클릭으로도 확대 가능
    mathElement.addEventListener('click', () => {
      zoomFormula(mathElement);
    });
  });
}

// 수식 복사 기능
function copyFormulaToClipboard(mathElement) {
  // KaTeX 요소에서 LaTeX 소스 코드 추출
  const katexElement = mathElement.querySelector('.katex');
  if (!katexElement) return;

  // annotation 태그에서 LaTeX 코드 가져오기
  const annotation = mathElement.querySelector('annotation');
  const latexCode = annotation ? annotation.textContent : '';

  if (latexCode) {
    navigator.clipboard.writeText(latexCode).then(() => {
      showAlert('✅ LaTeX 코드가 클립보드에 복사되었습니다!', 'success');
    }).catch(err => {
      console.error('복사 실패:', err);
      showAlert('❌ 복사에 실패했습니다.', 'error');
    });
  } else {
    showAlert('⚠️ LaTeX 코드를 찾을 수 없습니다.', 'error');
  }
}

// 수식 확대 모달
function zoomFormula(mathElement) {
  // 기존 모달이 있으면 제거
  const existingModal = document.querySelector('.formula-zoom-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // 모달 오버레이 생성
  const modal = document.createElement('div');
  modal.className = 'formula-zoom-modal';

  // 모달 콘텐츠
  const modalContent = document.createElement('div');
  modalContent.className = 'formula-zoom-content';

  // 확대된 수식 복제
  const zoomedFormula = mathElement.cloneNode(true);
  zoomedFormula.style.cursor = 'default';
  zoomedFormula.style.fontSize = '2em';
  zoomedFormula.style.padding = '2em';

  // 닫기 버튼
  const closeBtn = document.createElement('button');
  closeBtn.className = 'formula-zoom-close';
  closeBtn.innerHTML = '✕';
  closeBtn.title = '닫기 (ESC)';
  closeBtn.onclick = () => modal.remove();

  // 복사 버튼
  const copyBtn = document.createElement('button');
  copyBtn.className = 'formula-zoom-copy';
  copyBtn.innerHTML = '📋 복사';
  copyBtn.onclick = () => copyFormulaToClipboard(zoomedFormula);

  // 조립
  modalContent.appendChild(closeBtn);
  modalContent.appendChild(copyBtn);
  modalContent.appendChild(zoomedFormula);
  modal.appendChild(modalContent);

  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });

  // ESC 키로 닫기
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  // DOM에 추가
  document.body.appendChild(modal);
}

// ==================== 그래프 렌더링 기능 ====================

let graphCounters = {
  plotly: 0,
  chart: 0,
  mermaid: 0,
  jsxgraph: 0
};

/**
 * Plotly 그래프 렌더링
 */
function renderPlotlyGraphs(container) {
  const plotlyBlocks = container.querySelectorAll('.plotly-graph-data');

  plotlyBlocks.forEach((block) => {
    try {
      const graphId = `plotly-graph-${graphCounters.plotly++}`;
      const graphData = JSON.parse(block.textContent);

      // 그래프 컨테이너 생성
      const graphDiv = document.createElement('div');
      graphDiv.id = graphId;
      graphDiv.className = 'plotly-graph-container';

      // 원본 블록을 그래프로 교체
      block.parentNode.replaceChild(graphDiv, block);

      // Plotly 그래프 렌더링
      const data = graphData.data || [];
      const layout = graphData.layout || {
        autosize: true,
        margin: { t: 40, r: 40, b: 40, l: 40 }
      };
      const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
      };

      Plotly.newPlot(graphId, data, layout, config);
    } catch (error) {
      console.error('Plotly 렌더링 오류:', error);
      block.innerHTML = `<div class="graph-error">❌ Plotly 그래프 렌더링 실패: ${error.message}</div>`;
    }
  });
}

/**
 * Chart.js 그래프 렌더링
 */
function renderChartJsGraphs(container) {
  const chartBlocks = container.querySelectorAll('.chartjs-graph-data');

  chartBlocks.forEach((block) => {
    try {
      const chartId = `chartjs-graph-${graphCounters.chart++}`;
      const chartData = JSON.parse(block.textContent);

      // Canvas 요소 생성
      const canvas = document.createElement('canvas');
      canvas.id = chartId;
      canvas.className = 'chartjs-graph-container';

      // 래퍼 div 생성
      const wrapper = document.createElement('div');
      wrapper.className = 'chartjs-wrapper';
      wrapper.appendChild(canvas);

      // 원본 블록을 그래프로 교체
      block.parentNode.replaceChild(wrapper, block);

      // Chart.js 그래프 렌더링
      new Chart(canvas.getContext('2d'), chartData);
    } catch (error) {
      console.error('Chart.js 렌더링 오류:', error);
      block.innerHTML = `<div class="graph-error">❌ Chart.js 그래프 렌더링 실패: ${error.message}</div>`;
    }
  });
}

/**
 * Mermaid 다이어그램 렌더링
 */
async function renderMermaidDiagrams(container) {
  const mermaidBlocks = container.querySelectorAll('.mermaid-diagram');

  if (mermaidBlocks.length === 0) return;

  try {
    if (typeof window.mermaid !== 'undefined') {
      // Mermaid 재초기화 (필요시)
      await window.mermaid.run({
        nodes: mermaidBlocks
      });
    }
  } catch (error) {
    console.error('Mermaid 렌더링 오류:', error);
    mermaidBlocks.forEach(block => {
      block.innerHTML = `<div class="graph-error">❌ Mermaid 다이어그램 렌더링 실패: ${error.message}</div>`;
    });
  }
}

/**
 * JSXGraph 인터랙티브 기하학 렌더링
 */
function renderJSXGraphs(container) {
  const jsxgraphBlocks = container.querySelectorAll('.jsxgraph-data');

  jsxgraphBlocks.forEach((block) => {
    try {
      const boardId = `jsxgraph-board-${graphCounters.jsxgraph++}`;

      // JSON 파싱 전에 JavaScript 주석 제거 (JSON은 주석을 지원하지 않음)
      let jsonText = block.textContent;
      // 라인 주석 제거 (// ...)
      jsonText = jsonText.replace(/\/\/.*$/gm, '');
      // 블록 주석 제거 (/* ... */)
      jsonText = jsonText.replace(/\/\*[\s\S]*?\*\//g, '');

      const jsxgraphConfig = JSON.parse(jsonText);

      // 컨테이너 구조 생성
      const wrapper = document.createElement('div');
      wrapper.className = 'jsxgraph-container';

      // 제목 (선택사항)
      if (jsxgraphConfig.title) {
        const title = document.createElement('div');
        title.className = 'jsxgraph-title';
        title.textContent = jsxgraphConfig.title;
        wrapper.appendChild(title);
      }

      // 보드 div 생성
      const boardDiv = document.createElement('div');
      boardDiv.id = boardId;
      boardDiv.className = 'jsxgraph-board';
      wrapper.appendChild(boardDiv);

      // 설명 (선택사항)
      if (jsxgraphConfig.description) {
        const desc = document.createElement('div');
        desc.className = 'jsxgraph-description';
        desc.textContent = jsxgraphConfig.description;
        wrapper.appendChild(desc);
      }

      // 원본 블록을 래퍼로 교체
      block.parentNode.replaceChild(wrapper, block);

      // JSXGraph 보드 초기화
      if (typeof JXG !== 'undefined') {
        const boardConfig = jsxgraphConfig.board || {
          boundingbox: [-10, 10, 10, -10],
          axis: true,
          showNavigation: false,
          showCopyright: false
        };

        const board = JXG.JSXGraph.initBoard(boardId, boardConfig);

        // 요소 생성 (points, lines, polygons 등)
        if (jsxgraphConfig.elements) {
          jsxgraphConfig.elements.forEach(element => {
            try {
              switch (element.type) {
                case 'point':
                  board.create('point', element.coords, element.attributes || {});
                  break;
                case 'line':
                  board.create('line', element.points, element.attributes || {});
                  break;
                case 'segment':
                  board.create('segment', element.points, element.attributes || {});
                  break;
                case 'polygon':
                  board.create('polygon', element.points, element.attributes || {});
                  break;
                case 'circle':
                  board.create('circle', element.params, element.attributes || {});
                  break;
                case 'angle':
                  board.create('angle', element.points, element.attributes || {});
                  break;
                case 'arc':
                  board.create('arc', element.params, element.attributes || {});
                  break;
                default:
                  console.warn(`알 수 없는 JSXGraph 요소 타입: ${element.type}`);
              }
            } catch (elemError) {
              console.error(`JSXGraph 요소 생성 오류 (${element.type}):`, elemError);
            }
          });
        }
      } else {
        throw new Error('JSXGraph 라이브러리가 로드되지 않았습니다');
      }
    } catch (error) {
      console.error('JSXGraph 렌더링 오류:', error);
      block.innerHTML = `<div class="graph-error">❌ JSXGraph 렌더링 실패: ${error.message}</div>`;
    }
  });
}

// ==================== 🧪 Chemistry Rendering ====================

/**
 * 3Dmol.js 분자 시각화 렌더링
 */
function render3DmolGraphs(container) {
  const molBlocks = container.querySelectorAll('.mol3d-data');

  molBlocks.forEach((block) => {
    try {
      const molId = `mol3d-${graphCounters.mol3d++}`;
      const molConfig = JSON.parse(block.textContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));

      const wrapper = document.createElement('div');
      wrapper.className = 'mol3d-container';

      if (molConfig.title) {
        const title = document.createElement('div');
        title.className = 'mol3d-title';
        title.textContent = molConfig.title;
        wrapper.appendChild(title);
      }

      const viewerDiv = document.createElement('div');
      viewerDiv.id = molId;
      viewerDiv.className = 'mol3d-viewer';
      viewerDiv.style.width = molConfig.width || '400px';
      viewerDiv.style.height = molConfig.height || '400px';
      wrapper.appendChild(viewerDiv);

      block.parentNode.replaceChild(wrapper, block);

      if (typeof $3Dmol !== 'undefined') {
        const viewer = $3Dmol.createViewer(molId, molConfig.config || {});

        if (molConfig.pdb) {
          viewer.addModel(molConfig.pdb, 'pdb');
        } else if (molConfig.sdf) {
          viewer.addModel(molConfig.sdf, 'sdf');
        } else if (molConfig.xyz) {
          viewer.addModel(molConfig.xyz, 'xyz');
        }

        viewer.setStyle({}, molConfig.style || {stick: {}});
        viewer.zoomTo();
        viewer.render();
      }
    } catch (error) {
      console.error('3Dmol 렌더링 오류:', error);
      block.innerHTML = `<div class="graph-error">❌ 3Dmol 렌더링 실패: ${error.message}</div>`;
    }
  });
}

// ==================== ⚛️ Physics Rendering ====================

/**
 * Matter.js 물리 시뮬레이션 렌더링
 */
function renderMatterJsGraphs(container) {
  const matterBlocks = container.querySelectorAll('.matter-data');

  matterBlocks.forEach((block) => {
    try {
      const matterId = `matter-${graphCounters.matter++}`;
      const matterConfig = JSON.parse(block.textContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));

      const wrapper = document.createElement('div');
      wrapper.className = 'matter-container';

      const canvasDiv = document.createElement('div');
      canvasDiv.id = matterId;
      canvasDiv.className = 'matter-canvas';
      canvasDiv.style.width = matterConfig.width || '600px';
      canvasDiv.style.height = matterConfig.height || '400px';
      wrapper.appendChild(canvasDiv);

      block.parentNode.replaceChild(wrapper, block);

      if (typeof Matter !== 'undefined') {
        const Engine = Matter.Engine;
        const Render = Matter.Render;
        const Runner = Matter.Runner;
        const Bodies = Matter.Bodies;
        const Composite = Matter.Composite;

        const engine = Engine.create();
        const render = Render.create({
          element: document.getElementById(matterId),
          engine: engine,
          options: matterConfig.options || {
            width: 600,
            height: 400,
            wireframes: false
          }
        });

        if (matterConfig.bodies) {
          matterConfig.bodies.forEach(bodyConfig => {
            let body;
            if (bodyConfig.type === 'rectangle') {
              body = Bodies.rectangle(bodyConfig.x, bodyConfig.y, bodyConfig.width, bodyConfig.height, bodyConfig.options);
            } else if (bodyConfig.type === 'circle') {
              body = Bodies.circle(bodyConfig.x, bodyConfig.y, bodyConfig.radius, bodyConfig.options);
            }
            if (body) Composite.add(engine.world, body);
          });
        }

        Render.run(render);
        const runner = Runner.create();
        Runner.run(runner, engine);
      }
    } catch (error) {
      console.error('Matter.js 렌더링 오류:', error);
      block.innerHTML = `<div class="graph-error">❌ Matter.js 렌더링 실패: ${error.message}</div>`;
    }
  });
}

/**
 * p5.js 시뮬레이션 렌더링
 */
function renderP5Graphs(container) {
  const p5Blocks = container.querySelectorAll('.p5-data');

  p5Blocks.forEach((block) => {
    try {
      const p5Id = `p5-${graphCounters.p5++}`;
      const p5Config = JSON.parse(block.textContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));

      const wrapper = document.createElement('div');
      wrapper.className = 'p5-container';
      wrapper.id = p5Id;
      block.parentNode.replaceChild(wrapper, block);

      if (typeof p5 !== 'undefined' && p5Config.sketch) {
        new p5(eval(`(${p5Config.sketch})`), p5Id);
      }
    } catch (error) {
      console.error('p5.js 렌더링 오류:', error);
      block.innerHTML = `<div class="graph-error">❌ p5.js 렌더링 실패: ${error.message}</div>`;
    }
  });
}

// ==================== 🧬 Biology Rendering ====================

/**
 * Cytoscape.js 생물학적 네트워크 렌더링
 */
function renderCytoscapeGraphs(container) {
  const cytoBlocks = container.querySelectorAll('.cytoscape-data');

  cytoBlocks.forEach((block) => {
    try {
      const cytoId = `cytoscape-${graphCounters.cytoscape++}`;
      const cytoConfig = JSON.parse(block.textContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));

      const wrapper = document.createElement('div');
      wrapper.className = 'cytoscape-container';

      const cytoDiv = document.createElement('div');
      cytoDiv.id = cytoId;
      cytoDiv.className = 'cytoscape-graph';
      cytoDiv.style.width = cytoConfig.width || '600px';
      cytoDiv.style.height = cytoConfig.height || '400px';
      wrapper.appendChild(cytoDiv);

      block.parentNode.replaceChild(wrapper, block);

      if (typeof cytoscape !== 'undefined') {
        cytoscape({
          container: document.getElementById(cytoId),
          elements: cytoConfig.elements || [],
          style: cytoConfig.style || [],
          layout: cytoConfig.layout || { name: 'grid' }
        });
      }
    } catch (error) {
      console.error('Cytoscape 렌더링 오류:', error);
      block.innerHTML = `<div class="graph-error">❌ Cytoscape 렌더링 실패: ${error.message}</div>`;
    }
  });
}

// ==================== 🌍 Earth Science Rendering ====================

/**
 * Leaflet 지도 렌더링
 */
function renderLeafletMaps(container) {
  const leafletBlocks = container.querySelectorAll('.leaflet-data');

  leafletBlocks.forEach((block) => {
    try {
      const leafletId = `leaflet-${graphCounters.leaflet++}`;
      const leafletConfig = JSON.parse(block.textContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));

      const wrapper = document.createElement('div');
      wrapper.className = 'leaflet-container';

      const mapDiv = document.createElement('div');
      mapDiv.id = leafletId;
      mapDiv.className = 'leaflet-map';
      mapDiv.style.width = leafletConfig.width || '100%';
      mapDiv.style.height = leafletConfig.height || '400px';
      wrapper.appendChild(mapDiv);

      block.parentNode.replaceChild(wrapper, block);

      if (typeof L !== 'undefined') {
        const map = L.map(leafletId).setView(
          leafletConfig.center || [37.5665, 126.9780],
          leafletConfig.zoom || 13
        );

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: leafletConfig.attribution || '© OpenStreetMap contributors'
        }).addTo(map);

        if (leafletConfig.markers) {
          leafletConfig.markers.forEach(marker => {
            L.marker(marker.position).addTo(map).bindPopup(marker.popup || '');
          });
        }
      }
    } catch (error) {
      console.error('Leaflet 렌더링 오류:', error);
      block.innerHTML = `<div class="graph-error">❌ Leaflet 렌더링 실패: ${error.message}</div>`;
    }
  });
}

// ==================== 🔬 General Science Rendering ====================

/**
 * Three.js 3D 시각화 렌더링
 */
function renderThreeJsGraphs(container) {
  const threeBlocks = container.querySelectorAll('.threejs-data');

  threeBlocks.forEach((block) => {
    try {
      const threeId = `threejs-${graphCounters.threejs++}`;
      const threeConfig = JSON.parse(block.textContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));

      const wrapper = document.createElement('div');
      wrapper.className = 'threejs-container';

      const canvasDiv = document.createElement('div');
      canvasDiv.id = threeId;
      canvasDiv.className = 'threejs-canvas';
      canvasDiv.style.width = threeConfig.width || '600px';
      canvasDiv.style.height = threeConfig.height || '400px';
      wrapper.appendChild(canvasDiv);

      block.parentNode.replaceChild(wrapper, block);

      if (typeof THREE !== 'undefined') {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 600/400, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer();

        renderer.setSize(parseInt(threeConfig.width) || 600, parseInt(threeConfig.height) || 400);
        document.getElementById(threeId).appendChild(renderer.domElement);

        if (threeConfig.objects) {
          threeConfig.objects.forEach(obj => {
            let geometry, material, mesh;

            if (obj.type === 'box') {
              geometry = new THREE.BoxGeometry(obj.width || 1, obj.height || 1, obj.depth || 1);
              material = new THREE.MeshBasicMaterial({ color: obj.color || 0x00ff00 });
              mesh = new THREE.Mesh(geometry, material);
              if (obj.position) mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
              scene.add(mesh);
            } else if (obj.type === 'sphere') {
              geometry = new THREE.SphereGeometry(obj.radius || 1, 32, 32);
              material = new THREE.MeshBasicMaterial({ color: obj.color || 0x0000ff });
              mesh = new THREE.Mesh(geometry, material);
              if (obj.position) mesh.position.set(obj.position.x, obj.position.y, obj.position.z);
              scene.add(mesh);
            }
          });
        }

        camera.position.z = threeConfig.cameraZ || 5;

        function animate() {
          requestAnimationFrame(animate);
          scene.children.forEach(child => {
            if (child.rotation) {
              child.rotation.x += 0.01;
              child.rotation.y += 0.01;
            }
          });
          renderer.render(scene, camera);
        }
        animate();
      }
    } catch (error) {
      console.error('Three.js 렌더링 오류:', error);
      block.innerHTML = `<div class="graph-error">❌ Three.js 렌더링 실패: ${error.message}</div>`;
    }
  });
}

/**
 * 모든 그래프 렌더링
 */
async function renderAllGraphs(container) {
  // 카운터 초기화
  graphCounters = {
    plotly: 0,
    chart: 0,
    mermaid: 0,
    jsxgraph: 0,
    mol3d: 0,
    matter: 0,
    p5: 0,
    cytoscape: 0,
    leaflet: 0,
    threejs: 0
  };

  // 각 그래프 타입 렌더링
  renderPlotlyGraphs(container);
  renderChartJsGraphs(container);
  renderJSXGraphs(container);
  await renderMermaidDiagrams(container);

  // 🧪 Chemistry
  render3DmolGraphs(container);

  // ⚛️ Physics
  renderMatterJsGraphs(container);
  renderP5Graphs(container);

  // 🧬 Biology
  renderCytoscapeGraphs(container);

  // 🌍 Earth Science
  renderLeafletMaps(container);

  // 🔬 General Science
  renderThreeJsGraphs(container);
}
