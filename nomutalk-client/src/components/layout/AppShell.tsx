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
    promo: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.2 8.4c.5.38.8.97.8 1.6v0a2 2 0 0 1-1 1.73" />
            <path d="M11 2a1 1 0 0 1 .96.73L17.8 18.5a1 1 0 0 1-.96 1.27H4.16a1 1 0 0 1-.96-1.27L9.04 2.73A1 1 0 0 1 10 2z" />
            <path d="M13.6 14H7.4" />
            <path d="M14.4 11H6.6" />
            <path d="M15.2 8H5.8" />
        </svg>
    ),
};

export default function AppShell({ children }: AppShellProps) {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

    // Derive user display name: displayName > email prefix > fallback
    const displayName = user
        ? (user.displayName || user.email?.split('@')[0] || '사용자')
        : null;

    return (
        <div className={styles.container}>
            {/* ── Top Navigation Bar ── */}
            <header className={styles.topHeader}>
                {/* Left: Logo + Brand */}
                <Link href="/" className={styles.headerLogo}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="노무톡톡" width={40} height={40} className={styles.headerLogoImage} />
                    <span className={styles.brandText}>노무톡톡</span>
                </Link>

                {/* Center: Navigation */}
                <nav className={styles.topNav}>
                    <Link href="/case-input" className={`${styles.navLink} ${isActive('/case-input') ? styles.navActive : ''}`}>
                        내 사건
                    </Link>
                    <Link href="/issue-analysis" className={`${styles.navLink} ${isActive('/issue-analysis') ? styles.navActive : ''}`}>
                        핵심 쟁점
                    </Link>
                    <Link href="/case-search" className={`${styles.navLink} ${isActive('/case-search') ? styles.navActive : ''}`}>
                        관련 법령
                    </Link>
                    <Link href="/alternatives" className={`${styles.navLink} ${isActive('/alternatives') ? styles.navActive : ''}`}>
                        대안 제안
                    </Link>
                    <Link href="/follow-up" className={`${styles.navLink} ${isActive('/follow-up') ? styles.navActive : ''}`}>
                        후속 지원
                    </Link>
                    <Link href="/laws" className={`${styles.navLink} ${isActive('/laws') ? styles.navActive : ''}`}>
                        법령 검색
                    </Link>
                    <Link href="/intro" className={`${styles.navLink} ${isActive('/intro') ? styles.navActive : ''}`}>
                        소개
                    </Link>
                </nav>

                {/* Right: Action Icons */}
                <div className={styles.headerRight}>
                    <Link href="/payment" className={`${styles.iconBtn} ${isActive('/payment') ? styles.iconBtnActive : ''}`} title="결제">
                        {Icons.payment}
                    </Link>
                    <Link href="/notices" className={`${styles.iconBtn} ${isActive('/notices') ? styles.iconBtnActive : ''}`} title="공지사항">
                        {Icons.bell}
                    </Link>
                    <a
                        href={user ? "/profile" : "/auth/login"}
                        className={`${styles.authBtn} ${isActive('/profile') || isActive('/auth') ? styles.authBtnActive : ''}`}
                        title={user ? "프로필" : "로그인"}
                    >
                        {user ? Icons.user : Icons.login}
                        <span className={styles.authLabel}>
                            {user ? `${displayName} 님` : '로그인'}
                        </span>
                    </a>
                    {user && (
                        <button className={styles.iconBtn} title="로그아웃" onClick={async () => {
                            await logout();
                            window.location.href = '/intro';
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </button>
                    )}
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
                                <img src="/logo.png" alt="노무톡톡" className={styles.footerLogo} />
                            </div>

                            {/* Center: Company Info */}
                            <div className={styles.footerCenter}>
                                <div className={styles.footerLinks}>
                                    <Link href="/terms" className={styles.footerLink}>이용약관</Link>
                                    <span className={styles.footerDivider}>|</span>
                                    <Link href="/privacy" className={styles.footerLinkBold}>개인정보처리방침</Link>
                                    <span className={styles.footerDivider}>|</span>
                                    <Link href="/pricing" className={styles.footerLink}>가격정책</Link>
                                    <span className={styles.footerDivider}>|</span>
                                    <Link href="/refund" className={styles.footerLink}>환불정책</Link>
                                    <span className={styles.footerDivider}>|</span>
                                    <Link href="/notices" className={styles.footerLink}>공지사항</Link>
                                </div>
                                <span className={styles.companyName}>청사공인노무사</span>
                                <p className={styles.footerLine}>
                                    대표 : 성시웅 | 사업자 : 314-12-25811
                                </p>
                                <p className={styles.footerLine}>
                                    사업장 : 대전광역시 서구 청사로 228, 11층 1110호, 35209
                                </p>
                                <p className={styles.footerLine}>
                                    연락처 : 042-471-1197
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
                            © 2025 청사공인노무사. All rights reserved.
                        </div>
                    </div>
                </footer>
            </main>

            {/* ── Bottom Tabs (Mobile) ── */}
            <nav className={styles.bottomTabs}>
                <Link href="/case-input" className={`${styles.tabItem} ${isActive('/case-input') ? styles.activeTab : ''}`}>
                    {Icons.caseInput}
                    <span>내 사건</span>
                </Link>
                <Link href="/issue-analysis" className={`${styles.tabItem} ${isActive('/issue-analysis') ? styles.activeTab : ''}`}>
                    {Icons.caseSearch}
                    <span>쟁점</span>
                </Link>
                <Link href="/case-search" className={`${styles.tabItem} ${isActive('/case-search') ? styles.activeTab : ''}`}>
                    {Icons.laws}
                    <span>법령</span>
                </Link>
                <Link href="/alternatives" className={`${styles.tabItem} ${isActive('/alternatives') ? styles.activeTab : ''}`}>
                    {Icons.chat}
                    <span>대안</span>
                </Link>
                <Link href="/follow-up" className={`${styles.tabItem} ${isActive('/follow-up') ? styles.activeTab : ''}`}>
                    {Icons.caseInput}
                    <span>후속</span>
                </Link>
                <Link href="/laws" className={`${styles.tabItem} ${isActive('/laws') ? styles.activeTab : ''}`}>
                    {Icons.laws}
                    <span>검색</span>
                </Link>
            </nav>
        </div>
    );
}
