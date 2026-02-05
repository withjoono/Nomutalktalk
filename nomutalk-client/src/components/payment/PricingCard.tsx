'use client';

import React from 'react';
import styles from './PricingCard.module.css';

interface PricingCardProps {
    title: string;
    price: string;
    features: string[];
    isPopular?: boolean;
    buttonText: string;
    onSelect: () => void;
}

export default function PricingCard({ title, price, features, isPopular, buttonText, onSelect }: PricingCardProps) {
    return (
        <div className={`${styles.card} ${isPopular ? styles.popular : ''}`}>
            {isPopular && <div className={styles.badge}>인기</div>}
            <h3 className={styles.title}>{title}</h3>
            <div className={styles.price}>{price}</div>
            <ul className={styles.features}>
                {features.map((feature, index) => (
                    <li key={index} className={styles.featureItem}>
                        <svg className={styles.checkIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                    </li>
                ))}
            </ul>
            <button className={styles.button} onClick={onSelect}>
                {buttonText}
            </button>
        </div>
    );
}
