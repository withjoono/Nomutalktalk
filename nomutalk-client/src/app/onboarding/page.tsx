'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { registerUser } from '@/lib/api';
import type { UserType } from '@/lib/api';
import s from './page.module.css';

export default function OnboardingPage() {
    const { user, loading } = useAuth();
    const [step, setStep] = useState<'select' | 'business-form'>('select');
    const [selectedType, setSelectedType] = useState<UserType | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 기업 정보 폼 상태
    const [bizForm, setBizForm] = useState({
        name: '',
        businessNumber: '',
        industry: '',
        employeeCount: '',
        address: '',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
    });

    if (loading) {
        return (
            <div className={s.container}>
                <div className={s.loading}>
                    <div className={s.spinner} />
                    <p>로딩 중...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
        }
        return null;
    }

    const handleSelectPersonal = async () => {
        setSubmitting(true);
        setError(null);
        try {
            await registerUser({
                userType: 'PERSONAL',
                displayName: user.displayName || undefined,
                photoUrl: user.photoURL || undefined,
            });
            window.location.href = '/case-input';
        } catch (e: any) {
            setError(e.message);
            setSubmitting(false);
        }
    };

    const handleSelectBusiness = () => {
        setSelectedType('BUSINESS');
        setBizForm(prev => ({
            ...prev,
            contactName: user.displayName || '',
            contactEmail: user.email || '',
        }));
        setStep('business-form');
    };

    const handleBusinessSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bizForm.name.trim()) {
            setError('회사명을 입력해 주세요.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await registerUser({
                userType: 'BUSINESS',
                displayName: user.displayName || bizForm.contactName || undefined,
                photoUrl: user.photoURL || undefined,
                organization: {
                    name: bizForm.name.trim(),
                    businessNumber: bizForm.businessNumber.trim() || undefined,
                    industry: bizForm.industry || undefined,
                    employeeCount: bizForm.employeeCount || undefined,
                    address: bizForm.address.trim() || undefined,
                    contactName: bizForm.contactName.trim() || undefined,
                    contactPhone: bizForm.contactPhone.trim() || undefined,
                    contactEmail: bizForm.contactEmail.trim() || undefined,
                },
            });
            window.location.href = '/case-input';
        } catch (e: any) {
            setError(e.message);
            setSubmitting(false);
        }
    };

    return (
        <div className={s.container}>
            <div className={s.card}>
                {/* Header */}
                <div className={s.header}>
                    <img src="/logo.png" alt="노무톡톡" className={s.logo} />
                    <h1 className={s.title}>
                        {step === 'select' ? '서비스 유형 선택' : '기업 정보 입력'}
                    </h1>
                    <p className={s.subtitle}>
                        {step === 'select'
                            ? '노무톡톡을 어떤 목적으로 이용하시나요?'
                            : '기업 서비스를 위한 기본 정보를 입력해 주세요.'}
                    </p>
                </div>

                {error && (
                    <div className={s.errorBox}>
                        <span>⚠️</span> {error}
                    </div>
                )}

                {/* Step 1: 유형 선택 */}
                {step === 'select' && (
                    <div className={s.typeGrid}>
                        <button
                            className={s.typeCard}
                            onClick={handleSelectPersonal}
                            disabled={submitting}
                        >
                            <div className={s.typeIcon}>🧑</div>
                            <h2 className={s.typeName}>개인 사용자</h2>
                            <p className={s.typeDesc}>
                                근로자, 프리랜서, 일반 시민으로서<br />
                                나의 노동 문제를 상담받고 싶어요
                            </p>
                            <ul className={s.typeFeatures}>
                                <li>✓ AI 노무 상담</li>
                                <li>✓ 핵심 쟁점 분석</li>
                                <li>✓ 법령·판례 검색</li>
                                <li>✓ 법률 서면 초안</li>
                            </ul>
                            <div className={s.typeBadge}>무료로 시작</div>
                        </button>

                        <button
                            className={`${s.typeCard} ${s.typeCardBiz}`}
                            onClick={handleSelectBusiness}
                            disabled={submitting}
                        >
                            <div className={s.typeBizTag}>⭐ 기업 추천</div>
                            <div className={s.typeIcon}>🏢</div>
                            <h2 className={s.typeName}>기업 사용자</h2>
                            <p className={s.typeDesc}>
                                사업주, 인사 담당자로서<br />
                                사내 노무 리스크를 관리하고 싶어요
                            </p>
                            <ul className={s.typeFeatures}>
                                <li>✓ 개인 기능 전체 포함</li>
                                <li>✓ 팀원 관리 & 공유</li>
                                <li>✓ 사내 규정 AI 연동</li>
                                <li>✓ 기업 대시보드 & 리포트</li>
                            </ul>
                            <div className={s.typeBadge}>월 ₩49,000~</div>
                        </button>
                    </div>
                )}

                {/* Step 2: 기업 정보 입력 */}
                {step === 'business-form' && (
                    <form className={s.form} onSubmit={handleBusinessSubmit}>
                        <div className={s.formGrid}>
                            <div className={s.inputGroup}>
                                <label className={s.label}>
                                    회사명 <span className={s.required}>*</span>
                                </label>
                                <input
                                    type="text"
                                    className={s.input}
                                    placeholder="예: (주)노무톡"
                                    value={bizForm.name}
                                    onChange={e => setBizForm(p => ({ ...p, name: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className={s.inputGroup}>
                                <label className={s.label}>사업자등록번호</label>
                                <input
                                    type="text"
                                    className={s.input}
                                    placeholder="000-00-00000"
                                    value={bizForm.businessNumber}
                                    onChange={e => setBizForm(p => ({ ...p, businessNumber: e.target.value }))}
                                />
                            </div>

                            <div className={s.inputGroup}>
                                <label className={s.label}>업종</label>
                                <select
                                    className={s.select}
                                    value={bizForm.industry}
                                    onChange={e => setBizForm(p => ({ ...p, industry: e.target.value }))}
                                >
                                    <option value="">선택</option>
                                    <option value="제조업">제조업</option>
                                    <option value="건설업">건설업</option>
                                    <option value="도소매업">도소매업</option>
                                    <option value="운수업">운수업</option>
                                    <option value="숙박/음식점업">숙박/음식점업</option>
                                    <option value="정보통신업">정보통신업</option>
                                    <option value="금융/보험업">금융/보험업</option>
                                    <option value="교육서비스업">교육서비스업</option>
                                    <option value="보건/사회복지">보건/사회복지</option>
                                    <option value="전문/과학/기술">전문/과학/기술</option>
                                    <option value="기타">기타</option>
                                </select>
                            </div>

                            <div className={s.inputGroup}>
                                <label className={s.label}>직원 규모</label>
                                <select
                                    className={s.select}
                                    value={bizForm.employeeCount}
                                    onChange={e => setBizForm(p => ({ ...p, employeeCount: e.target.value }))}
                                >
                                    <option value="">선택</option>
                                    <option value="1-10">1~10명</option>
                                    <option value="11-50">11~50명</option>
                                    <option value="51-200">51~200명</option>
                                    <option value="201-500">201~500명</option>
                                    <option value="500+">500명 이상</option>
                                </select>
                            </div>

                            <div className={`${s.inputGroup} ${s.fullWidth}`}>
                                <label className={s.label}>회사 주소</label>
                                <input
                                    type="text"
                                    className={s.input}
                                    placeholder="회사 주소"
                                    value={bizForm.address}
                                    onChange={e => setBizForm(p => ({ ...p, address: e.target.value }))}
                                />
                            </div>

                            <div className={s.inputGroup}>
                                <label className={s.label}>담당자 이름</label>
                                <input
                                    type="text"
                                    className={s.input}
                                    placeholder="담당자 이름"
                                    value={bizForm.contactName}
                                    onChange={e => setBizForm(p => ({ ...p, contactName: e.target.value }))}
                                />
                            </div>

                            <div className={s.inputGroup}>
                                <label className={s.label}>담당자 연락처</label>
                                <input
                                    type="tel"
                                    className={s.input}
                                    placeholder="010-0000-0000"
                                    value={bizForm.contactPhone}
                                    onChange={e => setBizForm(p => ({ ...p, contactPhone: e.target.value }))}
                                />
                            </div>

                            <div className={`${s.inputGroup} ${s.fullWidth}`}>
                                <label className={s.label}>담당자 이메일</label>
                                <input
                                    type="email"
                                    className={s.input}
                                    placeholder="contact@company.com"
                                    value={bizForm.contactEmail}
                                    onChange={e => setBizForm(p => ({ ...p, contactEmail: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className={s.formActions}>
                            <button
                                type="button"
                                className={s.backBtn}
                                onClick={() => { setStep('select'); setError(null); }}
                                disabled={submitting}
                            >
                                ← 돌아가기
                            </button>
                            <button
                                type="submit"
                                className={s.submitBtn}
                                disabled={submitting || !bizForm.name.trim()}
                            >
                                {submitting ? '등록 중...' : '기업 등록 완료'}
                            </button>
                        </div>
                    </form>
                )}

                {/* 약관 동의 안내 */}
                <p className={s.termsNote}>
                    계속 진행 시 <a href="/terms" target="_blank">이용약관</a> 및{' '}
                    <a href="/privacy" target="_blank">개인정보처리방침</a>에 동의하는 것으로 간주합니다.
                </p>
            </div>
        </div>
    );
}
