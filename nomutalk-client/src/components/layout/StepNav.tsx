'use client';

import React from 'react';
import { useCaseFlow } from '@/context/CaseFlowContext';
import styles from './StepNav.module.css';

const STEPS = [
    { step: 0, label: '내 사건', icon: '📂' },
    { step: 1, label: '핵심 쟁점', icon: '🔥' },
    { step: 2, label: '관련 법령', icon: '⚖️' },
    { step: 3, label: 'AI 상담', icon: '💬' },
];

interface StepNavProps {
    currentStep: number;
}

export default function StepNav({ currentStep }: StepNavProps) {
    const { goToStep, state } = useCaseFlow();

    const prev = STEPS[currentStep - 1];
    const next = STEPS[currentStep + 1];

    // 다음 단계는 사건이 있을 때만 활성화
    const canGoNext = !!state.caseId;

    return (
        <div className={styles.stepNav}>
            <div className={styles.navRow}>
                {prev ? (
                    <button className={styles.prevBtn} onClick={() => goToStep(prev.step)}>
                        ← {prev.icon} {prev.label}
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
                        {next.icon} {next.label} →
                    </button>
                ) : (
                    <div />
                )}
            </div>

            {/* 단계 인디케이터 */}
            <div className={styles.stepIndicator}>
                {STEPS.map((s) => (
                    <button
                        key={s.step}
                        className={`${styles.dot} ${s.step === currentStep ? styles.dotActive : ''} ${s.step < currentStep ? styles.dotDone : ''}`}
                        onClick={() => goToStep(s.step)}
                        title={s.label}
                    >
                        <span className={styles.dotLabel}>{s.icon}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
