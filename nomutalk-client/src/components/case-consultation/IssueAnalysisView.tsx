'use client';

import React from 'react';
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
}: Props) {
    return (
        <div className={styles.container}>
            {/* 핵심 쟁점 그래프 (쟁점만 표시) */}
            <div className={styles.graphSection}>
                <h3 className={styles.sectionTitle}>📊 핵심 쟁점 관계도</h3>
                <p className={styles.graphHint}>
                    중심에 가까울수록 중요도가 높은 쟁점입니다. 호버하면 연결선이 강조됩니다.
                </p>
                <IssueOnlyGraph
                    issues={issues}
                    caseLabel="사건"
                    initialHeight={480}
                />
            </div>

            {/* 핵심 쟁점 카드 리스트 */}
            <div className={styles.issueSection}>
                <h3 className={styles.sectionTitle}>🔥 핵심 법적 쟁점 ({issues.length}건)</h3>
                <div className={styles.issueGrid}>
                    {issues.map((issue) => {
                        const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.medium;
                        return (
                            <div
                                key={issue.id}
                                className={styles.issueCard}
                                style={{ borderLeftColor: sev.color }}
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
