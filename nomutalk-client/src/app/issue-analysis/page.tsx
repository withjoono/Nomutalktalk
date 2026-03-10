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
    const { state, runIssueAnalysis, setIssueResult, goToStep, reanalyze } = useCaseFlow();

    useEffect(() => {
        if (!state.caseId) {
            router.push('/case-input');
            return;
        }
        if (!state.issueResult && !state.isAnalyzing) {
            runIssueAnalysis();
        }
    }, [state.caseId]);

    const handleNodesUpdate = (nodes: GraphNode[], links: GraphLink[]) => {
        if (state.issueResult) {
            setIssueResult({ ...state.issueResult, nodes, links });
        }
    };

    const handleAddIssue = (issue: any) => {
        if (state.issueResult) {
            setIssueResult({
                ...state.issueResult,
                issues: [...state.issueResult.issues, issue],
            });
        }
    };

    const handleReanalyze = async () => {
        await reanalyze('issueAnalysis', 'manual');
    };

    if (!state.caseId) {
        return null;
    }

    return (
        <div className={styles.page}>
            {/* 로딩 상태 */}
            {(state.isAnalyzing || state.isReanalyzing) && !state.issueResult && (
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
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {state.buildMeta.analysisCount > 0 && (
                                <span style={{
                                    fontSize: '0.75rem',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    background: 'rgba(59, 130, 246, 0.12)',
                                    color: '#3b82f6',
                                    fontWeight: 600,
                                }}>
                                    v{state.buildMeta.analysisCount}
                                </span>
                            )}
                            <button
                                className={styles.resetBtn}
                                onClick={handleReanalyze}
                                disabled={state.isReanalyzing}
                                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600 }}
                            >
                                {state.isReanalyzing ? '재분석 중...' : '🔄 재분석'}
                            </button>
                            <button className={styles.resetBtn} onClick={() => goToStep(0)}>
                                ← 사건 입력으로
                            </button>
                        </div>
                    </div>

                    {/* 재분석 Diff 표시 */}
                    {state.lastDiff && (
                        <div style={{
                            padding: '12px 16px',
                            background: 'rgba(59, 130, 246, 0.06)',
                            borderRadius: '12px',
                            marginBottom: '16px',
                            border: '1px solid rgba(59, 130, 246, 0.15)',
                            fontSize: '0.85rem',
                            lineHeight: 1.6,
                        }}>
                            <strong style={{ color: '#3b82f6' }}>📊 이전 분석 대비 변경사항</strong>
                            {state.lastDiff.addedIssues && state.lastDiff.addedIssues.length > 0 && (
                                <div style={{ marginTop: '6px', color: '#10b981' }}>
                                    ➕ 새 쟁점: {state.lastDiff.addedIssues.join(', ')}
                                </div>
                            )}
                            {state.lastDiff.removedIssues && state.lastDiff.removedIssues.length > 0 && (
                                <div style={{ marginTop: '4px', color: '#ef4444' }}>
                                    ➖ 제거된 쟁점: {state.lastDiff.removedIssues.join(', ')}
                                </div>
                            )}
                            <div style={{ marginTop: '4px', color: 'var(--toss-text-tertiary)' }}>
                                🔄 유지: {state.lastDiff.unchangedCount}건
                            </div>
                        </div>
                    )}

                    {/* 재분석 로딩 오버레이 */}
                    {state.isReanalyzing && (
                        <div style={{
                            padding: '16px',
                            textAlign: 'center',
                            marginBottom: '16px',
                            background: 'rgba(59, 130, 246, 0.04)',
                            borderRadius: '12px',
                        }}>
                            <span className={styles.spinner} style={{ width: 24, height: 24, borderWidth: 2 }} />
                            <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--toss-text-tertiary)' }}>
                                기존 분석과 비교하며 재분석 중...
                            </p>
                        </div>
                    )}

                    <IssueAnalysisView
                        issues={state.issueResult.issues}
                        summary={state.issueResult.summary}
                        nodes={state.issueResult.nodes}
                        links={state.issueResult.links}
                        onProceedToChat={() => { }}
                        onNodesUpdate={handleNodesUpdate}
                        onAddIssue={handleAddIssue}
                    />

                    <StepNav currentStep={1} />
                </div>
            )}
        </div>
    );
}
