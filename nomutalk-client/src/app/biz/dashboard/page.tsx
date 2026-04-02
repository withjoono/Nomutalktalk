'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';
import { fetchOrganization, fetchBizDashboardStats, fetchCompanyRules, BizDashboardStats, RagDocument } from '@/lib/api';
import type { OrganizationInfo } from '@/lib/api';

export default function BizDashboardPage() {
    const { user, isBusinessUser, userProfile } = useAuth();
    const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
    const [stats, setStats] = useState<BizDashboardStats | null>(null);
    const [rules, setRules] = useState<RagDocument[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isBusinessUser || !userProfile?.organizationId) {
            if (typeof window !== 'undefined' && !loading) {
                window.location.href = '/intro';
            }
            return;
        }

        const loadOrg = async () => {
            try {
                const orgId = userProfile.organizationId!;
                const [orgData, statsData, rulesData] = await Promise.all([
                    fetchOrganization(orgId),
                    fetchBizDashboardStats(orgId),
                    fetchCompanyRules(orgId)
                ]);
                setOrganization(orgData);
                setStats(statsData);
                setRules(rulesData);
            } catch (error) {
                console.error("Failed to load organization", error);
            } finally {
                setLoading(false);
            }
        };

        loadOrg();
    }, [isBusinessUser, userProfile, loading]);

    if (!user || loading) {
        return <div className={styles.container}><div className={styles.loading}>로딩 중...</div></div>;
    }

    if (!isBusinessUser) {
        return null; // will redirect
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>기업 대시보드</h1>
                <p className={styles.subtitle}>{organization?.name || '기업'}님의 노무 리스크 관리 현황입니다.</p>
            </div>

            {/* 통계 요약 (REAL DATA) */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statTitle}>진행 중인 사건</div>
                    <div className={styles.statValue}>{stats?.activeCaseCount || 0}<span className={styles.statUnit}>건</span></div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statTitle}>해결된 사건</div>
                    <div className={styles.statValue}>{stats?.resolvedCaseCount || 0}<span className={styles.statUnit}>건</span></div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statTitle}>AI 리포트 생성</div>
                    <div className={styles.statValue}>{stats?.totalAiReports || 0}<span className={styles.statUnit}>건</span></div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statTitle}>주요 발생 쟁점</div>
                    <div className={styles.statValue} style={{ fontSize: '1.4rem' }}>{stats?.topCaseType || '없음'}</div>
                </div>
            </div>

            {/* 최근 사건 및 할 일 (MOCK) */}
            <div className={styles.contentGrid}>
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>최근 등록된 사건</h2>
                        <button className={styles.actionBtn}>전체 보기</button>
                    </div>
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📋</div>
                        <p>등록된 사건이 없습니다. 새로운 사건을 추가하여 관리해보세요.</p>
                        <button className={styles.primaryBtn} onClick={() => window.location.href='/case-input'}>사건 등록하기</button>
                    </div>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>사내 규정 (RAG Store)</h2>
                        <button className={styles.actionBtn} onClick={() => window.location.href='/biz/settings'}>업로드 가기</button>
                    </div>
                    <div className={styles.statusBox}>
                        {rules.length === 0 ? (
                            <div className={styles.statusItem}>
                                <span className={styles.statusLabel}>업로드된 사내 규정이 없습니다.</span>
                                <span className={styles.statusValueNone}>미연동</span>
                            </div>
                        ) : (
                            rules.map((rule, idx) => (
                                <div key={idx} className={styles.statusItem}>
                                    <span className={styles.statusLabel}>{rule.displayName}</span>
                                    <span className={styles.statusValueActive}>적용됨</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
