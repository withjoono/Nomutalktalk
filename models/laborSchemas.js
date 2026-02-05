/**
 * 노동법령 및 판례 데이터 스키마 정의
 * Labor Law and Case Data Schemas
 */

/**
 * 노동법령 메타데이터 스키마
 */
const LaborLawSchema = {
  // 문서 기본 정보
  documentType: 'labor_law',              // 고정값
  lawType: '',                            // 'act' | 'decree' | 'rule' | 'notice' | 'directive'
  lawName: '',                            // 법령명 (예: '근로기준법')
  lawNumber: '',                          // 법령 번호 (예: '법률 제19488호')
  
  // 시행 정보
  enactmentDate: '',                      // 제정일 (YYYY-MM-DD)
  enforcementDate: '',                    // 시행일 (YYYY-MM-DD)
  revisionDate: '',                       // 최종 개정일 (YYYY-MM-DD)
  
  // 소관 정보
  ministry: '',                           // 소관 부처 (예: '고용노동부')
  
  // 조문 정보
  chapter: '',                            // 장 (예: '제1장')
  section: '',                            // 절 (예: '제1절', 선택사항)
  article: '',                            // 조 (예: '제2조')
  paragraph: '',                          // 항 (예: '제1항', 선택사항)
  subparagraph: '',                       // 호 (예: '제1호', 선택사항)
  item: '',                               // 목 (예: '가목', 선택사항)
  
  // 메타 정보
  revisionHistory: false,                 // 개정 이력 존재 여부
  relatedLaws: [],                        // 관련 법령 배열
  keywords: [],                           // 키워드 배열
  category: '',                           // 카테고리 (예: '근로계약', '임금', '근로시간')
  
  // 추가 정보
  importance: 0,                          // 중요도 (1-5)
  frequentlyUsed: false                   // 자주 참조되는 조항 여부
};

/**
 * 판례 메타데이터 스키마
 */
const LaborCaseSchema = {
  // 문서 기본 정보
  documentType: 'labor_case',             // 고정값
  
  // 법원 정보
  courtType: '',                          // 'supreme' | 'high' | 'district' | 'admin'
  courtName: '',                          // 법원명 (예: '대법원', '서울고등법원')
  
  // 사건 정보
  caseNumber: '',                         // 사건번호 (예: '2023다12345')
  judgmentDate: '',                       // 선고일 (YYYY-MM-DD)
  caseType: '',                           // 'civil' | 'criminal' | 'admin' | 'constitutional'
  subject: '',                            // 사건 주제 (예: '부당해고', '임금체불')
  
  // 당사자 정보
  plaintiffType: '',                      // 'employee' | 'employer' | 'union' | 'government'
  defendantType: '',                      // 'employee' | 'employer' | 'union' | 'government'
  
  // 판결 정보
  judgmentResult: '',                     // 'plaintiff_win' | 'defendant_win' | 'partial' | 'dismissed'
  judgmentSummary: '',                    // 판결 요지 (200자 이내)
  keyIssue: '',                           // 쟁점 사항
  
  // 법령 관계
  relatedLaws: [],                        // 관련 법령 배열 (예: ['근로기준법 제23조', ...])
  relatedCases: [],                       // 관련 판례 배열 (사건번호)
  
  // 메타 정보
  precedentValue: '',                     // 'high' | 'medium' | 'low' - 선례가치
  importance: 0,                          // 중요도 (1-5)
  keywords: [],                           // 키워드 배열
  category: '',                           // 카테고리
  
  // 추가 정보
  isLandmark: false,                      // 주요 판례 여부
  citationCount: 0,                       // 인용 횟수
  hasMinorityOpinion: false               // 반대의견/별개의견 존재 여부
};

/**
 * 행정해석 메타데이터 스키마
 */
const LaborInterpretationSchema = {
  // 문서 기본 정보
  documentType: 'labor_interpretation',   // 고정값
  
  // 해석 정보
  interpretationType: '',                 // 'guideline' | 'directive' | 'response' | 'notice'
  interpretationNumber: '',               // 해석 번호
  interpretationDate: '',                 // 해석일 (YYYY-MM-DD)
  
  // 소관 정보
  issuingAuthority: '',                   // 발행 기관 (예: '고용노동부')
  department: '',                         // 부서명
  
  // 내용 정보
  subject: '',                            // 제목
  question: '',                           // 질의 내용
  answer: '',                             // 회신 내용 요약
  
  // 관련 정보
  relatedLaws: [],                        // 관련 법령
  relatedCases: [],                       // 관련 판례
  keywords: [],                           // 키워드
  category: '',                           // 카테고리
  
  // 메타 정보
  isActive: true,                         // 현재 유효 여부
  supersededBy: '',                       // 대체한 해석 번호
  importance: 0                           // 중요도 (1-5)
};

/**
 * 노무 질의 카테고리 정의
 */
const LaborCategories = {
  '근로계약': {
    keywords: ['채용', '시용', '근로조건', '계약서', '근로계약'],
    subcategories: ['채용', '시용기간', '근로조건', '계약서작성', '계약기간']
  },
  '임금': {
    keywords: ['임금', '급여', '최저임금', '통상임금', '평균임금', '퇴직금', '수당'],
    subcategories: ['최저임금', '통상임금', '평균임금', '연장수당', '야간수당', '퇴직금']
  },
  '근로시간': {
    keywords: ['근로시간', '연장근로', '야간근로', '휴게시간', '주휴일', '탄력근로'],
    subcategories: ['법정근로시간', '연장근로', '야간근로', '휴게시간', '유연근무']
  },
  '휴가휴직': {
    keywords: ['연차', '휴가', '휴직', '출산', '육아', '병가'],
    subcategories: ['연차휴가', '출산휴가', '육아휴직', '병가', '경조휴가']
  },
  '해고징계': {
    keywords: ['해고', '징계', '정당한 이유', '부당해고', '해고예고', '정리해고'],
    subcategories: ['부당해고', '정당한 이유', '징계절차', '해고예고', '정리해고']
  },
  '산재보험': {
    keywords: ['산재', '업무상', '재해', '요양', '휴업급여', '장해급여'],
    subcategories: ['업무상재해', '요양급여', '휴업급여', '장해급여', '유족급여']
  },
  '고용보험': {
    keywords: ['실업급여', '육아휴직급여', '출산전후급여', '고용안정'],
    subcategories: ['실업급여', '육아휴직급여', '출산전후급여', '고용안정']
  },
  '차별': {
    keywords: ['차별', '비정규직', '성차별', '임금차별', '승진', '불합리'],
    subcategories: ['성차별', '비정규직차별', '임금차별', '승진차별']
  },
  '노동조합': {
    keywords: ['노조', '단결권', '단체교섭', '단체행동', '쟁의', '부당노동행위'],
    subcategories: ['단결권', '단체교섭', '단체행동', '부당노동행위']
  },
  '안전보건': {
    keywords: ['안전', '보건', '산업안전', '작업환경', '건강검진'],
    subcategories: ['안전조치', '보건조치', '작업환경', '건강검진']
  }
};

/**
 * 법령 유형 정의
 */
const LawTypes = {
  act: '법률',           // 국회 제정 법률
  decree: '시행령',      // 대통령령
  rule: '시행규칙',      // 부령
  notice: '고시',        // 부처 고시
  directive: '훈령'      // 부처 훈령
};

/**
 * 법원 유형 정의
 */
const CourtTypes = {
  supreme: '대법원',
  high: '고등법원',
  district: '지방법원',
  admin: '행정법원'
};

/**
 * 판결 결과 정의
 */
const JudgmentResults = {
  plaintiff_win: '원고승',
  defendant_win: '피고승',
  partial: '일부승',
  dismissed: '각하/기각'
};

/**
 * 선례가치 정의
 */
const PrecedentValues = {
  high: '상 - 대법원 전원합의체, 중요 법리 변경',
  medium: '중 - 대법원 일반 판례, 고법 주요 판례',
  low: '하 - 사실관계 중심 판단'
};

/**
 * Gemini File Search 메타데이터로 변환하는 유틸리티
 */
class LaborMetadataBuilder {
  /**
   * 노동법령 메타데이터를 Gemini 형식으로 변환
   */
  static buildLaborLawMetadata(lawData) {
    const metadata = [
      { key: 'document_type', stringValue: 'labor_law' },
      { key: 'law_type', stringValue: lawData.lawType },
      { key: 'law_name', stringValue: lawData.lawName }
    ];

    // 선택적 필드 추가
    if (lawData.lawNumber) {
      metadata.push({ key: 'law_number', stringValue: lawData.lawNumber });
    }
    if (lawData.ministry) {
      metadata.push({ key: 'ministry', stringValue: lawData.ministry });
    }
    if (lawData.chapter) {
      metadata.push({ key: 'chapter', stringValue: lawData.chapter });
    }
    if (lawData.article) {
      metadata.push({ key: 'article', stringValue: lawData.article });
    }
    if (lawData.category) {
      metadata.push({ key: 'category', stringValue: lawData.category });
    }
    if (lawData.importance) {
      metadata.push({ key: 'importance', numericValue: lawData.importance });
    }
    if (lawData.keywords && lawData.keywords.length > 0) {
      metadata.push({ key: 'keywords', stringValue: lawData.keywords.join(', ') });
    }
    if (lawData.relatedLaws && lawData.relatedLaws.length > 0) {
      metadata.push({ key: 'related_laws', stringValue: lawData.relatedLaws.join(', ') });
    }

    return metadata;
  }

  /**
   * 판례 메타데이터를 Gemini 형식으로 변환
   */
  static buildLaborCaseMetadata(caseData) {
    const metadata = [
      { key: 'document_type', stringValue: 'labor_case' },
      { key: 'court_type', stringValue: caseData.courtType },
      { key: 'court_name', stringValue: caseData.courtName },
      { key: 'case_number', stringValue: caseData.caseNumber }
    ];

    // 선택적 필드 추가
    if (caseData.judgmentDate) {
      metadata.push({ key: 'judgment_date', stringValue: caseData.judgmentDate });
    }
    if (caseData.subject) {
      metadata.push({ key: 'subject', stringValue: caseData.subject });
    }
    if (caseData.judgmentResult) {
      metadata.push({ key: 'judgment_result', stringValue: caseData.judgmentResult });
    }
    if (caseData.precedentValue) {
      metadata.push({ key: 'precedent_value', stringValue: caseData.precedentValue });
    }
    if (caseData.category) {
      metadata.push({ key: 'category', stringValue: caseData.category });
    }
    if (caseData.importance) {
      metadata.push({ key: 'importance', numericValue: caseData.importance });
    }
    if (caseData.keywords && caseData.keywords.length > 0) {
      metadata.push({ key: 'keywords', stringValue: caseData.keywords.join(', ') });
    }
    if (caseData.relatedLaws && caseData.relatedLaws.length > 0) {
      metadata.push({ key: 'related_laws', stringValue: caseData.relatedLaws.join(', ') });
    }

    return metadata;
  }

  /**
   * 행정해석 메타데이터를 Gemini 형식으로 변환
   */
  static buildInterpretationMetadata(interpData) {
    const metadata = [
      { key: 'document_type', stringValue: 'labor_interpretation' },
      { key: 'interpretation_type', stringValue: interpData.interpretationType }
    ];

    if (interpData.interpretationNumber) {
      metadata.push({ key: 'interpretation_number', stringValue: interpData.interpretationNumber });
    }
    if (interpData.issuingAuthority) {
      metadata.push({ key: 'issuing_authority', stringValue: interpData.issuingAuthority });
    }
    if (interpData.subject) {
      metadata.push({ key: 'subject', stringValue: interpData.subject });
    }
    if (interpData.category) {
      metadata.push({ key: 'category', stringValue: interpData.category });
    }
    if (interpData.importance) {
      metadata.push({ key: 'importance', numericValue: interpData.importance });
    }
    if (interpData.keywords && interpData.keywords.length > 0) {
      metadata.push({ key: 'keywords', stringValue: interpData.keywords.join(', ') });
    }

    return metadata;
  }
}

/**
 * 청킹 설정 프리셋
 */
const LaborChunkingPresets = {
  // 법령: 조문 단위로 청킹
  law: {
    whiteSpaceConfig: {
      maxTokensPerChunk: 512,
      maxOverlapTokens: 64
    }
  },
  // 판례: 긴 판시사항 고려
  case: {
    whiteSpaceConfig: {
      maxTokensPerChunk: 1024,
      maxOverlapTokens: 128
    }
  },
  // 행정해석: 중간 크기
  interpretation: {
    whiteSpaceConfig: {
      maxTokensPerChunk: 768,
      maxOverlapTokens: 64
    }
  }
};

module.exports = {
  LaborLawSchema,
  LaborCaseSchema,
  LaborInterpretationSchema,
  LaborCategories,
  LawTypes,
  CourtTypes,
  JudgmentResults,
  PrecedentValues,
  LaborMetadataBuilder,
  LaborChunkingPresets
};
