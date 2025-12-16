// ==================== 과학 문제 표 & 차트 생성기 ====================
// 수능/내신 과학 문제에 필요한 고급 표, 파이 차트, 화학식 표 생성

/**
 * ==================== 파이 차트 SVG 생성기 ====================
 */
const PieChartGenerator = {
  /**
   * 파이 차트 SVG 생성
   * @param {Array} segments - [{value: number, label: string, color?: string}]
   * @param {Object} options - {size: number, showLabels: boolean, labelType: 'fraction'|'percent'|'value'}
   * @returns {string} SVG HTML 문자열
   */
  create(segments, options = {}) {
    const {
      size = 100,
      showLabels = true,
      labelType = 'fraction',
      strokeWidth = 2,
      strokeColor = '#000',
      fontSize = 12,
      centerX = size / 2,
      centerY = size / 2,
      radius = (size / 2) - 10
    } = options;

    const total = segments.reduce((sum, s) => sum + s.value, 0);
    let currentAngle = -90; // 12시 방향에서 시작

    const paths = [];
    const labels = [];

    segments.forEach((segment, index) => {
      const percentage = segment.value / total;
      const angle = percentage * 360;
      const endAngle = currentAngle + angle;

      // 경로 계산
      const startRad = (currentAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const pathD = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ');

      const color = segment.color || this.getDefaultColor(index);
      paths.push(`<path d="${pathD}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`);

      // 라벨 위치 계산 (섹터 중앙)
      if (showLabels) {
        const midAngle = currentAngle + angle / 2;
        const midRad = (midAngle * Math.PI) / 180;
        const labelRadius = radius * 0.6;
        const labelX = centerX + labelRadius * Math.cos(midRad);
        const labelY = centerY + labelRadius * Math.sin(midRad);

        let labelText = '';
        if (labelType === 'fraction' && segment.fraction) {
          labelText = segment.fraction;
        } else if (labelType === 'percent') {
          labelText = Math.round(percentage * 100) + '%';
        } else if (labelType === 'value') {
          labelText = segment.value.toString();
        } else if (segment.label) {
          labelText = segment.label;
        }

        if (labelText) {
          labels.push(`<text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}" font-family="serif">${labelText}</text>`);
        }
      }

      currentAngle = endAngle;
    });

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      ${paths.join('\n      ')}
      ${labels.join('\n      ')}
    </svg>`;
  },

  /**
   * 분수 형태 파이 차트 생성 (수능 스타일)
   * @param {Array} fractions - [{numerator: number, denominator: number}]
   */
  createWithFractions(fractions, options = {}) {
    const segments = fractions.map((f, i) => ({
      value: f.numerator / f.denominator,
      fraction: `\\frac{${f.numerator}}{${f.denominator}}`,
      label: `${f.numerator}/${f.denominator}`,
      color: options.colors?.[i]
    }));

    return this.create(segments, { ...options, labelType: 'fraction' });
  },

  /**
   * KaTeX 분수 라벨이 있는 파이 차트 (HTML 버전)
   */
  createWithKaTeXLabels(fractions, options = {}) {
    const {
      size = 120,
      strokeWidth = 2,
      strokeColor = '#000'
    } = options;

    const total = fractions.reduce((sum, f) => sum + (f.numerator / f.denominator), 0);
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = (size / 2) - 15;
    let currentAngle = -90;

    const paths = [];
    const labelPositions = [];

    fractions.forEach((f, index) => {
      const value = f.numerator / f.denominator;
      const percentage = value / total;
      const angle = percentage * 360;
      const endAngle = currentAngle + angle;

      const startRad = (currentAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      const largeArcFlag = angle > 180 ? 1 : 0;
      const pathD = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

      const color = f.color || this.getDefaultColor(index);
      paths.push(`<path d="${pathD}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`);

      // 라벨 위치
      const midAngle = currentAngle + angle / 2;
      const midRad = (midAngle * Math.PI) / 180;
      const labelRadius = radius * 0.55;
      const labelX = centerX + labelRadius * Math.cos(midRad);
      const labelY = centerY + labelRadius * Math.sin(midRad);

      labelPositions.push({
        x: labelX,
        y: labelY,
        latex: `\\frac{${f.numerator}}{${f.denominator}}`
      });

      currentAngle = endAngle;
    });

    // SVG와 KaTeX 라벨을 함께 포함하는 HTML 반환
    const svgContent = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      ${paths.join('\n')}
    </svg>`;

    // 라벨은 별도의 div로 오버레이
    const labelsHtml = labelPositions.map(pos =>
      `<span class="pie-label" style="left:${pos.x}px;top:${pos.y}px;" data-latex="${pos.latex}">$${pos.latex}$</span>`
    ).join('');

    return `<div class="pie-chart-container" style="position:relative;width:${size}px;height:${size}px;display:inline-block;">
      ${svgContent}
      ${labelsHtml}
    </div>`;
  },

  getDefaultColor(index) {
    const colors = ['#fff', '#e8e8e8', '#d0d0d0', '#b8b8b8', '#a0a0a0'];
    return colors[index % colors.length];
  }
};

/**
 * ==================== 과학 테이블 생성기 ====================
 */
const ScienceTableGenerator = {
  /**
   * 복합 테이블 생성 (병합 셀, 수식, 파이차트 지원)
   * @param {Object} config - 테이블 설정
   */
  create(config) {
    const {
      headers,      // 헤더 행 배열
      rows,         // 데이터 행 배열
      caption,      // 테이블 캡션
      style = 'science', // 스타일: science, exam, simple
      borderStyle = 'all' // 테두리: all, horizontal, none
    } = config;

    let html = `<table class="science-table science-table--${style} science-table--border-${borderStyle}">`;

    if (caption) {
      html += `<caption>${caption}</caption>`;
    }

    // 헤더 처리
    if (headers && headers.length > 0) {
      html += '<thead>';
      headers.forEach(headerRow => {
        html += '<tr>';
        headerRow.forEach(cell => {
          const attrs = this.buildCellAttributes(cell);
          const content = this.processContent(cell.content || cell);
          html += `<th${attrs}>${content}</th>`;
        });
        html += '</tr>';
      });
      html += '</thead>';
    }

    // 바디 처리
    if (rows && rows.length > 0) {
      html += '<tbody>';
      rows.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
          const attrs = this.buildCellAttributes(cell);
          const content = this.processContent(cell.content || cell);
          html += `<td${attrs}>${content}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody>';
    }

    html += '</table>';
    return html;
  },

  /**
   * 셀 속성 빌드
   */
  buildCellAttributes(cell) {
    if (typeof cell === 'string' || typeof cell === 'number') {
      return '';
    }

    let attrs = '';
    if (cell.rowspan) attrs += ` rowspan="${cell.rowspan}"`;
    if (cell.colspan) attrs += ` colspan="${cell.colspan}"`;
    if (cell.align) attrs += ` style="text-align:${cell.align}"`;
    if (cell.class) attrs += ` class="${cell.class}"`;
    return attrs;
  },

  /**
   * 셀 콘텐츠 처리 (수식, 파이차트 등)
   */
  processContent(content) {
    // null/undefined 처리
    if (content === null || content === undefined) {
      return '';
    }

    // 숫자 처리
    if (typeof content === 'number') {
      return String(content);
    }

    // 문자열 처리
    if (typeof content === 'string') {
      // 빈 문자열
      if (content.trim() === '') return '';

      // 이미 $ 로 감싸진 수식
      if (content.startsWith('$') && content.endsWith('$')) {
        return `<span class="math-content">${content}</span>`;
      }

      // LaTeX 수식 감지 및 래핑
      if (content.includes('\\') || content.match(/[_^{}]/)) {
        return `<span class="math-content">$${content}$</span>`;
      }
      return content;
    }

    // 객체 처리
    if (typeof content === 'object' && content !== null) {
      // 파이 차트
      if (content.type === 'pie') {
        return PieChartGenerator.createWithKaTeXLabels(content.fractions, content.options);
      }
      // 화학식
      if (content.type === 'chem') {
        return `<span class="chem-content">$\\ce{${content.formula}}$</span>`;
      }
      // 이미지
      if (content.type === 'image') {
        return `<img src="${content.src}" alt="${content.alt || ''}" style="max-width:${content.maxWidth || '100px'}">`;
      }
      // SVG
      if (content.type === 'svg') {
        return content.svg || '';
      }
      // 알 수 없는 객체 타입은 빈 문자열 반환 (에러 방지)
      console.warn('Unknown content type:', content);
      return '';
    }

    return String(content);
  },

  /**
   * 수능 스타일 혼합 수용액 표 생성 (예시 이미지와 같은 형태)
   */
  createMixtureSolutionTable(data) {
    const {
      solutions,    // [{name: '2x M HA(aq)', values: ['a', 0, 'a']}]
      conditions,   // ['(가)', '(나)', '(다)']
      ionRatios,    // [{fractions: [{n:1,d:5}, {n:3,d:5}, {n:1,d:5}], condition: '(가)'}]
      rowHeader = '혼합 전\n수용액의\n부피(mL)',
      colHeader = '혼합 수용액',
      ionRowHeader = '혼합 수용액에 존재하는\n모든 이온 수의 비율'
    } = data;

    // 헤더 행
    const headers = [
      [
        { content: colHeader, colspan: 2 },
        ...conditions.map(c => ({ content: c }))
      ]
    ];

    // 데이터 행
    const rows = [];

    solutions.forEach((sol, idx) => {
      const row = [];
      if (idx === 0) {
        row.push({
          content: rowHeader.replace(/\n/g, '<br>'),
          rowspan: solutions.length
        });
      }
      row.push({ content: sol.name });
      sol.values.forEach(v => row.push({ content: v }));
      rows.push(row);
    });

    // 이온 비율 행 (파이 차트 포함)
    if (ionRatios && ionRatios.length > 0) {
      const ionRow = [
        { content: ionRowHeader.replace(/\n/g, '<br>'), colspan: 2 }
      ];

      conditions.forEach(cond => {
        const ratio = ionRatios.find(r => r.condition === cond);
        if (ratio) {
          ionRow.push({
            content: {
              type: 'pie',
              fractions: ratio.fractions.map(f => ({ numerator: f.n, denominator: f.d })),
              options: { size: 80 }
            }
          });
        } else {
          ionRow.push({ content: '' });
        }
      });

      rows.push(ionRow);
    }

    return this.create({
      headers,
      rows,
      style: 'exam'
    });
  },

  /**
   * 화학 반응 표 생성
   */
  createReactionTable(data) {
    const {
      reactants,    // 반응물
      products,     // 생성물
      conditions,   // 반응 조건
      showArrow = true
    } = data;

    const headers = [[
      { content: '반응물' },
      { content: '→' },
      { content: '생성물' }
    ]];

    const rows = [[
      { content: reactants.map(r => `$\\ce{${r}}$`).join(' + ') },
      { content: conditions || '' },
      { content: products.map(p => `$\\ce{${p}}$`).join(' + ') }
    ]];

    return this.create({ headers, rows, style: 'science' });
  }
};

/**
 * ==================== 스타일 CSS ====================
 */
const ScienceTableStyles = `
<style>
/* 과학 테이블 기본 스타일 */
.science-table {
  border-collapse: collapse;
  margin: 1rem auto;
  font-family: 'Times New Roman', serif;
  font-size: 14px;
}

.science-table th,
.science-table td {
  padding: 8px 12px;
  text-align: center;
  vertical-align: middle;
}

/* 테두리 스타일 */
.science-table--border-all th,
.science-table--border-all td {
  border: 1px solid #000;
}

.science-table--border-horizontal th,
.science-table--border-horizontal td {
  border-top: 1px solid #000;
  border-bottom: 1px solid #000;
}

/* 시험지 스타일 */
.science-table--exam {
  font-family: 'Batang', 'Times New Roman', serif;
}

.science-table--exam th {
  background: #f8f8f8;
}

/* 파이 차트 컨테이너 */
.pie-chart-container {
  display: inline-block;
  vertical-align: middle;
}

.pie-chart-container .pie-label {
  position: absolute;
  transform: translate(-50%, -50%);
  font-size: 11px;
  pointer-events: none;
}

/* 수식 콘텐츠 */
.math-content,
.chem-content {
  white-space: nowrap;
}

/* 반응형 테이블 */
.science-table-wrapper {
  overflow-x: auto;
  max-width: 100%;
}
</style>
`;

/**
 * ==================== 유틸리티 함수 ====================
 */

/**
 * 테이블을 생성하고 DOM에 삽입
 */
function renderScienceTable(containerId, config) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Container not found:', containerId);
    return;
  }

  // 스타일 추가 (한 번만)
  if (!document.getElementById('science-table-styles')) {
    const styleEl = document.createElement('div');
    styleEl.id = 'science-table-styles';
    styleEl.innerHTML = ScienceTableStyles;
    document.head.appendChild(styleEl);
  }

  container.innerHTML = ScienceTableGenerator.create(config);

  // KaTeX 렌더링 적용
  if (window.renderMathInElement) {
    renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }
}

/**
 * AI 응답에서 테이블 데이터 파싱 및 렌더링
 */
function parseAndRenderTable(jsonString, containerId) {
  try {
    const config = JSON.parse(jsonString);
    renderScienceTable(containerId, config);
    return true;
  } catch (e) {
    console.error('테이블 파싱 오류:', e);
    return false;
  }
}

/**
 * 예시: 수능 화학 혼합 수용액 표 생성
 */
function createExampleMixtureTable() {
  return ScienceTableGenerator.createMixtureSolutionTable({
    solutions: [
      { name: '$2x\\text{ M HA}(aq)$', values: ['$a$', '0', '$a$'] },
      { name: '$x\\text{ M H}_2\\text{B}(aq)$', values: ['$b$', '$b$', '$c$'] },
      { name: '$y\\text{ M NaOH}(aq)$', values: ['0', '$c$', '$b$'] }
    ],
    conditions: ['(가)', '(나)', '(다)'],
    ionRatios: [
      { condition: '(가)', fractions: [{ n: 1, d: 5 }, { n: 3, d: 5 }, { n: 1, d: 5 }] },
      { condition: '(다)', fractions: [{ n: 1, d: 5 }, { n: 3, d: 5 }, { n: 1, d: 5 }] }
    ]
  });
}

/**
 * ==================== AI 응답 표 파싱 및 변환 ====================
 */

/**
 * AI 응답 텍스트에서 표 JSON을 찾아 HTML로 변환
 * @param {string} text - AI 응답 텍스트
 * @returns {string} - 표가 HTML로 변환된 텍스트
 */
function processAIResponseTables(text) {
  if (!text) return text;

  // ```json:table 또는 ```table 블록 찾기
  const tableBlockRegex = /```(?:json:table|table)\s*([\s\S]*?)```/g;

  let processedText = text;
  let match;

  while ((match = tableBlockRegex.exec(text)) !== null) {
    try {
      const jsonStr = match[1].trim();
      const tableData = JSON.parse(jsonStr);

      let tableHtml = '';

      // 표 타입에 따라 처리
      if (tableData.type === 'science-table' || tableData.type === 'mixture-table') {
        // 혼합 수용액 표 (ionRatios가 있는 경우)
        if (tableData.ionRatios && tableData.solutions) {
          tableHtml = ScienceTableGenerator.createMixtureSolutionTable({
            solutions: tableData.solutions || [],
            conditions: tableData.conditions || [],
            ionRatios: tableData.ionRatios || [],
            rowHeader: tableData.rowHeader,
            colHeader: tableData.colHeader,
            ionRowHeader: tableData.ionRowHeader
          });
        }
        // 일반 표
        else if (tableData.headers || tableData.rows) {
          // ionRatios를 행으로 변환
          let rows = tableData.rows || [];

          if (tableData.ionRatios && tableData.conditions) {
            const ionRow = [
              { content: tableData.ionRowHeader || '이온 비율', colspan: 2 }
            ];

            tableData.conditions.forEach(cond => {
              const ratio = tableData.ionRatios.find(r => r.condition === cond);
              if (ratio && ratio.fractions) {
                ionRow.push({
                  content: {
                    type: 'pie',
                    fractions: ratio.fractions.map(f => ({ numerator: f.n, denominator: f.d })),
                    options: { size: 80 }
                  }
                });
              } else {
                ionRow.push({ content: '' });
              }
            });

            rows.push(ionRow);
          }

          tableHtml = ScienceTableGenerator.create({
            headers: tableData.headers || [],
            rows: rows,
            style: tableData.style || 'exam',
            borderStyle: tableData.borderStyle || 'all'
          });
        }
      }
      // 기본 표
      else {
        tableHtml = ScienceTableGenerator.create({
          headers: tableData.headers || [],
          rows: tableData.rows || [],
          style: tableData.style || 'exam'
        });
      }

      // 테이블 래퍼로 감싸기
      const wrappedTable = `<div class="ai-generated-table science-table-wrapper">${tableHtml}</div>`;

      // 원본 JSON 블록을 HTML 테이블로 교체
      processedText = processedText.replace(match[0], wrappedTable);

    } catch (e) {
      console.error('표 JSON 파싱 오류:', e, match[1]);
      // 파싱 실패 시 원본 유지
    }
  }

  return processedText;
}

/**
 * 컨테이너 내의 모든 AI 생성 표에 KaTeX 렌더링 적용
 * @param {HTMLElement} container
 */
function renderAITables(container) {
  if (!container) return;

  const tables = container.querySelectorAll('.ai-generated-table');
  tables.forEach(tableWrapper => {
    if (window.renderMathInElement) {
      renderMathInElement(tableWrapper, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }
  });
}

/**
 * AI 응답 전체 처리 (텍스트 → 표 변환 → 렌더링)
 * @param {string} text - AI 응답 텍스트
 * @param {HTMLElement} container - 렌더링할 컨테이너
 * @returns {string} - 처리된 HTML
 */
function processAndRenderAIResponse(text, container) {
  // 1. 표 JSON을 HTML로 변환
  const processedText = processAIResponseTables(text);

  // 2. 컨테이너에 삽입 후 렌더링
  if (container) {
    setTimeout(() => {
      renderAITables(container);
    }, 50);
  }

  return processedText;
}

// 전역 등록
window.PieChartGenerator = PieChartGenerator;
window.ScienceTableGenerator = ScienceTableGenerator;
window.renderScienceTable = renderScienceTable;
window.parseAndRenderTable = parseAndRenderTable;
window.createExampleMixtureTable = createExampleMixtureTable;
window.processAIResponseTables = processAIResponseTables;
window.renderAITables = renderAITables;
window.processAndRenderAIResponse = processAndRenderAIResponse;
