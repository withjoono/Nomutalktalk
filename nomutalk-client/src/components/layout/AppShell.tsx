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
            {/* Top Header - Login, Payment, Notification icons */}
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
                {/* Sidebar - Hidden on Mobile */}
                <aside className={styles.sidebar}>
                    <div className={styles.logo}>NomuTalk</div>
                    <nav className={styles.nav}>
                        <Link href="/chat" className={`${styles.navItem} ${isActive('/chat') ? styles.active : ''}`}>
                            💬 Chat
                        </Link>
                        <Link href="/laws" className={`${styles.navItem} ${isActive('/laws') ? styles.active : ''}`}>
                            📚 Laws
                        </Link>
                        <Link href="/history" className={`${styles.navItem} ${isActive('/history') ? styles.active : ''}`}>
                            📜 History
                        </Link>
                        <div className={styles.spacer} />
                        <Link href="/payment" className={`${styles.navItem} ${isActive('/payment') ? styles.active : ''}`}>
                            💳 Payment
                        </Link>
                        <Link href="/profile" className={`${styles.navItem} ${isActive('/profile') ? styles.active : ''}`}>
                            👤 Profile
                        </Link>
                    </nav>
                </aside>

                {/* Main Content Area */}
                <main className={styles.main}>
                    {children}
                </main>
            </div>

            {/* Bottom Tabs - Hidden on Desktop */}
            <nav className={styles.bottomTabs}>
                <Link href="/chat" className={`${styles.tabItem} ${isActive('/chat') ? styles.activeTab : ''}`}>
                    <span>💬</span>
                    <span>Chat</span>
                </Link>
                <Link href="/laws" className={`${styles.tabItem} ${isActive('/laws') ? styles.activeTab : ''}`}>
                    <span>📚</span>
                    <span>Laws</span>
                </Link>
                <Link href="/history" className={`${styles.tabItem} ${isActive('/history') ? styles.activeTab : ''}`}>
                    <span>📜</span>
                    <span>History</span>
                </Link>
                <Link href="/profile" className={`${styles.tabItem} ${isActive('/profile') ? styles.activeTab : ''}`}>
                    <span>👤</span>
                    <span>Profile</span>
                </Link>
            </nav>
        </div>
    );
}
