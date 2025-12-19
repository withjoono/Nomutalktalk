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

// ==================== LLM Chat API ====================
async function callLLMChatAPI(message, context = {}) {
  try {
    // Use the ask API with problem generation context
    const prompt = buildProblemPrompt(message, context);

    const response = await fetch(`${API_BASE}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: prompt,
        useRag: false,
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

  // 1. 엔진 코드 내용 추가 (가장 중요한 컨텍스트)
  if (context.engineCode) {
    prompt += `=== 선택된 엔진 코드 ===
${context.engineCode}
=== 엔진 코드 끝 ===

`;
  } else if (context.selectedEngine) {
    prompt += `사용할 엔진: ${context.selectedEngine.name} (${context.selectedEngine.subject} > ${context.selectedEngine.category})
(참고: 엔진 코드가 로드되지 않았습니다)

`;
  }

  // 2. 문제 편집 패널 내용 추가
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

  // 3. 사용자 요청
  prompt += `사용자 요청: ${userMessage}`;

  return prompt;
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
  // Engine File Upload/Delete
  uploadEngineFile: uploadEngineFile,
  fetchEngineFolders: fetchEngineFolders,
  fetchEngineFiles: fetchEngineFiles,
  fetchEngineFileContent: fetchEngineFileContent,
  deleteEngineFile: deleteEngineFile
};
