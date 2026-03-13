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

// 승률에 따른 색상
function getWinRateColor(rate: number): string {
    if (rate >= 75) return '#3b82f6';
    if (rate >= 60) return '#10b981';
    if (rate >= 40) return '#f59e0b';
    return '#ef4444';
}

function getWinRateLabel(rate: number): string {
    if (rate >= 75) return '매우 유리';
    if (rate >= 60) return '유리';
    if (rate >= 40) return '보통';
    return '불리';
}

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

// ==================== Consultation Tabs ====================

type ConsultMode = 'prediction' | 'response' | 'evidence' | 'compensation' | 'document';

const CONSULT_TABS: { mode: ConsultMode; icon: string; label: string; desc: string }[] = [
    { mode: 'prediction', icon: '📊', label: '예측', desc: '승률·결과 예측' },
    { mode: 'response', icon: '🛡️', label: '대응', desc: '행동 전략·절차' },
    { mode: 'evidence', icon: '📋', label: '증거', desc: '증거 수집·분석' },
    { mode: 'compensation', icon: '💰', label: '보상', desc: '보상금 산정' },
    { mode: 'document', icon: '📝', label: '서면', desc: '법률 서면 작성' },
];

function getTabSuggestions(mode: ConsultMode, issues: IssueInfo[]): string[] {
    const topIssue = issues[0]?.title || '해당 쟁점';
    switch (mode) {
        case 'prediction':
            return [
                '이 사건에서 이기면 어떤 결과가 예상되나요?',
                '지면 최악의 경우는 어떻게 되나요?',
                '노동위원회에서 해결까지 얼마나 걸리나요?',
                `"${topIssue}" 쟁점의 승률을 높이려면?`,
            ];
        case 'response':
            return [
                '지금 당장 해야 할 일은 무엇인가요?',
                '노동위원회 진정 절차를 알려주세요',
                '회사와 협상은 어떤 전략으로 해야 하나요?',
                '증거 보전을 위해 주의할 점은?',
            ];
        case 'evidence':
            return [
                '이 사건에 필요한 증거 체크리스트를 알려주세요',
                '카카오톡 대화가 증거로 인정되나요?',
                '녹음 증거의 법적 유효성은 어떤가요?',
                '증거가 부족하면 어떻게 입증하나요?',
            ];
        case 'compensation':
            return [
                '체불임금은 얼마나 청구할 수 있나요?',
                '퇴직금 계산을 도와주세요',
                '부당해고 시 받을 수 있는 금액은?',
                '합의금은 어느 정도가 적정한가요?',
            ];
        case 'document':
            return [
                '진정서를 작성해주세요',
                '답변서를 작성해주세요',
                '이의신청서를 작성해주세요',
                '증거설명서를 작성해주세요',
            ];
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
    const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

    // 탭 상태
    const [activeTab, setActiveTab] = useState<ConsultMode>('prediction');
    // 탭별 독립 세션
    const [tabSessions, setTabSessions] = useState<Record<string, {
        sessionId: string | null;
        messages: Message[];
        initialized: boolean;
        initializing: boolean;
        error: string | null;
    }>>({
        prediction: { sessionId: null, messages: [], initialized: false, initializing: false, error: null },
        response: { sessionId: null, messages: [], initialized: false, initializing: false, error: null },
        evidence: { sessionId: null, messages: [], initialized: false, initializing: false, error: null },
        compensation: { sessionId: null, messages: [], initialized: false, initializing: false, error: null },
        document: { sessionId: null, messages: [], initialized: false, initializing: false, error: null },
    });

    // 채팅 상태
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 이전 단계 미완료 시 리다이렉트
    useEffect(() => {
        if (!state.caseId) { router.push('/case-input'); return; }
        if (!state.issueResult) { router.push('/issue-analysis'); return; }
    }, [state.caseId, state.issueResult, router]);

    // 현재 탭 데이터
    const currentTab = tabSessions[activeTab];
    const messages = currentTab.messages;
    const sessionId = currentTab.sessionId;
    const isInitializing = currentTab.initializing;
    const error = currentTab.error;

    // 메시지 스크롤
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, activeTab]);

    if (!state.caseId || !state.issueResult) return null;

    const issues = state.issueResult.issues || [];
    const allNodes = state.lawResult?.nodes || state.issueResult.nodes || [];
    const lawNodes = allNodes
        .filter(n => n.type !== 'case' && n.type !== 'issue')
        .map(n => ({ title: n.label, type: n.type || 'law', detail: n.detail || '', label: n.label }));
    const summaryText = state.issueResult.summary + (state.lawResult?.summary ? '\n\n' + state.lawResult.summary : '');
    const suggestions = getTabSuggestions(activeTab, issues);

    // 상담 세션 시작 (탭별)
    const startConsultation = async (mode?: ConsultMode) => {
        setShowBriefing(false);
        const tab = mode || activeTab;
        if (mode) setActiveTab(tab);
        await initTabSession(tab);
    };

    const initTabSession = async (tab: ConsultMode) => {
        const ts = tabSessions[tab];
        if (ts.initialized || ts.initializing) return;

        setTabSessions(prev => ({
            ...prev,
            [tab]: { ...prev[tab], initializing: true, error: null }
        }));

        try {
            const result = await createContextualSession({
                caseDescription: state.description,
                issues,
                laws: lawNodes,
                summary: summaryText,
                caseId: state.caseId || undefined,
                consultMode: tab,
            } as any);

            setTabSessions(prev => ({
                ...prev,
                [tab]: {
                    sessionId: result.sessionId,
                    messages: [{
                        id: Date.now(),
                        role: 'assistant' as const,
                        content: result.welcomeMessage,
                        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                    }],
                    initialized: true,
                    initializing: false,
                    error: null,
                }
            }));
        } catch (err: any) {
            console.error('세션 생성 오류:', err);
            setTabSessions(prev => ({
                ...prev,
                [tab]: { ...prev[tab], initializing: false, error: err.message }
            }));
        }
    };

    // 메시지 전송
    const handleSend = async (customMessage?: string) => {
        const messageText = customMessage || input.trim();
        if (!messageText || isLoading || !sessionId) return;
        setInput('');

        const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        setTabSessions(prev => ({
            ...prev,
            [activeTab]: {
                ...prev[activeTab],
                messages: [...prev[activeTab].messages, { id: Date.now(), role: 'user' as const, content: messageText, time: now }]
            }
        }));
        setIsLoading(true);

        try {
            const response = await sendContextualMessage(sessionId, messageText);
            setTabSessions(prev => ({
                ...prev,
                [activeTab]: {
                    ...prev[activeTab],
                    messages: [...prev[activeTab].messages, {
                        id: Date.now() + 1,
                        role: 'assistant' as const,
                        content: response.message,
                        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                    }]
                }
            }));
        } catch (err: any) {
            setTabSessions(prev => ({
                ...prev,
                [activeTab]: {
                    ...prev[activeTab],
                    messages: [...prev[activeTab].messages, {
                        id: Date.now() + 1,
                        role: 'assistant' as const,
                        content: `오류가 발생했습니다: ${err.message}`,
                        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                    }]
                }
            }));
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

    // 탭 전환
    const handleTabChange = async (tab: ConsultMode) => {
        setActiveTab(tab);
        setInput('');
        if (!tabSessions[tab].initialized && !tabSessions[tab].initializing) {
            await initTabSession(tab);
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

                            {/* 쟁점별 승소 가능성 */}
                            <div className={styles.briefingCard}>
                                <div className={styles.briefingCardTitle}>📊 쟁점별 승소 가능성 예측</div>
                                <div className={styles.winRateList}>
                                    {issues
                                        .sort((a, b) => {
                                            const order = { high: 0, medium: 1, low: 2 };
                                            return (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3);
                                        })
                                        .map(issue => {
                                            const rate = issue.winRate ?? 50;
                                            const color = getWinRateColor(rate);
                                            const isExpanded = expandedIssueId === issue.id;
                                            return (
                                                <div key={issue.id} className={styles.winRateItem}>
                                                    <div
                                                        className={styles.winRateHeader}
                                                        onClick={() => setExpandedIssueId(isExpanded ? null : issue.id)}
                                                    >
                                                        <div className={styles.winRateInfo}>
                                                            <span
                                                                className={styles.issueChipDot}
                                                                style={{ background: SEVERITY_COLORS[issue.severity] }}
                                                            />
                                                            <span className={styles.winRateTitle}>{issue.title}</span>
                                                            <span className={styles.winRateExpandIcon}>{isExpanded ? '▲' : '▼'}</span>
                                                        </div>
                                                        <div className={styles.winRateBarRow}>
                                                            <div className={styles.winRateBarTrack}>
                                                                <div
                                                                    className={styles.winRateBarFill}
                                                                    style={{ width: `${rate}%`, background: color }}
                                                                />
                                                            </div>
                                                            <span className={styles.winRatePercent} style={{ color }}>{rate}%</span>
                                                        </div>
                                                    </div>
                                                    {isExpanded && (
                                                        <div className={styles.winRateDetail}>
                                                            {issue.winRateReason && (
                                                                <p className={styles.winRateReason}>💡 {issue.winRateReason}</p>
                                                            )}
                                                            {(issue.favorableFactors?.length ?? 0) > 0 && (
                                                                <div className={styles.factorGroup}>
                                                                    <span className={styles.factorLabel}>✅ 유리한 요소</span>
                                                                    <ul className={styles.factorList}>
                                                                        {issue.favorableFactors!.map((f, i) => (
                                                                            <li key={i}>{f}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                            {(issue.unfavorableFactors?.length ?? 0) > 0 && (
                                                                <div className={styles.factorGroup}>
                                                                    <span className={styles.factorLabel}>⚠️ 불리한 요소</span>
                                                                    <ul className={styles.factorList}>
                                                                        {issue.unfavorableFactors!.map((f, i) => (
                                                                            <li key={i}>{f}</li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
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

                            {/* AI 분석 요약 + 종합 승률 */}
                            {state.issueResult.summary && (
                                <div className={styles.briefingCard}>
                                    <div className={styles.briefingCardTitle}>🎯 AI 종합 판단</div>
                                    <div className={styles.overallWinRateSection}>
                                        {state.issueResult.overallWinRate != null && (
                                            <div className={styles.donutContainer}>
                                                <svg className={styles.donut} viewBox="0 0 100 100">
                                                    <circle cx="50" cy="50" r="40" fill="none" stroke="var(--toss-border)" strokeWidth="8" />
                                                    <circle
                                                        cx="50" cy="50" r="40" fill="none"
                                                        stroke={getWinRateColor(state.issueResult.overallWinRate)}
                                                        strokeWidth="8"
                                                        strokeDasharray={`${state.issueResult.overallWinRate * 2.51} ${251 - state.issueResult.overallWinRate * 2.51}`}
                                                        strokeDashoffset="62.8"
                                                        strokeLinecap="round"
                                                        className={styles.donutFill}
                                                    />
                                                </svg>
                                                <div className={styles.donutCenter}>
                                                    <span className={styles.donutPercent} style={{ color: getWinRateColor(state.issueResult.overallWinRate) }}>
                                                        {state.issueResult.overallWinRate}%
                                                    </span>
                                                    <span className={styles.donutLabel}>
                                                        {getWinRateLabel(state.issueResult.overallWinRate)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        <div className={styles.overallTextSection}>
                                            {state.issueResult.overallAssessment && (
                                                <p className={styles.overallAssessment}>{state.issueResult.overallAssessment}</p>
                                            )}
                                            <p className={styles.briefingCardBody}>
                                                {state.issueResult.summary.length > 200
                                                    ? state.issueResult.summary.substring(0, 200) + '...'
                                                    : state.issueResult.summary}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={styles.disclaimer}>
                            ⚠️ AI 예측은 참고용이며 법적 구속력이 없습니다. 정확한 판단은 노무사·변호사 상담을 권장합니다.
                        </div>

                        <button className={styles.startBtn} onClick={() => startConsultation()}>
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
                                    {issue.winRate != null && (
                                        <span
                                            className={styles.sideWinBadge}
                                            style={{
                                                background: `${getWinRateColor(issue.winRate)}15`,
                                                color: getWinRateColor(issue.winRate),
                                            }}
                                        >
                                            {issue.winRate}%
                                        </span>
                                    )}
                                </div>
                                {issue.winRate != null && (
                                    <div className={styles.sideWinBar}>
                                        <div
                                            className={styles.sideWinBarFill}
                                            style={{
                                                width: `${issue.winRate}%`,
                                                background: getWinRateColor(issue.winRate),
                                            }}
                                        />
                                    </div>
                                )}
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
                            <span className={styles.chatTitle}>
                                {CONSULT_TABS.find(t => t.mode === activeTab)?.icon} {CONSULT_TABS.find(t => t.mode === activeTab)?.label} 상담
                            </span>
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

                    {/* ═══ 상담 모드 탭 바 ═══ */}
                    <div className={styles.consultTabBar}>
                        {CONSULT_TABS.map(tab => (
                            <button
                                key={tab.mode}
                                className={`${styles.consultTab} ${activeTab === tab.mode ? styles.consultTabActive : ''}`}
                                onClick={() => handleTabChange(tab.mode)}
                            >
                                <span className={styles.consultTabIcon}>{tab.icon}</span>
                                <span className={styles.consultTabLabel}>{tab.label}</span>
                            </button>
                        ))}
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
                                    onClick={() => {
                                        setTabSessions(prev => ({
                                            ...prev,
                                            [activeTab]: { ...prev[activeTab], initialized: false, error: null }
                                        }));
                                        initTabSession(activeTab);
                                    }}
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
