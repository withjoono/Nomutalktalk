'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    GraphNode, GraphLink, IssueInfo, CaseDetail, BuildMeta, TimelineEvent, CaseInsight,
    PredictionResult, SufficiencyQuestion, SufficiencyResult, RequestIntent, QuickAssistResult,
    createCase, getCase, updateCaseStep, analyzeIssues, analyzeCaseGraph,
    reanalyzeCase, updateCaseDescription as apiUpdateDescription, ReanalysisResult,
    AlternativeMethod, fetchAlternatives, checkSufficiency as apiCheckSufficiency,
    fetchQuickAssist,
} from '@/lib/api';

// ==================== Types ====================

export interface CaseFlowState {
    caseId: string | null;
    description: string;
    caseType: string;
    legalDomain: string; // 법 분야: labor, civil, criminal, family, admin, ip, corporate
    currentStep: number; // 0=입력, 1=쟁점, 2=법령, 3=예상결과, 4=대안, 5=후속

    // Step 1: 쟁점 분석 결과
    issueResult: {
        issues: IssueInfo[];
        summary: string;
        overallWinRate?: number | null;
        overallAssessment?: string;
        nodes: GraphNode[];
        links: GraphLink[];
    } | null;

    // Step 2: 법령 분석 결과
    lawResult: {
        nodes: GraphNode[];
        links: GraphLink[];
        summary: string;
    } | null;

    // Step 3: 예상 결과
    predictionResult: PredictionResult | null;

    // Step 4: 대안 제안 결과
    alternativesResult: {
        methods: AlternativeMethod[];
        recommendation: string;
        reasoning: string;
    } | null;

    // 선택된 해결 방법 (Step 4 → Step 5 전달용)
    selectedMethod: AlternativeMethod | null;

    // 채팅 세션 (AI 상담)
    chatSessionId: string | null;

    // 빌드 시스템
    buildMeta: BuildMeta;
    timeline: TimelineEvent[];
    insights: CaseInsight[];
    lastDiff: ReanalysisResult['diff'] | null;

    // UI 상태
    isAnalyzing: boolean;
    isReanalyzing: boolean;
    error: string | null;

    // 충분성 체크
    sufficiencyQuestions: SufficiencyQuestion[];
    sufficiencyMessage: string | null;
    isCheckingSufficiency: boolean;

    // 빠른 도움 (비분쟁)
    quickAssistResult: QuickAssistResult | null;
    detectedIntent: RequestIntent | null;
    intentConfidence: number;
}

interface CaseFlowContextType {
    state: CaseFlowState;
    startNewCase: (description: string, caseType?: string, legalDomain?: string) => Promise<void>;
    loadCase: (caseId: string) => Promise<void>;
    runIssueAnalysis: () => Promise<void>;
    runLawAnalysis: () => Promise<void>;
    runAlternativesAnalysis: () => Promise<void>;
    goToStep: (step: number) => void;
    setIssueResult: (result: CaseFlowState['issueResult']) => void;
    setLawResult: (result: CaseFlowState['lawResult']) => void;
    setSelectedMethod: (method: AlternativeMethod | null) => void;
    resetFlow: () => void;
    /** 재분석 실행 (빌드) */
    reanalyze: (stepName: 'issueAnalysis' | 'lawAnalysis', trigger?: 'manual' | 'evidence_added' | 'description_updated') => Promise<void>;
    /** 상황 업데이트 (빌드) */
    updateDescription: (newDescription: string, reason?: string) => Promise<void>;
    /** 추가 답변 후 분석 진행 */
    appendAndRecheck: (additionalInfo: string) => Promise<void>;
    /** 충분성 무시하고 분석 진행 */
    skipSufficiencyCheck: () => void;
    /** 빠른 답변에서 심층 분석으로 전환 */
    escalateToDispute: (additionalInfo?: string) => Promise<void>;
}

const defaultBuildMeta: BuildMeta = { analysisCount: 0, chatCount: 0, evidenceCount: 0, insightCount: 0, lastAnalyzedAt: null };

const initialState: CaseFlowState = {
    caseId: null,
    description: '',
    caseType: '',
    legalDomain: 'labor',
    currentStep: 0,
    issueResult: null,
    lawResult: null,
    alternativesResult: null,
    predictionResult: null,
    selectedMethod: null,
    chatSessionId: null,
    buildMeta: defaultBuildMeta,
    timeline: [],
    insights: [],
    lastDiff: null,
    isAnalyzing: false,
    isReanalyzing: false,
    error: null,
    sufficiencyQuestions: [],
    sufficiencyMessage: null,
    isCheckingSufficiency: false,
    quickAssistResult: null,
    detectedIntent: null,
    intentConfidence: 0,
};

const CaseFlowContext = createContext<CaseFlowContextType | null>(null);

// ==================== Provider ====================

export function CaseFlowProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [state, setState] = useState<CaseFlowState>(initialState);

    const resetFlow = useCallback(() => setState(initialState), []);

    // 새 사건 시작 — "빠른 답변 우선" 병렬 실행
    const startNewCase = useCallback(async (description: string, caseType?: string, legalDomain?: string) => {
        setState(prev => ({ ...prev, isCheckingSufficiency: true, isAnalyzing: true, error: null, sufficiencyQuestions: [], sufficiencyMessage: null, quickAssistResult: null, detectedIntent: null, intentConfidence: 0 }));
        try {
            // ═══ 1) 의도 분류 + 빠른 답변 병렬 실행 ═══
            const [suffResult, quickResult] = await Promise.all([
                apiCheckSufficiency(description, caseType),
                fetchQuickAssist(description, 'information', caseType).catch(() => null),
            ]);

            const intent = suffResult.intent || 'information';
            const confidence = suffResult.confidence ?? 0.5;

            // ═══ 2) 빠른 답변을 항상 먼저 표시 → quick-result로 이동 ═══
            // dispute든 아니든, 일단 빠른 답변을 보여줌
            if (quickResult) {
                setState(prev => ({
                    ...prev,
                    description,
                    caseType: caseType || '',
                    legalDomain: legalDomain || 'labor',
                    detectedIntent: intent,
                    intentConfidence: confidence,
                    quickAssistResult: quickResult,
                    isAnalyzing: false,
                    isCheckingSufficiency: false,
                    sufficiencyQuestions: (intent === 'dispute' && !suffResult.sufficient) ? (suffResult.questions || []) : [],
                    sufficiencyMessage: (intent === 'dispute' && !suffResult.sufficient) ? (suffResult.message || null) : null,
                }));
                router.push('/quick-result');
                return;
            }

            // ═══ 3) quick-assist 실패 시: 기존 분기 로직으로 fallback ═══
            if (intent === 'dispute') {
                const { caseId } = await createCase(description, caseType);
                if (suffResult.sufficient) {
                    setState(prev => ({
                        ...prev,
                        caseId,
                        description,
                        caseType: caseType || '',
                        legalDomain: legalDomain || 'labor',
                        currentStep: 1,
                        detectedIntent: 'dispute',
                        intentConfidence: confidence,
                        issueResult: null,
                        lawResult: null,
                        chatSessionId: null,
                        buildMeta: { ...defaultBuildMeta },
                        timeline: [{ type: 'case_created', timestamp: new Date().toISOString(), detail: '사건 등록' }],
                        insights: [],
                        lastDiff: null,
                        isAnalyzing: false,
                        isCheckingSufficiency: false,
                        sufficiencyQuestions: [],
                        sufficiencyMessage: null,
                    }));
                    router.push('/issue-analysis');
                } else {
                    setState(prev => ({
                        ...prev,
                        caseId,
                        description,
                        caseType: caseType || '',
                        legalDomain: legalDomain || 'labor',
                        currentStep: 0,
                        detectedIntent: 'dispute',
                        intentConfidence: confidence,
                        issueResult: null,
                        lawResult: null,
                        chatSessionId: null,
                        buildMeta: { ...defaultBuildMeta },
                        timeline: [{ type: 'case_created', timestamp: new Date().toISOString(), detail: '사건 등록 (추가 정보 요청)' }],
                        insights: [],
                        lastDiff: null,
                        isAnalyzing: false,
                        isCheckingSufficiency: false,
                        sufficiencyQuestions: suffResult.questions || [],
                        sufficiencyMessage: suffResult.message || '추가 정보가 필요합니다.',
                    }));
                }
            } else {
                // 비분쟁인데 quick-assist도 실패 → 에러
                setState(prev => ({ ...prev, isAnalyzing: false, isCheckingSufficiency: false, error: '답변 생성에 실패했습니다. 다시 시도해주세요.' }));
            }
        } catch (err: any) {
            setState(prev => ({ ...prev, isAnalyzing: false, isCheckingSufficiency: false, error: err.message }));
        }
    }, [router]);

    // 과거 사건 불러오기
    const loadCase = useCallback(async (caseId: string) => {
        setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
        try {
            const detail: CaseDetail = await getCase(caseId);
            const newState: CaseFlowState = {
                caseId,
                description: detail.description,
                caseType: detail.caseType,
                legalDomain: (detail as any).legalDomain || 'labor',
                currentStep: detail.currentStep,
                issueResult: detail.steps.issueAnalysis || null,
                lawResult: detail.steps.lawAnalysis || null,
                alternativesResult: (detail.steps as any).alternativesAnalysis || null,
                predictionResult: null,
                selectedMethod: null,
                chatSessionId: typeof detail.steps.chatSessionId === 'string' ? detail.steps.chatSessionId : null,
                buildMeta: detail.buildMeta || defaultBuildMeta,
                timeline: detail.timeline || [],
                insights: detail.insights || [],
                lastDiff: null,
                isAnalyzing: false,
                isReanalyzing: false,
                error: null,
                sufficiencyQuestions: [],
                sufficiencyMessage: null,
                isCheckingSufficiency: false,
                quickAssistResult: null,
                detectedIntent: 'dispute',
                intentConfidence: 1,
            };
            setState(newState);

            // 항상 핵심쟁점부터 순서대로 진행 (쟁점 → 법령 → 상담)
            router.push('/issue-analysis');
        } catch (err: any) {
            setState(prev => ({ ...prev, isAnalyzing: false, error: err.message }));
        }
    }, [router]);

    // 쟁점 분석 실행
    const runIssueAnalysis = useCallback(async () => {
        if (!state.caseId || !state.description) return;
        setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
        try {
            const desc = state.caseType
                ? `[사건유형: ${state.caseType}] ${state.description}`
                : state.description;

            const result = await analyzeIssues(desc);
            const issueResult = {
                issues: result.issues || [],
                summary: result.summary || '',
                overallWinRate: result.overallWinRate ?? null,
                overallAssessment: result.overallAssessment || '',
                nodes: result.nodes || [],
                links: result.links || [],
            };

            setState(prev => ({
                ...prev,
                issueResult,
                predictionResult: result.prediction || null,
                currentStep: 1,
                isAnalyzing: false,
            }));

            updateCaseStep(state.caseId, 'issueAnalysis', issueResult, 1).catch(console.error);
        } catch (err: any) {
            setState(prev => ({ ...prev, isAnalyzing: false, error: err.message }));
        }
    }, [state.caseId, state.description, state.caseType]);

    // 법령 분석 실행 — Step 1의 issueResult 데이터에서 쟁점별 법령 추출
    const runLawAnalysis = useCallback(async () => {
        if (!state.caseId || !state.issueResult) return;

        // issueResult에 이미 쟁점별 법령 노드가 parentIssue로 매핑되어 있음
        const lawResult = {
            nodes: state.issueResult.nodes || [],
            links: state.issueResult.links || [],
            summary: state.issueResult.summary || '',
        };

        setState(prev => ({
            ...prev,
            lawResult,
            currentStep: 2,
        }));

        updateCaseStep(state.caseId, 'lawAnalysis', lawResult, 2).catch(console.error);
    }, [state.caseId, state.issueResult]);

    // 재분석 (빌드)
    const reanalyze = useCallback(async (stepName: 'issueAnalysis' | 'lawAnalysis', trigger: 'manual' | 'evidence_added' | 'description_updated' = 'manual') => {
        if (!state.caseId) return;
        setState(prev => ({ ...prev, isReanalyzing: true, error: null, lastDiff: null }));
        try {
            const result = await reanalyzeCase(state.caseId, stepName, trigger);

            if (stepName === 'issueAnalysis') {
                setState(prev => ({
                    ...prev,
                    issueResult: {
                        issues: result.result.issues || [],
                        summary: result.result.summary || '',
                        nodes: result.result.nodes || [],
                        links: result.result.links || [],
                    },
                    lastDiff: result.diff,
                    buildMeta: { ...prev.buildMeta, analysisCount: prev.buildMeta.analysisCount + 1, lastAnalyzedAt: new Date().toISOString() },
                    isReanalyzing: false,
                }));
            } else {
                setState(prev => ({
                    ...prev,
                    lawResult: {
                        nodes: result.result.nodes || [],
                        links: result.result.links || [],
                        summary: result.result.summary || '',
                    },
                    lastDiff: result.diff,
                    buildMeta: { ...prev.buildMeta, analysisCount: prev.buildMeta.analysisCount + 1, lastAnalyzedAt: new Date().toISOString() },
                    isReanalyzing: false,
                }));
            }
        } catch (err: any) {
            setState(prev => ({ ...prev, isReanalyzing: false, error: err.message }));
        }
    }, [state.caseId]);

    // 상황 업데이트 (빌드)
    const updateDescription = useCallback(async (newDescription: string, reason?: string) => {
        if (!state.caseId) return;
        setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
        try {
            await apiUpdateDescription(state.caseId, newDescription, reason);
            setState(prev => ({
                ...prev,
                description: newDescription,
                timeline: [...prev.timeline, {
                    type: 'description_updated',
                    timestamp: new Date().toISOString(),
                    detail: reason || '상황 업데이트',
                }],
                isAnalyzing: false,
            }));
        } catch (err: any) {
            setState(prev => ({ ...prev, isAnalyzing: false, error: err.message }));
        }
    }, [state.caseId]);

    // 대안 분석 실행
    const runAlternativesAnalysis = useCallback(async () => {
        if (!state.caseId || !state.issueResult) return;
        setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
        try {
            const result = await fetchAlternatives(
                state.caseId,
                state.description,
                state.issueResult.issues,
                state.caseType,
            );
            setState(prev => ({
                ...prev,
                alternativesResult: result,
                currentStep: 4,
                isAnalyzing: false,
            }));
            updateCaseStep(state.caseId, 'alternativesAnalysis', result, 4).catch(console.error);
        } catch (err: any) {
            setState(prev => ({ ...prev, isAnalyzing: false, error: err.message }));
        }
    }, [state.caseId, state.description, state.issueResult, state.caseType]);

    const goToStep = useCallback((step: number) => {
        setState(prev => ({ ...prev, currentStep: step }));
        switch (step) {
            case 0: router.push('/case-input'); break;
            case 1: router.push('/issue-analysis'); break;
            case 2: router.push('/case-search'); break;
            case 3: router.push('/prediction'); break;
            case 4: router.push('/alternatives'); break;
            case 5: router.push('/follow-up'); break;
        }
    }, [router]);

    const setIssueResult = useCallback((result: CaseFlowState['issueResult']) => {
        setState(prev => ({ ...prev, issueResult: result }));
    }, []);

    const setLawResult = useCallback((result: CaseFlowState['lawResult']) => {
        setState(prev => ({ ...prev, lawResult: result }));
    }, []);

    const setSelectedMethod = useCallback((method: AlternativeMethod | null) => {
        setState(prev => ({ ...prev, selectedMethod: method }));
    }, []);

    // 추가 답변 후 재체크
    const appendAndRecheck = useCallback(async (additionalInfo: string) => {
        if (!state.caseId) return;
        const newDescription = state.description + '\n\n[추가 정보]\n' + additionalInfo;
        setState(prev => ({ ...prev, isCheckingSufficiency: true, description: newDescription, sufficiencyQuestions: [], sufficiencyMessage: null }));
        try {
            // 서버에 상황 업데이트
            await apiUpdateDescription(state.caseId, newDescription, '추가 정보 입력');

            // 다시 충분성 체크
            const suffResult = await apiCheckSufficiency(newDescription, state.caseType);

            if (suffResult.sufficient) {
                setState(prev => ({
                    ...prev,
                    isCheckingSufficiency: false,
                    sufficiencyQuestions: [],
                    sufficiencyMessage: null,
                    currentStep: 1,
                    timeline: [...prev.timeline, { type: 'info_added', timestamp: new Date().toISOString(), detail: '추가 정보 입력 완료' }],
                }));
                router.push('/issue-analysis');
            } else {
                setState(prev => ({
                    ...prev,
                    isCheckingSufficiency: false,
                    sufficiencyQuestions: suffResult.questions || [],
                    sufficiencyMessage: suffResult.message || '아직 추가 정보가 필요합니다.',
                }));
            }
        } catch (err: any) {
            // 오류 시 분석 진행 허용
            setState(prev => ({
                ...prev, isCheckingSufficiency: false,
                sufficiencyQuestions: [], sufficiencyMessage: null,
                currentStep: 1,
            }));
            router.push('/issue-analysis');
        }
    }, [state.caseId, state.description, state.caseType, router]);

    // 충분성 무시하고 분석 진행
    const skipSufficiencyCheck = useCallback(() => {
        setState(prev => ({
            ...prev,
            sufficiencyQuestions: [],
            sufficiencyMessage: null,
            currentStep: 1,
        }));
        router.push('/issue-analysis');
    }, [router]);

    // 빠른 답변에서 심층 분석으로 전환 (quick-result → issue-analysis)
    const escalateToDispute = useCallback(async (additionalInfo?: string) => {
        if (!state.description) return;
        setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
        try {
            // 대화형 질문의 답변을 description에 합산
            const fullDescription = additionalInfo
                ? `${state.description}\n\n[추가 확인 사항]\n${additionalInfo}`
                : state.description;

            const { caseId } = await createCase(fullDescription, state.caseType || undefined);
            setState(prev => ({
                ...prev,
                caseId,
                description: fullDescription,
                currentStep: 1,
                detectedIntent: 'dispute',
                issueResult: null,
                lawResult: null,
                chatSessionId: null,
                buildMeta: { ...defaultBuildMeta },
                timeline: [{ type: 'case_created', timestamp: new Date().toISOString(), detail: '심층 분석 전환' }],
                insights: [],
                lastDiff: null,
                isAnalyzing: false,
                sufficiencyQuestions: [],
                sufficiencyMessage: null,
                quickAssistResult: null,
            }));
            router.push('/issue-analysis');
        } catch (err: any) {
            setState(prev => ({ ...prev, isAnalyzing: false, error: err.message }));
        }
    }, [state.description, state.caseType, router]);

    return (
        <CaseFlowContext.Provider value={{
            state,
            startNewCase,
            loadCase,
            runIssueAnalysis,
            runLawAnalysis,
            runAlternativesAnalysis,
            goToStep,
            setIssueResult,
            setLawResult,
            setSelectedMethod,
            resetFlow,
            reanalyze,
            updateDescription,
            appendAndRecheck,
            skipSufficiencyCheck,
            escalateToDispute,
        }}>
            {children}
        </CaseFlowContext.Provider>
    );
}

// ==================== Hook ====================

export function useCaseFlow() {
    const ctx = useContext(CaseFlowContext);
    if (!ctx) throw new Error('useCaseFlow must be used within CaseFlowProvider');
    return ctx;
}
