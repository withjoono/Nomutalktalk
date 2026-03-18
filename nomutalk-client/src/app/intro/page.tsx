'use client';

import styles from './page.module.css';

export default function IntroPage() {
    return (
        <div className={styles.wrapper}>
            <iframe
                src="/promo.html"
                className={styles.promoFrame}
                title="노무톡톡 소개"
            />
        </div>
    );
}
