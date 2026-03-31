'use client';

import React from 'react';
import Link from 'next/link';
import s from './page.module.css';

export default function RefundPage() {
    return (
        <div className={s.container}>
            {/* Hero */}
            <div className={`${s.hero} ${s.heroAmber}`}>
                <div className={s.heroBadge}>↩️ 소비자 보호</div>
                <h1 className={s.heroTitle}>환불정책</h1>
                <p className={s.heroSubtitle}>
                    노무톡톡 유료 서비스의 환불 조건 및 절차를 안내합니다.
                </p>
            </div>

            {/* TOC */}
            <div className={s.toc}>
                <div className={s.tocTitle}>목차</div>
                <ul className={s.tocList}>
                    {['기본 원칙', '환불 가능 조건', '환불 불가 조건', '환불 절차', '환불 금액 산정', '청약철회 불가', '문의'].map((item) => (
                        <li key={item}>
                            <a href={`#${item}`} className={s.tocItem}>{item}</a>
                        </li>
                    ))}
                </ul>
            </div>

            {/* 기본 원칙 */}
            <div className={s.section} id="기본 원칙">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>📌</span>
                    기본 원칙
                </h2>
                <div className={s.card}>
                    <p className={s.cardText}>
                        노무톡톡의 환불 정책은 <strong>「전자상거래 등에서의 소비자보호에 관한 법률」</strong> 및 <strong>「콘텐츠산업 진흥법」</strong>을 준수합니다.
                    </p>
                </div>
                <div className={s.alertBox + ' ' + s.alertDanger}>
                    <span className={s.alertIcon}>🔴</span>
                    <div>
                        본 서비스는 디지털 콘텐츠 특성상, 서비스 이용이 개시된 후에는 환불이 제한될 수 있습니다. 결제 전 이용약관을 반드시 확인해주세요.
                    </div>
                </div>
            </div>

            {/* 환불 가능 조건 */}
            <div className={s.section} id="환불 가능 조건">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>✅</span>
                    환불 가능 조건
                </h2>
                <div className={s.tableWrapper}>
                    <table className={s.table}>
                        <thead>
                            <tr><th>#</th><th>조건</th><th>환불 금액</th><th>비고</th></tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>1</td>
                                <td><strong>구매 후 7일 이내</strong> + 서비스 미이용</td>
                                <td>결제 금액 <strong>100% 환불</strong></td>
                                <td>로그인 및 기능 사용 이력 없음</td>
                            </tr>
                            <tr>
                                <td>2</td>
                                <td><strong>구매 후 7일 이내</strong> + 서비스 이용</td>
                                <td><strong>일할 계산</strong> 후 잔여분 환불</td>
                                <td>이용일수 × (결제금액 ÷ 구독일수) 차감</td>
                            </tr>
                            <tr>
                                <td>3</td>
                                <td><strong>서비스 장애</strong>로 인한 이용 불가</td>
                                <td>이용기간 연장 또는 <strong>일할 환불</strong></td>
                                <td>24시간 이상 연속 장애 시</td>
                            </tr>
                            <tr>
                                <td>4</td>
                                <td><strong>중복 결제</strong></td>
                                <td>결제 금액 <strong>100% 환불</strong></td>
                                <td>증빙 확인 후 처리</td>
                            </tr>
                            <tr>
                                <td>5</td>
                                <td><strong>오류 결제</strong> (미성년자 결제 등)</td>
                                <td>결제 금액 <strong>100% 환불</strong></td>
                                <td>법정대리인 동의 없는 결제</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 환불 불가 조건 */}
            <div className={s.section} id="환불 불가 조건">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>🚫</span>
                    환불 불가 조건
                </h2>
                <div className={s.tableWrapper}>
                    <table className={s.table}>
                        <thead>
                            <tr><th>#</th><th>조건</th><th>사유</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>1</td><td>구매 후 7일 경과 + 서비스 이용 이력 있음</td><td>디지털 콘텐츠 이용 개시</td></tr>
                            <tr><td>2</td><td>AI 상담 응답에 대한 불만족</td><td>AI 생성 콘텐츠의 특성 (참고용 정보)</td></tr>
                            <tr><td>3</td><td>법률 서면 생성 후 결과물에 대한 불만</td><td>서비스 이용 완료로 간주</td></tr>
                            <tr><td>4</td><td>서비스 약관 위반에 의한 이용 제한</td><td>약관 위반으로 인한 종료</td></tr>
                            <tr><td>5</td><td>무료(FREE) 요금제</td><td>결제 금액 없음</td></tr>
                        </tbody>
                    </table>
                </div>
                <div className={s.alertBox + ' ' + s.alertWarning}>
                    <span className={s.alertIcon}>⚠️</span>
                    <div>
                        AI 상담 결과는 <strong>법적 구속력이 없는 참고용 정보</strong>입니다. AI 응답의 정확성이나 법적 결과에 대한 보증을 하지 않으며, 이를 사유로 한 환불은 불가합니다.
                    </div>
                </div>
            </div>

            {/* 환불 절차 */}
            <div className={s.section} id="환불 절차">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>📋</span>
                    환불 절차
                </h2>
                <div className={s.card}>
                    <h3 className={s.cardTitle}>처리 과정</h3>
                    <ul className={s.list}>
                        <li className={s.listItem}><span className={s.listBullet}>1️⃣</span><span><strong>환불 신청</strong> — 아래 방법 중 택 1</span></li>
                        <li className={s.listItem}><span className={s.listBullet}>2️⃣</span><span><strong>접수 확인</strong> — 1영업일 이내 확인 연락</span></li>
                        <li className={s.listItem}><span className={s.listBullet}>3️⃣</span><span><strong>이용 이력 확인</strong> — 서비스 사용 여부 확인</span></li>
                        <li className={s.listItem}><span className={s.listBullet}>4️⃣</span><span><strong>환불 처리</strong> — 3~5영업일 내 원결제 수단으로 환불</span></li>
                    </ul>
                </div>
                <div className={s.card}>
                    <h3 className={s.cardTitle}>환불 신청 방법</h3>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>📱</span>
                            <span><strong>앱 내 신청:</strong> 프로필 → 결제 내역 → 해당 결제 선택 → 환불 요청</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>📧</span>
                            <span><strong>이메일 신청:</strong> sws12q@naver.com으로 회원 이메일, 결제일시, 결제금액, 환불 사유 전송</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>📞</span>
                            <span><strong>전화 신청:</strong> 070-4448-6960 (평일 10:00~16:00)</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* 환불 금액 산정 */}
            <div className={s.section} id="환불 금액 산정">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>🧮</span>
                    환불 금액 산정 기준
                </h2>
                <div className={s.card}>
                    <h3 className={s.cardTitle}>월간 구독 (PRO ₩9,900/월)</h3>
                    <p className={s.cardText} style={{ marginBottom: 12 }}>
                        환불 금액 = 결제 금액 - (일일 이용료 × 이용일수) - PG 수수료
                    </p>
                    <div className={s.alertBox + ' ' + s.alertInfo} style={{ margin: 0 }}>
                        <span className={s.alertIcon}>💡</span>
                        <div>
                            <strong>예시:</strong> 구독 8일째 환불 신청, 서비스 이용 이력 있음<br />
                            일일 이용료 = ₩9,900 ÷ 30일 = ₩330/일<br />
                            환불 금액 = ₩9,900 - (₩330 × 8일) = <strong>₩7,260</strong>
                        </div>
                    </div>
                </div>
                <div className={s.card}>
                    <h3 className={s.cardTitle}>연간 구독 (PRO ₩99,000/년)</h3>
                    <p className={s.cardText} style={{ marginBottom: 12 }}>
                        환불 금액 = 결제 금액 - (할인 미적용 월정가 × 이용 개월수) - PG 수수료
                    </p>
                    <div className={s.alertBox + ' ' + s.alertWarning} style={{ margin: 0 }}>
                        <span className={s.alertIcon}>⚠️</span>
                        <div>
                            연간 구독 환불 시, 이미 이용한 기간은 <strong>할인 전 월정가(₩9,900/월)</strong>로 계산됩니다.
                        </div>
                    </div>
                    <div className={s.alertBox + ' ' + s.alertInfo} style={{ marginTop: 12, marginBottom: 0 }}>
                        <span className={s.alertIcon}>💡</span>
                        <div>
                            <strong>예시:</strong> 연간 구독 3개월째 환불 신청<br />
                            환불 금액 = ₩99,000 - (₩9,900 × 3개월) = <strong>₩69,300</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* 청약철회 불가 */}
            <div className={s.section} id="청약철회 불가">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>📜</span>
                    청약철회 불가 고지
                </h2>
                <div className={s.card}>
                    <p className={s.cardText} style={{ marginBottom: 12 }}>
                        전자상거래법 제17조 제2항에 따라, 아래의 경우 청약철회가 제한됩니다:
                    </p>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>1.</span>
                            <span>디지털 콘텐츠의 제공이 개시된 경우 (AI 상담 1회 이상 사용)</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>2.</span>
                            <span>이용자의 주문에 따라 개별적으로 생성된 서비스 (맞춤 법률 서면, 증거 분석 등)</span>
                        </li>
                    </ul>
                </div>
                <div className={s.alertBox + ' ' + s.alertInfo}>
                    <span className={s.alertIcon}>💡</span>
                    <div>
                        서비스 제공 개시 전에 그 내용을 확인할 수 있는 <strong>체험판(FREE)을 제공</strong>하고 있으므로, 결제 전 충분히 서비스를 체험해보시기 바랍니다.
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
                <Link href="/pricing" className={s.linkCard}>
                    <span className={s.linkIcon}>💰</span>
                    가격정책 (이용요금)
                </Link>
                <Link href="/privacy" className={s.linkCard}>
                    <span className={s.linkIcon}>🔐</span>
                    개인정보처리방침
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
