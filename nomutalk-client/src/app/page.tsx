import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
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
