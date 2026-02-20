'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Citation } from '@/lib/api';

// 서버 사이드 렌더링 제외 (window 객체 의존성 때문)
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
    loading: () => <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Graph...</div>
});

interface GraphViewProps {
    query: string;
    citations: Citation[];
    width?: number;
    height?: number;
}

interface Node {
    id: string;
    label: string;
    type: 'center' | 'law' | 'case' | 'interpretation' | 'unknown';
    val: number; // size
    color?: string;
    group?: number;
}

interface Link {
    source: string;
    target: string;
    color?: string;
}

interface GraphData {
    nodes: Node[];
    links: Link[];
}

export default function GraphView({ query, citations, width = 800, height = 400 }: GraphViewProps) {
    const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
    const graphRef = useRef<any>(null);

    useEffect(() => {
        if (!citations || citations.length === 0) {
            setGraphData({ nodes: [], links: [] });
            return;
        }

        // 1. 센터 노드 (질문/주제)
        const centerId = 'center';
        const centerNode: Node = {
            id: centerId,
            label: query.length > 20 ? query.substring(0, 20) + '...' : query,
            type: 'center',
            val: 20,
            color: '#a855f7', // Purple
            group: 1
        };

        const nodes: Node[] = [centerNode];
        const links: Link[] = [];

        // 2. 인용 노드
        const seen = new Set<string>();

        citations.forEach(cit => {
            if (seen.has(cit.title)) return;
            seen.add(cit.title);

            // 문서 유형 추론
            let type: Node['type'] = 'unknown';
            let color = '#94a3b8'; // gray
            let group = 0;

            if (cit.title.includes('법') || cit.title.includes('령') || cit.title.includes('규칙')) {
                type = 'law';
                color = '#3b82f6'; // blue
                group = 2;
            } else if (cit.title.includes('판결') || cit.title.includes('선고') || cit.title.match(/\d{4}[가-힣]+\d+/)) {
                type = 'case';
                color = '#ef4444'; // red
                group = 3;
            } else if (cit.title.includes('해석') || cit.title.includes('지침') || cit.title.includes('회시')) {
                type = 'interpretation';
                color = '#10b981'; // green
                group = 4;
            }

            nodes.push({
                id: cit.title,
                label: cit.title,
                type,
                val: 10,
                color,
                group
            });

            links.push({
                source: centerId,
                target: cit.title,
                color: '#cbd5e1'
            });
        });

        setGraphData({ nodes, links });

    }, [query, citations]);

    if (graphData.nodes.length === 0) {
        return null; // 데이터 없으면 렌더링 안 함
    }

    return (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#f8fafc', margin: '1rem 0' }}>
            <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#64748b', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>관계도</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#a855f7' }}></span> 검색어
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></span> 법령
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span> 판례
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span> 행정해석
                </span>
            </div>
            {/* @ts-ignore */}
            <ForceGraph2D
                width={width}
                height={height}
                graphData={graphData}
                nodeLabel="label"
                nodeRelSize={6}
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={0.005}
                backgroundColor="#f8fafc"
                nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                    const label = node.label;
                    const fontSize = 12 / globalScale;
                    ctx.font = `${fontSize}px Sans-Serif`;
                    const textWidth = ctx.measureText(label).width;
                    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

                    // draw circle
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI, false);
                    ctx.fillStyle = node.color || '#ccc';
                    ctx.fill();

                    // text
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#1e293b';
                    ctx.fillText(label, node.x, node.y + 6);

                    node.__bckgDimensions = bckgDimensions; // to re-use in nodePointerAreaPaint
                }}
                nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                    ctx.fillStyle = color;
                    const bckgDimensions = node.__bckgDimensions;
                    bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
                }}
            />
        </div>
    );
}
