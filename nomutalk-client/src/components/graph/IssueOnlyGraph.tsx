'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import styles from './IssueOnlyGraph.module.css';
import { IssueInfo } from '@/lib/api';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
    loading: () => (
        <div style={{ height: '450px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            그래프 로딩 중...
        </div>
    ),
});

// ==================== Types ====================

interface IssueNode {
    id: string;
    label: string;
    severity: 'high' | 'medium' | 'low';
    detail?: string;
    isCenter?: boolean;
    // d3 will add x, y, vx, vy
    x?: number;
    y?: number;
    fx?: number;
    fy?: number;
}

interface IssueLink {
    source: string;
    target: string;
}

interface IssueOnlyGraphProps {
    issues: IssueInfo[];
    caseLabel?: string;
    initialHeight?: number;
}

// ==================== Config ====================

const SEVERITY_RANK: Record<string, number> = { high: 1, medium: 2, low: 3 };
const SEVERITY_COLORS: Record<string, string> = {
    high: '#ef4444',
    medium: '#f97316',
    low: '#eab308',
};
const SEVERITY_LABELS: Record<string, string> = {
    high: '높음',
    medium: '보통',
    low: '낮음',
};

const CENTER_COLOR = '#a855f7';

// ==================== Component ====================

export default function IssueOnlyGraph({
    issues,
    caseLabel = '사건',
    initialHeight = 500,
}: IssueOnlyGraphProps) {
    const graphRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: initialHeight });
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    // ResizeObserver
    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    setDimensions({ width: Math.floor(width), height: Math.floor(height) });
                }
            }
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    // issues → 그래프 데이터 변환
    const graphData = useMemo(() => {
        const centerNode: IssueNode = {
            id: '__case__',
            label: caseLabel,
            severity: 'high',
            isCenter: true,
            fx: 0,
            fy: 0,
        };

        const issueNodes: IssueNode[] = issues.map((issue, idx) => ({
            id: `issue-${idx}`,
            label: issue.title || `쟁점 ${idx + 1}`,
            severity: (issue.severity as any) || 'medium',
            detail: issue.summary || '',
        }));

        const nodes = [centerNode, ...issueNodes];
        const links: IssueLink[] = issueNodes.map(n => ({
            source: '__case__',
            target: n.id,
        }));

        return { nodes, links };
    }, [issues, caseLabel]);

    // 줌핏
    useEffect(() => {
        if (graphRef.current && graphData.nodes.length > 0) {
            setTimeout(() => {
                graphRef.current?.zoomToFit(400, 80);
            }, 800);
        }
    }, [graphData]);

    // 연결 노드 하이라이트
    const connectedSet = useMemo(() => {
        if (!hoveredId) return null;
        const set = new Set<string>();
        set.add(hoveredId);
        graphData.links.forEach(l => {
            const src = typeof l.source === 'string' ? l.source : (l.source as any)?.id;
            const tgt = typeof l.target === 'string' ? l.target : (l.target as any)?.id;
            if (src === hoveredId) set.add(tgt);
            if (tgt === hoveredId) set.add(src);
        });
        return set;
    }, [hoveredId, graphData.links]);

    // 중요도별 거리 조절
    useEffect(() => {
        if (!graphRef.current) return;
        const fg = graphRef.current;

        // 중심 노드는 강한 척력, 쟁점은 중간
        fg.d3Force('charge')?.strength((d: any) => d.isCenter ? -600 : -200);

        // 링크 거리: 중요도별로 다르게
        fg.d3Force('link')?.distance((link: any) => {
            const target = typeof link.target === 'object' ? link.target : null;
            if (!target) return 120;
            const sev = target.severity || 'medium';
            switch (sev) {
                case 'high': return 80;
                case 'medium': return 150;
                case 'low': return 220;
                default: return 150;
            }
        });

        fg.d3Force('link')?.strength(0.5);
    }, [graphData]);

    // 텍스트 줄바꿈 헬퍼
    const wrapText = (text: string, maxChars: number): string[] => {
        if (text.length <= maxChars) return [text];
        const lines: string[] = [];
        let remaining = text;
        while (remaining.length > 0) {
            if (remaining.length <= maxChars) {
                lines.push(remaining);
                break;
            }
            lines.push(remaining.substring(0, maxChars));
            remaining = remaining.substring(maxChars);
            if (lines.length >= 3) {
                // 최대 3줄, 마지막 줄에 ... 추가
                lines[lines.length - 1] = lines[lines.length - 1].substring(0, maxChars - 1) + '…';
                break;
            }
        }
        return lines;
    };

    // ==================== Canvas 렌더링 ====================

    const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const isDimmed = connectedSet && !connectedSet.has(node.id);
        const alpha = isDimmed ? 0.15 : 1;

        const isCenter = node.isCenter;
        const color = isCenter ? CENTER_COLOR : (SEVERITY_COLORS[node.severity] || SEVERITY_COLORS.medium);

        // 동적 반지름: 센터 크게, 쟁점은 중간
        const baseRadius = isCenter ? 32 : 28;
        const radius = baseRadius;

        // ── 글로우 ──
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 8, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}22`;
        ctx.fill();

        // ── 원 ──
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // ── 원 안의 텍스트 ──
        const maxCharsPerLine = isCenter ? 5 : 7;
        const fontSize = (isCenter ? 11 : 9.5) / globalScale;
        ctx.font = `bold ${fontSize}px 'Noto Sans KR', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';

        const lines = wrapText(node.label, maxCharsPerLine);
        const lineHeight = fontSize * 1.3;
        const totalH = lineHeight * lines.length;
        const startY = node.y - totalH / 2 + lineHeight / 2;

        lines.forEach((line: string, i: number) => {
            ctx.fillText(line, node.x, startY + i * lineHeight);
        });

        // ── 중요도 뱃지 (쟁점만) ──
        if (!isCenter && node.severity) {
            const badgeLabel = SEVERITY_LABELS[node.severity] || '';
            const badgeSize = 7 / globalScale;
            ctx.font = `bold ${badgeSize}px sans-serif`;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x + radius * 0.7, node.y - radius * 0.7, 9 / globalScale, 0, 2 * Math.PI);
            ctx.fillStyle = isDimmed ? 'rgba(15,23,42,0.3)' : '#0f172a';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5 / globalScale;
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeLabel, node.x + radius * 0.7, node.y - radius * 0.7);
        }

        ctx.restore();
        node.__bckgDimensions = [radius * 2, radius * 2];
    }, [connectedSet]);

    // 링크 렌더링
    const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
        const sx = link.source?.x ?? 0;
        const sy = link.source?.y ?? 0;
        const tx = link.target?.x ?? 0;
        const ty = link.target?.y ?? 0;

        const targetNode = typeof link.target === 'object' ? link.target : null;
        const sev = targetNode?.severity || 'medium';
        const color = SEVERITY_COLORS[sev] || SEVERITY_COLORS.medium;

        const isDimmed = connectedSet && !(connectedSet.has(link.source?.id) && connectedSet.has(link.target?.id));

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = isDimmed ? 'rgba(148,163,184,0.06)' : `${color}88`;
        ctx.lineWidth = isDimmed ? 0.5 : 2.5;
        ctx.stroke();
    }, [connectedSet]);

    if (issues.length === 0) {
        return (
            <div className={styles.emptyState}>
                <span>분석된 쟁점이 없습니다</span>
            </div>
        );
    }

    return (
        <div className={styles.wrapper}>
            {/* 범례 */}
            <div className={styles.legend}>
                <span className={styles.legendTitle}>🔥 핵심 쟁점 관계도</span>
                <span className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ backgroundColor: CENTER_COLOR }} />
                    사건
                </span>
                {Object.entries(SEVERITY_COLORS).map(([sev, color]) => (
                    <span key={sev} className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ backgroundColor: color }} />
                        {SEVERITY_LABELS[sev]}
                    </span>
                ))}
                <span className={styles.legendHint}>중심에 가까울수록 중요도 높음</span>
            </div>

            <div
                ref={containerRef}
                className={styles.graphContainer}
                style={{ height: `${initialHeight}px` }}
            >
                {/* @ts-ignore */}
                <ForceGraph2D
                    ref={graphRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    graphData={graphData}
                    nodeLabel=""
                    nodeRelSize={6}
                    linkDirectionalParticles={0}
                    backgroundColor="#0f172a"
                    d3AlphaDecay={0.02}
                    d3VelocityDecay={0.25}
                    cooldownTicks={150}
                    onNodeHover={(node: any) => setHoveredId(node?.id || null)}
                    nodeCanvasObject={paintNode}
                    linkCanvasObject={paintLink}
                    nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                        const radius = node.isCenter ? 32 : 28;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius + 5, 0, 2 * Math.PI);
                        ctx.fillStyle = color;
                        ctx.fill();
                    }}
                />
            </div>
        </div>
    );
}
