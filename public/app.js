// ==================== 전역 변수 ====================
let currentStore = null;
let metadataCounter = 0;

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', () => {
  checkServerHealth();
  setupEventListeners();
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
      showCurrentStore(data.storeName);
      showAlert(`✅ ${data.message}`, 'success');
      document.getElementById('storeDisplayName').value = '';
    } else {
      showAlert(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    hideProgress();
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

async function useExistingStore() {
  const storeName = document.getElementById('existingStoreName').value.trim();

  if (!storeName) {
    showAlert('스토어 ID를 입력하세요.', 'error');
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
      showCurrentStore(data.storeName);
      showAlert(`✅ ${data.message}`, 'success');
      document.getElementById('existingStoreName').value = '';
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

  storeNameElem.textContent = storeName;
  infoBox.style.display = 'block';
}

async function loadStoreStatus() {
  if (!currentStore) {
    showAlert('먼저 스토어를 초기화하세요.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/store/status');
    const data = await response.json();

    if (data.success) {
      const statusBox = document.getElementById('storeStatus');
      statusBox.innerHTML = `
        <h3>스토어 상태</h3>
        <p><strong>스토어 이름:</strong> ${data.status.storeName}</p>
        <p><strong>문서 개수:</strong> ${data.status.documentCount}개</p>
      `;
      statusBox.style.display = 'block';
    } else {
      showAlert(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

async function loadAllStores() {
  try {
    showProgress('스토어 목록 로딩 중...');

    const response = await fetch('/api/stores');
    const data = await response.json();

    hideProgress();

    if (data.success) {
      displayStoresList(data.stores);
    } else {
      showAlert(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    hideProgress();
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

function displayStoresList(stores) {
  const listContainer = document.getElementById('allStoresList');

  if (stores.length === 0) {
    listContainer.innerHTML = '<p>스토어가 없습니다.</p>';
    listContainer.style.display = 'block';
    return;
  }

  const html = `
    <h3>모든 스토어 (${stores.length}개)</h3>
    ${stores.map(store => `
      <div class="store-item">
        <div class="store-info">
          <div class="store-name">${store.displayName || 'Unnamed'}</div>
          <div class="store-meta">
            ID: ${store.name}<br>
            생성일: ${new Date(store.createTime).toLocaleString('ko-KR')}
          </div>
        </div>
        <div class="store-actions">
          <button onclick="useStoreById('${store.name}')" class="btn btn-secondary">
            사용
          </button>
          <button onclick="deleteStore('${store.name}')" class="btn btn-danger">
            삭제
          </button>
        </div>
      </div>
    `).join('')}
  `;

  listContainer.innerHTML = html;
  listContainer.style.display = 'block';
}

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
      loadAllStores(); // 목록 새로고침

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
    } else {
      showAlert(`❌ ${data.error}`, 'error');
    }
  } catch (error) {
    hideProgress();
    showAlert(`❌ 오류: ${error.message}`, 'error');
  }
}

function formatAnswer(answer) {
  // 줄바꿈을 <br>로 변환
  return answer.replace(/\n/g, '<br>');
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
