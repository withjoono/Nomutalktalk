'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseFlow } from '@/context/CaseFlowContext';
import StepNav from '@/components/layout/StepNav';
import { createContextualSession, sendContextualMessage, IssueInfo, GraphNode } from '@/lib/api';
import styles from './page.module.css';

// ==================== Types ====================

interface Message {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    time?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#10b981',
};

const SEVERITY_LABELS: Record<string, string> = {
    high: '높음',
    medium: '중간',
    low: '낮음',
};

// 쟁점 기반 추천 질문 생성
function generateSuggestions(issues: IssueInfo[], laws: { title: string; type: string }[]): string[] {
    const suggestions: string[] = [];

    // severity = high인 쟁점 우선
    const sorted = [...issues].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    });

    sorted.forEach(issue => {
        if (issue.title.includes('해고') || issue.title.includes('해직')) {
            suggestions.push(`${issue.title} 시 구제절차는 어떻게 되나요?`);
        } else if (issue.title.includes('임금') || issue.title.includes('급여')) {
            suggestions.push(`체불된 ${issue.title}을 받으려면 어떻게 해야 하나요?`);
        } else if (issue.title.includes('근로시간') || issue.title.includes('초과근무')) {
            suggestions.push(`${issue.title}에 대한 법적 기준은 무엇인가요?`);
        } else {
            suggestions.push(`${issue.title}에 대해 어떻게 대응해야 하나요?`);
        }
    });

    // 일반 추천 질문
    if (suggestions.length < 4) {
        suggestions.push('이 사건에서 가장 유리한 전략은 무엇인가요?');
    }
    if (suggestions.length < 5) {
        suggestions.push('진정서는 어떻게 작성하나요?');
    }
    if (laws.length > 0) {
        suggestions.push('적용되는 핵심 법령을 쉽게 설명해주세요');
    }

    return suggestions.slice(0, 6);
}

// 마크다운 간단 변환
function formatContent(content: string): string {
    return content
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
        .replace(/^- /gm, '• ');
}

function getTypeIcon(type: string) {
    switch (type) {
        case 'law': return '⚖️';
        case 'precedent': return '🏛️';
        case 'interpretation': return '📝';
        case 'decision': return '🔨';
        case 'issue': return '🔥';
        default: return '📄';
    }
}

function getTypeLabel(type: string) {
    switch (type) {
        case 'law': return '법령';
        case 'precedent': return '판례';
        case 'interpretation': return '행정해석';
        case 'decision': return '노동위 결정';
        default: return '기타';
    }
}

// ==================== Component ====================

export default function ChatPage() {
    const router = useRouter();
    const { state } = useCaseFlow();

    // 화면 모드 (briefing → chat)
    const [showBriefing, setShowBriefing] = useState(true);
    const [sidebarTab, setSidebarTab] = useState<'issues' | 'laws'>('issues');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // 채팅 상태
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const initRef = useRef(false);

    // 이전 단계 미완료 시 리다이렉트
    useEffect(() => {
        if (!state.caseId) { router.push('/case-input'); return; }
        if (!state.issueResult) { router.push('/issue-analysis'); return; }
    }, [state.caseId, state.issueResult, router]);

    // 메시지 스크롤
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!state.caseId || !state.issueResult) return null;

    const issues = state.issueResult.issues || [];
    const allNodes = state.lawResult?.nodes || state.issueResult.nodes || [];
    const lawNodes = allNodes
        .filter(n => n.type !== 'case' && n.type !== 'issue')
        .map(n => ({ title: n.label, type: n.type || 'law', detail: n.detail || '', label: n.label }));
    const summaryText = state.issueResult.summary + (state.lawResult?.summary ? '\n\n' + state.lawResult.summary : '');
    const suggestions = generateSuggestions(issues, lawNodes);

    // 상담 세션 시작
    const startConsultation = async () => {
        setShowBriefing(false);
        if (initRef.current) return;
        initRef.current = true;
        setIsInitializing(true);
        setError(null);

        try {
            const result = await createContextualSession({
                caseDescription: state.description,
                issues,
                laws: lawNodes,
                summary: summaryText,
                caseId: state.caseId || undefined,
            } as any);

            setSessionId(result.sessionId);
            setMessages([{
                id: Date.now(),
                role: 'assistant',
                content: result.welcomeMessage,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            }]);
        } catch (err: any) {
            console.error('세션 생성 오류:', err);
            setError(err.message);
        } finally {
            setIsInitializing(false);
        }
    };

    // 메시지 전송
    const handleSend = async (customMessage?: string) => {
        const messageText = customMessage || input.trim();
        if (!messageText || isLoading || !sessionId) return;
        setInput('');

        const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: messageText, time: now }]);
        setIsLoading(true);

        try {
            const response = await sendContextualMessage(sessionId, messageText);
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: response.message,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            }]);
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: `오류가 발생했습니다: ${err.message}`,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // 사이드바 법령 클릭 → 자동 질문 생성
    const handleLawClick = (law: { title: string; type: string }) => {
        const prefix = law.type === 'law' ? '이 법령' : law.type === 'precedent' ? '이 판례' : '이 해석';
        setInput(`"${law.title}"에 대해 더 자세히 설명해주세요. ${prefix}이 제 사건에 어떻게 적용될 수 있나요?`);
    };

    // 사이드바 쟁점 클릭 → 자동 질문 생성
    const handleIssueClick = (issue: IssueInfo) => {
        setInput(`"${issue.title}" 쟁점에 대해 구체적으로 어떻게 대응해야 하나요?`);
    };

    // ==================== 브리핑 카드 화면 ====================
    if (showBriefing) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div className={styles.briefingContainer}>
                        <div className={styles.briefingHeader}>
                            <span className={styles.briefingIcon}>🧠</span>
                            <h1 className={styles.briefingTitle}>AI 노무전문가 브리핑</h1>
                            <p className={styles.briefingSubtitle}>
                                사건 분석이 완료되었습니다. 아래 내용을 확인하신 후 상담을 시작해주세요.
                            </p>
                        </div>

                        <div className={styles.briefingCards}>
                            {/* 사건 요약 */}
                            <div className={styles.briefingCard}>
                                <div className={styles.briefingCardTitle}>📋 사건 요약</div>
                                <div className={styles.briefingCardBody}>
                                    {state.description.length > 150
                                        ? state.description.substring(0, 150) + '...'
                                        : state.description}
                                </div>
                            </div>

                            {/* 핵심 쟁점 */}
                            <div className={styles.briefingCard}>
                                <div className={styles.briefingCardTitle}>🔥 핵심 쟁점 ({issues.length}건)</div>
                                <div className={styles.issueChipList}>
                                    {issues
                                        .sort((a, b) => {
                                            const order = { high: 0, medium: 1, low: 2 };
                                            return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3);
                                        })
                                        .map(issue => (
                                            <div key={issue.id} className={styles.issueChip}>
                                                <span
                                                    className={styles.issueChipDot}
                                                    style={{ background: SEVERITY_COLORS[issue.severity] }}
                                                />
                                                <span className={styles.issueChipTitle}>{issue.title}</span>
                                                <span
                                                    className={styles.issueChipSeverity}
                                                    style={{
                                                        background: `${SEVERITY_COLORS[issue.severity]}18`,
                                                        color: SEVERITY_COLORS[issue.severity],
                                                    }}
                                                >
                                                    {SEVERITY_LABELS[issue.severity] || issue.severity}
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* 핵심 법령 */}
                            {lawNodes.length > 0 && (
                                <div className={styles.briefingCard}>
                                    <div className={styles.briefingCardTitle}>⚖️ 핵심 법령·판례 ({lawNodes.length}건)</div>
                                    <div className={styles.lawChipList}>
                                        {lawNodes.slice(0, 5).map((law, i) => (
                                            <div key={i} className={styles.lawChip}>
                                                <span className={styles.lawChipIcon}>{getTypeIcon(law.type)}</span>
                                                <span>{law.title}</span>
                                            </div>
                                        ))}
                                        {lawNodes.length > 5 && (
                                            <div className={styles.lawChip} style={{ color: 'var(--toss-text-tertiary)' }}>
                                                ... 외 {lawNodes.length - 5}건
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* AI 분석 요약 */}
                            {state.issueResult.summary && (
                                <div className={styles.briefingCard}>
                                    <div className={styles.briefingCardTitle}>🎯 AI 종합 판단</div>
                                    <div className={styles.briefingCardBody}>
                                        {state.issueResult.summary.length > 300
                                            ? state.issueResult.summary.substring(0, 300) + '...'
                                            : state.issueResult.summary}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button className={styles.startBtn} onClick={startConsultation}>
                            💬 AI 노무전문가 상담 시작
                        </button>
                    </div>
                </div>
                <div style={{ padding: '0 16px 16px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
                    <StepNav currentStep={3} />
                </div>
            </div>
        );
    }

    // ==================== 상담 채팅 화면 ====================
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className={styles.consultLayout} style={{ flex: 1, minHeight: 0 }}>
                {/* ═══ 사이드바 맥락 패널 ═══ */}
                <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
                    <div className={styles.sidebarTabs}>
                        <button
                            className={`${styles.sidebarTab} ${sidebarTab === 'issues' ? styles.sidebarTabActive : ''}`}
                            onClick={() => setSidebarTab('issues')}
                        >
                            🔥 쟁점 ({issues.length})
                        </button>
                        <button
                            className={`${styles.sidebarTab} ${sidebarTab === 'laws' ? styles.sidebarTabActive : ''}`}
                            onClick={() => setSidebarTab('laws')}
                        >
                            ⚖️ 법령 ({lawNodes.length})
                        </button>
                    </div>

                    <div className={styles.sidebarBody}>
                        {sidebarTab === 'issues' && issues.map(issue => (
                            <div
                                key={issue.id}
                                className={styles.sideIssueItem}
                                onClick={() => handleIssueClick(issue)}
                            >
                                <div className={styles.sideIssueHeader}>
                                    <span
                                        className={styles.sideIssueDot}
                                        style={{ background: SEVERITY_COLORS[issue.severity] }}
                                    />
                                    <span className={styles.sideIssueTitle}>{issue.title}</span>
                                </div>
                                {issue.summary && (
                                    <div className={styles.sideIssueSummary}>{issue.summary}</div>
                                )}
                            </div>
                        ))}

                        {sidebarTab === 'laws' && lawNodes.map((law, i) => (
                            <div
                                key={i}
                                className={styles.sideLawItem}
                                onClick={() => handleLawClick(law)}
                            >
                                <span className={styles.sideLawIcon}>{getTypeIcon(law.type)}</span>
                                <div className={styles.sideLawInfo}>
                                    <span className={styles.sideLawType} data-type={law.type}>
                                        {getTypeLabel(law.type)}
                                    </span>
                                    <div className={styles.sideLawLabel}>{law.title}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>

                {/* ═══ 채팅 영역 ═══ */}
                <main className={styles.chatArea}>
                    <div className={styles.chatHeader}>
                        <div className={styles.chatHeaderLeft}>
                            <span className={styles.chatTitle}>💬 AI 노무전문가 상담</span>
                            <span className={styles.chatStatus}>
                                <span className={styles.chatStatusDot} />
                                {isLoading ? '답변 생성 중...' : `쟁점 ${issues.length}건 · 법령 ${lawNodes.length}건 기반`}
                            </span>
                        </div>
                        <button
                            className={styles.sidebarToggle}
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                            📋 맥락 {sidebarOpen ? '닫기' : '보기'}
                        </button>
                    </div>

                    {/* 추천 질문 칩 */}
                    {messages.length <= 1 && (
                        <div className={styles.suggestionsArea}>
                            {suggestions.map((q, i) => (
                                <button
                                    key={i}
                                    className={styles.suggestionChip}
                                    onClick={() => handleSend(q)}
                                    disabled={isLoading || !sessionId}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 초기화 중 */}
                    {isInitializing && (
                        <div className={styles.messageList}>
                            <div className={styles.initScreen}>
                                <div style={{ fontSize: '2.5rem' }}>🧠</div>
                                <p style={{ fontSize: '0.92rem', textAlign: 'center', lineHeight: 1.6 }}>
                                    사건 내용과 분석 결과를 AI에게 전달하고 있습니다...<br />
                                    쟁점 {issues.length}건, 법령 {lawNodes.length}건을 맥락으로 주입 중
                                </p>
                                <div className={styles.spinner} />
                            </div>
                        </div>
                    )}

                    {/* 에러 */}
                    {error && !isInitializing && (
                        <div className={styles.messageList}>
                            <div className={styles.initScreen}>
                                <p style={{ color: '#ef4444' }}>⚠️ {error}</p>
                                <button
                                    onClick={() => { initRef.current = false; setError(null); startConsultation(); }}
                                    style={{
                                        padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--toss-border)',
                                        background: 'var(--toss-bg-secondary)', cursor: 'pointer', color: 'var(--toss-text-primary)',
                                        fontFamily: 'inherit',
                                    }}
                                >
                                    🔄 다시 시도
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 메시지 리스트 */}
                    {!isInitializing && !error && (
                        <div className={styles.messageList}>
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`${styles.msgRow} ${msg.role === 'user' ? styles.msgRowUser : styles.msgRowBot}`}
                                >
                                    {msg.role === 'assistant' && <div className={styles.avatar}>AI</div>}
                                    <div>
                                        <div
                                            className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.botBubble}`}
                                            dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                                        />
                                        <div className={styles.msgMeta}>{msg.time}</div>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className={`${styles.msgRow} ${styles.msgRowBot}`}>
                                    <div className={styles.avatar}>AI</div>
                                    <div className={styles.typingIndicator}>
                                        <div className={styles.typingDot} />
                                        <div className={styles.typingDot} />
                                        <div className={styles.typingDot} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} style={{ height: '80px' }} />
                        </div>
                    )}

                    {/* 입력 영역 */}
                    <div className={styles.inputArea}>
                        <div className={styles.inputWrapper}>
                            <input
                                type="text"
                                className={styles.textInput}
                                placeholder="사건에 대해 궁금한 점을 질문하세요..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading || !sessionId}
                            />
                            <button
                                className={styles.sendBtn}
                                onClick={() => handleSend()}
                                disabled={isLoading || !sessionId || !input.trim()}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </main>
            </div>

            <div style={{ padding: '0 16px 16px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
                <StepNav currentStep={3} />
            </div>
        </div>
    );
}
