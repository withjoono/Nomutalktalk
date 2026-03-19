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

/** 지원 법 분야 목록 (한국 법체계 표준 분류 순) */
export const LEGAL_DOMAINS: LegalDomainOption[] = [
    { key: 'civil', name: '민사법', icon: '📋', color: '#0891b2', description: '계약, 손해배상, 부동산, 채권채무' },
    { key: 'criminal', name: '형사법', icon: '🔒', color: '#dc2626', description: '형사사건, 고소/고발, 수사절차' },
    { key: 'family', name: '가사법', icon: '👨‍👩‍👧', color: '#d946ef', description: '이혼, 양육권, 상속, 가사조정' },
    { key: 'admin', name: '행정법', icon: '🏛️', color: '#ea580c', description: '인허가, 행정처분, 세금, 국가배상' },
    { key: 'labor', name: '노동법', icon: '⚖️', color: '#4f46e5', description: '근로계약, 임금, 해고, 산재 등' },
    { key: 'corporate', name: '기업법', icon: '🏢', color: '#059669', description: '회사설립, 주주분쟁, M&A' },
    { key: 'ip', name: '지식재산', icon: '💡', color: '#ca8a04', description: '특허, 상표, 저작권, 영업비밀' },
];

/** 법 분야별 사건 유형 (laborSchemas.js의 DomainCaseTypes와 동일) */
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
    civil: [
        { value: '', label: '사건 유형 선택 (선택사항)' },
        { value: '계약분쟁', label: '📋 계약 분쟁' },
        { value: '손해배상', label: '💰 손해배상' },
        { value: '부동산', label: '🏠 부동산 분쟁' },
        { value: '채권채무', label: '💳 채권/채무' },
        { value: '기타', label: '📌 기타' },
    ],
    criminal: [
        { value: '', label: '사건 유형 선택 (선택사항)' },
        { value: '재산범죄', label: '💰 재산범죄 (사기/횡령)' },
        { value: '폭력범죄', label: '👊 폭력범죄' },
        { value: '성범죄', label: '🚫 성범죄' },
        { value: '교통범죄', label: '🚗 교통범죄' },
        { value: '기타', label: '📌 기타' },
    ],
    family: [
        { value: '', label: '사건 유형 선택 (선택사항)' },
        { value: '이혼', label: '💔 이혼' },
        { value: '양육권', label: '👶 양육권/양육비' },
        { value: '상속', label: '📜 상속/유언' },
        { value: '기타', label: '📌 기타' },
    ],
    admin: [
        { value: '', label: '사건 유형 선택 (선택사항)' },
        { value: '행정처분', label: '🏛️ 행정처분 불복' },
        { value: '세금', label: '💰 세금/과세 분쟁' },
        { value: '국가배상', label: '⚖️ 국가배상' },
        { value: '기타', label: '📌 기타' },
    ],
    ip: [
        { value: '', label: '사건 유형 선택 (선택사항)' },
        { value: '특허', label: '📐 특허 분쟁' },
        { value: '상표', label: '®️ 상표 분쟁' },
        { value: '저작권', label: '©️ 저작권 분쟁' },
        { value: '기타', label: '📌 기타' },
    ],
    corporate: [
        { value: '', label: '사건 유형 선택 (선택사항)' },
        { value: '회사설립', label: '🏢 회사 설립/등기' },
        { value: '주주분쟁', label: '📊 주주 분쟁' },
        { value: '기업규제', label: '📋 기업 규제/컴플라이언스' },
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
