'use client';

import React from 'react';
import styles from './ConsultationStepper.module.css';

interface Step {
    label: string;
    icon: string;
}

const STEPS: Step[] = [
    { label: '자료 수집', icon: '📁' },
    { label: 'AI 분석', icon: '📊' },
    { label: '상담', icon: '💬' },
];

interface Props {
    currentStep: number; // 0, 1, 2
}

export default function ConsultationStepper({ currentStep }: Props) {
    return (
        <div className={styles.stepper}>
            {STEPS.map((step, idx) => (
                <React.Fragment key={idx}>
                    {idx > 0 && (
                        <div className={`${styles.connector} ${idx <= currentStep ? styles.connectorActive : ''}`} />
                    )}
                    <div className={`${styles.step} ${idx === currentStep ? styles.active : ''} ${idx < currentStep ? styles.completed : ''}`}>
                        <span className={styles.stepNumber}>
                            {idx < currentStep ? '✓' : idx + 1}
                        </span>
                        <span>{step.icon}</span>
                        <span className={styles.stepLabel}>{step.label}</span>
                    </div>
                </React.Fragment>
            ))}
        </div>
    );
}
