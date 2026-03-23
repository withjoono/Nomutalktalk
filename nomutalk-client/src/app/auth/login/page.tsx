'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function LoginPage() {
    const { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, loading } = useAuth();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;

        if (isSignUp) {
            await signUpWithEmail(email, password);
        } else {
            await signInWithEmail(email, password);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.logoContainer}>
                    <img src="/logo.png" alt="Legal Tech Logo" className={styles.logoImage} />
                </div>
                <h1 className={styles.title}>{isSignUp ? '회원가입' : '로그인'}</h1>
                <p className={styles.subtitle}>AI 법률 컨설턴트 Legal Tech</p>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>이메일</label>
                        <input
                            type="email"
                            className={styles.input}
                            placeholder="example@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>비밀번호</label>
                        <input
                            type="password"
                            className={styles.input}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>
                    <button type="submit" className={styles.submitButton} disabled={loading}>
                        {isSignUp ? '회원가입' : '로그인'}
                    </button>
                </form>

                <div className={styles.divider}>
                    <span>또는</span>
                </div>

                <div className={styles.socialButtons}>
                    <button
                        className={styles.googleButton}
                        onClick={signInWithGoogle}
                        disabled={loading}
                    >
                        <img
                            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                            alt="Google"
                            className={styles.socialIcon}
                        />
                        Google로 계속하기
                    </button>

                    <button
                        className={styles.appleButton}
                        onClick={signInWithApple}
                        disabled={loading}
                    >
                        <svg className={styles.socialIcon} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                        </svg>
                        Apple로 계속하기
                    </button>
                </div>

                <button
                    className={styles.appleButton}
                    onClick={signInWithApple}
                    disabled={loading}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                    Apple로 계속하기
                </button>

                <p className={styles.toggleText}>
                    {isSignUp ? "이미 계정이 있으신가요? " : "계정이 없으신가요? "}
                    <button
                        className={styles.toggleButton}
                        onClick={() => setIsSignUp(!isSignUp)}
                    >
                        {isSignUp ? "로그인" : "회원가입"}
                    </button>
                </p>
            </div>
        </div>
    );
}
