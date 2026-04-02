'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import s from './page.module.css';

export default function PricingPage() {
    const [activeTab, setActiveTab] = useState<'personal' | 'business'>('personal');

    return (
        <div className={s.container}>
            {/* Hero */}
            <div className={`${s.hero} ${s.heroEmerald}`}>
                <div className={s.heroBadge}>💰 이용요금</div>
                <h1 className={s.heroTitle}>가격정책</h1>
                <p className={s.heroSubtitle}>
                    노무톡톡의 요금제와 부가 서비스 이용요금을 안내합니다.
                </p>
            </div>

            {/* TOC */}
            <div className={s.toc}>
                <div className={s.tocTitle}>목차</div>
                <ul className={s.tocList}>
                    {['서비스 개요', '요금제 비교', '부가 서비스', '결제 안내', '구독 관리', '면책 조항', '문의'].map((item) => (
                        <li key={item}>
                            <a href={`#${item}`} className={s.tocItem}>{item}</a>
                        </li>
                    ))}
                </ul>
            </div>

            {/* 서비스 개요 */}
            <div className={s.section} id="서비스 개요">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>🎯</span>
                    서비스 개요
                </h2>
                <div className={s.card}>
                    <p className={s.cardText} style={{ marginBottom: 16 }}>
                        노무톡톡은 <strong>AI 기반 노동법 상담 플랫폼</strong>으로, Google Gemini 2.5 Pro와 RAG 기술을 활용하여 법령·판례·행정해석에 기반한 전문적인 노무 상담을 제공합니다.
                    </p>
                    <div className={s.tableWrapper}>
                        <table className={s.table}>
                            <thead>
                                <tr><th>서비스</th><th>설명</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>🔍 핵심 쟁점 분석</td><td>AI가 사건 내용에서 법적 쟁점을 자동 추출하고, 중요도별 시각화 그래프 생성</td></tr>
                                <tr><td>⚖️ 법령·판례 검색</td><td>RAG 기반 법령/판례/행정해석 검색 및 법률 그래프 매핑</td></tr>
                                <tr><td>💬 AI 상담</td><td>6가지 전문 모드(일반/예측/대응전략/증거분석/보상금산정/서면작성)</td></tr>
                                <tr><td>📋 법률 서면 생성</td><td>진정서, 답변서, 이의신청서, 재심신청서, 증거설명서 초안 자동 작성</td></tr>
                                <tr><td>📊 대안 비교 분석</td><td>해결 방법별 성공률, 소요 기간, 비용 비교표 생성</td></tr>
                                <tr><td>📎 증거 분석</td><td>업로드한 PDF/이미지 문서의 AI 분석 및 증거력 평가</td></tr>
                                <tr><td>✅ 실행 체크리스트</td><td>선택한 해결 방법에 따른 맞춤 준비물·절차 체크리스트</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 요금제 비교 */}
            <div className={s.section} id="요금제 비교">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>📊</span>
                    요금제 비교
                </h2>

                {/* 개인/기업 탭 */}
                <div className={s.tabContainer}>
                    <button
                        className={`${s.tabLabel} ${activeTab === 'personal' ? s.tabLabelActive : ''}`}
                        onClick={() => setActiveTab('personal')}
                    >
                        🧑 개인
                    </button>
                    <button
                        className={`${s.tabLabel} ${s.tabLabelBiz} ${activeTab === 'business' ? s.tabLabelActiveBiz : ''}`}
                        onClick={() => setActiveTab('business')}
                    >
                        🏢 기업
                    </button>

                    {/* 개인 요금제 */}
                    {activeTab === 'personal' && (
                        <div className={s.pricingGrid} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                            {/* FREE */}
                            <div className={s.tierCard}>
                                <div className={s.tierName}>FREE</div>
                                <div className={s.tierPrice}>₩0</div>
                                <div className={s.tierPeriod}>무기한</div>
                                <ul className={s.tierFeatures}>
                                    <li><span className={s.featureCheck}>✓</span> 사건 관리 최대 3건</li>
                                    <li><span className={s.featureCheck}>✓</span> 일일 AI 상담 5회</li>
                                    <li><span className={s.featureCheck}>✓</span> 기본 쟁점 분석</li>
                                    <li><span className={s.featureCheck}>✓</span> RAG 기본 검색</li>
                                    <li><span className={s.featureCheck}>✓</span> 일반 모드 AI 상담</li>
                                    <li><span className={s.featureCross}>✗</span> 법률 서면 생성</li>
                                    <li><span className={s.featureCross}>✗</span> 증거 분석</li>
                                    <li><span className={s.featureCross}>✗</span> 대안 비교 분석</li>
                                    <li><span className={s.featureCheck}>✓</span> 사건 보관 30일</li>
                                </ul>
                            </div>

                            {/* PRO */}
                            <div className={`${s.tierCard} ${s.tierPopular}`}>
                                <div className={s.tierBadge}>⭐ 추천</div>
                                <div className={s.tierName}>PRO</div>
                                <div className={s.tierPrice}>₩9,900</div>
                                <div className={s.tierPeriod}>월 / 연간 ₩99,000 (17% 할인)</div>
                                <ul className={s.tierFeatures}>
                                    <li><span className={s.featureCheck}>✓</span> 사건 관리 <strong>무제한</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> AI 상담 <strong>무제한</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> <strong>심층 분석 + 승률 예측</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> <strong>2-Pass 검색</strong> (RAG + Gemini)</li>
                                    <li><span className={s.featureCheck}>✓</span> <strong>6가지 전문 모드</strong> 전체</li>
                                    <li><span className={s.featureCheck}>✓</span> 법률 서면 생성 <strong>월 10건</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> 증거 분석 <strong>월 20건</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> 대안 비교 · 체크리스트</li>
                                    <li><span className={s.featureCheck}>✓</span> 사건 재분석 (Build)</li>
                                    <li><span className={s.featureCheck}>✓</span> 인사이트 자동 추출</li>
                                    <li><span className={s.featureCheck}>✓</span> 사건 보관 <strong>365일</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> <strong>광고 제거</strong></li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* 기업 요금제 */}
                    {activeTab === 'business' && (
                        <div className={s.pricingGrid} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                            {/* BIZ STANDARD */}
                            <div className={`${s.tierCard} ${s.tierPopular}`}>
                                <div className={s.tierBadge} style={{ background: 'linear-gradient(135deg, #047857, #10b981)' }}>🏢 기업 추천</div>
                                <div className={s.tierName}>BIZ STANDARD</div>
                                <div className={s.tierPrice}>₩49,000</div>
                                <div className={s.tierPeriod}>월 / 연간 ₩490,000 (17% 할인)</div>
                                <ul className={s.tierFeatures}>
                                    <li><span className={s.featureCheck}>✓</span> PRO 기능 <strong>전체 포함</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> 팀원 <strong>5명</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> 법률 서면 <strong>월 50건</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> 증거 분석 <strong>월 100건</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> <strong>사내 규정 AI 연동</strong> (무제한)</li>
                                    <li><span className={s.featureCheck}>✓</span> <strong>기업 대시보드</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> 사건 분류/태그</li>
                                    <li><span className={s.featureCheck}>✓</span> 기본 통계 리포트</li>
                                    <li><span className={s.featureCheck}>✓</span> 사건 보관 <strong>무기한</strong></li>
                                    <li><span className={s.featureCross}>✗</span> API 연동</li>
                                    <li><span className={s.featureCross}>✗</span> 전담 매니저</li>
                                </ul>
                            </div>

                            {/* BIZ PREMIUM */}
                            <div className={s.tierCard}>
                                <div className={s.tierName}>BIZ PREMIUM</div>
                                <div className={s.tierPrice}>₩199,000</div>
                                <div className={s.tierPeriod}>월 / 연간 ₩1,990,000 (17% 할인)</div>
                                <ul className={s.tierFeatures}>
                                    <li><span className={s.featureCheck}>✓</span> STANDARD 기능 <strong>전체 포함</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> 팀원 <strong>무제한</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> 법률 서면 <strong>무제한</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> 증거 분석 <strong>무제한</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> <strong>사내 규정 AI 연동</strong> (무제한)</li>
                                    <li><span className={s.featureCheck}>✓</span> <strong>상세 대시보드</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> <strong>PDF 리포트 내보내기</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> <strong>API 연동</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> <strong>전담 매니저</strong></li>
                                    <li><span className={s.featureCheck}>✓</span> 사건 보관 <strong>무기한</strong></li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 부가 서비스 */}
            <div className={s.section} id="부가 서비스">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>➕</span>
                    부가 서비스 요금
                </h2>
                <div className={s.alertBox + ' ' + s.alertInfo}>
                    <span className={s.alertIcon}>💡</span>
                    <div>PRO 이상 구독자에게 제공되는 추가 유료 서비스입니다. 월 구독료에 포함되지 않습니다.</div>
                </div>
                <div className={s.tableWrapper}>
                    <table className={s.table}>
                        <thead>
                            <tr><th>부가 서비스</th><th>요금</th><th>설명</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>법률 서면 추가 생성</td><td><strong>₩1,000/건</strong></td><td>월 할당량 초과 시 (PRO: 10건 초과분)</td></tr>
                            <tr><td>증거 분석 추가</td><td><strong>₩500/건</strong></td><td>월 할당량 초과 시 (PRO: 20건 초과분)</td></tr>
                            <tr><td>전문가 연계</td><td><strong>₩30,000~</strong></td><td>공인노무사/변호사 1:1 상담 연결 (제휴 기관)</td></tr>
                            <tr><td>사건 보관 연장</td><td><strong>₩2,000/월</strong></td><td>FREE 사용자 30일 이후 사건 보관 연장</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 결제 안내 */}
            <div className={s.section} id="결제 안내">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>💳</span>
                    결제 수단 및 방법
                </h2>
                <div className={s.card}>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>•</span>
                            <span><strong>결제 PG사:</strong> PortOne (아임포트) — KG이니시스 연동</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>•</span>
                            <span><strong>지원 결제 수단:</strong> 신용카드, 체크카드</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>•</span>
                            <span><strong>결제 방식:</strong> 월간 자동결제 또는 연간 일시불</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>•</span>
                            <span><strong>결제 통화:</strong> 대한민국 원(KRW)</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>•</span>
                            <span><strong>영수증:</strong> 결제 완료 시 등록된 이메일로 전자영수증 발급</span>
                        </li>
                    </ul>
                </div>
                <div className={s.alertBox + ' ' + s.alertWarning}>
                    <span className={s.alertIcon}>⚠️</span>
                    <div>자동결제 구독의 경우, 구독 시작일 기준 매월 동일 일자에 자동 결제됩니다. 해당 일자가 없는 월에는 해당 월의 마지막 날에 결제됩니다.</div>
                </div>
            </div>

            {/* 구독 관리 */}
            <div className={s.section} id="구독 관리">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>⚙️</span>
                    구독 관리
                </h2>
                <div className={s.card}>
                    <h3 className={s.cardTitle}>구독 해지 (자동결제 중단)</h3>
                    <ul className={s.list}>
                        <li className={s.listItem}><span className={s.listBullet}>•</span><span>다음 결제일부터 자동결제가 중단됩니다.</span></li>
                        <li className={s.listItem}><span className={s.listBullet}>•</span><span>해지 후에도 현재 구독 기간 만료일까지 PRO 기능을 이용할 수 있습니다.</span></li>
                        <li className={s.listItem}><span className={s.listBullet}>•</span><span>구독 해지 후 30일간 사건 데이터가 보존됩니다.</span></li>
                    </ul>
                </div>
                <div className={s.card}>
                    <h3 className={s.cardTitle}>요금제 변경</h3>
                    <div className={s.tableWrapper}>
                        <table className={s.table}>
                            <thead>
                                <tr><th>변경 유형</th><th>적용 시점</th><th>요금 처리</th></tr>
                            </thead>
                            <tbody>
                                <tr><td>FREE → PRO</td><td>즉시 적용</td><td>결제 즉시 PRO 기능 활성화</td></tr>
                                <tr><td>PRO 월간 → 연간</td><td>다음 결제일</td><td>잔여 월간 금액 연간 결제에서 차감</td></tr>
                                <tr><td>PRO → FREE (해지)</td><td>현 구독기간 만료 후</td><td>환불 없음 (잔여 기간 이용 가능)</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className={s.card}>
                    <h3 className={s.cardTitle}>일시정지</h3>
                    <ul className={s.list}>
                        <li className={s.listItem}><span className={s.listBullet}>•</span><span>PRO 구독자는 <strong>연 1회, 최대 30일</strong> 구독 일시정지가 가능합니다.</span></li>
                        <li className={s.listItem}><span className={s.listBullet}>•</span><span>일시정지 기간 동안 PRO 기능은 FREE로 전환됩니다.</span></li>
                        <li className={s.listItem}><span className={s.listBullet}>•</span><span>일시정지 해제 시 잔여 구독 기간이 이어집니다.</span></li>
                    </ul>
                </div>
            </div>

            {/* 면책 */}
            <div className={s.section} id="면책 조항">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>⚠️</span>
                    면책 조항
                </h2>
                <div className={s.alertBox + ' ' + s.alertDanger}>
                    <span className={s.alertIcon}>🔴</span>
                    <div>
                        노무톡톡이 제공하는 모든 AI 분석 결과, 법률 상담, 서면 초안은 <strong>참고용 정보</strong>이며, 공인노무사 또는 변호사의 공식 법률 자문을 대체하지 않습니다. AI 응답의 정확성, 완전성, 적시성을 보증하지 않으며, 이를 근거로 발생한 법적 분쟁이나 손해에 대해 책임을 지지 않습니다.
                    </div>
                </div>
            </div>

            {/* 문의 */}
            <div className={s.section} id="문의">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>📞</span>
                    문의 및 고객지원
                </h2>
                <div className={s.tableWrapper}>
                    <table className={s.table}>
                        <thead>
                            <tr><th>채널</th><th>연락처</th><th>운영시간</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>📞 전화</td><td><strong>070-4448-6960</strong></td><td>평일 10:00~16:00</td></tr>
                            <tr><td>📧 이메일</td><td><strong>sws12q@naver.com</strong></td><td>24시간 접수 (영업일 1일 내 답변)</td></tr>
                            <tr><td>📱 앱 내 문의</td><td>프로필 → 고객센터</td><td>24시간 접수</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <hr className={s.divider} />

            {/* 관련 문서 링크 */}
            <div className={s.linksRow}>
                <Link href="/terms" className={s.linkCard}>
                    <span className={s.linkIcon}>📋</span>
                    이용약관
                </Link>
                <Link href="/refund" className={s.linkCard}>
                    <span className={s.linkIcon}>↩️</span>
                    환불정책
                </Link>
            </div>

            {/* Footer */}
            <div className={s.docFooter}>
                <p>본 정책은 서비스 운영 상황에 따라 사전 고지 후 변경될 수 있습니다.</p>
                <p>변경 시 앱 내 공지사항 및 이메일을 통해 최소 7일 전 안내드립니다.</p>
                <p>청사공인노무사 | 대표: 성시웅 | 사업자번호: 314-12-25811</p>
            </div>
        </div>
    );
}
