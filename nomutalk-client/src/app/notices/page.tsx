'use client';

import React, { useState } from 'react';
import s from './page.module.css';

/* ── 공지사항 데이터 ── */
interface Notice {
    id: number;
    category: 'important' | 'update' | 'event' | 'general';
    title: string;
    body: string;
    date: string;
    isNew?: boolean;
}

const CATEGORY_MAP: Record<Notice['category'], { label: string; emoji: string; style: string }> = {
    important: { label: '중요', emoji: '🔴', style: 'badgeImportant' },
    update:    { label: '업데이트', emoji: '🔵', style: 'badgeUpdate' },
    event:     { label: '이벤트', emoji: '🎉', style: 'badgeEvent' },
    general:   { label: '일반', emoji: '📌', style: 'badgeGeneral' },
};

const notices: Notice[] = [
    {
        id: 1,
        category: 'important',
        title: '노무톡톡 서비스 정식 오픈 안내',
        body: `안녕하세요, 청사공인노무사입니다.\n\n노무톡톡이 2026년 3월 29일부터 정식 서비스를 시작합니다. AI 기반 노무 상담, 법령·판례 검색, 법률 서면 생성 등 다양한 기능을 이용하실 수 있습니다.\n\n정식 오픈을 기념하여 첫 달 PRO 구독을 50% 할인된 가격으로 제공합니다. 많은 이용 부탁드립니다.`,
        date: '2026.03.29',
        isNew: true,
    },
    {
        id: 2,
        category: 'update',
        title: 'AI 상담 모드 6종 업데이트 완료',
        body: `노무톡톡의 AI 상담이 더욱 강화되었습니다.\n\n• 일반 상담 모드: 기본 노무 상담\n• 사건 분석 모드: 등록 사건 기반 심층 분석\n• 전략 수립 모드: 대응 전략 추천\n• 서면 작성 모드: 진정서, 답변서 등 초안 생성\n• 증거 검토 모드: 업로드 문서 분석 및 증거력 평가\n• 종합 컨설팅 모드: 전체 프로세스 통합 안내\n\n각 모드별 특화된 프롬프트로 더욱 정확한 상담이 가능합니다.`,
        date: '2026.03.29',
        isNew: true,
    },
    {
        id: 3,
        category: 'event',
        title: '오픈 기념 PRO 구독 50% 할인 이벤트',
        body: `노무톡톡 정식 오픈을 기념하여 PRO 요금제를 특별 할인합니다.\n\n• 기간: 2026년 3월 29일 ~ 4월 30일\n• 대상: 신규 가입 회원\n• 혜택: 첫 달 PRO 월간 구독 50% 할인 (₩9,900 → ₩4,950)\n\n이벤트 기간 내 가입 시 자동 적용됩니다.`,
        date: '2026.03.29',
        isNew: true,
    },
    {
        id: 4,
        category: 'general',
        title: '이용약관 및 개인정보처리방침 제정 안내',
        body: `노무톡톡 서비스 이용을 위한 법적 문서가 공개되었습니다.\n\n• 이용약관: 서비스 이용 조건 및 회원 권리·의무\n• 개인정보처리방침: 개인정보 수집·이용·보관·파기 기준\n• 환불정책: 유료 서비스 환불 조건 및 절차\n• 가격정책: FREE / PRO / ENTERPRISE 요금 안내\n\n각 문서는 서비스 하단 링크를 통해 확인하실 수 있습니다.`,
        date: '2026.03.29',
    },
    {
        id: 5,
        category: 'general',
        title: '고객센터 운영 안내',
        body: `노무톡톡 고객센터 운영 시간을 안내드립니다.\n\n• 전화 상담: 070-4448-6960 (평일 10:00 ~ 16:00)\n• 이메일: sws12q@naver.com (24시간 접수, 1영업일 내 답변)\n• 앱 내 문의: 프로필 → 고객센터\n\n주말 및 공휴일에는 이메일로 문의해 주세요.`,
        date: '2026.03.28',
    },
];

export default function NoticesPage() {
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    const toggle = (id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const PREVIEW_LENGTH = 80;

    return (
        <div className={s.container}>
            {/* Hero */}
            <div className={`${s.hero} ${s.heroSlate}`}>
                <div className={s.heroBadge}>📢 공지사항</div>
                <h1 className={s.heroTitle}>공지사항</h1>
                <p className={s.heroSubtitle}>
                    노무톡톡의 서비스 소식과 업데이트를 확인하세요.
                </p>
            </div>

            {/* Notice List */}
            <div className={s.noticeList}>
                {notices.map((notice) => {
                    const cat = CATEGORY_MAP[notice.category];
                    const isExpanded = expandedIds.has(notice.id);
                    const isLong = notice.body.length > PREVIEW_LENGTH;
                    const displayBody = isExpanded || !isLong
                        ? notice.body
                        : notice.body.slice(0, PREVIEW_LENGTH) + '…';

                    return (
                        <div key={notice.id} className={s.noticeCard}>
                            <div className={s.noticeHeader}>
                                <span className={`${s.noticeBadge} ${s[cat.style]}`}>
                                    {cat.emoji} {cat.label}
                                </span>
                                {notice.isNew && <span className={s.newDot} />}
                                <span className={s.noticeDate}>{notice.date}</span>
                            </div>
                            <div className={s.noticeTitle}>{notice.title}</div>
                            <div className={s.noticeBody}>
                                {displayBody.split('\n').map((line, i) => (
                                    <p key={i}>{line}</p>
                                ))}
                            </div>
                            {isLong && (
                                <button
                                    className={s.expandBtn}
                                    onClick={() => toggle(notice.id)}
                                >
                                    {isExpanded ? '접기 ▲' : '자세히 보기 ▼'}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className={s.docFooter}>
                <p>청사공인노무사 | 대표: 성시웅 | 사업자번호: 314-12-25811</p>
            </div>
        </div>
    );
}
