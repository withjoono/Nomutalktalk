'use client';

import React from 'react';
import styles from './AppShell.module.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface AppShellProps {
    children: React.ReactNode;
}

/* ── Premium inline SVG icons (Lucide-style, 20×20) ── */
const Icons = {
    caseInput: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
    ),
    caseSearch: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <path d="M11 8v6" />
            <path d="M8 11h6" />
        </svg>
    ),
    chat: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M8 10h.01" />
            <path d="M12 10h.01" />
            <path d="M16 10h.01" />
        </svg>
    ),
    laws: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            <path d="M8 7h6" />
            <path d="M8 11h4" />
        </svg>
    ),
    payment: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <path d="M2 10h20" />
        </svg>
    ),
    bell: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
    ),
    user: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    ),
    login: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
    ),
};

export default function AppShell({ children }: AppShellProps) {
    const pathname = usePathname();
    const { user } = useAuth();

    const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

    return (
        <div className={styles.container}>
            {/* ── Top Navigation Bar ── */}
            <header className={styles.topHeader}>
                {/* Left: Logo + Brand */}
                <Link href="/" className={styles.headerLogo}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="노무톡" width={40} height={40} className={styles.headerLogoImage} />
                    <span className={styles.brandText}>노무톡</span>
                </Link>

                {/* Center: Navigation */}
                <nav className={styles.topNav}>
                    <Link href="/case-input" className={`${styles.navLink} ${isActive('/case-input') ? styles.navActive : ''}`}>
                        {Icons.caseInput}
                        <span>사건 입력</span>
                    </Link>
                    <Link href="/case-search" className={`${styles.navLink} ${isActive('/case-search') ? styles.navActive : ''}`}>
                        {Icons.caseSearch}
                        <span>사건 분석</span>
                    </Link>
                    <Link href="/chat" className={`${styles.navLink} ${isActive('/chat') ? styles.navActive : ''}`}>
                        {Icons.chat}
                        <span>AI 상담</span>
                    </Link>
                    <Link href="/laws" className={`${styles.navLink} ${isActive('/laws') ? styles.navActive : ''}`}>
                        {Icons.laws}
                        <span>법령 검색</span>
                    </Link>
                </nav>

                {/* Right: Action Icons */}
                <div className={styles.headerRight}>
                    <Link href="/payment" className={`${styles.iconBtn} ${isActive('/payment') ? styles.iconBtnActive : ''}`} title="결제">
                        {Icons.payment}
                    </Link>
                    <button className={styles.iconBtn} title="알림">
                        {Icons.bell}
                    </button>
                    <Link
                        href={user ? "/profile" : "/auth/login"}
                        className={`${styles.iconBtn} ${isActive('/profile') || isActive('/auth') ? styles.iconBtnActive : ''}`}
                        title={user ? "프로필" : "로그인"}
                    >
                        {user ? Icons.user : Icons.login}
                    </Link>
                </div>
            </header>

            {/* ── Main Content ── */}
            <main className={styles.main}>
                <div className={styles.content}>
                    {children}
                </div>

                {/* ── Footer ── */}
                <footer className={styles.footer}>
                    <div className={styles.footerInner}>
                        <div className={styles.footerColumns}>
                            {/* Left: Logo */}
                            <div className={styles.footerLogoArea}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/logo.png" alt="노무톡" className={styles.footerLogo} />
                            </div>

                            {/* Center: Company Info (2 lines) */}
                            <div className={styles.footerCenter}>
                                <span className={styles.companyName}>(주)청사에이아이</span>
                                <p className={styles.footerLine}>
                                    대표 : 성시웅 | 사업자등록번호 : 512-88-03060 | 법인등록번호 : 160111-0700462
                                </p>
                                <p className={styles.footerLine}>
                                    사업장 : 대전광역시 서구 청사로 228, 11층 1110호 | 업태 : 정보통신업 | 연락처 : 070-4448-6960
                                </p>
                            </div>

                            {/* Right: Social Links */}
                            <div className={styles.footerSocial}>
                                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink} title="YouTube">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                    </svg>
                                </a>
                                <a href="https://cafe.naver.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink} title="네이버 카페">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z" />
                                    </svg>
                                </a>
                            </div>
                        </div>

                        <div className={styles.copyright}>
                            © 2024 Cheongsa AI Co., Ltd. All rights reserved.
                        </div>
                    </div>
                </footer>
            </main>

            {/* ── Bottom Tabs (Mobile) ── */}
            <nav className={styles.bottomTabs}>
                <Link href="/case-input" className={`${styles.tabItem} ${isActive('/case-input') ? styles.activeTab : ''}`}>
                    {Icons.caseInput}
                    <span>입력</span>
                </Link>
                <Link href="/case-search" className={`${styles.tabItem} ${isActive('/case-search') ? styles.activeTab : ''}`}>
                    {Icons.caseSearch}
                    <span>분석</span>
                </Link>
                <Link href="/chat" className={`${styles.tabItem} ${isActive('/chat') ? styles.activeTab : ''}`}>
                    {Icons.chat}
                    <span>상담</span>
                </Link>
                <Link href="/laws" className={`${styles.tabItem} ${isActive('/laws') ? styles.activeTab : ''}`}>
                    {Icons.laws}
                    <span>법령</span>
                </Link>
            </nav>
        </div>
    );
}
