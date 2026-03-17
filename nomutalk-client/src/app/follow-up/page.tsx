'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseFlow } from '@/context/CaseFlowContext';
import StepNav from '@/components/layout/StepNav';
import {
    DocumentType, GeneratedDocument, generateLegalDocument,
    ChecklistItem, fetchChecklist,
    TimelineStep, fetchTimeline,
    addCaseUpdate, TimelineEvent,
} from '@/lib/api';
import styles from './page.module.css';

type Tab = 'document' | 'checklist' | 'timeline' | 'progress';

const DOC_TYPES: { type: DocumentType; icon: string; name: string }[] = [
    { type: 'complaint', icon: '📝', name: '진정서' },
    { type: 'response', icon: '🛡️', name: '답변서' },
    { type: 'objection', icon: '⚠️', name: '이의신청서' },
    { type: 'appeal', icon: '📋', name: '재심신청서' },
    { type: 'evidence', icon: '📎', name: '증거설명서' },
];

const STORAGE_KEY_PREFIX = 'nomutalk_checklist_';

export default function FollowUpPage() {
    const router = useRouter();
    const { state, goToStep } = useCaseFlow();
    const [activeTab, setActiveTab] = useState<Tab>('document');

    // ─── 서면 생성 상태 ───
    const [selectedDocType, setSelectedDocType] = useState<DocumentType>('complaint');
    const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(null);
    const [generating, setGenerating] = useState(false);
    const [genError, setGenError] = useState<string | null>(null);

    // ─── 체크리스트 상태 ───
    const [checkItems, setCheckItems] = useState<ChecklistItem[]>([]);
    const [checkLoading, setCheckLoading] = useState(false);
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

    // ─── 타임라인 상태 ───
    const [timelineSteps, setTimelineSteps] = useState<TimelineStep[]>([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [statuteLimit, setStatuteLimit] = useState<string | null>(null);

    // ─── 경과 기록 상태 ───
    const [progressText, setProgressText] = useState('');
    const [progressSubmitting, setProgressSubmitting] = useState(false);
    const [progressMsg, setProgressMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!state.caseId) { router.push('/case-input'); return; }
        if (!state.issueResult) { router.push('/issue-analysis'); return; }
    }, [state.caseId, state.issueResult, router]);

    // 체크 상태 localStorage 로드
    useEffect(() => {
        if (!state.caseId) return;
        const stored = localStorage.getItem(STORAGE_KEY_PREFIX + state.caseId);
        if (stored) setCheckedIds(new Set(JSON.parse(stored)));
    }, [state.caseId]);

    const resolution = state.selectedMethod?.name || '노동청 진정';

    // ─── 서면 생성 ───
    const handleGenerate = async () => {
        if (!state.caseId || generating) return;
        setGenerating(true);
        setGenError(null);
        try {
            const doc = await generateLegalDocument(state.description, selectedDocType, {
                caseType: state.caseType || '',
                resolution: resolution,
                issues: state.issueResult?.issues.map(i => i.title).join(', ') || '',
            });
            setGeneratedDoc(doc);
        } catch (err: any) {
            setGenError(err.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!generatedDoc) return;
        const blob = new Blob([generatedDoc.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${generatedDoc.documentTypeName}_${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ─── 체크리스트 로드 ───
    const loadChecklist = useCallback(async () => {
        if (!state.caseId || checkItems.length > 0 || checkLoading) return;
        setCheckLoading(true);
        try {
            const result = await fetchChecklist(state.caseId, resolution, state.caseType);
            setCheckItems(result.items);
        } catch (err: any) {
            console.error('체크리스트 로드 실패:', err);
        } finally {
            setCheckLoading(false);
        }
    }, [state.caseId, resolution, state.caseType, checkItems.length, checkLoading]);

    const toggleCheck = (id: string) => {
        setCheckedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            if (state.caseId) localStorage.setItem(STORAGE_KEY_PREFIX + state.caseId, JSON.stringify([...next]));
            return next;
        });
    };

    // ─── 타임라인 로드 ───
    const loadTimeline = useCallback(async () => {
        if (!state.caseId || timelineSteps.length > 0 || timelineLoading) return;
        setTimelineLoading(true);
        try {
            const result = await fetchTimeline(state.caseId, resolution, state.caseType);
            setTimelineSteps(result.steps);
            setStatuteLimit(result.statute_of_limitations || null);
        } catch (err: any) {
            console.error('타임라인 로드 실패:', err);
        } finally {
            setTimelineLoading(false);
        }
    }, [state.caseId, resolution, state.caseType, timelineSteps.length, timelineLoading]);

    // 탭 전환 시 데이터 로드
    useEffect(() => {
        if (activeTab === 'checklist') loadChecklist();
        if (activeTab === 'timeline') loadTimeline();
    }, [activeTab, loadChecklist, loadTimeline]);

    if (!state.caseId) return null;

    const checkedCount = checkItems.filter(i => checkedIds.has(i.id)).length;
    const checkPercent = checkItems.length > 0 ? Math.round((checkedCount / checkItems.length) * 100) : 0;

    // 체크리스트 카테고리 그룹핑
    const checkCategories = checkItems.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
        const cat = item.category || '기타';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    return (
        <div className={styles.page}>
            <div className="page-hero hero-violet">
                <h1>🔗 후속 지원</h1>
                <p>서면 생성, 준비물 체크리스트, 진행 타임라인을 확인하세요.</p>
            </div>

            {/* 선택된 해결 방법 배너 */}
            {state.selectedMethod && (
                <div className={styles.selectedBanner}>
                    <div className={styles.selectedIcon}>{state.selectedMethod.icon}</div>
                    <div className={styles.selectedInfo}>
                        <div className={styles.selectedLabel}>선택된 해결 방법</div>
                        <div className={styles.selectedName}>{state.selectedMethod.name}</div>
                    </div>
                    <button
                        onClick={() => goToStep(3)}
                        style={{
                            padding: '6px 12px', borderRadius: '8px',
                            border: '1px solid var(--toss-border)', background: 'transparent',
                            cursor: 'pointer', fontSize: '0.78rem', color: 'var(--toss-text-tertiary)',
                            fontFamily: 'inherit',
                        }}
                    >
                        변경
                    </button>
                </div>
            )}

            {/* 탭 */}
            <div className={styles.tabs}>
                {[
                    { key: 'document' as Tab, label: '📝 서면 생성' },
                    { key: 'checklist' as Tab, label: '📋 체크리스트' },
                    { key: 'timeline' as Tab, label: '🔔 타임라인' },
                    { key: 'progress' as Tab, label: '📌 경과 기록' },
                ].map(t => (
                    <button
                        key={t.key}
                        className={`${styles.tab} ${activeTab === t.key ? styles.active : ''}`}
                        onClick={() => setActiveTab(t.key)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ═══ 서면 생성 탭 ═══ */}
            {activeTab === 'document' && (
                <div>
                    <div className={styles.docTypeGrid}>
                        {DOC_TYPES.map(dt => (
                            <button
                                key={dt.type}
                                className={`${styles.docTypeCard} ${selectedDocType === dt.type ? styles.selectedDoc : ''}`}
                                onClick={() => { setSelectedDocType(dt.type); setGeneratedDoc(null); }}
                            >
                                <span className={styles.docTypeIcon}>{dt.icon}</span>
                                <span className={styles.docTypeName}>{dt.name}</span>
                            </button>
                        ))}
                    </div>

                    <button
                        className={styles.generateBtn}
                        onClick={handleGenerate}
                        disabled={generating}
                    >
                        {generating ? '📝 서면 생성 중...' : `📝 ${DOC_TYPES.find(d => d.type === selectedDocType)?.name} 초안 생성`}
                    </button>

                    {genError && (
                        <div style={{
                            padding: '12px 16px', borderRadius: '10px',
                            background: '#fef2f2', border: '1px solid rgba(239,68,68,0.2)',
                            color: '#ef4444', fontSize: '0.85rem', marginBottom: '12px',
                        }}>
                            ⚠️ {genError}
                        </div>
                    )}

                    {generatedDoc && (
                        <>
                            <div style={{ marginBottom: '8px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--toss-text-primary)' }}>
                                📄 {generatedDoc.documentTypeName} 초안
                            </div>
                            <div className={styles.documentPreview}>
                                {generatedDoc.content}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className={styles.downloadBtn} onClick={handleDownload}>
                                    💾 다운로드 (.txt)
                                </button>
                                <button
                                    className={styles.downloadBtn}
                                    onClick={() => {
                                        navigator.clipboard.writeText(generatedDoc.content);
                                        alert('클립보드에 복사되었습니다.');
                                    }}
                                >
                                    📋 복사
                                </button>
                            </div>
                            <p style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--toss-text-tertiary)' }}>
                                ⚠️ AI가 생성한 초안입니다. 실제 제출 전 노무사·변호사 검토를 권장합니다.
                            </p>
                        </>
                    )}
                </div>
            )}

            {/* ═══ 체크리스트 탭 ═══ */}
            {activeTab === 'checklist' && (
                <div>
                    {checkLoading && (
                        <div className={styles.loadingSection}>
                            <div className={styles.spinner} />
                            <p style={{ fontSize: '0.88rem', color: 'var(--toss-text-secondary)' }}>
                                체크리스트를 생성하고 있습니다...
                            </p>
                        </div>
                    )}

                    {checkItems.length > 0 && (
                        <>
                            {/* 진행률 */}
                            <div className={styles.checkProgress}>
                                <div className={styles.checkProgressBar}>
                                    <div className={styles.checkProgressFill} style={{ width: `${checkPercent}%` }} />
                                </div>
                                <span className={styles.checkProgressText}>
                                    {checkedCount}/{checkItems.length} ({checkPercent}%)
                                </span>
                            </div>

                            {/* 카테고리별 체크리스트 */}
                            <div className={styles.checklistSection}>
                                {Object.entries(checkCategories).map(([cat, items]) => (
                                    <div key={cat}>
                                        <div className={styles.checklistCategory}>{cat}</div>
                                        {items.map(item => {
                                            const isChecked = checkedIds.has(item.id);
                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`${styles.checkItem} ${isChecked ? styles.checked : ''}`}
                                                    onClick={() => toggleCheck(item.id)}
                                                >
                                                    <div className={`${styles.checkbox} ${isChecked ? styles.checked : ''}`}>
                                                        {isChecked && '✓'}
                                                    </div>
                                                    <div>
                                                        <div className={`${styles.checkLabel} ${isChecked ? styles.checked : ''}`}>
                                                            {item.label}
                                                        </div>
                                                        {item.description && (
                                                            <div className={styles.checkDesc}>{item.description}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ═══ 타임라인 탭 ═══ */}
            {activeTab === 'timeline' && (
                <div>
                    {timelineLoading && (
                        <div className={styles.loadingSection}>
                            <div className={styles.spinner} />
                            <p style={{ fontSize: '0.88rem', color: 'var(--toss-text-secondary)' }}>
                                예상 타임라인을 생성하고 있습니다...
                            </p>
                        </div>
                    )}

                    {timelineSteps.length > 0 && (
                        <div className={styles.timelineSection}>
                            {timelineSteps.map((step, i) => (
                                <div key={i} className={styles.timelineItem}>
                                    <div className={`${styles.timelineDot} ${styles[step.type]}`} />
                                    <div className={styles.timelineDay}>{step.day}</div>
                                    <div className={styles.timelineLabel}>{step.label}</div>
                                    <div className={styles.timelineDesc}>{step.description}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {statuteLimit && (
                        <div className={styles.statuteWarning}>
                            ⚠️ 소멸시효: {statuteLimit}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ 경과 기록 탭 ═══ */}
            {activeTab === 'progress' && (
                <div>
                    <p style={{
                        fontSize: '0.85rem', color: 'var(--toss-text-tertiary)',
                        margin: '0 0 14px', lineHeight: 1.5,
                    }}>
                        📝 사건 진행 경과를 기록하면, 다음 행동을 AI가 제안합니다.
                    </p>

                    <textarea
                        style={{
                            width: '100%', minHeight: '120px', padding: '14px',
                            border: '1px solid var(--toss-border)', borderRadius: '12px',
                            background: 'var(--toss-bg-secondary)', color: 'var(--toss-text-primary)',
                            fontSize: '0.92rem', lineHeight: 1.6, resize: 'vertical',
                            fontFamily: 'inherit',
                        }}
                        value={progressText}
                        onChange={(e) => setProgressText(e.target.value)}
                        placeholder={"진행 경과를 입력하세요.\n\n예시:\n- 노동청에 진정서를 접수했습니다\n- 사측에서 합의 제안이 왔습니다\n- 근로감독관 면담을 완료했습니다"}
                    />

                    <button
                        className={styles.generateBtn}
                        onClick={async () => {
                            if (!state.caseId || !progressText.trim()) return;
                            setProgressSubmitting(true);
                            setProgressMsg(null);
                            try {
                                await addCaseUpdate(state.caseId, 'progress', progressText.trim());
                                setProgressText('');
                                setProgressMsg('✅ 경과가 기록되었습니다. Step 1(내 사건)에서 사건 보강 후 재분석할 수 있습니다.');
                            } catch (err: any) {
                                setProgressMsg(`⚠️ ${err.message}`);
                            } finally {
                                setProgressSubmitting(false);
                            }
                        }}
                        disabled={progressSubmitting || !progressText.trim()}
                        style={{ marginTop: '12px' }}
                    >
                        {progressSubmitting ? '기록 중...' : '📌 경과 기록하기'}
                    </button>

                    {progressMsg && (
                        <p style={{
                            padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem',
                            marginTop: '12px',
                            background: progressMsg.startsWith('✅') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                            color: progressMsg.startsWith('✅') ? '#10b981' : '#ef4444',
                        }}>
                            {progressMsg}
                        </p>
                    )}

                    {/* 기존 사건 히스토리 표시 */}
                    {state.timeline && state.timeline.length > 0 && (
                        <div style={{ marginTop: '20px' }}>
                            <div style={{
                                fontSize: '0.88rem', fontWeight: 600, marginBottom: '10px',
                                color: 'var(--toss-text-primary)',
                            }}>
                                🕰 사건 히스토리
                            </div>
                            <div className={styles.timelineSection} style={{ marginTop: 0 }}>
                                {state.timeline.slice().reverse().slice(0, 10).map((ev: TimelineEvent, i: number) => (
                                    <div key={i} className={styles.timelineItem}>
                                        <div className={styles.timelineDot} />
                                        <div className={styles.timelineDay}>
                                            {new Date(ev.timestamp).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                        </div>
                                        <div className={styles.timelineLabel}>{ev.detail}</div>
                                        {ev.trigger && <div className={styles.timelineDesc}>트리거: {ev.trigger}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 1으로 돌아가기 유도 */}
                    <button
                        onClick={() => goToStep(0)}
                        style={{
                            display: 'block', width: '100%', textAlign: 'center',
                            marginTop: '16px', padding: '12px',
                            border: '1px solid var(--toss-border)', borderRadius: '12px',
                            color: 'var(--toss-text-secondary)', fontSize: '0.88rem',
                            background: 'var(--toss-bg-card)', cursor: 'pointer',
                            fontFamily: 'inherit',
                        }}
                    >
                        🩺 내 사건으로 돌아가서 사건 보강 + 재분석하기
                    </button>
                </div>
            )}

            {/* AI 상담 링크 */}
            <button className={styles.chatLink} onClick={() => router.push('/chat')}>
                💬 AI 노무전문가에게 추가 질문하기
            </button>

            <StepNav currentStep={4} />
        </div>
    );
}
