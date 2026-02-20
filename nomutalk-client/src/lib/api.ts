/**
 * NomuTalk API Utilities
 * 백엔드 API 호출을 위한 유틸리티 함수
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4010';

// ==================== Chat API ====================

/**
 * 새 챗 세션 생성
 */
export async function createSession(): Promise<{ sessionId: string }> {
    const response = await fetch(`${API_BASE_URL}/api/chat/session/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    await fetch(`${API_BASE_URL}/api/chat/session/${sessionId}`, {
        method: 'DELETE'
    });
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
    const response = await fetch(`${API_BASE_URL}/api/labor/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
