'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';
import Script from 'next/script';
import { fetchOrganization, updateOrganization, fetchCompanyRules, uploadCompanyRule, deleteCompanyRule, RagDocument, getProducts, preparePayment, verifyPayment } from '@/lib/api';
import type { OrganizationInfo, PaymentProduct } from '@/lib/api';

declare global {
    interface Window {
        IMP?: {
            init: (storeCode: string) => void;
            request_pay: (params: Record<string, unknown>, callback: (response: Record<string, unknown>) => void) => void;
        };
    }
}

export default function BizSettingsPage() {
    const { user, isBusinessUser, userProfile } = useAuth();
    const [organization, setOrganization] = useState<OrganizationInfo | null>(null);
    const [rules, setRules] = useState<RagDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [activeTab, setActiveTab] = useState<'profile' | 'rag' | 'payment'>('profile');
    const [uploading, setUploading] = useState(false);
    
    // Payment UI State
    const [products, setProducts] = useState<PaymentProduct[]>([]);
    const [sdkLoaded, setSdkLoaded] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'paying'>('idle');

    useEffect(() => {
        getProducts().then(setProducts).catch(console.error);
    }, []);

    const [form, setForm] = useState({
        name: '',
        businessNumber: '',
        industry: '',
        employeeCount: '',
    });

    useEffect(() => {
        if (!isBusinessUser || !userProfile?.organizationId) {
            if (typeof window !== 'undefined' && !loading) {
                window.location.href = '/intro';
            }
            return;
        }

        const loadOrg = async () => {
            try {
                const orgId = userProfile.organizationId!;
                const [orgData, rulesData] = await Promise.all([
                    fetchOrganization(orgId),
                    fetchCompanyRules(orgId)
                ]);
                setOrganization(orgData);
                setRules(rulesData);
                setForm({
                    name: orgData.name || '',
                    businessNumber: orgData.businessNumber || '',
                    industry: orgData.industry || '',
                    employeeCount: orgData.employeeCount || '',
                });
            } catch (error) {
                console.error("Failed to load organization", error);
            } finally {
                setLoading(false);
            }
        };

        loadOrg();
    }, [isBusinessUser, userProfile, loading]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setSuccessMsg('');
        try {
            if (!userProfile?.organizationId) return;
            const updated = await updateOrganization(userProfile.organizationId, form);
            setOrganization(updated);
            setSuccessMsg('기업 정보가 성공적으로 저장되었습니다.');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (error) {
            console.error("Failed to update organization", error);
            alert("저장에 실패했습니다.");
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        // 프리미엄/스탠다드 요금제 여부 체크 (또는 subscriptionExpiry가 유효한지 확인)
        const isSubscribed = organization?.subscriptionTier?.startsWith('BIZ_');
        if (!isSubscribed) {
            alert('이 기능은 BIZ STANDARD 이상 결제 후 사용할 수 있습니다.\n[결제 및 청구] 메뉴에서 플랜을 업그레이드 해주세요.');
            e.target.value = '';
            return;
        }

        const file = e.target.files?.[0];
        if (!file || !userProfile?.organizationId) return;

        setUploading(true);
        try {
            await uploadCompanyRule(userProfile.organizationId, file);
            const updatedRules = await fetchCompanyRules(userProfile.organizationId);
            setRules(updatedRules);
            alert("업로드되었습니다.");
        } catch (error) {
            console.error("Upload error", error);
            alert("업로드에 실패했습니다.");
        } finally {
            setUploading(false);
            e.target.value = ''; // reset
        }
    };

    const handleDeleteRule = async (fileName: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        if (!userProfile?.organizationId) return;

        try {
            await deleteCompanyRule(userProfile.organizationId, fileName);
            const updatedRules = await fetchCompanyRules(userProfile.organizationId);
            setRules(updatedRules);
        } catch (error) {
            console.error(error);
            alert("삭제에 실패했습니다.");
        }
    };

    const handlePurchase = async (productId: number) => {
        if (!user) {
            alert('로그인이 필요합니다.');
            return;
        }
        if (!window.IMP) {
            alert('결제 모듈이 로딩 중입니다. 잠시 후 다시 시도해주세요.');
            return;
        }
        const product = products.find(p => p.id === productId);
        if(!product) return;

        try {
            setPaymentStatus('paying');
            const prepared = await preparePayment(product.id, user.uid, user.email || undefined);
            window.IMP.init(prepared.storeCode);
            window.IMP.request_pay(
                {
                    pg: 'html5_inicis',
                    pay_method: 'card',
                    merchant_uid: prepared.merchantUid,
                    name: prepared.productName,
                    amount: prepared.amount,
                    buyer_email: user.email || '',
                    buyer_name: user?.displayName || organization?.name || '노무톡톡 기업회원',
                },
                async (response: Record<string, unknown>) => {
                    if (response.success || response.imp_success) {
                        try {
                            await verifyPayment(response.imp_uid as string, response.merchant_uid as string);
                            alert('결제가 완료되었습니다. 프리미엄 기능을 사용할 수 있습니다.');
                            window.location.reload();
                        } catch (err: any) { alert(err.message || '결제 검증 실패'); }
                    } else { alert((response.error_msg as string) || '결제가 취소되었습니다.'); }
                    setPaymentStatus('idle');
                }
            );
        } catch (err: any) {
            alert(err.message || '결제 준비 중 오류 발생');
            setPaymentStatus('idle');
        }
    };

    if (!user || loading) {
        return <div className={styles.container}><div className={styles.loading}>로딩 중...</div></div>;
    }

    if (!isBusinessUser) {
        return null;
    }

    return (
        <>
            <Script src="https://cdn.iamport.kr/v1/iamport.js" onLoad={() => setSdkLoaded(true)} />
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>기업 설정</h1>
                    <p className={styles.subtitle}>회사 정보 및 워크스페이스 설정을 관리합니다.</p>
                </div>

            <div className={styles.grid}>
                <div className={styles.sidebar}>
                    <ul className={styles.navMenu}>
                        <li className={activeTab === 'profile' ? styles.navItemActive : styles.navItem} onClick={() => setActiveTab('profile')}>기업 프로필</li>
                        <li className={activeTab === 'rag' ? styles.navItemActive : styles.navItem} onClick={() => setActiveTab('rag')}>사내 규정 (RAG)</li>
                        <li className={activeTab === 'payment' ? styles.navItemActive : styles.navItem} onClick={() => setActiveTab('payment')}>결제 및 청구</li>
                        <li className={styles.navItem}>보안 및 권한</li>
                    </ul>
                </div>

                <div className={styles.mainContent}>
                    {activeTab === 'profile' && (
                        <>
                    <form className={styles.card} onSubmit={handleSubmit}>
                        <div className={styles.cardHeader}>
                            <h2 className={styles.cardTitle}>기업 프로필</h2>
                        </div>
                        <div className={styles.cardBody}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>기업/워크스페이스 이름 <span className={styles.required}>*</span></label>
                                <input
                                    type="text"
                                    name="name"
                                    className={styles.input}
                                    value={form.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>사업자등록번호</label>
                                <input
                                    type="text"
                                    name="businessNumber"
                                    className={styles.input}
                                    placeholder="000-00-00000"
                                    value={form.businessNumber}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>업종/산업군</label>
                                    <select
                                        name="industry"
                                        className={styles.select}
                                        value={form.industry}
                                        onChange={handleChange}
                                    >
                                        <option value="">선택해주세요</option>
                                        <option value="IT/소프트웨어">IT/소프트웨어</option>
                                        <option value="제조업">제조업</option>
                                        <option value="도소매업">도소매업</option>
                                        <option value="서비스업">서비스업</option>
                                        <option value="건설업">건설업</option>
                                        <option value="기타">기타</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>직원 수</label>
                                    <select
                                        name="employeeCount"
                                        className={styles.select}
                                        value={form.employeeCount}
                                        onChange={handleChange}
                                    >
                                        <option value="">선택해주세요</option>
                                        <option value="1-4명">1-4명 (5인 미만)</option>
                                        <option value="5-49명">5-49명</option>
                                        <option value="50-299명">50-299명</option>
                                        <option value="300명 이상">300명 이상</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className={styles.cardFooter}>
                            {successMsg && <span className={styles.successMsg}>{successMsg}</span>}
                            <button type="submit" className={styles.saveBtn} disabled={saving}>
                                {saving ? '저장 중...' : '변경사항 저장'}
                            </button>
                        </div>
                    </form>

                    <div className={styles.dangerZone}>
                        <h3 className={styles.dangerTitle}>위험 구역</h3>
                        <div className={styles.dangerBox}>
                            <div>
                                <h4 className={styles.dangerBoxTitle}>워크스페이스 삭제</h4>
                                <p className={styles.dangerBoxDesc}>모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.</p>
                            </div>
                            <button type="button" className={styles.deleteBtn}>삭제하기</button>
                        </div>
                    </div>
                    </>
                    )}

                    {activeTab === 'rag' && (
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h2 className={styles.cardTitle}>사내 규정 업로드</h2>
                                <p className={styles.cardSubtitle} style={{marginTop: '4px', color: '#6b7280', fontSize: '14px'}}>PDF, 워드 파일을 업로드하면 AI가 노무 사건 분석 시 이를 참고합니다.</p>
                            </div>
                            <div className={styles.cardBody}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>파일 첨부</label>
                                    <input type="file" onChange={handleFileUpload} disabled={uploading} accept=".pdf,.txt,.docx" />
                                    {uploading && <span style={{ marginLeft: '10px' }}>업로드 중... (최장 10초 이상 소요될 수 있습니다)</span>}
                                </div>
                                
                                <h3 style={{marginTop: '2rem', marginBottom: '1rem', fontSize: '1rem', fontWeight: 600}}>적용 중인 규정 목록</h3>
                                {rules.length === 0 ? (
                                    <p style={{color: '#8b95a1', fontSize: '14px'}}>업로드된 파일이 없습니다.</p>
                                ) : (
                                    <ul style={{ listStyle: 'none', padding: 0 }}>
                                        {rules.map((rule, idx) => (
                                            <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #e5e8eb', borderRadius: '8px', marginBottom: '8px' }}>
                                                <span>{rule.displayName}</span>
                                                <button onClick={() => handleDeleteRule(rule.name)} style={{ color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>삭제</button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'payment' && (
                        <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h2 className={styles.cardTitle}>결제 및 청구</h2>
                                <p className={styles.cardSubtitle} style={{marginTop: '4px', color: '#6b7280', fontSize: '14px'}}>
                                    현재 플랜: <strong style={{color: '#4f46e5'}}>{organization?.subscriptionTier || 'FREE'}</strong>
                                </p>
                            </div>
                            <div className={styles.cardBody} style={{display: 'flex', gap: '20px', flexWrap: 'wrap'}}>
                                {/* BIZ STANDARD */}
                                <div style={{flex: '1 1 300px', padding: '24px', border: '1px solid #e5e7eb', borderRadius: '12px'}}>
                                    <h3 style={{fontSize: '18px', marginBottom: '8px'}}>BIZ STANDARD</h3>
                                    <p style={{fontSize: '24px', fontWeight: 800, color: '#3b82f6', marginBottom: '16px'}}>₩49,000 <span style={{fontSize: '14px', color: '#6b7280', fontWeight: 400}}>/월</span></p>
                                    <ul style={{listStyle: 'none', padding: 0, marginBottom: '24px', fontSize: '14px', color: '#4b5563', lineHeight: '1.8'}}>
                                        <li>✔️ 법률 서면, 증거 분석 50건</li>
                                        <li>✔️ AI 자문 채팅 무제한</li>
                                        <li>✔️ <strong>사내 규정 RAG 적용</strong></li>
                                    </ul>
                                    <button 
                                        onClick={() => handlePurchase(3)}
                                        disabled={paymentStatus !== 'idle'}
                                        style={{width: '100%', padding: '12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer'}}>
                                        {paymentStatus !== 'idle' ? '진행 중...' : '구독하기'}
                                    </button>
                                </div>
                                {/* BIZ PREMIUM */}
                                <div style={{flex: '1 1 300px', padding: '24px', border: '2px solid #8b5cf6', borderRadius: '12px', background: '#f5f3ff'}}>
                                    <h3 style={{fontSize: '18px', marginBottom: '8px', color: '#8b5cf6'}}>BIZ PREMIUM <span style={{fontSize: '12px', background: '#8b5cf6', color: '#fff', padding: '2px 8px', borderRadius: '12px', marginLeft: '8px'}}>BEST</span></h3>
                                    <p style={{fontSize: '24px', fontWeight: 800, color: '#8b5cf6', marginBottom: '16px'}}>₩199,000 <span style={{fontSize: '14px', color: '#6b7280', fontWeight: 400}}>/월</span></p>
                                    <ul style={{listStyle: 'none', padding: 0, marginBottom: '24px', fontSize: '14px', color: '#4b5563', lineHeight: '1.8'}}>
                                        <li>✔️ 법률 서면, 증거 분석 <strong>무제한</strong></li>
                                        <li>✔️ AI 자문 채팅 무제한</li>
                                        <li>✔️ 사내 규정 RAG <strong>무제한</strong></li>
                                        <li>✔️ 전담 매니저 최우선 지원</li>
                                    </ul>
                                    <button 
                                        onClick={() => handlePurchase(4)}
                                        disabled={paymentStatus !== 'idle'}
                                        style={{width: '100%', padding: '12px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer'}}>
                                        {paymentStatus !== 'idle' ? '진행 중...' : '구독하기'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        </>
    );
}
