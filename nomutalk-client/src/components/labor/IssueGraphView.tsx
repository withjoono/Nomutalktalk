'use client';

import React from 'react';
import ForceGraph, { FGNode, FGLink, FilterGroup } from '../graph/ForceGraph';
import { GraphNode, GraphLink } from '@/lib/api';

// ==================== 노동법 전용 설정 ====================

const NODE_COLORS: Record<string, string> = {
    case: '#a855f7',
    issue: '#f97316',
    law: '#3b82f6',
    precedent: '#ef4444',
    interpretation: '#10b981',
    decision: '#f59e0b',
    unknown: '#94a3b8',
};

const NODE_ICONS: Record<string, string> = {
    case: '📋',
    issue: '🔥',
    law: '⚖️',
    precedent: '🏛️',
    interpretation: '📝',
    decision: '🔨',
    unknown: '📄',
};

const NODE_LABELS: Record<string, string> = {
    case: '사건',
    issue: '쟁점',
    law: '법령',
    precedent: '판례',
    interpretation: '행정해석',
    decision: '노동위 결정',
};

const SEVERITY_COLORS: Record<string, string> = {
    high: '#ef4444',
    medium: '#f97316',
    low: '#eab308',
};

const FILTER_GROUPS: FilterGroup[] = [
    {
        id: 'all',
        label: '전체',
        icon: '📋',
        visibleTypes: ['case', 'issue', 'law', 'precedent', 'interpretation', 'decision', 'unknown'],
    },
    {
        id: 'issues-only',
        label: '쟁점만',
        icon: '🔥',
        visibleTypes: ['case', 'issue'],
    },
    {
        id: 'issues-laws',
        label: '쟁점 + 법령',
        icon: '⚖️',
        visibleTypes: ['case', 'issue', 'law'],
    },
    {
        id: 'issues-precedents',
        label: '쟁점 + 판례',
        icon: '🏛️',
        visibleTypes: ['case', 'issue', 'precedent'],
    },
    {
        id: 'issues-all-refs',
        label: '쟁점 + 모든 참조',
        icon: '📑',
        visibleTypes: ['case', 'issue', 'law', 'precedent', 'interpretation', 'decision'],
    },
];

// ==================== Props ====================

interface IssueGraphViewProps {
    nodes: GraphNode[];
    links: GraphLink[];
    onNodeClick?: (node: GraphNode) => void;
    onNodeDoubleClick?: (node: GraphNode) => void;
    expandingNodeId?: string | null;
    initialHeight?: number;
    minHeight?: number;
}

// ==================== Component ====================

export default function IssueGraphView({
    nodes,
    links,
    onNodeClick,
    onNodeDoubleClick,
    expandingNodeId,
    initialHeight = 550,
    minHeight = 400,
}: IssueGraphViewProps) {
    // GraphNode → FGNode 변환 (group 필드 추가)
    const fgNodes: FGNode[] = nodes.map(n => ({
        ...n,
        group: n.parentIssue || (n.type === 'case' ? '__center__' : undefined),
        severity: n.severity,
    }));

    const fgLinks: FGLink[] = links.map(l => ({
        source: typeof l.source === 'string' ? l.source : (l.source as any)?.id || '',
        target: typeof l.target === 'string' ? l.target : (l.target as any)?.id || '',
        label: l.label,
    }));

    return (
        <ForceGraph
            nodes={fgNodes}
            links={fgLinks}
            nodeColors={NODE_COLORS}
            nodeIcons={NODE_ICONS}
            nodeLabels={NODE_LABELS}
            filterGroups={FILTER_GROUPS}
            defaultFilter="all"
            severityColors={SEVERITY_COLORS}
            onNodeClick={onNodeClick as any}
            onNodeDoubleClick={onNodeDoubleClick as any}
            expandingNodeId={expandingNodeId}
            initialHeight={initialHeight}
            minHeight={minHeight}
            legendTitle="📊 법률 쟁점 관계도"
        />
    );
}
