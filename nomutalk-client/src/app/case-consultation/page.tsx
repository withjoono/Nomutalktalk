'use client';

import React, { useState } from 'react';
import ConsultationStepper from '@/components/case-consultation/ConsultationStepper';
import CaseMaterialUpload from '@/components/case-consultation/CaseMaterialUpload';
import CaseAnalysisView from '@/components/case-consultation/CaseAnalysisView';
import IssueAnalysisView from '@/components/case-consultation/IssueAnalysisView';
import CaseChatPanel from '@/components/case-consultation/CaseChatPanel';
import { GraphNode, GraphLink, CaseSessionResult, IssueInfo, createCaseSession, analyzeIssues } from '@/lib/api';
import styles from './page.module.css';

export default function CaseConsultationPage() {
    const [currentStep, setCurrentStep] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // 세션 데이터
    const [sessionResult, setSessionResult] = useState<CaseSessionResult | null>(null);
    const [caseDescription, setCaseDescription] = useState('');
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [links, setLinks] = useState<GraphLink[]>([]);

    // 쟁점 분석 데이터
    const [issues, setIssues] = useState<IssueInfo[]>([]);
    const [issueSummary, setIssueSummary] = useState('');
    const [useIssueView, setUseIssueView] = useState(false);

    // Step 1: 자료 제출 → 분석
    const handleSubmit = async (description: string, files: File[]) => {
        setIsLoading(true);
        setError('');
        setCaseDescription(description);

        try {
            // 쟁점 분석과 기존 세션 생성을 병렬로 수행
            const [issueResult, sessionResultData] = await Promise.allSettled([
                analyzeIssues(description),
                createCaseSession(description, files),
            ]);

            // 기존 세션 결과 처리
            if (sessionResultData.status === 'fulfilled') {
                setSessionResult(sessionResultData.value);
            }

            // 쟁점 분석 결과 처리 (우선 사용)
            if (issueResult.status === 'fulfilled' && issueResult.value.issues?.length > 0) {
                const ir = issueResult.value;
                setIssues(ir.issues);
                setIssueSummary(ir.summary);
                setNodes(ir.nodes);
                setLinks(ir.links);
                setUseIssueView(true);
            } else if (sessionResultData.status === 'fulfilled') {
                // 쟁점 분석 실패 시 기존 세션 결과 사용
                setNodes(sessionResultData.value.nodes);
                setLinks(sessionResultData.value.links);
                setUseIssueView(false);
            } else {
                throw new Error('분석에 실패했습니다.');
            }

            setCurrentStep(1);
        } catch (err: any) {
            setError(err.message || '분석에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2 → Step 3
    const handleProceedToChat = () => {
        setCurrentStep(2);
    };

    // 노드 업데이트 (확장 시)
    const handleNodesUpdate = (n: GraphNode[], l: GraphLink[]) => {
        setNodes(n);
        setLinks(l);
    };

    return (
        <div className={styles.page}>
            <ConsultationStepper currentStep={currentStep} />

            {currentStep === 0 && (
                <CaseMaterialUpload
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                    error={error}
                />
            )}

            {currentStep === 1 && useIssueView && (
                <IssueAnalysisView
                    issues={issues}
                    summary={issueSummary}
                    nodes={nodes}
                    links={links}
                    onProceedToChat={handleProceedToChat}
                    onNodesUpdate={handleNodesUpdate}
                />
            )}

            {currentStep === 1 && !useIssueView && sessionResult && (
                <CaseAnalysisView
                    summary={sessionResult.summary}
                    similarCasesSummary={sessionResult.similarCasesSummary}
                    nodes={nodes}
                    links={links}
                    onProceedToChat={handleProceedToChat}
                    onNodesUpdate={handleNodesUpdate}
                />
            )}

            {currentStep === 2 && sessionResult && (
                <CaseChatPanel
                    chatSessionId={sessionResult.chatSessionId}
                    nodes={nodes}
                    links={links}
                    caseDescription={caseDescription}
                />
            )}
        </div>
    );
}

