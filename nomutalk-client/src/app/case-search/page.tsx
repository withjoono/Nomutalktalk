'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseFlow } from '@/context/CaseFlowContext';
import IssueGraphView from '@/components/labor/IssueGraphView';
import StepNav from '@/components/layout/StepNav';
import styles from '../issue-analysis/page.module.css';

export default function CaseSearchPage() {
    const router = useRouter();
    const { state, runLawAnalysis, goToStep } = useCaseFlow();

    // 사건이 없으면 입력 페이지로 리다이렉트
    useEffect(() => {
        if (!state.caseId) {
            router.push('/case-input');
            return;
        }
        // 쟁점 분석이 안 되어 있으면 쟁점 분석으로 이동
        if (!state.issueResult) {
            router.push('/issue-analysis');
            return;
        }
        // 법령 분석 결과가 없으면 자동 분석 시작
        if (!state.lawResult && !state.isAnalyzing) {
            runLawAnalysis();
        }
    }, [state.caseId, state.issueResult]);

    if (!state.caseId || !state.issueResult) {
        return null; // 리다이렉트 중
    }

    const displayNodes = state.lawResult?.nodes || [];
    const displayLinks = state.lawResult?.links || [];

    return (
        <div className={styles.page}>
            {/* 로딩 상태 */}
            {state.isAnalyzing && !state.lawResult && (
                <div className={styles.inputSection}>
                    <h1 className={styles.title}>⚖️ 관련 법령·판례 분석</h1>
                    <p className={styles.subtitle}>
                        AI가 관련 법령과 판례를 분석하고 있습니다...
                    </p>
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <span className={styles.spinner} style={{ width: 40, height: 40, borderWidth: 3 }} />
                        <p className={styles.loadingHint}>
                            관련 법령·판례·행정해석 검색 중... (약 10~20초 소요)
                        </p>
                    </div>
                </div>
            )}

            {/* 에러 */}
            {state.error && !state.lawResult && !state.isAnalyzing && (
                <div className={styles.inputSection}>
                    <h1 className={styles.title}>⚖️ 관련 법령·판례</h1>
                    <div className={styles.errorMsg}>⚠️ {state.error}</div>
                    <button className={styles.analyzeBtn} onClick={runLawAnalysis}>
                        🔄 다시 시도
                    </button>
                </div>
            )}

            {/* 분석 결과 */}
            {state.lawResult && (
                <div className={styles.resultSection}>
                    <div className={styles.resultHeader}>
                        <h2 className={styles.resultTitle}>⚖️ 관련 법령·판례</h2>
                        <button className={styles.resetBtn} onClick={() => goToStep(1)}>
                            ← 핵심 쟁점으로
                        </button>
                    </div>

                    {/* AI 분석 요약 */}
                    {state.lawResult.summary && (
                        <div style={{
                            padding: '16px 20px',
                            background: 'var(--toss-bg-secondary)',
                            borderRadius: 'var(--toss-radius-md)',
                            marginBottom: '20px',
                            border: '1px solid var(--toss-border)',
                        }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: 'var(--toss-text-primary)' }}>
                                🧠 AI 법률 분석
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--toss-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {state.lawResult.summary}
                            </p>
                        </div>
                    )}

                    {/* 그래프 */}
                    {displayNodes.length > 0 && (
                        <IssueGraphView
                            nodes={displayNodes}
                            links={displayLinks}
                            initialHeight={550}
                            minHeight={400}
                        />
                    )}

                    <StepNav currentStep={2} />
                </div>
            )}
        </div>
    );
}
