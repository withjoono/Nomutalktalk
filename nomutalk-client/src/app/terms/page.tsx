'use client';

import React from 'react';
import Link from 'next/link';
import s from './page.module.css';

export default function TermsPage() {
    return (
        <div className={s.container}>
            {/* Hero */}
            <div className={`${s.hero} ${s.heroIndigo}`}>
                <div className={s.heroBadge}>📋 법적 문서</div>
                <h1 className={s.heroTitle}>이용약관</h1>
                <p className={s.heroSubtitle}>
                    노무톡톡 서비스 이용에 관한 기본 약관입니다.
                </p>
            </div>

            {/* TOC */}
            <div className={s.toc}>
                <div className={s.tocTitle}>목차</div>
                <ul className={s.tocList}>
                    {[
                        '제1조 목적',
                        '제2조 용어',
                        '제3조 약관의 효력',
                        '제4조 서비스 내용',
                        '제5조 이용계약',
                        '제6조 회원 의무',
                        '제7조 서비스 제한',
                        '제8조 지적재산권',
                        '제9조 면책',
                        '제10조 유료 서비스',
                        '제11조 환불',
                        '제12조 개인정보',
                        '제13조 분쟁 해결',
                    ].map((item) => (
                        <li key={item}>
                            <a href={`#${item.split(' ')[0]}`} className={s.tocItem}>{item}</a>
                        </li>
                    ))}
                </ul>
            </div>

            {/* 제1조 */}
            <div className={s.section} id="제1조">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>📌</span>
                    제1조 (목적)
                </h2>
                <div className={s.card}>
                    <p className={s.cardText}>
                        본 약관은 청사공인노무사(이하 &quot;회사&quot;)가 운영하는 &quot;노무톡톡&quot; 서비스(이하 &quot;서비스&quot;)의 이용 조건 및 절차, 회사와 회원 간의 권리·의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
                    </p>
                </div>
            </div>

            {/* 제2조 */}
            <div className={s.section} id="제2조">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>📖</span>
                    제2조 (용어의 정의)
                </h2>
                <div className={s.card}>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>①</span>
                            <span>&quot;서비스&quot;란 회사가 제공하는 AI 기반 노무 상담, 법령·판례 검색, 법률 서면 생성, 증거 분석 등 모든 관련 서비스를 말합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>②</span>
                            <span>&quot;회원&quot;이란 본 약관에 동의하고 서비스에 가입하여 이용하는 자를 말합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>③</span>
                            <span>&quot;콘텐츠&quot;란 서비스를 통해 생성·제공되는 모든 AI 분석 결과, 법률 서면 초안, 상담 내용, 그래프 시각화 등을 말합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>④</span>
                            <span>&quot;유료 서비스&quot;란 회사가 제공하는 서비스 중 별도의 이용요금을 지불하여야 이용 가능한 서비스를 말합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>⑤</span>
                            <span>&quot;사건(Case)&quot;이란 회원이 서비스에 입력한 노동 관련 분쟁 또는 상담 사항의 단위를 말합니다.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* 제3조 */}
            <div className={s.section} id="제3조">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>⚡</span>
                    제3조 (약관의 효력 및 변경)
                </h2>
                <div className={s.card}>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>①</span>
                            <span>본 약관은 서비스 화면에 게시하거나 기타 방법으로 회원에게 공지함으로써 효력이 발생합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>②</span>
                            <span>회사는 합리적인 사유가 있을 경우 관련 법령에 위배되지 않는 범위 내에서 약관을 변경할 수 있으며, 변경 시 적용일 7일 전부터 서비스 내 공지합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>③</span>
                            <span>회원이 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있으며, 변경된 약관 시행일 이후에도 서비스를 계속 이용하는 경우 동의한 것으로 간주합니다.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* 제4조 */}
            <div className={s.section} id="제4조">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>🛠️</span>
                    제4조 (서비스의 내용)
                </h2>
                <div className={s.card}>
                    <p className={s.cardText} style={{ marginBottom: 16 }}>회사가 제공하는 서비스는 다음과 같습니다.</p>
                    <div className={s.tableWrapper}>
                        <table className={s.table}>
                            <thead>
                                <tr>
                                    <th>서비스</th>
                                    <th>설명</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td>사건 등록 및 관리</td><td>노동 관련 사건을 등록하고, 진행 상황을 관리하는 기능</td></tr>
                                <tr><td>AI 쟁점 분석</td><td>사건 내용에서 핵심 법적 쟁점을 자동 추출하고, 중요도별 시각화</td></tr>
                                <tr><td>법령·판례 검색</td><td>RAG 기반 관련 법령, 판례, 행정해석 검색 및 법률 그래프 생성</td></tr>
                                <tr><td>AI 상담</td><td>6가지 전문 모드를 통한 맥락 기반 AI 노무 상담</td></tr>
                                <tr><td>법률 서면 생성</td><td>진정서, 답변서, 이의신청서 등 법률 서면 초안 자동 작성</td></tr>
                                <tr><td>증거 분석</td><td>업로드 문서(PDF/이미지)의 AI 분석 및 증거력 평가</td></tr>
                                <tr><td>대안 비교 분석</td><td>해결 방법별 성공률, 기간, 비용 비교표 생성</td></tr>
                                <tr><td>후속 지원</td><td>실행 체크리스트, 타임라인, 서면 생성 지원</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 제5조 */}
            <div className={s.section} id="제5조">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>🤝</span>
                    제5조 (이용계약의 체결)
                </h2>
                <div className={s.card}>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>①</span>
                            <span>이용계약은 회원이 되고자 하는 자가 약관에 동의하고 회원가입을 신청한 후, 회사가 이를 승낙함으로써 체결됩니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>②</span>
                            <span>회사는 Firebase Authentication을 통한 이메일/소셜 로그인으로 회원가입을 처리합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>③</span>
                            <span>회사는 다음 각 호에 해당하는 경우 이용계약을 거부하거나 사후 해지할 수 있습니다: 타인의 정보를 도용한 경우, 허위 정보를 기재한 경우, 관련 법령을 위반하거나 위반할 목적으로 서비스를 이용하는 경우.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* 제6조 */}
            <div className={s.section} id="제6조">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>✅</span>
                    제6조 (회원의 의무)
                </h2>
                <div className={s.card}>
                    <p className={s.cardText} style={{ marginBottom: 12 }}>회원은 다음 사항을 준수해야 합니다.</p>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>1.</span>
                            <span>회원 가입 시 사실에 근거한 정보를 제공해야 합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>2.</span>
                            <span>서비스를 이용하여 얻은 정보를 회사의 사전 승낙 없이 복제, 유통, 상업적으로 이용하여서는 안 됩니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>3.</span>
                            <span>타인의 개인정보를 부정하게 수집·이용하거나, 서비스의 운영을 방해하는 행위를 해서는 안 됩니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>4.</span>
                            <span>서비스를 이용하여 법률에 위반되는 행위를 하여서는 안 됩니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>5.</span>
                            <span>계정 정보(비밀번호 등)의 관리 책임은 회원에게 있으며, 이를 제3자에게 양도·대여할 수 없습니다.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* 제7조 */}
            <div className={s.section} id="제7조">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>🚫</span>
                    제7조 (서비스의 제한 및 중단)
                </h2>
                <div className={s.card}>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>①</span>
                            <span>회사는 시스템 점검, 교체 및 고장, 통신 두절 등의 사유가 발생한 경우 서비스의 제공을 일시적으로 중단할 수 있습니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>②</span>
                            <span>회사는 무료 서비스에 대해 일일 이용 횟수(5회), 등록 가능 사건 수(3건) 등의 제한을 둘 수 있습니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>③</span>
                            <span>회사는 서비스 이용이 현저히 증가하여 안정적 운영이 어려운 경우, 일시적으로 서비스를 제한할 수 있습니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>④</span>
                            <span>회사는 회원의 약관 위반 행위가 확인된 경우, 사전 통지 후 서비스 이용을 제한하거나 계약을 해지할 수 있습니다.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* 제8조 */}
            <div className={s.section} id="제8조">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>©️</span>
                    제8조 (지적재산권)
                </h2>
                <div className={s.card}>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>①</span>
                            <span>서비스에 포함된 소프트웨어, 디자인, 로고, 텍스트, 그래픽 등 일체의 저작물에 대한 지적재산권은 회사에 귀속됩니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>②</span>
                            <span>AI가 생성한 콘텐츠(상담 답변, 법률 서면 초안 등)에 대한 저작권은 관련 법령에 따라 처리되며, 회원은 개인적 용도로 자유롭게 활용할 수 있습니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>③</span>
                            <span>회원이 입력한 사건 내용은 회원에게 귀속되며, 회사는 서비스 개선 목적으로 비식별화하여 활용할 수 있습니다.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* 제9조 */}
            <div className={s.section} id="제9조">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>⚠️</span>
                    제9조 (면책 조항)
                </h2>
                <div className={s.alertBox + ' ' + s.alertDanger}>
                    <span className={s.alertIcon}>🔴</span>
                    <div>
                        <strong>중요 고지:</strong> 노무톡톡은 AI 기반 정보 제공 서비스이며, 공인노무사 또는 변호사의 공식 법률 자문을 대체하지 않습니다.
                    </div>
                </div>
                <div className={s.card}>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>①</span>
                            <span>서비스를 통해 제공되는 모든 AI 분석 결과, 법률 상담, 서면 초안은 <strong>참고용 정보</strong>이며, 법적 구속력이 없습니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>②</span>
                            <span>회사는 AI 응답의 정확성, 완전성, 적시성을 보증하지 않으며, 이를 근거로 발생한 법적 분쟁이나 손해에 대해 책임을 지지 않습니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>③</span>
                            <span>회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력적 사유로 서비스를 제공할 수 없는 경우에는 책임이 면제됩니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>④</span>
                            <span>회원이 자신의 개인정보를 타인에게 유출하거나 제공하여 발생하는 피해에 대해서 회사는 책임을 지지 않습니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>⑤</span>
                            <span>회사는 회원이 서비스를 이용하여 기대하는 수익을 얻지 못하거나 상실한 것에 대하여 책임을 지지 않습니다.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* 제10조 */}
            <div className={s.section} id="제10조">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>💳</span>
                    제10조 (유료 서비스)
                </h2>
                <div className={s.card}>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>①</span>
                            <span>유료 서비스의 종류, 이용요금, 결제 방법 등은 <Link href="/pricing" style={{ color: 'var(--toss-blue)', fontWeight: 600 }}>가격정책</Link> 페이지에 별도로 게시합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>②</span>
                            <span>유료 서비스의 결제는 PortOne(아임포트) PG를 통해 처리되며, 신용카드 및 체크카드 결제를 지원합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>③</span>
                            <span>구독형 서비스의 경우 구독 시작일 기준 매월 동일 일자에 자동 결제됩니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>④</span>
                            <span>회사는 유료 서비스의 요금을 변경할 수 있으며, 변경 시 최소 30일 전에 서비스 내에 공지합니다.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* 제11조 */}
            <div className={s.section} id="제11조">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>💰</span>
                    제11조 (환불)
                </h2>
                <div className={s.card}>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>①</span>
                            <span>유료 서비스의 환불은 「전자상거래 등에서의 소비자보호에 관한 법률」에 따릅니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>②</span>
                            <span>상세 환불 조건 및 절차는 <Link href="/refund" style={{ color: 'var(--toss-blue)', fontWeight: 600 }}>환불정책</Link> 페이지에 별도로 게시합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>③</span>
                            <span>디지털 콘텐츠의 특성상, 서비스 이용이 개시된 후에는 환불이 제한될 수 있습니다.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* 제12조 */}
            <div className={s.section} id="제12조">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>🔐</span>
                    제12조 (개인정보 보호)
                </h2>
                <div className={s.card}>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>①</span>
                            <span>회사는 회원의 개인정보를 「개인정보 보호법」 및 관련 법령에 따라 보호하며, 자세한 사항은 <Link href="/privacy" style={{ color: 'var(--toss-blue)', fontWeight: 600 }}>개인정보처리방침</Link>에서 확인할 수 있습니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>②</span>
                            <span>회원이 입력한 사건 내용은 암호화하여 저장하며, 구독 해지 후 30일 이내에 삭제합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>③</span>
                            <span>업로드된 증거 파일은 Gemini Vision API 분석 후 Firebase Storage에 30일간 임시 보관되며, 이후 자동 삭제됩니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>④</span>
                            <span>회사는 서비스 제공 및 개선 목적으로 비식별화된 데이터를 통계 분석에 활용할 수 있습니다.</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* 제13조 */}
            <div className={s.section} id="제13조">
                <h2 className={s.sectionTitle}>
                    <span className={s.sectionIcon}>⚖️</span>
                    제13조 (분쟁 해결)
                </h2>
                <div className={s.card}>
                    <ul className={s.list}>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>①</span>
                            <span>본 약관에 명시되지 않은 사항은 대한민국 관련 법령에 따릅니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>②</span>
                            <span>서비스 이용과 관련한 분쟁에 대해서는 회사의 소재지를 관할하는 법원을 관할 법원으로 합니다.</span>
                        </li>
                        <li className={s.listItem}>
                            <span className={s.listBullet}>③</span>
                            <span>소비자 관련 분쟁은 「소비자기본법」 제16조에 따른 한국소비자원 소비자분쟁조정위원회에 조정을 신청할 수 있습니다.</span>
                        </li>
                    </ul>
                </div>
            </div>

            <hr className={s.divider} />

            {/* 관련 문서 링크 */}
            <div className={s.linksRow}>
                <Link href="/pricing" className={s.linkCard}>
                    <span className={s.linkIcon}>💰</span>
                    가격정책 (이용요금)
                </Link>
                <Link href="/refund" className={s.linkCard}>
                    <span className={s.linkIcon}>↩️</span>
                    환불정책
                </Link>
                <Link href="/privacy" className={s.linkCard}>
                    <span className={s.linkIcon}>🔐</span>
                    개인정보처리방침
                </Link>
            </div>

            {/* Footer */}
            <div className={s.docFooter}>
                <p>본 약관은 2026년 3월 29일부터 시행합니다.</p>
                <p>청사공인노무사 | 대표: 성시웅 | 사업자번호: 314-12-25811</p>
                <p>대전광역시 서구 청사로 228, 11층 1110호</p>
            </div>
        </div>
    );
}
