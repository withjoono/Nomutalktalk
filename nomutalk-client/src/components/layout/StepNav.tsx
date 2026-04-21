'use client';

import React from 'react';
import { useCaseFlow } from '@/context/CaseFlowContext';
import styles from './StepNav.module.css';

// 사용자에게 보여주는 3단계 (내부 6단계를 그룹핑)
const VISUAL_STEPS = [
    { group: 0, label: '사건 입력', icon: '✏️', internalSteps: [0] },
    { group: 1, label: '분석 결과', icon: '📊', internalSteps: [1, 2, 3] },
    { group: 2, label: '해결 방법', icon: '💡', internalSteps: [4, 5] },
];

// 내부 step → 그룹 매핑
function stepToGroup(internalStep: number): number {
    if (internalStep <= 0) return 0;
    if (internalStep <= 3) return 1;
    return 2;
}

// 그룹 → 내부 첫 step
function groupToStep(group: number): number {
    return [0, 1, 4][group] || 0;
}

// 내부 step → 이전/다음 내부 step 라벨
const INTERNAL_STEPS = [
    { step: 0, label: '사건 입력', icon: '✏️' },
    { step: 1, label: '쟁점 분석', icon: '⚖️' },
    { step: 2, label: '관련 법령', icon: '📚' },
    { step: 3, label: '예상 결과', icon: '📊' },
    { step: 4, label: '대안 제안', icon: '💡' },
    { step: 5, label: '후속 지원', icon: '🔗' },
];

interface StepNavProps {
    currentStep: number;
}

export default function StepNav({ currentStep }: StepNavProps) {
    const { goToStep, state } = useCaseFlow();

    const currentGroup = stepToGroup(currentStep);
    const prev = INTERNAL_STEPS[currentStep - 1];
    const next = INTERNAL_STEPS[currentStep + 1];
    const canGoNext = !!state.caseId;

    return (
        <div className={styles.stepNav}>
            <div className={styles.navRow}>
                {prev ? (
                    <button className={styles.prevBtn} onClick={() => goToStep(prev.step)}>
                        ← {prev.label}
                    </button>
                ) : (
                    <div />
                )}

                {next ? (
                    <button
                        className={styles.nextBtn}
                        onClick={() => goToStep(next.step)}
                        disabled={!canGoNext}
                    >
                        {next.label} →
                    </button>
                ) : (
                    <div />
                )}
            </div>

            {/* 3단계 인디케이터 */}
            <div className={styles.stepIndicator}>
                {VISUAL_STEPS.map((vs) => (
                    <button
                        key={vs.group}
                        className={`${styles.dot} ${vs.group === currentGroup ? styles.dotActive : ''} ${vs.group < currentGroup ? styles.dotDone : ''}`}
                        onClick={() => goToStep(groupToStep(vs.group))}
                        title={vs.label}
                    >
                        <span className={styles.dotLabel}>{vs.icon}</span>
                        <span className={styles.dotText}>{vs.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
