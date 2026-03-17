'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCaseFlow } from '@/context/CaseFlowContext';
import { useAuth } from '@/context/AuthContext';
import {
    listCases, CaseRecord, addCaseUpdate, uploadEvidence, CaseUpdate,
    CaseEvidence, TimelineEvent,
} from '@/lib/api';
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

const STEP_LABELS = ['입력', '쟁점', '법령', '대안', '후속'];

export default function CaseInputPage() {
    const { state, startNewCase, loadCase, resetFlow, reanalyze, updateDescription, goToStep } = useCaseFlow();
    const { user } = useAuth();
    const [caseType, setCaseType] = useState('');
    const [caseDescription, setCaseDescription] = useState('');
    const [pastCases, setPastCases] = useState<CaseRecord[]>([]);
    const [loadingCases, setLoadingCases] = useState(false);
    const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

    // ── 대시보드 상태 ──
    const [supplementText, setSupplementText] = useState('');
    const [progressText, setProgressText] = useState('');
    const [supplementFile, setSupplementFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitMsg, setSubmitMsg] = useState<string | null>(null);
    const [activeSection, setActiveSection] = useState<'supplement' | 'progress'>('supplement');
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!user) return;
        setLoadingCases(true);
        listCases()
            .then(cases => setPastCases(cases))
            .catch(err => console.error('사건 목록 로드 실패:', err))
            .finally(() => setLoadingCases(false));
    }, [user]);

    const handleStart = () => {
        if (!caseDescription.trim()) { alert('사건 내용을 입력해주세요.'); return; }
        if (!user) { alert('로그인 후 진행 가능합니다.'); return; }
        resetFlow();
        startNewCase(caseDescription.trim(), caseType || undefined);
    };

    const handleContinue = (caseId: string) => {
        setSelectedCaseId(null);
        loadCase(caseId);
    };

    // ── 보충 자료 제출 ──
    const handleSupplementSubmit = async () => {
        if (!state.caseId || submitting) return;
        if (!supplementText.trim() && !supplementFile) { alert('보충 내용 또는 파일을 추가해주세요.'); return; }
        setSubmitting(true);
        setSubmitMsg(null);
        try {
            // 텍스트 보충
            if (supplementText.trim()) {
                await addCaseUpdate(state.caseId, 'supplement', supplementText.trim());
            }
            // 파일 업로드
            if (supplementFile) {
                await uploadEvidence(state.caseId, supplementFile, '보충자료');
            }
            // 자동 재분석 트리거
            if (state.issueResult) {
                await reanalyze('issueAnalysis', 'evidence_added');
            }
            setSupplementText('');
            setSupplementFile(null);
            if (fileRef.current) fileRef.current.value = '';
            setSubmitMsg('✅ 보충 정보가 추가되었습니다. 쟁점이 재분석됩니다.');
        } catch (err: any) {
            setSubmitMsg(`⚠️ ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    // ── 경과 기록 제출 ──
    const handleProgressSubmit = async () => {
        if (!state.caseId || submitting || !progressText.trim()) return;
        setSubmitting(true);
        setSubmitMsg(null);
        try {
            await addCaseUpdate(state.caseId, 'progress', progressText.trim());
            setProgressText('');
            setSubmitMsg('✅ 경과가 기록되었습니다.');
        } catch (err: any) {
            setSubmitMsg(`⚠️ ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
        } catch { return ''; }
    };

    // ═══════ 대시보드 뷰 (사건이 이미 로드된 경우) ═══════
    if (state.caseId) {
        const hasAnalysis = !!state.issueResult;
        const analysisCount = state.buildMeta?.analysisCount || 0;

        return (
            <div className={styles.container}>
                <h1>🩺 내 사건</h1>

                {/* ── 사건 요약 카드 ── */}
                <div className={styles.dashboardCard}>
                    <div className={styles.dashCardHeader}>
                        <span className={styles.dashBadge}>{state.caseType || '일반'}</span>
                        <div className={styles.dashMeta}>
                            {analysisCount > 0 && <span>🔄 분석 {analysisCount}회</span>}
                            {state.buildMeta?.evidenceCount > 0 && <span>📎 증거 {state.buildMeta.evidenceCount}건</span>}
                        </div>
                    </div>
                    <p className={styles.dashDesc}>{state.description}</p>

                    {/* 분석 상태 뱃지 */}
                    <div className={styles.dashStatusRow}>
                        {STEP_LABELS.map((label, i) => (
                            <button
                                key={i}
                                className={`${styles.dashStepBtn} ${i <= state.currentStep ? styles.dashStepDone : ''}`}
                                onClick={() => { if (i <= state.currentStep) goToStep(i); }}
                                disabled={i > state.currentStep}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── 보충/경과 탭 ── */}
                <div className={styles.dashTabs}>
                    <button
                        className={`${styles.dashTab} ${activeSection === 'supplement' ? styles.dashTabActive : ''}`}
                        onClick={() => setActiveSection('supplement')}
                    >
                        📎 빠진 내용 추가
                    </button>
                    <button
                        className={`${styles.dashTab} ${activeSection === 'progress' ? styles.dashTabActive : ''}`}
                        onClick={() => setActiveSection('progress')}
                    >
                        📝 경과 기록
                    </button>
                </div>

                {/* ── 보충 자료 섹션 ── */}
                {activeSection === 'supplement' && (
                    <section className={styles.section}>
                        <p className={styles.dashHint}>
                            💡 빠진 정보를 추가하면 AI가 쟁점을 자동 재분석합니다.
                        </p>
                        <textarea
                            className={styles.textarea}
                            value={supplementText}
                            onChange={(e) => setSupplementText(e.target.value)}
                            placeholder={"추가할 정보를 입력하세요.\n\n예시:\n- 사업장 규모는 30인입니다\n- 계약직이고 근무 기간은 2년입니다\n- 연장근로 수당이 월 30시간 미지급입니다"}
                            rows={5}
                            style={{ minHeight: '120px' }}
                        />

                        {/* 파일 첨부 */}
                        <div className={styles.dashFileRow}>
                            <input
                                ref={fileRef}
                                type="file"
                                className={styles.fileInput}
                                onChange={(e) => setSupplementFile(e.target.files?.[0] || null)}
                                accept="image/*,.pdf,.txt,.doc,.docx"
                            />
                            <button
                                className={styles.uploadButton}
                                onClick={() => fileRef.current?.click()}
                            >
                                📎 파일 첨부
                            </button>
                            {supplementFile && (
                                <span className={styles.fileName}>{supplementFile.name}</span>
                            )}
                        </div>

                        <button
                            className={styles.submitButton}
                            onClick={handleSupplementSubmit}
                            disabled={submitting || (!supplementText.trim() && !supplementFile)}
                        >
                            {submitting ? '제출 중...' : '📤 보충 자료 제출 + 재분석'}
                        </button>
                    </section>
                )}

                {/* ── 경과 기록 섹션 ── */}
                {activeSection === 'progress' && (
                    <section className={styles.section}>
                        <p className={styles.dashHint}>
                            📋 사건 진행 경과를 기록하면 AI가 다음 행동을 제안합니다.
                        </p>
                        <textarea
                            className={styles.textarea}
                            value={progressText}
                            onChange={(e) => setProgressText(e.target.value)}
                            placeholder={"진행 경과를 입력하세요.\n\n예시:\n- 노동청에 진정서를 접수했습니다\n- 사측 대리인에게서 연락이 왔습니다\n- 근로감독관 면담을 완료했습니다"}
                            rows={5}
                            style={{ minHeight: '120px' }}
                        />
                        <button
                            className={styles.submitButton}
                            onClick={handleProgressSubmit}
                            disabled={submitting || !progressText.trim()}
                        >
                            {submitting ? '기록 중...' : '📝 경과 기록'}
                        </button>
                    </section>
                )}

                {/* ── 제출 결과 메시지 ── */}
                {submitMsg && (
                    <p style={{
                        padding: '10px 14px', borderRadius: '10px', fontSize: '0.88rem',
                        background: submitMsg.startsWith('✅') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        color: submitMsg.startsWith('✅') ? '#10b981' : '#ef4444',
                        marginBottom: '12px',
                    }}>
                        {submitMsg}
                    </p>
                )}

                {/* ── 사건 히스토리 타임라인 ── */}
                {state.timeline && state.timeline.length > 0 && (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>🕐 사건 히스토리</h2>
                        <div className={styles.historyList}>
                            {state.timeline.slice().reverse().slice(0, 10).map((ev: TimelineEvent, i: number) => (
                                <div key={i} className={styles.historyItem}>
                                    <div className={styles.historyDot} data-type={ev.type} />
                                    <div className={styles.historyContent}>
                                        <span className={styles.historyTime}>{formatDate(ev.timestamp)}</span>
                                        <span className={styles.historyDetail}>{ev.detail}</span>
                                        {ev.trigger && <span className={styles.historyTrigger}>{ev.trigger}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── 새 사건 시작 링크 ── */}
                <button
                    className={styles.newCaseLink}
                    onClick={() => { resetFlow(); setCaseDescription(''); setCaseType(''); }}
                >
                    ➕ 새 사건 시작하기
                </button>

                <StepNav currentStep={0} />
            </div>
        );
    }

    // ═══════ 입력 뷰 (새 사건 / 사건 미로드) ═══════
    return (
        <div className={styles.container}>
            <h1>🩺 내 사건</h1>
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
                    <select className={styles.select} value={caseType} onChange={(e) => setCaseType(e.target.value)}>
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
