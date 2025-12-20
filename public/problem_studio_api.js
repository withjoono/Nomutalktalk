// ==================== Problem Studio API Integration ====================

const API_BASE = '';  // Same origin

// ==================== OCR API ====================
/**
 * OCR API 호출
 * @param {string} imageData - base64 이미지 데이터
 * @param {string} extractType - 추출 유형 ('problem' | 'full')
 * @param {string} ocrModel - OCR 모델 ('gemini' | 'openai' | 'gpt4')
 * @returns {Promise<{text: string, model: string}>}
 */
async function callOCRAPI(imageData, extractType = 'problem', ocrModel = 'gemini') {
  try {
    const response = await fetch(`${API_BASE}/api/ocr-extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: [{
          data: imageData,
          mimeType: 'image/png'
        }],
        extractType: extractType,
        ocrModel: ocrModel
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'OCR 실패');
    }
    // 호환성을 위해 extractedText와 model 정보를 함께 반환
    return result.extractedText;
  } catch (error) {
    console.error('OCR API 오류:', error);
    throw error;
  }
}

// ==================== Auto Label API ====================
async function callAutoLabelAPI(problemText, imageData = null) {
  try {
    const body = { problemText };
    if (imageData) {
      body.images = [{
        data: imageData,
        mimeType: 'image/png'
      }];
    }

    const response = await fetch(`${API_BASE}/api/auto-label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '라벨링 실패');
    }
    return result.labels;
  } catch (error) {
    console.error('Auto Label API 오류:', error);
    throw error;
  }
}

// ==================== RAG 유사 문제 검색 API ====================
/**
 * 유사 문제 검색 (RAG 활용)
 * @param {string} problemText - 검색할 문제 텍스트
 * @param {Object} filters - 필터 옵션 (subject, difficulty 등)
 * @param {number} limit - 결과 개수 제한
 * @returns {Promise<Array>} 유사 문제 목록
 */
async function searchSimilarProblems(problemText, filters = {}, limit = 5) {
  try {
    // 1. 먼저 Firestore의 variations 컬렉션에서 검색
    const response = await fetch(`${API_BASE}/api/variations?limit=${limit * 2}`);
    const result = await response.json();

    if (!result.success || !result.variations || result.variations.length === 0) {
      console.log('저장된 문제가 없습니다. RAG 검색을 건너뜁니다.');
      return [];
    }

    // 2. 키워드 기반 간단한 유사도 매칭
    const keywords = extractKeywords(problemText);
    const scoredProblems = result.variations.map(problem => {
      let score = 0;
      const content = `${problem.originalProblem || ''} ${problem.variationText || ''}`.toLowerCase();

      keywords.forEach(keyword => {
        if (content.includes(keyword.toLowerCase())) {
          score += 1;
        }
      });

      // 과목 필터 매칭
      if (filters.subject && problem.metadata?.subject === filters.subject) {
        score += 2;
      }

      // 난이도 필터 매칭
      if (filters.difficulty && problem.metadata?.difficulty === filters.difficulty) {
        score += 1;
      }

      return { ...problem, similarityScore: score };
    });

    // 3. 점수순 정렬 후 상위 N개 반환
    const topProblems = scoredProblems
      .filter(p => p.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit);

    console.log(`📚 유사 문제 ${topProblems.length}개 발견`);
    return topProblems;

  } catch (error) {
    console.warn('유사 문제 검색 실패:', error.message);
    return [];
  }
}

/**
 * 문제 텍스트에서 핵심 키워드 추출
 */
function extractKeywords(text) {
  // 수학/과학 관련 주요 키워드
  const mathKeywords = [
    '함수', '방정식', '부등식', '미분', '적분', '극한', '수열', '급수',
    '확률', '통계', '벡터', '행렬', '좌표', '기하', '삼각함수',
    '지수', '로그', '다항식', '이차', '삼차', '최댓값', '최솟값',
    '연속', '미분가능', '증가', '감소', '극대', '극소', '변곡점'
  ];

  const physicsKeywords = [
    '속도', '가속도', '힘', '에너지', '운동량', '파동', '전자기',
    '전압', '전류', '저항', '자기장', '전기장', '열역학'
  ];

  const chemKeywords = [
    '반응', '원소', '화합물', '몰', '농도', '산화', '환원',
    '전자', '이온', '결합', '평형', '산', '염기'
  ];

  const allKeywords = [...mathKeywords, ...physicsKeywords, ...chemKeywords];
  const found = allKeywords.filter(kw => text.includes(kw));

  // 숫자 패턴도 추출 (문제의 특성 파악용)
  const numbers = text.match(/\d+/g) || [];

  return [...found, ...numbers.slice(0, 3)];
}

// ==================== 엔진 코드 분석 및 구조화 ====================
/**
 * Python 엔진 코드를 분석하여 구조화된 정보 추출
 * @param {string} engineCode - Python 엔진 코드
 * @returns {Object} 구조화된 엔진 정보
 */
function parseEngineCode(engineCode) {
  if (!engineCode) return null;

  const result = {
    name: '',
    description: '',
    problemType: '',
    mathConcepts: [],
    visualElements: [],
    parameters: [],
    coreModules: [],
    renderFunction: null,
    variationHints: []
  };

  // 1. Docstring에서 이름과 설명 추출
  const docstringMatch = engineCode.match(/"""([\s\S]*?)"""/);
  if (docstringMatch) {
    const docstring = docstringMatch[1].trim();
    const lines = docstring.split('\n');
    result.name = lines[0].trim();
    result.description = lines.slice(1).join(' ').replace(/-+/g, '').trim();
  }

  // 2. import된 core 모듈 분석
  const importMatches = engineCode.matchAll(/from core\.(\w+)_v\d+_\d+ import (.+)/g);
  for (const match of importMatches) {
    const moduleName = match[1];
    const imports = match[2].split(',').map(s => s.trim());
    result.coreModules.push({ module: moduleName, imports });

    // 모듈별 기능 매핑
    const moduleFeatures = {
      'rc_core': '기본 렌더링 설정',
      'font_core': '폰트 및 텍스트 스타일',
      'axis_core': '좌표축 및 그래프 축',
      'label_core': '점/요소 라벨링',
      'dim_core': '치수 및 측정 표시',
      'region_core': '영역 음영 및 색상',
      'view_core': '뷰포트 및 화면 설정',
      'geom_core': '기하학적 도형',
      'angle_core': '각도 표시'
    };

    if (moduleFeatures[moduleName]) {
      result.visualElements.push(moduleFeatures[moduleName]);
    }
  }

  // 3. 수학적 개념 추출 (변수명, 수식에서)
  const mathPatterns = [
    { pattern: /parabola|포물선/i, concept: '포물선/이차함수' },
    { pattern: /line|직선|선분/i, concept: '직선/일차함수' },
    { pattern: /intersection|교점/i, concept: '교점' },
    { pattern: /region|영역/i, concept: '영역' },
    { pattern: /polygon|다각형/i, concept: '다각형' },
    { pattern: /circle|원/i, concept: '원' },
    { pattern: /triangle|삼각형/i, concept: '삼각형' },
    { pattern: /angle|각도/i, concept: '각도' },
    { pattern: /coordinate|좌표/i, concept: '좌표' },
    { pattern: /graph|그래프/i, concept: '그래프' },
    { pattern: /tree|트리/i, concept: '트리/경우의 수' },
    { pattern: /booth|부스/i, concept: '배치 문제' },
    { pattern: /seating|좌석/i, concept: '좌석 배치' },
    { pattern: /door|문/i, concept: '도어/경로' }
  ];

  mathPatterns.forEach(({ pattern, concept }) => {
    if (pattern.test(engineCode)) {
      result.mathConcepts.push(concept);
    }
  });

  // 4. 수정 가능한 파라미터 추출
  // 숫자 리터럴 (좌표, 계수 등)
  const numericPatterns = engineCode.matchAll(/(\w+)\s*=\s*(-?\d+\.?\d*)/g);
  const seenParams = new Set();
  for (const match of numericPatterns) {
    const varName = match[1];
    const value = match[2];
    // 의미있는 변수명만 추출 (xs, ys, A, B 등은 제외)
    if (varName.length > 2 && !seenParams.has(varName) && !varName.startsWith('_')) {
      result.parameters.push({ name: varName, value, type: 'numeric' });
      seenParams.add(varName);
    }
  }

  // 수식 패턴 추출 (예: xs**2 / 8.0)
  const formulaMatches = engineCode.matchAll(/(\w+)\s*=\s*\(?([\w\s\*\+\-\/\.\(\)]+)\)?/g);
  for (const match of formulaMatches) {
    if (match[2].includes('**') || match[2].includes('np.')) {
      result.parameters.push({
        name: match[1],
        formula: match[2].trim(),
        type: 'formula'
      });
    }
  }

  // 5. 좌표 데이터 추출
  const coordMatches = engineCode.matchAll(/\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/g);
  const coords = [];
  for (const match of coordMatches) {
    coords.push({ x: parseFloat(match[1]), y: parseFloat(match[2]) });
  }
  if (coords.length > 0) {
    result.parameters.push({ name: 'coordinates', values: coords, type: 'coordinates' });
  }

  // 6. 변형 힌트 생성
  if (result.mathConcepts.includes('포물선/이차함수')) {
    result.variationHints.push('이차함수의 계수(a, b, c)를 변경하여 다른 형태의 포물선 생성');
    result.variationHints.push('꼭짓점 위치나 축의 방정식 변경');
  }
  if (result.mathConcepts.includes('직선/일차함수')) {
    result.variationHints.push('기울기와 y절편을 변경하여 다른 직선 생성');
  }
  if (result.mathConcepts.includes('영역')) {
    result.variationHints.push('영역의 꼭짓점 좌표를 변경하여 다른 형태 생성');
    result.variationHints.push('음영 영역의 개수나 위치 변경');
  }
  if (result.mathConcepts.includes('다각형')) {
    result.variationHints.push('다각형의 꼭짓점 개수나 위치 변경');
  }

  // 7. 문제 유형 추론
  if (result.description.includes('intersection') || result.mathConcepts.includes('교점')) {
    result.problemType = '교점/연립방정식';
  } else if (result.mathConcepts.includes('영역')) {
    result.problemType = '영역 넓이/부등식 영역';
  } else if (result.mathConcepts.includes('트리/경우의 수')) {
    result.problemType = '경우의 수/확률';
  } else if (result.mathConcepts.includes('배치 문제') || result.mathConcepts.includes('좌석 배치')) {
    result.problemType = '배치/조합';
  } else {
    result.problemType = '도형/기하';
  }

  return result;
}

/**
 * 구조화된 엔진 정보를 프롬프트용 텍스트로 변환
 * @param {Object} engineInfo - parseEngineCode의 결과
 * @param {string} originalCode - 원본 엔진 코드
 * @returns {string} 프롬프트용 텍스트
 */
function buildEnhancedEnginePrompt(engineInfo, originalCode) {
  if (!engineInfo) return '';

  let prompt = `=== 🔧 출제 엔진 분석 결과 ===

📌 엔진명: ${engineInfo.name}
📝 설명: ${engineInfo.description}
🎯 문제 유형: ${engineInfo.problemType}

📊 수학적 개념:
${engineInfo.mathConcepts.map(c => `  • ${c}`).join('\n') || '  (분석 필요)'}

🎨 시각적 요소:
${engineInfo.visualElements.map(v => `  • ${v}`).join('\n') || '  (기본 렌더링)'}

⚙️ 수정 가능한 파라미터:
`;

  // 파라미터 정보 추가
  const numericParams = engineInfo.parameters.filter(p => p.type === 'numeric');
  const formulaParams = engineInfo.parameters.filter(p => p.type === 'formula');
  const coordParams = engineInfo.parameters.filter(p => p.type === 'coordinates');

  if (numericParams.length > 0) {
    prompt += `  [숫자값]\n`;
    numericParams.slice(0, 5).forEach(p => {
      prompt += `    - ${p.name}: ${p.value}\n`;
    });
  }

  if (formulaParams.length > 0) {
    prompt += `  [수식]\n`;
    formulaParams.slice(0, 3).forEach(p => {
      prompt += `    - ${p.name} = ${p.formula}\n`;
    });
  }

  if (coordParams.length > 0 && coordParams[0].values) {
    const coords = coordParams[0].values;
    prompt += `  [좌표점] ${coords.length}개의 좌표점 사용\n`;
  }

  prompt += `
💡 변형 문제 생성 힌트:
${engineInfo.variationHints.map(h => `  • ${h}`).join('\n') || '  • 파라미터 값을 변경하여 새로운 문제 생성'}

=== 엔진 코드 (참고용) ===
\`\`\`python
${originalCode.substring(0, 1500)}${originalCode.length > 1500 ? '\n... (이하 생략)' : ''}
\`\`\`
=== 엔진 정보 끝 ===

⚠️ 중요: 위 엔진의 수학적 개념과 시각적 스타일을 유지하면서 새로운 문제를 생성하세요.
파라미터 값을 변경하여 다양한 변형 문제를 만들 수 있습니다.

`;

  return prompt;
}

// ==================== LLM Chat API ====================
async function callLLMChatAPI(message, context = {}) {
  try {
    // 1. RAG 활성화: 유사 문제 먼저 검색
    let similarProblems = [];
    if (context.useRag !== false) {
      const searchText = context.currentProblem || context.problemEditorContent || message;
      similarProblems = await searchSimilarProblems(searchText, {
        subject: context.subject,
        difficulty: context.difficulty
      });
    }

    // 2. 프롬프트 구성 (유사 문제 포함)
    const prompt = buildProblemPrompt(message, { ...context, similarProblems });

    const response = await fetch(`${API_BASE}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: prompt,
        useRag: false,  // 직접 Gemini 호출 (RAG 컨텍스트는 프롬프트에 포함됨)
        model: 'gemini-2.5-flash'
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'LLM 요청 실패');
    }
    return result.answer;
  } catch (error) {
    console.error('LLM Chat API 오류:', error);
    throw error;
  }
}

function buildProblemPrompt(userMessage, context) {
  let prompt = '';

  // 1. 엔진 코드 분석 및 구조화된 정보 추가 (가장 중요한 컨텍스트)
  if (context.engineCode) {
    // 엔진 코드를 파싱하여 구조화된 정보 추출
    const engineInfo = parseEngineCode(context.engineCode);

    if (engineInfo && engineInfo.name) {
      // 구조화된 엔진 정보 사용
      prompt += buildEnhancedEnginePrompt(engineInfo, context.engineCode);
      console.log('🔧 엔진 분석 완료:', engineInfo.name, '- 개념:', engineInfo.mathConcepts.join(', '));
    } else {
      // 파싱 실패 시 원본 코드 그대로 사용
      prompt += `=== 선택된 엔진 코드 ===
${context.engineCode}
=== 엔진 코드 끝 ===

`;
    }
  } else if (context.selectedEngine) {
    prompt += `사용할 엔진: ${context.selectedEngine.name} (${context.selectedEngine.subject} > ${context.selectedEngine.category})
(참고: 엔진 코드가 로드되지 않았습니다)

`;
  }

  // 2. RAG: 유사 문제 컨텍스트 추가
  if (context.similarProblems && context.similarProblems.length > 0) {
    prompt += `=== 📚 참고: 유사한 기출/변형 문제 ${context.similarProblems.length}개 ===
아래 문제들을 참고하여 유사한 스타일과 난이도로 새로운 문제를 생성하세요.
단, 똑같은 문제가 아닌 새롭고 독창적인 변형 문제를 만들어야 합니다.

`;
    context.similarProblems.forEach((problem, index) => {
      const problemText = problem.variationText || problem.originalProblem || '';
      const metadata = problem.metadata || {};
      prompt += `[참고 문제 ${index + 1}] ${metadata.subject || ''} / ${metadata.difficulty || ''} 난이도
${problemText.substring(0, 500)}${problemText.length > 500 ? '...(생략)' : ''}

`;
    });
    prompt += `=== 유사 문제 참고 끝 ===

⚠️ 주의: 위 문제들과 너무 유사하지 않은 새로운 문제를 생성하세요.

`;
  }

  // 3. 문제 편집 패널 내용 추가
  if (context.problemEditorContent) {
    prompt += `=== 현재 문제 편집 내용 ===
${context.problemEditorContent}
=== 문제 편집 내용 끝 ===

`;
  } else if (context.currentProblem) {
    prompt += `=== 현재 문제 ===
${context.currentProblem}
=== 문제 끝 ===

`;
  }

  // 4. 사용자 요청
  prompt += `사용자 요청: ${userMessage}`;

  return prompt;
}

// ==================== 엔진 기반 변형 생성 지원 ====================
/**
 * 엔진 정보를 기반으로 변형 문제 생성 지침 생성
 * @param {Object} engineInfo - parseEngineCode 결과
 * @returns {Object} 변형 생성 지침
 */
function generateVariationInstructions(engineInfo) {
  if (!engineInfo) {
    return {
      instructions: '',
      variationTypes: [],
      parameterSuggestions: []
    };
  }

  const instructions = [];
  const variationTypes = [];
  const parameterSuggestions = [];

  // 문제 유형별 변형 지침
  switch (engineInfo.problemType) {
    case '교점/연립방정식':
      variationTypes.push('계수 변경', '교점 개수 변경', '함수 유형 변경');
      instructions.push('이차함수와 직선의 교점 개수가 달라지도록 계수를 조정하세요.');
      instructions.push('y절편이나 기울기를 변경하여 다른 교점을 갖도록 하세요.');
      parameterSuggestions.push({ type: '이차함수 계수', example: 'y = ax² + bx + c 에서 a, b, c 값 변경' });
      parameterSuggestions.push({ type: '직선 기울기/절편', example: 'y = mx + n 에서 m, n 값 변경' });
      break;

    case '영역 넓이/부등식 영역':
      variationTypes.push('영역 형태 변경', '좌표 값 변경', '음영 영역 변경');
      instructions.push('다각형의 꼭짓점 좌표를 변경하여 다른 넓이를 갖게 하세요.');
      instructions.push('음영 처리할 영역의 위치나 개수를 변경하세요.');
      parameterSuggestions.push({ type: '꼭짓점 좌표', example: '(x1, y1), (x2, y2), ... 값 변경' });
      parameterSuggestions.push({ type: '영역 분할 방식', example: '직선 또는 곡선으로 영역 분할' });
      break;

    case '경우의 수/확률':
      variationTypes.push('경로 수 변경', '조건 변경', '제약 추가');
      instructions.push('트리 구조의 분기 수를 변경하세요.');
      instructions.push('특정 경로를 제외하는 조건을 추가하세요.');
      parameterSuggestions.push({ type: '분기 수', example: '각 노드에서의 선택지 수 변경' });
      parameterSuggestions.push({ type: '제약 조건', example: '특정 조합 금지 등' });
      break;

    case '배치/조합':
      variationTypes.push('대상 수 변경', '조건 변경', '제약 추가');
      instructions.push('배치할 대상의 수를 변경하세요.');
      instructions.push('인접 조건이나 순서 조건을 변경하세요.');
      parameterSuggestions.push({ type: '대상 수', example: '사람, 물건 등의 개수 변경' });
      parameterSuggestions.push({ type: '배치 조건', example: '특정 위치 고정, 인접 금지 등' });
      break;

    default: // 도형/기하
      variationTypes.push('도형 크기 변경', '좌표 변경', '도형 유형 변경');
      instructions.push('도형의 크기나 위치를 변경하세요.');
      instructions.push('각도나 변의 길이를 변경하세요.');
      parameterSuggestions.push({ type: '좌표값', example: '꼭짓점, 중심점 좌표 변경' });
      parameterSuggestions.push({ type: '크기', example: '반지름, 변의 길이 변경' });
  }

  // 수학적 개념별 추가 지침
  if (engineInfo.mathConcepts.includes('포물선/이차함수')) {
    instructions.push('포물선의 축 또는 꼭짓점 위치를 변경하세요.');
    parameterSuggestions.push({ type: '포물선 파라미터', example: 'y = a(x-h)² + k 에서 a, h, k 변경' });
  }

  if (engineInfo.mathConcepts.includes('직선/일차함수')) {
    instructions.push('직선의 기울기와 y절편을 변경하세요.');
  }

  // 엔진 파라미터에서 구체적인 값 제안
  const numericParams = engineInfo.parameters.filter(p => p.type === 'numeric');
  if (numericParams.length > 0) {
    const sampleParams = numericParams.slice(0, 3);
    sampleParams.forEach(p => {
      const currentVal = parseFloat(p.value);
      const newVal1 = (currentVal * 1.5).toFixed(1);
      const newVal2 = (currentVal * 0.5).toFixed(1);
      parameterSuggestions.push({
        type: p.name,
        example: `현재: ${p.value} → 변형: ${newVal1} 또는 ${newVal2}`
      });
    });
  }

  return {
    instructions: instructions.join('\n'),
    variationTypes,
    parameterSuggestions,
    problemType: engineInfo.problemType,
    mathConcepts: engineInfo.mathConcepts
  };
}

/**
 * 엔진 기반 변형 문제 생성 (향상된 버전)
 * @param {string} problemText - 원본 문제 텍스트
 * @param {string} engineCode - 엔진 코드
 * @param {Object} options - 추가 옵션
 * @returns {Promise<Object>} 변형 문제 생성 결과
 */
async function generateEngineBasedVariation(problemText, engineCode, options = {}) {
  const { count = 3, customInstructions = '' } = options;

  // 엔진 분석
  const engineInfo = parseEngineCode(engineCode);
  const variationGuide = generateVariationInstructions(engineInfo);

  console.log('🔧 엔진 기반 변형 생성:', {
    problemType: variationGuide.problemType,
    variationTypes: variationGuide.variationTypes
  });

  // 향상된 지침 구성
  let enhancedInstructions = '';

  if (variationGuide.instructions) {
    enhancedInstructions += `=== 엔진 기반 변형 지침 ===\n`;
    enhancedInstructions += `문제 유형: ${variationGuide.problemType}\n`;
    enhancedInstructions += `수학 개념: ${variationGuide.mathConcepts.join(', ')}\n\n`;
    enhancedInstructions += `[변형 방법]\n${variationGuide.instructions}\n\n`;

    if (variationGuide.parameterSuggestions.length > 0) {
      enhancedInstructions += `[파라미터 변경 제안]\n`;
      variationGuide.parameterSuggestions.forEach(s => {
        enhancedInstructions += `• ${s.type}: ${s.example}\n`;
      });
      enhancedInstructions += '\n';
    }

    if (variationGuide.variationTypes.length > 0) {
      enhancedInstructions += `[가능한 변형 유형]: ${variationGuide.variationTypes.join(', ')}\n\n`;
    }
  }

  if (customInstructions) {
    enhancedInstructions += `[사용자 추가 지침]\n${customInstructions}\n`;
  }

  // API 호출
  return callGenerateVariationAPI(problemText, count, enhancedInstructions, null);
}

// ==================== Generate Variation API ====================
async function callGenerateVariationAPI(problemText, count = 3, instructions = '', engineId = null) {
  try {
    const body = {
      originalProblem: problemText,
      variationCount: count,
      instructions: instructions,
      geminiModel: 'gemini-2.5-flash'
    };

    if (engineId) {
      body.engineId = engineId;
    }

    const response = await fetch(`${API_BASE}/api/generate-variation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '변형 문제 생성 실패');
    }
    return result.variations || [];
  } catch (error) {
    console.error('Generate Variation API 오류:', error);
    throw error;
  }
}

// ==================== Engine APIs ====================
async function fetchEngines() {
  try {
    const response = await fetch(`${API_BASE}/api/engines`);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '엔진 목록 조회 실패');
    }
    return result.engines || [];
  } catch (error) {
    console.error('Fetch Engines API 오류:', error);
    throw error;
  }
}

async function fetchEngineById(engineId) {
  try {
    const response = await fetch(`${API_BASE}/api/engines/${engineId}`);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '엔진 조회 실패');
    }
    return result.engine;
  } catch (error) {
    console.error('Fetch Engine API 오류:', error);
    throw error;
  }
}

async function saveEngine(engineData) {
  try {
    const response = await fetch(`${API_BASE}/api/engines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(engineData)
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '엔진 저장 실패');
    }
    return result;
  } catch (error) {
    console.error('Save Engine API 오류:', error);
    throw error;
  }
}

async function updateEngine(engineId, engineData) {
  try {
    const response = await fetch(`${API_BASE}/api/engines/${engineId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(engineData)
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '엔진 업데이트 실패');
    }
    return result;
  } catch (error) {
    console.error('Update Engine API 오류:', error);
    throw error;
  }
}

// ==================== Problems/Variations DB APIs ====================
async function fetchProblemsFromDB(filters = {}) {
  try {
    let url = `${API_BASE}/api/variations`;
    const params = new URLSearchParams();

    if (filters.status) params.append('status', filters.status);
    if (filters.subject) params.append('subject', filters.subject);
    if (filters.search) params.append('search', filters.search);

    if (params.toString()) {
      url += '?' + params.toString();
    }

    const response = await fetch(url);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '문제 목록 조회 실패');
    }
    return result.variations || [];
  } catch (error) {
    console.error('Fetch Problems API 오류:', error);
    throw error;
  }
}

async function saveProblemToDB(problemData, status = 'pending') {
  try {
    const response = await fetch(`${API_BASE}/api/save-variation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...problemData,
        status: status
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '문제 저장 실패');
    }
    return result;
  } catch (error) {
    console.error('Save Problem API 오류:', error);
    throw error;
  }
}

async function approveProblem(problemId) {
  try {
    const response = await fetch(`${API_BASE}/api/variation/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variationId: problemId,
        approved: true
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '승인 실패');
    }
    return result;
  } catch (error) {
    console.error('Approve Problem API 오류:', error);
    throw error;
  }
}

// ==================== RAG Index API ====================
async function indexProblemToRAG(problemId, problemContent) {
  try {
    const response = await fetch(`${API_BASE}/api/rag/reindex/${problemId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: problemContent })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'RAG 인덱싱 실패');
    }
    return result;
  } catch (error) {
    console.error('RAG Index API 오류:', error);
    throw error;
  }
}

// ==================== Auto Engine Selection ====================
async function autoSelectEngine(problemText) {
  try {
    // Use LLM to analyze problem and suggest engine
    const response = await fetch(`${API_BASE}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `다음 문제를 분석하여 가장 적합한 출제 엔진을 추천해주세요.

문제:
${problemText}

다음 JSON 형식으로만 응답해주세요:
{
  "subject": "수학/물리/화학/생명과학",
  "category": "세부 단원",
  "type": "문제 유형",
  "difficulty": "상/중/하",
  "suggestedEngine": "추천 엔진 이름",
  "reason": "추천 이유"
}`,
        useRag: false,
        model: 'gemini-2.5-flash'
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '엔진 분석 실패');
    }

    // Parse JSON from response
    try {
      const jsonMatch = result.answer.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('JSON 파싱 실패, 텍스트 응답 반환');
    }

    return { raw: result.answer };
  } catch (error) {
    console.error('Auto Select Engine API 오류:', error);
    throw error;
  }
}

// ==================== Multi-LLM Review API ====================
async function callMultiLLMReview(problemText) {
  try {
    const response = await fetch(`${API_BASE}/api/multi-llm-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problemText: problemText
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '멀티 LLM 검토 실패');
    }
    return result.reviews;
  } catch (error) {
    console.error('Multi-LLM Review API 오류:', error);
    throw error;
  }
}

// ==================== Problem Workflow API ====================
/**
 * 멀티 모델 문제 출제 워크플로우 API
 * Step 1: 문제 생성 (GPT 모델)
 * Step 2: 자동 검증 (o3 모델)
 * Step 3: 최종 해설 (o3 모델)
 *
 * @param {Object} options - 워크플로우 옵션
 * @param {string} options.prompt - 문제 출제 요청
 * @param {string} options.engineCode - 선택된 엔진 코드 (선택적)
 * @param {string} options.context - 추가 컨텍스트 (선택적)
 * @param {Object} options.models - 각 단계별 모델 지정
 * @param {string} options.models.generation - 문제 생성 모델 (기본: gpt-4o)
 * @param {string} options.models.verification - 검증 모델 (기본: o3)
 * @param {string} options.models.explanation - 해설 모델 (기본: o3)
 * @param {Function} onStepUpdate - 단계별 진행 콜백
 * @returns {Promise<Object>} 워크플로우 결과
 */
async function callProblemWorkflow(options, onStepUpdate = null) {
  try {
    const { prompt, engineCode, context, models = {}, useRag = true } = options;

    // 기본 모델 설정
    const defaultModels = {
      generation: 'gpt-4o',      // 문제 생성
      verification: 'o3',        // 자동 검증
      explanation: 'o3'          // 해설 작성
    };

    const finalModels = { ...defaultModels, ...models };

    if (onStepUpdate) {
      onStepUpdate({ step: 0, status: 'starting', message: '워크플로우 시작...' });
    }

    // 엔진 코드 분석 및 구조화
    let engineContext = '';
    let engineInfo = null;
    if (engineCode) {
      if (onStepUpdate) {
        onStepUpdate({ step: 0.3, status: 'analyzing', message: '🔧 엔진 코드 분석 중...' });
      }

      engineInfo = parseEngineCode(engineCode);
      if (engineInfo && engineInfo.name) {
        engineContext = buildEnhancedEnginePrompt(engineInfo, engineCode);
        console.log('🔧 엔진 분석 완료:', engineInfo.name, '- 문제 유형:', engineInfo.problemType);
      }
    }

    // RAG: 유사 문제 검색
    let ragContext = '';
    if (useRag) {
      if (onStepUpdate) {
        onStepUpdate({ step: 0.5, status: 'searching', message: '📚 유사 문제 검색 중...' });
      }

      const searchText = prompt || context || '';
      const similarProblems = await searchSimilarProblems(searchText, {}, 3);

      if (similarProblems.length > 0) {
        ragContext = `\n\n=== 📚 참고: 유사 문제 ${similarProblems.length}개 ===\n`;
        ragContext += `아래 문제들을 참고하되, 완전히 새로운 문제를 생성하세요.\n\n`;

        similarProblems.forEach((problem, index) => {
          const text = problem.variationText || problem.originalProblem || '';
          ragContext += `[참고 ${index + 1}] ${text.substring(0, 300)}...\n\n`;
        });

        ragContext += `=== 참고 끝 ===\n`;
        console.log(`📚 RAG: ${similarProblems.length}개 유사 문제를 프롬프트에 추가`);
      }
    }

    // 프롬프트 조합: 엔진 컨텍스트 + 사용자 프롬프트 + RAG 컨텍스트
    let enrichedPrompt = '';
    if (engineContext) {
      enrichedPrompt += engineContext + '\n';
    }
    enrichedPrompt += prompt;
    if (ragContext) {
      enrichedPrompt += ragContext;
    }

    const response = await fetch(`${API_BASE}/api/problem-workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: enrichedPrompt,
        engineCode,
        context,
        models: finalModels
      })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '문제 출제 워크플로우 실패');
    }

    if (onStepUpdate) {
      onStepUpdate({ step: 'complete', status: 'success', message: '워크플로우 완료' });
    }

    return result.workflow;
  } catch (error) {
    console.error('Problem Workflow API 오류:', error);
    throw error;
  }
}

/**
 * Gemini로 수동 검증 (선택적)
 * 연산 정확도가 높은 Gemini 모델로 최종 검증
 *
 * @param {Object} problem - 검증할 문제
 * @param {string} geminiModel - 사용할 Gemini 모델 (기본: gemini-2.5-flash)
 * @returns {Promise<Object>} 검증 결과
 */
async function callGeminiManualReview(problem, geminiModel = 'gemini-2.5-flash') {
  try {
    const response = await fetch(`${API_BASE}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `당신은 수학 문제 검증 전문가입니다. 특히 연산 정확도에 집중하여 검증해주세요.

## 검증할 문제
${typeof problem === 'string' ? problem : JSON.stringify(problem, null, 2)}

## 검증 항목
1. 모든 수치 계산이 정확한가?
2. 수식 표현이 올바른가?
3. 정답 도출 과정이 수학적으로 정확한가?

## 출력 형식 (JSON)
{
  "manualReview": {
    "calculationAccuracy": {
      "isAccurate": true/false,
      "issues": [],
      "corrections": []
    },
    "formulaAccuracy": {
      "isCorrect": true/false,
      "issues": []
    },
    "overallVerdict": "승인/수정필요/거부",
    "confidence": 0-100,
    "notes": "추가 메모"
  }
}`,
        useRag: false,
        model: geminiModel
      })
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Gemini 수동 검증 실패');
    }

    // JSON 파싱 시도
    try {
      const match = result.answer.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch (e) {
      // 파싱 실패 시 원본 반환
    }

    return { raw: result.answer };
  } catch (error) {
    console.error('Gemini Manual Review API 오류:', error);
    throw error;
  }
}

// ==================== Engine File Upload API ====================

/**
 * 엔진 파일 업로드
 */
async function uploadEngineFile(file, targetFolder, overwrite = false) {
  try {
    const formData = new FormData();
    formData.append('engineFile', file);
    formData.append('targetFolder', targetFolder);
    formData.append('overwrite', overwrite.toString());

    const response = await fetch(API_BASE + '/api/engines/upload-file', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '엔진 파일 업로드 실패');
    }
    return result;
  } catch (error) {
    console.error('Upload Engine File API 오류:', error);
    throw error;
  }
}

/**
 * 업로드 가능한 엔진 폴더 목록 조회
 */
async function fetchEngineFolders() {
  try {
    const response = await fetch(API_BASE + '/api/engines/folders');
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '엔진 폴더 목록 조회 실패');
    }
    return result.folders;
  } catch (error) {
    console.error('Fetch Engine Folders API 오류:', error);
    throw error;
  }
}

/**
 * 실제 엔진 파일 목록 조회 (파일시스템 스캔)
 */
async function fetchEngineFiles() {
  try {
    const response = await fetch(API_BASE + '/api/engines/files');
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '엔진 파일 목록 조회 실패');
    }
    return result.engines;
  } catch (error) {
    console.error('Fetch Engine Files API 오류:', error);
    throw error;
  }
}

/**
 * 엔진 파일 내용 읽기
 */
async function fetchEngineFileContent(folder, filename) {
  try {
    const response = await fetch(API_BASE + '/api/engines/file-content?folder=' + encodeURIComponent(folder) + '&filename=' + encodeURIComponent(filename));
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '파일 내용 조회 실패');
    }
    return result.content;
  } catch (error) {
    console.error('Fetch Engine File Content API 오류:', error);
    throw error;
  }
}

/**
 * 엔진 파일 삭제
 */
async function deleteEngineFile(folder, filename) {
  try {
    const response = await fetch(API_BASE + '/api/engines/file', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, filename })
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '파일 삭제 실패');
    }
    return result;
  } catch (error) {
    console.error('Delete Engine File API 오류:', error);
    throw error;
  }
}

// ==================== Python 엔진 실행 API ====================
/**
 * Python 엔진을 실행하여 이미지 생성
 * @param {string} folder - 엔진 폴더 (예: 'graph_2d', 'geometry_2d')
 * @param {string} filename - 엔진 파일명 (예: 'gr_parabola_line_plugin_v1_0.py')
 * @param {Object} params - 엔진에 전달할 파라미터 (선택적)
 * @returns {Promise<Object>} { success, png_base64, svg_base64, ... }
 */
async function runPythonEngine(folder, filename, params = null) {
  try {
    console.log(`🐍 Python 엔진 실행 요청: ${folder}/${filename}`);

    const body = { folder, filename };
    if (params) {
      body.params = params;
    }

    const response = await fetch(`${API_BASE}/api/engines/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Python 엔진 실행 실패');
    }

    console.log(`✅ 엔진 실행 성공: ${filename}`);
    return result;
  } catch (error) {
    console.error('Python 엔진 실행 API 오류:', error);
    throw error;
  }
}

/**
 * 선택된 엔진으로 이미지를 생성하고 base64 데이터 URL 반환
 * @param {string} folder - 엔진 폴더
 * @param {string} filename - 엔진 파일명
 * @param {Object} params - 파라미터
 * @returns {Promise<string>} data:image/png;base64,... 형식의 URL
 */
async function generateEngineImage(folder, filename, params = null) {
  const result = await runPythonEngine(folder, filename, params);

  if (result.png_base64) {
    return `data:image/png;base64,${result.png_base64}`;
  } else if (result.svg_base64) {
    return `data:image/svg+xml;base64,${result.svg_base64}`;
  } else {
    throw new Error('엔진이 이미지를 생성하지 않았습니다.');
  }
}

/**
 * 변형 문제 + 이미지 생성 통합 함수
 * 1. 엔진 실행으로 이미지 생성
 * 2. LLM으로 변형 문제 텍스트 생성
 * 3. 이미지 + 텍스트 결합하여 반환
 *
 * @param {Object} options - 옵션
 * @param {string} options.folder - 엔진 폴더
 * @param {string} options.filename - 엔진 파일명
 * @param {string} options.problemText - 원본 문제 텍스트
 * @param {Object} options.engineParams - 엔진 파라미터 (변형용)
 * @param {string} options.customInstructions - 추가 변형 지침
 * @returns {Promise<Object>} { problem, image, metadata }
 */
async function generateVariationWithImage(options) {
  const {
    folder,
    filename,
    problemText,
    engineParams = null,
    customInstructions = ''
  } = options;

  try {
    console.log('🔄 이미지 포함 변형 문제 생성 시작...');

    // 1. 엔진 코드 로드 및 분석
    const engineContent = await fetchEngineFileContent(folder, filename);
    const engineCode = engineContent.content;
    const engineInfo = parseEngineCode(engineCode);

    console.log(`📊 엔진 분석: ${engineInfo.name} - ${engineInfo.problemType}`);

    // 2. Python 엔진 실행으로 이미지 생성
    console.log('🖼️ 이미지 생성 중...');
    const imageResult = await runPythonEngine(folder, filename, engineParams);
    const imageDataUrl = imageResult.png_base64
      ? `data:image/png;base64,${imageResult.png_base64}`
      : null;

    // 3. 변형 지침 생성
    const variationGuide = generateVariationInstructions(engineInfo);

    // 4. LLM으로 변형 문제 텍스트 생성
    console.log('📝 변형 문제 텍스트 생성 중...');
    let enhancedInstructions = `
=== 엔진 기반 변형 지침 ===
문제 유형: ${variationGuide.problemType}
수학 개념: ${variationGuide.mathConcepts.join(', ')}

[변형 방법]
${variationGuide.instructions}

[중요] 이미지가 이미 생성되었으므로, 이미지에 맞는 문제 텍스트를 생성하세요.
`;

    if (customInstructions) {
      enhancedInstructions += `\n[추가 지침]\n${customInstructions}\n`;
    }

    const variations = await callGenerateVariationAPI(
      problemText,
      1, // 변형 1개
      enhancedInstructions,
      null
    );

    const variationText = variations[0] || '';

    // 5. 결과 조합
    const result = {
      success: true,
      problem: {
        text: variationText,
        image: imageDataUrl
      },
      metadata: {
        engine: filename,
        folder: folder,
        problemType: engineInfo.problemType,
        mathConcepts: engineInfo.mathConcepts,
        generatedAt: new Date().toISOString()
      }
    };

    console.log('✅ 이미지 포함 변형 문제 생성 완료');
    return result;

  } catch (error) {
    console.error('이미지 포함 변형 문제 생성 오류:', error);
    throw error;
  }
}

// Export for use in problem_studio.html
window.StudioAPI = {
  ocr: callOCRAPI,
  autoLabel: callAutoLabelAPI,
  chat: callLLMChatAPI,
  generateVariation: callGenerateVariationAPI,
  fetchEngines: fetchEngines,
  fetchEngineById: fetchEngineById,
  saveEngine: saveEngine,
  updateEngine: updateEngine,
  fetchProblems: fetchProblemsFromDB,
  saveProblem: saveProblemToDB,
  approveProblem: approveProblem,
  indexToRAG: indexProblemToRAG,
  autoSelectEngine: autoSelectEngine,
  multiLLMReview: callMultiLLMReview,
  // Problem Workflow (Multi-Model)
  problemWorkflow: callProblemWorkflow,
  geminiManualReview: callGeminiManualReview,
  // Engine File Upload/Delete
  uploadEngineFile: uploadEngineFile,
  fetchEngineFolders: fetchEngineFolders,
  fetchEngineFiles: fetchEngineFiles,
  fetchEngineFileContent: fetchEngineFileContent,
  deleteEngineFile: deleteEngineFile,
  // RAG 유사 문제 검색
  searchSimilarProblems: searchSimilarProblems,
  // 엔진 코드 분석
  parseEngineCode: parseEngineCode,
  buildEnhancedEnginePrompt: buildEnhancedEnginePrompt,
  // 엔진 기반 변형 생성
  generateVariationInstructions: generateVariationInstructions,
  generateEngineBasedVariation: generateEngineBasedVariation,
  // Python 엔진 실행
  runPythonEngine: runPythonEngine,
  generateEngineImage: generateEngineImage,
  generateVariationWithImage: generateVariationWithImage
};
