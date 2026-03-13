/**
 * NomuTalk API Utilities
 * 백엔드 API 호출을 위한 유틸리티 함수
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4010';

/**
 * 전역 인증 토큰 관리 (AuthContext에서 설정)
 */
let authToken: string | null = null;

export function setApiToken(token: string | null) {
    authToken = token;
}

export function getApiToken(): string | null {
    return authToken;
}

/**
 * 인증 헤더를 포함한 fetch 래퍼
 */
async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
    };

    if (authToken) {
        (headers as any)['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    return response;
}

// ==================== Chat API ====================

/**
 * 새 챗 세션 생성
 */
export async function createSession(): Promise<{ sessionId: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/chat/session/new`, {
        method: 'POST',
        body: JSON.stringify({})
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '세션 생성 실패');
    }

    return { sessionId: data.data.sessionId };
}

/**
 * 챗 메시지 전송
 */
export interface ChatResponse {
    message: string;
    stage: 'diagnosis' | 'analysis' | 'solution' | 'followup';
    nextStage?: string;
    category?: string;
}

export async function sendChatMessage(sessionId: string, message: string): Promise<ChatResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/chat/message`, {
        method: 'POST',
        body: JSON.stringify({ sessionId, message })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '메시지 전송 실패');
    }

    return data.data;
}

/**
 * 세션 삭제
 */
export async function deleteSession(sessionId: string): Promise<void> {
    await fetchWithAuth(`${API_BASE_URL}/api/chat/session/${sessionId}`, {
        method: 'DELETE'
    });
}

// ==================== Contextual AI Chat ====================

export interface ContextualSessionRequest {
    caseDescription: string;
    issues: IssueInfo[];
    laws: { title: string; type: string; detail: string; label?: string }[];
    summary: string;
    consultMode?: 'prediction' | 'response' | 'evidence' | 'compensation' | 'document' | 'general';
}

export async function createContextualSession(
    context: ContextualSessionRequest
): Promise<{ sessionId: string; welcomeMessage: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/chat/contextual`, {
        method: 'POST',
        body: JSON.stringify(context)
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '맥락 상담 세션 생성 실패');
    }

    return data.data;
}

export async function sendContextualMessage(
    sessionId: string,
    message: string
): Promise<{ message: string; stage: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/chat/message`, {
        method: 'POST',
        body: JSON.stringify({ sessionId, message })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '메시지 전송 실패');
    }

    return data.data;
}


export interface Citation {
    title: string;
    uri?: string;
    source: 'grounding' | 'citation';
    startIndex?: number; // For detailed citations
    endIndex?: number;
}

export interface LaborAIResponse {
    answer: string;
    citations: Citation[];
}

// ==================== Case Analysis Graph API ====================

export interface GraphNode {
    id: string;
    label: string;
    type: 'case' | 'law' | 'precedent' | 'interpretation' | 'decision' | 'issue' | 'unknown';
    detail: string;
    val: number;
    /** 소속 쟁점 ID (쟁점별 그룹핑용) */
    parentIssue?: string;
    /** 쟁점 심각도 (issue 노드 전용) */
    severity?: 'high' | 'medium' | 'low';
}

export interface GraphLink {
    source: string;
    target: string;
    label: string;
}

export interface CaseAnalysisResult {
    summary: string;
    similarCasesSummary: string;
    nodes: GraphNode[];
    links: GraphLink[];
    timestamp: string;
}

// ==================== Issue Analysis API ====================

export interface IssueInfo {
    id: string;
    title: string;
    summary: string;
    severity: 'high' | 'medium' | 'low';
    winRate?: number | null;
    winRateReason?: string;
    favorableFactors?: string[];
    unfavorableFactors?: string[];
}

export interface IssueAnalysisResult {
    issues: IssueInfo[];
    summary: string;
    overallWinRate?: number | null;
    overallAssessment?: string;
    nodes: GraphNode[];
    links: GraphLink[];
    timestamp: string;
}

/**
 * 핵심 쟁점 분석 (사건 → 쟁점 → 관련 법령/판례)
 */
export async function analyzeIssues(description: string): Promise<IssueAnalysisResult> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/analyze-issues`, {
        method: 'POST',
        body: JSON.stringify({ description })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '쟁점 분석 실패');
    }

    return data.data;
}

/**
 * 사건 분석 그래프 생성
 */
export async function analyzeCaseGraph(description: string): Promise<CaseAnalysisResult> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/analyze-case`, {
        method: 'POST',
        body: JSON.stringify({ description })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '사건 분석 실패');
    }

    return data.data;
}

/**
 * 파일 업로드 → 텍스트 추출 → 사건 분석
 */
export interface FileAnalysisResult extends CaseAnalysisResult {
    fileName: string;
    extractedText: string;
}

export async function analyzeFileGraph(file: File): Promise<FileAnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const response = await fetch(`${API_BASE_URL}/api/labor/analyze-file`, {
        method: 'POST',
        headers,
        body: formData,
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '파일 분석 실패');
    }

    return data.data;
}

/**
 * 그래프 노드 확장 (2-depth)
 */
export interface ExpandNodeResult {
    expandedNodeId: string;
    detail: string;
    newNodes: GraphNode[];
    newLinks: GraphLink[];
}

export async function expandGraphNode(nodeId: string, nodeLabel: string, nodeType: string): Promise<ExpandNodeResult> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/expand-node`, {
        method: 'POST',
        body: JSON.stringify({ nodeId, nodeLabel, nodeType })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '노드 확장 실패');
    }

    return data.data;
}

/**
 * 법률 서면 자동생성
 */
export type DocumentType = 'complaint' | 'response' | 'objection' | 'appeal' | 'evidence';

export interface GeneratedDocument {
    documentType: DocumentType;
    documentTypeName: string;
    content: string;
    citations: string[];
    timestamp: string;
}

export async function generateLegalDocument(
    caseDescription: string,
    documentType: DocumentType,
    additionalInfo?: Record<string, string>
): Promise<GeneratedDocument> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/generate-document`, {
        method: 'POST',
        body: JSON.stringify({ caseDescription, documentType, additionalInfo })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '서면 생성 실패');
    }

    return data.data;
}

/**
 * 통합 사건 세션 생성 (텍스트 + 복수 파일 → 분석 + 챗봇 세션)
 */
export interface CaseSessionResult {
    caseSessionId: string;
    chatSessionId: string;
    summary: string;
    similarCasesSummary: string;
    nodes: GraphNode[];
    links: GraphLink[];
    extractedTexts: { fileName: string; preview: string }[];
    timestamp: string;
}

export async function createCaseSession(description: string, files: File[]): Promise<CaseSessionResult> {
    const formData = new FormData();
    if (description.trim()) formData.append('description', description);
    files.forEach((file) => formData.append('files', file));

    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const response = await fetch(`${API_BASE_URL}/api/labor/case-session/create`, {
        method: 'POST',
        headers,
        body: formData,
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.error || '통합 세션 생성 실패');
    return data.data;
}

// ==================== Labor AI API ====================

/**
 * 질의응답
 */
export interface AskQuestionParams {
    query: string;
    category?: string;
    includeCases?: boolean;
    includeInterpretations?: boolean;
}

export async function askQuestion(params: AskQuestionParams): Promise<LaborAIResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/ask`, {
        method: 'POST',
        body: JSON.stringify(params)
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '답변 생성 실패');
    }

    return {
        answer: data.data.answer,
        citations: data.data.citations || []
    };
}

/**
 * 유사 판례 검색
 */
export async function searchSimilarCases(description: string): Promise<LaborAIResponse> {
    const response = await fetch(`${API_BASE_URL}/api/labor/similar-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '판례 검색 실패');
    }

    return {
        answer: data.data.result,
        citations: data.data.citations || []
    };
}

/**
 * 법령 조항 검색
 */
export async function searchLawArticle(lawName: string, article: string): Promise<LaborAIResponse> {
    const response = await fetch(`${API_BASE_URL}/api/labor/law-article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lawName, article })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '법령 조회 실패');
    }

    return {
        answer: data.data.result,
        citations: data.data.citations || []
    };
}

/**
 * 템플릿 상담
 */
export async function consultWithTemplate(
    templateType: string,
    params: Record<string, string>
): Promise<LaborAIResponse> {
    const response = await fetch(`${API_BASE_URL}/api/labor/consult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateType, params })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '템플릿 상담 실패');
    }

    return {
        answer: data.data.result,
        citations: data.data.citations || []
    };
}

/**
 * 카테고리 목록 조회
 */
export interface Category {
    name: string;
    keywords: string[];
}

export async function getCategories(): Promise<Category[]> {
    const response = await fetch(`${API_BASE_URL}/api/labor/categories`);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '카테고리 조회 실패');
    }

    return data.data;
}

/**
 * Health Check
 */
export async function checkHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/labor/health`);
        const data = await response.json();
        return data.success === true;
    } catch {
        return false;
    }
}

// ==================== Unified Search API ====================

/**
 * 검색 결과 항목
 */
export interface SearchResultItem {
    id: string;
    type: 'law' | 'case' | 'interpretation';
    title: string;
    summary: string;
    category?: string;
    date?: string;
    source?: string;
    citations?: Citation[];
}

/**
 * 통합 검색 파라미터
 */
export interface SearchParams {
    query: string;
    type?: 'all' | 'law' | 'case' | 'interpretation';
    category?: string;
}

/**
 * 통합 검색 (법령, 판례, 행정해석)
 * /api/labor/ask 를 활용하여 검색 결과 생성
 */
export async function searchLaws(params: SearchParams): Promise<SearchResultItem[]> {
    const { query, type = 'all', category } = params;

    // 검색 쿼리 구성
    let searchQuery = query;
    if (type !== 'all') {
        const typeLabels = { law: '법령', case: '판례', interpretation: '행정해석' };
        searchQuery = `${typeLabels[type]} 중에서 "${query}"에 대해 알려주세요`;
    }

    const response = await fetch(`${API_BASE_URL}/api/labor/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: searchQuery,
            category: category || undefined,
            includeCases: type === 'all' || type === 'case',
            includeInterpretations: type === 'all' || type === 'interpretation'
        })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || '검색 실패');
    }

    // 검색 결과를 파싱하여 구조화된 형태로 반환
    const { answer, citations } = data.data;

    // 단일 결과 항목으로 반환 (AI 응답은 구조화하기 어려우므로)
    const results: SearchResultItem[] = [{
        id: `search-${Date.now()}`,
        type: type === 'all' ? 'law' : type,
        title: `"${query}" 검색 결과`,
        summary: answer || '',
        category: category || undefined,
        date: new Date().toISOString().split('T')[0],
        citations: citations || []
    }];

    return results;
}


// ==================== Payment API ====================

export interface PaymentProduct {
    id: number;
    name: string;
    code: string;
    price: number;
    description: string;
    features: string[];
    period: number;
}

export interface PaymentOrder {
    id: number;
    merchantUid: string;
    productName: string;
    productPrice: number;
    amount: number;
    status: string;
    cardName: string | null;
    cardNumber: string | null;
    paidAt: string | null;
    createdAt: string;
}

export interface PreparePaymentResponse {
    merchantUid: string;
    amount: number;
    productName: string;
    storeCode: string;
}

export async function getStoreCode(): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/api/payments/store-code`);
    const data = await response.json();
    return data.data.storeCode;
}

export async function getProducts(): Promise<PaymentProduct[]> {
    const response = await fetch(`${API_BASE_URL}/api/payments/products`);
    const data = await response.json();
    return data.data || [];
}

export async function preparePayment(productId: number, userId?: string, userEmail?: string): Promise<PreparePaymentResponse> {
    const response = await fetch(`${API_BASE_URL}/api/payments/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, userId, userEmail })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || '결제 준비 실패');
    return data.data;
}

export async function verifyPayment(impUid: string, merchantUid: string): Promise<{ orderId: number; status: string }> {
    const response = await fetch(`${API_BASE_URL}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ impUid, merchantUid })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || '결제 검증 실패');
    return data.data;
}

export async function getPaymentHistory(userId?: string): Promise<PaymentOrder[]> {
    const url = userId
        ? `${API_BASE_URL}/api/payments/history?userId=${userId}`
        : `${API_BASE_URL}/api/payments/history`;
    const response = await fetch(url);
    const data = await response.json();
    return data.data || [];
}

export async function getPaymentDetail(id: number): Promise<PaymentOrder> {
    const response = await fetch(`${API_BASE_URL}/api/payments/history/${id}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || '결제 상세 조회 실패');
    return data.data;
}

// ==================== Case Management API ====================

export interface BuildMeta {
    analysisCount: number;
    chatCount: number;
    evidenceCount: number;
    insightCount: number;
    lastAnalyzedAt: string | null;
}

export interface TimelineEvent {
    type: string;
    timestamp: string;
    detail: string;
    version?: number;
    trigger?: string;
    oldDescriptionPreview?: string;
    newDescriptionPreview?: string;
}

export interface CaseInsight {
    id: string;
    content: string;
    type: 'ai_extracted' | 'user_memo';
    source: string;
    createdAt: string;
}

export interface CaseRecord {
    id: string;
    description: string;
    caseType: string;
    currentStep: number;
    createdAt: string;
    updatedAt: string;
    hasIssueAnalysis: boolean;
    hasLawAnalysis: boolean;
    hasChatSession: boolean;
    buildMeta: BuildMeta;
    timelineCount: number;
}

export interface CaseDetail {
    id: string;
    description: string;
    caseType: string;
    currentStep: number;
    steps: {
        issueAnalysis?: {
            issues: IssueInfo[];
            summary: string;
            nodes: GraphNode[];
            links: GraphLink[];
            completedAt: string;
            version?: number;
            diff?: any;
        };
        issueAnalysisHistory?: Array<{
            issues: IssueInfo[];
            summary: string;
            nodes: GraphNode[];
            links: GraphLink[];
            completedAt: string;
            version: number;
            trigger?: string;
            diff?: any;
        }>;
        lawAnalysis?: {
            nodes: GraphNode[];
            links: GraphLink[];
            summary: string;
            completedAt: string;
            version?: number;
            diff?: any;
        };
        lawAnalysisHistory?: Array<{
            nodes: GraphNode[];
            links: GraphLink[];
            summary: string;
            completedAt: string;
            version: number;
            trigger?: string;
            diff?: any;
        }>;
        chatSessionId?: string;
    };
    buildMeta: BuildMeta;
    timeline: TimelineEvent[];
    insights: CaseInsight[];
    updates: CaseUpdate[];
    evidence: CaseEvidence[];
    createdAt: string;
    updatedAt: string;
}

export interface CaseUpdate {
    id: string;
    caseId: string;
    type: 'supplement' | 'progress';
    content: string;
    createdAt: string;
}

export interface CaseEvidence {
    id: string;
    fileName: string;
    fileType: 'image' | 'pdf' | 'text';
    sourceLabel: string;
    extractedText: string;
    structuredData: {
        keyItems?: Array<{ label: string; value: string; important?: boolean }>;
        documentType?: string;
        summary?: string;
    } | null;
    fileSize: number;
    createdAt: string;
}

export async function createCase(description: string, caseType?: string): Promise<{ caseId: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/cases`, {
        method: 'POST',
        body: JSON.stringify({ description, caseType }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || '사건 생성 실패');
    return data.data;
}

export async function listCases(): Promise<CaseRecord[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/cases`);
    const data = await response.json();
    return data.data || [];
}

export async function getCase(caseId: string): Promise<CaseDetail> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/cases/${caseId}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || '사건 조회 실패');
    return data.data;
}

export async function updateCaseStep(
    caseId: string,
    stepName: string,
    stepData: Record<string, any>,
    currentStep?: number
): Promise<void> {
    await fetchWithAuth(`${API_BASE_URL}/api/labor/cases/${caseId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stepName, stepData, currentStep }),
    });
}

// ==================== Build System API ====================

export interface ReanalysisResult {
    result: {
        issues?: IssueInfo[];
        summary: string;
        nodes: GraphNode[];
        links: GraphLink[];
    };
    diff: {
        addedIssues?: string[];
        removedIssues?: string[];
        addedNodes?: string[];
        removedNodes?: string[];
        unchangedCount: number;
    } | null;
    version: number;
    trigger: string;
}

export async function reanalyzeCase(
    caseId: string,
    stepName: 'issueAnalysis' | 'lawAnalysis',
    trigger: 'manual' | 'evidence_added' | 'description_updated' = 'manual'
): Promise<ReanalysisResult> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/cases/${caseId}/reanalyze`, {
        method: 'POST',
        body: JSON.stringify({ stepName, trigger }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || '재분석 실패');
    return data.data;
}

export async function updateCaseDescription(
    caseId: string,
    newDescription: string,
    reason?: string
): Promise<{ previousDescription: string; newDescription: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/cases/${caseId}/update-description`, {
        method: 'POST',
        body: JSON.stringify({ newDescription, reason }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || '설명 업데이트 실패');
    return data.data;
}

export async function getCaseInsights(caseId: string): Promise<CaseInsight[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/cases/${caseId}/insights`);
    const data = await response.json();
    if (!data.success) throw new Error(data.error || '인사이트 조회 실패');
    return data.data;
}

export async function addCaseInsight(
    caseId: string,
    content: string,
    type: 'ai_extracted' | 'user_memo' = 'user_memo'
): Promise<CaseInsight> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/cases/${caseId}/insights`, {
        method: 'POST',
        body: JSON.stringify({ content, type }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || '인사이트 추가 실패');
    return data.data;
}

// ==================== Case Updates (보충/경과) ====================

export async function addCaseUpdate(
    caseId: string,
    type: 'supplement' | 'progress',
    content: string,
): Promise<CaseUpdate> {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/labor/cases/${caseId}/updates`, {
        method: 'POST',
        body: JSON.stringify({ type, content }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || '업데이트 추가 실패');
    return data.data;
}

// ==================== Evidence (증거/자료) ====================

export async function uploadEvidence(
    caseId: string,
    file: File,
    sourceLabel?: string,
): Promise<{ id: string; fileName: string; sourceLabel: string; extractedText: string; structuredData: any }> {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('로그인이 필요합니다');
    const token = await user.getIdToken();

    const formData = new FormData();
    formData.append('file', file);
    if (sourceLabel) formData.append('sourceLabel', sourceLabel);

    const response = await fetch(`${API_BASE_URL}/api/labor/cases/${caseId}/evidence`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || '증거 업로드 실패');
    return data.data;
}
