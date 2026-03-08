'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { GraphNode, GraphLink } from '@/lib/api';

// 서버 사이드 렌더링 제외
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
    loading: () => <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>그래프 로딩 중...</div>
});

interface GraphViewProps {
    nodes: GraphNode[];
    links: GraphLink[];
    width?: number;
    height?: number;
    onNodeClick?: (node: GraphNode) => void;
    onNodeDoubleClick?: (node: GraphNode) => void;
    expandingNodeId?: string | null;
}

const NODE_COLORS: Record<string, string> = {
    case: '#a855f7',
    law: '#3b82f6',
    precedent: '#ef4444',
    interpretation: '#10b981',
    decision: '#f59e0b',
    unknown: '#94a3b8',
};

const NODE_ICONS: Record<string, string> = {
    case: '📋',
    law: '⚖️',
    precedent: '🏛️',
    interpretation: '📝',
    decision: '🔨',
    unknown: '📄',
};

export default function GraphView({ nodes, links, width = 800, height = 500, onNodeClick, onNodeDoubleClick, expandingNodeId }: GraphViewProps) {
    const graphRef = useRef<any>(null);
    const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
    const lastClickTime = useRef<number>(0);
    const lastClickNode = useRef<string>('');

    useEffect(() => {
        if (!nodes || nodes.length === 0) {
            setGraphData({ nodes: [], links: [] });
            return;
        }

        const gNodes = nodes.map(n => ({
            ...n,
            color: NODE_COLORS[n.type] || '#94a3b8',
        }));

        const gLinks = links.map(l => ({
            ...l,
            color: 'rgba(148, 163, 184, 0.4)',
        }));

        setGraphData({ nodes: gNodes, links: gLinks });
    }, [nodes, links]);

    // 초기 줌 조절
    useEffect(() => {
        if (graphRef.current && graphData.nodes.length > 0) {
            setTimeout(() => {
                graphRef.current?.zoomToFit(400, 60);
            }, 500);
        }
    }, [graphData]);

    if (graphData.nodes.length === 0) {
        return null;
    }

    return (
        <div style={{
            border: '1px solid var(--toss-border, #e2e8f0)',
            borderRadius: '16px',
            overflow: 'hidden',
            background: '#0f172a',
            margin: '1rem 0',
            position: 'relative',
        }}>
            {/* 범례 */}
            <div style={{
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                gap: '14px',
                fontSize: '0.75rem',
                color: '#94a3b8',
                alignItems: 'center',
                flexWrap: 'wrap',
                background: 'rgba(15, 23, 42, 0.9)',
            }}>
                <span style={{ fontWeight: 700, color: '#e2e8f0' }}>📊 법률 관계도</span>
                {Object.entries(NODE_COLORS).filter(([k]) => k !== 'unknown').map(([type, color]) => (
                    <span key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                        {NODE_ICONS[type]} {type === 'case' ? '사건' : type === 'law' ? '법령' : type === 'precedent' ? '판례' : type === 'interpretation' ? '행정해석' : '노동위 결정'}
                    </span>
                ))}
            </div>
            {/* @ts-ignore */}
            <ForceGraph2D
                ref={graphRef}
                width={width}
                height={height}
                graphData={graphData}
                nodeLabel=""
                nodeRelSize={6}
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={0.004}
                linkDirectionalParticleWidth={2}
                linkColor={() => 'rgba(148, 163, 184, 0.3)'}
                linkWidth={1.5}
                backgroundColor="#0f172a"
                d3AlphaDecay={0.03}
                d3VelocityDecay={0.3}
                cooldownTicks={100}
                onNodeClick={(node: any) => {
                    const now = Date.now();
                    if (lastClickNode.current === node.id && now - lastClickTime.current < 400) {
                        // 더블 클릭
                        if (onNodeDoubleClick) onNodeDoubleClick(node as GraphNode);
                        lastClickTime.current = 0;
                        lastClickNode.current = '';
                    } else {
                        // 싱글 클릭
                        if (onNodeClick) onNodeClick(node as GraphNode);
                        lastClickTime.current = now;
                        lastClickNode.current = node.id;
                    }
                }}
                nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                    const isCenter = node.type === 'case';
                    const radius = isCenter ? 18 : 12;
                    const fontSize = isCenter ? 13 / globalScale : 11 / globalScale;
                    const label = node.label?.length > 20
                        ? node.label.substring(0, 20) + '...'
                        : node.label;

                    // 확장 중 애니메이션
                    const isExpanding = expandingNodeId === node.id;
                    if (isExpanding) {
                        const pulse = Math.sin(Date.now() / 200) * 4 + 8;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius + pulse, 0, 2 * Math.PI);
                        ctx.strokeStyle = `${node.color}88`;
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }

                    // 글로우 효과
                    if (isCenter) {
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius + 6, 0, 2 * Math.PI);
                        ctx.fillStyle = `${node.color}22`;
                        ctx.fill();
                    }

                    // 원
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                    ctx.fillStyle = node.color || '#ccc';
                    ctx.fill();

                    // 테두리
                    ctx.strokeStyle = isCenter ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)';
                    ctx.lineWidth = isCenter ? 2.5 : 1;
                    ctx.stroke();

                    // 아이콘 (중앙)
                    const icon = NODE_ICONS[node.type] || '📄';
                    ctx.font = `${(isCenter ? 14 : 10) / globalScale}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(icon, node.x, node.y - 1 / globalScale);

                    // 라벨 (아래)
                    ctx.font = `${fontSize}px 'Noto Sans KR', sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';

                    // 라벨 배경
                    const textMetrics = ctx.measureText(label);
                    const textWidth = textMetrics.width;
                    const textHeight = fontSize * 1.3;
                    const padding = 3 / globalScale;
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                    ctx.fillRect(
                        node.x - textWidth / 2 - padding,
                        node.y + radius + 3 / globalScale,
                        textWidth + padding * 2,
                        textHeight + padding
                    );

                    ctx.fillStyle = '#e2e8f0';
                    ctx.fillText(label, node.x, node.y + radius + 4 / globalScale);

                    node.__bckgDimensions = [textWidth + padding * 2, radius * 2 + textHeight];
                }}
                nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                    const isCenter = node.type === 'case';
                    const radius = isCenter ? 18 : 12;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                }}
            />
            {/* 클릭 안내 */}
            <div style={{
                position: 'absolute',
                bottom: '8px',
                right: '12px',
                fontSize: '0.7rem',
                color: '#64748b',
                pointerEvents: 'none',
            }}>
                클릭: 상세 보기 · 더블클릭: 관련 문서 확장
            </div>
        </div>
    );
}
