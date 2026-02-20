'use client';

import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';
import Link from 'next/link';

export default function HistoryPage() {
    const { user } = useAuth();

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>상담 기록</h1>
            <p className={styles.subtitle}>이전 상담 내역을 확인하세요</p>

            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>💬</div>
                <h3 className={styles.emptyTitle}>아직 상담 기록이 없습니다</h3>
                <p className={styles.emptyDesc}>
                    AI 노무사와 상담을 시작하면<br />
                    이곳에서 기록을 확인할 수 있습니다.
                </p>
                <Link href="/chat" className={styles.ctaButton}>
                    상담 시작하기
                </Link>
            </div>
        </div>
    );
}
