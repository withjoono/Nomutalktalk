'use client';

import React, { useState, useEffect, useRef } from 'react';
import styles from './ChatInterface.module.css';
import { createSession, sendChatMessage, deleteSession, ChatResponse } from '@/lib/api';

interface Message {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    stage?: string;
    time?: string;
}

const EXAMPLE_QUERIES = [
    { icon: '💰', label: '임금 체불 문제', query: '임금을 3개월째 못 받고 있어요' },
    { icon: '🚫', label: '부당 해고', query: '부당하게 해고당했어요' },
    { icon: '⏰', label: '근로시간 문제', query: '연장근무 수당을 안 줘요' },
    { icon: '🌴', label: '휴가 사용 문제', query: '연차를 사용할 수 없어요' },
    { icon: '🏥', label: '산업재해', query: '업무 중에 다쳤어요' },
    { icon: '🚨', label: '산재 신고 거부', query: '회사가 산재 신고를 거부해요' },
];

const STAGE_NAMES: Record<string, string> = {
    'diagnosis': '🔍 진단',
    'analysis': '⚖️ 법적 분석',
    'solution': '💡 대안 제안',
    'followup': '❓ 후속 질문'
};

export default function ChatInterface() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showWelcome, setShowWelcome] = useState(true);
    const [currentStage, setCurrentStage] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 세션 초기화
    useEffect(() => {
        initSession();
    }, []);

    // 메시지 스크롤
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const initSession = async () => {
        try {
            const { sessionId: newSessionId } = await createSession();
            setSessionId(newSessionId);
        } catch (error) {
            console.error('세션 생성 오류:', error);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading || !sessionId) return;

        const userMessage = input.trim();
        setInput('');
        setShowWelcome(false);

        const now = new Date();
        const timeString = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

        // 사용자 메시지 추가
        setMessages(prev => [
            ...prev,
            { id: Date.now(), role: 'user', content: userMessage, time: timeString }
        ]);

        setIsLoading(true);

        try {
            const response: ChatResponse = await sendChatMessage(sessionId, userMessage);

            setCurrentStage(response.nextStage || response.stage);

            // AI 응답 추가
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: 'assistant',
                    content: response.message,
                    stage: response.stage,
                    time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                }
            ]);
        } catch (error) {
            setMessages(prev => [
                ...prev,
                {
                    id: Date.now() + 1,
                    role: 'assistant',
                    content: `오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
                    time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExampleQuery = (query: string) => {
        setInput(query);
        // 자동 전송
        setTimeout(() => {
            const fakeEvent = { key: 'Enter' } as React.KeyboardEvent;
            handleKeyDown(fakeEvent);
        }, 100);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault?.();
            handleSend();
        }
    };

    const handleNewChat = async () => {
        if (sessionId) {
            try {
                await deleteSession(sessionId);
            } catch (error) {
                console.error('세션 삭제 오류:', error);
            }
        }
        setMessages([]);
        setShowWelcome(true);
        setCurrentStage(null);
        await initSession();
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div style={{ flex: 1 }}>
                        <h1 className={styles.title}>💬 노무 상담</h1>
                        <div className={styles.statusLine}>
                            <span className={styles.statusDot}></span>
                            <span className={styles.statusText}>
                                {currentStage ? STAGE_NAMES[currentStage] || '상담 중' : '답변 가능'}
                            </span>
                        </div>
                    </div>
                    {!showWelcome && (
                        <button className={styles.newChatButton} onClick={handleNewChat}>
                            새 상담
                        </button>
                    )}
                </div>
            </header>

            {/* Messages */}
            <div className={styles.messageList}>
                {showWelcome ? (
                    <div className={styles.welcomeScreen}>
                        <div className={styles.welcomeIcon}>⚖️</div>
                        <h2 className={styles.welcomeTitle}>노무 AI 대화형 상담</h2>
                        <p className={styles.welcomeDescription}>
                            노동법령과 판례를 기반으로 단계별 맞춤 상담을 제공합니다.<br />
                            진단 → 법적 분석 → 대안 제안 → 후속 질문 순으로 체계적으로 도와드립니다.
                        </p>
                        <div className={styles.exampleGrid}>
                            {EXAMPLE_QUERIES.map((item, index) => (
                                <button
                                    key={index}
                                    className={styles.exampleCard}
                                    onClick={() => handleExampleQuery(item.query)}
                                >
                                    <span className={styles.exampleIcon}>{item.icon}</span>
                                    <span className={styles.exampleLabel}>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
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
                                        {msg.stage && (
                                            <span className={`${styles.stageBadge} ${styles[msg.stage]}`}>
                                                {STAGE_NAMES[msg.stage]}
                                            </span>
                                        )}
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
                    </>
                )}
                <div ref={messagesEndRef} style={{ height: '80px' }} />
            </div>

            {/* Input Area */}
            <div className={styles.inputArea}>
                <div className={styles.inputWrapper}>
                    <input
                        type="text"
                        className={styles.textInput}
                        placeholder="노무 문제를 자유롭게 말씀해주세요..."
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
