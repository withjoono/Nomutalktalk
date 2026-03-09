'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import styles from './ForceGraph.module.css';

// SSR 제외
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
    loading: () => (
        <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            그래프 로딩 중...
        </div>
    ),
});

// ==================== Types ====================

export interface FGNode {
    id: string;
    label: string;
    type: string;
    detail?: string;
    val?: number;
    group?: string;       // 클러스터 그룹핑용
    severity?: string;    // 시각적 강조 레벨
    [key: string]: any;
}

export interface FGLink {
    source: string;
    target: string;
    label?: string;
}

export interface FilterGroup {
    id: string;
    label: string;
    icon?: string;
    /** 이 필터가 활성화될 때 표시할 노드 타입들 */
    visibleTypes: string[];
    /** 항상 표시할 타입들 (예: 'case'는 항상 보임) */
    alwaysVisible?: boolean;
}

export interface ForceGraphProps {
    nodes: FGNode[];
    links: FGLink[];
    /** 노드 타입별 색상: { case: '#a855f7', law: '#3b82f6', ... } */
    nodeColors: Record<string, string>;
    /** 노드 타입별 아이콘 (이모지): { case: '📋', law: '⚖️', ... } */
    nodeIcons?: Record<string, string>;
    /** 노드 타입별 한글 레이블: { case: '사건', law: '법령', ... } */
    nodeLabels?: Record<string, string>;
    /** 필터 그룹 정의 */
    filterGroups?: FilterGroup[];
    /** 초기 활성 필터 ID */
    defaultFilter?: string;
    /** 최소 높이 (px) */
    minHeight?: number;
    /** 초기 높이 (px) */
    initialHeight?: number;
    /** severity별 글로우 색상 */
    severityColors?: Record<string, string>;
    /** 노드 클릭 */
    onNodeClick?: (node: FGNode) => void;
    /** 노드 더블클릭 */
    onNodeDoubleClick?: (node: FGNode) => void;
    /** 확장 중인 노드 ID */
    expandingNodeId?: string | null;
    /** 배경 색상 (기본: #0f172a) */
    backgroundColor?: string;
    /** 범례 제목 */
    legendTitle?: string;
}

// ==================== Component ====================

export default function ForceGraph({
    nodes,
    links,
    nodeColors,
    nodeIcons = {},
    nodeLabels = {},
    filterGroups = [],
    defaultFilter,
    minHeight = 400,
    initialHeight = 550,
    severityColors = {},
    onNodeClick,
    onNodeDoubleClick,
    expandingNodeId,
    backgroundColor = '#0f172a',
    legendTitle = '📊 관계도',
}: ForceGraphProps) {
    const graphRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: initialHeight });
    const [activeFilter, setActiveFilter] = useState<string>(defaultFilter || filterGroups[0]?.id || '__all__');
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const lastClickTime = useRef<number>(0);
    const lastClickNode = useRef<string>('');

    // ResizeObserver로 컨테이너 크기 추적
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

    // 호버 시 연결된 노드/링크 계산
    const connectedSet = useMemo(() => {
        if (!hoveredNodeId) return null;
        const set = new Set<string>();
        set.add(hoveredNodeId);
        links.forEach(l => {
            const src = typeof l.source === 'string' ? l.source : (l.source as any)?.id;
            const tgt = typeof l.target === 'string' ? l.target : (l.target as any)?.id;
            if (src === hoveredNodeId) set.add(tgt);
            if (tgt === hoveredNodeId) set.add(src);
        });
        return set;
    }, [hoveredNodeId, links]);

    // 필터 적용
    const filteredData = useMemo(() => {
        const activeGroup = filterGroups.find(f => f.id === activeFilter);

        let visibleNodes: FGNode[];

        if (!activeGroup) {
            // 필터 없음 = 전체 표시
            visibleNodes = nodes;
        } else {
            const visibleTypes = new Set(activeGroup.visibleTypes);
            visibleNodes = nodes.filter(n => visibleTypes.has(n.type));
        }

        const visibleIds = new Set(visibleNodes.map(n => n.id));

        const visibleLinks = links.filter(l => {
            const src = typeof l.source === 'string' ? l.source : (l.source as any)?.id;
            const tgt = typeof l.target === 'string' ? l.target : (l.target as any)?.id;
            return visibleIds.has(src) && visibleIds.has(tgt);
        });

        const gNodes = visibleNodes.map(n => ({
            ...n,
            color: nodeColors[n.type] || '#94a3b8',
        }));

        const gLinks = visibleLinks.map(l => ({
            ...l,
            color: 'rgba(148, 163, 184, 0.4)',
        }));

        return { nodes: gNodes, links: gLinks };
    }, [nodes, links, activeFilter, filterGroups, nodeColors]);

    // 줌 조절
    useEffect(() => {
        if (graphRef.current && filteredData.nodes.length > 0) {
            setTimeout(() => {
                graphRef.current?.zoomToFit(400, 60);
            }, 600);
        }
    }, [filteredData]);

    // 클릭 핸들러 (싱글/더블 구분)
    const handleNodeClick = useCallback((node: any) => {
        const now = Date.now();
        if (lastClickNode.current === node.id && now - lastClickTime.current < 400) {
            if (onNodeDoubleClick) onNodeDoubleClick(node as FGNode);
            lastClickTime.current = 0;
            lastClickNode.current = '';
        } else {
            if (onNodeClick) onNodeClick(node as FGNode);
            lastClickTime.current = now;
            lastClickNode.current = node.id;
        }
    }, [onNodeClick, onNodeDoubleClick]);

    // 노드 Canvas 렌더링
    const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const isCenterType = node.val && node.val >= 20;
        const isIssueType = node.severity;
        const radius = isCenterType ? 20 : isIssueType ? 15 : 11;
        const fontSize = (isCenterType ? 13 : isIssueType ? 12 : 10.5) / globalScale;

        const label = node.label?.length > 22
            ? node.label.substring(0, 22) + '...'
            : node.label;

        // 호버 투명도
        const isDimmed = connectedSet && !connectedSet.has(node.id);
        const alpha = isDimmed ? 0.15 : 1;

        // 확장 중 pulsing
        if (expandingNodeId === node.id) {
            const pulse = Math.sin(Date.now() / 200) * 4 + 8;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + pulse, 0, 2 * Math.PI);
            ctx.strokeStyle = `${node.color}88`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // severity 글로우
        if (isIssueType && severityColors[node.severity]) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 8, 0, 2 * Math.PI);
            ctx.fillStyle = isDimmed
                ? `${severityColors[node.severity]}08`
                : `${severityColors[node.severity]}30`;
            ctx.fill();
        }

        // 센터 노드 글로우
        if (isCenterType) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 7, 0, 2 * Math.PI);
            ctx.fillStyle = isDimmed ? `${node.color}05` : `${node.color}22`;
            ctx.fill();
        }

        // 원
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = isDimmed ? `${node.color}26` : (node.color || '#ccc');
        ctx.fill();

        // 테두리
        ctx.strokeStyle = isDimmed
            ? 'rgba(255,255,255,0.03)'
            : (isCenterType || isIssueType) ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.12)';
        ctx.lineWidth = (isCenterType || isIssueType) ? 2 : 1;
        ctx.stroke();

        // 아이콘
        const icon = nodeIcons[node.type] || '📄';
        ctx.globalAlpha = alpha;
        ctx.font = `${(isCenterType ? 15 : isIssueType ? 13 : 10) / globalScale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, node.x, node.y - 1 / globalScale);

        // 라벨
        ctx.font = `${fontSize}px 'Noto Sans KR', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        const textHeight = fontSize * 1.3;
        const padding = 3 / globalScale;

        // 라벨 배경
        ctx.fillStyle = isDimmed ? 'rgba(15, 23, 42, 0.3)' : 'rgba(15, 23, 42, 0.88)';
        ctx.fillRect(
            node.x - textWidth / 2 - padding,
            node.y + radius + 3 / globalScale,
            textWidth + padding * 2,
            textHeight + padding
        );

        ctx.fillStyle = isDimmed ? 'rgba(226, 232, 240, 0.15)' : '#e2e8f0';
        ctx.fillText(label, node.x, node.y + radius + 4 / globalScale);

        ctx.globalAlpha = 1;
        node.__bckgDimensions = [textWidth + padding * 2, radius * 2 + textHeight];
    }, [connectedSet, expandingNodeId, nodeIcons, severityColors]);

    // 링크 Canvas 렌더링 (호버 시 연결선 강조)
    const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
        if (!connectedSet) return;

        const src = typeof link.source === 'string' ? link.source : link.source?.id;
        const tgt = typeof link.target === 'string' ? link.target : link.target?.id;
        const isConnected = connectedSet.has(src) && connectedSet.has(tgt);

        if (!isConnected) {
            // dim 처리된 링크
            const sx = link.source?.x ?? 0;
            const sy = link.source?.y ?? 0;
            const tx = link.target?.x ?? 0;
            const ty = link.target?.y ?? 0;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(tx, ty);
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }
    }, [connectedSet]);

    // 클러스터링 force (group 필드 기반)
    useEffect(() => {
        if (!graphRef.current) return;

        const fg = graphRef.current;
        // group이 같은 노드끼리 끌어당기는 힘 추가
        fg.d3Force('charge')?.strength((d: any) => d.val && d.val >= 20 ? -300 : d.severity ? -150 : -60);

        // 클러스터 중심으로 끌어당기는 커스텀 force
        const clusterForce = () => {
            const groupCenters: Record<string, { x: number; y: number; count: number }> = {};

            filteredData.nodes.forEach((n: any) => {
                if (n.group && n.x != null && n.y != null) {
                    if (!groupCenters[n.group]) {
                        groupCenters[n.group] = { x: 0, y: 0, count: 0 };
                    }
                    groupCenters[n.group].x += n.x;
                    groupCenters[n.group].y += n.y;
                    groupCenters[n.group].count += 1;
                }
            });

            Object.values(groupCenters).forEach(c => {
                if (c.count > 0) {
                    c.x /= c.count;
                    c.y /= c.count;
                }
            });

            filteredData.nodes.forEach((n: any) => {
                if (n.group && groupCenters[n.group]) {
                    const center = groupCenters[n.group];
                    const dx = center.x - (n.x || 0);
                    const dy = center.y - (n.y || 0);
                    if (n.vx != null) n.vx += dx * 0.003;
                    if (n.vy != null) n.vy += dy * 0.003;
                }
            });
        };

        fg.d3Force('cluster', clusterForce);
    }, [filteredData]);

    if (filteredData.nodes.length === 0) {
        return (
            <div className={styles.emptyState}>
                <span>표시할 노드가 없습니다</span>
            </div>
        );
    }

    // 범례에 표시할 노드 타입 수집
    const visibleTypes = [...new Set(filteredData.nodes.map(n => n.type))];

    return (
        <div className={styles.wrapper}>
            {/* 필터 토글 바 */}
            {filterGroups.length > 0 && (
                <div className={styles.filterBar}>
                    {filterGroups.map(fg => (
                        <button
                            key={fg.id}
                            className={`${styles.filterBtn} ${activeFilter === fg.id ? styles.filterActive : ''}`}
                            onClick={() => setActiveFilter(fg.id)}
                        >
                            {fg.icon && <span className={styles.filterIcon}>{fg.icon}</span>}
                            {fg.label}
                        </button>
                    ))}
                </div>
            )}

            {/* 리사이즈 가능 컨테이너 */}
            <div
                ref={containerRef}
                className={styles.graphContainer}
                style={{ minHeight: `${minHeight}px`, height: `${initialHeight}px` }}
            >
                {/* 범례 */}
                <div className={styles.legend}>
                    <span className={styles.legendTitle}>{legendTitle}</span>
                    {visibleTypes.filter(t => nodeColors[t]).map(type => (
                        <span key={type} className={styles.legendItem}>
                            <span
                                className={styles.legendDot}
                                style={{ backgroundColor: nodeColors[type] }}
                            />
                            {nodeIcons[type] && <span>{nodeIcons[type]}</span>}
                            {nodeLabels[type] || type}
                        </span>
                    ))}
                </div>

                {/* @ts-ignore */}
                <ForceGraph2D
                    ref={graphRef}
                    width={dimensions.width}
                    height={dimensions.height - 44} // 범례 높이 빼기
                    graphData={filteredData}
                    nodeLabel=""
                    nodeRelSize={6}
                    linkDirectionalParticles={2}
                    linkDirectionalParticleSpeed={0.004}
                    linkDirectionalParticleWidth={3}
                    linkDirectionalArrowLength={6}
                    linkDirectionalArrowRelPos={0.85}
                    linkColor={(link: any) => {
                        const srcNode = typeof link.source === 'object' ? link.source : null;
                        const srcColor = srcNode?.color || 'rgba(148, 163, 184, 1)';
                        if (!connectedSet) return srcColor;
                        const srcId = typeof link.source === 'string' ? link.source : link.source?.id;
                        const tgtId = typeof link.target === 'string' ? link.target : link.target?.id;
                        const isConn = connectedSet.has(srcId) && connectedSet.has(tgtId);
                        return isConn ? srcColor : 'rgba(148, 163, 184, 0.08)';
                    }}
                    linkWidth={(link: any) => {
                        if (!connectedSet) return 2;
                        const srcId = typeof link.source === 'string' ? link.source : link.source?.id;
                        const tgtId = typeof link.target === 'string' ? link.target : link.target?.id;
                        const isConn = connectedSet.has(srcId) && connectedSet.has(tgtId);
                        return isConn ? 3 : 0.8;
                    }}
                    linkLineDash={(link: any) => {
                        const tgtNode = typeof link.target === 'object' ? link.target : null;
                        if (tgtNode?.severity) return []; // 쟁점 연결선 = 실선
                        return [4, 2]; // 법령/판례 연결선 = 점선
                    }}
                    backgroundColor={backgroundColor}
                    d3AlphaDecay={0.025}
                    d3VelocityDecay={0.3}
                    cooldownTicks={120}
                    onNodeClick={handleNodeClick}
                    onNodeHover={(node: any) => setHoveredNodeId(node?.id || null)}
                    nodeCanvasObject={paintNode}
                    nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                        const isCenterType = node.val && node.val >= 20;
                        const isIssueType = node.severity;
                        const radius = isCenterType ? 20 : isIssueType ? 15 : 11;
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, radius + 5, 0, 2 * Math.PI);
                        ctx.fillStyle = color;
                        ctx.fill();
                    }}
                />

                {/* 조작 안내 */}
                <div className={styles.hint}>
                    클릭: 상세 · 더블클릭: 확장 · 드래그: 이동 · 스크롤: 줌 · 모서리 드래그: 리사이즈
                </div>
            </div>
        </div>
    );
}
