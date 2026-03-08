'use client';

import React from 'react';
import styles from './CaseAnalysisDetailPanel.module.css';
import { GraphNode, GraphLink } from '@/lib/api';

interface DetailPanelProps {
    node: GraphNode | null;
    links: GraphLink[];
    allNodes: GraphNode[];
    onClose: () => void;
    onExpand?: (node: GraphNode) => void;
    isExpanding?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
    case: '사건',
    law: '법령',
    precedent: '판례',
    interpretation: '행정해석',
    decision: '노동위 결정',
    unknown: '문서',
};

const TYPE_ICONS: Record<string, string> = {
    case: '📋',
    law: '⚖️',
    precedent: '🏛️',
    interpretation: '📝',
    decision: '🔨',
    unknown: '📄',
};

export default function CaseAnalysisDetailPanel({ node, links, allNodes, onClose, onExpand, isExpanding }: DetailPanelProps) {
    if (!node) return null;

    const relatedLinks = links.filter(
        (l) => l.source === node.id || l.target === node.id
    );

    const relatedNodes = relatedLinks.map((link) => {
        const targetId = link.source === node.id ? link.target : link.source;
        const targetNode = allNodes.find((n) => n.id === targetId);
        return { link, targetNode };
    });

    return (
        <>
            <div className={styles.overlay} onClick={onClose} />
            <div className={styles.panel}>
                <div className={styles.panelHeader}>
                    <h3>
                        <span>{TYPE_ICONS[node.type] || '📄'}</span>
                        <span className={`${styles.typeBadge} ${styles[node.type]}`}>
                            {TYPE_LABELS[node.type] || '문서'}
                        </span>
                    </h3>
                    <button className={styles.closeBtn} onClick={onClose}>✕</button>
                </div>

                <div className={styles.panelBody}>
                    <div className={styles.nodeTitle}>{node.label}</div>

                    {/* 확장 버튼 */}
                    {onExpand && node.type !== 'case' && (
                        <button
                            className={styles.expandBtn}
                            onClick={() => onExpand(node)}
                            disabled={isExpanding}
                        >
                            {isExpanding ? (
                                <><span className={styles.miniSpinner} /> 관련 문서 검색 중...</>
                            ) : (
                                '🔍 관련 문서 더 찾기 (2-depth 확장)'
                            )}
                        </button>
                    )}

                    {node.detail && (
                        <div className={styles.detailSection}>
                            <h4>상세 내용</h4>
                            <div className={styles.detailContent}>{node.detail}</div>
                        </div>
                    )}

                    {relatedNodes.length > 0 && (
                        <div className={styles.detailSection}>
                            <h4>연결된 문서 ({relatedNodes.length})</h4>
                            <ul className={styles.relationList}>
                                {relatedNodes.map(({ link, targetNode }, i) => (
                                    <li key={i}>
                                        <span className={styles.relationLabel}>{link.label}</span>
                                        <span>{TYPE_ICONS[targetNode?.type || 'unknown']} {targetNode?.label || 'unknown'}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
