/**
 * RAG 문서 관리 시스템 - 타입 정의
 */

// ============================================================
// Enum 타입 정의
// ============================================================

export const DOCUMENT_TYPES = [
  'textbook',
  'supplementary',
  'csat_past',
  'csat_mock',
  'school_exam',
  'university_essay',
  'university_interview',
  'other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUS = ['pending', 'processing', 'indexed', 'error'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUS)[number];

export const CONTENT_TYPES = ['concept', 'problem', 'figure', 'table', 'mixed'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const TEXTBOOK_CONTENT_TYPES = [
  'concept_explanation',
  'definition',
  'theorem_law',
  'example',
  'exercise',
  'exploration',
  'check_problem',
  'figure_table_description',
  'mixed',
] as const;
export type TextbookContentType = (typeof TEXTBOOK_CONTENT_TYPES)[number];

export const EXAM_TYPES = [
  'csat',
  'eval_6',
  'eval_9',
  'mock_edu',
  'mock_private',
  'school_mid',
  'school_final',
] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const PROBLEM_FORMATS = ['multiple_choice', 'short_answer', 'descriptive', 'essay'] as const;
export type ProblemFormat = (typeof PROBLEM_FORMATS)[number];

export const DIFFICULTY_LEVELS = ['killer', 'high', 'medium', 'low', 'concept'] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const KNOWLEDGE_TYPES = [
  'concept',
  'calculation',
  'reasoning',
  'data_interpretation',
  'integration',
] as const;
export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export const ESSAY_PROBLEM_TYPES = [
  'proof',
  'calculation',
  'descriptive',
  'graph_analysis',
] as const;
export type EssayProblemType = (typeof ESSAY_PROBLEM_TYPES)[number];

export const THINKING_PROCESS_TYPES = [
  'equation_setup',
  'condition_analysis',
  'limit_differentiation_integration',
  'case_division',
  'proof_by_contradiction',
  'mathematical_induction',
] as const;
export type ThinkingProcessType = (typeof THINKING_PROCESS_TYPES)[number];

export const INTERVIEW_TYPES = [
  'reading_material',
  'mathematical',
  'oral',
  'mmi',
  'discussion',
] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_COMPETENCIES = [
  'mathematical_thinking',
  'logical_reasoning',
  'problem_solving',
  'expression',
  'attitude',
  'major_fit',
] as const;
export type InterviewCompetency = (typeof INTERVIEW_COMPETENCIES)[number];

export const CURRICULUMS = ['2015', '2022'] as const;
export type Curriculum = (typeof CURRICULUMS)[number];

// ============================================================
// 인터페이스 정의
// ============================================================

export interface UnitHierarchy {
  majorUnit: string;
  middleUnit?: string;
  minorUnit?: string;
}

export interface ZystoryUnit {
  majorUnit: string;
  middleUnit: string;
  typeNumber: string;
  typeName: string;
}

export interface SchoolInfo {
  schoolName: string;
  region?: string;
  grade?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  error?: string;
}

// ============================================================
// 메타데이터 인터페이스
// ============================================================

export interface BaseMetadata {
  domain?: string;
  subject?: string;
  curriculum?: Curriculum;
}

export interface TextbookMetadata extends BaseMetadata {
  publisher?: string;
  unit?: UnitHierarchy;
  contentType?: TextbookContentType;
  keyConcepts?: string[];
  conceptRelations?: string;
  exampleSummary?: string;
}

export interface SupplementaryMetadata extends BaseMetadata {
  materialName: string;
  publisher?: string;
  unit?: UnitHierarchy;
  contentType?: TextbookContentType;
  keyConcepts?: string[];
}

export interface PastExamMetadata extends BaseMetadata {
  examType: ExamType;
  year: number;
  examInstitution?: string;
  unit?: UnitHierarchy;
  problemNumber?: number;
  problemFormat?: ProblemFormat;
  difficulty?: DifficultyLevel;
  knowledgeType?: KnowledgeType[];
  intent?: string;
  linkedInfo?: string;
  trapElements?: string[];
  zystoryUnit?: ZystoryUnit | null;
  schoolInfo?: SchoolInfo | null;
}

export interface UniversityEssayMetadata {
  universityName: string;
  campus?: string;
  admissionType: string;
  department?: string;
  year: number;
  problemNumber?: string;
  subProblemNumber?: string;
  problemType?: EssayProblemType;
  units?: UnitHierarchy[];
  difficulty?: DifficultyLevel;
  estimatedTime?: number;
  knowledgeType?: KnowledgeType[];
  thinkingProcess?: ThinkingProcessType[];
  evaluationCompetency?: string[];
  score?: number;
  partialScoreCriteria?: string;
  solutionStrategy?: string;
  gradingKeySentences?: string[];
  commonErrors?: string[];
}

export interface UniversityInterviewMetadata {
  universityName: string;
  department: string;
  admissionType?: string;
  year: number;
  interviewType?: InterviewType;
  procedure?: string;
  interviewDuration?: number;
  questionUnit?: string;
  presentationMaterialType?: string;
  difficultyDepth?: string;
  evaluationCompetencies?: InterviewCompetency[];
  originalQuestion: string;
  followUpSequence?: string[];
  questionIntent?: string;
  modelAnswerSummary?: string;
  followUpFlowSummary?: string;
  evaluationPoints?: string[];
  deductionFactors?: string[];
}

export interface OtherMetadata {
  category?: string;
  tags?: string[];
  description?: string;
  customFields?: Record<string, unknown>;
}

export type DocumentMetadata =
  | TextbookMetadata
  | SupplementaryMetadata
  | PastExamMetadata
  | UniversityEssayMetadata
  | UniversityInterviewMetadata
  | OtherMetadata;

// ============================================================
// 문서 인터페이스
// ============================================================

export interface BaseDocument {
  documentType: DocumentType;
  title: string;
  description?: string;
  originalFileName?: string;
  mimeType?: string;
  fileSize?: number;
  status?: DocumentStatus;
  chunkCount?: number;
  metadata?: DocumentMetadata;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Chunk {
  documentId: string;
  documentType?: DocumentType;
  content: string;
  contentType?: ContentType;
  index?: number;
  problemData?: unknown;
  conceptData?: unknown;
  inheritedMetadata?: Record<string, unknown>;
  tokenCount?: number;
  createdAt?: Date;
}

export interface UnitClassification {
  subject: string;
  curriculum: Curriculum;
  majorUnit: {
    code: string;
    name: string;
  };
  middleUnit: {
    code: string;
    name: string;
  };
  types?: Array<{
    code: string;
    name: string;
  }>;
}

// ============================================================
// 청킹 설정 인터페이스
// ============================================================

export interface WhiteSpaceConfig {
  maxTokensPerChunk?: number;
  maxOverlapTokens?: number;
}

export interface ChunkingConfig {
  whiteSpaceConfig?: WhiteSpaceConfig;
}

// ============================================================
// 커스텀 메타데이터 인터페이스
// ============================================================

export interface CustomMetadataItem {
  key: string;
  stringValue?: string;
  numericValue?: number;
}

// ============================================================
// API 응답 인터페이스
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface StoreInfo {
  storeName: string;
  documentCount: number;
  documents: unknown[];
}

export interface UploadResult {
  success: boolean;
  fileName?: string;
  filePath?: string;
  storeName?: string;
  chunkingConfig?: ChunkingConfig;
  operation?: unknown;
  error?: string;
}

// ============================================================
// Express 확장 타입
// ============================================================

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
}
