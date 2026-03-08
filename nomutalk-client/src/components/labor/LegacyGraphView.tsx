'use client';

import React from 'react';
import GraphView from './GraphView';
import { Citation, GraphNode, GraphLink } from '@/lib/api';

/**
 * LegacyGraphView: 기존 Citation[] → 새 GraphNode/GraphLink 변환 래퍼
 * LaborAITabs에서 사용하는 기존 (query, citations) props를 유지합니다.
 */

interface LegacyGraphViewProps {
    query: string;
    citations: Citation[];
    width?: number;
    height?: number;
}

function classifyCitation(title: string): GraphNode['type'] {
    if (title.includes('법') || title.includes('령') || title.includes('규칙')) return 'law';
    if (title.includes('판결') || title.includes('선고') || title.includes('대법') || /\d{4}[가-힣]+\d+/.test(title)) return 'precedent';
    if (title.includes('해석') || title.includes('지침') || title.includes('회시')) return 'interpretation';
    if (title.includes('노동위') || title.includes('결정')) return 'decision';
    return 'unknown';
}

export default function LegacyGraphView({ query, citations, width = 800, height = 400 }: LegacyGraphViewProps) {
    if (!citations || citations.length === 0) return null;

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const seen = new Set<string>();

    // 센터 노드
    nodes.push({
        id: 'center',
        label: query.length > 20 ? query.substring(0, 20) + '...' : query,
        type: 'case',
        detail: query,
        val: 20,
    });

    citations.forEach((cit, idx) => {
        if (seen.has(cit.title)) return;
        seen.add(cit.title);

        const type = classifyCitation(cit.title);
        const nodeId = `cit-${idx}`;

        nodes.push({
            id: nodeId,
            label: cit.title,
            type,
            detail: cit.uri || '',
            val: 10,
        });

        links.push({
            source: 'center',
            target: nodeId,
            label: type === 'law' ? '법령' : type === 'precedent' ? '판례' : type === 'interpretation' ? '해석' : '관련',
        });
    });

    return <GraphView nodes={nodes} links={links} width={width} height={height} />;
}
