'use client';

import React from 'react';
import Link from 'next/link';
import s from './page.module.css';

export default function PrivacyPage() {
    return (
        <div className={s.container}>
            {/* Hero */}
            <div className={`${s.hero} ${s.heroTeal}`}>
                <div className={s.heroBadge}>🔐 개인정보 보호</div>
                <h1 className={s.heroTitle}>개인정보처리방침</h1>
                <p className={s.heroSubtitle}>
                    청사공인노무사는 회원의 개인정보를 소중히 보호합니다.
                </p>
            </div>

            {/* TOC */}
            <div className={s.toc}>
                <div className={s.tocTitle}>목차</div>
                <ul className={s.tocList}>
                    {[
                        '총칙',
                        '수집 항목',
                        '수집 및 이용 목적',
                        '보유 및 파기',
                        '제3자 제공',
                        '처리 위탁',
                        '이용자 권리',
                        '자동 수집',
                        '안전성 확보',
                        '책임자 안내',
                    ].map((item) => (
                        <li key={item}>
                            <a href={`#${item}`} className={s.tocItem}>{item}</a>
                        </li>
                    ))}
                </ul>
            </div>

            {/* ── 제1조 총칙 ── */}
            <div className={s.section} id="총칙">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>📌</span>
                    제1조 (총칙)
                </h2>
                <div className={s.card}>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>①</span>
                            <span>청사공인노무사(이하 &quot;회사&quot;)는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>②</span>
                            <span>본 방침은 &quot;노무톡톡&quot; 서비스(웹사이트 및 모바일 앱)에 적용됩니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>③</span>
                            <span>회사는 개인정보처리방침을 변경하는 경우 서비스 공지사항 또는 이메일을 통해 최소 7일 전 사전 고지합니다.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* ── 제2조 수집 항목 ── */}
            <div className={s.section} id="수집 항목">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>📋</span>
                    제2조 (수집하는 개인정보 항목)
                </h2>
                <div className={s.tableWrapper}>
                    <table className={s.table}>
                        <thead>
                            <tr>
                                <th>구분</th>
                                <th>수집 항목</th>
                                <th>수집 방법</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>필수</strong></td>
                                <td>이메일 주소, 비밀번호(해시), 이름(닉네임), Firebase UID</td>
                                <td>회원가입 시 직접 입력</td>
                            </tr>
                            <tr>
                                <td><strong>소셜 로그인</strong></td>
                                <td>소셜 계정 식별자, 이메일, 프로필 이미지(선택)</td>
                                <td>Google/Kakao OAuth 연동</td>
                            </tr>
                            <tr>
                                <td><strong>결제 정보</strong></td>
                                <td>결제 수단 정보, 거래 내역, 결제일시</td>
                                <td>PortOne(아임포트) PG 연동</td>
                            </tr>
                            <tr>
                                <td><strong>서비스 이용</strong></td>
                                <td>사건 내용, 상담 기록, 업로드 문서, 증거 파일</td>
                                <td>서비스 이용 과정에서 직접 입력</td>
                            </tr>
                            <tr>
                                <td><strong>자동 수집</strong></td>
                                <td>IP 주소, 브라우저 종류, 접속 일시, 쿠키, 기기 정보</td>
                                <td>서비스 이용 시 자동 생성·수집</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className={s.alertBox + ' ' + s.alertInfo}>
                    <span className={s.alertIcon}>💡</span>
                    <div>
                        회사는 주민등록번호, 여권번호, 운전면허번호 등 <strong>고유식별정보를 수집하지 않습니다.</strong>
                    </div>
                </div>
            </div>

            {/* ── 제3조 수집 및 이용 목적 ── */}
            <div className={s.section} id="수집 및 이용 목적">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>🎯</span>
                    제3조 (개인정보의 수집 및 이용 목적)
                </h2>
                <div className={s.card}>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>1.</span>
                            <span><strong>서비스 제공:</strong> AI 노무 상담, 법령·판례 검색, 법률 서면 생성, 증거 분석, 사건 관리</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>2.</span>
                            <span><strong>회원 관리:</strong> 회원 가입·인증, 회원제 서비스 이용, 본인 확인, 부정이용 방지</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>3.</span>
                            <span><strong>결제 처리:</strong> 유료 서비스 결제, 환불, 구독 관리</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>4.</span>
                            <span><strong>서비스 개선:</strong> 비식별화된 데이터를 활용한 AI 모델 개선, 통계 분석, 서비스 품질 향상</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>5.</span>
                            <span><strong>고객 지원:</strong> 문의 상담 처리, 서비스 관련 공지사항 전달</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>6.</span>
                            <span><strong>법적 의무 이행:</strong> 관련 법령에 따른 의무 이행 및 분쟁 해결</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* ── 제4조 보유 및 파기 ── */}
            <div className={s.section} id="보유 및 파기">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>🗑️</span>
                    제4조 (개인정보의 보유 및 파기)
                </h2>
                <div className={s.card}>
                    <h3 className={s.cardTitle}>보유 기간</h3>
                    <div className={s.tableWrapper}>
                        <table className={s.table}>
                            <thead>
                                <tr>
                                    <th>항목</th>
                                    <th>보유 기간</th>
                                    <th>근거</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>회원 계정 정보</td>
                                    <td>회원 탈퇴 시까지</td>
                                    <td>서비스 이용계약</td>
                                </tr>
                                <tr>
                                    <td>사건(Case) 데이터</td>
                                    <td>구독 해지 후 <strong>30일</strong></td>
                                    <td>이용약관 제12조</td>
                                </tr>
                                <tr>
                                    <td>업로드 증거 파일</td>
                                    <td>분석 완료 후 <strong>30일</strong></td>
                                    <td>이용약관 제12조</td>
                                </tr>
                                <tr>
                                    <td>결제 기록</td>
                                    <td><strong>5년</strong></td>
                                    <td>전자상거래법</td>
                                </tr>
                                <tr>
                                    <td>접속 로그</td>
                                    <td><strong>3개월</strong></td>
                                    <td>통신비밀보호법</td>
                                </tr>
                                <tr>
                                    <td>소비자 불만·분쟁 기록</td>
                                    <td><strong>3년</strong></td>
                                    <td>전자상거래법</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className={s.card}>
                    <h3 className={s.cardTitle}>파기 절차 및 방법</h3>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>①</span>
                            <span>보유 기간이 경과한 개인정보는 해당 기간 종료일로부터 <strong>5일 이내</strong>에 파기합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>②</span>
                            <span>전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법(복구 불가능한 삭제)으로 파기합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>③</span>
                            <span>Firebase Firestore 및 Storage에 저장된 데이터는 자동화된 Cloud Functions TTL 정책에 의해 삭제됩니다.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* ── 제5조 제3자 제공 ── */}
            <div className={s.section} id="제3자 제공">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>🤝</span>
                    제5조 (개인정보의 제3자 제공)
                </h2>
                <div className={s.card}>
                    <p className={s.cardText} style={{ marginBottom: 12 }}>
                        회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.
                    </p>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>①</span>
                            <span>이용자가 사전에 동의한 경우</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>②</span>
                            <span>법령의 규정에 의하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>③</span>
                            <span>통계 작성, 학술 연구 또는 시장 조사를 위해 필요한 경우로서 특정 개인을 알아볼 수 없는 형태로 제공하는 경우</span>
                        </li>
                    </ul>
                </div>
                <div className={s.alertBox + ' ' + s.alertSuccess}>
                    <span className={s.alertIcon}>✅</span>
                    <div>
                        회사는 AI 분석을 위해 Google Gemini API를 이용하나, 전송되는 데이터는 <strong>비식별화 처리</strong>된 형태이며, Google의 AI 모델 학습에 사용되지 않습니다.
                    </div>
                </div>
            </div>

            {/* ── 제6조 처리 위탁 ── */}
            <div className={s.section} id="처리 위탁">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>🏢</span>
                    제6조 (개인정보 처리의 위탁)
                </h2>
                <div className={s.tableWrapper}>
                    <table className={s.table}>
                        <thead>
                            <tr>
                                <th>수탁업체</th>
                                <th>위탁 업무</th>
                                <th>보유 및 이용 기간</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Google Cloud (Firebase)</td>
                                <td>클라우드 인프라, 인증, 데이터 저장</td>
                                <td>위탁 계약 종료 시까지</td>
                            </tr>
                            <tr>
                                <td>PortOne (아임포트)</td>
                                <td>결제 처리</td>
                                <td>위탁 계약 종료 시까지</td>
                            </tr>
                            <tr>
                                <td>Google (Gemini API)</td>
                                <td>AI 분석 및 응답 생성</td>
                                <td>API 호출 시 즉시 처리 (데이터 미보관)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className={s.card}>
                    <p className={s.cardText}>
                        회사는 위탁 계약 체결 시 「개인정보 보호법」 제26조에 따라 위탁 업무 수행 목적 외 개인정보 처리 금지, 기술적·관리적 보호 조치, 재위탁 제한, 수탁자에 대한 관리·감독, 손해배상 등 책임에 관한 사항을 계약서 등 문서에 명시합니다.
                    </p>
                </div>
            </div>

            {/* ── 제7조 이용자 권리 ── */}
            <div className={s.section} id="이용자 권리">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>👤</span>
                    제7조 (정보주체의 권리·의무 및 행사 방법)
                </h2>
                <div className={s.card}>
                    <p className={s.cardText} style={{ marginBottom: 12 }}>
                        이용자(정보주체)는 회사에 대해 언제든지 다음 각 호의 권리를 행사할 수 있습니다.
                    </p>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>1.</span>
                            <span><strong>열람 요구:</strong> 개인정보 처리 현황에 대한 열람 청구</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>2.</span>
                            <span><strong>정정·삭제 요구:</strong> 오류 등이 있을 경우 정정 또는 삭제 요구</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>3.</span>
                            <span><strong>처리정지 요구:</strong> 개인정보 처리의 정지 요구</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>4.</span>
                            <span><strong>동의 철회:</strong> 개인정보 수집·이용 동의의 철회</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>5.</span>
                            <span><strong>회원 탈퇴:</strong> 프로필 → 계정 설정 → 회원 탈퇴를 통해 직접 처리</span>
                        </li>
                    </ul>
                </div>
                <div className={s.alertBox + ' ' + s.alertInfo}>
                    <span className={s.alertIcon}>💡</span>
                    <div>
                        권리 행사는 <strong>이메일(sws12q@naver.com)</strong> 또는 <strong>전화(070-4448-6960)</strong>를 통해 하실 수 있으며, 회사는 지체 없이 조치하겠습니다.
                    </div>
                </div>
            </div>

            {/* ── 제8조 자동 수집 ── */}
            <div className={s.section} id="자동 수집">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>🍪</span>
                    제8조 (쿠키 및 자동 수집 장치)
                </h2>
                <div className={s.card}>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>①</span>
                            <span>회사는 이용자에게 개별적인 맞춤 서비스를 제공하기 위해 이용 정보를 저장하고 수시로 불러오는 쿠키(Cookie)를 사용합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>②</span>
                            <span>쿠키는 서비스 접속 시 자동 로그인, 세션 유지, 이용 패턴 분석 등의 목적으로 사용됩니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>③</span>
                            <span>이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 일부 서비스 이용에 제한이 있을 수 있습니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>④</span>
                            <span>Google Analytics 등 분석 도구를 사용하여 서비스 이용 통계를 수집할 수 있으며, 이는 개인을 식별하지 않는 형태로 처리됩니다.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* ── 제9조 안전성 확보 ── */}
            <div className={s.section} id="안전성 확보">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>🛡️</span>
                    제9조 (개인정보의 안전성 확보 조치)
                </h2>
                <div className={s.card}>
                    <p className={s.cardText} style={{ marginBottom: 12 }}>
                        회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
                    </p>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>🔒</span>
                            <span><strong>데이터 암호화:</strong> 사건 내용 및 민감 정보는 Firebase Firestore 보안 규칙 및 전송 구간 SSL/TLS 암호화를 적용합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>🔑</span>
                            <span><strong>접근 제한:</strong> 개인정보에 대한 접근 권한을 최소한의 인원으로 제한하고, Firebase Authentication 기반 인증 체계를 운영합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>📊</span>
                            <span><strong>접속 기록 보관:</strong> 개인정보 처리 시스템에 대한 접속 기록을 최소 1년 이상 보관·관리합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>🦠</span>
                            <span><strong>보안 프로그램:</strong> Google Cloud Platform의 보안 인프라(DDoS 방어, WAF 등)를 활용하여 악성 공격에 대응합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>📝</span>
                            <span><strong>내부 관리 계획:</strong> 개인정보 보호를 위한 내부 관리 계획을 수립하고 정기적으로 점검합니다.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* ── 제10조 책임자 안내 ── */}
            <div className={s.section} id="책임자 안내">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>📞</span>
                    제10조 (개인정보 보호 책임자)
                </h2>
                <div className={s.tableWrapper}>
                    <table className={s.table}>
                        <thead>
                            <tr>
                                <th>구분</th>
                                <th>내용</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>성명</td><td><strong>성시웅</strong></td></tr>
                            <tr><td>직위</td><td>대표 (개인정보 보호 책임자)</td></tr>
                            <tr><td>연락처</td><td>070-4448-6960</td></tr>
                            <tr><td>이메일</td><td>sws12q@naver.com</td></tr>
                        </tbody>
                    </table>
                </div>
                <div className={s.card}>
                    <p className={s.cardText} style={{ marginBottom: 12 }}>
                        기타 개인정보 침해에 대한 신고·상담이 필요한 경우 아래 기관에 문의하시기 바랍니다.
                    </p>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>•</span>
                            <span><strong>개인정보침해 신고센터</strong> (한국인터넷진흥원): privacy.kisa.or.kr / ☎ 118</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>•</span>
                            <span><strong>개인정보 분쟁조정위원회:</strong> www.kopico.go.kr / ☎ 1833-6972</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>•</span>
                            <span><strong>대검찰청 사이버수사과:</strong> www.spo.go.kr / ☎ 1301</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>•</span>
                            <span><strong>경찰청 사이버수사국:</strong> ecrm.police.go.kr / ☎ 182</span>
                        </li>
                    </ul>
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
                <Link href="/pricing" className={s.linkCard}>
                    <span className={s.linkIcon}>💰</span>
                    가격정책
                </Link>
            </div>

            {/* Footer */}
            <div className={s.docFooter}>
                <p>본 개인정보처리방침은 2026년 3월 29일부터 시행합니다.</p>
                <p>청사공인노무사 | 대표: 성시웅 | 사업자번호: 314-12-25811</p>
                <p>대전광역시 서구 청사로 228, 11층 1110호</p>
            </div>
        </div>
    );
}
