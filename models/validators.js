/**
 * RAG 문서 관리 시스템 - 스키마 검증 및 인터페이스 정의
 *
 * 문서 유형:
 * - textbook: 교과서
 * - supplementary: 학교 부교재
 * - csat_past: 수능 기출
 * - csat_mock: 수능 모의고사 기출
 * - school_exam: 내신 기출
 * - university_essay: 대학별 수리논술
 * - university_interview: 대학별 심층면접
 * - other: 기타
 */

// ============================================================
// 상수 정의
// ============================================================

const DOCUMENT_TYPES = [
  'textbook',
  'supplementary',
  'csat_past',
  'csat_mock',
  'school_exam',
  'university_essay',
  'university_interview',
  'other'
];

const DOCUMENT_STATUS = ['pending', 'processing', 'indexed', 'error'];

const CONTENT_TYPES = ['concept', 'problem', 'figure', 'table', 'mixed'];

const TEXTBOOK_CONTENT_TYPES = [
  'concept_explanation',    // 개념설명
  'definition',             // 정의
  'theorem_law',            // 정리·법칙
  'example',                // 예제
  'exercise',               // 유제
  'exploration',            // 탐구활동
  'check_problem',          // 확인문제
  'figure_table_description', // 그림·표 설명
  'mixed'                   // 혼합
];

const EXAM_TYPES = [
  'csat',           // 수능
  'eval_6',         // 6월 평가원
  'eval_9',         // 9월 평가원
  'mock_edu',       // 교육청 모의고사
  'mock_private',   // 사설 모의고사
  'school_mid',     // 중간고사
  'school_final'    // 기말고사
];

const PROBLEM_FORMATS = [
  'multiple_choice',  // 객관식
  'short_answer',     // 단답형
  'descriptive',      // 서술형
  'essay'             // 논술형
];

const DIFFICULTY_LEVELS = [
  'killer',   // 킬러
  'high',     // 상
  'medium',   // 중
  'low',      // 하
  'concept'   // 개념
];

const KNOWLEDGE_TYPES = [
  'concept',           // 개념
  'calculation',       // 계산
  'reasoning',         // 추론
  'data_interpretation', // 자료해석
  'integration'        // 통합
];

const ESSAY_PROBLEM_TYPES = [
  'proof',           // 증명형
  'calculation',     // 계산형
  'descriptive',     // 서술형
  'graph_analysis'   // 그래프해석
];

const THINKING_PROCESS_TYPES = [
  'equation_setup',      // 식 세우기
  'condition_analysis',  // 조건 분석
  'limit_differentiation_integration', // 극한·미분·적분 활용
  'case_division',       // 경우 나누기
  'proof_by_contradiction', // 귀류법
  'mathematical_induction'  // 수학적 귀납법
];

const INTERVIEW_TYPES = [
  'reading_material',  // 제시문
  'mathematical',      // 수리
  'oral',              // 구술
  'mmi',               // MMI
  'discussion'         // 토론형
];

const INTERVIEW_COMPETENCIES = [
  'mathematical_thinking',  // 수리적사고
  'logical_reasoning',      // 논리적추론
  'problem_solving',        // 문제해결
  'expression',             // 표현력
  'attitude',               // 태도
  'major_fit'               // 전공적합성
];

const CURRICULUMS = ['2015', '2022'];

// ============================================================
// 유틸리티 함수
// ============================================================

/**
 * 값이 배열에 포함되어 있는지 검증
 */
function isValidEnum(value, validValues) {
  return validValues.includes(value);
}

/**
 * 배열의 모든 요소가 유효한 enum 값인지 검증
 */
function isValidEnumArray(arr, validValues) {
  if (!Array.isArray(arr)) return false;
  return arr.every(item => validValues.includes(item));
}

/**
 * 필수 필드 검증
 */
function hasRequiredFields(obj, requiredFields) {
  return requiredFields.every(field => {
    const value = obj[field];
    return value !== undefined && value !== null && value !== '';
  });
}

/**
 * 단원 계층 구조 검증
 */
function validateUnitHierarchy(unit) {
  if (!unit || typeof unit !== 'object') {
    return { valid: false, error: '단원 정보가 필요합니다.' };
  }

  if (!unit.majorUnit || typeof unit.majorUnit !== 'string') {
    return { valid: false, error: '대단원명이 필요합니다.' };
  }

  return { valid: true };
}

/**
 * 자이스토리 기준 단원 검증
 */
function validateZystoryUnit(zystoryUnit) {
  if (!zystoryUnit) return { valid: true }; // 선택사항

  const required = ['majorUnit', 'middleUnit', 'typeNumber', 'typeName'];
  for (const field of required) {
    if (!zystoryUnit[field]) {
      return { valid: false, error: `자이스토리 단원의 ${field}가 필요합니다.` };
    }
  }

  return { valid: true };
}

// ============================================================
// 문서 유형별 메타데이터 검증
// ============================================================

/**
 * 교과서 메타데이터 검증
 */
function validateTextbookMetadata(metadata) {
  const errors = [];

  // 필수 필드
  if (!metadata.domain) errors.push('영역(domain)이 필요합니다.');
  if (!metadata.subject) errors.push('과목(subject)이 필요합니다.');
  if (!metadata.curriculum || !isValidEnum(metadata.curriculum, CURRICULUMS)) {
    errors.push('유효한 교육과정(curriculum)이 필요합니다. (2015 또는 2022)');
  }

  // 단원 검증
  const unitResult = validateUnitHierarchy(metadata.unit);
  if (!unitResult.valid) errors.push(unitResult.error);

  // 콘텐츠 타입
  if (metadata.contentType && !isValidEnum(metadata.contentType, TEXTBOOK_CONTENT_TYPES)) {
    errors.push('유효하지 않은 콘텐츠 타입입니다.');
  }

  // 핵심 개념 (배열)
  if (metadata.keyConcepts && !Array.isArray(metadata.keyConcepts)) {
    errors.push('핵심 개념(keyConcepts)은 배열이어야 합니다.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 학교 부교재 메타데이터 검증
 */
function validateSupplementaryMetadata(metadata) {
  const errors = [];

  if (!metadata.domain) errors.push('영역(domain)이 필요합니다.');
  if (!metadata.subject) errors.push('과목(subject)이 필요합니다.');
  if (!metadata.materialName) errors.push('부교재명(materialName)이 필요합니다.');

  const unitResult = validateUnitHierarchy(metadata.unit);
  if (!unitResult.valid) errors.push(unitResult.error);

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 기출문제 메타데이터 검증 (수능/모의고사/내신 공통)
 */
function validatePastExamMetadata(metadata) {
  const errors = [];

  // 필수 필드
  if (!metadata.examType || !isValidEnum(metadata.examType, EXAM_TYPES)) {
    errors.push('유효한 시험 유형(examType)이 필요합니다.');
  }
  if (!metadata.year || typeof metadata.year !== 'number') {
    errors.push('연도(year)가 필요합니다.');
  }
  if (!metadata.domain) errors.push('영역(domain)이 필요합니다.');
  if (!metadata.subject) errors.push('과목(subject)이 필요합니다.');

  // 단원 검증
  const unitResult = validateUnitHierarchy(metadata.unit);
  if (!unitResult.valid) errors.push(unitResult.error);

  // 문항 형태
  if (metadata.problemFormat && !isValidEnum(metadata.problemFormat, PROBLEM_FORMATS)) {
    errors.push('유효하지 않은 문항 형태(problemFormat)입니다.');
  }

  // 난이도
  if (metadata.difficulty && !isValidEnum(metadata.difficulty, DIFFICULTY_LEVELS)) {
    errors.push('유효하지 않은 난이도(difficulty)입니다.');
  }

  // 지식 유형 (배열)
  if (metadata.knowledgeType && !isValidEnumArray(metadata.knowledgeType, KNOWLEDGE_TYPES)) {
    errors.push('유효하지 않은 지식 유형(knowledgeType)이 포함되어 있습니다.');
  }

  // 자이스토리 기준 단원
  const zystoryResult = validateZystoryUnit(metadata.zystoryUnit);
  if (!zystoryResult.valid) errors.push(zystoryResult.error);

  // 내신 기출인 경우 학교 정보
  if (metadata.examType === 'school_mid' || metadata.examType === 'school_final') {
    if (!metadata.schoolInfo || !metadata.schoolInfo.schoolName) {
      errors.push('내신 기출은 학교 정보(schoolInfo.schoolName)가 필요합니다.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 대학별 수리논술 메타데이터 검증
 */
function validateUniversityEssayMetadata(metadata) {
  const errors = [];

  // 필수 필드
  if (!metadata.universityName) errors.push('대학명(universityName)이 필요합니다.');
  if (!metadata.year || typeof metadata.year !== 'number') {
    errors.push('연도(year)가 필요합니다.');
  }
  if (!metadata.admissionType) errors.push('전형명(admissionType)이 필요합니다.');

  // 문항 유형
  if (metadata.problemType && !isValidEnum(metadata.problemType, ESSAY_PROBLEM_TYPES)) {
    errors.push('유효하지 않은 문항 유형(problemType)입니다.');
  }

  // 단원 (복수 태깅)
  if (metadata.units) {
    if (!Array.isArray(metadata.units)) {
      errors.push('출제 단원(units)은 배열이어야 합니다.');
    } else {
      metadata.units.forEach((unit, index) => {
        const unitResult = validateUnitHierarchy(unit);
        if (!unitResult.valid) {
          errors.push(`단원 ${index + 1}: ${unitResult.error}`);
        }
      });
    }
  }

  // 난이도
  if (metadata.difficulty && !isValidEnum(metadata.difficulty, DIFFICULTY_LEVELS)) {
    errors.push('유효하지 않은 난이도(difficulty)입니다.');
  }

  // 지식 유형
  if (metadata.knowledgeType && !isValidEnumArray(metadata.knowledgeType, KNOWLEDGE_TYPES)) {
    errors.push('유효하지 않은 지식 유형(knowledgeType)이 포함되어 있습니다.');
  }

  // 사고 과정 유형
  if (metadata.thinkingProcess && !isValidEnumArray(metadata.thinkingProcess, THINKING_PROCESS_TYPES)) {
    errors.push('유효하지 않은 사고 과정 유형(thinkingProcess)이 포함되어 있습니다.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 대학별 심층면접 메타데이터 검증
 */
function validateUniversityInterviewMetadata(metadata) {
  const errors = [];

  // 필수 필드
  if (!metadata.universityName) errors.push('대학명(universityName)이 필요합니다.');
  if (!metadata.department) errors.push('학과/전공(department)이 필요합니다.');
  if (!metadata.year || typeof metadata.year !== 'number') {
    errors.push('연도(year)가 필요합니다.');
  }

  // 면접 유형
  if (metadata.interviewType && !isValidEnum(metadata.interviewType, INTERVIEW_TYPES)) {
    errors.push('유효하지 않은 면접 유형(interviewType)입니다.');
  }

  // 평가 역량
  if (metadata.evaluationCompetencies) {
    if (!isValidEnumArray(metadata.evaluationCompetencies, INTERVIEW_COMPETENCIES)) {
      errors.push('유효하지 않은 평가 역량(evaluationCompetencies)이 포함되어 있습니다.');
    }
  }

  // 질문 원문
  if (!metadata.originalQuestion) {
    errors.push('질문 원문(originalQuestion)이 필요합니다.');
  }

  // 꼬리질문 시퀀스 (배열)
  if (metadata.followUpSequence && !Array.isArray(metadata.followUpSequence)) {
    errors.push('꼬리질문 시퀀스(followUpSequence)는 배열이어야 합니다.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 기타 문서 메타데이터 검증
 */
function validateOtherMetadata(metadata) {
  // 기타 문서는 최소한의 검증만
  const errors = [];

  if (metadata.tags && !Array.isArray(metadata.tags)) {
    errors.push('태그(tags)는 배열이어야 합니다.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================
// 통합 검증 함수
// ============================================================

/**
 * 문서 유형에 따른 메타데이터 검증
 */
function validateDocumentMetadata(documentType, metadata) {
  if (!isValidEnum(documentType, DOCUMENT_TYPES)) {
    return {
      valid: false,
      errors: [`유효하지 않은 문서 유형입니다: ${documentType}`]
    };
  }

  if (!metadata || typeof metadata !== 'object') {
    return {
      valid: false,
      errors: ['메타데이터가 필요합니다.']
    };
  }

  switch (documentType) {
    case 'textbook':
      return validateTextbookMetadata(metadata);
    case 'supplementary':
      return validateSupplementaryMetadata(metadata);
    case 'csat_past':
    case 'csat_mock':
    case 'school_exam':
      return validatePastExamMetadata(metadata);
    case 'university_essay':
      return validateUniversityEssayMetadata(metadata);
    case 'university_interview':
      return validateUniversityInterviewMetadata(metadata);
    case 'other':
      return validateOtherMetadata(metadata);
    default:
      return { valid: true, errors: [] };
  }
}

/**
 * 기본 문서 필드 검증
 */
function validateBaseDocument(doc) {
  const errors = [];

  if (!doc.documentType || !isValidEnum(doc.documentType, DOCUMENT_TYPES)) {
    errors.push('유효한 문서 유형(documentType)이 필요합니다.');
  }

  if (!doc.title || typeof doc.title !== 'string') {
    errors.push('제목(title)이 필요합니다.');
  }

  if (doc.status && !isValidEnum(doc.status, DOCUMENT_STATUS)) {
    errors.push('유효하지 않은 상태(status)입니다.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 전체 문서 검증
 */
function validateDocument(doc) {
  const baseResult = validateBaseDocument(doc);
  if (!baseResult.valid) {
    return baseResult;
  }

  const metadataResult = validateDocumentMetadata(doc.documentType, doc.metadata);

  return {
    valid: metadataResult.valid,
    errors: metadataResult.errors
  };
}

/**
 * 청크 검증
 */
function validateChunk(chunk) {
  const errors = [];

  if (!chunk.documentId) {
    errors.push('문서 ID(documentId)가 필요합니다.');
  }

  if (!chunk.content || typeof chunk.content !== 'string') {
    errors.push('내용(content)이 필요합니다.');
  }

  if (chunk.contentType && !isValidEnum(chunk.contentType, CONTENT_TYPES)) {
    errors.push('유효하지 않은 콘텐츠 타입(contentType)입니다.');
  }

  if (chunk.index !== undefined && (typeof chunk.index !== 'number' || chunk.index < 0)) {
    errors.push('인덱스(index)는 0 이상의 숫자여야 합니다.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 자이스토리 기준 단원 분류 검증
 */
function validateUnitClassification(unit) {
  const errors = [];

  if (!unit.subject) errors.push('과목(subject)이 필요합니다.');
  if (!unit.curriculum || !isValidEnum(unit.curriculum, CURRICULUMS)) {
    errors.push('유효한 교육과정(curriculum)이 필요합니다.');
  }

  if (!unit.majorUnit || !unit.majorUnit.code || !unit.majorUnit.name) {
    errors.push('대단원 정보(majorUnit.code, majorUnit.name)가 필요합니다.');
  }

  if (!unit.middleUnit || !unit.middleUnit.code || !unit.middleUnit.name) {
    errors.push('중단원 정보(middleUnit.code, middleUnit.name)가 필요합니다.');
  }

  if (unit.types) {
    if (!Array.isArray(unit.types)) {
      errors.push('유형(types)은 배열이어야 합니다.');
    } else {
      unit.types.forEach((type, index) => {
        if (!type.code || !type.name) {
          errors.push(`유형 ${index + 1}: code와 name이 필요합니다.`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================================
// 스키마 기본값 생성
// ============================================================

/**
 * 기본 문서 객체 생성
 */
function createDefaultDocument(documentType, overrides = {}) {
  const now = new Date();

  return {
    documentType,
    title: '',
    description: '',
    originalFileName: '',
    mimeType: '',
    fileSize: 0,
    status: 'pending',
    chunkCount: 0,
    metadata: createDefaultMetadata(documentType),
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

/**
 * 문서 유형별 기본 메타데이터 생성
 */
function createDefaultMetadata(documentType) {
  const baseMetadata = {
    domain: '',
    subject: '',
    curriculum: '2022'
  };

  switch (documentType) {
    case 'textbook':
      return {
        ...baseMetadata,
        publisher: '',
        unit: { majorUnit: '', middleUnit: '', minorUnit: '' },
        contentType: 'mixed',
        keyConcepts: [],
        conceptRelations: '',
        exampleSummary: ''
      };

    case 'supplementary':
      return {
        ...baseMetadata,
        materialName: '',
        publisher: '',
        unit: { majorUnit: '', middleUnit: '', minorUnit: '' },
        contentType: 'mixed',
        keyConcepts: []
      };

    case 'csat_past':
    case 'csat_mock':
    case 'school_exam':
      return {
        ...baseMetadata,
        examType: 'csat',
        year: new Date().getFullYear(),
        examInstitution: '',
        unit: { majorUnit: '', middleUnit: '', minorUnit: '' },
        problemNumber: 1,
        problemFormat: 'multiple_choice',
        difficulty: 'medium',
        knowledgeType: ['concept'],
        intent: '',
        linkedInfo: '',
        trapElements: [],
        zystoryUnit: null,
        schoolInfo: null
      };

    case 'university_essay':
      return {
        universityName: '',
        campus: '',
        admissionType: '',
        department: '',
        year: new Date().getFullYear(),
        problemNumber: '',
        subProblemNumber: '',
        problemType: 'descriptive',
        units: [],
        difficulty: 'high',
        estimatedTime: 0,
        knowledgeType: ['reasoning'],
        thinkingProcess: [],
        evaluationCompetency: [],
        score: 0,
        partialScoreCriteria: '',
        solutionStrategy: '',
        gradingKeySentences: [],
        commonErrors: []
      };

    case 'university_interview':
      return {
        universityName: '',
        department: '',
        admissionType: '',
        year: new Date().getFullYear(),
        interviewType: 'oral',
        procedure: '',
        interviewDuration: 0,
        questionUnit: '',
        presentationMaterialType: '',
        difficultyDepth: 'intermediate',
        evaluationCompetencies: [],
        originalQuestion: '',
        followUpSequence: [],
        questionIntent: '',
        modelAnswerSummary: '',
        followUpFlowSummary: '',
        evaluationPoints: [],
        deductionFactors: []
      };

    case 'other':
    default:
      return {
        category: '',
        tags: [],
        description: '',
        customFields: {}
      };
  }
}

/**
 * 기본 청크 객체 생성
 */
function createDefaultChunk(documentId, documentType, overrides = {}) {
  return {
    documentId,
    documentType,
    content: '',
    contentType: 'concept',
    index: 0,
    problemData: null,
    conceptData: null,
    inheritedMetadata: {},
    tokenCount: 0,
    createdAt: new Date(),
    ...overrides
  };
}

// ============================================================
// 내보내기
// ============================================================

module.exports = {
  // 상수
  DOCUMENT_TYPES,
  DOCUMENT_STATUS,
  CONTENT_TYPES,
  TEXTBOOK_CONTENT_TYPES,
  EXAM_TYPES,
  PROBLEM_FORMATS,
  DIFFICULTY_LEVELS,
  KNOWLEDGE_TYPES,
  ESSAY_PROBLEM_TYPES,
  THINKING_PROCESS_TYPES,
  INTERVIEW_TYPES,
  INTERVIEW_COMPETENCIES,
  CURRICULUMS,

  // 검증 함수
  validateDocument,
  validateDocumentMetadata,
  validateBaseDocument,
  validateChunk,
  validateUnitClassification,
  validateUnitHierarchy,
  validateZystoryUnit,

  // 유형별 검증 함수
  validateTextbookMetadata,
  validateSupplementaryMetadata,
  validatePastExamMetadata,
  validateUniversityEssayMetadata,
  validateUniversityInterviewMetadata,
  validateOtherMetadata,

  // 유틸리티
  isValidEnum,
  isValidEnumArray,
  hasRequiredFields,

  // 기본값 생성
  createDefaultDocument,
  createDefaultMetadata,
  createDefaultChunk
};
