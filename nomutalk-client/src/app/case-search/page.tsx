'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseFlow } from '@/context/CaseFlowContext';
import IssueGraphView from '@/components/labor/IssueGraphView';
import StepNav from '@/components/layout/StepNav';
import styles from '../issue-analysis/page.module.css';

export default function CaseSearchPage() {
    const router = useRouter();
    const { state, runLawAnalysis, goToStep, reanalyze } = useCaseFlow();

    useEffect(() => {
        if (!state.caseId) {
            router.push('/case-input');
            return;
        }
        if (!state.issueResult) {
            router.push('/issue-analysis');
            return;
        }
        if (!state.lawResult && !state.isAnalyzing) {
            runLawAnalysis();
        }
    }, [state.caseId, state.issueResult]);

    const handleReanalyze = async () => {
        await reanalyze('lawAnalysis', 'manual');
    };

    if (!state.caseId || !state.issueResult) {
        return null;
    }

    const displayNodes = state.lawResult?.nodes || [];
    const displayLinks = state.lawResult?.links || [];

    return (
        <div className={styles.page}>
            {/* 로딩 상태 */}
            {(state.isAnalyzing || state.isReanalyzing) && !state.lawResult && (
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
                                onClick={handleReanalyze}
                                disabled={state.isReanalyzing}
                                style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600 }}
                            >
                                {state.isReanalyzing ? '재분석 중...' : '🔄 재분석'}
                            </button>
                            <button className={styles.resetBtn} onClick={() => goToStep(1)}>
                                ← 핵심 쟁점으로
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
                            {state.lastDiff.addedNodes && state.lastDiff.addedNodes.length > 0 && (
                                <div style={{ marginTop: '6px', color: '#10b981' }}>
                                    ➕ 새 법령/판례: {state.lastDiff.addedNodes.join(', ')}
                                </div>
                            )}
                            {state.lastDiff.removedNodes && state.lastDiff.removedNodes.length > 0 && (
                                <div style={{ marginTop: '4px', color: '#ef4444' }}>
                                    ➖ 제거됨: {state.lastDiff.removedNodes.join(', ')}
                                </div>
                            )}
                            <div style={{ marginTop: '4px', color: 'var(--toss-text-tertiary)' }}>
                                🔄 유지: {state.lastDiff.unchangedCount}건
                            </div>
                        </div>
                    )}

                    {/* 재분석 로딩 */}
                    {state.isReanalyzing && (
                        <div style={{
                            padding: '16px', textAlign: 'center', marginBottom: '16px',
                            background: 'rgba(59, 130, 246, 0.04)', borderRadius: '12px',
                        }}>
                            <span className={styles.spinner} style={{ width: 24, height: 24, borderWidth: 2 }} />
                            <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--toss-text-tertiary)' }}>
                                법령·판례를 재검색하며 비교 분석 중...
                            </p>
                        </div>
                    )}

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
