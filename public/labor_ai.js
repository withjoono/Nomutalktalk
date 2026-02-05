/**
 * 노무 AI 웹 인터페이스 JavaScript
 * Labor AI Web Interface
 */

// API Base URL
const API_BASE = '';

// 상태 관리
let currentTab = 'query';
let categories = [];

/**
 * 페이지 로드 시 초기화
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('노무 AI 초기화 중...');
  
  // Health Check
  await checkHealth();
  
  // 카테고리 로드
  await loadCategories();
  
  // 템플릿 파라미터 초기화
  updateTemplateParams();
  
  console.log('노무 AI 준비 완료');
});

/**
 * Health Check
 */
async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE}/api/labor/health`);
    const result = await response.json();
    
    const indicator = document.getElementById('statusIndicator');
    if (result.success) {
      indicator.className = 'status-indicator online';
      console.log('✅ 노무 AI 서비스 연결됨');
    } else {
      indicator.className = 'status-indicator offline';
      console.warn('⚠️  노무 AI 서비스 응답 없음');
    }
  } catch (error) {
    const indicator = document.getElementById('statusIndicator');
    indicator.className = 'status-indicator offline';
    console.error('❌ 노무 AI 서비스 연결 실패:', error);
  }
}

/**
 * 탭 전환
 */
function switchTab(tabName) {
  // 탭 버튼 활성화
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => tab.classList.remove('active'));
  event.target.classList.add('active');
  
  // 탭 컨텐츠 표시
  const contents = document.querySelectorAll('.tab-content');
  contents.forEach(content => content.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  
  currentTab = tabName;
}

/**
 * 질의응답 실행
 */
async function askQuestion() {
  const query = document.getElementById('queryInput').value.trim();
  
  if (!query) {
    showError('queryError', '질문을 입력해주세요.');
    return;
  }
  
  const category = document.getElementById('categorySelect').value;
  const includeCases = document.getElementById('includeCases').checked;
  const includeInterpretations = document.getElementById('includeInterpretations').checked;
  
  // UI 상태 업데이트
  showLoading('queryLoading');
  hideError('queryError');
  hideResult('queryResult');
  
  try {
    const response = await fetch(`${API_BASE}/api/labor/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        category: category || undefined,
        includeCases,
        includeInterpretations
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showResult('queryResult', 'queryAnswer', result.data.answer);
    } else {
      showError('queryError', result.error || '답변 생성에 실패했습니다.');
    }
  } catch (error) {
    console.error('질의응답 오류:', error);
    showError('queryError', '서버와의 통신에 실패했습니다: ' + error.message);
  } finally {
    hideLoading('queryLoading');
  }
}

/**
 * 유사 판례 검색
 */
async function searchSimilarCases() {
  const description = document.getElementById('caseDescription').value.trim();
  
  if (!description) {
    showError('casesError', '사건 설명을 입력해주세요.');
    return;
  }
  
  // UI 상태 업데이트
  showLoading('casesLoading');
  hideError('casesError');
  hideResult('casesResult');
  
  try {
    const response = await fetch(`${API_BASE}/api/labor/similar-cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ description })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showResult('casesResult', 'casesAnswer', result.data.result);
    } else {
      showError('casesError', result.error || '판례 검색에 실패했습니다.');
    }
  } catch (error) {
    console.error('판례 검색 오류:', error);
    showError('casesError', '서버와의 통신에 실패했습니다: ' + error.message);
  } finally {
    hideLoading('casesLoading');
  }
}

/**
 * 법령 조항 검색
 */
async function searchLawArticle() {
  const lawName = document.getElementById('lawName').value.trim();
  const article = document.getElementById('lawArticle').value.trim();
  
  if (!lawName || !article) {
    showError('lawError', '법령명과 조문을 모두 입력해주세요.');
    return;
  }
  
  // UI 상태 업데이트
  showLoading('lawLoading');
  hideError('lawError');
  hideResult('lawResult');
  
  try {
    const response = await fetch(`${API_BASE}/api/labor/law-article`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ lawName, article })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showResult('lawResult', 'lawAnswer', result.data.result);
    } else {
      showError('lawError', result.error || '법령 조회에 실패했습니다.');
    }
  } catch (error) {
    console.error('법령 조회 오류:', error);
    showError('lawError', '서버와의 통신에 실패했습니다: ' + error.message);
  } finally {
    hideLoading('lawLoading');
  }
}

/**
 * 템플릿 상담
 */
async function consultWithTemplate() {
  const templateType = document.getElementById('templateType').value;
  const params = collectTemplateParams(templateType);
  
  // UI 상태 업데이트
  showLoading('templateLoading');
  hideError('templateError');
  hideResult('templateResult');
  
  try {
    const response = await fetch(`${API_BASE}/api/labor/consult`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ templateType, params })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showResult('templateResult', 'templateAnswer', result.data.result);
    } else {
      showError('templateError', result.error || '템플릿 상담에 실패했습니다.');
    }
  } catch (error) {
    console.error('템플릿 상담 오류:', error);
    showError('templateError', '서버와의 통신에 실패했습니다: ' + error.message);
  } finally {
    hideLoading('templateLoading');
  }
}

/**
 * 템플릿 파라미터 수집
 */
function collectTemplateParams(templateType) {
  const params = {};
  const inputs = document.querySelectorAll('#templateParams input, #templateParams textarea');
  
  inputs.forEach(input => {
    if (input.value.trim()) {
      params[input.name] = input.value.trim();
    }
  });
  
  return params;
}

/**
 * 템플릿 파라미터 UI 업데이트
 */
function updateTemplateParams() {
  const templateType = document.getElementById('templateType').value;
  const container = document.getElementById('templateParams');
  
  const paramFields = {
    dismissal: [
      { name: 'employeeType', label: '근로자 유형', placeholder: '예: 정규직, 계약직' },
      { name: 'workPeriod', label: '근무 기간', placeholder: '예: 3년' },
      { name: 'dismissalReason', label: '해고 사유', placeholder: '예: 업무태만' },
      { name: 'procedure', label: '해고 절차', placeholder: '예: 구두 통보' }
    ],
    wages: [
      { name: 'wageType', label: '임금 유형', placeholder: '예: 기본급, 수당' },
      { name: 'issue', label: '쟁점 사항', placeholder: '예: 최저임금 미달' },
      { name: 'workType', label: '근로 형태', placeholder: '예: 정규직, 시간제' }
    ],
    worktime: [
      { name: 'workType', label: '근로 형태', placeholder: '예: 일반 근로, 교대제' },
      { name: 'workHours', label: '근로 시간', placeholder: '예: 주 50시간' },
      { name: 'issue', label: '쟁점 사항', placeholder: '예: 연장수당 미지급' }
    ],
    leave: [
      { name: 'leaveType', label: '휴가 유형', placeholder: '예: 연차, 출산휴가' },
      { name: 'workPeriod', label: '근무 기간', placeholder: '예: 2년' },
      { name: 'issue', label: '쟁점 사항', placeholder: '예: 연차 사용 거부' }
    ]
  };
  
  const fields = paramFields[templateType] || [];
  
  container.innerHTML = fields.map(field => `
    <div class="input-group">
      <label for="param_${field.name}">${field.label}</label>
      <input 
        type="text" 
        id="param_${field.name}" 
        name="${field.name}" 
        placeholder="${field.placeholder}"
      >
    </div>
  `).join('');
}

/**
 * 카테고리 로드
 */
async function loadCategories() {
  try {
    const response = await fetch(`${API_BASE}/api/labor/categories`);
    const result = await response.json();
    
    if (result.success) {
      categories = result.data;
      renderCategories();
    }
  } catch (error) {
    console.error('카테고리 로드 오류:', error);
  }
}

/**
 * 카테고리 렌더링
 */
function renderCategories() {
  const container = document.getElementById('categoriesGrid');
  
  container.innerHTML = categories.map(cat => `
    <div class="category-card" onclick="selectCategory('${cat.name}')">
      <h3>${cat.name}</h3>
      <div class="keywords">
        ${cat.keywords.slice(0, 5).join(', ')}
        ${cat.keywords.length > 5 ? '...' : ''}
      </div>
    </div>
  `).join('');
}

/**
 * 카테고리 선택
 */
function selectCategory(categoryName) {
  // 질의응답 탭으로 이동
  switchTab('query');
  
  // 카테고리 설정
  document.getElementById('categorySelect').value = categoryName;
  
  // 질문 입력란에 포커스
  document.getElementById('queryInput').focus();
}

/**
 * UI 헬퍼 함수들
 */
function showLoading(loadingId) {
  document.getElementById(loadingId).classList.add('show');
}

function hideLoading(loadingId) {
  document.getElementById(loadingId).classList.remove('show');
}

function showResult(resultId, answerId, content) {
  document.getElementById(resultId).classList.add('show');
  document.getElementById(answerId).textContent = content;
}

function hideResult(resultId) {
  document.getElementById(resultId).classList.remove('show');
}

function showError(errorId, message) {
  const errorEl = document.getElementById(errorId);
  errorEl.textContent = message;
  errorEl.classList.add('show');
}

function hideError(errorId) {
  document.getElementById(errorId).classList.remove('show');
}

/**
 * Enter 키로 질문 제출
 */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    if (currentTab === 'query') {
      askQuestion();
    } else if (currentTab === 'cases') {
      searchSimilarCases();
    } else if (currentTab === 'law') {
      searchLawArticle();
    } else if (currentTab === 'template') {
      consultWithTemplate();
    }
  }
});

// 전역으로 노출
window.switchTab = switchTab;
window.askQuestion = askQuestion;
window.searchSimilarCases = searchSimilarCases;
window.searchLawArticle = searchLawArticle;
window.consultWithTemplate = consultWithTemplate;
window.updateTemplateParams = updateTemplateParams;
window.selectCategory = selectCategory;
