'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseFlow } from '@/context/CaseFlowContext';
import StepNav from '@/components/layout/StepNav';
import { AlternativeMethod } from '@/lib/api';
import styles from './page.module.css';

function getSuccessRateColor(rate: number): string {
    if (rate >= 70) return '#3b82f6';
    if (rate >= 50) return '#10b981';
    if (rate >= 30) return '#f59e0b';
    return '#ef4444';
}

export default function AlternativesPage() {
    const router = useRouter();
    const { state, runAlternativesAnalysis, setSelectedMethod, goToStep } = useCaseFlow();
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        if (!state.caseId) { router.push('/case-input'); return; }
        if (!state.issueResult) { router.push('/issue-analysis'); return; }
        if (!state.alternativesResult && !state.isAnalyzing) {
            runAlternativesAnalysis();
        }
    }, [state.caseId, state.issueResult]);

    const handleSelectMethod = (method: AlternativeMethod) => {
        setSelectedMethod(method);
        goToStep(4); // → 후속 지원
    };

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedId(prev => prev === id ? null : id);
    };

    if (!state.caseId) return null;

    const result = state.alternativesResult;

    return (
        <div className={styles.page}>
            <h1 className={styles.title}>💡 대안 제안</h1>
            <p className={styles.subtitle}>
                사건에 적합한 해결 방법을 비교하고, 진행할 방법을 선택하세요.
            </p>

            {/* ═══ 로딩 ═══ */}
            {state.isAnalyzing && !result && (
                <div className={styles.loadingSection}>
                    <div className={styles.spinner} />
                    <p style={{ fontSize: '0.92rem', color: 'var(--toss-text-secondary)' }}>
                        사건에 적합한 해결 방법을 분석하고 있습니다...
                    </p>
                </div>
            )}

            {/* ═══ 에러 ═══ */}
            {state.error && !result && !state.isAnalyzing && (
                <div>
                    <div className={styles.errorMsg}>⚠️ {state.error}</div>
                    <button className={styles.retryBtn} onClick={runAlternativesAnalysis}>
                        🔄 다시 시도
                    </button>
                </div>
            )}

            {/* ═══ 결과 ═══ */}
            {result && (
                <>
                    {/* 권장 요약 */}
                    <div className={styles.recommendationCard}>
                        <p className={styles.recommendationTitle}>🎯 AI 권장</p>
                        <p className={styles.recommendationText}>{result.recommendation}</p>
                    </div>

                    {/* 비교 카드 리스트 */}
                    <div className={styles.methodsGrid}>
                        {result.methods
                            .sort((a, b) => (b.isRecommended ? 1 : 0) - (a.isRecommended ? 1 : 0))
                            .map(method => {
                                const isExpanded = expandedId === method.id;
                                const isSelected = state.selectedMethod?.id === method.id;
                                const rateColor = getSuccessRateColor(method.successRate);

                                return (
                                    <div
                                        key={method.id}
                                        className={`${styles.methodCard} ${method.isRecommended ? styles.recommended : ''} ${isSelected ? styles.selected : ''}`}
                                    >
                                        {/* 헤더 */}
                                        <div className={styles.methodHeader}>
                                            <div className={styles.methodIcon}>{method.icon}</div>
                                            <div>
                                                <div className={styles.methodName}>{method.name}</div>
                                                <div className={styles.methodDesc}>{method.description}</div>
                                            </div>
                                        </div>

                                        {/* 메트릭 */}
                                        <div className={styles.metricsRow}>
                                            <div className={styles.metric}>
                                                <span className={styles.metricLabel}>⏱ 소요시간</span>
                                                <span className={styles.metricValue}>{method.timeframe}</span>
                                            </div>
                                            <div className={styles.metric}>
                                                <span className={styles.metricLabel}>💰 비용</span>
                                                <span className={styles.metricValue}>{method.cost}</span>
                                            </div>
                                            <div className={styles.metric}>
                                                <span className={styles.metricLabel}>📊 성공률</span>
                                                <span className={styles.metricValue} style={{ color: rateColor }}>
                                                    {method.successRate}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* 성공률 바 */}
                                        <div className={styles.successRateBar}>
                                            <div
                                                className={styles.successRateFill}
                                                style={{ width: `${method.successRate}%`, background: rateColor }}
                                            />
                                        </div>

                                        {/* 장단점 */}
                                        <div className={styles.prosConsRow}>
                                            <div>
                                                {method.pros.slice(0, 2).map((p, i) => (
                                                    <div key={i} className={styles.proItem}>✅ {p}</div>
                                                ))}
                                            </div>
                                            <div>
                                                {method.cons.slice(0, 2).map((c, i) => (
                                                    <div key={i} className={styles.conItem}>⚠️ {c}</div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 상세 보기 + 선택 */}
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                                            {method.procedure && method.procedure.length > 0 && (
                                                <button
                                                    onClick={(e) => toggleExpand(method.id, e)}
                                                    style={{
                                                        flex: 1, padding: '10px', borderRadius: '10px',
                                                        border: '1px solid var(--toss-border)', background: 'var(--toss-bg-secondary)',
                                                        cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
                                                        color: 'var(--toss-text-secondary)', fontFamily: 'inherit',
                                                    }}
                                                >
                                                    {isExpanded ? '▲ 접기' : '📋 절차 보기'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleSelectMethod(method)}
                                                style={{
                                                    flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                                                    background: method.isRecommended
                                                        ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                                                        : '#3b82f6',
                                                    color: '#fff', cursor: 'pointer', fontSize: '0.85rem',
                                                    fontWeight: 700, fontFamily: 'inherit',
                                                }}
                                            >
                                                🔗 이 방법으로 진행
                                            </button>
                                        </div>

                                        {/* 절차 상세 */}
                                        {isExpanded && method.procedure && (
                                            <div className={styles.procedureSection}>
                                                <p className={styles.procedureTitle}>📋 진행 절차</p>
                                                <ol className={styles.procedureList}>
                                                    {method.procedure.map((step, i) => (
                                                        <li key={i} className={styles.procedureStep}>{step}</li>
                                                    ))}
                                                </ol>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>

                    {/* AI 분석 근거 */}
                    {result.reasoning && (
                        <details style={{
                            marginBottom: '20px', padding: '14px 18px',
                            background: 'var(--toss-bg-secondary)', borderRadius: 'var(--toss-radius-md)',
                            border: '1px solid var(--toss-border)',
                        }}>
                            <summary style={{
                                cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600,
                                color: 'var(--toss-text-secondary)',
                            }}>
                                🧠 AI 분석 근거
                            </summary>
                            <p style={{
                                margin: '10px 0 0', fontSize: '0.85rem',
                                color: 'var(--toss-text-tertiary)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                            }}>
                                {result.reasoning}
                            </p>
                        </details>
                    )}
                </>
            )}

            <StepNav currentStep={3} />
        </div>
    );
}
