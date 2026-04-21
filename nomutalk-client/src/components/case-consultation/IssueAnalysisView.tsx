'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './IssueAnalysisView.module.css';
import IssueOnlyGraph from '../graph/IssueOnlyGraph';
import { GraphNode, GraphLink, IssueInfo, verifyCitations, VerifiedCitation } from '@/lib/api';

interface Props {
    issues: IssueInfo[];
    summary: string;
    nodes: GraphNode[];
    links: GraphLink[];
    onProceedToChat: () => void;
    onNodesUpdate: (nodes: GraphNode[], links: GraphLink[]) => void;
    onAddIssue?: (issue: IssueInfo) => void;
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    high: { label: '높음', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
    medium: { label: '보통', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)' },
    low: { label: '낮음', color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)' },
};

/** 판례 인용의 검증 상태 */
type PrecVerifyStatus = 'pending' | 'verified' | 'corrected' | 'similar_found' | 'content_only' | 'error';

interface VerifiedPrec {
    caseNumber: string;
    summary: string;
    court?: string;
    date?: string;
    status: PrecVerifyStatus;
    correctedTitle?: string | null;
}

export default function IssueAnalysisView({
    issues,
    summary,
    nodes,
    links,
    onProceedToChat,
    onNodesUpdate,
    onAddIssue,
}: Props) {
    const [selectedIssueIdx, setSelectedIssueIdx] = useState<number | null>(null);
    const [addMode, setAddMode] = useState<'idle' | 'text' | 'file'>('idle');
    const [newIssueTitle, setNewIssueTitle] = useState('');
    const [newIssueSummary, setNewIssueSummary] = useState('');
    const [newSeverity, setNewSeverity] = useState<string>('medium');
    const detailRef = useRef<HTMLDivElement>(null);

    // 검증 상태 관리
    const [verifiedMap, setVerifiedMap] = useState<Record<string, VerifiedPrec>>({});
    const [verifying, setVerifying] = useState(false);
    const [verifyDone, setVerifyDone] = useState(false);
    const [reSearching, setReSearching] = useState<string | null>(null);

    // ================================================
    // 백그라운드 자동 검증: 페이지 로드 후 모든 precedent를 검증
    // ================================================
    const runAutoVerification = useCallback(async () => {
        const allPrecs: { key: string; title: string; type: string; detail: string }[] = [];
        issues.forEach((issue, idx) => {
            (issue.precedents || []).forEach((prec, pIdx) => {
                const key = `${idx}-${pIdx}`;
                if (!verifiedMap[key]) {
                    allPrecs.push({
                        key,
                        title: prec.caseNumber,
                        type: 'precedent',
                        detail: prec.summary || '',
                    });
                }
            });
        });

        // 법령 노드도 검증
        nodes.forEach((node) => {
            if (node.type === 'law' || node.type === 'precedent') {
                const key = `node-${node.id}`;
                if (!verifiedMap[key]) {
                    allPrecs.push({
                        key,
                        title: node.label,
                        type: node.type,
                        detail: node.detail || '',
                    });
                }
            }
        });

        if (allPrecs.length === 0) {
            setVerifyDone(true);
            return;
        }

        setVerifying(true);
        try {
            const { results } = await verifyCitations(
                allPrecs.map(p => ({ title: p.title, type: p.type, detail: p.detail }))
            );

            const newMap: Record<string, VerifiedPrec> = { ...verifiedMap };
            results.forEach((r: VerifiedCitation, i: number) => {
                const key = allPrecs[i].key;
                newMap[key] = {
                    caseNumber: r.correctedTitle || r.title || allPrecs[i].title,
                    summary: allPrecs[i].detail,
                    status: r.verifyStatus as PrecVerifyStatus,
                    correctedTitle: r.correctedTitle,
                };
            });
            setVerifiedMap(newMap);
        } catch (err) {
            console.error('검증 실패:', err);
        } finally {
            setVerifying(false);
            setVerifyDone(true);
        }
    }, [issues, nodes, verifiedMap]);

    useEffect(() => {
        if (!verifyDone && issues.length > 0) {
            const timer = setTimeout(() => runAutoVerification(), 1500);
            return () => clearTimeout(timer);
        }
    }, [issues, verifyDone]);

    // 개별 재검색 (딥 검증 재시도)
    const handleReSearch = async (issueIdx: number, precIdx: number, prec: any) => {
        const key = `${issueIdx}-${precIdx}`;
        setReSearching(key);
        try {
            const { results } = await verifyCitations([
                { title: prec.caseNumber, type: 'precedent', detail: prec.summary }
            ]);
            if (results.length > 0) {
                const r = results[0];
                setVerifiedMap(prev => ({
                    ...prev,
                    [key]: {
                        caseNumber: r.correctedTitle || r.title || prec.caseNumber,
                        summary: prec.summary,
                        status: r.verifyStatus as PrecVerifyStatus,
                        correctedTitle: r.correctedTitle,
                    }
                }));
            }
        } catch {
            // 실패해도 조용히 처리
        } finally {
            setReSearching(null);
        }
    };

    const handleNodeClick = (issueIndex: number) => {
        setSelectedIssueIdx(issueIndex);
        setTimeout(() => {
            detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    };

    const handleAddIssue = () => {
        if (!newIssueTitle.trim()) return;
        const newIssue: IssueInfo = {
            id: `user-${Date.now()}`,
            title: newIssueTitle.trim(),
            summary: newIssueSummary.trim() || newIssueTitle.trim(),
            severity: newSeverity as any,
        };
        onAddIssue?.(newIssue);
        setNewIssueTitle('');
        setNewIssueSummary('');
        setNewSeverity('medium');
        setAddMode('idle');
    };

    // ================================================
    // 인용 표시 헬퍼 함수
    // ================================================
    const getDisplayTitle = (prec: any, key: string): string => {
        const v = verifiedMap[key];
        if (!v) return prec.caseNumber; // 아직 검증 전

        if (v.status === 'verified' || v.status === 'corrected' || v.status === 'similar_found') {
            return v.correctedTitle || v.caseNumber || prec.caseNumber;
        }

        // content_only: 번호 제거, 내용만 표시
        const stripped = prec.caseNumber
            .replace(/\d{4}[가-힣]+\d+/g, '') // 판례번호 제거
            .replace(/대법원|고등법원|지방법원/g, '')
            .replace(/^\s*판결\s*/g, '')
            .trim();
        return stripped || '관련 판례';
    };

    const getBadge = (key: string): { icon: string; color: string; bg: string; tooltip: string } | null => {
        const v = verifiedMap[key];
        if (!v) return null; // 검증 전

        switch (v.status) {
            case 'verified':
                return { icon: '✅', color: '#10b981', bg: 'rgba(16,185,129,0.1)', tooltip: '국가법령정보센터 확인 완료' };
            case 'corrected':
                return { icon: '✅', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', tooltip: '번호가 자동 교정되었습니다' };
            case 'similar_found':
                return { icon: '✅', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', tooltip: '유사 판례로 대체되었습니다' };
            case 'content_only':
                return { icon: '📌', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', tooltip: '정확성을 위해 인용 번호가 생략되었습니다' };
            default:
                return null;
        }
    };

    const selectedIssue = selectedIssueIdx !== null ? issues[selectedIssueIdx] : null;

    // content_only 항목이 있는지 확인
    const hasUnverifiedItems = Object.values(verifiedMap).some(v => v.status === 'content_only');

    return (
        <div className={styles.container}>
            {/* 핵심 쟁점 그래프 */}
            <div className={styles.graphSection}>
                <h3 className={styles.sectionTitle}>📊 핵심 쟁점 관계도</h3>
                <p className={styles.graphHint}>
                    쟁점 동그라미를 클릭하면 상세 내용이 표시됩니다.
                </p>
                <IssueOnlyGraph
                    issues={issues}
                    caseLabel="사건"
                    initialHeight={480}
                    onNodeClick={handleNodeClick}
                />
            </div>

            {/* 클릭한 쟁점 상세 패널 */}
            {selectedIssue && (
                <div ref={detailRef} className={styles.detailPanel}>
                    <div className={styles.detailHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            <span style={{
                                fontSize: '1.2rem',
                                fontWeight: 700,
                                color: SEVERITY_CONFIG[selectedIssue.severity]?.color || '#f97316'
                            }}>
                                ⚡
                            </span>
                            <span className={styles.detailTitle}>{selectedIssue.title}</span>
                            <span
                                className={styles.severityBadge}
                                style={{
                                    color: SEVERITY_CONFIG[selectedIssue.severity]?.color,
                                    backgroundColor: SEVERITY_CONFIG[selectedIssue.severity]?.bg
                                }}
                            >
                                {SEVERITY_CONFIG[selectedIssue.severity]?.label || '보통'}
                            </span>
                        </div>
                        <button
                            className={styles.closeBtn}
                            onClick={() => setSelectedIssueIdx(null)}
                        >✕</button>
                    </div>
                    <p className={styles.detailSummary}>{selectedIssue.summary}</p>

                    {/* 판례 인용 (검증 배지 포함) */}
                    {selectedIssue.precedents && selectedIssue.precedents.length > 0 && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--toss-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <h4 style={{ fontSize: '0.9rem', color: 'var(--toss-text-primary)', fontWeight: 600, margin: 0 }}>📚 관련 주요 판례</h4>
                                {verifying && (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--toss-text-tertiary)' }}>
                                        출처 확인 중...
                                    </span>
                                )}
                            </div>
                            {selectedIssue.precedents.map((prec, i) => {
                                const key = `${selectedIssueIdx}-${i}`;
                                const badge = getBadge(key);
                                const displayTitle = getDisplayTitle(prec, key);
                                const isContentOnly = verifiedMap[key]?.status === 'content_only';
                                const isSearching = reSearching === key;

                                return (
                                    <div key={i} style={{
                                        padding: '10px 12px',
                                        backgroundColor: badge?.bg || 'var(--toss-bg-secondary)',
                                        borderRadius: '8px',
                                        marginBottom: '8px',
                                        fontSize: '0.85rem',
                                        border: badge ? `1px solid ${badge.color}20` : 'none',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{
                                                    fontWeight: 700,
                                                    color: isContentOnly ? 'var(--toss-text-primary)' : 'var(--toss-blue)',
                                                    marginBottom: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    flexWrap: 'wrap',
                                                }}>
                                                    {badge && <span title={badge.tooltip}>{badge.icon}</span>}
                                                    {displayTitle}
                                                </div>
                                                <div style={{ color: 'var(--toss-text-secondary)', lineHeight: 1.5 }}>
                                                    {prec.summary}
                                                </div>
                                            </div>
                                            {isContentOnly && !isSearching && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleReSearch(selectedIssueIdx!, i, prec); }}
                                                    style={{
                                                        padding: '4px 10px', borderRadius: '6px', border: '1px solid #d1d5db',
                                                        background: 'white', cursor: 'pointer', fontSize: '0.75rem',
                                                        fontWeight: 600, color: '#3b82f6', whiteSpace: 'nowrap',
                                                        fontFamily: 'inherit',
                                                    }}
                                                    title="국가법령정보센터에서 번호를 재검색합니다"
                                                >
                                                    🔍 출처 확인
                                                </button>
                                            )}
                                            {isSearching && (
                                                <span style={{ fontSize: '0.75rem', color: '#3b82f6', whiteSpace: 'nowrap' }}>
                                                    검색 중...
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* 인용 번호 생략 안내 (content_only 항목이 있을 때만) */}
                            {verifyDone && selectedIssue.precedents.some((_, i) => verifiedMap[`${selectedIssueIdx}-${i}`]?.status === 'content_only') && (
                                <p style={{
                                    margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--toss-text-tertiary)',
                                    lineHeight: 1.5, paddingLeft: '4px',
                                }}>
                                    📌 정확성을 위해 일부 인용 번호가 생략되었습니다. <strong style={{ color: '#3b82f6' }}>출처 확인</strong> 버튼으로 정확한 번호를 조회할 수 있습니다.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 핵심 쟁점 카드 리스트 */}
            <div className={styles.issueSection}>
                <h3 className={styles.sectionTitle}>🔥 핵심 법적 쟁점 ({issues.length}건)</h3>
                <div className={styles.issueGrid}>
                    {issues.map((issue, idx) => {
                        const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.medium;
                        const isSelected = selectedIssueIdx === idx;
                        return (
                            <div
                                key={issue.id}
                                className={`${styles.issueCard} ${isSelected ? styles.issueCardSelected : ''}`}
                                style={{ borderLeftColor: sev.color }}
                                onClick={() => handleNodeClick(idx)}
                            >
                                <div className={styles.issueHeader}>
                                    <span className={styles.issueTitle}>{issue.title}</span>
                                    <span
                                        className={styles.severityBadge}
                                        style={{ color: sev.color, backgroundColor: sev.bg }}
                                    >
                                        {sev.label}
                                    </span>
                                </div>
                                <p className={styles.issueSummary}>{issue.summary}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 쟁점 추가 섹션 */}
            <div className={styles.addIssueSection}>
                <h3 className={styles.sectionTitle}>➕ 쟁점 추가</h3>
                <p className={styles.addHint}>빠진 쟁점이 있다면 직접 추가하세요.</p>

                {addMode === 'idle' && (
                    <div className={styles.addBtnGroup}>
                        <button className={styles.addBtn} onClick={() => setAddMode('text')}>
                            ✏️ 텍스트로 입력
                        </button>
                        <button className={styles.addBtn} onClick={() => setAddMode('file')}>
                            📎 자료 업로드
                        </button>
                    </div>
                )}

                {addMode === 'text' && (
                    <div className={styles.addForm}>
                        <input
                            type="text"
                            className={styles.addInput}
                            placeholder="쟁점 제목 (예: 퇴직금 미지급)"
                            value={newIssueTitle}
                            onChange={(e) => setNewIssueTitle(e.target.value)}
                        />
                        <textarea
                            className={styles.addTextarea}
                            placeholder="쟁점 내용을 상세히 입력하세요..."
                            value={newIssueSummary}
                            onChange={(e) => setNewIssueSummary(e.target.value)}
                            rows={3}
                        />
                        <div className={styles.addFormRow}>
                            <label className={styles.addLabel}>중요도:</label>
                            <select
                                className={styles.addSelect}
                                value={newSeverity}
                                onChange={(e) => setNewSeverity(e.target.value)}
                            >
                                <option value="high">높음</option>
                                <option value="medium">보통</option>
                                <option value="low">낮음</option>
                            </select>
                            <div style={{ flex: 1 }} />
                            <button className={styles.addSubmitBtn} onClick={handleAddIssue} disabled={!newIssueTitle.trim()}>
                                추가
                            </button>
                            <button className={styles.addCancelBtn} onClick={() => setAddMode('idle')}>
                                취소
                            </button>
                        </div>
                    </div>
                )}

                {addMode === 'file' && (
                    <div className={styles.addForm}>
                        <div className={styles.fileDropzone}>
                            <input
                                type="file"
                                accept=".pdf,.doc,.docx,.txt,.hwp,.jpg,.png"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setNewIssueTitle(file.name.replace(/\.[^/.]+$/, ''));
                                        setNewIssueSummary(`[업로드된 파일: ${file.name}]`);
                                    }
                                }}
                                style={{ display: 'none' }}
                                id="issue-file-upload"
                            />
                            <label htmlFor="issue-file-upload" className={styles.fileLabel}>
                                📄 근로계약서, 급여명세서, 통보서 등을 업로드하세요
                                <br />
                                <span style={{ fontSize: '0.75rem', color: 'var(--toss-text-tertiary)' }}>
                                    PDF, DOC, HWP, TXT, 이미지 지원
                                </span>
                            </label>
                        </div>
                        {newIssueTitle && (
                            <div style={{ marginTop: '12px' }}>
                                <input
                                    type="text"
                                    className={styles.addInput}
                                    placeholder="쟁점 제목"
                                    value={newIssueTitle}
                                    onChange={(e) => setNewIssueTitle(e.target.value)}
                                />
                                <div className={styles.addFormRow} style={{ marginTop: '8px' }}>
                                    <select
                                        className={styles.addSelect}
                                        value={newSeverity}
                                        onChange={(e) => setNewSeverity(e.target.value)}
                                    >
                                        <option value="high">높음</option>
                                        <option value="medium">보통</option>
                                        <option value="low">낮음</option>
                                    </select>
                                    <div style={{ flex: 1 }} />
                                    <button className={styles.addSubmitBtn} onClick={handleAddIssue}>추가</button>
                                </div>
                            </div>
                        )}
                        <button
                            className={styles.addCancelBtn}
                            onClick={() => { setAddMode('idle'); setNewIssueTitle(''); setNewIssueSummary(''); }}
                            style={{ marginTop: '8px' }}
                        >
                            취소
                        </button>
                    </div>
                )}
            </div>

            {/* AI 분석 요약 */}
            {summary && (
                <div className={styles.summaryCard}>
                    <h3>🧠 AI 분석 요약</h3>
                    <div className={styles.summaryContent}>{summary}</div>
                </div>
            )}
        </div>
    );
}
