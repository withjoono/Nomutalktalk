import * as fs from 'fs';

/**
 * 파일 안전 삭제 (비동기, 에러 처리 포함)
 */
export async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code !== 'ENOENT') {
      console.error(`Failed to clean up file: ${filePath}`, err);
    }
  }
}

/**
 * 좌표 라벨 새니타이제이션 (XSS 방지)
 */
export function sanitizeCoordinateLabel(label: string): string {
  if (typeof label !== 'string' || !/^[A-Z]$/.test(label)) {
    return 'P';
  }
  return label;
}

/**
 * 좌표 값 검증
 */
export function isValidCoordinate(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && !Number.isNaN(value);
}

/**
 * 파일 MIME 타입 검증 (화이트리스트 기반)
 */
export function isAllowedMimeType(mimetype: string): boolean {
  const allowedTypes = [
    'text/plain',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
  ];
  return allowedTypes.includes(mimetype);
}

/**
 * displayName 검증
 */
export function isValidDisplayName(name: string): boolean {
  if (typeof name !== 'string') return false;
  return name.length > 0 && name.length <= 100 && !/[<>"'&]/.test(name);
}

/**
 * storeName 검증
 */
export function isValidStoreName(name: string): boolean {
  if (typeof name !== 'string') return false;
  return /^fileSearchStores\/[\w-]+$/.test(name);
}

/**
 * 청크 분할 시뮬레이션
 */
export interface ChunkPreview {
  index: number;
  content: string;
  fullLength: number;
  estimatedTokens: number;
}

export function simulateChunking(text: string, maxTokens: number, overlap: number): ChunkPreview[] {
  const chunks: ChunkPreview[] = [];
  const charsPerChunk = maxTokens * 4;
  const overlapChars = overlap * 4;

  let start = 0;
  let chunkIndex = 1;

  while (start < text.length) {
    const end = Math.min(start + charsPerChunk, text.length);
    const chunkText = text.substring(start, end);

    chunks.push({
      index: chunkIndex,
      content: chunkText.substring(0, 200) + (chunkText.length > 200 ? '...' : ''),
      fullLength: chunkText.length,
      estimatedTokens: Math.ceil(chunkText.length / 4),
    });

    start = end - overlapChars;
    if (start >= text.length || end === text.length) break;
    chunkIndex++;
  }

  return chunks;
}

/**
 * 특수 문자 및 수식 탐지
 */
export interface SpecialCharacterResult {
  hasLatex: boolean;
  hasGreekLetters: boolean;
  hasMathSymbols: boolean;
  hasChemical: boolean;
  samples: Array<{ type: string; content: string }>;
}

export function detectSpecialCharacters(text: string): SpecialCharacterResult {
  const results: SpecialCharacterResult = {
    hasLatex: false,
    hasGreekLetters: false,
    hasMathSymbols: false,
    hasChemical: false,
    samples: [],
  };

  // LaTeX 수식 탐지
  const latexPatterns = [/\$[^$]+\$/g, /\\\[[\s\S]*?\\\]/g, /\\begin\{[^}]+\}/g];
  for (const pattern of latexPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      results.hasLatex = true;
      results.samples.push(
        ...matches.slice(0, 3).map(m => ({ type: 'LaTeX', content: m.substring(0, 50) }))
      );
    }
  }

  // 그리스 문자 탐지
  if (/[α-ωΑ-Ω]/.test(text)) {
    results.hasGreekLetters = true;
    const greekMatches = text.match(/[α-ωΑ-Ω]+/g) || [];
    results.samples.push(...greekMatches.slice(0, 3).map(m => ({ type: 'Greek', content: m })));
  }

  // 수학 기호 탐지
  if (/[∑∫∂√∞±×÷≈≠≤≥∈∉⊂⊃∪∩]/.test(text)) {
    results.hasMathSymbols = true;
    const mathMatches = text.match(/[∑∫∂√∞±×÷≈≠≤≥∈∉⊂⊃∪∩]+/g) || [];
    results.samples.push(...mathMatches.slice(0, 3).map(m => ({ type: 'Math', content: m })));
  }

  // 화학식 탐지
  if (/[A-Z][a-z]?\d*/.test(text) && /[₀-₉]|(?:H2O|CO2|NaCl|O2|N2)/.test(text)) {
    results.hasChemical = true;
    const chemMatches = text.match(/\b[A-Z][a-z]?(?:₀-₉|\d)*\b/g) || [];
    results.samples.push(...chemMatches.slice(0, 3).map(m => ({ type: 'Chemical', content: m })));
  }

  return results;
}

/**
 * 좌표 데이터를 자동으로 감지하여 Plotly 그래프 코드로 변환
 */
export function autoGenerateGraphs(text: string): string {
  let enhanced = text;

  const pointPattern = /점\s*([A-Z])\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g;
  const matches = [...text.matchAll(pointPattern)];

  const MAX_POINTS = 20;
  if (matches.length > MAX_POINTS) {
    console.warn(`⚠️ 너무 많은 좌표 감지됨 (${matches.length}개), ${MAX_POINTS}개로 제한`);
    matches.splice(MAX_POINTS);
  }

  if (matches.length >= 2) {
    console.log(`🎨 자동 그래프 생성: ${matches.length}개의 좌표 감지됨`);

    const points = matches
      .map(m => ({
        label: sanitizeCoordinateLabel(m[1]),
        x: parseFloat(m[2]),
        y: parseFloat(m[3]),
      }))
      .filter(p => isValidCoordinate(p.x) && isValidCoordinate(p.y));

    if (points.length < 2) {
      console.warn('⚠️ 유효한 좌표가 2개 미만, 그래프 생성 건너뜀');
      return enhanced;
    }

    const xCoords = points.map(p => p.x);
    const yCoords = points.map(p => p.y);

    if (points.length >= 3) {
      xCoords.push(points[0].x);
      yCoords.push(points[0].y);
    }

    const annotations = points.map(p => ({
      x: p.x,
      y: p.y,
      text: `${p.label}(${p.x},${p.y})`,
      showarrow: false,
      yshift: 10,
    }));

    const plotlyCode = {
      data: [
        {
          x: xCoords,
          y: yCoords,
          type: 'scatter',
          mode: 'lines+markers',
          fill: points.length >= 3 ? 'toself' : undefined,
          name: points.length >= 3 ? `도형 ${points.map(p => p.label).join('')}` : '좌표',
          marker: { size: 10, color: 'red' },
          line: { color: 'blue', width: 2 },
        },
      ],
      layout: {
        title: `좌표평면: 점 ${points.map(p => p.label).join(', ')}`,
        xaxis: {
          title: 'x',
          zeroline: true,
          gridcolor: '#e0e0e0',
        },
        yaxis: {
          title: 'y',
          zeroline: true,
          gridcolor: '#e0e0e0',
        },
        annotations: annotations,
        showlegend: true,
      },
    };

    const graphBlock = `\n\n\`\`\`plotly\n${JSON.stringify(plotlyCode, null, 2)}\n\`\`\`\n\n`;

    const insertPosition =
      matches[matches.length - 1].index! + matches[matches.length - 1][0].length;
    enhanced = text.slice(0, insertPosition) + graphBlock + text.slice(insertPosition);

    console.log('✅ Plotly 그래프 코드 자동 생성 완료');
  }

  return enhanced;
}
