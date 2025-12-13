
// ==================== 표 처리 유틸리티 ====================

/**
 * 표 처리 설정 가져오기
 */
function getTableSettings() {
  var modeRadios = document.querySelectorAll('input[name="tableMode"]');
  var mode = 'html';
  modeRadios.forEach(function(radio) {
    if (radio.checked) mode = radio.value;
  });

  return {
    mode: mode,
    striped: document.getElementById('tableStriped') ? document.getElementById('tableStriped').checked : true,
    bordered: document.getElementById('tableBordered') ? document.getElementById('tableBordered').checked : true,
    responsive: document.getElementById('tableResponsive') ? document.getElementById('tableResponsive').checked : true,
    headerSticky: document.getElementById('tableHeaderSticky') ? document.getElementById('tableHeaderSticky').checked : false,
    maxWidth: document.getElementById('tableMaxWidth') ? document.getElementById('tableMaxWidth').value : '100%'
  };
}

/**
 * HTML 테이블을 다른 형식으로 변환
 */
function convertTable(htmlTable, targetFormat) {
  var settings = getTableSettings();

  switch (targetFormat || settings.mode) {
    case 'markdown':
      return tableToMarkdown(htmlTable);
    case 'latex':
      return tableToLatex(htmlTable);
    case 'image':
      return tableToImage(htmlTable);
    case 'html':
    default:
      return applyTableStyles(htmlTable, settings);
  }
}

/**
 * HTML 테이블에 스타일 적용
 */
function applyTableStyles(htmlTable, settings) {
  var wrapper = document.createElement('div');
  wrapper.innerHTML = htmlTable;
  var table = wrapper.querySelector('table');

  if (!table) return htmlTable;

  // 기본 클래스 추가
  table.classList.add('styled-table');

  if (settings.striped) table.classList.add('table-striped');
  if (settings.bordered) table.classList.add('table-bordered');
  if (settings.headerSticky) table.classList.add('table-header-sticky');

  table.style.maxWidth = settings.maxWidth;

  if (settings.responsive) {
    var responsiveWrapper = document.createElement('div');
    responsiveWrapper.className = 'table-responsive';
    responsiveWrapper.appendChild(table.cloneNode(true));
    return responsiveWrapper.outerHTML;
  }

  return wrapper.innerHTML;
}

/**
 * HTML 테이블을 마크다운으로 변환
 */
function tableToMarkdown(htmlTable) {
  var wrapper = document.createElement('div');
  wrapper.innerHTML = htmlTable;
  var table = wrapper.querySelector('table');

  if (!table) return '';

  var rows = table.querySelectorAll('tr');
  var markdown = '';
  var headerProcessed = false;

  rows.forEach(function(row, rowIndex) {
    var cells = row.querySelectorAll('th, td');
    var rowContent = '|';

    cells.forEach(function(cell) {
      rowContent += ' ' + cell.textContent.trim() + ' |';
    });

    markdown += rowContent + '\n';

    // 헤더 구분선 추가
    if (!headerProcessed && row.querySelector('th')) {
      var separator = '|';
      cells.forEach(function() {
        separator += ' --- |';
      });
      markdown += separator + '\n';
      headerProcessed = true;
    }
  });

  return '```\n' + markdown + '```';
}

/**
 * HTML 테이블을 LaTeX로 변환
 */
function tableToLatex(htmlTable) {
  var wrapper = document.createElement('div');
  wrapper.innerHTML = htmlTable;
  var table = wrapper.querySelector('table');

  if (!table) return '';

  var rows = table.querySelectorAll('tr');
  var colCount = 0;

  // 열 개수 계산
  var firstRow = rows[0];
  if (firstRow) {
    colCount = firstRow.querySelectorAll('th, td').length;
  }

  // LaTeX 테이블 시작
  var latex = '\\begin{table}[h]\n\\centering\n';
  latex += '\\begin{tabular}{|' + 'c|'.repeat(colCount) + '}\n';
  latex += '\\hline\n';

  rows.forEach(function(row, rowIndex) {
    var cells = row.querySelectorAll('th, td');
    var rowContent = [];

    cells.forEach(function(cell) {
      var text = cell.textContent.trim();
      // LaTeX 특수문자 이스케이프
      text = text.replace(/&/g, '\\&')
                 .replace(/%/g, '\\%')
                 .replace(/_/g, '\\_')
                 .replace(/#/g, '\\#');

      if (cell.tagName === 'TH') {
        text = '\\textbf{' + text + '}';
      }
      rowContent.push(text);
    });

    latex += rowContent.join(' & ') + ' \\\\\n';
    latex += '\\hline\n';
  });

  latex += '\\end{tabular}\n';
  latex += '\\caption{표 제목}\n';
  latex += '\\end{table}';

  return latex;
}

/**
 * HTML 테이블을 이미지로 변환 (Canvas 사용)
 */
async function tableToImage(htmlTable) {
  // 임시 요소 생성
  var wrapper = document.createElement('div');
  wrapper.innerHTML = htmlTable;
  wrapper.style.cssText = 'position: absolute; left: -9999px; background: white; padding: 20px;';
  document.body.appendChild(wrapper);

  try {
    // html2canvas 라이브러리가 있으면 사용
    if (typeof html2canvas !== 'undefined') {
      var canvas = await html2canvas(wrapper);
      document.body.removeChild(wrapper);
      return '<img src="' + canvas.toDataURL('image/png') + '" alt="표" class="table-image">';
    } else {
      // 라이브러리가 없으면 스타일 적용된 HTML 반환
      document.body.removeChild(wrapper);
      console.warn('html2canvas 라이브러리가 필요합니다. HTML 테이블로 대체합니다.');
      return applyTableStyles(htmlTable, getTableSettings());
    }
  } catch (e) {
    document.body.removeChild(wrapper);
    console.error('테이블 이미지 변환 오류:', e);
    return applyTableStyles(htmlTable, getTableSettings());
  }
}

/**
 * 마크다운에서 테이블 추출 및 변환
 */
function processMarkdownTables(markdownContent) {
  var settings = getTableSettings();

  // 마크다운 테이블 패턴 (|로 시작하는 행들)
  var tableRegex = /(\|[^\n]+\|\n)+/g;

  return markdownContent.replace(tableRegex, function(match) {
    if (settings.mode === 'markdown') {
      return match; // 마크다운 모드면 그대로 유지
    }

    // 마크다운 테이블을 HTML로 변환
    var htmlTable = markdownTableToHtml(match);
    return convertTable(htmlTable, settings.mode);
  });
}

/**
 * 마크다운 테이블을 HTML로 변환
 */
function markdownTableToHtml(markdownTable) {
  var lines = markdownTable.trim().split('\n');
  var html = '<table class="styled-table">';
  var isHeader = true;

  lines.forEach(function(line, index) {
    // 구분선 (---) 행 스킵
    if (line.match(/^\|[\s\-:]+\|$/)) {
      isHeader = false;
      return;
    }

    var cells = line.split('|').filter(function(cell) { return cell.trim() !== ''; });
    var tag = isHeader ? 'th' : 'td';
    var rowTag = isHeader ? 'thead' : (index === lines.length - 1 ? 'tbody' : '');

    if (isHeader && index === 0) html += '<thead>';
    if (!isHeader && index === 2) html += '<tbody>';

    html += '<tr>';
    cells.forEach(function(cell) {
      html += '<' + tag + '>' + cell.trim() + '</' + tag + '>';
    });
    html += '</tr>';

    if (isHeader) {
      html += '</thead>';
      isHeader = false;
    }
  });

  html += '</tbody></table>';
  return html;
}

/**
 * 콘텐츠 내 모든 테이블 처리
 */
function processAllTables(content) {
  var settings = getTableSettings();

  // HTML 테이블 찾기 및 처리
  var tableRegex = /<table[\s\S]*?<\/table>/gi;

  return content.replace(tableRegex, function(match) {
    return convertTable(match, settings.mode);
  });
}

/**
 * 테이블 설정 저장
 */
function saveTableSettings() {
  var settings = getTableSettings();
  localStorage.setItem('tableSettings', JSON.stringify(settings));
  console.log('테이블 설정 저장됨:', settings);
}

/**
 * 테이블 설정 로드
 */
function loadTableSettings() {
  var savedSettings = localStorage.getItem('tableSettings');
  if (savedSettings) {
    try {
      var settings = JSON.parse(savedSettings);

      // 라디오 버튼 설정
      var modeRadio = document.querySelector('input[name="tableMode"][value="' + settings.mode + '"]');
      if (modeRadio) modeRadio.checked = true;

      // 체크박스 설정
      if (document.getElementById('tableStriped')) document.getElementById('tableStriped').checked = settings.striped;
      if (document.getElementById('tableBordered')) document.getElementById('tableBordered').checked = settings.bordered;
      if (document.getElementById('tableResponsive')) document.getElementById('tableResponsive').checked = settings.responsive;
      if (document.getElementById('tableHeaderSticky')) document.getElementById('tableHeaderSticky').checked = settings.headerSticky;

      // 선택 옵션 설정
      if (document.getElementById('tableMaxWidth')) document.getElementById('tableMaxWidth').value = settings.maxWidth;

      console.log('테이블 설정 로드됨:', settings);
    } catch (e) {
      console.error('테이블 설정 로드 오류:', e);
    }
  }
}

// 페이지 로드 시 설정 로드
document.addEventListener('DOMContentLoaded', function() {
  loadTableSettings();

  // 설정 변경 시 자동 저장
  var tableInputs = document.querySelectorAll('#tableProcessingSection input, #tableProcessingSection select');
  tableInputs.forEach(function(input) {
    input.addEventListener('change', saveTableSettings);
  });
});

// 전역 함수 등록
window.getTableSettings = getTableSettings;
window.convertTable = convertTable;
window.applyTableStyles = applyTableStyles;
window.tableToMarkdown = tableToMarkdown;
window.tableToLatex = tableToLatex;
window.tableToImage = tableToImage;
window.processMarkdownTables = processMarkdownTables;
window.markdownTableToHtml = markdownTableToHtml;
window.processAllTables = processAllTables;
window.saveTableSettings = saveTableSettings;
window.loadTableSettings = loadTableSettings;
