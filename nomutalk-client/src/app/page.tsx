import Link from 'next/link';

export default function Home() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '2rem',
      textAlign: 'center',
      background: 'linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%)'
    }}>
      <div style={{
        width: '80px',
        height: '80px',
        backgroundColor: '#2563eb',
        borderRadius: '20px',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '2rem',
        fontWeight: 'bold',
        boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)'
      }}>
        N
      </div>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: '800', color: '#111827' }}>NomuTalk</h1>
      <p style={{ marginBottom: '3rem', color: '#6b7280', fontSize: '1.1rem', lineHeight: '1.6' }}>
        AI 공인노무사와 함께하는<br />실시간 법률 상담 서비스
      </p>
      <Link href="/chat" style={{
        backgroundColor: '#2563eb',
        color: 'white',
        padding: '1.2rem 3rem',
        borderRadius: '1rem',
        fontWeight: 'bold',
        fontSize: '1.1rem',
        boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)',
        transition: 'all 0.2s'
      }}>
        무료 상담 시작하기
      </Link>
    </div>
  );
}
