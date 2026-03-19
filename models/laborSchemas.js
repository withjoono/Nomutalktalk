/**
 * 법률 도메인 및 데이터 스키마 정의
 * Legal Domain & Data Schemas
 * 
 * 노동법(labor)을 포함한 종합 법률 분야 지원
 */

// ==================== 법 분야(Domain) 정의 ====================

/**
 * 지원 법 분야 목록
 */
const LegalDomains = {
  labor: {
    name: '노동법',
    icon: '⚖️',
    color: '#4f46e5',
    description: '근로계약, 임금, 해고, 산재 등 노동 관련 법률 상담',
  },
  civil: {
    name: '민사법',
    icon: '📋',
    color: '#0891b2',
    description: '계약, 손해배상, 부동산, 채권채무 등 민사 분쟁 상담',
  },
  criminal: {
    name: '형사법',
    icon: '🔒',
    color: '#dc2626',
    description: '형사사건, 고소/고발, 수사절차, 형사합의 등',
  },
  family: {
    name: '가사법',
    icon: '👨‍👩‍👧',
    color: '#d946ef',
    description: '이혼, 양육권, 상속, 가사조정 등 가정 관련 법률',
  },
  admin: {
    name: '행정법',
    icon: '🏛️',
    color: '#ea580c',
    description: '인허가, 행정처분, 세금, 국가배상 등 행정 분쟁',
  },
  ip: {
    name: '지식재산',
    icon: '💡',
    color: '#ca8a04',
    description: '특허, 상표, 저작권, 영업비밀 등 지재권 분쟁',
  },
  corporate: {
    name: '기업법',
    icon: '🏢',
    color: '#059669',
    description: '회사설립, 주주분쟁, M&A, 기업 컴플라이언스',
  },
};

// ==================== 분야별 카테고리 ====================

/**
 * 노동법 카테고리 (기존 유지)
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

const CivilCategories = {
  '계약': {
    keywords: ['계약', '매매', '임대차', '청약', '해제', '해지'],
    subcategories: ['매매계약', '임대차', '도급', '위임', '계약해제']
  },
  '손해배상': {
    keywords: ['손해배상', '불법행위', '과실', '배상책임', '위자료'],
    subcategories: ['불법행위', '과실책임', '위자료', '손해산정']
  },
  '부동산': {
    keywords: ['부동산', '등기', '소유권', '전세', '매매', '토지'],
    subcategories: ['매매', '전세', '등기', '소유권', '재개발']
  },
  '채권채무': {
    keywords: ['채권', '채무', '보증', '대출', '추심', '소멸시효'],
    subcategories: ['대여금', '보증', '소멸시효', '강제집행']
  },
};

const CriminalCategories = {
  '재산범죄': {
    keywords: ['사기', '횡령', '배임', '절도', '강도'],
    subcategories: ['사기', '횡령', '배임', '절도', '손괴']
  },
  '폭력범죄': {
    keywords: ['폭행', '상해', '협박', '감금', '체포'],
    subcategories: ['폭행', '상해', '협박', '강요']
  },
  '성범죄': {
    keywords: ['성폭력', '성희롱', '강제추행', '카메라'],
    subcategories: ['성폭력', '강제추행', '통신매체이용']
  },
  '교통범죄': {
    keywords: ['교통사고', '음주운전', '뺑소니', '무면허'],
    subcategories: ['교통사고', '음주운전', '뺑소니']
  },
};

const FamilyCategories = {
  '이혼': {
    keywords: ['이혼', '협의이혼', '재판이혼', '위자료', '재산분할'],
    subcategories: ['협의이혼', '재판이혼', '위자료', '재산분할']
  },
  '양육권': {
    keywords: ['양육권', '친권', '면접교섭', '양육비'],
    subcategories: ['양육권', '양육비', '면접교섭']
  },
  '상속': {
    keywords: ['상속', '유언', '유류분', '상속포기', '한정승인'],
    subcategories: ['법정상속', '유언', '유류분', '상속포기']
  },
};

const AdminCategories = {
  '행정처분': {
    keywords: ['인허가', '취소', '정지', '과징금', '행정심판'],
    subcategories: ['영업정지', '인허가취소', '과징금', '행정심판']
  },
  '세금': {
    keywords: ['세금', '국세', '지방세', '부가세', '종합소득세'],
    subcategories: ['국세', '지방세', '세무조사', '경정청구']
  },
  '국가배상': {
    keywords: ['국가배상', '공무원', '위법행위', '공공기관'],
    subcategories: ['국가배상', '손실보상']
  },
};

const IPCategories = {
  '특허': {
    keywords: ['특허', '발명', '실용신안', '특허침해', '특허등록'],
    subcategories: ['특허출원', '특허침해', '실용신안']
  },
  '상표': {
    keywords: ['상표', '브랜드', '상표등록', '상표침해'],
    subcategories: ['상표출원', '상표침해', '부정경쟁']
  },
  '저작권': {
    keywords: ['저작권', '저작물', '복제', '2차저작물', '공정이용'],
    subcategories: ['저작권침해', '공정이용', '라이선스']
  },
};

const CorporateCategories = {
  '회사설립': {
    keywords: ['법인설립', '주식회사', '유한회사', '정관'],
    subcategories: ['법인설립', '정관작성', '등기']
  },
  '주주분쟁': {
    keywords: ['주주', '이사', '배당', '주주총회', '경영권'],
    subcategories: ['주주총회', '이사회', '배당', '경영권분쟁']
  },
  '기업규제': {
    keywords: ['컴플라이언스', '공정거래', '하도급', '개인정보'],
    subcategories: ['공정거래', '하도급', '개인정보보호']
  },
};

/**
 * 도메인별 카테고리 매핑
 */
const DomainCategories = {
  labor: LaborCategories,
  civil: CivilCategories,
  criminal: CriminalCategories,
  family: FamilyCategories,
  admin: AdminCategories,
  ip: IPCategories,
  corporate: CorporateCategories,
};

/**
 * 도메인별 전문가 역할 (AI 프롬프트용)
 */
const DomainExperts = {
  labor: '노동법 전문 변호사',
  civil: '민사 전문 변호사',
  criminal: '형사 전문 변호사',
  family: '가사 전문 변호사',
  admin: '행정법 전문 변호사',
  ip: '지식재산 전문 변호사',
  corporate: '기업법 전문 변호사',
};

/**
 * 도메인별 사건 유형 (case-input 드롭다운)
 */
const DomainCaseTypes = {
  labor: [
    { value: '', label: '사건 유형 선택 (선택사항)' },
    { value: '부당해고', label: '⚠️ 부당해고' },
    { value: '임금체불', label: '💰 임금체불' },
    { value: '산업재해', label: '🏥 산업재해' },
    { value: '근로시간', label: '⏰ 근로시간/초과근무' },
    { value: '직장내괴롭힘', label: '😤 직장 내 괴롭힘' },
    { value: '퇴직금', label: '📋 퇴직금' },
    { value: '차별', label: '🚫 차별/성희롱' },
    { value: '기타', label: '📌 기타' },
  ],
  civil: [
    { value: '', label: '사건 유형 선택 (선택사항)' },
    { value: '계약분쟁', label: '📋 계약 분쟁' },
    { value: '손해배상', label: '💰 손해배상' },
    { value: '부동산', label: '🏠 부동산 분쟁' },
    { value: '채권채무', label: '💳 채권/채무' },
    { value: '기타', label: '📌 기타' },
  ],
  criminal: [
    { value: '', label: '사건 유형 선택 (선택사항)' },
    { value: '재산범죄', label: '💰 재산범죄 (사기/횡령)' },
    { value: '폭력범죄', label: '👊 폭력범죄' },
    { value: '성범죄', label: '🚫 성범죄' },
    { value: '교통범죄', label: '🚗 교통범죄' },
    { value: '기타', label: '📌 기타' },
  ],
  family: [
    { value: '', label: '사건 유형 선택 (선택사항)' },
    { value: '이혼', label: '💔 이혼' },
    { value: '양육권', label: '👶 양육권/양육비' },
    { value: '상속', label: '📜 상속/유언' },
    { value: '기타', label: '📌 기타' },
  ],
  admin: [
    { value: '', label: '사건 유형 선택 (선택사항)' },
    { value: '행정처분', label: '🏛️ 행정처분 불복' },
    { value: '세금', label: '💰 세금/과세 분쟁' },
    { value: '국가배상', label: '⚖️ 국가배상' },
    { value: '기타', label: '📌 기타' },
  ],
  ip: [
    { value: '', label: '사건 유형 선택 (선택사항)' },
    { value: '특허', label: '📐 특허 분쟁' },
    { value: '상표', label: '®️ 상표 분쟁' },
    { value: '저작권', label: '©️ 저작권 분쟁' },
    { value: '기타', label: '📌 기타' },
  ],
  corporate: [
    { value: '', label: '사건 유형 선택 (선택사항)' },
    { value: '회사설립', label: '🏢 회사 설립/등기' },
    { value: '주주분쟁', label: '📊 주주 분쟁' },
    { value: '기업규제', label: '📋 기업 규제/컴플라이언스' },
    { value: '기타', label: '📌 기타' },
  ],
};

// ==================== 메타데이터 스키마 (기존 호환) ====================

/**
 * 법령 메타데이터 스키마
 */
const LaborLawSchema = {
  documentType: 'labor_law',
  lawType: '',
  lawName: '',
  lawNumber: '',
  enactmentDate: '',
  enforcementDate: '',
  revisionDate: '',
  ministry: '',
  chapter: '',
  section: '',
  article: '',
  paragraph: '',
  subparagraph: '',
  item: '',
  revisionHistory: false,
  relatedLaws: [],
  keywords: [],
  category: '',
  importance: 0,
  frequentlyUsed: false
};

/**
 * 판례 메타데이터 스키마
 */
const LaborCaseSchema = {
  documentType: 'labor_case',
  courtType: '',
  courtName: '',
  caseNumber: '',
  judgmentDate: '',
  caseType: '',
  subject: '',
  plaintiffType: '',
  defendantType: '',
  judgmentResult: '',
  judgmentSummary: '',
  keyIssue: '',
  relatedLaws: [],
  relatedCases: [],
  precedentValue: '',
  importance: 0,
  keywords: [],
  category: '',
  isLandmark: false,
  citationCount: 0,
  hasMinorityOpinion: false
};

/**
 * 행정해석 메타데이터 스키마
 */
const LaborInterpretationSchema = {
  documentType: 'labor_interpretation',
  interpretationType: '',
  interpretationNumber: '',
  interpretationDate: '',
  issuingAuthority: '',
  department: '',
  subject: '',
  question: '',
  answer: '',
  relatedLaws: [],
  relatedCases: [],
  keywords: [],
  category: '',
  isActive: true,
  supersededBy: '',
  importance: 0
};

/**
 * 법령 유형 정의
 */
const LawTypes = {
  act: '법률',
  decree: '시행령',
  rule: '시행규칙',
  notice: '고시',
  directive: '훈령'
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
  static buildLaborLawMetadata(lawData) {
    const metadata = [
      { key: 'document_type', stringValue: 'labor_law' },
      { key: 'law_type', stringValue: lawData.lawType },
      { key: 'law_name', stringValue: lawData.lawName }
    ];

    if (lawData.lawNumber) metadata.push({ key: 'law_number', stringValue: lawData.lawNumber });
    if (lawData.ministry) metadata.push({ key: 'ministry', stringValue: lawData.ministry });
    if (lawData.chapter) metadata.push({ key: 'chapter', stringValue: lawData.chapter });
    if (lawData.article) metadata.push({ key: 'article', stringValue: lawData.article });
    if (lawData.category) metadata.push({ key: 'category', stringValue: lawData.category });
    if (lawData.importance) metadata.push({ key: 'importance', numericValue: lawData.importance });
    if (lawData.keywords && lawData.keywords.length > 0) metadata.push({ key: 'keywords', stringValue: lawData.keywords.join(', ') });
    if (lawData.relatedLaws && lawData.relatedLaws.length > 0) metadata.push({ key: 'related_laws', stringValue: lawData.relatedLaws.join(', ') });

    return metadata;
  }

  static buildLaborCaseMetadata(caseData) {
    const metadata = [
      { key: 'document_type', stringValue: 'labor_case' },
      { key: 'court_type', stringValue: caseData.courtType },
      { key: 'court_name', stringValue: caseData.courtName },
      { key: 'case_number', stringValue: caseData.caseNumber }
    ];

    if (caseData.judgmentDate) metadata.push({ key: 'judgment_date', stringValue: caseData.judgmentDate });
    if (caseData.subject) metadata.push({ key: 'subject', stringValue: caseData.subject });
    if (caseData.judgmentResult) metadata.push({ key: 'judgment_result', stringValue: caseData.judgmentResult });
    if (caseData.precedentValue) metadata.push({ key: 'precedent_value', stringValue: caseData.precedentValue });
    if (caseData.category) metadata.push({ key: 'category', stringValue: caseData.category });
    if (caseData.importance) metadata.push({ key: 'importance', numericValue: caseData.importance });
    if (caseData.keywords && caseData.keywords.length > 0) metadata.push({ key: 'keywords', stringValue: caseData.keywords.join(', ') });
    if (caseData.relatedLaws && caseData.relatedLaws.length > 0) metadata.push({ key: 'related_laws', stringValue: caseData.relatedLaws.join(', ') });

    return metadata;
  }

  static buildInterpretationMetadata(interpData) {
    const metadata = [
      { key: 'document_type', stringValue: 'labor_interpretation' },
      { key: 'interpretation_type', stringValue: interpData.interpretationType }
    ];

    if (interpData.interpretationNumber) metadata.push({ key: 'interpretation_number', stringValue: interpData.interpretationNumber });
    if (interpData.issuingAuthority) metadata.push({ key: 'issuing_authority', stringValue: interpData.issuingAuthority });
    if (interpData.subject) metadata.push({ key: 'subject', stringValue: interpData.subject });
    if (interpData.category) metadata.push({ key: 'category', stringValue: interpData.category });
    if (interpData.importance) metadata.push({ key: 'importance', numericValue: interpData.importance });
    if (interpData.keywords && interpData.keywords.length > 0) metadata.push({ key: 'keywords', stringValue: interpData.keywords.join(', ') });

    return metadata;
  }
}

/**
 * 청킹 설정 프리셋
 */
const LaborChunkingPresets = {
  law: {
    whiteSpaceConfig: { maxTokensPerChunk: 512, maxOverlapTokens: 64 }
  },
  case: {
    whiteSpaceConfig: { maxTokensPerChunk: 1024, maxOverlapTokens: 128 }
  },
  interpretation: {
    whiteSpaceConfig: { maxTokensPerChunk: 768, maxOverlapTokens: 64 }
  }
};

module.exports = {
  // 신규: 종합 법 분야 시스템
  LegalDomains,
  DomainCategories,
  DomainExperts,
  DomainCaseTypes,
  // 기존 호환: 노동법 전용
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
