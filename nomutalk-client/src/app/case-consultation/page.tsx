'use client';

import React, { useState } from 'react';
import ConsultationStepper from '@/components/case-consultation/ConsultationStepper';
import CaseMaterialUpload from '@/components/case-consultation/CaseMaterialUpload';
import CaseAnalysisView from '@/components/case-consultation/CaseAnalysisView';
import CaseChatPanel from '@/components/case-consultation/CaseChatPanel';
import { GraphNode, GraphLink, CaseSessionResult, createCaseSession } from '@/lib/api';
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

    // Step 1: 자료 제출 → 분석
    const handleSubmit = async (description: string, files: File[]) => {
        setIsLoading(true);
        setError('');
        setCaseDescription(description);

        try {
            const result = await createCaseSession(description, files);
            setSessionResult(result);
            setNodes(result.nodes);
            setLinks(result.links);
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

            {currentStep === 1 && sessionResult && (
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
