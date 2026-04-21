'use client';

import React, { useState, useRef } from 'react';
import styles from './IssueAnalysisView.module.css';
import IssueOnlyGraph from '../graph/IssueOnlyGraph';
import { GraphNode, GraphLink, IssueInfo } from '@/lib/api';

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

    const handleNodeClick = (issueIndex: number) => {
        setSelectedIssueIdx(issueIndex);
        // 스크롤
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

    const selectedIssue = selectedIssueIdx !== null ? issues[selectedIssueIdx] : null;

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
                    {/* 판례 인용 (Feature 1) */}
                    {selectedIssue.precedents && selectedIssue.precedents.length > 0 && (
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--toss-border)' }}>
                            <h4 style={{ fontSize: '0.9rem', color: 'var(--toss-text-primary)', marginBottom: '8px', fontWeight: 600 }}>📚 관련 주요 판례</h4>
                            {selectedIssue.precedents.map((prec, i) => (
                                <div key={i} style={{
                                    padding: '10px 12px',
                                    backgroundColor: 'var(--toss-bg-secondary)',
                                    borderRadius: '8px',
                                    marginBottom: '8px',
                                    fontSize: '0.85rem'
                                }}>
                                    <div style={{ fontWeight: 700, color: 'var(--toss-blue)', marginBottom: '4px' }}>
                                        {prec.caseNumber}
                                    </div>
                                    <div style={{ color: 'var(--toss-text-secondary)', lineHeight: 1.5 }}>
                                        {prec.summary}
                                    </div>
                                </div>
                            ))}
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
