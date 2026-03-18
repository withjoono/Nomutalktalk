'use client';

import React, { useState, useEffect } from 'react';
import Script from 'next/script';
import { useAuth } from '@/context/AuthContext';
import { getProducts, preparePayment, verifyPayment, getPaymentHistory } from '@/lib/api';
import type { PaymentProduct, PaymentOrder } from '@/lib/api';
import styles from './page.module.css';
import Link from 'next/link';

declare global {
    interface Window {
        IMP?: {
            init: (storeCode: string) => void;
            request_pay: (params: Record<string, unknown>, callback: (response: Record<string, unknown>) => void) => void;
        };
    }
}

export default function PaymentPage() {
    const { user, loading: authLoading } = useAuth();
    const [products, setProducts] = useState<PaymentProduct[]>([]);
    const [history, setHistory] = useState<PaymentOrder[]>([]);
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'preparing' | 'paying' | 'verifying' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [successData, setSuccessData] = useState<{ productName: string; amount: number } | null>(null);
    const [sdkLoaded, setSdkLoaded] = useState(false);

    useEffect(() => {
        getProducts().then(setProducts).catch(console.error);
    }, []);

    useEffect(() => {
        if (user) {
            getPaymentHistory(user.uid).then(setHistory).catch(console.error);
        }
    }, [user, paymentStatus]);

    const handlePurchase = async (product: PaymentProduct) => {
        if (!user) {
            alert('로그인이 필요합니다.');
            return;
        }
        if (!window.IMP) {
            alert('결제 모듈이 로딩 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }

        try {
            setPaymentStatus('preparing');
            setErrorMessage('');

            // 1. 서버에 사전등록
            const prepared = await preparePayment(product.id, user.uid, user.email || undefined);

            // 2. 아임포트 SDK 초기화
            window.IMP.init(prepared.storeCode);

            // 3. 결제 요청
            setPaymentStatus('paying');
            window.IMP.request_pay(
                {
                    pg: 'html5_inicis',
                    pay_method: 'card',
                    merchant_uid: prepared.merchantUid,
                    name: prepared.productName,
                    amount: prepared.amount,
                    buyer_email: user.email || '',
                    buyer_name: user.displayName || '노무톡톡 회원',
                },
                async (response: Record<string, unknown>) => {
                    if (response.success || response.imp_success) {
                        // 4. 결제 검증
                        try {
                            setPaymentStatus('verifying');
                            await verifyPayment(
                                response.imp_uid as string,
                                response.merchant_uid as string
                            );
                            setPaymentStatus('success');
                            setSuccessData({
                                productName: prepared.productName,
                                amount: prepared.amount,
                            });
                        } catch (err) {
                            setPaymentStatus('error');
                            setErrorMessage(err instanceof Error ? err.message : '결제 검증 실패');
                        }
                    } else {
                        setPaymentStatus('error');
                        setErrorMessage((response.error_msg as string) || '결제가 취소되었습니다.');
                    }
                }
            );
        } catch (err) {
            setPaymentStatus('error');
            setErrorMessage(err instanceof Error ? err.message : '결제 준비 중 오류 발생');
        }
    };

    const formatPrice = (price: number) =>
        new Intl.NumberFormat('ko-KR').format(price);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    };

    if (authLoading) {
        return <div className={styles.container}><p className={styles.loadingText}>로딩 중...</p></div>;
    }

    return (
        <>
            <Script
                src="https://cdn.iamport.kr/v1/iamport.js"
                onLoad={() => setSdkLoaded(true)}
            />
            <div className={styles.container}>
                {/* 결제 성공 모달 */}
                {paymentStatus === 'success' && successData && (
                    <div className={styles.overlay}>
                        <div className={styles.successModal}>
                            <div className={styles.successIcon}>✅</div>
                            <h2>결제 완료!</h2>
                            <p className={styles.successProduct}>{successData.productName}</p>
                            <p className={styles.successAmount}>₩{formatPrice(successData.amount)}</p>
                            <button
                                className={styles.successButton}
                                onClick={() => { setPaymentStatus('idle'); setSuccessData(null); }}
                            >
                                확인
                            </button>
                        </div>
                    </div>
                )}

                {/* 헤더 */}
                <div className={styles.header}>
                    <h1>💳 결제</h1>
                    <p>노무톡톡 프리미엄 서비스를 이용해보세요.</p>
                </div>

                {/* 로그인 안내 */}
                {!user && (
                    <div className={styles.loginPrompt}>
                        <p>💡 결제하려면 먼저 로그인해주세요.</p>
                        <Link href="/auth/login" className={styles.loginButton}>
                            로그인하기
                        </Link>
                    </div>
                )}

                {/* 에러 메시지 */}
                {paymentStatus === 'error' && (
                    <div className={styles.errorBox}>
                        <p>❌ {errorMessage}</p>
                        <button onClick={() => setPaymentStatus('idle')}>닫기</button>
                    </div>
                )}

                {/* 상품 카드 */}
                <div className={styles.productGrid}>
                    {/* 무료 플랜 */}
                    <div className={styles.productCard}>
                        <h3 className={styles.productTitle}>FREE</h3>
                        <div className={styles.productPrice}>₩0</div>
                        <p className={styles.productPeriod}>무기한</p>
                        <ul className={styles.featureList}>
                            <li>기본 AI 상담</li>
                            <li>일일 질문 5회 제한</li>
                            <li>커뮤니티 열람</li>
                        </ul>
                        <button className={styles.currentButton} disabled>
                            현재 사용 중
                        </button>
                    </div>

                    {/* 유료 상품들 */}
                    {products.map(product => (
                        <div key={product.id} className={`${styles.productCard} ${styles.popularCard}`}>
                            <div className={styles.popularBadge}>추천</div>
                            <h3 className={styles.productTitle}>{product.name}</h3>
                            <div className={styles.productPrice}>
                                ₩{formatPrice(product.price)}
                            </div>
                            <p className={styles.productPeriod}>{product.period}일</p>
                            <ul className={styles.featureList}>
                                {product.features.map((f, i) => (
                                    <li key={i}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <button
                                className={styles.purchaseButton}
                                onClick={() => handlePurchase(product)}
                                disabled={!user || paymentStatus === 'preparing' || paymentStatus === 'paying' || paymentStatus === 'verifying'}
                            >
                                {paymentStatus === 'preparing' ? '준비 중...'
                                    : paymentStatus === 'paying' ? '결제 중...'
                                        : paymentStatus === 'verifying' ? '검증 중...'
                                            : '구독하기'}
                            </button>
                        </div>
                    ))}
                </div>

                {/* 결제 내역 */}
                {user && history.length > 0 && (
                    <div className={styles.historySection}>
                        <h2>📋 결제 내역</h2>
                        <ul className={styles.historyList}>
                            {history.map(order => (
                                <li key={order.id} className={styles.historyItem}>
                                    <div className={styles.historyInfo}>
                                        <span className={styles.historyDate}>{formatDate(order.createdAt)}</span>
                                        <span className={styles.historyProduct}>{order.productName}</span>
                                    </div>
                                    <div className={styles.historyRight}>
                                        <span className={styles.historyAmount}>₩{formatPrice(order.amount)}</span>
                                        <span className={`${styles.historyStatus} ${order.status === 'COMPLETE' ? styles.statusComplete : styles.statusFailed}`}>
                                            {order.status === 'COMPLETE' ? '완료' : order.status === 'CANCELLED' ? '취소' : '실패'}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* SDK 상태 */}
                {!sdkLoaded && (
                    <p className={styles.sdkStatus}>결제 모듈 로딩 중...</p>
                )}
            </div>
        </>
    );
}
