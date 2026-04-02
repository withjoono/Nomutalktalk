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
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                기본 AI 상담 (일일 5회)
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                사건 관리 최대 3건
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                일반 모드 AI 상담
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                사건 보관 30일
                            </li>
                        </ul>
                        <button className={styles.currentButton} disabled>
                            기본 제공 옵션
                        </button>
                    </div>

                    {/* PRO 월간 */}
                    <div className={`${styles.productCard} ${styles.popularCard}`}>
                        <div className={styles.popularBadge}>⭐ 추천</div>
                        <h3 className={styles.productTitle}>PRO (월간)</h3>
                        <div className={styles.productPrice}>₩9,900</div>
                        <p className={styles.productPeriod}>1개월</p>
                        <ul className={styles.featureList}>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                사건/AI 상담 <strong>무제한</strong>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                심층 분석 + 승률 예측
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                법률 서면 10건, 증거 20건
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                광고 제거 / 365일 보관
                            </li>
                        </ul>
                        <button
                            className={styles.purchaseButton}
                            onClick={() => {
                                const prod = products.find(p => p.name.includes('PRO') && p.period === 30) || products.find(p => p.name.includes('PRO'));
                                if (prod) handlePurchase(prod);
                                else alert('상품을 준비 중입니다.');
                            }}
                            disabled={!user || paymentStatus !== 'idle'}
                        >
                            {paymentStatus !== 'idle' ? '진행 중...' : '구독하기'}
                        </button>
                    </div>

                    {/* PRO 연간 */}
                    <div className={`${styles.productCard} ${styles.popularCard}`}>
                        <div className={styles.popularBadge}>👑 17% 특별할인</div>
                        <h3 className={styles.productTitle}>PRO (연간)</h3>
                        <div className={styles.productPrice}>₩99,000</div>
                        <p className={styles.productPeriod}>12개월 (월 8,250원)</p>
                        <ul className={styles.featureList}>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                PRO 월간 기능 모두 포함
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                <strong>17% 특별 할인</strong> (2달치 무료)
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                연간 일시불 결제
                            </li>
                        </ul>
                        <button
                            className={styles.purchaseButton}
                            style={{ background: '#1b64da' }}
                            onClick={() => {
                                const prod = products.find(p => p.period === 365 || p.name.includes('연간'));
                                if (prod) handlePurchase(prod);
                                else alert('상품을 준비 중입니다.');
                            }}
                            disabled={!user || paymentStatus !== 'idle'}
                        >
                            {paymentStatus !== 'idle' ? '진행 중...' : '연간 구독하기'}
                        </button>
                    </div>

                    {/* ENTERPRISE */}
                    <div className={styles.productCard}>
                        <h3 className={styles.productTitle}>ENTERPRISE</h3>
                        <div className={styles.productPrice}>별도 협의</div>
                        <p className={styles.productPeriod}>맞춤형 사업장 규정 연동</p>
                        <ul className={styles.featureList}>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                법률 서면/증거 무제한
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                <strong>사내 규정 및 단체협약 연동</strong>
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                기업 맞춤형 AI 모델
                            </li>
                            <li>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                전담 매니저 1:1 배치
                            </li>
                        </ul>
                        <button
                            className={styles.currentButton}
                            onClick={() => alert('기업 도입은 고객센터 (070-4448-6960) 로 문의해주세요.')}
                        >
                            도입 문의하기
                        </button>
                    </div>
                </div>

                {/* 부가 서비스 */}
                <div className={styles.historySection} style={{ marginTop: '0', marginBottom: '24px' }}>
                    <h2>➕ 부가 서비스 추가</h2>
                    <p style={{ fontSize: '14px', color: 'var(--toss-text-secondary)', marginBottom: '16px' }}>
                        PRO 이상 구독 중 월 기본 제공량을 초과한 경우 이용 가능합니다.
                    </p>
                    <div className={styles.productGrid}>
                        <div className={styles.productCard} style={{ padding: '24px 20px' }}>
                            <h4 style={{ fontSize: '18px', marginBottom: '8px' }}>📜 법률 서면 1건 추가</h4>
                            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--toss-blue)', margin: '12px 0' }}>₩1,000</div>
                            <button
                                className={styles.purchaseButton}
                                style={{ padding: '10px' }}
                                onClick={() => {
                                    const prod = products.find(p => p.name.includes('서면') || p.price === 1000);
                                    if(prod) handlePurchase(prod);
                                    else alert('부가서비스 상품이 등록되지 않았습니다.');
                                }}
                                disabled={!user || paymentStatus !== 'idle'}
                            >
                                추가 결제
                            </button>
                        </div>
                        <div className={styles.productCard} style={{ padding: '24px 20px' }}>
                            <h4 style={{ fontSize: '18px', marginBottom: '8px' }}>📎 증거 분석 1건 추가</h4>
                            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--toss-blue)', margin: '12px 0' }}>₩500</div>
                            <button
                                className={styles.purchaseButton}
                                style={{ padding: '10px' }}
                                onClick={() => {
                                    const prod = products.find(p => p.name.includes('증거') || p.price === 500);
                                    if(prod) handlePurchase(prod);
                                    else alert('부가서비스 상품이 등록되지 않았습니다.');
                                }}
                                disabled={!user || paymentStatus !== 'idle'}
                            >
                                추가 결제
                            </button>
                        </div>
                    </div>
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
