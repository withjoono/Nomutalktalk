'use client';

import React, { useState, useRef, useEffect } from 'react';
import styles from './CaseChatPanel.module.css';
import GraphView from '../labor/GraphView';
import { GraphNode, GraphLink, sendChatMessage, ChatResponse } from '@/lib/api';

interface Message {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    stage?: string;
    time?: string;
}

interface Props {
    chatSessionId: string;
    nodes: GraphNode[];
    links: GraphLink[];
    caseDescription: string;
}

const STAGE_NAMES: Record<string, string> = {
    diagnosis: '🔍 진단',
    analysis: '⚖️ 법적 분석',
    solution: '💡 대안 제안',
    followup: '❓ 후속 질문',
};

function formatContent(content: string): string {
    return content
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
        .replace(/^- /gm, '• ');
}

export default function CaseChatPanel({ chatSessionId, nodes, links, caseDescription }: Props) {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [graphWidth, setGraphWidth] = useState(330);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        const updateWidth = () => {
            setGraphWidth(window.innerWidth < 768 ? Math.min(window.innerWidth - 40, 500) : 330);
        };
        updateWidth();
        window.addEventListener('resize', updateWidth);
        return () => window.removeEventListener('resize', updateWidth);
    }, []);

    // 초기 인사 메시지
    useEffect(() => {
        const lawCount = nodes.filter(n => n.type === 'law').length;
        const caseCount = nodes.filter(n => n.type === 'precedent').length;
        setMessages([{
            id: Date.now(),
            role: 'assistant',
            content: `사건 분석이 완료되었습니다.\n\n📊 관련 법령 ${lawCount}건, 판례 ${caseCount}건을 찾았습니다.\n\n왼쪽 그래프에서 법령이나 판례를 클릭하면 해당 내용을 자동으로 참조하여 답변드립니다.\n\n어떤 부분에 대해 더 알고 싶으시거나, 대응 방법이 궁금하시면 자유롭게 질문해주세요.`,
            stage: 'diagnosis',
            time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        }]);
    }, [nodes]);

    const handleSend = async () => {
        if (!input.trim() || isLoading || !chatSessionId) return;

        const userMessage = input.trim();
        setInput('');
        const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: userMessage, time: now }]);
        setIsLoading(true);

        try {
            const response: ChatResponse = await sendChatMessage(chatSessionId, userMessage);

            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: response.message,
                stage: response.stage,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            }]);
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: `오류: ${err.message || '알 수 없는 오류'}`,
                time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
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

    const handleNodeClick = (node: GraphNode) => {
        if (node.type === 'case') return;
        const prefix = node.type === 'law' ? '이 법령' : node.type === 'precedent' ? '이 판례' : '이 해석';
        setInput(`"${node.label}"에 대해 더 자세히 알려주세요. ${prefix}이 제 사건에 어떻게 적용될 수 있나요?`);
    };

    return (
        <div className={styles.layout}>
            {/* 좌측: 미니 그래프 */}
            <div className={styles.graphSide}>
                <div className={styles.graphSideHeader}>📊 법률 관계도</div>
                <div className={styles.graphSideBody}>
                    <GraphView
                        nodes={nodes}
                        links={links}
                        width={graphWidth}
                        height={280}
                        onNodeClick={handleNodeClick}
                    />
                </div>
                <div className={styles.graphNodeList}>
                    {nodes.filter(n => n.type !== 'case').map(node => (
                        <button
                            key={node.id}
                            className={styles.miniNodeBtn}
                            onClick={() => handleNodeClick(node)}
                        >
                            {node.type === 'law' ? '⚖️' : node.type === 'precedent' ? '🏛️' : '📝'} {node.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 우측: 챗봇 */}
            <div className={styles.chatSide}>
                <div className={styles.chatHeader}>
                    <span className={styles.chatTitle}>💬 사건 맞춤 상담</span>
                    <span className={styles.chatStatus}>
                        <span className={styles.chatStatusDot} /> 답변 가능
                    </span>
                </div>

                <div className={styles.contextHint}>
                    📌 사건 분석 결과가 AI에 전달되었습니다. 왼쪽 그래프의 법령/판례를 클릭하면 자동으로 질문이 생성됩니다.
                </div>

                <div className={styles.messageList}>
                    {messages.map((msg) => (
                        <div key={msg.id} className={`${styles.row} ${msg.role === 'user' ? styles.rowUser : styles.rowBot}`}>
                            {msg.role === 'assistant' && <div className={styles.avatar}>AI</div>}
                            <div>
                                <div
                                    className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.botBubble}`}
                                    dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                                />
                                <div className={styles.msgTime}>{msg.time}</div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className={`${styles.row} ${styles.rowBot}`}>
                            <div className={styles.avatar}>AI</div>
                            <div className={styles.typingIndicator}>
                                <div className={styles.typingDot} />
                                <div className={styles.typingDot} />
                                <div className={styles.typingDot} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} style={{ height: '20px' }} />
                </div>

                <div className={styles.inputArea}>
                    <div className={styles.inputWrapper}>
                        <input
                            type="text"
                            className={styles.textInput}
                            placeholder="사건에 대해 궁금한 점을 질문하세요..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isLoading}
                        />
                        <button
                            className={styles.sendBtn}
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
