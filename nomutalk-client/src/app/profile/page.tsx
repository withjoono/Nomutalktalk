'use client';

import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function ProfilePage() {
    const { user, logout } = useAuth();

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>내 정보</h1>
            <p className={styles.subtitle}>계정 설정 및 프로필 관리</p>

            {user ? (
                <div className={styles.profileCard}>
                    <div className={styles.avatarWrapper}>
                        {user.photoURL ? (
                            <img src={user.photoURL} alt="프로필" className={styles.avatarImg} />
                        ) : (
                            <div className={styles.avatarFallback}>
                                {user.displayName?.charAt(0) || '👤'}
                            </div>
                        )}
                    </div>
                    <div className={styles.info}>
                        <h2 className={styles.name}>{user.displayName || '사용자'}</h2>
                        <p className={styles.email}>{user.email}</p>
                    </div>

                    <div className={styles.menuList}>
                        <div className={styles.menuItem}>
                            <span>💳 결제 관리</span>
                            <span className={styles.chevron}>›</span>
                        </div>
                        <div className={styles.menuItem}>
                            <span>📋 상담 기록</span>
                            <span className={styles.chevron}>›</span>
                        </div>
                        <div className={styles.menuItem}>
                            <span>🔔 알림 설정</span>
                            <span className={styles.chevron}>›</span>
                        </div>
                    </div>

                    <button className={styles.logoutButton} onClick={logout}>
                        로그아웃
                    </button>
                </div>
            ) : (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>🔐</div>
                    <p className={styles.emptyDesc}>로그인 후 이용할 수 있습니다.</p>
                </div>
            )}
        </div>
    );
}
