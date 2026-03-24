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
import { useRouter } from 'next/navigation';
import { setApiToken } from '@/lib/api';

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
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
    signInWithGoogle: async () => { },
    signInWithApple: async () => { },
    signInWithEmail: async () => { },
    signUpWithEmail: async () => { },
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        console.log('[NomuTalk Auth] init - authDomain:', auth.config?.authDomain || 'unknown');
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.log('[NomuTalk Auth] state changed:', user ? user.email : 'NO USER');
            if (user) {
                const idToken = await user.getIdToken();
                setUser(user);
                setToken(idToken);
                setApiToken(idToken);
            } else {
                setUser(null);
                setToken(null);
                setApiToken(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        console.log('[NomuTalk Auth] Google signInWithPopup called');
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const idToken = await result.user.getIdToken();
            setToken(idToken);
            setApiToken(idToken);
            window.location.href = '/case-input';
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
            setApiToken(idToken);
            window.location.href = '/case-input';
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
            setApiToken(idToken);
            window.location.href = '/case-input';
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
            setApiToken(idToken);
            window.location.href = '/case-input';
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
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
