/**
 * TableGeneratorPlugin - 표/차트 생성 플러그인
 * 과학/수학 교육용 표 및 차트 생성
 */
class TableGeneratorPlugin {
  constructor(options = {}) {
    this.panelController = options.panelController || null;
    this.onError = options.onError || console.error;
    this.onSuccess = options.onSuccess || console.log;
    this.generatedTables = [];
  }

  /**
   * PanelController 설정
   */
  setPanelController(controller) {
    this.panelController = controller;
  }

  /**
   * 표 생성
   * @param {Object} config - 표 설정
   * @returns {Object} 생성된 표 데이터
   */
  generateTable(config = {}) {
    const {
      rows = 3,
      cols = 3,
      headers = [],
      data = [],
      title = '',
      type = 'basic' // basic, science, math
    } = config;

    let tableHtml = '';

    if (title) {
      tableHtml += `<div class="table-title">${title}</div>`;
    }

    tableHtml += '<table class="generated-table">';

    // 헤더 행
    if (headers.length > 0) {
      tableHtml += '<thead><tr>';
      headers.forEach(header => {
        tableHtml += `<th>${header}</th>`;
      });
      tableHtml += '</tr></thead>';
    }

    // 데이터 행
    tableHtml += '<tbody>';
    if (data.length > 0) {
      data.forEach(row => {
        tableHtml += '<tr>';
        row.forEach(cell => {
          tableHtml += `<td>${this.formatCell(cell)}</td>`;
        });
        tableHtml += '</tr>';
      });
    } else {
      // 빈 셀 생성
      for (let i = 0; i < rows; i++) {
        tableHtml += '<tr>';
        for (let j = 0; j < cols; j++) {
          tableHtml += '<td contenteditable="true"></td>';
        }
        tableHtml += '</tr>';
      }
    }
    tableHtml += '</tbody></table>';

    const tableData = {
      id: `table-${Date.now()}`,
      html: tableHtml,
      config,
      createdAt: new Date().toISOString()
    };

    this.generatedTables.push(tableData);
    this.onSuccess('표가 생성되었습니다.');

    return tableData;
  }

  /**
   * 셀 내용 포맷팅 (LaTeX 지원)
   * @param {string} content - 셀 내용
   * @returns {string} 포맷된 내용
   */
  formatCell(content) {
    if (!content) return '';

    // LaTeX 수식 감지
    if (content.includes('$')) {
      return content.replace(/\$(.+?)\$/g, '<span class="katex-inline">$1</span>');
    }

    return content;
  }

  /**
   * 과학 실험 데이터 표 생성
   * @param {Object} experimentData - 실험 데이터
   * @returns {Object} 생성된 표
   */
  generateScienceTable(experimentData) {
    const {
      title = '실험 데이터',
      variables = [],
      trials = [],
      units = {}
    } = experimentData;

    // 헤더 구성
    const headers = ['실험 횟수', ...variables.map(v => {
      const unit = units[v] ? ` (${units[v]})` : '';
      return `${v}${unit}`;
    })];

    // 데이터 구성
    const data = trials.map((trial, index) => {
      return [`${index + 1}차`, ...variables.map(v => trial[v] || '-')];
    });

    // 평균 행 추가
    if (trials.length > 1) {
      const averages = variables.map(v => {
        const values = trials.map(t => parseFloat(t[v])).filter(n => !isNaN(n));
        if (values.length > 0) {
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          return avg.toFixed(2);
        }
        return '-';
      });
      data.push(['평균', ...averages]);
    }

    return this.generateTable({
      title,
      headers,
      data,
      type: 'science'
    });
  }

  /**
   * 수학 좌표표 생성
   * @param {Object} config - 좌표표 설정
   * @returns {Object} 생성된 표
   */
  generateCoordinateTable(config) {
    const {
      xValues = [],
      formula = null,
      title = '좌표표'
    } = config;

    const headers = ['x', 'y'];
    const data = xValues.map(x => {
      let y = '-';
      if (formula && typeof formula === 'function') {
        try {
          y = formula(x);
          if (typeof y === 'number') {
            y = Number.isInteger(y) ? y : y.toFixed(2);
          }
        } catch (e) {
          y = '오류';
        }
      }
      return [x, y];
    });

    return this.generateTable({
      title,
      headers,
      data,
      type: 'math'
    });
  }

  /**
   * 비교 표 생성
   * @param {Object} config - 비교 설정
   * @returns {Object} 생성된 표
   */
  generateComparisonTable(config) {
    const {
      items = [],
      criteria = [],
      title = '비교표'
    } = config;

    const headers = ['항목', ...criteria];
    const data = items.map(item => {
      return [item.name, ...criteria.map(c => item[c] || '-')];
    });

    return this.generateTable({
      title,
      headers,
      data,
      type: 'comparison'
    });
  }

  /**
   * 통계 표 생성
   * @param {Array} values - 데이터 값 배열
   * @param {string} title - 표 제목
   * @returns {Object} 생성된 표
   */
  generateStatisticsTable(values, title = '통계 분석') {
    const sorted = [...values].sort((a, b) => a - b);
    const n = values.length;

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const median = n % 2 === 0
      ? (sorted[n/2 - 1] + sorted[n/2]) / 2
      : sorted[Math.floor(n/2)];
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const min = sorted[0];
    const max = sorted[n - 1];
    const range = max - min;

    const headers = ['통계량', '값'];
    const data = [
      ['데이터 개수', n],
      ['합계', sum.toFixed(2)],
      ['평균', mean.toFixed(2)],
      ['중앙값', median.toFixed(2)],
      ['분산', variance.toFixed(2)],
      ['표준편차', stdDev.toFixed(2)],
      ['최솟값', min],
      ['최댓값', max],
      ['범위', range]
    ];

    return this.generateTable({
      title,
      headers,
      data,
      type: 'statistics'
    });
  }

  /**
   * 표를 패널에 삽입
   * @param {string} tableId - 표 ID
   * @param {string} panelId - 패널 ID
   */
  insertToPanel(tableId, panelId = 'resource-panel') {
    if (!this.panelController) {
      throw new Error('PanelController가 설정되지 않았습니다.');
    }

    const table = this.generatedTables.find(t => t.id === tableId);
    if (!table) {
      throw new Error('표를 찾을 수 없습니다.');
    }

    this.panelController.setContent(panelId, table.html);
    this.onSuccess('표가 패널에 삽입되었습니다.');
  }

  /**
   * 마지막 표를 패널에 삽입
   * @param {string} panelId - 패널 ID
   */
  insertLastToPanel(panelId = 'resource-panel') {
    const lastTable = this.generatedTables[this.generatedTables.length - 1];
    if (lastTable) {
      this.insertToPanel(lastTable.id, panelId);
    }
  }

  /**
   * 표 목록 반환
   * @returns {Array} 표 목록
   */
  getTables() {
    return this.generatedTables;
  }

  /**
   * 특정 표 반환
   * @param {string} tableId - 표 ID
   * @returns {Object|null} 표 데이터
   */
  getTable(tableId) {
    return this.generatedTables.find(t => t.id === tableId) || null;
  }

  /**
   * 표 삭제
   * @param {string} tableId - 표 ID
   */
  deleteTable(tableId) {
    const index = this.generatedTables.findIndex(t => t.id === tableId);
    if (index !== -1) {
      this.generatedTables.splice(index, 1);
      this.onSuccess('표가 삭제되었습니다.');
    }
  }

  /**
   * 표를 HTML 문자열로 내보내기
   * @param {string} tableId - 표 ID
   * @returns {string} HTML 문자열
   */
  exportAsHTML(tableId) {
    const table = this.getTable(tableId);
    return table ? table.html : '';
  }

  /**
   * 표를 CSV로 내보내기
   * @param {string} tableId - 표 ID
   * @returns {string} CSV 문자열
   */
  exportAsCSV(tableId) {
    const table = this.getTable(tableId);
    if (!table || !table.config.data) return '';

    const rows = [];

    // 헤더
    if (table.config.headers) {
      rows.push(table.config.headers.join(','));
    }

    // 데이터
    table.config.data.forEach(row => {
      rows.push(row.map(cell => `"${cell}"`).join(','));
    });

    return rows.join('\n');
  }

  /**
   * 차트 생성 (Canvas)
   * @param {Object} config - 차트 설정
   * @returns {string} Base64 이미지 데이터
   */
  generateChart(config) {
    const {
      type = 'bar', // bar, line, pie
      data = [],
      labels = [],
      title = '',
      width = 400,
      height = 300,
      colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe']
    } = config;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 배경
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 제목
    if (title) {
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, width / 2, 25);
    }

    const padding = 50;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const maxValue = Math.max(...data);

    if (type === 'bar') {
      const barWidth = chartWidth / data.length * 0.8;
      const gap = chartWidth / data.length * 0.2;

      data.forEach((value, index) => {
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding + index * (barWidth + gap);
        const y = height - padding - barHeight;

        ctx.fillStyle = colors[index % colors.length];
        ctx.fillRect(x, y, barWidth, barHeight);

        // 라벨
        if (labels[index]) {
          ctx.fillStyle = '#666666';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(labels[index], x + barWidth / 2, height - padding + 20);
        }

        // 값
        ctx.fillStyle = '#333333';
        ctx.fillText(value.toString(), x + barWidth / 2, y - 5);
      });
    } else if (type === 'pie') {
      const total = data.reduce((a, b) => a + b, 0);
      const centerX = width / 2;
      const centerY = height / 2 + 10;
      const radius = Math.min(chartWidth, chartHeight) / 2 - 20;
      let startAngle = -Math.PI / 2;

      data.forEach((value, index) => {
        const sliceAngle = (value / total) * 2 * Math.PI;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();

        // 라벨
        if (labels[index]) {
          const labelAngle = startAngle + sliceAngle / 2;
          const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
          const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(labels[index], labelX, labelY);
        }

        startAngle += sliceAngle;
      });
    }

    const chartData = {
      id: `chart-${Date.now()}`,
      imageData: canvas.toDataURL('image/png'),
      config,
      createdAt: new Date().toISOString()
    };

    this.onSuccess('차트가 생성되었습니다.');
    return chartData;
  }

  /**
   * 차트를 패널에 삽입
   * @param {Object} chartData - 차트 데이터
   * @param {string} panelId - 패널 ID
   */
  insertChartToPanel(chartData, panelId = 'resource-panel') {
    if (!this.panelController) {
      throw new Error('PanelController가 설정되지 않았습니다.');
    }

    const imgHtml = `<img src="${chartData.imageData}" alt="Generated Chart" style="max-width: 100%;">`;
    this.panelController.setContent(panelId, imgHtml);
    this.onSuccess('차트가 패널에 삽입되었습니다.');
  }
}

// 모듈 내보내기
if (typeof window !== 'undefined') {
  window.TableGeneratorPlugin = TableGeneratorPlugin;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TableGeneratorPlugin;
}
