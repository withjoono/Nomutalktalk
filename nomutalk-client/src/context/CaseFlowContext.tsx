'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    GraphNode, GraphLink, IssueInfo, CaseDetail, BuildMeta, TimelineEvent, CaseInsight,
    createCase, getCase, updateCaseStep, analyzeIssues, analyzeCaseGraph,
    reanalyzeCase, updateCaseDescription as apiUpdateDescription, ReanalysisResult,
} from '@/lib/api';

// ==================== Types ====================

export interface CaseFlowState {
    caseId: string | null;
    description: string;
    caseType: string;
    currentStep: number; // 0=입력, 1=쟁점, 2=법령, 3=상담

    // Step 1: 쟁점 분석 결과
    issueResult: {
        issues: IssueInfo[];
        summary: string;
        nodes: GraphNode[];
        links: GraphLink[];
    } | null;

    // Step 2: 법령 분석 결과
    lawResult: {
        nodes: GraphNode[];
        links: GraphLink[];
        summary: string;
    } | null;

    // Step 3: 채팅 세션
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
}

interface CaseFlowContextType {
    state: CaseFlowState;
    startNewCase: (description: string, caseType?: string) => Promise<void>;
    loadCase: (caseId: string) => Promise<void>;
    runIssueAnalysis: () => Promise<void>;
    runLawAnalysis: () => Promise<void>;
    goToStep: (step: number) => void;
    setIssueResult: (result: CaseFlowState['issueResult']) => void;
    setLawResult: (result: CaseFlowState['lawResult']) => void;
    resetFlow: () => void;
    /** 재분석 실행 (빌드) */
    reanalyze: (stepName: 'issueAnalysis' | 'lawAnalysis', trigger?: 'manual' | 'evidence_added' | 'description_updated') => Promise<void>;
    /** 상황 업데이트 (빌드) */
    updateDescription: (newDescription: string, reason?: string) => Promise<void>;
}

const defaultBuildMeta: BuildMeta = { analysisCount: 0, chatCount: 0, evidenceCount: 0, insightCount: 0, lastAnalyzedAt: null };

const initialState: CaseFlowState = {
    caseId: null,
    description: '',
    caseType: '',
    currentStep: 0,
    issueResult: null,
    lawResult: null,
    chatSessionId: null,
    buildMeta: defaultBuildMeta,
    timeline: [],
    insights: [],
    lastDiff: null,
    isAnalyzing: false,
    isReanalyzing: false,
    error: null,
};

const CaseFlowContext = createContext<CaseFlowContextType | null>(null);

// ==================== Provider ====================

export function CaseFlowProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [state, setState] = useState<CaseFlowState>(initialState);

    const resetFlow = useCallback(() => setState(initialState), []);

    // 새 사건 시작
    const startNewCase = useCallback(async (description: string, caseType?: string) => {
        setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
        try {
            const { caseId } = await createCase(description, caseType);
            setState(prev => ({
                ...prev,
                caseId,
                description,
                caseType: caseType || '',
                currentStep: 1,
                issueResult: null,
                lawResult: null,
                chatSessionId: null,
                buildMeta: { ...defaultBuildMeta },
                timeline: [{ type: 'case_created', timestamp: new Date().toISOString(), detail: `사건 등록` }],
                insights: [],
                lastDiff: null,
                isAnalyzing: false,
            }));
            router.push('/issue-analysis');
        } catch (err: any) {
            setState(prev => ({ ...prev, isAnalyzing: false, error: err.message }));
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
                currentStep: detail.currentStep,
                issueResult: detail.steps.issueAnalysis || null,
                lawResult: detail.steps.lawAnalysis || null,
                chatSessionId: typeof detail.steps.chatSessionId === 'string' ? detail.steps.chatSessionId : null,
                buildMeta: detail.buildMeta || defaultBuildMeta,
                timeline: detail.timeline || [],
                insights: detail.insights || [],
                lastDiff: null,
                isAnalyzing: false,
                isReanalyzing: false,
                error: null,
            };
            setState(newState);

            const step = detail.currentStep;
            if (step >= 3) router.push('/chat');
            else if (step >= 2) router.push('/case-search');
            else if (step >= 1) router.push('/issue-analysis');
            else router.push('/case-input');
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
                nodes: result.nodes || [],
                links: result.links || [],
            };

            setState(prev => ({
                ...prev,
                issueResult,
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

    const goToStep = useCallback((step: number) => {
        setState(prev => ({ ...prev, currentStep: step }));
        switch (step) {
            case 0: router.push('/case-input'); break;
            case 1: router.push('/issue-analysis'); break;
            case 2: router.push('/case-search'); break;
            case 3: router.push('/chat'); break;
        }
    }, [router]);

    const setIssueResult = useCallback((result: CaseFlowState['issueResult']) => {
        setState(prev => ({ ...prev, issueResult: result }));
    }, []);

    const setLawResult = useCallback((result: CaseFlowState['lawResult']) => {
        setState(prev => ({ ...prev, lawResult: result }));
    }, []);

    return (
        <CaseFlowContext.Provider value={{
            state,
            startNewCase,
            loadCase,
            runIssueAnalysis,
            runLawAnalysis,
            goToStep,
            setIssueResult,
            setLawResult,
            resetFlow,
            reanalyze,
            updateDescription,
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
