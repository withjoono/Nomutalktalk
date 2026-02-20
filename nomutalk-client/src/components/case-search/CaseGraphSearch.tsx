'use client';

import React, { useState } from 'react';
import styles from './CaseGraphSearch.module.css';
import GraphView from '../labor/GraphView';
import { Citation } from '@/lib/api';

interface DemoCitation {
    title: string;
    source: string;
}

const DEMO_DATA: DemoCitation[] = [
    { title: '근로기준법 제23조 (해고 등의 제한)', source: 'law' },
    { title: '근로기준법 제28조 (부당해고등의 구제신청)', source: 'law' },
    { title: '노동위원회법 제15조', source: 'law' },
    { title: '대법원 2011두12345 판결', source: 'case' },
    { title: '서울행법 2019구합23456 판결', source: 'case' },
    { title: '행정해석 근기 68207-1234', source: 'interpretation' },
    { title: '행정해석 임금 32450-567', source: 'interpretation' }
];

export default function CaseGraphSearch() {
    const [caseQuery, setCaseQuery] = useState('');
    const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'complete'>('idle');
    const [demoCitations, setDemoCitations] = useState<DemoCitation[]>([]);

    const graphCitations: Citation[] = demoCitations.map(c => ({
        title: c.title,
        source: 'citation' as const,
    }));

    const handleSearch = () => {
        setSearchStatus('loading');
        setTimeout(() => {
            setDemoCitations(DEMO_DATA);
            setSearchStatus('complete');
        }, 1500);
    };

    const getLabel = (s: string) => s === 'law' ? '법령' : s === 'case' ? '판례' : '행정해석';

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>🔎 사건 관련 검색</h1>
                <p>사건 내용을 입력하면 관련 법령, 판례, 행정해석을 분석하여 지식 그래프로 보여드립니다.</p>
            </div>

            <div className={styles.searchSection}>
                <div className={styles.infoBox}>
                    <p>📢 <strong>사건 입력 페이지에서 사건을 입력해주세요.</strong></p>
                    <p className={styles.subText}>입력된 사건을 바탕으로 법률 지식 그래프가 생성됩니다.</p>
                </div>

                <button
                    className={styles.searchButton}
                    onClick={handleSearch}
                    disabled={searchStatus === 'loading'}
                >
                    {searchStatus === 'loading' ? '데모 데이터 로딩 중...' : '📊 예시 그래프 보기 (Demo)'}
                </button>
            </div>

            {searchStatus === 'complete' && (
                <div className={styles.resultSection}>
                    <h3>📊 분석 결과</h3>
                    <div className={styles.graphWrapper}>
                        <GraphView
                            query={caseQuery}
                            citations={graphCitations}
                            width={typeof window !== 'undefined' && window.innerWidth > 800 ? 800 : 600}
                            height={500}
                        />
                    </div>
                    <div className={styles.citationList}>
                        <h4>참조 문서 목록</h4>
                        <ul>
                            {demoCitations.map((cite, idx) => (
                                <li key={idx} className={styles[cite.source as keyof typeof styles] as string}>
                                    <span className={styles.tag}>{getLabel(cite.source)}</span>
                                    {cite.title}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
