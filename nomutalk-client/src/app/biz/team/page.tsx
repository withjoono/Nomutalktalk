'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';
import { fetchOrganization } from '@/lib/api';
import type { OrganizationInfo } from '@/lib/api';

export default function BizTeamPage() {
    const { user, isBusinessUser, userProfile } = useAuth();
    const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isBusinessUser || !userProfile?.organizationId) {
            if (typeof window !== 'undefined' && !loading) {
                window.location.href = '/intro';
            }
            return;
        }

        const loadOrg = async () => {
            try {
                const orgData = await fetchOrganization(userProfile.organizationId!);
                setOrganization(orgData);
            } catch (error) {
                console.error("Failed to load organization", error);
            } finally {
                setLoading(false);
            }
        };

        loadOrg();
    }, [isBusinessUser, userProfile, loading]);

    if (!user || loading) {
        return <div className={styles.container}><div className={styles.loading}>로딩 중...</div></div>;
    }

    if (!isBusinessUser) {
        return null;
    }

    const members = organization?.members || [];
    const usedSeats = members.length;
    const maxSeats = organization?.maxSeats || 0;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>팀 관리</h1>
                <p className={styles.subtitle}>팀원을 초대하고 권한을 관리하세요.</p>
            </div>

            <div className={styles.statsCard}>
                <div className={styles.statsInfo}>
                    <h2 className={styles.statsTitle}>이용 중인 자리</h2>
                    <div className={styles.statsCount}>
                        <span className={styles.used}>{usedSeats}</span>
                        <span className={styles.total}>/ {maxSeats}명</span>
                    </div>
                    <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${(usedSeats / maxSeats) * 100}%` }} />
                    </div>
                </div>
                <div className={styles.statsAction}>
                    <button className={styles.inviteBtn}>+ 팀원 초대하기</button>
                    <p className={styles.upgradeHint}>인원이 더 필요한가요? <a href="/pricing">플랜 업그레이드</a></p>
                </div>
            </div>

            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <h2 className={styles.cardTitle}>팀원 목록</h2>
                    <div className={styles.tableActions}>
                        <input type="text" placeholder="이름 또는 이메일 검색" className={styles.searchInput} />
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>이름</th>
                                <th>이메일</th>
                                <th>권한</th>
                                <th>가입일</th>
                                <th>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map(member => (
                                <tr key={member.id}>
                                    <td>
                                        <div className={styles.memberInfo}>
                                            <div className={styles.avatar}>{member.displayName?.charAt(0) || 'U'}</div>
                                            <span className={styles.memberName}>{member.displayName || '이름 없음'}</span>
                                        </div>
                                    </td>
                                    <td>{member.email}</td>
                                    <td>
                                        <span className={`${styles.roleBadge} ${member.role === 'owner' ? styles.roleOwner : styles.roleMember}`}>
                                            {member.role === 'owner' ? '관리자' : '일반 멤버'}
                                        </span>
                                    </td>
                                    <td>{new Date(member.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        {member.role !== 'owner' && (
                                            <button className={styles.actionBtn}>권한 변경</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {members.length === 0 && (
                                <tr>
                                    <td colSpan={5} className={styles.emptyRow}>
                                        표시할 팀원이 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
