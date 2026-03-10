'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from '../chat/ChatInterface.module.css';
import { createContextualSession, sendContextualMessage, IssueInfo } from '@/lib/api';

// ==================== Types ====================

interface Message {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    time?: string;
}

interface CaseConsultationChatProps {
    caseDescription: string;
    issues: IssueInfo[];
    laws: { title: string; type: string; detail: string; label?: string }[];
    summary: string;
    caseId?: string;
}

// ==================== Component ====================

export default function CaseConsultationChat({
    caseDescription,
    issues,
    laws,
    summary,
    caseId,
}: CaseConsultationChatProps) {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const initRef = useRef(false);

    // 메시지 스크롤
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 맥락 기반 세션 생성
    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        const initSession = async () => {
            setIsInitializing(true);
            setError(null);
            try {
                const result = await createContextualSession({
                    caseDescription,
                    issues,
                    laws,
                    summary,
                    caseId,
                } as any);

                setSessionId(result.sessionId);

                // AI 첫 인사 메시지
                setMessages([{
                    id: Date.now(),
                    role: 'assistant',
                    content: result.welcomeMessage,
                    time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                }]);
            } catch (err: any) {
                console.error('맥락 세션 생성 오류:', err);
                setError(err.message);
            } finally {
                setIsInitializing(false);
            }
        };

        initSession();
    }, [caseDescription, issues, laws, summary]);

    // 메시지 전송
    const handleSend = useCallback(async () => {
        if (!input.trim() || isLoading || !sessionId) return;

        const userMessage = input.trim();
        setInput('');

        const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

        setMessages(prev => [
            ...prev,
            { id: Date.now(), role: 'user', content: userMessage, time: now }
        ]);

        setIsLoading(true);

        try {
            const response = await sendContextualMessage(sessionId, userMessage);

            setMessages(prev => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: 'assistant',
                    content: response.message,
                    time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                }
            ]);
        } catch (err: any) {
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: 'assistant',
                    content: `오류가 발생했습니다: ${err.message}`,
                    time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                }
            ]);
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, sessionId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ==================== 렌더링 ====================

    // 초기화 중
    if (isInitializing) {
        return (
            <div className={styles.container}>
                <header className={styles.header}>
                    <div className={styles.headerContent}>
                        <div style={{ flex: 1 }}>
                            <h1 className={styles.title}>💬 AI 맥락 상담</h1>
                            <div className={styles.statusLine}>
                                <span className={styles.statusDot}></span>
                                <span className={styles.statusText}>사건 맥락 분석 중...</span>
                            </div>
                        </div>
                    </div>
                </header>
                <div className={styles.messageList}>
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', height: '100%', gap: '16px', color: 'var(--toss-text-secondary)'
                    }}>
                        <div style={{ fontSize: '2.5rem' }}>🧠</div>
                        <p style={{ fontSize: '0.95rem', textAlign: 'center', lineHeight: 1.6 }}>
                            사건 내용과 분석 결과를 AI에게 전달하고 있습니다...<br />
                            쟁점 {issues.length}건, 법령 {laws.length}건을 맥락으로 주입 중
                        </p>
                        <div style={{ width: 30, height: 30, border: '3px solid var(--toss-border)', borderTopColor: 'var(--toss-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    </div>
                </div>
            </div>
        );
    }

    // 에러
    if (error) {
        return (
            <div className={styles.container}>
                <header className={styles.header}>
                    <div className={styles.headerContent}>
                        <h1 className={styles.title}>💬 AI 맥락 상담</h1>
                    </div>
                </header>
                <div className={styles.messageList}>
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', height: '100%', gap: '12px', padding: '24px'
                    }}>
                        <p style={{ color: '#ef4444' }}>⚠️ {error}</p>
                        <button
                            onClick={() => { initRef.current = false; window.location.reload(); }}
                            style={{
                                padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--toss-border)',
                                background: 'var(--toss-bg-secondary)', cursor: 'pointer', color: 'var(--toss-text-primary)'
                            }}
                        >
                            🔄 다시 시도
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div style={{ flex: 1 }}>
                        <h1 className={styles.title}>💬 AI 맥락 상담</h1>
                        <div className={styles.statusLine}>
                            <span className={styles.statusDot}></span>
                            <span className={styles.statusText}>
                                {isLoading ? '답변 생성 중...' : `쟁점 ${issues.length}건 · 법령 ${laws.length}건 기반 상담`}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* 맥락 요약 배너 */}
            <div style={{
                padding: '10px 16px',
                background: 'var(--toss-bg-secondary)',
                borderBottom: '1px solid var(--toss-border)',
                fontSize: '0.78rem',
                color: 'var(--toss-text-tertiary)',
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
            }}>
                <span>📋 {caseDescription.substring(0, 40)}{caseDescription.length > 40 ? '...' : ''}</span>
                <span>🔥 쟁점 {issues.length}건</span>
                <span>⚖️ 법령 {laws.length}건</span>
            </div>

            {/* Messages */}
            <div className={styles.messageList}>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`${styles.row} ${msg.role === 'user' ? styles.rowUser : styles.rowBot}`}
                    >
                        {msg.role === 'assistant' && <div className={styles.avatar}>AI</div>}
                        <div>
                            <div
                                className={`${styles.messageBubble} ${msg.role === 'user' ? styles.user : styles.bot}`}
                                dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                            />
                            <div className={styles.messageMeta}>
                                {msg.time}
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className={`${styles.row} ${styles.rowBot}`}>
                        <div className={styles.avatar}>AI</div>
                        <div className={styles.typingIndicator}>
                            <div className={styles.typingDot}></div>
                            <div className={styles.typingDot}></div>
                            <div className={styles.typingDot}></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} style={{ height: '80px' }} />
            </div>

            {/* Input Area */}
            <div className={styles.inputArea}>
                <div className={styles.inputWrapper}>
                    <input
                        type="text"
                        className={styles.textInput}
                        placeholder="사건에 대해 궁금한 점을 물어보세요..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading || !sessionId}
                    />
                    <button
                        className={styles.sendButton}
                        onClick={handleSend}
                        disabled={isLoading || !sessionId}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

// 마크다운 간단 변환
function formatContent(content: string): string {
    return content
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
        .replace(/^- /gm, '• ');
}
