'use client';

import PricingCard from '@/components/payment/PricingCard';
import styles from './page.module.css';

export default function PaymentPage() {
    const handlePurchase = (plan: string) => {
        alert(`${plan} 선택됨. 결제 모듈(PortOne 등) 연동 필요.`);
        // TODO: Integrate PortOne or Stripe
    };

    return (
        <div className={styles.container}>
            <h1 className={styles.header}>요금제 선택</h1>
            <p className={styles.subheader}>나에게 맞는 상담 플랜을 선택하세요.</p>

            <div className={styles.grid}>
                <PricingCard
                    title="FREE"
                    price="₩0"
                    features={['기본 AI 상담', '일일 질문 5회 제한', '커뮤니티 열람']}
                    buttonText="현재 사용 중"
                    onSelect={() => { }}
                />
                <PricingCard
                    title="PREMIUM"
                    price="₩9,900"
                    features={['무제한 AI 상담', '심층 판례 분석', '변호사 연계 할인', '광고 제거']}
                    isPopular={true}
                    buttonText="구독하기"
                    onSelect={() => handlePurchase('PREMIUM')}
                />
                <PricingCard
                    title="TOKEN PACK"
                    price="₩5,000"
                    features={['질문 50회 추가', '유효기간 없음']}
                    buttonText="충전하기"
                    onSelect={() => handlePurchase('TOKEN PACK')}
                />
            </div>
        </div>
    );
}
