'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    User,
    onAuthStateChanged,
    signInWithPopup,
    signOut,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from 'firebase/auth';
import { auth, googleProvider, appleProvider } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { setApiToken, fetchUserProfile } from '@/lib/api';
import type { UserProfile, UserType, SubscriptionTier } from '@/lib/api';

// 사용량 한도 설정
const TIER_LIMITS: Record<SubscriptionTier, {
    dailyChat: number;
    monthlyDoc: number;
    monthlyEvidence: number;
    maxCases: number;
}> = {
    FREE: { dailyChat: 5, monthlyDoc: 0, monthlyEvidence: 0, maxCases: 3 },
    PRO: { dailyChat: -1, monthlyDoc: 10, monthlyEvidence: 20, maxCases: -1 },
    BIZ_STANDARD: { dailyChat: -1, monthlyDoc: 50, monthlyEvidence: 100, maxCases: -1 },
    BIZ_PREMIUM: { dailyChat: -1, monthlyDoc: -1, monthlyEvidence: -1, maxCases: -1 },
};

type FeatureKey = 'chat' | 'document' | 'evidence' | 'case' | 'companyRules' | 'dashboard' | 'team';

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;

    // 확장 사용자 정보
    userProfile: UserProfile | null;
    isBusinessUser: boolean;
    subscriptionTier: SubscriptionTier;
    canUseFeature: (feature: FeatureKey) => boolean;
    refreshProfile: () => Promise<void>;

    // 인증 메서드
    signInWithGoogle: () => Promise<void>;
    signInWithApple: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    token: null,
    loading: true,
    userProfile: null,
    isBusinessUser: false,
    subscriptionTier: 'FREE',
    canUseFeature: () => false,
    refreshProfile: async () => { },
    signInWithGoogle: async () => { },
    signInWithApple: async () => { },
    signInWithEmail: async () => { },
    signUpWithEmail: async () => { },
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

// 온보딩이 필요 없는 공개 페이지
const PUBLIC_PATHS = [
    '/', '/intro', '/auth', '/terms', '/privacy', '/pricing', '/refund', '/notices',
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    // 프로필 로드
    const loadProfile = async () => {
        try {
            const result = await fetchUserProfile();
            if (result.registered && result.data) {
                setUserProfile(result.data);
            } else {
                setUserProfile(null);
            }
            return result;
        } catch (e) {
            console.error('[NomuTalk Auth] profile load error:', e);
            setUserProfile(null);
            return { data: null, registered: false };
        }
    };

    const refreshProfile = async () => {
        await loadProfile();
    };

    useEffect(() => {
        console.log('[NomuTalk Auth] init - authDomain:', auth.config?.authDomain || 'unknown');
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log('[NomuTalk Auth] state changed:', user ? user.email : 'NO USER');
            if (user) {
                const idToken = await user.getIdToken();
                setUser(user);
                setToken(idToken);
                setApiToken(idToken);

                // 프로필 로드 및 온보딩 체크
                const result = await loadProfile();

                // 온보딩 미완료 시 리다이렉트
                const isPublicPath = PUBLIC_PATHS.some(
                    p => pathname === p || pathname.startsWith(p + '/')
                );
                const isOnboardingPath = pathname === '/onboarding' || pathname.startsWith('/onboarding/');

                if (!isPublicPath && !isOnboardingPath && (!result.registered || !result.data?.onboardingCompleted)) {
                    router.push('/onboarding');
                }
            } else {
                setUser(null);
                setToken(null);
                setApiToken(null);
                setUserProfile(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePostLogin = async (idToken: string) => {
        setApiToken(idToken);
        const result = await loadProfile();

        if (!result.registered || !result.data?.onboardingCompleted) {
            window.location.href = '/onboarding';
        } else if (result.data?.userType === 'BUSINESS') {
            window.location.href = '/case-input'; // 추후 /biz/dashboard로 변경
        } else {
            window.location.href = '/case-input';
        }
    };

    const signInWithGoogle = async () => {
        console.log('[NomuTalk Auth] Google signInWithPopup called');
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const idToken = await result.user.getIdToken();
            setToken(idToken);
            await handlePostLogin(idToken);
        } catch (error: any) {
            console.error("[NomuTalk Auth] Google sign-in error:", error);
            if (error.code === 'auth/popup-blocked') {
                alert("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.");
            } else if (error.code === 'auth/popup-closed-by-user') {
                // User closed popup, do nothing
            } else {
                alert("Google 로그인 중 오류가 발생했습니다: " + (error.message || error.code));
            }
        }
    };

    const signInWithApple = async () => {
        console.log('[NomuTalk Auth] Apple signInWithPopup called');
        try {
            const result = await signInWithPopup(auth, appleProvider);
            const idToken = await result.user.getIdToken();
            setToken(idToken);
            await handlePostLogin(idToken);
        } catch (error: any) {
            console.error("[NomuTalk Auth] Apple sign-in error:", error);
            if (error.code === 'auth/popup-blocked') {
                alert("팝업이 차단되었습니다. 팝업 차단을 해제해주세요.");
            } else if (error.code === 'auth/popup-closed-by-user') {
                // User closed popup, do nothing
            } else {
                alert("Apple 로그인 중 오류가 발생했습니다: " + (error.message || error.code));
            }
        }
    };

    const signInWithEmail = async (email: string, password: string) => {
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            const idToken = await result.user.getIdToken();
            setToken(idToken);
            await handlePostLogin(idToken);
        } catch (error: any) {
            console.error("Error signing in with email", error);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                alert("이메일 또는 비밀번호가 올바르지 않습니다.");
            } else {
                alert("로그인 중 오류가 발생했습니다.");
            }
        }
    };

    const signUpWithEmail = async (email: string, password: string) => {
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            const idToken = await result.user.getIdToken();
            setToken(idToken);
            await handlePostLogin(idToken);
        } catch (error: any) {
            console.error("Error signing up with email", error);
            if (error.code === 'auth/email-already-in-use') {
                alert("이미 사용 중인 이메일입니다.");
            } else if (error.code === 'auth/weak-password') {
                alert("비밀번호가 너무 취약합니다 (최소 6자).");
            } else {
                alert("회원가입 중 오류가 발생했습니다.");
            }
        }
    };

    const logout = async () => {
        console.log('[NomuTalk Auth] logout called');
        try {
            await signOut(auth);
            setToken(null);
            setApiToken(null);
            setUserProfile(null);
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    // 파생 값
    const isBusinessUser = userProfile?.userType === 'BUSINESS';
    const subscriptionTier: SubscriptionTier = userProfile?.subscriptionTier || 'FREE';

    const canUseFeature = (feature: FeatureKey): boolean => {
        const limits = TIER_LIMITS[subscriptionTier];
        const usage = userProfile?.usage;

        switch (feature) {
            case 'chat':
                return limits.dailyChat === -1 || (usage?.dailyChatCount || 0) < limits.dailyChat;
            case 'document':
                return limits.monthlyDoc === -1 || (usage?.monthlyDocCount || 0) < limits.monthlyDoc;
            case 'evidence':
                return limits.monthlyEvidence === -1 || (usage?.monthlyEvidenceCount || 0) < limits.monthlyEvidence;
            case 'case':
                return limits.maxCases === -1; // 별도 카운트 필요
            case 'companyRules':
                return subscriptionTier === 'BIZ_STANDARD' || subscriptionTier === 'BIZ_PREMIUM';
            case 'dashboard':
            case 'team':
                return isBusinessUser;
            default:
                return true;
        }
    };

    return (
        <AuthContext.Provider value={{
            user, token, loading,
            userProfile, isBusinessUser, subscriptionTier,
            canUseFeature, refreshProfile,
            signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
}
