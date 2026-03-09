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
    issueIndex?: number;
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
    onNodeClick?: (issueIndex: number) => void;
}

// ==================== Config ====================

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
const NODE_RADIUS = 18;
const CENTER_RADIUS = 22;

// ==================== Component ====================

export default function IssueOnlyGraph({
    issues,
    caseLabel = '사건',
    initialHeight = 500,
    onNodeClick,
}: IssueOnlyGraphProps) {
    const graphRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: initialHeight });
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

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

    // 전체화면 토글
    const toggleFullscreen = useCallback(() => {
        if (!wrapperRef.current) return;
        if (!isFullscreen) {
            if (wrapperRef.current.requestFullscreen) {
                wrapperRef.current.requestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }, [isFullscreen]);

    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    // issues → 그래프 데이터 (★ 초기 위치를 원형으로 배치)
    const graphData = useMemo(() => {
        const centerNode: IssueNode = {
            id: '__case__',
            label: caseLabel,
            severity: 'high',
            isCenter: true,
            fx: 0,
            fy: 0,
        };

        const n = issues.length;
        const issueNodes: IssueNode[] = issues.map((issue, idx) => {
            // 중요도별 반경 (높을수록 가까이)
            const sev = (issue.severity as string) || 'medium';
            const baseRadius = sev === 'high' ? 200 : sev === 'medium' ? 300 : 400;
            const angle = (2 * Math.PI * idx) / Math.max(n, 1) - Math.PI / 2;

            return {
                id: `issue-${idx}`,
                label: issue.title || `쟁점 ${idx + 1}`,
                severity: (issue.severity as any) || 'medium',
                detail: issue.summary || '',
                issueIndex: idx,
                x: Math.cos(angle) * baseRadius,
                y: Math.sin(angle) * baseRadius,
            };
        });

        const nodes = [centerNode, ...issueNodes];
        const links: IssueLink[] = issueNodes.map(nd => ({
            source: '__case__',
            target: nd.id,
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
    }, [graphData, isFullscreen]);

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

    // ★ 강한 물리 설정
    useEffect(() => {
        if (!graphRef.current) return;
        const fg = graphRef.current;

        fg.d3Force('charge')?.strength((d: any) => d.isCenter ? -3000 : -1500);

        fg.d3Force('link')?.distance((link: any) => {
            const target = typeof link.target === 'object' ? link.target : null;
            if (!target) return 250;
            const sev = target.severity || 'medium';
            switch (sev) {
                case 'high': return 200;
                case 'medium': return 320;
                case 'low': return 420;
                default: return 320;
            }
        });

        fg.d3Force('link')?.strength(0.3);

        const d3 = require('d3-force');
        fg.d3Force('collide', d3.forceCollide()
            .radius((d: any) => (d.isCenter ? CENTER_RADIUS : NODE_RADIUS) + 40)
            .strength(1)
            .iterations(4)
        );
    }, [graphData]);

    // 노드 클릭
    const handleNodeClick = useCallback((node: any) => {
        if (node.isCenter || node.issueIndex === undefined) return;
        onNodeClick?.(node.issueIndex);
    }, [onNodeClick]);

    // 텍스트 줄바꿈
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
        const radius = isCenter ? CENTER_RADIUS : NODE_RADIUS;

        ctx.save();
        ctx.globalAlpha = alpha;

        // 글로우
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 6, 0, 2 * Math.PI);
        ctx.fillStyle = `${color}22`;
        ctx.fill();

        // 원
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 텍스트
        const maxCharsPerLine = isCenter ? 4 : 6;
        const fontSize = (isCenter ? 10 : 8.5) / globalScale;
        ctx.font = `bold ${fontSize}px 'Noto Sans KR', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';

        const lines = wrapText(node.label, maxCharsPerLine);
        const lineHeight = fontSize * 1.25;
        const totalH = lineHeight * lines.length;
        const startY = node.y - totalH / 2 + lineHeight / 2;

        lines.forEach((line: string, i: number) => {
            ctx.fillText(line, node.x, startY + i * lineHeight);
        });

        // 중요도 뱃지
        if (!isCenter && node.severity) {
            const badgeLabel = SEVERITY_LABELS[node.severity] || '';
            const badgeSize = 7 / globalScale;
            ctx.font = `bold ${badgeSize}px sans-serif`;
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
        <div ref={wrapperRef} className={`${styles.wrapper} ${isFullscreen ? styles.fullscreen : ''}`}>
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
                <span className={styles.legendHint}>클릭하면 쟁점 상세 보기</span>
                <button className={styles.fullscreenBtn} onClick={toggleFullscreen} title={isFullscreen ? '축소' : '전체화면'}>
                    {isFullscreen ? '⬜ 축소' : '⛶ 전체화면'}
                </button>
            </div>

            <div
                ref={containerRef}
                className={styles.graphContainer}
                style={{ height: isFullscreen ? '100%' : `${initialHeight}px` }}
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
                    warmupTicks={50}
                    onNodeHover={(node: any) => setHoveredId(node?.id || null)}
                    onNodeClick={handleNodeClick}
                    nodeCanvasObject={paintNode}
                    linkCanvasObject={paintLink}
                    nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                        const radius = node.isCenter ? CENTER_RADIUS : NODE_RADIUS;
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
