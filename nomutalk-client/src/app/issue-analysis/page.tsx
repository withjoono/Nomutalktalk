'use client';

import React, { useState } from 'react';
import IssueAnalysisView from '@/components/case-consultation/IssueAnalysisView';
import { GraphNode, GraphLink, IssueInfo, analyzeIssues } from '@/lib/api';
import styles from './page.module.css';

const CASE_TYPES = [
    { value: '', label: '사건 유형 선택 (선택사항)' },
    { value: '부당해고', label: '⚠️ 부당해고' },
    { value: '임금체불', label: '💰 임금체불' },
    { value: '산업재해', label: '🏥 산업재해' },
    { value: '근로시간', label: '⏰ 근로시간/초과근무' },
    { value: '직장내괴롭힘', label: '😤 직장 내 괴롭힘' },
    { value: '퇴직금', label: '📋 퇴직금' },
    { value: '차별', label: '🚫 차별/성희롱' },
    { value: '기타', label: '📌 기타' },
];

export default function IssueAnalysisPage() {
    const [caseType, setCaseType] = useState('');
    const [caseDescription, setCaseDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // 분석 결과
    const [analyzed, setAnalyzed] = useState(false);
    const [issues, setIssues] = useState<IssueInfo[]>([]);
    const [summary, setSummary] = useState('');
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [links, setLinks] = useState<GraphLink[]>([]);

    const handleAnalyze = async () => {
        if (!caseDescription.trim()) {
            setError('사건 내용을 입력해주세요.');
            return;
        }

        setIsLoading(true);
        setError('');
        setAnalyzed(false);

        try {
            const desc = caseType
                ? `[사건유형: ${caseType}] ${caseDescription.trim()}`
                : caseDescription.trim();

            const result = await analyzeIssues(desc);

            setIssues(result.issues || []);
            setSummary(result.summary || '');
            setNodes(result.nodes || []);
            setLinks(result.links || []);
            setAnalyzed(true);
        } catch (err: any) {
            setError(err.message || '쟁점 분석에 실패했습니다. 다시 시도해주세요.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        setAnalyzed(false);
        setIssues([]);
        setSummary('');
        setNodes([]);
        setLinks([]);
        setError('');
    };

    const handleNodesUpdate = (n: GraphNode[], l: GraphLink[]) => {
        setNodes(n);
        setLinks(l);
    };

    return (
        <div className={styles.page}>
            {/* 입력 영역 (분석 전) */}
            {!analyzed && (
                <div className={styles.inputSection}>
                    <h1 className={styles.title}>🔥 핵심 쟁점 분석</h1>
                    <p className={styles.subtitle}>
                        사건 내용을 입력하면 AI가 핵심 법적 쟁점을 분석하고,<br />
                        각 쟁점별 관련 법령·판례를 그래프로 시각화합니다.
                    </p>

                    {/* 사건 유형 */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>사건 유형</label>
                        <select
                            className={styles.select}
                            value={caseType}
                            onChange={(e) => setCaseType(e.target.value)}
                        >
                            {CASE_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* 사건 내용 */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>
                            사건 내용 <span className={styles.required}>*</span>
                        </label>
                        <textarea
                            className={styles.textarea}
                            value={caseDescription}
                            onChange={(e) => setCaseDescription(e.target.value)}
                            placeholder={"사건 내용을 상세히 작성해주세요.\n\n예시:\n- 근무 기간: 2024년 3월 ~ 2025년 2월\n- 사업장 규모: 직원 30명\n- 상황: 정당한 사유 없이 해고 통보를 받음\n- 퇴직금과 미지급 임금이 있음"}
                            rows={8}
                        />
                        <span className={styles.charCount}>{caseDescription.length}자</span>
                    </div>

                    {/* 에러 */}
                    {error && (
                        <div className={styles.errorMsg}>⚠️ {error}</div>
                    )}

                    {/* 분석 버튼 */}
                    <button
                        className={styles.analyzeBtn}
                        onClick={handleAnalyze}
                        disabled={isLoading || !caseDescription.trim()}
                    >
                        {isLoading ? (
                            <>
                                <span className={styles.spinner} />
                                AI가 쟁점을 분석하고 있습니다...
                            </>
                        ) : (
                            '🔥 핵심 쟁점 분석 시작'
                        )}
                    </button>

                    {isLoading && (
                        <p className={styles.loadingHint}>
                            쟁점 추출 → 쟁점별 법령/판례 검색 중... (약 10~20초 소요)
                        </p>
                    )}
                </div>
            )}

            {/* 분석 결과 */}
            {analyzed && (
                <div className={styles.resultSection}>
                    <div className={styles.resultHeader}>
                        <h2 className={styles.resultTitle}>🔥 쟁점 분석 결과</h2>
                        <button className={styles.resetBtn} onClick={handleReset}>
                            ← 다시 분석하기
                        </button>
                    </div>

                    <IssueAnalysisView
                        issues={issues}
                        summary={summary}
                        nodes={nodes}
                        links={links}
                        onProceedToChat={() => { }}
                        onNodesUpdate={handleNodesUpdate}
                    />
                </div>
            )}
        </div>
    );
}
