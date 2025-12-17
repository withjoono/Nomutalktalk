/**
 * RAG 문서 관리 시스템 - 스키마 검증
 */

import {
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
  DocumentType,
  ValidationResult,
  UnitHierarchy,
  ZystoryUnit,
  TextbookMetadata,
  SupplementaryMetadata,
  PastExamMetadata,
  UniversityEssayMetadata,
  UniversityInterviewMetadata,
  OtherMetadata,
  BaseDocument,
  Chunk,
  UnitClassification,
  DocumentMetadata,
} from './types';

// ============================================================
// 유틸리티 함수
// ============================================================

export function isValidEnum<T extends readonly string[]>(
  value: unknown,
  validValues: T
): value is T[number] {
  return typeof value === 'string' && validValues.includes(value as T[number]);
}

export function isValidEnumArray<T extends readonly string[]>(
  arr: unknown,
  validValues: T
): arr is T[number][] {
  if (!Array.isArray(arr)) return false;
  return arr.every(item => validValues.includes(item as T[number]));
}

export function hasRequiredFields(obj: Record<string, unknown>, requiredFields: string[]): boolean {
  return requiredFields.every(field => {
    const value = obj[field];
    return value !== undefined && value !== null && value !== '';
  });
}

// ============================================================
// 단원 검증
// ============================================================

export function validateUnitHierarchy(unit: unknown): ValidationResult {
  if (!unit || typeof unit !== 'object') {
    return { valid: false, error: '단원 정보가 필요합니다.' };
  }

  const unitObj = unit as UnitHierarchy;
  if (!unitObj.majorUnit || typeof unitObj.majorUnit !== 'string') {
    return { valid: false, error: '대단원명이 필요합니다.' };
  }

  return { valid: true };
}

export function validateZystoryUnit(zystoryUnit: unknown): ValidationResult {
  if (!zystoryUnit) return { valid: true };

  const unit = zystoryUnit as ZystoryUnit;
  const required: (keyof ZystoryUnit)[] = ['majorUnit', 'middleUnit', 'typeNumber', 'typeName'];

  for (const field of required) {
    if (!unit[field]) {
      return { valid: false, error: `자이스토리 단원의 ${field}가 필요합니다.` };
    }
  }

  return { valid: true };
}

// ============================================================
// 문서 유형별 메타데이터 검증
// ============================================================

export function validateTextbookMetadata(metadata: TextbookMetadata): ValidationResult {
  const errors: string[] = [];

  if (!metadata.domain) errors.push('영역(domain)이 필요합니다.');
  if (!metadata.subject) errors.push('과목(subject)이 필요합니다.');
  if (!metadata.curriculum || !isValidEnum(metadata.curriculum, CURRICULUMS)) {
    errors.push('유효한 교육과정(curriculum)이 필요합니다. (2015 또는 2022)');
  }

  const unitResult = validateUnitHierarchy(metadata.unit);
  if (!unitResult.valid && unitResult.error) errors.push(unitResult.error);

  if (metadata.contentType && !isValidEnum(metadata.contentType, TEXTBOOK_CONTENT_TYPES)) {
    errors.push('유효하지 않은 콘텐츠 타입입니다.');
  }

  if (metadata.keyConcepts && !Array.isArray(metadata.keyConcepts)) {
    errors.push('핵심 개념(keyConcepts)은 배열이어야 합니다.');
  }

  return { valid: errors.length === 0, errors };
}

export function validateSupplementaryMetadata(metadata: SupplementaryMetadata): ValidationResult {
  const errors: string[] = [];

  if (!metadata.domain) errors.push('영역(domain)이 필요합니다.');
  if (!metadata.subject) errors.push('과목(subject)이 필요합니다.');
  if (!metadata.materialName) errors.push('부교재명(materialName)이 필요합니다.');

  const unitResult = validateUnitHierarchy(metadata.unit);
  if (!unitResult.valid && unitResult.error) errors.push(unitResult.error);

  return { valid: errors.length === 0, errors };
}

export function validatePastExamMetadata(metadata: PastExamMetadata): ValidationResult {
  const errors: string[] = [];

  if (!metadata.examType || !isValidEnum(metadata.examType, EXAM_TYPES)) {
    errors.push('유효한 시험 유형(examType)이 필요합니다.');
  }
  if (!metadata.year || typeof metadata.year !== 'number') {
    errors.push('연도(year)가 필요합니다.');
  }
  if (!metadata.domain) errors.push('영역(domain)이 필요합니다.');
  if (!metadata.subject) errors.push('과목(subject)이 필요합니다.');

  const unitResult = validateUnitHierarchy(metadata.unit);
  if (!unitResult.valid && unitResult.error) errors.push(unitResult.error);

  if (metadata.problemFormat && !isValidEnum(metadata.problemFormat, PROBLEM_FORMATS)) {
    errors.push('유효하지 않은 문항 형태(problemFormat)입니다.');
  }

  if (metadata.difficulty && !isValidEnum(metadata.difficulty, DIFFICULTY_LEVELS)) {
    errors.push('유효하지 않은 난이도(difficulty)입니다.');
  }

  if (metadata.knowledgeType && !isValidEnumArray(metadata.knowledgeType, KNOWLEDGE_TYPES)) {
    errors.push('유효하지 않은 지식 유형(knowledgeType)이 포함되어 있습니다.');
  }

  const zystoryResult = validateZystoryUnit(metadata.zystoryUnit);
  if (!zystoryResult.valid && zystoryResult.error) errors.push(zystoryResult.error);

  if (metadata.examType === 'school_mid' || metadata.examType === 'school_final') {
    if (!metadata.schoolInfo || !metadata.schoolInfo.schoolName) {
      errors.push('내신 기출은 학교 정보(schoolInfo.schoolName)가 필요합니다.');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateUniversityEssayMetadata(
  metadata: UniversityEssayMetadata
): ValidationResult {
  const errors: string[] = [];

  if (!metadata.universityName) errors.push('대학명(universityName)이 필요합니다.');
  if (!metadata.year || typeof metadata.year !== 'number') {
    errors.push('연도(year)가 필요합니다.');
  }
  if (!metadata.admissionType) errors.push('전형명(admissionType)이 필요합니다.');

  if (metadata.problemType && !isValidEnum(metadata.problemType, ESSAY_PROBLEM_TYPES)) {
    errors.push('유효하지 않은 문항 유형(problemType)입니다.');
  }

  if (metadata.units) {
    if (!Array.isArray(metadata.units)) {
      errors.push('출제 단원(units)은 배열이어야 합니다.');
    } else {
      metadata.units.forEach((unit, index) => {
        const unitResult = validateUnitHierarchy(unit);
        if (!unitResult.valid && unitResult.error) {
          errors.push(`단원 ${index + 1}: ${unitResult.error}`);
        }
      });
    }
  }

  if (metadata.difficulty && !isValidEnum(metadata.difficulty, DIFFICULTY_LEVELS)) {
    errors.push('유효하지 않은 난이도(difficulty)입니다.');
  }

  if (metadata.knowledgeType && !isValidEnumArray(metadata.knowledgeType, KNOWLEDGE_TYPES)) {
    errors.push('유효하지 않은 지식 유형(knowledgeType)이 포함되어 있습니다.');
  }

  if (
    metadata.thinkingProcess &&
    !isValidEnumArray(metadata.thinkingProcess, THINKING_PROCESS_TYPES)
  ) {
    errors.push('유효하지 않은 사고 과정 유형(thinkingProcess)이 포함되어 있습니다.');
  }

  return { valid: errors.length === 0, errors };
}

export function validateUniversityInterviewMetadata(
  metadata: UniversityInterviewMetadata
): ValidationResult {
  const errors: string[] = [];

  if (!metadata.universityName) errors.push('대학명(universityName)이 필요합니다.');
  if (!metadata.department) errors.push('학과/전공(department)이 필요합니다.');
  if (!metadata.year || typeof metadata.year !== 'number') {
    errors.push('연도(year)가 필요합니다.');
  }

  if (metadata.interviewType && !isValidEnum(metadata.interviewType, INTERVIEW_TYPES)) {
    errors.push('유효하지 않은 면접 유형(interviewType)입니다.');
  }

  if (metadata.evaluationCompetencies) {
    if (!isValidEnumArray(metadata.evaluationCompetencies, INTERVIEW_COMPETENCIES)) {
      errors.push('유효하지 않은 평가 역량(evaluationCompetencies)이 포함되어 있습니다.');
    }
  }

  if (!metadata.originalQuestion) {
    errors.push('질문 원문(originalQuestion)이 필요합니다.');
  }

  if (metadata.followUpSequence && !Array.isArray(metadata.followUpSequence)) {
    errors.push('꼬리질문 시퀀스(followUpSequence)는 배열이어야 합니다.');
  }

  return { valid: errors.length === 0, errors };
}

export function validateOtherMetadata(metadata: OtherMetadata): ValidationResult {
  const errors: string[] = [];

  if (metadata.tags && !Array.isArray(metadata.tags)) {
    errors.push('태그(tags)는 배열이어야 합니다.');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// 통합 검증 함수
// ============================================================

export function validateDocumentMetadata(
  documentType: DocumentType,
  metadata: DocumentMetadata
): ValidationResult {
  if (!isValidEnum(documentType, DOCUMENT_TYPES)) {
    return {
      valid: false,
      errors: [`유효하지 않은 문서 유형입니다: ${documentType}`],
    };
  }

  if (!metadata || typeof metadata !== 'object') {
    return {
      valid: false,
      errors: ['메타데이터가 필요합니다.'],
    };
  }

  switch (documentType) {
    case 'textbook':
      return validateTextbookMetadata(metadata as TextbookMetadata);
    case 'supplementary':
      return validateSupplementaryMetadata(metadata as SupplementaryMetadata);
    case 'csat_past':
    case 'csat_mock':
    case 'school_exam':
      return validatePastExamMetadata(metadata as PastExamMetadata);
    case 'university_essay':
      return validateUniversityEssayMetadata(metadata as UniversityEssayMetadata);
    case 'university_interview':
      return validateUniversityInterviewMetadata(metadata as UniversityInterviewMetadata);
    case 'other':
      return validateOtherMetadata(metadata as OtherMetadata);
    default:
      return { valid: true, errors: [] };
  }
}

export function validateBaseDocument(doc: Partial<BaseDocument>): ValidationResult {
  const errors: string[] = [];

  if (!doc.documentType || !isValidEnum(doc.documentType, DOCUMENT_TYPES)) {
    errors.push('유효한 문서 유형(documentType)이 필요합니다.');
  }

  if (!doc.title || typeof doc.title !== 'string') {
    errors.push('제목(title)이 필요합니다.');
  }

  if (doc.status && !isValidEnum(doc.status, DOCUMENT_STATUS)) {
    errors.push('유효하지 않은 상태(status)입니다.');
  }

  return { valid: errors.length === 0, errors };
}

export function validateDocument(doc: Partial<BaseDocument>): ValidationResult {
  const baseResult = validateBaseDocument(doc);
  if (!baseResult.valid) {
    return baseResult;
  }

  if (doc.metadata && doc.documentType) {
    const metadataResult = validateDocumentMetadata(doc.documentType, doc.metadata);
    return {
      valid: metadataResult.valid,
      errors: metadataResult.errors,
    };
  }

  return { valid: true, errors: [] };
}

export function validateChunk(chunk: Partial<Chunk>): ValidationResult {
  const errors: string[] = [];

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

  return { valid: errors.length === 0, errors };
}

export function validateUnitClassification(unit: Partial<UnitClassification>): ValidationResult {
  const errors: string[] = [];

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

  return { valid: errors.length === 0, errors };
}

// ============================================================
// 기본값 생성
// ============================================================

export function createDefaultDocument(
  documentType: DocumentType,
  overrides: Partial<BaseDocument> = {}
): BaseDocument {
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
    ...overrides,
  };
}

export function createDefaultMetadata(documentType: DocumentType): DocumentMetadata {
  const baseMetadata = {
    domain: '',
    subject: '',
    curriculum: '2022' as const,
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
        exampleSummary: '',
      } as TextbookMetadata;

    case 'supplementary':
      return {
        ...baseMetadata,
        materialName: '',
        publisher: '',
        unit: { majorUnit: '', middleUnit: '', minorUnit: '' },
        contentType: 'mixed',
        keyConcepts: [],
      } as SupplementaryMetadata;

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
        schoolInfo: null,
      } as PastExamMetadata;

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
        commonErrors: [],
      } as UniversityEssayMetadata;

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
        deductionFactors: [],
      } as UniversityInterviewMetadata;

    case 'other':
    default:
      return {
        category: '',
        tags: [],
        description: '',
        customFields: {},
      } as OtherMetadata;
  }
}

export function createDefaultChunk(
  documentId: string,
  documentType: DocumentType,
  overrides: Partial<Chunk> = {}
): Chunk {
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
    ...overrides,
  };
}

// ============================================================
// 상수 내보내기
// ============================================================

export {
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
};
