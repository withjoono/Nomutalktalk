'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    GraphNode, GraphLink, IssueInfo, CaseDetail,
    createCase, getCase, updateCaseStep, analyzeIssues, analyzeCaseGraph
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

    // UI 상태
    isAnalyzing: boolean;
    error: string | null;
}

interface CaseFlowContextType {
    state: CaseFlowState;
    /** 새 사건 시작 → 서버에 생성 → 쟁점 분석 페이지로 이동 */
    startNewCase: (description: string, caseType?: string) => Promise<void>;
    /** 과거 사건 불러오기 → 마지막 단계로 이동 */
    loadCase: (caseId: string) => Promise<void>;
    /** 쟁점 분석 실행 + 결과 저장 */
    runIssueAnalysis: () => Promise<void>;
    /** 법령 분석 실행 + 결과 저장 */
    runLawAnalysis: () => Promise<void>;
    /** 다음 단계로 진행 */
    goToStep: (step: number) => void;
    /** 쟁점 분석 결과 직접 설정 (과거 사건 로드 시 사용) */
    setIssueResult: (result: CaseFlowState['issueResult']) => void;
    /** 법령 분석 결과 직접 설정 */
    setLawResult: (result: CaseFlowState['lawResult']) => void;
    /** 초기화 */
    resetFlow: () => void;
}

const initialState: CaseFlowState = {
    caseId: null,
    description: '',
    caseType: '',
    currentStep: 0,
    issueResult: null,
    lawResult: null,
    chatSessionId: null,
    isAnalyzing: false,
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
                isAnalyzing: false,
                error: null,
            };
            setState(newState);

            // 마지막 완료된 단계의 다음으로 이동
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

            // 서버 저장 (non-blocking)
            updateCaseStep(state.caseId, 'issueAnalysis', issueResult, 1).catch(console.error);
        } catch (err: any) {
            setState(prev => ({ ...prev, isAnalyzing: false, error: err.message }));
        }
    }, [state.caseId, state.description, state.caseType]);

    // 법령 분석 실행
    const runLawAnalysis = useCallback(async () => {
        if (!state.caseId || !state.description) return;
        setState(prev => ({ ...prev, isAnalyzing: true, error: null }));
        try {
            const result = await analyzeCaseGraph(state.description);
            const lawResult = {
                nodes: result.nodes || [],
                links: result.links || [],
                summary: result.summary || '',
            };

            setState(prev => ({
                ...prev,
                lawResult,
                currentStep: 2,
                isAnalyzing: false,
            }));

            // 서버 저장 (non-blocking)
            updateCaseStep(state.caseId, 'lawAnalysis', lawResult, 2).catch(console.error);
        } catch (err: any) {
            setState(prev => ({ ...prev, isAnalyzing: false, error: err.message }));
        }
    }, [state.caseId, state.description]);

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
