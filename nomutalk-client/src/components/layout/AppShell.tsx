'use client';

import React from 'react';
import styles from './AppShell.module.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface AppShellProps {
    children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
    const pathname = usePathname();
    const { user } = useAuth();

    const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

    return (
        <div className={styles.container}>
            {/* Top Header */}
            <header className={styles.topHeader}>
                <Link href="/" className={styles.headerLogo}>
                    NomuTalk
                </Link>
                <div className={styles.headerIcons}>
                    <Link href="/payment" className={`${styles.headerIcon} ${isActive('/payment') ? styles.headerIconActive : ''}`} title="결제">
                        💳
                    </Link>
                    <button className={styles.headerIcon} title="알림">
                        🔔
                    </button>
                    <Link href={user ? "/profile" : "/auth/login"} className={`${styles.headerIcon} ${isActive('/profile') || isActive('/auth') ? styles.headerIconActive : ''}`} title={user ? "프로필" : "로그인"}>
                        {user ? '👤' : '🔐'}
                    </Link>
                </div>
            </header>

            <div className={styles.bodyWrapper}>
                {/* Sidebar */}
                <aside className={styles.sidebar}>
                    <div className={styles.logo}>NomuTalk</div>
                    <nav className={styles.nav}>
                        <Link href="/case-input" className={`${styles.navItem} ${isActive('/case-input') ? styles.active : ''}`}>
                            📁 사건 입력
                        </Link>
                        <Link href="/case-search" className={`${styles.navItem} ${isActive('/case-search') ? styles.active : ''}`}>
                            🔎 사건 분석
                        </Link>
                        <Link href="/chat" className={`${styles.navItem} ${isActive('/chat') ? styles.active : ''}`}>
                            💬 AI 상담
                        </Link>
                        <Link href="/laws" className={`${styles.navItem} ${isActive('/laws') ? styles.active : ''}`}>
                            📚 법령 검색
                        </Link>
                        <div className={styles.spacer} />
                        <Link href="/payment" className={`${styles.navItem} ${isActive('/payment') ? styles.active : ''}`}>
                            💳 결제
                        </Link>
                        <Link href="/profile" className={`${styles.navItem} ${isActive('/profile') ? styles.active : ''}`}>
                            👤 내 정보
                        </Link>
                    </nav>
                </aside>

                {/* Main Content */}
                <main className={styles.main}>
                    {children}
                </main>
            </div>

            {/* Bottom Tabs (Mobile) */}
            <nav className={styles.bottomTabs}>
                <Link href="/case-input" className={`${styles.tabItem} ${isActive('/case-input') ? styles.activeTab : ''}`}>
                    <span>📁</span>
                    <span>입력</span>
                </Link>
                <Link href="/case-search" className={`${styles.tabItem} ${isActive('/case-search') ? styles.activeTab : ''}`}>
                    <span>🔎</span>
                    <span>분석</span>
                </Link>
                <Link href="/chat" className={`${styles.tabItem} ${isActive('/chat') ? styles.activeTab : ''}`}>
                    <span>💬</span>
                    <span>상담</span>
                </Link>
                <Link href="/laws" className={`${styles.tabItem} ${isActive('/laws') ? styles.activeTab : ''}`}>
                    <span>📚</span>
                    <span>법령</span>
                </Link>
            </nav>
        </div>
    );
}
