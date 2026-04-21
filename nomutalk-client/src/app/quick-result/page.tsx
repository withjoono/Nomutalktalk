'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseFlow } from '@/context/CaseFlowContext';
import { fetchNextQuestion, ConversationMessage } from '@/lib/api';
import styles from './page.module.css';

const INTENT_META: Record<string, { icon: string; label: string; heroClass: string; badgeClass: string }> = {
    document: { icon: '📄', label: '문서 생성', heroClass: 'hero-purple', badgeClass: styles.intentDocument },
    calculation: { icon: '🔢', label: '계산 결과', heroClass: 'hero-emerald', badgeClass: styles.intentCalculation },
    information: { icon: '📚', label: '법률 정보', heroClass: 'hero-blue', badgeClass: styles.intentInformation },
    dispute: { icon: '⚖️', label: '법률 분석', heroClass: 'hero-indigo', badgeClass: styles.intentInformation },
};

/** 간단한 마크다운 → HTML 변환 */
function renderMarkdown(md: string): string {
    return md
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
        .replace(/\|(.+)\|/g, (match) => {
            const cells = match.split('|').filter(c => c.trim());
            if (cells.every(c => /^[-:]+$/.test(c.trim()))) return '';
            const tag = match.includes('---') ? 'th' : 'td';
            return '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
        })
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>');
}

export default function QuickResultPage() {
    const router = useRouter();
    const { state, resetFlow, escalateToDispute } = useCaseFlow();
    const result = state.quickAssistResult;
    const intent = state.detectedIntent || 'information';
    const confidence = state.intentConfidence || 0;
    const meta = INTENT_META[intent] || INTENT_META.information;

    // ── 대화형 질문 상태 ──
    const [conversation, setConversation] = useState<ConversationMessage[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
    const [currentPlaceholder, setCurrentPlaceholder] = useState('');
    const [currentReason, setCurrentReason] = useState('');
    const [gathered, setGathered] = useState('');
    const [answerInput, setAnswerInput] = useState('');
    const [askingNext, setAskingNext] = useState(false);
    const [infoSufficient, setInfoSufficient] = useState(false);
    const [escalating, setEscalating] = useState(false);
    const [showConversation, setShowConversation] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const isDispute = intent === 'dispute';
    const autoEscalate = isDispute && confidence >= 0.85;

    // dispute 감지 시 첫 질문 가져오기
    useEffect(() => {
        if (isDispute && result && !showConversation && confidence >= 0.85) {
            // 높은 확신: 자동으로 대화 시작
            startConversation();
        }
    }, [isDispute, result, confidence]);

    // 새 메시지 추가 시 스크롤
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation, currentQuestion]);

    const startConversation = async () => {
        setShowConversation(true);
        setAskingNext(true);
        try {
            const res = await fetchNextQuestion(state.description, [], state.caseType);
            if (res.sufficient) {
                setInfoSufficient(true);
            } else if (res.question) {
                setCurrentQuestion(res.question);
                setCurrentPlaceholder(res.placeholder || '');
                setCurrentReason(res.reason || '');
                setGathered(res.gathered || '');
                setConversation([{ role: 'assistant' as const, content: res.question! }]);
            }
        } catch {
            setInfoSufficient(true); // 오류 시 바로 진행
        } finally {
            setAskingNext(false);
        }
    };

    const handleSendAnswer = async () => {
        if (!answerInput.trim() || askingNext) return;

        const answer = answerInput.trim();
        setAnswerInput('');

        // 대화에 사용자 답변 추가
        const newConv: ConversationMessage[] = [...conversation, { role: 'user', content: answer }];
        setConversation(newConv);
        setCurrentQuestion(null);
        setAskingNext(true);

        try {
            const res = await fetchNextQuestion(state.description, newConv, state.caseType);
            if (res.sufficient) {
                setInfoSufficient(true);
                setGathered(res.gathered || '');
                setConversation(prev => [...prev, { role: 'assistant', content: '충분한 정보가 확보되었습니다. 심층 분석을 시작할 수 있습니다.' }]);
            } else if (res.question) {
                setCurrentQuestion(res.question);
                setCurrentPlaceholder(res.placeholder || '');
                setCurrentReason(res.reason || '');
                setGathered(res.gathered || '');
                setConversation(prev => [...prev, { role: 'assistant' as const, content: res.question! }]);
            } else {
                setInfoSufficient(true);
            }
        } catch {
            setInfoSufficient(true);
        } finally {
            setAskingNext(false);
        }
    };

    const handleEscalate = async () => {
        setEscalating(true);
        // 대화 내용의 사용자 답변을 합산하여 전달
        const additionalInfo = conversation
            .filter(c => c.role === 'user')
            .map(c => c.content)
            .join('\n');
        await escalateToDispute(additionalInfo || undefined);
    };

    // 로딩 중
    if (state.isAnalyzing && !result) {
        return (
            <div className={styles.page}>
                <div className={`page-hero ${meta.heroClass}`}>
                    <h1>{meta.icon} {meta.label}</h1>
                    <p>AI가 요청을 처리하고 있습니다...</p>
                </div>
                <div className={styles.loadingSection}>
                    <div className={styles.spinner} />
                    <p style={{ fontSize: '0.92rem', color: 'var(--toss-text-secondary)' }}>
                        답변을 준비하고 있습니다...
                    </p>
                </div>
            </div>
        );
    }

    // 결과 없음
    if (!result) {
        return (
            <div className={styles.page}>
                <div className="page-hero hero-indigo">
                    <h1>⚡ 빠른 도움</h1>
                    <p>결과가 아직 없습니다.</p>
                </div>
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                    <button
                        className={`${styles.ctaBtn} ${styles.ctaPrimary}`}
                        onClick={() => { resetFlow(); router.push('/case-input'); }}
                    >
                        ← 사건 입력으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={`page-hero ${meta.heroClass}`}>
                <h1>{meta.icon} {meta.label}</h1>
                <p>{result.title}</p>
            </div>

            {/* ── 빠른 답변 카드 ── */}
            <div className={styles.resultCard}>
                <div className={styles.resultMeta}>
                    <span className={`${styles.intentBadge} ${meta.badgeClass}`}>
                        {meta.icon} {meta.label}
                    </span>
                </div>
                <div
                    className={styles.contentBody}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(result.content) }}
                />
            </div>

            {/* ── 관련 법령 ── */}
            {result.relatedLaws && result.relatedLaws.length > 0 && (
                <div className={styles.lawsSection}>
                    <h2 className={styles.sectionTitle}>📚 관련 법령</h2>
                    <div>
                        {result.relatedLaws.map((law, idx) => (
                            <span key={idx} className={styles.lawTag}>{law}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* ── 실무 팁 ── */}
            {result.tips && result.tips.length > 0 && (
                <div className={styles.tipsSection}>
                    <h2 className={styles.sectionTitle}>💡 실무 팁</h2>
                    {result.tips.map((tip, idx) => (
                        <div key={idx} className={styles.tipCard}>
                            <span>✅</span>
                            <span>{tip}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ══════════ 심층 분석 대화형 섹션 ══════════ */}
            {isDispute && !escalating && (
                <div style={{
                    padding: '20px', borderRadius: '16px', marginBottom: '16px',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.08))',
                    border: '1px solid rgba(99,102,241,0.2)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '1.3rem' }}>🔬</span>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--toss-text-primary)' }}>
                            심층 법적 분석이 가능합니다
                        </span>
                    </div>

                    {/* 대화 시작 전 */}
                    {!showConversation && (
                        <>
                            <p style={{ margin: '0 0 14px', fontSize: '0.86rem', color: 'var(--toss-text-secondary)', lineHeight: 1.6 }}>
                                쟁점 분석, 판례 검토, 승소 가능성 평가까지 상세한 법적 분석을 받으실 수 있습니다.
                            </p>
                            <button
                                onClick={startConversation}
                                style={{
                                    width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                                    fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(99,102,241,0.25)',
                                    transition: 'transform 0.15s, box-shadow 0.15s',
                                }}
                                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                                ⚖️ 심층 분석 시작하기
                            </button>
                        </>
                    )}

                    {/* ── 대화형 질문 UI ── */}
                    {showConversation && (
                        <div style={{ marginTop: '4px' }}>
                            {/* 파악된 정보 표시 */}
                            {gathered && (
                                <div style={{
                                    padding: '8px 12px', borderRadius: '10px', marginBottom: '12px',
                                    background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
                                    fontSize: '0.78rem', color: '#059669', lineHeight: 1.5,
                                }}>
                                    ✅ 파악된 정보: {gathered}
                                </div>
                            )}

                            {/* 대화 버블 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                                {conversation.map((msg, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                    }}>
                                        <div style={{
                                            maxWidth: '85%', padding: '10px 14px', borderRadius: '14px',
                                            fontSize: '0.88rem', lineHeight: 1.6,
                                            ...(msg.role === 'user' ? {
                                                background: '#6366f1', color: 'white',
                                                borderBottomRightRadius: '4px',
                                            } : {
                                                background: 'white', color: 'var(--toss-text-primary)',
                                                border: '1px solid var(--toss-border)',
                                                borderBottomLeftRadius: '4px',
                                            }),
                                        }}>
                                            {msg.role === 'assistant' && <span style={{ marginRight: '6px' }}>🤖</span>}
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}

                                {/* 타이핑 중 */}
                                {askingNext && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                        <div style={{
                                            padding: '10px 16px', borderRadius: '14px',
                                            background: 'white', border: '1px solid var(--toss-border)',
                                            borderBottomLeftRadius: '4px',
                                            fontSize: '0.88rem', color: 'var(--toss-text-tertiary)',
                                        }}>
                                            🤖 <span style={{ animation: 'pulse 1.5s infinite' }}>생각하는 중...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* 입력 영역 (아직 충분하지 않을 때) */}
                            {!infoSufficient && currentQuestion && !askingNext && (
                                <div style={{ position: 'relative' }}>
                                    {currentReason && (
                                        <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: 'var(--toss-text-tertiary)' }}>
                                            💡 {currentReason}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            value={answerInput}
                                            onChange={e => setAnswerInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleSendAnswer(); }}
                                            placeholder={currentPlaceholder || '답변을 입력하세요'}
                                            style={{
                                                flex: 1, padding: '12px 16px', borderRadius: '12px',
                                                border: '2px solid #6366f1', outline: 'none', fontSize: '0.9rem',
                                                fontFamily: 'inherit', background: 'white',
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            onClick={handleSendAnswer}
                                            disabled={!answerInput.trim()}
                                            style={{
                                                padding: '12px 18px', borderRadius: '12px', border: 'none',
                                                background: answerInput.trim() ? '#6366f1' : '#d1d5db',
                                                color: 'white', fontWeight: 700, cursor: answerInput.trim() ? 'pointer' : 'default',
                                                fontSize: '0.88rem', fontFamily: 'inherit', transition: 'background 0.15s',
                                            }}
                                        >
                                            전송
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 충분 → 분석 시작 버튼 */}
                            {infoSufficient && (
                                <button
                                    onClick={handleEscalate}
                                    style={{
                                        width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        color: 'white', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                                        fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(99,102,241,0.25)',
                                        marginTop: '4px',
                                    }}
                                >
                                    ⚖️ 심층 분석 시작하기
                                </button>
                            )}

                            {/* 건너뛰기 */}
                            {!infoSufficient && (
                                <button
                                    onClick={() => { setInfoSufficient(true); setCurrentQuestion(null); }}
                                    style={{
                                        display: 'block', margin: '10px auto 0', padding: '8px 16px',
                                        background: 'transparent', border: 'none', cursor: 'pointer',
                                        fontSize: '0.82rem', color: 'var(--toss-text-tertiary)',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    건너뛰고 바로 분석 →
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── 심층 분석 진행 중 ── */}
            {escalating && (
                <div style={{
                    padding: '20px', borderRadius: '16px', marginBottom: '16px',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.08))',
                    border: '1px solid rgba(99,102,241,0.2)', textAlign: 'center',
                }}>
                    <div style={{
                        width: 28, height: 28, margin: '0 auto 12px',
                        border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1',
                        borderRadius: '50%', animation: 'spin 1s linear infinite',
                    }} />
                    <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: '#6366f1' }}>
                        심층 분석을 준비하고 있습니다...
                    </p>
                </div>
            )}

            {/* ── 하단 CTA ── */}
            <div className={styles.ctaSection}>
                <button
                    className={`${styles.ctaBtn} ${styles.ctaSecondary}`}
                    onClick={() => { resetFlow(); router.push('/case-input'); }}
                >
                    ← 새 요청
                </button>
                {!isDispute && (
                    <button
                        className={`${styles.ctaBtn} ${styles.ctaPrimary}`}
                        onClick={() => { setShowConversation(true); startConversation(); }}
                        disabled={escalating || showConversation}
                    >
                        {escalating ? '준비 중...' : '⚖️ 분쟁 분석이 필요하신가요?'}
                    </button>
                )}
            </div>

            {/* ── 면책 ── */}
            <div style={{
                padding: '14px 18px', borderRadius: '12px',
                background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
                fontSize: '0.78rem', color: 'var(--toss-text-tertiary)', lineHeight: 1.7,
            }}>
                ⚠️ 본 결과는 AI가 관련 법령을 참고하여 생성한 것이며, 법적 효력이 없습니다.
                실제 적용 시 전문 노무사 또는 변호사의 검토를 권장합니다.
            </div>
        </div>
    );
}
