'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useCaseFlow } from '@/context/CaseFlowContext';
import styles from './page.module.css';

const INTENT_META: Record<string, { icon: string; label: string; heroClass: string; badgeClass: string }> = {
    document: { icon: '📄', label: '문서 생성', heroClass: 'hero-purple', badgeClass: styles.intentDocument },
    calculation: { icon: '🔢', label: '계산 결과', heroClass: 'hero-emerald', badgeClass: styles.intentCalculation },
    information: { icon: '📚', label: '법률 정보', heroClass: 'hero-blue', badgeClass: styles.intentInformation },
};

/** 간단한 마크다운 → HTML 변환 */
function renderMarkdown(md: string): string {
    return md
        // 코드 블록
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // 인라인 코드
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // 헤더
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // 볼드
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // 이탤릭
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // 인용
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        // 리스트
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
        // 테이블 (기본)
        .replace(/\|(.+)\|/g, (match) => {
            const cells = match.split('|').filter(c => c.trim());
            if (cells.every(c => /^[-:]+$/.test(c.trim()))) return '';
            const tag = match.includes('---') ? 'th' : 'td';
            return '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
        })
        // 줄바꿈
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>');
}

export default function QuickResultPage() {
    const router = useRouter();
    const { state, resetFlow } = useCaseFlow();
    const result = state.quickAssistResult;
    const intent = state.detectedIntent || 'information';
    const meta = INTENT_META[intent] || INTENT_META.information;

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
                        {intent === 'document' ? '문서를 작성하고 있습니다...' :
                         intent === 'calculation' ? '계산하고 있습니다...' :
                         '답변을 준비하고 있습니다...'}
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

            {/* ── 결과 카드 ── */}
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

            {/* ── 하단 CTA ── */}
            <div className={styles.ctaSection}>
                <button
                    className={`${styles.ctaBtn} ${styles.ctaSecondary}`}
                    onClick={() => { resetFlow(); router.push('/case-input'); }}
                >
                    ← 새 요청
                </button>
                <button
                    className={`${styles.ctaBtn} ${styles.ctaPrimary}`}
                    onClick={() => { resetFlow(); router.push('/case-input'); }}
                >
                    ⚖️ 분쟁 분석이 필요하신가요?
                </button>
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
