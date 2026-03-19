'use client';

import styles from './page.module.css';

export default function IntroPage() {
    return (
        <div className={styles.wrapper}>
            <iframe
                src="/promo.html"
                className={styles.promoFrame}
                title="Legal Tech 소개"
            />
        </div>
    );
}
