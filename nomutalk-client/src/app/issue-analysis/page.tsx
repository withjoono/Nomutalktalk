'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseFlow } from '@/context/CaseFlowContext';
import IssueAnalysisView from '@/components/case-consultation/IssueAnalysisView';
import StepNav from '@/components/layout/StepNav';
import { GraphNode, GraphLink, addCaseUpdate } from '@/lib/api';
import styles from './page.module.css';

export default function IssueAnalysisPage() {
    const router = useRouter();
    const { state, runIssueAnalysis, setIssueResult, goToStep, reanalyze } = useCaseFlow();

    // 추가 정보 입력 상태
    const [showUpdateInput, setShowUpdateInput] = useState(false);
    const [updateTab, setUpdateTab] = useState<'supplement' | 'progress'>('supplement');
    const [updateContent, setUpdateContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

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

    const handleSubmitUpdate = async () => {
        if (!state.caseId || !updateContent.trim() || submitting) return;
        setSubmitting(true);
        try {
            await addCaseUpdate(state.caseId, updateTab, updateContent.trim());
            setSubmitted(true);
            setUpdateContent('');
            // 자동 재분석
            setTimeout(() => {
                reanalyze('issueAnalysis', updateTab === 'supplement' ? 'evidence_added' : 'description_updated');
            }, 500);
        } catch (err: any) {
            alert('추가 실패: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!state.caseId) {
        return null;
    }

    return (
        <div className={styles.page}>
            {/* ═══ 추가 정보 입력 (기존 사건 재진입 시) ═══ */}
            {state.issueResult && !state.isAnalyzing && !submitted && (
                <div style={{
                    padding: '14px 18px', borderRadius: '14px', marginBottom: '16px',
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(139,92,246,0.06))',
                    border: '1px solid rgba(59,130,246,0.15)',
                }}>
                    {!showUpdateInput ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--toss-text-secondary)' }}>
                                💡 빠뜨린 내용이나 새로운 진행상황이 있나요?
                            </p>
                            <button
                                onClick={() => setShowUpdateInput(true)}
                                style={{
                                    padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                    fontSize: '0.82rem', fontWeight: 600,
                                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff',
                                }}
                            >
                                ✏️ 추가하기
                            </button>
                        </div>
                    ) : (
                        <div>
                            {/* 보충/경과 탭 */}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                <button
                                    onClick={() => setUpdateTab('supplement')}
                                    style={{
                                        padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                        fontSize: '0.82rem', fontWeight: updateTab === 'supplement' ? 600 : 400,
                                        background: updateTab === 'supplement' ? '#3b82f6' : 'var(--toss-bg-secondary)',
                                        color: updateTab === 'supplement' ? '#fff' : 'var(--toss-text-secondary)',
                                    }}
                                >
                                    📝 빠뜨린 내용
                                </button>
                                <button
                                    onClick={() => setUpdateTab('progress')}
                                    style={{
                                        padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                        fontSize: '0.82rem', fontWeight: updateTab === 'progress' ? 600 : 400,
                                        background: updateTab === 'progress' ? '#10b981' : 'var(--toss-bg-secondary)',
                                        color: updateTab === 'progress' ? '#fff' : 'var(--toss-text-secondary)',
                                    }}
                                >
                                    📅 새 진행상황
                                </button>
                            </div>

                            <textarea
                                value={updateContent}
                                onChange={(e) => setUpdateContent(e.target.value)}
                                placeholder={updateTab === 'supplement'
                                    ? '예: 초과근무 수당 약정이 있었음, 계약서에 수습 3개월 조항이 있었음...'
                                    : '예: 오늘 노동위원회에 진정서를 접수함, 회사에서 합의를 제안해옴...'}
                                style={{
                                    width: '100%', minHeight: '70px', padding: '10px',
                                    borderRadius: '10px', border: '1px solid var(--toss-border)',
                                    background: 'var(--toss-bg-primary)', resize: 'vertical',
                                    fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--toss-text-primary)',
                                }}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => { setShowUpdateInput(false); setUpdateContent(''); }}
                                    style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--toss-border)', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--toss-text-secondary)' }}
                                >
                                    건너뛰기
                                </button>
                                <button
                                    onClick={handleSubmitUpdate}
                                    disabled={!updateContent.trim() || submitting}
                                    style={{
                                        padding: '6px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                        fontSize: '0.82rem', fontWeight: 600, color: '#fff',
                                        background: updateTab === 'supplement' ? '#3b82f6' : '#10b981',
                                        opacity: !updateContent.trim() || submitting ? 0.5 : 1,
                                    }}
                                >
                                    {submitting ? '저장 중...' : '추가 후 재분석'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 추가 완료 메시지 */}
            {submitted && !state.isReanalyzing && (
                <div style={{
                    padding: '12px 16px', borderRadius: '12px', marginBottom: '16px',
                    background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)',
                    fontSize: '0.85rem', color: '#10b981', fontWeight: 500,
                }}>
                    ✅ 추가 정보가 저장되었습니다. 반영된 분석 결과를 확인하세요.
                </div>
            )}

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
                                    fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px',
                                    background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', fontWeight: 600,
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
                            padding: '12px 16px', background: 'rgba(59, 130, 246, 0.06)',
                            borderRadius: '12px', marginBottom: '16px',
                            border: '1px solid rgba(59, 130, 246, 0.15)',
                            fontSize: '0.85rem', lineHeight: 1.6,
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
                            padding: '16px', textAlign: 'center', marginBottom: '16px',
                            background: 'rgba(59, 130, 246, 0.04)', borderRadius: '12px',
                        }}>
                            <span className={styles.spinner} style={{ width: 24, height: 24, borderWidth: 2 }} />
                            <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--toss-text-tertiary)' }}>
                                추가 정보를 반영하여 재분석 중...
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
