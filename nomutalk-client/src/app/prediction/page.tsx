'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseFlow } from '@/context/CaseFlowContext';
import StepNav from '@/components/layout/StepNav';
import styles from './page.module.css';

function getWinRateColor(rate: number): string {
    if (rate >= 70) return '#3b82f6';
    if (rate >= 50) return '#10b981';
    if (rate >= 30) return '#f59e0b';
    return '#ef4444';
}

function getPriorityStyle(priority: string): { bg: string; color: string } {
    switch (priority) {
        case '즉시': return { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' };
        case '30일 이내': return { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' };
        case '병행': return { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' };
        default: return { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' };
    }
}

export default function PredictionPage() {
    const router = useRouter();
    const { state, goToStep } = useCaseFlow();

    useEffect(() => {
        if (!state.caseId) { router.push('/case-input'); return; }
        if (!state.issueResult) { router.push('/issue-analysis'); return; }
    }, [state.caseId, state.issueResult]);

    if (!state.caseId || !state.issueResult) return null;

    const { issueResult, predictionResult } = state;
    const overallRate = issueResult.overallWinRate ?? 50;
    const rateColor = getWinRateColor(overallRate);
    const prediction = predictionResult;

    return (
        <div className={styles.page}>
            <div className="page-hero hero-blue">
                <h1>📊 예상 결과</h1>
                <p>AI가 유사 판례와 법률을 분석하여 예상 결과를 제시합니다.</p>
            </div>

            {/* ═══ 종합 판정 ═══ */}
            <div className={styles.verdictCard}>
                <div className={styles.winRateCircle} style={{ borderColor: rateColor }}>
                    <span className={styles.winRateNumber} style={{ color: rateColor }}>
                        {overallRate}%
                    </span>
                    <span className={styles.winRateLabel}>승소 가능성</span>
                </div>
                <p className={styles.verdictText}>
                    {issueResult.overallAssessment || '사건을 종합적으로 분석하고 있습니다.'}
                </p>
            </div>

            {/* ═══ 시나리오: 최선/최악/가능성 높은 ═══ */}
            {prediction && (
                <div className={styles.scenarioSection}>
                    <div className={styles.scenarioCard} style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
                        <div className={styles.scenarioLabel} style={{ color: '#10b981' }}>
                            🏆 최선의 경우
                        </div>
                        <p className={styles.scenarioText}>{prediction.bestCase}</p>
                    </div>
                    <div className={styles.scenarioCard} style={{ borderColor: 'rgba(59,130,246,0.3)' }}>
                        <div className={styles.scenarioLabel} style={{ color: '#3b82f6' }}>
                            ⭐ 가장 가능성 높은 결과
                        </div>
                        <p className={styles.scenarioText}>{prediction.mostLikely}</p>
                    </div>
                    <div className={styles.scenarioCard} style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
                        <div className={styles.scenarioLabel} style={{ color: '#ef4444' }}>
                            ⚠️ 최악의 경우
                        </div>
                        <p className={styles.scenarioText}>{prediction.worstCase}</p>
                    </div>
                </div>
            )}

            {/* ═══ 쟁점별 승소 가능성 ═══ */}
            <div className={styles.issueSection}>
                <h2 className={styles.issueSectionTitle}>⚖️ 쟁점별 승소 가능성</h2>
                {issueResult.issues.map((issue, idx) => {
                    const rate = issue.winRate ?? 50;
                    const color = getWinRateColor(rate);
                    return (
                        <div key={idx} className={styles.issueCard}>
                            <div className={styles.issueHeader}>
                                <span className={styles.issueTitle}>{issue.title}</span>
                                <span className={styles.issueRate} style={{ color }}>
                                    {rate}%
                                </span>
                            </div>
                            {issue.winRateReason && (
                                <p className={styles.issueReason}>{issue.winRateReason}</p>
                            )}
                            <div className={styles.factorsRow}>
                                {(issue.favorableFactors || []).map((f, i) => (
                                    <span key={`pro-${i}`} className={`${styles.factorBadge} ${styles.factorPro}`}>
                                        ✅ {f}
                                    </span>
                                ))}
                                {(issue.unfavorableFactors || []).map((f, i) => (
                                    <span key={`con-${i}`} className={`${styles.factorBadge} ${styles.factorCon}`}>
                                        ⚠️ {f}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ═══ 예상 금액 ═══ */}
            {prediction && prediction.estimatedAmounts?.length > 0 && (
                <div className={styles.amountSection}>
                    <h2 className={styles.issueSectionTitle}>💰 예상 금전적 결과</h2>
                    {prediction.estimatedAmounts.map((amt, idx) => (
                        <div key={idx} className={styles.amountCard}>
                            <div className={styles.amountLeft}>
                                <span className={styles.amountItem}>{amt.item}</span>
                                <span className={styles.amountBasis}>{amt.basis}</span>
                            </div>
                            <span className={styles.amountValue}>{amt.amount}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ═══ 예상 소요기간 ═══ */}
            {prediction && prediction.timeline && (
                <div className={styles.timelineSection}>
                    <h2 className={styles.issueSectionTitle}>⏰ 예상 소요기간</h2>
                    <div className={styles.timelineGrid}>
                        <div className={styles.timelineCard}>
                            <div className={styles.timelineIcon}>🏛️</div>
                            <div className={styles.timelineLabel}>노동위원회</div>
                            <div className={styles.timelineDuration}>{prediction.timeline.laborCommission}</div>
                        </div>
                        <div className={styles.timelineCard}>
                            <div className={styles.timelineIcon}>⚖️</div>
                            <div className={styles.timelineLabel}>소송</div>
                            <div className={styles.timelineDuration}>{prediction.timeline.lawsuit}</div>
                        </div>
                        <div className={styles.timelineCard}>
                            <div className={styles.timelineIcon}>🤝</div>
                            <div className={styles.timelineLabel}>합의</div>
                            <div className={styles.timelineDuration}>{prediction.timeline.settlement}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ 행동 계획 ═══ */}
            {prediction && prediction.actionPlan?.length > 0 && (
                <div className={styles.actionSection}>
                    <h2 className={styles.issueSectionTitle}>📋 행동 계획</h2>
                    {prediction.actionPlan.map((action, idx) => {
                        const ps = getPriorityStyle(action.priority);
                        return (
                            <div key={idx} className={styles.actionCard}>
                                <span
                                    className={styles.actionPriority}
                                    style={{ background: ps.bg, color: ps.color }}
                                >
                                    {action.priority}
                                </span>
                                <div className={styles.actionBody}>
                                    <p className={styles.actionText}>{action.action}</p>
                                    <p className={styles.actionReason}>{action.reason}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ═══ 리스크 요인 ═══ */}
            {prediction && prediction.riskFactors?.length > 0 && (
                <div className={styles.riskSection}>
                    <h2 className={styles.issueSectionTitle}>🚨 리스크 요인</h2>
                    {prediction.riskFactors.map((risk, idx) => (
                        <div key={idx} className={styles.riskItem}>
                            ⚠️ {risk}
                        </div>
                    ))}
                </div>
            )}

            {/* ═══ 면책 조항 ═══ */}
            <div className={styles.disclaimer}>
                ⚠️ <strong>주의사항</strong>: 본 분석은 AI가 유사 판례와 법령을 참고하여 추정한 것이며, 
                실제 결과와 다를 수 있습니다. 정확한 판단은 전문 노무사 또는 변호사와 상담하시기 바랍니다.
                예상 금액은 참고용이며 개별 사건의 특수성에 따라 달라질 수 있습니다.
            </div>

            {/* ═══ 없을 때 (prediction 데이터 없을 경우) ═══ */}
            {!prediction && (
                <div className={styles.loadingSection}>
                    <p style={{ fontSize: '0.88rem', color: 'var(--toss-text-tertiary)' }}>
                        예상 결과 데이터가 아직 생성되지 않았습니다.
                    </p>
                    <button
                        onClick={() => goToStep(1)}
                        style={{
                            marginTop: '12px', padding: '10px 20px', borderRadius: '10px',
                            border: 'none', background: '#3b82f6', color: '#fff',
                            cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600,
                        }}
                    >
                        ← 쟁점 분석으로 돌아가기
                    </button>
                </div>
            )}

            <StepNav currentStep={3} />
        </div>
    );
}
