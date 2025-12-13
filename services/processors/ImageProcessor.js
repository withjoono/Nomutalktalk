/**
 * 이미지 프로세서 - OCR 및 설명 텍스트 생성
 *
 * Gemini Vision을 사용하여:
 * - 이미지에서 텍스트 추출 (OCR)
 * - 수학/과학 이미지 설명 생성
 * - LaTeX 수식 추출
 */

const { GoogleGenAI } = require('@google/genai');

class ImageProcessor {
  constructor(geminiClient) {
    this.gemini = geminiClient;
    this.model = 'gemini-2.5-flash-preview-05-20';
  }

  /**
   * 이미지 전체 처리
   * @param {string} imageData - Base64 인코딩된 이미지 데이터
   * @param {string} mimeType - 이미지 MIME 타입 (예: 'image/png')
   * @param {Object} options - 처리 옵션
   * @returns {Object} - OCR 결과, 설명, 수식 등
   */
  async processImage(imageData, mimeType = 'image/png', options = {}) {
    const {
      generateDescription = true,
      extractFormulas = true,
      extractTables = true,
      context = ''
    } = options;

    const results = {
      ocrText: '',
      description: '',
      formulas: [],
      tables: [],
      confidence: 0,
      processingTime: 0
    };

    const startTime = Date.now();

    try {
      // 1. OCR 텍스트 추출
      const ocrResult = await this.extractText(imageData, mimeType);
      results.ocrText = ocrResult.text;
      results.confidence = ocrResult.confidence;

      // 2. 설명 텍스트 생성
      if (generateDescription) {
        results.description = await this.generateDescription(imageData, mimeType, context);
      }

      // 3. LaTeX 수식 추출
      if (extractFormulas && results.ocrText) {
        results.formulas = await this.extractFormulas(results.ocrText, imageData, mimeType);
      }

      // 4. 표 데이터 추출
      if (extractTables) {
        results.tables = await this.extractTableData(imageData, mimeType);
      }

      results.processingTime = Date.now() - startTime;

    } catch (error) {
      console.error('Image processing error:', error);
      throw new Error(`이미지 처리 실패: ${error.message}`);
    }

    return results;
  }

  /**
   * OCR 텍스트 추출
   */
  async extractText(imageData, mimeType) {
    const prompt = `이 이미지에서 모든 텍스트를 추출해주세요.

규칙:
1. 수학 수식은 LaTeX 형식으로 변환 ($...$ 또는 $$...$$)
2. 특수 기호는 정확하게 인식
3. 줄바꿈과 구조를 유지
4. 번호나 기호가 있으면 그대로 유지

다음 JSON 형식으로 응답해주세요:
{
  "text": "추출된 텍스트 전체",
  "confidence": 0.0에서 1.0 사이의 신뢰도
}`;

    try {
      const response = await this.gemini.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: imageData,
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096
        }
      });

      const text = response.text || '';

      // JSON 파싱 시도
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // JSON 파싱 실패 시 텍스트 그대로 반환
      }

      return { text: text, confidence: 0.7 };

    } catch (error) {
      console.error('OCR extraction error:', error);
      return { text: '', confidence: 0 };
    }
  }

  /**
   * 이미지 설명 생성 (RAG 검색용)
   */
  async generateDescription(imageData, mimeType, context = '') {
    const contextHint = context ? `\n\n컨텍스트: ${context}` : '';

    const prompt = `이 수학/과학 이미지를 RAG 시스템에서 검색 가능하도록 상세히 설명해주세요.${contextHint}

포함할 내용:
1. 이미지 유형 (그래프, 도형, 표, 다이어그램, 수식 등)
2. 핵심 수학적/과학적 개념
3. 표현된 관계나 패턴
4. 중요 레이블이나 값
5. 교육적 맥락 (어떤 개념을 설명하는 자료인지)

설명은 한국어로 2-3문장 정도로 작성해주세요.`;

    try {
      const response = await this.gemini.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: imageData,
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024
        }
      });

      return response.text || '';

    } catch (error) {
      console.error('Description generation error:', error);
      return '';
    }
  }

  /**
   * LaTeX 수식 추출
   */
  async extractFormulas(ocrText, imageData, mimeType) {
    // 먼저 OCR 텍스트에서 기존 LaTeX 수식 찾기
    const inlineFormulas = ocrText.match(/\$[^$]+\$/g) || [];
    const blockFormulas = ocrText.match(/\$\$[^$]+\$\$/g) || [];
    const existingFormulas = [...inlineFormulas, ...blockFormulas];

    // 이미지에서 추가 수식 감지
    const prompt = `이 이미지에서 수학 수식을 찾아 LaTeX 형식으로 변환해주세요.

규칙:
1. 인라인 수식은 $...$ 형식
2. 디스플레이 수식은 $$...$$ 형식
3. 분수, 루트, 적분, 시그마 등 정확하게 변환
4. 수식이 없으면 빈 배열 반환

다음 JSON 형식으로 응답:
{
  "formulas": ["$x^2+y^2=r^2$", "$$\\int_0^1 f(x)dx$$"]
}`;

    try {
      const response = await this.gemini.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: imageData,
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048
        }
      });

      const text = response.text || '';

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          // 중복 제거 후 병합
          const allFormulas = [...new Set([...existingFormulas, ...(parsed.formulas || [])])];
          return allFormulas;
        }
      } catch (e) {
        // JSON 파싱 실패
      }

      return existingFormulas;

    } catch (error) {
      console.error('Formula extraction error:', error);
      return existingFormulas;
    }
  }

  /**
   * 표 데이터 추출
   */
  async extractTableData(imageData, mimeType) {
    const prompt = `이 이미지에 표(table)가 있다면 데이터를 추출해주세요.

규칙:
1. 표가 없으면 빈 배열 반환
2. 표가 있으면 행과 열 구조 유지
3. 숫자, 텍스트, 수식 정확하게 추출
4. 헤더가 있으면 별도로 표시

다음 JSON 형식으로 응답:
{
  "tables": [
    {
      "headers": ["열1", "열2", "열3"],
      "rows": [
        ["값1", "값2", "값3"],
        ["값4", "값5", "값6"]
      ],
      "caption": "표 설명 (있는 경우)"
    }
  ]
}`;

    try {
      const response = await this.gemini.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: imageData,
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096
        }
      });

      const text = response.text || '';

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed.tables || [];
        }
      } catch (e) {
        // JSON 파싱 실패
      }

      return [];

    } catch (error) {
      console.error('Table extraction error:', error);
      return [];
    }
  }

  /**
   * 이미지 유형 감지
   */
  async detectImageType(imageData, mimeType) {
    const prompt = `이 이미지의 유형을 분류해주세요.

분류 옵션:
- graph: 함수 그래프, 좌표평면
- diagram: 다이어그램, 플로우차트
- figure: 기하 도형, 벤다이어그램
- table: 표, 데이터 테이블
- equation: 수식, 공식
- chart: 막대 그래프, 원 그래프, 통계 차트
- photo: 실제 사진
- illustration: 삽화, 개념도
- mixed: 복합 유형
- other: 기타

다음 JSON 형식으로 응답:
{
  "type": "graph",
  "subtype": "함수 그래프",
  "confidence": 0.95
}`;

    try {
      const response = await this.gemini.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: imageData,
                  mimeType: mimeType
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 256
        }
      });

      const text = response.text || '';

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // JSON 파싱 실패
      }

      return { type: 'other', subtype: '', confidence: 0.5 };

    } catch (error) {
      console.error('Image type detection error:', error);
      return { type: 'other', subtype: '', confidence: 0 };
    }
  }

  /**
   * 이미지를 청크용 텍스트로 변환
   */
  async convertToChunkText(imageData, mimeType, options = {}) {
    const {
      includeOcr = true,
      includeDescription = true,
      includeFormulas = true,
      context = ''
    } = options;

    const processed = await this.processImage(imageData, mimeType, {
      generateDescription: includeDescription,
      extractFormulas: includeFormulas,
      extractTables: true,
      context
    });

    const parts = [];

    // 이미지 유형 감지
    const imageType = await this.detectImageType(imageData, mimeType);
    parts.push(`[이미지: ${imageType.subtype || imageType.type}]`);

    // 설명 추가
    if (includeDescription && processed.description) {
      parts.push(processed.description);
    }

    // OCR 텍스트 추가
    if (includeOcr && processed.ocrText) {
      parts.push(`\n텍스트 내용:\n${processed.ocrText}`);
    }

    // 수식 추가
    if (includeFormulas && processed.formulas.length > 0) {
      parts.push(`\n수식:\n${processed.formulas.join('\n')}`);
    }

    // 표 데이터 추가
    if (processed.tables.length > 0) {
      processed.tables.forEach((table, idx) => {
        let tableText = table.caption ? `\n표 ${idx + 1}: ${table.caption}\n` : `\n표 ${idx + 1}:\n`;
        if (table.headers && table.headers.length > 0) {
          tableText += `| ${table.headers.join(' | ')} |\n`;
          tableText += `| ${table.headers.map(() => '---').join(' | ')} |\n`;
        }
        if (table.rows) {
          table.rows.forEach(row => {
            tableText += `| ${row.join(' | ')} |\n`;
          });
        }
        parts.push(tableText);
      });
    }

    return {
      text: parts.join('\n\n'),
      metadata: {
        imageType: imageType.type,
        hasFormulas: processed.formulas.length > 0,
        hasTables: processed.tables.length > 0,
        confidence: processed.confidence,
        formulaCount: processed.formulas.length,
        tableCount: processed.tables.length
      }
    };
  }
}

module.exports = ImageProcessor;
