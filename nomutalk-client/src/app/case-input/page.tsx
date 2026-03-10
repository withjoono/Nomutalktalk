'use client';

import React, { useState, useEffect } from 'react';
import { useCaseFlow } from '@/context/CaseFlowContext';
import { useAuth } from '@/context/AuthContext';
import { listCases, CaseRecord } from '@/lib/api';
import StepNav from '@/components/layout/StepNav';
import CaseDetailPanel from '@/components/case/CaseDetailPanel';
import styles from './page.module.css';

const CASE_TYPES = [
    { value: '', label: '사건 유형 선택 (선택사항)' },
    { value: '부당해고', label: '⚠️ 부당해고' },
    { value: '임금체불', label: '💰 임금체불' },
    { value: '산업재해', label: '🏥 산업재해' },
    { value: '근로시간', label: '⏰ 근로시간/초과근무' },
    { value: '직장내괴롭힘', label: '😤 직장 내 괴롭힘' },
    { value: '퇴직금', label: '📋 퇴직금' },
    { value: '차별', label: '🚫 차별/성희롱' },
    { value: '기타', label: '📌 기타' },
];

const STEP_LABELS = ['입력', '쟁점', '법령', '상담'];

export default function CaseInputPage() {
    const { state, startNewCase, loadCase, resetFlow } = useCaseFlow();
    const { user } = useAuth();
    const [caseType, setCaseType] = useState('');
    const [caseDescription, setCaseDescription] = useState('');
    const [pastCases, setPastCases] = useState<CaseRecord[]>([]);
    const [loadingCases, setLoadingCases] = useState(false);
    const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        setLoadingCases(true);
        listCases()
            .then(cases => setPastCases(cases))
            .catch(err => console.error('사건 목록 로드 실패:', err))
            .finally(() => setLoadingCases(false));
    }, [user]);

    const handleStart = () => {
        if (!caseDescription.trim()) {
            alert('사건 내용을 입력해주세요.');
            return;
        }
        resetFlow();
        startNewCase(caseDescription.trim(), caseType || undefined);
    };

    const handleContinue = (caseId: string) => {
        setSelectedCaseId(null);
        loadCase(caseId);
    };

    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
        } catch { return ''; }
    };

    return (
        <div className={styles.container}>
            <h1>📂 내 사건</h1>
            <p className={styles.description}>
                새 사건을 입력하거나, 이전 분석 내역을 클릭해 상세 이력을 확인하세요.
            </p>

            {/* ═══ 섹션 1: 이전 사건 목록 ═══ */}
            {user && (
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>📋 이전 분석 내역</h2>

                    {loadingCases && <p className={styles.status}>불러오는 중...</p>}

                    {!loadingCases && pastCases.length === 0 && (
                        <p className={styles.emptyMsg}>아직 분석한 사건이 없습니다.</p>
                    )}

                    {pastCases.length > 0 && (
                        <div className={styles.caseList}>
                            {pastCases.map(c => (
                                <div
                                    key={c.id}
                                    className={styles.caseCard}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setSelectedCaseId(c.id)}
                                >
                                    <div className={styles.caseCardTop}>
                                        <span className={styles.caseType}>{c.caseType || '일반'}</span>
                                        <span className={styles.caseDate}>{formatDate(c.createdAt)}</span>
                                    </div>
                                    <p className={styles.caseDesc}>
                                        {c.description.length > 80 ? c.description.substring(0, 80) + '...' : c.description}
                                    </p>
                                    <div className={styles.caseSteps}>
                                        {STEP_LABELS.map((label, i) => (
                                            <span
                                                key={i}
                                                className={`${styles.stepBadge} ${i <= c.currentStep ? styles.stepDone : ''}`}
                                            >
                                                {label}
                                            </span>
                                        ))}
                                    </div>
                                    {/* 빌드 메타 요약 */}
                                    {c.buildMeta && (c.buildMeta.analysisCount > 0 || c.buildMeta.insightCount > 0) && (
                                        <div style={{
                                            display: 'flex', gap: '8px', alignItems: 'center',
                                            marginTop: '8px', paddingTop: '8px',
                                            borderTop: '1px solid var(--toss-border)',
                                            fontSize: '0.72rem', color: 'var(--toss-text-tertiary)',
                                        }}>
                                            {c.buildMeta.analysisCount > 0 && <span>🔄 분석 {c.buildMeta.analysisCount}회</span>}
                                            {c.buildMeta.insightCount > 0 && <span>💡 인사이트 {c.buildMeta.insightCount}건</span>}
                                            <span style={{ marginLeft: 'auto', color: '#3b82f6', fontWeight: 600 }}>상세 보기 →</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* ═══ 사건 상세 패널 ═══ */}
            {selectedCaseId && (
                <CaseDetailPanel
                    caseId={selectedCaseId}
                    onClose={() => setSelectedCaseId(null)}
                    onContinue={handleContinue}
                />
            )}

            {/* ═══ 섹션 2: 새 사건 입력 ═══ */}
            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>✏️ 새 사건 입력</h2>

                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>사건 유형</label>
                    <select
                        className={styles.select}
                        value={caseType}
                        onChange={(e) => setCaseType(e.target.value)}
                    >
                        {CASE_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>

                <div className={styles.formGroup}>
                    <label className={styles.formLabel}>사건 내용 <span className={styles.required}>*</span></label>
                    <textarea
                        className={styles.textarea}
                        value={caseDescription}
                        onChange={(e) => setCaseDescription(e.target.value)}
                        placeholder={"사건 내용을 상세히 작성해주세요.\n\n예시:\n- 근무 기간, 사업장 규모\n- 어떤 일이 발생했는지\n- 현재 상황 및 원하는 결과"}
                        rows={8}
                    />
                    <span className={styles.charCount}>{caseDescription.length}자</span>
                </div>

                <button
                    className={styles.submitButton}
                    onClick={handleStart}
                    disabled={!caseDescription.trim() || state.isAnalyzing}
                >
                    {state.isAnalyzing ? '사건 등록 중...' : '🔥 분석 시작 → 핵심 쟁점으로'}
                </button>

                {state.error && <p className={styles.errorText}>⚠️ {state.error}</p>}
            </section>

            <StepNav currentStep={0} />
        </div>
    );
}
