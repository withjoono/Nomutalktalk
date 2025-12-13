
// ==================== 검수/승인 대시보드 확장 기능 ====================

let approvalState = {
  currentPage: 1,
  pageSize: 20,
  totalPages: 1,
  currentFilter: 'all',
  searchTerm: '',
  subjectFilter: '',
  dateFilter: '',
  labelFilter: '',
  viewMode: 'list',
  allProblems: [],
  filteredProblems: [],
  selectedProblems: new Set(),
  history: []
};

let searchDebounceTimer = null;

function debounceApprovalSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(function() {
    approvalState.searchTerm = document.getElementById('approvalSearchInput') ? document.getElementById('approvalSearchInput').value : '';
    applyApprovalFilters();
  }, 300);
}

function applyApprovalFilters() {
  const dateFilterEl = document.getElementById('approvalDateFilter');
  const dateFilter = dateFilterEl ? dateFilterEl.value : '';
  const customRange = document.getElementById('customDateRange');
  if (customRange) customRange.style.display = dateFilter === 'custom' ? 'flex' : 'none';

  const subjectEl = document.getElementById('approvalSubjectFilter');
  const labelEl = document.getElementById('approvalLabelFilter');
  approvalState.subjectFilter = subjectEl ? subjectEl.value : '';
  approvalState.dateFilter = dateFilter;
  approvalState.labelFilter = labelEl ? labelEl.value : '';

  filterProblemsApproval();
  renderProblemsListApproval();
}

function resetApprovalFilters() {
  var ids = ['approvalSearchInput', 'approvalSubjectFilter', 'approvalDateFilter', 'approvalLabelFilter'];
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var customRange = document.getElementById('customDateRange');
  if (customRange) customRange.style.display = 'none';
  approvalState.searchTerm = '';
  approvalState.subjectFilter = '';
  approvalState.dateFilter = '';
  approvalState.labelFilter = '';
  approvalState.currentPage = 1;
  filterProblemsApproval();
  renderProblemsListApproval();
}

function filterProblemsApproval() {
  var filtered = approvalState.allProblems.slice();

  if (approvalState.currentFilter !== 'all') {
    filtered = filtered.filter(function(p) {
      if (approvalState.currentFilter === 'indexed') return p.ragIndexed;
      return p.status === approvalState.currentFilter;
    });
  }

  if (approvalState.searchTerm) {
    var term = approvalState.searchTerm.toLowerCase();
    filtered = filtered.filter(function(p) {
      return (p.content || '').toLowerCase().includes(term) || (p.id || '').toLowerCase().includes(term);
    });
  }

  if (approvalState.subjectFilter) {
    filtered = filtered.filter(function(p) { return p.subject === approvalState.subjectFilter; });
  }

  approvalState.filteredProblems = filtered;
  approvalState.totalPages = Math.max(1, Math.ceil(filtered.length / approvalState.pageSize));
  if (approvalState.currentPage > approvalState.totalPages) approvalState.currentPage = approvalState.totalPages;
  updateApprovalStatsUI();
}

function updateApprovalStatsUI() {
  var all = approvalState.allProblems;
  var setCount = function(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setCount('statPending', all.filter(function(p) { return p.status === 'pending'; }).length);
  setCount('statApproved', all.filter(function(p) { return p.status === 'approved'; }).length);
  setCount('statRejected', all.filter(function(p) { return p.status === 'rejected'; }).length);
  setCount('statRagIndexed', all.filter(function(p) { return p.ragIndexed; }).length);
  setCount('statTotal', all.length);
  setCount('tabAllCount', all.length);
  setCount('tabPendingCount', all.filter(function(p) { return p.status === 'pending'; }).length);
  setCount('tabApprovedCount', all.filter(function(p) { return p.status === 'approved'; }).length);
  setCount('tabRejectedCount', all.filter(function(p) { return p.status === 'rejected'; }).length);
  setCount('tabIndexedCount', all.filter(function(p) { return p.ragIndexed; }).length);
}

function renderProblemsListApproval() {
  var listEl = document.getElementById('pendingProblemsList');
  if (!listEl) return;

  var start = (approvalState.currentPage - 1) * approvalState.pageSize;
  var pageProblems = approvalState.filteredProblems.slice(start, start + approvalState.pageSize);

  if (pageProblems.length === 0) {
    listEl.innerHTML = '<p class="info-message">📋 조건에 맞는 문제가 없습니다.</p>';
  } else {
    listEl.className = 'pending-problems-list' + (approvalState.viewMode === 'grid' ? ' grid-view' : '');
    listEl.innerHTML = pageProblems.map(function(p) {
      var statusLabel = p.status === 'pending' ? '⏳ 대기중' : (p.status === 'approved' ? '✅ 승인됨' : '❌ 거절됨');
      var isChecked = approvalState.selectedProblems.has(p.id) ? 'checked' : '';
      var ragBadge = p.ragIndexed ? '<span class="rag-badge">🔗 RAG</span>' : '';
      var actions = '';
      if (p.status === 'pending') {
        actions = '<button class="btn btn-sm btn-success" onclick="approveProblem(\'' + p.id + '\')">✅</button>' +
                  '<button class="btn btn-sm btn-danger" onclick="rejectProblem(\'' + p.id + '\')">❌</button>';
      }
      if (p.status === 'approved' && !p.ragIndexed) {
        actions += '<button class="btn btn-sm btn-info" onclick="indexProblemToRAG(\'' + p.id + '\')">🔗</button>';
      }
      return '<div class="problem-card ' + p.status + '" data-id="' + p.id + '">' +
        '<div class="problem-header">' +
        '<input type="checkbox" ' + isChecked + ' onchange="toggleProblemSelection(\'' + p.id + '\')">' +
        '<span class="problem-id">#' + (p.id || '').slice(-6) + '</span>' +
        '<span class="problem-status status-' + p.status + '">' + statusLabel + '</span>' + ragBadge +
        '</div>' +
        '<div class="problem-content">' + escapeHtml((p.content || '').substring(0, 150)) + '...</div>' +
        '<div class="problem-meta">📚 ' + (p.subject || '미분류') + ' | 📅 ' + new Date(p.createdAt).toLocaleDateString('ko-KR') + '</div>' +
        '<div class="problem-actions">' + actions + '</div>' +
        '</div>';
    }).join('');
  }

  updatePaginationUIApproval();
  updateSelectedCountApproval();
}

function updatePaginationUIApproval() {
  var pageInfo = document.getElementById('approvalPageInfo');
  var prevBtn = document.getElementById('prevPageBtn');
  var nextBtn = document.getElementById('nextPageBtn');
  if (pageInfo) pageInfo.textContent = approvalState.currentPage + ' / ' + approvalState.totalPages + ' 페이지';
  if (prevBtn) prevBtn.disabled = approvalState.currentPage <= 1;
  if (nextBtn) nextBtn.disabled = approvalState.currentPage >= approvalState.totalPages;
}

function goToApprovalPage(direction) {
  if (direction === 'prev' && approvalState.currentPage > 1) approvalState.currentPage--;
  else if (direction === 'next' && approvalState.currentPage < approvalState.totalPages) approvalState.currentPage++;
  renderProblemsListApproval();
}

function changeApprovalPageSize() {
  var select = document.getElementById('approvalPageSize');
  if (select) {
    approvalState.pageSize = parseInt(select.value, 10);
    approvalState.currentPage = 1;
    filterProblemsApproval();
    renderProblemsListApproval();
  }
}

function setApprovalView(mode) {
  approvalState.viewMode = mode;
  document.querySelectorAll('.view-btn').forEach(function(btn) { btn.classList.remove('active'); });
  var activeBtn = document.getElementById(mode === 'list' ? 'listViewBtn' : 'gridViewBtn');
  if (activeBtn) activeBtn.classList.add('active');
  renderProblemsListApproval();
}

function toggleProblemSelection(problemId) {
  if (approvalState.selectedProblems.has(problemId)) {
    approvalState.selectedProblems.delete(problemId);
  } else {
    approvalState.selectedProblems.add(problemId);
  }
  updateSelectedCountApproval();
  updateBatchButtonsApproval();
}

function updateSelectedCountApproval() {
  var el = document.getElementById('selectedProblemCount');
  if (el) el.textContent = approvalState.selectedProblems.size + '개 선택됨';
}

function updateBatchButtonsApproval() {
  var hasSelection = approvalState.selectedProblems.size > 0;
  ['batchApproveBtn', 'batchRejectBtn', 'batchRagBtn'].forEach(function(id) {
    var btn = document.getElementById(id);
    if (btn) btn.disabled = !hasSelection;
  });
}

async function batchRagIndexSelected() {
  if (approvalState.selectedProblems.size === 0) {
    alert('선택된 문제가 없습니다.');
    return;
  }
  if (!confirm(approvalState.selectedProblems.size + '개 문제를 RAG에 인덱싱하시겠습니까?')) return;

  var success = 0;
  var ids = Array.from(approvalState.selectedProblems);
  for (var i = 0; i < ids.length; i++) {
    try {
      await indexProblemToRAG(ids[i], false);
      success++;
    } catch (e) {
      console.error(e);
    }
  }
  alert(success + '/' + ids.length + '개 문제 인덱싱 완료');
  approvalState.selectedProblems.clear();
  loadPendingProblems();
}

function toggleApprovalHistory() {
  var content = document.getElementById('approvalHistoryContent');
  var icon = document.getElementById('historyToggleIcon');
  if (content && icon) {
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
    icon.textContent = content.style.display === 'none' ? '▼' : '▲';
  }
}

function exportApprovalData() {
  var header = 'ID,내용,상태,과목,생성일,RAG';
  var rows = approvalState.filteredProblems.map(function(p) {
    var content = (p.content || '').replace(/"/g, '""').substring(0, 100);
    return p.id + ',"' + content + '",' + p.status + ',' + (p.subject || '') + ',' + (p.createdAt || '') + ',' + (p.ragIndexed ? 'Y' : 'N');
  });
  var csv = [header].concat(rows).join('\n');
  var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'problems_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
}

// 전역 함수 등록 (검수/승인 대시보드)
window.debounceApprovalSearch = debounceApprovalSearch;
window.applyApprovalFilters = applyApprovalFilters;
window.resetApprovalFilters = resetApprovalFilters;
window.goToApprovalPage = goToApprovalPage;
window.changeApprovalPageSize = changeApprovalPageSize;
window.setApprovalView = setApprovalView;
window.toggleProblemSelection = toggleProblemSelection;
window.batchRagIndexSelected = batchRagIndexSelected;
window.toggleApprovalHistory = toggleApprovalHistory;
window.exportApprovalData = exportApprovalData;
window.filterProblemsApproval = filterProblemsApproval;
window.renderProblemsListApproval = renderProblemsListApproval;
window.updateApprovalStatsUI = updateApprovalStatsUI;
