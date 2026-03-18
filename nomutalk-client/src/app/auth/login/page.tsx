'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function LoginPage() {
    const { signInWithGoogle, signInWithEmail, signUpWithEmail, loading } = useAuth();
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
                    <img src="/logo.png" alt="NomuTalk Logo" className={styles.logoImage} />
                </div>
                <h1 className={styles.title}>{isSignUp ? '회원가입' : '로그인'}</h1>
                <p className={styles.subtitle}>노무 AI 컨설턴트 '노무톡톡'</p>

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

                <button
                    className={styles.googleButton}
                    onClick={signInWithGoogle}
                    disabled={loading}
                >
                    <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt="Google"
                        className={styles.googleIcon}
                    />
                    Google로 계속하기
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
