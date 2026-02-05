'use client';

import React from 'react';
import styles from './AppShell.module.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AppShellProps {
    children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

    return (
        <div className={styles.container}>
            {/* Sidebar - Hidden on Mobile */}
            <aside className={styles.sidebar}>
                <div className={styles.logo}>NomuTalk</div>
                <nav className={styles.nav}>
                    <Link href="/chat" className={`${styles.navItem} ${isActive('/chat') ? styles.active : ''}`}>
                        Chat
                    </Link>
                    <Link href="/laws" className={`${styles.navItem} ${isActive('/laws') ? styles.active : ''}`}>
                        Laws
                    </Link>
                    <Link href="/history" className={`${styles.navItem} ${isActive('/history') ? styles.active : ''}`}>
                        History
                    </Link>
                    <div className={styles.spacer} />
                    <Link href="/profile" className={`${styles.navItem} ${isActive('/profile') ? styles.active : ''}`}>
                        Profile
                    </Link>
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className={styles.main}>
                {children}
            </main>

            {/* Bottom Tabs - Hidden on Desktop */}
            <nav className={styles.bottomTabs}>
                <Link href="/chat" className={`${styles.tabItem} ${isActive('/chat') ? styles.activeTab : ''}`}>
                    Chat
                </Link>
                <Link href="/laws" className={`${styles.tabItem} ${isActive('/laws') ? styles.activeTab : ''}`}>
                    Laws
                </Link>
                <Link href="/history" className={`${styles.tabItem} ${isActive('/history') ? styles.activeTab : ''}`}>
                    History
                </Link>
                <Link href="/profile" className={`${styles.tabItem} ${isActive('/profile') ? styles.activeTab : ''}`}>
                    Profile
                </Link>
            </nav>
        </div>
    );
}
