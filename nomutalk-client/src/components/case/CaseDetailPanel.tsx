'use client';

import React, { useState, useEffect } from 'react';
import { CaseDetail, getCase } from '@/lib/api';
import styles from './CaseDetailPanel.module.css';

interface CaseDetailPanelProps {
    caseId: string;
    onClose: () => void;
    onContinue: (caseId: string) => void;
}

function formatDateTime(dateStr: string) {
    try {
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch { return ''; }
}

function getTriggerLabel(trigger?: string) {
    switch (trigger) {
        case 'evidence_added': return '보충 반영';
        case 'description_updated': return '경과 반영';
        case 'manual': return '수동';
        default: return trigger || '';
    }
}

export default function CaseDetailPanel({ caseId, onClose, onContinue }: CaseDetailPanelProps) {
    const [detail, setDetail] = useState<CaseDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'timeline' | 'versions' | 'insights'>('timeline');

    useEffect(() => {
        setLoading(true);
        setError(null);
        getCase(caseId)
            .then(d => { setDetail(d); setLoading(false); })
            .catch(err => { setError(err.message); setLoading(false); });
    }, [caseId]);

    const issueHistory = detail?.steps?.issueAnalysisHistory || [];
    const lawHistory = detail?.steps?.lawAnalysisHistory || [];
    const timeline = detail?.timeline || [];
    const insights = detail?.insights || [];
    const updates = detail?.updates || [];

    return (
        <div className={styles.detailOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.detailPanel}>
                <div className={styles.detailHeader}>
                    <h2 className={styles.detailTitle}>📋 사건 상세</h2>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.detailBody}>
                    {loading && <p style={{ textAlign: 'center', color: 'var(--toss-text-tertiary)' }}>불러오는 중...</p>}
                    {error && <p style={{ color: '#ef4444' }}>⚠️ {error}</p>}

                    {detail && (
                        <>
                            {/* 사건 설명 */}
                            <div className={styles.descBlock}>
                                <p className={styles.descLabel}>사건 내용</p>
                                <p className={styles.descText}>
                                    {detail.description.length > 200 ? detail.description.substring(0, 200) + '...' : detail.description}
                                </p>
                            </div>

                            {/* 메타 뱃지 */}
                            <div className={styles.metaRow}>
                                {detail.caseType && <span className={styles.metaBadge}>{detail.caseType}</span>}
                                <span className={styles.metaBadge}>분석 {detail.buildMeta?.analysisCount || 0}회</span>
                                {updates.length > 0 && <span className={styles.metaBadge}>📝 업데이트 {updates.length}건</span>}
                                <span className={styles.metaBadge}>{formatDateTime(detail.createdAt)}</span>
                            </div>

                            {/* 이어서 분석 버튼 — 핵심쟁점 → 법령 → 상담 순서 */}
                            <div className={styles.actionRow}>
                                <button className={`${styles.actionBtn} ${styles.primaryBtn}`} onClick={() => onContinue(caseId)}>
                                    🔍 이어서 분석하기
                                </button>
                            </div>

                            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--toss-text-tertiary)', textAlign: 'center' }}>
                                핵심 쟁점 → 관련 법령 → AI 상담 순서로 진행됩니다.<br />
                                빠뜨린 내용이나 경과가 있으면 분석 화면에서 바로 추가할 수 있어요.
                            </p>

                            {/* 탭 */}
                            <div style={{ display: 'flex', gap: '4px', background: 'var(--toss-bg-secondary)', borderRadius: '10px', padding: '3px' }}>
                                {[
                                    { key: 'timeline' as const, label: `타임라인 (${timeline.length})` },
                                    { key: 'versions' as const, label: `분석이력 (${issueHistory.length + lawHistory.length})` },
                                    { key: 'insights' as const, label: `인사이트 (${insights.length})` },
                                ].map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        style={{
                                            flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none',
                                            fontSize: '0.78rem', fontWeight: activeTab === tab.key ? 600 : 400,
                                            cursor: 'pointer', transition: 'all 0.15s',
                                            background: activeTab === tab.key ? 'var(--toss-bg-primary)' : 'transparent',
                                            color: activeTab === tab.key ? 'var(--toss-text-primary)' : 'var(--toss-text-tertiary)',
                                            boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                        }}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* 타임라인 탭 */}
                            {activeTab === 'timeline' && (
                                <div className={styles.historySection}>
                                    {timeline.length === 0 ? (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--toss-text-tertiary)', textAlign: 'center' }}>아직 이벤트가 없습니다</p>
                                    ) : (
                                        <div className={styles.timelineList}>
                                            {timeline.map((event, i) => (
                                                <div key={i} className={styles.timelineItem}>
                                                    <span className={styles.timelineDot} data-type={event.type} />
                                                    <div className={styles.timelineContent}>
                                                        <p className={styles.timelineDetail}>{event.detail}</p>
                                                        <p className={styles.timelineTime}>{formatDateTime(event.timestamp)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 분석 이력 탭 */}
                            {activeTab === 'versions' && (
                                <div className={styles.historySection}>
                                    {issueHistory.length > 0 && (
                                        <>
                                            <p className={styles.sectionLabel}>🎯 쟁점 분석 이력</p>
                                            {issueHistory.map((v, i) => (
                                                <div key={`issue-${i}`} className={styles.versionCard}>
                                                    <div className={styles.versionHeader}>
                                                        <span className={styles.versionBadge}>v{v.version}</span>
                                                        {v.trigger && <span className={styles.versionTrigger}>{getTriggerLabel(v.trigger)}</span>}
                                                        <span className={styles.versionTime}>{formatDateTime(v.completedAt)}</span>
                                                    </div>
                                                    <p className={styles.versionSummary}>{v.summary}</p>
                                                    {v.issues && v.issues.length > 0 && (
                                                        <div className={styles.versionIssues}>
                                                            {v.issues.map((iss, j) => (
                                                                <span key={j} className={styles.issuePill}>{iss.title}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </>
                                    )}
                                    {lawHistory.length > 0 && (
                                        <>
                                            <p className={styles.sectionLabel} style={{ marginTop: '12px' }}>⚖️ 법령 분석 이력</p>
                                            {lawHistory.map((v, i) => (
                                                <div key={`law-${i}`} className={styles.versionCard}>
                                                    <div className={styles.versionHeader}>
                                                        <span className={styles.versionBadge}>v{v.version}</span>
                                                        {v.trigger && <span className={styles.versionTrigger}>{getTriggerLabel(v.trigger)}</span>}
                                                        <span className={styles.versionTime}>{formatDateTime(v.completedAt)}</span>
                                                    </div>
                                                    <p className={styles.versionSummary}>{v.summary || `${(v.nodes || []).length}개 노드 분석`}</p>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                    {issueHistory.length === 0 && lawHistory.length === 0 && (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--toss-text-tertiary)', textAlign: 'center' }}>분석 이력이 없습니다</p>
                                    )}
                                </div>
                            )}

                            {/* 인사이트 탭 */}
                            {activeTab === 'insights' && (
                                <div className={styles.historySection}>
                                    {insights.length === 0 ? (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--toss-text-tertiary)', textAlign: 'center' }}>아직 인사이트가 없습니다</p>
                                    ) : (
                                        insights.map((ins, i) => (
                                            <div key={i} className={styles.insightCard}>
                                                <p className={styles.insightType}>
                                                    {ins.type === 'ai_extracted' ? '🤖 AI 추출' : '📝 사용자 메모'} · {formatDateTime(ins.createdAt)}
                                                </p>
                                                <p className={styles.insightContent}>{ins.content}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
