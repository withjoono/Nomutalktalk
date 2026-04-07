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

/** 노동법 사건 유형 — 개인(근로자) 관점 */
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
        { value: '부당전보', label: '🔄 부당전보·전직' },
        { value: '기타', label: '📌 기타' },
    ],
};

/** 노동법 사건 유형 — 기업(사업주) 관점 */
export const DOMAIN_CASE_TYPES_BIZ: Record<string, { value: string; label: string }[]> = {
    labor: [
        { value: '', label: '사건 유형 선택 (선택사항)' },
        { value: '해고징계절차', label: '⚠️ 해고·징계 절차 검토' },
        { value: '취업규칙변경', label: '📋 취업규칙 변경' },
        { value: '근로계약검토', label: '📝 근로계약 검토' },
        { value: '급여설계', label: '💰 급여·상여금 설계' },
        { value: '유연근무제', label: '⏰ 유연근무제 도입' },
        { value: '파견도급', label: '🔄 파견/도급 적법성' },
        { value: '노조대응', label: '🤝 노조 대응' },
        { value: '산업안전', label: '🛡️ 산업안전 컴플라이언스' },
        { value: '인사규정', label: '📂 인사규정 제·개정' },
        { value: '기타', label: '📌 기타' },
    ],
};

/** userType에 따라 적절한 사건 유형 리스트 반환 */
export function getCaseTypesForUser(userType: string | undefined, domain: string = 'labor') {
    const types = userType === 'BUSINESS' ? DOMAIN_CASE_TYPES_BIZ : DOMAIN_CASE_TYPES;
    return types[domain] || types.labor;
}

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
