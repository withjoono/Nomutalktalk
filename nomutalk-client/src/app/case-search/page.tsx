'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseFlow } from '@/context/CaseFlowContext';
import IssueGraphView from '@/components/labor/IssueGraphView';
import StepNav from '@/components/layout/StepNav';
import styles from '../issue-analysis/page.module.css';

const SEVERITY_COLORS: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#10b981',
};

export default function CaseSearchPage() {
    const router = useRouter();
    const { state, runLawAnalysis, goToStep, reanalyze } = useCaseFlow();
    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null); // null = 전체

    useEffect(() => {
        if (!state.caseId) { router.push('/case-input'); return; }
        if (!state.issueResult) { router.push('/issue-analysis'); return; }
        if (!state.lawResult && !state.isAnalyzing) { runLawAnalysis(); }
    }, [state.caseId, state.issueResult]);

    const handleReanalyze = async () => { await reanalyze('lawAnalysis', 'manual'); };

    if (!state.caseId || !state.issueResult) return null;

    const issues = state.issueResult.issues || [];
    const allNodes = state.lawResult?.nodes || state.issueResult.nodes || [];
    const allLinks = state.lawResult?.links || state.issueResult.links || [];

    // 쟁점별 법령 수 계산
    const lawCountByIssue = useMemo(() => {
        const counts: Record<string, number> = {};
        allNodes.forEach(n => {
            if (n.type !== 'case' && n.type !== 'issue' && (n as any).parentIssue) {
                counts[(n as any).parentIssue] = (counts[(n as any).parentIssue] || 0) + 1;
            }
        });
        return counts;
    }, [allNodes]);

    // 필터링된 노드/링크
    const { filteredNodes, filteredLinks } = useMemo(() => {
        if (!selectedIssueId) {
            return { filteredNodes: allNodes, filteredLinks: allLinks };
        }

        // 선택된 쟁점 + 센터 + 해당 쟁점의 하위 법령만
        const keepNodeIds = new Set<string>();
        keepNodeIds.add('center');
        keepNodeIds.add(selectedIssueId);

        allNodes.forEach(n => {
            if ((n as any).parentIssue === selectedIssueId) {
                keepNodeIds.add(n.id);
            }
        });

        // 같은 법령이 여러 쟁점에 연결된 경우 — 해당 법령도 포함
        allLinks.forEach(link => {
            const src = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
            const tgt = typeof link.target === 'string' ? link.target : (link.target as any)?.id;
            if (src === selectedIssueId && !keepNodeIds.has(tgt)) {
                keepNodeIds.add(tgt);
            }
        });

        const filteredNodes = allNodes.filter(n => keepNodeIds.has(n.id));
        const filteredLinks = allLinks.filter(link => {
            const src = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
            const tgt = typeof link.target === 'string' ? link.target : (link.target as any)?.id;
            return keepNodeIds.has(src) && keepNodeIds.has(tgt);
        });

        return { filteredNodes, filteredLinks };
    }, [selectedIssueId, allNodes, allLinks]);

    const totalLawCount = allNodes.filter(n => n.type !== 'case' && n.type !== 'issue').length;
    const currentLawCount = filteredNodes.filter(n => n.type !== 'case' && n.type !== 'issue').length;

    return (
        <div className={styles.page}>
            {/* 로딩 */}
            {state.isAnalyzing && !state.lawResult && (
                <div className={styles.inputSection}>
                    <h1 className={styles.title}>⚖️ 관련 법령·판례</h1>
                    <p className={styles.subtitle}>각 쟁점에 대한 관련 법령을 분석하고 있습니다...</p>
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <span className={styles.spinner} style={{ width: 40, height: 40, borderWidth: 3 }} />
                    </div>
                </div>
            )}

            {/* 에러 */}
            {state.error && !state.lawResult && !state.isAnalyzing && (
                <div className={styles.inputSection}>
                    <h1 className={styles.title}>⚖️ 관련 법령·판례</h1>
                    <div className={styles.errorMsg}>⚠️ {state.error}</div>
                    <button className={styles.analyzeBtn} onClick={runLawAnalysis}>🔄 다시 시도</button>
                </div>
            )}

            {/* 분석 결과 */}
            {(state.lawResult || issues.length > 0) && (
                <div className={styles.resultSection}>
                    {/* 헤더 */}
                    <div className={styles.resultHeader}>
                        <h2 className={styles.resultTitle}>
                            ⚖️ 관련 법령·판례 ({selectedIssueId ? `${currentLawCount}/${totalLawCount}건` : `${totalLawCount}건`})
                        </h2>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {state.buildMeta.analysisCount > 0 && (
                                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontWeight: 600 }}>
                                    v{state.buildMeta.analysisCount}
                                </span>
                            )}
                            <button onClick={handleReanalyze} disabled={state.isReanalyzing}
                                style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', color: '#fff', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600 }}>
                                {state.isReanalyzing ? '재분석 중...' : '🔄 재분석'}
                            </button>
                            <button className={styles.resetBtn} onClick={() => goToStep(1)}>← 핵심 쟁점으로</button>
                        </div>
                    </div>

                    {/* 재분석 Diff */}
                    {state.lastDiff && (
                        <div style={{ padding: '12px 16px', background: 'rgba(59,130,246,0.06)', borderRadius: '12px', marginBottom: '16px', border: '1px solid rgba(59,130,246,0.15)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                            <strong style={{ color: '#3b82f6' }}>📊 변경사항</strong>
                            {state.lastDiff.addedNodes && state.lastDiff.addedNodes.length > 0 && <div style={{ marginTop: '6px', color: '#10b981' }}>➕ {state.lastDiff.addedNodes.join(', ')}</div>}
                            {state.lastDiff.removedNodes && state.lastDiff.removedNodes.length > 0 && <div style={{ marginTop: '4px', color: '#ef4444' }}>➖ {state.lastDiff.removedNodes.join(', ')}</div>}
                            <div style={{ marginTop: '4px', color: 'var(--toss-text-tertiary)' }}>🔄 유지: {state.lastDiff.unchangedCount}건</div>
                        </div>
                    )}

                    {/* 재분석 로딩 */}
                    {state.isReanalyzing && (
                        <div style={{ padding: '16px', textAlign: 'center', marginBottom: '16px', background: 'rgba(59,130,246,0.04)', borderRadius: '12px' }}>
                            <span className={styles.spinner} style={{ width: 24, height: 24, borderWidth: 2 }} />
                            <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--toss-text-tertiary)' }}>재검색 중...</p>
                        </div>
                    )}

                    {/* AI 요약 */}
                    {state.lawResult?.summary && (
                        <div style={{ padding: '16px 20px', background: 'var(--toss-bg-secondary)', borderRadius: 'var(--toss-radius-md)', marginBottom: '16px', border: '1px solid var(--toss-border)' }}>
                            <h3 style={{ margin: '0 0 8px', fontSize: '1rem', color: 'var(--toss-text-primary)' }}>🧠 AI 분석</h3>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--toss-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{state.lawResult.summary}</p>
                        </div>
                    )}

                    {/* ═══ 쟁점 필터 칩 ═══ */}
                    <div style={{
                        display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px',
                        padding: '10px 14px', background: 'var(--toss-bg-secondary)', borderRadius: '14px',
                        border: '1px solid var(--toss-border)',
                    }}>
                        {/* 전체 칩 */}
                        <button
                            onClick={() => setSelectedIssueId(null)}
                            style={{
                                padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s',
                                background: !selectedIssueId ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)' : 'var(--toss-bg-primary)',
                                color: !selectedIssueId ? '#fff' : 'var(--toss-text-secondary)',
                                boxShadow: !selectedIssueId ? '0 2px 8px rgba(59,130,246,0.3)' : '0 1px 3px rgba(0,0,0,0.06)',
                            }}
                        >
                            전체 ({totalLawCount})
                        </button>

                        {/* 쟁점별 칩 */}
                        {issues.map(issue => {
                            const isActive = selectedIssueId === issue.id;
                            const count = lawCountByIssue[issue.id] || 0;
                            const color = SEVERITY_COLORS[issue.severity] || '#6b7280';
                            return (
                                <button
                                    key={issue.id}
                                    onClick={() => setSelectedIssueId(isActive ? null : issue.id)}
                                    style={{
                                        padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                        fontSize: '0.82rem', fontWeight: isActive ? 600 : 500, transition: 'all 0.15s',
                                        background: isActive ? color : 'var(--toss-bg-primary)',
                                        color: isActive ? '#fff' : 'var(--toss-text-secondary)',
                                        boxShadow: isActive ? `0 2px 8px ${color}44` : '0 1px 3px rgba(0,0,0,0.06)',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                    }}
                                >
                                    <span style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: isActive ? '#fff' : color,
                                        flexShrink: 0,
                                    }} />
                                    {issue.title} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {/* ═══ 그래프 뷰 ═══ */}
                    {filteredNodes.length > 0 && (
                        <IssueGraphView
                            key={selectedIssueId || 'all'} // force re-render on filter change
                            nodes={filteredNodes}
                            links={filteredLinks}
                            initialHeight={550}
                            minHeight={400}
                        />
                    )}

                    {filteredNodes.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--toss-text-tertiary)' }}>
                            관련 법령이 없습니다
                        </div>
                    )}

                    <StepNav currentStep={2} />
                </div>
            )}
        </div>
    );
}
