'use client';

import React, { useState, useEffect } from 'react';
import { CaseDetail, CaseUpdate, getCase, addCaseUpdate } from '@/lib/api';
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
        case 'evidence_added': return '증거 추가';
        case 'description_updated': return '상황 변경';
        case 'manual': return '수동';
        default: return trigger || '';
    }
}

export default function CaseDetailPanel({ caseId, onClose, onContinue }: CaseDetailPanelProps) {
    const [detail, setDetail] = useState<CaseDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'updates' | 'timeline' | 'versions' | 'insights'>('updates');

    // 업데이트 입력 상태
    const [updateType, setUpdateType] = useState<'supplement' | 'progress' | null>(null);
    const [updateContent, setUpdateContent] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setLoading(true);
        setError(null);
        getCase(caseId)
            .then(d => { setDetail(d); setLoading(false); })
            .catch(err => { setError(err.message); setLoading(false); });
    }, [caseId]);

    const handleSubmitUpdate = async () => {
        if (!updateType || !updateContent.trim() || submitting) return;
        setSubmitting(true);
        try {
            await addCaseUpdate(caseId, updateType, updateContent.trim());
            // 데이터 새로 로드
            const refreshed = await getCase(caseId);
            setDetail(refreshed);
            setUpdateType(null);
            setUpdateContent('');
        } catch (err: any) {
            alert('업데이트 추가 실패: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const issueHistory = detail?.steps?.issueAnalysisHistory || [];
    const lawHistory = detail?.steps?.lawAnalysisHistory || [];
    const timeline = detail?.timeline || [];
    const insights = detail?.insights || [];
    const updates = detail?.updates || [];
    const supplements = updates.filter(u => u.type === 'supplement');
    const progresses = updates.filter(u => u.type === 'progress');

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
                                {supplements.length > 0 && <span className={styles.metaBadge}>📝 보충 {supplements.length}건</span>}
                                {progresses.length > 0 && <span className={styles.metaBadge}>📅 경과 {progresses.length}건</span>}
                                <span className={styles.metaBadge}>{formatDateTime(detail.createdAt)}</span>
                            </div>

                            {/* 액션 버튼 */}
                            <div className={styles.actionRow}>
                                <button className={`${styles.actionBtn} ${styles.primaryBtn}`} onClick={() => onContinue(caseId)}>
                                    🔍 이어서 분석
                                </button>
                                <button
                                    className={`${styles.actionBtn} ${styles.secondaryBtn}`}
                                    onClick={() => setUpdateType(updateType === 'supplement' ? null : 'supplement')}
                                    style={updateType === 'supplement' ? { borderColor: '#3b82f6', color: '#3b82f6' } : {}}
                                >
                                    📝 보충
                                </button>
                                <button
                                    className={`${styles.actionBtn} ${styles.secondaryBtn}`}
                                    onClick={() => setUpdateType(updateType === 'progress' ? null : 'progress')}
                                    style={updateType === 'progress' ? { borderColor: '#10b981', color: '#10b981' } : {}}
                                >
                                    📅 경과
                                </button>
                            </div>

                            {/* 업데이트 입력 폼 */}
                            {updateType && (
                                <div style={{
                                    padding: '14px', borderRadius: '14px',
                                    border: `1px solid ${updateType === 'supplement' ? 'rgba(59,130,246,0.3)' : 'rgba(16,185,129,0.3)'}`,
                                    background: updateType === 'supplement' ? 'rgba(59,130,246,0.04)' : 'rgba(16,185,129,0.04)',
                                }}>
                                    <p style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 600, color: updateType === 'supplement' ? '#3b82f6' : '#10b981' }}>
                                        {updateType === 'supplement' ? '📝 빠뜨린 내용을 추가해주세요' : '📅 새로운 진행상황을 기록해주세요'}
                                    </p>
                                    <textarea
                                        value={updateContent}
                                        onChange={(e) => setUpdateContent(e.target.value)}
                                        placeholder={updateType === 'supplement'
                                            ? '예: 초과근무 시 별도 수당 지급 약정이 있었음, 계약서에는 수습 3개월 조항이 있었음...'
                                            : '예: 오늘 노동위원회에 진정서를 접수함, 회사 측에서 합의를 제안해옴...'}
                                        style={{
                                            width: '100%', minHeight: '80px', padding: '10px',
                                            borderRadius: '10px', border: '1px solid var(--toss-border)',
                                            background: 'var(--toss-bg-primary)', resize: 'vertical',
                                            fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--toss-text-primary)',
                                        }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => { setUpdateType(null); setUpdateContent(''); }}
                                            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--toss-border)', background: 'transparent', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--toss-text-secondary)' }}
                                        >
                                            취소
                                        </button>
                                        <button
                                            onClick={handleSubmitUpdate}
                                            disabled={!updateContent.trim() || submitting}
                                            style={{
                                                padding: '6px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                                fontSize: '0.82rem', fontWeight: 600, color: '#fff',
                                                background: updateType === 'supplement' ? '#3b82f6' : '#10b981',
                                                opacity: !updateContent.trim() || submitting ? 0.5 : 1,
                                            }}
                                        >
                                            {submitting ? '저장 중...' : '✅ 추가'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 탭 */}
                            <div style={{ display: 'flex', gap: '4px', background: 'var(--toss-bg-secondary)', borderRadius: '10px', padding: '3px' }}>
                                {[
                                    { key: 'updates' as const, label: `보충/경과 (${updates.length})` },
                                    { key: 'timeline' as const, label: `타임라인 (${timeline.length})` },
                                    { key: 'versions' as const, label: `분석이력 (${issueHistory.length + lawHistory.length})` },
                                    { key: 'insights' as const, label: `인사이트 (${insights.length})` },
                                ].map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        style={{
                                            flex: 1, padding: '8px 4px', borderRadius: '8px', border: 'none',
                                            fontSize: '0.72rem', fontWeight: activeTab === tab.key ? 600 : 400,
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

                            {/* 보충/경과 탭 */}
                            {activeTab === 'updates' && (
                                <div className={styles.historySection}>
                                    {updates.length === 0 ? (
                                        <p style={{ fontSize: '0.85rem', color: 'var(--toss-text-tertiary)', textAlign: 'center', padding: '16px 0' }}>
                                            아직 추가된 보충 사항이나 진행 경과가 없습니다.<br />
                                            위의 📝 보충 / 📅 경과 버튼으로 추가하세요.
                                        </p>
                                    ) : (
                                        <>
                                            {supplements.length > 0 && (
                                                <>
                                                    <p className={styles.sectionLabel}>📝 보충 사항</p>
                                                    {supplements.map(u => (
                                                        <div key={u.id} className={styles.insightCard} style={{ borderLeftColor: '#3b82f6' }}>
                                                            <p className={styles.insightType} style={{ color: '#3b82f6' }}>
                                                                원래 사건 내용에 추가 · {formatDateTime(u.createdAt)}
                                                            </p>
                                                            <p className={styles.insightContent}>{u.content}</p>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                            {progresses.length > 0 && (
                                                <>
                                                    <p className={styles.sectionLabel} style={{ marginTop: supplements.length > 0 ? '12px' : 0 }}>📅 진행 경과</p>
                                                    {progresses.map(u => (
                                                        <div key={u.id} className={styles.insightCard} style={{ borderLeftColor: '#10b981' }}>
                                                            <p className={styles.insightType} style={{ color: '#10b981' }}>
                                                                진행 상황 · {formatDateTime(u.createdAt)}
                                                            </p>
                                                            <p className={styles.insightContent}>{u.content}</p>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

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
