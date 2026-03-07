'use client';

import Link from 'next/link';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();

  // Show nothing while checking auth state
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(102,126,234,0.2)', borderTopColor: '#667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Non-logged-in: show promo landing page (full viewport)
  if (!user) {
    return (
      <iframe
        src="/promo.html"
        title="노무톡 소개"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          border: 'none',
          zIndex: 9999,
        }}
      />
    );
  }

  // Logged-in: show main dashboard
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.iconWrapper}>
          <span className={styles.icon}>⚖️</span>
        </div>
        <h1 className={styles.title}>
          AI 공인노무사와 함께하는<br />
          실시간 법률 상담
        </h1>
        <p className={styles.subtitle}>
          노동법령과 판례를 기반으로 체계적인 맞춤 상담을<br />
          제공합니다. 지금 바로 시작해보세요.
        </p>
        <Link href="/chat" className={styles.ctaButton}>
          무료 상담 시작하기
        </Link>
      </div>

      <div className={styles.features}>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>💬</span>
          <h3 className={styles.featureTitle}>AI 대화형 상담</h3>
          <p className={styles.featureDesc}>진단 → 법적 분석 → 대안 제안 순으로 체계적 상담</p>
        </div>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>📚</span>
          <h3 className={styles.featureTitle}>법령·판례 검색</h3>
          <p className={styles.featureDesc}>노동법령, 판례, 행정해석 통합 검색</p>
        </div>
        <div className={styles.featureCard}>
          <span className={styles.featureIcon}>📊</span>
          <h3 className={styles.featureTitle}>사건 분석</h3>
          <p className={styles.featureDesc}>사건 관련 법률 지식 그래프 시각화</p>
        </div>
      </div>
    </div>
  );
}
