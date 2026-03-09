'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseFlow } from '@/context/CaseFlowContext';
import IssueAnalysisView from '@/components/case-consultation/IssueAnalysisView';
import StepNav from '@/components/layout/StepNav';
import { GraphNode, GraphLink } from '@/lib/api';
import styles from './page.module.css';

export default function IssueAnalysisPage() {
    const router = useRouter();
    const { state, runIssueAnalysis, setIssueResult, goToStep } = useCaseFlow();

    // 사건이 없으면 입력 페이지로 리다이렉트
    useEffect(() => {
        if (!state.caseId) {
            router.push('/case-input');
            return;
        }
        // 관련 결과가 없으면 자동 분석 시작
        if (!state.issueResult && !state.isAnalyzing) {
            runIssueAnalysis();
        }
    }, [state.caseId]);

    const handleNodesUpdate = (nodes: GraphNode[], links: GraphLink[]) => {
        if (state.issueResult) {
            setIssueResult({ ...state.issueResult, nodes, links });
        }
    };

    if (!state.caseId) {
        return null; // 리다이렉트 중
    }

    return (
        <div className={styles.page}>
            {/* 로딩 상태 */}
            {state.isAnalyzing && !state.issueResult && (
                <div className={styles.inputSection}>
                    <h1 className={styles.title}>🔥 핵심 쟁점 분석</h1>
                    <p className={styles.subtitle}>
                        AI가 핵심 법적 쟁점을 분석하고 있습니다...
                    </p>
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <span className={styles.spinner} style={{ width: 40, height: 40, borderWidth: 3 }} />
                        <p className={styles.loadingHint}>
                            쟁점 추출 → 쟁점별 법령/판례 검색 중... (약 10~20초 소요)
                        </p>
                    </div>
                </div>
            )}

            {/* 에러 */}
            {state.error && !state.issueResult && !state.isAnalyzing && (
                <div className={styles.inputSection}>
                    <h1 className={styles.title}>🔥 핵심 쟁점 분석</h1>
                    <div className={styles.errorMsg}>⚠️ {state.error}</div>
                    <button className={styles.analyzeBtn} onClick={runIssueAnalysis}>
                        🔄 다시 시도
                    </button>
                </div>
            )}

            {/* 분석 결과 */}
            {state.issueResult && (
                <div className={styles.resultSection}>
                    <div className={styles.resultHeader}>
                        <h2 className={styles.resultTitle}>🔥 쟁점 분석 결과</h2>
                        <button className={styles.resetBtn} onClick={() => goToStep(0)}>
                            ← 사건 입력으로
                        </button>
                    </div>

                    <IssueAnalysisView
                        issues={state.issueResult.issues}
                        summary={state.issueResult.summary}
                        nodes={state.issueResult.nodes}
                        links={state.issueResult.links}
                        onProceedToChat={() => { }}
                        onNodesUpdate={handleNodesUpdate}
                    />

                    <StepNav currentStep={1} />
                </div>
            )}
        </div>
    );
}
