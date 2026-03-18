const { GoogleGenAI } = require('@google/genai');
const path = require('path');

/**
 * Gemini API의 File Search 기능을 쉽게 사용할 수 있도록 추상화한 클래스
 */
class FileSearchManager {
  /**
   * @param {string} apiKey - Google Gemini API 키
   */
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('API 키가 필요합니다');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * 새로운 File Search Store 생성
   * @param {string} displayName - 스토어 이름
   * @returns {Promise<Object>} 생성된 스토어 정보
   */
  async createStore(displayName) {
    const store = await this.ai.fileSearchStores.create({
      config: { displayName }
    });
    return store;
  }

  /**
   * 모든 File Search Store 목록 조회
   * @param {number} pageSize - 페이지당 항목 수 (기본값: 20)
   * @returns {Promise<Array>} 스토어 목록
   */
  async listStores(pageSize = 20) {
    const stores = await this.ai.fileSearchStores.list({
      config: { pageSize }
    });
    const storeList = [];
    for await (const store of stores) {
      storeList.push(store);
    }
    return storeList;
  }

  /**
   * 특정 File Search Store 조회
   * @param {string} storeName - 스토어 이름 (예: 'fileSearchStores/xxx')
   * @returns {Promise<Object>} 스토어 정보
   */
  async getStore(storeName) {
    const store = await this.ai.fileSearchStores.get({
      name: storeName
    });
    return store;
  }

  /**
   * 특정 스토어 삭제
   * @param {string} storeName - 삭제할 스토어 이름 (예: 'fileSearchStores/xxx')
   * @param {boolean} force - 비어있지 않은 스토어도 강제 삭제 (기본값: true)
   */
  async deleteStore(storeName, force = true) {
    await this.ai.fileSearchStores.delete({
      name: storeName,
      config: { force }
    });
  }

  /**
   * 스토어 이름(displayName) 수정
   * @param {string} storeName - 스토어 이름 (예: 'fileSearchStores/xxx')
   * @param {string} newDisplayName - 새로운 표시 이름
   * @returns {Promise<Object>} 업데이트된 스토어 정보
   */
  async renameStore(storeName, newDisplayName) {
    // Google AI SDK의 update 메서드 사용
    const updatedStore = await this.ai.fileSearchStores.update({
      name: storeName,
      config: { displayName: newDisplayName }
    });
    return updatedStore;
  }

  /**
   * 스토어에 파일 업로드
   * @param {string} filePath - 업로드할 파일 경로
   * @param {string} storeName - 스토어 이름 (예: 'fileSearchStores/xxx')
   * @param {Object} options - 업로드 옵션
   * @param {string} options.mimeType - 파일의 MIME 타입 (예: 'application/x-hwp')
   * @param {number} options.pollInterval - 업로드 완료 체크 간격 (밀리초, 기본값: 5000)
   * @param {Object} options.chunkingConfig - 청크 구성 설정
   * @param {Object} options.chunkingConfig.whiteSpaceConfig - 공백 기반 청킹 설정
   * @param {number} options.chunkingConfig.whiteSpaceConfig.maxTokensPerChunk - 청크당 최대 토큰 수
   * @param {number} options.chunkingConfig.whiteSpaceConfig.maxOverlapTokens - 청크 간 오버랩 토큰 수
   * @returns {Promise<Object>} 완료된 작업 정보
   */
  async uploadFile(filePath, storeName, options = {}) {
    const { mimeType, pollInterval = 5000, chunkingConfig } = options;

    const uploadParams = {
      file: filePath,
      fileSearchStoreName: storeName,
    };

    // config 설정
    const config = {};

    if (mimeType) {
      config.mimeType = mimeType;
    }

    if (chunkingConfig) {
      config.chunkingConfig = this._buildChunkingConfig(chunkingConfig);
    }

    if (Object.keys(config).length > 0) {
      uploadParams.config = config;
    }

    let operation = await this.ai.fileSearchStores.uploadToFileSearchStore(uploadParams);

    // 업로드 완료까지 대기
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      operation = await this.ai.operations.get({ operation });
    }

    return operation;
  }

  /**
   * 스토어 내 문서 목록 조회
   * @param {string} storeName - 스토어 이름 (예: 'fileSearchStores/xxx')
   * @returns {Promise<Array>} 문서 목록
   */
  async listDocuments(storeName) {
    const documents = await this.ai.fileSearchStores.documents.list({
      parent: storeName
    });
    const docList = [];
    for await (const doc of documents) {
      docList.push(doc);
    }
    return docList;
  }

  /**
   * 스토어에서 문서 삭제
   * @param {string} documentName - 삭제할 문서 이름 (예: 'fileSearchStores/xxx/documents/yyy')
   * @param {boolean} force - 강제 삭제 여부 (기본값: true)
   */
  async deleteDocument(documentName, force = true) {
    await this.ai.fileSearchStores.documents.delete({
      name: documentName,
      config: { force }
    });
  }

  /**
   * File Search를 사용하여 질문에 답변
   * @param {string} query - 질문 내용
   * @param {string|Array<string>} storeNames - 검색할 스토어 이름(들)
   * @param {string} model - 사용할 모델 (기본값: 'gemini-2.5-pro')
   * @returns {Promise<string>} 답변 텍스트
   */
  async search(query, storeNames, model = 'gemini-2.5-pro') {
    // storeNames를 배열로 정규화
    const storeNameArray = Array.isArray(storeNames) ? storeNames : [storeNames];

    // 시스템 프롬프트: 그래프 생성 방법 안내
    const systemPrompt = `당신은 전문 교육 AI 어시스턴트입니다. 답변 시 다음 규칙을 **반드시** 따르세요:

## ⚠️ 중요: 시각화 필수 규칙

다음 상황에서는 **반드시** 그래프/다이어그램을 포함해야 합니다:
- 기하학적 도형, 좌표평면, 함수 그래프가 언급되는 경우
- 수학 문제에서 시각적 이해가 필요한 경우
- 프로세스, 순서도, 관계도가 필요한 경우
- 통계 데이터, 비교 분석이 필요한 경우

**텍스트 설명만으로는 부족합니다. 반드시 시각화를 포함하세요!**

## 📊 그래프 및 시각화 가이드라인

답변에 그래프나 다이어그램이 필요한 경우, 다음 형식을 사용하세요:

### 1. Mermaid 다이어그램 (순서도, 시퀀스, 프로세스)
\`\`\`mermaid
graph TD
    A[시작] --> B{조건}
    B -->|Yes| C[처리]
    B -->|No| D[종료]
\`\`\`

**사용 예시:**
- 순서도: \`graph TD\`, \`graph LR\`
- 시퀀스 다이어그램: \`sequenceDiagram\`
- 파이 차트: \`pie title "제목"\`
- 간트 차트: \`gantt\`

### 2. Plotly 그래프 (수학 함수, 통계, 과학 데이터)

**기본 함수 그래프:**
\`\`\`plotly
{
  "data": [{
    "x": [1, 2, 3, 4, 5],
    "y": [1, 4, 9, 16, 25],
    "type": "scatter",
    "mode": "lines+markers",
    "name": "y = x²",
    "line": {"color": "rgb(102, 126, 234)"}
  }],
  "layout": {
    "title": "이차 함수 그래프",
    "xaxis": {"title": "x"},
    "yaxis": {"title": "y"}
  }
}
\`\`\`

**좌표평면 위의 도형 (삼각형, 사각형 등):**
\`\`\`plotly
{
  "data": [{
    "x": [1, 5, 3, 1],
    "y": [1, 1, 4, 1],
    "type": "scatter",
    "mode": "lines+markers",
    "fill": "toself",
    "name": "삼각형 ABC",
    "marker": {"size": 10, "color": "red"},
    "line": {"color": "blue", "width": 2}
  }],
  "layout": {
    "title": "삼각형 ABC",
    "xaxis": {"title": "x", "range": [0, 6]},
    "yaxis": {"title": "y", "range": [0, 5]},
    "annotations": [
      {"x": 1, "y": 1, "text": "A(1,1)", "showarrow": false},
      {"x": 5, "y": 1, "text": "B(5,1)", "showarrow": false},
      {"x": 3, "y": 4, "text": "C(3,4)", "showarrow": false}
    ]
  }
}
\`\`\`

**사용 예시:**
- 선 그래프: \`"type": "scatter"\`, \`"mode": "lines"\`
- 점과 선: \`"mode": "lines+markers"\`
- 도형 채우기: \`"fill": "toself"\`
- 레이블 추가: \`"annotations": [{...}]\`
- 막대 그래프: \`"type": "bar"\`
- 3D 표면: \`"type": "surface"\`

### 3. Chart.js 그래프 (통계 차트)
\`\`\`chartjs
{
  "type": "bar",
  "data": {
    "labels": ["A", "B", "C"],
    "datasets": [{
      "label": "데이터",
      "data": [10, 20, 30],
      "backgroundColor": "rgba(102, 126, 234, 0.5)"
    }]
  }
}
\`\`\`

**사용 예시:**
- 막대: \`"type": "bar"\`
- 선: \`"type": "line"\`
- 파이: \`"type": "pie"\`
- 레이더: \`"type": "radar"\`

### 4. JSXGraph (인터랙티브 기하학) ⭐ 권장
\`\`\`jsxgraph
{
  "title": "삼각형 ABC",
  "description": "점을 드래그하여 삼각형을 변형할 수 있습니다",
  "board": {
    "boundingbox": [-2, 6, 8, -2],
    "axis": true,
    "showNavigation": false,
    "showCopyright": false
  },
  "elements": [
    {
      "type": "point",
      "coords": [1, 1],
      "attributes": {
        "name": "A",
        "size": 4,
        "color": "red"
      }
    },
    {
      "type": "point",
      "coords": [5, 1],
      "attributes": {
        "name": "B",
        "size": 4,
        "color": "red"
      }
    },
    {
      "type": "point",
      "coords": [3, 4],
      "attributes": {
        "name": "C",
        "size": 4,
        "color": "red"
      }
    },
    {
      "type": "polygon",
      "points": [[1,1], [5,1], [3,4]],
      "attributes": {
        "fillColor": "#667eea",
        "fillOpacity": 0.3
      }
    }
  ]
}
\`\`\`

**지원 요소:**
- \`point\`: 점 (드래그 가능)
- \`line\`: 직선
- \`segment\`: 선분
- \`polygon\`: 다각형
- \`circle\`: 원
- \`angle\`: 각도
- \`arc\`: 호

**사용 팁:**
- 기하학 문제에 JSXGraph 사용 권장 (인터랙티브)
- 단순 시각화는 Plotly 사용
- \`boundingbox\`: [xmin, ymax, xmax, ymin] 형식

## 📐 수학 공식 렌더링

LaTeX 문법을 사용하세요:
- 인라인: \$E = mc^2\$
- 블록: \$\$\\int_a^b f(x) dx\$\$
- 색상: \$\\color{red}{x^2}\$
- 화학식: \$\\ce{H2O}\$

## 🎯 그래프 선택 가이드

**🚨 중요: "드래그", "인터랙티브", "변경 가능", "움직이기" 키워드가 있으면 반드시 JSXGraph 사용!**

- **기하학 도형 (삼각형, 사각형, 점, 선분 등)** → ⭐ **JSXGraph 필수** (드래그 가능)
- **좌표평면 위의 도형 (점을 움직일 수 있어야 함)** → ⭐ **JSXGraph 필수** (인터랙티브)
- **수학 함수 그래프 (y=f(x) 형태, 정적)** → Plotly (확대/축소만 필요)
- **프로세스/관계도** → Mermaid (순서도, 다이어그램)
- **통계 비교 (막대, 원 그래프)** → Chart.js
- **과학 데이터 (3D, 히트맵)** → Plotly

**Plotly는 정적 시각화 전용입니다. 점이나 도형을 드래그할 수 없습니다!**

## ✅ 올바른 답변 예시

**잘못된 답변 (❌):**
"좌표 평면에 점 A(1,1), B(5,1), C(3,4)를 그리고 연결하여 삼각형을 만듭니다."

**올바른 답변 (✅):**
"삼각형 ABC를 좌표평면에 그리면 다음과 같습니다. 각 점을 드래그하여 삼각형의 모양을 변경할 수 있습니다:

\`\`\`jsxgraph
{
  "title": "삼각형 ABC",
  "description": "점을 드래그하여 삼각형을 변형할 수 있습니다",
  "board": {
    "boundingbox": [0, 5, 6, 0],
    "axis": true,
    "showNavigation": false,
    "showCopyright": false
  },
  "elements": [
    {
      "type": "point",
      "coords": [1, 1],
      "attributes": {"name": "A", "size": 4, "color": "red"}
    },
    {
      "type": "point",
      "coords": [5, 1],
      "attributes": {"name": "B", "size": 4, "color": "red"}
    },
    {
      "type": "point",
      "coords": [3, 4],
      "attributes": {"name": "C", "size": 4, "color": "red"}
    },
    {
      "type": "polygon",
      "points": [[1,1], [5,1], [3,4]],
      "attributes": {"fillColor": "#667eea", "fillOpacity": 0.3}
    }
  ]
}
\`\`\`

밑변 AB의 길이는 4, 높이는 3이므로 넓이는 (4 × 3) / 2 = 6입니다."

**반드시 실제 코드를 포함하세요. 설명만으로는 불충분합니다!**`;


    // 시스템 프롬프트를 질문에 직접 삽입 (더 강력함)
    const enhancedQuery = `${systemPrompt}

---

이제 다음 질문에 답변하세요. 위의 가이드라인을 반드시 따라 그래프를 포함하세요:

${query}`;

    const response = await this.ai.models.generateContent({
      model,
      contents: enhancedQuery,
      config: {
        tools: [{
          fileSearch: {
            fileSearchStoreNames: storeNameArray
          }
        }]
      }
    });

    // 디버깅: 전체 응답 구조 확인
    console.log('\n🔍 API 응답 구조 디버깅:');
    console.log('response.candidates:', JSON.stringify(response.candidates, null, 2));

    // response에서 텍스트 추출 (모든 parts 합치기)
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts;
    let answerText = '응답을 생성할 수 없습니다.';

    if (parts && Array.isArray(parts)) {
      // 모든 parts의 text를 합침
      answerText = parts.map(part => part.text || '').join('');
      console.log(`✅ ${parts.length}개의 parts를 합쳤습니다.`);
    } else if (response.text) {
      answerText = response.text;
    }

    console.log('추출된 answerText 길이:', answerText.length);
    console.log('추출된 answerText (처음 200자):', answerText.substring(0, 200));
    console.log('='.repeat(80) + '\n');

    // 메타데이터 추출 (인용 및 근거 자료)
    const groundingMetadata = candidate?.groundingMetadata;
    const citationMetadata = candidate?.citationMetadata;

    // 하위 호환성을 위해 text 속성을 최상위에 노출하면서 메타데이터 포함
    return {
      text: answerText,
      groundingMetadata,
      citationMetadata,
      // 편의를 위해 가공된 인용 목록 제공
      citations: this._extractCitations(groundingMetadata, citationMetadata)
    };
  }

  /**
   * 메타데이터에서 인용 정보 추출 및 가공
   * @param {Object} groundingMetadata - Gemini Grounding Metadata
   * @param {Object} citationMetadata - Gemini Citation Metadata
   * @returns {Array} 가공된 인용 목록
   * @private
   */
  _extractCitations(groundingMetadata, citationMetadata) {
    const citations = [];
    const seenTitles = new Set();

    // 1. Grounding Metadata에서 청크 정보 추출
    if (groundingMetadata?.groundingChunks) {
      groundingMetadata.groundingChunks.forEach(chunk => {
        if (chunk.retrievedContext) {
          const title = chunk.retrievedContext.title;
          const uri = chunk.retrievedContext.uri;

          if (title && !seenTitles.has(title)) {
            citations.push({
              title,
              uri,
              source: 'grounding'
            });
            seenTitles.add(title);
          }
        }
      });
    }

    // 2. Citation Metadata에서 소스 정보 추출
    if (citationMetadata?.citationSources) {
      citationMetadata.citationSources.forEach(source => {
        const title = source.uri ? path.basename(source.uri) : 'Unknown Source';

        if (!seenTitles.has(title)) {
          citations.push({
            title,
            uri: source.uri,
            startIndex: source.startIndex,
            endIndex: source.endIndex,
            source: 'citation'
          });
          seenTitles.add(title);
        }
      });
    }

    return citations;
  }

  /**
  /**
   * Files API를 사용하여 파일 업로드 (Store와 독립적)
   * @param {string} filePath - 업로드할 파일 경로
   * @param {Object} options - 업로드 옵션
   * @param {string} options.displayName - 파일 표시 이름 (인용에 표시됨)
   * @param {string} options.mimeType - 파일 MIME 타입
   * @returns {Promise<Object>} 업로드된 파일 정보
   */
  async uploadFileToFilesAPI(filePath, options = {}) {
    // Check if filePath contains non-ASCII characters
    // The Google GenAI SDK (Node.js) has an issue with non-ASCII characters in file paths for uploads
    // Workaround: Copy to a temp ASCII file, upload, then delete
    const hasNonAscii = /[^\x00-\x7F]/.test(path.basename(filePath));
    let uploadPath = filePath;
    let tempFilePath = null;

    if (hasNonAscii) {
      const fs = require('fs');
      const os = require('os');
      const ext = path.extname(filePath);
      // Create a random ASCII filename
      const randomName = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
      tempFilePath = path.join(os.tmpdir(), randomName);

      console.log(`⚠️ Non-ASCII file path detected. Copying to temp file: ${tempFilePath}`);
      fs.copyFileSync(filePath, tempFilePath);
      uploadPath = tempFilePath;
    }

    try {
      const uploadParams = {
        file: uploadPath
      };

      // config 설정 (displayName 또는 name)
      if (options.displayName || options.mimeType) {
        uploadParams.config = {};
        if (options.displayName) {
          uploadParams.config.displayName = options.displayName;
        }
        if (options.mimeType) {
          uploadParams.config.mimeType = options.mimeType;
        }
      }

      const file = await this.ai.files.upload(uploadParams);
      return file;

    } finally {
      // Clean up temp file
      if (tempFilePath) {
        const fs = require('fs');
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    }
  }

  /**
   * Files API에 업로드된 파일을 File Search Store로 가져오기
   * @param {string} storeName - 스토어 이름 (예: 'fileSearchStores/xxx')
   * @param {string} fileName - Files API에 업로드된 파일 이름 (예: 'files/xxx')
   * @param {Object} options - 가져오기 옵션
   * @param {number} options.pollInterval - 가져오기 완료 체크 간격 (밀리초, 기본값: 5000)
   * @param {Object} options.chunkingConfig - 청크 구성 설정
   * @param {Object} options.chunkingConfig.whiteSpaceConfig - 공백 기반 청킹 설정
   * @param {number} options.chunkingConfig.whiteSpaceConfig.maxTokensPerChunk - 청크당 최대 토큰 수
   * @param {number} options.chunkingConfig.whiteSpaceConfig.maxOverlapTokens - 청크 간 오버랩 토큰 수
   * @param {Array<Object>} options.customMetadata - 커스텀 메타데이터 배열
   * @param {string} options.customMetadata[].key - 메타데이터 키
   * @param {string} options.customMetadata[].stringValue - 문자열 값 (선택사항)
   * @param {number} options.customMetadata[].numericValue - 숫자 값 (선택사항)
   * @returns {Promise<Object>} 완료된 작업 정보
   */
  async importFileToStore(storeName, fileName, options = {}) {
    const { pollInterval = 5000, chunkingConfig, customMetadata } = options;

    const importParams = {
      fileSearchStoreName: storeName,
      fileName: fileName
    };

    // config 설정 (청킹 또는 메타데이터)
    const config = {};

    if (chunkingConfig) {
      config.chunkingConfig = this._buildChunkingConfig(chunkingConfig);
    }

    if (customMetadata) {
      config.customMetadata = this._buildCustomMetadata(customMetadata);
    }

    if (Object.keys(config).length > 0) {
      importParams.config = config;
    }

    let operation = await this.ai.fileSearchStores.importFile(importParams);

    // 가져오기 완료까지 대기
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      operation = await this.ai.operations.get({ operation });
    }

    return operation;
  }

  /**
   * Files API 파일 목록 조회
   * @param {number} pageSize - 페이지당 항목 수 (기본값: 20)
   * @returns {Promise<Array>} 파일 목록
   */
  async listFilesAPIFiles(pageSize = 20) {
    const files = await this.ai.files.list({
      config: { pageSize }
    });
    const fileList = [];
    for await (const file of files) {
      fileList.push(file);
    }
    return fileList;
  }

  /**
   * Files API 파일 삭제
   * @param {string} fileName - 삭제할 파일 이름 (예: 'files/xxx')
   * @returns {Promise<void>}
   */
  async deleteFileFromFilesAPI(fileName) {
    await this.ai.files.delete({ name: fileName });
  }

  /**
   * Files API 파일 정보 조회
   * @param {string} fileName - 파일 이름 (예: 'files/xxx')
   * @returns {Promise<Object>} 파일 정보
   */
  async getFileInfo(fileName) {
    return await this.ai.files.get({ name: fileName });
  }

  /**
   * 청킹 설정 빌더 (내부 헬퍼 메서드)
   * @param {Object} chunkingConfig - 청킹 설정
   * @returns {Object} API 형식의 청킹 설정
   * @private
   */
  _buildChunkingConfig(chunkingConfig) {
    const config = {};

    // whiteSpaceConfig 처리
    if (chunkingConfig.whiteSpaceConfig) {
      config.whiteSpaceConfig = {};

      if (chunkingConfig.whiteSpaceConfig.maxTokensPerChunk !== undefined) {
        config.whiteSpaceConfig.maxTokensPerChunk = chunkingConfig.whiteSpaceConfig.maxTokensPerChunk;
      }

      if (chunkingConfig.whiteSpaceConfig.maxOverlapTokens !== undefined) {
        config.whiteSpaceConfig.maxOverlapTokens = chunkingConfig.whiteSpaceConfig.maxOverlapTokens;
      }
    }

    return config;
  }

  /**
   * 청킹 설정 검증 (내부 헬퍼 메서드)
   * @param {Object} chunkingConfig - 청킹 설정
   * @throws {Error} 유효하지 않은 설정
   * @private
   */
  _validateChunkingConfig(chunkingConfig) {
    if (!chunkingConfig) return;

    if (chunkingConfig.whiteSpaceConfig) {
      const { maxTokensPerChunk, maxOverlapTokens } = chunkingConfig.whiteSpaceConfig;

      if (maxTokensPerChunk !== undefined) {
        if (typeof maxTokensPerChunk !== 'number' || maxTokensPerChunk <= 0) {
          throw new Error('maxTokensPerChunk는 양수여야 합니다');
        }
      }

      if (maxOverlapTokens !== undefined) {
        if (typeof maxOverlapTokens !== 'number' || maxOverlapTokens < 0) {
          throw new Error('maxOverlapTokens는 0 이상이어야 합니다');
        }
      }

      if (maxTokensPerChunk !== undefined && maxOverlapTokens !== undefined) {
        if (maxOverlapTokens >= maxTokensPerChunk) {
          throw new Error('maxOverlapTokens는 maxTokensPerChunk보다 작아야 합니다');
        }
      }
    }
  }

  /**
   * 커스텀 메타데이터 빌더 (내부 헬퍼 메서드)
   * @param {Array<Object>} customMetadata - 메타데이터 배열
   * @returns {Array<Object>} API 형식의 메타데이터
   * @private
   */
  _buildCustomMetadata(customMetadata) {
    if (!Array.isArray(customMetadata)) {
      throw new Error('customMetadata는 배열이어야 합니다');
    }

    return customMetadata.map(item => {
      if (!item.key) {
        throw new Error('메타데이터 항목에는 key가 필요합니다');
      }

      const metadata = { key: item.key };

      // stringValue 또는 numericValue 중 하나만 있어야 함
      if (item.stringValue !== undefined && item.numericValue !== undefined) {
        throw new Error('stringValue와 numericValue는 동시에 사용할 수 없습니다');
      }

      if (item.stringValue !== undefined) {
        metadata.stringValue = String(item.stringValue);
      } else if (item.numericValue !== undefined) {
        if (typeof item.numericValue !== 'number') {
          throw new Error('numericValue는 숫자여야 합니다');
        }
        metadata.numericValue = item.numericValue;
      } else {
        throw new Error('stringValue 또는 numericValue 중 하나가 필요합니다');
      }

      return metadata;
    });
  }

  /**
   * 커스텀 메타데이터 검증 (내부 헬퍼 메서드)
   * @param {Array<Object>} customMetadata - 메타데이터 배열
   * @throws {Error} 유효하지 않은 메타데이터
   * @private
   */
  _validateCustomMetadata(customMetadata) {
    if (!customMetadata) return;

    if (!Array.isArray(customMetadata)) {
      throw new Error('customMetadata는 배열이어야 합니다');
    }

    customMetadata.forEach((item, index) => {
      if (!item.key || typeof item.key !== 'string') {
        throw new Error(`메타데이터 항목 ${index}: key는 필수 문자열입니다`);
      }

      const hasStringValue = item.stringValue !== undefined;
      const hasNumericValue = item.numericValue !== undefined;

      if (!hasStringValue && !hasNumericValue) {
        throw new Error(`메타데이터 항목 ${index}: stringValue 또는 numericValue가 필요합니다`);
      }

      if (hasStringValue && hasNumericValue) {
        throw new Error(`메타데이터 항목 ${index}: stringValue와 numericValue는 동시에 사용할 수 없습니다`);
      }

      if (hasNumericValue && typeof item.numericValue !== 'number') {
        throw new Error(`메타데이터 항목 ${index}: numericValue는 숫자여야 합니다`);
      }
    });
  }

  /**
   * 스토어 정보 조회 (디버깅용)
   * @param {string} storeName - 스토어 이름
   * @returns {Promise<Object>} 스토어 정보 (documentCount, documents)
   */
  async getStoreInfo(storeName) {
    const docs = await this.listDocuments(storeName);
    return {
      storeName,
      documentCount: docs.length,
      documents: docs
    };
  }
}

module.exports = FileSearchManager;
