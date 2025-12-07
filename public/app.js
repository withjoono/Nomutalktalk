// ==================== 전역 변수 ====================
let currentStore = null;
let metadataCounter = 0;
let subjectsData = null;
let subjectsData2015 = null; // 2015 교육과정 데이터
let subjectsData2022 = null; // 2022 교육과정 데이터
let selectedSubject = null;
let selectedCurriculum = '2022'; // 기본값: 2022 교육과정
let selectedCourse = null;
let selectedPublisher = null;
let selectedChapter = null;

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', () => {
  checkServerHealth();
  setupEventListeners();
  loadSubjectsData();
  loadRecords(); // 저장된 학습 기록 로드
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
    // 2015 교육과정 데이터 로드
    const response2015 = await fetch('/subjects.json');
    const data2015 = await response2015.json();
    subjectsData2015 = data2015.subjects;

    // 2022 교육과정 데이터 로드
    const response2022 = await fetch('/subjects-2022.json');
    const data2022 = await response2022.json();
    subjectsData2022 = data2022.subjects;

    // 기본값으로 2022 교육과정 사용
    subjectsData = subjectsData2022;

    // 교과 드롭다운 초기화
    updateSubjectDropdown();

    console.log('✅ 과목 데이터 로드 완료 - 2015:', subjectsData2015.length, '개 교과, 2022:', subjectsData2022.length, '개 교과');
  } catch (error) {
    console.error('❌ 과목 데이터 로드 실패:', error);
    showAlert('과목 데이터를 불러오는데 실패했습니다.', 'error');
  }
}

/**
 * 교과 드롭다운 업데이트
 */
function updateSubjectDropdown() {
  const subjectSelect = document.getElementById('subjectSelect');
  const courseSelect = document.getElementById('courseSelect');
  const curriculumGroup = document.getElementById('curriculumGroup');

  subjectSelect.innerHTML = '<option value="">교과를 선택하세요</option>';

  if (subjectsData) {
    subjectsData.forEach((subject, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = subject.subject;
      subjectSelect.appendChild(option);
    });
  }

  // 과목 선택 초기화
  courseSelect.innerHTML = '<option value="">먼저 교과를 선택하세요</option>';
  courseSelect.disabled = true;

  // 교육과정 선택 숨김
  if (curriculumGroup) {
    curriculumGroup.style.display = 'none';
  }

  // 선택 상태 초기화
  selectedSubject = null;
  selectedCourse = null;
}

/**
 * 교과 선택 변경 이벤트
 */
function onSubjectChange() {
  const subjectSelect = document.getElementById('subjectSelect');
  const courseSelect = document.getElementById('courseSelect');
  const selectedCourseInfo = document.getElementById('selectedCourseInfo');
  const curriculumGroup = document.getElementById('curriculumGroup');

  const selectedIndex = subjectSelect.value;

  if (!selectedIndex) {
    // 교과 선택 해제
    curriculumGroup.style.display = 'none';
    courseSelect.disabled = true;
    courseSelect.innerHTML = '<option value="">먼저 교과를 선택하세요</option>';
    selectedCourseInfo.style.display = 'none';
    selectedSubject = null;
    selectedCourse = null;
    return;
  }

  // 선택된 교과 저장
  selectedSubject = subjectsData[selectedIndex];

  // 교육과정 선택 그룹 표시
  curriculumGroup.style.display = 'block';

  // 과목 드롭다운 직접 업데이트
  updateCourseList();

  courseSelect.disabled = false;
  selectedCourseInfo.style.display = 'none';
  selectedCourse = null;

  console.log('✅ 교과 선택:', selectedSubject.subject, '(과목 수:', selectedSubject.courses.length + ')');
}

/**
 * 교육과정 선택 변경 이벤트
 */
function onCurriculumChange() {
  const curriculumRadio = document.querySelector('input[name="curriculum"]:checked');
  const newCurriculum = curriculumRadio ? curriculumRadio.value : '2022';

  // 교육과정이 변경된 경우에만 처리
  if (selectedCurriculum !== newCurriculum) {
    selectedCurriculum = newCurriculum;

    // 교육과정에 따라 데이터 전환
    subjectsData = selectedCurriculum === '2022' ? subjectsData2022 : subjectsData2015;

    console.log('✅ 교육과정 변경:', selectedCurriculum, '- 교과 수:', subjectsData ? subjectsData.length : 0);

    // 현재 선택된 교과가 새 교육과정에도 있는지 확인
    const subjectSelect = document.getElementById('subjectSelect');
    const currentSubjectName = selectedSubject ? selectedSubject.subject : null;

    // 교과 드롭다운 재초기화
    updateSubjectDropdown();

    // 이전에 선택한 교과가 새 교육과정에도 있으면 자동 선택
    if (currentSubjectName && subjectsData) {
      const matchingIndex = subjectsData.findIndex(s => s.subject === currentSubjectName);
      if (matchingIndex !== -1) {
        subjectSelect.value = matchingIndex;
        onSubjectChange();
      }
    }
  } else {
    console.log('✅ 교육과정 유지:', selectedCurriculum);
  }
}

/**
 * 과목 목록 업데이트
 */
function updateCourseList() {
  const courseSelect = document.getElementById('courseSelect');

  courseSelect.innerHTML = '<option value="">과목을 선택하세요</option>';

  if (selectedSubject && selectedSubject.courses) {
    selectedSubject.courses.forEach((course, index) => {
      const option = document.createElement('option');
      option.value = index;
      // 카테고리가 있으면 함께 표시
      const categoryBadge = course.category ? ` [${course.category}]` : '';
      option.textContent = course.name + categoryBadge;
      courseSelect.appendChild(option);
    });
  }
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

      // 풀이 내용을 currentProblem에 저장
      currentProblem.solution = data.answer;

      // 저장 버튼 표시
      const saveButtonArea = document.getElementById('saveButtonArea');
      if (saveButtonArea) {
        saveButtonArea.style.display = 'block';
        // 저장 상태 초기화
        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) {
          saveStatus.textContent = '';
          saveStatus.className = 'save-status';
        }
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

// ==================== 💾 학습 기록 저장 시스템 ====================

/**
 * 문제와 풀이 저장
 */
async function saveRecord() {
  if (!currentProblem) {
    showAlert('저장할 문제가 없습니다.', 'error');
    return;
  }

  if (!currentProblem.solution) {
    showAlert('먼저 풀이를 요청하세요.', 'error');
    return;
  }

  const saveBtn = document.getElementById('saveRecordBtn');
  const saveStatus = document.getElementById('saveStatus');

  try {
    // 버튼 비활성화 및 로딩 상태
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ 저장 중...';
    saveStatus.textContent = '클라우드에 저장하는 중...';
    saveStatus.className = 'save-status loading';

    const response = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: currentProblem.subject || selectedSubject || '',
        course: currentProblem.course || selectedCourse || '',
        publisher: currentProblem.publisher || selectedPublisher || '',
        chapter: currentProblem.chapter || selectedChapter || '',
        type: currentProblem.type || 'multiple',
        problem: currentProblem.content,
        solution: currentProblem.solution,
        request: currentProblem.request || ''
      })
    });

    const data = await response.json();

    if (data.success) {
      saveStatus.textContent = '✅ 저장되었습니다!';
      saveStatus.className = 'save-status success';
      saveBtn.textContent = '✅ 저장 완료';

      // 3초 후 버튼 원래대로
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 문제와 풀이 저장하기';
      }, 3000);

      // 기록 목록 새로고침
      loadRecords();

      showAlert('✅ 학습 기록이 저장되었습니다!', 'success');
    } else {
      throw new Error(data.error || '저장 실패');
    }
  } catch (error) {
    console.error('저장 오류:', error);
    saveStatus.textContent = `❌ 저장 실패: ${error.message}`;
    saveStatus.className = 'save-status error';
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 문제와 풀이 저장하기';
    showAlert(`❌ 저장 실패: ${error.message}`, 'error');
  }
}

/**
 * 저장된 학습 기록 목록 불러오기
 */
async function loadRecords() {
  const recordsList = document.getElementById('recordsList');

  if (!recordsList) return;

  try {
    recordsList.innerHTML = '<p class="info-message">📂 기록 불러오는 중...</p>';

    const response = await fetch('/api/records');
    const data = await response.json();

    if (data.success && data.records.length > 0) {
      recordsList.innerHTML = data.records.map(record => `
        <div class="record-card" data-id="${record.id}">
          <div class="record-header">
            <div class="record-meta">
              <div class="record-subject">${record.subject || '미분류'} > ${record.course || ''}</div>
              <div class="record-chapter">${record.publisher || ''} ${record.chapter || ''}</div>
            </div>
            <div class="record-date">${formatDate(record.createdAt)}</div>
          </div>
          <div class="record-preview">${stripHtml(record.problem).substring(0, 150)}...</div>
          <div class="record-actions">
            <button class="record-btn record-btn-view" onclick="viewRecord('${record.id}')">📖 상세 보기</button>
            <button class="record-btn record-btn-delete" onclick="deleteRecord('${record.id}')">🗑️ 삭제</button>
          </div>
        </div>
      `).join('');
    } else if (data.success && data.records.length === 0) {
      recordsList.innerHTML = '<p class="records-empty">📭 저장된 학습 기록이 없습니다.</p>';
    } else {
      throw new Error(data.error || '기록 불러오기 실패');
    }
  } catch (error) {
    console.error('기록 불러오기 오류:', error);
    recordsList.innerHTML = `<p class="records-empty">❌ 오류: ${error.message}</p>`;
  }
}

/**
 * 특정 학습 기록 상세 보기
 */
async function viewRecord(id) {
  try {
    const response = await fetch(`/api/records/${id}`);
    const data = await response.json();

    if (data.success) {
      showRecordModal(data.record);
    } else {
      throw new Error(data.error || '기록 조회 실패');
    }
  } catch (error) {
    console.error('기록 조회 오류:', error);
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

/**
 * 학습 기록 삭제
 */
async function deleteRecord(id) {
  if (!confirm('정말 이 기록을 삭제하시겠습니까?')) {
    return;
  }

  try {
    const response = await fetch(`/api/records/${id}`, {
      method: 'DELETE'
    });
    const data = await response.json();

    if (data.success) {
      showAlert('✅ 기록이 삭제되었습니다.', 'success');
      loadRecords();
    } else {
      throw new Error(data.error || '삭제 실패');
    }
  } catch (error) {
    console.error('삭제 오류:', error);
    showAlert(`❌ 삭제 실패: ${error.message}`, 'error');
  }
}

/**
 * 학습 기록 상세 모달 표시
 */
function showRecordModal(record) {
  // 기존 모달 제거
  const existingModal = document.querySelector('.record-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.className = 'record-modal';
  modal.innerHTML = `
    <div class="record-modal-content">
      <button class="record-modal-close" onclick="closeRecordModal()">×</button>
      <h2 class="record-modal-title">📚 학습 기록 상세</h2>

      <div class="record-modal-section">
        <h4>📌 정보</h4>
        <div class="record-modal-section-content">
          <p><strong>과목:</strong> ${record.subject || '미분류'} > ${record.course || ''}</p>
          <p><strong>출판사/단원:</strong> ${record.publisher || ''} ${record.chapter || ''}</p>
          <p><strong>유형:</strong> ${record.type === 'multiple' ? '객관식' : '주관식'}</p>
          <p><strong>저장일:</strong> ${formatDate(record.createdAt)}</p>
        </div>
      </div>

      <div class="record-modal-section">
        <h4>📝 문제</h4>
        <div class="record-modal-section-content problem-content" id="modalProblemContent">
          ${formatAnswer(record.problem)}
        </div>
      </div>

      <div class="record-modal-section">
        <h4>✅ 풀이</h4>
        <div class="record-modal-section-content solution-content" id="modalSolutionContent">
          ${formatAnswer(record.solution)}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 모달 외부 클릭 시 닫기
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeRecordModal();
    }
  });

  // ESC 키로 닫기
  document.addEventListener('keydown', handleModalEscKey);

  // 수식 렌더링
  setTimeout(() => {
    const problemContent = document.getElementById('modalProblemContent');
    const solutionContent = document.getElementById('modalSolutionContent');

    if (typeof renderMathInElement !== 'undefined') {
      const katexOptions = {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\[', right: '\\]', display: true},
          {left: '\\(', right: '\\)', display: false}
        ],
        throwOnError: false,
        trust: true,
        strict: false
      };

      if (problemContent) renderMathInElement(problemContent, katexOptions);
      if (solutionContent) renderMathInElement(solutionContent, katexOptions);
    }

    // 그래프 렌더링
    if (problemContent) renderAllGraphs(problemContent);
    if (solutionContent) renderAllGraphs(solutionContent);
  }, 100);
}

/**
 * 모달 닫기
 */
function closeRecordModal() {
  const modal = document.querySelector('.record-modal');
  if (modal) {
    modal.remove();
  }
  document.removeEventListener('keydown', handleModalEscKey);
}

/**
 * ESC 키 핸들러
 */
function handleModalEscKey(e) {
  if (e.key === 'Escape') {
    closeRecordModal();
  }
}

/**
 * 날짜 포맷팅
 */
function formatDate(dateString) {
  if (!dateString) return '알 수 없음';

  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  // 1시간 이내
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}분 전`;
  }

  // 24시간 이내
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}시간 전`;
  }

  // 7일 이내
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}일 전`;
  }

  // 그 외
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * HTML 태그 제거 (미리보기용)
 */
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// ==================== 참조 문제 기반 변형 출제 시스템 (Phase 1) ====================

// 참조 문제 파일 저장용 전역 변수
let referenceFiles = [];
let currentVariationProblem = null;

/**
 * 초기화: 참조 문제 업로드 이벤트 리스너 설정
 */
document.addEventListener('DOMContentLoaded', () => {
  setupReferenceUploadListeners();
  setupExamTypeListener();
});

/**
 * 참조 문제 업로드 이벤트 리스너 설정
 */
function setupReferenceUploadListeners() {
  const dropZone = document.getElementById('referenceDropZone');
  const fileInput = document.getElementById('referenceFileInput');

  if (!dropZone || !fileInput) return;

  // 드래그 앤 드롭 이벤트
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleReferenceFiles(e.dataTransfer.files);
  });

  // 파일 선택 이벤트
  fileInput.addEventListener('change', (e) => {
    handleReferenceFiles(e.target.files);
  });
}

/**
 * 시험 종류에 따른 추가 필드 표시/숨김
 */
function setupExamTypeListener() {
  const examTypeSelect = document.getElementById('examTypeSelect');
  if (!examTypeSelect) return;

  examTypeSelect.addEventListener('change', (e) => {
    const isNaesin = e.target.value === '내신';
    document.getElementById('schoolNameGroup').style.display = isNaesin ? 'block' : 'none';
    document.getElementById('semesterGroup').style.display = isNaesin ? 'block' : 'none';
  });
}

/**
 * 참조 파일 처리
 */
function handleReferenceFiles(files) {
  const preview = document.getElementById('referencePreview');

  for (const file of files) {
    // 파일 크기 체크 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showAlert(`⚠️ ${file.name}: 파일 크기가 10MB를 초과합니다.`, 'error');
      continue;
    }

    // 파일 형식 체크
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';

    if (!isImage && !isPDF) {
      showAlert(`⚠️ ${file.name}: 지원하지 않는 형식입니다.`, 'error');
      continue;
    }

    // 파일 저장
    const fileId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    referenceFiles.push({ id: fileId, file });

    // 미리보기 생성
    const previewItem = document.createElement('div');
    previewItem.className = 'preview-item';
    previewItem.id = `preview-${fileId}`;

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        previewItem.innerHTML = `
          <img src="${e.target.result}" alt="${file.name}">
          <button class="preview-remove" onclick="removeReferenceFile('${fileId}')">×</button>
          <div class="preview-filename">${file.name}</div>
        `;
        // 첫 번째 이미지를 currentReferenceImage에 저장 (base64)
        if (referenceFiles.length === 1) {
          currentReferenceImage = e.target.result.split(',')[1]; // data:image/...;base64, 부분 제거
        }
      };
      reader.readAsDataURL(file);
    } else {
      previewItem.innerHTML = `
        <div class="pdf-icon">📄</div>
        <button class="preview-remove" onclick="removeReferenceFile('${fileId}')">×</button>
        <div class="preview-filename">${file.name}</div>
      `;
    }

    preview.appendChild(previewItem);
  }

  // 과목 정보 연동
  updateRefSubjectDisplay();
}

/**
 * 참조 파일 제거
 */
function removeReferenceFile(fileId) {
  referenceFiles = referenceFiles.filter(f => f.id !== fileId);
  const previewItem = document.getElementById(`preview-${fileId}`);
  if (previewItem) {
    previewItem.remove();
  }
  // 모든 파일이 삭제되면 currentReferenceImage도 초기화
  if (referenceFiles.length === 0) {
    currentReferenceImage = null;
  }
}

/**
 * 선택된 과목 정보를 참조 문제 섹션에 표시
 */
function updateRefSubjectDisplay() {
  const refSubjectDisplay = document.getElementById('refSubjectDisplay');
  if (refSubjectDisplay && selectedCourse) {
    const subjectName = selectedSubject?.subject || '';
    refSubjectDisplay.value = `${subjectName} > ${selectedCourse.name || ''}`;
  }
}

/**
 * 변형 문제 생성
 */
async function generateVariation() {
  // 파일 확인
  if (referenceFiles.length === 0) {
    showAlert('⚠️ 참조 문제 이미지를 업로드해주세요.', 'error');
    return;
  }

  // 메타데이터 수집
  const metadata = collectVariationMetadata();
  if (!metadata) return;

  const geminiModel = document.getElementById('geminiModelSelect')?.value || 'gemini-2.0-flash-exp';
  const openaiModel = document.getElementById('openaiModelSelect')?.value || '';
  const variationCount = parseInt(document.getElementById('variationCountSelect').value);
  const instructions = document.getElementById('variationInstructions').value;

  // 진행 상태 표시
  const progressBox = document.getElementById('variationProgress');
  const progressText = document.getElementById('variationProgressText');
  const generateBtn = document.getElementById('generateVariationBtn');

  progressBox.style.display = 'block';
  generateBtn.disabled = true;

  try {
    // 파일을 Base64로 변환
    progressText.textContent = '이미지 처리 중...';
    const imageDataList = await Promise.all(
      referenceFiles.map(async (rf) => {
        const base64 = await fileToBase64(rf.file);
        return {
          filename: rf.file.name,
          mimeType: rf.file.type,
          data: base64
        };
      })
    );

    progressText.textContent = 'AI 분석 중...';

    // API 호출
    const response = await fetch('/api/generate-variation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        images: imageDataList,
        metadata,
        geminiModel,
        openaiModel,
        variationCount,
        instructions
      })
    });

    const data = await response.json();

    if (data.success) {
      progressText.textContent = '변형 문제 생성 완료!';
      currentVariationProblem = data.variation;
      displayVariationResult(data.variation);
    } else {
      throw new Error(data.error || '변형 문제 생성 실패');
    }
  } catch (error) {
    console.error('변형 문제 생성 오류:', error);
    showAlert(`❌ 오류: ${error.message}`, 'error');
  } finally {
    progressBox.style.display = 'none';
    generateBtn.disabled = false;
  }
}

/**
 * 메타데이터 수집
 */
function collectVariationMetadata() {
  const examType = document.getElementById('examTypeSelect').value;
  const problemCategory = document.getElementById('problemCategorySelect').value;
  const examYear = document.getElementById('examYearInput').value;
  const grade = document.getElementById('gradeSelect').value;
  const refChapter = document.getElementById('refChapterInput').value;

  // 필수 필드 검증
  if (!examType || !problemCategory) {
    showAlert('⚠️ 시험 종류와 문제 유형을 선택해주세요.', 'error');
    return null;
  }

  const metadata = {
    examType,
    problemCategory,
    examYear,
    grade,
    subject: selectedSubject,
    course: selectedCourse?.name || '',
    courseId: selectedCourse?.id || '',
    chapter: refChapter
  };

  // 내신인 경우 추가 정보
  if (examType === '내신') {
    metadata.schoolName = document.getElementById('schoolNameInput').value;
    metadata.semester = document.getElementById('semesterSelect').value;
  }

  return metadata;
}

/**
 * 파일을 Base64로 변환
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // data:image/png;base64, 부분 제거
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 변형 문제 결과 표시
 */
function displayVariationResult(variation) {
  const resultBox = document.getElementById('variationResultBox');
  const content = document.getElementById('variationContent');

  // 모델 정보 표시
  const modelInfo = `<div class="model-info-badge">
    <span class="badge gemini">🔷 ${variation.geminiModel || 'Gemini'}</span>
    ${variation.openaiModel ? `<span class="badge openai">🟢 ${variation.openaiModel}</span>` : ''}
  </div>`;

  let resultHTML = modelInfo + formatAnswer(variation.problem);

  // OpenAI 검토 결과가 있으면 표시
  if (variation.openaiReview && !variation.openaiReview.startsWith('OpenAI 검증 실패')) {
    resultHTML += `
      <div class="openai-review-box" style="margin-top: 20px; padding: 15px; background: #e8f5e9; border-left: 4px solid #4caf50; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0; color: #2e7d32;">🟢 OpenAI 검토 의견</h4>
        <div id="openaiReviewContent">${formatAnswer(variation.openaiReview)}</div>
      </div>`;
  }

  content.innerHTML = resultHTML;
  resultBox.style.display = 'block';

  // 수식 렌더링
  setTimeout(() => {
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(content, {
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
    }
    renderAllGraphs(content);
    console.log('변형 문제 렌더링 완료');
  }, 100);

  // 결과 영역으로 스크롤
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 변형 문제 풀이 요청
 */
async function requestVariationSolution() {
  if (!currentVariationProblem) {
    showAlert('⚠️ 먼저 변형 문제를 생성해주세요.', 'error');
    return;
  }

  const progressBox = document.getElementById('variationProgress');
  const progressText = document.getElementById('variationProgressText');

  progressBox.style.display = 'block';
  progressText.textContent = '풀이 생성 중...';

  try {
    const geminiModel = document.getElementById('geminiModelSelect')?.value || 'gemini-2.0-flash-exp';
    const openaiModel = document.getElementById('openaiModelSelect')?.value || '';

    const response = await fetch('/api/variation-solution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        problem: currentVariationProblem.problem,
        metadata: currentVariationProblem.metadata,
        geminiModel,
        openaiModel
      })
    });

    const data = await response.json();

    if (data.success) {
      currentVariationProblem.solution = data.solution;

      // 풀이를 결과 박스에 추가
      const content = document.getElementById('variationContent');

      // 모델 정보와 Gemini 풀이
      let solutionHTML = `
        <div class="solution-box" style="margin-top: 20px;">
          <h3>💡 풀이 <span class="badge gemini" style="font-size: 12px;">🔷 ${data.geminiModel || 'Gemini'}</span></h3>
          <div id="variationSolutionContent">${formatAnswer(data.solution)}</div>
        </div>
      `;

      // OpenAI 풀이가 있으면 추가
      if (data.openaiSolution && !data.openaiSolution.startsWith('OpenAI 풀이 생성 실패')) {
        solutionHTML += `
          <div class="solution-box openai-solution" style="margin-top: 20px; background: #e3f2fd; border-left: 4px solid #2196f3;">
            <h3>💡 OpenAI 풀이 <span class="badge openai" style="font-size: 12px;">🟢 ${data.openaiModel}</span></h3>
            <div id="openaiSolutionContent">${formatAnswer(data.openaiSolution)}</div>
          </div>
        `;
      }

      content.innerHTML += solutionHTML;

      // 수식 렌더링
      setTimeout(() => {
        const solutionContent = document.getElementById('variationSolutionContent');
        const openaiContent = document.getElementById('openaiSolutionContent');

        const renderOptions = {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\[', right: '\\]', display: true},
            {left: '\\(', right: '\\)', display: false}
          ],
          throwOnError: false,
          trust: true,
          strict: false
        };

        if (typeof renderMathInElement !== 'undefined') {
          if (solutionContent) renderMathInElement(solutionContent, renderOptions);
          if (openaiContent) renderMathInElement(openaiContent, renderOptions);
        }
        if (solutionContent) renderAllGraphs(solutionContent);
        if (openaiContent) renderAllGraphs(openaiContent);
      }, 100);

      showAlert('✅ 풀이가 생성되었습니다!', 'success');
    } else {
      throw new Error(data.error || '풀이 생성 실패');
    }
  } catch (error) {
    console.error('풀이 생성 오류:', error);
    showAlert(`❌ 오류: ${error.message}`, 'error');
  } finally {
    progressBox.style.display = 'none';
  }
}

/**
 * 변형 문제 저장
 */
async function saveVariation() {
  if (!currentVariationProblem) {
    showAlert('⚠️ 저장할 변형 문제가 없습니다.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/records', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'variation',
        subject: currentVariationProblem.metadata?.subject || '',
        course: currentVariationProblem.metadata?.course || '',
        publisher: currentVariationProblem.metadata?.examType || '',
        chapter: currentVariationProblem.metadata?.chapter || '',
        problem: currentVariationProblem.problem,
        solution: currentVariationProblem.solution || '',
        metadata: currentVariationProblem.metadata
      })
    });

    const data = await response.json();

    if (data.success) {
      showAlert('✅ 변형 문제가 저장되었습니다!', 'success');
      loadRecords();
    } else {
      throw new Error(data.error || '저장 실패');
    }
  } catch (error) {
    console.error('저장 오류:', error);
    showAlert(`❌ 저장 실패: ${error.message}`, 'error');
  }
}

/**
 * 변형 문제 다시 생성
 */
function regenerateVariation() {
  currentVariationProblem = null;
  document.getElementById('variationResultBox').style.display = 'none';
  document.getElementById('reviewResultBox').style.display = 'none';
  generateVariation();
}

// ==================== Phase 2: OCR 및 자동화 기능 ====================

// 현재 검토 결과 저장
let currentReviewResult = null;
let extractedOCRText = '';

/**
 * OCR 텍스트 추출
 */
async function extractOCRText() {
  if (referenceFiles.length === 0) {
    showAlert('⚠️ 먼저 이미지를 업로드해주세요.', 'error');
    return;
  }

  const ocrBtn = document.getElementById('ocrBtn');
  ocrBtn.disabled = true;
  ocrBtn.textContent = '📝 추출 중...';

  try {
    // 이미지를 base64로 변환
    const images = await Promise.all(referenceFiles.map(async (file) => {
      const data = await fileToBase64(file.file);
      return {
        data,
        mimeType: file.file.type
      };
    }));

    const response = await fetch('/api/ocr-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images,
        extractType: 'problem'
      })
    });

    const data = await response.json();

    if (data.success) {
      extractedOCRText = data.extractedText;
      displayOCRResult(data.extractedText);
      showAlert('✅ OCR 추출 완료!', 'success');
    } else {
      throw new Error(data.error || 'OCR 추출 실패');
    }
  } catch (error) {
    console.error('OCR 오류:', error);
    showAlert(`❌ OCR 오류: ${error.message}`, 'error');
  } finally {
    ocrBtn.disabled = false;
    ocrBtn.textContent = '📝 OCR 추출';
  }
}

/**
 * OCR 결과 표시
 */
function displayOCRResult(text) {
  const ocrBox = document.getElementById('ocrResultBox');
  const ocrContent = document.getElementById('ocrContent');

  ocrContent.textContent = text;
  ocrBox.style.display = 'block';
}

/**
 * OCR 텍스트 복사
 */
function copyOCRText() {
  navigator.clipboard.writeText(extractedOCRText).then(() => {
    showAlert('📋 클립보드에 복사되었습니다!', 'success');
  }).catch(err => {
    console.error('복사 실패:', err);
    showAlert('❌ 복사 실패', 'error');
  });
}

/**
 * OCR 결과 닫기
 */
function closeOCRResult() {
  document.getElementById('ocrResultBox').style.display = 'none';
}

/**
 * 자동 라벨링 실행
 */
async function autoLabelProblem() {
  if (referenceFiles.length === 0) {
    showAlert('⚠️ 먼저 이미지를 업로드해주세요.', 'error');
    return;
  }

  const labelBtn = document.getElementById('autoLabelBtn');
  labelBtn.disabled = true;
  labelBtn.textContent = '🏷️ 분류 중...';

  try {
    const images = await Promise.all(referenceFiles.map(async (file) => {
      const data = await fileToBase64(file.file);
      return {
        data,
        mimeType: file.file.type
      };
    }));

    const response = await fetch('/api/auto-label', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problemText: extractedOCRText || null,
        images
      })
    });

    const data = await response.json();

    if (data.success && data.labels) {
      applyAutoLabels(data.labels);
      showAlert('✅ 자동 분류 완료! 메타데이터가 자동 입력되었습니다.', 'success');
    } else {
      throw new Error(data.error || '자동 분류 실패');
    }
  } catch (error) {
    console.error('자동 분류 오류:', error);
    showAlert(`❌ 자동 분류 오류: ${error.message}`, 'error');
  } finally {
    labelBtn.disabled = false;
    labelBtn.textContent = '🏷️ 자동 분류';
  }
}

/**
 * 자동 분류된 라벨 적용
 */
function applyAutoLabels(labels) {
  if (labels.parseError) {
    console.warn('라벨 파싱 실패, 원본:', labels.raw);
    return;
  }

  // 학년 선택
  if (labels.grade) {
    const gradeSelect = document.getElementById('refGradeSelect');
    if (gradeSelect) {
      const gradeOption = Array.from(gradeSelect.options).find(
        opt => opt.text.includes(labels.grade) || labels.grade.includes(opt.text)
      );
      if (gradeOption) {
        gradeSelect.value = gradeOption.value;
      }
    }
  }

  // 단원명
  if (labels.chapter) {
    const chapterInput = document.getElementById('refChapterInput');
    if (chapterInput) {
      chapterInput.value = labels.chapter;
    }
  }

  // 문제 유형
  if (labels.problemType) {
    const typeSelect = document.getElementById('refCategorySelect');
    if (typeSelect) {
      const typeOption = Array.from(typeSelect.options).find(
        opt => opt.text.includes(labels.problemType)
      );
      if (typeOption) {
        typeSelect.value = typeOption.value;
      }
    }
  }

  // 분류 결과 요약 표시
  const summaryHtml = `
    <div class="auto-label-result">
      <strong>🤖 AI 분류 결과:</strong>
      <span class="label-item">📚 ${labels.subject || '?'}</span>
      <span class="label-item">📖 ${labels.course || '?'}</span>
      <span class="label-item">📊 난이도: ${labels.difficulty || '?'}</span>
      <span class="label-item">⏱️ 예상 ${labels.estimatedTime || '?'}분</span>
      ${labels.concepts ? `<br><small>개념: ${labels.concepts.join(', ')}</small>` : ''}
    </div>
  `;

  // 기존 결과 제거 후 추가
  const existingResult = document.querySelector('.auto-label-result');
  if (existingResult) existingResult.remove();

  const metadataSection = document.getElementById('problemMetadataSection');
  if (metadataSection) {
    metadataSection.insertAdjacentHTML('beforeend', summaryHtml);
  }
}

/**
 * 다중 LLM 검토 실행
 */
async function runMultiLLMReview() {
  if (!currentVariationProblem) {
    showAlert('⚠️ 먼저 변형 문제를 생성해주세요.', 'error');
    return;
  }

  const reviewBtn = document.getElementById('reviewBtn');
  reviewBtn.disabled = true;
  reviewBtn.textContent = '🔍 검토 중...';

  try {
    const metadata = collectVariationMetadata();

    const response = await fetch('/api/multi-llm-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalProblem: extractedOCRText || '[이미지로 제공됨]',
        variationProblem: currentVariationProblem,
        metadata
      })
    });

    const data = await response.json();

    if (data.success) {
      currentReviewResult = data;
      displayReviewResult(data);
      showAlert('✅ AI 검토 완료!', 'success');
    } else {
      throw new Error(data.error || '검토 실패');
    }
  } catch (error) {
    console.error('검토 오류:', error);
    showAlert(`❌ 검토 오류: ${error.message}`, 'error');
  } finally {
    reviewBtn.disabled = false;
    reviewBtn.textContent = '🔍 AI 검토 요청';
  }
}

/**
 * 검토 결과 표시
 */
function displayReviewResult(data) {
  const reviewBox = document.getElementById('reviewResultBox');
  const scoreEl = document.getElementById('reviewScore');
  const recommendationEl = document.getElementById('reviewRecommendation');
  const accuracyEl = document.getElementById('accuracyReview');
  const pedagogyEl = document.getElementById('pedagogyReview');
  const qualityEl = document.getElementById('qualityReview');
  const approveBtn = document.getElementById('approveBtn');

  // 점수 표시
  const score = data.summary.averageScore;
  scoreEl.textContent = score;
  scoreEl.className = 'score-value ' + (score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low');

  // 권장 사항
  recommendationEl.textContent = data.summary.recommendation;
  recommendationEl.className = 'review-recommendation ' + (data.summary.isApproved ? 'approved' : 'rejected');

  // 상세 결과
  const { accuracy, pedagogy, quality } = data.reviews;

  accuracyEl.innerHTML = `
    <p>정확성: ${accuracy.isAccurate ? '✅ 통과' : '❌ 오류 발견'}
       <span class="score-badge ${accuracy.score >= 70 ? 'pass' : 'fail'}">${accuracy.score || '--'}점</span></p>
    ${accuracy.errors?.length ? `<p style="color:#c62828">오류: ${accuracy.errors.join(', ')}</p>` : ''}
  `;

  pedagogyEl.innerHTML = `
    <p>적합성: ${pedagogy.isAppropriate ? '✅ 적합' : '⚠️ 수정 필요'}
       <span class="score-badge ${pedagogy.score >= 70 ? 'pass' : 'fail'}">${pedagogy.score || '--'}점</span></p>
    <p>난이도: ${pedagogy.difficulty || '미확인'}</p>
    ${pedagogy.feedback?.length ? `<p>피드백: ${pedagogy.feedback.join(', ')}</p>` : ''}
  `;

  qualityEl.innerHTML = `
    <p>품질: <span class="score-badge ${quality.overallQuality >= 70 ? 'pass' : 'fail'}">${quality.overallQuality || '--'}점</span></p>
    <p>창의성: ${quality.creativity || '--'}점 | 완성도: ${quality.completeness || '--'}점</p>
    ${quality.improvements?.length ? `<p>개선점: ${quality.improvements.join(', ')}</p>` : ''}
  `;

  // 승인 버튼 표시 (검토 통과 시)
  approveBtn.style.display = data.summary.isApproved ? 'inline-block' : 'none';

  reviewBox.style.display = 'block';
}

/**
 * 상태와 함께 변형 문제 저장
 */
async function saveVariationWithStatus(status) {
  if (!currentVariationProblem) {
    showAlert('⚠️ 저장할 변형 문제가 없습니다.', 'error');
    return;
  }

  try {
    const metadata = collectVariationMetadata();

    const response = await fetch('/api/save-variation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalProblem: extractedOCRText || '[이미지 참조]',
        variationProblem: currentVariationProblem,
        solution: currentVariationSolution || '',
        metadata,
        reviewResult: currentReviewResult || null,
        status
      })
    });

    const data = await response.json();

    if (data.success) {
      const statusText = status === 'approved' ? '승인됨' : '검토 대기';
      showAlert(`✅ 변형 문제가 저장되었습니다! (상태: ${statusText})`, 'success');
    } else {
      throw new Error(data.error || '저장 실패');
    }
  } catch (error) {
    console.error('저장 오류:', error);
    showAlert(`❌ 저장 실패: ${error.message}`, 'error');
  }
}

// 현재 풀이 저장 변수
let currentVariationSolution = '';

// ============================================
// Phase 3: 고급 기능 - 영역 선택, 다중 문제, 대화형 수정
// ============================================

// 영역 선택 관련 변수
let regionCanvas = null;
let regionCtx = null;
let regionMode = 'problem'; // 'problem' | 'asset'
let isDrawing = false;
let startX, startY;
let problemRegions = [];
let assetRegions = [];
let currentRegionImage = null;

// 다중 문제 추출 관련 변수
let extractedProblems = [];
let pdfDocument = null;
let currentPdfPage = 1;
let totalPdfPages = 0;

// 대화형 수정 관련 변수
let chatHistory = [];
let originalProblemBeforeChat = '';
let modifiedProblemInChat = '';
let isChatProcessing = false;

// 엔진 규칙 관련 변수
const engineRules = {
  gradeLevel: {
    '초등학교 3학년': { maxComplexity: 2, allowedOperations: ['+', '-', '×'], maxDigits: 3 },
    '초등학교 4학년': { maxComplexity: 3, allowedOperations: ['+', '-', '×', '÷'], maxDigits: 4 },
    '초등학교 5학년': { maxComplexity: 4, allowedOperations: ['+', '-', '×', '÷', '분수'], maxDigits: 5 },
    '초등학교 6학년': { maxComplexity: 5, allowedOperations: ['+', '-', '×', '÷', '분수', '소수'], maxDigits: 6 },
    '중학교 1학년': { maxComplexity: 6, allowedOperations: ['all'], concepts: ['정수', '유리수', '방정식'] },
    '중학교 2학년': { maxComplexity: 7, allowedOperations: ['all'], concepts: ['일차함수', '연립방정식', '부등식'] },
    '중학교 3학년': { maxComplexity: 8, allowedOperations: ['all'], concepts: ['이차방정식', '이차함수', '피타고라스'] },
    '고등학교 1학년': { maxComplexity: 9, allowedOperations: ['all'], concepts: ['집합', '명제', '함수'] },
    '고등학교 2학년': { maxComplexity: 10, allowedOperations: ['all'], concepts: ['미분', '적분', '확률'] },
    '고등학교 3학년': { maxComplexity: 10, allowedOperations: ['all'], concepts: ['고급미적분', '기하벡터'] }
  },
  categoryRules: {
    '계산': { requiresNumericAnswer: true, maxSteps: 5 },
    '도형': { requiresDiagram: true, concepts: ['넓이', '둘레', '부피', '각도'] },
    '문장제': { requiresContext: true, minWordCount: 20 },
    '증명': { requiresLogicalSteps: true, minSteps: 3 },
    '그래프': { requiresVisualization: true, dataTypes: ['좌표', '함수', '통계'] }
  }
};

// 자료(에셋) 관련 변수
let problemAssets = [];

/**
 * ============================
 * 영역 선택 기능 (Region Selection)
 * ============================
 */

// 영역 선택 모달 열기
function openRegionSelectModal() {
  const modal = document.getElementById('regionSelectModal');
  if (!modal) {
    showAlert('⚠️ 영역 선택 모달을 찾을 수 없습니다.', 'error');
    return;
  }

  // 현재 업로드된 이미지 가져오기
  const preview = document.getElementById('imagePreview');
  const img = preview?.querySelector('img');

  if (!img || !img.src) {
    showAlert('⚠️ 먼저 이미지를 업로드해주세요.', 'error');
    return;
  }

  modal.style.display = 'flex';
  initRegionCanvas(img.src);
}

// 영역 선택 모달 닫기
function closeRegionModal() {
  const modal = document.getElementById('regionSelectModal');
  if (modal) {
    modal.style.display = 'none';
  }
  // 캔버스 정리
  problemRegions = [];
  assetRegions = [];
  updateRegionInfo();
}

// 캔버스 초기화
function initRegionCanvas(imageSrc) {
  const canvasContainer = document.getElementById('regionCanvasContainer');
  if (!canvasContainer) return;

  // 기존 캔버스 제거
  canvasContainer.innerHTML = '';

  // 새 캔버스 생성
  regionCanvas = document.createElement('canvas');
  regionCanvas.id = 'regionCanvas';
  regionCanvas.style.cursor = 'crosshair';
  canvasContainer.appendChild(regionCanvas);

  regionCtx = regionCanvas.getContext('2d');

  // 이미지 로드
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    currentRegionImage = img;

    // 캔버스 크기 설정 (컨테이너에 맞게 조정)
    const maxWidth = canvasContainer.clientWidth - 20;
    const maxHeight = 600;
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);

    regionCanvas.width = img.width * scale;
    regionCanvas.height = img.height * scale;
    regionCanvas.dataset.scale = scale;

    // 이미지 그리기
    regionCtx.drawImage(img, 0, 0, regionCanvas.width, regionCanvas.height);

    // 이벤트 리스너 추가
    regionCanvas.addEventListener('mousedown', startDrawRegion);
    regionCanvas.addEventListener('mousemove', drawRegion);
    regionCanvas.addEventListener('mouseup', endDrawRegion);
    regionCanvas.addEventListener('mouseleave', endDrawRegion);
  };
  img.src = imageSrc;
}

// 영역 그리기 시작
function startDrawRegion(e) {
  const rect = regionCanvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  isDrawing = true;
}

// 영역 그리기
function drawRegion(e) {
  if (!isDrawing) return;

  const rect = regionCanvas.getBoundingClientRect();
  const currentX = e.clientX - rect.left;
  const currentY = e.clientY - rect.top;

  // 캔버스 다시 그리기
  redrawCanvas();

  // 현재 그리는 사각형 표시
  regionCtx.strokeStyle = regionMode === 'problem' ? '#2196F3' : '#FF9800';
  regionCtx.lineWidth = 2;
  regionCtx.setLineDash([5, 5]);
  regionCtx.strokeRect(startX, startY, currentX - startX, currentY - startY);
  regionCtx.setLineDash([]);
}

// 영역 그리기 끝
function endDrawRegion(e) {
  if (!isDrawing) return;
  isDrawing = false;

  const rect = regionCanvas.getBoundingClientRect();
  const endX = e.clientX - rect.left;
  const endY = e.clientY - rect.top;

  // 최소 크기 확인
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  if (width < 20 || height < 20) return;

  // 영역 저장
  const region = {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: width,
    height: height,
    id: Date.now()
  };

  if (regionMode === 'problem') {
    problemRegions.push(region);
  } else {
    assetRegions.push(region);
  }

  redrawCanvas();
  updateRegionInfo();
}

// 캔버스 다시 그리기
function redrawCanvas() {
  if (!regionCtx || !currentRegionImage) return;

  // 이미지 다시 그리기
  regionCtx.drawImage(currentRegionImage, 0, 0, regionCanvas.width, regionCanvas.height);

  // 문제 영역 그리기 (파란색)
  regionCtx.strokeStyle = '#2196F3';
  regionCtx.fillStyle = 'rgba(33, 150, 243, 0.2)';
  regionCtx.lineWidth = 2;
  problemRegions.forEach((r, i) => {
    regionCtx.fillRect(r.x, r.y, r.width, r.height);
    regionCtx.strokeRect(r.x, r.y, r.width, r.height);
    regionCtx.fillStyle = '#2196F3';
    regionCtx.font = 'bold 14px Arial';
    regionCtx.fillText(`문제 ${i + 1}`, r.x + 5, r.y + 18);
    regionCtx.fillStyle = 'rgba(33, 150, 243, 0.2)';
  });

  // 자료 영역 그리기 (주황색)
  regionCtx.strokeStyle = '#FF9800';
  regionCtx.fillStyle = 'rgba(255, 152, 0, 0.2)';
  assetRegions.forEach((r, i) => {
    regionCtx.fillRect(r.x, r.y, r.width, r.height);
    regionCtx.strokeRect(r.x, r.y, r.width, r.height);
    regionCtx.fillStyle = '#FF9800';
    regionCtx.font = 'bold 14px Arial';
    regionCtx.fillText(`자료 ${i + 1}`, r.x + 5, r.y + 18);
    regionCtx.fillStyle = 'rgba(255, 152, 0, 0.2)';
  });
}

// 영역 정보 업데이트
function updateRegionInfo() {
  const infoEl = document.getElementById('regionInfo');
  if (infoEl) {
    infoEl.textContent = `문제 영역: ${problemRegions.length}개 | 자료 영역: ${assetRegions.length}개`;
  }
}

// 영역 모드 설정
function setRegionMode(mode) {
  regionMode = mode;

  // 버튼 스타일 업데이트
  document.querySelectorAll('.region-toolbar .btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  showAlert(`📐 ${mode === 'problem' ? '문제' : '자료'} 영역 선택 모드`, 'info');
}

// 모든 영역 지우기
function clearAllRegions() {
  problemRegions = [];
  assetRegions = [];
  redrawCanvas();
  updateRegionInfo();
  showAlert('🗑️ 모든 영역이 삭제되었습니다.', 'info');
}

// 영역 자동 감지
async function autoDetectRegions() {
  if (!currentRegionImage) {
    showAlert('⚠️ 이미지를 먼저 로드해주세요.', 'error');
    return;
  }

  showAlert('🔍 AI가 영역을 자동 감지 중...', 'info');

  try {
    // 캔버스에서 이미지 데이터 추출
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentRegionImage.width;
    tempCanvas.height = currentRegionImage.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(currentRegionImage, 0, 0);
    const imageData = tempCanvas.toDataURL('image/png');

    const response = await fetch('/api/detect-regions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData })
    });

    const data = await response.json();

    if (data.success && data.regions) {
      const scale = parseFloat(regionCanvas.dataset.scale) || 1;

      // 감지된 영역 적용
      if (data.regions.problems) {
        problemRegions = data.regions.problems.map(r => ({
          x: r.x * scale,
          y: r.y * scale,
          width: r.width * scale,
          height: r.height * scale,
          id: Date.now() + Math.random()
        }));
      }

      if (data.regions.assets) {
        assetRegions = data.regions.assets.map(r => ({
          x: r.x * scale,
          y: r.y * scale,
          width: r.width * scale,
          height: r.height * scale,
          id: Date.now() + Math.random()
        }));
      }

      redrawCanvas();
      updateRegionInfo();
      showAlert(`✅ 자동 감지 완료! 문제: ${problemRegions.length}개, 자료: ${assetRegions.length}개`, 'success');
    } else {
      throw new Error(data.error || '영역 감지 실패');
    }
  } catch (error) {
    console.error('영역 자동 감지 오류:', error);
    showAlert(`❌ 자동 감지 실패: ${error.message}`, 'error');
  }
}

// 영역 적용
async function applyRegions() {
  if (problemRegions.length === 0) {
    showAlert('⚠️ 적어도 하나의 문제 영역을 선택해주세요.', 'error');
    return;
  }

  showAlert('🔄 선택된 영역을 처리 중...', 'info');

  try {
    const scale = parseFloat(regionCanvas.dataset.scale) || 1;

    // 각 영역의 이미지 추출
    const extractedRegions = [];

    for (let i = 0; i < problemRegions.length; i++) {
      const r = problemRegions[i];
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = r.width / scale;
      tempCanvas.height = r.height / scale;
      const tempCtx = tempCanvas.getContext('2d');

      tempCtx.drawImage(
        currentRegionImage,
        r.x / scale, r.y / scale, r.width / scale, r.height / scale,
        0, 0, tempCanvas.width, tempCanvas.height
      );

      const regionImage = tempCanvas.toDataURL('image/png');

      // 연결된 자료 영역 찾기
      const relatedAssets = assetRegions.filter(asset => {
        // 문제 영역과 겹치거나 근접한 자료 영역
        const overlap = !(asset.x > r.x + r.width || asset.x + asset.width < r.x ||
                         asset.y > r.y + r.height + 100 || asset.y + asset.height < r.y - 100);
        return overlap;
      });

      extractedRegions.push({
        problemImage: regionImage,
        assets: relatedAssets.map(a => {
          const assetCanvas = document.createElement('canvas');
          assetCanvas.width = a.width / scale;
          assetCanvas.height = a.height / scale;
          const assetCtx = assetCanvas.getContext('2d');
          assetCtx.drawImage(
            currentRegionImage,
            a.x / scale, a.y / scale, a.width / scale, a.height / scale,
            0, 0, assetCanvas.width, assetCanvas.height
          );
          return assetCanvas.toDataURL('image/png');
        }),
        index: i + 1
      });
    }

    // 다중 문제 모달로 전달
    extractedProblems = extractedRegions;
    closeRegionModal();
    openMultiProblemModal();

    showAlert(`✅ ${extractedRegions.length}개의 문제 영역이 추출되었습니다.`, 'success');
  } catch (error) {
    console.error('영역 적용 오류:', error);
    showAlert(`❌ 영역 적용 실패: ${error.message}`, 'error');
  }
}

/**
 * ============================
 * 다중 문제 추출 기능 (Multi-Problem Extraction)
 * ============================
 */

// 다중 문제 모달 열기
function openMultiProblemModal() {
  const modal = document.getElementById('multiProblemModal');
  if (!modal) {
    showAlert('⚠️ 다중 문제 모달을 찾을 수 없습니다.', 'error');
    return;
  }

  modal.style.display = 'flex';
  renderExtractedProblems();
}

// 다중 문제 모달 닫기
function closeMultiProblemModal() {
  const modal = document.getElementById('multiProblemModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 추출된 문제 목록 렌더링
function renderExtractedProblems() {
  const container = document.getElementById('extractedProblemsList');
  if (!container) return;

  if (extractedProblems.length === 0) {
    container.innerHTML = '<p class="no-problems">추출된 문제가 없습니다. 영역 선택 또는 자동 추출을 사용해주세요.</p>';
    return;
  }

  container.innerHTML = extractedProblems.map((problem, idx) => `
    <div class="extracted-problem-item" data-index="${idx}">
      <div class="problem-preview">
        <img src="${problem.problemImage}" alt="문제 ${idx + 1}" />
        ${problem.assets && problem.assets.length > 0 ? `
          <div class="asset-thumbnails">
            ${problem.assets.map((asset, aidx) => `
              <img src="${asset}" alt="자료 ${aidx + 1}" class="asset-thumb" />
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div class="problem-info">
        <h4>문제 ${idx + 1}</h4>
        <p class="ocr-preview">${problem.ocrText || '(OCR 대기 중...)'}</p>
        <div class="problem-actions">
          <button class="btn btn-sm btn-primary" onclick="extractSingleProblem(${idx})">
            📝 OCR 추출
          </button>
          <button class="btn btn-sm btn-secondary" onclick="editProblemRegion(${idx})">
            ✏️ 수정
          </button>
          <button class="btn btn-sm btn-danger" onclick="removeProblem(${idx})">
            🗑️ 삭제
          </button>
        </div>
      </div>
      <div class="problem-labels">
        <select class="grade-select" onchange="updateProblemLabel(${idx}, 'grade', this.value)">
          <option value="">학년 선택</option>
          <option value="초등학교 3학년">초3</option>
          <option value="초등학교 4학년">초4</option>
          <option value="초등학교 5학년">초5</option>
          <option value="초등학교 6학년">초6</option>
          <option value="중학교 1학년">중1</option>
          <option value="중학교 2학년">중2</option>
          <option value="중학교 3학년">중3</option>
          <option value="고등학교 1학년">고1</option>
          <option value="고등학교 2학년">고2</option>
          <option value="고등학교 3학년">고3</option>
        </select>
        <select class="category-select" onchange="updateProblemLabel(${idx}, 'category', this.value)">
          <option value="">유형 선택</option>
          <option value="계산">계산</option>
          <option value="도형">도형</option>
          <option value="문장제">문장제</option>
          <option value="함수">함수</option>
          <option value="확률통계">확률통계</option>
        </select>
      </div>
    </div>
  `).join('');
}

// 개별 문제 OCR 추출
async function extractSingleProblem(index) {
  const problem = extractedProblems[index];
  if (!problem) return;

  showAlert(`🔍 문제 ${index + 1} OCR 추출 중...`, 'info');

  try {
    const response = await fetch('/api/extract-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: problem.problemImage })
    });

    const data = await response.json();

    if (data.success) {
      extractedProblems[index].ocrText = data.text;
      renderExtractedProblems();
      showAlert(`✅ 문제 ${index + 1} OCR 완료!`, 'success');
    } else {
      throw new Error(data.error || 'OCR 실패');
    }
  } catch (error) {
    console.error('OCR 오류:', error);
    showAlert(`❌ OCR 실패: ${error.message}`, 'error');
  }
}

// 문제 라벨 업데이트
function updateProblemLabel(index, field, value) {
  if (extractedProblems[index]) {
    if (!extractedProblems[index].labels) {
      extractedProblems[index].labels = {};
    }
    extractedProblems[index].labels[field] = value;
  }
}

// 문제 삭제
function removeProblem(index) {
  if (confirm(`문제 ${index + 1}을(를) 삭제하시겠습니까?`)) {
    extractedProblems.splice(index, 1);
    renderExtractedProblems();
    showAlert('🗑️ 문제가 삭제되었습니다.', 'info');
  }
}

// 모든 문제 OCR 추출
async function extractAllProblems() {
  if (extractedProblems.length === 0) {
    showAlert('⚠️ 추출할 문제가 없습니다.', 'error');
    return;
  }

  showAlert(`🔄 ${extractedProblems.length}개 문제 OCR 추출 중...`, 'info');

  let successCount = 0;

  for (let i = 0; i < extractedProblems.length; i++) {
    try {
      await extractSingleProblem(i);
      successCount++;
    } catch (error) {
      console.error(`문제 ${i + 1} 추출 실패:`, error);
    }
  }

  showAlert(`✅ ${successCount}/${extractedProblems.length}개 문제 OCR 완료!`, 'success');
}

// 추출된 문제 적용
async function applyExtractedProblems() {
  const problemsWithOCR = extractedProblems.filter(p => p.ocrText);

  if (problemsWithOCR.length === 0) {
    showAlert('⚠️ OCR 추출된 문제가 없습니다. 먼저 OCR을 실행해주세요.', 'error');
    return;
  }

  // 첫 번째 문제를 현재 작업 문제로 설정
  const firstProblem = problemsWithOCR[0];

  // OCR 텍스트 표시
  extractedOCRText = firstProblem.ocrText;
  document.getElementById('extractedText').textContent = extractedOCRText;
  document.getElementById('ocrResult').style.display = 'block';

  // 라벨 적용
  if (firstProblem.labels) {
    if (firstProblem.labels.grade) {
      document.getElementById('refGradeSelect').value = firstProblem.labels.grade;
    }
    if (firstProblem.labels.category) {
      document.getElementById('refCategorySelect').value = firstProblem.labels.category;
    }
  }

  // 자료 저장
  if (firstProblem.assets && firstProblem.assets.length > 0) {
    problemAssets = firstProblem.assets;
    showAlert(`📎 ${problemAssets.length}개의 자료가 연결되었습니다.`, 'info');
  }

  closeMultiProblemModal();
  showAlert('✅ 문제가 적용되었습니다. 변형 생성을 진행해주세요.', 'success');

  // 나머지 문제는 대기열에 저장
  if (problemsWithOCR.length > 1) {
    localStorage.setItem('pendingProblems', JSON.stringify(problemsWithOCR.slice(1)));
    showAlert(`📋 ${problemsWithOCR.length - 1}개의 추가 문제가 대기열에 저장되었습니다.`, 'info');
  }
}

/**
 * ============================
 * 대화형 수정 기능 (Chat Edit)
 * ============================
 */

// 대화형 수정 모달 열기
function openChatEditModal() {
  if (!currentVariationProblem) {
    showAlert('⚠️ 먼저 변형 문제를 생성해주세요.', 'error');
    return;
  }

  const modal = document.getElementById('chatEditModal');
  if (!modal) {
    showAlert('⚠️ 대화형 수정 모달을 찾을 수 없습니다.', 'error');
    return;
  }

  // 원본 저장
  originalProblemBeforeChat = currentVariationProblem;
  modifiedProblemInChat = currentVariationProblem;

  // 현재 문제(원본) 표시
  const currentProblemEl = document.getElementById('chatCurrentProblem');
  if (currentProblemEl) {
    currentProblemEl.innerHTML = renderMathContent(originalProblemBeforeChat);
  }

  // 수정된 문제 영역 초기화
  const modifiedProblemEl = document.getElementById('chatModifiedProblem');
  if (modifiedProblemEl) {
    modifiedProblemEl.innerHTML = '<p class="placeholder-text">💡 수정 요청을 입력하면 여기에 수정된 문제가 표시됩니다.</p>';
  }

  // 채팅 히스토리 초기화
  chatHistory = [];
  isChatProcessing = false;
  updateChatMessages();

  // Enter 키 이벤트 리스너 추가
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.value = '';
    chatInput.removeEventListener('keydown', handleChatKeyDown);
    chatInput.addEventListener('keydown', handleChatKeyDown);
    setTimeout(() => chatInput.focus(), 100);
  }

  modal.style.display = 'flex';
}

// 채팅 입력 키 이벤트 핸들러
function handleChatKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

// 대화형 수정 모달 닫기
function closeChatEditModal() {
  const modal = document.getElementById('chatEditModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 채팅 메시지 전송
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();

  if (!message || isChatProcessing) return;

  // 사용자 메시지 추가
  chatHistory.push({ role: 'user', content: message });
  input.value = '';
  updateChatMessages();

  // 로딩 상태 표시
  isChatProcessing = true;
  addChatLoadingIndicator();
  setChatInputState(false);

  // AI 응답 요청
  try {
    const response = await fetch('/api/chat-modify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem: modifiedProblemInChat,
        message: message,
        history: chatHistory.filter(m => m.role !== 'loading')
      })
    });

    const data = await response.json();

    // 로딩 인디케이터 제거
    removeChatLoadingIndicator();

    if (data.success) {
      // AI 응답 추가
      chatHistory.push({
        role: 'assistant',
        content: data.response,
        hasModification: !!data.modifiedProblem
      });

      // 수정된 문제가 있으면 업데이트
      if (data.modifiedProblem) {
        modifiedProblemInChat = data.modifiedProblem;
        updateModifiedProblemPreview();
      }

      updateChatMessages();
    } else {
      throw new Error(data.error || '응답 실패');
    }
  } catch (error) {
    console.error('채팅 오류:', error);
    removeChatLoadingIndicator();
    chatHistory.push({
      role: 'assistant',
      content: `❌ 오류가 발생했습니다: ${error.message}`,
      isError: true
    });
    updateChatMessages();
  } finally {
    isChatProcessing = false;
    setChatInputState(true);
  }
}

// 채팅 로딩 인디케이터 추가
function addChatLoadingIndicator() {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'chatLoadingIndicator';
  loadingDiv.className = 'chat-message assistant loading';
  loadingDiv.innerHTML = `
    <div class="message-avatar">🤖</div>
    <div class="message-content">
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  container.appendChild(loadingDiv);
  container.scrollTop = container.scrollHeight;
}

// 채팅 로딩 인디케이터 제거
function removeChatLoadingIndicator() {
  const indicator = document.getElementById('chatLoadingIndicator');
  if (indicator) {
    indicator.remove();
  }
}

// 채팅 입력 상태 설정
function setChatInputState(enabled) {
  const input = document.getElementById('chatInput');
  const sendBtn = document.querySelector('.chat-input-area .btn-primary');

  if (input) {
    input.disabled = !enabled;
    if (enabled) {
      input.focus();
    }
  }
  if (sendBtn) {
    sendBtn.disabled = !enabled;
    sendBtn.textContent = enabled ? '📤 전송' : '⏳ 처리중...';
  }
}

// 수정된 문제 미리보기 업데이트
function updateModifiedProblemPreview() {
  const modifiedEl = document.getElementById('chatModifiedProblem');
  if (!modifiedEl) return;

  // 원본과 비교하여 변경 여부 표시
  const hasChanges = originalProblemBeforeChat !== modifiedProblemInChat;

  modifiedEl.innerHTML = `
    ${hasChanges ? '<div class="modification-badge">✏️ 수정됨</div>' : ''}
    <div class="modified-problem-content">${renderMathContent(modifiedProblemInChat)}</div>
    ${hasChanges ? `
      <div class="diff-toggle">
        <button class="btn btn-small btn-outline" onclick="toggleDiffView()">📊 변경사항 보기</button>
      </div>
    ` : ''}
  `;
}

// 채팅 메시지 목록 업데이트
function updateChatMessages() {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  if (chatHistory.length === 0) {
    container.innerHTML = `
      <div class="chat-welcome">
        <p>💬 수정하고 싶은 부분을 자유롭게 요청해보세요!</p>
        <div class="chat-suggestions">
          <button class="suggestion-chip" onclick="applyChatSuggestion('난이도를 높여주세요')">🔼 난이도 높이기</button>
          <button class="suggestion-chip" onclick="applyChatSuggestion('숫자를 다른 값으로 변경해주세요')">🔢 숫자 변경</button>
          <button class="suggestion-chip" onclick="applyChatSuggestion('보기의 순서를 바꿔주세요')">🔄 보기 순서 변경</button>
          <button class="suggestion-chip" onclick="applyChatSuggestion('문제를 더 명확하게 다듬어주세요')">✨ 문장 다듬기</button>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = chatHistory.map((msg, idx) => {
    const isError = msg.isError;
    const hasModification = msg.hasModification;

    return `
      <div class="chat-message ${msg.role}${isError ? ' error' : ''}${hasModification ? ' has-modification' : ''}">
        <div class="message-avatar">${msg.role === 'user' ? '👤' : '🤖'}</div>
        <div class="message-content">
          ${renderMathContent(msg.content)}
          ${hasModification ? '<span class="modification-indicator">✏️ 문제가 수정되었습니다</span>' : ''}
        </div>
      </div>
    `;
  }).join('');

  // 스크롤 맨 아래로
  container.scrollTop = container.scrollHeight;
}

// 채팅 제안 적용
function applyChatSuggestion(suggestion) {
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = suggestion;
    input.focus();
  }
}

// 대화형 수정 적용
function applyChatChanges() {
  if (originalProblemBeforeChat === modifiedProblemInChat) {
    showAlert('ℹ️ 변경된 내용이 없습니다.', 'info');
    closeChatEditModal();
    return;
  }

  // 메인 화면에 변경된 문제 적용
  currentVariationProblem = modifiedProblemInChat;
  displayVariationResult({ problem: currentVariationProblem });
  closeChatEditModal();
  showAlert('✅ 수정된 문제가 적용되었습니다.', 'success');
}

// 변경 사항 되돌리기
function revertChanges() {
  if (originalProblemBeforeChat) {
    modifiedProblemInChat = originalProblemBeforeChat;
    updateModifiedProblemPreview();

    // 되돌림 메시지 추가
    chatHistory.push({
      role: 'assistant',
      content: '↩️ 문제가 원래 상태로 되돌려졌습니다.',
      isSystem: true
    });
    updateChatMessages();
    showAlert('↩️ 원래 문제로 되돌렸습니다.', 'info');
  }
}

// 변경사항 비교 보기 토글
function toggleDiffView() {
  const modifiedEl = document.getElementById('chatModifiedProblem');
  if (!modifiedEl) return;

  const existingDiff = modifiedEl.querySelector('.diff-view');
  if (existingDiff) {
    existingDiff.remove();
    return;
  }

  // 간단한 diff 표시 (원본 vs 수정본)
  const diffHtml = `
    <div class="diff-view">
      <div class="diff-section original">
        <h5>📋 원본</h5>
        <div class="diff-content">${renderMathContent(originalProblemBeforeChat)}</div>
      </div>
      <div class="diff-section modified">
        <h5>✏️ 수정본</h5>
        <div class="diff-content">${renderMathContent(modifiedProblemInChat)}</div>
      </div>
    </div>
  `;

  modifiedEl.insertAdjacentHTML('beforeend', diffHtml);
}

/**
 * ============================
 * 라벨 수정 기능 (Label Edit)
 * ============================
 */

// 라벨 수정 모달 열기
function openLabelEditModal() {
  const modal = document.getElementById('labelEditModal');
  if (!modal) {
    showAlert('⚠️ 라벨 수정 모달을 찾을 수 없습니다.', 'error');
    return;
  }

  // 현재 값 로드
  const currentLabels = collectVariationMetadata();

  // HTML ID와 일치하도록 수정
  const subjectEl = document.getElementById('editLabelSubject');
  const courseEl = document.getElementById('editLabelCourse');
  const gradeEl = document.getElementById('editLabelGrade');
  const chapterEl = document.getElementById('editLabelChapter');
  const difficultyEl = document.getElementById('editLabelDifficulty');
  const conceptsEl = document.getElementById('editLabelConcepts');

  if (subjectEl) subjectEl.value = currentLabels.subject || '수학';
  if (courseEl) courseEl.value = currentLabels.course || '';
  if (gradeEl) gradeEl.value = currentLabels.grade || '고등학교 1학년';
  if (chapterEl) chapterEl.value = currentLabels.chapter || '';
  if (difficultyEl) difficultyEl.value = currentLabels.difficulty || '중';
  if (conceptsEl) conceptsEl.value = currentLabels.concepts || '';

  modal.style.display = 'flex';
}

// 라벨 수정 모달 닫기
function closeLabelEditModal() {
  const modal = document.getElementById('labelEditModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 라벨 저장
function saveLabelEdit() {
  // HTML ID와 일치하도록 수정
  const subject = document.getElementById('editLabelSubject')?.value || '';
  const course = document.getElementById('editLabelCourse')?.value || '';
  const grade = document.getElementById('editLabelGrade')?.value || '';
  const chapter = document.getElementById('editLabelChapter')?.value || '';
  const difficulty = document.getElementById('editLabelDifficulty')?.value || '';
  const concepts = document.getElementById('editLabelConcepts')?.value || '';

  // 메인 폼에 값 적용 (해당 요소가 있는 경우)
  const gradeSelect = document.getElementById('gradeSelect');
  if (gradeSelect) {
    // 학년 형식 변환 (고등학교 1학년 → 고1)
    const gradeMap = {
      '고등학교 1학년': '고1',
      '고등학교 2학년': '고2',
      '고등학교 3학년': '고3',
      '중학교 1학년': '중1',
      '중학교 2학년': '중2',
      '중학교 3학년': '중3'
    };
    gradeSelect.value = gradeMap[grade] || grade;
  }

  const chapterInput = document.getElementById('refChapterInput');
  if (chapterInput) {
    chapterInput.value = chapter;
  }

  // 로컬 저장 (메인 폼에 없는 값 포함)
  const editedLabels = {
    subject,
    course,
    grade,
    chapter,
    difficulty,
    concepts: concepts.split(',').map(c => c.trim()).filter(c => c)
  };

  localStorage.setItem('currentProblemLabels', JSON.stringify(editedLabels));

  closeLabelEditModal();
  showAlert('✅ 라벨이 수정되었습니다.', 'success');
}

/**
 * ============================
 * 엔진 규칙 검사 기능 (Engine Rules)
 * ============================
 */

// 엔진 규칙 검사
async function checkEngineRules() {
  if (!currentVariationProblem) {
    showAlert('⚠️ 먼저 변형 문제를 생성해주세요.', 'error');
    return;
  }

  showAlert('⚙️ 엔진 규칙 검사 중...', 'info');

  try {
    const metadata = collectVariationMetadata();

    const response = await fetch('/api/check-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem: currentVariationProblem,
        metadata
      })
    });

    const data = await response.json();

    if (data.success) {
      if (data.violations && data.violations.length > 0) {
        displayRuleViolations(data.violations, data.suggestions);
      } else {
        showAlert('✅ 모든 엔진 규칙을 통과했습니다!', 'success');
      }
    } else {
      throw new Error(data.error || '규칙 검사 실패');
    }
  } catch (error) {
    console.error('규칙 검사 오류:', error);

    // 클라이언트 측 기본 검사
    const violations = performLocalRuleCheck();
    if (violations.length > 0) {
      displayRuleViolations(violations, []);
    } else {
      showAlert('✅ 기본 규칙 검사 통과!', 'success');
    }
  }
}

// 클라이언트 측 기본 규칙 검사
function performLocalRuleCheck() {
  const violations = [];
  const metadata = collectVariationMetadata();
  const problem = currentVariationProblem;

  // 학년별 규칙 검사
  const gradeRules = engineRules.gradeLevel[metadata.grade];
  if (gradeRules) {
    // 초등학교인 경우 복잡한 수식 검사
    if (metadata.grade.includes('초등학교')) {
      if (problem.includes('\\int') || problem.includes('\\lim') || problem.includes('\\sum')) {
        violations.push({
          rule: '학년 수준',
          message: `${metadata.grade}에 적합하지 않은 고급 수학 개념이 포함되어 있습니다.`,
          severity: 'error'
        });
      }
    }
  }

  // 유형별 규칙 검사
  const categoryRules = engineRules.categoryRules[metadata.category];
  if (categoryRules) {
    if (categoryRules.requiresDiagram && !problem.includes('그림') && !problem.includes('도형')) {
      violations.push({
        rule: '도형 문제 요구사항',
        message: '도형 문제에는 그림이나 도형에 대한 설명이 필요합니다.',
        severity: 'warning'
      });
    }

    if (categoryRules.minWordCount && problem.length < categoryRules.minWordCount * 3) {
      violations.push({
        rule: '문장제 최소 길이',
        message: `문장제 문제는 최소 ${categoryRules.minWordCount}단어 이상이어야 합니다.`,
        severity: 'warning'
      });
    }
  }

  return violations;
}

// 규칙 위반 표시
function displayRuleViolations(violations, suggestions) {
  const modal = document.getElementById('ruleViolationModal');
  const list = document.getElementById('violationList');

  if (!modal || !list) return;

  list.innerHTML = violations.map(v => `
    <div class="violation-item ${v.severity}">
      <span class="violation-icon">${v.severity === 'error' ? '❌' : '⚠️'}</span>
      <div class="violation-content">
        <strong>${v.rule}</strong>
        <p>${v.message}</p>
      </div>
    </div>
  `).join('');

  // 자동 수정 제안이 있으면 버튼 활성화
  const autoFixBtn = document.getElementById('autoFixBtn');
  if (autoFixBtn) {
    autoFixBtn.disabled = !suggestions || suggestions.length === 0;
    autoFixBtn.dataset.suggestions = JSON.stringify(suggestions || []);
  }

  modal.style.display = 'flex';
}

// 규칙 위반 모달 닫기
function closeRuleViolationModal() {
  const modal = document.getElementById('ruleViolationModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 자동 수정
async function autoFixViolations() {
  const autoFixBtn = document.getElementById('autoFixBtn');
  const suggestions = JSON.parse(autoFixBtn.dataset.suggestions || '[]');

  if (suggestions.length === 0) {
    showAlert('⚠️ 자동 수정 제안이 없습니다.', 'error');
    return;
  }

  showAlert('🔧 자동 수정 중...', 'info');

  try {
    const response = await fetch('/api/auto-fix-problem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem: currentVariationProblem,
        suggestions: suggestions,
        metadata: collectVariationMetadata()
      })
    });

    const data = await response.json();

    if (data.success && data.fixedProblem) {
      currentVariationProblem = data.fixedProblem;
      displayVariationResult({ problem: currentVariationProblem });
      closeRuleViolationModal();
      showAlert('✅ 문제가 자동 수정되었습니다!', 'success');
    } else {
      throw new Error(data.error || '자동 수정 실패');
    }
  } catch (error) {
    console.error('자동 수정 오류:', error);
    showAlert(`❌ 자동 수정 실패: ${error.message}`, 'error');
  }
}

// 위반 무시
function ignoreViolations() {
  closeRuleViolationModal();
  showAlert('⚠️ 규칙 위반이 무시되었습니다. 문제 품질을 확인해주세요.', 'warning');
}

/**
 * ============================
 * 자료 관리 기능 (Asset Manager)
 * ============================
 */

// 자료 관리 모달 열기
function openAssetManagerModal() {
  const modal = document.getElementById('assetManagerModal');
  if (!modal) {
    showAlert('⚠️ 자료 관리 모달을 찾을 수 없습니다.', 'error');
    return;
  }

  modal.style.display = 'flex';
  renderAssetGrid();
}

// 자료 관리 모달 닫기
function closeAssetManagerModal() {
  const modal = document.getElementById('assetManagerModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// 자료 그리드 렌더링
function renderAssetGrid() {
  const grid = document.getElementById('assetGrid');
  if (!grid) return;

  if (problemAssets.length === 0) {
    grid.innerHTML = '<p class="no-assets">연결된 자료가 없습니다. 영역 선택에서 자료 영역을 지정하거나 새 자료를 추가하세요.</p>';
    return;
  }

  grid.innerHTML = problemAssets.map((asset, idx) => `
    <div class="asset-card" data-index="${idx}">
      <div class="asset-preview">
        <img src="${asset.data || asset}" alt="자료 ${idx + 1}" />
      </div>
      <div class="asset-info">
        <input type="text" class="asset-label" placeholder="자료 설명"
               value="${asset.label || ''}"
               onchange="updateAssetLabel(${idx}, this.value)" />
        <select class="asset-type" onchange="updateAssetType(${idx}, this.value)">
          <option value="image" ${asset.type === 'image' ? 'selected' : ''}>이미지</option>
          <option value="graph" ${asset.type === 'graph' ? 'selected' : ''}>그래프</option>
          <option value="table" ${asset.type === 'table' ? 'selected' : ''}>표</option>
          <option value="diagram" ${asset.type === 'diagram' ? 'selected' : ''}>도형</option>
        </select>
        <button class="btn btn-sm btn-danger" onclick="removeAsset(${idx})">🗑️ 삭제</button>
      </div>
    </div>
  `).join('');
}

// 자료 라벨 업데이트
function updateAssetLabel(index, label) {
  if (typeof problemAssets[index] === 'string') {
    problemAssets[index] = { data: problemAssets[index], label: label, type: 'image' };
  } else {
    problemAssets[index].label = label;
  }
}

// 자료 유형 업데이트
function updateAssetType(index, type) {
  if (typeof problemAssets[index] === 'string') {
    problemAssets[index] = { data: problemAssets[index], label: '', type: type };
  } else {
    problemAssets[index].type = type;
  }
}

// 자료 삭제
function removeAsset(index) {
  if (confirm(`자료 ${index + 1}을(를) 삭제하시겠습니까?`)) {
    problemAssets.splice(index, 1);
    renderAssetGrid();
    showAlert('🗑️ 자료가 삭제되었습니다.', 'info');
  }
}

// 새 자료 추가
function addNewAsset() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      problemAssets.push({
        data: event.target.result,
        label: file.name,
        type: 'image'
      });
      renderAssetGrid();
      showAlert('📎 새 자료가 추가되었습니다.', 'success');
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// 모든 자료 저장
async function saveAllAssets() {
  if (problemAssets.length === 0) {
    showAlert('⚠️ 저장할 자료가 없습니다.', 'error');
    return;
  }

  showAlert('💾 자료 저장 중...', 'info');

  try {
    const response = await fetch('/api/save-assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assets: problemAssets,
        problemId: currentVariationProblem ? `var_${Date.now()}` : `ref_${Date.now()}`
      })
    });

    const data = await response.json();

    if (data.success) {
      closeAssetManagerModal();
      showAlert(`✅ ${problemAssets.length}개의 자료가 저장되었습니다.`, 'success');
    } else {
      throw new Error(data.error || '저장 실패');
    }
  } catch (error) {
    console.error('자료 저장 오류:', error);
    showAlert(`❌ 자료 저장 실패: ${error.message}`, 'error');
  }
}

/**
 * ============================
 * PDF 다중 페이지 처리
 * ============================
 */

// PDF 파일 처리
async function processPdfFile(file) {
  showAlert('📄 PDF 로딩 중...', 'info');

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfDocument = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    totalPdfPages = pdfDocument.numPages;
    currentPdfPage = 1;

    showAlert(`📄 PDF 로드 완료! 총 ${totalPdfPages} 페이지`, 'success');

    // PDF 네비게이션 표시
    showPdfNavigation();

    // 첫 페이지 렌더링
    await renderPdfPage(1);
  } catch (error) {
    console.error('PDF 처리 오류:', error);
    showAlert(`❌ PDF 처리 실패: ${error.message}`, 'error');
  }
}

// PDF 네비게이션 표시
function showPdfNavigation() {
  let nav = document.getElementById('pdfNavigation');
  if (!nav) {
    nav = document.createElement('div');
    nav.id = 'pdfNavigation';
    nav.className = 'pdf-navigation';
    document.getElementById('imagePreview').after(nav);
  }

  nav.innerHTML = `
    <button class="btn btn-sm" onclick="renderPdfPage(${currentPdfPage - 1})" ${currentPdfPage <= 1 ? 'disabled' : ''}>◀ 이전</button>
    <span class="page-info">${currentPdfPage} / ${totalPdfPages}</span>
    <button class="btn btn-sm" onclick="renderPdfPage(${currentPdfPage + 1})" ${currentPdfPage >= totalPdfPages ? 'disabled' : ''}>다음 ▶</button>
    <button class="btn btn-sm btn-primary" onclick="extractAllPdfPages()">📑 전체 추출</button>
  `;
  nav.style.display = 'flex';
}

// PDF 페이지 렌더링
async function renderPdfPage(pageNum) {
  if (!pdfDocument || pageNum < 1 || pageNum > totalPdfPages) return;

  currentPdfPage = pageNum;

  const page = await pdfDocument.getPage(pageNum);
  const scale = 2;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;

  // 이미지로 변환
  const imageData = canvas.toDataURL('image/png');

  // 미리보기 표시
  const preview = document.getElementById('imagePreview');
  preview.innerHTML = `<img src="${imageData}" alt="PDF 페이지 ${pageNum}" />`;

  // 고급 버튼 표시
  document.getElementById('advancedUploadButtons').style.display = 'flex';

  // 네비게이션 업데이트
  showPdfNavigation();
}

// 모든 PDF 페이지 추출
async function extractAllPdfPages() {
  if (!pdfDocument) return;

  showAlert(`📄 ${totalPdfPages} 페이지 추출 중...`, 'info');

  extractedProblems = [];

  for (let i = 1; i <= totalPdfPages; i++) {
    const page = await pdfDocument.getPage(i);
    const scale = 2;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;

    extractedProblems.push({
      problemImage: canvas.toDataURL('image/png'),
      assets: [],
      index: i,
      ocrText: null
    });
  }

  showAlert(`✅ ${totalPdfPages} 페이지 추출 완료!`, 'success');
  openMultiProblemModal();
}

/**
 * ============================
 * 이벤트 리스너 및 초기화
 * ============================
 */

// 파일 업로드 이벤트 확장 (PDF 지원)
document.addEventListener('DOMContentLoaded', function() {
  const refImageInput = document.getElementById('refImageInput');
  if (refImageInput) {
    const originalHandler = refImageInput.onchange;
    refImageInput.onchange = async function(e) {
      const file = e.target.files[0];
      if (!file) return;

      if (file.type === 'application/pdf') {
        await processPdfFile(file);
      } else if (originalHandler) {
        originalHandler.call(this, e);
        // 고급 버튼 표시
        setTimeout(() => {
          document.getElementById('advancedUploadButtons').style.display = 'flex';
        }, 100);
      }
    };
  }

  // 채팅 입력 엔터 키 처리
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }
});

// 전역 함수로 노출 (onclick에서 사용하기 위해)
window.openRegionSelectModal = openRegionSelectModal;
window.closeRegionModal = closeRegionModal;
window.setRegionMode = setRegionMode;
window.clearAllRegions = clearAllRegions;
window.autoDetectRegions = autoDetectRegions;
window.applyRegions = applyRegions;
window.openMultiProblemModal = openMultiProblemModal;
window.closeMultiProblemModal = closeMultiProblemModal;
window.extractSingleProblem = extractSingleProblem;
window.removeProblem = removeProblem;
window.updateProblemLabel = updateProblemLabel;
window.extractAllProblems = extractAllProblems;
window.applyExtractedProblems = applyExtractedProblems;
window.openChatEditModal = openChatEditModal;
window.closeChatEditModal = closeChatEditModal;
window.sendChatMessage = sendChatMessage;
window.applyChatChanges = applyChatChanges;
window.revertChanges = revertChanges;
window.openLabelEditModal = openLabelEditModal;
window.closeLabelEditModal = closeLabelEditModal;
window.saveLabelEdit = saveLabelEdit;
window.checkEngineRules = checkEngineRules;
window.autoFixViolations = autoFixViolations;
window.ignoreViolations = ignoreViolations;
window.closeRuleViolationModal = closeRuleViolationModal;
window.openAssetManagerModal = openAssetManagerModal;
window.closeAssetManagerModal = closeAssetManagerModal;
window.addNewAsset = addNewAsset;
window.saveAllAssets = saveAllAssets;
window.updateAssetLabel = updateAssetLabel;
window.updateAssetType = updateAssetType;
window.removeAsset = removeAsset;
window.renderPdfPage = renderPdfPage;
window.extractAllPdfPages = extractAllPdfPages;

// ==================== Phase 4: 완전 구현 API 호출 함수들 ====================

/**
 * #8: 문제와 자료 분리 저장
 */
async function saveProblemComplete(problemData) {
  try {
    showAlert('💾 문제와 자료 저장 중...', 'info');

    const formData = new FormData();
    formData.append('problemText', problemData.text || currentVariationProblem);
    formData.append('solution', problemData.solution || '');
    formData.append('metadata', JSON.stringify(collectVariationMetadata() || {}));
    formData.append('isReference', problemData.isReference || false);
    formData.append('isVariation', problemData.isVariation !== false);
    formData.append('originalProblemId', problemData.originalProblemId || '');
    formData.append('status', problemData.status || 'pending');

    // 자료 정보 추가
    if (problemData.assets && problemData.assets.length > 0) {
      formData.append('assets', JSON.stringify(problemData.assets));
      problemData.assets.forEach((asset, idx) => {
        if (asset.file) {
          formData.append('assets', asset.file);
        }
      });
    }

    const response = await fetch('/api/problems/save-complete', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      showAlert(`✅ 저장 완료! 문제 ID: ${data.problemId}, 자료 ${data.assetIds?.length || 0}개`, 'success');
      return data;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('저장 오류:', error);
    showAlert(`❌ 저장 실패: ${error.message}`, 'error');
    return null;
  }
}

/**
 * #4: 영역 자동 감지 (AI 기반)
 */
async function autoDetectRegionsAI() {
  if (!currentReferenceImage) {
    showAlert('⚠️ 먼저 이미지를 업로드해주세요.', 'error');
    return;
  }

  showAlert('🤖 AI가 영역을 감지하고 있습니다...', 'info');
  document.getElementById('autoDetectBtn').disabled = true;
  document.getElementById('autoDetectBtn').textContent = '⏳ 감지 중...';

  try {
    const response = await fetch('/api/detect-regions-auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: currentReferenceImage,
        mimeType: 'image/png'
      })
    });

    const data = await response.json();

    if (data.success && data.regions) {
      // 감지된 영역을 캔버스에 그리기
      clearAllRegions();
      data.regions.forEach(region => {
        addDetectedRegion(region);
      });

      updateRegionCountInfo();
      showAlert(`✅ ${data.regions.length}개 영역이 자동 감지되었습니다. 필요시 수동 조정하세요.`, 'success');
    } else {
      throw new Error(data.error || '영역 감지 실패');
    }
  } catch (error) {
    console.error('영역 자동 감지 오류:', error);
    showAlert(`❌ 자동 감지 실패: ${error.message}`, 'error');
  } finally {
    document.getElementById('autoDetectBtn').disabled = false;
    document.getElementById('autoDetectBtn').textContent = '🤖 자동 감지';
  }
}

// 감지된 영역 추가 헬퍼
function addDetectedRegion(region) {
  const canvas = document.getElementById('regionCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const bounds = region.bounds;

  // 비율을 실제 픽셀로 변환
  const x = bounds.x * canvas.width;
  const y = bounds.y * canvas.height;
  const width = bounds.width * canvas.width;
  const height = bounds.height * canvas.height;

  // 영역 그리기
  ctx.strokeStyle = region.type === 'problem' ? '#4CAF50' : '#2196F3';
  ctx.lineWidth = 2;
  ctx.setLineDash(region.type === 'asset' ? [5, 5] : []);
  ctx.strokeRect(x, y, width, height);

  // 라벨 표시
  ctx.fillStyle = region.type === 'problem' ? '#4CAF50' : '#2196F3';
  ctx.fillRect(x, y - 20, 60, 20);
  ctx.fillStyle = 'white';
  ctx.font = '12px sans-serif';
  ctx.fillText(region.type === 'problem' ? `문제 ${region.problemNumber || ''}` : `자료`, x + 5, y - 6);

  // 영역 목록에 추가
  if (!window.detectedRegions) window.detectedRegions = [];
  window.detectedRegions.push(region);
}

/**
 * #2, #3: 다중 문제 일괄 추출
 */
async function extractProblemsBatch() {
  if (!currentReferenceImage) {
    showAlert('⚠️ 먼저 이미지를 업로드해주세요.', 'error');
    return;
  }

  showAlert('📑 문제를 추출하고 있습니다...', 'info');

  try {
    const response = await fetch('/api/extract-problems-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: currentReferenceImage,
        mimeType: 'image/png'
      })
    });

    const data = await response.json();

    if (data.success && data.problems) {
      displayExtractedProblems(data.problems);
      showAlert(`✅ ${data.problems.length}개 문제가 추출되었습니다.`, 'success');
      return data.problems;
    } else {
      throw new Error(data.error || '문제 추출 실패');
    }
  } catch (error) {
    console.error('문제 일괄 추출 오류:', error);
    showAlert(`❌ 추출 실패: ${error.message}`, 'error');
    return [];
  }
}

// 추출된 문제 표시
function displayExtractedProblems(problems) {
  const container = document.getElementById('extractedProblemsList');
  if (!container) return;

  if (problems.length === 0) {
    container.innerHTML = '<p class="info-message">추출된 문제가 없습니다.</p>';
    return;
  }

  container.innerHTML = problems.map((p, idx) => `
    <div class="extracted-problem-item" data-index="${idx}">
      <div class="problem-header">
        <input type="checkbox" id="selectProblem${idx}" checked>
        <label for="selectProblem${idx}">
          <strong>문제 ${p.problemNumber || idx + 1}</strong>
          <span class="difficulty-badge ${p.estimatedDifficulty}">${p.estimatedDifficulty || '중'}</span>
        </label>
      </div>
      <div class="problem-preview">${renderMathContent(p.text?.substring(0, 200) + '...')}</div>
      <div class="problem-tags">
        ${(p.estimatedConcepts || []).map(c => `<span class="concept-tag">${c}</span>`).join('')}
      </div>
    </div>
  `).join('');

  // 전역 변수에 저장
  window.extractedProblemsData = problems;
}

/**
 * #6: 엔진 기반 문제 생성
 */
async function generateWithEngine() {
  showAlert('🔧 엔진 규칙 + RAG 기반 문제 생성 중...', 'info');

  try {
    const metadata = collectVariationMetadata();
    const variationCount = parseInt(document.getElementById('variationCountSelect')?.value || 3);

    const response = await fetch('/api/generate-with-engine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceProblem: currentOCRText || '',
        referenceImage: currentReferenceImage,
        metadata,
        variationCount,
        useRag: true,
        engineRuleSet: 'default'
      })
    });

    const data = await response.json();

    if (data.success && data.variations) {
      // 첫 번째 변형 문제 표시
      if (data.variations.length > 0) {
        const firstVar = data.variations[0];
        currentVariationProblem = firstVar.text;
        displayVariationResult({
          problem: firstVar.text,
          choices: firstVar.choices,
          solution: firstVar.solution,
          variations: data.variations,
          engineRules: data.engineRulesApplied
        });
      }

      showAlert(`✅ ${data.variations.length}개 변형 문제가 엔진 규칙 기반으로 생성되었습니다.`, 'success');
      return data;
    } else {
      throw new Error(data.error || '생성 실패');
    }
  } catch (error) {
    console.error('엔진 기반 생성 오류:', error);
    showAlert(`❌ 생성 실패: ${error.message}`, 'error');
    return null;
  }
}

/**
 * #7: 엔진 규칙 위반 자동 수정
 */
async function autoFixViolationsAI() {
  if (!currentViolations || currentViolations.length === 0) {
    showAlert('⚠️ 수정할 위반 사항이 없습니다.', 'info');
    return;
  }

  showAlert('🔧 AI가 위반 사항을 자동 수정하고 있습니다...', 'info');

  try {
    const metadata = collectVariationMetadata();

    const response = await fetch('/api/auto-fix-violations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem: currentVariationProblem,
        violations: currentViolations,
        metadata
      })
    });

    const data = await response.json();

    if (data.success && data.fixedProblem) {
      currentVariationProblem = data.fixedProblem;
      displayVariationResult({ problem: data.fixedProblem });

      // 수정 내역 표시
      if (data.changes && data.changes.length > 0) {
        showAlert(`✅ ${data.changes.length}개 위반 사항이 자동 수정되었습니다.`, 'success');
      }

      closeRuleViolationModal();
      return data;
    } else {
      throw new Error(data.error || '자동 수정 실패');
    }
  } catch (error) {
    console.error('자동 수정 오류:', error);
    showAlert(`❌ 자동 수정 실패: ${error.message}`, 'error');
    return null;
  }
}

/**
 * #10: 참조 문제 완전 처리 (OCR + 라벨링 + RAG)
 */
async function processReferenceComplete() {
  if (!currentReferenceImage) {
    showAlert('⚠️ 먼저 참조 문제 이미지를 업로드해주세요.', 'error');
    return;
  }

  showAlert('📝 참조 문제 처리 중 (OCR → 라벨링 → RAG)...', 'info');

  try {
    const metadata = collectVariationMetadata();

    const response = await fetch('/api/reference/process-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: currentReferenceImage,
        mimeType: 'image/png',
        metadata: JSON.stringify(metadata)
      })
    });

    const data = await response.json();

    if (data.success) {
      // OCR 결과 저장
      currentOCRText = data.ocrText;

      // 자동 라벨 적용
      if (data.autoLabels) {
        applyAutoLabels(data.autoLabels);
      }

      const statusMsg = [];
      if (data.steps.ocr) statusMsg.push('✅ OCR 완료');
      if (data.steps.labeling) statusMsg.push('✅ 라벨링 완료');
      if (data.steps.saved) statusMsg.push('✅ DB 저장 완료');
      if (data.steps.ragIndexed) statusMsg.push('✅ RAG 인덱싱 완료');

      showAlert(statusMsg.join(' | '), 'success');
      return data;
    } else {
      throw new Error(data.error || '처리 실패');
    }
  } catch (error) {
    console.error('참조 문제 처리 오류:', error);
    showAlert(`❌ 처리 실패: ${error.message}`, 'error');
    return null;
  }
}

// 자동 라벨 적용 헬퍼
function applyAutoLabels(labels) {
  if (labels.subject) {
    // 교과 선택
    const subjectSelect = document.getElementById('subjectSelect');
    if (subjectSelect) {
      for (let option of subjectSelect.options) {
        if (option.text.includes(labels.subject) || option.value.includes(labels.subject)) {
          subjectSelect.value = option.value;
          break;
        }
      }
    }
  }

  if (labels.chapter) {
    const chapterInput = document.getElementById('refChapterInput');
    if (chapterInput) chapterInput.value = labels.chapter;
  }

  if (labels.difficulty) {
    // 난이도 저장 (별도 필드에)
    localStorage.setItem('autoDetectedDifficulty', labels.difficulty);
  }

  console.log('✅ 자동 라벨 적용:', labels);
}

/**
 * #11: Multi-LLM 검수 실행
 */
async function runMultiLLMReviewComplete() {
  if (!currentVariationProblem) {
    showAlert('⚠️ 먼저 변형 문제를 생성해주세요.', 'error');
    return;
  }

  showAlert('🔍 Multi-LLM 검수 중 (Gemini + GPT-4)...', 'info');
  document.getElementById('reviewBtn').disabled = true;
  document.getElementById('reviewBtn').textContent = '⏳ 검수 중...';

  try {
    const metadata = collectVariationMetadata();

    // 사용할 LLM 선택
    const llmList = ['gemini'];
    if (document.getElementById('useGPT4Review')?.checked) {
      llmList.push('gpt4');
    }

    const response = await fetch('/api/review/multi-llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem: currentVariationProblem,
        solution: currentVariationSolution || '',
        metadata,
        llmList
      })
    });

    const data = await response.json();

    if (data.success) {
      displayMultiLLMReview(data);

      if (data.summary.averageScore >= 80) {
        document.getElementById('approveBtn').style.display = 'inline-block';
      }

      showAlert(`✅ ${data.summary.reviewCount}개 LLM 검수 완료 (평균 ${data.summary.averageScore}점)`, 'success');
      return data;
    } else {
      throw new Error(data.error || '검수 실패');
    }
  } catch (error) {
    console.error('Multi-LLM 검수 오류:', error);
    showAlert(`❌ 검수 실패: ${error.message}`, 'error');
    return null;
  } finally {
    document.getElementById('reviewBtn').disabled = false;
    document.getElementById('reviewBtn').textContent = '🔍 AI 검토 요청';
  }
}

// Multi-LLM 검수 결과 표시
function displayMultiLLMReview(data) {
  const reviewBox = document.getElementById('reviewResultBox');
  if (!reviewBox) return;

  reviewBox.style.display = 'block';

  // 점수 표시
  document.getElementById('reviewScore').textContent = data.summary.averageScore || '--';
  document.getElementById('reviewScore').className = `score-value ${
    data.summary.averageScore >= 80 ? 'high' : data.summary.averageScore >= 60 ? 'medium' : 'low'
  }`;

  // 추천 표시
  const recEl = document.getElementById('reviewRecommendation');
  const recText = {
    'approve': '✅ 승인 권장',
    'revise': '⚠️ 수정 필요',
    'reject': '❌ 재생성 권장',
    'pending': '⏳ 검토 대기'
  };
  recEl.textContent = recText[data.summary.consensusRecommendation] || recText.pending;
  recEl.className = `review-recommendation ${data.summary.consensusRecommendation}`;

  // 각 LLM 결과 표시
  data.reviews.forEach(review => {
    if (review.categories) {
      if (review.llm === 'gemini') {
        document.getElementById('accuracyReview').innerHTML = `
          <strong>Gemini:</strong> ${review.categories.accuracy?.score || '--'}점
          <p>${review.categories.accuracy?.comments || ''}</p>
        `;
      }
    }
  });

  // 이슈 목록
  if (data.summary.allIssues && data.summary.allIssues.length > 0) {
    const issueHtml = data.summary.allIssues.map(issue => `
      <div class="issue-item ${issue.severity}">
        <span class="issue-badge">${issue.from}</span>
        <span class="issue-severity">${issue.severity}</span>
        <span class="issue-desc">${issue.description}</span>
      </div>
    `).join('');
    document.getElementById('qualityReview').innerHTML = issueHtml;
  }
}

/**
 * #12, #13: 변형 문제 완전 처리 (라벨링 + RAG + 승인)
 */
async function processVariationComplete(autoApprove = false) {
  if (!currentVariationProblem) {
    showAlert('⚠️ 먼저 변형 문제를 생성해주세요.', 'error');
    return;
  }

  showAlert('💾 변형 문제 처리 중 (라벨링 → 저장 → RAG)...', 'info');

  try {
    const metadata = collectVariationMetadata();

    const response = await fetch('/api/variation/process-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variationProblem: currentVariationProblem,
        solution: currentVariationSolution || '',
        originalProblemId: currentReferenceProblemId || null,
        metadata: JSON.stringify(metadata),
        reviewResult: currentReviewResult || null,
        autoApprove
      })
    });

    const data = await response.json();

    if (data.success) {
      const statusMsg = [];
      if (data.steps.labeling) statusMsg.push('✅ 라벨링');
      if (data.steps.saved) statusMsg.push('✅ 저장');
      if (data.steps.approved) statusMsg.push('✅ 승인');
      if (data.steps.ragIndexed) statusMsg.push('✅ RAG');

      showAlert(`${statusMsg.join(' | ')} | ID: ${data.variationId}`, 'success');
      return data;
    } else {
      throw new Error(data.error || '처리 실패');
    }
  } catch (error) {
    console.error('변형 문제 처리 오류:', error);
    showAlert(`❌ 처리 실패: ${error.message}`, 'error');
    return null;
  }
}

/**
 * 변형 문제 승인
 */
async function approveVariation(variationId) {
  try {
    const response = await fetch('/api/variation/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variationId,
        reviewNote: '사용자 승인'
      })
    });

    const data = await response.json();

    if (data.success) {
      showAlert(`✅ 문제가 승인되고 RAG에 인덱싱되었습니다.`, 'success');
      return data;
    } else {
      throw new Error(data.error || '승인 실패');
    }
  } catch (error) {
    console.error('승인 오류:', error);
    showAlert(`❌ 승인 실패: ${error.message}`, 'error');
    return null;
  }
}

/**
 * #15, #16: 자료 라벨링
 */
async function labelAsset(assetId, autoLabel = true) {
  try {
    const response = await fetch('/api/assets/label', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId, autoLabel })
    });

    const data = await response.json();

    if (data.success) {
      showAlert(`✅ 자료 라벨링 완료`, 'success');
      return data.labels;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('자료 라벨링 오류:', error);
    showAlert(`❌ 라벨링 실패: ${error.message}`, 'error');
    return null;
  }
}

/**
 * 자료 RAG 인덱싱
 */
async function indexAssetsToRAG(assetIds) {
  try {
    const response = await fetch('/api/assets/rag-index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetIds })
    });

    const data = await response.json();

    if (data.success) {
      const successCount = data.results.filter(r => r.success).length;
      showAlert(`✅ ${successCount}/${assetIds.length} 자료 RAG 인덱싱 완료`, 'success');
      return data;
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('자료 RAG 인덱싱 오류:', error);
    showAlert(`❌ RAG 인덱싱 실패: ${error.message}`, 'error');
    return null;
  }
}

// 전역 변수 추가
let currentViolations = [];
// currentReviewResult는 이미 위에서 선언됨 (line 2589)
let currentReferenceProblemId = null;
let currentOCRText = '';
let currentReferenceImage = null; // 현재 업로드된 참조 이미지 (base64)
// currentVariationSolution는 이미 위에서 선언됨 (line 2918)

// ==================== Phase 4: UI 핸들러 함수들 ====================

/**
 * 생성 모드에 따라 적절한 생성 함수 호출
 */
function handleGenerateVariation() {
  const mode = document.querySelector('input[name="generationMode"]:checked')?.value || 'standard';

  if (mode === 'engine') {
    // 엔진 기반 생성
    const ruleSet = document.getElementById('engineRuleSet')?.value || 'default';
    const useRAG = document.getElementById('useRAGContext')?.checked ?? true;
    generateWithEngineOptions(ruleSet, useRAG);
  } else {
    // 기존 일반 생성
    generateVariation();
  }
}

/**
 * 옵션을 포함한 엔진 기반 생성
 */
async function generateWithEngineOptions(ruleSet, useRAG) {
  showAlert('🔧 엔진 규칙 + RAG 기반 문제 생성 중...', 'info');

  // referenceFiles에서 이미지 데이터 가져오기
  if (referenceFiles.length === 0) {
    showAlert('⚠️ 참조 문제 이미지를 먼저 업로드해주세요.', 'warning');
    return;
  }

  const progressBox = document.getElementById('variationProgress');
  const progressText = document.getElementById('variationProgressText');
  const generateBtn = document.getElementById('generateVariationBtn');

  if (progressBox) progressBox.style.display = 'block';
  if (progressText) progressText.textContent = '엔진 규칙 적용 중...';
  if (generateBtn) generateBtn.disabled = true;

  try {
    // 첫 번째 참조 이미지를 base64로 변환
    const referenceImageBase64 = await fileToBase64(referenceFiles[0].file);

    const metadata = collectVariationMetadata();
    const variationCount = parseInt(document.getElementById('variationCountSelect')?.value || 3);
    const instructions = document.getElementById('variationInstructions')?.value || '';

    const response = await fetch('/api/generate-with-engine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceProblem: currentOCRText || '',
        referenceImage: referenceImageBase64,
        metadata,
        variationCount,
        instructions,
        useRag: useRAG,
        engineRuleSet: ruleSet
      })
    });

    const data = await response.json();

    if (data.success && data.variations) {
      if (data.variations.length > 0) {
        const firstVar = data.variations[0];
        currentVariationProblem = firstVar.text;
        displayVariationResult({
          problem: firstVar.text,
          choices: firstVar.choices,
          solution: firstVar.solution,
          variations: data.variations,
          engineRules: data.engineRulesApplied
        });
      }

      showAlert(`✅ ${data.variations.length}개 변형 문제 생성 완료 (규칙: ${ruleSet})`, 'success');
      return data;
    } else {
      throw new Error(data.error || '생성 실패');
    }
  } catch (error) {
    console.error('엔진 기반 생성 오류:', error);
    showAlert(`❌ 생성 실패: ${error.message}`, 'error');
    return null;
  } finally {
    if (progressBox) progressBox.style.display = 'none';
    if (generateBtn) generateBtn.disabled = false;
  }
}

/**
 * 모든 자료에 AI 라벨링 적용
 */
async function labelAllAssetsAI() {
  const assetGrid = document.getElementById('assetGrid');
  const statusEl = document.getElementById('assetProcessingStatus');

  if (!window.problemAssetsData || window.problemAssetsData.length === 0) {
    showAlert('⚠️ 라벨링할 자료가 없습니다.', 'error');
    return;
  }

  if (statusEl) statusEl.textContent = '🏷️ AI 라벨링 중...';

  try {
    let successCount = 0;

    for (const asset of window.problemAssetsData) {
      if (asset.id) {
        const result = await labelAsset(asset.id, true);
        if (result) {
          asset.labels = result;
          successCount++;
        }
      }
    }

    if (statusEl) statusEl.textContent = '';
    showAlert(`✅ ${successCount}/${window.problemAssetsData.length} 자료 라벨링 완료`, 'success');

    // UI 업데이트
    renderAssetGrid();
  } catch (error) {
    console.error('전체 라벨링 오류:', error);
    if (statusEl) statusEl.textContent = '❌ 오류 발생';
    showAlert(`❌ 라벨링 실패: ${error.message}`, 'error');
  }
}

/**
 * 모든 자료를 RAG에 인덱싱
 */
async function indexAllAssetsToRAG() {
  const statusEl = document.getElementById('assetProcessingStatus');

  if (!window.problemAssetsData || window.problemAssetsData.length === 0) {
    showAlert('⚠️ 인덱싱할 자료가 없습니다.', 'error');
    return;
  }

  const assetIds = window.problemAssetsData
    .filter(a => a.id)
    .map(a => a.id);

  if (assetIds.length === 0) {
    showAlert('⚠️ 먼저 자료를 저장해주세요.', 'error');
    return;
  }

  if (statusEl) statusEl.textContent = '📚 RAG 인덱싱 중...';

  try {
    const result = await indexAssetsToRAG(assetIds);
    if (statusEl) statusEl.textContent = '';
    return result;
  } catch (error) {
    if (statusEl) statusEl.textContent = '❌ 오류 발생';
    throw error;
  }
}

/**
 * 모든 자료 완전 처리 (라벨링 → 저장 → RAG)
 */
async function processAllAssetsComplete() {
  const statusEl = document.getElementById('assetProcessingStatus');

  if (!window.problemAssetsData || window.problemAssetsData.length === 0) {
    showAlert('⚠️ 처리할 자료가 없습니다.', 'error');
    return;
  }

  try {
    // 1단계: 라벨링
    if (statusEl) statusEl.textContent = '1/3 라벨링 중...';
    await labelAllAssetsAI();

    // 2단계: 저장
    if (statusEl) statusEl.textContent = '2/3 저장 중...';
    await saveAllAssets();

    // 3단계: RAG 인덱싱
    if (statusEl) statusEl.textContent = '3/3 RAG 인덱싱 중...';
    await indexAllAssetsToRAG();

    if (statusEl) statusEl.textContent = '✅ 완료!';
    showAlert('✅ 모든 자료가 완전 처리되었습니다!', 'success');

    setTimeout(() => {
      if (statusEl) statusEl.textContent = '';
    }, 2000);
  } catch (error) {
    console.error('자료 완전 처리 오류:', error);
    if (statusEl) statusEl.textContent = '❌ 오류 발생';
    showAlert(`❌ 처리 실패: ${error.message}`, 'error');
  }
}

/**
 * 자료 그리드 렌더링 (라벨 포함)
 */
function renderAssetGrid() {
  const container = document.getElementById('assetGrid');
  if (!container || !window.problemAssetsData) return;

  if (window.problemAssetsData.length === 0) {
    container.innerHTML = '<p class="info-message">추출된 자료가 없습니다.</p>';
    return;
  }

  container.innerHTML = window.problemAssetsData.map((asset, idx) => `
    <div class="asset-item" data-index="${idx}">
      <div class="asset-preview">
        <img src="${asset.imageData || asset.url}" alt="자료 ${idx + 1}">
      </div>
      <div class="asset-info">
        <input type="text" class="asset-label-input"
               placeholder="자료 설명"
               value="${asset.labels?.description || ''}"
               onchange="updateAssetDescription(${idx}, this.value)">
        <div class="asset-tags">
          ${(asset.labels?.concepts || []).map(c =>
            `<span class="concept-tag">${c}</span>`
          ).join('')}
        </div>
        <select class="asset-type-select" onchange="updateAssetType(${idx}, this.value)">
          <option value="diagram" ${asset.type === 'diagram' ? 'selected' : ''}>그래프/도형</option>
          <option value="table" ${asset.type === 'table' ? 'selected' : ''}>표</option>
          <option value="formula" ${asset.type === 'formula' ? 'selected' : ''}>수식</option>
          <option value="image" ${asset.type === 'image' ? 'selected' : ''}>이미지</option>
        </select>
      </div>
      <div class="asset-actions">
        <button class="btn btn-sm btn-info" onclick="labelAsset('${asset.id}', true)" title="AI 라벨링">
          🏷️
        </button>
        <button class="btn btn-sm btn-danger" onclick="removeAsset(${idx})">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * 자료 설명 업데이트
 */
function updateAssetDescription(index, description) {
  if (window.problemAssetsData && window.problemAssetsData[index]) {
    if (!window.problemAssetsData[index].labels) {
      window.problemAssetsData[index].labels = {};
    }
    window.problemAssetsData[index].labels.description = description;
  }
}

// ==================== 이벤트 리스너 초기화 ====================

// 생성 모드 토글 이벤트
document.addEventListener('DOMContentLoaded', function() {
  // 생성 모드 라디오 버튼 이벤트
  document.querySelectorAll('input[name="generationMode"]').forEach(radio => {
    radio.addEventListener('change', function(e) {
      const engineOptions = document.getElementById('engineRuleOptions');
      if (engineOptions) {
        engineOptions.style.display = e.target.value === 'engine' ? 'block' : 'none';
      }
    });
  });

  // Multi-LLM 검토 버튼 연결 (기존 runMultiLLMReview를 runMultiLLMReviewComplete로 연결)
  const reviewBtn = document.getElementById('reviewBtn');
  if (reviewBtn) {
    reviewBtn.onclick = function() {
      runMultiLLMReviewComplete();
    };
  }
});

// 전역 함수로 노출
window.saveProblemComplete = saveProblemComplete;
window.autoDetectRegionsAI = autoDetectRegionsAI;
window.extractProblemsBatch = extractProblemsBatch;
window.generateWithEngine = generateWithEngine;
window.autoFixViolationsAI = autoFixViolationsAI;
window.processReferenceComplete = processReferenceComplete;
window.runMultiLLMReviewComplete = runMultiLLMReviewComplete;
window.processVariationComplete = processVariationComplete;
window.approveVariation = approveVariation;
window.labelAsset = labelAsset;
window.indexAssetsToRAG = indexAssetsToRAG;

// 새 UI 핸들러 함수 노출
window.handleGenerateVariation = handleGenerateVariation;
window.generateWithEngineOptions = generateWithEngineOptions;
window.labelAllAssetsAI = labelAllAssetsAI;
window.indexAllAssetsToRAG = indexAllAssetsToRAG;
window.processAllAssetsComplete = processAllAssetsComplete;
window.renderAssetGrid = renderAssetGrid;
window.updateAssetDescription = updateAssetDescription;

// ==================== 커스텀 엔진 관리 ====================

// 엔진 관련 전역 상태
let customEngines = [];
let selectedCustomEngine = null;
let currentEngineTab = 'builtin';

/**
 * 엔진 탭 전환
 */
function switchEngineTab(tabName) {
  currentEngineTab = tabName;

  // 탭 버튼 활성화 상태 업데이트
  document.querySelectorAll('.engine-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');

  // 패널 표시/숨기기
  document.getElementById('builtinEnginePanel').style.display = tabName === 'builtin' ? 'block' : 'none';
  document.getElementById('customEnginePanel').style.display = tabName === 'custom' ? 'block' : 'none';
  document.getElementById('createEnginePanel').style.display = tabName === 'create' ? 'block' : 'none';

  // 커스텀 엔진 탭이면 목록 로드
  if (tabName === 'custom') {
    loadCustomEngines();
  }
}

/**
 * 커스텀 엔진 목록 로드
 */
async function loadCustomEngines() {
  try {
    const response = await fetch('/api/engines');
    const data = await response.json();

    if (data.success) {
      customEngines = data.engines || [];
      renderCustomEngineSelect();
    } else {
      console.warn('엔진 목록 로드 실패:', data.error);
    }
  } catch (error) {
    console.error('엔진 목록 로드 오류:', error);
    showAlert('엔진 목록을 불러오는데 실패했습니다.', 'error');
  }
}

/**
 * 커스텀 엔진 선택 드롭다운 렌더링
 */
function renderCustomEngineSelect() {
  const select = document.getElementById('customEngineSelect');
  if (!select) return;

  select.innerHTML = '<option value="">엔진을 선택하세요...</option>';

  customEngines.forEach(engine => {
    const option = document.createElement('option');
    option.value = engine.id;
    option.textContent = `${engine.name} (v${engine.version || '1.0.0'})`;
    if (engine.subject) {
      option.textContent += ` - ${engine.subject}`;
    }
    select.appendChild(option);
  });
}

/**
 * 커스텀 엔진 선택 시 상세 정보 표시
 */
function onCustomEngineSelect() {
  const select = document.getElementById('customEngineSelect');
  const engineId = select.value;
  const infoCard = document.getElementById('selectedEngineInfo');

  if (!engineId) {
    selectedCustomEngine = null;
    infoCard.style.display = 'none';
    return;
  }

  selectedCustomEngine = customEngines.find(e => e.id === engineId);

  if (selectedCustomEngine) {
    document.getElementById('selectedEngineName').textContent = selectedCustomEngine.name;
    document.getElementById('selectedEngineVersion').textContent = `v${selectedCustomEngine.version || '1.0.0'}`;
    document.getElementById('selectedEngineDesc').textContent = selectedCustomEngine.description || '설명 없음';
    document.getElementById('selectedEngineUsage').textContent = selectedCustomEngine.usageCount || 0;
    document.getElementById('selectedEngineSubject').textContent = selectedCustomEngine.subject || '-';
    infoCard.style.display = 'block';
  }
}

/**
 * 새 엔진 저장
 */
async function saveNewEngine() {
  const name = document.getElementById('newEngineName').value.trim();
  const description = document.getElementById('newEngineDesc').value.trim();
  const subject = document.getElementById('newEngineSubject').value.trim();
  const chapter = document.getElementById('newEngineChapter').value.trim();
  const promptRules = document.getElementById('newEnginePrompt').value.trim();
  const pythonCode = document.getElementById('newEnginePython').value.trim();

  if (!name) {
    showAlert('엔진 이름을 입력해주세요.', 'warning');
    return;
  }

  if (!promptRules) {
    showAlert('프롬프트 규칙을 입력해주세요.', 'warning');
    return;
  }

  try {
    showAlert('엔진 저장 중...', 'info');

    const response = await fetch('/api/engines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        subject,
        chapter,
        promptRules,
        pythonCode,
        version: '1.0.0',
        tags: []
      })
    });

    const data = await response.json();

    if (data.success) {
      showAlert(`✅ 엔진 "${name}"이(가) 저장되었습니다.`, 'success');
      clearEngineForm();

      // 커스텀 엔진 탭으로 전환
      switchEngineTab('custom');
      document.querySelectorAll('.engine-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent.includes('커스텀')) {
          tab.classList.add('active');
        }
      });
    } else {
      showAlert(data.error || '엔진 저장 실패', 'error');
    }
  } catch (error) {
    console.error('엔진 저장 오류:', error);
    showAlert('엔진 저장 중 오류가 발생했습니다.', 'error');
  }
}

/**
 * 엔진 폼 초기화
 */
function clearEngineForm() {
  document.getElementById('newEngineName').value = '';
  document.getElementById('newEngineDesc').value = '';
  document.getElementById('newEngineSubject').value = '';
  document.getElementById('newEngineChapter').value = '';
  document.getElementById('newEnginePrompt').value = '';
  document.getElementById('newEnginePython').value = '';
}

/**
 * DOCX/TXT 파일에서 엔진 가져오기
 */
async function handleEngineFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.txt')) {
    // 텍스트 파일 직접 읽기
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('newEnginePrompt').value = e.target.result;
      document.getElementById('newEngineName').value = file.name.replace(/\.[^/.]+$/, '');
      showAlert('파일 내용이 로드되었습니다.', 'success');
    };
    reader.readAsText(file);
  } else if (fileName.endsWith('.docx')) {
    // DOCX는 서버에서 처리
    try {
      showAlert('DOCX 파일 파싱 중...', 'info');

      const formData = new FormData();
      formData.append('engineFile', file);

      const response = await fetch('/api/engines/import', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        showAlert(`✅ 엔진 "${data.engine.name}"이(가) 가져와졌습니다.`, 'success');
        // 커스텀 엔진 탭으로 전환
        switchEngineTab('custom');
      } else {
        showAlert(data.error || '파일 가져오기 실패', 'error');
      }
    } catch (error) {
      console.error('파일 가져오기 오류:', error);
      showAlert('파일 가져오기 중 오류가 발생했습니다.', 'error');
    }
  } else {
    showAlert('지원되지 않는 파일 형식입니다. (.docx, .txt만 지원)', 'warning');
  }

  // 입력 초기화
  event.target.value = '';
}

/**
 * handleGenerateVariation 수정 - 커스텀 엔진 지원
 */
const originalHandleGenerateVariation = handleGenerateVariation;
window.handleGenerateVariation = function() {
  const mode = document.querySelector('input[name="generationMode"]:checked')?.value || 'standard';

  if (mode === 'engine') {
    // 엔진 모드일 때 탭에 따라 처리
    if (currentEngineTab === 'custom' && selectedCustomEngine) {
      // 커스텀 엔진으로 생성
      generateWithCustomEngine(selectedCustomEngine.id);
    } else if (currentEngineTab === 'builtin') {
      // 내장 엔진으로 생성 (기존 로직)
      const ruleSet = document.getElementById('engineRuleSet')?.value || 'default';
      const useRAG = document.getElementById('useRAGContext')?.checked ?? true;
      generateWithEngineOptions(ruleSet, useRAG);
    } else {
      showAlert('엔진을 선택해주세요.', 'warning');
    }
  } else {
    // 일반 생성
    generateVariation();
  }
};

/**
 * 커스텀 엔진으로 변형 문제 생성
 */
async function generateWithCustomEngine(engineId) {
  if (!referenceImageData) {
    showAlert('먼저 참조 문제 이미지를 업로드해주세요.', 'warning');
    return;
  }

  const variationCount = parseInt(document.getElementById('variationCount')?.value || '3');
  const additionalInstructions = document.getElementById('variationInstructions')?.value || '';

  // 메타데이터 수집
  const metadata = {
    examType: document.getElementById('examType')?.value || '',
    problemType: document.getElementById('problemType')?.value || '',
    year: document.getElementById('problemYear')?.value || '',
    grade: document.getElementById('gradeLevel')?.value || '',
    subject: document.getElementById('subjectInput')?.value || '',
    chapter: document.getElementById('chapterName')?.value || ''
  };

  try {
    // 진행 상태 표시
    document.getElementById('variationProgress').style.display = 'block';
    document.getElementById('variationProgressText').textContent = '커스텀 엔진으로 문제 생성 중...';
    document.getElementById('generateVariationBtn').disabled = true;

    const response = await fetch(`/api/engines/${engineId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referenceImage: referenceImageData,
        referenceProblem: extractedProblemText || '',
        metadata,
        variationCount,
        additionalInstructions
      })
    });

    const data = await response.json();

    document.getElementById('variationProgress').style.display = 'none';
    document.getElementById('generateVariationBtn').disabled = false;

    if (data.success) {
      // 결과 표시
      displayVariationResults(data.variations, data.engine);
      showAlert(`✅ ${data.engine.name} 엔진으로 ${data.variations?.length || 0}개 문제가 생성되었습니다.`, 'success');

      // 전역 변수에 저장
      if (typeof window.currentVariations !== 'undefined') {
        window.currentVariations = data.variations;
      }
    } else {
      showAlert(data.error || '문제 생성 실패', 'error');
    }
  } catch (error) {
    document.getElementById('variationProgress').style.display = 'none';
    document.getElementById('generateVariationBtn').disabled = false;
    console.error('커스텀 엔진 문제 생성 오류:', error);
    showAlert('문제 생성 중 오류가 발생했습니다.', 'error');
  }
}

/**
 * 변형 문제 결과 표시
 */
function displayVariationResults(variations, engine) {
  const resultBox = document.getElementById('variationResultBox');
  const contentDiv = document.getElementById('variationContent');

  if (!variations || variations.length === 0) {
    contentDiv.innerHTML = '<p>생성된 문제가 없습니다.</p>';
    resultBox.style.display = 'block';
    return;
  }

  let html = '';

  // 엔진 정보 표시
  if (engine) {
    html += `<div class="engine-badge">
      <span>⚙️ ${engine.name}</span>
      <span class="engine-version">v${engine.version || '1.0.0'}</span>
    </div>`;
  }

  variations.forEach((v, index) => {
    html += `<div class="variation-item">
      <h4>문제 ${v.problemNumber || index + 1}</h4>
      <div class="problem-text">${formatMathText(v.text || v.problem || '')}</div>`;

    if (v.choices && v.choices.length > 0) {
      html += '<div class="choices">';
      v.choices.forEach(choice => {
        html += `<div class="choice-item">${formatMathText(choice)}</div>`;
      });
      html += '</div>';
    }

    if (v.answer) {
      html += `<div class="answer"><strong>정답:</strong> ${formatMathText(v.answer)}</div>`;
    }

    if (v.solution) {
      html += `<div class="solution"><strong>풀이:</strong> ${formatMathText(v.solution)}</div>`;
    }

    if (v.engineCompliance) {
      const status = v.engineCompliance.passed ? '✅ 통과' : '⚠️ 검토 필요';
      html += `<div class="engine-compliance"><strong>엔진 규칙:</strong> ${status}</div>`;
    }

    html += '</div>';
  });

  contentDiv.innerHTML = html;
  resultBox.style.display = 'block';

  // MathJax 렌더링
  if (typeof MathJax !== 'undefined') {
    MathJax.typesetPromise([contentDiv]).catch(err => console.warn('MathJax error:', err));
  }
}

/**
 * 수학 텍스트 포맷팅 (LaTeX 지원)
 */
function formatMathText(text) {
  if (!text) return '';
  // 기본 이스케이프 및 줄바꿈 처리
  return text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

// 엔진 관련 함수들 전역 노출
window.switchEngineTab = switchEngineTab;
window.loadCustomEngines = loadCustomEngines;
window.onCustomEngineSelect = onCustomEngineSelect;
window.saveNewEngine = saveNewEngine;
window.clearEngineForm = clearEngineForm;
window.handleEngineFileImport = handleEngineFileImport;
window.generateWithCustomEngine = generateWithCustomEngine;

// ==================== Phase 5: 관리 기능 ====================

// 전역 상태
let allLabels = [];
let allRAGDocuments = [];
let allPendingProblems = [];
let currentLabelFilter = 'all';
let currentStatusFilter = 'pending';
let currentProblemDetail = null;
let editingLabelId = null;

/**
 * 관리 섹션 토글
 */
function toggleManagementSection(sectionId) {
  const content = document.getElementById(sectionId + 'Content');
  const toggle = document.getElementById(sectionId + 'Toggle');

  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';

    // 섹션 열릴 때 데이터 로드
    if (sectionId === 'labelManagement') loadLabels();
    else if (sectionId === 'ragManagement') loadRAGDocuments();
    else if (sectionId === 'approvalManagement') {
      loadVariationStats();
      loadPendingProblems();
    }
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}

// ==================== 라벨 관리 함수들 ====================

/**
 * 라벨 목록 로드
 */
async function loadLabels() {
  const container = document.getElementById('labelsList');
  container.innerHTML = '<p class="info-message">🔄 라벨을 불러오는 중...</p>';

  try {
    const response = await fetch('/api/labels');
    const data = await response.json();

    if (data.success) {
      allLabels = data.labels || [];
      renderLabels();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('라벨 로드 오류:', error);
    container.innerHTML = `<p class="error-message">❌ 라벨 로드 실패: ${error.message}</p>`;
  }
}

/**
 * 라벨 필터링
 */
function filterLabels(category) {
  currentLabelFilter = category;

  // 탭 활성화 상태 변경
  document.querySelectorAll('.label-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === category);
  });

  renderLabels();
}

/**
 * 라벨 렌더링
 */
function renderLabels() {
  const container = document.getElementById('labelsList');

  let filtered = allLabels;
  if (currentLabelFilter !== 'all') {
    filtered = allLabels.filter(l => l.category === currentLabelFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<p class="info-message">ℹ️ 해당 카테고리에 라벨이 없습니다.</p>';
    return;
  }

  // 카테고리별 그룹화
  const grouped = {};
  filtered.forEach(label => {
    if (!grouped[label.category]) grouped[label.category] = [];
    grouped[label.category].push(label);
  });

  let html = '';
  for (const [category, labels] of Object.entries(grouped)) {
    html += `
      <div class="label-category-group">
        <h4 class="category-title">${getCategoryDisplayName(category)}</h4>
        <div class="labels-row">
          ${labels.map(label => `
            <div class="label-item" data-id="${label.id}">
              <span class="label-name">${label.name}</span>
              ${label.parent ? `<span class="label-parent">← ${label.parent}</span>` : ''}
              <div class="label-actions">
                <button class="btn btn-sm btn-outline" onclick="editLabel('${label.id}')" title="수정">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="deleteLabel('${label.id}')" title="삭제">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

/**
 * 카테고리 표시명
 */
function getCategoryDisplayName(category) {
  const names = {
    subject: '📚 교과',
    course: '📖 과목',
    grade: '🎓 학년',
    difficulty: '📊 난이도',
    problemType: '❓ 문제유형',
    concept: '💡 개념',
    chapter: '📑 단원',
    skill: '🔧 역량'
  };
  return names[category] || category;
}

/**
 * 라벨 추가 모달 열기
 */
function openAddLabelModal() {
  editingLabelId = null;
  document.getElementById('labelModalTitle').textContent = '➕ 라벨 추가';
  document.getElementById('labelCategory').value = 'subject';
  document.getElementById('labelName').value = '';
  document.getElementById('labelMetadata').value = '{}';

  // 상위 라벨 옵션 업데이트
  updateParentLabelOptions();

  document.getElementById('addLabelModal').style.display = 'flex';
}

/**
 * 라벨 수정
 */
function editLabel(labelId) {
  const label = allLabels.find(l => l.id === labelId);
  if (!label) return;

  editingLabelId = labelId;
  document.getElementById('labelModalTitle').textContent = '✏️ 라벨 수정';
  document.getElementById('labelCategory').value = label.category;
  document.getElementById('labelName').value = label.name;
  document.getElementById('labelMetadata').value = JSON.stringify(label.metadata || {}, null, 2);

  updateParentLabelOptions(label.parent);

  document.getElementById('addLabelModal').style.display = 'flex';
}

/**
 * 상위 라벨 옵션 업데이트
 */
function updateParentLabelOptions(selectedParent = '') {
  const select = document.getElementById('labelParent');
  select.innerHTML = '<option value="">없음</option>';

  allLabels.forEach(label => {
    if (label.id !== editingLabelId) {
      select.innerHTML += `<option value="${label.name}" ${label.name === selectedParent ? 'selected' : ''}>${label.category}: ${label.name}</option>`;
    }
  });
}

/**
 * 라벨 저장
 */
async function saveLabel() {
  const category = document.getElementById('labelCategory').value;
  const name = document.getElementById('labelName').value.trim();
  const parent = document.getElementById('labelParent').value;
  let metadata = {};

  try {
    metadata = JSON.parse(document.getElementById('labelMetadata').value || '{}');
  } catch (e) {
    showAlert('⚠️ 메타데이터 JSON 형식이 올바르지 않습니다.', 'error');
    return;
  }

  if (!name) {
    showAlert('⚠️ 라벨 이름을 입력해주세요.', 'error');
    return;
  }

  try {
    let response;
    if (editingLabelId) {
      // 수정
      response = await fetch(`/api/labels/${editingLabelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent, metadata })
      });
    } else {
      // 추가
      response = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, name, parent, metadata })
      });
    }

    const data = await response.json();

    if (data.success) {
      showAlert(`✅ 라벨이 ${editingLabelId ? '수정' : '추가'}되었습니다.`, 'success');
      closeAddLabelModal();
      loadLabels();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('라벨 저장 오류:', error);
    showAlert(`❌ 라벨 저장 실패: ${error.message}`, 'error');
  }
}

/**
 * 라벨 삭제
 */
async function deleteLabel(labelId) {
  if (!confirm('정말 이 라벨을 삭제하시겠습니까?')) return;

  try {
    const response = await fetch(`/api/labels/${labelId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      showAlert('✅ 라벨이 삭제되었습니다.', 'success');
      loadLabels();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('라벨 삭제 오류:', error);
    showAlert(`❌ 라벨 삭제 실패: ${error.message}`, 'error');
  }
}

/**
 * 라벨 추가 모달 닫기
 */
function closeAddLabelModal() {
  document.getElementById('addLabelModal').style.display = 'none';
  editingLabelId = null;
}

/**
 * 기본 라벨로 복원
 */
async function resetLabelsToDefault() {
  if (!confirm('모든 라벨을 기본값으로 복원하시겠습니까? 기존 라벨은 유지됩니다.')) return;

  showAlert('🔄 기본 라벨 복원 중...', 'info');
  await loadLabels();
  showAlert('✅ 라벨 목록이 새로고침되었습니다.', 'success');
}

// ==================== RAG 관리 함수들 ====================

/**
 * RAG 문서 목록 로드
 */
async function loadRAGDocuments() {
  const container = document.getElementById('ragDocumentsList');
  container.innerHTML = '<p class="info-message">🔄 문서를 불러오는 중...</p>';

  try {
    const response = await fetch('/api/rag/documents');
    const data = await response.json();

    if (data.success) {
      allRAGDocuments = data.documents || [];
      document.getElementById('ragDocCount').textContent = allRAGDocuments.length;
      document.getElementById('ragStoreName').textContent = data.storeName || '-';
      renderRAGDocuments();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('RAG 문서 로드 오류:', error);
    container.innerHTML = `<p class="error-message">❌ 문서 로드 실패: ${error.message}</p>`;
  }
}

/**
 * RAG 문서 필터링
 */
function filterRAGDocuments() {
  renderRAGDocuments();
}

/**
 * RAG 문서 렌더링
 */
function renderRAGDocuments() {
  const container = document.getElementById('ragDocumentsList');
  const searchTerm = document.getElementById('ragSearchInput').value.toLowerCase();
  const typeFilter = document.getElementById('ragTypeFilter').value;

  let filtered = allRAGDocuments;

  // 검색 필터
  if (searchTerm) {
    filtered = filtered.filter(doc =>
      (doc.displayName || doc.name || '').toLowerCase().includes(searchTerm)
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

  if (filtered.length === 0) {
    container.innerHTML = '<p class="info-message">ℹ️ 검색 결과가 없습니다.</p>';
    return;
  }

  container.innerHTML = filtered.map(doc => `
    <div class="rag-document-item">
      <div class="doc-info">
        <span class="doc-icon">${getDocTypeIcon(doc.displayName || doc.name)}</span>
        <div class="doc-details">
          <span class="doc-name">${doc.displayName || doc.name}</span>
          <span class="doc-meta">
            ${doc.createTime ? new Date(doc.createTime).toLocaleDateString('ko-KR') : ''}
            ${doc.sizeBytes ? `| ${formatBytes(doc.sizeBytes)}` : ''}
          </span>
        </div>
      </div>
      <div class="doc-actions">
        <button class="btn btn-sm btn-danger" onclick="deleteRAGDocument('${encodeURIComponent(doc.name)}')" title="삭제">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * 문서 타입 아이콘
 */
function getDocTypeIcon(name) {
  if (!name) return '📄';
  const lowerName = name.toLowerCase();
  if (lowerName.includes('variation') || lowerName.includes('var_')) return '📝';
  if (lowerName.includes('asset')) return '🖼️';
  if (lowerName.includes('approved')) return '✅';
  return '📄';
}

/**
 * 바이트 포맷
 */
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * RAG 문서 삭제
 */
async function deleteRAGDocument(documentName) {
  if (!confirm('정말 이 문서를 RAG에서 삭제하시겠습니까?')) return;

  try {
    const response = await fetch(`/api/rag/documents/${documentName}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      showAlert('✅ 문서가 RAG에서 삭제되었습니다.', 'success');
      loadRAGDocuments();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('RAG 문서 삭제 오류:', error);
    showAlert(`❌ 삭제 실패: ${error.message}`, 'error');
  }
}

// ==================== 승인 대기 관리 함수들 ====================

/**
 * 변형 문제 통계 로드
 */
async function loadVariationStats() {
  try {
    const response = await fetch('/api/variations/stats');
    const data = await response.json();

    if (data.success && data.stats) {
      const stats = data.stats;
      document.getElementById('statPending').textContent = stats.pending || 0;
      document.getElementById('statApproved').textContent = stats.approved || 0;
      document.getElementById('statRejected').textContent = stats.rejected || 0;
      document.getElementById('statRagIndexed').textContent = stats.ragIndexed || 0;

      document.getElementById('tabPendingCount').textContent = stats.pending || 0;
      document.getElementById('tabApprovedCount').textContent = stats.approved || 0;
      document.getElementById('tabRejectedCount').textContent = stats.rejected || 0;
    }
  } catch (error) {
    console.error('통계 로드 오류:', error);
  }
}

/**
 * 승인 대기 문제 로드
 */
async function loadPendingProblems() {
  const container = document.getElementById('pendingProblemsList');
  container.innerHTML = '<p class="info-message">🔄 문제를 불러오는 중...</p>';

  try {
    const endpoint = currentStatusFilter === 'pending'
      ? '/api/variations/pending'
      : `/api/variations?status=${currentStatusFilter}`;

    const response = await fetch(endpoint);
    const data = await response.json();

    if (data.success) {
      allPendingProblems = data.problems || data.variations || [];
      renderPendingProblems();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('문제 로드 오류:', error);
    container.innerHTML = `<p class="error-message">❌ 문제 로드 실패: ${error.message}</p>`;
  }
}

/**
 * 상태별 필터
 */
function filterByStatus(status) {
  currentStatusFilter = status;

  document.querySelectorAll('.status-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.status === status);
  });

  // 승인/거절 버튼 표시 제어
  const batchButtons = document.querySelectorAll('#batchApproveBtn, #batchRejectBtn, .select-all-label');
  batchButtons.forEach(btn => {
    btn.style.display = status === 'pending' ? '' : 'none';
  });

  loadPendingProblems();
}

/**
 * 승인 대기 문제 렌더링
 */
function renderPendingProblems() {
  const container = document.getElementById('pendingProblemsList');

  if (allPendingProblems.length === 0) {
    container.innerHTML = `<p class="info-message">ℹ️ ${currentStatusFilter === 'pending' ? '승인 대기 중인' : currentStatusFilter === 'approved' ? '승인된' : '거절된'} 문제가 없습니다.</p>`;
    return;
  }

  const showCheckbox = currentStatusFilter === 'pending';

  container.innerHTML = allPendingProblems.map(problem => `
    <div class="pending-problem-item" data-id="${problem.id}">
      ${showCheckbox ? `
        <label class="problem-checkbox">
          <input type="checkbox" class="problem-select" value="${problem.id}" onchange="updateBatchButtons()">
        </label>
      ` : ''}
      <div class="problem-preview" onclick="openProblemDetail('${problem.id}')">
        <div class="problem-text-preview">${escapeHtml(problem.textPreview || problem.text?.substring(0, 200) || '')}</div>
        <div class="problem-labels">
          ${problem.autoLabels?.subject ? `<span class="label-tag subject">${problem.autoLabels.subject}</span>` : ''}
          ${problem.autoLabels?.chapter ? `<span class="label-tag chapter">${problem.autoLabels.chapter}</span>` : ''}
          ${problem.autoLabels?.difficulty ? `<span class="label-tag difficulty">${problem.autoLabels.difficulty}</span>` : ''}
          ${problem.reviewResult?.overallScore ? `<span class="label-tag score">점수: ${problem.reviewResult.overallScore}</span>` : ''}
        </div>
        <div class="problem-meta">
          <span class="meta-item">📅 ${problem.createdAt ? new Date(problem.createdAt).toLocaleDateString('ko-KR') : '-'}</span>
          ${problem.ragIndexed ? '<span class="meta-item indexed">✅ RAG</span>' : '<span class="meta-item not-indexed">⏳ RAG 대기</span>'}
        </div>
      </div>
      <div class="problem-actions">
        ${currentStatusFilter === 'pending' ? `
          <button class="btn btn-sm btn-success" onclick="approveProblem('${problem.id}')" title="승인">✅</button>
          <button class="btn btn-sm btn-danger" onclick="rejectProblem('${problem.id}')" title="거절">❌</button>
        ` : `
          <button class="btn btn-sm btn-info" onclick="reindexProblem('${problem.id}')" title="재인덱싱">🔄</button>
        `}
      </div>
    </div>
  `).join('');
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 전체 선택 토글
 */
function toggleSelectAllPending() {
  const selectAll = document.getElementById('selectAllPending');
  const checkboxes = document.querySelectorAll('.problem-select');

  checkboxes.forEach(cb => {
    cb.checked = selectAll.checked;
  });

  updateBatchButtons();
}

/**
 * 일괄 버튼 업데이트
 */
function updateBatchButtons() {
  const selected = document.querySelectorAll('.problem-select:checked');
  const hasSelection = selected.length > 0;

  document.getElementById('batchApproveBtn').disabled = !hasSelection;
  document.getElementById('batchRejectBtn').disabled = !hasSelection;
}

/**
 * 선택된 문제 일괄 승인
 */
async function batchApproveSelected() {
  const selected = Array.from(document.querySelectorAll('.problem-select:checked')).map(cb => cb.value);

  if (selected.length === 0) {
    showAlert('⚠️ 승인할 문제를 선택해주세요.', 'error');
    return;
  }

  if (!confirm(`${selected.length}개 문제를 승인하시겠습니까?`)) return;

  try {
    const response = await fetch('/api/variations/batch-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variationIds: selected })
    });

    const data = await response.json();

    if (data.success) {
      showAlert(`✅ ${data.approvedCount}개 문제가 승인되었습니다.`, 'success');
      loadVariationStats();
      loadPendingProblems();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('일괄 승인 오류:', error);
    showAlert(`❌ 일괄 승인 실패: ${error.message}`, 'error');
  }
}

/**
 * 선택된 문제 일괄 거절
 */
async function batchRejectSelected() {
  const selected = Array.from(document.querySelectorAll('.problem-select:checked')).map(cb => cb.value);

  if (selected.length === 0) {
    showAlert('⚠️ 거절할 문제를 선택해주세요.', 'error');
    return;
  }

  const note = prompt('거절 사유를 입력해주세요 (선택):');
  if (!confirm(`${selected.length}개 문제를 거절하시겠습니까?`)) return;

  try {
    const response = await fetch('/api/variations/batch-reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variationIds: selected, reviewNote: note || '' })
    });

    const data = await response.json();

    if (data.success) {
      showAlert(`✅ ${data.rejectedCount}개 문제가 거절되었습니다.`, 'success');
      loadVariationStats();
      loadPendingProblems();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('일괄 거절 오류:', error);
    showAlert(`❌ 일괄 거절 실패: ${error.message}`, 'error');
  }
}

/**
 * 개별 문제 승인
 */
async function approveProblem(problemId) {
  try {
    const response = await fetch('/api/variation/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variationId: problemId })
    });

    const data = await response.json();

    if (data.success) {
      showAlert('✅ 문제가 승인되었습니다.', 'success');
      loadVariationStats();
      loadPendingProblems();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('승인 오류:', error);
    showAlert(`❌ 승인 실패: ${error.message}`, 'error');
  }
}

/**
 * 개별 문제 거절
 */
async function rejectProblem(problemId) {
  const note = prompt('거절 사유를 입력해주세요 (선택):');

  try {
    const response = await fetch(`/api/variations/${problemId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', reviewNote: note || '' })
    });

    const data = await response.json();

    if (data.success) {
      showAlert('✅ 문제가 거절되었습니다.', 'success');
      loadVariationStats();
      loadPendingProblems();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('거절 오류:', error);
    showAlert(`❌ 거절 실패: ${error.message}`, 'error');
  }
}

/**
 * 문제 재인덱싱
 */
async function reindexProblem(problemId) {
  try {
    const response = await fetch(`/api/rag/reindex/${problemId}`, {
      method: 'POST'
    });

    const data = await response.json();

    if (data.success) {
      showAlert('✅ 문제가 RAG에 재인덱싱되었습니다.', 'success');
      loadPendingProblems();
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    console.error('재인덱싱 오류:', error);
    showAlert(`❌ 재인덱싱 실패: ${error.message}`, 'error');
  }
}

/**
 * 문제 상세 보기 모달 열기
 */
function openProblemDetail(problemId) {
  const problem = allPendingProblems.find(p => p.id === problemId);
  if (!problem) return;

  currentProblemDetail = problem;

  // 문제 텍스트
  document.getElementById('detailProblemText').innerHTML = renderMathContent(problem.text || '');

  // 풀이
  document.getElementById('detailSolutionText').innerHTML = renderMathContent(problem.solution || '(풀이 없음)');

  // 라벨 정보
  const labels = problem.autoLabels || problem.metadata || {};
  document.getElementById('detailLabels').innerHTML = `
    <div class="label-row"><strong>교과:</strong> ${labels.subject || '-'}</div>
    <div class="label-row"><strong>과목:</strong> ${labels.course || '-'}</div>
    <div class="label-row"><strong>단원:</strong> ${labels.chapter || '-'}</div>
    <div class="label-row"><strong>난이도:</strong> ${labels.difficulty || '-'}</div>
    <div class="label-row"><strong>개념:</strong> ${(labels.concepts || []).join(', ') || '-'}</div>
  `;

  // 검토 결과
  const review = problem.reviewResult || {};
  document.getElementById('detailReview').innerHTML = review.overallScore
    ? `<div class="review-score-display">${review.overallScore}점</div>
       <div class="review-recommendation">${review.recommendation || ''}</div>`
    : '<p class="info-message">검토 결과 없음</p>';

  // 생성 정보
  document.getElementById('detailMeta').innerHTML = `
    <div class="meta-row"><strong>ID:</strong> ${problem.id}</div>
    <div class="meta-row"><strong>생성일:</strong> ${problem.createdAt ? new Date(problem.createdAt).toLocaleString('ko-KR') : '-'}</div>
    <div class="meta-row"><strong>상태:</strong> ${problem.status || 'pending'}</div>
    <div class="meta-row"><strong>RAG:</strong> ${problem.ragIndexed ? '✅ 인덱싱됨' : '⏳ 대기중'}</div>
  `;

  // 버튼 상태 설정
  const isPending = (problem.status || 'pending') === 'pending';
  document.getElementById('detailApproveBtn').style.display = isPending ? '' : 'none';
  document.getElementById('detailRejectBtn').style.display = isPending ? '' : 'none';

  document.getElementById('problemDetailModal').style.display = 'flex';

  // LaTeX 렌더링
  if (window.renderMathInElement) {
    renderMathInElement(document.getElementById('detailProblemText'), {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ]
    });
    renderMathInElement(document.getElementById('detailSolutionText'), {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ]
    });
  }
}

/**
 * 수학 콘텐츠 렌더링 헬퍼
 */
function renderMathContent(text) {
  if (!text) return '';
  // 줄바꿈을 <br>로 변환
  return text.replace(/\n/g, '<br>');
}

/**
 * 문제 상세 모달 닫기
 */
function closeProblemDetailModal() {
  document.getElementById('problemDetailModal').style.display = 'none';
  currentProblemDetail = null;
}

/**
 * 현재 문제 승인 (모달에서)
 */
async function approveCurrentProblem() {
  if (!currentProblemDetail) return;
  await approveProblem(currentProblemDetail.id);
  closeProblemDetailModal();
}

/**
 * 현재 문제 거절 (모달에서)
 */
async function rejectCurrentProblem() {
  if (!currentProblemDetail) return;
  await rejectProblem(currentProblemDetail.id);
  closeProblemDetailModal();
}

/**
 * 현재 문제 재인덱싱 (모달에서)
 */
async function reindexCurrentProblem() {
  if (!currentProblemDetail) return;
  await reindexProblem(currentProblemDetail.id);
  closeProblemDetailModal();
}

// Phase 5 함수들 전역 노출
window.toggleManagementSection = toggleManagementSection;
window.loadLabels = loadLabels;
window.filterLabels = filterLabels;
window.openAddLabelModal = openAddLabelModal;
window.editLabel = editLabel;
window.saveLabel = saveLabel;
window.deleteLabel = deleteLabel;
window.closeAddLabelModal = closeAddLabelModal;
window.resetLabelsToDefault = resetLabelsToDefault;
window.loadRAGDocuments = loadRAGDocuments;
window.filterRAGDocuments = filterRAGDocuments;
window.deleteRAGDocument = deleteRAGDocument;
window.loadVariationStats = loadVariationStats;
window.loadPendingProblems = loadPendingProblems;
window.filterByStatus = filterByStatus;
window.toggleSelectAllPending = toggleSelectAllPending;
window.updateBatchButtons = updateBatchButtons;
window.batchApproveSelected = batchApproveSelected;
window.batchRejectSelected = batchRejectSelected;
window.approveProblem = approveProblem;
window.rejectProblem = rejectProblem;
window.reindexProblem = reindexProblem;
window.openProblemDetail = openProblemDetail;
window.closeProblemDetailModal = closeProblemDetailModal;
window.approveCurrentProblem = approveCurrentProblem;
window.rejectCurrentProblem = rejectCurrentProblem;
window.reindexCurrentProblem = reindexCurrentProblem;
