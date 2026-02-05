'use client';

import React, { useState } from 'react';
import styles from './ChatInterface.module.css';

interface Message {
    id: number;
    role: 'user' | 'assistant';
    content: string;
}

export default function ChatInterface() {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { id: 1, role: 'assistant', content: '안녕하세요! 노무톡 AI 노무사입니다. \n부당해고, 임금체불 등 궁금한 점을 물어보세요.' }
    ]);

    const handleSend = () => {
        if (!input.trim()) return;
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: input }]);
        setInput('');
        // Simulate thinking
        setTimeout(() => {
            setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: '잠시만 기다려주세요. 판례를 검색 중입니다...' }]);
        }, 600);
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div>
                        <h1 className={styles.title}>NomuBot</h1>
                        <div className={styles.statusLine}>
                            <span className={styles.statusDot}></span>
                            <span className={styles.statusText}>답변 가능</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Messages */}
            <div className={styles.messageList}>
                {messages.map((msg) => (
                    <div key={msg.id} className={`${styles.row} ${msg.role === 'user' ? styles.rowUser : styles.rowBot}`}>
                        {msg.role === 'assistant' && <div className={styles.avatar}>AI</div>}
                        <div className={`${styles.messageBubble} ${msg.role === 'user' ? styles.user : styles.bot}`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {/* Spacer for input area */}
                <div style={{ height: '80px' }}></div>
            </div>

            {/* Input Area */}
            <div className={styles.inputArea}>
                <div className={styles.inputWrapper}>
                    <input
                        type="text"
                        className={styles.textInput}
                        placeholder="궁금한 내용을 입력하세요..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button className={styles.sendButton} onClick={handleSend}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
