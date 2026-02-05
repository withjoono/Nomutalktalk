'use client';

import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function LoginPage() {
    const { signInWithGoogle, loading } = useAuth();

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.logo}>N</div>
                <h1 className={styles.title}>로그인</h1>
                <p className={styles.subtitle}>노무톡에 오신 것을 환영합니다.</p>

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

                <p className={styles.footerText}>
                    계정이 없으신가요? Google 로그인 시
                    <br />자동으로 회원가입이 진행됩니다.
                </p>
            </div>
        </div>
    );
}
