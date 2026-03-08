'use client';

import React, { useState, useEffect } from 'react';
import styles from './IssueAnalysisView.module.css';
import IssueGraphView from '../labor/IssueGraphView';
import CaseAnalysisDetailPanel from '../case-search/CaseAnalysisDetailPanel';
import { GraphNode, GraphLink, IssueInfo, expandGraphNode } from '@/lib/api';

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
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);

    const handleExpandNode = async (node: GraphNode) => {
        if (expandingNodeId || node.type === 'case') return;
        setExpandingNodeId(node.id);
        try {
            const expanded = await expandGraphNode(node.id, node.label, node.type);
            const existingIds = new Set(nodes.map(n => n.id));
            const newNodes = expanded.newNodes.filter(n => !existingIds.has(n.id));
            const newLinks = expanded.newLinks.filter(l => {
                const tid = typeof l.target === 'string' ? l.target : '';
                return existingIds.has(tid) || newNodes.some(n => n.id === tid);
            });

            // 확장된 노드에 parentIssue 추가 (원본 노드의 parentIssue 상속)
            const parentIssue = node.parentIssue;
            const enhancedNewNodes = newNodes.map(n => ({
                ...n,
                parentIssue: parentIssue || node.id,
            }));

            onNodesUpdate([...nodes, ...enhancedNewNodes], [...links, ...newLinks]);
            setSelectedNode({ ...node, detail: expanded.detail?.substring(0, 500) || node.detail });
        } catch (err) {
            console.error('노드 확장 실패:', err);
        } finally {
            setExpandingNodeId(null);
        }
    };

    return (
        <div className={styles.container}>
            {/* 핵심 쟁점 카드 */}
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
                                onClick={() => {
                                    const issueNode = nodes.find(n => n.id === issue.id);
                                    if (issueNode) setSelectedNode(issueNode);
                                }}
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
                                <div className={styles.issueStats}>
                                    {(() => {
                                        const related = nodes.filter(n => n.parentIssue === issue.id);
                                        const lawCount = related.filter(n => n.type === 'law').length;
                                        const precCount = related.filter(n => n.type === 'precedent').length;
                                        const interpCount = related.filter(n => n.type === 'interpretation' || n.type === 'decision').length;
                                        return (
                                            <>
                                                {lawCount > 0 && <span className={styles.statItem}>⚖️ 법령 {lawCount}</span>}
                                                {precCount > 0 && <span className={styles.statItem}>🏛️ 판례 {precCount}</span>}
                                                {interpCount > 0 && <span className={styles.statItem}>📝 해석 {interpCount}</span>}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 그래프 */}
            <div className={styles.graphSection}>
                <h3 className={styles.sectionTitle}>📊 쟁점-법령 관계 그래프</h3>
                <p className={styles.graphHint}>
                    필터로 보기 모드 전환 · 노드 클릭: 상세 · 더블클릭: 관련 문서 확장 · 모서리 드래그: 크기 조절
                </p>
                <IssueGraphView
                    nodes={nodes}
                    links={links}
                    onNodeClick={setSelectedNode}
                    onNodeDoubleClick={handleExpandNode}
                    expandingNodeId={expandingNodeId}
                    initialHeight={550}
                    minHeight={400}
                />
            </div>

            {/* AI 분석 요약 */}
            {summary && (
                <div className={styles.summaryCard}>
                    <h3>🧠 AI 분석 요약</h3>
                    <div className={styles.summaryContent}>{summary}</div>
                </div>
            )}

            {/* 관련 문서 목록 */}
            <div className={styles.nodeListSection}>
                <h3 className={styles.sectionTitle}>
                    📑 관련 문서 ({nodes.filter(n => n.type !== 'case' && n.type !== 'issue').length}건)
                </h3>
                <div className={styles.nodeGrid}>
                    {nodes.filter(n => n.type !== 'case' && n.type !== 'issue').map((node) => (
                        <button
                            key={node.id}
                            className={`${styles.nodeCard} ${styles[node.type] || ''}`}
                            onClick={() => setSelectedNode(node)}
                        >
                            <span className={styles.nodeType}>
                                {node.type === 'law' ? '⚖️' : node.type === 'precedent' ? '🏛️' : node.type === 'interpretation' ? '📝' : node.type === 'decision' ? '🔨' : '📄'}
                            </span>
                            <span className={styles.nodeLabel}>{node.label}</span>
                            {node.parentIssue && (
                                <span className={styles.nodeIssueTag}>
                                    🔥 {issues.find(i => i.id === node.parentIssue)?.title || ''}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* 상담 진행 버튼 */}
            <button className={styles.nextStepBtn} onClick={onProceedToChat}>
                💬 AI 상담 시작하기
            </button>

            {/* 상세 패널 */}
            {selectedNode && (
                <CaseAnalysisDetailPanel
                    node={selectedNode}
                    links={links}
                    allNodes={nodes}
                    onClose={() => setSelectedNode(null)}
                    onExpand={handleExpandNode}
                    isExpanding={expandingNodeId === selectedNode.id}
                />
            )}
        </div>
    );
}
