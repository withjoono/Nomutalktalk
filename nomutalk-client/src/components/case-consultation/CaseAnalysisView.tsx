'use client';

import React, { useState, useEffect } from 'react';
import styles from './CaseAnalysisView.module.css';
import GraphView from '../labor/GraphView';
import CaseAnalysisDetailPanel from '../case-search/CaseAnalysisDetailPanel';
import { GraphNode, GraphLink, expandGraphNode } from '@/lib/api';

interface Props {
    summary: string;
    similarCasesSummary: string;
    nodes: GraphNode[];
    links: GraphLink[];
    onProceedToChat: () => void;
    onNodesUpdate: (nodes: GraphNode[], links: GraphLink[]) => void;
}

export default function CaseAnalysisView({ summary, similarCasesSummary, nodes, links, onProceedToChat, onNodesUpdate }: Props) {
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
    const [graphWidth, setGraphWidth] = useState(800);

    useEffect(() => {
        const updateWidth = () => setGraphWidth(Math.min(window.innerWidth - 64, 900));
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

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
            onNodesUpdate([...nodes, ...newNodes], [...links, ...newLinks]);
            setSelectedNode({ ...node, detail: expanded.detail?.substring(0, 500) || node.detail });
        } catch (err) {
            console.error('노드 확장 실패:', err);
        } finally {
            setExpandingNodeId(null);
        }
    };

    return (
        <div className={styles.container}>
            {/* 그래프 */}
            <div className={styles.graphSection}>
                <h3>📊 법률 관계 그래프</h3>
                <p className={styles.graphHint}>노드 클릭: 상세 보기 · 더블클릭: 관련 문서 확장</p>
                <GraphView
                    nodes={nodes}
                    links={links}
                    width={graphWidth}
                    height={480}
                    onNodeClick={setSelectedNode}
                    onNodeDoubleClick={handleExpandNode}
                    expandingNodeId={expandingNodeId}
                />
            </div>

            {/* AI 분석 요약 */}
            <div className={styles.summaryCard}>
                <h3>🧠 AI 법률 분석</h3>
                <div className={styles.summaryContent}>{summary}</div>
            </div>

            {/* 유사 판례 */}
            {similarCasesSummary && (
                <div className={styles.summaryCard}>
                    <h3>🏛️ 유사 판례 분석</h3>
                    <div className={styles.summaryContent}>{similarCasesSummary}</div>
                </div>
            )}

            {/* 관련 문서 목록 */}
            <div className={styles.nodeListSection}>
                <h3>📑 관련 문서 ({nodes.filter(n => n.type !== 'case').length}건)</h3>
                <div className={styles.nodeGrid}>
                    {nodes.filter(n => n.type !== 'case').map((node) => (
                        <button
                            key={node.id}
                            className={`${styles.nodeCard} ${styles[node.type]}`}
                            onClick={() => setSelectedNode(node)}
                        >
                            <span className={styles.nodeType}>
                                {node.type === 'law' ? '⚖️' : node.type === 'precedent' ? '🏛️' : node.type === 'interpretation' ? '📝' : '📄'}
                            </span>
                            <span className={styles.nodeLabel}>{node.label}</span>
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
