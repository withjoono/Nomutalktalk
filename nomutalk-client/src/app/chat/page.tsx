'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCaseFlow } from '@/context/CaseFlowContext';
import CaseConsultationChat from '@/components/case-consultation/CaseConsultationChat';
import StepNav from '@/components/layout/StepNav';

export default function ChatPage() {
    const router = useRouter();
    const { state } = useCaseFlow();

    // 이전 단계가 완료되지 않았으면 리다이렉트
    useEffect(() => {
        if (!state.caseId) {
            router.push('/case-input');
            return;
        }
        if (!state.issueResult) {
            router.push('/issue-analysis');
            return;
        }
    }, [state.caseId, state.issueResult, router]);

    if (!state.caseId || !state.issueResult) {
        return null; // 리다이렉트 중
    }

    // 법령 분석 결과에서 법령 노드 추출 (center 제외)
    const lawNodes = (state.lawResult?.nodes || [])
        .filter(n => n.type !== 'case')
        .map(n => ({
            title: n.label,
            type: n.type || 'law',
            detail: n.detail || '',
            label: n.label,
        }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
                <CaseConsultationChat
                    caseDescription={state.description}
                    issues={state.issueResult.issues}
                    laws={lawNodes}
                    summary={state.issueResult.summary + (state.lawResult?.summary ? '\n\n' + state.lawResult.summary : '')}
                />
            </div>
            <div style={{ padding: '0 16px 16px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
                <StepNav currentStep={3} />
            </div>
        </div>
    );
}
