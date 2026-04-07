'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';
import { fetchOrganization, fetchBizDashboardStats, fetchCompanyRules, fetchUsage, BizDashboardStats, RagDocument, UsageInfo } from '@/lib/api';
import type { OrganizationInfo } from '@/lib/api';

const STEP_LABELS = ['등록', '쟁점 분석', '법령 검토', '상담 중', '완료'];

export default function BizDashboardPage() {
    const { user, isBusinessUser, userProfile } = useAuth();
    const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
    const [stats, setStats] = useState<BizDashboardStats | null>(null);
    const [rules, setRules] = useState<RagDocument[]>([]);
    const [usage, setUsage] = useState<UsageInfo | null>(null);
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
                const [orgData, statsData, rulesData, usageData] = await Promise.all([
                    fetchOrganization(orgId),
                    fetchBizDashboardStats(orgId),
                    fetchCompanyRules(orgId),
                    fetchUsage().catch(() => null),
                ]);
                setOrganization(orgData);
                setStats(statsData);
                setRules(rulesData);
                setUsage(usageData);
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
        return null;
    }

    const maxTrendCount = Math.max(...(stats?.monthlyCaseTrend?.map(t => t.count) || [1]));

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>기업 대시보드</h1>
                <p className={styles.subtitle}>{organization?.name || '기업'}님의 노무 리스크 관리 현황입니다.</p>
            </div>

            {/* ── 통계 카드 ── */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statTitle}>📊 총 사건 수</div>
                    <div className={styles.statValue}>{stats?.totalCaseCount || 0}<span className={styles.statUnit}>건</span></div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statTitle}>🔴 진행 중</div>
                    <div className={styles.statValue}>{stats?.activeCaseCount || 0}<span className={styles.statUnit}>건</span></div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statTitle}>✅ 해결 완료</div>
                    <div className={styles.statValue}>{stats?.resolvedCaseCount || 0}<span className={styles.statUnit}>건</span></div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statTitle}>🤖 AI 분석 횟수</div>
                    <div className={styles.statValue}>{stats?.totalAiReports || 0}<span className={styles.statUnit}>건</span></div>
                </div>
            </div>

            {/* ── 메인 콘텐츠 ── */}
            <div className={styles.contentGrid}>
                {/* 왼쪽: 최근 사건 목록 */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h2 className={styles.cardTitle}>최근 등록된 사건</h2>
                        <button className={styles.actionBtn} onClick={() => window.location.href='/case-input'}>+ 사건 등록</button>
                    </div>
                    {(!stats?.recentCases || stats.recentCases.length === 0) ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIcon}>📋</div>
                            <p>등록된 사건이 없습니다. 새로운 사건을 추가하여 관리해보세요.</p>
                            <button className={styles.primaryBtn} onClick={() => window.location.href='/case-input'}>사건 등록하기</button>
                        </div>
                    ) : (
                        <div className={styles.caseList}>
                            {stats.recentCases.map(c => (
                                <div key={c.id} className={styles.caseItem} onClick={() => window.location.href=`/case-input?caseId=${c.id}`}>
                                    <div className={styles.caseInfo}>
                                        <span className={styles.caseType}>{c.caseType}</span>
                                        <span className={styles.caseTitle}>{c.title}</span>
                                    </div>
                                    <div className={styles.caseMeta}>
                                        {c.overallWinRate !== null && (
                                            <span className={`${styles.riskBadge} ${
                                                c.overallWinRate >= 70 ? styles.riskHigh 
                                                : c.overallWinRate >= 40 ? styles.riskMid 
                                                : styles.riskLow
                                            }`}>
                                                리스크 {c.overallWinRate}%
                                            </span>
                                        )}
                                        <span className={styles.caseStep}>{STEP_LABELS[c.currentStep] || '진행 중'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 오른쪽 사이드바  */}
                <div className={styles.sidebarCards}>
                    {/* 사건 유형 분포 */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>사건 유형 분포</h2>
                        </div>
                        <div className={styles.statusBox}>
                            {(!stats?.caseTypeDistribution || stats.caseTypeDistribution.length === 0) ? (
                                <p className={styles.emptyText}>데이터가 없습니다.</p>
                            ) : (
                                stats.caseTypeDistribution.map((item, idx) => {
                                    const total = stats.caseTypeDistribution.reduce((a, b) => a + b.value, 0);
                                    const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                                    const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
                                    return (
                                        <div key={idx} className={styles.distItem}>
                                            <div className={styles.distLabel}>
                                                <span className={styles.distDot} style={{ background: colors[idx % colors.length] }}></span>
                                                <span>{item.name}</span>
                                            </div>
                                            <div className={styles.distBarWrap}>
                                                <div className={styles.distBar} style={{ width: `${pct}%`, background: colors[idx % colors.length] }}></div>
                                            </div>
                                            <span className={styles.distPct}>{pct}%</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* 월별 사건 추이 */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>월별 사건 추이</h2>
                        </div>
                        <div className={styles.statusBox}>
                            {(!stats?.monthlyCaseTrend || stats.monthlyCaseTrend.length === 0) ? (
                                <p className={styles.emptyText}>데이터가 없습니다.</p>
                            ) : (
                                <div className={styles.trendChart}>
                                    {stats.monthlyCaseTrend.map((item, idx) => (
                                        <div key={idx} className={styles.trendCol}>
                                            <span className={styles.trendCount}>{item.count}</span>
                                            <div className={styles.trendBarWrap}>
                                                <div 
                                                    className={styles.trendBar} 
                                                    style={{ height: `${Math.max(10, (item.count / maxTrendCount) * 100)}%` }}
                                                ></div>
                                            </div>
                                            <span className={styles.trendMonth}>{item.month.slice(5)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 사내 규정 RAG */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>사내 규정 (RAG)</h2>
                            <button className={styles.actionBtn} onClick={() => window.location.href='/biz/settings'}>관리</button>
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

                    {/* 오늘 사용량 */}
                    {usage && (
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h2 className={styles.cardTitle}>오늘 사용량</h2>
                                <span className={styles.tierBadge}>{usage.tier}</span>
                            </div>
                            <div className={styles.statusBox}>
                                {(['analysis', 'chat', 'document', 'evidence'] as const).map((key) => {
                                    const label = { analysis: '사건 분석', chat: 'AI 상담', document: '서면 작성', evidence: '증거 분석' }[key];
                                    const used = usage.usage[key] || 0;
                                    const limit = usage.limits[key];
                                    const isUnlimited = limit === -1;
                                    const pct = isUnlimited ? 0 : limit > 0 ? Math.round((used / limit) * 100) : 0;
                                    return (
                                        <div key={key} className={styles.usageRow}>
                                            <div className={styles.usageLabel}>
                                                <span>{label}</span>
                                                <span className={styles.usageCount}>{used}{isUnlimited ? '' : `/${limit}`}</span>
                                            </div>
                                            {!isUnlimited && (
                                                <div className={styles.usageBarWrap}>
                                                    <div className={`${styles.usageBar} ${pct >= 80 ? styles.usageBarDanger : ''}`} style={{ width: `${Math.min(100, pct)}%` }}></div>
                                                </div>
                                            )}
                                            {isUnlimited && <span className={styles.unlimitedLabel}>무제한</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
