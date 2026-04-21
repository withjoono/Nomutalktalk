'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseFlow } from '@/context/CaseFlowContext';
import styles from './page.module.css';

export default function ReportPage() {
    const router = useRouter();
    const { state } = useCaseFlow();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // 페이지 제목 변경 및 인쇄 트리거
    const handlePrint = () => {
        const originalTitle = document.title;
        document.title = `사건_리포트_${new Date().toISOString().split('T')[0]}`;
        window.print();
        setTimeout(() => {
            document.title = originalTitle;
        }, 100);
    };

    if (!mounted) return null;

    if (!state.caseId) {
        return (
            <div className={styles.container}>
                <div style={{ textAlign: 'center', padding: '100px 0' }}>
                    <p>분석된 사건이 없습니다. 사건 입력 페이지로 이동합니다.</p>
                    <button className={`${styles.btn} ${styles.btnPrimary} ${styles.noPrint}`} onClick={() => router.push('/case-input')} style={{ marginTop: '20px' }}>
                        사건 입력으로 가기
                    </button>
                </div>
            </div>
        );
    }

    const { description, caseType, issueResult, lawResult, predictionResult, alternativesResult } = state;

    return (
        <div className={styles.container}>
            {/* 상단 액션 버튼 (인쇄 시 숨김) */}
            <div className={`${styles.actions} ${styles.noPrint}`}>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => router.back()}>
                    ← 뒤로 가기
                </button>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handlePrint}>
                    🖨️ PDF 리포트 저장
                </button>
            </div>

            {/* 리포트 헤더 */}
            <div className={styles.header}>
                <h1 className={styles.title}>노무톡 종합 분석 리포트</h1>
                <p className={styles.subtitle}>출력일: {new Date().toLocaleDateString('ko-KR')}</p>
            </div>

            {/* 1. 기본 정보 */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>📋 사건 기본 정보</h2>
                <div className={styles.card}>
                    <div style={{ marginBottom: '12px' }}>
                        <span className={styles.label}>사건 유형:</span>
                        <span>{caseType || '지정되지 않음'}</span>
                    </div>
                    <div>
                        <span className={styles.label}>사건 내용:</span>
                        <div className={styles.text} style={{ marginTop: '8px' }}>
                            {description || '입력된 내용이 없습니다.'}
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 핵심 쟁점 (issueResult) */}
            {issueResult && issueResult.issues && issueResult.issues.length > 0 && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>🔥 핵심 쟁점 분석</h2>
                    
                    {issueResult.overallAssessment && (
                         <div className={styles.card} style={{ marginBottom: '24px' }}>
                            <h3 className={styles.cardTitle}>📌 전체 요약</h3>
                            <p className={styles.text}>{issueResult.overallAssessment}</p>
                            {issueResult.overallWinRate !== null && issueResult.overallWinRate !== undefined && (
                                <p style={{ marginTop: '10px', fontWeight: 600 }}>
                                    종합 승소 가능성 (근로자 기준): <span style={{ color: '#3b82f6' }}>{issueResult.overallWinRate}%</span>
                                </p>
                            )}
                        </div>
                    )}

                    {issueResult.issues.map((issue, idx) => (
                        <div key={idx} className={styles.issueItem}>
                            <h3 className={styles.issueTitle}>{idx + 1}. {issue.title}</h3>
                            <p className={styles.issueDesc}>{issue.summary}</p>
                            
                            {/* 유사 판례 / 법령 매칭 (nodes 기반으로 찾기, 여기서는 Issue객체 내 precedents 활용) */}
                            {issue.precedents && issue.precedents.length > 0 && (
                                <div className={styles.lawList}>
                                    <strong>관련 판례 및 근거:</strong>
                                    <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                                        {issue.precedents.map((p, pIdx) => (
                                            <li key={pIdx} className={styles.lawItem}>
                                                <strong>{p.caseNumber}</strong>: {p.summary}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                             {/* 유리/불리 요소 */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                                {(issue.favorableFactors && issue.favorableFactors.length > 0) ? (
                                    <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                        <strong style={{ color: '#10b981', display: 'block', marginBottom: '8px' }}>✅ 유리한 요소</strong>
                                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem' }}>
                                            {issue.favorableFactors.map((f, i) => <li key={i}>{f}</li>)}
                                        </ul>
                                    </div>
                                ) : <div />}
                                {(issue.unfavorableFactors && issue.unfavorableFactors.length > 0) ? (
                                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                        <strong style={{ color: '#ef4444', display: 'block', marginBottom: '8px' }}>⚠️ 불리한 요소</strong>
                                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9rem' }}>
                                            {issue.unfavorableFactors.map((f, i) => <li key={i}>{f}</li>)}
                                        </ul>
                                    </div>
                                ) : <div />}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 페이지 브레이크 포인트 (필요시 반영) */}
            <div className={styles.pageBreak} />

            {/* 3. 관련 법령 전체 목록 (lawResult nodes) */}
            {lawResult && lawResult.nodes && lawResult.nodes.length > 0 && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>⚖️ 검토된 상세 법령 및 행정해석</h2>
                    <div className={styles.card}>
                        <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.8 }}>
                            {lawResult.nodes.filter(n => n.type === 'law' || n.type === 'interpretation').map((node, idx) => (
                                <li key={idx} style={{ marginBottom: '12px' }}>
                                    <strong>{node.label}</strong>
                                    {node.details && <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#4b5563', whiteSpace: 'pre-wrap' }}>{node.details}</p>}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* 4. 예상 결과 (predictionResult) */}
            {predictionResult && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>📈 예상 결과 (Prediction)</h2>
                    <div className={styles.predictionBox}>
                         <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                             <div className={styles.winRate}>{issueResult?.overallWinRate ?? '-'}%</div>
                             <p style={{ margin: 0, fontWeight: 600, color: '#374151' }}>가장 가능성 높은 결과: {predictionResult.mostLikely}</p>
                         </div>

                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                            <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                                <h4 style={{ margin: '0 0 8px', color: '#374151' }}>긍정적 시나리오 (Best Case)</h4>
                                <p style={{ margin: 0, fontSize: '0.95rem' }}>{predictionResult.bestCase}</p>
                            </div>
                            <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                                <h4 style={{ margin: '0 0 8px', color: '#374151' }}>부정적 시나리오 (Worst Case)</h4>
                                <p style={{ margin: 0, fontSize: '0.95rem' }}>{predictionResult.worstCase}</p>
                            </div>
                         </div>

                         {predictionResult.estimatedAmounts && predictionResult.estimatedAmounts.length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                                <h4 style={{ margin: '0 0 8px', color: '#374151' }}>예상 금전/청구 가치</h4>
                                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.95rem' }}>
                                    {predictionResult.estimatedAmounts.map((amt, i) => (
                                        <li key={i}><strong>{amt.item}</strong>: {amt.amount} ({amt.basis})</li>
                                    ))}
                                </ul>
                            </div>
                         )}

                         {predictionResult.actionPlan && predictionResult.actionPlan.length > 0 && (
                            <div>
                                <h4 style={{ margin: '0 0 8px', color: '#374151' }}>권장 액션 플랜</h4>
                                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.95rem' }}>
                                    {predictionResult.actionPlan.map((plan, i) => (
                                        <li key={i}>[{plan.priority}] {plan.action} - <span style={{ color: '#6b7280' }}>{plan.reason}</span></li>
                                    ))}
                                </ul>
                            </div>
                         )}
                    </div>
                </div>
            )}

            {/* 5. 해결 방법 (alternativesResult) */}
            {alternativesResult && alternativesResult.methods && alternativesResult.methods.length > 0 && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>💡 해결 대안 가이드</h2>
                    <div className={styles.card} style={{ background: 'rgba(59,130,246,0.03)' }}>
                        <h3 className={styles.cardTitle}>추천 해결 방안</h3>
                        <p className={styles.text}>{alternativesResult.recommendation}</p>
                    </div>

                    {alternativesResult.methods.map((method, idx) => (
                        <div key={idx} className={styles.card}>
                            <h3 className={styles.methodTitle}>{method.title} ({method.duration})</h3>
                            <p className={styles.text} style={{ marginBottom: '16px' }}>{method.description}</p>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <strong style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>장점</strong>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#4b5563' }}>
                                        {method.pros.map((pro, i) => <li key={i}>{pro}</li>)}
                                    </ul>
                                </div>
                                <div>
                                    <strong style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>단점/리스크</strong>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: '#4b5563' }}>
                                        {method.cons.map((con, i) => <li key={i}>{con}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 푸터 면책조항 */}
            <div style={{ marginTop: '50px', paddingTop: '20px', borderTop: '1px solid #e5e7eb', fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>
                <p>본 리포트는 인공지능에 의해 작성되었으며, 법적 효력을 갖지 않습니다. 실제 법적 조치를 취하기 전 반드시 전문가(노무사/변호사)의 상담을 받으시길 권장합니다.</p>
                <p>Generated by NomuTalk AI</p>
            </div>
        </div>
    );
}
