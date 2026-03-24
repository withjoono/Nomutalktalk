'use client';

import React from 'react';
import styles from './DomainSelector.module.css';

export interface LegalDomainOption {
    key: string;
    name: string;
    icon: string;
    color: string;
    description: string;
}

/** 노무톡톡 지원 분야 (노동법 전문) */
export const LEGAL_DOMAINS: LegalDomainOption[] = [
    { key: 'labor', name: '노동법', icon: '⚖️', color: '#4f46e5', description: '근로계약, 임금, 해고, 산재 등' },
];

/** 노동법 사건 유형 */
export const DOMAIN_CASE_TYPES: Record<string, { value: string; label: string }[]> = {
    labor: [
        { value: '', label: '사건 유형 선택 (선택사항)' },
        { value: '부당해고', label: '⚠️ 부당해고' },
        { value: '임금체불', label: '💰 임금체불' },
        { value: '산업재해', label: '🏥 산업재해' },
        { value: '근로시간', label: '⏰ 근로시간/초과근무' },
        { value: '직장내괴롭힘', label: '😤 직장 내 괴롭힘' },
        { value: '퇴직금', label: '📋 퇴직금' },
        { value: '차별', label: '🚫 차별/성희롱' },
        { value: '기타', label: '📌 기타' },
    ],
};

interface DomainSelectorProps {
    selected: string;
    onSelect: (domain: string) => void;
}

export default function DomainSelector({ selected, onSelect }: DomainSelectorProps) {
    return (
        <div className={styles.grid}>
            {LEGAL_DOMAINS.map((d) => (
                <button
                    key={d.key}
                    className={`${styles.card} ${selected === d.key ? styles.active : ''}`}
                    onClick={() => onSelect(d.key)}
                    style={{
                        '--domain-color': d.color,
                        '--domain-color-light': d.color + '18',
                    } as React.CSSProperties}
                >
                    <span className={styles.icon}>{d.icon}</span>
                    <span className={styles.name}>{d.name}</span>
                    <span className={styles.desc}>{d.description}</span>
                </button>
            ))}
        </div>
    );
}
