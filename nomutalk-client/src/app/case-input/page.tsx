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
import { getCaseTypesForUser } from '@/components/case/DomainSelector';
import styles from './page.module.css';



const STEP_LABELS = ['입력', '분석', '해결'];

export default function CaseInputPage() {
    const { state, startNewCase, loadCase, resetFlow, reanalyze, updateDescription, goToStep, appendAndRecheck, skipSufficiencyCheck } = useCaseFlow();
    const { user, userProfile, isBusinessUser } = useAuth();
    const [caseType, setCaseType] = useState('');
    const legalDomain = 'labor';
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

    // ── 충분성 체크 답변 상태 ──
    const [answers, setAnswers] = useState<Record<string, string>>({});

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
        setAnswers({});
        startNewCase(caseDescription.trim(), caseType || undefined, legalDomain);
    };

    const handleContinue = (caseId: string) => {
        setSelectedCaseId(null);
        loadCase(caseId);
    };

    // ── 충분성 답변 제출 ──
    const handleSubmitAnswers = () => {
        const answerTexts = Object.values(answers).filter(a => a.trim());
        if (answerTexts.length === 0) { alert('최소 하나의 질문에 답변해주세요.'); return; }
        const combined = state.sufficiencyQuestions
            .map(q => {
                const a = answers[q.id];
                return a?.trim() ? `Q: ${q.question}\nA: ${a.trim()}` : '';
            })
            .filter(Boolean)
            .join('\n\n');
        setAnswers({});
        appendAndRecheck(combined);
    };

    // ── 보충 자료 제출 ──
    const handleSupplementSubmit = async () => {
        if (!state.caseId || submitting) return;
        if (!supplementText.trim() && !supplementFile) { alert('보충 내용 또는 파일을 추가해주세요.'); return; }
        setSubmitting(true);
        setSubmitMsg(null);
        try {
            if (supplementText.trim()) {
                await addCaseUpdate(state.caseId, 'supplement', supplementText.trim());
            }
            if (supplementFile) {
                await uploadEvidence(state.caseId, supplementFile, '보충자료');
            }
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

    // ═══════ 충분성 체크 중 로딩 ═══════
    if (state.isCheckingSufficiency && !state.sufficiencyQuestions.length) {
        return (
            <div className={styles.container}>
                <div className="page-hero hero-indigo">
                    <h1>🔍 사건 정보 확인 중</h1>
                    <p>AI가 분석에 필요한 정보가 충분한지 확인하고 있습니다.</p>
                </div>
                <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                    <div style={{
                        width: 32, height: 32, margin: '0 auto 12px',
                        border: '3px solid var(--toss-border)', borderTopColor: '#3b82f6',
                        borderRadius: '50%', animation: 'spin 1s linear infinite',
                    }} />
                    <p style={{ fontSize: '0.92rem', color: 'var(--toss-text-secondary)' }}>
                        사건 내용을 검토하고 있습니다...
                    </p>
                </div>
            </div>
        );
    }

    // ═══════ 충분성 부족 → AI 질문 표시 ═══════
    if (state.caseId && state.sufficiencyQuestions.length > 0) {
        return (
            <div className={styles.container}>
                <div className="page-hero hero-amber">
                    <h1>❓ 추가 정보 필요</h1>
                    <p>더 정확한 분석을 위해 아래 질문에 답변해주세요.</p>
                </div>

                {/* AI 메시지 */}
                <div style={{
                    padding: '16px 18px', borderRadius: '14px', marginBottom: '16px',
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(239,68,68,0.06))',
                    border: '1px solid rgba(245,158,11,0.2)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>🤖</span>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--toss-text-primary)' }}>
                            AI 노무 전문가
                        </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--toss-text-secondary)', lineHeight: 1.7 }}>
                        {state.sufficiencyMessage}
                    </p>
                </div>

                {/* 현재 사건 내용 미리보기 */}
                <div style={{
                    padding: '12px 16px', borderRadius: '10px', marginBottom: '16px',
                    background: 'var(--toss-bg-secondary)', border: '1px solid var(--toss-border)',
                }}>
                    <p style={{ margin: '0 0 4px', fontSize: '0.76rem', fontWeight: 600, color: 'var(--toss-text-tertiary)' }}>
                        📝 입력하신 내용
                    </p>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--toss-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {state.description.length > 200 ? state.description.substring(0, 200) + '...' : state.description}
                    </p>
                </div>

                {/* AI 질문 카드 */}
                {state.sufficiencyQuestions.map((q, idx) => (
                    <div key={q.id} style={{
                        padding: '16px 18px', borderRadius: '14px', marginBottom: '12px',
                        background: 'var(--toss-bg-secondary)', border: '1px solid var(--toss-border)',
                    }}>
                        <p style={{ margin: '0 0 4px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--toss-text-primary)' }}>
                            Q{idx + 1}. {q.question}
                        </p>
                        {q.reason && (
                            <p style={{ margin: '0 0 8px', fontSize: '0.76rem', color: 'var(--toss-text-tertiary)' }}>
                                💡 {q.reason}
                            </p>
                        )}
                        <textarea
                            className={styles.textarea}
                            value={answers[q.id] || ''}
                            onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                            placeholder={q.placeholder}
                            rows={2}
                            style={{ minHeight: '60px' }}
                        />
                    </div>
                ))}

                {/* 버튼 */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button
                        className={styles.submitButton}
                        onClick={handleSubmitAnswers}
                        disabled={state.isCheckingSufficiency || Object.values(answers).every(a => !a.trim())}
                        style={{ flex: 2 }}
                    >
                        {state.isCheckingSufficiency ? '확인 중...' : '📤 답변 제출 → 분석 진행'}
                    </button>
                    <button
                        onClick={skipSufficiencyCheck}
                        style={{
                            flex: 1, padding: '12px', borderRadius: '12px',
                            border: '1px solid var(--toss-border)', background: 'var(--toss-bg-secondary)',
                            cursor: 'pointer', fontSize: '0.84rem', fontWeight: 500,
                            color: 'var(--toss-text-tertiary)', fontFamily: 'inherit',
                        }}
                    >
                        건너뛰기 →
                    </button>
                </div>

                <StepNav currentStep={0} />
            </div>
        );
    }

    // ═══════ 대시보드 뷰 (사건이 이미 로드된 경우) ═══════
    if (state.caseId) {
        const analysisCount = state.buildMeta?.analysisCount || 0;

        return (
            <div className={styles.container}>
                <div className={`page-hero ${isBusinessUser ? 'hero-emerald' : 'hero-indigo'}`}>
                    <h1>{isBusinessUser ? '🏢 사내 노무 사건' : '🩺 내 사건'}</h1>
                    <p>{isBusinessUser ? '사건을 보충하고 AI가 리스크를 재분석합니다.' : '사건을 보충하고 AI가 자동 재분석합니다.'}</p>
                </div>

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
                        <div className={styles.dashFileRow}>
                            <input ref={fileRef} type="file" className={styles.fileInput}
                                onChange={(e) => setSupplementFile(e.target.files?.[0] || null)}
                                accept="image/*,.pdf,.txt,.doc,.docx"
                            />
                            <button className={styles.uploadButton} onClick={() => fileRef.current?.click()}>
                                📎 파일 첨부
                            </button>
                            {supplementFile && <span className={styles.fileName}>{supplementFile.name}</span>}
                        </div>
                        <button className={styles.submitButton} onClick={handleSupplementSubmit}
                            disabled={submitting || (!supplementText.trim() && !supplementFile)}>
                            {submitting ? '제출 중...' : '📤 보충 자료 제출 + 재분석'}
                        </button>
                    </section>
                )}

                {activeSection === 'progress' && (
                    <section className={styles.section}>
                        <p className={styles.dashHint}>📋 사건 진행 경과를 기록하면 AI가 다음 행동을 제안합니다.</p>
                        <textarea className={styles.textarea} value={progressText}
                            onChange={(e) => setProgressText(e.target.value)}
                            placeholder={"진행 경과를 입력하세요.\n\n예시:\n- 노동청에 진정서를 접수했습니다\n- 사측 대리인에게서 연락이 왔습니다"}
                            rows={5} style={{ minHeight: '120px' }}
                        />
                        <button className={styles.submitButton} onClick={handleProgressSubmit}
                            disabled={submitting || !progressText.trim()}>
                            {submitting ? '기록 중...' : '📝 경과 기록'}
                        </button>
                    </section>
                )}

                {submitMsg && (
                    <p style={{
                        padding: '10px 14px', borderRadius: '10px', fontSize: '0.88rem',
                        background: submitMsg.startsWith('✅') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                        color: submitMsg.startsWith('✅') ? '#10b981' : '#ef4444', marginBottom: '12px',
                    }}>{submitMsg}</p>
                )}

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

                <button className={styles.newCaseLink}
                    onClick={() => { resetFlow(); setCaseDescription(''); setCaseType(''); }}>
                    ➕ 새 사건 시작하기
                </button>

                <StepNav currentStep={0} />
            </div>
        );
    }

    // ═══════ 입력 뷰 (새 사건 / 사건 미로드) ═══════
    return (
        <div className={styles.container} style={{ display: 'flex', flexDirection: 'column', minHeight: '80vh', justifyContent: 'center' }}>
            
            {/* ── 1. Hero & 메인 검색창 ── */}
            <div className={styles.heroInputContainer}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--toss-text-primary)', marginBottom: '12px' }}>
                        어떤 법률 도움이 필요하신가요?
                    </h1>
                    <p style={{ fontSize: '1rem', color: 'var(--toss-text-secondary)' }}>
                        채팅하듯 편하게 말씀해주세요. AI가 의도를 파악해 최적의 도움을 드립니다.
                    </p>
                </div>

                <div className={styles.mainSearchWrapper}>
                    <textarea 
                        className={styles.mainSearchInput}
                        value={caseDescription}
                        onChange={(e) => {
                            setCaseDescription(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleStart();
                            }
                        }}
                        placeholder="상황을 입력하세요 (예: 5일 전에 갑자기 해고 통보를 받았어요)"
                        rows={1}
                        autoFocus
                    />
                    <button 
                        className={`${styles.mainSearchButton} ${!caseDescription.trim() ? styles.mainSearchButtonDisabled : styles.mainSearchButtonActive}`}
                        onClick={handleStart}
                        disabled={!caseDescription.trim() || state.isAnalyzing}
                        style={{ cursor: state.isAnalyzing ? 'wait' : (!caseDescription.trim() ? 'default' : 'pointer') }}
                    >
                        {state.isAnalyzing ? <span className={styles.spinner} /> : '↑'}
                    </button>
                </div>
                {state.error && (
                    <div style={{ textAlign: 'center', marginTop: '12px' }}>
                        <p className={styles.errorText} style={{ margin: '0 0 12px' }}>⚠️ {state.error}</p>
                        {state.error.includes('한도를 초과') && (
                            <button
                                onClick={() => router.push('/pricing')}
                                style={{
                                    padding: '10px 20px', borderRadius: '12px', border: 'none',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: 'white', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                                    marginTop: '4px',
                                }}
                            >
                                ✨ 무제한 요금제로 전환하기
                            </button>
                        )}
                    </div>
                )}

                {/* ── 2. 추천 칩 (예시 해시태그) ── */}
                <div className={styles.suggestionChips}>
                    {[
                        '부당해고 당했어요', 
                        '연차수당 계산해줘', 
                        '계약직인데 퇴직금 받을 수 있나요?', 
                        '근로계약서 양식 필요해'
                    ].map((ex, i) => (
                        <button key={i} className={styles.suggestionChip} onClick={() => setCaseDescription(ex)}>
                            # {ex}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── 3. 이전 분석 내역 (간소화) ── */}
            {user && (
                <div style={{ marginTop: 'auto', paddingTop: '40px' }}>
                    <div style={{ maxWidth: '768px', margin: '0 auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 8px' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--toss-text-tertiary)', margin: 0 }}>
                                최근 분석 내역
                            </h3>
                            {pastCases.length > 5 && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--toss-blue)', cursor: 'pointer', fontWeight: 500 }}>
                                    전체 보기
                                </span>
                            )}
                        </div>

                        {loadingCases && <p className={styles.emptyMsg}>이력을 불러오는 중...</p>}
                        {!loadingCases && pastCases.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '24px', background: 'var(--toss-bg-secondary)', borderRadius: '16px', border: '1px dashed var(--toss-border)' }}>
                                <p style={{ fontSize: '0.85rem', color: 'var(--toss-text-tertiary)', margin: 0 }}>
                                    아직 분석한 사건이 없습니다. 첫 질문을 입력해 보세요.
                                </p>
                            </div>
                        )}
                        {pastCases.length > 0 && (
                            <div className={styles.compactCaseList}>
                                {pastCases.slice(0, 5).map(c => (
                                    <div key={c.id} className={styles.compactCaseItem} onClick={() => setSelectedCaseId(c.id)}>
                                        <div className={styles.compactCaseInfo}>
                                            <span className={styles.compactCaseDate}>{formatDate(c.createdAt)}</span>
                                            <span className={styles.compactCaseDesc}>
                                                {c.description}
                                            </span>
                                        </div>
                                        <div className={styles.compactCaseArrow}>→</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {selectedCaseId && (
                <CaseDetailPanel caseId={selectedCaseId}
                    onClose={() => setSelectedCaseId(null)} onContinue={handleContinue} />
            )}

            <StepNav currentStep={0} />
        </div>
    );
}
