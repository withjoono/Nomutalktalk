'use client';

import React, { useState } from 'react';
import { GraphNode, IssueInfo } from '@/lib/api';
import styles from './IssueGroupedLaws.module.css';

interface LawByIssue {
    issue: IssueInfo;
    laws: GraphNode[];
}

interface IssueGroupedLawsProps {
    issues: IssueInfo[];
    nodes: GraphNode[];
}

function getTypeIcon(type: string) {
    switch (type) {
        case 'law': return '📜';
        case 'precedent': return '⚖️';
        case 'interpretation': return '📋';
        default: return '📄';
    }
}

function getTypeLabel(type: string) {
    switch (type) {
        case 'law': return '법령';
        case 'precedent': return '판례';
        case 'interpretation': return '행정해석';
        default: return '기타';
    }
}

export default function IssueGroupedLaws({ issues, nodes }: IssueGroupedLawsProps) {
    const [openIssues, setOpenIssues] = useState<Set<string>>(() => new Set(issues.map(i => i.id)));

    // 쟁점별 관련 법령 그룹 생성
    const lawsByIssue: LawByIssue[] = issues.map(issue => {
        const laws = nodes.filter(
            n => n.type !== 'case' && n.type !== 'issue' && (n as any).parentIssue === issue.id
        );
        return { issue, laws };
    });

    // 쟁점에 연결되지 않은 법령 (공통)
    const issueLawIds = new Set(lawsByIssue.flatMap(g => g.laws.map(l => l.id)));
    const unlinkedLaws = nodes.filter(
        n => n.type !== 'case' && n.type !== 'issue' && !issueLawIds.has(n.id)
    );

    const toggleIssue = (id: string) => {
        setOpenIssues(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className={styles.issueGroupedLaws}>
            {lawsByIssue.map(({ issue, laws }) => {
                const isOpen = openIssues.has(issue.id);
                return (
                    <div key={issue.id} className={styles.issueAccordion}>
                        <button className={styles.issueHeader} onClick={() => toggleIssue(issue.id)}>
                            <span className={styles.severityDot} data-severity={issue.severity} />
                            <span className={styles.issueTitle}>{issue.title}</span>
                            <span className={styles.lawCount}>{laws.length}건</span>
                            <span className={styles.arrow} data-open={String(isOpen)}>▼</span>
                        </button>
                        {isOpen && (
                            <div className={styles.lawList}>
                                <p className={styles.issueSummary}>{issue.summary}</p>
                                {laws.length === 0 ? (
                                    <div className={styles.noLaws}>관련 법령이 검색되지 않았습니다</div>
                                ) : (
                                    laws.map(law => (
                                        <div key={law.id} className={styles.lawCard}>
                                            <span className={styles.lawIcon}>{getTypeIcon(law.type)}</span>
                                            <div className={styles.lawInfo}>
                                                <span className={styles.lawType} data-type={law.type}>{getTypeLabel(law.type)}</span>
                                                <h4 className={styles.lawTitle}>{law.label}</h4>
                                                {law.detail && (
                                                    <p className={styles.lawDetail}>{law.detail}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* 공통 법령 (쟁점에 연결되지 않은 것) */}
            {unlinkedLaws.length > 0 && (
                <div className={styles.issueAccordion}>
                    <button className={styles.issueHeader} onClick={() => toggleIssue('__common__')}>
                        <span className={styles.severityDot} style={{ background: '#6b7280' }} />
                        <span className={styles.issueTitle}>공통 관련 법령</span>
                        <span className={styles.lawCount}>{unlinkedLaws.length}건</span>
                        <span className={styles.arrow} data-open={String(openIssues.has('__common__'))}>▼</span>
                    </button>
                    {openIssues.has('__common__') && (
                        <div className={styles.lawList}>
                            <p className={styles.issueSummary}>여러 쟁점에 공통으로 적용되는 법령/판례</p>
                            {unlinkedLaws.map(law => (
                                <div key={law.id} className={styles.lawCard}>
                                    <span className={styles.lawIcon}>{getTypeIcon(law.type)}</span>
                                    <div className={styles.lawInfo}>
                                        <span className={styles.lawType} data-type={law.type}>{getTypeLabel(law.type)}</span>
                                        <h4 className={styles.lawTitle}>{law.label}</h4>
                                        {law.detail && <p className={styles.lawDetail}>{law.detail}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
